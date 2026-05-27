/**
 * Pages Admin — Command Center (ITER157.E · field-as-card UX).
 *
 * Layout rifatto sull'ispirazione utente: una card = un campo, salva
 * granulare per campo, locale tab in alto, anteprima sempre a destra.
 * Pensato per editori non tecnici.
 *
 * Persistence: riutilizza i medesimi endpoint dello Storefront CMS.
 *   GET   /api/storefront/admin/pages/{page_key}
 *   PUT   /api/storefront/admin/sections/{section_id}
 *   POST  /api/storefront/admin/pages/{page_key}/publish
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  FileText, Layers, LayoutGrid, Image as ImageIcon, Compass,
  Search, Send, Eye, EyeOff, Languages, Trash2, ExternalLink,
  RefreshCw, LogOut,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import LivePreviewPane from './LivePreviewPane';
import EditorialMediaField from '../../components/common/EditorialMediaField';
import { renderBandEditor, TRACEABILITY } from './bandEditors';
import './pagesAdmin.css';

// ─── Page registry shown in the second column ────────────────
const PAGES = [
  { key: 'home',          title: 'Home',           path: '/' },
  { key: 'audience',      title: 'Dedicato a',     path: '/audience' },
  { key: 'features',      title: 'Caratteristiche',path: '/features' },
  { key: 'pricing',       title: 'Versioni e Prezzi', path: '/pricing' },
  { key: 'training',      title: 'Formazione',     path: '/training' },
  { key: 'support',       title: 'Supporto',       path: '/support' },
  { key: 'login',         title: 'Accedi',         path: '/login' },
  { key: 'footer',        title: 'Footer',         path: '/footer' },
  { key: 'navigation',    title: 'Navigation',     path: '/navigation' },
  { key: 'professionals', title: 'Professionals',  path: '/professionals' },
  { key: 'projects',      title: 'Projects',       path: '/projects' },
  { key: 'start_project', title: 'Start Project',  path: '/start_project' },
  { key: 'ui',            title: 'Ui',             path: '/ui' },
];

// ─── Locale chooser ────────────────────────────────────────────
const LOCALES = [
  { code: 'it-IT', label: 'IT'    },
  { code: 'en-US', label: 'EN-US' },
  { code: 'en-GB', label: 'EN-UK' },
  { code: 'fr',    label: 'FR'    },
  { code: 'de',    label: 'DE'    },
  { code: 'es',    label: 'ES'    },
];

// ─── Field schema per section_type ─────────────────────────────
// Default text-only field list used when no specific schema exists.
const DEFAULT_TEXT_FIELDS = [
  { key: 'eyebrow',  label: 'EYEBROW',  textarea: false },
  { key: 'title',    label: 'TITLE',    textarea: true,  display: true, rows: 2 },
  { key: 'subtitle', label: 'SUBTITLE', textarea: true,  rows: 2 },
  { key: 'body',     label: 'BODY',     textarea: true,  rows: 4 },
  { key: 'cta_label',label: 'CTA · LABEL',  textarea: false },
  { key: 'cta_href', label: 'CTA · LINK',   textarea: false },
];

// Sections that include cinematic editorial extras (quote/attribution etc).
const FIELD_SCHEMAS = {
  cinematic_quote: [
    { key: 'eyebrow',     label: 'EYEBROW',     textarea: false },
    { key: 'quote',       label: 'QUOTE',       textarea: true, rows: 3, display: true },
    { key: 'attribution', label: 'ATTRIBUTION', textarea: false },
  ],
  atmosphere_statement: [
    { key: 'eyebrow', label: 'EYEBROW', textarea: false },
    { key: 'title',   label: 'TITLE',   textarea: true, rows: 2, display: true },
    { key: 'body',    label: 'BODY',    textarea: true, rows: 3 },
  ],
  hero_editorial: [
    ...DEFAULT_TEXT_FIELDS,
    { key: 'cover_url', label: 'COVER · IMAGE', kind: 'image' },
  ],
  store_hero: [
    ...DEFAULT_TEXT_FIELDS,
    { key: 'cover_url', label: 'COVER · IMAGE', kind: 'image' },
  ],
  hero: [
    ...DEFAULT_TEXT_FIELDS,
    { key: 'cover_url', label: 'COVER · IMAGE', kind: 'image' },
  ],
  editorial_footer: [
    { key: 'rights',  label: 'COPYRIGHT', textarea: false },
    { key: 'tagline', label: 'TAGLINE',   textarea: true, rows: 2 },
  ],
};

// Section types whose editor is best handled by the existing advanced
// renderers (lists, multi-row data) — we render that via renderBandEditor.
const ADVANCED_TYPES = new Set([
  'nav_top', 'main_links', 'navigation_main',
  'footer_columns', 'brand_logos', 'materials', 'materials_carousel',
  'magazine_grid', 'magazine_highlights', 'journal_intro',
  'stats_band', 'newsletter', 'dual_cta',
  'featured_design_journeys', 'editorial_grid', 'trust_marquee',
  'professionals_cta',
]);

// ─── Locale resolution helper ──────────────────────────────────
// Walk the locale_content map and find the saved value for `field`
// using a fallback chain: exact locale → short code → _default.
const shortLoc = (loc) => (loc || '').split('-')[0];
const resolveLocaleKey = (localeContent, locale) => {
  if (!localeContent || typeof localeContent !== 'object') return null;
  if (localeContent[locale]) return locale;
  const short = shortLoc(locale);
  if (short && localeContent[short]) return short;
  if (localeContent._default) return '_default';
  return null;
};
const getSavedFieldValue = (section, locale, field) => {
  const lc = section?.locale_content || {};
  const k = resolveLocaleKey(lc, locale);
  return k ? (lc[k]?.[field] ?? '') : '';
};

// Build the locale_content payload that writes `field=value` for the
// active locale, preserving the matched-key strategy.
const writeFieldValue = (section, locale, field, value) => {
  const lc = { ...(section?.locale_content || {}) };
  const k = resolveLocaleKey(lc, locale) || locale;
  lc[k] = { ...(lc[k] || {}), [field]: value };
  return lc;
};

// ─── COMPONENT ─────────────────────────────────────────────────
const PagesAdminPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPage = searchParams.get('page') || 'home';
  const [activePage, setActivePage] = useState(initialPage);
  const [activeLocale, setActiveLocale] = useState('it-IT');
  const [page, setPage] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({}); // key: `${sid}__${loc}__${field}` → value
  const [savingKey, setSavingKey] = useState(null);
  const [previewKey, setPreviewKey] = useState(0);

  const draftKey = (sid, loc, field) => `${sid}__${loc}__${field}`;

  const switchPage = (k) => {
    setActivePage(k);
    const sp = new URLSearchParams(searchParams);
    sp.set('page', k);
    setSearchParams(sp, { replace: true });
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setDrafts({});
      try {
        const r = await api.get(`/api/storefront/admin/pages/${activePage}`);
        if (!alive) return;
        setPage(r.data || null);
        setSections((r.data?.sections || []).sort((a, b) => a.sort_order - b.sort_order));
      } catch (e) {
        toast.error(e?.response?.data?.detail || 'Caricamento fallito');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [activePage]);

  // Live preview: scroll to the section that was last clicked in editor
  const [focusedSectionType, setFocusedSectionType] = useState(null);
  const onPreviewSectionClick = useCallback((section_type) => {
    setFocusedSectionType(section_type);
    // Smooth-scroll the editor column to the section header
    const el = document.getElementById(`pa-section-${section_type}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const getDraftValue = (section, field) => {
    const k = draftKey(section.id, activeLocale, field);
    if (k in drafts) return drafts[k];
    return getSavedFieldValue(section, activeLocale, field);
  };
  const isDirty = (section, field) => {
    const k = draftKey(section.id, activeLocale, field);
    if (!(k in drafts)) return false;
    return drafts[k] !== getSavedFieldValue(section, activeLocale, field);
  };
  const onChangeDraft = (section, field, value) => {
    setDrafts((prev) => ({ ...prev, [draftKey(section.id, activeLocale, field)]: value }));
  };

  const saveField = async (section, field) => {
    const value = getDraftValue(section, field);
    const lc = writeFieldValue(section, activeLocale, field, value);
    const key = draftKey(section.id, activeLocale, field);
    setSavingKey(key);
    try {
      const r = await api.put(`/api/storefront/admin/sections/${section.id}`, {
        locale_content: lc,
      });
      setSections((list) => list.map((s) => (s.id === section.id ? { ...s, ...r.data } : s)));
      setDrafts((prev) => {
        const n = { ...prev }; delete n[key]; return n;
      });
      toast.success('Campo salvato');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Salvataggio fallito');
    } finally { setSavingKey(null); }
  };

  // Image / media field save → uses locale_content patch the same way
  const saveImageField = async (section, field, url) => {
    const lc = writeFieldValue(section, activeLocale, field, url);
    try {
      const r = await api.put(`/api/storefront/admin/sections/${section.id}`, {
        locale_content: lc,
      });
      setSections((list) => list.map((s) => (s.id === section.id ? { ...s, ...r.data } : s)));
      setPreviewKey((k) => k + 1);
      toast.success('Immagine aggiornata');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Salvataggio fallito');
    }
  };

  const toggleSection = async (section) => {
    try {
      const r = await api.put(`/api/storefront/admin/sections/${section.id}`, {
        visible: !section.visible,
      });
      setSections((list) => list.map((s) => (s.id === section.id ? { ...s, ...r.data } : s)));
    } catch (e) {
      toast.error('Aggiornamento fallito');
    }
  };

  const deleteSection = async (section) => {
    if (!window.confirm(`Eliminare la sezione "${section.section_type}"? L'azione non è reversibile.`)) return;
    try {
      await api.delete(`/api/storefront/admin/sections/${section.id}`);
      setSections((list) => list.filter((s) => s.id !== section.id));
      toast.success('Sezione eliminata');
    } catch (e) {
      toast.error('Eliminazione fallita');
    }
  };

  const publishPage = async () => {
    try {
      await api.post(`/api/storefront/admin/pages/${activePage}/publish`, {});
      const r = await api.get(`/api/storefront/admin/pages/${activePage}`);
      setPage(r.data || null);
      setPreviewKey((k) => k + 1);
      toast.success('Pagina pubblicata');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Pubblicazione fallita');
    }
  };

  // For the advanced renderer we patch locale & settings through the
  // existing onPatchLocale / onPatchSetting contract, then save.
  const patchSectionPayload = async (section, payload) => {
    try {
      const r = await api.put(`/api/storefront/admin/sections/${section.id}`, payload);
      setSections((list) => list.map((s) => (s.id === section.id ? { ...s, ...r.data } : s)));
      setPreviewKey((k) => k + 1);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Salvataggio fallito');
    }
  };

  const visibleSectionsCount = sections.filter((s) => s.visible).length;
  const sectionMeta = page ? `${page.page_key} · ${page.status || 'draft'} · ${sections.length} sezioni · ${visibleSectionsCount} visibili` : '—';

  return (
    <div className="pa-shell" data-preview-open="true" data-testid="pa-shell">
      {/* ── LEFT RAIL ───────────────────────────────────── */}
      <aside className="pa-rail">
        <p className="pa-rail__eyebrow">Blueprint</p>
        <h1 className="pa-rail__brand">Command<br/>Center</h1>
        <nav className="pa-rail__nav">
          <button className="pa-rail__link" data-active="true" data-testid="pa-rail-pages">
            <FileText size={14} strokeWidth={1.7} /> Pagine
          </button>
          <Link className="pa-rail__link" to="/blueprint/editorial-blocks" data-testid="pa-rail-blocks">
            <Layers size={14} strokeWidth={1.7} /> Editorial Blocks
          </Link>
          <button className="pa-rail__link" disabled data-testid="pa-rail-sections" title="Disponibile a breve">
            <LayoutGrid size={14} strokeWidth={1.7} /> Sections
          </button>
          <Link className="pa-rail__link" to="/blueprint/media-library" data-testid="pa-rail-media">
            <ImageIcon size={14} strokeWidth={1.7} /> Media Library
          </Link>
          <button className="pa-rail__link" onClick={() => switchPage('footer')} data-testid="pa-rail-footer">
            <Compass size={14} strokeWidth={1.7} /> Footer
          </button>
          <button className="pa-rail__link" disabled data-testid="pa-rail-seo" title="Disponibile a breve">
            <Search size={14} strokeWidth={1.7} /> SEO &amp; Indexing
          </button>
          <button className="pa-rail__link" onClick={publishPage} data-testid="pa-rail-publish">
            <Send size={14} strokeWidth={1.7} /> Publishing
          </button>
        </nav>
        <div className="pa-rail__foot">
          <a className="pa-rail__footlink" href="/?editorial=preview" target="_blank" rel="noopener noreferrer" data-testid="pa-foot-viewsite">
            <ExternalLink size={11} strokeWidth={1.7} /> View site
          </a>
          <button className="pa-rail__footlink" onClick={() => setPreviewKey((k) => k + 1)} data-testid="pa-foot-clearcache">
            <RefreshCw size={11} strokeWidth={1.7} /> Clear cache
          </button>
          <Link className="pa-rail__footlink" to="/logout" data-testid="pa-foot-logout">
            <LogOut size={11} strokeWidth={1.7} /> Logout
          </Link>
        </div>
      </aside>

      {/* ── PAGE LIST ───────────────────────────────────── */}
      <aside className="pa-pagelist" data-testid="pa-pagelist">
        {PAGES.map((p) => (
          <button key={p.key}
            className="pa-pagelist__item"
            data-active={activePage === p.key}
            data-testid={`pa-page-${p.key}`}
            onClick={() => switchPage(p.key)}>
            <div className="pa-pagelist__title">{p.title}</div>
            <div className="pa-pagelist__path">{p.path}</div>
          </button>
        ))}
      </aside>

      {/* ── MAIN ────────────────────────────────────────── */}
      <main className="pa-main">
        <header className="pa-main__head">
          <h1 className="pa-main__title" data-testid="pa-main-title">Pagine</h1>
          <p className="pa-main__lede">
            Editorial operating console. Modifica testi e fotografie di ogni pagina,
            per ogni lingua. La preview a destra rispecchia il sito pubblico reale.
          </p>
          <div className="pa-main__bar">
            <span className="pa-main__breadcrumb" data-testid="pa-breadcrumb">
              <span>{page?.page_key || activePage}</span>
              <span className="pa-dot">·</span>
              <span data-status={page?.status || 'draft'}>{page?.status === 'published' ? 'published' : 'draft'}</span>
              <span className="pa-dot">·</span>
              <span>{sections.length} sezioni</span>
            </span>
            <div className="pa-locales" data-testid="pa-locales" role="tablist" aria-label="Locale">
              <span className="pa-locale-icon" aria-hidden><Languages size={13} strokeWidth={1.8} /></span>
              {LOCALES.map((l) => (
                <button key={l.code} type="button"
                  className="pa-locale-btn" data-active={activeLocale === l.code}
                  data-testid={`pa-locale-${l.code}`}
                  onClick={() => setActiveLocale(l.code)}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="pa-publish-row">
          <button className="pa-publish-btn" onClick={publishPage} data-testid="pa-publish">
            Pubblica pagina
          </button>
        </div>

        {loading && <p className="pa-empty">Caricamento dell'orchestrazione…</p>}
        {!loading && sections.length === 0 && (
          <p className="pa-empty">Nessuna fascia per questa pagina.</p>
        )}

        {!loading && sections.map((section) => (
          <SectionGroup
            key={section.id}
            section={section}
            page={page}
            locale={activeLocale}
            isDirty={isDirty}
            getDraftValue={getDraftValue}
            onChangeDraft={onChangeDraft}
            onSaveField={saveField}
            savingKey={savingKey}
            draftKey={draftKey}
            onToggleVisible={toggleSection}
            onDelete={deleteSection}
            onSaveImage={saveImageField}
            patchSectionPayload={patchSectionPayload}
            focused={focusedSectionType === section.section_type}
          />
        ))}
      </main>

      {/* ── LIVE PREVIEW ────────────────────────────────── */}
      <LivePreviewPane
        pageKey={activePage}
        refreshKey={previewKey}
        onSectionClick={onPreviewSectionClick}
        selectedSectionType={focusedSectionType}
      />
    </div>
  );
};

// ─── SectionGroup ─────────────────────────────────────────────
const SectionGroup = ({
  section, page, locale,
  isDirty, getDraftValue, onChangeDraft, onSaveField, savingKey, draftKey,
  onToggleVisible, onDelete, onSaveImage, patchSectionPayload, focused,
}) => {
  const isAdvanced = ADVANCED_TYPES.has(section.section_type);
  const schema = FIELD_SCHEMAS[section.section_type] || DEFAULT_TEXT_FIELDS;
  const trace = TRACEABILITY[section.section_type] || section.section_type;
  const eyebrow = (section.section_type || '').toUpperCase().replace(/_/g, ' ');

  return (
    <article
      id={`pa-section-${section.section_type}`}
      className="pa-section-group"
      data-testid={`pa-section-${section.section_type}`}
      data-focused={focused}
      style={focused ? { boxShadow: '0 0 0 1px var(--pa-cyan) inset' } : undefined}>
      <header className="pa-section-group__head">
        <span className="pa-section-group__eyebrow">{eyebrow}</span>
        <span className="pa-section-group__meta">
          Sort {section.sort_order} {section.visible ? '' : '· hidden'}
          {trace ? ` · ${trace}` : ''}
        </span>
        <div className="pa-section-group__actions">
          <button className="pa-toggle-btn"
            onClick={() => onToggleVisible(section)}
            data-testid={`pa-toggle-${section.section_type}`}
            title={section.visible ? 'Nascondi sezione' : 'Mostra sezione'}>
            {section.visible ? <Eye size={13} strokeWidth={1.7} /> : <EyeOff size={13} strokeWidth={1.7} />}
          </button>
          <button className="pa-ghost-btn pa-ghost-btn--danger"
            onClick={() => onDelete(section)}
            data-testid={`pa-delete-${section.section_type}`}>
            <Trash2 size={11} strokeWidth={1.7} /> Elimina sezione
          </button>
        </div>
      </header>

      <div className="pa-section-group__body">
        {isAdvanced ? (
          <div className="pa-advanced">
            <p className="pa-advanced__hint">
              Questa sezione ha contenuti strutturati (liste, voci, materiali…).
              Modificali qui sotto: ogni cambio si salva automaticamente sulla sezione.
            </p>
            <AdvancedSlot
              section={section}
              locale={locale}
              patchSectionPayload={patchSectionPayload}
            />
          </div>
        ) : (
          schema.map((f) => {
            if (f.kind === 'image') {
              return (
                <ImageFieldCard
                  key={f.key}
                  section={section}
                  field={f}
                  locale={locale}
                  value={getDraftValue(section, f.key)}
                  onSave={(url) => onSaveImage(section, f.key, url)}
                />
              );
            }
            return (
              <FieldCard
                key={f.key}
                section={section}
                pageKey={page?.page_key}
                field={f}
                locale={locale}
                value={getDraftValue(section, f.key)}
                savedValue={getSavedFieldValue(section, locale, f.key)}
                dirty={isDirty(section, f.key)}
                saving={savingKey === draftKey(section.id, locale, f.key)}
                onChange={(v) => onChangeDraft(section, f.key, v)}
                onSave={() => onSaveField(section, f.key)}
              />
            );
          })
        )}
      </div>
    </article>
  );
};

// ─── FieldCard ────────────────────────────────────────────────
const FieldCard = ({ section, pageKey, field, locale, value, savedValue, dirty, saving, onChange, onSave }) => {
  const path = `site.${pageKey || ''}.${section.section_type}.${field.key}`;
  const localeShort = (LOCALES.find((l) => l.code === locale) || LOCALES[0]).label;
  return (
    <div className="pa-field" data-dirty={dirty} data-testid={`pa-field-${section.section_type}-${field.key}`}>
      <header className="pa-field__head">
        <div className="pa-field__heading">
          <div className="pa-field__eyebrow">{field.label}</div>
          <div className="pa-field__path">{path}</div>
        </div>
        <button
          className="pa-field__save"
          data-state={dirty ? 'dirty' : 'clean'}
          data-testid={`pa-save-${section.section_type}-${field.key}`}
          disabled={!dirty || saving}
          onClick={onSave}>
          {saving ? 'Salvataggio…' : 'Salva'}
        </button>
      </header>
      <div className="pa-field__cols">
        <div className="pa-field__col">
          <span className="pa-field__col-label">In modifica · {localeShort}</span>
          {field.textarea ? (
            <textarea className={`pa-textarea${field.display ? ' pa-textarea--lg' : ''}`}
              rows={field.rows || 3}
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder || ''}
              data-testid={`pa-input-${section.section_type}-${field.key}`} />
          ) : (
            <input className="pa-input"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder || ''}
              data-testid={`pa-input-${section.section_type}-${field.key}`} />
          )}
        </div>
        <div className="pa-field__col">
          <span className="pa-field__col-label pa-field__col-label--mute">Resa pubblica · {localeShort}</span>
          {field.textarea ? (
            <textarea className={`pa-textarea${field.display ? ' pa-textarea--lg' : ''}`}
              rows={field.rows || 3}
              value={savedValue || ''}
              readOnly
              data-testid={`pa-published-${section.section_type}-${field.key}`} />
          ) : (
            <input className="pa-input"
              value={savedValue || ''}
              readOnly
              data-testid={`pa-published-${section.section_type}-${field.key}`} />
          )}
        </div>
      </div>
    </div>
  );
};

