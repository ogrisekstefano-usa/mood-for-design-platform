# MOOD for DESIGN™ — Product Requirements Document

## Original Problem Statement
Multi-tenant SaaS platform per interior designer e architetti.
Stack: **React + FastAPI + Supabase** (PostgreSQL + Auth + Storage). Multi-tenant via `tenant_id`, no RLS (enforced in backend).
Tutto **Blueprint-driven**: testi, navigazione, dashboard, branding, locales — niente hardcoded.

## Brand Architecture
- **Platform**: MOOD for DESIGN™
- **Framework**: A Blueprint OS™ Platform
- **Operational module**: Blueprint Workspace™ (Leads + Projects + Proposals + Client Portal — integrato, NON moduli separati)
- **Standalone modules**: Blueprint Moodboards™ · Blueprint Inspirations™ · Blueprint Insights™ · Blueprint Concierge™ · Blueprint Match™ (futuro)

## Tech Stack (locked)
- **Frontend**: React 19 (JSX), Tailwind, react-router-dom, lucide-react, @supabase/supabase-js installed (auth via backend tokens persistono in `localStorage`)
- **Backend**: FastAPI, supabase-py (admin), PyJWT (JWKS ES256 verification), psycopg2 (one-off DDL/grant scripts)
- **DB**: Supabase Postgres (Transaction Pooler, port 6543)
- **Auth**: Supabase Auth (email/password) — JWT verificati via JWKS asymmetric (ES256)
- **Storage**: Supabase Storage (6 bucket pre-esistenti)

## Multi-tenant + Locale Architecture
- Ogni signup crea un nuovo `tenant` + `users_profile` linkato ad `auth.users.id` via `auth_user_id`
- Tutte le query backend filtrano per `tenant_id`
- Tenant memorizza: `default_language`, `active_languages[]`, `primary_color`, `secondary_color`, `font_heading`, `font_body`, `logo_url`
- I18n locales supportati: **en-US** (fallback), **en-GB**, **it**, **fr**, **de**, **es**

## Implementation Status (12 Maggio 2026)

### ✅ Phase 1 (DONE — end-to-end verified)
- Database: 22 tabelle pre-esistenti su Supabase, RLS disabilitato, grants applicati via `grant_perms.py`
- Auth: signup (admin API + tenant + profile), login (REST password grant), refresh, me, forgot-password (Supabase recover)
- JWT verification via JWKS (`/auth/v1/.well-known/jwks.json`) — supporta ES256/RS256/HS256
- CRUD: Leads, Projects (con status history), Proposals (con signoffs), Moodboards
- Storage: signed upload URL, signed download, media_library tracking
- Insights: KPI dashboard, activity feed multi-source
- Blueprint API: `/tenant/me`, `/navigation`, `/dashboard`, `/i18n/{locale}`, `/i18n` (locale list)
- Public lead form: `POST /api/leads/public?tenant_slug=…`
- Frontend completo Blueprint-driven:
  - `BlueprintContext` carica tenant + theme + navigation + dashboard + i18n strings
  - Theme applicato via CSS variables (`--bp-primary`, `--bp-accent`)
  - Componenti usano `t('key')` — zero stringhe hardcoded user-facing
  - Sidebar generata da `/api/blueprint/navigation`
  - Dashboard generato da `/api/blueprint/dashboard` (widget types: kpi, feed, actions)
  - LocaleSwitcher in topbar + settings page
- Settings page: branding update (logo, colors, fonts) + locale picker
- Public lead capture form scoped per tenant slug

### Tested End-to-End
✅ Signup → tenant + profile creati su Supabase
✅ Login → token persistito in localStorage
✅ Dashboard KPI letti da `/api/insights/dashboard` (1 lead, 1 progetto, 1 proposta)
✅ Activity feed mostra eventi reali  
✅ Locale switch en-US ↔ it ↔ fr ↔ de ↔ es ↔ en-GB (127 messaggi flat per locale)
✅ Sidebar navigation dinamica  
✅ Leads list + create modal funzionante

