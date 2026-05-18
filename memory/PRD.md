# MOOD for DESIGN™ — Cultural Design Intelligence Operating System™

## Original Problem Statement
Multi-tenant SaaS "Design Workflow Operating System" (Blueprint OS) for interior designers, architects, retailers. Evolve into a **Cultural Design Intelligence Operating System™** with luxury Relationship CRM and multi-market, culturally-native Editorial Intelligence Engine. Public-facing storefronts must be 100% DB-driven and culturally adaptive.

**Active mandate**: ZERO HARDCODED POLICY. Every public surface must be editable from Blueprint, traceable, intentional. No new features until cleanup batches complete.

**Language**: Italian (Italiano).

## Tenancy & users
- SuperAdmin: `demo@moodfordesign.com` / `Blueprint2024!`
- Roles: `super_admin`, `tenant_admin`, `client`, `member`

## Information Architecture (Fase 0 — locked)
Blueprint sidebar canonical structure:
```
DASHBOARD
WORKSPACE      — Leads · Projects · Moodboards · References · Relationships
EXPERIENCE     — Experience Studio™
PROJECTS       — Projects Studio™ · Library · Materials · Collections
EDITORIAL      — Editorial Studio™ · Editorial Review
FORMS & JOURNEYS — Forms & Journeys™ (luxury lead architecture)
INTERNATIONAL  — International Presence™
TEAM           — Members · Insights
SETTINGS       — Tenant config · Brand · Billing · Integrations
PLATFORM       — Super Admin
```

Canonical admin routes:
- `/blueprint/experience` (canonical) — Experience Studio™
- `/blueprint/storefront` → redirects to `/blueprint/experience` (legacy alias)
- `/blueprint/projects-studio`
- `/blueprint/editorial`
- `/blueprint/forms-journeys`
- `/settings/international-presence`

## Public surface — DB-driven sections
| Surface | Section type | Editor (Experience Studio) | Status |
|---|---|---|---|
| Hero | `store_hero` | cinematic generic | ✅ |
| Value props | `value_props` | cinematic generic | ✅ |
| Dual CTA | `dual_cta` | cinematic specialized (private/professional sub-cards) | ✅ NEW |
| Stats Band | `stats_band` | cinematic specialized (KPI items array) | ✅ NEW |
| Projects rail | `projects_preview` + portfolio runtime | cinematic generic (title) | ✅ |
| Magazine Grid | `magazine_grid` | cinematic specialized (auto/manual mode + limit) | ✅ NEW |
| Brand Logos | `brand_logos` | cinematic specialized (logo cards) | ✅ NEW |
| Newsletter | `newsletter` | cinematic specialized | ✅ NEW |
| Header nav | `nav_top`/`main_links` | tabular specialized (link list + visibility + reorder) | ✅ NEW |
| Footer columns | `footer_columns` | tabular specialized (columns + links + socials) | ✅ NEW |
| Footer brand/showroom | `branding_settings` (i18n) | Brand Studio | ✅ |

Each editor displays a **"Controls public experience: X"** traceability chip.

## Completed Sessions

### Fase LIGHT-MODE-FIX (Feb 18, 2026 — current) — Editorial Paper Mode™ Restored
**P0 BLOCKER RISOLTO**: il toggle light/dark (`[data-testid="theme-switch-light"]`) ora funziona su TUTTI gli admin surface.

#### Root cause
`/design-system/os/tokens.css` definiva `[data-surface="os"] { --bp-bg: #070707; … }` con specificity più alta del `:root[data-workspace-mode="light"]` di `index.css`. Il toggle modificava `<html data-workspace-mode="light">` correttamente, ma le CSS variables venivano sovrascritte dal blocco surface-scoped.

#### Fix
Aggiunto override `:root[data-workspace-mode="light"] [data-surface="os"]` in `tokens.css` (2 attribute selectors > 1, vince specificity senza `!important`). Mantiene il pattern surface-scoped intatto, attiva Editorial Paper Mode™ (ivory `#F2ECE0`, ink `#0F0D0A`, accent verde scuro `#0D8A70`, paper grain) su tutta la chrome OS quando il toggle è light.

