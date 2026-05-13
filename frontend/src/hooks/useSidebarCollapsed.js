/**
 * useSidebarCollapsed — persistent collapse state for the main app Sidebar.
 *
 * Persisted in localStorage so the user's preference survives refresh.
 * Default = expanded.
 */
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'mfd_sidebar_collapsed';

const initial = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === '1';
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
