/**
 * DesignerConversationsPage — ITER151 Sprint B
 *
 * Designer-side workspace for all active relationship conversations.
 *
 * Layout:
 *   LEFT  — list of threads (counterpart name, unread, preview, last_at)
 *   RIGHT — selected conversation (ConversationSurface variant="designer")
 *
 * Polls /api/conversation/threads every 5s.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { listThreads } from '../../lib/conversation';
import ConversationSurface from '../../components/conversation/ConversationSurface';
import './designer-conversations.css';

const POLL_MS = 5000;

const formatWhen = (iso, locale = 'it') => {
  if (!iso) return locale === 'it' ? 'nessun messaggio' : 'no messages';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return locale === 'it' ? 'ora' : 'now';
  if (diff < 3600) return `${Math.floor(diff/60)}m`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

const DesignerConversationsPage = () => {
  const [threads, setThreads] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const locale = 'it';

  const refresh = useCallback(async () => {
    try {
      const { data } = await listThreads();
      const list = data?.data || [];
      setThreads(list);
      setSelected(prev => prev || (list[0]?.id ?? null));
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="dcp-shell" data-testid="designer-conversations-page">
      <aside className="dcp-list" data-testid="dcp-thread-list">
        <header className="dcp-list__head">
          <p className="dcp-list__eyebrow">Conversazioni</p>
          <h2 className="dcp-list__title">Relazioni vive</h2>
          <p className="dcp-list__count">
            {threads.length} {threads.length === 1 ? 'cliente' : 'clienti'} in dialogo
          </p>
        </header>

        {loading && (
          <p className="dcp-list__hint">Apertura…</p>
        )}

        {!loading && threads.length === 0 && (
          <p className="dcp-list__empty">
            Nessuna conversazione ancora.
            <br />Quando un cliente scriverà, apparirà qui.
          </p>
        )}

        <ul className="dcp-list__items">
          {threads.map((t) => {
            const isCurrent = t.id === selected;
            const cp = t.counterpart || {};
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className={`dcp-item ${isCurrent ? 'dcp-item--current' : ''} ${t.unread > 0 ? 'dcp-item--unread' : ''}`}
                  onClick={() => setSelected(t.id)}
                  data-testid={`dcp-item-${t.id}`}
                >
                  <span className="dcp-item__avatar" aria-hidden>
                    {cp.avatar_url
                      ? <img src={cp.avatar_url} alt="" />
                      : <span>{(cp.name || '?').slice(0, 1)}</span>}
                  </span>
                  <span className="dcp-item__body">
                    <span className="dcp-item__name">{cp.name || 'Cliente'}</span>
                    <span className="dcp-item__preview">
                      {t.last_message_preview || 'Nuova relazione.'}
                    </span>
                  </span>
                  <span className="dcp-item__meta">
                    <span className="dcp-item__when">{formatWhen(t.last_message_at, locale)}</span>
                    {t.unread > 0 && (
                      <span className="dcp-item__badge" data-testid="dcp-unread-badge">{t.unread}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <main className="dcp-main">
        {selected ? (
          <ConversationSurface
            key={selected}  /* remount when switching threads */
            variant="designer"
            threadId={selected}
            locale={locale}
          />
        ) : (
          <div className="dcp-placeholder">
            <p>Seleziona una conversazione per iniziare.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default DesignerConversationsPage;
