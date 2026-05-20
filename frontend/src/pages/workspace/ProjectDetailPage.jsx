/**
 * ProjectDetailPage — Blueprint Workspace™ operational hub.
 *
 * 7-tab architecture (P0.6.A + P0.6.B + Strategic Direction™ refactor):
 *   Overview · Inspirations · Moodboards · Materials · Proposals ·
 *   Conversations · Timeline
 *
 * Strategic Direction™ lives INSIDE Overview as a contextual section —
 * not a standalone tab. It is the strategic brain of the project,
 * positioned right below the advisor identity. Tab state persisted via
 * `?tab=` query param. All tabs are real, hydrated, tenant-isolated.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import {
  ArrowLeft, Plus, Layers, FileText, Activity, X, Bookmark, Boxes,
  MessageSquare, RefreshCw, ExternalLink, Quote, ChevronRight,
  History, FileSignature, Share2,
} from 'lucide-react';
import StatusBadge from '../../components/common/StatusBadge';
import TemplatePicker from '../../blueprint/moodboard/TemplatePicker';
import { ComposeProposalWizard } from '../../components/proposals/ComposeProposalWizard';
import DesignJourneyTab from './DesignJourneyTab';
import { Compass } from 'lucide-react';

// ── Time util ────────────────────────────────────────────────────────────────
const fmtRelative = (iso) => {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!t) return '';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'pochi secondi fa';
  const m = Math.floor(s / 60); if (m < 60) return `${m} min fa`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} h fa`;
  const d = Math.floor(h / 24); if (d < 7) return `${d} g fa`;
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ── Cinematic primitives ─────────────────────────────────────────────────────
const Skeleton = ({ rows = 3 }) => (
  <div className="space-y-4" data-testid="tab-skeleton">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="bp-card p-7 animate-pulse">
        <div className="h-3 w-32 bg-[var(--bp-surface-2)] mb-4" />
        <div className="h-4 w-3/4 bg-[var(--bp-surface-2)] mb-2" />
        <div className="h-4 w-2/3 bg-[var(--bp-surface-2)]" />
      </div>
    ))}
  </div>
);

const EmptyState = ({ icon: Icon = FileText, eyebrow, title, body, ctaLabel, ctaTo, testid }) => (
  <div data-testid={testid || 'tab-empty'} className="bp-card py-16 px-8 text-center">
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
      <Link to={ctaTo}
            className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-[var(--bp-primary)]
                       text-[var(--bp-primary-foreground,#0F0F10)] text-[10.5px] uppercase tracking-[0.22em]">
        {ctaLabel} <ChevronRight size={12} strokeWidth={1.5} />
      </Link>
    )}
  </div>
);

const ErrorRetry = ({ message, onRetry, testid }) => (
  <div data-testid={testid || 'tab-error'} className="bp-card p-10 text-center">
    <p className="text-[12px] text-red-300 font-body mb-4">{message}</p>
    <button onClick={onRetry} className="bp-btn bp-btn-ghost text-[10.5px] uppercase tracking-[0.22em]">
      <RefreshCw size={11} strokeWidth={1.6} /> Riprova
    </button>
  </div>
);

// ── Tab: Moodboards (kept, lightly refactored) ──────────────────────────────
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
        <EmptyState
          icon={Layers}
          testid="moodboards-empty"
          eyebrow="Moodboard"
          title="Il primo moodboard nasce da un'ispirazione."
          body="Crea un moodboard vuoto o parti da un template. Le ispirazioni salvate dal Magazine si integreranno automaticamente."
        />
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

// ── Tab: Inspirations (P0.6.B.1) ────────────────────────────────────────────
const InspirationsTab = ({ projectId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.get(`/api/projects/${projectId}/inspirations`);
      setData(r.data);
    } catch (e) { setError('Caricamento ispirazioni non riuscito.'); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Skeleton rows={3} />;
  if (error)   return <ErrorRetry message={error} onRetry={load} />;
  if (!data || data.total === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        testid="inspirations-empty"
        eyebrow="Ispirazioni · Design References™"
        title="Nessuna ispirazione ancora salvata per questo progetto."
        body="I clienti e gli advisor salvano riferimenti dagli articoli del Magazine. Ogni hotspot toccato diventa un seme per il moodboard. Apri il Magazine per iniziare la conversazione visiva."
        ctaLabel="Apri Magazine"
        ctaTo="/magazine"
      />
    );
  }

  return (
    <div data-testid="inspirations-tab" className="space-y-10">
      {data.clusters.map((cluster) => (
        <section key={cluster.key} data-testid={`inspirations-cluster-${cluster.key}`}>
          <div className="flex items-baseline justify-between mb-5 pb-3 border-b border-[var(--bp-border)]">
            <div>
              <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--bp-primary)] font-body mb-1.5">
                Cluster · Atmosfera
              </p>
              <h3 className="font-heading text-[22px] font-light text-[var(--bp-text-primary)] leading-tight">
                {cluster.label}
              </h3>
            </div>
            <span className="text-[11px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body">
              {cluster.count} riferiment{cluster.count === 1 ? 'o' : 'i'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {cluster.items.map((it) => (
              <InspirationCard key={it.id} item={it} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

const InspirationCard = ({ item }) => {
  const cover = item.article?.cover_url;
  return (
    <article data-testid={`inspiration-${item.id}`}
             className="group bg-[var(--bp-surface-1)] border border-[var(--bp-border)]
                        hover:border-[var(--bp-border-strong)] transition-colors overflow-hidden">
      <div className="relative aspect-[4/3] bg-[var(--bp-surface-2)] overflow-hidden">
        {cover ? (
          <img src={cover} alt={item.label}
               className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Bookmark size={20} strokeWidth={1.2} className="text-[var(--bp-text-muted)]" />
          </div>
        )}
        {/* Hotspot label overlay */}
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/75 to-transparent">
          <p className="text-[10px] tracking-[0.28em] uppercase text-white/80 font-body mb-0.5">
            {item.reference_type === 'material' ? 'Materia'
             : item.reference_type === 'fabric' ? 'Tessuto'
             : item.reference_type === 'lighting' ? 'Luce'
             : 'Hotspot'}
          </p>
          <p className="text-[13px] text-white font-body leading-tight line-clamp-1">
            {item.label}
          </p>
        </div>
      </div>
      <div className="p-4">
        {item.atmosphere_tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {item.atmosphere_tags.slice(0, 4).map((tag, i) => (
              <span key={i} className="text-[9.5px] uppercase tracking-[0.18em] px-2 py-1
                                       border border-[var(--bp-border)] text-[var(--bp-text-secondary)] font-body">
                {tag}
              </span>
            ))}
          </div>
        )}
        {item.description && (
          <p className="text-[12.5px] text-[var(--bp-text-secondary)] font-body leading-relaxed line-clamp-2 mb-3">
            {item.description}
          </p>
        )}
        {item.article && (
          <Link to={item.article.slug ? `/magazine/${item.article.slug}` : '#'}
                className="flex items-center gap-1.5 text-[11px] text-[var(--bp-text-muted)]
                           hover:text-[var(--bp-primary)] font-body">
            <span className="truncate">Da {item.article.title}</span>
            <ExternalLink size={11} strokeWidth={1.5} />
          </Link>
        )}
        {item.advisor_note && (
          <div className="mt-3 pt-3 border-t border-[var(--bp-border)]">
            <div className="flex gap-2">
              <Quote size={11} strokeWidth={1.6} className="text-[var(--bp-primary)] shrink-0 mt-0.5" />
              <p className="text-[12px] text-[var(--bp-text-primary)] font-body italic leading-relaxed">
                {item.advisor_note}
              </p>
            </div>
          </div>
        )}
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--bp-text-subtle)] font-body mt-3">
          Salvato {fmtRelative(item.saved_at)}
        </p>
      </div>
    </article>
  );
};

