/**
 * UsageChip — Linear/Vercel-style usage pill for plan-aware headers.
 *
 * Renders `usage / limit` (∞ for unlimited) with tone changes at
 * 80 % (warn) and 100 % (danger). Pair this with a disabled CTA to
 * complete the upgrade prompt.
 */
import React from 'react';

const TONE = {
  safe:   'border-[var(--bp-border)] text-[var(--bp-text-muted)]',
  warn:   'border-amber-300/30 text-amber-300 bg-amber-300/8',
  danger: 'border-rose-500/30 text-rose-300 bg-rose-500/8',
};

const fmt = (n, unit = '') => {
  if (n == null) return '∞';
  const v = Number(n);
  if (Number.isNaN(v)) return '–';
  // Compact for storage so "0.241 GB" stays readable
  if (unit === ' GB') return `${(Math.round(v * 100) / 100).toFixed(2)}${unit}`;
  return `${new Intl.NumberFormat().format(v)}${unit}`;
};

const UsageChip = ({ label, current, limit, unlimited, atCap, nearCap, unit = '', testid }) => {
  const tone = atCap ? 'danger' : nearCap ? 'warn' : 'safe';
  return (
    <span data-testid={testid}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-body uppercase tracking-[0.2em] ${TONE[tone]}`}>
      <span className="w-1 h-1 rounded-full bg-current opacity-70" />
      {label} {fmt(current, unit)}<span className="opacity-50">/</span>{unlimited ? '∞' : fmt(limit, unit)}
    </span>
  );
};

export default UsageChip;
