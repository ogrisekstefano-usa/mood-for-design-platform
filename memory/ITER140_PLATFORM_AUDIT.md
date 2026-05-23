# ITER140 · PLATFORM CAPABILITY AUDIT™ + MODULE REGISTRY™

**Date**: 23 February 2026 · **Mode**: Read-only inventory · **Scope**: Real implementation map (no redesign, no new features).

> **TL;DR** — MOOD for DESIGN™ has 77 backend routers, 155 DB tables, 125 frontend pages, 161 routes. ~30 modules are PRODUCTION-READY, ~12 are PARTIAL, ~6 are MVP-LITE placeholders, and ~5 surface tables are SEED ONLY. The platform is already too wide for a 4-person studio MVP. **Priority is consolidation, not expansion.**

---

## 1. ACTIVE MODULE REGISTRY™

Status legend:
- 🟢 **ACTIVE** — full FE+BE+DB, real users have used it
- 🟡 **PARTIAL** — FE+BE exist, some flows wired, some still skeleton
- 🟠 **MOCK** — UI looks real but data is hardcoded/seeded only
- 🔵 **MVP-LITE** — graceful placeholder (MvpLitePage), redirects to real workflow
- 🔴 **DEAD UI** — page exists, no backend or unused
- ⚪ **SEED ONLY** — schema exists, 0 rows or only demo seed

