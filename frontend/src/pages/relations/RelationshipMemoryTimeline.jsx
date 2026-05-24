/**
 * RelationshipMemoryTimeline · the Sprint B core surface.
 *
 * Editorial timeline · NOT a CRM activity feed. The layout is two
 * columns:
 *   · LEFT  · Memory chapters (Early Signals → Project Momentum)
 *   · RIGHT · Relationship Intelligence Panel — warmth, recurring
 *             atmospheres, dominant materials, alignment narratives.
 *             Expressed in prose, never as numbers or KPIs.
 *
 * The page is mounted at /relations/memory/:subjectId.
 */
import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import useMemoryTimeline from './useMemoryTimeline';
import RelationshipMemoryChapter from './RelationshipMemoryChapter';
import './relationship-memory.css';

const IntelligencePanel = ({ intelligence }) => {
  if (!intelligence) return null;
  const { warmth, recurring_atmospheres = [], dominant_materials = [], alignment = [] } = intelligence;
  return (
    <aside className="mem-intel" data-testid="mem-intel-panel" aria-label="Relationship intelligence">
      <section className="mem-intel__section">
        <span className="mem-intel__eyebrow">Relationship warmth</span>
        <h3 className="mem-intel__line">{warmth?.label || 'Listening'}</h3>
        <p className="mem-intel__prose">{warmth?.lede}</p>
      </section>

      {recurring_atmospheres.length > 0 && (
        <section className="mem-intel__section">
          <span className="mem-intel__eyebrow">Recurring atmospheres</span>
          <ul className="mem-intel__list" data-testid="mem-intel-atmos">
            {recurring_atmospheres.map((a, i) => (
              <li key={i} className="mem-intel__item">
                <em>{a.label}</em>
                {a.weight > 1 && <span className="mem-intel__weight">×{a.weight}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {dominant_materials.length > 0 && (
        <section className="mem-intel__section">
          <span className="mem-intel__eyebrow">Dominant materials</span>
          <ul className="mem-intel__list" data-testid="mem-intel-materials">
            {dominant_materials.map((m, i) => (
              <li key={i} className="mem-intel__item">{m.label}</li>
            ))}
          </ul>
        </section>
      )}

      {alignment.length > 0 && (
        <section className="mem-intel__section">
          <span className="mem-intel__eyebrow">Alignment tendencies</span>
          <ul className="mem-intel__alignment" data-testid="mem-intel-alignment">
            {alignment.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </section>
      )}
    </aside>
  );
};

const RelationshipMemoryTimeline = () => {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useMemoryTimeline(subjectId);

  return (
    <div className="mem-shell" data-testid="mem-shell">
      <header className="mem-shell__top">
        <button
          type="button"
          className="mem-shell__back"
          onClick={() => navigate(-1)}
          data-testid="mem-back"
        >
          <ArrowLeft size={16} strokeWidth={1.5} /> Back
        </button>
        <span className="mem-shell__crumb">
          <Link to="/relations/leads">Client Relations™</Link> · Relationship Memory
        </span>
      </header>

      {loading && (
        <div className="mem-shell__loading" data-testid="mem-loading">
          Opening the relationship's memory…
        </div>
      )}
      {error && <div className="mem-shell__error" data-testid="mem-error">{error}</div>}

      {!loading && !error && data && (
        <>
          <header className="mem-hero" data-testid="mem-hero">
            <p className="mem-hero__eyebrow">RELATIONSHIP MEMORY™</p>
            <h1 className="mem-hero__title">{data.subject?.name || 'A relationship'}</h1>
            <p className="mem-hero__sub">
              {(data.subject?.kind || 'lead').toUpperCase()} · {(data.subject?.locale_code || '—').toUpperCase()} ·
              {' '}{data.event_count} captured moment{data.event_count === 1 ? '' : 's'}
            </p>
          </header>

          <div className="mem-grid">
            <main className="mem-chapters" data-testid="mem-chapters">
              {(!data.chapters || data.chapters.length === 0) ? (
                <div className="mem-empty" data-testid="mem-empty">
                  <p className="mem-empty__title">No memory yet.</p>
                  <p className="mem-empty__sub">
                    The relationship hasn't spoken enough for chapters to form.
                    Continue the interview to begin the editorial memory.
                  </p>
                </div>
              ) : (
                data.chapters.map((ch, i) => (
                  <RelationshipMemoryChapter key={ch.key} chapter={ch} index={i} />
                ))
              )}
            </main>

            <IntelligencePanel intelligence={data.intelligence} />
          </div>
        </>
      )}
    </div>
  );
};

export default RelationshipMemoryTimeline;
