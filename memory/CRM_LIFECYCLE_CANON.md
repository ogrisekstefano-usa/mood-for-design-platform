# CRM LIFECYCLE CANON
## Lead → Discovery → Prospect → Account → Design Journey™

> **Status:** 🔒 ARCHITECTURE AUDIT · 31 May 2026 · zero modifica codice/DB
> **Vincolo Founder:** Il modello attuale `Lead → Journey` è ERRATO. Lead non può avere Journey.
> **Modello canonico:** `Lead → Discovery → Prospect → Design Journey™` **oppure** `Account → Design Journey™`

---

## §0 · Modello canonico (immutabile)

```
                                    ┌──────────────────────────┐
                                    │       LEAD               │
                                    │  (contatto grezzo)       │
                                    │  status = new            │
                                    └────────────┬─────────────┘
                                                 │
                                    Discovery Interview™
                                    (form, call, voice, manual)
                                                 │
                              ┌──────────────────┴───────────────────┐
                              │                                       │
                              ▼                                       ▼
                  ┌──────────────────────┐                  ┌──────────────────────┐
                  │     QUALIFIED?       │                  │   UNQUALIFIED        │
                  │   → PROSPECT         │                  │  (close-lost,        │
                  │     status=qualified │                  │   recycle, nurture)  │
                  └──────────┬───────────┘                  └──────────────────────┘
                             │
              ┌──────────────┴───────────────┐
              │                               │
              ▼                               ▼
   ┌────────────────────────┐      ┌────────────────────────┐
   │  Design Journey™       │      │   wait / engage further │
   │  (prospect-stage)      │      └────────────────────────┘
   └───────────┬────────────┘
               │
               │ converted via signed proposal
               ▼
   ┌────────────────────────┐
   │       ACCOUNT          │
   │   (cliente confermato) │
   │   status = customer    │
   └───────────┬────────────┘
               │
               │ ulteriori opportunities/extensions
               ▼
   ┌────────────────────────┐
   │  Design Journey™ N+1   │
   │  (account-stage)       │
   └────────────────────────┘
```

**Tre verità:**
1. **Lead NON può avere Journey.** Una Discovery deve qualificare prima.
2. **Prospect SI** ha Journey (è già qualificato, ma non ancora cliente).
3. **Account SI** ha Journey N+1 (cliente ricorrente).

---

## §1 · Stato attuale (cosa fa il codice oggi)

### 1.1 · Tabelle coinvolte

| Tabella | Ruolo | Stato uso |
|---|---|---|
| `leads` | contatto grezzo | ✅ esiste · 53 colonne (over-engineered) |
| `accounts` | account (cliente o prospetto) | ✅ esiste · `lifecycle_stage` non normalizzato |
| `contacts` | persone all'interno account | ✅ esiste |
| `design_journeys` | journey | ✅ esiste, **lega `account_id` (corretto) NON `lead_id`** |
| `projects` | progetto (1:1 con journey) | ✅ esiste |
| `relationship_threads` | conversazione | ✅ esiste |
| `studio_relations` | snapshot relazione attiva | ✅ esiste |

### 1.2 · `leads` — colonne semantica lifecycle

```
status                  enum lead_status  -- new, qualified, ...
pipeline_stage          text              -- prospect_initial_brief, ...
progression_state       text              -- TBD
progression_score       numeric           -- 0..1
intake_completed_at     timestamptz       -- timestamp Discovery
intake_version          int
lead_type               enum
score                   numeric
first_journey_id        uuid → design_journeys.id   -- ← OUCH
designer_assigned       uuid → users_profile.id (legacy)
assigned_to             uuid → users_profile.id (current)
client_user_id          uuid → users_profile.id    -- if convertito a auth user
```

**Conferma:** la colonna `leads.first_journey_id` esiste ma è semanticamente debole. Stessa cosa con `accounts` (che ha `lifecycle_stage` ma non un FK pulito).

### 1.3 · Codice `journey_initiate.py` (attuale)

