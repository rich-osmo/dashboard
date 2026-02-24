"""Morning Briefing API — single endpoint aggregating all briefing data."""

from collections import OrderedDict

from fastapi import APIRouter

from app_config import get_profile
from database import get_db_connection
from routers.priorities import get_cached_summary
from routers.weather import get_weather

router = APIRouter(prefix="/api/briefing", tags=["briefing"])


def _group_by_thread(emails: list[dict]) -> list[dict]:
    """Group emails by thread_id, returning one item per thread (latest first)."""
    threads: OrderedDict[str, dict] = OrderedDict()
    for email in emails:
        tid = email.get("thread_id") or email["id"]
        if tid not in threads:
            threads[tid] = {
                "id": tid,
                "thread_id": tid,
                "subject": email["subject"],
                "snippet": email["snippet"],
                "from_name": email.get("from_name", ""),
                "from_email": email.get("from_email", ""),
                "date": email["date"],
                "is_unread": bool(email.get("is_unread")),
                "message_count": 1,
            }
        else:
            threads[tid]["message_count"] += 1
            if email.get("is_unread"):
                threads[tid]["is_unread"] = True
    return list(threads.values())


@router.get("")
def get_briefing():
    """Return the morning briefing — all data in one response."""
    profile = get_profile()

    with get_db_connection(readonly=True) as db:
        # --- AI summary ---
        summary = get_cached_summary(db)

        # --- Calendar today ---
        calendar_today = [
            dict(r)
            for r in db.execute(
                "SELECT * FROM calendar_events WHERE date(start_time) = date('now') ORDER BY start_time"
            ).fetchall()
        ]

        # --- Calendar summary ---
        tomorrow_count = db.execute(
            "SELECT COUNT(*) as c FROM calendar_events WHERE date(start_time) = date('now', '+1 day')"
        ).fetchone()["c"]

        week_count = db.execute(
            "SELECT COUNT(*) as c FROM calendar_events "
            "WHERE start_time > datetime('now') "
            "AND start_time <= datetime('now', '+7 days')"
        ).fetchone()["c"]

        # --- Attention items (cached AI priorities) ---
        dismissed_titles = {r["title"] for r in db.execute("SELECT title FROM dismissed_priorities").fetchall()}
        cached_priorities = [
            dict(r)
            for r in db.execute("SELECT title, reason, source, urgency FROM cached_priorities ORDER BY id").fetchall()
        ]
        attention_items = [p for p in cached_priorities if p.get("title") not in dismissed_titles]

        # --- Pulse counts ---
        unread_emails = db.execute("SELECT COUNT(*) as c FROM emails WHERE is_unread = 1").fetchone()["c"]

        slack_dms = db.execute(
            "SELECT COUNT(*) as c FROM slack_messages "
            "WHERE channel_type = 'dm' "
            "AND datetime(ts, 'unixepoch') >= datetime('now', '-7 days')"
        ).fetchone()["c"]

        pr_reviews = db.execute(
            "SELECT COUNT(*) as c FROM github_pull_requests WHERE review_requested = 1 AND state = 'open'"
        ).fetchone()["c"]

        open_notes = db.execute("SELECT COUNT(*) as c FROM notes WHERE status = 'open'").fetchone()["c"]

        overdue_bills = db.execute(
            "SELECT COUNT(*) as c FROM ramp_bills "
            "WHERE due_at < datetime('now') "
            "AND payment_status NOT IN ('PAID', 'PAYMENT_COMPLETED') "
            "AND payment_status != ''"
        ).fetchone()["c"]

        # --- Overnight digest (last 12 hours) ---
        dismissed_email = {
            r["item_id"]
            for r in db.execute("SELECT item_id FROM dismissed_dashboard_items WHERE source = 'email'").fetchall()
        }
        dismissed_slack = {
            r["item_id"]
            for r in db.execute("SELECT item_id FROM dismissed_dashboard_items WHERE source = 'slack'").fetchall()
        }
        dismissed_notion = {
            r["item_id"]
            for r in db.execute("SELECT item_id FROM dismissed_dashboard_items WHERE source = 'notion'").fetchall()
        }

        raw_overnight_emails = [
            dict(r)
            for r in db.execute(
                "SELECT * FROM emails "
                "WHERE labels_json NOT LIKE '%CATEGORY_PROMOTIONS%' "
                "AND labels_json NOT LIKE '%CATEGORY_SOCIAL%' "
                "AND labels_json NOT LIKE '%CATEGORY_UPDATES%' "
                "AND labels_json NOT LIKE '%CATEGORY_FORUMS%' "
                "AND date >= datetime('now', '-12 hours') "
                "ORDER BY date DESC LIMIT 30"
            ).fetchall()
        ]
        overnight_emails = [
            {
                "id": t["id"],
                "source": "email",
                "title": t["subject"],
                "subtitle": t["from_name"] or t["from_email"],
                "time": t["date"],
                "is_unread": t["is_unread"],
            }
            for t in _group_by_thread(raw_overnight_emails)
            if t["id"] not in dismissed_email
        ][:5]

        raw_slack = [
            dict(r)
            for r in db.execute(
                "SELECT * FROM slack_messages "
                "WHERE datetime(ts, 'unixepoch') >= datetime('now', '-12 hours') "
                "ORDER BY ts DESC LIMIT 20"
            ).fetchall()
        ]
        overnight_slack = [
            {
                "id": r["id"],
                "source": "slack",
                "title": r["text"][:120],
                "subtitle": f"{r['user_name']} in #{r['channel_name']}"
                if r.get("channel_type") != "dm"
                else r["user_name"],
                "time": r["ts"],
                "is_mention": bool(r.get("is_mention")),
                "permalink": r.get("permalink"),
            }
            for r in raw_slack
            if r["id"] not in dismissed_slack
        ][:5]

        raw_notion = [
            dict(r)
            for r in db.execute(
                "SELECT * FROM notion_pages "
                "WHERE last_edited_time >= datetime('now', '-12 hours') "
                "ORDER BY last_edited_time DESC LIMIT 5"
            ).fetchall()
        ]
        overnight_notion = [
            {
                "id": r["id"],
                "source": "notion",
                "title": r["title"],
                "subtitle": r.get("last_edited_by") or "",
                "time": r["last_edited_time"],
                "url": r.get("url"),
            }
            for r in raw_notion
            if r["id"] not in dismissed_notion
        ][:3]

        raw_drive = [
            dict(r)
            for r in db.execute(
                "SELECT * FROM drive_files "
                "WHERE modified_time >= datetime('now', '-12 hours') "
                "AND trashed = 0 "
                "ORDER BY modified_time DESC LIMIT 5"
            ).fetchall()
        ]
        overnight_drive = [
            {
                "id": r["id"],
                "source": "drive",
                "title": r["name"],
                "subtitle": r.get("modified_by_name") or r.get("owner_name") or "",
                "time": r["modified_time"],
                "url": r.get("web_view_link"),
            }
            for r in raw_drive
        ][:3]

    # Merge and sort overnight items by time (most recent first)
    overnight = overnight_emails + overnight_slack + overnight_notion + overnight_drive
    overnight.sort(key=lambda x: x.get("time", ""), reverse=True)
    overnight = overnight[:8]

    # Weather (cached internally)
    weather = get_weather()

    return {
        "greeting": {
            "user_name": profile.get("user_name", ""),
        },
        "summary": summary,
        "weather": weather,
        "calendar_today": calendar_today,
        "calendar_summary": {
            "tomorrow_count": tomorrow_count,
            "week_count": week_count,
        },
        "attention_items": attention_items,
        "pulse": {
            "unread_emails": unread_emails,
            "slack_dms": slack_dms,
            "pr_reviews": pr_reviews,
            "open_notes": open_notes,
            "overdue_bills": overdue_bills,
        },
        "overnight": overnight,
    }
