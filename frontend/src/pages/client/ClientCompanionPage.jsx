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
import SharedVoiceComposer from '../../components/client/SharedVoiceComposer';
import SiteEvolutionSection from '../../components/client/SiteEvolutionSection';
import DossierSection from '../../components/client/DossierSection';
import { useT as useBlueprintT, useBlueprint } from '../../contexts/BlueprintContext';
import { tm } from '../../i18n/translation-memory';
import './client-companion.css';

const interp = (s, vars) => {
  if (!s) return s;
  return Object.entries(vars || {}).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)), s);
};

const fmtDate = (iso, locale) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(locale || 'it-IT',
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
  const t = useBlueprintT();
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
            {t('companion.card.chapter_active', null, 'Active chapter')} · <em>{activeChapter.title}</em>.
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
              {interp(t('companion.card.progress', null, '{done} of {total} chapters approved'),
                      { done: header.progress.approved_chapters, total: header.progress.total_chapters })}
            </span>
          )}
        </div>
        {activeChapter && (
          <a
            href="#capitolo"
            className="cj-hero__cta"
            data-testid="cj-hero-cta"
          >
            {t('companion.hero.cta', null, 'Explore the chapter')}
          </a>
        )}
      </div>
    </section>
  );
};

// ── Active Chapter ───────────────────────────────────────────────
const ActiveChapterSection = ({ chapter, journeyId, onVoiceShared }) => {
  const t = useBlueprintT();
  if (!chapter) {
    return (
      <Section
        id="capitolo"
        eyebrow={t('companion.section.active_chapter.eyebrow', null, 'Active chapter · Active Chapter™')}
        title={t('companion.section.active_chapter.empty_title', null, 'Awaiting the next chapter')}
        testid="cj-section-capitolo"
      >
        <EmptyHint
          testid="cj-active-empty"
          title={t('companion.section.active_chapter.empty_hint_title', null,
                   'Il prossimo capitolo verrà condiviso dal tuo studio')}
          lede={t('companion.section.active_chapter.empty_hint_lede', null,
                  'Quando il tuo studio inizierà la prossima direzione progettuale, comparirà qui — narrata e in attesa del tuo sguardo.')}
        />
      </Section>
    );
  }
  return (
    <Section
      id="capitolo"
      eyebrow={t('companion.section.active_chapter.eyebrow', null, 'Active chapter · Active Chapter™')}
      title={chapter.title}
      testid="cj-section-capitolo"
    >
      <p style={{
        fontFamily: "var(--mood-font-serif, 'Playfair Display', serif)",
        fontStyle: 'italic',
        fontSize: 18, lineHeight: 1.6,
        color: 'color-mix(in srgb, var(--cp-text-primary) 75%, transparent)',
        maxWidth: '64ch',
      }} data-testid="cj-active-narrative">
        {chapter.narrative_intro}
      </p>
      <p style={{
        marginTop: 18,
        fontFamily: "var(--mood-font-mono, 'JetBrains Mono', ui-monospace, monospace)",
        fontSize: 10.5,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: 'var(--cp-gold, #d9b285)',
      }}>
        {chapter.status_label}
      </p>

      {/* Sprint G.7-ter · Shared Voice™ — un gesto editoriale, NON un commento. */}
      <SharedVoiceComposer
        journeyId={journeyId}
        milestoneId={chapter.id}
        chapterTitle={chapter.title}
        onSubmitted={onVoiceShared}
      />
    </Section>
  );
};

