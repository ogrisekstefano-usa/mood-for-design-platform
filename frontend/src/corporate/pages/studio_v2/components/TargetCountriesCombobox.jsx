/**
 * TargetCountriesPicker — MAX 3 countries, each with priority badge (1/2/3)
 * and status toggle (active|planned).
 * Searchable combobox feeds the next available priority slot.
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';

const STATUS_LABEL = {
  it: { active: 'Già attivo', planned: 'In espansione' },
  en: { active: 'Active',     planned: 'Planned'        },
};

const TargetCountriesPicker = ({ allCountries, selected, onChange,
                                  placeholder = 'Cerca un Paese…',
                                  locale = 'it-IT', max = 3 }) => {
  // selected: [{ iso2, priority, status }]
  const list = Array.isArray(selected) ? selected : [];
  const lang = locale.toLowerCase().startsWith('en') ? 'en' : 'it';
  const SL   = STATUS_LABEL[lang];

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

  const sel = new Set(list.map((x) => x.iso2));

  const filtered = useMemo(() => {
    const qq = (q || '').toLowerCase();
    return allCountries
      .filter((c) => !sel.has(c.iso2))
      .filter((c) => !qq || c.label.toLowerCase().includes(qq) || c.iso2.toLowerCase().includes(qq))
      .slice(0, 30);
  }, [q, allCountries, selected]); // eslint-disable-line

  const add = (iso2) => {
    if (list.length >= max) return;
    const usedPriorities = list.map((x) => x.priority);
    let nextPriority = 1;
    while (usedPriorities.includes(nextPriority)) nextPriority++;
    const next = [...list, { iso2, priority: nextPriority, status: 'planned' }]
      .sort((a, b) => a.priority - b.priority);
    onChange(next);
    setQ('');
  };
  const remove = (iso2) => onChange(list.filter((x) => x.iso2 !== iso2));
  const setStatus = (iso2, status) =>
    onChange(list.map((x) => x.iso2 === iso2 ? { ...x, status } : x));

  return (
    <div ref={wrapRef} style={{ position: 'relative' }} data-testid="target-countries-picker">
      {list.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px 0',
                     display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((t) => {
            const c = allCountries.find((x) => x.iso2 === t.iso2);
            if (!c) return null;
            return (
              <li key={t.iso2} data-testid={`target-row-${t.iso2}`} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '12px 14px',
              }}>
                <span data-testid={`target-priority-${t.iso2}`} style={{
                  width: 26, height: 26, borderRadius: 999,
                  background: 'rgba(0,201,179,0.10)',
                  border: '1px solid rgba(0,201,179,0.32)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.78rem', fontWeight: 500, color: 'var(--mood-teal, #00C9B3)',
                  flexShrink: 0,
                }}>{t.priority}</span>
                <span style={{ fontSize: '1.05em', lineHeight: 1 }}>{c.flag}</span>
                <span style={{ flex: 1, fontSize: '0.96rem',
                               color: 'var(--mood-text-1, #F4F4F5)' }}>
                  {c.label}
                </span>
                <div role="group" style={{
                  display: 'inline-flex',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 999, padding: 2,
                }}>
                  {['active', 'planned'].map((st) => (
                    <button key={st} type="button"
                      onClick={() => setStatus(t.iso2, st)}
                      data-testid={`target-status-${t.iso2}-${st}`}
                      style={{
                        background: t.status === st
                          ? 'var(--mood-teal, #00C9B3)'
                          : 'transparent',
                        color: t.status === st ? '#0A0A0B'
                          : 'rgba(255,255,255,0.55)',
                        border: 'none', borderRadius: 999,
                        padding: '6px 12px', fontSize: '0.74rem',
                        cursor: 'pointer', fontFamily: 'inherit',
                        letterSpacing: '0.02em',
                      }}>{SL[st]}</button>
                  ))}
                </div>
                <button type="button" onClick={() => remove(t.iso2)}
                  data-testid={`target-remove-${t.iso2}`}
                  aria-label={`Rimuovi ${c.label}`}
                  style={{
                    background: 'transparent', border: 'none',
                    color: 'rgba(255,255,255,0.45)', cursor: 'pointer',
                    fontSize: '1.1rem', padding: 4,
                  }}>×</button>
              </li>
            );
          })}
        </ul>
      )}

      {list.length < max && (
        <>
          <input
            type="text" value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
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
              position: 'absolute', left: 0, right: 0,
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
          <p style={{
            marginTop: 8, fontSize: '0.74rem',
            color: 'rgba(255,255,255,0.45)',
          }}>
            {lang === 'en'
              ? `${list.length} of ${max} selected · Priority is assigned automatically.`
              : `${list.length} di ${max} selezionati · La priorità è assegnata automaticamente.`}
          </p>
        </>
      )}
      {list.length >= max && (
        <p data-testid="target-limit-reached" style={{
          fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)',
          marginTop: 4,
        }}>
          {lang === 'en' ? `Maximum ${max} target countries reached.`
                         : `Massimo ${max} Paesi target raggiunto.`}
        </p>
      )}
    </div>
  );
};

export default TargetCountriesPicker;
