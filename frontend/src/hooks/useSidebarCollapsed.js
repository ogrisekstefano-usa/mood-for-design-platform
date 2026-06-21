/**
 * useSidebarCollapsed — persistent collapse state for the main app Sidebar.
 *
 * Persisted in localStorage so the user's preference survives refresh.
 * Default = expanded.
 */
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'mfd_sidebar_collapsed';

// ITER144 UX CLEANUP · default = expanded so labels are immediately
// visible to new users. The user can still collapse manually and
// the preference is persisted in localStorage.
const initial = () => {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return false;   // first visit → expanded
  if (stored === '0') return false;    // user explicitly expanded
  return true;                         // user explicitly collapsed
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
