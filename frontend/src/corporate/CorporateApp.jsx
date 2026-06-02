import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import MinimalNav from './components/MinimalNav';
import EditorialFooter from './components/EditorialFooter';
import LegalStrip from './components/LegalStrip';
import PreviewBridge from './components/PreviewBridge';
import {
  HomePage,
  MagazinePage,
  ProjectsPage,
  MaterialsPage,
  AboutPage,
  AudiencePage,
  FeaturesPage,
  PricingPage,
  TrainingPage,
  SupportPage,
} from './pages/SitePages';
import ContactPage from './pages/ContactPage';
import StartStudioPage from './pages/StartStudioPage';
import AccessContinuityPage from './pages/AccessContinuityPage';
import MovementEntrance from './pages/studio/MovementEntrance';
import MovementPractice from './pages/studio/MovementPractice';
import MovementEcosystem from './pages/studio/MovementEcosystem';
import MovementIdentity from './pages/studio/MovementIdentity';
import MovementRequest from './pages/studio/MovementRequest';
import StudioFunnelV2 from './pages/studio_v2/StudioFunnelV2';
import PasswordResetPage from './pages/PasswordResetPage';
import { getAllSlugs } from './routes/localizedSlugs';

/**
 * CorporateApp — public-facing MOOD for DESIGN website.
 * ITER151: new top nav (Dedicato a · Caratteristiche · Versioni e Prezzi ·
 * Formazione) + (Supporto · Accedi). All routes locale-localized.
 *
 * ITER167: /accedi (and all localized variants) now mount the
 * AccessContinuity™ experience — a single hospitality-grade entrance
 * that handles magic-link, adaptive password, and concierge flows.
 * The /journey/continue route consumes magic-link tokens.
 */

const PAGE_COMPONENTS = {
  audience: AudiencePage,
  features: FeaturesPage,
  pricing:  PricingPage,
  training: TrainingPage,
  support:  SupportPage,
  login:    AccessContinuityPage,  // ITER167 — replaces LoginHero
};

const renderLocalizedRoutes = () => {
  const routes = [];
  for (const [key, Component] of Object.entries(PAGE_COMPONENTS)) {
    const slugs = getAllSlugs(key);
    for (const slug of slugs) {
      routes.push(<Route key={`${key}:${slug}`} path={slug} element={<Component />} />);
    }
  }
  return routes;
};

const CorporateApp = () => {
  const location = useLocation();
  // ITER167 — Access Continuity™ routes render in a stripped, cinematic
  // shell: no top nav, no footer, no legal strip. The page IS the
  // experience. Localized /accedi variants also trigger this.
  const accessSlugs = getAllSlugs('login');
  const isAccessRoute =
    location.pathname === '/journey/continue' ||
    location.pathname === '/reset-password' ||
    accessSlugs.includes(location.pathname);
  // /studio (V2 funnel) ora vive dentro il chrome classico (navbar+footer).
  // Solo /studio-legacy resta full-bleed per regression test.
  const isStudioActivationRoute = location.pathname.startsWith('/studio-legacy');

  const stripChrome = isAccessRoute || isStudioActivationRoute;

  return (
    <div className="corporate-app" style={{ background: 'var(--mood-black)' }}>
      <PreviewBridge />
      {!stripChrome && <MinimalNav />}
      <Routes>
        <Route path="/"                       element={<HomePage />} />
        <Route path="/magazine"               element={<MagazinePage />} />
        <Route path="/magazine/*"             element={<MagazinePage />} />
        <Route path="/projects"               element={<ProjectsPage />} />
        <Route path="/projects/*"             element={<ProjectsPage />} />
        <Route path="/materials"              element={<MaterialsPage />} />
        <Route path="/about"                  element={<AboutPage />} />

        {/* ITER151 — localized dynamic pages */}
        {renderLocalizedRoutes()}

        {/* ITER167 — Magic link landing (universal route, all locales). */}
        <Route path="/journey/continue" element={<AccessContinuityPage />} />

        {/* P0-C — Password reset landing */}
        <Route path="/reset-password" element={<PasswordResetPage />} />

        {/* Studio Activation Flow V2 — public funnel (5 step) */}
        <Route path="/studio"           element={<StudioFunnelV2 />} />

        {/* V1 quarantined to /studio-legacy (QA / regression only,
            not linked from any public navigation, not indexed). */}
        <Route path="/studio-legacy"           element={<MovementEntrance />} />
        <Route path="/studio-legacy/practice"  element={<MovementPractice />} />
        <Route path="/studio-legacy/ecosystem" element={<MovementEcosystem />} />
        <Route path="/studio-legacy/identity"  element={<MovementIdentity />} />
        <Route path="/studio-legacy/request"   element={<MovementRequest />} />

        {/* Legacy redirects */}
        <Route path="/start-studio"         element={<Navigate to="/studio" replace />} />
        <Route path="/platform"             element={<Navigate to="/" replace />} />
        <Route path="/blueprint"            element={<Navigate to="/about" replace />} />
        <Route path="/journal"              element={<Navigate to="/magazine" replace />} />
        <Route path="/journal/*"            element={<Navigate to="/magazine" replace />} />
        <Route path="/for-studios"          element={<Navigate to="/projects" replace />} />
        <Route path="/for-retailers"        element={<Navigate to="/materials" replace />} />
        <Route path="/templates"            element={<Navigate to="/" replace />} />
        <Route path="/begin-journey"        element={<Navigate to="/dedicato-a" replace />} />
        <Route path="/professional-access"  element={<Navigate to="/accedi" replace />} />
        <Route path="*"                     element={<Navigate to="/" replace />} />
      </Routes>
      {!stripChrome && <EditorialFooter />}
      {!stripChrome && <LegalStrip />}
    </div>
  );
};

export default CorporateApp;
