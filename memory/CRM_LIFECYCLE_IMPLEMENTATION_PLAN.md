# CRM LIFECYCLE IMPLEMENTATION PLAN™
## Da architettura a codice: il piano operativo per portare il CRM al modello canonico

> **Status:** 📋 IMPLEMENTATION PLAN · ITER176.B · 31 May 2026
> **Pre-condizione documentale:** `CRM_LIFECYCLE_CANON.md`, `DESIGN_JOURNEY_CANON.md` (con §18 Real World Showroom Flow), `JOURNEY_ASSIGNMENTS_ARCHITECTURE.md`
> **Scope:** definire **cosa, come, in che ordine** implementare il CRM Lifecycle Canon. Nessun codice in questo doc — solo piano.
> **Approvazione necessaria del Founder** prima dell'inizio implementazione.

---

## §0 · Executive summary

Il sistema oggi:
- Crea **Lead + Account + Journey** simultaneamente solo dal form pubblico (Begin Journey ritual)
- Non ha endpoint manuali per creare Lead da showroom walk-in
- Non ha **Discovery Interview** come step esplicito
- Non ha modale `+ Nuova Relazione` (3-way: Nuovo Lead, Prospect esistente, Customer esistente)
- Permette `lifecycle_stage` come stringa libera invece di enum normalizzato
- Crea Journey **troppo presto** (rompendo il principio §17.1 del Design Journey Canon)

Il sistema target:
- Lead può vivere senza Journey (grezzo) finché Discovery non lo qualifica
- Discovery Interview è una **tabella** con stati propri (`pending → in_progress → qualified | unqualified | recycled`)
- Prospect = `accounts.lifecycle_stage='prospect'` + Lead origin con `lead.status='qualified'`
- Modale `+ Nuova Relazione` è il **solo** ingresso operativo per aprire Lead/Journey manualmente
- Form pubblico crea esplicitamente `discovery_interviews(status='qualified', source='public_form')`
- Multi-journey block + auto-qualified badge + dedup nudge sono enforced UI/applicativi

**Stima totale effort:** ~7–9 giorni full-stack (DB + backend + frontend + test).

---

## §1 · PHASE 1 · Nuova Relazione™ (Frontend + Backend modal infrastructure)

### 1.1 · Goal
Sostituire il bottone "Nuova Journey" diretto con un CTA `+ Nuova Relazione` che apre una modale a 3 scelte.

### 1.2 · Sub-tasks

#### Sub-task 1.A · Backend endpoint base (NON ancora attivi sulla canon completa)

| Endpoint | Verb | Scope | Body | Ritorna |
|---|---|---|---|---|
| `/api/leads` | POST | `lead:create` | `{first_name, last_name, email?, phone?, source?, lead_type?, referrer_partner_id?, metadata_json?}` | `{lead_id, status='new'}` |
| `/api/leads/{lid}` | GET | `lead:read` | — | `lead row + discovery_interviews summary` |
| `/api/leads/search` | GET | `lead:read` | query: `q`, `status`, `tenant_id` | lista paginata |
| `/api/leads/dedup-check` | POST | `lead:create` | `{email?, phone?, first_name?, last_name?}` | `{matches: [{lead_id, score, reasons[]}]}` |
| `/api/accounts/{aid}/journeys` | POST | `journey:create` | `{kickoff_note?, atmosphere_preset?}` | `{journey_id, state='opened'}` (richiede `account.lifecycle_stage IN ('prospect','customer')`) |

Tutti gli endpoint:
- Richiedono `tenant_id` da auth context.
- Audit row in `journey_lifecycle_events` (per journey) o `lead_events` (per lead — nuova tabella audit-only se serve).
- Rate-limit lato applicativo (P1, segue ITER175 hotfix backlog).

#### Sub-task 1.B · Frontend modale `+ Nuova Relazione`

**Componente:** `src/components/relations/NewRelationshipModal.jsx`

