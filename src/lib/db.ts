/**
 * Database-laag voor Supabase.
 *
 * Werkt via de Supabase Management API SQL-endpoint (HTTP) zodat we geen
 * directe Postgres-verbinding nodig hebben. Vereist:
 *   SUPABASE_ACCESS_TOKEN (Personal Access Token)
 *   SUPABASE_PROJECT_REF
 *
 * Alle functies zijn async. Schema wordt beheerd via supabase/migrations/.
 */
import { sql } from './sql';
import { v4 as uuidv4 } from 'uuid';
import type {
  Project, Team, Issue, Comment, Cycle, IssueLink, Activity, View,
  CreateProjectInput, UpdateProjectInput,
  CreateIssueInput, UpdateIssueInput,
  CreateCommentInput, CreateCycleInput, CreateLinkInput,
  ClaimIssueInput,
  IssueStatus, ActivityType, LinkType, User, SafeUser, WorkspaceWithRole,
} from './types';

// Helpers
const tsToIso = (d: any): string => (d instanceof Date ? d.toISOString() : (d ?? ''));
const rowToIssue = (r: any): Issue => ({
  ...r,
  created_at: tsToIso(r.created_at),
  updated_at: tsToIso(r.updated_at),
  started_at: r.started_at ? tsToIso(r.started_at) : null,
  completed_at: r.completed_at ? tsToIso(r.completed_at) : null,
});
const rowToTs = (r: any, fields: string[]): any => {
  const out: any = { ...r };
  for (const f of fields) if (r[f]) out[f] = tsToIso(r[f]);
  return out;
};

// ── Activity log helper (internal) ──
async function logActivity(
  type: ActivityType,
  payload: Record<string, any>,
  opts: { issue_id?: string | null; project_id?: string | null; actor?: string } = {}
) {
  await sql`
    INSERT INTO activity (id, issue_id, project_id, actor, type, payload)
    VALUES (${uuidv4()}, ${opts.issue_id ?? null}, ${opts.project_id ?? null},
            ${opts.actor ?? 'system'}, ${type}, ${JSON.stringify(payload)})
  `;
}

export async function logActivityPublic(type: ActivityType, payload: Record<string, any>, opts: { issue_id?: string; project_id?: string; actor?: string } = {}) {
  await logActivity(type, payload, opts);
}

// ── Users ──

export async function listUsers(): Promise<SafeUser[]> {
  const rows = await sql`SELECT id, email, name, avatar_url, role, plan, plan_until FROM users ORDER BY created_at ASC`;
  return rows as any;
}

export async function getUserById(id: string): Promise<User | undefined> {
  const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
  return rows[0] as any;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const rows = await sql`SELECT * FROM users WHERE LOWER(email) = LOWER(${email})`;
  return rows[0] as any;
}

export async function createUser(input: { email: string; name: string; password_hash: string; avatar_url?: string }): Promise<SafeUser> {
  const id = uuidv4();
  const userCount = ((await sql`SELECT COUNT(*)::int as c FROM users`)[0] as any).c;
  const role = userCount === 0 ? 'admin' : 'member';

  await sql`
    INSERT INTO users (id, email, name, password_hash, avatar_url, role)
    VALUES (${id}, ${input.email}, ${input.name}, ${input.password_hash}, ${input.avatar_url || ''}, ${role})
  `;
  // Auto-add aan default workspace
  const defaultWs = await getDefaultTeam();
  await sql`
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (${defaultWs.id}, ${id}, ${role === 'admin' ? 'admin' : 'member'})
  `;
  const rows = await sql`SELECT id, email, name, avatar_url, role, plan, plan_until FROM users WHERE id = ${id}`;
  return rows[0] as any;
}

export async function userCount(): Promise<number> {
  return ((await sql`SELECT COUNT(*)::int as c FROM users`)[0] as any).c;
}

export async function getUserByGithubId(githubId: number): Promise<User | undefined> {
  const rows = await sql`SELECT * FROM users WHERE github_id = ${githubId}`;
  return rows[0] as any;
}

export async function linkGithubId(userId: string, githubId: number, avatarUrl?: string) {
  await sql`
    UPDATE users
    SET github_id = ${githubId},
        avatar_url = COALESCE(NULLIF(${avatarUrl || ''}, ''), avatar_url)
    WHERE id = ${userId}
  `;
}