// ── Shared Directions ────────────────────────────────────────────
const SharedDirectionsSection = ({ items }) => {
  const t = useBlueprintT();
  const count = items?.length
    ? interp(t(items.length === 1 ? 'companion.direction.count.one' : 'companion.direction.count.many',
               null, items.length === 1 ? '{n} direzione' : '{n} direzioni'), { n: items.length })
    : null;
  return (
  <Section
    id="direzioni"
    eyebrow={t('companion.section.shared_directions.eyebrow', null, 'Direzioni condivise · Shared Directions™')}
    title={t('companion.section.shared_directions.title', null, 'Le proposte aperte tra te e lo studio')}
    count={count}
    testid="cj-section-direzioni"
  >
    {(!items || items.length === 0) ? (
      <EmptyHint
        testid="cj-directions-empty"
        title={t('companion.section.shared_directions.empty_title', null,
                 'Nessuna direzione condivisa al momento')}
        lede={t('companion.section.shared_directions.empty_lede', null,
                'Quando il tuo studio aprirà una nuova direzione (moodboard, palette, atmosfera), la troverai qui.')}
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
};

// ── Conversations ────────────────────────────────────────────────
const ConversationsSection = ({ items }) => {
  const t = useBlueprintT();
  const { locale } = useBlueprint();
  return (
  <Section
    id="conversazioni"
    eyebrow={t('companion.section.conversations.eyebrow', null, 'Conversazioni · Conversations™')}
    title={t('companion.section.conversations.title', null, 'Le voci sul percorso')}
    testid="cj-section-conversazioni"
  >
    {(!items || items.length === 0) ? (
      <EmptyHint
        testid="cj-conversations-empty"
        title={t('companion.section.conversations.empty_title', null, 'La conversazione attende')}
        lede={t('companion.section.conversations.empty_lede', null,
                'Le voci curatoriali sui capitoli del tuo Journey compariranno qui — pensate per essere ascoltate, non gestite.')}
      />
    ) : (
      <div className="cj-voices" data-testid="cj-voices-list">
        {items.map((v) => (
          <article key={v.id} className="cj-voice" data-testid={`cj-voice-${v.id}`}>
            <span className="cj-voice__bar" aria-hidden="true" />
            <div>
              <p className="cj-voice__msg">"{v.message}"</p>
              <p className="cj-voice__meta">
                {v.author_name || t('dossier.voices.author_default', null, 'Voce sul Journey')} · {v.chapter} · {fmtDate(v.created_at, locale)}
              </p>
            </div>
          </article>
        ))}
      </div>
    )}
  </Section>
  );
};

// ── Evolution Timeline ───────────────────────────────────────────
const EvolutionSection = ({ items }) => {
  const t = useBlueprintT();
  const { locale } = useBlueprint();
  return (
  <Section
    id="evoluzione"
    eyebrow={t('companion.section.evolution.eyebrow', null, 'Evolution Timeline™')}
    title={t('companion.section.evolution.title', null, 'L\'evoluzione del viaggio')}
    testid="cj-section-evoluzione"
  >
    {(!items || items.length === 0) ? (
      <EmptyHint
        testid="cj-evolution-empty"
        title={t('companion.section.evolution.empty_title', null,
                 'Il tuo Design Journey™ sta per iniziare')}
        lede={t('companion.section.evolution.empty_lede', null,
                'Ogni nuova direzione, riscontro e decisione lascerà qui una traccia — narrata, mai cronologica.')}
      />
    ) : (
      <ol className="cj-timeline" data-testid="cj-evolution-list">
        {items.map((e) => (
          <li key={e.id} className="cj-timeline__item" data-testid={`cj-evolution-${e.id}`}>
            <span className="cj-timeline__date">{fmtDate(e.created_at, locale)}</span>
            <p className="cj-timeline__msg">{e.narrative}</p>
          </li>
        ))}
      </ol>
    )}
  </Section>
  );
};

// ── Materials & Atmospheres ──────────────────────────────────────
const MaterialsSection = ({ items }) => {
  const t = useBlueprintT();
  const count = items?.length
    ? interp(t(items.length === 1 ? 'companion.materials.count.one' : 'companion.materials.count.many',
               null, items.length === 1 ? '{n} voce' : '{n} voci'), { n: items.length })
    : null;
  return (
  <Section
    id="materia"
    eyebrow={t('companion.section.materials.eyebrow', null, 'Materia & Atmosfere · Materials & Atmospheres™')}
    title={t('companion.section.materials.title', null, 'La materia del progetto')}
    count={count}
    testid="cj-section-materia"
  >
    {(!items || items.length === 0) ? (
      <EmptyHint
        testid="cj-materials-empty"
        title={t('companion.section.materials.empty_title', null,
                 'La palette tattile sta per prendere forma')}
        lede={t('companion.section.materials.empty_lede', null,
                'Quando il tuo studio inizierà a comporre la materia del Journey — pietre, legni, tessuti — la troverai qui.')}
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
};

// ── Memory & Archive ─────────────────────────────────────────────
const MemoryArchiveSection = ({ items }) => {
  const t = useBlueprintT();
  const { locale } = useBlueprint();
  const count = items?.length
    ? interp(t(items.length === 1 ? 'companion.archive.count.one' : 'companion.archive.count.many',
               null, items.length === 1 ? '{n} capitolo' : '{n} capitoli'), { n: items.length })
    : null;
  return (
  <Section
    id="memoria"
    eyebrow={t('companion.section.archive.eyebrow', null, 'Memoria & Archivio · Memory & Archive™')}
    title={t('companion.section.archive.title', null, 'The chapters you’ve walked through')}
    count={count}
    testid="cj-section-memoria"
  >
    {(!items || items.length === 0) ? (
      <EmptyHint
        testid="cj-archive-empty"
        title={t('companion.section.archive.empty_title', null,
                 'L\'archivio del Journey è ancora vuoto')}
        lede={t('companion.section.archive.empty_lede', null,
                'Ogni capitolo approvato entrerà qui — diventerà parte della memoria firmata del tuo percorso.')}
      />
    ) : (
      <ul className="cj-archive" data-testid="cj-archive-list">
        {items.map((m) => (
          <li key={m.id} className="cj-archive__item" data-testid={`cj-archive-${m.id}`}>
            <span className="cj-archive__chapter"><em>{m.title}</em></span>
            <span className="cj-archive__date">
              {m.approved_at ? `${t('companion.archive.approved', null, 'Approvato')} · ${fmtDate(m.approved_at, locale)}`
                             : m.closed_at ? `${t('companion.archive.closed', null, 'Chiuso')} · ${fmtDate(m.closed_at, locale)}` : '—'}
            </span>
          </li>
        ))}
      </ul>
    )}
  </Section>
  );
};

// ── Main ─────────────────────────────────────────────────────────
const ClientCompanionPage = () => {
  const { journeyId } = useParams();
  const t = useBlueprintT();
  const [data, setData]     = useState(null);
  const [siteEvolution, setSiteEvolution] = useState(null);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    let alive = true;
    setLoad(true);
    Promise.all([
      api.get(`/api/client/journeys/${journeyId}/companion`),
      api.get(`/api/client/journeys/${journeyId}/site-evolution`)
        .catch(() => ({ data: { available: false, entries: [], groups: [] } })),
    ])
      .then(([r, s]) => {
        if (!alive) return;
        setData(r.data);
        setSiteEvolution(s.data);
      })
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
          fontFamily: "var(--mood-font-serif, 'Playfair Display', serif)",
          fontStyle: 'italic', fontSize: 17,
          color: 'color-mix(in srgb, var(--cp-text-primary) 55%, transparent)',
        }}>
          {t('companion.loading', null, 'Stiamo aprendo il tuo Journey…')}
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
          fontFamily: "var(--mood-font-serif, 'Playfair Display', serif)",
          fontStyle: 'italic', fontSize: 26, margin: 0,
          color: 'var(--cp-text-primary, #efe8d8)',
        }}>
          {t('companion.error.title', null, 'This Journey is awaiting')}
        </h3>
        <p style={{
          fontSize: 14,
          color: 'color-mix(in srgb, var(--cp-text-primary) 55%, transparent)',
          marginTop: 14,
        }}>
          {error || t('companion.error.unavailable', null, 'Non disponibile.')}
        </p>
      </div>
    );
  }

  const {
    header, active_chapter, shared_directions, evolution_timeline,
    materials_atmospheres, memory_archive, conversations,
  } = data;

  // Optimistic insert after the client shares a voice on the active chapter.
  const handleVoiceShared = (payload) => {
    if (!payload?.voice || !active_chapter) return;
    setData((prev) => {
      if (!prev) return prev;
      const newVoice = {
        id:           payload.voice.id,
        chapter:      payload.chapter?.title || active_chapter.title,
        message:      payload.voice.text,
        tone:         'voice',
        author_name:  'Tu',
        created_at:   payload.voice.created_at,
      };
      const newEvent = {
        id:         payload.timeline_event.id,
        narrative:  payload.timeline_event.narrative,
        kind:       'voice_received',
        created_at: payload.timeline_event.created_at,
      };
      return {
        ...prev,
        conversations:      [newVoice, ...(prev.conversations || [])],
        evolution_timeline: [newEvent, ...(prev.evolution_timeline || [])],
      };
    });
  };

  return (
    <div
      className={`cj-shell${header.is_archived ? ' is-archived' : ''}`}
      data-testid="client-companion-page"
      data-archived={header.is_archived ? 'true' : 'false'}
    >
      {header.is_archived ? (
        <DossierSection journeyId={journeyId} conversations={conversations} />
      ) : (
        <>
          <CompanionHero header={header} activeChapter={active_chapter} />
          <ActiveChapterSection
            chapter={active_chapter}
            journeyId={journeyId}
            onVoiceShared={handleVoiceShared}
          />
          <SharedDirectionsSection items={shared_directions} />
          <ConversationsSection items={conversations} />
          <EvolutionSection items={evolution_timeline} />
          <MaterialsSection items={materials_atmospheres} />
          <Section
            id="cantiere"
            eyebrow={tm('siteEvolution')}
            title={t('companion.section.site_evolution.title', null, 'La memoria viva del cantiere')}
            count={siteEvolution?.entries?.length
              ? interp(t(siteEvolution.entries.length === 1
                         ? 'companion.section.site_evolution.count.one'
                         : 'companion.section.site_evolution.count.many',
                         null, siteEvolution.entries.length === 1 ? '{n} momento' : '{n} momenti'),
                       { n: siteEvolution.entries.length })
              : null}
            testid="cj-section-cantiere"
          >
            <SiteEvolutionSection data={siteEvolution} />
          </Section>
          <MemoryArchiveSection items={memory_archive} />
        </>
      )}
    </div>
  );
};

export default ClientCompanionPage;
