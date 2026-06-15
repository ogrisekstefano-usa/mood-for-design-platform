import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BlueprintProvider, useBlueprint } from './contexts/BlueprintContext';
import { TenantConfigurationProvider } from './contexts/TenantConfigurationContext';
import { GuidedTourProvider } from './components/onboarding/GuidedTourProvider';
import EditorialOverridesProvider from './i18n/EditorialOverridesProvider';
import { TenantThemeProvider } from './contexts/TenantThemeContext';
import { StudioPaletteProvider } from './contexts/StudioPaletteContext';
import { LocaleRuntimeProvider } from './contexts/LocaleRuntimeContext';
import { BlueprintI18nProvider } from './i18n';
import { NewRelationshipProvider } from './hooks/useNewRelationship';
import { ActivationFoundationProvider } from './hooks/useActivationFoundation';
import PersistentAlertBanner from './components/activation/PersistentAlertBanner';
const IdentityPage = lazy(() => import('./pages/settings/IdentityPage'));
import LocaleRoute from './site/LocaleRoute';
import LocaleHead from './site/LocaleHead';
import CinematicLoader from './components/CinematicLoader';
import { Toaster } from 'sonner';
import './App.css';
import './styles/ui-density.css';
import './components/onboarding/guided-tour.css';
import './components/onboarding/first-moves.css';
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
const AuthRecoveryPage = lazy(() => import('./pages/auth/AuthRecoveryPage'));
const JourneyPreparingPage = lazy(() => import('./pages/journey/JourneyPreparingPage'));
// ITER168 · Atmospheric Panels™ internal QA preview
const AtmosphericPreviewPage = lazy(() => import('./pages/AtmosphericPreviewPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const JourneyPulsePage = lazy(() => import('./pages/dashboard/JourneyPulsePage'));
// STORE-011 · Design Discovery™ Engine
const DiscoverBriefPage = lazy(() => import('./pages/discover-brief/DiscoverBriefPage'));
// STORE-012B · MOODBOARD V2.1 · Working Moodboard
const WorkingMoodboardPage = lazy(() => import('./pages/working-moodboard/WorkingMoodboardPage'));
const StudioPulsePage = lazy(() => import('./pages/studio/StudioPulsePage'));
const AtelierDashboardPage = lazy(() => import('./pages/dashboard/AtelierDashboardPage'));
const WorkspacePreparePage = lazy(() => import('./pages/workspace/WorkspacePreparePage'));
const MaterialBoardsListPage = lazy(() => import('./pages/material-boards/MaterialBoardsListPage'));
const MaterialBoardWorkspace = lazy(() => import('./pages/material-boards/MaterialBoardWorkspace'));
const SpecificationsListPage = lazy(() => import('./pages/specifications/SpecificationPages').then(m => ({ default: m.SpecificationsListPage })));
const SpecificationWorkspace = lazy(() => import('./pages/specifications/SpecificationPages').then(m => ({ default: m.SpecificationWorkspace })));
const ProjectStoriesListPage = lazy(() => import('./pages/project-stories/ProjectStoryPages').then(m => ({ default: m.ProjectStoriesListPage })));
const ProjectStoryViewer = lazy(() => import('./pages/project-stories/ProjectStoryPages').then(m => ({ default: m.ProjectStoryViewer })));
const PublicProjectStoryViewer = lazy(() => import('./pages/project-stories/ProjectStoryPages').then(m => ({ default: m.PublicProjectStoryViewer })));
const LeadsLegacyPage = lazy(() => import('./pages/workspace/LeadsPage'));
const ProjectsPage = lazy(() => import('./pages/workspace/ProjectsPage'));
const DesignerConversationsPage = lazy(() => import('./pages/workspace/DesignerConversationsPage'));
const ProjectDetailPage = lazy(() => import('./pages/workspace/ProjectDetailPage'));
const ProposalsPage = lazy(() => import('./pages/workspace/ProposalsPage'));
const ProposalComposerPage = lazy(() => import('./pages/workspace/ProposalComposerPage'));
const ReferencesPage = lazy(() => import('./pages/workspace/ReferencesPage'));
const VariantApprovalInboxPage = lazy(() => import('./pages/editorial/VariantApprovalInboxPage'));
const EditorialStudioPage = lazy(() => import('./pages/editorial/EditorialStudioPage'));
// STORE-008A · Editorial Autopilot™ MVP (Jun 2026)
const EditorialAutopilotPage  = lazy(() => import('./pages/editorial-autopilot/EditorialAutopilotPage'));
const ProofreadingInboxPage   = lazy(() => import('./pages/editorial-autopilot/ProofreadingInboxPage'));
const MarketMatrixPage = lazy(() => import('./pages/governance/MarketMatrixPage'));
const MarketInsightsPage = lazy(() => import('./pages/governance/MarketInsightsPage'));
const BrandVoiceAdaptersPage = lazy(() => import('./pages/governance/BrandVoiceAdaptersPage'));
const StudioVoicePage = lazy(() => import('./pages/blueprint/StudioVoicePage'));
const LanguageCommandCenter = lazy(() => import('./pages/blueprint/LanguageCommandCenter'));
const EditorialCopyCmsPage = lazy(() => import('./pages/admin/EditorialCopyCmsPage'));
const CrmAccountsPage = lazy(() => import('./pages/crm/CrmAccountsPage'));
const AccountDetailPage = lazy(() => import('./pages/crm/AccountDetailPage'));
const CulturalEditionsListPage = lazy(() => import('./pages/cultural/CulturalEditionsListPage'));
const CulturalEditionReviewPage = lazy(() => import('./pages/cultural/CulturalEditionReviewPage'));
const InternationalPresencePage = lazy(() => import('./pages/settings/InternationalPresencePage'));
const StorefrontStudioPage = lazy(() => import('./pages/storefront/StorefrontStudioPage'));
const PagesAdminPage = lazy(() => import('./pages/storefront/PagesAdminPage'));
const ClientProfileAdminPage = lazy(() => import('./pages/storefront/ClientProfileAdminPage'));
const EditorialCalendarPage = lazy(() => import('./pages/editorial/EditorialCalendarPage'));
const ProjectsStudioPage = lazy(() => import('./pages/projects/ProjectsStudioPage'));
const MoodboardsPage = lazy(() => import('./pages/moodboards/MoodboardsPage'));
const InspirationsPage = lazy(() => import('./pages/inspirations/InspirationsPage'));
const StudioCollectionsPage = lazy(() => import('./pages/inspirations/StudioCollectionsPage'));
const BrandModePage = lazy(() => import('./pages/inspirations/BrandModePage'));
const BrandAtlas2Page = lazy(() => import('./pages/inspirations/BrandAtlas2Page'));
const StudioLibraryPage = lazy(() => import('./pages/inspirations/StudioLibraryPage'));
// ITER204-B · Entity Navigation Layer™ — detail pages
const CollectionDetailPage = lazy(() => import('./pages/inspirations/CollectionDetailPage'));
const ProductDetailPage    = lazy(() => import('./pages/inspirations/ProductDetailPage'));
const MaterialDetailPage2  = lazy(() => import('./pages/inspirations/MaterialDetailPage'));
const DesignerDetailPage   = lazy(() => import('./pages/inspirations/DesignerDetailPage'));
const BrandDetailPage = lazy(() => import('./pages/inspirations/BrandDetailPage'));
const BrandEmbassyPage = lazy(() => import('./pages/inspirations/BrandEmbassyPage'));
const ProductGalleryPage = lazy(() => import('./pages/inspirations/ProductGalleryPage'));
const MaterialViewPage = lazy(() => import('./pages/inspirations/MaterialViewPage'));
const KnowledgeEnginePage = lazy(() => import('./pages/inspirations/KnowledgeEnginePage'));
const CatalogSetWorkspacePage = lazy(() => import('./pages/inspirations/CatalogSetWorkspacePage'));
const ClientPreviewPage = lazy(() => import('./pages/ClientPreviewPage'));
const InsightsPage = lazy(() => import('./pages/insights/InsightsPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const AtelierDashboardAdminPage = lazy(() => import('./pages/settings/AtelierDashboardAdminPage'));
const BrandStudioPage = lazy(() => import('./pages/settings/BrandStudioPage'));
const DomainsPage = lazy(() => import('./pages/settings/DomainsPage'));
// ITER143E · Tenant Email Branding™
const EmailBrandingPage = lazy(() => import('./pages/EmailBrandingPage'));
// ITER157.A · HomepageBuilderPage deprecated — consolidated into Storefront CMS.
// Import retained for the legacy redirect-card route. Will be removed in Sprint B.3.
const HomepageBuilderPage = lazy(() => import('./pages/settings/HomepageBuilderPage'));
const NavigationEditorPage = lazy(() => import('./pages/settings/NavigationEditorPage'));
const FormBuilderPage = lazy(() => import('./pages/settings/FormBuilderPage'));
const PublicTenantPage = lazy(() => import('./pages/public/PublicTenantPage'));
const PublicFormPage = lazy(() => import('./pages/public/PublicFormPage'));
const LeadFormPage = lazy(() => import('./pages/public/LeadFormPage'));
const MoodboardEditor = lazy(() => import('./pages/moodboards/MoodboardEditor'));
const PublicPresentation = lazy(() => import('./pages/moodboards/PublicPresentation'));
const ReviewMode = lazy(() => import('./pages/collab/ReviewMode'));
const AuthClientCallback = lazy(() => import('./pages/auth/AuthClientCallback'));
import AccessEntryPage from './pages/auth/AccessEntryPage';
const StepWorkspacePage = lazy(() => import('./pages/journey/StepWorkspacePage'));
const ComingSoonPage = lazy(() => import('./pages/placeholder/ComingSoonPage'));

// ITER168 · Phase 2 · canonical journey-keyed routes + silent legacy redirects
import {
  StudioJourneyView, StudioJourneyStepView, CanonicalClientJourney,
  ProjectToJourneyRedirect, LegacyStepRedirect,
} from './routes/JourneyCanonicalRoutes';

// Site (public marketing) — global brand surface
const SiteLayout = lazy(() => import('./site/SiteLayout'));
const HomePage = lazy(() => import('./pages/site/HomePage'));
const ProjectsIndexPage = lazy(() => import('./pages/site/ProjectsIndexPage'));
const SiteProjectDetailPage = lazy(() => import('./pages/site/ProjectDetailPage'));
const OnboardingPlaceholderPage = lazy(() => import('./pages/site/OnboardingPlaceholderPage'));
const StartProjectWizard = lazy(() => import('./pages/site/StartProjectWizard'));
const BeginJourneyPage   = lazy(() => import('./pages/site/BeginJourneyPage'));
const BeginPartnershipPage = lazy(() => import('./pages/site/BeginPartnershipPage'));
const JourneyWelcomePage = lazy(() => import('./pages/site/JourneyWelcomePage'));
import MagazinePage from './pages/site/MagazinePage';
import MagazineArticlePage from './pages/site/MagazineArticlePage';
const MagazineAdminPage = lazy(() => import('./pages/settings/MagazineAdminPage'));
const MagazineEditorPage = lazy(() => import('./pages/settings/MagazineEditorPage'));
const ProfessionalsGatewayPage = lazy(() => import('./pages/site/ProfessionalsGatewayPage'));
const ProfessionalIntakePage = lazy(() => import('./pages/site/ProfessionalIntakePage'));
const AboutPage = lazy(() => import('./pages/site/AboutPage'));
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
// STORE-012C · Client Portal Concept Review
const ClientConceptReviewPage = lazy(() => import('./pages/client/ClientConceptReviewPage'));
const ClientWelcomePresetPage = lazy(() => import('./pages/client/ClientWelcomePresetPage'));
const BriefGuidedPage = lazy(() => import('./pages/client/BriefGuidedPage'));  // ITER172 · Client Design Journey™ V1
// ITER172 · FROZEN — Gen 2 narrative companion. Source preserved; route disabled.
// To restore: uncomment the lazy import below + the corresponding <Route> mounts.
// const ClientCompanionPage = lazy(() => import('./pages/client/ClientCompanionPage'));
// ITER172 · FROZEN — Gen 1 overview. Source preserved; /client/overview-legacy disabled.
// const ClientOverviewPage = lazy(() => import('./pages/client/ClientOverviewPage'));
// ITER172 · FROZEN — Legacy client stub pages. Source preserved.
// import { ClientProjectPage, ClientMoodboardsPage, ClientTimelinePage,
//          ClientApprovalsPage, ClientFilesPage } from './pages/client/ClientStubPages';

// ITER172 · Silent redirect from legacy /client/journey/:jid → canonical /journey/:jid
const RedirectClientJourneyToCanonical = () => {
  const { journeyId } = useParams();
  return <Navigate to={`/journey/${journeyId}`} replace />;
};

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
// ITER173 · P1 · Email Identity + Email Templates
const EmailIdentityPage = lazy(() => import('./pages/admin/EmailIdentityPage'));
const EmailTemplatesPage = lazy(() => import('./pages/admin/EmailTemplatesPage'));
// ITER172 · Advisor Network™ FROZEN — pages NOT imported at runtime.
// Source preserved in /pages/admin/Advisor*.jsx and /pages/advisor/AdvisorDashboardPage.jsx.
// To restore: uncomment the three lazy imports below.
// const AdvisorNetworkAdminPage = lazy(() => import('./pages/admin/AdvisorNetworkAdminPage'));
// const AdvisorDetailPage = lazy(() => import('./pages/admin/AdvisorDetailPage'));
// const AdvisorDashboardPage = lazy(() => import('./pages/advisor/AdvisorDashboardPage'));

// ITER143C · Blueprint Command Center™ — cinematic admin shell + 8 pages.
const AdminShell = lazy(() => import('./pages/admin/AdminShell'));
import {
  AdminIndexPage, DashboardGovernancePage, TenantsGovernancePage,
  UsersGovernancePage, PresetsGovernancePage, EditorialRuntimePage,
  EmailGovernancePage, DemoGovernancePage,
} from './pages/admin/BlueprintGovernancePages';
// ITER144 · Tenant Configuration Foundation™ — runtime governance.
const BlueprintTenantConfigurationPage = lazy(() => import('./pages/admin/BlueprintTenantConfigurationPage'));
const RuntimeInspectorPage = lazy(() => import('./pages/admin/RuntimeInspectorPage'));
// ITER144.1 · Runtime Route Governance™ — global ModuleRouteGuard.
import ModuleRouteGuard from './components/runtime/ModuleRouteGuard';

// ITER148 · Phase 2 · Media System Unificato™ preview
const MediaSystemPreviewPage = lazy(() => import('./pages/admin/MediaSystemPreviewPage'));

// ITER148 · P0 · Client Relations™ — editorial Lead/Prospect/Account layer
const LeadsPage                = lazy(() => import('./pages/relations/LeadsPage'));
const LeadDetailPage           = lazy(() => import('./pages/relations/LeadDetailPage'));
const ProspectsPage            = lazy(() => import('./pages/relations/ProspectsPage'));
const AccountsPage             = lazy(() => import('./pages/relations/AccountsPage'));
const RelationshipMemoryPage   = lazy(() => import('./pages/relations/RelationshipMemoryPage'));
// ITER148 · Sprint B · Relationship Memory™ editorial timeline (detail view).
const RelationshipMemoryTimeline = lazy(() => import('./pages/relations/RelationshipMemoryTimeline'));

// ITER187.B · Journey Mail Workspace™ — Communications · Mail
const MailWorkspaceLayout = lazy(() => import('./pages/communications/mail/MailWorkspaceLayout'));
const MailboxesPage       = lazy(() => import('./pages/communications/mail/MailboxesPage'));
const MailMessagesListPage = lazy(() => import('./pages/communications/mail/MessagesListPage'));
const MailMessageDetailPage = lazy(() => import('./pages/communications/mail/MessageDetailPage'));
const MailComposePage     = lazy(() => import('./pages/communications/mail/ComposePage'));

/** Wrap a route element with a runtime module guard.
 *  When the module is disabled/locked/hidden, the route renders the
 *  Cinematic Blocked State™ instead of mounting the page.
 */
const G = (code, el) => <ModuleRouteGuard code={code}>{el}</ModuleRouteGuard>;

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
  const role = (user.role || '').toLowerCase();
  // STORE-012C · allow tenant_admin / super_admin to QA the client portal
  // (matches the backend _require_client bypass policy).
  if (role !== 'client' && role !== 'tenant_admin' && role !== 'super_admin') {
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
import EditorialDebugOverlay from './i18n/EditorialDebugOverlay';
import useUiDensity from './hooks/useUiDensity';

/** Mount the UI density hook once globally — applies data attribute + hydrates from server. */
const UiDensityBoot = () => {
  useUiDensity();
  return null;
};

/**
 * ITER171.2 · MagicLinkHashGuard — defensive hash-token interceptor.
 *
 * In production, if the Supabase Redirect URLs whitelist does not include
 * `https://blueprint.moodfordesign.com/auth/client/callback`, Supabase
 * silently falls back to the bare Site URL (the homepage `/`). The magic
 * link tokens then land on the homepage in `window.location.hash` and the
 * SPA never installs them.
 *
 * This guard runs once on app mount: if the URL hash contains
 * `access_token=` AND we are NOT already on the dedicated client callback
 * route, we rewrite the location to `/auth/client/callback#<hash>` so the
 * AuthClientCallback page can exchange the tokens. The hash is preserved
 * intentionally so Supabase parsing logic continues to work.
 */
const MagicLinkHashGuard = () => {
  const navigate = useNavigate();
  useEffect(() => {
    try {
      // Read the hash snapshot captured by index.html BEFORE React mounted.
      // Falls back to live window.location.hash if the snapshot is missing.
      const rawHash = (window.__MFD_INITIAL_HASH || window.location.hash || '').replace(/^#/, '');
      const rawSearch = (window.__MFD_INITIAL_SEARCH || window.location.search || '');
      if (!rawHash) return;
      const params = new URLSearchParams(rawHash);
      const hasAccessToken = !!params.get('access_token');
      const hasError       = !!(params.get('error') || params.get('error_code'));
      const onCallback = window.location.pathname.startsWith('/auth/client/callback')
                      || window.location.pathname.startsWith('/auth/callback');
      if ((hasAccessToken || hasError) && !onCallback) {
        // Restore the hash on the live URL too (some pre-mount code stripped it),
        // then navigate so AuthClientCallback can parse window.location.hash.
        const liveHash = '#' + rawHash;
        if (window.location.hash !== liveHash) {
          try {
            window.history.replaceState(window.history.state,
                                        document.title,
                                        window.location.pathname + rawSearch + liveHash);
          } catch (_) { /* noop */ }
        }
        const target = '/auth/client/callback' + rawSearch + liveHash;
        navigate(target, { replace: true });
      }
    } catch (_) { /* noop — defensive only */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

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
          <EditorialOverridesProvider>
          <BrowserRouter>
            <UiDensityBoot />
            <MagicLinkHashGuard />
            <GovernanceOverlay />
            <LocalizationOverlay />
            <EditorialDebugOverlay />
            <GuidedTourProvider>
            <ActivationFoundationProvider>
            <NewRelationshipProvider>
            <PersistentAlertBanner />
            <Suspense fallback={<Loading />}>
              <LocaleHead />
              <Routes>
                {/* ═══════════════════════════════════════════════════════════
                 *  PUBLIC EXPERIENCE — Design Journey™ public narrative layer
                 *  -----------------------------------------------------------
                 *  Nessuna auth-guard. Nessun redirect tecnico.
                 *  Queste rotte fanno parte dell'esperienza narrativa, NON
                 *  dell'applicazione. Mai mostrare "Login required",
                 *  "Session expired", o terminologia software.
                 *
                 *  Surfaces incluse:
                 *    · Landing (HomePage)
                 *    · Begin Journey / Begin Partnership / Start Project
                 *    · Journey · Preparing Screen (post-onboarding cinematic)
                 *    · Auth Callback / Recovery / Reset / Magic-Link bridge
                 *    · Password Creation
                 *    · "Entra nel tuo spazio" (LoginPage)
                 *    · Magazine / Projects / Professionals
                 *    · Client Preview Link™ (presentation surfaces)
                 *    · Public Tenant Pages / Public Forms
                 * ═══════════════════════════════════════════════════════════ */}

                {/* Client Preview Link™ — public, no auth, no layout.
                    Sprint F2.4: presentazione cliente fullscreen cinematic. */}
                <Route path="/preview/:token" element={<ClientPreviewPage />} />

                {/* HomePage — public marketing root, uses ITS OWN header/footer
                    (ITER150 Public Editorial Experience™). Not wrapped in
                    SiteLayout so it doesn't double-render SiteHeader/SiteFooter. */}
                <Route path="/" element={<HomePage />} />

                {/* SITE (public marketing) — global brand surface.
                    Magazine + Start Project + Begin Journey now share the same SiteLayout
                    (P0 stabilization: ONE renderer, ONE runtime, ONE source of truth). */}
                <Route element={<SiteLayout />}>
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/projects" element={<ProjectsIndexPage />} />
                  <Route path="/projects/:slug" element={<SiteProjectDetailPage />} />
                  <Route path="/magazine" element={<MagazinePage />} />
                  <Route path="/magazine/:slug" element={<MagazineArticlePage />} />
                  <Route path="/start-project" element={<StartProjectWizard />} />
                  <Route path="/begin-partnership" element={<BeginPartnershipPage />} />
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

                {/* ── Public auth surfaces (concierge UX, NOT app UX) ──
                    These pages are part of the public narrative experience.
                    The Design Journey™ enters and exits through here.
                    ITER166 · Nessuna terminologia tecnica. */}

                {/* "Entra nel tuo spazio" — la nostra alternativa narrativa al login */}
                <Route path="/auth/login" element={<OSWrap><PublicRoute><LoginPage /></PublicRoute></OSWrap>} />
                <Route path="/auth/signup" element={<OSWrap><PublicRoute><SignupPage /></PublicRoute></OSWrap>} />
                <Route path="/auth/forgot-password" element={<OSWrap><ForgotPasswordPage /></OSWrap>} />
                {/* ITER143D · Auth Redirect Governance™ — single platform callback that bounces to the right tenant subdomain. */}
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                {/* ITER169 · ISOLATED client magic-link callback. Lives
                    OUTSIDE ClientRoute/ProtectedRoute by design to avoid
                    the auth-hydration redirect race against homepage. */}
                <Route path="/auth/client/callback" element={<AuthClientCallback />} />
                <Route path="/auth/client/access"   element={<AuthClientCallback />} />
                {/* ITER169.2 · Unified Entry UX™ — single elegant access surface
                    that silently dispatches to client magic-link or pro password. */}
                <Route path="/access"               element={<AccessEntryPage />} />
                <Route path="/journey/access"       element={<AccessEntryPage />} />
                {/* Password Creation — soft invitation, NOT modal aggressiva */}
                <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
                {/* AuthRecoveryPage — magic link expired → esperienza concierge, mai errore software */}
                <Route path="/auth/recovery" element={<AuthRecoveryPage />} />
                {/* JourneyPreparingPage — transitional, emozionale, narrativa.
                    NON applicativa. NIENTE useAuth(). NIENTE redirect.
                    Vive INTENZIONALMENTE fuori da ogni layer protetto. */}
                <Route path="/journey/preparing" element={<JourneyPreparingPage />} />

                {/* ITER168 · Atmospheric Panels™ internal QA preview
                    (no auth — under /dev/* so it never leaks into the
                    client narrative path). */}
                <Route
                  path="/dev/atmospheric-preview"
                  element={<AtmosphericPreviewPage />}
                />
                {/* Legacy / convenience aliases */}
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/invite" element={<AuthCallbackPage />} />
                <Route path="/magic-link" element={<AuthCallbackPage />} />
                <Route path="/form/:slug" element={<LeadFormPage />} />

                {/* ═══════════════════════════════════════════════════════════
                 *  PROTECTED EXPERIENCE — Relationship Operating System™
                 *  -----------------------------------------------------------
                 *  Da qui in poi: utente autenticato. Auth-guard attivi.
                 *
                 *  Surfaces:
                 *    · Client Profile™ (private client area)
                 *    · Studio Workspace (designer / tenant_admin)
                 *    · Blueprint Command Center (root super admin)
                 *    · Advisor self-service
                 * ═══════════════════════════════════════════════════════════ */}

                <Route element={<ProtectedRoute><StudioRoute><DashboardLayout /></StudioRoute></ProtectedRoute>}>
                  <Route path="/dashboard" element={G('dashboard', <AtelierDashboardPage />)} />
                  {/* STORE-001 · Design Journey shortcut (active journeys list) */}
                  <Route path="/journeys" element={G('journey_index', <JourneyPulsePage />)} />
                  <Route path="/dashboard/pulse" element={<Navigate to="/studio/pulse" replace />} />
                  <Route
                    path="/studio/pulse"
                    element={<StudioAdminRoute><StudioPulsePage /></StudioAdminRoute>}
                  />
                  {/* Legacy alias kept silent — old code may still link here */}
                  <Route
                    path="/studio-pulse"
                    element={<Navigate to="/studio/pulse" replace />}
                  />
                  <Route path="/dashboard/legacy" element={<DashboardPage />} />
                  <Route path="/workspace/leads" element={<Navigate to="/crm/accounts" replace />} />
                  <Route path="/workspace/projects" element={G('journey_index', <ProjectsPage />)} />
                  <Route path="/workspace/conversations" element={G('journey_index', <DesignerConversationsPage />)} />
                  {/* ITER168 · Phase 2 · journey-keyed canonical (NEW) */}
                  <Route path="/studio/journey/:jid" element={G('journey_index', <StudioJourneyView />)} />
                  <Route path="/studio/journey/:jid/step/:milestoneType" element={G('journey_index', <StudioJourneyStepView />)} />
                  {/* STORE-011 · Design Discovery™ Engine */}
                  <Route path="/studio/journey/:jid/discover" element={G('journey_index', <DiscoverBriefPage />)} />
                  {/* STORE-012B · MOODBOARD V2.1 · Working Moodboard */}
                  <Route path="/studio/moodboards/working/:id" element={G('inspirations', <WorkingMoodboardPage />)} />
                  {/* ITER168 · Phase 2 · silent legacy redirects (project_id → jid) */}
                  <Route path="/workspace/projects/:id" element={G('journey_index', <ProjectToJourneyRedirect />)} />
                  <Route path="/journey/:projectId/step/:milestoneType" element={G('journey_index', <LegacyStepRedirect />)} />
                  <Route path="/workspace/proposals" element={G('journey_index', <ProposalsPage />)} />
                  <Route path="/workspace/proposals/:id/compose" element={G('journey_index', <ProposalComposerPage />)} />
                  {/* Editorial Dashboard · Prepare workspace wizard (KE-006/007 onboarding) */}
                  <Route path="/workspace/material-boards/new" element={<WorkspacePreparePage />} />
                  <Route path="/workspace/presentations/new" element={<WorkspacePreparePage />} />
                  {/* STORE-002 · Material Board Studio™ (real surface) */}
                  <Route path="/material-boards" element={<MaterialBoardsListPage />} />
                  <Route path="/material-boards/:id" element={<MaterialBoardWorkspace />} />
                  {/* STORE-003 · Specification Package™ */}
                  <Route path="/specifications" element={<SpecificationsListPage />} />
                  <Route path="/specifications/:id" element={<SpecificationWorkspace />} />
                  {/* STORE-004 · Project Story™ */}
                  <Route path="/project-stories" element={<ProjectStoriesListPage />} />
                  <Route path="/project-stories/:id" element={<ProjectStoryViewer />} />
                  <Route path="/workspace/references" element={<Navigate to="/inspirations" replace />} />
                  <Route path="/moodboards" element={G('inspirations', <MoodboardsPage />)} />
                  <Route path="/moodboards/:id" element={G('inspirations', <MoodboardEditor />)} />
                  <Route path="/library" element={G('media_library', <MediaLibraryPage />)} />
                  <Route path="/library/materials" element={G('material_view', <MaterialsPage />)} />
                  <Route path="/library/materials/:slug" element={G('material_view', <MaterialDetailPage />)} />
                  <Route path="/library/collections" element={G('media_library', <CollectionsHub />)} />
                  <Route path="/workspace/calendar" element={<CalendarHub />} />
                  <Route path="/workspace/activity" element={<ActivityHub />} />
                  {/* /workspace/team → operational redirect to /settings/members (real feature). */}
                  <Route path="/workspace/team" element={<Navigate to="/settings/members" replace />} />
                  <Route path="/workspace/clients" element={<Navigate to="/crm/accounts" replace />} />
                  <Route path="/workspace/messages" element={<MessagesHub />} />
                  <Route path="/workspace/reports" element={<ReportsHub />} />
                  <Route path="/settings/integrations" element={G('integrations', <IntegrationsHub />)} />
                  <Route path="/inspirations" element={G('inspirations', <InspirationsPage />)} />
                  {/* ITER204 · Studio Library Bridge™ — permanent curatorial heritage */}
                  <Route path="/studio-library" element={G('studio_library', <StudioLibraryPage />)} />
                  <Route path="/inspirations/collections" element={G('inspirations', <StudioCollectionsPage />)} />
                  <Route path="/inspirations/brands" element={G('brand_atlas', <BrandAtlas2Page />)} />
                  <Route path="/inspirations/brands/legacy" element={G('brand_atlas', <BrandModePage />)} />
                  <Route path="/inspirations/brands/:brandId" element={G('brand_atlas', <BrandEmbassyPage />)} />
                  <Route path="/inspirations/brands/:brandId/admin" element={G('brand_atlas', <BrandDetailPage />)} />
                  {/* ITER204-B · Entity Navigation Layer™ — detail pages */}
                  <Route path="/inspirations/brands/:brandId/collections/:collectionId"
                          element={G('brand_atlas', <CollectionDetailPage />)} />
                  <Route path="/inspirations/brands/:brandId/products/:productId"
                          element={G('brand_atlas', <ProductDetailPage />)} />
                  <Route path="/inspirations/materials/:materialId"
                          element={G('material_view', <MaterialDetailPage2 />)} />
                  <Route path="/inspirations/designers/:designerId"
                          element={G('brand_atlas', <DesignerDetailPage />)} />
                  {/* Sprint UI-SYS-01 · Brand Atlas™ canonical alias */}
                  <Route path="/brand-atlas" element={<Navigate to="/inspirations/brands" replace />} />
                  <Route path="/brand-atlas/:brandId" element={<Navigate to="/inspirations/brands/:brandId" replace />} />
                  <Route path="/inspirations/products/:productId" element={G('inspirations', <ProductGalleryPage />)} />
                  <Route path="/inspirations/materials" element={G('material_view', <MaterialViewPage />)} />
                  {/* ITER195 · Multi-PDF Brand Catalog Ingestion Workspace */}
                  <Route path="/inspirations/knowledge-engine" element={G('inspirations', <KnowledgeEnginePage />)} />
                  <Route path="/inspirations/knowledge-engine/catalog-sets/:setId" element={G('inspirations', <CatalogSetWorkspacePage />)} />
                  <Route path="/insights" element={G('insights', <InsightsPage />)} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/settings/identity" element={<StudioAdminRoute><IdentityPage /></StudioAdminRoute>} />
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
                  <Route path="/settings/languages" element={<SuperAdminRoute><LanguagesPage /></SuperAdminRoute>} />

                  {/* Editorial Review — variant approval inbox (P0.2.D hardening). */}
                  <Route path="/editorial/inbox" element={<StudioAdminRoute><VariantApprovalInboxPage /></StudioAdminRoute>} />

                  {/* Editorial Studio — Composition Room (Phase E-2 Prompt 2). */}
                  <Route path="/blueprint/editorial" element={<StudioAdminRoute>{G('magazine', <EditorialAutopilotPage />)}</StudioAdminRoute>} />
                  <Route path="/blueprint/editorial/inbox" element={<StudioAdminRoute>{G('magazine', <ProofreadingInboxPage />)}</StudioAdminRoute>} />
                  <Route path="/blueprint/editorial/legacy" element={<StudioAdminRoute>{G('magazine', <EditorialStudioPage />)}</StudioAdminRoute>} />
                  <Route path="/blueprint/markets" element={<StudioAdminRoute>{G('market_matrix', <MarketMatrixPage />)}</StudioAdminRoute>} />
                  <Route path="/blueprint/intelligence" element={<StudioAdminRoute><MarketInsightsPage /></StudioAdminRoute>} />
                  <Route path="/blueprint/voice" element={<StudioAdminRoute><BrandVoiceAdaptersPage /></StudioAdminRoute>} />
                  <Route path="/blueprint/studio-voice" element={<StudioAdminRoute>{G('studio_voice', <StudioVoicePage />)}</StudioAdminRoute>} />
                  <Route path="/blueprint/language" element={<StudioAdminRoute><LanguageCommandCenter /></StudioAdminRoute>} />
                  {/* ITER155 · Editorial Copy CMS · Surface Governance System™ */}
                  <Route path="/admin/editorial-copy" element={<StudioAdminRoute><EditorialCopyCmsPage /></StudioAdminRoute>} />
                  {/* ITER143C · /admin/language → consolidated into /admin/language-governance under RootSuperAdmin shell. */}
                  <Route path="/admin/language" element={<Navigate to="/admin/language-governance" replace />} />
                  <Route path="/admin/language/:tab" element={<Navigate to="/admin/language-governance" replace />} />

                  {/* CRM routes (tab + optional account_id deep-link) */}
                  <Route path="/crm" element={<Navigate to="/crm/accounts" replace />} />
                  <Route path="/crm/accounts/:accountId" element={G('crm_accounts', <AccountDetailPage />)} />
                  <Route path="/crm/:tab" element={G('crm_accounts', <CrmAccountsPage />)} />
                  <Route path="/crm/:tab/:accountId" element={G('crm_accounts', <CrmAccountsPage />)} />
                  {/* Legacy redirect — old /workspace/relationships → /relations/accounts */}
                  <Route path="/workspace/relationships" element={<Navigate to="/relations/accounts" replace />} />
                  <Route path="/crm/accounts" element={<Navigate to="/relations/accounts" replace />} />
                  <Route path="/crm/inbox"    element={<Navigate to="/relations/leads"    replace />} />

                  {/* ── CLIENT RELATIONS\u2122 (ITER148 · P0 sidebar) ── */}
                  <Route path="/relations/leads"      element={<LeadsPage />} />
                  <Route path="/relations/leads/:leadId" element={<LeadDetailPage />} />
                  <Route path="/relations/prospects"  element={<ProspectsPage />} />
                  <Route path="/relations/accounts"   element={<AccountsPage />} />
                  <Route path="/relations/memory"     element={<RelationshipMemoryPage />} />
                  <Route path="/relations/memory/:subjectId" element={<RelationshipMemoryTimeline />} />
                  <Route path="/admin/media-system-preview" element={<MediaSystemPreviewPage />} />
                  <Route path="/relations/voice-log"  element={<Navigate to="/relations/memory" replace />} />

                  {/* Cultural Edition™ — versioni mercato dei contenuti dello studio */}
                  <Route path="/workspace/cultural-editions" element={<CulturalEditionsListPage />} />
                  <Route path="/workspace/cultural-editions/:id" element={<CulturalEditionReviewPage />} />

                  {/* International Presence™ — Phase S-IDENTITY Step 1. */}
                  <Route path="/settings/international-presence" element={<StudioAdminRoute><InternationalPresencePage /></StudioAdminRoute>} />

                  {/* Editorial Calendar™ — International Editorial Operations™ heart */}
                  <Route path="/blueprint/editorial-calendar" element={<StudioAdminRoute><EditorialCalendarPage /></StudioAdminRoute>} />

                  {/* Experience Studio™ — single canonical route.
                      `/blueprint/storefront` and `/settings/storefront`
                      have been DELETED (P0 stabilization: route collapse).
                      ITER157.E: new field-as-card UX moved OUTSIDE the
                      DashboardLayout (full-screen Command Center). */}
                  <Route path="/blueprint/experience/legacy" element={<StudioAdminRoute><StorefrontStudioPage /></StudioAdminRoute>} />

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

                  {/* ── ITER187.B · Journey Mail Workspace™ ──
                      Communications · Mail — Email Intelligence Layer, NOT
                      an email client. Read-only IMAP + manual entity links. */}
                  <Route path="/communications/mail" element={<MailWorkspaceLayout />}>
                    <Route index element={<Navigate to="/communications/mail/mailboxes" replace />} />
                    <Route path="mailboxes" element={<MailboxesPage />} />
                    <Route path="messages" element={<MailMessagesListPage />} />
                    <Route path="messages/:messageId" element={<MailMessageDetailPage />} />
                    <Route path="compose" element={<MailComposePage />} />
                  </Route>
                </Route>

                {/* CLIENT PORTAL — Sprint G.7 · Design Journey Companion Experience™.
                    Il cliente entra nel proprio Journey, non in un dashboard.
                    Legacy routes (project / moodboards / timeline / approvals /
                    files) redirezionano alla nuova IA. */}
                {/* ITER168 · Phase 2 · CLIENT canonical (NEW)
                    /journey/:journeyId  → Client Profile (Companion experience).
                    Vive direttamente sotto ClientRoute, NO ClientDashboardLayout
                    wrapper perché Companion porta la propria chrome editoriale.
                    Legacy /client/journey/:journeyId resta come alias. */}
                {/* ITER172 · Client Design Journey™ V1 (Atelier promoted to canonical).
                    /journey/:journeyId → Welcome Workspace V1
                    /journey/:journeyId/brief → Brief Guidato™ dedicated page (D4 approved). */}
                <Route path="/journey/:journeyId" element={
                  <ClientRoute>
                    <CanonicalClientJourney />
                  </ClientRoute>
                } />
                <Route path="/journey/:jid/brief" element={
                  <ClientRoute>
                    <BriefGuidedPage />
                  </ClientRoute>
                } />
                {/* STORE-012C · Client Concept Direction Review™ — canonical path
                    (mirrors /client/journey/:jid/concepts for backwards compat)
                    Linked from: AtelierActionPanel, concept share email, in-app notification deep_link */}
                <Route path="/journey/:jid/concepts" element={
                  <ClientRoute>
                    <ClientConceptReviewPage />
                  </ClientRoute>
                } />

                {/* ITER162 · Welcome Panel Atelier™ — full-bleed preset surface.
                    Vive FUORI da ClientDashboardLayout perché porta una sua
                    sidebar narrativa e gestisce il proprio chrome.
                    `/client` ora redireziona qui: l'Atelier È la home. */}
                <Route path="/client/welcome" element={
                  <ClientRoute>
                    <ClientWelcomePresetPage />
                  </ClientRoute>
                } />
                <Route element={<ClientRoute><ClientDashboardLayout /></ClientRoute>}>
                  <Route path="/client" element={<Navigate to="/client/welcome" replace />} />
                  <Route path="/client/journeys" element={<ClientJourneysIndexPage />} />
                  {/* STORE-012C · Client Portal Concept Review */}
                  <Route path="/client/journey/:jid/concepts" element={<ClientConceptReviewPage />} />
                  {/* ITER172 · Gen 2 narrative companion FROZEN — redirect to canonical V1.
                      <Route path="/client/journey/:journeyId" element={<ClientCompanionPage />} /> */}
                  <Route path="/client/journey/:journeyId" element={<RedirectClientJourneyToCanonical />} />
                  <Route path="/client/messages" element={<ClientMessagesPage />} />
                  {/* ITER172 · Gen 1 overview FROZEN — /client/overview-legacy disabled.
                      <Route path="/client/overview-legacy" element={<ClientOverviewPage />} /> */}
                  <Route path="/client/project" element={<Navigate to="/client" replace />} />
                  <Route path="/client/moodboards" element={<Navigate to="/client" replace />} />
                  <Route path="/client/timeline" element={<Navigate to="/client" replace />} />
                  <Route path="/client/approvals" element={<Navigate to="/client" replace />} />
                  <Route path="/client/files" element={<Navigate to="/client" replace />} />
                </Route>

                {/* ITER172 · Advisor Network™ FROZEN — /advisor route removed at runtime.
                    Source preserved. To restore: re-add the lazy import + this Route. */}
                {/* <Route path="/advisor" element={<ProtectedRoute><OSWrap><AdvisorDashboardPage /></OSWrap></ProtectedRoute>} /> */}

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
                  {/* ITER144 · Runtime Context Inspector™ */}
                  <Route path="/admin/runtime-inspector" element={<RuntimeInspectorPage />} />
                  {/* Language Governance — reuse existing surface within the new shell */}
                  <Route path="/admin/language-governance" element={<LanguageCommandCenter />} />
                  {/* Legacy admin surfaces (Blueprint Collaborator-only) still accessible
                      under their original paths but mounted in the cinematic shell. */}
                  <Route path="/admin/audit" element={<AdminAuditPage />} />
                  <Route path="/admin/modules" element={<AdminModulesPage />} />
                  {/* ITER173 · P1 · Communication */}
                  <Route path="/admin/email-identity" element={<EmailIdentityPage />} />
                  <Route path="/admin/email-templates" element={<EmailTemplatesPage />} />
                  {/* ITER172 · Advisor Network™ FROZEN — admin routes removed at runtime.
                      Source preserved. To restore: uncomment imports + these Routes. */}
                  {/* <Route path="/admin/advisors" element={<AdvisorNetworkAdminPage />} /> */}
                  {/* <Route path="/admin/advisors/:id" element={<AdvisorDetailPage />} /> */}
                  {/* ITER148.B · Command Center extras */}
                  <Route path="/admin/forms-journeys" element={<FormBuilderPage />} />
                </Route>

                {/* ITER143C · Deprecated /superadmin/* aliases → hard redirect to /admin/* */}
                <Route path="/superadmin" element={<Navigate to="/admin" replace />} />
                <Route path="/superadmin/tenants" element={<Navigate to="/admin/tenants" replace />} />
                <Route path="/superadmin/tenants/:id" element={<Navigate to="/admin/tenants" replace />} />
                <Route path="/superadmin/modules" element={<Navigate to="/admin/modules" replace />} />
                <Route path="/superadmin/audit" element={<Navigate to="/admin/audit" replace />} />
                <Route path="/superadmin/languages" element={<Navigate to="/admin/language-governance" replace />} />
                {/* ITER147 · /admin/languages → moved inside DashboardLayout as /settings/languages */}
                <Route path="/admin/languages" element={<Navigate to="/settings/languages" replace />} />

                {/* ITER157.E · Pages Admin (Command Center) — full-screen,
                    OUTSIDE DashboardLayout, like a true CMS console. */}
                <Route path="/blueprint/experience" element={<StudioAdminRoute><PagesAdminPage /></StudioAdminRoute>} />
                <Route path="/blueprint/client-profile" element={<StudioAdminRoute><ClientProfileAdminPage /></StudioAdminRoute>} />
                <Route path="/admin/pages" element={<StudioAdminRoute><PagesAdminPage /></StudioAdminRoute>} />

                {/* PUBLIC tenant routes — runtime composition via Blueprint engine */}
                <Route path="/moodboard/share/:shareToken" element={<PublicMoodboardWrapper />} />
                <Route path="/presentation/:shareToken" element={<PublicPresentation />} />
                <Route path="/review/:shareToken" element={<ReviewMode />} />
                {/* STORE-004 · Public Project Story (cliente · no auth) */}
                <Route path="/story/:token" element={<PublicProjectStoryViewer />} />
                <Route path="/f/:tenantSlug/:formSlug" element={<PublicFormPage />} />
                <Route path="/:tenantSlug" element={<PublicTenantPage />} />
                <Route path="/:tenantSlug/:pageSlug" element={<PublicTenantPage />} />

                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
            </NewRelationshipProvider>
            </ActivationFoundationProvider>
            </GuidedTourProvider>
          </BrowserRouter>
          </EditorialOverridesProvider>
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