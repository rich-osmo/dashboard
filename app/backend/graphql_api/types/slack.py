"""SlackMessageType — Slack DMs and mentions."""

from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry.types import Info

if TYPE_CHECKING:
    from graphql_api.types.person import PersonType


@strawberry.type
class SlackMessageType:
    id: str
    channel_name: Optional[str] = None
    channel_type: Optional[str] = None
    user_name: Optional[str] = None
    text: str = ""
    ts: Optional[str] = None
    permalink: Optional[str] = None
    is_mention: bool = False

    @strawberry.field
    async def person(self, info: Info) -> Optional[Annotated["PersonType", strawberry.lazy(".person")]]:
        person_id = getattr(self, "_person_id", None)
        if not person_id:
            return None
        from graphql_api.types.person import _to_person

        data = await info.context.loaders.person_by_id.load(person_id)
        return _to_person(data) if data else None


def _to_slack(row: dict) -> SlackMessageType:
    obj = SlackMessageType(
        id=row["id"],
        channel_name=row.get("channel_name"),
        channel_type=row.get("channel_type"),
        user_name=row.get("user_name"),
        text=row.get("text", ""),
        ts=row.get("ts"),
        permalink=row.get("permalink"),
        is_mention=bool(row.get("is_mention", 0)),
    )
    obj._person_id = row.get("person_id")  # type: ignore[attr-defined]
    return obj
