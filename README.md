# Rich's Dashboard

A personal team management dashboard that centralizes meetings, todos, calendar, email, Slack, and Notion into one place. Runs as a native macOS app or in the browser during development.

## Prerequisites

- Python 3.11+ with `venv`
- Node.js with `npm`
- macOS (required for native app mode)
- [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) (`gcloud`)
- [Granola](https://granola.ai) desktop app (for meeting notes)

## Quick Start

```bash
# 1. Set up the backend
cd app/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. Set up the frontend
cd app/frontend
npm install

# 3. Configure connections (see below)

# 4. Run in dev mode
make dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser, or run `make app` to launch the native macOS app.

## Make Commands

| Command | Description |
|---------|-------------|
| `make dev` | Start backend + frontend with hot reload |
| `make build` | Build production frontend |
| `make app` | Build and launch native macOS app |
| `make stop` | Stop running servers |
| `make restart` | Restart everything |
| `make status` | Check if servers are running |
| `make logs` | View recent server logs |

## Authenticating Connections

The dashboard pulls data from four sources. Each has a different auth method.

### 1. Google (Gmail + Calendar)

Uses OAuth 2.0 via Google Cloud Application Default Credentials.

**First-time setup:**

```bash
gcloud auth application-default login \
  --scopes='https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/calendar.readonly,https://www.googleapis.com/auth/drive.readonly,https://www.googleapis.com/auth/spreadsheets.readonly'
```

This opens a browser window to authenticate with your Google account. Credentials are saved to `~/.config/gcloud/application_default_credentials.json`.

On first sync, the app converts these into an app-specific token stored at `app/backend/.google_token.json`. The token refreshes automatically after that.

**If the token expires or breaks**, you can either:
- Re-run the `gcloud auth` command above, or
- Hit `POST /api/auth/google` which triggers a browser-based OAuth flow on port 8080

### 2. Slack

Uses a Slack API token (bot or user token).

**Setup:**

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create an app (or use an existing one)
2. Under **OAuth & Permissions**, add scopes for reading messages (e.g., `channels:history`, `im:history`, `search:read`)
3. Install the app to your workspace and copy the token

**Add to environment:**

```bash
# app/backend/.env
SLACK_TOKEN=xoxb-your-token-here
```

A bot token (`xoxb-...`) or user token (`xoxp-...`) both work. User tokens can access DMs directly.

### 3. Notion

Uses a Notion internal integration token.

**Setup:**

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) and create a new integration
2. Copy the **Internal Integration Secret** (starts with `secret_...`)
3. In Notion, share the pages/databases you want synced with your integration

**Add to environment:**

```bash
# app/backend/.env
NOTION_TOKEN=secret_your-token-here
```

### 4. Granola

No authentication needed. The app reads directly from Granola's local cache file at:

```
~/Library/Application Support/Granola/cache-v3.json
```

Just make sure the Granola desktop app is installed and has recorded at least one meeting. Meeting data syncs automatically on startup.

## Environment File

Copy the example and fill in your tokens:

```bash
cp app/backend/.env.example app/backend/.env
```

The `.env` file needs:

```
SLACK_TOKEN=xoxb-...
NOTION_TOKEN=secret_...
```

Google and Granola don't use the `.env` file (Google uses gcloud credentials, Granola reads a local cache).

## Syncing Data

Data syncs automatically on app startup. You can also trigger syncs manually:

- **Sync everything:** `POST /api/sync`
- **Sync one source:** `POST /api/sync/{source}` where source is `gmail`, `calendar`, `slack`, `notion`, `granola`, or `markdown`
- **Check sync status:** `GET /api/sync/status`

## Executive Team

| Name | Title |
|------|-------|
| Alex Wiltschko | CEO |
| **Rich Whitcomb** | **CTO** |
| Mike Rytokoski | CCO |
| Nate Pearson | CFO |
| Mateusz Brzuchacz | COO |

*Alex is Rich's manager.*

## Direct Reports

| Name | Title |
|------|-------|
| Benjamin Amorelli | Director of Synthetic Chemistry |
| Brian Hauck | Director, Sensors |
| Frances Lam | Software Product Manager |
| Guillaume Godin | MLE (Machine Learning Engineer) |
| Karen Mak | Manager, Platform |
| Kasey Luo | Group Product Manager |
| Kate Hajash | Staff Machine Learning Engineer |
| Laurianne Paravisini | Director of Applied Chemistry |
| Sam Gerstein | Principal Site Reliability Engineer |
| Versha Prakash | Director, Technical Operations |
| Wesley Qian | Director, Applied Research |

## Project Structure

```
.
├── app/
│   ├── backend/          # FastAPI + Python
│   │   ├── connectors/   # Google, Slack, Notion, Granola integrations
│   │   ├── routers/      # API endpoints
│   │   ├── main.py       # App entry point
│   │   ├── config.py     # Paths and constants
│   │   └── .env          # Your tokens (not committed)
│   ├── frontend/         # React + TypeScript + Vite
│   │   └── src/
│   │       ├── pages/    # Dashboard, Todos, OrgTree, Employee
│   │       ├── api/      # API client and hooks
│   │       └── components/
│   └── database/         # SQLite database
├── teams/                # Team org structure (markdown files)
├── Makefile              # Dev workflow commands
└── Dashboard.app/        # Built native macOS app
```
