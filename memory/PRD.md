# MOOD for DESIGN — Corporate Website PRD

## Project Overview
Corporate website for www.moodfordesign.com built as a tenant/layer inside the Blueprint ecosystem.
ONE platform → MULTIPLE frontends architecture.

**Created:** May 2025  
**Architecture:** React + FastAPI + MongoDB (Supabase-ready)  
**Tenant slug:** `mood-corporate`

---

## Architecture Decisions

### ONE Platform Philosophy
- `www.moodfordesign.com` → CorporateApp (mood-corporate tenant)
- `blueprint.moodfordesign.com` → Blueprint SaaS (same backend)
- Both share: same backend, same section registry, same i18n, same auth layer

### Database Strategy
- Currently: In-memory seed data (`/app/backend/db/seed_data.py`)
- Future: Supabase PostgreSQL (schema-ready, adapter pattern)
- SQL-friendly entity structure: tenants → pages → sections → section_content (multilingual)

### Section Registry
Shared section types across all tenants:
- `editorial_hero`, `split_story`, `cinematic_quote`, `logos_wall`
- `feature_narrative`, `metrics_strip`, `pricing_cards`, `cta_section`
- `journal_grid`, `faq_accordion`, `comparison_table`, `timeline`, `template_showcase`

### Multilingual
Supported locales: IT, EN-US, EN-UK, FR, DE, ES
- Backend resolves locale content before sending (no frontend locale resolution needed)
- Fallback chain: requested locale → en-us → first available
- Runtime locale switching via LocaleContext + localStorage

---

## What's Been Implemented

### Backend (FastAPI)
- `/api/corporate/pages/{slug}?locale=` — CMS page renderer with locale resolution
- `/api/corporate/navigation?locale=` — Multilingual nav items
- `/api/corporate/locales` — Available locales
- `/api/corporate/tenant` — Tenant config
- `/api/corporate/sections/registry` — Section type registry
- `/api/corporate/contact` — Contact form submission
- `/api/corporate/newsletter` — Newsletter subscription
- `/api/corporate/studio/register` — Studio onboarding (Phase 1)
- Full seed data for all pages in 6 locales

### Frontend (React)
- **CorporateApp** — Tenant-aware routing wrapper
- **CorporateNav** — Sticky glassmorphism nav with locale switcher
- **CorporateFooter** — Dark editorial footer with newsletter
- **LocaleSwitcher** — Dropdown locale selector
- **SectionRenderer** — Central registry dispatcher
- **LocaleContext** — Global locale state

### Pages (CMS-driven, all multilingual)
1. **Home** — EditorialHero + LogosWall + SplitStory + FeatureNarrative + CinematicQuote + CTA
2. **Platform** — Hero + MetricsStrip + SplitStory + CTA
3. **Blueprint** — Dark hero + SplitStory + CTA
4. **Pricing** — Hero + PricingCards (with yearly toggle) + FAQAccordion + CTA
5. **About** — Hero + MetricsStrip + SplitStory + CinematicQuote
6. **Journal** — Hero + JournalGrid (6 articles)
7. **Contact** — Hero + Contact form (with inquiry type selector)
8. **Start Your Studio** — Dark hero + Registration form (studio signup + plan selector)

### Section Components (14 types)
All components: DB-driven content, multilingual, scroll-reveal animations, responsive

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router, TailwindCSS, Lucide icons |
| Backend | FastAPI, Python, Pydantic |
| Database | MongoDB (temp) → Supabase PostgreSQL (ready) |
| Design tokens | Cormorant Garamond (serif), Manrope (sans), Teal #3DDAD0 |
| Animations | CSS IntersectionObserver-based reveal |

---

## Content Status
- **MOCKED** — All content served from `/app/backend/db/seed_data.py`
- Contact form: MOCKED (no email service)
- Newsletter: MOCKED (no email list)
- Studio registration: MOCKED (no tenant provisioning)

---

## Prioritized Backlog

### P0 — Critical (Next Session)
- [ ] Connect Supabase PostgreSQL (needs user credentials)
- [ ] CMS admin integration (Blueprint editor for section editing)
- [ ] Email service for contact/newsletter (SendGrid/Resend)
- [ ] Auth system for studio registration

### P1 — High Priority
- [ ] For Studios page (full page with dedicated content)
- [ ] For Retailers page
- [ ] Templates gallery page
- [ ] Case Studies page
- [ ] SEO metadata + OG images per page
- [ ] Schema.org structured data

### P2 — Medium Priority
- [ ] Stripe integration for subscription payments
- [ ] Auto tenant provisioning on studio registration
- [ ] Blueprint workspace at `{slug}.blueprint.moodfordesign.com`
- [ ] Journal article detail pages
- [ ] Multilingual URL routing (`/it/`, `/fr/`, etc.)
- [ ] CMS inline editing mode

### Backlog / Phase 3
- [ ] Comparison table populated with real feature data
- [ ] Template showcase with real template images
- [ ] Case study preview section
- [ ] Timeline section on About page
- [ ] Analytics dashboard for tenant admins
- [ ] API rate limiting and caching

---

## Test Results (Iteration 1)
- Backend: 100% (20/20 tests passed)
- Frontend: 95% (minor animation timing in automation)
- All pages rendering correctly
- Locale switching functional
- Studio registration flow working
