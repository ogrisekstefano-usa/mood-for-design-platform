# RELATIONSHIP OS™ — FOUNDATION PLAN
> Trasformare il Command Center da pipeline di candidature a **sistema
> relazionale**. Versione MVP. NESSUNA implementazione in questo documento.
> Solo audit, schema e roadmap.

**Classificazione finale**: 🟡 **`NEEDS_ARCHITECTURE_WORK`** (1 settimana di
consolidamento prima di iniziare M1).

Motivazione: l'infrastruttura DB esiste per il 70% ma è **frammentata in
modelli paralleli** non collegati fra loro (`contacts`/`accounts` vs
`studio_team_members`, `notifications` vs `relationship_notifications`,
`tenant_activity_events` vs `studio_relationship_events`). Prima di
scrivere una sola riga di feature CRM va presa una **decisione canonica
sul modello dati**, altrimenti accumuleremo debito relazionale che
nessuna iterazione futura potrà più riparare.

---

## 1 · AUDIT — STATO ATTUALE

### 1.1 Cosa il Command Center sa fare oggi
| Surface | Path | Stato |
|---|---|---|
| Overview governance | `/command-center/overview` | KPI super-admin, conta lead/tenant |
| Advisors registry | `/command-center/advisors` | CRUD super-admin sugli advisor |
| Advisor Console | `/command-center/advisor-console` | Lista lead+studio_relations dell'advisor |
| Relation Detail | `/command-center/advisor-console/relations/:id` | Timeline `studio_relationship_events` + followup + visit reports |
| Studio Requests | `/command-center/studio-requests` | Kanban candidature V2 |
| Tenant Activation | `/command-center/tenant-activation` | Kanban attivazione tenant |
| Founder Welcome | `/command-center/welcome` | Schermata cinematica post-magic-link |
| Blueprint CMS | `/command-center/{pages,blocks,sections,media,footer,seo,publish}` | CMS unificato per super-admin |

### 1.2 Cosa **non** sa fare
- ❌ Multi-contatto per tenant (solo `contact_name/email/phone` su `studio_requests`)
- ❌ Timeline relazionale unificata (eventi automatici + email + manuali)
- ❌ Activity log commerciale (call/meeting/whatsapp/linkedin)
- ❌ Notifiche interne (badge 🔔)
- ❌ Tenant Overview (founder vede solo `/welcome`, super-admin non ha pagina aggregata)
- ❌ Advisor KPI dashboard
- ❌ Catalog DB-driven di tipologie attività / ruoli contatto / kind eventi

### 1.3 Censimento tabelle DB esistenti **già utili** o **già pronte**

🟢 = già in uso · 🟡 = struttura presente ma vuota · 🔴 = parallelo/duplicato

| Tabella | Cols | Rows | Stato | Note |
|---|---|---|---|---|
| `studio_relations` | 31 | 19 | 🟢 | Ancora relazionale advisor↔studio. Già con status/temperature/owner/last_activity. |
| `studio_relationship_events` | 6 | 38 | 🟢 | Timeline append-only, `kind` text-enum (15 valori cablati nel commento SQL). |
| `advisor_followups` | 11 | 0 | 🟡 | Reminder con tipo+due_at+status, FK relation_id. Service esiste ma UI non lo scrive. |
| `studio_visit_reports` | — | 0 | 🟡 | Visit reports curatoriali. Service esiste. |
| `advisor_notes` | 7 | 0 | 🟡 | Note interne advisor↔tenant. Mai chiamata. |
| `advisor_lead_activities` | 12 | 0 | 🟡 | Activity log lead-centric (call/meeting/email/outcome/next_action). **Mai usata.** |
| `studio_team_members` | 14 | 0 | 🟡 | Multi-team-member con role/specialties/languages. **Mai usata.** |
| `contacts` | 17 | 0 | 🔴 | Generica, FK a `accounts` (non a `tenants`/`studio_relations`). Modello parallelo. |
| `accounts` | — | — | 🔴 | Modello parallelo a `tenants`. Crea ambiguità. |
| `tenant_activity_events` | 5 | 0 | 🔴 | Solo tenant_id/user_id/event_type/created_at. **Niente payload**, troppo povera. |
| `notifications` | 9 | 0 | 🔴 | Title/message/read_at, generica. Mai scritta. |
| `relationship_notifications` | 17 | 0 | 🟡 | Modello ricco con priority/payload/action_url. Mai scritta. |
| `tasks` | — | — | 🔴 | Generica, slegata da relations. |
| `studio_email_dispatch_log` | — | 165+ | 🟢 | Log email Resend. Utilizzabile per timeline. |
| `platform_languages` | 18 | 12 | 🟢 | Catalogo lingue (per `preferred_language` contatti). |
| `markets` | — | — | 🟢 | Catalogo mercati. |
| `countries` | — | 4+ | 🟢 | Catalogo ISO. |

