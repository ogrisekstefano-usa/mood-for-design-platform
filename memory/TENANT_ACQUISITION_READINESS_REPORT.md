# TENANT ACQUISITION READINESS REPORT

> **Data**: 2026-06-02 00:55 UTC
> **Audit eseguito su**: 3 submission reali end-to-end (`readiness.1780361882`, `readiness.1780361945`, `readiness.1780362022@moodtest.example.com`)
> **Classificazione finale**: ⚠ **NEEDS_ITERATION** — il flow Visitor→Activated funziona perfettamente, ma **manca il bridge automatico Activated→Tenant Created→Founder Magic Link**.

---

## 0. EXECUTIVE SUMMARY

Il funnel Studio V2 raccoglie i dati correttamente, le email transazionali partono, l'advisor può lavorare la richiesta nel Command Center fino allo stato `activated`. **Da `activated` in poi il lifecycle si interrompe**:

- Nessun tenant viene creato automaticamente.
- Nessun magic link viene emesso al founder.
- Nessuna `users` row viene creata per il founder.
- Il founder **non può accedere al Blueprint** finché un advisor (o super admin) non clicca **manualmente** "Activate Ecosystem" su una `studio_relation` collegata.

Il sistema è **operativamente pronto** ad accettare tenant reali, **ma serve un advisor umano in mezzo** per completare la transizione. Per "ready for real tenants" autonomi serve chiudere il gap.

---

## 1. TASK 1 — END-TO-END AUDIT (FASE PER FASE)

### 1.1 Studio V2 Submit → **PASS** ✅

| Verifica | Valore osservato | Esito |
|---|---|---|
| Submit HTTP 200 | `{"ok": true, "reference": "MOOD-6BFE-93AE"}` | ✅ |
| `studio_requests` row | id `6bfe93ae-...`, status `received` | ✅ |
| `primary_operating_market_id` | popolato (UUID FK markets.italy) | ✅ |
| `headquarter_country_iso/city/lat/lng/place_id/region` | tutti popolati (IT/Padua/45.40779/11.876048/place.39233648/Padua) | ✅ |
| `target_countries` bridge | 3 righe (US/AE/GB) con priority 1-3 e status active/planned | ✅ |
| `archetype` | `interior_studio` | ✅ |
| `locale` preservato | `it-IT` | ✅ |

### 1.2 Email Visitor → **PASS** ✅

| Verifica | Valore osservato | Esito |
|---|---|---|
| Template inviato | `studio_request_received` | ✅ |
| Destinatario | `readiness.1780362022@moodtest.example.com` | ✅ |
| Locale | `it-IT` | ✅ |
| Status dispatch | `sent` | ✅ |
| Subject contiene reference | `Abbiamo ricevuto la tua candidatura · MOOD-...` | ✅ |

### 1.3 Email Advisor → **CONDITIONAL** ⚠

| Verifica | Stato |
|---|---|
| Template registrato e funzionante | ✅ (`advisor_new_lead`, 3 dispatch storici verificati) |
| Inviato sulla submission readiness | ❌ NO |
| Causa | **By design**: `advisor_new_lead` parte solo quando `attribution_advisor_id` è impostato (visitor proveniente da link referral di un advisor specifico). Per submission organiche → la richiesta entra nel pool unassigned e va lavorata dal Command Center con self-claim. |

**Implicazione operativa**: oggi non c'è notifica automatica all'advisor di un nuovo lead organico. L'advisor deve **andare attivamente** al Command Center per scoprire nuove richieste. Per un'operatività a regime servirà un **digest pool** o una notifica al "default advisor" per submission senza referral.

### 1.4 Email Super Admin → **PASS** ✅

| Verifica | Valore osservato | Esito |
|---|---|---|
| Template inviato | `admin_new_studio_request` | ✅ |
| Destinatario | `admin@moodfordesign.com` | ✅ |
| Status dispatch | `sent` | ✅ |
| Subject | `[MOOD] Nuova candidatura · Sofia Readiness (MOOD-...)` | ✅ |
| Request visibile in `/api/admin/tenant-activation/pipeline` | ✅ (bucket `new`) | ✅ |

### 1.5 Advisor Review (Command Center) → **PASS** ✅