#### Test live PASSATO (3 screenshot)
- DARK default ✓
- LIGHT toggled — sidebar bg `rgb(242, 236, 224)`, topbar paper, cards Today's International Presence, calendar grid, Operations Intelligence sidebar tutti in modalità paper ✓
- Back to DARK ✓

### Fase OPERATIONS-CORE v3 (Feb 18, 2026) — Public Preview Drawer + Zero Confusion
**P0 UX refactor**: clicking a calendar event ora apre un drawer con la **superficie pubblica**, non il Blueprint admin.

#### Public Preview Drawer™
- Componente `PublicPreviewDrawer.jsx` accessibile da ogni event pill (sia month sia week view).
- Mostra: cover image, EDIZIONE · COUNTRY · LOCALE kicker, status chip cromatico (PUBBLICATO/PROGRAMMATO/BOZZA), titolo, excerpt, meta strutturata (pianificazione · mercato editoriale · CTA · SEO goal · approval state · URL pubblico).
- Azioni: **APRI SUL SITO PUBBLICO** (target=_blank verso `/magazine/{slug}` o `/projects/{slug}` o `/{page_key}`), **MODIFICA MARKET EDITION** (→ Editorial Studio), **RIPROGRAMMA (drag&drop)** hint, **DUPLICA PER ALTRO MERCATO**, **PUBBLICA ORA** (CTA verde solo se status≠published).
- Footer: hint "Anteprima della superficie pubblica. Tutte le azioni qui sopra rispettano la separazione UI admin · contenuto editoriale."

#### Header CTAs visibili (Zero Confusion)
- `+ NUOVO EDITORIAL MASTER` (primary) → `/blueprint/editorial?new=master`
- `+ NUOVA MARKET EDITION` (ghost) → `/blueprint/editorial?new=variant`
- `+ NUOVO PROGETTO` (ghost) → `/blueprint/projects-studio?new=1`
- Hint "Trascina sul giorno per programmare" allineato a destra.

#### Backend enrichment per drawer
- Event payload ora include `cover_url`, `excerpt`, `public_url` (separato da `edit_href`).
- Magazine: cover dal record `cover_url`, excerpt da `locale_content[locale].excerpt`.
- Project: cover da `cover_image_url`, excerpt da `location`.
- Page: cover null, public_url = `/` per home altrimenti `/{page_key}`.

#### Renames operativi
- **Editorial Review** → **Publication Review™** (Publication Review · in Italian: "Publication Review™" + subtitle "Approva i contenuti prima del rilascio pubblico").
- **Composition Room** → **Market Editions™** (Editorial Studio empty-state ora ha kicker "Editorial Operations · Magazine", titolo "Market Editions™", body "Crea versioni culturalmente native di un'unica direzione editoriale").
- Helper subtitle: "Crea versioni culturalmente native di un'unica direzione editoriale."

### Fase OPERATIONS-CORE v2 (Feb 18, 2026) — Drag&Drop + Intelligence
- **Drag & drop scheduling**: ogni event pill è `draggable`. Si trascina sulla cella di un altro giorno (mese o settimana) → `PATCH /api/blueprint/calendar/{event_id}/schedule` aggiorna:
  - `magazine_articles.published_at` + `status='scheduled'` (se non già `published`)
  - `portfolio_projects.published_at` + `status='scheduled'`
  - `cms_pages.scheduled_publish_at` + `status='scheduled'`
  Optimistic UI + toast conferma; preserva l'ora del giorno originale, cambia solo la data.
