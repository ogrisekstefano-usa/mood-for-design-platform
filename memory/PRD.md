# MOOD for DESIGN — Product Requirements Document

> Master document for the MOOD for DESIGN B2B platform. Last refresh: **5 June 2026 (M6 Relationship Center · CRM FREEZE)**.

---

## 1. Original problem statement (verbatim from user)

> MOOD for DESIGN deve diventare la **piattaforma più desiderabile del settore design**.
> Costruire un **Relationship Operating System** (non un CRUD admin) che supporti:
> - Founder · Team MOOD · Collaboratori · Advisor commerciali (per le operations)
> - **Studio members** (founder + team) — i clienti finali per cui esiste la piattaforma
> Il CRM è uno strumento operativo interno. Il vero prodotto sono i moduli **Blueprint, Design Journey™, Moodboard™, Brand Atlas™, Material Discovery™, Inspiration Packages™, AI Assistant™, Client Portal™** — il motore commerciale per acquisire studi, showroom e licenze.

---

## 2. Architettura attuale

```
/app/
├── backend/   (FastAPI + Supabase PG, strict tenant isolation + RBAC)
│   ├── db/migrations/                  (up to 035_notification_center)
│   ├── routers/
│   │   ├── admin_crm.py                (tenants list + overview + contacts)
│   │   ├── admin_timeline.py           (M2 — unified timeline)
│   │   ├── admin_activities.py         (M3 — activities CRUD + open-followups)
│   │   ├── notifications.py            (M4 — internal notification center)
│   │   └── auth.py
│   ├── services/
│   │   ├── relationship_activities.py  (M3 service)
│   │   ├── notifications.py            (M4 service)
│   │   ├── tenant_contacts.py          (M1)
│   │   └── studio_activation.py
│   └── jobs/scheduler.py               (APScheduler · Europe/Rome cron)
├── frontend/  (React + Tailwind + shadcn, Functional Luxury dark theme)
│   ├── src/admin/
│   │   ├── pages/
│   │   │   ├── TenantsList.jsx         (M6 — Studio · Owner · Advisor · Open FU · Last Touch · Status)
│   │   │   ├── TenantDetail.jsx        (M6 — 3-col Relationship Dashboard, NO MORE TABS)
│   │   │   ├── AdvisorConsole.jsx
│   │   │   └── …
│   │   ├── components/
│   │   │   ├── m6/                     (NEW)
│   │   │   │   ├── ContactsPanel.jsx
│   │   │   │   ├── RelationshipFeedPanel.jsx
│   │   │   │   └── NextActionsPanel.jsx
│   │   │   ├── ContactDrawer.jsx       (M1)
│   │   │   ├── ActivityDrawer.jsx      (M3)
│   │   │   ├── ActivityFeed.jsx        (M3 — no longer mounted in TenantDetail)
│   │   │   └── TimelineFeed.jsx        (M2 — no longer mounted in TenantDetail)
│   │   └── shared/
│   │       ├── WorkspaceShell.jsx      (responsive: 248px desktop / 56px icon-rail mobile)
│   │       └── functional-luxury.css   (token layer: shell #0A0A0B etc.)
│   └── public/
│       ├── _mood_mockup.html
│       └── _relationship_dashboard_mockup.html
└── memory/
    ├── PRD.md                          (this file)
    ├── CHANGELOG.md                    (append-only)
    ├── test_credentials.md
    ├── COMMAND_CENTER_DESIGN_AUDIT.md
    ├── COMMAND_CENTER_VNEXT_PROPOSAL.md
    ├── FUNCTIONAL_LUXURY_PHASE2_REVIEW.md
    ├── M6_RELATIONSHIP_DASHBOARD_FOUNDATION.md
    └── screenshots/
        ├── phase2_final/
        └── m6_final/
```

---

## 3. Milestones — stato

