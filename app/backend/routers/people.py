import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException

from config import EXECUTIVES_DIR, HIDDEN_TEAMS_DIR, TEAMS_DIR
from database import get_db_connection, get_write_db
from models import (
    OneOnOneNoteCreate,
    OneOnOneNoteUpdate,
    PersonAttributeCreate,
    PersonConnectionCreate,
    PersonCreate,
    PersonLinkCreate,
    PersonUpdate,
)
from utils.person_matching import get_person_email_patterns, rebuild_from_db
from utils.safe_sql import safe_update_query

PERSON_ALLOWED_COLUMNS = {
    "name",
    "title",
    "reports_to",
    "group_name",
    "email",
    "role_content",
    "is_coworker",
    "company",
    "phone",
    "bio",
    "linkedin_url",
}
ONE_ON_ONE_NOTE_ALLOWED_COLUMNS = {"meeting_date", "title", "content"}

router = APIRouter(prefix="/api/people", tags=["people"])


def _enforce_team_coworker_rule(
    group_name: Optional[str], is_coworker: Optional[bool], current_is_coworker: bool = True
):
    """Enforce: 'team' group requires is_coworker = True."""
    effective_coworker = is_coworker if is_coworker is not None else current_is_coworker
    if group_name == "team" and not effective_coworker:
        raise HTTPException(
            status_code=400,
            detail="The 'team' group requires coworker status. Set is_coworker to true or choose a different group.",
        )


@router.get("")
def list_people(
    is_coworker: Optional[bool] = None,
    group: Optional[str] = None,
):
    with get_db_connection(readonly=True) as db:
        query = (
            "SELECT id, name, title, reports_to, depth, has_meetings_dir, is_executive, "
            "group_name, email, is_coworker, company, phone, bio, linkedin_url, source "
            "FROM people"
        )
        conditions = []
        params = []
        if is_coworker is not None:
            conditions.append("is_coworker = ?")
            params.append(int(is_coworker))
        if group:
            conditions.append("group_name = ?")
            params.append(group)
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY name"
        rows = db.execute(query, params).fetchall()
    return [dict(r) for r in rows]


@router.get("/groups")
def list_groups():
    """Return distinct group_name values, 'team' always first."""
    with get_db_connection(readonly=True) as db:
        rows = db.execute(
            "SELECT DISTINCT group_name FROM people WHERE group_name IS NOT NULL ORDER BY group_name"
        ).fetchall()
    groups = [r["group_name"] for r in rows]
    if "team" in groups:
        groups.remove("team")
    return ["team"] + groups


@router.patch("/groups/{group_name}")
def rename_group(group_name: str, body: dict):
    """Rename a group by updating all people with that group_name."""
    new_name = (body.get("new_name") or "").strip().lower()
    if not new_name:
        raise HTTPException(status_code=400, detail="new_name must not be empty")
    if group_name == "team":
        raise HTTPException(status_code=400, detail="Cannot rename the 'team' group")
    with get_write_db() as db:
        count = db.execute("SELECT COUNT(*) as c FROM people WHERE group_name = ?", (group_name,)).fetchone()["c"]
        if count == 0:
            raise HTTPException(status_code=404, detail=f"No people in group '{group_name}'")
        db.execute(
            "UPDATE people SET group_name = ? WHERE group_name = ?",
            (new_name, group_name),
        )
        db.commit()
    rebuild_from_db()
    return {"status": "renamed", "old_name": group_name, "new_name": new_name}


