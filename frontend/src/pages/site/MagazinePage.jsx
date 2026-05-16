// ──────────────────────────────────────────────────────────────────────
// MOOD for DESIGN™ — Magazine list page (Phase Y.1)
// Editorial masonry — NOT a blog template.
// data-surface="storefront" (public, anonymous-friendly).
// ──────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import { SiteProvider, useSite } from '../../site/SiteContext';
import { navigationContent } from '../../site/content/navigation';
import { tenantConfig } from '../../site/content/tenant';
import '../../site/site.css';
import './magazine.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const COPY = {
  it: { eyebrow: 'MAGAZINE', title: 'Riferimenti progettuali curati', body: 'Atmosfere, materiali e palette selezionate per ispirare il tuo prossimo progetto.', readMin: 'min di lettura', empty: 'Stiamo curando i prossimi articoli.' },
  en: { eyebrow: 'MAGAZINE', title: 'Curated design references', body: 'Atmospheres, materials and palettes selected to inspire your next project.', readMin: 'min read', empty: 'Curating the next articles.' },
  fr: { eyebrow: 'MAGAZINE', title: 'Références de design curatées', body: 'Atmosphères, matériaux et palettes sélectionnés.', readMin: 'min de lecture', empty: 'Nous préparons les prochains articles.' },
  de: { eyebrow: 'MAGAZINE', title: 'Kuratierte Design-Referenzen', body: 'Atmosphären, Materialien und Paletten ausgewählt für Ihr nächstes Projekt.', readMin: 'min Lesezeit', empty: 'Die nächsten Artikel werden kuratiert.' },
  es: { eyebrow: 'MAGAZINE', title: 'Referencias de diseño seleccionadas', body: 'Atmósferas, materiales y paletas para inspirar tu próximo proyecto.', readMin: 'min de lectura', empty: 'Curando los próximos artículos.' },
};

const MagazineListInner = () => {
  const { locale } = useSite();
  const tenantSlug = tenantConfig?.slug || 'mood-demo-studio-81a09e';
  const [state, setState] = useState({ loading: true, articles: [] });
  const c = COPY[locale] || COPY.it;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await axios.get(`${BACKEND_URL}/api/magazine/public/${encodeURIComponent(tenantSlug)}/articles`);
        if (alive) setState({ loading: false, articles: r.data?.articles || [] });
      } catch (_) {
        if (alive) setState({ loading: false, articles: [] });
      }
    })();
    return () => { alive = false; };
  }, [tenantSlug]);

  const featured = state.articles[0];
  const rest = state.articles.slice(1);

  useEffect(() => {
    document.title = `${c.eyebrow} · ${c.title}`;
  }, [c]);

  return (
    <div className="mfd-site mfd-magazine" data-surface="storefront" data-testid="magazine-page">
      <header className="mfd-magazine__nav">
        <Link to="/" className="mfd-magazine__brand">
          <img src={navigationContent.brand.logoSrc} alt="MOOD for DESIGN" />
        </Link>
        <Link to="/start-project" className="mfd-magazine__cta-mini">START PROJECT <ArrowUpRight size={12} /></Link>
      </header>

      <section className="mfd-magazine__hero" data-testid="magazine-hero">
        <p className="mfd-magazine__eyebrow">{c.eyebrow}</p>
        <h1 className="mfd-magazine__h1">{c.title}</h1>
        <p className="mfd-magazine__h1-body">{c.body}</p>
      </section>

      {state.loading && (
        <p className="mfd-magazine__empty" data-testid="magazine-loading">Loading…</p>
      )}

      {!state.loading && state.articles.length === 0 && (
        <p className="mfd-magazine__empty" data-testid="magazine-empty">{c.empty}</p>
      )}

      {featured && (
        <article className="mfd-magazine__featured" data-testid="magazine-featured">
          <Link to={`/magazine/${featured.slug}`} className="mfd-magazine__featured-link">
            <div className="mfd-magazine__featured-media">
              <img src={featured.hero_url || featured.cover_url} alt="" loading="lazy" />
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
                <img src={a.cover_url || a.hero_url} alt="" loading="lazy" />
              </div>
              <div className="mfd-magazine__card-copy">
                <p className="mfd-magazine__kicker">{a.locale_content?.[locale]?.kicker || a.locale_content?.it?.kicker}</p>
                <h3 className="mfd-magazine__card-title">{a.locale_content?.[locale]?.title || a.locale_content?.it?.title}</h3>
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
