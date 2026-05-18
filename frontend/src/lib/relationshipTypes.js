/**
 * Editorial Relationship CRM™ — frontend type contracts (JSDoc).
 * ────────────────────────────────────────────────────────────────────
 * No UI in this sprint. These typedefs document the contract the future
 * Relationship Profile™, Relationship Journey™ board, and Intelligence
 * Dashboard will consume. They map 1:1 to the backend models defined in
 * /app/backend/routers/relationships.py (Phase R-CRM-2 extensions).
 */

/**
 * Editorial Journey stages (canonical). Map directly to backend
 * `relationship_lookups.lifecycle_stage` rows tagged
 * `metadata.canonical=true`.
 *
 * @typedef {'discovery' | 'inspiration' | 'editorial_engagement'
 *   | 'project_conversation' | 'material_exploration'
 *   | 'strategic_direction' | 'specification' | 'proposal'
 *   | 'active_collaboration' | 'long_term_relationship'} EditorialJourneyStage
 */

/**
 * @typedef {Object} EngagementSignal
 * @property {string} id
 * @property {string} account_id
 * @property {string} signal_type   - viewed_article | viewed_market_edition | viewed_project | viewed_moodboard | viewed_material | clicked_cta | submitted_form | requested_sample | requested_showroom_visit | requested_consultation | downloaded_proposal | shared_article | saved_inspiration | opened_email | watched_video | scrolled_long_form | quoted_material | specified_product
 * @property {string} [entity_type] - magazine_article | magazine_variant | project | moodboard | material | cms_section | form | cta_block | design_reference | hero_section
 * @property {string} [entity_id]
 * @property {string} [market_id]
 * @property {string} [locale_code]
 * @property {string} [surface]     - public_storefront | editorial_email | direct_share | embedded_widget | client_proposal | review_link
 * @property {string} [editorial_register]
 * @property {string[]} atmosphere_tags
 * @property {string[]} material_tags
 * @property {string} [cta_label]
 * @property {string} [cta_intent]  - private_consultation | showroom_visit | sample_request | proposal_download | consultation | newsletter_signup
 * @property {number} signal_weight
 * @property {number} [dwell_seconds]
 * @property {number} [scroll_depth_pct]
 * @property {string} occurred_at   - ISO timestamp
 * @property {string} [session_id]
 * @property {Object} metadata
 */

/**
 * @typedef {Object} RelationshipAffinities  - Relationship Intelligence™ snapshot
 * @property {string} account_id
 * @property {string|null} most_engaged_market_edition_id
 * @property {string|null} preferred_atmosphere
 * @property {string[]} preferred_atmosphere_tags
 * @property {string[]} preferred_materials
 * @property {string|null} preferred_cta_intent
 * @property {string|null} preferred_editorial_register
 * @property {number|null} hospitality_orientation_score    - 0..100
 * @property {number|null} specification_orientation_score  - 0..100
 * @property {number|null} long_form_engagement_score       - 0..100
 * @property {number|null} editorial_cadence_score          - 0..100
 * @property {number|null} luxury_perception_alignment      - 0..100
 * @property {number} signal_count_total
 * @property {string|null} last_signal_at
 * @property {string} computed_at
 * @property {Object} intelligence_payload                  - AI overlay (optional)
 */

/**
 * @typedef {Object} ProjectLink
 * @property {string} id
 * @property {string} account_id
 * @property {string} project_id
 * @property {'client'|'architect'|'specifier'|'observer'|'referral_source'} role
 * @property {string} [collaboration_stage]                 - Editorial Journey stage at linkage
 * @property {string} [notes]
 * @property {string} linked_at
 */

/**
 * @typedef {Object} InspirationLink
 * @property {string} id
 * @property {string} account_id
 * @property {string} reference_id                          - design_references.id
 * @property {'saved_by_account'|'shared_by_advisor'|'inferred_from_engagement'} source
 * @property {string} [resonance_note]
 * @property {string} saved_at
 */

