# POST-STABILIZATION VALIDATION REPORT — MOOD for DESIGN™

> **Data:** 2026-06-14T03:15:00Z  
> **Sessione:** POST-STABILIZATION VALIDATION SPRINT  
> **Metodo:** Validazione sistematica senza modifiche al codice  
> **Scope:** Deploy · Human Flow · Multilingua · Session/Auth · Resend · DB Health · Lifecycle Coherence

---

## EXECUTIVE SUMMARY

| Area | Status | Bug P0 | Bug P1 | Bug P2 |
|------|--------|--------|--------|--------|
| Deploy | 🟡 PARZIALE | 0 | 2 | 1 |
| Human Flow | 🔴 BLOCCANTE | 1 | 1 | 2 |
| Multilingua | 🔴 CRITICO | 0 | 4 | 0 |
| Session/Auth | 🟡 PARZIALE | 0 | 1 | 1 |
| Resend | 🔴 BLOCCANTE | 0 | 1 | 0 |
| DB Health | 🟢 OK | 0 | 0 | 2 |
| Lifecycle Coherence | 🟡 INCOERENTE | 0 | 2 | 2 |
| **TOTALE** | | **1** | **11** | **8** |

---

## STEP 1 — DEPLOY VALIDATION

### Infrastruttura
| Servizio | Status | Note |
|---------|--------|------|
| Backend FastAPI | ✅ RUNNING (pid 265) | Startup pulito |
| Frontend React | ✅ RUNNING (pid 85) | Compiled with 1 warning |
| MongoDB | ✅ RUNNING | |
| Nginx | ✅ RUNNING | |
| Supabase | ✅ CONNESSO | admin client ready |
| KE-001 Recovery Scheduler | ✅ ATTIVO | 60s interval |
| Notification Cron | ✅ ATTIVO | followup_overdue_scan |

### Endpoint Status (HTTP)
| Endpoint | Status | Classificazione |
|----------|--------|-----------------|
| `GET /api/health` | 200 ✅ | |
| `GET /api/profile/me` | 200 ✅ | con auth |
| `GET /api/relations/accounts` | 200 ✅ | |
| `GET /api/relations/leads` | 200 ✅ | |
| `GET /api/platform/languages` | 200 ✅ | |
| `GET /api/storefront/public/studio/pages/navigation` | 200 ✅ | slug `studio` |
| `GET /api/dashboard/ecosystem-snapshot` | 200 ✅ | |
| `GET /api/locale-runtime/resolve/public` | 200 ✅ | |
| `GET /api/workspace/journeys/mine` | 200 ✅ | endpoint corretto |
| `GET /api/notifications` | 200 ✅ | |
| `GET /api/tenant/configuration` | 200 ✅ | |
| `GET /api/tenant/configuration/public/i18n-recovery-1` | 404 ⚠️ | slug errato nel DB |
| `GET /api/storefront/public/i18n-recovery-1/pages/home` | 404 ⚠️ | slug errato |
| `GET /api/blueprint/i18n/it-IT` | 403 🔴 | **BUG P1-A** |
| `GET /api/journeys/mine` | 404 ⚠️ | endpoint deprecato |
| `GET /api/design-journeys/mine` | 404 ⚠️ | endpoint deprecato |

### Bug Deploy

#### BUG D-1 — P1: `blueprint/i18n/it-IT` restituisce 403
- **Sintomo:** `GET /api/blueprint/i18n/it-IT` → 403 Forbidden
- **Causa:** Backend accetta `it` ma non `it-IT` (BCP-47 full code). Frontend invia `it-IT`.
- **Impatto:** L'intera app si blocca su "Preparando il tuo atelier..." in modalità Studio perché `BlueprintContext.loadMessages('it-IT', ...)` fallisce silenziosamente.
- **Dettaglio errore:** `{'error': 'forbidden_locale', 'message': "Locale 'it-IT' is not enabled", 'operational_locales': ['de','en-GB','en-US','es','fr','it']}`

#### BUG D-2 — P1: Tenant slug `i18n-recovery-1` non ha configurazione storefront
- **Sintomo:** `GET /api/tenant/configuration/public/i18n-recovery-1` → 404
- **Causa:** Il tenant nel DB usa slug `studio`, non `i18n-recovery-1` (nome del pod Kubernetes)
- **Impatto:** Sito pubblico mostra chiavi placeholder (`HERO_EDITORIAL`, `HOW_IT_WORKS`) anziché contenuto

