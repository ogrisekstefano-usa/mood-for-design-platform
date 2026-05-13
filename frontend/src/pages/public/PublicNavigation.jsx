/**
 * PublicNavigation — luxury top nav, schema-driven, locale-aware.
 *
 * Behaviour:
 *  - Transparent over hero when `transparent_on_hero` set and at top of page
 *  - Glass / solid surface after scroll
 *  - Mobile: collapses to drawer
 *  - Renders items from schema: link / mega / cta
 *  - Logo: tenant logo asset OR text fallback (using bp-eyebrow style)
 */
import React, { useEffect, useState } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';
import { usePublicLocale, resolveI18nLabel } from './publicLocale';

const PublicNavigation = ({ nav, brand, locales = [] }) => {
  const { locale, setLocale } = usePublicLocale();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const transparent = nav?.transparent_on_hero !== false;
  const sticky = nav?.sticky !== false;

  useEffect(() => {
    if (!transparent) { setScrolled(true); return; }
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [transparent]);

  const items = (nav?.items || []).filter((i) => i.visible !== false);
  const cta = nav?.cta;

  const Logo = () => (
    <a href="/" className="flex items-center gap-3" data-testid="public-nav-logo">
      {brand.logo ? (
        <img src={brand.logo} alt={brand.name} className="h-7 object-contain" />
      ) : (
        <span className="bp-eyebrow !text-[var(--bp-text-primary)] !text-xs">{brand.name || 'Studio'}</span>
      )}
    </a>
  );

  const onSelectLocale = (l) => {
    setLocale(l);
    localStorage.setItem('mfd_public_locale', l);
  };

  return (
    <header className={`${sticky ? 'sticky top-0' : ''} z-40 transition-all duration-[var(--bp-duration-slow)] ease-[var(--bp-ease)] ${
      scrolled
        ? 'bp-glass border-b border-[var(--bp-border)]'
        : 'bg-transparent border-b border-transparent'
    }`}
    data-testid="public-navigation">
      <div className="bp-container px-[var(--bp-section-x)] h-16 flex items-center justify-between gap-6">
        <Logo />

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {items.map((item) => (
            <NavItem key={item.id} item={item} locale={locale} />
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {nav?.show_locale_switcher && locales.length > 1 && (
            <select value={locale} onChange={(e) => onSelectLocale(e.target.value)}
              data-testid="public-nav-locale"
              className="bg-transparent text-[var(--bp-text-secondary)] text-xs font-mono uppercase tracking-[0.18em] focus:outline-none cursor-pointer">
              {locales.map((l) => <option key={l} value={l} className="bg-[var(--bp-surface-1)]">{l}</option>)}
            </select>
          )}
          {cta?.label && (
            <a href={cta.href || '#'} className="hidden md:inline-flex bp-btn bp-btn-primary" data-testid="public-nav-cta">
              {resolveI18nLabel(cta.label, locale)}
            </a>
          )}
          <button onClick={() => setOpen(!open)} className="md:hidden text-[var(--bp-text-primary)]" data-testid="public-nav-menu-btn">
            {open ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden bp-glass border-t border-[var(--bp-border)]">
          <nav className="bp-container px-[var(--bp-section-x)] py-6 flex flex-col gap-5">
            {items.map((item) => (
              <a key={item.id} href={item.href || '#'} onClick={() => setOpen(false)}
                className="bp-h3 text-[var(--bp-text-primary)] hover:text-[var(--bp-primary)]">
                {resolveI18nLabel(item.label, locale)}
              </a>
            ))}
            {cta?.label && (
              <a href={cta.href || '#'} className="bp-btn bp-btn-primary w-fit">
                {resolveI18nLabel(cta.label, locale)}
              </a>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

const NavItem = ({ item, locale }) => {
  const [open, setOpen] = useState(false);
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;

  if (item.type === 'mega' && hasChildren) {
    return (
      <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
        <button className="flex items-center gap-1 bp-body !text-sm text-[var(--bp-text-secondary)] hover:text-[var(--bp-text-primary)]">
          {resolveI18nLabel(item.label, locale)}
          <ChevronDown size={12} strokeWidth={1.5} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-2 min-w-[280px] bp-glass border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] p-4 animate-fadeIn">
            <ul className="space-y-2">
              {item.children.map((c, i) => (
                <li key={i}>
                  <a href={c.href || '#'} className="block px-3 py-2 rounded-[var(--bp-radius-sm)] hover:bg-[var(--bp-surface-2)] bp-body !text-sm text-[var(--bp-text-secondary)] hover:text-[var(--bp-primary)]">
                    {resolveI18nLabel(c.label, locale)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <a href={item.href || '#'} className="bp-body !text-sm text-[var(--bp-text-secondary)] hover:text-[var(--bp-text-primary)] transition-colors">
      {resolveI18nLabel(item.label, locale)}
    </a>
  );
};

export default PublicNavigation;