| # | Module | Route(s) | Status | Real Function | React | Backend | DB | Deps | i18n | Cinematic | Tenant | Prod-ready |
|--|--|--|--|--|--|--|--|--|--|--|--|--|
| 1 | **Atelier Dashboard™** | `/dashboard` | 🟢 ACTIVE | Studio pulse, hero, journey cards, inspiration quote | `AtelierDashboardPage` `JourneyPulsePage` | `atelier_dashboard` `journey_pulse` | `atelier_dashboard_config` `atelier_dashboard_quotes` `atelier_dashboard_media` `design_journeys` `journey_milestones` `journey_timeline_events` | Design Journey · ALE | ✅ | ✅ DNA v2 | ✅ | ✅ |
| 2 | **Atelier Dashboard Admin™** | `/settings/atelier-dashboard` | 🟢 ACTIVE | Hero/sections/quotes/media editor | `AtelierDashboardAdminPage` `AtelierMediaDirection` | `atelier_dashboard` `atelier_media` | same | Supabase Storage · Pillow | ✅ (7 locali) | ✅ | ✅ | ✅ |
| 3 | **Atelier Media Direction™** | tab `/settings/atelier-dashboard` | 🟢 ACTIVE | Drop+crop+focal+grading+gallery | `AtelierMediaDirection` | `atelier_media` | `atelier_dashboard_media` | Supabase Storage `tenant-assets` | ✅ | ✅ | ✅ | ✅ |
| 4 | **Design Journey™ Tab** | `/workspace/projects/:id` (tab) | 🟢 ACTIVE | 10-milestone canvas + timeline + dialogue | `DesignJourneyTab` `MilestoneDialogue` | `design_journey` `milestone_dialogue` | `design_journeys` `journey_milestones` `journey_timeline_events` `journey_artifacts` `milestone_feedback` | Projects · ALE | ✅ | ✅ | ✅ | ✅ |
| 5 | **Step Workspace™** | `/journey/:projectId/step/:milestoneType` | 🟡 PARTIAL | Step-anchored artifact page · only 2 of 10 milestones have custom UI | `StepWorkspacePage` `MoodboardDirectionWorkspace` `MaterialDirectionWorkspace` `ClientInteractionLayer` | `journey_step_workspace` `journey_initiate` | `journey_milestones` `journey_artifacts` `milestone_versions` `milestone_feedback` | Design Journey | ✅ | ✅ | ✅ | 🟡 8 generic |
| 6 | **Begin Journey™** | `/begin-journey` `/journey/welcome/:token` | 🟢 ACTIVE | Public client intake → studio onboarding | `BeginJourneyPage` `JourneyWelcomePage` | `journey_initiate` | `design_journeys` `preview_tokens` | Auth · Onboarding | ✅ | ✅ | ✅ | ✅ |
| 7 | **Journey Closure™** | inline (within Design Journey) | 🟡 PARTIAL | Certified ceremony · UI exists but ceremony flow unfinished | `JourneyClosureCeremony` | `journey_closure` | `design_journeys.status` | Design Journey | ⚠️ partial | ✅ | ✅ | 🟡 |
| 8 | **Site Evolution™** | `/journey/site-evolution` (placeholder) | 🔵 MVP-LITE | Photo timeline of site progress | `OnboardingPlaceholderPage` (variant) | `site_evolution` (stub) | — | Design Journey | n/a | ✅ | ✅ | ❌ |
| 9 | **Projects** | `/workspace/projects` `/workspace/projects/:id` | 🟢 ACTIVE | Project list + detail with Design Journey + tabs | `ProjectsPage` `ProjectDetailPage` `ProjectsStudioPage` | `projects` `project_workspace_v2` | `projects` (245) `project_activity` (381) `project_notes` (2) `project_status_history` `project_ai_briefs` | CRM · Design Journey | ✅ | ✅ | ✅ | ✅ |
| 10 | **CRM Accounts™** | `/crm/accounts` `/crm/accounts/:accountId` `/crm/:tab` | 🟢 ACTIVE | Accounts (B2C/B2B/atelier), contacts, voice notes, intelligence, constellation | `CrmAccountsPage` `AccountDetailPage` `AccountConstellation` `RelationshipGraph` `VoiceRecorder` `ActivityModal` `StageChangeModal` `CulturalEditionModal` | `relationships` `crm_voice_notes` `crm_intelligence` | `accounts` (250) `contacts` (247) `relationship_actions` (**0**) `relationship_affinities` `interactions` | Cultural Editions · ALE | ✅ | ✅ | ✅ | 🟡 actions=0 |
| 11 | **Leads** | `/workspace/leads` → redirect `/crm/accounts` | 🟢 ACTIVE | Lead intake + pipeline | `LeadsPage` | `leads` | `leads` (80) `lead_assignments` | CRM | ✅ | ✅ | ✅ | ✅ |
| 12 | **Proposals** | `/workspace/proposals` `/workspace/proposals/:id/compose` | 🟡 PARTIAL | Proposal list + composer · few proposals authored | `ProposalsPage` `ProposalComposerPage` | `proposals` `proposal_composer` | `proposals` (3) `proposal_items` (**0**) `proposal_signoffs` `proposal_market_versions` | Projects · CRM | ✅ | ✅ | ✅ | 🟡 unused |
| 13 | **Moodboards™** | `/moodboards` `/moodboards/:id` `/moodboard/share/:shareToken` `/presentation/:shareToken` | 🟢 ACTIVE | Moodboard editor + share + public presentation | `MoodboardsPage` `MoodboardEditor` `PublicPresentation` | `moodboards` `moodboards_v1` `templates` | `moodboards` (309) `moodboard_pages` `moodboard_elements` `moodboard_shares` `moodboard_versions` `moodboard_comments` `moodboard_candidates` (2) `moodboard_templates` | Inspirations · Storage | ✅ | ✅ | ✅ | ✅ |
| 14 | **Inspirations™** | `/inspirations` `/inspirations/collections` `/inspirations/brands` `/inspirations/brands/:brandId` `/inspirations/materials` `/inspirations/products/:productId` `/inspirations/visual-archive` | 🟢 ACTIVE | Brands, collections, materials, products, saved refs | `InspirationsPage` `BrandModePage` `BrandDetailPage` `StudioCollectionsPage` `MaterialViewPage` `ProductGalleryPage` `CuratedCollectionDrawer` `InspirationDetailDrawer` `AddInspirationModal` `BrandFormModal` `CollectionFormModal` `MoodboardPickerModal` `SupplierCatalogImportModal` | `inspirations` `inspirations_boards` `inspirations_archive` `supplier_catalogs` `brands_registry` `curated_references` `usage_memory` `client_preview` | `brands` `brand_collections` `inspirations_items` (1) `inspirations_boards` (5) `inspirations_comments` `inspirations_activity` `inspiration_links` `saved_references` (57) `design_references` `reference_collections` (5) `reference_collection_items` `reference_locale_interpretations` `curated_collections` `material_registry` (9) `material_assets` `supplier_catalogs` `tag_registry` `media_collections` `media_collection_items` `media_with_usage` `media_library` (130) | Moodboards · Design Journey | ✅ | ✅ | ✅ | 🟡 inspirations_items=1 (use saved_references) |
| 15 | **Library / Media** | `/library` `/library/materials` `/library/materials/:slug` `/library/collections` | 🟡 PARTIAL | Media library + materials · collections is MvpLite | `MediaLibraryPage` `MaterialsPage` `MaterialDetailPage` `CollectionsHub` (MvpLite) | `media` `media_enrichment` | `media_library` (130) `media_links` | Storage | ✅ | ✅ | ✅ | 🟡 collections placeholder |
| 16 | **Editorial Studio™** | `/blueprint/editorial` | 🟢 ACTIVE | 4-rail composition: context · article · operations · public preview | `EditorialStudioPage` `EditorialContextRail` `ArticleEditorPanel` `AdaptationOperationsPanel` `CompositionRoomRail` `PublicPreviewDrawer` `MarketEditionsToolbar` | `editorial` `editorial_variants` `editorial_calendar` `ai_editorial` | `editorial_masters` (165) `editorial_variants` (143) `editorial_revisions` `editorial_composition_log` `editorial_translations` (242) | ALE · Cultural Editions · Markets | ✅ | ✅ | ✅ | ✅ |
| 17 | **Editorial Calendar** | `/blueprint/editorial-calendar` | 🟡 PARTIAL | Publishing calendar · UI exists, queue scheduling shallow | `EditorialCalendarPage` | `editorial_calendar` | `editorial_masters` (kept_at fields) | Editorial Studio | ✅ | ✅ | ✅ | 🟡 |
| 18 | **Cultural Editions™** | `/workspace/cultural-editions` `/workspace/cultural-editions/:id` | 🟢 ACTIVE | Market-specific editorial drafts · review flow | `CulturalEditionsListPage` `CulturalEditionReviewPage` `CulturalEditionModal` | `cultural_editions` | `cultural_edition_drafts` (22) `cultural_descriptors` `market_cultural_profiles` | Markets · ALE | ✅ | ✅ | ✅ | ✅ |
| 19 | **Editorial Inbox** | `/editorial/inbox` | 🟡 PARTIAL | Variant approval queue | `VariantApprovalInboxPage` | `editorial_variants` | `editorial_variants` | Editorial Studio | ✅ | ✅ | ✅ | 🟡 |
| 20 | **Magazine (Tenant)** | `/settings/magazine` `/settings/magazine/:id` | 🟡 PARTIAL | Per-tenant magazine editor | `MagazineAdminPage` `MagazineEditorPage` | `magazine` `pages` | `magazine_articles` `magazine_paragraphs` `magazine_posts` (**0**) `article_localizations` `article_category_map` `article_tag_map` `article_hotspots` `hotspot_locale_variants` `journal_articles` `journal_article_blocks` `journal_categories` `journal_tags` | Editorial · Markets | ⚠️ | ✅ | ✅ | 🟡 0 posts |
| 21 | **Magazine (Public)** | `/magazine` `/magazine/:slug` | 🟢 ACTIVE | Public-facing magazine | `MagazinePage` `MagazineArticlePage` `ArticleHead` | `magazine` `public_i18n` | same as above | Tenant magazine | ✅ | ✅ | ✅ | ✅ |
| 22 | **Public Site** | `/` `/projects` `/projects/:slug` `/professionals` `/professionals/intake` `/start-project` | 🟢 ACTIVE | Marketing/public surface | `HomePage` `ProjectsIndexPage` `SiteProjectDetailPage` `ProfessionalsGatewayPage` `ProfessionalIntakePage` `StartProjectWizard` | `public` `portfolio` | `portfolio_projects` `portfolio_project_variants` `cms_pages` (20) `cms_sections` `cms_assets` | Editorial · Markets | ✅ | ✅ | ✅ | ✅ |
| 23 | **Public Forms** | `/form/:slug` `/f/:tenantSlug/:formSlug` | 🟢 ACTIVE | Public lead-capture forms | `LeadFormPage` `PublicFormPage` | `forms` | `contact_submissions` `funnel_events` `magazine_anonymous_leads` | Leads | ✅ | ✅ | ✅ | ✅ |
| 24 | **Storefront Studio** | `/storefront` (assumed) | 🟡 PARTIAL | Tenant CMS bands/sections editor | `StorefrontStudioPage` `bandEditors` | `storefront` | `cms_pages` (20) `cms_sections` `cms_assets` `template_pages` `template_blocks` `theme_presets` | Public Site | ✅ | ✅ | ✅ | 🟡 |
| 25 | **Brand Studio** | `/settings/brand` `/studio-identity` | 🟢 ACTIVE | Studio identity (logo, palette, voice) | `BrandStudioPage` | `branding` | `tenant_settings` `theme_presets` | — | ✅ | ✅ | ✅ | ✅ |
| 26 | **Domains** | `/settings/domains` | 🟢 ACTIVE | Custom domain wiring | `DomainsPage` | `domains` | `tenant_domains` | — | ✅ | ✅ | ✅ | ✅ |
| 27 | **Members / Team** | `/settings/members` `/settings/team` | 🟢 ACTIVE | Invite, role assign | `MembersPage` | `members` `tenant_onboarding` | `tenant_memberships` (53) `member_invites` (1) `users_profile` | Auth | ✅ | ✅ | ✅ | ✅ |
| 28 | **Plan / Billing** | `/settings/plan` | 🟡 PARTIAL | License view · no payment yet | `PlanPage` | `license` | `tenants.plan_*` | — | ✅ | ✅ | ✅ | 🟡 no Stripe |
| 29 | **Forms Builder** | `/settings/forms` | 🟡 PARTIAL | Public form builder · build flow shallow | `FormBuilderPage` | `forms` | `forms` (table) | Public Forms | ✅ | ✅ | ✅ | 🟡 |
| 30 | **Settings Hub** | `/settings` | 🟢 ACTIVE | Tenant settings index | `SettingsPage` | `settings` | `tenant_settings` | — | ✅ | ✅ | ✅ | ✅ |
| 31 | **International Presence** | `/settings/international-presence` | 🟢 ACTIVE | Active locales + markets per tenant | `InternationalPresencePage` | `markets` | `tenant_markets` `market_submarkets` `markets` `locale_profiles` | Markets | ✅ | ✅ | ✅ | ✅ |
| 32 | **Market Matrix** | `/blueprint/markets` | 🟢 ACTIVE | Markets editorial map | `MarketMatrixPage` | `markets` | `markets` `market_cultural_profiles` `market_narrative_profiles` `market_positioning_profiles` `market_reference_sets` | International Presence | ✅ | ✅ | ✅ | ✅ |
| 33 | **Market Insights / Intelligence** | `/blueprint/intelligence` | ⚪ SEED ONLY | Insights dashboard | `MarketInsightsPage` | `market_intelligence` `market_perspectives` | `market_insights` (**0**) `market_behavior_events` `market_signal_aggregates` `editorial_market_learnings` | Markets · Editorial | ✅ | ✅ | ✅ | ❌ no data |
| 34 | **Insights** | `/insights` | 🟡 PARTIAL | Studio analytics | `InsightsPage` | `insights` | `analytics_events` `product_events` `product_usage_events` `tenant_activity_events` | — | ✅ | ✅ | ✅ | 🟡 |
| 35 | **Brand Voice Adapters** | `/blueprint/voice` | 🟢 ACTIVE | Tone/voice configuration | `BrandVoiceAdaptersPage` | `voice_api` | `studio_vocabulary` (6) `studio_translation_preferences` `tenant_dnt_registry` | ALE | ✅ | ✅ | ✅ | ✅ |
| 36 | **Studio Voice** | `/blueprint/studio-voice` | 🟢 ACTIVE | Studio voice editorial | `StudioVoicePage` | `voice_api` | same | ALE | ✅ | ✅ | ✅ | ✅ |
| 37 | **Language Command Center** | `/blueprint/language` `/admin/language[/:tab]` | 🟢 ACTIVE | i18n MISS/LEAK heatmap, self-heal, screenshot drawer | `LanguageCommandCenter` (+ 7 child panels) | `language_api` `ale_api` `locale_runtime` | `editorial_translations` (242) `localization_audit_runs` `localization_overrides` `studio_translation_corrections` | ALE | ✅ | ✅ | ✅ | ✅ |
| 38 | **Navigation Editor** | `/settings/navigation` (assumed) | 🟢 ACTIVE | Sidebar/header CMS | `NavigationEditorPage` | `navigation` | `tenant_settings` | — | ✅ | ✅ | ✅ | ✅ |
| 39 | **Homepage Builder** | `/settings/homepage` (assumed) | 🟡 PARTIAL | Editor for tenant homepage | `HomepageBuilderPage` | `pages` `storefront` | `cms_pages` (20) `cms_sections` | Storefront | ✅ | ✅ | ✅ | 🟡 |
| 40 | **Languages** | `/settings/languages` (assumed) | 🟢 ACTIVE | Active locales toggle | `LanguagesPage` | `language_api` | `tenant_settings.active_locales` | i18n | ✅ | ✅ | ✅ | ✅ |
| 41 | **References (workspace)** | `/workspace/references` → redirect `/inspirations` | 🔵 MVP-LITE | Replaced by Inspirations | — | — | — | — | — | — | — | — |
| 42 | **Notifications** | (bell icon) | 🟡 PARTIAL | Notification badge + drawer | inline component | (none dedicated) | `notifications` (17) | — | ✅ | ✅ | ✅ | 🟡 |
| 43 | **Client Portal** | `/client/...` `/preview/:token` `/review/:shareToken` | 🟢 ACTIVE | Read-only client surface + review/feedback | `ClientCompanionPage` `ClientJourneysIndexPage` `ClientOverviewPage` `ClientMessagesPage` `ClientStubPages` `ClientPreviewPage` `ReviewMode` | `client_portal` `client_preview` `client_messages` `collab` | `client_messages` (10) `client_preview_feedback` `client_preview_views` `preview_tokens` `collab_versions` (0) `collab_comments` `collab_activity` `collab_inspirations` `collab_page_status` `message_translations` | Auth · Design Journey | ✅ | ✅ | ✅ | 🟡 collab=0 |
| 44 | **Voice Notes (CRM)** | inside CRM | 🟢 ACTIVE | Audio recording + transcription + memory | `VoiceRecorder` | `crm_voice_notes` | `relationship_actions` `interactions` | CRM | ✅ | ✅ | ✅ | ✅ |
| 45 | **CRM Constellation / Graph** | `/crm/constellation` (tab) | 🟢 ACTIVE | Relationship visual map | `AccountConstellation` `RelationshipGraph` | `crm_intelligence` `g3_constellation` | `relationship_affinities` `relationship_lookups` `relationship_engagement_signals` `relationship_inspirations` `relationship_material_affinities` `relationship_projects` `relationship_intelligence_v` | CRM | ✅ | ✅ | ✅ | ✅ |
| 46 | **Advisor Network™** | `/superadmin/advisor*` | 🟡 PARTIAL | Advisor commission/referral system | `AdvisorNetworkAdminPage` `AdvisorDetailPage` `AdvisorEditDrawer` `AdvisorDashboardPage` | `advisor_network` `advisor_suggestions` | `advisor_profiles` (2) `advisor_referrals` (0) `advisor_activity_months` `advisor_commission_periods` `advisor_notes` `advisor_reports` `advisor_territories` | — | ✅ | ✅ | ✅ | 🟡 0 referrals |
| 47 | **Super Admin** | `/superadmin` `/superadmin/tenants` `/superadmin/tenants/:id` `/superadmin/audit` `/superadmin/modules` `/superadmin/languages` | 🟢 ACTIVE | Platform ops | `AdminOverviewPage` `AdminTenantsPage` `AdminTenantDetailPage` `AdminAuditPage` `AdminModulesPage` `PlatformCapabilitiesPage` | `superadmin` | `tenants` `tenant_settings` `audit_logs` | — | ✅ | ✅ | ✅ | ✅ |
| 48 | **Onboarding (Tenant)** | `/onboarding/:kind` | 🟡 PARTIAL | New-tenant ritual | `OnboardingPlaceholderPage` | `tenant_onboarding` `onboarding` | `tenant_onboarding` (3) `studio_registrations` | — | ✅ | ✅ | ✅ | 🟡 |
| 49 | **Auth** | `/auth/login` `/auth/signup` `/auth/forgot-password` | 🟢 ACTIVE | Supabase Auth wrapper | `LoginPage` `SignupPage` `ForgotPasswordPage` | `auth` | `users_profile` | — | ✅ | ✅ | ✅ | ✅ |
| 50 | **AI Studio Brief / AI Editorial** | inline | 🟢 ACTIVE | AI co-writer for briefs and editorial | (embedded) | `ai_studio_brief` `ai_editorial` | `project_ai_briefs` `ai_assist_logs` | Emergent LLM Key | ✅ | ✅ | ✅ | ✅ |
| 51 | **Calendar Hub** | `/workspace/calendar` | 🔵 MVP-LITE | Placeholder → real flow lives in Editorial Calendar | `CalendarHub` (MvpLitePage) | — | — | — | — | ✅ | ✅ | ❌ |
| 52 | **Activity Hub** | `/workspace/activity` | 🔵 MVP-LITE | Placeholder → real flow in Dashboard Pulse | `ActivityHub` (MvpLitePage) | — | — | — | — | ✅ | ✅ | ❌ |
| 53 | **Messages Hub** | `/workspace/messages` | 🔵 MVP-LITE | Placeholder → real flow in Client Portal messages | `MessagesHub` (MvpLitePage) | — | `client_messages` (10) | Client Portal | — | ✅ | ✅ | ❌ |
| 54 | **Reports Hub** | `/workspace/reports` | 🔵 MVP-LITE | Placeholder → no real flow yet | `ReportsHub` (MvpLitePage) | — | — | — | — | ✅ | ✅ | ❌ |
| 55 | **Integrations Hub** | `/settings/integrations` | 🔵 MVP-LITE | Placeholder for future API/SaaS connections | `IntegrationsHub` (MvpLitePage) | — | — | — | — | ✅ | ✅ | ❌ |
| 56 | **Collections Hub** | `/library/collections` | 🔵 MVP-LITE | Placeholder → real flow in Inspirations/collections | `CollectionsHub` (MvpLitePage) | — | — | Inspirations | — | ✅ | ✅ | ❌ |
| 57 | **Demo** | (internal) | 🟢 ACTIVE | Demo seeder | — | `demo` | — | — | — | — | ✅ | ✅ |
| 58 | **Storage** | (internal) | 🟢 ACTIVE | Supabase Storage helper API | — | `storage` | — | — | — | — | ✅ | ✅ |
| 59 | **Human Assignment** | (internal) | 🟡 PARTIAL | Routing review tasks to humans | — | `human_assignment` | `human_assignments` `human_assignment_events` | — | — | — | ✅ | 🟡 |
| 60 | **Profile** | (account drawer) | 🟢 ACTIVE | User profile edit | — | `profile` | `users_profile` | Auth | ✅ | ✅ | ✅ | ✅ |

