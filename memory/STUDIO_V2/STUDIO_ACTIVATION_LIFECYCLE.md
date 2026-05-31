# STUDIO ACTIVATION LIFECYCLE™
## MOOD for DESIGN — Canonical Architecture Document

> ⚠️ **OVERRIDE DIRETTIVA LOCALE 2026-05-31** — Vedi `LOCALE_ARCHITECTURE_DIRECTIVE.md`
> §8.4 Internationalization è **esteso**: tutte le locale sono governate da `active_languages` (Command Center owner),
> in formato `xx-XX` con region tag obbligatorio. Nessuna lista hardcoded. Vedi direttiva globale per dettagli.

> **Status**: CANONICAL · v1.0 · 2026-05-31
> **Audience**: Product · UX · Backend · Frontend · Advisor Program · Tenant Provisioning · Blueprint Origin™
> **Scope**: End-to-end ciclo di vita di un tenant — dal primo visitatore al workspace operativo
> **Authority**: Questo documento è il riferimento ufficiale. Ogni divergenza implementativa deve essere giustificata o aggiornare questo file.
> **Not in scope**: codice, migration, componenti, screenshot. Solo modello.

---

## 0. Principi architetturali fondanti

### P1 · Command Center ≠ Blueprint
Due workspace **strutturalmente separati**, mai entangled, eppure complementari.

| | Command Center | Blueprint (Tenant) |
|---|---|---|
| Dominio funzionale | Business MOOD | Operatività dello studio |
| Utenti | Super Admin · Advisor | Founder · Designer · Team · Cliente (futuro) |
| Oggetti governati | advisor, tenant, billing, scoring, approvazioni, provisioning, configurazioni globali | clienti, progetti, materiali, workflow, design journey, team |
| Route principale | `/command-center/*` | `<subdomain>.moodfordesign.com` (futuro) |
| Database scope | Tabelle MOOD Core | Tabelle scoped per `tenant_id` |
| Governance | Centralizzata MOOD | Autonomia dello studio |

### P2 · Founder ≠ Command Center user
Il Founder **non è un operatore MOOD**. È il cliente B2B.

| | Oggi (workaround) | Domani (canonical) |
|---|---|---|
| Founder login destination | Redirect temporaneo verso Blueprint mounted in Command Center | Subdomain dedicato `<slug>.moodfordesign.com` |
| Founder access scope | `/command-center/welcome` only | Blueprint completo nel proprio subdomain |
| Founder visibility su MOOD ops | Zero (anche oggi) | Zero (anche domani) |
| Esempi finali | — | `martinel.moodfordesign.com`, `format.moodfordesign.com`, `197design.moodfordesign.com` |

### P3 · Studio Request ≠ Tenant
La candidatura **non crea infrastruttura**.

```
studio_request (pending_review)
    ↓
    advisor review → approve OR reject
    ↓ (only on approve)
tenant + subdomain + founder_user + membership + invitation
```

Una `studio_request` può quindi:
- Essere rifiutata → nessun side effect strutturale
- Essere approvata → trigger del Tenant Provisioning Engine™

### P4 · Provisioning è asincrono e idempotente
Il momento "approve" è atomico (un click). Il **provisioning** è una pipeline di step ognuno con retry, idempotency key, audit trail. Nessun step può lasciare il sistema in stato inconsistente.

### P5 · Ogni transizione di stato è loggata
Ogni cambio stato di `studio_request`, `tenant`, `invitation`, `founder_user` produce una riga in una tabella di eventi (audit log). Mai modificare stato senza evento.

---

## 1. Lifecycle Diagram — End-to-End

