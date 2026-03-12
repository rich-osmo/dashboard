"""Dashboard dismiss/undismiss endpoints for prioritized items."""

from fastapi import APIRouter
from pydantic import BaseModel

from database import get_write_db

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


class DismissBody(BaseModel):
    source: str
    item_id: str


@router.post("/dismiss")
def dismiss_item(body: DismissBody):
    with get_write_db() as db:
        db.execute(
            "INSERT OR IGNORE INTO dismissed_dashboard_items (source, item_id) VALUES (?, ?)",
            (body.source, body.item_id),
        )
        db.commit()
    return {"ok": True}


@router.post("/undismiss")
def undismiss_item(body: DismissBody):
    with get_write_db() as db:
        db.execute(
            "DELETE FROM dismissed_dashboard_items WHERE source = ? AND item_id = ?",
            (body.source, body.item_id),
        )
        db.commit()
    return {"ok": True}
