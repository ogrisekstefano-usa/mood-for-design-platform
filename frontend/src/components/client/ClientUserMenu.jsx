/**
 * ClientUserMenu — avatar dropdown for the Client Portal.
 *
 * Replaces the static avatar chip in ClientDashboardLayout.
 * Provides:
 *   - Profile photo upload (POST /api/profile/me/avatar)
 *   - Personal data editing (first_name, last_name, role_label, short_bio)
 *   - Logout
 *
 * Visual: client theme (gold accent, warm graphite, no cyan).
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { LogOut, Camera, Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';

const initialsOf = (user) => {
  if (!user) return '·';
  const fn = (user.first_name || '').trim();
  const ln = (user.last_name || '').trim();
  if (fn || ln) return ((fn[0] || '') + (ln[0] || '')).toUpperCase();
  return (user.email || '·')[0].toUpperCase();
};

const ClientUserMenu = () => {
  const { user, signOut, refreshSession } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    role_label: user?.role_label || '',
    short_bio: user?.short_bio || '',
  });
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || null);
  const fileRef = useRef(null);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  // Hydrate from /api/profile/me so we have all fields
  useEffect(() => {
    if (!open) return undefined;
    (async () => {
      try {
        const { data } = await api.get('/api/profile/me');
        const p = data?.profile || {};
        setForm({
          first_name: p.first_name || '',
          last_name: p.last_name || '',
          role_label: p.role_label || '',
          short_bio: p.short_bio || '',
        });
        setAvatarUrl(p.avatar_url || null);
      } catch (_) { /* silent */ }
    })();
    return undefined;
  }, [open]);

  // Click outside / Esc to close
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  // Position the dropdown anchored to the trigger (via portal)
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 10, right: Math.max(16, window.innerWidth - r.right) });
  }, [open]);

  const handleAvatarPick = () => fileRef.current?.click();

  const handleAvatarUpload = async (e) => {
    const file = e.target?.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error('La foto deve essere sotto 4 MB.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/api/profile/me/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = data?.profile?.avatar_url || data?.avatar_url;
      if (url) {
        setAvatarUrl(url);
        toast.success('Foto profilo aggiornata.');
        try { await refreshSession?.(); } catch {}
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Caricamento foto non riuscito.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, v]) => (v || '').toString().trim().length > 0),
      );
      await api.patch('/api/profile/me', payload);
      toast.success('Dati personali aggiornati.');
      setEditing(false);
      try { await refreshSession?.(); } catch {}
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Aggiornamento non riuscito.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setOpen(false);
    await signOut();
    navigate('/auth/login');
  };

  const fullName = (form.first_name && `${form.first_name} ${form.last_name || ''}`.trim())
    || user?.email?.split('@')[0]
    || 'Cliente';

  return (
    <>
      {/* Trigger — sits in the topbar */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="client-user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-9 h-9 rounded-full bg-[var(--cp-surface-2)]
                   border border-[var(--cp-border)]
                   flex items-center justify-center overflow-hidden
                   hover:border-[var(--cp-gold)] transition-colors
                   text-[12px] tracking-[0.08em] text-[var(--cp-gold-soft)]
                   font-body uppercase"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={fullName}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          initialsOf({ ...user, ...form })
        )}
      </button>

      {/* Dropdown — via portal so it never gets clipped by transforms */}
      {open && createPortal(
        <div
          ref={wrapRef}
          role="menu"
          data-testid="client-user-menu"
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 10006 }}
          className="w-[320px] rounded-[8px] border border-[var(--cp-border)]
                     bg-[var(--cp-bg)] shadow-2xl py-2"
        >
          {/* Avatar header */}
          <div className="px-4 pt-3 pb-4 border-b border-[var(--cp-border)] flex items-start gap-3">
            <div className="relative shrink-0">
              <div className="w-14 h-14 rounded-full bg-[var(--cp-surface-2)]
                              border border-[var(--cp-border)] overflow-hidden
                              flex items-center justify-center
                              text-[18px] text-[var(--cp-gold-soft)] font-body uppercase">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                ) : (
                  initialsOf({ ...user, ...form })
                )}
              </div>
              <button
                type="button"
                onClick={handleAvatarPick}
                disabled={uploading}
                data-testid="client-user-menu-upload-photo"
                className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full
                           bg-[var(--cp-gold)] text-[#0a0807]
                           flex items-center justify-center
                           border-2 border-[var(--cp-bg)]
                           hover:scale-105 transition-transform disabled:opacity-60"
                title="Carica foto profilo"
              >
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} strokeWidth={2} />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleAvatarUpload}
                className="hidden"
                data-testid="client-user-menu-photo-input"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-heading text-[16px] text-[var(--cp-text-primary)] truncate">
                {fullName}
              </p>
              <p className="text-[11.5px] text-[var(--cp-text-muted)] truncate">{user?.email}</p>
              {form.role_label && (
                <p className="mt-1 text-[10px] tracking-[0.18em] uppercase text-[var(--cp-gold-soft)] truncate">
                  {form.role_label}
                </p>
              )}
            </div>
          </div>

          {/* Personal data — view or edit */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--cp-text-muted)] font-mono">
                Dati personali
              </p>
              {!editing ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  data-testid="client-user-menu-edit"
                  className="text-[11px] text-[var(--cp-gold)] hover:text-[var(--cp-gold-soft)] tracking-wide"
                >
                  Modifica
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    disabled={saving}
                    className="w-6 h-6 rounded-full border border-[var(--cp-border)]
                               flex items-center justify-center text-[var(--cp-text-muted)]
                               hover:text-[var(--cp-text-primary)]"
                    title="Annulla"
                  >
                    <X size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    data-testid="client-user-menu-save"
                    className="w-6 h-6 rounded-full bg-[var(--cp-gold)] text-[#0a0807]
                               flex items-center justify-center disabled:opacity-60"
                    title="Salva"
                  >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} strokeWidth={2.5} />}
                  </button>
                </div>
              )}
            </div>

            {editing ? (
              <div className="space-y-2">
                <Field label="Nome" testid="client-field-first_name"
                  value={form.first_name}
                  onChange={(v) => setForm((f) => ({ ...f, first_name: v }))} />
                <Field label="Cognome" testid="client-field-last_name"
                  value={form.last_name}
                  onChange={(v) => setForm((f) => ({ ...f, last_name: v }))} />
                <Field label="Ruolo / titolo" testid="client-field-role_label"
                  value={form.role_label}
                  onChange={(v) => setForm((f) => ({ ...f, role_label: v }))} />
                <Field label="Breve descrizione" multiline testid="client-field-short_bio"
                  value={form.short_bio}
                  onChange={(v) => setForm((f) => ({ ...f, short_bio: v }))} />
              </div>
            ) : (
              <div className="space-y-1.5 text-[12.5px] text-[var(--cp-text-secondary)]">
                <Row label="Nome" value={form.first_name || '—'} />
                <Row label="Cognome" value={form.last_name || '—'} />
                <Row label="Email"  value={user?.email || '—'} />
                {form.role_label && <Row label="Ruolo" value={form.role_label} />}
                {form.short_bio && <Row label="Bio" value={form.short_bio} />}
              </div>
            )}
          </div>

          {/* Logout */}
          <div className="border-t border-[var(--cp-border)] mt-1 pt-1 px-1.5">
            <button
              type="button"
              onClick={handleLogout}
              data-testid="client-user-menu-logout"
              className="w-full flex items-center gap-3 px-3 py-2 text-[12.5px] rounded-[4px]
                         text-[var(--cp-text-secondary)] hover:text-red-400 hover:bg-red-500/10
                         transition-colors text-left"
            >
              <LogOut size={13} strokeWidth={1.6} className="flex-shrink-0" />
              <span className="font-body tracking-wide">Esci</span>
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};

