/**
 * EditorPanel — Secondary Contextual Panel for the Moodboard editor.
 *
 * Strict scope (locked by the user during the IA refactor):
 *
 *   Insert       — single source of truth for content blocks (text, image,
 *                  gallery, palette, shape, arrow, note, product, material,
 *                  divider, hotspot). Used to be split across the top
 *                  ActionToolbar AND the previous LibraryPanel — duplicated.
 *                  Now lives ONLY here.
 *   Assets       — uploaded assets · saved elements · personal library.
 *                  Elegant stub for now (no backend persistence in scope).
 *   Pages        — detailed page settings & layouts. The bottom filmstrip
 *                  remains the primary "quick navigation" — this tab carries
 *                  the master-layouts gallery + page-level metadata, never
 *                  duplicating filmstrip controls.
 *   Inspirations — elegant placeholder for the future Inspirations Hub
 *                  (saved references, client wishlist). Communicates intent.
 *
 * The component lives next to the GLOBAL left rail (Sidebar) which only
 * handles workspace navigation. They are intentionally different surfaces.
 *
 * Collapse persists in localStorage via `mfd_library_collapsed` (same key
 * as the legacy LibraryPanel so the user's previous choice carries over).
 */
import React, { useEffect, useState } from 'react';
import { useBlueprint } from '../../contexts/BlueprintContext';
import api from '../../lib/api';
import {
  Plus, Image as ImageIcon, Type, Palette, StickyNote, Package, Layers,
  Square as SquareIcon, Minus, Crosshair, Hexagon, MoveRight, LayoutGrid,
  BookOpen, Sparkles, FileText, ArrowUpRight,
  PanelLeftClose, PanelLeftOpen, FilePlus,
} from 'lucide-react';

const LS_KEY = 'mfd_library_collapsed';

// ── Insert catalog ──────────────────────────────────────────────────────────
//
// Mirror of the editor UI revision mockup. Four editorial categories +
// a Templates section that hands off to the SkeletonPicker.
//   BASICS     · Text · Image · Gallery · Note
//   VISUALS    · Palette · Shape · Arrow · Hotspot
//   MATERIALS  · Material · Product · Texture
//   ANNOTATION · Line · Divider · Label
//
// `block` = direct dispatch to onAddBlock(type). `disabled` items are reserved
// for the next stability pass — they render as faded tiles to signal intent
// without overpromising.
const INSERT_GROUPS = [
  {
    key: 'basics',
    fallbackTitle: 'Basics',
    items: [
      { key: 'text',    icon: Type,        block: 'text' },
      { key: 'image',   icon: ImageIcon,   block: 'image' },
      { key: 'gallery', icon: LayoutGrid,  openSkeletonsCategory: 'gallery' },
      { key: 'note',    icon: StickyNote,  block: 'note' },
    ],
  },
  {
    key: 'visuals',
    fallbackTitle: 'Visuals',
    items: [
      { key: 'palette', icon: Palette,     block: 'palette' },
      { key: 'shape',   icon: SquareIcon,  block: 'shape' },
      { key: 'arrow',   icon: MoveRight,   block: 'arrow' },
      { key: 'hotspot', icon: Crosshair,   disabled: true },
    ],
  },
  {
    key: 'materials',
    fallbackTitle: 'Materials',
    items: [
      { key: 'material', icon: Layers,  block: 'material' },
      { key: 'product',  icon: Package, block: 'product' },
      { key: 'texture',  icon: Hexagon, disabled: true },
    ],
  },
  {
    key: 'annotation',
    fallbackTitle: 'Annotation',
    items: [
      { key: 'line',    icon: Minus,        disabled: true },
      { key: 'divider', icon: Hexagon,      block: 'divider' },
      { key: 'label',   icon: FileText,     disabled: true },
    ],
  },
];

const RAIL_BLOCK_ICONS = {
  text: Type, image: ImageIcon, palette: Palette, shape: SquareIcon,
  note: StickyNote, arrow: MoveRight, material: Layers, product: Package,
};

