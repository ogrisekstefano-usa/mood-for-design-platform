# MOOD for DESIGN — Platform PRD

## Project Overview
Multi-tenant editorial SaaS for interior design, architecture firms, showrooms and luxury retailers.
**ONE platform → MULTIPLE frontends → ONE database** architecture, shared Blueprint CMS engine.

**Live tenant:** `mood-corporate` (uuid `51f9ab4d-1aaf-5b8b-b7a9-8a4c8f942a50`)
**Domain:** `www.moodfordesign.com` (mapped via `tenant_domains`)
**Stack:** React + FastAPI + Supabase PostgreSQL + Supabase Storage + Anthropic Claude (AI editorial)

---

## Architecture
- ONE Supabase project (16 + custom migrations applied)
- Tenant isolation: `tenant_id` FK on every business table
- Locale chain: requested → `en-us` → first available
- Cache: in-process TTL (Redis-ready)
- Draft/Published architecture on `cms_pages` + `journal_articles` (`draft_json`, `published_json`, `content_revisions`)
- AI service is **provider-abstracted** (`services/ai_editorial.py`) — swap provider via `.env`

---

## Sessions completed

### Session V: ITER149 REBUILD — Premium Editorial Homepage matching mockup (May 24, 2026) ✅
- Complete rebuild of the homepage to match the official cinematic luxury mockup (laptop + phone hero, real curated brand wordmarks, 5 platform pillars, design journey, editorial triptych, immersive final CTA, full 5-column editorial footer)
- **New palette**: navy `#050816 / #08101D / #0B1320` + cyan `#19F0FF / #11D9E6` + text `#F5F7FA / #C9D2DC / #8B96A7`
- **New typography**: Playfair Display headlines + Inter body. Body **18px** desktop (16px mobile), labels 14px min, headings +25%. WCAG AA pass.
- **6 new section components** (all DB-driven via editorial_blocks + media_library):
  - `HeroEditorial` — split with cinematic device image on right
  - `CuratedBrands` — monochromatic wordmark strip (PORRO · Minotti · B&B Italia · Poliform · Gallotti&Radice · FLOS · Flexform · Lualdi) — labels from `site.home.brands.*`
  - `PlatformPillars` — 5 circular-icon cards (Curated Journeys™ / Editorial Moodboards™ / Relationship Memory™ / Material Intelligence™ / Blueprint Atelier™)
  - `DesignJourney` — left rail title + 4 cinematic interior cards (Ascolto / Curatela / Progetto / Realizzazione) with numbered captions
  - `EditorialTriptych` — 3 wide image cards (Magazine / Projects / Materials) with hover scale + cyan CTAs
  - `FinalCTAImmersive` — full-bleed dim background "Pronto a iniziare il tuo percorso?"
- **New chrome:**
  - `MinimalNav`: Logo + Magazine · Projects · Materials · About + Sign in + Begin your Journey (outline) + Professional Access (cyan filled)
  - `EditorialFooter`: 5 columns (Magazine · Projects · Materials · Company · Legal) + brand block + social + language dropdown
- **New seed** `db/seed_iter149_rebuild.py` — 84 editorial blocks × 5 locales = 420 translations, 9 media_library entries, 8 cms_sections
- Frontend lint clean, end-to-end smoke screenshots verified.

### Session IV: ITER149 — Public Website Engine + Blueprint Command Center (May 24, 2026) ✅
- **Architectural pivot**: site is now 100% DB-driven via `editorial_blocks` (i18n copy) + `media_library` (UUID asset refs) + `cms_sections` (layout skeleton only). Zero hardcoded content.
- **Backend (5 new files):**
  - `services/site_resolver.py` — joins cms_sections ⇄ editorial_blocks ⇄ media_library with locale fallback chain
  - `routers/site.py` — public read APIs (`/api/site/pages/{slug}`, `/site/navigation`, `/site/footer`, `/site/locales`, `/site/block`)
  - `routers/admin_site.py` — Blueprint Command Center APIs (blocks CRUD, sections reorder/toggle, media list/register, publish/unpublish, cache invalidate, whoami)
  - `db/seed_site_iter149.py` — comprehensive seed: 44 editorial_blocks × 5 locales (it/en-us/fr/de/es), 8 media_library entries, 8 cms_sections, navigation + footer config
  - Added UNIQUE constraint `editorial_blocks(tenant_id, namespace, block_key)` for idempotent upserts
- **Frontend Phase A — new homepage (6 sections, all DB-driven):**
  - `HeroCinematic` — split layout with editorial italic teal subhead + cinematic image
  - `SelectedProjects` — 3 luxury project tiles (Villa Riviera / Atelier Milano / Casa Brera)
  - `MagazineHighlights` — 3 article cards on warm ivory background (no dates per brief)
  - `MaterialsBrandPartners` — typographic-only (no fake brand logos)
  - `ProcessJourney` — 4-step editorial (Ascolto / Curatela / Progetto / Realizzazione) on warm ivory
  - `FinalCTA` — architectural cinematic CTA with Begin Journey + Professional Access
- **Frontend chrome:**
  - `MinimalNav` — Magazine · Progetti · Materiali · Chi siamo · Accedi + IT switcher + "Inizia il Percorso" primary CTA
  - `SlimFooter` — manifesto + single-row links + social + locale + legal
- **Frontend Phase D — Login page:**
  - Single email/password form (no SSO)
  - Two secondary CTA links: "Cliente privato? Inizia il tuo percorso" / "Professionista? Richiedi accesso"
  - All copy from `site.login.*` editorial_blocks
