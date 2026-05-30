# MOOD Advisor Mini CRM™ — Design Proposal (May 30, 2026)

**Status**: DESIGN PHASE — Nessun codice scritto. Aspetta approvazione utente prima di implementare.

**Scope**: modulo interno al **Command Center MOOD** (NON in Blueprint tenant). Pipeline commerciale + attribution per gli Advisor.

---

## 1. AUDIT — Tabelle esistenti riutilizzabili

| Tabella | Stato | Riusabile? | Note |
|---|---|---|---|
| `advisor_profiles` (17 col, 3 rows) | ✅ pronta | **SÌ** | già contiene `advisor_code`, `commission_percentage`, `default_discount`, `market_specialization`, `relationship_tags`. È il "registro advisor" canonico. |
| `advisor_followups` (11 col, 0 rows) | ⚠️ schema esistente | **SÌ con adattamento** | oggi vincolata a `relation_id` (post-conversion). Va sloggata per accettare anche `lead_id` (pre-conversion). |
| `advisor_notes` (7 col, 0 rows) | ⚠️ schema esistente | **PARZIALE** | oggi è scoped per `tenant_id`. Per il Mini-CRM serve `lead_id`-scope. |
| `advisor_territories` (19 col, 0 rows) | ✅ pronta | NO per ora | non rilevante per Mini-CRM (è solo dati geografici). |
| `advisor_commission_rules` (10 col, 0 rows) | ✅ pronta | NO per ora | esplicitamente fuori scope (Chunk 5 futuro). |
| `leads` (48 col, 9 rows) | ❌ NON usare | **NO** | è la tabella **lead del Blueprint tenant** (B2C: prospect-cliente del singolo studio). Mini-CRM advisor è B2B (studio-prospect di MOOD). Confusione semantica. |
| `lead_assignments` (8 col) | ❌ | **NO** | scoped tenant-level, non MOOD-level. |
| `studio_requests` (29 col, 8 rows) | ✅ pronta | **SÌ** | è già il "submit point" del funnel `/studio`. Va estesa con 3-4 colonne attribution. |
| `studio_activation_drafts` (13 col, 30 rows) | ✅ pronta | **SÌ** | è il draft-state lato corporate. Va estesa con `attribution_token_id`. |
| `studio_relations` | ✅ pronta | **SÌ** | post-conversion. Già linkata a `owner_advisor_id`. |

**Conclusione audit**: il 70% dell'impianto esiste già. Servono **2 nuove tabelle** (advisor leads + activation tokens), **1 estensione** di `studio_requests`, **1 estensione** di `advisor_followups`, **1 nuova tabella** opzionale per attività dettagliate.

---

## 2. PROPOSTA SCHEMA DB

Naming: tutte le tabelle del Mini-CRM advisor MOOD-level usano il prefisso `advisor_*` per chiarire la scope rispetto a `leads` (tenant-level B2C). I dati vivono **tutti sul tenant `studio`** (corporate MOOD), non sui tenant clienti.

### 2.1 Nuova: `advisor_leads`

