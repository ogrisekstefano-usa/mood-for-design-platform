# Frontend Runtime Audit™
**Date:** 18 Feb 2026
**Status:** P0 BLOCKER — Zero Hardcoded Policy enforcement pending
**Author:** E1 (forked job)
**Scope:** `/app/frontend/src` public storefront surfaces

> Following directive: *"STOP ADDING FEATURES. The platform must feel **architected, not accumulated**."*

This audit is the **single source of truth** for what's runtime-bound vs hardcoded. No new feature can begin until the **Action Required** column shows 0 P0 items.

---

## 1 · Public Routes Inventory

### A. Legacy global routes (NO locale prefix)
| Path                       | Component                  | Status     | Editable in Blueprint?       |
|----------------------------|----------------------------|------------|------------------------------|
| `/`                        | `HomePage`                 | DUPLICATE  | ✅ (Storefront Studio · Home) |
| `/projects`                | `ProjectsIndexPage`        | DUPLICATE  | ✅ (Projects Studio)         |
| `/projects/:slug`          | `SiteProjectDetailPage`    | DUPLICATE  | ✅ (Projects Studio variants)|
| `/onboarding/:kind`        | `OnboardingPlaceholderPage`| 🔴 PLACEHOLDER | ❌ hardcoded               |
| `/professionals`           | `ProfessionalsGatewayPage` | 🔴 HARDCODED   | ❌ hardcoded               |
| `/start-project`           | `StartProjectWizard`       | 🔴 HARDCODED   | ❌ hardcoded               |
| `/magazine`                | `MagazinePage`             | DUPLICATE  | ⚠️ partial (Editorial Studio)|
| `/magazine/:slug`          | `MagazineArticlePage`      | DUPLICATE  | ⚠️ partial                  |
| `/professionals/intake`    | `ProfessionalIntakePage`   | 🔴 HARDCODED   | ❌ hardcoded               |
| `/form/:slug`              | `LeadFormPage`             | ✅          | ✅ (Forms admin)             |

### B. Per-locale routes (6 locali × 4 paths = 24 routes)
Locali: `/it-IT/`, `/en-US/`, `/en-GB/`, `/es-ES/`, `/fr-FR/`, `/de-DE/`
Path: `/`, `/projects`, `/projects/:slug`, `/professionals`

→ **Verdict**: pulito strutturalmente ma `professionals` punta a `ProfessionalsGatewayPage` hardcoded.

### C. Magazine per-locale routes (manuali, 6 locali × 2 = 12 route)
Stesso pattern di B ma DEFINITE ESPLICITAMENTE per ogni locale invece di passare per `SiteLayout`.

→ **Action**: collassare dentro `SiteLayout` per allinearli alla pattern delle altre pagine.

---

## 2 · Public Section Sources

