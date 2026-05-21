/**
 * GovernanceOverlay — LiveQA Mode™ (Sprint HARDENING-01.1).
 *
 * Dev-only overlay that surfaces the governance state of the running
 * application. NOT a debug chaos panel — it's a sober, minimalist
 * monograph badge in the bottom-right corner.
 *
 * Activation:
 *   · localStorage['mood:qa'] = '1'
 *   · or `?qa=1` query param (read once on mount)
 *
 * Shows:
 *   · current locale (with RTL indicator)
 *   · current theme (resolved from --mood-* tokens)
 *   · typography (heading / body family in use)
 *   · token fallback count (how many --mood-* are using their default)
 *   · missing translation count (live tally from useT)
 *   · last governance audit baseline values
 *
 * No mutation. No side effects. Purely observational.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { SEMANTIC_TOKENS, KERNEL_ID, readToken } from './kernel';
import { getMissing, getMissingCount, subscribeMissing, clearMissing } from './missingI18nRegistry';

const isEnabled = () => {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('qa') === '1') {
      try { localStorage.setItem('mood:qa', '1'); } catch (_) {}
      return true;
    }
    return localStorage.getItem('mood:qa') === '1';
  } catch (_) { return false; }
};

const swatch = (val) => {
  if (!val) return '—';
  if (val.includes('rgb') || val.startsWith('#') || val.includes('color-mix')) {
    return val;
  }
  return val;
};

const GovernanceOverlay = () => {
  const [open, setOpen] = useState(false);
  const [active] = useState(() => isEnabled());
  const [tick, setTick] = useState(0);
  const [missingCount, setMissingCount] = useState(() => getMissingCount());
  const [missingOpen, setMissingOpen] = useState(false);

  // Tick once per second to keep locale/dir/theme readings fresh.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  // Subscribe to live missing-translation events.
  useEffect(() => {
    if (!active) return;
    return subscribeMissing((n) => setMissingCount(n));
  }, [active]);

  const state = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const html = document.documentElement;
    return {
      locale:    html.getAttribute('lang') || 'unknown',
      dir:       html.getAttribute('dir')  || 'ltr',
      heading:   readToken('--mood-font-heading') || '—',
      body:      readToken('--mood-font-body')    || '—',
      accent:    readToken('--mood-accent')       || '—',
      surface:   readToken('--mood-surface')      || '—',
      bg:        readToken('--mood-bg')           || '—',
      tokensInUse: SEMANTIC_TOKENS.filter((t) => readToken(t)).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  if (!active || !state) return null;

  const close = () => {
    try { localStorage.removeItem('mood:qa'); } catch (_) {}
    window.location.reload();
  };

  // ── Closed: minimal badge ────────────────────────────────────
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="governance-overlay-badge"
        title="MOOD LiveQA — click to open"
        style={badgeStyle}
      >
        <span style={dotStyle} aria-hidden="true" />
        <span style={badgeLabelStyle}>{state.locale.toUpperCase()}</span>
        <span style={badgeSepStyle}>·</span>
        <span style={badgeLabelStyle}>{state.dir}</span>
      </button>
    );
  }

  // ── Open: monograph card ─────────────────────────────────────
  return (
    <aside
      role="complementary"
      aria-label="MOOD Design System governance overlay"
      data-testid="governance-overlay-panel"
      style={panelStyle}
    >
      <header style={headStyle}>
        <p style={eyebrowStyle}>MOOD · LiveQA™</p>
        <button type="button" onClick={() => setOpen(false)} style={closeBtnStyle}>×</button>
      </header>

      <Row label="Locale"     value={`${state.locale} · ${state.dir}`} />
      <Row label="Heading"    value={truncate(state.heading, 36)} />
      <Row label="Body"       value={truncate(state.body, 36)} />
      <Row label="Accent"     value={swatch(state.accent)} indicator={state.accent} />
      <Row label="Surface"    value={swatch(state.surface)} indicator={state.surface} />
      <Row label="Background" value={swatch(state.bg)} indicator={state.bg} />
      <Row label="Tokens"     value={`${state.tokensInUse} / ${SEMANTIC_TOKENS.length} active`} />
      <Row label="Kernel"     value={KERNEL_ID} mono />

      {/* Sprint HARDENING-I18N-GUARD™ · LiveQA missing-translation counter.
          Click expands to a sober list of the first 10 missing keys. */}
      <button
        type="button"
        onClick={() => setMissingOpen((v) => !v)}
        data-testid="governance-overlay-missing-row"
        style={{
          ...rowStyle,
          background: 'transparent', border: 'none', width: '100%',
          padding: '5px 0', cursor: 'pointer', textAlign: 'left',
          color: missingCount > 0
            ? 'var(--mood-warning, #c9a36e)'
            : 'var(--mood-text)',
        }}
      >
        <span style={rowLabelStyle}>Missing i18n</span>
        <span style={{ ...rowValStyle, color: 'inherit' }}>
          {missingCount === 0 ? '0 · clean' : `${missingCount} keys ▾`}
        </span>
      </button>

      {missingOpen && missingCount > 0 && (
        <div
          data-testid="governance-overlay-missing-list"
          style={missingListStyle}
        >
          {getMissing().slice(0, 10).map((m, i) => (
            <div key={`${m.locale}|${m.key}|${i}`} style={missingItemStyle}>
              <div style={missingKeyStyle} title={m.key}>{truncate(m.key, 40)}</div>
              <div style={missingMetaStyle}>
                <span>{m.locale}</span>
                <span style={{ opacity: 0.45 }}>·</span>
                <span title={m.page}>{truncate(m.page, 18)}</span>
                <span style={{ opacity: 0.45 }}>·</span>
                <span>×{m.count}</span>
              </div>
            </div>
          ))}
          {missingCount > 10 && (
            <p style={missingMoreStyle}>
              + {missingCount - 10} more · check console for full list
            </p>
          )}
          <button
            type="button"
            onClick={() => { clearMissing(); setMissingOpen(false); }}
            data-testid="governance-overlay-missing-reset"
            style={missingResetBtnStyle}
          >
            Reset
          </button>
        </div>
      )}

      <footer style={footStyle}>
        <button type="button" onClick={close} style={hideBtnStyle}>
          Disable LiveQA
        </button>
      </footer>
    </aside>
  );
};

