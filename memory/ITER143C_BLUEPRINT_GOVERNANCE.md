# ITER143C · Blueprint Command Center™ — Root Governance Freeze

**Status**: ✅ DELIVERED · 23 Feb 2026
**Sprint**: Block A → F all green in single cycle

---

## 1 · Sitemap admin completa

```
blueprint.moodfordesign.com/admin/                       (canonical root)
├── /admin                                  → Index card → CTA "Vai alla Governance"
├── /admin/dashboard                        → Dashboard Governance™ · live counters + locale coverage matrix
├── /admin/tenants                          → Tenant Orchestration™ · list + status
│   └── /admin/tenants/:id                  → AdminTenantDetailPage (legacy mounted in new shell)
├── /admin/users                            → User Governance™ · role-distinguished table
├── /admin/presets                          → Atelier Presets™ (frozen view)
├── /admin/editorial-runtime                → Narrative Orchestration™ · per-namespace block list, 6-locale coverage dots, per-block regenerate
├── /admin/language-governance              → Language Governance™ (wraps existing LanguageCommandCenter)
├── /admin/email-governance                 → Email Governance™ · sent/queued/failed/bounced + event feed
├── /admin/demo-governance                  → Demo Governance™ · inventory + Restore Golden Snapshot™
├── /admin/audit                            → Legacy audit page (mounted in new shell)
├── /admin/modules                          → Platform capabilities (mounted in new shell)
├── /admin/advisors[/:id]                   → Advisor Network admin (mounted in new shell)
└── (legacy aliases — hard redirect)
    /superadmin                             → /admin
    /superadmin/tenants                     → /admin/tenants
    /superadmin/tenants/:id                 → /admin/tenants
    /superadmin/modules                     → /admin/modules
    /superadmin/audit                       → /admin/audit
    /superadmin/languages                   → /admin/language-governance
    /admin/languages                        → /admin/language-governance
    /admin/language[/:tab]                  → /admin/language-governance
```

---

## 2 · Role matrix (final freeze)

| Role | DB representation | Can access `/admin/*`? | Scope |
|---|---|---|---|
| **ROOT SUPERADMIN™** | `users_profile.is_root_superadmin = TRUE` (1 row max enforced by partial unique idx) | **YES** | Entire platform |
| **Blueprint Collaborator** | `role='super_admin'` AND `is_root_superadmin = FALSE` | NO (redirects to `/dashboard`) | Studio-level tooling only |
| **Tenant Admin (Studio Owner)** | `role='tenant_admin'` | NO | Own tenant only |
| **Operator (Designer)** | `role='designer'` | NO | Own tenant, limited |
| **Client** | `role='client'` | NO | Own journeys |
| **Ad Partner** | `role='ad_partner'` | NO | Curated read-only |

**Source of truth**: `users_profile.is_root_superadmin` (DB column).
**NOT** based on email matching. The email `admin@moodfordesign.com` is the
canonical identity by convention, but the *permission* is granted by the
DB flag. Re-running `provision_root_superadmin.py` is the only safe path
to set/move the flag.

---

## 3 · Route map (App.js, ITER143C consolidation)

| Path | Gate | Component |
|---|---|---|
| `/admin` + `/admin/*` | `RootSuperAdminRoute` | `AdminShell` → outlet → governance pages |
| `/blueprint/*` | `StudioAdminRoute` | studio-level tooling (unchanged) |
| `/superadmin/*` | — | `<Navigate to="/admin/...">` (hard redirect, no children) |

---

## 4 · Permissions map (server-side)

| Endpoint prefix | Dependency | Behaviour |
|---|---|---|
| `/api/blueprint-admin/*` | `require_root_superadmin` | 403 unless `user.is_root_superadmin === true` |
| `/api/content/page/{...}` | none (public) | Bundle resolver for the editorial runtime |
| `/api/content/blocks` | `get_current_user` + `is_super_admin` check | Governance listing |
| `/api/content/blocks/{id}/regenerate` | `get_current_user` + `is_super_admin` | Force ALE re-gen |

**Verified live**:
- ROOT login (`admin@moodfordesign.com`) → 200 across all `/api/blueprint-admin/*`
- super_admin login (`demo@moodfordesign.com`) → **HTTP 403 `ROOT_SUPERADMIN required`**

---

## 5 · New tables (migration `073_root_superadmin_freeze.sql`)

| Table / Column | Purpose |
|---|---|
| `users_profile.is_root_superadmin` (BOOL default FALSE) | The single source of truth for ROOT access. Partial unique idx guarantees max 1 active row. |
| `tenants.is_demo` (BOOL default FALSE) | Identifies the Golden Demo Tenant™ across the platform without slug-matching. Currently set on `mood-demo`. |
| `email_events.locale, user_id, opened_at, clicked_at, bounce_reason` | Email Governance™ control-tower fields. Provider integration deferred to ITER143E. |
| `demo_snapshot_events` (NEW table) | Audit log for every Restore Golden Snapshot™ action: `tenant_id, action, initiated_by, preserved, wiped, duration_ms, notes, created_at`. |

---

## 6 · New API endpoints

