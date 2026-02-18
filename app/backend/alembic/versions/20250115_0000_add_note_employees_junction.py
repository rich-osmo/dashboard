"""Add note_employees junction table for many-to-many relationships

Revision ID: 20250115_0000
Revises: 20250110_0000
Create Date: 2025-01-15 00:00:00

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20250115_0000"
down_revision: Union[str, None] = "20250110_0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE IF NOT EXISTS note_employees (
        note_id INTEGER NOT NULL,
        employee_id TEXT NOT NULL,
        PRIMARY KEY (note_id, employee_id),
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
    """)

    # Backfill from existing notes.employee_id
    op.execute("""
    INSERT OR IGNORE INTO note_employees (note_id, employee_id)
    SELECT id, employee_id FROM notes WHERE employee_id IS NOT NULL
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS note_employees")
