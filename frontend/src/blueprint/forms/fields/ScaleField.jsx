import React from 'react';
import { FieldShell } from './_shared';

const ScaleField = ({ field, value, onChange, locale, error }) => {
  const max = field.validation?.max || 5;
  const items = Array.from({ length: max }, (_, i) => i + 1);
  return (
    <FieldShell field={field} locale={locale} error={error}>
      <div className="flex gap-2">
        {items.map((n) => {
          const isSelected = value === n;
          return (
            <button key={n} type="button" onClick={() => onChange(n)}
              data-testid={`opt-${field.key}-${n}`}
              className={`w-14 h-14 rounded-full border transition-all bp-h3 ${
                isSelected
                  ? 'border-[var(--bp-primary)] bg-[var(--bp-primary)] text-[var(--bp-bg)]'
                  : 'border-[var(--bp-border-strong)] text-[var(--bp-text-secondary)] hover:border-[var(--bp-text-muted)]'
              }`}>{n}</button>
          );
        })}
      </div>
    </FieldShell>
  );
};
export default ScaleField;
