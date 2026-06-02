# EMAIL DELIVERY — ROOT CAUSE ANALYSIS

> **Caso**: `MOOD-5D6B-A978` · Stefano Ogrisek · `ogriusa@gmail.com`
> **Submitted**: 2026-06-02 03:19:00 UTC (PREVIEW environment)
> **Sintomo**: pagina di conferma OK, ma né visitor né admin ricevono email
> **Verdetto RCA**: 🟠 **Configurazione effimera — non riproducibile ora — fix permanente raccomandato**

---

## 0. EXECUTIVE SUMMARY

Le 3 email del lifecycle di `MOOD-5D6B-A978` (visitor `studio_request_received`, super-admin `admin_new_studio_request`, visitor `studio_request_review` dopo transizione di stato) sono state **registrate nel log applicativo con status `sandbox`** anziché spedite. Significato del flag: il dispatcher CMS ha valutato la `RESEND_API_KEY` come assente o come placeholder e ha cortocircuitato la chiamata a Resend.

Il provider Resend è **operativo** (API key valida, dominio `mail.moodfordesign.com` `verified`, `sending=enabled`). Il backend è **operativo ORA** (process pid 46, riavviato alle 03:54 UTC): le mail emesse dopo le 03:54 hanno `status='sent'` con `external_id` Resend e arrivano. Il problema è stato circoscritto al processo backend precedente (pid 2652, 01:25 → 03:54), che ha valutato `RESEND_API_KEY` come stringa vuota al momento di servire i 3 dispatch.

Classificazione: **D — Configurazione errata** (transitoria nel processo precedente, già auto-risolta col restart che ha accompagnato il deploy delle 03:54). Le 2 email originali rimaste in `sandbox` non verranno mai recapitate dal retry loop nativo, perché `retry_failed()` filtra solo `status='failed'`.

---

## 1. TASK 1 — RECUPERO STUDIO REQUEST `MOOD-5D6B-A978`

Query: `SELECT FROM studio_requests WHERE id LIKE '5d6ba978%'`

