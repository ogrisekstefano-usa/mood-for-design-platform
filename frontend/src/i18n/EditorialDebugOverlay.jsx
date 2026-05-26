/**
 * EditorialDebugOverlay — ITER155.R3 · narrative source inspector.
 *
 * Visible ONLY when `REACT_APP_EDITORIAL_DEBUG === 'true'` and on dev
 * builds (NODE_ENV !== 'production'). Surfaces a small floating chip
 * that lists, for the current page lifecycle:
 *
 *   • # runtime overrides    (from /api/editorial-copy/runtime)
 *   • # dictionary keys hit  (from useT/pickString)
 *   • # missing keys         (⟦key⟧ tokens or recordMissing entries)
 *
 * Click the chip → expands a list of the missing keys, the runtime
 * source per key (override · default · static · missing) and a
 * deep-link to /admin/editorial-copy.
 *
 * NEVER mounted in staging/prod.
 */
import React, { useEffect, useState } from 'react';

const isEnabled = () => {
  try {
    const flag = (process.env.REACT_APP_EDITORIAL_DEBUG || '').toLowerCase();
    if (flag !== 'true') return false;
    return process.env.NODE_ENV !== 'production';
  } catch (_) {
    return false;
  }
};

const styles = {
  chip: {
    position: 'fixed', bottom: 16, left: 16, zIndex: 99999,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 11, lineHeight: 1.4, color: '#e6f7f4',
    background: 'rgba(8,12,16,0.92)', border: '1px solid #1e2a32',
    borderRadius: 10, padding: '8px 12px', cursor: 'pointer',
    backdropFilter: 'blur(8px)', boxShadow: '0 8px 28px rgba(0,0,0,.35)',
    maxWidth: 360,
  },
  panel: {
    position: 'fixed', bottom: 64, left: 16, zIndex: 99999,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 11, lineHeight: 1.45, color: '#e6f7f4',
    background: 'rgba(6,10,14,0.96)', border: '1px solid #1e2a32',
    borderRadius: 10, padding: 12, maxWidth: 440, maxHeight: 360,
    overflowY: 'auto', backdropFilter: 'blur(10px)',
  },
  badge: {
    display: 'inline-block', marginRight: 6, padding: '1px 6px',
    borderRadius: 4, background: '#0f1a22', color: '#7ed7c9',
  },
  link: { color: '#7ed7c9', textDecoration: 'underline', cursor: 'pointer' },
  miss: { color: '#ff7a7a' },
};

const EditorialDebugOverlay = () => {
  const enabled = isEnabled();
  const [open, setOpen] = useState(false);
  const [runtimeCount, setRuntimeCount] = useState(0);
  const [missing, setMissing] = useState([]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onLoaded = (e) => setRuntimeCount(e?.detail?.size || 0);
    const tick = () => {
      try {
        // eslint-disable-next-line global-require
        const reg = require('../design-system/missingI18nRegistry');
        const list = (reg.getMissing && reg.getMissing()) || [];
        setMissing(list.slice(-25).reverse());
      } catch (_) { /* noop */ }
    };
    window.addEventListener('mfd:editorial-overrides:loaded', onLoaded);
    const id = setInterval(tick, 1500);
    tick();
    return () => {
      window.removeEventListener('mfd:editorial-overrides:loaded', onLoaded);
      clearInterval(id);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        style={styles.chip}
        onClick={() => setOpen((v) => !v)}
        data-testid="editorial-debug-chip"
        aria-label="Editorial debug overlay"
      >
        <span style={styles.badge}>EDITORIAL · DEBUG</span>
        runtime <b>{runtimeCount}</b>
        {' · '}
        missing <b style={missing.length ? styles.miss : null}>{missing.length}</b>
      </button>
      {open && (
        <div style={styles.panel} data-testid="editorial-debug-panel">
          <div style={{ marginBottom: 8 }}>
            <span style={styles.badge}>{runtimeCount}</span> runtime overrides loaded
            {'  ·  '}
            <a href="/admin/editorial-copy" style={styles.link}>open CMS →</a>
          </div>
          <div style={{ borderTop: '1px solid #1e2a32', paddingTop: 8 }}>
            <div style={{ marginBottom: 4, color: '#9ec2bb' }}>
              Recent missing keys ({missing.length}):
            </div>
            {missing.length === 0 ? (
              <div style={{ color: '#7ed7c9' }}>None — every key resolved.</div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {missing.map((m, i) => (
                  <li key={i} style={{ marginBottom: 3 }}>
                    <span style={styles.miss}>⟦{m.key}⟧</span>
                    <span style={{ opacity: 0.6 }}>  · {m.locale} · {m.fallbackSrc || 'unknown'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default EditorialDebugOverlay;