| Verifica | Valore osservato | Esito |
|---|---|---|
| Visibile nel pipeline | ✅ (bucket `new` con geo completo) | ✅ |
| Transizione `received → reviewing` | HTTP 200, ok=true | ✅ |
| Transizione `reviewing → contacted` | HTTP 200, ok=true | ✅ |
| Transizione `contacted → qualified` | HTTP 200, ok=true | ✅ |
| Transizione `qualified → activated` | HTTP 200, ok=true | ✅ |
| `reviewed_at` popolato in DB | ✅ | ✅ |

### 1.6 Tenant Activation → **FAIL** ❌

**Risultato**: NESSUN tenant creato per la submission `readiness`.

| Verifica | Stato |
|---|---|
| `tenants` row creata dopo `activated` | ❌ |
| `studio_relations` row creata | ❌ |
| `tenant_memberships` row creata | ❌ |
| Causa | Il PATCH `/api/admin/studio/requests/{id}` con `status=activated` aggiorna SOLO la colonna `studio_requests.status`. NON invoca `studio_relations.activate_studio_ecosystem()`, che è la funzione che crea tenant + studio_relations + memberships. Quella va chiamata SEPARATAMENTE via `POST /api/admin/relations/{relation_id}/activate-ecosystem`. |

**Dati DB attuali** (snapshot):
- `studio_requests` con status `activated`: **10**
- `tenants` totali: **8** (di cui 4 active, 4 archived)
- `studio_relations`: **4** (tutti da una vecchia simulazione E2E del 1° giugno, contact `simulation+e2e@moodfordesign.com`)
- Le mie 3 submission `readiness.*` (status `activated`): **0 tenant creati, 0 relazioni, 0 memberships**

**Per essere chiari**: il flow esiste ma è in **due passaggi disgiunti**. Il primo passo (qualify → activate request) è automatizzato e funziona. Il secondo (creazione tenant + provisioning advisor) richiede un click manuale separato dal Command Center.

### 1.7 Founder Invitation → **FAIL** ❌

| Verifica | Stato |
|---|---|
| `access_magic_links` row per il founder | ❌ 0 record |
| Email `studio_request_approved` inviata | ✅ (1, status `sent`, subject `Il tuo Blueprint è pronto · Sofia Readiness`) |
| Tabella magic links presente in DB | ✅ (`access_magic_links` esiste) |
| Causa | Il template `studio_request_approved` informa che "il Blueprint è pronto" ma **non contiene un magic link funzionante**. Il founder dovrebbe andare su `/accedi` e richiedere a mano un magic link, MA — siccome la sua `users` row non esiste — non può nemmeno richiederlo. |

### 1.8 Founder Access (Blueprint) → **FAIL** ❌

| Verifica | Stato |
|---|---|
| `users` row per founder email | ❌ 0 record |
| Login possibile | ❌ |
| Accesso a `/blueprint/` | ❌ |
| Causa | Senza `users` row + `tenant_memberships` row, qualunque tentativo di login fallisce. Anche se si arrivasse a `/blueprint/`, il middleware tenant resolver non troverebbe alcuna membership attiva. |

---

## 2. TASK 1 — RIEPILOGO PASS/FAIL

| Fase | Esito |
|---|---|
| 1. Studio V2 Submit | ✅ **PASS** |
| 2. Email Visitor | ✅ **PASS** |
| 3. Email Advisor | ⚠ **CONDITIONAL** (by design, no notify for unassigned) |
| 4. Email Super Admin | ✅ **PASS** |
| 5. Advisor Review | ✅ **PASS** |
| 6. Tenant Activation | ❌ **FAIL** (no auto-creation) |
| 7. Founder Invitation | ❌ **FAIL** (no magic link issued) |
| 8. Founder Access | ❌ **FAIL** (no user, no membership) |

**Conclusione TASK 1**: il flow funziona end-to-end **fino allo stato "activated"**. Da lì in poi richiede intervento manuale dell'advisor in **due punti distinti** (creazione tenant + invio invito founder). Il P0 dichiarato dall'utente "lifecycle end-to-end senza salti" **non è soddisfatto**.

---

## 3. TASK 2 — DATA COLLECTION AUDIT

### 3.1 Campi richiesti vs raccolti

