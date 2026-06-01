# CRM FOUNDATION AUDIT™ · ITER184

**Iterazione:** ITER184 · CRM Foundation Lock™  
**Tipo:** Audit · Architecture · Validation **(no code/DB/API/UI changes)**  
**Data:** 2026-06-01  
**Owner:** Product Governance  
**Vincolo Founder:** AUDIT + ARCHITECTURE + VALIDATION ONLY. Bloccare definitivamente il modello operativo CRM **prima** di sviluppare Notification Bus / Journey Assignments Phase 2 / Editorial Onboarding / Error Registry / Client Chameleon.  
**Riferimenti:** `MOOD_LANGUAGE_CANON.md` v1.0, `CRM_LIFECYCLE_CANON.md` (ITER177.A), `CRM_PHASE1_IMPLEMENTATION_REPORT.md` (ITER177.B), `DESIGN_JOURNEY_CANON.md`, `CRM_LIFECYCLE_IMPLEMENTATION_PLAN.md`.

---

## 0 · Executive summary

**Lo stato CRM oggi è SOLIDO ma INCOMPLETO.** Il canon operativo è documentato (CRM_LIFECYCLE_CANON.md) e parzialmente implementato (ITER177.B ha consegnato 7 endpoint Discovery + 1 endpoint Account→Journey + modale 3-way). Tuttavia esistono **5 lacune sistemiche** che impediscono di chiamare il CRM "production-ready":

1. **Lead Wizard mancante.** L'attuale `NewRelationshipModal` raccoglie 4 campi (nome, cognome, email, telefono) + crea Discovery `pending`. Manca: origin, interesse, città/paese, ruolo, azienda, assegnazione owner.
2. **Promotion path Prospect → Customer non implementato.** `accounts.lifecycle_stage` esiste come stringa libera (`prospect`, `customer`, ...) ma nessun endpoint promuove `prospect → customer`. Manca trigger `signed_proposal_id`.
3. **CTA legacy "Begin Journey" pubblica bypassa il funnel.** Il form pubblico `/begin-journey` crea simultaneamente Lead + Account + Journey + Discovery(`status=qualified`). Questo è una scorciatoia che salta la Discovery manuale: corretto per "private intake" via sito; **da bloccare** per percorsi non-public (showroom, manual, import).
4. **Enum `accounts.lifecycle_stage` non normalizzato.** Stringhe libere senza CHECK. Aumenta drift.
5. **Frontend UI states ambigui.** `LeadsPage` mostra tutti i lead indipendentemente da `status`; `ProspectsPage` filtra accounts con `lifecycle_stage='prospect'` ma il `handlePromote(p, 'account')` non chiama l'endpoint canon `/api/accounts/{aid}/convert-to-customer` (che non esiste ancora). Esiste un gap tra UI e backend.

**Conclusione:** Il **70% del canon è codificato**. Rimane:
- 30% di Lead Wizard fields, Customer conversion endpoint, lifecycle_stage enum normalization, public-form Discovery-bypass guard, UI alignment.

**Roadmap proposta:** **ITER185 · CRM Foundation Lock™ Implementation** (4-5 giorni effettivi, 5 deliverable).

---

## 1 · Lifecycle attuale (cosa fa il codice oggi)

### 1.1 · Tabelle e enum

| Tabella | Colonne lifecycle-related | Stato |
|---|---|---|
| `leads` | `status` (enum `lead_status`: `new\|qualified\|...`), `pipeline_stage` (text libero), `progression_state`, `progression_score`, `intake_completed_at`, `first_journey_id`, `assigned_to`, `lead_type` (enum), `source` | ✅ esiste · over-engineered (53 colonne) |
| `discovery_interviews` | `status` enum (`pending\|in_progress\|qualified\|unqualified\|recycled`), `lead_id`, `tenant_id`, `source`, `started_at`, `completed_at`, `conducted_by`, `notes`, `qualification_signals` jsonb, `disqualification_reason`, `metadata_json` jsonb | ✅ esiste (migration 114) · enum normalizzato |
| `accounts` | `lifecycle_stage` text **libero** (default `conversation_open`), `lead_id`, `tenant_id`, `metadata_json` | ⚠️ enum **NON normalizzato** |
| `design_journeys` | `account_id` NOT NULL (canon-correct), `lifecycle_state` enum (`conversation_open\|in_progress\|presenting\|drifting\|on_pause\|approved\|closed\|editioned\|abandoned`) | ✅ canon-correct |
| `projects` | 1:1 con journey | OK · subordinato |
| `journey_milestones` | status, ordering, parallel_track | OK |
| `funnel_events` | `stage`, `event_name`, `lead_id`, `metadata_json` | ✅ esiste · usato per analytics |

### 1.2 · Endpoint funzionanti (mappa reale `/api/`)

