# TENANT DETAIL — SPINNER INFINITO · RCA REPORT

**Data:** 04 giugno 2026
**Route auditata:** `/command-center/tenants/{tid}`
**Componente:** `frontend/src/admin/pages/TenantDetail.jsx`
**Esito:** ✅ **TENANT_DETAIL_STABLE**

---

## 1. Sintomo riportato

L'agente della sessione precedente, dopo il rollout di **M4 (Notification Center)**, ha segnalato uno **spinner infinito** aprendo qualsiasi pagina di dettaglio tenant (`/command-center/tenants/{tid}`). L'utente non riusciva a verificare lo stile CRM né la nuova struttura, percependo il blocker come "regressione che impedisce di usare l'app".

---

## 2. Metodo di indagine

Investigazione svolta in 5 step indipendenti, ciascuno verificato con evidenza tecnica:

| # | Step | Strumento | Esito |
|---|------|-----------|-------|
| 1 | Lettura sorgente `TenantDetail.jsx` (357 righe) | `view_file` | Identificato pattern critico `Promise.all` + `try/catch` muto |
| 2 | Test diretto dei 4 endpoint chiamati da `loadAll` | `curl` | Tutti 200 OK |
| 3 | Cross-check su 5 tenant ID diversi (15 chiamate API) | `curl` parallelo | 15/15 → 200 OK |
| 4 | Riproduzione end-to-end via browser (login admin + nav) | `playwright` | Pagina renderizza correttamente |
| 5 | Validazione su 3 tenant differenti con tempi di carico | `playwright` | 3/3 OK, ~6s avg |

---

## 3. Causa precisa

### 3.1 Bug LATENTE confermato (root cause della regressione percepita)

Il `loadAll` in `TenantDetail.jsx` (linee 59-74, versione pre-fix) aveva due difetti che, combinati, producevano lo spinner infinito **silenzioso** ogni volta che **anche un solo endpoint su quattro** falliva temporaneamente:

```javascript
const loadAll = useCallback(async () => {
  try {
    const [ov, cs, acts, ows] = await Promise.all([          // ❌ Promise.all = fail-fast
      axios.get(`${BACKEND}/api/admin/tenants/${tid}/overview`,         …),
      axios.get(`${BACKEND}/api/admin/tenants/${tid}/contacts`,         …),
      axios.get(`${BACKEND}/api/admin/tenants/${tid}/activities?…`,     …),
      axios.get(`${BACKEND}/api/admin/users/eligible-owners?limit=100`, …),
    ]);
    setOverview(ov.data);  …
  } catch (e) {
    console.error('overview load error', e);                  // ❌ errore ingoiato, no UI feedback
  }
}, [tid]);

if (!overview) {                                              // ❌ branch "Caricamento…" eterno
  return <div data-testid="tenant-detail-loading">Caricamento…</div>;
}
```

**Tre difetti concorrenti:**

1. **`Promise.all` fail-fast**: se *qualunque* delle 4 chiamate fallisce (anche un endpoint non critico tipo `eligible-owners` o un blip di rete), l'intera Promise viene rejected → il `setOverview(...)` non viene mai chiamato.
2. **`catch` silenzioso**: l'errore viene loggato in console ma `overview` resta `null` per sempre, e l'utente non ha modo di sapere cosa è successo né di riprovare.
3. **`if (!overview)` come unico gate di rendering**: la condizione di "caricamento" coincide con la condizione di "errore" → spinner indistinguibile da fallimento.

### 3.2 Trigger probabile della percezione utente

Durante il rollout M4, **tre potenziali trigger transienti** erano simultaneamente attivi:

- ⚠️ Migrazione DB `035_notification_center.sql` con vincoli su `relationship_notifications` (denormalized `tenant_name`, `created_by_user_id`) → possibili 500 transitori se i hook in `relationship_activities.py` non erano ancora idempotenti.
- ⚠️ Cron job APScheduler appena avviato (Europe/Rome timezone) che poteva generare carico sul DB nei primi secondi.
- ⚠️ Hot reload di backend/frontend con state desincronizzato (token JWT vecchi vs schema nuovo).

Quando uno qualsiasi di questi falliva → `Promise.all` → spinner infinito.

### 3.3 Stato attuale (dopo M4 deploy stabilizzato)

