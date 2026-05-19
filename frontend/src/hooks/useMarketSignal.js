/**
 * useMarketSignal — Cultural Signal Hook · MOOD for DESIGN™
 *
 * NON è un tracker marketing. NON misura conversion rate, CTR, sessions.
 * Raccoglie 5 segnali editoriali che indicano *risonanza*, *interesse*,
 * *affinità materica*, *attenzione narrativa* — il linguaggio della
 * relazione, non del funnel.
 *
 * Scope strict (5 segnali editoriali ONLY):
 *   • gallery_open   — l'utente apre una galleria di progetto
 *   • hotspot_open   — l'utente apre un detail point su un'immagine
 *   • article_read   — lettura attiva (dwell > 30s)
 *   • cta_click      — interesse verso un invito editoriale
 *   • material_zoom  — esplorazione tattile di un materiale
 *
 * Privacy-by-design:
 *   • Nessun PII inviato (filtro doppio: client + server)
 *   • Opt-out via localStorage['mfd_signal_optout'] = '1'
 *   • fetch keepalive — non blocca mai l'unload del visitor
 */
import { useCallback, useEffect, useRef } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const ENDPOINT = `${BACKEND_URL}/api/market-intelligence/events`;

// Scope chiuso. Aggiunte fuori da questo set richiedono decisione editoriale.
export const EDITORIAL_SIGNALS = Object.freeze([
  'gallery_open',
  'hotspot_open',
  'article_read',
  'cta_click',
  'material_zoom',
]);

const PII_KEYS = new Set([
  'email', 'phone', 'name', 'first_name', 'last_name', 'address',
  'ip', 'ip_address', 'lat', 'lng', 'latitude', 'longitude',
  'user_id', 'session_id', 'cookie', 'device_id', 'fingerprint',
]);

const stripPii = (obj) => {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  Object.keys(obj).forEach((k) => {
    if (!PII_KEYS.has(k.toLowerCase())) out[k] = obj[k];
  });
  return out;
};

/**
 * Hook principale — emette un segnale culturale anonimo.
 *
 * Restituisce un oggetto con helpers semantici (fireGalleryOpen, etc.)
 * e un fire(eventType, data) generico — quest'ultimo accetta SOLO i
 * 5 signal types nella whitelist; signal type sconosciuti vengono
 * silenziati (no-op) per evitare uso improprio.
 *
 * @param {object} [opts]
 * @param {string} [opts.tenantId]       — fallback when not auto-detected
 * @param {string} [opts.marketCode]
 * @param {string} [opts.submarketCode]
 * @param {string} [opts.locale]
 */
export function useMarketSignal(opts = {}) {
  const fire = useCallback(async (eventType, eventData = {}) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage?.getItem('mfd_signal_optout') === '1') {
        return;
      }
      // Strict scope guard — solo i 5 signal type editoriali.
      if (!EDITORIAL_SIGNALS.includes(eventType)) {
        return;
      }
      const tenantId = opts.tenantId
        || (typeof window !== 'undefined' && window.__MFD_TENANT_ID__)
        || null;
      if (!tenantId) return;

      const payload = {
        tenant_id:      tenantId,
        event_type:     eventType,
        market_code:    opts.marketCode || null,
        submarket_code: opts.submarketCode || null,
        locale_code:    opts.locale || (typeof navigator !== 'undefined' ? navigator.language : null),
        event_data:     stripPii(eventData),
      };

      await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: 'omit',
      });
    } catch {
      // Mai bloccare la UX del visitor.
    }
  }, [opts.tenantId, opts.marketCode, opts.submarketCode, opts.locale]);

  // Helpers semantici — il nome è la tassonomia editoriale.
  const fireGalleryOpen  = useCallback((data) => fire('gallery_open',  data), [fire]);
  const fireHotspotOpen  = useCallback((data) => fire('hotspot_open',  data), [fire]);
  const fireArticleRead  = useCallback((data) => fire('article_read',  data), [fire]);
  const fireCtaClick     = useCallback((data) => fire('cta_click',     data), [fire]);
  const fireMaterialZoom = useCallback((data) => fire('material_zoom', data), [fire]);

  // Mantieni retro-compat: callable diretta (project_view legacy ora silenziato).
  const signalFn = fire;
  signalFn.fireGalleryOpen  = fireGalleryOpen;
  signalFn.fireHotspotOpen  = fireHotspotOpen;
  signalFn.fireArticleRead  = fireArticleRead;
  signalFn.fireCtaClick     = fireCtaClick;
  signalFn.fireMaterialZoom = fireMaterialZoom;
  return signalFn;
}

/**
 * useDwellRead — emette `article_read` quando l'utente raggiunge una
 * soglia di lettura (default 30s) sull'articolo identificato.
 *
 * @param {object} opts
 * @param {string} opts.articleSlug         — identificativo articolo (no PII)
 * @param {string} [opts.market]            — market_code per overlay culturale
 * @param {string} [opts.locale]
 * @param {number} [opts.thresholdMs=30000] — soglia di lettura
 * @param {boolean} [opts.enabled=true]
 */
export function useDwellRead(opts) {
  const { articleSlug, market, locale, thresholdMs = 30000, enabled = true } = opts || {};
  const signal = useMarketSignal({ marketCode: market, locale });
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
  }, [articleSlug]);

  useEffect(() => {
    if (!enabled || !articleSlug || firedRef.current) return undefined;
    const t = setTimeout(() => {
      if (firedRef.current) return;
      firedRef.current = true;
      signal.fireArticleRead({ article_slug: articleSlug, dwell_ms: thresholdMs });
    }, thresholdMs);
    return () => clearTimeout(t);
  }, [enabled, articleSlug, thresholdMs, signal]);
}

export default useMarketSignal;
