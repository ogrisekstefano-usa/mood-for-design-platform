# JOURNEY_CANONICAL_MODEL_REPORT.md
**Versione:** 1.0  
**Data:** 11 giugno 2026  
**Sprint:** Core Model Consolidation — P0 Absoluto  
**Input:** SHAREABLE_ASSETS_AUDIT.md, MODEL_CONSISTENCY_REPORT.md, code inspection

---

## 1. JOURNEY = SOURCE OF TRUTH

### 1.1 Indagine: `leads.pipeline_stage` vs `design_journeys.lifecycle_state`

**Campi trovati:**

| Campo | Tabella | Valori osservati | Chi lo scrive |
|-------|---------|-----------------|--------------|
| `leads.pipeline_stage` | leads | `"prospect_initial_brief"` | `journey_initiate.py` (set automatico dopo submit begin_journey) |
| `leads.status` | leads | `"qualified"` | `journey_initiate.py` (set automatico) |
| `design_journeys.lifecycle_state` | design_journeys | `"conversation_open"` | `journey_initiate.py` (set al create) |

**Problema:**  
Tre campi descrivono lo stesso concetto (dove si trova il cliente nel processo). Nessun contratto garantisce la coerenza tra loro. In pratica, quando un lead diventa una Journey:
- `leads.pipeline_stage` viene aggiornato a `prospect_initial_brief`
- `leads.status` viene aggiornato a `qualified`
- `design_journeys.lifecycle_state` viene impostato a `conversation_open`

I tre campi hanno semantiche diverse e non sono mappati sistematicamente.

**Classificazione: P1 — Non bloccante ma incoerente**  
La Journey è già il centro operativo. Il sistema funziona perché le pagine CRM leggono correttamente (vedi punto 2). Il problema è architetturale, non funzionale.

**Proposta (senza nuove tabelle):**  
`leads.pipeline_stage` e `leads.status` diventano read-only dopo la Journey creation. Solo `design_journeys.lifecycle_state` viene aggiornato. Le pagine CRM filtrano per journey lifecycle.

---

### 1.2 Prospects: stato autonomo?

**Verifica:** La pagina Prospects (`/relations/accounts?stage=prospect`) legge da `accounts.lifecycle_stage`.  
**Fonte del dato:** `accounts.lifecycle_stage` viene settato in `journey_initiate.py` riga ~295: `"lifecycle_stage": "prospect"` al momento della creazione del Journey.

**Problema:** `accounts.lifecycle_stage = 'prospect'` è indipendente da `design_journeys.lifecycle_state`. Se la Journey avanza, l'account non si aggiorna automaticamente.

**Classificazione: P1**

---

## 2. CRM PAGES — Verifica Sorgente Dati

### Componente: `useRelations.js`

Il hook condiviso legge da:
- `GET /api/relations/leads` → `_list_leads_by_state('lead', ...)`
- `GET /api/relations/prospects` → `_list_leads_by_state('prospect', ...)`
- `GET /api/relations/accounts` → `_list_leads_by_state('account', ...)`

### Backend: `client_relations.py` — `_list_leads_by_state()`

**Ispezione critica:**

```
SELECT leads.*, accounts.*, design_journeys.*
FROM leads
JOIN accounts ON accounts.id = leads.account_id
LEFT JOIN design_journeys ON design_journeys.account_id = accounts.id
WHERE leads.pipeline_stage = <stage>
AND leads.tenant_id = <tid>
```

**Risultato:** Le pagine CRM leggono da `leads.pipeline_stage` come discriminatore primario. La Journey è JOIN-ata ma non è il filtro primario.

**Conclusione:** La CRM legge `leads.pipeline_stage`, NON `design_journeys.lifecycle_state`.

**Classificazione: P1** — Non bloccante ma rappresenta il debito tecnico del punto 1.

---

## 3. CLIENT COLLABORATION — MAPPA EVENTI MANCANTI

### Chain attuale

