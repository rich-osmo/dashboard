"""IssueType — local issue tracking."""

from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry.types import Info

if TYPE_CHECKING:
    from graphql_api.types.person import PersonType
    from graphql_api.types.project import ProjectType


@strawberry.type
class IssueType:
    id: int
    title: str
    description: Optional[str] = None
    priority: int = 1
    tshirt_size: str = "m"
    status: str = "open"
    project_id: Optional[int] = None
    due_date: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    completed_at: Optional[str] = None

    @strawberry.field
    async def people(self, info: Info) -> list[Annotated["PersonType", strawberry.lazy(".person")]]:
        from graphql_api.types.person import _to_person

        rows = await info.context.loaders.people_by_issue.load(self.id)
        return [_to_person(r) for r in rows]

    @strawberry.field
    async def tags(self, info: Info) -> list[str]:
        return await info.context.loaders.tags_by_issue.load(self.id)

    @strawberry.field
    async def project(self, info: Info) -> Optional[Annotated["ProjectType", strawberry.lazy(".project")]]:
        if not self.project_id:
            return None
        from graphql_api.types.project import _to_project

        row = info.context.db.execute("SELECT * FROM projects WHERE id = ?", (self.project_id,)).fetchone()
        return _to_project(dict(row)) if row else None


def _to_issue(row: dict) -> IssueType:
    return IssueType(
        id=row["id"],
        title=row["title"],
        description=row.get("description"),
        priority=row.get("priority", 1),
        tshirt_size=row.get("tshirt_size", "m"),
        status=row.get("status", "open"),
        project_id=row.get("project_id"),
        due_date=row.get("due_date"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
        completed_at=row.get("completed_at"),
    )