- **Blueprint Command Center Admin UI (`/admin`):**
  - Auth gate (X-Admin-Key header, dev mode bypass)
  - Editorial Blocks editor with namespace tabs (Homepage / Navigation / Footer / Login) + per-locale textareas (IT/EN-US/FR/DE/ES) + Save
  - Sections manager — visibility toggle + up/down reorder, shows content-key and media-slot counts
  - Media Library — grid view + URL registration + UUID copy
  - Publishing console — publish/unpublish home + cache invalidate
- **Locale Governance**: `tenants.active_languages` set to `[it, en-us, fr, de, es]`, default `it`. Public LocaleSwitcher and admin reads enabled list from `/api/site/locales`.
- **Routes restructured**: `/admin/*` → AdminApp, all other `/*` → CorporateApp. Legacy paths redirected (/platform, /journal, /for-studios, etc.)
- **Audit-clean**: no Unsplash URLs in components (only inside media_library rows), no hardcoded labels in nav/footer/sections.

### Session III: Premium Editorial Homepage V5 (May 19, 2026) ✅
- Rewrote homepage to match the latest dark-luxury Italian mockup (no SaaS feel, no fake brands/testimonials/metrics)
- **3 new section types** registered in `SectionRenderer`:
  - `workflow_ecosystem` — 8-step horizontal flow (Lead → CRM → Moodboard → Projects → Hotspot → Editorial → Publishing → Retention) with teal icons + arrow connectors
  - `experience_pillars` — 4-column "Un sistema nato dall'esperienza" pillars
  - `fragmented_tools` — 8-icon "Oggi il tuo lavoro è frammentato" problem grid (WhatsApp/Email/PDF/Drive/Pinterest/Excel/File dispersi/Strumenti scollegati)
- Extended `EditorialHero`:
  - New italic teal `subheading_accent` + italic white `subheading_white` sub-headline block
  - New `floating_card.style: 'phone'` variant — phone-shaped mock with circular progress (62%) + phase rows
- `DeviceShowcase` now parses `*ambiente*` markdown for inline italic-teal serif accent
- `CTASection` supports multi-line headlines via `pre-line` and `max-w-6xl`
- Removed legacy `logos_wall` (fake brand list), `testimonial_grid` (fake quotes), `metrics_strip` (fake numbers) from home — per user direction (no fake content)
- New seed `db/reseed_home_v5.py` — idempotent, multilingual; rewrites home & navigation
- Updated navigation: Piattaforma, Per gli Studi, Per i Retailer, Template, Journal, Chi siamo (removed "Prezzi")
- CTA in nav: "Richiedi una demo"

### Session II: Dark Editorial Redesign (May 2026) ✅
- Complete frontend palette overhaul: dark `#0A1320` ink, brand teal `#3DDAD0`, warm bone `#F5F2EC`
- New design tokens in `index.css`: pill buttons, feature chips, step circles, glow halos, grain texture, ink/light surface helpers
- Rewrote `CorporateNav` (dark, glass-on-scroll, new MoodLogo wordmark with teal ⊙⊙ + stacked "for DESIGN")
- Rewrote `LocaleSwitcher` (dark dropdown)
- Rewrote `EditorialHero` with floating "Project Overview" card (Villa Riviera + progress bar), feature chips strip, italic Playfair accent line
- Rewrote `MetricsStrip` (cinematic dark, 4 big serif numbers with teal icon bubbles)
- Rewrote `SplitStory` (dark editorial, optional bullets, dashboard mockup support)
- Rewrote `FeatureNarrative` (dark grid, hairline dividers, teal icon bubbles)
- Rewrote `CTASection` (cinematic dark, optional background image + gradient overlay)
- Rewrote `LogosWall` (supports dark + light press strip)
- **3 new section types**: `ProcessSteps` (6-step Client Journey), `ProjectShowcase` (light bone, project cards), `PressLogos` (Used and loved by …)
- Updated `CorporateFooter` colors to new palette
- `SectionRenderer` registry extended with the 3 new types
- New seed `db/reseed_home_v2.py` — idempotent, multilingual (it/en-us/en-uk/fr/de/es), repopulates home with the new section sequence:
  hero → metrics → split flow → process journey → project showcase → press logos → CTA
- All content multilingual & DB-driven. SEO meta updated.

### Session 0 (P0): Corporate CMS Persistence (May 2026) ✅
- Backend connected to real Supabase via Transaction Pooler
- Tenant resolver + cache + repository pattern
- 8 corporate `cms_pages` + 26 `cms_sections` + navigation row seeded
- Forms persisted (`contact_submissions`, `newsletter_subscribers`, `studio_registrations`)
- Zero runtime dependency on `seed_data.py`

### Session I: Journal/Media Engine + Draft/Published + AI Foundation (May 2026) ✅
**Migration 019** registered in `schema_migrations`.

**New tables:**
- `journal_articles` (status + draft_json/published_json + AI metadata + hero asset + soft delete + audit)
- `article_localizations` (per-locale slug/title/excerpt/SEO + UNIQUE (locale, slug))
- `journal_article_blocks` (section-based builder: hero_cinematic, paragraph, gallery_masonry, quote, video, cta, designer_bio, product_hotspot_image, related_articles, divider, spacer, two_columns, full_image)
- `article_hotspots` (shoppable/storytelling hotspots on images)
- `journal_categories` + `article_category_map`
- `journal_tags` + `article_tag_map` (groups: material/style/designer/country/year/other)
- `content_revisions` (generic audit trail: autosave/publish/revert/archive)
- `ai_assist_logs` (provider/model/tokens/latency/cost observability)

