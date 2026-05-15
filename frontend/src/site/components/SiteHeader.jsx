/**
 * SiteHeader — EXE INTERIOR demo storefront header.
 *
 * Layout (mockup-exact):
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │ [IT EN DE FR ES AE]   EXE INTERIOR   [Magazine | PMS | Area] [CTA]
 *   │                       Italian Design Excellence
 *   ├────────────────────────────────────────────────────────────────┤
 *   │   Home · Servizi · Progetti · A&D Partnership · Magazine · …
 *   └────────────────────────────────────────────────────────────────┘
 *
 * Fully CMS-driven through navigationContent (locale-keyed). Top utility row,
 * centered serif wordmark, then horizontal main-nav row below.
 */
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSite } from '../SiteContext';
import { navigationContent } from '../content/navigation';
import { publicLanguages } from '../content/languages';
import { Menu, X } from 'lucide-react';

const isHash = (href) => href && href.startsWith('#');

const SiteHeader = () => {
  const { pick, locale, setLocale } = useSite();
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

  const brand = navigationContent.brand;
  const langs = publicLanguages();
  const utility = navigationContent.header.utility || [];
  const links = navigationContent.header.links;
  const access = navigationContent.header.access;
  const cta = navigationContent.header.cta;

  const renderLink = (link, isCta = false) => {
    const cls = isCta ? 'exe-header__cta' : 'exe-header__navlink';
    const label = pick(link.label);
    if (isHash(link.href)) {
      return <a key={link.id} href={link.href} className={cls} data-testid={`site-nav-${link.id}`}>{label}</a>;
    }
    return <Link key={link.id} to={link.href} className={cls} data-testid={`site-nav-${link.id}`}>{label}</Link>;
  };

  return (
    <header className={`exe-header ${scrolled ? 'exe-header--scrolled' : ''}`} data-testid="site-header">
      {/* ── TOP UTILITY ROW ─────────────────────────────────────── */}
      <div className="exe-header__top">
        <div className="exe-header__lang" role="group" aria-label="Language">
          {langs.map((l) => (
            <button
              key={l.code}
              type="button"
              className={`exe-header__lang-btn ${l.code === locale ? 'is-active' : ''}`}
              onClick={() => setLocale(l.code)}
              data-testid={`lang-${l.short.toLowerCase()}`}
              aria-pressed={l.code === locale}
            >
              {l.short}
            </button>
          ))}
        </div>

        <Link to="/" className="exe-header__brand" data-testid="site-brand">
          <div className="exe-header__wordmark">{brand.name}{brand.suffix}</div>
          <div className="exe-header__tagline">{pick(brand.tagline)}</div>
        </Link>

        <div className="exe-header__util">
          {utility.map((u) => (
            isHash(u.href)
              ? <a   key={u.id} href={u.href} className="exe-header__util-link" data-testid={`util-${u.id}`}>{pick(u.label)}</a>
              : <Link key={u.id} to={u.href} className="exe-header__util-link" data-testid={`util-${u.id}`}>{pick(u.label)}</Link>
          ))}
          <span className="exe-header__util-sep" aria-hidden="true" />
          {isHash(cta.href)
            ? <a   href={cta.href} className="exe-header__cta-pill" data-testid="header-cta">{pick(cta.label)}</a>
            : <Link to={cta.href} className="exe-header__cta-pill" data-testid="header-cta">{pick(cta.label)}</Link>}
        </div>

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

      {/* ── MAIN NAV ROW ───────────────────────────────────────── */}
      <nav className="exe-header__nav" aria-label="Primary">
        {links.map((l) => renderLink(l))}
      </nav>

      {/* ── MOBILE MENU ───────────────────────────────────────── */}
      {mobileOpen && (
        <div className="exe-mobile-menu" role="dialog" aria-modal="true" data-testid="site-mobile-menu">
          <nav className="exe-mobile-menu__nav" aria-label="Mobile primary">
            {links.map((l) => (
              isHash(l.href)
                ? <a   key={l.id} href={l.href} className="exe-mobile-menu__link" data-testid={`site-mobile-nav-${l.id}`}>{pick(l.label)}</a>
                : <Link key={l.id} to={l.href} className="exe-mobile-menu__link" data-testid={`site-mobile-nav-${l.id}`}>{pick(l.label)}</Link>
            ))}
            <div className="exe-mobile-menu__util">
              {utility.map((u) => (
                isHash(u.href)
                  ? <a   key={u.id} href={u.href} className="exe-mobile-menu__util">{pick(u.label)}</a>
                  : <Link key={u.id} to={u.href} className="exe-mobile-menu__util">{pick(u.label)}</Link>
              ))}
            </div>
            {isHash(cta.href)
              ? <a   href={cta.href} className="exe-mobile-menu__cta" data-testid="site-mobile-cta">{pick(cta.label)}</a>
              : <Link to={cta.href} className="exe-mobile-menu__cta" data-testid="site-mobile-cta">{pick(cta.label)}</Link>}
            <Link to={access.href} className="exe-mobile-menu__util" data-testid="site-mobile-access-btn">{pick(access.label)}</Link>
          </nav>
        </div>
      )}
    </header>
  );
};

export default SiteHeader;
