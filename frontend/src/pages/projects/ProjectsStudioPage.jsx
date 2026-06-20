/**
 * MOOD for DESIGN™ — Projects Content Studio™
 *
 * Blueprint admin per la gestione completa di Published Design Journeys.
 *
 * Un progetto = una riga in published_design_journeys.
 * Gallery e body blocks (incluso YouTube) sono salvati in story_content (JSONB).
 * Traduzioni per locale salvate in published_design_journey_translations.
 *
 * Endpoints utilizzati:
 *   GET    /api/admin/published-journeys/               → lista progetti
 *   POST   /api/admin/published-journeys/               → crea progetto
 *   GET    /api/admin/published-journeys/{id}           → dettaglio + traduzioni
 *   PATCH  /api/admin/published-journeys/{id}           → aggiorna (incluso story_content)
 *   DELETE /api/admin/published-journeys/{id}           → archivia
 *   PUT    /api/admin/published-journeys/{id}/translations/{locale} → upsert traduzione
 */
import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { toast } from 'sonner';
import EditorialMediaField from '../../components/common/EditorialMediaField';
import ProjectGalleryEditor from '../../components/storytelling/ProjectGalleryEditor';
import StorySectionsEditor from '../../components/storytelling/StorySectionsEditor';
import './projectsStudio.css';

const TABS = [
  { key: 'progetto',    label: 'Progetto' },
  { key: 'traduzioni',  label: 'Traduzioni' },
  { key: 'seo',         label: 'SEO & Visibilità' },
];

const TRANS_LOCALES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'es-ES', label: 'Español (España)' },
  { code: 'es-MX', label: 'Español (México)' },
  { code: 'it-IT', label: 'Italiano' },
];

const PROJECT_TYPES = ['Residenziale', 'Hospitality', 'Retail', 'Contract', 'Wellness', 'Office'];
const VISIBILITY_OPTIONS = [
  { value: 'draft',     label: 'Bozza' },
  { value: 'published', label: 'Pubblicato' },
  { value: 'archived',  label: 'Archiviato' },
];

