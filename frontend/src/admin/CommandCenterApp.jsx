import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Building2, Compass } from 'lucide-react';

import WorkspaceShell from './shared/WorkspaceShell';
import StudioRequestsAdmin from './pages/StudioRequestsAdmin';
import AdvisorConsole from './pages/AdvisorConsole';
import RelationDetail from './pages/RelationDetail';

/**
 * CommandCenterShell™ — MOOD Core workspace.
 *
 * Surfaces:
 *   • Studio Requests        (prospect intake)
 *   • Advisor Console        (own studio relations, follow-ups, visits)
 *   • Relation Detail        (full dossier — provenance, timeline, terms)
 *
 * Future Chunks (3–6, deferred until current chunk approved):
 *   • Commercial Terms       (list prices + discounts + audit)
 *   • Tenant Payments        (cash actual ledger)
 *   • Advisor Commissions    (accrued on actual income)
 *   • Advisor Payouts        (settlement to advisors)
 *
 * Lives at /command-center/*  — strictly separated from the tenant
 * Blueprint workspace (/blueprint/*). This is the "MOOD Core ≠ Blueprint"
 * line approved in the latest architectural review.
 */
const COMMAND_CENTER_NAV = [
  { to: '/command-center/advisor-console', icon: Compass,    label: 'Advisor Console',  testid: 'cc-nav-advisor-console' },
  { to: '/command-center/studio-requests', icon: Building2,  label: 'Studio Requests',  testid: 'cc-nav-studio-requests' },
];

const CommandCenterApp = () => (
  <WorkspaceShell
    eyebrow="MOOD"
    title="Command Center"
    navItems={COMMAND_CENTER_NAV}
    logoutTo="/command-center"
    edgeToEdgeWhen={(p) => p.startsWith('/command-center/advisor-console')}
  >
    <Routes>
      <Route index                                   element={<Navigate to="/command-center/advisor-console" replace />} />
      <Route path="advisor-console"                  element={<AdvisorConsole />} />
      <Route path="advisor-console/relations/:id"    element={<RelationDetail />} />
      <Route path="studio-requests"                  element={<StudioRequestsAdmin />} />
      <Route path="*"                                element={<Navigate to="/command-center/advisor-console" replace />} />
    </Routes>
  </WorkspaceShell>
);

export default CommandCenterApp;
