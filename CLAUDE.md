# CLAUDE.md — Personal Dashboard

Personal team management dashboard. Centralizes meetings, 1:1s, notes, Gmail, Calendar, Slack, Notion, Granola, GitHub, Ramp, and news into a single local app.

## Quick Start

```bash
make dev        # Backend (port 8000) + frontend (port 5173) with hot reload
make build      # Build frontend to dist/
make app        # Open native macOS Dashboard.app
make start      # Full: update deps + build + open app
make stop       # Kill servers on 8000/5173
make restart    # Stop + start dev mode
make status     # Check if servers are running
make logs       # Tail backend + frontend logs
make lint       # Python (ruff) + TypeScript (tsc + eslint) linting
make fmt        # Auto-format Python and TypeScript
make test       # Run Playwright tests (requires make dev running)
make db-upgrade # Run Alembic database migrations
```

Dev logs: `/tmp/dashboard-backend.log`, `/tmp/dashboard-frontend.log`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI 0.115, Uvicorn, Python 3.11+ |
| Frontend | React 19, TypeScript, Vite 7, React Router 7 |
| State | TanStack React Query (no Redux/Zustand) |
| Database | SQLite (WAL mode) in `~/.personal-dashboard/dashboard.db` |
| Styling | Custom Tufte CSS (`app/frontend/src/styles/tufte.css`) — no Tailwind/MUI |
| Native app | pywebview wrapping the web frontend |
| AI | Gemini 2.0 Flash (morning priorities) |
| GraphQL | Strawberry GraphQL at `/graphql` — knowledge graph over all data |
| Terminal | xterm.js via WebSocket PTY for embedded Claude Code |

## Configuration & Data

All user data lives in `~/.personal-dashboard/` (or `DASHBOARD_DATA_DIR` env var):

```
~/.personal-dashboard/
  config.json      # Profile, secrets, connector settings (chmod 0600)
  dashboard.db     # SQLite database
```

Key modules:
- `app/backend/app_config.py` — Config file manager (`load_config`, `get_secret`, `get_prompt_context`)
- `app/backend/config.py` — Paths, constants, data directory resolution
- `app/backend/connectors/registry.py` — Plugin connector registry
- `app/backend/connectors/_registrations.py` — All connector definitions

Secrets are stored in `config.json` with 0600 permissions. Environment variables (`.env`) are also supported as fallback.

## Project Structure

