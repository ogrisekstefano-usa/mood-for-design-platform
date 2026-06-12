# 02_LIFECYCLE_CONSOLIDATION_PLAN.md
# MOOD for DESIGN™ — Piano Architetturale Consolidamento Lifecycle
> Versione: 1.0 — Basata su audit runtime 2026-06-11
> Stato: DRAFT — Solo piano, zero implementazione
> Input: Dati reali tabella ogriusa@gmail.com / Stefano Ogrisek

---

## PREMESSA: Dati di riferimento dell'audit

Il piano è fondato esclusivamente sui dati reali estratti durante l'indagine runtime. Ogni scelta architetturale è motivata da evidenze concrete, non da ipotesi.

**Soggetto di riferimento:** ogriusa@gmail.com (Stefano Ogrisek)

**Stato attuale rilevato:**

| Entità | Istanze | Stato |
|--------|---------|-------|
| auth.users | 1 | Unico ✅ |
| users_profile (client) | 1 | Unico ✅ |
| accounts | **3** | Duplicati ❌ |
| leads | **3** + 1 orfano | Duplicati ❌ |
| design_journeys | **3** | Duplicati, tutti `conversation_open` ❌ |
| projects | 3 (1 con client_user_id=NULL) | Corrotti parzialmente ❌ |
| relationship_threads | 3 (1 con lead=NULL) | Orfani parziali ⚠️ |

---

## SEZIONE 1 — SOURCE OF TRUTH DECISION

### Opzione A: `accounts.lifecycle_stage` come SSoT

**Vantaggi:**
- `accounts` esiste per tutti i soggetti (lead, prospect, cliente attivo)
- È già il punto di join per moodboards, proposals, memories
- `AccountsPage` legge già da `accounts.lifecycle_stage`
- Più stabile: non dipende dall'esistenza di un journey attivo

**Svantaggi:**
- `accounts` viene creato in 3 path diversi con logiche divergenti:
  - `journey_initiate.py` → `lifecycle_stage='prospect'`
  - `lead_conversion.py` → `lifecycle_stage='active'`
  - `leads.py/fast-capture` → nessun account (lead orfano)
- Non porta informazione progettuale (fase del design: brief / concept / approval)
- Due valori diversi coesistono per lo stesso soggetto (`prospect` + `active`) senza conflitto rilevato
- Non modella il concetto di "Nuovo Journey per lo stesso cliente"

**Impatto sul codice:**
- `AccountsPage`, `ProspectsPage`: già allineate — impatto minimo
- `design_journeys`: dovrebbe sincronizzarsi su `accounts.lifecycle_stage` → logica di propagazione da aggiungere
- `leads`: `pipeline_stage` diventerebbe derivato — possibile de-sync se non scritto in modo atomico

**Impatto sul CRM:** Basso. Il CRM già legge `accounts`.

**Impatto sui Journey:** Alto. I journey diventerebbero "figli" dell'account senza propria logica di stato.

---

### Opzione B: `design_journeys.lifecycle_state` come SSoT

**Vantaggi:**
- Già dichiarato SSoT nella documentazione del prodotto (`LIFECYCLE_SOURCE_OF_TRUTH_AUDIT.md`)
- Modella con precisione la fase progettuale: `conversation_open → brief_active → concept_shared → approved → closed`
- Permette a un cliente di avere N journey indipendenti con stati diversi
- È la tabella più ricca di contesto (milestone, eventi, capitoli)
- `JourneyOperatingPage` già legge da `design_journeys`

**Svantaggi:**
- **Critico:** Nella realtà osservata, `lifecycle_state` non avanza mai. Tutti e 3 i journey sono stuck su `conversation_open`.
- Non tutti i soggetti hanno un journey (es: lead orfano `cbfc996b` da showroom)
- La fase CRM (lead / prospect) non è mappata nei valori `lifecycle_state` attuali
- Richiede che ogni avanzamento CRM scriva anche su `design_journeys`

