/**
 * BrandDetailPage — Brand Detail View™ · lettura curatoriale.
 * Phase D · Sprint D3.
 *
 * Non è un "vendor profile". È:
 *   • le atmosfere prevalenti
 *   • le materialità ricorrenti
 *   • le geografie narrative
 *   • le collezioni
 *   • le moodboard dove il brand vive nello studio
 *
 * Curatorial Insights™ in primo piano (testuali, NON dashboard).
 * Numeri piccoli, secondari. Quick Jump editoriali a Collections /
 * Inspirations / Moodboards / Cultural Editions™.
 */
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as Icons from 'lucide-react';
import api from '../../lib/api';
import './brand-mode.css';

const MARKET_LABEL = {
  'us-miami':    'Miami',  'us-nyc':      'New York',
  'us-socal':    'Southern California', 'it-milano':   'Milano',
  'uk-london':   'Londra', 'fr-paris':    'Parigi',
  'ae-dubai':    'Dubai',
  'usa_miami':   'Miami',  'usa_nyc':     'New York',
  'usa_socal':   'Southern California', 'italy_milano':'Milano',
  'uk_london':   'Londra', 'france_paris':'Parigi',
  'uae_dubai':   'Dubai',
};
const formatMarket = (c) => MARKET_LABEL[c] || c;

const Insight = ({ text, idx }) => (
  <li className="bd-insight" data-testid={`bd-insight-${idx}`}>
    <span className="bd-insight__marker">{String(idx + 1).padStart(2, '0')}</span>
    <p>{text}</p>
  </li>
);

const InsightSkeleton = () => (
  <li className="bd-insight bd-insight--skeleton">
    <span className="bd-insight__marker" />
    <div className="bm-skel bm-skel--row" />
  </li>
);

const Tile = ({ src, label, sub, to, testid }) => {
  const inner = (
    <div className="bd-tile" data-testid={testid}>
      <div className="bd-tile__media">
        {src ? <img src={src} alt="" loading="lazy" /> : <Icons.Image size={14} />}
      </div>
      {label && <p className="bd-tile__label">{label}</p>}
      {sub && <p className="bd-tile__sub">{sub}</p>}
    </div>
  );
  return to ? <Link to={to} className="bd-tile-link">{inner}</Link> : inner;
};

