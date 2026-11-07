# GrowthX MCP

A public MCP server that lets anyone add **GrowthX** (events discovery for SF founders and builders) to the agent they already use: Claude, Cursor or ChatGPT. You don't need another bot.

- MCP endpoint (Streamable HTTP): `/api/mcp`
- Landing page with copy-paste configs: `/`
- Read-only. No accounts.

## Tools

| Tool | What it does |
|---|---|
| `search_events` | Filter upcoming SF events by query, tags, dates (PT), neighborhood, or free only |
| `get_event` | Full details for one event |
| `recommend_events(goal)` | Top 3 events for a goal, each with a reason |
| `draft_intro(event_id, goal, target?)` | Short intro DM to send to a guest, host or sponsor |
| `plan_my_week(goal, week_start?)` | Agenda with no conflicts (30-min buffer, at most 2 events/day) |
| `who_to_meet(event_id, goal)` | Featured guests, hosts and sponsors ranked for your goal |
| `event_brief(event_id)` | TL;DR, logistics, people, talking points, prep |
| `register_event(event_id)` | Registration link. It never registers for you |
| `add_to_calendar(event_id)` | Google Calendar link plus `.ics` content |
| `sponsor_match(audience, budget?)` | For brands: events that match your audience, with reach and past sponsors |
| `trending_topics` | Top topics and most active hosts over the next N days |
| `similar_events(event_id)` | Events with shared topics or the same host/community |

Everything works without an LLM. If `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set, the LLM refines goal→filters, writes the reasons in `recommend_events`, and drafts the intros. When a call fails, the server falls back to the rule-based output.

## Data backends

`DATA_SOURCE=intel` is the main backend: the GrowthX intel knowledge graph, read from the Postgres `intel` schema.
- Events are `intel.entities(kind='event')` linked by `in_city` to a city (default `San Francisco`, override with `INTEL_CITY`). The window runs from now to +60 days.
- Event attributes are the current value per field from `intel.observations`: highest confidence first, then the latest. Fields: title, start_at, end_at, url, description, hosts, featured_guests, offers, capacity, registered_count, tags.
- Relations: communities via `hosts`/`lists`, sponsors via `sponsored` (event), community sponsors via `company sponsored community`, venue via `held_at`.
- Read-only: every query runs inside `BEGIN READ ONLY … ROLLBACK` with a 15s statement timeout, and only SELECT statements exist. Results are cached in memory for 5 minutes.
- If intel fails or returns 0 events, the server falls back to fixtures. `search_events` reports `backend` and `example_data` so clients can tell which one served the data.

`fixtures` is the default (or forced with `USE_FIXTURES=1`): `data/events.json` holds 25 fictional SF events for Nov 2026. They are **example data**.

## Run

```bash
npm install
cp .env.example .env.local      # fixtures by default; for intel set DATA_SOURCE=intel, USE_FIXTURES=0, INTEL_DATABASE_URL
npm run dev                     # http://localhost:3000, MCP at /api/mcp
npm run smoke                   # tools/list + all 12 tools against localhost:3000 (or: node scripts/smoke.mjs <baseUrl>)
npm run typecheck && npm run lint && npm run build
```

`scripts/intel-inspect.mjs` is a SELECT-only helper for inspecting the intel schema (`node --env-file=.env.local scripts/intel-inspect.mjs`).

## Connect your agent

- **Claude Code:** `claude mcp add --transport http growthx https://<host>/api/mcp`
- **Claude Desktop / claude.ai:** Settings → Connectors → Add custom connector → paste the URL
- **Cursor** (`~/.cursor/mcp.json`): `{"mcpServers":{"growthx":{"url":"https://<host>/api/mcp"}}}`
- **ChatGPT:** Settings → Connectors → Developer mode → add the MCP server URL

Demo prompt: *"I'm a seed-stage AI agents founder in SF raising a pre-seed round. Plan my week with GrowthX: pick non-conflicting events, tell me who to meet at each, draft an intro for the best one, and give me calendar links."*

## Deploy (Vercel)

Import the repo and set the env vars from `.env.example`. For intel, use a **SELECT-only Postgres role** scoped to the `intel` schema. Don't use the `postgres` superuser connection string.

The role `growthx_mcp_ro` exists for this purpose. It has `USAGE` on `intel`, `SELECT` on its tables (default privileges included), `statement_timeout=10s` and `default_transaction_read_only=on`. Writes fail at the privilege level, and it has no access to other schemas. With the Supabase pooler, the username is `growthx_mcp_ro.<project-ref>`.
