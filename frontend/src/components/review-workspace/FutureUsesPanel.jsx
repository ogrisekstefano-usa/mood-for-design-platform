/**
 * KE-004 · P0-1 · Future Uses™ Panel (dual section)
 *
 * Mostra SIA "UTILIZZATO IN" (counts reali per surface) SIA
 * "DISPONIBILE PER" (surfaces che ancora non hanno usage).
 * Dati reali dal backend `/future-uses` — niente placeholder.
 */
import React from 'react';

const LABELS = {
  moodboard: 'Moodboard',
  design_journey: 'Design Journey',
  material_board: 'Material Board',
  client_presentation: 'Client Presentation',
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

  const used = data.used_in || {};
  const usedEntries = Object.entries(used).filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a);
  const unusedKeys = Object.keys(used).filter((k) => (used[k] || 0) === 0);

  return (
    <div className="rw-future" data-testid="rw-future-uses-panel">
      <div className="rw-future__title">Future Uses™</div>

      <div className="rw-future__section" data-testid="rw-future-used-in">
        <div className="rw-future__state-label">
          UTILIZZATO IN · {usedEntries.length}
        </div>
        {usedEntries.length > 0 ? (
          <ul className="rw-future__list">
            {usedEntries.map(([key, count]) => (
              <li
                key={key}
                className="rw-future__row is-used"
                data-testid={`rw-future-${key}`}
              >
                <span>{LABELS[key] || key}</span>
                <span className="rw-future__count">{count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div
            className="rw-future__empty"
            data-testid="rw-future-used-empty"
          >
            Entità non ancora collegata a moodboard, design journey o
            presentazione cliente.
          </div>
        )}
      </div>

      <div className="rw-future__section" data-testid="rw-future-available">
        <div className="rw-future__state-label">
          DISPONIBILE PER · {unusedKeys.length}
        </div>
        {unusedKeys.length > 0 ? (
          <div className="rw-future__chips">
            {unusedKeys.map((key) => (
              <span
                key={key}
                className="rw-future__chip"
                data-testid={`rw-future-chip-${key}`}
              >
                {LABELS[key] || key}
              </span>
            ))}
          </div>
        ) : (
          <div className="rw-future__empty">
            L'entità è già utilizzata in tutte le surface disponibili.
          </div>
        )}
      </div>
    </div>
  );
}
