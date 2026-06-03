/**
 * useNotifications — M4 client hook.
 *
 * Polling strategy (per user spec):
 *   • 60s when document is visible
 *   • 10min when document is hidden
 *
 * Returns: { count, items, filter, setFilter, loadMore, refresh, markRead,
 *            markAllRead, archive, loading, hasNext }
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationsApi } from './notificationsApi';

const POLL_ACTIVE_MS   = 60 * 1000;
const POLL_INACTIVE_MS = 10 * 60 * 1000;

export default function useNotifications({ enabled = true } = {}) {
  const [count, setCount]   = useState({ total: 0, has_critical: false, by_priority: {}, by_category: {} });
  const [items, setItems]   = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ kind: 'all' });  // all | unread | critical | activity | tenant | advisor
  const [open, setOpen]     = useState(false);
  const timerRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const c = await notificationsApi.unreadCount();
      setCount(c);
    } catch { /* ignore — token may be missing on public pages */ }
  }, [enabled]);

  // Filter → API params mapper
  const filterParams = useCallback(() => {
    switch (filter.kind) {
      case 'unread':   return { only_unread: true };
      case 'critical': return { only_critical: true };
      case 'activity': return { category: 'activity' };
      case 'tenant':   return { category: 'lifecycle' };
      case 'advisor':  return { category: 'assignment' };
      default:         return {};
    }
  }, [filter]);

  const load = useCallback(async (reset = true) => {
    if (!enabled) return;
    setLoading(true);
    try {
      const params = { limit: 30, ...filterParams() };
      if (!reset && cursor) params.cursor = cursor;
      const data = await notificationsApi.list(params);
      setItems(prev => reset ? data.items : [...prev, ...data.items]);
      setCursor(data.next_cursor || null);
    } finally {
      setLoading(false);
    }
  }, [enabled, filterParams, cursor]);

  const markRead = useCallback(async (id) => {
    await notificationsApi.markRead({ ids: [id] });
    setItems(prev => prev.map(it => it.id === id ? { ...it, read_at: new Date().toISOString() } : it));
    refresh();
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    await notificationsApi.markRead({ all: true });
    setItems(prev => prev.map(it => ({ ...it, read_at: it.read_at || new Date().toISOString() })));
    refresh();
  }, [refresh]);

  const archive = useCallback(async (id) => {
    await notificationsApi.archive(id);
    setItems(prev => prev.filter(it => it.id !== id));
    refresh();
  }, [refresh]);

  // initial + filter-driven load
  useEffect(() => { if (open) { setCursor(null); load(true); } }, [open, filter, load]);

  // polling with visibility-awareness
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await refresh();
      const ms = document.hidden ? POLL_INACTIVE_MS : POLL_ACTIVE_MS;
      timerRef.current = setTimeout(tick, ms);
    };
    tick();
    const visChange = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener('visibilitychange', visChange);
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', visChange);
    };
  }, [enabled, refresh]);

  return {
    count, items, filter, setFilter,
    open, setOpen,
    loading, hasNext: !!cursor,
    loadMore: () => load(false),
    refresh, markRead, markAllRead, archive,
  };
}
