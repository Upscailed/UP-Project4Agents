'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// ── Types ──
type IssueStatus = 'triage' | 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';
type IssuePriority = 'none' | 'low' | 'medium' | 'high' | 'urgent';
type LinkType = 'blocks' | 'blocked_by' | 'relates_to' | 'duplicates' | 'duplicate_of';

interface Project { id: string; name: string; description: string; color: string; team_id: string | null; }
interface Team { id: string; key: string; name: string; }
interface Issue {
  id: string; identifier: string; project_id: string; team_id: string | null;
  title: string; description: string;
  status: IssueStatus; priority: IssuePriority; labels: string;
  acceptance_criteria: string; assignee: string;
  parent_issue_id: string | null; estimate: number | null; due_date: string | null;
  cycle_id: string | null;
  github_branch: string; github_pr_url: string; github_pr_number: number | null;
  created_at: string; updated_at: string; started_at: string | null; completed_at: string | null;
  sub_issues?: Issue[];
}
interface Comment { id: string; issue_id: string; author: string; body: string; created_at: string; }
interface Cycle { id: string; name: string; starts_at: string; ends_at: string; status: 'upcoming' | 'active' | 'completed'; }
interface IssueLinkRow {
  id: string; from_issue_id: string; to_issue_id: string;
  link_type: LinkType; from?: Issue; to?: Issue;
}
interface Activity { id: string; issue_id: string | null; project_id: string | null; actor: string; type: string; payload: any; created_at: string; }
interface View { id: string; name: string; description: string; filter: any; icon: string; sort_order: number; }

const COLUMNS: { status: IssueStatus; label: string; color: string; icon: string }[] = [
  { status: 'triage',      label: 'Triage',      color: '#EC4899', icon: '⊙' },
  { status: 'backlog',     label: 'Backlog',     color: '#6B7280', icon: '○' },
  { status: 'todo',        label: 'Todo',        color: '#94A3B8', icon: '◔' },
  { status: 'in_progress', label: 'In Progress', color: '#F59E0B', icon: '◑' },
  { status: 'in_review',   label: 'In Review',   color: '#A78BFA', icon: '◕' },
  { status: 'done',        label: 'Done',        color: '#10B981', icon: '●' },
];

const PRIORITIES: Record<IssuePriority, { label: string; icon: string; color: string }> = {
  urgent: { label: 'Urgent', icon: '⚡', color: '#EF4444' },
  high:   { label: 'Hoog',   icon: '↑',  color: '#FB923C' },
  medium: { label: 'Medium', icon: '→',  color: '#FBBF24' },
  low:    { label: 'Laag',   icon: '↓',  color: '#60A5FA' },
  none:   { label: 'Geen',   icon: '—',  color: '#6B7280' },
};

const LINK_LABELS: Record<LinkType, string> = {
  blocks: 'Blokkeert',
  blocked_by: 'Geblokkeerd door',
  relates_to: 'Gerelateerd aan',
  duplicates: 'Dupliceert',
  duplicate_of: 'Duplicaat van',
};

const PROJECT_COLORS = ['#8B5CF6','#10B981','#F59E0B','#60A5FA','#FB923C','#EF4444','#EC4899','#14B8A6','#F472B6','#A78BFA'];

const api = {
  get: <T,>(url: string): Promise<T> => fetch(url).then(r => r.json()),
  post: <T,>(url: string, body: any): Promise<T> =>
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  patch: <T,>(url: string, body: any): Promise<T> =>
    fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  del: (url: string) => fetch(url, { method: 'DELETE' }).then(r => r.json()),
};

type Tab = 'board' | 'cycles' | 'activity';

