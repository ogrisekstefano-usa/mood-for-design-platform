import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { BookOpen, FileText, Layout, Image, AlignEndHorizontal, Search, Settings as SettingsIcon, Building2, HelpCircle } from 'lucide-react';

import WorkspaceShell from './shared/WorkspaceShell';
import BlocksEditor from './pages/BlocksEditor';
import SectionsManager from './pages/SectionsManager';
import MediaLibrary from './pages/MediaLibrary';
import PublishConsole from './pages/PublishConsole';
import PagesEditor from './pages/PagesEditor';
import FooterEditor from './pages/FooterEditor';
import SearchConsoleHelper from './pages/SearchConsoleHelper';
import BlueprintOverview from './pages/BlueprintOverview';
import BlueprintFaqAdmin from './pages/BlueprintFaqAdmin';

/**
 * BlueprintShell™ — Tenant runtime workspace.
 *
 * Surfaces:
 *   • Pages / Blocks / Sections / Media / Footer
 *   • SEO indexing helpers
 *   • Publishing console
 *
 * Lives at  /blueprint/*  on the central platform (corporate tenant `studio`).
 * Future:   each tenant will mount its own BlueprintShell on its subdomain
 *           (e.g. martinel.moodfordesign.com/blueprint).
 *
 * MOOD Core (advisors, studio requests, lifecycle) lives in a separate
 * shell at /command-center/*.
 */
const BLUEPRINT_NAV = [
  { to: '/blueprint/overview', icon: Building2,          label: 'Studio',           testid: 'blueprint-nav-overview' },
  { to: '/blueprint/pages',    icon: BookOpen,           label: 'Pagine',           testid: 'blueprint-nav-pages' },
  { to: '/blueprint/faq',      icon: HelpCircle,         label: 'FAQ',              testid: 'blueprint-nav-faq' },
  { to: '/blueprint/blocks',   icon: FileText,           label: 'Editorial Blocks', testid: 'blueprint-nav-blocks' },
  { to: '/blueprint/sections', icon: Layout,             label: 'Sections',         testid: 'blueprint-nav-sections' },
  { to: '/blueprint/media',    icon: Image,              label: 'Media Library',    testid: 'blueprint-nav-media' },
  { to: '/blueprint/footer',   icon: AlignEndHorizontal, label: 'Footer',           testid: 'blueprint-nav-footer' },
  { to: '/blueprint/seo',      icon: Search,             label: 'SEO & Indexing',   testid: 'blueprint-nav-seo' },
  { to: '/blueprint/publish',  icon: SettingsIcon,       label: 'Publishing',       testid: 'blueprint-nav-publish' },
];

const BlueprintApp = () => (
  <WorkspaceShell
    eyebrow="Blueprint"
    title="Workspace"
    navItems={BLUEPRINT_NAV}
    logoutTo="/blueprint"
    edgeToEdgeWhen={(p) => p === '/blueprint/pages' || p.startsWith('/blueprint/pages/')}
  >
    <Routes>
      <Route index            element={<Navigate to="/blueprint/overview" replace />} />
      <Route path="overview"  element={<BlueprintOverview />} />
      <Route path="pages"     element={<PagesEditor />} />
      <Route path="faq"       element={<BlueprintFaqAdmin />} />
      <Route path="blocks"    element={<BlocksEditor />} />
      <Route path="sections"  element={<SectionsManager />} />
      <Route path="media"     element={<MediaLibrary />} />
      <Route path="footer"    element={<FooterEditor />} />
      <Route path="seo"       element={<SearchConsoleHelper />} />
      <Route path="publish"   element={<PublishConsole />} />
      <Route path="*"         element={<Navigate to="/blueprint/overview" replace />} />
    </Routes>
  </WorkspaceShell>
);

export default BlueprintApp;
