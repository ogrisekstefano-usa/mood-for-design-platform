/**
 * NotificationBell + Drawer · M4 Internal Notification Center
 *
 * Highlights
 * ----------
 * - Polling: 60s while tab visible, 600s (10 min) while hidden
 *   (per M4 spec — no WebSocket for M4; Supabase Realtime kept as
 *   best-effort push, falls back silently if unavailable).
 * - Badge: unread count + amber dot when ≥1 HIGH priority is unread.
 * - DB-driven category catalog → icons + labels from /api/notifications/categories.
 * - Deep links: clicking an item navigates to deep_link_url (with read mark).
 * - Archive button per item + "Archive read" bulk action.
 * - Tabs: All · Unread · Archived.
 * - Strict RBAC enforced server-side; client never reads cross-user data.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Bell, X, Archive,
  Inbox, UserPlus, CheckCircle, UserCheck, AlertTriangle,
  ListChecks, User, Activity, LogIn,
} from 'lucide-react';
import {
  listNotifications, unreadCount, listCategories,
  markRead, markAllRead, archive, archiveRead,
} from '../../lib/notificationsApi';
import { subscribe, isTabVisible } from '../../lib/realtimeBus';
import useFaviconBadge from '../../lib/useFaviconBadge';
import { useAuth } from '../../contexts/AuthContext';
import './notification-bell.css';

const POLL_VISIBLE_MS = 60_000;   // 60s when tab is active
const POLL_HIDDEN_MS  = 600_000;  // 10 min when tab is in background

// Icon catalogue — lucide name → component
const ICON_MAP = {
  bell:            Bell,
  inbox:           Inbox,
  'user-plus':     UserPlus,
  'check-circle':  CheckCircle,
  'user-check':    UserCheck,
  'alert-triangle': AlertTriangle,
  'list-checks':   ListChecks,
  user:            User,
  activity:        Activity,
  'log-in':        LogIn,
};

const fmt = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'ora';
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
};

const groupBy = (items) => {
  const now = new Date();
  const startOfDay = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(now);
  const yesterday = today - 86400 * 1000;
  const weekAgo = today - 6 * 86400 * 1000;
  const b = { today: [], yesterday: [], this_week: [], earlier: [] };
  for (const n of items) {
    const ts = new Date(n.created_at).getTime();
    if (ts >= today) b.today.push(n);
    else if (ts >= yesterday) b.yesterday.push(n);
    else if (ts >= weekAgo) b.this_week.push(n);
    else b.earlier.push(n);
  }
  return b;
};

const LABELS = {
  it: {
    today: 'Oggi',
    yesterday: 'Ieri',
    this_week: 'Questa settimana',
    earlier: 'Prima',
    empty_title: 'Nessuna notifica per ora.',
    empty_sub: 'Tornerà a popolarsi appena succede qualcosa di rilevante.',
    eyebrow: 'Notifiche',
    title: 'Centro Notifiche',
    mark_all: 'Segna tutto come letto',
    archive_read: 'Archivia lette',
    tab_all: 'Tutte',
    tab_unread: 'Non lette',
    tab_archived: 'Archiviate',
    action_archive: 'Archivia',
  },
};

const NotificationBell = ({ locale = 'it' }) => {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [highUnread, setHighUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('all'); // all | unread | archived
  const [categoriesMap, setCategoriesMap] = useState({});
  const pollRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const myId = user?.id || null;
  const L = LABELS[locale] || LABELS.it;

  useFaviconBadge(unread);

  // Load DB-driven catalog once on mount
  useEffect(() => {
    let canceled = false;
    listCategories()
      .then(({ data }) => {
        if (canceled) return;
        const map = {};
        for (const c of (data?.data || [])) map[c.key] = c;
        setCategoriesMap(map);
      })
      .catch(() => {});
    return () => { canceled = true; };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { data: c } = await unreadCount();
      setUnread(c?.count || 0);
      setHighUnread(c?.high_priority_count || 0);
      if (open) {
        const { data } = await listNotifications({
          limit: 60,
          archived: tab === 'archived',
          only_unread: tab === 'unread',
        });
        setItems(data?.data || []);
      }
    } catch { /* silent */ }
  }, [open, tab]);

  // Visibility-aware polling
  useEffect(() => {
    refresh();
    const tick = () => refresh();
    const startInterval = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      const ms = isTabVisible() ? POLL_VISIBLE_MS : POLL_HIDDEN_MS;
      pollRef.current = setInterval(tick, ms);
    };
    startInterval();
    const onVisible = () => {
      if (isTabVisible()) refresh();
      startInterval(); // re-arm with the right cadence
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  // Best-effort realtime push
  useEffect(() => {
    if (!myId) return undefined;
    const mergeInsert = (row) => {
      setItems(prev => prev.some(n => n.id === row.id) ? prev : [row, ...prev].slice(0, 60));
      if (!row.read_at) {
        setUnread(u => u + 1);
        if (row.priority === 'high') setHighUnread(u => u + 1);
      }
    };
    const mergeUpdate = (row) => {
      setItems(prev => prev.map(n => n.id === row.id ? { ...n, ...row } : n));
      refresh();
    };
    const mergeDelete = (row) => {
      setItems(prev => prev.filter(n => n.id !== row.id));
      refresh();
    };
    const unsub = subscribe({
      key: `notif:${myId}`,
      table: 'relationship_notifications',
      event: '*',
      filter: `recipient_user_id=eq.${myId}`,
      onPayload: (p) => {
        queueMicrotask(() => {
          if (p.eventType === 'INSERT' && p.new) mergeInsert(p.new);
          else if (p.eventType === 'UPDATE' && p.new) mergeUpdate(p.new);
          else if (p.eventType === 'DELETE' && p.old) mergeDelete(p.old);
        });
      },
    });
    return unsub;
  }, [myId, refresh]);

  // Reload when drawer opens or tab changes
  useEffect(() => {
    if (open) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

  const onItemClick = async (n) => {
    if (!n.read_at) {
      markRead(n.id).catch(() => {});
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x));
      setUnread(u => Math.max(0, u - 1));
      if (n.priority === 'high') setHighUnread(u => Math.max(0, u - 1));
    }
    const url = n.deep_link_url || n.action_url;
    if (url) {
      setOpen(false);
      try {
        navigate(url);
      } catch {
        window.location.assign(url);
      }
    }
  };

  const onArchive = async (e, n) => {
    e.stopPropagation();
    await archive(n.id).catch(() => {});
    setItems(prev => prev.filter(x => x.id !== n.id));
    if (!n.read_at) {
      setUnread(u => Math.max(0, u - 1));
      if (n.priority === 'high') setHighUnread(u => Math.max(0, u - 1));
    }
  };

  const markAll = async () => {
    await markAllRead().catch(() => {});
    const now = new Date().toISOString();
    setItems(prev => prev.map(n => n.read_at ? n : { ...n, read_at: now }));
    setUnread(0);
    setHighUnread(0);
  };

  const archiveAllRead = async () => {
    await archiveRead().catch(() => {});
    setItems(prev => prev.filter(n => !n.read_at));
  };

  const iconFor = (cat) => {
    const meta = categoriesMap[cat] || {};
    const Comp = ICON_MAP[meta.icon || 'bell'] || Bell;
    return <Comp size={14} strokeWidth={1.6} />;
  };

  const labelFor = (cat) => {
    const meta = categoriesMap[cat];
    if (!meta) return (cat || '').replaceAll('_', ' ');
    return locale === 'en' ? meta.label_en : meta.label_it;
  };

  const buckets = useMemo(() => groupBy(items), [items]);
  const ordered = [
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
        {highUnread > 0 && (
          <span className="nb__highdot" data-testid="notification-bell-highdot" />
        )}
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
              <button
                className="nb-drawer__close"
                onClick={() => setOpen(false)}
                aria-label="close"
                data-testid="notification-drawer-close"
              >
                <X size={16} />
              </button>
            </header>

            <div className="nb-drawer__tabs" role="tablist">
              {[
                ['all', L.tab_all],
                ['unread', L.tab_unread],
                ['archived', L.tab_archived],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  className={`nb-drawer__tab ${tab === key ? 'nb-drawer__tab--active' : ''}`}
                  onClick={() => setTab(key)}
                  data-testid={`notification-tab-${key}`}
                >
                  {label}
                  {key === 'unread' && unread > 0 && (
                    <span style={{ marginLeft: 6, opacity: 0.7 }}>{unread}</span>
                  )}
                </button>
              ))}
            </div>

            {tab !== 'archived' && (unread > 0 || items.some(i => i.read_at)) && (
              <div className="nb-drawer__actions">
                {unread > 0 && (
                  <button
                    className="nb-drawer__action"
                    onClick={markAll}
                    data-testid="nb-mark-all-read"
                  >
                    {L.mark_all}
                  </button>
                )}
                {items.some(i => i.read_at) && (
                  <button
                    className="nb-drawer__action"
                    onClick={archiveAllRead}
                    data-testid="nb-archive-read"
                  >
                    {L.archive_read}
                  </button>
                )}
              </div>
            )}

            {items.length === 0 && (
              <div className="nb-drawer__empty" data-testid="nb-empty">
                <p className="nb-drawer__empty-title">{L.empty_title}</p>
                <p className="nb-drawer__empty-sub">{L.empty_sub}</p>
              </div>
            )}

            {ordered.map(([k, arr]) => arr.length > 0 && (
              <section key={k} className="nb-bucket">
                <p className="nb-bucket__head">{L[k]}</p>
                <ul className="nb-list">
                  {arr.map(n => (
                    <li
                      key={n.id}
                      className={`nb-item ${!n.read_at ? 'nb-item--unread' : ''} nb-item--p-${n.priority || 'normal'}`}
                      onClick={() => onItemClick(n)}
                      data-testid={`nb-item-${n.id}`}
                      data-category={n.category_key || n.notification_type}
                    >
                      <button
                        type="button"
                        className="nb-item__archive"
                        onClick={(e) => onArchive(e, n)}
                        aria-label={L.action_archive}
                        title={L.action_archive}
                        data-testid={`nb-archive-${n.id}`}
                      >
                        <Archive size={13} strokeWidth={1.6} />
                      </button>
                      {n.title && (
                        <p className="nb-item__title">{n.title}</p>
                      )}
                      <p className="nb-item__narrative">
                        {n.narrative || labelFor(n.category_key || n.notification_type)}
                      </p>
                      <p className="nb-item__meta">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {iconFor(n.category_key || n.notification_type)}
                          {labelFor(n.category_key || n.notification_type)}
                        </span>
                        <span>·</span>
                        <span>{fmt(n.created_at)}</span>
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
