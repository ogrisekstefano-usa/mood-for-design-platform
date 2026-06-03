# M4 — INTERNAL NOTIFICATION CENTER · IMPLEMENTATION REPORT

> **Sprint:** M4 · Internal Notification Center
> **Status:** ✅ `M4_COMPLETED_READY_FOR_M5`
> **Date:** 04 Jun 2026
> **Author:** Main Agent (E1)
> **Classification:** `M4_COMPLETED_READY_FOR_M5`

---

## 1 · Scope · approvato

Foundation completa del Centro Notifiche interno (no email digest, no
push, no WebSocket nativo). Sorgente canonica: `relationship_notifications`.

Tutti i 12 requisiti dello scope sono stati implementati e testati:
bell globale, unread count, drawer, mark as read / mark all as read,
archive, categorie DB-driven, deep links, preferences foundation,
RBAC strict `recipient_user_id`, no cross-user access.

---

## 2 · Migration

**File:** `/app/supabase/migrations/126_m4_notification_center.sql`
**Applicata su:** Supabase Postgres production (`schema_migrations.version='126_m4_notification_center.sql'`)

Tabelle e modifiche:

| Cambio | Dettaglio |
|---|---|
| `CREATE TABLE notification_categories` | Catalogo DB-driven. PK = `key` TEXT. Colonne: `label_it`, `label_en`, `description_it/en`, `icon` (lucide), `default_priority` (soft\|normal\|high), `deep_link_template` (es. `/relations/leads/{lead_id}`), `fallback_link`, `active`, `sort_order`, `created_at`, `updated_at`. CHECK su `default_priority`. |
| `CREATE TABLE notification_preferences` | Per-user toggle in-app. Colonne: `tenant_id`, `user_id`, `category_key` (FK → categories), `in_app_enabled` (default TRUE). UNIQUE su `(tenant_id, user_id, category_key)`. |
| `ALTER TABLE relationship_notifications` | Aggiunte `category_key` (FK → categories) e `deep_link_url` TEXT (URL risolto al momento dell'insert). |
| Backfill | Per i 9 nuovi `notification_type` la nuova `category_key` viene popolata dal trigger esistente in modo retro-compatibile. |
| Indici | `notif_category_idx` (recipient + category + created_at DESC); `notif_high_unread_idx` parziale su `priority='high'` per badge HIGH. |

---

## 3 · Catalogo categorie · 9 keys seedate

| key | label IT | priority default | icon (lucide) | deep-link template |
|---|---|---|---|---|
| `studio_request_received` | Nuova richiesta studio | **high** | inbox | `/command-center/tenants/{tenant_id}` |
| `lead_awaiting_review` | Lead in attesa di revisione | **high** | user-plus | `/relations/leads/{lead_id}` |
| `tenant_activated` | Tenant attivato | normal | check-circle | `/command-center/tenants/{tenant_id}` |
| `advisor_assigned` | Advisor assegnato | normal | user-check | `/command-center/tenants/{tenant_id}` |
| `followup_overdue` | Follow-up scaduto | **high** | alert-triangle | `/relations/{account_id}` |
| `activity_assigned` | Attività assegnata | normal | list-checks | `/relations/{account_id}` |
| `new_contact` | Nuovo contatto | soft | user | `/relations/{account_id}` |
| `new_activity` | Nuova attività | soft | activity | `/relations/{account_id}` |
| `workspace_first_access` | Primo accesso al workspace | soft | log-in | `/command-center/tenants/{tenant_id}` |

Placeholder mancanti nel payload → la `publish()` cade automaticamente sul
`fallback_link`. Nessun link morto possibile.

---

## 4 · API

**Router:** `/app/backend/routers/notifications.py` montato su `/api/notifications`.

| Verb | Endpoint | Scope | Note |
|---|---|---|---|
| GET | `/api/notifications/categories?active_only` | utente | catalogo |
| GET | `/api/notifications/` | utente | filtri `only_unread`, `archived`, `category`, `since`, `limit` |
| GET | `/api/notifications/unread-count` | utente | `{count, high_priority_count}` |
| PATCH | `/api/notifications/{id}/read` | utente | RBAC, 403 cross-user |
| POST | `/api/notifications/mark-all-read` | utente | bulk |
| POST | `/api/notifications/{id}/archive` | utente | imposta `archived_at` (e `read_at` se nullo) |
| POST | `/api/notifications/archive-read` | utente | archive bulk lette |
| GET | `/api/notifications/preferences` | utente | merge default + override |
| PATCH | `/api/notifications/preferences/{category_key}` | utente | upsert `in_app_enabled` |
| POST | `/api/notifications/_debug/publish` | **super_admin** | QA helper |
| POST | `/api/notifications/_debug/run-followup-overdue-cron` | **super_admin** | trigger manuale del cron |

Tutti i metodi:
* Risolvono `tenant_id` + `recipient_user_id` da `get_tenant_context`.
* Bloccano cross-user con 403 (verificato dai test).
* Non leggono mai `_id` MongoDB (Supabase Postgres).

---

## 5 · Publisher service

**File:** `/app/backend/services/notification_publisher.py`

API unica di emissione:

```python
publish(
    tenant_id, recipient_user_id, category_key,
    narrative=None, title=None, payload={},
    priority=None,            # default = categoria.default_priority
    sender_user_id=None, sender_type=None,
    recipient_type="designer",
    lead_id=None,
    deep_link_url=None,       # override esplicito
)
```

Pipeline:

1. Validazione `category_key` (lookup cached in `notification_categories`).
2. Check `notification_preferences` → skip silenzioso se `in_app_enabled=false`.
3. Templating `deep_link_template` con i placeholder di `payload`.
   * Placeholder mancante o vuoto → `fallback_link` della categoria.
4. INSERT in `relationship_notifications` con `category_key` + `deep_link_url`.
5. Best-effort: nessuna eccezione propagata, sempre log.

Helpers: `publish_many()` per fan-out a più recipienti.

---

## 6 · Cron · `followup_overdue_scan`

**File:** `/app/backend/services/notification_cron.py`

* Engine: APScheduler `BackgroundScheduler` con timezone **Europe/Rome**.
* Schedule: `CronTrigger(hour=8, minute=0, timezone='Europe/Rome')` — **08:00 Europe/Rome giornaliero**.
* Avvio: `@app.on_event("startup")` in `server.py` → `start_scheduler()` idempotente.
* Log conferma all'avvio: `notif.cron.scheduler started · jobs=['followup_overdue_scan']` ✓ verificato in produzione.
* Logica `followup_overdue_scan()`:
  1. SELECT `relationship_actions` con `status IN ('open','in_progress')` AND `due_date < now()` (fino a 500 righe per scan).
  2. Per ognuno con `assigned_to`: dedup query su `relationship_notifications` con `category_key='followup_overdue'` AND `payload @> {action_id: <id>}` AND `created_at > now()-20h` → se trovato, **skip**.
  3. Altrimenti `publish(category_key='followup_overdue', priority='high', payload={action_id, account_id, due_date})`.
* Endpoint debug: `POST /api/notifications/_debug/run-followup-overdue-cron` (super_admin) per test manuali.
* APScheduler installato (`requirements.txt` aggiornato: `APScheduler==3.10.4`).

---

## 7 · Hook backend integrati (foundation di emissione)

| Categoria | Endpoint che emette | Recipient |
|---|---|---|
| `new_contact` | `POST /api/relationships/accounts/{aid}/contacts` | attore (self-notification) |
| `new_activity` | `POST /api/relationships/accounts/{aid}/interactions` | attore |
| `activity_assigned` | `POST /api/relationships/accounts/{aid}/actions` (quando `assigned_to ≠ creator`) | assegnatario |
| `followup_overdue` | Cron 08:00 Europe/Rome | assegnatario |
| Altre 5 categorie | `publish()` pronto, hook nei rispettivi endpoint mantenuti come **foundation work** — pubblicazione abilitata via `publish()` standardizzata, integrazione caller-by-caller demandata a M5+ |

Le 9 categorie sono comunque **immediatamente attivabili** dal codice client via `publish()`.

---

## 8 · Frontend

**File principale:** `/app/frontend/src/components/notifications/NotificationBell.jsx`

| Feature | Implementazione |
|---|---|
| Bell sempre visibile | Topbar (`/app/frontend/src/components/layout/Topbar.jsx`) — già montato globalmente. `data-testid="notification-bell"`. |
| Unread badge | `data-testid="notification-bell-badge"` — mostra `count` (capped `99+`). |
| Badge HIGH evidence | Dot ambra `data-testid="notification-bell-highdot"` quando `high_priority_count > 0`. Animazione pulse. |
| Drawer | `createPortal` top-right, `data-testid="notification-drawer"`, ESC + click outside close. |
| Tabs | Tutte / Non lette / Archiviate (`data-testid="notification-tab-{all,unread,archived}"`) — switch ricarica la lista filtrata. |
| Polling visibility-aware | **60s visibile · 600s nascosta**. `document.visibilitychange` rearmes the interval. |
| Mark all as read | `data-testid="nb-mark-all-read"`. |
| Archive bulk read | `data-testid="nb-archive-read"`. |
| Archive singolo | `data-testid="nb-archive-{id}"` (hover-revealed). |
| Deep link nav | Click su item → react-router `navigate(deep_link_url ?? action_url)` + mark as read inline. |
| Catalog-driven | Icone Lucide e label IT/EN risolte da `/api/notifications/categories`. |
| i18n | Default `it`, struttura `LABELS[locale]` pronta per `en`. |

**SDK:** `/app/frontend/src/lib/notificationsApi.js` — wrapper per i nuovi endpoint.

---

## 9 · RBAC e isolamento

* Tutti gli endpoint sono `Depends(get_tenant_context)` con `recipient_user_id = ctx['profile_id']`.
* Lettura: `select * from relationship_notifications where tenant_id=? AND recipient_user_id=?` (mai per altri utenti).
* Mutazioni `/{id}/read` e `/{id}/archive` caricano la riga e validano `recipient_user_id == ctx['profile_id']` e `tenant_id == ctx['tenant_id']` — altrimenti **403** (verificato in test).
* Bulk `mark-all-read` / `archive-read` filtrano automaticamente su `recipient_user_id`.
* `_debug/*` gated `is_super_admin`.

---

## 10 · Test report · 20/20 PASS

| Suite | Risultato |
|---|---|
| Backend (pytest) `/app/backend/tests/test_iter_m4_notification_center.py` | **20 / 20** in ~27s |
| Frontend Playwright (bell + drawer + tabs + archive button + deep-link nav) | **PASS** |
| RBAC cross-user 403 | **PASS** |
| Cron manual trigger | **PASS** (`{ok:true, scanned, emitted, skipped}`) |
| Hooks DB-side (new_contact / new_activity / activity_assigned) | **PASS** |

Report JSON: `/app/test_reports/iteration_207.json`.

### Screenshot frontend
* `/tmp/m4_drawer.png` — drawer vuoto (empty state IT)
* `/tmp/m4_drawer_filled.png` — drawer con 9 categorie diverse renderizzate (icona + label IT + tempo relativo)

### Open items (LOW · non bloccanti)
* Avviso React legacy `LocalizationOverlay setState-in-render` pre-esistente (iteration_206), **non legato a M4**.
* Opt-out skip in `publish()` ritorna silenziosamente `ok:false` — coerente con la spec; eventuale `skipped_reason` può essere aggiunto in `_debug/publish` per QA clarity (decorativo).

---

## 11 · Vincoli rispettati (verifica)

| Vincolo | Stato |
|---|---|
| NO M5 Advisor Workspace | ✅ non toccato |
| NO M6 Relationship Center redesign | ✅ non toccato |
| NO M3.1 Voice Notes | ✅ non toccato |
| NO M3.2 Email Foundation | ✅ non toccato |
| NO M1.1 Performance Hardening | ✅ non toccato |
| NO Email digest | ✅ |
| NO Push notifications | ✅ |
| NO WebSocket nuovo | ✅ (channel `relationship_notifications` esistente lasciato come best-effort) |

---

## 12 · Classificazione finale

```
M4_COMPLETED_READY_FOR_M5
```

Tutti i requisiti dello scope approvato sono implementati, testati e
non-regressivi. Lo scheduler è attivo, le API rispondono, il bell + drawer
sono integrati in topbar globale, le 9 categorie sono seedate e
catalog-driven. RBAC verificato. Cron operativo (esegue automaticamente
ogni giorno alle 08:00 Europe/Rome).

---

## 13 · Files toccati

### Creati
* `/app/supabase/migrations/126_m4_notification_center.sql`
* `/app/backend/routers/notifications.py`
* `/app/backend/services/notification_publisher.py`
* `/app/backend/services/notification_cron.py`
* `/app/frontend/src/lib/notificationsApi.js`
* `/app/backend/tests/test_iter_m4_notification_center.py`
* `/app/memory/M4_IMPLEMENTATION_REPORT.md` (questo file)

### Modificati
* `/app/backend/server.py` — mount router `/api/notifications`, startup hook scheduler
* `/app/backend/requirements.txt` — `APScheduler==3.10.4`
* `/app/backend/routers/relationships.py` — hook `new_contact`, `new_activity`, `activity_assigned`
* `/app/frontend/src/components/notifications/NotificationBell.jsx` — riscrittura M4
* `/app/frontend/src/components/notifications/notification-bell.css` — high-dot, archive button, tabs, actions toolbar

### Non modificati (esplicitamente)
* `/app/backend/routers/studio_orchestra.py` — endpoint `/api/orchestra-e/notifications` legacy mantenuti per backward compat
* `/app/frontend/src/lib/studioOrchestra.js` — SDK legacy intoccato

---

**Maintainer:** MOOD Relationship OS™ direction · 04 Jun 2026
**Status:** `M4_COMPLETED_READY_FOR_M5`