```
├── app/
│   ├── backend/
│   │   ├── main.py              # FastAPI app, startup, router registration
│   │   ├── config.py            # Paths, constants, data dir resolution
│   │   ├── app_config.py        # Config.json manager (secrets, profile, connectors)
│   │   ├── database.py          # SQLite schema, init, migrations
│   │   ├── models.py            # Pydantic request/response models
│   │   ├── alembic/             # Database migrations
│   │   ├── routers/             # API endpoints
│   │   │   ├── dashboard.py     # GET /api/dashboard — aggregated overview
│   │   │   ├── briefing.py      # GET /api/briefing — morning briefing aggregation
│   │   │   ├── people.py        # CRUD /api/people — coworkers, contacts, groups
│   │   │   ├── notes.py         # CRUD /api/notes — todos with @mentions
│   │   │   ├── issues.py        # CRUD /api/issues — local issue tracking
│   │   │   ├── issue_discovery.py # POST /api/issues/discover — AI issue scanning
│   │   │   ├── longform.py      # CRUD /api/longform — blog posts, drafts, comments
│   │   │   ├── sync.py          # POST /api/sync — trigger data sync
│   │   │   ├── auth.py          # Auth status, OAuth flows, secrets, connectors
│   │   │   ├── profile.py       # GET/PATCH /api/profile, setup status
│   │   │   ├── priorities.py    # GET /api/priorities — AI morning briefing
│   │   │   ├── search.py        # GET /api/search — global full-text search
│   │   │   ├── meetings.py      # GET /api/meetings — meeting notes
│   │   │   ├── weather.py       # GET /api/weather — current weather with caching
│   │   │   ├── gmail.py         # Gmail search and threads
│   │   │   ├── calendar_api.py  # Calendar search
│   │   │   ├── slack_api.py     # Slack search, channels, messaging
│   │   │   ├── notion_api.py    # Notion search and pages
│   │   │   ├── github_api.py    # GitHub PRs and issues
│   │   │   ├── drive_api.py     # Google Drive files with Gemini ranking
│   │   │   ├── sheets_api.py    # Google Sheets
│   │   │   ├── ramp_api.py      # Ramp transactions, bills, vendors
│   │   │   ├── projects_api.py  # Ramp project/budget tracking
│   │   │   ├── _ranking_cache.py # Caching utilities for Gemini AI rankings
│   │   │   ├── news.py          # GET /api/news — paginated news feed
│   │   │   ├── claude.py        # WS /api/ws/claude — Claude Code PTY
│   │   │   ├── claude_sessions.py # Claude Code session management
│   │   │   └── personas.py      # Claude Code persona management
│   │   └── connectors/          # External service integrations (plugin architecture)
│   │       ├── registry.py      # Connector registry + metadata
│   │       ├── _registrations.py # All connector definitions
│   │       ├── google_auth.py   # OAuth 2.0 token management
│   │       ├── gmail.py         # Inbox sync
│   │       ├── calendar_sync.py # Calendar event sync
│   │       ├── slack.py         # DMs + mentions
│   │       ├── notion.py        # Recently edited pages
│   │       ├── github.py        # PR and issue sync
│   │       ├── ramp.py          # Transaction, bill, and vendor sync
│   │       ├── granola.py       # Local Granola cache parsing
│   │       ├── markdown.py      # teams/ directory → employees + meetings (legacy)
│   │       ├── drive.py         # Google Drive file sync
│   │       ├── sheets.py        # Google Sheets
│   │       └── news.py          # URL extraction + Google News RSS
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── main.tsx         # Entry point
│   │   │   ├── App.tsx          # Router + layout + setup redirect
│   │   │   ├── api/
│   │   │   │   ├── client.ts    # Fetch wrapper
│   │   │   │   ├── hooks.ts     # React Query hooks (all API calls)
│   │   │   │   ├── types.ts     # TypeScript interfaces
│   │   │   │   └── errorLog.ts  # In-memory error queue
│   │   │   ├── pages/
│   │   │   │   ├── BriefingPage.tsx   # Home: weather, inbox, calendar, priorities, digest
│   │   │   │   ├── DashboardPage.tsx  # Legacy dashboard (still available)
│   │   │   │   ├── PrioritiesPage.tsx # Detailed AI priority rankings
│   │   │   │   ├── SetupPage.tsx      # First-run onboarding wizard
│   │   │   │   ├── SettingsPage.tsx   # Profile, connectors, sync controls
│   │   │   │   ├── NotePage.tsx       # Notes with @mention autocomplete
│   │   │   │   ├── ThoughtsPage.tsx   # Notes prefixed with [t]
│   │   │   │   ├── IssuesPage.tsx     # Local issue tracking + AI discovery
│   │   │   │   ├── LongformPage.tsx   # Blog posts/drafts with markdown editor
│   │   │   │   ├── PeoplePage.tsx     # People directory (coworkers + contacts)
│   │   │   │   ├── PersonPage.tsx     # Person detail: meetings, topics, attributes
│   │   │   │   ├── OrgTreePage.tsx    # Team org chart
│   │   │   │   ├── MeetingsPage.tsx   # Calendar + Granola meeting history
│   │   │   │   ├── EmailPage.tsx      # Gmail inbox with search
│   │   │   │   ├── SlackPage.tsx      # Slack messages and channels
│   │   │   │   ├── NotionPage.tsx     # Notion pages
│   │   │   │   ├── DrivePage.tsx      # Google Drive with Gemini ranking
│   │   │   │   ├── GitHubPage.tsx     # Pull requests and issues
│   │   │   │   ├── RampPage.tsx       # Transactions, bills, projects
│   │   │   │   ├── NewsPage.tsx       # Aggregated news feed
│   │   │   │   ├── ClaudePage.tsx     # Embedded Claude Code terminal
│   │   │   │   ├── PersonasPage.tsx   # Claude persona/session management
│   │   │   │   └── HelpPage.tsx       # Feature overview and keyboard shortcuts
│   │   │   ├── components/
│   │   │   │   ├── layout/Sidebar.tsx # Navigation, team list
│   │   │   │   └── shared/           # TimeAgo, MarkdownRenderer
│   │   │   └── styles/tufte.css      # All styling (Tufte-inspired)
│   │   ├── package.json
│   │   └── vite.config.ts            # Dev proxy to backend
│   ├── test/                          # Playwright end-to-end tests
│   └── database/                      # Legacy DB location (auto-detected)
├── Makefile                           # Dev workflow
└── README.md
```

