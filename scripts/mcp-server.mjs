#!/usr/bin/env node
/**
 * UP-Project4Agents MCP server.
 *
 * Stdio MCP-server die de REST API op http://localhost:3400/api wrapt.
 * Maakt issue/project/cycle/links functionaliteit beschikbaar voor Claude Code.
 *
 * Installatie in Claude Code:
 *   Voor dit project: zet `.mcp.json` in project root (zie default in repo).
 *   Globaal: `claude mcp add project4agents node /pad/naar/scripts/mcp-server.mjs`
 *
 * Vereist: Next.js dev server draait op http://localhost:3400 (npm run dev).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const API_BASE = process.env.P4A_API || 'http://localhost:3400/api';
const API_TOKEN = process.env.P4A_API_TOKEN || '';

// ── HTTP helpers ──
async function api(method, path, body) {
  const url = `${API_BASE}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  if (API_TOKEN) headers['Authorization'] = `Bearer ${API_TOKEN}`;
  const init = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(url, init);
  if (res.status === 204) return { ok: true, status: 204 };
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
  return data;
}

// ── Tool definities ──
const TOOLS = [
  {
    name: 'list_projects',
    description: 'Lijst alle projecten op.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'create_project',
    description: 'Maak een nieuw project aan.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        color: { type: 'string', description: 'Hex kleur, bv #8B5CF6' },
      },
    },
  },
  {
    name: 'list_issues',
    description: 'Lijst issues op. Filter optioneel op project, status, priority, assignee, cycle, search.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        status: { type: 'string', description: 'comma-separated: backlog,todo,in_progress,in_review,done,cancelled,triage' },
        priority: { type: 'string', description: 'comma-separated: urgent,high,medium,low,none' },
        assignee: { type: 'string' },
        cycle_id: { type: 'string' },
        parent_issue_id: { type: 'string' },
        search: { type: 'string' },
      },
    },
  },
  {
    name: 'get_issue',
    description: 'Haal één issue op met sub-issues. Accepteert UUID of identifier (UP-42).',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
  },
  {
    name: 'get_next_issue',
    description: 'Volgende taak: hoogste prioriteit in todo/backlog die niet geblokkeerd is. Optioneel gefilterd op assignee/project.',
    inputSchema: {
      type: 'object',
      properties: {
        assignee: { type: 'string', description: 'bv "agent" of "iwan"' },
        project_id: { type: 'string' },
      },
    },
  },
  {
    name: 'claim_issue',
    description: 'Claim een issue atomair: zet status=in_progress + assignee + voegt comment toe.',
    inputSchema: {
      type: 'object',
      required: ['id', 'assignee'],
      properties: {
        id: { type: 'string', description: 'issue id of identifier' },
        assignee: { type: 'string' },
        comment: { type: 'string', description: 'optionele eerste activity-comment' },
      },
    },
  },
  {
    name: 'create_issue',
    description: 'Maak een nieuwe issue aan.',
    inputSchema: {
      type: 'object',
      required: ['project_id', 'title'],
      properties: {
        project_id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string' },
        priority: { type: 'string', enum: ['none', 'low', 'medium', 'high', 'urgent'] },
        labels: { type: 'array', items: { type: 'string' } },
        acceptance_criteria: { type: 'string' },
        assignee: { type: 'string' },
        parent_issue_id: { type: 'string', description: 'voor sub-issues' },
        estimate: { type: 'number' },
        due_date: { type: 'string', description: 'YYYY-MM-DD' },
        cycle_id: { type: 'string' },
        github_branch: { type: 'string' },
      },
    },
  },
  {
    name: 'update_issue',
    description: 'Werk een issue bij. Alle velden optioneel.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string' },
        priority: { type: 'string' },
        labels: { type: 'array', items: { type: 'string' } },
        acceptance_criteria: { type: 'string' },
        assignee: { type: 'string' },
        parent_issue_id: { type: ['string', 'null'] },
        estimate: { type: ['number', 'null'] },
        due_date: { type: ['string', 'null'] },
        cycle_id: { type: ['string', 'null'] },
        github_branch: { type: 'string' },
        github_pr_url: { type: 'string' },
      },
    },
  },
  {
    name: 'delete_issue',
    description: 'Verwijder een issue (let op: cascade naar comments + links).',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
  },
  {
    name: 'add_comment',
    description: 'Voeg een comment / activity toe aan een issue.',
    inputSchema: {
      type: 'object',
      required: ['issue_id', 'body'],
      properties: {
        issue_id: { type: 'string' },
        author: { type: 'string', description: 'bv "agent" of "iwan"' },
        body: { type: 'string' },
      },
    },
  },
  {
    name: 'list_comments',
    description: 'Lijst comments van een issue.',
    inputSchema: { type: 'object', required: ['issue_id'], properties: { issue_id: { type: 'string' } } },
  },
  {
    name: 'get_branch_name',
    description: 'Branch-naam suggestie zoals Linear: prefix/up-42-titel-slug.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'issue id of identifier' },
        prefix: { type: 'string', description: 'bv "iwan" of "agent"' },
      },
    },
  },
  {
    name: 'link_issues',
    description: 'Koppel twee issues (blocks / blocked_by / relates_to / duplicates).',
    inputSchema: {
      type: 'object',
      required: ['from_id', 'to_id', 'link_type'],
      properties: {
        from_id: { type: 'string' },
        to_id: { type: 'string' },
        link_type: { type: 'string', enum: ['blocks', 'blocked_by', 'relates_to', 'duplicates'] },
      },
    },
  },
  {
    name: 'get_issue_links',
    description: 'Lijst links van een issue (incoming + outgoing).',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
  },
  {
    name: 'list_cycles',
    description: 'Lijst alle cycles (sprints).',
    inputSchema: { type: 'object', properties: { team_id: { type: 'string' } } },
  },
  {
    name: 'create_cycle',
    description: 'Maak een nieuwe cycle (sprint) aan.',
    inputSchema: {
      type: 'object',
      required: ['name', 'starts_at', 'ends_at'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        starts_at: { type: 'string', description: 'YYYY-MM-DD' },
        ends_at: { type: 'string', description: 'YYYY-MM-DD' },
        team_id: { type: 'string' },
      },
    },
  },
  {
    name: 'get_activity',
    description: 'Activity log — alle wijzigingen, optioneel gefilterd op issue of project.',
    inputSchema: {
      type: 'object',
      properties: {
        issue_id: { type: 'string' },
        project_id: { type: 'string' },
        limit: { type: 'number', description: 'default 100' },
      },
    },
  },
  {
    name: 'list_views',
    description: 'Lijst opgeslagen views/filters.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_stats',
    description: 'Statistieken: totaal issues, per status, per priority, per assignee.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'sync_github',
    description: 'Trigger handmatige sync met GitHub (haalt PRs op via gh CLI en past statussen aan).',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'bv "Upscailed/UP-Project4Agents"' },
        since: { type: 'string', description: 'ISO datum — alleen PRs updated sinds dan' },
      },
    },
  },
];

// ── Tool handlers ──
async function callTool(name, args) {
  args = args || {};
  switch (name) {
    case 'list_projects': return api('GET', '/projects');
    case 'create_project': return api('POST', '/projects', args);

    case 'list_issues': {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(args)) if (v !== undefined && v !== null) qs.set(k, String(v));
      return api('GET', `/issues?${qs}`);
    }
    case 'get_issue': return api('GET', `/issues?id=${encodeURIComponent(args.id)}`);
    case 'get_next_issue': {
      const qs = new URLSearchParams();
      if (args.assignee) qs.set('assignee', args.assignee);
      if (args.project_id) qs.set('project_id', args.project_id);
      return api('GET', `/issues/next?${qs}`);
    }
    case 'claim_issue':
      return api('POST', `/issues/${encodeURIComponent(args.id)}/claim`, { assignee: args.assignee, comment: args.comment });

    case 'create_issue': return api('POST', '/issues', args);
    case 'update_issue': {
      const { id, ...body } = args;
      return api('PATCH', `/issues?id=${encodeURIComponent(id)}`, body);
    }
    case 'delete_issue': return api('DELETE', `/issues?id=${encodeURIComponent(args.id)}`);

    case 'add_comment': return api('POST', '/comments', args);
    case 'list_comments': return api('GET', `/comments?issue_id=${encodeURIComponent(args.issue_id)}`);

    case 'get_branch_name': {
      const qs = args.prefix ? `?prefix=${encodeURIComponent(args.prefix)}` : '';
      return api('GET', `/issues/${encodeURIComponent(args.id)}/branch-name${qs}`);
    }

    case 'link_issues':
      return api('POST', `/issues/${encodeURIComponent(args.from_id)}/links`, { to: args.to_id, link_type: args.link_type });
    case 'get_issue_links':
      return api('GET', `/issues/${encodeURIComponent(args.id)}/links`);

    case 'list_cycles': return api('GET', `/cycles${args.team_id ? `?team_id=${encodeURIComponent(args.team_id)}` : ''}`);
    case 'create_cycle': return api('POST', '/cycles', args);

    case 'get_activity': {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(args)) if (v !== undefined && v !== null) qs.set(k, String(v));
      return api('GET', `/activity?${qs}`);
    }
    case 'list_views': return api('GET', '/views');
    case 'get_stats': return api('GET', '/stats');
    case 'sync_github': return api('POST', '/github/sync', args);

    default: throw new Error(`Unknown tool: ${name}`);
  }
}

// ── MCP server boot ──
const server = new Server(
  { name: 'project4agents', version: '0.2.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    const result = await callTool(name, args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Error: ${e.message}\n\nIs de dev-server actief op ${API_BASE}? Start hem met \`npm run dev\` in UP-Project4Agents.` }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[project4agents] MCP server up — backend: ${API_BASE}`);
