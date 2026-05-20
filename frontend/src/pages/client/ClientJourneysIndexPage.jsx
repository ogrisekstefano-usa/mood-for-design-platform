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

const JourneyCard = ({ j, isArchived = false }) => {
  const cover = j.cover_url;
  const chapter = j.current_chapter?.title;
  return (
    <Link
      to={`/client/journey/${j.journey_id}`}
      className={`cj-jcard${isArchived ? ' is-archived' : ''}`}
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
        {isArchived ? (
          j.closed_at && (
            <p className="cj-jcard__chapter" style={{ opacity: 0.7 }}>
              Memoria depositata · {fmtDate(j.closed_at)}
            </p>
          )
        ) : (
          <>
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
          </>
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
    const fetchOnce = () => api.get('/api/client/journeys').then((r) => r.data);

    (async () => {
      try {
        let d = await fetchOnce();
        // Cold-login race: on first navigation right after login the tenant
        // context may not be fully resolved yet — a single short retry on
        // zero_data smooths the experience.
        if (alive && d?.zero_data) {
          await new Promise((r) => setTimeout(r, 700));
          if (!alive) return;
          try { d = await fetchOnce(); } catch { /* keep first response */ }
        }
        if (!alive) return;
        // Deep entry: 1 ACTIVE Journey only → go straight to companion.
        // Archived journeys are kept in their own section and never auto-open.
        const activeOnly = (d.journeys || []).filter((j) => !j.is_archived);
        if (!d.zero_data && activeOnly.length === 1 && (d.journeys || []).length === 1) {
          navigate(`/client/journey/${activeOnly[0].journey_id}`, { replace: true });
          return; // keep loading=true so the welcome screen doesn't flash
        }
        setData(d);
        setLoading(false);
      } catch {
        if (!alive) return;
        setData({ zero_data: true, journeys: [] });
        setLoading(false);
      }
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

  const active = (data.journeys || []).filter((j) => !j.is_archived);
  const archived = (data.journeys || []).filter((j) => j.is_archived);

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

      {/* Journey in corso */}
      {active.length > 0 && (
        <section className="cj-section" data-testid="client-journeys-grid-section">
          <div className="cj-section__head">
            <div>
              <p className="cj-section__eyebrow">In corso</p>
              <h2 className="cj-section__title"><em>I percorsi che stai attraversando</em></h2>
            </div>
            <span className="cj-section__count">
              {active.length} {active.length === 1 ? 'percorso' : 'percorsi'}
            </span>
          </div>
          <div className="cj-grid" data-testid="client-journeys-grid">
            {active.map((j) => <JourneyCard key={j.journey_id} j={j} />)}
          </div>
        </section>
      )}

      {/* Memoria della casa — archivio sobrio */}
      {archived.length > 0 && (
        <section className="cj-section cj-section--archive"
                 data-testid="client-journeys-archive-section">
          <div className="cj-section__head">
            <div>
              <p className="cj-section__eyebrow">Journey Archive</p>
              <h2 className="cj-section__title"><em>La memoria della casa</em></h2>
            </div>
            <span className="cj-section__count">
              {archived.length} {archived.length === 1 ? 'percorso' : 'percorsi'}
            </span>
          </div>
          <p className="cj-archive-lede">
            I percorsi che appartengono ora alla memoria progettuale della casa.
          </p>
          <div className="cj-grid" data-testid="client-journeys-archive-grid">
            {archived.map((j) => <JourneyCard key={j.journey_id} j={j} isArchived />)}
          </div>
        </section>
      )}
    </div>
  );
};

export default ClientJourneysIndexPage;
