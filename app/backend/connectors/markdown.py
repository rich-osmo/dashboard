import re
from pathlib import Path
from datetime import datetime


def parse_org_tree(teams_dir: Path, manager_id: str | None = None, depth: int = 0, is_executive: bool = False) -> list[dict]:
    employees = []
    if not teams_dir.exists():
        return employees

    for entry in sorted(teams_dir.iterdir()):
        if entry.name.startswith(".") or not entry.is_dir():
            continue

        employee_id = entry.name
        name = entry.name.replace("_", " ")
        role_data = parse_role_md(entry / "role.md")
        has_meetings = (entry / "meetings").is_dir()

        employees.append({
            "id": employee_id,
            "name": name,
            "title": role_data.get("title", ""),
            "reports_to": manager_id,
            "depth": depth,
            "dir_path": str(entry),
            "has_meetings_dir": has_meetings,
            "is_executive": is_executive,
        })

        sub_teams = entry / "teams"
        if sub_teams.is_dir():
            employees.extend(parse_org_tree(sub_teams, employee_id, depth + 1))

    return employees


def parse_role_md(filepath: Path) -> dict:
    if not filepath.exists():
        return {}
    content = filepath.read_text()
    result = {"raw": content}
    title_match = re.search(r"\*\*Title:\*\*\s*(.+)", content)
    if title_match:
        result["title"] = title_match.group(1).strip()
    return result


def read_file_content(filepath: Path) -> str | None:
    if filepath.exists():
        return filepath.read_text()
    return None


def parse_meeting_files(meetings_dir: Path, employee_id: str) -> list[dict]:
    meetings = []
    if not meetings_dir.exists():
        return meetings

    for f in sorted(meetings_dir.glob("*.md"), reverse=True):
        date_match = re.search(r"(\d{4}-\d{2}-\d{2})", f.name)
        meeting_date = date_match.group(1) if date_match else None
        content = f.read_text()

        granola_match = re.search(r"https://notes\.granola\.ai/\S+", content)
        granola_link = granola_match.group(0).rstrip(")") if granola_match else None

        action_items = re.findall(r"^- \[[ x]\] .+$", content, re.MULTILINE)

        # Extract summary: text between "## Summary" and next "##" or "---"
        summary = ""
        summary_match = re.search(r"## Summary\s*\n(.*?)(?=\n##|\n---|\Z)", content, re.DOTALL)
        if summary_match:
            summary = summary_match.group(1).strip()[:500]

        meetings.append({
            "employee_id": employee_id,
            "filename": f.name,
            "filepath": str(f),
            "meeting_date": meeting_date,
            "title": f"1:1 - {employee_id.replace('_', ' ')} - {meeting_date or 'Unknown'}",
            "summary": summary,
            "granola_link": granola_link,
            "action_items": action_items,
            "content_markdown": content,
            "last_modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
        })

    return meetings


def get_employee_detail(employee_id: str, teams_dir: Path, hidden_dir: Path | None = None, executives_dir: Path | None = None) -> dict | None:
    """Find employee directory and return full detail including file contents."""
    emp_dir = _find_employee_dir(employee_id, teams_dir)
    if not emp_dir and hidden_dir:
        emp_dir = _find_employee_dir(employee_id, hidden_dir)
    if not emp_dir and executives_dir and executives_dir.exists():
        emp_dir = _find_employee_dir(employee_id, executives_dir)
    if not emp_dir:
        return None

    role_content = read_file_content(emp_dir / "role.md")
    one_on_one_content = read_file_content(emp_dir / "1-1.md")
    meetings = parse_meeting_files(emp_dir / "meetings", employee_id)

    # Find direct reports (subdirectories in teams/)
    sub_teams = emp_dir / "teams"
    direct_reports = []
    if sub_teams.is_dir():
        for entry in sorted(sub_teams.iterdir()):
            if entry.is_dir() and not entry.name.startswith("."):
                dr_role = parse_role_md(entry / "role.md")
                direct_reports.append({
                    "id": entry.name,
                    "name": entry.name.replace("_", " "),
                    "title": dr_role.get("title", ""),
                })

    return {
        "role_content": role_content or "",
        "one_on_one_content": one_on_one_content or "",
        "meeting_files": meetings,
        "direct_reports": direct_reports,
    }


def _find_employee_dir(employee_id: str, base_dir: Path) -> Path | None:
    """Recursively find employee directory by ID."""
    for entry in base_dir.iterdir():
        if entry.is_dir() and entry.name == employee_id:
            return entry
        if entry.is_dir():
            sub_teams = entry / "teams"
            if sub_teams.is_dir():
                found = _find_employee_dir(employee_id, sub_teams)
                if found:
                    return found
    return None
