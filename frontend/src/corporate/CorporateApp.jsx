import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MinimalNav from './components/MinimalNav';
import SlimFooter from './components/SlimFooter';
import {
  HomePage,
  MagazinePage,
  ProjectsPage,
  MaterialsPage,
  AboutPage,
  BeginJourneyPage,
  ProfessionalAccessPg,
} from './pages/SitePages';
import LoginPage from './pages/LoginPage';
import ContactPage from './pages/ContactPage';
import StartStudioPage from './pages/StartStudioPage';

/**
 * CorporateApp — public-facing MOOD for DESIGN website (ITER149).
 * Fully DB-driven via /api/site/* endpoints.
 * Slim nav + slim footer. Two primary user actions: Begin Journey / Professional Access.
 */
const CorporateApp = () => (
  <div className="corporate-app" style={{ background: 'var(--mood-black)' }}>
    <MinimalNav />
    <Routes>
      <Route path="/"                       element={<HomePage />} />
      <Route path="/magazine"               element={<MagazinePage />} />
      <Route path="/magazine/*"             element={<MagazinePage />} />
      <Route path="/projects"               element={<ProjectsPage />} />
      <Route path="/projects/*"             element={<ProjectsPage />} />
      <Route path="/materials"              element={<MaterialsPage />} />
      <Route path="/about"                  element={<AboutPage />} />
      <Route path="/login"                  element={<LoginPage />} />
      <Route path="/begin-journey"          element={<BeginJourneyPage />} />
      <Route path="/professional-access"    element={<ProfessionalAccessPg />} />
      <Route path="/contact"                element={<ContactPage />} />
      <Route path="/start-studio"           element={<StartStudioPage />} />
      {/* Legacy redirects */}
      <Route path="/platform"      element={<Navigate to="/" replace />} />
      <Route path="/pricing"       element={<Navigate to="/" replace />} />
      <Route path="/blueprint"     element={<Navigate to="/about" replace />} />
      <Route path="/journal"       element={<Navigate to="/magazine" replace />} />
      <Route path="/journal/*"     element={<Navigate to="/magazine" replace />} />
      <Route path="/for-studios"   element={<Navigate to="/projects" replace />} />
      <Route path="/for-retailers" element={<Navigate to="/materials" replace />} />
      <Route path="/templates"     element={<Navigate to="/" replace />} />
      <Route path="*"              element={<Navigate to="/" replace />} />
    </Routes>
    <SlimFooter />
  </div>
);

export default CorporateApp;
