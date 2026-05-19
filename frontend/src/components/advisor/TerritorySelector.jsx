/**
 * TerritorySelector — Relationship Territory Intelligence™ (Phase 1).
 * ────────────────────────────────────────────────────────────────────
 * Editorial luxury territory picker for advisors.
 *
 * Capabilities:
 *   • Mapbox Geocoding autocomplete (country-aware, locale-aware)
 *   • Multi-coverage chip list (one primary + N coverage)
 *   • Static map preview (dark minimal style, no controls)
 *   • Multilingual labels (uses Blueprint locale)
 *
 * The component is controlled by the parent: it calls `onAdd` /
 * `onRemove` / `onSetPrimary` when the user mutates the list.
 * If `apiBase` + `advisorId` are provided, it self-syncs via the
 * advisor_network admin endpoints.
 */
import './territory-selector.css';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, MapPin, X, Star, Globe2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

const TYPE_LABEL = {
  country:           { 'it-IT': 'Paese',                'en-US': 'Country' },
  macro_region:      { 'it-IT': 'Macro regione',        'en-US': 'Macro region' },
  state_province:    { 'it-IT': 'Stato / Provincia',    'en-US': 'State / Province' },
  metropolitan_area: { 'it-IT': 'Area metropolitana',   'en-US': 'Metropolitan area' },
  city_cluster:      { 'it-IT': 'Cluster urbano',       'en-US': 'City cluster' },
  city:              { 'it-IT': 'Città',                'en-US': 'City' },
  custom:            { 'it-IT': 'Territorio personalizzato', 'en-US': 'Custom territory' },
};

const tr = (dict, locale) => dict?.[locale] || dict?.[locale?.split('-')[0]] || dict?.['en-US'] || '';

// Map a Mapbox feature's place_type[0] to our internal taxonomy.
const featureType = (ft) => {
  const t = (ft?.place_type && ft.place_type[0]) || 'place';
  return ({
    country:     'country',
    region:      'state_province',
    district:    'metropolitan_area',
    place:       'city',
    locality:    'city',
    neighborhood:'city_cluster',
    address:     'city',
    postcode:    'city',
  })[t] || 'custom';
};

const I18N = {
  search_placeholder: { 'it-IT': 'Cerca città, regione o paese…', 'en-US': 'Search city, region or country…' },
  primary_lbl:        { 'it-IT': 'Area primaria',                'en-US': 'Primary area' },
  coverage_lbl:       { 'it-IT': 'Aree di copertura',            'en-US': 'Coverage areas' },
  empty:              { 'it-IT': 'Nessun territorio ancora — cerca una città o regione qui sopra.', 'en-US': 'No territories yet — search a city or region above.' },
  no_results:         { 'it-IT': 'Nessun risultato',             'en-US': 'No results' },
  no_token:           { 'it-IT': 'Mapbox token non configurato — autocomplete disabilitato', 'en-US': 'Mapbox token not configured — autocomplete disabled' },
  set_primary:        { 'it-IT': 'Imposta come primaria',        'en-US': 'Set as primary' },
  remove:             { 'it-IT': 'Rimuovi',                      'en-US': 'Remove' },
};

