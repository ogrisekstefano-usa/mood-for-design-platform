/**
 * ITER169 · Auth Client Callback™
 *
 * Dedicated, isolated callback for client magic links. Sits OUTSIDE
 * ClientRoute / ProtectedRoute so the auth hydration race condition
 * with homepage fallback is eliminated.
 *
 * Pipeline:
 *   1. Detect error (otp_expired / access_denied / invalid_request) in
 *      hash OR query → render concierge UX inline (NO raw error string,
 *      NO redirect to /auth/login or /).
 *   2. Parse access_token + refresh_token from hash fragment.
 *   3. Write `mfd_session` localStorage (mirrors AuthContext schema).
 *   4. Dispatch `mfd:identity:refresh` (triggers AuthContext.loadProfile()).
 *   5. Await hydration — poll `/api/auth/me` directly here so we DON'T
 *      depend on AuthContext's parallel mount race.
 *   6. Resolve target journey via `/api/journeys/mine`.
 *   7. `history.replaceState` to clean URL (no #access_token leak).
 *   8. SPA navigate to `/journey/:jid`.
 *
 * Any failure at steps 5-7 → concierge UX with "Invia un nuovo accesso" CTA.
 * NEVER redirects to homepage `/`. NEVER lands on `/auth/login`.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Mail, ArrowRight, Sparkles } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import '../journey/journeyPreparing.css';

const STORAGE_KEY = 'mfd_session';
const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

const CONCIERGE_COPY = {
  title:    'Il tuo accesso personale è stato aggiornato',
  body:     'Per la tua sicurezza i nostri inviti hanno una vita breve. ' +
            'Possiamo inviartene uno nuovo, immediatamente, al tuo indirizzo.',
  cta:      'Invia un nuovo accesso',
  sending:  'Stiamo preparando il tuo nuovo accesso…',
  sent:     'Controlla la tua casella. Trovi il nuovo accesso lì.',
  fallback_email_placeholder: 'la-tua-email@esempio.com',
};


function parseHashTokens() {
  // Prefer the snapshot captured by index.html BEFORE any 3rd-party script
  // could scrub the URL. Fall back to live window.location.hash.
  const raw = ((window.__MFD_INITIAL_HASH || window.location.hash) || '').replace(/^#/, '');
  if (!raw) return null;
  const p = new URLSearchParams(raw);
  const access_token = p.get('access_token');
  if (!access_token) return null;
  return {
    access_token,
    refresh_token: p.get('refresh_token') || '',
    token_type:    p.get('token_type') || 'bearer',
    expires_in:    Number(p.get('expires_in') || 3600),
    type:          p.get('type') || 'magiclink',
  };
}

function readErrorFromUrl(searchParams) {
  const rawHash = ((window.__MFD_INITIAL_HASH || window.location.hash) || '').replace(/^#/, '');
  const hashParams = new URLSearchParams(rawHash);
  const errCode =
       searchParams.get('error_code') || hashParams.get('error_code')
    || searchParams.get('error')      || hashParams.get('error');
  if (!errCode) return null;
  const errDesc =
       searchParams.get('error_description')
    || hashParams.get('error_description') || '';
  return { code: errCode, description: errDesc };
}

function cleanUrl() {
  try {
    const u = new URL(window.location.href);
    ['code', 'token_hash', 'error', 'error_code', 'error_description',
     'access_token', 'refresh_token', 'type'].forEach((k) => u.searchParams.delete(k));
    window.history.replaceState({}, document.title, u.pathname);
  } catch (_) { /* noop */ }
}


const AuthClientCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { installSession } = useAuth();
  // states: hydrating | error | resending | resent
  const [state, setState] = useState('hydrating');
  const [message, setMessage] = useState('Stiamo aprendo il tuo Design Journey™…');
  const [resendEmail, setResendEmail] = useState('');

  const concierge = useCallback(() => {
    cleanUrl();
    setState('error');
  }, []);

  // ── 1. Resend CTA handler ──────────────────────────────────────────
  const onResend = useCallback(async () => {
    const e = (resendEmail || '').trim();
    if (!e) return;
    setState('resending');
    try {
      await api.post('/api/auth/client/resend', { email: e });
      setState('resent');
    } catch (_) {
      // Anti-enumeration: backend always returns 200; if it doesn't we
      // still show the same concierge confirmation.
      setState('resent');
    }
  }, [resendEmail]);

  // ── 2. Boot: error first, then exchange ───────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function run() {
      // (a) Any error in URL → straight to concierge UX
      const urlError = readErrorFromUrl(searchParams);
      if (urlError) {
        if (!cancelled) {
          // Pre-fill email if Supabase included it
          const e = searchParams.get('email') || '';
          if (e) setResendEmail(e);
          concierge();
        }
        return;
      }

      // (b) Token in hash
      const tokens = parseHashTokens();
      if (!tokens) {
        // No tokens AND no error: link was already consumed or never had one
        if (!cancelled) concierge();
        return;
      }

      // (c) Install session BEFORE cleaning the URL so AuthContext sees it
      const nextSession = {
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type:    tokens.token_type,
        expires_in:    tokens.expires_in,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
      } catch (_) {
        if (!cancelled) concierge();
        return;
      }

      // (d) Verify the session with the backend (Auth Hydration Gate)
      let profile = null;
      try {
        const meRes = await api.get('/api/auth/me');
        profile = meRes.data;
      } catch (_) {
        if (!cancelled) {
          try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
          concierge();
        }
        return;
      }
      if (cancelled || !profile) return;

      // ITER171.2 · Atomic propagation to AuthContext BEFORE navigation.
      // This prevents ClientRoute from seeing `user=null` on mount and
      // bouncing the magic-link client back to /auth/login.
      try { installSession(nextSession, profile); } catch (_) {}
      // Also keep the legacy event for any subscriber that still listens.
      try { window.dispatchEvent(new Event('mfd:identity:refresh')); } catch (_) {}

      // (e) Resolve client's primary journey
      let journeyId = null;
      try {
        const mine = await api.get('/api/journeys/mine');
        journeyId = mine.data?.journey_id || null;
      } catch (_) {
        // No journey found — graceful fallback to the welcome panel
      }

      if (cancelled) return;

      // (f) Clean URL and navigate (replace history so back doesn't loop)
      cleanUrl();
      if (journeyId) {
        navigate(`/journey/${journeyId}`, { replace: true });
      } else {
        navigate('/client/welcome', { replace: true });
      }
    }

    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 3. Render ─────────────────────────────────────────────────────
  if (state === 'hydrating') {
    return (
      <div className="jp-mini" data-testid="auth-client-callback-page">
        <div className="jp-mini__inner">
          <div className="jp-mini__rings" aria-hidden><span /><span /></div>
          <p className="jp-mini__text" data-testid="auth-client-callback-message">
            {message}
          </p>
        </div>
      </div>
    );
  }

  // CONCIERGE UX (error or resend)
  return (
    <div
      className="jp-mini jp-mini--concierge"
      data-testid="auth-client-callback-page"
      style={{ background: '#0a0b0e' }}
    >
      <div
        className="jp-mini__inner"
        style={{ maxWidth: 520, padding: '60px 32px', textAlign: 'left' }}
      >
        <div style={{ marginBottom: 28 }}>
          <Sparkles size={22} strokeWidth={1.4}
                    style={{ color: '#C9A26B', marginBottom: 16 }} />
          <h1 style={{
            fontFamily: '"Cormorant Garamond", serif',
            fontWeight: 300, fontSize: 30, lineHeight: 1.2,
            color: '#f5efe6', margin: '0 0 14px',
          }} data-testid="auth-client-callback-title">
            {CONCIERGE_COPY.title}
          </h1>
          <p style={{
            fontFamily: 'Inter, sans-serif', fontSize: 14, lineHeight: 1.6,
            color: 'rgba(245,239,230,0.65)', margin: 0,
          }}>
            {CONCIERGE_COPY.body}
          </p>
        </div>

        {state === 'resent' ? (
          <div data-testid="auth-client-callback-resent" style={{
            padding: '16px 18px',
            border: '1px solid rgba(201,162,107,0.3)',
            borderRadius: 2,
            color: '#C9A26B',
            fontFamily: 'Inter, sans-serif', fontSize: 13,
            display: 'inline-flex', alignItems: 'center', gap: 10,
          }}>
            <Mail size={14} strokeWidth={1.4} />
            {CONCIERGE_COPY.sent}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input
              type="email"
              placeholder={CONCIERGE_COPY.fallback_email_placeholder}
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              disabled={state === 'resending'}
              data-testid="auth-client-callback-email-input"
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(245,239,230,0.2)',
                color: '#f5efe6',
                fontFamily: 'Inter, sans-serif',
                fontSize: 14,
                padding: '12px 0',
                outline: 'none',
              }}
              autoComplete="email"
              autoFocus
            />
            <button
              type="button"
              onClick={onResend}
              disabled={!resendEmail.trim() || state === 'resending'}
              data-testid="auth-client-callback-resend"
              style={{
                background: '#C9A26B',
                color: '#0a0b0e',
                border: 'none',
                padding: '14px 24px',
                fontFamily: 'Inter, sans-serif',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                opacity: (!resendEmail.trim() || state === 'resending') ? 0.5 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                alignSelf: 'flex-start',
                transition: 'transform .15s ease',
              }}
            >
              {state === 'resending'
                ? (<><Loader2 size={14} className="animate-spin" />{CONCIERGE_COPY.sending}</>)
                : (<>{CONCIERGE_COPY.cta} <ArrowRight size={14} /></>)
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthClientCallback;
