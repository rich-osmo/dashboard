"""Slack Web API connector for DMs and mentions."""
import os
import ssl
import json
import certifi
from database import get_db
from config import SLACK_MESSAGE_LIMIT

try:
    from slack_sdk import WebClient
    from slack_sdk.errors import SlackApiError
    HAS_SLACK = True
except ImportError:
    HAS_SLACK = False


def _get_client() -> "WebClient":
    token = os.environ.get("SLACK_TOKEN", "")
    if not token:
        from pathlib import Path
        env_path = Path(__file__).parent.parent / ".env"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("SLACK_TOKEN="):
                    token = line.split("=", 1)[1].strip().strip('"')
                    break
    if not token:
        raise ValueError("SLACK_TOKEN not set. Add it to app/backend/.env")
    ssl_context = ssl.create_default_context(cafile=certifi.where())
    return WebClient(token=token, ssl=ssl_context)


def _get_user_info(client: "WebClient") -> dict:
    """Get the authenticated user's info."""
    resp = client.auth_test()
    return {"user_id": resp["user_id"], "user": resp["user"]}


def sync_slack_data() -> int:
    if not HAS_SLACK:
        raise ImportError("slack_sdk not installed")

    client = _get_client()
    user = _get_user_info(client)
    my_user_id = user["user_id"]

    db = get_db()
    db.execute("DELETE FROM slack_messages")
    count = 0

    # 1. Fetch DMs
    try:
        dm_channels = client.conversations_list(types="im", limit=50)
        for ch in dm_channels.get("channels", []):
            try:
                history = client.conversations_history(channel=ch["id"], limit=10)
                user_name = ch.get("user", "unknown")
                # Try to get real name
                try:
                    user_info = client.users_info(user=ch.get("user", ""))
                    user_name = user_info.get("user", {}).get("real_name", user_name)
                except Exception:
                    pass

                for msg in history.get("messages", []):
                    # Build permalink for DMs
                    permalink = None
                    try:
                        link_resp = client.chat_getPermalink(
                            channel=ch["id"], message_ts=msg["ts"]
                        )
                        permalink = link_resp.get("permalink")
                    except Exception:
                        pass

                    db.execute(
                        """INSERT OR REPLACE INTO slack_messages
                           (id, channel_id, channel_name, channel_type, user_id, user_name,
                            text, ts, thread_ts, permalink, is_mention)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            f"{ch['id']}_{msg['ts']}",
                            ch["id"],
                            user_name,
                            "dm",
                            msg.get("user", ""),
                            user_name,
                            msg.get("text", ""),
                            msg["ts"],
                            msg.get("thread_ts"),
                            permalink,
                            0,
                        ),
                    )
                    count += 1
            except Exception:
                continue
    except Exception:
        pass

    # 2. Fetch mentions
    try:
        search_result = client.search_messages(query=f"<@{my_user_id}>", count=SLACK_MESSAGE_LIMIT)
        for match in search_result.get("messages", {}).get("matches", []):
            channel = match.get("channel", {})
            db.execute(
                """INSERT OR REPLACE INTO slack_messages
                   (id, channel_id, channel_name, channel_type, user_id, user_name,
                    text, ts, thread_ts, permalink, is_mention)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    f"{channel.get('id', '')}_{match.get('ts', '')}",
                    channel.get("id", ""),
                    channel.get("name", ""),
                    "channel",
                    match.get("user", ""),
                    match.get("username", ""),
                    match.get("text", ""),
                    match.get("ts", ""),
                    match.get("thread_ts"),
                    match.get("permalink"),
                    1,
                ),
            )
            count += 1
    except Exception:
        pass

    db.commit()
    db.close()
    return count
