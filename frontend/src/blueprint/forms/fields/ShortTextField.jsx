import React from 'react';
import { FieldShell, Input } from './_shared';

const ShortTextField = ({ field, value, onChange, locale, error, autoFocus }) => (
  <FieldShell field={field} locale={locale} error={error}>
    <Input value={value} onChange={onChange} autoFocus={autoFocus}
      testid={`input-${field.key || field.id}`}
      placeholder={field.placeholder?.[locale] || field.placeholder?._default || ''} />
  </FieldShell>
);
export default ShortTextField;
