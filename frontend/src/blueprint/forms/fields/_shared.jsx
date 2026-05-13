import React from 'react';
import { resolveI18n } from '../FieldRegistry';

export const FieldShell = ({ field, locale, error, children, hideLabel }) => {
  const label = resolveI18n(field.label, locale);
  const description = resolveI18n(field.description, locale);
  const key = field.key || field.id;
  return (
    <div className="bp-stack-tight" data-testid={`field-${key}`}>
      {!hideLabel && (label || description) && (
        <div>
          {label && (
            <label className="block bp-h3 text-[var(--bp-text-primary)] font-light">
              {label}
              {field.required && <span className="text-[var(--bp-primary)] ml-2">*</span>}
            </label>
          )}
          {description && <p className="bp-caption text-[var(--bp-text-muted)] mt-2">{description}</p>}
        </div>
      )}
      <div className="pt-4">{children}</div>
      {error && <p className="bp-caption text-red-400 mt-2" role="alert" data-testid={`field-error-${key}`}>{error}</p>}
    </div>
  );
};

export const Input = ({ value, onChange, type = 'text', placeholder, autoFocus, disabled, testid, ...rest }) => (
  <input data-testid={testid} type={type} value={value || ''} onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder} autoFocus={autoFocus} disabled={disabled}
    className="w-full bg-transparent border-0 border-b border-[var(--bp-border-strong)] focus:border-[var(--bp-primary)] focus:outline-none py-3 text-[var(--bp-text-primary)] text-lg font-body transition-colors placeholder:text-[var(--bp-text-subtle)]"
    {...rest} />
);

export const Textarea = ({ value, onChange, placeholder, rows = 4, testid, ...rest }) => (
  <textarea data-testid={testid} value={value || ''} onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder} rows={rows}
    className="w-full bg-transparent border border-[var(--bp-border-strong)] focus:border-[var(--bp-primary)] focus:outline-none rounded-[var(--bp-radius-sm)] py-3 px-4 text-[var(--bp-text-primary)] text-lg font-body transition-colors placeholder:text-[var(--bp-text-subtle)]"
    {...rest} />
);
