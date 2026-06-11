# CLIENT_MODEL_CONSOLIDATION_FINAL.md
**Versione:** 1.0 — FINALE  
**Data:** 11 giugno 2026  
**Sprint:** Client Model Consolidation  
**Input:** `MODEL_CONSISTENCY_REPORT.md`, `CORE_FLOW_CERTIFICATION_REPORT.md`  
**Status:** DOCUMENTO DI INDIRIZZO — nessun codice, nessuna implementazione

---

## DOMANDA DI PARTENZA

> *Se oggi eliminassimo Lead, Prospect, Qualification e Client Profile e mantenessimo soltanto DESIGN JOURNEY — quali dati andrebbero persi?*

**Risposta breve:** Quasi nessun dato sostanziale. Ma perderemmo la **storia di come il cliente è arrivato** e il **tracciamento delle transizioni di stato** prima della Journey.

**Risposta lunga:** il problema non è quali dati si perdono — è che il modello attuale ha un **God Object**: la tabella `leads` che contiene 43 campi e cerca di essere identità, CRM, qualifica, brief, AI signal e journey pointer nello stesso record.

---

## TASK 1 — MAPPA COMPLETA DEI DATI

### 1.1 Entità esistenti nel modello cliente (mappa completa)

```
auth.users (Supabase)
  └── users_profile (role, nome, email, locale_code, tenant_id)

accounts (identity commerciale: nome, tipo, lifecycle_stage, email, source)
  └── contacts (first_name, last_name, email, phone — primary_contact)

leads [GOD OBJECT - 43 campi]
  ├── Identità:        first_name, last_name, email, phone, country, city
  ├── CRM:             source, lead_type, status, score, pipeline_stage
  ├── Qualifica:       project_type, budget_range, timeline, style_preference
  ├── B2B:             company_name, professional_category, market_sector, portfolio_url
  ├── AI/ML:           behavioral_tags, ai_tags, atmosphere_signals, material_signals
  ├── Cultural:        cultural_register, luxury_perception_tier
  ├── Intake:          closed_answers, narrative_seed, intake_version
  ├── Progressione:    progression_state, progression_score, relationship_temperature
  └── Linking:         first_journey_id, client_user_id, designer_assigned

projects (title, status, project_type, budget_range, timeline, metadata_json)
  └── design_journeys (lifecycle_state, overall_status, current_milestone_id)
        └── journey_briefs (closed_answers: atmosphere + lifestyle + welcome)
        └── journey_milestones (7 fasi: Discover, Inspire, Curate, Specify, Approve, Deliver, Celebrate)

discovery_interviews (status, qualification_signals, source, lead_id)
funnel_events (stage, event_name, lead_id)
conversation_threads (unread_for_designer, unread_for_client, last_message_at)
```

---

### 1.2 Dati raccolti per percorso

#### Percorso A: Begin Journey (pubblico)

| Campo raccolto | Dove salvato | Tabella |
|----------------|-------------|---------|
| first_name | leads + contacts + accounts (nome) | 3 tabelle |
| last_name | leads + contacts | 2 tabelle |
| email | leads + contacts + accounts | 3 tabelle |
| phone | leads + contacts + accounts | 3 tabelle |
| space_type | projects.metadata_json.atmosphere | projects |
| how_to_feel | projects.metadata_json.atmosphere | projects |
| references | projects.metadata_json.atmosphere | projects |
| guests | projects.metadata_json.lifestyle | projects |
| materials | projects.metadata_json.lifestyle | projects |
| ambiance | projects.metadata_json.lifestyle | projects |
| — tutti i precedenti anche in — | journey_briefs.closed_answers | journey_briefs |
| source | leads.source = `begin_journey_ritual` | leads |
| onboarding_path | leads.onboarding_path = `begin_journey` | leads |
| utm_source / medium / campaign | leads.runtime_identity (JSONB) | leads |
| pipeline_stage | leads.pipeline_stage = `prospect_initial_brief` | leads |
| **project_type** | **NON RACCOLTO** | — |
| **budget_range** | **NON RACCOLTO** | — |
| **timeline** | **NON RACCOLTO** | — |