export async function findOrCreateGithubUser(input: { github_id: number; email: string; name: string; avatar_url?: string }): Promise<SafeUser> {
  // 1. via github_id
  const byGh = await getUserByGithubId(input.github_id);
  if (byGh) return { id: byGh.id, email: byGh.email, name: byGh.name, avatar_url: byGh.avatar_url, role: byGh.role, plan: byGh.plan, plan_until: byGh.plan_until };

  // 2. via email
  const byEmail = await getUserByEmail(input.email);
  if (byEmail) {
    await linkGithubId(byEmail.id, input.github_id, input.avatar_url);
    return { id: byEmail.id, email: byEmail.email, name: byEmail.name, avatar_url: input.avatar_url || byEmail.avatar_url, role: byEmail.role, plan: byEmail.plan, plan_until: byEmail.plan_until };
  }

  // 3. nieuwe user (geen wachtwoord, alleen OAuth-flow)
  const id = uuidv4();
  const cnt = await userCount();
  const role = cnt === 0 ? 'admin' : 'member';
  await sql`
    INSERT INTO users (id, email, name, password_hash, avatar_url, github_id, role)
    VALUES (${id}, ${input.email}, ${input.name}, '', ${input.avatar_url || ''}, ${input.github_id}, ${role})
  `;
  const defaultWs = await getDefaultTeam();
  await sql`
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (${defaultWs.id}, ${id}, ${role === 'admin' ? 'admin' : 'member'})
  `;
  const rows = await sql`SELECT id, email, name, avatar_url, role, plan, plan_until FROM users WHERE id = ${id}`;
  return rows[0] as any;
}

// ── API Tokens ──

export async function listApiTokensForUser(userId: string): Promise<import('./types').ApiToken[]> {
  const rows = await sql`
    SELECT id, user_id, prefix, name, created_at, last_used_at, revoked_at
    FROM api_tokens
    WHERE user_id = ${userId} AND revoked_at IS NULL
    ORDER BY created_at DESC
  `;
  return rows.map(r => rowToTs(r, ['created_at', 'last_used_at', 'revoked_at'])) as any;
}

export async function createApiToken(input: { user_id: string; name: string; token_hash: string; prefix: string }): Promise<import('./types').ApiToken> {
  const id = uuidv4();
  await sql`
    INSERT INTO api_tokens (id, user_id, name, token_hash, prefix)
    VALUES (${id}, ${input.user_id}, ${input.name}, ${input.token_hash}, ${input.prefix})
  `;
  const rows = await sql`SELECT id, user_id, prefix, name, created_at, last_used_at, revoked_at FROM api_tokens WHERE id = ${id}`;
  return rowToTs(rows[0], ['created_at', 'last_used_at', 'revoked_at']) as any;
}

