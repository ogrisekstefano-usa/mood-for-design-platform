/**
 * TryPlatformCta — cinematic floating "Edit this Demo" button on the EXE home.
 *
 * Behaviour
 * ─────────
 * • Appears after the user scrolls past the hero (>= 360px).
 * • Subtle teal pulse every 12s — premium, not aggressive.
 * • Click → POST /api/demo/magic-link → store session token → navigate to
 *   /settings/storefront?demo=1&step=intro.
 * • Hides itself when the user is on /settings/* (don't shout while editing).
 * • Mobile: bottom sticky bar that collapses to a pill after scroll.
 *
 * The component is locale-aware (reads from useSite().pick) and 100%
 * accessible (proper role + keyboard activation + aria-live for loading).
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import { useSite } from '../../site/SiteContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const COPY = {
  label: {
    it: 'Prova lo Studio',     en: 'Edit this Demo',     fr: 'Essayer le Studio',
    de: 'Studio testen',        es: 'Probar el Studio',  ae: 'جرّب الستوديو',
  },
  hint: {
    it: 'Modifica live · senza login',
    en: 'Edit live · no signup',
    fr: 'Édition live · sans inscription',
    de: 'Live bearbeiten · ohne Anmeldung',
    es: 'Edita en vivo · sin registro',
    ae: 'تحرير مباشر · بدون تسجيل',
  },
  loading: {
    it: 'Apertura Studio…', en: 'Opening Studio…', fr: 'Ouverture du Studio…',
    de: 'Studio wird geöffnet…', es: 'Abriendo Studio…', ae: 'جارٍ فتح الستوديو…',
  },
  error: {
    it: 'Riprova tra qualche secondo.', en: 'Please retry in a moment.', fr: 'Réessayez dans un instant.',
    de: 'Bitte gleich erneut versuchen.', es: 'Inténtalo de nuevo en un momento.', ae: 'حاول مرة أخرى بعد لحظات.',
  },
};

const TryPlatformCta = () => {
  const { pick, locale } = useSite();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reveal after scroll past the hero — keeps the first impression clean.
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 360);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Don't shout when the prospect is already inside the Studio.
  useEffect(() => {
    const path = window.location.pathname || '';
    if (path.startsWith('/settings') || path.startsWith('/dashboard')) setVisible(false);
  }, []);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(`${BACKEND_URL}/api/demo/magic-link`, {});
      const token = data?.session?.access_token;
      if (!token) throw new Error('no token');
      // Drop the session into localStorage exactly like /api/auth/login does
      // so the global `api` client picks it up via the request interceptor.
      // AuthContext stores the WHOLE session JSON under `mfd_session` — match
      // that exact shape so a full reload re-hydrates a logged-in user.
      const sessionPayload = {
        access_token:  token,
        refresh_token: data.session.refresh_token,
        expires_at:    data.session.expires_at,
      };
      localStorage.setItem('mfd_session', JSON.stringify(sessionPayload));
      localStorage.setItem('mfd_demo_mode', '1');                  // surfaces the demo ribbon
      // Full reload (not SPA navigate) so AuthProvider re-hydrates with the
      // freshly-minted token and ProtectedRoute lets us into /settings/*.
      window.location.href = data.redirect || '/settings/storefront?demo=1&step=intro';
    } catch (e) {
      setError(pick(COPY.error));
      setLoading(false);
    }
  };

  if (!visible) return null;
  return (
    <div className="exe-try-cta" data-testid="try-platform-cta-root" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <button
        type="button"
        className="exe-try-cta__btn"
        onClick={handleClick}
        disabled={loading}
        aria-live="polite"
        data-testid="try-platform-cta-btn"
      >
        <span className="exe-try-cta__pulse" aria-hidden="true" />
        <span className="exe-try-cta__icon">
          {loading
            ? <Loader2 size={14} className="exe-try-cta__spin" strokeWidth={1.7} />
            : <ArrowUpRight size={14} strokeWidth={1.7} />}
        </span>
        <span className="exe-try-cta__text">
          <span className="exe-try-cta__label">{loading ? pick(COPY.loading) : pick(COPY.label)}</span>
          <span className="exe-try-cta__hint">{pick(COPY.hint)}</span>
        </span>
      </button>
      {error && (
        <p className="exe-try-cta__error" role="alert" data-testid="try-platform-cta-error">{error}</p>
      )}
    </div>
  );
};

export default TryPlatformCta;
