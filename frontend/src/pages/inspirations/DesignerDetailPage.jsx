/**
 * ITER204-B · Designer Detail™
 *
 * Route: /inspirations/designers/:designerId
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as Icons from 'lucide-react';

import EN from '../../lib/entityNavigationApi';
import SaveToLibraryButton from '../../components/studio-library/SaveToLibraryButton';
import { useBlueprint } from '../../contexts/BlueprintContext';
import './entity-detail.css';

export default function DesignerDetailPage() {
  const { designerId } = useParams();
  const { t } = useBlueprint();
  const [data, setData] = useState(null);

  const reload = useCallback(async () => {
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await EN.designerDetail(designerId);
        setData(r.data);
        return;
      } catch (e) {
        lastErr = e;
        if (e?.response?.status === 404) {
          setData({ _error: e?.response?.data?.detail || 'not_found' });
          return;
        }
        await new Promise((res) => setTimeout(res, 600 * (attempt + 1)));
      }
    }
    setData({ _error: lastErr?.response?.data?.detail || 'fetch_failed' });
  }, [designerId]);

  useEffect(() => { reload(); }, [reload]);

  if (data === null) {
    return (
      <div className="ed-page" data-testid="designer-detail-loading">
        <div className="ed-state">{t('common.loading', null, 'Sto caricando…')}</div>
      </div>
    );
  }
  if (data?._error) {
    return (
      <div className="ed-page" data-testid="designer-detail-error">
        <div className="ed-state">
          {t('entity.designer.not_found', null, 'Designer non trovato')}
        </div>
      </div>
    );
  }

  const { designer, brands, collections, products, counts, saved, states } = data;

  const initials = (designer.name || '')
    .split(/\s+/).slice(0, 2)
    .map((s) => s[0]).join('').toUpperCase();

  return (
    <div className="ed-page" data-testid="designer-detail-page">
      <nav className="ed-breadcrumb" data-testid="designer-breadcrumb">
        <Link to="/studio-library">Studio Library</Link>
        <span className="ed-breadcrumb__sep">·</span>
        <span className="ed-breadcrumb__current">{designer.name}</span>
      </nav>

      <header className="ed-hero">
        <div className="ed-hero__media" data-testid="designer-hero-media">
          <span className="ed-hero__placeholder"
                style={{
                  fontFamily: 'var(--bp-font-heading, Cormorant Garamond, Georgia, serif)',
                  fontSize: '120px',
                  fontStyle: 'italic',
                  color: 'var(--bp-text-faint, rgba(255,255,255,.18))',
                }}>
            {initials}
          </span>
        </div>
        <div className="ed-hero__body">
          <p className="ed-hero__eyebrow">
            Designer{designer.verified && <span style={{ marginLeft: 10, color: 'var(--accent-primary)' }}> · Verified</span>}
          </p>
          <h1 className="ed-hero__title" data-testid="designer-title">{designer.name}</h1>
          {designer.bio
            ? <p className="ed-hero__subtitle">{designer.bio}</p>
            : (
              <p className="ed-hero__subtitle" data-testid="designer-bio-pending"
                  style={{ fontStyle: 'italic', opacity: .65 }}>
                {t('entity.designer.bio_pending', null, 'Biografia in attesa di verifica.')}
              </p>
            )}
          <div className="ed-hero__meta">
            <span>
              <span className="ed-hero__meta-num">{counts.brands}</span>
              {t('entity.designer.brands_label', null, 'brand')}
            </span>
            <span>
              <span className="ed-hero__meta-num">{counts.collections}</span>
              {t('entity.designer.collections_label', null, 'collezioni')}
            </span>
            <span>
              <span className="ed-hero__meta-num">{counts.products}</span>
              {t('entity.designer.products_label', null, 'prodotti')}
            </span>
          </div>
          <div className="ed-hero__actions">
            <SaveToLibraryButton
              entityType="designer"
              entityId={designerId}
              initialSaved={saved}
              sourceType="brand_atlas"
              testId="designer-save-to-library"
            />
          </div>
        </div>
      </header>

      {/* Brands */}
      <section className="ed-section" data-testid="designer-section-brands">
        <div className="ed-section__head">
          <div>
            <p className="ed-section__eyebrow">Brands</p>
            <h2 className="ed-section__title">
              {counts.brands > 0
                ? t('entity.designer.brands_section', null, 'Brand collegati')
                : t('entity.designer.no_brands_title', null, 'Nessun brand collegato')}
            </h2>
          </div>
        </div>
        {states.no_brands ? (
          <div className="ed-empty" data-testid="designer-brands-empty">
            {t('entity.designer.no_brands', null, 'Designer ancora non attribuito a un brand.')}
          </div>
        ) : (
          <div className="ed-grid ed-grid--brands" data-testid="designer-brands-grid">
            {brands.map((b) => (
              <Link
                key={b.id}
                to={`/inspirations/brands/${b.id}`}
                className="ed-card"
                data-testid={`designer-brand-${b.id}`}
              >
                <div className="ed-card__media">
                  {b.hero_image_url || b.logo_url
                    ? <img src={b.hero_image_url || b.logo_url} alt="" loading="lazy" />
                    : <Icons.Building2 size={28} strokeWidth={1.2} />}
                </div>
                <div className="ed-card__body">
                  <h3 className="ed-card__name">{b.name}</h3>
                  {b.hero_subtitle && <p className="ed-card__sub">{b.hero_subtitle}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Collections */}
      <section className="ed-section" data-testid="designer-section-collections">
        <div className="ed-section__head">
          <div>
            <p className="ed-section__eyebrow">Collections</p>
            <h2 className="ed-section__title">
              {counts.collections > 0
                ? `${counts.collections} ${t('entity.designer.collections_section', null, 'collezioni attribuite')}`
                : t('entity.designer.no_collections_title', null, 'Collezioni in indicizzazione')}
            </h2>
          </div>
        </div>
        {states.no_collections ? (
          <div className="ed-empty" data-testid="designer-collections-empty">
            {t('entity.designer.no_collections', null, 'Nessuna collezione collegata.')}
          </div>
        ) : (
          <div className="ed-grid ed-grid--products" data-testid="designer-collections-grid">
            {collections.map((c) => (
              <Link
                key={c.id}
                to={`/inspirations/brands/${c.brand_id}/collections/${c.id}`}
                className="ed-card"
                data-testid={`designer-collection-${c.id}`}
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
      <section className="ed-section" data-testid="designer-section-products">
        <div className="ed-section__head">
          <div>
            <p className="ed-section__eyebrow">Products</p>
            <h2 className="ed-section__title">
              {counts.products > 0
                ? `${counts.products} ${t('entity.designer.products_section', null, 'prodotti firmati')}`
                : t('entity.designer.no_products_title', null, 'Prodotti in indicizzazione')}
            </h2>
          </div>
        </div>
        {states.no_products ? (
          <div className="ed-empty" data-testid="designer-products-empty">
            {t('entity.designer.no_products', null, 'Nessun prodotto attribuito a questo designer.')}
          </div>
        ) : (
          <div className="ed-grid ed-grid--products" data-testid="designer-products-grid">
            {products.map((p) => (
              <Link
                key={p.id}
                to={`/inspirations/brands/${p.brand_id}/products/${p.id}`}
                className="ed-card"
                data-testid={`designer-product-${p.id}`}
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
