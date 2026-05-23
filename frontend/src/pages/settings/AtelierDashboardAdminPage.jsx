/**
 * AtelierDashboardAdminPage — Studio Identity™ · Atelier Dashboard configurator.
 *
 * ITER138 · Phase 2 (post-cinematic) — Command Center surface that lets a
 * tenant admin edit:
 *   • Hero composition copy + signature + greeting overrides (per locale)
 *   • Hero image media (URL, alt, focal point, grading, overlay intensity)
 *   • Project card fallback covers (when a project has no own cover)
 *   • Daily inspiration quote library (text, author, locale, scheduling)
 *
 * Everything written here flows through:
 *   PUT  /api/atelier/dashboard/config
 *   POST /api/atelier/dashboard/media
 *   POST /api/atelier/dashboard/quotes
 *   DELETE on media/quotes for archive
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useT, useBlueprint } from '../../contexts/BlueprintContext';
import { toast } from 'sonner';
import './atelier-dashboard-admin.css';

const GRADING_PROFILES = [
  { value: 'nordic_cinematic',  label: 'Nordic Cinematic (default)' },
  { value: 'warm_hospitality',  label: 'Warm Hospitality' },
  { value: 'editorial_neutral', label: 'Editorial Neutral' },
  { value: 'desaturated_film',  label: 'Desaturated Film' },
];

const OVERLAY_PROFILES = [
  { value: 'cinematic_left',     label: 'Cinematic Left (default)' },
  { value: 'cinematic_full',     label: 'Cinematic Full Bleed' },
  { value: 'minimal',            label: 'Minimal' },
  { value: 'warm_hospitality',   label: 'Warm Hospitality Glow' },
];

const LOCALES = [
  { value: '*',     label: 'All locales (default)' },
  { value: 'it-IT', label: 'Italiano (it-IT)' },
  { value: 'en-US', label: 'English US (en-US)' },
  { value: 'en-GB', label: 'English UK (en-GB)' },
  { value: 'fr-FR', label: 'Français (fr-FR)' },
  { value: 'de-DE', label: 'Deutsch (de-DE)' },
  { value: 'es-ES', label: 'Español (es-ES)' },
  { value: 'ar',    label: 'العربية (ar)' },
];

const MEDIA_KINDS = [
  { value: 'hero',                   label: 'Hero' },
  { value: 'project_card_fallback',  label: 'Project card fallback' },
  { value: 'inspiration',            label: 'Inspiration ambient' },
];


const AtelierDashboardAdminPage = () => {
  const t = useT();
  const { locale: uiLocale } = useBlueprint();

  const [config, setConfig] = useState(null);
  const [media, setMedia] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('copy');

  // Drafts (form state)
  const [copyDraft, setCopyDraft] = useState({
    locale: '*',
    hero_eyebrow: '', hero_greeting_morning: '', hero_greeting_afternoon: '', hero_greeting_evening: '',
    hero_summary_template: '', hero_signature: '',
    hero_overlay_profile: 'cinematic_left',
    kpi_active_label: '', kpi_dossier_label: '', kpi_awaiting_label: '', kpi_deliveries_label: '',
    section_projects_title: '', section_projects_cta: '',
    section_activity_title: '', section_milestones_title: '', section_inspiration_title: '',
  });

  const [mediaDraft, setMediaDraft] = useState({
    media_kind: 'hero', file_url: '', alt_text: '',
    focal_point_x: 0.5, focal_point_y: 0.5,
    grading_profile: 'nordic_cinematic', overlay_intensity: 0.45, brightness_offset: 0.0,
    locale: '*', sort_order: 0,
  });

  const [quoteDraft, setQuoteDraft] = useState({
    quote_text: '', quote_author: '', quote_source: '',
    locale: 'en-US', sort_order: 0, media_id: '',
  });

  // Load
  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get(`/api/atelier/dashboard/config?locale=${uiLocale || 'en-US'}`).then(r => r.data),
      api.get('/api/atelier/dashboard/media').then(r => r.data.media || []),
      api.get(`/api/atelier/dashboard/quotes?locale=${uiLocale || 'en-US'}`).then(r => r.data.quotes || []),
    ]).then(([cfg, m, q]) => {
      if (!alive) return;
      setConfig(cfg); setMedia(m); setQuotes(q);
      setCopyDraft(d => ({
        ...d,
        hero_eyebrow:           cfg?.hero_eyebrow || '',
        hero_greeting_morning:  cfg?.hero_greeting_morning || '',
        hero_greeting_afternoon:cfg?.hero_greeting_afternoon || '',
        hero_greeting_evening:  cfg?.hero_greeting_evening || '',
        hero_summary_template:  cfg?.hero_summary_template || '',
        hero_signature:         cfg?.hero_signature || '',
        hero_overlay_profile:   cfg?.hero_overlay_profile || 'cinematic_left',
        kpi_active_label:       cfg?.kpi_active_label || '',
        kpi_dossier_label:      cfg?.kpi_dossier_label || '',
        kpi_awaiting_label:     cfg?.kpi_awaiting_label || '',
        kpi_deliveries_label:   cfg?.kpi_deliveries_label || '',
        section_projects_title: cfg?.section_projects_title || '',
        section_projects_cta:   cfg?.section_projects_cta || '',
        section_activity_title: cfg?.section_activity_title || '',
        section_milestones_title:cfg?.section_milestones_title || '',
        section_inspiration_title:cfg?.section_inspiration_title || '',
      }));
    });
    return () => { alive = false; };
  }, [uiLocale]);

  const saveCopy = async () => {
    setSaving(true);
    try {
      // Only send non-empty strings so we don't overwrite locked DB defaults with blanks
      const payload = { locale: copyDraft.locale };
      Object.entries(copyDraft).forEach(([k, v]) => {
        if (k !== 'locale' && v !== '' && v != null) payload[k] = v;
      });
      await api.put('/api/atelier/dashboard/config', payload);
      toast.success(t('atelier.admin.copy_saved', null, 'Atelier copy saved'));
    } catch (e) {
      toast.error(`${e.response?.data?.detail || e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const addMedia = async () => {
    if (!mediaDraft.file_url) {
      toast.error(t('atelier.admin.url_required', null, 'Image URL required'));
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post('/api/atelier/dashboard/media', mediaDraft);
      if (data?.media) setMedia(m => [...m, data.media]);
      setMediaDraft(d => ({ ...d, file_url: '', alt_text: '' }));
      toast.success(t('atelier.admin.media_added', null, 'Media added'));
    } catch (e) {
      toast.error(`${e.response?.data?.detail || e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteMedia = async (id) => {
    if (!window.confirm(t('atelier.admin.confirm_archive', null, 'Archive this media asset?'))) return;
    try {
      await api.delete(`/api/atelier/dashboard/media/${id}`);
      setMedia(m => m.filter(x => x.id !== id));
      toast.success(t('atelier.admin.media_archived', null, 'Media archived'));
    } catch (e) {
      toast.error(`${e.response?.data?.detail || e.message}`);
    }
  };

  const addQuote = async () => {
    if (!quoteDraft.quote_text) {
      toast.error(t('atelier.admin.quote_required', null, 'Quote text required'));
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/atelier/dashboard/quotes', {
        ...quoteDraft,
        media_id: quoteDraft.media_id || null,
      });
      // Reload quote list
      const fresh = await api.get(`/api/atelier/dashboard/quotes?locale=${uiLocale || 'en-US'}`)
        .then(r => r.data.quotes || []);
      setQuotes(fresh);
      setQuoteDraft({ quote_text: '', quote_author: '', quote_source: '',
                      locale: 'en-US', sort_order: 0, media_id: '' });
      toast.success(t('atelier.admin.quote_added', null, 'Quote added'));
    } catch (e) {
      toast.error(`${e.response?.data?.detail || e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteQuote = async (id) => {
    if (!window.confirm(t('atelier.admin.confirm_archive_quote', null, 'Archive this quote?'))) return;
    try {
      await api.delete(`/api/atelier/dashboard/quotes/${id}`);
      setQuotes(q => q.filter(x => x.id !== id));
      toast.success(t('atelier.admin.quote_archived', null, 'Quote archived'));
    } catch (e) {
      toast.error(`${e.response?.data?.detail || e.message}`);
    }
  };

  const inspirationMediaOptions = useMemo(
    () => media.filter(m => m.media_kind === 'inspiration'),
    [media]
  );

  return (
    <div className="ada" data-testid="atelier-dashboard-admin">
      <header className="ada__head">
        <Link to="/settings" className="ada__back" data-testid="ada-back">
          <ArrowLeft size={14} strokeWidth={1.6} />
          {t('atelier.admin.back', null, 'Back to Settings')}
        </Link>
        <p className="ada__eyebrow">{t('atelier.admin.eyebrow', null, 'Atelier · Studio Identity')}</p>
        <h1 className="ada__title"><em>{t('atelier.admin.title', null, 'Dashboard Atelier')}</em></h1>
        <p className="ada__lede">{t('atelier.admin.lede', null,
          'Curate the hero copy, cinematic imagery and inspiration quote library that compose the Studio Pulse™ dashboard. Per-locale overrides cascade automatically.')}</p>
      </header>

      <nav className="ada__tabs" role="tablist">
        {['copy', 'media', 'quotes'].map(tab => (
          <button key={tab} role="tab"
                  aria-selected={activeTab === tab}
                  className={`ada__tab ${activeTab === tab ? 'is-active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                  data-testid={`ada-tab-${tab}`}>
            {t(`atelier.admin.tab.${tab}`, null,
                tab === 'copy' ? 'Hero & Sections' : tab === 'media' ? 'Media Library' : 'Inspiration Quotes')}
          </button>
        ))}
      </nav>

      {activeTab === 'copy' && (
        <section className="ada__panel" data-testid="ada-copy-panel">
          <div className="ada__field">
            <label>{t('atelier.admin.locale', null, 'Target locale')}</label>
            <select value={copyDraft.locale}
                    onChange={e => setCopyDraft({ ...copyDraft, locale: e.target.value })}>
              {LOCALES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="ada__grid">
            {[
              ['hero_eyebrow',             'Hero eyebrow'],
              ['hero_greeting_morning',    'Greeting · morning'],
              ['hero_greeting_afternoon',  'Greeting · afternoon'],
              ['hero_greeting_evening',    'Greeting · evening'],
              ['hero_summary_template',    'Hero summary template'],
              ['hero_signature',           'Hero signature line'],
              ['kpi_active_label',         'KPI · Active journeys'],
              ['kpi_dossier_label',        'KPI · Dossier in progress'],
              ['kpi_awaiting_label',       'KPI · Awaiting feedback'],
              ['kpi_deliveries_label',     'KPI · Deliveries this week'],
              ['section_projects_title',   'Section · Projects title'],
              ['section_projects_cta',     'Section · Projects CTA'],
              ['section_activity_title',   'Section · Recent activity'],
              ['section_milestones_title', 'Section · Upcoming milestones'],
              ['section_inspiration_title','Section · Daily inspiration'],
            ].map(([key, label]) => (
              <div key={key} className="ada__field">
                <label>{label}</label>
                <input type="text"
                       value={copyDraft[key] || ''}
                       onChange={e => setCopyDraft({ ...copyDraft, [key]: e.target.value })}
                       placeholder={t('atelier.admin.use_i18n', null, 'leave empty → use i18n')} />
              </div>
            ))}

            <div className="ada__field">
              <label>Hero overlay profile</label>
              <select value={copyDraft.hero_overlay_profile}
                      onChange={e => setCopyDraft({ ...copyDraft, hero_overlay_profile: e.target.value })}>
                {OVERLAY_PROFILES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="ada__foot">
            <button className="ada__cta" onClick={saveCopy} disabled={saving} data-testid="ada-save-copy">
              <Save size={14} strokeWidth={1.6} />
              {saving ? t('common.loading', null, 'Saving…')
                      : t('atelier.admin.save_copy', null, 'Save copy override')}
            </button>
          </div>
        </section>
      )}

      {activeTab === 'media' && (
        <section className="ada__panel" data-testid="ada-media-panel">
          <h3 className="ada__sub">{t('atelier.admin.media_library', null, 'Media Library')}</h3>
          <ul className="ada__media">
            {media.length === 0 && <li className="ada__empty">No media yet.</li>}
            {media.map(m => (
              <li key={m.id} className="ada__media-row" data-testid={`ada-media-${m.id}`}>
                <img src={m.file_url} alt={m.alt_text || ''} />
                <div>
                  <p className="ada__media-kind">{m.media_kind} · {m.locale}</p>
                  <p className="ada__media-alt">{m.alt_text || '—'}</p>
                  <p className="ada__media-meta">
                    {m.grading_profile} · overlay {Math.round((m.overlay_intensity || 0) * 100)}%
                  </p>
                </div>
                <button onClick={() => deleteMedia(m.id)} className="ada__icon-btn"
                        data-testid={`ada-delete-media-${m.id}`}>
                  <Trash2 size={14} strokeWidth={1.6} />
                </button>
              </li>
            ))}
          </ul>

          <h3 className="ada__sub">{t('atelier.admin.add_media', null, 'Add new media')}</h3>
          <div className="ada__grid">
            <div className="ada__field">
              <label>Kind</label>
              <select value={mediaDraft.media_kind}
                      onChange={e => setMediaDraft({ ...mediaDraft, media_kind: e.target.value })}>
                {MEDIA_KINDS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="ada__field">
              <label>Image URL</label>
              <input value={mediaDraft.file_url}
                     onChange={e => setMediaDraft({ ...mediaDraft, file_url: e.target.value })}
                     placeholder="https://…" data-testid="ada-media-url" />
            </div>
            <div className="ada__field ada__field--wide">
              <label>Alt text</label>
              <input value={mediaDraft.alt_text}
                     onChange={e => setMediaDraft({ ...mediaDraft, alt_text: e.target.value })} />
            </div>
            <div className="ada__field">
              <label>Focal X (0–1)</label>
              <input type="number" min={0} max={1} step={0.05}
                     value={mediaDraft.focal_point_x}
                     onChange={e => setMediaDraft({ ...mediaDraft, focal_point_x: parseFloat(e.target.value) })} />
            </div>
            <div className="ada__field">
              <label>Focal Y (0–1)</label>
              <input type="number" min={0} max={1} step={0.05}
                     value={mediaDraft.focal_point_y}
                     onChange={e => setMediaDraft({ ...mediaDraft, focal_point_y: parseFloat(e.target.value) })} />
            </div>
            <div className="ada__field">
              <label>Grading profile</label>
              <select value={mediaDraft.grading_profile}
                      onChange={e => setMediaDraft({ ...mediaDraft, grading_profile: e.target.value })}>
                {GRADING_PROFILES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="ada__field">
              <label>Overlay intensity (0–1)</label>
              <input type="number" min={0} max={1} step={0.05}
                     value={mediaDraft.overlay_intensity}
                     onChange={e => setMediaDraft({ ...mediaDraft, overlay_intensity: parseFloat(e.target.value) })} />
            </div>
            <div className="ada__field">
              <label>Locale</label>
              <select value={mediaDraft.locale}
                      onChange={e => setMediaDraft({ ...mediaDraft, locale: e.target.value })}>
                {LOCALES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="ada__field">
              <label>Sort order</label>
              <input type="number" value={mediaDraft.sort_order}
                     onChange={e => setMediaDraft({ ...mediaDraft, sort_order: parseInt(e.target.value || 0, 10) })} />
            </div>
          </div>
          <div className="ada__foot">
            <button className="ada__cta" onClick={addMedia} disabled={saving} data-testid="ada-add-media">
              <Plus size={14} strokeWidth={1.6} /> {t('atelier.admin.add', null, 'Add media')}
            </button>
          </div>
        </section>
      )}

      {activeTab === 'quotes' && (
        <section className="ada__panel" data-testid="ada-quotes-panel">
          <h3 className="ada__sub">{t('atelier.admin.quote_library', null, 'Inspiration Quote Library')}</h3>
          <ul className="ada__quotes">
            {quotes.length === 0 && <li className="ada__empty">No quotes curated yet.</li>}
            {quotes.map(q => (
              <li key={q.id} className="ada__quote-row" data-testid={`ada-quote-${q.id}`}>
                <blockquote>{q.quote_text}</blockquote>
                <p className="ada__quote-meta">— {q.quote_author || '—'} · <span>{q.locale}</span></p>
                {q.quote_source && <p className="ada__quote-src">{q.quote_source}</p>}
                <button onClick={() => deleteQuote(q.id)} className="ada__icon-btn"
                        data-testid={`ada-delete-quote-${q.id}`}>
                  <Trash2 size={14} strokeWidth={1.6} />
                </button>
              </li>
            ))}
          </ul>

          <h3 className="ada__sub">{t('atelier.admin.add_quote', null, 'Add new quote')}</h3>
          <div className="ada__grid">
            <div className="ada__field ada__field--wide">
              <label>Quote text</label>
              <textarea rows={3} value={quoteDraft.quote_text}
                        onChange={e => setQuoteDraft({ ...quoteDraft, quote_text: e.target.value })}
                        data-testid="ada-quote-text" />
            </div>
            <div className="ada__field">
              <label>Author</label>
              <input value={quoteDraft.quote_author}
                     onChange={e => setQuoteDraft({ ...quoteDraft, quote_author: e.target.value })} />
            </div>
            <div className="ada__field">
              <label>Source</label>
              <input value={quoteDraft.quote_source}
                     onChange={e => setQuoteDraft({ ...quoteDraft, quote_source: e.target.value })} />
            </div>
            <div className="ada__field">
              <label>Locale (source)</label>
              <select value={quoteDraft.locale}
                      onChange={e => setQuoteDraft({ ...quoteDraft, locale: e.target.value })}>
                {LOCALES.filter(l => l.value !== '*').map(o =>
                  <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="ada__field">
              <label>Companion image</label>
              <select value={quoteDraft.media_id || ''}
                      onChange={e => setQuoteDraft({ ...quoteDraft, media_id: e.target.value })}>
                <option value="">— none —</option>
                {inspirationMediaOptions.map(m =>
                  <option key={m.id} value={m.id}>{m.alt_text || m.file_url.slice(-40)}</option>)}
              </select>
            </div>
            <div className="ada__field">
              <label>Sort order</label>
              <input type="number" value={quoteDraft.sort_order}
                     onChange={e => setQuoteDraft({ ...quoteDraft, sort_order: parseInt(e.target.value || 0, 10) })} />
            </div>
          </div>
          <div className="ada__foot">
            <button className="ada__cta" onClick={addQuote} disabled={saving} data-testid="ada-add-quote">
              <Plus size={14} strokeWidth={1.6} /> {t('atelier.admin.add', null, 'Add quote')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default AtelierDashboardAdminPage;