#### BUG D-3 — P2: Build warning `useActiveJourney` mancante
- **File:** `/app/frontend/src/components/layout/CreateModal.jsx:395`
- **Causa:** Riferimento a `../../hooks/useActiveJourney` (singolare) ma esiste solo `useActiveJourneys` (plurale)
- **Impatto:** Build warning (non error), non blocca ma indica dead code

---

## STEP 2 — REAL HUMAN FLOW TEST

### Mappa del flow testato

| Passo | Route | Stato | Note |
|-------|-------|-------|------|
| 1. Sito pubblico | `/` | 🟡 PARZIALE | Carica, ma contenuto editoriale mancante (placeholder keys) |
| 2. Onboarding | `/begin-journey` | 🟡 PARZIALE | Form carica, ma label `I`, `II`, `III` invece del copy editoriale |
| 3. Journey creation | `POST /api/public/journeys/initiate` | ✅ OK | 201, action=created |
| 4. Magic link | `magic_link_url` | ⚠️ NON CONSEGNATO | Generato correttamente, ma Resend non consegna (dominio non verificato) |
| 5. Client Portal | `/journey/welcome/:token` | 🔴 BLOCCATO | Stuck su "Disponendo il silenzio..." — non si risolve |
| 6. Relationship Thread | `GET /api/relations/...` | ✅ API OK | Thread creato ma non visibile dal portal |
| 7. Atelier (Studio) | `/dashboard` | 🟡 PARZIALE | Stuck su "Preparando il tuo atelier..." a causa di bug D-1 |
| 8. Logout | `POST /api/auth/logout` | ✅ 200 OK | |
| 9. Login successivo | `POST /api/auth/login` | ✅ 200 OK | |
| 10. Ripresa Journey | `action=resumed` | ✅ OK | Deduplicazione P0-A funziona |

### Bug Human Flow

#### BUG HF-1 — P0: Welcome page (`/journey/welcome/:token`) resta bloccata
- **Sintomo:** La pagina mostra "Disponendo il silenzio..." indefinitamente
- **Causa radice:** Il caricamento dell'app è bloccato dalla 403 su `/api/blueprint/i18n/it-IT`. L'app-level loading state non si risolve finché `BlueprintContext` non ha ricevuto i messaggi i18n. La 403 silenziosa non viene gestita come errore recuperabile.
- **Impatto:** Il cliente non riesce mai a vedere il proprio Welcome Portal. È il P0 dell'esperienza cliente.
- **Dipendenza:** Risolto da BUG D-1 (fix `blueprint/i18n/it-IT`)

#### BUG HF-2 — P1: Sito pubblico mostra chiavi editoriali invece del contenuto
- **Sintomo:** Homepage mostra `HERO_EDITORIAL`, `HOW_IT_WORKS`, `MAGAZINE_HIGHLIGHTS` (chiavi del Blueprint non risolte)
- **Causa:** Il tenant slug nel DB è `studio` ma il pod usa `i18n-recovery-1`; il sistema non trova la configurazione storefront corretta
- **Note:** Il footer mostra correttamente `PAESE · LINGUA · IT-IT`

#### BUG HF-3 — P2: Form `/begin-journey` mostra label `I`, `II`, `III`
- **Sintomo:** I passi del form mostrano numeri romani anziché label editoriali
- **Causa:** Stessa causa di HF-2 — editorial bundle non caricato correttamente

#### BUG HF-4 — P2: Debug overlay `EDITORIAL · DEBUG` visibile in produzione
- **Sintomo:** Overlay in basso a sinistra su tutte le pagine: "EDITORIAL · DEBUG runtime 3 · missing 0"
- **Impatto:** UX non professionale, non dovrebbe essere visibile agli utenti finali

---

## STEP 3 — MULTILINGUA CERTIFICATION

### Lingue configurate nel DB (7 totali)
`it-IT`, `en-US`, `en-GB`, `fr-FR`, `de-DE`, `es-ES`, `es-MX`

### Test Blueprint i18n (`/api/blueprint/i18n/{code}`)

