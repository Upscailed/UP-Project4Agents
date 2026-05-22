# UP/Project4Agents — CLAUDE.md

## Wat is dit?

UP/Project4Agents is een lokaal projectmanagement-systeem, geïnspireerd op **Linear**,
specifiek gebouwd voor AI-agents. Het biedt:

- **Kanban board** met Triage / Backlog / Todo / In Progress / In Review / Done
- **Sub-issues, gekoppelde issues** (blocks / blocked_by / relates_to / duplicates)
- **Cycles** (sprints), **estimates**, **due dates**, **assignees**, **labels**
- **Activity log** + comments per issue
- **Saved views** (filters zoals "Agent queue", "High priority backlog")
- **REST API** op `http://localhost:3400/api`
- **MCP-server** zodat Claude Code direct issues kan claimen/updaten
- **GitHub-integratie** met auto status-transitions, branch-naam matching, magic words

## Tech Stack

- **Frontend:** Next.js 15 (App Router) + React 19
- **Database:** SQLite via better-sqlite3 (lokaal)
- **API:** REST op `http://localhost:3400/api`
- **MCP:** stdio server via `@modelcontextprotocol/sdk`
- **Port:** 3400

## Starten

```bash
cd ~/AI\ -\ Projecten/Upscailed/UP-Project4Agents
npm install
npm run dev
```

De app draait op `http://localhost:3400`.

## Authenticatie

De app heeft login. Bij eerste run is `/api/me` een leeg user-state — open `/login` en je krijgt een
signup-formulier. **De eerste user wordt automatisch admin.** Daarna kunnen extra users zich registreren
of door admin worden aangemaakt.

Sessies via httpOnly cookie (30 dagen). Wachtwoorden: scrypt-hash (Node native, geen externe deps).

### GitHub OAuth (Sign in with GitHub) — optioneel

1. Maak een OAuth app op https://github.com/settings/applications/new
   - **Homepage URL:** `http://localhost:3400` (of je productie-URL)
   - **Callback URL:** `http://localhost:3400/api/auth/github/callback`
2. Kopieer Client ID + Client Secret naar `.env.local`:
   ```
   GITHUB_OAUTH_CLIENT_ID=Ov23xxxxxxxxxxx
   GITHUB_OAUTH_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
   ```
3. Herstart `npm run dev`
4. De "Inloggen met GitHub" knop op `/login` werkt nu

GitHub-users worden automatisch toegevoegd aan de default workspace. Als hun email al bestaat (van een eerdere signup met password), wordt GitHub gekoppeld aan dat account.

### Voor MCP/CLI: API-token

De MCP-server praat met de API zonder browser-cookie — die gebruikt een Bearer-token:

```bash
# 1. genereer een token
openssl rand -hex 32

# 2. zet 'm in .env.local
echo "P4A_API_TOKEN=jouw-random-token" >> .env.local

# 3. herstart dev-server
npm run dev

# 4. MCP-server pakt 'm automatisch op via .mcp.json
```

De API accepteert dan zowel cookie-sessie als `Authorization: Bearer <token>`.

## MCP-server installeren in Claude Code

**Voor dit project (aanbevolen):** `.mcp.json` staat al in de repo. Claude Code laadt 'm
automatisch zodra je `cd` naar deze map doet. Bevestig de prompt en je hebt 20 tools beschikbaar.

**Globaal (overal beschikbaar):**

```bash
claude mcp add project4agents node ~/AI\ -\ Projecten/Upscailed/UP-Project4Agents/scripts/mcp-server.mjs
```

Vereiste: de Next.js dev-server moet draaien (`npm run dev`) — de MCP-server praat over HTTP met `http://localhost:3400/api`.

### Beschikbare MCP tools

| Tool | Wat doet 't |
|---|---|
| `list_projects` | Lijst alle projecten |
| `create_project` | Nieuw project |
| `list_issues` | Issues met filters (status, priority, assignee, cycle, search) |
| `get_issue` | Eén issue (incl. sub-issues) |
| `get_next_issue` | **Volgende taak** — hoogste prio, niet geblokkeerd |
| `claim_issue` | Atomic: status=in_progress + assignee + comment |
| `create_issue` | Nieuwe issue (sub via `parent_issue_id`) |
| `update_issue` | Werk een issue bij |
| `delete_issue` | Verwijder issue |
| `add_comment` | Comment / activity toevoegen |
| `list_comments` | Comments van een issue |
| `get_branch_name` | Branch-naam zoals Linear: `prefix/up-42-slug` |
| `link_issues` | blocks / blocked_by / relates_to / duplicates |
| `get_issue_links` | Links van een issue |
| `list_cycles` | Cycles (sprints) |
| `create_cycle` | Nieuwe cycle |
| `get_activity` | Activity log |
| `list_views` | Opgeslagen views |
| `get_stats` | Stats |
| `sync_github` | Manual GitHub-sync via `gh` CLI |

