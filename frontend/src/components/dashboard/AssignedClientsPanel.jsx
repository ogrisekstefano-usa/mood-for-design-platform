/**
 * AssignedClientsPanel — Phase S.2.
 *
 * Renders on the Blueprint OS dashboard. Lists clients assigned to
 * the current studio member (or all tenant clients if admin) with
 * their first-contact status and the option to generate an
 * AI-suggested opening message + send it.
 *
 * Direction:
 *   - cinematic operational, NOT inbox-like
 *   - one row per client
 *   - "Suggerisci messaggio" → calls /suggest-opening, surfaces an
 *     inline editable suggestion that can be sent or discarded
 *   - "Apri thread" — placeholder for future studio thread view
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Sparkles, Send, Loader2, RotateCcw, Clock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';

const AssignedClientsPanel = () => {
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/api/client-messages/assignee/queue');
      setQueue(data?.queue || []);
    } catch (_) {
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !queue) return null;
  if (queue.length === 0) return null;

  return (
    <section data-testid="assigned-clients-panel" className="bp-card rounded-[18px] p-7 lg:p-8 mb-8">
      <header className="flex items-end justify-between mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--bp-primary)] mb-3 font-body">
            Human follow-ups
          </p>
          <h2 className="font-heading text-[22px] leading-[1.15] text-[var(--bp-text-primary)] tracking-[-0.005em]">
            I clienti a te assegnati.
          </h2>
        </div>
        <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--bp-text-muted)]">
          {queue.length} attiv{queue.length === 1 ? 'o' : 'i'}
        </span>
      </header>

      <ul className="divide-y divide-[var(--bp-border)]/50">
        {queue.map((row) => (
          <AssignedRow key={row.assignment_id} row={row} onReload={load} />
        ))}
      </ul>
    </section>
  );
};

const STATUS_LABEL = {
  pending:   { label: 'Da contattare',          tone: 'text-[var(--bp-text-muted)]' },
  suggested: { label: 'Suggestion pronta',      tone: 'text-[var(--bp-primary)]' },
  sent:      { label: 'Primo contatto inviato', tone: 'text-[var(--bp-success,#22C55E)]' },
  overdue:   { label: 'In ritardo',             tone: 'text-[var(--bp-warning,#D2A359)]' },
};

const AssignedRow = ({ row, onReload }) => {
  const [suggestion, setSuggestion] = useState(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const status = row.first_contact_status || 'pending';
  const cInfo = STATUS_LABEL[status] || STATUS_LABEL.pending;
  const first = row.client?.name?.split(' ')[0] || 'Cliente';

  const suggest = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/api/client-messages/${row.client.id}/suggest-opening`, { persist: true });
      const txt = data?.suggestion || '';
      setSuggestion(txt);
      setDraft(txt);
      onReload?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Suggerimento non disponibile.');
    } finally {
      setBusy(false);
    }
  };

  const sendNow = async () => {
    if (draft.trim().length < 4) return;
    setBusy(true);
    try {
      await api.post('/api/client-messages/send', {
        client_id: row.client.id,
        message_body: draft.trim(),
        visibility: 'client_visible',
      });
      toast.success(`Messaggio inviato a ${first}.`);
      setSuggestion(null);
      setDraft('');
      onReload?.();
    } catch (e) {
      toast.error('Invio non riuscito.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li data-testid={`assigned-row-${row.client.id}`} className="py-5 flex items-start gap-5">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--bp-surface-2)] border border-[var(--bp-border)] flex items-center justify-center shrink-0">
        {row.client.avatar_url ? (
          <img src={row.client.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[12px] tracking-[0.06em] text-[var(--bp-text-secondary)] font-body uppercase">
            {(first[0] || '·')}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-[14px] text-[var(--bp-text-primary)] font-body leading-tight">{row.client.name || first}</p>
          <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] font-body ${cInfo.tone}`}>
            {status === 'sent' && <CheckCircle2 size={10} strokeWidth={1.6} />}
            {status === 'overdue' && <Clock size={10} strokeWidth={1.6} />}
            {cInfo.label}
          </span>
        </div>
        {row.latest_message && (
          <p className="text-[11px] text-[var(--bp-text-muted)] mt-1 font-body italic line-clamp-2 leading-[1.55] max-w-[60ch]">
            {row.latest_message.message_body}
          </p>
        )}

        {/* Inline suggestion area */}
        {suggestion !== null && (
          <div data-testid={`suggestion-area-${row.client.id}`} className="mt-3 border border-[var(--bp-border-active)] rounded-[10px] overflow-hidden">
            <div className="px-3 py-2 border-b border-[var(--bp-border)]/60 bg-[var(--bp-surface-elevated)] flex items-center gap-2">
              <Sparkles size={11} strokeWidth={1.5} className="text-[var(--bp-primary)]" />
              <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-secondary)]">
                Bozza assistant · puoi modificarla
              </span>
            </div>
            <textarea
              data-testid={`suggestion-draft-${row.client.id}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 4000))}
              rows={4}
              className="w-full bg-[var(--bp-surface-2)] px-3 py-2 text-[12.5px] text-[var(--bp-text-primary)]
                         font-body leading-relaxed focus:outline-none resize-none"
            />
            <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-[var(--bp-border)]/60 bg-[var(--bp-surface-1)]">
              <button type="button" onClick={() => { setSuggestion(null); setDraft(''); }}
                      className="px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors">
                Scarta
              </button>
              <button type="button" onClick={suggest} disabled={busy}
                      data-testid={`suggestion-regen-${row.client.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors disabled:opacity-40">
                <RotateCcw size={11} strokeWidth={1.5} />
                Rigenera
              </button>
              <button type="button" onClick={sendNow} disabled={busy || draft.trim().length < 4}
                      data-testid={`suggestion-send-${row.client.id}`}
                      className="inline-flex items-center gap-1 px-4 py-1.5 rounded-[6px]
                                 bg-[var(--bp-primary)] text-black text-[10px] uppercase tracking-[0.18em] font-medium
                                 hover:opacity-90 disabled:opacity-40 transition-opacity">
                {busy ? <Loader2 className="animate-spin" size={11} /> : <Send size={11} strokeWidth={1.8} />}
                Invia primo messaggio
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {suggestion === null && (
        <div className="flex flex-col items-end gap-2 shrink-0">
          {(status === 'pending' || status === 'overdue') && (
            <button
              type="button"
              onClick={suggest}
              disabled={busy}
              data-testid={`assigned-suggest-${row.client.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px]
                         border border-[var(--bp-border-strong)] hover:border-[var(--bp-border-hover)]
                         text-[10px] uppercase tracking-[0.18em] text-[var(--bp-text-secondary)]
                         hover:text-[var(--bp-text-primary)] transition-colors disabled:opacity-40"
            >
              {busy ? <Loader2 className="animate-spin" size={11} /> : <Sparkles size={11} strokeWidth={1.5} />}
              Suggerisci primo messaggio
            </button>
          )}
        </div>
      )}
    </li>
  );
};

export default AssignedClientsPanel;
