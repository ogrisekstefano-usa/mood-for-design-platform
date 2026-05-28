/**
 * AtelierNotifications · ITER162 rev2
 *
 * Bell con dropdown notifiche. Per ora dummy + count; quando
 * matureranno gli endpoint reali, basterà collegare /api/client/notifications.
 *
 * Lessico relazionale: "Nuova direzione dallo studio", "Stefano ti
 * ha scritto", NON "system alert / task update".
 */
import React, { useEffect, useRef, useState } from 'react';
import { Bell, MessageSquare, Sparkles, Calendar } from 'lucide-react';

// Dummy — sostituire con fetch da /api/client/notifications quando esisterà.
const _seedNotifications = (studioName = 'Lo Studio') => ([
  {
    id: 'n1',
    type: 'message',
    title: 'Stefano ti ha scritto',
    body: 'Buongiorno, ho riletto con calma le tue indicazioni. Vorrei…',
    when: 'poco fa',
    unread: true,
    icon: 'message',
  },
  {
    id: 'n2',
    type: 'direction',
    title: 'Lo studio sta preparando una direzione',
    body: 'Una prima ispirazione visiva sarà condivisa nei prossimi giorni.',
    when: 'questa mattina',
    unread: true,
    icon: 'sparkles',
  },
  {
    id: 'n3',
    type: 'recall',
    title: 'Proposta di confronto',
    body: `${studioName} suggerisce una breve call in settimana.`,
    when: 'ieri',
    unread: false,
    icon: 'calendar',
  },
]);

const ICONS = {
  message:  MessageSquare,
  sparkles: Sparkles,
  calendar: Calendar,
};

const AtelierNotifications = ({ studioName }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(() => _seedNotifications(studioName));
  const wrapRef = useRef(null);

  const unread = items.filter((n) => n.unread).length;

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

  const markAllRead = () => setItems((arr) => arr.map((n) => ({ ...n, unread: false })));

  return (
    <div className="atelier-notif-wrap" ref={wrapRef} data-testid="atelier-notifications">
      <button
        type="button"
        className="atelier-notif-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `${unread} notifiche da leggere` : 'Notifiche'}
        aria-expanded={open}
        data-testid="atelier-notifications-trigger"
      >
        <Bell size={16} strokeWidth={1.4} />
        {unread > 0 && (
          <span aria-hidden className="atelier-notif-btn__dot" data-testid="atelier-notifications-dot">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="atelier-notif-panel" role="dialog" data-testid="atelier-notifications-panel">
          <header className="atelier-notif-panel__head">
            <p className="atelier-notif-panel__title">Notifiche</p>
            {unread > 0 && (
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
                const Icon = ICONS[n.icon] || Bell;
                return (
                  <li
                    key={n.id}
                    className={`atelier-notif ${n.unread ? 'is-unread' : ''}`}
                    data-testid={`atelier-notification-${n.id}`}
                  >
                    <span className="atelier-notif__icon" aria-hidden>
                      <Icon size={14} strokeWidth={1.6} />
                    </span>
                    <div className="atelier-notif__body">
                      <p className="atelier-notif__title">{n.title}</p>
                      <p className="atelier-notif__text">{n.body}</p>
                      <p className="atelier-notif__when">{n.when}</p>
                    </div>
                    {n.unread && <span className="atelier-notif__dot" aria-hidden />}
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
