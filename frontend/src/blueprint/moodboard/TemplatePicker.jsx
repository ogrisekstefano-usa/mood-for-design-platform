/**
 * TemplatePicker — Quick-start template picker for the moodboard create flow.
 *
 * Loads platform + tenant templates from `/api/templates` and exposes a
 * "Blank canvas" tile + one card per template. Selection is purely local; the
 * parent decides whether to call `/api/moodboards` (blank) or
 * `/api/templates/{id}/apply` (from template).
 *
 * 100% Blueprint-driven:
 *  - All copy via t()
 *  - All colors via var(--bp-*)
 *  - Locale is forwarded to the API so server returns localized name/desc
 */
import React, { useEffect, useState } from 'react';
import { Sparkles, FilePlus, Check } from 'lucide-react';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';

const Tile = ({ active, eyebrow, title, description, onClick, testid }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testid}
    className={`text-left p-4 rounded-[var(--bp-radius-sm)] border transition-colors w-full
      ${active
        ? 'border-[var(--bp-primary)] bg-[var(--bp-surface-2)]'
        : 'border-[var(--bp-border)] bg-[var(--bp-surface-1)] hover:border-[var(--bp-border-strong)]'}`}
  >
    <div className="flex items-start justify-between gap-3 mb-1.5">
      <p className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)]">{eyebrow}</p>
      {active && <Check size={12} strokeWidth={2} className="text-[var(--bp-primary)] flex-shrink-0 mt-0.5" />}
    </div>
    <h4 className="bp-body !text-sm !font-medium text-[var(--bp-text-primary)] mb-1 truncate">{title}</h4>
    {description && (
      <p className="bp-caption !text-[11px] text-[var(--bp-text-muted)] line-clamp-2">{description}</p>
    )}
  </button>
);

const TemplatePicker = ({ value, onChange }) => {
  const { t, locale } = useBlueprint();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/api/templates', { params: { starter_only: true, locale } })
      .then((r) => { if (!cancelled) setItems(r.data?.data || []); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [locale]);

  return (
    <div data-testid="template-picker">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={12} strokeWidth={1.5} className="text-[var(--bp-text-muted)]" />
        <p className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)]">
          {t('moodboards.templates.eyebrow')}
        </p>
      </div>

      {loading ? (
        <div className="py-8 flex justify-center">
          <div className="w-4 h-4 border-2 border-[var(--bp-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
          <Tile
            active={!value}
            eyebrow={<FilePlus size={11} strokeWidth={1.5} className="inline" />}
            title={t('moodboards.templates.blank')}
            description={t('moodboards.templates.blankDesc')}
            onClick={() => onChange(null)}
            testid="template-blank"
          />
          {items.map((tpl) => (
            <Tile
              key={tpl.id}
              active={value === tpl.id}
              eyebrow={t(`moodboards.templates.category.${tpl.category}`) || tpl.category}
              title={tpl.name}
              description={tpl.description}
              onClick={() => onChange(tpl.id)}
              testid={`template-card-${tpl.slug}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TemplatePicker;
