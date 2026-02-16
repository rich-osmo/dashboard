# CLAUDE.md — Rich's Dashboard

Personal team management dashboard for Rich Whitcomb (CTO, Osmo). Centralizes meetings, 1:1s, notes, Gmail, Calendar, Slack, Notion, Granola, and news into a single local app.

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
```

Dev logs: `/tmp/dashboard-backend.log`, `/tmp/dashboard-frontend.log`

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

## Project Structure

```
├── app/
│   ├── backend/
│   │   ├── main.py              # FastAPI app, startup, router registration
│   │   ├── config.py            # Paths, constants, API limits
│   │   ├── database.py          # SQLite schema (10 tables), init, migrations
│   │   ├── models.py            # Pydantic request/response models
│   │   ├── routers/             # API endpoints
│   │   │   ├── dashboard.py     # GET /api/dashboard — aggregated overview
│   │   │   ├── employees.py     # GET /api/employees, /api/employees/{id}
│   │   │   ├── notes.py         # CRUD /api/notes — todos with @mentions
│   │   │   ├── sync.py          # POST /api/sync — trigger data sync
│   │   │   ├── auth.py          # GET /api/auth/status, OAuth flows
│   │   │   ├── priorities.py    # GET /api/priorities — AI morning briefing
│   │   │   ├── news.py          # GET /api/news — paginated news feed
│   │   │   └── claude.py        # WS /api/ws/claude — Claude Code PTY
│   │   └── connectors/          # External service integrations
│   │       ├── google_auth.py   # OAuth 2.0 token management
│   │       ├── gmail.py         # Inbox sync (50 messages)
│   │       ├── calendar_sync.py # Events: 7 days back, 14 days ahead
│   │       ├── slack.py         # DMs + mentions via SLACK_TOKEN
│   │       ├── notion.py        # Recently edited pages via NOTION_TOKEN
│   │       ├── granola.py       # Local Granola cache parsing
│   │       ├── markdown.py      # teams/ directory → employees + meetings
│   │       ├── news.py          # URL extraction + Google News RSS
│   │       └── prosemirror.py   # Granola ProseMirror JSON → HTML
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── main.tsx         # Entry point, global error handlers
│   │   │   ├── App.tsx          # Router + layout
│   │   │   ├── api/
│   │   │   │   ├── client.ts    # Fetch wrapper
│   │   │   │   ├── hooks.ts     # React Query hooks (all API calls)
│   │   │   │   ├── types.ts     # TypeScript interfaces
│   │   │   │   └── errorLog.ts  # In-memory error queue
│   │   │   ├── pages/
│   │   │   │   ├── DashboardPage.tsx  # Home: priorities, calendar, email, Slack
│   │   │   │   ├── NotePage.tsx       # Notes with @mention autocomplete
│   │   │   │   ├── ThoughtsPage.tsx   # [t]-prefixed notes
│   │   │   │   ├── EmployeePage.tsx   # Person detail: meetings, 1:1 topics, notes
│   │   │   │   ├── OrgTreePage.tsx    # Hierarchical team chart
│   │   │   │   ├── NewsPage.tsx       # Infinite scroll news
│   │   │   │   ├── SettingsPage.tsx   # Auth status, sync controls
│   │   │   │   └── ClaudePage.tsx     # Embedded Claude Code terminal
│   │   │   ├── components/
│   │   │   │   ├── layout/Sidebar.tsx # Navigation, team list, sync button
│   │   │   │   ├── NewsFeed.tsx       # Infinite scroll with IntersectionObserver
│   │   │   │   └── shared/           # TimeAgo, MarkdownRenderer
│   │   │   └── styles/tufte.css      # All styling (Tufte-inspired)
│   │   ├── package.json
│   │   └── vite.config.ts            # Dev proxy to backend
│   └── database/
│       └── rich.db                    # SQLite database
├── teams/                             # Direct reports (markdown: role.md, 1-1.md, meetings/)
├── executives/                        # Exec team (markdown)
├── hidden/                            # Private team data
├── projects/                          # Project-specific folders
├── Dashboard.app/                     # Built native macOS app
├── Makefile                           # Dev workflow
└── README.md
```

## Frontend Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/` | DashboardPage | AI morning priorities, calendar, email, Slack, Notion, news |
| `/notes` | NotePage | Notes CRUD with @mention autocomplete and employee linking |
| `/thoughts` | ThoughtsPage | Notes prefixed with `[t]` — separate view |
| `/news` | NewsPage | Infinite scroll news from Slack, email, Google News |
| `/team` | OrgTreePage | Org chart: executives + direct reports tree |
| `/employees/:id` | EmployeePage | Person detail: next meeting, 1:1 topics, notes, history |
| `/settings` | SettingsPage | Auth status, connection tests, manual sync |
| `/claude` | ClaudePage | Embedded Claude Code terminal via WebSocket |

