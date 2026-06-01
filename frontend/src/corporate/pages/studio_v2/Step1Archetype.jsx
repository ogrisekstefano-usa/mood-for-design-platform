/**
 * Step1 — Chi sei? (DB-driven categorie studio)
 * Icone Lucide. Niente foto. Selezione singola → continua.
 */
import React from 'react';
import IconArchetype from './components/IconArchetype';

const Step1Archetype = ({ manifest, t, form, update, next }) => {
  const archetypes = manifest?.archetypes || [];
  const selected   = form.archetype_code;
  const canContinue = !!selected;

  return (
    <div data-testid="step1-archetype">
      <p style={{
        fontSize: '0.7rem', letterSpacing: '0.2em',
        color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
        marginBottom: 12,
      }}>1 · {t('btn_continue', 'Continua')}</p>
      <h1 style={{
        fontSize: 'clamp(2rem, 4.5vw, 3rem)',
        lineHeight: 1.1,
        margin: '0 0 12px',
        fontWeight: 500,
        letterSpacing: '-0.02em',
      }} data-testid="step1-title">{t('step1_title')}</h1>
      <p style={{
        color: 'rgba(255,255,255,0.55)', marginBottom: 36, fontSize: '1rem',
      }} data-testid="step1-sublead">{t('step1_sublead')}</p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12,
        marginBottom: 36,
      }}>
        {archetypes.map((a) => {
          const isSel = selected === a.code;
          return (
            <button
              key={a.code}
              type="button"
              onClick={() => update({ archetype_code: a.code })}
              data-testid={`archetype-${a.code}`}
              style={{
                background: isSel ? 'rgba(0,201,179,0.08)' : 'rgba(255,255,255,0.025)',
                border: '1px solid ' + (isSel ? '#00C9B3' : 'rgba(255,255,255,0.08)'),
                borderRadius: 8,
                padding: '20px 18px',
                cursor: 'pointer',
                textAlign: 'left',
                color: '#F4F4F5',
                fontFamily: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                transition: 'background 200ms ease, border-color 200ms ease, transform 200ms ease',
                transform: isSel ? 'translateY(-1px)' : 'translateY(0)',
              }}
            >
              <IconArchetype name={a.icon} size={26}
                             color={isSel ? '#00C9B3' : '#FFFFFFB0'} />
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>{a.label}</div>
                {a.description && (
                  <div style={{
                    fontSize: '0.78rem',
                    color: 'rgba(255,255,255,0.5)',
                    marginTop: 4, lineHeight: 1.4,
                  }}>{a.description}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          disabled={!canContinue}
          onClick={next}
          data-testid="step1-continue"
          style={{
            background: canContinue ? '#00C9B3' : 'rgba(255,255,255,0.08)',
            color: canContinue ? '#0A0A0B' : 'rgba(255,255,255,0.4)',
            border: 'none',
            borderRadius: 999,
            padding: '14px 32px',
            fontSize: '0.92rem',
            fontWeight: 500,
            letterSpacing: '0.04em',
            cursor: canContinue ? 'pointer' : 'not-allowed',
            transition: 'background 200ms ease',
          }}
        >{t('btn_continue')} →</button>
      </div>
    </div>
  );
};

export default Step1Archetype;
