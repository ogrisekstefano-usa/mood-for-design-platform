# MODEL CONSISTENCY REPORT™
**Versione:** 1.0  
**Data audit:** 11 giugno 2026  
**Sprint:** Core Flow Certification — P0 Assoluto  
**Obiettivo:** Identificare ogni divergenza tra le entità del cliente nei 3 percorsi  

---

## 1. LEAD BLUEPRINT vs LEAD PUBBLICO — Confronto Diretto

### 1.1 Campi raccolti

| Campo | Flow A (Begin Journey) | Flow B (Admin Lead) |
|-------|----------------------|-------------------|
| first_name | ✓ | ✓ |
| last_name | ✓ | ✓ |
| email | ✓ | ✓ |
| phone | opzionale | opzionale |
| space_type | ✓ | ✗ |
| how_to_feel | ✓ | ✗ |
| references | ✓ | ✗ |
| guests | ✓ | ✗ |
| materials | ✓ (lista) | ✗ |
| ambiance | ✓ | ✗ |
| project_type | **ASSENTE** | ✓ (via Qualification) |
| space_status | **ASSENTE** | ✓ (via Qualification) |
| budget_range | **ASSENTE** | **ASSENTE** (mai raccolto) |
| timeline | **ASSENTE** | ✓ (via Qualification) |
| interest | **ASSENTE** | ✓ (via Qualification) |
| source | hardcoded: `begin_journey_ritual` | selezionato dall'admin |
| lead_score | sempre = 0 | sempre = 0 |

### 1.2 Esperienza utente

| Dimensione | Flow A (Begin Journey) | Flow B (Admin Lead) |
|-----------|----------------------|-------------------|
| **Tono** | Narrativo-aspirazionale | Operativo-CRM |
| **Numero step** | 3 step | 1 modal |
| **Lingua** | Inglese (BUG) | Italiano ✓ |
| **Emozione** | Atmosfere, sensazioni, materiali | Nome, email, origine |
| **Durata stimata** | ~4 minuti | ~30 secondi |
| **Dream Score** | 3/10 (per bug lingua) | 4/10 |

### 1.3 Dati salvati nel DB

| Campo | Flow A | Flow B |
|-------|--------|--------|
| `leads.first_name` | ✓ | ✓ |
| `leads.last_name` | ✓ | ✓ |
| `leads.email` | ✓ | ✓ |
| `leads.source` | `begin_journey_ritual` | `showroom` / altro |
| `leads.status` | `qualified` | default |
| `leads.score` | 0 | 0 |
| Brief narrativo italiano | ✓ (nel thread) | ✗ (non generato) |
| Thread conversazione | ✓ (automatico) | Solo dopo Qualification |

### 1.4 Entità create

| Entità | Flow A | Flow B |
|--------|--------|--------|
| `leads` record | ✓ | ✓ |
| `accounts` record | ✓ (auto) | ✓ (auto dopo Qualification) |
| `projects` record | ✓ (vuoto) | ✓ (con project_type + timeline) |
| `design_journeys` record | ✓ | ✓ (dopo Qualification) |
| Conversation thread | ✓ (con messaggio sistema) | ✓ (dopo Qualification) |
| Client user account (auth) | ✓ (magic link Supabase) | ✗ (non creato) |

### 1.5 Ownership assegnata

| Campo | Flow A | Flow B |
|-------|--------|--------|
| `design_journeys.created_by` | Tenant owner (auto) | Admin che crea |
| `conversation.primary_designer_id` | Tenant owner (auto) | Admin che crea |
| Account owner | Tenant owner | Tenant owner |

### 1.6 Classificazione divergenze

**`P0` — Divergenza critica:**  
Flow A genera un cliente con profilo atmosferico ricco ma ZERO dati operativi (nessun project_type, nessun timeline, nessun budget). Flow B genera un cliente con dati operativi ma ZERO profilo atmosferico. **I due percorsi producono entità incompatibili per lo stesso tipo di cliente.**

