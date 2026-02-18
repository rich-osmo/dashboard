import json
import os
from datetime import datetime

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


# --- Gemini-ranked news ---

_NEWS_RANK_PROMPT = """\
You are a priority-ranking assistant for Rich, the CTO of Osmo (a Series B chemical/scent \
technology company using AI and machine learning for molecular design and digital olfaction).

You will receive a list of recent news articles. Rank them by relevance and importance to Rich.

For each article, assign a priority_score from 1-10 where:
- 10: Directly about Osmo, digital olfaction, or a major competitor
- 7-9: Highly relevant (AI in chemistry, computational molecular design, scent tech breakthroughs, \
key industry moves, Series B/startup scaling insights from top sources)
- 4-6: Moderately relevant (general AI/ML advances, chemical industry news, startup/CTO content, \
interesting tech trends)
- 1-3: Low relevance (generic tech news, unrelated industries, clickbait, automated aggregator junk)

Consider:
1. Articles about olfaction, scent, fragrance tech, or molecular design are top priority
2. AI/ML applied to chemistry or biology is high priority
3. Startup leadership, scaling engineering orgs, CTO-relevant content is medium-high
4. General tech/AI news is medium
5. Clickbait, listicles, and generic business news are low
6. Duplicate or near-duplicate articles should score lower

Return ONLY valid JSON — an array of objects with keys: id, priority_score, reason (one short sentence).
Order by priority_score descending. Return ALL articles provided, scored."""


def _rank_news_with_gemini(articles: list[dict]) -> list[dict]:
    """Call Gemini to rank news articles by priority."""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return []

    from google import genai

    client = genai.Client(api_key=api_key)
    now = datetime.now().strftime("%A, %B %d %Y, %I:%M %p")
    user_message = f"Current time: {now}\n\nNews articles to rank:\n{json.dumps(articles, default=str)}"

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=user_message,
        config={
            "system_instruction": _NEWS_RANK_PROMPT,
            "temperature": 0.2,
            "response_mime_type": "application/json",
        },
    )

    try:
        items = json.loads(response.text)
        if isinstance(items, list):
            return items
    except (json.JSONDecodeError, TypeError):
        pass
    return []


def _dismissed_news_ids(db) -> set[str]:
    rows = db.execute("SELECT item_id FROM dismissed_dashboard_items WHERE source = 'news'").fetchall()
    return {r["item_id"] for r in rows}


def _published_within_days(published_at: str | None, days: int) -> bool:
    """Check if a published_at timestamp is within N days of now."""
    if not published_at:
        return True  # keep items with no date
    try:
        dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        delta = datetime.now(dt.tzinfo) - dt
        return delta.days <= days
    except (ValueError, TypeError):
        return True


@router.get("/prioritized")
def get_prioritized_news(refresh: bool = Query(False), days: int = Query(14, ge=1, le=90)):
    """Return news articles ranked by Gemini priority score."""
    db = get_db()
    dismissed = _dismissed_news_ids(db)
    cutoff = f"-{days} days"

    # Check cache first
    if not refresh:
        cached = db.execute(
            "SELECT data_json, generated_at FROM cached_news_priorities ORDER BY id DESC LIMIT 1"
        ).fetchone()
        if cached:
            data = json.loads(cached["data_json"])
            data["items"] = [
                item
                for item in data.get("items", [])
                if item["id"] not in dismissed and _published_within_days(item.get("published_at"), days)
            ]
            db.close()
            return data

    # Fetch recent news from DB
    rows = db.execute(
        """SELECT id, title, url, source, source_detail, domain, snippet, published_at, found_at
           FROM news_items
           WHERE COALESCE(published_at, found_at) >= datetime('now', ?)
           ORDER BY COALESCE(published_at, found_at) DESC
           LIMIT 150""",
        (cutoff,),
    ).fetchall()

    if not rows:
        db.close()
        return {"items": [], "error": "No news items synced yet"}

    articles_for_llm = [
        {
            "id": r["id"],
            "title": r["title"],
            "domain": r["domain"],
            "source": r["source"],
            "snippet": (r["snippet"] or "")[:300],
        }
        for r in rows
    ]

    try:
        ranked = _rank_news_with_gemini(articles_for_llm)
    except Exception as e:
        db.close()
        return {"items": [], "error": str(e)}

    # Build lookup of full article data
    article_lookup = {r["id"]: dict(r) for r in rows}

    # Merge rankings with full article data
    items = []
    for rank in ranked:
        article_id = rank.get("id", "")
        article = article_lookup.get(article_id)
        if not article:
            continue
        items.append(
            {
                "id": article["id"],
                "title": article["title"],
                "url": article["url"],
                "source": article["source"],
                "source_detail": article["source_detail"],
                "domain": article["domain"],
                "snippet": article["snippet"],
                "published_at": article["published_at"],
                "found_at": article["found_at"],
                "priority_score": rank.get("priority_score", 5),
                "priority_reason": rank.get("reason", ""),
            }
        )

    # Sort by score desc, filter dismissed
    items.sort(key=lambda x: x["priority_score"], reverse=True)
    items = [i for i in items if i["id"] not in dismissed]

    result = {"items": items}

    # Cache result
    db.execute("DELETE FROM cached_news_priorities")
    db.execute(
        "INSERT INTO cached_news_priorities (data_json) VALUES (?)",
        (json.dumps(result),),
    )
    db.commit()
    db.close()

    return result
