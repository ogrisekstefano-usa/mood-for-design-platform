/**
 * CuratorialInspirationsModal — Phase E · Sprint E3.
 *
 * Fullscreen cinematic overlay che sostituisce la sidebar MOOD verticale.
 * Tavolo curatoriale immersivo, NON fullscreen media picker.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ HEADER · eyebrow Tavolo Curatoriale™ · close                 │
 *   ├────────────┬──────────────────────────────────┬─────────────┤
 *   │  FILTRI    │  Masonry immersive grid          │  Staging    │
 *   │  · search  │  (cinematic cards, hover lift,   │  Tray™      │
 *   │  · chips   │  metadata reveal, ZERO grid      │  (multi-sel │
 *   │  · luxury  │  technical)                      │  drop on    │
 *   │  · markets │                                  │  moodboard) │
 *   └────────────┴──────────────────────────────────┴─────────────┘
 *
 * Linguaggio: "Tavolo selezione", "Riferimenti", "Mood",
 * "Porta nel moodboard". MAI: "media picker", "asset browser".
 *
 * Filtri persistenti via localStorage (chiave per moodboard + globale).
 * Doppio click su tile → addInspirationBlock (preserva display_meta).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as Icons from 'lucide-react';
import api from '../../lib/api';
import { filterCssFor } from '../../components/media/UniversalEditorialCropper';
import './curatorial-modal.css';

const LS_KEY_PREFIX = 'mood.curatorial.filters';

// ── Curated taxonomies (rispecchiano backend) ────────────────────────
const ATMOSPHERE = [
  'mediterraneo', 'editoriale', 'tropicale', 'galleria',
  'organico', 'monocromatico', 'materico', 'cinematico',
];
const MATERIALS = [
  'pietra', 'ottone', 'noce', 'lino', 'marmo', 'velluto',
  'travertino', 'rovere',
];
const MARKETS = [
  { k: 'us-miami',   l: 'Miami' },
  { k: 'us-nyc',     l: 'New York' },
  { k: 'us-socal',   l: 'Southern California' },
  { k: 'it-milano',  l: 'Milano' },
  { k: 'uk-london',  l: 'Londra' },
  { k: 'fr-paris',   l: 'Parigi' },
  { k: 'ae-dubai',   l: 'Dubai' },
];
const LUXURY = [
  { k: 'contemporary', l: 'contemporary' },
  { k: 'premium',      l: 'premium' },
  { k: 'luxury',       l: 'luxury' },
  { k: 'icon',         l: 'icon' },
  { k: 'ultra_luxury', l: 'ultra luxury' },
];
const TYPES = [
  { k: '',          l: 'Tutti i riferimenti' },
  { k: 'editorial', l: 'Inspirations™' },
  { k: 'product',   l: 'Prodotti' },
];

const useDebounced = (v, d = 220) => {
  const [s, setS] = useState(v);
  useEffect(() => {
    const id = setTimeout(() => setS(v), d);
    return () => clearTimeout(id);
  }, [v, d]);
  return s;
};

// ── Persistent filters per moodboard + global fallback ───────────────
const loadFilters = (moodboardId) => {
  try {
    const scoped = localStorage.getItem(`${LS_KEY_PREFIX}:${moodboardId}`);
    if (scoped) return JSON.parse(scoped);
    const global = localStorage.getItem(`${LS_KEY_PREFIX}:_global`);
    if (global) return JSON.parse(global);
  } catch (_) { /* corrupt entry — fall back to defaults */ }
  return { q: '', type: '', atmosphere: '', material: '', market: '', luxury: '', brand: '' };
};
const saveFilters = (moodboardId, f) => {
  try {
    localStorage.setItem(`${LS_KEY_PREFIX}:${moodboardId}`, JSON.stringify(f));
    localStorage.setItem(`${LS_KEY_PREFIX}:_global`, JSON.stringify(f));
  } catch (_) { /* localStorage full or denied — fail silent */ }
};

