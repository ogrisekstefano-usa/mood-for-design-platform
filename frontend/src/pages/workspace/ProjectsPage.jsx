/**
 * ProjectsPage — Project Relationship Atlas™ (ITER149)
 *
 * Cinematic editorial grid. NOT a SaaS project list. Each card is a
 * "Relationship Project Surface™": hero photography, status pill, serif
 * client name, Used-In™ live numerals, palette strip, last movement.
 *
 * Architecture: DB-driven status taxonomy + editorial state groups +
 * Used-In™ live counters from backend (moodboards / proposals / memories).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api, { formatError } from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { useLicense, refreshLicense } from '../../hooks/useLicense';
import UsageChip from '../../components/common/UsageChip';
import { toast } from 'sonner';
import { Plus, Lock, Layers } from 'lucide-react';
import './projects-page.css';

// ── Editorial relationship STATES ─────────────────────────────────
// 5 atelier states pivoting many raw backend statuses. Each state
// passes a comma-joined `status=` query so the API can `.in_()` filter.
const EDITORIAL_STATES = [
  { key: '',                    i18n: 'projects.atlas.tab.all',       fallback: 'Tutti',                statuses: '' },
  { key: 'conversation_open',   i18n: 'projects.atlas.tab.open',      fallback: 'Conversazione aperta', statuses: 'new,brief_completed' },
  { key: 'in_review',           i18n: 'projects.atlas.tab.review',    fallback: 'In revisione',         statuses: 'in_review,proposal_in_progress' },
  { key: 'direction_presented', i18n: 'projects.atlas.tab.presented', fallback: 'Direzione presentata', statuses: 'proposal_sent' },
  { key: 'won',                 i18n: 'projects.atlas.tab.won',       fallback: 'Progetto vinto',       statuses: 'approved,won' },
  { key: 'archived',            i18n: 'projects.atlas.tab.archived',  fallback: 'Archivio firmato',     statuses: 'archived,lost,rejected' },
];

const STATUS_TO_EDITORIAL = {
  new: 'conversation_open',
  brief_completed: 'conversation_open',
  in_review: 'in_review',
  proposal_in_progress: 'in_review',
  proposal_sent: 'direction_presented',
  approved: 'won',
  won: 'won',
  archived: 'archived',
  lost: 'archived',
  rejected: 'archived',
};

const editorialLabel = (status, t) => {
  const key = STATUS_TO_EDITORIAL[status] || 'conversation_open';
  const state = EDITORIAL_STATES.find(s => s.key === key) || EDITORIAL_STATES[1];
  return t(state.i18n, null, state.fallback);
};

// ── Hero photography pool — deterministic per project id ──────────
const HERO_POOL = [
  'photo-1556909114-f6e7ad7d3136',
  'photo-1567538096630-e0c55bd6374c',
  'photo-1554995207-c18c203602cb',
  'photo-1556228720-195a672e8a03',
  'photo-1493663284031-b7e3aefcae8e',
  'photo-1505691938895-1758d7feb511',
  'photo-1565182999561-18d7dc61c393',
  'photo-1582268611958-ebfd161ef9cf',
  'photo-1616486338812-3dadae4b4ace',
];
const heroFor = (project) => {
  const explicit = project?.metadata_json?.hero_image_url;
  if (explicit) return explicit;
  const id = String(project?.id || '');
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return `https://images.unsplash.com/${HERO_POOL[hash % HERO_POOL.length]}?w=720&q=80&auto=format&fit=crop`;
};

// ── Palette swatch resolver — editorial color vocabulary ──────────
const PALETTE_SWATCH = {
  earth: '#8a6a4a', olive: '#7d8b56', bronze: '#a07550', black: '#1a1a1c',
  white: '#ece8df', beige: '#cdb999', gold: '#c8a064', brass: '#b08a4a',
  blue: '#5a779e', navy: '#3E322A', teal: '#508a8a', green: '#5e7d5b',
  forest: '#3b5042', cream: '#e3d8be', charcoal: '#3a3a3d', walnut: '#6e4a30',
  oak: '#a98660', marble: '#dddad2', terracotta: '#b56b50', sand: '#c9b58a',
  ivory: '#ede2c8', warm: '#d6b687', cool: '#88a0a8', rust: '#a35538',
  copper: '#b0673a', pink: '#d9a59d', rose: '#c98a86', amber: '#e0a258',
  glass: '#bcd2d8', brick: '#a06255', sage: '#9aaa8c', stone: '#b3aca0',
  smoke: '#8b8e91', mocha: '#7a5c45', fog: '#bcbbb1',
};
const swatch = (name) => PALETTE_SWATCH[(name || '').toLowerCase()] || '#5a5a5a';

// Deterministic fallback palette for projects without onboarding_payload.colors
const DEFAULT_PALETTE_POOL = [
  ['marble', 'walnut', 'beige', 'charcoal'],
  ['oak', 'cream', 'terracotta', 'stone'],
  ['warm', 'mocha', 'sand', 'ivory'],
  ['olive', 'cream', 'walnut', 'stone'],
];
const defaultPaletteFor = (project) => {
  const id = String(project?.id || '');
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return DEFAULT_PALETTE_POOL[hash % DEFAULT_PALETTE_POOL.length];
};

const formatRelative = (iso) => {
  if (!iso) return null;
  try {
    const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 60)        return 'pochi istanti fa';
    if (sec < 3600)      return `${Math.floor(sec / 60)} min fa`;
    if (sec < 86400)     return `${Math.floor(sec / 3600)} ore fa`;
    if (sec < 86400 * 7) return `${Math.floor(sec / 86400)} giorni fa`;
    return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  } catch { return null; }
};

// ── Editorial state label dictionary (IT) ───────────────────────
const EDITORIAL_LABEL_IT = {
  conversation_open:   'Conversazione aperta',
  in_review:           'In revisione',
  direction_presented: 'Direzione presentata',
  won:                 'Progetto vinto',
  archived:            'Archivio firmato',
};

// ── Used-In™ numeral pillar ─────────────────────────────────────
const UsedIn = ({ usedIn }) => (
  <div className="atlas-card__usedin" aria-label="Used in this relationship">
    <span className="atlas-card__usedin-eyebrow">USED-IN&trade;</span>
    <ul className="atlas-card__usedin-list">
      <li>
        <strong className="atlas-card__usedin-num">{usedIn.moodboards}</strong>
        <span className="atlas-card__usedin-label">moodboards</span>
      </li>
      <li>
        <strong className="atlas-card__usedin-num">{usedIn.proposals}</strong>
        <span className="atlas-card__usedin-label">proposte</span>
      </li>
      <li>
        <strong className="atlas-card__usedin-num">{usedIn.memories}</strong>
        <span className="atlas-card__usedin-label">memorie</span>
      </li>
    </ul>
  </div>
);

// ── Relationship Project Surface™ ───────────────────────────────
const ProjectCard = ({ project, index, featured }) => {
  const payload = project?.metadata_json?.onboarding_payload || {};
  const colorsRaw = (payload.colors || []).slice(0, 4);
  const colors = colorsRaw.length > 0 ? colorsRaw : defaultPaletteFor(project);
  const clientFirst = payload.first_name || project.client_first_name;
  // Strip "Conversazione di " / "Conversation with " prefix from title when
  // the project was auto-named by the onboarding flow.
  const stripPrefix = (s) =>
    String(s || '').replace(/^(conversazione di|conversation with|kunde|cliente)\s+/i, '').trim();
  const clientName = clientFirst || stripPrefix(project.title) ||
    (project.client_email ? project.client_email.split('@')[0] : '—');
  const updated = project.updated_at || project.created_at;
  const usedIn = project.used_in || { moodboards: 0, proposals: 0, memories: 0 };
  const editorialKey = STATUS_TO_EDITORIAL[project.status] || 'conversation_open';
  const hero = heroFor(project);
  const editorialPill = EDITORIAL_LABEL_IT[editorialKey] || 'Conversazione aperta';
  const rel = formatRelative(updated);

  return (
    <Link
      to={`/workspace/projects/${project.id}`}
      data-testid={`project-card-${index}`}
      className={`atlas-card atlas-card--${editorialKey} ${featured ? 'atlas-card--featured' : ''}`}
    >
      <div className="atlas-card__hero" aria-hidden="true">
        <img src={hero} alt="" loading="lazy" />
        <span className="atlas-card__hero-veil" />
      </div>

      <span className="atlas-card__status" data-testid={`project-card-${index}-status`}>
        <span className="atlas-card__status-dot" />
        {editorialPill}
      </span>

      <div className="atlas-card__title-block">
        <p className="atlas-card__title-eyebrow">Conversazione di</p>
        <h3 className="atlas-card__title" data-testid={`project-card-${index}-title`}>
          {clientName}
        </h3>
      </div>

      <UsedIn usedIn={usedIn} />

      <div className="atlas-card__palette" data-testid={`project-card-${index}-palette`}>
        {colors.map((c, i) => (
          <span key={`${c}-${i}`} className="atlas-card__swatch"
                style={{ backgroundColor: swatch(c) }} title={c} />
        ))}
      </div>

      <div className="atlas-card__foot">
        <span className="atlas-card__time">
          {rel && `Ultimo movimento · ${rel}`}
        </span>
      </div>
    </Link>
  );
};

// ── New Project Modal (preserved) ───────────────────────────────
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="new-project-modal">
      <div className="atelier-modal animate-fadeIn">
        <div className="atelier-modal__head">
          <h3 className="atelier-modal__title"><em>{t('projects.newProject')}</em></h3>
          <button onClick={onClose} className="atelier-modal__close" aria-label="Close">×</button>
        </div>
        <form onSubmit={submit} className="atelier-modal__body">
          <div className="atelier-field">
            <label className="atelier-field__label">{t('projects.field.title')}</label>
            <input required value={form.title} onChange={set('title')} className="atelier-field__input" />
          </div>
          <div className="atelier-field__grid">
            {[['project_type', 'projects.field.projectType'], ['budget_range', 'projects.field.budget'], ['timeline', 'projects.field.timeline'], ['priority', 'projects.field.priority']].map(([k, lk]) => (
              <div key={k} className="atelier-field">
                <label className="atelier-field__label">{t(lk)}</label>
                <input value={form[k]} onChange={set(k)} className="atelier-field__input" />
              </div>
            ))}
          </div>
          <div className="atelier-field">
            <label className="atelier-field__label">{t('projects.field.description')}</label>
            <textarea rows={3} value={form.description} onChange={set('description')} className="atelier-field__input atelier-field__input--area" />
          </div>
          <div className="atelier-modal__foot">
            <button type="button" onClick={onClose} className="ppage__cta ppage__cta--lock">{t('common.cancel')}</button>
            <button data-testid="save-project-btn" type="submit" disabled={loading} className="ppage__cta">
              {loading ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main · Project Relationship Atlas™ ──────────────────────────
const ProjectsPage = () => {
  const { t } = useBlueprint();
  const navigate = useNavigate();
  const { capacityFor, license } = useLicense();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stateKey, setStateKey] = useState('');
  const [showModal, setShowModal] = useState(false);

  const cap = capacityFor('projects');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const state = EDITORIAL_STATES.find(s => s.key === stateKey);
      const params = state && state.statuses ? `?status=${encodeURIComponent(state.statuses)}` : '';
      const { data } = await api.get(`/api/projects${params}`);
      setProjects(data.data || []);
    } catch { setProjects([]); }
    finally { setLoading(false); }
  }, [stateKey]);

  useEffect(() => { load(); }, [load]);

  const onCta = () => {
    if (cap.atCap) navigate('/settings/plan');
    else setShowModal(true);
  };

  return (
    <div className="atlas-page" data-testid="projects-page">
      {showModal && <NewProjectModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}

      <header className="atlas-page__head">
        <div>
          <p className="atlas-page__eyebrow" data-testid="projects-page-eyebrow">
            Studio
          </p>
          <h1 className="atlas-page__title" data-testid="projects-page-title">
            Progetti
          </h1>
          <p className="atlas-page__sub">
            {projects.length} {projects.length === 1 ? 'progetto' : 'progetti'}
          </p>
        </div>
        <div className="atlas-page__actions">
          {license && (
            <UsageChip label="Progetti" current={cap.current} limit={cap.limit}
                       unlimited={cap.unlimited} atCap={cap.atCap} nearCap={cap.nearCap}
                       testid="projects-usage-chip" />
          )}
          <button data-testid="new-project-btn" onClick={onCta}
            className={`atlas-page__cta ${cap.atCap ? 'is-locked' : ''}`}>
            {cap.atCap
              ? (<><Lock size={12} strokeWidth={1.8} /> Upgrade to create more</>)
              : (<><Plus size={14} strokeWidth={1.4} /> Nuovo progetto</>)}
          </button>
        </div>
      </header>

      <div className="atlas-page__tabs" role="tablist">
        {EDITORIAL_STATES.map((s) => (
          <button
            key={s.key || 'all'}
            data-testid={`tab-${s.key || 'all'}`}
            onClick={() => setStateKey(s.key)}
            className={`atlas-page__tab ${stateKey === s.key ? 'is-active' : ''}`}
            role="tab"
            aria-selected={stateKey === s.key}
          >
            {s.fallback}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="atlas-grid">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="atlas-card atlas-card--skeleton" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="atlas-page__empty" data-testid="projects-empty">
          <Layers size={36} strokeWidth={1} />
          <h3 data-testid="projects-empty-title">Nessuna relazione ancora.</h3>
          <p data-testid="projects-empty-subtitle">Avvia il primo progetto.</p>
          <button onClick={onCta} data-testid="projects-empty-cta" className="atlas-page__cta">
            {cap.atCap ? 'Upgrade plan' : '+ Apri la prima relazione'}
          </button>
        </div>
      ) : (
        <div className="atlas-grid" data-testid="projects-grid">
          {projects.map((p, i) => (
            <ProjectCard key={p.id} project={p} index={i} featured={false} />
          ))}
        </div>
      )}

      <footer className="atlas-page__manifesto">
        <em>"Ogni progetto è una relazione. Ogni relazione è un'opera in divenire."</em>
      </footer>
    </div>
  );
};

export default ProjectsPage;
