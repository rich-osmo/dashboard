"""GitHubPRType — pull requests."""

from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry.types import Info

if TYPE_CHECKING:
    from graphql_api.types.person import PersonType


@strawberry.type
class GitHubPRType:
    id: int
    number: int = 0
    title: str = ""
    state: Optional[str] = None
    draft: bool = False
    author: Optional[str] = None
    html_url: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    merged_at: Optional[str] = None
    head_ref: Optional[str] = None
    base_ref: Optional[str] = None
    additions: int = 0
    deletions: int = 0
    changed_files: int = 0

    @strawberry.field
    async def person(self, info: Info) -> Optional[Annotated["PersonType", strawberry.lazy(".person")]]:
        person_id = getattr(self, "_person_id", None)
        if not person_id:
            return None
        from graphql_api.types.person import _to_person

        data = await info.context.loaders.person_by_id.load(person_id)
        return _to_person(data) if data else None


def _to_pr(row: dict) -> GitHubPRType:
    obj = GitHubPRType(
        id=row["id"],
        number=row.get("number", 0),
        title=row.get("title", ""),
        state=row.get("state"),
        draft=bool(row.get("draft", 0)),
        author=row.get("author"),
        html_url=row.get("html_url"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
        merged_at=row.get("merged_at"),
        head_ref=row.get("head_ref"),
        base_ref=row.get("base_ref"),
        additions=row.get("additions", 0),
        deletions=row.get("deletions", 0),
        changed_files=row.get("changed_files", 0),
    )
    obj._person_id = row.get("person_id")  # type: ignore[attr-defined]
    return obj