## GitHub-integratie opzetten

Zoals Linear: branch & PR koppelen automatisch aan issues (via identifier `UP-42` in branch-naam,
PR-title of body), en status verandert mee bij PR events.

### Optie A — Webhook via Cloudflare Tunnel (real-time)

```bash
# Terminal 1
npm run dev

# Terminal 2 — publieke URL
./scripts/setup-cloudflare-tunnel.sh
# kopieer de https://*.trycloudflare.com URL

# Terminal 3 — webhook registreren bij GitHub
./scripts/setup-github-webhook.sh https://xxx.trycloudflare.com Upscailed/UP-Project4Agents
```

Het script:
- Genereert een random `GITHUB_WEBHOOK_SECRET` en zet 'm in `.env.local`
- Registreert webhook op de repo voor `push`, `pull_request`, `issue_comment`
- Verificatie via HMAC-SHA256 op elke ontvangen webhook

### Optie B — Polling (geen tunnel nodig)

```bash
# eenmalig
node scripts/github-poll.mjs

# continu (elke 60s)
node scripts/github-poll.mjs --watch
```

Of via crontab:

```cron
* * * * * cd ~/AI\ -\ Projecten/Upscailed/UP-Project4Agents && /usr/local/bin/node scripts/github-poll.mjs >> data/poll.log 2>&1
```

Vereist: `gh` CLI is geauthenticeerd. Zet `GITHUB_REPO=owner/repo` in `.env.local` of laat 'm autodetecten via `git remote`.

### Auto status-transitions (zoals Linear)

| Event | Issue gaat naar |
|---|---|
| Branch `iwan/up-42-...` gepusht | **In Progress** |
| PR opened (mention `UP-42` in title/body) | **In Progress** |
| PR review requested | **In Review** |
| PR merged | **Done** |
| PR closed (geen merge) | terug naar **Todo** |
| PR body bevat "Fixes UP-42" → bij merge | **Done** |

## REST API

Base: `http://localhost:3400/api`

### Issues

| Method | Endpoint | Beschrijving |
|---|---|---|
| GET | `/issues` | Lijst (filters: `project_id`, `team_id`, `status` (csv), `priority` (csv), `assignee`, `cycle_id`, `parent_issue_id`, `search`) |
| GET | `/issues?id=UP-42` | Één issue + sub-issues |
| GET | `/issues/next?assignee=agent` | Volgende taak (priority+status weight, blocked-filter) |
| POST | `/issues` | Maak een issue |
| POST | `/issues/{id}/claim` | Atomic claim — body: `{assignee, comment?}` |
| GET | `/issues/{id}/branch-name?prefix=iwan` | → `{branch_name: "iwan/up-42-titel-slug"}` |
| GET | `/issues/{id}/links` | Lijst links |
| POST | `/issues/{id}/links` | Maak link — body: `{to:"UP-43", link_type:"blocks"}` |
| PATCH | `/issues?id={id}` | Werk bij (alle velden optioneel) |
| DELETE | `/issues?id={id}` | Verwijder |

**Issue body velden:** `project_id`, `title`, `description`, `status`, `priority`, `labels[]`,
`acceptance_criteria`, `assignee`, `parent_issue_id`, `estimate`, `due_date`, `cycle_id`,
`github_branch`, `github_pr_url`.

**Status:** `triage` | `backlog` | `todo` | `in_progress` | `in_review` | `done` | `cancelled`
**Priority:** `urgent` | `high` | `medium` | `low` | `none`

### Andere

| Endpoint | |
|---|---|
| GET/POST `/projects` | Projects CRUD |
| GET/POST `/cycles` | Cycles (sprints) CRUD |
| GET/POST `/views` | Saved views/filters |
| GET `/activity?issue_id=...&limit=100` | Activity log |
| GET `/comments?issue_id=...` & POST `/comments` | Comments |
| GET `/teams` | Teams (default: UP) |
| GET `/stats` | Stats |
| POST `/github/webhook` | GitHub webhook ontvanger |
| POST `/github/sync` | Manual GitHub sync (gebruikt `gh`) |

