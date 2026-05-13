# MOOD for DESIGN™ — Product Requirements Document

## Original Problem Statement
Multi-tenant SaaS platform per interior designer e architetti, costruita come Blueprint OS™ — operating system configurabile multi-tenant. Stack: React + FastAPI + Supabase. Tutto Blueprint-driven (zero hardcoded UI), multi-locale, tenant-themed, permission-aware.

## Brand Architecture
- **Platform**: MOOD for DESIGN™
- **Framework**: A Blueprint OS™ Platform
- **Operational core**: Blueprint Workspace™ (Leads + Projects + Proposals + Client Portal integrati)
- **Standalone modules**: Blueprint Moodboards™ · Blueprint Inspirations™ · Blueprint Insights™ · Blueprint Concierge™ · Blueprint Match™ (future)

## Tech Stack
- **Frontend**: React 19 JSX, Tailwind, react-router, lucide-react, @supabase/supabase-js (anon)
- **Backend**: FastAPI, supabase-py (service_role), PyJWT (JWKS ES256 + HS256 fallback)
- **DB**: Supabase Postgres (Transaction Pooler 6543)
- **Auth**: Supabase Auth (email/password) — JWT verificati via JWKS
- **Storage**: Supabase Storage (6 bucket esistenti)

## Architecture Principles (CRITICAL)
1. **No hardcoded**: testi, colori, navigazione, dashboard widgets, sezioni, module visibility → tutto via API
2. **Blueprint-driven**: ogni configurazione vive in DB (`tenants` + `tenant_settings` KV JSON)
3. **Centralized engines**:
   - `core/permissions.py` (8 ruoli, 31 permission tuples `resource:action`)
   - `core/modules.py` (module registry con routes + required_permissions)
   - `core/feature_flags.py` (catalog + tenant override engine)
   - `core/tenant_context.py` (impersonation + audit + tenant scoping)
4. **RLS disabled** — multi-tenancy enforced backend (`tenant_id` in ogni query, centralizzato in `get_tenant_context`)
5. **Locale-aware**: 6 lingue (en-US, en-GB, it, fr, de, es) + architettura pronta per RTL (AE/ZH/JA future)

## Implementation Status

### ✅ Phase 1 — Tenant MVP (DONE — 12 Mag 2026)
- Schema Supabase 22 tabelle, RLS off, grants service_role
- Auth Supabase end-to-end (signup → tenant + profile; login JWKS ES256)
- CRUD: leads, projects (con status history), proposals (con signoffs), moodboards
- Storage: signed upload/download, media_library
- Blueprint API: tenant config + navigation + dashboard widgets + i18n
- Frontend Blueprint-driven (sidebar/dashboard/copy tutti via API)
- LocaleSwitcher live, ImpersonationBanner

### ✅ Phase A — Super Admin Foundation (DONE — 12 Mag 2026)
- **Permissions Engine** centralizzato (`core/permissions.py`)
  - 8 ruoli: super_admin, tenant_admin, editor, analyst, project_manager, designer, client, ad_partner
  - 31 permission tuples (`leads:read`, `super:tenants:write`, ecc.)
  - Decorator `require_permission(*perms)` per route gating
  - Frontend hook `can('perm')` + `isSuperAdmin`
- **Module Registry** (`core/modules.py`)
  - 5 moduli: workspace, moodboards, inspirations, insights, concierge
  - Ogni modulo: requires_permissions, routes con per-route gating, enterprise_only flag
  - Frontend Sidebar filtra automaticamente by enabled modules + user permissions
- **Feature Flags Engine** (`core/feature_flags.py`)
  - 11 flag catalog: hotspot, video_upload, proposal_approvals, ai_suggestions, public_magazine, lead_forms, ad_section, crm_integrations, exports, custom_domain, analytics_advanced
  - Default in code, tenant override via `tenant_settings.key='feature_flags'`