> **Note**: Tables with **0 rows** = either feature is shipped-but-unused or backend-ready-but-frontend-incomplete. Tables marked SEED ONLY = the surface only renders demo content.

---

## 2. GROUPING BY DOMAIN

### 🎬 DESIGN JOURNEY™ — heart of the platform · 🟢 ACTIVE

| Milestone (10 default) | Module wiring | UI flavour | Status |
|---|---|---|---|
| **Brief** | inline modal/collector | dialogue | 🟢 dialogue-only |
| **Inspirations™** | navigates → `/inspirations` | standalone module | 🟢 ACTIVE |
| **Moodboard Direction™** | navigates → `/moodboards` + Step Workspace (custom) | standalone + step | 🟢 ACTIVE |
| **Material Direction™** | navigates → `/inspirations/materials` + Step Workspace (custom) | standalone + step | 🟢 ACTIVE |
| **Concept Design™** | navigates → `/workspace/projects` | (none of its own) | 🟠 generic placeholder in Step Workspace |
| **Technical Package™** | navigates → `/workspace/projects` | (none of its own) | 🟠 generic |
| **Curated Selections™** | navigates → `/inspirations` | (none of its own) | 🟠 generic |
| **Site Evolution™** | inline collector | placeholder OnboardingPage | 🔵 MVP-LITE |
| **Presentazione Finale** | navigates → `/inspirations` (wrong!) | should be Moodboard/Client Preview | 🟠 mis-routed |
| **Chiusura Certificata** | inline ceremony | JourneyClosureCeremony | 🟡 PARTIAL |

