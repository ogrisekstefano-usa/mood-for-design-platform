import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import LocaleSwitcher from './LocaleSwitcher';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * MOOD wordmark — editorial luxury
 * "M" + ⊙⊙ + "D" stacked over "for DESIGN"
 */
export const MoodLogo = ({ light = true, compact = false }) => {
  const textColor = light ? '#FFFFFF' : '#0A1320';
  const subColor  = light ? 'rgba(255,255,255,0.6)' : 'rgba(10,19,32,0.55)';
  const sz = compact ? 18 : 20;
  return (
    <Link to="/" className="inline-flex items-end" style={{ textDecoration: 'none' }} data-testid="corporate-nav-logo">
      <div className="flex flex-col items-start leading-none">
        <span className="flex items-center" style={{ gap: 0 }}>
          <span style={{ fontFamily: 'Montserrat,sans-serif', fontWeight: 600, fontSize: compact ? '1rem' : '1.05rem', color: textColor, letterSpacing: '-0.01em', lineHeight: 1 }}>M</span>
          <svg width={sz*2.1} height={sz} viewBox="0 0 42 20" fill="none" style={{ margin: '0 2px' }}>
            <circle cx="10" cy="10" r="8.5" stroke="#3DDAD0" strokeWidth="1.5" fill="none" />
            <circle cx="22" cy="10" r="8.5" stroke="#3DDAD0" strokeWidth="1.5" fill="none" />
          </svg>
          <span style={{ fontFamily: 'Montserrat,sans-serif', fontWeight: 600, fontSize: compact ? '1rem' : '1.05rem', color: textColor, letterSpacing: '-0.01em', lineHeight: 1 }}>D</span>
        </span>
        {!compact && (
          <span style={{
            fontFamily: 'Montserrat,sans-serif',
            fontSize: '0.5rem',
            letterSpacing: '0.38em',
            fontWeight: 500,
            color: subColor,
            marginTop: 4,
            paddingLeft: 1,
          }}>
            <span style={{ fontFamily: 'Playfair Display,serif', fontStyle: 'italic', textTransform: 'lowercase', letterSpacing: 'normal', marginRight: 4 }}>for</span>
            DESIGN
          </span>
        )}
      </div>
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
  const [ctaItem, setCtaItem] = useState({ label: 'Book a Demo', href: '/start-studio' });

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
        <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 flex items-center h-[72px]">
          <MoodLogo light />

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
                  color: location.pathname === item.href ? '#3DDAD0' : 'rgba(255,255,255,0.82)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#3DDAD0')}
                onMouseLeave={(e) => (e.currentTarget.style.color = location.pathname === item.href ? '#3DDAD0' : 'rgba(255,255,255,0.82)')}
                data-testid={`nav-link-${item.key}`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right cluster */}
          <div className="hidden lg:flex items-center gap-5 ml-auto">
            <LocaleSwitcher dark />
            <Link to={ctaItem.href || '/start-studio'} className="btn-pill-outline-teal" data-testid="corporate-nav-cta">
              {ctaItem.label || 'Book a Demo'}
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
              <Link to="/start-studio" className="btn-pill-outline-teal" data-testid="mobile-nav-cta">
                {ctaItem.label || 'Book a Demo'}
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
