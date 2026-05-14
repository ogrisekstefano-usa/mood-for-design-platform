/**
 * ActivityTimeline — premium readable feed of collab events.
 *
 *  - Compact eyebrow + summary per row.
 *  - Time formatted relative ("3m ago" / "yesterday" / "Mar 12").
 *  - Subtle role-colored leading dot.
 *  - This is NOT an audit log. Keep visuals editorial: no icons spam,
 *    no JSON dumps, no bullet bullets, no badge clutter.
 */
import React from 'react';

const EVENT_LABEL = {
  comment_added:            'left a comment',
  comment_replied:          'replied',
  comment_resolved:         'resolved a thread',
  page_approved:            'approved a page',
  page_revision_requested:  'requested a revision',
  page_rejected:            'rejected a page',
  page_status_reset:        'reopened a page',
  inspiration_added:        'shared a reference',
  version_snapshot:         'captured a version',
  version_restored:         'restored a previous version',
  client_emotional_milestone: 'reacted',
  handoff_to_proposal:      'prepared this for proposal',
  review_opened:            'opened the review',
  review_closed:            'closed the review',
};

const ROLE_COLOR = {
  designer: 'var(--bp-primary)',
  pm: '#E0A458',
  project_manager: '#E0A458',
  super_admin: '#E0A458',
  client: 'rgba(245,242,236,0.8)',
};

const relTime = (iso) => {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const ActivityTimeline = ({ activity = [] }) => {
  if (activity.length === 0) {
    return (
      <p className="text-[12px] text-[var(--bp-text-muted)] italic"
         data-testid="activity-empty">
        No activity yet — be the first to leave a thought.
      </p>
    );
  }
  return (
    <ol className="space-y-4" data-testid="activity-timeline">
      {activity.map((a) => (
        <li key={a.id} className="flex items-start gap-3"
            data-testid={`activity-event-${a.event_type}`}>
          <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: ROLE_COLOR[a.actor_role] || ROLE_COLOR.client }} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-[var(--bp-text-primary)] leading-snug">
              <span className="font-medium">{a.actor_name || (a.actor_role === 'designer' ? 'Designer' : 'Client')}</span>
              <span className="text-[var(--bp-text-secondary)]"> {EVENT_LABEL[a.event_type] || a.event_type}</span>
            </p>
            <p className="text-[10px] text-[var(--bp-text-subtle)] mt-0.5 tabular-nums">
              {relTime(a.created_at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
};

export default ActivityTimeline;