| Surface                  | Runtime DB-driven                                    | Hardcoded fallback           | Editable in Blueprint?                            | Action Required |
|--------------------------|------------------------------------------------------|------------------------------|---------------------------------------------------|-----------------|
| Header brand logo + name | ✅ `branding_settings.public_brand_name_i18n`        | ⚠️ `tenant.js`               | ✅ Brand Studio (multilingue)                     | none            |
| Header tagline           | ✅ `branding_settings.tagline_i18n`                  | ⚠️ none                      | ✅ Brand Studio                                   | none            |
| Header nav links         | ✅ `cms_sections.nav_top` + positioning override     | ⚠️ `navigation.js` linkset   | ⚠️ DB ma NESSUNA UI Storefront Studio renderer     | 🔴 Build editor |
| Header lang switcher     | ✅ `tenant_markets` attivi                            | none                         | ✅ International Presence                          | none            |
| Header ACCEDI CTA        | ⚠️ hardcoded label                                    | ⚠️ `navigation.js`           | ❌                                                | 🟡 To i18n      |
| Hero (title/eyebrow/sub) | ✅ `cms_sections.store_hero.locale_content`          | ⚠️ `homepage.js` FALLBACK     | ✅ Storefront Studio · Home                       | 🟡 Remove fallback |
| Hero background          | ✅ `cms_sections.store_hero.settings.background_*`   | ⚠️ `homepage.js`             | ✅                                                | 🟡 Remove fallback |
| USP / Value Props        | ✅ `cms_sections.value_props`                        | ⚠️ `homepage.js`             | ✅                                                | 🟡 Remove fallback |
| Projects rail            | ✅ portfolio variants endpoint                       | ⚠️ `homepage.js` items       | ✅ Projects Studio                                 | 🟡 Remove fallback |
| Stats band               | ⚠️ DB section exists but NO frontend renderer        | ⚠️ `homepage.js`             | ⚠️ DB ma NO Storefront Studio editor              | 🔴 Build both    |
| Brand logos              | ⚠️ DB section exists but NO frontend renderer        | ⚠️ `homepage.js`             | ⚠️ stesso                                          | 🔴 Build both    |
| Magazine grid (home)     | ⚠️ DB section exists but NO frontend renderer        | ⚠️ `homepage.js`             | ⚠️ stesso                                          | 🔴 Build both    |
| Newsletter / dual CTA    | 🔴 FRONTEND HARDCODED ONLY                            | ✅ `homepage.js`             | ❌                                                | 🔴 Migrate to DB |
| Footer columns           | ✅ `cms_sections.footer_columns.settings`            | ⚠️ `navigation.js` columns   | ⚠️ DB ma NO Storefront Studio editor              | 🔴 Build editor  |
| Footer showroom block    | ✅ stesso                                             | ⚠️ `navigation.js` showroom  | ⚠️ stesso                                          | 🔴 Build editor  |
| Footer socials           | ✅ stesso                                             | ⚠️ `navigation.js` socials   | ⚠️ stesso                                          | 🔴 Build editor  |
| Footer Blueprint OS row  | 🔴 FRONTEND HARDCODED                                 | ✅ inline jsx                | ❌                                                | 🟡 keep as platform signature OR migrate |
| Footer privacy/terms     | ⚠️ in `footer_columns` se `legal` colonna pubblicata | ⚠️ in `navigation.js`        | ⚠️ stesso                                          | 🔴 Build editor  |
| Projects listing         | ✅ `/api/portfolio/public/*/projects`                | ⚠️ `projects.js` quando 0    | ✅ Projects Studio                                 | 🟡 Hide when empty + editorial empty state |
| Project detail           | ✅ variant endpoint                                  | ⚠️ `projects.js`             | ✅                                                | 🟡 Remove fallback |
| Project filter categories| 🔴 hardcoded `projectCategories` from `projects.js`   | ✅                            | ❌                                                | 🔴 Derive from variants |
| Project final CTA verbs  | ✅ positioning runtime + variant `cta_set`           | ⚠️ `ui.js`                   | ⚠️ indirect (positioning mode)                     | 🟡 OK · 3-CTA model pending |
| Project related          | ✅ runtime variants in same locale                   | none                         | ✅                                                | none            |
| Magazine listing         | ⚠️ partial DB                                         | ⚠️ `ui.js` labels            | ⚠️ Editorial Studio (master direction yes, variant publish UI incomplete) | 🔴 Finish Editorial Studio market publish + bind public |
| Magazine detail          | ⚠️ partial DB                                         | ⚠️ `ui.js`                   | ⚠️ stesso                                          | 🔴 stesso        |
| Professionals gateway    | 🔴 FULLY HARDCODED `professionals.js`                 | ✅                            | ❌                                                | 🔴 either delete route OR build Blueprint editor |
| Professional intake form | 🔴 FULLY HARDCODED `professionals.js`                 | ✅                            | ❌                                                | 🔴 stesso        |
| Start project wizard     | 🔴 FULLY HARDCODED `onboarding.js` + `onboardingGraph.js` | ✅                       | ❌                                                | 🔴 either delete OR build Blueprint editor for the onboarding graph |
| Onboarding placeholder   | 🔴 PLACEHOLDER (no content)                           | ✅                            | ❌                                                | 🔴 delete route or replace |

---

## 3 · Hardcoded Files Inventory (`/app/frontend/src/site/content/`)

| File                  | Size | Used by                                                                                    | Verdict                                                            |
|-----------------------|------|--------------------------------------------------------------------------------------------|--------------------------------------------------------------------|
| `tenant.js`           | 22 LOC | All site pages (`tenantConfig.slug`)                                                       | ✅ KEEP — bootstrap config (tenant slug)                            |
| `languages.js`        | ~80 LOC | LocaleHead, language picker, ui                                                            | ✅ KEEP — UI catalog of supported locales (not editorial content)   |
| `ui.js`               | ~? LOC | Many pages (eyebrow, button labels, archive titles)                                        | ⚠️ EVALUATE — i18n UI strings, NOT content. Can be moved to backend `markets.ui_strings` later. For now KEEP as i18n. |
| `navigation.js`       | ~120 LOC | SiteHeader/Footer fallbacks                                                                | 🔴 ELIMINATE after Storefront Studio editor exists                  |
| `homepage.js`         | ~? LOC | HomePage FALLBACK                                                                          | 🔴 ELIMINATE after every home section has DB editor + content       |
| `projects.js`         | ~? LOC | ProjectsIndexPage fallback + ProjectDetailPage fallback + filter categories                | 🔴 ELIMINATE after empty-state design + DB-driven categories         |
| `professionals.js`    | ~? LOC | ProfessionalsGatewayPage + ProfessionalIntakePage                                         | 🔴 ELIMINATE — either delete routes OR Blueprint editor             |
| `onboarding.js`       | ~? LOC | OnboardingPlaceholderPage                                                                  | 🔴 ELIMINATE — replaced by `/start-project/{private|professional}` |
| `onboardingGraph.js`  | ~? LOC | StartProjectWizard                                                                         | 🔴 ELIMINATE — backend "Onboarding Graph" entity to design          |

---

## 4 · Duplicate/Ghost Pages