export async function revokeApiToken(tokenId: string, userId: string): Promise<boolean> {
  const rows = await sql`
    UPDATE api_tokens SET revoked_at = NOW()
    WHERE id = ${tokenId} AND user_id = ${userId} AND revoked_at IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}

/** Token-lookup voor auth. Geeft user_id + token_id terug. */
export async function findUserByApiToken(tokenHash: string): Promise<{ user_id: string; token_id: string } | null> {
  const rows = await sql`
    SELECT id, user_id FROM api_tokens WHERE token_hash = ${tokenHash} AND revoked_at IS NULL
  `;
  if (!rows.length) return null;
  const row = rows[0] as any;
  // last_used_at bijwerken (fire-and-forget, geen await)
  sql`UPDATE api_tokens SET last_used_at = NOW() WHERE id = ${row.id}`.then(() => {}).catch(() => {});
  return { user_id: row.user_id, token_id: row.id };
}

// ── Teams / Workspaces ──

export async function listTeams(): Promise<Team[]> {
  const rows = await sql`SELECT * FROM teams ORDER BY created_at ASC`;
  return rows.map(r => rowToTs(r, ['created_at'])) as any;
}

export async function getTeam(id: string): Promise<Team | undefined> {
  const rows = await sql`SELECT * FROM teams WHERE id = ${id} OR key = ${id}`;
  return rows[0] ? rowToTs(rows[0], ['created_at']) : undefined;
}

export async function getDefaultTeam(): Promise<Team> {
  const rows = await sql`SELECT * FROM teams ORDER BY created_at ASC LIMIT 1`;
  if (!rows[0]) throw new Error('No default workspace configured');
  return rowToTs(rows[0], ['created_at']) as any;
}

export async function listWorkspacesForUser(userId: string): Promise<WorkspaceWithRole[]> {
  const rows = await sql`
    SELECT t.*, m.role
    FROM teams t
    INNER JOIN workspace_members m ON m.workspace_id = t.id
    WHERE m.user_id = ${userId}
    ORDER BY t.created_at ASC
  `;
  return rows.map(r => rowToTs(r, ['created_at'])) as any;
}

export async function createWorkspace(input: { key: string; name: string; description?: string; creator_user_id: string }): Promise<Team> {
  const id = uuidv4();
  const key = input.key.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'WS';
  const existing = await sql`SELECT 1 FROM teams WHERE key = ${key}`;
  if (existing.length) throw new Error(`Workspace key "${key}" bestaat al`);

  await sql`INSERT INTO teams (id, key, name, description) VALUES (${id}, ${key}, ${input.name}, ${input.description || ''})`;
  await sql`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (${id}, ${input.creator_user_id}, 'admin')`;
  await sql`INSERT INTO counters (key, value) VALUES (${'issue_seq:' + key}, 0) ON CONFLICT DO NOTHING`;

  const team = await getTeam(id);
  return team!;
}

export async function addUserToWorkspace(workspaceId: string, userId: string, role: 'admin' | 'member' = 'member') {
  await sql`
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (${workspaceId}, ${userId}, ${role})
    ON CONFLICT DO NOTHING
  `;
}

export async function isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM workspace_members WHERE workspace_id = ${workspaceId} AND user_id = ${userId}`;
  return rows.length > 0;
}

export async function listWorkspaceMembers(workspaceId: string) {
  const rows = await sql`
    SELECT u.id, u.email, u.name, u.avatar_url, m.role, m.joined_at
    FROM workspace_members m
    INNER JOIN users u ON u.id = m.user_id
    WHERE m.workspace_id = ${workspaceId}
    ORDER BY m.joined_at ASC
  `;
  return rows.map(r => rowToTs(r, ['joined_at']));
}

// ── Projects ──

export async function listProjects(): Promise<Project[]> {
  const rows = await sql`SELECT * FROM projects ORDER BY created_at DESC`;
  return rows.map(r => rowToTs(r, ['created_at', 'updated_at'])) as any;
}

