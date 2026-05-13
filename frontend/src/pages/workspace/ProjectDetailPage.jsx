/**
 * ProjectDetailPage — Blueprint Workspace™ operational hub.
 *
 * Tabs: Overview · Tasks · Notes · Moodboards · Activity
 * Fully Blueprint-driven: every label, status & button text via t().
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import {
  ArrowLeft, Plus, Trash2, Pin, PinOff, CheckCircle2, Circle, Layers,
  FileText, ListChecks, StickyNote, Activity, X,
} from 'lucide-react';

const StatusBadge = ({ status, t, kind = 'projects' }) => {
  const tones = {
    new:              'bg-blue-500/10 text-blue-400',
    in_review:        'bg-purple-500/10 text-purple-400',
    brief_completed:  'bg-cyan-500/10 text-cyan-400',
    proposal_in_progress: 'bg-amber-500/10 text-amber-400',
    proposal_sent:    'bg-[var(--bp-primary)]/10 text-[var(--bp-primary)]',
    revision_requested: 'bg-orange-500/10 text-orange-400',
    approved:         'bg-emerald-500/10 text-emerald-400',
    rejected:         'bg-red-500/10 text-red-400',
    won:              'bg-emerald-500/10 text-emerald-400',
    lost:             'bg-red-500/10 text-red-400',
    archived:         'bg-white/5 text-[var(--bp-text-muted)]',
    draft:            'bg-[var(--bp-surface-2)] text-[var(--bp-text-muted)]',
  };
  const key = status || 'new';
  return (
    <span className={`bp-eyebrow !text-[10px] px-2 py-1 rounded-[var(--bp-radius-xs)] ${tones[key] || tones.new}`}>
      {t(`${kind}.status.${key}`)}
    </span>
  );
};

// ── Tasks tab ────────────────────────────────────────────────────────────────
const TasksTab = ({ projectId, t }) => {
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
  const toggle = async (tk) => {
    await api.put(`/api/workspace/projects/${projectId}/tasks/${tk.id}`,
      { status: tk.status === 'done' ? 'todo' : 'done' });
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
               placeholder={t('workspace.tasks.placeholder')}
               className="input-luxury flex-1 px-4 py-2.5 rounded-[var(--bp-radius-sm)]" />
        <button onClick={add} className="bp-btn bp-btn-primary" data-testid="add-task-btn">
          <Plus size={13} strokeWidth={1.5} /> {t('workspace.tasks.add')}
        </button>
      </div>
      {tasks.length === 0 ? (
        <p className="bp-caption text-[var(--bp-text-muted)]">{t('workspace.tasks.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((tk) => (
            <li key={tk.id} data-testid={`task-${tk.id}`}
                className="flex items-center gap-3 p-3 bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-sm)] group">
              <button onClick={() => toggle(tk)} className="text-[var(--bp-text-muted)] hover:text-[var(--bp-primary)]"
                      data-testid={`toggle-task-${tk.id}`}>
                {tk.status === 'done'
                  ? <CheckCircle2 size={18} strokeWidth={1.5} className="text-[var(--bp-primary)]" />
                  : <Circle size={18} strokeWidth={1.5} />}
              </button>
              <span className={`flex-1 bp-body ${tk.status === 'done' ? 'text-[var(--bp-text-muted)] line-through' : 'text-[var(--bp-text-primary)]'}`}>
                {tk.title}
              </span>
              <button onClick={() => remove(tk.id)}
                      className="text-[var(--bp-text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
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
const NotesTab = ({ projectId, t }) => {
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
        <textarea value={body} onChange={(e) => setBody(e.target.value)}
                  placeholder={t('workspace.notes.placeholder')} rows={3}
                  data-testid="new-note-input"
                  className="input-luxury w-full px-4 py-3 rounded-[var(--bp-radius-sm)] resize-y" />
        <div className="flex justify-end mt-2">
          <button onClick={add} className="bp-btn bp-btn-primary text-xs" data-testid="add-note-btn">
            <Plus size={12} strokeWidth={1.5} /> {t('workspace.notes.add')}
          </button>
        </div>
      </div>
      {notes.length === 0 ? (
        <p className="bp-caption text-[var(--bp-text-muted)]">{t('workspace.notes.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {notes.slice().sort((a, b) =>
            (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
            || ((b.created_at || '').localeCompare(a.created_at || ''))
          ).map((n) => (
            <li key={n.id} data-testid={`note-${n.id}`}
                className="p-5 bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-sm)] group relative">
              {n.pinned && <span className="absolute top-3 right-3 bp-eyebrow !text-[var(--bp-primary)]">
                {t('workspace.notes.pinned')}
              </span>}
              <p className="bp-body text-[var(--bp-text-primary)] whitespace-pre-wrap">{n.body}</p>
              <div className="flex items-center justify-between mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="bp-caption text-[var(--bp-text-subtle)]">
                  {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => togglePin(n)} className="text-[var(--bp-text-muted)] hover:text-[var(--bp-primary)]">
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
const ActivityTab = ({ projectId, t }) => {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api.get(`/api/workspace/projects/${projectId}/activity`).then((r) => setItems(r.data.data || []));
  }, [projectId]);

  if (!items.length) {
    return <p className="bp-caption text-[var(--bp-text-muted)]" data-testid="activity-empty">{t('workspace.activity.empty')}</p>;
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
            <p className="bp-caption text-[var(--bp-text-subtle)] mt-1">
              {e.at ? new Date(e.at).toLocaleString() : ''}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
};

// ── Create-moodboard modal (luxury) ─────────────────────────────────────────
const CreateMoodboardModal = ({ projectId, onClose, onCreated, t }) => {
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const r = await api.post('/api/moodboards', { title: title.trim(), project_id: projectId });
      onCreated(r.data);
    } finally { setSubmitting(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-[var(--bp-overlay)] backdrop-blur-sm flex items-center justify-center p-4"
         onClick={onClose} data-testid="project-moodboard-modal">
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
            className="bp-glass w-full max-w-md p-7 rounded-[var(--bp-radius-md)]">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="bp-eyebrow !text-[var(--bp-text-muted)] mb-1">{t('moodboards.tab.title')}</p>
            <h3 className="bp-h2 text-[var(--bp-text-primary)]">{t('moodboards.create.title')}</h3>
          </div>
          <button type="button" onClick={onClose}
                  className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        <label className="block mb-6">
          <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)] block mb-1.5">
            {t('moodboards.create.titleLabel')}
          </span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
                 data-testid="project-moodboard-title"
                 placeholder={t('moodboards.create.titlePh')}
                 className="input-luxury w-full px-3 py-2.5 text-sm rounded-[var(--bp-radius-sm)]" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="bp-btn bp-btn-ghost text-xs">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={!title.trim() || submitting}
                  data-testid="project-moodboard-submit"
                  className="bp-btn bp-btn-primary text-xs disabled:opacity-50">
            {submitting ? t('common.loading') : t('moodboards.create.submit')}
          </button>
        </div>
      </form>
    </div>
  );
};

// ── Moodboards tab (list per project) ───────────────────────────────────────
const MoodboardsTab = ({ project, t }) => {
  const navigate = useNavigate();
  const [list, setList] = useState(project.moodboards || []);
  const [showCreate, setShowCreate] = useState(false);

  const onCreated = (mb) => {
    setList((l) => [mb, ...l]);
    setShowCreate(false);
    navigate(`/moodboards/${mb.id}`);
  };

  return (
    <div data-testid="moodboards-tab">
      <div className="flex justify-end mb-6">
        <button onClick={() => setShowCreate(true)} className="bp-btn bp-btn-primary" data-testid="create-moodboard-btn">
          <Plus size={13} strokeWidth={1.5} /> {t('moodboards.new')}
        </button>
      </div>
      {list.length === 0 ? (
        <p className="bp-caption text-[var(--bp-text-muted)]">{t('workspace.moodboards.empty')}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map((m) => (
            <Link key={m.id} to={`/moodboards/${m.id}`}
                  data-testid={`project-moodboard-${m.id}`}
                  className="p-5 bg-[var(--bp-surface-1)] border border-[var(--bp-border)] hover:border-[var(--bp-border-strong)] rounded-[var(--bp-radius-md)] transition-colors block">
              <h4 className="bp-h3 text-[var(--bp-text-primary)]">{m.title || t('moodboards.untitled')}</h4>
              <div className="mt-3 flex items-center gap-2">
                <StatusBadge status={m.status} t={t} kind="moodboards" />
              </div>
            </Link>
          ))}
        </div>
      )}
      {showCreate && (
        <CreateMoodboardModal projectId={project.id} t={t}
                              onClose={() => setShowCreate(false)} onCreated={onCreated} />
      )}
    </div>
  );
};

// ── Main page ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',   icon: FileText },
  { id: 'tasks',      icon: ListChecks },
  { id: 'notes',      icon: StickyNote },
  { id: 'moodboards', icon: Layers },
  { id: 'activity',   icon: Activity },
];

const Stat = ({ label, value }) => (
  <div className="p-5 bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-md)]">
    <p className="bp-eyebrow !text-[var(--bp-text-muted)]">{label}</p>
    <p className="bp-h2 text-[var(--bp-text-primary)] font-light mt-2">{value}</p>
  </div>
);

const ProjectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useBlueprint();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    api.get(`/api/projects/${id}`).then((r) => setProject(r.data))
      .catch(() => navigate('/workspace/projects')).finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--bp-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!project) return null;

  return (
    <div className="p-10 max-w-6xl mx-auto" data-testid="project-detail">
      <button onClick={() => navigate('/workspace/projects')}
              className="bp-caption text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] mb-4 flex items-center gap-1.5">
        <ArrowLeft size={13} strokeWidth={1.5} /> {t('workspace.back.projects')}
      </button>

      <div className="flex items-start justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <StatusBadge status={project.status} t={t} kind="projects" />
            {project.project_type && (
              <span className="bp-caption text-[var(--bp-text-muted)] uppercase tracking-[0.15em]">
                {project.project_type}
              </span>
            )}
          </div>
          <h1 className="bp-h1 text-[var(--bp-text-primary)] font-light">{project.title}</h1>
          {project.client_email && <p className="bp-body text-[var(--bp-text-muted)] mt-3">{project.client_email}</p>}
        </div>
      </div>

      <div className="border-b border-[var(--bp-border)] mb-8">
        <div className="flex gap-1">
          {TABS.map(({ id: tabId, icon: Icon }) => (
            <button key={tabId} onClick={() => setTab(tabId)}
                    data-testid={`tab-${tabId}`}
                    className={`flex items-center gap-2 px-4 py-3 bp-body !text-sm border-b-2 transition-colors ${
                      tab === tabId
                        ? 'border-[var(--bp-primary)] text-[var(--bp-text-primary)]'
                        : 'border-transparent text-[var(--bp-text-muted)] hover:text-[var(--bp-text-secondary)]'
                    }`}>
              <Icon size={14} strokeWidth={1.5} /> {t(`workspace.tab.${tabId}`)}
            </button>
          ))}
        </div>
      </div>

      <div data-testid="tab-content">
        {tab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Stat label={t('workspace.stat.budget')}     value={project.budget_range || '—'} />
            <Stat label={t('workspace.stat.timeline')}   value={project.timeline || '—'} />
            <Stat label={t('workspace.stat.proposals')}  value={(project.proposals || []).length} />
            <Stat label={t('workspace.stat.moodboards')} value={(project.moodboards || []).length} />
            <Stat label={t('workspace.stat.files')}      value={project.files_count || 0} />
            <Stat label={t('workspace.stat.status')}     value={t(`projects.status.${project.status || 'new'}`)} />
          </div>
        )}
        {tab === 'tasks'      && <TasksTab projectId={id} t={t} />}
        {tab === 'notes'      && <NotesTab projectId={id} t={t} />}
        {tab === 'moodboards' && <MoodboardsTab project={project} t={t} />}
        {tab === 'activity'   && <ActivityTab projectId={id} t={t} />}
      </div>
    </div>
  );
};

export default ProjectDetailPage;
