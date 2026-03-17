"""Sandbox: build and run mini web apps in ~/.personal-dashboard/sandbox/."""

import html as html_mod
import json
import logging
import mimetypes
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from config import DATA_DIR
from models import SandboxAppCreate, SandboxAppUpdate, SandboxFileWrite

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sandbox", tags=["sandbox"])

SANDBOX_DIR = DATA_DIR / "sandbox"


def _slugify(name: str) -> str:
    """Convert name to filesystem-safe slug."""
    slug = re.sub(r"[^\w\s-]", "", name.lower().strip())
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "app"


def _ensure_unique_slug(slug: str) -> str:
    """Append numeric suffix if slug directory already exists."""
    base = slug
    counter = 1
    while (SANDBOX_DIR / slug).exists():
        counter += 1
        slug = f"{base}-{counter}"
    return slug


def _read_manifest(app_dir: Path) -> dict:
    manifest_path = app_dir / "manifest.json"
    if not manifest_path.exists():
        return {}
    try:
        return json.loads(manifest_path.read_text())
    except (json.JSONDecodeError, OSError):
        return {}


def _write_manifest(app_dir: Path, manifest: dict):
    (app_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))


def _app_to_dict(app_id: str, app_dir: Path) -> dict:
    manifest = _read_manifest(app_dir)
    files = [f.name for f in sorted(app_dir.iterdir()) if f.is_file() and f.name != "manifest.json"]
    return {
        "id": app_id,
        "name": manifest.get("name", app_id),
        "description": manifest.get("description", ""),
        "created_at": manifest.get("created_at", ""),
        "updated_at": manifest.get("updated_at", ""),
        "files": files,
    }


