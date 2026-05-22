import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type {
  Project, Team, Issue, Comment, Cycle, IssueLink, Activity, View,
  CreateProjectInput, UpdateProjectInput,
  CreateIssueInput, UpdateIssueInput,
  CreateCommentInput, CreateCycleInput, CreateLinkInput,
  ClaimIssueInput,
  IssueStatus, ActivityType, LinkType,
} from './types';

// ── Database singleton ──
const DB_PATH = path.join(process.cwd(), 'data', 'project4agents.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
    migrate(_db);
    seedDefaults(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      github_id INTEGER UNIQUE,
      role TEXT DEFAULT 'member',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workspace_members (
      workspace_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'member',
      joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (workspace_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_ws_members_user ON workspace_members(user_id);

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      color TEXT DEFAULT '#8B5CF6',
      team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL UNIQUE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'backlog',
      priority TEXT DEFAULT 'none',
      labels TEXT DEFAULT '[]',
      acceptance_criteria TEXT DEFAULT '',
      assignee TEXT DEFAULT '',
      parent_issue_id TEXT REFERENCES issues(id) ON DELETE SET NULL,
      estimate INTEGER,
      due_date TEXT,
      cycle_id TEXT REFERENCES cycles(id) ON DELETE SET NULL,
      github_branch TEXT DEFAULT '',
      github_pr_url TEXT DEFAULT '',
      github_pr_number INTEGER,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      author TEXT DEFAULT 'user',
      body TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cycles (
      id TEXT PRIMARY KEY,
      team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      status TEXT DEFAULT 'upcoming',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS issue_links (
      id TEXT PRIMARY KEY,
      from_issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      to_issue_id   TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      link_type TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(from_issue_id, to_issue_id, link_type)
    );

    CREATE TABLE IF NOT EXISTS activity (
      id TEXT PRIMARY KEY,
      issue_id TEXT REFERENCES issues(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      actor TEXT DEFAULT 'system',
      type TEXT NOT NULL,
      payload TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS views (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      filter TEXT NOT NULL DEFAULT '{}',
      icon TEXT DEFAULT '⊟',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS counters (
      key TEXT PRIMARY KEY,
      value INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_issues_status   ON issues(status);
    CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
    CREATE INDEX IF NOT EXISTS idx_issues_assignee ON issues(assignee);
    CREATE INDEX IF NOT EXISTS idx_issues_project  ON issues(project_id);
    CREATE INDEX IF NOT EXISTS idx_issues_cycle    ON issues(cycle_id);
    CREATE INDEX IF NOT EXISTS idx_issues_parent   ON issues(parent_issue_id);
    CREATE INDEX IF NOT EXISTS idx_activity_issue  ON activity(issue_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_links_from      ON issue_links(from_issue_id);
    CREATE INDEX IF NOT EXISTS idx_links_to        ON issue_links(to_issue_id);

    INSERT OR IGNORE INTO counters (key, value) VALUES ('issue_seq', 0);
  `);
}

// ── Idempotente migratie voor oude DBs ──
function migrate(db: Database.Database) {
  const cols = (table: string) =>
    (db.prepare(`PRAGMA table_info(${table})`).all() as any[]).map(c => c.name);

  const addColumn = (table: string, name: string, ddl: string) => {
    if (!cols(table).includes(name)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
    }
  };

  // Users — github_id voor OAuth
  addColumn('users', 'github_id', 'INTEGER');

  // Issues — nieuwe kolommen.
  // Let op: SQLite staat geen REFERENCES toe in ALTER TABLE ADD COLUMN als foreign_keys=ON.
  // De rebuild hieronder zet de FKs alsnog netjes als de oude tabel een CHECK had.
  addColumn('issues', 'team_id', 'TEXT');
  addColumn('issues', 'assignee', "TEXT DEFAULT ''");
  addColumn('issues', 'parent_issue_id', 'TEXT');
  addColumn('issues', 'estimate', 'INTEGER');
  addColumn('issues', 'due_date', 'TEXT');
  addColumn('issues', 'cycle_id', 'TEXT');
  addColumn('issues', 'github_pr_number', 'INTEGER');
  addColumn('issues', 'started_at', 'TEXT');

  // Projects
  addColumn('projects', 'team_id', 'TEXT');

  // Issues had ooit een CHECK(status IN (...)) constraint die de nieuwe states (todo/in_review/triage) zou blokkeren.
  // SQLite kan een CHECK niet droppen zonder tabel-rebuild. Doe dat alleen als nodig.
  const tblSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='issues'").get() as any)?.sql || '';
  if (tblSql.includes("CHECK(status IN")) {
    rebuildIssuesWithoutCheck(db);
  }
}

function rebuildIssuesWithoutCheck(db: Database.Database) {
  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE issues_new (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL UNIQUE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT DEFAULT 'backlog',
        priority TEXT DEFAULT 'none',
        labels TEXT DEFAULT '[]',
        acceptance_criteria TEXT DEFAULT '',
        assignee TEXT DEFAULT '',
        parent_issue_id TEXT REFERENCES issues(id) ON DELETE SET NULL,
        estimate INTEGER,
        due_date TEXT,
        cycle_id TEXT REFERENCES cycles(id) ON DELETE SET NULL,
        github_branch TEXT DEFAULT '',
        github_pr_url TEXT DEFAULT '',
        github_pr_number INTEGER,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        started_at TEXT,
        completed_at TEXT
      );
      INSERT INTO issues_new SELECT
        id, identifier, project_id, team_id, title, description, status, priority, labels,
        acceptance_criteria, assignee, parent_issue_id, estimate, due_date, cycle_id,
        github_branch, github_pr_url, github_pr_number, sort_order,
        created_at, updated_at, started_at, completed_at
      FROM issues;
      DROP TABLE issues;
      ALTER TABLE issues_new RENAME TO issues;
      CREATE INDEX IF NOT EXISTS idx_issues_status   ON issues(status);
      CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
      CREATE INDEX IF NOT EXISTS idx_issues_assignee ON issues(assignee);
      CREATE INDEX IF NOT EXISTS idx_issues_project  ON issues(project_id);
      CREATE INDEX IF NOT EXISTS idx_issues_cycle    ON issues(cycle_id);
      CREATE INDEX IF NOT EXISTS idx_issues_parent   ON issues(parent_issue_id);
    `);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function seedDefaults(db: Database.Database) {
  const haveTeam = (db.prepare("SELECT COUNT(*) as c FROM teams").get() as any).c > 0;
  if (!haveTeam) {
    const id = uuidv4();
    db.prepare(`INSERT INTO teams (id, key, name, description) VALUES (?, 'UP', 'Upscailed', 'Default team')`).run(id);
  }
  const haveView = (db.prepare("SELECT COUNT(*) as c FROM views").get() as any).c > 0;
  if (!haveView) {
    const defaults = [
      { name: 'My active',             icon: 'status_in_progress', filter: { status: ['in_progress','in_review'] }, sort_order: 1 },
      { name: 'Agent queue',           icon: 'agent',              filter: { assignee: 'agent', status: ['todo','in_progress'] }, sort_order: 2 },
      { name: 'High priority backlog', icon: 'priority_high',      filter: { status: ['backlog','todo'], priority: ['urgent','high'] }, sort_order: 3 },
      { name: 'Triage',                icon: 'status_triage',      filter: { status: ['triage'] }, sort_order: 4 },
      { name: 'Recent done',           icon: 'status_done',        filter: { status: ['done'] }, sort_order: 5 },
    ];
    const stmt = db.prepare(`INSERT INTO views (id, name, icon, filter, sort_order) VALUES (?, ?, ?, ?, ?)`);
    for (const v of defaults) stmt.run(uuidv4(), v.name, v.icon, JSON.stringify(v.filter), v.sort_order);
  }
}

function nextIdentifier(db: Database.Database, teamKey = 'UP'): string {
  // Per-workspace counter. Key: 'issue_seq:UP', 'issue_seq:FIF', etc.
  const counterKey = `issue_seq:${teamKey}`;
  db.prepare(`INSERT OR IGNORE INTO counters (key, value) VALUES (?, 0)`).run(counterKey);
  const row = db.prepare(`UPDATE counters SET value = value + 1 WHERE key = ? RETURNING value`).get(counterKey) as { value: number };
  return `${teamKey}-${row.value}`;
}

// ── Activity log helper ──
function logActivity(
  db: Database.Database,
  type: ActivityType,
  payload: Record<string, any>,
  opts: { issue_id?: string | null; project_id?: string | null; actor?: string } = {}
) {
  db.prepare(`
    INSERT INTO activity (id, issue_id, project_id, actor, type, payload)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    opts.issue_id ?? null,
    opts.project_id ?? null,
    opts.actor ?? 'system',
    type,
    JSON.stringify(payload),
  );
}

// ── Users ──

export function listUsers(): import('./types').SafeUser[] {
  return getDb().prepare(`SELECT id, email, name, avatar_url, role FROM users ORDER BY created_at ASC`).all() as any;
}

export function getUserById(id: string): import('./types').User | undefined {
  return getDb().prepare(`SELECT * FROM users WHERE id = ?`).get(id) as any;
}

export function getUserByEmail(email: string): import('./types').User | undefined {
  return getDb().prepare(`SELECT * FROM users WHERE LOWER(email) = LOWER(?)`).get(email) as any;
}

export function createUser(input: { email: string; name: string; password_hash: string; avatar_url?: string }): import('./types').SafeUser {
  const db = getDb();
  const id = uuidv4();
  const userCount = (db.prepare(`SELECT COUNT(*) as c FROM users`).get() as any).c;
  const role = userCount === 0 ? 'admin' : 'member';  // eerste user = admin
  db.prepare(`INSERT INTO users (id, email, name, password_hash, avatar_url, role) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, input.email, input.name, input.password_hash, input.avatar_url || '', role);

  // Eerste user wordt admin van default workspace; volgende users worden member van default
  const defaultWs = getDefaultTeam();
  db.prepare(`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)`)
    .run(defaultWs.id, id, role === 'admin' ? 'admin' : 'member');

  return db.prepare(`SELECT id, email, name, avatar_url, role FROM users WHERE id = ?`).get(id) as any;
}

export function userCount(): number {
  return (getDb().prepare(`SELECT COUNT(*) as c FROM users`).get() as any).c;
}

export function getUserByGithubId(githubId: number): import('./types').User | undefined {
  return getDb().prepare(`SELECT * FROM users WHERE github_id = ?`).get(githubId) as any;
}

export function linkGithubId(userId: string, githubId: number, avatarUrl?: string) {
  getDb().prepare(`UPDATE users SET github_id = ?, avatar_url = COALESCE(NULLIF(?, ''), avatar_url) WHERE id = ?`)
    .run(githubId, avatarUrl || '', userId);
}

/** Vind of maak user via GitHub OAuth profile. */
export function findOrCreateGithubUser(input: { github_id: number; email: string; name: string; avatar_url?: string }): import('./types').SafeUser {
  const db = getDb();
  // 1. Bestaat al via github_id
  const byGh = getUserByGithubId(input.github_id);
  if (byGh) return { id: byGh.id, email: byGh.email, name: byGh.name, avatar_url: byGh.avatar_url, role: byGh.role };

  // 2. Bestaat via email → koppel github_id
  const byEmail = getUserByEmail(input.email);
  if (byEmail) {
    linkGithubId(byEmail.id, input.github_id, input.avatar_url);
    return { id: byEmail.id, email: byEmail.email, name: byEmail.name, avatar_url: input.avatar_url || byEmail.avatar_url, role: byEmail.role };
  }

  // 3. Nieuwe user — random password_hash (OAuth-only, geen password-login mogelijk)
  const id = uuidv4();
  const userCnt = (db.prepare(`SELECT COUNT(*) as c FROM users`).get() as any).c;
  const role = userCnt === 0 ? 'admin' : 'member';
  // password is leeg → password-login geblokkeerd door verifyPassword (geen geldig scrypt-formaat)
  db.prepare(`INSERT INTO users (id, email, name, password_hash, avatar_url, github_id, role) VALUES (?, ?, ?, '', ?, ?, ?)`)
    .run(id, input.email, input.name, input.avatar_url || '', input.github_id, role);
  // Auto-add aan default workspace
  const defaultWs = getDefaultTeam();
  db.prepare(`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)`)
    .run(defaultWs.id, id, role === 'admin' ? 'admin' : 'member');
  return db.prepare(`SELECT id, email, name, avatar_url, role FROM users WHERE id = ?`).get(id) as any;
}

// ── Teams / Workspaces ──

export function listTeams(): Team[] {
  return getDb().prepare('SELECT * FROM teams ORDER BY created_at ASC').all() as Team[];
}

export function getTeam(id: string): Team | undefined {
  return getDb().prepare('SELECT * FROM teams WHERE id = ? OR key = ?').get(id, id) as Team | undefined;
}

export function getDefaultTeam(): Team {
  const t = getDb().prepare('SELECT * FROM teams ORDER BY created_at ASC LIMIT 1').get() as Team | undefined;
  if (!t) throw new Error('No team configured');
  return t;
}

/** Workspaces waar deze user lid van is. */
export function listWorkspacesForUser(userId: string): import('./types').WorkspaceWithRole[] {
  return getDb().prepare(`
    SELECT t.*, m.role
    FROM teams t
    INNER JOIN workspace_members m ON m.workspace_id = t.id
    WHERE m.user_id = ?
    ORDER BY t.created_at ASC
  `).all(userId) as any;
}

/** Maak een workspace + maak de creator admin. Reserveert eigen counter. */
export function createWorkspace(input: { key: string; name: string; description?: string; creator_user_id: string }): Team {
  const db = getDb();
  const id = uuidv4();
  const key = input.key.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'WS';
  // unique-key check
  const existing = db.prepare(`SELECT 1 FROM teams WHERE key = ?`).get(key);
  if (existing) throw new Error(`Workspace key "${key}" bestaat al`);

  db.prepare(`INSERT INTO teams (id, key, name, description) VALUES (?, ?, ?, ?)`)
    .run(id, key, input.name, input.description || '');
  db.prepare(`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'admin')`)
    .run(id, input.creator_user_id);
  // initialiseer counter
  db.prepare(`INSERT OR IGNORE INTO counters (key, value) VALUES (?, 0)`).run(`issue_seq:${key}`);
  return getTeam(id)!;
}

export function addUserToWorkspace(workspaceId: string, userId: string, role: 'admin' | 'member' = 'member') {
  getDb().prepare(`INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)`)
    .run(workspaceId, userId, role);
}

export function isWorkspaceMember(workspaceId: string, userId: string): boolean {
  return !!getDb().prepare(`SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?`).get(workspaceId, userId);
}

export function listWorkspaceMembers(workspaceId: string) {
  return getDb().prepare(`
    SELECT u.id, u.email, u.name, u.avatar_url, m.role, m.joined_at
    FROM workspace_members m
    INNER JOIN users u ON u.id = m.user_id
    WHERE m.workspace_id = ?
    ORDER BY m.joined_at ASC
  `).all(workspaceId);
}

// ── Projects ──

export function listProjects(): Project[] {
  return getDb().prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as Project[];
}

export function getProject(id: string): Project | undefined {
  return getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
}

export function createProject(input: CreateProjectInput): Project {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const teamId = input.team_id ?? getDefaultTeam().id;
  db.prepare(`
    INSERT INTO projects (id, name, description, color, team_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.name, input.description || '', input.color || '#8B5CF6', teamId, now, now);
  logActivity(db, 'issue_created', { kind: 'project', name: input.name }, { project_id: id, actor: 'user' });
  return getProject(id)!;
}

export function updateProject(id: string, input: UpdateProjectInput): Project | undefined {
  const db = getDb();
  const existing = getProject(id);
  if (!existing) return undefined;
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE projects SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      color = COALESCE(?, color),
      team_id = COALESCE(?, team_id),
      updated_at = ?
    WHERE id = ?
  `).run(input.name ?? null, input.description ?? null, input.color ?? null, input.team_id ?? null, now, id);
  return getProject(id);
}

export function deleteProject(id: string): boolean {
  const result = getDb().prepare('DELETE FROM projects WHERE id = ?').run(id);
  return result.changes > 0;
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

export function listIssues(filters?: IssueFilters): Issue[] {
  const db = getDb();
  let sql = 'SELECT * FROM issues WHERE 1=1';
  const params: any[] = [];

  if (filters?.project_id) { sql += ' AND project_id = ?'; params.push(filters.project_id); }
  if (filters?.team_id) { sql += ' AND team_id = ?'; params.push(filters.team_id); }

  if (filters?.status) {
    const arr = Array.isArray(filters.status) ? filters.status : [filters.status];
    sql += ` AND status IN (${arr.map(() => '?').join(',')})`;
    params.push(...arr);
  }
  if (filters?.priority) {
    const arr = Array.isArray(filters.priority) ? filters.priority : [filters.priority];
    sql += ` AND priority IN (${arr.map(() => '?').join(',')})`;
    params.push(...arr);
  }
  if (filters?.assignee !== undefined) { sql += ' AND assignee = ?'; params.push(filters.assignee); }
  if (filters?.cycle_id !== undefined) {
    if (filters.cycle_id === null || filters.cycle_id === 'null') { sql += ' AND cycle_id IS NULL'; }
    else { sql += ' AND cycle_id = ?'; params.push(filters.cycle_id); }
  }
  if (filters?.parent_issue_id !== undefined) {
    if (filters.parent_issue_id === null) { sql += ' AND parent_issue_id IS NULL'; }
    else { sql += ' AND parent_issue_id = ?'; params.push(filters.parent_issue_id); }
  }
  if (filters?.search) {
    sql += ' AND (title LIKE ? OR description LIKE ? OR identifier LIKE ?)';
    params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }

  sql += ' ORDER BY sort_order ASC, created_at DESC';
  return db.prepare(sql).all(...params) as Issue[];
}

export function getIssue(id: string): Issue | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM issues WHERE id = ? OR identifier = ?').get(id, id) as Issue | undefined;
}

export function createIssue(input: CreateIssueInput): Issue {
  const db = getDb();
  const id = uuidv4();
  const project = getProject(input.project_id);
  const teamId = input.team_id ?? project?.team_id ?? getDefaultTeam().id;
  const team = teamId ? getTeam(teamId) : getDefaultTeam();
  const identifier = nextIdentifier(db, team?.key || 'UP');
  const now = new Date().toISOString();
  const labels = JSON.stringify(input.labels || []);

  db.prepare(`
    INSERT INTO issues (id, identifier, project_id, team_id, title, description, status, priority,
                        labels, acceptance_criteria, assignee, parent_issue_id, estimate, due_date,
                        cycle_id, github_branch, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, identifier, input.project_id, teamId, input.title,
    input.description || '', input.status || 'backlog',
    input.priority || 'none', labels,
    input.acceptance_criteria || '', input.assignee || '',
    input.parent_issue_id || null,
    input.estimate ?? null,
    input.due_date ?? null,
    input.cycle_id ?? null,
    input.github_branch || '',
    0, now, now
  );
  logActivity(db, 'issue_created', { identifier, title: input.title, status: input.status || 'backlog' },
    { issue_id: id, project_id: input.project_id, actor: input.assignee || 'user' });
  return getIssue(id)!;
}

export function updateIssue(id: string, input: UpdateIssueInput, actor = 'user'): Issue | undefined {
  const db = getDb();
  const existing = getIssue(id);
  if (!existing) return undefined;

  const now = new Date().toISOString();
  const labels = input.labels ? JSON.stringify(input.labels) : null;

  // Bereken started_at en completed_at automatisch
  let startedAt: string | null | undefined = undefined;
  let completedAt: string | null | undefined = undefined;
  if (input.status) {
    if (input.status === 'in_progress' && existing.status !== 'in_progress' && !existing.started_at) {
      startedAt = now;
    }
    if (input.status === 'done' && existing.status !== 'done') {
      completedAt = now;
    } else if (input.status && input.status !== 'done' && existing.status === 'done') {
      completedAt = null;
    }
  }

  db.prepare(`
    UPDATE issues SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      status = COALESCE(?, status),
      priority = COALESCE(?, priority),
      labels = COALESCE(?, labels),
      acceptance_criteria = COALESCE(?, acceptance_criteria),
      assignee = COALESCE(?, assignee),
      parent_issue_id = CASE WHEN ? = '__unset__' THEN NULL WHEN ? IS NOT NULL THEN ? ELSE parent_issue_id END,
      estimate = CASE WHEN ? = '__unset__' THEN NULL WHEN ? IS NOT NULL THEN ? ELSE estimate END,
      due_date = CASE WHEN ? = '__unset__' THEN NULL WHEN ? IS NOT NULL THEN ? ELSE due_date END,
      cycle_id = CASE WHEN ? = '__unset__' THEN NULL WHEN ? IS NOT NULL THEN ? ELSE cycle_id END,
      github_branch = COALESCE(?, github_branch),
      github_pr_url = COALESCE(?, github_pr_url),
      github_pr_number = COALESCE(?, github_pr_number),
      project_id = COALESCE(?, project_id),
      team_id = COALESCE(?, team_id),
      sort_order = COALESCE(?, sort_order),
      updated_at = ?,
      started_at = CASE WHEN ? IS NOT NULL THEN ? ELSE started_at END,
      completed_at = CASE WHEN ? IS NOT NULL THEN ? WHEN ? = '__clear__' THEN NULL ELSE completed_at END
    WHERE id = ? OR identifier = ?
  `).run(
    input.title ?? null, input.description ?? null,
    input.status ?? null, input.priority ?? null,
    labels, input.acceptance_criteria ?? null,
    input.assignee ?? null,
    input.parent_issue_id === null ? '__unset__' : null, input.parent_issue_id ?? null, input.parent_issue_id ?? null,
    input.estimate === null ? '__unset__' : null, input.estimate ?? null, input.estimate ?? null,
    input.due_date === null ? '__unset__' : null, input.due_date ?? null, input.due_date ?? null,
    input.cycle_id === null ? '__unset__' : null, input.cycle_id ?? null, input.cycle_id ?? null,
    input.github_branch ?? null, input.github_pr_url ?? null, input.github_pr_number ?? null,
    input.project_id ?? null, input.team_id ?? null, input.sort_order ?? null,
    now,
    startedAt ?? null, startedAt ?? null,
    completedAt ?? null, completedAt ?? null, completedAt === null ? '__clear__' : null,
    id, id
  );

  const updated = getIssue(id);

  // Activity events
  if (updated && input.status && input.status !== existing.status) {
    logActivity(db, 'status_changed', { from: existing.status, to: input.status, identifier: existing.identifier },
      { issue_id: updated.id, project_id: updated.project_id, actor });
  }
  if (updated && input.priority && input.priority !== existing.priority) {
    logActivity(db, 'priority_changed', { from: existing.priority, to: input.priority, identifier: existing.identifier },
      { issue_id: updated.id, project_id: updated.project_id, actor });
  }
  if (updated && input.assignee !== undefined && input.assignee !== existing.assignee) {
    logActivity(db, 'assignee_changed', { from: existing.assignee, to: input.assignee, identifier: existing.identifier },
      { issue_id: updated.id, project_id: updated.project_id, actor });
  }
  if (updated && input.github_branch && input.github_branch !== existing.github_branch) {
    logActivity(db, 'branch_linked', { branch: input.github_branch, identifier: existing.identifier },
      { issue_id: updated.id, project_id: updated.project_id, actor });
  }
  if (updated && input.github_pr_url && input.github_pr_url !== existing.github_pr_url) {
    logActivity(db, 'pr_linked', { url: input.github_pr_url, identifier: existing.identifier },
      { issue_id: updated.id, project_id: updated.project_id, actor });
  }

  return updated;
}

export function deleteIssue(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM issues WHERE id = ? OR identifier = ?').run(id, id);
  return result.changes > 0;
}

// ── Agent helpers ──

/** Volgende taak voor een assignee — hoogste prio in todo/backlog die niet geblokkeerd is. */
export function getNextIssue(opts: { assignee?: string; project_id?: string; team_id?: string } = {}): Issue | null {
  const db = getDb();
  // priority weight + status weight
  let sql = `
    SELECT i.* FROM issues i
    LEFT JOIN issue_links l ON l.from_issue_id = i.id AND l.link_type = 'blocked_by'
    LEFT JOIN issues blocker ON blocker.id = l.to_issue_id AND blocker.status NOT IN ('done','cancelled')
    WHERE i.status IN ('todo','backlog','triage')
      AND blocker.id IS NULL
  `;
  const params: any[] = [];
  if (opts.assignee) { sql += " AND (i.assignee = ? OR i.assignee = '')"; params.push(opts.assignee); }
  if (opts.project_id) { sql += ' AND i.project_id = ?'; params.push(opts.project_id); }
  if (opts.team_id) { sql += ' AND i.team_id = ?'; params.push(opts.team_id); }
  sql += `
    ORDER BY
      CASE i.priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END DESC,
      CASE i.status WHEN 'todo' THEN 3 WHEN 'backlog' THEN 2 WHEN 'triage' THEN 1 ELSE 0 END DESC,
      i.sort_order ASC,
      i.created_at ASC
    LIMIT 1
  `;
  const row = db.prepare(sql).get(...params) as Issue | undefined;
  return row || null;
}

/** Atomische claim — assigneert + zet status op in_progress + log. */
export function claimIssue(id: string, input: ClaimIssueInput): Issue | undefined {
  const db = getDb();
  const issue = getIssue(id);
  if (!issue) return undefined;
  if (issue.status === 'done' || issue.status === 'cancelled') {
    throw new Error(`Issue ${issue.identifier} is al ${issue.status}`);
  }
  const updated = updateIssue(issue.id, { assignee: input.assignee, status: 'in_progress' }, input.assignee);
  if (input.comment) {
    createComment({ issue_id: issue.id, author: input.assignee, body: input.comment });
  } else {
    createComment({
      issue_id: issue.id, author: input.assignee,
      body: `🤖 ${input.assignee} heeft deze issue opgepakt en start met de implementatie.`
    });
  }
  return updated;
}

/** Branch-naam suggestie zoals Linear: iwan/up-42-titel-slug */
export function generateBranchName(id: string, prefix?: string): string | null {
  const issue = getIssue(id);
  if (!issue) return null;
  const owner = (prefix || issue.assignee || 'agent')
    .toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'agent';
  const slug = issue.title.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  return `${owner}/${issue.identifier.toLowerCase()}-${slug}`;
}

/** Vind UP-XX identifiers in een string (branch-naam, PR-titel, body). */
export function parseIdentifiers(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/\b([A-Z]{2,5})-(\d+)\b/g);
  return matches ? Array.from(new Set(matches)) : [];
}

/** Magic words → identifiers die "closed" moeten worden bij PR merge. */
export function parseClosingIdentifiers(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const re = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+([A-Z]{2,5}-\d+)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1].toUpperCase());
  return Array.from(new Set(out));
}

// ── Comments ──

export function listComments(issueId: string): Comment[] {
  const db = getDb();
  const issue = getIssue(issueId);
  if (!issue) return [];
  return db.prepare('SELECT * FROM comments WHERE issue_id = ? ORDER BY created_at ASC').all(issue.id) as Comment[];
}

export function createComment(input: CreateCommentInput): Comment {
  const db = getDb();
  const issue = getIssue(input.issue_id);
  if (!issue) throw new Error('Issue not found');
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO comments (id, issue_id, author, body, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, issue.id, input.author || 'user', input.body, now);
  logActivity(db, 'comment_added', { author: input.author || 'user', identifier: issue.identifier, preview: input.body.slice(0, 80) },
    { issue_id: issue.id, project_id: issue.project_id, actor: input.author || 'user' });
  return db.prepare('SELECT * FROM comments WHERE id = ?').get(id) as Comment;
}

// ── Cycles ──

export function listCycles(teamId?: string): Cycle[] {
  const db = getDb();
  const now = new Date().toISOString();
  // status auto-update
  db.prepare(`UPDATE cycles SET status = 'active' WHERE starts_at <= ? AND ends_at >= ? AND status != 'active'`).run(now, now);
  db.prepare(`UPDATE cycles SET status = 'completed' WHERE ends_at < ? AND status != 'completed'`).run(now);
  db.prepare(`UPDATE cycles SET status = 'upcoming' WHERE starts_at > ? AND status != 'upcoming'`).run(now);

  let sql = 'SELECT * FROM cycles';
  const params: any[] = [];
  if (teamId) { sql += ' WHERE team_id = ?'; params.push(teamId); }
  sql += ' ORDER BY starts_at DESC';
  return db.prepare(sql).all(...params) as Cycle[];
}

export function getCycle(id: string): Cycle | undefined {
  return getDb().prepare('SELECT * FROM cycles WHERE id = ?').get(id) as Cycle | undefined;
}

export function createCycle(input: CreateCycleInput): Cycle {
  const db = getDb();
  const id = uuidv4();
  const teamId = input.team_id ?? getDefaultTeam().id;
  db.prepare(`
    INSERT INTO cycles (id, team_id, name, description, starts_at, ends_at, status)
    VALUES (?, ?, ?, ?, ?, ?, 'upcoming')
  `).run(id, teamId, input.name, input.description || '', input.starts_at, input.ends_at);
  return getCycle(id)!;
}

export function deleteCycle(id: string): boolean {
  return getDb().prepare('DELETE FROM cycles WHERE id = ?').run(id).changes > 0;
}

// ── Issue links ──

export function listLinks(issueId: string): IssueLink[] {
  const db = getDb();
  const issue = getIssue(issueId);
  if (!issue) return [];
  return db.prepare(`
    SELECT * FROM issue_links WHERE from_issue_id = ? OR to_issue_id = ? ORDER BY created_at ASC
  `).all(issue.id, issue.id) as IssueLink[];
}

export function createLink(input: CreateLinkInput): IssueLink {
  const db = getDb();
  const from = getIssue(input.from_issue_id);
  const to = getIssue(input.to_issue_id);
  if (!from || !to) throw new Error('Issue niet gevonden');
  if (from.id === to.id) throw new Error('Issue kan niet aan zichzelf gelinkt worden');

  const id = uuidv4();
  db.prepare(`
    INSERT OR IGNORE INTO issue_links (id, from_issue_id, to_issue_id, link_type)
    VALUES (?, ?, ?, ?)
  `).run(id, from.id, to.id, input.link_type);

  // Symmetrische link (blocks ↔ blocked_by, relates_to ↔ relates_to, duplicates ↔ duplicate_of)
  const inverse: Record<LinkType, LinkType> = {
    blocks: 'blocked_by',
    blocked_by: 'blocks',
    relates_to: 'relates_to',
    duplicates: 'duplicate_of',
    duplicate_of: 'duplicates',
  };
  db.prepare(`
    INSERT OR IGNORE INTO issue_links (id, from_issue_id, to_issue_id, link_type)
    VALUES (?, ?, ?, ?)
  `).run(uuidv4(), to.id, from.id, inverse[input.link_type]);

  logActivity(db, 'linked_issue_added',
    { link_type: input.link_type, from: from.identifier, to: to.identifier },
    { issue_id: from.id, project_id: from.project_id, actor: 'user' });

  return db.prepare('SELECT * FROM issue_links WHERE from_issue_id = ? AND to_issue_id = ? AND link_type = ?')
    .get(from.id, to.id, input.link_type) as IssueLink;
}

export function deleteLink(id: string): boolean {
  return getDb().prepare('DELETE FROM issue_links WHERE id = ?').run(id).changes > 0;
}

/** Sub-issues van een parent (parent_issue_id). */
export function listSubIssues(parentId: string): Issue[] {
  const db = getDb();
  const parent = getIssue(parentId);
  if (!parent) return [];
  return db.prepare('SELECT * FROM issues WHERE parent_issue_id = ? ORDER BY sort_order ASC, created_at ASC').all(parent.id) as Issue[];
}

// ── Activity ──

export function listActivity(opts: { issue_id?: string; project_id?: string; limit?: number } = {}): Activity[] {
  const db = getDb();
  let sql = 'SELECT * FROM activity WHERE 1=1';
  const params: any[] = [];
  if (opts.issue_id) {
    const issue = getIssue(opts.issue_id);
    if (issue) { sql += ' AND issue_id = ?'; params.push(issue.id); }
    else return [];
  }
  if (opts.project_id) { sql += ' AND project_id = ?'; params.push(opts.project_id); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(opts.limit ?? 100);
  return db.prepare(sql).all(...params) as Activity[];
}

export function logActivityPublic(type: ActivityType, payload: Record<string, any>, opts: { issue_id?: string; project_id?: string; actor?: string } = {}) {
  logActivity(getDb(), type, payload, opts);
}

// ── Views ──

export function listViews(): View[] {
  return getDb().prepare('SELECT * FROM views ORDER BY sort_order ASC, created_at ASC').all() as View[];
}

export function getView(id: string): View | undefined {
  return getDb().prepare('SELECT * FROM views WHERE id = ?').get(id) as View | undefined;
}

export function createView(input: { name: string; description?: string; filter: any; icon?: string; sort_order?: number }): View {
  const db = getDb();
  const id = uuidv4();
  db.prepare(`INSERT INTO views (id, name, description, filter, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, input.name, input.description || '', JSON.stringify(input.filter || {}), input.icon || '⊟', input.sort_order ?? 99);
  return getView(id)!;
}

export function deleteView(id: string): boolean {
  return getDb().prepare('DELETE FROM views WHERE id = ?').run(id).changes > 0;
}

// ── GitHub state machine ──

/** Pas statussen aan op basis van PR events. Wordt aangeroepen door webhook + polling. */
export function applyGithubPrEvent(event: {
  action: 'opened' | 'reopened' | 'review_requested' | 'closed' | 'merged' | 'synchronize';
  pr_url: string;
  pr_number: number;
  branch: string;
  title: string;
  body: string;
  merged?: boolean;
}) {
  const db = getDb();
  // 1. vind alle gelinkte issues (via branch, title, body)
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
    const issue = getIssue(ident);
    if (!issue) continue;

    let newStatus: IssueStatus | undefined;
    if (event.action === 'opened' || event.action === 'reopened') newStatus = 'in_progress';
    else if (event.action === 'review_requested') newStatus = 'in_review';
    else if (event.action === 'closed' && event.merged) newStatus = closing.has(ident) ? 'done' : 'done';
    else if (event.action === 'closed' && !event.merged) newStatus = 'todo'; // PR dicht, niet gemerged

    // Magic words: closing identifiers gaan altijd naar done bij merge
    if (event.action === 'closed' && event.merged && closing.has(ident)) newStatus = 'done';

    // Auto-link branch & PR
    const patch: UpdateIssueInput = {
      github_branch: event.branch || issue.github_branch,
      github_pr_url: event.pr_url,
      github_pr_number: event.pr_number,
    };
    if (newStatus) patch.status = newStatus;

    updateIssue(issue.id, patch, 'github');
    logActivity(db,
      event.action === 'opened' ? 'pr_opened' :
      event.action === 'review_requested' ? 'pr_review_requested' :
      event.action === 'closed' && event.merged ? 'pr_merged' :
      event.action === 'closed' ? 'pr_closed' : 'pr_linked',
      { pr_url: event.pr_url, pr_number: event.pr_number, branch: event.branch, title: event.title, identifier: ident },
      { issue_id: issue.id, project_id: issue.project_id, actor: 'github' });
    touched.push({ identifier: ident, new_status: newStatus });
  }

  return { touched: Array.from(touched) };
}

// ── Stats ──

export function getStats() {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as c FROM issues').get() as any).c;
  const byStatus = db.prepare("SELECT status, COUNT(*) as count FROM issues GROUP BY status").all();
  const byPriority = db.prepare("SELECT priority, COUNT(*) as count FROM issues GROUP BY priority").all();
  const byAssignee = db.prepare("SELECT assignee, COUNT(*) as count FROM issues WHERE assignee != '' GROUP BY assignee").all();
  const projectCount = (db.prepare('SELECT COUNT(*) as c FROM projects').get() as any).c;
  const activeCycles = db.prepare("SELECT COUNT(*) as c FROM cycles WHERE status = 'active'").get() as any;
  return { total, projectCount, byStatus, byPriority, byAssignee, activeCycles: activeCycles.c };
}
