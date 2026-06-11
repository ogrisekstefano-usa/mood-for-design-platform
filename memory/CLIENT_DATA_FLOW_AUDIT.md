# CLIENT DATA FLOW AUDIT
> Prodotto: 11 giugno 2026
> Tipo: AUDIT READ-ONLY — NESSUN CODICE PRODOTTO
> Istruzioni: approvare il piano di consolidamento prima di procedere ai fix.

---

## ESECUTIVO: IL PROBLEMA REALE

MOOD ha **3 strade parallele** che creano un cliente, e nessuna di esse è sincronizzata con le altre. Il risultato è:
- Dati duplicati o orfani
- Journey senza proprietario cliente corretto  
- Session leakage quando admin e cliente usano lo stesso browser
- Email che non consegnano (domain non verificato)
- Messaggi che non generano notifiche email

---

## 1. TUTTI I PUNTI DI CREAZIONE CLIENTE

### Strada A — PUBLIC JOURNEY INITIATE
**File:** `backend/routers/journey_initiate.py` → `POST /api/public/journeys/initiate`
**Chi lo chiama:** `BeginJourneyPage.jsx` (form pubblico, no auth)

**Cosa crea:**
1. `accounts` (account del cliente)
2. `contacts` (contatto collegato all'account)
3. `projects` (progetto)
4. `design_journeys` (journey)
5. `design_journey_milestones` × 10
6. `journey_timeline_events`
7. `design_journey_assignments` (owner — **APPENA FIXATO**)
8. `human_assignments` (assegnazione referente)
9. → poi chiama `provision_client_after_journey()` in background (async)

**`provision_client_after_journey()` crea:**
1. `auth.users` (Supabase, se non esiste) via admin API
2. `users_profile` (role = client)
3. Aggiorna `projects.client_user_id`
4. `relationship_threads` (thread conversazione)
5. `relationship_messages` (messaggio di benvenuto)
6. Genera magic link → manda email tramite `email_service.send_email(template='magic_link')`

---

### Strada B — LEAD CONVERSION
**File:** `backend/routers/lead_conversion.py` → `POST /api/leads/{id}/start-journey`
**Chi lo chiama:** CRM interno (admin loggato)

**Cosa crea:**
1. `design_journeys`
2. `design_journey_milestones` × 10
3. `design_journey_assignments` (owner — **APPENA FIXATO**)
4. → chiama `provision_client_after_journey()` in background

**Prerequisito:** Il lead deve già esistere e avere `account_id`.

---

### Strada C — CRM CREATE JOURNEY
**File:** `backend/routers/account_journeys.py` → `POST /api/accounts/{id}/journeys`
**Chi lo chiama:** CRM interno su Account esistente

**Cosa crea:**
1. `design_journeys`
2. `design_journey_assignments` (owner — già funzionante)
3. **NON chiama `provision_client_after_journey()`** direttamente — assume che il cliente esista già

---

### Strada D — LAZY INIT (trigger implicito)
**File:** `backend/routers/design_journey.py` → `GET /api/projects/{id}/journey`
**Chi lo chiama:** Qualunque pagina che accede alla scheda journey di un progetto

**Cosa crea:**
1. `design_journeys` (se non esiste ancora)
2. `design_journey_milestones` × N (default milestones)
3. `journey_timeline_events`
4. `design_journey_assignments` (owner — **APPENA FIXATO**)
5. **NON crea** `auth.users`, **NON crea** `users_profile`, **NON manda** email

---

## 2. TUTTI I PUNTI DI RACCOLTA DATI CLIENTE

| Punto | Dati raccolti | Salvato dove |
|---|---|---|
| `BeginJourneyPage` Step 1 | `first_name`, `last_name`, `email`, `phone`, `country_code` | `accounts` + `contacts` + `welcome` JSON |
| `BeginJourneyPage` Step 2 | `space_kinds`, `how_to_feel`, `references` | `design_journeys.atmosphere_json` |
| `BeginJourneyPage` Step 3 | `guests`, `materials`, `ambiance` | `design_journeys.lifestyle_json` |
| CRM Create Lead | `first_name`, `last_name`, `email`, `phone`, `source`, `lead_type` | `leads` |
| CRM Lead Qualification | `project_type`, `timeline`, `budget`, `interest` | `leads.qualification_json` |
| Client Profile (Brief Guidato) | Tutte le preferenze progettuali | `client_brief_responses` (?) |
| Relationship Messages | Testo libero cliente | `relationship_messages` + `relationship_memory_fragments` |

**PROBLEMA:** `BeginJourneyPage` raccoglie dati progettuali (Step 2, 3) e li salva direttamente in `design_journeys`. Il Brief Guidato è SEPARATO. Quindi i dati dello Step 2/3 possono divergere dal brief formale.

---

## 3. CAMPI DUPLICATI IDENTIFICATI

| Dato | Duplicato 1 | Duplicato 2 | Fonte di verità |
|---|---|---|---|
| `email` cliente | `accounts.email` | `contacts.email` + `users_profile.email` + `leads.email` | **INCERTO** — 3 fonti |
| `first_name` | `accounts.primary_contact_name` | `contacts.first_name` + `users_profile.first_name` | **INCERTO** |
| `phone` | `contacts.phone` | `users_profile.phone` (?) + `leads.phone` | **INCERTO** |
| Owner journey | `design_journey_assignments.user_id` | `projects.assigned_to` | **DUE SISTEMI PARALLELI** |
| ID cliente | `projects.client_user_id` (FK users_profile) | `design_journeys.account_id` (FK accounts) | **DUE SISTEMI** |
| Status conversazione | `relationship_threads.status` | `design_journey_milestones.status` (Brief milestone) | **NON ALLINEATI** |

---

## 4. HARDCODED TROVATI — INVENTARIO COMPLETO

### 4.1 Backend (file attivi — NON script/seed)

| File | Riga | Valore | Tipo |
|---|---|---|---|
| `routers/leads.py` | 106 | `"Marco Rossi"` | Nome hardcoded in GET leads response |
| `routers/demo.py` | 29, 68 | `"demo@moodfordesign.com"` | Credenziali demo |
| `routers/tenant_email_governance.py` | 102 | `"Maria Bianchi"` | Preview email template |
| `routers/tenant_email_governance.py` | 105-106 | `"Stefano Rossi"` (x2) | Preview email template |
| `services/brand_designer_registry.py` | 37 | `"Marco Acerbis"` | Profilo designer hardcoded |
| `services/brand_designer_registry.py` | 62 | `"Stefano Cavazzana"` | Profilo designer hardcoded |

### 4.2 Frontend (file attivi)

| File | Riga | Valore | Tipo |
|---|---|---|---|
| `pages/admin/EmailTemplatesPage.jsx` | 258 | `"Maria Bianchi · Villa Lago · Stefano Rossi · MOOD for DESIGN"` | Preview template email |
| `presets/client-profile/atelier/AtelierNotifications.jsx` | 7 | `"Stefano ti..."` | Commento con nome proprio |
| `components/client/CuratorialTeamCluster.jsx` | 10 | `"Stefano · In studio"` | Commento con nome proprio |
| `lib/initials.js` | 17 | `"Stefano Ogrisek"` | Esempio hardcoded in commento |

### 4.3 Classificazione criticità

| Priorità | Tipo | Impatto |
|---|---|---|
| 🔴 P0 | `routers/leads.py` L106: `"Marco Rossi"` | Appare nella risposta API reale — dati falsi in production |
| 🔴 P0 | `services/brand_designer_registry.py`: nomi designer | Vengono serviti al frontend come dati reali del team |
| 🟠 P1 | `tenant_email_governance.py`: Maria Bianchi / Stefano Rossi | Preview visibile agli admin del tenant |
| 🟠 P1 | `EmailTemplatesPage.jsx`: stessi nomi | Preview visibile agli admin del tenant |
| 🟡 P2 | `demo.py`: demo@moodfordesign.com | Credenziali demo hardcoded (non critical se il router è nascosto) |
| 🟢 P3 | Commenti con nomi propri | Non impatta produzione, solo leggibilità |

---

## 5. SESSION LEAKAGE — BUG P0

### 5.1 Root Cause Identificata

**Il bug principale:** `_ensure_profile()` in `client_provisioning.py` cerca il profilo solo per `auth_user_id` — **senza filtrare per `tenant_id`**.

```python
# client_provisioning.py L142-143
existing = (c.table("users_profile").select("*")
            .eq("auth_user_id", auth_user_id).limit(1).execute().data or [])
```

**Percorso del bug:**
1. Admin A è loggato. Crea lead con email `admin@moodfordesign.com` (o qualunque email già registrata in Supabase).
2. `_find_auth_user(email)` — cerca a livello globale Supabase, non per tenant.
3. Trova l'auth.user di Admin A (perché l'email esiste).
4. `_ensure_profile(auth_user_id = admin_A_id)` — trova e restituisce il profilo di Admin A.
5. `projects.client_user_id = admin_A_profile_id` — il journey è "intestato" ad Admin A.
6. Admin A può ora accedere alla client portal del proprio journey nel suo stesso contesto admin.

