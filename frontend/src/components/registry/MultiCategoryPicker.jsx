/**
 * MultiCategoryPicker — Brand Registry™ multi-select categories.
 *
 * UI:
 *   • selected chips (with × remove)
 *   • "+ Aggiungi categoria" → popover with searchable list
 *   • optional suggested chips block below (when no selection yet)
 *
 * Catalog driven: /api/inspirations/registry/brand-categories
 * Multilingual: label_it / label_en
 * NO hardcoded values · NO hardcoded colors (CSS variables only)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X, Search } from 'lucide-react';
import api from '../../lib/api';
import './multi-category-picker.css';

const MultiCategoryPicker = ({
  value = [],
  onChange,
  locale = 'it',
  testidPrefix = 'brand-form-categories',
}) => {
  const [catalog, setCatalog] = useState([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  const popoverRef = useRef(null);

  // Load catalog once
  useEffect(() => {
    let canceled = false;
    api.get('/api/inspirations/registry/brand-categories')
      .then(({ data }) => { if (!canceled) setCatalog(data?.data || []); })
      .catch(() => {});
    return () => { canceled = true; };
  }, []);

  // Click outside closes
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const labelFor = useCallback(
    (cat) => (locale === 'en' ? cat.label_en : cat.label_it),
    [locale]
  );

  const byKey = useMemo(() => {
    const map = {};
    for (const c of catalog) map[c.key] = c;
    return map;
  }, [catalog]);

  const selected = (value || []).filter((k) => byKey[k]);
  const selectedSet = new Set(selected);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return catalog.filter((c) => {
      if (selectedSet.has(c.key)) return false;
      if (!ql) return true;
      return (
        c.key.includes(ql) ||
        (c.label_it || '').toLowerCase().includes(ql) ||
        (c.label_en || '').toLowerCase().includes(ql)
      );
    });
  }, [catalog, q, selectedSet]);

  const suggested = useMemo(
    () => catalog.filter((c) => c.is_suggested && !selectedSet.has(c.key)),
    [catalog, selectedSet]
  );

  const add = (k) => {
    if (selectedSet.has(k)) return;
    onChange?.([...selected, k]);
    setQ('');
  };
  const remove = (k) => {
    onChange?.(selected.filter((x) => x !== k));
  };

  // Safety: prevent the popover's pointer events from bubbling to any
  // modal-level dismiss handler (the BrandFormModal backdrop closes on
  // mouseDown when target===backdrop, but defensive stopPropagation
  // protects against future click-outside wrappers and stacking quirks).
  const stop = (e) => e.stopPropagation();

  return (
    <div className="mcp" data-testid={testidPrefix} onMouseDown={stop}>
      <div className="mcp__chips">
        {selected.map((k) => {
          const c = byKey[k];
          return (
            <button
              key={k}
              type="button"
              className="mcp__chip mcp__chip--selected"
              onClick={(e) => { e.stopPropagation(); remove(k); }}
              data-testid={`${testidPrefix}-chip-${k}`}
              aria-label={`Rimuovi ${labelFor(c)}`}
            >
              <span>{labelFor(c)}</span>
              <X size={10} strokeWidth={2} />
            </button>
          );
        })}

        <div className="mcp__add-wrap" ref={popoverRef}>
          <button
            type="button"
            className="mcp__add"
            onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
            data-testid={`${testidPrefix}-add`}
          >
            <Plus size={11} strokeWidth={2} />
            <span>Aggiungi categoria</span>
          </button>

          {open && (
            <div
              className="mcp__popover"
              data-testid={`${testidPrefix}-popover`}
              onMouseDown={stop}
              onClick={stop}
            >
              <div className="mcp__search">
                <Search size={11} strokeWidth={1.6} />
                <input
                  ref={inputRef}
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Cerca categoria…"
                  data-testid={`${testidPrefix}-search`}
                />
              </div>
              <ul className="mcp__list">
                {filtered.length === 0 && (
                  <li className="mcp__empty">Nessuna categoria disponibile</li>
                )}
                {filtered.map((c) => (
                  <li key={c.key}>
                    <button
                      type="button"
                      className="mcp__row"
                      onMouseDown={(e) => {
                        // Commit on mousedown so the document-level
                        // outside-click handler can't dismiss the
                        // popover before onClick has a chance to fire.
                        e.stopPropagation();
                        add(c.key);
                      }}
                      data-testid={`${testidPrefix}-option-${c.key}`}
                    >
                      <span className="mcp__row-label">{labelFor(c)}</span>
                      {c.is_suggested && (
                        <span className="mcp__row-tag">suggerita</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {selected.length === 0 && suggested.length > 0 && (
        <div className="mcp__suggested" data-testid={`${testidPrefix}-suggested`}>
          <span className="mcp__suggested-label">Categorie suggerite</span>
          <div className="mcp__suggested-chips">
            {suggested.slice(0, 9).map((c) => (
              <button
                key={c.key}
                type="button"
                className="mcp__chip mcp__chip--ghost"
                onClick={(e) => { e.stopPropagation(); add(c.key); }}
                data-testid={`${testidPrefix}-suggest-${c.key}`}
              >
                <Plus size={9} strokeWidth={2} />
                <span>{labelFor(c)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiCategoryPicker;
