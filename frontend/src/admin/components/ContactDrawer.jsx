/**
 * ContactDrawer — create/edit a tenant_contact (M1).
 * Catalog-driven roles, languages, sources. Optional owner picker (admin only).
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X, Save, Phone, Mail, MessageCircle, Linkedin, StickyNote } from 'lucide-react';
import useCatalog from '../../lib/useCatalog';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const QUICK = [
  { code: 'call',          icon: Phone,        label: 'Call' },
  { code: 'email',         icon: Mail,         label: 'Email' },
  { code: 'whatsapp',      icon: MessageCircle,label: 'WhatsApp' },
  { code: 'linkedin',      icon: Linkedin,     label: 'LinkedIn' },
  { code: 'internal_note', icon: StickyNote,   label: 'Note' },
];

const ContactDrawer = ({ tenantId, contact, onClose, onSaved, adminMode = true, apiBase }) => {
  const roles     = useCatalog('contact-roles');
  const languages = useCatalog('languages');
  const sources   = useCatalog('contact-sources');
  const isNew = !contact?.id;
  const base = apiBase || `${BACKEND}/api/admin/tenants/${tenantId}`;

  const [form, setForm] = useState(() => ({
    first_name: contact?.first_name || '',
    last_name:  contact?.last_name  || '',
    role_code:  contact?.role_code  || 'founder',
    email:      contact?.email      || '',
    phone_prefix: contact?.phone_prefix || '+39',
    phone_number: contact?.phone_number || '',
    linkedin_url: contact?.linkedin_url || '',
    preferred_language: contact?.preferred_language || 'it-IT',
    notes:      contact?.notes      || '',
    is_primary: contact?.is_primary || false,
    source_code: contact?.source_code || 'manual',
    source_reference: contact?.source_reference || '',
    relationship_owner_user_id: contact?.relationship_owner_user_id || null,
  }));
  const [eligibleOwners, setEligibleOwners] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [activityFor, setActivityFor] = useState(null);   // {code}
  const [activitySubject, setActivitySubject] = useState('');
  const [activityOutcome, setActivityOutcome] = useState('');

  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem('mood_auth_token') || ''}`,
  });

  useEffect(() => {
    if (!adminMode) return;
    axios.get(`${BACKEND}/api/admin/users/eligible-owners?limit=100`,
              { headers: headers() })
      .then((r) => setEligibleOwners(r.data || []))
      .catch(() => setEligibleOwners([]));
  }, [adminMode]);

  const set = (k, v) => setForm({ ...form, [k]: v });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const payload = { ...form };
        if (!adminMode) {
          delete payload.relationship_owner_user_id;
        }
        const r = await axios.post(base + '/contacts', payload, { headers: headers() });
        onSaved && onSaved(r.data);
      } else {
        const r = await axios.patch(`${base}/contacts/${contact.id}`, form,
                                     { headers: headers() });
        onSaved && onSaved(r.data);
      }
      onClose && onClose();
    } catch (e) {
      const d = e?.response?.data?.detail;
      if (d?.code === 'duplicate_email') {
        setError('Esiste già un contatto attivo con questa email.');
      } else {
        setError(typeof d === 'string' ? d : 'Errore salvataggio.');
      }
    } finally {
      setSaving(false);
    }
  };

  const doQuickAction = async () => {
    const code = activityFor?.code;
    if (!code) return;
    try {
      await axios.post(base + '/activities/quick', {
        activity_type_code: code,
        subject: activitySubject,
        outcome: activityOutcome,
        contact_id: contact?.id || null,
      }, { headers: headers() });
      setActivityFor(null);
      setActivitySubject('');
      setActivityOutcome('');
      onSaved && onSaved(null);
    } catch (e) {
      setError('Errore registrazione attività.');
    }
  };

  return (
    <div data-testid="contact-drawer" className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl">
        <header className="px-6 py-5 border-b border-stone-200 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-stone-400">
              {isNew ? 'Nuovo contatto' : 'Modifica contatto'}
            </div>
            <h2 className="text-xl mt-1">
              {form.first_name || form.last_name
                ? `${form.first_name} ${form.last_name}`.trim()
                : 'Senza nome'}
            </h2>
          </div>
          <button onClick={onClose} data-testid="contact-drawer-close"
                  className="text-stone-400 hover:text-stone-900">
            <X size={20} />
          </button>
        </header>

        <div className="px-6 py-5 space-y-6">
          {error && (
            <div data-testid="contact-drawer-error"
                 className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
              {error}
            </div>
          )}

          {/* IDENTITY */}
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-stone-400 mb-3">Identity</h3>
            <div className="grid grid-cols-2 gap-3">
              <input data-testid="contact-first-name" placeholder="Nome" className="border border-stone-300 px-3 py-2 text-sm"
                     value={form.first_name} onChange={(e) => set('first_name', e.target.value)} />
              <input data-testid="contact-last-name" placeholder="Cognome" className="border border-stone-300 px-3 py-2 text-sm"
                     value={form.last_name} onChange={(e) => set('last_name', e.target.value)} />
              <select data-testid="contact-role" className="border border-stone-300 px-3 py-2 text-sm col-span-2"
                      value={form.role_code} onChange={(e) => set('role_code', e.target.value)}>
                {roles.map((r) => <option key={r.code} value={r.code}>{r.label_it}</option>)}
              </select>
              <select data-testid="contact-language" className="border border-stone-300 px-3 py-2 text-sm col-span-2"
                      value={form.preferred_language || ''} onChange={(e) => set('preferred_language', e.target.value || null)}>
                <option value="">Lingua preferita…</option>
                {languages.map((l) => <option key={l.code} value={l.code}>{l.name_native}</option>)}
              </select>
            </div>
          </section>

          {/* CONTATTI */}
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-stone-400 mb-3">Contatti</h3>
            <div className="grid grid-cols-2 gap-3">
              <input data-testid="contact-email" placeholder="Email" className="col-span-2 border border-stone-300 px-3 py-2 text-sm"
                     value={form.email} onChange={(e) => set('email', e.target.value)} />
              <input data-testid="contact-phone-prefix" placeholder="+39" className="border border-stone-300 px-3 py-2 text-sm"
                     value={form.phone_prefix} onChange={(e) => set('phone_prefix', e.target.value)} />
              <input data-testid="contact-phone-number" placeholder="Telefono" className="border border-stone-300 px-3 py-2 text-sm"
                     value={form.phone_number} onChange={(e) => set('phone_number', e.target.value)} />
              <input data-testid="contact-linkedin" placeholder="LinkedIn URL" className="col-span-2 border border-stone-300 px-3 py-2 text-sm"
                     value={form.linkedin_url} onChange={(e) => set('linkedin_url', e.target.value)} />
            </div>
          </section>

          {/* RELATIONSHIP */}
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-stone-400 mb-3">Relationship</h3>
            <label className="flex items-center gap-2 mb-3 text-sm">
              <input data-testid="contact-is-primary" type="checkbox"
                     checked={form.is_primary} onChange={(e) => set('is_primary', e.target.checked)} />
              Imposta come <strong>primary contact</strong>
            </label>
            {adminMode && (
              <select data-testid="contact-owner"
                      className="w-full border border-stone-300 px-3 py-2 text-sm"
                      value={form.relationship_owner_user_id || ''}
                      onChange={(e) => set('relationship_owner_user_id', e.target.value || null)}>
                <option value="">— Nessun relationship owner —</option>
                {eligibleOwners.map((u) => (
                  <option key={u.id} value={u.id}>{u.display} ({u.role})</option>
                ))}
              </select>
            )}
            <select data-testid="contact-source"
                    className="w-full border border-stone-300 px-3 py-2 text-sm mt-3"
                    value={form.source_code || 'manual'}
                    onChange={(e) => set('source_code', e.target.value)}>
              {sources.map((s) => <option key={s.code} value={s.code}>{s.label_it}</option>)}
            </select>
          </section>

          {/* NOTE */}
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-stone-400 mb-3">Note</h3>
            <textarea data-testid="contact-notes"
                      rows={3}
                      className="w-full border border-stone-300 px-3 py-2 text-sm"
                      value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </section>

          {/* QUICK ACTIONS (only for existing contact) */}
          {!isNew && (
            <section className="border-t border-stone-100 pt-5">
              <h3 className="text-[10px] uppercase tracking-wider text-stone-400 mb-3">Quick Actions</h3>
              <div className="grid grid-cols-5 gap-2">
                {QUICK.map(({ code, icon: Icon, label }) => (
                  <button key={code}
                          data-testid={`qa-${code}`}
                          onClick={() => setActivityFor({ code, label })}
                          className="flex flex-col items-center gap-1 border border-stone-200 px-2 py-3 text-[10px] uppercase tracking-wide hover:bg-stone-50">
                    <Icon size={14} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {activityFor && (
                <div data-testid="quick-action-modal" className="mt-4 border border-stone-200 bg-stone-50 p-4">
                  <div className="text-sm font-medium mb-2">
                    Registra: {activityFor.label}
                  </div>
                  <input placeholder="Oggetto…" data-testid="qa-subject"
                         className="w-full border border-stone-300 px-3 py-2 text-sm mb-2"
                         value={activitySubject}
                         onChange={(e) => setActivitySubject(e.target.value)} />
                  <textarea placeholder="Esito breve…" data-testid="qa-outcome" rows={2}
                            className="w-full border border-stone-300 px-3 py-2 text-sm mb-2"
                            value={activityOutcome}
                            onChange={(e) => setActivityOutcome(e.target.value)} />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setActivityFor(null)}
                            className="px-3 py-1 text-xs">Annulla</button>
                    <button onClick={doQuickAction}
                            data-testid="qa-submit"
                            className="px-4 py-1 text-xs bg-black text-white">
                      Salva attività
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        <footer className="sticky bottom-0 bg-white px-6 py-4 border-t border-stone-200 flex justify-end gap-3">
          <button data-testid="contact-cancel" onClick={onClose}
                  className="px-4 py-2 text-sm">
            Annulla
          </button>
          <button data-testid="contact-save" onClick={save} disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-black text-white disabled:opacity-50">
            <Save size={14} />
            {saving ? 'Salvataggio…' : 'Salva contatto'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ContactDrawer;