### 5.2 Secondo vettore (preview/dev)

**Il bug supplementare:** `BeginJourneyPage.jsx` riceve il `magic_link_url` e lo passa come param `m` a `/journey/preparing`.

```javascript
if (magicLink) params.set('m', magicLink);
navigate(`/journey/preparing?${params.toString()}`, ...);
```

**Percorso del bug:**
1. Admin A (loggato) apre il form pubblico nel STESSO browser.
2. Submits form con email B.
3. Naviga a `/journey/preparing?m=<magic_link_for_B>`.
4. Se Admin A clicca il bypass link `m=` nel preview env → `AuthClientCallback` viene chiamato.
5. `AuthClientCallback` scrive `mfd_session` in localStorage con i token del client B.
6. Sessione Admin A sovrascritta. Admin A è ora loggato come Client B.

### 5.3 Terzo vettore (portal access)

**Il bug di portal ownership:** `/api/journeys/mine` (usato da `AuthClientCallback` riga 177) cerca:
```
GET /api/journeys/mine → projects WHERE projects.client_user_id = current_profile_id
```
Se `client_user_id` punta al profilo di Admin A (scenario 5.1), il client reale (email B) NON troverà mai il suo journey. Vedrà il welcome screen in loop.

---

## 6. EMAIL DELIVERY AUDIT

