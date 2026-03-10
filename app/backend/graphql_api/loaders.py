"""DataLoaders for batching and caching DB queries within a single GraphQL request."""

import sqlite3
from collections import defaultdict

from strawberry.dataloader import DataLoader


def _placeholders(keys: list) -> str:
    return ",".join("?" * len(keys))


class Loaders:
    """One instance per GraphQL request. Holds all DataLoaders sharing a DB connection."""

    def __init__(self, db: sqlite3.Connection):
        self.db = db

        # Entity loaders
        self.person_by_id = DataLoader(load_fn=self._load_people_by_id)

        # Person → related entities
        self.notes_by_person = DataLoader(load_fn=self._load_notes_by_person)
        self.emails_by_person = DataLoader(load_fn=self._load_emails_by_person)
        self.slack_by_person = DataLoader(load_fn=self._load_slack_by_person)
        self.events_by_person = DataLoader(load_fn=self._load_events_by_person)
        self.issues_by_person = DataLoader(load_fn=self._load_issues_by_person)
        self.granola_meetings_by_person = DataLoader(load_fn=self._load_granola_by_person)
        self.meeting_files_by_person = DataLoader(load_fn=self._load_meeting_files_by_person)
        self.github_prs_by_person = DataLoader(load_fn=self._load_github_prs_by_person)
        self.drive_files_by_person = DataLoader(load_fn=self._load_drive_files_by_person)
        self.ramp_txns_by_person = DataLoader(load_fn=self._load_ramp_txns_by_person)
        self.direct_reports = DataLoader(load_fn=self._load_direct_reports)
        self.longform_posts_by_person = DataLoader(load_fn=self._load_longform_posts_by_person)

        # Reverse: entity → people
        self.people_by_note = DataLoader(load_fn=self._load_people_by_note)
        self.people_by_issue = DataLoader(load_fn=self._load_people_by_issue)
        self.people_by_email = DataLoader(load_fn=self._load_people_by_email)
        self.people_by_event = DataLoader(load_fn=self._load_people_by_event)
        self.people_by_drive_file = DataLoader(load_fn=self._load_people_by_drive_file)
        self.people_by_longform_post = DataLoader(load_fn=self._load_people_by_longform_post)

        # Nested entity loaders
        self.tags_by_issue = DataLoader(load_fn=self._load_tags_by_issue)
        self.tags_by_post = DataLoader(load_fn=self._load_tags_by_post)
        self.comments_by_post = DataLoader(load_fn=self._load_comments_by_post)
        self.issues_by_project = DataLoader(load_fn=self._load_issues_by_project)
        self.bills_by_project = DataLoader(load_fn=self._load_bills_by_project)

    # ── Entity loaders ───────────────────────────────────────────────

    async def _load_people_by_id(self, keys: list[str]) -> list[dict | None]:
        rows = self.db.execute(f"SELECT * FROM people WHERE id IN ({_placeholders(keys)})", keys).fetchall()
        lookup = {r["id"]: dict(r) for r in rows}
        return [lookup.get(k) for k in keys]

    # ── Person → related entities ────────────────────────────────────

    async def _load_notes_by_person(self, person_ids: list[str]) -> list[list[dict]]:
        rows = self.db.execute(
            f"""SELECT np.person_id, n.* FROM note_people np
                JOIN notes n ON np.note_id = n.id
                WHERE np.person_id IN ({_placeholders(person_ids)})
                ORDER BY n.created_at DESC""",
            person_ids,
        ).fetchall()
        return _group_by(rows, "person_id", person_ids)

    async def _load_emails_by_person(self, person_ids: list[str]) -> list[list[dict]]:
        rows = self.db.execute(
            f"""SELECT ep.person_id, e.* FROM email_people ep
                JOIN emails e ON ep.email_id = e.id
                WHERE ep.person_id IN ({_placeholders(person_ids)})
                ORDER BY e.date DESC""",
            person_ids,
        ).fetchall()
        return _group_by(rows, "person_id", person_ids)

    async def _load_slack_by_person(self, person_ids: list[str]) -> list[list[dict]]:
        rows = self.db.execute(
            f"""SELECT * FROM slack_messages
                WHERE person_id IN ({_placeholders(person_ids)})
                ORDER BY ts DESC""",
            person_ids,
        ).fetchall()
        return _group_by(rows, "person_id", person_ids)

    async def _load_events_by_person(self, person_ids: list[str]) -> list[list[dict]]:
        rows = self.db.execute(
            f"""SELECT cep.person_id, ce.* FROM calendar_event_people cep
                JOIN calendar_events ce ON cep.event_id = ce.id
                WHERE cep.person_id IN ({_placeholders(person_ids)})
                ORDER BY ce.start_time DESC""",
            person_ids,
        ).fetchall()
        return _group_by(rows, "person_id", person_ids)

    async def _load_issues_by_person(self, person_ids: list[str]) -> list[list[dict]]:
        rows = self.db.execute(
            f"""SELECT ip.person_id, i.* FROM issue_people ip
                JOIN issues i ON ip.issue_id = i.id
                WHERE ip.person_id IN ({_placeholders(person_ids)})
                ORDER BY i.created_at DESC""",
            person_ids,
        ).fetchall()
        return _group_by(rows, "person_id", person_ids)

    async def _load_granola_by_person(self, person_ids: list[str]) -> list[list[dict]]:
        rows = self.db.execute(
            f"""SELECT * FROM granola_meetings
                WHERE person_id IN ({_placeholders(person_ids)})
                ORDER BY created_at DESC""",
            person_ids,
        ).fetchall()
        return _group_by(rows, "person_id", person_ids)

    async def _load_meeting_files_by_person(self, person_ids: list[str]) -> list[list[dict]]:
        rows = self.db.execute(
            f"""SELECT * FROM meeting_files
                WHERE person_id IN ({_placeholders(person_ids)})
                ORDER BY meeting_date DESC""",
            person_ids,
        ).fetchall()
        return _group_by(rows, "person_id", person_ids)

    async def _load_github_prs_by_person(self, person_ids: list[str]) -> list[list[dict]]:
        rows = self.db.execute(
            f"""SELECT * FROM github_pull_requests
                WHERE person_id IN ({_placeholders(person_ids)})
                ORDER BY updated_at DESC""",
            person_ids,
        ).fetchall()
        return _group_by(rows, "person_id", person_ids)

    async def _load_drive_files_by_person(self, person_ids: list[str]) -> list[list[dict]]:
        rows = self.db.execute(
            f"""SELECT dfp.person_id, df.* FROM drive_file_people dfp
                JOIN drive_files df ON dfp.file_id = df.id
                WHERE dfp.person_id IN ({_placeholders(person_ids)})
                ORDER BY df.modified_time DESC""",
            person_ids,
        ).fetchall()
        return _group_by(rows, "person_id", person_ids)

    async def _load_ramp_txns_by_person(self, person_ids: list[str]) -> list[list[dict]]:
        rows = self.db.execute(
            f"""SELECT * FROM ramp_transactions
                WHERE person_id IN ({_placeholders(person_ids)})
                ORDER BY transaction_date DESC""",
            person_ids,
        ).fetchall()
        return _group_by(rows, "person_id", person_ids)

    async def _load_direct_reports(self, person_ids: list[str]) -> list[list[dict]]:
        rows = self.db.execute(
            f"""SELECT * FROM people
                WHERE reports_to IN ({_placeholders(person_ids)})
                ORDER BY name""",
            person_ids,
        ).fetchall()
        return _group_by(rows, "reports_to", person_ids)

    async def _load_longform_posts_by_person(self, person_ids: list[str]) -> list[list[dict]]:
        rows = self.db.execute(
            f"""SELECT lpp.person_id, lp.* FROM longform_post_people lpp
                JOIN longform_posts lp ON lpp.post_id = lp.id
                WHERE lpp.person_id IN ({_placeholders(person_ids)})
                ORDER BY lp.updated_at DESC""",
            person_ids,
        ).fetchall()
        return _group_by(rows, "person_id", person_ids)

    # ── Reverse: entity → people ─────────────────────────────────────

    async def _load_people_by_note(self, note_ids: list[int]) -> list[list[dict]]:
        rows = self.db.execute(
            f"""SELECT np.note_id, p.* FROM note_people np
                JOIN people p ON np.person_id = p.id
                WHERE np.note_id IN ({_placeholders(note_ids)})""",
            note_ids,
        ).fetchall()
        return _group_by(rows, "note_id", note_ids)

    async def _load_people_by_issue(self, issue_ids: list[int]) -> list[list[dict]]:
        rows = self.db.execute(
            f"""SELECT ip.issue_id, p.* FROM issue_people ip
                JOIN people p ON ip.person_id = p.id
                WHERE ip.issue_id IN ({_placeholders(issue_ids)})""",
            issue_ids,
        ).fetchall()
        return _group_by(rows, "issue_id", issue_ids)

    async def _load_people_by_email(self, email_ids: list[str]) -> list[list[dict]]:
        rows = self.db.execute(
            f"""SELECT ep.email_id, p.* FROM email_people ep
                JOIN people p ON ep.person_id = p.id
                WHERE ep.email_id IN ({_placeholders(email_ids)})""",
            email_ids,
        ).fetchall()
        return _group_by(rows, "email_id", email_ids)

    async def _load_people_by_event(self, event_ids: list[str]) -> list[list[dict]]:
        rows = self.db.execute(
            f"""SELECT cep.event_id, p.* FROM calendar_event_people cep
                JOIN people p ON cep.person_id = p.id
                WHERE cep.event_id IN ({_placeholders(event_ids)})""",
            event_ids,
        ).fetchall()
        return _group_by(rows, "event_id", event_ids)

    async def _load_people_by_drive_file(self, file_ids: list[str]) -> list[list[dict]]:
        rows = self.db.execute(
            f"""SELECT dfp.file_id, p.* FROM drive_file_people dfp
                JOIN people p ON dfp.person_id = p.id
                WHERE dfp.file_id IN ({_placeholders(file_ids)})""",
            file_ids,
        ).fetchall()
        return _group_by(rows, "file_id", file_ids)

    async def _load_people_by_longform_post(self, post_ids: list[int]) -> list[list[dict]]:
        rows = self.db.execute(
            f"""SELECT lpp.post_id, p.* FROM longform_post_people lpp
                JOIN people p ON lpp.person_id = p.id
                WHERE lpp.post_id IN ({_placeholders(post_ids)})""",
            post_ids,
        ).fetchall()
        return _group_by(rows, "post_id", post_ids)

    # ── Nested entity loaders ────────────────────────────────────────

    async def _load_tags_by_issue(self, issue_ids: list[int]) -> list[list[str]]:
        rows = self.db.execute(
            f"""SELECT issue_id, tag FROM issue_tags
                WHERE issue_id IN ({_placeholders(issue_ids)})""",
            issue_ids,
        ).fetchall()
        result: dict[int, list[str]] = {iid: [] for iid in issue_ids}
        for r in rows:
            result[r["issue_id"]].append(r["tag"])
        return [result[iid] for iid in issue_ids]

    async def _load_tags_by_post(self, post_ids: list[int]) -> list[list[str]]:
        rows = self.db.execute(
            f"""SELECT post_id, tag FROM longform_tags
                WHERE post_id IN ({_placeholders(post_ids)})""",
            post_ids,
        ).fetchall()
        result: dict[int, list[str]] = {pid: [] for pid in post_ids}
        for r in rows:
            result[r["post_id"]].append(r["tag"])
        return [result[pid] for pid in post_ids]

    async def _load_comments_by_post(self, post_ids: list[int]) -> list[list[dict]]:
        rows = self.db.execute(
            f"""SELECT * FROM longform_comments
                WHERE post_id IN ({_placeholders(post_ids)})
                ORDER BY created_at""",
            post_ids,
        ).fetchall()
        return _group_by(rows, "post_id", post_ids)

    async def _load_issues_by_project(self, project_ids: list[int]) -> list[list[dict]]:
        rows = self.db.execute(
            f"""SELECT * FROM issues
                WHERE project_id IN ({_placeholders(project_ids)})
                ORDER BY created_at DESC""",
            project_ids,
        ).fetchall()
        return _group_by(rows, "project_id", project_ids)

    async def _load_bills_by_project(self, project_ids: list[int]) -> list[list[dict]]:
        rows = self.db.execute(
            f"""SELECT * FROM ramp_bills
                WHERE project_id IN ({_placeholders(project_ids)})
                ORDER BY due_at DESC""",
            project_ids,
        ).fetchall()
        return _group_by(rows, "project_id", project_ids)


def _group_by(rows: list, key_col: str, keys: list) -> list[list[dict]]:
    """Group rows by a key column, preserving order of keys."""
    groups: dict = defaultdict(list)
    for r in rows:
        groups[r[key_col]].append(dict(r))
    return [groups.get(k, []) for k in keys]