const slugify = s => (s || '').toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const ProjectsStudioPage = () => {
  const [journeys,     setJourneys]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedId,   setSelectedId]   = useState(null);
  const [detail,       setDetail]       = useState(null);   // { item, translations }
  const [tab,          setTab]          = useState('progetto');
  const [dirty,        setDirty]        = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [transLocale,  setTransLocale]  = useState('en-US');

  // ── Caricamento lista ──────────────────────────────────────────────────
  const fetchList = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/admin/published-journeys/');
      setJourneys(r.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Caricamento lista fallito');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, []);

  // ── Caricamento dettaglio ──────────────────────────────────────────────
  const fetchDetail = async (id) => {
    try {
      const r = await api.get(`/api/admin/published-journeys/${id}`);
      setDetail(r.data);
      setTab('progetto');
      setDirty(false);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Caricamento dettaglio fallito');
    }
  };

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    fetchDetail(selectedId);
  }, [selectedId]);

  // ── Aggiornamento campi item ───────────────────────────────────────────
  const onChange = (patch) => {
    setDetail(d => ({ ...d, item: { ...d.item, ...patch } }));
    setDirty(true);
  };

  const onStoryContentChange = (patch) => {
    setDetail(d => ({
      ...d,
      item: {
        ...d.item,
        story_content: { ...(d.item.story_content || {}), ...patch },
      },
    }));
    setDirty(true);
  };

  // ── Salvataggio ────────────────────────────────────────────────────────
  const save = async () => {
    if (!detail?.item) return;
    setSaving(true);
    try {
      await api.patch(`/api/admin/published-journeys/${selectedId}`, detail.item);
      await fetchDetail(selectedId);
      await fetchList();
      toast.success('Progetto salvato');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Salvataggio fallito');
    } finally {
      setSaving(false);
    }
  };

  // ── Pubblica / Archivia ────────────────────────────────────────────────
  const setStatus = async (status) => {
    try {
      await api.patch(`/api/admin/published-journeys/${selectedId}`, { visibility_status: status });
      await fetchDetail(selectedId);
      await fetchList();
      toast.success(`Progetto ${status === 'published' ? 'pubblicato' : status}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Operazione fallita');
    }
  };

  // ── Salva traduzione ───────────────────────────────────────────────────
  const saveTrans = async (locale, transData) => {
    try {
      await api.put(`/api/admin/published-journeys/${selectedId}/translations/${locale}`, transData);
      await fetchDetail(selectedId);
      toast.success(`Traduzione ${locale} salvata`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Salvataggio traduzione fallito');
    }
  };

  // ── Crea nuovo progetto ────────────────────────────────────────────────
  const createJourney = async (fields) => {
    try {
      const r = await api.post('/api/admin/published-journeys/', fields);
      await fetchList();
      setSelectedId(r.data?.item?.id || r.data?.id);
      setShowNewModal(false);
      toast.success('Progetto creato');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Creazione fallita');
    }
  };

  const item         = detail?.item || null;
  const translations = detail?.translations || [];

  return (
    <div className="ps-root" data-testid="projects-studio-page">
      {/* ═══ RAIL SINISTRA ════════════════════════════════════════════════ */}
      <aside className="ps-rail">
        <header className="ps-rail__head">
          <p className="ps-rail__eyebrow">Content Studio™</p>
          <h1 className="ps-rail__title">
            Published Journeys<sup>®</sup>
          </h1>
          <p className="ps-rail__intro">
            Gestisci gallery, hotspot, video YouTube, traduzioni e SEO direttamente da Blueprint.
          </p>
          <button
            className="ps-rail__new"
            data-testid="ps-new-journey-btn"
            onClick={() => setShowNewModal(true)}
          >
            + Nuovo progetto
          </button>
        </header>

        <div className="ps-masters">
          {loading && (
            <div style={{ padding: '32px 20px', opacity: 0.5, fontSize: 13 }}>
              Caricamento…
            </div>
          )}
          {!loading && journeys.length === 0 && (
            <div style={{ padding: '32px 20px', opacity: 0.5, fontSize: 13 }}>
              Nessun progetto ancora. Creane uno.
            </div>
          )}
          {journeys.map(j => (
            <article
              key={j.id}
              className="ps-card"
              data-selected={selectedId === j.id}
              data-testid={`ps-journey-card-${j.id}`}
              onClick={() => setSelectedId(j.id)}
            >
              <div className="ps-card__cover">
                {j.hero_url
                  ? <img src={j.hero_url} alt={j.title} />
                  : <div className="ps-card__cover--empty" />
                }
              </div>
              <div className="ps-card__body">
                <p className="ps-card__eyebrow">{j.project_type || 'Progetto'}</p>
                <h3 className="ps-card__title">{j.title || '—'}</h3>
                <div className="ps-card__meta">
                  <span
                    className="ps-card__meta-dot"
                    data-status={j.visibility_status}
                    data-testid={`ps-status-${j.id}`}
                  >
                    {j.visibility_status}
                  </span>
                  {j.location && <span>{j.location}</span>}
                  {j.year && <span>{j.year}</span>}
                </div>
              </div>
            </article>
          ))}
        </div>
      </aside>

      {/* ═══ STAGE DESTRO ═════════════════════════════════════════════════ */}
      <main className="ps-stage">
        {!item && (
          <div className="ps-empty" data-testid="ps-empty-state">
            <p>Seleziona un progetto dal pannello sinistro</p>
            <p style={{ marginTop: 8, opacity: 0.5 }}>o crea un nuovo progetto</p>
          </div>
        )}

        {item && (
          <>
            {/* ── Intestazione stage ── */}
            <header className="ps-stage__head">
              <div>
                <h2 className="ps-stage__title" data-testid="ps-detail-title">{item.title || '—'}</h2>
                <p className="ps-stage__sub">{item.location}{item.year ? ` · ${item.year}` : ''}</p>
              </div>
              <div className="ps-stage__actions">
                <span className="ps-status-pill" data-testid="ps-detail-status">
                  <span className="ps-status-pill__dot" data-status={item.visibility_status} />
                  {item.visibility_status}
                </span>
                {item.visibility_status !== 'published' && (
                  <button
                    className="ps-btn ps-btn--primary"
                    data-testid="ps-publish-btn"
                    onClick={() => setStatus('published')}
                  >
                    Pubblica
                  </button>
                )}
                {item.visibility_status !== 'archived' && (
                  <button
                    className="ps-btn ps-btn--ghost"
                    data-testid="ps-archive-btn"
                    onClick={() => setStatus('archived')}
                  >
                    Archivia
                  </button>
                )}
              </div>
            </header>

            {/* ── Tabs ── */}
            <nav className="ps-tabs" data-testid="ps-tabs">
              {TABS.map(t => (
                <button
                  key={t.key}
                  className={`ps-tab${tab === t.key ? ' ps-tab--active' : ''}`}
                  data-active={tab === t.key}
                  data-testid={`ps-tab-${t.key}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            {/* ── Tab: Progetto ── */}
            {tab === 'progetto' && (
              <ProgettoTab
                item={item}
                onChange={onChange}
                onStoryContentChange={onStoryContentChange}
                onSave={save}
                dirty={dirty}
                saving={saving}
              />
            )}

            {/* ── Tab: Traduzioni ── */}
            {tab === 'traduzioni' && (
              <TraduzioniTab
                journeyId={selectedId}
                translations={translations}
                onSave={saveTrans}
                locale={transLocale}
                onLocaleChange={setTransLocale}
              />
            )}

            {/* ── Tab: SEO & Visibilità ── */}
            {tab === 'seo' && (
              <SeoTab
                item={item}
                onChange={onChange}
                onSave={save}
                dirty={dirty}
                saving={saving}
              />
            )}
          </>
        )}
      </main>

      {/* ═══ MODALE NUOVO PROGETTO ════════════════════════════════════════ */}
      {showNewModal && (
        <NewJourneyModal
          onCreate={createJourney}
          onClose={() => setShowNewModal(false)}
        />
      )}
    </div>
  );
};