### 1.1 Diagramma testuale completo

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          STUDIO ACTIVATION LIFECYCLE                          │
└──────────────────────────────────────────────────────────────────────────────┘

  STEP 0 ─ VISITOR
  ─────────────────────────────────────────────────────────────────────────────
  Anonymous visitor lands on moodfordesign.com
  No session, no PII, no DB row.

                                    │
                                    ▼

  STEP 1 ─ STUDIO ACTIVATION REQUEST (Funnel /studio/v2)
  ─────────────────────────────────────────────────────────────────────────────
  Owner    : Visitor (data input) · System (capture)
  Trigger  : Visitor reaches /studio + completes 5 movements + clicks Submit
  Input    : studio_type, country, city, languages, primary_goals,
             founder (name/email/phone/role), studio_name, subdomain_slug
  Output   : studio_request row (status=pending_review) + reference code
             + draft_token expired/marked submitted

                                    │
                                    ▼

  STEP 2 ─ QUALIFICATION SCORE
  ─────────────────────────────────────────────────────────────────────────────
  Owner    : System Automation (TQS service)
  Trigger  : Synchronous, inside the same submit transaction
  Input    : The fresh studio_request payload
  Output   : qualification_score (0..100), qualification_tier (HOT|WARM|COLD|OBSERVE),
             scoring_breakdown JSONB, scoring_version

                                    │
                                    ▼

  STEP 3 ─ ADVISOR ASSIGNMENT
  ─────────────────────────────────────────────────────────────────────────────
  Owner    : System Automation (router) · Super Admin (override possible)
  Trigger  : Asynchronous, immediately after STEP 2
  Input    : qualification_tier, geography, primary_goals, advisor_profiles
             availability + specialization
  Output   : studio_request.advisor_assigned_to = <advisor_id>
             + assignment_event in audit log
             + Resend email notification to assigned advisor

                                    │
                                    ▼

  STEP 4 ─ ADVISOR REVIEW
  ─────────────────────────────────────────────────────────────────────────────
  Owner    : Advisor
  Trigger  : Advisor opens /command-center/studio-requests-v2/:id
  Input    : Full studio_request + TQS breakdown + any prior advisor_lead match
  Output   : status transition → under_review (event logged)
             + optional contact attempt (advisor_followups row, future)
             + optional advisor_notes
  Possible terminal exits: approved · rejected · needs_info · duplicate

                                    │
                          ┌─────────┴─────────┐
                          │                   │
                          ▼                   ▼
                     APPROVED              REJECTED / ARCHIVED
                          │                   │
                          │                   │
                          │                   └─→ END (no provisioning)
                          ▼

  STEP 5 ─ APPROVAL
  ─────────────────────────────────────────────────────────────────────────────
  Owner    : Advisor (request) · Super Admin (sign-off on edge cases)
  Trigger  : Advisor clicks "Approve" with confirmed subdomain + plan + commercials
  Input    : approved_subdomain (may differ from requested), tenant_tier,
             billing_profile_draft, commercial_terms
  Output   : studio_request.status = approved + approved_at + approved_by
             + tenant row created in status=planned
             + provisioning_job enqueued

                                    │
                                    ▼

  STEP 6 ─ BLUEPRINT ORIGIN™ CLONE
  ─────────────────────────────────────────────────────────────────────────────
  Owner    : System Automation (Tenant Factory™)
  Trigger  : provisioning_job picked from queue
  Input    : tenant.id, tenant_tier (defines which Blueprint Origin variant to clone),
             tenant_locale, tenant_branding_seed
  Output   : Cloned set of blueprint_* rows scoped to tenant_id:
             - blueprint_pages
             - blueprint_blocks
             - blueprint_media (references, not file copies)
             - blueprint_navigation
             - blueprint_settings (locale, brand colors seed, default workflow)
             tenant.status moves to provisioning

                                    │
                                    ▼

  STEP 7 ─ SUBDOMAIN PROVISIONING
  ─────────────────────────────────────────────────────────────────────────────
  Owner    : System Automation (Provisioning Engine™)
  Trigger  : Following step 6 success
  Input    : tenant.subdomain (e.g. "martinel")
  Output   : DNS record + ingress route + TLS cert + healthcheck PASS
             + tenant.subdomain_provisioned_at timestamp
             + idempotency: re-running is safe (no duplicate DNS)

                                    │
                                    ▼

  STEP 8 ─ FOUNDER USER CREATION + INVITATION
  ─────────────────────────────────────────────────────────────────────────────
  Owner    : System Automation
  Trigger  : Following step 7 success
  Input    : studio_request.founder_email + first_name + last_name + role_title
             + tenant.id
  Output   : users row (role=founder, tenant_id=<new>, email_verified=false)
             + tenant_memberships row (role=founder, tenant_id, user_id)
             + invitation row (token, expires_at = +14d)
             + Resend email "Welcome to MOOD — activate your Blueprint"
               containing magic-link to <subdomain>.moodfordesign.com/activate?token=

                                    │
                                    ▼

  STEP 9 ─ FOUNDER FIRST ACCESS
  ─────────────────────────────────────────────────────────────────────────────
  Owner    : Founder
  Trigger  : Founder clicks magic-link
  Input    : invitation.token
  Output   : - Token validated, single-use, marked consumed
             - Founder forced to set password (hybrid auth, vedi §0 architettura auth)
             - users.email_verified = true
             - users.last_login_at = now()
             - invitation.consumed_at = now()
             - First-time UX: short tour (3 cards) + locale picker + brand colors

                                    │
                                    ▼

  STEP 10 ─ BLUEPRINT LIVE
  ─────────────────────────────────────────────────────────────────────────────
  Owner    : Founder + System
  Trigger  : Successful first access
  Output   : tenant.status = active + tenant.activated_at = now()
             + studio_request.status = archived (terminale, success)
             + billing_profile activated (if commercial terms required)
             + Onboarding checklist surfaced in Blueprint dashboard

  ═══════════════════════════════════════════════════════════════════════════════
                              END OF LIFECYCLE
  ═══════════════════════════════════════════════════════════════════════════════
