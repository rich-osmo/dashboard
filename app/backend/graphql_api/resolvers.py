"""Root Query and Mutation resolvers."""

from typing import Optional

import strawberry
from strawberry.types import Info

from graphql_api.types.calendar import CalendarEventType, _to_event
from graphql_api.types.drive import DriveFileType, _to_drive_file
from graphql_api.types.email import EmailType, _to_email
from graphql_api.types.github import GitHubPRType, _to_pr
from graphql_api.types.issue import IssueType, _to_issue
from graphql_api.types.longform import LongformPostType, _to_post
from graphql_api.types.meeting import GranolaMeetingType, _to_granola
from graphql_api.types.news import NewsItemType, _to_news
from graphql_api.types.note import NoteType, _to_note
from graphql_api.types.person import PersonType, _to_person
from graphql_api.types.project import ProjectType, _to_project
from graphql_api.types.ramp import RampTransactionType, _to_txn
from graphql_api.types.search import SearchResults
from graphql_api.types.slack import SlackMessageType, _to_slack


@strawberry.type
class Query:
    @strawberry.field
    def person(self, info: Info, id: str) -> Optional[PersonType]:
        row = info.context.db.execute("SELECT * FROM people WHERE id = ?", (id,)).fetchone()
        return _to_person(dict(row)) if row else None

    @strawberry.field
    def people(
        self,
        info: Info,
        is_coworker: Optional[bool] = None,
        group: Optional[str] = None,
        limit: int = 200,
    ) -> list[PersonType]:
        query = "SELECT * FROM people WHERE 1=1"
        params: list = []
        if is_coworker is not None:
            query += " AND is_coworker = ?"
            params.append(int(is_coworker))
        if group:
            query += " AND group_name = ?"
            params.append(group)
        query += " ORDER BY name LIMIT ?"
        params.append(limit)
        rows = info.context.db.execute(query, params).fetchall()
        return [_to_person(dict(r)) for r in rows]

    @strawberry.field
    def note(self, info: Info, id: int) -> Optional[NoteType]:
        row = info.context.db.execute("SELECT * FROM notes WHERE id = ?", (id,)).fetchone()
        return _to_note(dict(row)) if row else None

    @strawberry.field
    def notes(
        self,
        info: Info,
        status: Optional[str] = None,
        person_id: Optional[str] = None,
        is_one_on_one: Optional[bool] = None,
        limit: int = 200,
    ) -> list[NoteType]:
        if person_id:
            query = "SELECT DISTINCT n.* FROM notes n JOIN note_people np ON n.id = np.note_id WHERE np.person_id = ?"
            params: list = [person_id]
        else:
            query = "SELECT * FROM notes WHERE 1=1"
            params = []
        if status:
            query += " AND status = ?"
            params.append(status)
        if is_one_on_one is not None:
            query += " AND is_one_on_one = ?"
            params.append(int(is_one_on_one))
        query += " ORDER BY priority DESC, created_at DESC LIMIT ?"
        params.append(limit)
        rows = info.context.db.execute(query, params).fetchall()
        return [_to_note(dict(r)) for r in rows]

    @strawberry.field
    def issue(self, info: Info, id: int) -> Optional[IssueType]:
        row = info.context.db.execute("SELECT * FROM issues WHERE id = ?", (id,)).fetchone()
        return _to_issue(dict(row)) if row else None

    @strawberry.field
    def issues(
        self,
        info: Info,
        status: Optional[str] = None,
        priority: Optional[int] = None,
        limit: int = 200,
    ) -> list[IssueType]:
        query = "SELECT * FROM issues WHERE 1=1"
        params: list = []
        if status:
            query += " AND status = ?"
            params.append(status)
        if priority is not None:
            query += " AND priority = ?"
            params.append(priority)
        query += " ORDER BY priority DESC, created_at DESC LIMIT ?"
        params.append(limit)
        rows = info.context.db.execute(query, params).fetchall()
        return [_to_issue(dict(r)) for r in rows]

    @strawberry.field
    def emails(self, info: Info, limit: int = 50) -> list[EmailType]:
        rows = info.context.db.execute("SELECT * FROM emails ORDER BY date DESC LIMIT ?", (limit,)).fetchall()
        return [_to_email(dict(r)) for r in rows]

    @strawberry.field
    def slack_messages(self, info: Info, limit: int = 50) -> list[SlackMessageType]:
        rows = info.context.db.execute("SELECT * FROM slack_messages ORDER BY ts DESC LIMIT ?", (limit,)).fetchall()
        return [_to_slack(dict(r)) for r in rows]

    @strawberry.field
    def calendar_events(
        self,
        info: Info,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        limit: int = 100,
    ) -> list[CalendarEventType]:
        query = "SELECT * FROM calendar_events WHERE 1=1"
        params: list = []
        if from_date:
            query += " AND start_time >= ?"
            params.append(from_date)
        if to_date:
            query += " AND start_time <= ?"
            params.append(to_date)
        query += " ORDER BY start_time DESC LIMIT ?"
        params.append(limit)
        rows = info.context.db.execute(query, params).fetchall()
        return [_to_event(dict(r)) for r in rows]

    @strawberry.field
    def granola_meetings(self, info: Info, limit: int = 50) -> list[GranolaMeetingType]:
        rows = info.context.db.execute(
            "SELECT * FROM granola_meetings ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [_to_granola(dict(r)) for r in rows]

    @strawberry.field
    def github_prs(self, info: Info, state: Optional[str] = None, limit: int = 50) -> list[GitHubPRType]:
        query = "SELECT * FROM github_pull_requests WHERE 1=1"
        params: list = []
        if state:
            query += " AND state = ?"
            params.append(state)
        query += " ORDER BY updated_at DESC LIMIT ?"
        params.append(limit)
        rows = info.context.db.execute(query, params).fetchall()
        return [_to_pr(dict(r)) for r in rows]

    @strawberry.field
    def drive_files(self, info: Info, limit: int = 50) -> list[DriveFileType]:
        rows = info.context.db.execute(
            "SELECT * FROM drive_files ORDER BY modified_time DESC LIMIT ?", (limit,)
        ).fetchall()
        return [_to_drive_file(dict(r)) for r in rows]

    @strawberry.field
    def ramp_transactions(self, info: Info, limit: int = 50) -> list[RampTransactionType]:
        rows = info.context.db.execute(
            "SELECT * FROM ramp_transactions ORDER BY transaction_date DESC LIMIT ?", (limit,)
        ).fetchall()
        return [_to_txn(dict(r)) for r in rows]

    @strawberry.field
    def projects(self, info: Info) -> list[ProjectType]:
        rows = info.context.db.execute("SELECT * FROM projects ORDER BY name").fetchall()
        return [_to_project(dict(r)) for r in rows]

    @strawberry.field
    def longform_posts(self, info: Info, status: Optional[str] = None, limit: int = 50) -> list[LongformPostType]:
        query = "SELECT * FROM longform_posts WHERE 1=1"
        params: list = []
        if status:
            query += " AND status = ?"
            params.append(status)
        query += " ORDER BY updated_at DESC LIMIT ?"
        params.append(limit)
        rows = info.context.db.execute(query, params).fetchall()
        return [_to_post(dict(r)) for r in rows]

    @strawberry.field
    def news(self, info: Info, limit: int = 20, offset: int = 0) -> list[NewsItemType]:
        rows = info.context.db.execute(
            "SELECT * FROM news_items ORDER BY found_at DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
        return [_to_news(dict(r)) for r in rows]

    @strawberry.field
    def search(self, info: Info, query: str, limit: int = 10) -> SearchResults:
        db = info.context.db
        people_results = []
        note_results = []
        issue_results = []
        email_results = []

        try:
            fts_query = query.replace('"', '""')

            # People
            rows = db.execute(
                "SELECT p.* FROM fts_people fp JOIN people p ON fp.rowid = p.rowid WHERE fts_people MATCH ? LIMIT ?",
                (fts_query, limit),
            ).fetchall()
            people_results = [_to_person(dict(r)) for r in rows]

            # Notes
            rows = db.execute(
                "SELECT n.* FROM fts_notes fn JOIN notes n ON fn.rowid = n.rowid WHERE fts_notes MATCH ? LIMIT ?",
                (fts_query, limit),
            ).fetchall()
            note_results = [_to_note(dict(r)) for r in rows]

            # Issues
            rows = db.execute(
                "SELECT i.* FROM fts_issues fi JOIN issues i ON fi.rowid = i.rowid WHERE fts_issues MATCH ? LIMIT ?",
                (fts_query, limit),
            ).fetchall()
            issue_results = [_to_issue(dict(r)) for r in rows]

            # Emails
            rows = db.execute(
                "SELECT e.* FROM fts_emails fe JOIN emails e ON fe.rowid = e.rowid WHERE fts_emails MATCH ? LIMIT ?",
                (fts_query, limit),
            ).fetchall()
            email_results = [_to_email(dict(r)) for r in rows]
        except Exception:
            # FTS tables may not exist yet
            pass

        total = len(people_results) + len(note_results) + len(issue_results) + len(email_results)
        return SearchResults(
            query=query,
            people=people_results,
            notes=note_results,
            issues=issue_results,
            emails=email_results,
            total=total,
        )


@strawberry.type
class Mutation:
    @strawberry.mutation
    def create_note(
        self,
        info: Info,
        text: str,
        priority: int = 0,
        person_ids: Optional[list[str]] = None,
        is_one_on_one: bool = False,
        due_date: Optional[str] = None,
    ) -> NoteType:
        from models import NoteCreate
        from routers.notes import create_note as _create

        note = NoteCreate(
            text=text,
            priority=priority,
            person_ids=person_ids,
            is_one_on_one=is_one_on_one,
            due_date=due_date,
        )
        result = _create(note)
        return _to_note(result)

    @strawberry.mutation
    def update_note(
        self,
        info: Info,
        id: int,
        text: Optional[str] = None,
        status: Optional[str] = None,
        priority: Optional[int] = None,
        person_ids: Optional[list[str]] = None,
        due_date: Optional[str] = None,
    ) -> NoteType:
        from models import NoteUpdate
        from routers.notes import update_note as _update

        fields = {}
        if text is not None:
            fields["text"] = text
        if status is not None:
            fields["status"] = status
        if priority is not None:
            fields["priority"] = priority
        if person_ids is not None:
            fields["person_ids"] = person_ids
        if due_date is not None:
            fields["due_date"] = due_date
        update = NoteUpdate(**fields)
        result = _update(id, update)
        return _to_note(result)

    @strawberry.mutation
    def delete_note(self, info: Info, id: int) -> bool:
        from routers.notes import delete_note as _delete

        _delete(id)
        return True

    @strawberry.mutation
    def create_issue(
        self,
        info: Info,
        title: str,
        description: str = "",
        priority: int = 1,
        tshirt_size: str = "m",
        person_ids: Optional[list[str]] = None,
        tags: Optional[list[str]] = None,
        due_date: Optional[str] = None,
    ) -> IssueType:
        from models import IssueCreate
        from routers.issues import create_issue as _create

        issue = IssueCreate(
            title=title,
            description=description,
            priority=priority,
            tshirt_size=tshirt_size,
            person_ids=person_ids,
            tags=tags,
            due_date=due_date,
        )
        result = _create(issue)
        return _to_issue(result)

    @strawberry.mutation
    def update_issue(
        self,
        info: Info,
        id: int,
        title: Optional[str] = None,
        description: Optional[str] = None,
        status: Optional[str] = None,
        priority: Optional[int] = None,
        tshirt_size: Optional[str] = None,
        tags: Optional[list[str]] = None,
        due_date: Optional[str] = None,
    ) -> IssueType:
        from models import IssueUpdate
        from routers.issues import update_issue as _update

        fields = {}
        if title is not None:
            fields["title"] = title
        if description is not None:
            fields["description"] = description
        if status is not None:
            fields["status"] = status
        if priority is not None:
            fields["priority"] = priority
        if tshirt_size is not None:
            fields["tshirt_size"] = tshirt_size
        if tags is not None:
            fields["tags"] = tags
        if due_date is not None:
            fields["due_date"] = due_date
        update = IssueUpdate(**fields)
        result = _update(id, update)
        return _to_issue(result)

    @strawberry.mutation
    def create_longform_post(
        self,
        info: Info,
        title: str = "Untitled",
        body: str = "",
        status: str = "draft",
        tags: Optional[list[str]] = None,
    ) -> LongformPostType:
        from models import LongformCreate
        from routers.longform import create_post as _create

        post = LongformCreate(title=title, body=body, status=status, tags=tags)
        result = _create(post)
        return _to_post(result)

    @strawberry.mutation
    def update_longform_post(
        self,
        info: Info,
        id: int,
        title: Optional[str] = None,
        body: Optional[str] = None,
        status: Optional[str] = None,
        tags: Optional[list[str]] = None,
    ) -> LongformPostType:
        from models import LongformUpdate
        from routers.longform import update_post as _update

        fields = {}
        if title is not None:
            fields["title"] = title
        if body is not None:
            fields["body"] = body
        if status is not None:
            fields["status"] = status
        if tags is not None:
            fields["tags"] = tags
        update = LongformUpdate(**fields)
        result = _update(id, update)
        return _to_post(result)

    # --- External service mutations ---

    @strawberry.mutation
    def send_slack_message(
        self,
        info: Info,
        channel: str,
        text: str,
        thread_ts: Optional[str] = None,
    ) -> bool:
        from routers.slack_api import SlackMessage, send_message

        send_message(SlackMessage(channel=channel, text=text, thread_ts=thread_ts))
        return True

    @strawberry.mutation
    def add_slack_reaction(self, info: Info, channel: str, ts: str, name: str) -> bool:
        from models import SlackReaction
        from routers.slack_api import add_reaction

        add_reaction(SlackReaction(channel=channel, ts=ts, name=name))
        return True

    @strawberry.mutation
    def create_notion_page(
        self,
        info: Info,
        parent_id: str,
        title: str,
        parent_type: str = "database_id",
    ) -> bool:
        from models import NotionPageCreate
        from routers.notion_api import create_page

        create_page(NotionPageCreate(parent_id=parent_id, title=title, parent_type=parent_type))
        return True

    @strawberry.mutation
    def append_notion_text(self, info: Info, page_id: str, text: str) -> bool:
        from models import NotionBlockAppend
        from routers.notion_api import append_blocks

        append_blocks(page_id, NotionBlockAppend(text=text))
        return True

    @strawberry.mutation
    def archive_notion_page(self, info: Info, page_id: str) -> bool:
        from routers.notion_api import archive_page

        archive_page(page_id)
        return True

    @strawberry.mutation
    def send_email(
        self,
        info: Info,
        to: str,
        subject: str,
        body: str,
        cc: Optional[str] = None,
        reply_to_thread_id: Optional[str] = None,
    ) -> bool:
        from models import GmailSend
        from routers.gmail import send_email as _send

        _send(GmailSend(to=to, subject=subject, body=body, cc=cc, reply_to_thread_id=reply_to_thread_id))
        return True

    @strawberry.mutation
    def archive_emails(self, info: Info, message_ids: list[str]) -> bool:
        from models import GmailArchive
        from routers.gmail import archive_messages

        archive_messages(GmailArchive(message_ids=message_ids))
        return True

    @strawberry.mutation
    def create_calendar_event(
        self,
        info: Info,
        summary: str,
        start_time: str,
        end_time: str,
        description: Optional[str] = None,
        attendees: Optional[list[str]] = None,
        location: Optional[str] = None,
    ) -> bool:
        from models import CalendarEventCreate
        from routers.calendar_api import create_event

        create_event(
            CalendarEventCreate(
                summary=summary,
                start_time=start_time,
                end_time=end_time,
                description=description,
                attendees=attendees,
                location=location,
            )
        )
        return True

    @strawberry.mutation
    def delete_calendar_event(self, info: Info, event_id: str) -> bool:
        from routers.calendar_api import delete_event

        delete_event(event_id)
        return True

    @strawberry.mutation
    def rsvp_calendar_event(self, info: Info, event_id: str, response: str) -> bool:
        from models import CalendarRSVP
        from routers.calendar_api import rsvp_event

        rsvp_event(event_id, CalendarRSVP(response=response))
        return True

    @strawberry.mutation
    def create_google_doc(self, info: Info, title: str, body: Optional[str] = None) -> bool:
        from models import GoogleDocCreate
        from routers.drive_api import create_doc

        create_doc(GoogleDocCreate(title=title, body=body))
        return True

    @strawberry.mutation
    def append_to_google_doc(self, info: Info, doc_id: str, text: str) -> bool:
        from models import GoogleDocAppend
        from routers.drive_api import append_to_doc

        append_to_doc(doc_id, GoogleDocAppend(text=text))
        return True

    @strawberry.mutation
    def append_sheet_rows(
        self,
        info: Info,
        sheet_id: str,
        values: list[list[str]],
        range: str = "Sheet1",
    ) -> bool:
        from models import SheetsAppendRows
        from routers.sheets_api import append_rows

        append_rows(sheet_id, SheetsAppendRows(range=range, values=values))
        return True

    @strawberry.mutation
    def update_sheet_cells(
        self,
        info: Info,
        sheet_id: str,
        range: str,
        values: list[list[str]],
    ) -> bool:
        from models import SheetsCellUpdate
        from routers.sheets_api import update_cells

        update_cells(sheet_id, SheetsCellUpdate(range=range, values=values))
        return True
