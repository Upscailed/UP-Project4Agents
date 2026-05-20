import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type {
  Project, Issue, Comment,
  CreateProjectInput, UpdateProjectInput,
  CreateIssueInput, UpdateIssueInput,
  CreateCommentInput,
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
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      color TEXT DEFAULT '#8B5CF6',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL UNIQUE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'backlog' CHECK(status IN ('backlog','planned','in_progress','done','cancelled')),
      priority TEXT DEFAULT 'none' CHECK(priority IN ('none','low','medium','high','urgent')),
      labels TEXT DEFAULT '[]',
      acceptance_criteria TEXT DEFAULT '',
      github_branch TEXT DEFAULT '',
      github_pr_url TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      author TEXT DEFAULT 'user',
      body TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS counters (
      key TEXT PRIMARY KEY,
      value INTEGER DEFAULT 0
    );

    INSERT OR IGNORE INTO counters (key, value) VALUES ('issue_seq', 0);
  `);
}

function nextIdentifier(db: Database.Database): string {
  const stmt = db.prepare("UPDATE counters SET value = value + 1 WHERE key = 'issue_seq' RETURNING value");
  const row = stmt.get() as { value: number };
  return `UP-${row.value}`;
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
  db.prepare(`
    INSERT INTO projects (id, name, description, color, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, input.name, input.description || '', input.color || '#8B5CF6', now, now);
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
      updated_at = ?
    WHERE id = ?
  `).run(input.name ?? null, input.description ?? null, input.color ?? null, now, id);
  return getProject(id);
}

export function deleteProject(id: string): boolean {
  const result = getDb().prepare('DELETE FROM projects WHERE id = ?').run(id);
  return result.changes > 0;
}

// ── Issues ──

export function listIssues(filters?: {
  project_id?: string;
  status?: string;
  priority?: string;
  search?: string;
}): Issue[] {
  const db = getDb();
  let sql = 'SELECT * FROM issues WHERE 1=1';
  const params: any[] = [];

  if (filters?.project_id) { sql += ' AND project_id = ?'; params.push(filters.project_id); }
  if (filters?.status) { sql += ' AND status = ?'; params.push(filters.status); }
  if (filters?.priority) { sql += ' AND priority = ?'; params.push(filters.priority); }
  if (filters?.search) { sql += ' AND (title LIKE ? OR description LIKE ?)'; params.push(`%${filters.search}%`, `%${filters.search}%`); }

  sql += ' ORDER BY sort_order ASC, created_at DESC';
  return db.prepare(sql).all(...params) as Issue[];
}

export function getIssue(id: string): Issue | undefined {
  const db = getDb();
  // Support lookup by id or identifier
  return (db.prepare('SELECT * FROM issues WHERE id = ? OR identifier = ?').get(id, id)) as Issue | undefined;
}

export function createIssue(input: CreateIssueInput): Issue {
  const db = getDb();
  const id = uuidv4();
  const identifier = nextIdentifier(db);
  const now = new Date().toISOString();
  const labels = JSON.stringify(input.labels || []);

  db.prepare(`
    INSERT INTO issues (id, identifier, project_id, title, description, status, priority, labels, acceptance_criteria, github_branch, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, identifier, input.project_id, input.title,
    input.description || '', input.status || 'backlog',
    input.priority || 'none', labels,
    input.acceptance_criteria || '', input.github_branch || '',
    0, now, now
  );
  return getIssue(id)!;
}

export function updateIssue(id: string, input: UpdateIssueInput): Issue | undefined {
  const db = getDb();
  const existing = getIssue(id);
  if (!existing) return undefined;

  const now = new Date().toISOString();
  const labels = input.labels ? JSON.stringify(input.labels) : null;
  const completedAt = input.status === 'done' && existing.status !== 'done' ? now : (input.status && input.status !== 'done' ? null : undefined);

  db.prepare(`
    UPDATE issues SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      status = COALESCE(?, status),
      priority = COALESCE(?, priority),
      labels = COALESCE(?, labels),
      acceptance_criteria = COALESCE(?, acceptance_criteria),
      github_branch = COALESCE(?, github_branch),
      github_pr_url = COALESCE(?, github_pr_url),
      project_id = COALESCE(?, project_id),
      sort_order = COALESCE(?, sort_order),
      updated_at = ?,
      completed_at = CASE WHEN ? IS NOT NULL THEN ? ELSE completed_at END
    WHERE id = ? OR identifier = ?
  `).run(
    input.title ?? null, input.description ?? null,
    input.status ?? null, input.priority ?? null,
    labels, input.acceptance_criteria ?? null,
    input.github_branch ?? null, input.github_pr_url ?? null,
    input.project_id ?? null, input.sort_order ?? null,
    now, completedAt ?? null, completedAt ?? null,
    id, id
  );
  return getIssue(id);
}

export function deleteIssue(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM issues WHERE id = ? OR identifier = ?').run(id, id);
  return result.changes > 0;
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
  return db.prepare('SELECT * FROM comments WHERE id = ?').get(id) as Comment;
}

// ── Stats ──

export function getStats() {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as c FROM issues').get() as any).c;
  const byStatus = db.prepare("SELECT status, COUNT(*) as count FROM issues GROUP BY status").all();
  const byPriority = db.prepare("SELECT priority, COUNT(*) as count FROM issues GROUP BY priority").all();
  const projectCount = (db.prepare('SELECT COUNT(*) as c FROM projects').get() as any).c;
  return { total, projectCount, byStatus, byPriority };
}
