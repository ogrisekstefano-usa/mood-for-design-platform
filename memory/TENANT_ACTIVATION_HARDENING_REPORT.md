# TENANT ACTIVATION HARDENING SPRINT™ — Final Report

> **Data**: 2026-06-01
> **Classificazione**: ✅ **READY_FOR_REAL_TENANT_ACQUISITION**
> **Validation cross-reference**: `REAL_TENANT_SIMULATION_REPORT.md` (PASS)

---

## 1. Scope dello sprint

Hardening completo del ciclo di vita Tenant Activation:
- Pipeline transazionale email CMS-driven (Resend) per ogni transizione
  di status di `studio_requests`.
- Console Command Center per Admin/Advisor (Kanban + drawer + audit log).
- Audit log persistente di ogni dispatch email.
- Eliminazione del **NO HARDCODED COPY**: soggetti, body, eyebrow, CTA,
  signature, note — tutto da `editorial_blocks` namespace `email.*` con
  fallback BCP-47.
- Validazione end-to-end con una simulazione reale.

---

## 2. Task delivery matrix

| # | Task | Stato | Evidenza |
|---|---|---|---|
| 1 | Audit lifecycle esistente | ✅ | `memory/TENANT_LIFECYCLE_IMPLEMENTATION_AUDIT.md` |
| 2 | DB schema audit log + 7 CMS templates seedati | ✅ | Migration `027_tenant_activation_email_dispatch.sql` |
| 3 | Email dispatcher CMS-driven generico (Resend) | ✅ | `services/email_dispatcher.py` |
| 4 | Submit triggers (visitor + admin + advisor) | ✅ | `services/studio_activation.py:521-579` |
| 5 | Status transition triggers (reviewing/qualified/rejected/activated) | ✅ | `_send_status_email` + `_STATUS_EMAIL_MAP` |
| 6 | Activate-ecosystem founder welcome email | ✅ | `services/studio_relations.py` (gap colmato) |
| 7 | Command Center Console UI | ✅ | `admin/pages/TenantActivationConsole.jsx` |
| 8 | API pipeline + audit endpoints | ✅ | `routers/tenant_activation.py` |
| 9 | REAL TENANT SIMULATION™ end-to-end | ✅ PASS | `REAL_TENANT_SIMULATION_REPORT.md` |
| 10 | Hardening report finale | ✅ | Questo documento |

---

## 3. Architettura email pipeline

```
┌───────────┐   submit   ┌─────────────────┐  ┌──────────────────┐
│  Visitor  │──────────▶ │  POST /studio/  │─▶│ services.studio_ │
└───────────┘            │  activation/    │  │ activation.      │
                          │  submit         │  │ submit_request   │
                          └────────┬────────┘  └────────┬─────────┘
                                   │                    │ fire-and-forget
                                   ▼                    ▼
                          studio_requests       services.email_dispatcher
                          (INSERT)              (3 dispatch_email tasks)
                                                        │
                                                        ▼
                                              ┌─────────────────────┐
                                              │ editorial_blocks    │
                                              │ namespace='email'   │
                                              │ + translations      │
                                              │ (BCP-47 fallback)   │
                                              └──────────┬──────────┘
                                                         │
                                                         ▼
                                              ┌─────────────────────┐
                                              │ Resend SDK          │
                                              │ no-reply@mail.mood… │
                                              └──────────┬──────────┘
                                                         │
                                                         ▼
                                              studio_email_dispatch_log
                                              (audit row con external_id)
```

### Stati e template

| `studio_requests.status` | Template scattato |
|---|---|
| `received` (al submit) | `studio_request_received` + `admin_new_studio_request` + `advisor_new_lead` (se attribution) |
| `reviewing` | `studio_request_review` |
| `contacted` | (nessuno — touchpoint umano) |
| `qualified` | `studio_request_qualified` |
| `not_aligned` | `studio_request_rejected` |
| `activated` | `studio_request_approved` + magic link separato |

---

## 4. Endpoint API consolidati