// ── Curatorial tile ─────────────────────────────────────────────────
const Tile = ({ item, onAdd, onPreview, onToggleStage, staged }) => {
  const dm = item.display_meta || {};
  const focal = `${((dm.focal_x ?? 0.5) * 100).toFixed(0)}% ${((dm.focal_y ?? 0.5) * 100).toFixed(0)}%`;
  const filt = dm.editorial_filter ? filterCssFor(dm.editorial_filter) : 'none';
  const isProduct = item.inspiration_type === 'product';
  const title = item.title || item.product_name || 'Riferimento';

  return (
    <div className={`ci-tile ${staged ? 'is-staged' : ''}`} data-testid={`ci-tile-${item.id}`}>
      <div
        role="button"
        tabIndex={0}
        className="ci-tile__media"
        onClick={() => onPreview?.(item)}
        onDoubleClick={() => onAdd?.(item)}
        onKeyDown={(e) => { if (e.key === 'Enter') onAdd?.(item); }}
        data-testid={`ci-tile-media-${item.id}`}
        title="Click: anteprima · Doppio click: porta nel moodboard"
      >
        {item.image_url ? (
          <img
            src={item.image_url}
            alt=""
            loading="lazy"
            draggable={false}
            style={{
              objectFit: 'cover',
              objectPosition: focal,
              filter: filt === 'none' ? undefined : filt,
            }}
          />
        ) : (
          <div className="ci-tile__empty"><Icons.ImageOff size={16} /></div>
        )}

        {/* Overlay: metadata reveal on hover */}
        <span className="ci-tile__overlay">
          <span className="ci-tile__overlay-top">
            {item.brand && <span className="ci-tile__brand">{item.brand}</span>}
            {isProduct && <span className="ci-tile__type">Prodotto</span>}
          </span>
          <span className="ci-tile__overlay-bottom">
            <span className="ci-tile__title">{title}</span>
            {(item.atmosphere_tags || []).slice(0, 2).map((a) => (
              <span key={a} className="ci-tile__chip">{a}</span>
            ))}
          </span>
        </span>

        {/* Quick-add hover CTA */}
        <button
          type="button"
          className="ci-tile__cta"
          onClick={(e) => { e.stopPropagation(); onAdd?.(item); }}
          data-testid={`ci-tile-add-${item.id}`}
          title="Porta nel moodboard">
          <Icons.Plus size={11} /> Porta nel moodboard
        </button>

        {/* Staging tray toggle (top right) */}
        <button
          type="button"
          className="ci-tile__stage"
          onClick={(e) => { e.stopPropagation(); onToggleStage?.(item); }}
          data-testid={`ci-tile-stage-${item.id}`}
          title={staged ? 'Rimuovi dal tavolo' : 'Aggiungi al tavolo'}>
          {staged ? <Icons.Check size={11} /> : <Icons.Bookmark size={11} />}
        </button>
      </div>
    </div>
  );
};

