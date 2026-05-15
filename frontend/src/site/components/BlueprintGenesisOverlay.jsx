/**
 * BlueprintGenesisOverlay — cinematic loading sequence shown after onboarding
 * submission while the backend creates the lead → account → workspace.
 *
 * The component cycles through `narrative` messages with editorial fade
 * transitions. When `complete=true`, it shows the final "Your Blueprint is
 * ready." pulse, then calls `onContinue` after a brief hold for emotional
 * landing.
 *
 * Design notes:
 *   • NO spinner — only a slow vertical line that grows.
 *   • Centered, dark, calm — feels like a film title sequence.
 *   • Each narrative line stays ~1.6s with crossfade.
 */
import React, { useEffect, useState } from 'react';

const STAGE_DURATION_MS = 1600;
const COMPLETE_HOLD_MS = 1400;

const BlueprintGenesisOverlay = ({ narrative = [], complete = false, finalLabel, onContinue }) => {
  const [stage, setStage] = useState(0);
  const [showFinal, setShowFinal] = useState(false);

  useEffect(() => {
    if (complete) return;
    if (stage >= narrative.length - 1) return;
    const t = setTimeout(() => setStage((s) => Math.min(s + 1, narrative.length - 1)), STAGE_DURATION_MS);
    return () => clearTimeout(t);
  }, [stage, narrative.length, complete]);

  useEffect(() => {
    if (!complete) return;
    setShowFinal(true);
    const t = setTimeout(() => onContinue?.(), COMPLETE_HOLD_MS);
    return () => clearTimeout(t);
  }, [complete, onContinue]);

  return (
    <div
      data-testid="blueprint-genesis-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: '#0A0A0A',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: '#EFEBE4',
        fontFamily: 'Georgia, "Cormorant Garamond", serif',
      }}
    >
      {/* Vertical breathing line */}
      <div
        style={{
          width: 1, height: 80, background: '#C9A36E',
          opacity: 0.55,
          animation: 'mfdGenesisLine 1.8s ease-in-out infinite alternate',
          marginBottom: '4rem',
        }}
      />

      {!showFinal && (
        <p
          key={stage}
          data-testid={`genesis-stage-${stage}`}
          style={{
            fontSize: '1.4rem', letterSpacing: '0.02em',
            fontWeight: 300, textAlign: 'center',
            maxWidth: '32rem',
            animation: 'mfdGenesisFade 0.7s ease-out',
          }}
        >
          {narrative[stage] || ''}
        </p>
      )}

      {showFinal && (
        <div data-testid="genesis-complete" style={{ textAlign: 'center', animation: 'mfdGenesisFade 0.8s ease-out' }}>
          <p style={{
            fontSize: '0.65rem', letterSpacing: '0.4em', textTransform: 'uppercase',
            color: '#C9A36E', marginBottom: '1.2rem', fontFamily: 'Inter, system-ui, sans-serif',
          }}>Ready</p>
          <p style={{
            fontSize: '2.4rem', fontWeight: 300, letterSpacing: '-0.01em',
            lineHeight: 1.2, maxWidth: '38rem',
          }}>{finalLabel || narrative[narrative.length - 1] || 'Your Blueprint is ready.'}</p>
        </div>
      )}

      <style>{`
        @keyframes mfdGenesisLine {
          0%   { transform: scaleY(0.5); opacity: 0.35; }
          100% { transform: scaleY(1);   opacity: 0.65; }
        }
        @keyframes mfdGenesisFade {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default BlueprintGenesisOverlay;
