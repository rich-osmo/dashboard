"""Add meeting notes and dashboard dismissals

Revision ID: 20250130_0000
Revises: 20250125_0000
Create Date: 2025-01-30 00:00:00

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20250130_0000"
down_revision: Union[str, None] = "20250125_0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE IF NOT EXISTS meeting_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        calendar_event_id TEXT,
        granola_meeting_id TEXT,
        content TEXT NOT NULL DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(calendar_event_id),
        UNIQUE(granola_meeting_id)
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS dismissed_dashboard_items (
        source TEXT NOT NULL,
        item_id TEXT NOT NULL,
        dismissed_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (source, item_id)
    )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS dismissed_dashboard_items")
    op.execute("DROP TABLE IF EXISTS meeting_notes")
