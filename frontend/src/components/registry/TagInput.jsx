/**
 * TagInput — reusable tag input with autocomplete + suggested chips.
 *
 * Behavior:
 *   • Enter or comma to commit a tag
 *   • autocomplete from /api/inspirations/registry/tags?type=brand&q=…
 *   • suggested chips below (driven by tag_registry.is_suggested)
 *   • dedupe (case-insensitive · slugified server-side)
 *
 * Catalog driven, multilingual labels (uses `label` directly — labels are
 * already canonical strings from the registry).
 *
 * `value`: array of slugs (or labels — we forward as-is, server slugifies)
 * `onChange(nextLabels)`: emit array
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import api from '../../lib/api';
import './tag-input.css';

const TagInput = ({
  type = 'brand',
  value = [],
  onChange,
  placeholder = 'Aggiungi tag e premi Invio',
  testidPrefix = 'brand-form-tags',
}) => {
  const [input, setInput] = useState('');
  const [autocomplete, setAutocomplete] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [showList, setShowList] = useState(false);
  const wrapRef = useRef(null);

  // Load suggested tags once
  useEffect(() => {
    let canceled = false;
    api
      .get('/api/inspirations/registry/tags', { params: { type, suggested_only: true, limit: 24 } })
      .then(({ data }) => { if (!canceled) setSuggested(data?.items || []); })
      .catch(() => {});
    return () => { canceled = true; };
  }, [type]);

  // Live autocomplete (debounced)
  useEffect(() => {
    if (!input.trim()) {
      setAutocomplete([]);
      return undefined;
    }
    const t = setTimeout(() => {
      api
        .get('/api/inspirations/registry/tags', { params: { type, q: input.trim(), limit: 12 } })
        .then(({ data }) => setAutocomplete(data?.items || []))
        .catch(() => setAutocomplete([]));
    }, 180);
    return () => clearTimeout(t);
  }, [input, type]);

  // Click outside closes
  useEffect(() => {
    if (!showList) return undefined;
    const onClick = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setShowList(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showList]);

  const slugifyClient = (s) =>
    (s || '')
      .toString()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const valueSlugs = useMemo(
    () => new Set((value || []).map((v) => slugifyClient(v))),
    [value]
  );

  const commit = useCallback(
    (label) => {
      const clean = (label || '').toString().trim();
      if (!clean) return;
      const slug = slugifyClient(clean);
      if (!slug || valueSlugs.has(slug)) return;
      onChange?.([...(value || []), clean]);
      setInput('');
      setAutocomplete([]);
    },
    [onChange, value, valueSlugs]
  );

  const remove = (i) => {
    const next = (value || []).slice();
    next.splice(i, 1);
    onChange?.(next);
  };

  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(input);
    } else if (e.key === 'Backspace' && !input && (value || []).length > 0) {
      remove((value || []).length - 1);
    }
  };

  const visibleSuggested = useMemo(
    () => suggested.filter((s) => !valueSlugs.has(s.slug)),
    [suggested, valueSlugs]
  );

  return (
    <div className="tag-input" ref={wrapRef} data-testid={testidPrefix} onMouseDown={(e) => e.stopPropagation()}>
      <div className="tag-input__field" onClick={() => setShowList(true)}>
        {(value || []).map((label, i) => (
          <span
            key={`${slugifyClient(label)}-${i}`}
            className="tag-input__chip"
            data-testid={`${testidPrefix}-chip-${slugifyClient(label)}`}
          >
            <span>{label}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(i); }}
              aria-label={`Rimuovi ${label}`}
              data-testid={`${testidPrefix}-chip-remove-${slugifyClient(label)}`}
            >
              <X size={10} strokeWidth={2} />
            </button>
          </span>
        ))}
        <input
          type="text"
          className="tag-input__entry"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => setShowList(true)}
          placeholder={placeholder}
          data-testid={`${testidPrefix}-entry`}
        />
      </div>

      {showList && input.trim().length > 0 && autocomplete.length > 0 && (
        <ul className="tag-input__autocomplete" data-testid={`${testidPrefix}-autocomplete`} onMouseDown={(e) => e.stopPropagation()}>
          {autocomplete.map((t) => (
            <li key={t.slug}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => { e.stopPropagation(); commit(t.label); }}
                data-testid={`${testidPrefix}-suggest-${t.slug}`}
              >
                <span>{t.label}</span>
                {t.usage_count > 0 && (
                  <em className="tag-input__count">{t.usage_count}</em>
                )}
              </button>
            </li>
          ))}
          {input.trim() && !autocomplete.some(
            (t) => t.slug === slugifyClient(input)
          ) && (
            <li>
              <button
                type="button"
                className="tag-input__create"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => { e.stopPropagation(); commit(input); }}
                data-testid={`${testidPrefix}-create-new`}
              >
                <Plus size={10} strokeWidth={2} />
                <span>Crea “{input.trim()}”</span>
              </button>
            </li>
          )}
        </ul>
      )}

      {visibleSuggested.length > 0 && (
        <div className="tag-input__suggested" data-testid={`${testidPrefix}-suggested`}>
          <span className="tag-input__suggested-label">Tag suggeriti</span>
          <div className="tag-input__suggested-chips">
            {visibleSuggested.slice(0, 12).map((s) => (
              <button
                key={s.slug}
                type="button"
                className="tag-input__suggested-chip"
                onClick={(e) => { e.stopPropagation(); commit(s.label); }}
                data-testid={`${testidPrefix}-suggested-${s.slug}`}
              >
                <Plus size={9} strokeWidth={2} />
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TagInput;