---

## 2. CLIENT PROFILE vs BRIEF vs DISCOVERY vs PROSPECT QUALIFICATION

### 2.1 Dove vivono i dati del cliente

```
ENTITÀ ESISTENTI:
├── leads             (CRM entry: name, email, source, score, status)
├── accounts          (Identity: name, type, lifecycle_stage)
├── projects          (Operational: name, project_type, budget_range, timeline)
├── design_journeys   (Workflow: current_milestone, lifecycle_state)
├── client_profile    (Atmospheric: brief narrativo, mood, references)
├── conversation_threads (Messaging: unread, last_message)
└── relationship_notifications (Badge: unread counts)
```

### 2.2 SOURCE OF TRUTH TABLE

| Dato | Entità Source of Truth | Duplicato in | Note |
|------|----------------------|--------------|------|
| Nome cliente | `leads.first_name + last_name` | `accounts.account_name` | **DUPLICATO** |
| Email | `leads.email` | `users_profile.email` (after provisioning) | **DUPLICATO** |
| Tipo spazio/progetto | `projects.project_type` | `client_profile` (testuale) | **INCOERENTE**: in projects è codice (es: "Kitchen"), in profile è narrativo (es: "un soggiorno caldo") |
| Timeline | `projects.timeline` | — | Unica fonte |
| Budget | `projects.budget_range` | — | Sempre NULL — mai raccolto |
| Atmosfera | `client_profile.brief_text` (narrativo) | — | Unica fonte, solo Flow A |
| Materiali preferiti | `client_profile.brief_text` (embedded nel testo) | — | Non strutturato, non queryabile |
| Ospitalità/Guests | `client_profile.brief_text` (embedded) | — | Non strutturato |
| Origine lead | `leads.source` | — | Unica fonte |
| Score qualifica | `leads.score` | — | Sempre 0 — scoring non attivo |
| Status percorso | `design_journeys.lifecycle_state` | `leads.status` | **DUPLICATO CONFUSO** |
| Unread messages | `conversation_threads.unread_for_designer` | `/api/notifications` | **INCOERENTE**: non sincronizzati |

---

## 3. ANALISI DOMANDE QUALIFICA LEAD — Domanda per Domanda

### 3.1 Qualification Modal (4 step)

**STEP 1: "Cosa stai progettando?"**  
Opzioni: Kitchen, Living, Bathroom, Bedroom, Outdoor, Office, Retail, Hospitality, Full Home, Other

| Valutazione | Dettaglio |
|-------------|---------|
| Utile | ✓ — Fondamentale per assegnare il team giusto |
| Lingua | ✗ FAIL — Tutte le opzioni in inglese |
| Luxury appropriata | Problematico — "Kitchen", "Other" sono termini neutri non luxury. Per un cliente high-end del settore interior design italiano, si aspetta "Cucina", "Soggiorno", "Zona notte" |
| Prematura | No — È la prima domanda giusta da fare |
| Invasiva | No |
| Nota critica | "Retail" e "Hospitality" come opzioni primarie al **primo contatto** con un cliente privato sono inadeguate — creano confusione per chi cerca un progetto residenziale |

**Classificazione: UTILE ma da rivedere — le opzioni non sono luxury e alcune non appartengono al primo contatto privato**

---

**STEP 2: "Hai già uno spazio definito?"**  
Opzioni: Sì, definito / Lo sto cercando / Non ancora

| Valutazione | Dettaglio |
|-------------|---------|
| Utile | ✓ — Distingue tra ristrutturazione e ricerca nuova proprietà |
| Lingua | ✓ italiano |
| Luxury appropriata | ✓ — Domanda diretta ma non invasiva |
| Prematura | No — È contestualmente corretta |
| Invasiva | No |
| Nota critica | "Non ancora" e "Lo sto cercando" hanno implicazioni diverse (chi non vuole averlo vs. chi sta cercando). Potrebbe essere disambiguata |