#### Percorso B: Fast Lead Capture (admin CRM)

| Campo raccolto | Dove salvato | Tabella |
|----------------|-------------|---------|
| first_name, last_name | leads | leads |
| email | leads | leads |
| phone | leads | leads |
| source | leads.source (enum: showroom, email, ...) | leads |
| **project_type** | leads.project_type (via Qualification) | leads |
| **timeline** | leads.timeline (via Qualification) | leads |
| space_status | — (non salvato nel DB!) | — |
| interest/proposal | — (non salvato nel DB!) | — |
| atmosphere | **NON RACCOLTO** | — |
| lifestyle | **NON RACCOLTO** | — |
| discovery_interviews | creato con status=pending | discovery_interviews |

#### Percorso C: Qualification Modal (POST /api/leads/:id/qualify)

| Campo raccolto | Dove salvato | Tabella |
|----------------|-------------|---------|
| project_type[] | leads.project_type (comma-separated string) | leads |
| space_status | **NON SALVATO** (solo usato per display, non persiste) | — |
| timeline | leads.timeline | leads |
| interest/proposal | **NON SALVATO** | — |

> **Scoperta critica:** `space_status` e `interest` vengono raccolti dal Qualification Modal ma NON vengono scritti nel DB. Vengono usati localmente per condizionare la CTA (`canNext`) ma il dato sparisce al submit.

---

## TASK 2 — TABELLA DATA FIELD / SOURCE / USED BY / DUPLICATED / CANONICAL OWNER

| DATA FIELD | SOURCE | USED BY | DUPLICATED | CANONICAL OWNER |
|-----------|--------|---------|-----------|-----------------|
| `first_name` | BeginJourney, FastCapture | CRM display, Thread label, Journey title | ✓ `leads` + `contacts` + `accounts.account_name` | **`contacts.first_name`** |
| `last_name` | BeginJourney, FastCapture | CRM display, Journey title | ✓ `leads` + `contacts` | **`contacts.last_name`** |
| `email` | BeginJourney, FastCapture | Auth, CRM, Thread, Email | ✓ `leads` + `contacts` + `accounts` + `users_profile` | **`users_profile.email`** (post-provisioning), **`leads.email`** (pre-auth) |
| `phone` | BeginJourney, FastCapture | CRM display | ✓ `leads` + `contacts` + `accounts` | **`contacts.phone`** |
| `source` | BeginJourney, FastCapture | CRM analytics, funnel | ✗ (unica) | `leads.source` |
| `onboarding_path` | BeginJourney | Funnel analytics | ✗ | `leads.onboarding_path` |
| `utm_source/medium/campaign` | BeginJourney | Acquisition analytics | ✗ | `leads.runtime_identity` (JSONB) |
| `pipeline_stage` | Auto-computed | CRM pipeline view | ✓ `leads.pipeline_stage` + `leads.status` | **CONFLITTO: due campi che descrivono la stessa progressione** |
| `score` | Nessuno | MAI usato | ✗ | — (sempre 0) |
| `project_type` | Qualification Modal, FastCapture | Journey workspace (PROJECT TYPE) | ✓ `leads.project_type` + `projects.project_type` (se propagato) | **`projects.project_type`** (canonical) |
| `timeline` | Qualification Modal | Journey workspace (TIMELINE) | ✓ `leads.timeline` + `projects` | **`projects.timeline`** (canonical) |
| `budget_range` | **MAI RACCOLTO** | — | — | — |
| `space_status` | Qualification Modal | **NON SALVATO** | — | — (dato fantasma) |
| `interest` | Qualification Modal | **NON SALVATO** | — | — (dato fantasma) |
| `space_type` | BeginJourney Step 1 | Solo testo narrativo | ✓ `projects.metadata_json.atmosphere` + `journey_briefs.closed_answers` | **`journey_briefs.closed_answers`** |
| `how_to_feel` | BeginJourney Step 1 | Solo testo narrativo | ✓ idem | **`journey_briefs.closed_answers`** |
| `references` | BeginJourney Step 1 | **NON USATO** (solo nel brief testo) | ✓ idem | **`journey_briefs.closed_answers`** |
| `guests` | BeginJourney Step 2 | **NON USATO** | ✓ idem | **`journey_briefs.closed_answers`** |
| `materials` | BeginJourney Step 2 | **NON USATO** | ✓ idem | **`journey_briefs.closed_answers`** |
| `ambiance` | BeginJourney Step 2 | **NON USATO** | ✓ idem | **`journey_briefs.closed_answers`** |
| `atmosphere_signals` | leads.atmosphere_signals | **MAI POPOLATO** (sempre NULL) | ✗ | — (campo fantasma) |
| `behavioral_tags` | leads.behavioral_tags | **MAI POPOLATO** | ✗ | — (campo fantasma) |
| `ai_tags` | leads.ai_tags | **MAI POPOLATO** | ✗ | — (campo fantasma) |
| `cultural_register` | leads.cultural_register | **MAI POPOLATO** | ✗ | — |
| `luxury_perception_tier` | leads.luxury_perception_tier | **MAI POPOLATO** | ✗ | — |
| `progression_score` | leads.progression_score | **MAI USATO** | ✗ | — |
| `narrative_seed` | leads.narrative_seed | **MAI POPOLATO** | ✗ | — |
| `relationship_temperature` | leads.relationship_temperature | **MAI POPOLATO** | ✗ | — |
| `intake_version` | journey_initiate | Tracciamento versione | ✗ | `journey_briefs.intake_version` |
| `professional_category` | FastCapture B2B | B2B CRM | ✗ | `leads.professional_category` |
| `company_name` | FastCapture B2B | B2B CRM | ✗ | `leads.company_name` |
| `lifecycle_state` | Auto | Journey Workspace (STATUS) | ✓ `design_journeys.lifecycle_state` + `leads.status` | **`design_journeys.lifecycle_state`** (canonical) |
| `unread_for_designer` | conversation_threads | Badge notifiche | ✓ `conversation_threads` + `/api/notifications` (MA DESINCRONIZZATI) | **`conversation_threads.unread_for_designer`** |
| `designer_assigned` | leads.designer_assigned | CRM display | ✓ `leads.designer_assigned` + `design_journey_assignments.owner` | **`design_journey_assignments`** (canonical) |

