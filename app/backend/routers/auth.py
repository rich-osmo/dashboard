"""Authentication status and management for connected services."""
import os
import traceback
from pathlib import Path
from fastapi import APIRouter
from config import GCLOUD_CREDENTIALS_PATH, GRANOLA_CACHE_PATH

router = APIRouter(prefix="/api/auth", tags=["auth"])

TOKEN_PATH = Path(__file__).parent.parent / ".google_token.json"


def _check_google() -> dict:
    """Check Google auth status by validating credentials."""
    result = {"configured": False, "connected": False, "error": None, "detail": None}

    if not GCLOUD_CREDENTIALS_PATH.exists() and not TOKEN_PATH.exists():
        result["detail"] = "No credentials found. Run: gcloud auth application-default login"
        return result

    result["configured"] = True
    try:
        from connectors.google_auth import get_google_credentials
        creds = get_google_credentials()
        if creds and creds.valid:
            result["connected"] = True
            result["detail"] = "Authenticated via OAuth token"
        else:
            result["error"] = "Token exists but is not valid"
    except FileNotFoundError as e:
        result["error"] = str(e)
    except Exception as e:
        result["error"] = str(e)
        result["detail"] = traceback.format_exc()

    return result


def _check_slack() -> dict:
    """Check Slack auth status by making a test API call."""
    result = {"configured": False, "connected": False, "error": None, "detail": None}
    token = os.environ.get("SLACK_TOKEN", "")

    if not token:
        result["detail"] = "SLACK_TOKEN not set in .env"
        return result

    result["configured"] = True
    try:
        from slack_sdk import WebClient
        client = WebClient(token=token)
        resp = client.auth_test()
        if resp.get("ok"):
            result["connected"] = True
            result["detail"] = f"Authenticated as {resp.get('user', 'unknown')} in {resp.get('team', 'unknown')}"
        else:
            result["error"] = resp.get("error", "Unknown error")
    except ImportError:
        result["error"] = "slack_sdk not installed"
    except Exception as e:
        result["error"] = str(e)

    return result


def _check_notion() -> dict:
    """Check Notion auth status by making a test API call."""
    result = {"configured": False, "connected": False, "error": None, "detail": None}
    token = os.environ.get("NOTION_TOKEN", "")

    if not token:
        result["detail"] = "NOTION_TOKEN not set in .env"
        return result

    result["configured"] = True
    try:
        import httpx
        resp = httpx.get(
            "https://api.notion.com/v1/users/me",
            headers={
                "Authorization": f"Bearer {token}",
                "Notion-Version": "2022-06-28",
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("object") == "user":
            name = data.get("name", "Unknown")
            result["connected"] = True
            result["detail"] = f"Authenticated as {name}"
        else:
            result["error"] = "Unexpected response from Notion API"
    except Exception as e:
        result["error"] = str(e)

    return result


def _check_github() -> dict:
    """Check GitHub auth via gh CLI token."""
    import subprocess
    result = {"configured": False, "connected": False, "error": None, "detail": None}
    try:
        proc = subprocess.run(["gh", "auth", "token"], capture_output=True, text=True, timeout=5)
        if proc.returncode == 0 and proc.stdout.strip():
            result["configured"] = True
            import httpx
            resp = httpx.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {proc.stdout.strip()}",
                    "Accept": "application/vnd.github+json",
                },
                timeout=10,
            )
            if resp.status_code == 200:
                user = resp.json()
                result["connected"] = True
                result["detail"] = f"Authenticated as {user.get('login', 'unknown')}"
            else:
                result["error"] = f"Token invalid (HTTP {resp.status_code})"
        else:
            result["detail"] = "gh CLI not authenticated. Run: gh auth login"
    except FileNotFoundError:
        result["detail"] = "gh CLI not installed. Install: brew install gh"
    except Exception as e:
        result["error"] = str(e)
    return result


def _check_granola() -> dict:
    """Check if Granola cache file exists (no auth needed)."""
    result = {"configured": False, "connected": False, "error": None, "detail": None}

    if GRANOLA_CACHE_PATH.exists():
        result["configured"] = True
        result["connected"] = True
        result["detail"] = f"Cache file found at {GRANOLA_CACHE_PATH}"
    else:
        result["detail"] = f"Cache file not found at {GRANOLA_CACHE_PATH}"

    return result


def _get_sync_states() -> dict:
    """Fetch last sync state per source from the database."""
    from database import get_db
    db = get_db()
    rows = db.execute("SELECT * FROM sync_state").fetchall()
    db.close()
    result = {}
    for row in rows:
        result[row["source"]] = {
            "last_sync_at": row["last_sync_at"],
            "last_sync_status": row["last_sync_status"],
            "last_error": row["last_error"],
            "items_synced": row["items_synced"],
        }
    return result


# Map auth service names to their sync_state source names
_AUTH_TO_SYNC = {
    "google": ["gmail", "calendar"],
    "slack": ["slack"],
    "notion": ["notion"],
    "granola": ["granola"],
    "github": ["github"],
}


@router.get("/status")
def auth_status():
    """Return authentication status for all connected services, including sync errors."""
    sync_states = _get_sync_states()

    services = {
        "google": _check_google(),
        "slack": _check_slack(),
        "notion": _check_notion(),
        "granola": _check_granola(),
        "github": _check_github(),
    }

    # Attach sync state to each service
    for service_name, info in services.items():
        sync_sources = _AUTH_TO_SYNC.get(service_name, [])
        sync_info = {}
        for src in sync_sources:
            if src in sync_states:
                sync_info[src] = sync_states[src]
        info["sync"] = sync_info

    return services


@router.post("/google")
def google_auth():
    """Trigger browser-based Google OAuth flow."""
    try:
        from connectors.google_auth import run_oauth_flow
        run_oauth_flow()
        return {"status": "authenticated"}
    except Exception as e:
        return {"status": "error", "error": str(e), "detail": traceback.format_exc()}


@router.post("/google/revoke")
def google_revoke():
    """Remove stored Google token to force re-authentication."""
    if TOKEN_PATH.exists():
        TOKEN_PATH.unlink()
        # Clear cached credentials
        try:
            from connectors import google_auth
            google_auth._cached_creds = None
        except Exception:
            pass
        return {"status": "revoked"}
    return {"status": "no_token"}


@router.post("/test/{service}")
def test_connection(service: str):
    """Test a specific service connection and return detailed status."""
    checkers = {
        "google": _check_google,
        "slack": _check_slack,
        "notion": _check_notion,
        "granola": _check_granola,
        "github": _check_github,
    }
    checker = checkers.get(service)
    if not checker:
        return {"error": f"Unknown service: {service}"}
    return checker()
