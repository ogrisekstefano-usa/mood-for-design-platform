/**
 * PreviewBanner — non-indexable editorial review surface.
 *
 * Shown when ?preview=1 is on the URL. Quiet editorial bar at the top
 * of the article, with a small "exit preview" link. This page also
 * receives <meta name="robots" content="noindex,nofollow"> via
 * ArticleHead so search engines cannot accidentally index drafts.
 */
import React from 'react';
import { useLocation, Link } from 'react-router-dom';

export const PreviewBanner = () => {
  const location = useLocation();
  const exitHref = location.pathname; // preview=1 removed
  return (
    <div
      data-testid="ed-preview-banner"
      style={{
        position: 'sticky', top: 0, zIndex: 90,
        background: '#1c1814', color: '#f7f3ec',
        fontFamily: 'Inter, -apple-system, sans-serif',
        fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase',
        padding: '9px 22px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid rgba(245,236,219,0.12)',
      }}
    >
      <span>
        <span style={{ color: '#c8a572', marginRight: 12 }}>●</span>
        Preview · Internal · Non indicizzata
      </span>
      <Link
        to={exitHref}
        replace
        data-testid="ed-preview-exit"
        style={{ color: 'rgba(245,236,219,0.7)', textDecoration: 'underline', fontSize: 10 }}
      >
        Esci dalla preview
      </Link>
    </div>
  );
};

export default PreviewBanner;
