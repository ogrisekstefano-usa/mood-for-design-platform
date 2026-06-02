/**
 * MessageDetailPage — ITER187.B.
 * Two-column layout: message body (left) + associations panel (right).
 * Body is rendered inside a SANDBOXED iframe (no allow-scripts) — XSS-safe.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import JM from '../../../lib/journeyMailApi';
import MessageAssociationsPanel from './MessageAssociationsPanel';

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch (_) { return iso; }
}

function MessageBodyFrame({ htmlUrl, textUrl }) {
  const [htmlContent, setHtmlContent] = useState(null);
  const [textContent, setTextContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (htmlUrl) {
          const r = await fetch(htmlUrl);
          if (r.ok && !cancelled) setHtmlContent(await r.text());
        }
        if (textUrl && !htmlContent) {
          const r = await fetch(textUrl);
          if (r.ok && !cancelled) setTextContent(await r.text());
        }
      } catch (_) { /* tolerate */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [htmlUrl, textUrl]);

  if (loading) return <div className="cm-loading"><Icons.Loader2 size={16} className="cm-spin"/>Caricamento corpo…</div>;
  if (htmlContent) {
    return (
      <iframe
        title="Corpo del messaggio"
        className="cm-body-frame"
        sandbox=""
        srcDoc={htmlContent}
        data-testid="cm-msg-body-frame"
      />
    );
  }
  if (textContent) {
    return <pre className="cm-body-text" data-testid="cm-msg-body-text">{textContent}</pre>;
  }
  return (
    <div className="cm-empty" data-testid="cm-msg-body-empty">
      <Icons.FileX2 size={28} aria-hidden="true" />
      <div className="cm-empty-title">Corpo non disponibile.</div>
      <div className="cm-empty-body">Il corpo del messaggio non è ancora stato sincronizzato o non è leggibile.</div>
    </div>
  );
}

function MessageAttachmentsStrip({ attachments }) {
  if (!attachments || attachments.length === 0) return null;
  const fmtSize = (n) => {
    if (!n) return '';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  };
  return (
    <div className="cm-attachments" data-testid="cm-msg-attachments">
      <div className="cm-eyebrow" style={{ marginBottom: 6 }}>
        ALLEGATI · {attachments.length}
      </div>
      {attachments.map((a) => (
        <div key={a.id} className="cm-att-row" data-testid={`cm-att-${a.id}`}>
          <span><Icons.Paperclip size={12} style={{ marginRight: 6, verticalAlign: 'middle' }}/>{a.filename || '(senza nome)'}</span>
          <span style={{ color: 'var(--cm-ink-mute)' }}>{a.mime_type || ''} · {fmtSize(a.size_bytes)}</span>
        </div>
      ))}
    </div>
  );
}

export default function MessageDetailPage() {
  const { messageId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = params.get('return');

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await JM.getMessage(messageId);
      setPayload(data);
    } catch (err) {
      const code = err?.response?.status;
      setError(code === 404 ? 'Messaggio non trovato.' : 'Caricamento messaggio fallito.');
    } finally { setLoading(false); }
  }, [messageId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="cm-loading"><Icons.Loader2 size={16} className="cm-spin"/>Caricamento…</div>;
  if (error) return (
    <div className="cm-empty" data-testid="cm-msg-detail-error">
      <Icons.AlertTriangle size={28} aria-hidden="true" />
      <div className="cm-empty-title">{error}</div>
      <button type="button" className="cm-btn"
               onClick={() => navigate('/communications/mail/messages')}>
        <Icons.ArrowLeft size={14} aria-hidden="true" /> Torna ai messaggi
      </button>
    </div>
  );
  if (!payload) return null;

  const m = payload.message || {};
  const toAddrs = Array.isArray(m.to_addrs) ? m.to_addrs : [];
  const ccAddrs = Array.isArray(m.cc_addrs) ? m.cc_addrs : [];

  const handleReply = () => navigate(`/communications/mail/compose?reply_to=${m.id}`);
  const handleForward = () => navigate(`/communications/mail/compose?forward_of=${m.id}`);
  const handleBack = () => {
    if (returnTo && returnTo.startsWith('journey/')) {
      const pid = returnTo.split('/')[1];
      navigate(`/workspace/projects/${pid}?tab=communications`);
    } else navigate('/communications/mail/messages');
  };

  return (
    <>
      <header className="cm-header">
        <div>
          <div className="cm-eyebrow">COMMUNICATIONS · MAIL · MESSAGE</div>
          <h1 className="cm-title" style={{ fontSize: 22 }}>Dettaglio messaggio</h1>
        </div>
        <div className="cm-actions">
          <button type="button" className="cm-btn cm-btn-ghost"
                   onClick={handleBack} data-testid="cm-msg-back">
            <Icons.ArrowLeft size={14} aria-hidden="true" /> Indietro
          </button>
          <button type="button" className="cm-btn"
                   onClick={handleReply} data-testid="cm-msg-reply">
            <Icons.Reply size={14} aria-hidden="true" /> Rispondi
          </button>
          <button type="button" className="cm-btn"
                   onClick={handleForward} data-testid="cm-msg-forward">
            <Icons.Forward size={14} aria-hidden="true" /> Inoltra
          </button>
        </div>
      </header>

      <div className="cm-detail-grid">
        <section>
          <div className="cm-detail-head" data-testid="cm-msg-detail-head">
            <div className="cm-eyebrow">
              {m.direction === 'outbound' ? 'IN USCITA' : 'IN ENTRATA'} · {fmtDate(m.received_at)}
            </div>
            <div className="cm-detail-subject">{m.subject || '(nessun oggetto)'}</div>
            <div className="cm-detail-meta">
              <div><strong>Da:</strong> {m.from_addr || '—'}</div>
              <div><strong>A:</strong> {toAddrs.join(', ') || '—'}</div>
              {ccAddrs.length > 0 && <div><strong>Cc:</strong> {ccAddrs.join(', ')}</div>}
              <div className="cm-detail-meta-row">
                <span className="cm-mailbox-pill">Mailbox · {m.mailbox_id?.slice(0, 8)}…</span>
                {m.folder && <span style={{ color: 'var(--cm-ink-mute)', fontSize: 12 }}>Cartella: {m.folder}</span>}
                {m.thread_id && <span style={{ color: 'var(--cm-ink-mute)', fontSize: 12 }}>Thread: {m.thread_id.slice(0, 8)}…</span>}
              </div>
            </div>
          </div>

          <MessageBodyFrame htmlUrl={payload.body_html_url} textUrl={payload.body_text_url} />
          <MessageAttachmentsStrip attachments={payload.attachments} />
        </section>

        <MessageAssociationsPanel
          messageId={messageId}
          initialLinks={payload.links || []}
          onChanged={load}
        />
      </div>
    </>
  );
}
