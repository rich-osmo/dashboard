"""Add priorities caching and GitHub PR tracking

Revision ID: 20250125_0000
Revises: 20250120_0000
Create Date: 2025-01-25 00:00:00

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20250125_0000"
down_revision: Union[str, None] = "20250120_0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE IF NOT EXISTS dismissed_priorities (
        title TEXT PRIMARY KEY,
        reason TEXT NOT NULL DEFAULT 'ignored',
        dismissed_at TEXT DEFAULT (datetime('now'))
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS cached_priorities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        reason TEXT NOT NULL,
        source TEXT NOT NULL,
        urgency TEXT NOT NULL,
        generated_at TEXT DEFAULT (datetime('now'))
    )
    """)

    op.execute("""
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
    )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS github_pull_requests")
    op.execute("DROP TABLE IF EXISTS cached_priorities")
    op.execute("DROP TABLE IF EXISTS dismissed_priorities")