```python
# T0 Public form Begin Journey →
#    POST /api/public/journeys/initiate
T+0  create lead (status='new', pipeline_stage=NULL)
T+1  create account (lifecycle_stage='conversation_open')
T+2  create contact
T+3  create project
T+4  create design_journey (account_id=account.id)
T+5  UPDATE leads SET status='qualified', pipeline_stage='prospect_initial_brief'
     SET first_journey_id=journey.id
T+6  scrive evento "begin_journey.prospect_promoted"
```

**Problema:** il sistema **crea simultaneamente** lead, account, e journey. La "Discovery" è implicita (= il form pubblico Begin Journey). **Non c'è un passaggio esplicito** dove un team member dice "questo lead è qualificato".

**Conseguenza pratica oggi:**
- Tutti i lead arrivano da Begin Journey → sono **auto-qualificati**.
- Non esiste flusso "Lead manuale" che parte come `status='new'` e attende Discovery.
- Lead **non** = embrionale; Lead = "form completato".

### 1.4 · Pagine UI esistenti

| Pagina | File | Stato uso |
|---|---|---|
| `/relations/leads` | `pages/relations/LeadsPage.jsx` | esiste |
| `/relations/prospects` | `pages/relations/ProspectsPage.jsx` | esiste |
| `/relations/accounts` | (placeholder) | esiste |
| Lead detail form | `LeadFormPage.jsx` | esiste |

→ La UI **suggerisce** già un lifecycle 3-stage (leads · prospects · accounts) ma il codice backend tratta tutto come "auto-promosso a qualified".

---

## §2 · GAP rispetto al modello canonico

| Concetto target | Stato | Severità |
|---|---|---|
| Lead arriva grezzo (status='new') senza journey | 🔴 attualmente Begin Journey auto-promuove a qualified | ALTA |
| Discovery Interview™ esplicita | 🔴 inesistente come step gating | ALTA |
| Prospect = qualified lead | 🟡 il sistema usa `status='qualified'` ma senza un endpoint esplicito di promozione | MEDIA |
| Promozione Prospect → Account = signed proposal | 🟡 esiste `accounts.lifecycle_stage` ma transizione manuale | MEDIA |
| Journey lega account, non lead | 🟢 design_journeys.account_id corretto | OK |
| `leads.first_journey_id` esiste ma viola il modello | 🔴 dovrebbe essere rimosso o usato solo per audit | MEDIA |
| Lead può vivere SENZA mai diventare journey | 🔴 oggi impossibile dal flusso public | ALTA |
| Discovery può chiudersi UNQUALIFIED | 🔴 nessun supporto | MEDIA |

---

## §3 · Modello canonico — STATI ESPLICITI

### 3.1 · `leads.status` enum target
```
new                    -- appena arrivato (form, manual, import)
in_discovery           -- discovery iniziata
qualified              -- promosso a prospect
unqualified            -- discovery chiusa senza qualifica
recycled               -- ritentare in futuro
archived               -- definitivamente chiuso
```

### 3.2 · Flow di transizione
```
NEW
  ├→ start_discovery() → IN_DISCOVERY
  │     ├→ qualify()    → QUALIFIED  → diventa Prospect (accounts.lifecycle_stage='prospect')
  │     ├→ disqualify() → UNQUALIFIED
  │     └→ recycle()    → RECYCLED
  └→ archive()          → ARCHIVED
```

### 3.3 · `accounts.lifecycle_stage` enum target
```
prospect               -- lead qualificato in attesa di proposta
in_proposal            -- proposta inviata
customer               -- proposta firmata → cliente
churned                -- cliente chiuso
on_hold                -- pausato
```

### 3.4 · Regole CRM canon

| Regola | Enforcement |
|---|---|
| Lead NON può avere `design_journey_id` collegato direttamente | nessun FK; sempre via account |
| Solo Prospect e Account possono avere journey | `design_journeys.account_id NOT NULL` + `accounts.lifecycle_stage IN ('prospect','customer',...)` |
| Una Discovery deve esistere come record prima di qualificare | nuova tabella `discovery_interviews` |
| Account non-customer (prospect) può avere journey | sì, è la fase pre-firma |

