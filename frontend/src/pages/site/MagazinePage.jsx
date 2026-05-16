// ──────────────────────────────────────────────────────────────────────
// MOOD for DESIGN™ — Magazine list page (Phase Y.1 + Y.1 EXT)
// Editorial discovery — multi-vertical chips, reading time, masonry.
// Not a blog template, not an admin grid.
// data-surface="storefront"
// ──────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import { SiteProvider, useSite } from '../../site/SiteContext';
import { navigationContent } from '../../site/content/navigation';
import { tenantConfig } from '../../site/content/tenant';
import '../../site/site.css';
import './magazine.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const COPY = {
  it: { eyebrow: 'MAGAZINE', title: 'Riferimenti progettuali curati',
        body: 'Atmosfere, materiali e palette selezionate per ispirare il tuo prossimo progetto.',
        readMin: 'min di lettura', empty: 'Stiamo curando i prossimi articoli.',
        f_all: 'Tutto', f_categories: 'Verticali', f_reading: 'Tempo di lettura',
        f_under3: '< 3 min', f_36: '3–6 min', f_6plus: '6+ min',
        clear: 'Reset', results: 'risultati', cat_label: { residential: 'Residenza', hospitality: 'Hospitality', retail: 'Retail', workspace: 'Workspace', outdoor: 'Outdoor', materials: 'Materiali', atmospheres: 'Atmosfere', lighting: 'Illuminazione', commercial: 'Commerciale', other: 'Altro' } },
  en: { eyebrow: 'MAGAZINE', title: 'Curated design references',
        body: 'Atmospheres, materials and palettes selected to inspire your next project.',
        readMin: 'min read', empty: 'Curating the next articles.',
        f_all: 'All', f_categories: 'Verticals', f_reading: 'Reading time',
        f_under3: '< 3 min', f_36: '3–6 min', f_6plus: '6+ min',
        clear: 'Reset', results: 'results', cat_label: { residential: 'Residential', hospitality: 'Hospitality', retail: 'Retail', workspace: 'Workspace', outdoor: 'Outdoor', materials: 'Materials', atmospheres: 'Atmospheres', lighting: 'Lighting', commercial: 'Commercial', other: 'Other' } },
  fr: { eyebrow: 'MAGAZINE', title: 'Références de design curatées',
        body: 'Atmosphères, matériaux et palettes sélectionnés.',
        readMin: 'min de lecture', empty: 'Nous préparons les prochains articles.',
        f_all: 'Tout', f_categories: 'Verticales', f_reading: 'Temps de lecture',
        f_under3: '< 3 min', f_36: '3–6 min', f_6plus: '6+ min',
        clear: 'Reset', results: 'résultats', cat_label: {} },
};

const READING_BUCKETS = {
  short:  { min: 0, max: 2,    key: 'f_under3' },
  medium: { min: 3, max: 6,    key: 'f_36' },
  long:   { min: 7, max: 9999, key: 'f_6plus' },
};

