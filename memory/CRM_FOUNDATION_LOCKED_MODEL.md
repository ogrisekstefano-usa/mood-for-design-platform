# CRM FOUNDATION · LOCKED MODEL™

**Iterazione:** ITER185 · Phase 0 · Locked Model First  
**Tipo:** Architecture Lock · Model Definition · Governance binding  
**Data:** 2026-06-01  
**Status:** 🔒 **AWAITING FOUNDER APPROVAL** — once approved becomes the **single source of truth** for CRM, Design Journey, Assignments, Notification Bus, Dashboard KPI, future APIs and migrations  
**Owner:** Product Governance  
**Vincolo Founder:** AUDIT + ARCHITECTURE + MODEL LOCK ONLY · zero code/DB/API/UI changes  
**Riferimenti:** `MOOD_LANGUAGE_CANON.md` v1.0, `CRM_FOUNDATION_AUDIT.md` (ITER184), `CRM_LIFECYCLE_CANON.md` (ITER177.A), `DESIGN_JOURNEY_CANON.md`, `JOURNEY_ASSIGNMENTS_ARCHITECTURE.md`.

---

## 0 · Principio costituzionale

> **Il CRM gestisce la relazione commerciale.**  
> **Il Design Journey gestisce il lavoro operativo.**  
> **Sono due assi paralleli, non una sequenza.**

Una piattaforma CRM-mature riconosce questa separazione:
- **CRM lifecycle** (linear, gated): `Lead → Discovery → Prospect → [Customer]`
- **Design Journey** (container, parallel): aperto da Prospect O da Customer, secondo necessità operativa

Mescolare i due assi è la causa principale di confusione UX, KPI ambigui e endpoint non scalabili.

---

## A · CRM LOCKED MODEL

### A.1 · Diagramma stati definitivo

```
                           ┌──────────────────────┐
                           │       LEAD           │
                           │   (contatto grezzo)  │
                           │   status: new        │
                           └──────────┬───────────┘
                                      │
                                      │ obbligatoria
                                      ▼
                  ┌──────────────────────────────────────┐
                  │     DISCOVERY INTERVIEW™              │
                  │  status: pending → in_progress       │
                  │  progress: 0% → 25% → 50% → 75% → 100% │
                  │  source: showroom · phone · email ·   │
                  │          website · referral · architect │
                  │          · event · import · other     │
                  └──────────────────┬───────────────────┘
                                     │
                ┌────────────────────┼────────────────────┐
                │                    │                    │
                ▼                    ▼                    ▼
       qualified()           disqualify()           recycle()
                │                    │                    │
                │                    ▼                    ▼
                │            UNQUALIFIED            RECYCLED
                │            (close-lost,           (re-engage
                │             reason recorded)      later)
                │
                ▼
        ┌────────────────────────────┐
        │         PROSPECT           │  ◄────────────────┐
        │  account.lifecycle_stage   │                   │
        │  = 'prospect'              │                   │
        └──────┬─────────────────────┘                   │
               │                                          │
               │ optional · NOT REQUIRED                  │
               │ POST /api/accounts/{aid}/convert-to-     │
               │      customer  body:{proposal_id}        │
               ▼                                          │
        ┌────────────────────────────┐                   │
        │        CUSTOMER            │                   │
        │  account.lifecycle_stage   │                   │
        │  = 'customer'              │                   │
        └────────────────────────────┘                   │
               │                                          │
               │                                          │
               └─── (un Customer può tornare ad essere ───┘
                    Prospect su nuovo deal? NO. Vedi §B.5)

         ─────────── PARALLEL CONTAINER ───────────
              (NON è uno stato CRM successivo)

        ┌────────────────────────────────────────────┐
        │           DESIGN JOURNEY™                  │
        │  - aperto su Prospect (Scenario A)         │
        │    OR                                       │
        │  - aperto su Customer (Scenario B)         │
        │  - JOIN: design_journeys.account_id        │
        │  - lifecycle_state: opened → discovery →    │
        │    concept → presenting → approved → closed │
        │  - assignments: team operativo via         │
        │    design_journey_assignments              │
        └────────────────────────────────────────────┘
```

### A.2 · Tre verità immutabili (canon LOCKED)

1. **Design Journey ≠ stato CRM.** È un contenitore di lavoro aperto **da** un Account in stato `prospect` o `customer`.
2. **Customer NON è obbligatorio per avere una Journey.** Un Prospect qualificato può avere una Journey aperta senza mai diventare Customer (Scenario A).
3. **Lead non può MAI generare una Journey.** Una Discovery `qualified` è prerequisito assoluto.

### A.3 · Stati canonici delle entità

#### A.3.1 · `leads.status`
```
new           Lead appena creato (sempre lo stato iniziale)
in_discovery  Discovery iniziata (started_at != NULL, status != qualified)
qualified     Discovery completata con esito qualified (transizione gated)
unqualified   Discovery chiusa senza qualifica
recycled      Lead da ritentare in futuro
archived      Lead definitivamente chiuso (no follow-up)
```

