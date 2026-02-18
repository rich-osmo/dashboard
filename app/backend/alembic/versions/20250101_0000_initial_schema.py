"""Initial schema

Revision ID: 20250101_0000
Revises:
Create Date: 2025-01-01 00:00:00

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20250101_0000"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create core tables
    op.execute("""
    CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        title TEXT,
        reports_to TEXT,
        depth INTEGER DEFAULT 0,
        dir_path TEXT DEFAULT '',
        has_meetings_dir INTEGER DEFAULT 0,
        FOREIGN KEY (reports_to) REFERENCES employees(id)
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        status TEXT DEFAULT 'open',
        employee_id TEXT,
        is_one_on_one INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        completed_at TEXT,
        due_date TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS calendar_events (
        id TEXT PRIMARY KEY,
        summary TEXT,
        description TEXT,
        location TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        all_day INTEGER DEFAULT 0,
        attendees_json TEXT,
        organizer_email TEXT,
        calendar_id TEXT DEFAULT 'primary',
        html_link TEXT,
        synced_at TEXT DEFAULT (datetime('now'))
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS emails (
        id TEXT PRIMARY KEY,
        thread_id TEXT,
        subject TEXT,
        snippet TEXT,
        from_name TEXT,
        from_email TEXT,
        to_emails TEXT,
        date TEXT,
        labels_json TEXT,
        is_unread INTEGER DEFAULT 0,
        body_preview TEXT,
        synced_at TEXT DEFAULT (datetime('now'))
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS slack_messages (
        id TEXT PRIMARY KEY,
        channel_id TEXT,
        channel_name TEXT,
        channel_type TEXT,
        user_id TEXT,
        user_name TEXT,
        text TEXT,
        ts TEXT,
        thread_ts TEXT,
        permalink TEXT,
        is_mention INTEGER DEFAULT 0,
        synced_at TEXT DEFAULT (datetime('now'))
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS notion_pages (
        id TEXT PRIMARY KEY,
        title TEXT,
        url TEXT,
        last_edited_time TEXT,
        last_edited_by TEXT,
        parent_type TEXT,
        parent_id TEXT,
        icon TEXT,
        snippet TEXT,
        synced_at TEXT DEFAULT (datetime('now'))
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS granola_meetings (
        id TEXT PRIMARY KEY,
        title TEXT,
        created_at TEXT,
        updated_at TEXT,
        meeting_type TEXT DEFAULT 'meeting',
        calendar_event_id TEXT,
        calendar_event_summary TEXT,
        attendees_json TEXT,
        panel_summary_html TEXT,
        panel_summary_plain TEXT,
        transcript_text TEXT,
        granola_link TEXT,
        employee_id TEXT,
        valid_meeting INTEGER DEFAULT 1,
        synced_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS meeting_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        meeting_date TEXT,
        title TEXT,
        summary TEXT,
        action_items_json TEXT,
        granola_link TEXT,
        content_markdown TEXT,
        last_modified TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        UNIQUE(filepath)
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS one_on_one_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id TEXT NOT NULL,
        meeting_date TEXT NOT NULL,
        title TEXT,
        content TEXT NOT NULL DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS news_items (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        url TEXT,
        source TEXT NOT NULL,
        source_detail TEXT,
        domain TEXT,
        snippet TEXT,
        found_at TEXT DEFAULT (datetime('now')),
        published_at TEXT,
        synced_at TEXT DEFAULT (datetime('now'))
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS sync_state (
        source TEXT PRIMARY KEY,
        last_sync_at TEXT,
        last_sync_status TEXT,
        last_error TEXT,
        items_synced INTEGER DEFAULT 0
    )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS sync_state")
    op.execute("DROP TABLE IF EXISTS news_items")
    op.execute("DROP TABLE IF EXISTS one_on_one_notes")
    op.execute("DROP TABLE IF EXISTS meeting_files")
    op.execute("DROP TABLE IF EXISTS granola_meetings")
    op.execute("DROP TABLE IF EXISTS notion_pages")
    op.execute("DROP TABLE IF EXISTS slack_messages")
    op.execute("DROP TABLE IF EXISTS emails")
    op.execute("DROP TABLE IF EXISTS calendar_events")
    op.execute("DROP TABLE IF EXISTS notes")
    op.execute("DROP TABLE IF EXISTS employees")