---

## TASK 3 — DATI DUPLICATI, MAI USATI, INCOERENTI

### 3.1 Dati DUPLICATI (stesso dato in entità diverse)

| Dato | Tabelle che lo contengono | Rischio concreto |
|------|--------------------------|-----------------|
| Nome completo | `leads.first_name+last_name` · `contacts.first_name+last_name` · `accounts.account_name` | Se uno cambia, gli altri non si aggiornano |
| Email | `leads.email` · `contacts.email` · `accounts.email` · `users_profile.email` | 4 copie — sincronizzazione non garantita |
| Phone | `leads.phone` · `contacts.phone` · `accounts.phone` | 3 copie |
| Stato lifecycle | `leads.status` / `leads.pipeline_stage` · `design_journeys.lifecycle_state` | Semantica diversa, non mappati sistematicamente |
| Dati atmosferici | `projects.metadata_json.atmosphere` · `journey_briefs.closed_answers.atmosphere` | 2 copie dello stesso JSON |
| Designer assegnato | `leads.designer_assigned` · `design_journey_assignments.owner` | 2 sistemi paralleli |
| Project type | `leads.project_type` · `projects.project_type` | Propagazione manuale, può divergere |

### 3.2 Dati MAI USATI (presenti nel modello, sempre NULL o non letti)

