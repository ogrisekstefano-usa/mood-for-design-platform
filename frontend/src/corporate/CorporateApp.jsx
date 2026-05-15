import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import CorporateNav from './components/CorporateNav';
import CorporateFooter from './components/CorporateFooter';
import {
  HomePage,
  PlatformPage,
  PricingPage,
  AboutPage,
  JournalPage,
  BlueprintPage,
} from './pages/CorporatePages';
import ContactPage from './pages/ContactPage';
import StartStudioPage from './pages/StartStudioPage';

/**
 * CorporateApp — Public corporate website for www.moodfordesign.com
 * Tenant: mood-corporate
 * ONE platform layer inside the Blueprint ecosystem.
 */
const CorporateApp = () => (
  <div className="corporate-app" style={{ fontFamily: 'Manrope, sans-serif', background: '#F9F9F8' }}>
    <CorporateNav />
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/platform" element={<PlatformPage />} />
      <Route path="/blueprint" element={<BlueprintPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/journal" element={<JournalPage />} />
      <Route path="/journal/*" element={<JournalPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/start-studio" element={<StartStudioPage />} />
      {/* Redirect for unlisted pages */}
      <Route path="/for-studios" element={<Navigate to="/platform" replace />} />
      <Route path="/for-retailers" element={<Navigate to="/platform" replace />} />
      <Route path="/templates" element={<Navigate to="/blueprint" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <CorporateFooter />
  </div>
);

export default CorporateApp;
