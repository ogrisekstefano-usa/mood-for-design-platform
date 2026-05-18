/**
 * ProjectsIndexPage — Public storefront portfolio archive.
 *
 * RUNTIME-BOUND (Phase S-CONNECT Step 4):
 *   • Reads `/api/portfolio/public/{tenant_slug}/projects?locale_code=<bcp47>`
 *   • Each project is the MARKET-NATIVE variant composed in Projects Studio™ —
 *     variant_title · cultural_angle · material_palette · cover image — NOT a
 *     translated copy of a master record.
 *   • Loading state is editorial, italic, calm. No spinners.
 *
 * Fallback: legacy `site/content/projects.js` only when the tenant has not
 * published any variants yet (graceful — never shows a broken state).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import axios from 'axios';
import { useSite } from '../../site/SiteContext';
import { tenantConfig } from '../../site/content/tenant';
import { toBcp47Storefront } from '../../site/localeBcp47';
import { projects as fallbackProjects, projectCategories } from '../../site/content/projects';
import { uiContent } from '../../site/content/ui';
import { Reveal, SiteImage } from '../../site/components/Reveal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const EDITORIAL_LOADING = {
  'it-IT': 'Componendo l\'atmosfera editoriale…',
  'en-US': 'Composing the editorial atmosphere…',
  'en-GB': 'Composing the editorial atmosphere…',
  'fr-FR': 'Composition de l\'atmosphère éditoriale…',
  'de-DE': 'Die editoriale Atmosphäre wird komponiert…',
  'es-ES': 'Componiendo la atmósfera editorial…',
};

const EDITORIAL_EMPTY = {
  'it-IT': 'Nessun progetto ancora pubblicato per questo mercato.',
  'en-US': 'No projects published for this market yet.',
  'en-GB': 'No projects published for this market yet.',
  'fr-FR': 'Aucun projet publié pour ce marché.',
  'de-DE': 'Noch keine Projekte für diesen Markt veröffentlicht.',
  'es-ES': 'Ningún proyecto publicado para este mercado todavía.',
};

const ProjectsIndexPage = () => {
  const { pick, locale } = useSite();
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState(null);    // null = loading; [] = empty; [...] = ready
  const [usingFallback, setUsingFallback] = useState(false);
  const ui = uiContent.archive;

  // Runtime bind to portfolio public endpoint.
  useEffect(() => {
    let alive = true;
    setItems(null); setUsingFallback(false);
    const bcp = toBcp47Storefront(locale);
    const url = `${BACKEND_URL}/api/portfolio/public/${tenantConfig.slug}/projects?locale_code=${encodeURIComponent(bcp)}`;
    axios.get(url)
      .then((r) => {
        if (!alive) return;
        const list = r.data?.projects || [];
        if (list.length > 0) {
          setItems(list);
          setUsingFallback(false);
        } else {
          // Graceful fallback so the public site is never empty during onboarding.
          setItems(fallbackProjects);
          setUsingFallback(true);
        }
      })
      .catch(() => {
        if (!alive) return;
        setItems(fallbackProjects);
        setUsingFallback(true);
      });
    return () => { alive = false; };
  }, [locale]);

  useEffect(() => { document.title = 'Projects — MOOD for DESIGN\u2122'; }, []);

  const filtered = useMemo(() => {
    if (!items) return null;
    if (filter === 'all') return items;
    return items.filter((p) => (p.category || '').toLowerCase() === filter);
  }, [items, filter]);

  const loadingLine = EDITORIAL_LOADING[locale] || EDITORIAL_LOADING['en-US'];
  const emptyLine   = EDITORIAL_EMPTY[locale]   || EDITORIAL_EMPTY['en-US'];

  return (
    <div data-testid="site-projects-index">
      <section className="mfd-section" style={{ paddingTop: 'clamp(8rem, 14vw, 12rem)' }}>
        <div className="mfd-wrap" style={{ display: 'grid', gap: '2rem' }}>
          <Reveal as="span" className="mfd-eyebrow mfd-eyebrow--accent" data-testid="projects-eyebrow">
            {pick(ui.eyebrow, 'ui.archive.eyebrow')}
          </Reveal>
          <Reveal as="h1" className="mfd-display" delay={2} data-testid="projects-title">
            {pick(ui.title, 'ui.archive.title')}
          </Reveal>
          <Reveal delay={3} className="mfd-rule" style={{ marginTop: '1.5rem', height: 1, background: 'var(--site-line)' }} />
          <Reveal delay={3} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem', marginTop: '0.5rem' }}>
            <span className="mfd-eyebrow">{pick(ui.filterLabel, 'ui.archive.filterLabel')}</span>
            <div className="mfd-filters" data-testid="projects-filters">
              {projectCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className="mfd-filters__btn"
                  aria-pressed={filter === cat.id}
                  onClick={() => setFilter(cat.id)}
                  data-testid={`projects-filter-${cat.id}`}
                >
                  {pick(cat.label, `projectCategories.${cat.id}`)}
                </button>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mfd-section mfd-section--tight">
        <div className="mfd-wrap">
          {items === null && (
            <p
              data-testid="projects-loading"
              style={{
                fontFamily: 'var(--site-serif, "Playfair Display", Georgia, serif)',
                fontStyle: 'italic',
                fontSize: 'clamp(1.05rem, 1.4vw, 1.25rem)',
                color: 'var(--site-ink-muted, rgba(28,24,20,0.5))',
                padding: '6rem 0',
                textAlign: 'center',
              }}
            >{loadingLine}</p>
          )}

          {items !== null && filtered && filtered.length === 0 && (
            <p
              data-testid="projects-empty"
              style={{
                fontFamily: 'var(--site-serif, "Playfair Display", Georgia, serif)',
                fontStyle: 'italic',
                fontSize: 'clamp(1.05rem, 1.4vw, 1.25rem)',
                color: 'var(--site-ink-muted, rgba(28,24,20,0.5))',
                padding: '6rem 0',
                textAlign: 'center',
              }}
            >{emptyLine}</p>
          )}

          {items !== null && filtered && filtered.length > 0 && (
            <div className="mfd-strip-list" data-testid="projects-grid" data-source={usingFallback ? 'fallback' : 'runtime'}>
              {filtered.map((p, i) => (
                <ProjectCard key={p.slug || p.id || i} project={p} index={i} usingFallback={usingFallback} pick={pick} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mfd-section" data-testid="projects-final-cta">
        <div className="mfd-wrap" style={{ display: 'grid', gap: '2rem' }}>
          <Reveal as="h2" className="mfd-h1">{pick(ui.finalTitle, 'ui.archive.finalTitle')}</Reveal>
          <Reveal style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }} delay={2}>
            <Link to="/onboarding/private" className="mfd-btn mfd-btn--paper" data-testid="projects-cta-private">
              {pick(ui.ctaPrivate, 'ui.archive.ctaPrivate')} <ArrowUpRight size={14} />
            </Link>
            <Link to="/onboarding/pro" className="mfd-btn" data-testid="projects-cta-pro">
              {pick(ui.ctaPro, 'ui.archive.ctaPro')} <ArrowUpRight size={14} />
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

/**
 * ProjectCard — atmosphere-first cinematic strip card.
 *
 * Runtime variant shape (from /api/portfolio/public): {
 *   slug, title (variant_title), subtitle, cultural_angle,
 *   cover_image_url, location, year, category,
 *   material_palette[], target_locale, market_code, …
 * }
 *
 * Legacy fallback shape (site/content/projects.js): {
 *   slug, title{it,en}, subtitle{it,en}, location{it,en},
 *   tags[{it,en}], cover, aspect, category
 * }
 */
