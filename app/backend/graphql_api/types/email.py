"""EmailType — Gmail messages."""

from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry.types import Info

if TYPE_CHECKING:
    from graphql_api.types.person import PersonType


@strawberry.type
class EmailType:
    id: str
    thread_id: Optional[str] = None
    subject: str = ""
    snippet: str = ""
    from_name: Optional[str] = None
    from_email: Optional[str] = None
    date: Optional[str] = None
    is_unread: bool = False

    @strawberry.field
    async def people(self, info: Info) -> list[Annotated["PersonType", strawberry.lazy(".person")]]:
        from graphql_api.types.person import _to_person

        rows = await info.context.loaders.people_by_email.load(self.id)
        return [_to_person(r) for r in rows]


def _to_email(row: dict) -> EmailType:
    return EmailType(
        id=row["id"],
        thread_id=row.get("thread_id"),
        subject=row.get("subject", ""),
        snippet=row.get("snippet", ""),
        from_name=row.get("from_name"),
        from_email=row.get("from_email"),
        date=row.get("date"),
        is_unread=bool(row.get("is_unread", 0)),
    )
