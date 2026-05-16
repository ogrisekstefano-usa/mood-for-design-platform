// ──────────────────────────────────────────────────────────────────────
// Blueprint OS™ — Unified Color Picker
// Replaces every raw <input type="color"> + manual hex textbox across
// the platform. Cinematic editorial popover with hue/saturation pad,
// brand palette swatches, and recent colors.
// ──────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import './BlueprintColorPicker.css';

const RECENT_KEY = 'bp:recent-colors';

const DEFAULT_BRAND_SWATCHES = [
  '#1B1B1F', '#2A2A2E', '#4E4D52', '#8A8788', '#D8B47A',
  '#FBF8F2', '#FFFFFF', '#9B6B2B', '#22C55E', '#EF4444',
];

const normalizeHex = (raw) => {
  if (!raw) return '#000000';
  let s = String(raw).trim();
  if (!s.startsWith('#')) s = `#${s}`;
  // Expand short (#abc → #aabbcc)
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    s = '#' + s.slice(1).split('').map((c) => c + c).join('');
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) return '#000000';
  return s.toLowerCase();
};

const loadRecent = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, 8); }
  catch { return []; }
};

const pushRecent = (hex) => {
  try {
    const list = loadRecent();
    const next = [hex, ...list.filter((c) => c.toLowerCase() !== hex.toLowerCase())].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
};

/**
 * BlueprintColorPicker — drop-in replacement for any color input.
 *
 * Props:
 *   value          (string) current hex, e.g. "#D8B47A"
 *   onChange       (fn)     called on every change with normalized hex
 *   label          (string) optional small label above the trigger
 *   align          ('left' | 'right')  popover alignment, default 'left'
 *   swatches       (string[]) brand palette swatches (optional override)
 *   testid         (string) base test id (will produce `${testid}-trigger`, etc.)
 *   compact        (bool)   if true, render only the swatch trigger (no label)
 *   size           ('sm' | 'md')  trigger size, default 'md'
 */
const BlueprintColorPicker = ({
  value,
  onChange,
  label,
  align = 'left',
  swatches = DEFAULT_BRAND_SWATCHES,
  testid = 'color',
  compact = false,
  size = 'md',
}) => {
  const safe = normalizeHex(value);
  const [open, setOpen] = useState(false);
  const [hexText, setHexText] = useState(safe);
  const [recent, setRecent] = useState(loadRecent);
  const wrapRef = useRef(null);

  useEffect(() => { setHexText(safe); }, [safe]);

  // Click outside
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        pushRecent(safe);
        setRecent(loadRecent());
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, safe]);

  const apply = (hex) => {
    const next = normalizeHex(hex);
    setHexText(next);
    onChange?.(next);
  };

  const onHexInput = (e) => {
    const v = e.target.value;
    setHexText(v);
    if (/^#?[0-9a-fA-F]{6}$/.test(v) || /^#?[0-9a-fA-F]{3}$/.test(v)) {
      apply(v);
    }
  };

  const close = () => {
    setOpen(false);
    pushRecent(safe);
    setRecent(loadRecent());
  };

  return (
    <div ref={wrapRef} className={`bp-color ${compact ? 'is-compact' : ''}`} data-testid={`${testid}-wrap`}>
      <button
        type="button"
        className={`bp-color__trigger bp-color__trigger--${size}`}
        onClick={() => setOpen((o) => !o)}
        data-testid={`${testid}-trigger`}
        aria-label={label || 'Open color picker'}
      >
        <span className="bp-color__swatch" style={{ background: safe }} />
        {!compact && (
          <span className="bp-color__trigger-meta">
            {label && <span className="bp-color__label">{label}</span>}
            <span className="bp-color__hex">{safe.toUpperCase()}</span>
          </span>
        )}
      </button>

      {open && (
        <div
          className={`bp-color__panel bp-color__panel--${align}`}
          onClick={(e) => e.stopPropagation()}
          data-testid={`${testid}-panel`}
        >
          <div className="bp-color__board">
            <HexColorPicker color={safe} onChange={apply} />
          </div>

          <div className="bp-color__inputs">
            <span className="bp-color__chip" style={{ background: safe }} />
            <input
              type="text"
              value={hexText.replace('#', '').toUpperCase()}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                setHexText('#' + v);
                if (v.length === 6 || v.length === 3) apply('#' + v);
              }}
              maxLength={6}
              spellCheck={false}
              className="bp-color__input"
              data-testid={`${testid}-hex-input`}
              aria-label="Hex"
            />
            <span className="bp-color__hash">#</span>
          </div>

          {swatches?.length > 0 && (
            <div className="bp-color__group">
              <p className="bp-color__group-label">Brand palette</p>
              <div className="bp-color__swatches" data-testid={`${testid}-swatches-brand`}>
                {swatches.map((s) => (
                  <button key={s} type="button"
                          onClick={() => apply(s)}
                          className={`bp-color__swatch-pick ${normalizeHex(s) === safe ? 'is-active' : ''}`}
                          style={{ background: s }}
                          data-testid={`${testid}-swatch-${s.replace('#', '').toLowerCase()}`}
                          aria-label={s} />
                ))}
              </div>
            </div>
          )}

          {recent?.length > 0 && (
            <div className="bp-color__group">
              <p className="bp-color__group-label">Recent</p>
              <div className="bp-color__swatches" data-testid={`${testid}-swatches-recent`}>
                {recent.map((s) => (
                  <button key={s} type="button"
                          onClick={() => apply(s)}
                          className={`bp-color__swatch-pick ${normalizeHex(s) === safe ? 'is-active' : ''}`}
                          style={{ background: s }}
                          aria-label={s} />
                ))}
              </div>
            </div>
          )}

          <div className="bp-color__footer">
            <button type="button" onClick={close} className="bp-color__done" data-testid={`${testid}-done`}>
              Fatto
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlueprintColorPicker;
