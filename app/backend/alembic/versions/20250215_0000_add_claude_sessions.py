"""Add Claude Code session tracking

Revision ID: 20250215_0000
Revises: 20250210_0000
Create Date: 2025-02-15 00:00:00

"""

from typing import Sequence, Union

from sqlalchemy import text

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20250215_0000"
down_revision: Union[str, None] = "20250210_0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE IF NOT EXISTS claude_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL DEFAULT 'Untitled Session',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        filepath TEXT NOT NULL,
        preview TEXT DEFAULT '',
        summary TEXT DEFAULT '',
        size_bytes INTEGER DEFAULT 0
    )
    """)

    # Add summary column if table already exists without it
    conn = op.get_bind()
    result = conn.execute(text("PRAGMA table_info(claude_sessions)")).fetchall()
    cols = [row[1] for row in result]

    if "summary" not in cols:
        op.execute("ALTER TABLE claude_sessions ADD COLUMN summary TEXT DEFAULT ''")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS claude_sessions")
