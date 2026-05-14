import React from 'react';
import { Sun, Moon } from 'lucide-react';
import useWorkspaceMode from '../../blueprint/moodboard/useWorkspaceMode';

/**
 * Segmented Light/Dark switch — sits in the Topbar right cluster.
 *
 * Two cinematic pills inside a single capsule. Active pill carries the surface
 * + ink; inactive pill is muted. Click anywhere on the capsule = toggle.
 *
 * Mode state is owned by `useWorkspaceMode` (writes data-workspace-mode on
 * <html>); the switcher is purely presentational.
 */
const ThemeSwitcher = () => {
  const { mode, toggle } = useWorkspaceMode();
  const isLight = mode === 'light';

  return (
    <div
      data-testid="topbar-theme-switcher"
      role="group"
      aria-label="Theme mode"
      className="relative inline-flex items-center h-[28px] rounded-full border border-[var(--bp-border)] bg-[var(--bp-surface-2)]/40 p-[2px]"
    >
      {/* Sliding thumb */}
      <span
        aria-hidden="true"
        className="absolute top-[2px] bottom-[2px] w-[24px] rounded-full bg-[var(--bp-bg)] shadow-[var(--bp-shadow-sm)] transition-transform duration-200 ease-out"
        style={{ transform: isLight ? 'translateX(24px)' : 'translateX(0)' }}
      />
      <button
        type="button"
        onClick={() => isLight && toggle()}
        data-testid="theme-switch-dark"
        aria-pressed={!isLight}
        title="Cinematic Dark"
        className={`relative z-10 w-6 h-6 flex items-center justify-center rounded-full transition-colors
          ${!isLight ? 'text-[var(--bp-text-primary)]' : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-secondary)]'}`}
      >
        <Moon size={12} strokeWidth={1.7} />
      </button>
      <button
        type="button"
        onClick={() => !isLight && toggle()}
        data-testid="theme-switch-light"
        aria-pressed={isLight}
        title="Editorial Light"
        className={`relative z-10 w-6 h-6 flex items-center justify-center rounded-full transition-colors
          ${isLight ? 'text-[var(--bp-text-primary)]' : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-secondary)]'}`}
      >
        <Sun size={12} strokeWidth={1.7} />
      </button>
    </div>
  );
};

export default ThemeSwitcher;