#### A.3.2 · `discovery_interviews.status`
```
pending       Discovery creata, mai aperta
in_progress   Discovery aperta (started_at != NULL)
qualified     Discovery chiusa con esito qualified → side effect: account(prospect)
unqualified   Discovery chiusa con esito negativo (disqualification_reason richiesto)
recycled      Discovery archiviata per re-engagement
```

#### A.3.3 · `accounts.lifecycle_stage` (target enum LOCKED)
```
prospect       Account creato da discovery.qualify() · no journey ancora obbligatoria
in_proposal    Proposta inviata · journey attiva nello stato 'presenting'
customer       Proposta firmata · transizione esplicita via convert-to-customer
churned        Customer non più attivo · soft-archive
on_hold        Customer/Prospect in pausa (es. stagionale, indecisione)
```

#### A.3.4 · `design_journeys.lifecycle_state`
```
opened         Journey appena aperta (era 'conversation_open')
discovery      Brief raccolto, in qualifica progettuale
concept        Concept lavorazione
presenting     Proposta in revisione cliente
drifting       Lunga inattività → warning UX
on_pause       Mettere in pausa
approved       Proposta firmata (trigger convert-to-customer)
closed         Journey chiusa con successo
editioned      Journey archiviata e curata in Cultural Editions
abandoned      Journey chiusa senza esito
```

---

## B · LIFECYCLE RULES (immutable)

### B.1 · Lead → Discovery (automatic)
- Alla creazione di un Lead viene **auto-creata** una row `discovery_interviews(status='pending')`.
- La Discovery è sempre 1:1 con il Lead (idempotent: ri-creazione restituisce esistente).
- **Visibilità:** la Discovery DEVE essere immediatamente visibile nel Lead Detail Page con progress indicator.

### B.2 · Discovery → Prospect (manual, gated)
- Solo via `POST /api/discovery/{did}/qualify`.
- **Side effect:** crea/upserta `accounts(lifecycle_stage='prospect', lead_id=L)`.
- Lead diventa `status='qualified'`.
- **Requisiti minimi enforced** (vedi §B.6).

### B.3 · Discovery → Unqualified / Recycled (manual)
- `POST /api/discovery/{did}/disqualify` body `{reason}` → `lead.status='unqualified'`
- `POST /api/discovery/{did}/recycle` → `lead.status='recycled'`
- **No account creato.** Il lead può essere riaperto in futuro via `recycled → in_discovery`.

### B.4 · Prospect → Design Journey (manual, optional)
- Via `POST /api/accounts/{aid}/journeys`.
- **Validazioni R1-R5** (vedi §C).
- **NON obbligatorio:** un Prospect può rimanere senza Journey indefinitamente (es. lead enterprise in fase commerciale lunga).

### B.5 · Prospect → Customer (manual, explicit)
- Via `POST /api/accounts/{aid}/convert-to-customer` body `{proposal_id, signed_at, signed_by_contact_id}`.
- **Trigger:** una proposta firmata (signed_proposal).
- **Validazioni:**
  - `accounts.lifecycle_stage` deve essere `prospect` o `in_proposal`
  - `proposals.status='signed'` deve esistere
  - `proposals.account_id` deve coincidere
- **Side effects:**
  - `accounts.lifecycle_stage='customer'`
  - `accounts.signed_proposal_id=proposal.id`
  - `funnel_events(stage='customer', event='customer_confirmed')`
- **Irreversibile:** un Customer non può tornare ad essere Prospect (per nuovi deal si apre una nuova Journey, lifecycle_stage resta `customer`).

### B.6 · Prospect qualification criteria (LOCKED)

Un Lead NON può diventare Prospect senza:
| # | Criterio | Enforcement |
|---|---|---|
| Q1 | Discovery completata | `discovery_interviews.completed_at IS NOT NULL` |
| Q2 | Origin compilato (no NULL) | `leads.source IS NOT NULL` e `source IN canon enum` |
| Q3 | Almeno un contatto valido | `leads.email IS NOT NULL OR leads.phone IS NOT NULL` |
| Q4 | Interesse identificato | `leads.market_sector IS NOT NULL` o `discovery_interviews.qualification_signals.interest_level IS NOT NULL` |

**Soft criteria** (raccomandati ma non obbligatori):
- Budget range (se conosciuto)
- Timeline (se conosciuto)
- Decision maker identificato
- Architetto coinvolto (se applicabile)

### B.7 · Lead aging policy (consigliata, non enforced)
- Lead `new` per > 7 giorni → notifica owner (futuro: Notification Bus)
- Discovery `in_progress` per > 14 giorni → notifica owner
- Prospect senza Journey per > 30 giorni → audit dashboard

---

## C · DESIGN JOURNEY RULES (LOCKED)

### C.1 · Regola chiave (immutable)

> **Una Design Journey può essere creata SOLO da:**
> - un Account con `lifecycle_stage='prospect'` (Scenario A)
> - un Account con `lifecycle_stage='in_proposal'`
> - un Account con `lifecycle_stage='customer'` (Scenario B)
>
> **MAI da un Lead.**

