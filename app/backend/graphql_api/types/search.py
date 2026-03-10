"""SearchResults type for full-text search across all entities."""

import strawberry

from graphql_api.types.email import EmailType
from graphql_api.types.issue import IssueType
from graphql_api.types.note import NoteType
from graphql_api.types.person import PersonType


@strawberry.type
class SearchResults:
    people: list[PersonType]
    notes: list[NoteType]
    issues: list[IssueType]
    emails: list[EmailType]
    query: str
    total: int = 0
