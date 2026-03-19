"""Add cached_github_priorities table

Revision ID: 20260318_0000
Revises: 20260317_0000
Create Date: 2026-03-18 00:00:00
"""

from typing import Sequence, Union

from alembic import op

revision: str = "20260318_0000"
down_revision: Union[str, None] = "20260317_0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS cached_github_priorities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data_json TEXT NOT NULL,
            data_hash TEXT,
            generated_at TEXT DEFAULT (datetime('now'))
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS cached_github_priorities")