### C.2 · Endpoint canonico (unico)
```
POST /api/accounts/{aid}/journeys
```
**Body:**
```json
{
  "kickoff_note": "string|null",
  "title": "string|null",
  "force": false
}
```

### C.3 · Validazioni R1-R5 (LOCKED)

| Regola | Descrizione | Enforcement | HTTP code se violato |
|---|---|---|---|
| **R1** | Journey lega sempre `account_id` | FK NOT NULL su `design_journeys.account_id` | 500 (schema violation, mai raggiungibile) |
| **R2** | `account.lifecycle_stage` deve essere `prospect`, `in_proposal` o `customer` | Application-level check in `account_journeys.py` | 400 `ACCOUNT-INVALID-STAGE` |
| **R3** | User deve avere permission `projects:write` | Decorator `require_permission(P_PROJECTS_WRITE)` | 403 |
| **R4** | Discovery del lead origine deve essere `qualified` (se account ha `lead_id`) | Application-level soft-check (warning log, non blocco) | 200 con warning header `X-CRM-Warning` |
| **R5** | Max 1 Journey **attiva** per account | Check `lifecycle_state NOT IN ('closed','abandoned','editioned')` | 409 `JOURNEY-ALREADY-ACTIVE` con `existing_journey_id` (bypass `?force=true`) |

### C.4 · Lifecycle state della Journey (LOCKED)

Vedi §A.3.4. La Journey **non torna mai** a stati precedenti se non via amministratore (audit log obbligatorio).

### C.5 · Multipli Journey per Customer (compatibilità ITER186+)

Un Customer può avere N journey nel tempo (uno active alla volta per R5, ma archiviati storicamente):
- Journey #1: progetto residenziale 2024 (closed)
- Journey #2: progetto hospitality 2025 (active)

L'archive è preservato per analytics e Cultural Editions™.

---

## D · CONVERSION RULES (LOCKED)

### D.1 · Lead → Prospect

| Trigger | Lead.status before | After | Account |
|---|---|---|---|
| `POST /api/discovery/{did}/qualify` | `new` o `in_discovery` | `qualified` | `accounts(prospect)` creato/aggiornato |
| Public form Begin Journey | (Lead nasce e diventa qualified in transazione) | `qualified` | `accounts(prospect)` + Journey simultanei (special case, vedi §F.1) |

### D.2 · Prospect → Customer

| Trigger | Account.lifecycle_stage before | After |
|---|---|---|
| `POST /api/accounts/{aid}/convert-to-customer` con proposta firmata | `prospect` o `in_proposal` | `customer` |
| Trigger automatico su `proposals.status → signed` | (idem) | (idem) — opzionale future |

### D.3 · States chiusura

| Trigger | State before | After | Notes |
|---|---|---|---|
| `POST /api/discovery/{did}/disqualify` | Lead `in_discovery` | Lead `unqualified` | Reason obbligatorio |
| `POST /api/discovery/{did}/recycle` | Lead `unqualified` | Lead `recycled` | Re-engagement future |
| `POST /api/accounts/{aid}/put-on-hold` | Prospect/Customer | `on_hold` | Pausa esplicita |
| `POST /api/accounts/{aid}/resume` | `on_hold` | last stage | Riprendi |
| `POST /api/accounts/{aid}/churn` | Customer | `churned` | Cliente perso |

### D.4 · No skipping rules

- ❌ Non si può saltare la Discovery (Lead → Prospect direct)
- ❌ Non si può saltare Prospect (Lead → Customer direct)
- ❌ Non si può creare Journey su Lead (anche se ha discovery `pending`)
- ✅ Si può saltare Customer (Prospect → Journey direct = Scenario A)

---

## E · OWNERSHIP RULES (LOCKED)

> **Il CRM mantiene ownership commerciale.**  
> **La Journey gestisce il team operativo.**

### E.1 · Commercial ownership (CRM)

| Entità | Ownership field | Significato | Cambio |
|---|---|---|---|
| Lead | `leads.assigned_to` (uuid → users_profile) | Designer/PM/Sales responsabile del lead | manuale via `PATCH /api/leads/{lid}` |
| Account (Prospect/Customer) | `accounts.account_manager_id` (futuro) o `accounts.primary_designer_id` | Account owner commerciale | manuale via admin |
| Contact | (eredita ownership Account) | n/a | n/a |

### E.2 · Operational ownership (Design Journey)

| Entità | Tabella | Ruoli | Riferimento |
|---|---|---|---|
| Journey | `design_journey_assignments` | `owner` (1 unique), `contributor` (N), `observer` (N) | ITER178 |
| Eventi | `design_journey_assignment_events` | audit log | ITER178 |

### E.3 · Separation enforcement

- `leads.assigned_to` può essere `null` (default) — il CRM owner è opzionale finché non si vuole tracciare attribution.
- `design_journey_assignments` è **sempre popolata** all'apertura della Journey con almeno 1 `owner` (auto-resolved via priority chain).
- **Cambio CRM owner ≠ cambio Journey owner.** Sono indipendenti.

