/**
 * InspirationsPage — Cultural Editorial Archive
 *
 * Inspirations™ = layer editoriale sopra la Media Library.
 * NON è un Pinterest viewer. NON è un file manager.
 * È l'archivio curatoriale culturale dello studio.
 *
 * Layout:
 *   01 · Editorial header (cultural design intelligence layer)
 *   02 · Filtri orizzontali (mercato · atmosfera · materiale · luxury · profilo)
 *   03 · Masonry grid (cards cinematografiche con resonance hints)
 *   04 · Detail drawer (fullscreen cinematic con Market Resonance™)
 *   05 · Add Reference modal (upload · URL Pinterest · URL Instagram · URL immagine)
 *
 * Linguaggio: 100% italiano editoriale. ZERO jargon SaaS.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { asErrorString } from '../../lib/asErrorString';
import AddInspirationModal from './AddInspirationModal';
import InspirationDetailDrawer from './InspirationDetailDrawer';
import SupplierCatalogImportModal from './SupplierCatalogImportModal';
import './inspirations.css';

const InspirationsPage = () => {
  const [items, setItems] = useState(null);
  const [filtersConfig, setFiltersConfig] = useState(null);
  const [filters, setFilters] = useState({ market: '', atmosphere: '', material: '', luxury: '', profile: '' });
  const [typeFilter, setTypeFilter] = useState('');  // '' | 'editorial' | 'product'
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/api/inspirations/archive/_filters').then((r) => setFiltersConfig(r.data)).catch(() => {});
  }, []);

  const load = () => {
    setError(null);
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) qs.set(k, v); });
    if (search) qs.set('q', search);
    if (typeFilter) qs.set('inspiration_type', typeFilter);
    api.get(`/api/inspirations/archive?${qs.toString()}`)
      .then((r) => setItems(r.data?.items || []))
      .catch((e) => setError(asErrorString(e, 'Errore nel caricamento')));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ },
    [filters.market, filters.atmosphere, filters.material, filters.luxury, filters.profile, typeFilter]);

  const onImported = (it) => {
    setItems((prev) => [it, ...(prev || [])]);
    toast.success('Riferimento aggiunto a Inspirations™');
  };

  const onChanged = (it) => {
    setItems((prev) => (prev || []).map((x) => x.id === it.id ? { ...x, ...it } : x));
  };

  const onRemoved = (id) => {
    setItems((prev) => (prev || []).filter((x) => x.id !== id));
    setSelectedId(null);
  };

  const empty = items && items.length === 0;

  return (
    <div className="ins-page" data-testid="inspirations-page">
      <header className="ins-header" data-testid="inspirations-header">
        <p className="ins-eyebrow">Cultural Design Intelligence Layer</p>
        <h1 className="ins-title">Inspirations™</h1>
        <p className="ins-lede">
          L'archivio curatoriale dello studio. Ogni riferimento è letto attraverso la lente culturale
          dei mercati internazionali: atmosfera, materia, affinità editoriale.
        </p>
        <div className="ins-header__actions">
          <div className="ins-search">
            <Icons.Search size={13} strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Cerca per atmosfera, materia, brand…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
              data-testid="ins-search-input"
            />
          </div>
          <Link to="/inspirations/collections" className="ins-cta-secondary"
                data-testid="ins-collections-link">
            <Icons.Library size={13} /> Studio Collections™
          </Link>
          <button type="button" className="ins-cta-secondary"
                  onClick={() => setCatalogOpen(true)}
                  data-testid="ins-catalog-btn">
            <Icons.FolderInput size={13} /> Importa catalogo fornitore
          </button>
          <button type="button" className="ins-cta-primary"
                  onClick={() => setAddOpen(true)}
                  data-testid="ins-add-btn">
            <Icons.Plus size={13} /> Aggiungi riferimento
          </button>
        </div>
      </header>

      {/* ── Tipo di Inspiration: Tutti · Editoriali · Prodotti ── */}
      <div className="ins-type-toggle" data-testid="ins-type-toggle">
        {[
          { key: '',          label: 'Tutti',       icon: 'Layers' },
          { key: 'editorial', label: 'Editoriali',  icon: 'BookOpen' },
          { key: 'product',   label: 'Prodotti',    icon: 'Package' },
        ].map((t) => {
          const Ico = Icons[t.icon] || Icons.Circle;
          return (
            <button key={t.key || 'all'} type="button"
                    className={`ins-type-toggle__btn ${typeFilter === t.key ? 'is-active' : ''}`}
                    onClick={() => setTypeFilter(t.key)}
                    data-testid={`ins-type-${t.key || 'all'}`}>
              <Ico size={12} strokeWidth={1.5} /> {t.label}
            </button>
          );
        })}
      </div>

      <FilterBar
        config={filtersConfig}
        value={filters}
        onChange={(next) => setFilters(next)}
      />

      {error && (
        <div className="ins-empty" data-testid="inspirations-error">
          <Icons.AlertCircle size={22} strokeWidth={1.2} />
          <p>{error}</p>
        </div>
      )}

      {items === null && !error && (
        <div className="ins-grid">
          {[0,1,2,3,4,5,6,7].map((i) => (
            <div key={i} className="ins-card ins-card--skel" style={{ height: 180 + (i % 4) * 60 }} />
          ))}
        </div>
      )}

      {empty && (
        <div className="ins-empty" data-testid="inspirations-empty">
          <Icons.Bookmark size={28} strokeWidth={1.1} />
          <p className="ins-empty__title">L'archivio è ancora vuoto.</p>
          <p className="ins-empty__hint">
            Aggiungi il primo riferimento: un upload, un link Pinterest, un link Instagram o
            qualsiasi URL di immagine. MOOD lo trasformerà in Inspiration culturale.
          </p>
          <button type="button" className="ins-cta-primary"
                  onClick={() => setAddOpen(true)}
                  data-testid="ins-empty-add">
            <Icons.Plus size={13} /> Aggiungi il primo riferimento
          </button>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="ins-grid" data-testid="inspirations-grid">
          {items.map((it) => (
            <InspirationCard key={it.id} item={it} onOpen={() => setSelectedId(it.id)} />
          ))}
        </div>
      )}

      <AddInspirationModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        config={filtersConfig}
        onImported={(it) => { setAddOpen(false); onImported(it); }}
      />

      <SupplierCatalogImportModal
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        config={filtersConfig}
        onImported={(count) => {
          setCatalogOpen(false);
          setTypeFilter('product');  // show what was just imported
          toast.success(`Importati ${count} prodotti come Product Inspirations™.`);
          load();
        }}
      />

      <InspirationDetailDrawer
        open={!!selectedId}
        id={selectedId}
        onClose={() => setSelectedId(null)}
        config={filtersConfig}
        onChanged={onChanged}
        onRemoved={onRemoved}
      />
    </div>
  );
};

