/**
 * OwnerIntroductionModal — Phase S.2.
 *
 * Required completion step for tenant owners. Renders inside the
 * Blueprint OS surface; refuses to close while critical fields are
 * missing if `forceComplete` is set.
 *
 * Required fields:
 *   - avatar (jpg/png/webp/gif ≤ 4 MB)
 *   - role label (≤ 80 chars)
 *   - short bio (≤ 240 chars)
 *
 * Optional fields:
 *   - response time label (free text, default suggested)
 *   - contact CTA label
 *
 * Aesthetic — cinematic enterprise (Blueprint OS). No glow, no
 * "AI assistant" copy. Warm, restrained, like a passport photo
 * being taken at a quiet atelier.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';

const BIO_MAX = 240;

const OwnerIntroductionModal = ({
  open, onClose, onComplete, forceComplete = false,
}) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  // Local form state — separate from server profile so the user can
  // edit without us thrashing the network.
  const [form, setForm] = useState({
    role_label: '', short_bio: '', response_time_label: '', contact_cta_label: '',
  });
  const [avatarUrl, setAvatarUrl] = useState('');

  // Load profile on open
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/api/profile/me');
        if (!alive) return;
        const p = data?.profile || {};
        setProfile(p);
        setForm({
          role_label: p.role_label || '',
          short_bio: p.short_bio || '',
          response_time_label: p.response_time_label || 'Risponde in giornata',
          contact_cta_label: p.contact_cta_label || `Scrivi a ${(p.first_name || 'me').trim()}`,
        });
        setAvatarUrl(p.avatar_url || '');
      } catch (_) {
        toast.error('Impossibile caricare il profilo.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open]);

  const uploadAvatar = useCallback(async (file) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error('L\'immagine supera 4 MB.');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    try {
      const { data } = await api.post('/api/profile/me/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAvatarUrl(data?.avatar_url || '');
      toast.success('Foto caricata.');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Upload fallito.');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f) uploadAvatar(f);
  };

  const isComplete = !!(avatarUrl && form.role_label.trim() && form.short_bio.trim());

  const submit = async () => {
    if (!isComplete) {
      toast.error('Compila tutti i campi obbligatori.');
      return;
    }
    setSaving(true);
    try {
      await api.patch('/api/profile/me', {
        role_label: form.role_label,
        short_bio: form.short_bio,
        response_time_label: form.response_time_label || null,
        contact_cta_label: form.contact_cta_label || null,
        avatar_url: avatarUrl,
      });
      // Also mark the onboarding step done (gives an immediate UI signal
      // even before the auto-detector recomputes).
      try { await api.post('/api/tenant-onboarding/mark-done', { key: 'owner_introduced' }); } catch (_) {}
      toast.success('Presentazione salvata.');
      onComplete?.();
      onClose?.();
    } catch (e) {
      toast.error('Salvataggio fallito.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const bioRemaining = BIO_MAX - form.short_bio.length;
  const firstName = profile?.first_name || '';

  return (
    <div
      data-testid="owner-introduction-modal"
      className="fixed inset-0 z-[80] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Presentati ai tuoi clienti"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={forceComplete ? undefined : onClose}
        className="absolute inset-0 bg-black/72 backdrop-blur-sm"
        style={{ cursor: forceComplete ? 'default' : 'pointer' }}
      />

      {/* Card */}
      <div
        className="relative w-[640px] max-w-[92vw] max-h-[92vh] overflow-auto
                   bg-[var(--bp-surface-1)] border border-[var(--bp-border)]
                   rounded-[18px] shadow-2xl"
        data-surface="os"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-8 pt-8 pb-4 border-b border-[var(--bp-border)]/60">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--bp-primary)] mb-3 font-body">
              Profilo personale
            </p>
            <h2 className="font-heading text-[26px] leading-[1.1] text-[var(--bp-text-primary)] tracking-[-0.005em]">
              Presentati ai tuoi clienti.
            </h2>
            <p className="text-[12.5px] text-[var(--bp-text-muted)] font-body mt-2 max-w-[52ch] leading-relaxed">
              Foto, ruolo e bio sono visibili a ogni cliente del tuo studio. È il primo segnale di cura che riceveranno.
            </p>
          </div>
          {!forceComplete && (
            <button
              type="button"
              data-testid="owner-introduction-close"
              onClick={onClose}
              className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors p-1 -mt-2"
              aria-label="Chiudi"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Body */}
        {loading ? (
          <div className="px-8 py-16 flex items-center justify-center text-[var(--bp-text-muted)]">
            <Loader2 className="animate-spin" size={18} />
          </div>
        ) : (
          <div className="px-8 py-7 space-y-7">
            {/* Avatar */}
            <div className="flex items-center gap-6">
              <AvatarSlot
                url={avatarUrl}
                firstName={firstName}
                uploading={uploading}
                onClick={() => fileRef.current?.click()}
              />
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] mb-1">
                  Foto profilo · obbligatoria
                </p>
                <p className="text-[12.5px] text-[var(--bp-text-secondary)] leading-relaxed max-w-[40ch] font-body">
                  JPG, PNG o WebP · max 4 MB · meglio se quadrata.
                </p>
                <button
                  type="button"
                  data-testid="owner-introduction-upload"
                  onClick={() => fileRef.current?.click()}
                  className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px]
                             border border-[var(--bp-border-strong)] text-[11px] uppercase tracking-[0.18em]
                             text-[var(--bp-text-secondary)] hover:text-[var(--bp-text-primary)]
                             hover:border-[var(--bp-border-hover)] transition-colors"
                  disabled={uploading}
                >
                  <Camera size={12} strokeWidth={1.5} />
                  {avatarUrl ? 'Sostituisci foto' : 'Carica foto'}
                </button>
                <input
                  ref={fileRef}
                  data-testid="owner-introduction-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFile}
                />
              </div>
            </div>

            {/* Role label */}
            <Field
              label="Ruolo nello studio · obbligatorio"
              hint="Es. Founder · Interior Designer · Project Manager"
              value={form.role_label}
              onChange={(v) => setForm((s) => ({ ...s, role_label: v }))}
              testid="owner-introduction-role"
              max={80}
            />

            {/* Bio */}
            <div>
              <FieldHead label="Bio breve · obbligatoria" hint="Cosa vuoi che il cliente sappia di te." />
              <textarea
                data-testid="owner-introduction-bio"
                value={form.short_bio}
                onChange={(e) => setForm((s) => ({ ...s, short_bio: e.target.value.slice(0, BIO_MAX) }))}
                rows={3}
                className="w-full bg-[var(--bp-surface-2)] border border-[var(--bp-border)]
                           rounded-[10px] px-4 py-3 text-[13px] text-[var(--bp-text-primary)]
                           font-body leading-relaxed focus:outline-none focus:border-[var(--bp-border-hover)]
                           transition-colors resize-none"
                placeholder="Ad esempio: Sono qui per accompagnarti nelle prime fasi del progetto…"
              />
              <p className={`text-[10px] mt-1 text-right font-mono tracking-[0.06em]
                            ${bioRemaining < 20 ? 'text-amber-300' : 'text-[var(--bp-text-faint)]'}`}>
                {form.short_bio.length}/{BIO_MAX}
              </p>
            </div>

            {/* Optional polish */}
            <details className="group">
              <summary className="cursor-pointer text-[11px] uppercase tracking-[0.18em] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors select-none">
                Personalizza messaggi · opzionale
              </summary>
              <div className="mt-4 space-y-4">
                <Field
                  label="Tempo di risposta"
                  hint="Visibile sotto il tuo nome nella Human Card."
                  value={form.response_time_label}
                  onChange={(v) => setForm((s) => ({ ...s, response_time_label: v }))}
                  testid="owner-introduction-response"
                  max={80}
                />
                <Field
                  label="Etichetta CTA"
                  hint="Es. 'Scrivi a Stefano'. Default ricavato dal nome."
                  value={form.contact_cta_label}
                  onChange={(v) => setForm((s) => ({ ...s, contact_cta_label: v }))}
                  testid="owner-introduction-cta"
                  max={80}
                />
              </div>
            </details>
          </div>
        )}

        {/* Footer */}
        <div className="px-8 py-5 border-t border-[var(--bp-border)]/60 flex items-center justify-between gap-4 bg-[var(--bp-surface-2)]/30">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--bp-text-faint)]">
            {isComplete ? 'Pronto · clienti vedranno la tua presentazione' : 'Completa i campi obbligatori per pubblicare'}
          </p>
          <div className="flex items-center gap-2">
            {!forceComplete && (
              <button
                type="button"
                data-testid="owner-introduction-skip"
                onClick={onClose}
                className="px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors"
              >
                Più tardi
              </button>
            )}
            <button
              type="button"
              data-testid="owner-introduction-save"
              onClick={submit}
              disabled={!isComplete || saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[8px]
                         bg-[var(--bp-primary)] text-black text-[11px] uppercase tracking-[0.18em]
                         font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed
                         transition-opacity"
            >
              {saving ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} strokeWidth={2.4} />}
              Salva e pubblica
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── building blocks ────────────────────────────────────────────── */

