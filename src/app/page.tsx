'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ──
type IssueStatus = 'backlog' | 'planned' | 'in_progress' | 'done' | 'cancelled';
type IssuePriority = 'none' | 'low' | 'medium' | 'high' | 'urgent';

interface Project { id: string; name: string; description: string; color: string; }
interface Issue {
  id: string; identifier: string; project_id: string; title: string; description: string;
  status: IssueStatus; priority: IssuePriority; labels: string;
  acceptance_criteria: string; github_branch: string; github_pr_url: string;
  created_at: string; updated_at: string; completed_at: string | null;
}
interface Comment { id: string; issue_id: string; author: string; body: string; created_at: string; }

const COLUMNS: { status: IssueStatus; label: string; color: string; icon: string }[] = [
  { status: 'backlog',     label: 'Backlog',     color: '#6B7280', icon: '○' },
  { status: 'planned',     label: 'Planned',     color: '#8B5CF6', icon: '◐' },
  { status: 'in_progress', label: 'In Progress', color: '#F59E0B', icon: '◑' },
  { status: 'done',        label: 'Done',        color: '#10B981', icon: '●' },
];

const PRIORITIES: Record<IssuePriority, { label: string; icon: string; color: string }> = {
  none:   { label: 'Geen',   icon: '—',  color: '#6B7280' },
  low:    { label: 'Laag',   icon: '↓',  color: '#60A5FA' },
  medium: { label: 'Medium', icon: '→',  color: '#FBBF24' },
  high:   { label: 'Hoog',   icon: '↑',  color: '#FB923C' },
  urgent: { label: 'Urgent', icon: '⚡', color: '#EF4444' },
};

const PROJECT_COLORS = ['#8B5CF6','#10B981','#F59E0B','#60A5FA','#FB923C','#EF4444','#EC4899','#14B8A6','#F472B6','#A78BFA'];

// ── API helpers ──
const api = {
  get: (url: string) => fetch(url).then(r => r.json()),
  post: (url: string, body: any) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  patch: (url: string, body: any) => fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  del: (url: string) => fetch(url, { method: 'DELETE' }).then(r => r.json()),
};

