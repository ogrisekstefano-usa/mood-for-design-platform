/**
 * ITER143D · ResetPasswordPage.
 *
 * Lands here after AuthCallbackPage hands over a session via URL hash.
 * The user picks a new password; we call Supabase's
 *   PUT /auth/v1/user
 * with the bearer token to update the password, then push the user to
 * the tenant-aware /auth/login.
 *
 * Cinematic style: matches the Blueprint Command Center™ DNA — black
 * glass, cyan accent, italic Cormorant title.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';
const SUPABASE_ANON = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const STORAGE_KEY = 'mfd_session';

function _readHashSession() {
  const h = (window.location.hash || '').replace(/^#/, '');
  if (!h) return null;
  const p = new URLSearchParams(h);
  const access_token = p.get('access_token');
  if (!access_token) return null;
  return {
    access_token,
    refresh_token: p.get('refresh_token') || '',
    token_type:    p.get('token_type') || 'bearer',
    expires_in:    Number(p.get('expires_in') || 3600),
    type:          p.get('type') || 'recovery',
  };
}

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If the hash carries a session (cross-origin hand-over from
    // AuthCallbackPage), install it before anything else.
    const s = _readHashSession();
    if (s) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          access_token: s.access_token,
          refresh_token: s.refresh_token,
          token_type: s.token_type,
          expires_in: s.expires_in,
        }));
      } catch (_) {}
      // Strip the hash so the token doesn't linger in the URL bar.
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
    }
    let token = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      token = raw ? JSON.parse(raw)?.access_token : null;
    } catch (_) { /* ignore */ }
    if (!token) {
      setError('Sessione non valida. Apri di nuovo l’email di reset.');
      return;
    }
    setReady(true);
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('La password deve contenere almeno 8 caratteri.');
      return;
    }
    if (password !== confirm) {
      toast.error('Le due password non coincidono.');
      return;
    }
    setBusy(true);
    try {
      let token = null;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        token = raw ? JSON.parse(raw)?.access_token : null;
      } catch (_) {}
      if (!SUPABASE_URL || !SUPABASE_ANON) {
        toast.error('Configurazione mancante.');
        setBusy(false);
        return;
      }
      await axios.put(`${SUPABASE_URL}/auth/v1/user`,
        { password },
        {
          headers: {
            apikey: SUPABASE_ANON,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      toast('Password aggiornata. Apriamo il tuo spazio…');
      // ITER161 · P0.1 · Role-aware post-reset redirect.
      // Mai più "homepage Blueprint" generica: chiediamo al backend
      // qual è la destinazione corretta (client → /client, ecc).
      let dest = '/dashboard';
      try {
        const BACKEND = process.env.REACT_APP_BACKEND_URL || '';
        const me = await axios.get(`${BACKEND}/api/auth/resolve-post-login`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (me?.data?.redirect_to) dest = me.data.redirect_to;
      } catch (_) { /* fall back to /dashboard */ }
      setTimeout(() => navigate(dest, { replace: true }), 800);
    } catch (e2) {
      toast.error(e2?.response?.data?.msg || e2.message || 'Errore inatteso.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="reset-password-page"
         style={{ minHeight: '100vh', display: 'grid', placeItems: 'center',
                  background: '#050608', color: '#e8ebf0',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <form onSubmit={onSubmit}
            style={{ maxWidth: 420, width: '100%', padding: 36,
                     background: 'rgba(14,16,20,0.78)',
                     border: '1px solid rgba(232,235,240,0.06)',
                     borderRadius: 12, backdropFilter: 'blur(18px)' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.32em', textTransform: 'uppercase',
                      color: '#7ce4f5', opacity: 0.85, marginBottom: 14 }}>
          MOOD · Reset Password
        </div>
        <h1 style={{ fontFamily: 'Georgia, "Cormorant Garamond", serif',
                     fontStyle: 'italic', fontSize: 28, lineHeight: 1.2,
                     margin: '0 0 22px' }}>
          Scegli la tua nuova password.
        </h1>

        {error ? (
          <div style={{ color: '#f3a8a8', fontSize: 13, marginBottom: 16 }}>{error}</div>
        ) : null}

        <label style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
                        color: 'rgba(232,235,240,0.5)' }}>
          Nuova password
        </label>
        <input data-testid="rp-new-password"
               type="password" value={password}
               onChange={(e) => setPassword(e.target.value)}
               disabled={!ready || busy}
               required minLength={8}
               style={inputStyle} />

        <label style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
                        color: 'rgba(232,235,240,0.5)', marginTop: 18, display: 'block' }}>
          Conferma password
        </label>
        <input data-testid="rp-confirm-password"
               type="password" value={confirm}
               onChange={(e) => setConfirm(e.target.value)}
               disabled={!ready || busy}
               required minLength={8}
               style={inputStyle} />

        <button data-testid="rp-submit"
                disabled={!ready || busy}
                type="submit"
                style={{ marginTop: 22, width: '100%',
                         padding: '12px 18px', fontSize: 12,
                         letterSpacing: '0.16em', textTransform: 'uppercase',
                         background: '#7ce4f5', color: '#050608',
                         border: 'none', borderRadius: 8, cursor: 'pointer',
                         fontWeight: 600 }}>
          {busy ? 'Aggiorno…' : 'Aggiorna password'}
        </button>
      </form>
    </div>
  );
};

const inputStyle = {
  width: '100%', marginTop: 6, padding: '11px 13px',
  background: 'rgba(8,10,13,0.6)',
  border: '1px solid rgba(232,235,240,0.08)',
  borderRadius: 8, color: '#e8ebf0',
  fontSize: 14, outline: 'none',
};

export default ResetPasswordPage;