**Impatto sul codice:**
- `AccountsPage`, `ProspectsPage`: già enrichite con `design_journeys.lifecycle_state` via join — impatto basso
- `lead_conversion.py`, `journey_initiate.py`: devono propagare avanzamenti
- `leads.pipeline_stage`: diventa segnale di ingresso, non stato canonico

**Impatto sul CRM:** Medio. Le viste CRM devono leggere da `design_journeys` via join con `accounts`.

**Impatto sui Journey:** Basso. È già la tabella usata da `JourneyOperatingPage`.

---

### Raccomandazione finale

**SSoT: `design_journeys.lifecycle_state`** con regola di esistenza chiara.

**Motivazione basata sui dati reali:**

1. Un `account` può esistere senza journey (lead orfano showroom `cbfc996b`). In quel caso `accounts.lifecycle_stage` è l'unico stato disponibile e rimane valido come **stato CRM di ingresso** (`lead`, `prospect`).

2. Appena un journey esiste, `design_journeys.lifecycle_state` diventa lo stato progettuale canonico. Il CRM deve leggere questo valore via join.

3. I due sistemi non sono in conflitto — sono **sequenziali**, non paralleli:
   - `accounts.lifecycle_stage` governa la fase CRM pre-journey (`lead → prospect → active`)
   - `design_journeys.lifecycle_state` governa la fase progettuale post-journey (`conversation_open → ... → certified_closure`)

**Regola architetturale risultante:**

```
SOGGETTO SENZA JOURNEY:
  SSoT = accounts.lifecycle_stage
  Valori: lead | prospect

SOGGETTO CON JOURNEY:
  SSoT = design_journeys.lifecycle_state
  Valori: conversation_open | brief_active | concept_shared | approved | closed
  accounts.lifecycle_stage viene aggiornato in modo derivato (non è la fonte)
```

**Conseguenza:** Il CRM non deve scegliere tra i due campi — deve consumarli in sequenza.

---

## SEZIONE 2 — IDENTITY MODEL TARGET

### Distinzione OPERATORS vs CUSTOMERS

```
OPERATORS (utenti interni allo studio)
────────────────────────────────────────
Ruoli:    super_admin | tenant_admin | project_manager | designer | advisor | sales
Tabelle:  auth.users → users_profile (role ∈ operators)
Join:     human_assignments (assignee_user_id → users_profile.id)
Nota:     NON devono mai comparire come soggetti CRM (leads, accounts)
          NON devono essere restituiti da _candidates_for() per ruoli cliente
          La condizione attuale (role NOT IN 'client') è insufficiente:
          include super_admin → assegnato come referente cliente


CUSTOMERS (soggetti relazionali)
─────────────────────────────────
Stato          Tabella primaria     Tabella di stato        Auth
─────────────────────────────────────────────────────────────────
Lead           leads                leads.pipeline_stage    NO
Prospect       accounts             accounts.lifecycle_stage NO
Active Client  accounts             design_journeys.lifecycle_state SI (users_profile role=client)
Returning      accounts             design_journeys (closed+new)  SI
```

### Diagramma target: Identity Chain

