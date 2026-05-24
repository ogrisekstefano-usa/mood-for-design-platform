/**
 * DesignerChip · Designer Presence™ chip.
 * Avatar + name + role label + presence dot.
 * Used inside Lead/Prospect/Account cards.
 */
import React from 'react';

const PRESENCE_LABEL = {
  available: 'available',
  away:      'away',
  offline:   'offline',
  unknown:   'studio',
};

const DesignerChip = ({ designer, size = 'md', testid }) => {
  if (!designer) {
    return (
      <span className={`cr-designer cr-designer--${size} cr-designer--unassigned`} data-testid={testid || 'designer-chip-unassigned'}>
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
  return (
    <span className={`cr-designer cr-designer--${size}`} data-testid={testid || `designer-chip-${designer.id}`}>
      <span className="cr-designer__avatar" aria-hidden="true">
        {designer.avatar_url
          ? <img src={designer.avatar_url} alt="" />
          : <span className="cr-designer__initials">{initials}</span>}
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
