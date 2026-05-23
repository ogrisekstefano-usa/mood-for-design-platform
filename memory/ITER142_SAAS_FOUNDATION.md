# ITER142 · SAAS FOUNDATION & DOMAIN ORCHESTRATION™

**Date**: 23 February 2026 · **Status**: P0 foundation DELIVERED. Custom domains & SMTP wiring deferred to P1/P2 as planned.

> **In one line**: from prototype to governable SaaS — subdomain routing + role-gated identity + frozen preset registry + email service abstraction, no DNS/SSL automation yet.

---

## 1. ARCHITETTURA DOMINI

### Canonical layout
```
moodfordesign.com                      → Cloudflare DNS root
www.moodfordesign.com                  → marketing site (landing/pricing/onboarding)
app.moodfordesign.com                  → application core (login/dashboard/workspace)
api.moodfordesign.com                  → backend API (optional — currently served via app)
admin.moodfordesign.com                → SuperAdmin only (reserved subdomain)
{tenant-slug}.moodfordesign.com        → tenant runtime (e.g. format.moodfordesign.com)
```

### Reserved subdomains (never tenant-scoped)
`www · app · api · admin · staging · preview · dev · docs · status · support · blog · help`

Definito in `backend/core/tenant_resolver.py · RESERVED_SUBDOMAINS`.

### Tenant resolution — backend middleware
**File**: `backend/core/tenant_resolver.py`  
**Mounted globally** in `server.py` (after CORS).