const MagazineListInner = () => {
  const { locale } = useSite();
  const tenantSlug = tenantConfig?.slug || 'mood-demo-studio-81a09e';
  const c = COPY[locale] || COPY.it;
  const [filters, setFilters] = useState({ category: null, tag: null, reading: null });
  const [taxonomy, setTaxonomy] = useState({ categories: [], tags: [] });
  const [state, setState] = useState({ loading: true, articles: [] });

  // Load taxonomy once (chip universe is data-driven, never hardcoded)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await axios.get(`${BACKEND_URL}/api/magazine/public/${encodeURIComponent(tenantSlug)}/taxonomy`);
        if (alive) setTaxonomy(r.data || { categories: [], tags: [] });
      } catch (_) { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [tenantSlug]);

  // Re-fetch articles when filters change
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    (async () => {
      try {
        const params = {};
        if (filters.category) params.category = filters.category;
        if (filters.tag) params.tag = filters.tag;
        if (filters.reading) {
          const b = READING_BUCKETS[filters.reading];
          if (b) { params.reading_min = b.min; params.reading_max = b.max; }
        }
        const r = await axios.get(`${BACKEND_URL}/api/magazine/public/${encodeURIComponent(tenantSlug)}/articles`, { params });
        if (alive) setState({ loading: false, articles: r.data?.articles || [] });
      } catch (_) {
        if (alive) setState({ loading: false, articles: [] });
      }
    })();
    return () => { alive = false; };
  }, [tenantSlug, filters]);

  useEffect(() => { document.title = `${c.eyebrow} · ${c.title}`; }, [c]);

  const hasActive = !!(filters.category || filters.tag || filters.reading);
  const featured = !hasActive && state.articles[0];
  const rest = hasActive ? state.articles : state.articles.slice(1);

  // Limit visible tag chips so the bar never explodes
  const visibleTags = useMemo(
    () => (taxonomy.tags || []).slice(0, 8),
    [taxonomy.tags],
  );

  const setOne = (k, v) => setFilters((f) => ({ ...f, [k]: f[k] === v ? null : v }));
  const reset = () => setFilters({ category: null, tag: null, reading: null });

  const catLabel = (slug) => (c.cat_label && c.cat_label[slug]) || slug.replace(/-/g, ' ');

  return (
    <div className="mfd-site mfd-magazine" data-surface="storefront" data-testid="magazine-page">
      <header className="mfd-magazine__nav">
        <Link to="/" className="mfd-magazine__brand">
          <img src={navigationContent.brand.logoSrc} alt="MOOD for DESIGN" />
        </Link>
        <Link to="/start-project" className="mfd-magazine__cta-mini" data-testid="magazine-start-project">
          START PROJECT <ArrowUpRight size={12} />
        </Link>
      </header>

      <section className="mfd-magazine__hero" data-testid="magazine-hero">
        <p className="mfd-magazine__eyebrow">{c.eyebrow}</p>
        <h1 className="mfd-magazine__h1">{c.title}</h1>
        <p className="mfd-magazine__h1-body">{c.body}</p>
      </section>

      {/* ── Filter bar ─────────────────────────────────────────────── */}
      {(taxonomy.categories?.length > 0 || taxonomy.tags?.length > 0) && (
        <div className="mfd-magazine__filters" data-testid="magazine-filters">
          {taxonomy.categories?.length > 0 && (
            <div className="mfd-magazine__filters-row" data-testid="magazine-filters-categories">
              <span className="mfd-magazine__filters-label">{c.f_categories}</span>
              <button type="button"
                      className={`mfd-magazine__chip ${!filters.category ? 'is-active' : ''}`}
                      onClick={() => setFilters((f) => ({ ...f, category: null }))}
                      data-testid="magazine-filter-cat-all">
                {c.f_all}
              </button>
              {taxonomy.categories.map((cat) => (
                <button key={cat} type="button"
                        className={`mfd-magazine__chip ${filters.category === cat ? 'is-active' : ''}`}
                        onClick={() => setOne('category', cat)}
                        data-testid={`magazine-filter-cat-${cat}`}>
                  {catLabel(cat)}
                </button>
              ))}
              <button type="button"
                      className={`mfd-magazine__chip ${filters.reading === 'short' ? 'is-active' : ''}`}
                      onClick={() => setOne('reading', 'short')}
                      data-testid="magazine-filter-read-short">{c.f_under3}</button>
              <button type="button"
                      className={`mfd-magazine__chip ${filters.reading === 'medium' ? 'is-active' : ''}`}
                      onClick={() => setOne('reading', 'medium')}
                      data-testid="magazine-filter-read-medium">{c.f_36}</button>
              <button type="button"
                      className={`mfd-magazine__chip ${filters.reading === 'long' ? 'is-active' : ''}`}
                      onClick={() => setOne('reading', 'long')}
                      data-testid="magazine-filter-read-long">{c.f_6plus}</button>
              {hasActive && (
                <button type="button" className="mfd-magazine__chip-clear" onClick={reset} data-testid="magazine-filter-reset">
                  {c.clear} ×
                </button>
              )}
            </div>
          )}
          {visibleTags.length > 0 && (
            <div className="mfd-magazine__filters-row" data-testid="magazine-filters-tags">
              <span className="mfd-magazine__filters-label">TAGS</span>
              {visibleTags.map((t) => (
                <button key={t} type="button"
                        className={`mfd-magazine__chip ${filters.tag === t ? 'is-active' : ''}`}
                        onClick={() => setOne('tag', t)}
                        data-testid={`magazine-filter-tag-${t}`}>
                  {t.replace(/-/g, ' ')}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!state.loading && (
        <p className="mfd-magazine__results-count" data-testid="magazine-results-count">
          {state.articles.length} {c.results}
        </p>
      )}

      {state.loading && (
        <p className="mfd-magazine__empty" data-testid="magazine-loading">Loading…</p>
      )}

      {!state.loading && state.articles.length === 0 && (
        <p className="mfd-magazine__empty" data-testid="magazine-empty">{c.empty}</p>
      )}

      {featured && (
        <article className="mfd-magazine__featured" data-testid="magazine-featured">
          <Link to={`/magazine/${featured.slug}`} className="mfd-magazine__featured-link" data-testid={`magazine-featured-${featured.slug}`}>
            <div className="mfd-magazine__featured-media">
              {(featured.hero_url || featured.cover_url) && (
                <img src={featured.hero_url || featured.cover_url} alt="" loading="lazy" />
              )}
            </div>
            <div className="mfd-magazine__featured-copy">
              <p className="mfd-magazine__kicker">{featured.locale_content?.[locale]?.kicker || featured.locale_content?.it?.kicker}</p>
              <h2 className="mfd-magazine__featured-title">{featured.locale_content?.[locale]?.title || featured.locale_content?.it?.title}</h2>
              <p className="mfd-magazine__featured-summary">{featured.locale_content?.[locale]?.summary || featured.locale_content?.it?.summary}</p>
              <p className="mfd-magazine__featured-meta">
                <BookOpen size={11} strokeWidth={1.5} /> {featured.reading_minutes || 4} {c.readMin}
              </p>
            </div>
          </Link>
        </article>
      )}

      {rest.length > 0 && (
        <section className="mfd-magazine__grid" data-testid="magazine-grid">
          {rest.map((a) => (
            <Link key={a.id} to={`/magazine/${a.slug}`} className="mfd-magazine__card" data-testid={`magazine-card-${a.slug}`}>
              <div className="mfd-magazine__card-media">
                {(a.cover_url || a.hero_url) && (
                  <img src={a.cover_url || a.hero_url} alt="" loading="lazy" />
                )}
              </div>
              <div className="mfd-magazine__card-copy">
                <p className="mfd-magazine__kicker">{a.locale_content?.[locale]?.kicker || a.locale_content?.it?.kicker}</p>
                <h3 className="mfd-magazine__card-title">{a.locale_content?.[locale]?.title || a.locale_content?.it?.title}</h3>
                <p className="mfd-magazine__card-meta">
                  <BookOpen size={10} strokeWidth={1.5} /> {a.reading_minutes || 4} {c.readMin}
                  {a.category_slug && (<><span className="mfd-magazine__card-meta-dot" /> {catLabel(a.category_slug)}</>)}
                </p>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
};

const MagazinePage = () => (
  <SiteProvider>
    <MagazineListInner />
  </SiteProvider>
);

export default MagazinePage;