## Frontend Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/` | BriefingPage | Morning briefing: weather, inbox pulse, calendar, AI priorities, overnight digest |
| `/priorities` | PrioritiesPage | Detailed AI priority rankings view |
| `/setup` | SetupPage | First-run onboarding wizard |
| `/settings` | SettingsPage | Profile, connectors, sync controls |
| `/notes` | NotePage | Notes CRUD with @mention autocomplete and person linking |
| `/thoughts` | ThoughtsPage | Notes prefixed with `[t]` — separate view |
| `/issues` | IssuesPage | Local issue tracking with priority, sizing, tags, and AI discovery |
| `/longform` | LongformPage | Blog posts/drafts: markdown editor, tags, comments, split view |
| `/news` | NewsPage | Infinite scroll news from Slack, email, Google News |
| `/team` | OrgTreePage | Org chart: executives + direct reports tree |
| `/people` | PeoplePage | People directory: coworkers, contacts, groups |
| `/people/:id` | PersonPage | Person detail: meetings, 1:1 topics, attributes, connections |
| `/email` | EmailPage | Gmail inbox with search |
| `/slack` | SlackPage | Slack messages and channels |
| `/notion` | NotionPage | Notion pages |
| `/drive` | DrivePage | Google Drive files with Gemini AI relevance ranking |
| `/github` | GitHubPage | Pull requests and issues |
| `/ramp` | RampPage | Transactions, bills, and project tracking with AI ranking |
| `/meetings` | MeetingsPage | Calendar + Granola meeting history |
| `/claude` | ClaudePage | Embedded Claude Code terminal via WebSocket |
| `/personas` | PersonasPage | Claude Code persona and session management |
| `/help` | HelpPage | Feature overview and keyboard shortcuts |

## Database Tables

Core: `employees`, `notes`, `note_employees`, `one_on_one_notes`, `calendar_events`, `emails`, `slack_messages`, `notion_pages`, `granola_meetings`, `meeting_files`, `news_items`, `sync_state`, `dismissed_priorities`, `dismissed_dashboard_items`

Issues & projects: `issues`, `issue_employees`, `issue_meetings`, `projects`

Longform: `longform_posts`, `longform_tags`, `longform_comments`

Drive: `drive_files`

GitHub: `github_pull_requests`

Ramp: `ramp_transactions`, `ramp_bills`, `ramp_vendors`

Knowledge graph links: `email_people`, `calendar_event_people`, `drive_file_people` (+ `person_id` columns on `slack_messages`, `github_pull_requests`, `ramp_transactions`)

Claude: `personas`, `claude_sessions`, `claude_session_notes`

Caching: `cached_priorities`, `cached_ramp_priorities`, `cached_slack_priorities`, `cached_notion_priorities`, `cached_email_priorities`, `cached_news_priorities`

Full-text search (FTS): `fts_employees`, `fts_notes`, `fts_granola`, `fts_meeting_files`, `fts_one_on_one`, `fts_issues`, `fts_emails`

Schema is in `app/backend/database.py`. Migrations managed by Alembic in `app/backend/alembic/`.

## Data Sync

Sync is triggered on startup (Granola only) or manually via UI/API. Only enabled connectors are synced.

| Source | Connector | Auth |
|--------|-----------|------|
| Granola | `connectors/granola.py` | Local cache file |
| Gmail | `connectors/gmail.py` | Google OAuth |
| Calendar | `connectors/calendar_sync.py` | Google OAuth |
| Drive | `connectors/drive.py` | Google OAuth |
| Slack | `connectors/slack.py` | API token |
| Notion | `connectors/notion.py` | API token |
| GitHub | `connectors/github.py` | `gh` CLI |
| Ramp | `connectors/ramp.py` | Client credentials (incremental sync) |
| News | `connectors/news.py` | None (URL extraction + RSS) |

Legacy: `connectors/markdown.py` can sync team data from `teams/` and `executives/` directories if they exist, but this is no longer the primary team data source.