TEMPLATE_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{name}</title>
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      padding: 24px;
      color: #111;
      background: #fff;
    }}
    h1 {{ font-size: 24px; font-weight: 600; margin-bottom: 16px; }}
    p {{ color: #666; line-height: 1.6; }}
  </style>
</head>
<body>
  <h1>{name}</h1>
  <p>Edit this app using Claude to build something useful.</p>
  <!--
    Dashboard API available at /api/* (same origin):
    - GET /api/people, /api/notes, /api/issues, /api/meetings
    - GET /api/briefing, /api/weather, /api/priorities
    - GET /api/gmail/search?q=..., /api/slack/search?q=...
    - GET /api/calendar/search?q=..., /api/notion/search?q=...
    - GET /api/news, /api/drive/files, /api/github/prs
    - GraphQL at /graphql
    Use fetch('/api/...') — no CORS needed.
    You can load CDN libraries via script tags.
  -->
  <script>
    // Example: fetch('/api/weather').then(r => r.json()).then(console.log);
  </script>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/apps")
def list_apps():
    """List all sandbox apps."""
    SANDBOX_DIR.mkdir(parents=True, exist_ok=True)
    apps = []
    for d in sorted(SANDBOX_DIR.iterdir()):
        if d.is_dir() and (d / "manifest.json").exists():
            apps.append(_app_to_dict(d.name, d))
    # Most recently updated first
    apps.sort(key=lambda a: a.get("updated_at", ""), reverse=True)
    return apps


@router.post("/apps")
def create_app(body: SandboxAppCreate):
    """Create a new sandbox app with a template index.html."""
    SANDBOX_DIR.mkdir(parents=True, exist_ok=True)
    slug = _ensure_unique_slug(_slugify(body.name))
    app_dir = SANDBOX_DIR / slug
    app_dir.mkdir(parents=True, exist_ok=True)

    now = datetime.now(timezone.utc).isoformat()
    manifest = {
        "name": body.name.strip(),
        "description": body.description.strip() if body.description else "",
        "created_at": now,
        "updated_at": now,
    }
    _write_manifest(app_dir, manifest)

    # Write template index.html
    html = TEMPLATE_HTML.format(name=html_mod.escape(body.name.strip()))
    (app_dir / "index.html").write_text(html)

    return _app_to_dict(slug, app_dir)


@router.get("/apps/{app_id}")
def get_app(app_id: str):
    """Get sandbox app metadata."""
    app_dir = (SANDBOX_DIR / app_id).resolve()
    if not str(app_dir).startswith(str(SANDBOX_DIR.resolve())) or not app_dir.is_dir():
        raise HTTPException(404, "App not found")
    return _app_to_dict(app_id, app_dir)


@router.patch("/apps/{app_id}")
def update_app(app_id: str, body: SandboxAppUpdate):
    """Rename or update description. Returns new id if slug changed."""
    app_dir = (SANDBOX_DIR / app_id).resolve()
    if not str(app_dir).startswith(str(SANDBOX_DIR.resolve())) or not app_dir.is_dir():
        raise HTTPException(404, "App not found")

    manifest = _read_manifest(app_dir)
    if body.name is not None:
        manifest["name"] = body.name.strip()
    if body.description is not None:
        manifest["description"] = body.description.strip()
    manifest["updated_at"] = datetime.now(timezone.utc).isoformat()
    _write_manifest(app_dir, manifest)

    # If name changed, try to rename directory to match new slug
    new_id = app_id
    if body.name is not None:
        new_slug = _slugify(body.name)
        if new_slug != app_id and not (SANDBOX_DIR / new_slug).exists():
            new_dir = SANDBOX_DIR / new_slug
            app_dir.rename(new_dir)
            new_id = new_slug
            app_dir = new_dir

    return _app_to_dict(new_id, app_dir)


@router.delete("/apps/{app_id}")
def delete_app(app_id: str):
    """Delete a sandbox app and all its files."""
    app_dir = (SANDBOX_DIR / app_id).resolve()
    if not str(app_dir).startswith(str(SANDBOX_DIR.resolve())) or not app_dir.is_dir():
        raise HTTPException(404, "App not found")
    shutil.rmtree(app_dir)
    return {"ok": True}


@router.get("/apps/{app_id}/files")
def list_files(app_id: str):
    """List files in a sandbox app."""
    app_dir = (SANDBOX_DIR / app_id).resolve()
    if not str(app_dir).startswith(str(SANDBOX_DIR.resolve())) or not app_dir.is_dir():
        raise HTTPException(404, "App not found")
    files = []
    for f in sorted(app_dir.rglob("*")):
        if f.is_file() and f.name != "manifest.json":
            files.append(str(f.relative_to(app_dir)))
    return files


@router.get("/apps/{app_id}/files/{file_path:path}")
def serve_file(app_id: str, file_path: str):
    """Serve a file from a sandbox app (used by iframe)."""
    app_dir = (SANDBOX_DIR / app_id).resolve()
    if not str(app_dir).startswith(str(SANDBOX_DIR.resolve())) or not app_dir.is_dir():
        raise HTTPException(404, "App not found")

    target = (app_dir / file_path).resolve()
    # Path traversal protection
    if not str(target).startswith(str(app_dir)):
        raise HTTPException(403, "Access denied")
    if not target.is_file():
        raise HTTPException(404, "File not found")

    content_type, _ = mimetypes.guess_type(str(target))
    return FileResponse(target, media_type=content_type or "application/octet-stream")


@router.put("/apps/{app_id}/files/{file_path:path}")
def write_file(app_id: str, file_path: str, body: SandboxFileWrite):
    """Write or overwrite a file in a sandbox app."""
    app_dir = (SANDBOX_DIR / app_id).resolve()
    if not str(app_dir).startswith(str(SANDBOX_DIR.resolve())) or not app_dir.is_dir():
        raise HTTPException(404, "App not found")

    if file_path == "manifest.json":
        raise HTTPException(403, "Cannot overwrite manifest.json")

    target = (app_dir / file_path).resolve()
    if not str(target).startswith(str(app_dir)):
        raise HTTPException(403, "Access denied")

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(body.content)

    manifest = _read_manifest(app_dir)
    manifest["updated_at"] = datetime.now(timezone.utc).isoformat()
    _write_manifest(app_dir, manifest)

    return {"ok": True, "file_path": file_path}


@router.delete("/apps/{app_id}/files/{file_path:path}")
def delete_file(app_id: str, file_path: str):
    """Delete a file from a sandbox app."""
    app_dir = (SANDBOX_DIR / app_id).resolve()
    if not str(app_dir).startswith(str(SANDBOX_DIR.resolve())) or not app_dir.is_dir():
        raise HTTPException(404, "App not found")

    if file_path == "manifest.json":
        raise HTTPException(403, "Cannot delete manifest.json")

    target = (app_dir / file_path).resolve()
    if not str(target).startswith(str(app_dir)):
        raise HTTPException(403, "Access denied")
    if not target.is_file():
        raise HTTPException(404, "File not found")

    target.unlink()

    manifest = _read_manifest(app_dir)
    manifest["updated_at"] = datetime.now(timezone.utc).isoformat()
    _write_manifest(app_dir, manifest)

    return {"ok": True}