// ─── ImageFieldCard ───────────────────────────────────────────
const ImageFieldCard = ({ section, field, locale, value, onSave }) => {
  const localeShort = (LOCALES.find((l) => l.code === locale) || LOCALES[0]).label;
  return (
    <div className="pa-field" data-testid={`pa-image-${section.section_type}-${field.key}`}>
      <header className="pa-field__head">
        <div className="pa-field__heading">
          <div className="pa-field__eyebrow">{field.label}</div>
          <div className="pa-field__path">site.{section.section_type}.{field.key} · {localeShort}</div>
        </div>
      </header>
      <div className="pa-image-field">
        <div className="pa-image-field__preview">
          {value ? <img src={value} alt={field.label} /> : <span>Nessuna immagine</span>}
        </div>
        <div>
          <EditorialMediaField
            value={value || ''}
            onChange={onSave}
            preset="hero"
            bucket="tenant-assets"
            folder={`storefront/${section.section_type}`}
            entityType="cms_section"
            entityId={section.id}
            role={`${field.key}_${locale}`}
            testId={`pa-image-input-${section.section_type}-${field.key}`}
          />
        </div>
      </div>
    </div>
  );
};

// ─── AdvancedSlot: bridges into existing bandEditors.jsx ──────
const AdvancedSlot = ({ section, locale, patchSectionPayload }) => {
  const onPatchLocale = (field, value) => {
    const lc = writeFieldValue(section, locale, field, value);
    patchSectionPayload(section, { locale_content: lc });
  };
  const onPatchSetting = (field, value) => {
    const settings = { ...(section.settings || {}), [field]: value };
    patchSectionPayload(section, { settings });
  };
  const node = renderBandEditor({
    section,
    localeTab: locale,
    activeLocales: LOCALES.map((l) => l.code),
    onPatchLocale,
    onPatchSetting,
  });
  if (node) return node;
  return (
    <p className="pa-empty" style={{ padding: '24px 12px' }}>
      Editor specializzato non disponibile per questa sezione.
    </p>
  );
};

export default PagesAdminPage;
