/**
 * AtelierNotifications · ITER162 rev3 — Connected to real API
 *
 * Bell con dropdown notifiche. Si connette a /api/notifications/unread-count
 * per il badge e /api/notifications?only_unread=true per la lista.
 *
 * Lessico relazionale: "Nuova direzione dallo studio", "Il tuo referente ti ha scritto"
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, MessageSquare, Sparkles, Calendar, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../../lib/api';

const ICONS = {
  message:  MessageSquare,
  direction: Sparkles,
  sparkles: Sparkles,
  calendar: Calendar,
};

const _toIcon = (n) => {
  const cat = (n.category_key || '').toLowerCase();
  if (cat.includes('message') || cat.includes('replied')) return 'message';
  if (cat.includes('direction') || cat.includes('concept')) return 'direction';
  if (cat.includes('recall') || cat.includes('call')) return 'calendar';
  return 'message';
};

const _relTime = (iso) => {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'poco fa';
  if (diff < 3600) return `${Math.floor(diff / 60)} min fa`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ore fa`;
  return `${Math.floor(diff / 86400)} giorni fa`;
};

const AtelierNotifications = ({ studioName }) => {
  const [open, setOpen]   = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();

  // Poll unread count every 30 s
  const fetchCount = useCallback(async () => {
    try {
      const r = await api.get('/api/notifications/unread-count');
      setCount(r.data?.count ?? 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchCount();
    const iv = setInterval(fetchCount, 30_000);
    return () => clearInterval(iv);
  }, [fetchCount]);

  // Load notifications when dropdown opens
  useEffect(() => {
    if (!open || loaded) return;
    api.get('/api/notifications?only_unread=false&limit=8')
      .then((r) => {
        const data = r.data?.data || [];
        setItems(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [open, loaded]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const markAllRead = async () => {
    setItems((arr) => arr.map((n) => ({ ...n, _read: true })));
    setCount(0);
    // Fire-and-forget archive all
    try {
      const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id);
      await Promise.all(unreadIds.map((id) => api.post(`/api/notifications/${id}/read`)));
    } catch { /* silent */ }
  };

  const handleItem = (n) => {
    setOpen(false);
    if (n.deep_link_url) navigate(n.deep_link_url);
    else if ((n.category_key || '').includes('replied')) navigate('/client/messages');
  };

  return (
    <div className="atelier-notif-wrap" ref={wrapRef} data-testid="atelier-notifications">
      <button
        type="button"
        className="atelier-notif-btn"
        onClick={() => { setOpen((o) => !o); setLoaded(false); }}
        aria-label={count > 0 ? `${count} notifiche da leggere` : 'Notifiche'}
        aria-expanded={open}
        data-testid="atelier-notifications-trigger"
      >
        <Bell size={16} strokeWidth={1.4} />
        {count > 0 && (
          <span aria-hidden className="atelier-notif-btn__dot" data-testid="atelier-notifications-dot">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="atelier-notif-panel" role="dialog" data-testid="atelier-notifications-panel">
          <header className="atelier-notif-panel__head">
            <p className="atelier-notif-panel__title">Notifiche</p>
            {count > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="atelier-notif-panel__mark"
                data-testid="atelier-notifications-mark-all"
              >
                Segna tutte come lette
              </button>
            )}
          </header>

          {items.length === 0 ? (
            <p className="atelier-notif-panel__empty" data-testid="atelier-notifications-empty">
              Nessuna nuova conversazione, per ora.
            </p>
          ) : (
            <ul className="atelier-notif-list" role="list">
              {items.map((n) => {
                const iconKey = _toIcon(n);
                const Icon = ICONS[iconKey] || Bell;
                const isUnread = !n.read_at && !n._read;
                return (
                  <li
                    key={n.id}
                    className={`atelier-notif ${isUnread ? 'is-unread' : ''}`}
                    data-testid={`atelier-notification-${n.id}`}
                    onClick={() => handleItem(n)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleItem(n); }}
                    style={{ cursor: n.deep_link_url ? 'pointer' : 'default' }}
                  >
                    <span className="atelier-notif__icon" aria-hidden>
                      <Icon size={14} strokeWidth={1.6} />
                    </span>
                    <div className="atelier-notif__body">
                      <p className="atelier-notif__title">
                        {n.narrative || n.title || 'Nuova notifica'}
                      </p>
                      <p className="atelier-notif__when">{_relTime(n.created_at)}</p>
                    </div>
                    {isUnread && <span className="atelier-notif__dot" aria-hidden />}
                    {n.deep_link_url && (
                      <ArrowRight size={12} strokeWidth={1.4} className="atelier-notif__arrow" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <footer className="atelier-notif-panel__foot">
            <a
              href="/client/messages"
              className="atelier-notif-panel__all"
              data-testid="atelier-notifications-all"
            >
              Vai alle conversazioni
            </a>
          </footer>
        </div>
      )}
    </div>
  );
};

export default AtelierNotifications;
