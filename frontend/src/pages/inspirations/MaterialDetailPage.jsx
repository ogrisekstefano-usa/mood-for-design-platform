/**
 * ITER204-B · Material Detail™
 *
 * Route: /inspirations/materials/:materialId
 *
 * Accepts both canonical and detected entity IDs (backend resolves).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as Icons from 'lucide-react';

import EN from '../../lib/entityNavigationApi';
import SaveToLibraryButton from '../../components/studio-library/SaveToLibraryButton';
import { useBlueprint } from '../../contexts/BlueprintContext';
import './entity-detail.css';

export default function MaterialDetailPage() {
  const { materialId } = useParams();
  const { t } = useBlueprint();
  const [data, setData] = useState(null);

  const reload = useCallback(async () => {
    try {
      const r = await EN.materialDetail(materialId);
      setData(r.data);
    } catch (e) {
      setData({ _error: e?.response?.data?.detail || 'fetch failed' });
    }
  }, [materialId]);

  useEffect(() => { reload(); }, [reload]);

  if (data === null) {
    return (
      <div className="ed-page" data-testid="material-detail-loading">
        <div className="ed-state">{t('common.loading', null, 'Sto caricando…')}</div>
      </div>
    );
  }
  if (data?._error) {
    return (
      <div className="ed-page" data-testid="material-detail-error">
        <div className="ed-state">
          {t('entity.material.not_found', null, 'Materiale non trovato')}
        </div>
      </div>
    );
  }

  const { material, brands, collections, products, counts, saved, states } = data;

  return (
    <div className="ed-page" data-testid="material-detail-page">
      <nav className="ed-breadcrumb" data-testid="material-breadcrumb">
        <Link to="/studio-library">Studio Library</Link>
        <span className="ed-breadcrumb__sep">·</span>
        <span className="ed-breadcrumb__current">{material.name}</span>
      </nav>

      <header className="ed-hero">
        <div className="ed-hero__media" data-testid="material-hero-media">
          <span className="ed-hero__placeholder">
            <Icons.Palette size={80} strokeWidth={1} />
          </span>
        </div>
        <div className="ed-hero__body">
          <p className="ed-hero__eyebrow">Material</p>
          <h1 className="ed-hero__title" data-testid="material-title">{material.name}</h1>
          {material.description && (
            <p className="ed-hero__subtitle">{material.description}</p>
          )}
          {material.aliases?.length > 0 && (
            <div className="ed-mood-dna" data-testid="material-aliases">
              {material.aliases.slice(0, 6).map((a, i) => (
                <span key={i} className="ed-mood-pill">{a}</span>
              ))}
            </div>
          )}
          <div className="ed-hero__meta">
            <span>
              <span className="ed-hero__meta-num">{counts.brands}</span>
              {t('entity.material.brands_label', null, 'brand')}
            </span>
            <span>
              <span className="ed-hero__meta-num">{counts.collections}</span>
              {t('entity.material.collections_label', null, 'collezioni')}
            </span>
            <span>
              <span className="ed-hero__meta-num">{counts.products}</span>
              {t('entity.material.products_label', null, 'prodotti')}
            </span>
          </div>
          <div className="ed-hero__actions">
            <SaveToLibraryButton
              entityType="material"
              entityId={materialId}
              initialSaved={saved}
              sourceType="brand_atlas"
              testId="material-save-to-library"
            />
          </div>
        </div>
      </header>

      {/* Brands */}
      <section className="ed-section" data-testid="material-section-brands">
        <div className="ed-section__head">
          <div>
            <p className="ed-section__eyebrow">Brands Using This Material</p>
            <h2 className="ed-section__title">
              {counts.brands > 0
                ? `${counts.brands} ${t('entity.material.brands_section', null, 'brand collegati')}`
                : t('entity.material.no_brands_title', null, 'Nessun brand collegato')}
            </h2>
          </div>
        </div>
        {states.no_brands ? (
          <div className="ed-empty" data-testid="material-brands-empty">
            {t('entity.material.no_brands', null, 'Materiale ancora non collegato a nessun brand indicizzato.')}
          </div>
        ) : (
          <div className="ed-grid ed-grid--brands" data-testid="material-brands-grid">
            {brands.map((b) => (
              <Link
                key={b.id}
                to={`/inspirations/brands/${b.id}`}
                className="ed-card"
                data-testid={`material-brand-${b.id}`}
              >
                <div className="ed-card__media">
                  {b.hero_image_url || b.logo_url
                    ? <img src={b.hero_image_url || b.logo_url} alt="" loading="lazy" />
                    : <Icons.Building2 size={28} strokeWidth={1.2} />}
                </div>
                <div className="ed-card__body">
                  <h3 className="ed-card__name">{b.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Collections */}
      <section className="ed-section" data-testid="material-section-collections">
        <div className="ed-section__head">
          <div>
            <p className="ed-section__eyebrow">Collections Using This Material</p>
            <h2 className="ed-section__title">
              {counts.collections > 0
                ? `${counts.collections} ${t('entity.material.collections_section', null, 'collezioni collegate')}`
                : t('entity.material.no_collections_title', null, 'Collezioni in indicizzazione')}
            </h2>
          </div>
        </div>
        {states.no_collections ? (
          <div className="ed-empty" data-testid="material-collections-empty">
            {t('entity.material.no_collections', null, 'Nessuna collezione collegata a questo materiale.')}
          </div>
        ) : (
          <div className="ed-grid ed-grid--products" data-testid="material-collections-grid">
            {collections.map((c) => (
              <Link
                key={c.id}
                to={`/inspirations/brands/${c.brand_id}/collections/${c.id}`}
                className="ed-card"
                data-testid={`material-collection-${c.id}`}
              >
                <div className="ed-card__media">
                  <Icons.Boxes size={28} strokeWidth={1.2} />
                </div>
                <div className="ed-card__body">
                  <h3 className="ed-card__name">{c.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Products */}
      <section className="ed-section" data-testid="material-section-products">
        <div className="ed-section__head">
          <div>
            <p className="ed-section__eyebrow">Products Using This Material</p>
            <h2 className="ed-section__title">
              {counts.products > 0
                ? `${counts.products} ${t('entity.material.products_section', null, 'prodotti collegati')}`
                : t('entity.material.no_products_title', null, 'Prodotti in indicizzazione')}
            </h2>
          </div>
        </div>
        {states.no_products ? (
          <div className="ed-empty" data-testid="material-products-empty">
            {t('entity.material.no_products', null, 'Nessun prodotto collegato a questo materiale.')}
          </div>
        ) : (
          <div className="ed-grid ed-grid--products" data-testid="material-products-grid">
            {products.map((p) => (
              <Link
                key={p.id}
                to={`/inspirations/brands/${p.brand_id}/products/${p.id}`}
                className="ed-card"
                data-testid={`material-product-${p.id}`}
              >
                <div className="ed-card__media">
                  {p.image_url
                    ? <img src={p.image_url} alt="" loading="lazy" />
                    : <Icons.Package size={28} strokeWidth={1.2} />}
                </div>
                <div className="ed-card__body">
                  <h3 className="ed-card__name">{p.name}</h3>
                  {p.category && <p className="ed-card__sub">{p.category}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
