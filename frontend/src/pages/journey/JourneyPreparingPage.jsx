/**
 * JourneyPreparingPage · ITER166 · P0
 *
 * Transitional screen full-page cinematic post-3-step.
 * NO redirect homepage. NO auth feeling. NO percezione "software".
 *
 * Mood: black / bronze / warm lighting. Soft blur background.
 * Copy editoriale relazionale.
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Mail, RefreshCw, Check } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import './journeyPreparing.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const JourneyPreparingPage = () => {
  const [search] = useSearchParams();
  const [resendBusy, setResendBusy] = useState(false);
  const [resentOk, setResentOk] = useState(false);
  const [mounted, setMounted] = useState(false);

  const email = search.get('email') || '';
  const firstName = search.get('name') || '';
  const magicUrl = search.get('m') || ''; // optional fallback

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Best-effort: deep link sull'app email dell'utente.
  const openEmail = () => {
    const domain = (email.split('@')[1] || '').toLowerCase();
    const map = {
      'gmail.com':       'https://mail.google.com',
      'googlemail.com':  'https://mail.google.com',
      'outlook.com':     'https://outlook.live.com',
      'hotmail.com':     'https://outlook.live.com',
      'live.com':        'https://outlook.live.com',
      'yahoo.com':       'https://mail.yahoo.com',
      'yahoo.it':        'https://mail.yahoo.com',
      'icloud.com':      'https://www.icloud.com/mail',
      'me.com':          'https://www.icloud.com/mail',
      'proton.me':       'https://mail.proton.me',
      'protonmail.com':  'https://mail.proton.me',
    };
    const url = map[domain] || `https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const resend = async () => {
    if (!email) {
      toast.error('Non riesco a riconoscere l\'email.');
      return;
    }
    setResendBusy(true);
    try {
      await axios.post(`${BACKEND_URL}/api/auth/silent-magic-link`, {
        email: email.toLowerCase().trim(),
        next: '/client/welcome',
      });
      setResentOk(true);
      setTimeout(() => setResentOk(false), 5000);
    } catch (_) {
      // opaque: sempre verde, non vogliamo dare segnali tecnici
      setResentOk(true);
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <div className={`jp-shell ${mounted ? 'is-in' : ''}`} data-testid="journey-preparing-page">
      {/* Cinematic background — soft blur, warm bronze glow */}
      <div className="jp-bg" aria-hidden>
        <div className="jp-bg__halo" />
        <div className="jp-bg__halo jp-bg__halo--alt" />
        <div className="jp-bg__grain" />
      </div>

      <main className="jp-inner">
        <div className="jp-mark" aria-hidden>
          <span /><span />
        </div>

        <p className="jp-eyebrow" data-testid="journey-preparing-eyebrow">
          Il tuo spazio progettuale
        </p>
        <h1 className="jp-title" data-testid="journey-preparing-title">
          Il tuo <em>Client&nbsp;Profile™</em> è quasi pronto{firstName ? `, ${firstName}` : ''}.
        </h1>
        <p className="jp-lede" data-testid="journey-preparing-lede">
          Per garantire riservatezza e continuità del tuo <em>Design&nbsp;Journey™</em>,
          ti abbiamo inviato un accesso personale via email.
        </p>

        <div className="jp-cta" data-testid="journey-preparing-cta">
          <button
            type="button"
            className="jp-btn jp-btn--primary"
            onClick={openEmail}
            data-testid="journey-preparing-open-email"
          >
            <Mail size={16} strokeWidth={1.6} aria-hidden />
            <span>Apri la tua email</span>
          </button>
          <button
            type="button"
            className="jp-btn jp-btn--ghost"
            onClick={resend}
            disabled={resendBusy}
            data-testid="journey-preparing-resend"
          >
            {resentOk ? (
              <><Check size={16} strokeWidth={1.8} aria-hidden /><span>Link inviato di nuovo</span></>
            ) : (
              <><RefreshCw size={16} strokeWidth={1.6} aria-hidden className={resendBusy ? 'jp-spin' : ''} /><span>{resendBusy ? 'Invio in corso…' : 'Invia nuovamente il link'}</span></>
            )}
          </button>
        </div>

        <p className="jp-micro" data-testid="journey-preparing-micro">
          Il tuo accesso è personale e protetto. Potrai rientrare nel tuo
          spazio progettuale in qualsiasi momento.
        </p>

        <footer className="jp-foot">
          <p className="jp-foot__text" data-testid="journey-preparing-foot">
            Nessuna password necessaria al primo accesso.
          </p>
          {/* Dev/preview bypass intentionally removed — session leakage vector.
               Use the email link or the "Invia nuovamente" button above. */}
          <Link to="/auth/login" className="jp-foot__return" data-testid="journey-preparing-return">
            Tornare alla landing
          </Link>
        </footer>
      </main>
    </div>
  );
};

export default JourneyPreparingPage;
