/**
 * ClientMessagesPage — Phase S.2.
 *
 * The "communicazioni con il tuo referente" surface. Visual
 * direction: NOT a chat app. Premium calm thread.
 *
 * Layout:
 *   Header — assignee identity + response time + status
 *   Thread — alternating messages, plain typography
 *   Composer — sticky bottom, minimal
 *   Empty state — atelier hint
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';

const ClientMessagesPage = () => {
  const { locale: uiLocale, t } = useBlueprint();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const threadRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get('/api/client-messages/thread');
      setData(d);
    } catch (_) {
      setData({ messages: [], assignee: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [data?.messages?.length]);

  const send = async () => {
    const text = draft.trim();
    if (text.length < 4) return;
    setSending(true);
    try {
      await api.post('/api/client-messages/send', {
        message_body: text,
        source_locale: uiLocale,  // iter124: real authoring locale
      });
      // ITER150 · Sprint A · fire relationship event (non-blocking)
      api.post('/api/relationship-engine/actions/message-sent', {
        content: text, locale: uiLocale || 'it',
      }).catch(() => {});
      setDraft('');
      await load();
    } catch (_) {
      toast.error('Invio non riuscito.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div data-testid="client-messages-page" className="max-w-[920px] mt-2">
        <div className="cp-card p-10 flex items-center gap-3 text-[var(--cp-text-muted)]">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-[11px] uppercase tracking-[0.2em]">{t('client.client_messages.caricamento_conversazione')}</span>
        </div>
      </div>
    );
  }

  const a = data?.assignee;
  const msgs = data?.messages || [];
  const firstName = a?.first_name || a?.name?.split(' ')[0] || 'Referente';

  return (
    <div data-testid="client-messages-page" className="max-w-[920px] mt-2">
      {/* Header */}
      <header className="cp-card p-7 mb-5 flex items-center gap-5">
        {a ? (
          <>
            <div className="w-14 h-14 rounded-full overflow-hidden bg-[var(--cp-surface-2)] border border-[var(--cp-border)] flex items-center justify-center shrink-0">
              {a.avatar_url ? (
                <img src={a.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-heading text-[18px] text-[var(--cp-gold-soft)]">
                  {(firstName[0] || '·').toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.26em] text-[var(--cp-gold)] mb-1">
                Conversazione con il tuo referente
              </p>
              <h1 className="font-heading text-[24px] leading-[1.1] text-[var(--cp-text-primary)] tracking-[-0.005em]">
                {firstName}
              </h1>
              {a.role_label && (
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--cp-text-muted)] mt-1">
                  {a.role_label}
                </p>
              )}
            </div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--cp-text-muted)] hidden md:block max-w-[24ch] text-right leading-relaxed">
              {a.response_time_label || 'Risponde in giornata'}
            </p>
          </>
        ) : (
          <p className="text-[12.5px] italic text-[var(--cp-text-muted)] font-body">
            Stai per essere abbinato al referente più adatto al tuo progetto.
          </p>
        )}
      </header>

      {/* Thread */}
      <section
        ref={threadRef}
        data-testid="client-messages-thread"
        className="cp-card p-7 mb-5 min-h-[320px] max-h-[60vh] overflow-auto"
      >
        {msgs.length === 0 ? (
          <div className="flex items-start gap-4 py-6">
            <span aria-hidden
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--cp-gold-bg)] border border-[var(--cp-border)] text-[var(--cp-gold-soft)] shrink-0">
              <Sparkles size={16} strokeWidth={1.5} />
            </span>
            <div>
              <h2 className="font-heading text-[20px] leading-[1.2] text-[var(--cp-text-primary)] mb-2">
                Qui troverai le comunicazioni principali con il tuo referente.
              </h2>
              <p className="text-[13px] text-[var(--cp-text-secondary)] font-body leading-relaxed max-w-[48ch]">
                Scrivi a {firstName} qui sotto — domande, dubbi, idee. Le risposte resteranno nel tuo spazio progetto.
              </p>
            </div>
          </div>
        ) : (
          <ol className="space-y-6">
            {msgs.map((m) => (
              <MessageRow key={m.id} message={m} assignee={a} />
            ))}
          </ol>
        )}
      </section>

      {/* Composer */}
      <form
        noValidate
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="cp-card p-5"
      >
        <textarea
          data-testid="client-messages-composer"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 4000))}
          rows={3}
          placeholder={`Scrivi a ${firstName}…`}
          className="w-full bg-transparent border-0 outline-none resize-none
                     text-[14px] text-[var(--cp-text-primary)] font-body leading-relaxed
                     placeholder:text-[var(--cp-text-faint)]"
        />
        <div className="flex items-center justify-between pt-2 border-t border-[var(--cp-border)]/40 mt-2">
          <p className="text-[10px] text-[var(--cp-text-faint)] font-mono tracking-[0.06em]">
            {draft.length}/4000
          </p>
          <button
            type="submit"
            data-testid="client-messages-send"
            disabled={sending || draft.trim().length < 4}
            className="cp-cta-gold inline-flex items-center gap-2 px-5 py-2 text-[11px] uppercase tracking-[0.18em] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 className="animate-spin" size={12} /> : <Send size={12} strokeWidth={1.8} />}
            Invia
          </button>
        </div>
      </form>
    </div>
  );
};

import LocalizedMessage from '../../components/ale/LocalizedMessage';

const MessageRow = ({ message, assignee }) => {
  const isClient = message.message_type === 'client_message';
  const firstName = assignee?.first_name || 'Referente';
  // iter124: rely on server-stored `source_locale`. Fallback chain kept
  // for legacy rows authored before column existed.
  const sourceLocale = message.source_locale || (isClient ? null : 'it');
  return (
    <li data-testid={`client-message-${message.id}`} className="flex flex-col gap-1.5">
      <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--cp-text-muted)]">
        {isClient ? 'Tu' : firstName}
        <span className="ml-3 text-[var(--cp-text-faint)] tracking-[0.06em] font-mono normal-case">
          {formatTime(message.created_at)}
        </span>
      </p>
      <div className={`text-[14px] leading-[1.7] font-body whitespace-pre-wrap
                     ${isClient
                       ? 'text-[var(--cp-text-primary)]'
                       : 'text-[var(--cp-text-primary)] pl-3 border-l-2 border-[var(--cp-gold)]/60'}`}>
        {sourceLocale ? (
          <LocalizedMessage
            text={message.message_body}
            sourceLocale={sourceLocale}
            messageId={message.id}
            surface="client_message"
            mode="localized_only"
            testid={`client-message-${message.id}-body`}
          />
        ) : (
          <span data-testid={`client-message-${message.id}-body`}>{message.message_body}</span>
        )}
      </div>
    </li>
  );
};

const formatTime = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

export default ClientMessagesPage;
