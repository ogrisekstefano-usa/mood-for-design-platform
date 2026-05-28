/**
 * AccessEntryPage · ITER169.2 · Unified Entry UX™
 *
 * Single, elegant access surface for ALL returning users (client + pro).
 *
 *   /access
 *     ↓
 *   email + Continua
 *     ↓ (server-side classify, silent)
 *     ├── PROFESSIONAL → /auth/login?email=... (silent navigate)
 *     └── CLIENT / unknown → POST /api/auth/client/resend
 *                           → cinematic confirmation card
 *
 * RULES (architectural, do not change):
 *   • NEVER show "utente trovato/non trovato"
 *   • NEVER show raw role / kind classification
 *   • NEVER tell the user which pipeline they entered
 *   • Anti-enumeration: client + unknown look identical to the eye
 *
 * Text 100% CMS-driven via `t()` with sensible Italian fallbacks.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, Sparkles } from 'lucide-react';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import './auth-login.css';
import './access-entry.css';

const BRAND_LOGO_DEFAULT =
  'https://customer-assets.emergentagent.com/job_content-hub-pro-22/artifacts/iow4xdfw_logo_mood_for_design_color.png';

const HERO_IMAGE_DEFAULT =
  'https://customer-assets.emergentagent.com/job_content-hub-pro-22/artifacts/ys8jrftd_AdobeStock_1014843351.jpeg';


const AccessEntryPage = () => {
  const { t } = useBlueprint();
  const navigate = useNavigate();

  const [email, setEmail]       = useState('');
  const [phase, setPhase]       = useState('idle'); // idle | submitting | confirmed
  const [error, setError]       = useState('');

  // Restore any abandoned email from history.state (e.g., come back via browser back)
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('mfd_access_email_hint');
      if (cached) setEmail(cached);
    } catch (_) { /* SSR-safe */ }
  }, []);

  const copy = {
    eyebrow:    t('access.eyebrow',    null, 'RIENTRA'),
    title:      t('access.title',      null, 'Accedi al tuo spazio progettuale'),
    subtitle:   t('access.subtitle',   null,
                  'Inserisci la tua email. Ti accompagneremo silenziosamente dentro.'),
    emailLabel: t('access.email_label', null, 'Email'),
    emailPh:    t('access.email_placeholder', null, 'la-tua-email@esempio.com'),
    cta:        t('access.cta',         null, 'Continua'),
    submitting: t('access.submitting',  null, 'Stiamo preparando il tuo accesso\u2026'),
    confirmTitle: t('access.confirm_title', null,
                    'Controlla la tua casella'),
    confirmBody:  t('access.confirm_body', null,
                    'Ti abbiamo inviato un accesso personale al tuo spazio progettuale. ' +
                    'Apri l\u2019email e clicca il link per entrare.'),
    confirmHint:  t('access.confirm_hint', null,
                    'Se non lo trovi tra qualche minuto, controlla anche le promozioni o spam.'),
    backToHome:   t('access.back_to_home', null, 'Torna alla homepage'),
    sendAnother:  t('access.send_another', null, 'Usa un\u2019altra email'),
    quote:       t('auth.access.quote', null,
                   'Design is not just what you see. It\u2019s how you live.'),
    quoteAuthor: t('auth.access.quote_author', null, 'MOOD for DESIGN\u2122'),
    newJourney:  t('access.new_journey', null, 'Non hai ancora un Design Journey\u2122?'),
    newJourneyCta: t('access.new_journey_cta', null, 'Inizia ora'),
    errorGeneric: t('access.error_generic', null,
                    'Qualcosa è andato storto. Riprova tra un istante.'),
  };

  const heroImage = t('auth.login.hero_image', null, HERO_IMAGE_DEFAULT);
  const brandLogo = t('auth.login.brand_logo', null, BRAND_LOGO_DEFAULT);

  const onSubmit = async (e) => {
    e?.preventDefault?.();
    const v = (email || '').trim().toLowerCase();
    if (!v) return;
    setError('');
    setPhase('submitting');
    try { sessionStorage.setItem('mfd_access_email_hint', v); } catch (_) {}

    let kind = 'client';
    try {
      const r = await api.post('/api/auth/identify', { email: v });
      kind = (r.data?.kind || 'client').toLowerCase();
    } catch (_) {
      // identify failed: fail-safe to client path (anti-enumeration)
      kind = 'client';
    }

    if (kind === 'professional') {
      // Silent transition to the password pipeline with pre-filled email.
      // No "utente trovato" message, no banner, no detour.
      navigate(`/auth/login?email=${encodeURIComponent(v)}`, { replace: true });
      return;
    }

    // Client OR unknown: send magic link (anti-enumeration · 200 either way)
    try {
      await api.post('/api/auth/client/resend', { email: v });
      setPhase('confirmed');
    } catch (_) {
      setPhase('confirmed'); // Still show the confirmation (anti-enumeration)
    }
  };

  const onReset = () => {
    setPhase('idle');
    setError('');
  };

  return (
    <div className="mfd-auth mfd-access" data-testid="access-entry-page">
      {/* Hero · same cinematic shell as /auth/login (continuity) */}
      <aside className="mfd-auth__hero" data-testid="access-hero">
        <img src={heroImage} alt="" className="mfd-auth__hero-image" />
        <div className="mfd-auth__hero-overlay" />
        <div className="mfd-auth__brand" data-testid="access-brand">
          <Link to="/" aria-label="MOOD for DESIGN">
            <img src={brandLogo} alt="MOOD" className="mfd-auth__brand-logo" />
          </Link>
        </div>
        <figure className="mfd-auth__quote">
          <blockquote className="mfd-auth__quote-text">{copy.quote}</blockquote>
          <figcaption className="mfd-auth__quote-author">{copy.quoteAuthor}</figcaption>
        </figure>
      </aside>

      {/* Panel */}
      <section className="mfd-auth__panel" data-phase={phase}
               data-testid="access-panel">

        {phase !== 'confirmed' && (
          <>
            <p className="mfd-auth__eyebrow" data-testid="access-eyebrow">
              {copy.eyebrow}
            </p>
            <h1 className="mfd-auth__title" data-testid="access-title">
              {copy.title}
            </h1>
            <div className="mfd-auth__divider" aria-hidden />
            <p className="mfd-auth__subtitle" data-testid="access-subtitle">
              {copy.subtitle}
            </p>

            {error && (
              <div className="mfd-auth__error" role="alert"
                   data-testid="access-error">
                {error}
              </div>
            )}

            <form className="mfd-auth__form" onSubmit={onSubmit} noValidate
                  data-testid="access-form">
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
                  data-testid="access-email-input"
                  disabled={phase === 'submitting'}
                />
              </div>

              <button
                type="submit"
                disabled={phase === 'submitting' || !email.trim()}
                className="mfd-auth__submit"
                data-testid="access-submit-btn"
              >
                {phase === 'submitting' ? (
                  <span className="mfd-auth__spinner" aria-hidden />
                ) : (
                  <>
                    <span>{copy.cta}</span>
                    <ArrowRight size={18} strokeWidth={1.6} />
                  </>
                )}
              </button>
            </form>

            <footer className="mfd-auth__footer mfd-access__footer"
                    data-testid="access-footer">
              <span className="mfd-auth__footer-left">{copy.newJourney}</span>
              <Link to="/begin-journey" className="mfd-auth__footer-link"
                    data-testid="access-new-journey-link">
                {copy.newJourneyCta} <ArrowRight size={14} strokeWidth={1.5} />
              </Link>
            </footer>
          </>
        )}

        {phase === 'confirmed' && (
          <div className="mfd-access__confirmed" data-testid="access-confirmed">
            <Sparkles size={22} strokeWidth={1.4} className="mfd-access__confirmed-glyph" />
            <h1 className="mfd-auth__title" data-testid="access-confirmed-title">
              {copy.confirmTitle}
            </h1>
            <div className="mfd-auth__divider" aria-hidden />
            <p className="mfd-auth__subtitle"
               data-testid="access-confirmed-body">
              {copy.confirmBody}
            </p>
            <div className="mfd-access__mail-line">
              <Mail size={14} strokeWidth={1.5} aria-hidden />
              <span data-testid="access-confirmed-email">{email}</span>
            </div>
            <p className="mfd-access__hint" data-testid="access-confirmed-hint">
              {copy.confirmHint}
            </p>
            <div className="mfd-access__confirmed-row">
              <button
                type="button"
                onClick={onReset}
                className="mfd-auth__link-btn"
                data-testid="access-send-another"
              >
                {copy.sendAnother}
              </button>
              <Link to="/" className="mfd-auth__link-btn"
                    data-testid="access-back-home">
                {copy.backToHome}
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default AccessEntryPage;
