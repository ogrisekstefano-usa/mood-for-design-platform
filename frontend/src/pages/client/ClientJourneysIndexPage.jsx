/**
 * ClientJourneysIndexPage — My Design Journeys™ (Sprint G.7).
 *
 * Il primo schermo del Client Portal. NON è un dashboard, è la
 * raccolta dei propri percorsi progettuali.
 *
 *   · Hero editoriale ("Il tuo percorso")
 *   · Griglia di Journey cards (cover · capitolo attivo · ultima evoluzione)
 *   · Stato zero-data: invito calmo all'attesa
 *
 * Quando esiste UN solo Journey vivo, lo apriamo direttamente (deep entry).
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import './client-companion.css';

const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('it-IT',
      { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return ''; }
};

const JourneyCard = ({ j }) => {
  const cover = j.cover_url;
  const chapter = j.current_chapter?.title;
  return (
    <Link
      to={`/client/journey/${j.journey_id}`}
      className="cj-jcard"
      data-testid={`client-journey-card-${j.journey_id}`}
    >
      <div
        className="cj-jcard__cover"
        style={cover ? { backgroundImage: `url(${cover})` } : {}}
      >
        {!cover && (
          <div className="cj-jcard__cover-empty"><em>·</em></div>
        )}
        <span className="cj-jcard__pill">{j.lifecycle_label}</span>
      </div>
      <div className="cj-jcard__body">
        <p className="cj-jcard__eyebrow">{j.studio_name}</p>
        <h3 className="cj-jcard__title"><em>{j.project_title}</em></h3>
        {chapter && (
          <p className="cj-jcard__chapter">
            Capitolo attivo · <em>{chapter}</em>
          </p>
        )}
        {j.progress && j.progress.total_chapters > 0 && (
          <p className="cj-jcard__chapter" style={{ opacity: 0.65 }}>
            {j.progress.approved_chapters} su {j.progress.total_chapters} capitoli approvati
          </p>
        )}
        {j.latest_evolution && (
          <p className="cj-jcard__evolution">"{j.latest_evolution.narrative}"</p>
        )}
      </div>
    </Link>
  );
};

const ClientJourneysIndexPage = () => {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: d } = await api.get('/api/client/journeys');
        if (!alive) return;
        // Deep entry: 1 Journey solo → vai dritto al companion.
        if (!d.zero_data && d.journeys?.length === 1) {
          navigate(`/client/journey/${d.journeys[0].journey_id}`, { replace: true });
          return;
        }
        setData(d);
      } catch {
        if (alive) setData({ zero_data: true, journeys: [] });
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [navigate]);

  if (loading) {
    return (
      <div data-testid="client-journeys-loading"
           className="cj-shell"
           style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: 'italic', fontSize: 17,
          color: 'color-mix(in srgb, var(--cp-text-primary) 55%, transparent)',
        }}>
          Stiamo aprendo il tuo percorso…
        </p>
      </div>
    );
  }

  if (!data || data.zero_data || !data.journeys?.length) {
    return (
      <div className="cj-shell" data-testid="client-journeys-empty">
        <div className="cj-welcome">
          <p className="cj-hero__eyebrow">Design Journey Companion™</p>
          <h1 className="cj-welcome__title">
            Il tuo Journey sta per iniziare
          </h1>
          <p className="cj-welcome__lede">
            Il primo capitolo del tuo percorso progettuale verrà condiviso
            dal tuo studio. Appena pronto, lo troverai qui — narrato passo
            dopo passo, in attesa del tuo sguardo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="cj-shell" data-testid="client-journeys-page">
      {/* Hero editoriale */}
      <section className="cj-hero" data-testid="client-journeys-hero">
        <div className="cj-hero__veil" aria-hidden="true" />
        <div className="cj-hero__noise" aria-hidden="true" />
        <div className="cj-hero__body">
          <p className="cj-hero__eyebrow">My Design Journeys™</p>
          <h1 className="cj-hero__title">
            <em>I tuoi percorsi progettuali</em>
          </h1>
          <p className="cj-hero__lede">
            Ogni Journey racconta una conversazione viva tra te e il tuo studio.
            Apri quello che vuoi attraversare oggi.
          </p>
        </div>
      </section>

      {/* Griglia Journey */}
      <section className="cj-section" data-testid="client-journeys-grid-section">
        <div className="cj-section__head">
          <div>
            <p className="cj-section__eyebrow">In corso</p>
            <h2 className="cj-section__title"><em>Tutti i tuoi Journey</em></h2>
          </div>
          <span className="cj-section__count">
            {data.journeys.length} {data.journeys.length === 1 ? 'percorso' : 'percorsi'}
          </span>
        </div>
        <div className="cj-grid" data-testid="client-journeys-grid">
          {data.journeys.map((j) => <JourneyCard key={j.journey_id} j={j} />)}
        </div>
      </section>
    </div>
  );
};

export default ClientJourneysIndexPage;
