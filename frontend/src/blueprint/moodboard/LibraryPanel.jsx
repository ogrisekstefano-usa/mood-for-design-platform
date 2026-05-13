/**
 * LibraryPanel — left rail for Moodboard Builder PRO™ with collapse support.
 *
 * Collapsed mode: 56px width, primitive blocks rendered as a single-column
 * icon strip — clicking adds the block. Tabs and footer CTA are hidden.
 * Expanded mode: 240px width with full tabs (Blocchi · Contenuti),
 * skeleton categories, saved-elements stub, and personal library CTA.
 *
 * Collapse persists in localStorage via key `mfd_library_collapsed`.
 */
import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import {
  Plus, Image as ImageIcon, Type, Palette, StickyNote, Package, Layers,
  Film, FileText, Star, Crosshair, BookOpen,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';

const LS_KEY = 'mfd_library_collapsed';

const BLOCK_ICON = {
  image: ImageIcon, text: Type, palette: Palette,
  note: StickyNote, product: Package, material: Layers,
};

const CONTENT_CATALOG = [
  { key: 'image',    icon: ImageIcon,  disabled: false },
  { key: 'product',  icon: Package,    disabled: false },
  { key: 'material', icon: Layers,     disabled: false },
  { key: 'text',     icon: Type,       disabled: false },
  { key: 'note',     icon: StickyNote, disabled: false },
  { key: 'video',    icon: Film,       disabled: true  },
  { key: 'pdf',      icon: FileText,   disabled: true  },
  { key: 'icon',     icon: Star,       disabled: true  },
  { key: 'hotspot',  icon: Crosshair,  disabled: true  },
];

// ── Sub-component: Tile (expanded view) ─────────────────────────────────────
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

// ── Sub-component: IconRail item (collapsed view) ───────────────────────────
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
  <p className="bp-eyebrow !text-[9px] !tracking-[0.18em] !text-[var(--bp-text-muted)] mb-3 mt-5">
    {children}
  </p>
);

