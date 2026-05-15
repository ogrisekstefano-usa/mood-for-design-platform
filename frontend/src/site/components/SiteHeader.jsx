import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSite } from '../SiteContext';
import { navigationContent } from '../content/navigation';
import { tenantConfig } from '../content/tenant';
import { useStorefrontContent, pickContent } from '../useStorefrontContent';
import { Globe, ChevronDown } from 'lucide-react';

const LocaleSwitcher = () => {
  const { locale, setLocale, locales } = useSite();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const current = locales.find((l) => l.code === locale) || locales[0];

  return (
    <div className="mfd-locale" ref={ref}>
      <button
        type="button"
        className="mfd-locale__btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid="site-locale-btn"
      >
        <Globe size={12} /> {current.label} <ChevronDown size={12} />
      </button>
      {open && (
        <div className="mfd-locale__menu" role="listbox" data-testid="site-locale-menu">
          {locales.map((l) => (
            <button
              key={l.code}
              type="button"
              className="mfd-locale__item"
              aria-current={l.code === locale}
              onClick={() => { setLocale(l.code); setOpen(false); }}
              data-testid={`site-locale-${l.code}`}
            >
              <span>{l.label}</span>
              <small>{l.native}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const isHashLink = (href) => href && href.startsWith('#');

const SiteHeader = () => {
  const { pick, locale } = useSite();
  const [scrolled, setScrolled] = useState(false);
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
      // DB shape: { id, href, label: locale_bag, visible, show_on_desktop, show_on_mobile, is_cta, open_in_new_tab }
      return linksFromDb
        .filter((l) => l.visible !== false && l.show_on_desktop !== false)
        .map((l) => ({
          id: l.id || l.href,
          href: l.href,
          open_in_new_tab: !!l.open_in_new_tab,
          is_cta: !!l.is_cta,
          label: pickContent(l.label, locale) || '',
        }));
    }
    // Legacy fallback (navigation.js)
    return navigationContent.header.links.map((l) => ({
      id: l.id, href: l.href,
      open_in_new_tab: false, is_cta: false,
      label: pick(l.label),
    }));
  }, [linksFromDb, locale, pick]);

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

  const isHome = pathname === '/' || pathname === '';

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
          style={{ width: logoSize, height: logoSize }}
        />
      </Link>

      <nav className="mfd-header__nav" aria-label="Primary">
        {links.map((link) => {
          const className = link.is_cta ? 'mfd-btn mfd-btn--solid-paper mfd-header__cta' : undefined;
          const props = link.open_in_new_tab ? { target: '_blank', rel: 'noopener noreferrer' } : {};
          if (isHashLink(link.href)) {
            return (
              <a key={link.id} href={link.href} className={className} data-testid={`site-nav-${link.id}`} {...props}>
                {link.label}
              </a>
            );
          }
          if (link.open_in_new_tab) {
            return (
              <a key={link.id} href={link.href} className={className} data-testid={`site-nav-${link.id}`} {...props}>
                {link.label}
              </a>
            );
          }
          return (
            <Link key={link.id} to={link.href} className={className} data-testid={`site-nav-${link.id}`}>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="mfd-header__right">
        <LocaleSwitcher />
        <Link
          to={accessHref}
          className="mfd-btn mfd-btn--outline-paper"
          data-testid="site-access-btn"
          style={{ padding: '0.7rem 1.3rem', fontSize: 11 }}
        >
          {accessLabel}
        </Link>
      </div>
    </header>
  );
};

export default SiteHeader;
