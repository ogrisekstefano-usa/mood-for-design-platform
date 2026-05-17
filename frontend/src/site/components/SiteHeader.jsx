/**
 * SiteHeader — tenant-driven public storefront header.
 *
 * Layout (single row, left-aligned brand):
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │  [LOGO]   Home · Servizi · Progetti · Contatti      [↪]  [+]    │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 *  • Logo on the LEFT — dynamic from /api/storefront/public/{slug}/brand
 *    (image when `primary_logo_url` is set, typographic wordmark otherwise).
 *    NEVER hardcoded.
 *  • Main nav comes from `branding_settings.public_nav.main_links` so the
 *    tenant admin can edit it from Brand Studio. Sensible default:
 *    Home · Servizi · Progetti · Contatti.
 *  • RIGHT — two minimal icons: Sign-in (LogIn) + Register (UserPlus).
 *    Toggleable per tenant via `show_login` / `show_register`.
 *  • NO language switcher. NO Magazine / PMS / Members Area chrome.
 */
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, LogIn, UserPlus } from 'lucide-react';
import { useSite } from '../SiteContext';
import { usePublicBrand } from '../usePublicBrand';
import { tenantConfig } from '../content/tenant';

const isHash = (href) => href && href.startsWith('#');

// Locale-aware label resolver — works whether labels come back as plain
// strings or as `{ it, en-US, ... }` bags from the brand endpoint.
const pickLabel = (label, locale) => {
  if (label == null) return '';
  if (typeof label === 'string') return label;
  if (typeof label !== 'object') return String(label);
  const chain = [locale, 'it', 'en-US', 'en-GB', 'fr', 'de', 'es'];
  for (const code of chain) if (label[code]) return label[code];
  return Object.values(label)[0] || '';
};


const BrandMark = ({ brand }) => {
  const hasLogo = !!brand?.primary_logo_url;
  if (hasLogo) {
    return (
      <Link
        to="/"
        className="exe-header__brand exe-header__brand--left"
        data-testid="site-brand"
        aria-label={brand?.name || 'Studio'}
      >
        <img
          src={brand.primary_logo_url}
          alt={brand?.name || ''}
          className="exe-header__brand-logo"
          data-testid="site-brand-logo"
        />
        {brand?.tagline && (
          <span className="exe-header__brand-tagline" data-testid="site-brand-tagline">
            {brand.tagline}
          </span>
        )}
      </Link>
    );
  }
  return (
    <Link
      to="/"
      className="exe-header__brand exe-header__brand--left"
      data-testid="site-brand"
    >
      <span className="exe-header__wordmark" data-testid="site-brand-name">
        {brand?.name || 'Studio'}
      </span>
      {brand?.tagline && (
        <span className="exe-header__brand-tagline" data-testid="site-brand-tagline">
          {brand.tagline}
        </span>
      )}
    </Link>
  );
};


const AccessIcons = ({ nav }) => (
  <div className="exe-header__access" role="group" aria-label="Account">
    {nav?.show_login !== false && (
      <Link
        to={nav?.login_href || '/auth/login'}
        className="exe-header__icon-btn"
        aria-label="Sign in"
        title="Sign in"
        data-testid="header-icon-login"
      >
        <LogIn size={18} strokeWidth={1.6} aria-hidden />
      </Link>
    )}
    {nav?.show_register !== false && (
      <Link
        to={nav?.register_href || '/auth/register'}
        className="exe-header__icon-btn"
        aria-label="Register"
        title="Register"
        data-testid="header-icon-register"
      >
        <UserPlus size={18} strokeWidth={1.6} aria-hidden />
      </Link>
    )}
  </div>
);


const SiteHeader = () => {
  const { locale } = useSite();
  const { brand, nav } = usePublicBrand(tenantConfig.slug);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = mobileOpen ? 'hidden' : prev || '';
    return () => { document.body.style.overflow = prev || ''; };
  }, [mobileOpen]);

  const mainLinks = (nav?.main_links || []);

  const renderLink = (link, opts = {}) => {
    const label = pickLabel(link.label, locale);
    const cls = opts.mobile ? 'exe-mobile-menu__link' : 'exe-header__navlink';
    const testid = opts.mobile ? `site-mobile-nav-${link.id}` : `site-nav-${link.id}`;
    if (isHash(link.href)) {
      return <a key={link.id} href={link.href} className={cls} data-testid={testid}>{label}</a>;
    }
    return <Link key={link.id} to={link.href} className={cls} data-testid={testid}>{label}</Link>;
  };

  return (
    <header
      className={`exe-header exe-header--lean ${scrolled ? 'exe-header--scrolled' : ''}`}
      data-testid="site-header"
    >
      <div className="exe-header__row">
        {/* LEFT — brand */}
        <BrandMark brand={brand} />

        {/* CENTER/RIGHT — main nav */}
        <nav className="exe-header__nav" aria-label="Primary">
          {mainLinks.map((l) => renderLink(l))}
        </nav>

        {/* FAR RIGHT — access icons */}
        <AccessIcons nav={nav} />

        {/* Mobile burger */}
        <button
          type="button"
          className="exe-header__burger"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          data-testid="site-burger"
        >
          {mobileOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="exe-mobile-menu" role="dialog" aria-modal="true" data-testid="site-mobile-menu">
          <nav className="exe-mobile-menu__nav" aria-label="Mobile primary">
            {mainLinks.map((l) => renderLink(l, { mobile: true }))}
            <div className="exe-mobile-menu__access">
              {nav?.show_login !== false && (
                <Link
                  to={nav?.login_href || '/auth/login'}
                  className="exe-mobile-menu__link"
                  data-testid="site-mobile-icon-login"
                >
                  <LogIn size={16} strokeWidth={1.6} aria-hidden /> Sign in
                </Link>
              )}
              {nav?.show_register !== false && (
                <Link
                  to={nav?.register_href || '/auth/register'}
                  className="exe-mobile-menu__link"
                  data-testid="site-mobile-icon-register"
                >
                  <UserPlus size={16} strokeWidth={1.6} aria-hidden /> Register
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default SiteHeader;