// ── Tab: Materials (P0.6.B.4) ───────────────────────────────────────────────
const MaterialsTab = ({ projectId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.get(`/api/projects/${projectId}/materials`);
      setData(r.data);
    } catch (e) { setError('Caricamento materiali non riuscito.'); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Skeleton rows={2} />;
  if (error)   return <ErrorRetry message={error} onRetry={load} />;
  if (!data || data.total === 0) {
    return (
      <EmptyState
        icon={Boxes}
        testid="materials-empty"
        eyebrow="Materiali"
        title="Nessun materiale collegato a questo progetto."
        body="Aggiungi materiali dall'archivio per dare corpo alla direzione progettuale: palette, finitura, atmosfera tattile vengono salvati con il loro contesto."
        ctaLabel="Apri archivio materiali"
        ctaTo="/library/materials"
      />
    );
  }

  return (
    <div data-testid="materials-tab" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {data.items.map((m) => (
        <article key={m.id} data-testid={`material-${m.id}`}
                 className="group bg-[var(--bp-surface-1)] border border-[var(--bp-border)]
                            hover:border-[var(--bp-border-strong)] transition-colors overflow-hidden">
          {m.cover_url && (
            <div className="aspect-[5/4] bg-[var(--bp-surface-2)] overflow-hidden">
              <img src={m.cover_url} alt={m.name}
                   className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
            </div>
          )}
          <div className="p-5">
            <p className="text-[10px] tracking-[0.28em] uppercase text-[var(--bp-text-muted)] font-body mb-2">
              {m.category || 'Materiale'}{m.finish ? ` · ${m.finish}` : ''}
            </p>
            <h4 className="font-heading text-[18px] font-light text-[var(--bp-text-primary)] leading-tight mb-3">
              {m.name || 'Senza nome'}
            </h4>
            {(m.dominant_color || m.atmosphere_tags?.length > 0) && (
              <div className="flex items-center gap-2 mb-3">
                {m.dominant_color && (
                  <span className="w-5 h-5 rounded-full border border-[var(--bp-border)] shrink-0"
                        style={{ backgroundColor: m.dominant_color }} title={m.dominant_color} />
                )}
                {m.atmosphere_tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.atmosphere_tags.slice(0, 3).map((tag, i) => (
                      <span key={i} className="text-[9.5px] uppercase tracking-[0.18em] px-2 py-1
                                               border border-[var(--bp-border)] text-[var(--bp-text-secondary)] font-body">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {m.tactile_descriptors?.length > 0 && (
              <p className="text-[12px] italic text-[var(--bp-text-secondary)] font-body leading-relaxed mb-3">
                {m.tactile_descriptors.slice(0, 3).join(' · ')}
              </p>
            )}
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-[var(--bp-text-subtle)] font-body pt-3 border-t border-[var(--bp-border)]">
              {m.related_articles_count > 0 && (
                <span>{m.related_articles_count} editorial{m.related_articles_count === 1 ? 'e' : 'i'}</span>
              )}
              {m.related_moodboards_count > 0 && (
                <span>{m.related_moodboards_count} moodboard</span>
              )}
              {m.supplier && <span className="ml-auto truncate max-w-[40%]">{m.supplier}</span>}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
};

// ── Tab: Proposals (P0.6.B.5) ───────────────────────────────────────────────
const ProposalsTab = ({ projectId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.get(`/api/projects/${projectId}/proposals`);
      setData(r.data);
    } catch (e) { setError('Caricamento proposte non riuscito.'); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Skeleton rows={2} />;
  if (error)   return <ErrorRetry message={error} onRetry={load} />;
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        testid="proposals-empty"
        eyebrow="Proposte"
        title="Nessuna proposta ancora redatta per questo progetto."
        body={`Continuità: ${data?.continuity.moodboards_in_project || 0} moodboard · ${data?.continuity.inspirations_in_project || 0} ispirazioni salvate. Quando la direzione è chiara, la proposta nasce dal progetto stesso.`}
        ctaLabel="Vai alle proposte"
        ctaTo="/workspace/proposals"
      />
    );
  }

  return (
    <div data-testid="proposals-tab" className="space-y-5">
      <div className="bp-card p-5 flex items-center justify-between flex-wrap gap-3"
           data-testid="proposals-continuity">
        <div>
          <p className="text-[10px] tracking-[0.28em] uppercase text-[var(--bp-text-muted)] font-body mb-1">
            Continuità di progetto
          </p>
          <p className="text-[13px] text-[var(--bp-text-secondary)] font-body">
            {data.continuity.moodboards_in_project} moodboard ·
            {' '}{data.continuity.inspirations_in_project} ispirazioni salvate
          </p>
        </div>
        <Link to="/workspace/proposals"
              className="bp-btn bp-btn-ghost text-[10.5px] uppercase tracking-[0.22em]">
          Vai alle proposte <ChevronRight size={11} strokeWidth={1.5} />
        </Link>
      </div>
      {data.items.map((p) => (
        <article key={p.id} data-testid={`proposal-${p.id}`}
                 className="bp-card p-6 flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] tracking-[0.28em] uppercase text-[var(--bp-text-muted)] font-body mb-1.5">
              Proposta · {p.status}
            </p>
            <h4 className="font-heading text-[20px] font-light text-[var(--bp-text-primary)] leading-tight">
              {p.title || 'Proposta senza titolo'}
            </h4>
            {p.summary && (
              <p className="text-[13px] text-[var(--bp-text-secondary)] font-body mt-2 leading-relaxed line-clamp-2">
                {p.summary}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-4 text-[10.5px] uppercase tracking-[0.18em] text-[var(--bp-text-subtle)] font-body">
              <span>Aggiornata {fmtRelative(p.updated_at || p.created_at)}</span>
              {p.moodboards_referenced?.length > 0 && (
                <span>· {p.moodboards_referenced.length} moodboard referenziati</span>
              )}
              {p.materials_referenced?.length > 0 && (
                <span>· {p.materials_referenced.length} materiali inclusi</span>
              )}
            </div>
          </div>
          <div className="text-right">
            {p.total_value != null && (
              <p className="font-heading text-[24px] font-light text-[var(--bp-text-primary)] tabular-nums">
                {Number(p.total_value).toLocaleString('it-IT')} {p.currency}
              </p>
            )}
          </div>
        </article>
      ))}
    </div>
  );
};

// ── Tab: Conversations (P0.6.B.3) ───────────────────────────────────────────
const ConversationsTab = ({ projectId, project }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.get(`/api/projects/${projectId}/conversations`);
      setData(r.data);
    } catch (e) { setError('Caricamento conversazioni non riuscito.'); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Skeleton rows={3} />;
  if (error)   return <ErrorRetry message={error} onRetry={load} />;

  const participants = data?.participants || {};
  const messages = data?.messages || [];

  return (
    <div data-testid="conversations-tab" className="space-y-6">
      {/* Participants header */}
      <header className="bp-card p-5 flex items-center justify-between gap-5 flex-wrap" data-testid="conversations-participants">
        <div className="flex items-center gap-5 flex-wrap">
          {[
            { p: participants.client,  label: 'Cliente' },
            { p: participants.advisor, label: 'Advisor' },
          ].filter(({ p }) => p).map(({ p, label }, i) => (
            <div key={i} className="flex items-center gap-3">
              {p.avatar_url ? (
                <img src={p.avatar_url} alt={p.name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[var(--bp-surface-2)] flex items-center justify-center text-[var(--bp-text-muted)] text-[12px] font-body">
                  {(p.name || '?')[0]}
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-primary)] font-body">
                  {label}
                </p>
                <p className="text-[13px] text-[var(--bp-text-primary)] font-body">{p.name}</p>
              </div>
            </div>
          ))}
        </div>
        <Link to="/client-messages"
              className="bp-btn bp-btn-ghost text-[10.5px] uppercase tracking-[0.22em]">
          <MessageSquare size={11} strokeWidth={1.5} /> Hub messaggi
        </Link>
      </header>

      {messages.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          testid="conversations-empty"
          eyebrow="Conversazioni"
          title="Nessuna conversazione attiva su questo progetto."
          body="Le conversazioni iniziano dall'advisor: un messaggio di apertura dedicato che lega il cliente al progetto. Puoi inviarlo dall'hub messaggi."
          ctaLabel="Apri hub messaggi"
          ctaTo="/client-messages"
        />
      ) : (
        <ul className="space-y-3" data-testid="conversations-list">
          {messages.map((m) => {
            const isAdvisor = m.type === 'assignee_reply';
            return (
              <li key={m.id} data-testid={`message-${m.id}`}
                  className={`flex gap-3 ${isAdvisor ? '' : 'flex-row-reverse'}`}>
                {m.from?.avatar_url ? (
                  <img src={m.from.avatar_url} alt={m.from?.name}
                       className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[var(--bp-surface-2)] flex items-center justify-center text-[var(--bp-text-muted)] text-[10px] font-body shrink-0">
                    {(m.from?.name || '?')[0]}
                  </div>
                )}
                <div className={`max-w-[70%] p-4 border border-[var(--bp-border)] rounded-[var(--bp-radius-md)]
                                ${isAdvisor
                                  ? 'bg-[var(--bp-surface-1)]'
                                  : 'bg-[var(--bp-primary-soft,rgba(196,164,107,0.10))]'}`}>
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-primary)] font-body">
                      {m.from?.name || 'Anonimo'}
                    </span>
                    <span className="text-[10px] text-[var(--bp-text-subtle)] font-body">
                      {fmtRelative(m.at)}
                    </span>
                    {m.visibility === 'internal_only' && (
                      <span className="text-[9px] uppercase tracking-[0.18em] text-amber-400 font-body">
                        · interno
                      </span>
                    )}
                  </div>
                  <p className="text-[13.5px] text-[var(--bp-text-primary)] font-body leading-relaxed whitespace-pre-line">
                    {m.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

// ── Tab: Timeline (P0.6.B.2) ────────────────────────────────────────────────
const TIMELINE_KIND_META = {
  activity:    { color: 'var(--bp-primary)',   label: 'Workflow' },
  inspiration: { color: '#C4A46B',             label: 'Ispirazione' },
  ai_brief:    { color: '#8B7CC8',             label: 'AI Brief' },
  message:     { color: '#7CB87C',             label: 'Conversazione' },
};

const TimelineTab = ({ projectId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.get(`/api/projects/${projectId}/timeline`);
      setData(r.data);
    } catch (e) { setError('Caricamento timeline non riuscito.'); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Skeleton rows={4} />;
  if (error)   return <ErrorRetry message={error} onRetry={load} />;
  if (!data || data.events.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        testid="timeline-empty"
        eyebrow="Timeline · Memoria di progetto"
        title="La memoria del progetto si scrive sola."
        body="Ogni ispirazione salvata, ogni moodboard pubblicato, ogni proposta inviata viene registrata qui in linguaggio umano. Inizia salvando un riferimento dal Magazine o creando un moodboard."
      />
    );
  }

  return (
    <ul className="relative space-y-5 pl-6 border-l border-[var(--bp-border)]"
        data-testid="timeline-tab">
      {data.events.map((ev) => {
        const meta = TIMELINE_KIND_META[ev.kind] || TIMELINE_KIND_META.activity;
        return (
          <li key={ev.id} className="relative" data-testid={`timeline-event-${ev.id}`}>
            <span className="absolute -left-[27px] top-2 w-2.5 h-2.5 rounded-full ring-2 ring-[var(--bp-bg)]"
                  style={{ backgroundColor: meta.color }} />
            <div className="bp-card p-5">
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <p className="text-[10px] uppercase tracking-[0.22em] font-body"
                   style={{ color: meta.color }}>
                  {meta.label}
                </p>
                <p className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--bp-text-subtle)] font-body">
                  {fmtRelative(ev.at)}
                </p>
              </div>
              <p className="text-[14px] text-[var(--bp-text-primary)] font-body mt-2 leading-relaxed">
                {ev.title}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

// ── Strategic Direction™ — contextual intelligence card (Overview-embedded) ─
//
// NOTE: locale_profiles are loaded dynamically from /api/locale-profiles.
// This static list is only used as a last-resort fallback before the API
// resolves (and as a deterministic order for the dropdown).
const LOCALE_FALLBACK = [
  { locale_code: 'IT_IT', display_name: 'Italia',          market: 'IT' },
  { locale_code: 'EN_US', display_name: 'United States',   market: 'US' },
  { locale_code: 'EN_GB', display_name: 'United Kingdom',  market: 'GB' },
  { locale_code: 'EN_AE', display_name: 'UAE',             market: 'AE' },
  { locale_code: 'DE_DE', display_name: 'Deutschland',     market: 'DE' },
  { locale_code: 'FR_FR', display_name: 'France',          market: 'FR' },
  { locale_code: 'ES_ES', display_name: 'España',          market: 'ES' },
];

// Legacy market shortcut (IT, US, UK, UAE, …) → composite locale_code.
const MARKET_TO_LOCALE_CODE = {
  IT: 'IT_IT', US: 'EN_US', UK: 'EN_GB', GB: 'EN_GB',
  AE: 'EN_AE', UAE: 'EN_AE',
  DE: 'DE_DE', FR: 'FR_FR', ES: 'ES_ES',
};

const SECTION_DEF = [
  { key: 'direction',             title: 'Posizionamento progettuale', eye: '01 — POSIZIONAMENTO' },
  { key: 'emotional_positioning', title: 'Direzione emotiva',          eye: '02 — DIREZIONE EMOTIVA' },
  { key: 'material_language',     title: 'Linguaggio materico',        eye: '03 — LINGUAGGIO MATERICO' },
  { key: 'market_adaptation',     title: 'Adattamento al mercato',     eye: '04 — ADATTAMENTO MERCATO' },
  { key: 'design_risks',          title: 'Rischi progettuali',         eye: '05 — RISCHI' },
];

const StrategicDirectionCard = ({ projectId, project }) => {
  const [brief, setBrief] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [busyAction, setBusyAction] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);
  const [showComposer, setShowComposer] = useState(false);
  // Locale state — composite code (IT_IT, EN_US, EN_GB, EN_AE, …).
  // Derived from the project's seeded country / metadata; user-switchable.
  const seededMarket = (project?.metadata_json?.country || 'IT').toUpperCase();
  const [localeCode, setLocaleCode] = useState(
    MARKET_TO_LOCALE_CODE[seededMarket] || 'IT_IT'
  );
  const [profiles, setProfiles] = useState(LOCALE_FALLBACK);
  const [error, setError] = useState(null);

  // Fetch live locale profiles (replaces the static fallback list).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get('/api/locale-profiles');
        if (cancelled) return;
        const list = r.data?.profiles || [];
        if (list.length) setProfiles(list);
      } catch (e) { /* keep fallback */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadLatest = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.get(`/api/projects/${projectId}/ai-brief`);
      const b = r.data?.brief || null;
      setBrief(b);
      // Sync the selected localeCode with the latest persisted brief (if any).
      if (b?.locale_code) setLocaleCode(b.locale_code);
    } catch (e) {
      setError('Caricamento direzione non riuscito.');
    } finally { setLoading(false); }
  }, [projectId]);

  const loadHistory = useCallback(async () => {
    try {
      const r = await api.get(`/api/projects/${projectId}/strategic-direction/history`);
      setHistory(r.data?.snapshots || []);
    } catch (e) { /* silent */ }
  }, [projectId]);

  useEffect(() => { loadLatest(); loadHistory(); }, [loadLatest, loadHistory]);

  const generate = async () => {
    setGenerating(true); setError(null); setActionMsg(null);
    try {
      // Strategic Direction is composed NATIVELY for the locale profile —
      // never translated. Backend loads the matching locale_profiles row.
      const r = await api.post(`/api/projects/${projectId}/ai-brief/generate`, {
        locale_code: localeCode,
      });
      const b = r.data?.brief || null;
      setBrief(b);
      if (b?.locale_code) setLocaleCode(b.locale_code);
      await loadHistory();
    } catch (e) {
      setError('Aggiornamento direzione non riuscito. Riprova fra qualche istante.');
    } finally { setGenerating(false); }
  };

  const loadSnapshot = async (snapId) => {
    setBusyAction('snapshot'); setActionMsg(null);
    try {
      const r = await api.get(`/api/projects/${projectId}/strategic-direction/snapshot/${snapId}`);
      setBrief(r.data?.brief || null);
      setShowHistory(false);
    } catch (e) { setError('Snapshot non disponibile.'); }
    finally { setBusyAction(null); }
  };

  const sendAsMemo = async () => {
    setBusyAction('memo'); setActionMsg(null);
    try {
      await api.post(`/api/projects/${projectId}/strategic-direction/send-memo`, {});
      setActionMsg('Memo inviato al team come nota interna.');
    } catch (e) { setActionMsg('Invio memo non riuscito.'); }
    finally { setBusyAction(null); setTimeout(() => setActionMsg(null), 4000); }
  };

  const promoteToProposal = () => {
    setShowComposer(true);
  };

  // ── Empty / first-use state ───────────────────────────────────────
  if (loading) {
    return (
      <div className="bp-card p-7 animate-pulse" data-testid="strategic-direction-loading">
        <div className="h-3 w-40 bg-[var(--bp-surface-2)] mb-4" />
        <div className="h-6 w-2/3 bg-[var(--bp-surface-2)] mb-3" />
        <div className="h-3 w-1/2 bg-[var(--bp-surface-2)]" />
      </div>
    );
  }

  if (!brief) {
    return (
      <section className="bp-card p-9" data-testid="strategic-direction-empty">
        <div className="flex items-start gap-6 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <p className="text-[10px] tracking-[0.32em] uppercase text-[var(--bp-primary)] font-body mb-3">
              Strategic Direction™
            </p>
            <h2 className="font-heading text-[26px] font-light text-[var(--bp-text-primary)] leading-[1.15] max-w-xl">
              L'identità strategica di questo progetto, scritta come un memo editoriale.
            </h2>
            <p className="mt-4 text-[13.5px] text-[var(--bp-text-secondary)] font-body leading-relaxed max-w-2xl">
              Legge il contesto reale — cliente, mercato, ispirazioni salvate, materiali collegati,
              identità dell'advisor — e compone una direzione progettuale in sei sezioni. Si aggiorna
              man mano che il progetto evolve: ogni cambio di rotta crea uno snapshot storico.
            </p>
            <div className="flex items-center gap-3 flex-wrap mt-7">
              <label className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body">
                Mercato
              </label>
              <select value={localeCode} onChange={(e) => setLocaleCode(e.target.value)}
                      data-testid="strategic-direction-locale-select"
                      className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] text-[12px] px-3 py-2
                                 text-[var(--bp-text-primary)] font-body">
                {profiles.map((p) => (
                  <option key={p.locale_code} value={p.locale_code}>
                    {p.display_name} · {p.locale_code}
                  </option>
                ))}
              </select>
              <button onClick={generate} disabled={generating}
                      data-testid="strategic-direction-generate-btn"
                      className="bp-btn bp-btn-primary text-[10.5px] uppercase tracking-[0.22em]">
                {generating ? 'In elaborazione…' : 'Componi direzione'}
              </button>
            </div>
            {error && <p className="text-[12px] text-red-300 mt-3">{error}</p>}
          </div>
        </div>
      </section>
    );
  }

  // ── Populated card ────────────────────────────────────────────────
  const s = brief.sections || {};
  return (
    <section className="space-y-5" data-testid="strategic-direction-content">
      {/* Header — headline + market selector + action menu */}
      <header className="bp-card p-7">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] tracking-[0.32em] uppercase text-[var(--bp-primary)] font-body mb-3">
              Strategic Direction™ · {brief.locale_code || brief.market || 'IT_IT'}
            </p>
            <h2 data-testid="strategic-direction-headline"
                className="font-heading text-[28px] font-light text-[var(--bp-text-primary)] leading-[1.1]">
              {s.headline || 'Direzione progettuale'}
            </h2>
            <p className="mt-3 text-[11px] text-[var(--bp-text-muted)] font-body">
              Aggiornata {fmtRelative(brief.created_at)}
              {history.length > 1 && (
                <>{' · '}<button onClick={() => setShowHistory(true)}
                                 className="underline-offset-2 hover:underline text-[var(--bp-text-secondary)]">
                  {history.length} version{history.length === 1 ? 'e' : 'i'} salvate
                </button></>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={localeCode} onChange={(e) => setLocaleCode(e.target.value)}
                    data-testid="strategic-direction-locale-selector"
                    className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] text-[11px] px-3 py-2 text-[var(--bp-text-secondary)] font-body">
              {profiles.map((p) => (
                <option key={p.locale_code} value={p.locale_code}>
                  {p.display_name} · {p.locale_code}
                </option>
              ))}
            </select>
            <button onClick={generate} disabled={generating}
                    data-testid="strategic-direction-regenerate"
                    title="Rigenera la direzione con il contesto attuale"
                    className="bp-btn bp-btn-ghost text-[10px] uppercase tracking-[0.22em] inline-flex items-center gap-1.5">
              <RefreshCw size={11} strokeWidth={1.6} className={generating ? 'animate-spin' : ''} />
              {generating ? 'In corso…' : 'Rigenera'}
            </button>
          </div>
        </div>

        {/* Action bar — workflow-native, not gimmicks */}
        <div className="flex items-center gap-2 flex-wrap mt-6 pt-5 border-t border-[var(--bp-border)]">
          <button onClick={() => setShowHistory(true)}
                  data-testid="strategic-direction-history-btn"
                  className="bp-btn bp-btn-ghost text-[10px] uppercase tracking-[0.22em] inline-flex items-center gap-1.5">
            <History size={11} strokeWidth={1.6} /> Storico
          </button>
          <button onClick={sendAsMemo} disabled={busyAction === 'memo'}
                  data-testid="strategic-direction-send-memo"
                  title="Condividi nel thread interno del team"
                  className="bp-btn bp-btn-ghost text-[10px] uppercase tracking-[0.22em] inline-flex items-center gap-1.5">
            <Share2 size={11} strokeWidth={1.6} />
            {busyAction === 'memo' ? 'Invio…' : 'Condividi con il team'}
          </button>
          <button onClick={promoteToProposal} disabled={busyAction === 'proposal'}
                  data-testid="strategic-direction-to-proposal"
                  title="Componi una proposta editoriale dal contesto del progetto"
                  className="bp-btn bp-btn-ghost text-[10px] uppercase tracking-[0.22em] inline-flex items-center gap-1.5">
            <FileSignature size={11} strokeWidth={1.6} />
            Componi proposta
          </button>
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--bp-text-subtle)] font-body ml-1">
            Export PDF · disponibile a breve
          </span>
        </div>

        {actionMsg && (
          <p data-testid="strategic-direction-action-msg"
             className="text-[12px] text-[var(--bp-primary)] font-body mt-3">{actionMsg}</p>
        )}
        {error && <p className="text-[12px] text-red-300 mt-3">{error}</p>}
      </header>

      {/* 5 long-form sections */}
      {SECTION_DEF.map(({ key, title, eye }) => (
        <article key={key} data-testid={`strategic-direction-section-${key}`} className="bp-card p-7">
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

      {/* Next moves */}
      {(s.next_moves || []).length > 0 && (
        <article data-testid="strategic-direction-section-next_moves" className="bp-card p-7">
          <p className="text-[10px] tracking-[0.32em] uppercase text-[var(--bp-text-muted)] font-body mb-3">
            06 — MOSSE STRATEGICHE
          </p>
          <h3 className="font-heading text-[20px] font-light text-[var(--bp-text-primary)] mb-5 leading-tight">
            Prossimi passi suggeriti
          </h3>
          <ul className="space-y-3">
            {s.next_moves.map((mv, i) => (
              <li key={i} className="flex gap-4 items-start">
                <span className="shrink-0 w-7 h-7 rounded-[2px] bg-[var(--bp-primary-soft,rgba(196,164,107,0.12))]
                                 text-[var(--bp-primary)] text-[11px] font-medium flex items-center justify-center tabular-nums">
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

      {/* Snapshot history drawer */}
      {showHistory && (
        <div onClick={() => setShowHistory(false)}
             data-testid="strategic-direction-history-modal"
             className="fixed inset-0 z-50 bg-[var(--bp-overlay,rgba(0,0,0,0.6))] backdrop-blur-sm flex items-center justify-center p-4">
          <div onClick={(e) => e.stopPropagation()}
               className="bp-glass w-full max-w-3xl max-h-[80vh] overflow-y-auto p-7 rounded-[var(--bp-radius-md)]">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-[10px] tracking-[0.32em] uppercase text-[var(--bp-primary)] font-body mb-2">
                  Evoluzione strategica
                </p>
                <h3 className="font-heading text-[22px] font-light text-[var(--bp-text-primary)]">
                  Versioni precedenti della direzione
                </h3>
                <p className="text-[12px] text-[var(--bp-text-muted)] font-body mt-1.5">
                  Ogni rigenerazione viene salvata come snapshot — apri una versione precedente per confrontare.
                </p>
              </div>
              <button onClick={() => setShowHistory(false)}
                      className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]">
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>
            <ul className="space-y-3" data-testid="strategic-direction-history-list">
              {history.map((h) => {
                const isCurrent = brief?.id === h.id;
                return (
                  <li key={h.id} data-testid={`history-snapshot-${h.id}`}>
                    <button onClick={() => loadSnapshot(h.id)} disabled={busyAction === 'snapshot'}
                            className={`w-full text-left p-4 border transition-colors
                                       ${isCurrent
                                         ? 'border-[var(--bp-primary)] bg-[var(--bp-primary-soft,rgba(196,164,107,0.08))]'
                                         : 'border-[var(--bp-border)] hover:border-[var(--bp-border-strong)] bg-[var(--bp-surface-1)]'}`}>
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-primary)] font-body">
                          {h.locale_code || h.market || 'IT_IT'}{isCurrent ? ' · attuale' : ''}
                        </p>
                        <p className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--bp-text-subtle)] font-body">
                          {fmtRelative(h.created_at)}
                        </p>
                      </div>
                      <p className="font-heading text-[16px] font-light text-[var(--bp-text-primary)] leading-tight">
                        {h.headline}
                      </p>
                      {h.created_by?.name && (
                        <p className="text-[11px] text-[var(--bp-text-muted)] font-body mt-1.5">
                          Curata da {h.created_by.name}
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
              {history.length === 0 && (
                <p className="text-[12px] text-[var(--bp-text-muted)] font-body italic">
                  Nessuna versione salvata ancora.
                </p>
              )}
            </ul>
          </div>
        </div>
      )}
      {showComposer && (
        <ComposeProposalWizard projectId={projectId} defaultMarket={brief?.market || market}
                               onClose={() => setShowComposer(false)} />
      )}
    </section>
  );
};

// ── Main page ───────────────────────────────────────────────────────────────
// Design Journey™ is the FIRST tab and the default landing view of a project.
// Le altre tab sono "ambienti collegati" al Journey, non sezioni indipendenti.
const TABS = [
  { id: 'journey',       icon: Compass,       label: 'Design Journey™' },
  { id: 'overview',      icon: FileText,      label: 'Overview' },
  { id: 'inspirations',  icon: Bookmark,      label: 'Ispirazioni' },
  { id: 'moodboards',    icon: Layers,        label: 'Moodboard' },
  { id: 'materials',     icon: Boxes,         label: 'Materiali' },
  { id: 'proposals',     icon: FileText,      label: 'Proposte' },
  { id: 'conversations', icon: MessageSquare, label: 'Conversazioni' },
  { id: 'timeline',      icon: Activity,      label: 'Timeline' },
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const tab = useMemo(() => {
    const q = (searchParams.get('tab') || 'journey').toLowerCase();
    return TABS.find((x) => x.id === q) ? q : 'journey';
  }, [searchParams]);

  const setTab = useCallback((id) => {
    const next = new URLSearchParams(searchParams);
    if (id === 'journey') next.delete('tab');
    else next.set('tab', id);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const loadProject = useCallback(() => {
    setLoading(true); setLoadError(null);
    api.get(`/api/projects/${id}`)
      .then((r) => setProject(r.data))
      .catch((e) => {
        const status = e?.response?.status;
        if (status === 404) navigate('/workspace/projects');
        else setLoadError('Caricamento progetto non riuscito. Verifica la connessione e riprova.');
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => { loadProject(); }, [loadProject]);

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--bp-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="p-10 max-w-2xl mx-auto" data-testid="project-load-error">
        <ErrorRetry message={loadError} onRetry={loadProject} />
      </div>
    );
  }
  if (!project) return null;

  // Journey Continuity™: when Design Journey™ is the active tab, the page
  // becomes a full-bleed environment — no boxed admin container, no
  // duplicated project header (the Journey absorbs project identity).
  const isJourney = tab === 'journey';

  // Project header (status badge · title · advisor) — rendered only when
  // NOT on the Journey tab. The Journey owns its own absorption header.
  const ProjectIdentityHeader = (
    <div className="flex items-start justify-between gap-6 mb-10 flex-wrap">
      <div className="min-w-0">
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
      {project.assigned_designer && (
        <div data-testid="assigned-designer-card"
             className="flex items-center gap-4 bg-[var(--bp-surface-1)] border border-[var(--bp-border)] px-5 py-4 min-w-[280px]">
          {project.assigned_designer.avatar_url && (
            <img src={project.assigned_designer.avatar_url}
                 alt={project.assigned_designer.first_name}
                 className="w-12 h-12 rounded-full object-cover" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-primary)] font-body font-semibold mb-0.5">
              {t('workspace.followed_by') || 'Seguito da'}
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
              <span className={`w-1.5 h-1.5 rounded-full ${
                project.assigned_designer.online_status === 'available' ? 'bg-emerald-500'
                : project.assigned_designer.online_status === 'away' ? 'bg-amber-500'
                : 'bg-zinc-500'
              }`} />
              <span className="text-[10px] font-body uppercase tracking-[0.15em] text-[var(--bp-text-subtle)]">
                {project.assigned_designer.online_status || 'offline'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const TabBar = (
    <div className="border-b border-[var(--bp-border)] mb-8 overflow-x-auto" data-testid="project-tabbar">
      <div className="flex gap-1 min-w-max">
        {TABS.map(({ id: tabId, icon: Icon, label }) => (
          <button key={tabId} onClick={() => setTab(tabId)}
                  data-testid={`tab-${tabId}`}
                  className={`flex items-center gap-2 px-4 py-3 text-[12.5px] font-body whitespace-nowrap
                              border-b-2 transition-colors ${
                    tab === tabId
                      ? 'border-[var(--bp-primary)] text-[var(--bp-text-primary)]'
                      : 'border-transparent text-[var(--bp-text-muted)] hover:text-[var(--bp-text-secondary)]'
                  }`}>
            <Icon size={14} strokeWidth={1.5} /> {label}
          </button>
        ))}
      </div>
    </div>
  );

  // ── Full-bleed Journey environment ──────────────────────────────
  if (isJourney) {
    return (
      <div className="min-h-screen bg-[var(--bp-bg)]" data-testid="project-detail">
        <div className="px-6 sm:px-10 pt-6">
          <button onClick={() => navigate('/workspace/projects')}
                  data-testid="back-to-projects"
                  className="bp-caption text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] mb-4 flex items-center gap-1.5">
            <ArrowLeft size={13} strokeWidth={1.5} /> {t('workspace.back.projects')}
          </button>
          {TabBar}
        </div>
        <div data-testid="tab-content" data-tab="journey">
          <DesignJourneyTab projectId={id} project={project} />
        </div>
      </div>
    );
  }

  // ── Classic boxed view for non-Journey tabs ─────────────────────
  return (
    <div className="p-6 sm:p-10 max-w-6xl mx-auto" data-testid="project-detail">
      <button onClick={() => navigate('/workspace/projects')}
              data-testid="back-to-projects"
              className="bp-caption text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] mb-4 flex items-center gap-1.5">
        <ArrowLeft size={13} strokeWidth={1.5} /> {t('workspace.back.projects')}
      </button>

      {ProjectIdentityHeader}
      {TabBar}

      <div data-testid="tab-content">
        {tab === 'overview' && (
          <div className="space-y-10" data-testid="overview-tab">
            {/* Overview is becoming the *identity* of the project, not an
                operational dashboard. The Journey™ now carries stats and
                evolution narrative — Overview keeps only Strategic
                Direction™ + advisor identity hero. */}
            <StrategicDirectionCard projectId={id} project={project} />
          </div>
        )}
        {tab === 'inspirations'  && <InspirationsTab projectId={id} />}
        {tab === 'moodboards'    && <MoodboardsTab project={project} t={t} />}
        {tab === 'materials'     && <MaterialsTab projectId={id} />}
        {tab === 'proposals'     && <ProposalsTab projectId={id} />}
        {tab === 'conversations' && <ConversationsTab projectId={id} project={project} />}
        {tab === 'timeline'      && <TimelineTab projectId={id} />}
      </div>
    </div>
  );
};

export default ProjectDetailPage;
