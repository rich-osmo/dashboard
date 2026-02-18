import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SerializeAddon } from '@xterm/addon-serialize';
import '@xterm/xterm/css/xterm.css';
import { TimeAgo } from '../components/shared/TimeAgo';
import { MarkdownRenderer } from '../components/shared/MarkdownRenderer';
import {
  useClaudeSessions,
  useClaudeSessionContent,
  useSaveClaudeSession,
  useDeleteClaudeSession,
} from '../api/hooks';

const TERM_THEME = {
  background: '#1a1b26',
  foreground: '#c0caf5',
  cursor: '#c0caf5',
  selectionBackground: '#33467c',
  black: '#15161e',
  red: '#f7768e',
  green: '#9ece6a',
  yellow: '#e0af68',
  blue: '#7aa2f7',
  magenta: '#bb9af7',
  cyan: '#7dcfff',
  white: '#a9b1d6',
  brightBlack: '#414868',
  brightRed: '#f7768e',
  brightGreen: '#9ece6a',
  brightYellow: '#e0af68',
  brightBlue: '#7aa2f7',
  brightMagenta: '#bb9af7',
  brightCyan: '#7dcfff',
  brightWhite: '#c0caf5',
};

const TERM_FONT = "'SF Mono', 'Fira Code', 'Cascadia Code', monospace";

function getPlainText(term: Terminal): string {
  const lines: string[] = [];
  const buffer = term.buffer.active;
  for (let i = 0; i < buffer.length; i++) {
    const line = buffer.getLine(i);
    if (line) lines.push(line.translateToString(true));
  }
  return lines.join('\n').trimEnd();
}