/**
 * @typedef {Object} MaterialAffinity
 * @property {string} account_id
 * @property {string} material_id
 * @property {number} attraction_score                      - 0..100
 * @property {number} signal_count
 * @property {string} [last_engaged_at]
 * @property {boolean} sample_requested
 * @property {boolean} specified
 * @property {string} [notes]
 */

/**
 * @typedef {Object} AccountMarketLink
 * @property {string} account_id
 * @property {string} market_id
 * @property {boolean} is_primary
 * @property {number} [engagement_strength]                 - 0..100
 * @property {string} [notes]
 */

/**
 * @typedef {Object} RelationshipIntelligenceRow  - read from /api/relationships/intelligence
 * @property {string} account_id
 * @property {string} account_name
 * @property {string} account_type
 * @property {string} [lifecycle_stage]
 * @property {EditorialJourneyStage} [relationship_journey_stage]
 * @property {string} [market_id]
 * @property {Object} cultural_profile
 * @property {string} [hospitality_positioning]
 * @property {string} [editorial_register_affinity]
 * @property {string} [luxury_perception_axis]
 * @property {string} [last_activity_at]
 * @property {number} signal_count_total
 * @property {number} signal_count_30d
 * @property {number} signal_count_7d
 * @property {string} [last_signal_at]
 *
 * @property {string} [most_engaged_market_edition_id]
 * @property {string} [preferred_atmosphere]
 * @property {string[]} preferred_atmosphere_tags
 * @property {string[]} preferred_materials
 * @property {string} [preferred_cta_intent]
 * @property {string} [preferred_editorial_register]
 * @property {number} [hospitality_orientation_score]
 * @property {number} [specification_orientation_score]
 * @property {number} [long_form_engagement_score]
 * @property {number} [editorial_cadence_score]
 * @property {number} [luxury_perception_alignment]
 * @property {string} [affinity_computed_at]
 *
 * @property {number} linked_project_count
 * @property {number} linked_inspiration_count
 * @property {number} material_affinity_count
 * @property {number} market_count
 */

// Canonical journey stage ordering (for board column rendering)
export const EDITORIAL_JOURNEY_STAGES = [
  'discovery',
  'inspiration',
  'editorial_engagement',
  'project_conversation',
  'material_exploration',
  'strategic_direction',
  'specification',
  'proposal',
  'active_collaboration',
  'long_term_relationship',
];

// Editorial signal taxonomy — used by the future logger SDK
export const SIGNAL_TYPES = [
  'viewed_article', 'viewed_market_edition', 'viewed_project',
  'viewed_moodboard', 'viewed_material',
  'clicked_cta', 'submitted_form',
  'requested_sample', 'requested_showroom_visit', 'requested_consultation',
  'downloaded_proposal', 'shared_article', 'saved_inspiration',
  'opened_email', 'watched_video', 'scrolled_long_form',
  'quoted_material', 'specified_product',
];

// Project linkage roles
export const PROJECT_LINK_ROLES = [
  'client', 'architect', 'specifier', 'observer', 'referral_source',
];

// Editorial CTA intents (the cultural psychology of the CTA)
export const CTA_INTENTS = [
  'private_consultation', 'showroom_visit', 'sample_request',
  'proposal_download', 'consultation', 'newsletter_signup',
  'specification_review',
];

// Surfaces where engagement happens
export const ENGAGEMENT_SURFACES = [
  'public_storefront', 'editorial_email', 'direct_share',
  'embedded_widget', 'client_proposal', 'review_link',
];

// Cultural register vocabulary (matches markets.cultural_profile.editorial_register)
export const EDITORIAL_REGISTERS = [
  'Ceremonial Hospitality',
  'Editorial Restraint',
  'Aspirational Lifestyle',
  'Mediterranean Contemporary',
  'Imported Luxury',
  'Savoir-faire Prose',
  'Heritage Made-to-measure',
];

// Hospitality positioning vocabulary
export const HOSPITALITY_POSITIONINGS = [
  'ceremonial', 'discrete', 'wellness_oriented',
  'experiential', 'family_first', 'corporate',
];

// Luxury perception axis (4 cardinal directions)
export const LUXURY_PERCEPTION_AXES = [
  'heritage_first', 'innovation_first',
  'material_first', 'atmosphere_first',
];