// ─── TAB: PROGETTO ───────────────────────────────────────────────────────────
const ProgettoTab = ({ item, onChange, onStoryContentChange, onSave, dirty, saving }) => {
  const sc = item.story_content || {};

  return (
    <section className="ps-editor" data-testid="ps-tab-progetto-content">
      <div className="ps-grid-2">
        <div className="ps-section">
          <label className="ps-section__label">Titolo *</label>
          <input
            className="ps-input"
            data-testid="ps-field-title"
            value={item.title || ''}
            onChange={e => onChange({ title: e.target.value })}
          />
        </div>
        <div className="ps-section">
          <label className="ps-section__label">Tipo progetto</label>
          <select
            className="ps-input"
            data-testid="ps-field-project-type"
            value={item.project_type || ''}
            onChange={e => onChange({ project_type: e.target.value })}
          >
            <option value="">— Seleziona —</option>
            {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="ps-section">
          <label className="ps-section__label">Location</label>
          <input
            className="ps-input"
            data-testid="ps-field-location"
            value={item.location || ''}
            onChange={e => onChange({ location: e.target.value })}
          />
        </div>
        <div className="ps-section">
          <label className="ps-section__label">Anno</label>
          <input
            className="ps-input"
            data-testid="ps-field-year"
            type="number"
            value={item.year || ''}
            onChange={e => onChange({ year: e.target.value ? parseInt(e.target.value) : null })}
          />
        </div>
        <div className="ps-section">
          <label className="ps-section__label">Lingua canonica</label>
          <select
            className="ps-input"
            data-testid="ps-field-canonical-locale"
            value={item.canonical_locale || 'it-IT'}
            onChange={e => onChange({ canonical_locale: e.target.value })}
          >
            {TRANS_LOCALES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
        <div className="ps-section">
          <label className="ps-section__label">Slug (URL)</label>
          <input
            className="ps-input ps-input--display"
            data-testid="ps-field-slug"
            value={item.slug || ''}
            onChange={e => onChange({ slug: slugify(e.target.value) })}
          />
        </div>
      </div>

      <div className="ps-section">
        <label className="ps-section__label">Atmosfera / Angle editoriale</label>
        <textarea
          className="ps-textarea"
          data-testid="ps-field-atmosphere"
          rows={3}
          value={item.atmosphere || ''}
          onChange={e => onChange({ atmosphere: e.target.value })}
          placeholder="L'atmosfera del progetto in una frase editoriale…"
        />
      </div>

      <div className="ps-section">
        <label className="ps-section__label">Excerpt editoriale</label>
        <textarea
          className="ps-textarea"
          data-testid="ps-field-excerpt"
          rows={3}
          value={item.excerpt || item.editorial_excerpt || ''}
          onChange={e => onChange({ excerpt: e.target.value, editorial_excerpt: e.target.value })}
          placeholder="Breve sintesi editoriale…"
        />
      </div>

      <div className="ps-section">
        <label className="ps-section__label">Immagine Hero</label>
        <EditorialMediaField
          valueShape="url"
          value={item.hero_url || ''}
          onChange={url => onChange({ hero_url: url })}
          preset="hero"
          entityType="published_journey"
          entityId={item.id}
          role="hero"
          testId="ps-hero-media"
        />
      </div>

      <div className="ps-section">
        <label className="ps-section__label">Gallery del progetto</label>
        <p style={{ fontSize: 12, opacity: 0.55, marginBottom: 8 }}>
          Trascina per riordinare · Clicca sui pin per gestire gli hotspot
        </p>
        <ProjectGalleryEditor
          gallery={sc.gallery || []}
          coverUrl={item.hero_url || ''}
          onChange={nextGallery => onStoryContentChange({ gallery: nextGallery })}
          onSetCover={url => onChange({ hero_url: url })}
          entityType="published_journey"
          entityId={item.id}
          testId="ps-gallery-editor"
        />
      </div>

      <div className="ps-section">
        <label className="ps-section__label">Body del progetto (paragrafi, immagini, YouTube)</label>
        <p style={{ fontSize: 12, opacity: 0.55, marginBottom: 8 }}>
          Aggiungi sezioni narrative. Il blocco "Video YouTube" permette di inserire video dal canale dello studio.
        </p>
        <StorySectionsEditor
          blocks={sc.body_blocks || []}
          onChange={nextBlocks => onStoryContentChange({ body_blocks: nextBlocks })}
          hotspotMode="memory"
          entityType="published_journey"
          entityId={item.id}
          testId="ps-story-editor"
        />
      </div>

      <div className="ps-section">
        <label className="ps-section__label">Material Tags</label>
        <MaterialTagsInput
          tags={item.material_tags || []}
          onChange={tags => onChange({ material_tags: tags })}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 32, paddingBottom: 32 }}>
        <button
          className="ps-btn ps-btn--primary"
          data-testid="ps-save-progetto-btn"
          disabled={!dirty || saving}
          onClick={onSave}
        >
          {saving ? 'Salvataggio…' : 'Salva modifiche'}
        </button>
      </div>
    </section>
  );
};

