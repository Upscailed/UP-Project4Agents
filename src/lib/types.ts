// ── UP/Project4Agents — Core Types ──

export type IssueStatus =
  | 'triage'        // nieuwe issues die nog gerouteerd moeten worden
  | 'backlog'       // toekomstig werk, niet gepland
  | 'todo'          // gepland, klaar om opgepakt te worden
  | 'in_progress'   // er wordt aan gewerkt
  | 'in_review'     // PR open / wacht op review
  | 'done'          // afgerond
  | 'cancelled';    // niet meer relevant

export type IssuePriority = 'none' | 'low' | 'medium' | 'high' | 'urgent';

export type LinkType = 'blocks' | 'blocked_by' | 'relates_to' | 'duplicates' | 'duplicate_of';

export type ActivityType =
  | 'issue_created'
  | 'status_changed'
  | 'priority_changed'
  | 'assignee_changed'
  | 'cycle_changed'
  | 'comment_added'
  | 'branch_linked'
  | 'pr_linked'
  | 'pr_opened'
  | 'pr_review_requested'
  | 'pr_merged'
  | 'pr_closed'
  | 'linked_issue_added'
  | 'parent_changed'
  | 'repo_mismatch';   // GitHub event genegeerd omdat source-repo niet matcht met project.github_repo

export type Plan = 'free' | 'plus' | 'pro';

export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  avatar_url: string;
  role: 'admin' | 'member';
  plan: Plan;
  plan_until: string | null;  // null = lifelong
  created_at: string;
}

export interface SafeUser {
  id: string; email: string; name: string;
  avatar_url: string; role: 'admin' | 'member';
  plan: Plan;
  plan_until: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  team_id: string | null;
  github_repo: string;       // 'owner/repo' format, leeg = niet gekoppeld
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  key: string;            // bv. "UP" voor issue prefix
  name: string;
  description: string;
  created_at: string;
}

/** Alias voor Team — multi-workspace UI noemt het workspace. */
export type Workspace = Team;

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
}

export interface WorkspaceWithRole extends Team {
  role: 'admin' | 'member';
}

export interface Issue {
  id: string;
  identifier: string;        // e.g. "UP-42"
  project_id: string;
  team_id: string | null;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  labels: string;             // JSON array of label strings
  acceptance_criteria: string; // markdown
  assignee: string;           // 'user' | 'agent' | agent-naam | ''
  parent_issue_id: string | null;
  estimate: number | null;    // story points
  due_date: string | null;    // ISO date
  cycle_id: string | null;
  github_branch: string;
  github_pr_url: string;
  github_pr_number: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface Comment {
  id: string;
  issue_id: string;
  author: string;             // "user" | "agent" | agent name
  body: string;
  created_at: string;
}

export interface Cycle {
  id: string;
  team_id: string | null;
  name: string;
  description: string;
  starts_at: string;          // ISO date
  ends_at: string;            // ISO date
  status: 'upcoming' | 'active' | 'completed';
  created_at: string;
}

export interface IssueLink {
  id: string;
  from_issue_id: string;
  to_issue_id: string;
  link_type: LinkType;
  created_at: string;
}

export interface Activity {
  id: string;
  issue_id: string | null;
  project_id: string | null;
  actor: string;              // 'user' | 'agent' | 'github' | agent-naam
  type: ActivityType;
  payload: string;            // JSON
  created_at: string;
}

export interface ApiToken {
  id: string;
  user_id: string;
  prefix: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface View {
  id: string;
  name: string;
  description: string;
  // JSON filter, bv. { status: ['todo','in_progress'], assignee: 'agent', priority: ['high','urgent'] }
  filter: string;
  icon: string;
  sort_order: number;
  created_at: string;
}

// ── API Request/Response shapes ──

export interface CreateProjectInput {
  name: string;
  description?: string;
  color?: string;
  team_id?: string | null;
  github_repo?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  color?: string;
  team_id?: string | null;
  github_repo?: string;
}

export interface CreateIssueInput {
  project_id: string;
  team_id?: string | null;
  title: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  labels?: string[];
  acceptance_criteria?: string;
  assignee?: string;
  parent_issue_id?: string | null;
  estimate?: number | null;
  due_date?: string | null;
  cycle_id?: string | null;
  github_branch?: string;
}

export interface UpdateIssueInput {
  title?: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  labels?: string[];
  acceptance_criteria?: string;
  assignee?: string;
  parent_issue_id?: string | null;
  estimate?: number | null;
  due_date?: string | null;
  cycle_id?: string | null;
  github_branch?: string;
  github_pr_url?: string;
  github_pr_number?: number | null;
  project_id?: string;
  team_id?: string | null;
  sort_order?: number;
}

export interface CreateCommentInput {
  issue_id: string;
  author?: string;
  body: string;
}

export interface CreateCycleInput {
  name: string;
  description?: string;
  starts_at: string;
  ends_at: string;
  team_id?: string | null;
}

export interface CreateLinkInput {
  from_issue_id: string;
  to_issue_id: string;
  link_type: LinkType;
}

export interface ClaimIssueInput {
  assignee: string;           // wie claimt 'm
  comment?: string;           // optionele eerste comment
}

// ── Board View ──

export interface BoardColumn {
  status: IssueStatus;
  label: string;
  issues: Issue[];
}

export const STATUS_COLUMNS: { status: IssueStatus; label: string; color: string; icon: string }[] = [
  { status: 'triage',      label: 'Triage',      color: '#EC4899', icon: '⊙' },
  { status: 'backlog',     label: 'Backlog',     color: '#6B7280', icon: '○' },
  { status: 'todo',        label: 'Todo',        color: '#94A3B8', icon: '◔' },
  { status: 'in_progress', label: 'In Progress', color: '#F59E0B', icon: '◑' },
  { status: 'in_review',   label: 'In Review',   color: '#A78BFA', icon: '◕' },
  { status: 'done',        label: 'Done',        color: '#10B981', icon: '●' },
  { status: 'cancelled',   label: 'Cancelled',   color: '#EF4444', icon: '✕' },
];

export const PRIORITY_CONFIG: Record<IssuePriority, { label: string; icon: string; color: string; weight: number }> = {
  urgent: { label: 'Urgent',      icon: '⚡', color: '#EF4444', weight: 4 },
  high:   { label: 'High',        icon: '↑',  color: '#FB923C', weight: 3 },
  medium: { label: 'Medium',      icon: '→',  color: '#FBBF24', weight: 2 },
  low:    { label: 'Low',         icon: '↓',  color: '#60A5FA', weight: 1 },
  none:   { label: 'No priority', icon: '—',  color: '#6B7280', weight: 0 },
};
