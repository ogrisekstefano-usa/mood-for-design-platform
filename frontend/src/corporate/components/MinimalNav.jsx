import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import { useSiteNavigation } from '../hooks/useSiteChrome';
import LocaleSwitcher from './LocaleSwitcher';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_editorial-platform-4/artifacts/chlucgqo_Artboard%201.png";

const LogoLink = ({ compact = false }) => (
  <Link to="/" className="inline-flex items-center" style={{ textDecoration: 'none' }} data-testid="nav-logo">
    <img
      src={LOGO_URL}
      alt="MOOD for DESIGN"
      style={{ height: compact ? 40 : 50, width: 'auto', display: 'block' }}
      draggable={false}
    />
  </Link>
);

/**
 * MinimalNav — ITER149 navigation.
 * 100% DB-driven via /api/site/navigation.
 * Items: Magazine · Projects · Materials · About · Sign In
 * Primary CTA:  Begin Journey
 * Secondary CTA: Professional Access (compact)
 */
const MinimalNav = () => {
  const location = useLocation();
  const { main, cta, secondary_cta } = useSiteNavigation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const showSolid = scrolled || mobileOpen;

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
      style={{
        background: showSolid ? 'rgba(0,0,0,0.78)' : 'transparent',
        backdropFilter: showSolid ? 'blur(20px) saturate(140%)' : 'none',
        borderBottom: showSolid ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
      }}
      data-testid="minimal-nav"
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 flex items-center h-[88px]">
        <LogoLink />

        {/* Center main nav */}
        <div className="hidden lg:flex items-center gap-8 xl:gap-10 mx-auto">
          {main.map(item => (
            <Link
              key={item.key}
              to={item.href}
              className="transition-colors duration-200"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontSize: '0.78rem',
                fontWeight: 500,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                color: location.pathname === item.href ? '#00C9B3' : 'rgba(255,255,255,0.85)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#00C9B3')}
              onMouseLeave={(e) => (e.currentTarget.style.color = location.pathname === item.href ? '#00C9B3' : 'rgba(255,255,255,0.85)')}
              data-testid={`nav-link-${item.key}`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Right cluster: locale + CTAs */}
        <div className="hidden lg:flex items-center gap-4 ml-auto">
          <LocaleSwitcher dark />
          {secondary_cta && (
            <Link
              to={secondary_cta.href}
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontSize: '0.72rem',
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.85)',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#00C9B3')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
              data-testid="nav-secondary-cta"
            >
              {secondary_cta.label}
            </Link>
          )}
          {cta && (
            <Link to={cta.href} className="btn-pill-teal" style={{ padding: '0.65rem 1.4rem', fontSize: '0.72rem' }} data-testid="nav-primary-cta">
              {cta.label}
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="lg:hidden ml-auto p-2"
          style={{ color: '#FFFFFF' }}
          onClick={() => setMobileOpen(o => !o)}
          aria-label="Toggle menu"
          data-testid="mobile-menu-toggle"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div
          className="lg:hidden px-6 py-8 space-y-5 border-t"
          style={{ background: 'rgba(0,0,0,0.96)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.06)' }}
        >
          {main.map(item => (
            <Link
              key={item.key}
              to={item.href}
              style={{ display: 'block', fontFamily: 'Montserrat,sans-serif', fontSize: '0.95rem', fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#FFFFFF', textDecoration: 'none' }}
              data-testid={`mobile-nav-${item.key}`}
            >
              {item.label}
            </Link>
          ))}
          {secondary_cta && (
            <Link to={secondary_cta.href} style={{ display: 'block', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>
              {secondary_cta.label}
            </Link>
          )}
          <div className="pt-4 border-t flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <LocaleSwitcher dark />
            {cta && (
              <Link to={cta.href} className="btn-pill-teal" style={{ padding: '0.6rem 1.2rem', fontSize: '0.72rem' }}>
                {cta.label}
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default MinimalNav;
