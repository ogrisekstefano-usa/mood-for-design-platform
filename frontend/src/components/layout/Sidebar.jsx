import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, Users, FolderOpen, FileText,
  Layers, BookOpen, BarChart3, Settings, LogOut
} from 'lucide-react';

const NAV = [
  {
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ]
  },
  {
    label: 'Blueprint Workspace',
    items: [
      { to: '/workspace/leads', icon: Users, label: 'Leads' },
      { to: '/workspace/projects', icon: FolderOpen, label: 'Projects' },
      { to: '/proposals', icon: FileText, label: 'Proposals' },
    ]
  },
  {
    label: 'Content',
    items: [
      { to: '/moodboards', icon: Layers, label: 'Moodboards' },
      { to: '/inspirations', icon: BookOpen, label: 'Inspirations' },
    ]
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/insights', icon: BarChart3, label: 'Insights' },
    ]
  },
  {
    label: 'System',
    items: [
      { to: '/settings', icon: Settings, label: 'Settings' },
    ]
  },
];

const NavItem = ({ to, icon: Icon, label }) => (
  <NavLink
    to={to}
    data-testid={`sidebar-nav-${label.toLowerCase().replace(' ', '-')}`}
    className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2 text-sm rounded-[3px] relative group transition-all duration-150 ${
        isActive
          ? 'bg-[#D4AF37]/8 text-[#D4AF37]'
          : 'text-[#6B6863] hover:text-[#A19D98] hover:bg-white/[0.03]'
      }`
    }
  >
    {({ isActive }) => (
      <>
        <span className={`absolute left-0 top-1 bottom-1 w-0.5 rounded-full transition-all ${isActive ? 'bg-[#D4AF37]' : 'bg-transparent'}`} />
        <Icon size={14} strokeWidth={1.5} />
        <span className="font-body font-medium tracking-wide">{label}</span>
      </>
    )}
  </NavLink>
);

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/auth/login');
  };

  const initials = (user?.full_name || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <aside data-testid="sidebar-nav" className="w-[220px] flex-shrink-0 bg-[#0A0A0B] border-r border-white/[0.05] flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#D4AF37] rounded-[3px] flex items-center justify-center flex-shrink-0">
            <span className="text-[#0A0A0B] text-xs font-bold font-body">M</span>
          </div>
          <div className="min-w-0">
            <p className="text-[#EFEBE4] text-[11px] font-semibold font-body tracking-[0.1em] uppercase leading-tight">Mood for Design</p>
            <p className="text-[#4A4845] text-[9px] font-body tracking-[0.2em] uppercase">Blueprint OS™</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-5 overflow-y-auto">
        {NAV.map((section, i) => (
          <div key={i}>
            {section.label && (
              <p className="px-3 mb-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[#3A3835] font-body">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(item => <NavItem key={item.to} {...item} />)}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-white/[0.05] p-3">
        <div className="flex items-center gap-2.5 p-2 rounded-[3px] hover:bg-white/[0.03] group cursor-default">
          <div className="w-7 h-7 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/25 flex items-center justify-center flex-shrink-0">
            <span className="text-[#D4AF37] text-xs font-semibold font-body">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#A19D98] text-[11px] font-medium font-body truncate">{user?.full_name || 'User'}</p>
            <p className="text-[#4A4845] text-[10px] font-body truncate capitalize">{user?.role || 'designer'}</p>
          </div>
          <button
            data-testid="sidebar-logout-btn"
            onClick={handleLogout}
            title="Logout"
            className="text-[#3A3835] hover:text-[#F44336] transition-colors p-1 flex-shrink-0"
          >
            <LogOut size={12} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
