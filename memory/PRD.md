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
- **Theme Engine** (`core/theme_engine.py`) — design system runtime tokens:
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
- Visual section builder (Hero, CTA, Services, Gallery, Testimonials, Featured Projects, Stats, A&D, Magazine, Final CTA)
- Drag reorder, hide/show, multi-language content, publish flow
- Tenant homepage live su `/{tenant-slug}` o custom domain
- **Public Tenant Showcase** opt-in (enterprise) — `/showcase/{tenant-slug}` directory pubblica per SEO

### Phase D — Form Builder + Design Request Settings
- Multi-step form builder con file upload
- Design Request settings (types/styles/budgets/scoring/auto-assignment)

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
