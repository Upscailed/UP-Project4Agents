// ── UP/Project4Agents — Core Types ──

export type IssueStatus = 'backlog' | 'planned' | 'in_progress' | 'done' | 'cancelled';
export type IssuePriority = 'none' | 'low' | 'medium' | 'high' | 'urgent';

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Issue {
  id: string;
  identifier: string;        // e.g. "UP-42"
  project_id: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  labels: string;             // JSON array of label strings
  acceptance_criteria: string; // markdown
  github_branch: string;
  github_pr_url: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Comment {
  id: string;
  issue_id: string;
  author: string;             // "user" | "agent" | agent name
  body: string;
  created_at: string;
}

// ── API Request/Response shapes ──

export interface CreateProjectInput {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  color?: string;
}

export interface CreateIssueInput {
  project_id: string;
  title: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  labels?: string[];
  acceptance_criteria?: string;
  github_branch?: string;
}

export interface UpdateIssueInput {
  title?: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  labels?: string[];
  acceptance_criteria?: string;
  github_branch?: string;
  github_pr_url?: string;
  project_id?: string;
  sort_order?: number;
}

export interface CreateCommentInput {
  issue_id: string;
  author?: string;
  body: string;
}

// ── Board View ──

export interface BoardColumn {
  status: IssueStatus;
  label: string;
  issues: Issue[];
}

export const STATUS_COLUMNS: { status: IssueStatus; label: string; color: string }[] = [
  { status: 'backlog',     label: 'Backlog',     color: '#6B7280' },
  { status: 'planned',     label: 'Planned',     color: '#8B5CF6' },
  { status: 'in_progress', label: 'In Progress', color: '#F59E0B' },
  { status: 'done',        label: 'Done',        color: '#10B981' },
  { status: 'cancelled',   label: 'Cancelled',   color: '#EF4444' },
];

export const PRIORITY_CONFIG: Record<IssuePriority, { label: string; icon: string; color: string }> = {
  none:   { label: 'No priority', icon: '—',  color: '#6B7280' },
  low:    { label: 'Low',         icon: '↓',  color: '#60A5FA' },
  medium: { label: 'Medium',      icon: '→',  color: '#FBBF24' },
  high:   { label: 'High',        icon: '↑',  color: '#FB923C' },
  urgent: { label: 'Urgent',      icon: '⚡', color: '#EF4444' },
};
