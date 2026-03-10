"""Live Google Calendar API endpoints for searching and reading events."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from googleapiclient.discovery import build

from connectors.google_auth import get_google_credentials
from models import CalendarEventCreate, CalendarEventUpdate, CalendarRSVP

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


def _get_service():
    try:
        creds = get_google_credentials()
        return build("calendar", "v3", credentials=creds)
    except Exception as e:
        logger.error("Calendar not authenticated: %s", e)
        raise HTTPException(status_code=503, detail="Calendar not authenticated")


def _event_to_dict(event: dict) -> dict:
    start = event.get("start", {})
    end = event.get("end", {})

    attendees = []
    for a in event.get("attendees", []):
        attendees.append(
            {
                "email": a.get("email", ""),
                "name": a.get("displayName", ""),
                "response": a.get("responseStatus", ""),
                "self": a.get("self", False),
            }
        )

    return {
        "id": event["id"],
        "summary": event.get("summary", "(No title)"),
        "description": event.get("description", ""),
        "location": event.get("location", ""),
        "start_time": start.get("dateTime", start.get("date", "")),
        "end_time": end.get("dateTime", end.get("date", "")),
        "all_day": "date" in start and "dateTime" not in start,
        "attendees": attendees,
        "organizer_email": event.get("organizer", {}).get("email", ""),
        "html_link": event.get("htmlLink", ""),
        "status": event.get("status", ""),
        "recurring_event_id": event.get("recurringEventId"),
        "conference_data": event.get("conferenceData", {}).get("entryPoints", []),
    }


@router.get("/search")
def search_calendar(
    q: Optional[str] = Query(None, description="Text search across event fields"),
    start: Optional[str] = Query(None, description="Start date/time (ISO format)"),
    end: Optional[str] = Query(None, description="End date/time (ISO format)"),
    max_results: int = Query(50, ge=1, le=250),
):
    """Search calendar events by text and/or date range."""
    service = _get_service()

    now = datetime.now(timezone.utc)
    time_min = start if start else (now - timedelta(days=30)).isoformat()
    time_max = end if end else (now + timedelta(days=30)).isoformat()

    try:
        kwargs = {
            "calendarId": "primary",
            "timeMin": time_min,
            "timeMax": time_max,
            "maxResults": max_results,
            "singleEvents": True,
            "orderBy": "startTime",
        }
        if q:
            kwargs["q"] = q

        events_result = service.events().list(**kwargs).execute()
    except Exception as e:
        logger.error("Calendar search failed: %s", e)
        raise HTTPException(status_code=500, detail="Calendar search failed")

    events = [_event_to_dict(e) for e in events_result.get("items", [])]
    return {"query": q, "time_range": {"start": time_min, "end": time_max}, "count": len(events), "events": events}


@router.get("/event/{event_id}")
def get_event(event_id: str):
    """Get a single calendar event with full details."""
    service = _get_service()
    try:
        event = service.events().get(calendarId="primary", eventId=event_id).execute()
    except Exception as e:
        logger.error("Calendar event not found: %s", e)
        raise HTTPException(status_code=404, detail="Event not found")

    return _event_to_dict(event)


# --- Write endpoints ---


@router.post("/events")
def create_event(event: CalendarEventCreate):
    """Create a new calendar event."""
    service = _get_service()
    body: dict = {"summary": event.summary}

    if event.all_day:
        body["start"] = {"date": event.start_time[:10]}
        body["end"] = {"date": event.end_time[:10]}
    else:
        body["start"] = {"dateTime": event.start_time}
        body["end"] = {"dateTime": event.end_time}

    if event.description:
        body["description"] = event.description
    if event.location:
        body["location"] = event.location
    if event.attendees:
        body["attendees"] = [{"email": e} for e in event.attendees]

    try:
        result = (
            service.events()
            .insert(
                calendarId="primary",
                body=body,
                sendNotifications=event.send_notifications,
            )
            .execute()
        )
    except Exception as e:
        logger.error("Failed to create event: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create event")
    return _event_to_dict(result)


@router.patch("/events/{event_id}")
def update_event(event_id: str, event: CalendarEventUpdate):
    """Update an existing calendar event (partial update)."""
    service = _get_service()
    body: dict = {}
    if event.summary is not None:
        body["summary"] = event.summary
    if event.description is not None:
        body["description"] = event.description
    if event.location is not None:
        body["location"] = event.location
    if event.start_time is not None:
        body["start"] = {"dateTime": event.start_time}
    if event.end_time is not None:
        body["end"] = {"dateTime": event.end_time}
    if event.attendees is not None:
        body["attendees"] = [{"email": e} for e in event.attendees]

    try:
        result = (
            service.events()
            .patch(
                calendarId="primary",
                eventId=event_id,
                body=body,
                sendNotifications=event.send_notifications,
            )
            .execute()
        )
    except Exception as e:
        logger.error("Failed to update event: %s", e)
        raise HTTPException(status_code=500, detail="Failed to update event")
    return _event_to_dict(result)


@router.delete("/events/{event_id}")
def delete_event(event_id: str, send_notifications: bool = Query(True)):
    """Delete a calendar event."""
    service = _get_service()
    try:
        service.events().delete(
            calendarId="primary",
            eventId=event_id,
            sendNotifications=send_notifications,
        ).execute()
    except Exception as e:
        logger.error("Failed to delete event: %s", e)
        raise HTTPException(status_code=500, detail="Failed to delete event")
    return {"ok": True, "event_id": event_id}


@router.post("/events/{event_id}/rsvp")
def rsvp_event(event_id: str, rsvp: CalendarRSVP):
    """RSVP to a calendar event (accepted/declined/tentative)."""
    service = _get_service()
    try:
        event = service.events().get(calendarId="primary", eventId=event_id).execute()
    except Exception as e:
        logger.error("Event not found: %s", e)
        raise HTTPException(status_code=404, detail="Event not found")

    attendees = event.get("attendees", [])
    updated = False
    for a in attendees:
        if a.get("self"):
            a["responseStatus"] = rsvp.response
            updated = True
            break

    if not updated:
        raise HTTPException(status_code=400, detail="You are not an attendee of this event")

    try:
        result = (
            service.events()
            .patch(
                calendarId="primary",
                eventId=event_id,
                body={"attendees": attendees},
            )
            .execute()
        )
    except Exception as e:
        logger.error("Failed to RSVP: %s", e)
        raise HTTPException(status_code=500, detail="Failed to RSVP")
    return _event_to_dict(result)
