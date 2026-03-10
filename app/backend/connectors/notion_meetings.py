"""Sync meeting notes from Notion into meeting_notes_external table.

Two-tier detection:
1. If a specific database ID is configured, query that database directly.
2. Auto-detect meeting-related pages from already-synced notion_pages by title keywords.
"""

import json
import logging
import re

from database import batch_upsert, get_db_connection, get_write_db

try:
    import httpx

    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False

logger = logging.getLogger(__name__)

NOTION_API_BASE = "https://api.notion.com/v1"

# Keywords that suggest a Notion page is meeting notes
_MEETING_KEYWORDS = re.compile(
    r"\b(meeting|1[:\-]1|one[- ]on[- ]one|standup|stand-up|sync|retro|review|kickoff|"
    r"check[- ]?in|debrief|planning|sprint|all[- ]?hands|offsite|huddle|recap)\b",
    re.IGNORECASE,
)


def _get_token() -> str:
    from app_config import get_secret

    token = get_secret("NOTION_TOKEN") or ""
    if not token:
        raise ValueError("NOTION_TOKEN not configured")
    return token


def _get_headers() -> dict:
    return {
        "Authorization": f"Bearer {_get_token()}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    }


def _extract_title(page: dict) -> str:
    """Extract page title from Notion page properties."""
    props = page.get("properties", {})
    for prop in props.values():
        if prop.get("type") == "title":
            title_parts = prop.get("title", [])
            return "".join(t.get("plain_text", "") for t in title_parts)
    return "Untitled"


def _extract_date(page: dict) -> str:
    """Extract a date from Notion page properties (first date-type property)."""
    props = page.get("properties", {})
    for prop in props.values():
        if prop.get("type") == "date" and prop.get("date"):
            return prop["date"].get("start", "") or ""
    # Fall back to created_time
    return page.get("created_time", "")


def _fetch_page_text(client: "httpx.Client", headers: dict, page_id: str) -> str:
    """Fetch first blocks of a Notion page and return plain text."""
    try:
        from utils.notion_blocks import blocks_to_text

        resp = client.get(
            f"{NOTION_API_BASE}/blocks/{page_id}/children?page_size=30",
            headers=headers,
            timeout=10,
        )
        resp.raise_for_status()
        blocks = resp.json().get("results", [])
        return blocks_to_text(blocks)
    except Exception as e:
        logger.debug("Failed to fetch Notion page %s: %s", page_id, e)
        return ""


def _match_to_calendar(title: str, date: str, db) -> str | None:
    """Try to match a Notion page to a calendar event by date + title overlap."""
    if not date:
        return None
    date_prefix = date[:10]  # YYYY-MM-DD
    if len(date_prefix) < 10:
        return None

    events = db.execute(
        "SELECT id, summary FROM calendar_events WHERE date(start_time) = ?",
        (date_prefix,),
    ).fetchall()

    if not events:
        return None

    # Score by word overlap between title and event summary
    title_words = set(title.lower().split())
    best_id = None
    best_score = 0
    for ev in events:
        summary_words = set((ev["summary"] or "").lower().split())
        overlap = len(title_words & summary_words)
        if overlap > best_score and overlap >= 2:
            best_score = overlap
            best_id = ev["id"]

    return best_id


def _sync_from_database(client: "httpx.Client", headers: dict, database_id: str) -> list[dict]:
    """Query a specific Notion database and return meeting note dicts."""
    pages = []
    payload: dict = {"page_size": 100, "sorts": [{"timestamp": "last_edited_time", "direction": "descending"}]}
    has_more = True

    while has_more:
        resp = client.post(
            f"{NOTION_API_BASE}/databases/{database_id}/query",
            headers=headers,
            json=payload,
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        pages.extend(data.get("results", []))
        has_more = data.get("has_more", False)
        if has_more:
            payload["start_cursor"] = data["next_cursor"]
        if len(pages) >= 500:
            break

    results = []
    for page in pages:
        title = _extract_title(page)
        date = _extract_date(page)
        results.append(
            {
                "id": page["id"],
                "title": title,
                "date": date,
                "url": page.get("url", ""),
                "created_time": page.get("created_time", ""),
                "last_edited_time": page.get("last_edited_time", ""),
            }
        )

    return results


def _sync_from_auto_detect(db) -> list[dict]:
    """Find meeting-related pages from already-synced notion_pages."""
    rows = db.execute(
        "SELECT id, title, url, last_edited_time FROM notion_pages ORDER BY last_edited_time DESC"
    ).fetchall()

    results = []
    for row in rows:
        title = row["title"] or ""
        if _MEETING_KEYWORDS.search(title):
            results.append(
                {
                    "id": row["id"],
                    "title": title,
                    "date": (row["last_edited_time"] or "")[:10],
                    "url": row["url"] or "",
                    "created_time": "",
                    "last_edited_time": row["last_edited_time"] or "",
                }
            )

    return results


def sync_notion_meeting_notes() -> int:
    """Sync meeting notes from Notion into meeting_notes_external."""
    if not HAS_HTTPX:
        raise ImportError("httpx required for Notion sync")

    from app_config import get_profile

    profile = get_profile()
    database_id = profile.get("notion_meeting_notes_database_id", "")

    headers = _get_headers()
    all_notes: list[dict] = []

    with httpx.Client() as client:
        # Tier 1: Query specific database if configured
        if database_id:
            try:
                db_notes = _sync_from_database(client, headers, database_id)
                all_notes.extend(db_notes)
                logger.info("Notion meetings: %d pages from configured database", len(db_notes))
            except Exception:
                logger.exception("Failed to query Notion database %s", database_id)

        # Tier 2: Auto-detect from synced notion_pages
        with get_db_connection(readonly=True) as db:
            auto_notes = _sync_from_auto_detect(db)

        # Deduplicate: database results take priority
        seen_ids = {n["id"] for n in all_notes}
        for note in auto_notes:
            if note["id"] not in seen_ids:
                all_notes.append(note)
                seen_ids.add(note["id"])

        logger.info("Notion meetings: %d total notes (%d auto-detected)", len(all_notes), len(auto_notes))

        if not all_notes:
            return 0

        # Check which notes are new
        with get_db_connection(readonly=True) as db:
            existing = {
                r[0] for r in db.execute("SELECT id FROM meeting_notes_external WHERE provider = 'notion'").fetchall()
            }

        new_notes = [n for n in all_notes if n["id"] not in existing]
        if not new_notes:
            return 0

        # Fetch content for new notes (max 20 to respect rate limits)
        for note in new_notes[:20]:
            note["content"] = _fetch_page_text(client, headers, note["id"])

    # Build rows and match to calendar events
    rows = []
    with get_db_connection(readonly=True) as db:
        for note in new_notes:
            calendar_event_id = _match_to_calendar(note["title"], note["date"], db)
            content = note.get("content", "")

            rows.append(
                (
                    note["id"],
                    "notion",
                    note["title"],
                    note.get("created_time") or note["date"],
                    note.get("last_edited_time", ""),
                    calendar_event_id or "",
                    "[]",  # attendees_json
                    "",  # summary_html (Notion content is plain text)
                    content[:2000] if content else "",
                    "",  # transcript_text
                    note["url"],
                    None,  # person_id — will be linked by person_linker
                    1,  # valid_meeting
                    json.dumps({"source": "database" if database_id else "auto_detect"}),
                )
            )

    if not rows:
        return 0

    with get_write_db() as db:
        batch_upsert(
            db,
            """INSERT OR REPLACE INTO meeting_notes_external
               (id, provider, title, created_at, updated_at, calendar_event_id,
                attendees_json, summary_html, summary_plain, transcript_text,
                external_link, person_id, valid_meeting, raw_metadata)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            rows,
        )

    return len(rows)
