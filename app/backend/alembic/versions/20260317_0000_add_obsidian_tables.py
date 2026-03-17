"""Add obsidian_notes, cached_obsidian_priorities, and fts_obsidian_notes tables

Revision ID: 20260317_0000
Revises: 20260316_0001
Create Date: 2026-03-17 00:00:00

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260317_0000"
down_revision: Union[str, None] = "20260316_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS obsidian_notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            relative_path TEXT NOT NULL,
            folder TEXT,
            content TEXT,
            content_preview TEXT,
            frontmatter_json TEXT,
            tags TEXT,
            wiki_links TEXT,
            word_count INTEGER DEFAULT 0,
            created_time TEXT,
            modified_time TEXT,
            synced_at TEXT DEFAULT (datetime('now'))
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS cached_obsidian_priorities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data_json TEXT NOT NULL,
            data_hash TEXT,
            generated_at TEXT DEFAULT (datetime('now'))
        )
    """)

    op.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS fts_obsidian_notes
        USING fts5(title, content, tags, content='obsidian_notes', content_rowid='rowid')
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS fts_obsidian_notes")
    op.execute("DROP TABLE IF EXISTS cached_obsidian_priorities")
    op.execute("DROP TABLE IF EXISTS obsidian_notes")
