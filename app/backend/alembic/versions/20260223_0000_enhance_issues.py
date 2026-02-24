"""Add project_id, due_date, and issue_tags table

Revision ID: 20260223_0000
Revises: 20260222_0001
Create Date: 2026-02-23 00:00:00

"""

from typing import Sequence, Union

from alembic import op

revision: str = "20260223_0000"
down_revision: Union[str, None] = "20260222_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE issues ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL")
    op.execute("ALTER TABLE issues ADD COLUMN due_date TEXT")
    op.execute("""
    CREATE TABLE IF NOT EXISTS issue_tags (
        issue_id INTEGER NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (issue_id, tag),
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
    )
    """)
    op.execute("INSERT INTO fts_issues(fts_issues) VALUES('rebuild')")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS issue_tags")
    op.execute("ALTER TABLE issues DROP COLUMN due_date")
    op.execute("ALTER TABLE issues DROP COLUMN project_id")
