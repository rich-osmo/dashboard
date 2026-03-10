"""ProjectType — budget and project tracking."""

from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry.types import Info

if TYPE_CHECKING:
    from graphql_api.types.issue import IssueType
    from graphql_api.types.ramp import RampBillType


@strawberry.type
class ProjectType:
    id: int
    name: str
    description: Optional[str] = None
    budget_amount: float = 0.0
    currency: str = "USD"
    status: str = "active"
    vendor_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[str] = None

    @strawberry.field
    async def issues(self, info: Info) -> list[Annotated["IssueType", strawberry.lazy(".issue")]]:
        from graphql_api.types.issue import _to_issue

        rows = await info.context.loaders.issues_by_project.load(self.id)
        return [_to_issue(r) for r in rows]

    @strawberry.field
    async def bills(self, info: Info) -> list[Annotated["RampBillType", strawberry.lazy(".ramp")]]:
        from graphql_api.types.ramp import _to_bill

        rows = await info.context.loaders.bills_by_project.load(self.id)
        return [_to_bill(r) for r in rows]


def _to_project(row: dict) -> ProjectType:
    return ProjectType(
        id=row["id"],
        name=row["name"],
        description=row.get("description"),
        budget_amount=row.get("budget_amount", 0.0),
        currency=row.get("currency", "USD"),
        status=row.get("status", "active"),
        vendor_id=row.get("vendor_id"),
        notes=row.get("notes"),
        created_at=row.get("created_at"),
    )
