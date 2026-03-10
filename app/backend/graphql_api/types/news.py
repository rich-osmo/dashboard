"""NewsItemType — aggregated news feed."""

from typing import Optional

import strawberry


@strawberry.type
class NewsItemType:
    id: str
    title: Optional[str] = None
    url: Optional[str] = None
    source: Optional[str] = None
    source_detail: Optional[str] = None
    domain: Optional[str] = None
    snippet: Optional[str] = None
    found_at: Optional[str] = None
    published_at: Optional[str] = None


def _to_news(row: dict) -> NewsItemType:
    return NewsItemType(
        id=row["id"],
        title=row.get("title"),
        url=row.get("url"),
        source=row.get("source"),
        source_detail=row.get("source_detail"),
        domain=row.get("domain"),
        snippet=row.get("snippet"),
        found_at=row.get("found_at"),
        published_at=row.get("published_at"),
    )