**Backend**: `design_journey`, `journey_pulse`, `journey_step_workspace`, `journey_initiate`, `journey_closure`, `milestone_dialogue`, `site_evolution`.

**Real-life data**: 180 journeys · 1780 milestones · 633 timeline events · 304 artifacts · 111 feedback rows. **PRODUCTION-READY.**

---

### 👥 CRM / RELATIONSHIP — 🟢 ACTIVE

| Sub-module | Status |
|---|---|
| **Accounts** (B2C/B2B/atelier) | 🟢 250 rows · multi-tab UI · Constellation graph |
| **Contacts** | 🟢 247 rows · accounts_team_members |
| **Voice Log** | 🟢 voice recorder · transcription |
| **Memory / Intelligence** | 🟢 relationship_affinities, lookups, engagement_signals |
| **Relationship Timeline** | 🟢 interactions table |
| **Notes** | 🟡 project_notes (2 rows) — UNDER-USED |
| **Tasks** | 🟡 tasks (7 rows) — UNDER-USED |
| **Leads** | 🟢 80 leads |
| **Cultural Editions** (account-attached) | 🟢 22 drafts |

**Backend**: `relationships`, `crm_voice_notes`, `crm_intelligence`, `g3_constellation`.

---

### 📰 CONTENT STUDIO — 🟢 ACTIVE (core) · 🟡 PARTIAL (queue)

