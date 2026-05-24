/**
 * OwnerIntroductionGate — Phase S.2.
 *
 * Mounted ONCE at the DashboardLayout level. On first dashboard
 * render after login, it loads the current user's profile and:
 *
 *   - If user is tenant_admin / super_admin AND introduction is not
 *     complete (missing avatar OR bio OR role_label) → opens the
 *     OwnerIntroductionModal in non-forced mode. The user can defer
 *     once with "Più tardi"; we remember the per-session deferral
 *     in sessionStorage so they aren't nagged every navigation.
 *
 *   - If introduction IS complete → mounts nothing.
 *
 *   - If user is NOT a tenant owner → mounts nothing.
 *
 * The modal is reachable on demand from the StudioOnboardingPanel
 * "Presentati ai tuoi clienti" row through a global custom event.
 */
import React, { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import OwnerIntroductionModal from './OwnerIntroductionModal';

const SESSION_DEFER_KEY = 'mfd.owner_intro.deferred';

const OwnerIntroductionGate = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const role = (user?.role || '').toLowerCase();
  const isOwner = role === 'tenant_admin' || role === 'super_admin';

  const checkAndMaybeOpen = useCallback(async () => {
    if (!isOwner) return;
    // Sprint C: do NOT auto-open the introduction gate on /relations/* —
    // the editorial relationship surfaces (Leads/Prospects/Accounts) host
    // their own ceremonial drawers; the owner-intro modal would otherwise
    // intercept clicks on relation cards.
    try {
      const path = typeof window !== 'undefined' ? window.location.pathname : '';
      if (path.startsWith('/relations/')) return;
    } catch (_) { /* ignore */ }
    try {
      const { data } = await api.get('/api/profile/me');
      const introduced = !!data?.profile?.is_introduced;
      if (introduced) return;
      // Honour per-session deferral so we don't reopen on every nav.
      const deferred = typeof sessionStorage !== 'undefined'
        && sessionStorage.getItem(SESSION_DEFER_KEY) === '1';
      if (deferred) return;
      setOpen(true);
    } catch (_) { /* swallow */ }
  }, [isOwner]);

  useEffect(() => {
    checkAndMaybeOpen();
  }, [checkAndMaybeOpen]);

  // Allow other components (e.g. StudioOnboardingPanel) to open the
  // modal on demand via a custom DOM event — keeps coupling loose.
  useEffect(() => {
    const handler = () => {
      sessionStorage.removeItem(SESSION_DEFER_KEY);
      setOpen(true);
    };
    window.addEventListener('mfd:open-owner-introduction', handler);
    return () => window.removeEventListener('mfd:open-owner-introduction', handler);
  }, []);

  const handleClose = () => {
    setOpen(false);
    try { sessionStorage.setItem(SESSION_DEFER_KEY, '1'); } catch (_) {}
  };

  const handleComplete = () => {
    setOpen(false);
    try { sessionStorage.removeItem(SESSION_DEFER_KEY); } catch (_) {}
  };

  if (!isOwner) return null;

  return (
    <OwnerIntroductionModal
      open={open}
      onClose={handleClose}
      onComplete={handleComplete}
      forceComplete={false}
    />
  );
};

export default OwnerIntroductionGate;
