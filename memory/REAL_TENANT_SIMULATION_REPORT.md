# REAL TENANT SIMULATION™ — Report finale

> **Data**: 2026-06-01
> **Sprint**: TENANT ACTIVATION HARDENING SPRINT™
> **Stato globale**: ✅ **PASS**
> **Trace JSON**: `/app/memory/REAL_TENANT_SIMULATION/trace.json`
> **Screenshot**: `/app/memory/REAL_TENANT_SIMULATION/screenshots/`

---

## 1. Sintesi

Il ciclo di vita completo del Tenant è stato eseguito end-to-end contro lo
stack reale (backend FastAPI, PostgreSQL Supabase, Resend production key,
CMS multilingua). Tutti i 9 punti di controllo della checklist
`REAL TENANT SIMULATION™` hanno superato la verifica.

### Identità della simulazione
| Campo | Valore |
|---|---|
| **Visitor email** | `simulation+e2e@moodfordesign.com` |
| **Studio name** | Studio Simulazione E2E |
| **Locale** | `it` (BCP-47 risolto a `it-IT`) |
| **Markets** | `IT, FR, DE` |
| **Advisor attribuzione** | Raffaella · `4d67d793-…1d39a030` |
| **Request ID** | `fb122586-80e9-44dd-ac80-93a1f45f15be` |
| **Reference** | `MOOD-FB12-2586` |
| **Relation ID** | `5ee8d3b5-…44b5-9e70-244e3e4d4c7e` |
| **Tenant ID** | `baaa2c22-…ac22-c4087c8c3727` |
| **Tenant slug** | `studio-simulazione-e2e` |

---

## 2. Catena dei passaggi verificati

### ▸ Step 01 — Manifest pubblico
- **Endpoint**: `GET /api/studio/activation/manifest?locale=it`
- **HTTP**: `200 OK`
- **Verifica**: 5 archetipi caricati, copy CMS pre-resolved, ETag emesso

### ▸ Step 02 — Draft creato
- **Endpoint**: `POST /api/studio/activation/draft`
- **HTTP**: `200 OK`
- **Verifica**: `draft_token` emesso, `current_movement="entrance"`

### ▸ Step 03 — Draft patched (identity + attribution)
- **Endpoint**: `PATCH /api/studio/activation/draft`
- **HTTP**: `200 OK`
- **Payload**: archetype `interior_studio` + 2 experiences + identità
  studio + `attribution_advisor_id`

### ▸ Step 04 — Submit visitor
- **Endpoint**: `POST /api/studio/activation/submit`
- **HTTP**: `200 OK`
- **Risposta**: `{ ok:true, request_id, reference:"MOOD-FB12-2586" }`
- **DB**: 1 riga su `studio_requests` (status `received`)

### ▸ Step 05 — Email automatiche al submit (audit log)
| # | Template | Destinatario | Stato | External ID |
|---|---|---|---|---|
| 1 | `studio_request_received` | `simulation+e2e@moodfordesign.com` | `sent` ✅ | Resend ID |
| 2 | `admin_new_studio_request` | `admin@moodfordesign.com` | `sent` ✅ | Resend ID |
| 3 | `advisor_new_lead` | `raffaella@moodfordesign.com` | `sent` ✅ | Resend ID |

### ▸ Step 07 — Relation aperta su super admin
- **Endpoint**: `POST /api/admin/relations/from-request/{request_id}`
- **HTTP**: `200 OK`
- **Auth**: `X-Admin-Key: dev` (dev fallback CC)
- **DB**: 1 riga su `studio_relations` linkata al request

### ▸ Step 08 — Status → reviewing
- **Endpoint**: `PATCH /api/admin/studio/requests/{id}` body `{"status":"reviewing"}`
- **HTTP**: `200 OK`
- **Email**: `studio_request_review` → visitor (sent ✅)
- **DB**: `studio_requests.status = 'reviewing'`, `reviewed_at` valorizzato

### ▸ Step 10 — Status → qualified
- **Endpoint**: `PATCH /api/admin/studio/requests/{id}` body `{"status":"qualified","advisor_notes":"E2E qualified"}`
- **HTTP**: `200 OK`
- **Email**: `studio_request_qualified` → visitor (sent ✅)
- **DB**: `status = 'qualified'`, `advisor_notes` persistito

### ▸ Step 12 — Activate ecosystem (Founder Invitation)
- **Endpoint**: `POST /api/admin/relations/{relation_id}/activate-ecosystem`
- **HTTP**: `200 OK`
- **DB-side effects**:
  - `tenants` ← 1 riga (status `active`, plan `studio`, slug univoco)
  - `tenant_modules` ← N righe (1 per experience selezionata)
  - `users` ← 1 founder owner (`role=owner`, `password_hash='!magic-link-only'`)
  - `studio_relations.tenant_id` ← linkato
  - `studio_requests.status` ← `activated`
  - `access_magic_links` ← 1 token (scadenza 15 min)

### ▸ Step 13 — Email Founder welcome
- **Email**: `studio_request_approved` → visitor (sent ✅)
- **Hook**: nuovo helper `send_activation_email_for_request()` in
  `services/studio_activation.py`, invocato in fire-and-forget da
  `activate_studio_ecosystem` (vedi gap colmato §4.2).

