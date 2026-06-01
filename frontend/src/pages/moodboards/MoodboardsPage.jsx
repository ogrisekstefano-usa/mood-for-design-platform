/**
 * MoodboardsPage — luxury list of all moodboards across projects. Plan-aware.
 * Pure Blueprint-driven (i18n via t(), tokens via CSS vars).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { useLicense, refreshLicense } from '../../hooks/useLicense';
import UsageChip from '../../components/common/UsageChip';
import { toast } from 'sonner';
import { Plus, Layers, X, Lock } from 'lucide-react';
import StatusBadge from '../../components/common/StatusBadge';
import TemplatePicker from '../../blueprint/moodboard/TemplatePicker';
import ArchiveBanner from '../../components/journey/ArchiveBanner';
import { avatarPalette } from '../../lib/avatarHue';
import './moodboards-atelier.css';
import '../journey/step-workspace.css';

// ─── Editorial status labels (atelier vocabulary) ───────────────
const MB_STATUS = {
  draft:              { label: 'Composizione aperta',  tone: 'warm'   },
  sent:               { label: 'Direzione condivisa',  tone: 'cyan'   },
  viewed:             { label: 'Cliente in lettura',   tone: 'cyan'   },
  approved:           { label: 'Direzione approvata',  tone: 'success'},
  revision_requested: { label: 'Revisione richiesta',  tone: 'amber'  },
  rejected:           { label: 'Da ripensare',         tone: 'rose'   },
};

// Color name → swatch (small map, reused for palette dots)
const SWATCH = {
  earth: '#8a6a4a', olive: '#7d8b56', bronze: '#a07550', black: '#1a1a1c',
  white: '#ece8df', beige: '#cdb999', gold: '#c8a064', brass: '#b08a4a',
  blue: '#5a779e', navy: '#3E322A', teal: '#508a8a', green: '#5e7d5b',
  forest: '#3b5042', cream: '#e3d8be', charcoal: '#3a3a3d', walnut: '#6e4a30',
  oak: '#a98660', marble: '#dddad2', terracotta: '#b56b50', sand: '#c9b58a',
  ivory: '#ede2c8', warm: '#d6b687', cool: '#88a0a8', rust: '#a35538',
  copper: '#b0673a', pink: '#d9a59d', rose: '#c98a86', amber: '#e0a258',
  sage: '#9aaa8c', stone: '#b3aca0', smoke: '#8b8e91', mocha: '#7a5c45',
};
const swatch = (n) => SWATCH[(n || '').toLowerCase()] || '#5a5a5a';

const formatRelative = (iso) => {
  if (!iso) return null;
  try {
    const t = new Date(iso).getTime();
    const sec = Math.floor((Date.now() - t) / 1000);
    if (sec < 60) return 'pochi istanti fa';
    if (sec < 3600) return `${Math.floor(sec / 60)} min fa`;
    if (sec < 86400) return `${Math.floor(sec / 3600)} ore fa`;
    if (sec < 86400 * 7) return `${Math.floor(sec / 86400)} giorni fa`;
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  } catch { return null; }
};

// ─── Atelier MoodboardCard — smart fallback composition ──────────
const MoodboardCard = ({ m, project }) => {
  const { t } = useBlueprint();
  const meta = MB_STATUS[m.status || 'draft'] || MB_STATUS.draft;
  const palettePal = project?.title ? avatarPalette(project.title) : null;
  // Pull palette from project brief if present (≤ 5)
  const payload = project?.metadata_json?.onboarding_payload || {};
  const colors    = (payload.colors    || []).slice(0, 5);
  const materials = (payload.materials || []).slice(0, 2);
  const atmosphere = payload.atmosphere || payload.emotional_tone || null;
  const coverUrl = m.cover_metadata?.thumb_url || m.cover_metadata?.image_url || null;

  // Build the gradient hero from the project's palette (or fallback to warm/cyan/pearl)
  const gradColors = colors.length
    ? colors.slice(0, 4).map(swatch)
    : ['#2a2418', '#1c1e25', '#0f1417'];
  const gradient = gradColors.length === 1
    ? `linear-gradient(135deg, ${gradColors[0]} 0%, #11141a 100%)`
    : `linear-gradient(135deg, ${gradColors.join(', ')})`;

  return (
    <Link
      to={`/moodboards/${m.id}`}
      data-testid={`moodboard-card-${m.id}`}
      className={`mbcard mbcard--${meta.tone}`}
    >
      {/* Smart hero: cover image OR generated composition */}
      <div className="mbcard__hero" aria-hidden="true">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            className="mbcard__hero-img"
            loading="lazy"
          />
        ) : (
          <>
            <div className="mbcard__hero-grad" style={{ background: gradient }} />
            {/* Decorative stripes from project palette */}
            <div className="mbcard__hero-strips">
              {gradColors.map((c, i) => (
                <span key={i} style={{ backgroundColor: c }} />
              ))}
            </div>
            {/* Editorial title floating over the gradient */}
            <div className="mbcard__hero-text">
              <em>{m.title || 'Composizione senza titolo'}</em>
            </div>
            {/* Diffused vignette */}
            <div className="mbcard__hero-fade" />
          </>
        )}

        <span className={`mbcard__pill mbcard__pill--${meta.tone}`}>
          <span className="mbcard__pill-dot" />
          {meta.label}
        </span>
      </div>

      {/* Body */}
      <div className="mbcard__body">
        <h3 className="mbcard__title"><em>{m.title || 'Composizione senza titolo'}</em></h3>

        {project && (
          <p className="mbcard__project">
            {palettePal && (
              <span className="mbcard__project-dot" style={{ background: palettePal.border }} aria-hidden />
            )}
            <span>Per · {project.title}</span>
          </p>
        )}

        {/* Atmosphere chip */}
        {atmosphere && (
          <p className="mbcard__atmo"><em>{atmosphere}</em></p>
        )}

        {/* Palette dots */}
        {colors.length > 0 && (
          <div className="mbcard__palette">
            {colors.map((c, i) => (
              <span key={`${c}-${i}`} className="mbcard__swatch"
                    title={c} style={{ backgroundColor: swatch(c) }} />
            ))}
          </div>
        )}

        {/* Material chips */}
        {materials.length > 0 && (
          <ul className="mbcard__chips">
            {materials.map((mat) => (
              <li key={mat} className="mbcard__chip">{mat}</li>
            ))}
          </ul>
        )}

        <div className="mbcard__foot">
          <span className="mbcard__time">
            {m.updated_at ? `Ultimo movimento · ${formatRelative(m.updated_at)}` : '\u00A0'}
          </span>
          <span className="mbcard__cta">{t('moodboards.moodboards.continua_la_direzione')}</span>
        </div>
      </div>
    </Link>
  );
};

