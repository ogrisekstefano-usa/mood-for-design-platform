import React from 'react';
import { useCorporatePage } from '../hooks/useCorporatePage';
import SectionRenderer from '../sections/SectionRenderer';

/**
 * Generic page component that renders CMS sections.
 * All pages use this pattern: fetch sections from API → render.
 */
export const CorporatePage = ({ slug }) => {
  const { sections, loading, error } = useCorporatePage(slug);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F9F8]">
        <div className="space-y-3 text-center">
          <div className="w-8 h-8 border border-[#3DDAD0] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-[#5A5A5A]">Loading</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F9F8]">
        <p className="text-sm text-[#5A5A5A]">Page not found.</p>
      </div>
    );
  }

  return (
    <main data-testid={`page-${slug}`}>
      {sections.map(section => (
        <SectionRenderer key={section.id} section={section} />
      ))}
    </main>
  );
};

// Individual page exports
export const HomePage = () => <CorporatePage slug="home" />;
export const PlatformPage = () => <CorporatePage slug="platform" />;
export const PricingPage = () => <CorporatePage slug="pricing" />;
export const AboutPage = () => <CorporatePage slug="about" />;
export const JournalPage = () => <CorporatePage slug="journal" />;
export const BlueprintPage = () => <CorporatePage slug="blueprint" />;
