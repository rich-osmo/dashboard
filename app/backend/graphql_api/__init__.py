"""GraphQL API — Strawberry schema and FastAPI router."""

import strawberry
from strawberry.fastapi import GraphQLRouter

from graphql_api.context import get_context
from graphql_api.resolvers import Mutation, Query
from graphql_api.types.calendar import CalendarEventType
from graphql_api.types.drive import DriveFileType
from graphql_api.types.email import EmailType
from graphql_api.types.github import GitHubPRType
from graphql_api.types.issue import IssueType
from graphql_api.types.longform import LongformCommentType, LongformPostType
from graphql_api.types.meeting import GranolaMeetingType, MeetingFileType
from graphql_api.types.news import NewsItemType
from graphql_api.types.note import NoteType
from graphql_api.types.person import PersonType
from graphql_api.types.project import ProjectType
from graphql_api.types.ramp import RampBillType, RampTransactionType
from graphql_api.types.search import SearchResults
from graphql_api.types.slack import SlackMessageType

schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    types=[
        PersonType,
        NoteType,
        IssueType,
        EmailType,
        SlackMessageType,
        CalendarEventType,
        GranolaMeetingType,
        MeetingFileType,
        GitHubPRType,
        DriveFileType,
        RampTransactionType,
        RampBillType,
        ProjectType,
        LongformPostType,
        LongformCommentType,
        NewsItemType,
        SearchResults,
    ],
)

graphql_app = GraphQLRouter(schema, context_getter=get_context)