**Extended tables:**
- `cms_assets` — added: `caption`, `photographer`, `copyright`, `dominant_color`, `palette`, `aspect_ratio`, `mime_type`, `file_size_bytes`, `hotspots`, `variants`, `folder_path`, `locale`, `deleted_at`, audit
- `cms_pages` — added: `draft_json`, `published_json`, `approval_stage`, `deleted_at`
- `cms_sections` — added: `deleted_at`

**Enums created:** `journal_article_type`, `journal_article_status`, `revision_action`, `ai_assist_action`
**Triggers:** `mood_touch_updated_at()` on 7 tables

**Supabase Storage buckets created (public read, 50MB limit):**
- `cms-assets` — CMS images for corporate + tenant sites
- `journal-media` — Journal articles media
- `tenant-branding` — Logos / favicons / brand kits

**Services layer (provider-abstracted, tenant-aware):**
- `services/storage.py` — Supabase Storage REST client (ensure_buckets, upload, public URL, delete)
- `services/media_library.py` — upload + Pillow metadata extraction + hotspot CRUD + soft delete
- `services/journal_service.py` — articles CRUD + blocks + draft/publish/revert + revisions
- `services/cms_writer.py` — page autosave/publish/revert + section reorder/patch/delete
- `services/ai_editorial.py` — Claude Sonnet 4.5 (Emergent LLM Key) with full observability logging

**New API endpoints (35 routes):**
- Media (5): upload, list, patch, delete, hotspots
- Journal public (4): articles list, article detail (slug+locale), categories, tags
- Journal admin (9): article CRUD, block add/reorder, draft autosave, publish, revert, revisions, category+tag upsert
- CMS admin (10): list pages, get page, autosave draft, publish, revert, section CRUD/patch/reorder/delete, revisions
- AI editorial (8): topics, outline, seo, excerpt, copy, translate, categorize, photo-direction

**Tests:** 30/30 end-to-end smoke at `/app/backend/tests/test_session_i_e2e.py` — all green.

---

## Prioritized Backlog

### P1 — Next session
- [ ] **Blueprint admin UI** — page/section/article editor bindings (admin lives in separate Blueprint codebase; consumes our new APIs)
- [ ] **Auth + RBAC**: wire `_auth.py` placeholder to Supabase Auth + `tenant_memberships` (replace `require_admin_tenant` with real JWT)
- [ ] **Multilingual URL routing on frontend** (`/it/`, `/fr/` etc. reading entirely from DB)
- [ ] **Brand / Licensing system** — commercial onboarding-ready, before Stripe
- [ ] **Replace hardcoded corporate image URLs** with `cms_assets` rows + `cms_sections.asset_refs`
- [ ] **Public journal page** (masonry layout, filters chips, featured article) at `/journal`

### P2 — Backlog
- [ ] **Email service** (Resend / SendGrid) for contact + newsletter (currently persist only, NO email dispatch)
- [ ] **Stripe Subscriptions** + webhook → pricing → checkout
- [ ] **Tenant self-registration** → auto-provisioning `{slug}.blueprint.moodfordesign.com`
- [ ] **AI image generation** via Nano Banana / GPT Image 1 (`ai_assist_logs.action = 'image_prompt'` already prepared)
- [ ] **Dynamic SEO + Schema.org** per page+locale
- [ ] **Redis** drop-in replacement for in-process TTL
- [ ] **Image optimization pipeline**: webp/avif variants, blur placeholders, focal-point crops
- [ ] **CDN** in front of Supabase Storage
- [ ] **Audit log integration** with `content_revisions` UI (diff view, restore)

### Tech debt
- [ ] Pydantic `EmailStr` validation on forms
- [ ] Studio slug uniqueness suffix (collision-safe)
- [ ] Env-driven cache TTL
- [ ] `ADMIN_API_KEY` set in prod (currently no-op in dev)
- [ ] Rename Pydantic field `register` in `TranslateRequest` (shadows BaseModel attr)

---

## Code Quality (Feb 2026)

### Refactor passes applied (post code-review)
- **Critical bugs fixed:**
  - `result` undefined paths refactored with `return-in-try` / `try/except/else` in `routers/media.py`, `routers/cms_admin.py` (publish_page + patch_section)
  - MD5 → SHA-256 (non-cryptographic content checksums) in `routers/admin_site.py`, `db/seed_site_iter149.py`, `db/seed_iter149_rebuild.py` — `source_hash` is never compared, only stored, so migration is transparent
- **Service signatures consolidated via dataclasses:**
  - `services/journal_service.py` → `ArticleCreateData`, `BlockCreateData`, `ArticleListFilters`
  - `services/cms_writer.py` → `SectionData`
  - `services/ai_editorial.py` → `AILogContext`
  - All call sites updated in `routers/journal.py`, `routers/cms_admin.py`, `routers/ai_editorial.py`
- **`routers/admin_site.py:upsert_block`** split into `_validate_block_payload`, `_upsert_editorial_block_row`, `_upsert_block_translations`
- **Type hints** added to `database.py` (engine, sessionmaker, `get_db()`)

### ITER151b — Features page mockup redesign (Feb 2026)
- 2 new section renderers:
  - `feature_hero_split` — split hero: text on solid black left + cinematic photo right with gradient blend
  - `feature_numbered_list` — up to 15 rows: outlined teal serif number (01–15) | eyebrow/title/body | screenshot with teal radial glow. Empty items (no eyebrow/title/body) hidden on the public site.