## Database Tables

`employees`, `notes`, `calendar_events`, `emails`, `slack_messages`, `notion_pages`, `granola_meetings`, `meeting_files`, `news_items`, `sync_state`

Schema is in `app/backend/database.py`. No migration framework — schema changes use `ALTER TABLE` checks in `init_db()`.

## Data Sync

Sync is triggered on startup (markdown + Granola only) or manually via UI/API.

| Source | Connector | Auth |
|--------|-----------|------|
| Team markdown | `connectors/markdown.py` | Filesystem |
| Granola | `connectors/granola.py` | Local cache file |
| Gmail | `connectors/gmail.py` | Google OAuth |
| Calendar | `connectors/calendar_sync.py` | Google OAuth |
| Slack | `connectors/slack.py` | `SLACK_TOKEN` env var |
| Notion | `connectors/notion.py` | `NOTION_TOKEN` env var |
| News | `connectors/news.py` | None (URL extraction + RSS) |

Employee matching (`utils/employee_matching.py`) maps emails/names to employee IDs.

## Auth & Secrets

Secrets live in `app/backend/.env` (see `.env.example`):
- `SLACK_TOKEN` — bot/user token
- `NOTION_TOKEN` — internal integration secret
- `GEMINI_API_KEY` — for AI priorities (optional)

Google OAuth uses `gcloud auth application-default login` → stored as `app/backend/.google_token.json`.

## Key Conventions

- **No test suite** — no pytest/jest/vitest configured
- **No CSS framework** — all styles in `tufte.css`
- **All API calls** go through React Query hooks in `api/hooks.ts`
- **Notes linking**: `@Name` autocomplete, `[1]` prefix forces 1:1, `[t]` prefix marks as thought
- **Team data** is markdown-driven from `teams/` and `executives/` directories
- **Local only** — runs on macOS, no cloud deployment, no CI/CD, no Docker

## Dashboard Interaction Guide

You are running inside Rich's personal dashboard. The backend is live at `http://localhost:8000`. You can interact with it via REST APIs (curl) and query the SQLite database directly. Use these capabilities to answer questions, create/update data, synthesize information across sources, and act as a power user of the dashboard.

### REST API Reference

All endpoints are at `http://localhost:8000`. Use `curl -s` and pipe through `python3 -m json.tool` for readable output.

#### Dashboard Overview
```bash
# Get full dashboard: today's calendar, recent emails, Slack, upcoming meetings, Notion, open notes count
curl -s http://localhost:8000/api/dashboard | python3 -m json.tool
```

#### Employees
```bash
# List all employees (id, name, title, reports_to, depth, is_executive)
curl -s http://localhost:8000/api/employees | python3 -m json.tool

# Get employee detail: role, 1:1 content, meetings, Granola meetings, linked notes, next meeting
curl -s http://localhost:8000/api/employees/{employee_id} | python3 -m json.tool
```

#### Notes (CRUD)
```bash
# List notes (filters: status=open|done, employee_id=X, is_one_on_one=true|false)
curl -s "http://localhost:8000/api/notes?status=open" | python3 -m json.tool

# Create a note (prefix with [1] for auto 1:1 linking, [t] for thought)
curl -s -X POST http://localhost:8000/api/notes \
  -H "Content-Type: application/json" \
  -d '{"text": "Follow up on project timeline", "priority": 1}'

# Create a 1:1 note (auto-detects employee from name)
curl -s -X POST http://localhost:8000/api/notes \
  -H "Content-Type: application/json" \
  -d '{"text": "[1] @PersonName discuss performance review", "priority": 1}'

# Update a note (any field: text, priority, status, employee_id, is_one_on_one, due_date)
curl -s -X PATCH http://localhost:8000/api/notes/{note_id} \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'

# Delete a note
curl -s -X DELETE http://localhost:8000/api/notes/{note_id}
```

#### Sync (Trigger Data Refresh)
```bash
# Full sync: markdown → granola → gmail → calendar → slack → notion → news
curl -s -X POST http://localhost:8000/api/sync

# Sync specific source: markdown, granola, gmail, calendar, slack, notion, news
curl -s -X POST http://localhost:8000/api/sync/{source}

# Check sync status
curl -s http://localhost:8000/api/sync/status | python3 -m json.tool
```