### E.4 · Compatibilità ITER186 (Team Model)

L'architettura ITER178 (`design_journey_assignments`) è già pronta per:
- Multi-owner enforcement (1 unique active)
- Team contributors multipli
- Observer ruolo (read-only)
- Handoff atomico via `change-owner`
- Audit trail completo

ITER186 dovrà solo:
- Estendere UI drawer admin per assegnazioni
- Page "Le mie Journey" per i membri team
- Notification fan-out (dipende da Notification Bus)

**Nessuna modifica al CRM model richiesta da ITER186.**

---

## F · LIFECYCLE ENFORCEMENT RULES

### F.1 · Public form Begin Journey — special case

Il public form `/begin-journey` crea simultaneamente Lead + Account + Journey + Discovery(`qualified`) in transazione.

**Giustificazione canon-compliance:**
- Il form pubblico richiede al cliente di compilare **info qualificanti** (budget, timeline, spaces, atmospheres) → equivale a una Discovery completata.
- La Discovery viene creata con `status='qualified', source='public_form', auto_qualified=true` → audit-friendly.
- Il vincolo "Lead non genera Journey" è rispettato perché la Discovery esiste prima del Journey insert (anche se in stessa transazione).

**Enforcement:**
- Solo via endpoint `POST /api/public/journeys/initiate` (anonymous, tenant-scoped via slug)
- **Non replicabile** da endpoint autenticati o admin tools
- Audit `funnel_events(stage='prospect_initial_brief', event='begin_journey.prospect_promoted')`

### F.2 · `crm_lifecycle_lint.py` — proposed CI script

Script di lint statico (read-only, no DB queries) da eseguire su PR:

```python
# Pseudocode · da implementare in ITER185 Phase 4 (opzionale)

checks = [
  # CHK-1 · No raw INSERT into design_journeys without account_id
  "grep -rn 'INSERT INTO design_journeys' --include='*.py' | exclude_account_id_check",

  # CHK-2 · No backend endpoint that accepts {lead_id} for journey creation
  "grep -rn 'lead_id.*design_journey' backend/routers/",

  # CHK-3 · No accounts.lifecycle_stage update with non-canonical value
  "grep -rn \"lifecycle_stage.*=.*['\\\"]\" backend/ | match_outside_enum",

  # CHK-4 · No frontend API call to /api/leads/.*/journey
  "grep -rn 'api/leads/.*journey' frontend/src/",

  # CHK-5 · No skip-Discovery in qualify endpoint
  "ast-parse: POST /api/discovery/.*/qualify must validate discovery.status IN ('pending','in_progress')",

  # CHK-6 · No Customer creation without proposal_id reference
  "ast-parse: POST /api/accounts/.*/convert-to-customer must require proposal_id",

  # CHK-7 · No design_journey_assignments creation without journey_id
  "schema-check: design_journey_assignments.journey_id NOT NULL"
]
```

**Verdetto:** **IMPLEMENTARE** come `scripts/crm_lifecycle_lint.py` in ITER185 Phase 4. Eseguito in CI baseline. Zero violazioni richieste per merge.

### F.3 · Database-level enforcement (futuro)

| Regola | Implementation |
|---|---|
| `design_journeys.account_id` NOT NULL | ✅ già enforced (ITER168) |
| `accounts.lifecycle_stage` ∈ enum | 🔴 da implementare (migration ALTER TYPE) |
| `leads.source` ∈ enum | 🔴 da implementare (migration) |
| `discovery_interviews.lead_id` NOT NULL | ✅ già enforced (migration 114) |
| Trigger `qualify` → `account_upsert(prospect)` | 🟡 oggi applicativo · spostare a DB trigger opzionale |
| Trigger `signed_proposal` → `lifecycle='customer'` | 🔴 da implementare (futuro) |

### F.4 · API-level enforcement (LOCKED)

Tutti gli endpoint CRM **DEVONO**:
1. Validare permission via `require_permission(P_*)`
2. Filtrare per `tenant_id` (multi-tenancy)
3. Restituire payload senza `_id` MongoDB-style
4. Loggare transizioni in `funnel_events` o `discovery_interviews.metadata_json`
5. Rifiutare con HTTP 400 ogni transizione non canonica

### F.5 · Frontend-level enforcement (LOCKED)

Tutti i componenti CRM **DEVONO**:
1. Usare `NewRelationshipModal` come unico entry point per creazione Lead/Journey (no CTA paralleli)
2. Disabilitare CTA "Apri Journey" su Lead non qualificati (con tooltip)
3. Mostrare `DiscoveryInterviewPanel` con progress indicator nel Lead Detail
4. Mai chiamare `POST /api/design_journeys` direttamente (usare `/api/accounts/{aid}/journeys`)

---

## G · LEAD WIZARD — CANONICAL DESIGN (LOCKED)

### G.1 · Struttura 6-step