```

### 1.2 Step summary table

| # | Step | Owner | Trigger | Key Input | Key Output |
|---|---|---|---|---|---|
| 0 | Visitor | — | Page load | — | — |
| 1 | Studio Activation Request | Visitor + System | Submit | Funnel payload | `studio_request` (pending_review) |
| 2 | Qualification Score | System | Sync post-insert | request payload | `qualification_score` + `tier` |
| 3 | Advisor Assignment | System (+SA override) | Async post-score | tier+geo+goals | `advisor_assigned_to` |
| 4 | Advisor Review | Advisor | Advisor opens detail | request + TQS | status `under_review` → approve/reject |
| 5 | Approval | Advisor (+SA) | Approve click | approved settings | `tenant` (planned) + job enqueued |
| 6 | Blueprint Origin Clone | System | Job picked | tenant + tier | Blueprint scoped rows |
| 7 | Subdomain Provisioning | System | Step 6 done | tenant.subdomain | DNS + TLS + healthcheck |
| 8 | Founder Invitation | System | Step 7 done | founder PII + tenant | `users` + `membership` + `invitation` + email |
| 9 | Founder First Access | Founder | Click magic-link | token | Password set, login session |
| 10 | Blueprint Live | Founder + System | First access OK | — | `tenant.active`, `studio_request.archived` |

---

## 2. Actor Map

### 2.1 Visitor
- **Identità**: anonymous
- **Authentication**: no
- **Responsibilities**:
  - Compilare il funnel `/studio/v2`
  - Fornire dati veritieri (best-effort)
- **Permissions**: solo `POST /api/studio/v2/draft|submit|check-email|check-subdomain`
- **Sees**: solo il proprio funnel + success page
- **Persists**: `studio_v2_drafts` (token-based) + `studio_request` finale

### 2.2 Founder
- **Identità**: persona reale, owner/decision maker dello studio
- **Authentication**: hybrid (magic-link first → password set)
- **Workspace**: Blueprint del proprio tenant **(non Command Center)**
- **Responsibilities**:
  - Attivare il tenant alla prima invitation
  - Gestire team membership, brand, contenuti Blueprint
  - Approvare billing/commercials
- **Permissions** (sul proprio tenant): full CRUD su Blueprint scope
- **Permissions** (su MOOD Core): zero
- **Sees**: solo dati `WHERE tenant_id = <own>`
- **Persists**: `users`, `tenant_memberships`, `invitations.consumed_at`, contenuti blueprint scoped

### 2.3 Advisor
- **Identità**: collaboratore MOOD (interno o partner)
- **Authentication**: hybrid (magic-link first → password set)
- **Workspace**: Command Center → `/command-center/advisor-console` + `/command-center/studio-requests-v2`
- **Responsibilities**:
  - Review delle `studio_request` assigned o pool
  - Decisione approve/reject/needs_info
  - Gestione leads CRM (`advisor_leads`, `advisor_lead_activities`)
  - Generazione `advisor_activation_tokens`
  - Follow-up post-approval
- **Permissions**:
  - Read studio_requests (own assignment + own region/scope)
  - Update studio_requests own assignment
  - Cannot create tenant directly (deve passare per approve flow)
  - Read aggregated TQS breakdown
- **Sees**: dati MOOD Core scoped a propria assignment

### 2.4 Super Admin
- **Identità**: ruolo MOOD HQ (founder MOOD, ops lead)
- **Authentication**: hybrid + 2FA (futuro hard requirement)
- **Workspace**: Command Center → tutto
- **Responsibilities**:
  - Configurazioni globali (countries, languages, reserved_subdomains, TQS weights)
  - Override decisioni advisor
  - Gestione advisor lifecycle
  - Sign-off su provisioning edge cases
  - Suspend / archive di tenant
  - Billing tier management
- **Permissions**: tutto su MOOD Core; **nessuna** ingerenza sui contenuti Blueprint dei tenant (read-only metadata)

### 2.5 Command Center (system role)
- **Natura**: workspace + insieme di servizi MOOD-side
- **Provides**: UI per Advisor + Super Admin
- **Owns**: tutte le tabelle "core" di MOOD (`tenants`, `users`, `studio_requests*`, `advisor_*`, billing, scoring, provisioning_jobs)
- **Does not own**: contenuti Blueprint scoped a tenant

### 2.6 Blueprint Origin™ (system role)
- **Natura**: template canonical del workspace tenant
- **Tier variants**: `origin_starter`, `origin_studio`, `origin_atelier`, `origin_brand` (configurabili)
- **Provides**: source rows per il clone Step 6
- **Versioned**: ogni Origin ha `origin_version` per audit + future migration
- **Owned by**: MOOD (Super Admin only)
- **Cloned to**: ogni nuovo tenant alla provisioning

### 2.7 Blueprint Tenant (workspace istanziato)
- **Natura**: istanza di Blueprint Origin clonata per uno specifico tenant
- **Lives at**: `<subdomain>.moodfordesign.com` (futuro) — oggi `/command-center/welcome` workaround
- **Scope**: tutto `WHERE tenant_id = X`
- **Owned by**: Founder (operativamente) · MOOD (architetturalmente)
- **Mutable independently**: sì — un tenant può divergere dal proprio Origin nel tempo

### 2.8 System Automation (the platform itself)
- **Natura**: backend services + queue workers
- **Components**:
  - **TQS Service** → calcolo qualification score
  - **Advisor Router** → assegnazione automatica
  - **Tenant Factory™** → clone Blueprint Origin
  - **Provisioning Engine™** → DNS + TLS + ingress
  - **Invitation Service** → emissione token + email
  - **Notification Service** → wrapper Resend
  - **Audit Log Service** → eventi su `*_events` tables
- **Authentication**: service-internal (no user session)
- **Idempotency**: ogni job ha `idempotency_key`; retry safe

---

## 3. Object Lifecycle

Per ogni oggetto: **birth · transitions · death**.

### 3.1 `studio_request`
| Fase | Trigger | Note |
|---|---|---|
| **Birth** | `POST /api/studio/v2/submit` | Status iniziale = `submitted` (se il funnel ha auto-save: anche `draft` esisteva, ma è un oggetto separato `studio_v2_drafts`) |
| **Transitions** | Vedi §4.1 state machine | Ogni transizione logga `studio_request_v2_events` |
| **Death** | Mai cancellata fisicamente | Status terminali: `rejected`, `archived` — restano per audit |

Vedi anche: data mapping legacy v1 → v2 in `03_SCORE_E2E_MIGRATION.md` §3.3.

### 3.2 `advisor_lead`
| Fase | Trigger | Note |
|---|---|---|
| **Birth** | Manualmente da Advisor in `/command-center/advisor-console/leads/new` (esistente) | Indipendente da `studio_request` |
| **Match** | Advisor associa esplicitamente `studio_request_id` se prospect aveva già un lead aperto | Field `advisor_leads.linked_studio_request_id` |
| **Transitions** | `new` → `contacted` → `qualified` → `converted` / `lost` | Implementato in `024_mood_core_advisor_identity.sql` |
| **Death** | Soft-archive `status=archived` | Mai eliminato |

### 3.3 `tenant`
| Fase | Trigger | Note |
|---|---|---|
| **Birth** | Approval di `studio_request` (Step 5) | Status iniziale = `planned` |
| **Transitions** | `planned` → `provisioning` → `active` → (`suspended` | `archived`) | Vedi §4.2 state machine |
| **Death** | Mai cancellato fisicamente | `archived` è terminale ma reversibile (può tornare `active` con riprovisioning) |

### 3.4 `subdomain` (concettuale, non tabella indipendente)
- **Storage**: `tenants.subdomain` (UNIQUE, NOT NULL quando tenant esiste)
- **Birth**: Approval (Step 5) — slug confermato dall'advisor
- **Reservation lifecycle**: soft-lock già durante `studio_request.status IN (pending_review, under_review, approved)` per 14 giorni — vedi `02_TECH_DESIGN.md` §2.5
- **Provisioning**: Step 7 (DNS + TLS attivati)
- **Death**: solo se tenant `archived` AND scaduti 6 mesi → libera lo slug per reuso (richiede esplicita Super Admin action)

### 3.5 `founder_user`
- **Storage**: `users` con `role=founder`, `tenant_id=<owner tenant>`
- **Birth**: Step 8 (System Automation crea row in stato `email_verified=false`, `password_hash=NULL`)
- **Activation**: Step 9 (founder clicca magic-link, setta password, `email_verified=true`)
- **Transitions stato user**: `invited` (DB row exists, no login yet) → `active` (logged in once) → `suspended` (admin action) → `archived`
- **Death**: mai. Suspend/archive sono soft.

### 3.6 `tenant_membership`
- **Storage**: `tenant_memberships(tenant_id, user_id, role, joined_at, role_capabilities JSONB)`
- **Birth**: Step 8 per il founder; successivamente per ogni team member invitato dal founder
- **Roles**: `founder`, `designer`, `editor`, `viewer`, `client_guest` (futuro)
- **Transitions**: cambio `role` solo da admin del tenant (founder o role manager designato)
- **Death**: revoca = `revoked_at = now()`; mai eliminato. Storia membership preservata.

### 3.7 `invitation`
- **Storage**: `invitations(id, tenant_id, email, role, token, expires_at, consumed_at, revoked_at)`
- **Birth**: Step 8 (founder) o ogni successiva azione "invite team member"
- **Token**: random URL-safe, single-use, expiry default 14 giorni
- **Transitions**:
  - `pending` (`consumed_at IS NULL AND revoked_at IS NULL AND expires_at > now()`)
  - `consumed` (`consumed_at IS NOT NULL`) → terminale success
  - `expired` (`expires_at <= now()` AND not consumed) → terminale, può essere reissued
  - `revoked` (`revoked_at IS NOT NULL`) → terminale, admin action
- **Death**: storicizzato. Mai eliminato.

### 3.8 `activation_token`
> Categoria che include due sotto-tipi.

#### 3.8.a `advisor_activation_tokens` (esistente, migration 025)
- Generati dall'advisor per attribuirsi una `studio_request` futura
- Quando il visitatore arriva via link `?ref=<token>` → studio_request riceve `referrer_advisor_token` field, advisor pre-assigned al submit

#### 3.8.b `magic_link_tokens` (sezione invitation + access continuity)
- Stessa infrastruttura `access_magic_links` esistente
- Usati per Step 9 (founder first access) + per ogni futuro login passwordless / password reset

### 3.9 `billing_profile`
- **Storage**: `billing_profiles(tenant_id, plan_tier, commercials JSONB, status, ...)`
- **Birth**: Step 5 (Approval) — initial draft con tier proposto dall'advisor
- **Activation**: Step 10 (Blueprint Live) se commercial tier richiede attivazione; oppure manuale post-onboarding
- **Transitions**: `draft` → `pending_terms` → `active` → (`overdue` | `suspended`) → `closed`
- **Death**: `closed` è terminale; storico preservato

---

## 4. State Machines

### 4.1 `studio_request`

```
                ┌────────┐
                │ draft  │  (in studio_v2_drafts — separate object)
                └────┬───┘
                     │ POST /submit
                     ▼
              ┌─────────────┐
              │  submitted  │ ◄─────────────────────────────┐
              └──────┬──────┘                                │
                     │ advisor router (auto)                 │
                     ▼                                       │
              ┌─────────────┐                                │
              │  assigned   │                                │
              └──────┬──────┘                                │
                     │ advisor opens detail                  │
                     ▼                                       │
              ┌──────────────┐                               │
              │ under_review │                               │
              └──────┬───────┘                               │
                     │                                       │
        ┌────────────┼────────────┬────────────┐             │
        ▼            ▼            ▼            ▼             │
    ┌────────┐  ┌────────┐  ┌──────────┐  ┌──────────┐       │
    │approved│  │rejected│  │needs_info│  │duplicate │       │
    └───┬────┘  └────────┘  └────┬─────┘  └────┬─────┘       │
        │       (terminal)       │ founder      │ (terminal) │
        │                        │ provides     │            │
        │                        │ info         │            │
        │                        └──────────────┴────────────┘
        ▼                              (back to under_review)
   tenant provisioning →
   (Steps 6-10)
        │
        ▼
   ┌──────────┐
   │ archived │ (terminal success)
   └──────────┘
