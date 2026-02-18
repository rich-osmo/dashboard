from pathlib import Path

REPO_ROOT = Path("/Users/rich/osmo/rich")
TEAMS_DIR = REPO_ROOT / "teams"
HIDDEN_TEAMS_DIR = REPO_ROOT / "hidden" / "teams"
EXECUTIVES_DIR = REPO_ROOT / "executives"
DATABASE_PATH = REPO_ROOT / "app" / "database" / "rich.db"
GRANOLA_CACHE_PATH = Path.home() / "Library" / "Application Support" / "Granola" / "cache-v3.json"
GCLOUD_CREDENTIALS_PATH = Path.home() / ".config" / "gcloud" / "application_default_credentials.json"

GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
]

GMAIL_MAX_RESULTS = 50
CALENDAR_DAYS_AHEAD = 14
CALENDAR_DAYS_BEHIND = 90
SLACK_MESSAGE_LIMIT = 100

GITHUB_REPO = "osmoai/osmo"
GITHUB_PR_SYNC_LIMIT = 50

RAMP_TRANSACTION_SYNC_DAYS = 90
