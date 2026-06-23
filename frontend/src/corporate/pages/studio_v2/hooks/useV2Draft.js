/**
 * useV2Draft — persists the visitor's V2 funnel state into the existing
 * `studio_activation_drafts` table via the V1 draft endpoint (re-used,
 * no duplicate pipeline). Local state mirrors only the V2-shaped fields.
 */
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const BACKEND        = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY      = 'mood_studio_v2_token';
const LOCAL_FORM_KEY = 'mood_studio_v2_form';

const emptyForm = {
  archetype_code:                null,
  // New geo (V2 Step 2 refactor)
  primary_operating_market_code: null,
  headquarter_country_iso:       null,
  headquarter_city:              '',
  headquarter_lat:               null,
  headquarter_lng:               null,
  mapbox_place_id:               null,
  // New: target_countries = [{iso2, priority, status}]
  target_countries:              [],
  // Legacy mirrors (still read by some downstream)
  country:                       null,
  city:                          '',
  additional_markets:            [],
  // Contact + help
  first_name:         '',
  last_name:          '',
  contact_email:      '',
  phone_prefix:       '',
  phone_number:       '',
  help_topics:        [],
  help_other_text:    '',
};

export function useV2Draft() {
  const [draftToken, setDraftToken] = useState(
    () => localStorage.getItem(TOKEN_KEY) || null);
  const [form, setForm] = useState(() => {
    try {
      const raw = localStorage.getItem(LOCAL_FORM_KEY);
      return raw ? { ...emptyForm, ...JSON.parse(raw) } : emptyForm;
    } catch { return emptyForm; }
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const body = draftToken ? { draft_token: draftToken } : {};
        const r = await axios.post(`${BACKEND}/api/studio/activation/draft`, body);
        if (cancelled) return;
        if (r.data?.draft_token) {
          setDraftToken(r.data.draft_token);
          localStorage.setItem(TOKEN_KEY, r.data.draft_token);
        }
        setReady(true);
      } catch {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, []);

  const update = useCallback((patch) => {
    setForm((f) => {
      const next = { ...f, ...patch };
      try { localStorage.setItem(LOCAL_FORM_KEY, JSON.stringify(next)); }
      catch { /* silent */ }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(LOCAL_FORM_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setForm(emptyForm);
    setDraftToken(null);
  }, []);

  return { draftToken, form, update, reset, ready };
}
