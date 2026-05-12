import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { ChevronRight, Bell } from 'lucide-react';
import LocaleSwitcher from '../common/LocaleSwitcher';

// Path → label key resolver. Order matters (longest match wins).
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
      className="h-13 flex items-center justify-between px-6 border-b border-white/[0.05] bg-[#0A0A0B]/80 backdrop-blur-xl flex-shrink-0"
      style={{ height: '52px' }}
    >
      <div className="flex items-center gap-2">
        {sectionKey && (
          <>
            <span className="text-[#4A4845] text-xs font-body">{t(sectionKey)}</span>
            <ChevronRight size={12} className="text-[#3A3835]" />
          </>
        )}
        <span className="text-[#EFEBE4] text-sm font-body font-medium">{t(labelKey)}</span>
      </div>

      <div className="flex items-center gap-2">
        <LocaleSwitcher />
        <button
          data-testid="topbar-notifications-btn"
          className="relative text-[#4A4845] hover:text-[#A19D98] transition-colors p-1.5 rounded-[3px] hover:bg-white/[0.04]"
        >
          <Bell size={15} strokeWidth={1.5} />
        </button>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-[3px] bg-white/[0.03] border border-white/[0.06]">
          <div className="w-5 h-5 rounded-full bg-[var(--bp-primary,#D4AF37)]/15 flex items-center justify-center">
            <span className="text-[var(--bp-primary,#D4AF37)] text-[10px] font-semibold font-body">{userInitial}</span>
          </div>
          <span className="text-[#A19D98] text-xs font-body hidden sm:block">{userLabel}</span>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