@router.post("")
def create_person(person: PersonCreate):
    # Auto-generate ID from name if not provided
    person_id = person.id or person.name.strip().replace(" ", "_")

    # Default group logic
    if person.is_coworker:
        group = person.group_name or "team"
        if not group.strip():
            group = "team"
    else:
        group = person.group_name if person.group_name and person.group_name != "team" else None

    _enforce_team_coworker_rule(group, person.is_coworker)

    with get_write_db() as db:
        # Validate reports_to exists if provided
        if person.reports_to:
            exists = db.execute("SELECT 1 FROM people WHERE id = ?", (person.reports_to,)).fetchone()
            if not exists:
                raise HTTPException(status_code=400, detail=f"reports_to person '{person.reports_to}' not found")

        # Check for duplicate ID
        existing = db.execute("SELECT 1 FROM people WHERE id = ?", (person_id,)).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail=f"Person '{person_id}' already exists")

        db.execute(
            """INSERT INTO people
               (id, name, title, reports_to, group_name, email, dir_path, is_executive,
                is_coworker, company, phone, bio, linkedin_url, source, created_at)
               VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                person_id,
                person.name.strip(),
                person.title,
                person.reports_to,
                group,
                person.email,
                0,
                int(person.is_coworker),
                person.company,
                person.phone,
                person.bio,
                person.linkedin_url,
                "manual",
                datetime.now().isoformat(),
            ),
        )
        db.commit()
        row = db.execute("SELECT * FROM people WHERE id = ?", (person_id,)).fetchone()
    rebuild_from_db()
    return dict(row)


@router.patch("/{person_id}")
def update_person(person_id: str, update: PersonUpdate):
    with get_write_db() as db:
        row = db.execute("SELECT * FROM people WHERE id = ?", (person_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Person not found")

        update_fields = {}
        for field, value in update.model_dump(exclude_unset=True).items():
            if field == "group_name" and value is not None and not value.strip():
                raise HTTPException(status_code=400, detail="group_name must not be empty")
            if field == "reports_to" and value is not None:
                if value == person_id:
                    raise HTTPException(status_code=400, detail="Person cannot report to themselves")
                exists = db.execute("SELECT 1 FROM people WHERE id = ?", (value,)).fetchone()
                if not exists:
                    raise HTTPException(status_code=400, detail=f"reports_to person '{value}' not found")
                # Walk chain to detect cycles
                current = value
                while current:
                    parent = db.execute("SELECT reports_to FROM people WHERE id = ?", (current,)).fetchone()
                    if not parent or not parent["reports_to"]:
                        break
                    if parent["reports_to"] == person_id:
                        raise HTTPException(status_code=400, detail="Circular reporting chain detected")
                    current = parent["reports_to"]
            update_fields[field] = value

        if not update_fields:
            return dict(row)

        # Enforce team/coworker rule
        new_group = update_fields.get("group_name", row["group_name"])
        new_coworker = update_fields.get("is_coworker")
        if new_coworker is not None:
            update_fields["is_coworker"] = int(new_coworker)
        _enforce_team_coworker_rule(new_group, new_coworker, bool(row["is_coworker"]))

        set_clause, params = safe_update_query("people", update_fields, PERSON_ALLOWED_COLUMNS)
        params.append(person_id)
        db.execute(f"UPDATE people SET {set_clause} WHERE id = ?", params)
        db.commit()
        updated = db.execute("SELECT * FROM people WHERE id = ?", (person_id,)).fetchone()
    rebuild_from_db()
    return dict(updated)


@router.delete("/{person_id}")
def delete_person(person_id: str):
    with get_write_db() as db:
        row = db.execute("SELECT 1 FROM people WHERE id = ?", (person_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Person not found")

        # Nullify reports_to for direct reports
        db.execute("UPDATE people SET reports_to = NULL WHERE reports_to = ?", (person_id,))
        # Nullify notes linkage
        db.execute("UPDATE notes SET person_id = NULL WHERE person_id = ?", (person_id,))
        db.execute("DELETE FROM note_people WHERE person_id = ?", (person_id,))
        db.execute("DELETE FROM issue_people WHERE person_id = ?", (person_id,))
        db.execute("DELETE FROM longform_post_people WHERE person_id = ?", (person_id,))
        # Delete related records
        db.execute("DELETE FROM meeting_files WHERE person_id = ?", (person_id,))
        db.execute("DELETE FROM one_on_one_notes WHERE person_id = ?", (person_id,))
        db.execute("UPDATE granola_meetings SET person_id = NULL WHERE person_id = ?", (person_id,))
        db.execute("UPDATE meeting_notes_external SET person_id = NULL WHERE person_id = ?", (person_id,))
        # Delete person links, attributes, connections
        db.execute("DELETE FROM person_links WHERE person_id = ?", (person_id,))
        db.execute("DELETE FROM person_attributes WHERE person_id = ?", (person_id,))
        db.execute("DELETE FROM person_connections WHERE person_a_id = ? OR person_b_id = ?", (person_id, person_id))
        # Delete person
        db.execute("DELETE FROM people WHERE id = ?", (person_id,))
        db.commit()
    rebuild_from_db()
    return {"status": "deleted", "id": person_id}


@router.get("/{person_id}")
def get_person(person_id: str):
    with get_db_connection(readonly=True) as db:
        row = db.execute("SELECT * FROM people WHERE id = ?", (person_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Person not found")

        person = dict(row)

        # Direct reports from DB
        dr_rows = db.execute(
            "SELECT id, name, title FROM people WHERE reports_to = ? ORDER BY name",
            (person_id,),
        ).fetchall()
        person["direct_reports"] = [dict(r) for r in dr_rows]

        # Role content
        person["role_content"] = person.get("role_content") or ""

        # Meeting files
        meeting_rows = db.execute(
            "SELECT * FROM meeting_files WHERE person_id = ? ORDER BY meeting_date DESC",
            (person_id,),
        ).fetchall()
        person["meeting_files"] = [dict(r) for r in meeting_rows]

        # External meeting notes (from any provider: Granola, Notion, etc.)
        ext_notes_rows = db.execute(
            "SELECT * FROM meeting_notes_external WHERE person_id = ? AND valid_meeting = 1 ORDER BY created_at DESC",
            (person_id,),
        ).fetchall()
        person["meeting_notes"] = [dict(r) for r in ext_notes_rows]
        # Legacy alias
        person["granola_meetings"] = [dict(r) for r in ext_notes_rows if r["provider"] == "granola"]

        # Linked notes via junction table
        note_rows = db.execute(
            "SELECT DISTINCT n.* FROM notes n "
            "JOIN note_people np ON n.id = np.note_id "
            "WHERE np.person_id = ? AND n.status = 'open' "
            "ORDER BY n.is_one_on_one DESC, n.created_at DESC",
            (person_id,),
        ).fetchall()
        person["linked_notes"] = [dict(r) for r in note_rows]

        # Linked issues via junction table
        issue_rows = db.execute(
            "SELECT DISTINCT i.* FROM issues i "
            "JOIN issue_people ip ON i.id = ip.issue_id "
            "WHERE ip.person_id = ? AND i.status != 'done' "
            "ORDER BY i.priority ASC, i.updated_at DESC",
            (person_id,),
        ).fetchall()
        linked_issues = []
        for ir in issue_rows:
            iss = dict(ir)
            ie_rows = db.execute(
                "SELECT p.id, p.name FROM issue_people ip JOIN people p ON ip.person_id = p.id WHERE ip.issue_id = ?",
                (iss["id"],),
            ).fetchall()
            iss["people"] = [{"id": r["id"], "name": r["name"]} for r in ie_rows]
            iss["meetings"] = []
            linked_issues.append(iss)
        person["linked_issues"] = linked_issues

        # Linked longform posts via junction table
        longform_rows = db.execute(
            "SELECT DISTINCT lp.id, lp.title, lp.status, lp.word_count, lp.updated_at "
            "FROM longform_posts lp "
            "JOIN longform_post_people lpp ON lp.id = lpp.post_id "
            "WHERE lpp.person_id = ? "
            "ORDER BY lp.updated_at DESC",
            (person_id,),
        ).fetchall()
        person["linked_longform_posts"] = [dict(r) for r in longform_rows]

        # 1:1 notes
        oon_rows = db.execute(
            "SELECT * FROM one_on_one_notes WHERE person_id = ? ORDER BY meeting_date DESC",
            (person_id,),
        ).fetchall()
        person["one_on_one_notes"] = [dict(r) for r in oon_rows]

        # Person links (social/web)
        link_rows = db.execute(
            "SELECT * FROM person_links WHERE person_id = ? ORDER BY link_type, created_at",
            (person_id,),
        ).fetchall()
        person["links"] = [dict(r) for r in link_rows]

        # Person attributes
        attr_rows = db.execute(
            "SELECT * FROM person_attributes WHERE person_id = ? ORDER BY key",
            (person_id,),
        ).fetchall()
        person["attributes"] = [dict(r) for r in attr_rows]

        # Person connections (bidirectional)
        conn_rows = db.execute(
            "SELECT pc.*, "
            "  CASE WHEN pc.person_a_id = ? THEN pc.person_b_id ELSE pc.person_a_id END as connected_person_id, "
            "  p.name as connected_person_name, p.title as connected_person_title, "
            "  p.company as connected_person_company, p.is_coworker as connected_person_is_coworker "
            "FROM person_connections pc "
            "JOIN people p ON p.id = CASE WHEN pc.person_a_id = ? THEN pc.person_b_id ELSE pc.person_a_id END "
            "WHERE pc.person_a_id = ? OR pc.person_b_id = ? "
            "ORDER BY pc.created_at DESC",
            (person_id, person_id, person_id, person_id),
        ).fetchall()
        person["connections"] = [dict(r) for r in conn_rows]

        # Next meeting
        person["next_meeting"] = None
        email_patterns = get_person_email_patterns(person_id)
        if email_patterns:
            future_events = db.execute(
                "SELECT id, summary, start_time, end_time, html_link, attendees_json "
                "FROM calendar_events WHERE start_time > datetime('now')"
                " AND COALESCE(status, 'confirmed') != 'cancelled'"
                " AND COALESCE(self_response, '') != 'declined'"
                " ORDER BY start_time"
            ).fetchall()
            for event in future_events:
                attendees_raw = event["attendees_json"] or "[]"
                try:
                    attendees = json.loads(attendees_raw) if isinstance(attendees_raw, str) else attendees_raw
                except (json.JSONDecodeError, TypeError):
                    continue
                attendee_emails = [a.get("email", "").lower() for a in attendees]
                if any(pat in attendee_emails for pat in email_patterns):
                    person["next_meeting"] = {
                        "summary": event["summary"],
                        "start_time": event["start_time"],
                        "end_time": event["end_time"],
                        "html_link": event["html_link"],
                    }
                    break

    # Recent meeting summaries
    summaries = []
    for mf in person["meeting_files"][:5]:
        summaries.append(
            {
                "date": mf.get("meeting_date", ""),
                "title": mf.get("title", ""),
                "summary": (mf.get("summary") or "")[:200],
                "source": "file",
            }
        )
    file_dates = {s["date"] for s in summaries}
    for mn in person["meeting_notes"][:5]:
        m_date = (mn.get("created_at") or "")[:10]
        if m_date and m_date not in file_dates:
            summaries.append(
                {
                    "date": m_date,
                    "title": mn.get("title", ""),
                    "summary": (mn.get("summary_plain") or mn.get("panel_summary_plain") or "")[:200],
                    "source": mn.get("provider", "external"),
                }
            )
    summaries.sort(key=lambda s: s["date"] or "", reverse=True)
    person["recent_meeting_summaries"] = summaries[:3]

    return person


# --- Person Links CRUD ---


@router.get("/{person_id}/links")
def list_person_links(person_id: str):
    with get_db_connection(readonly=True) as db:
        rows = db.execute(
            "SELECT * FROM person_links WHERE person_id = ? ORDER BY link_type, created_at",
            (person_id,),
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("/{person_id}/links")
def create_person_link(person_id: str, link: PersonLinkCreate):
    with get_write_db() as db:
        exists = db.execute("SELECT 1 FROM people WHERE id = ?", (person_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Person not found")

        cursor = db.execute(
            "INSERT INTO person_links (person_id, link_type, url, label) VALUES (?, ?, ?, ?)",
            (person_id, link.link_type, link.url, link.label),
        )
        db.commit()
        row = db.execute("SELECT * FROM person_links WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return dict(row)


@router.delete("/{person_id}/links/{link_id}")
def delete_person_link(person_id: str, link_id: int):
    with get_write_db() as db:
        row = db.execute(
            "SELECT 1 FROM person_links WHERE id = ? AND person_id = ?",
            (link_id, person_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Link not found")
        db.execute("DELETE FROM person_links WHERE id = ?", (link_id,))
        db.commit()
    return {"status": "deleted", "id": link_id}


# --- Person Attributes CRUD ---


@router.get("/{person_id}/attributes")
def list_person_attributes(person_id: str):
    with get_db_connection(readonly=True) as db:
        rows = db.execute(
            "SELECT * FROM person_attributes WHERE person_id = ? ORDER BY key",
            (person_id,),
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("/{person_id}/attributes")
def create_person_attribute(person_id: str, attr: PersonAttributeCreate):
    with get_write_db() as db:
        exists = db.execute("SELECT 1 FROM people WHERE id = ?", (person_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Person not found")

        # Upsert: update value if key already exists
        existing = db.execute(
            "SELECT id FROM person_attributes WHERE person_id = ? AND key = ?",
            (person_id, attr.key),
        ).fetchone()
        if existing:
            db.execute(
                "UPDATE person_attributes SET value = ? WHERE id = ?",
                (attr.value, existing["id"]),
            )
            db.commit()
            row = db.execute("SELECT * FROM person_attributes WHERE id = ?", (existing["id"],)).fetchone()
        else:
            cursor = db.execute(
                "INSERT INTO person_attributes (person_id, key, value) VALUES (?, ?, ?)",
                (person_id, attr.key, attr.value),
            )
            db.commit()
            row = db.execute("SELECT * FROM person_attributes WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return dict(row)


@router.delete("/{person_id}/attributes/{attr_id}")
def delete_person_attribute(person_id: str, attr_id: int):
    with get_write_db() as db:
        row = db.execute(
            "SELECT 1 FROM person_attributes WHERE id = ? AND person_id = ?",
            (attr_id, person_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Attribute not found")
        db.execute("DELETE FROM person_attributes WHERE id = ?", (attr_id,))
        db.commit()
    return {"status": "deleted", "id": attr_id}


# --- Person Connections CRUD ---


@router.get("/{person_id}/connections")
def list_person_connections(person_id: str):
    with get_db_connection(readonly=True) as db:
        rows = db.execute(
            "SELECT pc.*, "
            "  CASE WHEN pc.person_a_id = ? THEN pc.person_b_id ELSE pc.person_a_id END as connected_person_id, "
            "  p.name as connected_person_name, p.title as connected_person_title, "
            "  p.company as connected_person_company "
            "FROM person_connections pc "
            "JOIN people p ON p.id = CASE WHEN pc.person_a_id = ? THEN pc.person_b_id ELSE pc.person_a_id END "
            "WHERE pc.person_a_id = ? OR pc.person_b_id = ? "
            "ORDER BY pc.created_at DESC",
            (person_id, person_id, person_id, person_id),
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("/{person_id}/connections")
def create_person_connection(person_id: str, conn: PersonConnectionCreate):
    other_id = conn.person_id
    if other_id == person_id:
        raise HTTPException(status_code=400, detail="Cannot connect a person to themselves")

    # Ensure consistent ordering for UNIQUE constraint
    a_id, b_id = sorted([person_id, other_id])

    with get_write_db() as db:
        for pid in [person_id, other_id]:
            exists = db.execute("SELECT 1 FROM people WHERE id = ?", (pid,)).fetchone()
            if not exists:
                raise HTTPException(status_code=404, detail=f"Person '{pid}' not found")

        existing = db.execute(
            "SELECT 1 FROM person_connections WHERE person_a_id = ? AND person_b_id = ?",
            (a_id, b_id),
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Connection already exists")

        cursor = db.execute(
            "INSERT INTO person_connections (person_a_id, person_b_id, relationship, notes) VALUES (?, ?, ?, ?)",
            (a_id, b_id, conn.relationship, conn.notes),
        )
        db.commit()
        row = db.execute("SELECT * FROM person_connections WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return dict(row)


@router.delete("/{person_id}/connections/{connection_id}")
def delete_person_connection(person_id: str, connection_id: int):
    with get_write_db() as db:
        row = db.execute(
            "SELECT 1 FROM person_connections WHERE id = ? AND (person_a_id = ? OR person_b_id = ?)",
            (connection_id, person_id, person_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Connection not found")
        db.execute("DELETE FROM person_connections WHERE id = ?", (connection_id,))
        db.commit()
    return {"status": "deleted", "id": connection_id}


# --- 1:1 Notes CRUD ---


@router.get("/{person_id}/one-on-one-notes")
def list_one_on_one_notes(person_id: str):
    with get_db_connection(readonly=True) as db:
        rows = db.execute(
            "SELECT * FROM one_on_one_notes WHERE person_id = ? ORDER BY meeting_date DESC",
            (person_id,),
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("/{person_id}/one-on-one-notes")
def create_one_on_one_note(person_id: str, note: OneOnOneNoteCreate):
    with get_write_db() as db:
        person = db.execute("SELECT 1 FROM people WHERE id = ?", (person_id,)).fetchone()
        if not person:
            raise HTTPException(status_code=404, detail="Person not found")

        now = datetime.now().isoformat()
        cursor = db.execute(
            """INSERT INTO one_on_one_notes (person_id, meeting_date, title, content, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (person_id, note.meeting_date, note.title, note.content, now, now),
        )
        db.commit()
        row = db.execute("SELECT * FROM one_on_one_notes WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return dict(row)


@router.patch("/{person_id}/one-on-one-notes/{note_id}")
def update_one_on_one_note(person_id: str, note_id: int, update: OneOnOneNoteUpdate):
    with get_write_db() as db:
        row = db.execute(
            "SELECT * FROM one_on_one_notes WHERE id = ? AND person_id = ?",
            (note_id, person_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Note not found")

        update_fields = dict(update.model_dump(exclude_unset=True))

        if update_fields:
            set_clause, params = safe_update_query(
                "one_on_one_notes",
                update_fields,
                ONE_ON_ONE_NOTE_ALLOWED_COLUMNS,
                extra_set_clauses=["updated_at = ?"],
            )
            params.append(datetime.now().isoformat())
            params.append(note_id)
            db.execute(f"UPDATE one_on_one_notes SET {set_clause} WHERE id = ?", params)
            db.commit()

        updated = db.execute("SELECT * FROM one_on_one_notes WHERE id = ?", (note_id,)).fetchone()
    return dict(updated)


@router.delete("/{person_id}/one-on-one-notes/{note_id}")
def delete_one_on_one_note(person_id: str, note_id: int):
    with get_write_db() as db:
        row = db.execute(
            "SELECT 1 FROM one_on_one_notes WHERE id = ? AND person_id = ?",
            (note_id, person_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Note not found")

        db.execute("DELETE FROM one_on_one_notes WHERE id = ?", (note_id,))
        db.commit()
    return {"status": "deleted", "id": note_id}


# --- One-Time Markdown Import ---


@router.post("/import-markdown")
def import_from_markdown():
    """One-time import of people data from markdown files into SQLite."""
    from pathlib import Path

    from connectors.markdown import parse_org_tree

    imported = 0

    with get_write_db() as db:
        for source_dir, is_exec in [
            (TEAMS_DIR, False),
            (EXECUTIVES_DIR, True),
            (HIDDEN_TEAMS_DIR, False),
        ]:
            if not source_dir or not Path(source_dir).exists():
                continue
            people_list = parse_org_tree(source_dir, is_executive=is_exec)
            for person in people_list:
                group = "exec" if person.get("is_executive") else "team"
                role_content = ""
                role_path = Path(person["dir_path"]) / "role.md"
                if role_path.exists():
                    role_content = role_path.read_text(encoding="utf-8")

                existing = db.execute("SELECT 1 FROM people WHERE id = ?", (person["id"],)).fetchone()
                if existing:
                    db.execute(
                        """UPDATE people SET
                            dir_path = COALESCE(NULLIF(dir_path, ''), ?),
                            group_name = ?,
                            is_executive = ?,
                            role_content = COALESCE(role_content, ?),
                            has_meetings_dir = ?
                        WHERE id = ?""",
                        (
                            person["dir_path"],
                            group,
                            int(person.get("is_executive", False)),
                            role_content,
                            int(person["has_meetings_dir"]),
                            person["id"],
                        ),
                    )
                else:
                    db.execute(
                        """INSERT INTO people
                           (id, name, title, reports_to, depth, dir_path, has_meetings_dir,
                            is_executive, group_name, role_content, is_coworker, source, created_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'import', ?)""",
                        (
                            person["id"],
                            person["name"],
                            person["title"],
                            person["reports_to"],
                            person["depth"],
                            person["dir_path"],
                            int(person["has_meetings_dir"]),
                            int(person.get("is_executive", False)),
                            group,
                            role_content,
                            datetime.now().isoformat(),
                        ),
                    )
                    imported += 1

        db.commit()
    rebuild_from_db()
    return {"status": "success", "imported": imported}