Employee matching (`utils/employee_matching.py`) maps emails/names to employee IDs.

## Auth & Secrets

Secrets are managed in `~/.personal-dashboard/config.json` (preferred) or `app/backend/.env` (fallback):
- `SLACK_TOKEN` — bot/user token
- `NOTION_TOKEN` — internal integration secret
- `GEMINI_API_KEY` — for AI priorities (optional)
- `RAMP_CLIENT_ID` / `RAMP_CLIENT_SECRET` — Ramp API credentials

Google OAuth uses `gcloud auth application-default login` → stored as `.google_token.json`.

Users can enter secrets directly in the Settings page UI.

## Key Conventions

- **Tests**: Playwright end-to-end tests in `app/test/` — run with `make test` (requires `make dev` running)
- **No CSS framework** — all styles in `tufte.css`
- **All API calls** go through React Query hooks in `api/hooks.ts`
- **Notes linking**: `@Name` autocomplete, `[1]` prefix forces 1:1, `[t]` prefix marks as thought
- **Local only** — runs on macOS, no cloud deployment, no CI/CD, no Docker
- **Plugin connectors** — each service self-registers in `connectors/_registrations.py`
- **Dynamic AI prompts** — `app_config.get_prompt_context()` personalizes all AI calls based on profile
- **Full-text search** — SQLite FTS indexes across employees, notes, meetings, emails, and issues

## Dashboard Interaction Guide

The backend is live at `http://localhost:8000`. You can interact with it via REST APIs (curl) and query the SQLite database directly.

### REST API Reference

All endpoints are at `http://localhost:8000`. Use `curl -s` and pipe through `python3 -m json.tool` for readable output.

#### Dashboard Overview
```bash
curl -s http://localhost:8000/api/dashboard | python3 -m json.tool
```

#### Profile & Setup
```bash
# Get user profile
curl -s http://localhost:8000/api/profile | python3 -m json.tool

# Update profile
curl -s -X PATCH http://localhost:8000/api/profile \
  -H "Content-Type: application/json" \
  -d '{"user_name": "Alex", "user_title": "VP Engineering"}'

# Check setup status
curl -s http://localhost:8000/api/profile/setup-status | python3 -m json.tool
```

#### Connectors
```bash
# List all connectors with metadata and enabled status
curl -s http://localhost:8000/api/connectors | python3 -m json.tool

# Enable/disable a connector
curl -s -X POST http://localhost:8000/api/connectors/slack/enable
curl -s -X POST http://localhost:8000/api/connectors/slack/disable
```

#### Secrets
```bash
# Check which secrets are configured (never returns raw values)
curl -s http://localhost:8000/api/auth/secrets | python3 -m json.tool

# Save a secret
curl -s -X POST http://localhost:8000/api/auth/secrets \
  -H "Content-Type: application/json" \
  -d '{"key": "SLACK_TOKEN", "value": "xoxb-..."}'
```

#### People
```bash
curl -s http://localhost:8000/api/people | python3 -m json.tool
curl -s "http://localhost:8000/api/people?is_coworker=true" | python3 -m json.tool
curl -s http://localhost:8000/api/people/{id} | python3 -m json.tool
curl -s http://localhost:8000/api/people/groups | python3 -m json.tool
```

#### Notes (CRUD)
```bash
curl -s "http://localhost:8000/api/notes?status=open" | python3 -m json.tool

curl -s -X POST http://localhost:8000/api/notes \
  -H "Content-Type: application/json" \
  -d '{"text": "[1] @PersonName discuss performance review", "priority": 1}'

curl -s -X PATCH http://localhost:8000/api/notes/{note_id} \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'

curl -s -X DELETE http://localhost:8000/api/notes/{note_id}
```

#### Sync (Trigger Data Refresh)
```bash
curl -s -X POST http://localhost:8000/api/sync
curl -s -X POST http://localhost:8000/api/sync/{source}
curl -s http://localhost:8000/api/sync/status | python3 -m json.tool
```

#### Auth Status
```bash
curl -s http://localhost:8000/api/auth/status | python3 -m json.tool
curl -s -X POST http://localhost:8000/api/auth/test/{service}
```

