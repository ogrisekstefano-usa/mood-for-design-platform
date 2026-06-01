/**
 * Step 2 — Dove operate? (P0 refactor 2026-06-01)
 *  A · MOOD Operating Market   → MarketCardGrid visual picker
 *  B · Headquarter             → Country dropdown + city autocomplete (Mapbox + fallback)
 *  C · Target Countries        → up to 3 with priority + status
 *
 * Tutti gli eyebrow, label, placeholder, helper text e messaggi
 * provengono dal manifest CMS (studio_v2.ui.*). Zero hardcoded.
 */
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useCountries } from './hooks/useCountries';
import { useOperatingMarkets } from './hooks/useOperatingMarkets';
import TargetCountriesPicker from './components/TargetCountriesCombobox';
import MarketCardGrid from './components/MarketCardGrid';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const labelStyle = {
  display: 'block', fontSize: '0.7rem', letterSpacing: '0.18em',
  color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase',
  marginBottom: 8, fontFamily: 'Inter, sans-serif',
};
const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6, color: 'var(--mood-text-1, #F4F4F5)',
  padding: '14px 16px', fontSize: '1rem', fontFamily: 'inherit',
};
const helperStyle = {
  fontSize: '0.84rem', color: 'rgba(255,255,255,0.55)',
  marginTop: 6, fontFamily: 'Inter, sans-serif',
};
const sectionTitleStyle = {
  fontSize: '1.05rem', fontWeight: 500, color: 'var(--mood-text-1, #F4F4F5)',
  marginBottom: 14,
};
const sectionEyebrowStyle = {
  fontSize: '0.66rem', letterSpacing: '0.22em',
  color: 'var(--mood-teal, #00C9B3)', textTransform: 'uppercase',
  marginBottom: 8, fontFamily: 'Inter, sans-serif',
};
const dividerStyle = {
  margin: '36px 0', height: 1, background: 'rgba(255,255,255,0.06)', border: 'none',
};

// HQ Country ISO → suggested MOOD market code. Stays in code because it
// is *technical metadata*, not user-visible. The codes are never shown.
const HQ_TO_MARKET = {
  IT: 'italy', SM: 'italy', VA: 'italy',
  DE: 'dach', AT: 'dach', CH: 'dach', LI: 'dach',
  FR: 'france_fr_europe', BE: 'france_fr_europe', LU: 'france_fr_europe',
  MC: 'france_fr_europe', AD: 'france_fr_europe',
  GB: 'uk_ireland', IE: 'uk_ireland',
  ES: 'spain_iberian', PT: 'spain_iberian',
  SE: 'scandinavia', NO: 'scandinavia', DK: 'scandinavia',
  FI: 'scandinavia', IS: 'scandinavia',
  US: 'usa_national',
  AE: 'gcc_luxury', SA: 'gcc_luxury', QA: 'gcc_luxury', KW: 'gcc_luxury',
  BH: 'gcc_luxury', OM: 'gcc_luxury',
  GT: 'central_america', PA: 'central_america', CR: 'central_america',
  HN: 'central_america', NI: 'central_america', SV: 'central_america',
  BZ: 'central_america', DO: 'central_america', CU: 'central_america',
  AR: 'spanish_latam', CL: 'spanish_latam', CO: 'spanish_latam',
  PE: 'spanish_latam', UY: 'spanish_latam', BO: 'spanish_latam',
  EC: 'spanish_latam', PY: 'spanish_latam', VE: 'spanish_latam',
  BR: 'brazil',
  MX: 'spanish_mexico',
};

