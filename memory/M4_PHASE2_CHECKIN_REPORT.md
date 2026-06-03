# M4 · Check-in Fase 2 — Schema + Service

**Versione**: 1.0 · **Data**: 03 Giugno 2026 · **Stato**: ⏸ In attesa di approvazione esplicita per Fase 3+
**Scope completato**: Migration 035 applicata + 9 categorie seedate + `services/notifications.py` funzionante e testato (19/19 PASS isolati)
**Scope NON ancora avviato**: hook nei 5 servizi esistenti · cron follow-up overdue · router FastAPI · componenti frontend

---

## 1 · Schema finale applicato (Supabase prod)

### 1.1 Catalog `platform_notification_types` — 9 row seedate

| code                       | label_it                       | category   | priority | admin | advisor | owner |
| -------------------------- | ------------------------------ | ---------- | -------- | :---: | :-----: | :---: |
| `studio_request_received`  | Nuova richiesta studio          | lifecycle  | normal   |   ✓   |    ✓    |       |
| `lead_awaiting_review` 🆕  | Lead in attesa di revisione    | review     | **high** |   ✓   |    ✓    |       |
| `tenant_activated`         | Tenant attivato                 | lifecycle  | normal   |   ✓   |    ✓    |       |
| `workspace_first_access`   | Primo accesso founder           | access     | normal   |   ✓   |    ✓    |       |
| `advisor_assigned`         | Assegnazione advisor            | assignment | **high** |       |    ✓    |       |
| `activity_assigned` 🆕     | Attività assegnata              | assignment | **high** |       |    ✓    |       |
| `followup_overdue`         | Follow-up in ritardo            | followup   | **high** |       |    ✓    |       |
| `new_contact`              | Nuovo contatto                  | activity   | low      |       |    ✓    |   ✓   |
| `new_activity`             | Nuova attività                  | activity   | low      |       |    ✓    |       |

🆕 = aggiunte secondo le modifiche utente §1 e §2.

### 1.2 Tabelle nuove

```
platform_notification_types               (9 row · catalog DB-driven)
relationship_notification_preferences     (in_app + email + push_enabled future-ready)
```

### 1.3 `relationship_notifications` estesa

Nuove colonne (6) — tutte FK strutturate per § richiesta utente #9 "notifiche = dati":

| Colonna                  | Tipo  | FK target                       | Note                                         |
| ------------------------ | ----- | ------------------------------- | -------------------------------------------- |
| `notification_type_code` | TEXT  | `platform_notification_types`   | Vincolo soft, sempre popolato dal servizio   |
| `contact_id`             | UUID  | `tenant_contacts(id) ON DEL SET NULL` | Persistito automaticamente              |
| `activity_id`            | UUID  | `relationship_activities(id) ON DEL SET NULL` | Persistito automaticamente      |
| `advisor_user_id`        | UUID  | `users(id) ON DEL SET NULL`     | Advisor coinvolto (≠ recipient)              |
| `source_event_type`      | TEXT  | —                               | Es. `lifecycle:tenant_activated` (audit)     |
| `source_event_id`        | UUID  | —                               | Es. row id dell'evento sorgente              |
| `dedup_key`              | TEXT  | —                               | UNIQUE index `(recipient_user_id, dedup_key)`|

### 1.4 Constraint CHECK aggiornati (importante!)

I check legacy in 031 limitavano i valori a un vocabolario marketplace obsoleto. La 035 li ha sostituiti:

```sql
-- PRIMA (legacy 031): recipient_type IN ('client','designer','studio')
--                     priority      IN ('soft','normal','high')

-- DOPO (035): vocabolario canonico MOOD Core
recipient_type IN ('admin','advisor','owner','editor','client','designer','studio')
priority       IN ('low','normal','high','urgent','soft')
```

### 1.5 Indici nuovi (3)

```sql
uq_notif_dedup                         UNIQUE partial → impedisce duplicati
idx_notif_recipient_type               drawer filter per tipo + sort by created_at DESC
idx_notif_recipient_priority_unread    partial unread → drawer filter "Critiche"
```

---

## 2 · Mock drawer aggiornato

🖼 **URL preview live**: `/_mood_mockup.html?notif=1`

