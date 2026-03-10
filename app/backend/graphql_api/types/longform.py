"""LongformPostType — blog posts and drafts."""

from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry.types import Info

if TYPE_CHECKING:
    from graphql_api.types.person import PersonType


@strawberry.type
class LongformCommentType:
    id: int
    post_id: int
    text: str = ""
    is_thought: bool = False
    created_at: Optional[str] = None


@strawberry.type
class LongformPostType:
    id: int
    title: str = "Untitled"
    body: Optional[str] = None
    status: str = "draft"
    word_count: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    published_at: Optional[str] = None

    @strawberry.field
    async def tags(self, info: Info) -> list[str]:
        return await info.context.loaders.tags_by_post.load(self.id)

    @strawberry.field
    async def comments(self, info: Info) -> list[LongformCommentType]:
        rows = await info.context.loaders.comments_by_post.load(self.id)
        return [_to_comment(r) for r in rows]

    @strawberry.field
    async def people(self, info: Info) -> list[Annotated["PersonType", strawberry.lazy(".person")]]:
        from graphql_api.types.person import _to_person

        rows = await info.context.loaders.people_by_longform_post.load(self.id)
        return [_to_person(r) for r in rows]


def _to_post(row: dict) -> LongformPostType:
    return LongformPostType(
        id=row["id"],
        title=row.get("title", "Untitled"),
        body=row.get("body"),
        status=row.get("status", "draft"),
        word_count=row.get("word_count", 0),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
        published_at=row.get("published_at"),
    )


def _to_comment(row: dict) -> LongformCommentType:
    return LongformCommentType(
        id=row["id"],
        post_id=row["post_id"],
        text=row.get("text", ""),
        is_thought=bool(row.get("is_thought", 0)),
        created_at=row.get("created_at"),
    )
