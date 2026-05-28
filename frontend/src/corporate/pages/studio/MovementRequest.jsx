/**
 * MovementRequest — /studio/request
 *
 * Final movement. NOT an "activation complete" — a calm reception.
 * The studio is received as a qualified request. A MOOD Advisor
 * follows up manually. NO talk of accounts, login, plans, or activation.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudioActivationLayout from './StudioActivationLayout';
import { useStudioManifest } from './useStudioManifest';

const STORAGE_KEY = 'mood_studio_request';
const DRAFT_TOKEN_KEY = 'mood_studio_draft_token';

const MovementRequest = () => {
  const navigate = useNavigate();
  const { t } = useStudioManifest();
  const [info, setInfo] = useState(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setInfo(JSON.parse(raw));
    } catch { /* silent */ }
    // The composition has been received. Clear the draft token so a
    // potential next session starts fresh (no rebound).
    localStorage.removeItem(DRAFT_TOKEN_KEY);
    // Reveal the page after a brief cinematic beat.
    const id = setTimeout(() => setRevealed(true), 320);
    return () => clearTimeout(id);
  }, []);

  return (
    <StudioActivationLayout movement="activate">
      {/* Ambient backdrop — warmer than other movements (welcoming) */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <div style={{
          position: 'absolute', inset: 0,
          background:
            'radial-gradient(ellipse at 30% 20%, rgba(0,201,179,0.08) 0%, transparent 55%),' +
            'radial-gradient(ellipse at 70% 80%, rgba(255,180,162,0.06) 0%, transparent 60%)',
          animation: 'studioKenBurns 36s ease-in-out infinite alternate',
        }} />
      </div>

      <div
        style={{
          position: 'absolute', inset: 0,
          display: 'grid', placeItems: 'center',
          padding: '120px 24px 96px 24px',
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity 920ms ease, transform 920ms cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <div style={{ maxWidth: 620, textAlign: 'center' }}>
          <p style={{
                margin: 0,
                fontSize: '0.72rem',
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
                color: '#00C9B3',
                fontFamily: '"Helvetica Neue", Arial, sans-serif',
              }} data-testid="request-eyebrow">
            {t['studio.activation.request.eyebrow']}
          </p>

          <h1 style={{
                margin: '28px 0 0 0',
                fontFamily: '"Playfair Display", Georgia, serif',
                fontWeight: 400,
                fontSize: 'clamp(2.0rem, 4.0vw, 3.0rem)',
                lineHeight: 1.12,
                color: '#FFFFFF',
                letterSpacing: '-0.01em',
              }} data-testid="request-headline">
            {t['studio.activation.request.headline']}
          </h1>

          <p style={{
                margin: '24px auto 0 auto',
                fontFamily: '"Playfair Display", Georgia, serif',
                fontStyle: 'italic',
                fontSize: 'clamp(1.0rem, 1.4vw, 1.18rem)',
                lineHeight: 1.6,
                color: 'rgba(255,255,255,0.78)',
                maxWidth: '50ch',
              }} data-testid="request-body">
            {t['studio.activation.request.body']}
          </p>

          <p style={{
                margin: '28px auto 0 auto',
                fontFamily: '"Helvetica Neue", Arial, sans-serif',
                fontSize: '0.92rem',
                lineHeight: 1.65,
                color: 'rgba(255,255,255,0.5)',
                maxWidth: '54ch',
              }} data-testid="request-guided-intro">
            {t['studio.activation.request.guided_intro']}
          </p>

          {info?.reference && (
            <div
              data-testid="request-reference-block"
              style={{
                marginTop: 48,
                padding: '20px 24px',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'inline-block',
              }}
            >
              <p style={{
                    margin: 0,
                    fontFamily: '"Helvetica Neue", Arial, sans-serif',
                    fontSize: '0.66rem', letterSpacing: '0.28em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.45)',
                  }}>
                {t['studio.activation.request.reference_label']}
              </p>
              <p style={{
                    margin: '8px 0 0 0',
                    fontFamily: '"Playfair Display", Georgia, serif',
                    fontSize: '1.15rem',
                    letterSpacing: '0.06em',
                    color: '#FFFFFF',
                  }} data-testid="request-reference">
                {info.reference}
              </p>
            </div>
          )}

          <div style={{ marginTop: 56 }}>
            <button
              data-testid="request-return"
              onClick={() => navigate('/')}
              style={{
                appearance: 'none',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.22)',
                color: 'rgba(255,255,255,0.85)',
                padding: '14px 28px',
                borderRadius: 999,
                fontFamily: '"Helvetica Neue", Arial, sans-serif',
                fontSize: '0.82rem', letterSpacing: '0.16em',
                textTransform: 'uppercase',
                fontWeight: 500, cursor: 'pointer',
                transition: 'border-color 280ms ease, color 280ms ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#00C9B3';
                e.currentTarget.style.color = '#00C9B3';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
              }}
            >
              {t['studio.activation.request.return_cta'] || 'Torna a MOOD'}
            </button>
          </div>
        </div>
      </div>
    </StudioActivationLayout>
  );
};

export default MovementRequest;