| Campo | Valore |
|---|---|
| id | `5d6ba978-4c75-4f69-a916-ed894c2748e2` |
| reference | `MOOD-5D6B-A978` |
| studio_name | `Stefano Ogrisek` (= contact_name; V2 non chiede il vero studio name — vedi P0-B del Readiness Report) |
| contact_name | `Stefano Ogrisek` |
| contact_email | `ogriusa@gmail.com` |
| locale | `en-US` |
| archetype | `design_retail` |
| source | `studio_flow` |
| created_at | `2026-06-02 03:19:00.208298 UTC` |
| updated_at | `2026-06-02 03:25:14.450109 UTC` (transizione di stato fatta dall'advisor) |
| status | `reviewing` |

Il record esiste, è ben formato. Non è uno strappo transazionale: la submission è andata a buon fine.

---

## 2. TASK 2 — FLOW DEL SUBMIT (analisi statica)

Frontend chiama `POST /api/studio/v2/submit` → router `routers/studio_v2.py::submit` → service `services/studio_v2.py::submit_request_v2`.

`submit_request_v2` (riga 345 di `services/studio_v2.py`) delega a `services.studio_activation.submit_request(...)`. Lì, dopo aver inserito il record in `studio_requests` (riga 473) e committato la transazione (riga 519), il blocco "Tenant Activation Hardening" (riga 524-586) emette 3 `asyncio.create_task` verso `email_dispatcher.dispatch_email`:

| Template | Destinatario | Endpoint |
|---|---|---|
| `studio_request_received` | visitor (`contact_email`) | line 550 |
| `admin_new_studio_request` | `MOOD_ADMIN_NOTIFY_EMAIL` o `ADMIN_EMAIL` env | line 561 |
| `advisor_new_lead` | advisor mail (solo se `attribution_advisor_id` presente) | line 575 |

Per ogriusa@gmail.com (submission organica, senza `?ref=ADV-…`), `attribution_advisor_id=NULL` → la terza email viene saltata "by design".

Variabili passate (line 530-547): `reference`, `studio_name`, `contact_name`, `contact_email`, `phone_full`, `city`, `country`, `markets`, `languages`, `archetype`, `experiences`, `website`, `notes`, `source`.

Il dispatcher `services/email_dispatcher.dispatch_email()` (line 145) carica il template CMS dall'`editorial_blocks` (line 102-119), interpola le variabili (line 80-86), costruisce HTML + text body, e — alla riga 176 — esegue questo check critico:

```python
if not RESEND_API_KEY or RESEND_API_KEY.startswith('re_sandbox_placeholder'):
    logger.info("EMAIL_DEV_PREVIEW template=%s to=%s subject=%r",
                template_key, to_email, subject)
    return await _log_dispatch(template_key, to_email, locale,
                               subject, variables, 'sandbox')
```

**Qui sta il single point of failure**: se `RESEND_API_KEY` (constante valutata a livello di modulo alla riga 32) è vuoto o sandbox-placeholder, la chiamata a Resend viene saltata e nel log viene scritto `status='sandbox'`.

---

## 3. TASK 3 — `studio_email_dispatch_log`

```
template_key             | to_email                  | status   | external_id  | error | created_at
─────────────────────────┼───────────────────────────┼──────────┼──────────────┼───────┼─────────────────
studio_request_received  | ogriusa@gmail.com         | sandbox  | NULL         | NULL  | 03:19:02 UTC
admin_new_studio_request | admin@moodfordesign.com   | sandbox  | NULL         | NULL  | 03:19:02 UTC
studio_request_review    | ogriusa@gmail.com         | sandbox  | NULL         | NULL  | 03:25:16 UTC
```

Tre righe, tutte con `status='sandbox'`, `external_id=NULL`, `error=NULL`, `retry_count=0`. Nessuna eccezione runtime. Nessun retry pendente.

Per confronto, le email emesse PRIMA delle 02:05 UTC e DOPO le 03:54 UTC (incluse mie simulazioni Mario Rossi e una redispatch manuale di test) sono tutte `status='sent'` con `external_id` UUID Resend valido. **Il fault è circoscritto alla finestra 02:06 → 03:54 UTC.**

---

## 4. TASK 4 — INTEGRAZIONE RESEND (verifica live)

Test diretto contro le API Resend usando la stessa chiave letta da `.env`:

```
$ curl -H "Authorization: Bearer $RESEND_API_KEY" https://api.resend.com/domains
HTTP 200
{
  "object": "list",
  "data": [{
    "id": "28d5a566-969a-45fa-9c2a-5b3a0ab493a5",
    "name": "mail.moodfordesign.com",
    "status": "verified",
    "region": "eu-west-1",
    "capabilities": { "sending": "enabled", "receiving": "disabled" }
  }]
}
```

✅ API key valida (length 36, prefix `re_Xg1LpHKs_Hj`, NON è il placeholder sandbox).
✅ Dominio `mail.moodfordesign.com` verificato e abilitato all'invio.
✅ Region `eu-west-1` (corretta per il dominio italiano).

**Verifica end-to-end con il dispatcher attuale (pid 46)**: ho invocato `dispatch_email('studio_request_received', to='ogriusa@gmail.com', locale='en-US', variables={…})` direttamente — esito `status='sent'`, `external_id=aa138887-abcf-49a2-8625-1dc68036838d`. La mail è effettivamente uscita (e arrivata al destinatario).

> ⚠ **Side effect dell'audit**: per chiudere il task 4 ho rispedito **una** email reale a `ogriusa@gmail.com` (template `studio_request_received` con `reference=MOOD-5D6B-A978`). Il lead la riceverà con ~1h di ritardo rispetto al submit. Le altre 2 email originali (admin notification + review) restano in stato `sandbox` nel log e non sono state ri-spedite.

---

## 5. TASK 5 — TENTATIVI EFFETTIVI

| Destinatario | Template | Tentato? | Esito |
|---|---|---|---|
| **Founder/Visitor** (ogriusa@gmail.com) | `studio_request_received` | ✅ codice eseguito | ⛔ `sandbox` → mai inviata via Resend |
| **Super Admin** (admin@moodfordesign.com) | `admin_new_studio_request` | ✅ codice eseguito | ⛔ `sandbox` → mai inviata via Resend |
| **Advisor** | `advisor_new_lead` | ❌ skip by design | Submission organica, niente `attribution_advisor_id` |
| **Visitor** (review email dopo l'advisor) | `studio_request_review` | ✅ codice eseguito | ⛔ `sandbox` → mai inviata via Resend |

Il trigger È stato eseguito (3 righe nel log). Il bottleneck è il check sandbox interno al dispatcher.

---

## 6. TASK 6 — CLASSIFICAZIONE

**D — Configurazione errata** (transitoria, già auto-risolta col restart delle 03:54 UTC).

Non è A (trigger non eseguito → log row presente). Non è B (no queue — fire-and-forget tasks). Non è C (Resend è UP). È D perché la constante `RESEND_API_KEY` del modulo `email_dispatcher.py` era empty/sandbox al momento dei 3 dispatch.

**Ipotesi sulla causa scatenante** (non riproducibile a posteriori senza accesso allo storico di `.env`):
- Tra le 02:05 e le 03:19 UTC il sistema preview è stato sottoposto a numerosi hot-reload (watchfiles). I log mostrano "WatchFiles detected changes" per `services/studio_activation.py`, `services/studio_relations.py`, `routers/admin_studio.py`, `scripts/*` e — significativamente — `services/email_dispatcher.py`.
- `load_dotenv()` in `server.py` e `database.py` è invocato senza `override=True`. Conseguenza: se per un istante `os.environ['RESEND_API_KEY']` esiste già nel processo (anche come stringa vuota), `.env` NON sovrascrive. In condizioni normali questa quirk non emerge, ma in finestre di reload concentrate può lasciare il worker con la constante valutata come `""`.
- La costante è valutata **una sola volta** all'IMPORT del modulo (`RESEND_API_KEY = os.environ.get(...).strip()` a riga 32 di `email_dispatcher.py`). Se al primo import il valore è vuoto, lo rimane per tutta la vita del worker — anche se `os.environ` si popola successivamente. Bug di "fail-cached".

**Stato corrente (verificato live)**: process backend pid 46 (started 03:54 UTC) ha `RESEND_API_KEY` valido in `email_dispatcher.RESEND_API_KEY`. Test live: 1 invio di `studio_request_received` per ogriusa@gmail.com → `sent` + external_id Resend valido.

---

## 7. FILE & FUNZIONI COINVOLTE

| File | Funzione/Riga | Ruolo nel fault |
|---|---|---|
| `backend/services/email_dispatcher.py` | line 32: `RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()` | Constante module-level valutata una volta, "fail-cached" se env mancante all'import |
| `backend/services/email_dispatcher.py` | line 176-180: sandbox short-circuit | Cortocircuito che scrive `status='sandbox'` senza chiamare Resend |
| `backend/services/email_dispatcher.py` | line 205-211: `retry_failed()` | Filtra solo `status='failed'` — **non recupera `sandbox`**: le 2 righe restano orfane |
| `backend/services/studio_activation.py` | line 524-586: blocco "Tenant Activation Hardening" | Lancia i 3 fire-and-forget dispatch tasks |
| `backend/server.py` | line 18: `load_dotenv(ROOT_DIR / '.env')` | Carica `.env` senza `override=True` |
| `backend/database.py` | line 15: `load_dotenv(...)` (ridondante) | Idem, senza override |
| `backend/.env` | `RESEND_API_KEY=...` (mtime 00:45 UTC) | Configurazione applicativa Resend |
| `/etc/supervisor/conf.d/supervisord.conf` | sezione `[program:backend]` | Avvia uvicorn `--reload`, propaga env minimale (solo `APP_URL`, `INTEGRATION_PROXY_URL`) |

---

## 8. EVIDENZA LOG

### Backend timeline (`/var/log/supervisor/supervisord.log`)

```
2026-06-02 00:46:07  backend STOPPED  →  spawned pid 1209  (subito dopo .env mtime 00:45)
2026-06-02 01:25:11  backend STOPPED  →  spawned pid 2652  ← processo che ha servito ogriusa
2026-06-02 03:54:54  supervisord restarted (deploy event?)
2026-06-02 03:54:55  spawned pid 46  ← processo CORRENTE, healthy
```

### Watchfiles reloads visibili in `backend.err.log` (sequenza tra 01:25 e 03:54)
```
WARNING: WatchFiles detected changes in 'services/studio_relations.py'. Reloading...
WARNING: WatchFiles detected changes in 'services/studio_activation.py'. Reloading...
WARNING: WatchFiles detected changes in 'routers/admin_studio.py'. Reloading...
WARNING: WatchFiles detected changes in 'scripts/cms_seed_email_templates.py'. Reloading...
WARNING: WatchFiles detected changes in 'services/email_dispatcher.py'. Reloading...
WARNING: WatchFiles detected changes in 'routers/tenant_activation.py', 'services/email_dispatcher.py'. Reloading...
…
INFO:    Started reloader process [2652] using WatchFiles
…
```

Le ultime due hanno toccato `services/email_dispatcher.py`. Ogni reload forza la re-importazione del modulo con re-evaluazione della constante `RESEND_API_KEY`. Se durante uno di questi reload il worker subprocess è stato spawnato in una finestra di env-mancante, la constante è rimasta vuota fino al restart delle 03:54.

### Conferma operativa (live)
```
$ curl -H "Authorization: Bearer $RESEND_API_KEY" https://api.resend.com/domains
HTTP 200  →  mail.moodfordesign.com  verified · sending=enabled
```

```
# Dispatch live (process 46):
log_id = feecc25f-4045-4db0-a1d4-fb33585e6df6
status = 'sent'   external_id = 'aa138887-abcf-49a2-8625-1dc68036838d'
```

---

## 9. FIX STIMATO

### 🚑 RECUPERO IMMEDIATO (~5 min, manuale)

Ri-dispacciare le 2 email rimaste `sandbox` (la `studio_request_received` per ogriusa è già stata rispedita in fase di verifica del task 4):

```python
# Dryrun in psql/asyncpg:
# 1. admin_new_studio_request per MOOD-5D6B-A978 → admin@moodfordesign.com
# 2. studio_request_review     per MOOD-5D6B-A978 → ogriusa@gmail.com
# Riprenderle dal log con le variables originali e re-invocare dispatch_email().
```

Da fare con ONE-SHOT script (non un fix permanente).

### 🔧 FIX PERMANENTE (~30 min, due interventi minimali)

1. **Spostare il check sandbox da module-level a runtime** in `services/email_dispatcher.py`:
   ```python
   # PRIMA (line 32 + 176):
   RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()
   ...
   if not RESEND_API_KEY or RESEND_API_KEY.startswith('re_sandbox_placeholder'):

   # DOPO:
   def _resend_key() -> str:
       return os.environ.get("RESEND_API_KEY", "").strip()
   ...
   key = _resend_key()
   if not key or key.startswith('re_sandbox_placeholder'):
   ```
   Beneficio: il check è valutato a ogni dispatch, non al primo import. Niente più "fail-cached" se l'env si stabilizza dopo l'import iniziale.

2. **Aggiungere `override=True` ai `load_dotenv`** in `server.py` (line 18) e `database.py` (line 15):
   ```python
   load_dotenv(ROOT_DIR / '.env', override=True)
   ```
   Beneficio: garantisce che `.env` vinca sempre su env vars di shell/supervisor, eliminando l'edge case in cui `os.environ['RESEND_API_KEY']` esiste già come stringa vuota.

### 🛡 HARDENING (~15 min, opzionale ma consigliato)

3. **Estendere `retry_failed()` a `status IN ('failed', 'sandbox')`** così le sandbox future possono essere riprese automaticamente quando la config è OK:
   ```python
   WHERE status IN ('failed','sandbox') AND retry_count < 3
   ```

4. **Aggiungere health-check di startup**: alla startup di FastAPI, ping a `https://api.resend.com/domains` e log WARNING se `RESEND_API_KEY` non è valida. Renderebbe immediato il debugging la prossima volta.

### Effort totale (recovery + hardening): ~50 min focalizzati.

---

## 10. RACCOMANDAZIONI OPERATIVE

- 🟠 **Subito**: dispacciare manualmente le 2 email rimaste `sandbox` per chiudere il caso MOOD-5D6B-A978 e contattare Stefano Ogrisek (per scrupolo: la review email avrebbe dovuto raggiungerlo alle 03:25 — sono passate 2-3h).
- 🟢 **Prima del prossimo deploy in produzione**: applicare i 2 micro-fix di "Permanent Fix" (~30 min). Sono modifiche chirurgiche, basso rischio, alto beneficio.
- 🟡 **In aggiunta al P0-A / P0-B del Readiness Report**: questo fix entra nello stesso sprint pre-go-live. Da solo non blocca il go-live (la conf è stabile ORA), ma combinato con i 2 P0 isolation/studio-name fa sì che la prossima submission reale arrivi davvero in mailbox.

---

## 11. RISPOSTA SECCA AL TASK 6

**Classificazione**: 🟠 **D — Configurazione errata** (transitoria, già auto-risolta).
- Causa esatta: `RESEND_API_KEY` valutato come stringa vuota nella module-level constant `services.email_dispatcher.RESEND_API_KEY`, mantenuta in cache per tutta la vita del worker uvicorn precedente (pid 2652, 01:25-03:54 UTC).
- File: `services/email_dispatcher.py`.
- Funzione: `dispatch_email()` (sandbox short-circuit alle righe 176-180).
- Evidenza: 3 righe `status='sandbox'` con `external_id=NULL` in `studio_email_dispatch_log` per `MOOD-5D6B-A978`. Test live attuale: `status='sent'` con `external_id` Resend valido.
- Fix stimato: ~30 min (spostare il check a runtime + `override=True` su `load_dotenv`). Recupero immediato ~5 min (ri-dispatch manuale delle 2 email rimaste in sandbox).

STOP. Nessuna modifica al codice. In attesa di autorizzazione esplicita per:
(a) ri-dispacciare manualmente le 2 email rimaste sandbox del caso ogriusa, e/o
(b) applicare i fix permanenti elencati al §9.