### 6.1 Pipeline attuale

```
email_service.send_email(template, ctx)
  ↓
_send_via_resend(from, to, subject, html)
  ↓
Resend API (provider_message_id?)
  ↓
email_events row (status: sent|failed)
```

### 6.2 Stato reale (ultimo check: 11 Jun 2026)

| Metrica | Valore |
|---|---|
| EMAIL_PROVIDER | `resend` |
| RESEND_API_KEY | SET (presente in env) |
| EMAIL_FROM | `MOOD for DESIGN™ <no-reply@mail.moodfordesign.com>` |
| Dominio `moodfordesign.com` verificato su Resend | ❌ **NO** |
| Ultimi 5 invii | ❌ TUTTI `status: failed` |
| Errore Resend | `"The moodfordesign.com domain is not verified"` |
| `magic_link` consegnato? | ❌ NO — ogni tentativo fallisce |
| `space_ready` consegnato? | ❌ NO |
| `generic` consegnato? | ❌ NO |

### 6.3 Conseguenza

**Ogni magic link generato NON viene mai consegnato al cliente.** Il flusso:
1. Client B invia form ✅
2. Journey creato ✅
3. Magic link generato da Supabase ✅
4. Email inviata a Resend ❌ → FALLISCE
5. Client B non riceve mai l'accesso ❌

Il cliente rimane **bloccato su `/journey/preparing`** senza mai poter accedere al proprio spazio.

