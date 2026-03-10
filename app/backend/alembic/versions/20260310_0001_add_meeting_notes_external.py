"""Add meeting_notes_external table for provider-agnostic meeting notes

Revision ID: 20260310_0001
Revises: 20260310_0000
Create Date: 2026-03-10 00:00:01

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260310_0001"
down_revision: Union[str, None] = "20260310_0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Provider-agnostic meeting notes table
    op.execute("""
    CREATE TABLE IF NOT EXISTS meeting_notes_external (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        title TEXT,
        created_at TEXT,
        updated_at TEXT,
        calendar_event_id TEXT,
        attendees_json TEXT,
        summary_html TEXT,
        summary_plain TEXT,
        transcript_text TEXT,
        external_link TEXT,
        person_id TEXT,
        valid_meeting INTEGER DEFAULT 1,
        raw_metadata TEXT,
        synced_at TEXT DEFAULT (datetime('now'))
    )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_mne_provider ON meeting_notes_external(provider)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_mne_calendar ON meeting_notes_external(calendar_event_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_mne_person ON meeting_notes_external(person_id)")

    # FTS5 table for full-text search on meeting notes
    op.execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_meeting_notes_ext
    USING fts5(title, summary_plain, content=meeting_notes_external, content_rowid=rowid)
    """)

    # Add external_note_id to meeting_notes for linking user annotations
    # to the new provider-agnostic table
    try:
        op.execute("ALTER TABLE meeting_notes ADD COLUMN external_note_id TEXT")
    except Exception:
        pass  # Column may already exist

    # Copy existing granola_meetings data into the new table
    op.execute("""
    INSERT OR IGNORE INTO meeting_notes_external
        (id, provider, title, created_at, updated_at, calendar_event_id,
         attendees_json, summary_html, summary_plain, transcript_text,
         external_link, person_id, valid_meeting, raw_metadata, synced_at)
    SELECT
        id, 'granola', title, created_at, updated_at, calendar_event_id,
        attendees_json, panel_summary_html, panel_summary_plain, transcript_text,
        granola_link, person_id, valid_meeting, '{}', synced_at
    FROM granola_meetings
    """)

    # Backfill external_note_id on meeting_notes from granola_meeting_id
    op.execute("""
    UPDATE meeting_notes SET external_note_id = granola_meeting_id
    WHERE granola_meeting_id IS NOT NULL AND external_note_id IS NULL
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS fts_meeting_notes_ext")
    op.execute("DROP TABLE IF EXISTS meeting_notes_external")
