/**
 * Experience Overview™ — the orchestration command center.
 *
 * /blueprint/experience  →  this page (the hub)
 * /blueprint/experience/editor  →  StorefrontStudioPage (the editor)
 *
 * Shows every public surface of the tenant at a glance: status, locales,
 * markets, section count, last update, owner. No editor controls here —
 * pure orchestration visibility (per directive: "users still cannot
 * understand the entire public experience at a glance").
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowUpRight, Eye, FileText, Globe, Layers, RefreshCw,
} from 'lucide-react';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import './storefrontStudio.css';
import './experienceOverview.css';

const STATUS_STYLE = {
  published: { dot: '#7BA985', label: 'LIVE',      tone: 'live' },
  draft:     { dot: '#C9A36E', label: 'DRAFT',     tone: 'draft' },
  scheduled: { dot: '#5A86B5', label: 'SCHEDULED', tone: 'scheduled' },
  archived:  { dot: '#6e685c', label: 'ARCHIVED',  tone: 'archived' },
};

const SURFACE_META = {
  home:           { label: 'Homepage',          intro: 'L\'apertura editoriale del sito.',         icon: 'Home',     publicPath: '/' },
  projects:       { label: 'Projects',          intro: 'Index pubblico dei progetti.',             icon: 'Frame',    publicPath: '/projects' },
  magazine:       { label: 'Magazine',          intro: 'Articoli editoriali e mercati.',           icon: 'BookOpen', publicPath: '/magazine' },
  navigation:     { label: 'Navigation',        intro: 'Header del sito pubblico.',                icon: 'Compass',  publicPath: '/' },
  footer:         { label: 'Footer',            intro: 'Chiusura editoriale e colonne footer.',    icon: 'Layout',   publicPath: '/' },
  about:          { label: 'About',             intro: 'Lo studio raccontato in editoriale.',      icon: 'FileText', publicPath: '/about' },
  contact:        { label: 'Contact',           intro: 'Punto di ingresso conversazione.',         icon: 'Mail',     publicPath: '/contact' },
  start_project:  { label: 'Start a project',   intro: 'Journey privato + professional.',          icon: 'Workflow', publicPath: '/start-project' },
  professionals:  { label: 'Professionals',     intro: 'Gateway A&D partnership.',                 icon: 'Users',    publicPath: '/professionals' },
  ui:             { label: 'UI labels',         intro: 'Stringhe condivise pubbliche.',            icon: 'Type',     publicPath: null },
};

const formatDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' });
  } catch (_) {
    return iso;
  }
};

// ───────────────────────────────────────────────────────────────────────
// KPI Bar
// ───────────────────────────────────────────────────────────────────────
const KpiBar = ({ pages, markets, locales }) => {
  const live   = pages.filter((p) => p.status === 'published').length;
  const drafts = pages.filter((p) => p.status === 'draft').length;
  const sections = pages.reduce((acc, p) => acc + (p.sections?.length || 0), 0);
  return (
    <div className="eo-kpi" data-testid="experience-overview-kpi">
      <KpiCell label="Public surfaces" value={pages.length} />
      <KpiCell label="Live" value={live} tone="live" />
      <KpiCell label="Drafts" value={drafts} tone="draft" />
      <KpiCell label="Sections orchestrated" value={sections} />
      <KpiCell label="Locales attive" value={locales.length || '—'} />
      <KpiCell label="Mercati" value={markets.length || '—'} />
    </div>
  );
};
const KpiCell = ({ label, value, tone }) => (
  <div className="eo-kpi__cell" data-tone={tone}>
    <p className="eo-kpi__value">{value}</p>
    <p className="eo-kpi__label">{label}</p>
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// Surface Card
// ───────────────────────────────────────────────────────────────────────
const SurfaceCard = ({ page, tenantSlug, onPreview }) => {
  const meta = SURFACE_META[page.page_key] || { label: page.page_key, intro: '', publicPath: null };
  const status = STATUS_STYLE[page.status] || STATUS_STYLE.draft;
  const sections = page.sections || [];
  const visibleSections = sections.filter((s) => s.visible !== false).length;

  // Locale coverage: any section with any locale_content key counts.
  const localeSet = new Set();
  sections.forEach((s) => {
    Object.keys(s.locale_content || {}).forEach((k) => localeSet.add(k));
  });
  const locales = Array.from(localeSet).sort();

  return (
    <article className="eo-card" data-testid={`eo-card-${page.page_key}`} data-status={status.tone}>
      <header className="eo-card__head">
        <div className="eo-card__status" data-tone={status.tone}>
          <span className="eo-card__dot" style={{ background: status.dot }} aria-hidden />
          {status.label}
        </div>
        <h3 className="eo-card__title">{meta.label}</h3>
        <p className="eo-card__intro">{meta.intro}</p>
      </header>

      <dl className="eo-card__meta">
        <div><dt>Sections</dt><dd>{visibleSections} / {sections.length}</dd></div>
        <div><dt>Locales</dt><dd>{locales.length || '—'}</dd></div>
        <div><dt>Updated</dt><dd>{formatDate(page.updated_at)}</dd></div>
        <div><dt>Page key</dt><dd className="eo-card__mono">{page.page_key}</dd></div>
      </dl>

      {locales.length > 0 && (
        <div className="eo-card__locales">
          {locales.slice(0, 6).map((l) => (
            <span key={l} className="eo-locale-chip">{l}</span>
          ))}
          {locales.length > 6 && <span className="eo-locale-chip eo-locale-chip--more">+{locales.length - 6}</span>}
        </div>
      )}

      <footer className="eo-card__actions">
        <Link to={`/blueprint/experience/editor?page=${page.page_key}`}
              className="eo-btn eo-btn--primary"
              data-testid={`eo-edit-${page.page_key}`}>
          <FileText size={11} strokeWidth={1.7} /> Edit
        </Link>
        {meta.publicPath && (
          <button type="button" className="eo-btn eo-btn--ghost"
                  data-testid={`eo-preview-${page.page_key}`}
                  onClick={() => onPreview(meta.publicPath)}>
            <Eye size={11} strokeWidth={1.7} /> Preview
            <ArrowUpRight size={9} strokeWidth={1.7} />
          </button>
        )}
      </footer>
    </article>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────
const ExperienceOverviewPage = () => {
  const navigate = useNavigate();
  const { tenant } = useBlueprint();
  const [pages, setPages] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [locales, setLocales] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const [pRes, mRes, lRes] = await Promise.allSettled([
        api.get('/api/storefront/admin/pages'),
        api.get('/api/markets'),
        api.get('/api/settings/locales').catch(() => api.get('/api/locales')),
      ]);
      if (pRes.status === 'fulfilled') {
        const ps = pRes.value.data?.pages || [];
        setPages(ps);
      }
      if (mRes.status === 'fulfilled') {
        setMarkets(mRes.value.data?.markets || mRes.value.data || []);
      }
      if (lRes.status === 'fulfilled') {
        const ld = lRes.value.data;
        setLocales(ld?.active_locales || ld?.locales || []);
      }
    } catch (e) {
      toast.error('Errore nel caricamento dell\'overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const tenantSlug = tenant?.slug;
  const publicBase = useMemo(() => {
    if (!tenantSlug) return null;
    // Public storefront preview lives at the tenant's preview path.
    return `/${tenantSlug}`;
  }, [tenantSlug]);

  const openPreview = (path) => {
    if (!publicBase) {
      toast.error('Tenant slug non disponibile');
      return;
    }
    window.open(path === '/' ? publicBase : `${publicBase}${path}`, '_blank', 'noopener,noreferrer');
  };

  // Order: home, projects, magazine, navigation, footer, then alphabetical
  const order = ['home', 'projects', 'magazine', 'navigation', 'footer', 'about', 'contact', 'start_project', 'professionals', 'ui'];
  const sortedPages = [...pages].sort((a, b) => {
    const ai = order.indexOf(a.page_key); const bi = order.indexOf(b.page_key);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.page_key.localeCompare(b.page_key);
  });

  return (
    <div className="ss-stage" data-testid="experience-overview-page">
      <header className="ss-head">
        <p className="ss-head__eyebrow">Blueprint · Command Center</p>
        <h1 className="ss-head__title">Experience Overview<sup>™</sup></h1>
        <p className="ss-head__intro">
          La regia delle superfici pubbliche: ogni pagina è una scena, ogni sezione una
          battuta. Da qui controlli stato, mercati, locale, ultime modifiche. Nessun editor
          inline — solo orchestrazione e tracciabilità.
        </p>
        <div className="eo-head-actions">
          <button type="button" className="eo-btn eo-btn--ghost" onClick={reload} disabled={loading}
                  data-testid="eo-reload">
            <RefreshCw size={11} strokeWidth={1.7} className={loading ? 'eo-spin' : ''} /> Refresh
          </button>
          <Link to="/blueprint/experience/editor" className="eo-btn eo-btn--primary"
                data-testid="eo-open-editor">
            <Layers size={11} strokeWidth={1.7} /> Open Studio editor
          </Link>
          {publicBase && (
            <button type="button" className="eo-btn eo-btn--ghost"
                    onClick={() => openPreview('/')}
                    data-testid="eo-open-public">
              <Globe size={11} strokeWidth={1.7} /> View public site
              <ArrowUpRight size={9} strokeWidth={1.7} />
            </button>
          )}
        </div>
      </header>

      <KpiBar pages={sortedPages} markets={markets} locales={locales} />

      {loading && sortedPages.length === 0 ? (
        <div className="eo-loading" data-testid="eo-loading">
          <RefreshCw size={14} className="eo-spin" /> Caricamento orchestrazione…
        </div>
      ) : sortedPages.length === 0 ? (
        <div className="eo-empty" data-testid="eo-empty">
          <p>Nessuna superficie pubblica configurata.</p>
          <button type="button" className="eo-btn eo-btn--primary"
                  onClick={() => navigate('/blueprint/experience/editor')}>
            Apri lo Studio editor
          </button>
        </div>
      ) : (
        <div className="eo-grid">
          {sortedPages.map((p) => (
            <SurfaceCard key={p.id || p.page_key} page={p} tenantSlug={tenantSlug} onPreview={openPreview} />
          ))}
        </div>
      )}

      <footer className="eo-footnote">
        <p>
          <strong>Filosofia.</strong> Una sola fonte di verità per ciascuna superficie.
          Header, Footer e sezioni Home vivono qui — Brand Studio si limita all'identità
          (logo · palette · tipografia · contatti). International Presence gestisce i mercati.
          Editorial Studio orchestra il magazine. Forms & Journeys™ governa le acquisizioni.
        </p>
      </footer>
    </div>
  );
};

export default ExperienceOverviewPage;
