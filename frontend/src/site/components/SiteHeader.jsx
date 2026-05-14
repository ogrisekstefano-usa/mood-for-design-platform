import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSite } from '../SiteContext';
import { navigationContent } from '../content/navigation';
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
  const { pick } = useSite();
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

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
        <img src={navigationContent.brand.logoSrc} alt="MOOD for DESIGN" className="mfd-header__logo" />
        <span className="mfd-header__tagline" data-testid="site-brand-tagline">
          {pick(navigationContent.brand.tagline).split('\n').map((line, i) => (
            <span key={i}>{line}</span>
          ))}
        </span>
      </Link>

      <nav className="mfd-header__nav" aria-label="Primary">
        {navigationContent.header.links.map((link) => (
          isHashLink(link.href) ? (
            <a key={link.id} href={link.href} data-testid={`site-nav-${link.id}`}>{pick(link.label)}</a>
          ) : (
            <Link key={link.id} to={link.href} data-testid={`site-nav-${link.id}`}>{pick(link.label)}</Link>
          )
        ))}
      </nav>

      <div className="mfd-header__right">
        <LocaleSwitcher />
        <Link
          to={navigationContent.header.access.href}
          className="mfd-btn mfd-btn--outline-paper"
          data-testid="site-access-btn"
          style={{ padding: '0.7rem 1.3rem', fontSize: 11 }}
        >
          {pick(navigationContent.header.access.label)}
        </Link>
      </div>
    </header>
  );
};

export default SiteHeader;
