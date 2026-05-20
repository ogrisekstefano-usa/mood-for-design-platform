/**
 * DossierSection — Sprint G.9 · Certified Closure™.
 *
 * Quando un Design Journey™ entra nella memoria della casa, smette
 * di essere superficie operativa e diventa **dossier editoriale**.
 *
 * NON è:
 *   · una success screen
 *   · una case study marketing
 *   · una portfolio page
 *   · un completion wizard
 *   · una luxury celebration
 *
 * È:
 *   · documentazione architettonica sobria
 *   · archivio vivo del percorso
 *   · memoria sedimentata, leggibile, atemporale
 *
 * Lingua: italiano editoriale. Tono: AD monograph.
 */
import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import './dossier.css';

const fmtMonthYear = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  } catch { return ''; }
};

const fmtYear = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).getFullYear(); } catch { return ''; }
};

// ── Hero del Dossier ─────────────────────────────────────────────
const DossierHero = ({ header }) => {
  const yearSpan = (() => {
    const a = fmtYear(header.started_at), b = fmtYear(header.closed_at);
    if (!a && !b) return '';
    if (a && b && a !== b) return `${a}–${b}`;
    return String(b || a);
  })();
  return (
    <header className="dossier-hero" data-testid="dossier-hero">
      {header.cover_url && (
        <div className="dossier-hero__cover"
             style={{ backgroundImage: `url(${header.cover_url})` }}
             aria-hidden="true" />
      )}
      <div className="dossier-hero__veil" aria-hidden="true" />
      <div className="dossier-hero__body">
        <p className="dossier-hero__eyebrow">Journey Archive</p>
        <h1 className="dossier-hero__title" data-testid="dossier-hero-title">
          <em>{header.final_title}</em>
        </h1>
        <p className="dossier-hero__meta">
          {[header.location, yearSpan].filter(Boolean).join(' · ')}
        </p>
        <p className="dossier-hero__studio">
          Studio · <em>{header.studio_name}</em>
        </p>
      </div>
    </header>
  );
};

// ── Closure Statement ────────────────────────────────────────────
const StatementBlock = ({ statement }) => {
  if (!statement) return null;
  return (
    <section className="dossier-statement" data-testid="dossier-statement">
      <p className="dossier-eyebrow">Statement di progetto</p>
      <blockquote className="dossier-statement__quote">
        {statement}
      </blockquote>
    </section>
  );
};

// ── Durata narrativa ─────────────────────────────────────────────
const DurationBlock = ({ header }) => {
  if (!header.duration_months && !header.started_at) return null;
  return (
    <section className="dossier-duration" data-testid="dossier-duration">
      <div className="dossier-duration__col">
        <p className="dossier-eyebrow">Inizio del percorso</p>
        <p className="dossier-duration__val">{fmtMonthYear(header.started_at)}</p>
      </div>
      <div className="dossier-duration__col">
        <p className="dossier-eyebrow">Memoria depositata</p>
        <p className="dossier-duration__val">{fmtMonthYear(header.closed_at)}</p>
      </div>
      {header.duration_months && (
        <div className="dossier-duration__col">
          <p className="dossier-eyebrow">Durata del percorso</p>
          <p className="dossier-duration__val">
            {header.duration_months} {header.duration_months === 1 ? 'mese' : 'mesi'}
          </p>
        </div>
      )}
    </section>
  );
};

// ── Capitoli del percorso ────────────────────────────────────────
const CHAPTER_STATE = {
  approved:           'Capitolo approvato',
  closed:             'Capitolo chiuso',
  presented:          'Capitolo condiviso',
  in_progress:        'Capitolo in lavorazione',
  revision_requested: 'Capitolo rivisitato',
};