export async function getProject(id: string): Promise<Project | undefined> {
  const rows = await sql`SELECT * FROM projects WHERE id = ${id}`;
  return rows[0] ? rowToTs(rows[0], ['created_at', 'updated_at']) : undefined;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const id = uuidv4();
  const teamId = input.team_id ?? (await getDefaultTeam()).id;
  await sql`
    INSERT INTO projects (id, name, description, color, team_id)
    VALUES (${id}, ${input.name}, ${input.description || ''}, ${input.color || '#8B5CF6'}, ${teamId})
  `;
  await logActivity('issue_created', { kind: 'project', name: input.name }, { project_id: id, actor: 'user' });
  return (await getProject(id))!;
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project | undefined> {
  const existing = await getProject(id);
  if (!existing) return undefined;
  await sql`
    UPDATE projects SET
      name        = COALESCE(${input.name ?? null}, name),
      description = COALESCE(${input.description ?? null}, description),
      color       = COALESCE(${input.color ?? null}, color),
      team_id     = COALESCE(${input.team_id ?? null}, team_id),
      updated_at  = NOW()
    WHERE id = ${id}
  `;
  return getProject(id);
}

export async function deleteProject(id: string): Promise<boolean> {
  const r = await sql`DELETE FROM projects WHERE id = ${id} RETURNING id`;
  return r.length > 0;
}

// ── Issues ──

interface IssueFilters {
  project_id?: string;
  team_id?: string;
  status?: string | string[];
  priority?: string | string[];
  assignee?: string;
  cycle_id?: string;
  parent_issue_id?: string | null;
  search?: string;
}

export async function listIssues(filters?: IssueFilters): Promise<Issue[]> {
  const s = sql;
  // postgres.js conditionele query: bouw met sql.unsafe of nested templates
  const conds: any[] = [];
  if (filters?.project_id) conds.push(s`project_id = ${filters.project_id}`);
  if (filters?.team_id) conds.push(s`team_id = ${filters.team_id}`);
  if (filters?.status) {
    const arr = Array.isArray(filters.status) ? filters.status : [filters.status];
    conds.push(s`status IN ${s(arr)}`);
  }
  if (filters?.priority) {
    const arr = Array.isArray(filters.priority) ? filters.priority : [filters.priority];
    conds.push(s`priority IN ${s(arr)}`);
  }
  if (filters?.assignee !== undefined) conds.push(s`assignee = ${filters.assignee}`);
  if (filters?.cycle_id !== undefined) {
    if (filters.cycle_id === null || filters.cycle_id === 'null') conds.push(s`cycle_id IS NULL`);
    else conds.push(s`cycle_id = ${filters.cycle_id}`);
  }
  if (filters?.parent_issue_id !== undefined) {
    if (filters.parent_issue_id === null) conds.push(s`parent_issue_id IS NULL`);
    else conds.push(s`parent_issue_id = ${filters.parent_issue_id}`);
  }
  if (filters?.search) {
    const pat = `%${filters.search}%`;
    conds.push(s`(title ILIKE ${pat} OR description ILIKE ${pat} OR identifier ILIKE ${pat})`);
  }

  const where = conds.length
    ? conds.reduce((acc, c, i) => i === 0 ? c : s`${acc} AND ${c}`)
    : s`true`;

  const rows = await s`
    SELECT * FROM issues
    WHERE ${where}
    ORDER BY sort_order ASC, created_at DESC
  `;
  return rows.map(rowToIssue);
}

export async function getIssue(id: string): Promise<Issue | undefined> {
  const rows = await sql`SELECT * FROM issues WHERE id = ${id} OR identifier = ${id}`;
  return rows[0] ? rowToIssue(rows[0]) : undefined;
}

async function nextIdentifier(teamKey: string): Promise<string> {
  const key = `issue_seq:${teamKey}`;
  await sql`INSERT INTO counters (key, value) VALUES (${key}, 0) ON CONFLICT DO NOTHING`;
  const rows = await sql`UPDATE counters SET value = value + 1 WHERE key = ${key} RETURNING value`;
  const value = (rows[0] as any).value;
  return `${teamKey}-${value}`;
}

export async function createIssue(input: CreateIssueInput): Promise<Issue> {
  const id = uuidv4();
  const project = await getProject(input.project_id);
  const teamId = input.team_id ?? project?.team_id ?? (await getDefaultTeam()).id;
  const team = teamId ? await getTeam(teamId) : await getDefaultTeam();
  const identifier = await nextIdentifier(team?.key || 'UP');
  const labels = JSON.stringify(input.labels || []);

  await sql`
    INSERT INTO issues (
      id, identifier, project_id, team_id, title, description, status, priority,
      labels, acceptance_criteria, assignee, parent_issue_id, estimate, due_date,
      cycle_id, github_branch, sort_order
    ) VALUES (
      ${id}, ${identifier}, ${input.project_id}, ${teamId}, ${input.title},
      ${input.description || ''}, ${input.status || 'backlog'},
      ${input.priority || 'none'}, ${labels},
      ${input.acceptance_criteria || ''}, ${input.assignee || ''},
      ${input.parent_issue_id || null}, ${input.estimate ?? null},
      ${input.due_date ?? null}, ${input.cycle_id ?? null},
      ${input.github_branch || ''}, 0
    )
  `;
  await logActivity('issue_created',
    { identifier, title: input.title, status: input.status || 'backlog' },
    { issue_id: id, project_id: input.project_id, actor: input.assignee || 'user' });
  return (await getIssue(id))!;
}

export async function updateIssue(id: string, input: UpdateIssueInput, actor = 'user'): Promise<Issue | undefined> {
  const existing = await getIssue(id);
  if (!existing) return undefined;

  const labels = input.labels !== undefined ? JSON.stringify(input.labels) : null;
  let startedAt: string | null | undefined = undefined;
  let completedAt: string | null | undefined = undefined;
  if (input.status) {
    if (input.status === 'in_progress' && existing.status !== 'in_progress' && !existing.started_at) {
      startedAt = new Date().toISOString();
    }
    if (input.status === 'done' && existing.status !== 'done') {
      completedAt = new Date().toISOString();
    } else if (input.status !== 'done' && existing.status === 'done') {
      completedAt = null;
    }
  }

  // postgres.js helper: gebruik COALESCE met expliciete null-cast
  const s = sql;
  await s`
    UPDATE issues SET
      title               = COALESCE(${input.title ?? null}, title),
      description         = COALESCE(${input.description ?? null}, description),
      status              = COALESCE(${input.status ?? null}, status),
      priority            = COALESCE(${input.priority ?? null}, priority),
      labels              = COALESCE(${labels}, labels),
      acceptance_criteria = COALESCE(${input.acceptance_criteria ?? null}, acceptance_criteria),
      assignee            = COALESCE(${input.assignee ?? null}, assignee),
      parent_issue_id     = ${input.parent_issue_id === null ? null : (input.parent_issue_id ?? existing.parent_issue_id)},
      estimate            = ${input.estimate === null ? null : (input.estimate ?? existing.estimate)},
      due_date            = ${input.due_date === null ? null : (input.due_date ?? existing.due_date)},
      cycle_id            = ${input.cycle_id === null ? null : (input.cycle_id ?? existing.cycle_id)},
      github_branch       = COALESCE(${input.github_branch ?? null}, github_branch),
      github_pr_url       = COALESCE(${input.github_pr_url ?? null}, github_pr_url),
      github_pr_number    = COALESCE(${input.github_pr_number ?? null}, github_pr_number),
      project_id          = COALESCE(${input.project_id ?? null}, project_id),
      team_id             = COALESCE(${input.team_id ?? null}, team_id),
      sort_order          = COALESCE(${input.sort_order ?? null}, sort_order),
      updated_at          = NOW(),
      started_at          = ${startedAt === undefined ? existing.started_at : startedAt},
      completed_at        = ${completedAt === undefined ? existing.completed_at : completedAt}
    WHERE id = ${existing.id}
  `;

  const updated = await getIssue(existing.id);

  // Activity events
  if (updated && input.status && input.status !== existing.status) {
    await logActivity('status_changed', { from: existing.status, to: input.status, identifier: existing.identifier },
      { issue_id: updated.id, project_id: updated.project_id, actor });
  }
  if (updated && input.priority && input.priority !== existing.priority) {
    await logActivity('priority_changed', { from: existing.priority, to: input.priority, identifier: existing.identifier },
      { issue_id: updated.id, project_id: updated.project_id, actor });
  }
  if (updated && input.assignee !== undefined && input.assignee !== existing.assignee) {
    await logActivity('assignee_changed', { from: existing.assignee, to: input.assignee, identifier: existing.identifier },
      { issue_id: updated.id, project_id: updated.project_id, actor });
  }
  if (updated && input.github_branch && input.github_branch !== existing.github_branch) {
    await logActivity('branch_linked', { branch: input.github_branch, identifier: existing.identifier },
      { issue_id: updated.id, project_id: updated.project_id, actor });
  }
  if (updated && input.github_pr_url && input.github_pr_url !== existing.github_pr_url) {
    await logActivity('pr_linked', { url: input.github_pr_url, identifier: existing.identifier },
      { issue_id: updated.id, project_id: updated.project_id, actor });
  }
  return updated;
}

export async function deleteIssue(id: string): Promise<boolean> {
  const r = await sql`DELETE FROM issues WHERE id = ${id} OR identifier = ${id} RETURNING id`;
  return r.length > 0;
}

// ── Agent helpers ──

export async function getNextIssue(opts: { assignee?: string; project_id?: string; team_id?: string } = {}): Promise<Issue | null> {
  const s = sql;
  const conds: any[] = [
    s`i.status IN ('todo','backlog','triage')`,
    s`blocker.id IS NULL`,
  ];
  if (opts.assignee) conds.push(s`(i.assignee = ${opts.assignee} OR i.assignee = '')`);
  if (opts.project_id) conds.push(s`i.project_id = ${opts.project_id}`);
  if (opts.team_id) conds.push(s`i.team_id = ${opts.team_id}`);
  const where = conds.reduce((acc, c, i) => i === 0 ? c : s`${acc} AND ${c}`);
  const rows = await s`
    SELECT i.* FROM issues i
    LEFT JOIN issue_links l ON l.from_issue_id = i.id AND l.link_type = 'blocked_by'
    LEFT JOIN issues blocker ON blocker.id = l.to_issue_id AND blocker.status NOT IN ('done','cancelled')
    WHERE ${where}
    ORDER BY
      CASE i.priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END DESC,
      CASE i.status WHEN 'todo' THEN 3 WHEN 'backlog' THEN 2 WHEN 'triage' THEN 1 ELSE 0 END DESC,
      i.sort_order ASC,
      i.created_at ASC
    LIMIT 1
  `;
  return rows[0] ? rowToIssue(rows[0]) : null;
}

export async function claimIssue(id: string, input: ClaimIssueInput): Promise<Issue | undefined> {
  const issue = await getIssue(id);
  if (!issue) return undefined;
  if (issue.status === 'done' || issue.status === 'cancelled') {
    throw new Error(`Issue ${issue.identifier} is al ${issue.status}`);
  }
  const updated = await updateIssue(issue.id, { assignee: input.assignee, status: 'in_progress' }, input.assignee);
  if (input.comment) {
    await createComment({ issue_id: issue.id, author: input.assignee, body: input.comment });
  } else {
    await createComment({
      issue_id: issue.id, author: input.assignee,
      body: `🤖 ${input.assignee} heeft deze issue opgepakt en start met de implementatie.`
    });
  }
  return updated;
}

export async function generateBranchName(id: string, prefix?: string): Promise<string | null> {
  const issue = await getIssue(id);
  if (!issue) return null;
  const owner = (prefix || issue.assignee || 'agent')
    .toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'agent';
  const slug = issue.title.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  return `${owner}/${issue.identifier.toLowerCase()}-${slug}`;
}

export function parseIdentifiers(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/\b([A-Z]{2,5})-(\d+)\b/g);
  return matches ? Array.from(new Set(matches)) : [];
}

