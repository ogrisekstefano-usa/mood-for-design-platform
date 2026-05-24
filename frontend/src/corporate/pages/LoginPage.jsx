import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSiteBlocks } from '../hooks/useSitePage';
import { ArrowRight } from 'lucide-react';

const LOGIN_KEYS = [
  'site.login.title',
  'site.login.subtitle',
  'site.login.email.label',
  'site.login.password.label',
  'site.login.submit.label',
  'site.login.forgot.label',
  'site.login.private_cta.label',
  'site.login.professional_cta.label',
];

/**
 * LoginPage (Phase D) — single email/password form with two secondary CTA links
 * (Begin Journey / Professional Access). NO SSO.
 * All copy comes from editorial_blocks (site.login.*).
 */
const LoginPage = () => {
  const t = useSiteBlocks(LOGIN_KEYS);
  const [email, setEmail] = useState('');
  const [pwd, setPwd]     = useState('');
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    // Auth is placeholder for now — Phase E will wire to Supabase Auth + tenant_memberships
    try {
      await new Promise(r => setTimeout(r, 600));
      setErr('auth_not_wired');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      className="min-h-screen grain"
      style={{ background: 'var(--mood-black)', color: '#FFFFFF' }}
      data-testid="login-page"
    >
      <div className="max-w-screen-xl mx-auto px-6 md:px-10 lg:px-14 pt-32 pb-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center min-h-[80vh]">
        {/* Left — editorial copy */}
        <div className="hidden lg:block">
          <p className="overline-teal mb-6">MOOD for DESIGN</p>
          <h1
            className="font-serif font-normal text-white"
            style={{ fontSize: 'clamp(2.4rem, 4vw, 4rem)', lineHeight: 1.06 }}
            data-testid="login-title"
          >
            {t['site.login.title'] || 'Sign in to MOOD'}
          </h1>
          {t['site.login.subtitle'] && (
            <p
              className="mt-6 italic"
              style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.3rem', color: 'rgba(255,255,255,0.78)', maxWidth: '40ch' }}
              data-testid="login-subtitle"
            >
              {t['site.login.subtitle']}
            </p>
          )}
        </div>

        {/* Right — form */}
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: '2.5rem',
            maxWidth: 480,
            width: '100%',
            justifySelf: 'center',
          }}
        >
          {/* Mobile heading */}
          <div className="lg:hidden mb-8">
            <h1 className="font-serif" style={{ fontSize: '2rem', color: '#FFFFFF', lineHeight: 1.1 }}>
              {t['site.login.title'] || 'Sign in to MOOD'}
            </h1>
            {t['site.login.subtitle'] && (
              <p className="mt-3 italic" style={{ fontFamily: 'Playfair Display, serif', color: 'rgba(255,255,255,0.7)' }}>
                {t['site.login.subtitle']}
              </p>
            )}
          </div>

          <form onSubmit={submit} className="space-y-5" data-testid="login-form">
            <label className="block">
              <span style={{ display: 'block', fontFamily: 'Montserrat, sans-serif', fontSize: '0.72rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
                {t['site.login.email.label'] || 'Email'}
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 6,
                  padding: '0.85rem 1rem',
                  color: '#FFFFFF',
                  fontSize: '1rem',
                  outline: 'none',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#00C9B3')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                data-testid="login-email-input"
              />
            </label>
            <label className="block">
              <span style={{ display: 'block', fontFamily: 'Montserrat, sans-serif', fontSize: '0.72rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
                {t['site.login.password.label'] || 'Password'}
              </span>
              <input
                type="password"
                required
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 6,
                  padding: '0.85rem 1rem',
                  color: '#FFFFFF',
                  fontSize: '1rem',
                  outline: 'none',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#00C9B3')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                data-testid="login-password-input"
              />
            </label>

            <div className="flex justify-end">
              <a href="#" style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }} data-testid="login-forgot">
                {t['site.login.forgot.label'] || 'Forgot password?'}
              </a>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="btn-pill-teal"
              style={{ width: '100%', padding: '0.95rem 1.4rem', fontSize: '0.85rem', opacity: busy ? 0.6 : 1 }}
              data-testid="login-submit"
            >
              {busy ? '…' : (t['site.login.submit.label'] || 'Sign in')}
            </button>

            {err && (
              <p style={{ fontSize: '0.8rem', color: '#FFB4A2', fontFamily: 'Montserrat, sans-serif' }}>
                Authentication is being prepared. Please check back soon.
              </p>
            )}
          </form>

          {/* Two secondary CTA links — per ITER149 brief */}
          <div className="mt-10 pt-8 space-y-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <Link
              to="/begin-journey"
              className="flex items-center justify-between group"
              style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontFamily: 'Montserrat, sans-serif', fontSize: '0.85rem' }}
              data-testid="login-private-cta"
            >
              <span>{t['site.login.private_cta.label'] || 'Private client? Begin your Journey'}</span>
              <ArrowRight size={14} strokeWidth={1.6} style={{ color: '#00C9B3' }} />
            </Link>
            <Link
              to="/professional-access"
              className="flex items-center justify-between group"
              style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontFamily: 'Montserrat, sans-serif', fontSize: '0.85rem' }}
              data-testid="login-professional-cta"
            >
              <span>{t['site.login.professional_cta.label'] || 'Professional? Request Access'}</span>
              <ArrowRight size={14} strokeWidth={1.6} style={{ color: '#00C9B3' }} />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
};

export default LoginPage;
