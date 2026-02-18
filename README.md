# Rich's Dashboard

Personal team management dashboard for Rich Whitcomb (CTO, Osmo). Centralizes meetings, 1:1s, notes, Gmail, Calendar, Slack, Notion, Granola, GitHub, Ramp, and news into a single local app with embedded Claude Code terminal. Runs as a native macOS app or in the browser during development.

## Prerequisites

- Python 3.11+ with `venv`
- Node.js with `npm`
- macOS (required for native app mode)
- [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) (`gcloud`)
- [Granola](https://granola.ai) desktop app (for meeting notes)

## Quick Start

```bash
# Install dependencies and run
make start        # Full setup: installs deps + builds + opens native app

# Or for development with hot reload
make dev          # Backend (port 8000) + frontend (port 5173)
```

Open [http://localhost:5173](http://localhost:5173) in your browser during dev, or run `make app` to launch the native macOS app.

**First time?** You'll need to authenticate connections (see [Authenticating Connections](#authenticating-connections) below).

## Make Commands

| Command | Description |
|---------|-------------|
| `make dev` | Start backend (port 8000) + frontend (port 5173) with hot reload |
| `make build` | Build production frontend to `dist/` |
| `make app` | Build and launch native macOS `Dashboard.app` |
| `make start` | Full setup: update deps + build + open app |
| `make stop` | Kill servers on ports 8000 and 5173 |
| `make restart` | Stop + start in dev mode |
| `make status` | Check if servers are running |
| `make logs` | Tail backend + frontend logs |

Dev logs: `/tmp/dashboard-backend.log`, `/tmp/dashboard-frontend.log`

## Features

- **Dashboard**: AI-powered morning priorities, today's calendar, recent email, Slack mentions, Notion updates, and news feed
- **Notes**: Task management with `@mention` autocomplete, employee linking, and 1:1 topic tracking
- **Thoughts**: Separate view for `[t]`-prefixed notes (personal thoughts)
- **Team Org Chart**: Hierarchical view of executives and direct reports
- **Employee Pages**: Per-person detail with upcoming meetings, 1:1 topics, notes, and meeting history
- **Email**: Gmail integration with search, unread count, and full thread viewing
- **Calendar**: Google Calendar sync with event search
- **Slack**: Message history, DM tracking, mentions, and message sending
- **Notion**: Recently edited pages with full content reading
- **GitHub**: Pull requests, issues, and repository activity
- **Ramp**: Expense tracking and financial data
- **Granola**: Meeting transcripts and summaries from Granola recordings
- **News Feed**: Aggregated news from Slack, email, and Google News RSS with infinite scroll
- **Claude Code**: Embedded terminal running Claude Code CLI with full dashboard context

## Pages & Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Dashboard | AI morning priorities, calendar, email, Slack, Notion, news |
| `/notes` | Notes | Task CRUD with @mention autocomplete and employee linking |
| `/thoughts` | Thoughts | Notes prefixed with `[t]` — personal thoughts view |
| `/news` | News | Infinite scroll news from Slack, email, Google News |
| `/team` | Org Chart | Org tree: executives + direct reports hierarchy |
| `/employees/:id` | Employee | Person detail: next meeting, 1:1 topics, notes, history |
| `/email` | Email | Gmail inbox with search and thread reading |
| `/calendar` | Calendar | Google Calendar events with search |
| `/slack` | Slack | Slack messages, channels, and DM history |
| `/notion` | Notion | Recently edited Notion pages |
| `/github` | GitHub | Pull requests and issues |
| `/ramp` | Ramp | Expense tracking |
| `/meetings` | Meetings | Granola meeting history |
| `/claude` | Claude Code | Embedded Claude Code terminal via WebSocket |
| `/settings` | Settings | Auth status, connection tests, manual sync |

## Authenticating Connections

The dashboard pulls data from seven sources. Each has a different auth method.

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

### 5. GitHub

Uses a personal access token for read-only access to pull requests and issues.

**Setup:**

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens) and create a new classic token
2. Select scopes: `repo` (for private repos) or `public_repo` (for public only), `read:org`, `read:user`
3. Copy the token

**Add to environment:**

```bash
# app/backend/.env
GITHUB_TOKEN=ghp_your-token-here
```

### 6. Ramp

Uses a Ramp API token for expense tracking and financial data.

**Setup:**

1. Contact your Ramp administrator to generate an API token
2. Copy the token

**Add to environment:**

```bash
# app/backend/.env
RAMP_TOKEN=your-ramp-token-here
```

### 7. Gemini (Optional - for AI Priorities)

Uses Google's Gemini API for generating morning priority briefings.

**Setup:**

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and create an API key
2. Copy the key

**Add to environment:**

```bash
# app/backend/.env
GEMINI_API_KEY=your-api-key-here
```

Without this, the `/api/priorities` endpoint won't work, but all other features function normally.

## Environment File

Copy the example and fill in your tokens:

```bash
cp app/backend/.env.example app/backend/.env
```

The `.env` file should contain:

```bash
# Required for full functionality
SLACK_TOKEN=xoxb-...
NOTION_TOKEN=secret_...
GITHUB_TOKEN=ghp_...
RAMP_TOKEN=...

# Optional
GEMINI_API_KEY=...  # For AI priorities feature
```

**Note:** Google and Granola don't use the `.env` file — Google uses `gcloud` credentials, Granola reads a local cache file.

## Syncing Data

Data syncs automatically on app startup (markdown + Granola only). You can also trigger syncs manually:

- **Sync everything:** `POST /api/sync`
- **Sync one source:** `POST /api/sync/{source}` where source is:
  - `markdown` — team files in `teams/`, `executives/`, `hidden/`
  - `granola` — Granola meeting cache
  - `gmail` — last 50 emails
  - `calendar` — events (7 days back, 14 days ahead)
  - `slack` — DMs and mentions
  - `notion` — recently edited pages
  - `github` — pull requests and issues
  - `ramp` — expenses
  - `news` — extract URLs from Slack/email + fetch Google News RSS
- **Check sync status:** `GET /api/sync/status`

Use the Settings page (`/settings`) to see connection status and trigger manual syncs.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI 0.115, Uvicorn, Python 3.11+ |
| Frontend | React 19, TypeScript, Vite 7, React Router 7 |
| State | TanStack React Query (no Redux/Zustand) |
| Database | SQLite (WAL mode) at `app/database/rich.db` |
| Styling | Custom Tufte CSS (`app/frontend/src/styles/tufte.css`) — no Tailwind/MUI |
| Native app | pywebview wrapping the web frontend |
| AI | Gemini 2.0 Flash (morning priorities) |
| Terminal | xterm.js via WebSocket PTY for embedded Claude Code |

## Database

SQLite database at `app/database/rich.db` with 11 tables:

- `employees` — team members with hierarchy
- `notes` — todos with @mentions, employee linking, 1:1 topics
- `calendar_events` — Google Calendar sync
- `emails` — Gmail inbox cache
- `slack_messages` — Slack DMs and mentions
- `notion_pages` — recently edited Notion pages
- `granola_meetings` — meeting transcripts and summaries
- `meeting_files` — parsed markdown meeting notes
- `news_items` — aggregated news from multiple sources
- `sync_state` — last sync timestamps per source
- `dismissed_priorities` — dismissed AI priorities

Query directly: `sqlite3 app/database/rich.db`

## Team Data Structure

Employee profiles and meeting notes live in markdown files:

```
teams/{person}/           # Direct reports
  role.md                 # Title, responsibilities, goals
  1-1.md                  # Running 1:1 topics and notes
  meetings/               # Meeting notes (markdown)
    2024-01-15-topic.md   # Individual meeting files

executives/{person}/      # Executive team (same structure)

hidden/{person}/          # Private team data (not synced to public repos)
```

The markdown connector reads these files on startup and populates the `employees` and `meeting_files` tables.

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
├── app/
│   ├── backend/
│   │   ├── main.py              # FastAPI app, startup, router registration
│   │   ├── config.py            # Paths, constants, API limits
│   │   ├── database.py          # SQLite schema (11 tables), init
│   │   ├── models.py            # Pydantic request/response models
│   │   ├── alembic/             # Database migrations (Alembic)
│   │   ├── routers/             # API endpoints
│   │   │   ├── dashboard.py     # GET /api/dashboard — aggregated overview
│   │   │   ├── employees.py     # Employee list and detail
│   │   │   ├── notes.py         # Notes CRUD with @mentions
│   │   │   ├── priorities.py    # AI morning briefing
│   │   │   ├── sync.py          # Trigger data sync
│   │   │   ├── auth.py          # OAuth flows and status
│   │   │   ├── gmail.py         # Gmail search and threads
│   │   │   ├── calendar_api.py  # Calendar search and events
│   │   │   ├── slack_api.py     # Slack search, channels, messaging
│   │   │   ├── notion_api.py    # Notion search and pages
│   │   │   ├── github_api.py    # GitHub PRs and issues
│   │   │   ├── ramp_api.py      # Ramp expenses
│   │   │   ├── meetings.py      # Granola meetings
│   │   │   ├── news.py          # News feed
│   │   │   ├── search.py        # Global search
│   │   │   └── claude.py        # WebSocket PTY for Claude Code
│   │   ├── connectors/          # External service integrations
│   │   │   ├── google_auth.py   # OAuth 2.0 token management
│   │   │   ├── gmail.py         # Inbox sync (50 messages)
│   │   │   ├── calendar_sync.py # Events: 7 days back, 14 days ahead
│   │   │   ├── drive.py         # Google Drive file access
│   │   │   ├── sheets.py        # Google Sheets reading
│   │   │   ├── slack.py         # DMs + mentions
│   │   │   ├── notion.py        # Recently edited pages
│   │   │   ├── github.py        # PR and issue sync
│   │   │   ├── ramp.py          # Expense sync
│   │   │   ├── granola.py       # Local Granola cache parsing
│   │   │   ├── markdown.py      # teams/ directory → employees + meetings
│   │   │   └── news.py          # URL extraction + Google News RSS
│   │   ├── utils/
│   │   │   ├── employee_matching.py  # Map emails/names to employee IDs
│   │   │   └── notion_blocks.py      # Notion block parsing
│   │   └── requirements.txt
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── main.tsx         # Entry point
│   │   │   ├── App.tsx          # Router + layout
│   │   │   ├── api/
│   │   │   │   ├── client.ts    # Fetch wrapper
│   │   │   │   ├── hooks.ts     # React Query hooks (all API calls)
│   │   │   │   └── types.ts     # TypeScript interfaces
│   │   │   ├── pages/
│   │   │   │   ├── DashboardPage.tsx  # Home: priorities, calendar, email
│   │   │   │   ├── NotePage.tsx       # Notes with @mention autocomplete
│   │   │   │   ├── ThoughtsPage.tsx   # [t]-prefixed notes
│   │   │   │   ├── EmployeePage.tsx   # Person detail
│   │   │   │   ├── OrgTreePage.tsx    # Team org chart
│   │   │   │   ├── EmailPage.tsx      # Gmail inbox
│   │   │   │   ├── SlackPage.tsx      # Slack messages
│   │   │   │   ├── NotionPage.tsx     # Notion pages
│   │   │   │   ├── GitHubPage.tsx     # GitHub PRs/issues
│   │   │   │   ├── RampPage.tsx       # Ramp expenses
│   │   │   │   ├── MeetingsPage.tsx   # Granola meetings
│   │   │   │   ├── NewsPage.tsx       # Infinite scroll news
│   │   │   │   ├── SettingsPage.tsx   # Auth status, sync controls
│   │   │   │   └── ClaudePage.tsx     # Embedded Claude Code terminal
│   │   │   ├── components/
│   │   │   │   ├── layout/Sidebar.tsx # Navigation, team list
│   │   │   │   └── shared/            # TimeAgo, MarkdownRenderer
│   │   │   ├── hooks/
│   │   │   │   ├── useKeyboardShortcuts.ts  # Global shortcuts
│   │   │   │   ├── useFocusNavigation.ts    # Tab navigation
│   │   │   │   └── useUndo.ts               # Undo/redo for notes
│   │   │   └── styles/tufte.css      # All styling (Tufte-inspired)
│   │   ├── package.json
│   │   └── vite.config.ts            # Dev proxy to backend
│   └── database/
│       └── rich.db                    # SQLite database
├── teams/                             # Direct reports (markdown)
├── executives/                        # Exec team (markdown)
├── hidden/                            # Private team data
├── projects/                          # Project-specific folders
├── Dashboard.app/                     # Built native macOS app
├── Makefile                           # Dev workflow
├── CLAUDE.md                          # Detailed project instructions for Claude
└── README.md
```

## Usage Tips

### Notes & Task Management

- Create notes with `@Name` to link to a team member
- Prefix with `[1]` to auto-link to 1:1 topics: `[1] @Alice discuss Q1 goals`
- Prefix with `[t]` for personal thoughts: `[t] idea for new feature`
- Set priority (1-5) and due dates
- Mark notes as done by clicking the checkbox

### Embedded Claude Code

The Claude page (`/claude`) runs a full Claude Code CLI session inside the dashboard:

- Has access to the entire dashboard codebase
- Can read/edit files, run commands, query the database
- Knows about the dashboard API and can interact with it
- Use it to debug, add features, or analyze data
- Full context about your team and the dashboard structure

### Keyboard Shortcuts

- `Cmd+K` — Focus search
- `Cmd+N` — New note
- `Cmd+Z` / `Cmd+Shift+Z` — Undo/redo in note editor
- `Tab` / `Shift+Tab` — Navigate focusable elements
- Arrow keys — Navigate lists

### API Access

All dashboard data is accessible via REST API at `http://localhost:8000`:

```bash
# Get dashboard overview
curl http://localhost:8000/api/dashboard

# List employees
curl http://localhost:8000/api/employees

# Search Gmail
curl "http://localhost:8000/api/gmail/search?q=from:alice+subject:review"

# Search Slack
curl "http://localhost:8000/api/slack/search?q=deployment+in:%23engineering"

# Create a note
curl -X POST http://localhost:8000/api/notes \
  -H "Content-Type: application/json" \
  -d '{"text": "[1] @Alice discuss Q1 goals", "priority": 1}'
```

See [CLAUDE.md](CLAUDE.md) for full API documentation.

## Development

### Backend

```bash
cd app/backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd app/frontend
npm run dev
```

The frontend dev server proxies API requests to `http://localhost:8000`.

### Database Migrations

Database schema changes use Alembic:

```bash
cd app/backend
alembic revision --autogenerate -m "description"
alembic upgrade head
```

### Building the Native App

```bash
make build   # Build frontend
make app     # Create Dashboard.app
```

The app is built using `pywebview` and appears as a native macOS application in `Dashboard.app/`.

## Troubleshooting

### Google Auth Issues

If Gmail/Calendar sync fails:

```bash
# Re-authenticate with gcloud
gcloud auth application-default login \
  --scopes='https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/calendar.readonly,https://www.googleapis.com/auth/drive.readonly,https://www.googleapis.com/auth/spreadsheets.readonly'

# Or trigger browser OAuth flow
curl -X POST http://localhost:8000/api/auth/google

# Delete cached token and try again
rm app/backend/.google_token.json
```

### Check Connection Status

Visit `/settings` in the app or:

```bash
curl http://localhost:8000/api/auth/status
```

### View Logs

```bash
# Backend logs
tail -f /tmp/dashboard-backend.log

# Frontend logs
tail -f /tmp/dashboard-frontend.log

# Or both
make logs
```

### Database Issues

If the database seems corrupted or out of sync:

```bash
# Backup first
cp app/database/rich.db app/database/rich.db.backup

# Run migrations
cd app/backend
alembic upgrade head

# Or rebuild from scratch (WARNING: deletes all data)
rm app/database/rich.db
# Restart the backend to rebuild schema
```

### Port Conflicts

If ports 8000 or 5173 are in use:

```bash
# Kill processes on those ports
lsof -ti:8000 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# Or use make
make stop
```

## Architecture Notes

- **Local-only**: Runs entirely on your Mac, no cloud deployment
- **No authentication**: Backend has no auth layer — trusted local environment
- **Single user**: Designed for Rich's personal use, not multi-tenant
- **Read-mostly**: Most connectors are read-only (except Slack messaging)
- **Sync-on-demand**: Data syncs manually or on startup, not real-time
- **Markdown-driven**: Team structure and meeting notes live in git-tracked markdown files
- **No test suite**: No pytest/jest/vitest configured (yet)

## Contributing

This is a personal project for Rich Whitcomb. If you're on the Osmo team and want to adapt it for your own use, feel free to fork it!

Key customization points:
- `teams/`, `executives/`, `hidden/` directory structure
- `app/backend/.env` tokens for your accounts
- Employee list in `database.py` (or let markdown sync populate it)
- Styling in `app/frontend/src/styles/tufte.css`

## License

Private project — no public license.
