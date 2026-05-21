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
import { toast } from 'sonner';
import api from '../../lib/api';
import ConfirmCinematicDialog from '../../components/ConfirmCinematicDialog';
import './inspirations.css';
import './supplier-catalog.css';
import './studio-collections.css';
import './brand-form.css';
import { useT } from '../../i18n/useT';

const StudioCollectionsPage = () => {
  const { t } = useT();
  const [catalogs, setCatalogs] = useState([]);
  const [brands, setBrands]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [confirmDel, setConfirmDel] = useState(null);  // catalog to delete

  const reload = () => {
    setLoading(true);
    Promise.all([
      api.get('/api/inspirations/catalogs'),
      api.get('/api/inspirations/registry/brands?limit=50'),
    ]).then(([rc, rb]) => {
      setCatalogs(rc.data?.items || []);
      setBrands(rb.data?.items || []);
    }).finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const handleDelete = async () => {
    if (!confirmDel) return;
    try {
      await api.delete(`/api/inspirations/catalogs/${confirmDel.id}`);
      toast.success(`Catalogo "${confirmDel.collection || 'senza titolo'}" rimosso`);
      setConfirmDel(null);
      reload();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Impossibile rimuovere il catalogo');
      setConfirmDel(null);
    }
  };

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
          <h1 className="sc-page__title">{t('inspirations.studio_collections.archivio_curatoriale_dello_studio')}</h1>
          <p className="sc-page__subtitle">
            Tutti i produttori e le collezioni che lo studio ha aggiunto al proprio
            registro. {totalImported > 0 && <> Hai già <strong>{totalImported}</strong> Product Inspirations™ archiviate.</>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/inspirations" className="ins-cta-secondary"
                data-testid="sc-import-catalog">
            <Icons.Plus size={12} /> Importa catalogo fornitore
          </Link>
          <Link to="/inspirations" className="ins-cta-secondary"
                data-testid="sc-back-inspirations">
            <Icons.ArrowLeft size={12} /> Torna a Inspirations™
          </Link>
        </div>
      </header>

      {loading && <p className="sc-empty">Carico l'archivio curatoriale…</p>}
      {!loading && grouped.length === 0 && (
        <div className="sc-empty">
          <Icons.Package size={28} strokeWidth={1.3} />
          <p>{t('inspirations.studio_collections.nessuna_collezione_importata_inizia_caricando_un_c')}</p>
          <Link to="/inspirations" className="ins-cta-primary"><Icons.Plus size={13} /> Importa il primo catalogo</Link>
        </div>
      )}

      <div className="sc-grid">
        {grouped.map((g) => (
          <BrandGroup key={g.brand_name} group={g} onAskDelete={setConfirmDel} />
        ))}
      </div>

      <ConfirmCinematicDialog
        open={!!confirmDel}
        title={`Rimuovere il catalogo "${confirmDel?.collection || 'senza titolo'}"?`}
        body="Il catalogo verrà rimosso dall'archivio dello studio. I prodotti già importati nei Product Inspirations™ restano archiviati."
        confirmLabel="Rimuovi catalogo"
        tone="destructive"
        onConfirm={handleDelete}
        onClose={() => setConfirmDel(null)}
        testid="sc-delete-confirm"
      />
    </div>
  );
};

const BrandGroup = ({ group, onAskDelete }) => (
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
        <article key={c.id} className="sc-catalog" data-testid={`sc-catalog-${c.id}`}
                 style={{ position: 'relative' }}>
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
          <div className="bm-actions"
               style={{ position: 'absolute', top: 10, right: 10, opacity: 0.55, transition: 'opacity .18s' }}
               onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
               onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.55; }}>
            <button type="button"
                    className="bm-action-btn bm-action-btn--danger"
                    onClick={() => onAskDelete?.(c)}
                    data-testid={`sc-delete-${c.id}`}
                    title="Rimuovi catalogo"
                    style={{ width: 26, height: 26 }}>
              <Icons.Trash2 size={11} strokeWidth={1.4} />
            </button>
          </div>
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
