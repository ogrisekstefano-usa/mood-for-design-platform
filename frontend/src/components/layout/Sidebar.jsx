import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBlueprint } from '../../contexts/BlueprintContext';
import Brand from '../common/Brand';

const NavItem = ({ to, icon, labelKey }) => {
  const { t } = useBlueprint();
  const Icon = Icons[icon] || Icons.Square;
  return (
    <NavLink
      to={to}
      data-testid={`sidebar-nav-${labelKey.replace(/\./g, '-')}`}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 text-sm rounded-[3px] relative group transition-all duration-150 ${
          isActive
            ? 'bg-[var(--bp-primary,#D4AF37)]/8 text-[var(--bp-primary,#D4AF37)]'
            : 'text-[#6B6863] hover:text-[#A19D98] hover:bg-white/[0.03]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`absolute left-0 top-1 bottom-1 w-0.5 rounded-full transition-all ${
              isActive ? 'bg-[var(--bp-primary,#D4AF37)]' : 'bg-transparent'
            }`}
          />
          <Icon size={14} strokeWidth={1.5} />
          <span className="font-body font-medium tracking-wide">{t(labelKey)}</span>
        </>
      )}
    </NavLink>
  );
};

const Sidebar = () => {
  const { user, signOut } = useAuth();
  const { t, navigation } = useBlueprint();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth/login');
  };

  const initials =
    ((user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')).toUpperCase() ||
    (user?.email || 'U').charAt(0).toUpperCase();

  const sections = navigation?.sections || [];

  return (
    <aside
      data-testid="sidebar-nav"
      className="w-[220px] flex-shrink-0 bg-[#0A0A0B] border-r border-white/[0.05] flex flex-col h-full"
    >
      <div className="px-4 pt-5 pb-4 border-b border-white/[0.05]">
        <Brand size="sm" />
      </div>

      <nav className="flex-1 px-2 py-4 space-y-5 overflow-y-auto">
        {sections.map((section, i) => (
          <div key={section.id || i}>
            {section.labelKey && (
              <p className="px-3 mb-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[#3A3835] font-body">
                {t(section.labelKey)}
              </p>
            )}
            <div className="space-y-0.5">
              {(section.items || []).map((item) => (
                <NavItem key={item.to} {...item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/[0.05] p-3">
        <div className="flex items-center gap-2.5 p-2 rounded-[3px] hover:bg-white/[0.03] group">
          <div className="w-7 h-7 rounded-full bg-[var(--bp-primary,#D4AF37)]/15 border border-[var(--bp-primary,#D4AF37)]/25 flex items-center justify-center flex-shrink-0">
            <span className="text-[var(--bp-primary,#D4AF37)] text-xs font-semibold font-body">
              {initials}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#A19D98] text-[11px] font-medium font-body truncate">
              {(user?.first_name || '') + ' ' + (user?.last_name || '')}
            </p>
            <p className="text-[#4A4845] text-[10px] font-body truncate capitalize">
              {user?.role?.replace(/_/g, ' ') || ''}
            </p>
          </div>
          <button
            data-testid="sidebar-logout-btn"
            onClick={handleLogout}
            title={t('common.logout')}
            className="text-[#3A3835] hover:text-[#F44336] transition-colors p-1 flex-shrink-0"
          >
            <Icons.LogOut size={12} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
