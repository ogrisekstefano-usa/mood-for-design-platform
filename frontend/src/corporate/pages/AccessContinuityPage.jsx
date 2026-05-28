import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSiteBlocks } from '../hooks/useSitePage';

/**
 * AccessContinuityPage (ITER167)
 * ─────────────────────────────────────────────────────────────────
 * The single editorial entrance to MOOD for DESIGN.
 * No "login form" — this is a transition into the Design Journey.
 *
 * State machine
 *   email      → probing → password | magic_sent | concierge
 *   landing    → consuming → welcome_back (auto-redirect)
 *                          | expired
 *                          | already_used
 *                          | invalid
 *
 * All copy is DB-driven (site.access.* namespace, multilingual).
 * Errors are routed through concierge channels — no raw failures
 * ever reach the user.
 */
const BACKEND = process.env.REACT_APP_BACKEND_URL;

const ACCESS_KEYS = [
  'site.access.eyebrow',
  'site.access.headline',
  'site.access.sublead',
  'site.access.email.label',
  'site.access.email.placeholder',
  'site.access.email.continue',
  'site.access.password.label',
  'site.access.password.continue',
  'site.access.password.helper',
  'site.access.magic.headline',
  'site.access.magic.body',
  'site.access.magic.cta_resend',
  'site.access.magic.helper',
  'site.access.concierge.headline',
  'site.access.concierge.body',
  'site.access.concierge.cta',
  'site.access.expired.headline',
  'site.access.expired.body',
  'site.access.expired.cta',
  'site.access.already_used.headline',
  'site.access.already_used.body',
  'site.access.welcome_back.headline',
  'site.access.welcome_back.body',
  'site.access.loading.preparing',
  'site.access.loading.opening',
  'site.access.loading.verifying',
  'site.access.legal_note',
];

