# UP/Project4Agents — CLAUDE.md

## Wat is dit?

UP/Project4Agents is een lokaal draaiend projectmanagement-systeem, geïnspireerd op Linear, specifiek gebouwd voor AI-agents. Het biedt een Kanban-bord met REST API, zodat Claude Code en andere AI-agents autonoom taken kunnen beheren, oppakken en afronden.

## Tech Stack

- **Frontend:** Next.js 15 (App Router) + React 19 + Tailwind CSS
- **Database:** SQLite via better-sqlite3 (lokaal, geen externe services)
- **API:** REST endpoints op `http://localhost:3400/api`
- **Port:** 3400

## Starten

```bash
cd ~/AI\ -\ Projecten/Upscailed/UP-Project4Agents
npm install
npm run dev
```

De app draait op `http://localhost:3400`.

## API Referentie

Base URL: `http://localhost:3400/api`

### Projects

| Method | Endpoint | Beschrijving |
|--------|----------|--------------|
| GET | `/api/projects` | Lijst alle projecten |
| GET | `/api/projects?id={id}` | Haal één project op |
| POST | `/api/projects` | Maak een nieuw project |
| PATCH | `/api/projects?id={id}` | Werk een project bij |
| DELETE | `/api/projects?id={id}` | Verwijder een project |

**POST/PATCH body (Project):**
```json
{
  "name": "Mijn App",
  "description": "Beschrijving van het project",
  "color": "#8B5CF6"
}
```

### Issues (Taken)

| Method | Endpoint | Beschrijving |
|--------|----------|--------------|
| GET | `/api/issues` | Lijst alle issues |
| GET | `/api/issues?id={id}` | Haal één issue op (ook op identifier, bijv. `UP-42`) |
| GET | `/api/issues?project_id={id}` | Filter op project |
| GET | `/api/issues?status=backlog` | Filter op status |
| GET | `/api/issues?priority=high` | Filter op prioriteit |
| GET | `/api/issues?search=zoekterm` | Zoek in titel en beschrijving |
| POST | `/api/issues` | Maak een nieuwe issue |
| PATCH | `/api/issues?id={id}` | Werk een issue bij |
| DELETE | `/api/issues?id={id}` | Verwijder een issue |

**Status waarden:** `backlog`, `planned`, `in_progress`, `done`, `cancelled`
**Prioriteit waarden:** `none`, `low`, `medium`, `high`, `urgent`

**POST body (Issue):**
```json
{
  "project_id": "uuid-van-project",
  "title": "Implementeer login pagina",
  "description": "Bouw een login pagina met email/wachtwoord",
  "status": "backlog",
  "priority": "high",
  "labels": ["frontend", "auth"],
  "acceptance_criteria": "- [ ] Email validatie\n- [ ] Wachtwoord hashing\n- [ ] Error states",
  "github_branch": "feature/up-1-login"
}
```

**PATCH body (Issue):** Alle velden optioneel. Stuur alleen wat je wilt wijzigen.

### Comments (Opmerkingen)

| Method | Endpoint | Beschrijving |
|--------|----------|--------------|
| GET | `/api/comments?issue_id={id}` | Lijst comments van een issue |
| POST | `/api/comments` | Voeg een comment toe |

**POST body (Comment):**
```json
{
  "issue_id": "uuid-of-UP-42",
  "author": "agent",
  "body": "Branch aangemaakt: feature/up-42-login. Begonnen met implementatie."
}
```

### Stats

| Method | Endpoint | Beschrijving |
|--------|----------|--------------|
| GET | `/api/stats` | Overzicht: totaal issues, per status, per prioriteit |

## Workflow voor AI-agents

### Regel 1: Lees de issue VOORDAT je begint
Haal de issue op via de API, lees de beschrijving en acceptatiecriteria volledig door voordat je code schrijft.

```bash
curl http://localhost:3400/api/issues?id=UP-42
```

