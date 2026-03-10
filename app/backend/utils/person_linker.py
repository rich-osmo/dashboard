"""Post-sync person linking service.

Populates knowledge graph link tables (email_people, calendar_event_people,
drive_file_people) and person_id columns (slack_messages, github_pull_requests,
ramp_transactions) using the person_matching module.

All functions are idempotent — safe to run multiple times.
"""

import json
import logging
import re

from database import get_db_connection, get_write_db
from utils.person_matching import (
    match_email_to_person,
    match_name_to_person,
)

logger = logging.getLogger(__name__)


def link_all():
    """Link all synced records to people. Called after full sync."""
    for fn in [
        link_emails,
        link_slack_messages,
        link_calendar_events,
        link_github_prs,
        link_drive_files,
        link_ramp_transactions,
    ]:
        try:
            fn()
        except Exception:
            logger.exception("Person linking failed for %s", fn.__name__)


def link_emails():
    """Match emails to people via from_email and to_emails fields."""
    with get_db_connection(readonly=True) as db:
        rows = db.execute("SELECT id, from_email, to_emails FROM emails").fetchall()

    inserts = []
    for row in rows:
        email_id = row["id"]

        # Match sender
        if row["from_email"]:
            person_id = match_email_to_person(row["from_email"])
            if person_id:
                inserts.append((email_id, person_id, "from"))

        # Match recipients — to_emails is a raw header string like "a@b.com, c@d.com"
        to_str = row["to_emails"] or ""
        for addr in _parse_email_addresses(to_str):
            person_id = match_email_to_person(addr)
            if person_id:
                inserts.append((email_id, person_id, "to"))

    if inserts:
        with get_write_db() as db:
            db.executemany(
                "INSERT OR IGNORE INTO email_people (email_id, person_id, role) VALUES (?, ?, ?)",
                inserts,
            )
            db.commit()
        logger.info("Linked %d email↔person edges", len(inserts))


def link_slack_messages():
    """Match slack DMs to people via user_name."""
    with get_db_connection(readonly=True) as db:
        rows = db.execute(
            "SELECT id, user_name FROM slack_messages WHERE person_id IS NULL AND user_name IS NOT NULL"
        ).fetchall()

    updates = []
    for row in rows:
        person_id = match_name_to_person(row["user_name"])
        if person_id:
            updates.append((person_id, row["id"]))

    if updates:
        with get_write_db() as db:
            db.executemany(
                "UPDATE slack_messages SET person_id = ? WHERE id = ?",
                updates,
            )
            db.commit()
        logger.info("Linked %d slack messages to people", len(updates))


def link_calendar_events():
    """Match calendar attendees to people."""
    with get_db_connection(readonly=True) as db:
        rows = db.execute("SELECT id, attendees_json FROM calendar_events WHERE attendees_json IS NOT NULL").fetchall()

    inserts = []
    for row in rows:
        try:
            attendees = json.loads(row["attendees_json"])
        except (json.JSONDecodeError, TypeError):
            continue

        for attendee in attendees:
            email = attendee.get("email", "")
            name = attendee.get("name", "")
            response_status = attendee.get("responseStatus") or attendee.get("response_status")

            person_id = match_email_to_person(email) if email else None
            if not person_id and name:
                person_id = match_name_to_person(name)
            if person_id:
                inserts.append((row["id"], person_id, response_status))

    if inserts:
        with get_write_db() as db:
            db.executemany(
                "INSERT OR IGNORE INTO calendar_event_people (event_id, person_id, response_status) VALUES (?, ?, ?)",
                inserts,
            )
            db.commit()
        logger.info("Linked %d calendar event↔person edges", len(inserts))


def link_github_prs():
    """Match GitHub PR authors to people via username."""
    with get_db_connection(readonly=True) as db:
        rows = db.execute(
            "SELECT id, author FROM github_pull_requests WHERE person_id IS NULL AND author IS NOT NULL"
        ).fetchall()

    updates = []
    for row in rows:
        person_id = match_name_to_person(row["author"])
        if person_id:
            updates.append((person_id, row["id"]))

    if updates:
        with get_write_db() as db:
            db.executemany(
                "UPDATE github_pull_requests SET person_id = ? WHERE id = ?",
                updates,
            )
            db.commit()
        logger.info("Linked %d GitHub PRs to people", len(updates))


def link_drive_files():
    """Match drive file owners/modifiers to people."""
    with get_db_connection(readonly=True) as db:
        rows = db.execute("SELECT id, owner_email, modified_by_email FROM drive_files").fetchall()

    inserts = []
    for row in rows:
        file_id = row["id"]

        if row["owner_email"]:
            person_id = match_email_to_person(row["owner_email"])
            if person_id:
                inserts.append((file_id, person_id, "owner"))

        if row["modified_by_email"]:
            person_id = match_email_to_person(row["modified_by_email"])
            if person_id:
                inserts.append((file_id, person_id, "modifier"))

    if inserts:
        with get_write_db() as db:
            db.executemany(
                "INSERT OR IGNORE INTO drive_file_people (file_id, person_id, role) VALUES (?, ?, ?)",
                inserts,
            )
            db.commit()
        logger.info("Linked %d drive file↔person edges", len(inserts))


def link_ramp_transactions():
    """Match Ramp transactions to people via cardholder email/name."""
    with get_db_connection(readonly=True) as db:
        rows = db.execute(
            "SELECT id, cardholder_email, cardholder_name FROM ramp_transactions WHERE person_id IS NULL"
        ).fetchall()

    updates = []
    for row in rows:
        person_id = None
        if row["cardholder_email"]:
            person_id = match_email_to_person(row["cardholder_email"])
        if not person_id and row["cardholder_name"]:
            person_id = match_name_to_person(row["cardholder_name"])
        if person_id:
            updates.append((person_id, row["id"]))

    if updates:
        with get_write_db() as db:
            db.executemany(
                "UPDATE ramp_transactions SET person_id = ? WHERE id = ?",
                updates,
            )
            db.commit()
        logger.info("Linked %d Ramp transactions to people", len(updates))


def _parse_email_addresses(header: str) -> list[str]:
    """Extract email addresses from a To/CC header string."""
    # Match anything that looks like an email
    return re.findall(r"[\w.+-]+@[\w.-]+\.\w+", header)