| Page A                                      | Page B                                          | Action |
|---------------------------------------------|-------------------------------------------------|--------|
| `/pages/settings/StorefrontPage.jsx`        | `/pages/settings/StorefrontStudio.jsx` (alias?) | 🔴 Check, delete duplicate |
| `/pages/storefront/StorefrontStudioPage.jsx` | `/pages/settings/StorefrontStudio.jsx`         | 🔴 Likely one shadow — verify, keep only the cinematic one |
| Global `/projects` + locale `/it-IT/projects` etc. | Same component                            | ✅ INTENTIONAL — locale routing pattern |
| Global `/magazine` routes manually duplicated 6×    | Should pass through `SiteLayout`                | 🟡 Refactor to remove copy-paste |

---

## 5 · Blueprint Traceability Gaps

Every public surface needs a clear "Controls public section: X" label inside the Blueprint admin.

| Public section          | Blueprint admin entry           | Traceability label shown? |
|-------------------------|---------------------------------|---------------------------|
| Header brand            | `/settings/brand-studio`         | ⚠️ implicit, no label     |
| Header nav links        | `/blueprint/storefront` → Navigation tab | 🔴 NO admin renderer for `nav_top` |
| Hero                    | `/blueprint/storefront` → Home → Store Hero | ✅ has editor          |
| USP / Value Props       | `/blueprint/storefront` → Home → Value Props | ✅ has editor         |
| Projects rail title     | `/blueprint/storefront` → Home → Projects Preview | ⚠️ title only, items from Projects Studio |
| Projects (master+variants) | `/blueprint/projects-studio`  | ✅                        |
| Stats / Brand logos / Magazine grid | `/blueprint/storefront` → Home | 🔴 NO renderer       |
| Newsletter / Dual CTA   | nessuno                          | 🔴 NO admin entry         |
| Footer (columns/showroom/socials) | `/blueprint/storefront` → Navigation | 🔴 NO renderer  |
| Magazine                | `/blueprint/editorial`           | ⚠️ master direction yes; variant publish workflow incomplete |
| Onboarding              | nessuno                          | 🔴 NO admin entry         |
| Professionals           | nessuno                          | 🔴 NO admin entry         |

---

## 6 · Recommended Cleanup Sequence (3 batch · No new features)

### 🔴 BATCH 1 — Storefront Studio admin renderers (eliminates 60% of hardcoded fallback)
- Implement renderers for: `nav_top`, `footer_columns`, `stats_band`, `brand_logos`, `magazine_grid`, `newsletter`, `dual_cta` in `StorefrontStudioPage.jsx`.
- For each: cinematic editor matching the existing Hero/USP editors (locale tabs · settings panel · publish state).
- Once published, **frontend reads ONLY DB** (delete the `homepage.js` / `navigation.js` fallback paths).

### 🔴 BATCH 2 — Magazine pipeline parity with Projects
- Backend: already exists (`editorial.py`) but verify endpoints match Projects pattern (`master / variants / publish-per-locale`).
- Frontend Editorial Studio: complete the Market Editions tab with publish workflow (currently incomplete).
- Public: bind `MagazinePage` + `MagazineArticlePage` to `/api/magazine/public/{slug}/articles?locale_code=` AND `cta_set` per variant. Delete `ui.js` magazine labels in favor of editorial copy from DB.

### 🔴 BATCH 3 — Onboarding / Professionals / Start Project decision
Three options, user picks one:
- **(a) DELETE** these routes (clean cut). The 3-CTA model on Project Detail then points to `/contact` (single form) only. Onboarding becomes a future epic.
- **(b) BUILD MVP-lite**: `/contact` page DB-driven + `/start-project/{private,professional}` simplified to a single lead form with positioning-aware copy.
- **(c) FULL onboarding graph admin in Blueprint** (large scope).

### 🟡 BATCH 4 — Polish
- Collapse the 12 magazine locale routes into `SiteLayout`.
- Move `ui.js` UI strings into a backend `tenants.ui_overrides_i18n` table so even button labels become tenant-editable.
- Replace `OnboardingPlaceholderPage` with a redirect.
- Add "Controls public section: X" labels in every Blueprint admin form (traceability).

---

## 7 · Hard guardrails going forward

1. **NO** new public surface without a corresponding Blueprint admin renderer.
2. **NO** new public copy without DB persistence + i18n bag.
3. **NO** new route without explicit ownership in this audit table.
4. **NO** `site/content/*` import in new code (lint rule TODO).
5. **NO** "Coming soon" / placeholder pages — either complete or hidden.

---

## 8 · Decisions needed from user before BATCH 1 starts

1. **Storefront Studio admin renderer style**: cinematic (matches current Hero/USP look) OR table-based (faster to build)?
2. **Onboarding routes** (`/onboarding/*`, `/professionals`, `/start-project`, `/professionals/intake`): which option **a/b/c** above?
3. **`ui.js` UI strings**: keep as code i18n OR migrate to DB tenant-editable (e.g. "Discover the projects" button label)?
4. **Magazine variant approval workflow**: completi UI ora oppure prima fai BATCH 1?
5. **Legacy `/pages/settings/StorefrontPage.jsx`**: ok eliminare?
