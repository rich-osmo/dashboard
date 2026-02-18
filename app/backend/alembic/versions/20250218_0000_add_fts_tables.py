"""Add FTS5 full-text search tables

Revision ID: 20250218_0000
Revises: 20250215_0000
Create Date: 2025-02-18 00:00:00

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20250218_0000"
down_revision: Union[str, None] = "20250215_0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create FTS5 virtual tables for full-text search
    op.execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_employees USING fts5(
        name, title, role_content,
        content='employees',
        content_rowid='rowid'
    )
    """)

    op.execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_notes USING fts5(
        text,
        content='notes',
        content_rowid='id'
    )
    """)

    op.execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_granola USING fts5(
        title, panel_summary_plain, transcript_text,
        content='granola_meetings',
        content_rowid='rowid'
    )
    """)

    op.execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_meeting_files USING fts5(
        title, summary, content_markdown,
        content='meeting_files',
        content_rowid='id'
    )
    """)

    op.execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_one_on_one USING fts5(
        title, content,
        content='one_on_one_notes',
        content_rowid='id'
    )
    """)

    op.execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_issues USING fts5(
        title, description,
        content='issues',
        content_rowid='id'
    )
    """)

    op.execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_emails USING fts5(
        subject, snippet, from_name, body_preview,
        content='emails',
        content_rowid='rowid'
    )
    """)

    # Rebuild FTS indexes
    fts_tables = [
        "fts_employees",
        "fts_notes",
        "fts_granola",
        "fts_meeting_files",
        "fts_one_on_one",
        "fts_issues",
        "fts_emails",
    ]

    for table in fts_tables:
        op.execute(f"INSERT INTO {table}({table}) VALUES('rebuild')")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS fts_emails")
    op.execute("DROP TABLE IF EXISTS fts_issues")
    op.execute("DROP TABLE IF EXISTS fts_one_on_one")
    op.execute("DROP TABLE IF EXISTS fts_meeting_files")
    op.execute("DROP TABLE IF EXISTS fts_granola")
    op.execute("DROP TABLE IF EXISTS fts_notes")
    op.execute("DROP TABLE IF EXISTS fts_employees")