---

## 2 · GAP ANALYSIS

| Gap | Severità | Causa | Decisione richiesta |
|---|---|---|---|
| Modello multi-contatto **frammentato** | 🔴 P0 | 3 candidati: `contacts`, `studio_team_members`, colonne su `studio_relations` | Eleggere un unico canonical model |
| Notification system **doppio** | 🔴 P0 | `notifications` + `relationship_notifications` entrambe vuote | Eleggere uno, deprecare l'altro |
| Activity log **doppio** | 🔴 P0 | `advisor_lead_activities` + `studio_relationship_events` (manual events) | Estendere uno, scartare altro |
| `kind` / `event_type` / `activity_type` **hardcoded** | 🟠 P1 | Free-text con enum cablati in SQL comment | Tassonomia DB-driven (`relationship_event_types` catalog) |
| Tenant Overview surface **assente** | 🟠 P1 | Solo `FounderWelcome` (cinematic, 1-shot) | Nuova route `/command-center/tenants/:id` + `/blueprint/overview` |
| Advisor KPI **assenti** | 🟠 P1 | `AdvisorConsole` lista lead ma non KPI | Aggiungere card numeriche in cima |
| Email events nel timeline **non integrati** | 🟢 P2 | `studio_email_dispatch_log` esiste ma non confluisce | View SQL `v_relationship_timeline` |
| Internal notification badge UI **mancante** | 🟠 P1 | Nessun componente, nessun fetcher | Nuovo widget `<NotificationBell />` + `/api/notifications/unread-count` |

---

## 3 · SCHEMA DB PROPOSTO

> Principio guida: **estendere** ciò che è già in uso (`studio_relations` +
> `studio_relationship_events`). **Deprecare** modelli paralleli non
> usati. Aggiungere **5 tabelle nuove** e **1 vista** per chiudere i gap.

### 3.1 Modello canonical (decisioni)

| Concetto | Canonical | Deprecato |
|---|---|---|
| Account commerciale | `tenants` | `accounts` (deprecato) |
| Contatti multi-ruolo | **NEW**: `tenant_contacts` | `contacts`, `studio_team_members` |
| Timeline narrativa | `studio_relationship_events` (estesa) | `tenant_activity_events`, free `kind` |
| Activity log commerciale | **NEW**: `relationship_activities` | `advisor_lead_activities` |
| Notifiche interne | `relationship_notifications` (già rich) | `notifications` (generica) |
| Reminder / next action | `advisor_followups` (già attiva) | — |

### 3.2 Migration `031_relationship_os_foundation.sql` (proposta)

