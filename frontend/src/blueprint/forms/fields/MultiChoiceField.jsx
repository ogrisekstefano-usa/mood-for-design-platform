import React from 'react';
import { FieldShell } from './_shared';
import { resolveI18n } from '../FieldRegistry';

const MultiChoiceField = ({ field, value, onChange, locale, error }) => {
  const arr = Array.isArray(value) ? value : [];
  const toggle = (v) => {
    if (arr.includes(v)) onChange(arr.filter((x) => x !== v));
    else onChange([...arr, v]);
  };
  return (
    <FieldShell field={field} locale={locale} error={error}>
      <div className="flex flex-wrap gap-2">
        {(field.options || []).map((opt) => {
          const isSelected = arr.includes(opt.value);
          return (
            <button key={opt.value} type="button" onClick={() => toggle(opt.value)}
              data-testid={`opt-${field.key}-${opt.value}`}
              className={`px-5 py-3 rounded-[var(--bp-radius-pill)] border transition-all ${
                isSelected
                  ? 'border-[var(--bp-primary)] bg-[var(--bp-primary)]/10 text-[var(--bp-primary)]'
                  : 'border-[var(--bp-border-strong)] text-[var(--bp-text-secondary)] hover:border-[var(--bp-text-muted)]'
              }`}>
              {resolveI18n(opt.label, locale)}
            </button>
          );
        })}
      </div>
    </FieldShell>
  );
};
export default MultiChoiceField;