**Comportamento decisionale:**
- **Choice A · Nuovo Lead** → form a 4 campi (nome obbligatorio, email/phone almeno uno) → al submit chiama `POST /api/leads/dedup-check` → se score >80%, mostra "Forse è già esistente, vuoi riaprire?" con CTA dedicate. Altrimenti `POST /api/leads` → navigate a `LeadDetailPage` con Discovery panel inline aperto.
- **Choice B · Prospect esistente** → autocomplete `accounts WHERE lifecycle_stage='prospect'` (filtro tenant) → al submit chiama `POST /api/accounts/{aid}/journeys` → navigate a `JourneyWorkspacePage`.
- **Choice C · Cliente esistente** → autocomplete `accounts WHERE lifecycle_stage='customer'` → **se account ha journey attiva** mostra warning "Hai già una journey in stato X. Vuoi mettere in `on_hold` la corrente, creare un account collegato, o annullare?" → al submit (se conferma) chiama `POST /api/accounts/{aid}/journeys` → navigate.

**Surface placement:**
- Sidebar primary (top, sotto logo).
- `/dashboard` Quick Actions card.
- `/relations` topbar.
- Cmd+K palette (action: "Crea Nuova Relazione").

**Test ID convention:** `data-testid="new-relationship-modal-trigger"`, `new-relationship-choice-lead`, `new-relationship-choice-prospect`, `new-relationship-choice-customer`, `new-relationship-submit`, `new-relationship-dedup-warning`.

#### Sub-task 1.C · Disabilita le surface oggi sbagliate
- Rimuovere/nascondere ogni CTA "Nuova Journey" diretto su `LeadsPage`, `LeadDetailPage`, `AccountDetailPage`.
- Bloccare `POST /api/accounts/{aid}/journeys` se `account.lifecycle_stage NOT IN ('prospect','customer','in_proposal')`.

### 1.3 · Acceptance criteria Phase 1
- ✅ Da `/dashboard`, click su `+ Nuova Relazione` apre modale.
- ✅ Choice A crea Lead `status='new'` + apre Discovery panel inline.
- ✅ Choice B/C creano Journey solo se account ha lifecycle_stage valido.
- ✅ Dedup-check funziona con fuzzy match (email exact, phone exact, name `pg_trgm`).
- ✅ Test e2e su Playwright copre i 3 path.

### 1.4 · Effort stimato Phase 1: **2 giorni** (1g backend + 1g frontend).

---

## §2 · PHASE 2 · Discovery Interview™ (tabella + endpoints + UI inline)

### 2.1 · Goal
Rendere la Discovery un'entità di prima classe, con stato proprio, audit, e UI inline.

### 2.2 · DB migration

```sql
-- /app/supabase/migrations/114_discovery_interviews.sql
CREATE TYPE discovery_status AS ENUM (
  'pending', 'in_progress', 'qualified', 'unqualified', 'recycled'
);

CREATE TABLE discovery_interviews (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id                 uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status                  discovery_status NOT NULL DEFAULT 'pending',
  source                  text NOT NULL DEFAULT 'manual', -- 'manual', 'public_form', 'phone', 'partner'
  started_at              timestamptz,
  completed_at            timestamptz,
  conducted_by            uuid REFERENCES users_profile(id),
  notes                   text,
  qualification_signals   jsonb DEFAULT '{}',
  disqualification_reason text,
  recording_url           text,
  metadata_json           jsonb DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT NOW(),
  updated_at              timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_discovery_lead ON discovery_interviews(lead_id);
CREATE INDEX idx_discovery_tenant_status ON discovery_interviews(tenant_id, status);

-- backfill: ogni lead status='qualified' esistente → discovery row con status='qualified'
INSERT INTO discovery_interviews (tenant_id, lead_id, status, source, completed_at, qualification_signals)
SELECT tenant_id, id, 'qualified', 'public_form', intake_completed_at, '{"backfill": true}'::jsonb
FROM leads WHERE status='qualified';
```

### 2.3 · Endpoints backend