- Both registered in `SECTION_REGISTRY`.
- Seed `db/seed_iter151_features.py`: idempotent, 49 editorial_blocks (4 hero + 45 items × 3) + 2 sections inserted on `features` page. SEO meta updated. Slots `item_06`..`item_15` declared empty so they appear in the Page Editor ready to fill.
- **Auto-discoverable from Page Editor**: blocks flat-named (`item_01_eyebrow`...`item_15_body`), media slots flat-named (`item_01`...`item_15`) → all editable inline without backend changes.
- Validated visually on `/caratteristiche`: hero + 5 numbered feature rows public; 49 editable input slots in admin.

### ITER152b — Single CTA · Legal strip · Favicon definitivo · Footer reset (Feb 2026)
- **CTASection / FinalCTA / FinalCTAImmersive**: il bottone secondario è stato rimosso. La sezione finale di ogni pagina ora ha un SOLO CTA primary teal solid. Il blocco `site.home.final.cta_primary` ora dice "Scopri le licenze MOOD for DESIGN" (IT) / "Discover MOOD for DESIGN licenses" (EN), con link a `/versioni-prezzi`.
- **`LegalStrip`** componente: fascia bianca sottile sotto il footer su ogni pagina pubblica. 3 testi (copyright a sinistra · "Questo servizio è fornito da MOOD for DESIGN" al centro · "Running on Blueprint OS™ - Editorial Infrastructure for Design Studios" a destra). Aggiunto a `CorporateApp` dopo `EditorialFooter`. Responsive: mobile collassa a colonna centrata.
- **Favicon definitivo**: usato il PNG ufficiale fornito dall'utente (`logotipo_OO.png`) come `<link rel="icon" type="image/png">` + `<link rel="shortcut icon">` + `<link rel="apple-touch-icon" sizes="180x180">`. Aggiunto cache-buster `?v=3`. SVG fallback rimosso (era la causa della "distorsione" su alcuni browser).
- **Footer reset**: `cms_sections` di tipo `footer` cancellate per ripartire con bootstrap pulito. Al primo save dal `/admin/footer` il FooterEditor inizializzerà 2 social (Instagram + LinkedIn) + 2 colonne configurabili (Esplora + Legale). Niente più 3a icona social non gestibile dal CMS.

### ITER152 — Multi-tenant JWT auth + Navbar CTA buttons + Footer CMS (Feb 2026)

**JWT-based multi-tenant authentication** (full backend playbook adaptation from MongoDB → Postgres)
- New tables: `users(id, tenant_id, email, password_hash, full_name, role, is_active, last_login_at)` with `UNIQUE (tenant_id, email)` — same email may exist across tenants. `login_attempts(identifier, success, created_at)` for brute-force throttle.
- `routers/auth.py` (prefix `/api/auth`):
  - `POST /login` — normalizes email, queries `users` JOIN `tenants` across ALL tenants for the email, validates bcrypt password against each candidate. 0 match → 401; 1 match → JWT + `{user, tenant, redirect_url}`; N matches → `{requires_tenant_selection: true, tenants: [...]}` so the client renders a picker and resubmits with `tenant_slug`.
  - `GET /me` — Bearer token → user payload + tenant.
  - `POST /logout` — stateless (client discards token).
  - JWT lifetime 24h, HS256, claims `{sub, tenant_id, tenant_slug, role, email, exp, type}`.
  - Brute-force: 5 failed attempts within 15min per email → 423 Locked.
- Seed `db/seed_auth_admin.py`: creates/updates admin user for tenant `studio` reading `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`. Idempotent.
- `LoginHero` rewired: real `axios.post` to `/api/auth/login`, multi-tenant picker rendered when backend returns `requires_tenant_selection`, error handling for 401/422/423, JWT stored in `localStorage` (`mood_auth_token`, `mood_auth_user`, `mood_auth_tenant`), redirect to `data.redirect_url` (`/admin` for admin role).
- Test creds in `/app/memory/test_credentials.md` (`admin@moodfordesign.com` / `MoodAdmin2026!`).

