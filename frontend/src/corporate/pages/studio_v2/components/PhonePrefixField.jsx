/**
 * PhonePrefixField — international phone input with country flag badge.
 *
 *   ┌─────────────────┬──────────────────────────────┐
 *   │ 🇮🇹  +39   ▾   │  333 444 5566                │
 *   └─────────────────┴──────────────────────────────┘
 *
 * Country list & dial codes come from the /api/geo/countries response
 * (props.countries). Zero hardcoded prefixes.
 *
 * Props:
 *   countries:   [{ iso2, label, flag, dial_code }]
 *   prefixIso:   currently selected ISO2 (e.g. "IT") — derives the dial code
 *   onPrefixIso: (iso2) => void
 *   number:      raw number string
 *   onNumber:    (str) => void
 *   testIdRoot:  prefix for data-testid (default "phone")
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';

const PhonePrefixField = ({ countries, prefixIso, onPrefixIso,
                            number, onNumber, testIdRoot = 'phone',
                            searchPlaceholder = 'Cerca…' }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const wrapRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false); setQ('');
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const current = useMemo(
    () => (countries || []).find((c) => c.iso2 === prefixIso),
    [countries, prefixIso]
  );

  const filtered = useMemo(() => {
    const qq = (q || '').toLowerCase();
    return (countries || [])
      .filter((c) => !!c.dial_code)
      .filter((c) => !qq ||
        c.label.toLowerCase().includes(qq) ||
        c.iso2.toLowerCase().includes(qq) ||
        (c.dial_code || '').includes(qq))
      .slice(0, 60);
  }, [countries, q]);

  const baseInput = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6, color: 'var(--mood-text-1, #F4F4F5)',
    fontSize: '1rem', fontFamily: 'inherit',
  };

  return (
    <div ref={wrapRef} data-testid={`${testIdRoot}-field`} style={{
      display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10,
      position: 'relative',
    }}>
      <button type="button"
        data-testid={`${testIdRoot}-prefix-toggle`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox" aria-expanded={open}
        style={{
          ...baseInput,
          padding: '12px 14px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10,
          textAlign: 'left',
        }}>
        <span style={{ fontSize: '1.18em', lineHeight: 1 }}>
          {current?.flag || '🌐'}
        </span>
        <span data-testid={`${testIdRoot}-prefix-value`} style={{
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--mood-text-1, #F4F4F5)',
        }}>{current?.dial_code || '+'}</span>
        <span aria-hidden="true" style={{
          marginLeft: 'auto', color: 'rgba(255,255,255,0.45)',
          fontSize: '0.78rem',
        }}>▾</span>
      </button>
      <input type="tel" value={number || ''}
        onChange={(e) => onNumber(e.target.value)}
        data-testid={`${testIdRoot}-number-input`}
        style={{ ...baseInput, padding: '12px 16px' }} />

      {open && (
        <div data-testid={`${testIdRoot}-prefix-dropdown`} style={{
          position: 'absolute', top: '100%', left: 0,
          width: 320, marginTop: 4, zIndex: 40,
          background: '#161617',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8, padding: 8,
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        }}>
          <input autoFocus type="text" value={q}
            data-testid={`${testIdRoot}-prefix-search`}
            placeholder={searchPlaceholder}
            onChange={(e) => setQ(e.target.value)}
            style={{
              ...baseInput, width: '100%',
              padding: '10px 12px', fontSize: '0.92rem',
              marginBottom: 8,
            }} />
          <ul role="listbox" style={{
            listStyle: 'none', margin: 0, padding: 0,
            maxHeight: 260, overflowY: 'auto',
          }}>
            {filtered.map((c) => (
              <li key={c.iso2}>
                <button type="button"
                  onClick={() => {
                    onPrefixIso(c.iso2);
                    setOpen(false);
                    setQ('');
                  }}
                  data-testid={`${testIdRoot}-prefix-option-${c.iso2}`}
                  style={{
                    width: '100%', textAlign: 'left',
                    background: c.iso2 === prefixIso
                      ? 'rgba(0,201,179,0.10)' : 'transparent',
                    border: 'none', cursor: 'pointer',
                    color: 'var(--mood-text-1, #F4F4F5)',
                    padding: '10px 12px', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 10,
                    fontSize: '0.94rem',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                  onMouseOut={(e) => e.currentTarget.style.background =
                    c.iso2 === prefixIso ? 'rgba(0,201,179,0.10)' : 'transparent'}>
                  <span style={{ fontSize: '1.1em' }}>{c.flag}</span>
                  <span style={{ flex: 1 }}>{c.label}</span>
                  <span style={{
                    fontVariantNumeric: 'tabular-nums',
                    color: 'rgba(255,255,255,0.55)',
                  }}>{c.dial_code}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PhonePrefixField;
