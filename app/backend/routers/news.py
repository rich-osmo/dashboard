from fastapi import APIRouter, Query
from database import get_db

router = APIRouter(prefix="/api/news", tags=["news"])


@router.get("")
def get_news(
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """Return paginated news items, newest first."""
    db = get_db()

    rows = db.execute(
        """SELECT * FROM news_items
           ORDER BY COALESCE(published_at, found_at) DESC
           LIMIT ? OFFSET ?""",
        (limit, offset),
    ).fetchall()

    total = db.execute("SELECT COUNT(*) as count FROM news_items").fetchone()["count"]

    db.close()

    return {
        "items": [dict(r) for r in rows],
        "total": total,
        "offset": offset,
        "limit": limit,
        "has_more": offset + limit < total,
    }