| Sub-module | Status |
|---|---|
| **Editorial Studio** (4-rail composition) | 🟢 ACTIVE — 165 masters / 143 variants |
| **Editorial Calendar** | 🟡 PARTIAL — calendar view yes, scheduling shallow |
| **Magazine (Tenant editor)** | 🟡 PARTIAL — 0 posts in magazine_posts, 165 in editorial_masters |
| **Design Stories** | 🔵 MVP-LITE — placeholder, lives inside Magazine |
| **Publishing Queue** | 🟡 PARTIAL — variant approval inbox exists |
| **Market Matrix** | 🟢 ACTIVE — 14 markets w/ cultural/narrative/positioning profiles |
| **Web Presence (Storefront)** | 🟡 PARTIAL — band editors, 20 cms_pages |

**Backend**: `editorial`, `editorial_variants`, `editorial_calendar`, `magazine`, `cultural_editions`, `storefront`, `pages`, `ai_editorial`.

---

### 🏛️ STUDIO OS — 🟢 ACTIVE (mostly)

| Sub-module | Status |
|---|---|
| **Team** (Members + invites) | 🟢 53 memberships, 1 invite outstanding |
| **Insights** | 🟡 PARTIAL — wiring incomplete |
| **Studio Identity** (Brand) | 🟢 ACTIVE — logo/palette/voice |
| **Forms & Journeys** | 🟢 ACTIVE — public lead intake works |
| **Integrations** | 🔵 MVP-LITE — placeholder |
| **Billing / Plan** | 🟡 PARTIAL — license view, no Stripe |
| **Domains** | 🟢 ACTIVE — custom domain wiring |
| **Languages / i18n** | 🟢 ACTIVE — 7 locali · Command Center · MISS 0 LEAK 0 |
| **Atelier Dashboard Admin** | 🟢 ACTIVE — hero/sections/quotes/media |

---

### 🌍 CURATORIAL ATLAS — 🟢 ACTIVE (heavy)

| Sub-module | Status |
|---|---|
| **Inspirations** (saved refs + boards) | 🟢 57 saved, 5 boards |
| **Brand Atlas** (brand mode) | 🟢 ACTIVE |
| **Material View / Registry** | 🟢 9 materials curated |
| **Media Library** | 🟢 130 media items |
| **Atelier Media Direction™** (new ITER138) | 🟢 ACTIVE — 16 tenant-owned cinematic assets |
| **Cultural Editions** | 🟢 22 drafts |
| **Supplier Catalogs** (import) | 🟡 PARTIAL — import modal works |

