/**
 * ITER126 · Localization Overlay™ — DEV ONLY.
 *
 * Discreet bottom-right pill that surfaces:
 *   • The currently-active UI locale
 *   • # of missing translation keys recorded this session
 *   • # of Italian leakage occurrences detected on the current page
 *
 * Click to expand a panel with details (key paths, page, snippet). Hidden
 * entirely in production builds. Pure observational — no state mutation,
 * no PII, no network calls.
 */
import React, { useEffect, useState } from 'react';
import { useBlueprint } from '../contexts/BlueprintContext';
import {
  getMissing,
  getMissingCount,
  subscribeMissing,
  clearMissing,
} from '../design-system/missingI18nRegistry';
import {
  getLeaks,
  getLeakCount,
  startLeakageScan,
  subscribeLeaks,
  clearLeaks,
} from './leakageDetector';

// ITER154.R7 fix · the overlay used to show whenever NODE_ENV !== 'production',
// which meant it was visible on staging/preview too. Now it is explicit:
// only show when REACT_APP_SHOW_I18N_DEBUG === 'true'. Local dev can opt in
// via .env.local; staging/preview/prod stay clean.
const isDev = process.env.REACT_APP_SHOW_I18N_DEBUG === 'true';

const LocalizationOverlay = () => {
  const { locale } = useBlueprint();
  const [open, setOpen]               = useState(false);
  const [missingN, setMissingN]       = useState(getMissingCount());
  const [leaksN, setLeaksN]           = useState(getLeakCount());
  const [tab, setTab]                 = useState('missing');

  useEffect(() => {
    const u1 = subscribeMissing(setMissingN);
    const u2 = subscribeLeaks(setLeaksN);
    return () => { u1(); u2(); };
  }, []);

  // Kick off the leakage scanner (interval based) tied to the current locale.
  useEffect(() => {
    if (!isDev) return undefined;
    return startLeakageScan(() => locale, 8000);
  }, [locale]);

  if (!isDev) return null;
  if (typeof window === 'undefined') return null;

  // Suppress when explicitly disabled via ?qa-overlay=off
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('qa-overlay') === 'off') return null;
  } catch (_) {}

  const totalIssues = missingN + leaksN;
  const totalColor = totalIssues === 0
    ? 'rgba(120, 200, 140, 0.85)'
    : leaksN > 0 ? 'rgba(225, 95, 95, 0.85)' : 'rgba(217, 178, 133, 0.85)';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="localization-overlay-pill"
        title="Localization Overlay (dev only)"
        style={{
          position: 'fixed', bottom: 16, right: 16, zIndex: 99998,
          padding: '8px 14px',
          background: 'rgba(15, 17, 22, 0.92)',
          border: `1px solid ${totalColor}`,
          color: totalColor,
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
          cursor: 'pointer', borderRadius: 0,
          backdropFilter: 'blur(12px)',
        }}>
        i18n · {locale} · miss {missingN} · leak {leaksN}
      </button>

      {open && (
        <div
          data-testid="localization-overlay-panel"
          style={{
            position: 'fixed', bottom: 56, right: 16, zIndex: 99999,
            width: 460, maxHeight: '60vh',
            background: 'rgba(15, 17, 22, 0.96)',
            border: '1px solid rgba(217, 178, 133, 0.4)',
            color: 'rgba(240, 235, 224, 0.92)',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            fontSize: 11, lineHeight: 1.5,
            overflowY: 'auto', backdropFilter: 'blur(14px)',
          }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <p style={{ fontSize: 9, letterSpacing: '0.28em', color: 'rgba(217,178,133,0.85)', margin: 0 }}>
                LOCALIZATION OVERLAY · DEV
              </p>
              <p style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, margin: '4px 0 0', fontStyle: 'italic' }}>
                Active locale · {locale}
              </p>
            </div>
            <button type="button" onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer',
                       fontSize: 14, padding: 4 }}>×</button>
          </div>

          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              ['missing', `Missing ${missingN}`],
              ['leaks',   `IT leaks ${leaksN}`],
            ].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setTab(id)}
                data-testid={`localization-overlay-tab-${id}`}
                style={{
                  flex: 1, padding: '10px 14px', background: 'none', border: 'none',
                  borderBottom: tab === id ? '2px solid rgba(217,178,133,0.9)' : '2px solid transparent',
                  color: tab === id ? 'rgba(217,178,133,0.95)' : 'rgba(240,235,224,0.55)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase',
                }}>{label}</button>
            ))}
          </div>

          <div style={{ padding: '12px 18px' }}>
            {tab === 'missing' && <MissingList />}
            {tab === 'leaks'   && <LeaksList />}
          </div>

          <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex', gap: 12 }}>
            <button type="button" onClick={() => { clearMissing(); clearLeaks(); }}
              data-testid="localization-overlay-clear"
              style={{ background: 'none', border: 'none', color: 'rgba(240,235,224,0.6)',
                       fontFamily: 'inherit', fontSize: 9.5, letterSpacing: '0.22em',
                       textTransform: 'uppercase', cursor: 'pointer' }}>
              Clear
            </button>
          </div>
        </div>
      )}
    </>
  );
};

const MissingList = () => {
  const items = getMissing();
  if (!items.length) return <p style={{ opacity: 0.55, fontStyle: 'italic' }}>No missing keys recorded.</p>;
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
      {items.slice(0, 80).map((m) => (
        <li key={`${m.locale}|${m.key}`} style={{ padding: '6px 0', borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
          <div style={{ color: 'rgba(217,178,133,0.95)' }}>{m.key}</div>
          <div style={{ opacity: 0.55, fontSize: 10 }}>{m.locale} · {m.page} · ×{m.count}</div>
        </li>
      ))}
    </ul>
  );
};

const LeaksList = () => {
  const items = getLeaks();
  if (!items.length) return <p style={{ opacity: 0.55, fontStyle: 'italic' }}>No Italian leakage on this page.</p>;
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
      {items.slice(0, 60).map((l) => (
        <li key={`${l.locale}|${l.page}|${l.phrase}`} style={{ padding: '6px 0', borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
          <div style={{ color: 'rgba(225, 95, 95, 0.95)' }}>«{l.phrase}»</div>
          <div style={{ opacity: 0.55, fontSize: 10 }}>{l.page} · {l.testid || '—'} · ×{l.count}</div>
        </li>
      ))}
    </ul>
  );
};

export default LocalizationOverlay;
