/**
 * ITER204 · Studio Library Bridge™ — Permanent curatorial heritage.
 *
 * The library that sits BETWEEN Brand Atlas (discovery) and Moodboards
 * (creation). Every brand, collection, product, material or designer
 * the studio finds worth keeping lives here. Design Journeys feed from
 * this library; they do not replace it.
 *
 * Layout:
 *   - Editorial header (no white) with global counter
 *   - Type filters (Brand · Collection · Product · Material · Designer)
 *   - Grid of saved items, hydrated server-side
 *   - Empty state with a path back to Brand Atlas
 *
 * Theme: 100% Blueprint tokens (no hardcoded colors).
 * i18n:  every label goes through t('studio_library.*').
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';

import { useBlueprint } from '../../contexts/BlueprintContext';
import SL from '../../lib/studioLibraryApi';
import './studio-library.css';

const TYPE_META = [
  { key: 'all',        icon: 'Library',   labelKey: 'studio_library.types.all',        fallback: 'Tutti' },
  { key: 'brand',      icon: 'Building2', labelKey: 'studio_library.types.brand',      fallback: 'Brand' },
  { key: 'collection', icon: 'Boxes',     labelKey: 'studio_library.types.collection', fallback: 'Collezioni' },
  { key: 'product',    icon: 'Package',   labelKey: 'studio_library.types.product',    fallback: 'Prodotti' },
  { key: 'material',   icon: 'Palette',   labelKey: 'studio_library.types.material',   fallback: 'Materiali' },
  { key: 'designer',   icon: 'User',      labelKey: 'studio_library.types.designer',   fallback: 'Designer' },
];

export default function StudioLibraryPage() {
  const { t } = useBlueprint();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);     // null = loading
  const [stats, setStats] = useState({ total: 0, counts: {} });
  const [activeType, setActiveType] = useState('all');
  const [q, setQ] = useState('');

  const reload = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([
        SL.listLibraryResolved(activeType === 'all' ? {} : { entity_type: activeType }),
        SL.libraryStats(),
      ]);
      setItems(r.data?.items || []);
      setStats(s.data || { total: 0, counts: {} });
    } catch (e) {
      setItems([]);
    }
  }, [activeType]);

  useEffect(() => { reload(); }, [reload]);

  const handleRemove = useCallback(async (item) => {
    try {
      await SL.removeLibraryItem(item.id);
      setItems((arr) => (arr || []).filter((x) => x.id !== item.id));
      toast.success(t('studio_library.remove.success', null, 'Rimosso dalla Studio Library'));
      // refresh stats
      try { const s = await SL.libraryStats(); setStats(s.data); } catch {}
    } catch (e) {
      toast.error(e?.response?.data?.detail
        || t('studio_library.remove.error', null, 'Rimozione fallita'));
    }
  }, [t]);

  const filtered = useMemo(() => {
    if (!items) return null;
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((it) => {
      const name = (it.entity?.name
        || it.entity?.display_name
        || it.entity?.product_name
        || '').toLowerCase();
      return name.includes(needle);
    });
  }, [items, q]);

  // ─── Header
  return (
    <div data-testid="studio-library-page" className="sl-page">
      <header className="sl-page__head">
        <div className="sl-page__heading">
          <p className="sl-page__eyebrow" data-testid="studio-library-eyebrow">
            {t('studio_library.eyebrow', null, 'Patrimonio curatoriale')}
          </p>
          <h1 className="sl-page__title" data-testid="studio-library-title">
            Studio Library<span className="sl-mark">™</span>
          </h1>
          <p className="sl-page__subtitle" data-testid="studio-library-subtitle">
            {t('studio_library.subtitle', null,
                'Brand, collezioni, prodotti, materiali e designer che lo studio ha scelto di conservare. Da qui partono i Design Journey e le Moodboard.')}
          </p>
        </div>
        <div className="sl-page__count" data-testid="studio-library-count">
          <span className="sl-page__count-num">{stats.total ?? 0}</span>
          <span className="sl-page__count-label">
            {t('studio_library.total', null, 'salvati')}
          </span>
        </div>
      </header>

      <div className="sl-page__toolbar">
        <div className="sl-filters" role="tablist" data-testid="studio-library-filters">
          {TYPE_META.map((tm) => {
            const Icon = Icons[tm.icon] || Icons.Circle;
            const count = tm.key === 'all'
              ? stats.total
              : (stats.counts?.[tm.key] || 0);
            const active = activeType === tm.key;
            return (
              <button
                key={tm.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveType(tm.key)}
                data-testid={`studio-library-filter-${tm.key}`}
                className={`sl-filter ${active ? 'sl-filter--active' : ''}`}
              >
                <Icon size={14} strokeWidth={1.5} />
                <span>{t(tm.labelKey, null, tm.fallback)}</span>
                <span className="sl-filter__count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="sl-search" data-testid="studio-library-search">
          <Icons.Search size={14} strokeWidth={1.5} />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('studio_library.search.placeholder', null,
                            'Cerca per nome…')}
            data-testid="studio-library-search-input"
          />
        </div>
      </div>

      {/* ─── Grid / states */}
      {filtered === null && (
        <div className="sl-state" data-testid="studio-library-loading">
          {t('studio_library.loading', null, 'Sto leggendo l’archivio…')}
        </div>
      )}

      {filtered !== null && filtered.length === 0 && (
        <div className="sl-empty" data-testid="studio-library-empty">
          <Icons.Library size={28} strokeWidth={1.4} />
          <h3>{t('studio_library.empty.title', null, 'Lo scaffale è ancora vuoto')}</h3>
          <p>
            {t('studio_library.empty.body', null,
                'Visita la Brand Atlas e salva i brand, le collezioni o i materiali che vuoi avere a portata di mano per ogni progetto.')}
          </p>
          <button
            type="button"
            className="sl-empty__cta"
            onClick={() => navigate('/inspirations/brands')}
            data-testid="studio-library-empty-cta"
          >
            <Icons.Compass size={14} strokeWidth={1.5} />
            {t('studio_library.empty.cta', null, 'Esplora Brand Atlas')}
          </button>
        </div>
      )}

      {filtered !== null && filtered.length > 0 && (
        <div className="sl-grid" data-testid="studio-library-grid">
          {filtered.map((it) => (
            <LibraryCard key={it.id} item={it}
                          onRemove={handleRemove}
                          t={t}
                          navigate={navigate} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────
const LibraryCard = ({ item, onRemove, t, navigate }) => {
  const e = item.entity || {};
  const name = e.name || e.display_name || e.product_name
    || t('studio_library.missing.name', null, 'Voce rimossa');

  const subtitle = (() => {
    if (item.entity_type === 'brand') {
      return e.hero_subtitle || e.positioning || e.luxury_tier || '';
    }
    if (item.entity_type === 'collection') return e.collection_key || '';
    if (item.entity_type === 'material')   return e.material_key   || '';
    if (item.entity_type === 'designer')   return e.designer_key   || '';
    return '';
  })();

  const image = item.entity_type === 'brand'
    ? (e.hero_image_url || e.logo_url || null)
    : null;

  const onOpen = () => {
    if (item.missing) return;
    if (item.entity_type === 'brand') {
      navigate(`/inspirations/brands/${item.entity_id}`);
    } else if (item.entity_type === 'product') {
      navigate(`/inspirations/products/${item.entity_id}`);
    } else if (item.entity_type === 'material') {
      navigate(`/library/materials`);
    }
  };

  const TypeIcon = (() => {
    const map = {
      brand: Icons.Building2,
      collection: Icons.Boxes,
      product: Icons.Package,
      material: Icons.Palette,
      designer: Icons.User,
    };
    return map[item.entity_type] || Icons.Circle;
  })();

  return (
    <article
      className={`sl-card ${item.missing ? 'sl-card--missing' : ''}`}
      data-testid={`studio-library-card-${item.entity_type}-${item.entity_id}`}
    >
      <button
        type="button"
        className="sl-card__media"
        onClick={onOpen}
        data-testid={`studio-library-card-open-${item.entity_id}`}
        aria-label={name}
      >
        {image ? (
          <img src={image} alt="" loading="lazy" draggable={false} />
        ) : (
          <span className="sl-card__placeholder">
            <TypeIcon size={28} strokeWidth={1.2} />
          </span>
        )}
        <span className="sl-card__type-pill">
          <TypeIcon size={10} strokeWidth={1.6} />
          {t(`studio_library.types.${item.entity_type}`, null, item.entity_type)}
        </span>
      </button>

      <div className="sl-card__body">
        <h3 className="sl-card__title" title={name}>{name}</h3>
        {subtitle && <p className="sl-card__subtitle">{subtitle}</p>}
        {item.notes && <p className="sl-card__notes">{item.notes}</p>}
      </div>

      <div className="sl-card__footer">
        <span className="sl-card__meta">
          {item.source_type
            ? t(`studio_library.source.${item.source_type}`, null, item.source_type)
            : t('studio_library.source.manual', null, 'manuale')}
        </span>
        <button
          type="button"
          className="sl-card__remove"
          onClick={() => onRemove(item)}
          aria-label={t('studio_library.remove.aria', null, 'Rimuovi dalla Library')}
          data-testid={`studio-library-card-remove-${item.entity_id}`}
        >
          <Icons.X size={13} strokeWidth={1.7} />
        </button>
      </div>
    </article>
  );
};