#### Briefing & Priorities
```bash
curl -s http://localhost:8000/api/briefing | python3 -m json.tool
curl -s http://localhost:8000/api/priorities | python3 -m json.tool
curl -s http://localhost:8000/api/weather | python3 -m json.tool
```

#### Issues
```bash
curl -s http://localhost:8000/api/issues | python3 -m json.tool

curl -s -X POST http://localhost:8000/api/issues \
  -H "Content-Type: application/json" \
  -d '{"title": "Fix onboarding flow", "priority": "high", "size": "medium"}'

curl -s -X PATCH http://localhost:8000/api/issues/{issue_id} \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'
```

#### Issue Discovery (AI)
```bash
curl -s -X POST http://localhost:8000/api/issues/discover | python3 -m json.tool
curl -s http://localhost:8000/api/issues/discover/status | python3 -m json.tool
curl -s http://localhost:8000/api/issues/discover/proposals | python3 -m json.tool
curl -s -X POST http://localhost:8000/api/issues/discover/{id}/accept
curl -s -X POST http://localhost:8000/api/issues/discover/{id}/reject
```

#### Longform Writing
```bash
curl -s http://localhost:8000/api/longform | python3 -m json.tool

curl -s -X POST http://localhost:8000/api/longform \
  -H "Content-Type: application/json" \
  -d '{"title": "Q1 Retrospective", "body": "# Summary\n...", "status": "draft"}'

curl -s -X PATCH http://localhost:8000/api/longform/{id} \
  -H "Content-Type: application/json" \
  -d '{"status": "published"}'

curl -s http://localhost:8000/api/longform/{id}/comments | python3 -m json.tool
```

#### Search (Global Full-Text)
```bash
curl -s "http://localhost:8000/api/search?q=quarterly+review" | python3 -m json.tool
```

#### Meetings
```bash
curl -s http://localhost:8000/api/meetings | python3 -m json.tool
```

#### Projects (Ramp Budget Tracking)
```bash
curl -s http://localhost:8000/api/projects | python3 -m json.tool
```

#### Claude Sessions & Personas
```bash
curl -s http://localhost:8000/api/claude-sessions | python3 -m json.tool
curl -s http://localhost:8000/api/personas | python3 -m json.tool
```

#### Drive
```bash
curl -s http://localhost:8000/api/drive/files | python3 -m json.tool
curl -s http://localhost:8000/api/drive/prioritized | python3 -m json.tool
```

#### News
```bash
curl -s "http://localhost:8000/api/news?offset=0&limit=20" | python3 -m json.tool
```

### Live Service APIs (Search & Interact)

These endpoints hit external APIs directly — not the synced snapshots.

#### Gmail
```bash
curl -s "http://localhost:8000/api/gmail/search?q=from:alice+subject:review&max_results=10" | python3 -m json.tool
curl -s http://localhost:8000/api/gmail/thread/{thread_id} | python3 -m json.tool
```

#### Calendar
```bash
curl -s "http://localhost:8000/api/calendar/search?q=standup" | python3 -m json.tool
```

#### Slack
```bash
# Read
curl -s "http://localhost:8000/api/slack/search?q=deployment+in:%23engineering&count=20" | python3 -m json.tool
curl -s http://localhost:8000/api/slack/channels | python3 -m json.tool

# Write
curl -s -X POST http://localhost:8000/api/slack/send \
  -H "Content-Type: application/json" \
  -d '{"channel": "C12345", "text": "Hello!"}'

curl -s -X PATCH http://localhost:8000/api/slack/message \
  -H "Content-Type: application/json" \
  -d '{"channel": "C12345", "ts": "1234567890.123456", "text": "Updated message"}'

curl -s -X DELETE "http://localhost:8000/api/slack/message?channel=C12345&ts=1234567890.123456"

curl -s -X POST http://localhost:8000/api/slack/react \
  -H "Content-Type: application/json" \
  -d '{"channel": "C12345", "ts": "1234567890.123456", "name": "thumbsup"}'
```

