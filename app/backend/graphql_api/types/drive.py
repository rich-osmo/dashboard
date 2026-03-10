"""DriveFileType — Google Drive files."""

from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry.types import Info

if TYPE_CHECKING:
    from graphql_api.types.person import PersonType


@strawberry.type
class DriveFileType:
    id: str
    name: str = ""
    mime_type: Optional[str] = None
    web_view_link: Optional[str] = None
    modified_time: Optional[str] = None
    modified_by_name: Optional[str] = None
    owner_name: Optional[str] = None
    shared: bool = False
    starred: bool = False
    parent_name: Optional[str] = None
    description: Optional[str] = None

    @strawberry.field
    async def people(self, info: Info) -> list[Annotated["PersonType", strawberry.lazy(".person")]]:
        from graphql_api.types.person import _to_person

        rows = await info.context.loaders.people_by_drive_file.load(self.id)
        return [_to_person(r) for r in rows]


def _to_drive_file(row: dict) -> DriveFileType:
    return DriveFileType(
        id=row["id"],
        name=row.get("name", ""),
        mime_type=row.get("mime_type"),
        web_view_link=row.get("web_view_link"),
        modified_time=row.get("modified_time"),
        modified_by_name=row.get("modified_by_name"),
        owner_name=row.get("owner_name"),
        shared=bool(row.get("shared", 0)),
        starred=bool(row.get("starred", 0)),
        parent_name=row.get("parent_name"),
        description=row.get("description"),
    )