// ── Atoms ───────────────────────────────────────────────────────────────────
const Tile = ({ icon: Icon, label, onClick, disabled, testid }) => (
  <button type="button"
          onClick={disabled ? undefined : onClick}
          disabled={disabled}
          data-testid={testid}
          title={disabled ? `${label} · coming soon` : label}
          className={`group aspect-square flex flex-col items-center justify-center gap-2 p-2
                      rounded-[var(--bp-radius-sm)] border transition-all
                      ${disabled
                        ? 'border-[var(--bp-border)]/50 bg-transparent text-[var(--bp-text-subtle)] cursor-not-allowed opacity-40'
                        : 'border-[var(--bp-border)] bg-[var(--bp-surface-1)]/60 hover:border-[var(--bp-primary)]/50 hover:bg-[var(--bp-surface-2)]/80 text-[var(--bp-text-secondary)] hover:text-[var(--bp-text-primary)]'}`}>
    <Icon size={18} strokeWidth={1.25}
          className={disabled ? '' : 'group-hover:text-[var(--bp-primary)] transition-colors'} />
    <span className="bp-caption !text-[10px] leading-none">{label}</span>
  </button>
);

const RailItem = ({ icon: Icon, label, onClick, testid }) => (
  <button type="button"
          onClick={onClick}
          data-testid={testid}
          title={label}
          aria-label={label}
          className="w-10 h-10 flex items-center justify-center rounded-[var(--bp-radius-sm)]
                     text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]
                     hover:bg-[var(--bp-surface-2)]/60 transition-colors">
    <Icon size={16} strokeWidth={1.5} />
  </button>
);

const SectionTitle = ({ children }) => (
  <p className="bp-eyebrow !text-[9px] !tracking-[0.18em] !text-[var(--bp-text-muted)] mb-3 mt-5 first:mt-0">
    {children}
  </p>
);

const TabBtn = ({ active, onClick, label, testid }) => (
  <button onClick={onClick} data-testid={testid}
          className={`pb-2 px-0 bp-eyebrow !text-[10px] !tracking-[0.14em] whitespace-nowrap transition-colors relative
                      ${active
                        ? '!text-[var(--bp-text-primary)]'
                        : '!text-[var(--bp-text-secondary)] hover:!text-[var(--bp-text-primary)]'}`}>
    {label}
    {active && (
      <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[var(--bp-primary)] rounded-full" />
    )}
  </button>
);

// ── Tabs ────────────────────────────────────────────────────────────────────
const InsertTab = ({ onAddBlock, skeletons = [], onOpenSkeletons, onOpenSkeletonPicker, t }) => (
  <>
    {INSERT_GROUPS.map((group) => (
      <React.Fragment key={group.key}>
        <SectionTitle>
          {t(`moodboards.insert.group.${group.key}`, null, group.fallbackTitle)}
        </SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {group.items.map((item) => (
            <Tile key={item.key}
                  icon={item.icon}
                  label={t(`moodboards.insert.${item.key}`, null, item.key.charAt(0).toUpperCase() + item.key.slice(1))}
                  disabled={item.disabled}
                  onClick={() => item.block && onAddBlock(item.block)}
                  testid={`insert-${item.key}`} />
          ))}
        </div>
      </React.Fragment>
    ))}

    {/* Templates — quick row of master layouts so designers can chain a page
        without leaving the Insert tab. Hand-off to the SkeletonPicker for the
        full gallery. */}
    {skeletons.length > 0 && (
      <>
        <SectionTitle>{t('moodboards.insert.group.templates', null, 'Templates')}</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {skeletons.slice(0, 4).map((sk) => {
            const label = t(sk.label_key);
            return (
              <Tile key={sk.id}
                    icon={FilePlus}
                    label={label && label !== sk.label_key ? label : sk.id.replace(/_/g, ' ')}
                    onClick={() => onOpenSkeletons?.(sk.id)}
                    testid={`insert-template-${sk.id}`} />
            );
          })}
        </div>
        <button type="button"
                onClick={() => onOpenSkeletonPicker?.()}
                data-testid="insert-templates-all"
                className="w-full mt-3 py-2 text-[10px] tracking-[0.22em] uppercase text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors flex items-center justify-center gap-1.5">
          {t('moodboards.insert.exploreTemplates', null, 'Explore all templates')}
          <ArrowUpRight size={11} strokeWidth={1.5} />
        </button>
      </>
    )}
  </>
);

