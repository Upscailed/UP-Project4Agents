# Agent Workflow — Project4Agents integratie

**Plaats dit als `AGENT-WORKFLOW.md` of voeg toe aan `CLAUDE.md` in elke repo
die in Project4Agents is gekoppeld.** Het vertelt agents (Claude Code) exact
welke stappen ze moeten volgen zodat élk stadium zichtbaar wordt op het bord.

---

## 🔑 Beschikbare tools (via `project4agents` MCP)

| Tool | Wanneer aanroepen |
|---|---|
| `list_issues` / `get_next_issue` | Aan begin van sessie: "wat is er te doen?" |
| `get_issue` | Voor je begint: lees beschrijving + acceptatiecriteria + project info (incl. github_repo) |
| **`claim_issue`** | **VERPLICHT** als eerste stap zodra je aan een issue gaat werken |
| `add_comment` | Bij elke significante stap (zie hieronder) |
| `get_branch_name` | Voor je `git checkout -b` doet — geeft de juiste naam + git-commando's |
| `update_issue` | Alleen voor wijzigingen aan titel/desc/labels. Voor status: liever via webhook (PR opens, merge) |
| `link_issues` | Als je een dependency ontdekt: `blocks` / `blocked_by` |
| `create_issue` (sub) | Als werk groter blijkt: maak sub-issues onder `parent_issue_id` |

## 🔄 De verplichte flow

Voor elk issue dat je aanpakt:

```
1. get_issue(UP-X)
   ↓ Lees titel, description, acceptance_criteria, project.github_repo
   ↓ Als project.github_repo leeg → vraag user!

2. claim_issue(UP-X, assignee="claude-code")
   → status: backlog/todo → in_progress
   → automatic comment: "🤖 claude-code heeft deze opgepakt"

3. add_comment(UP-X, "Begonnen met X. Plan: [korte uitleg].")

4. get_branch_name(UP-X)
   → geeft branch + git-commando's
   → Voer git fetch + checkout -b uit

5. add_comment(UP-X, "Branch lokaal aangemaakt: <naam>")

6. ...maak je wijzigingen, test...

7. add_comment(UP-X, "Wijzigingen klaar: [korte samenvatting]")

8. git push -u origin <branch>
   → Webhook detecteert push → comment "🌿 Branch gepushed"

9. gh pr create --title "UP-X: <titel>" --body "Fixes UP-X\n\n<beschrijving>"
   → Webhook detecteert PR → status in_review → comment "🔗 PR #N opened"

10. Wacht op merge of doe zelf merge
    → Webhook detecteert merge → status done → comment "✅ PR merged"
```

## 🚫 Niet doen

- **Niet** direct `update_issue(status='in_review')` zonder PR — gebruik altijd echte PR via gh
- **Niet** `update_issue(status='done')` handmatig — laat de webhook dat doen bij merge
- **Niet** branchnaam handmatig verzinnen — gebruik `get_branch_name` voor consistentie
- **Niet** beginnen zonder `claim_issue` — dan ziet de user niet dat je actief bent

## 💬 Wanneer comment plaatsen?

Plaats een `add_comment` bij:

- 🟢 **Start** van het werk (na claim) — "Begonnen, plan is X"
- 🟡 **Significante mijlpaal** — "Schema af, nu testen"
- 🟡 **Probleem of beslissing** — "Loop tegen X aan, kies voor Y omdat..."
- 🔴 **Geblokkeerd** — gebruik `link_issues` met `blocked_by` + comment uitleg
- 🟢 **Afgerond** — vlak voor PR aanmaken

Minimum: **3 comments** per issue (begin, mid-werk, eind). Dat geeft de user
duidelijk inzicht in voortgang zonder over-communicatie.

## 📋 Voorbeeld-sessie

```
User: "Pak UP-12 op"

Claude:
  → get_issue(UP-12)
  → "Issue: 'Login pagina bouwen' in project 'Sales Flow', repo Upscailed/sales-flow"
  → claim_issue(UP-12)
  → add_comment("Start. Plan: NextAuth.js + Supabase auth provider")
  → get_branch_name(UP-12)
  → git fetch && git checkout -b iwan/up-12-login
  → ...werkt code...
  → add_comment("Auth provider werkt. Bezig met login form UI.")
  → ...werkt code...
  → add_comment("Klaar. Tests groen. Maak PR.")
  → git push
  → gh pr create --title "UP-12: Login pagina" --body "Fixes UP-12"
  → "PR aangemaakt: https://github.com/Upscailed/sales-flow/pull/42"

[Webhook handelt rest af bij merge → status: done]
```

## 🔧 Setup (eenmalig per repo)

1. Zorg dat de webhook geregistreerd is op deze repo (zie `scripts/setup-all-webhooks.sh`)
2. Zorg dat het project in P4A een `github_repo` heeft (Upscailed/<repo-name>)
3. Begin met `get_next_issue` om te zien wat er te doen is
