/**
 * useWorkspaceMode — Editorial Light™ ↔ Cinematic Dark™ switcher.
 *
 *  - On first load: honors `prefers-color-scheme` (no localStorage entry).
 *  - On user toggle: persists in localStorage and writes
 *    `data-workspace-mode="light"|"dark"` on <html>. The CSS palette overrides
 *    react to that attribute (no React re-render of every CSS variable —
 *    keeps the switch atomic and instant).
 *
 *  These are NOT "themes". They are two workspace MODES for the same product:
 *  Editorial Light™ feels like Kinfolk/Aesop paper; Cinematic Dark™ keeps the
 *  current premium dark cinema look.
 */
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'mfd_workspace_mode';
const ATTR = 'data-workspace-mode';

// MOOD for DESIGN™ defaults to Cinematic Dark™ on first load — Editorial Light™
// is an opt-in mode (set explicitly via the topbar segmented switch). We
// intentionally ignore prefers-color-scheme so the product feels deliberately
// authored, not "auto-styled" by the OS.
const detectInitial = () => {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
};

const applyMode = (mode) => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute(ATTR, mode);
};

export default function useWorkspaceMode() {
  const [mode, setMode] = useState(detectInitial);

  useEffect(() => { applyMode(mode); }, [mode]);

  // Listen for OS-level changes ONLY when the user hasn't made an explicit choice.
  // NOTE: we no longer auto-switch to light on prefers-color-scheme change because
  // the product is dark-first by design. The listener is kept as a no-op anchor
  // so future preference-aware features can be reintroduced without code churn.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!mq) return undefined;
    const handler = () => {};
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  const toggle = useCallback(() => {
    setMode((m) => {
      const next = m === 'light' ? 'dark' : 'light';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { mode, toggle, isLight: mode === 'light' };
}
