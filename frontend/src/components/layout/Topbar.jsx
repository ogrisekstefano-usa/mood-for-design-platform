import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronRight, Bell } from 'lucide-react';

const LABELS = {
  '/dashboard': 'Dashboard',
  '/workspace/leads': 'Leads',
  '/workspace/projects': 'Projects',
  '/proposals': 'Proposals',
  '/moodboards': 'Moodboards',
  '/inspirations': 'Inspirations',
  '/insights': 'Insights',
  '/settings': 'Settings',
};

const Topbar = () => {
  const location = useLocation();
  const { user } = useAuth();

  const path = Object.keys(LABELS).find(k => location.pathname.startsWith(k)) || '/dashboard';
  const label = LABELS[path];
  const section = path.startsWith('/workspace') ? 'Blueprint Workspace' : 'Blueprint OS™';

  return (
    <header
      data-testid="topbar"
      className="h-13 flex items-center justify-between px-6 border-b border-white/[0.05] bg-[#0A0A0B]/80 backdrop-blur-xl flex-shrink-0"
      style={{ height: '52px' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[#4A4845] text-xs font-body">{section}</span>
        <ChevronRight size={12} className="text-[#3A3835]" />
        <span className="text-[#EFEBE4] text-sm font-body font-medium">{label}</span>
      </div>

      <div className="flex items-center gap-3">
        <button
          data-testid="topbar-notifications-btn"
          className="relative text-[#4A4845] hover:text-[#A19D98] transition-colors p-1.5 rounded-[3px] hover:bg-white/[0.04]"
        >
          <Bell size={15} strokeWidth={1.5} />
        </button>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-[3px] bg-white/[0.03] border border-white/[0.06]">
          <div className="w-5 h-5 rounded-full bg-[#D4AF37]/15 flex items-center justify-center">
            <span className="text-[#D4AF37] text-[10px] font-semibold font-body">
              {(user?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-[#A19D98] text-xs font-body hidden sm:block">
            {user?.full_name || user?.email?.split('@')[0]}
          </span>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