```
INGRESSO (prima del journey)
──────────────────────────────────────────────────────

[Fast Capture Showroom]          [Begin Journey Form]
       ↓                                ↓
  leads (orfano)             accounts + contacts + leads
  pipeline_stage=lead_captured    pipeline_stage=prospect_initial_brief
  NO auth.user               NO auth.user (ancora)
       ↓                                ↓
  [Discovery Interview]         [Auto-provisioning]
       ↓                                ↓
  Qualification                auth.users + users_profile(client)
       ↓                                ↓
  [Promote to Account]         magic_link_url → client accede
  accounts + design_journey          ↓
                              design_journeys.lifecycle_state


STRUTTURA STABILE (dopo il journey)
──────────────────────────────────────────────────────

users_profile (role=client)
  │ auth_user_id → auth.users
  │ tenant_id
  │
  ├── accounts (1 per soggetto per tenant)
  │     │ lifecycle_stage (CRM pre-journey)
  │     │ legacy_lead_id → leads (1 lead originale)
  │     │
  │     ├── contacts (1+ per account)
  │     │
  │     ├── design_journeys (1+ per account)
  │     │     │ lifecycle_state (SSoT progettuale)
  │     │     │ project_id → projects
  │     │     │               └── client_user_id → users_profile
  │     │     │
  │     │     └── relationship_threads
  │     │           └── relationship_messages
  │     │
  │     └── human_assignments (referente assegnato)
  │
  └── leads (storico — non modificati dopo la conversione)
        pipeline_stage = storico di acquisizione


OPERATORS (separati, non CRM)
──────────────────────────────────────────────────────

users_profile (role ≠ client)
  │
  ├── human_assignments (assignee_user_id)
  │     → assegnati come referenti su accounts/users_profile
  │
  └── design_journey_assignments
        → owner/collaborator su journeys specifici
```

### Regola critica mancante (emersa dall'audit)

La funzione `_candidates_for(tenant_id, 'client')` attualmente restituisce tutti gli utenti `role != 'client'`. Questo include `super_admin`. La regola corretta deve essere:

```
Candidati validi per referente cliente:
  role IN ('designer', 'project_manager', 'advisor', 'sales')
  AND status = 'active'   # non 'invited'
  AND NOT su tutti i super_admin
```

Se nessun candidato è disponibile → non assegnare (NULL) invece di fallback a super_admin.

---

## SEZIONE 3 — EMAIL DEDUPLICATION STRATEGY

### Comportamento desiderato per `POST /journeys/initiate`

La logica di lookup deve avvenire PRIMA di qualsiasi insert, nell'ordine:

```
1. Cerca auth.users con questa email
2. Cerca users_profile con questa email + tenant_id + role='client'
3. Cerca accounts con questa email + tenant_id
4. Cerca leads con questa email + tenant_id
```

---

### CASO A — Stessa email, nessun journey aperto

**Situazione:** L'utente esiste in `leads` o `accounts` ma non ha `design_journeys` attivi.

**Comportamento desiderato:**

```
accounts:      RIUTILIZZA (aggiorna nome se cambiato)
contacts:      RIUTILIZZA (aggiorna se necessario)
leads:         CREA NUOVO (rappresenta il nuovo segnale di intento)
               con metadata_json.related_account_id → account esistente
design_journey: CREA NUOVO
project:        CREA NUOVO
auth.user:      RIUTILIZZA se esiste, CREA se non esiste
users_profile:  RIUTILIZZA se esiste
```

**Razionale:** Un account rappresenta il soggetto (persona reale). Un lead rappresenta un segnale di intento. Una nuova compilazione del form è un nuovo segnale, non un nuovo soggetto.

---

### CASO B — Stessa email, journey già aperto

**Situazione:** L'utente ha un `design_journey` con `lifecycle_state != 'closed'`.

**Comportamento desiderato:**

```
accounts:       RIUTILIZZA
contacts:       RIUTILIZZA
leads:          CREA NUOVO (con metadata_json.duplicate_signal=true)
design_journey: NON CREARE un nuovo journey automaticamente
                → Restituire nella response:
                  { "existing_journey_id": "...", "action": "resume" }
project:        NON CREARE
auth.user:      RIUTILIZZA
```

**Razionale:** Due journey aperti sullo stesso soggetto nello stesso tenant è un'anomalia, non un caso d'uso. Il sistema deve segnalarlo e lasciare la scelta all'operatore/sistema, non creare silenziosamente un duplicato.

**Response attesa:**
```json
{
  "action": "existing_journey_resumed",
  "journey_id": "<existing>",
  "account_id": "<existing>",
  "magic_link_url": "<nuovo link per journey esistente>",
  "is_new": false
}
```

---