```sql
CREATE TABLE advisor_leads (
  -- Identity
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_id               UUID NOT NULL REFERENCES advisor_profiles(id) ON DELETE RESTRICT,
  advisor_user_id          UUID NOT NULL REFERENCES users(id),  -- denormalized for scoping queries
  reference_code           TEXT UNIQUE NOT NULL,                -- e.g. "LEAD-A1B2C3" for UI display

  -- Studio identity (the prospect)
  company_name             TEXT NOT NULL,
  contact_name             TEXT,
  contact_email            TEXT,
  contact_phone            TEXT,
  website                  TEXT,
  city                     TEXT,
  country                  TEXT,                                 -- ISO 3166-1 alpha-2
  business_type            TEXT,                                 -- e.g. "showroom" | "studio" | "atelier" | "retailer" | ...

  -- Pipeline state
  status                   TEXT NOT NULL DEFAULT 'lead'
                           CHECK (status IN ('lead','contacted','meeting_scheduled','demo_completed',
                                             'application_started','application_submitted',
                                             'approved','activated','lost')),
  temperature              TEXT NOT NULL DEFAULT 'cold'
                           CHECK (temperature IN ('cold','warm','hot','ready')),
  source                   TEXT,                                 -- e.g. "event:fuori-salone-2026" | "intro:cliente_x" | "cold_outreach"

  -- Workflow signals
  next_follow_up_at        TIMESTAMPTZ,
  last_activity_at         TIMESTAMPTZ,
  notes                    TEXT,                                 -- free text by advisor (private)

  -- Lifecycle linkage (filled when prospect converts)
  studio_request_id        UUID REFERENCES studio_requests(id) ON DELETE SET NULL,
  studio_relation_id       UUID REFERENCES studio_relations(id) ON DELETE SET NULL,
  lost_reason              TEXT,
  lost_at                  TIMESTAMPTZ,

  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_advisor_leads_advisor ON advisor_leads (advisor_id, status);
CREATE INDEX idx_advisor_leads_followup ON advisor_leads (advisor_id, next_follow_up_at)
  WHERE next_follow_up_at IS NOT NULL;
CREATE INDEX idx_advisor_leads_request ON advisor_leads (studio_request_id);
```

Note di design:
- **`advisor_user_id` denormalizzato** per consentire scoping rapido nei `WHERE advisor_user_id = jwt.user_id` senza JOIN su `advisor_profiles`.
- **`reference_code`** human-readable (es. `LEAD-A1B2C3`) per riferimento UI/email.
- `studio_request_id` resta NULL finché il prospect non submitta l'application via `/studio`.

### 2.2 Nuova: `advisor_lead_activities`

```sql
CREATE TABLE advisor_lead_activities (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id                  UUID NOT NULL REFERENCES advisor_leads(id) ON DELETE CASCADE,
  advisor_id               UUID NOT NULL REFERENCES advisor_profiles(id),
  advisor_user_id          UUID NOT NULL REFERENCES users(id),

  activity_type            TEXT NOT NULL
                           CHECK (activity_type IN ('phone_call','showroom_visit','video_call',
                                                    'email','event','follow_up','demo','proposal','note')),
  activity_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes                    TEXT,
  outcome                  TEXT,                                 -- short summary
  next_action              TEXT,
  next_follow_up_at        TIMESTAMPTZ,                          -- if set, also updates lead.next_follow_up_at via service

  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lead_activities_lead ON advisor_lead_activities (lead_id, activity_date DESC);
CREATE INDEX idx_lead_activities_advisor ON advisor_lead_activities (advisor_id, activity_date DESC);
```

Note: `activity_type='note'` esiste come fallback per "appunto generico" senza dover dipendere da `advisor_notes` (che era table-scope diversa, lasciata legacy).

### 2.3 Nuova: `advisor_activation_tokens`

```sql
CREATE TABLE advisor_activation_tokens (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_id               UUID NOT NULL REFERENCES advisor_profiles(id),
  advisor_user_id          UUID NOT NULL REFERENCES users(id),
  lead_id                  UUID REFERENCES advisor_leads(id) ON DELETE CASCADE,
                           -- nullable: l'advisor può creare un "link generico"
                           -- non legato a un lead specifico (es. da inviare a un
                           -- evento). Quando il prospect submitta l'application,
                           -- creiamo automaticamente un advisor_lead "back-filled".

  token                    TEXT UNIQUE NOT NULL,                 -- random 32-char URL-safe; usato in URL
  token_hash               TEXT,                                 -- opzionale: hash per validazione costante-tempo (per ora plain token va bene)
  label                    TEXT,                                 -- "Margraf Stoccarda fair 2026" — human label

  -- Lifecycle
  status                   TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','used','revoked','expired')),
  expires_at               TIMESTAMPTZ,                          -- nullable = never expires
  used_at                  TIMESTAMPTZ,                          -- set when first studio_request is created via this token
  used_count               INTEGER DEFAULT 0,                    -- number of times token has produced a draft (multiple drafts allowed pre-submit)
  revoked_at               TIMESTAMPTZ,
  revoked_reason           TEXT,

  -- Audit
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_advisor_tokens_advisor ON advisor_activation_tokens (advisor_id, status);
CREATE INDEX idx_advisor_tokens_lead ON advisor_activation_tokens (lead_id);
CREATE UNIQUE INDEX idx_advisor_tokens_token ON advisor_activation_tokens (token);
```

