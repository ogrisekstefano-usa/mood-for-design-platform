/**
 * StatusBadge — editorial capsule for moodboard / project / proposal statuses.
 *
 *   ●  In Review
 *
 * Each status carries a tiny indicator dot (the colour tone) followed by the
 * label in tracking-wide uppercase type. The capsule itself uses a soft glass
 * surface — never a saturated chip — so it reads as cinematic UI, not SaaS.
 *
 * Blueprint-driven:
 *   - status string resolves via t(`${kind}.status.${status}`)
 *   - tones use theme tokens / semantic colours only at the dot level
 */
import React from 'react';

const DOT = {
  // Moodboard + Proposal (shared semantic)
  draft:              'bg-[var(--bp-text-subtle)]',
  sent:               'bg-amber-400',
  viewed:             'bg-blue-400',
  approved:           'bg-emerald-400',
  revision_requested: 'bg-orange-400',
  rejected:           'bg-red-400',
  // Project lifecycle
  new:                  'bg-blue-400',
  in_review:            'bg-purple-400',
  brief_completed:      'bg-cyan-400',
  proposal_in_progress: 'bg-amber-400',
  proposal_sent:        'bg-[var(--bp-primary)]',
  won:                  'bg-emerald-400',
  lost:                 'bg-red-400',
  archived:             'bg-[var(--bp-text-subtle)]',
  // Lead lifecycle
  qualified:        'bg-emerald-400',
  not_qualified:    'bg-red-400',
  contacted:        'bg-blue-400',
  project_opened:   'bg-[var(--bp-primary)]',
};

// Statuses that should feel "alive" — a soft pulse on the dot, so the user
// notices a board is awaiting action without resorting to a noisy banner.
const PULSING = new Set(['sent', 'viewed', 'in_review', 'revision_requested']);

const StatusBadge = ({ status, t, kind = 'moodboards', size = 'sm' }) => {
  const key = status || 'draft';
  const dotTone = DOT[key] || DOT.draft;
  const pulsing = PULSING.has(key);

  const sizing = size === 'lg'
    ? 'h-[26px] px-3 text-[10.5px]'
    : 'h-[22px] px-2.5 text-[9.5px]';
  const dotSize = size === 'lg' ? 'w-[7px] h-[7px]' : 'w-[6px] h-[6px]';

  return (
    <span
      data-testid={`status-badge-${key}`}
      className={`inline-flex items-center gap-2 rounded-full border border-[var(--bp-border)]
                  bg-[var(--bp-surface-2)]/35 backdrop-blur-sm
                  text-[var(--bp-text-primary)] tracking-[0.22em] uppercase font-body font-medium
                  ${sizing}`}
    >
      <span className="relative inline-flex flex-shrink-0">
        <span className={`${dotSize} rounded-full ${dotTone}`} />
        {pulsing && (
          <span
            aria-hidden="true"
            className={`absolute inset-0 ${dotSize} rounded-full ${dotTone} opacity-60 animate-ping`}
          />
        )}
      </span>
      <span>{t(`${kind}.status.${key}`)}</span>
    </span>
  );
};

export default StatusBadge;