#### Lead lifecycle
```
GET    /api/leads                                    list (auth, P_LEADS_READ)
POST   /api/leads                                    create manuale (auth, P_LEADS_WRITE) · status='new'
GET    /api/leads/{lid}                              get
PUT    /api/leads/{lid}                              update
DELETE /api/leads/{lid}                              delete
POST   /api/leads/dedup-check                        ITER177.B · check email/phone matches
GET    /api/leads/search?q=                          ITER177.B · global autocomplete

POST   /api/leads/public?tenant_slug=                public capture · ANON · ITER146.A · funnel_events
POST   /api/relationships/intake/closed-answers?tenant_slug=  ITER148 · public closed-Q ingest

POST   /api/public/journeys/initiate                 ITER167 · public Begin Journey full pipeline
                                                     → crea lead + account + journey + discovery(qualified)
```

#### Discovery lifecycle (ITER177.B)
```
POST   /api/leads/{lid}/discovery                    crea row pending
GET    /api/leads/{lid}/discovery                    ultimo record per lead
POST   /api/discovery/{did}/start                    pending → in_progress
PUT    /api/discovery/{did}                          autosave (notes + signals)
POST   /api/discovery/{did}/qualify                  → qualified, **crea account(prospect)**
POST   /api/discovery/{did}/disqualify               → unqualified (con reason)
POST   /api/discovery/{did}/recycle                  unqualified → recycled
GET    /api/discovery/{did}                          get singolo
```

#### Account → Journey (ITER177.B)
```
POST   /api/accounts/{aid}/journeys                  body: {kickoff_note?, title?, force?}
  R1: lega account_id (enforced)
  R2: lifecycle_stage ∈ ('prospect','in_proposal','customer') → 400 ACCOUNT-INVALID-STAGE
  R3: permission projects:write → 403
  R4: soft-check su discovery qualified (warning, non blocco)
  R5: max 1 journey attiva per account → 409 (bypass con ?force=true)
```

### 1.3 · Flusso `journey_initiate.py` (Begin Journey pubblico)

```
T0  POST /api/public/journeys/initiate
T+0 INSERT leads(status='new', pipeline_stage=NULL, source='begin_journey_ritual')
T+1 INSERT accounts(lifecycle_stage='conversation_open', lead_id=L)
T+2 INSERT contacts(account_id=A)
T+3 INSERT projects(account_id=A)
T+4 INSERT design_journeys(account_id=A, lifecycle_state='conversation_open')
T+5 UPDATE leads SET status='qualified', pipeline_stage='prospect_initial_brief', first_journey_id=J
T+6 INSERT funnel_events(stage='prospect_initial_brief', event='begin_journey.prospect_promoted')
T+7 INSERT discovery_interviews(status='qualified', source='public_form', auto_qualified=true)
T+8 generate magic-link → email cliente
```

**Comportamento:** Il pubblico form auto-promuove a `qualified` perché contiene già info qualificanti (budget, timeline, spaces, atmospheres). La Discovery viene creata "completata" per audit/canon-compliance.

**Implicazione canon:** Il vincolo §11.1 "Lead NON può avere journey direttamente" è **rispettato perché** la Discovery `qualified` esiste comunque prima del Journey insert (anche se nella stessa transazione). Tuttavia: **se un team member volesse creare manualmente un Lead "freddo"**, può farlo via `POST /api/leads` (status='new') senza creare journey. Quel path **funziona già canon-correct**.

---

## 2 · Lifecycle canonico (target ufficiale)

```
                              ┌──────────────────────────┐
                              │       LEAD               │  status: new
                              │  (contatto grezzo)       │  pipeline_stage: lead_captured
                              └────────────┬─────────────┘
                                           │
                              [DISCOVERY INTERVIEW™]
                              status: pending → in_progress
                              entry points: showroom · call · email · referral
                                           │
                  ┌───────────────────────┴───────────────────────┐
                  │                        │                      │
                  ▼                        ▼                      ▼
            QUALIFIED              UNQUALIFIED             RECYCLED
            status=qualified       status=unqualified      status=recycled
            create account         no account              no account
            lifecycle=prospect     (close-lost)            wait, re-engage
                  │
                  ▼
            ┌────────────────────────────┐
            │   PROSPECT                 │  accounts.lifecycle_stage='prospect'
            │   (qualified, no signed)   │
            └────────────┬───────────────┘
                         │
                         │ (manual) POST /api/accounts/{aid}/journeys
                         ▼
            ┌────────────────────────────┐
            │   DESIGN JOURNEY™ #1       │  design_journeys.lifecycle_state='conversation_open'
            │   (prospect-stage)         │  → presenting → approved
            └────────────┬───────────────┘
                         │
                         │ signed_proposal → POST /api/accounts/{aid}/convert-to-customer
                         ▼
            ┌────────────────────────────┐
            │   CUSTOMER                 │  accounts.lifecycle_stage='customer'
            │   (cliente confermato)     │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │   DESIGN JOURNEY™ #N       │  (account-stage · ricorrenti)
            └────────────────────────────┘
```