### CASO C — Stessa email, più journey storici chiusi

**Situazione:** Il cliente ha già completato uno o più journey in passato.

**Comportamento desiderato:**

```
accounts:       RIUTILIZZA
contacts:       RIUTILIZZA
leads:          CREA NUOVO (nuovo segnale)
design_journey: CREA NUOVO (è un progetto differente, soggetto uguale)
project:        CREA NUOVO
auth.user:      RIUTILIZZA (account già provisionato)
```

**Razionale:** Un cliente che rientra per un nuovo progetto deve avere un nuovo journey. I journey chiusi rimangono come storico. Questo è il caso "Returning Client" ed è l'unico caso in cui un soggetto deve avere più journey.

---

### CASO D — Stessa email, utente già nel Client Portal

**Situazione:** `auth.users` esiste + `users_profile role='client'` esiste + `projects.client_user_id` punta al profilo.

**Comportamento desiderato:**

```
accounts:       RIUTILIZZA
contacts:       RIUTILIZZA
leads:          Valutare: se journey esistente attivo → CASO B
                           se journey chiuso/nessuno → CASO C
design_journey: Vedi CASO B o CASO C
auth.user:      RIUTILIZZA (NON richiamare _create_auth_user)
users_profile:  RIUTILIZZA (NON richiamare _ensure_profile con insert)
magic_link:     GENERA comunque (il cliente deve poter rientrare)
```

**Razionale:** `_ensure_profile` è già idempotente. Il problema è che `journey_initiate.py` crea l'account PRIMA di chiamare `provision_client_after_journey`, quindi la deduplication deve avvenire prima del blocco di insert, non solo dentro il provisioning service.

---

## SEZIONE 4 — DESIGN JOURNEY POLICY

### Domanda: un cliente può avere più journey?

**Risposta: SÌ — con condizioni esplicite.**

```
Cliente → Molti Journey    (1:N)
Journey → Un solo Cliente  (N:1)
```

**Politica:**

| Scenario | Nuovo Journey? | Note |
|----------|---------------|------|
| Nuova casa / nuovo immobile | ✅ SÌ | Journey separato, stesso account |
| Secondo showroom | ✅ SÌ | Stessa logica |
| Nuova ristrutturazione (diverso progetto) | ✅ SÌ | |
| Stesso progetto, submit duplicato | ❌ NO | Riprende quello esistente |
| Journey aperto non completato | ❌ NO | Riprende, non duplica |
| Journey chiuso da più di X giorni | ✅ SÌ | Con conferma esplicita |

**Invarianti:**
1. Un journey aperto per soggetto → nessun nuovo journey automatico
2. Un journey chiuso → nuovo journey permesso (Returning Client)
3. Il frontend non deve poter creare duplicati silenziosamente
4. `accounts.id` rimane unico per soggetto per tenant — NON si crea un nuovo account per ogni journey

**Struttura dati corretta:**

```
Account (1 per soggetto per tenant)
  ├── Design Journey 1 (Casa Milano · 2024 · closed)
  ├── Design Journey 2 (Ufficio Roma · 2025 · closed)
  └── Design Journey 3 (Villa Lago · 2026 · active)
```

Non:
```
Account 1 (Stef · prospect)  ← sbagliato
Account 2 (Stef Rientro · prospect)  ← sbagliato
Account 3 (Stef Rientro · active)  ← sbagliato
```

---

## SEZIONE 5 — LEAD CONVERSION POLICY

### Pulsante "Avvia Journey" — comportamento corretto

**Contesto:** Un operatore CRM vede un lead qualificato e vuole aprire un journey.

**Flow corretto:**