const AccessContinuityPage = () => {
  const t = useSiteBlocks(ACCESS_KEYS);
  const navigate = useNavigate();
  const location = useLocation();

  // Was this page opened with a ?token=... ? → landing flow.
  const incomingToken = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('token');
  }, [location.search]);

  // Stage: 'email' | 'probing' | 'password' | 'magic_sent'
  //      | 'concierge' | 'consuming' | 'welcome_back'
  //      | 'expired' | 'already_used' | 'invalid'
  const [stage, setStage] = useState(incomingToken ? 'consuming' : 'email');

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(null);
  const [busy, setBusy]         = useState(false);

  // ── Landing-flow: consume the token immediately ───────────────────
  const consumedRef = useRef(false);
  useEffect(() => {
    if (!incomingToken) return;
    if (consumedRef.current) return;
    consumedRef.current = true;
    (async () => {
      try {
        const res = await axios.post(`${BACKEND}/api/auth/magic-link/consume`, {
          token: incomingToken,
        });
        if (res.data?.ok) {
          // Persist session like the password flow does.
          localStorage.setItem('mood_jwt',  res.data.jwt);
          localStorage.setItem('mood_user', JSON.stringify(res.data.user));
          localStorage.setItem('mood_tenant', JSON.stringify(res.data.tenant));
          setStage('welcome_back');
          setTimeout(() => {
            window.location.assign(res.data.redirect_url || '/admin');
          }, 1600);
        } else if (res.data?.reason === 'expired') {
          setStage('expired');
        } else if (res.data?.reason === 'already_used') {
          setStage('already_used');
        } else {
          setStage('invalid');
        }
      } catch {
        setStage('invalid');
      }
    })();
  }, [incomingToken]);

  // ── Submit handlers ───────────────────────────────────────────────
  const submitEmail = async (e) => {
    e?.preventDefault?.();
    if (!email.trim() || busy) return;
    setBusy(true);
    setStage('probing');
    try {
      const probe = await axios.post(`${BACKEND}/api/auth/identity-probe`, {
        email: email.trim().toLowerCase(),
      });
      setDisplayName(probe.data?.display_name || null);
      const ch = probe.data?.channel || 'concierge';
      if (ch === 'password') {
        setStage('password');
      } else if (ch === 'magic_link') {
        await axios.post(`${BACKEND}/api/auth/magic-link/request`, {
          email: email.trim().toLowerCase(), locale: 'it',
        });
        setStage('magic_sent');
      } else {
        // concierge — but to prevent enumeration we ALSO send a magic-link
        // request (which silently no-ops if the email is unknown).
        await axios.post(`${BACKEND}/api/auth/magic-link/request`, {
          email: email.trim().toLowerCase(), locale: 'it',
        });
        setStage('concierge');
      }
    } catch {
      setStage('concierge');
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async (e) => {
    e?.preventDefault?.();
    if (!password || busy) return;
    setBusy(true);
    try {
      const res = await axios.post(`${BACKEND}/api/auth/login`, {
        email: email.trim().toLowerCase(),
        password,
      });
      if (res.data?.token) {
        localStorage.setItem('mood_jwt',    res.data.token);
        localStorage.setItem('mood_user',   JSON.stringify(res.data.user));
        localStorage.setItem('mood_tenant', JSON.stringify(res.data.tenant));
        window.location.assign(res.data.redirect_url || '/admin');
      } else if (res.data?.requires_tenant_selection) {
        // Edge case: same email across tenants. Pick first for now.
        const slug = res.data.tenants?.[0]?.slug;
        const r2 = await axios.post(`${BACKEND}/api/auth/login`, {
          email: email.trim().toLowerCase(),
          password,
          tenant_slug: slug,
        });
        if (r2.data?.token) {
          localStorage.setItem('mood_jwt',    r2.data.token);
          localStorage.setItem('mood_user',   JSON.stringify(r2.data.user));
          localStorage.setItem('mood_tenant', JSON.stringify(r2.data.tenant));
          window.location.assign(r2.data.redirect_url || '/admin');
        }
      }
    } catch {
      // Concierge intercept — no raw error to the user.
      // Soft-suggest magic link as a calmer alternative.
      await axios.post(`${BACKEND}/api/auth/magic-link/request`, {
        email: email.trim().toLowerCase(), locale: 'it',
      }).catch(() => {});
      setStage('magic_sent');
    } finally {
      setBusy(false);
    }
  };

  const sendMagicAgain = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await axios.post(`${BACKEND}/api/auth/magic-link/request`, {
        email: email.trim().toLowerCase(), locale: 'it',
      });
    } catch { /* silently swallow */ }
    finally { setBusy(false); }
  };

  const switchToMagicFromPassword = async () => {
    setBusy(true);
    try {
      await axios.post(`${BACKEND}/api/auth/magic-link/request`, {
        email: email.trim().toLowerCase(), locale: 'it',
      });
      setStage('magic_sent');
    } catch {
      setStage('magic_sent');
    } finally { setBusy(false); }
  };

  const restart = () => {
    setStage('email');
    setPassword('');
    setDisplayName(null);
    navigate(location.pathname, { replace: true });
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <main
      data-testid="access-continuity"
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: '#050505',
        color: '#FFFFFF',
        overflow: 'hidden',
      }}
    >
      <AmbientBackdrop />

      {/* Minimal exit affordance — logo as silent retreat */}
      <a href="/"
         data-testid="access-exit"
         style={{
           position: 'absolute', top: 32, left: 36, zIndex: 5,
           display: 'inline-block',
           opacity: 0.55,
           transition: 'opacity 280ms ease',
         }}
         onMouseOver={(e) => (e.currentTarget.style.opacity = '1')}
         onMouseOut={(e)  => (e.currentTarget.style.opacity = '0.55')}>
        <img
          src="https://customer-assets.emergentagent.com/job_editorial-platform-4/artifacts/chlucgqo_Artboard%201.png"
          alt="MOOD for DESIGN"
          style={{ height: 38, width: 'auto', display: 'block' }}
          draggable={false}
        />
      </a>

      <div style={{
        position: 'relative', zIndex: 2,
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '120px 24px 96px 24px',
      }}>
        <div style={{
          maxWidth: 620, width: '100%',
          display: 'grid', gap: 40,
        }}>
          <Eyebrow>{t['site.access.eyebrow'] || 'MOOD for DESIGN'}</Eyebrow>

          {stage === 'email' && (
            <Frame fadeKey="email">
              <Headline>{t['site.access.headline']}</Headline>
              <Sublead>{t['site.access.sublead']}</Sublead>
              <form onSubmit={submitEmail}
                     style={{ marginTop: 36, display: 'grid', gap: 14 }}
                     data-testid="access-email-form">
                <FieldLabel htmlFor="ac-email">
                  {t['site.access.email.label']}
                </FieldLabel>
                <input
                  id="ac-email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t['site.access.email.placeholder']}
                  data-testid="access-email-input"
                  style={inputStyle}
                />
                <Cta type="submit" disabled={busy || !email.trim()}
                     dataTestid="access-email-continue">
                  {t['site.access.email.continue']}
                </Cta>
              </form>
            </Frame>
          )}

          {stage === 'probing' && (
            <Frame fadeKey="probing">
              <LoadingPulse>{t['site.access.loading.preparing']}</LoadingPulse>
            </Frame>
          )}

          {stage === 'password' && (
            <Frame fadeKey="password">
              <Headline>{t['site.access.headline']}</Headline>
              {displayName && (
                <p style={{
                  marginTop: 18,
                  fontFamily: '"Playfair Display", Georgia, serif',
                  fontStyle: 'italic',
                  fontSize: '1.15rem',
                  color: 'rgba(255,255,255,0.78)',
                }} data-testid="access-display-name">
                  {displayName.split(' ')[0]}.
                </p>
              )}
              <Sublead>{t['site.access.sublead']}</Sublead>
              <form onSubmit={submitPassword}
                     style={{ marginTop: 36, display: 'grid', gap: 14 }}
                     data-testid="access-password-form">
                <FieldLabel>{email}</FieldLabel>
                <input
                  type="password"
                  required autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t['site.access.password.label']}
                  data-testid="access-password-input"
                  style={inputStyle}
                />
                <Cta type="submit" disabled={busy || !password}
                     dataTestid="access-password-continue">
                  {t['site.access.password.continue']}
                </Cta>
              </form>
              <button type="button" onClick={switchToMagicFromPassword}
                      data-testid="access-switch-to-magic"
                      style={ghostLinkStyle}>
                {t['site.access.password.helper']}
              </button>
            </Frame>
          )}

          {stage === 'magic_sent' && (
            <Frame fadeKey="magic">
              <Headline>{t['site.access.magic.headline']}</Headline>
              <Sublead>{t['site.access.magic.body']}</Sublead>
              <p style={emailLineStyle} data-testid="access-magic-email">
                {email}
              </p>
              <div style={{ display: 'flex', gap: 14, marginTop: 32, flexWrap: 'wrap' }}>
                <Cta onClick={sendMagicAgain} disabled={busy}
                     dataTestid="access-magic-resend" variant="ghost">
                  {t['site.access.magic.cta_resend']}
                </Cta>
                <Cta onClick={restart} variant="ghost"
                     dataTestid="access-magic-back">
                  ← {t['site.access.email.label']}
                </Cta>
              </div>
              <p style={helperStyle}>{t['site.access.magic.helper']}</p>
            </Frame>
          )}

          {stage === 'concierge' && (
            <Frame fadeKey="concierge">
              <Headline>{t['site.access.concierge.headline']}</Headline>
              <Sublead>{t['site.access.concierge.body']}</Sublead>
              <div style={{ display: 'flex', gap: 14, marginTop: 32, flexWrap: 'wrap' }}>
                <a href="mailto:journey@moodfordesign.com" data-testid="access-concierge-mail"
                   style={ctaStyle('solid')}>
                  {t['site.access.concierge.cta']}
                </a>
                <Cta onClick={restart} variant="ghost"
                     dataTestid="access-concierge-back">
                  ← {t['site.access.email.label']}
                </Cta>
              </div>
            </Frame>
          )}

          {stage === 'consuming' && (
            <Frame fadeKey="consuming">
              <LoadingPulse>{t['site.access.loading.opening']}</LoadingPulse>
            </Frame>
          )}

          {stage === 'welcome_back' && (
            <Frame fadeKey="welcome">
              <Headline>{t['site.access.welcome_back.headline']}</Headline>
              <Sublead>{t['site.access.welcome_back.body']}</Sublead>
              <LoadingPulse subtle>{t['site.access.loading.opening']}</LoadingPulse>
            </Frame>
          )}

          {stage === 'expired' && (
            <Frame fadeKey="expired">
              <Headline>{t['site.access.expired.headline']}</Headline>
              <Sublead>{t['site.access.expired.body']}</Sublead>
              <Cta onClick={restart} dataTestid="access-expired-restart">
                {t['site.access.expired.cta']}
              </Cta>
            </Frame>
          )}

          {stage === 'already_used' && (
            <Frame fadeKey="already_used">
              <Headline>{t['site.access.already_used.headline']}</Headline>
              <Sublead>{t['site.access.already_used.body']}</Sublead>
              <Cta onClick={restart} dataTestid="access-alreadyused-restart">
                {t['site.access.expired.cta']}
              </Cta>
            </Frame>
          )}

          {stage === 'invalid' && (
            <Frame fadeKey="invalid">
              <Headline>{t['site.access.expired.headline']}</Headline>
              <Sublead>{t['site.access.expired.body']}</Sublead>
              <Cta onClick={restart} dataTestid="access-invalid-restart">
                {t['site.access.expired.cta']}
              </Cta>
            </Frame>
          )}

          <p style={legalStyle}>{t['site.access.legal_note']}</p>
        </div>
      </div>
    </main>
  );
};