- **Tenant Context + Impersonation** (`core/tenant_context.py`)
  - Super_admin può passare header `X-Tenant-Override: <id>` per scope query su altro tenant
  - Tutte le route workspace usano `get_tenant_context` (centralizzato)
  - Audit logger su ogni mutation super_admin
- **Super Admin Routes** (`/api/super/*`)
  - `GET /tenants` list con member count, plan
  - `POST /tenants` create
  - `GET /tenants/:id` detail con usage stats + members + modules + flags
  - `PUT /tenants/:id` update name/status/plan/languages
  - `DELETE /tenants/:id` soft archive
  - `PUT /tenants/:id/modules` toggle module enabled list
  - `PUT /tenants/:id/feature-flags` toggle flag overrides
  - `POST /tenants/:id/impersonate` (audit-logged)
  - `GET /stats` cross-tenant KPI
  - `GET /audit-logs` recent platform actions
  - `GET /catalog/modules`, `GET /catalog/flags`
- **Frontend Admin Experience** (`/admin/*` — separate AdminLayout luxury control-center)
  - `/admin` Platform Overview (8 KPI cards)
  - `/admin/tenants` list + create modal
  - `/admin/tenants/:id` detail con toggle moduli/flag, status/plan picker, impersonate button, members table
  - `/admin/modules` module registry view
  - `/admin/audit` audit log
- **Impersonation banner** automatico nel DashboardLayout quando session attivo

### ✅ Phase B — Tenant Branding Studio (DONE — 12 Mag 2026)
  - Palette (12 tokens: primary, accent, background, surface 1/2/3, borders, text 4 levels, success/warning/danger)
  - Typography (font_heading, font_body, font_mono, font_size_base, line_height, letter_spacing)
  - Shape (radius_xs through xl + pill)
  - Spacing (compact / comfortable / spacious + base unit)
  - Elevation (sm/md/lg shadows configurabili)
  - Motion (3 preset: subtle/standard/expressive + durations + ease)
  - Components (button_style: sharp/pill/ghost · card_style · ui_density)
  - Brand assets (logo_dark, logo_light, logo_mobile, favicon, og_image)
- **Backend endpoints** (`/api/settings/*`):
  - `GET /theme` → `{default, overrides, effective}`
  - `PUT /theme` deep-merge update
  - `POST /theme/reset`
  - `GET /fonts/catalog` — 16 curated Google Fonts (Cormorant, Playfair, Bodoni Moda, Tenor Sans, Manrope, Syne, Italiana, JetBrains Mono…)
  - `GET/POST/DELETE /domains` (multi-domain support, type: platform_subdomain | custom_domain, verification_status)
  - `POST /assets/register` — hook post-upload Supabase Storage, registra in media_library + theme.assets, mirror su tenants.logo_url
  - Brand color: **#26F5C9** (MOOD teal) ora default
- **Frontend Brand Studio** (`/settings/brand`)
  - Linear/Stripe-inspired luxury panel split 440px editor / fluid live preview
  - 5 tabs: Palette · Typography · Shape · Motion · Assets
  - 6 preset palette (MOOD Teal · Editorial Gold · Pure Noir · Rose Quartz · Deep Forest · Midnight Sea) one-click
  - Color picker nativo + hex input per ogni token
  - Google Fonts loader runtime (link tag injection on-demand)
  - Slider px-based per radius / font size / line height
  - **Live preview pane** responsive (Monitor/Tablet/Mobile viewport switcher)
  - Asset uploader Supabase Storage (signed URL → PUT → register)
  - Save bar dirty-state + Reset to default
- **Theme application runtime**: ~25 CSS variables `--bp-*` settate da BlueprintContext + density classes `body.density-{compact|comfortable|spacious}`
- **Brand component** (`Brand.jsx`) ora usa logo da `theme.assets.logo_dark|light` con fallback tipografico
- **Settings hub** (`/settings`) — 4 tile (Brand Studio · Domains · Locales · Team)
- **DomainsPage** (`/settings/domains`) — add/delete con validazione regex, badge verification status
- **Resilienza**: middleware FastAPI retry trasparente su httpx.RemoteProtocolError (Supabase pooler hiccups)