const CreateModal = ({ projects, onClose, onCreate, t }) => {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [templateId, setTemplateId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError(t('moodboards.create.titleRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await onCreate({ title: title.trim(), project_id: projectId || null, template_id: templateId });
    } catch (err) {
      // Surface backend / network failures instead of silently stopping the spinner.
      const detail = err?.response?.data?.detail;
      const msg = err?.code === 'ECONNABORTED'
        ? t('moodboards.create.timeout')
        : (typeof detail === 'string' ? detail : err?.message) || t('moodboards.create.failed');
      setError(msg);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bp-overlay)] backdrop-blur-sm flex items-center justify-center p-4"
         onClick={onClose} data-testid="moodboard-create-modal">
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
            className="bp-glass w-full max-w-4xl p-7 rounded-[var(--bp-radius-md)] max-h-[88vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="bp-eyebrow !text-[var(--bp-text-muted)] mb-1">{t('moodboards.tab.title')}</p>
            <h3 className="bp-h2 text-[var(--bp-text-primary)]">{t('moodboards.create.title')}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-7 mb-6">
          <div>
            <label className="block mb-4">
              <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)] block mb-1.5">{t('moodboards.create.titleLabel')}</span>
              <input autoFocus value={title}
                     onChange={(e) => { setTitle(e.target.value); if (error) setError(null); }}
                     data-testid="moodboard-title-input"
                     placeholder={t('moodboards.create.titlePh')}
                     className={`input-luxury w-full px-3 py-2.5 text-sm rounded-[var(--bp-radius-sm)] ${error && !title.trim() ? 'ring-1 ring-red-400/60' : ''}`} />
              {error && (
                <p data-testid="moodboard-create-error"
                   className="bp-caption !text-[10px] !text-red-400 mt-1.5 leading-snug">
                  {error}
                </p>
              )}
            </label>
            <label className="block">
              <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)] block mb-1.5">{t('moodboards.create.projectLabel')}</span>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
                      data-testid="moodboard-project-select"
                      className="input-luxury w-full px-3 py-2.5 text-sm rounded-[var(--bp-radius-sm)]">
                <option value="">{t('moodboards.create.projectPh')}</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </label>
          </div>
          <TemplatePicker value={templateId} onChange={setTemplateId} />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="bp-btn bp-btn-ghost text-xs">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={submitting}
                  data-testid="moodboard-create-submit"
                  className="bp-btn bp-btn-primary text-xs disabled:opacity-50">
            {submitting ? t('common.loading') : t('moodboards.create.submit')}
          </button>
        </div>
      </form>
    </div>
  );
};