// ─── TAB: TRADUZIONI ─────────────────────────────────────────────────────────
const TraduzioniTab = ({ journeyId, translations, onSave, locale, onLocaleChange }) => {
  const existing = translations.find(t => t.locale === locale) || null;
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      title:             existing?.title             || '',
      editorial_excerpt: existing?.editorial_excerpt || '',
      atmosphere:        existing?.atmosphere        || '',
      location:          existing?.location          || '',
      seo_title:         existing?.seo_title         || '',
      seo_description:   existing?.seo_description   || '',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, existing?.id]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(locale, form);
    setSaving(false);
  };

  return (
    <section className="ps-editor" data-testid="ps-tab-traduzioni-content">
      <div className="ps-section">
        <label className="ps-section__label">Lingua di traduzione</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {TRANS_LOCALES.map(l => {
            const hasTrans = translations.some(t => t.locale === l.code);
            return (
              <button
                key={l.code}
                className={`ps-btn${locale === l.code ? ' ps-btn--primary' : ''}`}
                data-testid={`ps-trans-locale-${l.code}`}
                onClick={() => onLocaleChange(l.code)}
                style={{ position: 'relative' }}
              >
                {l.label}
                {hasTrans && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4,
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#87b88a', border: '1.5px solid var(--bp-bg)',
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {existing && (
        <div style={{ background: 'rgba(135,184,138,0.1)', border: '1px solid rgba(135,184,138,0.3)', borderRadius: 6, padding: '8px 14px', marginBottom: 20, fontSize: 12, color: '#87b88a' }}>
          Traduzione esistente per {locale}
        </div>
      )}

      <div className="ps-grid-2">
        <div className="ps-section">
          <label className="ps-section__label">Titolo ({locale})</label>
          <input
            className="ps-input"
            data-testid="ps-trans-title"
            value={form.title || ''}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
        </div>
        <div className="ps-section">
          <label className="ps-section__label">Location ({locale})</label>
          <input
            className="ps-input"
            data-testid="ps-trans-location"
            value={form.location || ''}
            onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
          />
        </div>
      </div>

      <div className="ps-section">
        <label className="ps-section__label">Atmosfera ({locale})</label>
        <textarea
          className="ps-textarea"
          data-testid="ps-trans-atmosphere"
          rows={2}
          value={form.atmosphere || ''}
          onChange={e => setForm(f => ({ ...f, atmosphere: e.target.value }))}
        />
      </div>

      <div className="ps-section">
        <label className="ps-section__label">Excerpt ({locale})</label>
        <textarea
          className="ps-textarea"
          data-testid="ps-trans-excerpt"
          rows={3}
          value={form.editorial_excerpt || ''}
          onChange={e => setForm(f => ({ ...f, editorial_excerpt: e.target.value }))}
        />
      </div>

      <div className="ps-section" style={{ borderTop: '1px solid var(--bp-border)', paddingTop: 20, marginTop: 8 }}>
        <label className="ps-section__label">SEO Title ({locale})</label>
        <input
          className="ps-input"
          data-testid="ps-trans-seo-title"
          value={form.seo_title || ''}
          onChange={e => setForm(f => ({ ...f, seo_title: e.target.value }))}
        />
      </div>

      <div className="ps-section">
        <label className="ps-section__label">SEO Description ({locale})</label>
        <textarea
          className="ps-textarea"
          data-testid="ps-trans-seo-desc"
          rows={2}
          value={form.seo_description || ''}
          onChange={e => setForm(f => ({ ...f, seo_description: e.target.value }))}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32, paddingBottom: 32 }}>
        <button
          className="ps-btn ps-btn--primary"
          data-testid="ps-save-trans-btn"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? 'Salvataggio…' : `Salva traduzione ${locale}`}
        </button>
      </div>
    </section>
  );
};

// ─── TAB: SEO & VISIBILITÀ ────────────────────────────────────────────────────
const SeoTab = ({ item, onChange, onSave, dirty, saving }) => (
  <section className="ps-editor" data-testid="ps-tab-seo-content">
    <div className="ps-section">
      <label className="ps-section__label">SEO Title</label>
      <input
        className="ps-input"
        data-testid="ps-field-seo-title"
        value={item.seo_title || ''}
        onChange={e => onChange({ seo_title: e.target.value })}
        placeholder="Titolo per Google (≤ 60 caratteri)"
      />
    </div>

    <div className="ps-section">
      <label className="ps-section__label">SEO Description</label>
      <textarea
        className="ps-textarea"
        data-testid="ps-field-seo-desc"
        rows={3}
        value={item.seo_description || ''}
        onChange={e => onChange({ seo_description: e.target.value })}
        placeholder="Descrizione per Google (≤ 160 caratteri)"
      />
    </div>

    <div className="ps-section" style={{ borderTop: '1px solid var(--bp-border)', paddingTop: 20, marginTop: 8 }}>
      <label className="ps-section__label">Stato visibilità</label>
      <select
        className="ps-input"
        data-testid="ps-field-visibility"
        value={item.visibility_status || 'draft'}
        onChange={e => onChange({ visibility_status: e.target.value })}
      >
        {VISIBILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>

    <div className="ps-grid-2">
      <div className="ps-section">
        <label className="ps-section__label">Ordine in homepage</label>
        <input
          className="ps-input"
          data-testid="ps-field-featured-order"
          type="number"
          min={0}
          value={item.featured_order ?? ''}
          onChange={e => onChange({ featured_order: e.target.value !== '' ? parseInt(e.target.value) : null })}
        />
      </div>
      <div className="ps-section" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', paddingBottom: 12 }}>
          <input
            type="checkbox"
            data-testid="ps-field-homepage-featured"
            checked={!!item.homepage_featured}
            onChange={e => onChange({ homepage_featured: e.target.checked })}
            style={{ width: 16, height: 16 }}
          />
          <span className="ps-section__label" style={{ margin: 0 }}>In evidenza in homepage</span>
        </label>
      </div>
    </div>

    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32, paddingBottom: 32 }}>
      <button
        className="ps-btn ps-btn--primary"
        data-testid="ps-save-seo-btn"
        disabled={!dirty || saving}
        onClick={onSave}
      >
        {saving ? 'Salvataggio…' : 'Salva SEO & Visibilità'}
      </button>
    </div>
  </section>
);