const AssetsTab = ({ t, locale }) => {
  const isIT = (locale || '').toLowerCase().startsWith('it');
  const L = (it, en) => isIT ? it : en;
  return (
  <>
    {/* Intro / explainer — clarifies what the tab is for so it never reads as
        "empty / unfinished" to the designer. */}
    <div className="px-3 py-3 mb-2 rounded-[var(--bp-radius-sm)] bg-[var(--bp-surface-1)]/30 border border-[var(--bp-border)]">
      <p className="text-[12px] text-[var(--bp-text-secondary)] italic leading-[1.55]"
         style={{ fontFamily: 'Playfair Display, var(--bp-font-heading), serif' }}>
        {t('moodboards.assets.intro', null, L(
          'La tua libreria personale. Foto caricate, elementi salvati e composizioni riutilizzabili.',
          'Your personal library. Uploaded photos, saved elements and reusable compositions.'))}
      </p>
    </div>

    <SectionTitle>
      {t('moodboards.assets.uploaded', null, L('Foto caricate', 'Uploaded photos'))}
    </SectionTitle>
    <div className="px-3 py-6 text-center rounded-[var(--bp-radius-sm)] border border-dashed border-[var(--bp-border)] bg-[var(--bp-surface-1)]/30 mb-4">
      <p className="text-[11.5px] !text-[var(--bp-text-secondary)] leading-[1.55] italic"
         style={{ fontFamily: 'Playfair Display, var(--bp-font-heading), serif' }}>
        {t('moodboards.assets.uploadedHint', null, L(
          'Carica un\'immagine da un blocco foto sul canvas — apparirà qui per essere riutilizzata.',
          'Upload an image from a photo block on the canvas — it will appear here to be reused.'))}
      </p>
    </div>

    <SectionTitle>
      {t('moodboards.assets.saved', null, L('Elementi salvati', 'Saved elements'))}
    </SectionTitle>
    <div className="px-3 py-6 text-center rounded-[var(--bp-radius-sm)] border border-dashed border-[var(--bp-border)] bg-[var(--bp-surface-1)]/30">
      <Sparkles size={14} strokeWidth={1.3} className="mx-auto mb-2 text-[var(--bp-text-subtle)]" />
      <p className="text-[11.5px] !text-[var(--bp-text-secondary)] leading-[1.55] italic"
         style={{ fontFamily: 'Playfair Display, var(--bp-font-heading), serif' }}>
        {t('moodboards.assets.savedEmpty', null, L(
          'Clicca col tasto destro su un blocco per salvarlo come elemento riutilizzabile.',
          'Right-click any block on the canvas to save it as a reusable element.'))}
      </p>
    </div>
  </>
  );
};