export function parseClosingIdentifiers(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const re = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+([A-Z]{2,5}-\d+)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1].toUpperCase());
  return Array.from(new Set(out));
}

// ── Comments ──

export async function listComments(issueId: string): Promise<Comment[]> {
  const issue = await getIssue(issueId);
  if (!issue) return [];
  const rows = await sql`SELECT * FROM comments WHERE issue_id = ${issue.id} ORDER BY created_at ASC`;
  return rows.map(r => rowToTs(r, ['created_at'])) as any;
}

export async function createComment(input: CreateCommentInput): Promise<Comment> {
  const issue = await getIssue(input.issue_id);
  if (!issue) throw new Error('Issue not found');
  const id = uuidv4();
  await sql`
    INSERT INTO comments (id, issue_id, author, body)
    VALUES (${id}, ${issue.id}, ${input.author || 'user'}, ${input.body})
  `;
  await logActivity('comment_added',
    { author: input.author || 'user', identifier: issue.identifier, preview: input.body.slice(0, 80) },
    { issue_id: issue.id, project_id: issue.project_id, actor: input.author || 'user' });
  const rows = await sql`SELECT * FROM comments WHERE id = ${id}`;
  return rowToTs(rows[0], ['created_at']) as any;
}

// ── Cycles ──

export async function listCycles(teamId?: string): Promise<Cycle[]> {
  const s = sql;
  await s`UPDATE cycles SET status = 'active'    WHERE starts_at <= now()::text AND ends_at >= now()::text AND status != 'active'`;
  await s`UPDATE cycles SET status = 'completed' WHERE ends_at   <  now()::text                              AND status != 'completed'`;
  await s`UPDATE cycles SET status = 'upcoming'  WHERE starts_at >  now()::text                              AND status != 'upcoming'`;

  const rows = teamId
    ? await s`SELECT * FROM cycles WHERE team_id = ${teamId} ORDER BY starts_at DESC`
    : await s`SELECT * FROM cycles ORDER BY starts_at DESC`;
  return rows.map(r => rowToTs(r, ['created_at'])) as any;
}

