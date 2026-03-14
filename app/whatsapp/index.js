/**
 * WhatsApp sidecar for personal dashboard.
 *
 * Connects to WhatsApp as a linked device via Baileys v7,
 * forwards incoming messages to the dashboard backend,
 * and sends replies back.
 *
 * Baileys v7 includes LID (Linked Identity) session migration
 * which fixes "Waiting for this message" decryption errors.
 */

import makeWASocket, {
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  jidNormalizedUser,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import express from "express";
import QRCode from "qrcode";
import pino from "pino";
import path from "path";
import os from "os";
import fs from "fs";

const DATA_DIR = process.env.DASHBOARD_DATA_DIR || path.join(os.homedir(), ".personal-dashboard");
const AUTH_DIR = path.join(DATA_DIR, "whatsapp-auth");
const WEBHOOK_TOKEN_PATH = path.join(DATA_DIR, ".whatsapp_webhook_token");
const BACKEND_URL = process.env.DASHBOARD_BACKEND || "http://localhost:8000";
const PORT = parseInt(process.env.WHATSAPP_PORT || "3001", 10);
const DEBOUNCE_MS = parseInt(process.env.WHATSAPP_DEBOUNCE_MS || "2000", 10);

const logger = pino({ level: "info" });

/** Read the shared webhook token for backend authentication. */
function getWebhookToken() {
  try {
    return fs.readFileSync(WEBHOOK_TOKEN_PATH, "utf-8").trim();
  } catch {
    logger.warn("Webhook token not found at %s — backend will reject requests", WEBHOOK_TOKEN_PATH);
    return "";
  }
}

let sock = null;
let currentQR = null;
let isConnected = false;
let connectionPhone = null;
let meJid = null; // normalized phone JID e.g. "15167829287@s.whatsapp.net"
let meLid = null; // LID e.g. "174474993352786@lid"
const sentMessageIds = new Set(); // track messages we sent to avoid echo loops
const messageStore = new Map(); // store messages for retry/decrypt
const debounceTimers = new Map(); // sender → {timer, texts[], lastMsg}
const groupMetadataCache = new Map(); // groupJid → {metadata, cachedAt}

// Ensure auth directory exists
fs.mkdirSync(AUTH_DIR, { recursive: true });

// --- Helpers ---

function resolveJid(to) {
  // For LID addresses (self-chat), try meJid (phone number JID)
  if (to.endsWith("@lid") && meJid) {
    return meJid;
  }
  return to.includes("@") ? to : `${to}@s.whatsapp.net`;
}

function isGroupJid(jid) {
  return jid && jid.endsWith("@g.us");
}

async function getGroupMetadata(groupJid) {
  const cached = groupMetadataCache.get(groupJid);
  if (cached && Date.now() - cached.cachedAt < 5 * 60 * 1000) {
    return cached.metadata;
  }
  try {
    const metadata = await sock.groupMetadata(groupJid);
    groupMetadataCache.set(groupJid, { metadata, cachedAt: Date.now() });
    return metadata;
  } catch (err) {
    logger.warn({ err: err.message, groupJid }, "Failed to fetch group metadata");
    return null;
  }
}

function detectMediaType(msg) {
  if (!msg.message) return null;
  if (msg.message.imageMessage) return "image";
  if (msg.message.videoMessage) return "video";
  if (msg.message.audioMessage) return "audio";
  if (msg.message.documentMessage) return "document";
  if (msg.message.stickerMessage) return "sticker";
  if (msg.message.contactMessage || msg.message.contactsArrayMessage) return "contact";
  if (msg.message.locationMessage || msg.message.liveLocationMessage) return "location";
  return null;
}

function extractText(msg) {
  if (!msg.message) return "";
  return (
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    msg.message.documentMessage?.caption ||
    ""
  );
}

async function sendReaction(jid, messageId, emoji) {
  if (!sock || !isConnected) return;
  try {
    await sock.sendMessage(jid, {
      react: { text: emoji, key: { remoteJid: jid, id: messageId } },
    });
  } catch (err) {
    logger.warn({ err: err.message }, "Failed to send reaction");
  }
}

// --- Express control API ---

const app = express();
app.use(express.json());

app.get("/qr", async (req, res) => {
  if (isConnected) {
    return res.json({ connected: true, phone: connectionPhone });
  }
  if (!currentQR) {
    return res.json({ waiting: true, message: "Waiting for QR code..." });
  }
  try {
    const qrDataUrl = await QRCode.toDataURL(currentQR, { width: 256 });
    res.json({ qr: qrDataUrl });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate QR image" });
  }
});

app.get("/status", (req, res) => {
  res.json({
    connected: isConnected,
    phone: connectionPhone,
    hasQR: !!currentQR,
  });
});

app.post("/send", async (req, res) => {
  const { to, text } = req.body;
  if (!sock || !isConnected) {
    return res.status(503).json({ error: "Not connected to WhatsApp" });
  }
  if (!to || !text) {
    return res.status(400).json({ error: "Missing 'to' or 'text'" });
  }

  try {
    const jid = resolveJid(to);
    logger.info({ to, jid }, "Sending message");
    const sent = await sock.sendMessage(jid, { text });
    if (sent?.key?.id) {
      sentMessageIds.add(sent.key.id);
      if (sent.message) messageStore.set(sent.key.id, sent.message);
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to send message");
    res.status(500).json({ error: err.message });
  }
});

app.post("/react", async (req, res) => {
  const { jid, messageId, emoji } = req.body;
  if (!sock || !isConnected) {
    return res.status(503).json({ error: "Not connected to WhatsApp" });
  }
  if (!jid || !messageId) {
    return res.status(400).json({ error: "Missing 'jid' or 'messageId'" });
  }
  try {
    await sendReaction(jid, messageId, emoji || "");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to send reaction");
    res.status(500).json({ error: err.message });
  }
});

// --- Debounced message forwarding ---

async function forwardToBackend(sender, text, messageId, timestamp, fromSelf, extra = {}) {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/whatsapp/incoming`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Token": getWebhookToken(),
      },
      body: JSON.stringify({
        sender,
        text,
        message_id: messageId,
        timestamp: String(timestamp),
        from_self: fromSelf,
        ...extra,
      }),
    });

    if (!resp.ok) {
      logger.warn({ status: resp.status }, "Backend rejected message");
    }
  } catch (err) {
    logger.error({ err: err.message }, "Failed to forward message to backend");
  }
}

function debouncedForward(sender, text, messageId, timestamp, fromSelf, extra = {}) {
  const existing = debounceTimers.get(sender);
  if (existing) {
    clearTimeout(existing.timer);
    existing.texts.push(text);
    existing.lastMessageId = messageId;
    existing.lastTimestamp = timestamp;
  } else {
    debounceTimers.set(sender, {
      texts: [text],
      lastMessageId: messageId,
      lastTimestamp: timestamp,
      fromSelf,
      extra,
    });
  }

  const timer = setTimeout(() => {
    const entry = debounceTimers.get(sender);
    debounceTimers.delete(sender);
    if (!entry) return;
    const combined = entry.texts.join("\n");
    forwardToBackend(sender, combined, entry.lastMessageId, entry.lastTimestamp, entry.fromSelf, entry.extra);
  }, DEBOUNCE_MS);

  debounceTimers.get(sender).timer = timer;
}

// --- Baileys WhatsApp connection ---

async function startSocket() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
    },
    logger: pino({ level: "silent" }),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    getMessage: async (key) => {
      if (key.id && messageStore.has(key.id)) {
        return messageStore.get(key.id);
      }
      return undefined;
    },
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      logger.info("QR code ready — scan with WhatsApp > Linked Devices > Link a Device");
    }

    if (connection === "open") {
      isConnected = true;
      currentQR = null;
      connectionPhone = sock.user?.id?.split(":")[0] || null;
      meJid = jidNormalizedUser(sock.user?.id);
      meLid = sock.user?.lid || null;
      logger.info({ phone: connectionPhone, meJid, meLid }, "WhatsApp connected");
    }

    if (connection === "close") {
      isConnected = false;
      connectionPhone = null;
      meJid = null;
      meLid = null;

      const statusCode = lastDisconnect?.error?.output?.statusCode;

      if (statusCode === DisconnectReason.loggedOut) {
        logger.info("Logged out — clearing auth state for fresh QR on next connect");
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        fs.mkdirSync(AUTH_DIR, { recursive: true });
      } else if (statusCode === 515) {
        logger.info("Restart required (515) — reconnecting immediately");
        startSocket();
        return;
      } else if (statusCode === 440) {
        logger.info("Session replaced (440) — clearing auth for re-pair");
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        fs.mkdirSync(AUTH_DIR, { recursive: true });
      }

      logger.info({ statusCode }, "Reconnecting in 5 seconds...");
      setTimeout(startSocket, 5000);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (msg.key.id && msg.message) {
        messageStore.set(msg.key.id, msg.message);
      }

      if (msg.key.id && sentMessageIds.has(msg.key.id)) {
        sentMessageIds.delete(msg.key.id);
        continue;
      }
      if (!msg.message) continue;

      const sender = msg.key.remoteJid;
      const isGroup = isGroupJid(sender);
      const text = extractText(msg);
      const mediaType = detectMediaType(msg);

      if (mediaType && !text.trim()) {
        logger.info({ sender, mediaType }, "Received non-text message");
        try {
          const jid = resolveJid(sender);
          await sock.sendMessage(jid, {
            text: "I can only process text messages right now. Send me a text and I'll help!",
          });
        } catch (err) {
          logger.warn({ err: err.message }, "Failed to send media rejection");
        }
        continue;
      }

      if (!text.trim()) continue;

      let groupName = null;
      if (isGroup) {
        const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const isReplyToBot =
          msg.message.extendedTextMessage?.contextInfo?.participant === meJid ||
          msg.message.extendedTextMessage?.contextInfo?.participant === meLid;
        const isMentioned =
          mentionedJids.some((jid) => jid === meJid || jid === meLid) || isReplyToBot;

        if (!isMentioned) continue;

        const groupMeta = await getGroupMetadata(sender);
        groupName = groupMeta?.subject || null;
        logger.info({ sender, groupName, text: text.substring(0, 50) }, "Group mention received");
      } else {
        logger.info({ sender, text: text.substring(0, 50), fromMe: msg.key.fromMe }, "Incoming message");
      }

      await sendReaction(sender, msg.key.id, "\u{1F440}");

      const extra = {};
      if (isGroup) {
        extra.is_group = true;
        extra.group_name = groupName;
        extra.group_jid = sender;
        extra.sender_jid = msg.key.participant || sender;
      }

      debouncedForward(
        sender,
        text,
        msg.key.id || "",
        msg.messageTimestamp || "",
        !!msg.key.fromMe,
        extra
      );
    }
  });
}

// --- Start ---

app.listen(PORT, () => {
  logger.info({ port: PORT }, "WhatsApp sidecar listening");
  startSocket().catch((err) => {
    logger.error({ err }, "Failed to start WhatsApp socket");
  });
});