// ── Quick Preview overlay ───────────────────────────────────────────
const QuickPreview = ({ item, onAdd, onClose }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!item) return null;
  const dm = item.display_meta || {};
  const focal = `${((dm.focal_x ?? 0.5) * 100).toFixed(0)}% ${((dm.focal_y ?? 0.5) * 100).toFixed(0)}%`;
  const filt = dm.editorial_filter ? filterCssFor(dm.editorial_filter) : 'none';
  return (
    <div className="ci-preview" data-testid="ci-quick-preview"
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="ci-preview__panel">
        <div className="ci-preview__media">
          <img src={item.image_url}
               alt=""
               style={{
                 objectFit: 'cover',
                 objectPosition: focal,
                 filter: filt === 'none' ? undefined : filt,
               }} />
        </div>
        <aside className="ci-preview__meta">
          <div>
            <p className="ci-eyebrow">Anteprima</p>
            <h3 className="ci-preview__title">{item.title || item.product_name || 'Riferimento'}</h3>
            {item.brand && <p className="ci-preview__brand">{item.brand}{item.collection && <> · {item.collection}</>}</p>}
          </div>

          {(item.atmosphere_tags || []).length > 0 && (
            <div>
              <p className="ci-eyebrow">Atmosfera</p>
              <div className="ci-chip-cloud">
                {item.atmosphere_tags.map((a) => <span key={a} className="ci-chip">{a}</span>)}
              </div>
            </div>
          )}
          {(item.material_tags || []).length > 0 && (
            <div>
              <p className="ci-eyebrow">Materialità</p>
              <div className="ci-chip-cloud">
                {item.material_tags.map((m) => <span key={m} className="ci-chip ci-chip--material">{m}</span>)}
              </div>
            </div>
          )}
          {item.description && (
            <div>
              <p className="ci-eyebrow">Narrativa</p>
              <p className="ci-preview__desc">{item.description}</p>
            </div>
          )}

          <div className="ci-preview__actions">
            <button type="button" className="ci-btn-soft" onClick={onClose} data-testid="ci-preview-close">
              <Icons.X size={11} /> Chiudi
            </button>
            <button type="button" className="ci-btn" onClick={() => onAdd?.(item)} data-testid="ci-preview-add">
              <Icons.Plus size={11} /> Porta nel moodboard
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

// ── Staging Tray™ ──────────────────────────────────────────────────
const StagingTray = ({ items, onClear, onRemove, onDropAll }) => (
  <aside className="ci-tray" data-testid="ci-staging-tray">
    <header className="ci-tray__head">
      <div>
        <p className="ci-eyebrow">{t('atelier_voice.curatorial_modal.tray_eyebrow', null, 'Curatorial table')}</p>
        <h4 className="ci-tray__title">Selezione</h4>
      </div>
      {items.length > 0 && (
        <button type="button" className="ci-tray__clear" onClick={onClear}
                data-testid="ci-tray-clear" title="Svuota selezione">
          <Icons.RotateCcw size={10} />
        </button>
      )}
    </header>

    {items.length === 0 ? (
      <div className="ci-tray__empty">
        <Icons.Bookmark size={16} strokeWidth={1.3} />
        <p>{t('atelier_voice.curatorial_modal.tray_empty_line1', null, 'Mark the references that matter most.')}<br />{t('atelier_voice.curatorial_modal.tray_empty_line2', null, 'They\u2019ll travel into the moodboard together.')}</p>
      </div>
    ) : (
      <div className="ci-tray__list" data-testid="ci-tray-list">
        {items.map((it) => (
          <div key={it.id} className="ci-tray__row" data-testid={`ci-tray-row-${it.id}`}>
            <div className="ci-tray__thumb">
              <img src={it.image_url} alt="" />
            </div>
            <div className="ci-tray__info">
              <span className="ci-tray__row-title">{it.title || it.product_name}</span>
              {it.brand && <span className="ci-tray__row-brand">{it.brand}</span>}
            </div>
            <button type="button" className="ci-tray__remove"
                    onClick={() => onRemove(it.id)}
                    data-testid={`ci-tray-remove-${it.id}`}
                    title="Rimuovi dal tavolo">
              <Icons.X size={10} />
            </button>
          </div>
        ))}
      </div>
    )}

    {items.length > 0 && (
      <footer className="ci-tray__foot">
        <button type="button" className="ci-btn" onClick={onDropAll}
                data-testid="ci-tray-drop-all">
          <Icons.Layers size={11} /> Porta tutti nel moodboard
        </button>
      </footer>
    )}
  </aside>
);

// ── Main modal ─────────────────────────────────────────────────────
const CuratorialInspirationsModal = ({ open, onClose, moodboardId, onAddInspiration }) => {
  const [filters, setFilters] = useState(() => loadFilters(moodboardId));
  const [items, setItems] = useState(null);
  const [staged, setStaged] = useState([]);
  const [preview, setPreview] = useState(null);
  const dq = useDebounced(filters.q, 240);
  const reqRef = useRef(0);

  // Save filters whenever they change
  useEffect(() => {
    if (open) saveFilters(moodboardId, filters);
  }, [filters, moodboardId, open]);

  // Fetch on filter change
  useEffect(() => {
    if (!open) return;
    const seq = ++reqRef.current;
    setItems(null);
    const params = { limit: 80 };
    if (dq) params.q = dq;
    if (filters.type) params.inspiration_type = filters.type;
    if (filters.atmosphere) params.atmosphere = filters.atmosphere;
    if (filters.material) params.material = filters.material;
    if (filters.market) params.market = filters.market;
    if (filters.luxury) params.luxury = filters.luxury;
    if (filters.brand) params.brand = filters.brand;
    api.get('/api/inspirations/archive', { params })
      .then((r) => { if (reqRef.current === seq) setItems(r.data?.items || []); })
      .catch(() => { if (reqRef.current === seq) setItems([]); });
  }, [open, dq, filters.type, filters.atmosphere, filters.material,
      filters.market, filters.luxury, filters.brand]);

  // Escape close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape' && !preview) onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, preview]);

  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: f[k] === v ? '' : v }));
  const setRawF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const resetFilters = () => setFilters({ q: '', type: '', atmosphere: '', material: '', market: '', luxury: '', brand: '' });

  const isStaged = (id) => staged.some((s) => s.id === id);
  const toggleStage = (item) => {
    setStaged((s) => isStaged(item.id) ? s.filter((x) => x.id !== item.id) : [...s, item]);
  };
  const removeStaged = (id) => setStaged((s) => s.filter((x) => x.id !== id));

  const handleAdd = (item) => {
    onAddInspiration?.(item, { source_tab: item.inspiration_type === 'product' ? 'products' : 'inspirations',
                               moodboardId });
    setPreview(null);
  };
  const dropAll = () => {
    staged.forEach((it) => onAddInspiration?.(it, { source_tab: it.inspiration_type === 'product' ? 'products' : 'inspirations',
                                                    moodboardId }));
    setStaged([]);
  };

  const activeFiltersCount = useMemo(() => (
    [filters.type, filters.atmosphere, filters.material, filters.market, filters.luxury, filters.brand]
      .filter(Boolean).length + (filters.q ? 1 : 0)
  ), [filters]);

  if (!open) return null;

  return createPortal(
    <div className="ci-overlay" data-testid="curatorial-inspirations-modal">
      <header className="ci-overlay__head">
        <div>
          <p className="ci-eyebrow">{t('atelier_voice.curatorial_modal.head_eyebrow', null, 'Curatorial table \u00B7 Inspirations\u2122')}</p>
          <h2 className="ci-overlay__title">
            {t('atelier_voice.curatorial_modal.head_title_lead', null, 'Compose')} <em>{t('atelier_voice.curatorial_modal.head_title_em', null, 'design references')}</em>
          </h2>
        </div>
        <button type="button" className="ci-overlay__close"
                onClick={onClose}
                data-testid="ci-overlay-close"
                aria-label="Chiudi tavolo">
          <Icons.X size={13} />
        </button>
      </header>

      <div className="ci-overlay__body">
        {/* Left filters */}
        <aside className="ci-filters" data-testid="ci-filters">
          <div className="ci-filters__search">
            <Icons.Search size={11} />
            <input
              type="text"
              value={filters.q}
              onChange={(e) => setRawF('q', e.target.value)}
              placeholder="Cerca riferimento, brand, narrativa…"
              data-testid="ci-search"
            />
            {activeFiltersCount > 0 && (
              <button type="button" onClick={resetFilters}
                      className="ci-filters__reset"
                      data-testid="ci-filters-reset"
                      title="Pulisci tutto">
                <Icons.X size={10} />
              </button>
            )}
          </div>

          <div className="ci-filter-group">
            <p className="ci-filter-group__lbl">Tipologia</p>
            <div className="ci-pills">
              {TYPES.map((t) => (
                <button key={t.k || 'all'} type="button"
                        className={`ci-pill ${filters.type === t.k ? 'is-on' : ''}`}
                        onClick={() => setRawF('type', t.k)}
                        data-testid={`ci-type-${t.k || 'all'}`}>
                  {t.l}
                </button>
              ))}
            </div>
          </div>

          <div className="ci-filter-group">
            <p className="ci-filter-group__lbl">Atmosfera</p>
            <div className="ci-pills">
              {ATMOSPHERE.map((a) => (
                <button key={a} type="button"
                        className={`ci-pill ${filters.atmosphere === a ? 'is-on' : ''}`}
                        onClick={() => setF('atmosphere', a)}
                        data-testid={`ci-atm-${a}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="ci-filter-group">
            <p className="ci-filter-group__lbl">Materialità</p>
            <div className="ci-pills">
              {MATERIALS.map((m) => (
                <button key={m} type="button"
                        className={`ci-pill ci-pill--mat ${filters.material === m ? 'is-on' : ''}`}
                        onClick={() => setF('material', m)}
                        data-testid={`ci-mat-${m}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="ci-filter-group">
            <p className="ci-filter-group__lbl">Geografie</p>
            <div className="ci-pills">
              {MARKETS.map((m) => (
                <button key={m.k} type="button"
                        className={`ci-pill ${filters.market === m.k ? 'is-on' : ''}`}
                        onClick={() => setF('market', m.k)}
                        data-testid={`ci-mkt-${m.k}`}>
                  {m.l}
                </button>
              ))}
            </div>
          </div>

          <div className="ci-filter-group">
            <p className="ci-filter-group__lbl">Tono luxury</p>
            <div className="ci-pills">
              {LUXURY.map((l) => (
                <button key={l.k} type="button"
                        className={`ci-pill ${filters.luxury === l.k ? 'is-on' : ''}`}
                        onClick={() => setF('luxury', l.k)}
                        data-testid={`ci-lux-${l.k}`}>
                  {l.l}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Center grid */}
        <main className="ci-grid-wrap">
          {items === null ? (
            <div className="ci-grid">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="ci-tile ci-tile--skel">
                  <div className="ci-tile__media"><div className="ci-shimmer" /></div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="ci-empty">
              <div className="ci-empty__ring"><Icons.Sparkles size={18} strokeWidth={1.3} /></div>
              <h3>Nessun riferimento corrisponde</h3>
              <p>{t('atelier_voice.curatorial_modal.empty_lede', null, 'Broaden the atmosphere, materiality or geography to read other design languages from the studio.')}</p>
            </div>
          ) : (
            <div className="ci-grid" data-testid="ci-grid">
              {items.map((it) => (
                <Tile key={it.id}
                      item={it}
                      staged={isStaged(it.id)}
                      onAdd={handleAdd}
                      onPreview={setPreview}
                      onToggleStage={toggleStage} />
              ))}
            </div>
          )}
        </main>

        {/* Right Staging Tray */}
        <StagingTray
          items={staged}
          onClear={() => setStaged([])}
          onRemove={removeStaged}
          onDropAll={dropAll}
        />
      </div>

      {/* Quick preview overlay */}
      <QuickPreview item={preview} onAdd={handleAdd} onClose={() => setPreview(null)} />
    </div>,
    document.body
  );
};

export default CuratorialInspirationsModal;