| Campo | Tabella | Note |
|-------|---------|------|
| `score` | `leads` | Sempre 0. Nessun algoritmo di scoring implementato. |
| `atmosphere_signals` | `leads` | Sempre NULL. Previsto per AI ma mai popolato. |
| `material_signals` | `leads` | Sempre NULL. Idem. |
| `behavioral_tags` | `leads` | Sempre NULL. |
| `ai_tags` | `leads` | Sempre NULL. |
| `cultural_register` | `leads` | Sempre NULL. |
| `luxury_perception_tier` | `leads` | Sempre NULL. |
| `progression_score` | `leads` | Sempre NULL. |
| `narrative_seed` | `leads` | Sempre NULL. |
| `relationship_temperature` | `leads` | Sempre NULL. |
| `space_status` | Qualification Modal | Raccolto nel form, mai scritto nel DB. |
| `interest` (proposal) | Qualification Modal | Raccolto nel form, mai scritto nel DB. |
| `budget_range` | `leads`, `projects` | Mai raccolto in nessun percorso. Sempre NULL. |
| `style_preference` | `leads` | Mai raccolto. |
| `references` | `journey_briefs.closed_answers` | Salvato nel testo narrativo, mai letto strutturalmente. |

### 3.3 Dati INCOERENTI (stesso concetto, rappresentazione diversa)

| Concetto | Versione A | Versione B | Problema |
|---------|-----------|-----------|---------|
| Tipo progetto | `leads.project_type` = `"Kitchen"` (string inglese) | `projects.project_type` = `"Kitchen"` (propagato) | Label in inglese, non localizzata |
| Timeline | `leads.timeline` = `"1-3m"` (codice interno) | `projects.timeline` = `"1-3m"` (idem) | Non localizzata — mostrata come "1-3m" nel workspace |
| Materiali | Embedded in `journey_briefs.closed_answers.lifestyle.materials` (lista) | Embedded in brief narrativo come stringa | Non queryabile, non usato per raccomandazioni |
| Status percorso | `leads.status` ∈ {new, qualified, prospect, ...} | `design_journeys.lifecycle_state` ∈ {conversation_open, ...} | Due stati separati, non mappati uno-a-uno |
| Unread count | `conversation_threads.unread_for_designer` = 1 | `/api/notifications` = [] (vuoto) | I due sistemi sono disconnessi |

---

## TASK 4 — PROPOSED CLIENT SOURCE OF TRUTH

### Principio fondamentale

> **Il Design Journey È il cliente. Non contiene il cliente — è il cliente.**

Tutto ciò che sappiamo di un cliente esiste in relazione alla sua Journey. Non esiste un "cliente" astratto separato dal suo percorso progettuale.

### Struttura proposta (solo tabelle esistenti, nessuna nuova entità)

```
┌─────────────────────────────────────────────────────────────────────┐
│  DESIGN JOURNEY  ←  LA FONTE DI VERITÀ PRIMARIA                     │
│  design_journeys.id = chiave di tutto                               │
│                                                                     │
│  IDENTITÀ (child: accounts + contacts)                              │
│  ─────────────────────────────────────                              │
│  contacts.first_name + last_name    ← CANONICAL per il nome         │
│  users_profile.email                ← CANONICAL per email (post-auth)│
│  leads.email                        ← CANONICAL pre-auth            │
│  contacts.phone                     ← CANONICAL per telefono        │
│                                                                     │
│  ACQUISIZIONE (child: leads — solo come audit log)                  │
│  ─────────────────────────────────────────────────                  │
│  leads.source                       ← da dove è arrivato            │
│  leads.runtime_identity             ← UTM, referer, UA              │
│  leads.onboarding_path              ← come è entrato                │
│  leads.created_at                   ← quando                        │
│                                                                     │
│  BRIEF ASPIRAZIONALE (child: journey_briefs)                        │
│  ───────────────────────────────────────────                        │
│  journey_briefs.closed_answers.atmosphere  ← spazio, atmosfera      │
│  journey_briefs.closed_answers.lifestyle   ← materiali, ospitalità  │
│                                                                     │
│  QUALIFICA OPERATIVA (child: projects)                              │
│  ─────────────────────────────────────                              │
│  projects.project_type              ← tipo di progetto              │
│  projects.timeline                  ← orizzonte temporale           │
│  projects.budget_range              ← budget (da raccogliere)       │
│                                                                     │
│  STATO PERCORSO (design_journeys stesso)                            │
│  ────────────────────────────────────────                           │
│  design_journeys.lifecycle_state    ← stato canonico                │
│  design_journeys.current_milestone_id ← dove siamo                  │
│                                                                     │
│  CONVERSAZIONE (child: conversation_threads)                        │
│  ────────────────────────────────────────────                       │
│  conversation_threads.unread_for_designer ← badge notifiche         │
│  conversation_threads.last_message_preview ← anteprima              │
└─────────────────────────────────────────────────────────────────────┘
```

