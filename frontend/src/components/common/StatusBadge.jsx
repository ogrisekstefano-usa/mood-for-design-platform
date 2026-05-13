/**
 * StatusBadge — shared component for moodboard / project / proposal statuses.
 *
 * Blueprint-driven:
 *   - status string resolves via t(`${kind}.status.${status}`)
 *   - tones use theme tokens (no hardcoded hex)
 */
import React from 'react';

const TONES = {
  // Moodboard + Proposal (shared semantic)
  draft:              'bg-[var(--bp-surface-2)] text-[var(--bp-text-muted)]',
  sent:               'bg-amber-500/10 text-amber-400',
  viewed:             'bg-blue-500/10 text-blue-400',
  approved:           'bg-emerald-500/10 text-emerald-400',
  revision_requested: 'bg-orange-500/10 text-orange-400',
  rejected:           'bg-red-500/10 text-red-400',
  // Project lifecycle
  new:                  'bg-blue-500/10 text-blue-400',
  in_review:            'bg-purple-500/10 text-purple-400',
  brief_completed:      'bg-cyan-500/10 text-cyan-400',
  proposal_in_progress: 'bg-amber-500/10 text-amber-400',
  proposal_sent:        'bg-[var(--bp-primary)]/10 text-[var(--bp-primary)]',
  won:                  'bg-emerald-500/10 text-emerald-400',
  lost:                 'bg-red-500/10 text-red-400',
  archived:             'bg-white/5 text-[var(--bp-text-muted)]',
  // Lead lifecycle
  qualified:        'bg-emerald-500/10 text-emerald-400',
  not_qualified:    'bg-red-500/10 text-red-400',
  contacted:        'bg-blue-500/10 text-blue-400',
  project_opened:   'bg-[var(--bp-primary)]/10 text-[var(--bp-primary)]',
};

const StatusBadge = ({ status, t, kind = 'moodboards', size = 'sm' }) => {
  const key = status || 'draft';
  const tone = TONES[key] || TONES.draft;
  const sizing = size === 'lg'
    ? 'text-[11px] px-3 py-1.5'
    : 'text-[10px] px-2 py-1';
  return (
    <span
      data-testid={`status-badge-${key}`}
      className={`inline-flex items-center bp-eyebrow rounded-[var(--bp-radius-xs)] ${sizing} ${tone}`}
    >
      {t(`${kind}.status.${key}`)}
    </span>
  );
};

export default StatusBadge;