---

## §4 · Tabella proposta: `discovery_interviews`

```sql
discovery_interviews
─────────────────────────────────────────────────
id                  uuid PK
tenant_id           uuid NOT NULL
lead_id             uuid NOT NULL → leads.id
status              text -- pending, in_progress, qualified, unqualified
started_at          timestamptz
completed_at        timestamptz
conducted_by        uuid → users_profile.id
notes               text
qualification_signals jsonb -- {budget, timeline, fit_score, ...}
disqualification_reason text
recording_url       text  -- voice journey link
metadata_json       jsonb DEFAULT '{}'
created_at, updated_at
```

**Nota:** può essere visto come una "feature toggle" del flow corrente — l'attuale Begin Journey public può semplicemente creare anche una `discovery_interviews` con `status='qualified'` (perché il form pubblico contiene già le info di qualifica). Per Lead manuali, la Discovery resta `pending` finché un team member non la apre.

---

## §5 · CTA Nuova Relazione (vedi spec dettagliata in §8)

Decisione approvata:
- ➕ **+ Nuova Relazione** apre una modale a 3 scelte:
  - **A. Nuovo Lead** → crea `lead` `status='new'` → apre `discovery_interviews` `status='pending'`
  - **B. Prospect esistente** → seleziona da lista `accounts.lifecycle_stage='prospect'` → apre nuova Journey
  - **C. Cliente esistente** → seleziona da lista `accounts.lifecycle_stage='customer'` → apre nuova Journey

**Mai più**: bottone diretto "Nuova Journey" che chiede di scegliere lead.

---

## §6 · Endpoint da definire (per future impl)

| Verb | Path | Scope |
|---|---|---|
| `POST` | `/api/leads` | crea lead manuale (status='new') |
| `POST` | `/api/leads/{lid}/start-discovery` | apre `discovery_interviews` `status='in_progress'` |
| `POST` | `/api/leads/{lid}/qualify` | promuove a prospect → crea `account.lifecycle_stage='prospect'`, archivia `discovery` con `status='qualified'`, NO journey |
| `POST` | `/api/leads/{lid}/disqualify` | chiude lead `status='unqualified'`, archivia discovery con motivo |
| `POST` | `/api/accounts/{aid}/journeys` | apre Journey su prospect/customer (gated: solo se lifecycle_stage valido) |
| `POST` | `/api/accounts/{aid}/convert-to-customer` | promuove prospect → customer (linked a signed proposal) |

---

## §7 · Migration strategy (per future iterations)

### Step 1 · Soft deprecation
- Aggiungere `leads.status` valori target via `ALTER TYPE lead_status ADD VALUE`
- Aggiungere `accounts.lifecycle_stage` enum normalizzato
- Lasciare `leads.first_journey_id` (deprecated, audit-only)

### Step 2 · Discovery table
- Migration `discovery_interviews`
- Backfill: ogni lead `status='qualified'` esistente → discovery row con `status='qualified', completed_at=lead.intake_completed_at`

### Step 3 · Refactor `journey_initiate.py`
- Public Begin Journey → ancora crea lead + account + journey, MA crea anche `discovery_interviews(status='qualified')` esplicito
- Aggiungere check applicativo: rifiuta journey su lead `status NOT IN (qualified, in_discovery)`

### Step 4 · Endpoint manuali
- CRUD su leads, discoveries, accounts come da §6

### Step 5 · UI refactor
- Modal "Nuova Relazione" (vedi §8 spec)
- Disabilita "Open Journey" direttamente sui lead non qualificati

---

## §8 · CTA + Modal spec dettagliata

### 8.1 · Surface placement
Bottone visibile in:
- `/relations/*` topbar
- `/dashboard` cockpit (Quick Actions card)
- Sidebar primary CTA

Label: **+ Nuova Relazione** (NON più "Begin Journey", NON più "Nuova Journey").

### 8.2 · Modal layout

