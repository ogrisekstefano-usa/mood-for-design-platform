import React from 'react';
import { FieldShell, Textarea } from './_shared';

const LongTextField = ({ field, value, onChange, locale, error }) => (
  <FieldShell field={field} locale={locale} error={error}>
    <Textarea value={value} onChange={onChange} testid={`input-${field.key || field.id}`}
      placeholder={field.placeholder?.[locale] || field.placeholder?._default || ''} rows={5} />
  </FieldShell>
);
export default LongTextField;