export async function getCycle(id: string): Promise<Cycle | undefined> {
  const rows = await sql`SELECT * FROM cycles WHERE id = ${id}`;
  return rows[0] ? rowToTs(rows[0], ['created_at']) : undefined;
}

export async function createCycle(input: CreateCycleInput): Promise<Cycle> {
  const id = uuidv4();
  const teamId = input.team_id ?? (await getDefaultTeam()).id;
  await sql`
    INSERT INTO cycles (id, team_id, name, description, starts_at, ends_at, status)
    VALUES (${id}, ${teamId}, ${input.name}, ${input.description || ''}, ${input.starts_at}, ${input.ends_at}, 'upcoming')
  `;
  return (await getCycle(id))!;
}

export async function deleteCycle(id: string): Promise<boolean> {
  const r = await sql`DELETE FROM cycles WHERE id = ${id} RETURNING id`;
  return r.length > 0;
}

// ── Issue links ──

export async function listLinks(issueId: string): Promise<IssueLink[]> {
  const issue = await getIssue(issueId);
  if (!issue) return [];
  const rows = await sql`
    SELECT * FROM issue_links WHERE from_issue_id = ${issue.id} OR to_issue_id = ${issue.id} ORDER BY created_at ASC
  `;
  return rows.map(r => rowToTs(r, ['created_at'])) as any;
}

