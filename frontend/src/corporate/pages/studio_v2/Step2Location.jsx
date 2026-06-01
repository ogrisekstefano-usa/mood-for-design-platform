/**
 * Step2 — Dove operi? (Country DB-driven + City Mapbox autocomplete)
 * NB: NO testo libero per il paese. City: autocomplete se il backend
 * espone /api/studio/v2/cities, altrimenti free-text con avviso sobrio.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const Step2Location = ({ manifest, t, form, update, next, back }) => {
  const countries = manifest?.countries || [];
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [mapboxAvailable, setMapboxAvailable] = useState(null);

  const selectedCountry = form.country
    || manifest?.default_country
    || countries[0]?.code
    || '';

  // Sync default country into form once
  useEffect(() => {
    if (!form.country && selectedCountry) update({ country: selectedCountry });
    // eslint-disable-next-line
  }, []);

  // City autocomplete (debounced)
  useEffect(() => {
    if (!form.city || form.city.length < 2 || !selectedCountry) {
      setCitySuggestions([]);
      return;
    }
    const tid = setTimeout(async () => {
      try {
        const r = await axios.get(`${BACKEND}/api/studio/v2/cities`,
          { params: { country: selectedCountry, q: form.city, limit: 5 } });
        const items = r.data?.items || [];
        setCitySuggestions(items);
        setMapboxAvailable(items.length > 0 || mapboxAvailable !== false);
        if (items.length === 0 && mapboxAvailable === null) {
          // Don't conclude yet
        }
      } catch {
        setCitySuggestions([]);
      }
    }, 350);
    return () => clearTimeout(tid);
    // eslint-disable-next-line
  }, [form.city, selectedCountry]);

  const canContinue = !!selectedCountry && !!(form.city || '').trim();

  const toggleMarket = (code) => {
    const cur = new Set(form.additional_markets || []);
    if (cur.has(code)) cur.delete(code); else cur.add(code);
    update({ additional_markets: Array.from(cur) });
  };

  // Build unique market list (parent market codes seen on countries)
  const marketsList = Array.from(new Map(
    countries
      .filter((c) => c.market && c.code !== selectedCountry)
      .map((c) => [c.market, c.market])
  ).keys()).slice(0, 12);

  return (
    <div data-testid="step2-location">
      <h1 style={{
        fontSize: 'clamp(2rem, 4.5vw, 3rem)',
        lineHeight: 1.1, margin: '0 0 36px',
        fontWeight: 500, letterSpacing: '-0.02em',
      }} data-testid="step2-title">{t('step2_title')}</h1>

      <div style={{ marginBottom: 28 }}>
        <label style={{
          display: 'block', fontSize: '0.72rem', letterSpacing: '0.16em',
          color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase',
          marginBottom: 8,
        }}>{t('step2_country')}</label>
        <select
          data-testid="country-select"
          value={selectedCountry}
          onChange={(e) => update({ country: e.target.value })}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6, color: '#F4F4F5',
            padding: '14px 16px', fontSize: '1rem', fontFamily: 'inherit',
          }}
        >
          {countries.map((c) => (
            <option key={c.code} value={c.code}
                    style={{ background: '#0A0A0B' }}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 28, position: 'relative' }}>
        <label style={{
          display: 'block', fontSize: '0.72rem', letterSpacing: '0.16em',
          color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase',
          marginBottom: 8,
        }}>{t('step2_city')}</label>
        <input
          data-testid="city-input"
          type="text"
          value={form.city || ''}
          onChange={(e) => update({ city: e.target.value })}
          placeholder="Milano…"
          autoComplete="off"
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6, color: '#F4F4F5',
            padding: '14px 16px', fontSize: '1rem', fontFamily: 'inherit',
          }}
        />
        {citySuggestions.length > 0 && (
          <ul data-testid="city-suggestions" style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: '#161617',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6, marginTop: 4, padding: 4,
            listStyle: 'none', zIndex: 10,
          }}>
            {citySuggestions.map((s) => (
              <li key={s.full_name}>
                <button type="button"
                  onClick={() => { update({ city: s.name }); setCitySuggestions([]); }}
                  data-testid={`city-suggestion-${s.name}`}
                  style={{
                    width: '100%', textAlign: 'left',
                    background: 'transparent', border: 'none',
                    color: '#F4F4F5', padding: '10px 12px',
                    fontFamily: 'inherit', cursor: 'pointer',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: '0.95rem' }}>{s.name}</span>
                  <span style={{ fontSize: '0.75rem',
                                 color: 'rgba(255,255,255,0.45)',
                                 marginLeft: 8 }}>{s.full_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {marketsList.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <p style={{
            fontSize: '0.72rem', letterSpacing: '0.16em',
            color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase',
            marginBottom: 10,
          }}>{t('step2_more')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {marketsList.map((mk) => {
              const sel = (form.additional_markets || []).includes(mk);
              return (
                <button
                  key={mk} type="button"
                  onClick={() => toggleMarket(mk)}
                  data-testid={`market-${mk}`}
                  style={{
                    background: sel ? 'rgba(0,201,179,0.1)' : 'rgba(255,255,255,0.04)',
                    border: '1px solid ' + (sel ? '#00C9B3' : 'rgba(255,255,255,0.12)'),
                    borderRadius: 999, padding: '8px 14px',
                    color: '#F4F4F5', cursor: 'pointer',
                    fontSize: '0.82rem', fontFamily: 'inherit',
                  }}
                >{mk.replace('_', ' ')}</button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <button type="button" onClick={back} data-testid="step2-back"
          style={{
            background: 'transparent', color: 'rgba(255,255,255,0.6)',
            border: 'none', cursor: 'pointer',
            padding: '14px 4px', fontSize: '0.92rem', fontFamily: 'inherit',
          }}>← {t('btn_back')}</button>
        <button type="button" disabled={!canContinue} onClick={next}
          data-testid="step2-continue"
          style={{
            background: canContinue ? '#00C9B3' : 'rgba(255,255,255,0.08)',
            color: canContinue ? '#0A0A0B' : 'rgba(255,255,255,0.4)',
            border: 'none', borderRadius: 999,
            padding: '14px 32px', fontSize: '0.92rem',
            fontWeight: 500, letterSpacing: '0.04em',
            cursor: canContinue ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
          }}>{t('btn_continue')} →</button>
      </div>
    </div>
  );
};

export default Step2Location;
