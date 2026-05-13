import React from 'react';
import { FieldShell, Input } from './_shared';

const PhoneField = ({ field, value, onChange, locale, error }) => (
  <FieldShell field={field} locale={locale} error={error}>
    <Input type="tel" value={value} onChange={onChange} testid={`input-${field.key || field.id}`}
      placeholder={field.placeholder?.[locale] || field.placeholder?._default || '+39 ...'} />
  </FieldShell>
);
export default PhoneField;