- **Weekly view**: switcher Mese/Settimana. 7 colonne lun-dom con eventi ordinati per ora. OGGI evidenziato. Drag target on column. Prev/Next salta una settimana invece di un mese.
- **Operations Intelligence sidebar** (`/api/blueprint/calendar/intelligence`):
  - Rule 1: mercato attivo senza pubblicazioni 30gg → `under-published` HIGH
  - Rule 2: SEO pressure bassa (articoli < 30% del totale) → `seo-pressure` MEDIUM
  - Rule 3: pipeline futura vuota → `empty-pipeline` HIGH
  - Rule 4: mercato primario con cadenza < 2/mese → `primary-cadence` MEDIUM
  - Rule 5: rapporto authority gap progetti pubblicati pochi → `authority-gap`
  Ogni suggestion ha severity + body + CTA deep-link verso editor appropriato. Footer indica "rule-based · evolves into AI operations layer" (Sora 2 / GPT-5.2 future integration).
- **Saturation heatmap**: celle del mese mostrano densità eventi via opacity progressiva del colore primary (1→5 eventi = scaling background).
- Test live PASSATO: month + week view + intelligence + drag&drop API verificato via curl.

### Fase OPERATIONS-CORE (Feb 18, 2026) — Editorial Calendar™ + Renames
**Nuovo cuore operativo della piattaforma**: international editorial operations system, no AI experimentation, no metaphor.

#### Editorial Calendar™ — `/blueprint/editorial-calendar`
- **Backend**: nuovo `/api/blueprint/calendar` aggrega in unico stream `magazine_articles` + `portfolio_projects` + `cms_pages` con datetime, locale, country flag, status, CTA target, SEO goal, approval state.
- **Frontend**: pagina monthly grid (42 celle) + Today's International Presence (tabella per mercato con today/scheduled/published) + stream operativo prossimi 7 giorni.
- Event pill = type-aware deep link verso editor specifico (Magazine, Projects Studio, Experience Studio).
- Filtri: all | article | project | page. Nav mese: prev/today/next.
- Test live PASSATO: tenant demo mostra 9 eventi · 2 mercati (Global + Italia) · 6 live.

#### Renames per direttiva
- "Editorial Review" → **Publishing Queue™** (sidebar `nav.publishingQueue`)
- "Composition Room" → **Market Editions™** (label sidebar `Magazine · Market Editions`)
- "Archivio" / "Library" → **Media Library™** (sidebar `nav.mediaLibrary`)
- "Ispirazioni" / "References" → **Pinterest Research Feed™** (`nav.pinterestResearch`)
- Section header "Editorial" → **Editorial Operations** (promoted to top after Dashboard)

#### Sidebar IA refactored
Nuovo ordine: Dashboard → **Editorial Operations** (Calendar · Magazine · Publishing Queue) → Workspace → Experience → Projects (+ Media Library) → Forms & Journeys → International → Team → Settings → Platform.

### Fase EMERGENCY-STABILIZATION (Feb 18, 2026) — Route Collapse + Single Render Pipeline
**P0 stabilization mode**: rollback architectural complexity. ONE frontend, ONE runtime, ONE render pipeline, ONE source of truth.

#### Route Forensics findings
- `OSWrap` (BlueprintThemeProvider) era applicato a `/magazine`, `/magazine/:slug`, 12 magazine locale-prefix routes, `/start-project`, `/professionals/intake`, `/auth/*` — questo causava il "two frontends mentally coexisting" segnalato.
- 6 blocchi locale-prefix con SiteLayout duplicavano `projects`, `projects/:slug`, `professionals` (corretto perché annidato, ma il magazine era esterno con OSWrap).
- `/blueprint/storefront` redirect + `/settings/storefront` redirect = dead aliases.
- `/blueprint/experience` aveva un sub-route `/editor` introdotto col command center.
- `ExperienceOverviewPage` era una nuova abstraction non richiesta.