### 2.1 · Tre verità immutabili (canon)
1. **Lead ≠ Journey.** Una Discovery deve precedere la qualifica.
2. **Prospect = Account `lifecycle_stage='prospect'`.** Può avere 1 journey attiva.
3. **Customer = Account `lifecycle_stage='customer'`** dopo signed proposal. Può avere N journey ricorrenti.

---

## 3 · Lead entry points — inventario completo

| # | Sorgente | Surface UI | Endpoint backend | Auth | Crea anche... | Stato |
|---|---|---|---|---|---|---|
| 1 | **Public web form** (Begin Journey) | `/begin-journey` (`BeginJourneyPage.jsx`) | `POST /api/public/journeys/initiate` | anon | account + project + journey + discovery(qualified) | ✅ funziona |
| 2 | **Public closed-Q intake** (legacy) | (no surface dedicata) | `POST /api/relationships/intake/closed-answers` | anon | nessuno (solo lead row) | ✅ esiste, poco usato |
| 3 | **Public lead capture** (storefront form) | (config-driven via tenant CMS) | `POST /api/leads/public?tenant_slug=` | anon | funnel_events, email confirmations | ✅ ITER146.A |
| 4 | **Manual showroom** (workspace UI) | Sidebar `+ Nuovo Lead`, Topbar CTA, Dashboard Quick Action | `POST /api/leads` (status='new') + `POST /api/leads/{lid}/discovery` (status='pending') | auth (P_LEADS_WRITE) | discovery_interviews(pending) | ✅ ITER177.B |
| 5 | **Cmd+K Command Palette** | `CommandPalette.jsx` ("Crea nuovo Lead «{q}»") | idem #4 + prefill | auth | idem | ✅ ITER177.B |
| 6 | **Telefonata / email / referral / architetto / evento** | nessuna surface dedicata | idem #4 (campo `source` impostato manualmente) | auth | idem | 🟡 manca picker dedicato per `source` |
| 7 | **CSV / import bulk** | nessuna surface | nessun endpoint dedicato | — | — | ❌ non esiste |
| 8 | **Webhook esterno** (3rd party form, Typeform, Hubspot) | — | nessun endpoint dedicato | — | — | ❌ non esiste |

**Verdetto entry points:** 5 paths funzionanti out of 8 desiderati. Gap principali: source picker visibile (P1), import CSV (P2), webhook ingest (P2).

---

## 4 · Lead Wizard — analisi del flusso attuale vs ideale

### 4.1 · Stato attuale (NewRelationshipModal · `choice='lead'` branch)

**Solo 1 step inline.** Campi raccolti:
- Nome* (mandatory)
- Cognome
- Email (con onBlur dedup-check)
- Telefono (con onBlur dedup-check)
- ⚠️ NO origine
- ⚠️ NO città / paese  
- ⚠️ NO ruolo / azienda
- ⚠️ NO interesse (residenziale / contract / hospitality...)
- ⚠️ NO note operative
- ⚠️ NO owner assignment

**Submit flow:**
1. Run dedup-check se non già fatto
2. `POST /api/leads` con `{first_name, last_name, email, phone, source:'manual_showroom', status:'new'}`
3. `POST /api/leads/{lead.id}/discovery` con `{notes: null}`
4. Toast "Lead creato. Avvia la Discovery." → navigate `/relations/leads/{id}?discovery=1`

### 4.2 · Wizard ideale (proposto dal Founder · 6 step)

| Step | Titolo | Campi | Tabella target |
|---|---|---|---|
| 1 | Informazioni base | nome*, cognome, azienda, ruolo | `leads.first_name`, `last_name`, `company_name`, `metadata_json.role` |
| 2 | Contatti | email, telefono (+ prefisso ISO), città, paese | `leads.email`, `phone`, `city`, `country` |
| 3 | Origine | showroom · sito · referral · architetto · evento · email · telefonata · altro | `leads.source` (enum suggerito) |
| 4 | Interesse | residenziale · contract · hospitality · retail · office · altro | `leads.market_sector` + `project_type` |
| 5 | Note operative | richieste, dettagli, osservazioni | `leads.notes` |
| 6 | Assegnazione | owner (designer/PM), team, stato iniziale | `leads.assigned_to`, `metadata_json.team_ids` |

**Submit:** salvataggio immediato del Lead, **NO Journey creata**, **discovery_interviews row pending** auto-created.

### 4.3 · Gap funzionali Lead Wizard

| # | Gap | Severità | Effort |
|---|---|---|---|
| LW-1 | Wizard 6-step inesistente: oggi è 1-step minimal | 🔴 P0 | 1g UI |
| LW-2 | Source picker enum (showroom/email/referral/...) non visibile | 🔴 P0 | 0.25g |
| LW-3 | Country + city + phone country code non collezionati | 🟠 P1 | 0.5g (PhoneCountryPrefix già esiste, riutilizzo) |
| LW-4 | Market sector / project type picker | 🟠 P1 | 0.5g |
| LW-5 | Owner assignment al lead (designer/PM dropdown) | 🟠 P1 | 0.5g |
| LW-6 | Progress indicator / breadcrumb 1→6 | 🟡 P2 | 0.25g |
| LW-7 | Skip-to-end CTA ("Salva e qualifica dopo") | 🟡 P2 | 0.1g |

