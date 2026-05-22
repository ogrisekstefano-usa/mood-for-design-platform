/**
 * ProjectsPage — Design Journey™ project atelier.
 *
 * Lista progetti come "atelier editoriale", non come CRUD enterprise.
 * Ogni card mostra:
 *   • status glow + editorial state
 *   • title in italic Playfair
 *   • client + advisor
 *   • palette preview dai colori del brief
 *   • mood/material chips
 *   • timestamp narrativo
 *   • hover cinematic con CTA "Continua il viaggio"
 *
 * Plan-aware (limit/atCap).
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api, { formatError } from '../../lib/api';
import { useBlueprint, useTaxonomy } from '../../contexts/BlueprintContext';
import { useLocaleRuntime } from '../../contexts/LocaleRuntimeContext';
import { useLicense, refreshLicense } from '../../hooks/useLicense';
import UsageChip from '../../components/common/UsageChip';
import { toast } from 'sonner';
import { Plus, MapPin, Lock, Compass, ArrowUpRight, Layers } from 'lucide-react';
import './projects-page.css';

// ── Status TONE map (visual only; labels come from taxonomy registry) ──
// Editorial Italian labels live in /app/backend/taxonomy/__init__.py
// under `journey_lifecycle_studio` and are pulled at render time via
// useTaxonomy(). This keeps the tone here (visual concern) and the
// editorial vocabulary in the governance layer.
//
// Mapping: STATUS_TONE[backend_status] = { tone, taxonomy_key }
const STATUS_TONE = {
  new:                  { tone: 'cyan',    taxonomy_key: 'conversation_open' },
  in_review:            { tone: 'amber',   taxonomy_key: 'drifting' },
  brief_completed:      { tone: 'cyan',    taxonomy_key: 'in_progress' },
  proposal_in_progress: { tone: 'warm',    taxonomy_key: 'in_progress' },
  proposal_sent:        { tone: 'cyan',    taxonomy_key: 'presenting' },
  approved:             { tone: 'success', taxonomy_key: 'approved' },
  won:                  { tone: 'success', taxonomy_key: 'approved' },
  rejected:             { tone: 'rose',    taxonomy_key: 'abandoned' },
  lost:                 { tone: 'closed',  taxonomy_key: 'abandoned' },
  archived:             { tone: 'closed',  taxonomy_key: 'closed' },
};

// Helper: derive the editorial label for a project status. Used inside
// components that have access to the `t()` function (it() messages).
const labelForStatus = (status, t) => {
  const meta = STATUS_TONE[status];
  if (!meta) return status;
  return t(`taxonomy.journey_lifecycle_studio.${meta.taxonomy_key}`, null, status);
};
const toneForStatus = (status) => STATUS_TONE[status]?.tone || 'neutral';

// Color name → swatch hex (editorial palette). Maps the brief vocabulary
// (earth, olive, bronze, …) to subtle real swatches for the preview dots.
const PALETTE_SWATCH = {
  earth:     '#8a6a4a',
  olive:     '#7d8b56',
  bronze:    '#a07550',
  black:     '#1a1a1c',
  white:     '#ece8df',
  beige:     '#cdb999',
  gold:      '#c8a064',
  brass:     '#b08a4a',
  blue:      '#5a779e',
  navy:      '#2b3a55',
  teal:      '#508a8a',
  green:     '#5e7d5b',
  forest:    '#3b5042',
  cream:     '#e3d8be',
  charcoal:  '#3a3a3d',
  walnut:    '#6e4a30',
  oak:       '#a98660',
  marble:    '#dddad2',
  terracotta:'#b56b50',
  sand:      '#c9b58a',
  ivory:     '#ede2c8',
  warm:      '#d6b687',
  cool:      '#88a0a8',
  rust:      '#a35538',
  copper:    '#b0673a',
  pink:      '#d9a59d',
  rose:      '#c98a86',
  amber:     '#e0a258',
  glass:     '#bcd2d8',
  brick:     '#a06255',
  sage:      '#9aaa8c',
  stone:     '#b3aca0',
  smoke:     '#8b8e91',
  mocha:     '#7a5c45',
  fog:       '#bcbbb1',
};

const swatch = (name) => {
  const k = (name || '').toLowerCase();
  return PALETTE_SWATCH[k] || '#5a5a5a';
};

const formatRelative = (iso, t) => {
  if (!iso) return null;
  try {
    const ts = new Date(iso).getTime();
    const now = Date.now();
    const sec = Math.floor((now - ts) / 1000);
    if (sec < 60)         return t('common.time.moments_ago',  null, 'pochi istanti fa');
    if (sec < 3600)       return t('common.time.minutes_ago',  { n: Math.floor(sec / 60) },    '{n} min fa');
    if (sec < 86400)      return t('common.time.hours_ago',    { n: Math.floor(sec / 3600) },  '{n} ore fa');
    if (sec < 86400 * 7)  return t('common.time.days_ago',     { n: Math.floor(sec / 86400) }, '{n} giorni fa');
    return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  } catch { return null; }
};

// ── Editorial Project Card ───────────────────────────────────────
const ProjectCard = ({ project, index }) => {
  const { t } = useBlueprint();
  const tone = toneForStatus(project.status);
  const label = labelForStatus(project.status, t);
  const payload = project?.metadata_json?.onboarding_payload || {};
  const colors    = (payload.colors    || []).slice(0, 5);
  const moods     = (payload.moods     || []).slice(0, 2);
  const materials = (payload.materials || []).slice(0, 2);
  const clientName = (() => {
    const fn = payload.first_name;
    const ln = payload.last_name;
    if (fn || ln) return `${fn || ''} ${ln || ''}`.trim();
    return project.client_email || null;
  })();
  const updated = project.updated_at || project.created_at;

  return (
    <Link
      to={`/workspace/projects/${project.id}`}
      data-testid={`project-card-${index}`}
      className={`pcard pcard--${tone}`}
    >
      {/* Status glow rail */}
      <span aria-hidden="true" className="pcard__glow" />

      <div className="pcard__top">
        <span className="pcard__status" data-testid={`project-card-${index}-status`}>
          <span className="pcard__status-dot" />
          {label}
        </span>
        {project.project_type && (
          <span className="pcard__type">{project.project_type}</span>
        )}
      </div>

      <h3 className="pcard__title" data-testid={`project-card-${index}-title`}>
        <em>{project.title}</em>
      </h3>

      {clientName && (
        <p className="pcard__client">{t('projects.card.for_client', { name: clientName }, 'Per · {name}')}</p>
      )}

      {/* Palette preview — colored dots from the client brief */}
      {colors.length > 0 && (
        <div className="pcard__palette" data-testid={`project-card-${index}-palette`}>
          {colors.map((c, i) => (
            <span key={`${c}-${i}`}
                  className="pcard__swatch"
                  title={c}
                  style={{ backgroundColor: swatch(c) }} />
          ))}
        </div>
      )}

      {/* Mood + Material chips */}
      {(moods.length > 0 || materials.length > 0) && (
        <ul className="pcard__chips">
          {moods.map((m) => (
            <li key={`mood-${m}`} className="pcard__chip pcard__chip--mood">{m.replace(/_/g, ' ')}</li>
          ))}
          {materials.map((m) => (
            <li key={`mat-${m}`} className="pcard__chip pcard__chip--mat">{m}</li>
          ))}
        </ul>
      )}

      <div className="pcard__foot">
        <span className="pcard__time">
          {updated ? t('projects.card.last_movement', { when: formatRelative(updated, t) }, 'Ultimo movimento · {when}') : '\u00A0'}
        </span>
        <span className="pcard__cta">
          <Compass size={11} strokeWidth={1.4} />
          {t('projects.card.continue_journey', null, 'Continue the journey')}
          <ArrowUpRight size={11} strokeWidth={1.4} />
        </span>
      </div>
    </Link>
  );
};

