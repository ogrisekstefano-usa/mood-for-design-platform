/**
 * ProjectDetailPage — Public storefront cinematic editorial reading.
 *
 * RUNTIME-BOUND (Phase S-CONNECT Step 4):
 *   • Reads `/api/portfolio/public/{tenant_slug}/{project_slug}?locale_code=<bcp47>`
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
import { toBcp47Storefront } from '../../site/localeBcp47';
import { usePositioning, resolveCtaLabels } from '../../site/usePositioning';
import { findProjectBySlug } from '../../site/content/projects';
import { uiContent } from '../../site/content/ui';
import { Reveal, SiteImage } from '../../site/components/Reveal';

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

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    const bcp = toBcp47Storefront(locale);
    const url = `${BACKEND_URL}/api/portfolio/public/${tenantConfig.slug}/${slug}?locale_code=${encodeURIComponent(bcp)}`;
    axios.get(url)
      .then((r) => {
        if (!alive) return;
        const project = r.data?.project;
        if (project) setState({ status: 'runtime', project });
        else setState({ status: 'fallback', project: findProjectBySlug(slug) });
      })
      .catch(() => {
        if (!alive) return;
        const fallback = findProjectBySlug(slug);
        setState(fallback ? { status: 'fallback', project: fallback } : { status: '404' });
      });
    return () => { alive = false; };
  }, [slug, locale]);

  useEffect(() => {
    if (state.status === 'runtime' || state.status === 'fallback') {
      const t = state.status === 'runtime'
        ? state.project.title
        : pick(state.project.title, `projects.${slug}.title`);
      document.title = `${t} — MOOD for DESIGN\u2122`;
    }
  }, [state, pick, slug]);

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

  const isRuntime = state.status === 'runtime';
  const p = state.project;

  // Project facets (runtime variant vs fallback shape)
  const title          = isRuntime ? p.title : pick(p.title, `projects.${slug}.title`);
  const culturalAngle  = isRuntime ? (p.cultural_angle || '') : '';
  const subtitle       = isRuntime ? (p.subtitle || '') : pick(p.subtitle, `projects.${slug}.subtitle`);
  const hospitalityTone= isRuntime ? (p.hospitality_tone || '') : '';
  const luxuryPerception = isRuntime ? (p.luxury_perception || '') : '';
  const aspirational     = isRuntime ? (p.aspirational_narrative || '') : '';
  const cover          = isRuntime ? p.cover_image_url : p.cover;
  const studio         = isRuntime ? null : p.studio;
  const designer       = isRuntime ? null : p.designer;
  const location       = isRuntime ? (p.location || '') : pick(p.location, `projects.${slug}.location`);
  const year           = isRuntime ? p.year : p.year;
  const category       = isRuntime ? p.category : null;
  const materialLanguage = isRuntime ? (p.material_language || {}) : null;
  const materialPalette = isRuntime ? (p.material_palette || []) : null;
  const tags           = isRuntime ? null : p.tags;
  const summary        = isRuntime ? '' : pick(p.summary, `projects.${slug}.summary`);
  const galleryRaw     = isRuntime ? (p.gallery || []) : (p.gallery || []);
  const gallery        = galleryRaw.map((g) => (typeof g === 'string' ? { url: g } : g)).filter((g) => g && g.url);
  const storyBody      = isRuntime ? (p.story_body || []) : [];
  const ctaSet         = isRuntime ? (p.cta_set || []) : [];
  const marketCode     = isRuntime ? (p.market_code || p.target_locale) : null;
  const chapters       = isRuntime ? null : (p.chapters || []);
  const materials      = isRuntime ? null : (p.materials || []);

  return (
    <div data-testid="site-project-detail" data-source={isRuntime ? 'runtime' : 'fallback'}>
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
              <span className="mfd-eyebrow">{isRuntime ? labels.atmosphere : pick(ui.overview, 'ui.detail.overview')}</span>
              <h2 className="mfd-h1" style={{ marginTop: '1rem' }}>{subtitle}</h2>
              {aspirational && (
                <p className="mfd-lead" style={{ marginTop: '1.5rem' }}>{aspirational}</p>
              )}
              {summary && !aspirational && (
                <p className="mfd-lead" style={{ marginTop: '1.5rem' }}>{summary}</p>
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
                  <Reveal key={i} delay={(i % 3) + 1}>
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
                    >"{b.text}"</blockquote>
                  </Reveal>
                );
              }
              return (
                <Reveal key={i} delay={(i % 3) + 1}>
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
                return (
                  <Reveal key={i} delay={(i % 3) + 1} className={wide ? 'mfd-gallery__wide' : ''}>
                    <SiteImage src={g.url} aspect={wide ? '16/9' : '4/5'} alt={g.caption || ''} />
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
                  >
                    {c.label || positioningCtas.primary || labels.beginCta} <ArrowUpRight size={14} />
                  </Link>
                ))
              : (
                <>
                  <Link to="/onboarding/private" className="mfd-btn mfd-btn--paper" data-testid="project-cta-begin">
                    {positioningCtas.primary || labels.beginCta} <ArrowUpRight size={14} />
                  </Link>
                  <Link to="/projects" className="mfd-btn" data-testid="project-cta-explore">
                    {positioningCtas.secondary || pick(ui.explore, 'ui.detail.explore')} <ArrowUpRight size={14} />
                  </Link>
                </>
              )}
          </Reveal>
        </div>
      </section>

      {/* RELATED — runtime-bound: other published variants in this locale. */}
      {isRuntime && (
        <RelatedRuntimeProjects currentSlug={slug} locale={locale} pickUiRelated={pick(ui.related, 'ui.detail.related')} />
      )}
    </div>
  );
};

/**
 * RelatedRuntimeProjects — fetches up to 3 other published variants for the
 * current market and links to them. Replaces the hardcoded `projects.js` seed.
 */
const RelatedRuntimeProjects = ({ currentSlug, locale, pickUiRelated }) => {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let alive = true;
    const bcp = toBcp47Storefront(locale);
    axios.get(`${BACKEND_URL}/api/portfolio/public/${tenantConfig.slug}/projects?locale_code=${encodeURIComponent(bcp)}`)
      .then((r) => {
        if (!alive) return;
        const list = (r.data?.projects || []).filter((p) => p.slug !== currentSlug).slice(0, 3);
        setItems(list);
      })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [currentSlug, locale]);

  if (items.length === 0) return null;

  return (
    <section className="mfd-section" data-testid="project-related" data-source="runtime">
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
                  {rp.cover_image_url
                    ? <SiteImage src={rp.cover_image_url} aspect={3/4} alt={rp.title} />
                    : <div style={{ aspectRatio: '3/4', background: 'var(--site-line, rgba(28,24,20,0.05))' }} />}
                </div>
                <div className="mfd-strip__meta">
                  <div className="mfd-strip__meta-row">
                    <h4 className="mfd-strip__title" style={{ fontSize: 'clamp(1.1rem, 1.6vw, 1.5rem)' }}>{rp.title}</h4>
                    {rp.location && <span className="mfd-strip__location">{rp.location}</span>}
                  </div>
                  {rp.cultural_angle && (
                    <p className="mfd-body" style={{ fontFamily: 'var(--site-serif, "Playfair Display", Georgia, serif)', fontStyle: 'italic', marginTop: '0.5rem' }}>{rp.cultural_angle}</p>
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