```sql
-- ─── platform_relationship_event_types ─────────────────────────────────
-- Tassonomia DB-driven per kind degli eventi della timeline
CREATE TABLE platform_relationship_event_types (
  code              TEXT PRIMARY KEY,
  category          TEXT NOT NULL,    -- 'lifecycle' | 'communication' | 'manual' | 'system'
  source            TEXT NOT NULL,    -- 'auto' | 'manual'
  icon              TEXT,             -- lucide name
  color             TEXT,             -- hex / token
  label_it          TEXT NOT NULL,
  label_en          TEXT NOT NULL,
  sort_order        INT NOT NULL DEFAULT 100,
  enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── platform_contact_roles ────────────────────────────────────────────
-- Tassonomia DB-driven per ruoli contatto (Founder/Owner/Marketing/…)
CREATE TABLE platform_contact_roles (
  code              TEXT PRIMARY KEY,
  category          TEXT NOT NULL,    -- 'leadership' | 'operations' | 'commercial' | 'external'
  label_it          TEXT NOT NULL,
  label_en          TEXT NOT NULL,
  sort_order        INT NOT NULL DEFAULT 100,
  enabled           BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─── platform_activity_types ───────────────────────────────────────────
-- Tassonomia DB-driven per tipi attività commerciali
CREATE TABLE platform_activity_types (
  code              TEXT PRIMARY KEY,    -- 'call'|'meeting'|'email'|'whatsapp'|'linkedin'|'visit'|'internal_note'|'task'
  icon              TEXT,
  default_duration_min INT,
  label_it          TEXT NOT NULL,
  label_en          TEXT NOT NULL,
  sort_order        INT NOT NULL DEFAULT 100,
  enabled           BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─── tenant_contacts ────────────────────────────────────────────────────
-- Multi-contact per tenant. Sostituisce contacts+studio_team_members.
CREATE TABLE tenant_contacts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  studio_relation_id  UUID NULL REFERENCES studio_relations(id) ON DELETE SET NULL,
  user_id             UUID NULL REFERENCES users(id) ON DELETE SET NULL,
                         -- valorizzato solo se contatto = account di login
  first_name          TEXT NOT NULL,
  last_name           TEXT,
  role_code           TEXT NOT NULL REFERENCES platform_contact_roles(code),
  email               TEXT,
  phone_prefix        TEXT,
  phone_number        TEXT,
  linkedin_url        TEXT,
  notes               TEXT,
  preferred_language  TEXT REFERENCES platform_languages(code),
  is_primary          BOOLEAN NOT NULL DEFAULT FALSE,
  status              TEXT NOT NULL DEFAULT 'active',
                         -- active | inactive | archived
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at    TIMESTAMPTZ
);
CREATE INDEX idx_tenant_contacts_tenant   ON tenant_contacts(tenant_id);
CREATE INDEX idx_tenant_contacts_relation ON tenant_contacts(studio_relation_id);
CREATE UNIQUE INDEX uq_tenant_contacts_primary
  ON tenant_contacts(tenant_id) WHERE is_primary = TRUE;

-- ─── relationship_activities ───────────────────────────────────────────
-- Activity log commerciale: call/meeting/email/whatsapp/...
CREATE TABLE relationship_activities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  studio_relation_id  UUID NULL REFERENCES studio_relations(id) ON DELETE SET NULL,
  contact_id          UUID NULL REFERENCES tenant_contacts(id) ON DELETE SET NULL,
  owner_user_id       UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  activity_type_code  TEXT NOT NULL REFERENCES platform_activity_types(code),
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_min        INT,
  subject             TEXT,
  outcome             TEXT,
  next_step           TEXT,
  next_step_due_at    TIMESTAMPTZ,
  reminder_sent_at    TIMESTAMPTZ,
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_relationship_activities_tenant_when
  ON relationship_activities(tenant_id, occurred_at DESC);
CREATE INDEX idx_relationship_activities_owner_when
  ON relationship_activities(owner_user_id, occurred_at DESC);
CREATE INDEX idx_relationship_activities_due
  ON relationship_activities(next_step_due_at) WHERE next_step_due_at IS NOT NULL;

-- ─── ALTER existing studio_relationship_events ─────────────────────────
ALTER TABLE studio_relationship_events
  ADD COLUMN IF NOT EXISTS tenant_id UUID NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS event_type_code TEXT NULL REFERENCES platform_relationship_event_types(code);
-- Back-fill via service. La colonna `kind` storica resta per compatibilità.
CREATE INDEX IF NOT EXISTS idx_relationship_events_tenant_when
  ON studio_relationship_events(tenant_id, occurred_at DESC);

-- ─── v_relationship_timeline (vista unificata) ─────────────────────────
-- Aggrega in un solo flusso cronologico:
--   1. studio_relationship_events  (lifecycle/system automatic)
--   2. studio_email_dispatch_log   (email events)
--   3. relationship_activities     (manual commercial activities)
CREATE OR REPLACE VIEW v_relationship_timeline AS
  SELECT 'event' AS source, e.id, e.tenant_id, e.relation_id,
         e.event_type_code AS type_code, NULL::TEXT AS subject,
         e.payload, e.actor_id AS owner_user_id, e.occurred_at AS at
    FROM studio_relationship_events e
  UNION ALL
  SELECT 'email' AS source, l.id, l.tenant_id, NULL::UUID AS relation_id,
         l.template_key AS type_code, l.subject,
         l.variables AS payload, NULL::UUID, l.created_at AS at
    FROM studio_email_dispatch_log l
  UNION ALL
  SELECT 'activity' AS source, a.id, a.tenant_id, a.studio_relation_id AS relation_id,
         a.activity_type_code AS type_code, a.subject,
         a.payload, a.owner_user_id, a.occurred_at AS at
    FROM relationship_activities a;
```

