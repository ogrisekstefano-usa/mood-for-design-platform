/**
 * useSidebarCollapsed — persistent collapse state for the main app Sidebar.
 *
 * Persisted in localStorage so the user's preference survives refresh.
 * Default = expanded.
 */
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'mfd_sidebar_collapsed';

// MOOD for DESIGN™ defaults to an icon-only "architectural" left rail on
// first load — same as Figma. Users can expand explicitly and we persist
// that choice. We DO NOT auto-expand on hover (the user explicitly rejected
// hover-expand: it creates visual jitter and breaks the editorial calm).
const initial = () => {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === '0') return false;
  return true; // default = collapsed (icon-only)
};

export default function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(initial);

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-sidebar',
      collapsed ? 'collapsed' : 'expanded',
    );
  }, [collapsed]);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
