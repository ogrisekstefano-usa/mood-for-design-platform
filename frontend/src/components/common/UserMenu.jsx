import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User as UserIcon, Building2, Settings as SettingsIcon, Bell, LogOut, Globe } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBlueprint } from '../../contexts/BlueprintContext';
import ThemeSwitcher from './ThemeSwitcher';

/**
 * UserMenu — avatar chip in the Topbar that opens a Linear/Framer-style dropdown.
 *
 * The dropdown is the canonical place for: Profile · Workspace · Preferences ·
 * Theme · Notifications · Logout. The Sidebar logout button has been removed in
 * favour of this single, future-ready menu.
 */
const MenuItem = ({ icon: Icon, label, onClick, testid, danger = false }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testid}
    className={`w-full flex items-center gap-3 px-3 py-2 text-[12px] rounded-[3px] transition-colors text-left
      ${danger
        ? 'text-[var(--bp-text-secondary)] hover:text-red-400 hover:bg-red-500/10'
        : 'text-[var(--bp-text-secondary)] hover:text-[var(--bp-text-primary)] hover:bg-[var(--bp-surface-2)]/60'}`}
  >
    <Icon size={13} strokeWidth={1.6} className="flex-shrink-0" />
    <span className="font-body tracking-wide">{label}</span>
  </button>
);

const UserMenu = () => {
  const { user, signOut } = useAuth();
  const { t, tenant, locale, setLocale, availableLocales } = useBlueprint();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const initial = (user?.first_name?.[0] || user?.email?.[0] || 'U').toUpperCase();
  const fullName = (user?.first_name && `${user.first_name} ${user?.last_name || ''}`.trim()) || user?.email?.split('@')[0];
  const avatarUrl = user?.avatar_url || null;

  const handleLogout = async () => {
    setOpen(false);
    await signOut();
    navigate('/auth/login');
  };

  const go = (to) => { setOpen(false); navigate(to); };

  return (
    <div ref={wrapRef} className="relative" style={{ zIndex: 10005 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="topbar-user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 pl-1 pr-2.5 py-[3px] rounded-full bg-[var(--bp-surface-2)]/40 border border-[var(--bp-border)] hover:border-[var(--bp-border-strong)] transition-colors"
      >
        <span
          className="w-7 h-7 rounded-full bg-[var(--bp-primary)]/15 flex items-center justify-center overflow-hidden"
          data-testid="topbar-user-avatar"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={fullName}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <span className="text-[var(--bp-primary)] text-[11px] font-semibold font-body">{initial}</span>
          )}
        </span>
        <span className="text-[var(--bp-text-secondary)] text-[12px] font-body hidden sm:block max-w-[140px] truncate">
          {fullName}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          data-testid="topbar-user-menu"
          style={{ zIndex: 10006 }}
          className="absolute right-0 top-[calc(100%+8px)] w-[244px] rounded-[6px] border border-[var(--bp-border)]
                     bg-[var(--bp-bg)] shadow-[var(--bp-shadow-lg)] py-1.5"
        >
          <div className="px-3 pb-2 pt-1 border-b border-[var(--bp-border)] mb-1">
            <p className="text-[12px] font-body font-medium text-[var(--bp-text-primary)] truncate">{fullName}</p>
            <p className="text-[10.5px] text-[var(--bp-text-muted)] font-body truncate">{user?.email}</p>
            {tenant?.name && (
              <p className="mt-1 text-[9px] tracking-[0.22em] uppercase text-[var(--bp-text-subtle)] font-body truncate">
                {tenant.name}
              </p>
            )}
          </div>

          <MenuItem icon={UserIcon}  label={t('user.profile', null, 'Profile')}        onClick={() => go('/settings')}        testid="user-menu-profile" />
          <MenuItem icon={Building2} label={t('user.workspace', null, 'Workspace')}    onClick={() => go('/settings/brand')}  testid="user-menu-workspace" />
          <MenuItem icon={SettingsIcon} label={t('user.preferences', null, 'Preferences')} onClick={() => go('/settings')}  testid="user-menu-preferences" />
          <MenuItem icon={Bell}      label={t('user.notifications', null, 'Notifications')} onClick={() => setOpen(false)}  testid="user-menu-notifications" />

          {/* Theme is a control, not a route — render the segmented switch in place */}
          <div className="px-3 py-2 flex items-center justify-between border-t border-[var(--bp-border)] mt-1.5">
            <span className="text-[10.5px] tracking-[0.20em] uppercase text-[var(--bp-text-muted)] font-body">
              {t('user.theme', null, 'Theme')}
            </span>
            <ThemeSwitcher />
          </div>

          {/* Language — compact native select; saves to localStorage + propagates */}
          {availableLocales && availableLocales.length > 1 && (
            <div className="px-3 py-2 flex items-center justify-between border-t border-[var(--bp-border)]">
              <span className="text-[10.5px] tracking-[0.20em] uppercase text-[var(--bp-text-muted)] font-body flex items-center gap-1.5">
                <Globe size={11} strokeWidth={1.5} />
                {t('user.language', null, 'Language')}
              </span>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                data-testid="user-menu-locale-select"
                className="bg-[var(--bp-surface-2)] border border-[var(--bp-border)] rounded-[3px]
                           text-[11px] font-body text-[var(--bp-text-primary)]
                           px-2 py-1 outline-none focus:border-[var(--bp-primary)] cursor-pointer"
              >
                {availableLocales.map((l) => (
                  <option key={l.code} value={l.code}>{l.code}</option>
                ))}
              </select>
            </div>
          )}

          <div className="border-t border-[var(--bp-border)] mt-1 pt-1">
            <MenuItem icon={LogOut} label={t('nav.logout', null, 'Logout')} onClick={handleLogout} testid="user-menu-logout" danger />
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