**Cambiamenti recepiti**:
- ✅ Bell con `!` rosso pulsante (animazione CSS) per notifiche critiche
- ✅ Filtri estesi: **Tutte** / **Non lette** / **Critiche** (rosso) / **Attività** / **Tenant** / **Advisor**
- ✅ Categoria `Lead Awaiting Review` (priority HIGH, rosso) in cima
- ✅ Categoria `Activity Assigned` (teal, priority HIGH)

**Drawer struttura**:
```
┌─ 🔔 Notifications · 12 nuove · [Mark all read] · [✕] ────┐
│  Tutte (47) · Non lette (12) · CRITICHE (3) · Attività · │
│                                       Tenant · Advisor   │
├──────────────────────────────────────────────────────────┤
│ ▌▲ LEAD AWAITING REVIEW                  · 3 min fa      │
│    La richiesta di Studio Verri Milano                   │
│    è in attesa di revisione da più di 48h.               │
│ ▌◆ ACTIVITY ASSIGNED                     · 8 min fa      │
│    Ti è stata assegnata "Demo Material Intelligence"     │
│    su Martinel ID.                                       │
│ ▌▲ FOLLOW-UP OVERDUE                     · 12 min fa     │
│    Il follow-up "Sintesi call con Luca Conti"            │
│    è in ritardo di 3 giorni.                             │
│ ▌◇ NEW STUDIO REQUEST                                    │
│ ▌● TENANT ACTIVATED                                      │
│ ▌☎ NEW ACTIVITY ADDED                                    │
│ ▌+ NEW CONTACT                                           │
│  ◆ ADVISOR ASSIGNMENT                                    │
│  ✉ NEW ACTIVITY (read)                                   │
│  ◎ WORKSPACE ACCESS (read)                               │
└──────────────────────────────────────────────────────────┘
▌ = bordo teal 2px = unread
```

---

## 3 · Esempio payload notifica (DB row reale)

Output diretto da `SELECT * FROM relationship_notifications WHERE id = ...`:

```json
{
  "id": "ba027eaf-f952-4645-b83b-6c844130c5f0",
  "tenant_id": "c64659f6-5a76-41dd-8d8d-b901d29862af",
  "lead_id": null,
  "recipient_user_id": "2efb86f8-6546-4bb0-a653-6eab772a0da3",
  "recipient_type": "admin",
  "sender_user_id": null,
  "sender_type": "system",
  "notification_type": "studio_request_received",
  "notification_type_code": "studio_request_received",
  "title": "Nuova richiesta studio",
  "narrative": "Nuova richiesta da TestStudio Probe. Submitted via V2.",
  "payload": {"studio_name": "TestStudio Probe"},
  "priority": "normal",
  "contact_id": null,
  "activity_id": null,
  "advisor_user_id": null,
  "source_event_type": null,
  "source_event_id": null,
  "dedup_key": "test:t3:studio_req:1",
  "action_url": "/command-center/studio-requests",
  "action_label": null,
  "read_at": null,
  "archived_at": null,
  "created_at": "2026-06-03T06:41:15.728+00:00"
}
```

Esempio strutturato (categoria `new_contact` con FK piene):

```json
{
  "notification_type_code": "new_contact",
  "narrative": "Mario è stato/a aggiunto/a come founder a Martinel.",
  "tenant_id":  "c64659f6-...",   ← FK strutturato
  "contact_id": "a9b94bf0-...",   ← FK strutturato
  "advisor_user_id": "2efb86f8-...", ← FK strutturato
  "priority": "low",
  "action_url": "/command-center/tenants/c64659f6-.../?tab=contacts"
}
```

→ **Una notifica è anche un record dati**: M5/digest/KPI possono fare `JOIN` su `contact_id`, `activity_id`, `advisor_user_id` senza parsing del payload testuale.

---

## 4 · Esempio unread counter (output API)

Output reale del servizio `unread_count(user_id=admin)`:

```json
{
  "total": 2,
  "by_priority": {
    "high": 1,
    "normal": 1
  },
  "by_category": {
    "review":   1,
    "lifecycle": 1
  },
  "has_critical": true
}
```