### ✅ Phase B+ — Design DNA Expansion (DONE — 12 Mag 2026)
Mockups (3 luxury hospitality UI references) absorbed into the Theme Engine — NOT replicated as static pages. Extracted: editorial typography rhythm, cinematic atmosphere, motion personality, spacing system.

- **Theme Engine v2** (`core/theme_engine.py`): 80+ tokens (was ~40)
  - `editorial` scale: display/h1/h2/h3/lead/body/caption/eyebrow as fluid clamp() + line-heights + tracking
  - `atmosphere`: grain_intensity, glow_intensity, vignette_intensity, glass_blur, glass_opacity, hero_gradient, section_divider
  - `spacing` extended: section_y, section_x, gutter, max_width, stack_tight/default/loose/editorial
  - `motion` extended: duration_cinematic, ease_emphasis, ease_entrance, stagger, hover_lift
  - `elevation` extended: xl, glow, inset_soft
  - `palette` extended: overlay, selection_bg, selection_fg
  - `components` extended: image_treatment, cursor_style, input_style
- **2 new palette presets** in Brand Studio: `editorial-noir` (warm noir + copper accent + grain) · `linear-mist` (cool tech violet + clean glass)
- **CSS utilities** in `index.css`: `.bp-display .bp-h1 .bp-h2 .bp-h3 .bp-lead .bp-body .bp-caption .bp-eyebrow .bp-section .bp-container .bp-glass .bp-grain .bp-vignette .bp-hero-gradient .bp-btn .bp-btn-primary .bp-btn-ghost .bp-enter .bp-marquee-track .bp-img-cinematic`
- **BlueprintContext.applyTheme** propagates all new tokens to `:root` CSS variables (no rebuild)
- **Fix**: `ThemeUpdate` Pydantic model now accepts `atmosphere` + `editorial` fields (were silently dropped)

### ✅ Phase B+ — Section Engine (DONE — 12 Mag 2026)
Server-configurable rendering backbone reusable across: homepage · landing · proposals · magazine · moodboards · showcase · client portals · onboarding flows. ZERO hardcoded content.

- **Backend** (`core/section_registry.py` + `routers/pages.py`):
  - 10 section types: `hero · feature_grid · gallery · quote · stats · cta · split · logo_strip · magazine_grid · faq` — each with schema + defaults + reusable_in[] + category
  - DEFAULT_PAGE_TEMPLATES: `homepage` (8 sections) · `showcase` (4) · `about` (4)
  - Pages stored per tenant in `tenant_settings` (key pattern `page.{slug}`)
  - Endpoints under `/api/blueprint`: `GET sections/catalog`, `GET pages`, `GET/PUT pages/:slug`, `POST/PUT/DELETE/PATCH sections`, `POST sections/:id/duplicate`, `POST pages/:slug/reset`, `GET palette-presets`
- **Frontend** (`/app/frontend/src/blueprint/`):
  - `SectionRegistry.js` — type → React component map + `resolveContent(section, locale, fallback)`
  - `PageRenderer.jsx` — generic `<BlueprintPageRenderer slug=... />` or with `page` prop for live preview
  - `Kit.jsx` — Blueprint UI Kit primitives (Eyebrow/Display/H1-3/Lead/Body/Caption/Section/Container/Button/CTAGroup), all token-driven
  - 10 section components in `blueprint/sections/`, all theme-aware, locale-aware
- **HomepageBuilderPage** (`/settings/pages`): Shopify-Sections-style UX
  - 440px left rail with section stack (chevron reorder · eye toggle · copy · trash · edit), right pane = live preview
  - Switch between pages (homepage/showcase/about) via topbar
  - Viewport switcher (Desktop/Tablet/Mobile) with smooth animated width
  - Locale switcher for editing translations per language (content stored as `{_default, en-US, it, fr, de, es}`)
  - Add modal with all 10 section types categorized
  - Save bar dirty-state + Reset to default template
  - Inline property editor renders different fields per section type