// ── FilterBar ──────────────────────────────────────────────────────────
const FilterBar = ({ config, value, onChange }) => {
  if (!config) return null;
  const Sel = ({ name, options, placeholder, testid }) => (
    <select
      className="ins-filter"
      value={value[name]}
      onChange={(e) => onChange({ ...value, [name]: e.target.value })}
      data-testid={testid}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.code || o.key} value={o.code || o.key}>{o.label}</option>
      ))}
    </select>
  );
  return (
    <div className="ins-filter-bar" data-testid="inspirations-filters">
      <Sel name="market"     options={config.markets}              placeholder="Mercato"     testid="ins-filter-market" />
      <Sel name="atmosphere" options={config.atmosphere_tags}      placeholder="Atmosfera"   testid="ins-filter-atmosphere" />
      <Sel name="material"   options={config.material_tags}        placeholder="Materia"     testid="ins-filter-material" />
      <Sel name="luxury"     options={config.luxury_levels}        placeholder="Tono luxury" testid="ins-filter-luxury" />
      <Sel name="profile"    options={config.hospitality_profiles} placeholder="Destinazione" testid="ins-filter-profile" />
      {(value.market || value.atmosphere || value.material || value.luxury || value.profile) && (
        <button type="button" className="ins-filter-clear"
                onClick={() => onChange({ market: '', atmosphere: '', material: '', luxury: '', profile: '' })}
                data-testid="ins-filter-clear">
          Reset
        </button>
      )}
    </div>
  );
};

// ── InspirationCard ───────────────────────────────────────────────────
const InspirationCard = ({ item, onOpen }) => {
  const [failed, setFailed] = useState(false);
  const isProduct = item.inspiration_type === 'product';
  const atmos = (item.atmosphere_tags || []).slice(0, 2);
  const mats  = (item.material_tags || []).slice(0, 2);
  const showImage = !!item.image_url && !failed;
  return (
    <button type="button" className={`ins-card ${isProduct ? 'ins-card--product' : ''}`}
            onClick={onOpen}
            data-testid={`inspiration-card-${item.id}`}>
      <div className="ins-card__media">
        {showImage ? (
          <img
            src={item.image_url}
            alt={item.title || ''}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="ins-card__media-placeholder">
            <Icons.ImageOff size={24} strokeWidth={1.2} />
            <span className="ins-card__media-fallback">
              {item.source_kind === 'pinterest' ? 'Pinterest · copertina in attesa' :
               item.source_kind === 'instagram' ? 'Instagram · copertina in attesa' :
               isProduct ? 'Anteprima prodotto in attesa' : 'Copertina in attesa'}
            </span>
          </div>
        )}
        {isProduct && (
          <span className="ins-card__product-badge" data-testid="ins-card-product-badge">
            <Icons.Package size={9} strokeWidth={1.6} /> Prodotto
          </span>
        )}
        <div className="ins-card__overlay">
          <div className="ins-card__chips">
            {atmos.map((a, i) => <span key={`a-${i}`} className="ins-chip ins-chip--atmos">{a.replace(/_/g, ' ')}</span>)}
            {mats.map((m, i)  => <span key={`m-${i}`} className="ins-chip ins-chip--mat">{m.replace(/_/g, ' ')}</span>)}
          </div>
          {item.brand && <span className="ins-card__brand">{item.brand}</span>}
        </div>
      </div>
      <div className="ins-card__body">
        {isProduct && (item.brand || item.product_category) && (
          <p className="ins-card__product-meta">
            {item.brand}
            {item.product_category && <span> · {item.product_category}</span>}
            {item.collection && <span> · {item.collection}</span>}
          </p>
        )}
        <h3 className="ins-card__title">{item.title}</h3>
        {!isProduct && item.description && <p className="ins-card__desc">{item.description}</p>}
        {isProduct && item.designer && <p className="ins-card__desc">design {item.designer}</p>}
      </div>
    </button>
  );
};

export default InspirationsPage;