// ── New Project Modal (preserved from previous version) ──────────
const NewProjectModal = ({ onClose, onSaved }) => {
  const { t, locale } = useBlueprint();
  const [form, setForm] = useState({ title: '', description: '', project_type: '', priority: 'normal', budget_range: '', timeline: '', language: locale });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/projects', form);
      refreshLicense();
      onSaved();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.code === 'LICENSE_LIMIT_REACHED') {
        toast.error(`Project limit reached (${detail.current}/${detail.limit}). Upgrade your ${detail.plan} plan to add more.`);
      } else {
        toast.error(formatError(err));
      }
    }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="new-project-modal">
      <div className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-md w-full max-w-lg animate-fadeIn">
        <div className="flex items-center justify-between p-6 border-b border-[var(--bp-border)]">
          <h3 className="font-heading text-xl text-[var(--bp-text-primary)]">{t('projects.newProject')}</h3>
          <button onClick={onClose} className="text-[var(--bp-text-subtle)] hover:text-[var(--bp-text-secondary)] text-lg">×</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--bp-text-muted)] font-body mb-1.5">{t('projects.field.title')}</label>
            <input required value={form.title} onChange={set('title')} className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[['project_type', 'projects.field.projectType'], ['budget_range', 'projects.field.budget'], ['timeline', 'projects.field.timeline'], ['priority', 'projects.field.priority']].map(([k, lk]) => (
              <div key={k}>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--bp-text-muted)] font-body mb-1.5">{t(lk)}</label>
                <input value={form[k]} onChange={set(k)} className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px]" />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--bp-text-muted)] font-body mb-1.5">{t('projects.field.description')}</label>
            <textarea rows={3} value={form.description} onChange={set('description')} className="input-luxury w-full px-3 py-2.5 text-sm font-body rounded-[3px] resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-[var(--bp-border-strong)] text-[var(--bp-text-secondary)] text-sm font-body rounded-[3px]">{t('common.cancel')}</button>
            <button data-testid="save-project-btn" type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-[var(--bp-primary)] hover:opacity-90 text-[var(--bp-bg)] font-semibold text-sm font-body rounded-[3px] disabled:opacity-50">
              {loading ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main page ────────────────────────────────────────────────────
const ProjectsPage = () => {
  const { t } = useBlueprint();
  const runtime = useLocaleRuntime();
  const navigate = useNavigate();
  const { capacityFor, license } = useLicense();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('');
  const [showModal, setShowModal] = useState(false);

  const cap = capacityFor('projects');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = tab ? `?status=${tab}` : '';
      const { data } = await api.get(`/api/projects${params}`);
      setProjects(data.data || []);
    } catch { setProjects([]); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const tabs = ['', 'new', 'in_review', 'proposal_sent', 'won', 'archived'];

  const onCta = () => {
    if (cap.atCap) navigate('/settings/plan');
    else setShowModal(true);
  };

  return (
    <div className="ppage" data-testid="projects-page">
      {showModal && <NewProjectModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}

      <header className="ppage__head">
        <div>
          <p className="ppage__eyebrow" data-testid="projects-page-eyebrow">
            {runtime.copy('projects.page.eyebrow') || 'Design Journey · Atelier'}
          </p>
          <h1 className="ppage__title" data-testid="projects-page-title">
            <em>{runtime.copy('projects.page.title') || 'I tuoi progetti'}</em>
          </h1>
          <p className="ppage__sub">{t('projects.count', { n: projects.length })}</p>
        </div>
        <div className="ppage__actions">
          {license && (
            <UsageChip label={t('projects.usage_label', null, 'Progetti')} current={cap.current} limit={cap.limit}
                       unlimited={cap.unlimited} atCap={cap.atCap} nearCap={cap.nearCap}
                       testid="projects-usage-chip" />
          )}
          <button data-testid="new-project-btn" onClick={onCta}
            className={`ppage__cta ${cap.atCap ? 'ppage__cta--lock' : ''}`}>
            {cap.atCap
              ? (<><Lock size={12} strokeWidth={1.8} /> {t('projects.actions.upgrade_for_more', null, 'Upgrade to create more')}</>)
              : (<><Plus size={14} strokeWidth={1.4} /> {runtime.copy('projects.new.cta') || t('projects.newProject', null, 'New project')}</>)}
          </button>
        </div>
      </header>

      <div className="ppage__tabs">
        {tabs.map((tk) => (
          <button key={tk || 'all'} data-testid={`tab-${tk || 'all'}`} onClick={() => setTab(tk)}
            className={`ppage__tab ${tab === tk ? 'is-active' : ''}`}>
            {tk ? labelForStatus(tk, t) : t('projects.tabs.all', null, 'All')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="ppage__grid">
          {[1, 2, 3].map(i => <div key={i} className="pcard pcard--skeleton" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="ppage__empty" data-testid="projects-empty">
          <Layers size={36} strokeWidth={1} />
          <h3 data-testid="projects-empty-title">
            {runtime.copy('projects.empty.title') || t('projects.empty.title', null, 'No design journey opened yet')}
          </h3>
          <p data-testid="projects-empty-subtitle">
            {runtime.copy('projects.empty.subtitle') || t('projects.empty.subtitle', null, 'Open the first chapter of your studio.')}
          </p>
          <button onClick={onCta} data-testid="projects-empty-cta" className="ppage__cta ppage__cta--ghost">
            {cap.atCap
              ? t('projects.actions.upgrade_plan', null, 'Upgrade plan')
              : t('projects.empty.open_first_journey', null, '+ Open the first journey')}
          </button>
        </div>
      ) : (
        <div className="ppage__grid">
          {projects.map((p, i) => <ProjectCard key={p.id} project={p} index={i} />)}
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
