import React from 'react';
import { Bell } from 'lucide-react';
import LocaleSwitcher from '../common/LocaleSwitcher';
import ThemeSwitcher from '../common/ThemeSwitcher';
import UserMenu from '../common/UserMenu';
import NavigableBreadcrumb from '../common/NavigableBreadcrumb';
import Brand from '../common/Brand';

/**
 * Topbar — the editorial command bar.
 *
 *  LEFT   : brand wordmark (compact) + navigable breadcrumb
 *  CENTER : reserved for context-aware editor tools (rendered by pages
 *           themselves via the right cluster — kept clean here)
 *  RIGHT  : notifications · theme · locale · avatar dropdown (logout lives
 *           inside the avatar menu, not in the sidebar anymore)
 *
 * Visual density is deliberately lower than typical SaaS topbars: thin
 * border, glass background, generous padding, no hard separators between
 * right-side controls.
 */
const Topbar = () => (
  <header
    data-testid="topbar"
    style={{ height: '56px' }}
    className="flex items-center justify-between gap-6 px-6 border-b border-[var(--bp-border)]
               bg-[var(--bp-bg)]/85 backdrop-blur-xl flex-shrink-0"
  >
    {/* LEFT — brand + breadcrumb (sidebar carries only the mark, here the wordmark) */}
    <div className="flex items-center gap-5 min-w-0">
      <div className="flex-shrink-0 hidden md:block">
        <Brand size="sm" />
      </div>
      <div className="h-5 w-px bg-[var(--bp-border)] hidden md:block" />
      <NavigableBreadcrumb />
    </div>

    {/* RIGHT — controls cluster, low-density, no harsh separators */}
    <div className="flex items-center gap-2 flex-shrink-0">
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

      <ThemeSwitcher />
      <LocaleSwitcher />

      <div className="w-px h-5 bg-[var(--bp-border)] mx-1" />

      <UserMenu />
    </div>
  </header>
);

export default Topbar;