| Milestone | Scope | Stato |
|---|---|---|
| **M0** | CRM Foundation, multi-tenant, RBAC | ✅ Done |
| **M1** | Contact CRM (CRUD, roles, primary, owner) | ✅ Done |
| **M2** | Unified Timeline (events + activities + emails on one endpoint) | ✅ Done |
| **M3** | Activity Log (CRUD, open-followups, complete, reopen, types & outcomes) | ✅ Done |
| **M4** | Internal Notification Center (bell, drawer, mark-read, APScheduler cron) | ✅ Done |
| **FASE 1 stabilization** | Tenant Detail spinner RCA + fix (`Promise.allSettled` + error branch) | ✅ Done |
| **FASE 2 Functional Luxury** | Token CSS layer dark, Geist, sidebar fix, density compact | ✅ Done |
| **M6 Relationship Center** | 3-col permanent dashboard, ops strip, inline accordion, Open FU on list, mobile icon-rail | ✅ Done · CRM FREEZE |
| **M5 Advisor Workspace v1** | My Day cross-tenant | ⏸️ Frozen — postponed indefinitely |
| **M3.1** | Voice Notes foundation | ⏸️ Frozen |
| **M3.2** | Email integration foundation | ⏸️ Frozen |
| **WOW EXPERIENCE stream** | Blueprint · Design Journey™ · Moodboard™ · Brand Atlas™ · Material Discovery™ · Inspiration Packages™ · AI Assistant™ · Client Portal™ | 🔥 **NEW priority — next stream** |

---

## 4. M6 Relationship Center · what shipped (5 Jun 2026)

### 4.1 Tenant Detail — `/command-center/tenants/{tid}`
- **5 legacy tabs eliminated**: Overview, Contatti, Attività, Timeline, Notifiche
- **3-column permanent dashboard** (`data-testid="m6-dashboard"`):
  - **Left (220px)** `ContactsPanel` — M1 reused, role-grouped (Founders/Architects/Designers/Admin), primary highlighted, **5 Quick Actions always visible**: Call (`tel:`) · Mail (`mailto:`) · WA (`wa.me`) · LI (linkedin url) · +Act (opens M3 ActivityDrawer)
  - **Center (fluid)** `RelationshipFeedPanel` — fetches M2 `/timeline` (already unifies events+activities+emails), **inline accordion** (state `expanded: Set<key>`), filter chips All/Activities/Events/Emails + Manual-only toggle, sticky day headers
  - **Right (320px)** `NextActionsPanel` — fetches M3 `/activities/open-followups` + `/activities/v2?status=completed&limit=5`, client-side groups: OVERDUE / TODAY / THIS WEEK / LATER / COMPLETED RECENTLY, **3 Quick Actions always visible**: Complete (`POST /activities/{id}/complete` with optimistic update) · Reschedule (PATCH next_step_due_at via prompt) · Edit (opens ActivityDrawer)
- **Operational header strip** (`tenant-ops-strip`, 7 cells, NO useless KPIs):
  Founder (clickable → ContactDrawer · person-first) · Advisor (clickable → `/command-center/advisors?focus=`) · Owner · Last Touch (relative time) · Next Follow-up (color-coded: red overdue / amber today / neutral later) · Open · Overdue (red if >0)
- **Mobile responsive**:
  - Sidebar `.fl-aside-responsive` collapses to **56px icon-rail** at viewport ≤900px (icons + tooltips only)
  - Dashboard switches to single column with sticky tab-strip `[Contacts][Feed][Actions]`
  - Ops strip 7-col → 2-col grid

### 4.2 Tenant List — `/command-center/tenants`
- **New columns**: Studio · Owner · Advisor · **Open FU** · Last Touch · Status (removed: Geo column, Contacts count column)
- Open FU shows `overdue_followups_count` in red bold if >0, else `open_followups_count` normal, else `0` muted
- Backend payload extension (`admin_crm.py`):
  - `open_followups_count` — subquery: `relationship_activities WHERE next_step_due_at IS NOT NULL AND completed_at IS NULL AND archived_at IS NULL`
  - `overdue_followups_count` — same + `next_step_due_at < NOW()`
- **Zero new endpoints** · Zero new tables · Zero new services

