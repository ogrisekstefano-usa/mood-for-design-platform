/**
 * ComposePage — ITER187.B (Founder-locked: A2 · Minimal Operational Composer).
 * DELIBERATELY minimal: From / To / Cc / Subject / Body (plain textarea).
 * Supports New / Reply (?reply_to=) / Forward (?forward_of=).
 * Reuses NO proposal editor, NO Tiptap toolbar — operational layer only.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import JM from '../../../lib/journeyMailApi';

const splitAddrs = (s) =>
  s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);

export default function ComposePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const replyId = params.get('reply_to');
  const forwardId = params.get('forward_of');

  const [mailboxes, setMailboxes] = useState([]);
  const [mailboxId, setMailboxId] = useState('');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [inReplyTo, setInReplyTo] = useState(null);
  const [refs, setRefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadMailboxes = useCallback(async () => {
    try {
      const { data } = await JM.listMailboxes();
      const list = data?.mailboxes || [];
      setMailboxes(list);
      if (list.length > 0 && !mailboxId) {
        const primary = list.find((m) => m.is_primary) || list[0];
        setMailboxId(primary.id);
      }
    } catch (_) {
      toast.error('Impossibile caricare le mailbox');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hydrateParent = useCallback(async () => {
    const parentId = replyId || forwardId;
    if (!parentId) { setLoading(false); return; }
    try {
      const { data } = await JM.getMessage(parentId);
      const m = data?.message;
      if (!m) { setLoading(false); return; }
      // Target mailbox: keep the same mailbox the parent message belongs to
      if (m.mailbox_id) setMailboxId(m.mailbox_id);
      const subj = m.subject || '';
      if (replyId) {
        setSubject(subj.startsWith('Re:') ? subj : `Re: ${subj}`);
        setTo(m.from_addr || '');
        setInReplyTo(m.message_id_header || null);
        const prevRefs = m.references_header || '';
        setRefs(prevRefs ? `${prevRefs} ${m.message_id_header || ''}`.trim() : (m.message_id_header || null));
        setBody(`\n\n--- Messaggio originale ---\nDa: ${m.from_addr}\nData: ${m.received_at}\nOggetto: ${subj}\n`);
      } else {
        setSubject(subj.startsWith('Fwd:') ? subj : `Fwd: ${subj}`);
        setBody(`\n\n--- Messaggio inoltrato ---\nDa: ${m.from_addr}\nData: ${m.received_at}\nOggetto: ${subj}\n`);
      }
    } catch (_) { /* tolerate */ }
    finally { setLoading(false); }
  }, [replyId, forwardId]);

  useEffect(() => { loadMailboxes(); hydrateParent(); }, [loadMailboxes, hydrateParent]);

  const send = async () => {
    if (!mailboxId) { toast.warning('Seleziona una mailbox'); return; }
    const toList = splitAddrs(to);
    if (toList.length === 0) { toast.warning('Inserisci almeno un destinatario'); return; }
    setSending(true);
    try {
      const payload = {
        to_addrs: toList,
        cc_addrs: splitAddrs(cc),
        bcc_addrs: splitAddrs(bcc),
        subject: subject.trim(),
        body_text: body,
        body_html: null,
        in_reply_to: inReplyTo || undefined,
        references: refs || undefined,
      };
      const { data } = await JM.sendEmail(mailboxId, payload);
      if (data?.outbound_append_to_sent === false) {
        toast.warning('Email inviata. Copia in Sent non riuscita — registrata nel log uscite.');
      } else {
        toast.success('Email inviata');
      }
      navigate('/communications/mail/messages');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Invio fallito');
    } finally { setSending(false); }
  };

  const cancel = () => navigate(-1);

  if (loading) return <div className="cm-loading"><Icons.Loader2 size={16} className="cm-spin"/>Caricamento…</div>;

  if (mailboxes.length === 0) {
    return (
      <div className="cm-empty" data-testid="cm-compose-no-mailbox">
        <Icons.Send size={28} aria-hidden="true" />
        <div className="cm-empty-title">Nessuna mailbox disponibile per l'invio.</div>
        <div className="cm-empty-body">
          Chiedi all'amministratore del tenant di abilitare i permessi di invio
          su almeno una mailbox.
        </div>
        <button type="button" className="cm-btn"
                 onClick={() => navigate('/communications/mail/mailboxes')}>
          <Icons.ArrowLeft size={14} aria-hidden="true" /> Vai alle mailbox
        </button>
      </div>
    );
  }

  return (
    <>
      <header className="cm-header">
        <div>
          <div className="cm-eyebrow">COMMUNICATIONS · MAIL · COMPOSE</div>
          <h1 className="cm-title" style={{ fontSize: 22 }}>
            {replyId ? 'Rispondi al messaggio' : forwardId ? 'Inoltra il messaggio' : 'Nuovo messaggio'}
          </h1>
        </div>
        <div className="cm-actions">
          <button type="button" className="cm-btn cm-btn-ghost"
                   onClick={cancel} data-testid="cm-compose-cancel">
            <Icons.X size={14} aria-hidden="true" /> Annulla
          </button>
          <button type="button" className="cm-btn cm-btn-primary"
                   onClick={send} disabled={sending}
                   data-testid="cm-compose-send">
            <Icons.Send size={14} aria-hidden="true" />
            {sending ? 'Invio…' : 'Invia'}
          </button>
        </div>
      </header>

      <section style={{ background: 'var(--cm-surface)', border: '1px solid var(--cm-line)',
                          borderRadius: 'var(--cm-radius)', padding: '18px 20px' }}>
        <div className="cm-compose-recipients">
          <label className="cm-label">Mailbox</label>
          <select className="cm-select" value={mailboxId}
                   onChange={(e) => setMailboxId(e.target.value)}
                   data-testid="cm-compose-mailbox">
            {mailboxes.map((m) => (
              <option key={m.id} value={m.id}>{m.mailbox_name} ({m.from_email})</option>
            ))}
          </select>
        </div>
        <div className="cm-compose-recipients">
          <label className="cm-label">A</label>
          <input className="cm-input" value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="destinatario@dominio.it, altro@dominio.it"
                  data-testid="cm-compose-to" />
        </div>
        <div className="cm-compose-recipients">
          <label className="cm-label">Cc</label>
          <input className="cm-input" value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="copia@dominio.it" data-testid="cm-compose-cc" />
        </div>
        <div className="cm-compose-recipients">
          <label className="cm-label">Ccn</label>
          <input className="cm-input" value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="nascosto@dominio.it" data-testid="cm-compose-bcc" />
        </div>
        <div className="cm-compose-recipients">
          <label className="cm-label">Oggetto</label>
          <input className="cm-input" value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Oggetto" data-testid="cm-compose-subject" />
        </div>
        <div style={{ marginTop: 12 }}>
          <label className="cm-label">Corpo</label>
          <textarea className="cm-textarea" rows={14}
                     style={{ resize: 'vertical', fontFamily: 'inherit' }}
                     value={body}
                     onChange={(e) => setBody(e.target.value)}
                     placeholder="Scrivi il messaggio…"
                     data-testid="cm-compose-body" />
        </div>
      </section>
    </>
  );
}