```
STEP 1: Verifica pre-journey
──────────────────────────────────────────────────────────────
  Input: lead.id
  
  Check A: Esiste già un design_journey per questo lead?
    → leads.metadata_json.journey_id
    → design_journeys WHERE account_id = (account collegato)
  
  Check B: Esiste un account per questo lead?
    → accounts WHERE legacy_lead_id = lead.id
       OR accounts WHERE email = lead.email AND tenant_id = lead.tenant_id


STEP 2: Branch decision
──────────────────────────────────────────────────────────────

  [Caso: journey esistente AND lifecycle_state != 'closed']
    → Non creare. Restituire:
      { "action": "resume", "journey_id": "<existing>" }
    → Frontend naviga a JourneyOperatingPage

  [Caso: journey esistente AND lifecycle_state = 'closed']  
    → Mostrare dialogo: "Aprire nuovo journey per questo cliente?"
    → Se confermato → STEP 3 con account esistente

  [Caso: nessun journey, account esistente]
    → STEP 3 con account esistente (NO nuovo account)

  [Caso: nessun journey, nessun account]
    → STEP 3 con creazione account


STEP 3: Creazione journey (solo se autorizzata da STEP 2)
──────────────────────────────────────────────────────────────
  CREA:   design_journey (con account_id esistente o nuovo)
  CREA:   project (nuovo per ogni journey)
  CREA:   milestones (10 default)
  SKIP:   account se già esiste
  SKIP:   leads (lead già esiste)
  SKIP:   contacts se già esiste
  CHIAMA: provision_client_after_journey() → magic link


STEP 4: Response
──────────────────────────────────────────────────────────────
  {
    "action": "created" | "resumed",
    "journey_id": "...",
    "account_id": "...",
    "is_new_account": false | true,
    "magic_link_url": "..."
  }
```

---

## SEZIONE 6 — ACCOUNT ↔ LEAD RELATIONSHIP

### Relazione attuale (problematica)

```
accounts.legacy_lead_id → leads.id   (nullable, presente solo in f30b3a34 via lead_conversion)
accounts.metadata_json.source_lead_id → leads.id   (non indicizzato, presente in f30b3a34)
leads.metadata_json.account_id → accounts.id   (presente in accounts creati da begin_journey)

AccountsPage.handleOpen(a) → setWelcomeId(a.id)   ← account.id
WelcomeDrawer → GET /api/relations/leads/{subjectId}/welcome   ← cerca leads.id
Risultato: 404 Lead not found
```

**Il problema è strutturale:** Non esiste un join canonico e bidirezionale tra `accounts` e `leads`. Le due tabelle si puntano l'una all'altra con meccanismi diversi e non consistenti.

---

### Relazione desiderata

**Regola: un account ha un lead di origine (il primo) e poi il lead non serve più come chiave.**

```
SCHEMA TARGET:
──────────────────────────────────────────────────────────────
accounts
  ├── id (PK)
  ├── email (UNIQUE per tenant)        ← chiave di lookup primaria
  ├── origin_lead_id → leads.id        ← nullable, solo il primo lead
  └── lifecycle_stage

leads
  ├── id (PK)
  ├── account_id → accounts.id         ← FK diretta (aggiunta in futuro)
  └── pipeline_stage (storico)
```

**Nota: `origin_lead_id` non è una nuova colonna — è il renaming semantico di `legacy_lead_id` già esistente.** Oggi `legacy_lead_id` è presente solo sull'account creato da `lead_conversion` (f30b3a34), non sugli account creati da `journey_initiate`. Questo è il gap.

---

### Come il frontend deve recuperare i dati dell'account senza assumere account.id == lead.id

**Per ogni operazione che oggi usa `account.id` come `lead_id`, applicare il seguente lookup:**

```
LOOKUP LEAD DA ACCOUNT:
──────────────────────────────────────────────────────────────
Step 1: accounts.origin_lead_id (origin_lead_id = legacy_lead_id)
  → se non null → usa questo lead.id

Step 2: leads WHERE metadata_json->>'account_id' = account.id
  → se trovato → usa questo lead.id

Step 3: leads WHERE email = account.email AND tenant_id = account.tenant_id
  ORDER BY created_at ASC LIMIT 1
  → se trovato → usa il primo lead cronologico

Step 4: nessun lead trovato → il soggetto non ha un lead
  → Non chiamare l'endpoint lead-based
  → Mostrare un profilo account-only
```