#### Auth Status
```bash
# Check connection status for Google, Slack, Notion, Granola
curl -s http://localhost:8000/api/auth/status | python3 -m json.tool

# Test a specific connection
curl -s -X POST http://localhost:8000/api/auth/test/{service}  # google, slack, notion, granola
```

#### Priorities (AI Morning Briefing)
```bash
# Get AI-generated priorities based on Slack, email, calendar, notes
curl -s http://localhost:8000/api/priorities | python3 -m json.tool

# Dismiss a priority
curl -s -X POST http://localhost:8000/api/priorities/dismiss \
  -H "Content-Type: application/json" \
  -d '{"title": "Priority title to dismiss"}'
```

#### News
```bash
# Get paginated news (from Slack, email, Google News RSS)
curl -s "http://localhost:8000/api/news?offset=0&limit=20" | python3 -m json.tool
```

### Live Service APIs (Search & Interact)

These endpoints hit Gmail, Calendar, Slack, and Notion APIs directly — not the synced snapshots. Use them to search beyond what's cached, read full content, and take actions.

#### Gmail (Live Search & Read)
```bash
# Search Gmail — supports full Gmail search syntax
curl -s "http://localhost:8000/api/gmail/search?q=from:alice+subject:review&max_results=10" | python3 -m json.tool
# Search syntax: from:, to:, subject:, after:2025-01-01, before:, has:attachment, is:unread, label:, filename:pdf

# Get full email thread with body text
curl -s http://localhost:8000/api/gmail/thread/{thread_id} | python3 -m json.tool

# Get single message with full body
curl -s http://localhost:8000/api/gmail/message/{message_id} | python3 -m json.tool
```

#### Calendar (Live Search)
```bash
# Search events by text (defaults to ±30 days)
curl -s "http://localhost:8000/api/calendar/search?q=standup" | python3 -m json.tool

# Search with date range (ISO format)
curl -s "http://localhost:8000/api/calendar/search?start=2025-01-01T00:00:00Z&end=2025-03-01T00:00:00Z" | python3 -m json.tool

# Get single event details
curl -s http://localhost:8000/api/calendar/event/{event_id} | python3 -m json.tool
```

#### Slack (Live Search, History & Send)
```bash
# Search messages across entire workspace (supports from:, in:#channel, has:reaction)
curl -s "http://localhost:8000/api/slack/search?q=deployment+in:%23engineering&count=20" | python3 -m json.tool

# List accessible channels
curl -s http://localhost:8000/api/slack/channels | python3 -m json.tool

# Get recent messages from a channel
curl -s "http://localhost:8000/api/slack/channels/{channel_id}/history?limit=20" | python3 -m json.tool

# Get full thread replies
curl -s http://localhost:8000/api/slack/thread/{channel_id}/{thread_ts} | python3 -m json.tool

# Send a message (channel ID or user ID for DM)
curl -s -X POST http://localhost:8000/api/slack/send \
  -H "Content-Type: application/json" \
  -d '{"channel": "C12345", "text": "Hello from Claude!"}'

# Reply in a thread
curl -s -X POST http://localhost:8000/api/slack/send \
  -H "Content-Type: application/json" \
  -d '{"channel": "C12345", "text": "Thread reply", "thread_ts": "1234567890.123456"}'
```

#### Notion (Live Search & Read)
```bash
# Search Notion pages
curl -s "http://localhost:8000/api/notion/search?q=roadmap&page_size=10" | python3 -m json.tool

# Search only databases
curl -s "http://localhost:8000/api/notion/search?filter_type=database" | python3 -m json.tool

# Get page properties
curl -s http://localhost:8000/api/notion/pages/{page_id} | python3 -m json.tool

# Get full page content as readable text
curl -s http://localhost:8000/api/notion/pages/{page_id}/content | python3 -m json.tool
```

### Direct SQLite Access

The database is at `app/database/rich.db`. Query it directly for complex analysis, joins, and data synthesis that the APIs don't cover.

```bash
sqlite3 app/database/rich.db
```

#### Table Schemas

| Table | Key Columns |
|-------|-------------|
| `employees` | id, name, title, reports_to, depth, is_executive |
| `notes` | id, text, priority, status (open/done), employee_id, is_one_on_one, created_at, completed_at, due_date |
| `calendar_events` | id, summary, start_time, end_time, attendees_json (JSON array of {email, name, response}), organizer_email |
| `emails` | id, thread_id, subject, snippet, from_name, from_email, date, labels_json, is_unread, body_preview |
| `slack_messages` | id, channel_name, channel_type (dm/channel), user_name, text, ts, permalink, is_mention |
| `notion_pages` | id, title, url, last_edited_time, last_edited_by, icon |
| `granola_meetings` | id, title, created_at, attendees_json, panel_summary_html, panel_summary_plain, transcript_text, employee_id, granola_link |
| `meeting_files` | id, employee_id, filename, filepath, meeting_date, title, summary, action_items_json, content_markdown |
| `news_items` | id, title, url, source (slack/email/web), source_detail, domain, snippet, found_at |
| `sync_state` | source, last_sync_at, last_sync_status, last_error, items_synced |
| `dismissed_priorities` | title, reason, dismissed_at |