Design choice critical:
- **Token type**: stringa URL-safe `secrets.token_urlsafe(24)` → 32 char (~192 bit di entropia). Non indovinabile.
- **`lead_id` nullable** per supportare "link generico" (link da QR code per evento).
- **`used_count` vs `status`**: il token può generare più draft (l'utente può abbandonare e riprendere), ma quando arriva la prima `studio_request` SUBMITTED il token va in stato `used` (oppure resta `active` se vuoi consentire più application — decisione di policy, di default `used`).

### 2.4 Estensione: `studio_requests` (4 colonne nuove)

```sql
ALTER TABLE studio_requests ADD COLUMN attribution_token_id    UUID REFERENCES advisor_activation_tokens(id);
ALTER TABLE studio_requests ADD COLUMN attribution_advisor_id  UUID REFERENCES advisor_profiles(id);
ALTER TABLE studio_requests ADD COLUMN attribution_advisor_user_id UUID REFERENCES users(id);
ALTER TABLE studio_requests ADD COLUMN attribution_lead_id     UUID REFERENCES advisor_leads(id);
```

Note:
- **Non sovrascriviamo `assigned_advisor_id`**. Manteniamo la distinzione:
  - `attribution_advisor_id` = chi ha portato il prospect (immutabile, attribuzione storica)
  - `assigned_advisor_id` = chi gestisce la relation oggi (può cambiare)
- Quando una request arriva via token, **entrambi i campi vengono pre-popolati** con lo stesso advisor; il Super Admin può poi cambiare `assigned_advisor_id` lasciando intatta l'attribution storica per il calcolo commissioni.

### 2.5 Estensione: `studio_activation_drafts` (1 colonna nuova)

```sql
ALTER TABLE studio_activation_drafts ADD COLUMN attribution_token_id UUID REFERENCES advisor_activation_tokens(id);
```

Quando il prospect arriva su `/studio/start/{token}`, creiamo un draft con `attribution_token_id` settato. Al submit, viene passato a `studio_requests`.

### 2.6 NON modifichiamo

- `advisor_profiles`: già ok.
- `advisor_followups`: lasciata legacy (relation-scoped). Le follow-up pre-conversion vivono in `advisor_lead_activities`.
- `leads` (Blueprint tenant-level): zero modifiche. È un universo separato.

---

## 3. PROPOSTA ROUTE API

Namespace: **`/api/mood/advisor-crm/*`** (in linea con la direttiva precedente che riserva `/api/admin/*` al legacy e `/api/mood/*` ai nuovi feature MOOD-level).

### Per ADVISOR (scope: own only)

| Method | Path | Scope guard | Note |
|---|---|---|---|
| `GET`    | `/api/mood/advisor-crm/leads` | `require_advisor_scope` → WHERE advisor_user_id = jwt.user_id | Lista paginata, filtri: status, temperature, has_followup_today |
| `POST`   | `/api/mood/advisor-crm/leads` | own | Crea lead. `advisor_id` derivato dal JWT, mai dal body |
| `GET`    | `/api/mood/advisor-crm/leads/{id}` | own | Detail con activities |
| `PATCH`  | `/api/mood/advisor-crm/leads/{id}` | own | Update status/temperature/notes/next_follow_up |
| `DELETE` | `/api/mood/advisor-crm/leads/{id}` | own | Soft-delete? Decisione: hard delete consentito **solo se status='lead'** e nessuna activity registrata. Altrimenti status='lost' |
| `POST`   | `/api/mood/advisor-crm/leads/{id}/activities` | own | Registra attività |
| `GET`    | `/api/mood/advisor-crm/leads/{id}/activities` | own | Lista cronologica |
| `POST`   | `/api/mood/advisor-crm/leads/{id}/activation-token` | own | Genera link attivazione → returns `{url, expires_at, label}` |
| `POST`   | `/api/mood/advisor-crm/activation-tokens` | own | Crea link "generico" (lead_id null) |
| `GET`    | `/api/mood/advisor-crm/activation-tokens` | own | Lista propri token attivi/usati |
| `DELETE` | `/api/mood/advisor-crm/activation-tokens/{id}` | own | Revoca (status='revoked') |
| `GET`    | `/api/mood/advisor-crm/pipeline-summary` | own | KPI dell'advisor: count per status, follow-up scaduti, conversion rate |

### Per SUPER ADMIN (scope: tutti gli advisor)

| Method | Path | Scope guard | Note |
|---|---|---|---|
| `GET`    | `/api/mood/advisor-crm/admin/pipeline` | `require_admin_tenant` | Vista globale: pipeline cross-advisor |
| `GET`    | `/api/mood/advisor-crm/admin/advisors/{advisor_id}/leads` | admin only | Lead di uno specifico advisor |
| `GET`    | `/api/mood/advisor-crm/admin/attribution-report` | admin only | Per period range: conversion rate per advisor, application generated, tenant activated |

### Pubblico (no auth)

| Method | Path | Note |
|---|---|---|
| `GET`    | `/api/studio/activation-token/{token}` | Valida il token (status='active', non scaduto). Returns `{ok, advisor_code, lead_id?}` per microcopy |
| `POST`   | `/api/studio/draft/from-token` | Crea draft con `attribution_token_id` pre-popolato |

Vincoli sicurezza endpoint:
1. **Zero scrittura di `attribution_*` da frontend**: il client passa solo `token` (URL param), il server risolve internamente l'advisor.
2. **Rate limiting** su `POST /activation-tokens` (max 20 token/giorno/advisor) per evitare token-spam.
3. **Rate limiting** su `GET /studio/activation-token/{token}` (max 60/min/IP) per evitare brute-force enumerazione.

---

## 4. UI MAP COMMAND CENTER

### Sidebar Advisor (cambio rispetto a oggi)

Oggi gli advisor vedono solo:
- Advisor Console
- Studio Requests

Diventa:
```
ADVISOR
├── Dashboard           (KPI personali — esistente Advisor Console)
├── My Leads            ★ NEW — Mini CRM
│   ├── List
│   ├── Detail
│   └── Activation Links
├── Studio Requests     (esistente — request assegnate)
└── Relations           (esistente — tenant attivati da me)
```

### Sidebar Super Admin (1 voce nuova)

```
MOOD CORE
├── Overview
├── Advisors            (esistente)
├── Advisor Pipeline    ★ NEW — vista globale Mini-CRM
├── Studio Requests     (esistente)
├── Relations           (esistente)
└── …                   (resto invariato)
```

### Pagine

| Path | Componente | Descrizione UI |
|---|---|---|
| `/command-center/my-leads` | `MyLeadsList.jsx` | Tabella + filtri (status/temperature/today's follow-ups). Riga = card editorial con company, status badge teal/amber, prossima azione, CTA "Open" |
| `/command-center/my-leads/{id}` | `LeadDetail.jsx` | Header lead + timeline attività + form quick-add activity + sezione Activation Links + side panel "Convert to..." |
| `/command-center/my-leads/{id}/activate` | inline modal | "Genera link" con label + scadenza opzionale → mostra URL + copy-to-clipboard |
| `/command-center/advisor-pipeline` | `AdvisorPipelineAdmin.jsx` | Solo Super Admin: griglia advisor × status, drill-down per advisor |

### Microcopy `/studio` (per prospect arrivato da link advisor)

Nel funnel `/studio`, in fondo all'header o vicino al CTA "Attiva Blueprint™":
```
Percorso introdotto da un Advisor MOOD.
```
Nessun nome, nessun codice. Solo segnale di "guided journey". Decisione di policy: il prospect non sa chi è il suo advisor finché non viene attivato il tenant.

---

## 5. FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ FLOW 1 — Advisor registra un lead manualmente                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  Advisor in /command-center/my-leads                                                │
│     │                                                                               │
│     ▼                                                                               │
│  Click "+ Nuovo Lead"                                                               │
│     │                                                                               │
│     ▼                                                                               │
│  Compila form: company_name, contact, source, notes, temperature                    │
│     │                                                                               │
│     ▼                                                                               │
│  POST /api/mood/advisor-crm/leads                                                   │
│     └─ INSERT advisor_leads (advisor_id from JWT, status='lead', temperature='cold')│
│     └─ Returns {id, reference_code: 'LEAD-A1B2C3'}                                  │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│ FLOW 2 — Advisor genera un link di attivazione per un lead esistente               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  Advisor in /command-center/my-leads/{lead_id}                                      │
│     │                                                                               │
│     ▼                                                                               │
│  Click "Genera link di attivazione"                                                 │
│     │                                                                               │
│     ▼                                                                               │
│  Modal: label opzionale + scadenza opzionale (default: 30 giorni)                   │
│     │                                                                               │
│     ▼                                                                               │
│  POST /api/mood/advisor-crm/leads/{id}/activation-token                             │
│     └─ INSERT advisor_activation_tokens (token = secrets.token_urlsafe(24))         │
│     └─ Returns {url: '/studio/start/{token}', label, expires_at}                    │
│                                                                                     │
│  UI mostra il link copiabile + QR code generato client-side                         │
│  Advisor invia il link via email/WhatsApp/QR al prospect                           │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│ FLOW 3 — Prospect clicca il link e completa la Studio Application                  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  Prospect riceve link e clicca                                                      │
│     │                                                                               │
│     ▼                                                                               │
│  GET /studio/start/{token}                                                          │
│     └─ Frontend route: StudioActivationStart.jsx                                    │
│     │  1. GET /api/studio/activation-token/{token}                                  │
│     │     ├─ token valido + active + not_expired → ok, microcopy "Percorso         │
│     │     │  introdotto da un Advisor MOOD" appare                                  │
│     │     └─ token invalido/scaduto/revocato → redirect a /studio (normale flow)    │
│     │  2. Memorizza token in sessionStorage (NON localStorage — privacy)            │
│     │  3. Redirect a /studio (entrance movement)                                    │
│     ▼                                                                               │
│  Prospect compila il funnel /studio normalmente                                     │
│     │                                                                               │
│     ▼                                                                               │
│  POST /api/studio/draft (lazy create)                                               │
│     └─ Backend legge sessionStorage token via header X-Advisor-Token                │
│     └─ INSERT studio_activation_drafts (attribution_token_id = resolved)            │
│     │                                                                               │
│     ▼                                                                               │
│  Prospect submitta la application                                                   │
│     │                                                                               │
│     ▼                                                                               │
│  POST /api/studio/submit                                                            │
│     └─ INSERT studio_requests (                                                     │
│          attribution_token_id     = draft.attribution_token_id,                    │
│          attribution_advisor_id   = (lookup from token),                            │
│          attribution_advisor_user_id = ...,                                         │
│          attribution_lead_id      = token.lead_id,                                  │
│          assigned_advisor_id      = (same as attribution by default)                │
│        )                                                                            │
│     └─ UPDATE advisor_activation_tokens                                             │
│          SET status='used', used_at=NOW(), used_count = used_count + 1              │
│     └─ UPDATE advisor_leads                                                         │
│          SET status='application_submitted',                                        │
│              studio_request_id = new_request.id                                     │
│          WHERE id = token.lead_id                                                   │
│     └─ Trigger advisor email notification (Resend): "Hai una nuova application"     │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│ FLOW 4 — Advisor vede la request arrivata                                          │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  Advisor in /command-center/studio-requests                                         │
│     └─ Filtro automatico: assigned_advisor_id = me OR attribution_advisor_id = me   │
│     └─ La nuova request appare con badge "Da tuo lead: LEAD-A1B2C3"                 │
│                                                                                     │
│  Click su request → drill-down a request detail + link al lead di origine          │
│                                                                                     │
│  Da qui in poi: flow tenant lifecycle esistente                                     │
│     (Convert to Relation → Open Studio Ecosystem → Founder Invitation)              │
│                                                                                     │
│  Quando viene attivato il tenant:                                                   │
│     └─ UPDATE advisor_leads SET status='activated', studio_relation_id=...          │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. SECURITY NOTES

| Vector | Mitigation |
|---|---|
| **Advisor cerca di vedere lead di altri advisor** | Ogni endpoint usa `require_advisor_scope` + filtro `WHERE advisor_user_id = jwt.user_id`. Mai trust del body request. |
| **Advisor genera token per un altro advisor** | `advisor_id` su `advisor_activation_tokens` derivato **sempre** dal JWT del chiamante. Body request ignorato. |
| **Prospect manomette URL** (`?advisor=ADV-XXX`) | Non usiamo querystring `?advisor=...`. Usiamo SOLO `/studio/start/{token}` con token random. |
| **Brute-force enumeration di token** | Rate limiting (60 req/min/IP su `/api/studio/activation-token/{token}`). Token `secrets.token_urlsafe(24)` = 192-bit entropy → enumerazione computazionalmente non fattibile. |
| **Token leak via referrer/log** | Token vive in path (HTTPS only, no querystring) + memorizzato in sessionStorage (non localStorage). Backend non logga token raw, solo hash sha256 nei log strutturati. |
| **Token scoperto post-fatto** | Endpoint `DELETE /activation-tokens/{id}` per revoca immediata. Status='revoked' è check in tutti i validation path. |
| **Advisor disattivato continua a generare token** | Check `advisor_profiles.status='active'` su ogni `POST /activation-tokens`. |
| **Attribution post-attivazione manipolata** | `attribution_*` su `studio_requests` sono **immutabili** dopo l'INSERT. Endpoint admin per cambio attribution emette audit log + restrictive guard. |
| **Esposizione dati advisor al prospect** | Microcopy generica "Percorso introdotto da un Advisor MOOD". Nessun nome, codice, email advisor reso visibile lato prospect. |
| **Lead orfani** se advisor cancellato | `advisor_leads.advisor_id` ha `ON DELETE RESTRICT`. Cancellazione advisor richiede pre-reassignment dei lead (procedura admin). |
| **Token shareato/forwardato** (es. prospect inoltra il link a un concorrente) | Accettato come limite di design. Mitigation soft: token `expires_at` di default 30 giorni; advisor può revocare manualmente. Per V2: possibile aggiungere `max_uses=1` se necessario. |

---

## 7. PIANO IMPLEMENTATIVO A CHUNK

Sequenza testabile, ciascun chunk autonomo. Aspetto OK utente prima di iniziare.

### CHUNK A — Schema DB + scoping helper (mezza giornata)
- Migration SQL: 3 nuove tabelle (`advisor_leads`, `advisor_lead_activities`, `advisor_activation_tokens`) + 5 colonne nuove (4 su `studio_requests`, 1 su `studio_activation_drafts`)
- Service helper: `services/advisor_crm_scope.py` con `assert_advisor_owns_lead()`, `resolve_advisor_from_token()`, generatore reference_code univoco
- Smoke test: insert/select su tabelle nuove, check FK + check constraints
- ⚠️ Nessuna UI ancora.

### CHUNK B — API Advisor + scoping (1 giorno)
- Router `routers/advisor_crm.py` con tutti gli endpoint scope `own`
- Test cURL: lead CRUD + activities + token generation/list/revoke + scoping cross-advisor (Stef non vede lead Raffaella)
- ⚠️ Nessuna UI ancora.

### CHUNK C — UI My Leads (1.5 giorni)
- `admin/pages/MyLeadsList.jsx` (lista + filtri + create new)
- `admin/pages/LeadDetail.jsx` (header + timeline + quick activity + activation link panel)
- Sidebar: aggiunta voci "My Leads" nella `ADVISOR_NAV` di `CommandCenterApp`
- Test E2E Playwright: Raffaella crea lead → registra attività → genera token

### CHUNK D — Integrazione `/studio` con token (1 giorno)
- Frontend: nuova route `/studio/start/:token` (`StudioActivationStart.jsx`) → valida → store sessionStorage → redirect `/studio`
- Modifica `useStudioManifest` / draft creation per leggere token e passarlo al backend
- Backend: estensione `POST /api/studio/draft` e `POST /api/studio/submit` per accettare e propagare `attribution_token_id`
- Microcopy "Percorso introdotto da un Advisor MOOD" condizionale
- Test E2E reale: Raffaella genera token → io apro link in incognito → completo funnel → check DB ha tutti `attribution_*` popolati

### CHUNK E — Backfill quando arriva la request (mezza giornata)
- Logic in `POST /api/studio/submit`:
  - Se `attribution_lead_id IS NOT NULL` → UPDATE advisor_leads.status='application_submitted', studio_request_id=...
  - Se `attribution_lead_id IS NULL` (link generico) → CREA `advisor_leads` row back-filled con dati dalla request
- Email notification advisor: "Hai una nuova application da [lead/link generico]"

### CHUNK F — Vista Super Admin Pipeline (1 giorno)
- `admin/pages/AdvisorPipelineAdmin.jsx`: griglia advisor × status, conversion rate, drill-down
- Router `routers/advisor_crm.py` endpoint admin-only `/admin/pipeline`, `/admin/attribution-report`
- Sidebar: voce "Advisor Pipeline" su `ADMIN_NAV` Super Admin

### CHUNK G — Polish + edge cases (1 giorno)
- Pagina vuota states (Raffaella senza lead vede "Inizia con il tuo primo lead")
- Lost reason picker
- Revoke token confirmation modal
- Filtri avanzati (range date, source, country)
- Test regression Tenant Lifecycle: assicurarsi che il flow esistente Margraf USA (senza token advisor) continui a funzionare

### Totale stimato: ~6-7 giorni di lavoro

---

## 8. DECISIONI APERTE — Servono risposte tue prima di Chunk A

1. **Token policy**: il prospect può aprire più draft con lo stesso token (es. abbandona → riprende) ma alla **prima submit** il token diventa `used` e non si può più aprire un secondo `/studio/start/{token}`. È ok? Alternativa: token riusabile finché advisor non lo revoca esplicitamente.

2. **Lead deletion**: hard-delete consentito solo se `status='lead'` e zero activities? Oppure soft-delete sempre con flag `deleted_at`?

3. **Link generici** (lead_id null): sono utili? Es. l'advisor stampa un QR per il Fuori Salone, distribuisce a chiunque, e ogni submit crea automaticamente un nuovo `advisor_leads` back-filled. Vuoi questa feature o "ogni token deve essere legato a un lead noto"?

4. **Microcopy**: "Percorso introdotto da un Advisor MOOD" — ok il testo? Lingua: solo IT o anche EN/FR/DE/ES?

5. **Email notification advisor** alla submit della request: contenuto + canale (la stessa pipeline Resend `no-reply@mail.moodfordesign.com`) — confermato pattern unico mittente.

6. **Naming UI**: "My Leads" o preferisci IT "I miei lead"? Tutto il Command Center è bilingue (l'utente è MOOD-internal). Default: italiano per coerenza con `/command-center/advisors`, `/relations`, ecc.

7. **Ordine di chunk**: ti vanno bene A→B→C→D→E→F→G in sequenza, oppure preferisci splittare a metà (A+B+C per avere subito Mini-CRM operativo "manuale", poi D+E+F+G per attribution automatica)?

---

## ✋ Aspetto

Risposta a queste 7 decisioni + OK generale prima di toccare codice.
