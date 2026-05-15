import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Globe } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import LocaleSwitcher from './LocaleSwitcher';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const MoodLogo = ({ inverted = false }) => (
  <Link to="/" className="flex items-center gap-0" data-testid="corporate-nav-logo">
    <span
      className="font-serif tracking-tight"
      style={{ fontSize: '1.4rem', color: inverted ? '#F9F9F8' : '#0A0A0A', letterSpacing: '-0.02em' }}
    >
      M
    </span>
    <span style={{ display: 'inline-flex', alignItems: 'center', margin: '0 1px' }}>
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" style={{ display: 'inline' }}>
        <circle cx="8" cy="11" r="7" stroke="#3DDAD0" strokeWidth="2" fill="none" />
        <circle cx="14" cy="11" r="7" stroke="#3DDAD0" strokeWidth="2" fill="none" />
      </svg>
    </span>
    <span
      className="font-serif tracking-tight"
      style={{ fontSize: '1.4rem', color: inverted ? '#F9F9F8' : '#0A0A0A', letterSpacing: '-0.02em' }}
    >
      D
    </span>
  </Link>
);

/**
 * CorporateNav — Minimal sticky header for www.moodfordesign.com
 * Glassmorphism on scroll. Locale switcher. CTA button.
 */
const CorporateNav = () => {
  const location = useLocation();
  const { locale } = useLocale();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navItems, setNavItems] = useState([]);
  const [ctaItem, setCtaItem] = useState({ label: 'Start Your Studio', href: '/start-studio' });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/corporate/navigation?locale=${locale}`)
      .then(res => {
        if (res.data?.main) setNavItems(res.data.main);
        if (res.data?.cta) setCtaItem(res.data.cta);
      })
      .catch(() => {});
  }, [locale]);

  const isOnHero = location.pathname === '/';
  const navBg = scrolled || mobileOpen
    ? 'rgba(249,249,248,0.92)'
    : isOnHero ? 'transparent' : 'rgba(249,249,248,0.92)';
  const borderColor = scrolled ? 'rgba(10,10,10,0.1)' : 'transparent';

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
        style={{
          background: navBg,
          backdropFilter: scrolled || !isOnHero ? 'blur(20px)' : 'none',
          borderBottom: `1px solid ${borderColor}`,
        }}
        data-testid="corporate-nav"
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between h-16">

          {/* Logo */}
          <MoodLogo />

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-8">
            {navItems.map(item => (
              <Link
                key={item.key}
                to={item.href}
                className="text-xs font-semibold uppercase tracking-widest transition-colors duration-200"
                style={{
                  color: location.pathname === item.href ? '#3DDAD0' : '#0A0A0A',
                  fontFamily: 'Manrope, sans-serif',
                }}
                data-testid={`nav-link-${item.key}`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right: locale + CTA */}
          <div className="hidden lg:flex items-center gap-4">
            <LocaleSwitcher />
            <Link
              to={ctaItem.href || '/start-studio'}
              className="btn-secondary text-xs"
              data-testid="corporate-nav-cta"
            >
              {ctaItem.label || 'Start Your Studio'}
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 text-[#0A0A0A]"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle navigation"
            data-testid="mobile-menu-toggle"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden bg-[#F9F9F8] border-t border-[rgba(10,10,10,0.1)] px-6 py-8 space-y-6">
            {navItems.map(item => (
              <Link
                key={item.key}
                to={item.href}
                className="block text-sm font-semibold uppercase tracking-widest text-[#0A0A0A]"
                data-testid={`mobile-nav-${item.key}`}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-4 border-t border-[rgba(10,10,10,0.1)] flex items-center justify-between">
              <LocaleSwitcher />
              <Link to="/start-studio" className="btn-primary text-xs" data-testid="mobile-nav-cta">
                {ctaItem.label || 'Start Your Studio'}
              </Link>
            </div>
          </div>
        )}
      </nav>
      {/* Spacer for non-hero pages */}
      {!isOnHero && <div className="h-16" />}
    </>
  );
};

export default CorporateNav;
