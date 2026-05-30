import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import LocaleSwitcher from './LocaleSwitcher';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * MOOD official logo — uses the brand asset PNG (no SVG reconstruction).
 */
const LOGO_URL = "https://customer-assets.emergentagent.com/job_editorial-platform-4/artifacts/chlucgqo_Artboard%201.png";

export const MoodLogo = ({ compact = false }) => {
  const h = compact ? 44 : 56;
  return (
    <Link to="/" className="inline-flex items-center" style={{ textDecoration: 'none' }} data-testid="corporate-nav-logo">
      <img
        src={LOGO_URL}
        alt="MOOD for DESIGN — Inspiration. Design. Solutions."
        style={{ height: h, width: 'auto', display: 'block' }}
        draggable={false}
      />
    </Link>
  );
};

/**
 * CorporateNav — Dark editorial nav.
 * Transparent on hero scroll-top, dark glassmorphism on scroll/non-hero pages.
 */
const CorporateNav = () => {
  const location = useLocation();
  const { locale } = useLocale();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navItems, setNavItems] = useState([]);
  const [ctaItem, setCtaItem] = useState({ label: 'Apri uno Studio', href: '/studio' });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/corporate/navigation?locale=${locale}`)
      .then(res => {
        if (res.data?.main) setNavItems(res.data.main);
        if (res.data?.cta)  setCtaItem(res.data.cta);
      }).catch(() => {});
  }, [locale]);

  const showSolid = scrolled || mobileOpen;

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
        style={{
          background: showSolid ? 'rgba(10,19,32,0.82)' : 'transparent',
          backdropFilter: showSolid ? 'blur(18px) saturate(140%)' : 'none',
          borderBottom: showSolid ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        }}
        data-testid="corporate-nav"
      >
        <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 flex items-center h-[88px]">
          <MoodLogo />

          {/* Center nav */}
          <div className="hidden lg:flex items-center gap-7 xl:gap-9 mx-auto">
            {navItems.map(item => (
              <Link
                key={item.key}
                to={item.href}
                className="transition-colors duration-200"
                style={{
                  fontFamily: 'Montserrat,sans-serif',
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  color: location.pathname === item.href ? '#00C9B3' : 'rgba(255,255,255,0.82)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#00C9B3')}
                onMouseLeave={(e) => (e.currentTarget.style.color = location.pathname === item.href ? '#00C9B3' : 'rgba(255,255,255,0.82)')}
                data-testid={`nav-link-${item.key}`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right cluster */}
          <div className="hidden lg:flex items-center gap-5 ml-auto">
            <LocaleSwitcher dark />
            <Link to={ctaItem.href || '/studio'} className="btn-pill-outline-teal" data-testid="corporate-nav-cta">
              {ctaItem.label || 'Apri uno Studio'}
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden ml-auto p-2"
            style={{ color: '#FFFFFF' }}
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle menu"
            data-testid="mobile-menu-toggle"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {mobileOpen && (
          <div
            className="lg:hidden px-6 py-8 space-y-5 border-t"
            style={{ background: 'rgba(10,19,32,0.96)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.06)' }}
          >
            {navItems.map(item => (
              <Link
                key={item.key}
                to={item.href}
                style={{ display: 'block', fontFamily: 'Montserrat,sans-serif', fontSize: '0.85rem', fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#FFFFFF', textDecoration: 'none' }}
                data-testid={`mobile-nav-${item.key}`}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-4 border-t flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <LocaleSwitcher dark />
              <Link to={ctaItem.href || '/studio'} className="btn-pill-outline-teal" data-testid="mobile-nav-cta">
                {ctaItem.label || 'Apri uno Studio'}
              </Link>
            </div>
          </div>
        )}
      </nav>
      <div style={{ height: 0 }} />
    </>
  );
};

export default CorporateNav;