**Unica via di accesso:** Il bypass URL `m=<magic_link>` nella pagina `/journey/preparing` — che però crea il session leakage descritto sopra.

---

## 7. MESSAGING AUDIT

### 7.1 Pipeline `send_message`

| Step | Implementato? | Dove |
|---|---|---|
| `relationship_messages` row creata | ✅ SÌ | `relationship_conversation.py` L395 |
| `relationship_threads.unread_for_designer` incrementato | ✅ SÌ | L401-412 |
| `relationship_threads.unread_for_client` incrementato | ✅ SÌ | L401-412 |
| `relationship_events` (timeline) creato | ✅ SÌ | L416 |
| `relationship_memory_fragments` creato (se > 200 chars) | ✅ SÌ | L435-459 |
| `relationship_notifications` creata | ❌ NO — mancante | — |
| `notifications` creata | ❌ NO — mancante | — |
| Badge incrementato (`notification_categories.unread_count`) | ❌ NO — non collegato al send_message | — |
| Email al designer (notifica nuovo messaggio) | ❌ NO — non implementato | — |
| Email al client (risposta dal designer) | ❌ NO — non implementato | — |
| Push web notification | ❌ NO | — |

### 7.2 Conseguenza

Il badge notifiche nel workspace admin NON si aggiorna quando il cliente invia un messaggio. Il designer non riceve notifica email. Solo il contatore `unread_for_designer` nella tabella `relationship_threads` è aggiornato, ma questo richiede refresh manuale della UI.

---

## 8. BRIEF GUIDATO — CONFRONTO CON RACCOLTA LEAD

### Il problema di naming nell'issue utente

L'utente dice:
> "APPROFONDIMENTO NON raccolta lead. Lead → Client Profile → Brief Guidato → Progetto"

L'interpretazione corretta:
- Il **BeginJourneyPage** attuale raccoglie dati (Step 2-3: atmosfera, lifestyle) → questi vengono salvati come `atmosphere_json` e `lifestyle_json` nel journey
- Questo è il **brief grezzo** immediato, non strutturato
- Il **Brief Guidato** dovrebbe essere un flusso separato, post-autenticazione, dentro il Client Profile
- Attualmente NON esiste un percorso separato `Client Profile → Brief Guidato` dopo il login

**Gap:** Non esiste una pagina dedicata al "Brief Guidato" post-auth nel client portal. I dati del brief sono raccolti PRIMA del login (step 2-3 del form pubblico) e salvati nel journey, non in un modulo strutturato separato.

---

## 9. PIANO DI CONSOLIDAMENTO

### 9.1 Fix P0 (sessione, email, leads) — BLOCCANTI

| # | Fix | File | Impatto |
|---|---|---|---|
| F1 | Aggiungere `.eq("tenant_id", tenant_id)` in `_ensure_profile()` | `client_provisioning.py` L142 | Elimina session leakage da profili cross-tenant |
| F2 | Verificare dominio `moodfordesign.com` su Resend.com (azione utente) | — | Sblocca tutta la delivery email |
| F3 | Rimuovere `"Marco Rossi"` hardcoded in `leads.py` L106 | `routers/leads.py` | Evita dati falsi in API response |
| F4 | Rimuovere nomi hardcoded da `brand_designer_registry.py` | `services/brand_designer_registry.py` | Dati reali al frontend |
| F5 | Bloccare il bypass `magic_link` param `m=` in `/journey/preparing` se c'è sessione admin attiva | `JourneyPreparingPage.jsx` | Previene overwrite sessione admin |

### 9.2 Fix P1 (validazione email, messaging) — IMPORTANTI

| # | Fix | File | Impatto |
|---|---|---|---|
| F6 | Email validation real-time (syntax + existing user check) | `BeginJourneyPage.jsx` + `/api/public/check-email` | UX più chiara, evita duplicati |
| F7 | Aggiungere notifica in `send_message` | `relationship_conversation.py` L394 | Badge + email notifica designer |
| F8 | Rimuovere nomi hardcoded da `tenant_email_governance.py` | `routers/tenant_email_governance.py` L102-106 | Preview template neutro |
| F9 | Rimuovere nomi hardcoded da `EmailTemplatesPage.jsx` | `pages/admin/EmailTemplatesPage.jsx` L258 | Preview template neutro |

