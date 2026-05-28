/**
 * MovementEcosystem — /studio/ecosystem
 *
 * Five Experiences as horizontal editorial bands. Each band has a
 * serif title, italic descriptor, and a quiet italic toggle phrase:
 *   "— inclusa nella tua composizione."  /  "— non per ora."
 * Pre-selection adapts to the archetype chosen in Movement II.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudioActivationLayout from './StudioActivationLayout';
import { useActivationDraft } from './useActivationDraft';
import { useStudioManifest } from './useStudioManifest';

const MovementEcosystem = () => {
  const navigate = useNavigate();
  const { manifest, t, ready: manifestReady } = useStudioManifest();
  const { draft, patch, resumed, ready: draftReady } = useActivationDraft();

  const experiences = manifest?.experiences || [];
  const suggested = useMemo(() => {
    if (!manifest || !draft?.archetype) return [];
    return manifest.archetype_to_suggested?.[draft.archetype] || [];
  }, [manifest, draft?.archetype]);

  const [selected, setSelected] = useState(null);
  const [initialised, setInitialised] = useState(false);

  // Adopt experiences once both draft + manifest are ready.
  // Priority: persisted draft.experiences (resumed flow) → archetype-suggested.
  useEffect(() => {
    if (initialised || !draftReady || !manifestReady) return;
    const persisted = (draft?.experiences || []);
    if (persisted.length > 0) {
      setSelected(new Set(persisted));
    } else if (suggested.length > 0) {
      setSelected(new Set(suggested));
      patch({ experiences: suggested });
    } else {
      setSelected(new Set());
    }
    setInitialised(true);
  }, [draftReady, manifestReady, draft?.experiences, suggested, initialised, patch]);

  const toggle = (key) => {
    const next = new Set(selected || []);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
    patch({ experiences: Array.from(next) });
  };

  const onContinue = () => {
    patch({ movement: 'identity' });
    setTimeout(() => navigate('/studio/identity'), 360);
  };

  const onBack = () => {
    patch({ movement: 'practice' });
    setTimeout(() => navigate('/studio/practice'), 240);
  };

  const ready = manifestReady && draftReady && selected !== null;

  return (
    <StudioActivationLayout movement="ecosystem" resumed={resumed}>
      {/* Ambient backdrop */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <div style={{
          position: 'absolute', inset: 0,
          background:
            'radial-gradient(ellipse at 50% 8%, rgba(0,201,179,0.05) 0%, transparent 40%),' +
            'radial-gradient(ellipse at 92% 95%, rgba(255,180,162,0.045) 0%, transparent 55%)',
          animation: 'studioKenBurns 42s ease-in-out infinite alternate',
        }} />
      </div>

      {/* Editorial header */}
      <div
        className={ready ? 'studio-rise' : ''}
        style={{
          position: 'absolute', top: 88, left: 0, right: 0,
          padding: '0 120px',
          textAlign: 'center',
        }}
      >
        <p style={EYEBROW_STYLE} data-testid="ecosystem-eyebrow">
          {t['studio.activation.ecosystem.eyebrow'] || ' '}
        </p>
        <h1 style={HEADLINE_STYLE} data-testid="ecosystem-headline">
          {t['studio.activation.ecosystem.headline'] || ' '}
        </h1>
        <p style={SUBLEAD_STYLE}>
          {t['studio.activation.ecosystem.sublead'] || ' '}
        </p>
      </div>

      {/* Horizontal bands list — vertically scrollable on demand */}
      <div
        style={{
          position: 'absolute',
          top: 286, bottom: 144,
          left: '50%', transform: 'translateX(-50%)',
          width: 'min(1160px, 92vw)',
          overflowY: 'auto',
          paddingRight: 12,
        }}
        data-testid="ecosystem-list"
      >
        {experiences.map((exp, idx) => {
          const included = selected?.has(exp.key);
          return (
            <ExperienceBand
              key={exp.key}
              experience={exp}
              title={t[exp.title_key] || ''}
              descriptor={t[exp.descriptor_key] || ''}
              included={included}
              includedLine={t['studio.activation.ecosystem.included_line'] || '— included.'}
              excludeLine={t['studio.activation.ecosystem.exclude_line'] || '— not for now.'}
              onClick={() => toggle(exp.key)}
              order={idx}
            />
          );
        })}
      </div>

      {/* Bottom action bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 36, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          gap: 28, zIndex: 30,
        }}
      >
        <button
          data-testid="ecosystem-back"
          onClick={onBack}
          style={ghostLink}
        >
          ← {t['studio.activation.practice.headline'] ? 'Cambia pratica' : 'Indietro'}
        </button>
        <button
          data-testid="ecosystem-continue"
          onClick={onContinue}
          style={ctaSolid}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 10px 32px rgba(0,201,179,0.32)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {t['studio.activation.ecosystem.continue_cta'] || 'Continua'}
        </button>
      </div>

      {/* Helper line */}
      <p
        style={{
          position: 'absolute', bottom: 92, left: 0, right: 0,
          textAlign: 'center', margin: 0,
          fontFamily: '"Playfair Display", Georgia, serif',
          fontStyle: 'italic',
          fontSize: 13,
          color: 'rgba(255,255,255,0.4)',
        }}
      >
        {t['studio.activation.ecosystem.helper'] || ' '}
      </p>
    </StudioActivationLayout>
  );
};