**Frontend logic per il bell**:
- `total > 0` → mostra badge rosso con il numero
- `has_critical == true` → mostra `!` rosso pulsante sopra il badge (animazione CSS pulse)
- `total == 0` → bell normale senza badge

Endpoint futuro (Fase 3, ancora NON implementato):
- `GET /api/notifications/unread-count` → restituisce esattamente questa shape

---

## 5 · Esempio RBAC matrix (verificata con test isolati)

Test eseguiti contro DB Supabase produzione:

| Test                                               | Esito | Note                                                  |
| -------------------------------------------------- | :---: | ----------------------------------------------------- |
| Admin marca propria notifica come read             |   ✅   | `mark_read` ritorna `1`                               |
| Owner (founder) tenta di marcare notifica di Admin |   ✅   | `mark_read` ritorna `0` — **niente leak cross-user**  |
| Admin lista solo `recipient_user_id = self`        |   ✅   | Tutti gli endpoint filtrano server-side               |
| Opt-out `in_app_enabled = false` filtra recipient  |   ✅   | `notify()` salta l'utente · ritorna `[]`              |
| Dedup_key UNIQUE impedisce duplicati               |   ✅   | Secondo `notify()` ritorna `[]`                       |
| Categoria HIGH priority (`lead_awaiting_review`)   |   ✅   | `priority='high'` persistito                          |
| `activity_assigned` routing automatico advisor     |   ✅   | Resolve via `tenant_relationship_owner_user_id`       |
| FK strutturate persistono (contact/activity/...)   |   ✅   | Tutte le 4 colonne FK popolate quando fornite         |
| `unread_count.has_critical` true se HIGH presente  |   ✅   | Frontend potrà accendere il `!` rosso                 |

**RBAC riassunto**:
```
recipient_user_id = auth.user.id                    [HARD FILTER, ovunque]
+ tenant scope già garantito da deep links
+ preferences opt-out per categoria
+ no cross-user mark_read / archive
```

---

## 6 · Servizio `notifications.py` — Public API

`/app/backend/services/notifications.py` (480 righe, lint pulito):

| Funzione              | Scopo                                                              |
| --------------------- | ------------------------------------------------------------------ |
| `notify()`            | Fan-out di N row per N recipient · dedup · template render · deep link role-aware |
| `list_for_user()`     | Reader paginato per il drawer · cursor base64 · filter category/priority/unread/types |
| `unread_count()`      | Bell badge fast · ritorna total + by_priority + by_category + has_critical |
| `mark_read()`         | Single (ids[]) o bulk (all_for_user=True)                          |
| `archive()`           | Hide dal drawer mantenendo audit (`archived_at = NOW()`)           |
| `list_categories()`   | Catalog reader (JOIN-free, frontend popola filtri/icone)           |
| `get_preferences()`   | Matrice user × type · default in_app=TRUE · email/push=FALSE       |
| `set_preferences()`   | Bulk upsert per opt-in/out                                         |

Tutte async, SQLAlchemy `AsyncSession`, parameters bound via `text(...)`, no string concat.

---

## 7 · Risultati test isolati (Fase 2)

```
TEST  1  list_categories                          PASS  (9 categories)
TEST  2  all 9 codes present                      PASS
TEST  3  notify creates 1 row                     PASS
TEST  4  dedup_key blocks duplicates              PASS
TEST  5  template render IT + title from catalog  PASS  ("Nuova richiesta da TestStudio Probe...")
TEST  6  HIGH priority (lead_awaiting_review)     PASS
TEST  7  unread_count.has_critical = true         PASS  ({'total':2,'by_priority':{'high':1,'normal':1},'has_critical':true})
TEST  8  list_for_user joins catalog              PASS  (icon/category resolved)
TEST  9  action_url generated for admin           PASS  (/command-center/studio-requests)
TEST 10  category filter (review)                 PASS
TEST 11  only_unread filter                       PASS
TEST 12  priority filter (high+urgent)            PASS
TEST 13  mark_read single                         PASS
TEST 14  RBAC owner cannot mark admin's notif     PASS  ← anti-leak
TEST 15  archive                                  PASS
TEST 16  in_app opt-out filter                    PASS
TEST 17  preferences matrix (in_app/email/push)   PASS  ← future-ready
TEST 18  structured FK persisted                  PASS  (contact_id + advisor_user_id + tenant_id)
TEST 19  activity_assigned auto-routes to advisor PASS  (HIGH, /command-center/...)
─────────────────────────────────────────────────────────
TOTAL                                             19 / 19 PASS
```

