/**
 * DesignerChip · Designer Presence™ chip.
 *
 * The presence vocabulary is INTENTIONALLY editorial — never the SaaS
 * available/away/offline trio. It reads like a studio's state of mind,
 * not a notification status.
 *
 * Mapping from the raw metadata_json.online_status (kept for back-
 * compatibility with seed data) to the editorial label is done below.
 */
import React from 'react';

const PRESENCE_LABEL = {
  in_studio:                'In Studio',
  reviewing_materials:      'Reviewing Materials',
  curating_inspirations:    'Curating Inspirations',
  with_clients:             'With Clients',
  composing_concepts:       'Composing Concepts',
  preparing_new_directions: 'Preparing New Directions',
  traveling:                'Traveling Between Projects',
  // legacy SaaS values gracefully remapped
  available:                'In Studio',
  away:                     'Composing Concepts',
  offline:                  'Traveling Between Projects',
  unknown:                  'In Studio',
};

const DesignerChip = ({ designer, size = 'md', testid, contextId }) => {
  const [imgFailed, setImgFailed] = React.useState(false);
  // Reset error state when designer changes (avatar_url may differ).
  React.useEffect(() => { setImgFailed(false); }, [designer && designer.avatar_url]);

  if (!designer) {
    return (
      <span
        className={`cr-designer cr-designer--${size} cr-designer--unassigned`}
        data-testid={testid || `designer-chip-unassigned${contextId ? `-${contextId}` : ''}`}
      >
        <span className="cr-designer__avatar cr-designer__avatar--empty" aria-hidden="true">·</span>
        <span className="cr-designer__body">
          <span className="cr-designer__name">Unassigned</span>
          <span className="cr-designer__sub">awaiting curator</span>
        </span>
      </span>
    );
  }
  const initials = (designer.name || '·')
    .split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const presence = (designer.presence || 'unknown').toLowerCase();
  const presenceLabel = PRESENCE_LABEL[presence] || PRESENCE_LABEL.unknown;
  const tid = testid || `designer-chip-${designer.id}${contextId ? `-${contextId}` : ''}`;
  const showAvatar = designer.avatar_url && !imgFailed;
  return (
    <span className={`cr-designer cr-designer--${size}`} data-testid={tid}>
      <span className="cr-designer__avatar" aria-hidden="true">
        {showAvatar ? (
          <img
            src={designer.avatar_url}
            alt=""
            onError={() => setImgFailed(true)}
            loading="lazy"
          />
        ) : (
          <span className="cr-designer__initials">{initials}</span>
        )}
        <span className={`cr-designer__pres cr-designer__pres--${presence}`} />
      </span>
      <span className="cr-designer__body">
        <span className="cr-designer__name">{designer.name}</span>
        <span className="cr-designer__sub">{designer.role_label || 'studio'} · {presenceLabel}</span>
      </span>
    </span>
  );
};

export default DesignerChip;
