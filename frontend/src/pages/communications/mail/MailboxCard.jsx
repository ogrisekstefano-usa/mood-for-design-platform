/**
 * MailboxCard — ITER187.B
 * Per Founder request, shows: Last Successful Sync · Total Messages ·
 * Linked Emails · Health Status. Includes Test / Sync / Edit / Disable.
 */
import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import JM from '../../../lib/journeyMailApi';
import MailboxStatusBadge from './MailboxStatusBadge';

function _formatRelative(iso) {
  if (!iso) return 'mai';
  try {
    const t = new Date(iso).getTime();
    const diff = (Date.now() - t) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s fa`;
    if (diff < 3600) return `${Math.floor(diff / 60)} min fa`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h fa`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} g fa`;
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (_) { return iso; }
}

export default function MailboxCard({ mailbox, linkedCount, canAdmin = true,
                                       onEdit, onChanged }) {
  const [syncing, setSyncing] = useState(false);
  const [probing, setProbing] = useState(false);
  const [pollTimer, setPollTimer] = useState(null);

  useEffect(() => () => { if (pollTimer) clearInterval(pollTimer); }, [pollTimer]);

  const onTest = async () => {
    setProbing(true);
    try {
      const { data } = await JM.probeHealth(mailbox.id);
      const ok = data?.imap?.ok && data?.smtp?.ok;
      if (ok) toast.success('Connessione OK · IMAP + SMTP');
      else {
        const errs = [];
        if (!data?.imap?.ok) errs.push(`IMAP: ${data?.imap?.last_error || 'errore'}`);
        if (!data?.smtp?.ok) errs.push(`SMTP: ${data?.smtp?.last_error || 'errore'}`);
        toast.warning(errs.join(' · '));
      }
      onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Probe fallita');
    } finally {
      setProbing(false);
    }
  };

  const onSync = async () => {
    setSyncing(true);
    try {
      await JM.triggerSync(mailbox.id);
      toast.success('Sync avviato');
      // Polling: 10s interval, max 3 polls (30s total) — per Founder gate §6
      let polls = 0;
      const baseline = mailbox.last_sync_completed_at;
      const t = setInterval(async () => {
        polls += 1;
        try {
          const { data } = await JM.getMailbox(mailbox.id);
          onChanged?.(data);
          if (data?.last_sync_completed_at && data.last_sync_completed_at !== baseline) {
            clearInterval(t); setPollTimer(null); setSyncing(false);
            return;
          }
        } catch (_) { /* tolerate */ }
        if (polls >= 3) {
          clearInterval(t); setPollTimer(null); setSyncing(false);
        }
      }, 10000);
      setPollTimer(t);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Sync fallito');
      setSyncing(false);
    }
  };

  const total = mailbox.messages_synced_total || 0;
  const inbox = mailbox.messages_inbox || 0;
  const sent = mailbox.messages_sent || 0;

  return (
    <article className="cm-mailbox-card" data-testid={`cm-mailbox-card-${mailbox.id}`}>
      <header className="cm-card-head">
        <div>
          <div className="cm-card-name">
            {mailbox.mailbox_name}
            <span className="cm-card-type">{mailbox.mailbox_type}</span>
          </div>
          <div className="cm-card-email">{mailbox.from_email}</div>
        </div>
        <MailboxStatusBadge
          status={mailbox.connection_status}
          isActive={mailbox.is_active !== false}
          testId={`cm-mailbox-status-${mailbox.id}`}
        />
      </header>

      <div className="cm-card-metrics">
        <div>
          <div className="cm-metric-label">Health</div>
          <div className="cm-metric-value" data-testid={`cm-metric-health-${mailbox.id}`}>
            {mailbox.is_active === false ? 'Disabled'
              : (mailbox.connection_status === 'connected' ? 'OK'
                  : mailbox.connection_status === 'warning' ? 'Warning'
                  : mailbox.connection_status === 'error' ? 'Error' : 'Da verificare')}
          </div>
        </div>
        <div>
          <div className="cm-metric-label">Last Successful Sync</div>
          <div className="cm-metric-value" data-testid={`cm-metric-last-sync-${mailbox.id}`}>
            {_formatRelative(mailbox.last_sync_completed_at)}
          </div>
        </div>
        <div>
          <div className="cm-metric-label">Total Messages</div>
          <div className="cm-metric-value" data-testid={`cm-metric-total-${mailbox.id}`}>
            {total.toLocaleString('it-IT')}
            {(inbox || sent) ? (
              <span style={{ color: 'var(--cm-ink-mute)', fontWeight: 400, marginLeft: 4 }}>
                · {inbox} in · {sent} out
              </span>
            ) : null}
          </div>
        </div>
        <div>
          <div className="cm-metric-label">Linked Emails</div>
          <div className="cm-metric-value" data-testid={`cm-metric-linked-${mailbox.id}`}>
            {(linkedCount ?? 0).toLocaleString('it-IT')}
          </div>
        </div>
      </div>

      <div className="cm-card-hosts">
        IMAP: {mailbox.imap_host}:{mailbox.imap_port} · SMTP: {mailbox.smtp_host}:{mailbox.smtp_port}
      </div>

      <div className="cm-card-actions">
        <button type="button" className="cm-btn cm-btn-sm"
                 onClick={onTest} disabled={probing}
                 data-testid={`cm-mailbox-test-${mailbox.id}`}>
          <Icons.Plug size={13} aria-hidden="true" />
          {probing ? 'Probe…' : 'Test connessione'}
        </button>
        <button type="button" className="cm-btn cm-btn-sm cm-btn-primary"
                 onClick={onSync} disabled={syncing || mailbox.is_active === false}
                 data-testid={`cm-mailbox-sync-${mailbox.id}`}>
          <Icons.RefreshCw size={13} aria-hidden="true"
                            className={syncing ? 'cm-spin' : ''} />
          {syncing ? 'Sync in corso…' : 'Sync ora'}
        </button>
        {canAdmin && (
          <button type="button" className="cm-btn cm-btn-sm cm-btn-ghost"
                   onClick={() => onEdit?.(mailbox)}
                   data-testid={`cm-mailbox-edit-${mailbox.id}`}>
            <Icons.Pencil size={13} aria-hidden="true" /> Modifica
          </button>
        )}
      </div>
    </article>
  );
}
