EMAIL_TO_EMPLOYEE: dict[str, str] = {}
NAME_TO_EMPLOYEE: dict[str, str] = {}


def build_employee_mapping(employees: list[dict]):
    global EMAIL_TO_EMPLOYEE, NAME_TO_EMPLOYEE
    EMAIL_TO_EMPLOYEE.clear()
    NAME_TO_EMPLOYEE.clear()

    for emp in employees:
        name = emp["name"]
        emp_id = emp["id"]
        parts = name.lower().split()

        NAME_TO_EMPLOYEE[name.lower()] = emp_id

        if len(parts) >= 2:
            first, last = parts[0], parts[-1]
            EMAIL_TO_EMPLOYEE[f"{first}@osmo.ai"] = emp_id
            EMAIL_TO_EMPLOYEE[f"{first}.{last}@osmo.ai"] = emp_id
            EMAIL_TO_EMPLOYEE[f"{first[0]}{last}@osmo.ai"] = emp_id
            EMAIL_TO_EMPLOYEE[f"{last}@osmo.ai"] = emp_id
            NAME_TO_EMPLOYEE[first] = emp_id
            NAME_TO_EMPLOYEE[last] = emp_id
            NAME_TO_EMPLOYEE[f"{first} {last}"] = emp_id

            # Common nicknames / short names
            NICKNAMES = {
                "benjamin": ["ben"],
                "michael": ["mike"],
                "katherine": ["kate"],
                "samuel": ["sam"],
                "richard": ["rich", "rick"],
                "william": ["will"],
                "alexander": ["alex"],
                "nicholas": ["nick"],
                "elizabeth": ["liz", "beth"],
                "frances": ["fran"],
                "guillaume": ["gui"],
            }
            for nick in NICKNAMES.get(first, []):
                NAME_TO_EMPLOYEE[nick] = emp_id
                EMAIL_TO_EMPLOYEE[f"{nick}@osmo.ai"] = emp_id


def rebuild_from_db():
    """Rebuild employee matching maps from database."""
    from database import get_db
    db = get_db()
    rows = db.execute("SELECT id, name FROM employees").fetchall()
    db.close()
    build_employee_mapping([dict(r) for r in rows])


def match_email_to_employee(email: str) -> str | None:
    return EMAIL_TO_EMPLOYEE.get(email.lower())


def match_name_to_employee(name: str) -> str | None:
    return NAME_TO_EMPLOYEE.get(name.lower())


def get_employee_email_patterns(employee_id: str) -> list[str]:
    """Return all email patterns that could match this employee in calendar attendees."""
    return [email for email, eid in EMAIL_TO_EMPLOYEE.items() if eid == employee_id]


def match_attendees_to_employee(attendees: list[dict], exclude_email: str = "rich@osmo.ai") -> str | None:
    """Given meeting attendees, find the non-Rich employee."""
    for a in attendees:
        email = a.get("email", "").lower()
        name = a.get("name", "").lower()

        if exclude_email and exclude_email in email:
            continue
        if "rich" == email.split("@")[0]:
            continue

        match = match_email_to_employee(email)
        if match:
            return match
        match = match_name_to_employee(name)
        if match:
            return match

    return None