---

### 👤 CLIENT PORTAL — 🟢 ACTIVE

| Sub-module | Status |
|---|---|
| Client Companion (read-only of journey) | 🟢 |
| Client Messages | 🟡 10 messages — light |
| Client Preview (token) | 🟢 ACTIVE |
| Review Mode (shareable) | 🟢 ACTIVE |
| Collab (versions/comments) | ⚪ 0 versions, 0 comments — schema only |

---

### 💼 ADVISOR NETWORK — 🟡 PARTIAL

2 advisor profiles, 0 referrals. Schema-rich (7 tables) but real-world usage is minimal. **Defer to P2**.

---

## 3. ROLE ACCESS MATRIX

Roles found in code: `super_admin`, `tenant_owner`, `tenant_admin`, `studio_manager`, `designer`, `project_manager`, `sales_advisor`, `editorial`, `viewer`, `client`, `advisor`.

| Domain | super_admin | tenant_owner | tenant_admin | studio_manager | designer | project_manager | sales_advisor | editorial | viewer | client | advisor |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Atelier Dashboard** | ✅ manage | ✅ manage | ✅ manage | ✅ manage | 👁️ read | 👁️ read | 👁️ read | 👁️ read | 👁️ read | ❌ | ❌ |
| **Atelier Dashboard Admin** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Atelier Media Direction** | ✅ | ✅ | ✅ | ❌ | ✅ write | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Design Journey** | ✅ | ✅ | ✅ | ✅ | ✅ write | ✅ write | 👁️ | 👁️ | 👁️ | 👁️ own | ❌ |
| **Step Workspace** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ | 👁️ | 👁️ | 👁️ own | ❌ |
| **Projects** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ | 👁️ | 👁️ | 👁️ own | ❌ |
| **CRM Accounts** | ✅ | ✅ | ✅ | ✅ | 👁️ | ✅ | ✅ write | 👁️ | 👁️ | ❌ | ❌ |
| **Leads** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Voice Notes / Memory** | ✅ | ✅ | ✅ | ✅ | 👁️ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Proposals** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | 👁️ | 👁️ own | ❌ |
| **Moodboards** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ | 👁️ | 👁️ | 👁️ own | ❌ |
| **Inspirations / Library** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ | 👁️ | 👁️ | ❌ | ❌ |
| **Editorial Studio** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ write | 👁️ | ❌ | ❌ |
| **Editorial Calendar** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | 👁️ | ❌ | ❌ |
| **Cultural Editions** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | 👁️ | ❌ | ❌ |
| **Magazine (admin)** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | 👁️ | ❌ | ❌ |
| **Brand Studio** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Markets / International** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Brand Voice / Studio Voice** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Language Command Center** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Insights** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | 👁️ | ❌ | ❌ | ❌ |
| **Settings** (team / domains / forms / plan) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Client Portal** | ✅ | ✅ | ✅ | ✅ | 👁️ | ✅ | ✅ | ❌ | ❌ | ✅ own | ❌ |
| **Advisor Dashboard** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ own |
| **Super Admin** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> **Gap detected**: real `tenant_memberships` table has `role` column but enforcement in routers is **inconsistent**. Many endpoints check `super_admin/tenant_admin/owner/designer` only — `project_manager`, `sales_advisor`, `editorial`, `viewer` are partially honored. The role enum is documented but **not consistently enforced** across the 77 routers.

---

## 4. DESIGN JOURNEY REAL FLOW — what each step actually does today

Default journey = 10 milestones (`backend/routers/design_journey.py:56`).

| # | Milestone | `open_mode` | What it does TODAY | What it should be |
|---|---|---|---|---|
| 1 | Brief Cliente | `inline` | Dialogue + AI brief writer ✅ | ✅ keep dialogue + lightweight modal |
| 2 | Inspirations™ | `navigate → /inspirations` | Full standalone module (1+57+5+9 entities) ✅ | ✅ standalone — already correct |
| 3 | Moodboard Direction™ | `navigate → /moodboards` + Step Workspace | Full editor (309 moodboards) + custom step UI ✅ | ✅ standalone + step — correct |
| 4 | Material Direction™ | `navigate → /inspirations/materials` + Step Workspace | Material View page + custom step UI ✅ | ✅ standalone + step — correct |
| 5 | Concept Design™ | `navigate → /workspace/projects` | Just opens Project Detail page · 🟠 no step body | ❌ Should become **collector** (timeline of render/drawings dropped into journey artifacts) OR open a **modal upload + caption** — NOT a standalone module |
| 6 | Technical Package™ | `navigate → /workspace/projects` | Same as Concept Design 🟠 | ❌ Should be a **document drawer modal** (upload + version stack) — NOT standalone |
| 7 | Curated Selections™ | `navigate → /inspirations` | Re-opens Inspirations 🟠 | ❌ Should be a **per-journey reference shortlist drawer**, not a re-open of Inspirations |
| 8 | Site Evolution™ | `inline` | MvpLitePage placeholder 🔵 | ✅ Should be a **photo collector** anchored on the timeline — lightweight, NOT a module |
| 9 | Presentazione Finale | `navigate → /inspirations` ⚠️ | Wrongly opens Inspirations 🟠 | ❌ Should open the **Client Preview / Public Presentation** of moodboards. Mis-routed today |
| 10 | Chiusura Certificata | `inline` | JourneyClosureCeremony component exists 🟡 | ✅ Stays inline ceremony — keep as is |

