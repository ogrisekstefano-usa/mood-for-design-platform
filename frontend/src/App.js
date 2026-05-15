import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BlueprintProvider, useBlueprint } from './contexts/BlueprintContext';
import { Toaster } from 'sonner';
import './App.css';

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
const ProfessionalsGatewayPage = lazy(() => import('./pages/site/ProfessionalsGatewayPage'));
const ProfessionalIntakePage = lazy(() => import('./pages/site/ProfessionalIntakePage'));
const LanguagesPage = lazy(() => import('./pages/settings/LanguagesPage'));
const StorefrontPage = lazy(() => import('./pages/settings/StorefrontStudio'));

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

const SuperAdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const { isSuperAdmin, loading: bpLoading } = useBlueprint();
  if (loading || bpLoading) return <Loading />;
  if (!user) return <Navigate to="/auth/login" replace />;
  return isSuperAdmin ? children : <Navigate to="/dashboard" replace />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return !user ? children : <Navigate to="/dashboard" replace />;
};

const PublicMoodboardWrapper = () => <MoodboardEditor readOnly={true} />;

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BlueprintProvider>
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
                <Route path="/start-project" element={<StartProjectWizard />} />
                {/* Professional intake wizard — full-screen */}
                <Route path="/professionals/intake" element={<ProfessionalIntakePage />} />

                <Route path="/auth/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
                <Route path="/auth/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
                <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/form/:slug" element={<LeadFormPage />} />

                <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/workspace/leads" element={<LeadsPage />} />
                  <Route path="/workspace/projects" element={<ProjectsPage />} />
                  <Route path="/workspace/projects/:id" element={<ProjectDetailPage />} />
                  <Route path="/workspace/proposals" element={<ProposalsPage />} />
                  <Route path="/moodboards" element={<MoodboardsPage />} />
                  <Route path="/moodboards/:id" element={<MoodboardEditor />} />
                  <Route path="/inspirations" element={<InspirationsPage />} />
                  <Route path="/insights" element={<InsightsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/settings/brand" element={<BrandStudioPage />} />
                  <Route path="/settings/pages" element={<HomepageBuilderPage />} />
                  <Route path="/settings/domains" element={<DomainsPage />} />
                  <Route path="/settings/navigation" element={<NavigationEditorPage />} />
                  <Route path="/settings/forms" element={<FormBuilderPage />} />
                  <Route path="/settings/languages" element={<LanguagesPage />} />
                  <Route path="/settings/storefront" element={<StorefrontPage />} />
                </Route>

                <Route element={<SuperAdminRoute><AdminLayout /></SuperAdminRoute>}>
                  <Route path="/admin" element={<AdminOverviewPage />} />
                  <Route path="/admin/tenants" element={<AdminTenantsPage />} />
                  <Route path="/admin/tenants/:id" element={<AdminTenantDetailPage />} />
                  <Route path="/admin/modules" element={<AdminModulesPage />} />
                  <Route path="/admin/audit" element={<AdminAuditPage />} />
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
        </BlueprintProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