| Locale DB | Codice inviato | HTTP | Note |
|-----------|---------------|------|------|
| `it-IT` | `it-IT` | 403 🔴 | Solo `it` accettato |
| `it-IT` | `it` | 200 ✅ | Short code funziona |
| `en-US` | `en-US` | 200 ✅ | BCP-47 accettato |
| `en-GB` | `en-GB` | 200 ✅ | BCP-47 accettato |
| `fr-FR` | `fr-FR` | 403 🔴 | Solo `fr` accettato |
| `de-DE` | `de-DE` | 403 🔴 | Solo `de` accettato |
| `es-ES` | `es-ES` | 403 🔴 | Solo `es` accettato |
| `es-MX` | `es-MX` | 403 🔴 | Non configurato |

### Test Public i18n (`/api/public/i18n/{code}`)

| Locale | HTTP | Note |
|--------|------|------|
| `it` | 200 ✅ | |
| `en-US` | 200 ✅ | |
| `en-GB` | 200 ✅ | |
| `it-IT` | 404 🔴 | Non accettato |
| `fr-FR` | 404 🔴 | Non configurato |
| `de-DE` | 404 🔴 | Non configurato |
| `es-ES` | 404 🔴 | Non configurato |

### Test editorial-copy/runtime
- `it`, `it-IT`, `en-US`, `en-GB`, `fr-FR` → tutti 200 ✅ (questo endpoint è più permissivo)

### Root Cause Multilingua
Il backend `platform.py` ha `BLUEPRINT_OPERATIONAL_CODES = ['de', 'en-GB', 'en-US', 'es', 'fr', 'it']`. Il codice `it` è nella lista ma `it-IT` no. Il frontend invia sempre il codice BCP-47 completo (da `BlueprintContext.locale`). Il mismatch BCP-47 vs short code causa 403 sistematiche per tutte le lingue europee eccetto inglese.

### Bug Multilingua

#### BUG I18N-1 — P1: `blueprint/i18n/it-IT` → 403 (blocco critico)
#### BUG I18N-2 — P1: `blueprint/i18n/fr-FR` → 403
#### BUG I18N-3 — P1: `blueprint/i18n/de-DE` → 403
#### BUG I18N-4 — P1: `blueprint/i18n/es-ES` → 403

- **Causa comune:** `BLUEPRINT_OPERATIONAL_CODES` in `platform.py` usa short codes per lingue non-inglesi (`it`, `fr`, `de`, `es`) invece dei codici BCP-47 completi (`it-IT`, `fr-FR`, etc.)
- **Impatto:** Qualsiasi utente con locale diverso da `en-US` o `en-GB` vede l'app bloccata

---

## STEP 4 — SESSION & AUTH VALIDATION

| Test | Risultato | Note |
|------|-----------|------|
| Login admin (email+password) | ✅ 200 | Session + access_token restituiti |
| Token valido → profile/me | ✅ 200 | |
| Token invalido → profile/me | ✅ 401 | Comportamento corretto |
| Logout | ✅ 200 | |
| Token post-logout | ⚠️ 200 | Supabase JWT stateless: token non revocato server-side |
| Magic link generato | ✅ OK | URL format: `supabase.co/auth/v1/verify?token=...` |
| Auth callback route | ✅ 200 | `/auth/client/callback` risponde |
| Session restore | ⚠️ N/A | Non testabile senza browser reale |
| ogrisekadvisor login | 🔴 FAIL | "Invalid login credentials" |

### Bug Auth

#### BUG AUTH-1 — P1: `ogrisekadvisor@gmail.com` login fallisce
- **Errore:** `Invalid login credentials`
- **Causa:** Password `Blueprint2024!` non valida per questo account. L'account esiste in `auth.users` ma le credenziali non corrispondono o la password non è stata impostata.
- **Impatto:** Secondo utente del sistema non può accedere.

#### BUG AUTH-2 — P2: JWT stateless — logout non revoca il token
- **Nota:** Comportamento expected per Supabase JWT. Non è un bug del codice, ma una limitazione di architettura da documentare.
- **Impatto:** Token valido per tutta la sua durata (tipicamente 1h) anche dopo logout.

---

## STEP 5 — RESEND VALIDATION