- **Tested End-to-End** ✅
  - 10/10 backend endpoints pass (catalog, page CRUD, section CRUD, reorder, duplicate, reset, palette presets, extended theme tokens)
  - All critical frontend testids present (`homepage-builder-page`, `tile-pages`, `add-section-btn`, `save-page`, `reset-page`, `viewport-*`, `preview-locale`)
  - 8 brand presets visible including Editorial Noir + Linear Mist
  - Property editor opens correctly per section type; preview updates live
  - Italian locale active in sidebar


### Tested End-to-End ✅
- Login → tema teal #26F5C9 caricato runtime
- Brand Studio carica tutti i tab
- Preset palette applicato → preview live aggiorna istantaneamente colors+shapes+fonts
- Viewport switcher desktop/tablet/mobile cambia preview width animata
- Save → teal applicato globalmente in sidebar + active states + buttons
- Domains: add custom_domain → riga con badge pending
✅ Sidebar tenant mostra "Super Admin" entry
✅ Navigate to /admin → control-center UI
✅ Platform overview KPI cross-tenant
✅ Tenants list (2 tenants)
✅ Open tenant detail con tutti i toggle visibili
✅ Toggle Feature Flag (ai_suggestions) → backend persisted
✅ Impersonate tenant → banner amber visibile, queries con header
✅ Stop impersonation → banner removed

### ✅ Phase C — Public Rendering Layer + Dynamic Navigation/Footer (DONE — 12 Mag 2026)
The Section Engine now powers UNAUTHENTICATED public tenant routes. ZERO hardcoded React pages — runtime composition only.

- **Backend** (`routers/public.py` + `routers/navigation.py`):
  - `GET /api/public/tenants/{slug}` — public tenant config (theme, locales, navigation, footer); resolves by slug OR by custom domain (via `tenant_domains` table)
  - `GET /api/public/tenants/{slug}/pages/{page_slug}` — serves only published pages (homepage gets a graceful default seed when no published version exists)
  - `GET /api/public/navigation/defaults` — canonical seeds for the navigation editor
  - Auth-gated CRUD under `/api/settings`: `GET/PUT/POST reset` for `navigation` and `footer` (key='public_navigation' / 'public_footer' in `tenant_settings`)
  - Sensible default seeds: 4-item top nav with home/showcase/about/contact + CTA + locale switcher, 3-column footer with copyright template
- **Frontend Public Rendering** (`/app/frontend/src/pages/public/`):
  - `PublicTenantPage.jsx` — runtime composition: loads tenant config + page in parallel, applies theme to `:root`, renders `<PublicNavigation>` + `<BlueprintPageRenderer>` + `<PublicFooter>`. Reserved-slugs short-circuit to 404
  - `PublicNavigation.jsx` — schema-driven luxury top bar: logo (asset OR text), items (link/mega-menu), CTA, locale switcher, mobile drawer, transparent-over-hero + glass-after-scroll behavior
  - `PublicFooter.jsx` — multi-column footer, i18n labels, copyright with `{year}` and `{brand}` interpolation
  - `publicLocale.js` — `PublicLocaleContext` + `resolveI18nLabel(label, locale, fallback)` helper used across the public layer
- **Frontend Editor** (`/settings/navigation` → `NavigationEditorPage.jsx`):
  - Two tabs (Navigation / Footer), per-locale i18n inputs ({_default, en-US, it, ...}), reorder via chevron, add/delete items, columns and links
  - Toggles: sticky · transparent-on-hero · locale switcher
  - Visit-public-site button opens `/{tenant-slug}` in a new tab
  - Save dirty-state + Reset to default