| Verb | Path | Behaviour |
|---|---|---|
| `POST` | `/api/leads/{lid}/discovery` | crea row `status='pending'` (auto-creata anche da `POST /api/leads`) |
| `POST` | `/api/discovery/{did}/start` | `pending → in_progress`, set `started_at`, set `conducted_by` |
| `PUT`  | `/api/discovery/{did}` | aggiorna `notes`, `qualification_signals` (real-time autosave) |
| `POST` | `/api/discovery/{did}/qualify` | `in_progress → qualified`, set `completed_at` + **side effect:** crea `accounts(lifecycle_stage='prospect')` + update `leads.status='qualified'` + emette `discovery_interview.qualified` event |
| `POST` | `/api/discovery/{did}/disqualify` | `in_progress → unqualified` + `leads.status='unqualified'` + audit `disqualification_reason` |
| `POST` | `/api/discovery/{did}/recycle` | `unqualified → recycled` + `leads.status='recycled'` |
| `GET`  | `/api/discovery/{did}` | row + lead summary |

**Vincoli:**
- `qualify()` può essere chiamato solo da utenti con `P_LEAD_QUALIFY` (default: `super_admin`, `tenant_admin`, `project_manager`, `account_director`, `sales`).
- `qualify()` deve essere **idempotente** (re-call non duplica account).
- Side-effect `accounts` create con `account_name = lead.first_name + ' ' + lead.last_name` (o `lead.email` fallback).

### 2.4 · UI inline panel

**Componente:** `src/components/relations/DiscoveryInterviewPanel.jsx`

- Apertura: inline panel su `LeadDetailPage` (drawer da destra, NON full page).
- Sezioni guidate (form editoriale, non business):
  - Budget range (€)
  - Timing target (mesi)
  - Stile/voice (free text + tag picker)
  - Lifestyle signals
  - Voice journal (registrazione audio opzionale, integrazione futura con `voice_journal` esistente)
  - Files upload (planimetrie, references)
- Autosave ogni 5s su `qualification_signals` jsonb.
- CTA finali: `Promote to Prospect` (verde), `Disqualify` (rosso, richiede reason), `Pause / Save Draft`.

**Test ID:** `discovery-panel-*` namespace.

### 2.5 · Acceptance criteria Phase 2
- ✅ Lead può esistere senza journey (status='new', no discovery yet).
- ✅ Discovery `pending → in_progress → qualified` crea automaticamente `accounts(lifecycle_stage='prospect')`.
- ✅ Discovery `unqualified` chiude il lead senza creare prospect.
- ✅ Backfill: tutti i lead `qualified` esistenti hanno discovery row.
- ✅ UI inline funziona senza navigare via.

### 2.6 · Effort stimato Phase 2: **2 giorni** (0.5g migration + 1g backend + 0.5g UI).

---

## §3 · PHASE 3 · Prospect Lifecycle (enum normalizzato + UI)

### 3.1 · Goal
Rendere `accounts.lifecycle_stage` un enum vero, con transizioni controllate.

### 3.2 · DB migration

```sql
-- /app/supabase/migrations/115_account_lifecycle_enum.sql
CREATE TYPE account_lifecycle_stage AS ENUM (
  'conversation_open', -- legacy/default, da deprecare gradualmente
  'prospect',          -- lead qualificato
  'in_proposal',       -- proposta inviata
  'customer',          -- proposta firmata
  'on_hold',           -- pausa
  'churned'            -- chiuso definitivamente
);

-- alter table con backfill
ALTER TABLE accounts
  ALTER COLUMN lifecycle_stage TYPE account_lifecycle_stage
  USING (
    CASE lifecycle_stage
      WHEN 'prospect' THEN 'prospect'::account_lifecycle_stage
      WHEN 'customer' THEN 'customer'::account_lifecycle_stage
      WHEN 'in_proposal' THEN 'in_proposal'::account_lifecycle_stage
      WHEN 'on_hold' THEN 'on_hold'::account_lifecycle_stage
      WHEN 'churned' THEN 'churned'::account_lifecycle_stage
      ELSE 'conversation_open'::account_lifecycle_stage
    END
  );

ALTER TABLE accounts ALTER COLUMN lifecycle_stage SET DEFAULT 'conversation_open';
ALTER TABLE accounts ALTER COLUMN lifecycle_stage SET NOT NULL;
```

