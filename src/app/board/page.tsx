'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon, IconName } from '@/components/Icon';

interface Me { id: string; email: string; name: string; avatar_url: string; role: 'admin' | 'member'; }
interface Workspace { id: string; key: string; name: string; description: string; role?: 'admin' | 'member'; }

// ── Types ──
type IssueStatus = 'triage' | 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';
type IssuePriority = 'none' | 'low' | 'medium' | 'high' | 'urgent';
type LinkType = 'blocks' | 'blocked_by' | 'relates_to' | 'duplicates' | 'duplicate_of';

interface Project { id: string; name: string; description: string; color: string; team_id: string | null; }
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

const COLUMNS: { status: IssueStatus; label: string; color: string; icon: IconName }[] = [
  { status: 'triage',      label: 'Triage',      color: '#EC4899', icon: 'status_triage' },
  { status: 'backlog',     label: 'Backlog',     color: '#6B7280', icon: 'status_backlog' },
  { status: 'todo',        label: 'Todo',        color: '#94A3B8', icon: 'status_todo' },
  { status: 'in_progress', label: 'In Progress', color: '#F59E0B', icon: 'status_in_progress' },
  { status: 'in_review',   label: 'In Review',   color: '#A78BFA', icon: 'status_in_review' },
  { status: 'done',        label: 'Done',        color: '#10B981', icon: 'status_done' },
];

const PRIORITIES: Record<IssuePriority, { label: string; icon: IconName; color: string }> = {
  urgent: { label: 'Urgent', icon: 'priority_urgent', color: '#EF4444' },
  high:   { label: 'Hoog',   icon: 'priority_high',   color: '#FB923C' },
  medium: { label: 'Medium', icon: 'priority_medium', color: '#FBBF24' },
  low:    { label: 'Laag',   icon: 'priority_low',    color: '#60A5FA' },
  none:   { label: 'Geen',   icon: 'priority_none',   color: '#6B7280' },
};

const LINK_LABELS: Record<LinkType, string> = {
  blocks: 'Blokkeert',
  blocked_by: 'Geblokkeerd door',
  relates_to: 'Gerelateerd aan',
  duplicates: 'Dupliceert',
  duplicate_of: 'Duplicaat van',
};

const PROJECT_COLORS = ['#8B5CF6','#10B981','#F59E0B','#60A5FA','#FB923C','#EF4444','#EC4899','#14B8A6','#F472B6','#A78BFA'];

