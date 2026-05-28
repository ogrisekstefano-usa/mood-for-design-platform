/**
 * AuthRecoveryPage · ITER166 · P0.1
 *
 * Magic-link errors (otp_expired, access_denied, invalid_token) catturati
 * elegantemente. Mai messaggi Supabase raw.
 *
 * Coerente col preset Chameleon™ (palette bronze/cream).
 */
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Mail, KeyRound, RefreshCw, Check } from 'lucide-react';
import axios from 'axios';
import './AuthRecoveryPage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const AuthRecoveryPage = () => {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [busy, setBusy]   = useState(false);
  const [sent, setSent]   = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // pre-fill from query if available
    const e = search.get('email');
    if (e) setEmail(e);
  }, [search]);

  const sendNew = async (e) => {
    e?.preventDefault?.();
    if (!email || !/.+@.+\..+/.test(email)) return;
    setBusy(true);
    try {
      await axios.post(`${BACKEND_URL}/api/auth/silent-magic-link`, {
        email: email.toLowerCase().trim(),
        next: '/client/welcome',
      });
    } catch (_) { /* opaque */ }
    setBusy(false);
    setSent(true);
  };

  return (
    <div className={`jp-shell ${mounted ? 'is-in' : ''}`} data-testid="auth-recovery-page">
      <div className="jp-bg" aria-hidden>
        <div className="jp-bg__halo" />
        <div className="jp-bg__halo jp-bg__halo--alt" />
        <div className="jp-bg__grain" />
      </div>

      <main className="jp-inner">
        <div className="jp-mark" aria-hidden><span /><span /></div>

        <p className="jp-eyebrow" data-testid="auth-recovery-eyebrow">
          Accesso personale
        </p>
        <h1 className="jp-title" data-testid="auth-recovery-title">
          Il tuo accesso personale<br/>è stato <em>aggiornato</em>.
        </h1>
        <p className="jp-lede" data-testid="auth-recovery-lede">
          Per proteggere il tuo spazio progettuale, il link precedente non è
          più valido. Ne possiamo creare uno nuovo subito.
        </p>

        {!sent ? (
          <form className="jp-form" onSubmit={sendNew} data-testid="auth-recovery-form">
            <label className="jp-microlabel">La tua email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              className="jp-input"
              placeholder="nome@esempio.com"
              data-testid="auth-recovery-email"
            />
            <div className="jp-cta">
              <button
                type="submit"
                className="jp-btn jp-btn--primary"
                disabled={busy}
                data-testid="auth-recovery-send"
              >
                <Mail size={16} strokeWidth={1.6} aria-hidden />
                <span>{busy ? 'Invio in corso…' : 'Invia nuovo accesso'}</span>
              </button>
              <Link
                to="/auth/login"
                className="jp-btn jp-btn--ghost"
                data-testid="auth-recovery-password"
              >
                <KeyRound size={16} strokeWidth={1.6} aria-hidden />
                <span>Accedi con password</span>
              </Link>
            </div>
          </form>
        ) : (
          <div className="jp-cta jp-cta--done" data-testid="auth-recovery-done">
            <div className="jp-done-pill">
              <Check size={16} strokeWidth={2} aria-hidden />
              <span>Ti abbiamo inviato un nuovo accesso.</span>
            </div>
            <p className="jp-micro">
              Controlla la tua casella. Il link è personale e protetto.
            </p>
          </div>
        )}

        <footer className="jp-foot">
          <p className="jp-foot__text">Il tuo Design Journey™ ti aspetta.</p>
        </footer>
      </main>
    </div>
  );
};

export default AuthRecoveryPage;
