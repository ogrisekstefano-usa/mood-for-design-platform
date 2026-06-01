/**
 * Topbar — Atelier Nordic™ · Editorial Command Bar (ITER138 · Wave A)
 *
 * Reference: master visual governance image.
 *
 *   LEFT   : workspace pill ("05 · MOOD for DESIGN™") + optional page slot
 *   CENTER : page-injected canvas tools (editor only)
 *   RIGHT  : page actions  →  primary CTA pill  →  bell  →  identity chip
 *
 * No logo here — brand mark lives in the left rail only. Cohesive with the
 * cinematic dark canvas: hairline border + bg-soft + ample horizontal rhythm.
 */
import React, { useContext, createContext, useState, useMemo } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NavigableBreadcrumb from '../common/NavigableBreadcrumb';
import UserMenu from '../common/UserMenu';
import NotificationBell from '../notifications/NotificationBell';
import DesignerPresencePicker from '../presence/DesignerPresencePicker';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { useAuth } from '../../contexts/AuthContext';

// ── Slots Context (preserve existing API) ────────────────────────
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

// ── Workspace selector pill (LEFT) ───────────────────────────────
const WorkspaceChip = () => {
  const { tenant, t } = useBlueprint();
  const tenantName = tenant?.name || tenant?.slug || 'Workspace';
  // Tenant sequence number — a small editorial badge. Falls back to "·".
  const seq = (tenant?.sequence_no || tenant?.tenant_no || tenant?.id?.toString().slice(-2) || '01')
    .toString().padStart(2, '0');
  return (
    <button type="button" className="atelier-workspace-pill" data-testid="topbar-workspace-pill"
            aria-label={t('nav.workspace_switcher', null, 'Switch workspace')}>
      <span className="atelier-workspace-pill__num">{seq}</span>
      <span className="atelier-workspace-pill__name">
        {tenantName}
        <span className="atelier-workspace-pill__mark">™</span>
      </span>
      <ChevronDown size={13} strokeWidth={1.6} className="atelier-workspace-pill__chevron" />
    </button>
  );
};

// ── Primary CTA pill (RIGHT) ─────────────────────────────────────
// ITER181.A · Smart CTA: routes to "Nuova Relazione" when no prospects yet,
// to "Nuovo Design Journey™" (prospect path) when at least one prospect exists.
const PrimaryCta = () => {
  const { t } = useBlueprint();
  let openModal = null;
  try {
    // eslint-disable-next-line global-require
    openModal = require('../../hooks/useNewRelationship').useNewRelationship().open;
  } catch (e) { /* noop */ }
  let af = null;
  try {
    // eslint-disable-next-line global-require
    af = require('../../hooks/useActivationFoundation').useActivationFoundation();
  } catch (e) { /* noop */ }
  const prospects = af?.data?.business_counts?.prospects || 0;
  const isJourneyMode = prospects > 0;
  const label = isJourneyMode
    ? t('nav.new_journey', null, 'Nuovo Design Journey™')
    : t('nav.new_lead', null, 'Nuovo Lead');
  const testid = isJourneyMode ? 'topbar-new-journey-cta' : 'topbar-new-relationship-cta';
  return (
    <button
      type="button"
      className="atelier-cta"
      data-testid={testid}
      data-mode={isJourneyMode ? 'journey' : 'relationship'}
      onClick={() => openModal
        ? openModal(isJourneyMode ? { choice: 'prospect' } : { choice: 'lead' })
        : window.location.assign('/relations/leads')}
    >
      <Plus size={13} strokeWidth={2} />
      {label}
    </button>
  );
};

// ── Identity chip (avatar only — name/email live inside the menu) ────
const IdentityChip = () => (
  <div data-testid="topbar-identity-chip" style={{ display: 'flex', alignItems: 'center' }}>
    <UserMenu />
  </div>
);

// ── Main Topbar ──────────────────────────────────────────────────
const Topbar = () => {
  const { slots } = useTopbarSlots();

  return (
    <header data-testid="topbar" className="atelier-header" style={{ position: 'relative', zIndex: 50 }}>
      {/* LEFT — workspace pill + optional page slot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, minWidth: 0, flex: 1 }}>
        <WorkspaceChip />
        {slots.left ? (
          <>
            <span style={{ height: 18, width: 1, background: 'var(--bp-border)', flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>{slots.left}</div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <NavigableBreadcrumb compact />
          </div>
        )}
      </div>

      {/* CENTER — page-injected canvas tools */}
      {slots.center && (
        <div data-testid="topbar-center" style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {slots.center}
        </div>
      )}

      {/* RIGHT — actions + global controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        {slots.right && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{slots.right}</div>
            <span style={{ width: 1, height: 20, background: 'var(--bp-border)', margin: '0 2px' }} />
          </>
        )}

        <PrimaryCta />

        <DesignerPresencePicker locale="it" compact />
        <NotificationBell locale="it" />

        <IdentityChip />
      </div>
    </header>
  );
};

export default Topbar;