| Step | Titolo | Campi | Mandatory | DB target |
|---|---|---|---|---|
| **1** | Informazioni base | first_name*, last_name, company_name, role | first_name | `leads.first_name`, `last_name`, `company_name`, `metadata_json.role` |
| **2** | Contatti | email, phone (+ ISO country prefix), city, country | email **OR** phone | `leads.email`, `phone`, `city`, `country`, `metadata_json.country_code` |
| **3** | Origine ⭐ MANDATORY | source picker (enum) | source | `leads.source` (enum) |
| **4** | Interesse | market_sector picker (enum) | market_sector | `leads.market_sector` (enum) |
| **5** | Note operative | notes (textarea) | (none) | `leads.notes` |
| **6** | Owner iniziale | assigned_to (designer/PM dropdown) | (none, default founder) | `leads.assigned_to` |

### G.2 · Source enum LOCKED (`leads.source`)

```
showroom      Lead arrivato in showroom fisicamente
phone         Telefonata in entrata
email         Email diretta allo studio
website       Form pubblico sul sito (auto-set da public path)
referral      Segnalato da cliente/contatto esistente
architect     Segnalato da architetto/studio partner
event         Conosciuto a evento/fiera/conferenza
import        Importato da CSV o sistema esterno
other         (richiede testo libero in metadata_json.source_detail)
```

**Regola:** Mai NULL. Mai "Unknown". Mai stringa libera fuori enum (eccetto `other` con `source_detail`).

### G.3 · Market sector enum LOCKED (`leads.market_sector`)

```
residential   Privato/residenziale
hospitality   Hotel, ristoranti, spa, eventi
retail        Negozi, showroom, retail luxury
office        Uffici, coworking, corporate
contract      Project contract, B2B grandi commesse
other         (richiede testo libero in metadata_json.sector_detail)
```

### G.4 · Wizard behaviour

| Behaviour | Rule |
|---|---|
| **Submit immediato** | Lo step 1 può salvare il Lead già con `first_name`. Gli step 2-6 sono progressive enhancement. |
| **Skip-to-end** | CTA "Salva e completa dopo" disponibile dallo step 2 in poi. Salva tutti i campi compilati, lascia gli altri NULL. |
| **Source mandatory** | Lo step 3 è **gate**: non si può chiudere il wizard senza source compilata. Default suggested = `showroom` (basato su context: se admin user è in tenant `studio`, suggerisce `showroom`). |
| **Owner default** | Step 6 default = current user (admin/designer aperto al wizard). |
| **No Journey creata** | Mai. Solo Lead + Discovery(`pending`). |
| **No transizione automatica** | Lead resta `status='new'` finché Discovery non viene qualificata manualmente. |
| **Dedup-check** | Step 2 onBlur su email + phone → warning banner. |

### G.5 · Wizard outputs

| Output | Tabella |
|---|---|
| Lead row | `leads(status='new', source=enum, market_sector=enum, ...)` |
| Discovery row | `discovery_interviews(status='pending', source=lead.source, lead_id=L)` |
| Funnel event | `funnel_events(stage='lead_captured', event='wizard_completed')` |
| Audit | `discovery_interviews.metadata_json.entry_path = 'manual_wizard'` |

### G.6 · Out of scope (Wizard NON fa)
- ❌ Non crea Account
- ❌ Non crea Contact
- ❌ Non crea Journey
- ❌ Non invia email al lead
- ❌ Non chiama AI / Cultural Editions

---

## H · DASHBOARD KPI (LOCKED)

### H.1 · 4 KPI canonici

| KPI | Sorgente | Query semantica |
|---|---|---|
| **Leads** | `leads` count where `status IN ('new', 'in_discovery')` | Lead grezzi + in qualifica |
| **Prospects** | `accounts` count where `lifecycle_stage IN ('prospect', 'in_proposal')` | Account qualificati pre-firma |
| **Customers** | `accounts` count where `lifecycle_stage = 'customer'` | Account firmati |
| **Design Journeys** | `design_journeys` count where `lifecycle_state NOT IN ('closed','abandoned','editioned')` | Journey attive |

### H.2 · KPI vietati

❌ Non introdurre:
- Score astratti ("warmth", "intensity", "vibe")
- Metriche creative ("atmospheres detected", "voices captured")
- Indicatori non operativi ("conversion magic", "studio cadence")
- Stati ambigui ("flowing", "drifting", "silent")

### H.3 · Tooltip / drill-down (consigliati)

Click su KPI → naviga a:
- **Leads** → `/relations/leads?status=new,in_discovery`
- **Prospects** → `/relations/prospects` (already filters `prospect`+`in_proposal`)
- **Customers** → `/relations/accounts?lifecycle=customer`
- **Design Journeys** → `/workspace/projects` (already filters active)

### H.4 · View `v_crm_funnel` (suggested)