> ⚠ **NON eseguire questa migration prima dell'approvazione utente**.
> Conservata qui solo come specifica.

### 3.3 Dati seed (CMS-driven)

Tre seed script da preparare in M1 (NON eseguiti adesso):

- `seed_relationship_event_types.py` — 18 codici (relation_opened, contact_made, status_changed, …)
- `seed_contact_roles.py` — 12 codici (founder, owner, administration, marketing, sales_manager, project_manager, purchasing, supplier_contact, external_consultant, advisor, technical, finance)
- `seed_activity_types.py` — 8 codici (call, meeting, email, whatsapp, linkedin, visit, internal_note, task)

---

## 4 · MODULO 1 — CONTACT CRM

### 4.1 Surface
- `/command-center/tenants/:tenantId/contacts` (admin)
- `/blueprint/contacts` (founder, scope limitato al proprio tenant)

### 4.2 API
| Endpoint | Verb | Note |
|---|---|---|
| `/api/admin/tenants/:id/contacts` | GET | Lista contatti del tenant |
| `/api/admin/tenants/:id/contacts` | POST | Crea (anti-duplicato su email lower) |
| `/api/admin/tenants/:id/contacts/:cid` | PATCH | Aggiorna |
| `/api/admin/tenants/:id/contacts/:cid` | DELETE | Soft-delete (status='archived') |
| `/api/admin/tenants/:id/contacts/:cid/set-primary` | POST | Mark primary |
| `/api/catalogs/contact-roles` | GET | DB-driven (cached 60s) |

### 4.3 Componenti UI
- `<ContactList tenantId>` — tabella con role/email/lang/primary
- `<ContactForm>` — form con select role dal catalogo + select preferred_language dal catalogo
- `<PrimaryContactBadge>` — chip "primary"

---

## 5 · MODULO 2 — RELATIONSHIP TIMELINE

### 5.1 Surface
- Tab `Timeline` dentro Relation Detail (esistente)
- Tab `Timeline` dentro Tenant Overview (nuova)

### 5.2 Dati
Read-only su `v_relationship_timeline` filtrata per `tenant_id`.

### 5.3 Eventi automatici (writer)
Da hook esistenti che già scrivono in `studio_relationship_events`:
- `relation_opened` (già emesso)
- `status_changed` (già emesso)
- `temperature_changed` (già emesso)
- `activated` (da aggiungere in `activate_studio_ecosystem`)
- `email_sent` (NUOVO: hook in `email_dispatcher.send_template`)
- `login_first_access` (NUOVO: hook in `magic-link/consume`)
- `magic_link_issued` (NUOVO: hook in activation flow)
- `blueprint_first_access` (NUOVO: hook nel mount di `BlueprintApp`)

### 5.4 Eventi manuali
Scritti via `POST /api/admin/tenants/:id/activities` (vedi Modulo 3).

### 5.5 UI
- `<TimelineFeed tenantId>` — lista cronologica con icona per `type_code`, narrativa derivata da `payload`, locale-aware

---

## 6 · MODULO 3 — ACTIVITY LOG

### 6.1 Surface
- Tab `Attività` dentro Tenant Overview
- Sidebar `Le mie attività` dentro Advisor Console

### 6.2 API
| Endpoint | Verb |
|---|---|
| `/api/admin/tenants/:id/activities` | GET (filter: type, owner, date_range) |
| `/api/admin/tenants/:id/activities` | POST |
| `/api/admin/tenants/:id/activities/:aid` | PATCH |
| `/api/admin/tenants/:id/activities/:aid` | DELETE (soft) |
| `/api/admin/me/activities/upcoming` | GET (next_step_due_at ≤ +7d) |
| `/api/catalogs/activity-types` | GET |

### 6.3 Componenti
- `<ActivityForm>` (tipo, contact, outcome, next_step, due_at)
- `<UpcomingTasksWidget>` — usata sia in Overview che in Advisor Console

---

## 7 · MODULO 4 — INTERNAL NOTIFICATION CENTER

