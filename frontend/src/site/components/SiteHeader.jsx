/**
 * SiteHeader — Mood for Design™ cinematic storefront chrome.
 *
 * Mockup layout (single dark row, full-bleed):
 *
 *  ┌──────────────────────────────────────────────────────────────────────┐
 *  │  MOOD            ARREDARE SPAZI.     CHI SIAMO  SERVIZI  …    🌐 IT │
 *  │  for             COSTRUIRE                                          │
 *  │  DESIGN™         RELAZIONI.                              [ ACCEDI ] │
 *  └──────────────────────────────────────────────────────────────────────┘
 *
 *  • LEFT — stacked serif wordmark (LEFT-aligned) + tagline sibling.
 *    Both come from `branding_settings.public_brand_name / tagline`.
 *    Logo image takes precedence when `primary_logo_url` is set.
 *  • CENTER — main nav from `branding_settings.public_nav.main_links`.
 *  • RIGHT — language switcher (toggle via `nav.show_lang_switcher`)
 *    and an outline `ACCEDI` pill (label from `nav.login_label`).
 *
 *  Surface: dark cinematic. Inherits typography tokens from `exe.css`.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Globe, ChevronDown } from 'lucide-react';
import { useSite } from '../SiteContext';
import { usePublicBrand } from '../usePublicBrand';
import { usePositioning, resolveProjectsNavLabel } from '../usePositioning';
import { publicLanguages } from '../content/languages';
import { tenantConfig } from '../content/tenant';

const isHash = (h) => h && h.startsWith('#');

const pickLabel = (label, locale) => {
  if (label == null) return '';
  if (typeof label === 'string') return label;
  const chain = [locale, locale?.split('-')[0], 'it', 'en-US', 'en', 'fr', 'de', 'es'];
  for (const code of chain) if (code && label[code]) return label[code];
  return Object.values(label)[0] || '';
};


const BrandMark = ({ brand }) => {
  const tagline = brand?.tagline;
  const inner = (() => {
    if (brand?.primary_logo_url) {
      return (
        <img
          src={brand.primary_logo_url}
          alt={brand?.name || ''}
          className="mfd-header__logo-img"
          data-testid="site-brand-logo"
        />
      );
    }
    const name = brand?.name || 'Studio';
    const suffix = brand?.suffix || '';
    const parts = name.split(/\s+/);
    const stacked = parts.length >= 3;
    return stacked ? (
      <span className="mfd-header__wordmark mfd-header__wordmark--stacked" data-testid="site-brand-name">
        <span>{parts[0]}</span>
        <span className="mfd-header__wordmark-mid">{parts[1]}</span>
        <span>{parts.slice(2).join(' ')}{suffix}</span>
      </span>
    ) : (
      <span className="mfd-header__wordmark" data-testid="site-brand-name">{name}{suffix}</span>
    );
  })();
  return (
    <div className="mfd-header__brand-block">
      <Link to="/" className="mfd-header__brand" data-testid="site-brand" aria-label={brand?.name}>
        {inner}
      </Link>
      {tagline && (
        <span className="mfd-header__tagline" data-testid="site-brand-tagline">{tagline}</span>
      )}
    </div>
  );
};


const LanguageSwitcher = () => {
  const { locale, setLocale } = useSite();
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const langs = publicLanguages();
  const active = langs.find((l) => l.code === locale) || langs[0];

  return (
    <div className="mfd-header__lang" ref={ref}>
      <button
        type="button"
        className="mfd-header__lang-btn"
        onClick={() => setOpen((v) => !v)}
        data-testid="header-lang-toggle"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe size={14} strokeWidth={1.5} aria-hidden />
        <span className="mfd-header__lang-code">{active?.short || 'IT'}</span>
        <ChevronDown size={12} strokeWidth={1.5} aria-hidden />
      </button>
      {open && (
        <ul className="mfd-header__lang-menu" role="listbox" data-testid="header-lang-menu">
          {langs.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                role="option"
                aria-selected={l.code === locale}
                className={`mfd-header__lang-item ${l.code === locale ? 'is-active' : ''}`}
                onClick={() => { setLocale(l.code); setOpen(false); }}
                data-testid={`header-lang-option-${l.short.toLowerCase()}`}
              >
                <span className="mfd-header__lang-item-code">{l.short}</span>
                <span className="mfd-header__lang-item-name">{l.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};


const SiteHeader = () => {
  const { locale } = useSite();
  const { brand, nav } = usePublicBrand(tenantConfig.slug, locale);
  const { positioning } = usePositioning(locale);
  const projectsNavOverride = resolveProjectsNavLabel(positioning, locale);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
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

  const mainLinks = nav?.main_links || [];
  const accediLabel = pickLabel(nav?.login_label, locale) || 'Rientra';
  const navEmpty = mainLinks.length === 0;

  const renderLink = (link, opts = {}) => {
    let label = pickLabel(link.label, locale);
    // Step B Phase 3: subtle positioning-driven nav nuance for the Projects link.
    if (projectsNavOverride && (link.id === 'progetti' || link.id === 'projects' || (link.href || '').includes('/projects'))) {
      label = projectsNavOverride;
    }
    const cls = opts.mobile ? 'mfd-header__mobile-link' : 'mfd-header__navlink';
    const testid = opts.mobile ? `site-mobile-nav-${link.id}` : `site-nav-${link.id}`;
    if (isHash(link.href)) {
      return <a key={link.id} href={link.href} className={cls} data-testid={testid}>{label}</a>;
    }
    return <Link key={link.id} to={link.href} className={cls} data-testid={testid}>{label}</Link>;
  };

  return (
    <header
      className={`mfd-header ${scrolled ? 'mfd-header--scrolled' : ''}`}
      data-testid="site-header"
    >
      <div className="mfd-header__inner">
        <BrandMark brand={brand} />

        <nav className="mfd-header__nav" aria-label="Primary">
          {navEmpty ? (
            <span className="mfd-header__nav-empty" data-testid="site-nav-empty" title="Configure navigation in Experience Studio">
              {/* Intentional empty-state — zero hardcoded fallback. */}
              &nbsp;
            </span>
          ) : mainLinks.map((l) => renderLink(l))}
        </nav>

        <div className="mfd-header__right">
          {/* ITER167: language switcher rimosso dalla topbar.
              Country & Language vive solo nel footer (Market & Locale™). */}
          {nav?.show_login !== false && (
            <Link
              to={nav?.login_href || '/access'}
              className="mfd-header__cta"
              data-testid="header-cta-login"
            >
              {accediLabel}
            </Link>
          )}
        </div>

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

      {mobileOpen && (
        <div className="mfd-header__mobile" role="dialog" aria-modal="true" data-testid="site-mobile-menu">
          <nav aria-label="Mobile primary" className="mfd-header__mobile-nav">
            {mainLinks.map((l) => renderLink(l, { mobile: true }))}
            {nav?.show_login !== false && (
              <Link
                to={nav?.login_href || '/access'}
                className="mfd-header__cta mfd-header__cta--mobile"
                data-testid="header-mobile-cta-login"
              >
                {accediLabel}
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default SiteHeader;
