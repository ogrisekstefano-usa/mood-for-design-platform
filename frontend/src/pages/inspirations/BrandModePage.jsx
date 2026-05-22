/**
 * BrandModePage — Brand Atlas™ · atlante curatoriale dei produttori.
 * Phase D · Sprint D3. Renamed in Sprint UI-SYS-01 (was 'Brand Mode™').
 *
 * Lettura: i brand sono LINGUAGGI PROGETTUALI, non vendor records.
 * UX: editorial cards con atmosfera prevalente + materialità + mercati
 *     narrativi. Niente leaderboard, niente KPI giganti. I numeri restano
 *     piccoli e secondari: il protagonista è il linguaggio.
 *
 * Routing:
 *   /inspirations/brands            → grid editoriale
 *   /inspirations/brands/:brandId   → BrandDetailPage
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import api from '../../lib/api';
import BrandFormModal from './BrandFormModal';
import './brand-mode.css';
import './brand-form.css';
import { useT } from '../../i18n/useT';
const LUXURY_LABEL = {
  entry: 'entry',
  contemporary: 'contemporary',
  premium: 'premium',
  luxury: 'luxury',
  icon: 'icon',
  ultra_luxury: 'ultra luxury'
};
const MARKET_LABEL = {
  'us-miami': 'Miami',
  'us-nyc': 'New York',
  'us-socal': 'Southern California',
  'it-milano': 'Milano',
  'uk-london': 'Londra',
  'fr-paris': 'Parigi',
  'ae-dubai': 'Dubai',
  // legacy supplier-import naming
  'usa_miami': 'Miami',
  'usa_nyc': 'New York',
  'usa_socal': 'Southern California',
  'italy_milano': 'Milano',
  'uk_london': 'Londra',
  'france_paris': 'Parigi',
  'uae_dubai': 'Dubai'
};
const formatMarket = code => MARKET_LABEL[code] || code;
const BrandCard = ({
  b
}) => {
  const {
    t
  } = useT();
  const atmo = b.dominant_atmospheres || [];
  const mat = b.dominant_materials || [];
  const markets = (b.dominant_markets || b.primary_markets || []).slice(0, 3);
  const luxury = LUXURY_LABEL[b.luxury_tier] || b.luxury_tier || '—';

  // Initials avatar — used when the brand has no logo yet (most studios
  // populate logos later; we don't want broken images).
  const initials = (b.name || '?').split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
  return <Link to={`/inspirations/brands/${b.id}`} className="bm-card" data-testid={`bm-card-${b.id}`}>
      <div className="bm-card__head">
        <div className="bm-card__logo" aria-hidden>
          {b.logo_url ? <img src={b.logo_url} alt="" /> : <span>{initials}</span>}
        </div>
        <div className="bm-card__title">
          <h3>{b.name}</h3>
          {b.positioning && <p>{b.positioning}</p>}
        </div>
      </div>

      <div className="bm-card__meta">
        <span className="bm-tag bm-tag--luxury" data-testid={`bm-luxury-${b.id}`}>{luxury}</span>
        {markets.slice(0, 2).map(m => <span key={m} className="bm-tag bm-tag--market">{formatMarket(m)}</span>)}
        {!b.is_studio_private && <span className="bm-curated-badge" data-testid={`bm-curated-${b.id}`}>
            <Icons.Sparkles size={8} strokeWidth={1.6} /> {t('inspirations.brand_mode.curated_by_mood', null, 'Curated by MOOD')}
          </span>}
      </div>

      {atmo.length > 0 && <div className="bm-card__chips" data-testid={`bm-atmo-${b.id}`}>
          {atmo.slice(0, 3).map(a => <span key={a} className="bm-chip">{a}</span>)}
        </div>}

      {mat.length > 0 && <p className="bm-card__materials" data-testid={`bm-materials-${b.id}`}>
          materialità · {mat.slice(0, 3).join(' · ')}
        </p>}

      <div className="bm-card__counts" data-testid={`bm-counts-${b.id}`}>
        {b.collections_count > 0 && <span>{b.collections_count} collezioni</span>}
        {b.products_count > 0 && <span>{b.products_count} prodotti</span>}
        {b.inspirations_count > 0 && <span>{b.inspirations_count} riferimenti</span>}
      </div>

      <div className="bm-card__cta">
        <span>{t('inspirations.brand_mode.entra_nell_atelier')}</span>
        <Icons.ArrowUpRight size={11} strokeWidth={1.5} />
      </div>
    </Link>;
};
const BrandCardSkeleton = () => <div className="bm-card bm-card--skeleton">
    <div className="bm-card__head">
      <div className="bm-card__logo" />
      <div className="bm-card__title">
        <div className="bm-skel bm-skel--title" />
        <div className="bm-skel bm-skel--sub" />
      </div>
    </div>
    <div className="bm-skel bm-skel--row" />
    <div className="bm-skel bm-skel--row bm-skel--short" />
  </div>;
const BrandModePage = () => {
  const { t } = useT();
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [luxuryFilter, setLuxuryFilter] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const refresh = () => {
    api.get('/api/inspirations/registry/brands-atlas', {
      params: {
        limit: 60
      }
    }).then(r => setItems(r.data?.items || [])).catch(() => setItems([]));
  };
  useEffect(() => {
    refresh();
  }, []);
  const filtered = useMemo(() => {
    if (!items) return null;
    const ql = q.trim().toLowerCase();
    return items.filter(b => {
      if (luxuryFilter && b.luxury_tier !== luxuryFilter) return false;
      if (!ql) return true;
      return (b.name || '').toLowerCase().includes(ql) || (b.positioning || '').toLowerCase().includes(ql) || (b.dominant_atmospheres || []).some(a => a.toLowerCase().includes(ql)) || (b.dominant_materials || []).some(m => m.toLowerCase().includes(ql));
    });
  }, [items, q, luxuryFilter]);
  const luxuryFacets = useMemo(() => {
    if (!items) return [];
    const bag = {};
    items.forEach(b => {
      if (!b.luxury_tier) return;
      bag[b.luxury_tier] = (bag[b.luxury_tier] || 0) + 1;
    });
    return Object.entries(bag).sort((a, b) => b[1] - a[1]);
  }, [items]);
  return <div className="bm-root" data-testid="brand-mode-page">
      <header className="bm-hero">
        <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 24,
        flexWrap: 'wrap'
      }}>
          <div style={{
          flex: 1,
          minWidth: 280
        }}>
            <p className="bm-hero__eyebrow" data-testid="brand-atlas-eyebrow">{t('inspirations.brand_mode.atlas_eyebrow', null, 'Brand Atlas™ · curated atlas of manufacturers')}</p>
            <h1 className="bm-hero__title" data-testid="brand-atlas-title">
              {t('inspirations.brand_mode.atlas_title_lead', null, 'Manufacturers as')} <em>{t('inspirations.brand_mode.atlas_title_em', null, 'design languages')}</em>
            </h1>
            <p className="bm-hero__lead">
              {t("inspirations.brand_mode.atlas_lead")}
            </p>
          </div>
          <button type="button" className="bm-empty__back" style={{
          background: 'var(--bp-primary)',
          color: 'var(--bp-surface-0, #0a0a0a)',
          borderColor: 'var(--bp-primary)'
        }} onClick={() => setAddOpen(true)} data-testid="bm-add-brand">
            <Icons.Plus size={11} /> {t("inspirations.brand_mode.aggiungi_produttore")}
          </button>
        </div>
      </header>

      <div className="bm-controls">
        <div className="bm-search">
          <Icons.Search size={12} />
          <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder={t("inspirations.brand_mode.cerca_per_nome_atmosfera_materia")} data-testid="brand-mode-search" />
        </div>
        {luxuryFacets.length > 0 && <div className="bm-facets" data-testid="brand-mode-facets">
            <button type="button" className={`bm-facet ${!luxuryFilter ? 'is-on' : ''}`} onClick={() => setLuxuryFilter(null)}>
              {t("inspirations.brand_mode.tutti_i_posizionamenti")}
            </button>
            {luxuryFacets.map(([k]) => <button key={k} type="button" data-testid={`brand-mode-facet-${k}`} className={`bm-facet ${luxuryFilter === k ? 'is-on' : ''}`} onClick={() => setLuxuryFilter(luxuryFilter === k ? null : k)}>
                {LUXURY_LABEL[k] || k}
              </button>)}
          </div>}
      </div>

      {filtered === null ? <div className="bm-grid">
          {Array.from({
        length: 6
      }).map((_, i) => <BrandCardSkeleton key={i} />)}
        </div> : filtered.length === 0 ? <div className="bm-empty" data-testid="brand-mode-empty">
          <div className="bm-empty__ring"><Icons.Compass size={16} strokeWidth={1.3} /></div>
          <h3>{t('inspirations.brand_mode.nessun_produttore_corrisponde_alla_ricerca')}</h3>
          <p>{t('inspirations.brand_mode.atlas_empty_lead')}</p>
        </div> : <div className="bm-grid" data-testid="brand-mode-grid">
          {filtered.map(b => <BrandCard key={b.id} b={b} />)}
        </div>}

      <BrandFormModal open={addOpen} mode="create" onClose={() => setAddOpen(false)} onSaved={(item, status) => {
      // 'created' → prepend; 'existing' → just refresh (already in atlas)
      if (status === 'created' && item) {
        setItems(prev => [{
          ...item,
          is_studio_private: true,
          collections_count: 0,
          products_count: 0,
          inspirations_count: 0,
          dominant_atmospheres: [],
          dominant_materials: [],
          dominant_markets: item.primary_markets || []
        }, ...(prev || [])]);
      } else {
        refresh();
      }
    }} />
    </div>;
};
export default BrandModePage;