```sql
CREATE OR REPLACE VIEW v_crm_funnel AS
SELECT
  tenant_id,
  (SELECT COUNT(*) FROM leads WHERE leads.tenant_id = t.tenant_id
    AND leads.status IN ('new','in_discovery'))         AS lead_count,
  (SELECT COUNT(*) FROM accounts WHERE accounts.tenant_id = t.tenant_id
    AND accounts.lifecycle_stage IN ('prospect','in_proposal')) AS prospect_count,
  (SELECT COUNT(*) FROM accounts WHERE accounts.tenant_id = t.tenant_id
    AND accounts.lifecycle_stage = 'customer')          AS customer_count,
  (SELECT COUNT(*) FROM design_journeys dj WHERE dj.tenant_id = t.tenant_id
    AND dj.lifecycle_state NOT IN ('closed','abandoned','editioned')) AS active_journey_count,
  NOW() as computed_at
FROM (SELECT DISTINCT tenant_id FROM tenants) t;
```

Dashboard chiama `GET /api/dashboard/kpi-funnel?tenant_id=...` che restituisce questa view (cache 60s).

---

## I · GAP RESIDUI

### I.1 · Schema / DB

| # | Gap | Severity | Effort |
|---|---|---|---|
| GAP-DB-1 | `accounts.lifecycle_stage` enum non normalizzato (text libero) | 🔴 P0 | 0.5g migration |
| GAP-DB-2 | `leads.source` enum non normalizzato (text libero) | 🟠 P1 | 0.5g migration |
| GAP-DB-3 | `leads.market_sector` enum non esiste come colonna esplicita | 🟠 P1 | 0.25g migration |
| GAP-DB-4 | `accounts.signed_proposal_id` FK non esiste | 🟠 P1 | 0.25g migration |
| GAP-DB-5 | View `v_crm_funnel` non esiste | 🟡 P2 | 0.25g migration |
| GAP-DB-6 | `leads.first_journey_id` deprecated ma ancora popolato (`journey_initiate.py`) | 🟡 P2 | 0.1g code patch |

### I.2 · API / endpoint

| # | Gap | Severity | Effort |
|---|---|---|---|
| GAP-API-1 | `POST /api/accounts/{aid}/convert-to-customer` non esiste | 🔴 P0 | 0.5g |
| GAP-API-2 | `POST /api/accounts/{aid}/put-on-hold`, `/resume`, `/churn` non esistono | 🟠 P1 | 0.5g |
| GAP-API-3 | `GET /api/dashboard/kpi-funnel` (view-based) non esiste | 🟠 P1 | 0.25g |
| GAP-API-4 | `crm_lifecycle_lint.py` CI script non esiste | 🟡 P2 | 0.5g |
| GAP-API-5 | Validazione enum lato API per `leads.source` e `market_sector` | 🟡 P2 | 0.25g (post enum migration) |

### I.3 · Frontend / UX

| # | Gap | Severity | Effort |
|---|---|---|---|
| GAP-UX-1 | Lead Wizard 6-step inesistente (oggi inline 4-field) | 🔴 P0 | 1-1.5g |
| GAP-UX-2 | Source picker visivo (chip o radio) mandatory non visibile | 🔴 P0 | 0.25g (parte di GAP-UX-1) |
| GAP-UX-3 | Discovery Progress Indicator (0%-100%) nel Lead Detail | 🔴 P0 | 0.5g |
| GAP-UX-4 | CTA "Conferma cliente" (`convert-to-customer`) in workspace journey | 🟠 P1 | 0.5g |
| GAP-UX-5 | KPI dashboard 4-count (Lead, Prospect, Customer, Journey) numeri visibili | 🟠 P1 | 0.5g |
| GAP-UX-6 | `AccountsPage` senza CTA "Nuovo Design Journey" inline | 🟠 P1 | 0.25g |
| GAP-UX-7 | Tooltip "Why no journey from Lead?" su CTA disabilitata | 🟡 P2 | 0.1g |
| GAP-UX-8 | Filtro `status` in `LeadsPage` (new/in_discovery/qualified/...) | 🟡 P2 | 0.25g |
| GAP-UX-9 | `ProspectsPage.handlePromote` audit-trace (cosa fa davvero?) | 🔴 P0 | 0.25g |

### I.4 · Workflow / process

| # | Gap | Severity |
|---|---|---|
| GAP-WF-1 | Trigger automatico `signed_proposal → convert_to_customer` mancante | 🟠 P1 |
| GAP-WF-2 | Lead aging notification (>7 days new) → richiede Notification Bus | 🟡 P2 |
| GAP-WF-3 | Re-engagement workflow per `recycled` leads | 🟡 P2 |
| GAP-WF-4 | Audit trail visivo del lifecycle (timeline Lead→Prospect→Customer) | 🟡 P2 |

### I.5 · Data quality

| # | Gap | Severity |
|---|---|---|
| GAP-DQ-1 | `leads.source` valori liberi correnti senza enum (verifica retroattiva) | 🟠 P1 (audit dati) |
| GAP-DQ-2 | `accounts.lifecycle_stage` retroattivamente potrebbe avere valori non canonici | 🟠 P1 (audit dati) |
| GAP-DQ-3 | `discovery_interviews.qualification_signals` jsonb senza schema validato | 🟡 P2 |
| GAP-DQ-4 | `funnel_events` non popolato sistematicamente su tutti i transition | 🟡 P2 |

