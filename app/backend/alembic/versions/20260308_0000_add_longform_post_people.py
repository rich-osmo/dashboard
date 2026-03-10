"""Add longform_post_people junction table

Revision ID: 20260308_0000
Revises: 20260303_0000
Create Date: 2026-03-08 00:00:00

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260308_0000"
down_revision: Union[str, None] = "20260303_0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS longform_post_people (
            post_id INTEGER NOT NULL REFERENCES longform_posts(id) ON DELETE CASCADE,
            person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
            PRIMARY KEY (post_id, person_id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_longform_post_people_person ON longform_post_people(person_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_longform_post_people_post ON longform_post_people(post_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_longform_post_people_post")
    op.execute("DROP INDEX IF EXISTS idx_longform_post_people_person")
    op.execute("DROP TABLE IF EXISTS longform_post_people")
