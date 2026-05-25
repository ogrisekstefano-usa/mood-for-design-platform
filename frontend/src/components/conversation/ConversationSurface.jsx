/**
 * Conversation Surface · ITER151 Sprint B + Sprint F · F2 Realtime
 *
 * Shared editorial conversation between client and designer. Same
 * component used in:
 *   - Client portal (`role=client` → counterpart = assigned designer)
 *   - Designer workspace (`role=designer/admin` → counterpart = client)
 *
 * Realtime push via Supabase channel · `relationship_messages`
 * filter `thread_id=eq.<thread>`. Polling 15s as silent safety net.
 * Smart auto-scroll: only follows if the reader is already near
 * the bottom (≤ 96px). If they are reading old messages, the new
 * one appears with a soft "↓ una nuova nota" hint instead of
 * yanking the viewport.
 *
 * Editorial rules:
 *   - Serif on designer voice. NO consumer chat bubbles.
 *   - NO typing indicator (will be added rarefatto in a later pass).
 *   - Fresh realtime messages enter with `conv-msg--fresh` fade-in
 *     (220ms, slow ease) — pensiero curatoriale, no popping.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Send, Loader2, ArrowDown } from 'lucide-react';
import {
  ensureThread, getThread, listMessages, sendMessage, markAllRead, myStatus,
} from '../../lib/conversation';
import { getDesignerPresence } from '../../lib/orchestra';
import { subscribe } from '../../lib/realtimeBus';
import './conversation-surface.css';

const POLL_MS = 15000; // safety net — realtime is the primary channel
const AUTO_SCROLL_THRESHOLD = 96; // px from bottom = "still reading at the foot"

const formatWhen = (iso, locale = 'it') => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return locale === 'it' ? 'ora' : 'now';
  if (diff < 3600) return `${Math.floor(diff/60)} min`;
  if (diff < 86400) return `${Math.floor(diff/3600)} h`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const presenceLabel = (role, locale = 'it') => {
  if (role === 'client') return locale === 'it' ? 'Cliente' : 'Client';
  return locale === 'it' ? 'In studio' : 'In studio';
};

const ConversationSurface = ({
  variant = 'client',  // 'client' | 'designer'
  threadId: threadIdProp = null,
  /* designer-side: pass client_profile_id to open/create that thread */
  clientProfileId = null,
  leadId = null,
  locale = 'it',
  fillHeight = true,
}) => {
  const isClient = variant === 'client';
  const [thread, setThread] = useState(null);
  const [counterpart, setCounterpart] = useState(null);
  const [presence, setPresence] = useState(null);  // ITER151 Sprint C
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const lastSeenRef = useRef(null);
  const pollRef = useRef(null);
  const scrollRef = useRef(null);
  const freshIdsRef = useRef(new Set()); // ids that should animate as "fresh"
  const [pendingScroll, setPendingScroll] = useState(0); // unseen messages while scrolled up

  /* ── INITIAL LOAD ─────────────────────────────────────────── */
  const initialise = useCallback(async () => {
    setLoading(true);
    try {
      let tid = threadIdProp;
      if (!tid) {
        const body = isClient ? {} : { client_profile_id: clientProfileId, lead_id: leadId };
        const { data } = await ensureThread(body);
        tid = data?.thread?.id;
      }
      if (!tid) throw new Error('no thread');
      const { data: full } = await getThread(tid);
      setThread(full.thread);
      setCounterpart(full.counterpart || null);
      setMessages(full.messages || []);
      if (full.messages?.length) {
        lastSeenRef.current = full.messages[full.messages.length - 1].created_at;
      }
      // ITER151 Sprint C — fetch real presence for the designer counterpart
      if (isClient && full.thread?.primary_designer_id) {
        getDesignerPresence(full.thread.primary_designer_id)
          .then(({ data }) => setPresence(data))
          .catch(() => {});
      } else if (!isClient && full.thread?.client_profile_id) {
        // designer doesn't need a presence pill — clear
        setPresence(null);
      }
      if (isClient) {
        try {
          const { data: st } = await myStatus();
          setStatus(st);
        } catch { /* ignore */ }
      }
      // Auto mark-as-read on open
      markAllRead(tid).catch(() => {});
    } catch (e) {
      setError(e?.response?.status === 401 ? 'auth' : 'net');
    } finally {
      setLoading(false);
    }
  }, [threadIdProp, isClient, clientProfileId, leadId]);

  useEffect(() => { initialise(); }, [initialise]);

  /* ── REALTIME (primary) ──────────────────────────────────── */
  useEffect(() => {
    const tid = thread?.id;
    if (!tid) return undefined;

    const ingestIncoming = (row, source /* 'realtime' | 'poll' */) => {
      setMessages(prev => {
        if (prev.some(m => m.id === row.id)) return prev;       // dedup
        // Reconcile against optimistic stub (same sender + content within 30s)
        const optimisticIdx = prev.findIndex(
          m => m._optimistic
            && m.sender_type === row.sender_type
            && m.content === row.content
            && Math.abs(new Date(m.created_at).getTime() - new Date(row.created_at).getTime()) < 30000,
        );
        if (optimisticIdx !== -1) {
          const next = prev.slice();
          next[optimisticIdx] = { ...row, _optimistic: false };
          return next;
        }
        // mark realtime arrivals as "fresh" so CSS fade-in only animates them
        if (source === 'realtime') freshIdsRef.current.add(row.id);
        return [...prev, row];
      });
      lastSeenRef.current = row.created_at;
    };

    const unsub = subscribe({
      key: `messages:${tid}`,
      table: 'relationship_messages',
      event: 'INSERT',
      filter: `thread_id=eq.${tid}`,
      onPayload: (p) => {
        if (p.eventType !== 'INSERT' || !p.new) return;
        queueMicrotask(() => ingestIncoming(p.new, 'realtime'));
      },
    });
    return unsub;
  }, [thread?.id]);

  /* ── POLLING (15s safety net) ────────────────────────────── */
  useEffect(() => {
    if (!thread?.id) return undefined;
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await listMessages(thread.id, lastSeenRef.current || undefined);
        const incoming = data?.data || [];
        if (incoming.length) {
          setMessages(prev => {
            const ids = new Set(prev.map(m => m.id));
            const merged = [...prev, ...incoming.filter(m => !ids.has(m.id))];
            return merged;
          });
          lastSeenRef.current = incoming[incoming.length - 1].created_at;
          markAllRead(thread.id).catch(() => {});
        }
      } catch { /* silent */ }
    }, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [thread?.id]);

  /* ── SMART AUTO-SCROLL ────────────────────────────────────
   * Only follow the foot if the reader is already there.
   * Otherwise show a discrete "↓ nuova nota" hint and let them
   * keep their place. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom <= AUTO_SCROLL_THRESHOLD) {
      // smooth follow
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      setPendingScroll(0);
      // ensure server-side read marker too
      if (thread?.id) markAllRead(thread.id).catch(() => {});
    } else {
      // reader is back in history: don't yank
      setPendingScroll(p => p + 1);
    }
  }, [messages.length, thread?.id]);

  // Reset pending hint when user scrolls back to foot manually
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const onScroll = () => {
      const dfb = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (dfb <= AUTO_SCROLL_THRESHOLD) {
        setPendingScroll(0);
        if (thread?.id) markAllRead(thread.id).catch(() => {});
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [thread?.id]);

  const jumpToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setPendingScroll(0);
  };

  /* ── SEND ────────────────────────────────────────────────── */
  const send = async () => {
    const text = draft.trim();
    if (!text || sending || !thread?.id) return;
    setSending(true);
    // optimistic
    const optimisticId = `tmp_${Date.now()}`;
    const optimistic = {
      id: optimisticId,
      sender_type: isClient ? 'client' : 'designer',
      sender_label: locale === 'it' ? 'Tu' : 'You',
      message_type: 'text',
      content: text,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setDraft('');
    try {
      const { data } = await sendMessage(thread.id, { content: text, locale });
      setMessages(prev => prev.map(m =>
        m.id === optimisticId ? { ...data.message, _optimistic: false } : m
      ));
      lastSeenRef.current = data.message.created_at;
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      toast.error(locale === 'it' ? 'Invio non riuscito.' : 'Send failed.');
    } finally {
      setSending(false);
    }
  };

  const counterpartName = counterpart?.name
    || (locale === 'it' ? 'Il tuo studio' : 'Your studio');
  const presenceLabelLive = presence
    ? (locale === 'it' ? presence.state_label_it : presence.state_label_en)
    : null;
  const counterpartRole = presenceLabelLive
    || counterpart?.role_label
    || presenceLabel(counterpart?.role || (isClient ? 'designer' : 'client'), locale);

  /* ── RENDER ──────────────────────────────────────────────── */
  return (
    <section
      className={`conv-surface conv-surface--${variant} ${fillHeight ? 'conv-surface--fill' : ''}`}
      data-testid="conversation-surface"
    >
      {/* HEAD · counterpart presence + status */}
      <header className="conv-head" data-testid="conv-head">
        <div className="conv-head__who">
          <div className="conv-head__avatar" data-testid="conv-head-avatar">
            {counterpart?.avatar_url ? (
              <img src={counterpart.avatar_url} alt="" />
            ) : (
              <span aria-hidden>{(counterpartName || '?').slice(0, 1)}</span>
            )}
            <span className="conv-head__pulse" aria-hidden />
          </div>
          <div className="conv-head__meta">
            <p className="conv-head__name" data-testid="conv-counterpart-name">{counterpartName}</p>
            <p className="conv-head__role">{counterpartRole}</p>
            {counterpart?.short_bio && (
              <p className="conv-head__bio">{counterpart.short_bio}</p>
            )}
          </div>
        </div>
        {status?.status_label_it && (
          <div className="conv-head__status" data-testid="conv-status-bar">
            <span className="conv-head__status-dot" aria-hidden />
            <span className="conv-head__status-label">
              {locale === 'it' ? status.status_label_it : status.status_label_en}
            </span>
          </div>
        )}
      </header>

      {/* STREAM · messages */}
      <div className="conv-stream" ref={scrollRef} data-testid="conv-stream">
        {loading && (
          <div className="conv-loading"><Loader2 size={14} className="conv-spin" />
            <span>{locale === 'it' ? 'Apertura conversazione…' : 'Opening conversation…'}</span>
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="conv-empty" data-testid="conv-empty">
            <p>
              {isClient
                ? (locale === 'it'
                    ? 'Inizia il dialogo con il tuo studio. Scrivi una prima nota — qualsiasi pensiero, qualsiasi atmosfera.'
                    : 'Begin the dialogue with your studio. Write a first note — any thought, any atmosphere.')
                : (locale === 'it'
                    ? 'Nessun messaggio ancora. Apri la conversazione con un saluto editoriale.'
                    : 'No messages yet. Open the conversation with an editorial greeting.')}
            </p>
          </div>
        )}
        {!loading && messages.map(m => {
          const fromMe = (m.sender_type === 'client') === isClient;
          const isDesigner = m.sender_type === 'designer' || m.sender_type === 'studio';
          const fresh = freshIdsRef.current.has(m.id);
          return (
            <article
              key={m.id}
              className={`conv-msg ${fromMe ? 'conv-msg--mine' : 'conv-msg--theirs'} conv-msg--${m.sender_type} ${m._optimistic ? 'conv-msg--optimistic' : ''} ${fresh ? 'conv-msg--fresh' : ''}`}
              data-testid={`conv-msg-${m.id}`}
            >
              <p className={`conv-msg__author ${isDesigner ? 'conv-msg__author--designer' : ''}`}>
                {m.sender_label}
              </p>
              <p className="conv-msg__body">{m.content}</p>
              <p className="conv-msg__when">{formatWhen(m.created_at, locale)}</p>
            </article>
          );
        })}
        {pendingScroll > 0 && (
          <button
            type="button"
            className="conv-new-note"
            onClick={jumpToBottom}
            data-testid="conv-new-note-hint"
          >
            <ArrowDown size={12} strokeWidth={1.7} />
            <span>
              {locale === 'it'
                ? (pendingScroll === 1 ? 'una nuova nota' : `${pendingScroll} nuove note`)
                : (pendingScroll === 1 ? 'a new note' : `${pendingScroll} new notes`)}
            </span>
          </button>
        )}
      </div>

      {/* COMPOSER */}
      <form
        className="conv-composer"
        onSubmit={(e) => { e.preventDefault(); send(); }}
        data-testid="conv-composer"
      >
        <textarea
          className="conv-composer__input"
          placeholder={
            isClient
              ? (locale === 'it'
                  ? 'Scrivi al tuo studio…'
                  : 'Write to your studio…')
              : (locale === 'it'
                  ? 'Rispondi al cliente con cura editoriale…'
                  : 'Reply to your client with editorial care…')
          }
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          data-testid="conv-composer-input"
        />
        <button
          type="submit"
          className="conv-composer__send"
          disabled={sending || !draft.trim()}
          data-testid="conv-composer-send"
        >
          {sending ? <Loader2 size={14} className="conv-spin" /> : <Send size={14} strokeWidth={1.7} />}
          <span>{locale === 'it' ? 'Invia' : 'Send'}</span>
        </button>
      </form>

      {error === 'auth' && (
        <p className="conv-error" data-testid="conv-auth-error">
          {locale === 'it' ? 'Accedi per aprire la conversazione.' : 'Sign in to open the conversation.'}
        </p>
      )}
    </section>
  );
};

export default ConversationSurface;
