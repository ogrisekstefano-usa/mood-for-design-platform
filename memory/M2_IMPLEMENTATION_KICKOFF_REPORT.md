# M2 IMPLEMENTATION KICKOFF — READINESS REPORT

> Generato 2026-06-02 da E1 (Emergent) **immediatamente dopo**
> la classificazione `M1_VALIDATED_READY_FOR_M2` (vedi
> `/app/memory/M1_0_1_HOTFIX_REPORT.md`).
>
> ⚠️ **Nessuna implementazione M2 sarà eseguita** finché l'utente non
> rilascerà un esplicito "VAI" (o "APPROVATO"). Questo documento è
> solo lo stato di prontezza ed evidenzia in chiaro che cosa, dove e
> come si toccherà.

**Stato**: 🟢 **`M2_READY_TO_KICK_OFF`**

---

## 1 · CONTESTO DI PARTENZA (CERTIFICATO)

| Asset | Stato | Evidenza |
|---|:--:|---|
| M0 — DB foundation, view `v_relationship_timeline`, indici, catalog | ✅ | `validate_m0.py` PASS · view 135 righe storiche |
| M1 — Contact CRM (CRUD + Org. Owner + Founder mirror + RBAC) | ✅ | `m1_real_usage_validation.py` 33/33 PASS · `validate_m1_security.py` 16/16 PASS |
| M1.0.1 Hotfix — `catalogs/languages` + `preferred_language` normalize | ✅ | `M1_0_1_HOTFIX_REPORT.md` |
| Martinel dati reali (no seed) | ✅ | 2 contatti attivi, 1 archiviato, 5 attività manuali, 11 eventi automatici |

I 4 decisori utente che dovranno entrare in M2 (vedi
`M2_RELATIONSHIP_TIMELINE_FINAL_EXECUTION_PLAN.md`) sono **già
recepiti** in piano:

| # | Decisione | Recepita in piano |
|---|---|:--:|
| 1 | Health: solo `score_delta` catalog-driven, vietati bands/decay/AI/KPI/dashboard | ✅ |
| 2 | Connection Pooling fuori scope M2 → task separato **M1.1** | ✅ |
| 3 | Notification Center: solo predisposizione `notifiable BOOLEAN DEFAULT FALSE` | ✅ |
| 4 | Data validation pre-codice → fatto via `m1_real_usage_validation.py` | ✅ |

---

## 2 · COSA VERRÀ TOCCATO IN M2 (mappa file/righe)

### 2.1 Backend — Nuovi file
- `backend/db/migrations/033_relationship_timeline_and_health.sql`
- `backend/db/migrations/033_relationship_timeline_and_health.rollback.sql`
- `backend/scripts/seed_relationship_health_signals.py`
- `backend/services/relationship_health.py` *(unico entry-point `apply_signal`)*
- `backend/services/timeline.py` *(reader cursor-paginato)*
- `backend/routers/admin_timeline.py`
- `backend/routers/blueprint_timeline.py`
- `backend/scripts/validate_m2_security.py` *(14 check)*

### 2.2 Backend — File esistenti che riceveranno **un singolo hook**
| File | Punto di hook | type_code |
|---|---|---|
| `services/studio_activation.py` (`activate_studio_ecosystem`) | post-commit | `activated`, `magic_link_issued`, `relation_opened` |
| `routers/auth.py` (`magic_link_consume`) | post-commit | `magic_link_consumed` |
| `routers/auth.py` (`set_password`) | post-commit | `password_set` |
| `routers/admin_studio.py` (status/temperature update) | post-commit | `status_changed`, `temperature_changed` |
| `services/tenant_contacts.py` (`create_contact`, `archive_contact`) | post-commit | `contact_added` / `contact_archived` |
| `services/relationship_activities.py` (`create_quick_activity`) | post-commit | (sorgente attività) |
| Blueprint app first-mount middleware | post-commit guard | `blueprint_first_access` |

Ogni hook è una **singola chiamata** a `relationship_health.apply_signal(s, tenant_id=, contact_id=, source=, type_code=)`, integrata nella transazione esistente del writer. Nessuna refactoring collaterale.