| Campo richiesto | Esiste | Sorgente | Valore di test |
|---|---|---|---|
| `operating_market` | ✅ | `studio_requests.primary_operating_market_id` (UUID FK→markets) | `<UUID di market italy>` |
| `headquarter_country` | ✅ | `studio_requests.headquarter_country_iso` (CHAR ISO2) | `IT` |
| `headquarter_city` | ✅ | `studio_requests.city` (TEXT) | `Padua` |
| `latitude` | ✅ | `studio_requests.headquarter_lat` (DOUBLE PRECISION) | `45.40779` |
| `longitude` | ✅ | `studio_requests.headquarter_lng` (DOUBLE PRECISION) | `11.876048` |
| `target_countries` | ✅ | `studio_request_target_countries` bridge (`iso2, priority, status`) | 3 paesi US/AE/GB |
| `languages` | ⚠ | `studio_requests.languages` (TEXT[]) — colonna presente MA **NON popolata dal funnel V2** | `NULL` (mai chiesto al visitor) |
| `specializations` | ⚠ | `studio_requests.archetype` (TEXT, single value) | `interior_studio` (singolo) |
| `project_types` | ❌ | Non c'è una colonna dedicata. `help_topics` vive in tabella separata (`studio_request_help_topics`) ma **rappresenta "temi di supporto richiesto"**, non tipologie di progetto. | N/A |

### 3.2 Gaps DB-side

- **`languages`**: colonna `studio_requests.languages` ARRAY esiste (legacy V1) MA il funnel V2 non chiede al visitor in che lingue lavora lo studio. Persa l'occasione di filtrare advisor per lingua.

- **`specializations`**: l'`archetype` è singolo (un solo valore tra `interior_design`, `architecture`, `product_design`...). Studi reali hanno spesso 2-3 specializzazioni (es. *interior + hospitality + retail*). Persa granularità per matching e dashboard.

- **`project_types`**: assente completamente. Sapere se uno studio fa principalmente *residential*, *hospitality*, *retail*, *office*, *healthcare*, *cultural*, *masterplanning* è essenziale per:
  - filtrare la Material Library presentata al founder,
  - suggerire case studies pertinenti,
  - prezzare il Blueprint per segmento di mercato,
  - clusterizzare la geografia commerciale.

### 3.3 Cosa rischiamo di perdere

Le 3 submission `readiness` di oggi e tutte le future:
- Avranno `archetype = "interior_studio"` (granularità grossolana).
- Avranno `languages = NULL` (impossibile fare matching multilingue advisor↔founder).
- Non sapremo se lo studio fa hospitality o retail o residential.
- **Tutto questo è perso definitivamente** se non lo chiediamo al momento della submission. Recuperarlo post-activation costa una chiamata commerciale separata per ogni tenant.

---

## 4. TASK 3 — GAP ANALYSIS CON PRIORITY

### P0 — bloccanti per "Real Tenants"