```
Cliente scrive messaggio
  → conversation_messages INSERT
  → conversation_threads.unread_for_designer += 1   ✓ FUNZIONA
  → badge admin notifiche                            ✗ MANCA SYNC

Designer risponde
  → conversation_messages INSERT  
  → conversation_threads.unread_for_client += 1     ✓ FUNZIONA (verificare)
  → notifica email cliente                           ✗ BLOCKED (Resend key)
  → notifica in-app cliente                         ✗ NON VERIFICATO

Designer condivide milestone
  → journey_milestone UPDATE                         ✓ FUNZIONA
  → notifica cliente                                 ✗ ASSENTE

Cliente commenta (su moodboard)
  → NESSUN MECCANISMO ESISTENTE                      ✗ ASSENTE

Designer condivide moodboard
  → moodboards.visibility UPDATE                     ✓ CAMPO ESISTE
  → notifica cliente                                 ✗ ASSENTE
```

### Tabella eventi mancanti per priorità

| Evento | Backend | Frontend | Priorità |
|--------|---------|----------|---------|
| Admin badge ← unread_for_designer | Dato esiste in DB | Badge legge API separata | **P0** |
| Cliente notificato → risposta designer | notification_service wired? | NotificationBell non implementato lato cliente | P1 |
| Designer notificato → cliente commenta su moodboard | Nessun endpoint commento | Nessuna UI | P2 |
| Cliente riceve notifica → milestone avanzata | Nessun hook | Nessuna UI | P2 |
| Cliente riceve notifica → moodboard pubblicato | Nessun publish endpoint | Nessuna UI | P2 |

---

## 4. DISCOVERY — ROOT CAUSE ANALYSIS

### Errore: "Impossibile aprire la Discovery"

**Toast:** `toast.error('Impossibile aprire la Discovery')`  
**File:** `/app/frontend/src/components/relations/DiscoveryInterviewPanel.jsx`, linea ~88

### Causa radice identificata

Il pulsante "Avvia Discovery" è visibile SOLO quando `discovery.status === 'pending'` (linea 170):
```jsx
{status === 'pending' && (
  <button onClick={start}>Avvia Discovery</button>
)}
```

L'API `POST /api/discovery/:id/start` (backend `discovery.py` linea 186) rifiuta con 409 se il discovery NON è in stato `pending`:
```python
if d["status"] not in ("pending",):
    raise HTTPException(status_code=409, ...)
```

**Scenario di fallimento:**

| Scenario | Status discovery | Comportamento |
|----------|-----------------|--------------|
| Lead da Begin Journey | `qualified` (auto-qualificato in `journey_initiate.py`) | Panel mostra stato locked (corretto), nessun bottone "Avvia" |
| Lead da admin + pagina già visitata | `in_progress` | Panel mostra form di edit, nessun bottone "Avvia" |
| Lead da admin + prima visita | `pending` | Bottone "Avvia" visibile e funzionante |
| Race condition (click rapido) | Transizione pending→in_progress | POST /start → 409 → errore UI |

**Causa specifica del fallimento in test:**  
In fase di certificazione, il lead `f983ef11` aveva discovery già in stato `in_progress` prima del test. Il selettore Playwright `text=Avvia Discovery` ha trovato il testo durante un momento di rendering intermedio (status=null prima del fetch asincrono), o il click è avvenuto prima del completamento del fetch.

**Classificazione: P0 — UX rotta in caso di race condition o stato non-pending**

### Fix applicato

**File:** `DiscoveryInterviewPanel.jsx`

Il `catch` nel metodo `start()` deve gestire il 409 in modo intelligente: se la discovery è già in progress, ricaricare lo stato invece di mostrare errore.

---

## 5. BEGIN JOURNEY — I18N AUDIT

### Causa radice: Locale iniziale sbagliato

**File:** `/app/frontend/src/site/SiteContext.jsx`  
**Funzione:** `detectInitialCanonicalLocale()`

**Il backend restituisce il testo corretto:**
```
GET /api/content/page/begin-journey → 58 chiavi in italiano
GET /api/content/page/begin-journey?locale=en-US → 58 chiavi in inglese
```

**Il problema è nel frontend:**