```

#### Allowed transitions table
| From | To | Trigger | Actor |
|---|---|---|---|
| (none) | `submitted` | POST /submit | Visitor + System |
| `submitted` | `assigned` | Auto-router or SA manual | System / Super Admin |
| `assigned` | `under_review` | Advisor opens detail | Advisor |
| `under_review` | `approved` | Approve action | Advisor (+SA confirm on edge) |
| `under_review` | `rejected` | Reject action | Advisor (+SA confirm) |
| `under_review` | `needs_info` | Needs info action | Advisor |
| `under_review` | `duplicate` | Duplicate action | Advisor |
| `needs_info` | `under_review` | Founder responds | Founder (via email/link, future) |
| `approved` | `archived` | Provisioning complete (Step 10) | System Automation |
| Any non-terminal | `archived` | Manual archive (SA) | Super Admin |

### 4.2 `tenant`

```
              (created at studio_request.approved)
                          │
                          ▼
                  ┌──────────────┐
                  │   planned    │
                  └──────┬───────┘
                         │ provisioning_job picked
                         ▼
                  ┌──────────────┐
                  │ provisioning │ ◄────────────┐
                  └──────┬───────┘              │
                         │                      │ failure → retry
                         ▼                      │
                  ┌──────────────┐              │
                  │   active     │ ─────────────┘
                  └──────┬───────┘
                         │
            ┌────────────┼────────────┐
            ▼                         ▼
       ┌──────────┐             ┌──────────┐
       │suspended │ ◄───────────│  active  │
       └─────┬────┘             └──────────┘
             │ admin reactivates
             ▼
        (active)
             │
             ▼
       ┌──────────┐
       │ archived │ (terminal, but reversible via re-provisioning to planned)
       └──────────┘