// ─────────────────────────────────────────────────────────────────
// Visual primitives — quiet, editorial, cinematic
// ─────────────────────────────────────────────────────────────────

const AmbientBackdrop = () => (
  <>
    {/* Two slow-moving radial pools = "Chicago natural light" */}
    <div style={{
      position: 'absolute', inset: 0, zIndex: 0,
      background:
        'radial-gradient(ellipse at 18% 12%, rgba(0,201,179,0.10) 0%, transparent 55%),' +
        'radial-gradient(ellipse at 82% 88%, rgba(255,180,162,0.07) 0%, transparent 60%)',
      filter: 'blur(0px)',
      animation: 'accessDrift 28s ease-in-out infinite alternate',
    }} />
    {/* Grain layer */}
    <div style={{
      position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
      opacity: 0.045, mixBlendMode: 'overlay',
      backgroundImage:
        'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22220%22 height=%22220%22><filter id=%22n%22><feTurbulence baseFrequency=%221.4%22 numOctaves=%222%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.85%22/></svg>")',
    }} />
    <style>{`
      @keyframes accessDrift {
        0%   { transform: translate3d(0,0,0)     scale(1);    }
        50%  { transform: translate3d(-2%,1%,0)  scale(1.06); }
        100% { transform: translate3d(2%,-1%,0)  scale(1.02); }
      }
      @keyframes accessFadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0);   }
      }
      @keyframes accessPulse {
        0%, 100% { opacity: 0.4; }
        50%      { opacity: 0.9; }
      }
    `}</style>
  </>
);