#### Rollback eseguito
- **DELETED** `ExperienceOverviewPage.jsx` + `experienceOverview.css`.
- `/blueprint/experience` → torna a essere lo Storefront Studio editor direttamente.
- **DELETED** route `/blueprint/storefront` (redirect).
- **DELETED** route `/settings/storefront` (redirect).
- **DELETED** route `/blueprint/experience/editor`.
- **UNIFIED** Magazine sotto `<SiteLayout>` (rimosso OSWrap dalle 14 route magazine: 2 base + 12 locale).
- **UNIFIED** `/start-project`, `/professionals`, `/professionals/intake`, `/onboarding/:kind` sotto SiteLayout block (prima erano sparpagliati con OSWrap o duplicati).
- **ADDED** sub-route magazine ai 6 locale blocks (it-IT, en-US, en-GB, es-ES, fr-FR, de-DE) sotto stesso SiteLayout — un solo renderer.
- `OSWrap` rimane SOLO per `/auth/login`, `/auth/signup`, `/auth/forgot-password` (corretto — admin theme).

#### Broken deep-link fix
- `pages/settings/SettingsPage.jsx`: tile `tile-storefront` → `/blueprint/experience` (label "Experience Studio").
- `pages/settings/SettingsPage.jsx`: tile `tile-forms` → `/blueprint/forms-journeys`.
- `components/demo/TryPlatformCta.jsx`: redirect default → `/blueprint/experience?demo=1&step=intro`.
- `components/demo/DemoOnboardingTour.jsx`: comment updated.

#### Test PASSED end-to-end
- `/magazine` ora ha `.mfd-header` + `.mfd-footer` (SiteLayout pubblico) ✓
- `/blueprint/experience` renderizza Studio editor con 8 bande ✓
- ESLint 0 issues ✓
- Niente 404 sui main entry points (Home, Magazine, Brand Studio, Experience, Settings) ✓

### Fase 0.6 (Feb 18, 2026) — Experience Overview™ (REVERTED in stabilization)
- **NEW**: `/blueprint/experience` ora è la **command center di orchestrazione** (Experience Overview™), non più l'editor diretto.
- **NEW**: `/blueprint/experience/editor` → Storefront Studio editor (deep-link via `?page={page_key}`).
- KPI bar: Public surfaces · Live · Drafts · Sections orchestrated · Locales attive · Mercati
- Card grid: una card per ogni surface (Homepage, Projects, Magazine, Navigation, Footer, About, Contact, Start a project, Professionals, UI labels) con:
  - Status badge cromatico (LIVE / DRAFT / SCHEDULED / ARCHIVED)
  - Visible sections / total sections
  - Locale chips (prime 6 + "+N")
  - Last updated (italian locale formatted)
  - Page key (mono)
  - EDIT (deep-link) + PREVIEW (apre il sito pubblico in tab)
- Header con "← Experience Overview" link nello Studio editor per tornare al hub.
- Filosofia footnote: chiarezza dei confini (Brand Studio = identità · Experience = orchestrazione · International = mercati · Editorial = magazine · Forms & Journeys = acquisizione).

### Fase 0.5 (Feb 18, 2026) — HEADER UNIFICATION + Multi-locale fix + i18n cleanup
- **HEADER P0 BLOCKER RESOLVED**: backend `/api/storefront/public/{slug}/brand` ora legge la nav UNICAMENTE da `cms_sections.nav_top` (Experience Studio).
  - **DEFAULT_LINKS hardcoded ELIMINATO** dal backend.
  - **branding_settings.public_nav.main_links** stripped (migration `migrate_unify_nav_source.py`).
  - **Empty nav → empty array** sul frontend (intentional empty-state, niente silent fallback).
  - **Test end-to-end PASSED**: edit `cms_sections.nav_top.settings.links` → `/brand` endpoint reflects immediately → `SiteHeader` rende il nuovo link nel public storefront.