### 4.3 Tested at 5 Jun 2026
- Backend: 8/8 pytest passed (`/app/backend/tests/test_m6_relationship_center.py`)
- Frontend: 12/14 spec checks passed (iteration_8.json); remaining 2 issues fixed in post-test pass:
  - ✅ Optimistic update on Complete action (immediate removal from list)
  - ✅ `contact-li-{id}` testid present even when disabled
  - ✅ Dead imports cleanup in TenantDetail
- Tenant `c64659f6` validated: 6 open FU, 0 overdue, 40 timeline items, 2 contacts

### 4.4 M6.1 patches (6 Jun 2026)
Two enhancements requested by user after seeing production:
- **International phone prefix `<select>`** (countries + flags + search) on ContactDrawer
  - Replaces free-text "+39" input with `PhonePrefixField` (shared with studio activation step3)
  - ISO derived from existing `phone_prefix` on edit mode, persists `phone_prefix_iso` only in UI state
- **Voice notes → Whisper STT → proof-reading** on the 3 description fields:
  - ContactDrawer · Note
  - ActivityDrawer · Memory Notes · Esito libero · Prossimo passo
  - New component `VoiceNoteButton.jsx` (MediaRecorder · max 180s · webm/opus)
  - New backend endpoint `POST /api/transcribe` (Whisper via Emergent LLM Key, IT default)
  - End-to-end test: 2.8s latency, perfect IT transcription
  - UX: transcription appended to textarea — user **always reads + edits** before saving (proof-reading mandated by mic icon UX, microcopy "Rileggi sempre prima di salvare")

---

## 5. Functional Luxury · design tokens (FROZEN)

```
Shell           #0A0A0B
Surface         #16161A
Surface elev    #1D1D22
Border          #2A2A30
Accent (MOOD)   #00C9B3
Critical        #FF453A
Warning         #FF9F0A
Success         #32D74B

Typography      Geist 300/400/500/600/700 + Geist Mono (tabular-nums)
                Playfair BANNED from operational UI (allowed only on marketing/landing/onboarding/blueprint storytelling)
```

Token CSS layer: `/app/frontend/src/admin/shared/functional-luxury.css`
Scoped via root class `.fl-shell` on `WorkspaceShell`.

---

## 6. CRM FREEZE — what is OFF the table

Effective **5 June 2026**, the following streams are frozen:

- ❌ Nuove feature CRM
- ❌ Nuovo redesign Command Center
- ❌ M5 Advisor Workspace v1
- ❌ M3.1 Voice Notes
- ❌ M3.2 Email integration foundation
- ❌ M1.1 Performance hardening (acceptable for current scale)
- ❌ Cmd+K palette, Saved Views, Bulk Actions, Health Score

These can resurface ONLY after the WOW Experience stream ships its first module.

---

## 7. NEXT PRIORITY — WOW Experience stream

This is the **real product**. The CRM is plumbing; this is the value.

### 7.1 Backlog priority order (proposed — to be ratified by user)
| P | Module | One-liner | Status |
|---|---|---|---|
| **P0** | **Blueprint v2** | Studio's living public profile + materials/projects catalog | Existing M3, needs WOW rethink |
| **P0** | **Design Journey™** | Visual narrative of a project from briefing → delivery, sharable with end-client | Not started |
| **P1** | **Moodboard™** | Collaborative mood-boarding tool with material library | Not started |
| **P1** | **Brand Atlas™** | Studio's brand identity / portfolio canon | Not started |
| **P2** | **Material Discovery™** | Showroom-grade material exploration | Not started |
| **P2** | **Inspiration Packages™** | Curated bundles for studios to send to clients | Not started |
| **P3** | **AI Assistant™** | Studio-facing AI for content, drafting, material suggestions | Not started |
| **P3** | **Client Portal™** | End-client view, sign-off, comments on a Design Journey | Not started |

### 7.2 Strategic shifts
- Audience pivot: from "Admin/Advisor operativi" → **"Studio members + end-clients"**
- Visual pivot: dark Functional Luxury stays for back-office; **WOW modules need a bright, editorial, hospitality-grade aesthetic** (separate design tokens)
- Commercial pivot: every WOW module must answer "Why would a studio pay for this every month?"