| Metodo | Path | Descrizione |
|---|---|---|
| `POST` | `/api/studio/activation/submit` | Submit visitor (pubblico, no auth) |
| `PATCH`| `/api/admin/studio/requests/{id}` | Update status (Advisor/Admin) → trigger email |
| `POST` | `/api/admin/relations/from-request/{id}` | Apre la relation dall'request |
| `POST` | `/api/admin/relations/{id}/activate-ecosystem` | Crea tenant + founder + magic link + email approved |
| `GET`  | `/api/admin/tenant-activation/pipeline` | Aggregato Kanban per la console |
| `GET`  | `/api/admin/tenant-activation/emails?request_id=…` | Audit log filtrato |
| `POST` | `/api/admin/tenant-activation/retry-failed` | Retry idempotente delle email fallite |

---

## 5. Garanzie operative

### ✅ Zero hardcoding
- Tutti i template email sono in DB (`editorial_blocks` namespace `email`).
- Subject, body, CTA, signature interpolano variabili `{{var}}` runtime.
- Locale risolto via `platform_languages` fallback chain (BCP-47 puro).

### ✅ Fail-soft
- Ogni `dispatch_email` è `_aio.create_task(...)` → mai blocca la
  transazione di business.
- Eccezioni email sono loggate ma non propagate.
- Failures sono comunque persistite su `studio_email_dispatch_log` con
  `status='failed'`, `error=str(exc)`, `retry_count`.

### ✅ Idempotenza
- `studio_email_dispatch_log.external_id` cattura l'ID Resend → eventuale
  retry crea una nuova riga ma la 1ª resta come storico.
- `retry_failed()` rispetta `retry_count < 3` e bump `last_retry_at`.

### ✅ Audit completo
- Ogni email (sandbox/sent/failed) ha riga in `studio_email_dispatch_log`
  con `template_key`, `to_email`, `locale`, `subject`, `variables` (jsonb),
  `status`, `error`, `external_id`, timestamps.

### ✅ NO sandbox in production
- `RESEND_API_KEY` reale verificato. Dispatcher rileva
  `re_sandbox_placeholder` e degrada in modalità log-only se necessario.

---

## 6. Console Command Center

**Route**: `/command-center/tenant-activation`
**File**: `frontend/src/admin/pages/TenantActivationConsole.jsx`
**Componenti**:
- KPI counters per stadio (Nuovi Lead, In revisione, Qualificati, Non allineati, Attesa Founder Activation).
- Pipeline Kanban con cards per request.
- Drawer dettaglio: anagrafica, dropdown status (transizioni live), audit log email cronologico.
- Auth: `adminAuth.headers()` (JWT bearer wins, X-Admin-Key fallback).
- Data-testid completo per regression test.

---

## 7. Issue residui e tracking

### 🔴 Bloccato dal P0 incident
- **RCA Supabase DB-wipe** ancora aperto; tabella `users` vuota dopo
  l'incidente. La pipeline funziona perché advisor_profiles esiste, ma
  per il roll-out reale serve ripristinare gli admin users.

### 🟡 Backlog post-hardening
- **Test script unsafe** `tests/test_iter160_studio_activation.py` contiene
  `DELETE FROM` su tabelle operative — da sanitizzare prima di riprenderlo.
- **Phantom Auth users** Supabase GoTrue (7 record orfani) — non bloccante.
- Email founder welcome: il magic link è inviato in un canale separato
  (`access_continuity.issue_magic_link`); valutare se unificare con il
  `studio_request_approved` con CTA dinamico al magic link.

---

## 8. Classificazione finale

### ▶ **READY_FOR_REAL_TENANT_ACQUISITION**

La pipeline Tenant Activation è in stato production-grade, audit-complete,
CMS-driven, no-hardcoding, e validata end-to-end da una simulazione reale
con esito PASS su tutti i 9 punti di controllo.

L'acquisizione di studi reali può iniziare non appena l'incident P0
Supabase (RCA users table) sarà chiuso. La pipeline email è già attiva
in produzione contro Resend reale.
