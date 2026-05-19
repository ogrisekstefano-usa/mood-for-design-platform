import React, { useContext, createContext, useState, useMemo } from 'react';
import { Bell } from 'lucide-react';
import PaletteSwitcher from '../common/PaletteSwitcher';
import UserMenu from '../common/UserMenu';
import NavigableBreadcrumb from '../common/NavigableBreadcrumb';

/**
 * TopbarSlotsContext — lets pages inject CENTER (canvas tools) and RIGHT
 * (page-specific actions, e.g. undo/redo, present, share) content into the
 * global Topbar without the Topbar having to know about every page.
 *
 * This is the structural backbone of the "no duplicated commands" rule:
 *   Sidebar   = workspace navigation only
 *   Topbar    = breadcrumb + status + canvas tools + global actions
 *   Editor    = registers its tools via TopbarSlots (see TopbarSlots.jsx)
 */
const TopbarSlotsCtx = createContext({
  slots: { left: null, center: null, right: null },
  setSlots: () => {},
});

export const TopbarSlotsProvider = ({ children }) => {
  const [slots, setSlots] = useState({ left: null, center: null, right: null });
  const value = useMemo(() => ({ slots, setSlots }), [slots]);
  return <TopbarSlotsCtx.Provider value={value}>{children}</TopbarSlotsCtx.Provider>;
};

export const useTopbarSlots = () => useContext(TopbarSlotsCtx);

/**
 * Topbar — the editorial command bar (definitive structure).
 *
 *   LEFT   : breadcrumb (deep, clickable, smart-truncated) + optional
 *            page-injected LEFT slot (e.g. project name + status capsule)
 *   CENTER : page-injected canvas tools (only present inside the editor;
 *            invisible on dashboard / list pages)
 *   RIGHT  : page-injected actions (undo/redo · present · share · review),
 *            then GLOBAL: theme · locale · notifications · avatar
 *
 * NO logo lives here. The brand mark is in the left rail only. This is a
 * deliberate, definitive choice — branding stays silent + premium, never
 * onnipresente.
 */
const Topbar = () => {
  const { slots } = useTopbarSlots();

  return (
    <header
      data-testid="topbar"
      style={{ height: '56px', position: 'relative', zIndex: 50 }}
      className="flex items-center justify-between gap-6 px-6 border-b border-[var(--bp-border)]
                 bg-[var(--bp-bg)]/85 backdrop-blur-xl flex-shrink-0"
    >
      {/* LEFT — breadcrumb + page-injected left slot (project name / status) */}
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <NavigableBreadcrumb />
        {slots.left && (
          <>
            <div className="h-4 w-px bg-[var(--bp-border)] flex-shrink-0" />
            <div className="flex items-center gap-3 min-w-0">{slots.left}</div>
          </>
        )}
      </div>

      {/* CENTER — page-injected canvas tools (empty outside editor) */}
      {slots.center && (
        <div data-testid="topbar-center" className="flex items-center gap-1 flex-shrink-0">
          {slots.center}
        </div>
      )}

      {/* RIGHT — page actions + global controls */}
      <div className="flex items-center gap-2 flex-shrink-0 justify-end">
        {slots.right && (
          <>
            <div className="flex items-center gap-1">{slots.right}</div>
            <div className="w-px h-5 bg-[var(--bp-border)] mx-1" />
          </>
        )}

        <button
          type="button"
          data-testid="topbar-notifications-btn"
          title="Notifications"
          className="relative w-8 h-8 flex items-center justify-center rounded-full
                     text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]
                     hover:bg-[var(--bp-surface-2)]/40 transition-colors"
        >
          <Bell size={14} strokeWidth={1.6} />
        </button>

        <PaletteSwitcher />

        <div className="w-px h-5 bg-[var(--bp-border)] mx-1" />

        <UserMenu />
      </div>
    </header>
  );
};

export default Topbar;