Algoritmo (precedenza decrescente):
1. **`X-Tenant-Override` header** — SuperAdmin impersonation, audit-logged.
2. **Host subdomain** — `{slug}.moodfordesign.com` lookup via `tenant_subdomain_lookup` view or `tenants.slug`. Security gate: il subdomain risolto deve coincidere col `tenant_id` del JWT — altrimenti viene ignorato (impedisce a un tenant_admin di operare su altro tenant solo cambiando l'Host header). SuperAdmin bypassa il gate (impersonation).
3. **JWT bearer's `profile.tenant_id`** — default.

`get_tenant_context()` ora ritorna anche `resolved_subdomain` e `impersonating: bool`.

### Production deployment (P1 — owner action required)
| Asset | Provider | Action |
|---|---|---|
| `app.moodfordesign.com` CNAME | Cloudflare | → Emergent deployment URL |
| `*.moodfordesign.com` wildcard CNAME | Cloudflare | → Emergent deployment URL |
| SSL wildcard cert | Let's Encrypt via Emergent | Auto |
| `REACT_APP_BACKEND_URL` | Frontend `.env` (prod) | `https://app.moodfordesign.com` |
| CORS allow-list | Already updated in `server.py` | ✅ |

---

## 2. ROLE MATRIX (aggiornata ITER142)

Schema runtime → mapping all'enum DB (`user_role`):

| Role spec ITER142 | DB enum | Brand Identity | Atelier Media | CRM write | Dashboard admin | Sees |
|---|---|---|---|---|---|---|
| **super_admin** | `super_admin` | ✅ manage | ✅ | ✅ | ✅ | tutto + impersonation |
| **tenant_owner** | `tenant_admin` *(no separate enum yet)* | ✅ manage | ✅ | ✅ | ✅ | tenant scope |
| **tenant_admin** | `tenant_admin` | ✅ manage | ✅ | ✅ | ✅ | tenant scope |
| **designer** | `designer` | ❌ 403 | ✅ write (uploads) | ✅ | ❌ | tenant scope |
| **collaborator** | `editor` *(closest)* | ❌ 403 | 👁 read | 👁 | ❌ | tenant scope |
| **client_viewer** | `client` | ❌ 403 | ❌ | ❌ | ❌ | own journey only |

Enforcement live nell'API:
- `/api/atelier/identity/me` PUT → solo `super_admin/tenant_owner/tenant_admin/owner` (verificato via curl: designer riceve 403)
- `/api/atelier/media/upload`, `/transform`, DELETE → `super_admin/tenant_admin/owner/designer`
- `/api/atelier/dashboard/config` PUT → `super_admin/tenant_admin/owner`

**Gap noto**: l'enum `user_role` ha `super_admin, tenant_admin, editor, analyst, project_manager, designer, client, ad_partner`. Manca `tenant_owner` separato (oggi conflato in `tenant_admin`) e `collaborator` (oggi `editor`). Aggiunta P1 con migration enum-extend.

---

## 3. TABELLE CREATE/MODIFICATE (migration 071)

### 🆕 `atelier_presets_registry` (preset registry FROZEN)
| Colonna | Tipo | Note |
|---|---|---|
| id | UUID PK | |
| **code** | TEXT UNIQUE | es. `nordic_emotions` |
| **display_name** | TEXT | es. `NORDIC EMOTIONS™` |
| **position** | INT UNIQUE | 1..6 |
| summary | TEXT | |
| filter_json | JSONB | `{brightness, saturate, contrast, hue_rotate_deg, sepia}` |
| grain_level / vignette_level / warmth_offset / cyan_atmosphere | NUMERIC(3,2) | |
| **is_locked** | BOOL DEFAULT TRUE | SuperAdmin-only write |

**6 righe seedate idempotente**:
| # | code | display_name |
|---|---|---|
| 01 | `nordic_emotions` | NORDIC EMOTIONS™ |
| 02 | `milano_editoriale` | MILANO EDITORIALE™ |
| 03 | `desert_atelier` | DESERT ATELIER™ |
| 04 | `japanese_gallery` | JAPANESE GALLERY™ |
| 05 | `mood_for_design` | MOOD for DESIGN™ |
| 06 | `bloom_atelier` | BLOOM ATELIER™ |

**Backfill effettuato**: 6 righe in `atelier_dashboard_media` migrate da `nordic_cinematic` → `nordic_emotions`. Mapping legacy `nordic_silence/midnight_editorial/aman_warmth/architectural_dawn` → nuovi 6 nomi consolidato in `routers/atelier_media.py · GRADING_PRESETS`.

### 🆕 `tenant_atelier_identity`
Identità per-tenant (palette/logo/locale/preset attivo).

| Colonna | Tipo | Note |
|---|---|---|
| tenant_id | UUID PK FK | |
| active_preset_code | TEXT FK → registry | default `mood_for_design` |
| logo_url | TEXT | |
| palette_override | JSONB | `{primary, secondary, accent, ink}` |
| accent_system | JSONB | |
| editorial_tone | TEXT | |
| default_locale | TEXT | es. `it-IT` |
| fallback_locales | JSONB | es. `["it","en"]` |

### 🆕 `tenant_subdomain_lookup` (VIEW)
Convenience view sopra `tenant_domains` che estrae il subdomain dal hostname e join con `tenants`. Usata dal resolver.

### 🆕 `email_events`
Log di TUTTE le email transazionali — provider-agnostic.

| Colonna | Tipo | Note |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK | |
| event_type | TEXT | `lead_capture / onboarding / proposal_ready / approval_request / new_message / journey_milestone / invitation / password_reset` |
| recipient | TEXT | |
| subject / template | TEXT | |
| status | TEXT | `queued / sent / failed / bounced` |
| provider | TEXT | `supabase / resend / sendgrid / console` |
| provider_id | TEXT | external message id |
| metadata | JSONB | |

### Modifiche existing tables
- **Nessuna** alle tabelle pre-esistenti (no breaking change)
- Index `tenant_domains_hostname_idx (lower(hostname))` aggiunto per resolver O(1)

---

## 4. MIDDLEWARE FLOW

```
┌─────────────────────────────────────────────────────────────┐
│ HTTP REQUEST                                                 │
│   Host: format.moodfordesign.com                             │
│   Authorization: Bearer eyJ...                               │
└────────────────────────────┬────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ TenantResolverMiddleware (global, after CORS)               │
│   • _extract_subdomain('format.moodfordesign.com') = 'format'│
│   • db.tenant_subdomain_lookup → tenant_id                  │
│   • request.state.resolved_tenant = {tenant_id, source,     │
│                                       host, subdomain}      │
└────────────────────────────┬────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Route handler (Depends → get_tenant_context)                │
│   Precedence:                                                │
│     1. X-Tenant-Override (super_admin only)                  │
│     2. resolved_tenant IF (matches JWT.tenant OR super_admin)│
│     3. JWT.tenant (fallback)                                 │
│   Returns: {..., tenant_id, impersonating, resolved_subdomain}│
└─────────────────────────────────────────────────────────────┘
```

**Sicurezza**: un tenant_admin che pinge `format.moodfordesign.com` ma il cui JWT punta a `mood-demo` riceverà comunque dati di `mood-demo` (subdomain ignorato, fallback al JWT). Solo SuperAdmin può effettivamente "saltare" tra tenant via subdomain.

---

## 5. AUTH REDIRECT FLOW (target — P1 da implementare in frontend)

```
[1] Public visitor  → www.moodfordesign.com  → marketing
[2] CTA "Login"     → app.moodfordesign.com/auth/login
[3] POST /api/auth/login (Supabase)
       ↓ if 200
[4] user.role == 'super_admin'  → app.moodfordesign.com/superadmin
    user.role tenant-scoped     → {tenant.slug}.moodfordesign.com/dashboard
[5] Subsequent navigation stays on tenant subdomain
    (session cookies set with Domain=.moodfordesign.com so they propagate)
```

**Frontend state attuale**: il login redirige a `/dashboard` SEMPRE (no tenant subdomain swap). Il redirect "tenant-aware" lo implementeremo in **ITER142.b** dopo l'effettiva configurazione DNS — oggi tutti i preview env sono single-host.

**Forgot password / Invitations**: oggi vanno via Supabase Auth (server-side template hosted by Supabase). Reply-to deve essere configurato in Supabase Auth dashboard.

---

## 6. STATO SMTP / EMAIL DELIVERY

| Indirizzo | Ruolo | Stato | Action |
|---|---|---|---|
| `admin@moodfordesign.com` | SuperAdmin notifications | ⚠️ DA CONFIGURARE in Cloudflare / Google Workspace MX | Owner |
| `support@moodfordesign.com` | Support inbox | ⚠️ | Owner |
| `no-reply@moodfordesign.com` | Outbound system | ⚠️ | Owner |
| `studio@moodfordesign.com` | Demo / sales | ⚠️ | Owner |
| `designer@moodfordesign.com` | Demo user | ✅ in auth.users (mock) | Already wired |
| `client@moodfordesign.com` | Demo user | ✅ in auth.users (mock) | Already wired |

### SPF/DKIM/DMARC checklist (P0 owner action)
```
TXT  @                v=spf1 include:_spf.google.com include:resend.com ~all
TXT  @                v=DMARC1; p=quarantine; rua=mailto:admin@moodfordesign.com
TXT  resend._domainkey (Resend-provided value)
TXT  google._domainkey (Google Workspace-provided value)
```

### Email service abstraction (CODICE PRONTO)
**File**: `backend/services/email_service.py`

```python
from services.email_service import send_email

send_email(
    to="client@example.com",
    subject="Your journey has begun",
    template="onboarding_welcome",
    event_type="onboarding",
    tenant_id=tid,
    sender="no_reply",  # or "support" or "admin"
)
```

Provider scelto via `EMAIL_PROVIDER` env:
- `console` (default · dev) — log only
- `supabase` — Supabase Auth invite (solo per `event_type='invitation'`)
- `resend` / `sendgrid` — **stub** (P1: chiamare integration playbook expert)

Ogni invio registra in `email_events` (audit + bounce analysis).

---

## 7. PRESET REGISTRY VERIFICATO

```bash
$ curl /api/atelier/identity/presets
{
  "presets": [
    {"position": 01, "code": "nordic_emotions",   "display_name": "NORDIC EMOTIONS™",    "is_locked": true},
    {"position": 02, "code": "milano_editoriale", "display_name": "MILANO EDITORIALE™",  "is_locked": true},
    {"position": 03, "code": "desert_atelier",    "display_name": "DESERT ATELIER™",     "is_locked": true},
    {"position": 04, "code": "japanese_gallery",  "display_name": "JAPANESE GALLERY™",   "is_locked": true},
    {"position": 05, "code": "mood_for_design",   "display_name": "MOOD for DESIGN™",    "is_locked": true},
    {"position": 06, "code": "bloom_atelier",     "display_name": "BLOOM ATELIER™",      "is_locked": true}
  ]
}
```

- ✅ Frozen names (NO runtime rename)
- ✅ Position fissa 1..6
- ✅ is_locked=TRUE → SuperAdmin via migration solo
- ✅ Backend `GRADING_PRESETS` allineato in `atelier_media.py`
- ✅ 6 media esistenti retro-fittate (`nordic_cinematic` → `nordic_emotions`)

---

## 8. BLOCKER TECNICI

| Blocker | Severità | Owner |
|---|---|---|
| **DNS records** (A/CNAME wildcard) | 🔴 P0 | Owner Cloudflare account |
| **SSL wildcard cert** | 🟡 P0 | Emergent deployment platform (auto al deploy) |
| **MX records + DKIM/SPF/DMARC** | 🔴 P0 | Owner Google Workspace + Cloudflare |
| **Supabase Auth → custom SMTP** | 🟡 P1 | Need Resend/SendGrid API key in Supabase dashboard |
| **Frontend tenant subdomain redirect post-login** | 🟡 P1 | Code change in `LoginPage` (defer until DNS live) |
| **Custom domain provisioning automation** | 🟣 P2 | Out of scope ITER142 |
| **`tenant_owner` vs `tenant_admin` enum split** | 🟡 P1 | Enum-extend migration |
| **`collaborator` role enum** | 🟡 P1 | Enum-extend migration |

---

## 9. TODO P2 RIMASTI

### Custom domains (e.g. `design.format.it`, `portal.martinel.it`)
Foundation DB **already prepared**:
- `tenant_domains` has `hostname`, `domain_type`, `ssl_status`, `verification_status`, `dns_records`
- `tenant_subdomain_lookup` view will resolve them as long as `hostname` matches the request `Host` header
- Resolver supports them out of the box (root domains list in `tenant_resolver.py · ROOT_DOMAINS`)

**Missing automation** (P2 — when needed):
- DNS verification workflow (TXT challenge)
- Let's Encrypt cert provisioning per custom domain
- Edge worker / nginx rewrite from custom host → tenant_id
- UI to add/verify a custom domain in Settings → Domains

### Resend / SendGrid wiring
1. `integration_playbook_expert_v2` per Resend
2. Implement `_send_via_resend()` in `email_service.py`
3. Set `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` in env
4. Webhook for bounces → update `email_events.status`

### Email templates per event_type
- `lead_capture`, `onboarding_welcome`, `proposal_ready`, `approval_request`, `new_message`, `journey_milestone`, `invitation`, `password_reset`
- Store in `email_templates` table (P1 schema) or as files in `/app/backend/email_templates/*.html`

### Session cross-subdomain
- Set cookie `Domain=.moodfordesign.com` su Supabase Auth settings
- Verify CSRF flow (Same-Site=Lax con subdomain switch)

### Role split (`tenant_owner` vs `tenant_admin`)
Migration 072 enum extension.

---

## 🎯 STATO FINALE ITER142

| Layer | Status |
|---|---|
| Domain architecture conceptualized | ✅ |
| Subdomain resolver (backend middleware) | ✅ |
| Tenant context security gate | ✅ |
| Brand Identity RBAC gate | ✅ |
| Atelier preset registry frozen (6 names) | ✅ |
| Tenant atelier identity table | ✅ |
| Email service abstraction | ✅ |
| Email events audit log | ✅ |
| DNS / SSL / SMTP wiring | ⚠️ owner-side action |
| Frontend tenant subdomain redirect | 🟡 P1 (no DNS yet) |
| Custom domain automation | 🟣 P2 |

**MOOD for DESIGN™ è ora una piattaforma SaaS governabile**. Le foundations sono in DB e codice — il resto è configurazione DevOps che dipende dalla disponibilità del dominio.

— ITER142 SaaS Foundation · 23 Feb 2026