const ExperienceBand = ({
  experience, title, descriptor,
  included, includedLine, excludeLine,
  onClick, order,
}) => {
  return (
    <button
      data-testid={`ecosystem-band-${experience.key}`}
      onClick={onClick}
      style={{
        appearance: 'none',
        background: 'transparent',
        border: 'none',
        padding: '28px 32px',
        margin: '0 0 16px 0',
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        position: 'relative',
        borderTop: order === 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        transition: 'background 360ms ease',
        animation: `studioRise 700ms cubic-bezier(0.22,1,0.36,1) ${order * 90}ms both`,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ display: 'flex', alignItems: 'baseline',
                     justifyContent: 'space-between', gap: 28 }}>
        <h3 style={{
              margin: 0,
              fontFamily: '"Playfair Display", Georgia, serif',
              fontWeight: 400,
              fontSize: 'clamp(1.45rem, 2.4vw, 1.95rem)',
              lineHeight: 1.15,
              color: included ? '#FFFFFF' : 'rgba(255,255,255,0.62)',
              transition: 'color 360ms ease',
              letterSpacing: '-0.005em',
            }}>
          {title}
        </h3>
        <span
          data-testid={`ecosystem-band-${experience.key}-state`}
          style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontStyle: 'italic',
            fontSize: '0.92rem',
            color: included ? '#00C9B3' : 'rgba(255,255,255,0.35)',
            whiteSpace: 'nowrap',
            transition: 'color 360ms ease',
          }}
        >
          {included ? includedLine : excludeLine}
        </span>
      </div>
      <p style={{
            margin: '10px 0 0 0',
            fontFamily: '"Playfair Display", Georgia, serif',
            fontStyle: 'italic',
            fontSize: '0.98rem',
            lineHeight: 1.55,
            color: included ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.42)',
            maxWidth: '74ch',
            transition: 'color 360ms ease',
          }}>
        {descriptor}
      </p>
    </button>
  );
};

// ─── Shared styles
const EYEBROW_STYLE = {
  margin: 0, fontSize: '0.7rem', letterSpacing: '0.32em',
  textTransform: 'uppercase', color: '#00C9B3', opacity: 0.95,
  fontFamily: '"Helvetica Neue", Arial, sans-serif',
};
const HEADLINE_STYLE = {
  margin: '18px auto 0 auto',
  fontFamily: '"Playfair Display", Georgia, serif',
  fontWeight: 400,
  fontSize: 'clamp(1.7rem, 3.0vw, 2.4rem)',
  lineHeight: 1.12,
  letterSpacing: '-0.005em',
  maxWidth: '24ch',
  color: '#FFFFFF',
};
const SUBLEAD_STYLE = {
  margin: '14px auto 0 auto',
  fontFamily: '"Playfair Display", Georgia, serif',
  fontStyle: 'italic',
  fontSize: 'clamp(0.92rem, 1.15vw, 1.02rem)',
  lineHeight: 1.5,
  color: 'rgba(255,255,255,0.65)',
  maxWidth: '52ch',
};

const ctaSolid = {
  appearance: 'none', background: '#00C9B3', color: '#000',
  border: 'none', padding: '16px 30px', borderRadius: 999,
  fontFamily: '"Helvetica Neue", Arial, sans-serif',
  fontSize: '0.82rem', letterSpacing: '0.16em',
  textTransform: 'uppercase', fontWeight: 500, cursor: 'pointer',
  transition: 'transform 280ms cubic-bezier(0.22,1,0.36,1), box-shadow 280ms ease',
};
const ghostLink = {
  appearance: 'none', background: 'transparent', border: 'none', padding: 0,
  fontFamily: '"Playfair Display", Georgia, serif',
  fontStyle: 'italic', fontSize: '0.95rem',
  color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
  textDecoration: 'underline', textUnderlineOffset: 4, textDecorationThickness: 1,
};

export default MovementEcosystem;
