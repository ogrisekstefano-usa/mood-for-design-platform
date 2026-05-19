/**
 * MoodPanel — Moodboards Inspirations Flow™ (Phase C · Slice 2).
 *
 * Tavolo curatoriale digitale. NON un media browser, NON un asset picker.
 * Quattro letture editoriali del mondo curatoriale dello studio:
 *
 *   Inspirations™      — riferimenti editoriali letti culturalmente
 *   Prodotti           — Product Inspirations™ dal Brand Registry
 *   Recenti            — ultimi usati dallo studio
 *   Collezioni Studio  — cataloghi importati dai fornitori
 *
 * UX promise:
 *   click su tile → asset dentro il moodboard. Istantaneo.
 *   Nessun modale, nessun drag inutile, nessuna ricerca obbligatoria.
 *
 * Linguaggio editoriale: "Riferimenti", "Atmosfera", "Selezione",
 * "Aggiungi". MAI: "asset picker", "library", "DAM", "insert image".
 *
 * Tutte le immagini passano dal Universal Editorial Cropper™:
 * display_meta (focal_x/y · editorial_filter · zoom · crop_ratio) viene
 * persistito sul block così la regia segue l'asset ovunque venga riusato.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as Icons from 'lucide-react';
import api from '../../lib/api';
import { filterCssFor } from '../../components/media/UniversalEditorialCropper';
import './mood-panel.css';

// ── Editorial taxonomy chips (curated, non-enterprise) ─────────────
const ATMOSPHERE_CHIPS = [
  'mediterraneo', 'editoriale', 'tropicale', 'galleria',
  'organico', 'monocromatico', 'materico', 'cinematico',
];
const MATERIAL_CHIPS = [
  'pietra', 'ottone', 'noce', 'lino', 'marmo', 'velluto',
  'travertino', 'rovere',
];
const PROFILE_CHIPS = [
  { key: 'residential',  label: 'Residenziale' },
  { key: 'hospitality',  label: 'Hospitality' },
  { key: 'contract',     label: 'Contract' },
  { key: 'retail',       label: 'Retail' },
  { key: 'workspace',    label: 'Workspace' },
  { key: 'outdoor',      label: 'Outdoor' },
];

const TABS = [
  { key: 'inspirations', label: 'Inspirations™',     icon: Icons.Sparkles },
  { key: 'products',     label: 'Prodotti',          icon: Icons.Package },
  { key: 'recent',       label: 'Recenti',           icon: Icons.Clock },
  { key: 'collections',  label: 'Collezioni Studio', icon: Icons.Library },
];

// ── Atom · editorial chip ──────────────────────────────────────────
const Chip = ({ active, label, onClick, testid }) => (
  <button type="button"
          onClick={onClick}
          data-testid={testid}
          className={`mp-chip ${active ? 'is-on' : ''}`}>
    {label}
  </button>
);

// ── Atom · curatorial tile ─────────────────────────────────────────
const Tile = ({ item, onAdd, kind, testid }) => {
  const dm = item.display_meta || {};
  const focalPos = `${((dm.focal_x ?? 0.5) * 100).toFixed(0)}% ${((dm.focal_y ?? 0.5) * 100).toFixed(0)}%`;
  const cssFilter = dm.editorial_filter ? filterCssFor(dm.editorial_filter) : 'none';
  const zoom = dm.zoom ?? 1;

  const brand = item.brand;
  const isProduct = item.inspiration_type === 'product' || kind === 'product';
  const title = item.title || item.product_name || item.file_name || 'Riferimento';

  return (
    <div className="mp-tile" data-testid={testid}>
      <button type="button"
              className="mp-tile__media"
              onClick={() => onAdd(item)}
              data-testid={`${testid}-add`}
              title="Aggiungi al moodboard">
        {item.image_url ? (
          <img src={item.image_url}
               alt=""
               loading="lazy"
               draggable={false}
               style={{
                 objectFit: 'cover',
                 objectPosition: focalPos,
                 transform: `scale(${zoom})`,
                 transformOrigin: focalPos,
                 filter: cssFilter === 'none' ? undefined : cssFilter,
               }} />
        ) : (
          <div className="mp-tile__empty"><Icons.ImageOff size={14} /></div>
        )}
        <span className="mp-tile__overlay">
          <span className="mp-tile__cta">
            <Icons.Plus size={11} /> Aggiungi
          </span>
        </span>
        {isProduct && <span className="mp-tile__badge">Prodotto</span>}
      </button>
      <div className="mp-tile__meta">
        {brand && <span className="mp-tile__brand" title={brand}>{brand}</span>}
        <span className="mp-tile__title" title={title}>{title}</span>
      </div>
    </div>
  );
};

// ── Atom · skeleton ────────────────────────────────────────────────
const TileSkeleton = () => (
  <div className="mp-tile mp-tile--skeleton">
    <div className="mp-tile__media"><div className="mp-shimmer" /></div>
    <div className="mp-tile__meta">
      <span className="mp-tile__title" style={{ background: 'var(--bp-surface-2)', height: 8, borderRadius: 2, width: '60%' }} />
    </div>
  </div>
);

// ── Atom · empty state ─────────────────────────────────────────────
const EmptyState = ({ icon: Icon, title, body }) => (
  <div className="mp-empty" data-testid="mood-panel-empty">
    <div className="mp-empty__ring"><Icon size={14} strokeWidth={1.3} /></div>
    <p className="mp-empty__title">{title}</p>
    <p className="mp-empty__body">{body}</p>
  </div>
);

// ── Hook · debounce ───────────────────────────────────────────────
const useDebounced = (value, delay = 220) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
};

// ── Main panel ────────────────────────────────────────────────────
const MoodPanel = ({ onAddInspiration, moodboardId }) => {
  const [tab, setTab] = useState('inspirations');
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 220);
  const [atmosphere, setAtmosphere] = useState(null);
  const [material, setMaterial] = useState(null);
  const [profile, setProfile] = useState(null);
  const [brandQ, setBrandQ] = useState('');
  const dbrandQ = useDebounced(brandQ, 220);

  const [items, setItems] = useState(null);  // null = loading
  const [collections, setCollections] = useState(null);
  const reqRef = useRef(0);

  // ── Fetch on tab/filters change ──
  useEffect(() => {
    if (tab === 'collections') return;
    const seq = ++reqRef.current;
    setItems(null);

    const params = {};
    if (tab === 'products') params.inspiration_type = 'product';
    else if (tab === 'inspirations') params.inspiration_type = 'editorial';
    // 'recent' = no type filter, sorted by updated desc (default in backend)
    if (dq) params.q = dq;
    if (atmosphere) params.atmosphere = atmosphere;
    if (material) params.material = material;
    if (profile) params.profile = profile;
    if (tab === 'products' && dbrandQ) params.brand = dbrandQ;
    params.limit = tab === 'recent' ? 24 : 40;

    api.get('/api/inspirations/archive', { params })
      .then((r) => {
        if (reqRef.current !== seq) return;
        setItems(r.data?.items || []);
      })
      .catch(() => { if (reqRef.current === seq) setItems([]); });
  }, [tab, dq, atmosphere, material, profile, dbrandQ]);

  useEffect(() => {
    if (tab !== 'collections') return;
    setCollections(null);
    api.get('/api/inspirations/catalogs')
      .then((r) => setCollections(r.data?.items || []))
      .catch(() => setCollections([]));
  }, [tab]);

  // ── Group catalogs by brand ──
  const collectionsByBrand = useMemo(() => {
    if (!collections) return null;
    const map = new Map();
    collections.forEach((c) => {
      const key = c.brand || '—';
      (map.get(key) || map.set(key, []).get(key)).push(c);
    });
    return Array.from(map.entries());
  }, [collections]);

  // ── Filters reset ──
  const resetFilters = () => {
    setAtmosphere(null); setMaterial(null); setProfile(null);
    setBrandQ(''); setQ('');
  };

  // ── Render helpers ──
  const showFilters = tab === 'inspirations' || tab === 'products' || tab === 'recent';

  return (
    <div className="mp-root" data-testid="mood-panel">
      {/* Eyebrow + tabs */}
      <div className="mp-tabs" data-testid="mood-panel-tabs">
        {TABS.map((tt) => (
          <button key={tt.key}
                  type="button"
                  onClick={() => setTab(tt.key)}
                  data-testid={`mood-tab-${tt.key}`}
                  className={`mp-tab ${tab === tt.key ? 'is-on' : ''}`}>
            <tt.icon size={11} strokeWidth={1.5} />
            <span>{tt.label}</span>
          </button>
        ))}
      </div>

      {/* Search + filters */}
      {showFilters && (
        <div className="mp-controls">
          <div className="mp-search">
            <Icons.Search size={11} />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                tab === 'products' ? 'Cerca prodotto, collezione…' : 'Cerca riferimento…'
              }
              data-testid="mood-panel-search"
            />
            {(q || atmosphere || material || profile || brandQ) && (
              <button type="button" onClick={resetFilters} title="Pulisci filtri"
                      data-testid="mood-panel-reset" className="mp-search__clear">
                <Icons.X size={10} />
              </button>
            )}
          </div>

          {tab === 'products' && (
            <div className="mp-brand-input">
              <Icons.Tag size={10} />
              <input
                type="text"
                value={brandQ}
                onChange={(e) => setBrandQ(e.target.value)}
                placeholder="Filtra per brand"
                data-testid="mood-panel-brand-input"
              />
            </div>
          )}

          <ChipRow label="Atmosfera">
            {ATMOSPHERE_CHIPS.map((c) => (
              <Chip key={c} label={c}
                    active={atmosphere === c}
                    onClick={() => setAtmosphere(atmosphere === c ? null : c)}
                    testid={`mood-chip-atm-${c}`} />
            ))}
          </ChipRow>
          <ChipRow label="Materia">
            {MATERIAL_CHIPS.map((c) => (
              <Chip key={c} label={c}
                    active={material === c}
                    onClick={() => setMaterial(material === c ? null : c)}
                    testid={`mood-chip-mat-${c}`} />
            ))}
          </ChipRow>
          <ChipRow label="Destinazione">
            {PROFILE_CHIPS.map((p) => (
              <Chip key={p.key} label={p.label}
                    active={profile === p.key}
                    onClick={() => setProfile(profile === p.key ? null : p.key)}
                    testid={`mood-chip-prof-${p.key}`} />
            ))}
          </ChipRow>
        </div>
      )}

      {/* Body */}
      <div className="mp-body">
        {tab !== 'collections' && (
          items === null ? (
            <div className="mp-grid">
              {Array.from({ length: 6 }).map((_, i) => <TileSkeleton key={i} />)}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={tab === 'products' ? Icons.Package : tab === 'recent' ? Icons.Clock : Icons.Sparkles}
              title={
                tab === 'products' ? 'Nessun prodotto curato'
                : tab === 'recent' ? 'Nessuna selezione recente'
                : 'Nessun riferimento'
              }
              body={
                tab === 'products'
                  ? 'Importa un catalogo fornitore per popolare i Product Inspirations™.'
                  : tab === 'recent'
                  ? 'I riferimenti usati di recente compariranno qui.'
                  : 'Aggiungi un riferimento dall\'archivio Inspirations™.'
              }
            />
          ) : (
            <div className="mp-grid" data-testid="mood-panel-grid">
              {items.map((it) => (
                <Tile key={it.id}
                      item={it}
                      kind={tab === 'products' ? 'product' : 'editorial'}
                      onAdd={(x) => onAddInspiration?.(x, { source_tab: tab, moodboardId })}
                      testid={`mood-tile-${it.id}`} />
              ))}
            </div>
          )
        )}

        {tab === 'collections' && (
          collections === null ? (
            <div className="mp-grid">
              {Array.from({ length: 4 }).map((_, i) => <TileSkeleton key={i} />)}
            </div>
          ) : (collections.length === 0) ? (
            <EmptyState
              icon={Icons.Library}
              title="Nessuna collezione importata"
              body="Importa un catalogo fornitore dall'archivio Inspirations™."
            />
          ) : (
            <div className="mp-collections" data-testid="mood-panel-collections">
              {collectionsByBrand.map(([brand, list]) => (
                <div key={brand} className="mp-col-group">
                  <p className="mp-col-group__eyebrow">{brand}</p>
                  <div className="mp-col-list">
                    {list.map((c) => (
                      <button key={c.id}
                              type="button"
                              className="mp-col-card"
                              data-testid={`mood-col-${c.id}`}
                              onClick={() => {
                                // Switch to products tab pre-filtered by brand
                                setTab('products');
                                setBrandQ(c.brand || '');
                              }}>
                        <span className="mp-col-card__title">{c.collection || 'Collezione'}</span>
                        <span className="mp-col-card__meta">
                          {c.catalog_year && <em>{c.catalog_year} ·</em>} {c.category || ''}
                        </span>
                        <span className="mp-col-card__counts">
                          {c.imported_count || 0} prodotti importati
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

const ChipRow = ({ label, children }) => (
  <div className="mp-chip-row">
    <span className="mp-chip-row__label">{label}</span>
    <div className="mp-chip-row__chips">{children}</div>
  </div>
);

export default MoodPanel;