```
┌──────────────────────────────────────────┐
│  + Nuova Relazione                   [X] │
├──────────────────────────────────────────┤
│                                          │
│  Come vuoi iniziare?                     │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 🌱 Nuovo Lead                       │  │
│  │ Un contatto fresco da qualificare.  │  │
│  │ Apriremo una Discovery Interview.   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 🌿 Prospect esistente               │  │
│  │ Apri una nuova Journey per un       │  │
│  │ contatto già qualificato.           │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 🌳 Cliente esistente                │  │
│  │ Apri una nuova Journey per un       │  │
│  │ cliente confermato.                 │  │
│  └────────────────────────────────────┘  │
│                                          │
└──────────────────────────────────────────┘
```

### 8.3 · Behaviour decisionale

| Scelta | Backend call | Resulting state | Next surface |
|---|---|---|---|
| **A. Nuovo Lead** | `POST /api/leads` `{first_name, email, ...}` | `lead.status='new'` + `discovery_interviews(status='pending')` row | navigate to `LeadFormPage` with discovery panel |
| **B. Prospect** | `POST /api/accounts/{aid}/journeys` body `{account_id}` | new `design_journey` + `design_journey_assignment(owner)` | navigate to journey workspace |
| **C. Customer** | idem ma `aid` = account `lifecycle_stage='customer'` | idem | idem |

### 8.4 · Validation rules
- Choice A: email mandatory + first_name mandatory.
- Choice B: account must be `lifecycle_stage IN ('prospect','in_proposal')`.
- Choice C: account must be `lifecycle_stage='customer'`.
- Never allow direct "open journey from lead" (would skip Discovery).

---

## §9 · Conseguenze su sistemi esistenti

| Sistema | Conseguenza |
|---|---|
| Begin Journey public form | Aggiunge `discovery_interviews(status='qualified')` esplicito (no behavioural change esterno) |
| `human_assignments` | Resta come è. Assegnato a livello account/cliente |
| `design_journey_assignments` (ITER178) | Resta come è. Si applica solo a journey, e journey arriva solo via §5 |
| `leads.first_journey_id` | Deprecated, audit-only (NO UI use) |
| AssignedClientsPanel | Continua a funzionare; legge da `human_assignments` o `design_journey_assignments` |
| Magic-link client | Continua a funzionare; lega all'account, non al lead |

---

## §10 · Stato vs Target — Sintesi

| Asse | Stato | Target | Effort to converge |
|---|---|---|---|
| Lead grezzo possibile | 🔴 (oggi auto-qualified) | 🟢 | 0.5g (endpoint + UI) |
| Discovery esplicita | 🔴 mancante | 🟢 | 1g (table + endpoint) |
| Prospect-stage | 🟡 esiste come stringa | 🟢 (enum normalizzato) | 0.5g (migration) |
| Account = customer firmato | 🟡 stringa libera | 🟢 (enum normalizzato) | 0.5g (migration) |
| CTA modal "Nuova Relazione" | 🔴 inesistente | 🟢 | 1g (UI + wire) |
| Lead senza journey | 🔴 impossibile via public | 🟢 | 0.5g (endpoint manual) |
| Reportistica funnel | 🟡 parziale (funnel_events) | 🟢 (dashboard CRM) | 1g (vista aggregata) |

**Totale convergenza minima:** ~5 giorni.

---

## §11 · Vincoli di canon (immutabili)

| # | Regola | Enforcement |
|---|---|---|
| 1 | **Lead → mai journey direttamente** | rifiuto applicativo |
| 2 | **Discovery → step obbligatorio prima di qualifica** | `discovery_interviews` non-null FK su qualification |
| 3 | **Prospect = qualified lead** | `account.lifecycle_stage='prospect'` + `lead.status='qualified'` |
| 4 | **Account = customer firmato OR prospect** | enum normalizzato `accounts.lifecycle_stage` |
| 5 | **Journey lega account_id** | `design_journeys.account_id NOT NULL` (già OK) |
| 6 | **Nuova Relazione = 3-way modal** | mai più bottone diretto "Nuova Journey" |
| 7 | **`leads.first_journey_id` deprecated** | leggi-only, audit-only |
