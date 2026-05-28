/**
 * MovementEntrance — /studio
 *
 * The first page. ~12 seconds of contemplation.
 * - Single full-bleed photograph with slow Ken-Burns drift.
 * - One serif headline. One italic sublead. One pill CTA.
 * - A whisper of a return link for those already inside MOOD.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudioActivationLayout from './StudioActivationLayout';
import { useActivationDraft } from './useActivationDraft';
import { useStudioManifest } from './useStudioManifest';

const MovementEntrance = () => {
  const navigate = useNavigate();
  const { manifest, t, ready: manifestReady } = useStudioManifest();
  const { draft, patch, resumed, ready: draftReady } = useActivationDraft();
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    if (draftReady && draft && draft.current_movement === 'entrance') {
      // No movement bump — stay here; the click on CTA advances.
    }
  }, [draftReady, draft]);

  const beginComposition = () => {
    patch({ movement: 'practice' });
    setTimeout(() => navigate('/studio/practice'), 480);
  };

  const heroImage = manifest?.entrance_image_url || '';
  const ready = manifestReady && draftReady;

  return (
    <StudioActivationLayout movement="entrance" resumed={resumed}>
      {/* Full-bleed photograph + cinematic vignette */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <div
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: heroImage ? `url("${heroImage}")` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: imgLoaded ? 1 : 0,
            transition: 'opacity 1400ms ease',
            animation: imgLoaded ? 'studioKenBurns 38s ease-in-out infinite alternate' : 'none',
            transformOrigin: 'center',
          }}
        />
        {/* Vignette + cinematic gradients */}
        <div style={{
          position: 'absolute', inset: 0,
          background:
            'radial-gradient(ellipse at 50% 50%, transparent 0%, rgba(5,5,5,0.45) 70%, rgba(5,5,5,0.85) 100%),' +
            'linear-gradient(to bottom, rgba(5,5,5,0.55) 0%, transparent 30%, transparent 60%, rgba(5,5,5,0.8) 100%)',
        }} />
      </div>

      {/* Hidden preload image to trigger the fade */}
      {heroImage && (
        <img
          src={heroImage}
          alt=""
          aria-hidden="true"
          onLoad={() => setImgLoaded(true)}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0,
                   pointerEvents: 'none' }}
        />
      )}

      {/* Editorial composition */}
      <div
        style={{
          position: 'absolute', inset: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(96px, 1fr) minmax(auto, 720px) minmax(96px, 1fr)',
          alignItems: 'center',
          padding: '0 0 80px 0',
        }}
      >
        <div /> {/* left gutter */}
        <div className={ready ? 'studio-rise' : ''} style={{ paddingTop: 60 }}>
          <p data-testid="entrance-eyebrow"
              style={{
                margin: 0,
                fontSize: '0.74rem',
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
                color: '#00C9B3',
                opacity: 0.95,
              }}>
            {t['studio.activation.entrance.eyebrow'] || ' '}
          </p>

          <h1 data-testid="entrance-headline"
               style={{
                 margin: '34px 0 0 0',
                 fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif',
                 fontWeight: 400,
                 fontSize: 'clamp(2.4rem, 5.0vw, 4.2rem)',
                 lineHeight: 1.08,
                 letterSpacing: '-0.012em',
                 color: '#FFFFFF',
                 textWrap: 'balance',
               }}>
            {t['studio.activation.entrance.headline'] || ' '}
          </h1>

          <p data-testid="entrance-sublead"
              style={{
                margin: '30px 0 0 0',
                fontFamily: '"Playfair Display", Georgia, serif',
                fontStyle: 'italic',
                fontSize: 'clamp(1.05rem, 1.5vw, 1.25rem)',
                lineHeight: 1.55,
                maxWidth: '46ch',
                color: 'rgba(255,255,255,0.82)',
              }}>
            {t['studio.activation.entrance.sublead'] || ' '}
          </p>

          <div style={{ marginTop: 56, display: 'flex', alignItems: 'center', gap: 28 }}>
            <button
              data-testid="entrance-cta"
              onClick={beginComposition}
              style={{
                appearance: 'none',
                background: '#00C9B3',
                color: '#000000',
                border: 'none',
                padding: '16px 30px',
                borderRadius: 999,
                fontFamily: '"Helvetica Neue", Arial, sans-serif',
                fontSize: '0.82rem',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'transform 280ms cubic-bezier(0.22,1,0.36,1), box-shadow 280ms ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 32px rgba(0,201,179,0.32)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {t['studio.activation.entrance.cta'] || ' '}
            </button>
          </div>
        </div>
        <div /> {/* right gutter */}
      </div>

      {/* Whisper return link, bottom-center */}
      <div
        style={{
          position: 'absolute',
          bottom: 36, left: 0, right: 0,
          display: 'flex', justifyContent: 'center',
          zIndex: 20,
        }}
      >
        <a
          href="/accedi"
          data-testid="entrance-return"
          style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontStyle: 'italic',
            fontSize: 13,
            color: 'rgba(255,255,255,0.55)',
            textDecoration: 'none',
            letterSpacing: '0.01em',
            transition: 'color 280ms ease',
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = 'rgba(0,201,179,0.95)')}
          onMouseOut={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
        >
          {t['studio.activation.entrance.return_link'] || ' '}{'  '}
          <span style={{ marginLeft: 6, opacity: 0.7 }}>
            {t['studio.activation.entrance.return_destination'] || ' '} →
          </span>
        </a>
      </div>
    </StudioActivationLayout>
  );
};

export default MovementEntrance;