## Workflow voor een AI-agent

### 1. Vraag wat de volgende taak is

```bash
curl http://localhost:3400/api/issues/next?assignee=agent
```

Of via MCP: `get_next_issue({ assignee: "agent" })`.

### 2. Claim 'm

```bash
curl -X POST http://localhost:3400/api/issues/UP-42/claim \
  -H 'Content-Type: application/json' \
  -d '{"assignee":"agent","comment":"Start implementatie"}'
```

→ Status wordt `in_progress`, assignee wordt jij, `started_at` ingevuld, comment gelogd.

### 3. Maak een branch met de juiste naam

```bash
NAME=$(curl -s http://localhost:3400/api/issues/UP-42/branch-name?prefix=agent | jq -r .branch_name)
git checkout -b $NAME
```

### 4. Werk, push, maak een PR

```bash
git push -u origin "$NAME"
gh pr create --title "UP-42: Login pagina" --body "Fixes UP-42"
```

Door "Fixes UP-42" in de body gaat de issue automatisch naar **Done** bij merge.

### 5. Mocht er werk uit dit ontstaan dat niet bij UP-42 hoort

→ Geen scope-drift. Maak een NIEUWE issue aan:

```bash
curl -X POST http://localhost:3400/api/issues \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"...","title":"Reverse: refactor X","priority":"low","status":"backlog"}'
```

Of als sub-issue van UP-42: voeg `"parent_issue_id":"UP-42"` toe.

## Map-structuur

```
UP-Project4Agents/
├── CLAUDE.md              ← dit bestand
├── .mcp.json              ← MCP server config voor Claude Code (auto-laden)
├── mcp-config.json        ← MCP tools beschrijving (referentie)
├── .env.example           ← kopie naar .env.local
├── package.json
├── data/                  ← SQLite database (auto)
│   └── project4agents.db
├── scripts/
│   ├── mcp-server.mjs                  ← Stdio MCP-server
│   ├── github-poll.mjs                 ← Polling-fallback
│   ├── setup-cloudflare-tunnel.sh      ← Publieke URL voor webhook
│   └── setup-github-webhook.sh         ← Webhook bij GitHub registreren
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    ← Kanban board UI
│   │   ├── globals.css
│   │   └── api/
│   │       ├── projects/route.ts
│   │       ├── issues/
│   │       │   ├── route.ts
│   │       │   ├── next/route.ts       ← volgende taak
│   │       │   └── [id]/
│   │       │       ├── claim/route.ts
│   │       │       ├── branch-name/route.ts
│   │       │       └── links/route.ts
│   │       ├── cycles/route.ts
│   │       ├── views/route.ts
│   │       ├── teams/route.ts
│   │       ├── activity/route.ts
│   │       ├── comments/route.ts
│   │       ├── stats/route.ts
│   │       └── github/
│   │           ├── webhook/route.ts    ← HMAC-verificatie + state machine
│   │           └── sync/route.ts       ← manual sync via gh CLI
│   └── lib/
│       ├── db.ts                       ← schema + migratie + alle CRUD + state machine
│       └── types.ts                    ← TS types
```

## Migratie van oude DB

Bij eerste start migreert de app automatisch een oude DB (toevoegen van `assignee`, `parent_issue_id`,
`estimate`, `due_date`, `cycle_id`, `github_pr_number`, `started_at`, `team_id`). De oude
status-CHECK constraint wordt automatisch verwijderd zodat `todo` / `in_review` / `triage` ook werken.

## Tips voor agents

- **Lees voor je schrijft.** `get_issue(UP-42)` geeft je description, criteria, sub-issues en linked issues.
- **Voeg comments toe als activity-log.** Geen lange chat met de user — laat de comments je voortgang vertellen.
- **Stel sub-issues op** bij grote taken. `parent_issue_id` koppelt ze visueel + de parent toont voortgang.
- **Mark blocks/blocked_by** als je dependencies tegenkomt. `get_next_issue` slaat geblokkeerde issues over.
- **Eén branch per issue.** `get_branch_name` geeft je de Linear-style naam.
- **Magic words in PR body** ("Fixes UP-42") sluiten de issue automatisch bij merge.
