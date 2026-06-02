/**
 * MailboxFormDrawer — ITER187.B
 * Right-side drawer for connecting (POST) or editing (PATCH) a mailbox.
 * Credentials are never read; "set" boolean is shown in edit mode and a
 * separate "Rotate password" flow calls PUT /credentials.
 */
import React, { useEffect, useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import JM from '../../../lib/journeyMailApi';

const TYPES = [
  { v: 'shared',   l: 'Condivisa (shared)' },
  { v: 'team',     l: 'Team' },
  { v: 'personal', l: 'Personale' },
  { v: 'system',   l: 'Sistema (system)' },
];
const SECURITY = [
  { v: 'ssl',      l: 'SSL/TLS' },
  { v: 'starttls', l: 'STARTTLS' },
  { v: 'plain',    l: 'Plain (sconsigliato)' },
];
const VIS_MODES = [
  { v: 'tenant',     l: 'Tutto il tenant' },
  { v: 'roles',      l: 'Per ruolo' },
  { v: 'members',    l: 'Membri specifici' },
  { v: 'owner_only', l: 'Solo proprietario' },
];
const PROVIDERS = ['custom', 'siteground', 'gmail', 'outlook', 'exchange'];

const blank = () => ({
  mailbox_name: '', mailbox_description: '', mailbox_type: 'shared',
  from_name: '', from_email: '', reply_to_email: '',
  imap_host: '', imap_port: 993, imap_security: 'ssl',
  imap_username: '', imap_password: '',
  smtp_host: '', smtp_port: 587, smtp_security: 'starttls',
  smtp_username: '', smtp_password: '',
  is_primary: false,
  provider_hint: 'custom',
  visibility_scope: { mode: 'tenant' },
});

export default function MailboxFormDrawer({ open, mailbox, onClose, onSaved }) {
  const editing = Boolean(mailbox);
  const [form, setForm] = useState(blank());
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        ...blank(),
        ...mailbox,
        imap_password: '',
        smtp_password: '',
        visibility_scope: mailbox.visibility_scope || { mode: 'tenant' },
        provider_hint: (mailbox.metadata_json || {}).provider_hint || 'custom',
      });
    } else {
      setForm(blank());
    }
    setErrors({});
  }, [open, editing, mailbox]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const applyProvider = (p) => {
    const def = JM.PROVIDER_DEFAULTS[p];
    set('provider_hint', p);
    if (def) {
      setForm((f) => ({ ...f, ...def }));
    }
  };

  const validate = () => {
    const e = {};
    if (!form.mailbox_name.trim()) e.mailbox_name = 'Obbligatorio';
    if (!form.from_email.trim() || !form.from_email.includes('@')) e.from_email = 'Email non valida';
    if (!form.imap_host.trim()) e.imap_host = 'Obbligatorio';
    if (!form.smtp_host.trim()) e.smtp_host = 'Obbligatorio';
    if (!form.imap_username.trim()) e.imap_username = 'Obbligatorio';
    if (!form.smtp_username.trim()) e.smtp_username = 'Obbligatorio';
    if (!editing && !form.imap_password) e.imap_password = 'Obbligatoria';
    if (!editing && !form.smtp_password) e.smtp_password = 'Obbligatoria';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      if (editing) {
        const patchPayload = {
          mailbox_name: form.mailbox_name,
          mailbox_description: form.mailbox_description || null,
          mailbox_type: form.mailbox_type,
          from_name: form.from_name,
          reply_to_email: form.reply_to_email || null,
          is_primary: !!form.is_primary,
          visibility_scope: form.visibility_scope,
        };
        await JM.patchMailbox(mailbox.id, patchPayload);
        if (form.imap_password || form.smtp_password) {
          await JM.rotateCredentials(mailbox.id, {
            imap_password: form.imap_password || undefined,
            smtp_password: form.smtp_password || undefined,
          });
        }
        toast.success('Mailbox aggiornata');
      } else {
        const payload = { ...form };
        delete payload.provider_hint;
        payload.provider_hint = form.provider_hint === 'custom' ? null : form.provider_hint;
        await JM.createMailbox(payload);
        toast.success('Mailbox connessa');
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Operazione fallita');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!editing) return;
    if (!window.confirm('Disabilitare questa mailbox? La sincronizzazione si fermerà.')) return;
    try {
      await JM.disableMailbox(mailbox.id);
      toast.success('Mailbox disabilitata');
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Errore');
    }
  };

  if (!open) return null;

  return (
    <div className="cm-drawer-mask" role="dialog" aria-modal="true"
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
          data-testid="cm-mailbox-drawer">
      <aside className="cm-drawer">
        <header className="cm-drawer-head">
          <div>
            <div className="cm-eyebrow">{editing ? 'Modifica mailbox' : 'Nuova mailbox'}</div>
            <div className="cm-drawer-title">
              {editing ? form.mailbox_name : 'Connetti mailbox'}
            </div>
          </div>
          <button type="button" className="cm-btn cm-btn-ghost"
                   onClick={onClose} aria-label="Chiudi" data-testid="cm-drawer-close">
            <Icons.X size={16} aria-hidden="true" />
          </button>
        </header>

        {/* Identità */}
        <section className="cm-drawer-section">
          <h3 className="cm-drawer-section-title">Identità</h3>
          <div className="cm-field">
            <label className="cm-label">Nome mailbox</label>
            <input className="cm-input" value={form.mailbox_name}
                    onChange={(e) => set('mailbox_name', e.target.value)}
                    placeholder="Es. Projects · Showroom Milano"
                    data-testid="cm-field-mailbox-name" />
            {errors.mailbox_name && <small style={{ color: 'var(--cm-error)' }}>{errors.mailbox_name}</small>}
          </div>
          <div className="cm-row-2">
            <div className="cm-field">
              <label className="cm-label">Tipo</label>
              <select className="cm-select" value={form.mailbox_type}
                       onChange={(e) => set('mailbox_type', e.target.value)}
                       data-testid="cm-field-mailbox-type">
                {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
            <div className="cm-field">
              <label className="cm-label">Provider preset</label>
              <select className="cm-select" value={form.provider_hint}
                       onChange={(e) => applyProvider(e.target.value)}
                       data-testid="cm-field-provider"
                       disabled={editing}>
                {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="cm-row-2">
            <div className="cm-field">
              <label className="cm-label">Nome mittente (From)</label>
              <input className="cm-input" value={form.from_name}
                      onChange={(e) => set('from_name', e.target.value)}
                      placeholder="Studio Rossi" />
            </div>
            <div className="cm-field">
              <label className="cm-label">Indirizzo mittente</label>
              <input className="cm-input" type="email" value={form.from_email}
                      onChange={(e) => set('from_email', e.target.value)}
                      placeholder="projects@studio.it"
                      disabled={editing}
                      data-testid="cm-field-from-email" />
              {errors.from_email && <small style={{ color: 'var(--cm-error)' }}>{errors.from_email}</small>}
            </div>
          </div>
          <div className="cm-field">
            <label className="cm-label">Reply-To (opzionale)</label>
            <input className="cm-input" type="email" value={form.reply_to_email || ''}
                    onChange={(e) => set('reply_to_email', e.target.value)} />
          </div>
        </section>

        {/* IMAP */}
        <section className="cm-drawer-section">
          <h3 className="cm-drawer-section-title">IMAP (lettura)</h3>
          <div className="cm-row-3">
            <div className="cm-field">
              <label className="cm-label">Host</label>
              <input className="cm-input" value={form.imap_host}
                      onChange={(e) => set('imap_host', e.target.value)}
                      data-testid="cm-field-imap-host" />
              {errors.imap_host && <small style={{ color: 'var(--cm-error)' }}>{errors.imap_host}</small>}
            </div>
            <div className="cm-field">
              <label className="cm-label">Porta</label>
              <input className="cm-input" type="number" value={form.imap_port}
                      onChange={(e) => set('imap_port', parseInt(e.target.value, 10) || 993)}
                      data-testid="cm-field-imap-port" />
            </div>
            <div className="cm-field">
              <label className="cm-label">Sicurezza</label>
              <select className="cm-select" value={form.imap_security}
                       onChange={(e) => set('imap_security', e.target.value)}
                       data-testid="cm-field-imap-security">
                {SECURITY.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </div>
          </div>
          <div className="cm-row-2">
            <div className="cm-field">
              <label className="cm-label">Username</label>
              <input className="cm-input" value={form.imap_username}
                      onChange={(e) => set('imap_username', e.target.value)}
                      data-testid="cm-field-imap-username" />
            </div>
            <div className="cm-field">
              <label className="cm-label">Password {editing && <span style={{color:'var(--cm-ink-mute)'}}>(lascia vuoto per non cambiare)</span>}</label>
              <input className="cm-input" type="password"
                      autoComplete="new-password"
                      value={form.imap_password}
                      onChange={(e) => set('imap_password', e.target.value)}
                      data-testid="cm-field-imap-password" />
              {errors.imap_password && <small style={{ color: 'var(--cm-error)' }}>{errors.imap_password}</small>}
            </div>
          </div>
        </section>

        {/* SMTP */}
        <section className="cm-drawer-section">
          <h3 className="cm-drawer-section-title">SMTP (invio)</h3>
          <div className="cm-row-3">
            <div className="cm-field">
              <label className="cm-label">Host</label>
              <input className="cm-input" value={form.smtp_host}
                      onChange={(e) => set('smtp_host', e.target.value)}
                      data-testid="cm-field-smtp-host" />
              {errors.smtp_host && <small style={{ color: 'var(--cm-error)' }}>{errors.smtp_host}</small>}
            </div>
            <div className="cm-field">
              <label className="cm-label">Porta</label>
              <input className="cm-input" type="number" value={form.smtp_port}
                      onChange={(e) => set('smtp_port', parseInt(e.target.value, 10) || 587)}
                      data-testid="cm-field-smtp-port" />
            </div>
            <div className="cm-field">
              <label className="cm-label">Sicurezza</label>
              <select className="cm-select" value={form.smtp_security}
                       onChange={(e) => set('smtp_security', e.target.value)}
                       data-testid="cm-field-smtp-security">
                {SECURITY.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </div>
          </div>
          <div className="cm-row-2">
            <div className="cm-field">
              <label className="cm-label">Username</label>
              <input className="cm-input" value={form.smtp_username}
                      onChange={(e) => set('smtp_username', e.target.value)}
                      data-testid="cm-field-smtp-username" />
            </div>
            <div className="cm-field">
              <label className="cm-label">Password</label>
              <input className="cm-input" type="password"
                      autoComplete="new-password"
                      value={form.smtp_password}
                      onChange={(e) => set('smtp_password', e.target.value)}
                      data-testid="cm-field-smtp-password" />
              {errors.smtp_password && <small style={{ color: 'var(--cm-error)' }}>{errors.smtp_password}</small>}
            </div>
          </div>
        </section>

        {/* Visibilità */}
        <section className="cm-drawer-section">
          <h3 className="cm-drawer-section-title">Visibilità</h3>
          <div className="cm-field">
            <label className="cm-label">Chi può vedere questa mailbox</label>
            <select className="cm-select"
                     value={form.visibility_scope?.mode || 'tenant'}
                     onChange={(e) => set('visibility_scope', { mode: e.target.value })}
                     data-testid="cm-field-visibility">
              {VIS_MODES.map(v => <option key={v.v} value={v.v}>{v.l}</option>)}
            </select>
          </div>
        </section>

        <footer className="cm-drawer-footer">
          {editing && (
            <button type="button" className="cm-btn cm-btn-danger-text"
                     onClick={disable} data-testid="cm-mailbox-disable">
              <Icons.PowerOff size={14} aria-hidden="true" /> Disabilita
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button type="button" className="cm-btn" onClick={onClose}>Annulla</button>
          <button type="button" className="cm-btn cm-btn-primary"
                   onClick={submit} disabled={busy}
                   data-testid="cm-mailbox-submit">
            {busy ? 'Salvataggio…' : (editing ? 'Salva modifiche' : 'Connetti mailbox')}
          </button>
        </footer>
      </aside>
    </div>
  );
}