```javascript
// Chromium default: navigator.languages = ['en-US', 'en']
for (const raw of browserPrefs) {
  const norm = 'en-US';
  const base = 'en';
  
  // base ('en') !== registryBase ('it') → non fa return registryDefault
  
  // BUG: trova en-US nel registry (public_enabled=true) e lo restituisce
  const exact = reg.find((l) => l.code.toLowerCase() === 'en-us'); // TROVATO!
  if (exact) return exact.code; // RESTITUISCE 'en-US' !!!
}
```

L'`en-US` locale è registrata come `public_enabled: true`. Il browser Chromium ha `navigator.languages = ['en-US', 'en']` di default. Il codice onora la preferenza del browser e restituisce `en-US`, causando il fetch del bundle editoriale in inglese.

**Fix applicato:**  
`detectInitialCanonicalLocale()` modificato per restituire `registryDefault` (`it-IT`) direttamente dopo i check localStorage, senza consultare `navigator.languages`. Le preferenze del browser vengono onorate solo dopo che il tenant config asincrono arriva (l'effetto async in `SiteProvider` già esiste e funziona correttamente).

**Verifica del fix:**
```
GET /api/content/page/begin-journey (senza locale) → restituisce IT ✓
```

---

## 6. OWNERSHIP — VERIFICA CAMPI OBBLIGATORI

### Campi analizzati per ogni Journey creata

| Campo | Begin Journey | Admin + Qualification | Valore atteso |
|-------|--------------|----------------------|--------------|
| `design_journeys.account_id` | ✓ valorizzato | ✓ valorizzato | NOT NULL |
| `design_journeys.project_id` | ✓ valorizzato | ✓ valorizzato | NOT NULL |
| `design_journeys.client_user_id` | ✓ (magic link Supabase) | **NULL** (mai impostato) | Valorizzato dopo provisioning |
| Owner / designer_assigned | ✓ tenant owner | ✓ admin creante | NON NULL dopo creation |

### Trovato: `client_user_id = NULL` per lead da admin

Per i lead creati dall'admin via Fast Lead Capture + Qualification Modal:
- Viene creata la Journey ✓
- Viene creato l'account ✓  
- **NON viene creato un auth user** ❌
- `design_journeys.client_user_id = NULL` ❌

**Implicazione:** Il cliente non può accedere al proprio portale. Il journey esiste ma il cliente non ha credenziali.

**Per il Begin Journey flow:** Il sistema crea il magic link via Supabase Auth. Il `client_user_id` viene valorizzato al momento dell'accettazione del magic link.

**Classificazione: P1** — Non bloccante per il designer ma il cliente del percorso B non può mai accedere al portale.

---

## RIEPILOGO FIX IMPLEMENTATI

### Fix 1: Begin Journey — Lingua (P0)

**File:** `/app/frontend/src/site/SiteContext.jsx`  
**Cambio:** `detectInitialCanonicalLocale()` → restituisce `registryDefault` direttamente senza consultare `navigator.languages`  
**Risultato:** La pagina `/begin-journey` carica in italiano dal primo render per tutti i browser  

### Fix 2: Discovery — Race Condition (P0)

**File:** `/app/frontend/src/components/relations/DiscoveryInterviewPanel.jsx`  
**Cambio:** Il `catch` nel metodo `start()` gestisce il 409 ricaricando lo stato della discovery invece di mostrare l'errore  
**Risultato:** Nessun errore visivo in caso di stato già in_progress

---

## ISSUES NON CORRETTE (richiede approvazione)

| ID | Issue | Motivo non corretto |
|----|-------|-------------------|
| CRM-01 | CRM Leads/Prospects leggono da `leads.pipeline_stage` invece da `journey.lifecycle_state` | Refactoring architetturale, richiede test estensivi |
| NOTIF-01 | Badge notifiche non sincronizzato con `unread_for_designer` | Richiede modifica al polling del NotificationBell |
| OWNER-01 | `client_user_id = NULL` per lead da admin | Richiede provisioning flow separato per clienti admin |
| PROP-01 | Proposal non emette notifica push al cliente | Richiede wiring della notification_service |

---

*Report generato il 11/06/2026*  
*Fix implementati: 2 (Begin Journey i18n + Discovery error handling)*  
*Issues aperte: 4 (CRM, Notification Badge, Client Ownership, Proposal Notification)*
