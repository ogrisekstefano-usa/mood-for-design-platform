/**
 * LoginPage · MOOD for DESIGN™ — Adaptive Access™ surface (ITER167 Round 2)
 *
 * SINGLE route. Email-first. Role-aware. No "login" wording.
 *
 *   STEP 1  Email probe   →  POST /api/auth/identify
 *   STEP 2  Adaptive UI
 *             client       →  "Continua via email" (magic-link first)
 *                             "Usa password" secondary, only if available
 *             professional →  password-first  ("Accedi al tuo workspace operativo")
 *   STEP 3  Concierge confirmation when the personal access email is sent.
 *
 *   All copy is CMS-overridable via BlueprintContext `t()`.
 *   The hero image + brand logo are CMS-editable.
 *   No raw Supabase errors are ever shown — `formatError` translates them.
 */
import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Eye, EyeOff, ArrowRight, ChevronLeft, Mail, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { formatError } from '../../lib/api';
import './auth-login.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// ── returnTo safety (ITER161) — same-origin only, no protocol escape.
const _safeReturnTo = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  if (/^[a-z]+:/i.test(raw)) return null;
  return raw;
};

const _roleHome = (role) => {
  const r = (role || '').toLowerCase();
  if (r === 'client') return '/client';
  return '/dashboard';
};

const HERO_IMAGE_DEFAULT =
  'https://customer-assets.emergentagent.com/job_content-hub-pro-22/artifacts/ys8jrftd_AdobeStock_1014843351.jpeg';

// Official MOOD for DESIGN™ wordmark (ITER167 R4 — user-provided asset)
const BRAND_LOGO_DEFAULT =
  'https://customer-assets.emergentagent.com/job_content-hub-pro-22/artifacts/3gkc6rcw_logo_mood_for_design_color.png';

