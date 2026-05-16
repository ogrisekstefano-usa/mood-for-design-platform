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
import StatusBadge from '../../components/common/StatusBadge';
import TemplatePicker from '../../blueprint/moodboard/TemplatePicker';

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
  const [templateId, setTemplateId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const r = templateId
        ? await api.post(`/api/templates/${templateId}/apply`, { title: title.trim(), project_id: projectId })
        : await api.post('/api/moodboards', { title: title.trim(), project_id: projectId });
      onCreated(r.data);
    } finally { setSubmitting(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-[var(--bp-overlay)] backdrop-blur-sm flex items-center justify-center p-4"
         onClick={onClose} data-testid="project-moodboard-modal">
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
            className="bp-glass w-full max-w-4xl p-7 rounded-[var(--bp-radius-md)] max-h-[88vh] overflow-y-auto">
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
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-7 mb-6">
          <label className="block">
            <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)] block mb-1.5">
              {t('moodboards.create.titleLabel')}
            </span>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
                   data-testid="project-moodboard-title"
                   placeholder={t('moodboards.create.titlePh')}
                   className="input-luxury w-full px-3 py-2.5 text-sm rounded-[var(--bp-radius-sm)]" />
          </label>
          <TemplatePicker value={templateId} onChange={setTemplateId} />
        </div>
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

// ── Tab components (P0.6 — 8 tabs spec) ─────────────────────────────────────

