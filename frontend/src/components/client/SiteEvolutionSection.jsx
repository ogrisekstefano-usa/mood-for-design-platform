/**
 * SiteEvolutionSection — Sprint G.8 · Site Evolution™.
 *
 * Memoria viva della trasformazione dello spazio. NON gallery.
 * NON media manager. Timeline editoriale documentaristica.
 *
 * Tre layer di lettura:
 *   1. Filtro per spazio (chip mono uppercase)
 *   2. Timeline cronologica raggruppata
 *   3. Before/After slider opzionale per le entry che lo dichiarano
 */
import React, { useState, useMemo, useRef, useCallback } from 'react';
import '../../pages/client/site-evolution.css';
import { useT } from '../../i18n/useT';

const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('it-IT',
      { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return ''; }
};

// ── Before / After slider ────────────────────────────────────────
const BeforeAfter = ({ before, after }) => {
  const { t } = useT();
  const wrap = useRef(null);
  const [pos, setPos] = useState(50);

  const onMove = useCallback((clientX) => {
    if (!wrap.current) return;
    const rect = wrap.current.getBoundingClientRect();
    const p = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPos(p);
  }, []);

  const onMouseDown = (e) => {
    e.preventDefault();
    const move = (ev) => onMove(ev.clientX);
    const up   = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  const onTouchMove = (e) => onMove(e.touches[0].clientX);

  return (
    <div className="se-baf" ref={wrap} data-testid="se-baf">
      <img src={before} alt="Prima dell'intervento" className="se-baf__img" />
      <div className="se-baf__after-wrap" style={{ width: `${pos}%` }}>
        <img src={after} alt="Stato attuale" className="se-baf__img" />
      </div>
      <span className="se-baf__label se-baf__label--before">Prima</span>
      <span className="se-baf__label se-baf__label--after">Stato attuale</span>
      <button
        type="button"
        className="se-baf__handle"
        style={{ left: `${pos}%` }}
        onMouseDown={onMouseDown}
        onTouchMove={onTouchMove}
        aria-label="Trascina per confrontare prima e dopo"
        data-testid="se-baf-handle"
      />
    </div>
  );
};

// ── Single entry card ────────────────────────────────────────────
const SiteEvolutionEntry = ({ entry }) => (
  <article className="se-entry" data-testid={`se-entry-${entry.id}`}>
    <aside className="se-entry__meta">
      <span className="se-entry__date">{fmtDate(entry.occurred_at)}</span>
      <span className="se-entry__kind">{entry.visit_label}</span>
      <span className="se-entry__space"><em>{entry.space_label}</em></span>
    </aside>
    <div className="se-entry__body">
      <h3 className="se-entry__title"><em>{entry.title}</em></h3>
      <p className="se-entry__narrative">{entry.narrative}</p>

      {entry.before_url && entry.after_url ? (
        <BeforeAfter before={entry.before_url} after={entry.after_url} />
      ) : entry.photos?.length > 0 ? (
        <div className="se-photos" data-testid={`se-photos-${entry.id}`}>
          {entry.photos.map((p, i) => (
            <figure
              key={i}
              className="se-photo"
              data-testid={`se-photo-${entry.id}-${i}`}
            >
              <img src={p.url} alt={p.caption || entry.title} loading="lazy" />
              {p.caption && (
                <figcaption className="se-photo__caption">{p.caption}</figcaption>
              )}
            </figure>
          ))}
        </div>
      ) : null}
    </div>
  </article>
);

// ── Main section ─────────────────────────────────────────────────
const SiteEvolutionSection = ({ data }) => {
  const [activeSpace, setActiveSpace] = useState('all');

  const entries = data?.entries || [];
  const groups  = data?.groups || [];

  const spaces = useMemo(() => {
    return [{ key: 'all', label: 'Tutti gli spazi' },
            ...groups.map((g) => ({ key: g.space_key, label: g.space_label }))];
  }, [groups]);

  const visible = useMemo(() => {
    const list = activeSpace === 'all'
      ? entries
      : entries.filter((e) => e.space_key === activeSpace);
    return [...list].sort((a, b) =>
      (b.occurred_at || '').localeCompare(a.occurred_at || ''));
  }, [entries, activeSpace]);

  if (!data?.available || entries.length === 0) {
    return (
      <div className="se-empty" data-testid="se-empty">
        <p className="se-empty__title">{t('client.site_evolution.il_cantiere_non_e_ancora_iniziato')}</p>
        <p className="se-empty__lede">
          Quando il tuo studio inizierà a documentare l'evoluzione fisica
          dello spazio — sopralluoghi, demolizioni, arrivo dei materiali —
          ogni momento entrerà qui come capitolo della memoria del Journey.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="se-section">
      {/* Filtro per spazio */}
      <div className="se-spaces" data-testid="se-spaces">
        {spaces.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActiveSpace(s.key)}
            className={`se-space-chip ${activeSpace === s.key ? 'is-active' : ''}`}
            data-testid={`se-space-${s.key}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="se-timeline" data-testid="se-timeline">
        {visible.map((e) => <SiteEvolutionEntry key={e.id} entry={e} />)}
      </div>
    </div>
  );
};

export default SiteEvolutionSection;
