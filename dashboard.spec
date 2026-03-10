# -*- mode: python ; coding: utf-8 -*-
# dashboard.spec — PyInstaller build specification for Personal Dashboard
#
# Usage:
#   1. Build frontend first: cd app/frontend && npm ci && npm run build
#   2. Run: pyinstaller dashboard.spec --clean --noconfirm
#   3. Output: dist/Dashboard.app

import os
from pathlib import Path

block_cipher = None
backend_dir = Path("app/backend")
frontend_dist = Path("app/frontend/dist")

# Data files to include in the bundle
datas = []

# Frontend dist (built React app)
if frontend_dist.exists():
    datas.append((str(frontend_dist), "frontend/dist"))

# Alembic migrations + config
datas.append((str(backend_dir / "alembic.ini"), "."))
datas.append((str(backend_dir / "alembic"), "alembic"))

a = Analysis(
    [str(backend_dir / "launch.py")],
    pathex=[str(backend_dir)],
    binaries=[],
    datas=datas,
    hiddenimports=[
        # --- Uvicorn internals (dynamically loaded) ---
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.loops.asyncio",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.http.httptools_impl",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.protocols.websockets.wsproto_impl",
        "uvicorn.protocols.websockets.websockets_impl",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "uvicorn.lifespan.off",
        # --- pywebview ---
        "webview",
        "webview.platforms",
        "webview.platforms.cocoa",
        # --- FastAPI / Starlette ---
        "fastapi",
        "starlette",
        "starlette.responses",
        "starlette.routing",
        "starlette.middleware",
        "starlette.middleware.cors",
        "pydantic",
        "dotenv",
        # --- GraphQL ---
        "strawberry",
        "strawberry.fastapi",
        "graphql",
        # --- Google Auth ---
        "google.auth",
        "google.auth.transport",
        "google.auth.transport.requests",
        "google.oauth2",
        "google.oauth2.credentials",
        "googleapiclient",
        "googleapiclient.discovery",
        # --- Slack ---
        "slack_sdk",
        "slack_sdk.web",
        # --- SSL ---
        "certifi",
        # --- Database ---
        "alembic",
        "alembic.config",
        "alembic.command",
        "alembic.runtime",
        "alembic.runtime.migration",
        "alembic.script",
        "alembic.autogenerate",
        # --- App modules: routers ---
        "routers",
        "routers.auth",
        "routers.briefing",
        "routers.calendar_api",
        "routers.claude",
        "routers.claude_sessions",
        "routers.dashboard",
        "routers.drive_api",
        "routers.github_api",
        "routers.gmail",
        "routers.issue_discovery",
        "routers.issues",
        "routers.longform",
        "routers.meetings",
        "routers.news",
        "routers.notes",
        "routers.notion_api",
        "routers.people",
        "routers.personas",
        "routers.priorities",
        "routers.profile",
        "routers.projects_api",
        "routers.ramp_api",
        "routers.search",
        "routers.sheets_api",
        "routers.slack_api",
        "routers.sync",
        "routers.weather",
        "routers._ranking_cache",
        # --- App modules: connectors ---
        "connectors",
        "connectors.registry",
        "connectors._registrations",
        "connectors.calendar_sync",
        "connectors.docs",
        "connectors.drive",
        "connectors.github",
        "connectors.gmail",
        "connectors.google_auth",
        "connectors.granola",
        "connectors.markdown",
        "connectors.mcp_client",
        "connectors.news",
        "connectors.notion",
        "connectors.prosemirror",
        "connectors.ramp",
        "connectors.sheets",
        "connectors.slack",
        # --- App modules: graphql_api ---
        "graphql_api",
        "graphql_api.context",
        "graphql_api.loaders",
        "graphql_api.resolvers",
        "graphql_api.types",
        "graphql_api.types.calendar",
        "graphql_api.types.drive",
        "graphql_api.types.email",
        "graphql_api.types.github",
        "graphql_api.types.issue",
        "graphql_api.types.longform",
        "graphql_api.types.meeting",
        "graphql_api.types.news",
        "graphql_api.types.note",
        "graphql_api.types.person",
        "graphql_api.types.project",
        "graphql_api.types.ramp",
        "graphql_api.types.search",
        "graphql_api.types.slack",
        # --- App modules: utils ---
        "utils",
        "utils.notion_blocks",
        "utils.person_matching",
        "utils.person_linker",
        "utils.safe_sql",
        # --- App modules: top-level ---
        "main",
        "config",
        "app_config",
        "database",
        "models",
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=[
        "tkinter",
        "matplotlib",
        "scipy",
        "numpy",
        "pytest",
        "ruff",
        "pip",
        "setuptools",
    ],
    cipher=block_cipher,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="Dashboard",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,  # UPX breaks macOS code signing
    console=False,
    target_arch="arm64",
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    name="Dashboard",
)

app = BUNDLE(
    coll,
    name="Dashboard.app",
    icon="Dashboard.app/Contents/Resources/AppIcon.icns",
    bundle_identifier="com.personal-dashboard.app",
    info_plist={
        "CFBundleName": "Dashboard",
        "CFBundleDisplayName": "Personal Dashboard",
        "CFBundleVersion": os.environ.get("APP_VERSION", "1.0.0"),
        "CFBundleShortVersionString": os.environ.get("APP_VERSION", "1.0.0"),
        "LSMinimumSystemVersion": "12.0",
        "NSHighResolutionCapable": True,
        "LSArchitecturePriority": ["arm64", "x86_64"],
        "NSAppTransportSecurity": {"NSAllowsArbitraryLoads": True},
    },
)