export default function Board() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [views, setViews] = useState<View[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [links, setLinks] = useState<IssueLinkRow[]>([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewIssue, setShowNewIssue] = useState<IssueStatus | null>(null);
  const [showNewCycle, setShowNewCycle] = useState(false);
  const [search, setSearch] = useState('');
  const [dragIssue, setDragIssue] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('board');

  const loadProjects = useCallback(() => api.get<Project[]>('/api/projects').then(setProjects), []);
  const loadCycles = useCallback(() => api.get<Cycle[]>('/api/cycles').then(setCycles), []);
  const loadViews = useCallback(() => api.get<View[]>('/api/views').then(setViews), []);
  const loadActivity = useCallback(() => api.get<Activity[]>('/api/activity?limit=200').then(setActivity), []);

  const loadIssues = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedProject) params.set('project_id', selectedProject);
    if (search) params.set('search', search);

    if (selectedView) {
      const view = views.find(v => v.id === selectedView);
      if (view) {
        const f = view.filter || {};
        if (f.status) params.set('status', Array.isArray(f.status) ? f.status.join(',') : f.status);
        if (f.priority) params.set('priority', Array.isArray(f.priority) ? f.priority.join(',') : f.priority);
        if (f.assignee !== undefined) params.set('assignee', f.assignee);
        if (f.cycle_id) params.set('cycle_id', f.cycle_id);
      }
    }
    api.get<Issue[]>(`/api/issues?${params}`).then(setIssues);
  }, [selectedProject, selectedView, search, views]);

  useEffect(() => { loadProjects(); loadCycles(); loadViews(); }, [loadProjects, loadCycles, loadViews]);
  useEffect(() => { loadIssues(); }, [loadIssues]);
  useEffect(() => { if (tab === 'activity') loadActivity(); }, [tab, loadActivity]);

  const openIssue = async (issue: Issue) => {
    const full = await api.get<Issue>(`/api/issues?id=${issue.id}`);
    setSelectedIssue(full);
    const [c, l] = await Promise.all([
      api.get<Comment[]>(`/api/comments?issue_id=${issue.id}`),
      api.get<IssueLinkRow[]>(`/api/issues/${issue.id}/links`),
    ]);
    setComments(c); setLinks(l);
  };

  const updateIssueField = async (id: string, field: string, value: any) => {
    const updated = await api.patch<Issue>(`/api/issues?id=${id}`, { [field]: value });
    setIssues(prev => prev.map(i => i.id === id ? updated : i));
    if (selectedIssue?.id === id) setSelectedIssue({ ...selectedIssue, ...updated });
  };

  const handleDrop = (status: IssueStatus) => {
    if (dragIssue) {
      updateIssueField(dragIssue, 'status', status);
      setDragIssue(null);
    }
  };

  const issuesForColumn = (status: IssueStatus) => issues.filter(i => i.status === status);

  const activeCycle = useMemo(() => cycles.find(c => c.status === 'active'), [cycles]);

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: 280, borderRight: '1px solid var(--border)', background: 'var(--bg-surface)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14,
            }}>UP</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Project4Agents</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>AI Project Management</div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 12px 8px' }}>
          <input
            type="text" placeholder="Zoek issues..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg-card)',
              color: 'var(--text)', fontSize: 13, outline: 'none',
            }}
          />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '0 8px', gap: 4, borderBottom: '1px solid var(--border)' }}>
          {(['board', 'cycles', 'activity'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '6px 8px', borderRadius: 0,
              border: 'none', borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent', color: tab === t ? 'var(--text)' : 'var(--text-dim)',
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer',
            }}>{t === 'board' ? '🎯 Board' : t === 'cycles' ? '🔄 Cycles' : '📜 Activity'}</button>
          ))}
        </div>

        <div style={{ padding: '4px 8px', flex: 1, overflowY: 'auto' }}>
          {/* Views */}
          <SidebarSection title="Views" action={undefined}>
            {views.map(v => (
              <SidebarItem key={v.id}
                active={selectedView === v.id}
                onClick={() => { setSelectedView(selectedView === v.id ? null : v.id); setSelectedProject(null); }}
                color="var(--text-muted)"
                left={<span style={{ fontSize: 11 }}>{v.icon}</span>}
                label={v.name}
              />
            ))}
          </SidebarSection>

          {/* Projects */}
          <SidebarSection title="Projecten" action={
            <button onClick={() => setShowNewProject(true)} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1,
            }}>+</button>
          }>
            <SidebarItem
              active={!selectedProject && !selectedView}
              onClick={() => { setSelectedProject(null); setSelectedView(null); }}
              color="var(--text-muted)"
              left={<span style={{ fontSize: 11 }}>⊟</span>}
              label="Alle issues"
              right={String(issues.length)}
            />
            {projects.map(p => (
              <SidebarItem key={p.id}
                active={selectedProject === p.id}
                onClick={() => { setSelectedProject(p.id); setSelectedView(null); }}
                color={p.color}
                left={<span style={{
                  width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block',
                }} />}
                label={p.name}
                right={String(issues.filter(i => i.project_id === p.id).length)}
              />
            ))}
          </SidebarSection>

          {/* Active cycle */}
          {activeCycle && (
            <SidebarSection title="Active cycle" action={undefined}>
              <div style={{
                padding: 10, borderRadius: 6, background: 'var(--bg-card)',
                border: '1px solid var(--border)', fontSize: 12,
              }}>
                <div style={{ fontWeight: 600 }}>{activeCycle.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                  {fmtDate(activeCycle.starts_at)} → {fmtDate(activeCycle.ends_at)}
                </div>
              </div>
            </SidebarSection>
          )}
        </div>

        {/* Stats */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-dim)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>Totaal</span><span style={{ color: 'var(--text-muted)' }}>{issues.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>In progress</span><span style={{ color: '#F59E0B' }}>{issues.filter(i=>i.status==='in_progress').length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Done</span><span style={{ color: '#10B981' }}>{issues.filter(i=>i.status==='done').length}</span>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{
          padding: '16px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>
            {selectedView ? views.find(v=>v.id===selectedView)?.name :
             selectedProject ? projects.find(p => p.id === selectedProject)?.name :
             tab === 'cycles' ? 'Cycles' : tab === 'activity' ? 'Activity log' : 'Alle issues'}
          </h1>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            API: <code style={{ color: 'var(--accent)', background: 'var(--accent-glow)', padding: '2px 6px', borderRadius: 4 }}>
              http://localhost:3400/api
            </code>
          </div>
        </header>

        {tab === 'board' && (
          <div style={{ flex: 1, display: 'flex', gap: 0, overflowX: 'auto', padding: '16px 12px' }}>
            {COLUMNS.map(col => {
              const colIssues = issuesForColumn(col.status);
              return (
                <div key={col.status}
                  onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-card)'; }}
                  onDragLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                  onDrop={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.background = 'transparent'; handleDrop(col.status); }}
                  style={{
                    flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column',
                    borderRight: '1px solid var(--border)', padding: '0 8px',
                  }}
                >
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 12px',
                    borderBottom: `2px solid ${col.color}22`,
                  }}>
                    <span style={{ color: col.color, fontSize: 14 }}>{col.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{col.label}</span>
                    <span style={{
                      fontSize: 11, color: 'var(--text-dim)', background: 'var(--bg-card)',
                      padding: '1px 6px', borderRadius: 10,
                    }}>{colIssues.length}</span>
                    <button onClick={() => setShowNewIssue(col.status)} style={{
                      marginLeft: 'auto', background: 'none', border: 'none',
                      color: 'var(--text-dim)', cursor: 'pointer', fontSize: 18, lineHeight: 1,
                    }}>+</button>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', paddingTop: 8 }}>
                    {colIssues.map(issue => {
                      const proj = projects.find(p => p.id === issue.project_id);
                      const pri = PRIORITIES[issue.priority];
                      const labels: string[] = (() => { try { return JSON.parse(issue.labels); } catch { return []; } })();
                      return (
                        <div key={issue.id}
                          draggable
                          onDragStart={() => setDragIssue(issue.id)}
                          onClick={() => openIssue(issue)}
                          style={{
                            background: 'var(--bg-card)', borderRadius: 8,
                            border: '1px solid var(--border)', padding: '10px 12px',
                            marginBottom: 6, cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <span style={{ color: pri.color, fontSize: 12, fontWeight: 600 }}>{pri.icon}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace' }}>{issue.identifier}</span>
                            {issue.github_pr_url && <span title="Heeft PR" style={{ marginLeft: 'auto', fontSize: 10 }}>🔗</span>}
                            {issue.estimate != null && (
                              <span style={{ marginLeft: issue.github_pr_url ? 4 : 'auto', fontSize: 10, color: 'var(--text-dim)' }}>
                                {issue.estimate}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, marginBottom: 8 }}>{issue.title}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {proj && (
                              <span style={{
                                fontSize: 10, color: proj.color, background: `${proj.color}15`,
                                padding: '1px 6px', borderRadius: 4,
                              }}>{proj.name}</span>
                            )}
                            {issue.assignee && (
                              <span style={{
                                fontSize: 10, color: 'var(--accent)', background: 'var(--accent-glow)',
                                padding: '1px 6px', borderRadius: 4,
                              }}>👤 {issue.assignee}</span>
                            )}
                            {labels.slice(0, 3).map((l, i) => (
                              <span key={i} style={{
                                fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg)',
                                padding: '1px 6px', borderRadius: 4,
                              }}>{l}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {showNewIssue === col.status && (
                      <NewIssueInline
                        status={col.status}
                        projects={projects}
                        selectedProject={selectedProject}
                        onCreated={() => { setShowNewIssue(null); loadIssues(); }}
                        onCancel={() => setShowNewIssue(null)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'cycles' && (
          <CyclesView cycles={cycles} issues={issues} onCreate={() => setShowNewCycle(true)} onChanged={loadCycles} />
        )}

        {tab === 'activity' && (
          <ActivityView items={activity} />
        )}
      </main>

      {selectedIssue && (
        <IssueDetail
          issue={selectedIssue}
          project={projects.find(p => p.id === selectedIssue.project_id)}
          projects={projects}
          cycles={cycles}
          comments={comments}
          links={links}
          allIssues={issues}
          onUpdate={(field, value) => updateIssueField(selectedIssue.id, field, value)}
          onAddComment={async (body) => {
            await api.post('/api/comments', { issue_id: selectedIssue.id, body, author: 'user' });
            const c = await api.get<Comment[]>(`/api/comments?issue_id=${selectedIssue.id}`);
            setComments(c);
          }}
          onAddLink={async (to, link_type) => {
            await api.post(`/api/issues/${selectedIssue.id}/links`, { to, link_type });
            const l = await api.get<IssueLinkRow[]>(`/api/issues/${selectedIssue.id}/links`);
            setLinks(l);
          }}
          onClaim={async (assignee) => {
            const updated = await api.post<Issue>(`/api/issues/${selectedIssue.id}/claim`, { assignee });
            setSelectedIssue({ ...selectedIssue, ...updated });
            loadIssues();
            const c = await api.get<Comment[]>(`/api/comments?issue_id=${selectedIssue.id}`);
            setComments(c);
          }}
          onBranchName={async () => {
            const r = await api.get<{ branch_name: string }>(`/api/issues/${selectedIssue.id}/branch-name`);
            try { await navigator.clipboard.writeText(r.branch_name); alert(`Branch-naam gekopieerd:\n${r.branch_name}`); }
            catch { alert(`Branch-naam: ${r.branch_name}`); }
          }}
          onDelete={async () => {
            await api.del(`/api/issues?id=${selectedIssue.id}`);
            setSelectedIssue(null); loadIssues();
          }}
          onClose={() => setSelectedIssue(null)}
        />
      )}

      {showNewProject && (
        <NewProjectModal
          onCreated={() => { setShowNewProject(false); loadProjects(); }}
          onClose={() => setShowNewProject(false)}
        />
      )}

      {showNewCycle && (
        <NewCycleModal
          onCreated={() => { setShowNewCycle(false); loadCycles(); }}
          onClose={() => setShowNewCycle(false)}
        />
      )}
    </div>
  );
}

// ── Sidebar helpers ──
function SidebarSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase',
        letterSpacing: '0.5px', padding: '10px 8px 4px', display: 'flex', justifyContent: 'space-between',
      }}>
        <span>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function SidebarItem({ active, onClick, color, left, label, right }: {
  active: boolean; onClick: () => void; color: string;
  left: React.ReactNode; label: string; right?: string;
}) {
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '6px 8px', borderRadius: 6, border: 'none', textAlign: 'left',
      background: active ? 'var(--accent-glow)' : 'transparent',
      color: active ? color : 'var(--text-muted)',
      cursor: 'pointer', fontSize: 13, fontWeight: 500, marginBottom: 1,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {left}
      <span style={{ flex: 1 }}>{label}</span>
      {right && <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{right}</span>}
    </button>
  );
}

// ── New issue inline ──
function NewIssueInline({ status, projects, selectedProject, onCreated, onCancel }: {
  status: IssueStatus; projects: Project[]; selectedProject: string | null;
  onCreated: () => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(selectedProject || projects[0]?.id || '');
  const [priority, setPriority] = useState<IssuePriority>('none');

  const submit = async () => {
    if (!title.trim() || !projectId) return;
    await api.post('/api/issues', { title, project_id: projectId, status, priority });
    onCreated();
  };

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--accent)',
      padding: 12, marginBottom: 6,
    }}>
      <input
        autoFocus value={title} onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
        placeholder="Issue titel..."
        style={{
          width: '100%', background: 'transparent', border: 'none',
          color: 'var(--text)', fontSize: 13, outline: 'none', marginBottom: 8,
        }}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        <select value={projectId} onChange={e => setProjectId(e.target.value)} style={inputStyle()}>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={priority} onChange={e => setPriority(e.target.value as IssuePriority)} style={inputStyle()}>
          {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={btnStyle('outline')}>Annuleer</button>
        <button onClick={submit} style={btnStyle('primary')}>Toevoegen</button>
      </div>
    </div>
  );
}

// ── Issue detail panel ──
function IssueDetail({ issue, project, projects, cycles, comments, links, allIssues, onUpdate, onAddComment, onAddLink, onClaim, onBranchName, onDelete, onClose }: {
  issue: Issue; project?: Project; projects: Project[]; cycles: Cycle[];
  comments: Comment[]; links: IssueLinkRow[]; allIssues: Issue[];
  onUpdate: (field: string, value: any) => void;
  onAddComment: (body: string) => void;
  onAddLink: (to: string, link_type: LinkType) => void;
  onClaim: (assignee: string) => void;
  onBranchName: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [editTitle, setEditTitle] = useState(false);
  const [title, setTitle] = useState(issue.title);
  const [desc, setDesc] = useState(issue.description);
  const [criteria, setCriteria] = useState(issue.acceptance_criteria);
  const [branch, setBranch] = useState(issue.github_branch);
  const [assignee, setAssignee] = useState(issue.assignee);
  const [commentText, setCommentText] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [linkTarget, setLinkTarget] = useState('');
  const [linkType, setLinkType] = useState<LinkType>('blocks');
  const [showClaim, setShowClaim] = useState(false);
  const [claimAs, setClaimAs] = useState('agent');

  useEffect(() => {
    setTitle(issue.title); setDesc(issue.description);
    setCriteria(issue.acceptance_criteria); setBranch(issue.github_branch);
    setAssignee(issue.assignee);
  }, [issue]);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', zIndex: 100 }} />
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 600,
        background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)',
        zIndex: 101, display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'monospace' }}>{issue.identifier}</span>
          <button onClick={onClaim ? () => setShowClaim(true) : undefined} style={btnStyle('outline-sm')}>Claim</button>
          <button onClick={onBranchName} style={btnStyle('outline-sm')}>Branch-naam</button>
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowDelete(true)} style={iconBtnStyle()}>🗑</button>
          <button onClick={onClose} style={iconBtnStyle()}>×</button>
        </div>

        <div style={{ padding: 20, flex: 1 }}>
          {/* Title */}
          {editTitle ? (
            <input value={title} onChange={e => setTitle(e.target.value)}
              onBlur={() => { onUpdate('title', title); setEditTitle(false); }}
              onKeyDown={e => { if (e.key === 'Enter') { onUpdate('title', title); setEditTitle(false); } }}
              autoFocus
              style={{
                width: '100%', fontSize: 18, fontWeight: 700, background: 'transparent',
                border: '1px solid var(--accent)', borderRadius: 4, padding: '4px 8px',
                color: 'var(--text)', outline: 'none', marginBottom: 16,
              }}
            />
          ) : (
            <h2 onClick={() => setEditTitle(true)} style={{
              fontSize: 18, fontWeight: 700, marginBottom: 16, cursor: 'pointer',
            }}>{issue.title}</h2>
          )}

          {/* Properties grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <Field label="Status">
              <select value={issue.status} onChange={e => onUpdate('status', e.target.value)} style={selectStyle()}>
                {COLUMNS.map(c => <option key={c.status} value={c.status}>{c.icon} {c.label}</option>)}
                <option value="cancelled">✕ Cancelled</option>
              </select>
            </Field>
            <Field label="Prioriteit">
              <select value={issue.priority} onChange={e => onUpdate('priority', e.target.value)} style={selectStyle()}>
                {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </Field>
            <Field label="Project">
              <select value={issue.project_id} onChange={e => onUpdate('project_id', e.target.value)} style={selectStyle()}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Assignee">
              <input value={assignee}
                onChange={e => setAssignee(e.target.value)}
                onBlur={() => onUpdate('assignee', assignee)}
                placeholder="agent / iwan / ..." style={selectStyle()}
              />
            </Field>
            <Field label="Cycle">
              <select value={issue.cycle_id || ''} onChange={e => onUpdate('cycle_id', e.target.value || null)} style={selectStyle()}>
                <option value="">— geen —</option>
                {cycles.map(c => <option key={c.id} value={c.id}>{c.name} {c.status === 'active' ? '(actief)' : ''}</option>)}
              </select>
            </Field>
            <Field label="Estimate (sp)">
              <input type="number" value={issue.estimate ?? ''}
                onChange={e => onUpdate('estimate', e.target.value === '' ? null : Number(e.target.value))}
                style={selectStyle()} placeholder="—"
              />
            </Field>
            <Field label="Due date">
              <input type="date" value={issue.due_date || ''}
                onChange={e => onUpdate('due_date', e.target.value || null)}
                style={selectStyle()}
              />
            </Field>
            <Field label="Parent issue">
              <select value={issue.parent_issue_id || ''} onChange={e => onUpdate('parent_issue_id', e.target.value || null)} style={selectStyle()}>
                <option value="">— geen —</option>
                {allIssues.filter(i => i.id !== issue.id).map(i => (
                  <option key={i.id} value={i.id}>{i.identifier} — {i.title.slice(0, 40)}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Description */}
          <Field label="Beschrijving" block>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} onBlur={() => onUpdate('description', desc)}
              placeholder="Beschrijf wat er gebouwd moet worden..."
              style={textareaStyle(80)}
            />
          </Field>

          {/* Acceptance criteria */}
          <Field label="Acceptatiecriteria" block>
            <textarea value={criteria} onChange={e => setCriteria(e.target.value)} onBlur={() => onUpdate('acceptance_criteria', criteria)}
              placeholder="- [ ] Criteria 1&#10;- [ ] Criteria 2"
              style={{ ...textareaStyle(60), fontFamily: 'monospace' }}
            />
          </Field>

          {/* Sub-issues */}
          {issue.sub_issues && issue.sub_issues.length > 0 && (
            <Field label={`Sub-issues (${issue.sub_issues.length})`} block>
              {issue.sub_issues.map(s => (
                <div key={s.id} style={{
                  padding: '6px 10px', background: 'var(--bg-card)', borderRadius: 6,
                  border: '1px solid var(--border)', marginBottom: 4, display: 'flex',
                  alignItems: 'center', gap: 8, fontSize: 12,
                }}>
                  <span style={{ color: COLUMNS.find(c => c.status === s.status)?.color }}>
                    {COLUMNS.find(c => c.status === s.status)?.icon}
                  </span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-dim)', fontSize: 11 }}>{s.identifier}</span>
                  <span>{s.title}</span>
                </div>
              ))}
            </Field>
          )}

          {/* Links */}
          <Field label={`Gekoppelde issues (${links.length})`} block action={
            <button onClick={() => setShowAddLink(!showAddLink)} style={btnStyle('outline-sm')}>+ Link</button>
          }>
            {showAddLink && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, padding: 8, background: 'var(--bg-card)', borderRadius: 6 }}>
                <select value={linkType} onChange={e => setLinkType(e.target.value as LinkType)} style={selectStyle()}>
                  {(['blocks', 'blocked_by', 'relates_to', 'duplicates'] as LinkType[]).map(t => (
                    <option key={t} value={t}>{LINK_LABELS[t]}</option>
                  ))}
                </select>
                <select value={linkTarget} onChange={e => setLinkTarget(e.target.value)} style={selectStyle()}>
                  <option value="">— kies issue —</option>
                  {allIssues.filter(i => i.id !== issue.id).map(i => (
                    <option key={i.id} value={i.identifier}>{i.identifier} — {i.title.slice(0,40)}</option>
                  ))}
                </select>
                <button onClick={() => { if (linkTarget) { onAddLink(linkTarget, linkType); setShowAddLink(false); setLinkTarget(''); } }}
                  style={btnStyle('primary')}>OK</button>
              </div>
            )}
            {links.filter(l => l.from_issue_id === issue.id).map(l => (
              <div key={l.id} style={{
                padding: '6px 10px', background: 'var(--bg-card)', borderRadius: 6,
                border: '1px solid var(--border)', marginBottom: 4, display: 'flex',
                alignItems: 'center', gap: 8, fontSize: 12,
              }}>
                <span style={{ color: 'var(--text-dim)' }}>{LINK_LABELS[l.link_type]}</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--text-dim)' }}>{l.to?.identifier}</span>
                <span>{l.to?.title}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: COLUMNS.find(c => c.status === l.to?.status)?.color }}>
                  {l.to?.status}
                </span>
              </div>
            ))}
          </Field>

          {/* GitHub */}
          <Field label="GitHub" block>
            <input value={branch}
              onChange={e => setBranch(e.target.value)}
              onBlur={() => onUpdate('github_branch', branch)}
              placeholder="iwan/up-42-titel-slug"
              style={{ ...selectStyle(), fontFamily: 'monospace', width: '100%' }}
            />
            {issue.github_pr_url && (
              <a href={issue.github_pr_url} target="_blank" rel="noreferrer" style={{
                display: 'inline-block', marginTop: 6, fontSize: 12, color: 'var(--accent)',
              }}>
                → PR #{issue.github_pr_number} bekijken
              </a>
            )}
          </Field>

          {/* Comments */}
          <Field label={`Activiteit (${comments.length})`} block>
            {comments.map(c => (
              <div key={c.id} style={{
                padding: '8px 10px', borderRadius: 6, background: 'var(--bg-card)',
                marginBottom: 4, borderLeft: `3px solid ${commentColor(c.author)}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: commentColor(c.author) }}>
                    {commentIcon(c.author)} {c.author}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    {new Date(c.created_at).toLocaleString('nl-NL')}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{c.body}</div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && commentText.trim()) {
                    onAddComment(commentText.trim()); setCommentText('');
                  }
                }}
                placeholder="Schrijf een opmerking..."
                style={selectStyle()}
              />
              <button onClick={() => {
                if (commentText.trim()) { onAddComment(commentText.trim()); setCommentText(''); }
              }} style={btnStyle('primary')}>Verstuur</button>
            </div>
          </Field>
        </div>

        {showClaim && (
          <ModalOverlay onClose={() => setShowClaim(false)}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Claim issue</h3>
            <input value={claimAs} onChange={e => setClaimAs(e.target.value)} placeholder="agent / iwan / ..." autoFocus
              style={{ ...selectStyle(), width: '100%', marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowClaim(false)} style={btnStyle('outline')}>Annuleer</button>
              <button onClick={() => { if (claimAs) { onClaim(claimAs); setShowClaim(false); } }} style={btnStyle('primary')}>Claim</button>
            </div>
          </ModalOverlay>
        )}

        {showDelete && (
          <ModalOverlay onClose={() => setShowDelete(false)}>
            <p style={{ fontSize: 14, marginBottom: 16 }}>Verwijder <strong>{issue.identifier}</strong>?</p>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
              <button onClick={() => setShowDelete(false)} style={btnStyle('outline')}>Annuleer</button>
              <button onClick={onDelete} style={btnStyle('danger')}>Verwijder</button>
            </div>
          </ModalOverlay>
        )}
      </div>
    </>
  );
}

// ── Cycles view ──
function CyclesView({ cycles, issues, onCreate, onChanged }: {
  cycles: Cycle[]; issues: Issue[]; onCreate: () => void; onChanged: () => void;
}) {
  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Cycles (sprints)</h2>
        <button onClick={onCreate} style={btnStyle('primary')}>+ Nieuwe cycle</button>
      </div>
      {cycles.length === 0 && <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Nog geen cycles. Maak er één om werk in sprint-blokken te plannen.</p>}
      {cycles.map(c => {
        const cycleIssues = issues.filter(i => i.cycle_id === c.id);
        const done = cycleIssues.filter(i => i.status === 'done').length;
        const pct = cycleIssues.length ? Math.round(100 * done / cycleIssues.length) : 0;
        return (
          <div key={c.id} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 8, padding: 16, marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{c.name}</h3>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 10,
                background: c.status === 'active' ? '#10B98122' : c.status === 'upcoming' ? '#8B5CF622' : '#6B728022',
                color: c.status === 'active' ? '#10B981' : c.status === 'upcoming' ? '#8B5CF6' : '#6B7280',
              }}>{c.status}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
              {fmtDate(c.starts_at)} → {fmtDate(c.ends_at)} · {cycleIssues.length} issues · {done} done ({pct}%)
            </div>
            <div style={{ height: 4, background: 'var(--bg)', borderRadius: 2 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#10B981', borderRadius: 2 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Activity view ──
function ActivityView({ items }: { items: Activity[] }) {
  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Activity log</h2>
      {items.length === 0 && <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Geen activiteit nog.</p>}
      {items.map(a => (
        <div key={a.id} style={{
          padding: '8px 10px', borderRadius: 6, background: 'var(--bg-card)',
          borderLeft: `3px solid ${activityColor(a.type)}`, marginBottom: 4, fontSize: 12,
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: activityColor(a.type), fontWeight: 600 }}>{activityIcon(a.type)} {a.actor}</span>
            <span style={{ color: 'var(--text-muted)' }}>{describeActivity(a)}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)' }}>
              {new Date(a.created_at).toLocaleString('nl-NL')}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── New project modal ──
function NewProjectModal({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const submit = async () => {
    if (!name.trim()) return;
    await api.post('/api/projects', { name, description, color });
    onCreated();
  };
  return (
    <ModalOverlay onClose={onClose}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Nieuw project</h3>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Project naam" autoFocus
        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
        style={{ ...selectStyle(), width: '100%', marginBottom: 10 }}
      />
      <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Beschrijving"
        style={textareaStyle(60)}
      />
      <div style={{ display: 'flex', gap: 6, margin: '12px 0' }}>
        {PROJECT_COLORS.map(c => (
          <button key={c} onClick={() => setColor(c)} style={{
            width: 24, height: 24, borderRadius: '50%', background: c,
            border: color === c ? '2px solid white' : '2px solid transparent', cursor: 'pointer',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={btnStyle('outline')}>Annuleer</button>
        <button onClick={submit} style={btnStyle('primary')}>Aanmaken</button>
      </div>
    </ModalOverlay>
  );
}

// ── New cycle modal ──
function NewCycleModal({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const inTwoWeeks = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const [name, setName] = useState('');
  const [starts, setStarts] = useState(today);
  const [ends, setEnds] = useState(inTwoWeeks);

  const submit = async () => {
    if (!name.trim()) return;
    await api.post('/api/cycles', { name, starts_at: starts, ends_at: ends });
    onCreated();
  };
  return (
    <ModalOverlay onClose={onClose}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Nieuwe cycle</h3>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Cycle naam (bv 'Week 21')" autoFocus
        style={{ ...selectStyle(), width: '100%', marginBottom: 10 }}
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input type="date" value={starts} onChange={e => setStarts(e.target.value)} style={{ ...selectStyle(), flex: 1 }} />
        <input type="date" value={ends} onChange={e => setEnds(e.target.value)} style={{ ...selectStyle(), flex: 1 }} />
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={btnStyle('outline')}>Annuleer</button>
        <button onClick={submit} style={btnStyle('primary')}>Aanmaken</button>
      </div>
    </ModalOverlay>
  );
}

// ── Reusable bits ──
function Field({ label, action, block, children }: { label: string; action?: React.ReactNode; block?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: block ? 16 : 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>{label}</span>
        {action && <div style={{ marginLeft: 'auto' }}>{action}</div>}
      </div>
      {children}
    </div>
  );
}

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12,
        padding: 24, width: 420, zIndex: 201,
      }}>{children}</div>
    </>
  );
}

// ── Styles ──
function inputStyle(): React.CSSProperties {
  return {
    flex: 1, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)',
    background: 'var(--bg)', color: 'var(--text)', fontSize: 11,
  };
}
function selectStyle(): React.CSSProperties {
  return {
    padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--bg-card)', color: 'var(--text)', fontSize: 12, outline: 'none',
  };
}
function textareaStyle(minHeight: number): React.CSSProperties {
  return {
    width: '100%', minHeight, padding: 10, borderRadius: 6,
    border: '1px solid var(--border)', background: 'var(--bg-card)',
    color: 'var(--text)', fontSize: 12, resize: 'vertical', outline: 'none',
    fontFamily: 'inherit', lineHeight: 1.5,
  };
}
function btnStyle(variant: 'primary' | 'outline' | 'outline-sm' | 'danger'): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: variant === 'outline-sm' ? '4px 8px' : '6px 12px',
    borderRadius: 6, fontSize: variant === 'outline-sm' ? 11 : 12, cursor: 'pointer',
    fontWeight: 600,
  };
  if (variant === 'primary') return { ...base, border: 'none', background: 'var(--accent)', color: 'white' };
  if (variant === 'danger')  return { ...base, border: 'none', background: 'var(--red)', color: 'white' };
  return { ...base, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)' };
}
function iconBtnStyle(): React.CSSProperties {
  return { background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16 };
}

// ── Helpers ──
function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' }); }
  catch { return s; }
}
function commentColor(author: string) {
  if (author === 'agent' || author.startsWith('agent')) return 'var(--accent)';
  if (author.startsWith('github')) return '#A78BFA';
  return 'var(--green)';
}
function commentIcon(author: string) {
  if (author === 'agent' || author.startsWith('agent')) return '🤖';
  if (author.startsWith('github')) return '🐙';
  return '👤';
}
function activityColor(type: string) {
  if (type.startsWith('pr_')) return '#A78BFA';
  if (type === 'status_changed') return '#F59E0B';
  if (type === 'comment_added') return '#10B981';
  if (type === 'issue_created') return '#8B5CF6';
  return '#6B7280';
}
function activityIcon(type: string) {
  if (type.startsWith('pr_')) return '🔗';
  if (type === 'status_changed') return '↻';
  if (type === 'comment_added') return '💬';
  if (type === 'issue_created') return '+';
  if (type === 'priority_changed') return '⚡';
  if (type === 'assignee_changed') return '👤';
  if (type === 'branch_linked') return '🌿';
  if (type === 'linked_issue_added') return '🔀';
  return '·';
}
function describeActivity(a: Activity): string {
  const p = a.payload || {};
  switch (a.type) {
    case 'issue_created': return `maakte ${p.identifier ? p.identifier + ' — ' : ''}${p.title || p.name || ''}`;
    case 'status_changed': return `zette ${p.identifier} ${p.from} → ${p.to}`;
    case 'priority_changed': return `zette priority op ${p.to} op ${p.identifier}`;
    case 'assignee_changed': return `gaf ${p.identifier} aan ${p.to || '(niemand)'}`;
    case 'comment_added': return `op ${p.identifier}: "${p.preview}..."`;
    case 'branch_linked': return `linkte branch ${p.branch} aan ${p.identifier}`;
    case 'pr_linked': return `linkte ${p.pr_url} aan ${p.identifier}`;
    case 'pr_opened': return `opende PR #${p.pr_number} voor ${p.identifier}`;
    case 'pr_merged': return `mergde PR #${p.pr_number} voor ${p.identifier}`;
    case 'pr_closed': return `sloot PR #${p.pr_number} voor ${p.identifier}`;
    case 'pr_review_requested': return `vroeg review op PR #${p.pr_number} voor ${p.identifier}`;
    case 'linked_issue_added': return `${p.from} ${p.link_type} ${p.to}`;
    default: return a.type;
  }
}
