"""Google Gmail API connector."""
import base64
import json
from googleapiclient.discovery import build
from connectors.google_auth import get_google_credentials
from database import get_db
from config import GMAIL_MAX_RESULTS


def sync_gmail_messages() -> int:
    creds = get_google_credentials()
    service = build("gmail", "v1", credentials=creds)

    # Get recent inbox messages
    results = (
        service.users()
        .messages()
        .list(userId="me", maxResults=GMAIL_MAX_RESULTS, labelIds=["INBOX"])
        .execute()
    )

    messages = results.get("messages", [])
    if not messages:
        return 0

    db = get_db()
    db.execute("DELETE FROM emails")

    count = 0
    for msg_ref in messages:
        msg = (
            service.users()
            .messages()
            .get(userId="me", id=msg_ref["id"], format="metadata",
                 metadataHeaders=["From", "To", "Subject", "Date"])
            .execute()
        )

        headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}

        from_header = headers.get("From", "")
        from_name, from_email = _parse_email_header(from_header)

        labels = msg.get("labelIds", [])
        is_unread = "UNREAD" in labels

        db.execute(
            """INSERT OR REPLACE INTO emails
               (id, thread_id, subject, snippet, from_name, from_email, to_emails, date,
                labels_json, is_unread, body_preview)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                msg["id"],
                msg.get("threadId", ""),
                headers.get("Subject", "(No subject)"),
                msg.get("snippet", ""),
                from_name,
                from_email,
                headers.get("To", ""),
                headers.get("Date", ""),
                json.dumps(labels),
                int(is_unread),
                msg.get("snippet", "")[:500],
            ),
        )
        count += 1

    db.commit()
    db.close()
    return count


def _parse_email_header(header: str) -> tuple[str, str]:
    """Parse 'Name <email>' format into (name, email)."""
    if "<" in header and ">" in header:
        name = header.split("<")[0].strip().strip('"')
        email = header.split("<")[1].split(">")[0].strip()
        return name, email
    return "", header.strip()
