/**
 * MovementPractice — /studio/practice
 *
 * Decision: which design practice are you composing from?
 * Six archetypes as cinematic tiles (not radio buttons). Hovering one
 * raises its opacity and lifts the descriptor; clicking expands it
 * edge-to-edge for a moment of recognition, then advances to Movement III.
 *
 * Layout: 3 × 2 magazine grid with deep negative space.
 * Typography-led. No boxes. No checkboxes. No "Step 2 of 5" indicator.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudioActivationLayout from './StudioActivationLayout';
import { useActivationDraft } from './useActivationDraft';
import { useStudioManifest } from './useStudioManifest';

const MovementPractice = () => {
  const navigate = useNavigate();
  const { manifest, t, ready: manifestReady } = useStudioManifest();
  const { draft, patch, resumed, ready: draftReady } = useActivationDraft();

  const archetypes = manifest?.archetypes || [];
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);   // animating selection
  const [confirming, setConfirming] = useState(false);

  const ready = manifestReady && draftReady;

  const onSelect = (key) => {
    if (selected) return;
    setSelected(key);
    // Also pre-fill the suggested experiences for this archetype so
    // Movement III lands with the curated composition already proposed.
    const suggested = manifest?.archetype_to_suggested?.[key] || [];
    patch({
      archetype: key,
      experiences: suggested,
    });
    // Show confirmation line after the tile expansion
    setTimeout(() => setConfirming(true), 480);
  };

  const onContinue = () => {
    patch({ movement: 'ecosystem' });
    setTimeout(() => navigate('/studio/ecosystem'), 360);
  };

  const onChangePractice = () => {
    setConfirming(false);
    setTimeout(() => setSelected(null), 240);
  };

  return (
    <StudioActivationLayout movement="practice" resumed={resumed}>
      {/* Quiet ambient backdrop — radial light pools */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <div style={{
          position: 'absolute', inset: 0,
          background:
            'radial-gradient(ellipse at 50% 4%, rgba(0,201,179,0.05) 0%, transparent 38%),' +
            'radial-gradient(ellipse at 88% 96%, rgba(255,180,162,0.04) 0%, transparent 50%)',
          animation: 'studioKenBurns 42s ease-in-out infinite alternate',
        }} />
      </div>

      {/* Editorial header */}
      <div
        className={ready ? 'studio-rise' : ''}
        style={{
          position: 'absolute', top: 72, left: 0, right: 0,
          padding: '0 96px',
          textAlign: 'center',
          opacity: selected ? 0 : 1,
          transform: selected ? 'translateY(-12px)' : 'translateY(0)',
          transition: 'opacity 480ms ease, transform 480ms ease',
          pointerEvents: selected ? 'none' : 'auto',
        }}
      >
        <p data-testid="practice-eyebrow"
            style={{
              margin: 0,
              fontSize: '0.7rem',
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              color: '#00C9B3',
              opacity: 0.95,
            }}>
          {t['studio.activation.practice.eyebrow'] || ' '}
        </p>
        <h1 data-testid="practice-headline"
             style={{
               margin: '18px auto 0 auto',
               fontFamily: '"Playfair Display", Georgia, serif',
               fontWeight: 400,
               fontSize: 'clamp(1.7rem, 3.0vw, 2.4rem)',
               lineHeight: 1.12,
               letterSpacing: '-0.005em',
               maxWidth: '24ch',
               color: '#FFFFFF',
             }}>
          {t['studio.activation.practice.headline'] || ' '}
        </h1>
        <p style={{
              margin: '14px auto 0 auto',
              fontFamily: '"Playfair Display", Georgia, serif',
              fontStyle: 'italic',
              fontSize: 'clamp(0.92rem, 1.15vw, 1.02rem)',
              lineHeight: 1.5,
              color: 'rgba(255,255,255,0.65)',
              maxWidth: '52ch',
            }}>
          {t['studio.activation.practice.sublead'] || ' '}
        </p>
      </div>

      {/* Magazine grid (3 × 2) — compact aspect-ratio so all 6 fit */}
      <div
        style={{
          position: 'absolute',
          top: '56%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(1280px, 92vw)',
          display: selected ? 'block' : 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(2, 1fr)',
          gap: 20,
          transition: 'top 480ms ease',
        }}
      >
        {archetypes.map((a, idx) => {
          const isSelected = selected === a.key;
          const isOther    = Boolean(selected) && !isSelected;
          return (
            <PracticeTile
              key={a.key}
              archetype={a}
              title={t[a.title_key] || ''}
              descriptor={t[a.descriptor_key] || ''}
              isHovered={hovered === a.key}
              isSelected={isSelected}
              isOther={isOther}
              order={idx}
              onHover={() => setHovered(a.key)}
              onLeave={() => setHovered(null)}
              onClick={() => onSelect(a.key)}
            />
          );
        })}
      </div>

      {/* Confirmation line + Continue, after selection */}
      {confirming && selected && (
        <div
          style={{
            position: 'absolute',
            bottom: 80, left: 0, right: 0,
            padding: '0 96px',
            textAlign: 'center',
            zIndex: 30,
            animation: 'studioRise 720ms cubic-bezier(0.22,1,0.36,1) both',
          }}
        >
          <p
            data-testid="practice-confirm-line"
            style={{
              margin: 0,
              fontFamily: '"Playfair Display", Georgia, serif',
              fontStyle: 'italic',
              fontSize: 'clamp(1.05rem, 1.5vw, 1.3rem)',
              color: 'rgba(255,255,255,0.85)',
              letterSpacing: '0.01em',
            }}
          >
            {renderConfirmLine(
              t['studio.activation.practice.confirm_line'] || '',
              t[`studio.activation.archetype.${selected}.title`] || '',
            )}
          </p>
          <div style={{ marginTop: 30, display: 'flex',
                          justifyContent: 'center', gap: 24, alignItems: 'center' }}>
            <button
              data-testid="practice-continue"
              onClick={onContinue}
              style={ctaStyle('solid')}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 32px rgba(0,201,179,0.32)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {t['studio.activation.practice.continue_cta'] || 'Continua'}
            </button>
            <button
              data-testid="practice-change"
              onClick={onChangePractice}
              style={ghostLink}
            >
              ← {t['studio.activation.practice.headline'] ? 'Cambia pratica' : 'Cambia'}
            </button>
          </div>
        </div>
      )}

      {/* Bottom right concierge fallback */}
      {!selected && (
        <p
          style={{
            position: 'absolute',
            bottom: 36, right: 36,
            margin: 0,
            fontFamily: '"Playfair Display", Georgia, serif',
            fontStyle: 'italic',
            fontSize: 13,
            color: 'rgba(255,255,255,0.45)',
          }}
        >
          {t['studio.activation.practice.fallback_line'] || ' '}{' '}
          <a
            href="mailto:journey@moodfordesign.com"
            data-testid="practice-fallback-link"
            style={{
              color: 'rgba(0,201,179,0.8)',
              textDecoration: 'underline',
              textUnderlineOffset: 4,
              textDecorationThickness: 1,
            }}
          >
            {t['studio.activation.practice.fallback_link'] || ' '}
          </a>
        </p>
      )}
    </StudioActivationLayout>
  );
};