#### Notion
```bash
# Read
curl -s "http://localhost:8000/api/notion/search?q=roadmap&page_size=10" | python3 -m json.tool
curl -s http://localhost:8000/api/notion/pages/{page_id}/content | python3 -m json.tool

# Write
curl -s -X POST http://localhost:8000/api/notion/pages \
  -H "Content-Type: application/json" \
  -d '{"parent_id": "db_id_here", "title": "Meeting Notes"}'

curl -s -X PATCH http://localhost:8000/api/notion/pages/{page_id}/properties \
  -H "Content-Type: application/json" \
  -d '{"properties": {"Status": {"select": {"name": "Done"}}}}'

curl -s -X POST http://localhost:8000/api/notion/pages/{page_id}/blocks \
  -H "Content-Type: application/json" \
  -d '{"text": "New paragraph content to append"}'

curl -s -X DELETE http://localhost:8000/api/notion/pages/{page_id}
```

#### Gmail (Write)
```bash
curl -s -X POST http://localhost:8000/api/gmail/send \
  -H "Content-Type: application/json" \
  -d '{"to": "alice@example.com", "subject": "Re: Q1 Review", "body": "Sounds good!", "reply_to_thread_id": "thread123"}'

curl -s -X POST http://localhost:8000/api/gmail/drafts \
  -H "Content-Type: application/json" \
  -d '{"to": "bob@example.com", "subject": "Draft", "body": "..."}'

curl -s http://localhost:8000/api/gmail/drafts | python3 -m json.tool

curl -s -X POST http://localhost:8000/api/gmail/archive \
  -H "Content-Type: application/json" \
  -d '{"message_ids": ["msg_id_1", "msg_id_2"]}'

curl -s -X POST http://localhost:8000/api/gmail/trash \
  -H "Content-Type: application/json" \
  -d '{"message_ids": ["msg_id_1"]}'
```

#### Calendar (Write)
```bash
curl -s -X POST http://localhost:8000/api/calendar/events \
  -H "Content-Type: application/json" \
  -d '{"summary": "1:1 with Alice", "start_time": "2026-03-04T10:00:00-08:00", "end_time": "2026-03-04T10:30:00-08:00", "attendees": ["alice@example.com"]}'

curl -s -X PATCH http://localhost:8000/api/calendar/events/{event_id} \
  -H "Content-Type: application/json" \
  -d '{"summary": "Updated title", "location": "Room 5"}'

curl -s -X DELETE "http://localhost:8000/api/calendar/events/{event_id}?send_notifications=true"

curl -s -X POST http://localhost:8000/api/calendar/events/{event_id}/rsvp \
  -H "Content-Type: application/json" \
  -d '{"response": "accepted"}'
```

#### Docs/Sheets (Write)
```bash
curl -s -X POST http://localhost:8000/api/drive/docs \
  -H "Content-Type: application/json" \
  -d '{"title": "Q1 Retrospective", "body": "# Summary\n..."}'

curl -s -X POST http://localhost:8000/api/drive/docs/{doc_id}/append \
  -H "Content-Type: application/json" \
  -d '{"text": "New section content here"}'

curl -s -X POST http://localhost:8000/api/sheets/{sheet_id}/append \
  -H "Content-Type: application/json" \
  -d '{"range": "Sheet1", "values": [["Name", "Score"], ["Alice", "95"]]}'

curl -s -X PATCH http://localhost:8000/api/sheets/{sheet_id}/values \
  -H "Content-Type: application/json" \
  -d '{"range": "Sheet1!A1:B1", "values": [["Updated", "Values"]]}'
```

### GraphQL API (Knowledge Graph)

The GraphQL endpoint is at `http://localhost:8000/graphql`. It also serves a GraphiQL playground in the browser. The graph links people to all data sources — emails, Slack, calendar, GitHub, Drive, Ramp, notes, issues, and meetings.

#### Example Queries

**Person with all connected data:**
```graphql
query PersonContext($id: String!) {
  person(id: $id) {
    name title email
    manager { name title }
    directReports { name title }
    notes { text priority status dueDate }
    issues { title status priority tags }
    emails { subject fromName date }
    slackMessages { text channelName ts }
    calendarEvents { summary startTime endTime }
    githubPrs { title state author }
    driveFiles { name modifiedTime }
    rampTransactions { amount merchantName transactionDate }
    granolaMeetings { title panelSummaryPlain }
  }
}
```

**Search across all entities:**
```graphql
{ search(query: "quarterly review") { people { name } notes { text } issues { title } emails { subject } total } }
```

