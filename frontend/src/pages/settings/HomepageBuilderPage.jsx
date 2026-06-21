/**
 * HomepageBuilderPage — DEPRECATED (ITER157.A · Unify & Connect)
 *
 * The Homepage Builder pipeline (`/api/blueprint/pages/:slug`) has been
 * unified with the canonical Storefront CMS™ at `/blueprint/experience`.
 *
 * This route now renders a refined deprecation notice and redirects
 * within 5 seconds. The legacy implementation is preserved in git
 * history (commit before ITER157.A) for archive reference.
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Layers } from 'lucide-react';

const HomepageBuilderPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => navigate('/blueprint/experience', { replace: true }), 5000);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div
      data-testid="homepage-builder-deprecated"
      style={{
        minHeight: '70vh',
        display: 'grid', placeItems: 'center',
        padding: '64px 24px',
        background: 'var(--bp-bg)',
      }}
    >
      <div
        style={{
          maxWidth: 580,
          textAlign: 'left',
          padding: 40,
          border: '1px solid var(--bp-border)',
          borderRadius: 16,
          background: 'var(--bp-surface-2)',
          display: 'grid', gap: 18,
        }}
      >
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          width: 'fit-content',
          padding: '4px 10px',
          border: '1px solid var(--bp-border)',
          borderRadius: 999,
          fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: 'var(--bp-text-muted)',
        }}>
          <Layers size={11} strokeWidth={1.6} /> Legacy · ITER157.A
        </div>
        <h1 style={{
          fontFamily: 'var(--bp-font-display, "Cormorant Garamond", serif)',
          fontStyle: 'italic',
          fontSize: 32, lineHeight: 1.2,
          color: 'var(--bp-text-primary)',
          margin: 0,
        }}>
          This experience is now managed inside Website Studio.
        </h1>
        <p style={{
          fontFamily: 'var(--bp-font-body)',
          fontSize: 14, lineHeight: 1.6,
          color: 'var(--bp-text-muted)',
          margin: 0,
        }}>
          La Public Editorial Infrastructure™ ora vive in un'unica pipeline.
          La gestione delle pagine, dei blocchi e degli asset si fa da
          <em> Website Studio</em>.
        </p>
        <button
          type="button"
          onClick={() => navigate('/blueprint/experience', { replace: true })}
          data-testid="homepage-builder-deprecated-cta"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            width: 'fit-content',
            padding: '10px 16px',
            background: 'var(--bp-primary, #00C9B3)',
            color: '#0a0e10', border: 'none', borderRadius: 999,
            fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase',
            cursor: 'pointer',
            fontFamily: 'var(--bp-font-body)',
          }}
        >
          Apri Website Studio <ArrowRight size={13} strokeWidth={2} />
        </button>
        <p style={{ fontSize: 11, color: 'var(--bp-text-subtle)', margin: 0 }}>
          Verrai reindirizzato automaticamente fra qualche secondo.
        </p>
      </div>
    </div>
  );
};

export default HomepageBuilderPage;