### Verdict
- **3 milestones** (Inspirations, Moodboard, Material) — correctly standalone modules ✅
- **2 milestones** (Brief, Chiusura) — correctly inline/dialogue ✅
- **5 milestones** (Concept, Technical, Curated, Site Evolution, Final) — should become **artifact collectors** (drawers + timeline events) NOT new modules

> **The biggest overengineering risk is here**: do NOT build "Concept Design Studio" or "Technical Package Manager" as standalone routes. They are **collectors of files + captions** dropped into `journey_artifacts` and rendered in the Step Workspace.

---

## 5. DUPLICATION / CHAOS DETECTION

### 🔄 Duplicate / overlapping modules
| Area | Duplicates | Recommendation |
|---|---|---|
| **Moodboards** | `moodboards` + `moodboards_v1` routers · both mounted at `/moodboards` | Pick one. v1 is the older block-based; the canonical is `moodboards.py`. Retire v1. |
| **Inspirations** | `inspirations_items` (1 row) + `saved_references` (57 rows) + `design_references` + `reference_collections` (5) | Three competing reference tables. `inspirations_items` is effectively dead — collapse into `saved_references`. |
| **Magazine** | `magazine_posts` (0) vs `editorial_masters` (165) vs `journal_articles` vs `magazine_articles` | Four competing article models. Editorial Studio is the canonical one. Retire `journal_*` and `magazine_*`-only tables. |
| **Client Messages vs Collab** | `client_messages` (10) + `collab_comments` (0) | Pick one. `client_messages` is in use; `collab_*` is a parallel stack with 0 rows. Mark collab as deferred. |
| **CMS Pages vs Magazine** | `cms_pages` (20) + `journal_*` | Storefront uses cms_pages; magazine is editorial_masters. The journal_* family is unused. |
| **Hubs** (6 routes) | `/workspace/calendar` `/workspace/activity` `/workspace/messages` `/workspace/reports` `/settings/integrations` `/library/collections` | All MvpLitePage placeholders. Keep them as graceful pointers OR remove from sidebar entirely until built. |
| **Dashboards** | `/dashboard` (Atelier) + `/dashboard/legacy` (old) + `/dashboard/pulse` (alt) | Three dashboards. Only Atelier is current. Retire `/dashboard/legacy`. `/dashboard/pulse` is alias of Atelier. |

### 🚪 Useless / mis-routed routes
- `/dashboard/legacy` — retire
- `/workspace/leads`, `/workspace/clients`, `/workspace/team`, `/workspace/relationships`, `/brand-atlas/*` → all redirect to canonical routes. Redirects are OK but increase cognitive load.
- `/workspace/references` redirects to `/inspirations` — OK
- The 10th milestone "Presentazione Finale" routes to `/inspirations` — **mis-routed** (should be Client Preview)

### 🧱 Redundant components
- `ComingSoonPage` (×2 versions in `/common` and `/placeholder`) + `MvpLitePage` — three placeholder components. Pick MvpLitePage as canonical (which is the chosen one already).
- `OnboardingPlaceholderPage` used for journey step placeholders — could be folded into MvpLitePage with variants.

### 🎬 Cinematic-only partially propagated
The DNA v2 frozen visual system is propagated across Dashboard, Workspace, CRM, Inspirations, Atlas, Settings, Admin, Editorial Studio, Storefront. **Partially propagated** still:
- Forms Builder
- Plan/Billing
- Onboarding ritual
- Insights page
- Advisor Network admin
- Some modal/drawer components in CRM

### 🌍 Localization inconsistency
- Dashboard pulse fields ALE-aware ✅ (ITER139 P0)
- Journey detail / timeline ALE-aware ✅ (ITER139 P0)
- CRM `relationship_actions`, `tasks`, `project_notes` — **NOT YET** ALE-aware → P1
- Editorial masters/variants — source_locale logic exists but mixed usage
- Magazine posts long-form — no source_locale honored
- Client messages — no ALE; relies on `message_translations` which is sparse

### 🔐 Permissions gaps
- Role enum is rich (10 roles) but enforced inconsistently across 77 routers
- Many endpoints only check `super_admin/tenant_admin/owner/designer` and ignore the rest
- Client-facing endpoints rely on token-based access (preview_tokens), not role-based — good
- Advisor endpoints check advisor profile_id matching but don't gate writes properly

---

## 6. DEVELOPMENT PRIORITY MAP

### 🔴 P0 — CORE OPERATIVO (must-have for honest MVP — ship in next 2 sprints)

| # | Action | Why |
|---|---|---|
| 1 | **Wire CRM ALE on-read** for `relationship_actions`, `tasks`, `project_notes` (ITER139 P1) | Mixed-language leak on CRM tabs |
| 2 | **Fix Milestone #9 mis-route** (`final_presentation`) → Client Preview, not Inspirations | Broken UX |
| 3 | **Implement collectors** for milestones 5-8 (Concept · Technical · Curated · Site Evolution) — drawer modal + journey_artifacts timeline · NO new modules | Avoid ERP bloat |
| 4 | **Enforce role permissions consistently** — central `require_role([...])` dependency reused across all routers | Security gap |
| 5 | **Retire dead routes**: `/dashboard/legacy`, `moodboards_v1`, redirect-only stubs from sidebar | Cognitive load reduction |
| 6 | **Wire Media picker** in Hero/Quote/Project Card/Mobile Blocker — bridge ITER138 atelier media to consumption surfaces | Complete the media orchestration |
| 7 | **Consolidate references tables**: collapse `inspirations_items` (1 row) into `saved_references` (57 rows) | DRY data layer |
| 8 | **Consolidate article tables**: confirm `editorial_masters` is canonical; deprecate `journal_*` & `magazine_*` v1 tables | DRY data layer |
| 9 | **Onboarding ritual completion** (ITER140 → ITER141 Atelier Initialization™) — emotional new-tenant flow | Critical first impression |
| 10 | **DNA v2 propagation finish**: Forms Builder, Plan, Insights, Onboarding | Cinematic consistency |

