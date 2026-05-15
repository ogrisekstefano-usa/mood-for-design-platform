/**
 * PlatformFooterBar — global Blueprint OS™ branding bar.
 *
 * One reusable component, three surface variants. Keeps the platform
 * footprint quietly visible across the entire MOOD for DESIGN™
 * ecosystem (OS · Storefront · Corporate · Auth · Settings) without
 * becoming visually heavy.
 *
 *   <PlatformFooterBar surface="os"          />  ← Blueprint chrome
 *   <PlatformFooterBar surface="storefront"  />  ← tenant public site
 *   <PlatformFooterBar surface="corporate"   />  ← www.moodfordesign.com
 *
 * Visual rules (per platform spec):
 *   • Height 36–44px
 *   • Minimal horizontal bar — NOT a marketing footer
 *   • Left  : © YEAR Blueprint OS™
 *   • Center: Powered by MOOD for DESIGN™ (desktop only)
 *   • Right : Privacy · Terms & Conditions
 *
 * Excluded from:
 *   • fullscreen presentation mode  (via the `hideInFullscreen` prop)
 *   • exported PDFs / kiosk / demo  (renderer decides whether to mount)
 */
import React, { useEffect, useState } from 'react';

const PRIVACY_URL = 'https://www.moodfordesign.com/privacy';
const TERMS_URL   = 'https://www.moodfordesign.com/terms-conditions';

const surfaceStyles = {
  os: {
    bar: 'border-t border-[var(--bp-border)] bg-[var(--bp-bg)] text-[var(--bp-text-muted)]',
    link: 'text-[var(--bp-text-secondary)] hover:text-[var(--bp-text-primary)]',
    divider: 'text-[var(--bp-text-subtle)]',
    brand: 'text-[var(--bp-text-secondary)]',
  },
  storefront: {
    bar: 'border-t border-[rgba(0,0,0,0.08)] bg-[var(--brand-bg,#FAF8F3)] text-[rgba(20,20,20,0.55)]',
    link: 'text-[rgba(20,20,20,0.7)] hover:text-[rgba(20,20,20,0.95)]',
    divider: 'text-[rgba(20,20,20,0.3)]',
    brand: 'text-[rgba(20,20,20,0.65)]',
  },
  corporate: {
    bar: 'border-t border-[rgba(255,255,255,0.06)] bg-[#0E0E0E] text-[#7A766F]',
    link: 'text-[#B7B1A7] hover:text-[#F5F3EE]',
    divider: 'text-[#3C3935]',
    brand: 'text-[#B7B1A7]',
  },
};

const useIsFullscreen = () => {
  const [fs, setFs] = useState(false);
  useEffect(() => {
    const handler = () => setFs(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handler);
    handler();
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);
  return fs;
};

const PlatformFooterBar = ({
  surface = 'os',
  showCenterLine = true,
  hideInFullscreen = true,
  className = '',
}) => {
  const isFullscreen = useIsFullscreen();
  if (hideInFullscreen && isFullscreen) return null;

  const s = surfaceStyles[surface] || surfaceStyles.os;
  const year = new Date().getFullYear();

  return (
    <footer
      data-testid="platform-footer-bar"
      data-platform-surface={surface}
      className={`w-full ${s.bar} ${className}`}
      style={{ minHeight: 40 }}
    >
      <div className="max-w-full px-5 sm:px-8 h-10 flex items-center justify-between gap-4 text-[11px] font-body tracking-[0.01em]">
        {/* LEFT — copyright */}
        <p className={`flex items-center gap-1.5 ${s.brand}`}>
          <span>©</span>
          <span>{year}</span>
          <span>Blueprint&nbsp;OS™</span>
        </p>

        {/* CENTER — desktop only */}
        {showCenterLine && (
          <p className={`hidden md:block ${s.brand} tracking-[0.14em] uppercase text-[10px]`}>
            Powered by MOOD for DESIGN™
          </p>
        )}

        {/* RIGHT — legal links */}
        <nav className="flex items-center gap-3">
          <a
            href={PRIVACY_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="platform-footer-privacy"
            className={`${s.link} transition-colors`}
          >
            Privacy
          </a>
          <span className={s.divider} aria-hidden="true">·</span>
          <a
            href={TERMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="platform-footer-terms"
            className={`${s.link} transition-colors`}
          >
            Terms
          </a>
        </nav>
      </div>
    </footer>
  );
};

export default PlatformFooterBar;