```

#### Allowed transitions table
| From | To | Trigger | Actor |
|---|---|---|---|
| (none) | `planned` | Approval of studio_request | Advisor approval → System |
| `planned` | `provisioning` | Job picked from queue | System Automation |
| `provisioning` | `active` | Steps 6-10 complete + healthcheck pass | System Automation |
| `provisioning` | `planned` | Failure with retry budget remaining | System Automation |
| `active` | `suspended` | Manual suspend (billing, ToS violation) | Super Admin |
| `suspended` | `active` | Manual reactivation | Super Admin |
| `active` | `archived` | Manual archive (off-boarding) | Super Admin |
| `suspended` | `archived` | Manual archive | Super Admin |
| `archived` | `planned` | Re-provisioning request (rare, manual) | Super Admin |

---

## 5. Ownership Matrix

Convenzione: **C**=Create · **R**=Read · **U**=Update · **D**=Delete · **—**=no access

### 5.1 Objects ownership

| Object | Command Center (SA) | Advisor | Founder | Blueprint Tenant |
|---|---|---|---|---|
| `studio_request` | C R U D-soft | R (own scope) U (status, notes) | — (read own via reference code page, future) | — |
| `advisor_lead` | R U D-soft | C R U D-soft (own) | — | — |
| `advisor_lead_activity` | R | C R U D-soft (own) | — | — |
| `advisor_activation_token` | R revoke | C R revoke (own) | — | — |
| `tenant` | C R U D-soft | R (own scope) | R (own, limited fields) | R (own, limited) |
| `tenant.subdomain` | C U | R | R | R |
| `tenant_status` | U (suspend/archive) | — (request only) | — | — |
| `users` (role=founder) | R U D-soft | R (own scope) | R U (own profile) | — |
| `users` (role=designer/team) | R | R (related tenants) | C R U D-soft (own tenant) | C R U (depending on role) |
| `tenant_membership` | R | R | C R U D-soft (own tenant) | — |
| `invitation` | R revoke | R (related) | C R revoke (own tenant) | — |
| `billing_profile` | C R U | R (own tenant scope) | R (own tenant) U (limited fields like billing contact) | — |
| `qualification_score` | R (recompute) | R | — | — |
| `countries` | C R U D-soft | R | R | R |
| `active_languages` | C R U D-soft | R | R | R |
| `reserved_subdomains` | C R U D-soft | R | — | — |
| `blueprint_pages` (own tenant) | R | R (related) | C R U D | C R U D |
| `blueprint_blocks` (own tenant) | R | R (related) | C R U D | C R U D |
| `blueprint_media` (own tenant) | R | R (related) | C R U D | C R U D |
| `tqs_versions` (config) | C R U | R | — | — |
| `provisioning_jobs` | R retry cancel | R (own scope) | — | — |
| `audit events` (*_events) | R | R (own scope) | R (own tenant scope, limited) | R (own scope) |

### 5.2 Operative rules

| Rule | Applies to |
|---|---|
| **No hard delete** | Tutti gli oggetti business. Solo soft delete (`archived_at`, `revoked_at`, `deleted_at`). |
| **Cross-tenant isolation** | Ogni query Blueprint deve filtrare `WHERE tenant_id = X` (RLS o esplicito). Mai cross-tenant join in API tenant-facing. |
| **MOOD HQ visibility** | Super Admin può vedere metadata di ogni tenant ma NON contenuti Blueprint (es. moodboard, project files). Per debug richiede consenso esplicito tenant. |
| **Advisor scope** | Advisor vede solo studio_requests assignati o nella propria area geografica/specialization (`advisor_profiles.scope`). |
| **Founder downgrade** | Founder può "promote" un altro membro del tenant a "co-founder" → ruolo elevato ma single founder rimane proprietario di billing (configurabile in fase future). |

---

## 6. Future Architecture — OGGI vs DOMANI

### 6.1 OGGI (workaround temporaneo, post-incident P0 stabilization)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  moodfordesign.com                                                       │
│                                                                          │
│  /                  → corporate marketing                                │
│  /studio            → funnel v1 (deprecated soon)                        │
│  /accedi            → unified login                                      │
│                                                                          │
│  /command-center/*  → workspace MOOD Core (Super Admin + Advisor)        │
│      ├─ /overview                                                        │
│      ├─ /advisors                                                        │
│      ├─ /advisor-console                                                 │
│      ├─ /studio-requests                                                 │
│      ├─ /pages, /blocks, /media (CMS editing)                            │
│      └─ /welcome  ◄── Founder REDIRECT TEMPORANEO                        │
│                       (founder atterra qui ma vede SOLO welcome page,    │
│                        nessun accesso a MOOD Core funnel)                │
└──────────────────────────────────────────────────────────────────────────┘
```

