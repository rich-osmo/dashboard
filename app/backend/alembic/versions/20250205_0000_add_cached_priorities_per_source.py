"""Add per-source cached priorities tables

Revision ID: 20250205_0000
Revises: 20250130_0000
Create Date: 2025-02-05 00:00:00

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20250205_0000"
down_revision: Union[str, None] = "20250130_0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE IF NOT EXISTS cached_slack_priorities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data_json TEXT NOT NULL,
        generated_at TEXT DEFAULT (datetime('now'))
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS cached_notion_priorities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data_json TEXT NOT NULL,
        generated_at TEXT DEFAULT (datetime('now'))
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS cached_email_priorities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data_json TEXT NOT NULL,
        generated_at TEXT DEFAULT (datetime('now'))
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS cached_news_priorities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data_json TEXT NOT NULL,
        generated_at TEXT DEFAULT (datetime('now'))
    )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS cached_news_priorities")
    op.execute("DROP TABLE IF EXISTS cached_email_priorities")
    op.execute("DROP TABLE IF EXISTS cached_notion_priorities")
    op.execute("DROP TABLE IF EXISTS cached_slack_priorities")