export default function Board() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewIssue, setShowNewIssue] = useState<IssueStatus | null>(null);
  const [search, setSearch] = useState('');
  const [dragIssue, setDragIssue] = useState<string | null>(null);

  // ── Data loading ──
  const loadProjects = useCallback(() => api.get('/api/projects').then(setProjects), []);
  const loadIssues = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedProject) params.set('project_id', selectedProject);
    if (search) params.set('search', search);
    api.get(`/api/issues?${params}`).then(setIssues);
  }, [selectedProject, search]);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => { loadIssues(); }, [loadIssues]);

  // ── Issue detail ──
  const openIssue = async (issue: Issue) => {
    setSelectedIssue(issue);
    const c = await api.get(`/api/comments?issue_id=${issue.id}`);
    setComments(c);
  };

  const updateIssueField = async (id: string, field: string, value: any) => {
    const updated = await api.patch(`/api/issues?id=${id}`, { [field]: value });
    setIssues(prev => prev.map(i => i.id === id ? updated : i));
    if (selectedIssue?.id === id) setSelectedIssue(updated);
  };

  // ── Drag & drop ──
  const handleDrop = (status: IssueStatus) => {
    if (dragIssue) {
      updateIssueField(dragIssue, 'status', status);
      setDragIssue(null);
    }
  };

  // ── Filtered issues per column ──
  const issuesForColumn = (status: IssueStatus) =>
    issues.filter(i => i.status === status);

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: 260, borderRight: '1px solid var(--border)', background: 'var(--bg-surface)',
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

        {/* Project list */}
        <div style={{ padding: '4px 8px', flex: 1, overflowY: 'auto' }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase',
            letterSpacing: '0.5px', padding: '8px 8px 4px', display: 'flex', justifyContent: 'space-between',
          }}>
            <span>Projecten</span>
            <button onClick={() => setShowNewProject(true)} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1,
            }}>+</button>
          </div>

          {/* All projects button */}
          <button
            onClick={() => setSelectedProject(null)}
            style={{
              width: '100%', padding: '8px 8px', borderRadius: 6, border: 'none', textAlign: 'left',
              background: !selectedProject ? 'var(--accent-glow)' : 'transparent',
              color: !selectedProject ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer', fontSize: 13, fontWeight: 500, marginBottom: 2,
            }}
          >
            Alle projecten ({issues.length})
          </button>

          {projects.map(p => (
            <button key={p.id}
              onClick={() => setSelectedProject(p.id)}
              style={{
                width: '100%', padding: '8px 8px', borderRadius: 6, border: 'none', textAlign: 'left',
                background: selectedProject === p.id ? 'var(--accent-glow)' : 'transparent',
                color: selectedProject === p.id ? p.color : 'var(--text-muted)',
                cursor: 'pointer', fontSize: 13, fontWeight: 500, marginBottom: 2,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0,
              }} />
              {p.name}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)' }}>
                {issues.filter(i => i.project_id === p.id).length}
              </span>
            </button>
          ))}
        </div>

        {/* Stats */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-dim)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>Totaal issues</span><span style={{ color: 'var(--text-muted)' }}>{issues.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>In progress</span><span style={{ color: '#F59E0B' }}>{issues.filter(i=>i.status==='in_progress').length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Done</span><span style={{ color: '#10B981' }}>{issues.filter(i=>i.status==='done').length}</span>
          </div>
        </div>
      </aside>

      {/* ── Main board ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{
          padding: '16px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>
            {selectedProject ? projects.find(p => p.id === selectedProject)?.name || 'Board' : 'Alle issues'}
          </h1>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            API: <code style={{ color: 'var(--accent)', background: 'var(--accent-glow)', padding: '2px 6px', borderRadius: 4 }}>
              http://localhost:3400/api
            </code>
          </div>
        </header>

        {/* Kanban columns */}
        <div style={{
          flex: 1, display: 'flex', gap: 0, overflowX: 'auto', padding: '16px 12px',
        }}>
          {COLUMNS.map(col => {
            const colIssues = issuesForColumn(col.status);
            return (
              <div key={col.status}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = 'var(--bg-card)'; }}
                onDragLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                onDrop={e => { e.preventDefault(); e.currentTarget.style.background = 'transparent'; handleDrop(col.status); }}
                style={{
                  flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column',
                  borderRight: '1px solid var(--border)', padding: '0 8px',
                }}
              >
                {/* Column header */}
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
                  <button
                    onClick={() => setShowNewIssue(col.status)}
                    style={{
                      marginLeft: 'auto', background: 'none', border: 'none',
                      color: 'var(--text-dim)', cursor: 'pointer', fontSize: 18, lineHeight: 1,
                    }}
                  >+</button>
                </div>

                {/* Issue cards */}
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
                          border: '1px solid var(--border)', padding: '12px 14px',
                          marginBottom: 6, cursor: 'pointer',
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-hover)';
                          (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-card-hover)';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
                          (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-card)';
                        }}
                      >
                        {/* Priority + identifier */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <span style={{ color: pri.color, fontSize: 12, fontWeight: 600 }}>{pri.icon}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace' }}>{issue.identifier}</span>
                          {issue.github_branch && (
                            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)' }}>🔗</span>
                          )}
                        </div>
                        {/* Title */}
                        <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, marginBottom: 8 }}>{issue.title}</div>
                        {/* Footer: project + labels */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {proj && (
                            <span style={{
                              fontSize: 10, color: proj.color, background: `${proj.color}15`,
                              padding: '1px 6px', borderRadius: 4,
                            }}>{proj.name}</span>
                          )}
                          {labels.map((l, i) => (
                            <span key={i} style={{
                              fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg)',
                              padding: '1px 6px', borderRadius: 4,
                            }}>{l}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Inline new issue */}
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
      </main>

      {/* ── Issue detail modal ── */}
      {selectedIssue && (
        <IssueDetail
          issue={selectedIssue}
          project={projects.find(p => p.id === selectedIssue.project_id)}
          projects={projects}
          comments={comments}
          onUpdate={(field, value) => updateIssueField(selectedIssue.id, field, value)}
          onAddComment={async (body: string) => {
            await api.post('/api/comments', { issue_id: selectedIssue.id, body, author: 'user' });
            const c = await api.get(`/api/comments?issue_id=${selectedIssue.id}`);
            setComments(c);
          }}
          onDelete={async () => {
            await api.del(`/api/issues?id=${selectedIssue.id}`);
            setSelectedIssue(null); loadIssues();
          }}
          onClose={() => setSelectedIssue(null)}
        />
      )}

      {/* ── New project modal ── */}
      {showNewProject && (
        <NewProjectModal
          onCreated={() => { setShowNewProject(false); loadProjects(); }}
          onClose={() => setShowNewProject(false)}
        />
      )}
    </div>
  );
}

