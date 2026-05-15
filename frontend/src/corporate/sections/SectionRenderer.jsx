import React from 'react';
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

/**
 * MOOD Section Registry
 * Shared across corporate website and all tenant websites.
 * Maps section type strings to React components.
 * CMS-driven: section type determined by DB record.
 */
export const SECTION_REGISTRY = {
  editorial_hero: EditorialHero,
  split_story: SplitStory,
  cinematic_quote: CinematicQuote,
  logos_wall: LogosWall,
  feature_narrative: FeatureNarrative,
  metrics_strip: MetricsStrip,
  pricing_cards: PricingCards,
  cta_section: CTASection,
  journal_grid: JournalGrid,
  faq_accordion: FAQAccordion,
  comparison_table: ComparisonTable,
  timeline: Timeline,
  template_showcase: TemplateShowcase,
  process_steps: ProcessSteps,
  project_showcase: ProjectShowcase,
  press_logos: PressLogos,
};

/**
 * SectionRenderer — Renders any registered section type.
 * Receives pre-localized content from the API.
 */
const SectionRenderer = ({ section }) => {
  if (!section || !section.type) return null;

  const Component = SECTION_REGISTRY[section.type];
  if (!Component) {
    console.warn(`[MOOD] Unknown section type: "${section.type}"`);
    return null;
  }

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