**Pro**: nessun bisogno di multi-tenant routing infrastruttura
**Contro**: confusione concettuale ("perché il mio Blueprint sta dentro Command Center?")
**Mitigation**: route guard rigido + UI completamente separata + zero menu MOOD visibile al founder

### 6.2 DOMANI (canonical, multi-tenant subdomain)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  moodfordesign.com                                                       │
│  ├─ /                  → corporate marketing                             │
│  ├─ /studio/v2         → activation funnel                               │
│  ├─ /accedi            → unified identity router                         │
│  │                       (after login: redirect to correct workspace)    │
│  └─ /command-center/*  → MOOD Core (SA + Advisor only — NO founder)      │
│                                                                          │
│  martinel.moodfordesign.com   → Blueprint tenant for martinel            │
│  format.moodfordesign.com     → Blueprint tenant for format              │
│  197design.moodfordesign.com  → Blueprint tenant for 197design           │
│                                                                          │
│  Each tenant subdomain mounts:                                           │
│  ├─ /                     → tenant home (curated by tenant)              │
│  ├─ /dashboard            → Blueprint workspace                          │
│  ├─ /projects, /materials, /journey, ...                                 │
│  └─ /settings             → team, billing contact, branding              │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Componenti futuri (P1–P2 backlog)

| Component | Purpose | Phase |
|---|---|---|
| **Blueprint Origin™** | Template canonical multi-tier per la base di ogni tenant | P1 |
| **Tenant Factory™** | Servizio che clona Origin → Blueprint scoped a tenant_id | P1 |
| **Provisioning Engine™** | DNS API + cert manager + ingress controller orchestration | P1 |
| **Multi-tenant Identity** | JWT con `tenant_id` claim · session router per subdomain | P1 |
| **Tenant Branding Manager** | Brand colors, font, logo per-tenant senza fork del codice | P2 |
| **Cross-tenant Analytics** (MOOD HQ) | Dashboard aggregate per Super Admin (no PII di Blueprint) | P2 |
| **Tenant Cloning** | "Clona da tenant esistente" per agenzie multi-brand | P3 |
| **Commercial Terms Engine** | Pricing dinamico, contracts, signed agreements | P3 (FROZEN) |
| **Billing & Commissions** | Stripe integration + advisor commission calc | P3 (FROZEN) |
| **Payouts** | Advisor settlement | P3 (FROZEN) |

#### Migration "oggi → domani"

```
PHASE A — Foundation (P1, current focus)
    Studio Activation Flow v2 ready
    studio_requests_v2 table + TQS
    ↓
PHASE B — Blueprint Origin™ canonization
    Identify what's "templatable" in current Blueprint codebase
    Create blueprint_origins(version, tier, payload_jsonb) registry
    ↓
PHASE C — Tenant Factory™
    Clone job: from origin_version + tenant_tier → INSERT scoped rows
    Idempotent, replayable
    ↓
PHASE D — Provisioning Engine™
    DNS automation (Cloudflare/Vercel API)
    TLS via Let's Encrypt or hosting provider
    Healthcheck loop
    ↓
PHASE E — Subdomain routing
    Ingress + frontend tenant_id resolver
    /command-center remains apex
    <slug>.moodfordesign.com mounts BlueprintTenantShell
    ↓
PHASE F — Founder redirect retirement
    /command-center/welcome → permanent redirect to <slug>.moodfordesign.com/activate
    Workaround OGGI fully sunset
```

---

## 7. Validation Checklist (obbligatori prima di ogni step critico)

### 7.1 Pre-submit (Step 1)
| ID | Check | Layer | Failure mode |
|---|---|---|---|
| V01 | Email uniqueness globale via `v_global_email_registry` | Backend | Block submit, status 409 |
| V02 | Email RFC 5322 + DNS-MX (best-effort) | Backend | Block submit, error inline |
| V03 | Anti-enumeration jitter su `check-email` | Backend | N/A (silent) |
| V04 | Subdomain uniqueness (`tenants.subdomain` + `studio_requests_v2.subdomain_slug` soft-lock) | Backend | Block submit, suggest alternative |
| V05 | Reserved subdomain protection (`reserved_subdomains`) | Backend | Block submit, error inline |
| V06 | Country code ∈ `countries` AND `is_enabled=true` | Backend | Block submit |
| V07 | Languages all ∈ `active_languages` AND `is_enabled=true` | Backend | Block submit |
| V08 | Mapbox geometry coherent with `country_code` (if not fallback) | Backend (advisory) | Warning only, advisor flag |
| V09 | Studio_type ∈ enum di 8 | Backend | Block submit |
| V10 | Primary_goals length 1..4, ∈ enum di 6 | Backend | Block submit |
| V11 | Honeypot field empty | Backend | Silent accept + flag for advisor |
| V12 | Rate limit per IP not breached | Backend | 429, retry |

### 7.2 Pre-score (Step 2)
| ID | Check |
|---|---|
| V13 | `scoring_version` set (`v1.0.0` o successivi) |
| V14 | All required fields present (re-check defense in depth) |
| V15 | Behavioral signals captured (`duration_s`, `first_try_email`, `first_try_subdomain`) |

### 7.3 Pre-assignment (Step 3)
| ID | Check |
|---|---|
| V16 | At least one `advisor_profile` with matching scope exists |
| V17 | Selected advisor `is_active = true` AND `accepting_new_leads = true` |
| V18 | No conflict: advisor self-assigned to same prospect already in `advisor_leads` |

### 7.4 Pre-approval (Step 5)
| ID | Check |
|---|---|
| V19 | Studio_request.status = `under_review` (no skip allowed) |
| V20 | Advisor has permission on this request (assignment or SA override) |
| V21 | Approved subdomain re-validated (V04, V05) — race-safe |
| V22 | Billing tier explicitly chosen by advisor |
| V23 | Commercial terms acknowledged (checkbox) |

### 7.5 Pre-provisioning (Step 6-7)
| ID | Check |
|---|---|
| V24 | Tenant row created and status = `planned` |
| V25 | Blueprint Origin selected (tier match) |
| V26 | Origin version available and not deprecated |
| V27 | Subdomain DNS pre-check: no orphan record exists |
| V28 | Idempotency: provisioning_job has unique key (request_id) |

### 7.6 Pre-invitation (Step 8)
| ID | Check |
|---|---|
| V29 | Tenant.status = `provisioning` AND blueprint clone succeeded |
| V30 | Founder email still globally unique (final guard) |
| V31 | Magic-link token random ≥ 192-bit entropy |
| V32 | Resend API healthy (graceful fail: queue retry) |

### 7.7 Pre-first-access (Step 9)
| ID | Check |
|---|---|
| V33 | Invitation token not expired and not consumed |
| V34 | Token matches `tenant_id` claim |
| V35 | Password policy enforced (min 12, mixed case, digit, special) |
| V36 | Brute force protection on token consume endpoint |

### 7.8 Pre-Blueprint-live (Step 10)
| ID | Check |
|---|---|
| V37 | Founder user `email_verified = true` AND `password_hash IS NOT NULL` |
| V38 | Tenant.status set to `active` only after healthcheck PASS |
| V39 | Studio_request.status moves to `archived` (terminal success) |
| V40 | Audit event chain completo (1 event per step, ordinato) |

---

## 8. Cross-cutting concerns

### 8.1 Audit log
Ogni transizione di stato sui 9 oggetti di §3 produce **una riga** in una tabella `*_events` corrispondente con:
```
{ id, object_id, event_type, actor_id, actor_role, payload jsonb, created_at, ip, user_agent }
```

### 8.2 Idempotency
| Operation | Idempotency key |
|---|---|
| `studio_request` submit | `draft_token` |
| `qualification_score` compute | `(studio_request_id, scoring_version)` |
| `advisor_assignment` | `(studio_request_id)` (only first wins, subsequent are no-op unless SA reassign) |
| `provisioning_job` | `(tenant_id, step_name)` |
| `invitation` issue | `(tenant_id, email, intent)` — re-issuing replaces previous active |
| Resend email dispatch | `(template_id, target_email, related_object_id, day)` |

### 8.3 Privacy & GDPR readiness
- Founder PII (name, email, phone) stored in `studio_requests_v2` + `users`
- Right to be forgotten: soft delete + anonymization function (replace PII with hash, preserve audit shape)
- Data export: founder can request CSV of own tenant data (P2 feature)
- Cross-tenant data isolation: structural (vedi §5.2)

### 8.4 Internationalization
- All user-facing strings in `site_blocks` (vedi `01_COPY_AND_CMS.md`)
- Locale resolution cascade: explicit user pref → `Accept-Language` → IT (source)
- Tenant locale (different from MOOD Core locale): saved in `tenants.default_locale`, used as Blueprint default

### 8.5 Observability
| Signal | Where |
|---|---|
| Funnel completion rate | `studio_request_v2_events` aggregations |
| TQS distribution | Materialized view `mv_tqs_distribution_daily` (future) |
| Provisioning success rate | `provisioning_jobs` table |
| Time-to-active (submit → tenant.active) | Computed cross-table |
| Advisor response time | `studio_request_v2_events` (assigned_at → under_review_at) |

---

## 9. Open architectural decisions

These remain to be confirmed before implementation kickoff (not blocking the document approval):

1. **Subdomain pattern**: `<slug>.moodfordesign.com` (proposed) vs `<slug>.app.moodfordesign.com`. Proposed: apex subdomain, cleaner.
2. **Multi-domain support**: in P3+, allow tenants to bring their own domain (e.g., `studio.martinel.it` → Blueprint)? Default: yes in roadmap, no in P1.
3. **Founder = single user vs multiple**: a tenant always has exactly one `role=founder` user, or can a tenant have multiple co-founders? Proposed: 1 founder + N co-founders (role label, equivalent permissions on Blueprint, single billing owner).
4. **Tenant suspension UX**: when SA suspends a tenant, what does founder see at the subdomain? Proposed: minimal page "Workspace suspended — contact support" + email pre-notification.
5. **Blueprint Origin versioning**: when Origin v2 ships, do existing tenants auto-migrate? Proposed: NO. They stay on their original version. Migration is opt-in, advisor-driven.
6. **Provisioning failure recovery**: if Step 6/7 fail repeatedly, automatic SA escalation or auto-rollback? Proposed: 3 retries with exponential backoff → SA-escalation ticket, never auto-rollback.
7. **Reserved slug expansion**: who manages? Proposed: SA only, via `/command-center/system-config/reserved-subdomains` (P2 backlog).
8. **Advisor commission attribution**: based on referral token at submit or based on advisor_assigned_to at approve? Proposed: token wins if present, else assignment.
9. **TQS visibility to Founder**: never. TQS is internal only. Founder never sees their own score (confirmed).
10. **Re-submission policy**: if a studio_request is rejected, can the same email submit again? Proposed: yes, after 30 days OR with new email. Tracked in `studio_request_v2.previous_attempts` (future field).

---

## 10. Glossary

| Term | Definition |
|---|---|
| **Studio Activation Funnel** | Public-facing 5-movement form at `/studio/v2` |
| **Studio Request** | DB row capturing a single funnel submission |
| **TQS** | Tenant Qualification Score™ — internal 0-100 score with tier |
| **Tenant** | A studio's workspace instance in MOOD platform |
| **Subdomain** | The `<slug>.moodfordesign.com` URL of a tenant |
| **Founder** | Primary owner of a tenant; B2B customer of MOOD |
| **Advisor** | MOOD-side collaborator who reviews requests and supports tenants |
| **Super Admin** | MOOD HQ ops with full platform control |
| **Command Center** | MOOD-side workspace (at `moodfordesign.com/command-center`) |
| **Blueprint** | Tenant-side workspace (in future at `<slug>.moodfordesign.com`) |
| **Blueprint Origin™** | Canonical template from which each tenant's Blueprint is cloned |
| **Tenant Factory™** | Service that clones Blueprint Origin to a new tenant |
| **Provisioning Engine™** | Service that creates DNS + TLS + ingress for new tenants |
| **Design Journey™** | Tenant-side product layer (out of scope for this doc) |
| **Material Intelligence™** | Tenant-side product layer (out of scope) |
| **Moodboard Experience™** | Tenant-side product layer (out of scope) |

---

## 11. Document governance

| Aspect | Value |
|---|---|
| **Canonical version** | v1.0 — 2026-05-31 |
| **Owner** | Engineering Lead (current drafting agent → handoff to permanent owner) |
| **Approval required by** | User (product owner) |
| **Change protocol** | PR to this file with rationale; SA review; version bump (semantic) |
| **Reference docs** | `/app/memory/STUDIO_V2/00_OVERVIEW_AND_UX.md`, `/01_COPY_AND_CMS.md`, `/02_TECH_DESIGN.md`, `/03_SCORE_E2E_MIGRATION.md` |
| **Status of dependencies** | P0 Supabase incident: investigation in progress · implementation blocked |

---

## 12. Cosa NON è coperto in questo documento

Per chiarezza:
- ❌ Codice, migration, componenti, SQL eseguibile
- ❌ Pricing, billing, commercial contracts (delegati a `Commercial Terms Engine`, FROZEN)
- ❌ Stripe / PSP integration (FROZEN)
- ❌ Advisor commission rules (FROZEN)
- ❌ Tenant Cloning per agenzie (P3)
- ❌ Blueprint operational features (Material Intelligence, Moodboard, Design Journey) — questi vivono nella tenant scope, fuori dal lifecycle MOOD Core
- ❌ Marketing site IA (corporate pages, journal, magazine)
- ❌ Tenant self-service (delete account, export data) — P2

---

— *fine documento canonico · STOP per consegna · in attesa di approvazione* —