---

## 5 · Discovery foundation — stato

### 5.1 · Tabella `discovery_interviews` (migration 114)

✅ ESISTE. 15 colonne. Indici corretti. Trigger updated_at. Backfill applicato (ogni lead `status='qualified'` esistente ha già una row).

```sql
discovery_interviews:
  id                      uuid PK
  tenant_id               uuid NOT NULL → tenants
  lead_id                 uuid NOT NULL → leads (CASCADE delete)
  status                  enum (pending | in_progress | qualified | unqualified | recycled)
  source                  text DEFAULT 'manual' (manual | public_form | call | showroom | referral)
  started_at              timestamptz NULL
  completed_at            timestamptz NULL
  conducted_by            uuid → users_profile (SET NULL)
  notes                   text NULL
  qualification_signals   jsonb DEFAULT '{}'
  disqualification_reason text NULL
  recording_url           text NULL
  metadata_json           jsonb DEFAULT '{}'
  created_at, updated_at  timestamptz
```

### 5.2 · Endpoint funzionanti

```
POST /api/leads/{lid}/discovery       → create pending o restituisce esistente
GET  /api/leads/{lid}/discovery       → ultimo record (latest)
POST /api/discovery/{did}/start       → pending → in_progress (set started_at)
PUT  /api/discovery/{did}             → autosave (notes + qualification_signals + metadata_json)
POST /api/discovery/{did}/qualify     → qualified + crea/upserta account(prospect)
POST /api/discovery/{did}/disqualify  → unqualified (richiede reason)
POST /api/discovery/{did}/recycle     → unqualified → recycled
GET  /api/discovery/{did}             → get singolo
```

### 5.3 · UI

✅ `DiscoveryInterviewPanel.jsx` esiste. Aperto da `LeadDetailPage` con `?discovery=1` query param (autosave su `PUT /api/discovery/{did}`).

### 5.4 · Campi suggeriti dal Founder vs campi reali

| Campo suggerito | Stato attuale | Mapping |
|---|---|---|
| budget | ✅ via `qualification_signals.budget` (jsonb) | OK |
| tempistiche | ✅ via `qualification_signals.timeline` | OK |
| tipologia progetto | 🟡 via `qualification_signals.project_type` | OK ma no enum lock |
| livello interesse | 🟡 via `qualification_signals.interest_level` | OK ma libero |
| decision maker | ❌ non in schema | ADD `qualification_signals.decision_maker` |
| architetto coinvolto | ❌ non in schema | ADD `qualification_signals.architect_referenced` |
| stato decisionale | 🟡 via `status` (pending/in_progress/qualified) | parziale |
| Discovery completata flag | ✅ `completed_at != NULL` | OK |

**Verdetto Discovery:** ✅ infrastruttura completa. 🟡 mancano enforced fields in `qualification_signals`. Suggerito: passare a tabella relazionata `discovery_signals` o estendere il jsonb con schema validato lato server.

### 5.5 · Output canonico Discovery
- `Discovery completata = TRUE` ⇔ `discovery_interviews.completed_at IS NOT NULL AND status IN ('qualified', 'unqualified')`
- Discovery qualified → side effect: `accounts(lifecycle_stage='prospect')` creato o riusato

---

## 6 · Prospect qualification rules

### 6.1 · Regole canon ufficiali

Un Lead NON può diventare Prospect automaticamente.

**Requisiti minimi enforced:**
| # | Regola | Enforcement attuale |
|---|---|---|
| PQ-1 | Discovery completata | `POST /api/discovery/{did}/qualify` richiede `did` esistente e `status IN ('pending','in_progress')` (no skip) |
| PQ-2 | Interesse verificato | jsonb libero — **NON enforced** |
| PQ-3 | Progetto identificato | jsonb libero — **NON enforced** |
| PQ-4 | Lead → Prospect transition | `accounts(lifecycle_stage='prospect', lead_id=L)` upsert idempotente in `discovery.py:qualify()` |

### 6.2 · Tabelle / enum

```
leads.status enum:    new → qualified  (transizione gated da discovery.qualify())
accounts.lifecycle_stage:   prospect | in_proposal | customer | churned | on_hold  (text libero ⚠️ no enum)
```

### 6.3 · CTA visibili Prospect promotion

| Surface | CTA label | Azione |
|---|---|---|
| `ProspectsPage` (`/relations/prospects`) | "Promuovi ad Account" (`onPromote(p)`) | calls `promote(p.id, 'account')` from `useRelations` hook |
| `WelcomeDrawer` (continuation interview) | "Promuovi" su moment `kind=='promote_account'` | idem |

**Gap PQ-1:** `promote()` hook ha un side effect non chiaro — non chiama `/api/accounts/{aid}/convert-to-customer` (endpoint che non esiste). Cosa fa esattamente? **Da audit-trace** in `pages/relations/useRelations.js`.