---

## J · ROADMAP IMPLEMENTATIVA AGGIORNATA · ITER185

### Phase 1 · P0 blockers · ~2g

| Task | Deliverable | Effort |
|---|---|---|
| 1.1 | Audit `ProspectsPage.handlePromote` + `useRelations.promote()` — capire cosa fa, fixare se rotto | 0.25g |
| 1.2 | Implementare `POST /api/accounts/{aid}/convert-to-customer` (B.5) | 0.5g |
| 1.3 | Lead Wizard 6-step UI (sostituire form inline in `NewRelationshipModal`) | 1g |
| 1.4 | Source picker enum step 3 (mandatory) | 0.25g (parte di 1.3) |
| 1.5 | Discovery Progress Indicator (0%-100%) nel Lead Detail | 0.5g |

### Phase 2 · P1 stability · ~2g

| Task | Deliverable | Effort |
|---|---|---|
| 2.1 | Migration `accounts.lifecycle_stage` → enum (GAP-DB-1) | 0.5g |
| 2.2 | Migration `leads.source` → enum (GAP-DB-2) | 0.5g |
| 2.3 | Migration `leads.market_sector` → colonna esplicita (GAP-DB-3) | 0.25g |
| 2.4 | View `v_crm_funnel` + endpoint `GET /api/dashboard/kpi-funnel` | 0.5g |
| 2.5 | Endpoint `/put-on-hold`, `/resume`, `/churn` | 0.5g |
| 2.6 | CTA "Conferma cliente" in workspace journey post-firma | 0.5g |
| 2.7 | KPI dashboard 4-count (Lead, Prospect, Customer, Journey) | 0.5g |
| 2.8 | CTA "Nuovo Design Journey" inline in AccountsPage | 0.25g |

### Phase 3 · P2 polish · ~1.5g

| Task | Deliverable | Effort |
|---|---|---|
| 3.1 | Deprecate `leads.first_journey_id` write su `journey_initiate.py` | 0.1g |
| 3.2 | Filtro `status` in LeadsPage (new/in_discovery/qualified) | 0.25g |
| 3.3 | Tooltip "Why no journey from Lead?" su CTA disabled | 0.1g |
| 3.4 | Validazione enum lato API per `leads.source` + `market_sector` | 0.25g |
| 3.5 | Schema validation `discovery_interviews.qualification_signals` jsonb | 0.5g |

### Phase 4 · P3 enforcement & cleanup · ~1g

| Task | Deliverable | Effort |
|---|---|---|
| 4.1 | `scripts/crm_lifecycle_lint.py` (CI baseline, vedi F.2) | 0.5g |
| 4.2 | FK `accounts.signed_proposal_id` migration (GAP-DB-4) | 0.25g |
| 4.3 | Trigger automatico `signed_proposal → convert_to_customer` (opzionale) | 0.25g |

### Totale stimato: ~6.5 giorni effettivi

---

## K · CONSEGNA & VERIFICATION CHECKLIST (LOCKED)

Prima di chiudere ITER185, **TUTTE** le seguenti must-pass:

### K.1 · Backend

- [ ] `POST /api/accounts/{aid}/convert-to-customer` esiste, valida (proposal_id, signed_at) e ritorna 200
- [ ] `accounts.lifecycle_stage` è un enum DB (no text libero)
- [ ] `leads.source` è un enum DB (no text libero)
- [ ] `leads.market_sector` esiste come colonna enum
- [ ] View `v_crm_funnel` esiste e ritorna counts
- [ ] `GET /api/dashboard/kpi-funnel` ritorna {lead_count, prospect_count, customer_count, active_journey_count}
- [ ] `POST /api/accounts/{aid}/put-on-hold|resume|churn` esistono
- [ ] Tutti gli endpoint hanno tenant_id filtering + permission check

### K.2 · Frontend

- [ ] Lead Wizard 6-step funziona e salva Lead + Discovery(pending)
- [ ] Source picker step 3 è mandatory (non posso chiudere wizard senza)
- [ ] Discovery Progress Indicator (0-100%) visibile nel Lead Detail
- [ ] Dashboard mostra 4 KPI numerici (Lead, Prospect, Customer, Journey)
- [ ] CTA "Conferma cliente" appare in workspace journey post-firma
- [ ] CTA "Nuovo Design Journey" appare inline in AccountsPage row
- [ ] Tooltip "Why no journey from Lead?" su elementi disabilitati
- [ ] `LeadsPage` filtra per `status`

### K.3 · Lifecycle enforcement

- [ ] Nessun INSERT in `design_journeys` con account_id ∈ Lead-only
- [ ] Nessun endpoint accetta `lead_id` per creazione Journey
- [ ] `crm_lifecycle_lint.py` esiste e passa zero violazioni
- [ ] CI fail su PR che introduce violazioni canon

