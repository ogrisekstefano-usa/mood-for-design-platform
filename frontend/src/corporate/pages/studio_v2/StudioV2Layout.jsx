/**
 * StudioV2Layout — sober chrome for the public visitor funnel.
 * - Single column, generous negative space.
 * - Discreet progress bar (no "Movement N of 6").
 * - No real photographs.
 */
import React from 'react';
import { Link } from 'react-router-dom';

const StudioV2Layout = ({ stepIndex = 0, totalSteps = 5, children }) => {
  const progress = Math.min(stepIndex + 1, totalSteps) / totalSteps;
  return (
    <div
      data-testid="studio-v2-layout"
      style={{
        minHeight: '100vh',
        background: '#0A0A0B',
        color: '#F4F4F5',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top bar */}
      <header style={{
        padding: '24px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Link to="/" style={{
          color: '#F4F4F5',
          textDecoration: 'none',
          letterSpacing: '0.22em',
          fontSize: '0.72rem',
          textTransform: 'uppercase',
        }}>MOOD for DESIGN</Link>
        <div data-testid="step-progress" style={{
          width: 220, height: 2, background: 'rgba(255,255,255,0.08)',
          borderRadius: 2, overflow: 'hidden',
        }}>
          <div style={{
            width: `${progress * 100}%`, height: '100%',
            background: '#00C9B3',
            transition: 'width 480ms cubic-bezier(.4,0,.2,1)',
          }} />
        </div>
        <span style={{
          fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)',
          letterSpacing: '0.12em',
        }} data-testid="step-counter">
          {Math.min(stepIndex + 1, totalSteps)} / {totalSteps}
        </span>
      </header>

      {/* Subtle ambient backdrop — geometric, no photos */}
      <div aria-hidden style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background:
          'radial-gradient(ellipse 800px 600px at 18% 12%, rgba(0,201,179,0.06) 0%, transparent 60%),' +
          'radial-gradient(ellipse 700px 500px at 86% 88%, rgba(122,167,255,0.04) 0%, transparent 60%)',
      }} />

      {/* Main content */}
      <main style={{
        flex: 1, position: 'relative', zIndex: 1,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 24px 80px',
      }}>
        <div style={{ width: '100%', maxWidth: 780 }}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default StudioV2Layout;
