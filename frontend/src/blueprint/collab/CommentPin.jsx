/**
 * Anchored comment pin overlay for Review Mode.
 *
 *  - Renders a colored circular pin at (pin_x %, pin_y %) of the canvas.
 *  - Click → opens the thread drawer for that comment.
 *  - Color is driven by author_role (teal=designer, amber=PM, paper=client).
 *  - Roots only — replies are nested in the drawer, not on the canvas.
 */
import React from 'react';

const COLOR_BY_ROLE = {
  designer:    'var(--bp-primary)',          // teal
  pm:          '#E0A458',                    // amber
  project_manager: '#E0A458',
  super_admin: '#E0A458',
  client:      'rgba(245,242,236,0.95)',     // paper white
};

const CommentPin = ({ comment, replies = [], active, onClick, t }) => {
  if (comment.pin_x == null || comment.pin_y == null) return null;
  const color = COLOR_BY_ROLE[comment.author_role] || COLOR_BY_ROLE.client;
  const initials = (comment.author_name || (comment.author_role === 'designer' ? 'D' : 'C'))
    .split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const replyCount = replies.length;

  return (
    <button type="button"
            data-testid={`comment-pin-${comment.id}`}
            onClick={(e) => { e.stopPropagation(); onClick?.(comment.id); }}
            title={comment.body?.slice(0, 80)}
            style={{
              left: `${comment.pin_x}%`,
              top:  `${comment.pin_y}%`,
              transform: 'translate(-50%, -100%)',
            }}
            className={`absolute z-30 group select-none pointer-events-auto
                        transition-transform duration-200 ${active ? 'scale-110' : 'hover:scale-105'}`}>
      <div className="relative flex items-center">
        <span className="w-7 h-7 rounded-full flex items-center justify-center
                         text-[10px] font-semibold tracking-wider
                         ring-2 ring-black/30 shadow-[0_4px_18px_rgba(0,0,0,0.45)]"
              style={{ backgroundColor: color, color: comment.author_role === 'client' ? '#1E1B18' : '#0A0A0B' }}>
          {initials}
        </span>
        <span className="absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
              style={{ backgroundColor: color }} />
        {replyCount > 0 && (
          <span className="ml-1.5 -mt-3 px-1.5 h-[16px] rounded-full text-[9px] font-mono
                           bg-black/65 text-white/85 flex items-center"
                data-testid={`comment-pin-${comment.id}-reply-count`}>
            {replyCount}
          </span>
        )}
      </div>
    </button>
  );
};

export default CommentPin;
