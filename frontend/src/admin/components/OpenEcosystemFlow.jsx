/**
 * OpenEcosystemFlow — the sacred moment.
 * Two acts: Review → Confirmation. Never reads as "Create Tenant".
 */
import React, { useState } from 'react';
import { adminApi } from '../adminApi';
import { tokens, eyebrow, headline, sublead, sectionLabel, helper } from '../utils/consoleTokens';

const OpenEcosystemFlow = ({ t, data, onClose, onActivated }) => {
  const [phase, setPhase]   = useState('review');  // review | activating | done
  const [result, setResult] = useState(null);
  const [error, setError]   = useState(null);

  const confirm = async () => {
    setPhase('activating');
    try {
      const r = await adminApi.activateEcosystem(data.id);
      setResult(r.data);
      setPhase('done');
    } catch (e) {
      setError(e?.response?.data?.detail || 'unknown');
      setPhase('review');
    }
  };

  return (
    <div data-testid="open-ecosystem-flow" style={{
      position: 'fixed', inset: 0, background: 'rgba(8,9,12,0.94)',
      backdropFilter: 'blur(18px)', zIndex: 100, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '4rem',
    }} onClick={phase === 'done' ? onActivated : onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 720, maxWidth: '95vw', background: tokens.bg,
        border: `1px solid ${tokens.hairBold}`, padding: '4rem',
        position: 'relative',
      }}>
        {phase === 'review' && (
          <ReviewPhase t={t} data={data} onConfirm={confirm} onCancel={onClose} error={error} />
        )}
        {phase === 'activating' && (
          <ActivatingPhase t={t} />
        )}
        {phase === 'done' && (
          <ConfirmationPhase t={t} result={result} onClose={onActivated} />
        )}
      </div>
    </div>
  );
};

const ReviewPhase = ({ t, data, onConfirm, onCancel, error }) => (
  <div data-testid="ecosystem-review">
    <p style={{ ...eyebrow, marginBottom: '1rem' }}>{t('activation.eyebrow')}</p>
    <h2 style={{ ...headline, fontSize: '2.2rem', marginBottom: '1rem' }}>
      {t('activation.headline')}
    </h2>
    <p style={{ ...sublead, fontSize: '0.95rem', marginBottom: '3rem' }}>
      {t('activation.sublead')}
    </p>

    <div style={{
      borderTop: `1px solid ${tokens.hair}`, borderBottom: `1px solid ${tokens.hair}`,
      padding: '2rem 0', marginBottom: '2.5rem',
    }}>
      <p style={{ ...eyebrow, marginBottom: '2rem' }}>{t('activation.review.title')}</p>

      <ReviewRow label={t('activation.review.studio')}    value={data.studio_name} />
      <ReviewRow label={t('activation.review.archetype')} value={data.archetype || '—'} />
      <ReviewRow
        label={t('activation.review.experiences')}
        value={(data.experiences || []).length > 0
          ? (data.experiences || []).join(' · ')
          : '—'}
      />
      <ReviewRow
        label={t('activation.review.founder')}
        value={data.contact_email
          ? <>{data.contact_name || ''} <span style={{ color: tokens.inkSoft, fontFamily: 'Inter, sans-serif', fontSize: '0.92rem' }}>· {data.contact_email}</span></>
          : '—'}
      />
    </div>

    {error && (
      <p style={{
        ...helper, color: tokens.ember, marginBottom: '1.5rem',
        fontFamily: 'Playfair Display, serif', fontStyle: 'italic', fontSize: '0.92rem',
      }} data-testid="activation-error">
        — Non ora. {error === 'already_activated' ? 'L\'ecosistema è già aperto.' : 'Una piccola pausa è necessaria.'}
      </p>
    )}

    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <button onClick={onCancel} data-testid="activate-cancel" style={{
        background: 'transparent', border: 'none', color: tokens.inkDim,
        fontFamily: 'Inter, sans-serif', fontSize: '0.74rem',
        letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
      }}>
        {t('activation.cancel_cta')}
      </button>
      <button onClick={onConfirm} data-testid="activate-confirm" style={{
        background: tokens.teal, color: '#08090C', border: 'none',
        padding: '1rem 2rem', fontFamily: 'Inter, sans-serif',
        fontSize: '0.74rem', letterSpacing: '0.24em', textTransform: 'uppercase',
        cursor: 'pointer', borderRadius: 2, fontWeight: 500,
      }}>
        {t('activation.confirm_cta')}
      </button>
    </div>
  </div>
);

const ReviewRow = ({ label, value }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: '200px 1fr', gap: '2rem',
    padding: '0.9rem 0',
  }}>
    <p style={sectionLabel}>{label}</p>
    <p style={{
      fontFamily: 'Playfair Display, serif', fontSize: '1.1rem',
      color: tokens.ink, lineHeight: 1.4,
    }}>{value}</p>
  </div>
);

const ActivatingPhase = ({ t }) => (
  <div data-testid="ecosystem-activating" style={{ textAlign: 'center', padding: '3rem 0' }}>
    <div style={{
      width: 48, height: 48, margin: '0 auto 2rem',
      border: `1px solid ${tokens.tealDim}`,
      borderTopColor: tokens.teal,
      borderRadius: '50%', animation: 'spin 1.2s linear infinite',
    }} />
    <p style={{ ...sublead, fontSize: '0.95rem' }}>
      {t('activation.headline')}
    </p>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const ConfirmationPhase = ({ t, result, onClose }) => (
  <div data-testid="ecosystem-done" style={{ textAlign: 'center' }}>
    <p style={{ ...eyebrow, color: tokens.teal, marginBottom: '1.5rem' }}>
      {t('activation.eyebrow')}
    </p>
    <h2 style={{ ...headline, fontSize: '2.2rem', marginBottom: '1.5rem' }}>
      {t('activation.confirmation.title')}
    </h2>
    <p style={{ ...sublead, fontSize: '1rem', marginBottom: '3rem', maxWidth: 520, margin: '0 auto 3rem' }}>
      {t('activation.confirmation.body')}
    </p>

    {result?.slug && (
      <div style={{
        padding: '1.5rem', background: tokens.bgSunk,
        border: `1px solid ${tokens.hair}`, marginBottom: '2.5rem',
        display: 'inline-block',
      }}>
        <p style={{ ...sectionLabel, marginBottom: '0.5rem' }}>{t('activation.confirmation.tenant')}</p>
        <p style={{
          fontFamily: 'Playfair Display, serif', fontSize: '1.3rem',
          color: tokens.ink, letterSpacing: '0.04em',
        }}>{result.slug}</p>
      </div>
    )}

    <div>
      <button onClick={onClose} data-testid="activation-done-close" style={{
        background: 'transparent', border: `1px solid ${tokens.hairBold}`,
        color: tokens.ink, padding: '0.85rem 1.8rem',
        fontFamily: 'Inter, sans-serif', fontSize: '0.74rem',
        letterSpacing: '0.22em', textTransform: 'uppercase',
        cursor: 'pointer', borderRadius: 2,
      }}>
        {t('activation.confirmation.return')}
      </button>
    </div>
  </div>
);

export default OpenEcosystemFlow;
