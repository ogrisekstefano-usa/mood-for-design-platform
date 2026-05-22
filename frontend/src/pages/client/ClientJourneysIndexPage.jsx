/**
 * ClientJourneysIndexPage — My Design Journeys™ (Sprint G.7).
 * I18N: Sprint I18N-02 — every visible string driven by Blueprint t().
 *
 * Il primo schermo del Client Portal. NON è un dashboard, è la
 * raccolta dei propri percorsi progettuali.
 *
 * Quando esiste UN solo Journey vivo, lo apriamo direttamente (deep entry).
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useT as useBlueprintT, useBlueprint } from '../../contexts/BlueprintContext';
import { tm } from '../../i18n/translation-memory';
import './client-companion.css';

const fmtDate = (iso, locale) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(locale || 'it-IT',
      { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return ''; }
};

const interp = (s, vars) => {
  if (!s) return s;
  return Object.entries(vars || {}).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)), s);
};

const JourneyCard = ({ j, isArchived = false, t, locale }) => {
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
              {interp(t('companion.card.deposited_at', null, 'Memoria depositata · {date}'),
                      { date: fmtDate(j.closed_at, locale) })}
            </p>
          )
        ) : (
          <>
            {chapter && (
              <p className="cj-jcard__chapter">
                {t('companion.card.chapter_active', null, 'Active chapter')} · <em>{chapter}</em>
              </p>
            )}
            {j.progress && j.progress.total_chapters > 0 && (
              <p className="cj-jcard__chapter" style={{ opacity: 0.65 }}>
                {interp(t('companion.card.progress', null, '{done} of {total} chapters approved'),
                        { done: j.progress.approved_chapters, total: j.progress.total_chapters })}
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
  const t = useBlueprintT();
  const { locale } = useBlueprint();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const fetchOnce = () => api.get('/api/client/journeys').then((r) => r.data);

    (async () => {
      try {
        let d = await fetchOnce();
        if (alive && d?.zero_data) {
          await new Promise((r) => setTimeout(r, 700));
          if (!alive) return;
          try { d = await fetchOnce(); } catch { /* keep first response */ }
        }
        if (!alive) return;
        const activeOnly = (d.journeys || []).filter((j) => !j.is_archived);
        if (!d.zero_data && activeOnly.length === 1 && (d.journeys || []).length === 1) {
          navigate(`/client/journey/${activeOnly[0].journey_id}`, { replace: true });
          return;
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
          fontFamily: "var(--mood-font-serif, 'Playfair Display', serif)",
          fontStyle: 'italic', fontSize: 17,
          color: 'color-mix(in srgb, var(--cp-text-primary) 55%, transparent)',
        }}>
          {t('companion.loading', null, 'Stiamo aprendo il tuo Journey…')}
        </p>
      </div>
    );
  }

  if (!data || data.zero_data || !data.journeys?.length) {
    return (
      <div className="cj-shell" data-testid="client-journeys-empty">
        <div className="cj-welcome">
          <p className="cj-hero__eyebrow">{t('companion.hero.eyebrow', null, `${tm('designJourney')} · Companion`)}</p>
          <h1 className="cj-welcome__title">
            {t('companion.index.zero.title', null, 'Il tuo Design Journey™ sta per iniziare')}
          </h1>
          <p className="cj-welcome__lede">
            {t('companion.index.zero.lede', null,
               'Lo studio sta preparando il primo capitolo del vostro percorso.')}
          </p>
        </div>
      </div>
    );
  }

  const active = (data.journeys || []).filter((j) => !j.is_archived);
  const archived = (data.journeys || []).filter((j) => j.is_archived);
  const countLabel = (n) => interp(
    t(n === 1 ? 'companion.index.count.one' : 'companion.index.count.many',
      null, n === 1 ? '{n} percorso' : '{n} percorsi'), { n });

  return (
    <div className="cj-shell" data-testid="client-journeys-page">
      {/* Hero editoriale */}
      <section className="cj-hero" data-testid="client-journeys-hero">
        <div className="cj-hero__veil" aria-hidden="true" />
        <div className="cj-hero__noise" aria-hidden="true" />
        <div className="cj-hero__body">
          <p className="cj-hero__eyebrow">{t('companion.index.hero.eyebrow', null, 'My Design Journeys™')}</p>
          <h1 className="cj-hero__title">
            <em>{t('companion.index.hero.title', null, 'Your design journeys')}</em>
          </h1>
          <p className="cj-hero__lede">
            {t('companion.index.hero.lede', null,
               'Ogni Journey racconta una conversazione viva tra te e il tuo studio. Apri quello che vuoi attraversare oggi.')}
          </p>
        </div>
      </section>

      {/* Journey in corso */}
      {active.length > 0 && (
        <section className="cj-section" data-testid="client-journeys-grid-section">
          <div className="cj-section__head">
            <div>
              <p className="cj-section__eyebrow">{t('companion.index.active.eyebrow', null, 'In corso')}</p>
              <h2 className="cj-section__title">
                <em>{t('companion.index.active.title', null, 'I percorsi che stai attraversando')}</em>
              </h2>
            </div>
            <span className="cj-section__count">{countLabel(active.length)}</span>
          </div>
          <div className="cj-grid" data-testid="client-journeys-grid">
            {active.map((j) => <JourneyCard key={j.journey_id} j={j} t={t} locale={locale} />)}
          </div>
        </section>
      )}

      {/* Memoria della casa — archivio sobrio */}
      {archived.length > 0 && (
        <section className="cj-section cj-section--archive"
                 data-testid="client-journeys-archive-section">
          <div className="cj-section__head">
            <div>
              <p className="cj-section__eyebrow">{t('companion.index.archive.eyebrow', null, tm('journeyArchive'))}</p>
              <h2 className="cj-section__title">
                <em>{t('companion.index.archive.title', null, 'La memoria della casa')}</em>
              </h2>
            </div>
            <span className="cj-section__count">{countLabel(archived.length)}</span>
          </div>
          <p className="cj-archive-lede">
            {t('companion.index.archive.lede', null,
               'I percorsi che appartengono ora alla memoria progettuale della casa.')}
          </p>
          <div className="cj-grid" data-testid="client-journeys-archive-grid">
            {archived.map((j) => <JourneyCard key={j.journey_id} j={j} isArchived t={t} locale={locale} />)}
          </div>
        </section>
      )}
    </div>
  );
};

export default ClientJourneysIndexPage;