**Per le operazioni specifiche:**

| Operazione | Chiave corretta | Endpoint |
|-----------|-----------------|----------|
| WelcomeDrawer | lead_id (lookup sopra) | GET /api/relations/leads/{lead_id}/welcome |
| Thread / Atelier | thread.client_profile_id (users_profile.id) | GET /api/relations/threads |
| Journey | design_journeys.account_id | GET /api/journeys?account_id=... |
| Client Portal | projects.client_user_id (users_profile.id) | GET /api/client/journeys |

**Implicazione critica:** `WelcomeDrawer` non deve ricevere `account.id` come `subjectId`. Deve ricevere il `lead_id` risolto tramite il lookup sopra. Questo risolve il 404 senza cambiare lo schema.

---

## SEZIONE 7 — DATA CLEANUP STRATEGY (solo strategia, no esecuzione)

### Caso reale: ogriusa@gmail.com — consolidamento

**Obiettivo:** Da 3 accounts + 3 leads + 3 journeys → 1 account + storia leads + journey scelto come principale.

#### Step 1: Selezione record canonico

```
Account canonico: 2b11d6db (primo creato, 03:52)
  Motivo: ha la catena più completa (contacts ✅, lead ✅, thread ✅, project con client_user_id ✅)

Lead di origine: 5ca7f089 (collegato all'account canonico)
  → diventa accounts[2b11d6db].origin_lead_id

Journey principale: 7e8a45ae (collegato all'account canonico, thread active)
  → è il journey con cui il client si è autenticato (last_sign_in=2026-06-11)
```

#### Step 2: Gestione degli altri account (a398b7a1, f30b3a34)

```
Opzione A — Merge (raccomandato per cleanup):
  1. Sposta tutti i journey (e6604540, 3033ae75) su account canonico (2b11d6db)
     UPDATE design_journeys SET account_id='2b11d6db...' WHERE id IN (...)
  2. Sposta relationship_threads (a98ae0a4) su account canonico
  3. Aggiorna leads (f4e6ce97) metadata_json.account_id → '2b11d6db...'
  4. Segna accounts (a398b7a1, f30b3a34) come merged:
     UPDATE accounts SET lifecycle_stage='merged', metadata_json.merged_into='2b11d6db...'
  5. NON delete: mantieni per audit trail

Opzione B — Keep separati come journey distinti:
  Solo se i 3 journey rappresentano davvero 3 progetti diversi.
  In questo caso ogriusa ha compilato 3 volte per errore → non applicabile.
  Si applica solo se le date o i contenuti brief differiscono significativamente.
```

#### Step 3: Lead showroom orfano (cbfc996b)

```
Strategia: Collegare al soggetto canonico
  UPDATE leads SET metadata_json.account_id='2b11d6db...' WHERE id='cbfc996b...'
  
Questo lead (Stefano Ogrisek · showroom) precede cronologicamente tutti gli altri (03:37).
Rappresenta il primo segnale di intento. Va conservato e collegato.
```

#### Step 4: Account con project.client_user_id=NULL (f30b3a34 → project a3ed48e7)

```
Questo progetto è inaccessibile dal Client Portal.
Se viene conservato (Opzione B), eseguire:
  UPDATE projects SET client_user_id='07898723...' WHERE id='a3ed48e7...'
Se viene mergiato (Opzione A), il progetto diventa figlio dell'account canonico.
```

#### Stato post-cleanup atteso