const AvatarSlot = ({ url, firstName, uploading, onClick }) => {
  const initials = (firstName || '·')[0]?.toUpperCase();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={uploading}
      data-testid="owner-introduction-avatar-slot"
      className="relative w-[112px] h-[112px] rounded-full overflow-hidden
                 bg-[var(--bp-surface-2)] border-2 border-[var(--bp-border-strong)]
                 hover:border-[var(--bp-primary)] transition-colors group flex items-center justify-center"
    >
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="font-heading text-[44px] text-[var(--bp-text-muted)] group-hover:text-[var(--bp-text-primary)] transition-colors">
          {initials}
        </span>
      )}
      {/* Overlay on hover */}
      <span className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
        {uploading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={18} strokeWidth={1.5} />}
      </span>
    </button>
  );
};

const FieldHead = ({ label, hint }) => (
  <div className="mb-2">
    <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)]">{label}</p>
    {hint && <p className="text-[11px] text-[var(--bp-text-faint)] mt-0.5 font-body">{hint}</p>}
  </div>
);

const Field = ({ label, hint, value, onChange, testid, max }) => (
  <div>
    <FieldHead label={label} hint={hint} />
    <input
      data-testid={testid}
      type="text"
      value={value}
      onChange={(e) => onChange(max ? e.target.value.slice(0, max) : e.target.value)}
      className="w-full bg-[var(--bp-surface-2)] border border-[var(--bp-border)]
                 rounded-[10px] px-4 py-2.5 text-[13px] text-[var(--bp-text-primary)]
                 font-body focus:outline-none focus:border-[var(--bp-border-hover)] transition-colors"
    />
  </div>
);

export default OwnerIntroductionModal;
