import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MinimalNav from './components/MinimalNav';
import EditorialFooter from './components/EditorialFooter';
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
import LoginPage from './pages/LoginPage';
import ContactPage from './pages/ContactPage';
import StartStudioPage from './pages/StartStudioPage';
import { getAllSlugs } from './routes/localizedSlugs';

/**
 * CorporateApp — public-facing MOOD for DESIGN website.
 * ITER151: new top nav (Dedicato a · Caratteristiche · Versioni e Prezzi ·
 * Formazione) + (Supporto · Accedi). All routes locale-localized.
 */

const PAGE_COMPONENTS = {
  audience: AudiencePage,
  features: FeaturesPage,
  pricing:  PricingPage,
  training: TrainingPage,
  support:  SupportPage,
  login:    LoginPage,        // /login keeps the dedicated React component (form)
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

const CorporateApp = () => (
  <div className="corporate-app" style={{ background: 'var(--mood-black)' }}>
    <PreviewBridge />
    <MinimalNav />
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

      {/* Legacy redirects */}
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
    <EditorialFooter />
  </div>
);

export default CorporateApp;
