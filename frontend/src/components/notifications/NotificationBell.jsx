/**
 * NotificationBell + Drawer — ITER154 + Sprint F · F1
 *
 * Realtime activation:
 *   - Supabase Realtime subscribe → `relationship_notifications`
 *     filter `recipient_user_id=eq.<me>`
 *   - INSERT/UPDATE/DELETE merge silently into local items
 *   - Fallback polling 15s as safety net (also reconciles on tab focus)
 *   - No flashing, no toast, no badge storm — items emerge with
 *     the existing nb-item-in 220ms ease + stagger animation.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X } from 'lucide-react';
import { listNotifications, unreadCount, markNotifRead, markAllNotifRead } from '../../lib/studioOrchestra';
import { subscribe, isTabVisible } from '../../lib/realtimeBus';
import useFaviconBadge from '../../lib/useFaviconBadge';
import { useAuth } from '../../contexts/AuthContext';
import './notification-bell.css';

const POLL_MS = 15000; // safety net — realtime is the primary channel

const fmt = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'ora';
  if (diff < 3600) return `${Math.floor(diff/60)} min`;
  if (diff < 86400) return `${Math.floor(diff/3600)} h`;
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
};

const groupBy = (items) => {
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(now);
  const yesterday = today - 86400 * 1000;
  const weekAgo = today - 6 * 86400 * 1000;
  const buckets = { today: [], yesterday: [], this_week: [], earlier: [] };
  for (const n of items) {
    const ts = new Date(n.created_at).getTime();
    if (ts >= today) buckets.today.push(n);
    else if (ts >= yesterday) buckets.yesterday.push(n);
    else if (ts >= weekAgo) buckets.this_week.push(n);
    else buckets.earlier.push(n);
  }
  return buckets;
};

const LABELS = {
  it: {
    today: 'Oggi',
    yesterday: 'Ieri',
    this_week: 'Questa settimana',
    earlier: 'Prima',
    empty_title: 'Le tue relazioni stanno respirando lentamente.',
    empty_sub: 'Tornerà presto qualcosa da ascoltare.',
    eyebrow: 'Risonanze',
    title: 'Cosa accade nelle tue relazioni',
    mark_all: 'Segna tutto come letto',
  },
  en: {
    today: 'Today',
    yesterday: 'Yesterday',
    this_week: 'This week',
    earlier: 'Earlier',
    empty_title: 'Your relationships are breathing slowly.',
    empty_sub: 'Something will return to listen to, soon.',
    eyebrow: 'Resonances',
    title: 'What is happening in your relationships',
    mark_all: 'Mark all as read',
  },
};

const NotificationBell = ({ locale = 'it' }) => {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const pollRef = useRef(null);
  const { user } = useAuth();
  const myId = user?.id || null;
  const L = LABELS[locale] || LABELS.it;

  useFaviconBadge(unread);

  const refresh = useCallback(async () => {
    try {
      const { data: c } = await unreadCount();
      setUnread(c?.count || 0);
      if (open) {
        const { data: d } = await listNotifications({ limit: 60 });
        setItems(d?.data || []);
      }
    } catch { /* silent */ }
  }, [open]);

  // Fallback polling — 15s safety net, also reconciles on tab focus
  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, POLL_MS);
    const onVisible = () => { if (isTabVisible()) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(pollRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  // Realtime push — primary channel
  useEffect(() => {
    if (!myId) return undefined;

    const mergeInsert = (row) => {
      setItems(prev => {
        if (prev.some(n => n.id === row.id)) return prev;          // dedup
        return [row, ...prev].slice(0, 60);
      });
      if (!row.read_at) setUnread(u => u + 1);
    };

    const mergeUpdate = (row) => {
      setItems(prev => {
        const next = prev.map(n => n.id === row.id ? { ...n, ...row } : n);
        const u = next.reduce((acc, n) => acc + (n.read_at ? 0 : 1), 0);
        setUnread(u);
        return next;
      });
    };

    const mergeDelete = (row) => {
      setItems(prev => prev.filter(n => n.id !== row.id));
      if (row && !row.read_at) setUnread(u => Math.max(0, u - 1));
    };

    const unsub = subscribe({
      key: `notif:${myId}`,
      table: 'relationship_notifications',
      event: '*',
      filter: `recipient_user_id=eq.${myId}`,
      onPayload: (p) => {
        // Defer to microtask to avoid setState-in-render warnings when
        // Supabase dispatches callbacks synchronously from inside React render.
        queueMicrotask(() => {
          if (p.eventType === 'INSERT' && p.new) mergeInsert(p.new);
          else if (p.eventType === 'UPDATE' && p.new) mergeUpdate(p.new);
          else if (p.eventType === 'DELETE' && p.old) mergeDelete(p.old);
        });
      },
    });
    return unsub;
  }, [myId]);

  useEffect(() => {
    if (open) {
      (async () => {
        try {
          const { data } = await listNotifications({ limit: 60 });
          setItems(data?.data || []);
        } catch { /* silent */ }
      })();
    }
  }, [open]);

  const markRead = async (id) => {
    await markNotifRead(id).catch(() => {});
    setItems(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    setUnread(u => Math.max(0, u - 1));
  };

  const markAll = async () => {
    await markAllNotifRead().catch(() => {});
    const now = new Date().toISOString();
    setItems(prev => prev.map(n => n.read_at ? n : { ...n, read_at: now }));
    setUnread(0);
  };

  const buckets = groupBy(items);
  const bucketsOrdered = [
    ['today', buckets.today],
    ['yesterday', buckets.yesterday],
    ['this_week', buckets.this_week],
    ['earlier', buckets.earlier],
  ];

  return (
    <>
      <button
        type="button"
        className={`nb__pill ${unread > 0 ? 'nb__pill--unread' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="notifications"
        data-testid="notification-bell"
      >
        <Bell size={16} strokeWidth={1.6} />
        {unread > 0 && (
          <span className="nb__badge" data-testid="notification-bell-badge">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && createPortal(
        <>
          <div className="nb-overlay" onClick={() => setOpen(false)} />
          <aside className="nb-drawer" role="dialog" data-testid="notification-drawer">
            <header className="nb-drawer__head">
              <div>
                <p className="nb-drawer__eyebrow">{L.eyebrow}</p>
                <h3 className="nb-drawer__title">{L.title}</h3>
              </div>
              <button className="nb-drawer__close" onClick={() => setOpen(false)} aria-label="close">
                <X size={16} />
              </button>
            </header>

            {unread > 0 && (
              <button className="nb-drawer__markall" onClick={markAll} data-testid="nb-mark-all-read">
                {L.mark_all}
              </button>
            )}

            {items.length === 0 && (
              <div className="nb-drawer__empty" data-testid="nb-empty">
                <p className="nb-drawer__empty-title">{L.empty_title}</p>
                <p className="nb-drawer__empty-sub">{L.empty_sub}</p>
              </div>
            )}

            {bucketsOrdered.map(([k, arr]) => arr.length > 0 && (
              <section key={k} className="nb-bucket">
                <p className="nb-bucket__head">{L[k]}</p>
                <ul className="nb-list">
                  {arr.map(n => (
                    <li
                      key={n.id}
                      className={`nb-item ${!n.read_at ? 'nb-item--unread' : ''} nb-item--p-${n.priority || 'normal'}`}
                      onClick={() => !n.read_at && markRead(n.id)}
                      data-testid={`nb-item-${n.id}`}
                    >
                      <p className="nb-item__narrative">{n.narrative || n.title || n.notification_type}</p>
                      <p className="nb-item__meta">
                        <span>{fmt(n.created_at)}</span>
                        <span className="nb-item__type">· {(n.notification_type || '').replaceAll('_', ' ')}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </aside>
        </>,
        document.body
      )}
    </>
  );
};

export default NotificationBell;
