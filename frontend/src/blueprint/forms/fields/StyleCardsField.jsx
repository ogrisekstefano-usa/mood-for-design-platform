/** StyleCardsField — image-driven multi-select for aesthetic preferences. */
import React from 'react';
import { Check } from 'lucide-react';
import { FieldShell } from './_shared';
import { resolveI18n } from '../FieldRegistry';

const StyleCardsField = ({ field, value, onChange, locale, error }) => {
  const arr = Array.isArray(value) ? value : [];
  const toggle = (v) => {
    if (arr.includes(v)) onChange(arr.filter((x) => x !== v));
    else onChange([...arr, v]);
  };
  return (
    <FieldShell field={field} locale={locale} error={error}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {(field.options || []).map((opt) => {
          const isSelected = arr.includes(opt.value);
          return (
            <button key={opt.value} type="button" onClick={() => toggle(opt.value)}
              data-testid={`opt-${field.key}-${opt.value}`}
              className={`group relative aspect-[3/4] overflow-hidden rounded-[var(--bp-radius-md)] transition-all border ${
                isSelected
                  ? 'border-[var(--bp-primary)] shadow-[var(--bp-shadow-glow)]'
                  : 'border-[var(--bp-border)] hover:border-[var(--bp-border-strong)]'
              }`}>
              {opt.image ? (
                <img src={opt.image} alt={resolveI18n(opt.label, locale)}
                  className={`w-full h-full object-cover transition-transform duration-[var(--bp-duration-cinematic)] ease-[var(--bp-ease)] ${isSelected ? '' : 'group-hover:scale-[1.03]'} bp-img-cinematic`} />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[var(--bp-surface-2)] to-[var(--bp-surface-1)]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-0 inset-x-0 p-4 text-left">
                <h4 className="bp-h3 text-white text-lg leading-tight">{resolveI18n(opt.label, locale)}</h4>
              </div>
              {isSelected && (
                <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-[var(--bp-primary)] flex items-center justify-center">
                  <Check size={14} strokeWidth={2} className="text-[var(--bp-bg)]" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </FieldShell>
  );
};
export default StyleCardsField;
