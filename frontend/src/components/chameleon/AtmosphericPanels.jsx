/**
 * AtmosphericPanels · ITER168 — Emotional Interpretation Layer™
 *
 * First emotional intelligence surface of Blueprint Chameleon™.
 *
 * What it is NOT:
 *   ❌ a moodboard grid
 *   ❌ "Modern Living / Japandi / Boho" category cards
 *   ❌ a photo gallery
 *
 * What it IS:
 *   ✅ a cinematic, slow-breathing composition of editorial panels that
 *      INTERPRET the client's emerging atmosphere
 *   ✅ DB-driven via `/api/atmospheric/panels?locale=…&market=…`
 *   ✅ overlay-toned, motion-aware, market-affinity-filterable
 *
 * The component renders 2-3 panels with generous breathing room. Each
 * panel: tall editorial frame, single hero image, soft gradient overlay,
 * minimal typography (italic Cormorant title + 2-line interpretation).
 *
 * NO border cards. NO heavy shadows. NO Pinterest grid.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './atmospheric-panels.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const OVERLAY_TONES = {
  'cream-veil':  'linear-gradient(180deg, rgba(245,242,237,0.0) 35%, rgba(245,242,237,0.62) 100%)',
  'bronze-veil': 'linear-gradient(180deg, rgba(42,28,16,0.05) 30%, rgba(142,115,64,0.55) 100%)',
  'cool-glass':  'linear-gradient(180deg, rgba(220,232,238,0.0) 35%, rgba(60,84,98,0.55) 100%)',
  'sunset-haze': 'linear-gradient(180deg, rgba(60,30,20,0.05) 30%, rgba(186,118,82,0.5) 100%)',
};

export const AtmosphericPanels = ({
  locale = 'it-IT',
  market,
  limit = 3,
  eyebrow = 'Quello che iniziamo a leggere',
}) => {
  const [panels, setPanels] = useState([]);
  const [ready, setReady]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (locale) params.set('locale', locale);
        if (market) params.set('market', market);
        params.set('limit', String(limit));
        const { data } = await axios.get(
          `${BACKEND_URL}/api/atmospheric/panels?${params}`,
        );
        if (!cancelled) {
          setPanels(Array.isArray(data) ? data.slice(0, limit) : []);
          setReady(true);
        }
      } catch (_) {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [locale, market, limit]);

  if (!ready) {
    return (
      <section className="atm-panels atm-panels--skeleton" aria-busy="true" data-testid="atm-panels-skeleton">
        <div className="atm-panels__head">
          <span className="atm-panels__eyebrow">{eyebrow}</span>
        </div>
        <div className="atm-panels__row">
          {Array.from({ length: limit }).map((_, i) => (
            <div className="atm-panel atm-panel--ghost" key={i} aria-hidden />
          ))}
        </div>
      </section>
    );
  }

  if (!panels.length) return null;

  return (
    <section className="atm-panels" data-testid="atm-panels">
      <div className="atm-panels__head">
        <span className="atm-panels__eyebrow" data-testid="atm-panels-eyebrow">{eyebrow}</span>
      </div>
      <div className="atm-panels__row" data-testid="atm-panels-row">
        {panels.map((p, idx) => {
          const asset = (p.visual_assets && p.visual_assets[0]) || {};
          const overlay = OVERLAY_TONES[p.overlay_tone] || OVERLAY_TONES['cream-veil'];
          return (
            <article
              key={p.id}
              className={`atm-panel atm-panel--${p.motion_level || 'still'}`}
              data-testid={`atm-panel-${p.slug}`}
              data-tone={p.emotional_tone}
              style={{ animationDelay: `${160 + idx * 140}ms` }}
            >
              <div className="atm-panel__frame" aria-hidden>
                <img
                  src={asset.url}
                  alt=""
                  className="atm-panel__image"
                  loading="lazy"
                  decoding="async"
                  style={{ objectPosition: asset.focal_point || '50% 50%' }}
                />
                <div className="atm-panel__overlay" style={{ background: overlay }} />
              </div>
              <div className="atm-panel__copy">
                <h3 className="atm-panel__title" data-testid={`atm-panel-title-${p.slug}`}>
                  {p.title}
                </h3>
                {p.interpretation && (
                  <p className="atm-panel__interp" data-testid={`atm-panel-interp-${p.slug}`}>
                    {p.interpretation}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default AtmosphericPanels;
