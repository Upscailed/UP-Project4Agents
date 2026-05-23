# Changelog

Alle wijzigingen aan deze MCP-server volgens [Keep a Changelog](https://keepachangelog.com).
[Semantic Versioning](https://semver.org).

## [Unreleased]

### Changed
- Forced redeploy 2026-05-22 om `list_issues` productie-bug te resetten (source was schoon, deploy stale).
- Deploy-marker: redeploy getriggerd via Vercel auto-deploy op `main` push (2026-05-22).

## [1.0.0] — 2026-05-22

### Added
- Initiële MCP-baseline volgens [Upscailed MCP Gold-Standard](../../Iwan%20-%20OS/Systeem/MCP/GOLD_STANDARD.md) v1.0.
- 22 tools beschikbaar via één endpoint:
  - **Projects** — `list_projects`, `get_project`, `create_project`, `update_project`
  - **Issues** — `list_issues`, `get_issue`, `get_next_issue`, `create_issue`, `update_issue`, `delete_issue`, `claim_issue`
  - **Comments / activity** — `add_comment`, `list_comments`, `get_activity`
  - **Links / sub-issues** — `link_issues`, `get_issue_links`, `get_sub_issues`
  - **Cycles** — `list_cycles`, `create_cycle`
  - **Branch / views / stats** — `get_branch_name`, `list_views`, `get_stats`
- Auth: Bearer PAT (`P4A_TOKEN`), token-prefix `p4a_`, server-side scope-validatie via hoofd-API.
- Transport: Streamable HTTP via Next.js App-Router API-route op `/api/mcp` (per-request stateless, CORS open voor `Authorization`, `Content-Type`, `Mcp-Session-Id`, `Mcp-Protocol-Version`).
- Production endpoint: `https://project4agents.upscailed.nl/api/mcp`.
- Tool-output: alle tools retourneren gestructureerde JSON in `content[0].text` (text-wrapper), errors via `isError: true`.
- Resources: niet meegeleverd in 1.0 (alle data exposed via tools).

[Unreleased]: https://github.com/Upscailed/UP-Project4Agents/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Upscailed/UP-Project4Agents/releases/tag/v1.0.0