**Navbar CTA polish**
- "Supporto" → outlined teal pill (transparent bg + teal border + teal text on hover)
- "Accedi"  → solid teal pill (filled #00C9B3 with black text — strongest visual call-to-action)
- Both buttons now visually consistent with hero CTAs across the site.

**Footer snellito + CMS editor**
- `EditorialFooter` reduced to a clean 2-column layout (brand+social block left, then 2 link columns: configurable "Esplora" + "Legale"). The 4-column "magazine/projects/materials/company" grid is gone. Copyright sits at the bottom with the locale switcher.
- Backend `GET/PUT /api/admin/site/footer?locale=<loc>`: reads/writes `cms_sections(section_type='footer').settings` + per-locale editorial_block values in one call. Auto-creates the `footer` cms_page if missing. Cache-invalidating.
- New admin route `/admin/footer` → `FooterEditor` component: per-language dropdown (IT · EN-US · EN-UK · FR · DE · ES), inline editors for copyright + nav column (heading + items, each row has label + href + "titolo" checkbox + remove) + legal column + social network rows (icon dropdown supporting `instagram · linkedin · twitter · x · youtube · facebook · pinterest` + URL). Bootstrap-on-empty so new tenants get a sensible default tree to edit immediately. Save pill shows dirty/saved status.
- Social icons dynamically resolved on the public footer via `SOCIAL_ICONS` map (lucide-react). Rows with empty `href` are hidden.

**Misc**
- Login "Registrati" CTA now points to `/supporto#contact` (was `/dedicato-a`). Editable from the Page Editor.

### ITER151j — Unified panoramic hero (Home / Audience / Training) + favicon + SEO meta polish (Feb 2026)
- **`HeroEditorial` (Home)** rewritten to match the site-wide panoramic pattern: photo edge-to-edge with `object-position: center 40%`, unified horizontal veil (`0.98 → 0 over 0-92%`), text top-left aligned to nav container via `paddingLeft: max(1.5rem, calc((100vw - 1536px) / 2 + 4rem))`. CTAs: solid-teal primary + ghost outlined secondary (consistent with login/training).
- **`AudienceHeroSplit`** + **`TrainingHero`** converted from split-column to the same panoramic pattern. Photo runs edge-to-edge (was confined to right column), veil is the unified strong gradient (was a soft 12-26% blend), text is top-left container-aligned. Body section + body-with-photo on /dedicato-a remains intact below the hero.
- **Favicon** replaced: SVG inline icon (`/favicon.svg`) — 64×64 viewBox, `#121212` background + two outlined teal MOOD circles. Crisp at all DPRs, no PNG bloat. Apple-touch-icon still points to the full wordmark PNG.
- **Document SEO meta (default)** expanded in `index.html`: Italian copy, `keywords`, `author`, `canonical`, `og:site_name`, `og:locale=it_IT`, `og:type=website`, `twitter:title/description`. Per-page meta still overridden dynamically by `SEOHead` (set from `cms_pages.locale_meta` via `SitePage`).

### ITER151i — Batch 2: Hero alignment + Favicon + SEO meta editor + Anchor sections + Mini markdown (Feb 2026)

**Hero text alignment**
- `AudienceHeroSplit` and `TrainingHero` left text panels now align with the navigation container: `paddingLeft: max(1.5rem, calc((100vw - 1536px) / 2 + 4rem))` matches the logo's left edge at every breakpoint. The titles "Progettato per chi progetta il futuro." and "Conosci. Impara. Cresci." now read perfectly under the MOOD logo.

**Favicon & document-level SEO**
- `frontend/public/index.html`: real favicon + apple-touch-icon pointing to the MOOD wordmark, `theme-color: #121212`, updated default OG/Twitter meta (Italian copy, OG image set).
- New `SEOHead` component (`components/SEOHead.jsx`): imperative head manager — sets/upserts `<title>`, `meta[name=description]`, `og:title/description/image`, `twitter:image` on every page mount. No `react-helmet` dependency.

**Per-page SEO meta editor (Blueprint Command Center)**
- Backend endpoints (`routers/admin_site.py`):
  - `GET  /api/admin/site/pages/{page_key}/seo` — returns `locale_meta` with resolved `og_image_url` for each locale.
  - `PUT  /api/admin/site/pages/{page_key}/seo` — body `{locale, title, description, og_image}`. Validates, writes `cms_pages.locale_meta`, invalidates cache.
- Public resolver (`services/site_resolver.py`) now resolves `og_image` UUID → public `og_image_url` in the page payload.
- Admin UI (`PagesEditor.jsx`): collapsible **SEOEditor panel** at the top of each page — per-locale title (max 70 chars), description (max 170 chars), and og:image picker (uses the same `MediaPicker`). Shows char counter, dirty indicator, save status pill.

**`anchor_section` component**
- Renderer (`AnchorSection.jsx`): editorial landing for in-page anchors. Renders `<section id={anchor_id} data-anchor-id>`, eyebrow + serif title + italic Playfair subtitle + 2-column body+photo (markdown-aware). `options.reverse` flips columns, `options.background` alternates `#000000`/`#050606`. `scrollMarginTop: 92px` keeps target below fixed nav.
- Seed `db/seed_iter151_training_anchors.py`: 5 anchor sections on `/formazione` — `#percorsi · #tutorial · #guide · #webinar · #academy`. Each has full editorial copy with markdown (e.g. **bold** highlights). Updates `training_hero` CTAs to point to anchors.

**Mini Markdown Editor (admin) + safe renderer (public)**
- `PagesEditor.BlockEditor` — when `block_type === 'body'`, a minimal **MarkdownToolbar** is rendered above the textarea:
  - **B** → wraps selection with `**…**`
  - **I** → wraps selection with `*…*`
  - **↗** → prompts URL, inserts `[selection](url)`
  - **•** → appends a bullet line
  - **¶** → appends a paragraph break (`\n\n`)
  - inline hint: "markdown: **grassetto** · *corsivo* · [link](url)"
- Headlines / eyebrows / CTAs are NOT editable as markdown (intentional — preserves visual hierarchy).
- `utils/renderInlineMarkdown.jsx`: safe-by-construction inline parser used by `EditorialBodyWithPhoto` and `AnchorSection`. Token regex matches only `**bold**`, `*italic*`, `[label](url)`. Anything else renders as plain text. `\n\n` → `<br><br>`.

**Veil & navbar polish**
- Hero veils strengthened: `0.98 → 0.94 → 0.78 → 0.5 → 0.18 → 0` (was `0.92→0.82→0.55→0.25→0`). Uniform contrast on bright photos.
- `MinimalNav.showSolid = true` constant — `#121212` (`rgba(18,18,18,0.78)` + blur) visible immediately, no scroll required.

### ITER151h — Audience rebuild + Pricing 4-tier + Comparison table + Veil opacity (Feb 2026)
- **Navbar always solid**: `MinimalNav.showSolid = true` constant — `rgba(18,18,18,0.78)` with backdrop-blur visible immediately, no scroll required.
- **Veil opacity strengthened** on all panoramic heroes (`FeatureHeroSplit`, `PricingHeroCinematic`, `PageHero`, `SupportHero`, `LoginHero`): max α `0.98 → 0.94 → 0.78 → 0.5 → 0.18 → 0` over 0-92%. Text contrast on dark photos is now uniformly strong.
- **`audience_hero_split`** — new component for /dedicato-a: split layout (text on solid black left ~46%, cinematic photo right ~54% with subtle left-edge blend). Mirrors the user's mockup ("La nostra comunità · Progettato per chi progetta il futuro.").
- **`editorial_body_with_photo`** — new component: magazine-style 2-column editorial spread (eyebrow + serif title + long-form paragraph on left, 4:5 aspect photo on right). `options.reverse` flips columns. Used as second section on /dedicato-a.
- **`PricingTiersEditorial` extended to 5 slots**: declares tier_04 and tier_05 (empty source on seed) — invisible on public site until admin fills `title`/`body`. Auto-discoverable from Page Editor: 12 extra blocks + 1 media slot per new tier.
- **`pricing_comparison_table`** — new component on /versioni-prezzi: editorial feature matrix with up to 4 tier columns (Essential / Studio / Professional / Enterprise) in gold-italic Playfair, 12 declarable rows. Cell values:
  - `✓ / yes / true / si` → teal check icon
  - `- / empty / no` → dim em-dash
  - anything else → text label (e.g. "10 GB", "Email", "Prioritario")
  Empty tier columns auto-hidden; empty rows auto-hidden. Optional footer note + "Contatta il team" outlined CTA.
- **Seed** `db/seed_iter151_audience_pricing.py`: 98 editorial_blocks + 3 new sections + section reorder. Idempotent.

### ITER151g — Support / Training / Login redesign + chrome polish (Feb 2026)
- **Nav + Footer chrome** updated: navbar `rgba(18,18,18,0.78)` with 18px backdrop-blur + 140% saturation (scrolled state), footer `rgba(18,18,18,0.92)`. Hairline borders `rgba(255,255,255,0.06)`. Mobile panel matches.
- **4 new section renderers** registered in `SECTION_REGISTRY`:
  - `support_hero` — panoramic hero + global search bar with teal submit + 4 quick-access icon cards (BookOpen / HelpCircle / MessageSquare / Activity from lucide-react)
  - `editorial_card_grid` — flexible card grid: `options.columns` (2|3|4), `options.featured_last` (full-span Academy-style), `options.background` (#000|#0A0A0A). Each card: eyebrow + serif title + body + teal CTA arrow link + photo bleeding from bottom-right corner via diagonal mask (or full right-pane image when `featured_last`).
  - `training_hero` — split editorial hero (text left, photo right) with 3-line serif headline (each `title_line_N` on its own line) + body + dual CTA (outlined teal primary + ghost secondary)
  - `login_hero` — panoramic hero + overlaid email/password form (frosted glass inputs, teal solid CTA) + "Non hai un account? Registrati" link. Auth backend still placeholder per PRD Phase D.
- **Login route refactored**: `/accedi` (and locale variants) now flow through `SitePage('login')` → `LoginHero` from CMS. The legacy `LoginPage.jsx` standalone is no longer in the router. The new login content is fully editable from the Page Editor (Email/Password labels, CTA, register prompt, photo).
- **Seed** `db/seed_iter151_pages_v2.py`: 60 editorial_blocks + 6 cms_sections across `/supporto`, `/formazione`, `/accedi`. Idempotent (deletes legacy `page_hero`/`page_intro` and existing variants before inserting).
- **Tone**: Italian editorial sober register matches the user's mockups (Apple × Architectural Digest × Aman Journal). Default media slots cycle from latest library entries — replaceable via MediaPicker per slot.

### ITER151f — Unified panoramic hero pattern (Feb 2026)
- **Unified pattern** applied to all hero sections with a background photograph:
  `FeatureHeroSplit` (Caratteristiche), `PricingHeroCinematic` (Versioni e Prezzi), `PageHero` (Dedicato a / Formazione / Supporto / Accedi).
- **Layout**: single-column, photo runs edge-to-edge (`width: 100%`, `object-fit: cover`, `object-position: center 35-40%`), panoramic height (`clamp(520-560px, 62-68vh, 720-780px)` — NOT full viewport).
- **Veil**: horizontal left-to-right black gradient
  `linear-gradient(to right, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.82) 22%, rgba(0,0,0,0.55) 42%, rgba(0,0,0,0.25) 62%, rgba(0,0,0,0) 82%)` — solid on the left for text contrast, fully transparent past 82%, letting the right side of the image breathe.
- **Text overlay**: top-left, max-width 560-640px (eyebrow + serif title + body + CTA). Reads like a magazine spread.
- The previous `FeatureHeroSplit` 46%/54% split layout has been replaced.

### ITER151d — Pricing page editorial ecosystem (Feb 2026)
- **4 new section renderers** registered in `SECTION_REGISTRY`:
  - `pricing_hero_cinematic` — full-bleed cinematic environment hero with magazine-cover low-left typography (eyebrow · serif title · italic Playfair subtitle)
  - `pricing_philosophy` — typographic intermezzo on black: left-rail eyebrow + italic Playfair headline + editorial body. No chrome.
  - `pricing_tiers_editorial` — 3 vertical card tiers as "modalità operative" (Studio · Atelier · Maison): top environment photograph, eyebrow tag, serif title, italic editorial subtitle, body, typographic inclusions (hairlines, no bullets), italic secondary price, outlined CTA pill. Center tier marked as "Consigliato" via `options.featured_index`.
  - `pricing_ecosystem_note` — closing 2-column block: editorial copy on the left + 3 outlined-serif numbered pillars (Onboarding curato · Formazione continua · Team dedicato) on the right. Elevates from "software pricing" to "ecosystem access".
- **Seed** `db/seed_iter151_pricing.py`: 52 editorial_blocks (3 hero + 3 philosophy + 38 tier + 11 ecosystem) + 4 cms_sections (replaces page_hero / page_intro / pricing_cards on `pricing`). Idempotent.
- **Default media** picked from latest 6 in library (cycled across hero + 3 tiers) — fully editable from the Page Editor MediaPicker.
- **Tone**: Italian editorial, register "Apple × Architectural Digest × Aman Journal". Tier prices are italic secondary, never the protagonist. Copy says "modalità operative" instead of "piani". Three pillars surface onboarding + training + dedicated team without using the word "enterprise".
- **Auto-discoverable from Page Editor**: all 52 blocks and 4 media slots flat-named → inline editable + MediaPicker-ready without backend changes.
- **Bug fix**: `FeatureHeroSplit` gradient overlay diluted (max 0.55 alpha vs 0.95) and starts further left (0% → 78% vs 0% → 70%) per user feedback. The right-pane photograph now reads naturally without a heavy black wash on the left edge.

### ITER151c — Bug fix + AI auto-translate (Feb 2026)
- **Bug fix**: `PUT /api/admin/site/sections/:id/media-slot` was failing with `ProgrammingError` due to `:s::jsonb` syntax (asyncpg parse conflict between bind params and PostgreSQL casts). Replaced with `CAST(:s AS jsonb)`. MediaPicker selection now works correctly.
- **AI auto-translate** (Claude Sonnet 4.5 via `/api/ai/editorial/translate`):
  - Per-block button "Traduci da IT" inside BlockEditor (visible only on non-IT locales when IT source has content)
  - Bulk-translate toolbar button "Traduci N blocchi → LOCALE" (visible when at least one block has IT source and missing target translation) — iterates over candidates with progress counter
  - Translations are pre-filled into the textarea; user must click "Salva" to persist (allows review)
  - `adminApi.translate(text, srcLocale, tgtLocale)` calls `/api/ai/editorial/translate` with admin headers

### ITER152 Phase 1 — Live Preview / Synchronized Editorial Canvas (Feb 2026)
- **Split layout** `/admin/pages`: editor on left (~60%), live preview iframe on right (~40%). Preview is sticky (always visible while scrolling editor).
- **Real renderer reuse**: the right pane embeds the actual public site via iframe — same React app, same `SectionRenderer`, same typography/spacing/animations. No duplicated rendering logic.

### Admin Page Content Editor — Editorial Operating Console (Feb 2026)
- **PreviewBridge** (`corporate/components/PreviewBridge.jsx`): mounts only when `window.parent !== window`. Sends `mood-preview:ready` on mount; listens for `mood-preview:scroll-to-section`; forwards user clicks as `mood-preview:section-clicked`. Shows a "LIVE PREVIEW" pill so the embedded context is unambiguous.
- **LivePreview** (`admin/components/LivePreview.jsx`): viewport modes Desktop (100%) / Tablet (820px) / Mobile (390px) with animated `width` transition (350ms cubic-bezier). Reload button + open-in-new-tab. Receives `refreshKey` to force iframe reload (e.g. after save).
- **Bidirectional sync**: clicking a block/section in the editor triggers preview scroll-to via postMessage; clicking inside the preview iframe pushes section id back to the editor (forwarded via parent).
- **Locale-aware URL**: locale switch in editor → resolves the localized slug via internal map and reloads iframe (e.g. `audience` + `en-us` → `/audience`, `audience` + `fr` → `/destine-a`).
- **Auto-reload on save**: every block save bumps `refreshKey`, causing the iframe to refetch the published page so changes appear instantly.
- **Section anchors**: `SectionRenderer` wraps every section in a `<div data-section-id="..." data-section-type="...">` for stable cross-frame targeting.
- **AdminShell**: padding removed for `/admin/pages` route to give the split layout edge-to-edge space.
- **Validated E2E**: Desktop → Tablet → Mobile viewport switching with animated resize; page switching reloads preview; locale switching reloads preview with localized slug; "LIVE PREVIEW" pill visible inside the embedded view.
- **Backend endpoints**:
  - `GET /api/admin/site/pages` — list of all cms_pages (ordered: home → audience → features → pricing → training → support → login → others)
  - `GET /api/admin/site/page-content/:page_key` — full editable content in ONE call (sections + auto-discovered text blocks with translations + media slots with full metadata)
  - `PUT /api/admin/site/sections/:id/media-slot` — assign/remove a media slot (validates media exists)
  - `GET /api/admin/site/media-usages` — `{media_id: [{page_key, section_type, slot}]}` map for the picker
- **Frontend `/admin/pages`** (new primary tab, set as default route):
  - Left sidebar with all CMS pages
  - Top locale tabs: IT · EN-US · EN-UK · FR · DE · ES
  - Each section renders: type heading, then per-block inline editor + per-media slot panel
  - **Block editor**: textarea + live preview with REAL typography (Playfair italic for body, Inter for cta/eyebrow, Playfair display for headlines). Save button with "Salvato" / "Non salvato" pill status.
  - **Media slot panel**: thumbnail with dominant color background, dimensions, color swatch, category. "Cambia foto" button opens MediaPicker.
- **MediaPicker** (`components/MediaPicker.jsx`): full-screen modal with:
  - Tabs "Tutte" (grid) + "Per categoria" (grouped by `category` field)
  - Global search across `alt_text`, `file_name`, `category`
  - Each card displays: image, aspect ratio chip (16:9, 4:5, 1:1, etc.), category pill, **current usage label** ("used in home · final cta immersive"), "IN USO" badge if currently assigned to the slot
  - "Carica nuova" button opens the existing MediaUploader (crop + filters pipeline) — uploaded image is auto-selected
- **Auto-discovery**: blocks and media slots are read from `cms_sections.settings.{blocks, media}` — adding a new section type doesn't require new admin code, just declare the slots.
- **Validated E2E**: navigated through all 7 pages, opened picker on real Home section, verified usage labels show "used in home · ...", verified search filter (`hero` → 2 results including the active one with IN USO badge).
- **Backend**: `POST /api/admin/site/media/upload` (multipart, JPEG/PNG/WebP/AVIF, max 25MB) — uploads to Supabase Storage bucket `cms-assets`, extracts width/height/dominant_color via Pillow, inserts into `media_library`.
- **Backend**: `DELETE /api/admin/site/media/{id}` — soft-archive (sets `archived_at`).
- **Frontend**: `src/admin/components/MediaUploader.jsx` — drag/drop, react-easy-crop for crop with 7 aspect presets (1:1, 4:5, 3:2, 16:9, 21:9, 9:16, free), 6 filter presets (Editoriale, Cinematico, B&N, Caldo, Freddo, Matte) + 6 fine sliders (brightness 50-150%, contrast 50-150%, saturate 0-200%, grayscale 0-100%, sepia 0-100%, blur 0-8px). Canvas pipeline produces a Blob with cropped + filtered output before upload.
- **Frontend**: `src/admin/utils/cropFilter.js` — pure canvas utility, no extra deps beyond `react-easy-crop`.
- **Frontend**: `MediaLibrary.jsx` updated with `Carica foto` (upload) and `Registra URL` buttons + per-card delete with confirm.
- **Validated**: real upload test produced `400×300` JPEG with `#7832C8` dominant color matching the source, then DELETE soft-archived correctly.

### ITER151 Phase 1 — Public Website Restructure (Feb 2026)
- **New top navigation** (Italian source, locale-fallback ready): Dedicato a · Caratteristiche · Versioni e Prezzi · Formazione + (Supporto · Accedi). Removed "Inizia il Percorso" / "Accesso Professionale" CTAs entirely.
- **Backend resolver**: `site_resolver.resolve_navigation()` now returns `{main, right, cta}` grouping nav items by `position` setting.
- **Homepage CTA collapse**: hero + final_cta now show a single `Scopri MOOD for DESIGN` button (cta_secondary forced empty for all locales).
- **6 new dynamic pages** in `cms_pages` (canonical EN slug: audience, features, pricing, training, support, login). Each has 2 sections (`page_hero` + `page_intro`) and editorial blocks (eyebrow/title/subtitle/intro_body/cta_label/seo_title/seo_description).
- **Localized routing**: `src/corporate/routes/localizedSlugs.js` maps 6 canonical keys × 6 locales (IT/EN-US/EN-UK/FR/DE/ES) → 36 React routes resolving to same component. IT slugs: `/dedicato-a`, `/caratteristiche`, `/versioni-prezzi`, `/formazione`, `/supporto`, `/accedi`. `/login` retained for backwards compat.
- **2 new section renderers**: `PageHero.jsx` (cinematic hero with optional bg), `PageIntro.jsx` (Playfair italic editorial intro + outline CTA pill). Both registered in `SECTION_REGISTRY`.
- **Legacy redirects**: `/begin-journey` → `/dedicato-a`, `/professional-access` → `/accedi`.
- **Seed script**: `db/seed_iter151_pages.py` — idempotent, 55 editorial_blocks + 6 cms_pages + 12 cms_sections + nav rewrite.
- **Tenant locales**: `tenants.active_languages` updated to `[it, en-us, en-uk, fr, de, es]` (was `[it, en]`).
- **Smart locale switcher** (`LocaleSwitcher.jsx` + `EditorialFooter.jsx`): when user changes locale on a localized page, it auto-navigates to the equivalent slug in the new locale (e.g. `/dedicato-a` IT → `/audience` EN, `/audience` EN → `/destine-a` FR, etc.). Validated E2E.
- **Smart locale detection** (`LocaleContext.js`): on initial mount, if the current URL path matches a known localized slug, it auto-sets the locale accordingly — so direct visits to `/destine-a` immediately switch UI to FR.
- **Tone**: Italian editorial copy (sober, cinematic, Apple × Architectural Digest × Aman Journal register). Non-IT locales inherit via fallback chain until Phase 3.
- **Validated**: home + /caratteristiche + /versioni-prezzi + /destine-a (FR) all render correctly via screenshots; locale switching round-trips via footer dropdown.

### Code review false-positive policy
- All `is`/`is not` comparisons in the codebase are `is None` / `is not None` — **PEP 8 mandated**, do NOT change to `==`. Any tool reporting these as bugs is producing systematic false positives (lacks `R0124` whitelisting).

---

## Test Status
- Iteration 1 (mocked): 100% (20/20)
- Iteration 2 (Supabase migration): 100% (29/29)
- Iteration 3 (Session I — Journal/Media/AI): 30/30 E2E green
- Lint (Feb 2026 refactor): 7/7 files clean, full backend imports OK, 4 public endpoints smoke-tested 200

## Mocked / Non-prod
- Contact form & newsletter persist to DB but NO email sent
- Studio registration persists intake but NO tenant auto-provisioning
- Admin routes use placeholder header auth (`X-Admin-Key` + `X-Tenant-Slug`) — to be replaced by Supabase JWT
