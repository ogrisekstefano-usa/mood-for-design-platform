# MOOD for DESIGN — Corporate Website PRD

## Project Overview
Corporate website for www.moodfordesign.com built as a tenant inside the Blueprint ecosystem.
**ONE platform → MULTIPLE frontends → ONE database** architecture.

**Tenant slug:** `mood-corporate`
**Tenant UUID:** `51f9ab4d-1aaf-5b8b-b7a9-8a4c8f942a50` (deterministic UUIDv5)
**Domain:** `www.moodfordesign.com` (mapped via `tenant_domains`)
**Stack:** React + FastAPI + Supabase PostgreSQL (existing Blueprint schema)

---

## Architecture Decisions

### ONE Platform, ONE Database
- `www.moodfordesign.com` → CorporateApp (mood-corporate tenant)
- `blueprint.moodfordesign.com` → Blueprint SaaS (same backend, same DB)
- `*.moodfordesign.com` → future tenant storefronts (same DB)
- All share: same backend, **same Blueprint CMS engine** (`cms_pages` + `cms_sections`), same i18n, same auth layer
- NO duplicate CMS, NO duplicate admin

### Database — Supabase PostgreSQL (LIVE)
- Connection: Transaction Pooler (port 6543) for runtime, Session Pooler (port 5432) for DDL/migrations
- `statement_cache_size=0` REQUIRED for PgBouncer transaction mode
- DDL is owned by Blueprint migrations — corporate routes only read/write rows
- Multi-tenant isolation via `tenant_id` FK on every table
- PgEnum types used via `create_type=False` (tenant_status, cms_page_status, domain_type)

### Tables in Use (existing Blueprint schema)
- `tenants` (27 cols, uuid id, enum status, JSONB enabled_modules, theme cols)
- `tenant_domains` (host → tenant_id resolver source)
- `tenant_memberships`, `users_profile` (auth/RBAC, ready for P1)
- `cms_pages` (page_key, locale_meta JSONB, page_content JSONB, status enum)
- `cms_sections` (section_type, sort_order, visible, locale_content JSONB, settings JSONB, asset_refs uuid[])
- `cms_assets`, `media_library` (asset system, ready for journal/storefront)
- `magazine_posts`, `magazine_paragraphs` (journal engine, P1)

### Tables Added (corporate-only auxiliary, NOT part of Blueprint)
- `contact_submissions` (form persistence per tenant)
- `newsletter_subscribers` (unique by tenant_id+email, UPSERT-safe)
- `studio_registrations` (onboarding intake before tenant provisioning)

### Section Registry (15 types, shared across tenants)
`editorial_hero`, `split_story`, `cinematic_quote`, `logos_wall`, `feature_narrative`,
`metrics_strip`, `pricing_cards`, `cta_section`, `journal_grid`, `faq_accordion`,
`comparison_table`, `timeline`, `template_showcase`, `case_study_preview`, `navigation`

### Multilingual
Supported locales: `it`, `en-us`, `en-uk`, `fr`, `de`, `es`
- Backend resolves locale content before sending (chain: requested → en-us → first available)
- Each section row stores `locale_content` as `{locale: {...}}` JSONB
- Navigation persisted as a dedicated `navigation` section type on the home page

### Caching
- In-process TTL cache (`/app/backend/cache.py`), default 60s for pages, 120s for nav/list
- Swap to Redis later — public interface unchanged (`get_or_set(key, loader, ttl)`)
- `POST /api/corporate/cache/invalidate` flushes by prefix or all

### Draft/Published Architecture (ready)
- `cms_pages.status` enum: `draft | published | scheduled | archived`
- `cms_pages.scheduled_publish_at`, `cms_pages.published_at`
- Repository filters `status = 'published'` for public reads
- Future Blueprint admin will write `draft_*` and publish later

---

## What's Been Implemented

### P0 — Supabase Persistence (May 2026) ✅ DONE
- Real Supabase project connected (eu-west-1, project ref `ytctctmvgdkmyjrbgmqs`)
- 5 env vars in `/app/backend/.env`: `DATABASE_URL`, `SESSION_POOLER_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Async SQLAlchemy engine via `asyncpg` with PgBouncer-safe config
- Models mapped to existing Blueprint tables (no `create_all`, no duplication)
- Tenant resolver (`tenant_resolver.py`) by host header + slug fallback
- Idempotent seed migration (`db/seed_migration.py`) — UUIDv5 deterministic keys
- Repository pattern (`db/repository.py`) — zero `seed_data` runtime dependency
- 8 corporate pages + 26 content sections + 1 navigation row in `cms_sections`
- Form persistence: contact + newsletter (UPSERT) + studio registrations
- 15-type section registry endpoint
- In-process content cache with invalidation API
- 29/29 backend tests pass (`/app/backend/tests/test_corporate.py`)

### Backend (FastAPI) endpoints
- `GET /api/corporate/pages/{slug}?locale=` — DB-driven page renderer
- `GET /api/corporate/pages` — sitemap (slug + published)
- `GET /api/corporate/navigation?locale=` — multilingual nav (main + cta + footer)
- `GET /api/corporate/locales` — 6 locales
- `GET /api/corporate/tenant` — tenant config from DB
- `GET /api/corporate/sections/registry` — 15 section types
- `POST /api/corporate/contact` — persists in `contact_submissions`
- `POST /api/corporate/newsletter` — persists in `newsletter_subscribers` (idempotent)
- `POST /api/corporate/studio/register` — persists in `studio_registrations`
- `POST /api/corporate/cache/invalidate` — cache flush

### Frontend (React)
- CorporateApp tenant-aware routing wrapper, sticky glassmorphism nav, dark editorial footer
- LocaleSwitcher, SectionRenderer dispatcher, LocaleContext
- 8 pages CMS-driven: Home, Platform, Blueprint, Pricing, About, Journal, Contact, Start Studio
- Brand: Playfair Display (heading), Montserrat (body), Teal `#00C9B3`

---

## Prioritized Backlog

### P1 — Next session
- [ ] CMS Bindings: Blueprint admin must edit `mood-corporate` cms_pages/cms_sections
- [ ] Multilingual URL routing on frontend (`/it/`, `/fr/` etc.) reading entirely from DB
- [ ] Brand / Licensing system (commercial onboarding-ready, before Stripe)
- [ ] Auth + Supabase memberships wiring for studio registration

### P2 — Backlog
- [ ] Journal/Editorial engine: rich articles with hero, gallery, hotspots JSONB, AI metadata (use `magazine_posts` + `magazine_paragraphs` from Blueprint)
- [ ] Tenant self-registration → auto provisioning of `{slug}.blueprint.moodfordesign.com`
- [ ] Stripe Subscriptions (pricing → checkout → webhook)
- [ ] Dynamic SEO + Schema.org per page+locale
- [ ] Email service (Resend / SendGrid) for contact + newsletter
- [ ] Redis cache (drop-in replacement for in-process TTL)
- [ ] Admin-gated `/cache/invalidate`

### Tech debt / hardening
- [ ] EmailStr validation on Pydantic forms
- [ ] Studio slug uniqueness suffix (collision-safe)
- [ ] Env-driven cache TTL
- [ ] Audit log integration for form submissions

---

## Test Status
- Iteration 1 (mocked): 100% (20/20)
- Iteration 2 (Supabase): 100% (29/29) — May 2026

## Mocked / Non-prod items
- Contact form submissions persist to DB but NO email is dispatched (P2)
- Newsletter subscribers persist to DB but NO email list integration (P2)
- Studio registration persists intake but NO tenant auto-provisioning yet (P2)