### 9.3 Fix P2 (consolidamento dati, brief guidato) — STRUTTURALI

| # | Fix | Descrizione |
|---|---|---|
| F10 | Definire fonte di verità per `email` cliente | `users_profile.email` = fonte primaria, sync dagli altri |
| F11 | Sincronizzare `projects.assigned_to` con `design_journey_assignments.owner` | Allineamento due sistemi |
| F12 | Creare percorso `Client Profile → Brief Guidato` post-auth | Nuovo flusso nel client portal |
| F13 | Deprecare `atmosphere_json`/`lifestyle_json` come brief — migrarli nel Brief Guidato | Unica fonte dati progetto |

---

## 10. DIAGRAMMA FLUSSO CORRETTO (obiettivo)

```
[FORM PUBBLICO]
PUBLIC JOURNEY SUBMIT (email, nome, atmosfera, lifestyle)
        ↓
[BACKEND — TRANSAZIONE ATOMICA]
1. accounts INSERT
2. contacts INSERT
3. projects INSERT
4. design_journeys INSERT
5. milestones × 10 INSERT
6. design_journey_assignments (owner) INSERT
7. human_assignments (referente) INSERT
        ↓
[BACKGROUND — PROVISION CLIENT]
8. auth.users FIND-OR-CREATE per email
   └─ DEVE usare tenant_id come scope aggiuntivo
9. users_profile FIND-OR-CREATE (filtrare per tenant_id)
   └─ Se esiste admin con stessa email → ERRORE, non riusare
10. projects.client_user_id UPDATE
11. relationship_threads INSERT
12. relationship_messages INSERT (messaggio benvenuto)
13. email_events INSERT + Resend API CALL
        ↓
[CLIENT — EMAIL]
Magic link consegnato (richiede dominio Resend verificato)
        ↓
[CLIENT — BROWSER]
/auth/client/callback#access_token=...
        ↓
[CLIENT — SESSION ISOLATA]
AuthClientCallback: installa sessione SOLO se non c'è sessione admin attiva
        ↓
[CLIENT PORTAL]
/client/welcome → /client/profile → /journey/:id
        ↓
[BRIEF GUIDATO — POST AUTH]
Client compila brief strutturato (dati progettuali)
        ↓
[DESIGN JOURNEY WORKSPACE]
Moodboard → Proposta → Milestone
```

---

## 11. REGOLA DI CONSOLIDAMENTO

```
UNA sola entità cliente = auth.users (Supabase) + users_profile (tenantizzato)
UNA sola fonte email = users_profile.email (sincronizzata dagli altri)
UN solo profilo per auth_user_id × tenant_id (NON globale)
UN solo journey attivo per progetto (design_journeys)
UN solo owner del journey (design_journey_assignments role=owner, revoked_at NULL)
```

Tutto il resto è derivato dalla catena:
```
auth.users → users_profile → accounts → projects → design_journeys → milestones
```

---

## NOTE TECNICHE

- `_find_auth_user()` è globale per progetto Supabase, non per tenant. Questo è CORRETTO — un utente email B deve avere UN SOLO auth.user indipendentemente da quanti tenant lo conoscono. Il problema non è qui.
- Il problema è `_ensure_profile()` che non filtra per `tenant_id`. Un utente può avere UN profilo per tenant.
- Il bug di sessione in preview dipende dal bypass `m=` URL param. In produzione (con domini separati), questo non si verificherebbe perché il magic link punta a `blueprint.moodfordesign.com` e non al preview domain.
- Il vettore più realistico del bug in produzione è l'overlap email (admin crea un lead con la propria email per testare) + mancanza di guard in `_ensure_profile()`.