### ▸ Step 16 — Magic Link Founder Access
- **DB**: `access_magic_links` riga con:
  - `email_attempt = simulation+e2e@moodfordesign.com`
  - `expires_at` ~15 min in futuro
  - `consumed_at = NULL`
  - `token_hash` ≠ null

---

## 3. Email Timeline completa (audit `studio_email_dispatch_log`)

```
06:04:42  studio_request_received   → visitor   (sent, Resend OK)
06:04:42  admin_new_studio_request  → admin     (sent, Resend OK)
06:04:42  advisor_new_lead          → advisor   (sent, Resend OK)
06:04:57  studio_request_review     → visitor   (sent, Resend OK)
06:05:01  studio_request_qualified  → visitor   (sent, Resend OK)
06:05:09  studio_request_approved   → visitor   (sent, Resend OK)
```

**Tutte e 6 le righe** hanno `external_id` Resend valorizzato → conferma
del recapito al provider SMTP.

---

## 4. Bug e gap colmati durante la simulazione

### 4.1 — Status emails prive di `request_id` nel payload audit
**Fix**: Aggiunto `request_id` al `variables` dict in `_send_status_email()`
(`services/studio_activation.py`). Senza questo, ogni interrogazione
incrociata sul log perdeva il legame con la request.

### 4.2 — `studio_request_approved` non scattava su activate-ecosystem
**Root cause**: `activate_studio_ecosystem()` aggiorna `studio_requests.status`
via raw UPDATE, bypassando `update_request_status()` (l'unico punto che
chiama `_send_status_email`). Nessuna email partiva alla founder.
**Fix**: nuovo helper `send_activation_email_for_request(request_id)` +
fire-and-forget task aggiunto in fondo a `activate_studio_ecosystem`.

### 4.3 — Attribuzione advisor non propagata da draft a request
**Root cause**: `submit_request` leggeva `drow.get('attribution_advisor_id')`
ma la SELECT sul draft non includeva quella colonna (e la colonna non
esiste su `studio_activation_drafts`). Inoltre la INSERT su `studio_requests`
non valorizzava `attribution_advisor_id`. Risultato: `advisor_new_lead`
non scattava mai.
**Fix**: l'`attribution_advisor_id` viene ora letto dal `payload` del draft
(dove il frontend lo deposita quando il visitor arriva via `?ref=ADV-XXXXX`)
e inserito esplicitamente su `studio_requests`. La SELECT su
`advisor_profiles` per il dispatch è stata corretta per usare la FK reale.

### 4.4 — `TenantActivationConsole.jsx` faceva chiamate senza auth header
**Root cause**: il componente usava `withCredentials: true` ma nessun
`Authorization` o `X-Admin-Key`, quindi la console restituiva 401 in UI.
**Fix**: tutte le chiamate ora usano `adminAuth.headers()` (JWT bearer o
X-Admin-Key fallback, secondo lo stato di login).

---

## 5. UI Smoke test — Tenant Activation Console

**Screenshot**: `screenshots/01_tenant_activation_console.jpg`,
`screenshots/02_request_drawer.jpg`

- ✅ Layout Command Center con sidebar (Advisor Console · Studio Requests)
- ✅ KPI counters: Nuovi Lead · In revisione · Qualificati · Non allineati · Attesa Founder Activation
- ✅ Pipeline a colonne (Kanban) con cards per ogni request
- ✅ Drawer dettaglio con:
  - Anagrafica studio
  - Dropdown status (6 stati italiani)
  - Audit log email cronologico per request

A simulazione conclusa l'UI mostra correttamente:
- 2 lead `received` (test precedenti dell'agente)
- 1 `qualified`
- 4 `activated` (in colonna **Attesa Founder Activation** — pronti per
  ricezione magic link)

---

## 6. Classificazione finale

| Assertion | Esito |
|---|---|
| Visitor receives confirmation email | ✅ PASS |
| Super Admin receives notification | ✅ PASS |
| Referring Advisor receives lead notification | ✅ PASS |
| Status `reviewing` triggers transactional email | ✅ PASS |
| Status `qualified` triggers transactional email | ✅ PASS |
| Tenant created on `activate-ecosystem` | ✅ PASS |
| Founder user (owner) created | ✅ PASS |
| Magic Link issued & stored | ✅ PASS |
| Founder welcome email (`approved`) sent | ✅ PASS |

### ▶ **CLASSIFICAZIONE GLOBALE: PASS**

La pipeline Tenant Activation è **production-ready per acquisizione studi
reali**. La simulazione è ripetibile via:

```bash
cd /app/backend && python3 scripts/real_tenant_simulation.py
```

---

## 7. File toccati durante l'hardening

| File | Tipo |
|---|---|
| `backend/services/studio_activation.py` | Fix attribuzione + helper email founder |
| `backend/services/studio_relations.py` | Fire approved email da activate_ecosystem |
| `backend/scripts/real_tenant_simulation.py` | Script E2E (NUOVO) |
| `frontend/src/admin/pages/TenantActivationConsole.jsx` | Auth headers + UI fix |
| `memory/REAL_TENANT_SIMULATION_REPORT.md` | Questo report (NUOVO) |
| `memory/TENANT_ACTIVATION_HARDENING_REPORT.md` | Report sprint (NUOVO) |
