/**
 * UnifiedMediaPickerModal · ITER148 Phase 2 MVP.
 *
 * SINGLE source of truth for media selection across MOOD. Reads the
 * `media_library` archive (via `/api/media`), shows each asset with:
 *   · master thumbnail
 *   · variant count + chip preview
 *   · Used-In™ map (lazy-loaded on hover/click)
 *   · filter preset preview strip (DB-driven)
 *
 * Hard rule: this modal NEVER uploads — uploads go through the existing
 * `routers/storage.py` upload flow. This modal only PICKS already-
 * registered assets, in keeping with the "no image duplication"
 * principle: the master asset is immutable.
 *
 * Future scope (deferred):
 *   - non-destructive crop editor
 *   - focal point picker
 *   - filter preview live-render
 *   - upload-from-here action (will reuse the existing Media Library
 *     upload endpoint, NOT a new modal)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Search, Layers, Eye, BookOpen } from 'lucide-react';
import api from '../../lib/api';
import useMediaLibrary from '../../hooks/useMediaLibrary';
import './unified-media-picker.css';

const FilterStrip = ({ presets, activeKey, onSelect }) => (
  <ul className="ump-filters" data-testid="ump-filter-strip">
    {presets.map((p) => (
      <li key={p.preset_key}>
        <button
          type="button"
          className={`ump-filter ${activeKey === p.preset_key ? 'is-active' : ''}`}
          onClick={() => onSelect(p.preset_key)}
          title={p.description || p.label}
          data-testid={`ump-filter-${p.preset_key}`}
        >
          <span className="ump-filter__chip" style={{ filter: p.css_filter, background: p.overlay_color || '#1a2230' }} />
          <span className="ump-filter__label">{p.label}</span>
        </button>
      </li>
    ))}
  </ul>
);

const UsedInPanel = ({ assetId, open }) => {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open || !assetId) return;
    let cancelled = false;
    setLoading(true);
    api.get(`/api/media-system/assets/${assetId}/usage`)
      .then((r) => { if (!cancelled) setUsage(r.data); })
      .catch(() => { if (!cancelled) setUsage({ total: 0, by_type: {} }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [assetId, open]);
  if (!open) return null;
  return (
    <div className="ump-usedin" data-testid="ump-usedin">
      <h4 className="ump-usedin__title">Used in</h4>
      {loading && <p className="ump-usedin__loading">Reading the relational map…</p>}
      {!loading && usage && usage.total === 0 && (
        <p className="ump-usedin__empty">Not yet placed anywhere · master asset awaits its first use.</p>
      )}
      {!loading && usage && usage.total > 0 && (
        <ul className="ump-usedin__list">
          {Object.entries(usage.by_type).map(([type, rows]) => (
            <li key={type}>
              <span className="ump-usedin__type">{type}</span>
              <span className="ump-usedin__count">{rows.length}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const AssetTile = ({ asset, selected, onPick, activeFilter, presetsMap }) => {
  const [showUsage, setShowUsage] = useState(false);
  const preset = presetsMap[activeFilter] || presetsMap.none;
  const img = asset.display_url || asset.file_url || asset.thumbnail_url || asset.signed_url;
  const title = asset.title || asset.file_name || asset.filename || 'untitled';
  const overlay = preset?.overlay_color
    ? { background: preset.overlay_color, opacity: Math.max(0, Math.min(1, Number(preset.overlay_alpha || 0))) }
    : null;
  return (
    <article
      className={`ump-tile ${selected ? 'is-selected' : ''}`}
      data-testid={`ump-tile-${asset.id}`}
      onClick={() => onPick(asset)}
    >
      <div className="ump-tile__frame">
        {img
          ? <img
              src={img}
              alt={asset.alt_text || asset.title || ''}
              loading="lazy"
              style={{ filter: preset?.css_filter || 'none' }}
            />
          : <span className="ump-tile__no-image">·</span>}
        {overlay && <span className="ump-tile__overlay" style={overlay} />}
      </div>
      <div className="ump-tile__body">
        <h5 className="ump-tile__title">{title}</h5>
        <div className="ump-tile__meta">
          <span><Layers size={13} /> {asset.variant_count ?? 0}</span>
          <button
            type="button"
            className="ump-tile__usedin-toggle"
            onClick={(e) => { e.stopPropagation(); setShowUsage((s) => !s); }}
            data-testid={`ump-tile-usedin-${asset.id}`}
          >
            <BookOpen size={13} /> used in
          </button>
        </div>
      </div>
      <UsedInPanel assetId={asset.id} open={showUsage} />
    </article>
  );
};

const UnifiedMediaPickerModal = ({ open, onClose, onPick, accept = 'image' }) => {
  const [q, setQ] = useState('');
  const [activeFilter, setActiveFilter] = useState('none');
  const [picked, setPicked] = useState(null);
  const [presets, setPresets] = useState([]);
  const { items, total, loading } = useMediaLibrary({ q, limit: 60, mediaType: accept });

  useEffect(() => {
    if (!open) return;
    api.get('/api/media-system/filter-presets')
      .then((r) => setPresets(r.data?.presets || []))
      .catch(() => setPresets([]));
  }, [open]);

  const presetsMap = useMemo(() => {
    const m = {};
    presets.forEach(p => { m[p.preset_key] = p; });
    return m;
  }, [presets]);

  const handlePick = useCallback((asset) => {
    setPicked(asset);
  }, []);

  const handleConfirm = () => {
    if (picked && onPick) onPick({ asset: picked, filter_preset: activeFilter });
    if (onClose) onClose();
  };

  if (!open) return null;
  return (
    <div className="ump-modal" data-testid="ump-modal" role="dialog" aria-modal="true">
      <div className="ump-modal__scrim" onClick={onClose} aria-hidden="true" />
      <section className="ump-modal__panel">
        <header className="ump-modal__top">
          <div>
            <span className="ump-modal__eyebrow">Media Library™</span>
            <h2 className="ump-modal__title">Pick from the studio archive</h2>
            <p className="ump-modal__sub">
              One library · master assets are immutable · variants are metadata.
            </p>
          </div>
          <button type="button" className="ump-modal__close" onClick={onClose} aria-label="Close" data-testid="ump-modal-close">
            <X size={20} strokeWidth={1.5} />
          </button>
        </header>

        <div className="ump-modal__search">
          <Search size={16} />
          <input
            type="search"
            placeholder="Search archive · title, tag, filename…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="ump-search"
          />
          <span className="ump-modal__count" data-testid="ump-count">
            <strong>{total}</strong> assets
          </span>
        </div>

        {presets.length > 0 && (
          <FilterStrip
            presets={presets}
            activeKey={activeFilter}
            onSelect={setActiveFilter}
          />
        )}

        <div className="ump-modal__grid" data-testid="ump-grid">
          {loading && [1,2,3,4,5,6].map(i => <div key={i} className="ump-tile ump-tile--skeleton" />)}
          {!loading && items.length === 0 && (
            <div className="ump-empty" data-testid="ump-empty">
              <p className="ump-empty__title">The archive is empty.</p>
              <p className="ump-empty__sub">Upload an asset from the Media Library page · this picker reads from the same source of truth.</p>
            </div>
          )}
          {!loading && items.map((a) => (
            <AssetTile
              key={a.id}
              asset={a}
              selected={picked?.id === a.id}
              onPick={handlePick}
              activeFilter={activeFilter}
              presetsMap={presetsMap}
            />
          ))}
        </div>

        <footer className="ump-modal__foot">
          <div className="ump-modal__foot-left">
            {picked && (
              <span className="ump-modal__picked" data-testid="ump-modal-picked">
                <Eye size={14} /> {picked.title || picked.file_name || picked.filename}
                {activeFilter !== 'none' && <em> · {presetsMap[activeFilter]?.label}</em>}
              </span>
            )}
          </div>
          <div className="ump-modal__foot-actions">
            <button type="button" className="ump-modal__btn ump-modal__btn--ghost" onClick={onClose} data-testid="ump-modal-cancel">
              Cancel
            </button>
            <button
              type="button"
              className="ump-modal__btn ump-modal__btn--primary"
              onClick={handleConfirm}
              disabled={!picked}
              data-testid="ump-modal-confirm"
            >
              Use this asset
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};

export default UnifiedMediaPickerModal;