### Regel 2: Zet de status op "in_progress"
Zodra je aan een issue begint, update de status:

```bash
curl -X PATCH "http://localhost:3400/api/issues?id=UP-42" \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'
```

### Regel 3: Maak een GitHub branch per issue
Gebruik het identifier als branch-prefix:

```bash
git checkout -b feature/up-42-login-pagina
```

Update de issue met de branch naam:
```bash
curl -X PATCH "http://localhost:3400/api/issues?id=UP-42" \
  -H "Content-Type: application/json" \
  -d '{"github_branch": "feature/up-42-login-pagina"}'
```

### Regel 4: Log je voortgang als comment
Voeg comments toe zodat andere agents en de gebruiker kunnen volgen wat er gebeurt:

```bash
curl -X POST http://localhost:3400/api/comments \
  -H "Content-Type: application/json" \
  -d '{"issue_id": "UP-42", "author": "agent", "body": "Login form component gebouwd. Bezig met validatie."}'
```

### Regel 5: Markeer als done wanneer klaar
Zet de status pas op "done" als ALLE acceptatiecriteria zijn voldaan:

```bash
curl -X PATCH "http://localhost:3400/api/issues?id=UP-42" \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'
```

### Regel 6: Pak de volgende taak
Zoek de volgende issue in backlog of planned met de hoogste prioriteit:

```bash
curl "http://localhost:3400/api/issues?status=backlog&priority=urgent"
curl "http://localhost:3400/api/issues?status=backlog&priority=high"
curl "http://localhost:3400/api/issues?status=planned"
```

### Regel 7: Geen drift
- Werk ALLEEN aan de huidige issue
- Wijzig geen bestanden die niet bij de issue horen
- Refactor niets tenzij de issue dat expliciet vraagt
- Als je iets tegenkomt dat gefixt moet worden, maak een NIEUWE issue aan

### Regel 8: Pull Requests
Na het afronden van een issue, maak een PR aan en log de URL:

```bash
gh pr create --title "UP-42: Login pagina" --body "Implementeert login met email/wachtwoord validatie"

curl -X PATCH "http://localhost:3400/api/issues?id=UP-42" \
  -H "Content-Type: application/json" \
  -d '{"github_pr_url": "https://github.com/user/repo/pull/1"}'
```

## Mapstructuur

```
UP-Project4Agents/
├── CLAUDE.md              ← dit bestand (agent-instructies)
├── package.json
├── next.config.js
├── tsconfig.json
├── data/                  ← SQLite database (auto-aangemaakt)
│   └── project4agents.db
├── src/
│   ├── app/
│   │   ├── layout.tsx     ← root layout
│   │   ├── page.tsx       ← Kanban board UI
│   │   ├── globals.css    ← dark theme styling
│   │   └── api/
│   │       ├── projects/route.ts
│   │       ├── issues/route.ts
│   │       ├── comments/route.ts
│   │       └── stats/route.ts
│   └── lib/
│       ├── db.ts          ← database layer
│       └── types.ts       ← TypeScript types
└── mcp-config.json        ← MCP server configuratie
```

## MCP Integratie

Dit project is voorbereid voor MCP-koppeling met Claude Code. Zie `mcp-config.json` voor de configuratie. De REST API maakt het mogelijk om een MCP server te bouwen die:

1. **Issues kan lezen** — zodat de agent weet wat er gebouwd moet worden
2. **Status kan updaten** — zodat het bord real-time meegaat
3. **Comments kan plaatsen** — zodat voortgang gelogd wordt
4. **Nieuwe issues kan aanmaken** — zodat de agent sub-taken kan spawnen

## Database

SQLite database in `data/project4agents.db`. Wordt automatisch aangemaakt bij eerste start. Tabellen:

- `projects` — projecten/apps
- `issues` — taken met status, prioriteit, labels, criteria
- `comments` — activiteitenlog per issue
- `counters` — auto-increment voor issue identifiers (UP-1, UP-2, ...)