const ChaptersBlock = ({ chapters }) => {
  if (!chapters?.length) return null;
  return (
    <section className="dossier-chapters" data-testid="dossier-chapters">
      <p className="dossier-eyebrow">I capitoli attraversati</p>
      <h3 className="dossier-h3"><em>La sequenza del percorso</em></h3>
      <ol className="dossier-chapters__list">
        {chapters.map((ch, i) => (
          <li key={ch.id}
              className="dossier-chapters__item"
              data-testid={`dossier-chapter-${ch.id}`}>
            <span className="dossier-chapters__num">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <p className="dossier-chapters__title"><em>{ch.title}</em></p>
              <p className="dossier-chapters__state">
                {CHAPTER_STATE[ch.status] || 'Capitolo'}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};

// ── Before / After — usato solo per momenti realmente trasformativi ──
const BeforeAfter = ({ pair }) => {
  const [pos, setPos] = useState(50);
  const onMove = (clientX, rect) => {
    const p = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPos(p);
  };
  return (
    <figure className="dossier-baf" data-testid={`dossier-baf-${pair.id}`}>
      <div className="dossier-baf__frame"
           onMouseMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
           onTouchMove={(e) => onMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}>
        <img src={pair.after_url} alt="Stato finale" className="dossier-baf__img dossier-baf__after" />
        <div className="dossier-baf__before-clip" style={{ width: `${pos}%` }}>
          <img src={pair.before_url} alt="Stato preesistente" className="dossier-baf__img dossier-baf__before" />
        </div>
        <span className="dossier-baf__handle"
              style={{ left: `${pos}%` }}
              data-testid={`dossier-baf-handle-${pair.id}`}
              aria-hidden="true" />
        <span className="dossier-baf__lbl dossier-baf__lbl--l">Prima</span>
        <span className="dossier-baf__lbl dossier-baf__lbl--r">Stato finale</span>
      </div>
      <figcaption className="dossier-baf__cap">
        {pair.title}
      </figcaption>
    </figure>
  );
};

const TransformationsBlock = ({ pairs }) => {
  if (!pairs?.length) return null;
  return (
    <section className="dossier-transforms" data-testid="dossier-transforms">
      <p className="dossier-eyebrow">Trasformazioni dello spazio</p>
      <h3 className="dossier-h3"><em>Documentazione architettonica</em></h3>
      <div className="dossier-transforms__grid">
        {pairs.slice(0, 3).map((p) => <BeforeAfter key={p.id} pair={p} />)}
      </div>
    </section>
  );
};

// ── Key Visuals — direzioni condivise, non solo immagini finali ──
const KeyVisualsBlock = ({ items }) => {
  if (!items?.length) return null;
  return (
    <section className="dossier-visuals" data-testid="dossier-visuals">
      <p className="dossier-eyebrow">Direzioni condivise</p>
      <h3 className="dossier-h3"><em>Le composizioni del percorso</em></h3>
      <div className="dossier-visuals__grid">
        {items.slice(0, 6).map((v) => (
          <figure key={v.id} className="dossier-visual"
                  data-testid={`dossier-visual-${v.id}`}>
            <div className="dossier-visual__cover"
                 style={{ backgroundImage: `url(${v.cover_url})` }}
                 aria-hidden="true" />
            <figcaption className="dossier-visual__cap"><em>{v.title}</em></figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
};

// ── Materia iconica ─────────────────────────────────────────────
const MaterialsBlock = ({ items }) => {
  if (!items?.length) return null;
  return (
    <section className="dossier-materials" data-testid="dossier-materials">
      <p className="dossier-eyebrow">Palette materica</p>
      <h3 className="dossier-h3"><em>La materia del progetto</em></h3>
      <ul className="dossier-materials__list">
        {items.slice(0, 8).map((m) => (
          <li key={m.id || m.title} className="dossier-material"
              data-testid={`dossier-material-${m.id || m.title}`}>
            {m.image_url && (
              <div className="dossier-material__cover"
                   style={{ backgroundImage: `url(${m.image_url})` }}
                   aria-hidden="true" />
            )}
            <div>
              <p className="dossier-material__name"><em>{m.title}</em></p>
              {m.category && (
                <p className="dossier-material__cat">{m.category}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

// ── Pensieri preservati — read-only, no interaction ──────────────
const PreservedVoicesBlock = ({ voices }) => {
  if (!voices?.length) return null;
  return (
    <section className="dossier-voices" data-testid="dossier-voices">
      <p className="dossier-eyebrow">Pensieri lungo il percorso</p>
      <h3 className="dossier-h3"><em>Le voci sedimentate</em></h3>
      <ul className="dossier-voices__list">
        {voices.slice(0, 8).map((v) => (
          <li key={v.id} className="dossier-voice"
              data-testid={`dossier-voice-${v.id}`}>
            <p className="dossier-voice__msg">"{v.message}"</p>
            <p className="dossier-voice__meta">
              {v.author_name || 'Voce sul Journey'} · {v.chapter}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
};

// ── Site Moments — momenti intermedi del cantiere ───────────────
const SiteMomentsBlock = ({ moments }) => {
  if (!moments?.length) return null;
  return (
    <section className="dossier-moments" data-testid="dossier-moments">
      <p className="dossier-eyebrow">Tracce del cantiere</p>
      <h3 className="dossier-h3"><em>Momenti intermedi del percorso</em></h3>
      <div className="dossier-moments__grid">
        {moments.slice(0, 4).map((m) => (
          <figure key={m.id} className="dossier-moment"
                  data-testid={`dossier-moment-${m.id}`}>
            <div className="dossier-moment__cover"
                 style={{ backgroundImage: `url(${m.photo_url})` }}
                 aria-hidden="true" />
            <figcaption className="dossier-moment__cap">{m.title}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
};

// ── Closure marker ───────────────────────────────────────────────
const ClosureMarker = ({ certified_at }) => (
  <footer className="dossier-closure" data-testid="dossier-closure-marker">
    <span className="dossier-closure__rule" aria-hidden="true" />
    <p className="dossier-closure__line">
      Memoria depositata · {fmtMonthYear(certified_at)}
    </p>
  </footer>
);

// ── Main ─────────────────────────────────────────────────────────
const DossierSection = ({ journeyId, conversations }) => {
  const [dossier, setDossier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get(`/api/client/journeys/${journeyId}/dossier`)
      .then((r) => { if (alive) { setDossier(r.data); setLoading(false); } })
      .catch((e) => {
        if (alive) {
          setError(e?.response?.data?.detail || 'Dossier non disponibile.');
          setLoading(false);
        }
      });
    return () => { alive = false; };
  }, [journeyId]);

  if (loading) {
    return (
      <div className="dossier-loading" data-testid="dossier-loading">
        <p>Stiamo aprendo il dossier…</p>
      </div>
    );
  }
  if (error || !dossier?.available) {
    return (
      <div className="dossier-empty" data-testid="dossier-empty">
        <p className="dossier-eyebrow">Memoria del percorso</p>
        <p className="dossier-empty__msg">
          Il dossier di questo Journey verrà depositato a breve.
        </p>
      </div>
    );
  }

  return (
    <article className="dossier-shell" data-testid="dossier-shell">
      <DossierHero header={dossier.header} />
      <StatementBlock statement={dossier.statement} />
      <DurationBlock header={dossier.header} />
      <ChaptersBlock chapters={dossier.key_chapters} />
      <TransformationsBlock pairs={dossier.before_after_pairs} />
      <KeyVisualsBlock items={dossier.key_visuals} />
      <SiteMomentsBlock moments={dossier.site_moments} />
      <MaterialsBlock items={dossier.iconic_materials} />
      <PreservedVoicesBlock voices={conversations} />
      <ClosureMarker certified_at={dossier.certified_at || dossier.header.closed_at} />
    </article>
  );
};

export default DossierSection;
