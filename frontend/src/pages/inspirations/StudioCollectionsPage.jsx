/**
 * Studio Collections™ — archive view grouped by brand.
 *
 * Read-only "archivio curatoriale dello studio" — mostra tutti i Brand Registry™
 * cataloghi del tenant, raggruppati per brand. NON è un PIM: è una vista di
 * libreria curatoriale per ricordare quali brand sono già nel sistema.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import api from '../../lib/api';
import './inspirations.css';
import './supplier-catalog.css';
import './studio-collections.css';

const StudioCollectionsPage = () => {
  const [catalogs, setCatalogs] = useState([]);
  const [brands, setBrands]     = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/inspirations/catalogs'),
      api.get('/api/inspirations/registry/brands?limit=50'),
    ]).then(([rc, rb]) => {
      setCatalogs(rc.data?.items || []);
      setBrands(rb.data?.items || []);
    }).finally(() => setLoading(false));
  }, []);

  // Group catalogs by brand
  const grouped = useMemo(() => {
    const map = new Map();
    catalogs.forEach((c) => {
      const key = c.brand_id || c.brand || '_unknown';
      if (!map.has(key)) {
        const meta = brands.find((b) => b.id === c.brand_id) || null;
        map.set(key, {
          brand_name: c.brand || meta?.name || 'Senza produttore',
          brand_meta: meta,
          catalogs: [],
        });
      }
      map.get(key).catalogs.push(c);
    });
    return Array.from(map.values()).sort((a, b) => a.brand_name.localeCompare(b.brand_name));
  }, [catalogs, brands]);

  const totalImported = catalogs.reduce((s, c) => s + (c.imported_count || 0), 0);

  return (
    <div className="sc-page" data-testid="studio-collections-page">
      <header className="sc-page__head">
        <div>
          <p className="ins-eyebrow"><Icons.Library size={11} /> Studio Collections™</p>
          <h1 className="sc-page__title">Archivio curatoriale dello studio</h1>
          <p className="sc-page__subtitle">
            Tutti i produttori e le collezioni che lo studio ha aggiunto al proprio
            registro. {totalImported > 0 && <> Hai già <strong>{totalImported}</strong> Product Inspirations™ archiviate.</>}
          </p>
        </div>
        <Link to="/inspirations" className="ins-cta-secondary"
              data-testid="sc-back-inspirations">
          <Icons.ArrowLeft size={12} /> Torna a Inspirations™
        </Link>
      </header>

      {loading && <p className="sc-empty">Carico l'archivio curatoriale…</p>}
      {!loading && grouped.length === 0 && (
        <div className="sc-empty">
          <Icons.Package size={28} strokeWidth={1.3} />
          <p>Nessuna collezione importata. Inizia caricando un catalogo fornitore.</p>
          <Link to="/inspirations" className="ins-cta-primary"><Icons.Plus size={13} /> Importa il primo catalogo</Link>
        </div>
      )}

      <div className="sc-grid">
        {grouped.map((g) => (
          <BrandGroup key={g.brand_name} group={g} />
        ))}
      </div>
    </div>
  );
};

const BrandGroup = ({ group }) => (
  <section className="sc-brand" data-testid={`sc-brand-${(group.brand_meta?.slug || group.brand_name).toLowerCase()}`}>
    <header className="sc-brand__head">
      <div>
        <h2 className="sc-brand__name">{group.brand_name}</h2>
        {group.brand_meta && (
          <p className="sc-brand__meta">
            {group.brand_meta.luxury_tier && <em>{group.brand_meta.luxury_tier}</em>}
            {group.brand_meta.category && <> · {group.brand_meta.category}</>}
            {group.brand_meta.country && <> · {group.brand_meta.country}</>}
          </p>
        )}
      </div>
      <span className="sc-brand__count">
        {group.catalogs.length} catalog{group.catalogs.length === 1 ? 'o' : 'hi'} ·
        {' '}{group.catalogs.reduce((s, c) => s + (c.imported_count || 0), 0)} prodotti
      </span>
    </header>
    <div className="sc-catalogs">
      {group.catalogs.map((c) => (
        <article key={c.id} className="sc-catalog" data-testid={`sc-catalog-${c.id}`}>
          <header>
            <p className="sc-catalog__title">
              {c.collection || 'Catalogo senza collezione'}
              {c.catalog_year && <span className="sc-catalog__year"> · {c.catalog_year}</span>}
            </p>
            <span className={`sc-status sc-status--${c.status}`}>{statusLabel(c.status)}</span>
          </header>
          <p className="sc-catalog__meta">
            {c.imported_count || 0} prodotti importati · {c.candidate_count || 0} candidati totali
          </p>
        </article>
      ))}
    </div>
  </section>
);

const statusLabel = (s) => ({
  draft:      'Bozza',
  extracting: 'Lettura in corso',
  review:     'In revisione',
  imported:   'Archiviato',
  archived:   'Storico',
}[s] || s);

export default StudioCollectionsPage;