**Classificazione: UTILE**

---

**STEP 3: "Quando pensi di iniziare?"**  
Opzioni: Entro 30 giorni / 1–3 mesi / 3–6 mesi / Oltre 6 mesi / Sto esplorando

| Valutazione | Dettaglio |
|-------------|---------|
| Utile | ✓ — Urgency qualifier fondamentale per CRM |
| Lingua | ✓ italiano |
| Luxury appropriata | ✓ — Discreta, non spinge |
| Prematura | No |
| Invasiva | No |
| Nota critica | "Sto esplorando" è un'ottima opzione per chi non sa ancora |

**Classificazione: UTILE — nessuna modifica necessaria**

---

**STEP 4: "Vorresti una proposta di design?"**  
Opzioni: Sì / Forse / Non adesso

| Valutazione | Dettaglio |
|-------------|---------|
| Utile | Parzialmente |
| Luxury appropriata | **PROBLEMATICO** |
| Invasiva | ✓ SÌ — per un cliente luxury nel primo contatto |
| Note critiche | **MAI chiedere a un cliente alto-spendente "Vorresti una proposta?"** al primo contatto. È percepito come chiusura forzata (hard sell). Il cliente si aspetta che lo studio sappia già come procedere. Questa domanda abbassa il Dream Score e trasmette insicurezza, non expertise. In un contesto showroom/luxury, il design journey si offre, non si chiede. |

**Classificazione: INVASIVA per il primo contatto luxury / showroom — da sostituire con qualcosa di più narrativo (es. "Come preferisci essere contattato?" o eliminare del tutto)**

---

### 3.2 Begin Journey Public Form (3 step)

**STEP 1 - "Quale atmosfera stai cercando?"**  
Domande: spazio, how_to_feel, references

| Valutazione | Dettaglio |
|-------------|---------|
| Utile | ✓ — Cattura l'essenza aspirazionale |
| Luxury appropriata | ✓ — Perfetto per high-end |
| Approccio | ✓ — Accompagna, non interroga |
| Problema | LINGUA inglese |
| Dream Score contribution | Sarebbe 9/10 se in italiano |

**Classificazione: UTILE e LUXURY — da correggere solo la lingua**

---

**STEP 2 - "Come abiti lo spazio?"**  
Domande: ospiti, materiali, ambiance

| Valutazione | Dettaglio |
|-------------|---------|
| Utile | ✓ |
| Luxury appropriata | ✓ — "Materiali che ti fanno stare bene" è il linguaggio giusto |
| Nota | Materiali come opzioni multiple chip è utile per un brief stilistico |
| Problema | LINGUA inglese |

**Classificazione: UTILE e LUXURY — da correggere solo la lingua**

---

**STEP 3 - "Dove iniziamo?"**  
Campi: nome, cognome, email, telefono

| Valutazione | Dettaglio |
|-------------|---------|
| Utile | ✓ |
| Prematura | No |
| Invasiva | No — solo nome + email è la minima friction corretta |
| Problema | LINGUA mista: "Cognome" italiano + tutto inglese |

**Classificazione: UTILE — da correggere lingua**

---

## 4. FILOSOFIA MOOD — Analisi per Schermata

### Il test centrale:
> Il cliente viene **A) accompagnato e ispirato** oppure **B) interrogato come in un CRM tradizionale?**

| Schermata | Approccio | Dream Score | Perché |
|-----------|-----------|-------------|--------|
| `/begin-journey` Step 1 | A (concettualmente) | 3/10 | La filosofia è giusta ma la lingua sbagliata annulla tutto |
| `/begin-journey` Step 2 | A (concettualmente) | 3/10 | Idem |
| `/begin-journey` Step 3 | B (form) | 4/10 | Il campo "Cognome" in italiano tra inglese è disturbante |
| `/journey/preparing` | B (cold English) | 2/10 | Peggiore momento del percorso |
| Qualification Modal | B (step-by-step form) | 5/10 | Domande più operative che aspirazionali |
| Lead Detail (admin) | B (CRM puro) | 4/10 | Corretto per l'admin, ma il cliente non lo vede |
| Journey Workspace | B | 4/10 | Interfaccia da project manager, non da atelier |