### Regole di derivazione (senza nuove tabelle)

| Dato | Oggi (disperso) | Canonical Owner (proposta) | Come derivare gli altri |
|------|----------------|--------------------------|------------------------|
| Nome | `leads` + `contacts` + `accounts` | **`contacts.first_name + last_name`** | `accounts.account_name` = concat read-only |
| Email | 4 tabelle | **`users_profile.email`** (post-auth) / **`leads.email`** (pre-auth) | `contacts.email` = copia in sync |
| Stato | `leads.status` + `journey.lifecycle_state` | **`design_journeys.lifecycle_state`** | `leads.status` → deprecato, letto da journey |
| Qualifica | `leads.project_type` + `projects.project_type` | **`projects.project_type`** | `leads.project_type` → campo di staging |
| Brief atm. | `projects.metadata_json.atmosphere` + `journey_briefs` | **`journey_briefs.closed_answers`** | `projects.metadata_json` → rimosso |
| Unread | `threads.unread_for_designer` + `/api/notifications` | **`threads.unread_for_designer`** | notifications endpoint → legge da threads |

---

## TASK 5 — PERCORSO UNICO: QUALE DOVREBBE ESSERE?

### Risposta alla domanda

La domanda proposta era:

```
A) Cliente → Journey → Discovery → Qualification → Prospect → Proposal
oppure
B) altro
```

**La risposta è: nessuno dei due.**

Il problema del percorso A è che presuppone una sequenza lineare. Ma la realtà è che:
- Un cliente pubblico arriva CON atmosfera e SENZA qualifica
- Un cliente admin arriva CON qualifica e SENZA atmosfera
- I due percorsi oggi NON convergono mai

Il percorso giusto per MOOD è:

---

### PERCORSO UNICO PROPOSTO

```
DESIGN JOURNEY  ←  ENTITÀ PRIMARIA E UNICA
        │
        │   lifecycle_state: ENUM canonico
        │
        ├── lead_identified
        │       Chi: chiunque (da form pubblico OPPURE creato da admin)
        │       Dati: nome + email + source
        │       Brief: opzionale (se viene da Begin Journey)
        │
        ├── discovery_open
        │       Chi: journey confermata dal designer
        │       Azione: aprire il dialogo
        │       Dati: + atmosphere (se mancante) + spazio
        │
        ├── qualified
        │       Chi: journey con project_type + timeline compilati
        │       Azione: designer ha qualificato le intenzioni
        │       Dati: + project_type + timeline + budget (ideale)
        │
        ├── in_progress  (oggi: conversation_open → discover → inspire...)
        │       Chi: cliente ha accesso, lavoro attivo
        │       Milestone: Discover → Inspire → Curate → Specify → Approve → Deliver
        │
        └── closed / archived
```

### Implicazioni concrete

1. **`Lead` non scompare — diventa una vista** del Journey in stato `lead_identified`.  
   Nel CRM, la pagina "Leads" mostra `design_journeys WHERE lifecycle_state IN ('lead_identified', 'discovery_open')`.

2. **`Prospect` non scompare — diventa una vista** del Journey in stato `qualified`.  
   La pagina "Prospects" mostra `design_journeys WHERE lifecycle_state = 'qualified'`.

3. **`Qualification` non scompare — diventa un'azione** che transita il Journey da `discovery_open` → `qualified`.  
   Il Qualification Modal scrive `projects.project_type` + `projects.timeline` e chiama `PATCH /api/journeys/:id/lifecycle` con `{state: 'qualified'}`.