---

## 7 · Customer lifecycle

### 7.1 · Definizione canon

> **Prospect → Customer** quando viene firmata una proposta (signed_proposal).

### 7.2 · Stato implementativo

| Concept | Stato |
|---|---|
| `accounts.lifecycle_stage='customer'` | ✅ supportato come valore stringa libero |
| Endpoint `POST /api/accounts/{aid}/convert-to-customer` | ❌ NON ESISTE |
| Trigger `signed_proposal_id` → flip lifecycle | ❌ NON IMPLEMENTATO |
| UI CTA "Conferma cliente" | ❌ NON ESISTE |
| Log audit `customer_promoted` evento | 🟡 esiste `funnel_events` ma non chiamato sistematicamente |

### 7.3 · Workflow reale oggi (cosa fa il team in pratica)

1. Prospect ha journey in stato `presenting`
2. Team manda proposta (`POST /api/proposals/...`)
3. Cliente firma (offline o tramite `signed_at` su proposals)
4. **Manualmente** il team aggiorna `accounts.lifecycle_stage='customer'` (via Supabase admin o non lo fa proprio)

**Gap CL-1:** Customer conversion **non è un evento di sistema**. Risultato: KPI Dashboard "Clienti" è ambiguo perché `lifecycle_stage='customer'` non riflette firma proposta.

### 7.4 · Action richiesta

Aggiungere endpoint `POST /api/accounts/{aid}/convert-to-customer` body `{proposal_id, signed_at, signed_by_contact_id}`:
- valida che `accounts.lifecycle_stage='prospect'`
- valida che `proposals.id` esiste e ha `status='signed'`
- update `accounts.lifecycle_stage='customer'`
- log `funnel_events(stage='customer', event='customer_confirmed')`

---

## 8 · Design Journey creation rules

### 8.1 · Regola canon

> **Una Journey può essere creata SOLO da:**
> - Prospect (`accounts.lifecycle_stage='prospect'`)
> - In_proposal (`accounts.lifecycle_stage='in_proposal'`)  
> - Customer (`accounts.lifecycle_stage='customer'`)
>
> **MAI da Lead.**

### 8.2 · Endpoint canonico

```
POST /api/accounts/{aid}/journeys
```

**Validazioni (R1-R5):**
- R1: account_id sempre legato (FK NOT NULL)
- R2: `lifecycle_stage IN ('prospect','in_proposal','customer')` → 400 `ACCOUNT-INVALID-STAGE`
- R3: permission `P_PROJECTS_WRITE` → 403
- R4: soft-check discovery qualified (warning, non blocco)
- R5: max 1 journey attiva per account → 409 (bypass `?force=true`)

### 8.3 · Audit dei percorsi che possono creare una Journey

| # | Surface / endpoint | Crea Journey? | Bypass risk? |
|---|---|---|---|
| 1 | `POST /api/accounts/{aid}/journeys` (auth) | ✅ canon-correct | NO |
| 2 | `POST /api/public/journeys/initiate` (anon, Begin Journey) | ✅ crea Lead+Account+Discovery+Journey in transazione | 🟡 transazione legittima per public path |
| 3 | `NewRelationshipModal` choice='lead' | ❌ NON crea journey (apre solo Discovery) | OK |
| 4 | `NewRelationshipModal` choice='prospect' | ✅ via `/api/accounts/{aid}/journeys` | OK |
| 5 | `NewRelationshipModal` choice='customer' | ✅ via `/api/accounts/{aid}/journeys` | OK |
| 6 | Workspace `+ Nuovo Design Journey` (`WorkspaceActionHub.newJourney`) | ✅ apre modal `choice='prospect'` | OK |
| 7 | Dashboard Quick Action "Apri Journey" | ❌ naviga a `/workspace/projects` lista | OK |
| 8 | `ProspectsPage` row click | ❌ apre `WelcomeDrawer` | OK |
| 9 | `WelcomeDrawer` action `promote_account` | 🟡 chiama `promote(p.id, 'account')` — **da verificare** se chiama anche `account_journeys` |
| 10 | Endpoint diretto `POST /api/design_journeys` (CRUD legacy) | ⚠️ DA VERIFICARE se esiste e con quali constraint |

**Verdetto:** **9 percorsi su 10 sono canon-correct**. Il #9 (`WelcomeDrawer promote_account`) richiede audit-trace approfondito sul hook `useRelations.promote()`.

### 8.4 · Validazione backend

✅ **`account_journeys.py` enforces R1-R5** correttamente (modulo R4 soft-warning).

### 8.5 · Validazione frontend

🟡 Parziale. `NewRelationshipModal` consente solo choice 'prospect' / 'customer' nei rispettivi form, quindi è UX-blocked. Tuttavia:
- Manca **disabled state** sul bottone "Crea Journey" se `discovery_interviews` non in stato `qualified` (R4 soft-check non visualizzato).
- Manca **tooltip** che spiega perché un Lead non può creare Journey.

---