| Method | Path | Gate | Returns |
|---|---|---|---|
| GET  | `/api/blueprint-admin/me`                          | root | Identity + flag verification |
| GET  | `/api/blueprint-admin/dashboard`                   | root | platform counters + editorial coverage |
| GET  | `/api/blueprint-admin/tenants`                     | root | tenant list with members/journeys counts |
| GET  | `/api/blueprint-admin/users[?limit=]`              | root | user list with `effective_role` projection |
| GET  | `/api/blueprint-admin/presets`                     | root | frozen Atelier preset registry |
| GET  | `/api/blueprint-admin/editorial-runtime[?ns,page]` | root | namespaced blocks + per-locale coverage |
| POST | `/api/blueprint-admin/editorial-runtime/{id}/regenerate` | root | force ALE re-gen |
| GET  | `/api/blueprint-admin/email-events[?tenant_id,event_type,status,limit]` | root | event feed + stats roll-up |
| GET  | `/api/blueprint-admin/demo/status`                 | root | demo tenant inventory + last snapshot |
| POST | `/api/blueprint-admin/demo/restore`                | root | wipe runtime content, preserve governance, audit log |

---

## 7 · Frontend architecture

**Cinematic shell** (`/app/frontend/src/pages/admin/AdminShell.jsx` + `admin-shell.css`):
- Black-glass aesthetic (`#050608` deep + `rgba(14,16,20,0.78)` glass + 18px backdrop blur)
- Cyan accent `#7ce4f5` with `0 0 24px` ambient bloom on active states
- Cormorant Garamond italic for titles, Inter for body, JetBrains Mono for technical labels
- Floating identity strip with cyan dot + ROOT SUPERADMIN™ badge
- 240px rail + frameless main canvas with 56px lateral padding
- NO Bootstrap, NO enterprise tables, NO WordPress vibe. Linear/Raycast mood.

**8 governance pages** in `/app/frontend/src/pages/admin/BlueprintGovernancePages.jsx`:
named exports → wired into App.js routes.

**Editorial runtime integration**: AdminShell mounts
`<EditorialBundleProvider pageKeys={['blueprint-admin-shell']}>` — all 78
admin labels seeded under namespaces `admin.shell|dashboard|tenants|users|
presets|editorial|email|demo|index|action` are loaded in ONE roundtrip.

---

## 8 · Screenshots
Captured 23 Feb 2026:
- `/tmp/bp-admin-dash3.png` — Dashboard Governance™ live
- `/tmp/bp-admin-users.png` — User Governance™ with role distinction
- `/tmp/bp-admin-demo2.png` — Demo Governance™ with Restore Golden Snapshot™ CTA
- `/tmp/bp-admin-edit.png` — Editorial Runtime™ (Narrative Orchestration™)

---

## 9 · Blockers / deferred work

| Item | Status | Reason |
|---|---|---|
| Editorial Runtime inline block editor (per-locale tabs, inline edit, manual override status) | **Deferred to ITER143D** | Stop condition for this freeze — needs deliberate UX work to avoid becoming a CMS clone |
| Email provider integration (SMTP/Resend/SendGrid sending, webhook capture of opens/clicks/bounces) | **Deferred to ITER143E** | Foundation in place (table + UI + locale/user fields); provider abstraction is the next chunk |
| User invite / suspend / impersonation flow | **Deferred to ITER143F** | Schema is ready; UI is read-only for now |
| Demo Tenant reseed (curated showcase moodboard + 1 example journey) | **Deferred to ITER141.3** | Wipe path is live and audited; reseed will follow |
| Tenant-scoped editorial blocks UI (Golden Demo Tenant content overrides) | **Deferred to ITER143G** | Orchestrator + DB schema already support `scope='tenant'`; UI surface needed |
| Custom domain (e.g. `studio.moodfordesign.com`) DNS/SSL provisioning | **Deferred to ITER144** | Architecture acknowledges the canonical role of `studio.*` as Golden Demo Tenant™ |

**No active blockers** for the freeze itself. Every Block A→F surface is
live and verified.

---

## 10 · Architectural notes

- **Single root, partially-unique**. The `WHERE is_root_superadmin = TRUE`
  partial unique index is intentional: it allows demoting a current root
  before promoting a new one in a single transaction window.
- **Editorial Runtime™ is the long-term home for ALL admin labels**.
  When ITER143D ships the inline editor, the operator can change any
  Blueprint label (e.g. `nav.dashboard` from "Governance" → "Mission")
  WITHOUT touching code — and the change auto-localizes to the 6 active
  locales in seconds.
- **Demo Governance is non-destructive by design**. The restore endpoint
  ONLY touches tenant-scoped runtime tables (relationships, journeys,
  moodboards, …). Users, presets, editorial blocks, locale governance,
  tenant config, language coverage stay intact. The audit row preserves
  what was wiped for forensics.
- **`studio.moodfordesign.com` is already reserved** in `RESERVED_SUBDOMAINS`
  (ITER142). When DNS provisions arrive, the tenant resolver will route
  it through the existing middleware without code changes — `is_demo`
  + Restore Golden Snapshot™ become the operational tools to keep the
  showcase always pristine.
