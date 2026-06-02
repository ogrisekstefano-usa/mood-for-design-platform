/**
 * MessagesListPage — ITER187.B
 * Operational table: Date | From | Subject | Mailbox | Direction | Linked.
 * Filters: mailbox, linked-state, direction, period, free-text search.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import JM from '../../../lib/journeyMailApi';

const PAGE_SIZE = 50;
const FROM_RE = /^"?([^"<]+)"?\s*<?([^>]+)?>?$/;

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 86400) return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  } catch (_) { return iso; }
}

function parseFrom(raw) {
  if (!raw) return { name: '—', email: '' };
  const m = FROM_RE.exec(raw.trim());
  if (m) return { name: (m[1] || '').trim(), email: (m[2] || '').trim() };
  return { name: raw, email: '' };
}

export default function MessagesListPage() {
  const navigate = useNavigate();
  const [mailboxes, setMailboxes] = useState([]);
  const [selectedMailbox, setSelectedMailbox] = useState('');
  const [direction, setDirection] = useState('');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('30');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    JM.listMailboxes().then(({ data }) => {
      setMailboxes(data?.mailboxes || []);
      if ((data?.mailboxes || []).length > 0 && !selectedMailbox) {
        setSelectedMailbox(data.mailboxes[0].id);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    if (!selectedMailbox) { setMessages([]); return; }
    setLoading(true);
    try {
      const params = { limit: PAGE_SIZE, offset };
      if (search.trim()) params.q = search.trim();
      const { data } = await JM.listMailboxMessages(selectedMailbox, params);
      let rows = data?.messages || [];
      if (direction) rows = rows.filter((r) => r.direction === direction);
      setMessages(rows);
    } catch (err) {
      toast.error('Caricamento messaggi fallito');
    } finally {
      setLoading(false);
    }
  }, [selectedMailbox, offset, search, direction]);

  useEffect(() => { load(); }, [load]);

  const mailboxById = useMemo(
    () => Object.fromEntries(mailboxes.map((m) => [m.id, m])),
    [mailboxes]
  );

  return (
    <>
      <header className="cm-header">
        <div>
          <div className="cm-eyebrow">COMMUNICATIONS · MAIL</div>
          <h1 className="cm-title">Messaggi</h1>
          <p className="cm-subtitle">Solo lettura. Lo stato del messaggio nella mailbox originale resta invariato.</p>
        </div>
        <div className="cm-actions">
          <button type="button" className="cm-btn cm-btn-ghost"
                   onClick={() => navigate('/communications/mail/mailboxes')}
                   data-testid="cm-msg-back-to-mailboxes">
            <Icons.ArrowLeft size={14} aria-hidden="true" /> Mailbox
          </button>
          <button type="button" className="cm-btn cm-btn-primary"
                   onClick={() => navigate('/communications/mail/compose')}
                   data-testid="cm-msg-compose-btn">
            <Icons.PenSquare size={14} aria-hidden="true" /> Componi
          </button>
        </div>
      </header>

      <div className="cm-toolbar">
        <select className="cm-select" value={selectedMailbox}
                 onChange={(e) => { setSelectedMailbox(e.target.value); setOffset(0); }}
                 data-testid="cm-msg-filter-mailbox">
          <option value="">— Seleziona mailbox —</option>
          {mailboxes.map((m) => (
            <option key={m.id} value={m.id}>{m.mailbox_name} ({m.from_email})</option>
          ))}
        </select>
        <select className="cm-select" value={direction}
                 onChange={(e) => setDirection(e.target.value)}
                 data-testid="cm-msg-filter-direction">
          <option value="">Tutte</option>
          <option value="inbound">In entrata</option>
          <option value="outbound">In uscita</option>
        </select>
        <select className="cm-select" value={period}
                 onChange={(e) => setPeriod(e.target.value)}
                 data-testid="cm-msg-filter-period">
          <option value="7">7 giorni</option>
          <option value="30">30 giorni</option>
          <option value="90">90 giorni</option>
        </select>
        <input className="cm-input cm-search" placeholder="Cerca per oggetto…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
                data-testid="cm-msg-filter-search" />
        <button type="button" className="cm-btn" onClick={() => load()}
                 data-testid="cm-msg-refresh">
          <Icons.RefreshCw size={14} aria-hidden="true" /> Aggiorna
        </button>
      </div>

      {!selectedMailbox ? (
        <div className="cm-empty" data-testid="cm-msg-empty-pick">
          <Icons.Mail size={28} aria-hidden="true" />
          <div className="cm-empty-title">Seleziona una mailbox.</div>
          <div className="cm-empty-body">Per visualizzare i messaggi scegli prima una mailbox dal selettore qui sopra.</div>
        </div>
      ) : loading ? (
        <div className="cm-loading"><Icons.Loader2 size={16} className="cm-spin"/>Caricamento…</div>
      ) : messages.length === 0 ? (
        <div className="cm-empty" data-testid="cm-msg-empty">
          <Icons.Inbox size={28} aria-hidden="true" />
          <div className="cm-empty-title">Nessun messaggio disponibile.</div>
          <div className="cm-empty-body">Sincronizza la mailbox per iniziare a importare le comunicazioni.</div>
          <button type="button" className="cm-btn cm-btn-primary"
                   onClick={() => navigate('/communications/mail/mailboxes')}
                   data-testid="cm-msg-empty-cta">Vai alle mailbox</button>
        </div>
      ) : (
        <table className="cm-table" data-testid="cm-msg-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Mittente</th>
              <th>Oggetto</th>
              <th>Mailbox</th>
              <th>Direzione</th>
              <th>Allegati</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((m) => {
              const f = parseFrom(m.from_addr);
              const mb = mailboxById[m.mailbox_id];
              return (
                <tr key={m.id}
                    onClick={() => navigate(`/communications/mail/messages/${m.id}`)}
                    data-testid={`cm-msg-row-${m.id}`}>
                  <td>{formatDate(m.received_at)}</td>
                  <td title={f.email}>{f.name || f.email}</td>
                  <td>{(m.subject || '(nessun oggetto)').slice(0, 80)}</td>
                  <td><span className="cm-mailbox-pill">{mb?.mailbox_name || '—'}</span></td>
                  <td>
                    <span className="cm-dir-arrow">
                      {m.direction === 'outbound'
                        ? <><Icons.ArrowUpRight size={12}/>Uscita</>
                        : <><Icons.ArrowDownLeft size={12}/>Entrata</>}
                    </span>
                  </td>
                  <td>{m.attachments_count > 0 ? `${m.attachments_count} ${m.attachments_count === 1 ? 'allegato' : 'allegati'}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
