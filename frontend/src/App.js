import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BlueprintProvider, useBlueprint } from './contexts/BlueprintContext';
import { TenantConfigurationProvider } from './contexts/TenantConfigurationContext';
import { TenantThemeProvider } from './contexts/TenantThemeContext';
import { StudioPaletteProvider } from './contexts/StudioPaletteContext';
import { LocaleRuntimeProvider } from './contexts/LocaleRuntimeContext';
import { BlueprintI18nProvider } from './i18n';
import LocaleRoute from './site/LocaleRoute';
import LocaleHead from './site/LocaleHead';
import CinematicLoader from './components/CinematicLoader';
import { Toaster } from 'sonner';
import './App.css';
// ── Sprint HARDENING-01.1 · Design System Kernel™ (single source of truth) ──
import './design-system/kernel.css';
// Frozen Blueprint OS tokens — declared under [data-surface="os"] only,
// so importing this file is side-effect free for the storefront subtree.
import './design-system/os/tokens.css';
import './styles/rtl-guards.css';

const DashboardLayout = lazy(() => import('./components/layout/DashboardLayout'));
const AdminLayout = lazy(() => import('./components/layout/AdminLayout'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const SignupPage = lazy(() => import('./pages/auth/SignupPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const AuthCallbackPage = lazy(() => import('./pages/auth/AuthCallbackPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const JourneyPulsePage = lazy(() => import('./pages/dashboard/JourneyPulsePage'));
const AtelierDashboardPage = lazy(() => import('./pages/dashboard/AtelierDashboardPage'));
const LeadsPage = lazy(() => import('./pages/workspace/LeadsPage'));
const ProjectsPage = lazy(() => import('./pages/workspace/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('./pages/workspace/ProjectDetailPage'));
const ProposalsPage = lazy(() => import('./pages/workspace/ProposalsPage'));
const ProposalComposerPage = lazy(() => import('./pages/workspace/ProposalComposerPage'));
const ReferencesPage = lazy(() => import('./pages/workspace/ReferencesPage'));
const VariantApprovalInboxPage = lazy(() => import('./pages/editorial/VariantApprovalInboxPage'));
const EditorialStudioPage = lazy(() => import('./pages/editorial/EditorialStudioPage'));
const MarketMatrixPage = lazy(() => import('./pages/governance/MarketMatrixPage'));
const MarketInsightsPage = lazy(() => import('./pages/governance/MarketInsightsPage'));
const BrandVoiceAdaptersPage = lazy(() => import('./pages/governance/BrandVoiceAdaptersPage'));
const StudioVoicePage = lazy(() => import('./pages/blueprint/StudioVoicePage'));
const LanguageCommandCenter = lazy(() => import('./pages/blueprint/LanguageCommandCenter'));
const CrmAccountsPage = lazy(() => import('./pages/crm/CrmAccountsPage'));
const AccountDetailPage = lazy(() => import('./pages/crm/AccountDetailPage'));
const CulturalEditionsListPage = lazy(() => import('./pages/cultural/CulturalEditionsListPage'));
const CulturalEditionReviewPage = lazy(() => import('./pages/cultural/CulturalEditionReviewPage'));
const InternationalPresencePage = lazy(() => import('./pages/settings/InternationalPresencePage'));
const StorefrontStudioPage = lazy(() => import('./pages/storefront/StorefrontStudioPage'));
const EditorialCalendarPage = lazy(() => import('./pages/editorial/EditorialCalendarPage'));
const ProjectsStudioPage = lazy(() => import('./pages/projects/ProjectsStudioPage'));
const MoodboardsPage = lazy(() => import('./pages/moodboards/MoodboardsPage'));
const InspirationsPage = lazy(() => import('./pages/inspirations/InspirationsPage'));
const StudioCollectionsPage = lazy(() => import('./pages/inspirations/StudioCollectionsPage'));
const BrandModePage = lazy(() => import('./pages/inspirations/BrandModePage'));
const BrandDetailPage = lazy(() => import('./pages/inspirations/BrandDetailPage'));
const ProductGalleryPage = lazy(() => import('./pages/inspirations/ProductGalleryPage'));
const MaterialViewPage = lazy(() => import('./pages/inspirations/MaterialViewPage'));
const ClientPreviewPage = lazy(() => import('./pages/ClientPreviewPage'));
const InsightsPage = lazy(() => import('./pages/insights/InsightsPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const AtelierDashboardAdminPage = lazy(() => import('./pages/settings/AtelierDashboardAdminPage'));
const BrandStudioPage = lazy(() => import('./pages/settings/BrandStudioPage'));
const DomainsPage = lazy(() => import('./pages/settings/DomainsPage'));
// ITER143E · Tenant Email Branding™
const EmailBrandingPage = lazy(() => import('./pages/EmailBrandingPage'));
const HomepageBuilderPage = lazy(() => import('./pages/settings/HomepageBuilderPage'));
const NavigationEditorPage = lazy(() => import('./pages/settings/NavigationEditorPage'));
const FormBuilderPage = lazy(() => import('./pages/settings/FormBuilderPage'));
const PublicTenantPage = lazy(() => import('./pages/public/PublicTenantPage'));
const PublicFormPage = lazy(() => import('./pages/public/PublicFormPage'));
const LeadFormPage = lazy(() => import('./pages/public/LeadFormPage'));
const MoodboardEditor = lazy(() => import('./pages/moodboards/MoodboardEditor'));
const PublicPresentation = lazy(() => import('./pages/moodboards/PublicPresentation'));
const ReviewMode = lazy(() => import('./pages/collab/ReviewMode'));
const StepWorkspacePage = lazy(() => import('./pages/journey/StepWorkspacePage'));
const ComingSoonPage = lazy(() => import('./pages/placeholder/ComingSoonPage'));

// Site (public marketing) — global brand surface
const SiteLayout = lazy(() => import('./site/SiteLayout'));
const HomePage = lazy(() => import('./pages/site/HomePage'));
const ProjectsIndexPage = lazy(() => import('./pages/site/ProjectsIndexPage'));
const SiteProjectDetailPage = lazy(() => import('./pages/site/ProjectDetailPage'));
const OnboardingPlaceholderPage = lazy(() => import('./pages/site/OnboardingPlaceholderPage'));
const StartProjectWizard = lazy(() => import('./pages/site/StartProjectWizard'));
const BeginJourneyPage   = lazy(() => import('./pages/site/BeginJourneyPage'));
const JourneyWelcomePage = lazy(() => import('./pages/site/JourneyWelcomePage'));
import MagazinePage from './pages/site/MagazinePage';
import MagazineArticlePage from './pages/site/MagazineArticlePage';
const MagazineAdminPage = lazy(() => import('./pages/settings/MagazineAdminPage'));
const MagazineEditorPage = lazy(() => import('./pages/settings/MagazineEditorPage'));
const ProfessionalsGatewayPage = lazy(() => import('./pages/site/ProfessionalsGatewayPage'));
const ProfessionalIntakePage = lazy(() => import('./pages/site/ProfessionalIntakePage'));
const LanguagesPage = lazy(() => import('./pages/settings/LanguagesPage'));
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
const ClientJourneysIndexPage = lazy(() => import('./pages/client/ClientJourneysIndexPage'));
const ClientCompanionPage = lazy(() => import('./pages/client/ClientCompanionPage'));
// Legacy client stub pages — still mountable at /client/overview-legacy for QA;
// daily routes redirect to the new Journey Companion (Sprint G.7).
// eslint-disable-next-line no-unused-vars
import { ClientProjectPage, ClientMoodboardsPage, ClientTimelinePage,
         ClientApprovalsPage, ClientFilesPage } from './pages/client/ClientStubPages';

// MVP-lite operational hubs replacing the previous "Coming soon" placeholders.
// Workflow-aware: each redirects/links to the real feature that already
// covers the user need today, instead of a dead-end roadmap page.
import {
  ClientsHub, MessagesHub, CalendarHub, ActivityHub,
  ReportsHub, IntegrationsHub, CollectionsHub,
} from './pages/common/MvpLitePage';

// Admin
const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage'));
const AdminTenantsPage = lazy(() => import('./pages/admin/AdminTenantsPage'));
const AdminTenantDetailPage = lazy(() => import('./pages/admin/AdminTenantDetailPage'));
const AdminModulesPage = lazy(() => import('./pages/admin/PlatformCapabilitiesPage'));
const AdminAuditPage = lazy(() => import('./pages/admin/AdminAuditPage'));
const AdvisorNetworkAdminPage = lazy(() => import('./pages/admin/AdvisorNetworkAdminPage'));
const AdvisorDetailPage = lazy(() => import('./pages/admin/AdvisorDetailPage'));
const AdvisorDashboardPage = lazy(() => import('./pages/advisor/AdvisorDashboardPage'));

// ITER143C · Blueprint Command Center™ — cinematic admin shell + 8 pages.
const AdminShell = lazy(() => import('./pages/admin/AdminShell'));
import {
  AdminIndexPage, DashboardGovernancePage, TenantsGovernancePage,
  UsersGovernancePage, PresetsGovernancePage, EditorialRuntimePage,
  EmailGovernancePage, DemoGovernancePage,
} from './pages/admin/BlueprintGovernancePages';
// ITER144 · Tenant Configuration Foundation™ — runtime governance.
const BlueprintTenantConfigurationPage = lazy(() => import('./pages/admin/BlueprintTenantConfigurationPage'));

const Loading = () => {
  // CinematicLoader rendered inside the cinematic canvas — replaces the
  // legacy spinner with editorial atmosphere (cyan pulse + italic Cormorant
  // phrase). i18n via atelier.loader.* (rotates through 6 phrases).
  return (
    <div className="min-h-screen flex items-center justify-center"
         style={{ background: 'var(--bp-bg, #050608)' }}>
      <CinematicLoader variant="centered" testid="route-loader" />
    </div>
  );
};

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? children : <Navigate to="/auth/login" replace />;
};

/**
 * ShortLocaleRedirect — bridges convenience short prefixes (e.g. `/it`,
 * `/en`) to canonical BCP-47 paths (`/it-IT`, `/en-US`). Mounted as a
 * splat route so it captures the entire remaining segment.
 */
const ShortLocaleRedirect = ({ to }) => {
  const { pathname, search, hash } = window.location;
  // pathname starts with /<short>/...  → keep everything after
  const rest = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '');
  return <Navigate to={`/${to}${rest}${search}${hash}`} replace />;
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
  // Belt-and-suspenders: accept synchronous user.role as a fallback so a
  // race in BlueprintContext can't redirect a legitimate super_admin.
  const synchronousSuperAdmin =
    (user.role || '').toLowerCase() === 'super_admin' ||
    !!user.is_super_admin;
  return (isSuperAdmin || synchronousSuperAdmin)
    ? children
    : <Navigate to="/dashboard" replace />;
};

// ITER143C · Blueprint Command Center™ — ROOT SUPERADMIN gate.
// Source of truth is `user.is_root_superadmin` (loaded by /api/auth/me).
// A regular super_admin (Blueprint Collaborator) CANNOT pass this gate.
const RootSuperAdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/auth/login" replace />;
  if (!user.is_root_superadmin) return <Navigate to="/dashboard" replace />;
  return children;
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

import GovernanceOverlay from './design-system/GovernanceOverlay';
import LocalizationOverlay from './i18n/LocalizationOverlay';

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BlueprintProvider>
          <TenantConfigurationProvider>
          <TenantThemeProvider>
          <StudioPaletteProvider>
          <LocaleRuntimeProvider>
          <BlueprintI18nProvider>
          <BrowserRouter>
            <GovernanceOverlay />
            <LocalizationOverlay />
            <Suspense fallback={<Loading />}>
              <LocaleHead />
              <Routes>
                {/* Client Preview Link™ — public, no auth, no layout.
                    Sprint F2.4: presentazione cliente fullscreen cinematic. */}
                <Route path="/preview/:token" element={<ClientPreviewPage />} />

                {/* SITE (public marketing) — global brand surface.
                    Magazine + Start Project now share the same SiteLayout
                    (P0 stabilization: ONE renderer, ONE runtime, ONE source of truth). */}
                <Route element={<SiteLayout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/projects" element={<ProjectsIndexPage />} />
                  <Route path="/projects/:slug" element={<SiteProjectDetailPage />} />
                  <Route path="/magazine" element={<MagazinePage />} />
                  <Route path="/magazine/:slug" element={<MagazineArticlePage />} />
                  <Route path="/start-project" element={<StartProjectWizard />} />
                  <Route path="/begin-journey" element={<BeginJourneyPage />} />
                  <Route path="/journey/welcome/:token" element={<JourneyWelcomePage />} />
                  <Route path="/onboarding/:kind" element={<OnboardingPlaceholderPage />} />
                  <Route path="/professionals" element={<ProfessionalsGatewayPage />} />
                  <Route path="/professionals/intake" element={<ProfessionalIntakePage />} />
                </Route>

                {/* Locale-prefixed mirrors — strict BCP-47 segments only.
                    All public routes inherit SiteLayout. */}
                <Route
                  path="/it-IT"
                  element={<LocaleRoute locale="it-IT"><SiteLayout /></LocaleRoute>}
                >
                  <Route index element={<HomePage />} />
                  <Route path="projects" element={<ProjectsIndexPage />} />
                  <Route path="projects/:slug" element={<SiteProjectDetailPage />} />
                  <Route path="professionals" element={<ProfessionalsGatewayPage />} />
                  <Route path="magazine" element={<MagazinePage />} />
                  <Route path="magazine/:slug" element={<MagazineArticlePage />} />
                </Route>
                <Route
                  path="/en-US"
                  element={<LocaleRoute locale="en-US"><SiteLayout /></LocaleRoute>}
                >
                  <Route index element={<HomePage />} />
                  <Route path="projects" element={<ProjectsIndexPage />} />
                  <Route path="projects/:slug" element={<SiteProjectDetailPage />} />
                  <Route path="professionals" element={<ProfessionalsGatewayPage />} />
                  <Route path="magazine" element={<MagazinePage />} />
                  <Route path="magazine/:slug" element={<MagazineArticlePage />} />
                </Route>
                <Route
                  path="/en-GB"
                  element={<LocaleRoute locale="en-GB"><SiteLayout /></LocaleRoute>}
                >
                  <Route index element={<HomePage />} />
                  <Route path="projects" element={<ProjectsIndexPage />} />
                  <Route path="projects/:slug" element={<SiteProjectDetailPage />} />
                  <Route path="professionals" element={<ProfessionalsGatewayPage />} />
                  <Route path="magazine" element={<MagazinePage />} />
                  <Route path="magazine/:slug" element={<MagazineArticlePage />} />
                </Route>
                <Route
                  path="/es-ES"
                  element={<LocaleRoute locale="es-ES"><SiteLayout /></LocaleRoute>}
                >
                  <Route index element={<HomePage />} />
                  <Route path="projects" element={<ProjectsIndexPage />} />
                  <Route path="projects/:slug" element={<SiteProjectDetailPage />} />
                  <Route path="professionals" element={<ProfessionalsGatewayPage />} />
                  <Route path="magazine" element={<MagazinePage />} />
                  <Route path="magazine/:slug" element={<MagazineArticlePage />} />
                </Route>
                <Route
                  path="/fr-FR"
                  element={<LocaleRoute locale="fr-FR"><SiteLayout /></LocaleRoute>}
                >
                  <Route index element={<HomePage />} />
                  <Route path="projects" element={<ProjectsIndexPage />} />
                  <Route path="projects/:slug" element={<SiteProjectDetailPage />} />
                  <Route path="professionals" element={<ProfessionalsGatewayPage />} />
                  <Route path="magazine" element={<MagazinePage />} />
                  <Route path="magazine/:slug" element={<MagazineArticlePage />} />
                </Route>
                <Route
                  path="/de-DE"
                  element={<LocaleRoute locale="de-DE"><SiteLayout /></LocaleRoute>}
                >
                  <Route index element={<HomePage />} />
                  <Route path="projects" element={<ProjectsIndexPage />} />
                  <Route path="projects/:slug" element={<SiteProjectDetailPage />} />
                  <Route path="professionals" element={<ProfessionalsGatewayPage />} />
                  <Route path="magazine" element={<MagazinePage />} />
                  <Route path="magazine/:slug" element={<MagazineArticlePage />} />
                </Route>

                {/* Short-locale prefixes (e.g. /it, /en, /es) → canonical BCP-47.
                    Keeps inbound links and convenience URLs working without
                    leaking duplicate content; uses HTTP 302-equivalent client
                    Navigate replace so canonical SEO URL is the only crawled one. */}
                <Route path="/it/*" element={<ShortLocaleRedirect to="it-IT" />} />
                <Route path="/en/*" element={<ShortLocaleRedirect to="en-US" />} />
                <Route path="/es/*" element={<ShortLocaleRedirect to="es-ES" />} />
                <Route path="/fr/*" element={<ShortLocaleRedirect to="fr-FR" />} />
                <Route path="/de/*" element={<ShortLocaleRedirect to="de-DE" />} />
                <Route path="/gb/*" element={<ShortLocaleRedirect to="en-GB" />} />

                {/* Auth routes — Blueprint OS theme (admin-style chrome) */}
                <Route path="/auth/login" element={<OSWrap><PublicRoute><LoginPage /></PublicRoute></OSWrap>} />
                <Route path="/auth/signup" element={<OSWrap><PublicRoute><SignupPage /></PublicRoute></OSWrap>} />
                <Route path="/auth/forgot-password" element={<OSWrap><ForgotPasswordPage /></OSWrap>} />
                {/* ITER143D · Auth Redirect Governance™ — single platform callback that bounces to the right tenant subdomain. */}
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
                {/* Legacy / convenience aliases */}
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/invite" element={<AuthCallbackPage />} />
                <Route path="/magic-link" element={<AuthCallbackPage />} />
                <Route path="/form/:slug" element={<LeadFormPage />} />

                <Route element={<ProtectedRoute><StudioRoute><DashboardLayout /></StudioRoute></ProtectedRoute>}>
                  <Route path="/dashboard" element={<AtelierDashboardPage />} />
                  <Route path="/dashboard/pulse" element={<JourneyPulsePage />} />
                  <Route path="/dashboard/legacy" element={<DashboardPage />} />
                  <Route path="/workspace/leads" element={<Navigate to="/crm/accounts" replace />} />
                  <Route path="/workspace/projects" element={<ProjectsPage />} />
                  <Route path="/workspace/projects/:id" element={<ProjectDetailPage />} />
                  {/* Sprint G.6 — Step-Anchored Artifact Pages™.
                      Il workspace dello step. Il contesto precede l'artifact. */}
                  <Route path="/journey/:projectId/step/:milestoneType" element={<StepWorkspacePage />} />
                  <Route path="/workspace/proposals" element={<ProposalsPage />} />
                  <Route path="/workspace/proposals/:id/compose" element={<ProposalComposerPage />} />
                  <Route path="/workspace/references" element={<Navigate to="/inspirations" replace />} />
                  <Route path="/moodboards" element={<MoodboardsPage />} />
                  <Route path="/moodboards/:id" element={<MoodboardEditor />} />
                  <Route path="/library" element={<MediaLibraryPage />} />
                  <Route path="/library/materials" element={<MaterialsPage />} />
                  <Route path="/library/materials/:slug" element={<MaterialDetailPage />} />
                  <Route path="/library/collections" element={<CollectionsHub />} />
                  <Route path="/workspace/calendar" element={<CalendarHub />} />
                  <Route path="/workspace/activity" element={<ActivityHub />} />
                  {/* /workspace/team → operational redirect to /settings/members (real feature). */}
                  <Route path="/workspace/team" element={<Navigate to="/settings/members" replace />} />
                  <Route path="/workspace/clients" element={<Navigate to="/crm/accounts" replace />} />
                  <Route path="/workspace/messages" element={<MessagesHub />} />
                  <Route path="/workspace/reports" element={<ReportsHub />} />
                  <Route path="/settings/integrations" element={<IntegrationsHub />} />
                  <Route path="/inspirations" element={<InspirationsPage />} />
                  <Route path="/inspirations/collections" element={<StudioCollectionsPage />} />
                  <Route path="/inspirations/brands" element={<BrandModePage />} />
                  <Route path="/inspirations/brands/:brandId" element={<BrandDetailPage />} />
                  {/* Sprint UI-SYS-01 · Brand Atlas™ canonical alias */}
                  <Route path="/brand-atlas" element={<Navigate to="/inspirations/brands" replace />} />
                  <Route path="/brand-atlas/:brandId" element={<Navigate to="/inspirations/brands/:brandId" replace />} />
                  <Route path="/inspirations/products/:productId" element={<ProductGalleryPage />} />
                  <Route path="/inspirations/materials" element={<MaterialViewPage />} />
                  <Route path="/insights" element={<InsightsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/settings/atelier-dashboard" element={<StudioAdminRoute><AtelierDashboardAdminPage /></StudioAdminRoute>} />
                  <Route path="/settings/brand" element={<StudioAdminRoute><BrandStudioPage /></StudioAdminRoute>} />
                  {/* Sprint UI-SYS-01 · Studio Identity™ canonical alias */}
                  <Route path="/studio-identity" element={<Navigate to="/settings/brand" replace />} />
                  <Route path="/settings/domains" element={<StudioAdminRoute><DomainsPage /></StudioAdminRoute>} />
                  {/* ITER143E · Tenant Email Branding™ — tenant_admin facing */}
                  <Route path="/settings/email-branding" element={<StudioAdminRoute><EmailBrandingPage /></StudioAdminRoute>} />
                  <Route path="/settings/forms" element={<StudioAdminRoute><FormBuilderPage /></StudioAdminRoute>} />
                  <Route path="/settings/magazine" element={<StudioAdminRoute><MagazineAdminPage /></StudioAdminRoute>} />
                  <Route path="/settings/magazine/:id" element={<StudioAdminRoute><MagazineEditorPage /></StudioAdminRoute>} />
                  <Route path="/settings/plan" element={<StudioAdminRoute><PlanPage /></StudioAdminRoute>} />
                  <Route path="/settings/team" element={<StudioAdminRoute><MembersPage /></StudioAdminRoute>} />
                  <Route path="/settings/members" element={<StudioAdminRoute><MembersPage /></StudioAdminRoute>} />

                  {/* Editorial Review — variant approval inbox (P0.2.D hardening). */}
                  <Route path="/editorial/inbox" element={<StudioAdminRoute><VariantApprovalInboxPage /></StudioAdminRoute>} />

                  {/* Editorial Studio — Composition Room (Phase E-2 Prompt 2). */}
                  <Route path="/blueprint/editorial" element={<StudioAdminRoute><EditorialStudioPage /></StudioAdminRoute>} />
                  <Route path="/blueprint/markets" element={<StudioAdminRoute><MarketMatrixPage /></StudioAdminRoute>} />
                  <Route path="/blueprint/intelligence" element={<StudioAdminRoute><MarketInsightsPage /></StudioAdminRoute>} />
                  <Route path="/blueprint/voice" element={<StudioAdminRoute><BrandVoiceAdaptersPage /></StudioAdminRoute>} />
                  <Route path="/blueprint/studio-voice" element={<StudioAdminRoute><StudioVoicePage /></StudioAdminRoute>} />
                  <Route path="/blueprint/language" element={<StudioAdminRoute><LanguageCommandCenter /></StudioAdminRoute>} />
                  {/* ITER143C · /admin/language → consolidated into /admin/language-governance under RootSuperAdmin shell. */}
                  <Route path="/admin/language" element={<Navigate to="/admin/language-governance" replace />} />
                  <Route path="/admin/language/:tab" element={<Navigate to="/admin/language-governance" replace />} />

                  {/* CRM routes (tab + optional account_id deep-link) */}
                  <Route path="/crm" element={<Navigate to="/crm/accounts" replace />} />
                  <Route path="/crm/accounts/:accountId" element={<AccountDetailPage />} />
                  <Route path="/crm/:tab" element={<CrmAccountsPage />} />
                  <Route path="/crm/:tab/:accountId" element={<CrmAccountsPage />} />
                  {/* Legacy redirect — old /workspace/relationships → /crm/accounts */}
                  <Route path="/workspace/relationships" element={<Navigate to="/crm/accounts" replace />} />

                  {/* Cultural Edition™ — versioni mercato dei contenuti dello studio */}
                  <Route path="/workspace/cultural-editions" element={<CulturalEditionsListPage />} />
                  <Route path="/workspace/cultural-editions/:id" element={<CulturalEditionReviewPage />} />

                  {/* International Presence™ — Phase S-IDENTITY Step 1. */}
                  <Route path="/settings/international-presence" element={<StudioAdminRoute><InternationalPresencePage /></StudioAdminRoute>} />

                  {/* Editorial Calendar™ — International Editorial Operations™ heart */}
                  <Route path="/blueprint/editorial-calendar" element={<StudioAdminRoute><EditorialCalendarPage /></StudioAdminRoute>} />

                  {/* Experience Studio™ — single canonical route.
                      `/blueprint/storefront` and `/settings/storefront`
                      have been DELETED (P0 stabilization: route collapse). */}
                  <Route path="/blueprint/experience" element={<StudioAdminRoute><StorefrontStudioPage /></StudioAdminRoute>} />

                  {/* Forms & Journeys™ — Luxury Lead Architecture (Fase 0). */}
                  <Route path="/blueprint/forms-journeys" element={<StudioAdminRoute><FormBuilderPage /></StudioAdminRoute>} />

                  {/* Projects Studio™ — Phase S-CONNECT Step 3 (Portfolio Cultural Adaptation). */}
                  <Route path="/blueprint/projects-studio" element={<StudioAdminRoute><ProjectsStudioPage /></StudioAdminRoute>} />

                  {/* ── Design Journey™ — placeholder chapters ──
                      Render · Hotspots · Site Evolution · Documents
                      live as editorial coming-soon pages until the
                      respective sprints (F.B / F.C / F.D) ship. */}
                  <Route path="/journey/render"         element={<ComingSoonPage />} />
                  <Route path="/journey/hotspots"       element={<ComingSoonPage />} />
                  <Route path="/journey/site-evolution" element={<ComingSoonPage />} />
                  <Route path="/journey/documents"      element={<ComingSoonPage />} />
                  {/* ── Content Studio · Design Stories ──
                      Storytelling editoriale dei progetti pubblicati. */}
                  <Route path="/content/design-stories" element={<ComingSoonPage />} />
                  {/* ── Curatorial Atlas · Visual Archive · Product Gallery index ── */}
                  <Route path="/inspirations/visual-archive" element={<ComingSoonPage />} />
                  <Route path="/inspirations/products" element={<Navigate to="/inspirations?type=product" replace />} />
                </Route>

                {/* CLIENT PORTAL — Sprint G.7 · Design Journey Companion Experience™.
                    Il cliente entra nel proprio Journey, non in un dashboard.
                    Legacy routes (project / moodboards / timeline / approvals /
                    files) redirezionano alla nuova IA. */}
                <Route element={<ClientRoute><ClientDashboardLayout /></ClientRoute>}>
                  <Route path="/client" element={<ClientJourneysIndexPage />} />
                  <Route path="/client/journey/:journeyId" element={<ClientCompanionPage />} />
                  <Route path="/client/messages" element={<ClientMessagesPage />} />
                  {/* Legacy redirects → tutto torna ai Journey */}
                  <Route path="/client/overview-legacy" element={<ClientOverviewPage />} />
                  <Route path="/client/project" element={<Navigate to="/client" replace />} />
                  <Route path="/client/moodboards" element={<Navigate to="/client" replace />} />
                  <Route path="/client/timeline" element={<Navigate to="/client#evoluzione" replace />} />
                  <Route path="/client/approvals" element={<Navigate to="/client" replace />} />
                  <Route path="/client/files" element={<Navigate to="/client#direzioni" replace />} />
                </Route>

                {/* ADVISOR self-service — standalone surface, gated by API (advisor_profile lookup) */}
                <Route path="/advisor" element={<ProtectedRoute><OSWrap><AdvisorDashboardPage /></OSWrap></ProtectedRoute>} />

                <Route element={<RootSuperAdminRoute><AdminShell /></RootSuperAdminRoute>}>
                  {/* ITER143C · Blueprint Command Center™ — canonical /admin/* freeze */}
                  <Route path="/admin" element={<AdminIndexPage />} />
                  <Route path="/admin/dashboard" element={<DashboardGovernancePage />} />
                  <Route path="/admin/tenants" element={<TenantsGovernancePage />} />
                  <Route path="/admin/tenants/:id" element={<AdminTenantDetailPage />} />
                  <Route path="/admin/users" element={<UsersGovernancePage />} />
                  <Route path="/admin/presets" element={<PresetsGovernancePage />} />
                  <Route path="/admin/editorial-runtime" element={<EditorialRuntimePage />} />
                  <Route path="/admin/email-governance" element={<EmailGovernancePage />} />
                  <Route path="/admin/demo-governance" element={<DemoGovernancePage />} />
                  {/* ITER144 · Tenant Configuration Foundation™ */}
                  <Route path="/admin/tenant-configuration" element={<BlueprintTenantConfigurationPage />} />
                  {/* Language Governance — reuse existing surface within the new shell */}
                  <Route path="/admin/language-governance" element={<LanguageCommandCenter />} />
                  {/* Legacy admin surfaces (Blueprint Collaborator-only) still accessible
                      under their original paths but mounted in the cinematic shell. */}
                  <Route path="/admin/audit" element={<AdminAuditPage />} />
                  <Route path="/admin/modules" element={<AdminModulesPage />} />
                  <Route path="/admin/advisors" element={<AdvisorNetworkAdminPage />} />
                  <Route path="/admin/advisors/:id" element={<AdvisorDetailPage />} />
                </Route>

                {/* ITER143C · Deprecated /superadmin/* aliases → hard redirect to /admin/* */}
                <Route path="/superadmin" element={<Navigate to="/admin" replace />} />
                <Route path="/superadmin/tenants" element={<Navigate to="/admin/tenants" replace />} />
                <Route path="/superadmin/tenants/:id" element={<Navigate to="/admin/tenants" replace />} />
                <Route path="/superadmin/modules" element={<Navigate to="/admin/modules" replace />} />
                <Route path="/superadmin/audit" element={<Navigate to="/admin/audit" replace />} />
                <Route path="/superadmin/languages" element={<Navigate to="/admin/language-governance" replace />} />
                <Route path="/admin/languages" element={<Navigate to="/admin/language-governance" replace />} />

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
          </BlueprintI18nProvider>
          </LocaleRuntimeProvider>
          </StudioPaletteProvider>
          </TenantThemeProvider>
          </TenantConfigurationProvider>
        </BlueprintProvider>
      </AuthProvider>
    </div>
  );
}

export default App;