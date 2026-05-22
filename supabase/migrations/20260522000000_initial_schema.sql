-- ─────────────────────────────────────────────────────────────────────────
-- UP-Project4Agents — initial Postgres schema
-- Conversie van SQLite (better-sqlite3) → Postgres (Supabase).
-- ─────────────────────────────────────────────────────────────────────────

-- Users + auth
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  github_id BIGINT UNIQUE,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams / workspaces
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ws_members_user ON workspace_members(user_id);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#8B5CF6',
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cycles (sprints) — moet vóór issues omdat issues ernaar refereren
CREATE TABLE IF NOT EXISTS cycles (
  id TEXT PRIMARY KEY,
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT DEFAULT 'upcoming',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Issues — self-reference via parent_issue_id
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_issues_status   ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
CREATE INDEX IF NOT EXISTS idx_issues_assignee ON issues(assignee);
CREATE INDEX IF NOT EXISTS idx_issues_project  ON issues(project_id);
CREATE INDEX IF NOT EXISTS idx_issues_cycle    ON issues(cycle_id);
CREATE INDEX IF NOT EXISTS idx_issues_parent   ON issues(parent_issue_id);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author TEXT DEFAULT 'user',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Issue links
CREATE TABLE IF NOT EXISTS issue_links (
  id TEXT PRIMARY KEY,
  from_issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  to_issue_id   TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_issue_id, to_issue_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_links_from ON issue_links(from_issue_id);
CREATE INDEX IF NOT EXISTS idx_links_to   ON issue_links(to_issue_id);

-- Activity log
CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  issue_id TEXT REFERENCES issues(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  actor TEXT DEFAULT 'system',
  type TEXT NOT NULL,
  payload TEXT DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_issue ON activity(issue_id, created_at);

-- Saved views (filters)
CREATE TABLE IF NOT EXISTS views (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  filter TEXT NOT NULL DEFAULT '{}',
  icon TEXT DEFAULT 'views',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Counters (per-workspace issue sequence)
CREATE TABLE IF NOT EXISTS counters (
  key TEXT PRIMARY KEY,
  value INTEGER DEFAULT 0
);

-- Per-user API tokens (voor MCP / CLI / cron toegang)
CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,           -- eerste paar tekens, voor visuele herkenning
  name TEXT DEFAULT 'default',    -- label van de user (bv. 'Claude Desktop')
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash);

-- ─────────────────────────────────────────────────────────────────────────
-- Seed: default workspace + standaard views
-- (alleen als nog niks bestaat — idempotent)
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO teams (id, key, name, description)
SELECT gen_random_uuid()::text, 'UP', 'Upscailed', 'Default workspace'
WHERE NOT EXISTS (SELECT 1 FROM teams);

INSERT INTO views (id, name, icon, filter, sort_order)
SELECT gen_random_uuid()::text, name, icon, filter, sort_order
FROM (VALUES
  ('My active',             'status_in_progress', '{"status":["in_progress","in_review"]}', 1),
  ('Agent queue',           'agent',              '{"assignee":"agent","status":["todo","in_progress"]}', 2),
  ('High priority backlog', 'priority_high',      '{"status":["backlog","todo"],"priority":["urgent","high"]}', 3),
  ('Triage',                'status_triage',      '{"status":["triage"]}', 4),
  ('Recent done',           'status_done',        '{"status":["done"]}', 5)
) AS v(name, icon, filter, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM views);