### 2.3 Frontend — Nuovo componente
- `frontend/src/admin/components/TimelineFeed.jsx` *(componente unico riutilizzato)*
- Hook nelle tab esistenti già con placeholder:
  - `admin/pages/TenantDetail.jsx` tab "Timeline" *(attuale placeholder, vedi screenshot M1 §5.2)*
  - `blueprint/pages/BlueprintOverview.jsx` tab "Timeline" *(idem)*

### 2.4 Frontend — File esistenti che NON saranno toccati
- `ContactDrawer.jsx` ✓
- `TenantsList.jsx` ✓
- Tutta la sezione CMS (Pages, Blocks, Sections, Footer, SEO, Publishing) ✓
- Login / identity-probe ✓

Confine M2 strettissimo: **timeline + health hooks data-only**.

---

## 3 · API SURFACE M2 (5 endpoint nuovi)

| Verb | Path | Scope | Note |
|---|---|---|---|
| GET | `/api/admin/tenants/{tid}/timeline` | advisor/admin | cursor pagination `?cursor=` + filtri |
| GET | `/api/admin/tenants/{tid}/timeline/filter-options` | advisor/admin | cached 60s |
| GET | `/api/blueprint/timeline` | founder (own tenant) | filtra `visibility='admin_only'` |
| GET | `/api/blueprint/timeline/filter-options` | founder (own tenant) | |
| GET | `/api/catalogs/timeline-types` | helper UI | label/icon/color/show_in_timeline |

**Nessun endpoint** espone `relationship_score` o `last_touch_at` (decisione 1).

---

## 4 · DB SCHEMA DELTA (migration 033)

```sql
-- Health data-only su tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS relationship_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_touch_at      TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_tenants_relationship_score
  ON tenants(relationship_score DESC) WHERE relationship_score > 0;

-- Catalog driver per eventi + attività
ALTER TABLE platform_relationship_event_types
  ADD COLUMN IF NOT EXISTS score_delta INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS touch       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS visibility  TEXT NOT NULL DEFAULT 'all'
    CHECK (visibility IN ('all','admin_only')),
  ADD COLUMN IF NOT EXISTS notifiable  BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE platform_activity_types
  ADD COLUMN IF NOT EXISTS score_delta INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS touch       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS visibility  TEXT NOT NULL DEFAULT 'all'
    CHECK (visibility IN ('all','admin_only')),
  ADD COLUMN IF NOT EXISTS notifiable  BOOLEAN NOT NULL DEFAULT FALSE;
```

Idempotente, reversibile via `033_*.rollback.sql`.

---

## 5 · DATI MARTINEL — PRONTI PER ESERCITARE LA TIMELINE

Dopo la run di `m1_real_usage_validation.py` (post-hotfix):

| Sorgente | Conteggio reale | Type-code esempi |
|---|---:|---|
| Eventi automatici (lifecycle) | 11 | `relation_opened`, `activated`, `magic_link_consumed`, `studio_request_*` |
| Email (D5 filtrate) | 5 | `admin_new_studio_request`, ecc. |
| Attività manuali M1 | 5 | `call`, `email`, `whatsapp`, `linkedin`, `internal_note` |
| **Totale righe `v_relationship_timeline`** | **~21** | **9 type_code distinti** |

Sufficienti per:
- 🟢 Verificare ordering DESC cronologico
- 🟢 Verificare cursor pagination (≥2 pagine con `limit=10`)
- 🟢 Verificare ogni filtro: `source`, `type_code`, `manual_only`, `contact_id`, `since/until`
- 🟢 Verificare day-grouping in UI (date sparse sulle ultime ore)
- 🟢 Verificare Founder D4 (`admin_new_studio_request` deve sparire dalla view founder)
- 🟢 Verificare health hooks (le 5 attività M1 alimenteranno `relationship_score` post-deploy via hook)

**NESSUN seed servirà.** Lo storico Martinel è reale.

---

## 6 · BREAKDOWN ESECUTIVO (effort già concordato)