### 7.1 Trigger (regole di emissione, scritte server-side)
| Trigger | Recipient | Tipo |
|---|---|---|
| Nuova candidatura V2 ricevuta | Super-admin + advisor pool | `studio_request_received` |
| Lead senza review >48h | Super-admin | `lead_stale` |
| Tenant attivato | Owner + advisor + super-admin | `tenant_activated` |
| Founder primo login | Advisor + super-admin | `founder_first_login` |
| Activity `next_step_due_at` <24h | Owner attività | `task_due_soon` |
| Activity `next_step_due_at` < NOW | Owner attività | `task_overdue` |

### 7.2 Storage
`relationship_notifications` (già esistente, 17 colonne pronte).

### 7.3 API
| Endpoint | Verb |
|---|---|
| `/api/notifications` | GET (paginate, filter unread) |
| `/api/notifications/unread-count` | GET (cheap, poll-able 30s) |
| `/api/notifications/:id/read` | POST |
| `/api/notifications/read-all` | POST |
| `/api/notifications/:id/archive` | POST |

### 7.4 UI
- `<NotificationBell />` nella WorkspaceShell topbar, badge numerico con polling 30s
- `<NotificationPanel />` slide-out, raggruppa per giorno

---

## 8 · MODULO 5 — TENANT OVERVIEW

### 8.1 Surface
- **Admin**: `/command-center/tenants/:id` (nuova route)
- **Founder**: `/blueprint/overview` (nuova route, scope tenant proprio)

### 8.2 Tab layout
1. **Studio** — header con nome/slug/website/logo, market HQ + target countries
2. **Contatti** (Modulo 1)
3. **Timeline** (Modulo 2)
4. **Attività** (Modulo 3)
5. **Advisor** — owner_advisor_id + commission rules + visits
6. **Mercati** — operating market + target countries (modificabili dal founder?)
7. **Blueprint Status** — pages count, last publish, last access
8. **Ultimo accesso** — `users.last_login_at` del primary contact

### 8.3 API aggregata
`GET /api/admin/tenants/:id/overview` → unico payload (anti-N+1) con:
```
{ tenant, relation, contacts, advisor, kpis: { contacts_n, activities_30d, last_login_at } }
```

---

## 9 · MODULO 6 — ADVISOR WORKSPACE

### 9.1 Surface
Estendere `/command-center/advisor-console` esistente.

### 9.2 KPI in cima alla pagina
| KPI | Origine SQL |
|---|---|
| Lead aperti | `COUNT studio_relations WHERE owner = me AND status IN ('prospect','contacted')` |
| Review pendenti | `COUNT studio_requests WHERE assigned_advisor_id = me AND status='submitted'` |
| Tenant attivi | `COUNT studio_relations WHERE owner = me AND status='activated'` |
| Ultime 7 attività | `relationship_activities WHERE owner_user_id = me ORDER BY occurred_at DESC LIMIT 7` |
| Reminder oggi | `advisor_followups WHERE advisor_id = me AND status='open' AND due_at::date = CURRENT_DATE` |

### 9.3 Scope (già implementato, da preservare)
Filtro su `owner_advisor_id = me.id` o `assigned_advisor_id IS NULL OR = me.id`. Già in `_advisor_scope.py`.

---

## 10 · NO HARDCODED — Tassonomie DB-driven

| Tassonomia | Tabella | Cached |
|---|---|---|
| Ruoli contatto | `platform_contact_roles` | 60s in `services/catalogs.py` |
| Tipi attività | `platform_activity_types` | 60s |
| Kind eventi | `platform_relationship_event_types` | 60s |
| Lingue preferite | `platform_languages` (esiste) | 60s |
| Mercati | `markets` (esiste) | 60s |
| Paesi | `countries` (esiste) | 60s |
| Project types (futuro) | `platform_project_types` (M3) | 60s |
| Specializzazioni (futuro) | `platform_specializations` (M3) | 60s |

Endpoint pubblico unico: `GET /api/catalogs/:name?locale=it-IT`.

---

## 11 · EFFORT REALE

> Stima senior backend+frontend, riserve incluse. **NON è una promessa di consegna**.

| Milestone | Backend | Frontend | DB | QA | Tot |
|---|---|---|---|---|---|
| **M0** Consolidamento schema (decisioni + migration) | 1.5d | — | 1d | 0.5d | **3d** |
| **M1** Contact CRM (Modulo 1) | 1.5d | 2d | — | 0.5d | **4d** |
| **M2** Timeline + view (Modulo 2) | 1d | 1.5d | 0.5d | 0.5d | **3.5d** |
| **M3** Activity Log (Modulo 3) | 1d | 1.5d | — | 0.5d | **3d** |
| **M4** Notification Center (Modulo 4) | 2d | 1.5d | — | 1d | **4.5d** |
| **M5** Tenant Overview + Advisor KPI (Moduli 5+6) | 1.5d | 2d | — | 1d | **4.5d** |
| **Totale** | 8.5d | 8.5d | 1.5d | 4d | **~22.5d** |