### 🟡 P1 — EXPERIENCE LAYER (raffinamento UX/editorial/cinematic — next 1 quarter)

| # | Action | Why |
|---|---|---|
| 11 | Editorial Calendar → real scheduling UX (drag-drop) | Already 50% built |
| 12 | Magazine editor → use `editorial_masters` as backing store | Drop competing models |
| 13 | Cultural Editions → smoother review flow + AI-suggested cultural deltas | Differentiator |
| 14 | Insights → fill the dashboard with real analytics (analytics_events × tenant_activity_events already exist) | Tabella già popolata, manca solo UX |
| 15 | Client Portal companion → richer Design Journey™ readable view | Existing data, weak UX |
| 16 | Notifications drawer → real-time websocket | Currently polled |
| 17 | Voice Notes → cross-account memory search | Differentiator |
| 18 | Source_locale long-form coverage (magazine_posts, proposals, cms_pages) per ITER139 strategy C | Deep i18n |
| 19 | Plan/Billing → Stripe integration | Revenue gating |
| 20 | Brief AI → multi-turn refinement memory | Editorial co-author |

### 🟣 P2 — EXPANSION (future · keep on the shelf)

| # | Action | Why |
|---|---|---|
| 21 | Advisor Network → real referral lifecycle (currently 0 referrals) | Defer until 10+ studios live |
| 22 | Market Intelligence dashboard with real signals | Defer until data engine seeds it |
| 23 | Integrations Hub (Slack, Google Calendar, Notion) | Defer until pull from users |
| 24 | Reports Hub | No clear pull yet |
| 25 | Collab versioning (collab_versions table) | Premature for studio-size MVP |
| 26 | Supplier catalogs · auto-import | Niche |
| 27 | Form Builder → drag-drop visual editor | Nice-to-have |
| 28 | Public site theme variants beyond current | Nice-to-have |
| 29 | Magazine v2 (separate from Editorial Studio) | Only if Editorial Studio breaks at scale |
| 30 | Advisor commission engine (`advisor_commission_periods`) | Wait for revenue events |

---

## 7. FINAL RECOMMENDATION

### ❌ Do NOT build as standalone modules
- **Concept Design Studio** — collector inside Design Journey
- **Technical Package Manager** — file drawer inside Design Journey
- **Curated Selections module** — per-journey shortlist drawer (uses Inspirations under the hood)
- **Site Evolution module** — photo timeline collector on `journey_timeline_events`
- **Calendar Hub / Activity Hub / Messages Hub / Reports Hub / Integrations Hub / Collections Hub** — none of these deserve dedicated workspaces; either route to existing canonical modules or remove from sidebar
- **Magazine v2** — Editorial Studio IS the magazine
- **Collab versioning surface** — premature; client_messages covers the need
- **Advisor commission engine** — defer until real referrals flow

### 💡 Use modal lightweight where
- Brief intake / refinement
- File upload drawer for Concept/Technical/Curated
- Site Evolution photo drop
- Stage change in CRM
- Cultural edition trigger
- Asset picker (already implemented)

### 📜 Use timeline collector where
- All artifact-generating milestones (5-8) → write to `journey_artifacts` + `journey_timeline_events`
- Voice notes / CRM activities → `interactions`
- Project status changes → `project_status_history`

### 🏢 Use dedicated workspace where
- **Design Journey™ tab** — the heart, already correct
- **Step Workspace** for Moodboard + Material — already correct
- **Inspirations / Atlas** — already correct
- **Editorial Studio** — already correct
- **CRM Accounts** — already correct
- **Atelier Dashboard Admin** + **Atelier Media Direction** — already correct
- **Language Command Center** — already correct

### 🚨 Overengineering hotspots
1. **77 backend routers** for ~30 truly active modules — many to be merged
2. **155 DB tables** — at least 25 are duplicate/competing (references, articles, magazine, hubs)
3. **161 frontend routes** of which 6 are MVP-Lite placeholders + 7 are pure redirects
4. **Advisor Network** entire stack (8 tables, 4 routers) for 2 profiles · 0 referrals
5. **Collab vs Client Messages** — pick one
6. **Magazine vs Editorial Masters vs Journal** — pick one (Editorial Masters)
7. **Inspirations Items vs Saved References vs Design References vs Reference Collections** — collapse to two: `saved_references` (atomic) + `reference_collections` (groups)

### ⭐ Truly differentiating (don't dilute)
1. **Atelier Nordic™ DNA v2** — the cinematic frozen visual system
2. **Design Journey™** with milestone dialogue + ALE-aware timeline
3. **Editorial Studio** 4-rail composition + Cultural Editions per market
4. **ALE multi-source-language orchestration** (ITER139) — invisible engine
5. **Atelier Media Direction™** (ITER138) — luxury asset composer
6. **Studio Voice + Brand Voice** adapters — the editorial DNA
7. **Language Command Center** — the i18n cockpit (MISS 0 LEAK 0)

---

## 🎯 STRATEGIC POSTURE

MOOD for DESIGN™ is **already feature-complete enough** for a 30-studio MVP launch. The gap is **NOT new modules** — it's **consolidation, propagation, and execution polish**.

**Next 90 days should be**:
1. Retire duplicates (P0 items 7-8)
2. Polish the 30 modules already active (DNA v2 propagation finish)
3. Wire ALE everywhere it leaks (P0 item 1, P1 item 18)
4. Build ITER141 Atelier Initialization™ as the emotional first-impression ritual
5. **Reject** every request for "a new module" — answer should be "where in the existing journey does this fit?"

**The platform is a luxury operational instrument, not an ERP. Defend the silence.**

— ITER140 Platform Capability Audit · 23 Feb 2026