const Step2Location = ({ t, form, update, next, back, locale }) => {
  const { items: markets, ready: marketsReady } = useOperatingMarkets(locale || 'it-IT');
  const { items: countries, ready: countriesReady } = useCountries(locale || 'it-IT');
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const [cityError, setCityError] = useState(false);

  // Mapbox debounced city search — graceful fallback to free-text when 403
  useEffect(() => {
    const cc = form.headquarter_country_iso || form.country || '';
    const q  = (form.headquarter_city || form.city || '').trim();
    if (!cc || q.length < 2) { setCitySuggestions([]); setCityError(false); return; }
    setCityLoading(true);
    const tid = setTimeout(async () => {
      try {
        const r = await axios.get(`${BACKEND}/api/studio/v2/cities`,
          { params: { country: cc, q, limit: 6 } });
        const items = r.data?.items || [];
        setCitySuggestions(items);
        // If Mapbox returned no items, mark "no suggestions" — fallback
        // remains free text; we DO NOT show an error to the user, just
        // hide the dropdown.
        setCityError(items.length === 0);
      } catch {
        setCitySuggestions([]);
        setCityError(true);
      } finally { setCityLoading(false); }
    }, 380);
    return () => clearTimeout(tid);
  }, [form.headquarter_country_iso, form.headquarter_city, form.country, form.city]);

  // Defaults
  useEffect(() => {
    if (!form.primary_operating_market_code && markets.length > 0) {
      const it = markets.find((m) => m.code === 'italy');
      update({ primary_operating_market_code: (it || markets[0]).code });
    }
  }, [markets]); // eslint-disable-line
  useEffect(() => {
    if (!form.headquarter_country_iso && countries.length > 0) {
      const it = countries.find((c) => c.iso2 === 'IT');
      update({ headquarter_country_iso: (it || countries[0]).iso2 });
    }
  }, [countries]); // eslint-disable-line

  const hqAutoApplied = useRef(false);
  useEffect(() => {
    if (!form.headquarter_country_iso) return;
    const suggested = HQ_TO_MARKET[form.headquarter_country_iso];
    if (suggested && markets.find((m) => m.code === suggested) && !hqAutoApplied.current) {
      update({ primary_operating_market_code: suggested });
      hqAutoApplied.current = true;
    }
  }, [form.headquarter_country_iso, markets]); // eslint-disable-line

  if (!marketsReady || !countriesReady) {
    return <p data-testid="step2-loading" style={{ opacity: 0.55 }}>…</p>;
  }

  const hqCountry = countries.find((c) => c.iso2 === form.headquarter_country_iso);
  const canContinue = !!form.primary_operating_market_code
                   && !!form.headquarter_country_iso
                   && !!(form.headquarter_city || '').trim();

  const pickCity = (sug) => {
    update({
      headquarter_city:   sug.name,
      headquarter_region: sug.region,
      headquarter_lat:    sug.lat,
      headquarter_lng:    sug.lng,
      mapbox_place_id:    sug.place_id,
    });
    setCitySuggestions([]);
    setShowCityDropdown(false);
  };

  const cityPlaceholder = hqCountry?.iso2 === 'IT'
    ? t('step2.city.placeholder_italy', 'Milano…')
    : t('step2.city.placeholder', 'Inserisci la città…');

  return (
    <div data-testid="step2-location">
      <h1 style={{
        fontSize: 'clamp(2rem, 4.5vw, 3rem)', lineHeight: 1.1,
        margin: '0 0 36px', fontWeight: 500, letterSpacing: '-0.02em',
        color: 'var(--mood-text-1, #F4F4F5)',
      }} data-testid="step2-title">{t('step2_title')}</h1>

      {/* ─── A · MOOD Operating Market — VISUAL CARD GRID ──────────── */}
      <section data-testid="section-operating-market">
        <p style={sectionEyebrowStyle}>{t('step2.market.eyebrow', 'A · Mercato operativo')}</p>
        <h2 style={sectionTitleStyle}>{t('step2_market_title')}</h2>
        <p style={{ ...helperStyle, marginTop: 0, marginBottom: 16 }}>{t('step2_market_helper')}</p>

        <MarketCardGrid
          markets={markets}
          value={form.primary_operating_market_code}
          onChange={(code) => update({ primary_operating_market_code: code })} />
      </section>

      <hr style={dividerStyle} />

      {/* ─── B · Headquarter ────────────────────────────────────────── */}
      <section data-testid="section-headquarter">
        <p style={sectionEyebrowStyle}>{t('step2.hq.eyebrow', 'B · Sede')}</p>
        <h2 style={sectionTitleStyle}>{t('step2_hq_title')}</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
          <div>
            <label style={labelStyle}>{t('step2_country')}</label>
            <select
              data-testid="hq-country-select"
              value={form.headquarter_country_iso || ''}
              onChange={(e) => { hqAutoApplied.current = false;
                                 update({ headquarter_country_iso: e.target.value,
                                          headquarter_city: '', headquarter_lat: null,
                                          headquarter_lng: null,
                                          headquarter_region: null,
                                          mapbox_place_id: null }); }}
              style={inputStyle}>
              {countries.map((c) => (
                <option key={c.iso2} value={c.iso2} style={{ background: '#0A0A0B' }}>
                  {c.flag ? `${c.flag}  ${c.label}` : c.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ position: 'relative' }}>
            <label style={labelStyle}>{t('step2_city')}</label>
            <input
              data-testid="hq-city-input"
              type="text"
              value={form.headquarter_city || ''}
              onChange={(e) => { update({ headquarter_city: e.target.value,
                                          headquarter_lat: null, headquarter_lng: null,
                                          mapbox_place_id: null });
                                  setShowCityDropdown(true); }}
              onFocus={() => setShowCityDropdown(true)}
              placeholder={cityPlaceholder}
              autoComplete="off"
              style={inputStyle} />
            {cityLoading && (
              <span data-testid="city-loading" aria-hidden="true" style={{
                position: 'absolute', right: 12, top: 44,
                fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)',
              }}>…</span>
            )}
            {showCityDropdown && citySuggestions.length > 0 && (
              <ul data-testid="city-suggestions" style={{
                position: 'absolute', top: '100%', left: 0, right: 0,
                background: '#161617',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6, marginTop: 4, padding: 4,
                listStyle: 'none', zIndex: 20, maxHeight: 240, overflowY: 'auto',
              }}>
                {citySuggestions.map((s) => (
                  <li key={s.place_id || s.full_name}>
                    <button type="button"
                      onClick={() => pickCity(s)}
                      data-testid={`city-suggestion-${s.name}`}
                      style={{
                        width: '100%', textAlign: 'left',
                        background: 'transparent', border: 'none',
                        color: 'var(--mood-text-1, #F4F4F5)',
                        padding: '10px 12px', fontFamily: 'inherit', cursor: 'pointer',
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                      <span style={{ fontSize: '0.94rem' }}>{s.name}</span>
                      <span style={{ fontSize: '0.74rem',
                                     color: 'rgba(255,255,255,0.45)', marginLeft: 8 }}>{s.full_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {/* Fallback hint when Mapbox not configured / scope missing */}
            {cityError && (form.headquarter_city || '').length >= 2 && (
              <p data-testid="city-fallback-hint" style={{
                fontSize: '0.74rem', color: 'rgba(255,255,255,0.4)',
                marginTop: 6, marginBottom: 0,
              }}>{t('step2.city.fallback_hint', 'Inserisci manualmente il nome della città.')}</p>
            )}
          </div>
        </div>
      </section>

      <hr style={dividerStyle} />

      {/* ─── C · Target Countries (optional) ────────────────────────── */}
      <section data-testid="section-target-countries">
        <p style={sectionEyebrowStyle}>{t('step2.targets.eyebrow', 'C · Paesi target  ·  Opzionale')}</p>
        <h2 style={sectionTitleStyle}>{t('step2_targets_title')}</h2>
        <p style={{ ...helperStyle, marginTop: 0, marginBottom: 16 }}>{t('step2_targets_helper')}</p>

        <TargetCountriesPicker
          allCountries={countries.filter((c) => c.iso2 !== form.headquarter_country_iso)}
          selected={form.target_countries || []}
          onChange={(nx) => update({ target_countries: nx })}
          placeholder={t('step2.targets.search.placeholder', 'Cerca un Paese…')}
          t={t}
          locale={locale}
          max={3} />
      </section>

      {/* ─── Nav ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 40 }}>
        <button type="button" onClick={back} data-testid="step2-back"
          style={{
            background: 'transparent', color: 'rgba(255,255,255,0.6)',
            border: 'none', cursor: 'pointer',
            padding: '14px 4px', fontSize: '0.92rem', fontFamily: 'inherit',
          }}>← {t('btn_back')}</button>
        <button type="button" disabled={!canContinue} onClick={next}
          data-testid="step2-continue"
          style={{
            background: canContinue ? 'var(--mood-teal, #00C9B3)' : 'rgba(255,255,255,0.08)',
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
