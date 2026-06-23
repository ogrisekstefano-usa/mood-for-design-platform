import React from 'react';
import { useSitePage } from '../hooks/useSitePage';
import SectionRenderer from '../sections/SectionRenderer';
import SEOHead from '../components/SEOHead';
import DesignJourneyTeaser from '../sections/DesignJourneyTeaser';

/**
 * SitePage — generic page renderer using the ITER149 /api/site/pages endpoint.
 * All content is DB-driven (editorial_blocks + media_library + cms_sections).
 */
export const SitePage = ({ slug }) => {
  const { page, sections, loading, error } = useSitePage(slug);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--mood-black)' }} data-testid="site-loading">
        <div className="space-y-3 text-center">
          <div className="w-8 h-8 border border-[#00C9B3] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.6)' }}>Loading</p>
        </div>
      </div>
    );
  }

  if (error || !sections?.length) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--mood-black)', color: '#FFFFFF' }}
        data-testid="site-empty"
      >
        <div className="text-center px-6">
          <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '2rem', fontStyle: 'italic', color: 'rgba(255,255,255,0.55)' }}>
            Coming soon.
          </p>
          <p className="mt-3 overline-teal">{slug}</p>
        </div>
      </main>
    );
  }

  return (
    <main data-testid={`site-page-${slug}`}>
      <SEOHead
        title={page?.title}
        description={page?.meta_description}
        ogImage={page?.seo?.og_image_url}
      />
      {sections.map((s) => <SectionRenderer key={s.id} section={s} />)}
    </main>
  );
};

/**
 * HomePage — overrides SitePage to inject the DesignJourneyTeaser banner
 * between the first (hero) section and the rest of the page content.
 */
export const HomePage = () => {
  const { page, sections, loading, error } = useSitePage('home');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--mood-black)' }} data-testid="site-loading">
        <div className="space-y-3 text-center">
          <div className="w-8 h-8 border border-[#00C9B3] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.6)' }}>Loading</p>
        </div>
      </div>
    );
  }

  if (error || !sections?.length) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--mood-black)' }} data-testid="site-empty">
        <div className="text-center px-6">
          <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '2rem', fontStyle: 'italic', color: 'rgba(255,255,255,0.55)' }}>
            Coming soon.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main data-testid="site-page-home">
      <SEOHead
        title={page?.title}
        description={page?.meta_description}
        ogImage={page?.seo?.og_image_url}
      />
      {sections.map((s, i) => (
        <React.Fragment key={s.id}>
          <SectionRenderer section={s} />
          {i === 0 && <DesignJourneyTeaser />}
        </React.Fragment>
      ))}
    </main>
  );
};

export const MagazinePage          = () => <SitePage slug="magazine" />;
export const ProjectsPage          = () => <SitePage slug="projects" />;
export const MaterialsPage         = () => <SitePage slug="materials" />;
export const AboutPage             = () => <SitePage slug="about" />;
export const BeginJourneyPage      = () => <SitePage slug="begin-journey" />;
export const ProfessionalAccessPg  = () => <SitePage slug="professional-access" />;

// ITER151 — new dynamic pages
export const AudiencePage  = () => <SitePage slug="audience" />;
export const FeaturesPage  = () => <SitePage slug="features" />;
export const PricingPage   = () => <SitePage slug="pricing" />;
export const TrainingPage  = () => <SitePage slug="training" />;
export const SupportPage   = () => <SitePage slug="support" />;
export const LoginSitePage = () => <SitePage slug="login" />;