const LibraryPanel = ({ blockTypes, onAddBlock, onOpenSkeletons, t }) => {
  const [tab, setTab] = useState('blocks');
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

  const [skeletons, setSkeletons] = useState([]);
  useEffect(() => {
    api.get('/api/moodboards/_meta/page_skeletons')
      .then((r) => setSkeletons(r.data?.data || []))
      .catch(() => setSkeletons([]));
  }, []);

  const skeletonsByCategory = skeletons.reduce((acc, sk) => {
    const k = sk.category_key || 'moodboards.skeleton.category.other';
    (acc[k] = acc[k] || []).push(sk);
    return acc;
  }, {});

  // ── COLLAPSED VIEW ────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <aside data-testid="library-panel"
             style={{ width: 56 }}
             className="flex-shrink-0 border-r border-[var(--bp-border)] bg-[var(--bp-surface-1)]/40 flex flex-col min-h-0 transition-[width] duration-200 ease-out">
        <div className="px-2 pt-3 pb-2 border-b border-[var(--bp-border)] flex justify-center">
          <button type="button"
                  onClick={toggleCollapsed}
                  data-testid="library-collapse-toggle"
                  title={t('moodboards.library.expand', null, 'Espandi libreria')}
                  className="w-10 h-10 flex items-center justify-center rounded-[var(--bp-radius-sm)]
                             text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]
                             hover:bg-[var(--bp-surface-2)]/60 transition-colors">
            <PanelLeftOpen size={14} strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center gap-1 py-3 overflow-y-auto">
          {blockTypes.map((bt) => (
            <RailItem key={bt.type}
                      icon={BLOCK_ICON[bt.type] || Plus}
                      label={t(`moodboards.block.${bt.type}`)}
                      onClick={() => onAddBlock(bt.type)}
                      testid={`add-${bt.type}`} />
          ))}
          <div className="my-2 h-px w-8 bg-[var(--bp-border)]" />
          {CONTENT_CATALOG.filter((c) => !c.disabled).map((c) => (
            <RailItem key={c.key}
                      icon={c.icon}
                      label={t(`moodboards.content.${c.key}`)}
                      onClick={() => onAddBlock(c.key)}
                      testid={`rail-add-${c.key}`} />
          ))}
        </div>
      </aside>
    );
  }

  // ── EXPANDED VIEW ─────────────────────────────────────────────────────────
  return (
    <aside data-testid="library-panel"
           style={{ width: 240 }}
           className="flex-shrink-0 border-r border-[var(--bp-border)] bg-[var(--bp-surface-1)]/40 flex flex-col min-h-0 transition-[width] duration-200 ease-out">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <p className="bp-eyebrow !text-[10px] !text-[var(--bp-text-secondary)]">
            {t('moodboards.library.title')}
          </p>
          <button type="button"
                  onClick={toggleCollapsed}
                  data-testid="library-collapse-toggle"
                  title={t('moodboards.library.collapse', null, 'Riduci libreria')}
                  className="p-1 rounded-[var(--bp-radius-xs)] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] hover:bg-[var(--bp-surface-2)]/60 transition-colors">
            <PanelLeftClose size={13} strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex gap-4 border-b border-[var(--bp-border)] -mx-1">
          <TabBtn active={tab === 'blocks'} onClick={() => setTab('blocks')}
                  label={t('moodboards.library.tab.blocks')} testid="library-tab-blocks" />
          <TabBtn active={tab === 'content'} onClick={() => setTab('content')}
                  label={t('moodboards.library.tab.content')} testid="library-tab-content" />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-1">
        {tab === 'blocks' ? (
          <>
            <SectionTitle>{t('moodboards.library.section.primitives')}</SectionTitle>
            <div className="grid grid-cols-3 gap-2">
              {blockTypes.map((bt) => (
                <Tile key={bt.type}
                      icon={BLOCK_ICON[bt.type] || Plus}
                      label={t(`moodboards.block.${bt.type}`)}
                      onClick={() => onAddBlock(bt.type)}
                      testid={`add-${bt.type}`} />
              ))}
            </div>
            {Object.entries(skeletonsByCategory).map(([catKey, items]) => {
              const catLabel = t(catKey);
              const safe = catLabel && catLabel !== catKey ? catLabel : catKey.split('.').pop();
              return (
                <React.Fragment key={catKey}>
                  <SectionTitle>{safe}</SectionTitle>
                  <div className="grid grid-cols-3 gap-2">
                    {items.slice(0, 6).map((sk) => (
                      <Tile key={sk.id}
                            icon={Plus}
                            label={(() => {
                              const l = t(sk.label_key);
                              return l && l !== sk.label_key
                                ? l : sk.id.replace(/_/g, ' ');
                            })()}
                            onClick={() => onOpenSkeletons?.(sk.id)}
                            testid={`add-skeleton-${sk.id}`} />
                    ))}
                  </div>
                </React.Fragment>
              );
            })}
          </>
        ) : (
          <>
            <SectionTitle>{t('moodboards.library.section.content')}</SectionTitle>
            <div className="grid grid-cols-3 gap-2">
              {CONTENT_CATALOG.map((c) => (
                <Tile key={c.key}
                      icon={c.icon}
                      label={t(`moodboards.content.${c.key}`)}
                      disabled={c.disabled}
                      onClick={() => !c.disabled && onAddBlock(c.key)}
                      testid={`add-content-${c.key}`} />
              ))}
            </div>
          </>
        )}

        <SectionTitle>{t('moodboards.library.section.saved')}</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i}
                 className="aspect-square rounded-[var(--bp-radius-sm)] border border-[var(--bp-border)]/50 bg-[var(--bp-surface-1)]/30 opacity-40" />
          ))}
        </div>
      </div>

      <div className="px-5 py-4 border-t border-[var(--bp-border)] flex-shrink-0">
        <button type="button" disabled
                data-testid="library-personal-cta"
                title={`${t('moodboards.library.personal')} · coming soon`}
                className="w-full flex items-center justify-center gap-2 py-2.5
                           rounded-[var(--bp-radius-sm)] border border-[var(--bp-border)]
                           text-[var(--bp-text-muted)] opacity-60 cursor-not-allowed">
          <BookOpen size={11} strokeWidth={1.5} />
          <span className="bp-caption !text-[11px]">{t('moodboards.library.personal')}</span>
        </button>
      </div>
    </aside>
  );
};

const TabBtn = ({ active, onClick, label, testid }) => (
  <button onClick={onClick} data-testid={testid}
          className={`pb-2 px-1 bp-eyebrow !text-[10px] !tracking-[0.18em] transition-colors relative
                      ${active
                        ? '!text-[var(--bp-text-primary)]'
                        : '!text-[var(--bp-text-secondary)] hover:!text-[var(--bp-text-primary)]'}`}>
    {label}
    {active && (
      <span className="absolute left-1 right-1 -bottom-px h-[2px] bg-[var(--bp-primary)] rounded-full" />
    )}
  </button>
);

export default LibraryPanel;