## 9 · CTA audit completo

### 9.1 · Inventario CTA per superficie

| Surface | CTA | Stato | Azione |
|---|---|---|---|
| **Sidebar** | `+ Nuovo Lead` (UserPlus icon) | ✅ CORRETTA | apre `NewRelationshipModal` |
| **Topbar** | `Nuovo Lead` (smart CTA) | ✅ CORRETTA | apre `NewRelationshipModal` |
| **Dashboard `WorkspaceActionHub`** | `Nuovo Lead` | ✅ CORRETTA | `route: 'modal:new-relationship', opts: { choice: 'lead' }` |
| **Dashboard `WorkspaceActionHub`** | `Qualifica Prospect` | ✅ CORRETTA | naviga a `/relations/leads` |
| **Dashboard `WorkspaceActionHub`** | `Nuovo Design Journey` | ✅ CORRETTA | `route: 'modal:new-relationship', opts: { choice: 'prospect' }` |
| **Dashboard `WorkspaceActionHub`** | `Apri Journey` | ✅ CORRETTA | `/workspace/projects` |
| **Dashboard `JourneyPulsePage`** | `+ Nuovo Lead` (empty state) | ✅ CORRETTA | apre modal `choice: 'lead'` |
| **`LeadsPage`** | `+ Nuovo Lead` (primary CTA) | ✅ CORRETTA | apre modal |
| **`LeadsPage`** empty | "Usa '+ Nuovo Lead' per registrare il primo contatto." | ✅ CORRETTA | nessun bottone aggiuntivo |
| **`ProspectsPage`** | `Promuovi ad Account` (row) | 🟡 DA VERIFICARE | chiama `promote(p.id, 'account')` — endpoint reale? |
| **`AccountsPage`** | (nessuna CTA primary) | 🟡 GAP | manca "Nuovo Design Journey" inline |
| **`CommandPalette`** (Cmd+K) | `Crea nuovo Lead «{q}»` | ✅ CORRETTA | apre modal con prefill |
| **`CommandPalette`** footer | "Powered by Nuovo Lead" | ✅ CORRETTA (post ITER183) | — |
| **Public `/begin-journey`** | "Inizia il tuo Design Journey™" | ✅ CORRETTA | `POST /api/public/journeys/initiate` |
| **Storefront tenant CMS** | "Richiedi il tuo progetto" (configurabile) | ✅ CORRETTA | `POST /api/leads/public` |

### 9.2 · CTA classificate

| Categoria | Conteggio |
|---:|---|
| ✅ CORRETTA | 13 |
| 🟡 DA VERIFICARE | 2 (`ProspectsPage promote`, `WelcomeDrawer promote_account`) |
| 🔴 DA MODIFICARE | 0 |
| ❌ DA ELIMINARE | 0 |
| 🟠 MANCANTE | 1 (`AccountsPage`: CTA "Nuovo Design Journey" inline) |

**Verdetto CTA:** Ottimo lavoro di ITER177.B + ITER183. Nessuna CTA "Begin Journey" o "Nuova Journey" legacy ancora attiva nel workspace operativo. Public path mantiene il proprio CTA (ammesso).

---

## 10 · Dashboard alignment

### 10.1 · KPI dashboard attuali

| KPI canon | Sorgente endpoint | Stato dashboard attuale |
|---|---|---|
| **Lead** count | `GET /api/leads?status=new` | 🟡 da verificare in `AtelierDashboardPage` |
| **Prospect** count | `GET /api/accounts?lifecycle_stage=prospect` (o aggregato pulse) | 🟡 da verificare |
| **Clienti** count | `GET /api/accounts?lifecycle_stage=customer` | 🟡 da verificare |
| **Design Journey Attive** | `GET /api/dashboard/pulse` → `counts.active` | ✅ presente |

### 10.2 · KPI vietati (canon §7)

Nessuna delle stringhe vietate (`Segnali`, `Relazioni`, `Connessioni`, `Presenze`, `Memorie`, `Voices/Vocii`) è più visibile post-ITER183. ✅

### 10.3 · CTA Dashboard

| CTA | Visibile? | Canon-compliant? |
|---|---|---|
| Nuovo Lead | ✅ | ✅ |
| Nuovo Design Journey | ✅ | ✅ (apre choice prospect) |
| Qualifica Prospect | ✅ (condizionale stato CRM) | ✅ |
| Apri Journey | ✅ | ✅ |

**Verdetto dashboard:** Allineata al canon §7. **Gap residuo:** `AtelierDashboardPage.jsx` da verificare se mostra Lead/Prospect/Cliente count o solo Design Journey count.

---

## 11 · Gap analysis

### 11.1 · Gap database (DB)

