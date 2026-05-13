import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { ChevronRight, Bell } from 'lucide-react';
import LocaleSwitcher from '../common/LocaleSwitcher';

/**
 * Topbar — section breadcrumb + locale + notifications + user chip.
 *
 * The user chip lives ONLY here (Sidebar no longer renders user info,
 * to eliminate the previous bottom-left / top-right duplicate).
 */
const PATH_KEYS = [
  ['/workspace/leads', 'nav.leads', 'nav.section.workspace'],
  ['/workspace/projects', 'nav.projects', 'nav.section.workspace'],
  ['/workspace/proposals', 'nav.proposals', 'nav.section.workspace'],
  ['/moodboards', 'nav.moodboards', 'nav.section.content'],
  ['/inspirations', 'nav.inspirations', 'nav.section.content'],
  ['/insights', 'nav.insights', 'nav.section.intelligence'],
  ['/settings', 'nav.settings', 'nav.section.system'],
  ['/dashboard', 'nav.dashboard', null],
];

const Topbar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useBlueprint();

  const match = PATH_KEYS.find(([p]) => location.pathname.startsWith(p)) || ['/', 'nav.dashboard', null];
  const sectionKey = match[2];
  const labelKey = match[1];

  const userInitial = (user?.first_name?.[0] || user?.email?.[0] || 'U').toUpperCase();
  const userLabel = (user?.first_name && `${user.first_name} ${user?.last_name || ''}`.trim()) || user?.email?.split('@')[0];

  return (
    <header
      data-testid="topbar"
      style={{ height: '52px' }}
      className="flex items-center justify-between px-6 border-b border-[var(--bp-border)] bg-[var(--bp-bg)]/85 backdrop-blur-xl flex-shrink-0"
    >
      <div className="flex items-center gap-2 min-w-0">
        {sectionKey && (
          <>
            <span className="text-[var(--bp-text-muted)] text-xs font-body">{t(sectionKey)}</span>
            <ChevronRight size={12} className="text-[var(--bp-text-subtle)]" />
          </>
        )}
        <span className="text-[var(--bp-text-primary)] text-sm font-body font-medium truncate">{t(labelKey)}</span>
      </div>

      <div className="flex items-center gap-2">
        <LocaleSwitcher />
        <button
          data-testid="topbar-notifications-btn"
          className="relative text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors p-1.5 rounded-[3px] hover:bg-[var(--bp-surface-2)]/40"
        >
          <Bell size={15} strokeWidth={1.5} />
        </button>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-[3px] bg-[var(--bp-surface-2)]/40 border border-[var(--bp-border)]"
             data-testid="topbar-user-chip">
          <div className="w-5 h-5 rounded-full bg-[var(--bp-primary)]/15 flex items-center justify-center">
            <span className="text-[var(--bp-primary)] text-[10px] font-semibold font-body">{userInitial}</span>
          </div>
          <span className="text-[var(--bp-text-secondary)] text-xs font-body hidden sm:block">{userLabel}</span>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
