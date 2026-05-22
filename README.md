# UP-Project4Agents

**Linear-style project management voor AI-agents.** Kanban board, REST API, MCP-server en GitHub-integratie — alles lokaal, alles snel.

![status](https://img.shields.io/badge/status-actief-10B981) ![next.js](https://img.shields.io/badge/next.js-15-black) ![mcp](https://img.shields.io/badge/MCP-stdio-A78BFA)

## Features

- **Kanban board** — Triage / Backlog / Todo / In Progress / In Review / Done
- **Linear concepts** — projects, sub-issues, linked issues (blocks/blocked-by/relates), cycles, estimates, due dates, assignees, activity log, saved views
- **REST API** op `http://localhost:3400/api` voor projects, issues, cycles, links, activity, stats
- **MCP-server** — 20 tools direct beschikbaar voor Claude Code (issue claim, branch-name, etc.)
- **GitHub-integratie** — webhook + polling-fallback. Branch/PR-identifiers worden auto-gelinkt, PR events triggeren status-transitions (zoals Linear), "Fixes UP-42" markeert als Done bij merge.

## Quick start

```bash
git clone https://github.com/Upscailed/UP-Project4Agents.git
cd UP-Project4Agents
npm install
npm run dev          # → http://localhost:3400
```

In Claude Code (op deze repo): `.mcp.json` wordt automatisch herkend; bevestig en je hebt 20 tools.

## GitHub-integratie

```bash
# Optie A — webhook (real-time) via Cloudflare Tunnel
./scripts/setup-cloudflare-tunnel.sh       # geeft je https://xxx.trycloudflare.com
./scripts/setup-github-webhook.sh <url>    # registreert webhook + maakt secret

# Optie B — polling
node scripts/github-poll.mjs --watch       # elke 60s
```

Zie [CLAUDE.md](./CLAUDE.md) voor de volledige API + workflow voor agents.

## Workflow voor een agent

```bash
# 1. Wat moet ik doen?
curl localhost:3400/api/issues/next?assignee=agent

# 2. Claim 'm
curl -X POST localhost:3400/api/issues/UP-42/claim \
  -d '{"assignee":"agent","comment":"Start"}' -H 'Content-Type: application/json'

# 3. Branch-naam
NAME=$(curl -s localhost:3400/api/issues/UP-42/branch-name | jq -r .branch_name)
git checkout -b "$NAME"

# 4. PR met magic words
gh pr create -t "UP-42: feature" -b "Fixes UP-42"
# bij merge → issue auto naar Done
```

## Map-structuur

```
src/
  app/api/            REST endpoints
  app/page.tsx        Kanban UI
  lib/db.ts           Schema + migratie + state machine
scripts/
  mcp-server.mjs      Stdio MCP server
  github-poll.mjs     Polling fallback
  setup-*.sh          Tunnel + webhook setup
.mcp.json             MCP config voor Claude Code
```

## License

MIT — gebruik wat je wil.
