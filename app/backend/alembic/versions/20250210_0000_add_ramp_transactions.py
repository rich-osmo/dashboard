"""Add Ramp transaction tracking

Revision ID: 20250210_0000
Revises: 20250205_0000
Create Date: 2025-02-10 00:00:00

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20250210_0000"
down_revision: Union[str, None] = "20250205_0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE IF NOT EXISTS ramp_transactions (
        id TEXT PRIMARY KEY,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'USD',
        merchant_name TEXT,
        category TEXT,
        category_code INTEGER,
        transaction_date TEXT NOT NULL,
        cardholder_name TEXT,
        cardholder_email TEXT,
        employee_id TEXT,
        memo TEXT,
        receipt_urls TEXT,
        status TEXT,
        ramp_url TEXT,
        synced_at TEXT DEFAULT (datetime('now'))
    )
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS cached_ramp_priorities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data_json TEXT NOT NULL,
        generated_at TEXT DEFAULT (datetime('now'))
    )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS cached_ramp_priorities")
    op.execute("DROP TABLE IF EXISTS ramp_transactions")