const BrandDetailPage = () => {
  const { brandId } = useParams();
  const [profile, setProfile] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setProfile(null); setErr(null);
    api.get(`/api/inspirations/registry/brands/${brandId}/curatorial-profile`)
      .then((r) => setProfile(r.data))
      .catch((e) => setErr(e?.response?.data?.detail || 'Profilo non disponibile'));
  }, [brandId]);

  if (err) {
    return (
      <div className="bm-root bd-error" data-testid="bd-error">
        <div className="bm-empty">
          <div className="bm-empty__ring"><Icons.AlertCircle size={16} strokeWidth={1.3} /></div>
          <h3>{err}</h3>
          <Link to="/inspirations/brands" className="bm-empty__back">
            <Icons.ArrowLeft size={11} /> Torna all'atlante
          </Link>
        </div>
      </div>
    );
  }

  const loading = !profile;
  const brand = profile?.brand;

  return (
    <div className="bm-root bd-root" data-testid="brand-detail-page">
      {/* Back nav (editorial, sottile) */}
      <Link to="/inspirations/brands" className="bd-back" data-testid="bd-back">
        <Icons.ArrowLeft size={11} strokeWidth={1.5} />
        <span>Atlante curatoriale</span>
      </Link>

      {/* Hero — il brand come linguaggio */}
      <header className="bd-hero">
        <div className="bd-hero__logo">
          {brand?.logo_url
            ? <img src={brand.logo_url} alt="" />
            : <span>{(brand?.name || '?').split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase()}</span>}
        </div>
        <div className="bd-hero__body">
          <p className="bd-hero__eyebrow">Lettura curatoriale</p>
          <h1 className="bd-hero__title">
            {loading ? <span className="bm-skel bm-skel--title" /> : brand.name}
          </h1>
          {!loading && brand.positioning && (
            <p className="bd-hero__lead">{brand.positioning}</p>
          )}
          {!loading && (
            <div className="bd-hero__meta">
              {brand.luxury_tier && <span className="bm-tag bm-tag--luxury">{brand.luxury_tier}</span>}
              {(brand.primary_markets || []).slice(0, 4).map((m) => (
                <span key={m} className="bm-tag bm-tag--market">{formatMarket(m)}</span>
              ))}
              {brand.country && <span className="bm-tag">{brand.country}</span>}
            </div>
          )}
        </div>

        {/* Counts: piccoli, secondari, MAI protagonisti */}
        {!loading && (
          <div className="bd-counts" data-testid="bd-counts">
            <span><em>{profile.counts.collections}</em>collezioni</span>
            <span><em>{profile.counts.products}</em>prodotti</span>
            <span><em>{profile.counts.inspirations}</em>riferimenti</span>
            <span><em>{profile.counts.moodboards}</em>moodboard</span>
          </div>
        )}
      </header>

      {/* Curatorial Insights™ — il vero protagonista */}
      <section className="bd-section" data-testid="bd-insights-section">
        <p className="bd-section__eyebrow">Curatorial Insights™</p>
        <ol className="bd-insights">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <InsightSkeleton key={i} />)
            : (profile.curatorial_insights || []).map((t, i) => (
                <Insight key={i} idx={i} text={t} />
              ))}
        </ol>
      </section>

      {/* Atmosfere + Materialità prevalenti — chip eleganti */}
      {!loading && (profile.dominant_atmospheres.length > 0 || profile.dominant_materials.length > 0) && (
        <section className="bd-section bd-section--cols" data-testid="bd-dominants">
          {profile.dominant_atmospheres.length > 0 && (
            <div>
              <p className="bd-section__eyebrow">Atmosfere prevalenti</p>
              <div className="bd-chip-cloud">
                {profile.dominant_atmospheres.map((a) => (
                  <span key={a.label} className="bm-chip">{a.label}</span>
                ))}
              </div>
            </div>
          )}
          {profile.dominant_materials.length > 0 && (
            <div>
              <p className="bd-section__eyebrow">Materialità ricorrenti</p>
              <div className="bd-chip-cloud">
                {profile.dominant_materials.map((m) => (
                  <span key={m.label} className="bm-chip bm-chip--material">{m.label}</span>
                ))}
              </div>
            </div>
          )}
          {profile.dominant_markets.length > 0 && (
            <div>
              <p className="bd-section__eyebrow">Geografie narrative</p>
              <div className="bd-chip-cloud">
                {profile.dominant_markets.map((m) => (
                  <span key={m.label} className="bm-chip bm-chip--market">{formatMarket(m.label)}</span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Collezioni */}
      {!loading && profile.collections.length > 0 && (
        <section className="bd-section" data-testid="bd-collections-section">
          <header className="bd-section__head">
            <p className="bd-section__eyebrow">Collezioni</p>
            <span className="bd-section__count">{profile.collections.length}</span>
          </header>
          <div className="bd-coll-grid">
            {profile.collections.slice(0, 12).map((c) => (
              <div key={c.id} className="bd-coll-card" data-testid={`bd-coll-${c.id}`}>
                <p className="bd-coll-card__title">{c.name}</p>
                <p className="bd-coll-card__meta">
                  {c.year && <em>{c.year}</em>}{c.category && <> · {c.category}</>}
                </p>
                {c.description && <p className="bd-coll-card__desc">{c.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Product Inspirations™ — grid editoriale */}
      {!loading && profile.products.length > 0 && (
        <section className="bd-section" data-testid="bd-products-section">
          <header className="bd-section__head">
            <p className="bd-section__eyebrow">Product Inspirations™</p>
            <span className="bd-section__count">{profile.counts.products}</span>
          </header>
          <div className="bd-prod-grid">
            {profile.products.slice(0, 18).map((p) => (
              <Tile key={p.id}
                    testid={`bd-product-${p.id}`}
                    src={p.image_url}
                    label={p.product_name || p.title}
                    sub={p.collection} />
            ))}
          </div>
        </section>
      )}

      {/* Editorial References */}
      {!loading && profile.inspirations.length > 0 && (
        <section className="bd-section" data-testid="bd-inspirations-section">
          <header className="bd-section__head">
            <p className="bd-section__eyebrow">Riferimenti editoriali</p>
            <span className="bd-section__count">{profile.counts.inspirations}</span>
          </header>
          <div className="bd-prod-grid">
            {profile.inspirations.slice(0, 18).map((p) => (
              <Tile key={p.id}
                    testid={`bd-insp-${p.id}`}
                    src={p.image_url}
                    label={p.title} />
            ))}
          </div>
        </section>
      )}

      {/* Moodboard correlate */}
      {!loading && profile.moodboards.length > 0 && (
        <section className="bd-section" data-testid="bd-moodboards-section">
          <header className="bd-section__head">
            <p className="bd-section__eyebrow">Moodboard correlate</p>
            <span className="bd-section__count">{profile.moodboards.length}</span>
          </header>
          <div className="bd-mb-grid">
            {profile.moodboards.map((m) => (
              <Link key={m.id}
                    to={`/moodboards/${m.id}`}
                    className="bd-mb-card"
                    data-testid={`bd-mb-${m.id}`}>
                <div className="bd-mb-card__cover">
                  {m.cover_image_url ? <img src={m.cover_image_url} alt="" /> : <Icons.Layers size={14} />}
                </div>
                <p className="bd-mb-card__title">{m.title || 'Moodboard'}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Quick Jump editoriali — coda della pagina */}
      {!loading && (
        <section className="bd-section bd-jumps" data-testid="bd-quick-jump">
          <p className="bd-section__eyebrow">Continua la lettura</p>
          <div className="bd-jump-row">
            <Link to="/inspirations" className="bd-jump" data-testid="bd-jump-inspirations">
              <Icons.Sparkles size={11} /> Inspirations™
            </Link>
            <Link to="/inspirations/collections" className="bd-jump" data-testid="bd-jump-collections">
              <Icons.Library size={11} /> Studio Collections™
            </Link>
            <Link to="/moodboards" className="bd-jump" data-testid="bd-jump-moodboards">
              <Icons.Layers size={11} /> Moodboards™
            </Link>
            <Link to="/cultural-editions" className="bd-jump" data-testid="bd-jump-editions">
              <Icons.Globe size={11} /> Cultural Editions™
            </Link>
          </div>
        </section>
      )}
    </div>
  );
};

export default BrandDetailPage;
