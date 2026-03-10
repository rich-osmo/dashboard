"""GranolaMeetingType and MeetingFileType."""

from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry.types import Info

if TYPE_CHECKING:
    from graphql_api.types.person import PersonType


@strawberry.type
class GranolaMeetingType:
    id: str
    title: Optional[str] = None
    created_at: Optional[str] = None
    panel_summary_plain: Optional[str] = None
    granola_link: Optional[str] = None
    calendar_event_id: Optional[str] = None

    @strawberry.field
    async def person(self, info: Info) -> Optional[Annotated["PersonType", strawberry.lazy(".person")]]:
        person_id = getattr(self, "_person_id", None)
        if not person_id:
            return None
        from graphql_api.types.person import _to_person

        data = await info.context.loaders.person_by_id.load(person_id)
        return _to_person(data) if data else None


@strawberry.type
class MeetingFileType:
    id: int
    filename: Optional[str] = None
    meeting_date: Optional[str] = None
    title: Optional[str] = None
    summary: Optional[str] = None
    granola_link: Optional[str] = None

    @strawberry.field
    async def person(self, info: Info) -> Optional[Annotated["PersonType", strawberry.lazy(".person")]]:
        person_id = getattr(self, "_person_id", None)
        if not person_id:
            return None
        from graphql_api.types.person import _to_person

        data = await info.context.loaders.person_by_id.load(person_id)
        return _to_person(data) if data else None


def _to_granola(row: dict) -> GranolaMeetingType:
    obj = GranolaMeetingType(
        id=row["id"],
        title=row.get("title"),
        created_at=row.get("created_at"),
        panel_summary_plain=row.get("panel_summary_plain"),
        granola_link=row.get("granola_link"),
        calendar_event_id=row.get("calendar_event_id"),
    )
    obj._person_id = row.get("person_id")  # type: ignore[attr-defined]
    return obj


def _to_meeting_file(row: dict) -> MeetingFileType:
    obj = MeetingFileType(
        id=row["id"],
        filename=row.get("filename"),
        meeting_date=row.get("meeting_date"),
        title=row.get("title"),
        summary=row.get("summary"),
        granola_link=row.get("granola_link"),
    )
    obj._person_id = row.get("person_id")  # type: ignore[attr-defined]
    return obj