### 3.3 · Endpoints

| Verb | Path | Effetto |
|---|---|---|
| `POST` | `/api/accounts/{aid}/promote-to-customer` | `prospect → customer` (richiede `signed_proposal_id`) |
| `POST` | `/api/accounts/{aid}/put-on-hold` | qualsiasi → `on_hold` (con reason) |
| `POST` | `/api/accounts/{aid}/resume` | `on_hold → previous_state` (memorizzato in metadata_json) |
| `POST` | `/api/accounts/{aid}/churn` | `customer → churned` (con reason) |

### 3.4 · Ownership ProspectDetailPage
- Mostrare **referente** (`human_assignments` per quel cliente).
- Mostrare **journey attiva** se esiste (1 sola, regola §4.3 canon).
- CTA "Apri Journey" disabilitato se journey già attiva.
- CTA "Promote to Customer" disponibile solo in stato `in_proposal`.

### 3.5 · Acceptance criteria Phase 3
- ✅ Enum normalizzato funziona su 100% degli account.
- ✅ Promozione Prospect → Customer richiede proposta firmata referenziata.
- ✅ Account su `on_hold` può tornare al previous_state.

### 3.6 · Effort stimato Phase 3: **1.5 giorni** (0.5g migration + 0.5g backend + 0.5g UI).

---

## §4 · PHASE 4 · Journey Creation Rules™ (enforcement)

### 4.1 · Goal canonical
Definire una volta per tutte **chi può aprire una Journey, quando, su quale entità, con quali vincoli**.

### 4.2 · 5 regole canoniche di creazione journey

| # | Regola | Enforcement DB / Backend |
|---|---|---|
| **R1** | Una journey deve sempre essere creata su un `account_id`, mai su `lead_id`. | `design_journeys.account_id NOT NULL` (già OK in DB) |
| **R2** | L'account deve essere `lifecycle_stage IN ('prospect','in_proposal','customer')`. | Check applicativo + raise `ACCOUNT-INVALID-STAGE` (Error Registry) |
| **R3** | Una journey può essere creata SOLO da utenti con permission `P_JOURNEY_CREATE`. | Check su `users_profile.role` lato endpoint |
| **R4** | Una journey può esistere SOLO se l'account ha discovery `qualified` (o è già `customer`). | Sub-query `EXISTS (SELECT 1 FROM discovery_interviews WHERE lead_id IN (lead della account) AND status='qualified')` OR `account.lifecycle_stage='customer'` |
| **R5** | Max 1 journey **attiva** (`lifecycle_state NOT IN ('completed','closed_lost','archived','on_hold')`) per account. | Constraint check applicativo + `JOURNEY-ALREADY-ACTIVE` error |

### 4.3 · Permission `P_JOURNEY_CREATE` granted to (canon §2.2)
- `super_admin`
- `tenant_admin`
- `project_manager`
- `designer`
- `creative_director`
- `account_director`
- `sales` (post-qualifica)

### 4.4 · Origini canoniche di una journey (chi/cosa la crea)

| Origin | Endpoint che la crea | Note |
|---|---|---|
| `manual_modal` | `POST /api/accounts/{aid}/journeys` (chiamato da `NewRelationshipModal` choice B/C) | da Phase 1 |
| `public_form` | `POST /api/public/journeys/initiate` | refactor per emettere anche `discovery_interviews(qualified)` |
| `customer_extension` | `POST /api/accounts/{aid}/journeys` con `extension_of_journey_id` | per Casa Milano + Casa Como pattern |
| `partner_referral` | come `manual_modal` ma con `assignment.contributor_added` (architetto) | da Phase 1 |

