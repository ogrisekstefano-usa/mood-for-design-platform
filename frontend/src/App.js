import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BlueprintProvider, useBlueprint } from './contexts/BlueprintContext';
import { TenantThemeProvider } from './contexts/TenantThemeContext';
import { Toaster } from 'sonner';
import './App.css';
// Frozen Blueprint OS tokens — declared under [data-surface="os"] only,
// so importing this file is side-effect free for the storefront subtree.
import './design-system/os/tokens.css';

const DashboardLayout = lazy(() => import('./components/layout/DashboardLayout'));
const AdminLayout = lazy(() => import('./components/layout/AdminLayout'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const SignupPage = lazy(() => import('./pages/auth/SignupPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const LeadsPage = lazy(() => import('./pages/workspace/LeadsPage'));
const ProjectsPage = lazy(() => import('./pages/workspace/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('./pages/workspace/ProjectDetailPage'));
const ProposalsPage = lazy(() => import('./pages/workspace/ProposalsPage'));
const MoodboardsPage = lazy(() => import('./pages/moodboards/MoodboardsPage'));
const InspirationsPage = lazy(() => import('./pages/inspirations/InspirationsPage'));
const InsightsPage = lazy(() => import('./pages/insights/InsightsPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const BrandStudioPage = lazy(() => import('./pages/settings/BrandStudioPage'));
const DomainsPage = lazy(() => import('./pages/settings/DomainsPage'));
const HomepageBuilderPage = lazy(() => import('./pages/settings/HomepageBuilderPage'));
const NavigationEditorPage = lazy(() => import('./pages/settings/NavigationEditorPage'));
const FormBuilderPage = lazy(() => import('./pages/settings/FormBuilderPage'));
const PublicTenantPage = lazy(() => import('./pages/public/PublicTenantPage'));
const PublicFormPage = lazy(() => import('./pages/public/PublicFormPage'));
const LeadFormPage = lazy(() => import('./pages/public/LeadFormPage'));
const MoodboardEditor = lazy(() => import('./pages/moodboards/MoodboardEditor'));
const PublicPresentation = lazy(() => import('./pages/moodboards/PublicPresentation'));
const ReviewMode = lazy(() => import('./pages/collab/ReviewMode'));

// Site (public marketing) — global brand surface
const SiteLayout = lazy(() => import('./site/SiteLayout'));
const HomePage = lazy(() => import('./pages/site/HomePage'));
const ProjectsIndexPage = lazy(() => import('./pages/site/ProjectsIndexPage'));
const SiteProjectDetailPage = lazy(() => import('./pages/site/ProjectDetailPage'));
const OnboardingPlaceholderPage = lazy(() => import('./pages/site/OnboardingPlaceholderPage'));
const StartProjectWizard = lazy(() => import('./pages/site/StartProjectWizard'));
import MagazinePage from './pages/site/MagazinePage';
import MagazineArticlePage from './pages/site/MagazineArticlePage';
const ProfessionalsGatewayPage = lazy(() => import('./pages/site/ProfessionalsGatewayPage'));
const ProfessionalIntakePage = lazy(() => import('./pages/site/ProfessionalIntakePage'));
const LanguagesPage = lazy(() => import('./pages/settings/LanguagesPage'));
const StorefrontPage = lazy(() => import('./pages/settings/StorefrontStudio'));
const MembersPage = lazy(() => import('./pages/settings/MembersPage'));
const PlanPage = lazy(() => import('./pages/settings/PlanPage'));

// Library — operational asset layer (Phase N)
const MediaLibraryPage = lazy(() => import('./pages/library/MediaLibraryPage'));
const MaterialsPage = lazy(() => import('./pages/library/MaterialsPage'));
const MaterialDetailPage = lazy(() => import('./pages/library/MaterialDetailPage'));

// Client Portal (Phase R) — surface-isolated experience for role=client
const ClientDashboardLayout = lazy(() => import('./components/client/ClientDashboardLayout'));
const ClientOverviewPage = lazy(() => import('./pages/client/ClientOverviewPage'));
const ClientMessagesPage = lazy(() => import('./pages/client/ClientMessagesPage'));
import {
  ClientProjectPage, ClientMoodboardsPage, ClientTimelinePage,
  ClientApprovalsPage, ClientFilesPage,
} from './pages/client/ClientStubPages';

// Coming-soon placeholders for sidebar routes not yet implemented
import {
  CalendarComingSoon, ActivityComingSoon, TeamComingSoon, ClientsComingSoon,
  MessagesComingSoon, ReportsComingSoon, IntegrationsComingSoon, CollectionsComingSoon,
} from './pages/common/ComingSoonPage';

// Admin
const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage'));
const AdminTenantsPage = lazy(() => import('./pages/admin/AdminTenantsPage'));
const AdminTenantDetailPage = lazy(() => import('./pages/admin/AdminTenantDetailPage'));
const AdminModulesPage = lazy(() => import('./pages/admin/AdminModulesPage'));
const AdminAuditPage = lazy(() => import('./pages/admin/AdminAuditPage'));

const Loading = () => {
  let label = 'Loading';
  try { const ctx = useBlueprint(); label = ctx?.t?.('common.loading', null, 'Loading') || 'Loading'; } catch (_) {}
  return (
    <div className="min-h-screen bg-[var(--bp-bg,#0A0A0B)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-[var(--bp-primary,#D4AF37)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#6B6863] text-xs font-body tracking-widest uppercase">{label}</p>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? children : <Navigate to="/auth/login" replace />;
};

// Client portal gate. Auto-redirects role=client to /client and blocks
// other roles from accessing the client portal.
const ClientRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/auth/login" replace />;
  if ((user.role || '').toLowerCase() !== 'client') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

// Wraps the OS DashboardLayout but kicks role=client out to /client.
// This prevents a logged-in client from landing on the Blueprint OS
// dashboard even if they manually navigate to /dashboard.
const StudioRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/auth/login" replace />;
  if ((user.role || '').toLowerCase() === 'client') {
    return <Navigate to="/client" replace />;
  }
  return children;
};

const SuperAdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const { isSuperAdmin, loading: bpLoading } = useBlueprint();
  if (loading || bpLoading) return <Loading />;
  if (!user) return <Navigate to="/auth/login" replace />;
  return isSuperAdmin ? children : <Navigate to="/dashboard" replace />;
};

// Studio config routes (storefront editor, branding, domains, forms, plan, etc.)
// are restricted to tenant_admin / super_admin. Other roles bounce back to
// /dashboard before the page shell mounts — no half-loaded error states.
const StudioAdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/auth/login" replace />;
  const role = (user.role || '').toLowerCase();
  if (role === 'tenant_admin' || role === 'super_admin') return children;
  if (role === 'client') return <Navigate to="/client" replace />;
  return <Navigate to="/dashboard" replace />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return children;
  // Logged-in users: route client to /client, all others to /dashboard
  const role = (user.role || '').toLowerCase();
  return <Navigate to={role === 'client' ? '/client' : '/dashboard'} replace />;
};

import BlueprintThemeProvider from './design-system/os/BlueprintThemeProvider';

const OSWrap = ({ children }) => (
  <BlueprintThemeProvider className="min-h-screen">{children}</BlueprintThemeProvider>
);

const PublicMoodboardWrapper = () => <MoodboardEditor readOnly={true} />;

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BlueprintProvider>
          <TenantThemeProvider>
          <BrowserRouter>
            <Suspense fallback={<Loading />}>
              <Routes>
                {/* SITE (public marketing) — global brand surface */}
                <Route element={<SiteLayout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/projects" element={<ProjectsIndexPage />} />
                  <Route path="/projects/:slug" element={<SiteProjectDetailPage />} />
                  <Route path="/onboarding/:kind" element={<OnboardingPlaceholderPage />} />
                  <Route path="/professionals" element={<ProfessionalsGatewayPage />} />
                </Route>

                {/* Private onboarding wizard — full-screen, no SiteLayout chrome */}
                <Route path="/start-project" element={<OSWrap><StartProjectWizard /></OSWrap>} />
                {/* Magazine — public editorial lead-generation engine (Phase Y) */}
                <Route path="/magazine" element={<OSWrap><MagazinePage /></OSWrap>} />
                <Route path="/magazine/:slug" element={<OSWrap><MagazineArticlePage /></OSWrap>} />
                {/* Professional intake wizard — full-screen */}
                <Route path="/professionals/intake" element={<OSWrap><ProfessionalIntakePage /></OSWrap>} />

                <Route path="/auth/login" element={<OSWrap><PublicRoute><LoginPage /></PublicRoute></OSWrap>} />
                <Route path="/auth/signup" element={<OSWrap><PublicRoute><SignupPage /></PublicRoute></OSWrap>} />
                <Route path="/auth/forgot-password" element={<OSWrap><ForgotPasswordPage /></OSWrap>} />
                <Route path="/form/:slug" element={<LeadFormPage />} />

                <Route element={<ProtectedRoute><StudioRoute><DashboardLayout /></StudioRoute></ProtectedRoute>}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/workspace/leads" element={<LeadsPage />} />
                  <Route path="/workspace/projects" element={<ProjectsPage />} />
                  <Route path="/workspace/projects/:id" element={<ProjectDetailPage />} />
                  <Route path="/workspace/proposals" element={<ProposalsPage />} />
                  <Route path="/moodboards" element={<MoodboardsPage />} />
                  <Route path="/moodboards/:id" element={<MoodboardEditor />} />
                  <Route path="/library" element={<MediaLibraryPage />} />
                  <Route path="/library/materials" element={<MaterialsPage />} />
                  <Route path="/library/materials/:slug" element={<MaterialDetailPage />} />
                  <Route path="/library/collections" element={<CollectionsComingSoon />} />
                  <Route path="/workspace/calendar" element={<CalendarComingSoon />} />
                  <Route path="/workspace/activity" element={<ActivityComingSoon />} />
                  <Route path="/workspace/team" element={<TeamComingSoon />} />
                  <Route path="/workspace/clients" element={<ClientsComingSoon />} />
                  <Route path="/workspace/messages" element={<MessagesComingSoon />} />
                  <Route path="/workspace/reports" element={<ReportsComingSoon />} />
                  <Route path="/settings/integrations" element={<IntegrationsComingSoon />} />
                  <Route path="/inspirations" element={<InspirationsPage />} />
                  <Route path="/insights" element={<InsightsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/settings/brand" element={<StudioAdminRoute><BrandStudioPage /></StudioAdminRoute>} />
                  <Route path="/settings/domains" element={<StudioAdminRoute><DomainsPage /></StudioAdminRoute>} />
                  <Route path="/settings/forms" element={<StudioAdminRoute><FormBuilderPage /></StudioAdminRoute>} />
                  <Route path="/settings/storefront" element={<StudioAdminRoute><StorefrontPage /></StudioAdminRoute>} />
                  <Route path="/settings/plan" element={<StudioAdminRoute><PlanPage /></StudioAdminRoute>} />
                  <Route path="/settings/team" element={<StudioAdminRoute><MembersPage /></StudioAdminRoute>} />
                  <Route path="/settings/members" element={<StudioAdminRoute><MembersPage /></StudioAdminRoute>} />
                </Route>

                {/* CLIENT PORTAL (Phase R) — surface-isolated, role=client only */}
                <Route element={<ClientRoute><ClientDashboardLayout /></ClientRoute>}>
                  <Route path="/client" element={<ClientOverviewPage />} />
                  <Route path="/client/project" element={<ClientProjectPage />} />
                  <Route path="/client/moodboards" element={<ClientMoodboardsPage />} />
                  <Route path="/client/timeline" element={<ClientTimelinePage />} />
                  <Route path="/client/approvals" element={<ClientApprovalsPage />} />
                  <Route path="/client/files" element={<ClientFilesPage />} />
                  <Route path="/client/messages" element={<ClientMessagesPage />} />
                </Route>

                <Route element={<SuperAdminRoute><AdminLayout /></SuperAdminRoute>}>                  <Route path="/admin" element={<AdminOverviewPage />} />
                  <Route path="/admin/tenants" element={<AdminTenantsPage />} />
                  <Route path="/admin/tenants/:id" element={<AdminTenantDetailPage />} />
                  <Route path="/admin/modules" element={<AdminModulesPage />} />
                  <Route path="/admin/audit" element={<AdminAuditPage />} />
                  {/* New IA — superadmin-only platform internals */}
                  <Route path="/admin/languages" element={<LanguagesPage />} />
                  <Route path="/admin/pages" element={<HomepageBuilderPage />} />
                  {/* /superadmin/* aliases per Session-G architecture */}
                  <Route path="/superadmin" element={<AdminOverviewPage />} />
                  <Route path="/superadmin/tenants" element={<AdminTenantsPage />} />
                  <Route path="/superadmin/tenants/:id" element={<AdminTenantDetailPage />} />
                  <Route path="/superadmin/modules" element={<AdminModulesPage />} />
                  <Route path="/superadmin/audit" element={<AdminAuditPage />} />
                  <Route path="/superadmin/languages" element={<LanguagesPage />} />
                  <Route path="/superadmin/pages" element={<HomepageBuilderPage />} />
                </Route>

                {/* PUBLIC tenant routes — runtime composition via Blueprint engine */}
                <Route path="/moodboard/share/:shareToken" element={<PublicMoodboardWrapper />} />
                <Route path="/presentation/:shareToken" element={<PublicPresentation />} />
                <Route path="/review/:shareToken" element={<ReviewMode />} />
                <Route path="/f/:tenantSlug/:formSlug" element={<PublicFormPage />} />
                <Route path="/:tenantSlug" element={<PublicTenantPage />} />
                <Route path="/:tenantSlug/:pageSlug" element={<PublicTenantPage />} />

                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster
            position="bottom-right"
            theme="dark"
            toastOptions={{
              className: 'bp-toast',
              style: {
                background: 'var(--bp-surface-2)',
                color: 'var(--bp-text-primary)',
                border: '1px solid var(--bp-border)',
                fontFamily: 'var(--bp-font-body)',
              },
            }}
          />
          </TenantThemeProvider>
        </BlueprintProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