const PagesTab = ({ pages = [], skeletons = [], activePageId, onOpenSkeletons, onOpenSkeletonPicker, t }) => (
  <>
    <SectionTitle>{t('moodboards.pages.layouts', null, 'Master layouts')}</SectionTitle>
    <div className="grid grid-cols-2 gap-2">
      {skeletons.slice(0, 6).map((sk) => {
        const label = t(sk.label_key);
        return (
          <Tile key={sk.id}
                icon={FilePlus}
                label={label && label !== sk.label_key ? label : sk.id.replace(/_/g, ' ')}
                onClick={() => onOpenSkeletons?.(sk.id)}
                testid={`page-layout-${sk.id}`} />
        );
      })}
    </div>
    <button type="button"
            onClick={() => onOpenSkeletonPicker?.()}
            data-testid="page-layouts-all"
            className="w-full mt-3 py-2 text-[10px] tracking-[0.22em] uppercase text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors flex items-center justify-center gap-1.5">
      {t('moodboards.pages.exploreAll', null, 'Explore all layouts')}
      <ArrowUpRight size={11} strokeWidth={1.5} />
    </button>

    <SectionTitle>{t('moodboards.pages.thisProject', null, 'This project')}</SectionTitle>
    <div className="space-y-1">
      {pages.length === 0 && (
        <p className="bp-caption !text-[10.5px] !text-[var(--bp-text-subtle)]">—</p>
      )}
      {pages.map((p, i) => (
        <div key={p.id}
             data-testid={`pages-tab-item-${p.id}`}
             className={`flex items-center gap-3 px-2.5 py-2 rounded-[var(--bp-radius-xs)] border transition-colors
                         ${p.id === activePageId
                           ? 'border-[var(--bp-primary)]/40 bg-[var(--bp-primary)]/8'
                           : 'border-transparent hover:bg-[var(--bp-surface-2)]/40'}`}>
          <span className="text-[10px] font-mono tabular-nums text-[var(--bp-text-subtle)] w-6">
            {String(i + 1).padStart(2, '0')}
          </span>
          <span className="bp-caption !text-[11px] text-[var(--bp-text-primary)] truncate flex-1">
            {p.title || t('moodboards.pages.untitled', null, 'Untitled page')}
          </span>
        </div>
      ))}
    </div>

    <p className="bp-caption !text-[10px] !text-[var(--bp-text-subtle)] mt-4 leading-relaxed">
      {t('moodboards.pages.hint', null,
        'Use the bottom filmstrip to reorder or duplicate pages. This tab manages layouts and structure.')}
    </p>
  </>
);

const InspirationsTab = ({ t }) => (
  <div className="py-8 text-center">
    <div className="w-12 h-12 mx-auto mb-4 rounded-full border border-[var(--bp-border)] flex items-center justify-center text-[var(--bp-text-subtle)]">
      <BookOpen size={16} strokeWidth={1.3} />
    </div>
    <p className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)] mb-2">
      {t('moodboards.inspirations.eyebrow', null, 'Coming soon')}
    </p>
    <h4 className="bp-h3 !text-[14px] text-[var(--bp-text-primary)] mb-2">
      {t('moodboards.inspirations.title', null, 'Inspirations Hub')}
    </h4>
    <p className="bp-caption !text-[11px] !text-[var(--bp-text-secondary)] leading-relaxed max-w-[200px] mx-auto">
      {t('moodboards.inspirations.hint', null,
        'Saved references, client mood notes and project wishlist will live here — pinned to every moodboard you craft.')}
    </p>
    <div className="mt-5 inline-flex items-center gap-1.5 text-[9px] tracking-[0.22em] uppercase text-[var(--bp-text-subtle)]">
      <FileText size={10} strokeWidth={1.5} />
      <span>{t('moodboards.inspirations.preview', null, 'Preview release')}</span>
    </div>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────