### K.4 · Data quality

- [ ] Backfill `leads.source` su valori esistenti → enum-compliant
- [ ] Backfill `accounts.lifecycle_stage` su valori esistenti → enum-compliant
- [ ] `funnel_events` popolato su qualify(), convert-to-customer(), churn(), etc.
- [ ] Audit trail completo per ogni transizione lifecycle

### K.5 · Test

- [ ] Pytest `test_iter185_crm_foundation.py`: 8+ test E2E (Lead Wizard, Discovery, Qualify, Convert, Journey rules, Customer conversion, put-on-hold, KPI)
- [ ] Testing agent v3 full coverage
- [ ] Smoke test E2E manuale: showroom flow + email flow + referral flow

---

## L · VINCOLO RISPETTATO

✅ **Zero modifiche in questa iterazione (Phase 0 · Locked Model)**:
- DB schema / migrations
- Backend routers / endpoint
- Frontend componenti / pages
- i18n strings
- Configuration files

✅ **Solo file creato:**
- `/app/memory/CRM_FOUNDATION_LOCKED_MODEL.md` (questo documento)

✅ **PRD.md aggiornato** con riferimento ITER185 Phase 0 (Locked Model).

---

## M · DECISION GATE

> **🔒 Questo documento è in attesa di approvazione esplicita del Founder.**
>
> Una volta approvato:
> 1. Diventa la **fonte ufficiale** per CRM, Journey, Assignments, Notification, Dashboard, future API/migrations.
> 2. Si avvia **ITER185 Phase 1** (P0 blockers · ~2g).
> 3. Nessun'altra iterazione (Notification Bus, Journey Assignments Ph2, Editorial Onboarding, Error Registry, Client Chameleon) può iniziare prima che ITER185 Phase 1+2 siano shipped e verificate.

### M.1 · Domande aperte al Founder (per chiarimento)

1. **Customer → Prospect rollback consentito?**
   - Default proposto: ❌ NO. Customer è irreversibile.
   - Alternative: 🟡 supportare `unchurn`? (es. cliente perso che torna)
   - **Decisione richiesta:** confermare default o specificare alternative.

2. **`leads.source = 'other'` come gestire `source_detail`?**
   - Default proposto: testo libero in `metadata_json.source_detail`, max 100 char, no validation.
   - Alternative: 🟡 require manager approval / 🟡 require tagging system.
   - **Decisione richiesta:** confermare default.

3. **Discovery progress %: calcolo deterministico o soggettivo?**
   - Default proposto: deterministico, basato su completion di sezioni mandatory in `qualification_signals` (budget, timeline, market_sector, interest_level, contact_method).
   - 5 sezioni · 20% ciascuna = 100%.
   - Alternative: 🟡 soggettivo (slider manuale).
   - **Decisione richiesta:** confermare deterministico.

4. **Trigger automatico `signed_proposal → customer`?**
   - Default proposto: 🟡 opzionale in Phase 4 (P3) — Phase 1 implementa solo endpoint manuale.
   - Alternative: 🟢 attivare subito → meno friction operatori.
   - **Decisione richiesta:** scegliere.

5. **CSV import in Phase 4 o Phase 5?**
   - Default proposto: 🟡 fuori scope ITER185 → ITER186+.
   - Alternative: 🟢 includere come P3 nice-to-have.
   - **Decisione richiesta:** scegliere.

---

## N · OUTPUT SUMMARY (8 punti come da Founder directive)

| # | Output | Sezione documento |
|---|---|---|
| **A** | CRM Locked Model | §A + §M |
| **B** | Diagramma stati definitivo | §A.1 (Lead→Discovery→Prospect→[Customer] + Journey container) |
| **C** | Journey Rules definitive | §C (R1-R5 + lifecycle_state enum) |
| **D** | Conversion Rules definitive | §D (Lead→Prospect, Prospect→Customer, all closures) |
| **E** | Ownership Rules | §E (CRM commercial vs Journey operational, compat ITER186) |
| **F** | Lifecycle Enforcement Rules | §F (public-form exception, lint script, DB+API+FE enforcement) |
| **G** | Gap residui | §I (4 schema + 5 API + 9 UX + 4 workflow + 4 DQ) |
| **H** | Roadmap implementativa aggiornata | §J (4 phase · ~6.5g totale) |

---

## O · Revision log

| Versione | Data | Autore | Note |
|---|---|---|---|
| 1.0 | 2026-06-01 | Product Governance | Locked Model iniziale ITER185 Phase 0. **Awaiting Founder approval.** |

---

**Status:** 🔒 **LOCKED MODEL READY FOR FOUNDER APPROVAL**  
**Next gate:** approvazione Founder → kickoff **ITER185 Phase 1 (P0 blockers · ~2g)**.  
**Blocked iterations until ITER185 Phase 1+2 shipped:** Notification Bus, Journey Assignments Phase 2, Editorial Onboarding, Error Registry, Client Chameleon.