const Row = ({ label, value, indicator, mono = false }) => (
  <div style={rowStyle}>
    <span style={rowLabelStyle}>{label}</span>
    <span style={{
      ...rowValStyle,
      fontFamily: mono ? "var(--mood-font-mono)" : "var(--mood-font-body)",
    }}>
      {indicator && (
        <span aria-hidden="true" style={{
          ...indicatorStyle,
          background: indicator,
        }} />
      )}
      {value}
    </span>
  </div>
);

const truncate = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s);

const badgeStyle = {
  position: 'fixed', bottom: 18, right: 18, zIndex: 99999,
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 14px',
  background: 'rgba(14, 15, 17, 0.86)',
  color: 'var(--mood-text, #f0ebe0)',
  border: '1px solid var(--mood-border, rgba(255,255,255,0.10))',
  borderRadius: 'var(--mood-radius-md, 4px)',
  fontFamily: "var(--mood-font-mono, 'JetBrains Mono', monospace)",
  fontSize: 10,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
};
const dotStyle = {
  width: 6, height: 6, borderRadius: '50%',
  background: 'var(--mood-accent, #d9b285)',
};
const badgeLabelStyle = { fontVariantNumeric: 'tabular-nums' };
const badgeSepStyle = { opacity: 0.4 };

const panelStyle = {
  position: 'fixed', bottom: 18, right: 18, zIndex: 99999,
  width: 320, padding: '16px 18px 14px',
  background: 'rgba(14, 15, 17, 0.94)',
  color: 'var(--mood-text, #f0ebe0)',
  border: '1px solid var(--mood-border, rgba(255,255,255,0.10))',
  borderRadius: 'var(--mood-radius-md, 4px)',
  boxShadow: 'var(--mood-shadow-soft, 0 8px 28px rgba(0,0,0,0.28))',
  fontFamily: "var(--mood-font-body, 'Inter', sans-serif)",
  fontSize: 11.5,
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
};
const headStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  paddingBottom: 10,
  borderBottom: '1px solid var(--mood-border, rgba(255,255,255,0.08))',
  marginBottom: 10,
};
const eyebrowStyle = {
  fontFamily: "var(--mood-font-mono, 'JetBrains Mono', monospace)",
  fontSize: 9, letterSpacing: '0.32em',
  textTransform: 'uppercase',
  color: 'var(--mood-accent, #d9b285)',
  margin: 0,
};
const closeBtnStyle = {
  background: 'transparent', border: 'none',
  color: 'var(--mood-text-muted)', cursor: 'pointer',
  fontSize: 18, lineHeight: 1, padding: 0,
};
const rowStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 12, padding: '5px 0',
};
const rowLabelStyle = {
  fontFamily: "var(--mood-font-mono, 'JetBrains Mono', monospace)",
  fontSize: 9, letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: 'var(--mood-text-muted, rgba(240,235,224,0.55))',
};
const rowValStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  fontSize: 11.5, fontVariantNumeric: 'tabular-nums',
  color: 'var(--mood-text)',
  maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const indicatorStyle = {
  width: 10, height: 10, borderRadius: 2,
  border: '1px solid rgba(255,255,255,0.18)',
};
const footStyle = {
  marginTop: 12, paddingTop: 10,
  borderTop: '1px solid var(--mood-border, rgba(255,255,255,0.08))',
  display: 'flex', justifyContent: 'flex-end',
};
const hideBtnStyle = {
  background: 'transparent',
  color: 'var(--mood-text-muted)',
  border: '1px solid var(--mood-border)',
  padding: '6px 12px',
  fontFamily: "var(--mood-font-mono, 'JetBrains Mono', monospace)",
  fontSize: 9, letterSpacing: '0.22em',
  textTransform: 'uppercase', cursor: 'pointer',
};