| Gap | Sintesi | Effort reale | File coinvolti |
|---|---|---|---|
| **P0-1** Bridge `activated`→`tenant created` | Quando un super-admin/advisor segna una richiesta come `activated`, deve essere creato AUTOMATICAMENTE: `studio_relations`, `tenants`, `users` (founder), `tenant_memberships`. Oggi è un secondo click manuale isolato. | **6h** | `services/studio_activation.py::update_request_status` (hook); `services/studio_relations.py::activate_studio_ecosystem` (chiamata diretta dal hook); test E2E aggiornato |
| **P0-2** Magic link automatico al founder | Quando tenant viene creato, emettere `access_magic_links` row e iniettare il magic link nel template `studio_request_approved`. Founder clicca → atterra loggato. | **3h** | `services/access_continuity.py::issue_magic_link` (già esistente, manca solo l'hook); aggiornamento template CMS `studio_request_approved` con placeholder `{{magic_link_url}}` |
| **P0-3** Founder access verification | Verificare che il magic link risolva correttamente il tenant per il founder e atterri su `/blueprint/`. | **2h** | router `/api/auth/magic/redeem` (esistente, da testare con questo flow) |

**Effort P0 totale**: **~11h** (1.5 sprint giorni).

### P1 — Forte impatto su Real Tenants ma non bloccanti

| Gap | Sintesi | Effort reale |
|---|---|---|
| **P1-1** Advisor notify per pool unassigned | Notificare un "default advisor" (o digest 1×/giorno al pool) quando arriva una submission senza referral. Oggi il lead è invisibile finché qualcuno non guarda manualmente il Command Center. | 3h |
| **P1-2** Specializations multi-value | Migrare `archetype` singolo a `specializations` array, esponendo 3-4 checkbox addizionali nel Step 1 V2. Schema additivo, no breaking change. | 4h |
| **P1-3** Studio languages | Aggiungere step nel funnel V2 (o sub-section Step 3) "In che lingue lavora lo studio?" con checkbox da `platform_languages`. Popolare `studio_requests.languages`. | 2h |
| **P1-4** Project types | Nuovo step facoltativo nel funnel V2 (max 3 checkbox: residential/hospitality/retail/office/healthcare/cultural/masterplanning). Nuova tabella `studio_request_project_types` o ARRAY column. | 5h |

**Effort P1 totale**: **~14h**.

### P2 — Nice-to-have

| Gap | Sintesi | Effort reale |
|---|---|---|
| **P2-1** Welcome email founder | Email separata "tenant_welcome" diversa da `studio_request_approved`. Più editoriale, con next-step concreti. | 2h |
| **P2-2** Profile founder pre-popolato | Quando si crea il founder, pre-popolare `users.first_name/last_name` dalla submission. Già fatto in parte? Da verificare. | 1h |
| **P2-3** Audit trail unificato | Tabella `tenant_audit_log` che traccia: request_received, request_qualified, tenant_created, magic_link_issued, founder_signed_in, blueprint_opened. Già parzialmente coperto da `studio_email_dispatch_log` + `tenant_activity_events`. | 4h |

**Effort P2 totale**: **~7h**.

---

## 5. CLASSIFICAZIONE FINALE

### ⚠ **NEEDS_ITERATION**

**Motivazione**: il funnel di acquisizione e la pipeline di review sono solidi. Le email partono. I dati geografici si persistono perfettamente (post-Mapbox fix). Il Command Center è operativo. **Ma il sistema non è autonomo nel completare la transizione "Activated → Founder Blueprint Access"** — richiede 2 click manuali separati dell'advisor in 2 punti diversi del Command Center.

Per chiamare il sistema `READY_FOR_REAL_TENANTS`, **devono essere chiusi i 3 gap P0**. Le iterazioni P1/P2 sono raffinamenti (più dati, più automazione, più audit), non blocchi.

### Cosa esiste già di solido
- ✅ Studio V2 funnel completo, i18n (it-IT + en-US), Mapbox operativo, no hardcoded
- ✅ DB schema robusto: 39 colonne in `studio_requests`, bridge `studio_request_target_countries`, `access_magic_links`, `tenant_memberships`, `studio_relations`
- ✅ Email pipeline CMS-driven (56 blocchi namespace `email`)
- ✅ Command Center con pipeline buckets + drawer geografia commerciale
- ✅ Lifecycle email per ogni transizione (`review`, `qualified`, `approved`)
- ✅ Activate ecosystem endpoint (`POST /api/admin/relations/{id}/activate-ecosystem`) — chiamato manualmente oggi

### Cosa manca per chiudere
1. **Hook automatico** in `services/studio_activation.py::update_request_status` quando status passa a `activated`: invocare `studio_relations.activate_studio_ecosystem()` (o equivalente). Effort 6h.
2. **Magic link** nel template `studio_request_approved` con placeholder `{{magic_link_url}}` valorizzato in fase di activate. Effort 3h.
3. **Verifica E2E** che il magic link rediriga il founder al Blueprint del proprio tenant. Effort 2h.

**Totale per uscire da NEEDS_ITERATION**: ~11h. Una giornata di lavoro focalizzata.

---

## 6. FILE DI RIFERIMENTO

| Area | File / Path | Note |
|---|---|---|
| Submit V2 | `/app/backend/services/studio_v2.py::submit_request_v2` | OK, popola tutto |
| Status transition | `/app/backend/services/studio_activation.py::update_request_status` | Manca hook `activate_ecosystem` |
| Activate ecosystem | `/app/backend/services/studio_relations.py::activate_studio_ecosystem` | Esiste, va chiamato automaticamente |
| Magic link issue | `/app/backend/services/access_continuity.py::issue_magic_link` | Esiste, va chiamato in activate |
| Email template approved | CMS `editorial_blocks` namespace `email`, key `studio_request_approved.*` | Manca placeholder `{{magic_link_url}}` |
| Magic link redeem | `/app/backend/routers/access.py` (route da verificare) | Esiste, da testare con questo flow |

**JSON dettagliato dell'audit**: `/tmp/readiness_audit.json` (salvato dallo script).
**Script di regressione**: `/app/backend/scripts/tenant_acquisition_readiness_audit.py` — eseguibile a ogni rilascio per validare che le tre fasi P0 restino verdi.

STOP. Nessuna implementazione, nessun deploy. Aspetto autorizzazione per partire con il fix P0-1.
