"""CalendarEventType — Google Calendar events."""

from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry.types import Info

if TYPE_CHECKING:
    from graphql_api.types.person import PersonType


@strawberry.type
class CalendarEventType:
    id: str
    summary: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    all_day: bool = False
    organizer_email: Optional[str] = None
    html_link: Optional[str] = None

    @strawberry.field
    async def attendees(self, info: Info) -> list[Annotated["PersonType", strawberry.lazy(".person")]]:
        from graphql_api.types.person import _to_person

        rows = await info.context.loaders.people_by_event.load(self.id)
        return [_to_person(r) for r in rows]


def _to_event(row: dict) -> CalendarEventType:
    return CalendarEventType(
        id=row["id"],
        summary=row.get("summary"),
        description=row.get("description"),
        location=row.get("location"),
        start_time=row.get("start_time"),
        end_time=row.get("end_time"),
        all_day=bool(row.get("all_day", 0)),
        organizer_email=row.get("organizer_email"),
        html_link=row.get("html_link"),
    )
