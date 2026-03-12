"""Build and cache a compressed status context for Claude sessions.

After sync, this module gathers the user's current status — calendar, notes,
issues, emails, Slack, meetings, drafts — and compresses it via Gemini into
a concise briefing optimized for an LLM context window.  The result is stored
in ``cached_status_context`` and injected into every Claude session's system
prompt so Claude immediately knows what the user is working on.
"""

import json
import logging
from datetime import datetime

from fastapi import APIRouter

from app_config import get_prompt_context
from database import get_db_connection, get_write_db
from routers._ranking_cache import compute_items_hash

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/status-context", tags=["status-context"])


# ---------------------------------------------------------------------------
# Data gathering
# ---------------------------------------------------------------------------


def _build_raw_context(db) -> dict:
    """Gather current status data from all synced sources."""

    calendar_today = [
        dict(r)
        for r in db.execute(
            "SELECT summary, start_time, end_time, attendees_json "
            "FROM calendar_events WHERE date(start_time) = date('now')"
            " AND COALESCE(status, 'confirmed') != 'cancelled'"
            " AND COALESCE(self_response, '') != 'declined'"
            " ORDER BY start_time"
        ).fetchall()
    ]

    calendar_upcoming = [
        dict(r)
        for r in db.execute(
            "SELECT summary, start_time, end_time, attendees_json "
            "FROM calendar_events "
            "WHERE start_time > datetime('now') AND start_time <= datetime('now', '+2 days')"
            " AND COALESCE(status, 'confirmed') != 'cancelled'"
            " AND COALESCE(self_response, '') != 'declined'"
            " ORDER BY start_time LIMIT 10"
        ).fetchall()
    ]

    open_notes = [
        dict(r)
        for r in db.execute(
            "SELECT n.text, n.priority, n.is_one_on_one, n.due_date, "
            "       p.name AS person_name "
            "FROM notes n LEFT JOIN people p ON n.person_id = p.id "
            "WHERE n.status = 'open' ORDER BY n.priority DESC, n.created_at DESC LIMIT 20"
        ).fetchall()
    ]

    open_issues = [
        dict(r)
        for r in db.execute(
            "SELECT title, description, priority, tshirt_size, due_date "
            "FROM issues WHERE status != 'done' "
            "ORDER BY priority DESC, created_at DESC LIMIT 15"
        ).fetchall()
    ]

    # Recent email threads (last 2 days, grouped)
    raw_emails = [
        dict(r)
        for r in db.execute(
            "SELECT thread_id, subject, snippet, from_name, from_email, date, is_unread "
            "FROM emails "
            "WHERE date >= datetime('now', '-2 days') "
            "AND labels_json NOT LIKE '%CATEGORY_PROMOTIONS%' "
            "AND labels_json NOT LIKE '%CATEGORY_SOCIAL%' "
            "AND labels_json NOT LIKE '%CATEGORY_UPDATES%' "
            "AND labels_json NOT LIKE '%CATEGORY_FORUMS%' "
            "ORDER BY date DESC LIMIT 40"
        ).fetchall()
    ]
    thread_map: dict[str, list[dict]] = {}
    for r in raw_emails:
        tid = r.get("thread_id") or r["subject"]
        thread_map.setdefault(tid, []).append(r)
    emails_recent = []
    for msgs in thread_map.values():
        latest = msgs[0]
        emails_recent.append(
            {
                "subject": latest["subject"],
                "snippet": latest["snippet"],
                "from_name": latest["from_name"],
                "date": latest["date"],
                "is_unread": any(m["is_unread"] for m in msgs),
                "message_count": len(msgs),
            }
        )

    slack_recent = [
        dict(r)
        for r in db.execute(
            "SELECT user_name, text, channel_name, channel_type, is_mention "
            "FROM slack_messages "
            "WHERE ts >= strftime('%%s', datetime('now', '-2 days')) "
            "ORDER BY ts DESC LIMIT 30"
        ).fetchall()
    ]

    # Recent meetings with summaries (last 3 days)
    recent_meetings = [
        dict(r)
        for r in db.execute(
            "SELECT title, created_at, panel_summary_plain "
            "FROM granola_meetings "
            "WHERE created_at >= datetime('now', '-3 days') "
            "ORDER BY created_at DESC LIMIT 8"
        ).fetchall()
    ]

    # Longform drafts in progress
    longform_drafts = [
        dict(r)
        for r in db.execute(
            "SELECT title, word_count, updated_at "
            "FROM longform_posts WHERE status = 'draft' "
            "ORDER BY updated_at DESC LIMIT 5"
        ).fetchall()
    ]

    # Cached AI priorities (if available)
    cached_priorities = [
        dict(r)
        for r in db.execute(
            "SELECT title, reason, source, urgency FROM cached_priorities ORDER BY id LIMIT 10"
        ).fetchall()
    ]

    return {
        "calendar_today": calendar_today,
        "calendar_upcoming": calendar_upcoming,
        "open_notes": open_notes,
        "open_issues": open_issues,
        "emails_recent": emails_recent,
        "slack_recent": slack_recent,
        "recent_meetings": recent_meetings,
        "longform_drafts": longform_drafts,
        "cached_priorities": cached_priorities,
    }


# ---------------------------------------------------------------------------
# Compression
# ---------------------------------------------------------------------------


