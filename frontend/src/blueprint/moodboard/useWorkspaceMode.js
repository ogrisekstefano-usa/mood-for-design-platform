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

const detectInitial = () => {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
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
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!mq) return undefined;
    const handler = (e) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setMode(e.matches ? 'light' : 'dark');
      }
    };
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