// ─────────────────────────────────────────────────────────────────
// Tile
// ─────────────────────────────────────────────────────────────────
const PracticeTile = ({
  archetype, title, descriptor,
  isHovered, isSelected, isOther, order,
  onHover, onLeave, onClick,
}) => {
  // Selected → edge-to-edge expansion as background; descriptor centered.
  if (isSelected) {
    return (
      <button
        data-testid={`practice-tile-${archetype.key}-selected`}
        onClick={(e) => e.preventDefault()}
        style={{
          position: 'fixed',
          inset: 0,
          border: 'none',
          padding: 0,
          margin: 0,
          background: 'transparent',
          cursor: 'default',
          zIndex: 25,
          animation: 'studioRise 600ms cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        <div
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url("${archetype.image_url}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.55) saturate(0.85)',
          }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background:
            'radial-gradient(ellipse at 50% 50%, transparent 0%, rgba(5,5,5,0.5) 70%, rgba(5,5,5,0.9) 100%)',
        }} />
      </button>
    );
  }

  return (
    <button
      data-testid={`practice-tile-${archetype.key}`}
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        position: 'relative',
        border: 'none',
        padding: 0,
        margin: 0,
        appearance: 'none',
        background: 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        overflow: 'hidden',
        aspectRatio: '5/4',
        opacity: isOther ? 0 : 1,
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'opacity 480ms ease, transform 420ms cubic-bezier(0.22,1,0.36,1)',
        animation: `studioRise 700ms cubic-bezier(0.22,1,0.36,1) ${order * 80}ms both`,
      }}
    >
      {/* Background image */}
      <div
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("${archetype.image_url}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: isHovered ? 'brightness(0.72) saturate(0.95)' : 'brightness(0.5) saturate(0.85)',
          transform: isHovered ? 'scale(1.04)' : 'scale(1)',
          transition: 'transform 1200ms cubic-bezier(0.22,1,0.36,1), filter 480ms ease',
        }}
      />
      {/* Dark gradient veil for readability */}
      <div style={{
        position: 'absolute', inset: 0,
        background:
          'linear-gradient(to bottom, rgba(5,5,5,0.05) 0%, rgba(5,5,5,0.15) 40%, rgba(5,5,5,0.85) 100%)',
      }} />
      {/* Hairline border */}
      <div style={{
        position: 'absolute', inset: 0,
        border: '1px solid rgba(255,255,255,' + (isHovered ? '0.18' : '0.06') + ')',
        transition: 'border-color 360ms ease',
        pointerEvents: 'none',
      }} />

      {/* Typographic plate */}
      <div
        style={{
          position: 'absolute',
          left: 28, right: 28, bottom: 28,
          color: '#FFFFFF',
        }}
      >
        <p style={{
              margin: 0,
              fontFamily: '"Helvetica Neue", Arial, sans-serif',
              fontSize: '0.66rem',
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: isHovered ? '#00C9B3' : 'rgba(255,255,255,0.55)',
              transition: 'color 320ms ease',
            }}>
          Pratica
        </p>
        <h3 style={{
              margin: '12px 0 0 0',
              fontFamily: '"Playfair Display", Georgia, serif',
              fontWeight: 400,
              fontSize: '1.6rem',
              lineHeight: 1.15,
              letterSpacing: '-0.005em',
            }}>
          {title}
        </h3>
        <p style={{
              margin: '14px 0 0 0',
              fontFamily: '"Playfair Display", Georgia, serif',
              fontStyle: 'italic',
              fontSize: '0.95rem',
              lineHeight: 1.5,
              color: 'rgba(255,255,255,0.78)',
              maxHeight: isHovered ? 120 : 0,
              opacity: isHovered ? 1 : 0,
              overflow: 'hidden',
              transition: 'max-height 560ms cubic-bezier(0.22,1,0.36,1), opacity 480ms ease',
            }}>
          {descriptor}
        </p>
      </div>
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────
const renderConfirmLine = (tpl, practiceTitle) => {
  // Replace {practice} with the practice title rendered in italic emphasis.
  if (!tpl) return practiceTitle;
  const parts = tpl.split('{practice}');
  return (
    <>
      {parts[0]}
      <span style={{ color: '#00C9B3', fontStyle: 'normal',
                       fontFamily: '"Playfair Display", Georgia, serif',
                       letterSpacing: '0.005em' }}>
        {practiceTitle}
      </span>
      {parts[1] || ''}
    </>
  );
};

const ctaStyle = (variant) => ({
  appearance: 'none',
  background: variant === 'solid' ? '#00C9B3' : 'transparent',
  color: variant === 'solid' ? '#000000' : 'rgba(255,255,255,0.85)',
  border: variant === 'solid' ? 'none' : '1px solid rgba(255,255,255,0.22)',
  padding: '16px 30px',
  borderRadius: 999,
  fontFamily: '"Helvetica Neue", Arial, sans-serif',
  fontSize: '0.82rem',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'transform 280ms cubic-bezier(0.22,1,0.36,1), box-shadow 280ms ease',
});

const ghostLink = {
  appearance: 'none',
  background: 'transparent',
  border: 'none',
  padding: 0,
  fontFamily: '"Playfair Display", Georgia, serif',
  fontStyle: 'italic',
  fontSize: '0.95rem',
  color: 'rgba(255,255,255,0.55)',
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: 4,
  textDecorationThickness: 1,
};

export default MovementPractice;