Ogni journey nasce con:
- `design_journeys` row
- `design_journey_assignments` (owner = creator) → da `journey_assignments.py` core
- `human_assignments` (se non già presente per quell'account) → referente
- `relationship_threads` (1 thread principale)
- `magic_link_tokens` (1 token client welcome)
- evento `journey.created` (audit)

### 4.5 · Refactor target di `journey_initiate.py`

Aggiunte richieste:
1. Linea ~145: prima di creare il lead/account, eseguire `discovery_interviews(status='qualified', source='public_form')` insert.
2. Validazione applicativa: se Lead esistente con stessa email/phone, dedup nudge (lato frontend) o `lead.metadata_json.duplicate_of=…` (lato backend).
3. Emit event `discovery_interview.qualified` per coerenza con canon §10.
4. Hotfix `_phone_meta or None` → `_phone_meta or {}` (✅ GIÀ APPLICATO IN ITER176.B).

### 4.6 · Acceptance criteria Phase 4
- ✅ Tutti i path di creazione journey passano per le 5 regole R1-R5.
- ✅ Form pubblico crea esplicitamente `discovery_interviews(qualified)`.
- ✅ Tentativo di creare journey su account `lifecycle_stage='conversation_open'` ritorna `400 ACCOUNT-INVALID-STAGE`.
- ✅ Tentativo di seconda journey attiva → `409 JOURNEY-ALREADY-ACTIVE` con suggested action `put_on_hold_or_extension`.

### 4.7 · Effort stimato Phase 4: **1.5 giorni** (1g backend hardening + 0.5g test).

---

## §5 · PHASE 5 · UI Polishing & Real World gaps closure

### 5.1 · Gaps dal §18.10 del Design Journey Canon

| Gap | Phase | Implementation |
|---|---|---|
| Form pubblico no `discovery(qualified)` | Phase 4 | `journey_initiate.py` refactor |
| `POST /api/leads` manuale mancante | Phase 1 | endpoint base |
| Modale `+ Nuova Relazione` | Phase 1 | `NewRelationshipModal.jsx` |
| Dedup nudge | Phase 1.A | `POST /api/leads/dedup-check` |
| Multi-journey block | Phase 4 R5 | applicativo |
| Auto-qualified badge UI | Phase 5 | `<Badge variant="auto-qualified">` su `ProspectDetailPage` + `JourneyCard` |

### 5.2 · Effort stimato Phase 5: **1 giorno**.

---

## §6 · ROADMAP TEMPORALE

| Settimana | Phase | Deliverable | Effort | Validabile da Founder? |
|---|---|---|---|---|
| W1 | Phase 1 (Nuova Relazione) | Modale + endpoint base + UI rimozione vecchie CTA | 2g | ✅ click test |
| W1–W2 | Phase 2 (Discovery) | Migration + endpoint + UI inline panel | 2g | ✅ scenario A end-to-end |
| W2 | Phase 3 (Prospect Lifecycle) | Enum + transizioni + UI | 1.5g | ✅ scenario C/D |
| W2–W3 | Phase 4 (Journey Rules) | Hardening + refactor public form | 1.5g | ✅ tutti gli scenari 18.2-18.7 |
| W3 | Phase 5 (UI polish + gaps) | Badge, nudge, multi-journey UX | 1g | ✅ smoke tests + e2e |

**Totale:** ~8 giorni full-stack su 2.5 settimane (con buffer per testing).

---

## §7 · TEST CASES CANONICI (per testing_agent_v3_fork al termine)

### 7.1 · Backend
- T1: `POST /api/leads` crea row con `status='new'` + auto-create `discovery_interviews(pending)`.
- T2: `POST /api/discovery/{did}/qualify` crea `accounts(prospect)` + update `lead.status='qualified'`.
- T3: `POST /api/accounts/{aid}/journeys` su prospect crea journey + assignments + thread + magic_link.
- T4: `POST /api/accounts/{aid}/journeys` su account `conversation_open` → 400.
- T5: `POST /api/accounts/{aid}/journeys` su account con journey già attiva → 409.
- T6: `POST /api/public/journeys/initiate` crea `discovery_interviews(qualified, source='public_form')`.
- T7: Dedup-check con email exact match → ritorna `[{lead_id, score=1.0, reasons=['email_exact']}]`.

### 7.2 · Frontend (Playwright)
- E1: Walk-in scenario A (Nuovo Lead → Discovery → Qualify → Journey) end-to-end.
- E2: Walk-in scenario C (Prospect esistente → Open Journey) end-to-end.
- E3: Multi-journey block: tentativo di seconda journey su customer → warning modal con 3 opzioni.
- E4: Dedup nudge: inserimento Lead con email esistente → warning surface visibile.

### 7.3 · Test credentials
Usa `/app/memory/test_credentials.md` (admin `admin@moodfordesign.com`).

---

## §8 · OUT OF SCOPE (P1+ backlog, NON questa implementazione)

- Rate-limiting su public endpoints (segue ITER175 issue 2)
- Error Registry completo (DOMAIN-NNN codes) → solo i 2-3 codici minimi nuovi (`ACCOUNT-INVALID-STAGE`, `JOURNEY-ALREADY-ACTIVE`)
- Journey Assignments Phase 2 (UI drawer, team cards client)
- Studio Activation 10-step (Activation Foundation 5-step subset segue, vedi roadmap separata)
- Editorial Onboarding
- Notification Bus

---

## §9 · DEPENDENCIES & RISKS

### 9.1 · Dependencies
- **ITER178 Journey Assignments Phase 1** già completato → ✅ disponibile.
- **ITER177 Team Foundation** già completato → ✅ ruoli enum disponibili.
- **DB Supabase** accessibile con service-role per migration.

### 9.2 · Risk
| Risk | Mitigation |
|---|---|
| Backfill `discovery_interviews` corrompe lead `qualified` esistenti | Dry-run su staging + audit count pre/post |
| Enum migration `account_lifecycle_stage` fallisce su dati legacy | `USING CASE` clause coverage 100% + test su DB clone |
| Frontend refactor rompe `LeadFormPage` esistente | Feature flag `nuova_relazione_v2` + rollback path |
| Public form auto-qualifica genera prospect indesiderati | Auto-qualified badge + Founder demote CTA |

---

## §10 · APPROVAZIONE FOUNDER

Per procedere all'implementazione, il Founder deve confermare esplicitamente:

- [ ] Approvo il modello canonico Lead → Discovery → Prospect → Journey (CRM_LIFECYCLE_CANON §0)
- [ ] Approvo i 5 vincoli di creazione Journey (§4.2 R1-R5)
- [ ] Approvo l'enum `account_lifecycle_stage` (§3.2)
- [ ] Approvo la tabella `discovery_interviews` (§2.2)
- [ ] Approvo la modale `+ Nuova Relazione` come SOLO ingresso manuale (§1.2)
- [ ] Approvo i 6 scenari Real World Showroom Flow (Design Journey Canon §18)
- [ ] Approvo il roadmap di ~8 giorni in 2.5 settimane (§6)
- [ ] Approvo l'out-of-scope (§8): no rate-limit, no Error Registry completo, no Studio Activation 10-step in questo bundle

Solo dopo questo OK → si procede con Phase 1.

---

## §11 · DELIVERABLE FINALI ATTESI

- ✅ Migration `114_discovery_interviews.sql`
- ✅ Migration `115_account_lifecycle_enum.sql`
- ✅ Backend: `routers/leads.py` (CRUD), `routers/discovery.py` (lifecycle), `routers/account_journeys.py` (POST /accounts/{aid}/journeys)
- ✅ Frontend: `NewRelationshipModal.jsx`, `DiscoveryInterviewPanel.jsx`, refactor `LeadDetailPage`, `ProspectDetailPage`, `AccountDetailPage`
- ✅ Test e2e Playwright per i 6 scenari A-F
- ✅ Aggiornamento `CRM_LIFECYCLE_CANON.md` con stato `IMPLEMENTED` + reference ai PR
- ✅ Aggiornamento `DESIGN_JOURNEY_CANON.md` §18 con badge `✅ REGGE` su ogni scenario

---

**Fine documento. In attesa di approvazione Founder.**
