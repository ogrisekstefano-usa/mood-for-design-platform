/**
 * EmailIdentityPage · ITER173 · P1.4
 *
 * Admin form per configurare il sender_name / sender_email / reply_to /
 * signature del tenant corrente. Storage: tenant_settings.email_identity
 * (via /api/admin/tenant/email-identity).
 */
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Save, Mail, AtSign, MessageSquare, User } from 'lucide-react';
import api from '../../lib/api';

const Field = ({ label, hint, icon: Icon, children }) => (
  <label className="block mb-5">
    <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-bronze-400 mb-2">
      {Icon && <Icon size={12} strokeWidth={1.5} />} {label}
    </span>
    {children}
    {hint && <span className="block text-[12px] text-white/45 mt-1.5 italic">{hint}</span>}
  </label>
);

const EmailIdentityPage = () => {
  const [stored, setStored] = useState({ sender_name: '', sender_email: '', reply_to: '', signature: '' });
  const [resolved, setResolved] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchIdentity = () => {
    return api.get('/api/admin/tenant/email-identity')
      .then((r) => {
        setStored({
          sender_name:  r.data?.stored?.sender_name || '',
          sender_email: r.data?.stored?.sender_email || '',
          reply_to:     r.data?.stored?.reply_to || '',
          signature:    r.data?.stored?.signature || '',
        });
        setResolved(r.data?.resolved || null);
      });
  };

  useEffect(() => {
    fetchIdentity().finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      await api.put('/api/admin/tenant/email-identity', stored);
      await fetchIdentity();
      toast.success('Email identity salvata. Tutte le email future useranno questa configurazione.');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Salvataggio non riuscito.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-white/60" data-testid="email-identity-loading">Caricamento…</div>;
  }

  return (
    <div className="p-8 max-w-3xl" data-testid="email-identity-page">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.32em] text-bronze-400 mb-2">Communication · Email Identity</p>
        <h1 className="text-3xl font-serif italic text-white">Da chi arrivano le tue email</h1>
        <p className="text-white/55 mt-3 max-w-xl">
          Tutte le email automatiche (Magic Link, notifiche, conferme di
          appuntamento, recall) verranno inviate usando questa identità.
          Se un campo è vuoto, useremo la configurazione di piattaforma come
          fallback sicuro.
        </p>
      </header>

      {/* Resolved card */}
      {resolved && (
        <div className="bg-white/[0.03] border border-white/10 rounded-lg p-5 mb-8" data-testid="email-identity-resolved">
          <p className="text-[10px] uppercase tracking-[0.28em] text-bronze-400 mb-3">Identità attualmente in uso</p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
            <div><dt className="text-white/45 text-xs">From</dt><dd className="text-white/90">{resolved.from_address}</dd></div>
            <div><dt className="text-white/45 text-xs">Reply-To</dt><dd className="text-white/90">{resolved.reply_to}</dd></div>
            <div className="sm:col-span-2"><dt className="text-white/45 text-xs">Firma</dt><dd className="text-white/90 italic">{resolved.signature || '—'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-white/45 text-xs">Sorgente</dt><dd>
              <span className="inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-bronze-500/15 text-bronze-300">
                {resolved.source}
              </span>
            </dd></div>
          </dl>
        </div>
      )}

      <form onSubmit={handleSave}>
        <Field label="Sender Name" icon={User} hint='Es: "MOOD for DESIGN". Compare nel campo "Da:" delle email.'>
          <input
            data-testid="email-identity-sender-name"
            type="text"
            value={stored.sender_name}
            onChange={(e) => setStored({ ...stored, sender_name: e.target.value })}
            className="w-full bg-black/40 border border-white/15 rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-bronze-400 transition-colors"
            placeholder="MOOD for DESIGN"
          />
        </Field>

        <Field label="Sender Email" icon={AtSign} hint="Es: hello@moodfordesign.com. Deve essere un dominio verificato in Resend.">
          <input
            data-testid="email-identity-sender-email"
            type="email"
            value={stored.sender_email}
            onChange={(e) => setStored({ ...stored, sender_email: e.target.value })}
            className="w-full bg-black/40 border border-white/15 rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-bronze-400 transition-colors"
            placeholder="hello@moodfordesign.com"
          />
        </Field>

        <Field label="Reply-To" icon={Mail} hint="Indirizzo a cui rispondono i tuoi clienti. Es: info@moodfordesign.com.">
          <input
            data-testid="email-identity-reply-to"
            type="email"
            value={stored.reply_to}
            onChange={(e) => setStored({ ...stored, reply_to: e.target.value })}
            className="w-full bg-black/40 border border-white/15 rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-bronze-400 transition-colors"
            placeholder="info@moodfordesign.com"
          />
        </Field>

        <Field label="Signature" icon={MessageSquare} hint='Firma editoriale in fondo a ogni email. Es: "Il team MOOD for DESIGN".'>
          <textarea
            data-testid="email-identity-signature"
            rows={3}
            value={stored.signature}
            onChange={(e) => setStored({ ...stored, signature: e.target.value })}
            className="w-full bg-black/40 border border-white/15 rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-bronze-400 transition-colors resize-y"
            placeholder="Il team MOOD for DESIGN"
          />
        </Field>

        <div className="mt-8 flex items-center gap-4">
          <button
            data-testid="email-identity-save"
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-bronze-500 hover:bg-bronze-400 text-black rounded text-xs uppercase tracking-[0.18em] font-medium transition-colors disabled:opacity-40"
          >
            <Save size={14} strokeWidth={1.6} />
            {saving ? 'Salvataggio…' : 'Salva'}
          </button>
          <span className="text-[12px] text-white/45 italic">
            Le modifiche entrano in vigore immediatamente sulle prossime email inviate.
          </span>
        </div>
      </form>
    </div>
  );
};

export default EmailIdentityPage;
