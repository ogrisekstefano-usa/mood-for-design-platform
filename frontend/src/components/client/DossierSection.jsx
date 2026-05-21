/**
 * DossierSection — Sprint G.9 · Certified Closure™ / Journey Archive™.
 * I18N: Sprint I18N-02 — every string is now driven by Blueprint t().
 *
 * È un archivio editoriale vivo del percorso progettuale — NON success
 * screen, NON portfolio showcase, NON completion wizard.
 *
 * Tono: AD monograph · documentazione architettonica · timeless.
 * Voci preservate sono READ-ONLY. NO textarea. NO CTA conversazione.
 */
import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useT as useBlueprintT } from '../../contexts/BlueprintContext';
import { tm } from '../../i18n/translation-memory';
import './dossier.css';

const fmtMonthYear = (iso, locale) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(locale || 'it-IT',
      { month: 'long', year: 'numeric' });
  } catch { return ''; }
};

const fmtYear = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).getFullYear(); } catch { return ''; }
};

const interp = (s, vars) => {
  if (!s) return s;
  return Object.entries(vars || {}).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)), s);
};

// ── Hero del Dossier ─────────────────────────────────────────────
const DossierHero = ({ header, t, locale }) => {
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
        <p className="dossier-hero__eyebrow">{tm('journeyArchive')}</p>
        <h1 className="dossier-hero__title" data-testid="dossier-hero-title">
          <em>{header.final_title}</em>
        </h1>
        <p className="dossier-hero__meta">
          {[header.location, yearSpan].filter(Boolean).join(' · ')}
        </p>
        <p className="dossier-hero__studio">
          {t('dossier.studio_prefix', null, 'Studio')} · <em>{header.studio_name}</em>
        </p>
      </div>
    </header>
  );
};

// ── Closure Statement ────────────────────────────────────────────
const StatementBlock = ({ statement, t }) => {
  if (!statement) return null;
  return (
    <section className="dossier-statement" data-testid="dossier-statement">
      <p className="dossier-eyebrow">{t('dossier.statement.eyebrow', null, 'Statement di progetto')}</p>
      <blockquote className="dossier-statement__quote">
        {statement}
      </blockquote>
    </section>
  );
};

// ── Durata narrativa ─────────────────────────────────────────────
const DurationBlock = ({ header, t, locale }) => {
  if (!header.duration_months && !header.started_at) return null;
  const m = header.duration_months;
  const monthsLabel = m
    ? interp(t(m === 1 ? 'dossier.duration.months.one' : 'dossier.duration.months.many',
              null, m === 1 ? '{n} mese' : '{n} mesi'), { n: m })
    : null;
  return (
    <section className="dossier-duration" data-testid="dossier-duration">
      <div className="dossier-duration__col">
        <p className="dossier-eyebrow">{t('dossier.duration.start', null, 'Inizio del percorso')}</p>
        <p className="dossier-duration__val">{fmtMonthYear(header.started_at, locale)}</p>
      </div>
      <div className="dossier-duration__col">
        <p className="dossier-eyebrow">{t('dossier.duration.end', null, 'Memoria depositata')}</p>
        <p className="dossier-duration__val">{fmtMonthYear(header.closed_at, locale)}</p>
      </div>
      {m && (
        <div className="dossier-duration__col">
          <p className="dossier-eyebrow">{t('dossier.duration.span', null, 'Durata del percorso')}</p>
          <p className="dossier-duration__val">{monthsLabel}</p>
        </div>
      )}
    </section>
  );
};

