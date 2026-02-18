"""Add relevance scoring to notion_pages

Revision ID: 20250110_0000
Revises: 20250105_0000
Create Date: 2025-01-10 00:00:00

"""

from typing import Sequence, Union

from sqlalchemy import text

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20250110_0000"
down_revision: Union[str, None] = "20250105_0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(text("PRAGMA table_info(notion_pages)")).fetchall()
    cols = [row[1] for row in result]

    if "relevance_score" not in cols:
        op.execute("ALTER TABLE notion_pages ADD COLUMN relevance_score REAL DEFAULT 0")

    if "relevance_reason" not in cols:
        op.execute("ALTER TABLE notion_pages ADD COLUMN relevance_reason TEXT")


def downgrade() -> None:
    pass