#### Useful Query Patterns
```sql
-- Today's meetings with attendees
SELECT summary, start_time, end_time, attendees_json FROM calendar_events WHERE date(start_time) = date('now') ORDER BY start_time;

-- Unread emails
SELECT subject, from_name, date FROM emails WHERE is_unread = 1 ORDER BY date DESC;

-- Recent Slack DMs
SELECT user_name, text, datetime(ts, 'unixepoch') as when FROM slack_messages WHERE channel_type = 'dm' ORDER BY ts DESC LIMIT 20;

-- Open notes for a specific person
SELECT n.text, n.priority, n.created_at, e.name FROM notes n JOIN employees e ON n.employee_id = e.id WHERE n.status = 'open' ORDER BY n.priority DESC;

-- 1:1 topics grouped by person
SELECT e.name, GROUP_CONCAT(n.text, ' | ') as topics FROM notes n JOIN employees e ON n.employee_id = e.id WHERE n.is_one_on_one = 1 AND n.status = 'open' GROUP BY e.name;

-- Recent Granola meeting summaries
SELECT title, panel_summary_plain, created_at FROM granola_meetings WHERE valid_meeting = 1 ORDER BY created_at DESC LIMIT 10;

-- Cross-source activity for a person (find by name pattern)
SELECT 'email' as source, subject as content, date as when FROM emails WHERE from_name LIKE '%Name%'
UNION ALL
SELECT 'slack', text, datetime(ts, 'unixepoch') FROM slack_messages WHERE user_name LIKE '%Name%'
UNION ALL
SELECT 'meeting', summary, start_time FROM calendar_events WHERE attendees_json LIKE '%Name%'
ORDER BY when DESC;
```

### Team Data (Markdown Files)

Employee profiles and meeting notes live in the filesystem:

```
teams/{person}/           # Direct reports
  role.md                 # Title, responsibilities, goals
  1-1.md                  # Running 1:1 topics and notes
  meetings/               # Meeting notes (markdown)
    2024-01-15-topic.md   # Individual meeting files
executives/{person}/      # Executive team (same structure)
hidden/{person}/          # Private team data
```

Read these files directly to get full context on any team member, their role, and meeting history.

### Synthesis Patterns

When asked to synthesize or analyze, combine multiple sources. Prefer live APIs for fresh data, SQLite for cross-source joins.

1. **Prep for a 1:1**: `GET /api/employees/{id}` (notes, meetings) + `GET /api/gmail/search?q=from:{email}` (recent emails) + `GET /api/slack/search?q=from:@{name}` (Slack context) + read `teams/{person}/1-1.md`
2. **Morning briefing**: `GET /api/priorities` + `GET /api/calendar/search` (today) + `GET /api/gmail/search?q=is:unread` + `GET /api/slack/search?q=<@me>` + SQLite `notes` (open items)
3. **Person context**: `GET /api/employees/{id}` + `GET /api/gmail/search?q=from:{email}` + `GET /api/slack/search?q=from:@{name}` + `GET /api/calendar/search?q={name}`
4. **Deep email dive**: `GET /api/gmail/search?q={query}` to find messages, then `GET /api/gmail/thread/{id}` to read full conversations
5. **Slack investigation**: `GET /api/slack/search?q={topic}` to find discussions, `GET /api/slack/channels/{id}/history` to read channel context, `GET /api/slack/thread/{ch}/{ts}` for full threads
6. **Notion research**: `GET /api/notion/search?q={topic}` to find pages, `GET /api/notion/pages/{id}/content` to read full content
7. **Team status**: SQLite query all `notes` grouped by employee + `GET /api/calendar/search` for upcoming 1:1s + `meeting_files` for action items
8. **News/industry context**: `GET /api/news` or `news_items` table

### Triggering Data Refresh

If data seems stale, sync first:
```bash
# Quick: refresh just what you need
curl -s -X POST http://localhost:8000/api/sync/gmail
curl -s -X POST http://localhost:8000/api/sync/calendar
curl -s -X POST http://localhost:8000/api/sync/slack

# Full refresh
curl -s -X POST http://localhost:8000/api/sync
```

Check what's connected: `curl -s http://localhost:8000/api/auth/status`