// ─── MATERIAL TAGS INPUT ──────────────────────────────────────────────────────
const MaterialTagsInput = ({ tags, onChange }) => {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (!v || tags.includes(v)) { setInput(''); return; }
    onChange([...tags, v]);
    setInput('');
  };
  return (
    <div>
      <div className="ps-chips" style={{ marginBottom: 8 }}>
        {tags.map(t => (
          <span key={t} className="ps-chip" data-testid={`ps-tag-${t}`}>
            {t}
            <button
              type="button"
              style={{ marginLeft: 6, cursor: 'pointer', background: 'none', border: 'none', padding: 0, color: 'inherit', opacity: 0.6 }}
              onClick={() => onChange(tags.filter(x => x !== t))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="ps-input"
          data-testid="ps-tag-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Aggiungi tag materiale…"
          style={{ flex: 1 }}
        />
        <button className="ps-btn" type="button" onClick={add}>+</button>
      </div>
    </div>
  );
};

// ─── MODALE NUOVO PROGETTO ────────────────────────────────────────────────────
const NewJourneyModal = ({ onCreate, onClose }) => {
  const [form, setForm] = useState({
    title:            '',
    project_type:     '',
    location:         '',
    year:             new Date().getFullYear(),
    canonical_locale: 'it-IT',
    slug:             '',
    visibility_status: 'draft',
  });

  const handleCreate = () => {
    if (!form.title.trim()) { toast.error('Il titolo è obbligatorio'); return; }
    const payload = {
      ...form,
      slug: form.slug || slugify(form.title),
      year: form.year ? parseInt(form.year) : null,
    };
    onCreate(payload);
  };

  return (
    <div className="ps-modal-bg" onClick={onClose} data-testid="ps-new-modal">
      <div className="ps-modal" onClick={e => e.stopPropagation()}>
        <h2 style={{ marginBottom: 4 }}>Nuovo progetto</h2>
        <p className="ps-modal__sub">Crea un nuovo Published Journey. Potrai aggiungere gallery, hotspot e video dopo la creazione.</p>

        <div className="ps-section" style={{ marginTop: 20 }}>
          <label className="ps-section__label">Titolo *</label>
          <input
            className="ps-input"
            data-testid="ps-modal-title"
            autoFocus
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value, slug: slugify(e.target.value) }))}
          />
        </div>

        <div className="ps-grid-2">
          <div className="ps-section">
            <label className="ps-section__label">Tipo progetto</label>
            <select
              className="ps-input"
              data-testid="ps-modal-type"
              value={form.project_type}
              onChange={e => setForm(f => ({ ...f, project_type: e.target.value }))}
            >
              <option value="">— Seleziona —</option>
              {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="ps-section">
            <label className="ps-section__label">Anno</label>
            <input
              className="ps-input"
              type="number"
              data-testid="ps-modal-year"
              value={form.year || ''}
              onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
            />
          </div>
          <div className="ps-section">
            <label className="ps-section__label">Location</label>
            <input
              className="ps-input"
              data-testid="ps-modal-location"
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            />
          </div>
          <div className="ps-section">
            <label className="ps-section__label">Lingua canonica</label>
            <select
              className="ps-input"
              data-testid="ps-modal-locale"
              value={form.canonical_locale}
              onChange={e => setForm(f => ({ ...f, canonical_locale: e.target.value }))}
            >
              {TRANS_LOCALES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
        </div>

        <div className="ps-section">
          <label className="ps-section__label">Slug (URL)</label>
          <input
            className="ps-input ps-input--display"
            data-testid="ps-modal-slug"
            value={form.slug}
            onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
            placeholder="generato automaticamente dal titolo"
          />
        </div>

        <div className="ps-modal__actions">
          <button className="ps-btn ps-btn--ghost" onClick={onClose}>Annulla</button>
          <button
            className="ps-btn ps-btn--primary"
            data-testid="ps-modal-create-btn"
            onClick={handleCreate}
          >
            Crea progetto
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectsStudioPage;