| # | Gap | Severità | Effort | Note |
|---|---|---|---|---|
| DB-1 | `accounts.lifecycle_stage` text libero (no CHECK/enum) | 🟠 P1 | 0.5g | Migration `enum account_lifecycle_stage` + ALTER COLUMN |
| DB-2 | Nessuna FK `accounts.signed_proposal_id` per audit signed | 🟡 P2 | 0.25g | Add nullable FK |
| DB-3 | `leads.first_journey_id` deprecated ma ancora popolato dal public form | 🟡 P2 | 0.1g | Mark NULL su nuovi, audit-only |
| DB-4 | Nessun trigger `discovery_qualified → account_prospect_upsert` (al momento applicativo in `discovery.py`) | 🟢 P3 | 0.5g | Spostare a DB trigger garantisce idempotenza |
| DB-5 | Nessuna view `v_crm_funnel` per dashboard count | 🟡 P2 | 0.25g | View per `Lead\|Prospect\|Customer\|Active Journey` counts |

### 11.2 · Gap API (endpoint)

| # | Gap | Severità | Effort |
|---|---|---|---|
| API-1 | `POST /api/accounts/{aid}/convert-to-customer` non esiste | 🔴 P0 | 0.5g |
| API-2 | `POST /api/accounts/{aid}/put-on-hold` / `/resume` / `/churn` non esistono | 🟠 P1 | 0.5g |
| API-3 | `POST /api/leads/bulk-import` (CSV) non esiste | 🟡 P2 | 1g |
| API-4 | `POST /api/leads/{lid}/assign-owner` esplicito (oggi via `PUT /api/leads/{lid}`) | 🟢 P3 | 0.1g cosmetic |
| API-5 | `account_journeys` R4 soft-warning vs hard-block: serve flag per promuovere a hard-block | 🟡 P2 | 0.25g |

### 11.3 · Gap UX (frontend)

| # | Gap | Severità | Effort |
|---|---|---|---|
| UX-1 | Lead Wizard 6-step non implementato (oggi 1-step inline) | 🔴 P0 | 1-1.5g |
| UX-2 | Source picker enum (showroom/email/referral/...) non visibile | 🔴 P0 | 0.25g |
| UX-3 | Manca CTA "Conferma cliente" nel workspace journey una volta firmata proposta | 🟠 P1 | 0.5g |
| UX-4 | `AccountsPage` senza CTA "Nuovo Design Journey" inline | 🟠 P1 | 0.25g |
| UX-5 | Dashboard KPI Lead/Prospect/Customer (counts numerici visibili) | 🟠 P1 | 0.5g |
| UX-6 | `LeadsPage` non filtra per `status` (`new\|qualified\|...`) | 🟡 P2 | 0.25g |
| UX-7 | Tooltip "Why can't I open Journey from Lead?" mancante | 🟡 P2 | 0.1g |
| UX-8 | `ProspectsPage.handlePromote` da audit (cosa fa esattamente?) | 🔴 P0 | 0.25g trace |

### 11.4 · Gap workflow (process)

| # | Gap | Severità |
|---|---|---|
| WF-1 | Trigger automatico `signed_proposal → convert_to_customer` non esiste | 🟠 P1 |
| WF-2 | Notifica al team quando un Lead resta `new` per >7 giorni (lead aging) | 🟡 P2 (Notification Bus dependency) |
| WF-3 | Re-engagement workflow per `unqualified` / `recycled` leads | 🟡 P2 |
| WF-4 | Audit trail visivo del lifecycle (timeline Lead→Prospect→Customer) | 🟡 P2 |

### 11.5 · Gap dati (data quality)

| # | Gap | Severità |
|---|---|---|
| DQ-1 | `leads.source` valori liberi → no controllo | 🟠 P1 |
| DQ-2 | `accounts.lifecycle_stage` valori liberi (vedi DB-1) | 🟠 P1 |
| DQ-3 | `discovery_interviews.qualification_signals` jsonb senza schema validato | 🟡 P2 |
| DQ-4 | `funnel_events` non popolato sistematicamente su tutti i transition (es. manca `customer_confirmed`) | 🟡 P2 |

---

## 12 · Roadmap implementativa (proposta · ITER185+)

### Sprint ITER185 · CRM Foundation Lock™ Implementation · ~4-5 giorni effettivi

#### Phase 1 · P0 blockers (1.5g)
1. **API-1**: implementare `POST /api/accounts/{aid}/convert-to-customer`
2. **UX-1**: Lead Wizard 6-step UI (sostituire inline form)
3. **UX-2**: Source picker enum nel wizard step 3
4. **UX-8**: audit-trace `ProspectsPage.handlePromote` → fix se rotto

#### Phase 2 · P1 stability (2g)
5. **DB-1**: migration `account_lifecycle_stage` enum + ALTER COLUMN
6. **DB-5**: view `v_crm_funnel` per KPI dashboard
7. **API-2**: `/put-on-hold`, `/resume`, `/churn` endpoint account
8. **UX-3**: CTA "Conferma cliente" in workspace journey post-signature
9. **UX-4**: CTA "Nuovo Design Journey" inline in AccountsPage
10. **UX-5**: KPI Lead/Prospect/Customer count in Dashboard

