/**
 * ActiveJourneyRail · Sprint G.5
 *
 * Mostra fino a 6 Journey vivi direttamente nella sidebar, sotto la
 * voce "Design Journey". Glow tenant-aware (lifecycle-based).
 *
 * NON è una lista di "progetti". È la coscienza dei viaggi attivi.
 */
import React from 'react';
import { NavLink } from 'react-router-dom';
import useActiveJourneys from '../../hooks/useActiveJourneys';

const GLOW = {
  conversation_open: 'teal',
  in_progress:       'teal',
  presenting:        'amber',
  drifting:          'amber',
  on_pause:          'muted',
  approved:          'gold',
  closed:            'gold',
  editioned:         'gold',
  abandoned:         'muted',
};

const COLOR = {
  teal:  'var(--jo-cool)',
  gold:  'var(--jo-accent)',
  amber: 'var(--jo-attn)',
  muted: 'color-mix(in srgb, var(--jo-text) 25%, transparent)',
};

const ActiveJourneyRail = ({ collapsed }) => {
  const { items, loading } = useActiveJourneys(!collapsed);
  if (collapsed) return null;

  if (loading && items.length === 0) {
    return (
      <div className="px-3 py-2 text-[10px] tracking-[0.18em] uppercase opacity-50"
           style={{ color: 'var(--jo-text-mute)' }}>
        Lettura ritmo…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-3 py-3" data-testid="sidebar-journeys-empty">
        <p className="text-[11.5px] italic" style={{ color: 'var(--jo-text-mute)',
            fontFamily: "'Playfair Display', serif" }}>
          Nessun Journey vivo al momento.
        </p>
        <NavLink to="/begin-journey"
                 className="inline-block mt-2 text-[10px] tracking-[0.22em] uppercase font-medium"
                 style={{ color: 'var(--jo-accent)' }}
                 data-testid="sidebar-begin-journey-cta">
          Inizia una conversazione →
        </NavLink>
      </div>
    );
  }

  return (
    <div className="space-y-0.5" data-testid="sidebar-active-journeys">
      {items.map((j) => {
        const tone = GLOW[j.lifecycle_state] || 'teal';
        return (
          <NavLink
            key={j.journey_id}
            to={`/workspace/projects/${j.project_id}`}
            data-testid={`sidebar-journey-${j.journey_id}`}
            className={({ isActive }) => `
              relative flex items-center gap-2.5 px-3 py-1.5 rounded-[4px]
              transition-colors duration-200
              ${isActive
                ? 'bg-[color-mix(in_srgb,var(--jo-text)_4%,transparent)]'
                : 'hover:bg-[color-mix(in_srgb,var(--jo-text)_2%,transparent)]'}
            `}
            title={`${j.account_name} · ${j.current_milestone?.label || j.lifecycle_label}`}
          >
            <span aria-hidden="true"
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    background: COLOR[tone],
                    boxShadow: tone === 'muted' ? 'none' : `0 0 6px ${COLOR[tone]}`,
                  }} />
            <span className="flex-1 truncate text-[12px]"
                  style={{
                    color: 'var(--jo-text-soft)',
                    fontFamily: "'Inter', system-ui, sans-serif",
                  }}>
              {j.account_name}
            </span>
            {j.days_silent != null && j.days_silent >= 14 && (
              <span aria-label="In silenzio"
                    className="text-[8.5px] uppercase tracking-[0.18em]"
                    style={{ color: 'var(--jo-text-faint)' }}>
                · silenzio
              </span>
            )}
          </NavLink>
        );
      })}
    </div>
  );
};

export default ActiveJourneyRail;
