/**
 * ITER204-B · Collection Detail™
 *
 * Route: /inspirations/brands/:brandId/collections/:collectionId
 *
 * The first navigable layer of the Knowledge Graph. Every Collection card
 * in Brand Embassy must lead here. Sections:
 *   - Hero (image + name + brand + mood DNA + Save)
 *   - Overview counts (real, no fakes)
 *   - Products grid (clickable → Product Detail)
 *   - Materials (clickable → Material Detail)
 *   - Designers (clickable → Designer Detail)
 *   - Related collections (same brand)
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';

import EN from '../../lib/entityNavigationApi';
import SaveToLibraryButton from '../../components/studio-library/SaveToLibraryButton';
import { useBlueprint } from '../../contexts/BlueprintContext';
import './entity-detail.css';

export default function CollectionDetailPage() {
  const { brandId, collectionId } = useParams();
  const navigate = useNavigate();
  const { t } = useBlueprint();
  const [data, setData] = useState(null); // null = loading

  const reload = useCallback(async () => {
    // Retry up to 2 times on transient errors before declaring not-found.
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await EN.collectionDetail(brandId, collectionId);
        setData(r.data);
        return;
      } catch (e) {
        lastErr = e;
        const status = e?.response?.status;
        // Only abort early on a genuine 404
        if (status === 404) {
          setData({ _error: e?.response?.data?.detail || 'not_found' });
          return;
        }
        // Transient: small backoff then retry
        await new Promise((res) => setTimeout(res, 600 * (attempt + 1)));
      }
    }
    setData({ _error: lastErr?.response?.data?.detail || 'fetch_failed' });
  }, [brandId, collectionId]);

  useEffect(() => { reload(); }, [reload]);

  if (data === null) {
    return (
      <div className="ed-page" data-testid="collection-detail-loading">
        <div className="ed-state">{t('common.loading', null, 'Sto caricando…')}</div>
      </div>
    );
  }
  if (data?._error) {
    return (
      <div className="ed-page" data-testid="collection-detail-error">
        <div className="ed-state">
          {t('entity.not_found', null, 'Collezione non trovata')}
        </div>
      </div>
    );
  }

  const { collection, brand, counts, products, materials, designers,
          related_collections, saved, states } = data;

  return (
    <div className="ed-page" data-testid="collection-detail-page">
      <nav className="ed-breadcrumb" data-testid="collection-breadcrumb">
        <Link to="/inspirations/brands">Brand Atlas</Link>
        <span className="ed-breadcrumb__sep">·</span>
        <Link to={`/inspirations/brands/${brand?.id || brandId}`}>{brand?.name || '—'}</Link>
        <span className="ed-breadcrumb__sep">·</span>
        <span className="ed-breadcrumb__current">{collection.name}</span>
      </nav>

      <header className="ed-hero">
        <div className="ed-hero__media" data-testid="collection-hero-media">
          {collection.hero_image_url ? (
            <img src={collection.hero_image_url} alt="" loading="eager" draggable={false} />
          ) : (
            <span className="ed-hero__placeholder">
              <Icons.Boxes size={48} strokeWidth={1.2} />
            </span>
          )}
        </div>
        <div className="ed-hero__body">
          <p className="ed-hero__eyebrow" data-testid="collection-eyebrow">
            {t('entity.collection.eyebrow', null, 'Collection')} · {brand?.name}
          </p>
          <h1 className="ed-hero__title" data-testid="collection-title">
            {collection.name}
          </h1>
          {collection.description && (
            <p className="ed-hero__subtitle">{collection.description}</p>
          )}

          {(collection.mood_dna?.length || 0) > 0 && (
            <div className="ed-mood-dna" data-testid="collection-mood-dna">
              {collection.mood_dna.slice(0, 6).map((m, i) => (
                <span key={i} className="ed-mood-pill">{m}</span>
              ))}
            </div>
          )}

          <div className="ed-hero__meta">
            <span>
              <span className="ed-hero__meta-num">{counts.products}</span>
              {t('entity.collection.products_label', null, 'prodotti')}
            </span>
            <span>
              <span className="ed-hero__meta-num">{counts.materials}</span>
              {t('entity.collection.materials_label', null, 'materiali')}
            </span>
            <span>
              <span className="ed-hero__meta-num">{counts.designers}</span>
              {t('entity.collection.designers_label', null, 'designer')}
            </span>
          </div>

          <div className="ed-hero__actions">
            <SaveToLibraryButton
              entityType="collection"
              entityId={collection.id}
              initialSaved={saved}
              sourceType="brand_atlas"
              testId="collection-save-to-library"
            />
          </div>
        </div>
      </header>

      {/* ── Products ───────────────────────────────────────────────── */}
      <section className="ed-section" data-testid="collection-section-products">
        <div className="ed-section__head">
          <div>
            <p className="ed-section__eyebrow">Products In Collection</p>
            <h2 className="ed-section__title">
              {counts.products > 0
                ? `${counts.products} ${t('entity.collection.products_in_collection', null, 'prodotti collegati')}`
                : t('entity.collection.products_indexing_title', null, 'Prodotti in indicizzazione')}
            </h2>
          </div>
        </div>
        {states.products_indexing ? (
          <div className="ed-empty" data-testid="collection-products-empty">
            {t('entity.collection.products_indexing', null, 'I prodotti sono in fase di indicizzazione.')}
          </div>
        ) : (
          <div className="ed-grid ed-grid--products" data-testid="collection-products-grid">
            {products.slice(0, 60).map((p) => (
              <Link
                key={p.id}
                to={`/inspirations/brands/${brand?.id || brandId}/products/${p.id}`}
                className="ed-card"
                data-testid={`collection-product-${p.id}`}
              >
                <div className="ed-card__media">
                  {p.image_url
                    ? <img src={p.image_url} alt="" loading="lazy" />
                    : <Icons.Package size={28} strokeWidth={1.2} />}
                </div>
                <div className="ed-card__body">
                  <h3 className="ed-card__name">{p.name || '—'}</h3>
                  {p.category && <p className="ed-card__sub">{p.category}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Materials ──────────────────────────────────────────────── */}
      <section className="ed-section" data-testid="collection-section-materials">
        <div className="ed-section__head">
          <div>
            <p className="ed-section__eyebrow">Materials Used</p>
            <h2 className="ed-section__title">
              {materials.length > 0
                ? `${materials.length} ${t('entity.collection.materials_in_collection', null, 'materiali ricorrenti')}`
                : t('entity.collection.materials_not_linked_title', null, 'Materiali da collegare')}
            </h2>
          </div>
        </div>
        {states.materials_not_linked ? (
          <div className="ed-empty" data-testid="collection-materials-empty">
            {t('entity.collection.materials_not_linked', null, 'Nessun materiale collegato a questa collezione.')}
          </div>
        ) : (
          <div className="ed-grid ed-grid--materials" data-testid="collection-materials-grid">
            {materials.map((m) => (
              <article
                key={m.key}
                className="ed-card ed-card--material"
                data-testid={`collection-material-${m.key}`}
                onClick={() => navigate(`/inspirations/materials/${encodeURIComponent(m.key)}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/inspirations/materials/${encodeURIComponent(m.key)}`);
                }}
              >
                <div className="ed-card__media">
                  <Icons.Palette size={22} strokeWidth={1.3} />
                </div>
                <div className="ed-card__body">
                  <h3 className="ed-card__name">{m.name || m.key}</h3>
                  <p className="ed-card__count">
                    {m.count} {t('entity.material.references', null, 'riferimenti')}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ── Designers ──────────────────────────────────────────────── */}
      <section className="ed-section" data-testid="collection-section-designers">
        <div className="ed-section__head">
          <div>
            <p className="ed-section__eyebrow">Designers</p>
            <h2 className="ed-section__title">
              {designers.length > 0
                ? `${designers.length} ${t('entity.collection.designers_in_collection', null, 'designer collegati')}`
                : t('entity.collection.designers_pending_title', null, 'Designer in verifica')}
            </h2>
          </div>
        </div>
        {states.designers_pending ? (
          <div className="ed-empty" data-testid="collection-designers-empty">
            {t('entity.collection.designers_pending', null, 'Informazioni designer in verifica.')}
          </div>
        ) : (
          <div className="ed-grid ed-grid--designers" data-testid="collection-designers-grid">
            {designers.map((d) => (
              <Link
                key={d.id}
                to={`/inspirations/designers/${d.id}`}
                className="ed-card ed-card--designer"
                data-testid={`collection-designer-${d.id}`}
              >
                <div className="ed-card__avatar">
                  {(d.name || '').split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase()}
                </div>
                <div className="ed-card__body">
                  <h3 className="ed-card__name">{d.name}</h3>
                  <p className="ed-card__sub">{d.role || 'Designer'}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Related Collections ────────────────────────────────────── */}
      {related_collections.length > 0 && (
        <section className="ed-section" data-testid="collection-section-related">
          <div className="ed-section__head">
            <div>
              <p className="ed-section__eyebrow">Related Collections</p>
              <h2 className="ed-section__title">
                {t('entity.collection.related_title', null, 'Altre collezioni di')} {brand?.name}
              </h2>
            </div>
          </div>
          <div className="ed-grid ed-grid--products" data-testid="collection-related-grid">
            {related_collections.map((c) => (
              <Link
                key={c.id}
                to={`/inspirations/brands/${brand?.id || brandId}/collections/${c.id}`}
                className="ed-card"
                data-testid={`collection-related-${c.id}`}
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
        </section>
      )}
    </div>
  );
}
