"""NoteType — todos, 1:1 talking points, thoughts."""

from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry.types import Info

if TYPE_CHECKING:
    from graphql_api.types.person import PersonType


@strawberry.type
class NoteType:
    id: int
    text: str
    priority: int = 0
    status: str = "open"
    is_one_on_one: bool = False
    created_at: Optional[str] = None
    completed_at: Optional[str] = None
    due_date: Optional[str] = None

    @strawberry.field
    async def people(self, info: Info) -> list[Annotated["PersonType", strawberry.lazy(".person")]]:
        from graphql_api.types.person import _to_person

        rows = await info.context.loaders.people_by_note.load(self.id)
        return [_to_person(r) for r in rows]


def _to_note(row: dict) -> NoteType:
    return NoteType(
        id=row["id"],
        text=row["text"],
        priority=row.get("priority", 0),
        status=row.get("status", "open"),
        is_one_on_one=bool(row.get("is_one_on_one", 0)),
        created_at=row.get("created_at"),
        completed_at=row.get("completed_at"),
        due_date=row.get("due_date"),
    )
