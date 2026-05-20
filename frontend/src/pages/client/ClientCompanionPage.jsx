/**
 * ClientCompanionPage — Design Journey Companion Experience™.
 * Sprint G.7. Route: /client/journey/:journeyId
 *
 * Esperienza curatoriale che accompagna il cliente lungo il proprio
 * Design Journey™. Sette sezioni narrative, ancorate via hash anchor:
 *
 *   01 · #capitolo       — Active Chapter™
 *   02 · #direzioni      — Shared Directions™
 *   03 · #conversazioni  — Conversations™
 *   04 · #evoluzione     — Evolution Timeline™
 *   05 · #materia        — Materials & Atmospheres™
 *   06 · #memoria        — Memory & Archive™
 *
 * Direction Lock: nessun riferimento a SaaS PM / queue di gestione / repo file. Tutto è narrazione.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../lib/api';
import './client-companion.css';

const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('it-IT',
      { day: '2-digit', month: 'short' });
  } catch { return ''; }
};

// ── Section helper ───────────────────────────────────────────────
const Section = ({ id, eyebrow, title, count, children, testid }) => (
  <section
    id={id}
    className="cj-section"
    data-testid={testid}
  >
    <div className="cj-section__head">
      <div>
        <p className="cj-section__eyebrow">{eyebrow}</p>
        <h2 className="cj-section__title"><em>{title}</em></h2>
      </div>
      {count != null && (
        <span className="cj-section__count">{count}</span>
      )}
    </div>
    {children}
  </section>
);

const EmptyHint = ({ title, lede, testid }) => (
  <div className="cj-empty" data-testid={testid}>
    <p className="cj-empty__title">{title}</p>
    <p className="cj-empty__lede">{lede}</p>
  </div>
);

// ── Hero ─────────────────────────────────────────────────────────
const CompanionHero = ({ header, activeChapter }) => {
  const cover = header.cover_url;
  return (
    <section className="cj-hero" data-testid="cj-hero">
      {cover && (
        <div className="cj-hero__cover" style={{ backgroundImage: `url(${cover})` }} aria-hidden="true" />
      )}
      <div className="cj-hero__veil" aria-hidden="true" />
      <div className="cj-hero__noise" aria-hidden="true" />
      <div className="cj-hero__body">
        <p className="cj-hero__eyebrow">
          {header.studio_name} · {header.lifecycle_label}
        </p>
        <h1 className="cj-hero__title" data-testid="cj-hero-title">
          <em>{header.project_title}</em>
        </h1>
        {activeChapter && (
          <p className="cj-hero__lede">
            Capitolo attivo · <em>{activeChapter.title}</em>.
            {activeChapter.narrative_intro && (
              <> {activeChapter.narrative_intro}</>
            )}
          </p>
        )}
        <div className="cj-hero__meta">
          {header.location && (
            <span className="cj-hero__meta-item">
              <span className="cj-hero__meta-dot" />{header.location}
            </span>
          )}
          {header.project_type && (
            <span className="cj-hero__meta-item">
              <span className="cj-hero__meta-dot" />{header.project_type}
            </span>
          )}
          {header.progress && header.progress.total_chapters > 0 && (
            <span className="cj-hero__meta-item">
              <span className="cj-hero__meta-dot" />
              {header.progress.approved_chapters} di {header.progress.total_chapters} capitoli approvati
            </span>
          )}
        </div>
        {activeChapter && (
          <a
            href="#capitolo"
            className="cj-hero__cta"
            data-testid="cj-hero-cta"
          >
            Esplora il capitolo
          </a>
        )}
      </div>
    </section>
  );
};

// ── Active Chapter ───────────────────────────────────────────────
const ActiveChapterSection = ({ chapter }) => {
  if (!chapter) {
    return (
      <Section
        id="capitolo"
        eyebrow="Capitolo attivo · Active Chapter™"
        title="In attesa del prossimo capitolo"
        testid="cj-section-capitolo"
      >
        <EmptyHint
          testid="cj-active-empty"
          title="Il prossimo capitolo verrà condiviso dal tuo studio"
          lede="Quando il tuo studio inizierà la prossima direzione progettuale, comparirà qui — narrata e in attesa del tuo sguardo."
        />
      </Section>
    );
  }
  return (
    <Section
      id="capitolo"
      eyebrow="Capitolo attivo · Active Chapter™"
      title={chapter.title}
      testid="cj-section-capitolo"
    >
      <p style={{
        fontFamily: "'Playfair Display', serif",
        fontStyle: 'italic',
        fontSize: 18, lineHeight: 1.6,
        color: 'color-mix(in srgb, var(--cp-text-primary) 75%, transparent)',
        maxWidth: '64ch',
      }} data-testid="cj-active-narrative">
        {chapter.narrative_intro}
      </p>
      <p style={{
        marginTop: 18,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 10.5,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: 'var(--cp-gold, #d9b285)',
      }}>
        {chapter.status_label}
      </p>
    </Section>
  );
};

// ── Shared Directions ────────────────────────────────────────────
const SharedDirectionsSection = ({ items }) => (
  <Section
    id="direzioni"
    eyebrow="Direzioni condivise · Shared Directions™"
    title="Le proposte aperte tra te e lo studio"
    count={items?.length ? `${items.length} ${items.length === 1 ? 'direzione' : 'direzioni'}` : null}
    testid="cj-section-direzioni"
  >
    {(!items || items.length === 0) ? (
      <EmptyHint
        testid="cj-directions-empty"
        title="Nessuna direzione condivisa al momento"
        lede="Quando il tuo studio aprirà una nuova direzione (moodboard, palette, atmosfera), la troverai qui."
      />
    ) : (
      <div className="cj-directions" data-testid="cj-directions-grid">
        {items.map((d) => (
          <div
            key={d.id}
            className="cj-direction"
            data-testid={`cj-direction-${d.id}`}
          >
            <div
              className="cj-direction__cover"
              style={d.cover_url ? { backgroundImage: `url(${d.cover_url})` } : {}}
            />
            <div className="cj-direction__body">
              <h4 className="cj-direction__title"><em>{d.title}</em></h4>
              <p className="cj-direction__state">{d.state_label}</p>
            </div>
          </div>
        ))}
      </div>
    )}
  </Section>
);

// ── Conversations ────────────────────────────────────────────────
const ConversationsSection = ({ items }) => (
  <Section
    id="conversazioni"
    eyebrow="Conversazioni · Conversations™"
    title="Le voci sul percorso"
    testid="cj-section-conversazioni"
  >
    {(!items || items.length === 0) ? (
      <EmptyHint
        testid="cj-conversations-empty"
        title="La conversazione attende"
        lede="Le voci curatoriali sui capitoli del tuo Journey compariranno qui — pensate per essere ascoltate, non gestite."
      />
    ) : (
      <div className="cj-voices" data-testid="cj-voices-list">
        {items.map((v) => (
          <article key={v.id} className="cj-voice" data-testid={`cj-voice-${v.id}`}>
            <span className="cj-voice__bar" aria-hidden="true" />
            <div>
              <p className="cj-voice__msg">"{v.message}"</p>
              <p className="cj-voice__meta">
                {v.author_name || 'Voce sul Journey'} · {v.chapter} · {fmtDate(v.created_at)}
              </p>
            </div>
          </article>
        ))}
      </div>
    )}
  </Section>
);

// ── Evolution Timeline ───────────────────────────────────────────
const EvolutionSection = ({ items }) => (
  <Section
    id="evoluzione"
    eyebrow="Evolution Timeline™"
    title="La storia del tuo Journey"
    testid="cj-section-evoluzione"
  >
    {(!items || items.length === 0) ? (
      <EmptyHint
        testid="cj-evolution-empty"
        title="Il tuo Journey è appena iniziato"
        lede="Ogni nuova direzione, riscontro e decisione lascerà qui una traccia — narrata, mai cronologica."
      />
    ) : (
      <ol className="cj-timeline" data-testid="cj-evolution-list">
        {items.map((e) => (
          <li key={e.id} className="cj-timeline__item" data-testid={`cj-evolution-${e.id}`}>
            <span className="cj-timeline__date">{fmtDate(e.created_at)}</span>
            <p className="cj-timeline__msg">{e.narrative}</p>
          </li>
        ))}
      </ol>
    )}
  </Section>
);

// ── Materials & Atmospheres ──────────────────────────────────────
const MaterialsSection = ({ items }) => (
  <Section
    id="materia"
    eyebrow="Materia & Atmosfere · Materials & Atmospheres™"
    title="La materia del progetto"
    count={items?.length ? `${items.length} ${items.length === 1 ? 'voce' : 'voci'}` : null}
    testid="cj-section-materia"
  >
    {(!items || items.length === 0) ? (
      <EmptyHint
        testid="cj-materials-empty"
        title="La palette tattile sta per prendere forma"
        lede="Quando il tuo studio inizierà a comporre la materia del Journey — pietre, legni, tessuti — la troverai qui."
      />
    ) : (
      <div className="cj-materials" data-testid="cj-materials-grid">
        {items.map((m) => (
          <div key={m.id} className="cj-material" data-testid={`cj-material-${m.id}`}>
            <div
              className="cj-material__cover"
              style={m.image_url ? { backgroundImage: `url(${m.image_url})` } : {}}
            />
            <div className="cj-material__body">
              <h5 className="cj-material__title"><em>{m.title}</em></h5>
              {m.category && (
                <p className="cj-material__cat">{m.category}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
  </Section>
);

// ── Memory & Archive ─────────────────────────────────────────────
const MemoryArchiveSection = ({ items }) => (
  <Section
    id="memoria"
    eyebrow="Memoria & Archivio · Memory & Archive™"
    title="I capitoli che hai attraversato"
    count={items?.length ? `${items.length} ${items.length === 1 ? 'capitolo' : 'capitoli'}` : null}
    testid="cj-section-memoria"
  >
    {(!items || items.length === 0) ? (
      <EmptyHint
        testid="cj-archive-empty"
        title="L'archivio del Journey è ancora vuoto"
        lede="Ogni capitolo approvato entrerà qui — diventerà parte della memoria firmata del tuo percorso."
      />
    ) : (
      <ul className="cj-archive" data-testid="cj-archive-list">
        {items.map((m) => (
          <li key={m.id} className="cj-archive__item" data-testid={`cj-archive-${m.id}`}>
            <span className="cj-archive__chapter"><em>{m.title}</em></span>
            <span className="cj-archive__date">
              {m.approved_at ? `Approvato · ${fmtDate(m.approved_at)}`
                             : m.closed_at ? `Chiuso · ${fmtDate(m.closed_at)}` : '—'}
            </span>
          </li>
        ))}
      </ul>
    )}
  </Section>
);

// ── Main ─────────────────────────────────────────────────────────
const ClientCompanionPage = () => {
  const { journeyId } = useParams();
  const [data, setData]     = useState(null);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    let alive = true;
    setLoad(true);
    api.get(`/api/client/journeys/${journeyId}/companion`)
      .then((r) => { if (alive) setData(r.data); })
      .catch((e) => {
        if (!alive) return;
        setError(e?.response?.data?.detail || 'Non riesco ad aprire questo Journey.');
      })
      .finally(() => { if (alive) setLoad(false); });
    return () => { alive = false; };
  }, [journeyId]);

  // Hash anchor smooth scroll on load
  useEffect(() => {
    if (loading) return;
    const h = window.location.hash;
    if (h && h.length > 1) {
      requestAnimationFrame(() => {
        const el = document.querySelector(h);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="cj-shell"
           style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}
           data-testid="cj-loading">
        <p style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: 'italic', fontSize: 17,
          color: 'color-mix(in srgb, var(--cp-text-primary) 55%, transparent)',
        }}>
          Stiamo aprendo il tuo Journey…
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="cj-shell"
           style={{ padding: '96px 56px', textAlign: 'center' }}
           data-testid="cj-error">
        <h3 style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: 'italic', fontSize: 26, margin: 0,
          color: 'var(--cp-text-primary, #efe8d8)',
        }}>
          Questo Journey è in attesa
        </h3>
        <p style={{
          fontSize: 14,
          color: 'color-mix(in srgb, var(--cp-text-primary) 55%, transparent)',
          marginTop: 14,
        }}>
          {error || 'Non disponibile.'}
        </p>
      </div>
    );
  }

  const {
    header, active_chapter, shared_directions, evolution_timeline,
    materials_atmospheres, memory_archive, conversations,
  } = data;

  return (
    <div className="cj-shell" data-testid="client-companion-page">
      <CompanionHero header={header} activeChapter={active_chapter} />
      <ActiveChapterSection chapter={active_chapter} />
      <SharedDirectionsSection items={shared_directions} />
      <ConversationsSection items={conversations} />
      <EvolutionSection items={evolution_timeline} />
      <MaterialsSection items={materials_atmospheres} />
      <MemoryArchiveSection items={memory_archive} />
    </div>
  );
};

export default ClientCompanionPage;
