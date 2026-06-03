/**
 * ITER204-B · Product Detail™
 *
 * Route: /inspirations/brands/:brandId/products/:productId
 *
 * The premium product detail page — hero, gallery, materials, designer,
 * related products. Replaces the legacy ProductGalleryPage flow as the
 * canonical entry point from Brand Embassy / Collection Detail.
 *
 * (ProductGalleryPage at /inspirations/products/:productId is kept as
 * the Visual Atelier composition tool — different surface.)
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as Icons from 'lucide-react';

import EN from '../../lib/entityNavigationApi';
import SaveToLibraryButton from '../../components/studio-library/SaveToLibraryButton';
import { useBlueprint } from '../../contexts/BlueprintContext';
import './entity-detail.css';

export default function ProductDetailPage() {
  const { brandId, productId } = useParams();
  const { t } = useBlueprint();
  const [data, setData] = useState(null);
  const [activeImage, setActiveImage] = useState(0);

  const reload = useCallback(async () => {
    try {
      const r = await EN.productDetail(brandId, productId);
      setData(r.data);
      setActiveImage(0);
    } catch (e) {
      setData({ _error: e?.response?.data?.detail || 'fetch failed' });
    }
  }, [brandId, productId]);

  useEffect(() => { reload(); }, [reload]);

  if (data === null) {
    return (
      <div className="ed-page" data-testid="product-detail-loading">
        <div className="ed-state">{t('common.loading', null, 'Sto caricando…')}</div>
      </div>
    );
  }
  if (data?._error) {
    return (
      <div className="ed-page" data-testid="product-detail-error">
        <div className="ed-state">
          {t('entity.product.not_found', null, 'Prodotto non trovato')}
        </div>
      </div>
    );
  }

  const { product, brand, collection, images, designers, related_products,
          saved, states } = data;
  const heroImg = images?.[activeImage]?.url || product.hero_image_url;

  return (
    <div className="ed-page" data-testid="product-detail-page">
      <nav className="ed-breadcrumb" data-testid="product-breadcrumb">
        <Link to="/inspirations/brands">Brand Atlas</Link>
        <span className="ed-breadcrumb__sep">·</span>
        <Link to={`/inspirations/brands/${brand?.id || brandId}`}>{brand?.name || '—'}</Link>
        {collection && (
          <>
            <span className="ed-breadcrumb__sep">·</span>
            <Link to={`/inspirations/brands/${brand?.id || brandId}/collections/${collection.id}`}>
              {collection.name}
            </Link>
          </>
        )}
        <span className="ed-breadcrumb__sep">·</span>
        <span className="ed-breadcrumb__current">{product.name}</span>
      </nav>

      <header className="ed-hero">
        <div className="ed-hero__media" data-testid="product-hero-media">
          {heroImg ? (
            <img src={heroImg} alt="" loading="eager" draggable={false} />
          ) : (
            <span className="ed-hero__placeholder">
              <Icons.Package size={48} strokeWidth={1.2} />
            </span>
          )}
        </div>
        <div className="ed-hero__body">
          <p className="ed-hero__eyebrow">
            Product · {brand?.name}{collection ? ` · ${collection.name}` : ''}
          </p>
          <h1 className="ed-hero__title" data-testid="product-title">{product.name}</h1>
          {product.description && (
            <p className="ed-hero__subtitle">{product.description}</p>
          )}
          {product.category && (
            <div className="ed-mood-dna">
              <span className="ed-mood-pill" data-testid="product-category">
                {product.category}
              </span>
              {(product.materials || []).slice(0, 5).map((m, i) => (
                <span key={i} className="ed-mood-pill">{m}</span>
              ))}
            </div>
          )}

          <div className="ed-hero__meta">
            <span>
              <span className="ed-hero__meta-num">{images.length}</span>
              {t('entity.product.images_label', null, 'immagini')}
            </span>
            <span>
              <span className="ed-hero__meta-num">{(product.materials || []).length}</span>
              {t('entity.product.materials_label', null, 'materiali')}
            </span>
            <span>
              <span className="ed-hero__meta-num">{designers.length}</span>
              {t('entity.product.designers_label', null, 'designer')}
            </span>
          </div>
          <div className="ed-hero__actions">
            <SaveToLibraryButton
              entityType="product"
              entityId={productId}
              initialSaved={saved}
              sourceType="brand_atlas"
              testId="product-save-to-library"
            />
          </div>
        </div>
      </header>

      {/* ── Visual Gallery ─────────────────────────────────────────── */}
      <section className="ed-section" data-testid="product-section-gallery">
        <div className="ed-section__head">
          <div>
            <p className="ed-section__eyebrow">Visual Gallery</p>
            <h2 className="ed-section__title">
              {images.length > 0
                ? `${images.length} ${t('entity.product.images_in_set', null, 'immagini disponibili')}`
                : t('entity.product.images_indexing_title', null, 'Immagini in indicizzazione')}
            </h2>
          </div>
        </div>
        {states.images_indexing ? (
          <div className="ed-empty" data-testid="product-images-empty">
            {t('entity.product.images_indexing', null, 'Le immagini del prodotto sono in fase di indicizzazione.')}
          </div>
        ) : (
          <div className="ed-gallery" data-testid="product-gallery">
            {images.map((img, i) => (
              <button
                type="button"
                key={img.id}
                className="ed-gallery__tile"
                onClick={() => setActiveImage(i)}
                data-testid={`product-gallery-tile-${i}`}
                style={i === activeImage
                  ? { outline: '2px solid var(--accent-primary, #5dd9c4)', outlineOffset: 2 }
                  : undefined}
              >
                <img src={img.url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Materials ──────────────────────────────────────────────── */}
      {(product.materials || []).length > 0 && (
        <section className="ed-section" data-testid="product-section-materials">
          <div className="ed-section__head">
            <div>
              <p className="ed-section__eyebrow">Material Intelligence</p>
              <h2 className="ed-section__title">
                {(product.materials || []).length} {t('entity.product.materials_section', null, 'materiali usati')}
              </h2>
            </div>
          </div>
          <div className="ed-grid ed-grid--materials" data-testid="product-materials-grid">
            {(product.materials || []).map((m, i) => (
              <Link
                key={i}
                to={`/inspirations/materials/${encodeURIComponent(m)}`}
                className="ed-card ed-card--material"
                data-testid={`product-material-${i}`}
              >
                <div className="ed-card__media">
                  <Icons.Palette size={22} strokeWidth={1.3} />
                </div>
                <div className="ed-card__body">
                  <h3 className="ed-card__name">{m}</h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Designers ──────────────────────────────────────────────── */}
      {designers.length > 0 && (
        <section className="ed-section" data-testid="product-section-designers">
          <div className="ed-section__head">
            <div>
              <p className="ed-section__eyebrow">Design DNA</p>
              <h2 className="ed-section__title">
                {t('entity.product.design_dna_title', null, 'Designer collegati')}
              </h2>
            </div>
          </div>
          <div className="ed-grid ed-grid--designers" data-testid="product-designers-grid">
            {designers.map((d) => (
              <Link
                key={d.id}
                to={`/inspirations/designers/${d.id}`}
                className="ed-card ed-card--designer"
                data-testid={`product-designer-${d.id}`}
              >
                <div className="ed-card__avatar">
                  {(d.name || '').split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase()}
                </div>
                <div className="ed-card__body">
                  <h3 className="ed-card__name">{d.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Specs (when present) ───────────────────────────────────── */}
      {(product.dimensions || (product.finishes || []).length > 0) && (
        <section className="ed-section" data-testid="product-section-specs">
          <div className="ed-section__head">
            <div>
              <p className="ed-section__eyebrow">Specification Ready</p>
              <h2 className="ed-section__title">
                {t('entity.product.specs_title', null, 'Dettagli tecnici')}
              </h2>
            </div>
          </div>
          <div className="ed-specs">
            {product.dimensions && (
              <div>
                <p className="ed-spec__label">
                  {t('entity.product.dimensions', null, 'Dimensioni')}
                </p>
                <p className="ed-spec__value">{product.dimensions}</p>
              </div>
            )}
            {(product.finishes || []).length > 0 && (
              <div>
                <p className="ed-spec__label">
                  {t('entity.product.finishes', null, 'Finiture')}
                </p>
                <p className="ed-spec__value">{product.finishes.join(' · ')}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Related Products ───────────────────────────────────────── */}
      {related_products.length > 0 && (
        <section className="ed-section" data-testid="product-section-related">
          <div className="ed-section__head">
            <div>
              <p className="ed-section__eyebrow">Related Products</p>
              <h2 className="ed-section__title">
                {t('entity.product.related_title', null, 'Stessa collezione')}
              </h2>
            </div>
          </div>
          <div className="ed-grid ed-grid--products" data-testid="product-related-grid">
            {related_products.map((p) => (
              <Link
                key={p.id}
                to={`/inspirations/brands/${brand?.id || brandId}/products/${p.id}`}
                className="ed-card"
                data-testid={`product-related-${p.id}`}
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
        </section>
      )}
    </div>
  );
}
