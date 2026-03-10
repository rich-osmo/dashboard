import os
import sys
from pathlib import Path


def is_bundled() -> bool:
    """Return True when running inside a PyInstaller bundle."""
    return getattr(sys, "_MEIPASS", None) is not None


def get_backend_root() -> Path:
    """Base path for finding backend files (alembic, .env, etc.)."""
    if is_bundled():
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent


REPO_ROOT = Path(__file__).resolve().parent.parent.parent if not is_bundled() else get_backend_root()


def _data_dir() -> Path:
    """Resolve the user data directory. Creates it if needed."""
    d = Path(os.environ.get("DASHBOARD_DATA_DIR", Path.home() / ".personal-dashboard"))
    d.mkdir(parents=True, exist_ok=True)
    return d


DATA_DIR = _data_dir()
CONFIG_PATH = DATA_DIR / "config.json"


def _resolve_db_path() -> Path:
    """Resolve database path."""
    env_path = os.environ.get("DASHBOARD_DB_PATH")
    if env_path:
        return Path(env_path)
    return DATA_DIR / "dashboard.db"


DATABASE_PATH = _resolve_db_path()

# Legacy team directories — only exist in source-tree mode, not bundled
TEAMS_DIR = REPO_ROOT / "teams" if not is_bundled() else Path("/nonexistent")
HIDDEN_TEAMS_DIR = REPO_ROOT / "hidden" / "teams" if not is_bundled() else Path("/nonexistent")
EXECUTIVES_DIR = REPO_ROOT / "executives" if not is_bundled() else Path("/nonexistent")

_GRANOLA_V4 = Path.home() / "Library" / "Application Support" / "Granola" / "cache-v4.json"
_GRANOLA_V3 = Path.home() / "Library" / "Application Support" / "Granola" / "cache-v3.json"
GRANOLA_CACHE_PATH = _GRANOLA_V4 if _GRANOLA_V4.exists() else _GRANOLA_V3

GCLOUD_CREDENTIALS_PATH = Path.home() / ".config" / "gcloud" / "application_default_credentials.json"

GOOGLE_SCOPES_READONLY = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
]

GOOGLE_SCOPES_READWRITE = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/documents",
]


def get_google_scopes() -> list[str]:
    """Return the appropriate Google scopes based on config access_mode."""
    from app_config import get_google_access_mode

    if get_google_access_mode() == "readwrite":
        return GOOGLE_SCOPES_READWRITE
    return GOOGLE_SCOPES_READONLY


# Legacy alias — code that imports GOOGLE_SCOPES gets readonly by default.
# New code should call get_google_scopes() instead.
GOOGLE_SCOPES = GOOGLE_SCOPES_READONLY

GMAIL_MAX_RESULTS = 50
CALENDAR_DAYS_AHEAD = 14
CALENDAR_DAYS_BEHIND = 90
SLACK_MESSAGE_LIMIT = 100

GITHUB_PR_SYNC_LIMIT = 50

DRIVE_SYNC_LIMIT = 100
DRIVE_SYNC_DAYS = 90
SHEETS_SYNC_LIMIT = 50
DOCS_SYNC_LIMIT = 50


def get_github_repo() -> str:
    """Get the GitHub repo from user config, with env var fallback."""
    from app_config import get_profile

    repo = get_profile().get("github_repo", "")
    return repo or os.environ.get("GITHUB_REPO", "")


RAMP_TRANSACTION_SYNC_DAYS = 90
