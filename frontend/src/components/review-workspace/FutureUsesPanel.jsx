/**
 * Future Uses™ Panel — V3.
 * Renders "Utilizzato in" (state A) when total_uses > 0, otherwise
 * "Disponibile per" (state B). Real DB data only.
 */
import React from 'react';

const LABELS = {
  moodboard: 'Moodboard',
  design_journey: 'Design Journey',
  material_board: 'Material Board',
  client_presentation: 'Presentazione Cliente',
  product_selection: 'Selezione Cliente',
  magazine: 'Magazine',
  social_story: 'Social Story',
  home_staging_pack: 'Home Staging Pack',
};

export default function FutureUsesPanel({ data, loading = false }) {
  if (loading) {
    return (
      <div className="rw-future" data-testid="rw-future-uses-loading">
        <div className="rw-future__title">Future Uses™</div>
        <div style={{ fontSize: 11, color: 'var(--rw-text-muted)' }}>
          Caricamento utilizzi…
        </div>
      </div>
    );
  }
  if (!data) return null;

  const isUsed = (data.state === 'in_use');
  const used = data.used_in || {};
  const available = data.available_for || [];

  return (
    <div className="rw-future" data-testid="rw-future-uses-panel">
      <div className="rw-future__title">Future Uses™</div>
      <div className="rw-future__state-label">
        {isUsed ? 'UTILIZZATO IN' : 'DISPONIBILE PER'}
      </div>
      {isUsed ? (
        <ul className="rw-future__list">
          {Object.entries(used)
            .sort(([, a], [, b]) => b - a)
            .map(([key, count]) => (
              <li
                key={key}
                className={`rw-future__row ${count > 0 ? 'is-used' : ''}`}
                data-testid={`rw-future-${key}`}
              >
                <span>{LABELS[key] || key}</span>
                <span className="rw-future__count">{count}</span>
              </li>
            ))}
        </ul>
      ) : (
        <div className="rw-future__chips">
          {available.map((s) => (
            <span
              key={s}
              className="rw-future__chip"
              data-testid={`rw-future-chip-${s}`}
            >
              {LABELS[s] || s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
