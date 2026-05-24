/**
 * DensitySwitcher · 4-segment editorial control.
 * Compact · Default · Comfortable · Editorial.
 *
 * Rendered in Settings → Display, and surfaced as a small floating
 * accessibility shortcut in the top bar (optional).
 */
import React from 'react';
import useUiDensity from '../hooks/useUiDensity';
import './density-switcher.css';

const OPTIONS = [
  { v: 'compact',      l: 'Compact',     hint: '15px · denser studio rhythm' },
  { v: 'default',      l: 'Default',     hint: '17px · current baseline' },
  { v: 'comfortable',  l: 'Comfortable', hint: '18px · slower, more air' },
  { v: 'editorial',    l: 'Editorial',   hint: '19px · maximum breathing room' },
];

const DensitySwitcher = ({ variant = 'panel' }) => {
  const { density, setDensity } = useUiDensity();

  // Atelier Editorial Mode™ · one-click preset that sets density + (in
  // future) presence + cultural register. For now scoped to density;
  // presence vocabulary is read-only from server metadata.
  const applyAtelierMode = () => setDensity('editorial');

  return (
    <fieldset className={`density-switcher density-switcher--${variant}`} data-testid="density-switcher">
      <legend className="density-switcher__legend">UI Density · Font Size</legend>
      <p className="density-switcher__lede">
        How the studio's surfaces breathe. Affects body size, line-height, and section rhythm.
      </p>
      <div className="density-switcher__grid" role="radiogroup" aria-label="UI density">
        {OPTIONS.map((o) => {
          const active = density === o.v;
          return (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={active}
              className={`density-switcher__opt ${active ? 'is-active' : ''}`}
              onClick={() => setDensity(o.v)}
              data-testid={`density-switcher-${o.v}`}
            >
              <span className="density-switcher__opt-label">{o.l}</span>
              <span className="density-switcher__opt-hint">{o.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="density-switcher__preset" data-testid="atelier-editorial-mode">
        <div>
          <span className="density-switcher__preset-label">Atelier Editorial Mode™</span>
          <p className="density-switcher__preset-sub">
            One click · sets the studio to maximum breathing room (19px body, slower
            rhythm) for showroom presentations and quiet reading sessions.
          </p>
        </div>
        <button
          type="button"
          className="density-switcher__preset-btn"
          onClick={applyAtelierMode}
          data-testid="atelier-editorial-mode-apply"
        >
          Enter Editorial Mode
        </button>
      </div>
    </fieldset>
  );
};

export default DensitySwitcher;
