import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import {
  Building2, Compass, LayoutDashboard, Users,
  BookOpen, FileText, Layout, Image, AlignEndHorizontal, Search, Settings as SettingsIcon,
} from 'lucide-react';

import WorkspaceShell from './shared/WorkspaceShell';
import SetPasswordModal from './components/SetPasswordModal';

// MOOD Core surfaces
import StudioRequestsAdmin from './pages/StudioRequestsAdmin';
import AdvisorConsole from './pages/AdvisorConsole';
import RelationDetail from './pages/RelationDetail';
import CommandOverview from './pages/CommandOverview';
import AdvisorsAdmin from './pages/AdvisorsAdmin';

// Blueprint CMS surfaces (mounted inside the Command Center shell so the
// super admin sees one unified workspace instead of two).
import PagesEditor from './pages/PagesEditor';
import BlocksEditor from './pages/BlocksEditor';
import SectionsManager from './pages/SectionsManager';
import MediaLibrary from './pages/MediaLibrary';
import FooterEditor from './pages/FooterEditor';
import SearchConsoleHelper from './pages/SearchConsoleHelper';
import PublishConsole from './pages/PublishConsole';

import FounderWelcome from './pages/FounderWelcome';

/**
 * CommandCenterShell™ — MOOD Core workspace + tenant CMS (unified
 * for super admin). Founder still gets the dedicated /blueprint shell.
 *
 * Sidebar by role:
 *   • admin/editor → Overview · Advisors · Advisor Console ·
 *                    Studio Requests · — · CMS (Pagine, Blocks, Sections,
 *                    Media, Footer, SEO, Publishing)
 *   • advisor      → Advisor Console · Studio Requests
 */

const ADMIN_NAV = [
  // Governance
  { to: '/command-center/overview',         icon: LayoutDashboard,    label: 'Overview',         testid: 'cc-nav-overview',     group: 'core' },
  { to: '/command-center/advisors',         icon: Users,              label: 'Advisors',         testid: 'cc-nav-advisors',     group: 'core' },
  { to: '/command-center/advisor-console',  icon: Compass,            label: 'Advisor Console',  testid: 'cc-nav-advisor-console', group: 'core' },
  { to: '/command-center/studio-requests',  icon: Building2,          label: 'Studio Requests',  testid: 'cc-nav-studio-requests', group: 'core' },
  // CMS Blueprint (unified for super admin)
  { to: '/command-center/pages',            icon: BookOpen,           label: 'Pagine',           testid: 'cc-nav-pages',        group: 'cms' },
  { to: '/command-center/blocks',           icon: FileText,           label: 'Editorial Blocks', testid: 'cc-nav-blocks',       group: 'cms' },
  { to: '/command-center/sections',         icon: Layout,             label: 'Sections',         testid: 'cc-nav-sections',     group: 'cms' },
  { to: '/command-center/media',            icon: Image,              label: 'Media Library',    testid: 'cc-nav-media',        group: 'cms' },
  { to: '/command-center/footer',           icon: AlignEndHorizontal, label: 'Footer',           testid: 'cc-nav-footer',       group: 'cms' },
  { to: '/command-center/seo',              icon: Search,             label: 'SEO & Indexing',   testid: 'cc-nav-seo',          group: 'cms' },
  { to: '/command-center/publish',          icon: SettingsIcon,       label: 'Publishing',       testid: 'cc-nav-publish',      group: 'cms' },
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

const SuperAdminOnly = ({ children }) => {
  const role = readRole();
  if (role === 'admin' || role === 'editor') return children;
  if (role === 'owner') return <Navigate to="/blueprint" replace />;
  return <Navigate to="/command-center/advisor-console" replace />;
};

const NotFounder = ({ children }) => {
  const role = readRole();
  if (role === 'owner') return <Navigate to="/blueprint" replace />;
  return children;
};

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const CommandCenterApp = () => {
  const role = readRole();
  const isAdmin = role === 'admin' || role === 'editor';
  const navItems = isAdmin ? ADMIN_NAV : ADVISOR_NAV;
  const location = useLocation();

  // ── Password onboarding gate ──
  // Fetches /api/auth/me once on mount. If the authenticated user has
  // no password set (magic-link sentinel), show a blocking modal that
  // forces them to create one. Founder (owner) is redirected to
  // /blueprint before this component renders, so the modal effectively
  // applies to advisor + editor + future roles arriving via magic-link.
  const [me, setMe] = useState(null);
  const refreshMe = async () => {
    try {
      const tok = localStorage.getItem('mood_auth_token') || '';
      if (!tok) { setMe({ ok: false }); return; }
      const r = await axios.get(`${BACKEND}/api/auth/me`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      setMe(r.data);
    } catch {
      setMe({ ok: false });
    }
  };
  useEffect(() => { refreshMe(); }, []);
  const mustSetPassword = me && me.id && me.has_password === false;

  // Identify edge-to-edge surfaces (no internal padding around <main>).
  const edgeRoutes = [
    '/command-center/advisor-console',
    '/command-center/overview',
    '/command-center/advisors',
    '/command-center/pages',
    '/command-center/blocks',
  ];
  const edge = (p) => edgeRoutes.some((r) => p === r || p.startsWith(r + '/'));

  return (
    <WorkspaceShell
      eyebrow="MOOD"
      title="Command Center"
      navItems={navItems}
      logoutTo="/command-center"
      edgeToEdgeWhen={edge}
    >
      <Routes>
        <Route index                                  element={<RootRedirect />} />
        <Route path="welcome"                         element={<FounderWelcome />} />

        {/* MOOD Core (governance) */}
        <Route path="overview"                        element={<SuperAdminOnly><CommandOverview /></SuperAdminOnly>} />
        <Route path="advisors"                        element={<SuperAdminOnly><AdvisorsAdmin /></SuperAdminOnly>} />
        <Route path="advisor-console"                 element={<NotFounder><AdvisorConsole /></NotFounder>} />
        <Route path="advisor-console/relations/:id"   element={<NotFounder><RelationDetail /></NotFounder>} />
        <Route path="studio-requests"                 element={<NotFounder><StudioRequestsAdmin /></NotFounder>} />

        {/* CMS Blueprint (mounted in-shell for super admin) */}
        <Route path="pages"                           element={<SuperAdminOnly><PagesEditor /></SuperAdminOnly>} />
        <Route path="blocks"                          element={<SuperAdminOnly><BlocksEditor /></SuperAdminOnly>} />
        <Route path="sections"                        element={<SuperAdminOnly><SectionsManager /></SuperAdminOnly>} />
        <Route path="media"                           element={<SuperAdminOnly><MediaLibrary /></SuperAdminOnly>} />
        <Route path="footer"                          element={<SuperAdminOnly><FooterEditor /></SuperAdminOnly>} />
        <Route path="seo"                             element={<SuperAdminOnly><SearchConsoleHelper /></SuperAdminOnly>} />
        <Route path="publish"                         element={<SuperAdminOnly><PublishConsole /></SuperAdminOnly>} />

        <Route path="*"                               element={<RootRedirect />} />
      </Routes>

      {mustSetPassword && (
        <SetPasswordModal
          userEmail={me?.email}
          onSuccess={refreshMe}
        />
      )}
    </WorkspaceShell>
  );
};

export default CommandCenterApp;