// ── Inline new issue form ──
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
        <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{
          flex: 1, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)',
          background: 'var(--bg)', color: 'var(--text)', fontSize: 11,
        }}>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={priority} onChange={e => setPriority(e.target.value as IssuePriority)} style={{
          padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)',
          background: 'var(--bg)', color: 'var(--text)', fontSize: 11,
        }}>
          {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{
          padding: '4px 12px', borderRadius: 4, border: '1px solid var(--border)',
          background: 'transparent', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer',
        }}>Annuleer</button>
        <button onClick={submit} style={{
          padding: '4px 12px', borderRadius: 4, border: 'none',
          background: 'var(--accent)', color: 'white', fontSize: 11, cursor: 'pointer', fontWeight: 600,
        }}>Toevoegen</button>
      </div>
    </div>
  );
}

// ── Issue detail panel ──
function IssueDetail({ issue, project, projects, comments, onUpdate, onAddComment, onDelete, onClose }: {
  issue: Issue; project?: Project; projects: Project[];
  comments: Comment[];
  onUpdate: (field: string, value: any) => void;
  onAddComment: (body: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [editTitle, setEditTitle] = useState(false);
  const [title, setTitle] = useState(issue.title);
  const [desc, setDesc] = useState(issue.description);
  const [criteria, setCriteria] = useState(issue.acceptance_criteria);
  const [branch, setBranch] = useState(issue.github_branch);
  const [commentText, setCommentText] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    setTitle(issue.title);
    setDesc(issue.description);
    setCriteria(issue.acceptance_criteria);
    setBranch(issue.github_branch);
  }, [issue]);

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'var(--bg-overlay)', zIndex: 100,
      }} />
      {/* Panel */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 560,
        background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)',
        zIndex: 101, display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'monospace' }}>{issue.identifier}</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowDelete(true)} style={{
            background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 12,
          }}>🗑</button>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18,
          }}>×</button>
        </div>

        <div style={{ padding: 20, flex: 1 }}>
          {/* Title */}
          {editTitle ? (
            <input value={title}
              onChange={e => setTitle(e.target.value)}
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

          {/* Status + Priority + Project row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Status</span>
              <select value={issue.status} onChange={e => onUpdate('status', e.target.value)} style={{
                padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'var(--bg-card)', color: 'var(--text)', fontSize: 12,
              }}>
                {COLUMNS.map(c => <option key={c.status} value={c.status}>{c.icon} {c.label}</option>)}
                <option value="cancelled">✕ Cancelled</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Prioriteit</span>
              <select value={issue.priority} onChange={e => onUpdate('priority', e.target.value)} style={{
                padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'var(--bg-card)', color: 'var(--text)', fontSize: 12,
              }}>
                {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Project</span>
              <select value={issue.project_id} onChange={e => onUpdate('project_id', e.target.value)} style={{
                padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'var(--bg-card)', color: 'var(--text)', fontSize: 12,
              }}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Beschrijving</span>
            <textarea value={desc}
              onChange={e => setDesc(e.target.value)}
              onBlur={() => onUpdate('description', desc)}
              placeholder="Beschrijf wat er gebouwd moet worden..."
              style={{
                width: '100%', minHeight: 80, padding: 12, borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg-card)',
                color: 'var(--text)', fontSize: 13, resize: 'vertical', outline: 'none',
                fontFamily: 'inherit', lineHeight: 1.5,
              }}
            />
          </div>

          {/* Acceptance criteria */}
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Acceptatiecriteria</span>
            <textarea value={criteria}
              onChange={e => setCriteria(e.target.value)}
              onBlur={() => onUpdate('acceptance_criteria', criteria)}
              placeholder="- [ ] Criteria 1&#10;- [ ] Criteria 2&#10;- [ ] Criteria 3"
              style={{
                width: '100%', minHeight: 60, padding: 12, borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg-card)',
                color: 'var(--text)', fontSize: 13, resize: 'vertical', outline: 'none',
                fontFamily: 'monospace', lineHeight: 1.5,
              }}
            />
          </div>

          {/* GitHub branch */}
          <div style={{ marginBottom: 24 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>GitHub Branch</span>
            <input value={branch}
              onChange={e => setBranch(e.target.value)}
              onBlur={() => onUpdate('github_branch', branch)}
              placeholder="feature/up-42-beschrijving"
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg-card)',
                color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'monospace',
              }}
            />
            {issue.github_pr_url && (
              <a href={issue.github_pr_url} target="_blank" rel="noreferrer" style={{
                display: 'inline-block', marginTop: 6, fontSize: 12, color: 'var(--accent)',
              }}>
                → Pull Request bekijken
              </a>
            )}
          </div>

          {/* Comments */}
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}>
              Activiteit ({comments.length})
            </span>
            {comments.map(c => (
              <div key={c.id} style={{
                padding: '10px 12px', borderRadius: 8, background: 'var(--bg-card)',
                marginBottom: 6, borderLeft: `3px solid ${c.author === 'agent' ? 'var(--accent)' : 'var(--green)'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: c.author === 'agent' ? 'var(--accent)' : 'var(--green)' }}>
                    {c.author === 'agent' ? '🤖 Agent' : '👤 ' + c.author}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    {new Date(c.created_at).toLocaleString('nl-NL')}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{c.body}</div>
              </div>
            ))}
            {/* New comment */}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && commentText.trim()) {
                    onAddComment(commentText.trim());
                    setCommentText('');
                  }
                }}
                placeholder="Schrijf een opmerking..."
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--bg-card)',
                  color: 'var(--text)', fontSize: 12, outline: 'none',
                }}
              />
              <button onClick={() => {
                if (commentText.trim()) { onAddComment(commentText.trim()); setCommentText(''); }
              }} style={{
                padding: '8px 14px', borderRadius: 8, border: 'none',
                background: 'var(--accent)', color: 'white', fontSize: 12, cursor: 'pointer',
              }}>Verstuur</button>
            </div>
          </div>
        </div>

        {/* Delete confirmation */}
        {showDelete && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
          }}>
            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 24, maxWidth: 320, textAlign: 'center',
            }}>
              <p style={{ fontSize: 14, marginBottom: 16 }}>Weet je zeker dat je <strong>{issue.identifier}</strong> wilt verwijderen?</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button onClick={() => setShowDelete(false)} style={{
                  padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                }}>Annuleer</button>
                <button onClick={onDelete} style={{
                  padding: '6px 16px', borderRadius: 6, border: 'none',
                  background: 'var(--red)', color: 'white', cursor: 'pointer',
                }}>Verwijder</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
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
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', zIndex: 100 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12,
        padding: 24, width: 400, zIndex: 101,
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Nieuw project</h3>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Project naam" autoFocus
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--bg-card)', color: 'var(--text)', fontSize: 14, outline: 'none', marginBottom: 12,
          }}
        />
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Beschrijving (optioneel)"
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--bg-card)', color: 'var(--text)', fontSize: 13, outline: 'none',
            minHeight: 60, resize: 'vertical', marginBottom: 12, fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {PROJECT_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} style={{
              width: 24, height: 24, borderRadius: '50%', background: c, border: color === c ? '2px solid white' : '2px solid transparent',
              cursor: 'pointer',
            }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
          }}>Annuleer</button>
          <button onClick={submit} style={{
            padding: '8px 16px', borderRadius: 6, border: 'none',
            background: 'var(--accent)', color: 'white', cursor: 'pointer', fontWeight: 600,
          }}>Aanmaken</button>
        </div>
      </div>
    </>
  );
}
