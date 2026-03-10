"""GraphQL request context — DB connection and DataLoaders."""

from __future__ import annotations

import dataclasses
import sqlite3
from typing import TYPE_CHECKING

from database import get_db

if TYPE_CHECKING:
    from graphql_api.loaders import Loaders


@dataclasses.dataclass
class GraphQLContext:
    db: sqlite3.Connection
    loaders: Loaders


def get_context() -> GraphQLContext:
    from graphql_api.loaders import Loaders

    db = get_db()
    return GraphQLContext(db=db, loaders=Loaders(db))