const Field = ({ label, value, onChange, multiline = false, testid }) => (
  <label className="block">
    <span className="text-[10px] tracking-[0.15em] uppercase text-[var(--cp-text-muted)] font-mono block mb-0.5">
      {label}
    </span>
    {multiline ? (
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        data-testid={testid}
        className="w-full bg-[var(--cp-surface-2)] border border-[var(--cp-border)] rounded-[4px]
                   px-2.5 py-1.5 text-[12px] text-[var(--cp-text-primary)] font-body
                   resize-none outline-none focus:border-[var(--cp-gold)]"
      />
    ) : (
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testid}
        className="w-full bg-[var(--cp-surface-2)] border border-[var(--cp-border)] rounded-[4px]
                   px-2.5 py-1.5 text-[12.5px] text-[var(--cp-text-primary)] font-body
                   outline-none focus:border-[var(--cp-gold)]"
      />
    )}
  </label>
);

const Row = ({ label, value }) => (
  <div className="flex items-baseline gap-2">
    <span className="text-[10px] tracking-[0.15em] uppercase text-[var(--cp-text-muted)] font-mono w-16 shrink-0">
      {label}
    </span>
    <span className="text-[12.5px] text-[var(--cp-text-primary)] truncate">{value}</span>
  </div>
);

export default ClientUserMenu;
