/**
 * StudioV2Layout — V2 funnel wrapper.
 * Lives inside the classic MOOD chrome (MinimalNav + Footer). Only adds
 * a discreet progress bar above the content; no duplicate logo/header.
 */
import React from 'react';

const StudioV2Layout = ({ stepIndex = 0, totalSteps = 5, children }) => {
  const progress = Math.min(stepIndex + 1, totalSteps) / totalSteps;
  return (
    <div
      data-testid="studio-v2-layout"
      style={{
        // Top padding leaves room for the fixed MinimalNav (h-[92px]).
        paddingTop: 92 + 24,
        paddingBottom: 80,
        position: 'relative',
        minHeight: 'calc(100vh - 92px)',
      }}
    >
      {/* Subtle ambient backdrop — geometric, no photos */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background:
          'radial-gradient(ellipse 700px 500px at 18% 12%, rgba(0,201,179,0.06) 0%, transparent 60%),' +
          'radial-gradient(ellipse 600px 450px at 86% 88%, rgba(122,167,255,0.04) 0%, transparent 60%)',
      }} />

      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-16"
           style={{ position: 'relative', zIndex: 1 }}>
        {/* Discreet progress strip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          marginBottom: 24, opacity: 0.9,
        }}>
          <div data-testid="step-progress" style={{
            flex: 1, height: 2,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 2, overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress * 100}%`, height: '100%',
              background: 'var(--mood-teal, #00C9B3)',
              transition: 'width 480ms cubic-bezier(.4,0,.2,1)',
            }} />
          </div>
          <span style={{
            fontSize: '0.72rem', color: 'var(--mood-text-2, rgba(255,255,255,0.5))',
            letterSpacing: '0.14em', fontFamily: 'Inter, sans-serif',
            minWidth: 56, textAlign: 'right',
          }} data-testid="step-counter">
            {String(Math.min(stepIndex + 1, totalSteps)).padStart(2, '0')} / {String(totalSteps).padStart(2, '0')}
          </span>
        </div>

        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default StudioV2Layout;