export async function createLink(input: CreateLinkInput): Promise<IssueLink> {
  const from = await getIssue(input.from_issue_id);
  const to = await getIssue(input.to_issue_id);
  if (!from || !to) throw new Error('Issue niet gevonden');
  if (from.id === to.id) throw new Error('Issue kan niet aan zichzelf gelinkt worden');

  const id = uuidv4();
  await sql`
    INSERT INTO issue_links (id, from_issue_id, to_issue_id, link_type)
    VALUES (${id}, ${from.id}, ${to.id}, ${input.link_type})
    ON CONFLICT DO NOTHING
  `;

  const inverse: Record<LinkType, LinkType> = {
    blocks: 'blocked_by',
    blocked_by: 'blocks',
    relates_to: 'relates_to',
    duplicates: 'duplicate_of',
    duplicate_of: 'duplicates',
  };
  await sql`
    INSERT INTO issue_links (id, from_issue_id, to_issue_id, link_type)
    VALUES (${uuidv4()}, ${to.id}, ${from.id}, ${inverse[input.link_type]})
    ON CONFLICT DO NOTHING
  `;

  await logActivity('linked_issue_added',
    { link_type: input.link_type, from: from.identifier, to: to.identifier },
    { issue_id: from.id, project_id: from.project_id, actor: 'user' });

  const rows = await sql`
    SELECT * FROM issue_links WHERE from_issue_id = ${from.id} AND to_issue_id = ${to.id} AND link_type = ${input.link_type}
  `;
  return rowToTs(rows[0], ['created_at']) as any;
}

export async function deleteLink(id: string): Promise<boolean> {
  const r = await sql`DELETE FROM issue_links WHERE id = ${id} RETURNING id`;
  return r.length > 0;
}

export async function listSubIssues(parentId: string): Promise<Issue[]> {
  const parent = await getIssue(parentId);
  if (!parent) return [];
  const rows = await sql`SELECT * FROM issues WHERE parent_issue_id = ${parent.id} ORDER BY sort_order ASC, created_at ASC`;
  return rows.map(rowToIssue);
}

// ── Activity ──

export async function listActivity(opts: { issue_id?: string; project_id?: string; limit?: number } = {}): Promise<Activity[]> {
  const s = sql;
  const limit = opts.limit ?? 100;
  let issueFilter: string | null = null;
  if (opts.issue_id) {
    const issue = await getIssue(opts.issue_id);
    if (!issue) return [];
    issueFilter = issue.id;
  }
  const rows = issueFilter && opts.project_id
    ? await s`SELECT * FROM activity WHERE issue_id = ${issueFilter} AND project_id = ${opts.project_id} ORDER BY created_at DESC LIMIT ${limit}`
    : issueFilter
      ? await s`SELECT * FROM activity WHERE issue_id = ${issueFilter} ORDER BY created_at DESC LIMIT ${limit}`
      : opts.project_id
        ? await s`SELECT * FROM activity WHERE project_id = ${opts.project_id} ORDER BY created_at DESC LIMIT ${limit}`
        : await s`SELECT * FROM activity ORDER BY created_at DESC LIMIT ${limit}`;
  return rows.map(r => rowToTs(r, ['created_at'])) as any;
}

