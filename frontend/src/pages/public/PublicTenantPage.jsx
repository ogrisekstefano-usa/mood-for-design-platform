/**
 * PublicTenantPage — runtime composition for public tenant routes.
 *
 * Routes handled (via React Router):
 *   /:tenantSlug              → loads page slug "homepage"
 *   /:tenantSlug/:pageSlug    → loads any published page
 *
 * Loads tenant config (theme, locales, navigation, footer) once, applies
 * theme to :root, then renders <PublicNavigation/> + <BlueprintPageRenderer/>
 * + <PublicFooter/>. NO hardcoded UI — everything driven by API responses.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { applyTheme } from '../../contexts/BlueprintContext';
import { pickString } from '../../i18n/engine';
import BlueprintPageRenderer from '../../blueprint/PageRenderer';
import PublicNavigation from './PublicNavigation';
import PublicFooter from './PublicFooter';
import { PublicLocaleContext, detectInitialLocale } from './publicLocale';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

// Routes that must NEVER be matched as tenant slugs
const RESERVED_SLUGS = new Set([
  'auth', 'dashboard', 'admin', 'workspace', 'moodboards', 'inspirations',
  'insights', 'settings', 'form', 'public', 'api', 'static', 'assets',
  'login', 'signup', 'logout',
  // Public storefront routes (Phase Y onwards)
  'magazine', 'start-project', 'professionals', 'onboarding', 'projects',
  'review', 'presentation', 'moodboard', 'client', 'f',
]);

const PublicTenantPage = () => {
  const { tenantSlug, pageSlug } = useParams();
  const [tenant, setTenant] = useState(null);
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [locale, setLocale] = useState(detectInitialLocale());

  // Reserved-slug short-circuit (defensive — React Router already prioritises specific routes)
  const isReserved = RESERVED_SLUGS.has((tenantSlug || '').toLowerCase());

  // Load tenant config + page in parallel
  useEffect(() => {
    if (isReserved) { setLoading(false); setNotFound(true); return; }
    let cancelled = false;
    async function load() {
      setLoading(true); setNotFound(false);
      try {
        const [tRes, pRes] = await Promise.all([
          axios.get(`${BACKEND}/api/public/tenants/${tenantSlug}`),
          axios.get(`${BACKEND}/api/public/tenants/${tenantSlug}/pages/${pageSlug || 'homepage'}`),
        ]);
        if (cancelled) return;
        setTenant(tRes.data);
        setPage(pRes.data);
        applyTheme(tRes.data?.theme);
        // Choose locale: stored → tenant default → 'en-US'
        const tenantDefault = tRes.data?.locales?.default || 'en-US';
        if (!localStorage.getItem('mfd_public_locale')) setLocale(tenantDefault);
        document.title = (pRes.data?.title || tRes.data?.name || 'Studio') + ' — ' + (tRes.data?.name || '');
      } catch (e) {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tenantSlug, pageSlug, isReserved]);

  const ctxValue = useMemo(() => ({ locale, setLocale, tenant }), [locale, tenant]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bp-bg)]">
        <div className="w-5 h-5 border-2 border-[var(--bp-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (notFound || !tenant || !page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bp-bg)] flex-col gap-4">
        <p className="bp-eyebrow text-[var(--bp-text-muted)]">{pickString('errors.notFound.code', locale)}</p>
        <h1 className="bp-h1">{pickString('errors.notFound.title', locale)}</h1>
      </div>
    );
  }

  return (
    <PublicLocaleContext.Provider value={ctxValue}>
      <div className="min-h-screen bg-[var(--bp-bg)] text-[var(--bp-text-primary)]" data-testid="public-tenant-page">
        <PublicNavigation nav={tenant.navigation} brand={{ name: tenant.name, logo: tenant.logo_url }}
          locales={tenant.locales?.available || []} />
        <main>
          <BlueprintPageRenderer page={page} previewLocale={locale} />
        </main>
        <PublicFooter footer={tenant.footer} brand={{ name: tenant.name }} />
      </div>
    </PublicLocaleContext.Provider>
  );
};

export default PublicTenantPage;
