/**
 * ProjectDetailPage — Public storefront cinematic editorial reading.
 *
 * RUNTIME-BOUND (Phase S-CONNECT Step 4):
 *   • Reads `/api/public/published-journeys/{tenant_slug}/{slug}?locale=<bcp47>`
 *   • The response is the MARKET-NATIVE variant composed in Projects Studio™:
 *     variant_title · cultural_angle · hospitality_tone · aspirational_narrative ·
 *     material_language · story_body[] · gallery · cta_set[] · seo ·
 *     target_locale · market_code.
 *   • The reading hierarchy is ATMOSPHERE FIRST, IMAGE SECOND, METADATA THIRD.
 *
 * Fallback: legacy `site/content/projects.js` only when the tenant has not
 * published any variants for the requested slug (graceful degradation).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowUpRight, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { useSite } from '../../site/SiteContext';
import { tenantConfig } from '../../site/content/tenant';
import { resolveLocaleBag } from '../../site/localeResolver';
import { usePositioning, resolveCtaLabels } from '../../site/usePositioning';
import { uiContent } from '../../site/content/ui';
import { Reveal, SiteImage } from '../../site/components/Reveal';
import { useMarketSignal } from '../../hooks/useMarketSignal';
import '../../site/components/PublicHotspot.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const EDITORIAL_LOADING = {
  'it-IT': 'Componendo la lettura editoriale del progetto…',
  'en-US': 'Composing the editorial reading of the project…',
  'en-GB': 'Composing the editorial reading of the project…',
  'fr-FR': 'Composition de la lecture éditoriale du projet…',
  'de-DE': 'Die editoriale Projektlektüre wird komponiert…',
  'es-ES': 'Componiendo la lectura editorial del proyecto…',
};

const DETAIL_LABELS = {
  'it-IT': { angle: 'Cultural angle',         atmosphere: 'Materia · ritmo · atmosfera',  body: 'Lettura',         gallery: 'Galleria',     materials: 'Vocabolario materico',  hospitality: 'Ospitalità', back: 'Torna ai progetti',     beginCta: 'Inizia il dialogo' },
  'en-US': { angle: 'Cultural angle',         atmosphere: 'Material · pacing · atmosphere', body: 'Reading',       gallery: 'Gallery',      materials: 'Material vocabulary',   hospitality: 'Hospitality', back: 'Back to projects',     beginCta: 'Begin the dialogue' },
  'en-GB': { angle: 'Cultural angle',         atmosphere: 'Material · pacing · atmosphere', body: 'Reading',       gallery: 'Gallery',      materials: 'Material vocabulary',   hospitality: 'Hospitality', back: 'Back to projects',     beginCta: 'Begin the dialogue' },
  'fr-FR': { angle: 'Angle culturel',         atmosphere: 'Matière · rythme · atmosphère',  body: 'Lecture',       gallery: 'Galerie',      materials: 'Vocabulaire matériel',  hospitality: 'Hospitalité', back: 'Retour aux projets',   beginCta: 'Commencer le dialogue' },
  'de-DE': { angle: 'Kultureller Winkel',     atmosphere: 'Material · Rhythmus · Atmosphäre', body: 'Lektüre',     gallery: 'Galerie',      materials: 'Materialvokabular',     hospitality: 'Gastlichkeit', back: 'Zurück zu Projekten', beginCta: 'Den Dialog beginnen' },
  'es-ES': { angle: 'Ángulo cultural',        atmosphere: 'Materia · ritmo · atmósfera',  body: 'Lectura',         gallery: 'Galería',      materials: 'Vocabulario material',  hospitality: 'Hospitalidad', back: 'Volver a los proyectos', beginCta: 'Iniciar el diálogo' },
};
const labelsFor = (loc) => DETAIL_LABELS[loc] || DETAIL_LABELS['en-US'];

const ProjectDetailPage = () => {
  const { slug } = useParams();
  const { pick, locale } = useSite();
  const { positioning } = usePositioning(locale);
  const positioningCtas = resolveCtaLabels(positioning, locale);
  const ui = uiContent.detail;
  const labels = labelsFor(locale);

  // null = loading | { project } = runtime variant | { fallback } | 404
  const [state, setState] = useState({ status: 'loading' });

  // ── Market Intelligence Engine™ signal (anonymous, privacy-by-design) ──
  // Declared at the top to respect rules-of-hooks (no conditional calls).
  const signalMarket = state.status === 'runtime' ? (state.project?.market_code || null) : null;
  const signalLocale = state.status === 'runtime' ? (state.project?.target_locale || null) : null;
  const signal = useMarketSignal({ marketCode: signalMarket, locale: signalLocale });
  // gallery_open emesso una sola volta quando il progetto è caricato.
  useEffect(() => {
    if (slug && state.status !== 'loading' && state.status !== '404') {
      signal.fireGalleryOpen({ project_slug: slug });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, state.status, signalMarket]);

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    const url = `${BACKEND_URL}/api/public/published-journeys/${tenantConfig.slug}/${slug}?locale=${encodeURIComponent(locale)}`;
    axios.get(url)
      .then((r) => {
        if (!alive) return;
        const item = r.data?.item;
        if (item) setState({ status: 'runtime', project: item });
        else setState({ status: '404' });
      })
      .catch(() => {
        if (alive) setState({ status: '404' });
      });
    return () => { alive = false; };
  }, [slug, locale]);

  useEffect(() => {
    if (state.status === 'runtime') {
      document.title = `${state.project.title} — MOOD for DESIGN\u2122`;
    }
  }, [state]);

  // Loading state — editorial italic
  if (state.status === 'loading') {
    return (
      <div data-testid="site-project-detail-loading">
        <section className="mfd-section" style={{ paddingTop: 'clamp(8rem, 14vw, 12rem)' }}>
          <div className="mfd-wrap" style={{ textAlign: 'center' }}>
            <p
              style={{
                fontFamily: 'var(--site-serif, "Playfair Display", Georgia, serif)',
                fontStyle: 'italic',
                fontSize: 'clamp(1.1rem, 1.6vw, 1.4rem)',
                color: 'var(--site-ink-muted, rgba(28,24,20,0.5))',
                padding: '6rem 0',
              }}
            >{EDITORIAL_LOADING[locale] || EDITORIAL_LOADING['en-US']}</p>
          </div>
        </section>
      </div>
    );
  }

  if (state.status === '404') return <Navigate to="/projects" replace />;

  // Il progetto proviene esclusivamente da published_design_journeys
  const p = state.project;

  // Mapping published_design_journeys → variabili locali
  const title             = p.title || '';
  const culturalAngle     = p.atmosphere || '';
  const subtitle          = p.excerpt || '';
  const hospitalityTone   = null;
  const luxuryPerception  = null;
  const aspirational      = null;
  const cover             = p.hero_url || null;
  const studio            = null;
  const designer          = null;
  const location          = p.location || '';
  const year              = p.year || null;
  const category          = p.project_type || null;
  const materialLanguage  = null;
  const materialPalette   = Array.isArray(p.material_tags) ? p.material_tags : [];
  const tags              = null;
  const galleryRaw        = [];
  const gallery           = [];
  const storyBody         = [];
  const ctaSet            = [];
  const marketCode        = null;
  const chapters          = null;
  const materials         = null;

  return (
    <div data-testid="site-project-detail" data-source="published_journeys">
      {/* HERO — atmosphere first */}
      <section className="mfd-detail-hero" data-testid="project-hero">
        {cover && <img src={cover} alt={title} loading="eager" decoding="async" />}
        <div className="mfd-detail-hero__veil" />
        <div className="mfd-detail-hero__caption">
          <Reveal as="span" className="mfd-eyebrow mfd-eyebrow--accent">
            {category ? `${category}` : pick(ui.label, 'ui.detail.label')}
            {year ? ` · ${year}` : ''}
            {marketCode ? ` · ${String(marketCode).toUpperCase()}` : ''}
          </Reveal>
          <Reveal as="h1" className="mfd-display" delay={2} style={{ fontSize: 'clamp(2.2rem, 5vw, 4.6rem)' }}>
            {title}
          </Reveal>
          {culturalAngle && (
            <Reveal as="p" className="mfd-lead" delay={3} style={{ fontStyle: 'italic', maxWidth: '52ch' }}>
              {culturalAngle}
            </Reveal>
          )}
          {!culturalAngle && subtitle && (
            <Reveal as="p" className="mfd-lead" delay={3}>{subtitle}</Reveal>
          )}
        </div>
      </section>

      {/* Back link */}
      <section className="mfd-section mfd-section--tight" style={{ paddingTop: '2rem', paddingBottom: 0 }}>
        <div className="mfd-wrap">
          <Link to="/projects" className="mfd-btn mfd-btn--outline-paper" data-testid="project-back" style={{ padding: '0.7rem 1.2rem' }}>
            <ArrowLeft size={14} /> {labels.back}
          </Link>
        </div>
      </section>

      {/* OVERVIEW — atmosphere readout */}
      <section className="mfd-section" data-testid="project-overview">
        <div className="mfd-wrap">
          <div className="mfd-detail-grid">
            <Reveal>
              <dl className="mfd-detail-spec">
                {studio && <><dt>{pick(ui.studio, 'ui.detail.studio')}</dt><dd>{studio}</dd></>}
                {designer && <><dt>{pick(ui.designer, 'ui.detail.designer')}</dt><dd>{designer}</dd></>}
                {location && <><dt>{pick(ui.location, 'ui.detail.location')}</dt><dd>{location}</dd></>}
                {year && <><dt>{pick(ui.year, 'ui.detail.year')}</dt><dd>{year}</dd></>}
              </dl>
              {(tags || materialPalette) && (
                <div className="mfd-tags" style={{ marginTop: '1rem' }}>
                  {(tags || []).map((t, i) => (<span key={i} className="mfd-tag">{pick(t, `projects.${slug}.tags.${i}`)}</span>))}
                  {(materialPalette || []).slice(0, 6).map((m, i) => (<span key={`mp-${i}`} className="mfd-tag">{m}</span>))}
                </div>
              )}
            </Reveal>
            <Reveal delay={2}>
              <span className="mfd-eyebrow">{labels.atmosphere}</span>
              <h2 className="mfd-h1" style={{ marginTop: '1rem' }}>{subtitle}</h2>
              {aspirational && (
                <p className="mfd-lead" style={{ marginTop: '1.5rem' }}>{aspirational}</p>
              )}
              {subtitle && (
                <p className="mfd-lead" style={{ marginTop: '1.5rem' }}>{subtitle}</p>
              )}
              {hospitalityTone && (
                <p
                  style={{
                    marginTop: '1.5rem',
                    fontFamily: 'var(--site-serif, "Playfair Display", Georgia, serif)',
                    fontStyle: 'italic',
                    fontSize: 'clamp(1.05rem, 1.4vw, 1.25rem)',
                    color: 'var(--site-ink, #1c1814)',
                    opacity: 0.78,
                    lineHeight: 1.55,
                  }}
                >{hospitalityTone}</p>
              )}
            </Reveal>
          </div>
        </div>
      </section>

      {/* STORY BODY (runtime only) — cinematic editorial reading */}
      {storyBody.length > 0 && (
        <section className="mfd-section" data-testid="project-story">
          <div className="mfd-wrap" style={{ display: 'grid', gap: 'clamp(1.5rem, 3vw, 2.5rem)', maxWidth: '72ch', margin: '0 auto' }}>
            <Reveal as="span" className="mfd-eyebrow mfd-eyebrow--accent">{labels.body}</Reveal>
            {storyBody.map((b, i) => {
              if (b.type === 'pull_quote') {
                return (
                  <Reveal key={b.id || i} delay={(i % 3) + 1}>
                    <blockquote
                      style={{
                        fontFamily: 'var(--site-serif, "Playfair Display", Georgia, serif)',
                        fontStyle: 'italic',
                        fontSize: 'clamp(1.4rem, 2.4vw, 2rem)',
                        lineHeight: 1.35,
                        margin: '1.5rem 0',
                        padding: '0 1rem',
                        borderLeft: '2px solid var(--site-accent, #c8a572)',
                      }}
                    >"{b.text}"
                    {b.attribution && <footer style={{ fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.7, fontStyle: 'normal' }}>— {b.attribution}</footer>}
                    </blockquote>
                  </Reveal>
                );
              }
              if (b.type === 'image' && b.url) {
                return (
                  <Reveal key={b.id || i} delay={(i % 3) + 1} style={{ maxWidth: 'none', margin: '0 calc(-1 * clamp(0px, 6vw, 80px))' }}>
                    <SiteImage src={b.url} aspect="16/9" alt={b.alt_text || b.caption || ''}
                               filters={b.filters} focalPoint={b.focal_point} />
                    {b.caption && (
                      <p style={{
                        marginTop: '0.5rem', fontSize: '0.85rem',
                        fontFamily: 'var(--site-serif, "Playfair Display", Georgia, serif)',
                        fontStyle: 'italic',
                        color: 'var(--site-ink-muted, rgba(28,24,20,0.6))',
                        textAlign: 'center',
                      }}>{b.caption}</p>
                    )}
                  </Reveal>
                );
              }
              if (b.type === 'gallery' && (b.items || []).length > 0) {
                return (
                  <Reveal key={b.id || i} delay={(i % 3) + 1} style={{ maxWidth: 'none', margin: '0 calc(-1 * clamp(0px, 6vw, 80px))' }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${Math.min(b.items.length, 3)}, 1fr)`,
                      gap: '0.8rem',
                    }}>
                      {b.items.map((g, gi) => (
                        <div key={g.id || gi}>
                          <SiteImage src={g.url} aspect="4/5" alt={g.alt_text || g.caption || ''}
                                     filters={g.filters} focalPoint={g.focal_point} />
                          {g.caption && (
                            <p style={{
                              marginTop: '0.4rem', fontSize: '0.8rem',
                              fontFamily: 'var(--site-serif, "Playfair Display", Georgia, serif)',
                              fontStyle: 'italic',
                              color: 'var(--site-ink-muted, rgba(28,24,20,0.55))',
                            }}>{g.caption}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </Reveal>
                );
              }
              if (b.type === 'hotspot_image' && b.url) {
                return (
                  <Reveal key={b.id || i} delay={(i % 3) + 1} style={{ maxWidth: 'none', margin: '0 calc(-1 * clamp(0px, 6vw, 80px))' }}>
                    <PublicHotspotImage url={b.url} caption={b.caption} hotspots={b.hotspots || []} alt={b.alt_text}
                                        filters={b.filters} focalPoint={b.focal_point}
                                        onHotspotOpen={(h) => signal.fireHotspotOpen({ project_slug: slug, hotspot_id: h.id, hotspot_kind: h.kind || 'detail', material_id: h.material_id || null })}
                                        onMaterialZoom={(h) => h.material_id && signal.fireMaterialZoom({ project_slug: slug, material_id: h.material_id, hotspot_id: h.id })} />
                  </Reveal>
                );
              }
              if (b.type === 'cta' && b.label) {
                return (
                  <Reveal key={b.id || i} delay={(i % 3) + 1} style={{ textAlign: 'center', padding: '1rem 0' }}>
                    <Link to="/start-project" className="mfd-btn mfd-btn--paper" data-testid={`project-story-cta-${i}`}
                          onClick={() => signal.fireCtaClick({ project_slug: slug, cta_action: b.action || `story_cta_${i}`, cta_label: b.label })}>
                      {b.label} <ArrowUpRight size={14} />
                    </Link>
                  </Reveal>
                );
              }
              // default: paragraph or unknown → fallback to text
              if (!b.text) return null;
              return (
                <Reveal key={b.id || i} delay={(i % 3) + 1}>
                  <p className="mfd-lead" style={{ lineHeight: 1.7 }}>{b.text}</p>
                </Reveal>
              );
            })}
          </div>
        </section>
      )}

      {/* MATERIAL LANGUAGE (runtime variant) */}
      {materialLanguage && (materialLanguage.primary || materialLanguage.secondary || materialLanguage.tactile) && (
        <section className="mfd-section mfd-section--tight" data-testid="project-material-language">
          <div className="mfd-wrap">
            <Reveal as="span" className="mfd-eyebrow">{labels.materials}</Reveal>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '2rem',
                marginTop: '1.5rem',
              }}
            >
              {['primary', 'secondary', 'tactile'].map((k) => (
                materialLanguage[k] ? (
                  <Reveal key={k}>
                    <p className="mfd-eyebrow" style={{ marginBottom: '0.5rem', opacity: 0.5 }}>{k}</p>
                    <p
                      style={{
                        fontFamily: 'var(--site-serif, "Playfair Display", Georgia, serif)',
                        fontSize: 'clamp(1.05rem, 1.4vw, 1.3rem)',
                        lineHeight: 1.5,
                      }}
                    >{materialLanguage[k]}</p>
                  </Reveal>
                ) : null
              ))}
            </div>
          </div>
        </section>
      )}

      {/* GALLERY */}
      {gallery.length > 0 && (
        <section className="mfd-section" data-testid="project-gallery">
          <div className="mfd-wrap">
            <div className="mfd-gallery">
              {gallery.map((g, i) => {
                const wide = i === 0 || (i % 3 === 0 && i !== 0);
                const hsList = g.hotspots || [];
                return (
                  <Reveal key={g.id || i} delay={(i % 3) + 1} className={wide ? 'mfd-gallery__wide' : ''}>
                    {hsList.length > 0 ? (
                      <PublicHotspotImage url={g.url} caption={g.caption} hotspots={hsList} alt={g.alt_text || g.caption || ''} aspect={wide ? '16/9' : '4/5'}
                                          filters={g.filters} focalPoint={g.focal_point}
                                          onHotspotOpen={(h) => signal.fireHotspotOpen({ project_slug: slug, hotspot_id: h.id, hotspot_kind: h.kind || 'detail', material_id: h.material_id || null })}
                                          onMaterialZoom={(h) => h.material_id && signal.fireMaterialZoom({ project_slug: slug, material_id: h.material_id, hotspot_id: h.id })} />
                    ) : (
                      <>
                        <SiteImage src={g.url} aspect={wide ? '16/9' : '4/5'} alt={g.alt_text || g.caption || ''}
                                   filters={g.filters} focalPoint={g.focal_point} />
                        {g.caption && (
                          <p
                            style={{
                              marginTop: '0.5rem',
                              fontSize: '0.85rem',
                              fontFamily: 'var(--site-serif, "Playfair Display", Georgia, serif)',
                              fontStyle: 'italic',
                              color: 'var(--site-ink-muted, rgba(28,24,20,0.6))',
                            }}
                          >{g.caption}</p>
                        )}
                      </>
                    )}
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* LEGACY CHAPTERS (fallback projects.js only) */}
      {chapters && chapters.length > 0 && (
        <section className="mfd-section" data-testid="project-chapters">
          <div className="mfd-wrap" style={{ display: 'grid', gap: 'clamp(2rem, 4vw, 3.5rem)' }}>
            {chapters.map((ch, i) => (
              <Reveal key={ch.id} delay={(i % 3) + 1} style={{ maxWidth: '70ch' }}>
                <span className="mfd-eyebrow mfd-eyebrow--accent">0{i + 1}</span>
                <h3 className="mfd-h1" style={{ marginTop: '0.75rem' }}>{pick(ch.title, `projects.${slug}.chapters.${ch.id}.title`)}</h3>
                <p className="mfd-lead" style={{ marginTop: '1.25rem' }}>{pick(ch.body, `projects.${slug}.chapters.${ch.id}.body`)}</p>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {materials && materials.length > 0 && (
        <section className="mfd-section mfd-section--tight" data-testid="project-materials">
          <div className="mfd-wrap" style={{ display: 'grid', gap: '2rem' }}>
            <Reveal as="span" className="mfd-eyebrow">{pick(ui.materials, 'ui.detail.materials')}</Reveal>
            <Reveal as="div" delay={2}>
              <div className="mfd-materials">
                {materials.map((m, i) => (
                  <div key={i} className="mfd-materials__row">
                    <span className="mfd-materials__name">{pick(m.name, `projects.${slug}.materials.${i}.name`)}</span>
                    <span className="mfd-materials__supplier">{m.supplier}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {luxuryPerception && (
        <section className="mfd-section mfd-section--tight" data-testid="project-luxury-perception">
          <div className="mfd-wrap" style={{ textAlign: 'center', maxWidth: '60ch', margin: '0 auto' }}>
            <p
              style={{
                fontFamily: 'var(--site-serif, "Playfair Display", Georgia, serif)',
                fontStyle: 'italic',
                fontSize: 'clamp(1.4rem, 2.4vw, 1.9rem)',
                lineHeight: 1.4,
                color: 'var(--site-ink, #1c1814)',
                opacity: 0.82,
              }}
            >{luxuryPerception}</p>
          </div>
        </section>
      )}

      {/* MARKET-NATIVE CTA — Step B Phase 3: positioning-driven copy. */}
      <section className="mfd-section" data-testid="project-final-cta" data-positioning-mode={positioningCtas.mode || ''} data-editorial-lens={positioningCtas.lens || ''}>
        <div className="mfd-wrap" style={{ display: 'grid', gap: '2rem' }}>
          <Reveal as="h2" className="mfd-display" style={{ fontSize: 'clamp(2.2rem, 4.6vw, 4rem)' }}>
            {pick(ui.cta, 'ui.detail.cta')}
          </Reveal>
          <Reveal style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
            {ctaSet.length > 0
              ? ctaSet.map((c, i) => (
                  <Link
                    key={i}
                    to="/start-project"
                    className={i === 0 ? 'mfd-btn mfd-btn--paper' : 'mfd-btn'}
                    data-testid={`project-cta-${c.action || i}`}
                    onClick={() => signal.fireCtaClick({ project_slug: slug, cta_action: c.action || `cta_${i}`, cta_index: i })}
                  >
                    {c.label || positioningCtas.primary || labels.beginCta} <ArrowUpRight size={14} />
                  </Link>
                ))
              : (
                <>
                  <Link to="/onboarding/private" className="mfd-btn mfd-btn--paper" data-testid="project-cta-begin"
                        onClick={() => signal.fireCtaClick({ project_slug: slug, cta_action: 'begin_dialogue' })}>
                    {positioningCtas.primary || labels.beginCta} <ArrowUpRight size={14} />
                  </Link>
                  <Link to="/projects" className="mfd-btn" data-testid="project-cta-explore"
                        onClick={() => signal.fireCtaClick({ project_slug: slug, cta_action: 'explore_more' })}>
                    {positioningCtas.secondary || pick(ui.explore, 'ui.detail.explore')} <ArrowUpRight size={14} />
                  </Link>
                </>
              )}
          </Reveal>
        </div>
      </section>

      {/* RELATED — runtime-bound: other published variants in this locale. */}
      <RelatedJourneys currentSlug={slug} locale={locale} pickUiRelated={pick(ui.related, 'ui.detail.related')} />
    </div>
  );
};

/**
 * RelatedJourneys — altri progetti pubblicati per questa locale.
 * Legge esclusivamente da published_design_journeys via /feed.
 */
const RelatedJourneys = ({ currentSlug, locale, pickUiRelated }) => {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let alive = true;
    axios.get(`${BACKEND_URL}/api/public/published-journeys/${tenantConfig.slug}/feed?locale=${encodeURIComponent(locale)}&featured_only=false&limit=4`)
      .then((r) => {
        if (!alive) return;
        const list = (r.data?.items || []).filter((p) => p.slug !== currentSlug).slice(0, 3);
        setItems(list);
      })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [currentSlug, locale]);

  if (items.length === 0) return null;

  return (
    <section className="mfd-section" data-testid="project-related" data-source="published_journeys">
      <div className="mfd-wrap" style={{ display: 'grid', gap: '2rem' }}>
        <Reveal as="span" className="mfd-eyebrow">{pickUiRelated}</Reveal>
        <Reveal delay={2}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
            {items.map((rp) => (
              <Link
                key={rp.slug}
                to={`/projects/${rp.slug}`}
                style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
                data-testid={`project-related-${rp.slug}`}
              >
                <div className="mfd-strip__media">
                  {rp.hero_url
                    ? <SiteImage src={rp.hero_url} aspect={3/4} alt={rp.title} />
                    : <div style={{ aspectRatio: '3/4', background: 'var(--site-line, rgba(28,24,20,0.05))' }} />}
                </div>
                <div className="mfd-strip__meta">
                  <div className="mfd-strip__meta-row">
                    <h4 className="mfd-strip__title" style={{ fontSize: 'clamp(1.1rem, 1.6vw, 1.5rem)' }}>{rp.title}</h4>
                    {rp.location && <span className="mfd-strip__location">{rp.location}</span>}
                  </div>
                  {rp.atmosphere && (
                    <p className="mfd-body" style={{ fontFamily: 'var(--site-serif, "Playfair Display", Georgia, serif)', fontStyle: 'italic', marginTop: '0.5rem' }}>{rp.atmosphere}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
};

export default ProjectDetailPage;

// ─── PublicHotspotImage — read-only editorial detail points ──────
const PublicHotspotImage = ({ url, caption, hotspots = [], alt, aspect = '16/9', filters, focalPoint, onHotspotOpen, onMaterialZoom }) => {
  const [activeId, setActiveId] = React.useState(null);
  const firedRef = React.useRef(new Set());
  const active = hotspots.find((h) => h.id === activeId);
  const handlePinClick = (h) => {
    const willOpen = activeId !== h.id;
    setActiveId(willOpen ? h.id : null);
    if (willOpen) {
      // Emetti hotspot_open una sola volta per pin per sessione di visita.
      if (!firedRef.current.has(`open:${h.id}`)) {
        firedRef.current.add(`open:${h.id}`);
        onHotspotOpen?.(h);
      }
      if (h.material_id && !firedRef.current.has(`mat:${h.material_id}`)) {
        firedRef.current.add(`mat:${h.material_id}`);
        onMaterialZoom?.(h);
      }
    }
  };
  // Anti-overflow placement: flip horizontally past 60%, vertically
  // past 70% so the tooltip never lands off-canvas on mobile.
  const tipTransform = (h) => {
    if (!h) return '';
    const hx = h.x_pct > 60 ? 'calc(-100% - 22px)' : '22px';
    const vy = h.y_pct > 70 ? '-100%' : (h.y_pct < 30 ? '0%' : '-50%');
    return `translate(${hx}, ${vy})`;
  };
  // Build CSS filter + transform + focal point — same logic as SiteImage
  // so the underlying image renders identically inside the hotspot canvas.
  const imgStyle = {};
  if (filters) {
    const parts = [];
    if (filters.brightness != null && filters.brightness !== 1) parts.push(`brightness(${filters.brightness})`);
    if (filters.contrast   != null && filters.contrast   !== 1) parts.push(`contrast(${filters.contrast})`);
    if (filters.saturation != null && filters.saturation !== 1) parts.push(`saturate(${filters.saturation})`);
    if (parts.length) imgStyle.filter = parts.join(' ');
    if (filters.rotate != null && filters.rotate !== 0) imgStyle.transform = `rotate(${filters.rotate}deg)`;
  }
  if (focalPoint && (focalPoint.x != null || focalPoint.y != null)) {
    imgStyle.objectPosition = `${(focalPoint.x ?? 0.5) * 100}% ${(focalPoint.y ?? 0.5) * 100}%`;
  }
  return (
    <div className="phs-wrap" data-testid="public-hotspot-image">
      <div className="phs-canvas" style={{ aspectRatio: aspect }}>
        <img src={url} alt={alt || caption || ''} className="phs-img" style={imgStyle} />
        {hotspots.map((h) => (
          <button
            key={h.id}
            type="button"
            className={`phs-pin ${activeId === h.id ? 'is-active' : ''}`}
            style={{ left: `${h.x_pct}%`, top: `${h.y_pct}%` }}
            onClick={() => handlePinClick(h)}
            aria-label={h.title || 'Detail Point'}
            data-testid={`phs-pin-${h.id}`}
          >
            <span className="phs-pin__dot" />
            <span className="phs-pin__ring" />
          </button>
        ))}
        {active && (
          <div
            className="phs-tip"
            style={{
              left: `${active.x_pct}%`,
              top: `${active.y_pct}%`,
              transform: tipTransform(active),
            }}
          >
            {active.title && <p className="phs-tip__title">{active.title}</p>}
            {active.description && <p className="phs-tip__desc">{active.description}</p>}
          </div>
        )}
      </div>
      {caption && (
        <p style={{
          marginTop: '0.5rem', fontSize: '0.85rem',
          fontFamily: 'var(--site-serif, "Playfair Display", Georgia, serif)',
          fontStyle: 'italic',
          color: 'var(--site-ink-muted, rgba(28,24,20,0.6))',
          textAlign: 'center',
        }}>{caption}</p>
      )}
    </div>
  );
};