- **Multi-locale Brand identity FIX**: i campi `public_brand_name_i18n`, `tagline_i18n`, `short_description_i18n` aggiunti al modello Pydantic `Branding` (prima venivano scartati silenziosamente — causa per cui EN-GB, ES-MX, AR-AE non venivano persistiti).
- **Brand Studio scope LOCK**: copy aggiornato — Brand Studio controlla SOLO identità · palette · tipografia · logo · contatti · showroom. Nav/footer/sezioni vivono solo in Experience Studio.
- **Traceability chip "● Controls public storefront theme · NOT Blueprint admin"** aggiunto a Palette + Presets in Brand Studio.
- **i18n cleanup Blueprint admin** (sezione brand): nuove chiavi `brand.*` aggiunte a `DEFAULT_I18N["it"]` + `["en-US"]` (title, intro, controls, section.identityKicker, section.identity, section.paletteKicker, section.paletteTitle, section.typographyKicker, section.typographyTitle, field.public_name, field.tagline, field.short_desc, field.support_email, field.phone, field.website, field.primary_logo, field.display, field.body, i18nHint, save, discard, livePreview, paletteTrace, presetsTrace). Tutti gli hardcoded inglesi sostituiti da `t('brand.…', null, '…italiano fallback…')`.

### Fase 0 + Fase 1 (Feb 18, 2026)
- Renamed `Storefront Studio` → **Experience Studio™** (label + canonical route `/blueprint/experience`)
- Legacy `/blueprint/storefront` → automatic redirect (preserves bookmarks)
- Sidebar IA refactored into 9 canonical sections (Workspace · Experience · Projects · Editorial · Forms & Journeys · International · Team · Settings · Platform)
- `/blueprint/forms-journeys` route added (currently maps to FormBuilderPage; full Luxury Lead Architecture in Fase 3)
- DELETED legacy `/pages/settings/StorefrontPage.jsx` (Session A placeholder)
- DELETED legacy `/pages/settings/StorefrontStudio.jsx` (Session B duplicate)
- `/settings/storefront` route redirects to canonical Experience Studio
- Hybrid renderer architecture implemented in `/app/frontend/src/pages/storefront/bandEditors.jsx`:
  - **Tabular**: `NavTopEditor`, `FooterColumnsEditor`
  - **Cinematic**: `StatsBandEditor`, `BrandLogosEditor`, `MagazineGridEditor`, `NewsletterEditor`, `DualCtaEditor`
- Traceability chip "● CONTROLS PUBLIC EXPERIENCE: …" on every editor
- Seeded `dual_cta`, `stats_band`, `brand_logos`, `magazine_grid`, `newsletter` sections on demo tenant home page (idempotent merge — never overwrites admin edits)
- Deduped legacy duplicate sections (home, projects, professionals, start_project, ui, navigation pages)
- Public HomePage renderers added: `StatsBand`, `BrandLogosStrip`, `MagazineGrid` (no silent fallback when DB empty → editorial empty-state)
- `DualCTA` rebound to canonical `dual_cta` section (private/professional sub-fields)
- `Newsletter` `success` message now sourced from CMS

### Previous sessions
- Projects Studio™ Backend & UI + cultural adaptation
- Editorial Studio palette alignment
- Phase S-CONNECT Step B Phases 1–3 (frontend runtime binding for projects, positioning consumption)
- International Presence™ Positioning Modes (`custom_settings.positioning`)
- Brand Studio Multilingual Support (`public_brand_name_i18n`, `tagline_i18n`)
- Seeded Demo Tenant Header/Footer into `storefront_content` DB

## Roadmap / Pending

### Fase 2 — Magazine Parity™ (NEXT)
- Backend `editorial.py`: master/variants/publish-per-locale identical to Projects pattern
- Editorial Studio: Market Editions tab + publish workflow completo
- Public bind `MagazinePage` + `MagazineArticlePage` to runtime articles endpoint
- Remove `ui.js` magazine labels
- Collapse 12 magazine locale routes into `SiteLayout` (refactor away copy-paste)

### Fase 3 — Forms & Journeys™ (Luxury Lead Architecture)
- Schema extension: `journey_type · target_audience · market_visibility · locale_adaptation · cta_source · destination_routing · assigned_pipeline · lead_classification · editorial_framing · hospitality_tone · qualification_logic`
- Build DB-driven `/start-project/private`, `/start-project/professional`, `/contact`
- DELETE legacy: `/onboarding/*`, `/professionals`, `/professionals/intake`, `OnboardingPlaceholderPage`, `ProfessionalsGatewayPage`, `StartProjectWizard`, `onboardingGraph.js`, `professionals.js`, `onboarding.js`