function generateTitle(plainText: string): string {
  const lines = plainText.split('\n').filter((l) => l.trim());
  for (const line of lines) {
    const trimmed = line.trim();
    // Claude Code shows ❯ or > for user input
    if ((trimmed.startsWith('> ') || trimmed.startsWith('\u276F ')) && trimmed.length > 3) {
      return trimmed.slice(2).slice(0, 60);
    }
  }
  return `Session ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function ClaudePage({ visible, overlayOpen }: { visible: boolean; overlayOpen?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const serializeRef = useRef<SerializeAddon | null>(null);

  const [connected, setConnected] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [viewingSessionId, setViewingSessionId] = useState<number | null>(null);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionKey, setSessionKey] = useState(0);

  const { data: sessions } = useClaudeSessions();
  const { data: sessionContent } = useClaudeSessionContent(viewingSessionId);
  const saveSession = useSaveClaudeSession();
  const deleteSession = useDeleteClaudeSession();

  function connect() {
    if (!containerRef.current) return;

    // Clean up previous
    if (termRef.current) {
      termRef.current.dispose();
    }
    if (wsRef.current) {
      wsRef.current.close();
    }

    setDisconnected(false);
    setConnected(false);

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: TERM_FONT,
      theme: TERM_THEME,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const serializeAddon = new SerializeAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(serializeAddon);

    // Only let Cmd+K pass through to the app for search
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') return false;
      return true;
    });

    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitRef.current = fitAddon;
    serializeRef.current = serializeAddon;

    // WebSocket
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/api/ws/claude`);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({
        type: 'resize',
        rows: term.rows,
        cols: term.cols,
      }));
    };

    ws.onmessage = (evt) => {
      if (evt.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(evt.data));
      } else {
        term.write(evt.data);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setDisconnected(true);
      term.write('\r\n\x1b[90m--- session ended ---\x1b[0m\r\n');
    };

    ws.onerror = () => {
      setConnected(false);
      setDisconnected(true);
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(new TextEncoder().encode(data));
      }
    });

    term.onBinary((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        const buf = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) buf[i] = data.charCodeAt(i);
        ws.send(buf);
      }
    });

    term.onResize(({ rows, cols }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', rows, cols }));
      }
    });

    const onResize = () => fitAddon.fit();
    window.addEventListener('resize', onResize);

    term.focus();

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }

  useEffect(() => {
    let resizeCleanup: (() => void) | undefined;

    // Delay reconnect on key change to let backend kill the old PTY first
    const timer = setTimeout(() => {
      resizeCleanup = connect() ?? undefined;
    }, sessionKey === 0 ? 0 : 600);

    return () => {
      clearTimeout(timer);
      resizeCleanup?.();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      if (termRef.current) {
        termRef.current.dispose();
        termRef.current = null;
      }
      serializeRef.current = null;
      fitRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [sessionKey]);  

  // Re-fit when container resizes (e.g. panel toggle)
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      fitRef.current?.fit();
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Re-fit and focus when tab becomes visible or overlay closes
  useEffect(() => {
    if (visible && !overlayOpen) {
      const t = setTimeout(() => {
        fitRef.current?.fit();
        if (!viewingSessionId) {
          termRef.current?.focus();
        }
      }, 50);
      return () => clearTimeout(t);
    }
  }, [visible, overlayOpen, viewingSessionId]);

  function toBase64(str: string): string {
    // btoa() only handles Latin1; encode via TextEncoder for full unicode safety
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function handleSave() {
    const term = termRef.current;
    const serialize = serializeRef.current;
    if (!term || !serialize) {
      console.warn('Cannot save: terminal or serialize addon not available');
      return;
    }

    try {
      const raw = serialize.serialize();
      const content = toBase64(raw);
      const plainText = getPlainText(term);
      const title = sessionTitle || generateTitle(plainText);

      saveSession.mutate({
        title,
        content,
        plain_text: plainText,
        rows: term.rows,
        cols: term.cols,
      }, {
        onSuccess: () => {
          setSessionTitle('');
        },
      });
    } catch (err) {
      console.error('Failed to save session:', err);
    }
  }

  function handleNewChat() {
    setViewingSessionId(null);
    setSessionTitle('');
    // Bump key — React runs the useEffect cleanup (closes WS, disposes terminal)
    // then re-runs it (calls connect() fresh), same as initial mount
    setSessionKey((k) => k + 1);
  }

  function handleViewSession(id: number) {
    setViewingSessionId(id);
  }

  function handleBackToTerminal() {
    setViewingSessionId(null);
    setTimeout(() => {
      fitRef.current?.fit();
      termRef.current?.focus();
    }, 50);
  }

  function handleDeleteSession(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    deleteSession.mutate(id);
    if (viewingSessionId === id) {
      handleBackToTerminal();
    }
  }

  return (
    <div className="claude-page">
      <div className="claude-header">
        <div className="claude-header-left">
          <button
            className="claude-panel-toggle"
            onClick={() => setPanelOpen(!panelOpen)}
            title="Toggle session history"
          >
            {panelOpen ? '\u2039' : '\u203A'}
          </button>
          {viewingSessionId ? (
            <span className="claude-viewing-label">
              {sessions?.find((s) => s.id === viewingSessionId)?.title || 'Saved session'}
            </span>
          ) : (
            <input
              className="claude-session-title-input"
              placeholder="Session title..."
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.currentTarget.blur();
                  termRef.current?.focus();
                }
              }}
            />
          )}
        </div>
        <div className="claude-status">
          {viewingSessionId ? (
            <button className="auth-action-btn" onClick={handleBackToTerminal}>
              Back to Terminal
            </button>
          ) : (
            <>
              {connected && <span className="status-ok">connected</span>}
              <button
                className="auth-action-btn"
                onClick={handleSave}
                disabled={saveSession.isPending}
              >
                {saveSession.isPending ? 'Saving...' : 'Save'}
              </button>
              <button className="auth-action-btn" onClick={handleNewChat}>
                + New
              </button>
              {disconnected && (
                <button className="auth-action-btn" onClick={connect}>
                  Reconnect
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="claude-body">
        {panelOpen && (
          <div className="claude-sessions-panel">
            <h3>History</h3>
            <div className="claude-sessions-list">
              {sessions?.map((s) => (
                <div
                  key={s.id}
                  className={`claude-session-item${viewingSessionId === s.id ? ' active' : ''}`}
                  onClick={() => handleViewSession(s.id)}
                >
                  <div className="claude-session-item-title">{s.title}</div>
                  <div className="claude-session-item-meta">
                    <TimeAgo date={s.created_at} />
                  </div>
                  {s.preview && (
                    <div className="claude-session-item-preview">{s.preview}</div>
                  )}
                  <button
                    className="claude-session-delete"
                    onClick={(e) => handleDeleteSession(s.id, e)}
                    title="Delete session"
                  >
                    &times;
                  </button>
                </div>
              ))}
              {(!sessions || sessions.length === 0) && (
                <div className="claude-sessions-empty">No saved sessions</div>
              )}
            </div>
          </div>
        )}

        <div className="claude-main-area">
          {/* Live terminal — always mounted, hidden when viewing a session */}
          <div
            className="claude-terminal"
            ref={containerRef}
            style={{ display: viewingSessionId ? 'none' : undefined }}
          />

          {/* Session viewer — shown when viewing a saved session */}
          {viewingSessionId && sessionContent && (
            <div className="claude-session-viewer">
              <MarkdownRenderer content={sessionContent.summary || sessionContent.plain_text || 'No content available.'} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
