/**
 * PendingBookingsPanel — ITER151 Sprint C
 *
 * Designer-side panel showing pending curatorial conversation requests.
 * Each card: client name, conversation kind, proposed slots, note.
 * Actions: confirm one slot · reject.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { pendingBookings, confirmBooking, rejectBooking } from '../../lib/orchestra';
import './pending-bookings-panel.css';

const POLL_MS = 8000;

const KIND_LABEL_IT = {
  discovery: 'Conoscenza iniziale',
  proposal_review: 'Lettura proposta',
  material_walk: 'Camminata materiali',
  site_walk: 'Sopralluogo',
  follow_up: 'Continua il dialogo',
};

const fmtSlot = (s) => {
  const start = s?.start || s?.when;
  if (!start) return '—';
  try {
    return new Date(start).toLocaleString('it-IT', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return start; }
};

const PendingBookingsPanel = ({ locale = 'it' }) => {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState({});  // id → 'confirm' | 'reject'

  const refresh = useCallback(async () => {
    try {
      const { data } = await pendingBookings();
      setItems(data?.data || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const onConfirm = async (b, slot) => {
    setBusy(prev => ({ ...prev, [b.id]: 'confirm' }));
    try {
      await confirmBooking(b.id, { slot, locale });
      toast.success(locale === 'it' ? 'Incontro confermato.' : 'Meeting confirmed.');
      setItems(prev => prev.filter(x => x.id !== b.id));
    } catch {
      toast.error(locale === 'it' ? 'Conferma non riuscita.' : 'Confirm failed.');
    } finally {
      setBusy(prev => ({ ...prev, [b.id]: null }));
    }
  };

  const onReject = async (b) => {
    setBusy(prev => ({ ...prev, [b.id]: 'reject' }));
    try {
      await rejectBooking(b.id, '');
      toast.success(locale === 'it' ? 'Richiesta declinata.' : 'Request declined.');
      setItems(prev => prev.filter(x => x.id !== b.id));
    } catch {
      toast.error(locale === 'it' ? 'Operazione non riuscita.' : 'Failed.');
    } finally {
      setBusy(prev => ({ ...prev, [b.id]: null }));
    }
  };

  if (items.length === 0) return null;

  return (
    <section className="pbp" data-testid="pending-bookings-panel">
      <header className="pbp__head">
        <p className="pbp__eyebrow">{locale === 'it' ? 'Richieste in attesa' : 'Pending requests'}</p>
        <h3 className="pbp__title">
          {items.length === 1
            ? (locale === 'it' ? 'Un cliente vuole parlarti' : 'A client wants to talk to you')
            : (locale === 'it' ? `${items.length} clienti propongono un incontro`
                               : `${items.length} clients propose a conversation`)}
        </h3>
      </header>

      <ul className="pbp__list">
        {items.map(b => {
          const slots = b.preferred_slots || [];
          const note = b.client_note;
          const kindLbl = KIND_LABEL_IT[b.conversation_kind] || b.conversation_kind;
          return (
            <li key={b.id} className="pbp-card" data-testid={`pbp-card-${b.id}`}>
              <header className="pbp-card__head">
                <p className="pbp-card__kind">{kindLbl}</p>
                {b.client_timezone && (
                  <p className="pbp-card__tz">· {b.client_timezone}</p>
                )}
              </header>
              {note && (
                <p className="pbp-card__note">"{note}"</p>
              )}
              <ul className="pbp-card__slots">
                {slots.length === 0
                  ? <li className="pbp-card__noslots">
                      {locale === 'it' ? 'Nessuno slot specifico proposto.' : 'No specific slot proposed.'}
                    </li>
                  : slots.map((s, i) => (
                    <li key={i} className="pbp-card__slot">
                      <span className="pbp-card__when">{fmtSlot(s)}</span>
                      <button
                        type="button"
                        className="pbp-card__accept"
                        onClick={() => onConfirm(b, s)}
                        disabled={!!busy[b.id]}
                        data-testid={`pbp-confirm-${b.id}-${i}`}
                      >
                        {busy[b.id] === 'confirm'
                          ? <Loader2 size={13} className="pbp-spin" />
                          : <CheckCircle2 size={13} />}
                        {locale === 'it' ? 'Conferma questo' : 'Confirm this'}
                      </button>
                    </li>
                  ))}
              </ul>
              <footer className="pbp-card__foot">
                <button
                  type="button"
                  className="pbp-card__reject"
                  onClick={() => onReject(b)}
                  disabled={!!busy[b.id]}
                  data-testid={`pbp-reject-${b.id}`}
                >
                  {busy[b.id] === 'reject'
                    ? <Loader2 size={12} className="pbp-spin" />
                    : <XCircle size={12} />}
                  {locale === 'it' ? 'Non ora' : 'Not now'}
                </button>
              </footer>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default PendingBookingsPanel;