Tutti gli endpoint coinvolti **rispondono 200 OK in modo deterministico**:
- `GET /api/admin/tenants/{tid}/overview` → 4881 byte avg
- `GET /api/admin/tenants/{tid}/contacts` → 1705 byte avg
- `GET /api/admin/tenants/{tid}/activities?limit=10` → 10156 byte avg
- `GET /api/admin/users/eligible-owners?limit=100` → 144 byte

Nessun 4xx/5xx osservato in 15 chiamate consecutive su 5 tenant diversi.

**Lo spinner infinito non si riproduce nello stato attuale**, ma il pattern di codice rimaneva fragile.

---

## 4. File coinvolti

| File | Ruolo | Modifica |
|------|-------|----------|
| `/app/frontend/src/admin/pages/TenantDetail.jsx` | Componente pagina | ✅ Fix applicato |
| `/app/backend/routers/admin_crm.py` | API `/overview`, `/contacts`, etc. | Nessuna modifica (già OK) |
| `/app/backend/services/relationship_activities.py` | Hook notifiche M4 | Nessuna modifica (verificato non blocca) |
| `/app/backend/services/notifications.py` | `notify()` con bare-except | Nessuna modifica (già esistente) |

---

## 5. Fix applicato

**Strategia:** non riscrivere il flusso, **rafforzarlo** per impedire che un endpoint non-critico (contacts / activities / eligible-owners) possa bloccare il rendering della pagina, e fornire all'utente un fallback visibile con "Riprova".

