"""Add employee metadata (is_executive, group_name, email, role_content, created_at, last_synced_at)

Revision ID: 20250105_0000
Revises: 20250101_0000
Create Date: 2025-01-05 00:00:00

"""

from typing import Sequence, Union

from sqlalchemy import text

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20250105_0000"
down_revision: Union[str, None] = "20250101_0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if columns exist before adding them
    conn = op.get_bind()

    # Add is_executive column
    result = conn.execute(text("PRAGMA table_info(employees)")).fetchall()
    cols = [row[1] for row in result]

    if "is_executive" not in cols:
        op.execute("ALTER TABLE employees ADD COLUMN is_executive INTEGER DEFAULT 0")

    if "group_name" not in cols:
        op.execute("ALTER TABLE employees ADD COLUMN group_name TEXT DEFAULT 'team'")
        op.execute("UPDATE employees SET group_name = 'exec' WHERE is_executive = 1")

    if "email" not in cols:
        op.execute("ALTER TABLE employees ADD COLUMN email TEXT")

    if "role_content" not in cols:
        op.execute("ALTER TABLE employees ADD COLUMN role_content TEXT")

    if "created_at" not in cols:
        op.execute("ALTER TABLE employees ADD COLUMN created_at TEXT DEFAULT (datetime('now'))")
        op.execute("UPDATE employees SET created_at = datetime('now') WHERE created_at IS NULL")

    if "last_synced_at" not in cols:
        op.execute("ALTER TABLE employees ADD COLUMN last_synced_at TEXT")


def downgrade() -> None:
    # SQLite doesn't support DROP COLUMN directly, would need to recreate table
    # For simplicity, we'll keep the columns (they don't hurt if unused)
    pass