const LoginPage = () => {
  const { signIn } = useAuth();
  const { t } = useBlueprint();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Phase machine: 'probe' → 'adaptive' → 'sent'
  const [phase, setPhase] = useState('probe');
  const [email, setEmail] = useState('');
  const [identity, setIdentity] = useState(null); // {kind, password_exists}
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── CMS-driven copy (fallbacks editoriali, NO software wording) ────
  const copy = {
    // Phase 1 — Probe
    eyebrow:        t('auth.access.eyebrow',           null, 'IL TUO SPAZIO PROGETTUALE'),
    probeTitle:     t('auth.access.probe.title',       null, 'Bentornato nel tuo spazio progettuale.'),
    probeSubtitle:  t('auth.access.probe.subtitle',    null, 'Inserisci la mail che hai utilizzato per il tuo Design Journey™.'),
    emailLabel:     t('auth.access.email_label',       null, 'La tua email'),
    emailPh:        t('auth.access.email_placeholder', null, 'nome@esempio.com'),
    probeCta:       t('auth.access.probe.cta',         null, 'Continua'),

    // Phase 2 — Client adaptive
    clientTitle:    t('auth.access.client.title',      null, 'Bentornato nel tuo spazio progettuale.'),
    clientSubtitle: t('auth.access.client.subtitle',   null, 'Ti invieremo un accesso personale per continuare il tuo Design Journey™.'),
    clientCtaEmail: t('auth.access.client.cta_email',  null, 'Continua via email'),
    clientCtaPw:    t('auth.access.client.cta_password', null, 'Usa password'),

    // Phase 2 — Professional adaptive
    proTitle:       t('auth.access.professional.title',    null, 'Accedi al tuo workspace operativo.'),
    proSubtitle:    t('auth.access.professional.subtitle', null, 'Inserisci la password per riprendere.'),
    proCta:         t('auth.access.professional.cta',      null, 'Accedi al workspace'),
    proCtaEmail:    t('auth.access.professional.cta_email', null, 'Ricevi accesso via email'),

    // Shared password field
    pwLabel:        t('auth.access.password_label',    null, 'Password'),
    pwPh:           t('auth.access.password_placeholder', null, '••••••••••'),
    forgot:         t('auth.access.forgot',            null, 'Hai dimenticato la password?'),

    // Phase 3 — Sent
    sentTitle:      t('auth.access.sent.title',        null, 'Ti abbiamo inviato un accesso personale.'),
    sentCopy:       t('auth.access.sent.copy',         null, 'Apri la tua email per continuare il tuo Design Journey™.'),
    sentResend:     t('auth.access.sent.resend',       null, 'Invia di nuovo'),

    // Navigation
    back:           t('auth.access.back',              null, 'Cambia email'),

    // Hero
    quote:          t('auth.access.quote',             null, 'Design is not just what you see. It\u2019s how you live.'),
    quoteAuthor:    t('auth.access.quote_author',      null, 'MOOD for DESIGN\u2122'),
    brand:          t('brand.name', null, 'MOOD'),

    // Footer
    needHelp:       t('auth.access.need_help',         null, 'Hai bisogno di assistenza?'),
    support:        t('auth.access.support',           null, 'Scrivi al nostro studio'),
  };
  const heroImage    = t('auth.login.hero_image', null, HERO_IMAGE_DEFAULT);
  const brandLogo    = t('auth.login.brand_logo', null, BRAND_LOGO_DEFAULT);
  const supportEmail = t('auth.access.support_email', null, 'support@moodfordesign.com');

  // ── STEP 1 · Identify the visitor's experiential kind ─────────────
  const handleProbe = async (e) => {
    e?.preventDefault?.();
    const clean = (email || '').trim().toLowerCase();
    if (!clean || !/.+@.+\..+/.test(clean)) {
      toast('Lascia la tua email — ti accompagniamo dentro.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(
        `${BACKEND_URL}/api/auth/identify`,
        { email: clean }
      );
      setIdentity(data || { kind: 'client', password_exists: false });
      setEmail(clean);
      setPhase('adaptive');
      // Pre-select the most natural sub-flow
      const isPro = data?.kind === 'professional';
      setUsePassword(isPro);
    } catch (_) {
      // Identity probe is enumeration-safe; fall through to client UX.
      setIdentity({ kind: 'client', password_exists: false });
      setPhase('adaptive');
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 2a · Continua via email (silent magic-link, both kinds) ──
  const handleContinueByEmail = async () => {
    setLoading(true);
    try {
      const next = identity?.kind === 'professional' ? '/dashboard' : '/client';
      await axios.post(`${BACKEND_URL}/api/auth/silent-magic-link`, {
        email,
        next,
      });
    } catch (_) {/* opaque */}
    setLoading(false);
    setPhase('sent');
  };

  // ── STEP 2b · Password auth (client opt-in, professional default) ──
  const handlePasswordSubmit = async (e) => {
    e?.preventDefault?.();
    setError('');
    setLoading(true);
    try {
      const resp = await signIn(email, password);
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

  const handleBack = () => {
    setPhase('probe');
    setIdentity(null);
    setUsePassword(false);
    setPassword('');
    setError('');
  };

  // ── Phase-driven copy resolution ──────────────────────────────────
  const isPro       = identity?.kind === 'professional';
  const phaseTitle =
    phase === 'sent'      ? copy.sentTitle :
    phase === 'adaptive'  ? (isPro ? copy.proTitle : copy.clientTitle) :
                            copy.probeTitle;
  const phaseSub =
    phase === 'sent'      ? copy.sentCopy :
    phase === 'adaptive'  ? (isPro ? copy.proSubtitle : copy.clientSubtitle) :
                            copy.probeSubtitle;

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

      {/* ── Panel · Adaptive Access™ ───────────────────────────────── */}
      <section className="mfd-auth__panel" data-testid="login-panel" data-phase={phase}>
        {phase !== 'probe' && phase !== 'sent' && (
          <button
            type="button"
            className="mfd-auth__back"
            onClick={handleBack}
            data-testid="login-back-btn"
            aria-label={copy.back}
          >
            <ChevronLeft size={16} strokeWidth={1.6} />
            <span>{copy.back}</span>
          </button>
        )}

        <p className="mfd-auth__eyebrow" data-testid="login-eyebrow">
          {copy.eyebrow}
        </p>
        <h1 className="mfd-auth__title" data-testid="login-title">
          {phaseTitle}
        </h1>
        <div className="mfd-auth__divider" aria-hidden />
        <p className="mfd-auth__subtitle" data-testid="login-subtitle">
          {phaseSub}
        </p>

        {error && (
          <div className="mfd-auth__error" role="alert" data-testid="login-error">
            {error}
          </div>
        )}

        {/* ─────────────────────── PHASE 1 · PROBE ─────────────────── */}
        {phase === 'probe' && (
          <form className="mfd-auth__form" onSubmit={handleProbe} noValidate data-testid="login-form-probe">
            <div className="mfd-auth__field">
              <label htmlFor="access-email" className="mfd-auth__label">
                {copy.emailLabel}
              </label>
              <input
                id="access-email"
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
            <button
              type="submit"
              disabled={loading}
              className="mfd-auth__submit"
              data-testid="login-probe-btn"
            >
              {loading ? <span className="mfd-auth__spinner" aria-hidden /> : (
                <>
                  <span>{copy.probeCta}</span>
                  <ArrowRight size={18} strokeWidth={1.6} />
                </>
              )}
            </button>
          </form>
        )}

        {/* ─────────────────── PHASE 2 · ADAPTIVE ──────────────────── */}
        {phase === 'adaptive' && (
          <div className="mfd-auth__form" data-testid="login-form-adaptive">
            <p className="mfd-auth__resolved-email" data-testid="login-resolved-email">
              {email}
            </p>

            {/* CLIENT — magic-link first */}
            {!isPro && !usePassword && (
              <>
                <button
                  type="button"
                  onClick={handleContinueByEmail}
                  disabled={loading}
                  className="mfd-auth__submit"
                  data-testid="login-client-email-btn"
                >
                  {loading ? <span className="mfd-auth__spinner" aria-hidden /> : (
                    <>
                      <Mail size={16} strokeWidth={1.6} aria-hidden />
                      <span>{copy.clientCtaEmail}</span>
                    </>
                  )}
                </button>
                {identity?.password_exists && (
                  <button
                    type="button"
                    onClick={() => setUsePassword(true)}
                    className="mfd-auth__secondary"
                    data-testid="login-client-password-btn"
                  >
                    <KeyRound size={14} strokeWidth={1.5} aria-hidden />
                    <span>{copy.clientCtaPw}</span>
                  </button>
                )}
              </>
            )}

            {/* PROFESSIONAL — password first */}
            {isPro && usePassword && (
              <form onSubmit={handlePasswordSubmit} data-testid="login-form-password">
                <div className="mfd-auth__field mfd-auth__field--password">
                  <label htmlFor="access-pw" className="mfd-auth__label">
                    {copy.pwLabel}
                  </label>
                  <input
                    id="access-pw"
                    type={showPw ? 'text' : 'password'}
                    required
                    autoFocus
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                  disabled={loading}
                  className="mfd-auth__submit"
                  data-testid="login-submit-btn"
                >
                  {loading ? <span className="mfd-auth__spinner" aria-hidden /> : (
                    <>
                      <span>{copy.proCta}</span>
                      <ArrowRight size={18} strokeWidth={1.6} />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleContinueByEmail}
                  className="mfd-auth__secondary"
                  data-testid="login-pro-email-btn"
                >
                  <Mail size={14} strokeWidth={1.5} aria-hidden />
                  <span>{copy.proCtaEmail}</span>
                </button>
              </form>
            )}

            {/* CLIENT user toggled "Usa password" — same form, lower stakes copy */}
            {!isPro && usePassword && (
              <form onSubmit={handlePasswordSubmit} data-testid="login-form-password">
                <div className="mfd-auth__field mfd-auth__field--password">
                  <label htmlFor="access-pw-c" className="mfd-auth__label">
                    {copy.pwLabel}
                  </label>
                  <input
                    id="access-pw-c"
                    type={showPw ? 'text' : 'password'}
                    required
                    autoFocus
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                  disabled={loading}
                  className="mfd-auth__submit"
                  data-testid="login-submit-btn"
                >
                  {loading ? <span className="mfd-auth__spinner" aria-hidden /> : (
                    <>
                      <span>{copy.proCta}</span>
                      <ArrowRight size={18} strokeWidth={1.6} />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setUsePassword(false)}
                  className="mfd-auth__secondary"
                  data-testid="login-back-to-email"
                >
                  <Mail size={14} strokeWidth={1.5} aria-hidden />
                  <span>{copy.clientCtaEmail}</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* ─────────────────────── PHASE 3 · SENT ──────────────────── */}
        {phase === 'sent' && (
          <div className="mfd-auth__sent" data-testid="login-sent">
            <p className="mfd-auth__resolved-email" data-testid="login-resolved-email">
              {email}
            </p>
            <button
              type="button"
              onClick={handleContinueByEmail}
              disabled={loading}
              className="mfd-auth__secondary"
              data-testid="login-resend-btn"
            >
              <Mail size={14} strokeWidth={1.5} aria-hidden />
              <span>{copy.sentResend}</span>
            </button>
            <button
              type="button"
              onClick={handleBack}
              className="mfd-auth__secondary"
              data-testid="login-sent-back-btn"
            >
              <ChevronLeft size={14} strokeWidth={1.5} aria-hidden />
              <span>{copy.back}</span>
            </button>
          </div>
        )}

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