| Componente | Effort | Note |
|---|---:|---|
| Migration 033 + rollback | 0.2g | DDL minimal |
| Seed `seed_relationship_health_signals.py` | 0.2g | idempotent UPSERT |
| `services/relationship_health.py` | 0.3g | unico entry-point |
| Writer hook integration (8 punti) | 0.6g | un singolo chiamata per writer |
| `services/timeline.py` + cursor | 0.5g | EXPLAIN tuning |
| Routers admin + founder timeline | 0.4g | mirror D4 |
| Frontend `<TimelineFeed>` | 1.0g | lista + filtri + load more |
| Security script M2 (14 check) | 0.3g | |
| QA / smoke E2E + screenshot | 0.3g | |
| **Totale** | **3.8g** | (in parallelo BE+FE ≈ 2.3g calendario) |

*(rispetto al piano FINAL: −0.6g grazie al PHASE M2-0 cancellato — dati Martinel già reali.)*

---

## 7 · CHECKLIST DI ESECUZIONE M2 (sequenza fissa)

> Pronta per essere eseguita al "VAI" dell'utente. Ogni step è
> indipendentemente testabile.

1. ☐ Applicare migration 033 (idempotente) — verificare con `validate_m0.py` re-run
2. ☐ Eseguire `seed_relationship_health_signals.py` (idempotente) — verificare flag `score_delta`/`touch`/`visibility`/`notifiable` sui catalog
3. ☐ Implementare `services/relationship_health.py` con unit test su `apply_signal`
4. ☐ Implementare `services/timeline.py` con cursor pagination + JOIN catalog per label/icon
5. ☐ Wire 8 hook points nei writer esistenti (un commit per file) — re-run `m1_real_usage_validation.py` per regression
6. ☐ Implementare `routers/admin_timeline.py` + `routers/blueprint_timeline.py`
7. ☐ Implementare `frontend/src/admin/components/TimelineFeed.jsx`
8. ☐ Sostituire i 2 placeholder tab in `TenantDetail.jsx` + `BlueprintOverview.jsx`
9. ☐ Implementare `scripts/validate_m2_security.py` (14 check) — target 14/14
10. ☐ Re-run `m1_real_usage_validation.py` (regression) + `validate_m1_security.py` (regression) + `validate_m2_security.py` (new) — target 33/33 + 16/16 + 14/14
11. ☐ Smoke screenshot Timeline tab (admin + founder) → `/app/memory/m2_validation_screenshots/`
12. ☐ Produrre `M2_RELATIONSHIP_TIMELINE_EXECUTION_REPORT.md` finale

---

## 8 · COSA NON SARÀ IMPLEMENTATO IN M2 (riconferma)

| Area | Roadmap |
|---|---|
| Connection pooling / performance hardening | M1.1 (task separato) |
| Notification Center delivery / consumer / UI | M4 |
| Activity Log avanzato (CRUD attività ampliato) | M3 |
| Advisor Workspace + KPI | M5 |
| Health bands / decay / AI scoring / KPI dashboard | Fuori roadmap |
| `relationship_score` esposto al client | Mai (data-only) |
| Analytics, Launch Pack, AI | Fuori scope intero roadmap CRM |
| Backfill scoring storico | No (forward-only) |
| Email open/click events nel timeline | No (D5) |

---

## 9 · BLOCCANTI RESIDUI

🟢 **Nessuno.**
- 0 blocker P0
- 0 blocker P1
- Architettura confermata
- Dati reali pronti
- Decisioni utente recepite
- Effort honest 3.8g

L'unico gate residuo è il **"VAI"** dell'utente.

---

## 10 · COSA SERVE DALL'UTENTE PER PARTIRE

a) Conferma di procedere con M2 secondo i 12 step di §7
b) Eventuali variazioni di scope dell'ultimo minuto (label, icone, ordinamento default, ecc.)
c) Eventuali variazioni sul **default visibility** di alcuni event_types
   (oggi proposto: `admin_new_studio_request = 'admin_only'`, tutto il resto `'all'`)

Una volta ricevuto il "VAI", la prima cosa che farò sarà applicare la
migration 033 (idempotente) e poi procedere in ordine §7. Nessuna
modifica al frontend prima che le API siano funzionanti e testate
via curl/script.

---

*Generato 2026-06-02 da E1 (Emergent).*
*Stato: ATTESA DI APPROVAZIONE PER L'ESECUZIONE M2.*
*Reference: `M2_RELATIONSHIP_TIMELINE_FINAL_EXECUTION_PLAN.md`,
`M1_REAL_USAGE_VALIDATION_REPORT.md`, `M1_0_1_HOTFIX_REPORT.md`.*
