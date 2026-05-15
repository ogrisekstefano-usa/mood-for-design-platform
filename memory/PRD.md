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

## Test Status
- Iteration 1 (mocked): 100% (20/20)
- Iteration 2 (Supabase migration): 100% (29/29)
- Iteration 3 (Session I — Journal/Media/AI): 30/30 E2E green

## Mocked / Non-prod
- Contact form & newsletter persist to DB but NO email sent
- Studio registration persists intake but NO tenant auto-provisioning
- Admin routes use placeholder header auth (`X-Admin-Key` + `X-Tenant-Slug`) — to be replaced by Supabase JWT