4. **`Client Profile` non scompare — diventa `journey_briefs`**.  
   Già esiste. Solo deve essere il punto di lettura unico, non una copia in `projects.metadata_json`.

5. **`Discovery Interview` non scompare — diventa la transizione `lead_identified` → `discovery_open`**.  
   Non è un'entità separata — è l'azione di aprire una conversazione.

### Il CRM Admin non cambia visivamente

La pagina "Leads" continua a mostrare una lista. La pagina "Prospects" continua a mostrare una lista. L'admin non nota la differenza. Ma internamente, entrambe le viste leggono dalla stessa entità `design_journeys`, filtrata per `lifecycle_state`.

---

## RISPOSTA FINALE: COSA ANDREBBE PERSO?

Se eliminassimo Lead / Prospect / Qualification / Client Profile e mantenessimo solo DESIGN JOURNEY:

| Dato | Perduto? | Note |
|------|---------|------|
| Nome, email, phone | **NO** — già in contacts | Identità già nell'entità collegata |
| Source (showroom, website...) | **Sì, parzialmente** — ma recuperabile in `design_journeys.metadata_json` | |
| UTM e acquisition analytics | **Sì** — `leads.runtime_identity` è unico | Questo è il dato di marketing che non ha senso altrove |
| Funnel events / audit trail | **Sì** — `funnel_events` sono legati ai leads | Andrebbero rilegati a journey_id |
| Pipeline stage history | **Sì** — storia di quando lead → prospect | Da gestire con `journey_timeline_events` (già esiste) |
| Score (= 0) | **No — non esiste realmente** | |
| Campi AI mai popolati | **No — non esistono realmente** | |
| Qualification answers (project_type, timeline) | **NO** — già in `projects` | |
| Brief atmosferico | **NO** — già in `journey_briefs` | |
| Discovery interview status | **NO** — già in `design_journeys.lifecycle_state` | |

**Conclusione:** L'unica perdita reale sarebbe l'**acquisition trail** (UTM, source, onboarding_path, funnel_events). Tutto il resto è già nel grafo `accounts → projects → design_journeys → journey_briefs`.

---

## CLASSIFICAZIONE FINALE

### P0 — Eliminazioni (dati inutili da rimuovere)

| ID | Azione | Perché |
|----|--------|--------|
| P0-E1 | Rimuovere `space_status` e `interest` dal Qualification Modal oppure salvarli | Oggi raccolti e immediatamente scartati |
| P0-E2 | Rimuovere copia di `atmosphere` da `projects.metadata_json` | Duplicato di `journey_briefs.closed_answers` |
| P0-E3 | Deprecare `leads.status` come stato operativo | Lo stato canonico è `design_journeys.lifecycle_state` |
| P0-E4 | Svuotare i 10+ campi `leads.*` mai popolati (score, atmosphere_signals, behavioral_tags, ai_tags, cultural_register, luxury_perception_tier, progression_score, narrative_seed, relationship_temperature) oppure documentarli come "future roadmap" | Creano confusione e nessuna business logic li legge |

### P0 — Fusioni (dati da unificare)

| ID | Azione | Perché |
|----|--------|--------|
| P0-F1 | `leads.pipeline_stage` + `design_journeys.lifecycle_state` → **un solo campo** | Stesso concetto, due rappresentazioni |
| P0-F2 | `conversation_threads.unread_for_designer` → alimenta `/api/notifications` | Badge notifiche disconnesso dalla realtà |
| P0-F3 | `leads.project_type` → staging field, fonte di verità è `projects.project_type` | Sincronizzare al momento della Journey creation |
| P0-F4 | `accounts.account_name` → read-only concat di `contacts.first_name + last_name` | Eliminare la duplicazione del nome |

### P1 — Refactoring

| ID | Azione |
|----|--------|
| P1-R1 | CRM "Leads" page → legge `design_journeys WHERE lifecycle = 'lead_identified'` |
| P1-R2 | CRM "Prospects" page → legge `design_journeys WHERE lifecycle = 'qualified'` |
| P1-R3 | `leads.project_type` comma-string → `Array` o JSON (oggi `"Kitchen,Living"` come stringa) |
| P1-R4 | `projects.timeline` → `"1-3m"` → label localizzata `"1–3 mesi"` (in `project_type_labels` config) |
| P1-R5 | `funnel_events` → aggiungere `journey_id` FK (oggi solo `lead_id`) |

