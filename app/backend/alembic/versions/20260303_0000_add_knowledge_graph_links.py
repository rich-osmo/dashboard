"""Add knowledge graph link tables and person_id columns

Revision ID: 20260303_0000
Revises: 20260226_0000
Create Date: 2026-03-03 00:00:00

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260303_0000"
down_revision: Union[str, None] = "20260226_0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Junction tables for multi-person entities

    op.execute("""
        CREATE TABLE IF NOT EXISTS email_people (
            email_id TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
            person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
            role TEXT NOT NULL DEFAULT 'from',
            PRIMARY KEY (email_id, person_id, role)
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS calendar_event_people (
            event_id TEXT NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
            person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
            response_status TEXT,
            PRIMARY KEY (event_id, person_id)
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS drive_file_people (
            file_id TEXT NOT NULL REFERENCES drive_files(id) ON DELETE CASCADE,
            person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
            role TEXT NOT NULL DEFAULT 'owner',
            PRIMARY KEY (file_id, person_id, role)
        )
    """)

    # Direct person_id columns for single-person entities
    op.execute("ALTER TABLE slack_messages ADD COLUMN person_id TEXT REFERENCES people(id)")
    op.execute("ALTER TABLE github_pull_requests ADD COLUMN person_id TEXT REFERENCES people(id)")
    op.execute("ALTER TABLE ramp_transactions ADD COLUMN person_id TEXT REFERENCES people(id)")

    # Indexes for efficient graph traversal
    op.execute("CREATE INDEX IF NOT EXISTS idx_email_people_person ON email_people(person_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_email_people_email ON email_people(email_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_calendar_event_people_person ON calendar_event_people(person_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_calendar_event_people_event ON calendar_event_people(event_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_drive_file_people_person ON drive_file_people(person_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_slack_messages_person ON slack_messages(person_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_github_prs_person ON github_pull_requests(person_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_ramp_txns_person ON ramp_transactions(person_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_ramp_txns_person")
    op.execute("DROP INDEX IF EXISTS idx_github_prs_person")
    op.execute("DROP INDEX IF EXISTS idx_slack_messages_person")
    op.execute("DROP INDEX IF EXISTS idx_drive_file_people_person")
    op.execute("DROP INDEX IF EXISTS idx_calendar_event_people_event")
    op.execute("DROP INDEX IF EXISTS idx_calendar_event_people_person")
    op.execute("DROP INDEX IF EXISTS idx_email_people_email")
    op.execute("DROP INDEX IF EXISTS idx_email_people_person")
    op.execute("DROP TABLE IF EXISTS drive_file_people")
    op.execute("DROP TABLE IF EXISTS calendar_event_people")
    op.execute("DROP TABLE IF EXISTS email_people")
    # SQLite doesn't support DROP COLUMN easily; these columns remain on downgrade