### Valutazione globale:

**MOOD sta cercando di essere sia un atelier aspirazionale (Flow A) sia uno strumento operativo (Flow B) — ma i due mondi sono disconnessi. Il cliente pubblico vive l'aspettativa di un viaggio. Il cliente admin viene processato come un CRM entry.**

**La promessa del brand non è mantenuta end-to-end.**

---

## 5. IDENTIFICAZIONE DATI DUPLICATI, INCOERENTI, INUTILIZZATI

### 5.1 Dati DUPLICATI (stesso dato in entità diverse)

| Dato | Entità 1 | Entità 2 | Rischio |
|------|---------|---------|--------|
| Nome cliente | `leads.first_name + last_name` | `accounts.account_name` | Desincronizzazione se uno cambia |
| Email cliente | `leads.email` | `users_profile.email` | Desincronizzazione |
| Status journey | `design_journeys.lifecycle_state` | `leads.status` | Semantica diversa, confusione logica |
| Unread count | `conversation_threads.unread_for_designer` | `/api/notifications` (vuoto!) | **INCOERENZA CRITICA**: i dati non sono sincronizzati |

### 5.2 Dati INCOERENTI (stesso concetto, rappresentazione diversa)

| Concetto | Rappresentazione A | Rappresentazione B | Problema |
|---------|-------------------|-------------------|---------|
| Tipo spazio/progetto | `projects.project_type` = "Kitchen" (enum inglese) | `client_profile.brief_text` = "un soggiorno caldo..." (narrativo italiano) | Non unificabili, non queryabili insieme |
| Materiali preferiti | `client_profile` (embedded nel testo, non strutturato) | Non esiste in `projects` | Dato raccolto ma non strutturato = inutilizzabile per ricerca/filtro |

### 5.3 Dati INUTILIZZATI (raccolti ma mai usati)

| Dato | Raccolto in | Usato dove | Note |
|------|------------|-----------|------|
| `references` (film, città, materiali) | Begin Journey Step 1 | Embedded nel testo del brief | Non strutturato, non influenza nessuna logica |
| `guests` (ospitalità) | Begin Journey Step 2 | Embedded nel testo del brief | Idem |
| `ambiance` (warm/minimal/airy/tactile) | Begin Journey Step 2 | Embedded nel testo del brief | Potrebbe guidare filtri moodboard ma non lo fa |
| `lead.score` | Tutti i percorsi | **MAI** | Sempre = 0, nessun algoritmo di scoring attivo |
| `projects.budget_range` | **MAI raccolto** | MAI | Esiste nel modello ma è NULL per tutti i lead |

### 5.4 Dati che dovrebbero vivere in UN SOLO POSTO

| Dato | Situazione attuale | Dove dovrebbe stare |
|------|-------------------|-------------------|
| Identità cliente | Dispersa in `leads` + `accounts` + `users_profile` | Un unico `client_identity` con references |
| Profilo aspirazionale | In `client_profile.brief_text` come testo libero | Strutturato: `space_type`, `atmosphere_tags[]`, `material_preferences[]` |
| Qualifica progetto | In `projects` (operativo) | Separato ma collegato: `project_brief` con `type` + `atmosphere` + `budget` + `timeline` |

---

## 6. RISPOSTA ALLA DOMANDA CENTRALE

### MOOD racconta una sola storia o tre storie diverse?

**RISPOSTA: DUE STORIE, NON TRE. E NESSUNA È COMPLETA.**

