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


### ✅ Sprint Cleanup P0 — Foundation Hardening (DONE — 13 Mag 2026)
Pre-requisito **non negoziabile** prima delle fasi F. Migrazione completa da JSON-blob-in-tenant_settings a tabelle relazionali dedicate, fix dello schema drift su `moodboard_elements`, setup del workflow migration professionale, autosave hardening e dedupe architetturale.

- **Migration workflow** (`/app/supabase/migrations/` + `apply.py`):
  - `001_baseline_2026_05_13.sql` — snapshot documentale (22 tabelle, 9 enum)
  - `002_moodboard_schema_cleanup.sql` — backfill di `position_json`/`style_json`/`image_url` da `content`; aggiunte colonne strutturate `locked`/`hidden`/`opacity`/`rotation`/`updated_at`; indici `(moodboard_id, sort_order)` + GIN su `position_json`; V2 scaffold (`cover_strategy`/`cover_metadata`/`presentation_metadata`/`ai_metadata`)
  - `003_workspace_dedicated_tables.sql` — nuove tabelle `project_notes`, `project_activity`, `moodboard_shares` con backfill **automatico** da `tenant_settings.project.*` e `moodboard_share.*` (30 events + 2 notes + 4 share token migrati senza data loss)
  - `004_grant_new_tables.sql` — `service_role`/`authenticated`/`anon` privileges (PostgREST permission fix) + default privileges su future tables
  - `005_tasks_completed_at.sql` — colonna `completed_at` su `tasks` (auto-set in update_task)
  - `apply.py` runner idempotente con `schema_migrations` tracking table, supporto `--list` e `--dry-run`