---

## 12 · ROADMAP M1→M5

```
M0  Consolidamento DB        ──┐
                               │  bloccante per tutto il resto
M1  Contact CRM              ──┤
                               │
M2  Relationship Timeline    ──┼──► Foundation Ready
                               │
M3  Activity Log             ──┤
                               │
M4  Notification Center      ──┤
                               │
M5  Overview + Advisor KPI   ──┘
```

| M | Output verificabile |
|---|---|
| M0 | Migration 031 applicata, 3 cataloghi seed, decisioni canonical documentate |
| M1 | `/command-center/tenants/:id/contacts` CRUD, anti-duplicate, primary unique |
| M2 | `v_relationship_timeline` interrogabile, tab Timeline in Relation Detail + Tenant Overview |
| M3 | Activity form completo, upcoming widget, due reminders working |
| M4 | 🔔 badge in topbar, 6 trigger automatici, anti-spam idempotency |
| M5 | Tenant Overview unico endpoint + Advisor KPI bar |

### Acceptance criteria globali
- ✅ Tenant isolation preservata (founder vede SOLO il proprio tenant)
- ✅ Advisor scope preservato (advisor vede SOLO i propri lead+relations)
- ✅ Audit script `first_real_tenant_audit.py` continua a passare con 0 P0
- ✅ Test E2E nuovo `relationship_os_e2e.py` con scenario reale Martinel
- ✅ Zero hardcoded enum: tutto da catalog API

---

## 13 · DOMANDE APERTE PER L'UTENTE

Per chiudere la classificazione `FOUNDATION_READY`, servono **5 decisioni**
che richiedono parere strategico, non implementativo:

1. 🔵 **Modello multi-contatto canonical**:
   - (a) Nuova `tenant_contacts` (proposta sopra)
   - (b) Estendere `studio_team_members` esistente
   - (c) Adottare `contacts`+`accounts` riconciliando con `tenants`
2. 🔵 **`accounts` / `contacts` legacy**: drop, deprecate-only, o mantenere come API surface diversa?
3. 🔵 **Notification storage canonical**:
   - (a) `relationship_notifications` (proposta, già ricca)
   - (b) `notifications` (più generica, va estesa)
4. 🔵 **Founder può modificare i propri contatti dal Blueprint?**
   - (a) Sì, scope tenant-self (proposto)
   - (b) Solo read-only; modifiche via advisor
5. 🔵 **Eventi email nel timeline**: includere sempre, o filtrare per template_key (es. solo `studio_request_*` e non `magic_link`)?

> Fino a queste 5 risposte non parte M0. Sono decisioni da 30 minuti
> insieme. Tutte le altre scelte (UX, naming, micro-API) le prendiamo
> in implementazione.

---

## 14 · COSA NON FACCIAMO (esplicitamente FUORI SCOPE)

- ❌ AI matching / suggerimenti automatici
- ❌ Launch Pack / Health Score
- ❌ Analytics dashboard
- ❌ Material Intelligence
- ❌ Nuove integrazioni (Resend OK, no Twilio/Slack/Hubspot)
- ❌ Migrazione dati legacy da `contacts`/`accounts` (sono vuoti)
- ❌ Mobile-first redesign del Command Center

---

## 15 · VERDETTO

🟡 **`NEEDS_ARCHITECTURE_WORK`** — 3 giorni di consolidamento (M0)
indispensabili prima di poter dichiarare `FOUNDATION_READY`.

Le 5 decisioni del §13 sbloccano M0. Una volta sciolte, l'intero
Relationship OS™ MVP è realizzabile in ~22 giorni-uomo distribuiti
su 6 milestone (M0–M5) chiaramente indipendenti e testabili una alla
volta.

---

*Generato il 2 Giu 2026 da E1 (Emergent), su istruzione utente
"P1 — RELATIONSHIP OS FOUNDATION™".*
*Nessuna migration eseguita. Nessuna feature implementata. Solo progettazione.*
