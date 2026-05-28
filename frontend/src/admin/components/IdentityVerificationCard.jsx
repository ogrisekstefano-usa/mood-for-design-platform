import React, { useEffect, useState } from 'react';
import { adminApi } from '../adminApi';
import { tokens, eyebrow, helper, STATUS_TONE } from '../utils/consoleTokens';

/**
 * IdentityVerificationCard
 * ------------------------
 * Calm, editorial provenance check. Renders as a side note — never as
 * a warning. Confidence is communicated through typography weight and
 * a single soft dot, never through red alerts.
 *
 * Props:
 *   - studio_name, contact_email, website  (required inputs to probe)
 *   - t  (editorial copy function from useEditorialCopy)
 *   - onOpenExisting(id)  callback when advisor wants to open an existing relation
 */
const VERDICT_LABEL_KEY = {
  clear:             'identity_check.clear',
  possible_match:    'identity_check.possible',
  existing_relation: 'identity_check.existing',
  active_tenant:     'identity_check.active_tenant',
};

const confidenceFromScore = (s) => {
  if (s >= 0.85) return 'high';
  if (s >= 0.55) return 'medium';
  return 'low';
};

const DOT = (color) => (
  <span style={{
    display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
    background: color, marginRight: 10, verticalAlign: 'middle',
  }} />
);

const IdentityVerificationCard = ({ studio_name, contact_email, website, t, onOpenExisting }) => {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ready = (studio_name && studio_name.trim().length >= 3)
                || (contact_email && contact_email.includes('@'))
                || (website && website.length >= 4);
    if (!ready) { setResult(null); return; }
    const id = setTimeout(() => {
      setBusy(true);
      adminApi.verifyIdentity({ studio_name, contact_email, website })
        .then((r) => setResult(r.data))
        .catch(() => setResult({ verdict: 'clear', matches: [] }))
        .finally(() => setBusy(false));
    }, 260);
    return () => clearTimeout(id);
  }, [studio_name, contact_email, website]);

  if (!result) return null;

  const verdict = result.verdict;
  const dotColor =
    verdict === 'clear'             ? tokens.tealDim :
    verdict === 'possible_match'    ? tokens.inkSoft :
    verdict === 'existing_relation' ? tokens.amber   :
                                       tokens.ember;

  return (
    <div data-testid="identity-verification-card" style={{
      background: tokens.bgRaised,
      border: `1px solid ${tokens.hair}`,
      padding: '1.4rem 1.6rem',
      borderRadius: 2,
      marginTop: '1.5rem',
      opacity: busy ? 0.7 : 1,
      transition: 'opacity 220ms ease',
    }}>
      <p style={{ ...eyebrow, marginBottom: '0.7rem' }}>
        {t('identity_check.eyebrow', 'Provenienza dello studio')}
      </p>
      <p style={{
        fontFamily: 'Playfair Display, serif',
        fontSize: '1.05rem', lineHeight: 1.45,
        color: tokens.ink, marginBottom: result.matches.length ? '1rem' : 0,
        fontStyle: verdict === 'clear' ? 'italic' : 'normal',
      }}>
        {DOT(dotColor)}
        {t(VERDICT_LABEL_KEY[verdict] || 'identity_check.clear')}
      </p>

      {result.matches.length > 0 && (
        <div style={{ borderTop: `1px solid ${tokens.hair}`, paddingTop: '1rem', display: 'grid', gap: '0.6rem' }}>
          {result.matches.slice(0, 5).map((m, i) => {
            const conf = confidenceFromScore(m.score);
            const confLabel = t(`identity_check.confidence.${conf}`);
            const statusLabel = m.status ? t(`status.${m.status}`) : null;
            return (
              <div key={i} data-testid={`identity-match-${i}`} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '1rem', padding: '0.4rem 0',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontFamily: 'Inter, sans-serif', fontSize: '0.92rem',
                    color: tokens.ink, fontWeight: 400, marginBottom: 2,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {m.label}
                  </p>
                  <p style={{ ...helper, fontSize: '0.72rem' }}>
                    {confLabel}
                    {statusLabel ? <> · <span style={{ color: STATUS_TONE[m.status] || tokens.inkDim }}>{statusLabel}</span></> : null}
                    {m.protected_until ? <> · {t('identity_check.last_signal')} {new Date(m.protected_until).toLocaleDateString('it-IT')}</> : null}
                  </p>
                </div>
                {(m.kind === 'existing_relation' || m.kind === 'possible_match') && onOpenExisting && (
                  <button
                    onClick={() => onOpenExisting(m)}
                    data-testid={`identity-match-open-${i}`}
                    style={{
                      background: 'transparent', border: `1px solid ${tokens.hairBold}`,
                      color: tokens.inkSoft, fontFamily: 'Inter, sans-serif',
                      fontSize: '0.72rem', letterSpacing: '0.18em',
                      textTransform: 'uppercase', padding: '0.5rem 0.9rem',
                      borderRadius: 2, cursor: 'pointer',
                    }}
                  >
                    {t('identity_check.open_existing')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default IdentityVerificationCard;
