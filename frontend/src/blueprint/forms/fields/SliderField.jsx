import React from 'react';
import { FieldShell } from './_shared';

const SliderField = ({ field, value, onChange, locale, error }) => {
  const v = field.validation || {};
  const min = v.min ?? 0;
  const max = v.max ?? 100;
  const step = v.step ?? 1;
  const current = value ?? min;
  return (
    <FieldShell field={field} locale={locale} error={error}>
      <div className="flex items-center gap-6">
        <input type="range" min={min} max={max} step={step} value={current}
          onChange={(e) => onChange(parseFloat(e.target.value))} className="flex-1 accent-[var(--bp-primary)]"
          data-testid={`input-${field.key || field.id}`} />
        <div className="bp-h3 text-[var(--bp-primary)] font-light tabular-nums min-w-[80px] text-right">{current}</div>
      </div>
      <div className="flex justify-between mt-2 bp-caption text-[var(--bp-text-subtle)]">
        <span>{min}</span><span>{max}</span>
      </div>
    </FieldShell>
  );
};
export default SliderField;