**CRUD mutations (local data):**
```graphql
mutation { createNote(text: "@Alice discuss perf review", priority: 1) { id text people { name } } }
mutation { createIssue(title: "Fix login", priority: 2, tags: ["frontend"]) { id title tags } }
mutation { updateIssue(id: 5, status: "done") { id status completedAt } }
```

**External service mutations:**
```graphql
mutation { sendSlackMessage(channel: "C12345", text: "Hello!") }
mutation { addSlackReaction(channel: "C12345", ts: "1234567890.123456", name: "thumbsup") }
mutation { createNotionPage(parentId: "db_id", title: "Meeting Notes") }
mutation { appendNotionText(pageId: "page_id", text: "New content") }
mutation { archiveNotionPage(pageId: "page_id") }
mutation { sendEmail(to: "alice@example.com", subject: "Hello", body: "...") }
mutation { archiveEmails(messageIds: ["msg_1", "msg_2"]) }
mutation { createCalendarEvent(summary: "1:1", startTime: "2026-03-04T10:00:00-08:00", endTime: "2026-03-04T10:30:00-08:00") }
mutation { deleteCalendarEvent(eventId: "event_id") }
mutation { rsvpCalendarEvent(eventId: "event_id", response: "accepted") }
mutation { createGoogleDoc(title: "Q1 Retro", body: "# Summary") }
mutation { appendToGoogleDoc(docId: "doc_id", text: "New section") }
mutation { appendSheetRows(sheetId: "sheet_id", values: [["A", "B"], ["1", "2"]]) }
mutation { updateSheetCells(sheetId: "sheet_id", range: "Sheet1!A1", values: [["Updated"]]) }
```

**Root queries:** `person(id)`, `people(isCoworker, group)`, `notes(status, personId)`, `issues(status, priority)`, `emails(limit)`, `slackMessages(limit)`, `calendarEvents(fromDate, toDate)`, `githubPrs(state)`, `driveFiles(limit)`, `rampTransactions(limit)`, `projects`, `longformPosts(status)`, `news(limit, offset)`, `search(query)`

### Direct SQLite Access

The database is at `~/.personal-dashboard/dashboard.db` (or the configured location).

#### Table Schemas

| Table | Key Columns |
|-------|-------------|
| `employees` | id, name, title, reports_to, depth, is_executive, is_coworker, group, company |
| `notes` | id, text, priority, status (open/done), employee_id, is_one_on_one, created_at, due_date |
| `issues` | id, title, description, priority, size, status, tags, due_date, created_at |
| `calendar_events` | id, summary, start_time, end_time, attendees_json, organizer_email |
| `emails` | id, thread_id, subject, snippet, from_name, from_email, date, is_unread |
| `slack_messages` | id, channel_name, channel_type, user_name, text, ts, permalink, is_mention |
| `notion_pages` | id, title, url, last_edited_time, last_edited_by |
| `github_pull_requests` | id, number, title, state, author, repo |
| `granola_meetings` | id, title, created_at, attendees_json, panel_summary_plain, transcript_text |
| `meeting_files` | id, employee_id, filename, meeting_date, title, summary, action_items_json |
| `ramp_transactions` | id, amount, merchant_name, card_holder, date |
| `ramp_bills` | id, vendor_name, amount, due_date, status |
| `projects` | id, name, budget, spend |
| `news_items` | id, title, url, source, domain, snippet, found_at |
| `personas` | id, name, description, system_prompt |
| `claude_sessions` | id, persona_id, title, created_at |
| `longform_posts` | id, title, body, status (draft/published), tags, word_count, created_at |
| `longform_comments` | id, post_id, body, is_thought, created_at |
| `drive_files` | id, name, mime_type, modified_time, web_view_link, score |
| `sync_state` | source, last_sync_at, last_sync_status, last_error, items_synced |

### Synthesis Patterns

1. **Prep for a 1:1**: `GET /api/people/{id}` + `GET /api/gmail/search?q=from:{email}` + `GET /api/slack/search?q=from:@{name}`
2. **Morning briefing**: `GET /api/briefing` + `GET /api/weather` (or just use the briefing page)
3. **Person context**: `GET /api/people/{id}` + Gmail/Slack/Calendar search for that person
4. **Team status**: SQLite `notes` grouped by employee + upcoming 1:1s + action items
5. **Issue discovery**: `POST /api/issues/discover` → poll status → review proposals
