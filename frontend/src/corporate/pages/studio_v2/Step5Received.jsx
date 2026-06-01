/**
 * Step5 — Ricevuto. Reference + prossimi passi.
 */
import React, { useEffect } from 'react';

const Step5Received = ({ manifest, t, submitResult, form, reset, navigate }) => {
  // Once the receipt is shown, the funnel can be safely reset so a
  // future visitor restarts from Step 1.
  useEffect(() => {
    // Defer reset by 60s so the user sees their reference clearly first.
    const tid = setTimeout(() => { reset && reset(); }, 60_000);
    return () => clearTimeout(tid);
  }, [reset]);

  const reference = submitResult?.reference || '—';
  // Try operating market label first, then HQ country label fallback
  const opMarketCode = form.primary_operating_market_code;
  const opMarket = (manifest?.operating_markets || []).find((m) => m.code === opMarketCode);
  const country  = (manifest?.countries || []).find((c) =>
    c.iso2 === form.headquarter_country_iso || c.code === form.country);

  return (
    <div data-testid="step5-received">
      <p style={{
        fontSize: '0.72rem', letterSpacing: '0.22em',
        color: '#00C9B3', textTransform: 'uppercase',
        marginBottom: 12,
      }}>{t('btn_continue', '·')}</p>
      <h1 style={{
        fontSize: 'clamp(2rem, 4.5vw, 3rem)', lineHeight: 1.15,
        margin: '0 0 28px', fontWeight: 500, letterSpacing: '-0.02em',
      }} data-testid="step5-title">{t('step5_title')}</h1>

      <div style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8, padding: '24px 28px', marginBottom: 32,
      }}>
        <p style={{
          fontSize: '0.72rem', letterSpacing: '0.18em',
          color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase',
          marginBottom: 6,
        }}>Reference</p>
        <p data-testid="step5-reference" style={{
          fontSize: '1.5rem', fontWeight: 500, letterSpacing: '0.04em',
          color: '#F4F4F5', marginBottom: 18,
        }}>{reference}</p>

        {country && (
          <>
            <p style={{
              fontSize: '0.72rem', letterSpacing: '0.18em',
              color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase',
              marginBottom: 6,
            }}>{t('step2_country')}</p>
            <p data-testid="step5-country"
               style={{ color: '#F4F4F5', marginBottom: 0 }}>{country.label}</p>
          </>
        )}
      </div>

      <p style={{
        fontSize: '0.78rem', letterSpacing: '0.18em',
        color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase',
        marginBottom: 14,
      }} data-testid="step5-next-steps-label">{t('step5_next_steps')}</p>
      <ol style={{
        listStyle: 'none', padding: 0, margin: 0,
        display: 'flex', flexDirection: 'column', gap: 10,
        marginBottom: 28,
      }}>
        {[t('step5_step1'), t('step5_step2'), t('step5_step3')].map((s, i) => (
          <li key={i} style={{
            display: 'flex', gap: 14, alignItems: 'flex-start',
            color: 'rgba(255,255,255,0.85)', fontSize: '0.95rem',
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: 999,
              background: 'rgba(0,201,179,0.12)', color: '#00C9B3',
              display: 'inline-flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 12, flexShrink: 0,
              fontWeight: 500,
            }}>{i + 1}</span>
            <span style={{ lineHeight: 1.5 }}>{s}</span>
          </li>
        ))}
      </ol>

      <p style={{
        color: 'rgba(255,255,255,0.55)', fontSize: '0.88rem',
        marginBottom: 36, fontStyle: 'normal',
      }} data-testid="step5-timing">{t('step5_timing')}</p>

      <button type="button"
        onClick={() => navigate('/')}
        data-testid="step5-home"
        style={{
          background: 'transparent',
          color: '#F4F4F5',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 999,
          padding: '14px 32px', fontSize: '0.92rem',
          letterSpacing: '0.04em', cursor: 'pointer',
          fontFamily: 'inherit',
        }}>{t('btn_home')}</button>
    </div>
  );
};

export default Step5Received;
