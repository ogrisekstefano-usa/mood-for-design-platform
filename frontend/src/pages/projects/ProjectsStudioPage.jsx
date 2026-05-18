/**
 * MOOD for DESIGN™ — Projects Studio™ (Phase S-CONNECT Step 3)
 *
 * Portfolio Cultural Adaptation Studio.
 *
 * NOT a project manager. NOT a CRM. NOT a Gantt board.
 *
 * This is the editorial room where the public perception of a project is
 * reinterpreted — culture by culture — without ever touching the master.
 *
 * Endpoints:
 *   GET    /api/portfolio/admin/projects                 → list masters
 *   POST   /api/portfolio/admin/projects                 → create master
 *   GET    /api/portfolio/admin/projects/{id}            → master + variants
 *   PATCH  /api/portfolio/admin/projects/{id}            → update master
 *   POST   /api/portfolio/admin/projects/{id}/publish    → publish master
 *   POST   /api/portfolio/admin/projects/{id}/compose    → compose variant
 *   PATCH  /api/portfolio/admin/variants/{vid}           → patch variant
 *   POST   /api/portfolio/admin/variants/{vid}/publish   → publish variant
 *   GET    /api/tenants/me/markets                       → active markets
 */
import React, { useEffect, useMemo, useState } from 'react';
import api from '../../lib/api';
import { toast } from 'sonner';
import EditorialMediaField from '../../components/common/EditorialMediaField';
import ProjectGalleryEditor from '../../components/storytelling/ProjectGalleryEditor';
import StorySectionsEditor from '../../components/storytelling/StorySectionsEditor';
import './projectsStudio.css';

const TABS = [
  { key: 'master',  label: 'Master Story' },
  { key: 'market',  label: 'Market Editions' },
];