### Fase 4 — Project 3-CTA System + Homepage Dynamic Orchestration
- Project Detail final CTAs: Private Client · Pro/Architect · General (market-aware, positioning-adapted)
- Homepage runtime: 4–5 random published projects + 3 editorial articles filtered by locale × market × cultural compatibility

### Fase 5 — UI String Override Architecture
- `tenants.ui_overrides_i18n` JSONB column
- Hybrid loader (code defaults + DB overrides per tenant)
- Override panel in Experience Studio

### Fase 6 — Polish & Guardrails
- "Controls public experience: X" trace labels on every Blueprint admin form (Brand Studio, Editorial, Forms, International)
- ESLint rule: blocco imports da `site/content/*` in nuovo codice
- Remove `homepage.js` + `navigation.js` fallback paths entirely (P0 cleanup leftover — still imported as last-resort safety net; will be removed once empty-state UX is validated)
- Empty-state design for Projects/Magazine when no DB content
- Editorial Presence Calendar™ + License Architecture (prepaid credits)

### Backlog (Future)
- Phase 2 Visual CRM Quick Create / Guided New Lead Procedure
- Client Portal luxury concierge experience
- Editorial Presence Calendar™

## Code Architecture
```
/app/
├── backend/
│   ├── routers/      # storefront.py · markets.py · editorial.py · portfolio.py · magazine.py · settings.py
│   ├── services/     # project_market_composer.py · editorial_ai.py
│   └── scripts/      # seed_storefront_navigation.py · seed_storefront_home_bands.py
└── frontend/src/
    ├── pages/
    │   ├── storefront/   # StorefrontStudioPage.jsx (Experience Studio) · bandEditors.jsx (hybrid renderers)
    │   ├── settings/     # InternationalPresencePage.jsx · BrandStudioPage.jsx · FormBuilderPage.jsx
    │   ├── projects/     # ProjectsStudioPage.jsx
    │   ├── editorial/    # EditorialStudioPage.jsx · VariantApprovalInboxPage.jsx
    │   └── site/         # HomePage.jsx · ProjectsIndexPage.jsx · ProjectDetailPage.jsx · MagazinePage.jsx
    └── site/
        ├── components/   # SiteHeader.jsx · SiteFooter.jsx · …
        ├── usePositioning.js · usePublicBrand.js · useStorefrontContent.js
        └── content/      # tenant.js · languages.js · ui.js (i18n) + LEGACY fallbacks (homepage.js/navigation.js — pending removal)
```

## Key DB schemas
- `tenant_markets.custom_settings` JSONB (positioning_mode, business_intent, primary_audience, cultural_editorial_lens)
- `cms_pages` (page_key, status, published_revision_id)
- `cms_sections` (section_type, locale_content JSONB, settings JSONB, sort_order, visible)
- `portfolio_projects` + `portfolio_project_variants`
- `branding_settings` (public_brand_name_i18n, tagline_i18n)

## Tech stack
React 19 · Tailwind · FastAPI · Supabase Postgres · Claude Sonnet via emergentintegrations (Universal LLM Key)

## Frontend Runtime Audit
See `/app/memory/FRONTEND_RUNTIME_AUDIT.md` for the running cleanup ledger. After Fase 0+1:
- 7 missing admin renderers → ✅ implemented (hybrid: tabular for structural · cinematic for experiential)
- Storefront duplicates (`StorefrontPage.jsx`, `StorefrontStudio.jsx`) → ✅ deleted
- Traceability gaps on header/footer/stats/logos/magazine grid → ✅ closed
- Remaining: legacy `homepage.js` / `navigation.js` fallbacks (kept for now as last-resort safety net, removal scheduled in Fase 6)