const MoodboardsPage = () => {
  const { t } = useBlueprint();
  const navigate = useNavigate();
  const { capacityFor, license } = useLicense();
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('');

  const cap = capacityFor('moodboards');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mbR, prR] = await Promise.all([
        api.get('/api/moodboards'),
        api.get('/api/projects'),
      ]);
      setItems(mbR.data?.data || []);
      setProjects(prR.data?.data || []);
    } catch (_) { /* ignore */ }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async ({ title, project_id, template_id }) => {
    try {
      // Template apply clones N pages + M blocks server-side and can blow past
      // the 30s default axios timeout for rich templates. Use a 90s window for
      // this specific call so the user never sees a phantom timeout.
      const r = template_id
        ? await api.post(`/api/templates/${template_id}/apply`, { title, project_id }, { timeout: 90000 })
        : await api.post('/api/moodboards', { title, project_id });
      refreshLicense();
      setShowCreate(false);
      navigate(`/moodboards/${r.data.id}`);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.code === 'LICENSE_LIMIT_REACHED') {
        toast.error(`Moodboard limit reached (${detail.current}/${detail.limit}). Upgrade your ${detail.plan} plan.`);
        setShowCreate(false);
        navigate('/settings/plan');
        return;
      }
      throw err;
    }
  };

  const onCta = () => {
    if (cap.atCap) navigate('/settings/plan');
    else setShowCreate(true);
  };

  const filtered = filter ? items.filter((m) => (m.status || 'draft') === filter) : items;
  const filters = ['', 'draft', 'sent', 'viewed', 'approved', 'revision_requested', 'rejected'];

  return (
    <div className="mb-page mood-atmospheric" data-testid="moodboards-page">
      <div className="mb-page__inner">
      <ArchiveBanner
        testid="moodboards-archive-banner"
        eyebrow={t('moodboards.archive.eyebrow', null, 'Cross-Journey archive · Sprint G.6')}
        title={t('moodboards.empty_inside_journey')}
        lede={t('moodboards.archive.lede', null,
          "This is an archive view that lets you rediscover moodboards composed across every Journey. True composition happens inside the Moodboard Direction™ chapter of each Journey.")}
        ctaLabel={t('moodboards.archive.cta', null, 'Open Blueprint Dashboard')}
        ctaTo="/dashboard"
      />
      <div className="flex items-start justify-between mb-10 gap-6">
        <div>
          <p className="mb-page__eyebrow">{t('moodboards.eyebrow', null, 'Design Journey · Creative Table')}</p>
          <h1 className="mb-page__title"><em>{t('moodboards.title')}</em></h1>
          <p className="mb-page__sub">{t('moodboards.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {license && (
            <UsageChip label="Moodboards" current={cap.current} limit={cap.limit}
                       unlimited={cap.unlimited} atCap={cap.atCap} nearCap={cap.nearCap}
                       testid="moodboards-usage-chip" />
          )}
          <button onClick={onCta}
                  data-testid="new-moodboard-btn"
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-body uppercase tracking-[0.18em] rounded-[var(--bp-radius-sm)] transition-all
                    ${cap.atCap
                      ? 'bg-[var(--bp-surface-2)] border border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] hover:border-[var(--bp-border-strong)]'
                      : 'bp-btn bp-btn-primary !uppercase !tracking-[0.18em]'}`}>
            {cap.atCap
              ? (<><Lock size={11} strokeWidth={1.8} /> Upgrade to create more</>)
              : (<><Plus size={13} strokeWidth={1.5} /> {t('moodboards.new')}</>)}
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-sm)] p-1 mb-8 w-fit">
        {filters.map((f) => (
          <button key={f || 'all'} onClick={() => setFilter(f)}
                  data-testid={`filter-${f || 'all'}`}
                  className={`px-3 py-1.5 text-xs font-body rounded-[var(--bp-radius-xs)] transition-colors ${
                    filter === f
                      ? 'bg-[var(--bp-surface-2)] text-[var(--bp-text-primary)]'
                      : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-secondary)]'
                  }`}>
            {t(`moodboards.filter.${f || 'all'}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="w-5 h-5 border-2 border-[var(--bp-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24" data-testid="moodboards-empty">
          <Layers size={36} className="text-[var(--bp-text-subtle)] mx-auto mb-5" strokeWidth={1} />
          <p className="bp-body text-[var(--bp-text-muted)] mb-4">{t('moodboards.empty')}</p>
          <button onClick={onCta} className="bp-btn bp-btn-ghost text-xs">
            {cap.atCap
              ? (<><Lock size={11} strokeWidth={1.5} /> Upgrade plan to create moodboards</>)
              : (<><Plus size={12} strokeWidth={1.5} /> {t('moodboards.emptyCta')}</>)}
          </button>
        </div>
      ) : (
        <div className="mb-atelier" data-testid="moodboards-atelier-grid">
          {filtered.map((m) => {
            const project = projects.find((p) => p.id === m.project_id);
            return <MoodboardCard key={m.id} m={m} project={project} />;
          })}
        </div>
      )}

      {showCreate && (
        <CreateModal projects={projects} t={t}
                     onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}
      </div>
    </div>
  );
};

export default MoodboardsPage;