const slugify = (s) => (s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

// Editorial loading lines — never "AI generated".
const COMPOSING_LINES = [
  'Reinterpreting the project for this market…',
  'Calibrating material vocabulary…',
  'Reframing hospitality tone…',
  'Composing market-native cadence…',
];

const ProjectsStudioPage = () => {
  const [masters, setMasters]       = useState([]);
  const [markets, setMarkets]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail]         = useState(null);    // { master, variants }
  const [tab, setTab]               = useState('master');
  const [activeMarketId, setActiveMarketId] = useState(null);
  const [dirty, setDirty]           = useState(false);
  const [saving, setSaving]         = useState(false);
  const [composing, setComposing]   = useState(false);
  const [composingLine, setComposingLine] = useState(COMPOSING_LINES[0]);
  const [showNewModal, setShowNewModal] = useState(false);

  // ── Initial load: masters + tenant markets
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [pR, mR] = await Promise.all([
          api.get('/api/portfolio/admin/projects'),
          api.get('/api/tenants/me/markets'),
        ]);
        if (!alive) return;
        setMasters(pR.data?.projects || []);
        setMarkets((mR.data?.markets || []).filter((m) => m.is_active));
      } catch (e) {
        toast.error(e?.response?.data?.detail || 'Caricamento fallito');
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  // ── Load full detail when a master is selected
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let alive = true;
    (async () => {
      try {
        const r = await api.get(`/api/portfolio/admin/projects/${selectedId}`);
        if (!alive) return;
        setDetail(r.data || null);
        setTab('master');
        setDirty(false);
      } catch (e) {
        toast.error(e?.response?.data?.detail || 'Caricamento progetto fallito');
      }
    })();
    return () => { alive = false; };
  }, [selectedId]);

  // ── Composing line rotation
  useEffect(() => {
    if (!composing) return;
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % COMPOSING_LINES.length;
      setComposingLine(COMPOSING_LINES[i]);
    }, 2200);
    return () => clearInterval(t);
  }, [composing]);

  // ── First market auto-pick once detail loads
  useEffect(() => {
    if (!detail || tab !== 'market') return;
    if (activeMarketId) return;
    if (markets.length === 0) return;
    setActiveMarketId(markets[0].id);
  }, [detail, tab, markets, activeMarketId]);

  const master = detail?.master || null;
  const variants = detail?.variants || [];
  const variantByMarket = useMemo(() => {
    const m = {};
    for (const v of variants) if (v.market_id) m[v.market_id] = v;
    return m;
  }, [variants]);
  const activeMarket  = markets.find((m) => m.id === activeMarketId) || null;
  const activeVariant = activeMarketId ? variantByMarket[activeMarketId] : null;

  const refreshMasters = async () => {
    try {
      const r = await api.get('/api/portfolio/admin/projects');
      setMasters(r.data?.projects || []);
    } catch { /* silent */ }
  };

  const reloadDetail = async () => {
    if (!selectedId) return;
    const r = await api.get(`/api/portfolio/admin/projects/${selectedId}`);
    setDetail(r.data || null);
  };

  // ── MASTER actions ────────────────────────────────────────
  const onMasterChange = (patch) => {
    setDetail((d) => d ? { ...d, master: { ...d.master, ...patch } } : d);
    setDirty(true);
  };

  const saveMaster = async () => {
    if (!master) return;
    setSaving(true);
    try {
      const body = {
        title: master.title,
        subtitle: master.subtitle,
        category: master.category,
        client: master.client,
        location: master.location,
        year: master.year ? Number(master.year) : null,
        cover_image_url: master.cover_image_url,
        material_palette: master.material_palette || [],
        story_body: master.story_body || [],
        gallery: master.gallery || [],
        default_locale: master.default_locale,
      };
      const r = await api.patch(`/api/portfolio/admin/projects/${master.id}`, body);
      setDetail((d) => ({ ...d, master: r.data }));
      setDirty(false);
      toast.success('Master story salvata');
      refreshMasters();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Salvataggio fallito');
    } finally { setSaving(false); }
  };

  const publishMaster = async () => {
    if (!master) return;
    try {
      await api.post(`/api/portfolio/admin/projects/${master.id}/publish`, {});
      toast.success('Progetto pubblicato');
      await reloadDetail();
      refreshMasters();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Pubblicazione fallita');
    }
  };

  // ── VARIANT actions ───────────────────────────────────────
  const onVariantChange = (patch) => {
    setDetail((d) => {
      const list = d.variants.map((v) =>
        v.id === activeVariant.id ? { ...v, ...patch } : v);
      return { ...d, variants: list };
    });
    setDirty(true);
  };

  const saveVariant = async () => {
    if (!activeVariant) return;
    setSaving(true);
    try {
      const body = {
        variant_title: activeVariant.variant_title,
        cultural_angle: activeVariant.cultural_angle,
        hospitality_tone: activeVariant.hospitality_tone,
        aspirational_narrative: activeVariant.aspirational_narrative,
        luxury_perception: activeVariant.luxury_perception,
        material_language: activeVariant.material_language || {},
        story_body: activeVariant.story_body || [],
        cta_set: activeVariant.cta_set || [],
        seo: activeVariant.seo || {},
        gallery_overrides: activeVariant.gallery_overrides || {},
      };
      const r = await api.patch(`/api/portfolio/admin/variants/${activeVariant.id}`, body);
      setDetail((d) => ({
        ...d,
        variants: d.variants.map((v) => v.id === r.data.id ? r.data : v),
      }));
      setDirty(false);
      toast.success('Market edition salvata');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Salvataggio fallito');
    } finally { setSaving(false); }
  };

  const publishVariant = async () => {
    if (!activeVariant) return;
    try {
      const r = await api.post(`/api/portfolio/admin/variants/${activeVariant.id}/publish`, {});
      setDetail((d) => ({
        ...d,
        variants: d.variants.map((v) => v.id === r.data.id ? r.data : v),
      }));
      toast.success('International edition pubblicata');
      refreshMasters();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Pubblicazione fallita');
    }
  };

  const composeMarketEdition = async () => {
    if (!master || !activeMarketId) return;
    setComposing(true);
    try {
      await api.post(`/api/portfolio/admin/projects/${master.id}/compose`, {
        market_id: activeMarketId,
      });
      await reloadDetail();
      toast.success('Market edition composta');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Composizione fallita');
    } finally { setComposing(false); }
  };

  // ── NEW master creation ───────────────────────────────────
  const [draft, setDraft] = useState({ title: '', category: 'residential', client: '', location: '' });
  const createMaster = async () => {
    if (!draft.title.trim()) { toast.error('Titolo richiesto'); return; }
    try {
      const slug = slugify(draft.title) + '-' + Math.floor(Math.random() * 9000 + 1000);
      const r = await api.post('/api/portfolio/admin/projects', {
        slug, title: draft.title.trim(),
        category: draft.category || null,
        client: draft.client || null,
        location: draft.location || null,
        default_locale: 'it-IT',
        story_body: [], gallery: [], material_palette: [],
      });
      setShowNewModal(false);
      setDraft({ title: '', category: 'residential', client: '', location: '' });
      await refreshMasters();
      setSelectedId(r.data.id);
      toast.success('Nuovo progetto aperto');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Creazione fallita');
    }
  };

  const onPaletteAdd = (value) => {
    const v = (value || '').trim();
    if (!v) return;
    onMasterChange({ material_palette: [...(master.material_palette || []), v] });
  };
  const onPaletteRemove = (idx) => {
    const list = [...(master.material_palette || [])];
    list.splice(idx, 1);
    onMasterChange({ material_palette: list });
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="ps-root" data-no-master={!master} data-testid="ps-root">
      {/* LEFT — MASTER ARCHIVE */}
      <aside className="ps-rail" data-testid="ps-rail">
        <header className="ps-rail__head">
          <p className="ps-rail__eyebrow">Blueprint · Portfolio Adaptation</p>
          <h1 className="ps-rail__title">Projects Studio<sup>™</sup></h1>
          <p className="ps-rail__intro">
            La sala in cui ogni progetto viene riposizionato culturalmente,
            mercato per mercato. Mai una traduzione — una reinterpretazione.
          </p>
          <button
            type="button"
            className="ps-rail__new"
            data-testid="ps-new-master"
            onClick={() => setShowNewModal(true)}
          >+ Apri un nuovo progetto</button>
        </header>

        <div className="ps-masters" data-testid="ps-masters">
          {loading && <p style={{ color: 'var(--bp-text-muted)', fontStyle: 'italic' }}>Caricamento archivio…</p>}
          {!loading && masters.length === 0 && (
            <p style={{ color: 'var(--bp-text-muted)', fontStyle: 'italic', fontFamily: 'var(--bp-font-heading)' }}>
              Nessun progetto in archivio. Apri il primo.
            </p>
          )}
          {masters.map((m) => {
            const pub = m.variants?.filter((v) => v.is_published).length || 0;
            const tot = m.variant_count || 0;
            return (
              <article
                key={m.id}
                className="ps-card"
                data-selected={selectedId === m.id}
                data-testid={`ps-card-${m.slug}`}
                onClick={() => setSelectedId(m.id)}
              >
                <div className={m.cover_image_url ? 'ps-card__cover' : 'ps-card__cover ps-card__cover--empty'}>
                  {m.cover_image_url
                    ? <img src={m.cover_image_url} alt={m.title} />
                    : <span>Nessuna immagine</span>}
                </div>
                <div className="ps-card__body">
                  <p className={'ps-card__eyebrow ' + (m.is_published ? '' : 'ps-card__eyebrow--mute')}>
                    {m.category || 'project'}
                  </p>
                  <h3 className="ps-card__title">{m.title}</h3>
                  {m.subtitle && <p className="ps-card__sub">{m.subtitle}</p>}
                  <div className="ps-card__meta">
                    <span className="ps-card__meta-dot" data-status={m.is_published ? 'published' : 'draft'}>
                      {m.is_published ? 'Live' : 'Bozza'}
                    </span>
                    <span className="ps-card__meta-dot">{pub}/{tot} edizioni</span>
                    {m.location && <span className="ps-card__meta-dot">{m.location}</span>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </aside>

      {/* RIGHT — STUDIO */}
      <main className="ps-stage" data-testid="ps-stage">
        {!master && (
          <div className="ps-empty">
            Seleziona un progetto a sinistra<br />o aprine uno nuovo per iniziare<br />l'adattamento culturale.
          </div>
        )}

        {master && (
          <>
            <header className="ps-stage__head">
              <div>
                <h2 className="ps-stage__title">{master.title}</h2>
                {master.subtitle && <p className="ps-stage__sub">{master.subtitle}</p>}
              </div>
              <div className="ps-stage__actions">
                <span className="ps-status-pill" data-testid="ps-master-status">
                  <span className="ps-status-pill__dot" data-status={master.is_published ? 'published' : 'draft'} />
                  {master.is_published ? 'Live' : 'Bozza'}
                </span>
                <button
                  type="button"
                  className="ps-btn"
                  data-testid="ps-publish-master"
                  disabled={master.is_published}
                  onClick={publishMaster}
                >Pubblica progetto</button>
              </div>
            </header>

            <nav className="ps-tabs" data-testid="ps-tabs">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className="ps-tab"
                  data-active={tab === t.key}
                  data-testid={`ps-tab-${t.key}`}
                  onClick={() => setTab(t.key)}
                >{t.label}</button>
              ))}
            </nav>

            {tab === 'master' && (
              <MasterStoryEditor
                master={master}
                onChange={onMasterChange}
                onPaletteAdd={onPaletteAdd}
                onPaletteRemove={onPaletteRemove}
                onSave={saveMaster}
                dirty={dirty}
                saving={saving}
              />
            )}

            {tab === 'market' && (
              <>
                <div className="ps-readout" data-testid="ps-readout">
                  Ogni edizione è una <em>reinterpretazione</em> — mai una traduzione.
                  L'apertura emotiva, il vocabolario materico e il tono di ospitalità
                  cambiano per parlare nativamente al mercato selezionato.
                </div>

                <nav className="ps-markets" data-testid="ps-markets">
                  {markets.map((m) => {
                    const v = variantByMarket[m.id];
                    const status = v ? (v.is_published ? 'published' : (v.status || 'draft')) : 'missing';
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className="ps-market-tab"
                        data-active={activeMarketId === m.id}
                        data-status={status}
                        data-testid={`ps-market-${m.code}`}
                        onClick={() => setActiveMarketId(m.id)}
                      >
                        <span className="ps-market-tab__dot" data-status={status} />
                        {(m.primary_locale || m.code || '').toUpperCase()}
                      </button>
                    );
                  })}
                </nav>

                {activeMarket && (
                  <MarketEditionEditor
                    master={master}
                    market={activeMarket}
                    variant={activeVariant}
                    onChange={onVariantChange}
                    onSave={saveVariant}
                    onPublish={publishVariant}
                    onCompose={composeMarketEdition}
                    dirty={dirty}
                    saving={saving}
                  />
                )}
              </>
            )}
          </>
        )}
      </main>

      {composing && (
        <div className="ps-composing-overlay" data-testid="ps-composing">
          <p className="ps-composing-overlay__eyebrow">Compose Market Edition</p>
          <p className="ps-composing-overlay__line">{composingLine}</p>
        </div>
      )}

      {showNewModal && (
        <div className="ps-modal-bg" onClick={() => setShowNewModal(false)}>
          <div className="ps-modal" onClick={(e) => e.stopPropagation()} data-testid="ps-new-modal">
            <h2>Apri un nuovo progetto</h2>
            <p className="ps-modal__sub">
              Crea il record master. Le edizioni internazionali si compongono in seguito.
            </p>
            <div className="ps-section">
              <p className="ps-section__label">Titolo del progetto</p>
              <input
                className="ps-input ps-input--display"
                data-testid="ps-new-title"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Villa Travertino"
              />
            </div>
            <div className="ps-grid-2">
              <div className="ps-section">
                <p className="ps-section__label">Categoria</p>
                <select
                  className="ps-select"
                  data-testid="ps-new-category"
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                >
                  <option value="residential">Residenziale</option>
                  <option value="hospitality">Hospitality</option>
                  <option value="commercial">Commercial</option>
                  <option value="atelier">Atelier</option>
                  <option value="wellness">Wellness</option>
                </select>
              </div>
              <div className="ps-section">
                <p className="ps-section__label">Località</p>
                <input
                  className="ps-input"
                  value={draft.location}
                  onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                  placeholder="Roma"
                />
              </div>
            </div>
            <div className="ps-section">
              <p className="ps-section__label">Cliente</p>
              <input
                className="ps-input"
                value={draft.client}
                onChange={(e) => setDraft({ ...draft, client: e.target.value })}
                placeholder="Privato · Studio · Brand"
              />
            </div>
            <div className="ps-modal__actions">
              <button type="button" className="ps-btn ps-btn--ghost" onClick={() => setShowNewModal(false)}>Annulla</button>
              <button type="button" className="ps-btn ps-btn--primary" data-testid="ps-new-create" onClick={createMaster}>
                Crea progetto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Master Story Editor (subcomponent) ────────────────────────
const MasterStoryEditor = ({ master, onChange, onPaletteAdd, onPaletteRemove, onSave, dirty, saving }) => {
  const [paletteInput, setPaletteInput] = useState('');
  return (
    <section data-testid="ps-master-tab">
      <div className="ps-grid-2">
        <div className="ps-section">
          <p className="ps-section__label">Titolo</p>
          <input
            className="ps-input ps-input--display"
            data-testid="ps-master-title"
            value={master.title || ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </div>
        <div className="ps-section">
          <p className="ps-section__label">Sottotitolo editoriale</p>
          <input
            className="ps-input"
            value={master.subtitle || ''}
            onChange={(e) => onChange({ subtitle: e.target.value })}
            placeholder="Atmosfera, materia, ritmo"
          />
        </div>
      </div>

      <div className="ps-grid-3">
        <div className="ps-section">
          <p className="ps-section__label">Categoria</p>
          <select
            className="ps-select"
            value={master.category || ''}
            onChange={(e) => onChange({ category: e.target.value })}
          >
            <option value="">—</option>
            <option value="residential">Residenziale</option>
            <option value="hospitality">Hospitality</option>
            <option value="commercial">Commercial</option>
            <option value="atelier">Atelier</option>
            <option value="wellness">Wellness</option>
          </select>
        </div>
        <div className="ps-section">
          <p className="ps-section__label">Cliente</p>
          <input
            className="ps-input"
            value={master.client || ''}
            onChange={(e) => onChange({ client: e.target.value })}
          />
        </div>
        <div className="ps-section">
          <p className="ps-section__label">Località</p>
          <input
            className="ps-input"
            value={master.location || ''}
            onChange={(e) => onChange({ location: e.target.value })}
          />
        </div>
      </div>

      <div className="ps-grid-2">
        <div className="ps-section">
          <p className="ps-section__label">Anno</p>
          <input
            type="number"
            className="ps-input"
            value={master.year || ''}
            onChange={(e) => onChange({ year: e.target.value })}
          />
        </div>
        <div className="ps-section">
          <p className="ps-section__label">Locale canonico</p>
          <select
            className="ps-select"
            value={master.default_locale || 'it-IT'}
            onChange={(e) => onChange({ default_locale: e.target.value })}
          >
            <option value="it-IT">it-IT</option>
            <option value="en-US">en-US</option>
            <option value="en-GB">en-GB</option>
            <option value="fr-FR">fr-FR</option>
            <option value="de-DE">de-DE</option>
            <option value="es-ES">es-ES</option>
          </select>
        </div>
      </div>

      <div className="ps-section">
        <p className="ps-section__label">Cover hero · l'apertura visiva del progetto</p>
        <EditorialMediaField
          valueShape="object"
          value={{
            url: master.cover_image_url || '',
            asset_id: master.cover_asset_id || null,
            alt_text: master.cover_alt_text || '',
            caption: master.cover_caption || '',
          }}
          onChange={(v) => onChange({
            cover_image_url: v.url || '',
            cover_asset_id: v.asset_id || null,
            cover_alt_text: v.alt_text || '',
            cover_caption: v.caption || '',
          })}
          preset="hero"
          entityType="portfolio_project"
          entityId={master.id}
          role="cover"
          testId="ps-cover-media"
          helperText="L'immagine che apre la case history e diventa la cover di archive."
        />
      </div>

      <ProjectGalleryEditor
        gallery={master.gallery || []}
        coverUrl={master.cover_image_url || ''}
        onChange={(next) => onChange({ gallery: next })}
        onSetCover={(url) => onChange({ cover_image_url: url })}
        entityType="portfolio_project"
        entityId={master.id}
        testId="ps-project-gallery"
      />

      <div className="ps-section">
        <p className="ps-section__label">Vocabolario materico</p>
        <div className="ps-chips" data-testid="ps-material-palette">
          {(master.material_palette || []).map((p, i) => (
            <span key={i} className="ps-chip">
              {p}
              <button type="button" onClick={() => onPaletteRemove(i)} aria-label="rimuovi">×</button>
            </span>
          ))}
          <input
            className="ps-input"
            style={{ maxWidth: 220, padding: '6px 12px', fontSize: 12 }}
            value={paletteInput}
            onChange={(e) => setPaletteInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); onPaletteAdd(paletteInput); setPaletteInput(''); }
            }}
            placeholder="aggiungi…"
          />
        </div>
      </div>

      <StorySectionsEditor
        blocks={master.story_body || []}
        onChange={(next) => onChange({ story_body: next })}
        hotspotMode="memory"
        entityType="portfolio_project"
        entityId={master.id}
        testId="ps-master-story"
      />

      <div className="ps-section" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button
          type="button"
          className="ps-btn ps-btn--primary"
          data-testid="ps-save-master"
          disabled={!dirty || saving}
          onClick={onSave}
        >{saving ? 'Salvataggio…' : 'Salva master story'}</button>
      </div>
    </section>
  );
};

// ── Market Edition Editor (subcomponent) ──────────────────────
const MarketEditionEditor = ({ master, market, variant, onChange, onSave, onPublish, onCompose, dirty, saving }) => {
  const v = variant || {};
  const ml = v.material_language || {};
  const seo = v.seo || {};
  const ctaSet = v.cta_set || [];

  if (!variant) {
    return (
      <section data-testid="ps-market-empty">
        <div className="ps-readout">
          Nessuna edizione per <em>{market.code}</em> ancora composta.
          Avvia una <em>Compose Market Edition</em> per generare una prima narrativa adattata
          al tono editoriale, alla percezione di lusso e alla cultura ospitale di questo mercato.
        </div>
        <button
          type="button"
          className="ps-btn ps-btn--primary"
          data-testid="ps-compose"
          onClick={onCompose}
        >Compose Market Edition</button>
      </section>
    );
  }

  return (
    <section data-testid="ps-market-tab">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <span className="ps-status-pill" data-testid="ps-variant-status">
          <span className="ps-status-pill__dot" data-status={v.is_published ? 'published' : (v.status || 'draft')} />
          {v.is_published ? 'Live' : (v.status === 'ready' ? 'Pronta' : (v.status === 'composing' ? 'In composizione' : 'Bozza'))} · {market.code}
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="ps-btn" data-testid="ps-recompose" onClick={onCompose}>
            Adapt for Market
          </button>
          <button
            type="button"
            className="ps-btn ps-btn--primary"
            data-testid="ps-publish-variant"
            disabled={v.is_published || !master.is_published}
            onClick={onPublish}
          >Publish International Edition</button>
        </div>
      </div>

      <div className="ps-section">
        <p className="ps-section__label">Titolo per il mercato</p>
        <input
          className="ps-input ps-input--display"
          data-testid="ps-variant-title"
          value={v.variant_title || ''}
          onChange={(e) => onChange({ variant_title: e.target.value })}
        />
      </div>

      <div className="ps-section">
        <p className="ps-section__label">Cultural angle · l'apertura emotiva</p>
        <textarea
          className="ps-textarea"
          data-testid="ps-cultural-angle"
          value={v.cultural_angle || ''}
          onChange={(e) => onChange({ cultural_angle: e.target.value })}
        />
      </div>

      <div className="ps-grid-2">
        <div className="ps-section">
          <p className="ps-section__label">Hospitality tone</p>
          <textarea
            className="ps-textarea"
            value={v.hospitality_tone || ''}
            onChange={(e) => onChange({ hospitality_tone: e.target.value })}
          />
        </div>
        <div className="ps-section">
          <p className="ps-section__label">Luxury perception</p>
          <textarea
            className="ps-textarea"
            value={v.luxury_perception || ''}
            onChange={(e) => onChange({ luxury_perception: e.target.value })}
          />
        </div>
      </div>

      <div className="ps-section">
        <p className="ps-section__label">Aspirational narrative</p>
        <textarea
          className="ps-textarea"
          value={v.aspirational_narrative || ''}
          onChange={(e) => onChange({ aspirational_narrative: e.target.value })}
        />
      </div>

      <div className="ps-section">
        <p className="ps-section__label">Refine Material Narrative · materia primaria · secondaria · tattilità</p>
        <div className="ps-grid-3">
          <input
            className="ps-input"
            data-testid="ps-material-primary"
            value={ml.primary || ''}
            placeholder="Materia primaria"
            onChange={(e) => onChange({ material_language: { ...ml, primary: e.target.value } })}
          />
          <input
            className="ps-input"
            value={ml.secondary || ''}
            placeholder="Materia secondaria"
            onChange={(e) => onChange({ material_language: { ...ml, secondary: e.target.value } })}
          />
          <input
            className="ps-input"
            value={ml.tactile || ''}
            placeholder="Tattilità"
            onChange={(e) => onChange({ material_language: { ...ml, tactile: e.target.value } })}
          />
        </div>
      </div>

      <div className="ps-section">
        <p className="ps-section__label">Story body adattata · blocchi narrativi modulari</p>
        <StorySectionsEditor
          blocks={v.story_body || []}
          onChange={(next) => onChange({ story_body: next })}
          hotspotMode="memory"
          entityType="portfolio_variant"
          entityId={v.id}
          testId="ps-variant-story"
        />
      </div>

      <div className="ps-section">
        <p className="ps-section__label">CTA market-native</p>
        {ctaSet.map((c, i) => (
          <div key={i} className="ps-grid-3" style={{ marginBottom: 10 }}>
            <select
              className="ps-select"
              value={c.tier || 'soft'}
              onChange={(e) => {
                const next = [...ctaSet]; next[i] = { ...c, tier: e.target.value };
                onChange({ cta_set: next });
              }}
            >
              <option value="soft">Soft</option>
              <option value="medium">Medium</option>
              <option value="strong">Strong</option>
            </select>
            <input
              className="ps-input"
              value={c.label || ''}
              placeholder="Etichetta CTA market-native"
              onChange={(e) => {
                const next = [...ctaSet]; next[i] = { ...c, label: e.target.value };
                onChange({ cta_set: next });
              }}
            />
            <select
              className="ps-select"
              value={c.action || 'book_consultation'}
              onChange={(e) => {
                const next = [...ctaSet]; next[i] = { ...c, action: e.target.value };
                onChange({ cta_set: next });
              }}
            >
              <option value="book_consultation">Book consultation</option>
              <option value="request_visit">Request visit</option>
              <option value="explore_material">Explore material</option>
              <option value="save_reference">Save reference</option>
            </select>
          </div>
        ))}
        <button
          type="button"
          className="ps-btn ps-btn--ghost"
          onClick={() => onChange({ cta_set: [...ctaSet, { tier: 'soft', label: '', action: 'book_consultation' }] })}
        >+ Aggiungi CTA</button>
      </div>

      <div className="ps-grid-2">
        <div className="ps-section">
          <p className="ps-section__label">SEO · title</p>
          <input
            className="ps-input"
            value={seo.seo_title || ''}
            onChange={(e) => onChange({ seo: { ...seo, seo_title: e.target.value } })}
          />
        </div>
        <div className="ps-section">
          <p className="ps-section__label">SEO · focus intent</p>
          <input
            className="ps-input"
            value={seo.focus_intent || ''}
            onChange={(e) => onChange({ seo: { ...seo, focus_intent: e.target.value } })}
          />
        </div>
      </div>

      <div className="ps-section">
        <p className="ps-section__label">SEO · meta description</p>
        <textarea
          className="ps-textarea"
          value={seo.meta_description || ''}
          onChange={(e) => onChange({ seo: { ...seo, meta_description: e.target.value } })}
        />
      </div>

      <div className="ps-section" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button
          type="button"
          className="ps-btn ps-btn--primary"
          data-testid="ps-save-variant"
          disabled={!dirty || saving}
          onClick={onSave}
        >{saving ? 'Salvataggio…' : 'Salva market edition'}</button>
      </div>
    </section>
  );
};

export default ProjectsStudioPage;