## API Endpoints (auth required unless noted)
| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/auth/signup` | Public; crea tenant + profile |
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/refresh` | Public |
| GET | `/api/auth/me` | |
| POST | `/api/auth/forgot-password` | Public |
| GET | `/api/blueprint/tenant/me` | Tenant config + theme + locales |
| GET | `/api/blueprint/tenant/by-slug/{slug}` | Public; per public lead form |
| GET | `/api/blueprint/navigation` | Sidebar config |
| GET | `/api/blueprint/dashboard` | Dashboard widgets |
| GET | `/api/blueprint/i18n/{locale}` | Public; flattened messages |
| GET | `/api/blueprint/i18n` | Public; locale list |
| GET/PUT | `/api/blueprint/settings` | Tenant settings KV |
| GET/POST/PUT/DELETE | `/api/leads/*` | tenant-scoped |
| POST | `/api/leads/public?tenant_slug=` | Public capture |
| GET/POST/PUT/DELETE | `/api/projects/*` | con status history |
| GET/POST/PUT/DELETE | `/api/proposals/*` + `/{id}/signoff` | |
| GET/POST/PUT/DELETE | `/api/moodboards/*` | |
| GET | `/api/insights/dashboard` | |
| GET | `/api/insights/activity` | |
| POST | `/api/storage/signed-upload` | Genera URL firmato |
| POST | `/api/storage/media` | Registra metadata |
| GET | `/api/storage/signed-download` | |
| PUT | `/api/settings/branding` | Tenant branding |
| PUT | `/api/settings/locales` | Default + active locales |

## Files Architecture
```
/app/
├── backend/
│   ├── database.py            # Supabase admin client (service_role)
│   ├── middleware/auth.py     # JWKS + HS256 fallback JWT verify, get_current_user
│   ├── models/schemas.py      # Pydantic schemas aligned to DB
│   ├── routers/
│   │   ├── auth.py            # signup/login/me/refresh/forgot
│   │   ├── blueprint.py       # tenant config + i18n + nav + dashboard widgets
│   │   ├── leads.py
│   │   ├── projects.py
│   │   ├── proposals.py
│   │   ├── moodboards.py
│   │   ├── inspirations.py
│   │   ├── insights.py
│   │   ├── settings.py
│   │   └── storage.py
│   ├── grant_perms.py         # one-shot: grants + RLS disable
│   └── server.py
├── frontend/src/
│   ├── App.js                 # routes + provider tree
│   ├── contexts/
│   │   ├── AuthContext.jsx    # localStorage session
│   │   └── BlueprintContext.jsx  # tenant + theme + nav + dashboard + i18n
│   ├── lib/api.js             # axios + bearer interceptor
│   ├── components/
│   │   ├── common/{Brand, LocaleSwitcher}.jsx
│   │   └── layout/{Sidebar, Topbar, DashboardLayout}.jsx
│   └── pages/
│       ├── auth/{Login, Signup, ForgotPassword}.jsx
│       ├── dashboard/DashboardPage.jsx       # widget-driven
│       ├── workspace/{Leads, Projects, ProjectDetail, Proposals}.jsx
│       ├── moodboards/MoodboardsPage.jsx
│       ├── inspirations/InspirationsPage.jsx
│       ├── insights/InsightsPage.jsx
│       ├── settings/SettingsPage.jsx
│       └── public/LeadFormPage.jsx
└── memory/test_credentials.md
```

## Roadmap

### P0 — Next (Blueprint Workspace completion)
- ProjectDetail tabs funzionanti (Files upload via Supabase Storage, Comments, Tasks)
- Proposals: create modal + items editor + send to client + signoff approval flow
- Public lead form polish + tenant theme preview

### P1
- Moodboards: block-based editor (@dnd-kit/core, Zustand state, TipTap rich text)
- Notifications real-time (Supabase realtime subscription)
- Tenant onboarding wizard (logo upload, locale selection, brand colors)

### P2
- Blueprint Inspirations (Magazine CMS) — editor TipTap, magazine_posts + paragraphs
- Blueprint Insights advanced (funnel, conversion, retention charts)
- AI localization engine (auto-translate tenant content keeping luxury tone)
- White-label custom domain support (tenant_domains table already present)

### P3
- Blueprint Concierge™ (client communication hub)
- Blueprint Match™ (designer ↔ client matchmaking)
- Mobile responsive polish
- Tests pytest in `/app/backend/tests/`
- GitHub push to `ogrisekstefano-usa/mood-for-design-platform` (user via "Save to Github" button)

## Critical Rules (enforced)
1. No hardcoded UI strings — all via `t('key.path')` from `/api/blueprint/i18n/{locale}`
2. No hardcoded theme — CSS vars driven by tenant config
3. No hardcoded navigation — fetched from `/api/blueprint/navigation`
4. No hardcoded dashboard layout — fetched from `/api/blueprint/dashboard`
5. RLS disabled — multi-tenancy enforced in backend via `current_user['tenant_id']`
6. Service role key + JWT secret + DATABASE_URL only in `/app/backend/.env` (gitignored)
7. Frontend only has `REACT_APP_SUPABASE_URL` + `REACT_APP_SUPABASE_ANON_KEY` (anon = safe to expose)

## Demo Credentials (also in `/app/memory/test_credentials.md`)
- Email: `demo@moodfordesign.com`
- Password: `Blueprint2024!`
- Tenant: MOOD Demo Studio
- Default locale: `it`
