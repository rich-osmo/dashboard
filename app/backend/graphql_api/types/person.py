"""PersonType — the hub of the knowledge graph."""

from typing import TYPE_CHECKING, Annotated, Optional

import strawberry
from strawberry.types import Info

if TYPE_CHECKING:
    from graphql_api.types.calendar import CalendarEventType
    from graphql_api.types.drive import DriveFileType
    from graphql_api.types.email import EmailType
    from graphql_api.types.github import GitHubPRType
    from graphql_api.types.issue import IssueType
    from graphql_api.types.longform import LongformPostType
    from graphql_api.types.meeting import GranolaMeetingType, MeetingFileType
    from graphql_api.types.note import NoteType
    from graphql_api.types.ramp import RampTransactionType
    from graphql_api.types.slack import SlackMessageType


@strawberry.type
class PersonType:
    id: str
    name: str
    title: Optional[str] = None
    reports_to: Optional[str] = None
    email: Optional[str] = None
    group_name: Optional[str] = None
    is_coworker: bool = True
    is_executive: bool = False
    company: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    linkedin_url: Optional[str] = None
    depth: int = 0

    @strawberry.field
    async def manager(self, info: Info) -> Optional["PersonType"]:
        if not self.reports_to:
            return None
        data = await info.context.loaders.person_by_id.load(self.reports_to)
        return _to_person(data) if data else None

    @strawberry.field
    async def direct_reports(self, info: Info) -> list["PersonType"]:
        rows = await info.context.loaders.direct_reports.load(self.id)
        return [_to_person(r) for r in rows]

    @strawberry.field
    async def notes(self, info: Info) -> list[Annotated["NoteType", strawberry.lazy(".note")]]:
        from graphql_api.types.note import _to_note

        rows = await info.context.loaders.notes_by_person.load(self.id)
        return [_to_note(r) for r in rows]

    @strawberry.field
    async def issues(self, info: Info) -> list[Annotated["IssueType", strawberry.lazy(".issue")]]:
        from graphql_api.types.issue import _to_issue

        rows = await info.context.loaders.issues_by_person.load(self.id)
        return [_to_issue(r) for r in rows]

    @strawberry.field
    async def emails(self, info: Info) -> list[Annotated["EmailType", strawberry.lazy(".email")]]:
        from graphql_api.types.email import _to_email

        rows = await info.context.loaders.emails_by_person.load(self.id)
        return [_to_email(r) for r in rows]

    @strawberry.field
    async def slack_messages(self, info: Info) -> list[Annotated["SlackMessageType", strawberry.lazy(".slack")]]:
        from graphql_api.types.slack import _to_slack

        rows = await info.context.loaders.slack_by_person.load(self.id)
        return [_to_slack(r) for r in rows]

    @strawberry.field
    async def calendar_events(self, info: Info) -> list[Annotated["CalendarEventType", strawberry.lazy(".calendar")]]:
        from graphql_api.types.calendar import _to_event

        rows = await info.context.loaders.events_by_person.load(self.id)
        return [_to_event(r) for r in rows]

    @strawberry.field
    async def github_prs(self, info: Info) -> list[Annotated["GitHubPRType", strawberry.lazy(".github")]]:
        from graphql_api.types.github import _to_pr

        rows = await info.context.loaders.github_prs_by_person.load(self.id)
        return [_to_pr(r) for r in rows]

    @strawberry.field
    async def drive_files(self, info: Info) -> list[Annotated["DriveFileType", strawberry.lazy(".drive")]]:
        from graphql_api.types.drive import _to_drive_file

        rows = await info.context.loaders.drive_files_by_person.load(self.id)
        return [_to_drive_file(r) for r in rows]

    @strawberry.field
    async def ramp_transactions(self, info: Info) -> list[Annotated["RampTransactionType", strawberry.lazy(".ramp")]]:
        from graphql_api.types.ramp import _to_txn

        rows = await info.context.loaders.ramp_txns_by_person.load(self.id)
        return [_to_txn(r) for r in rows]

    @strawberry.field
    async def granola_meetings(self, info: Info) -> list[Annotated["GranolaMeetingType", strawberry.lazy(".meeting")]]:
        from graphql_api.types.meeting import _to_granola

        rows = await info.context.loaders.granola_meetings_by_person.load(self.id)
        return [_to_granola(r) for r in rows]

    @strawberry.field
    async def meeting_files(self, info: Info) -> list[Annotated["MeetingFileType", strawberry.lazy(".meeting")]]:
        from graphql_api.types.meeting import _to_meeting_file

        rows = await info.context.loaders.meeting_files_by_person.load(self.id)
        return [_to_meeting_file(r) for r in rows]

    @strawberry.field
    async def longform_posts(self, info: Info) -> list[Annotated["LongformPostType", strawberry.lazy(".longform")]]:
        from graphql_api.types.longform import _to_post

        rows = await info.context.loaders.longform_posts_by_person.load(self.id)
        return [_to_post(r) for r in rows]


def _to_person(row: dict) -> PersonType:
    return PersonType(
        id=row["id"],
        name=row["name"],
        title=row.get("title"),
        reports_to=row.get("reports_to"),
        email=row.get("email"),
        group_name=row.get("group_name"),
        is_coworker=bool(row.get("is_coworker", 1)),
        is_executive=bool(row.get("is_executive", 0)),
        company=row.get("company"),
        phone=row.get("phone"),
        bio=row.get("bio"),
        linkedin_url=row.get("linkedin_url"),
        depth=row.get("depth", 0),
    )