// Map oude emoji-icoonstrings naar nieuwe Icon-namen (voor saved views in DB).
const VIEW_ICON_MAP: Record<string, IconName> = {
  '◑': 'status_in_progress',
  '🤖': 'agent',
  '↑': 'priority_high',
  '⊙': 'status_triage',
  '●': 'status_done',
  '⊟': 'views',
};
function viewIcon(s: string): IconName {
  if (s && s.startsWith('status_') || s?.startsWith('priority_') || s in {agent:1,user:1,views:1,projects:1}) return s as IconName;
  return VIEW_ICON_MAP[s] || 'views';
}

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
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [currentWs, setCurrentWs] = useState<Workspace | null>(null);
  const [userWorkspaces, setUserWorkspaces] = useState<Workspace[]>([]);
  const [showNewWs, setShowNewWs] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
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

  // Auth check
  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      if (!d.user) { router.push('/login?redirect=/board'); return; }
      setMe(d.user);
      setCurrentWs(d.workspace || null);
      setUserWorkspaces(d.workspaces || []);
      setAuthChecked(true);
    }).catch(() => router.push('/login?redirect=/board'));
  }, [router]);

  const switchWorkspace = async (workspaceId: string) => {
    await fetch('/api/workspaces/switch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId }),
    });
    const d = await fetch('/api/me').then(r => r.json());
    setCurrentWs(d.workspace || null);
    setSelectedProject(null); setSelectedView(null);
    loadProjects(); loadIssues(); loadCycles();
  };

  const refreshWorkspaces = async () => {
    const d = await fetch('/api/me').then(r => r.json());
    setUserWorkspaces(d.workspaces || []);
    setCurrentWs(d.workspace || null);
  };

  useEffect(() => { if (authChecked) { loadProjects(); loadCycles(); loadViews(); } }, [authChecked, loadProjects, loadCycles, loadViews]);
  useEffect(() => { if (authChecked) loadIssues(); }, [authChecked, loadIssues]);
  useEffect(() => { if (authChecked && tab === 'activity') loadActivity(); }, [authChecked, tab, loadActivity]);

  // Loading state tijdens auth-check
  if (!authChecked) {
    return (
      <div style={{
        height: '100vh', background: 'var(--bg)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)',
        fontSize: 13,
      }}>Laden...</div>
    );
  }

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
        {/* Workspace switcher */}
        <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
          <WorkspaceSwitcher
            current={currentWs}
            workspaces={userWorkspaces}
            onSwitch={switchWorkspace}
            onCreateNew={() => setShowNewWs(true)}
          />
        </div>

        {/* Search */}
        <div style={{ padding: '12px 12px 8px', position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 22, top: 19, color: 'var(--text-dim)',
            pointerEvents: 'none', display: 'flex',
          }}><Icon name="search" size={13} /></span>
          <input
            type="text" placeholder="Zoek issues..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 30px', borderRadius: 6,
              border: '1px solid var(--border)', background: 'var(--bg-card)',
              color: 'var(--text)', fontSize: 13, outline: 'none',
            }}
          />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '0 8px', gap: 0, borderBottom: '1px solid var(--border)' }}>
          {([
            { id: 'board', icon: 'board' as IconName, label: 'Board' },
            { id: 'cycles', icon: 'cycles' as IconName, label: 'Cycles' },
            { id: 'activity', icon: 'activity' as IconName, label: 'Activity' },
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)} style={{
              flex: 1, padding: '8px 8px',
              border: 'none', borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent', color: tab === t.id ? 'var(--text)' : 'var(--text-dim)',
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}><Icon name={t.icon} size={12} /> {t.label}</button>
          ))}
        </div>

        <div style={{ padding: '4px 8px', flex: 1, overflowY: 'auto' }}>
          {/* Views */}
          <SidebarSection title="Views">
            {views.map(v => (
              <SidebarItem key={v.id}
                active={selectedView === v.id}
                onClick={() => { setSelectedView(selectedView === v.id ? null : v.id); setSelectedProject(null); }}
                color="var(--text-muted)"
                left={<Icon name={viewIcon(v.icon)} size={13} />}
                label={v.name}
              />
            ))}
          </SidebarSection>

          {/* Projects */}
          <SidebarSection title="Projecten" action={
            <button onClick={() => setShowNewProject(true)} style={iconBtnStyle()}>
              <Icon name="plus" size={13} />
            </button>
          }>
            <SidebarItem
              active={!selectedProject && !selectedView}
              onClick={() => { setSelectedProject(null); setSelectedView(null); }}
              color="var(--text-muted)"
              left={<Icon name="projects" size={13} />}
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
            <SidebarSection title="Active cycle">
              <div style={{
                padding: 10, borderRadius: 6, background: 'var(--bg-card)',
                border: '1px solid var(--border)', fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Icon name="cycles" size={14} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{activeCycle.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                    {fmtDate(activeCycle.starts_at)} → {fmtDate(activeCycle.ends_at)}
                  </div>
                </div>
              </div>
            </SidebarSection>
          )}
        </div>

        {/* Stats */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-dim)' }}>
          <StatLine label="Totaal" value={issues.length} />
          <StatLine label="In progress" value={issues.filter(i=>i.status==='in_progress').length} color="#F59E0B" />
          <StatLine label="Done"        value={issues.filter(i=>i.status==='done').length}        color="#10B981" />
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{
          padding: '16px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.2px' }}>
            {selectedView ? views.find(v=>v.id===selectedView)?.name :
             selectedProject ? projects.find(p => p.id === selectedProject)?.name :
             tab === 'cycles' ? 'Cycles' : tab === 'activity' ? 'Activity log' : 'Alle issues'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              API: <code style={{ color: 'var(--accent)', background: 'var(--accent-glow)', padding: '2px 6px', borderRadius: 4 }}>
                localhost:3400/api
              </code>
            </div>
            {me && <UserMenu me={me} onLogout={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              router.push('/login');
            }} />}
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
                    <span style={{ color: col.color, display: 'inline-flex' }}><Icon name={col.icon} size={14} /></span>
                    <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1px' }}>{col.label}</span>
                    <span style={{
                      fontSize: 11, color: 'var(--text-dim)', background: 'var(--bg-card)',
                      padding: '1px 6px', borderRadius: 10,
                    }}>{colIssues.length}</span>
                    <button onClick={() => setShowNewIssue(col.status)} style={iconBtnStyle()}>
                      <Icon name="plus" size={13} />
                    </button>
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
                            <span style={{ color: pri.color, display: 'inline-flex' }}><Icon name={pri.icon} size={12} /></span>
                            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace' }}>{issue.identifier}</span>
                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {issue.github_pr_url && <span title={`PR #${issue.github_pr_number}`} style={{ color: 'var(--text-dim)', display: 'inline-flex' }}><Icon name="pr" size={11} /></span>}
                              {issue.estimate != null && (
                                <span style={{ fontSize: 10, color: 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <Icon name="estimate" size={10} /> {issue.estimate}
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, marginBottom: 8 }}>{issue.title}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {proj && (
                              <span style={{
                                fontSize: 10, color: proj.color, background: `${proj.color}15`,
                                padding: '2px 6px', borderRadius: 4, fontWeight: 500,
                              }}>{proj.name}</span>
                            )}
                            {issue.assignee && (
                              <span style={{
                                fontSize: 10, color: 'var(--accent)', background: 'var(--accent-glow)',
                                padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 500,
                              }}>
                                <Icon name={assigneeIcon(issue.assignee)} size={9} />
                                {issue.assignee}
                              </span>
                            )}
                            {labels.slice(0, 3).map((l, i) => (
                              <span key={i} style={{
                                fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg)',
                                padding: '2px 6px', borderRadius: 4,
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
          <CyclesView cycles={cycles} issues={issues} onCreate={() => setShowNewCycle(true)} />
        )}

        {tab === 'activity' && (
          <ActivityView items={activity} />
        )}
      </main>

      {selectedIssue && (
        <IssueDetail
          issue={selectedIssue}
          me={me}
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

      {showNewWs && (
        <NewWorkspaceModal
          onCreated={async (newWs) => {
            setShowNewWs(false);
            await refreshWorkspaces();
            // Switch direct naar de nieuwe workspace
            await switchWorkspace(newWs.id);
          }}
          onClose={() => setShowNewWs(false)}
        />
      )}
    </div>
  );
}

// ── Workspace switcher ──
function WorkspaceSwitcher({ current, workspaces, onSwitch, onCreateNew }: {
  current: Workspace | null; workspaces: Workspace[];
  onSwitch: (id: string) => void; onCreateNew: () => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const h = () => setOpen(false);
    setTimeout(() => window.addEventListener('click', h, { once: true }), 0);
    return () => window.removeEventListener('click', h);
  }, [open]);

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={e => { e.stopPropagation(); setOpen(!open); }} style={{
        width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '8px 10px',
        display: 'flex', alignItems: 'center', gap: 10,
        cursor: 'pointer', color: 'var(--text)',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 7,
          background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 11, color: 'white', letterSpacing: '-0.2px',
          flexShrink: 0,
        }}>{current?.key.slice(0, 3) || 'UP'}</div>
        <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
          <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {current?.name || 'Geen workspace'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
            {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
          </div>
        </div>
        <span style={{ color: 'var(--text-dim)', display: 'inline-flex', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
          <Icon name="arrow_right" size={12} />
        </span>
      </button>

      {open && (
        <div onClick={e => e.stopPropagation()} style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 6, zIndex: 20,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 600, color: 'var(--text-dim)',
            textTransform: 'uppercase', letterSpacing: '0.5px',
            padding: '8px 8px 4px',
          }}>Switch workspace</div>
          {workspaces.map(w => {
            const active = w.id === current?.id;
            return (
              <button key={w.id} onClick={() => { setOpen(false); if (!active) onSwitch(w.id); }} style={{
                width: '100%', padding: '8px 8px', borderRadius: 6, border: 'none',
                background: active ? 'var(--accent-glow)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text-muted)',
                cursor: 'pointer', fontSize: 13, textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{
                  width: 22, height: 22, borderRadius: 5,
                  background: 'var(--bg-card)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 9, fontFamily: 'monospace', color: 'var(--text-muted)',
                }}>{w.key}</span>
                <span style={{ flex: 1 }}>{w.name}</span>
                {active && <Icon name="check" size={12} />}
                {w.role === 'admin' && !active && (
                  <span style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 3,
                    background: 'var(--accent-glow)', color: 'var(--accent)',
                    fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase',
                  }}>Admin</span>
                )}
              </button>
            );
          })}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
            <button onClick={() => { setOpen(false); onCreateNew(); }} style={{
              width: '100%', padding: '8px 8px', borderRadius: 6, border: 'none',
              background: 'transparent', color: 'var(--accent)',
              cursor: 'pointer', fontSize: 13, textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600,
            }}>
              <Icon name="plus" size={12} /> Nieuwe workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── New workspace modal ──
function NewWorkspaceModal({ onCreated, onClose }: { onCreated: (ws: Workspace) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Auto-genereer key uit naam
  useEffect(() => {
    if (!key && name) {
      const auto = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      setKey(auto);
    }
  }, [name, key]);

  const submit = async () => {
    if (!name.trim() || !key.trim()) return;
    setError(null);
    const res = await fetch('/api/workspaces', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, key }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Mislukt'); return; }
    onCreated(data);
  };

  return (
    <ModalOverlay onClose={onClose}>
      <h3 style={modalH()}>Nieuwe workspace</h3>
      <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>
        Eigen workspace voor een bedrijf of team — eigen issue-prefix, eigen projecten.
      </p>
      <Field label="Naam">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="bv. Fit In Finance" autoFocus
          style={{ ...selectStyle(), width: '100%' }} />
      </Field>
      <Field label="Issue prefix">
        <input value={key} onChange={e => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          placeholder="bv. FIF" maxLength={5}
          style={{ ...selectStyle(), width: '100%', fontFamily: 'monospace', textTransform: 'uppercase' }} />
        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, display: 'block' }}>
          Issues krijgen identifiers als {key || 'XXX'}-1, {key || 'XXX'}-2, ...
        </span>
      </Field>
      {error && (
        <div style={{
          padding: '8px 12px', borderRadius: 6, marginBottom: 12,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#FCA5A5', fontSize: 12,
        }}>{error}</div>
      )}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose} style={btnStyle('outline')}>Annuleer</button>
        <button onClick={submit} style={btnStyle('primary')}>Aanmaken</button>
      </div>
    </ModalOverlay>
  );
}

// ── Sidebar helpers ──
function SidebarSection({ title, action, children }: { title: string; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase',
        letterSpacing: '0.7px', padding: '10px 8px 4px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center',
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
      <span style={{ display: 'inline-flex', width: 14, justifyContent: 'center' }}>{left}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {right && <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{right}</span>}
    </button>
  );
}

// ── User menu ──
function UserMenu({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const h = () => setOpen(false);
    setTimeout(() => window.addEventListener('click', h, { once: true }), 0);
    return () => window.removeEventListener('click', h);
  }, [open]);
  const initials = me.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={e => { e.stopPropagation(); setOpen(!open); }} style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 999, padding: '4px 12px 4px 4px',
        display: 'inline-flex', alignItems: 'center', gap: 8,
        cursor: 'pointer', color: 'var(--text)', fontSize: 12, fontWeight: 600,
      }}>
        <span style={{
          width: 24, height: 24, borderRadius: '50%',
          background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: 10, letterSpacing: '0.3px',
        }}>{initials}</span>
        {me.name}
      </button>
      {open && (
        <div onClick={e => e.stopPropagation()} style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 8, minWidth: 220, padding: 6, zIndex: 50,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{me.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{me.email}</div>
            {me.role === 'admin' && (
              <span style={{
                display: 'inline-block', marginTop: 4, fontSize: 9,
                padding: '1px 6px', borderRadius: 4, fontWeight: 700, letterSpacing: '0.3px',
                background: 'var(--accent-glow)', color: 'var(--accent)', textTransform: 'uppercase',
              }}>Admin</span>
            )}
          </div>
          <Link href="/" style={menuItemStyle()}>← Landingspagina</Link>
          <button onClick={onLogout} style={{ ...menuItemStyle(), color: '#FCA5A5' }}>Uitloggen</button>
        </div>
      )}
    </div>
  );
}

function menuItemStyle(): React.CSSProperties {
  return {
    display: 'block', width: '100%', padding: '8px 10px',
    background: 'none', border: 'none', textAlign: 'left',
    color: 'var(--text)', fontSize: 13, cursor: 'pointer', borderRadius: 4,
    textDecoration: 'none',
  };
}

function StatLine({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <span>{label}</span><span style={{ color: color || 'var(--text-muted)' }}>{value}</span>
    </div>
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
          {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
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
function IssueDetail({ issue, me, projects, cycles, comments, links, allIssues, onUpdate, onAddComment, onAddLink, onClaim, onBranchName, onDelete, onClose }: {
  issue: Issue; me: Me | null; projects: Project[]; cycles: Cycle[];
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
  const [claimAs, setClaimAs] = useState(me?.name || 'agent');

  useEffect(() => {
    setTitle(issue.title); setDesc(issue.description);
    setCriteria(issue.acceptance_criteria); setBranch(issue.github_branch);
    setAssignee(issue.assignee);
  }, [issue]);

  const statusCfg = COLUMNS.find(c => c.status === issue.status);

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
          {statusCfg && <span style={{ color: statusCfg.color, display: 'inline-flex' }}><Icon name={statusCfg.icon} size={14} /></span>}
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'monospace', fontWeight: 600 }}>{issue.identifier}</span>
          <button onClick={() => setShowClaim(true)} style={btnStyle('outline-sm')}>
            <Icon name="check" size={11} /> <span style={{ marginLeft: 4 }}>Claim</span>
          </button>
          <button onClick={onBranchName} style={btnStyle('outline-sm')}>
            <Icon name="branch" size={11} /> <span style={{ marginLeft: 4 }}>Branch-naam</span>
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowDelete(true)} style={iconBtnStyle()}><Icon name="trash" size={14} /></button>
          <button onClick={onClose} style={iconBtnStyle()}><Icon name="close" size={14} /></button>
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
              fontSize: 18, fontWeight: 700, marginBottom: 16, cursor: 'pointer', letterSpacing: '-0.2px',
            }}>{issue.title}</h2>
          )}

          {/* Properties grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <Field label="Status">
              <select value={issue.status} onChange={e => onUpdate('status', e.target.value)} style={selectStyle()}>
                {COLUMNS.map(c => <option key={c.status} value={c.status}>{c.label}</option>)}
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
            <Field label="Prioriteit">
              <select value={issue.priority} onChange={e => onUpdate('priority', e.target.value)} style={selectStyle()}>
                {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
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
            <Field label="Estimate">
              <input type="number" value={issue.estimate ?? ''}
                onChange={e => onUpdate('estimate', e.target.value === '' ? null : Number(e.target.value))}
                style={selectStyle()} placeholder="story points"
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
              {issue.sub_issues.map(s => {
                const sCfg = COLUMNS.find(c => c.status === s.status);
                return (
                  <div key={s.id} style={rowStyle()}>
                    {sCfg && <span style={{ color: sCfg.color, display: 'inline-flex' }}><Icon name={sCfg.icon} size={12} /></span>}
                    <span style={monospaceStyle()}>{s.identifier}</span>
                    <span>{s.title}</span>
                  </div>
                );
              })}
            </Field>
          )}

          {/* Links */}
          <Field label={`Gekoppelde issues (${links.length})`} block action={
            <button onClick={() => setShowAddLink(!showAddLink)} style={btnStyle('outline-sm')}>
              <Icon name="link" size={11} /> <span style={{ marginLeft: 4 }}>Link</span>
            </button>
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
            {links.filter(l => l.from_issue_id === issue.id).map(l => {
              const tCfg = COLUMNS.find(c => c.status === l.to?.status);
              return (
                <div key={l.id} style={rowStyle()}>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{LINK_LABELS[l.link_type]}</span>
                  {tCfg && <span style={{ color: tCfg.color, display: 'inline-flex' }}><Icon name={tCfg.icon} size={11} /></span>}
                  <span style={monospaceStyle()}>{l.to?.identifier}</span>
                  <span>{l.to?.title}</span>
                </div>
              );
            })}
          </Field>

          {/* GitHub */}
          <Field label="GitHub" block>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="branch" size={13} style={{ color: 'var(--text-dim)' }} />
              <input value={branch}
                onChange={e => setBranch(e.target.value)}
                onBlur={() => onUpdate('github_branch', branch)}
                placeholder="iwan/up-42-titel-slug"
                style={{ ...selectStyle(), fontFamily: 'monospace', flex: 1 }}
              />
            </div>
            {issue.github_pr_url && (
              <a href={issue.github_pr_url} target="_blank" rel="noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                marginTop: 8, fontSize: 12, color: 'var(--accent)', textDecoration: 'none',
              }}>
                <Icon name="pr" size={12} /> PR #{issue.github_pr_number} bekijken
                <Icon name="arrow_right" size={11} />
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
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: commentColor(c.author),
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}>
                    <Icon name={authorIcon(c.author)} size={11} /> {c.author}
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
            <h3 style={modalH()}>Claim issue</h3>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
              Wie pakt deze issue op?
            </p>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {me && (
                <button onClick={() => setClaimAs(me.name)} style={{
                  ...btnStyle(claimAs === me.name ? 'primary' : 'outline'), flex: 1,
                }}>
                  <Icon name="user" size={11} /> <span style={{ marginLeft: 4 }}>Ik ({me.name})</span>
                </button>
              )}
              <button onClick={() => setClaimAs('agent')} style={{
                ...btnStyle(claimAs === 'agent' ? 'primary' : 'outline'), flex: 1,
              }}>
                <Icon name="agent" size={11} /> <span style={{ marginLeft: 4 }}>Agent</span>
              </button>
            </div>
            <input value={claimAs} onChange={e => setClaimAs(e.target.value)}
              placeholder="of een andere naam..."
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
function CyclesView({ cycles, issues, onCreate }: {
  cycles: Cycle[]; issues: Issue[]; onCreate: () => void;
}) {
  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.2px' }}>Cycles</h2>
        <button onClick={onCreate} style={btnStyle('primary')}>
          <Icon name="plus" size={11} /> <span style={{ marginLeft: 4 }}>Nieuwe cycle</span>
        </button>
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
              <Icon name="cycles" size={14} />
              <h3 style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{c.name}</h3>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
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
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, letterSpacing: '-0.2px' }}>Activity log</h2>
      {items.length === 0 && <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Geen activiteit nog.</p>}
      {items.map(a => (
        <div key={a.id} style={{
          padding: '8px 10px', borderRadius: 6, background: 'var(--bg-card)',
          borderLeft: `3px solid ${activityColor(a.type)}`, marginBottom: 4, fontSize: 12,
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: activityColor(a.type), display: 'inline-flex' }}>
              <Icon name={activityIcon(a.type)} size={12} />
            </span>
            <span style={{ fontWeight: 600 }}>{a.actor}</span>
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
      <h3 style={modalH()}>Nieuw project</h3>
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
            width: 22, height: 22, borderRadius: '50%', background: c,
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
      <h3 style={modalH()}>Nieuwe cycle</h3>
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
        <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>{label}</span>
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
    flex: 1, padding: '5px 8px', borderRadius: 4, border: '1px solid var(--border)',
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
    fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };
  if (variant === 'primary') return { ...base, border: 'none', background: 'var(--accent)', color: 'white' };
  if (variant === 'danger')  return { ...base, border: 'none', background: 'var(--red)', color: 'white' };
  return { ...base, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)' };
}
function iconBtnStyle(): React.CSSProperties {
  return {
    background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer',
    padding: 4, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };
}
function rowStyle(): React.CSSProperties {
  return {
    padding: '6px 10px', background: 'var(--bg-card)', borderRadius: 6,
    border: '1px solid var(--border)', marginBottom: 4, display: 'flex',
    alignItems: 'center', gap: 8, fontSize: 12,
  };
}
function monospaceStyle(): React.CSSProperties {
  return { fontFamily: 'monospace', color: 'var(--text-dim)', fontSize: 11 };
}
function modalH(): React.CSSProperties {
  return { fontSize: 15, fontWeight: 700, marginBottom: 14, letterSpacing: '-0.2px' };
}

// ── Helpers ──
function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' }); }
  catch { return s; }
}
function assigneeIcon(author: string): IconName {
  if (author === 'agent' || author.toLowerCase().includes('agent') || author.toLowerCase().includes('bot') || author.toLowerCase().includes('claude')) return 'agent';
  return 'user';
}
function commentColor(author: string) {
  if (author === 'agent' || author.startsWith('agent')) return 'var(--accent)';
  if (author.startsWith('github')) return '#A78BFA';
  return 'var(--green)';
}
function authorIcon(author: string): IconName {
  if (author === 'agent' || author.startsWith('agent')) return 'agent';
  if (author.startsWith('github')) return 'github';
  return 'user';
}
function activityColor(type: string) {
  if (type.startsWith('pr_')) return '#A78BFA';
  if (type === 'status_changed') return '#F59E0B';
  if (type === 'comment_added') return '#10B981';
  if (type === 'issue_created') return '#8B5CF6';
  if (type === 'branch_linked') return '#94A3B8';
  return '#6B7280';
}
function activityIcon(type: string): IconName {
  if (type === 'pr_opened' || type === 'pr_linked' || type === 'pr_merged' || type === 'pr_closed' || type === 'pr_review_requested') return 'pr';
  if (type === 'status_changed') return 'arrow_right';
  if (type === 'comment_added') return 'comment';
  if (type === 'issue_created') return 'plus';
  if (type === 'priority_changed') return 'priority_high';
  if (type === 'assignee_changed') return 'user';
  if (type === 'branch_linked') return 'branch';
  if (type === 'linked_issue_added') return 'link';
  return 'activity';
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
