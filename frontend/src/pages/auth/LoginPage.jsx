/**
 * LoginPage · MOOD for DESIGN™ — PROFESSIONAL AUTH™ (post-ITER169)
 *
 * STRICT SCOPE: password-first authentication for professional users only.
 *   • admin · studio_admin · studio_owner · designer · advisor · PM · partner
 *
 * NOT FOR CLIENTS. Clients enter via magic link only (see AuthClientCallback).
 * NO magic link · NO probe · NO adaptive UI · NO /api/auth/identify.
 *
 * Architectural rule (P0, do not change without explicit user approval):
 *   /auth/login   → professional only · password only
 *   /auth/client/callback → client only · magic link only
 *
 * All copy is CMS-overridable via BlueprintContext `t()`.
 * Hero image + brand logo are CMS-editable.
 * No raw Supabase errors are ever shown — `formatError` translates them.
 */
import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { formatError } from '../../lib/api';
import './auth-login.css';

const HERO_IMAGE_DEFAULT =
  'https://customer-assets.emergentagent.com/job_content-hub-pro-22/artifacts/ys8jrftd_AdobeStock_1014843351.jpeg';

const BRAND_LOGO_DEFAULT =
  'https://customer-assets.emergentagent.com/job_content-hub-pro-22/artifacts/iow4xdfw_logo_mood_for_design_color.png';

// returnTo safety — same-origin only, no protocol escape.
const _safeReturnTo = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  if (/^[a-z]+:/i.test(raw)) return null;
  return raw;
};

const _roleHome = (role) => {
  const r = (role || '').toLowerCase();
  // Defensive: if a client ever lands here (shouldn't happen) we route
  // them OUT of the professional workspace to their own surface.
  if (r === 'client') return '/client';
  if (r === 'advisor') return '/advisor';
  return '/dashboard';
};

const LoginPage = () => {
  const { signIn } = useAuth();
  const { t } = useBlueprint();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail]     = useState(() => searchParams.get('email') || '');
  const [password, setPw]     = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const copy = {
    eyebrow:     t('auth.login.eyebrow',     null, 'PROFESSIONAL ACCESS'),
    title:       t('auth.login.title',       null, 'Accedi al tuo workspace operativo.'),
    subtitle:    t('auth.login.subtitle',    null, 'Inserisci email e password per riprendere.'),
    emailLabel:  t('auth.login.email_label', null, 'Email'),
    emailPh:     t('auth.login.email_placeholder', null, 'nome@studio.com'),
    pwLabel:     t('auth.login.password_label', null, 'Password'),
    pwPh:        t('auth.login.password_placeholder', null, '••••••••••'),
    cta:         t('auth.login.cta',         null, 'Accedi al workspace'),
    forgot:      t('auth.login.forgot',      null, 'Hai dimenticato la password?'),
    quote:       t('auth.access.quote',      null, 'Design is not just what you see. It\u2019s how you live.'),
    quoteAuthor: t('auth.access.quote_author', null, 'MOOD for DESIGN\u2122'),
    brand:       t('brand.name', null, 'MOOD'),
    needHelp:    t('auth.access.need_help',  null, 'Hai bisogno di assistenza?'),
    support:     t('auth.access.support',    null, 'Scrivi al nostro studio'),
  };

  const heroImage    = t('auth.login.hero_image', null, HERO_IMAGE_DEFAULT);
  const brandLogo    = t('auth.login.brand_logo', null, BRAND_LOGO_DEFAULT);
  const supportEmail = t('auth.access.support_email', null, 'support@moodfordesign.com');

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError('');
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      const resp = await signIn(email.trim(), password);
      const role = (resp?.user?.role || '').toLowerCase();
      const rt = _safeReturnTo(searchParams.get('returnTo'));
      if (rt) {
        if (role === 'client' && !rt.startsWith('/client')) navigate('/client');
        else navigate(rt);
      } else {
        navigate(_roleHome(role));
      }
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mfd-auth" data-testid="login-page">
      {/* ── Hero · cinematic image ─────────────────────────────────── */}
      <aside className="mfd-auth__hero" data-testid="login-hero">
        <img
          src={heroImage}
          alt=""
          className="mfd-auth__hero-image"
          data-testid="login-hero-image"
        />
        <div className="mfd-auth__hero-overlay" />
        <div className="mfd-auth__brand" data-testid="login-brand">
          <img
            src={brandLogo}
            alt={copy.brand}
            className="mfd-auth__brand-logo"
            data-testid="login-brand-logo"
          />
        </div>
        <figure className="mfd-auth__quote" data-testid="login-quote">
          <blockquote className="mfd-auth__quote-text">{copy.quote}</blockquote>
          <figcaption className="mfd-auth__quote-author">{copy.quoteAuthor}</figcaption>
        </figure>
      </aside>

      {/* ── Panel · password-only professional login ─────────────── */}
      <section className="mfd-auth__panel" data-testid="login-panel" data-phase="password">
        <p className="mfd-auth__eyebrow" data-testid="login-eyebrow">
          {copy.eyebrow}
        </p>
        <h1 className="mfd-auth__title" data-testid="login-title">
          {copy.title}
        </h1>
        <div className="mfd-auth__divider" aria-hidden />
        <p className="mfd-auth__subtitle" data-testid="login-subtitle">
          {copy.subtitle}
        </p>

        {error && (
          <div className="mfd-auth__error" role="alert" data-testid="login-error">
            {error}
          </div>
        )}

        <form className="mfd-auth__form" onSubmit={handleSubmit} noValidate
              data-testid="login-form-password">
          <div className="mfd-auth__field">
            <label htmlFor="login-email" className="mfd-auth__label">
              {copy.emailLabel}
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={copy.emailPh}
              className="mfd-auth__input"
              data-testid="login-email-input"
            />
          </div>

          <div className="mfd-auth__field mfd-auth__field--password">
            <label htmlFor="login-pw" className="mfd-auth__label">
              {copy.pwLabel}
            </label>
            <input
              id="login-pw"
              type={showPw ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPw(e.target.value)}
              placeholder={copy.pwPh}
              className="mfd-auth__input"
              data-testid="login-password-input"
            />
            <button
              type="button"
              className="mfd-auth__eye"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              data-testid="login-password-toggle"
            >
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="mfd-auth__row mfd-auth__row--single">
            <Link
              to="/auth/forgot-password"
              className="mfd-auth__forgot"
              data-testid="login-forgot-link"
            >
              {copy.forgot}
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className="mfd-auth__submit"
            data-testid="login-submit-btn"
          >
            {loading ? (
              <span className="mfd-auth__spinner" aria-hidden />
            ) : (
              <>
                <span>{copy.cta}</span>
                <ArrowRight size={18} strokeWidth={1.6} />
              </>
            )}
          </button>
        </form>

        <footer className="mfd-auth__footer" data-testid="login-footer">
          <span className="mfd-auth__footer-left">{copy.needHelp}</span>
          <a
            href={`mailto:${supportEmail}`}
            className="mfd-auth__footer-link"
            data-testid="login-support-link"
          >
            {copy.support} <ArrowRight size={14} strokeWidth={1.5} />
          </a>
        </footer>
      </section>
    </div>
  );
};

export default LoginPage;
