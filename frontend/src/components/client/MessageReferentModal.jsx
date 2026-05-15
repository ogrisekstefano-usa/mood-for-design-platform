/**
 * MessageReferentModal — Phase S.2.
 *
 * Quick "Scrivi al tuo referente" modal triggered from the
 * ClientHumanCard (Client Portal). Minimal, calm, hospitality
 * tone — never reads as "support ticket".
 *
 * Submits to POST /api/client-messages/send and, on success,
 * confirms with the assignee's name in the toast.
 */
import React, { useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';

const MessageReferentModal = ({ open, onClose, assignee, projectId, onSent }) => {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const firstName = assignee?.first_name || assignee?.name?.split(' ')[0] || 'il tuo referente';

  const send = async () => {
    const text = body.trim();
    if (text.length < 4) {
      toast.error('Scrivi qualche parola in più.');
      return;
    }
    setSending(true);
    try {
      await api.post('/api/client-messages/send', {
        message_body: text,
        project_id: projectId || undefined,
      });
      toast.success(`Messaggio inviato. ${firstName} ti risponderà appena possibile.`);
      setBody('');
      onSent?.();
      onClose?.();
    } catch (e) {
      toast.error('Invio non riuscito.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      data-testid="message-referent-modal"
      className="fixed inset-0 z-[80] flex items-center justify-center"
      data-surface="client"
      role="dialog"
      aria-modal="true"
    >
      <button type="button" onClick={onClose}
              className="absolute inset-0 bg-black/72 backdrop-blur-sm" aria-label="Close" />

      <form
        noValidate
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="relative w-[580px] max-w-[92vw]
                   bg-[var(--cp-surface-1)] border border-[var(--cp-border)]
                   rounded-[var(--cp-radius-lg)] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-5 border-b border-[var(--cp-border)]/60 flex items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-[var(--cp-surface-2)] border border-[var(--cp-border)] flex items-center justify-center">
              {assignee?.avatar_url ? (
                <img src={assignee.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-heading text-[18px] text-[var(--cp-gold-soft)]">
                  {(firstName[0] || '·').toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.26em] text-[var(--cp-gold)] mb-1">
                Scrivi al tuo referente
              </p>
              <h2 className="font-heading text-[22px] leading-[1.15] text-[var(--cp-text-primary)] tracking-[-0.005em]">
                {firstName}
              </h2>
              {assignee?.role_label && (
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--cp-text-muted)] mt-0.5">
                  {assignee.role_label}
                </p>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose}
                  data-testid="message-referent-close"
                  className="text-[var(--cp-text-muted)] hover:text-[var(--cp-text-primary)] transition-colors p-1">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="px-8 py-7">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--cp-text-muted)] mb-3">
            Il tuo messaggio
          </p>
          <textarea
            data-testid="message-referent-body"
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 4000))}
            rows={6}
            autoFocus
            placeholder={`Scrivi a ${firstName}… racconta una richiesta, condividi un dubbio, fissa un appuntamento.`}
            className="w-full bg-[var(--cp-surface-2)] border border-[var(--cp-border)]
                       rounded-[var(--cp-radius-sm)] px-4 py-3 text-[14px] text-[var(--cp-text-primary)]
                       font-body leading-relaxed focus:outline-none focus:border-[var(--cp-border-active)]
                       transition-colors resize-none placeholder:text-[var(--cp-text-faint)]"
          />
          <p className="text-[10px] mt-2 text-[var(--cp-text-faint)] font-mono tracking-[0.06em] text-right">
            {body.length}/4000
          </p>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-[var(--cp-border)]/60 bg-[var(--cp-surface-2)]/40 flex items-center justify-between gap-4">
          <p className="text-[10.5px] text-[var(--cp-text-faint)] italic font-body leading-relaxed max-w-[36ch]">
            {assignee?.response_time_label || 'Risponde in giornata'} — i messaggi restano nel tuo spazio progetto.
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose}
                    className="px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--cp-text-muted)] hover:text-[var(--cp-text-primary)] transition-colors">
              Annulla
            </button>
            <button
              type="submit"
              data-testid="message-referent-send"
              disabled={sending || body.trim().length < 4}
              className="cp-cta-gold inline-flex items-center gap-2 px-5 py-2.5 text-[11px] uppercase tracking-[0.18em] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 className="animate-spin" size={12} /> : <Send size={12} strokeWidth={1.8} />}
              Invia messaggio
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default MessageReferentModal;