const Frame = ({ children, fadeKey }) => (
  <div key={fadeKey}
       data-testid={`access-stage-${fadeKey}`}
       style={{ animation: 'accessFadeIn 700ms cubic-bezier(0.22,1,0.36,1)' }}>
    {children}
  </div>
);

const Eyebrow = ({ children }) => (
  <p style={{
    margin: 0,
    fontFamily: '"Helvetica Neue", Arial, sans-serif',
    fontSize: '0.74rem', letterSpacing: '0.28em',
    textTransform: 'uppercase',
    color: '#00C9B3',
    opacity: 0.95,
  }} data-testid="access-eyebrow">{children}</p>
);

const Headline = ({ children }) => (
  <h1 style={{
    margin: 0,
    fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif',
    fontWeight: 400,
    fontSize: 'clamp(2.2rem, 4.4vw, 3.6rem)',
    lineHeight: 1.1,
    letterSpacing: '-0.01em',
    color: '#FFFFFF',
  }} data-testid="access-headline">{children}</h1>
);

const Sublead = ({ children }) => (
  <p style={{
    margin: '20px 0 0 0',
    fontFamily: '"Helvetica Neue", Arial, sans-serif',
    fontSize: '1.02rem',
    lineHeight: 1.65,
    color: 'rgba(255,255,255,0.72)',
    maxWidth: '46ch',
  }} data-testid="access-sublead">{children}</p>
);

