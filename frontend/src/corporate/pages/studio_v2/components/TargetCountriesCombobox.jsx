/**
 * TargetCountriesCombobox — searchable multi-select with flag chips.
 * Source: DB countries (250+). User picks any country in the world.
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';

const TargetCountriesCombobox = ({ allCountries, selected, onChange,
                                   placeholder = 'Cerca un Paese…' }) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const sel = new Set(selected || []);
  const filtered = useMemo(() => {
    const qq = (q || '').toLowerCase();
    return allCountries
      .filter((c) => !sel.has(c.iso2))
      .filter((c) => !qq || c.label.toLowerCase().includes(qq) || c.iso2.toLowerCase().includes(qq))
      .slice(0, 30);
  }, [q, allCountries, selected]);

  const add = (iso2) => {
    const next = Array.from(new Set([...(selected || []), iso2]));
    onChange(next);
    setQ('');
  };
  const remove = (iso2) => onChange((selected || []).filter((c) => c !== iso2));

  const selectedItems = (selected || [])
    .map((iso) => allCountries.find((c) => c.iso2 === iso))
    .filter(Boolean);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }} data-testid="target-countries-combobox">
      {selectedItems.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {selectedItems.map((c) => (
            <span key={c.iso2} data-testid={`target-chip-${c.iso2}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(0,201,179,0.10)',
              border: '1px solid rgba(0,201,179,0.32)',
              borderRadius: 999, padding: '6px 12px 6px 10px',
              fontSize: '0.86rem', color: 'var(--mood-text-1, #F4F4F5)',
            }}>
              <span style={{ fontSize: '1.05em', lineHeight: 1 }}>{c.flag}</span>
              {c.label}
              <button type="button" onClick={() => remove(c.iso2)}
                aria-label={`Rimuovi ${c.label}`}
                style={{
                  background: 'transparent', border: 'none',
                  color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
                  fontSize: '1rem', lineHeight: 1, padding: 0,
                }}>×</button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        data-testid="target-search-input"
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 6,
          color: 'var(--mood-text-1, #F4F4F5)',
          padding: '14px 16px', fontSize: '0.96rem', fontFamily: 'inherit',
        }} />

      {open && filtered.length > 0 && (
        <ul data-testid="target-suggestions" style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: '#161617',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 6, marginTop: 4, padding: 4,
          listStyle: 'none', zIndex: 30, maxHeight: 280, overflowY: 'auto',
        }}>
          {filtered.map((c) => (
            <li key={c.iso2}>
              <button type="button" onClick={() => add(c.iso2)}
                data-testid={`target-suggestion-${c.iso2}`}
                style={{
                  width: '100%', textAlign: 'left',
                  background: 'transparent', border: 'none',
                  color: 'var(--mood-text-1, #F4F4F5)',
                  padding: '10px 12px', display: 'flex', gap: 10,
                  alignItems: 'center', fontFamily: 'inherit', cursor: 'pointer',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                <span style={{ fontSize: '1.1em' }}>{c.flag}</span>
                <span style={{ fontSize: '0.94rem', flex: 1 }}>{c.label}</span>
                <span style={{ fontSize: '0.72rem',
                               color: 'var(--mood-text-3, rgba(255,255,255,0.4))' }}>{c.iso2}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TargetCountriesCombobox;
