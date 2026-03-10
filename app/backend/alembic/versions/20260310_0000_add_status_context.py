"""Add cached_status_context table for LLM session context

Revision ID: 20260310_0000
Revises: 20260308_0000
Create Date: 2026-03-10 00:00:00

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260310_0000"
down_revision: Union[str, None] = "20260308_0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE IF NOT EXISTS cached_status_context (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        context_text TEXT NOT NULL DEFAULT '',
        data_hash TEXT DEFAULT '',
        generated_at TEXT DEFAULT (datetime('now'))
    )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS cached_status_context")
