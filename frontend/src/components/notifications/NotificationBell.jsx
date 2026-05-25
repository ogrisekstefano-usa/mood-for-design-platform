/**
 * NotificationBell + Drawer — ITER153 Sprint E
 *
 * Compact bell with editorial cyan glow + unread badge.
 * Click → side drawer with notifications grouped by Today / Yesterday /
 * Earlier. Polling 3s. NO red aggressive icons.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { listNotifications, unreadCount, markNotifRead, markAllNotifRead } from '../../lib/studioOrchestra';
import './notification-bell.css';

const POLL_MS = 3000;

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
  const t = startOfDay(now);
  const y = t - 86400 * 1000;
  const buckets = { today: [], yesterday: [], earlier: [] };
  for (const n of items) {
    const ts = new Date(n.created_at).getTime();
    if (ts >= t) buckets.today.push(n);
    else if (ts >= y) buckets.yesterday.push(n);
    else buckets.earlier.push(n);
  }
  return buckets;
};

const NotificationBell = ({ locale = 'it', placement = 'header' }) => {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const pollRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const { data: c } = await unreadCount();
      setUnread(c?.count || 0);
      if (open) {
        const { data: d } = await listNotifications({ limit: 50 });
        setItems(d?.data || []);
      }
    } catch { /* silent */ }
  }, [open]);

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [refresh]);

  // When drawer opens, fetch full list
  useEffect(() => {
    if (open) {
      (async () => {
        try {
          const { data } = await listNotifications({ limit: 50 });
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
          <span className="nb__badge" data-testid="notification-bell-badge">{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <>
          <div className="nb-overlay" onClick={() => setOpen(false)} />
          <aside className="nb-drawer" role="dialog" data-testid="notification-drawer">
            <header className="nb-drawer__head">
              <div>
                <p className="nb-drawer__eyebrow">{locale === 'it' ? 'Risonanze' : 'Resonances'}</p>
                <h3 className="nb-drawer__title">
                  {locale === 'it' ? 'Cosa accade nelle tue relazioni' : 'What is happening in your relationships'}
                </h3>
              </div>
              <button className="nb-drawer__close" onClick={() => setOpen(false)} aria-label="close">
                <X size={16} />
              </button>
            </header>

            {unread > 0 && (
              <button className="nb-drawer__markall" onClick={markAll} data-testid="nb-mark-all-read">
                {locale === 'it' ? 'Segna tutto come letto' : 'Mark all as read'}
              </button>
            )}

            {items.length === 0 && (
              <p className="nb-drawer__empty">
                {locale === 'it'
                  ? 'Per ora silenzio. Le tue relazioni stanno respirando.'
                  : 'Quiet for now. Your relationships are breathing.'}
              </p>
            )}

            {Object.entries(buckets).map(([k, arr]) => arr.length > 0 && (
              <section key={k} className="nb-bucket">
                <p className="nb-bucket__head">
                  {k === 'today' ? (locale === 'it' ? 'Oggi' : 'Today')
                    : k === 'yesterday' ? (locale === 'it' ? 'Ieri' : 'Yesterday')
                    : (locale === 'it' ? 'Prima' : 'Earlier')}
                </p>
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
                        <span className="nb-item__type">· {n.notification_type.replaceAll('_', ' ')}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </aside>
        </>
      )}
    </>
  );
};

export default NotificationBell;
