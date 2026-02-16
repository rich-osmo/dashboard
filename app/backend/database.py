import sqlite3
from pathlib import Path
from config import DATABASE_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT,
    reports_to TEXT,
    depth INTEGER DEFAULT 0,
    dir_path TEXT DEFAULT '',
    has_meetings_dir INTEGER DEFAULT 0,
    is_executive INTEGER DEFAULT 0,
    group_name TEXT DEFAULT 'team',
    email TEXT,
    role_content TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    last_synced_at TEXT,
    FOREIGN KEY (reports_to) REFERENCES employees(id)
);

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
);

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
);

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
);

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
);

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
    relevance_score REAL DEFAULT 0,
    relevance_reason TEXT,
    synced_at TEXT DEFAULT (datetime('now'))
);

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
);

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
);

CREATE TABLE IF NOT EXISTS one_on_one_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    meeting_date TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

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
);

CREATE TABLE IF NOT EXISTS github_pull_requests (
    id INTEGER PRIMARY KEY,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    state TEXT NOT NULL,
    draft INTEGER DEFAULT 0,
    author TEXT NOT NULL,
    html_url TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    merged_at TEXT,
    head_ref TEXT,
    base_ref TEXT,
    labels_json TEXT,
    requested_reviewers_json TEXT,
    review_requested INTEGER DEFAULT 0,
    additions INTEGER,
    deletions INTEGER,
    changed_files INTEGER,
    body_preview TEXT,
    synced_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sync_state (
    source TEXT PRIMARY KEY,
    last_sync_at TEXT,
    last_sync_status TEXT,
    last_error TEXT,
    items_synced INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS note_employees (
    note_id INTEGER NOT NULL,
    employee_id TEXT NOT NULL,
    PRIMARY KEY (note_id, employee_id),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    priority INTEGER DEFAULT 1,
    tshirt_size TEXT DEFAULT 'm',
    status TEXT DEFAULT 'open',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS issue_employees (
    issue_id INTEGER NOT NULL,
    employee_id TEXT NOT NULL,
    PRIMARY KEY (issue_id, employee_id),
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS issue_meetings (
    issue_id INTEGER NOT NULL,
    meeting_ref_type TEXT NOT NULL,
    meeting_ref_id TEXT NOT NULL,
    PRIMARY KEY (issue_id, meeting_ref_type, meeting_ref_id),
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dismissed_priorities (
    title TEXT PRIMARY KEY,
    reason TEXT NOT NULL DEFAULT 'ignored',
    dismissed_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cached_priorities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    reason TEXT NOT NULL,
    source TEXT NOT NULL,
    urgency TEXT NOT NULL,
    generated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meeting_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    calendar_event_id TEXT,
    granola_meeting_id TEXT,
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(calendar_event_id),
    UNIQUE(granola_meeting_id)
);

CREATE TABLE IF NOT EXISTS dismissed_dashboard_items (
    source TEXT NOT NULL,
    item_id TEXT NOT NULL,
    dismissed_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (source, item_id)
);

CREATE TABLE IF NOT EXISTS cached_slack_priorities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_json TEXT NOT NULL,
    generated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cached_notion_priorities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_json TEXT NOT NULL,
    generated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cached_email_priorities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_json TEXT NOT NULL,
    generated_at TEXT DEFAULT (datetime('now'))
);
"""


def get_db() -> sqlite3.Connection:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DATABASE_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    # Migrate: rename todos -> notes if the old table exists
    tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    if "todos" in tables and "notes" not in tables:
        conn.execute("ALTER TABLE todos RENAME TO notes")
        conn.commit()
    # Migrate: add columns to employees if missing
    if "employees" in tables:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(employees)").fetchall()]
        if "is_executive" not in cols:
            conn.execute("ALTER TABLE employees ADD COLUMN is_executive INTEGER DEFAULT 0")
            conn.commit()
        if "group_name" not in cols:
            conn.execute("ALTER TABLE employees ADD COLUMN group_name TEXT DEFAULT 'team'")
            conn.execute("UPDATE employees SET group_name = 'exec' WHERE is_executive = 1")
            conn.commit()
        if "email" not in cols:
            conn.execute("ALTER TABLE employees ADD COLUMN email TEXT")
            conn.commit()
        if "role_content" not in cols:
            conn.execute("ALTER TABLE employees ADD COLUMN role_content TEXT")
            conn.commit()
        if "created_at" not in cols:
            conn.execute("ALTER TABLE employees ADD COLUMN created_at TEXT")
            conn.execute("UPDATE employees SET created_at = datetime('now') WHERE created_at IS NULL")
            conn.commit()
    # Migrate: add relevance columns to notion_pages if missing
    if "notion_pages" in tables:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(notion_pages)").fetchall()]
        if "relevance_score" not in cols:
            conn.execute("ALTER TABLE notion_pages ADD COLUMN relevance_score REAL DEFAULT 0")
            conn.commit()
        if "relevance_reason" not in cols:
            conn.execute("ALTER TABLE notion_pages ADD COLUMN relevance_reason TEXT")
            conn.commit()
    conn.executescript(SCHEMA)
    conn.commit()
    # Migrate: backfill note_employees junction table from existing notes.employee_id
    if "note_employees" in [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]:
        conn.execute(
            "INSERT OR IGNORE INTO note_employees (note_id, employee_id) "
            "SELECT id, employee_id FROM notes WHERE employee_id IS NOT NULL"
        )
        conn.commit()
    # Create FTS5 virtual tables for full-text search
    _init_fts(conn)
    conn.close()


FTS_SCHEMA = """
CREATE VIRTUAL TABLE IF NOT EXISTS fts_employees USING fts5(
    name, title, role_content,
    content='employees',
    content_rowid='rowid'
);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_notes USING fts5(
    text,
    content='notes',
    content_rowid='id'
);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_granola USING fts5(
    title, panel_summary_plain, transcript_text,
    content='granola_meetings',
    content_rowid='rowid'
);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_meeting_files USING fts5(
    title, summary, content_markdown,
    content='meeting_files',
    content_rowid='id'
);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_one_on_one USING fts5(
    title, content,
    content='one_on_one_notes',
    content_rowid='id'
);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_issues USING fts5(
    title, description,
    content='issues',
    content_rowid='id'
);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_emails USING fts5(
    subject, snippet, from_name, body_preview,
    content='emails',
    content_rowid='rowid'
);
"""

FTS_TABLES = [
    "fts_employees", "fts_notes", "fts_granola",
    "fts_meeting_files", "fts_one_on_one", "fts_issues", "fts_emails",
]


def _init_fts(conn: sqlite3.Connection):
    """Create FTS5 tables and populate them."""
    conn.executescript(FTS_SCHEMA)
    conn.commit()
    for table in FTS_TABLES:
        conn.execute(f"INSERT INTO {table}({table}) VALUES('rebuild')")
    conn.commit()


def rebuild_fts():
    """Rebuild all FTS5 indexes from source tables."""
    conn = get_db()
    for table in FTS_TABLES:
        conn.execute(f"INSERT INTO {table}({table}) VALUES('rebuild')")
    conn.commit()
    conn.close()


def rebuild_fts_table(table_name: str):
    """Rebuild a single FTS5 index."""
    conn = get_db()
    conn.execute(f"INSERT INTO {table_name}({table_name}) VALUES('rebuild')")
    conn.commit()
    conn.close()
