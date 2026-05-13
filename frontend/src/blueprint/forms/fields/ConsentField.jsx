import React from 'react';
import { Check } from 'lucide-react';
import { FieldShell } from './_shared';
import { resolveI18n } from '../FieldRegistry';

const ConsentField = ({ field, value, onChange, locale, error }) => (
  <FieldShell field={field} locale={locale} error={error} hideLabel>
    <button type="button" onClick={() => onChange(!value)}
      data-testid={`consent-${field.key}`}
      className="flex items-start gap-4 text-left group">
      <span className={`mt-0.5 w-5 h-5 rounded-[var(--bp-radius-xs)] border-2 flex items-center justify-center transition-colors ${value ? 'border-[var(--bp-primary)] bg-[var(--bp-primary)]' : 'border-[var(--bp-border-strong)] group-hover:border-[var(--bp-text-muted)]'}`}>
        {value && <Check size={12} strokeWidth={2.5} className="text-[var(--bp-bg)]" />}
      </span>
      <span className="bp-body text-[var(--bp-text-secondary)] flex-1">
        {resolveI18n(field.label, locale)}
        {field.required && <span className="text-[var(--bp-primary)] ml-1">*</span>}
      </span>
    </button>
  </FieldShell>
);
export default ConsentField;
