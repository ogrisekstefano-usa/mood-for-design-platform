/**
 * Storefront Studio™ — Phase S-CONNECT Step 2.
 *
 * Editorial orchestration room for the public storefront. Each storefront
 * band (Hero, Services, Materials, Projects, Journal, Hospitality,
 * Proposal CTA, Footer) is exposed here so Blueprint owns ALL public
 * content. NOT a CMS, NOT a page builder.
 *
 * Persistence:
 *   GET    /api/storefront/admin/pages/{page_key}        → page + sections
 *   PUT    /api/storefront/admin/sections/{section_id}   → locale_content + settings
 *   PATCH  /api/storefront/admin/pages/{page_key}/sections/reorder
 *   POST   /api/storefront/admin/pages/{page_key}/publish
 *
 * Settings JSONB shape (the schema is intentionally open):
 *   {
 *     positioning_mode: 'domestic_authority' | 'international_editorial' | …,
 *     market_visibility: ['all'] | ['italy', 'usa_national', …],
 *     hero_variant: 'cinematic' | 'editorial_static' | …  (hero only),
 *     cta_market_variants: { [marketCode]: { label, href } },
 *     …existing section-specific keys preserved
 *   }
 *
 * UI Direction: editorial orchestration room, NOT CMS admin. Blueprint
 * palette only (--bp-* tokens).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import LivePreviewPane from './LivePreviewPane';
import { toast } from 'sonner';
import './storefrontStudio.css';
import { renderBandEditor, TraceabilityChip } from './bandEditors';
import EditorialMediaField from '../../components/common/EditorialMediaField';
import { useT } from '../../i18n/useT';

// Editorial labels for the storefront bands. Keep the section_type as the
// stable key (matches DB), but show editorial titles to the user.
const BAND_META = {
  store_hero: {
    title: 'Hero',
    intro: 'L\'apertura cinematica del sito pubblico.'
  },
  hero: {
    title: 'Hero',
    intro: 'L\'apertura cinematica del sito pubblico.'
  },
  value_props: {
    title: 'Services',
    intro: 'I pilastri editoriali dello studio.'
  },
  services: {
    title: 'Services',
    intro: 'I pilastri editoriali dello studio.'
  },
  materials: {
    title: 'Materials',
    intro: 'Le materie scelte e il vocabolario tattile.'
  },
  stats_band: {
    title: 'Stats Band',
    intro: 'L\'esperienza dello studio in numeri.'
  },
  hospitality: {
    title: 'Hospitality Narrative',
    intro: 'L\'esperienza ospitale del progetto.'
  },
  projects_preview: {
    title: 'Projects Band',
    intro: 'La selezione editoriale di progetti.'
  },
  projects: {
    title: 'Projects Band',
    intro: 'La selezione editoriale di progetti.'
  },
  magazine_grid: {
    title: 'Journal · Magazine',
    intro: 'L\'introduzione editoriale al magazine.'
  },
  journal_intro: {
    title: 'Journal · Magazine',
    intro: 'L\'introduzione editoriale al magazine.'
  },
  brand_logos: {
    title: 'Trusted Logos',
    intro: 'I segnali di credibilità.'
  },
  proposal_cta: {
    title: 'Proposal CTA',
    intro: 'L\'invito alla consultazione privata.'
  },
  footer_narrative: {
    title: 'Footer Narrative',
    intro: 'Il chiudere editoriale.'
  },
  nav_top: {
    title: 'Navigation · Header',
    intro: 'Le voci di menu del sito pubblico.'
  },
  main_links: {
    title: 'Navigation · Header',
    intro: 'Le voci di menu del sito pubblico.'
  },
  navigation_main: {
    title: 'Navigation · Header',
    intro: 'Le voci di menu del sito pubblico.'
  },
  footer_columns: {
    title: 'Footer Columns',
    intro: 'Colonne, social e showroom block del footer.'
  },
  newsletter: {
    title: 'Newsletter Band',
    intro: 'L\'invito all\'iscrizione editoriale.'
  },
  dual_cta: {
    title: 'Dual CTA · Privato / Professional',
    intro: 'I due percorsi di acquisizione.'
  }
};
const bandMeta = st => BAND_META[st] || {
  title: st,
  intro: 'Custom storefront band.'
};
const POSITIONING_MODES = [{
  v: 'domestic_authority',
  label: 'Domestic Luxury Authority'
}, {
  v: 'international_editorial',
  label: 'International Editorial Positioning'
}, {
  v: 'hospitality_specialist',
  label: 'Hospitality Contract Specialist'
}, {
  v: 'residential_advisory',
  label: 'Luxury Residential Advisory'
}, {
  v: 'material_consultancy',
  label: 'Material Consultancy'
}, {
  v: 'ad_specification_partner',
  label: 'A&D Specification Partner'
}, {
  v: 'collectible_bespoke',
  label: 'Collectible Design & Bespoke'
}];
const HERO_VARIANTS = [{
  v: 'cinematic',
  label: 'Cinematic'
}, {
  v: 'editorial_static',
  label: 'Editorial Static'
}, {
  v: 'slow_reveal',
  label: 'Slow Reveal'
}, {
  v: 'immersive',
  label: 'Immersive Fullscreen'
}, {
  v: 'split_narrative',
  label: 'Split Narrative'
}, {
  v: 'material_focused',
  label: 'Material Focused'
}];
const PAGE_TABS = [{
  key: 'home',
  label: 'Home'
}, {
  key: 'projects',
  label: 'Projects'
}, {
  key: 'navigation',
  label: 'Navigation'
}, {
  key: 'start_project',
  label: 'Start project'
}];
const StorefrontStudioPage = () => {
  const {
    t
  } = useT();
  // Read ?page= from the URL so the Experience Overview can deep-link into
  // a specific surface (Home / Projects / Navigation / Start project).
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPage = searchParams.get('page') || 'home';
  const [activePage, setActivePage] = useState(initialPage);
  const setActivePageWithUrl = key => {
    setActivePage(key);
    const sp = new URLSearchParams(searchParams);
    sp.set('page', key);
    setSearchParams(sp, {
      replace: true
    });
  };
  const [page, setPage] = useState(null);
  const [sections, setSections] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  // ITER157.D · Visual editor — side-by-side preview state
  const [previewOpen, setPreviewOpen] = useState(true);
  const [previewKey, setPreviewKey]   = useState(0);
  // When iframe says a section was clicked → open editor for that band.
  const onPreviewSectionClick = useCallback((section_type) => {
    setSections((current) => {
      const found = (current || []).find((s) => s.section_type === section_type);
      if (found) setSelected(found);
      return current;
    });
  }, []);
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setSelected(null);
      setDirty(false);
      try {
        const [pageR, mkR] = await Promise.all([api.get(`/api/storefront/admin/pages/${activePage}`), api.get('/api/tenants/me/markets')]);
        if (!alive) return;
        setPage(pageR.data || null);
        setSections(pageR.data?.sections || []);
        setMarkets((mkR.data?.markets || []).filter(m => m.is_active));
      } catch (e) {
        toast.error(e?.response?.data?.detail || 'Caricamento fallito');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [activePage]);
  const activeLocales = useMemo(() => {
    return markets.map(m => m.primary_locale).filter(Boolean);
  }, [markets]);
  const onSelect = s => setSelected(s);
  const onDragStart = id => setDragId(id);
  const onDragEnd = () => setDragId(null);
  const onDragOver = e => e.preventDefault();
  const onDrop = targetId => {
    if (!dragId || dragId === targetId) return;
    const list = [...sections];
    const fromIdx = list.findIndex(s => s.id === dragId);
    const toIdx = list.findIndex(s => s.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    // re-stamp sort_order with step 10
    const renumbered = list.map((s, i) => ({
      ...s,
      sort_order: (i + 1) * 10
    }));
    setSections(renumbered);
    setDragId(null);
    persistReorder(renumbered);
  };
  const persistReorder = async renumbered => {
    try {
      await api.patch(`/api/storefront/admin/pages/${activePage}/sections/reorder`, {
        section_ids: renumbered.map(s => s.id)
      });
      toast.success('Sequenza editoriale aggiornata');
    } catch (e) {
      toast.error('Riordino fallito');
    }
  };
  const toggleVisible = async s => {
    try {
      const r = await api.put(`/api/storefront/admin/sections/${s.id}`, {
        visible: !s.visible
      });
      setSections(list => list.map(x => x.id === s.id ? {
        ...x,
        ...r.data
      } : x));
      if (selected?.id === s.id) setSelected({
        ...selected,
        ...r.data
      });
    } catch (e) {
      toast.error('Aggiornamento fallito');
    }
  };
  const onSectionPatch = patch => {
    setSelected(s => ({
      ...s,
      ...patch
    }));
    setDirty(true);
  };
  const saveSelected = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const r = await api.put(`/api/storefront/admin/sections/${selected.id}`, {
        locale_content: selected.locale_content || {},
        settings: selected.settings || {}
      });
      setSections(list => list.map(x => x.id === selected.id ? {
        ...x,
        ...r.data
      } : x));
      setSelected({
        ...selected,
        ...r.data
      });
      setDirty(false);
      setPreviewKey((k) => k + 1);
      toast.success('Variante salvata');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Salvataggio fallito');
    } finally {
      setSaving(false);
    }
  };
  const publishPage = async () => {
    try {
      await api.post(`/api/storefront/admin/pages/${activePage}/publish`, {});
      toast.success('Pagina pubblicata');
      // refresh
      const r = await api.get(`/api/storefront/admin/pages/${activePage}`);
      setPage(r.data || null);
      setPreviewKey((k) => k + 1);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Pubblicazione fallita');
    }
  };
  return <div className="ss-root ss-root--with-preview" data-no-edit={!selected} data-preview-open={previewOpen} data-testid="ss-root">
      <div className="ss-stage">
        <header className="ss-head">
          <p className="ss-head__eyebrow">Blueprint · Experience Orchestration</p>
          <h1 className="ss-head__title">Experience Studio<sup>™</sup></h1>
          <p className="ss-head__intro">
            {t("storefront.storefront_studio.l_orchestrazione_cinematica_della_presenza_pubblic")}
          </p>
        </header>

        <nav className="ss-page-tabs" data-testid="ss-page-tabs">
          {PAGE_TABS.map(t => <button key={t.key} type="button" className="ss-page-tab" data-active={activePage === t.key} data-testid={`ss-tab-${t.key}`} onClick={() => setActivePageWithUrl(t.key)}>
              {t.label}
            </button>)}
        </nav>

        <div className="ss-publish-bar">
          <span className="ss-publish-bar__status" data-testid="ss-page-status">
            <span className="ss-publish-bar__dot" data-status={page?.status || 'draft'} />
            {page?.status === 'published' ? 'Live · pubblicata' : 'Bozza · non pubblicata'}
          </span>
          <button
            type="button"
            className="ss-btn ss-btn--ghost"
            onClick={() => setPreviewOpen((v) => !v)}
            data-testid="ss-toggle-preview"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginRight: 8,
            }}
            title={previewOpen ? 'Chiudi pannello di anteprima' : 'Apri anteprima visiva del sito'}
          >
            <Eye size={13} strokeWidth={1.6} /> {previewOpen ? 'Nascondi anteprima' : 'Apri anteprima'}
          </button>
          <button className="ss-btn ss-btn--primary" data-testid="ss-publish" onClick={publishPage}>{t('storefront.storefront_studio.pubblica_pagina')}</button>
        </div>

        {loading && <p className="ss-empty">{t('storefront.storefront_studio.caricamento_dell_orchestrazione')}</p>}
        {!loading && sections.length === 0 && <p className="ss-empty">{t('storefront.storefront_studio.nessuna_fascia_per_questa_pagina')}</p>}

        <div className="ss-bands" data-testid="ss-bands">
          {sections.sort((a, b) => a.sort_order - b.sort_order).map((s, i) => {
          const meta = bandMeta(s.section_type);
          const settings = s.settings || {};
          const mv = settings.market_visibility || ['all'];
          const pm = settings.positioning_mode;
          const hv = settings.hero_variant;
          const localeKeys = Object.keys(s.locale_content || {});
          return <article key={s.id} className="ss-band" data-testid={`ss-band-${s.section_type}`} data-selected={selected?.id === s.id} data-hidden={!s.visible} data-dragging={dragId === s.id} draggable onDragStart={() => onDragStart(s.id)} onDragEnd={onDragEnd} onDragOver={onDragOver} onDrop={() => onDrop(s.id)} onClick={() => onSelect(s)}>
                <div className="ss-band__order">
                  {String(i + 1).padStart(2, '0')}
                  <GripVertical size={14} strokeWidth={1.5} className="ss-band__drag" />
                </div>
                <div className="ss-band__body">
                  <p className="ss-band__eyebrow">
                    {s.visible ? meta.title : <span className="ss-band__eyebrow--mute">{meta.title} · hidden</span>}
                  </p>
                  <h3 className="ss-band__name">{s.section_type}</h3>
                  <p className="ss-band__sub">{meta.intro}</p>
                  <div className="ss-band__meta">
                    {pm && <span className="ss-meta-chip">
                        <span className="ss-meta-chip__dot" style={{
                    backgroundColor: 'var(--bp-primary)'
                  }} />
                        {POSITIONING_MODES.find(p => p.v === pm)?.label || pm}
                      </span>}
                    {hv && <span className="ss-meta-chip">
                        <span className="ss-meta-chip__dot" style={{
                    backgroundColor: '#c8a572'
                  }} />
                        {HERO_VARIANTS.find(p => p.v === hv)?.label || hv}
                      </span>}
                    <span className="ss-meta-chip">
                      {mv.includes('all') ? 'Global presence' : `${mv.length} markets`}
                    </span>
                    <span className="ss-meta-chip">
                      {localeKeys.length || 1} {localeKeys.length === 1 ? 'locale' : 'locales'}
                    </span>
                  </div>
                </div>
                <div className="ss-band__actions">
                  <button type="button" className="ss-eye-btn" data-testid={`ss-toggle-${s.section_type}`} onClick={e => {
                e.stopPropagation();
                toggleVisible(s);
              }} title={s.visible ? 'Hide band' : 'Show band'}>
                    {s.visible ? <Eye size={14} strokeWidth={1.5} /> : <EyeOff size={14} strokeWidth={1.5} />}
                  </button>
                </div>
              </article>;
        })}
        </div>
      </div>

      {selected && <BandEditor section={selected} markets={markets} activeLocales={activeLocales} dirty={dirty} saving={saving} onPatch={onSectionPatch} onSave={saveSelected} onClose={() => {
      setSelected(null);
      setDirty(false);
    }} />}

      {previewOpen && (
        <LivePreviewPane
          pageKey={activePage}
          refreshKey={previewKey}
          onSectionClick={onPreviewSectionClick}
          selectedSectionType={selected?.section_type || null}
        />
      )}
    </div>;
};
const BandEditor = ({
  section,
  markets,
  activeLocales,
  dirty,
  saving,
  onPatch,
  onSave,
  onClose
}) => {
  const {
    t
  } = useT();
  const [localeTab, setLocaleTab] = useState(activeLocales[0] || 'it-IT');
  const meta = bandMeta(section.section_type);
  const settings = section.settings || {};
  const localeContent = section.locale_content || {};
  const localeData = localeContent[localeTab] || {};
  const isHero = ['hero', 'store_hero'].includes(section.section_type);
  const patchLocale = (field, value) => {
    const next = {
      ...localeContent,
      [localeTab]: {
        ...localeData,
        [field]: value
      }
    };
    onPatch({
      locale_content: next
    });
  };
  const patchSetting = (field, value) => {
    onPatch({
      settings: {
        ...settings,
        [field]: value
      }
    });
  };
  const toggleMarket = code => {
    const cur = settings.market_visibility || ['all'];
    let next;
    if (code === 'all') next = ['all'];else {
      const without = cur.filter(c => c !== 'all' && c !== code);
      if (cur.includes(code)) next = without.length === 0 ? ['all'] : without;else next = [...without, code];
    }
    patchSetting('market_visibility', next);
  };
  return <aside className="ss-editor" data-testid="ss-editor">
      <header className="ss-editor__head">
        <p className="ss-editor__eyebrow">{meta.title} · {section.section_type}</p>
        <h2 className="ss-editor__title">{meta.intro}</h2>
        <TraceabilityChip section_type={section.section_type} />
      </header>

      <div className="ss-locale-tabs" data-testid="ss-locale-tabs">
        {(activeLocales.length > 0 ? activeLocales : ['it-IT']).map(loc => <button key={loc} type="button" className="ss-locale-tab" data-active={localeTab === loc} data-testid={`ss-locale-tab-${loc}`} onClick={() => setLocaleTab(loc)}>
            {loc}
          </button>)}
      </div>

      {/* Specialized editors for hybrid renderers (nav_top, footer_columns,
          stats_band, brand_logos, magazine_grid, newsletter, dual_cta). */}
      {renderBandEditor({
      section,
      localeTab,
      activeLocales,
      onPatchLocale: patchLocale,
      onPatchSetting: patchSetting
    }) || <>
          <div className="ss-section">
            <p className="ss-section__label">Eyebrow / kicker</p>
            <input className="ss-input" data-testid="ss-field-eyebrow" value={localeData.eyebrow || ''} onChange={e => patchLocale('eyebrow', e.target.value)} placeholder={t("storefront.storefront_studio.sopra_titolo_editoriale")} />
          </div>
          <div className="ss-section">
            <p className="ss-section__label">Title</p>
            <textarea className="ss-textarea ss-input--display" data-testid="ss-field-title" rows={2} value={localeData.title || ''} onChange={e => patchLocale('title', e.target.value)} placeholder="Titolo cinematico" />
          </div>
          <div className="ss-section">
            <p className="ss-section__label">Subtitle</p>
            <textarea className="ss-textarea" data-testid="ss-field-subtitle" rows={2} value={localeData.subtitle || ''} onChange={e => patchLocale('subtitle', e.target.value)} />
          </div>
          <div className="ss-section">
            <p className="ss-section__label">Body</p>
            <textarea className="ss-textarea" data-testid="ss-field-body" rows={4} value={localeData.body || ''} onChange={e => patchLocale('body', e.target.value)} />
          </div>

          <div className="ss-section">
            <p className="ss-section__label">CTA · label · destination</p>
            <input className="ss-input" data-testid="ss-field-cta-label" value={localeData.cta_label || ''} onChange={e => patchLocale('cta_label', e.target.value)} placeholder="Es. Prenota un appuntamento" />
            <input className="ss-input" data-testid="ss-field-cta-href" style={{
          marginTop: 8
        }} value={localeData.cta_href || ''} onChange={e => patchLocale('cta_href', e.target.value)} placeholder="/start-project · /magazine · …" />
          </div>

          <div className="ss-section">
            <p className="ss-section__label">Cover image</p>
            <EditorialMediaField value={localeData.cover_url || settings.background_image_url || ''} onChange={v => patchLocale('cover_url', v)} preset="hero" bucket="tenant-assets" folder="storefront/hero" entityType="cms_section" entityId={section.id} role={`cover_${localeTab}`} testId="ss-field-cover-field" />
          </div>
        </>}

      <div className="ss-section">
        <p className="ss-section__label">Market visibility</p>
        <div className="ss-multi-chips" data-testid="ss-market-chips">
          <button type="button" className="ss-chip" data-active={(settings.market_visibility || ['all']).includes('all')} data-testid="ss-market-all" onClick={() => toggleMarket('all')}>Global · all markets</button>
          {markets.map(m => <button key={m.id} type="button" className="ss-chip" data-active={(settings.market_visibility || ['all']).includes(m.code)} data-testid={`ss-market-${m.code}`} onClick={() => toggleMarket(m.code)}>{m.code}</button>)}
        </div>
      </div>

      <div className="ss-section">
        <p className="ss-section__label">Positioning Mode™</p>
        <select className="ss-select" data-testid="ss-positioning-mode" value={settings.positioning_mode || ''} onChange={e => patchSetting('positioning_mode', e.target.value || null)}>
          <option value="">— Inherit from page</option>
          {POSITIONING_MODES.map(p => <option key={p.v} value={p.v}>{p.label}</option>)}
        </select>
      </div>

      {isHero && <div className="ss-section">
          <p className="ss-section__label">Hero orchestration</p>
          <select className="ss-select" data-testid="ss-hero-variant" value={settings.hero_variant || ''} onChange={e => patchSetting('hero_variant', e.target.value || null)}>
            <option value="">— Default cinematic</option>
            {HERO_VARIANTS.map(p => <option key={p.v} value={p.v}>{p.label}</option>)}
          </select>
        </div>}

      <div className="ss-actions">
        <button className="ss-btn" data-testid="ss-close" onClick={onClose}>{t('storefront.storefront_studio.chiudi')}</button>
        <button className="ss-btn ss-btn--primary" data-testid="ss-save" disabled={!dirty || saving} onClick={onSave}>
          {saving ? 'Salvataggio…' : 'Salva variante'}
        </button>
      </div>
    </aside>;
};
export default StorefrontStudioPage;