const EditorPanel = ({
  onAddBlock, onOpenSkeletons, onOpenSkeletonPicker, t,
  pages, activePageId,
}) => {
  const [tab, setTab] = useState('insert');
  const { locale } = useBlueprint();
  const [collapsed, setCollapsed] = useState(
    typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) === '1' : false,
  );

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(LS_KEY, next ? '1' : '0');
      return next;
    });
  };

  // Master-layouts catalog — same endpoint as the legacy LibraryPanel.
  const [skeletons, setSkeletons] = useState([]);
  useEffect(() => {
    api.get('/api/moodboards/_meta/page_skeletons')
      .then((r) => setSkeletons(r.data?.data || []))
      .catch(() => setSkeletons([]));
  }, []);

  // ── COLLAPSED VIEW ────────────────────────────────────────────────────────
  if (collapsed) {
    // Show ONE quick column of the most-used Insert items as an icon rail.
    // Tabs disappear in collapsed mode — the user must expand to swap tabs.
    const QUICK_INSERT = ['text', 'image', 'palette', 'shape', 'note', 'arrow', 'material', 'product'];
    return (
      <aside data-testid="editor-panel"
             style={{ width: 56 }}
             className="flex-shrink-0 border-r border-[var(--bp-border)] bg-[var(--bp-surface-1)]/40 flex flex-col min-h-0 transition-[width] duration-200 ease-out">
        <div className="px-2 pt-3 pb-2 border-b border-[var(--bp-border)] flex justify-center">
          <button type="button"
                  onClick={toggleCollapsed}
                  data-testid="editor-panel-expand"
                  title={t('moodboards.library.expand', null, 'Expand panel')}
                  className="w-10 h-10 flex items-center justify-center rounded-[var(--bp-radius-sm)]
                             text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]
                             hover:bg-[var(--bp-surface-2)]/60 transition-colors">
            <PanelLeftOpen size={14} strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center gap-1 py-3 overflow-y-auto">
          {QUICK_INSERT.map((k) => {
            const Icon = RAIL_BLOCK_ICONS[k] || Plus;
            return (
              <RailItem key={k}
                        icon={Icon}
                        label={t(`moodboards.insert.${k}`, null, k)}
                        onClick={() => onAddBlock(k)}
                        testid={`rail-insert-${k}`} />
            );
          })}
        </div>
      </aside>
    );
  }

  // ── EXPANDED VIEW ─────────────────────────────────────────────────────────
  return (
    <aside data-testid="editor-panel"
           style={{ width: 264 }}
           className="flex-shrink-0 border-r border-[var(--bp-border)] bg-[var(--bp-surface-1)]/40 flex flex-col min-h-0 transition-[width] duration-200 ease-out">
      {/* Header — collapse trigger + tab strip */}
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <p className="bp-eyebrow !text-[10px] !text-[var(--bp-text-secondary)]">
            {t('moodboards.editorPanel.title', null, 'Workspace')}
          </p>
          <button type="button"
                  onClick={toggleCollapsed}
                  data-testid="editor-panel-collapse"
                  title={t('moodboards.library.collapse', null, 'Collapse panel')}
                  className="p-1 rounded-[var(--bp-radius-xs)] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] hover:bg-[var(--bp-surface-2)]/60 transition-colors">
            <PanelLeftClose size={13} strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex gap-3 border-b border-[var(--bp-border)] pr-2">
          <TabBtn active={tab === 'insert'}        onClick={() => setTab('insert')}        label={t('moodboards.tab.insert',        null, 'Insert')}       testid="editor-tab-insert" />
          <TabBtn active={tab === 'assets'}        onClick={() => setTab('assets')}        label={t('moodboards.tab.assets',        null, 'Assets')}       testid="editor-tab-assets" />
          <TabBtn active={tab === 'pages'}         onClick={() => setTab('pages')}         label={t('moodboards.tab.pages',         null, 'Pages')}        testid="editor-tab-pages" />
          <TabBtn active={tab === 'inspirations'}  onClick={() => setTab('inspirations')}  label={t('moodboards.tab.inspirations',  null, 'Mood')}         testid="editor-tab-inspirations" />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-1">
        {tab === 'insert'       && <InsertTab        onAddBlock={onAddBlock} skeletons={skeletons}
                                                     onOpenSkeletons={onOpenSkeletons}
                                                     onOpenSkeletonPicker={onOpenSkeletonPicker}
                                                     t={t} />}
        {tab === 'assets'       && <AssetsTab        t={t} locale={locale} />}
        {tab === 'pages'        && <PagesTab         pages={pages || []} skeletons={skeletons}
                                                     activePageId={activePageId}
                                                     onOpenSkeletons={onOpenSkeletons}
                                                     onOpenSkeletonPicker={onOpenSkeletonPicker}
                                                     t={t} />}
        {tab === 'inspirations' && <InspirationsTab  t={t} />}
      </div>
    </aside>
  );
};

export default EditorPanel;