- **`moodboards_v1.py` refactor**:
  - Layout (x/y/width/height/z_index) ora in `position_json` reale (JSONB); style (crop_x/crop_y/focal_point/fit_mode/opacity/rotation/zoom) in `style_json`
  - Frontend riceve la forma normalizzata (flat top-level) via `_normalize_block`, **senza** leak di `position_json`/`style_json`
  - Image blocks mirror `src` nella colonna dedicata `image_url`
  - Backward-compatible: parser fallback per blocchi pre-migration con `layout` dentro `content`
  - Share endpoint ritorna sia `share_token` che `share_path` (frontend non costruisce più l'URL)
- **`workspace.py` refactor**: tasks/notes/activity ora leggono/scrivono dalle **tabelle reali** (no più JSON in `tenant_settings`); `update_task` setta `completed_at` automaticamente al transito → done
- **`moodboard_shares`** table: view tracking automatico (`view_count`, `first_viewed_at`, `last_viewed_at`); revoke via `revoked_at`; lookup veloce con UNIQUE index parziale `WHERE revoked_at IS NULL`
- **Storage hardening** (`storage.py`): `register_media` rifiuta path di altri tenant (403), forza prefisso `{tenant_id}/`
- **Frontend cleanup**:
  - `components/common/StatusBadge.jsx` consolidato (era duplicato in 3 punti, ora unico, prop `kind` per moodboards/projects/leads/proposals)
  - MoodboardEditor: autosave con retry x3 + backoff esponenziale + error state visibile (testid `status-save-error`) + warning beforeunload se ci sono modifiche pendenti
  - Cancellato `pages/proposals/` (duplicato di `pages/workspace/ProposalsPage.jsx`)
- **Tested** ✅
  - Backend: **86/86 pytest pass** (Phase A/B/C/D/E baseline + sprint cleanup suite 15/15)
  - Frontend smoke: list IT (4 cards), editor IT (Aggiungi blocco / Immagine/Testo/Palette/Nota/Prodotto/Materiale, badge "APPROVATO"), Velvet sofa block rendering, autosave testids esposti
- **NON ancora fatto** (next sprint):
  - Cleanup delle legacy keys in `tenant_settings.project.*.tasks|notes|activity` (mantenute per backward compat — purge dopo verifica produzione)
  - Theme leak fix su 5 pagine legacy (Dashboard, Leads, Projects, Proposals, Admin Overview)


### ✅ Demo seed + Permission hardening (DONE — 13 Mag 2026)
Pre-requisito esplicito utente prima della Fase F: "verificare bene tenant_id enforcement, permission decorators, impersonation boundaries".

- **Seed script idempotente**: `/app/backend/scripts/seed_demo_users.py`
  - Re-runnable safely (skip if exists, sync role/tenant if drift, password reset on auth side)
  - Crea: `designer@moodfordesign.com` (designer, Studio), `client@moodfordesign.com` (client, Studio), `studio2@moodfordesign.com` (tenant_admin, Showroom)
  - Auto-crea il tenant `mood-demo` (Showroom) se mancante
  - Aggiornato `test_credentials.md` con matrix completa per-ruolo
- **Permission decorator gap CHIUSO** (issue critica scoperta durante test isolamento):
  - Prima del fix: designer/client potevano leggere `/leads`, `/projects`, `/proposals`, `/moodboards`, `/insights` (decorator mancante)
  - `core/tenant_context.require_permission()` ora wrappa `get_tenant_context` invece di `get_current_user` → permission gate + tenant scope in una sola Depends
  - Applicato a 38 route in 7 router: `leads.py` (5), `projects.py` (5), `proposals.py` (6), `moodboards.py` (5), `moodboards_v1.py` (8), `workspace.py` (10), `insights.py` (2)
- **Multi-tenant isolation verificata E2E**: studio2 (Showroom tenant_admin) prova a leggere moodboard di Studio → 404. Sua lista personale → 0 row. Nessun leak.
- **Test regression**: `tests/test_isolation_permissions.py` (6 test, **6/6 pass**) — gating per role × endpoint + cross-tenant leak test
- **90/90 backend pytest pass** + 5 skipped + 1 xpass = ZERO regressione su 6 fasi precedenti


### ✅ Phase F.1 — Structural Multi-page Templates™ (DONE — 13 Mag 2026)
Trasformazione architetturale del template system da single-page a multi-page editoriale. **Apre il vero Blueprint Presentation OS™**.

- **PRE-fix CTA mancante** (PagesNavigator)
  - Header del navigator ora ha `+` icon button (`add-page-btn`) sempre visibile
  - Inline dashed tile "Aggiungi pagina" in fondo alla lista (`add-page-inline-btn`) — scrolla con le pagine, no troncamento
  - Sticky-bottom overlay del picker (`absolute bottom-2`)
- **Migration 009** — `template_pages` table + `template_blocks.template_page_id` + placeholder semantics (`is_placeholder`, `placeholder_label`, `placeholder_type`, `placeholder_required`). Backfill: ogni template esistente → 1 default page, blocks linkati
- **Migration 010** — 3 structural template seed (UUID fissi idempotenti)
  - **Luxury Residential Presentation** — 8 pages, 30 blocks (Cover landscape / Concept / Atmosphere / Material Palette / Furniture / Lighting / Room Gallery / Approval) — 26 placeholders
  - **Hospitality Concept** — 6 pages, 14 blocks (Cover / Brand Narrative / Spatial Mood / Materials / Guest Experience / Approval) — 9 placeholders
  - **Material Board** — 1 page square, 6 blocks (palette + 3 materials + 2 products)
  - Locale_content IT/FR/DE/ES, editorial pacing positions/sizes precise
- **Backend** (`templates.py`)
  - `_attach_preview` ora emette `pages_preview` carousel (1 svg per page) per templates multi-page; `page_count` field sempre presente
  - `apply_template` multi-page-aware: clona `template_pages → moodboard_pages` con `page_id_map`, blocks attaccati al `page_id` corretto, placeholder metadata propagata via `metadata_json.placeholder = {label,type,required}`
  - `save_as_template` round-trip multi-page: snapshot `moodboard_pages → template_pages`, blocks attaccati con placeholder fields re-estratti
  - Fallback elegante per legacy single-page templates (synth default page)
- **Frontend** (`TemplatePicker.jsx`)
  - `PreviewBox` switch dinamico: multi-page → 3-layer stacked SVG con offset+scale cinematic; single-page → SVG straight
  - Page count badge editorial `'{count} pagine'` con icona Layers e color primary teal (`template-page-count-{slug}`)
- **Frontend placeholder UX** (`ImageBlock.jsx`)
  - Empty state ora mostra label placeholder (con ★ se required) + prompt localizzato "Sostituisci con immagine"
- **i18n** — 7 nuove chiavi EN+IT: `templates.pageCount`, `placeholder.replaceImage/Text/Palette/Material/Product`
- **Tested ✅** (`iteration_13.json`)
  - Backend: **14/14 new F.1** + **19/19 regression** F.0 = **33/33 PASS**
  - Frontend live: 13 cards picker, structural badges "8 pagine"/"6 pagine" visibili, multi-layer stack su Luxury, apply→editor con 8 page tiles + page types localizzati (Copertina/Citazione/Mood/...), placeholder ★ "HERO COVER IMAGE" rendered, '+' header + inline dashed tile entrambi presenti
  - Cross-tenant: studio2 può leggere platform templates, apply scoped al proprio tenant (no leak)
  - RBAC: client 403 su apply + from-moodboard
  - i18n IT verificato completamente


### ✅ Phase F.0 — Multi-page Foundation per Blueprint Moodboard PRO™ (DONE — 13 Mag 2026)
Trasformazione architetturale: da single-canvas a sistema multipagina. Backward-compatible 100% — i 37 moodboard esistenti continuano a funzionare.

- **Migration 008** (`008_moodboard_pages.sql`) — idempotente, reversibile
  - ENUM `moodboard_page_type` (13 valori: cover/blank/mood/material_board/product_grid/palette/gallery/split_story/quote/technical_board/floorplan/proposal_summary/approval)
  - TABLE `moodboard_pages` (id, tenant_id, moodboard_id FK CASCADE, title, page_type, aspect_ratio, width, height, background JSONB, settings JSONB, sort_order, hidden_in_presentation, created_by, timestamps)
  - `moodboard_elements.page_id` nullable + FK CASCADE + index
  - `moodboards.current_page_id` nullable
  - **Backfill DO block**: ogni moodboard esistente → 1 default page con `title=moodboard.title` (o "Page 1" se null), `page_type='blank'`, `aspect_ratio='portrait_a4'`, tutti gli elements esistenti linkati alla nuova page, current_page_id puntato alla default
  - RLS enabled + policy service_role all
  - Indices: `(moodboard_id, sort_order)`, `(tenant_id)`, `(page_id)` su elements
- **Backend** (`moodboards_v1.py`)
  - `ASPECT_RATIO_PRESETS` registry (6 presets): portrait_a4 (1400×2400), landscape_16_9 (1920×1080), square_1_1 (1400×1400), editorial_3_4 (1400×1866), wide_2_1 (1920×960), cover_landscape (1920×1200)
  - `PAGE_TYPES` registry (13 valori) — Blueprint-driven via `GET /api/moodboards/_meta/page_presets`
  - 7 nuovi endpoint: `GET _meta/page_presets`, `GET pages`, `POST pages` (auto-append sort_order + width/height da preset), `PUT pages/{id}` (recompute dimensions on aspect_ratio change), `DELETE pages/{id}` (409 last-page guard + current_page_id fallback), `POST pages/{id}/duplicate` (clone page + tutti gli elements con nuovi uuid), `POST pages/reorder` (validazione set strict)
  - `create_block` ora popola `page_id` da `body.page_id || moodboard.current_page_id || _ensure_default_page()` (safety net)
  - RBAC `P_MOODBOARDS_READ/WRITE` su tutti gli endpoint
  - `GET /api/moodboards/{id}` ora include `pages: [...]` array (sort_order ASC) + `elements` legacy
- **Create + Apply flows** (`moodboards.py` + `templates.py`)
  - `POST /api/moodboards` crea automaticamente default page con `title=mb.title` e setta `current_page_id`
  - `apply_template` crea default page e attacha tutti i cloned blocks
  - Bug fix (caught by testing agent): response del create overlay-ava current_page_id stale; risolto con re-overlay in-place
- **Frontend** (`PagesNavigator.jsx` + `MoodboardEditor.jsx`)
  - Sidebar 180px left of "Add Block" toolbar, eyebrow "PAGINE", mini canvas thumbnail per ogni page (rect colorati semantici, no SVG complesso — performance-friendly)
  - Active page highlight (border `var(--bp-primary)`)
  - Hover actions: duplicate, delete (con guard last-page lato UI)
  - HTML5 drag-and-drop → POST reorder
  - Add page picker: dropdown ratio + dropdown type, presets letti dal registry backend
  - State editor: `pages`, `activePageId`, derived `pageBlocks`, `blocksByPage`, `activePage`, `canvasW/H` dinamici
  - Canvas dimension **dinamica** dal preset (es. landscape_16_9 → 1920×1080)
  - Snap page-scoped (no cross-page magnetism)
  - LayersPanel scoped to current page
  - `addBlock` invia `page_id=activePageId`
- **i18n** — 25 nuove chiavi EN+IT
  - `page.{add,duplicate,delete,rename,untitled,eyebrow}`
  - `page.ratio.{portraitA4,landscape169,square,editorial,wide,coverLandscape}`
  - `page.type.{cover,blank,mood,material_board,product_grid,palette,gallery,split_story,quote,technical_board,floorplan,proposal_summary,approval}`
- **Tested ✅** (`iteration_12.json`)
  - Backend: **19/19 new F.0** + **31/31 regression** (P0+E.5+E.2)
  - Frontend live: PagesNavigator visible at x=220/180px, eyebrow 'Pagine', add-page-btn → picker funzionante, card count 2→3 dopo add, canvas resize verificato (landscape_16_9 → 1920×1080), IT i18n confermato
  - Bug `current_page_id=None` su create_moodboard → fix applicato dal testing agent (overlay sul response dict)
  - Cross-tenant: studio2 404 su pages designer ✓
  - RBAC: client 403 su pages write ✓


### ✅ P0 Sprint — Moodboard Core Stabilization (DONE — 13 Mag 2026)
Pre-foundation reliability + media completeness pass prima di aprire Moodboard PRO™.

- **Image upload provenance** (`ImageUploader.jsx`) — Pre-estrae `naturalWidth/Height` via `Image()` preload + `URL.revokeObjectURL` cleanup. `onUploaded(url, metadata)` propaga: `upload_source`, `original_dimensions`, `media_id`, `storage_path`, `file_name`, `uploaded_at`
- **Atomic patch onChange prop** — `BlockInspector` accetta `onChange(patch)` per mutazioni multi-field; `updateBlock` deep-merge ora copre anche `metadata` (oltre a content/style già fatto in E.5)
- **Fix opacity bug** — `block.opacity`/`block.rotation` sono colonne top-level: prima venivano scritte erroneamente in `style_json`. Ora `onChange({opacity:v})` / `onChange({rotation:v})` colpisce le colonne reali
- **Border-radius slider** (`style.border_radius` 0-48px) — Inspector con feedback px live
- **Shadow preset 4-button grid** (`style.shadow_preset` ∈ {none/soft/medium/dramatic}) — editorial restraint, NO valori custom shadow (intenzionale)
- **Toast Sonner** integrato in `App.js` bottom-right, theme dark, className `bp-toast`. `flushSave` dopo max retries → `toast.error` con action "Riprova" che reset retryCount + ri-trigger flush
- **Backend metadata pipeline** (`moodboards_v1.py`)
  - `BlockUpdate.metadata` field aggiunto
  - `update_block` + `batch_update_blocks` deep-merge `metadata_json` (no replace semantics)
  - `_normalize_block` espone `metadata` nella response GET
- **i18n** — 8 nuove chiavi EN+IT: `field.borderRadius/shadow`, `shadow.none/soft/medium/dramatic`, `editor.visualProps/saveFailedHint/retry`
- **Tested ✅** (`iteration_11.json`)
  - Backend: **9/9 new P0** + **31/31 regression** (E.2 + E.4 + E.5)
  - Frontend E2E live: tutti 10 nuovi testids presenti, shadow-medium click → computed `boxShadow='rgba(0,0,0,0.3) 0px 8px 24px 0px'`, autosave raggiunge status-saved entro 3.5s, persistenza dopo reload verificata


### ✅ Phase E.5 — Moodboard Stability & Media Polish Pass (DONE — 13 Mag 2026)
Chiusura blocker UX core dell'editor prima dell'apertura di Fase F. Reliability + media editor reale.

- **Autosave reliability** (`MoodboardEditor.jsx`)
  - `blocksRef`/`dirtyRef` → flushSave legge sempre lo stato corrente, no più stale closures su mutazioni rapide
  - `setDirtyMap` partial clear (solo ids effettivamente persistiti) → in-flight edits restano in queue
  - `useEffect` cleanup con `flushRef.current()` → flush forzato su unmount/SPA navigation (verificato pattern by construction)
  - `beforeunload` → `navigator.sendBeacon` con JSON blob best-effort (limitazione documented: no auth header)
  - `retry` con backoff lineare 500ms × tentativo, max 3 tentativi
- **updateBlock deep-merge** (P0 root cause)
  - Patch `{content: {...}}` ora fonde con esistente invece di sostituire → fix bug "upload immagine perde caption / altri campi siblings"
  - Stesso pattern per `style` patches
- **Real Image Editor** — `BlockInspector` image case
  - **Crop section** invariato (fit/focal/zoom) + nuovo `reset-crop-btn` per ripristino completo
  - **AdjustmentsSection** — 7 slider editorial-bounded (NON Photoshop):
    - brightness 0.5–1.5, contrast 0.5–1.5, saturation 0–2, warmth -1..+1, grayscale 0–1, blur 0–8px, vignette 0–1
    - Persistenza in `style_json.adjustments` via batch update (verificata E2E)
    - Reset button per azzerare tutte le regolazioni
- **CSS-filter pipeline** (`ImageBlock.jsx` rewritten)
  - `buildFilter()` helper dependency-free: elide identity ops (brightness==1 non emesso) → costo CSS recalc minimo
  - Warmth → `sepia()` per positivo, `hue-rotate(neg)` per negativo (editorial mood control)
  - Vignette overlay separato come radial-gradient softness (no filter)
  - Transition `filter 220ms ease` per slider real-time feedback
- **ImageBlock polish**
  - **Skeleton** con shimmer keyframe (data-testid=`image-block-skeleton`)
  - **Fade-in** opacity 0→1 transition 480ms cubic-bezier(0.22, 0.61, 0.36, 1) — cinematic load
  - **Error fallback** con icona ImageOff + copy "Immagine non disponibile" (data-testid=`image-block-error`)
  - **Empty placeholder** con icona ImagePlus + copy localizzata (data-testid=`image-block-empty`)
- **Save Status UX** premium (Linear/Notion style)
  - 4 stati con testids dedicati: `status-saving` (pulsing dot teal), `status-saved` (check icon), `status-unsaved` (CLICCABILE per manual flush), `status-save-error` (CLICCABILE per retry + tooltip errore)
- **i18n** — 12 nuove chiavi EN+IT
  - editor: `unsaved/resetCrop/adjustments/reset/imageMissing`
  - field: `brightness/contrast/saturation/warmth/grayscale/blur/vignette`
- **Tested ✅** (`iteration_10.json`)
  - Backend: **6/6 new E.5** + **25/25 regression** E.2+E.4
  - Frontend code-review 100% su tutti 13 testids + 7 adjustment paths
  - Persistenza E2E `style.adjustments` verificata via batch PATCH → GET roundtrip
  - Caption preserved across content updates (regression del bug originale) ✓


### ✅ Phase E.4 — Template Preview Gallery + micro Lineage (DONE — 13 Mag 2026)
Trasformazione del picker da "lista nomi" a **editorial archive / design catalog**. Foundation per marketplace futuro.

- **Server-side SVG preview** (`/app/backend/core/template_preview.py`)
  - Pure-Python builder, dependency-free (~150 LOC), nessun raster, nessun asset esterno
  - Genera SVG strutturali da `template_blocks.position_json` con tinte semantiche per type (image/text/palette/note/product/material)
  - Palette blocks rivelano gli **swatch reali** nel preview (max 5 colori)
  - Text blocks emettono "glyph rows" tipografici per size (display/h1/eyebrow/body…) — feeling magazine
  - viewBox 220×360 + cinematic vignette radial
  - Fallback su legacy `content.layout` se `position_json` assente
- **Backend integration** (`routers/templates.py`)
  - `GET /api/templates?with_preview=true` (default) → ogni template ha `preview_svg`, `palette`, `block_count`
  - `with_preview=false` → perf-escape (campi assenti)
  - Detail include sempre `preview_svg` + `palette` + `block_count` + `parent` (lookup leggero)
- **Micro Template Versioning**
  - `apply_template` → `moodboards.template_id` (colonna baseline) ora popolata con l'origine
  - `save_as_template` → legge `src_mb.template_id` e setta `parent_id` sul nuovo template (fork lineage)
  - Detail expandsl il `parent_id` in `{id, name, slug}` via `_attach_lineage`
  - Chain `apply → save-as → detail` produce child.parent popolato (verificato live)
- **Editorial gallery** (`TemplatePicker.jsx` riscritto)
  - Adaptive aspect ratios per categoria (3/4 editoriale, 1/1 hospitality, 5/4 retail/ffe) — typographic rhythm
  - SVG inline via `dangerouslySetInnerHTML` (sicuro — sorgente server-controlled, solo primitive geometriche + hex escape)
  - Hover lift soft con `translateY(-0.5)` + `duration-[var(--bp-duration-cinematic)]` + `ease-emphasis`
  - Palette swatch row (5 quadrati 12px con inset shadow soft)
  - Lineage badge GitBranch "Derivato da un altro template" su fork
  - Fallback "Preset dello studio" per template tenant senza categoria (nessun leak chiave i18n)
  - Modal espanso a `max-w-4xl` con grid `280px_1fr` per dare respiro editoriale alla galleria
- **i18n** — 3 nuove chiavi EN+IT: `templates.startBlank` (Open/Apri), `templates.tenantPreset` (Studio preset/Preset dello studio), `templates.derivedFrom` (Derived from another template/Derivato da un altro template)
- **Tested ✅** (`iteration_9.json`)
  - Backend: **9/9 new E.4** + **20/20 E.1+E.2 regression**
  - Frontend: 10 cards renderizzate con 12 SVG inline visibili, lineage badge attivo su fork, palette swatches visibili, hover lift confermato (-2px), modal layout editorial verificato in screenshot
  - Lineage chain E2E: `luxury-editorial → apply → save-as → child.parent.slug='luxury-editorial'` ✓


### ✅ Phase E.3 — Polish Sprint: Smart Snap + Undo/Redo + Theme Leak Cleanup (DONE — 13 Mag 2026)
Triplo deliverable per chiudere la V1 weekend con feel premium uniforme.

- **Smart Snap System** (`/app/frontend/src/blueprint/moodboard/useSnap.js` + `SnapGuides.jsx`)
  - Threshold 6px, snap a edge/center di canvas + altri blocchi (left/center/right + top/middle/bottom)
  - Modalità separate per `move` vs `resize` (resize snappa solo right+bottom)
  - Guide SVG dashed teal (`var(--bp-primary)`, opacity 0.55, dasharray "2 3") visibili SOLO durante drag attivo, padding 12px oltre span — feeling Framer/Linear/Keynote, ZERO CAD lines
  - Alt-key bypass (idioma Figma/Keynote) per disabilitare snap al volo
  - Toggle button topbar (`data-testid=snap-toggle-btn`, icona Magnet) — default ON, icona teal quando attivo
- **Undo / Redo locale** (`useHistory.js`)
  - Stack JS puro, snapshot completo dei blocks (deep-clone via JSON), max 50 entries
  - Cursor model con branching (pruna future entries quando si registra dopo un undo)
  - Trigger snapshot: create/delete/duplicate/drag-end/resize-end
  - Keyboard: `Cmd/Ctrl+Z` = undo, `Cmd/Ctrl+Shift+Z` e `Cmd/Ctrl+Y` = redo. Guardia su input/textarea/contentEditable
  - Pulsanti topbar (`data-testid=undo-btn/redo-btn`, icone Undo2/Redo2), disabled-state derivato da `history.canUndo/canRedo`
  - Restore: applica snapshot + marca tutti i blocchi dirty (autosave persiste lo stato ripristinato)
- **Theme Leak Cleanup** — 10 pagine legacy
  - Dashboard, Leads, Projects, Proposals, Admin (Overview/Tenants/TenantDetail/Modules/Audit), Insights, Inspirations
  - Mapping bulk: `#0A0A0B → var(--bp-bg)`, `#141416 → surface-1`, `#1C1C1F → surface-2`, `#222226 → surface-3`, `#EFEBE4 → text-primary`, `#A19D98 → text-secondary`, `#6B6863 → text-muted`, `#4A4845/#3A3835 → text-subtle`, `#D4AF37 → primary`, `#0F0F11 → surface-1`
  - White overlays: `white/[0.06|0.08|0.05] → var(--bp-border)`, `white/[0.1] → border-strong`, `white/[0.03|0.02|0.04] → surface-2 con alpha`
  - Wrap automatico via Python script: 44 occorrenze di `var(--bp-*)` correttamente racchiuse in `[var(--bp-*)]` per Tailwind arbitrary-value syntax
  - Tutti i pulsanti CTA legacy ora usano `var(--bp-primary)` invece del fallback `#D4AF37`
- **i18n** — 3 nuove chiavi EN+IT: `moodboards.editor.{undo,redo,snap}` = `Annulla / Ripeti / Snap intelligente`
- **Tested ✅** (`iteration_8.json`)
  - Backend: **26/26 regression** (E.1 + E.2 + isolation/permissions)
  - Frontend: tutti i testids E.3 verificati (undo-btn, redo-btn, snap-toggle-btn, initial-disabled-state, post-mutation-enabled-state), Ctrl+Z/Y/Shift+Z funzionanti con guardia su input
  - Theme leak grep: **0 hex hardcoded** + **0 Tailwind class rotte** su tutte le 10 pagine target


### ✅ Phase E.2 — Templates V1 (DONE — 13 Mag 2026)
Quick-start template system per i moodboard: 7 starter platform + creazione di template tenant-private da qualsiasi moodboard esistente.

- **Migration 007 — Templates seed** (`/app/supabase/migrations/007_templates_seed.sql`):
  - 7 starter template platform (`tenant_id NULL`, `visibility='platform'`, `is_starter=TRUE`): `luxury-editorial`, `hospitality`, `residential`, `retail`, `materials-board`, `ff-and-e`, `concept`
  - Idempotente (ON CONFLICT DO UPDATE), reversibile, structure-only (NO image URLs hardcoded — gli utenti riempiono con i propri asset via upload)
  - `locale_content` JSONB con nome/descrizione tradotti per IT, EN-US, FR, DE, ES
- **Backend** (`/app/backend/routers/templates.py`):
  - `GET /api/templates` — list (platform + own tenant), filtri `category`/`starter_only`/`locale`
  - `GET /api/templates/{id}` — detail con blocks normalizzati (x/y/width/height/z_index estratti da position_json)
  - `POST /api/templates` — create (tenant-scoped, slug unico per tenant)
  - `PUT /api/templates/{id}` — update (platform templates editabili solo da super_admin)
  - `DELETE /api/templates/{id}` — soft archive (`archived_at`)
  - `POST /api/templates/{id}/apply` — clone template_blocks → moodboard_elements creando nuovo moodboard `draft`; mirror `content.src → image_url` per parity con create_block
  - `POST /api/templates/from-moodboard/{moodboard_id}` — snapshot moodboard come nuovo template (tenant-private)
  - **P0 fix**: rimossa colonna `settings` inesistente dall'insert su `moodboards` (era 500). Separation of concerns: moodboard = runtime entity, template = preset/configuration source
  - Tutte le route gated da `require_permission(P_MOODBOARDS_READ/WRITE)`
- **Frontend Quick-start picker** (`/app/frontend/src/blueprint/moodboard/TemplatePicker.jsx`):
  - Shared component riusato su `MoodboardsPage` CreateModal e `ProjectDetailPage` CreateMoodboardModal
  - Tile "Tela vuota" (blank canvas) + 7 starter cards categorizzate
  - 100% Blueprint-driven (zero copy hardcoded, locale forwarded all'API per nomi localizzati)
  - data-testid: `template-picker`, `template-blank`, `template-card-{slug}`
- **Frontend Save-as-template** (`MoodboardEditor.jsx`):
  - Pulsante topbar "Salva come template" (data-testid=`save-as-template-btn`)
  - Slug auto-generato dal titolo (slugify + random suffix), feedback inline stato (saving/saved/error)
- **i18n** — chiavi già presenti in EN-US + IT (`moodboards.templates.{eyebrow,blank,blankDesc,applyBtn,saveAs,category.*}`)
- **Tenant isolation verificata E2E**: studio2 (Showroom) vede solo 7 platform; designer (Studio) vede 7 platform + propri tenant-private. Cross-tenant template detail → 404
- **RBAC verificata**: client → 403 su `apply` e `from-moodboard` (P_MOODBOARDS_WRITE required)
- **Tested ✅** (`iteration_7.json`)
  - Backend: **16/16 new test_phase_e2_templates.py** + 10/10 E.1 regression
  - Frontend: tutti i critical testids verificati con locale IT (Avvio rapido, Tela vuota, Editoriale di Lusso, Ospitalità, Residenziale, Retail, Materiali, FF&E, Concept), apply → editor con blocchi clonati funzionante


### ✅ Phase E.1 — Moodboard Polish Sprint (DONE — 13 Mag 2026)
Sopra la foundation stabile (Sprint Cleanup P0). Tutti i requisiti tecnici del documento utente rispettati: ZERO hardcoded, runtime-editable, theme-token-based, multi-tenant, i18n-ready, migration-safe.

- **Migration 006 — V2 Scaffold** (`/app/supabase/migrations/006_moodboard_v2_scaffold.sql`):
  - 4 tabelle pronte per V2 (75 colonne tot., 12 indici, FK cascade corretti) — **NON esposte** alle API in V1 ma già queryable
  - `moodboard_templates` (23 col): global+tenant, parent_id per fork, category/tags GIN, visibility (private/tenant/platform/marketplace), is_starter, locale_content i18n, ai_metadata, analytics_metadata
  - `template_blocks` (15 col): stesso shape di `moodboard_elements`, indice `(template_id, sort_order)`
  - `moodboard_versions` (16 col): snapshot completo JSONB, `kind` (autosave/named/presentation/rollback_restore/client_view_snapshot), `parent_version_id` per branching, `version_number` UNIQUE, hash, is_milestone
  - `moodboard_comments` (21 col): block_id nullable (canvas-anchored via x/y), parent_comment_id per thread, author_role (designer/client/super_admin/anonymous_share), mentions UUID[], resolved bool con `resolved_by`, partial index `WHERE resolved=FALSE`
- **Block Duplicate endpoint** (`POST /api/moodboards/{id}/blocks/{block_id}/duplicate`): clone con offset +24/+24/+z, locked/hidden resettati a false
- **UUID path validation**: route `/api/moodboards/{id}` rifiuta non-UUID → 404 pulito (era 500)
- **Layer Management UI** (`blueprint/moodboard/LayersPanel.jsx`):
  - Lista layer ordinata per z-index discendente (top of stack first)
  - Hover toggles per `lock` / `hidden` (persistiti come colonne strutturate)
  - Toolbar contestuale 6-azioni: bring-to-front · bring-forward · send-backward · send-to-back · duplicate · delete
  - Right rail con tab switcher Inspector / Layers (data-testid `tab-inspector`, `tab-layers`)
- **Image Upload reale** (`blueprint/moodboard/ImageUploader.jsx`):
  - Drag-and-drop + click to upload, progress bar, error state, IT/EN strings
  - Flow: signed-upload → PUT direct to Supabase Storage `moodboard-assets` → register in `media_library`
  - Disponibile in inspector di image/product/material blocks
- **Crop + Focal Point UI**:
  - Inspector image ha sezione "Ritaglio e focal point": select `fit_mode` (cover/contain/fill), grid 3x3 focal preset, slider zoom (100%-300%)
  - Tutti i field persistiti in `style_json` JSONB (non più `content.layout`)
  - `ImageBlock.jsx` ora renderizza con `object-fit` + `object-position` + `transform: scale()` correlati
- **Opacity + Rotation**: slider per text/note blocks + struttura DB completa anche per altri tipi
- **Presentation Mode** (`PresentationMode` component):
  - Fullscreen cinematic (z-50, bg surface), hide editor chrome
  - Sequential navigation con keyboard `←` `→` `Space` + footer prev/next
  - Counter `i / N` (paginazione blocchi visibili)
  - `Esc` exit
- **Locked blocks**: non draggable, cursor-default, resize handle nascosto. Hidden blocks: opacity 0.3 in editor, esclusi dal canvas in readOnly + presentation
- **i18n**: 23 nuove chiavi (`moodboards.editor.{layers,present,duplicate,lock,hide,upload,uploading,uploadFailed,crop,…}`, `moodboards.field.{fitMode,focalPoint,zoom,opacity,rotation}`) tradotte in EN-US e IT
- **Tested ✅**
  - Backend: **95/95 regression** + **9/9 nuovi E.1** (test_phase_e1.py) — 100%
  - Frontend: editor IT integrale, tabs Inspector/Layers funzionanti, Presenta entra in fullscreen, Esc esce, exit-btn funziona, IT verificato su 23 nuove chiavi
  - V2-scaffold tables: queryable via SQL, NOT exposed via REST (atteso)


### ✅ Phase E (V1) — Blueprint Moodboards™ + Workspace Extended (DONE — 13 Mag 2026)
End-to-end operational loop closed: **Lead → Project → Workspace → Moodboard → Approval → Share**.

- **Moodboards V1 backend** (`routers/moodboards_v1.py`):
  - Block CRUD (`POST/PUT/DELETE /api/moodboards/{id}/blocks`) for 6 V1 types: `image · text · palette · note · product · material` + 4 future-stub types accepted server-side (`hotspot · video · vendor · product_grid`)
  - **Autosave bulk patch** (`PATCH /blocks/batch`) — drag/resize positions persisted in `content.layout` (no schema migration)
  - **Approval state machine** aligned to Supabase `moodboard_status` enum: `draft → sent → viewed/approved/revision_requested/rejected → …` with explicit invalid-transition 400
  - **Share token** (`POST /share` + anonymous `GET /public/share/{token}`) — token→moodboard reverse lookup via `tenant_settings`, 403 on draft, full block list in response
  - Pushes `moodboard.*` events into project activity stream
- **Workspace Extended backend** (`routers/workspace.py`):
  - Tasks, Notes (pinned-first sort), Activity stream — all per-project, stored in `tenant_settings` keys (`project.{id}.tasks|notes|activity`), schema-migration-free
  - **Lead → Project converter** (`POST /api/workspace/leads/{lead_id}/convert`) — creates project, links `lead_id`, sets lead.status=`project_opened`, audit-logged, activity event pushed
- **Block registry frontend** (`/blueprint/moodboard/BlockRegistry.js` + 6 block components) — token-driven, locale-aware, no hardcoded copy
- **MoodboardEditor.jsx** — V1 canvas editor: drag-to-move, corner resize, debounced 800ms autosave with Saving/Saved indicator, left rail block toolbar, right rail inspector per-type (image src/caption · text/size · note · palette colors picker · product/material), workflow toolbar (Send for review → Approve/Reject/Request revision), Share dialog. ALL labels via `t()`
- **MoodboardsPage.jsx** — luxury list: status-tone cards, 7 filters (Tutti/Bozze/Inviati/Visti/Approvati/Revisione/Rifiutati), create modal with optional project linker
- **ProjectDetailPage.jsx** — 5-tab workspace (Panoramica/Attività/Note/Moodboard/Diario), all i18n-driven, luxury create-moodboard modal (replaced browser `prompt()`)
- **LeadsPage.jsx** — added per-row "Converti in progetto" CTA that navigates to project detail
- **ProjectsPage.jsx** — project cards now wrapped in `<Link>` (accessible, deep-linkable)
- **i18n bundle** — 40+ new keys under `moodboards.*` and `workspace.*` in EN-US + IT, with status translations matching real DB enum values
- **BlueprintContext locale fix** — pre-resolves tenant default locale before fetching messages (eliminates en-US flash on first paint)
- **Tested End-to-End ✅**
  - 25/25 backend pytest pass (full Phase E: moodboard CRUD, blocks for all 6 types, batch autosave, approval state machine, public share gate, tasks/notes/activity, lead.convert)
  - Frontend e2e: moodboards list (3 cards), filter tabs, new-moodboard modal, editor canvas with drag/resize, inspector, send-review → approve, share dialog → public anonymous page (readOnly)
  - IT locale verified across breadcrumb/sidebar/page/filter/badges from fresh browser state


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


### ✅ Phase D — Blueprint Dynamic Form Engine™ (DONE — 13 Mag 2026)
Enterprise-grade schema-driven form engine. Reusable for: lead-gen · design requests · onboarding · moodboard approvals · proposal approvals · concierge · surveys · feedback · vendor applications · sourcing requests.

- **Backend** (`core/form_registry.py` + `routers/forms.py`):
  - 18 field types: short_text, long_text, email, phone, country, single_choice, multi_choice, style_cards, mood_cards, image_choice, slider, budget_slider, timeline_picker, scale, file_upload, signature (coming-soon), consent, statement
  - 10 form purposes with `writes_to` hints (lead → leads table · concierge → concierge_requests · etc.)
  - 5 layouts × 5 atmospheres for cinematic UX variants
  - Default seed `design_request` form: 4 steps, 10 fields, complete with style_cards + budget_slider + timeline_picker
  - `evaluate_conditional()`: equals · not_equals · in · not_in · gt · lt · truthy (server + frontend mirror)
  - `validate_submission()`: required + strict email regex
  - Endpoints under `/api/forms`: GET registry, GET list, GET/PUT/DELETE slug, duplicate, reset, list submissions
  - Public endpoints under `/api/forms/public/{tenant}/{form}`: GET form (status=published gated, internal fields ai/scoring/integrations STRIPPED), POST submit (validation + lead-row auto-insert for lead/design_request purposes)
  - Forms stored in `tenant_settings` (`form.{slug}`); submissions in `tenant_settings` (`form_submission.{slug}.{uuid}`) — schema-migration-free
- **Frontend Field Engine** (`/app/frontend/src/blueprint/forms/`):
  - `FieldRegistry.js` → 14 components for 17 server types (image_choice→SingleChoice, mood_cards→StyleCards, country→ShortText) + `resolveI18n()` + `evaluateVisibility()`
  - `FormRenderer.jsx` — cinematic multi-step renderer: sticky teal progress bar · per-step validation · conditional visibility · thank-you state with auto-redirect · sticky Back/Continue bar
  - 14 field components, all theme-driven, locale-aware: editorial underline inputs, style_cards image grid with check overlay, budget_slider with currency display large, timeline pills, scale 1-5 circles, file_upload dashed dropzone, consent custom checkbox
- **FormBuilderPage** (`/settings/forms`):
  - List view: form catalog with status badge (draft/published), New/Edit/Duplicate/Delete
  - Edit view: 280px left rail steps stack (reorder/delete) + center step editor with field property panels + add-field modal (18 cards categorized) + Preview mode toggle + Publish toggle + Visit-form link
  - Locale switcher for editing translations (`_default · en-US · it · fr · de · es`)
- **PublicFormPage** (`/f/:tenantSlug/:formSlug`):
  - Unauthenticated · loads tenant theme + form schema · uses FormRenderer · submits to public endpoint
- **Section Engine integration**: new `form_embed` section type (category=conversion, reusable_in=homepage/landing/showcase/client_portal) with `inline` and `modal_trigger` variants — links homepage CTAs to forms via `form_slug`, ZERO hardcoded URLs
- **AI placeholders** ready for future iterations: `form.ai = {field_suggestions, question_generation, copy_enhancement, auto_localize, scoring}` — flags default to false
- **Tested End-to-End** ✅
  - 19/19 backend pytest pass (CRUD, publish gate, internal field stripping, validation, conditional primitives, reusability check: concierge purpose does NOT write to leads)
  - All frontend critical flows verified
  - Bugs fixed during testing: (1) lead row `budget` → `budget_range` column drift, (2) error data-testid for field validation, (3) email regex tightened, (4) signature marked coming-soon


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
- ✅ Form Engine completo (DONE in Phase D)
- ✅ Public form route /f/:tenantSlug/:formSlug (DONE)
- ✅ Form embed section type in Section Engine (DONE)
- Blueprint Workspace™ extension (Timeline, Files, Proposals, Signoff, Client Portal, Tasks, Notes)

### Phase E — Blueprint Moodboards Editor
- ✅ V1: block-based canvas (image/text/palette/note/product/material), drag+resize, debounced autosave, approval state machine, public share token (DONE in Phase E)
- ✅ E.2 Templates V1 — Apply/Save-as flow, Template Picker, RBAC (DONE)
- ✅ E.3 Polish Sprint — Snap System, Undo/Redo, Theme leak cleanup (DONE)
- ✅ E.4 Template Preview Gallery + Lineage (SVG previews, parent_id tracking) (DONE)
- ✅ E.5 P0 Stability & Media Pass — Image adjustments, reliable autosave, upload persistence (DONE)
- ✅ Lead→Project converter + Tasks/Notes/Activity (DONE in Phase E)
- Future (V2 advanced): PDF export, hotspot system, AI material suggestions, version history UI

### Phase F — Blueprint Moodboard PRO™ (Multi-page Presentation OS)
- ✅ F.0 Multi-page Foundation — pages CRUD, PagesNavigator sidebar, auto-migration of legacy moodboards (DONE)
- ✅ F.1 Structural Multi-page Templates — Luxury Residential / Hospitality / Material Board seeds, placeholder semantics, page cloning (DONE)
- ✅ P0 Bug Sprint (Feb 14 2026) — Responsive canvas (non-mutating scale), Layers ↔ Canvas sync, ±1 neighbor swap arrows, HTML5 Drag&Drop layers, Master Layouts™ Skeleton Picker on Add-page (12 skeletons across 7 categories) (DONE — iteration_14)
- ✅ F.2 Presentation Sequencing V2™ (Feb 14 2026) — PresentationMode V2 cinematic engine with letterboxing, 6 GPU-only transitions (fade/dissolve/slow_slide_left/up/cinematic_zoom/soft_blur_crossfade), chapter navigation overlay (press `c`), idle auto-hide overlays, keyboard-first nav (→ ← Space Esc Home End), PageInspector tab for per-page transition + chapter_label + hidden_from_client + hidden_in_presentation, public /presentation/{shareToken} route (no auth, client-safe filter), BONUS: POST /api/templates/inject-into/{moodboard_id} for appending template pages into existing moodboards (DONE — iterations 15+16)
- ✅ UX Bug Sprint post-F.2 (Feb 14 2026) — (1) empty-title inline red-ring + localized error on Create Moodboard, (2) apply_template batch insert (Luxury 8-page apply 30s→~1s) + 90s axios timeout override, (3) ImageBlock signed-URL fallback for private buckets + ImageQuickAdjust modal opens right after upload (fit/focal/brightness/contrast/saturation, custom focal-point via preview click) keeping fine controls in sidebar, (4) right-sidebar 3 tabs converted to icon-only with tooltip+aria-label (DONE — iteration_17)
- ✅ Blueprint Moodboard Builder PRO™ Final UX Alignment (Feb 14 2026) — Editorial cinematic restyle inspired by the user's reference mockup: (a) Topbar with MOOD for DESIGN brand lockup + breadcrumb (Project / Moodboard / Name) + premium teal Presenta/Approva/Condividi action group; (b) Centered horizontal ActionToolbar (Seleziona·Deseleziona·Sposta·Ridimensiona | Testo·Immagine·Galleria·Prodotto·Materiale | Palette·Forma·Linea·Hotspot·Note); (c) NEW LibraryPanel left rail with Blocchi/Contenuti tabs, server-registry-driven structural skeletons grouped by category, Elementi salvati stub, Libreria personale CTA; (d) PagesNavigator MOVED from left vertical to bottom horizontal PagesFilmstrip preserving every add/duplicate/delete/reorder handler; (e) Autosave teal dot + 'Salvataggio automatico attivo' bottom-right. All Blueprint-driven, i18n IT/EN, 100% no regression (DONE — iteration_18)
- ✅ Blueprint Inspirations™ Foundation — Creative Memory System™ (Feb 14 2026) — BACKEND-ONLY architecture phase. 4 normalized tables via migration 011 (inspirations_boards / inspirations_items / inspirations_activity / inspirations_comments), tenant-scoped with optional lead/project/moodboard linkage, future AI-ready JSONB fields (metadata/style_tags/ai_tags/extracted_palette/position). Full CRUD router /api/inspirations/boards (+ /items, /activity, /comments, /_meta/registry). First-class activity timeline events (board_created/updated, item_added/moved/tagged/updated/removed, linked_to_project/lead/moodboard, comment_added). designer + client roles granted INSPIRATIONS permissions. FK pre-validation prevents 500 on stale UUIDs. 32/32 pytest GREEN, zero critical issues (DONE — iteration_19)
- ✅ UX Rewrite + Premium Interaction System — P0 Drag & Image perf (Feb 14 2026) — rAF-throttled mousemove with GPU `willChange: transform`, scale-aware drag deltas, `loading="lazy"` + `decoding="async"` on ImageBlock, signed-URL fallback for private buckets, ImageQuickAdjust modal hardened (DONE — iteration_20)
- ✅ P0 Editorial Aesthetic Sprint (Feb 15 2026) — Workspace Mode toggle Editorial Light™ ↔ Cinematic Dark™ with sun/moon button in topbar, localStorage persistence (`mfd_workspace_mode`), `prefers-color-scheme` fallback, `[data-workspace-mode="light"]` palette override block in index.css (warm ivory #F5F1EB, charcoal ink #1E1B18, soft separators 0.08 alpha, teal accent preserved, subtle paper grain via body::before). Premium image rendering: removed always-on `.bp-img-cinematic` darkening filter, new `.bp-img-in` blur-up cinematic fade-in (720ms cubic-bezier with slight scale settle), softer editorial `.bp-img-shimmer` skeleton. Cinematic Crop UX rewrite: ImageQuickAdjust modal rebuilt as a "camera framing tool" with full-bleed blurred-image backdrop, pointer-drag focal handle (concentric cross, rAF-throttled), oversized 16:10 preview, minimal floating control rail. Autosave SOFT PULSE™: replaced verbose "Salvataggio…" text with a 6px dot that breathes during saves, briefly glows on success (`.bp-soft-confirm`), turns red+retry only on persistent failure. Lifted QuickAdjust modal to editor root so it survives block-selection changes mid-adjust. Added `data-testid='inspector-image-file-input'` (DONE — iteration_21)
- ✅ P0 Stabilization Sprint (Feb 15 2026) — CRITICAL slider remount bug fix: BlockInspector's CropFocalSection / AdjustmentsSection / VisualPropsSection were declared as nested arrow functions which made React see them as a NEW component type on every render → the entire slider section was unmounted/remounted on every input event, destroying focus and producing the "sliders refresh while dragging" UX bug. Refactored into plain JSX expressions (`cropFocalJsx`, `adjustmentsJsx`, `visualPropsJsx`) so the DOM stays stable across renders → Figma-grade slider drag. Collapsible Main Sidebar (220↔64px) and LibraryPanel (240↔56px) with localStorage persistence (`mfd_sidebar_collapsed`, `mfd_library_collapsed`) — together free up to 340px of horizontal canvas space. Removed duplicate user profile from Sidebar bottom — only Topbar shows the user chip now. Bundled real MOOD for DESIGN logo (`/public/brand/logo-dark.png` + `logo-light.png`) and wired through Brand component with CSS-only mode swap (.brand-mark--dark / --light opacity) — instant flicker-free flip on workspace mode toggle. Editorial range-slider styling (`.bp-slider` with native vendor-styled track + thumb that scale & flush teal on hover/active). Cinematic contrast bump (--bp-text-primary #F5F2EC, --bp-text-secondary #C7C2BB, --bp-text-muted #908B85 in dark mode). DashboardLayout + Topbar fully mode-aware (removed hardcoded #0A0A0B that broke light mode). Frontend testing 85% PASS with slider remount fix verified by independent code path (DONE — iteration_22)
- ✅ G.0 Blueprint Client Collaboration Layer™ MVP (Feb 16 2026) — generic entity-agnostic engine reusable by Moodboard + future Proposal Builder. Migration 012 with 5 collab tables (collab_comments, collab_page_status, collab_activity, collab_inspirations, collab_versions) all keyed by (entity_type, entity_id). Router `/api/collab/*` exposes designer + UNAUTHENTICATED public surfaces (`/api/collab/public/{share_token}/*`) gated by existing moodboard_shares tokens. NEW route `/review/:shareToken` is the dedicated client collaboration mode (separate from /presentation cinematic walkthrough). UX delivered: top progress strip (Approved · Revision · Pending counts), anchored comment pins with click-to-place pointer flow, role-colored pin avatars (teal=designer · amber=PM · paper=client), single-level threaded replies via CommentThreadDrawer, frictionless name+email identity capture (IdentityModal + useClientIdentity persistence per entity), page-level decision bar with "Approve" / "Request revision" buttons, page rail with status dot per page, micro decision animations (.review-flash-approved/revision 900ms), Activity Timeline (premium editorial feed — not audit log), "Ideas & References" client uploader (drag-drop image/PDF → Supabase Storage via dedicated `/upload` proxy), version-snapshot capture endpoint + "Prepare Project Proposal" handoff CTA that surfaces in the editor topbar ONLY when all pages reach `approved`. PagesFilmstrip in the editor now shows colored status badges per page. Share dialog upgraded with three explicit links (Client Review · Cinematic Presentation · Legacy). Backend curl validation confirmed: comments+statuses+activity round-trip end-to-end (DONE — iteration_23)
- ✅ P0 Editorial Controls + Premium Interaction Sprint (Feb 16 2026) — Typography Controls System on TextBlock inspector: font family pills (Display/Body/Mono bound to CSS vars for future Global Project Styles), font size (10..120px), weight (100..900), line height (0.8..2.4), letter spacing (-50..400 units), alignment (L/C/R/Justify), Italic/Underline/Uppercase decoration toggles, List style (None/Bullet/Numbered), Color picker + hex. TextBlock rewritten to honor `style.typography` with CSS-var-bound families and one-block-per-line lists. Shape Block PRO™ — new `shape` block type (rectangle / ellipse / line) with fill color, border color/width/style (solid/dashed/dotted), corner radius, plus visualPropsJsx for opacity/rotation. Registered server-side in SUPPORTED_BLOCK_TYPES. Page Background System — color + image URL + overlay opacity controls in PageInspector, rendered in editor canvas + Review Mode (page-background overlay layer above the bg image, below blocks, for legibility on photo backdrops). Layer System PRO — double-click layer label to rename, persists in metadata.layer_label (separate from derived caption/text label so renames don't overwrite content); existing lock/visibility/drag-reorder/insertion-indicator preserved. Telemetry Foundation — migration 013 product_events (append-only event log), `/api/events/track` endpoint (silent-fail, accepts anonymous /review/ calls), frontend `trackEvent()` helper with sessionId + Bearer auto-attach. Emits: moodboard.block_added, moodboard.shared, moodboard.template_saved, moodboard.skeleton_applied. Skipped from this sprint (deliberate): Arrow System (deserves dedicated sprint), 5 mockup templates (needs user-provided reference assets), equal-spacing snap hints, drag shadow (cosmetic) (DONE — iteration_24)
- ⏳ F.3 Master Layouts + Placeholder Inspector V2 (P2)
- ⏳ F.4 Reusable Blocks + Asset Library (P2)
- ⏳ F.5 Global Project Styles (P1) — typography controls already wired to CSS var bindings, just need tenant-level overrides
- ⏳ F.6 Skeleton Rebuild Foundation — AI extract layout from reference image (P3)
- ⏳ F.7 Product Library Foundation (P3)
- ⏳ F.8 Blueprint Inspirations UI™ — Personal · Project · Shared boards (P1)
- ⏳ F.9 Typography & Spacing global polish — reduce uppercase density across Inspector & Topbar (P2)
- ⏳ G.1 Arrow System (straight + sketch) + 5 designed mockup templates (P1 — next sprint)
- ⏳ H.0 Insights™ — first SQL rollups over product_events

### Phase F continued — Inspirations CMS + Insights + Concierge (post-Moodboard)
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