// ── Views ──

export async function listViews(): Promise<View[]> {
  const rows = await sql`SELECT * FROM views ORDER BY sort_order ASC, created_at ASC`;
  return rows.map(r => rowToTs(r, ['created_at'])) as any;
}

export async function getView(id: string): Promise<View | undefined> {
  const rows = await sql`SELECT * FROM views WHERE id = ${id}`;
  return rows[0] ? rowToTs(rows[0], ['created_at']) : undefined;
}

export async function createView(input: { name: string; description?: string; filter: any; icon?: string; sort_order?: number }): Promise<View> {
  const id = uuidv4();
  await sql`
    INSERT INTO views (id, name, description, filter, icon, sort_order)
    VALUES (${id}, ${input.name}, ${input.description || ''}, ${JSON.stringify(input.filter || {})}, ${input.icon || 'views'}, ${input.sort_order ?? 99})
  `;
  return (await getView(id))!;
}

export async function deleteView(id: string): Promise<boolean> {
  const r = await sql`DELETE FROM views WHERE id = ${id} RETURNING id`;
  return r.length > 0;
}

// ── GitHub state machine ──

export async function applyGithubPrEvent(event: {
  action: 'opened' | 'reopened' | 'review_requested' | 'closed' | 'merged' | 'synchronize';
  pr_url: string;
  pr_number: number;
  branch: string;
  title: string;
  body: string;
  merged?: boolean;
}) {
  const candidates = new Set<string>([
    ...parseIdentifiers(event.branch),
    ...parseIdentifiers(event.title),
    ...parseIdentifiers(event.body),
  ]);
  const closing = new Set<string>([
    ...parseClosingIdentifiers(event.title),
    ...parseClosingIdentifiers(event.body),
  ]);

  const touched: { identifier: string; new_status?: IssueStatus }[] = [];
  for (const ident of candidates) {
    const issue = await getIssue(ident);
    if (!issue) continue;

    let newStatus: IssueStatus | undefined;
    if (event.action === 'opened' || event.action === 'reopened') newStatus = 'in_progress';
    else if (event.action === 'review_requested') newStatus = 'in_review';
    else if (event.action === 'closed' && event.merged) newStatus = closing.has(ident) ? 'done' : 'done';
    else if (event.action === 'closed' && !event.merged) newStatus = 'todo';

    const patch: UpdateIssueInput = {
      github_branch: event.branch || issue.github_branch,
      github_pr_url: event.pr_url,
      github_pr_number: event.pr_number,
    };
    if (newStatus) patch.status = newStatus;

    await updateIssue(issue.id, patch, 'github');
    await logActivity(
      event.action === 'opened' ? 'pr_opened' :
      event.action === 'review_requested' ? 'pr_review_requested' :
      event.action === 'closed' && event.merged ? 'pr_merged' :
      event.action === 'closed' ? 'pr_closed' : 'pr_linked',
      { pr_url: event.pr_url, pr_number: event.pr_number, branch: event.branch, title: event.title, identifier: ident },
      { issue_id: issue.id, project_id: issue.project_id, actor: 'github' });
    touched.push({ identifier: ident, new_status: newStatus });
  }
  return { touched };
}

// ── Stats ──

export async function getStats() {
  const s = sql;
  const total = ((await s`SELECT COUNT(*)::int as c FROM issues`)[0] as any).c;
  const byStatus = await s`SELECT status, COUNT(*)::int as count FROM issues GROUP BY status`;
  const byPriority = await s`SELECT priority, COUNT(*)::int as count FROM issues GROUP BY priority`;
  const byAssignee = await s`SELECT assignee, COUNT(*)::int as count FROM issues WHERE assignee != '' GROUP BY assignee`;
  const projectCount = ((await s`SELECT COUNT(*)::int as c FROM projects`)[0] as any).c;
  const activeCycles = ((await s`SELECT COUNT(*)::int as c FROM cycles WHERE status = 'active'`)[0] as any).c;
  return { total, projectCount, byStatus, byPriority, byAssignee, activeCycles };
}