const ProjectCard = ({ project: p, index, usingFallback, pick }) => {
  const title = usingFallback
    ? pick(p.title, `projects.${p.slug}.title`)
    : (p.title || '');
  const culturalSubtitle = usingFallback
    ? pick(p.subtitle, `projects.${p.slug}.subtitle`)
    : (p.cultural_angle || p.subtitle || '');
  const location = usingFallback
    ? pick(p.location, `projects.${p.slug}.location`)
    : (p.location || '');
  const cover = usingFallback ? p.cover : p.cover_image_url;
  const materialChips = usingFallback
    ? (p.tags || []).slice(0, 3).map((t, ti) => pick(t, `projects.${p.slug}.tags.${ti}`))
    : (p.material_palette || []).slice(0, 3);
  const aspect = usingFallback ? p.aspect : (3 / 4);

  return (
    <Reveal delay={(index % 3) + 1} className="mfd-strip-list__item">
      <Link
        to={`/projects/${p.slug}`}
        className="mfd-strip-list__link"
        data-testid={`project-card-${p.slug}`}
        style={{ display: 'block' }}
      >
        <div className="mfd-strip__media">
          {cover
            ? <SiteImage src={cover} aspect={aspect} alt={title} />
            : <div style={{ aspectRatio: '4/3', background: 'var(--site-line, rgba(28,24,20,0.05))' }} />}
        </div>
        <div className="mfd-strip__meta">
          <div className="mfd-strip__meta-row">
            <h3 className="mfd-strip__title">{title}</h3>
            {location && <span className="mfd-strip__location">{location}</span>}
          </div>
          {culturalSubtitle && (
            <p
              className="mfd-body"
              style={{
                maxWidth: '60ch',
                fontFamily: 'var(--site-serif, "Playfair Display", Georgia, serif)',
                fontStyle: 'italic',
                lineHeight: 1.55,
              }}
            >{culturalSubtitle}</p>
          )}
          {materialChips.length > 0 && (
            <div className="mfd-tags" style={{ marginTop: '0.75rem' }}>
              {materialChips.map((t, ti) => (
                <span key={ti} className="mfd-tag">{t}</span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </Reveal>
  );
};

export default ProjectsIndexPage;