| Check | Stato | Dettaglio |
|-------|-------|-----------|
| API Key presente | ✅ | `re_TM23Kuzx_EXqpGsgBfwxkYFe1YTUQD6pe` |
| Formato API Key | ✅ | Inizia con `re_` (36 chars) |
| DNS `moodfordesign.com` | ✅ | Risolto |
| DNS `mail.moodfordesign.com` | ❌ | Non risolto (record DNS mancanti) |
| Dominio verificato su Resend | ❌ | "The moodfordesign.com domain is not verified" |
| Email delivery | 🔴 FAIL | `ResendError: domain not verified` |

### Errore preciso dal log
```
resend.exceptions.ResendError: The moodfordesign.com domain is not verified. 
Please, add and verify your domain on https://resend.com/domains
```

### Azioni richieste (Azione utente)
1. Accedere a [https://resend.com/domains](https://resend.com/domains)
2. Aggiungere dominio: `moodfordesign.com`
3. Aggiungere i DNS record richiesti da Resend (SPF, DKIM, DMARC) sul DNS provider del dominio
4. Attendere propagazione DNS (5–30 minuti)
5. Verificare su Resend dashboard

### Workaround attuale
Il magic link è disponibile nel log backend come `DEBUG_MAGIC_LINK_PROVISION`:
```
🔑 [DEBUG_MAGIC_LINK_PROVISION] email=... | journey=... | link=https://...supabase.co/auth/v1/verify?token=...
```
Questo permette lo sviluppo ma NON è adatto alla produzione.

---

## STEP 6 — SYSTEM HEALTH CHECK

### 6.1 Conteggi globali post-cleanup

| Entità | Conteggio | Note |
|--------|-----------|------|
| Accounts | 1 | Solo entità E2E test |
| Lead | 1 | Nessun duplicato |
| Account email duplicate | 0 | ✅ |
| Lead email duplicate | 0 | ✅ |
| Journey totali | 1 | Via welcome endpoint |
| Notifiche | 0 | DB pulito |
| Moodboards | 0 | |
| Brands | 7 | Knowledge base intatta |
| Products | 176 | Knowledge base intatta |
| Materials | 397 | Knowledge base intatta |

### 6.2 Thread e relazioni

| Check | Stato | Note |
|-------|-------|------|
| Account con relationship_thread_id = NULL | 1 | Thread creato (e15929c1) ma non linkato al account |
| Account con project_id = NULL | 1 | Link account→project non valorizzato |
| Notifiche orfane | 0 | ✅ |

#### BUG DB-1 — P2: `accounts.relationship_thread_id` = NULL
- **Entità:** Account `73501dc0` (Giulia Marchetti)
- **Thread esiste:** `e15929c1` (confermato da journey initiate response)
- **Causa:** `journey_initiate.py` crea il thread ma non aggiorna `accounts.relationship_thread_id`

#### BUG DB-2 — P2: `accounts.project_id` = NULL
- **Entità:** Stesso account
- **Causa:** Il link tra account e project non viene scritto durante la creazione

---

## STEP 6B — LIFECYCLE COHERENCE

### Entità di test: Giulia Marchetti (`e2e.certify.1781405667@moodtest.io`)

| Layer | Campo | Valore Attuale | Valore Atteso | Coerente? |
|-------|-------|---------------|--------------|-----------|
| `accounts` | `lifecycle_stage` | `prospect` | `active` o `client` | ❌ INCOERENTE |
| `accounts` | `journey_id` | `9815ffe4` | `9815ffe4` | ✅ OK |
| `accounts` | `project_id` | NULL | ID progetto | ❌ MANCANTE |
| `accounts` | `relationship_thread_id` | NULL | ID thread | ❌ MANCANTE |
| `leads` | `status` | NULL | `active` | ❌ NULL |
| `leads` | `progression_state` | `lead` | `qualified` | ❌ INCOERENTE |
| `leads` | `first_journey_id` | NULL | Journey UUID | ❌ MANCANTE |
| `design_journeys` | `lifecycle_state` | `in_progress` | `in_progress` | ✅ OK (P0-D fix) |
| `design_journeys` | `milestones_count` | 10 | 10 | ✅ OK |

### Analisi incoerenza

```
ATTESO dopo journey initiation:
  accounts.lifecycle_stage:   prospect → active/client
  leads.progression_state:    lead → qualified
  leads.first_journey_id:     NULL → journey_id
  leads.status:               NULL → active
  accounts.relationship_thread_id: NULL → thread_id

REALE:
  design_journeys.lifecycle_state = in_progress  ✅
  accounts.lifecycle_stage = prospect             ← NON avanzato
  leads.progression_state = lead                  ← NON avanzato
  leads.status = NULL                             ← MAI settato
```

#### BUG LC-1 — P1: `accounts.lifecycle_stage` non avanza dopo journey initiation
- **Atteso:** Quando viene creato un journey con `lifecycle_state=in_progress`, `accounts.lifecycle_stage` dovrebbe passare da `prospect` ad `active`
- **Reale:** Resta `prospect`
- **Causa:** `journey_initiate.py` non aggiorna `accounts.lifecycle_stage` dopo la creazione

#### BUG LC-2 — P1: `leads.progression_state` non avanza e `leads.first_journey_id` non viene linkato
- **Atteso:** Al momento della journey creation, il lead viene promosso a `qualified` e `first_journey_id` viene valorizzato
- **Reale:** `progression_state=lead`, `first_journey_id=NULL`
- **Causa:** `journey_initiate.py` non aggiorna la tabella `leads` dopo la creazione

#### BUG LC-3 — P2: `leads.status` = NULL
- **Causa:** Il campo `status` non viene mai inizializzato durante la creazione del lead

#### BUG LC-4 — P2: `leads.locale_code` = `it-IT` (potrebbe causare mismatch)
- **Nota:** Il lead viene creato con `locale_code=it-IT` (BCP-47 full), ma il locale runtime usa `IT_IT`. Incoerenza di formato.

---

## ELENCO COMPLETO BUG — CLASSIFICATI

### P0 — Bloccanti (1)

| ID | Componente | Descrizione |
|----|-----------|-------------|
| **HF-1** | Frontend / Client Portal | Welcome page (`/journey/welcome/:token`) resta bloccata su loading screen — **il cliente non riesce mai ad accedere al suo portal** |

*Dipendenza: HF-1 è causato da I18N-1/D-1 (403 su blueprint/i18n/it-IT)*

---

### P1 — Critici (11)

| ID | Componente | Descrizione |
|----|-----------|-------------|
| **D-1 / I18N-1** | Backend API i18n | `GET /api/blueprint/i18n/it-IT` → 403. Frontend invia `it-IT` ma backend accetta solo `it`. Causa il blocco dell'intera app. |
| **I18N-2** | Backend API i18n | `GET /api/blueprint/i18n/fr-FR` → 403. Stesso problema. Tutti gli utenti francesi bloccati. |
| **I18N-3** | Backend API i18n | `GET /api/blueprint/i18n/de-DE` → 403. Tutti gli utenti tedeschi bloccati. |
| **I18N-4** | Backend API i18n | `GET /api/blueprint/i18n/es-ES` → 403. Tutti gli utenti spagnoli bloccati. |
| **D-2** | Backend / Storefront | Slug `i18n-recovery-1` non mappa a configurazione tenant valida → 404 |
| **HF-2** | Frontend / Sito pubblico | Homepage mostra chiavi editoriali raw (`HERO_EDITORIAL`) invece del copy |
| **AUTH-1** | Auth | `ogrisekadvisor@gmail.com` login fallisce con "Invalid login credentials" |
| **LC-1** | Backend / Lifecycle | `accounts.lifecycle_stage` non avanza da `prospect` → `active` dopo journey creation |
| **LC-2a** | Backend / Lifecycle | `leads.progression_state` non avanza da `lead` → `qualified` dopo journey creation |
| **LC-2b** | Backend / Lifecycle | `leads.first_journey_id` resta NULL dopo journey creation |

---

### P2 — Minori (8)

| ID | Componente | Descrizione |
|----|-----------|-------------|
| **D-3** | Frontend Build | `Module not found: useActiveJourney` in `CreateModal.jsx:395` (warning) |
| **HF-3** | Frontend / Onboarding | Form `/begin-journey` mostra label `I`, `II`, `III` invece del copy editoriale |
| **HF-4** | Frontend / UX | Debug overlay `EDITORIAL · DEBUG` visibile su tutte le pagine (non nascosto in produzione) |
| **AUTH-2** | Auth | Logout non revoca JWT (comportamento Supabase stateless atteso, ma non documentato) |
| **DB-1** | DB / Relazioni | `accounts.relationship_thread_id` = NULL (thread esiste ma non linkato all'account) |
| **DB-2** | DB / Relazioni | `accounts.project_id` = NULL (project esiste ma non linkato all'account) |
| **LC-3** | DB / Leads | `leads.status` mai inizializzato (NULL invece di `active`) |
| **LC-4** | DB / i18n | `leads.locale_code` usa `it-IT` ma `locale_runtime` usa `IT_IT` (incoerenza formato) |

---

## ROOT CAUSES PRINCIPALI

### RC-1: Mismatch BCP-47 tra frontend e backend (causa di P0 + 4×P1)
Il frontend normalizza i locale codes in formato BCP-47 completo (`it-IT`, `fr-FR`). Il backend `platform.py` ha `BLUEPRINT_OPERATIONAL_CODES = ['de', 'en-GB', 'en-US', 'es', 'fr', 'it']` usando short codes per lingue non-inglesi. Il fix richiede aggiungere le varianti BCP-47 nella lista oppure normalizzare lato backend prima del confronto.

### RC-2: `journey_initiate.py` non aggiorna i layer CRM upstream (causa di 4×P1/P2)
Quando viene creato un journey, la catena `design_journeys → accounts → leads` non viene propagata. `accounts.lifecycle_stage` resta `prospect`, `leads.progression_state` resta `lead`, `leads.first_journey_id` resta NULL, `accounts.relationship_thread_id` resta NULL.

### RC-3: Dominio Resend non verificato (causa di P1 email)
API key presente e formalmente valida, ma il dominio mittente `moodfordesign.com` non è stato aggiunto e verificato sulla dashboard Resend. Richiede azione utente.

### RC-4: Slug tenant ambiente ≠ slug configurato nel DB
Il pod Kubernetes usa slug `i18n-recovery-1` ma il tenant nel DB ha slug `studio`. I endpoint che usano lo slug dell'URL (storefront) restituiscono 404.

---

## PROSSIMI STEP RACCOMANDATI

### Da eseguire immediatamente (P0/P1 bloccanti)

1. **[P0 → FIX TECNICO]** Fix `BLUEPRINT_OPERATIONAL_CODES` in `platform.py`: aggiungere `it-IT`, `fr-FR`, `de-DE`, `es-ES` alla lista (mantenere backward compat con short codes). Questo sblocca il P0 HF-1 e i 4 bug i18n in cascata.

2. **[P1 → AZIONE UTENTE]** Verifica dominio Resend: accedere a resend.com/domains → aggiungere `moodfordesign.com` → aggiungere DNS records → attendere propagazione.

3. **[P1 → FIX TECNICO]** Fix `journey_initiate.py` lifecycle propagation: dopo la creazione del journey, aggiornare `accounts.lifecycle_stage = 'active'`, `leads.progression_state = 'qualified'`, `leads.first_journey_id = journey_id`.

4. **[P1 → AZIONE UTENTE]** Reimpostare password per `ogrisekadvisor@gmail.com` in Supabase Auth Dashboard.

### In seguito (P2)

5. Fix `accounts.relationship_thread_id` e `accounts.project_id` in `journey_initiate.py`
6. Rimuovere o nascondere debug overlay `EDITORIAL · DEBUG` in modalità non-debug
7. Fix `CreateModal.jsx:395` — `useActiveJourney` → `useActiveJourneys`
8. Inizializzare `leads.status = 'active'` alla creazione

---

## NOTE FINALI

- **Il DB è pulito:** 0 account duplicati, 0 lead duplicati, 0 thread orfani nel senso stretto
- **La deduplicazione P0-A funziona:** secondo submit → `action=resumed`, stessa chain
- **La lifecycle P0-D funziona:** `design_journeys.lifecycle_state = in_progress` confermato
- **Il fix P1-A human_assignment funziona:** `super_admin` non assegnato, `assignee=null`
- **Il blocco principale per go-live client è RC-1** (bug i18n BCP-47 in `platform.py`)

---

*Report prodotto da: POST-STABILIZATION VALIDATION SPRINT · 2026-06-14*  
*Metodologia: Zero modifiche al codice · Solo osservazione e documentazione*
