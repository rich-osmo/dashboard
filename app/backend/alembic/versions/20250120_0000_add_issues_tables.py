"""Add issues tracking tables

Revision ID: 20250120_0000
Revises: 20250115_0000
Create Date: 2025-01-20 00:00:00

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20250120_0000"
down_revision: Union[str, None] = "20250115_0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE IF NOT EXISTS issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        priority INTEGER DEFAULT 1,
        tshirt_size TEXT DEFAULT 'm',
        status TEXT DEFAULT 'open',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        completed_at TEXT
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS issue_employees (
        issue_id INTEGER NOT NULL,
        employee_id TEXT NOT NULL,
        PRIMARY KEY (issue_id, employee_id),
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS issue_meetings (
        issue_id INTEGER NOT NULL,
        meeting_ref_type TEXT NOT NULL,
        meeting_ref_id TEXT NOT NULL,
        PRIMARY KEY (issue_id, meeting_ref_type, meeting_ref_id),
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
    )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS issue_meetings")
    op.execute("DROP TABLE IF EXISTS issue_employees")
    op.execute("DROP TABLE IF EXISTS issues")
