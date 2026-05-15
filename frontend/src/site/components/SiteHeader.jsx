import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSite } from '../SiteContext';
import { navigationContent } from '../content/navigation';
import { tenantConfig } from '../content/tenant';
import { useStorefrontContent, pickContent } from '../useStorefrontContent';
import { Menu, X } from 'lucide-react';

const isHashLink = (href) => href && href.startsWith('#');

const SiteHeader = () => {
  const { pick, locale } = useSite();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  // CMS-driven content (with JS-config fallback)
  const { content: cmsContent, hasDbContent } = useStorefrontContent(
    tenantConfig.slug, 'navigation', navigationContent,
  );

  // Resolve nav_top — DB-first, then legacy fallback
  const navTop = hasDbContent ? cmsContent.nav_top : null;
  const settings = navTop?._settings || {};
  const logoSrc = settings.logo_src || navigationContent.brand.logoSrc;
  const logoSize = Number(settings.logo_size) || 104;
  const linksFromDb = Array.isArray(settings.links) ? settings.links : null;
  const accessHrefFromDb = settings.access_href;

  const links = useMemo(() => {
    if (linksFromDb) {
      return linksFromDb
        .filter((l) => l.visible !== false && l.show_on_desktop !== false)
        .map((l) => ({
          id: l.id || l.href,
          href: l.href,
          open_in_new_tab: !!l.open_in_new_tab,
          is_cta: !!l.is_cta,
          show_on_mobile: l.show_on_mobile !== false,
          label: pickContent(l.label, locale) || '',
        }));
    }
    return navigationContent.header.links.map((l) => ({
      id: l.id, href: l.href,
      open_in_new_tab: false, is_cta: false, show_on_mobile: true,
      label: pick(l.label),
    }));
  }, [linksFromDb, locale, pick]);

  const mobileLinks = useMemo(() => links.filter((l) => l.show_on_mobile !== false), [links]);

  const accessLabel = navTop
    ? (pickContent(
        Object.fromEntries(Object.entries(navTop).filter(([k, v]) => !k.startsWith('_') && v && typeof v === 'object' && 'access_label' in v).map(([k, v]) => [k, v.access_label])),
        locale,
      ) || pick(navigationContent.header.access.label))
    : pick(navigationContent.header.access.label);
  const accessHref = accessHrefFromDb || navigationContent.header.access.href;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = mobileOpen ? 'hidden' : prev || '';
    return () => { document.body.style.overflow = prev || ''; };
  }, [mobileOpen]);

  const isHome = pathname === '/' || pathname === '';

  const renderLink = (link, opts = {}) => {
    const className = link.is_cta ? 'mfd-btn mfd-btn--solid-paper mfd-header__cta' : opts.className;
    const props = link.open_in_new_tab ? { target: '_blank', rel: 'noopener noreferrer' } : {};
    const testid = opts.testidPrefix ? `${opts.testidPrefix}-${link.id}` : `site-nav-${link.id}`;
    if (isHashLink(link.href) || link.open_in_new_tab) {
      return (
        <a key={link.id} href={link.href} className={className} data-testid={testid} {...props}>
          {link.label}
        </a>
      );
    }
    return (
      <Link key={link.id} to={link.href} className={className} data-testid={testid}>
        {link.label}
      </Link>
    );
  };

  return (
    <header
      className={`mfd-header ${scrolled || !isHome ? 'mfd-header--scrolled' : ''}`}
      data-testid="site-header"
    >
      <Link to="/" className="mfd-header__brandgroup" data-testid="site-brand" style={{ textDecoration: 'none' }}>
        <img
          src={logoSrc}
          alt="MOOD for DESIGN"
          className="mfd-header__logo"
          style={{ width: logoSize, height: 'auto' }}
        />
      </Link>

      {/* Desktop nav */}
      <nav className="mfd-header__nav" aria-label="Primary">
        {links.map((link) => renderLink(link))}
      </nav>

      {/* Right cluster — Access button (desktop) + Burger (mobile) */}
      <div className="mfd-header__right">
        <Link
          to={accessHref}
          className="mfd-btn mfd-btn--outline-paper mfd-header__access"
          data-testid="site-access-btn"
          style={{ padding: '0.7rem 1.3rem', fontSize: 11 }}
        >
          {accessLabel}
        </Link>
        <button
          type="button"
          className="mfd-header__burger"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          data-testid="site-burger"
        >
          {mobileOpen ? <X size={22} strokeWidth={1.5} /> : <Menu size={22} strokeWidth={1.5} />}
        </button>
      </div>

      {/* Mobile overlay menu */}
      {mobileOpen && (
        <div className="mfd-mobile-menu" data-testid="site-mobile-menu" role="dialog" aria-modal="true">
          <nav className="mfd-mobile-menu__nav" aria-label="Mobile primary">
            {mobileLinks.map((link) =>
              renderLink(link, { className: 'mfd-mobile-menu__link', testidPrefix: 'site-mobile-nav' })
            )}
            <Link
              to={accessHref}
              className="mfd-btn mfd-btn--solid-paper mfd-mobile-menu__cta"
              data-testid="site-mobile-access-btn"
            >
              {accessLabel}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
};

export default SiteHeader;