export const TerritorySelector = ({
  advisorId,
  locale = 'it-IT',
  territories: externalTerritories,
  onChange,
  readOnly = false,
}) => {
  const [territories, setTerritories] = useState(externalTerritories || []);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef();

  // Sync with parent
  useEffect(() => {
    if (externalTerritories) setTerritories(externalTerritories);
  }, [externalTerritories]);

  // Initial load from API if we have advisorId
  useEffect(() => {
    if (advisorId && !externalTerritories) {
      api.get(`/api/advisor/admin/advisors/${advisorId}/territories`)
        .then((r) => setTerritories(r.data?.territories || []))
        .catch(() => {});
    }
  }, [advisorId, externalTerritories]);

  // ── Mapbox geocoding ────────────────────────────────────────────
  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }
    if (!MAPBOX_TOKEN) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const lang = (locale || 'en').split('-')[0];
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
          + `?access_token=${MAPBOX_TOKEN}`
          + `&types=country,region,district,place,locality,neighborhood`
          + `&language=${lang}`
          + `&autocomplete=true&limit=6`;
        const r = await fetch(url);
        const j = await r.json();
        setSuggestions(j.features || []);
      } catch {
        setSuggestions([]);
      } finally { setSearching(false); }
    }, 280);
    return () => clearTimeout(debounceRef.current);
  }, [query, locale]);

  // ── Add a Mapbox feature ────────────────────────────────────────
  const pickSuggestion = async (feature) => {
    const ctx = feature.context || [];
    const countryCtx = ctx.find((c) => c.id?.startsWith('country.'));
    const regionCtx  = ctx.find((c) => c.id?.startsWith('region.'));

    const payload = {
      territory_type:    featureType(feature),
      country_code:      (countryCtx?.short_code || '').toUpperCase() || null,
      region:            regionCtx?.text || (feature.place_type?.includes('region') ? feature.text : null),
      sub_region:        null,
      city:              feature.place_type?.[0] === 'place' ? feature.text : null,
      geo_label:         feature.place_name || feature.text,
      mapbox_place_id:   feature.id,
      mapbox_place_type: feature.place_type?.[0],
      latitude:          feature.center?.[1],
      longitude:         feature.center?.[0],
      bbox:              feature.bbox || null,
      is_primary:        territories.length === 0,    // first = primary
    };

    if (advisorId) {
      try {
        const r = await api.post(`/api/advisor/admin/advisors/${advisorId}/territories`, payload);
        const next = [...territories, r.data.territory];
        setTerritories(next); onChange?.(next);
      } catch (e) {
        toast.error('Errore aggiunta territorio');
        return;
      }
    } else {
      // Detached mode (used inside "new advisor" drawer before save)
      const optimistic = { ...payload, id: `tmp-${Date.now()}` };
      const next = [...territories, optimistic];
      setTerritories(next); onChange?.(next);
    }

    setQuery(''); setSuggestions([]); setShowSuggestions(false);
  };

  const removeTerritory = async (t) => {
    if (advisorId && !String(t.id).startsWith('tmp-')) {
      try {
        await api.delete(`/api/advisor/admin/advisors/${advisorId}/territories/${t.id}`);
      } catch {
        toast.error('Errore rimozione'); return;
      }
    }
    const next = territories.filter((x) => x.id !== t.id);
    setTerritories(next); onChange?.(next);
  };

  const setAsPrimary = async (t) => {
    if (advisorId && !String(t.id).startsWith('tmp-')) {
      // Optimistic: delete + re-add with is_primary=true is messy; easier to
      // re-create. For Phase 1 we just patch locally and persist via re-post.
      try {
        await api.delete(`/api/advisor/admin/advisors/${advisorId}/territories/${t.id}`);
        const r = await api.post(`/api/advisor/admin/advisors/${advisorId}/territories`, {
          ...t, is_primary: true,
        });
        const next = territories
          .filter((x) => x.id !== t.id)
          .map((x) => ({ ...x, is_primary: false }))
          .concat([r.data.territory]);
        setTerritories(next); onChange?.(next);
      } catch { toast.error('Errore'); }
    } else {
      const next = territories.map((x) => ({ ...x, is_primary: x.id === t.id }));
      setTerritories(next); onChange?.(next);
    }
  };

  const primary = territories.find((t) => t.is_primary);
  const coverage = territories.filter((t) => !t.is_primary);

  // ── Static map preview (Mapbox Static Images API) ────────────────
  const staticMapUrl = useMemo(() => {
    if (!MAPBOX_TOKEN || !primary?.longitude || !primary?.latitude) return null;
    const lon = primary.longitude;
    const lat = primary.latitude;
    const pin = `pin-s+c9a36e(${lon},${lat})`;
    const zoom = primary.territory_type === 'country' ? 4
               : primary.territory_type === 'state_province' ? 6 : 9;
    return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${pin}/${lon},${lat},${zoom},0/600x180@2x?access_token=${MAPBOX_TOKEN}&attribution=false&logo=false`;
  }, [primary]);

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="trs" data-testid="territory-selector">
      {!MAPBOX_TOKEN && (
        <p className="trs__warning" data-testid="trs-no-token">
          <Globe2 size={11} /> {tr(I18N.no_token, locale)}
        </p>
      )}

      {!readOnly && (
        <div className="trs__search-wrap" data-testid="trs-search-wrap">
          <Search size={13} className="trs__search-icon" />
          <input
            className="trs__search"
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            placeholder={tr(I18N.search_placeholder, locale)}
            data-testid="trs-search-input"
          />
          {searching && <span className="trs__searching">…</span>}
          {showSuggestions && suggestions.length > 0 && (
            <ul className="trs__suggestions" data-testid="trs-suggestions">
              {suggestions.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    className="trs__suggestion"
                    onClick={() => pickSuggestion(f)}
                    data-testid={`trs-pick-${f.id}`}
                  >
                    <MapPin size={11} />
                    <span className="trs__suggestion-name">{f.text}</span>
                    <span className="trs__suggestion-ctx">{f.place_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {staticMapUrl && (
        <div className="trs__map" data-testid="trs-map">
          <img src={staticMapUrl} alt={primary?.geo_label || ''} loading="lazy" />
          <p className="trs__map-cap">{primary?.geo_label}</p>
        </div>
      )}

      {primary && (
        <div className="trs__group" data-testid="trs-group-primary">
          <p className="trs__group-lbl">{tr(I18N.primary_lbl, locale)}</p>
          <Chip
            t={primary}
            locale={locale}
            readOnly={readOnly}
            onRemove={() => removeTerritory(primary)}
            isPrimary
          />
        </div>
      )}

      {coverage.length > 0 && (
        <div className="trs__group" data-testid="trs-group-coverage">
          <p className="trs__group-lbl">{tr(I18N.coverage_lbl, locale)} · {coverage.length}</p>
          <div className="trs__chips">
            {coverage.map((t) => (
              <Chip
                key={t.id}
                t={t}
                locale={locale}
                readOnly={readOnly}
                onRemove={() => removeTerritory(t)}
                onPromote={() => setAsPrimary(t)}
              />
            ))}
          </div>
        </div>
      )}

      {territories.length === 0 && (
        <p className="trs__empty">{tr(I18N.empty, locale)}</p>
      )}
    </div>
  );
};

const Chip = ({ t, locale, readOnly, onRemove, onPromote, isPrimary }) => (
  <span className={`trs-chip ${isPrimary ? 'trs-chip--primary' : ''}`} data-testid={`trs-chip-${t.id}`}>
    {isPrimary && <Star size={9} strokeWidth={2} />}
    <span className="trs-chip__lbl">{t.geo_label}</span>
    <span className="trs-chip__type">{tr(TYPE_LABEL[t.territory_type] || {}, locale) || t.territory_type}</span>
    {!readOnly && !isPrimary && onPromote && (
      <button type="button" onClick={onPromote} className="trs-chip__btn" title={tr(I18N.set_primary, locale)}
              data-testid={`trs-promote-${t.id}`}>
        <Star size={10} strokeWidth={1.5} />
      </button>
    )}
    {!readOnly && (
      <button type="button" onClick={onRemove} className="trs-chip__btn trs-chip__btn--x" title={tr(I18N.remove, locale)}
              data-testid={`trs-remove-${t.id}`}>
        <X size={10} strokeWidth={2} />
      </button>
    )}
  </span>
);

export default TerritorySelector;
