import React from 'react';
import { FieldShell } from './_shared';

const formatCurrency = (n, currency) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'EUR', maximumFractionDigits: 0 }).format(n);
  } catch (_) { return `${currency || 'EUR'} ${n}`; }
};

const BudgetSliderField = ({ field, value, onChange, locale, error }) => {
  const v = field.validation || {};
  const min = v.min ?? 5000;
  const max = v.max ?? 1000000;
  const step = v.step ?? 5000;
  const currency = v.currency || 'EUR';
  const current = value ?? min;
  return (
    <FieldShell field={field} locale={locale} error={error}>
      <div className="bp-display text-[var(--bp-primary)] font-light leading-none mb-6 text-center md:text-left">
        {formatCurrency(current, currency)}
      </div>
      <input type="range" min={min} max={max} step={step} value={current}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[var(--bp-primary)]" data-testid={`input-${field.key || field.id}`} />
      <div className="flex justify-between mt-2 bp-caption text-[var(--bp-text-subtle)]">
        <span>{formatCurrency(min, currency)}</span><span>{formatCurrency(max, currency)}+</span>
      </div>
    </FieldShell>
  );
};
export default BudgetSliderField;
