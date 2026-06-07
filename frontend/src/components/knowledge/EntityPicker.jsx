/**
 * EntityPicker · Spotlight-style universal search (KE-005B.2)
 *
 * Ricerca unica e immediata su prodotti, materiali, designer, brand, immagini
 * del Brand Atlas. L'utente percepisce solo "trova quello che ti serve";
 * non vede mai il dataset sotto.
 *
 * UX refs: macOS Spotlight · Linear Cmd-K · Raycast.
 *
 * Props:
 *   - open: boolean
 *   - onClose: () => void
 *   - onSelect: (entity) => void
 *   - entityTypes: ['product' | 'material' | 'finish' | 'designer' | 'brand' | 'image']
 *   - brandId / catalogSetId: optional filters
 *   - initialQuery: string (optional)
 *   - title: string (header eyebrow)
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Package, Layers, User, Image as ImageIcon,
         Tag, Check, Loader2, X } from 'lucide-react';
import api from '../../lib/api';
import './entity-picker.css';

const TYPE_ICON = {
  product:  Package,
  material: Layers,
  finish:   Layers,
  designer: User,
  brand:    Tag,
  image:    ImageIcon,
};
const TYPE_LABEL = {
  product:  'Prodotto',
  material: 'Materiale',
  finish:   'Finitura',
  designer: 'Designer',
  brand:    'Brand',
  image:    'Immagine',
};

const useDebounced = (value, delay = 220) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
};

const EntityPicker = ({
  open, onClose, onSelect,
  entityTypes = ['product', 'material', 'finish', 'designer', 'brand'],
  brandId, catalogSetId, initialQuery = '',
  title = 'Trova nel tuo Brand Atlas',
}) => {
  const [q, setQ]               = useState(initialQuery);
  const [activeType, setActive] = useState('all');
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef(null);
  const dq = useDebounced(q, 220);

  // Focus on open
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  // Fetch live · uses search endpoint
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const apply = (next) => {
      if (!alive) return;
      setResults(next); setHighlight(0); setLoading(false);
    };
    const typeParam = activeType === 'all' ? entityTypes.join(',') : activeType;
    const params = new URLSearchParams();
    params.set('type', typeParam);
    if (dq) params.set('q', dq);
    if (brandId) params.set('brand_id', brandId);
    if (catalogSetId) params.set('catalog_set_id', catalogSetId);
    params.set('limit', '40');
    api.get(`/api/knowledge/entities/search?${params.toString()}`)
      .then((r) => apply(r.data?.entities || []))
      .catch(() => apply([]));
    return () => { alive = false; };
  }, [open, dq, activeType, entityTypes.join(','), brandId, catalogSetId]);

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[highlight]) onSelect?.(results[highlight]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, results, highlight, onSelect, onClose]);

  const grouped = useMemo(() => {
    // Group by entity_type for display headers
    const map = {};
    for (const r of results) {
      (map[r.entity_type] = map[r.entity_type] || []).push(r);
    }
    return map;
  }, [results]);

  if (!open) return null;

  return (
    <div className="kpicker-backdrop" onMouseDown={(e) => {
      if (e.target.classList.contains('kpicker-backdrop')) onClose();
    }} data-testid="entity-picker-backdrop">
      <div className="kpicker" role="dialog" aria-modal="true"
           data-testid="entity-picker">

        {/* Search bar */}
        <div className="kpicker__search">
          <Search size={18} strokeWidth={1.7} className="kpicker__search-icon" />
          <input ref={inputRef} type="text" value={q}
                 onChange={(e) => setQ(e.target.value)}
                 placeholder={title}
                 className="kpicker__input"
                 data-testid="entity-picker-input" />
          <button type="button" onClick={onClose}
                  className="kpicker__close"
                  data-testid="entity-picker-close"
                  aria-label="Chiudi">
            <X size={15} strokeWidth={1.7} />
          </button>
        </div>

        {/* Filter pills */}
        {entityTypes.length > 1 && (
          <div className="kpicker__filters">
            <button type="button"
                    className={`kpicker__filter ${activeType === 'all' ? 'on' : ''}`}
                    onClick={() => setActive('all')}>
              Tutto
            </button>
            {entityTypes.map((t) => {
              const Icon = TYPE_ICON[t] || Tag;
              return (
                <button key={t} type="button"
                        data-testid={`entity-picker-filter-${t}`}
                        className={`kpicker__filter ${activeType === t ? 'on' : ''}`}
                        onClick={() => setActive(t)}>
                  <Icon size={12} strokeWidth={1.6} />
                  {TYPE_LABEL[t] || t}
                </button>
              );
            })}
          </div>
        )}

        {/* Results */}
        <div className="kpicker__body">
          {loading && results.length === 0 && (
            <div className="kpicker__loading">
              <Loader2 size={16} strokeWidth={1.7} className="kpicker__spin" />
              <span>Cercando nel tuo Brand Atlas…</span>
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="kpicker__empty">
              <p className="kpicker__empty-title">
                Nessun risultato {q ? `per "${q}"` : ''}
              </p>
              <p className="kpicker__empty-sub">
                Prova con un altro termine o cambia tipologia.
              </p>
            </div>
          )}
          {!loading && Object.entries(grouped).map(([type, items], gi) => {
            const Icon = TYPE_ICON[type] || Tag;
            const label = TYPE_LABEL[type] || type;
            return (
              <div key={type} className="kpicker__group">
                <div className="kpicker__group-head">
                  <Icon size={11} strokeWidth={1.6} />
                  <span>{label}</span>
                  <span className="kpicker__group-count">{items.length}</span>
                </div>
                {items.map((it) => {
                  const idx = results.indexOf(it);
                  const certified = !!it.canonical_ref_id || it.status === 'approved';
                  return (
                    <button key={it.id} type="button"
                      data-testid={`entity-picker-result-${it.id}`}
                      className={`kpicker__row ${highlight === idx ? 'on' : ''}`}
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => onSelect?.(it)}>
                      <div className="kpicker__row-icon">
                        <Icon size={14} strokeWidth={1.6} />
                      </div>
                      <div className="kpicker__row-body">
                        <div className="kpicker__row-name">
                          {it.display_name || '—'}
                          {certified && (
                            <span className="kpicker__row-cert" title="Certificato">
                              <Check size={10} strokeWidth={2.3} />
                            </span>
                          )}
                        </div>
                        <div className="kpicker__row-meta">
                          {it.brand_id ? 'Brand · ' : ''}
                          {it.mention_count ? `${it.mention_count} menzioni` : 'Nuovo'}
                        </div>
                      </div>
                      <div className="kpicker__row-action">↵</div>
                    </button>
                  );
                })}
                {gi < Object.keys(grouped).length - 1 && <div className="kpicker__sep" />}
              </div>
            );
          })}
        </div>

        {/* Footer hints */}
        <div className="kpicker__footer">
          <span><kbd>↑↓</kbd> Naviga</span>
          <span><kbd>↵</kbd> Seleziona</span>
          <span><kbd>esc</kbd> Chiudi</span>
        </div>
      </div>
    </div>
  );
};

export default EntityPicker;