- **HomepageBuilder additions**: Publish toggle (draft/published) in topbar
- **App.js public routes**: `/:tenantSlug` and `/:tenantSlug/:pageSlug` registered AFTER all specific routes, BEFORE catch-all
- **Tested End-to-End** ✅
  - 17/17 backend pytest pass (public config, published gating, custom-domain resolution, auth gating, i18n round-trip, defaults reset)
  - Public route renders end-to-end with editorial cinematic hero (eyebrow + display + lead + CTAs), Italian CTA "Contattaci" via i18n label resolution
  - Locale switcher updates labels live without reload (persists in localStorage)
  - Critical bug found + fixed during testing: missing `<Route path="/settings/navigation">` in App.js (testing agent applied the fix)
  - Cosmetic fixes: duplicate 'EN' in locale dropdown (now shows full locale codes), visit-public-site link robust to slug load timing


## File Map
```
/app/backend/
├── core/
│   ├── permissions.py        # 8 roles × 31 perms, centralized
│   ├── modules.py            # Blueprint module registry
│   ├── feature_flags.py      # 11 flags + override engine
│   └── tenant_context.py     # impersonation + audit + scope
├── routers/
│   ├── auth.py, leads.py, projects.py, proposals.py, moodboards.py
│   ├── blueprint.py          # i18n, tenant/me, navigation, dashboard, modules, flags
│   ├── superadmin.py         # /api/super/* cross-tenant management
│   └── storage.py, insights.py, settings.py, inspirations.py
├── middleware/auth.py        # JWKS ES256 + HS256 fallback
├── models/schemas.py         # Pydantic
└── server.py

/app/frontend/src/
├── contexts/
│   ├── AuthContext.jsx       # localStorage session
│   └── BlueprintContext.jsx  # theme + i18n + modules + permissions + impersonation
├── components/
│   ├── layout/{Sidebar,Topbar,DashboardLayout,AdminLayout}.jsx
│   └── common/{Brand,LocaleSwitcher,ImpersonationBanner}.jsx
├── pages/
│   ├── auth/, dashboard/, workspace/, moodboards/, inspirations/, insights/, settings/, public/
│   └── admin/{Overview,Tenants,TenantDetail,Modules,Audit}.jsx
└── App.js
```

## Roadmap

### ✅ DONE
- Phase 1 (Tenant MVP) — auth, CRUD, dashboard, i18n, theme
- Phase A (Super Admin Foundation) — permissions, modules, flags, impersonation

### 🔜 Phase C — Homepage / Public Site Builder
- ✅ Section Engine fondazionale (DONE in Phase B+)
- ✅ Homepage Builder UI (DONE in Phase B+)
- ✅ Public Route Renderer su `/{tenant-slug}` + `/{tenant-slug}/{page-slug}` (DONE in Phase C)
- ✅ Dynamic Navigation/Footer schema-driven (DONE in Phase C)
- ✅ Page publish/draft toggle (DONE in Phase C)
- Remaining: custom-domain verification flow (DNS check), SEO meta tags per page, og_image preview

### Phase D — Blueprint Dynamic Form Engine™ + Workspace
- Multi-step form builder with file upload, conditional logic, AI-assisted copy
- Design Request settings (types/styles/budgets/scoring/auto-assignment)
- Blueprint Workspace™ extension (Timeline, Files, Proposals, Signoff, Client Portal, Tasks, Notes)

### Phase E — Blueprint Moodboards Editor
- Block-based canvas (@dnd-kit/core + Zustand)
- Image positioning, hotspot, palette, typography, versioning, export PDF, share link

### Phase F — Inspirations CMS + Insights advanced + Concierge
- Magazine builder (paragraph builder, hero video, SEO, related)
- Recharts premium dashboards (funnels, conversion, top categories)
- Concierge service requests

### Future
- RLS migration path (codebase pronto, basta abilitare policies)
- AI localization engine (auto-translate Blueprint copy)
- White-label custom domains
- RTL/AR locale support

## Demo Credentials (`/app/memory/test_credentials.md`)
- Email: `demo@moodfordesign.com` · Password: `Blueprint2024!`
- Role: `super_admin` (può accedere a `/admin/*` e impersonare tenants)
