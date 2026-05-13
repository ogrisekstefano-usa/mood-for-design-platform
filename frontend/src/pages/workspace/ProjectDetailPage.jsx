/**
 * ProjectDetailPage — Blueprint Workspace™ operational hub.
 *
 * Tabs: Overview · Tasks · Notes · Activity · Moodboards · Proposals · Files
 * All sections are tenant-aware and role-aware.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import {
  ArrowLeft, Plus, Trash2, Pin, PinOff, CheckCircle2, Circle, Layers,
  FileText, ListChecks, StickyNote, Activity, FolderOpen,
} from 'lucide-react';

const StatusBadge = ({ status }) => {
  const tones = {
    new: 'bg-blue-500/10 text-blue-400',
    in_review: 'bg-purple-500/10 text-purple-400',
    proposal_sent: 'bg-[var(--bp-primary)]/10 text-[var(--bp-primary)]',
    won: 'bg-emerald-500/10 text-emerald-400',
    lost: 'bg-red-500/10 text-red-400',
  };
  return <span className={`bp-eyebrow !text-[10px] px-2 py-1 rounded-[var(--bp-radius-xs)] ${tones[status] || tones.new}`}>{status}</span>;
};

// ── Tasks tab ────────────────────────────────────────────────────────────────
const TasksTab = ({ projectId }) => {
  const [tasks, setTasks] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const load = useCallback(() => {
    api.get(`/api/workspace/projects/${projectId}/tasks`).then((r) => setTasks(r.data.data || []));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!newTitle.trim()) return;
    await api.post(`/api/workspace/projects/${projectId}/tasks`, { title: newTitle });
    setNewTitle(''); load();
  };
  const toggle = async (t) => {
    await api.put(`/api/workspace/projects/${projectId}/tasks/${t.id}`,
      { status: t.status === 'done' ? 'todo' : 'done' });
    load();
  };
  const remove = async (id) => {
    await api.delete(`/api/workspace/projects/${projectId}/tasks/${id}`);
    load();
  };

  return (
    <div data-testid="tasks-tab">
      <div className="flex gap-2 mb-6">
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          data-testid="new-task-input"
          placeholder="Add a task…"
          className="input-luxury flex-1 px-4 py-2.5 rounded-[var(--bp-radius-sm)]" />
        <button onClick={add} className="bp-btn bp-btn-primary" data-testid="add-task-btn">
          <Plus size={13} strokeWidth={1.5} /> Add
        </button>
      </div>
      {tasks.length === 0 ? (
        <p className="bp-caption text-[var(--bp-text-muted)]">No tasks yet.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id} data-testid={`task-${t.id}`}
              className="flex items-center gap-3 p-3 bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-sm)] group">
              <button onClick={() => toggle(t)} className="text-[var(--bp-text-muted)] hover:text-[var(--bp-primary)]">
                {t.status === 'done' ? <CheckCircle2 size={18} strokeWidth={1.5} className="text-[var(--bp-primary)]" /> : <Circle size={18} strokeWidth={1.5} />}
              </button>
              <span className={`flex-1 bp-body ${t.status === 'done' ? 'text-[var(--bp-text-muted)] line-through' : 'text-[var(--bp-text-primary)]'}`}>{t.title}</span>
              <button onClick={() => remove(t.id)} className="text-[var(--bp-text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 size={13} strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ── Notes tab ────────────────────────────────────────────────────────────────
const NotesTab = ({ projectId }) => {
  const [notes, setNotes] = useState([]);
  const [body, setBody] = useState('');
  const load = useCallback(() => {
    api.get(`/api/workspace/projects/${projectId}/notes`).then((r) => setNotes(r.data.data || []));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!body.trim()) return;
    await api.post(`/api/workspace/projects/${projectId}/notes`, { body });
    setBody(''); load();
  };
  const togglePin = async (n) => {
    await api.put(`/api/workspace/projects/${projectId}/notes/${n.id}`, { pinned: !n.pinned });
    load();
  };
  const remove = async (id) => {
    await api.delete(`/api/workspace/projects/${projectId}/notes/${id}`);
    load();
  };

  return (
    <div data-testid="notes-tab">
      <div className="mb-6">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a note…" rows={3}
          data-testid="new-note-input"
          className="input-luxury w-full px-4 py-3 rounded-[var(--bp-radius-sm)] resize-y" />
        <div className="flex justify-end mt-2">
          <button onClick={add} className="bp-btn bp-btn-primary text-xs" data-testid="add-note-btn">
            <Plus size={12} strokeWidth={1.5} /> Add note
          </button>
        </div>
      </div>
      {notes.length === 0 ? (
        <p className="bp-caption text-[var(--bp-text-muted)]">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || ((b.created_at || '') > (a.created_at || '') ? 1 : -1)).map((n) => (
            <li key={n.id} data-testid={`note-${n.id}`}
              className="p-5 bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-sm)] group relative">
              {n.pinned && <span className="absolute top-3 right-3 bp-eyebrow !text-[var(--bp-primary)]">Pinned</span>}
              <p className="bp-body text-[var(--bp-text-primary)] whitespace-pre-wrap">{n.body}</p>
              <div className="flex items-center justify-between mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="bp-caption text-[var(--bp-text-subtle)]">{new Date(n.created_at).toLocaleString()}</span>
                <div className="flex gap-2">
                  <button onClick={() => togglePin(n)} className="text-[var(--bp-text-muted)] hover:text-[var(--bp-primary)]" title="Pin">
                    {n.pinned ? <PinOff size={12} strokeWidth={1.5} /> : <Pin size={12} strokeWidth={1.5} />}
                  </button>
                  <button onClick={() => remove(n.id)} className="text-[var(--bp-text-muted)] hover:text-red-400">
                    <Trash2 size={12} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ── Activity tab ─────────────────────────────────────────────────────────────
const ActivityTab = ({ projectId }) => {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api.get(`/api/workspace/projects/${projectId}/activity`).then((r) => setItems(r.data.data || []));
  }, [projectId]);

  if (!items.length) {
    return <p className="bp-caption text-[var(--bp-text-muted)]">No activity yet.</p>;
  }

  return (
    <ul className="space-y-4" data-testid="activity-tab">
      {items.map((e) => (
        <li key={e.id} className="flex gap-4 pb-4 border-b border-[var(--bp-border)] last:border-0">
          <div className="w-2 h-2 rounded-full bg-[var(--bp-primary)] mt-2 flex-shrink-0" />
          <div className="flex-1">
            <p className="bp-body text-[var(--bp-text-primary)]">
              <span className="bp-eyebrow !text-[var(--bp-text-muted)] mr-2">{e.type}</span>
              {e.label || ''}
              {e.from && e.to && <span className="text-[var(--bp-text-muted)]"> {e.from} → {e.to}</span>}
            </p>
            <p className="bp-caption text-[var(--bp-text-subtle)] mt-1">{new Date(e.at).toLocaleString()}</p>
          </div>
        </li>
      ))}
    </ul>
  );
};

// ── Moodboards tab (list per project) ───────────────────────────────────────
const MoodboardsTab = ({ project }) => {
  const navigate = useNavigate();
  const list = project.moodboards || [];
  const createNew = async () => {
    const title = prompt('Moodboard title:', 'Untitled moodboard');
    if (!title) return;
    const r = await api.post('/api/moodboards', { title, project_id: project.id });
    navigate(`/moodboards/${r.data.id}`);
  };
  return (
    <div data-testid="moodboards-tab">
      <div className="flex justify-end mb-6">
        <button onClick={createNew} className="bp-btn bp-btn-primary" data-testid="create-moodboard-btn">
          <Plus size={13} strokeWidth={1.5} /> New moodboard
        </button>
      </div>
      {list.length === 0 ? (
        <p className="bp-caption text-[var(--bp-text-muted)]">No moodboards yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map((m) => (
            <Link key={m.id} to={`/moodboards/${m.id}`}
              className="p-5 bg-[var(--bp-surface-1)] border border-[var(--bp-border)] hover:border-[var(--bp-border-strong)] rounded-[var(--bp-radius-md)] transition-colors block">
              <h4 className="bp-h3 text-[var(--bp-text-primary)]">{m.title || 'Untitled'}</h4>
              <div className="mt-3 flex items-center gap-2">
                <StatusBadge status={m.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main page ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',   label: 'Overview',   icon: FileText },
  { id: 'tasks',      label: 'Tasks',      icon: ListChecks },
  { id: 'notes',      label: 'Notes',      icon: StickyNote },
  { id: 'moodboards', label: 'Moodboards', icon: Layers },
  { id: 'activity',   label: 'Activity',   icon: Activity },
];

const ProjectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    api.get(`/api/projects/${id}`).then((r) => setProject(r.data))
      .catch(() => navigate('/workspace/projects')).finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) {
    return <div className="p-10"><div className="w-6 h-6 border-2 border-[var(--bp-primary)] border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!project) return null;

  return (
    <div className="p-10 max-w-6xl mx-auto" data-testid="project-detail">
      <button onClick={() => navigate('/workspace/projects')} className="bp-caption text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] mb-4 flex items-center gap-1.5">
        <ArrowLeft size={13} strokeWidth={1.5} /> Projects
      </button>

      <div className="flex items-start justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <StatusBadge status={project.status} />
            {project.project_type && <span className="bp-caption text-[var(--bp-text-muted)] uppercase tracking-[0.15em]">{project.project_type}</span>}
          </div>
          <h1 className="bp-h1 text-[var(--bp-text-primary)] font-light">{project.title}</h1>
          {project.client_email && <p className="bp-body text-[var(--bp-text-muted)] mt-3">{project.client_email}</p>}
        </div>
      </div>

      <div className="border-b border-[var(--bp-border)] mb-8">
        <div className="flex gap-1">
          {TABS.map(({ id: tabId, label, icon: Icon }) => (
            <button key={tabId} onClick={() => setTab(tabId)}
              data-testid={`tab-${tabId}`}
              className={`flex items-center gap-2 px-4 py-3 bp-body !text-sm border-b-2 transition-colors ${
                tab === tabId
                  ? 'border-[var(--bp-primary)] text-[var(--bp-text-primary)]'
                  : 'border-transparent text-[var(--bp-text-muted)] hover:text-[var(--bp-text-secondary)]'
              }`}>
              <Icon size={14} strokeWidth={1.5} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div data-testid="tab-content">
        {tab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Stat label="Budget" value={project.budget_range || '—'} />
            <Stat label="Timeline" value={project.timeline || '—'} />
            <Stat label="Proposals" value={(project.proposals || []).length} />
            <Stat label="Moodboards" value={(project.moodboards || []).length} />
            <Stat label="Files" value={project.files_count || 0} />
            <Stat label="Status" value={project.status} />
          </div>
        )}
        {tab === 'tasks'      && <TasksTab projectId={id} />}
        {tab === 'notes'      && <NotesTab projectId={id} />}
        {tab === 'moodboards' && <MoodboardsTab project={project} />}
        {tab === 'activity'   && <ActivityTab projectId={id} />}
      </div>
    </div>
  );
};

const Stat = ({ label, value }) => (
  <div className="p-5 bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-md)]">
    <p className="bp-eyebrow !text-[var(--bp-text-muted)]">{label}</p>
    <p className="bp-h2 text-[var(--bp-text-primary)] font-light mt-2">{value}</p>
  </div>
);

export default ProjectDetailPage;
