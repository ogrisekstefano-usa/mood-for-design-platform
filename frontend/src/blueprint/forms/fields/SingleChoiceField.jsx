import React from 'react';
import { FieldShell } from './_shared';
import { resolveI18n } from '../FieldRegistry';

/** Single-choice (cards / pills / list). */
const SingleChoiceField = ({ field, value, onChange, locale, error }) => {
  const options = field.options || [];
  const variant = field.ui || 'cards';

  if (variant === 'pills') {
    return (
      <FieldShell field={field} locale={locale} error={error}>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => {
            const isSelected = value === opt.value;
            return (
              <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
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
  }

  // cards (default)
  return (
    <FieldShell field={field} locale={locale} error={error}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
              data-testid={`opt-${field.key}-${opt.value}`}
              className={`group relative text-left p-5 border rounded-[var(--bp-radius-md)] transition-all overflow-hidden ${
                isSelected
                  ? 'border-[var(--bp-primary)] bg-[var(--bp-surface-1)] shadow-[var(--bp-shadow-glow)]'
                  : 'border-[var(--bp-border)] bg-[var(--bp-surface-1)] hover:border-[var(--bp-border-strong)]'
              }`}>
              {opt.image && (
                <div className="aspect-[4/3] mb-4 -m-5 mb-4 overflow-hidden">
                  <img src={opt.image} alt="" className="w-full h-full object-cover bp-img-cinematic" />
                </div>
              )}
              <h4 className="bp-h3 text-[var(--bp-text-primary)]">{resolveI18n(opt.label, locale)}</h4>
              {opt.description && <p className="bp-caption text-[var(--bp-text-muted)] mt-2">{resolveI18n(opt.description, locale)}</p>}
              {isSelected && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[var(--bp-primary)]" />}
            </button>
          );
        })}
      </div>
    </FieldShell>
  );
};

export default SingleChoiceField;
