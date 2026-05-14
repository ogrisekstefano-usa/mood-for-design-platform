import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSite } from '../SiteContext';
import { navigationContent } from '../content/navigation';
import { Globe } from 'lucide-react';

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
        <Globe size={12} style={{ marginRight: 6, verticalAlign: '-1px' }} />
        {current.label}
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

  // Force scrolled style off only on the homepage hero
  const isHome = pathname === '/' || pathname === '';

  return (
    <header
      className={`mfd-header ${scrolled || !isHome ? 'mfd-header--scrolled' : ''}`}
      data-testid="site-header"
    >
      <Link to="/" className="mfd-header__brand" data-testid="site-brand">
        <span>{navigationContent.brand.name}<sup>{navigationContent.brand.suffix}</sup></span>
        <small>{pick(navigationContent.brand.tagline)}</small>
      </Link>
      <nav className="mfd-header__nav" aria-label="Primary">
        {navigationContent.header.links.map((link) => (
          <Link
            key={link.id}
            to={link.href}
            data-testid={`site-nav-${link.id}`}
          >
            {pick(link.label)}
          </Link>
        ))}
      </nav>
      <div className="mfd-header__right">
        <LocaleSwitcher />
        <Link
          to={navigationContent.header.access.href}
          className="mfd-btn mfd-btn--solid"
          data-testid="site-access-btn"
          style={{ padding: '0.65rem 1.1rem', fontSize: 11 }}
        >
          {pick(navigationContent.header.access.label)}
        </Link>
      </div>
    </header>
  );
};

export default SiteHeader;
