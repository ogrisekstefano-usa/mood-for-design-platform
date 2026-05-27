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
  RefreshCw, LogOut, Plus, ChevronDown, ChevronRight, GripVertical,
  Type, AlignLeft, Youtube,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import LivePreviewPane from './LivePreviewPane';
import EditorialMediaField from '../../components/common/EditorialMediaField';
import { renderBandEditor, TRACEABILITY } from './bandEditors';
import BlueprintThemeProvider from '../../design-system/os/BlueprintThemeProvider';
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
  // ── Generic free-form blocks (ITER157.E.3) ───────────────────────
  block_heading: [
    { key: 'eyebrow', label: 'EYEBROW', textarea: false },
    { key: 'title',   label: 'TITOLO',  textarea: true, rows: 2, display: true },
  ],
  block_text: [
    { key: 'body', label: 'TESTO', textarea: true, rows: 5, display: true },
  ],
  block_image: [
    { key: 'url',     label: 'IMMAGINE', kind: 'image' },
    { key: 'caption', label: 'CAPTION',  textarea: true, rows: 2 },
    { key: 'alt',     label: 'ALT TEXT', textarea: false },
  ],
  block_video_youtube: [
    { key: 'video_id', label: 'VIDEO ID / URL YOUTUBE', textarea: false, placeholder: 'es: dQw4w9WgXcQ oppure https://youtu.be/dQw4w9WgXcQ' },
    { key: 'title',    label: 'TITOLO',                 textarea: false },
    { key: 'caption',  label: 'CAPTION',                textarea: true, rows: 2 },
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
  // Focused section: highlighted in the editor column when user clicks
  // on a corresponding block inside the live preview iframe.
  const [focusedSectionType, setFocusedSectionType] = useState(null);
  const sectionsRef = React.useRef(sections);
  React.useEffect(() => { sectionsRef.current = sections; }, [sections]);

  // Collapsed state per section (default: collapsed for compact list).
  // Auto-expand on focus.
  const [collapsed, setCollapsed] = useState({}); // id → boolean
  const setSectionCollapsed = (id, value) =>
    setCollapsed((prev) => ({ ...prev, [id]: value }));
  const isCollapsed = (s) => {
    if (s.id in collapsed) return collapsed[s.id];
    return true; // default: all collapsed
  };

  // Drag&drop reorder state
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  // Block picker (+ Aggiungi blocco) panel state
  const [pickerOpen, setPickerOpen] = useState(false);

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
      setFocusedSectionType(null);
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

  const onPreviewSectionClick = useCallback((section_type, alternates) => {
    // The bridge may report multiple candidate section types for a single DOM
    // block (e.g. "navigation" alias of "nav_top"). Find the first one that
    // actually exists in this page's sections; fall back to the primary.
    const candidates = (alternates && alternates.length) ? alternates : [section_type];
    const list = sectionsRef.current || [];
    const matched = candidates.find((t) => list.some((s) => s.section_type === t)) || section_type;
    setFocusedSectionType(matched);
    // Auto-expand the focused section when clicked from preview
    const matchedSection = list.find((s) => s.section_type === matched);
    if (matchedSection) setSectionCollapsed(matchedSection.id, false);
    // Scroll the editor column to the section header. We use a tiny setTimeout
    // so React has time to flush state→DOM, then read the live offset and
    // command the scroll directly. Some browsers ignore scroll commands
    // issued synchronously from a postMessage handler — `setTimeout(0)`
    // breaks out of that frame.
    setTimeout(() => {
      const el = document.getElementById(`pa-section-${matched}`);
      if (!el) return;
      const scroller = document.scrollingElement || document.documentElement;
      const rect = el.getBoundingClientRect();
      const targetY = Math.max(0, rect.top + (scroller.scrollTop || window.scrollY || 0) - 96);
      // Instant jump first so we never miss the scroll, then smoothly settle.
      try {
        scroller.scrollTop = targetY;
      } catch (_) {
        window.scrollTo(0, targetY);
      }
    }, 40);
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

  // ── DRAG&DROP REORDER ───────────────────────────────────────
  const reorderSections = async (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    const list = [...sections].sort((a, b) => a.sort_order - b.sort_order);
    const fromIdx = list.findIndex((s) => s.id === fromId);
    const toIdx = list.findIndex((s) => s.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    // Reassign sort_order with steps of 10 to leave room for future inserts
    const updated = list.map((s, i) => ({ ...s, sort_order: i * 10 }));
    setSections(updated);
    // Persist only the changed ones to backend
    try {
      await Promise.all(
        updated.map((s) =>
          api.put(`/api/storefront/admin/sections/${s.id}`, { sort_order: s.sort_order })
        )
      );
      setPreviewKey((k) => k + 1);
      toast.success('Ordine aggiornato');
    } catch (e) {
      toast.error('Riordino non salvato — ricarico');
      const r = await api.get(`/api/storefront/admin/pages/${activePage}`);
      setSections((r.data?.sections || []).sort((a, b) => a.sort_order - b.sort_order));
    }
  };

  // ── ADD BLOCK ───────────────────────────────────────────────
  const addBlock = async (section_type) => {
    try {
      const r = await api.post(`/api/storefront/admin/pages/${activePage}/sections`, {
        section_type,
        visible: true,
      });
      const created = r.data;
      setSections((list) => [...list, created].sort((a, b) => a.sort_order - b.sort_order));
      setSectionCollapsed(created.id, false); // auto-expand
      setFocusedSectionType(created.section_type);
      setPickerOpen(false);
      setPreviewKey((k) => k + 1);
      toast.success(`Blocco aggiunto: ${section_type}`);
      // Scroll to new block
      setTimeout(() => {
        const el = document.getElementById(`pa-section-${created.section_type}`);
        if (el) {
          const scroller = document.scrollingElement || document.documentElement;
          const rect = el.getBoundingClientRect();
          scroller.scrollTop = Math.max(0, rect.top + scroller.scrollTop - 96);
        }
      }, 100);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Aggiunta fallita');
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
    <BlueprintThemeProvider>
    <div className="pa-shell bp-admin" data-preview-open="true" data-testid="pa-shell">
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
          <button className="pa-addblock-btn" onClick={() => setPickerOpen(!pickerOpen)} data-testid="pa-addblock-toggle">
            <Plus size={14} strokeWidth={2} /> Aggiungi blocco
          </button>
        </div>

        {pickerOpen && (
          <BlockPicker
            onPick={(type) => addBlock(type)}
            onClose={() => setPickerOpen(false)}
          />
        )}

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
            onSelect={() => setFocusedSectionType(section.section_type)}
            collapsed={isCollapsed(section)}
            onToggleCollapse={() => setSectionCollapsed(section.id, !isCollapsed(section))}
            draggingId={draggingId}
            dragOverId={dragOverId}
            onDragStart={() => setDraggingId(section.id)}
            onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
            onDragOver={() => setDragOverId(section.id)}
            onDrop={() => {
              if (draggingId && draggingId !== section.id) {
                reorderSections(draggingId, section.id);
              }
              setDraggingId(null);
              setDragOverId(null);
            }}
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
    </BlueprintThemeProvider>
  );
};

// ─── BlockPicker (+ Aggiungi blocco) ──────────────────────────
const BLOCK_TILES = [
  { type: 'block_heading',        icon: Type,      label: 'Titolo',         hint: 'Headline editoriale autonoma' },
  { type: 'block_text',           icon: AlignLeft, label: 'Testo',          hint: 'Paragrafo libero con formattazione' },
  { type: 'block_image',          icon: ImageIcon, label: 'Immagine',       hint: 'Foto editoriale con caption' },
  { type: 'block_video_youtube',  icon: Youtube,   label: 'Video YouTube',  hint: 'Embed responsive da URL/ID' },
];

const BlockPicker = ({ onPick, onClose }) => (
  <div className="pa-picker" data-testid="pa-block-picker">
    <header className="pa-picker__head">
      <span className="pa-picker__eyebrow">Aggiungi un nuovo blocco</span>
      <button className="pa-picker__close" onClick={onClose} data-testid="pa-picker-close">×</button>
    </header>
    <div className="pa-picker__grid">
      {BLOCK_TILES.map((t) => {
        const Icon = t.icon;
        return (
          <button key={t.type}
            className="pa-picker__tile"
            data-testid={`pa-picker-${t.type}`}
            onClick={() => onPick(t.type)}>
            <Icon size={28} strokeWidth={1.5} />
            <span className="pa-picker__tile-label">{t.label}</span>
            <span className="pa-picker__tile-hint">{t.hint}</span>
          </button>
        );
      })}
    </div>
  </div>
);

// ─── SectionGroup ─────────────────────────────────────────────
const SectionGroup = ({
  section, page, locale,
  isDirty, getDraftValue, onChangeDraft, onSaveField, savingKey, draftKey,
  onToggleVisible, onDelete, onSaveImage, patchSectionPayload, focused, onSelect,
  collapsed, onToggleCollapse,
  draggingId, dragOverId, onDragStart, onDragEnd, onDragOver, onDrop,
}) => {
  const isAdvanced = ADVANCED_TYPES.has(section.section_type);
  const schema = FIELD_SCHEMAS[section.section_type] || DEFAULT_TEXT_FIELDS;
  const trace = TRACEABILITY[section.section_type] || section.section_type;
  const eyebrow = (section.section_type || '').toUpperCase().replace(/_/g, ' ');

  // Count "blocks" (fields) and images for the meta line, like the reference.
  const fieldCount = isAdvanced ? null : schema.length;
  const imageCount = isAdvanced ? null : schema.filter((f) => f.kind === 'image').length;
  const metaParts = [
    `Sort ${section.sort_order}`,
    section.visible ? 'visible' : 'hidden',
  ];
  if (fieldCount != null) metaParts.push(`${fieldCount} ${fieldCount === 1 ? 'blocco' : 'blocchi'}`);
  if (imageCount) metaParts.push(`${imageCount} ${imageCount === 1 ? 'immagine' : 'immagini'}`);

  const isDragging = draggingId === section.id;
  const isDragOver = dragOverId === section.id && draggingId && draggingId !== section.id;

  return (
    <article
      id={`pa-section-${section.section_type}`}
      className="pa-section-group"
      data-testid={`pa-section-${section.section_type}`}
      data-focused={focused ? 'true' : 'false'}
      data-collapsed={collapsed ? 'true' : 'false'}
      data-dragging={isDragging ? 'true' : 'false'}
      data-dragover={isDragOver ? 'true' : 'false'}
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', section.id); } catch (_) {}
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { e.preventDefault(); onDragOver?.(); }}
      onDrop={(e) => { e.preventDefault(); onDrop?.(); }}>
      <header
        className="pa-section-group__head"
        onClick={() => { onSelect?.(); if (collapsed) onToggleCollapse?.(); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') { onSelect?.(); onToggleCollapse?.(); } }}
        title="Click per editare · drag per riordinare">
        <span className="pa-grip" title="Trascina per riordinare" aria-hidden>
          <GripVertical size={14} strokeWidth={1.8} />
        </span>
        <button
          className="pa-collapse-btn"
          onClick={(e) => { e.stopPropagation(); onToggleCollapse?.(); }}
          data-testid={`pa-collapse-${section.section_type}`}
          title={collapsed ? 'Espandi' : 'Comprimi'}>
          {collapsed
            ? <ChevronRight size={14} strokeWidth={2} />
            : <ChevronDown size={14} strokeWidth={2} />}
        </button>
        <span className="pa-section-group__eyebrow">{eyebrow}</span>
        <span className="pa-section-group__meta">{metaParts.join(' · ')}</span>
        <div className="pa-section-group__actions" onClick={(e) => e.stopPropagation()}>
          <button className="pa-toggle-btn"
            onClick={() => onToggleVisible(section)}
            data-testid={`pa-toggle-${section.section_type}`}
            title={section.visible ? 'Nascondi sezione' : 'Mostra sezione'}>
            {section.visible ? <Eye size={14} strokeWidth={1.7} /> : <EyeOff size={14} strokeWidth={1.7} />}
          </button>
          <button className="pa-ghost-btn pa-ghost-btn--danger"
            onClick={() => onDelete(section)}
            data-testid={`pa-delete-${section.section_type}`}>
            <Trash2 size={12} strokeWidth={1.7} /> Elimina
          </button>
        </div>
      </header>

      {!collapsed && (
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
      )}
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
