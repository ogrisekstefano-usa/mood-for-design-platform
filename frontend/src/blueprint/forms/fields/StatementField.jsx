import React from 'react';
import { resolveI18n } from '../FieldRegistry';

const StatementField = ({ field, locale }) => (
  <div className="py-4" data-testid={`field-${field.key || field.id}`}>
    {field.eyebrow && <p className="bp-eyebrow mb-3">{resolveI18n(field.eyebrow, locale)}</p>}
    {field.label && <h3 className="bp-h2 text-[var(--bp-text-primary)] mb-3">{resolveI18n(field.label, locale)}</h3>}
    {field.description && <p className="bp-lead">{resolveI18n(field.description, locale)}</p>}
  </div>
);
export default StatementField;