### P2 — Backlog

| ID | Azione |
|----|--------|
| P2-B1 | `budget_range` → aggiungere in Qualification Modal (step 5 facoltativo) |
| P2-B2 | Lead scoring algoritmico basato su: email verificata + project_type + timeline + source |
| P2-B3 | `journey_briefs.closed_answers.lifestyle.materials[]` → usato per raccomandazioni moodboard |
| P2-B4 | Brief Guidato post-auth (`/client/brief`) come modulo dedicated per completare il profilo |
| P2-B5 | `discovery_interviews` → semplificare o eliminare come entità separata — è già gestito da lifecycle transitions |

---

## SCHEMA DEL MODELLO FINALE (proposta senza nuove tabelle)

```
design_journeys                    ← PIVOT CENTRALE
  id, tenant_id
  lifecycle_state                  ← STATO CANONICO (unico)
    ENUM: lead_identified | discovery_open | qualified |
          in_progress | closed
  account_id → accounts             ← identità commerciale
  project_id → projects             ← dati operativi (type, budget, timeline)

accounts                           ← IDENTITÀ
  id, account_name [derived]
  account_type, email [sync]
  └── contacts                     ← DATI ANAGRAFICI (CANONICAL)
        first_name, last_name      ← CANONICAL nome
        email, phone               ← CANONICAL contatti

projects                           ← DATI PROGETTO (CANONICAL)
  project_type                     ← CANONICAL tipo
  timeline                         ← CANONICAL timeline
  budget_range                     ← da raccogliere
  [NO metadata_json.atmosphere]    ← rimosso: va in journey_briefs

journey_briefs (1:1 con journey)   ← BRIEF ASPIRAZIONALE (CANONICAL)
  closed_answers.atmosphere        ← space_type, how_to_feel, references
  closed_answers.lifestyle         ← guests, materials[], ambiance
  closed_answers.welcome           ← first_name, last_name, email

leads                              ← ACQUISITION AUDIT LOG (read-only dopo creazione)
  source, onboarding_path          ← da dove + come
  runtime_identity (UTM)           ← marketing attribution
  created_at                       ← quando
  [TUTTO IL RESTO: deprecato]

conversation_threads               ← MESSAGGI
  unread_for_designer              ← alimenta badge (P0-F2)
  last_message_preview

journey_timeline_events            ← AUDIT TRAIL
  [sostituisce funnel_events per tracciamento percorso]
```

---

## IL PERCORSO UNICO — RAPPRESENTAZIONE FINALE

```
SUPERFICIE              LIFECYCLE STATE          ENTITÀ CANONICA

  /begin-journey     →  lead_identified      →  design_journey (+ lead per UTM)
  Admin: Nuovo Lead  →  lead_identified      →  design_journey (+ lead per source)
                                             
  Designer: apre     →  discovery_open       →  design_journey.lifecycle ← transizione
  conversazione
                     
  Qualification      →  qualified            →  projects.project_type
  Modal completata                              projects.timeline
                                             
  Client onboarding  →  in_progress          →  design_journey.lifecycle ← transizione
  confermato
                     
  Milestone: Discover → (workflow interno) → journey_milestones (7 fasi)
  Inspire / Curate /
  Specify / Approve /
  Deliver / Celebrate
                     
  Progetto chiuso    →  closed               →  design_journey.lifecycle
```

**Una sola entità. Uno solo stato. Una sola storia.**

---

*Documento prodotto il 11/06/2026 — CLIENT MODEL CONSOLIDATION SPRINT*  
*Input: MODEL_CONSISTENCY_REPORT.md, CORE_FLOW_CERTIFICATION_REPORT.md*  
*Nessun codice scritto. Nessuna implementazione eseguita. Solo modello operativo.*