const FieldLabel = ({ children, htmlFor }) => (
  <label htmlFor={htmlFor} style={{
    fontFamily: '"Helvetica Neue", Arial, sans-serif',
    fontSize: '0.7rem', letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  }}>{children}</label>
);

const Cta = ({ children, onClick, type = 'button', disabled, variant = 'solid', dataTestid }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    data-testid={dataTestid}
    style={{
      ...ctaStyle(variant),
      opacity: disabled ? 0.45 : 1,
      cursor: disabled ? 'wait' : 'pointer',
    }}
    onMouseOver={(e) => {
      if (disabled) return;
      e.currentTarget.style.transform = 'translateY(-1px)';
      if (variant === 'solid') e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,201,179,0.35)';
    }}
    onMouseOut={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'none';
    }}
  >
    {children}
  </button>
);

const LoadingPulse = ({ children, subtle = false }) => (
  <p style={{
    margin: subtle ? '36px 0 0 0' : 0,
    fontFamily: '"Playfair Display", Georgia, serif',
    fontStyle: 'italic',
    fontSize: subtle ? '0.95rem' : '1.2rem',
    color: 'rgba(255,255,255,0.65)',
    animation: 'accessPulse 2.4s ease-in-out infinite',
  }} data-testid="access-loading">{children}</p>
);

// ─────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.22)',
  padding: '14px 2px',
  fontFamily: '"Helvetica Neue", Arial, sans-serif',
  fontSize: '1.05rem',
  color: '#FFFFFF',
  letterSpacing: '0.01em',
  outline: 'none',
  transition: 'border-color 280ms ease',
};

const ctaStyle = (variant) => ({
  display: 'inline-flex',
  alignItems: 'center', justifyContent: 'center',
  gap: 8,
  padding: '14px 28px',
  borderRadius: 999,
  fontFamily: '"Helvetica Neue", Arial, sans-serif',
  fontSize: '0.84rem',
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  fontWeight: 500,
  transition: 'transform 220ms cubic-bezier(0.22,1,0.36,1), box-shadow 220ms ease, background 220ms ease',
  border: variant === 'solid'
    ? '1px solid #00C9B3'
    : '1px solid rgba(255,255,255,0.22)',
  background: variant === 'solid' ? '#00C9B3' : 'transparent',
  color: variant === 'solid' ? '#000000' : 'rgba(255,255,255,0.85)',
  cursor: 'pointer',
});

const ghostLinkStyle = {
  marginTop: 22,
  background: 'transparent', border: 'none',
  padding: 0, textAlign: 'left',
  fontFamily: '"Playfair Display", Georgia, serif',
  fontStyle: 'italic',
  fontSize: '0.92rem',
  color: 'rgba(0,201,179,0.85)',
  textDecoration: 'underline',
  textUnderlineOffset: 4,
  textDecorationThickness: 1,
  cursor: 'pointer',
};

const emailLineStyle = {
  marginTop: 18,
  fontFamily: '"Helvetica Neue", Arial, sans-serif',
  fontSize: '0.95rem',
  letterSpacing: '0.02em',
  color: '#00C9B3',
};

const helperStyle = {
  marginTop: 28,
  fontFamily: '"Helvetica Neue", Arial, sans-serif',
  fontSize: '0.78rem',
  color: 'rgba(255,255,255,0.42)',
  letterSpacing: '0.01em',
};

const legalStyle = {
  marginTop: 56,
  fontFamily: '"Helvetica Neue", Arial, sans-serif',
  fontSize: '0.7rem',
  color: 'rgba(255,255,255,0.35)',
  letterSpacing: '0.05em',
  maxWidth: '56ch',
  lineHeight: 1.6,
};

export default AccessContinuityPage;
