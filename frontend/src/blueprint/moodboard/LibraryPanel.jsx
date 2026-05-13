/**
 * LibraryPanel — left "Aggiungi elementi" panel for Moodboard Builder PRO.
 *
 * Two tabs:
 *   - BLOCCHI    structural skeletons grouped by family (struttura, layout, …)
 *                Clicking one opens the existing SkeletonPicker / triggers
 *                addBlock for primitive content blocks (image/text/palette…).
 *   - CONTENUTI  flat catalog of content primitives: Immagine, Prodotto,
 *                Materiale, Testo, Nota, Video, PDF, Icona, Hotspot.
 *                Future-ready entries (Video/PDF/Icona/Hotspot) render as
 *                elegant DISABLED tiles to keep the UX scaffolded.
 *
 * Bottom slot:
 *   - "Elementi salvati"  → tenant assets stub (future Asset Library)
 *   - "Libreria personale" CTA → future-ready, disabled with tooltip
 *
 * Blueprint-driven: catalog comes from props (BLOCK_TYPES registry + the
 * server-side page skeletons), labels via t(), zero hardcoded copy.
 */
import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import {
  Plus, Image as ImageIcon, Type, Palette, StickyNote, Package, Layers,
  Film, FileText, Star, Crosshair, BookOpen,
} from 'lucide-react';

// ── Map block type → icon ───────────────────────────────────────────────────
const BLOCK_ICON = {
  image: ImageIcon, text: Type, palette: Palette,
  note: StickyNote, product: Package, material: Layers,
};

// Content catalog — primitives + future-ready stubs (disabled).
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

// ── Sub-component: Tile ─────────────────────────────────────────────────────
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

// ── Sub-component: SectionTitle ─────────────────────────────────────────────
const SectionTitle = ({ children }) => (
  <p className="bp-eyebrow !text-[9px] !tracking-[0.18em] !text-[var(--bp-text-subtle)] mb-3 mt-5">
    {children}
  </p>
);

const LibraryPanel = ({ blockTypes, onAddBlock, onOpenSkeletons, t }) => {
  const [tab, setTab] = useState('blocks');  // 'blocks' | 'content'

  // Pull skeleton categories from the server registry so the structural tiles
  // mirror exactly what the SkeletonPicker offers. NEVER hardcoded.
  const [skeletons, setSkeletons] = useState([]);
  useEffect(() => {
    api.get('/api/moodboards/_meta/page_skeletons')
      .then((r) => setSkeletons(r.data?.data || []))
      .catch(() => setSkeletons([]));
  }, []);

  // Group skeletons by category for the "Blocchi" tab section headers
  const skeletonsByCategory = skeletons.reduce((acc, sk) => {
    const k = sk.category_key || 'moodboards.skeleton.category.other';
    (acc[k] = acc[k] || []).push(sk);
    return acc;
  }, {});

  return (
    <aside data-testid="library-panel"
           className="w-[240px] flex-shrink-0 border-r border-[var(--bp-border)] bg-[var(--bp-surface-1)]/40 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <p className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)] mb-3">
          {t('moodboards.library.title')}
        </p>
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
            {/* Primitive blocks first — quick add */}
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

            {/* Structural skeletons from server registry */}
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

        {/* Saved elements — Asset Library stub */}
        <SectionTitle>{t('moodboards.library.section.saved')}</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i}
                 className="aspect-square rounded-[var(--bp-radius-sm)] border border-[var(--bp-border)]/50 bg-[var(--bp-surface-1)]/30 opacity-40" />
          ))}
        </div>
      </div>

      {/* Footer CTA — Libreria personale (future) */}
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
                        : '!text-[var(--bp-text-muted)] hover:!text-[var(--bp-text-secondary)]'}`}>
    {label}
    {active && (
      <span className="absolute left-1 right-1 -bottom-px h-[2px] bg-[var(--bp-primary)] rounded-full" />
    )}
  </button>
);

export default LibraryPanel;