// Cinematic empty/stub state used by tabs that wrap existing or future workflows
const TabStub = ({ icon: Icon = FileText, eyebrow, title, body, ctaLabel, ctaTo, testid }) => (
  <div data-testid={testid || 'tab-stub'} className="py-16 px-8 text-center">
    <div className="w-12 h-12 rounded-[3px] mx-auto mb-5 flex items-center justify-center
                    border border-[var(--bp-border)] bg-[var(--bp-surface-1)]">
      <Icon size={18} strokeWidth={1.2} className="text-[var(--bp-text-muted)]" />
    </div>
    {eyebrow && (
      <p className="text-[10px] tracking-[0.28em] uppercase text-[var(--bp-primary)] font-body mb-3">{eyebrow}</p>
    )}
    <h3 className="font-heading text-[22px] font-light text-[var(--bp-text-primary)] mb-3 max-w-md mx-auto leading-tight">
      {title}
    </h3>
    <p className="text-[13px] text-[var(--bp-text-secondary)] font-body max-w-lg mx-auto leading-relaxed">
      {body}
    </p>
    {ctaTo && ctaLabel && (
      <Link to={ctaTo} className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-[var(--bp-primary)]
                                  text-[var(--bp-primary-foreground,#0F0F10)] text-[10.5px] uppercase tracking-[0.22em]">
        {ctaLabel}
      </Link>
    )}
  </div>
);

const MARKETS = [
  { code: 'IT', label: 'Italia' },
  { code: 'US', label: 'Stati Uniti' },
  { code: 'FR', label: 'Francia' },
  { code: 'DE', label: 'Germania' },
  { code: 'UK', label: 'Regno Unito' },
  { code: 'UAE', label: 'Emirati Arabi' },
  { code: 'ES', label: 'Spagna' },
];

// ── AI Studio Brief™ tab (THE P0.6 differentiator) ──────────────────────────
const AIStudioBriefTab = ({ projectId, project, t }) => {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [market, setMarket] = useState((project?.metadata_json?.country || 'IT').toUpperCase());
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.get(`/api/projects/${projectId}/ai-brief`);
      setBrief(r.data?.brief || null);
    } catch (e) { setError('Caricamento brief non riuscito.'); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setGenerating(true); setError(null);
    try {
      const r = await api.post(`/api/projects/${projectId}/ai-brief/generate`, { market, locale: 'it' });
      setBrief(r.data?.brief || null);
    } catch (e) {
      setError('Generazione brief non riuscita. Riprova fra qualche istante.');
    } finally { setGenerating(false); }
  };

  if (loading) {
    return (
      <div data-testid="ai-brief-loading" className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bp-card p-7 animate-pulse">
            <div className="h-3 w-32 bg-[var(--bp-surface-2)] mb-4" />
            <div className="h-4 w-3/4 bg-[var(--bp-surface-2)] mb-2" />
            <div className="h-4 w-2/3 bg-[var(--bp-surface-2)]" />
          </div>
        ))}
      </div>
    );
  }

  if (!brief) {
    return (
      <div data-testid="ai-brief-empty" className="bp-card p-12 text-center">
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--bp-primary)] font-body mb-4">
          AI Studio Brief™
        </p>
        <h3 className="font-heading text-[28px] font-light text-[var(--bp-text-primary)] mb-3 max-w-lg mx-auto leading-tight">
          Un memo strategico di direzione progettuale.
        </h3>
        <p className="text-[13.5px] text-[var(--bp-text-secondary)] font-body max-w-xl mx-auto leading-relaxed mb-8">
          L'AI legge il contesto reale del progetto — cliente, mercato, ispirazioni salvate, materiali,
          identità dell'advisor — e scrive una direzione editoriale in sei sezioni. Non è una chat: è un
          documento di posizionamento curato.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap mb-2">
          <label className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body">
            Mercato
          </label>
          <select value={market} onChange={(e) => setMarket(e.target.value)}
                  data-testid="ai-brief-market-select"
                  className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] text-[12px] px-3 py-2
                             text-[var(--bp-text-primary)] font-body">
            {MARKETS.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
          </select>
          <button onClick={generate} disabled={generating}
                  data-testid="ai-brief-generate-btn"
                  className="bp-btn bp-btn-primary text-[10.5px] uppercase tracking-[0.22em]">
            {generating ? 'Genero brief…' : 'Genera brief'}
          </button>
        </div>
        {error && <p className="text-[12px] text-red-400 mt-3">{error}</p>}
      </div>
    );
  }

  const s = brief.sections || {};
  const sectionDef = [
    { key: 'direction',              title: 'Direzione progettuale',     eye: '01 — DIREZIONE' },
    { key: 'material_language',      title: 'Linguaggio materico',       eye: '02 — MATERIA' },
    { key: 'emotional_positioning',  title: 'Posizionamento emotivo',    eye: '03 — EMOZIONE' },
    { key: 'market_adaptation',      title: 'Adattamento al mercato',    eye: '04 — MERCATO' },
    { key: 'design_risks',           title: 'Tensioni e rischi',         eye: '05 — TENSIONI' },
  ];

  return (
    <div data-testid="ai-brief-content" className="space-y-6">
      {/* Brief headline + meta */}
      <header className="bp-card p-7">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--bp-primary)] font-body mb-3">
              AI Studio Brief™ · Mercato {brief.market || 'IT'}
            </p>
            <h2 className="font-heading text-[28px] font-light text-[var(--bp-text-primary)] leading-[1.1]">
              {s.headline || 'Direzione progettuale'}
            </h2>
            <p className="mt-3 text-[11px] text-[var(--bp-text-muted)] font-body">
              Generato {fmtRelative(brief.created_at)} · {brief.model === 'fallback' ? 'modalità manuale' : 'Claude Sonnet 4.5'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select value={market} onChange={(e) => setMarket(e.target.value)}
                    className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] text-[11px] px-3 py-2 text-[var(--bp-text-secondary)] font-body">
              {MARKETS.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
            </select>
            <button onClick={generate} disabled={generating}
                    data-testid="ai-brief-regenerate"
                    className="bp-btn bp-btn-ghost text-[10px] uppercase tracking-[0.22em] inline-flex items-center gap-1.5">
              <Icons.RefreshCw size={11} strokeWidth={1.6}
                className={generating ? 'animate-spin' : ''} />
              {generating ? 'In corso…' : 'Aggiorna brief'}
            </button>
          </div>
        </div>
        {error && <p className="text-[12px] text-red-400 mt-3">{error}</p>}
      </header>

      {/* 5 long-form sections */}
      {sectionDef.map(({ key, title, eye }) => (
        <article key={key} data-testid={`ai-brief-section-${key}`} className="bp-card p-7">
          <p className="text-[10px] tracking-[0.32em] uppercase text-[var(--bp-text-muted)] font-body mb-3">
            {eye}
          </p>
          <h3 className="font-heading text-[20px] font-light text-[var(--bp-text-primary)] mb-4 leading-tight">
            {title}
          </h3>
          <p className="text-[14.5px] text-[var(--bp-text-secondary)] font-body leading-[1.7] whitespace-pre-line">
            {s[key] || '—'}
          </p>
        </article>
      ))}

      {/* Next moves — actionable list */}
      {(s.next_moves || []).length > 0 && (
        <article data-testid="ai-brief-section-next_moves" className="bp-card p-7">
          <p className="text-[10px] tracking-[0.32em] uppercase text-[var(--bp-text-muted)] font-body mb-3">
            06 — PROSSIME MOSSE
          </p>
          <h3 className="font-heading text-[20px] font-light text-[var(--bp-text-primary)] mb-5 leading-tight">
            Prossimi passi suggeriti
          </h3>
          <ul className="space-y-3">
            {s.next_moves.map((mv, i) => (
              <li key={i} className="flex gap-4 items-start">
                <span className="shrink-0 w-7 h-7 rounded-[2px] bg-[var(--bp-primary-soft)] text-[var(--bp-primary)]
                                 text-[11px] font-medium flex items-center justify-center tabular-nums">
                  {i + 1}
                </span>
                <p className="text-[14px] text-[var(--bp-text-primary)] font-body leading-[1.65] pt-0.5">
                  {mv}
                </p>
              </li>
            ))}
          </ul>
        </article>
      )}
    </div>
  );
};

