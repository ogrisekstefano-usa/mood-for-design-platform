/**
 * LoginPage · MOOD for DESIGN™ Atelier Auth Surface
 *
 * Editorial · cinematic · WCAG-AA · runtime-driven copy.
 * - Hero image full-bleed on the left with cinematic overlay + quote.
 * - Right panel: warm-CTA sign in form + Two Entry Paths™ cards.
 * - NO SSO buttons (architecture-ready but not visible per brand brief).
 * - NO "Create account" link — replaced by editorial entry paths.
 *
 * All copy comes from BlueprintContext (`t()`); placeholders, quote, hero
 * image asset, and CTA wording are CMS-editable via editorial blocks.
 *
 * This component is the new UI/UX baseline for the platform.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, User, Briefcase } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { formatError } from '../../lib/api';
import LocaleSwitcher from '../../components/common/LocaleSwitcher';
import './auth-login.css';

const HERO_IMAGE_DEFAULT =
  'https://customer-assets.emergentagent.com/job_content-hub-pro-22/artifacts/ys8jrftd_AdobeStock_1014843351.jpeg';

const BRAND_LOGO_DEFAULT =
  'https://customer-assets.emergentagent.com/job_content-hub-pro-22/artifacts/klo86yi6_logo_top_frontend.png';

const LoginPage = () => {
  const { signIn } = useAuth();
  const { t } = useBlueprint();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // All strings runtime-driven from BlueprintContext (fallback for empty tenants)
  const copy = {
    eyebrow:     t('auth.login.eyebrow', null, 'WELCOME BACK'),
    title:       t('auth.login.title',   null, 'Access your Blueprint.'),
    subtitle:    t('auth.login.subtitle',null, 'Sign in to continue your journey.'),
    email:       t('auth.login.email',   null, 'Email'),
    password:    t('auth.login.password',null, 'Password'),
    emailPh:     t('auth.login.email_placeholder', null, 'name@yourstudio.com'),
    pwPh:        t('auth.login.password_placeholder', null, '••••••••••'),
    remember:    t('auth.login.remember',null, 'Remember me'),
    forgot:      t('auth.login.forgot',  null, 'Forgot password?'),
    submit:      t('auth.login.submit',  null, 'Sign in'),
    or:          t('auth.login.or',      null, 'OR'),
    pathsEyebrow:t('auth.login.paths_eyebrow', null, 'New to MOOD for DESIGN?'),
    pathsSub:    t('auth.login.paths_sub',     null, 'Choose how you want to get started.'),
    pathPrivate: t('auth.login.path_private',  null, "I'm a private client"),
    pathPro:     t('auth.login.path_pro',      null, "I'm a design professional"),
    needHelp:    t('auth.login.need_help',     null, 'Need help?'),
    support:     t('auth.login.support',       null, 'Contact support'),
    quote:       t('auth.login.quote',         null, 'Design is not just what you see. It\u2019s how you live.'),
    quoteAuthor: t('auth.login.quote_author',  null, 'MOOD for DESIGN\u2122'),
    brand:       t('brand.name', null, 'MOOD'),
    brandSub:    t('brand.sub',  null, 'FOR DESIGN'),
  };

  const heroImage = t('auth.login.hero_image', null, HERO_IMAGE_DEFAULT);
  const brandLogo = t('auth.login.brand_logo', null, BRAND_LOGO_DEFAULT);
  const supportEmail = t('auth.login.support_email', null, 'support@moodfordesign.com');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(form.email, form.password);
      if (remember) {
        try { localStorage.setItem('mfd_remember', '1'); } catch (_) {}
      }
      navigate('/dashboard');
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

      {/* ── Panel · form + paths + footer ──────────────────────────── */}
      <section className="mfd-auth__panel">
        <div className="mfd-auth__panel-top">
          <LocaleSwitcher />
        </div>

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

        <form className="mfd-auth__form" onSubmit={handleSubmit} noValidate>
          <div className="mfd-auth__field">
            <label htmlFor="login-email" className="mfd-auth__label">
              {copy.email}
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder={copy.emailPh}
              className="mfd-auth__input"
              data-testid="login-email-input"
            />
          </div>

          <div className="mfd-auth__field mfd-auth__field--password">
            <label htmlFor="login-password" className="mfd-auth__label">
              {copy.password}
            </label>
            <input
              id="login-password"
              type={showPw ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
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

          <div className="mfd-auth__row">
            <label className="mfd-auth__remember" data-testid="login-remember-label">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                data-testid="login-remember-input"
              />
              <span className="mfd-auth__check" aria-hidden />
              <span>{copy.remember}</span>
            </label>
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
            disabled={loading}
            className="mfd-auth__submit"
            data-testid="login-submit-btn"
          >
            {loading ? (
              <span className="mfd-auth__spinner" aria-hidden />
            ) : (
              <>
                <span>{copy.submit}</span>
                <ArrowRight size={18} strokeWidth={1.6} />
              </>
            )}
          </button>
        </form>

        <div className="mfd-auth__or" aria-hidden>
          <span className="mfd-auth__or-text">{copy.or}</span>
        </div>

        {/* Two Entry Paths™ — Private Client / Design Professional */}
        <div className="mfd-auth__paths" data-testid="login-paths">
          <p className="mfd-auth__paths-eyebrow" data-testid="login-paths-eyebrow">
            {copy.pathsEyebrow}
          </p>
          <p className="mfd-auth__paths-sub" data-testid="login-paths-sub">
            {copy.pathsSub}
          </p>
          <div className="mfd-auth__paths-grid">
            <Link
              to="/begin-journey"
              className="mfd-auth__path-card"
              data-testid="login-path-private"
            >
              <User size={26} strokeWidth={1.4} aria-hidden />
              <span>{copy.pathPrivate}</span>
            </Link>
            <Link
              to="/professionals"
              className="mfd-auth__path-card"
              data-testid="login-path-pro"
            >
              <Briefcase size={26} strokeWidth={1.4} aria-hidden />
              <span>{copy.pathPro}</span>
            </Link>
          </div>
        </div>

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