```
users_profile[07898723 · client]
  └── accounts[2b11d6db · Stef · lifecycle=active]
        ├── origin_lead_id → leads[cbfc996b] (primo segnale · showroom)
        ├── leads[5ca7f089]  (begin_journey #1 · storia)
        ├── leads[f4e6ce97]  (begin_journey #2 · storia)
        ├── contacts[495ad979]
        │
        ├── design_journey[7e8a45ae · principale]
        │     └── relationship_thread[0b2ab0f5 · active]
        ├── design_journey[e6604540 · secondo]
        │     └── relationship_thread[a98ae0a4]
        └── design_journey[3033ae75 · terzo]
              └── (thread da creare o da ignorare)
```

---

## SEZIONE 8 — IMPLEMENTATION ROADMAP

### Dipendenze critiche

```
P0-A (deduplication) ← P0-B dipende da A
P0-B (lead lookup fix) ← indipendente da A, ma A deve arrivare prima in produzione
P0-C (lifecycle advancement) ← dipende da P0-A (se si creano ancora duplicati, il lifecycle non ha senso)
P1 (candidates_for fix) ← può andare in parallelo a P0
P2 (data cleanup reale) ← dipende da P0-A completato
```

---

### P0 — Blockers critici

#### P0-A: Email deduplication in `journey_initiate.py`

**Impatto:** Blocca la creazione di tutti i duplicati futuri.

```
File:    backend/routers/journey_initiate.py
Logica:  Prima dell'insert, eseguire:
  1. lookup auth.users per email
  2. lookup users_profile per email+tenant+role=client
  3. lookup accounts per email+tenant
  4. lookup design_journeys (journey aperto?)
  
Comportamento:
  - Journey aperto → return { action: "resume", journey_id: ... }
  - Account esiste ma nessun journey → CREA solo journey (riusa account)
  - Niente → CREA tutto (path attuale)

Prerequisito per: qualsiasi onboarding futuro, magic link, client portal
```

#### P0-B: Fix WelcomeDrawer — `account.id → lead_id` lookup

**Impatto:** Risolve il bug 404 "Lead not found" visibile oggi.

```
File:    frontend/src/pages/relations/AccountsPage.jsx
Modifica: handleOpen non passa a.id ma risolve il lead tramite:
  - a.legacy_lead_id (se presente)
  - OR backend resolve: GET /api/relations/accounts/{account_id}/lead-ref

File:    backend/routers/client_relations.py
Nuovo endpoint (opzionale): GET /api/relations/accounts/{id}/lead-ref
  Restituisce: { lead_id: "...", has_lead: bool }
  Lookup ordine: legacy_lead_id → metadata_json.source_lead_id → email match

Prerequisito per: funzionamento base CRM, apertura scheda account
```

#### P0-C: `design_journeys.lifecycle_state` deve avanzare

**Impatto:** Rende la SSoT dichiarata effettivamente funzionale.

```
Problema attuale: lifecycle_state è sempre 'conversation_open'
  Nessun trigger lo avanza quando milestones avanzano o quando client si autentica.

File:    backend/routers/journey_initiate.py
         backend/routers/lead_conversion.py
         backend/routers/journeys.py (milestone PATCH)

Mapping minimo da implementare:
  conversation_open → brief_active        (quando milestone brief = in_progress)
  brief_active      → concept_phase       (quando brief = approved)
  concept_phase     → client_review       (quando concept directions condivise)
  client_review     → approved            (quando cliente approva)
  approved          → closed              (certified_closure milestone = done)

Prerequisito per: JourneyOperatingPage corretta, CRM stats corretti, SSoT funzionale
```

---

### P1 — Stabilizzazioni importanti

#### P1-A: `_candidates_for()` — escludere super_admin e invited

```
File:    backend/core/human_assignment.py
Modifica: filtro candidati limitato a:
  role IN ('designer', 'project_manager', 'advisor', 'sales')
  AND status = 'active'
Se nessun candidato → assignee_user_id = NULL (no fallback a super_admin)
Impatto: Evita che admin@moodfordesign.com appaia come referente cliente
```

#### P1-B: `origin_lead_id` — backfill su accounts da begin_journey