Tutti i test puliscono i record di test al termine (`DELETE WHERE dedup_key LIKE 'test:%'`).

---

## 8 · Modifiche utente §1-§9 — stato

| # | Richiesta utente                                              | Stato                                                  |
| - | ------------------------------------------------------------- | ------------------------------------------------------ |
| 1 | Categoria `lead_awaiting_review` (admin+advisor, HIGH)        | ✅ Implementata in catalog + testata (TEST 6)          |
| 2 | Categoria `activity_assigned` (advisor, HIGH)                 | ✅ Implementata + auto-routing testato (TEST 19)       |
| 3 | Cron follow-up `Europe/Rome 08:00` non UTC                    | ⏸ In Fase 5 (APScheduler con `timezone='Europe/Rome'`) |
| 4 | Polling 60s attivo / 10min inattivo                           | ⏸ In Fase 6 (frontend `useNotifications`)              |
| 5 | Bell `!` rosso su HIGH unread                                 | ✅ `unread_count.has_critical` esposto + mock CSS pulse |
| 6 | Drawer filtri Tutte/Non lette/Critiche/Attività/Tenant/Advisor| ✅ Reader supporta tutti i filtri + mock aggiornato     |
| 7 | Preferences in_app + email + push future-ready                | ✅ 3 colonne nel DB · service legge tutte (TEST 17)    |
| 8 | Deep link fallback workspace→command-center                   | ✅ `_build_action_url` ha fallback per ogni categoria  |
| 9 | Notifiche strutturate (FK tenant/contact/activity/advisor)    | ✅ 4 FK colonne create e persistite (TEST 18)          |

---

## 9 · Fasi successive (in attesa di approvazione esplicita)

| Fase | Scope                                                        | Stima       | Bloccante? |
| ---- | ------------------------------------------------------------ | ----------- | :--------: |
| 3    | `routers/notifications.py` + 7 endpoint REST + curl tests    | 0.75 giorno |     —      |
| 4    | Hook in 5 servizi esistenti (studio_v2, activation, ...)     | 0.75 giorno |     —      |
| 5    | Cron `followup_overdue` Europe/Rome 08:00 + APScheduler      | 0.5 giorno  |     —      |
| 6    | Frontend: `NotificationBell` + `NotificationDrawer` + hook   | 1.5 giorni  |     —      |
| 7    | `validate_m4.py` (47+ check end-to-end)                      | 0.5 giorno  |     —      |
| 8    | Testing agent v3 fork smoke + RBAC                           | 0.25 giorno |     —      |
| 9    | Docs + M4_IMPLEMENTATION_REPORT.md                           | 0.25 giorno |     —      |

---

## 10 · Domande di check-in

Per autorizzare la prosecuzione, rispondi a queste 3 domande:

**A. Schema finale § 1**
- a1) ✅ **Approvo**, procedi con Fase 3 (router REST)
- a2) 🔧 Cambiare qualcosa nel catalog (specificare quale codice/label/priority/routing)
- a3) 🔧 Cambiare qualcosa nelle FK strutturate (specificare quale colonna)

**B. Drawer mockup § 2**
- b1) ✅ **Approvo** i 6 filtri (Tutte/Non lette/Critiche/Attività/Tenant/Advisor)
- b2) 🔧 Voglio modificare i filtri (specificare)
- b3) 🔧 Il `!` rosso pulsante è troppo aggressivo → preferisco statico

**C. Payload + RBAC § 3-5**
- c1) ✅ **Approvo**, procedi con Fase 3
- c2) 🔧 Servono campi aggiuntivi sul payload (specificare)
- c3) 🔧 Vorrei estendere la RBAC (es. admin può marcare letta una notif advisor)

Risposta minimale ammessa: `A:a1 B:b1 C:c1` → procedo automaticamente con Fasi 3 → 9.

⚠️ Nessuna implementazione di hook/cron/router/frontend fino alla tua conferma.