def _build_fallback_context(context: dict) -> str:
    """Build structured text summary when Gemini is unavailable."""
    lines = []
    now = datetime.now().strftime("%A, %B %d %Y, %I:%M %p")
    lines.append(f"Status as of {now}")

    if context["cached_priorities"]:
        lines.append("\n## Top Priorities")
        for p in context["cached_priorities"][:7]:
            urgency = f" [{p['urgency']}]" if p.get("urgency") else ""
            lines.append(f"- {p['title']}{urgency}: {p.get('reason', '')}")

    if context["calendar_today"]:
        lines.append("\n## Today's Calendar")
        for e in context["calendar_today"]:
            attendees = ""
            if e.get("attendees_json"):
                try:
                    raw = e["attendees_json"]
                    att = json.loads(raw) if isinstance(raw, str) else raw
                    names = [a.get("displayName") or a.get("email", "") for a in att[:5]]
                    attendees = f" (with {', '.join(names)})"
                except (json.JSONDecodeError, TypeError):
                    pass
            lines.append(f"- {e['start_time'][:16]} {e['summary']}{attendees}")

    if context["open_notes"]:
        lines.append("\n## Open Action Items")
        for n in context["open_notes"][:10]:
            person = f" (@{n['person_name']})" if n.get("person_name") else ""
            due = f" [due {n['due_date']}]" if n.get("due_date") else ""
            lines.append(f"- {n['text']}{person}{due}")

    if context["open_issues"]:
        lines.append("\n## Active Issues")
        for i in context["open_issues"][:8]:
            size = f" [{i['tshirt_size']}]" if i.get("tshirt_size") else ""
            lines.append(f"- [P{i.get('priority', '?')}] {i['title']}{size}")

    if context["emails_recent"]:
        lines.append("\n## Recent Email Threads")
        for e in context["emails_recent"][:8]:
            unread = " (UNREAD)" if e.get("is_unread") else ""
            lines.append(f"- {e['from_name']}: {e['subject']}{unread}")

    if context["slack_recent"]:
        mentions = [s for s in context["slack_recent"] if s.get("is_mention")]
        if mentions:
            lines.append("\n## Slack Mentions")
            for s in mentions[:5]:
                lines.append(f"- @{s['user_name']} in #{s['channel_name']}: {s['text'][:100]}")

    if context["recent_meetings"]:
        lines.append("\n## Recent Meetings")
        for m in context["recent_meetings"][:5]:
            summary = (m.get("panel_summary_plain") or "")[:150]
            lines.append(f"- {m['title']}: {summary}")

    if context["longform_drafts"]:
        lines.append("\n## Drafts in Progress")
        for d in context["longform_drafts"]:
            lines.append(f"- {d['title']} ({d.get('word_count', 0)} words)")

    return "\n".join(lines)


def _compress_with_gemini(context: dict) -> str:
    """Use AI to compress raw context into a concise LLM-optimized briefing."""
    from ai_client import generate

    ctx = get_prompt_context()
    now = datetime.now().strftime("%A, %B %d %Y, %I:%M %p")

    system_prompt = f"""\
You are building a status context document {ctx}. This document will be \
injected into the system prompt of an AI assistant (Claude) so it immediately \
knows the user's current situation without needing to query any APIs.

Produce a concise, information-dense briefing (600-800 words max) organized as:

1. **Right Now** — What's happening today: meetings, deadlines, urgent items.
2. **Active Work** — Open issues, action items, drafts in progress. Include names and specifics.
3. **Key Threads** — Important email/Slack conversations that are active or need follow-up.
4. **Where You Can Help** — 3-5 specific, actionable suggestions for how an AI assistant \
could help right now (e.g. "draft a response to X", "prep talking points for 1:1 with Y", \
"summarize the Z thread").

Guidelines:
- Be specific: use names, meeting titles, email subjects, issue titles.
- Be dense: no filler, no preamble, no "here's your briefing".
- Use markdown headers and bullet points for scannability.
- Omit empty sections if there's no relevant data.
- This is for an LLM's context window — optimize for information per token."""

    user_message = f"Current time: {now}\n\nRaw data:\n{json.dumps(context, default=str)}"

    text = generate(system_prompt=system_prompt, user_message=user_message, temperature=0.2)
    return text.strip() if text else ""


# ---------------------------------------------------------------------------
# Main entry point (called from sync)
# ---------------------------------------------------------------------------


def build_status_context():
    """Gather current status, compress via Gemini, and cache the result.

    Called as the final step of a full sync.
    """
    with get_db_connection(readonly=True) as db:
        context = _build_raw_context(db)

    # Check if data has changed since last generation
    ctx_hash = compute_items_hash([context])
    with get_db_connection(readonly=True) as db:
        row = db.execute("SELECT data_hash FROM cached_status_context WHERE id = 1").fetchone()
        if row and row["data_hash"] == ctx_hash:
            logger.info("Status context cache hit (hash match) — skipping regeneration")
            return

    logger.info("Status context cache miss — generating new context")

    # Try Gemini compression first, fall back to structured text
    compressed = _compress_with_gemini(context)
    if not compressed:
        compressed = _build_fallback_context(context)

    if not compressed:
        logger.info("Status context: no data to summarize")
        return

    with get_write_db() as db:
        db.execute(
            "INSERT INTO cached_status_context (id, context_text, data_hash, generated_at) "
            "VALUES (1, ?, ?, datetime('now')) "
            "ON CONFLICT(id) DO UPDATE SET context_text = excluded.context_text, "
            "data_hash = excluded.data_hash, generated_at = excluded.generated_at",
            (compressed, ctx_hash),
        )
        db.commit()

    logger.info("Status context updated (%d chars)", len(compressed))


# ---------------------------------------------------------------------------
# API endpoint (for debugging / inspection)
# ---------------------------------------------------------------------------


@router.get("")
def get_status_context():
    """Return the current cached status context."""
    with get_db_connection(readonly=True) as db:
        row = db.execute(
            "SELECT context_text, data_hash, generated_at FROM cached_status_context WHERE id = 1"
        ).fetchone()
    if not row or not row["context_text"]:
        return {"context_text": None, "generated_at": None}
    return dict(row)