```
STORIA 1 — Il Sogno (Flow A):
  Cliente → Form aspirazionale in inglese → "We're opening your Design Journey™..."
  → Lead creato con atmosfera → Journey vuota senza progetto qualificato
  
  Manca: lingua italiana, project type, timeline, budget, onboarding client

STORIA 2 — Il CRM (Flow B):
  Admin → Crea lead operativo → Qualifica con form 4 step (opzioni in inglese)
  → Journey con project type e timeline → Nessun profilo aspirazionale
  
  Manca: profilo atmosferico cliente, brief narrativo, unified identity

STORIA COMPLETA CHE DOVREBBE ESISTERE:
  Cliente → Form aspirazionale in ITALIANO → Lead con atmosfera + qualifica
  → Journey unificata con profilo completo → Client onboarding seamless
  → Designer con visione completa del cliente dal day 1
```

---

## 7. CLASSIFICAZIONE FINALE PER PRIORITÀ

### P0 — Blocco assoluto prima del lancio

| ID | Problema | File/Entità |
|----|---------|------------|
| P0-CM-01 | `lead.score` sempre 0 — scoring non implementato | `leads` table, scoring service |
| P0-CM-02 | Dati atmosferici (materials, ambiance, guests) non strutturati — non queryabili | `client_profile`, `journey_initiate.py` |
| P0-CM-03 | `projects.budget_range` mai raccolto in nessun percorso | Tutti i form |
| P0-CM-04 | Flow A e Flow B producono entità incompatibili per lo stesso cliente | Architettura |
| P0-CM-05 | `unread_for_designer` non sincronizzato con `/api/notifications` | `relationship_conversation.py`, notifications endpoint |
| P0-CM-06 | Qualification Modal - Project types in inglese hardcoded | `QualificationModal.jsx` line 10 |

### P1 — Da risolvere nel prossimo sprint

| ID | Problema |
|----|---------|
| P1-CM-01 | Nome cliente duplicato in `leads` e `accounts` senza sync |
| P1-CM-02 | Domanda "Vorresti una proposta?" invasiva per clienti luxury |
| P1-CM-03 | `references` data non strutturata — raccolta ma inutilizzabile |
| P1-CM-04 | "Retail" e "Hospitality" nelle opzioni del primo contatto privato |
| P1-CM-05 | `timeline` salvato come "1-3m" (codice) invece di label localizzata "1–3 mesi" |

### P2 — Ottimizzazione futura

| ID | Problema |
|----|---------|
| P2-CM-01 | Unificazione Client Profile, Lead Blueprint, Brief Guidato in un'entità sola |
| P2-CM-02 | Strutturazione dei dati atmosferici (materials[], ambiance_tags[]) |
| P2-CM-03 | Implementazione lead scoring basato su qualifica + engagement |
| P2-CM-04 | Budget collection in entrambi i percorsi |

---

## 8. RACCOMANDAZIONI ARCHITETTURALI

1. **Creare `client_brief` come entità unificata** che contiene sia i dati aspirazionali (atmosphere, materials, references) sia i dati operativi (project_type, timeline, budget) — accessibile da entrambi i percorsi.

2. **Il Begin Journey deve raccogliere ANCHE project_type** (in italiano: "Cucina", "Soggiorno", etc.) — ma come domanda opzionale e ispirazionale, non come chip freddi.

3. **Il Qualification Modal deve raccogliere ANCHE l'atmosfera** — almeno una domanda narrativa libera ("Raccontaci l'atmosfera che immagini").

4. **Il lead scoring deve essere attivato** — almeno un algoritmo base che somma punti per: email verificata, project_type compilato, timeline compilato, interesse = "Sì".

5. **`unread_for_designer` deve alimentare il badge notifiche** — altrimenti il designer non sa mai quando arriva un lead pubblico.

---

*Report generato il 11/06/2026 — Audit Modello Dati — Sprint Certification P0 Assoluto*
