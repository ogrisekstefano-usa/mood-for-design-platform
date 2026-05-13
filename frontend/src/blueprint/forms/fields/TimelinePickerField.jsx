import React from 'react';
import { FieldShell } from './_shared';

const OPTIONS = [
  { value: '1-3m',  label: { _default: '1–3 months' } },
  { value: '3-6m',  label: { _default: '3–6 months' } },
  { value: '6-12m', label: { _default: '6–12 months' } },
  { value: '12m+',  label: { _default: '12+ months' } },
  { value: 'flexible', label: { _default: 'Flexible' } },
];

const TimelinePickerField = ({ field, value, onChange, locale, error }) => {
  const opts = field.options || OPTIONS;
  return (
    <FieldShell field={field} locale={locale} error={error}>
      <div className="flex flex-wrap gap-2">
        {opts.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
              data-testid={`opt-${field.key}-${opt.value}`}
              className={`px-5 py-3 rounded-[var(--bp-radius-pill)] border transition-all ${
                isSelected
                  ? 'border-[var(--bp-primary)] bg-[var(--bp-primary)]/10 text-[var(--bp-primary)]'
                  : 'border-[var(--bp-border-strong)] text-[var(--bp-text-secondary)] hover:border-[var(--bp-text-muted)]'
              }`}>
              {opt.label?.[locale] || opt.label?._default || opt.value}
            </button>
          );
        })}
      </div>
    </FieldShell>
  );
};
export default TimelinePickerField;