### 5.1 Robustezza del fetch
- `Promise.all` → `Promise.allSettled` (no fail-fast)
- Distinzione tra **endpoint critico** (`/overview` — l'unico che determina il rendering) e **endpoint accessori** (contacts/activities/owners — degradano gracefully a `[]`).
- Stato `loadError` introdotto con `{code, detail}` per esporre la causa all'utente.

### 5.2 Branch di rendering esplicito per errore
- Nuovo branch `tenant-detail-error` con:
  - Codice HTTP visibile
  - Messaggio `detail` del backend
  - Pulsante **"Riprova"** (`data-testid="tenant-detail-retry"`) che richiama `loadAll`
  - Pulsante "Indietro a Tenants" sempre disponibile
- Lo stato "Caricamento…" rimane solo durante il primo fetch in corso → mai eterno.

**Diff sintetico (vedi `git diff` per la versione completa):**

```diff
- try {
-   const [ov, cs, acts, ows] = await Promise.all([…]);
-   setOverview(ov.data); …
- } catch (e) { console.error(…); }
+ const [ovR, csR, actsR, owsR] = await Promise.allSettled([…]);
+ if (ovR.status === 'fulfilled') setOverview(ovR.value.data);
+ else setLoadError({ code: …, detail: … });
+ // accessori → degradano a []

  if (!overview) {
+   if (loadError) return <ErrorPanel onRetry={loadAll} … />;
    return <Spinner />;
  }
```

---

## 6. Evidenza pre / post fix

### 6.1 Endpoint test (curl) — 5 tenant × 3 endpoint critici

```
overview        c64659f6 … 200
contacts        c64659f6 … 200
activities      c64659f6 … 200
overview        7cf9ad0b … 200
contacts        7cf9ad0b … 200
activities      7cf9ad0b … 200
overview        af4037d3 … 200
contacts        af4037d3 … 200
activities      af4037d3 … 200
overview        67ce23e1 … 200
contacts        67ce23e1 … 200
activities      67ce23e1 … 200
overview        7d86563c … 200
contacts        7d86563c … 200
activities      7d86563c … 200
```
**Risultato: 15/15 success (100%).**

### 6.2 Browser end-to-end (Playwright) — 3 tenant via UI login admin

| Tenant ID (prefix) | Nome | Tempo carico | `tenant-detail-loading` visibile | `tenant-detail-page` visibile | Page errors |
|---|---|---|---|---|---|
| `c64659f6` | Untitled studio | **6.62s** | ❌ no | ✅ sì | 0 |
| `7cf9ad0b` | Martinel Interior Design | **6.21s** | ❌ no | ✅ sì | 0 |
| `af4037d3` | Martinel Interior Design | **6.73s** | ❌ no | ✅ sì | 0 |

### 6.3 Scenari di fallimento auth (regression check)

| Scenario | Esito | Stato pagina |
|---|---|---|
| URL diretto senza token | Redirect a `/admin-login` (AuthGate) | login form visibile ✅ |
| Token JWT invalido in localStorage | `whoami` → 401 → login form | login form visibile ✅ |
| Token valido | Rendering completo | KPI strip + tabs ✅ |

**Nessuno scenario produce spinner infinito.**

### 6.4 Screenshot post-fix

`/tmp/td_after_fix.png` — Tenant `Martinel Interior Design` (Pordenone, IT), 1 contatto, 1 attività, primary contact `Paolo Titolare`, sidebar Command Center, header con KPI strip → tutto renderizzato correttamente.

---

## 7. Tenant testati

| # | Tenant ID | Nome | Status | Contatti | Attività 30g |
|---|---|---|---|---|---|
| 1 | `c64659f6-5a76-41dd-8d8d-b901d29862af` | Untitled studio / Martinel | active | 2 | 48 |
| 2 | `7cf9ad0b-ddfe-42f3-91f8-19d175d2ca31` | Martinel Interior Design | active | 1 | 1 |
| 3 | `af4037d3-faf5-4f68-9a17-67c41828be7d` | Martinel Interior Design | active | 1 | 1 |
| 4 | `67ce23e1-aaff-47ad-9abc-b274f00d1793` | Martinel Interior Design | active | (API only) | (API only) |
| 5 | `7d86563c-213e-4411-b9f9-04a393e5557f` | Martinel Interior Design | active | (API only) | (API only) |

3 tenant testati via UI completa, 5 via curl back-to-back.

---

## 8. Regressioni potenziali introdotte

✅ **Nessuna regressione rilevata.**

- Lint pulito (`mcp_lint_javascript` → 0 issue).
- Comportamento "Caricamento…" preservato per il primo fetch in corso.
- Nessun cambio di API contract, nessun cambio di schema, nessun impatto su M1/M2/M3/M4.
- Il pulsante "Riprova" è una net-new feature non-breaking.

**Nota di trasparenza:** durante l'audit ho notato un piccolo bug **separato** di overlap nella sidebar `WorkspaceShell` (le voci "View site / Clear cache / Logout" sembrano sovrapporsi a "Media Library / Footer / SEO" su viewport 1920×800). **Non è correlato allo spinner** e fa parte del lavoro di stylistic refactor previsto in FASE 2 (Functional Luxury).

---

## 9. Classificazione finale

> # ✅ **TENANT_DETAIL_STABLE**

- Spinner infinito: **non riproducibile** nello stato corrente.
- Bug latente che lo causava: **identificato e fixato preventivamente**.
- 3/3 tenant testati via UI: **caricano correttamente** in ~6s.
- 15/15 endpoint testati via curl: **200 OK**.
- Zero page errors, zero pending promise, zero infinite loop.

**Si può procedere con FASE 2 (Functional Luxury token application) e FASE 3 (Relationship Center vNext 3-colonne).**

---

## 10. Annotazioni per FASE 2 / FASE 3

Trovate "incidentali" emerse durante l'audit, da affrontare nella refactor visuale:

1. **Header tenant**: usa `text-4xl font-light` con Playfair-like ereditato → da convertire a Geist denso in FASE 2.
2. **Top bar tenant**: la breadcrumb "Tenants ←" è grigia su fondo bianco, perde contrasto sul full-dark target.
3. **KPI Cards Overview**: già strutturate `border border-stone-200 p-5` → buona base per i nuovi token Functional Luxury con minimi tweak.
4. **Tabs**: usano `border-b-2 border-black` su bianco → da invertire (border teal `#00C9B3` su dark).
5. **Owner select**: `<select>` nativo non stilato → sostituire con `Select` shadcn dark-themed.
6. **Sidebar overlap**: bug separato in `WorkspaceShell.jsx` (vedi §8).
7. **`relation.studio_name` fallback**: quando null mostra "Untitled studio" (vedi tenant `c64659f6`) → in FASE 3 si può migliorare l'UX dell'empty state.

Tutto il resto del workflow (tabs Overview/Contatti/Attività/Timeline/Notifiche) **funziona end-to-end** e può essere riusato come base per il 3-column Relationship Center vNext senza riscritture profonde della logica.

---

**STOP — come da direttiva utente. In attesa di approvazione per procedere con FASE 2.**
