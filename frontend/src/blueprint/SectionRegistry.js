/**
 * Blueprint Section Engine — frontend registry.
 *
 * Maps the section `type` (server contract from /api/blueprint/sections/catalog)
 * to a React renderer component. NO content is hardcoded — every component
 * receives `content` (locale-resolved) + `settings` (per-instance overrides).
 *
 * Reusable across: homepage, landing pages, proposals, magazine, moodboards,
 * showcase pages, client portals, onboarding flows.
 */
import HeroSection from './sections/HeroSection';
import FeatureGridSection from './sections/FeatureGridSection';
import GallerySection from './sections/GallerySection';
import QuoteSection from './sections/QuoteSection';
import StatsSection from './sections/StatsSection';
import CTASection from './sections/CTASection';
import SplitSection from './sections/SplitSection';
import LogoStripSection from './sections/LogoStripSection';
import MagazineGridSection from './sections/MagazineGridSection';
import FAQSection from './sections/FAQSection';

export const SECTION_COMPONENTS = {
  hero:           HeroSection,
  feature_grid:   FeatureGridSection,
  gallery:        GallerySection,
  quote:          QuoteSection,
  stats:          StatsSection,
  cta:            CTASection,
  split:          SplitSection,
  logo_strip:     LogoStripSection,
  magazine_grid:  MagazineGridSection,
  faq:            FAQSection,
};

export function resolveSection(type) {
  return SECTION_COMPONENTS[type] || null;
}

/** Pick the locale-appropriate content payload, falling back gracefully. */
export function resolveContent(section, locale, fallbackLocale = 'en-US') {
  const c = section?.content || {};
  // Order: requested locale → tenant default → 'en-US' → _default
  const candidates = [c[locale], c[fallbackLocale], c['en-US'], c._default];
  for (const v of candidates) {
    if (v && typeof v === 'object') return v;
  }
  return c._default || {};
}
