/**
 * RelationsStageNav · shared editorial sub-nav across the 3 stage pages.
 *
 * Visual purpose: make the journey Lead → Prospect → Account
 * immediately legible. Each stage owns its accent (cool slate /
 * teal pulse / warm gold) so the user sees WHERE they are in the
 * relationship at all times.
 */
import React from 'react';
import { NavLink } from 'react-router-dom';

const STAGES = [
  { key: 'lead',     label: 'Leads',     route: '/relations/leads',
    sub: 'discovery',   accent: 'slate' },
  { key: 'prospect', label: 'Prospects', route: '/relations/prospects',
    sub: 'cultivation', accent: 'teal'  },
  { key: 'account',  label: 'Accounts',  route: '/relations/accounts',
    sub: 'active studio', accent: 'gold' },
];

const RelationsStageNav = ({ counts, active }) => (
  <nav className="cr-stagenav" data-testid="cr-stagenav" aria-label="Relationship stages">
    <div className="cr-stagenav__rail" aria-hidden="true" />
    {STAGES.map((s, idx) => {
      const isActive = active === s.key;
      const count = Number(counts?.[s.key] || 0);
      return (
        <NavLink
          key={s.key}
          to={s.route}
          className={`cr-stagenav__node cr-stagenav__node--${s.accent} ${isActive ? 'is-active' : ''}`}
          data-testid={`cr-stagenav-${s.key}`}
        >
          <span className="cr-stagenav__dot" />
          <span className="cr-stagenav__body">
            <span className="cr-stagenav__count">{count}</span>
            <span className="cr-stagenav__label">{s.label}</span>
            <span className="cr-stagenav__sub">{s.sub}</span>
          </span>
          {idx < STAGES.length - 1 && <span className="cr-stagenav__arrow" aria-hidden="true">→</span>}
        </NavLink>
      );
    })}
  </nav>
);

export default RelationsStageNav;