// ── Capitoli del percorso ────────────────────────────────────────
const ChaptersBlock = ({ chapters, t }) => {
  if (!chapters?.length) return null;
  const stateLabel = (status) => {
    switch (status) {
      case 'approved':           return t('dossier.chapter.approved', null, 'Capitolo approvato');
      case 'closed':             return t('dossier.chapter.closed', null, 'Capitolo chiuso');
      case 'presented':          return t('dossier.chapter.presented', null, 'Capitolo condiviso');
      case 'in_progress':        return t('dossier.chapter.in_progress', null, 'Capitolo in lavorazione');
      case 'revision_requested': return t('dossier.chapter.revision_requested', null, 'Capitolo rivisitato');
      default:                   return t('dossier.chapter.default', null, 'Capitolo');
    }
  };
  return (
    <section className="dossier-chapters" data-testid="dossier-chapters">
      <p className="dossier-eyebrow">{t('dossier.chapters.eyebrow', null, 'I capitoli attraversati')}</p>
      <h3 className="dossier-h3"><em>{t('dossier.chapters.title', null, 'La sequenza del percorso')}</em></h3>
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
              <p className="dossier-chapters__state">{stateLabel(ch.status)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};

// ── Before / After ──────────────────────────────────────────────
const BeforeAfter = ({ pair, t }) => {
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
        <img src={pair.after_url} alt={t('dossier.transformations.after', null, 'Stato finale')} className="dossier-baf__img dossier-baf__after" />
        <div className="dossier-baf__before-clip" style={{ width: `${pos}%` }}>
          <img src={pair.before_url} alt={t('dossier.transformations.before', null, 'Prima')} className="dossier-baf__img dossier-baf__before" />
        </div>
        <span className="dossier-baf__handle"
              style={{ left: `${pos}%` }}
              data-testid={`dossier-baf-handle-${pair.id}`}
              aria-hidden="true" />
        <span className="dossier-baf__lbl dossier-baf__lbl--l">{t('dossier.transformations.before', null, 'Prima')}</span>
        <span className="dossier-baf__lbl dossier-baf__lbl--r">{t('dossier.transformations.after', null, 'Stato finale')}</span>
      </div>
      <figcaption className="dossier-baf__cap">{pair.title}</figcaption>
    </figure>
  );
};

const TransformationsBlock = ({ pairs, t }) => {
  if (!pairs?.length) return null;
  return (
    <section className="dossier-transforms" data-testid="dossier-transforms">
      <p className="dossier-eyebrow">{t('dossier.transformations.eyebrow', null, 'Trasformazioni dello spazio')}</p>
      <h3 className="dossier-h3"><em>{t('dossier.transformations.title', null, 'Documentazione architettonica')}</em></h3>
      <div className="dossier-transforms__grid">
        {pairs.slice(0, 3).map((p) => <BeforeAfter key={p.id} pair={p} t={t} />)}
      </div>
    </section>
  );
};

// ── Key Visuals ──────────────────────────────────────────────────
const KeyVisualsBlock = ({ items, t }) => {
  if (!items?.length) return null;
  return (
    <section className="dossier-visuals" data-testid="dossier-visuals">
      <p className="dossier-eyebrow">{t('dossier.visuals.eyebrow', null, 'Direzioni condivise')}</p>
      <h3 className="dossier-h3"><em>{t('dossier.visuals.title', null, 'Le composizioni del percorso')}</em></h3>
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
const MaterialsBlock = ({ items, t }) => {
  if (!items?.length) return null;
  return (
    <section className="dossier-materials" data-testid="dossier-materials">
      <p className="dossier-eyebrow">{t('dossier.materials.eyebrow', null, 'Palette materica')}</p>
      <h3 className="dossier-h3"><em>{t('dossier.materials.title', null, 'La materia del progetto')}</em></h3>
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

// ── Pensieri preservati — read-only ─────────────────────────────
const PreservedVoicesBlock = ({ voices, t }) => {
  if (!voices?.length) return null;
  return (
    <section className="dossier-voices" data-testid="dossier-voices">
      <p className="dossier-eyebrow">{t('dossier.voices.eyebrow', null, 'Pensieri lungo il percorso')}</p>
      <h3 className="dossier-h3"><em>{t('dossier.voices.title', null, 'Le voci sedimentate')}</em></h3>
      <ul className="dossier-voices__list">
        {voices.slice(0, 8).map((v) => (
          <li key={v.id} className="dossier-voice"
              data-testid={`dossier-voice-${v.id}`}>
            <p className="dossier-voice__msg">"{v.message}"</p>
            <p className="dossier-voice__meta">
              {v.author_name || t('dossier.voices.author_default', null, 'Voce sul Journey')} · {v.chapter}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
};

// ── Site Moments ────────────────────────────────────────────────
const SiteMomentsBlock = ({ moments, t }) => {
  if (!moments?.length) return null;
  return (
    <section className="dossier-moments" data-testid="dossier-moments">
      <p className="dossier-eyebrow">{t('dossier.moments.eyebrow', null, 'Tracce del cantiere')}</p>
      <h3 className="dossier-h3"><em>{t('dossier.moments.title', null, 'Momenti intermedi del percorso')}</em></h3>
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
const ClosureMarker = ({ certified_at, t, locale }) => (
  <footer className="dossier-closure" data-testid="dossier-closure-marker">
    <span className="dossier-closure__rule" aria-hidden="true" />
    <p className="dossier-closure__line">
      {interp(t('dossier.closure.line', null, 'Memoria depositata · {date}'),
              { date: fmtMonthYear(certified_at, locale) })}
    </p>
  </footer>
);

// ── Main ─────────────────────────────────────────────────────────
const DossierSection = ({ journeyId, conversations }) => {
  const t = useBlueprintT();
  // We pass the active Blueprint locale through to date formatters.
  // It's exposed via the global <html lang> attribute set in I18N-01.
  const locale = (typeof document !== 'undefined'
    ? document.documentElement.getAttribute('lang') : null) || 'it';
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
        <p>{t('dossier.loading', null, 'Stiamo aprendo il dossier…')}</p>
      </div>
    );
  }
  if (error || !dossier?.available) {
    return (
      <div className="dossier-empty" data-testid="dossier-empty">
        <p className="dossier-eyebrow">{t('dossier.empty.eyebrow', null, 'Memoria del percorso')}</p>
        <p className="dossier-empty__msg">
          {t('dossier.empty.message', null,
             'Il dossier di questo Journey verrà depositato a breve.')}
        </p>
      </div>
    );
  }

  return (
    <article className="dossier-shell" data-testid="dossier-shell">
      <DossierHero header={dossier.header} t={t} locale={locale} />
      <StatementBlock statement={dossier.statement} t={t} />
      <DurationBlock header={dossier.header} t={t} locale={locale} />
      <ChaptersBlock chapters={dossier.key_chapters} t={t} />
      <TransformationsBlock pairs={dossier.before_after_pairs} t={t} />
      <KeyVisualsBlock items={dossier.key_visuals} t={t} />
      <SiteMomentsBlock moments={dossier.site_moments} t={t} />
      <MaterialsBlock items={dossier.iconic_materials} t={t} />
      <PreservedVoicesBlock voices={conversations} t={t} />
      <ClosureMarker certified_at={dossier.certified_at || dossier.header.closed_at}
                     t={t} locale={locale} />
    </article>
  );
};

export default DossierSection;