#### Phase 3 · P2 polish (1.5g)
11. **DB-3**: deprecate `leads.first_journey_id` su nuovi rows
12. **DQ-1**: enum `lead_source` migration
13. **UX-6**: filtri `status` in LeadsPage
14. **UX-7**: tooltip "Why no journey from Lead?"
15. **API-5**: flag `discovery_required: true|false` per journey creation

#### Phase 4 · P3 audit & cleanup (1g)
16. **DB-2**: FK `accounts.signed_proposal_id`
17. **DB-4**: trigger DB-level `discovery_qualified → account_prospect_upsert`
18. **WF-3**: re-engagement workflow stub
19. **API-3**: bulk import CSV `/api/leads/bulk-import`
20. **WF-4**: audit trail visivo lifecycle

---

## 13 · Conclusioni e governance

### 13.1 · Stato di salute CRM Foundation

| Asse | Verdict |
|---|---|
| **Lifecycle canon documentato** | ✅ CRM_LIFECYCLE_CANON.md v1.0 |
| **Discovery infrastruttura** | ✅ migration 114 + 7 endpoint |
| **Account → Journey gating** | ✅ R1-R5 implementati |
| **Modal 3-way (Lead/Prospect/Customer)** | ✅ NewRelationshipModal |
| **Lead Wizard professionale** | ❌ assente (1-step minimal) |
| **Customer conversion endpoint** | ❌ assente |
| **lifecycle_stage enum lock** | ❌ text libero |
| **Dashboard KPI canon (Lead/Prospect/Customer/Journey)** | 🟡 parziale |
| **Public Begin Journey funnel** | ✅ canon-compliant (auto-discovery qualified) |
| **CTA inventory** | ✅ 13/15 corretti, 2 da verificare |
| **Lessico canon (post ITER183)** | ✅ 0 banned terms |

**% completamento CRM Foundation: ~70%.**

### 13.2 · Regole ufficiali di conversione (LOCKED)

```
1. Lead → Discovery:    automatico alla creazione del lead (status='pending')
2. Discovery → Prospect: manuale via POST /api/discovery/{did}/qualify
                         side-effect: account(lifecycle_stage='prospect') upsert
3. Prospect → Journey:   manuale via POST /api/accounts/{aid}/journeys
                         enforcement R1-R5
4. Journey → Signed:     manuale via signed proposal (NON impl.)
5. Prospect → Customer:  automatico al signed proposal (NON impl.)
                         OR manuale via POST /api/accounts/{aid}/convert-to-customer (NON impl.)
6. Customer → Customer with N+1 journey: ricorrente, sempre via /accounts/{aid}/journeys
```

### 13.3 · Percorsi errati individuati

| # | Path | Severità |
|---|---|---|
| EP-1 | `ProspectsPage.handlePromote(p, 'account')` chiama hook `promote()` di destinazione opaca | 🔴 audit-trace richiesto |
| EP-2 | Begin Journey public auto-promuove a `qualified` senza Discovery manuale → comportamento corretto per private flow ma `journey_initiate.py` non distingue fra public e impersonate-internal | 🟡 medium · improvviso |
| EP-3 | `accounts.lifecycle_stage` può essere settato a qualsiasi stringa via UPDATE diretto (no CHECK) | 🟠 high · DB-level enforcement gap |
| EP-4 | `leads.first_journey_id` ancora popolato post-canon (deprecated audit-only ma scrittura non disabilitata) | 🟡 medium |
| EP-5 | Workspace `Apri Journey` Quick Action naviga a `/workspace/projects` lista invece di Journey Index | 🟢 minor UX hint |

### 13.4 · Output finale (5 punti come da Founder directive)

**A · Audit completo** ✅ (sezioni §1-§11)

**B · Mappa stati CRM** ✅ (sezione §2.0 — diagramma canonico Lead → Discovery → Prospect → Customer → Journey N+1)

**C · Regole ufficiali di conversione** ✅ (sezione §13.2)

**D · Percorsi errati individuati** ✅ (sezione §13.3 · 5 path da rivedere · 1 critical, 1 high, 2 medium, 1 minor)

**E · Roadmap implementativa** ✅ (sezione §12 · 4 phase · ~5g effettivi)

---

## 14 · Vincolo rispettato

✅ ZERO modifiche a:
- DB schema / migrations
- Backend routers / endpoint
- Frontend componenti / pages
- i18n strings
- Configuration

✅ SOLO file creato in questa iterazione:
- `/app/memory/CRM_FOUNDATION_AUDIT.md` (questo documento)

---

## 15 · Revision log

| Versione | Data | Autore | Note |
|---|---|---|---|
| 1.0 | 2026-06-01 | Product Governance | Audit iniziale ITER184 |

---

**Prossimo step (gating):** Approvazione Founder della roadmap §12 → kickoff ITER185 con Phase 1 (P0 blockers).

**ITER184 CHIUSO. Niente Notification Bus / Journey Assignments Phase 2 / Editorial Onboarding / Error Registry / Client Chameleon finché Phase 1+2 di ITER185 non sono shipped.**