```
File:    backend/routers/journey_initiate.py
Modifica: dopo la creazione del lead, aggiorna accounts.legacy_lead_id = lead.id
          (oggi non viene scritto per gli account da begin_journey, solo da lead_conversion)
Impatto: Rende il lookup P0-B affidabile per tutti i path
```

#### P1-C: `projects.client_user_id` — garantire che venga sempre scritto

```
File:    backend/services/client_provisioning.py
Situazione attuale: il link project→client_user_id viene fatto dentro provision_client_after_journey
                    ma se provisioning fallisce, client_user_id rimane NULL
Modifica: rendere il link critico (blocking), non fire-and-forget
Impatto: Evita journey inaccessibili dal Client Portal
```

#### P1-D: `lead_conversion.py` — check journey esistente prima di creare account

```
File:    backend/routers/lead_conversion.py
Modifica: prima di creare account, verificare se esiste già un account per questa email
          (oggi verifica solo legacy_lead_id, non email)
Impatto: Evita 3° tipo di duplicazione
```

---

### P2 — Cleanup dati storici e miglioramenti

#### P2-A: Data cleanup per soggetti con duplicati

```
Script one-time (da eseguire in staging prima di production):
  - Identifica soggetti con accounts multipli per stessa email+tenant
  - Propone merge (non esegue automaticamente)
  - Richiede approvazione operatore
  - Sposta journeys/threads/leads sul record canonico (il più vecchio)
  - Segna i duplicati come merged (non delete)
```

#### P2-B: `lead_conversion → journey_initiate` unificazione

```
I due path oggi producono strutture diverse e incomplete.
Target: un unico servizio JourneyCreationService che accetta:
  { email, first_name, last_name, account_id? (optional), lead_id? (optional) }
  e gestisce tutti i casi in modo idempotente.
```

#### P2-C: `relationship_thread` con lead=NULL

```
Situazione: thread fb166376 con lead_id=NULL
Risoluzione: al momento della creazione del thread, se lead_id non è disponibile,
             compilare retrospettivamente da account.origin_lead_id
```

---

### Ordine di esecuzione prima di riprendere feature

```
GATE per riprendere onboarding / magic link / client portal / atelier:

  ✅ P0-A completato (nessun nuovo duplicato viene creato)
  ✅ P0-B completato (CRM funziona senza 404)

GATE per riprendere nuove feature:

  ✅ P0-A + P0-B + P0-C completati (lifecycle SSoT funzionale)
  ✅ P1-A + P1-B completati (candidates e lead linkage corretti)

GATE per riprendere data cleanup produzione:

  ✅ P2-A eseguito in staging, verificato, poi in produzione
```

---

## APPENDICE — Tabella recap errori di design attuali

| # | Componente | Errore | Impatto |
|---|-----------|--------|---------|
| E1 | `journey_initiate.py` | Nessun check email esistente | Duplica account/lead/journey per ogni submit |
| E2 | `AccountsPage.handleOpen` | Passa `account.id` come `lead_id` | 404 su ogni apertura scheda account |
| E3 | `_candidates_for()` | Include super_admin come candidato | Admin appare come referente cliente |
| E4 | `lead_conversion.py` | Crea nuovo account senza check email | Terza catena duplicata (lifecycle=active) |
| E5 | `journey_initiate.py` | Non scrive `legacy_lead_id` sull'account | Lookup lead→account unidirezionale |
| E6 | `lifecycle_state` | Non avanza mai da conversation_open | SSoT dichiarata inutilizzabile |
| E7 | `provision_client_after_journey` | Chiamata non-blocking per client_user_id | Projects con client_user_id=NULL → Client Portal cieco |
| E8 | `relationship_thread` | Creato con lead_id=NULL in alcuni path | Thread orfani, Atelier inaccessibile |

---

*Fine documento · 02_LIFECYCLE_CONSOLIDATION_PLAN.md*
*Versione 1.0 — Basata esclusivamente su dati reali del database*
*Nessun codice implementato. Nessuna migration eseguita.*
