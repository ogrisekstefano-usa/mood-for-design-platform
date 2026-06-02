/**
 * MailboxStatusBadge — ITER187.B.
 * Renders Connected / Warning / Error / Disabled badge.
 */
import React from 'react';

const LABELS = {
  connected: 'Connected',
  warning:   'Warning',
  error:     'Error',
  unknown:   'Da verificare',
  disabled:  'Disabled',
};

export default function MailboxStatusBadge({ status, isActive = true, testId }) {
  let effective = isActive ? (status || 'unknown') : 'disabled';
  if (!(effective in LABELS)) effective = 'unknown';
  const cls = effective === 'unknown' ? 'cm-badge-warning' : `cm-badge-${effective}`;
  return (
    <span className={`cm-badge ${cls}`} data-testid={testId}>
      <span className="cm-dot" aria-hidden="true" />
      {LABELS[effective]}
    </span>
  );
}
