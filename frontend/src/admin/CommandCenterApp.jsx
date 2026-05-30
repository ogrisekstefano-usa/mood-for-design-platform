import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Building2, Compass, LayoutDashboard, Users, Layers } from 'lucide-react';

import WorkspaceShell from './shared/WorkspaceShell';
import StudioRequestsAdmin from './pages/StudioRequestsAdmin';
import AdvisorConsole from './pages/AdvisorConsole';
import RelationDetail from './pages/RelationDetail';
import CommandOverview from './pages/CommandOverview';
import AdvisorsAdmin from './pages/AdvisorsAdmin';

/**
 * CommandCenterShell™ — MOOD Core workspace.
 *
 * Two scopes share the same shell:
 *   • Super Admin (role=admin/editor)
 *       Nav: Overview · Advisor Console · Studio Requests
 *       Default surface: /command-center/overview (governance)
 *   • Advisor (role=advisor)
 *       Nav: Advisor Console (own) · Studio Requests (own + unassigned)
 *       Default surface: /command-center/advisor-console
 *
 * Founder (role=owner) can only reach /command-center/welcome — every
 * other Command Center path redirects them to /blueprint (their own
 * tenant workspace).
 */
const ADMIN_NAV = [
  { to: '/command-center/overview',         icon: LayoutDashboard, label: 'Overview',         testid: 'cc-nav-overview' },
  { to: '/command-center/advisors',         icon: Users,           label: 'Advisors',         testid: 'cc-nav-advisors' },
  { to: '/command-center/advisor-console',  icon: Compass,         label: 'Advisor Console',  testid: 'cc-nav-advisor-console' },
  { to: '/command-center/studio-requests',  icon: Building2,       label: 'Studio Requests',  testid: 'cc-nav-studio-requests' },
  { to: '/blueprint',                       icon: Layers,          label: 'Blueprint · CMS',  testid: 'cc-nav-blueprint' },
];

const ADVISOR_NAV = [
  { to: '/command-center/advisor-console',  icon: Compass,    label: 'Advisor Console',  testid: 'cc-nav-advisor-console' },
  { to: '/command-center/studio-requests',  icon: Building2,  label: 'Studio Requests',  testid: 'cc-nav-studio-requests' },
];

const readRole = () => {
  try {
    const u = JSON.parse(
      localStorage.getItem('mood_auth_user') ||
      localStorage.getItem('mood_user') ||
      '{}',
    );
    return (u.role || '').toLowerCase();
  } catch {
    return '';
  }
};

/**
 * Decide where /command-center (index) should send each role.
 *   • super admin (admin/editor) → /overview
 *   • advisor                    → /advisor-console
 *   • founder (owner)            → /blueprint  (their own workspace)
 *   • anything else              → /advisor-console (defensive default)
 */
const RootRedirect = () => {
  const role = readRole();
  if (role === 'admin' || role === 'editor') {
    return <Navigate to="/command-center/overview" replace />;
  }
  if (role === 'owner') {
    return <Navigate to="/blueprint" replace />;
  }
  return <Navigate to="/command-center/advisor-console" replace />;
};

/**
 * SuperAdminOnly — wraps Overview. Advisors get redirected to their
 * scoped console rather than seeing a 403 page.
 */
const SuperAdminOnly = ({ children }) => {
  const role = readRole();
  if (role === 'admin' || role === 'editor') return children;
  if (role === 'owner') return <Navigate to="/blueprint" replace />;
  return <Navigate to="/command-center/advisor-console" replace />;
};

/**
 * NotFounder — Command Center surfaces (other than /welcome) are not
 * for founders. Pushes them to Blueprint.
 */
const NotFounder = ({ children }) => {
  const role = readRole();
  if (role === 'owner') return <Navigate to="/blueprint" replace />;
  return children;
};

const CommandCenterApp = () => {
  const role = readRole();
  const navItems = (role === 'admin' || role === 'editor') ? ADMIN_NAV : ADVISOR_NAV;
  const location = useLocation();

  return (
    <WorkspaceShell
      eyebrow="MOOD"
      title="Command Center"
      navItems={navItems}
      logoutTo="/command-center"
      edgeToEdgeWhen={(p) =>
        p.startsWith('/command-center/advisor-console') ||
        p.startsWith('/command-center/overview') ||
        p.startsWith('/command-center/advisors')
      }
    >
      <Routes>
        <Route index                                  element={<RootRedirect />} />
        <Route path="overview"                        element={<SuperAdminOnly><CommandOverview /></SuperAdminOnly>} />
        <Route path="advisors"                        element={<SuperAdminOnly><AdvisorsAdmin /></SuperAdminOnly>} />
        <Route path="advisor-console"                 element={<NotFounder><AdvisorConsole /></NotFounder>} />
        <Route path="advisor-console/relations/:id"   element={<NotFounder><RelationDetail /></NotFounder>} />
        <Route path="studio-requests"                 element={<NotFounder><StudioRequestsAdmin /></NotFounder>} />
        <Route path="*"                               element={<RootRedirect />} />
      </Routes>
    </WorkspaceShell>
  );
};

export default CommandCenterApp;