// ── Main page ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',      icon: FileText,    label: 'Overview' },
  { id: 'inspirations',  icon: Bookmark,    label: 'Ispirazioni' },
  { id: 'moodboards',    icon: Layers,      label: 'Moodboard' },
  { id: 'materials',     icon: Boxes,       label: 'Materiali' },
  { id: 'proposals',     icon: FileText,    label: 'Proposte' },
  { id: 'conversations', icon: MessageSquare, label: 'Conversazioni' },
  { id: 'timeline',      icon: Activity,    label: 'Timeline' },
  { id: 'ai_brief',      icon: Sparkles,    label: 'AI Studio Brief™' },
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

        {/* Human Relationship Layer — assigned designer card */}
        {project.assigned_designer && (
          <div data-testid="assigned-designer-card"
               className="flex items-center gap-4 bg-[var(--bp-surface-1)] border border-[var(--bp-border)] px-5 py-4 min-w-[280px]">
            {project.assigned_designer.avatar_url && (
              <img
                src={project.assigned_designer.avatar_url}
                alt={project.assigned_designer.first_name}
                className="w-12 h-12 rounded-full object-cover"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-primary)] font-body font-semibold mb-0.5">
                {t('workspace.followed_by') || 'Followed by'}
              </p>
              <p className="font-heading text-[var(--bp-text-primary)] text-base truncate">
                {project.assigned_designer.first_name} {project.assigned_designer.last_name || ''}
              </p>
              {project.assigned_designer.role_label && (
                <p className="text-[var(--bp-text-muted)] text-xs font-body truncate">
                  {typeof project.assigned_designer.role_label === 'string'
                    ? project.assigned_designer.role_label
                    : (project.assigned_designer.role_label._default || '')}
                </p>
              )}
              <div className="flex items-center gap-1.5 mt-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    project.assigned_designer.online_status === 'available' ? 'bg-emerald-500' :
                    project.assigned_designer.online_status === 'away'      ? 'bg-amber-500'   :
                    'bg-zinc-500'
                  }`}
                />
                <span className="text-[10px] font-body uppercase tracking-[0.15em] text-[var(--bp-text-subtle)]">
                  {project.assigned_designer.online_status || 'offline'}
                </span>
              </div>
            </div>
          </div>
        )}
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
