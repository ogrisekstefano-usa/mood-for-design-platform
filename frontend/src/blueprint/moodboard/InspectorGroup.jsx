/**
 * InspectorGroup — collapsible editorial section used in the Right Inspector.
 *
 * Design intent: each group reads like a quiet chapter of a magazine.
 *  - Header: small monospaced eyebrow + chevron rotation (no busy icons)
 *  - Body: soft animated reveal via grid-template-rows trick (no height jank)
 *  - State: persisted to localStorage keyed by `id`, so the designer's
 *    preferences carry across sessions
 *  - Auto-open: a per-block-type defaults map can pre-open the relevant
 *    groups (e.g. when an IMAGE is selected → IMAGE + STYLE open, TYPOGRAPHY
 *    closed). This dramatically lowers visual noise.
 *
 * This file deliberately ships zero runtime deps beyond React + lucide.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

const STORAGE_PREFIX = 'mood.inspector.group.';

// Per-block-type defaults: which groups auto-open when a block is selected.
// Keep this map small — it's the heuristic that makes the inspector "calm
// by default" instead of a wall of expanded sections.
export const AUTO_OPEN_DEFAULTS = {
  image:    { TYPOGRAPHY: false, LAYOUT: false, STYLE: true,  IMAGE: true,  ADVANCED: false },
  text:     { TYPOGRAPHY: true,  LAYOUT: false, STYLE: true,  IMAGE: false, ADVANCED: false },
  shape:    { TYPOGRAPHY: false, LAYOUT: false, STYLE: true,  IMAGE: false, ADVANCED: false },
  arrow:    { TYPOGRAPHY: false, LAYOUT: false, STYLE: true,  IMAGE: false, ADVANCED: false },
  palette:  { TYPOGRAPHY: false, LAYOUT: false, STYLE: true,  IMAGE: false, ADVANCED: false },
  material: { TYPOGRAPHY: false, LAYOUT: false, STYLE: true,  IMAGE: true,  ADVANCED: false },
  product:  { TYPOGRAPHY: false, LAYOUT: false, STYLE: true,  IMAGE: true,  ADVANCED: false },
  note:     { TYPOGRAPHY: true,  LAYOUT: false, STYLE: true,  IMAGE: false, ADVANCED: false },
  default:  { TYPOGRAPHY: false, LAYOUT: false, STYLE: true,  IMAGE: false, ADVANCED: false },
};

/** Read the persisted open/closed state for a group; falls back to default. */
const readPersisted = (id, fallback) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = window.localStorage.getItem(STORAGE_PREFIX + id);
    if (v === null) return fallback;
    return v === '1';
  } catch (_) { return fallback; }
};
const writePersisted = (id, open) => {
  try { window.localStorage.setItem(STORAGE_PREFIX + id, open ? '1' : '0'); } catch (_) {}
};

/**
 * Single collapsible group. `groupKey` is the canonical name (TYPOGRAPHY /
 * LAYOUT / STYLE / IMAGE / ADVANCED) — used both as the persistence key and
 * the auto-open lookup key. `blockType` lets the parent reset/seed state
 * when the selection changes.
 */
const InspectorGroup = ({ groupKey, blockType, title, eyebrow, children, count }) => {
  const storageId = `${blockType || 'default'}.${groupKey}`;
  const initialOpen = (AUTO_OPEN_DEFAULTS[blockType] || AUTO_OPEN_DEFAULTS.default)[groupKey] ?? false;
  const [open, setOpen] = useState(() => readPersisted(storageId, initialOpen));

  // When block type changes, re-read the persisted preference for the NEW
  // block-type's group (or fall back to the auto-open default).
  useEffect(() => {
    setOpen(readPersisted(storageId, initialOpen));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockType, groupKey]);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      writePersisted(storageId, !prev);
      return !prev;
    });
  }, [storageId]);

  return (
    <section
      data-testid={`inspector-group-${groupKey.toLowerCase()}`}
      data-open={open ? 'true' : 'false'}
      className="inspector-group"
    >
      <button type="button" onClick={toggle}
              data-testid={`inspector-group-toggle-${groupKey.toLowerCase()}`}
              className="w-full flex items-center justify-between py-3.5 px-0.5 group select-none">
        <span className="flex items-baseline gap-2 text-left">
          <span className="font-mono text-[10px] tracking-[0.32em] uppercase
                           text-[var(--bp-text-secondary)]
                           group-hover:text-[var(--bp-text-primary)] transition-colors duration-200">
            {title || groupKey}
          </span>
          {eyebrow && (
            <span className="text-[10px] italic text-[var(--bp-text-subtle)] tracking-normal"
                  style={{ fontFamily: 'Playfair Display, serif' }}>
              · {eyebrow}
            </span>
          )}
          {typeof count === 'number' && count > 0 && (
            <span className="ml-1 text-[9px] font-mono tabular-nums
                             text-[var(--bp-text-subtle)] tracking-wider">
              {String(count).padStart(2, '0')}
            </span>
          )}
        </span>
        <span className="text-[var(--bp-text-subtle)] group-hover:text-[var(--bp-text-primary)]
                         transition-all duration-200"
              style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
          <ChevronDown size={13} strokeWidth={1.6} />
        </span>
      </button>
      {/* Animated reveal — grid-template-rows trick keeps layout fluid */}
      <div className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
           style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div className="overflow-hidden">
          <div className="pb-6 pt-1">{children}</div>
        </div>
      </div>
      {/* Hairline rule — keeps the editorial rhythm without being loud */}
      <div className="h-px bg-[var(--bp-border)] opacity-60" />
    </section>
  );
};

export default InspectorGroup;