// Missing-translation expansion list — sober, monograph spirit.
const missingListStyle = {
  marginTop: 6, marginBottom: 6,
  padding: '8px 10px',
  background: 'rgba(255,255,255,0.025)',
  border: '1px solid var(--mood-border, rgba(255,255,255,0.08))',
  borderRadius: 'var(--mood-radius-sm, 3px)',
  maxHeight: 240, overflowY: 'auto',
};
const missingItemStyle = {
  padding: '5px 0',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
};
const missingKeyStyle = {
  fontFamily: "var(--mood-font-mono, 'JetBrains Mono', monospace)",
  fontSize: 10.5,
  color: 'var(--mood-text)',
  marginBottom: 2,
};
const missingMetaStyle = {
  display: 'flex', gap: 6, alignItems: 'center',
  fontFamily: "var(--mood-font-mono, 'JetBrains Mono', monospace)",
  fontSize: 9,
  color: 'var(--mood-text-muted)',
  letterSpacing: '0.05em',
};
const missingMoreStyle = {
  margin: '8px 0 0',
  fontFamily: "var(--mood-font-mono, 'JetBrains Mono', monospace)",
  fontSize: 9, letterSpacing: '0.1em',
  color: 'var(--mood-text-faint, rgba(240,235,224,0.4))',
};
const missingResetBtnStyle = {
  marginTop: 8,
  background: 'transparent',
  color: 'var(--mood-text-muted)',
  border: '1px solid var(--mood-border)',
  padding: '4px 10px',
  fontFamily: "var(--mood-font-mono, 'JetBrains Mono', monospace)",
  fontSize: 8.5, letterSpacing: '0.22em',
  textTransform: 'uppercase', cursor: 'pointer',
};

export default GovernanceOverlay;
