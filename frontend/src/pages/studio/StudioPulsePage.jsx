/**
 * StudioPulsePage — ITER156 Sprint A
 *
 * The living climate of the studio. Editorial observatory.
 * NOT a dashboard. NOT analytics. NO KPIs. NO charts.
 *
 * Five contemplative modules:
 *   1. Hero atmosphere
 *   2. Respiro dello Studio (climate)
 *   3. Relazioni in Silenzio (silent relationships)
 *   4. Intensità Curatoriale (designer narratives)
 *   5. Atmosfere Emergenti (convergence)
 *   6. Movimenti Recenti (soft realtime fragments)
 *
 * Realtime: subscribes to `relationship_events:tenant_id=eq.<tid>`
 * for soft refresh of climate + recent movements. Slow breathing,
 * no flashing, no badge storms.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  getStudioClimate,
  getSilentRelationships,
  getDesignerIntensity,
  getAtmosphereConvergence,
  getRecentMovements,
} from '../../lib/studioPulse';
import { subscribe } from '../../lib/realtimeBus';
import { useAuth } from '../../contexts/AuthContext';
import './studio-pulse.css';

const SOFT_REFRESH_MS = 60000; // climate refreshes every minute (safety net)

const fmtAgo = (iso) => {
  if (!iso) return 'ora';
  const sec = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return 'ora';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min fa`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ore fa`;
  return `${Math.floor(h / 24)} g fa`;
};

const StudioPulsePage = () => {
  const { user } = useAuth();
  const tenantId = user?.tenant_id || null;

  const [climate, setClimate] = useState(null);
  const [silent, setSilent] = useState(null);
  const [intensity, setIntensity] = useState(null);
  const [convergence, setConvergence] = useState(null);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshAll = useCallback(async () => {
    try {
      const [c, s, i, a, m] = await Promise.all([
        getStudioClimate(),
        getSilentRelationships({ days_silent: 3, limit: 6 }),
        getDesignerIntensity(),
        getAtmosphereConvergence(),
        getRecentMovements({ limit: 8 }),
      ]);
      setClimate(c.data);
      setSilent(s.data);
      setIntensity(i.data?.data || []);
      setConvergence(a.data);
      setMovements(m.data?.data || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshAll();
    const t = setInterval(refreshAll, SOFT_REFRESH_MS);
    return () => clearInterval(t);
  }, [refreshAll]);

  // Realtime — soft breathing on tenant events
  useEffect(() => {
    if (!tenantId) return undefined;
    const unsub = subscribe({
      key: `pulse:${tenantId}`,
      table: 'relationship_events',
      event: 'INSERT',
      filter: `tenant_id=eq.${tenantId}`,
      onPayload: () => {
        // soft refresh — only climate + movements, throttled
        queueMicrotask(() => {
          getStudioClimate().then(r => setClimate(r.data)).catch(() => {});
          getRecentMovements({ limit: 8 }).then(r => setMovements(r.data?.data || [])).catch(() => {});
        });
      },
    });
    return unsub;
  }, [tenantId]);

  return (
    <main className="pulse" data-testid="studio-pulse-page">
      {/* ── HERO ATMOSPHERE ─────────────────────────────────── */}
      <header className="pulse-hero" data-testid="pulse-hero">
        <p className="pulse-hero__eyebrow">STUDIO PULSE™</p>
        <h1 className="pulse-hero__title">
          Il clima vivo delle relazioni dello studio
        </h1>
        <p className="pulse-hero__sub">
          Le relazioni si muovono, rallentano, convergono.
          <br />
          Blueprint Dashboard registra la cadenza progettuale dello studio.
        </p>
      </header>

      {loading && (
        <p className="pulse-loading" data-testid="pulse-loading">
          Lo studio sta riprendendo respiro…
        </p>
      )}

      {!loading && (
        <>
          {/* ── RESPIRO DELLO STUDIO ──────────────────────────── */}
          {climate && (
            <section className="pulse-card pulse-climate" data-testid="pulse-climate">
              <p className="pulse-card__eyebrow">RESPIRO DELLO STUDIO™</p>
              <h2 className="pulse-card__title">{climate.headline}</h2>
              <p className="pulse-card__narrative">{climate.narrative}</p>
              <span className="pulse-climate__breath" aria-hidden />
            </section>
          )}

          {/* ── ATMOSFERE EMERGENTI ───────────────────────────── */}
          {convergence && convergence.snapshot_count > 0 && (
            <section className="pulse-card pulse-atmos" data-testid="pulse-atmospheres">
              <p className="pulse-card__eyebrow">ATMOSFERE EMERGENTI™</p>
              <p className="pulse-card__narrative pulse-atmos__lede">
                {convergence.narrative}
              </p>

              {convergence.atmospheres?.length > 0 && (
                <div className="pulse-atmos__group">
                  <p className="pulse-atmos__group-head">Linguaggi ricorrenti</p>
                  <ul className="pulse-chips">
                    {convergence.atmospheres.map((a, i) => (
                      <li key={i} className="pulse-chip" data-testid={`pulse-atmos-chip-${i}`}>
                        <em>{a.label}</em>
                        {a.weight > 1 && <span className="pulse-chip__weight">×{a.weight}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {convergence.materials?.length > 0 && (
                <div className="pulse-atmos__group">
                  <p className="pulse-atmos__group-head">Materiali che emergono</p>
                  <ul className="pulse-materials">
                    {convergence.materials.map((m, i) => (
                      <li key={i} className="pulse-material">{m.label}</li>
                    ))}
                  </ul>
                </div>
              )}

              {convergence.palette?.length > 0 && (
                <div className="pulse-atmos__group">
                  <p className="pulse-atmos__group-head">Palette in convergenza</p>
                  <div className="pulse-palette" data-testid="pulse-palette">
                    {convergence.palette.map((s) => (
                      <span
                        key={s.hex}
                        className="pulse-swatch"
                        style={{ background: s.hex }}
                        title={s.name || s.hex}
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── INTENSITÀ CURATORIALE ────────────────────────── */}
          {intensity && intensity.length > 0 && (
            <section className="pulse-card pulse-intensity" data-testid="pulse-intensity">
              <p className="pulse-card__eyebrow">INTENSITÀ CURATORIALE™</p>
              <h2 className="pulse-card__title">Come respirano i designer</h2>
              <ul className="pulse-designers">
                {intensity.map(d => (
                  <li key={d.designer_id} className="pulse-designer" data-testid={`pulse-designer-${d.designer_id}`}>
                    <div className="pulse-designer__head">
                      <p className="pulse-designer__name">{d.name}</p>
                      <p className="pulse-designer__presence">{d.presence_label}</p>
                    </div>
                    <p className="pulse-designer__narrative">{d.narrative}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── RELAZIONI IN SILENZIO ────────────────────────── */}
          {silent && (
            <section className="pulse-card pulse-silent" data-testid="pulse-silent">
              <p className="pulse-card__eyebrow">RELAZIONI IN SILENZIO™</p>
              <h2 className="pulse-card__title pulse-silent__title">
                {silent.aggregate}
              </h2>
              {silent.data?.length > 0 && (
                <ul className="pulse-silent__list">
                  {silent.data.map(s => (
                    <li key={s.lead_id} className="pulse-silent__item">
                      <p className="pulse-silent__narrative">{s.narrative}</p>
                      {s.last_movement && (
                        <p className="pulse-silent__when">
                          ultimo movimento · {fmtAgo(s.last_movement)}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* ── MOVIMENTI RECENTI ────────────────────────────── */}
          {movements.length > 0 && (
            <section className="pulse-card pulse-movements" data-testid="pulse-movements">
              <p className="pulse-card__eyebrow">MOVIMENTI RECENTI™</p>
              <h2 className="pulse-card__title">Gesti che attraversano lo studio</h2>
              <ol className="pulse-movements__list">
                {movements.map(m => (
                  <li key={m.id} className="pulse-movement" data-testid={`pulse-movement-${m.event_type}`}>
                    <p className="pulse-movement__narrative">{m.narrative}</p>
                    <p className="pulse-movement__meta">
                      <span>{fmtAgo(m.occurred_at)}</span>
                      {m.actor_label && <span className="pulse-movement__sep">·</span>}
                      {m.actor_label && <span>{m.actor_label}</span>}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </main>
  );
};

export default StudioPulsePage;