### 7.3 Cosa serve da utente per partire
1. Pick the first WOW module to scope (P0 candidates: Blueprint v2 vs Design Journey™)
2. Define the primary user persona for that module (founder · senior designer · junior · end-client)
3. Define one canonical "wow moment" per module — the specific 5-second experience that makes someone say "I need this"

---

## 8. Operational notes

### 8.1 Auth & test credentials
See `/app/memory/test_credentials.md`. Admin: `admin@moodfordesign.com / MoodAdmin2026!`.

### 8.2 Production
Deployed at https://moodfordesign.com. Preview environment URL: `REACT_APP_BACKEND_URL` from frontend/.env.

### 8.3 Known cosmetic gaps (acceptable as-shipped)
- `<select>` "Org. Owner" in tenant header still uses native HTML chrome. Functional, dark-themed via CSS override.
- Subqueries in `/api/admin/tenants` run per-tenant per-request — fine ≤200 tenants.
- "Untitled studio" fallback shown when `relation.studio_name IS NULL` — dirty data, not bug.

### 8.4 RCA reports archive
- `/app/memory/TENANT_DETAIL_SPINNER_RCA_REPORT.md` (FASE 1)
- `/app/memory/FUNCTIONAL_LUXURY_PHASE2_REVIEW.md` (FASE 2)
- `/app/memory/M6_RELATIONSHIP_DASHBOARD_FOUNDATION.md` (M6 plan)
- `/app/test_reports/iteration_8.json` (M6 test report)
- `/app/test_reports/iteration_9.json` (FAQ CMS test report — 100% pass)

---

## 9. FAQ CMS module (shipped 20 June 2026)

100% CMS-driven FAQ system. **Zero hardcoded strings in the frontend.**

### 9.1 Schema
- `faq_categories(id, tenant_id, slug, sort_order, visible, locale_content JSONB)` — `locale_content[<locale>] = {title, description}`
- `faq_items(id, tenant_id, category_id, sort_order, visible, locale_content JSONB)` — `locale_content[<locale>] = {question, answer}`
- Page-level hero/finalCta/SEO copy lives in `cms_sections(section_type='faq_page', page_id→cms_pages(page_key='faq'))` · `locale_content` shape: `{hero_eyebrow, hero_title, hero_body, hero_primary_cta_label, hero_primary_cta_url, search_placeholder, final_cta_*, seo_title, seo_description}` per locale.

### 9.2 API surface (`/app/backend/routers/faq.py`)
| Method | Path | Auth |
|---|---|---|
| GET | /api/site/faq?locale=…&q=…&category=… | public |
| GET | /api/admin/site/faq/page | admin (auto-creates page+section on first call) |
| PUT | /api/admin/site/faq/page | admin |
| GET/POST/PATCH/DELETE | /api/admin/site/faq/categories(/{id}) | admin |
| POST | /api/admin/site/faq/categories/reorder | admin |
| GET/POST/PATCH/DELETE | /api/admin/site/faq/items(/{id}) | admin |
| POST | /api/admin/site/faq/items/reorder | admin |

Public response includes a fully-built JSON-LD `FAQPage` schema (built only from CMS content) for SEO.

### 9.3 Frontend
- Public: `/app/frontend/src/corporate/pages/FaqPage.jsx` — fetches per active locale from `useLocale()`, renders hero, sticky-search (250ms debounce), accordion, deep-link `/faq#<slug>`, injects `<script type="application/ld+json" data-faq="1">` + meta tags.
- Admin: `/app/frontend/src/admin/pages/BlueprintFaqAdmin.jsx` — mounted at `/blueprint/faq`. Page Settings panel (Hero · Final CTA · SEO, per-locale tabs from `useLocale().locales`), plus full CRUD + reorder for categories/items. Locale list NEVER hardcoded — falls back to a no-locale warning instead of static defaults.
- Navigation: the `/faq` link in nav_top / footer is managed via existing CMS editors (`Pagine → navigation` and `Footer`). No hardcoded link anywhere.

### 9.4 Regression suite
`/app/backend/tests/test_faq_system.py` — 12/12 pytest passed.
