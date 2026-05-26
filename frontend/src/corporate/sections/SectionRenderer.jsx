import React from 'react';
import HeroEditorial from './HeroEditorial';
import CuratedBrands from './CuratedBrands';
import PlatformPillars from './PlatformPillars';
import DesignJourney from './DesignJourney';
import EditorialTriptych from './EditorialTriptych';
import FinalCTAImmersive from './FinalCTAImmersive';
import PageHero from './PageHero';
import PageIntro from './PageIntro';

import HeroCinematic from './HeroCinematic';
import SelectedProjects from './SelectedProjects';
import MagazineHighlights from './MagazineHighlights';
import MaterialsBrandPartners from './MaterialsBrandPartners';
import ProcessJourney from './ProcessJourney';
import FinalCTA from './FinalCTA';

// Legacy registry (still mounted for backwards compatibility)
import EditorialHero from './EditorialHero';
import SplitStory from './SplitStory';
import CinematicQuote from './CinematicQuote';
import LogosWall from './LogosWall';
import FeatureNarrative from './FeatureNarrative';
import MetricsStrip from './MetricsStrip';
import PricingCards from './PricingCards';
import CTASection from './CTASection';
import JournalGrid from './JournalGrid';
import FAQAccordion from './FAQAccordion';
import ComparisonTable from './ComparisonTable';
import Timeline from './Timeline';
import TemplateShowcase from './TemplateShowcase';
import ProcessSteps from './ProcessSteps';
import ProjectShowcase from './ProjectShowcase';
import PressLogos from './PressLogos';
import DeviceShowcase from './DeviceShowcase';
import TestimonialGrid from './TestimonialGrid';
import WorkflowEcosystem from './WorkflowEcosystem';
import ExperiencePillars from './ExperiencePillars';
import FragmentedTools from './FragmentedTools';

/**
 * Section registry for the ITER149 site engine.
 * Modern sections receive: { content, media, links, options } (resolved by site_resolver).
 * Legacy sections continue to receive: { content, config } (cms_sections.locale_content path).
 */
export const SECTION_REGISTRY = {
  // ITER149 Rebuild (latest, matches official mockup)
  hero_editorial:       HeroEditorial,
  curated_brands:       CuratedBrands,
  platform_pillars:     PlatformPillars,
  design_journey:       DesignJourney,
  editorial_triptych:   EditorialTriptych,
  final_cta_immersive:  FinalCTAImmersive,

  // ITER151 — generic dynamic page sections
  page_hero:            PageHero,
  page_intro:           PageIntro,

  // ITER149 — DB-driven sections
  hero_cinematic:       HeroCinematic,
  selected_projects:    SelectedProjects,
  magazine_highlights:  MagazineHighlights,
  materials_partners:   MaterialsBrandPartners,
  process_journey:      ProcessJourney,
  final_cta:            FinalCTA,

  // Legacy (kept for backwards compat with cms_sections.locale_content rendering path)
  editorial_hero:       EditorialHero,
  split_story:          SplitStory,
  cinematic_quote:      CinematicQuote,
  logos_wall:           LogosWall,
  feature_narrative:    FeatureNarrative,
  metrics_strip:        MetricsStrip,
  pricing_cards:        PricingCards,
  cta_section:          CTASection,
  journal_grid:         JournalGrid,
  faq_accordion:        FAQAccordion,
  comparison_table:     ComparisonTable,
  timeline:             Timeline,
  template_showcase:    TemplateShowcase,
  process_steps:        ProcessSteps,
  project_showcase:     ProjectShowcase,
  press_logos:          PressLogos,
  device_showcase:      DeviceShowcase,
  testimonial_grid:     TestimonialGrid,
  workflow_ecosystem:   WorkflowEcosystem,
  experience_pillars:   ExperiencePillars,
  fragmented_tools:     FragmentedTools,
};

const SectionRenderer = ({ section }) => {
  if (!section || !section.type) return null;
  const Component = SECTION_REGISTRY[section.type];
  if (!Component) {
    console.warn(`[MOOD] Unknown section type: "${section.type}"`);
    return null;
  }

  // ITER149 modern shape
  if (section.media !== undefined || section.links !== undefined || section.options !== undefined) {
    return (
      <Component
        key={section.id}
        content={section.content || {}}
        media={section.media || {}}
        links={section.links || {}}
        options={section.options || {}}
        sectionId={section.id}
      />
    );
  }

  // Legacy shape
  return (
    <Component
      key={section.id}
      content={section.content || {}}
      config={section.config || {}}
      sectionId={section.id}
    />
  );
};

export default SectionRenderer;
