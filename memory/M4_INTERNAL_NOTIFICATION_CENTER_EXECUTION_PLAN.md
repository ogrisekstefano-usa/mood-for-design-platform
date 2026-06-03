# M4 — Internal Notification Center · Execution Plan

**Versione**: 1.0 · **Data**: 03 Giugno 2026 · **Stato**: ⏸ In attesa di approvazione esplicita
**Classificazione proposta**: `READY_FOR_M4_IMPLEMENTATION`
**Predecessori**: M0 ✅ · M1 ✅ · M1.0.1 ✅ · M2 ✅ · M3 ✅
**Successori bloccati da M4**: M5 (Advisor Workspace) — usa le stesse pipe di notifica
**Scope esplicito autorizzato**: solo bell · unread count · drawer · canonical store · deep links · mark read/all · categorie · hook su eventi esistenti · recipient model admin/advisor/founder
**Fuori scope**: ❌ email digest · ❌ push notification · ❌ M5 · ❌ pages dedicate · ❌ websocket realtime (foundation polling-friendly)

---

## 0 · Stato di fatto (audit pre-M4)

| Item                                            | Esiste? | Note                                                                                          |
| ----------------------------------------------- | :-----: | --------------------------------------------------------------------------------------------- |
| Tabella `relationship_notifications`            |   ✅    | 17 colonne · 0 row · indici partial già presenti                                              |
| Tabella `notifications` (legacy)                |   ✅    | 9 colonne · marcata `LEGACY · READ-ONLY` in 031 (NON usare)                                   |
| Catalog `platform_notification_types`           |   ❌    | DA CREARE in 035                                                                              |
| `notifiable BOOLEAN` su `platform_event_types`  |   ✅    | preparato in 033 ma non utilizzato                                                            |
| `notifiable` su `platform_activity_types`       |   ✅    | preparato in 033 ma non utilizzato                                                            |
| Servizio `services/notifications.py`            |   ❌    | DA CREARE                                                                                     |
| Hook in `services/studio_activation.py`         |   🟡    | commenti `# 2) Super-admin notification` + `# 3) Advisor notification` MA non scrivono in DB |
| Endpoint REST notifications                     |   ❌    | DA CREARE (`routers/notifications.py`)                                                        |
| Topbar bell + drawer frontend                   |   ❌    | DA CREARE (`NotificationBell.jsx` + `NotificationDrawer.jsx`)                                 |
| User roles in produzione                        |   🟢    | `admin` (1) · `owner` (39) — `advisor`/`editor` previsti dal modello ma 0 in prod oggi        |

**Conseguenza**: la fondazione DB di 031 è già pronta. M4 è principalmente *catalog + service + endpoint + UI + hooks*. **Non c'è una nuova tabella core da creare**.

---

## 1 · Database — Migration 035

### 1.1 Nuove tabelle

```sql
-- 035_notification_center.sql

-- Catalog dei tipi di notifica (DB-driven, NON hardcoded)
CREATE TABLE platform_notification_types (
    code                 TEXT PRIMARY KEY,
    label_it             TEXT NOT NULL,
    label_en             TEXT NOT NULL,
    narrative_template   TEXT NOT NULL,        -- es. "{{actor}} ha registrato una {{activity_type}} con {{contact}}"
    icon                 TEXT NOT NULL,        -- lucide name
    color                TEXT,                 -- hex opzionale
    category             TEXT NOT NULL,        -- 'lifecycle' | 'activity' | 'followup' | 'access' | 'assignment'
    default_priority     TEXT NOT NULL DEFAULT 'normal'
                         CHECK (default_priority IN ('low','normal','high','urgent')),
    -- target audience routing
    notify_admin         BOOLEAN NOT NULL DEFAULT FALSE,
    notify_advisor       BOOLEAN NOT NULL DEFAULT FALSE,
    notify_owner         BOOLEAN NOT NULL DEFAULT FALSE,      -- founder
    notify_actor         BOOLEAN NOT NULL DEFAULT FALSE,      -- echo all'autore? di solito FALSE
    -- governance
    is_system            BOOLEAN NOT NULL DEFAULT TRUE,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order           INTEGER NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE platform_notification_types IS
  'Catalog of notification kinds. DB-driven labels/icons/routing. NO hardcoded UI text.';

-- Preferenze per utente × categoria (opt-out granulare)
CREATE TABLE relationship_notification_preferences (
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type    TEXT NOT NULL REFERENCES platform_notification_types(code) ON DELETE CASCADE,
    in_app_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
    email_enabled        BOOLEAN NOT NULL DEFAULT FALSE,   -- riservato a futuro digest, NO send in M4
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, notification_type)
);

CREATE INDEX idx_notif_prefs_user ON relationship_notification_preferences(user_id);
```

### 1.2 Estensioni `relationship_notifications`

```sql
ALTER TABLE relationship_notifications
    -- FK al catalog (non lo rendiamo NOT NULL subito per safety, ma in 035 backfillamo)
    ADD COLUMN IF NOT EXISTS notification_type_code TEXT
        REFERENCES platform_notification_types(code),
    -- correlazione event di origine (per audit/dedup)
    ADD COLUMN IF NOT EXISTS source_event_type TEXT,        -- es. 'lifecycle:tenant_activated'
    ADD COLUMN IF NOT EXISTS source_event_id   UUID,        -- es. id row di studio_relationship_events
    ADD COLUMN IF NOT EXISTS dedup_key         TEXT;        -- per evitare duplicati

-- Unique dedup per recipient × dedup_key (nullable)
CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_dedup
    ON relationship_notifications(recipient_user_id, dedup_key)
    WHERE dedup_key IS NOT NULL;

-- Indice per filtri categoria
CREATE INDEX IF NOT EXISTS idx_notif_recipient_category
    ON relationship_notifications(recipient_user_id, notification_type_code, created_at DESC);
```

### 1.3 Seed iniziale (catalog) — 7 tipi

```sql
INSERT INTO platform_notification_types
  (code, label_it, label_en, narrative_template, icon, color, category, default_priority,
   notify_admin, notify_advisor, notify_owner, notify_actor, sort_order)
VALUES
('studio_request_received',
 'Nuova richiesta studio', 'New studio request',
 'Nuova richiesta da {{studio_name}}. Submitted via V2.',
 'inbox', '#00C9B3', 'lifecycle', 'normal',
 TRUE, TRUE, FALSE, FALSE, 10),

('tenant_activated',
 'Tenant attivato', 'Tenant activated',
 '{{studio_name}} ha completato l''attivazione. Magic link inviato.',
 'check-circle', '#30A46C', 'lifecycle', 'normal',
 TRUE, TRUE, FALSE, FALSE, 20),

('advisor_assigned',
 'Assegnazione advisor', 'Advisor assignment',
 'Sei stato/a assegnato/a come advisor di {{studio_name}}.',
 'user-plus', '#00C9B3', 'assignment', 'high',
 FALSE, TRUE, FALSE, FALSE, 30),

('followup_overdue',
 'Follow-up in ritardo', 'Follow-up overdue',
 'Il follow-up "{{subject}}" è in ritardo di {{days}} giorni.',
 'alert-triangle', '#E5484D', 'followup', 'high',
 FALSE, TRUE, FALSE, TRUE, 40),

('new_contact',
 'Nuovo contatto', 'New contact added',
 '{{contact_name}} è stato/a aggiunto/a come {{role}} a {{studio_name}}.',
 'user', '#5EB1FF', 'activity', 'low',
 FALSE, TRUE, TRUE, FALSE, 50),

('new_activity',
 'Nuova attività', 'New activity added',
 'Una nuova {{activity_type}} è stata aggiunta a {{studio_name}} da {{actor}}.',
 'activity', '#F0B100', 'activity', 'low',
 FALSE, TRUE, FALSE, FALSE, 60),

('workspace_first_access',
 'Primo accesso founder', 'Workspace first access',
 '{{user_name}} ha effettuato il primo login sul workspace di {{studio_name}}.',
 'log-in', '#30A46C', 'access', 'normal',
 TRUE, TRUE, FALSE, FALSE, 70);
```

### 1.4 Rollback `035_notification_center.rollback.sql`
- DROP `relationship_notification_preferences`
- DROP indici nuovi
- ALTER `relationship_notifications` DROP COLUMN su `notification_type_code`, `source_event_*`, `dedup_key`
- DROP `platform_notification_types`

### 1.5 Validator
`/app/backend/scripts/validate_m4_schema.py` con:
- conta colonne · presenza FK · indici · 7 row in catalog · 7 row × N user in preferences (lazy: solo opt-in implicito)

---

## 2 · Backend service · `services/notifications.py`

### 2.1 API interna

```python
# /app/backend/services/notifications.py

async def notify(
    s: AsyncSession,
    *,
    type_code: str,                     # FK a platform_notification_types
    tenant_id: UUID,
    payload: dict | None = None,         # variabili per template
    sender_user_id: UUID | None = None,
    explicit_recipients: list[UUID] | None = None,   # bypass routing
    dedup_key: str | None = None,
    action_url: str | None = None,
    action_label: str | None = None,
    priority_override: str | None = None,
) -> list[UUID]:
    """
    1. Carica catalog row per type_code.
    2. Compone narrative (template + payload).
    3. Risolve recipients in base a flag notify_admin/advisor/owner/actor.
    4. Filtra recipients con preferences.in_app_enabled = FALSE (opt-out).
    5. Calcola action_url di default se non fornito (mapping per type_code).
    6. INSERT N row in relationship_notifications.
    7. Dedup soft via UNIQUE index su (recipient_user_id, dedup_key).
    Return: lista degli id creati.
    """

async def mark_read(s, user_id, *, ids: list[UUID] | None = None, all_for_user: bool = False) -> int: ...
async def list_for_user(s, user_id, *, cursor, limit, category=None, only_unread=False) -> dict: ...
async def unread_count(s, user_id) -> dict:
    # ritorna {total: int, by_category: {...}, by_priority: {...}}
    ...
async def get_preferences(s, user_id) -> list[dict]: ...
async def set_preferences(s, user_id, items: list[dict]) -> None: ...
```

### 2.2 Risoluzione recipient

```python
async def _resolve_recipients(
    s, *, type_row, tenant_id, sender_user_id, explicit_recipients,
) -> set[UUID]:
    if explicit_recipients:
        return set(explicit_recipients)
    out: set[UUID] = set()
    if type_row['notify_admin']:
        out |= await _all_super_admin_user_ids(s)
    if type_row['notify_advisor']:
        out |= await _advisors_for_tenant(s, tenant_id)
    if type_row['notify_owner']:
        out |= await _founders_for_tenant(s, tenant_id)
    if not type_row['notify_actor'] and sender_user_id:
        out.discard(sender_user_id)
    return out
```

| Helper                          | Query                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| `_all_super_admin_user_ids`     | `SELECT id FROM users WHERE role='admin' AND deleted_at IS NULL`                              |
| `_advisors_for_tenant(tid)`     | `SELECT tenant_relationship_owner_user_id FROM tenants WHERE id=:tid AND ...` + advisor del tenant attivati |
| `_founders_for_tenant(tid)`     | `SELECT id FROM users WHERE tenant_id=:tid AND role='owner' AND deleted_at IS NULL`           |

### 2.3 Generazione `action_url` (deep link)

Mapping interno nel servizio. Catalog-driven *opzionalmente* (futuro): per ora mapping pythonic stabile.

| `type_code`             | Recipient `admin`           | Recipient `advisor`               | Recipient `owner` (founder)        |
| ----------------------- | --------------------------- | --------------------------------- | ---------------------------------- |
| studio_request_received | `/command-center/studio-requests?id={lead_id}` | `/workspace/introductions?id={lead_id}` | — |
| tenant_activated        | `/command-center/tenants/{tid}` | `/workspace/studios/{tid}` | `/blueprint/overview` (own tenant) |
| advisor_assigned        | — | `/workspace/studios/{tid}` | — |
| followup_overdue        | `/command-center/tenants/{tid}?tab=activities&filter=overdue` | `/workspace/follow-ups` | — |
| new_contact             | — | `/workspace/studios/{tid}?tab=contacts&contact={cid}` | `/blueprint/overview?tab=contacts&contact={cid}` |
| new_activity            | — | `/workspace/studios/{tid}?tab=activities&activity={aid}` | — |
| workspace_first_access  | `/command-center/tenants/{tid}` | `/workspace/studios/{tid}` | — |

*Per M5* gli URL `/workspace/*` non esistono ancora — verranno cablati in M5. Per ora il servizio li compone già correttamente: l'advisor naviga lì da quando M5 sarà pronto. **Nessun link morto in M4**: in attesa di M5, il fallback per recipient advisor è `/command-center/tenants/{tid}` (l'advisor accede al Command Center oggi).

---

## 3 · Backend endpoints · `routers/notifications.py`

| Method | Path                                          | RBAC                | Note                                                            |
| ------ | --------------------------------------------- | ------------------- | --------------------------------------------------------------- |
| GET    | `/api/notifications`                          | any auth user       | cursor pagination, filter `category`, `only_unread`, `priority` |
| GET    | `/api/notifications/unread-count`             | any auth user       | lightweight: total + breakdown by category/priority             |
| POST   | `/api/notifications/mark-read`                | any auth user       | body `{ids?:[], all?:bool}` · ritorna `{updated: N}`            |
| POST   | `/api/notifications/{id}/archive`             | any auth user       | sets `archived_at`                                              |
| GET    | `/api/notifications/categories`               | any auth user       | catalog `platform_notification_types`                           |
| GET    | `/api/notifications/preferences`              | any auth user       | matrice user × type                                             |
| PATCH  | `/api/notifications/preferences`              | any auth user       | bulk upsert                                                     |

**RBAC**: ogni endpoint filtra `WHERE recipient_user_id = :auth_user_id`. Niente cross-user. Niente cross-tenant accidentale (RBAC sui tenant resta sui deep link, non sulla lista).

**Cursor format**: `base64({"created_at": iso, "id": uuid})`. Consistente con altri endpoint M2/M3.

### 3.1 Schemi response (Pydantic)

```python
class NotificationOut(BaseModel):
    id: UUID
    notification_type_code: str
    category: str
    priority: str
    title: str
    narrative: str
    icon: str
    color: str | None
    action_url: str | None
    action_label: str | None
    tenant_id: UUID | None
    tenant_name: str | None     # JOIN per UX (evita N+1 lato FE)
    read_at: datetime | None
    archived_at: datetime | None
    created_at: datetime
    sender_user_id: UUID | None
    sender_display: str | None
```

NO ObjectId. NO _id Mongo (PostgreSQL only). Tutti i datetime con tz, ISO 8601.

---

## 4 · Hook nei flussi esistenti

Tutti i punti di aggancio: **un solo `await notify(...)` per evento**.

| File                                                  | Evento                                            | Tipo di notifica          | dedup_key                                  |
| ----------------------------------------------------- | ------------------------------------------------- | ------------------------- | ------------------------------------------ |
| `services/studio_v2_submit.py` (o equivalente)        | `studio_requests` INSERT                          | `studio_request_received` | `req:{lead_id}`                            |
| `services/studio_activation.py`                       | tenant activation completed (status='activated')  | `tenant_activated`        | `act:{tenant_id}`                          |
| `services/studio_activation.py`                       | advisor attribution on activation                 | `advisor_assigned`        | `adv:{tenant_id}:{advisor_id}`             |
| `services/relationship_activities.py`                 | manual activity created where created_by != owner | `new_activity`            | `act:{activity_id}`                        |
| `services/admin_crm.py` (contacts POST)               | new contact added                                 | `new_contact`             | `cnt:{contact_id}`                         |
| `services/auth.py` magic-link first consume           | founder primo login                               | `workspace_first_access`  | `1stlogin:{user_id}`                       |
| Cron job `/app/backend/jobs/followup_overdue.py` NEW  | daily 08:00 UTC                                   | `followup_overdue`        | `fu:{activity_id}:{date}` (1×day cap)      |

**Convenzione idempotente**: ogni hook usa `dedup_key` calcolato in modo deterministico. Se viene chiamato due volte (es. retry), il UNIQUE constraint impedisce duplicati silently. `notify()` ritorna `[]` per i recipient già notificati.

### 4.1 Cron `followup_overdue`

```python
# /app/backend/jobs/followup_overdue.py
async def run_daily():
    # SELECT id, owner_user_id, tenant_id, subject, next_step_due_at
    #   FROM relationship_activities
    #  WHERE next_step_due_at < NOW()
    #    AND completed_at IS NULL AND archived_at IS NULL
    #    AND reminder_sent_at IS NULL OR reminder_sent_at < NOW() - INTERVAL '1 day'
    for row in rows:
        days = (NOW() - row.next_step_due_at).days
        await notify(s,
            type_code='followup_overdue',
            tenant_id=row.tenant_id,
            sender_user_id=None,
            explicit_recipients=[row.owner_user_id],
            payload={'subject': row.subject, 'days': days, 'activity_id': str(row.id)},
            dedup_key=f'fu:{row.id}:{TODAY}',
            action_url=f'/command-center/tenants/{row.tenant_id}?tab=activities&activity={row.id}',
        )
        # UPDATE reminder_sent_at = NOW()
```

**Trigger**: scheduler (APScheduler) o k8s cron. Per ora APScheduler in-process semplice, future-ready per migrazione a job worker dedicato.

---

## 5 · Frontend

### 5.1 Componenti nuovi

```
/app/frontend/src/components/notifications/
  NotificationBell.jsx          — icona campana + badge unread, montato in topbar Command Center + Workspace
  NotificationDrawer.jsx        — drawer 380px laterale destro
  NotificationItem.jsx          — singola riga (icon · cat · narrative · when · deep-link)
  NotificationFilters.jsx       — tabs Tutte/Non lette/Categoria/Sistema
  useNotifications.js           — hook globale (fetch + polling 30s + cache + mark-read mutations)
  notificationsApi.js           — axios wrapper
```

### 5.2 Integrazione shell

`WorkspaceShell.jsx` (già esistente) → aggiungo `<NotificationBell />` nella topbar a destra accanto al menu utente. Riutilizzato sia per Command Center sia (in M5) per Advisor Workspace.

### 5.3 Mockup di riferimento

Identico al drawer del mockup `/_mood_mockup.html?notif=1` (già approvato visualmente nel deliverable):
- Header: titolo Playfair + counter teal + `Mark all read` + `✕`
- Filtri: tabs *Tutte / Non lette / Menzioni / Sistema*
- Lista: icon quadrato categoria + categoria caps + narrative + when caps
- Unread: bar laterale teal 2px + bg leggermente teal-tinted
- Click su item → naviga ad `action_url` e marca read

### 5.4 Polling strategy

- `useNotifications.js` polla `GET /api/notifications/unread-count` ogni **30s** quando finestra attiva, 5min quando inattiva (Page Visibility API)
- Cache locale via SWR-pattern (revalidate on focus)
- Future-ready per WebSocket: hook design tale che basta swappare il transport

### 5.5 data-testid (obbligatori)

```
notification-bell
notification-bell-badge
notification-drawer
notification-drawer-close
notification-mark-all-read
notification-filter-all
notification-filter-unread
notification-filter-mentions
notification-filter-system
notification-item-{id}
notification-item-{id}-link
notification-empty
```

---

## 6 · RBAC matrix riepilogo

| Ruolo    | Vede notifiche  | Riceve quali categorie                                                      |
| -------- | --------------- | --------------------------------------------------------------------------- |
| admin    | solo proprie    | studio_request_received, tenant_activated, followup_overdue (proprie attività se owner), new_activity (se owner del tenant), workspace_first_access |
| advisor  | solo proprie    | studio_request_received (assigned), tenant_activated (assigned), advisor_assigned, followup_overdue, new_contact, new_activity, workspace_first_access |
| owner    | solo proprie    | new_contact (sul proprio tenant), tenant_activated (proprio), studio_request_received NO |
| editor   | solo proprie    | new_activity (se owner), followup_overdue (se owner)                        |

**Nessun cross-user. Nessun cross-tenant.** Strict.

---

## 7 · Performance & scala

| Aspetto              | Misura prevista                                                                       |
| -------------------- | ------------------------------------------------------------------------------------- |
| Insert per evento    | 1-5 row (in base ai recipient) · ~5ms per row                                         |
| List query           | indice `idx_relationship_notifications_recipient_unread` partial → <50ms su 100K row  |
| Unread count         | COUNT(*) su indice partial → <20ms                                                    |
| Polling cost         | 1 query GET unread-count ogni 30s × utenti attivi = trascurabile                      |
| Storage              | ~150K row a regime (50 advisor × 12 mesi × 25 notif/mese) · ~50MB con payload         |
| TTL                  | NESSUNO in M4 · `archived_at` manuale · cleanup retention dopo M4.1 (out of scope)    |

---

## 8 · Testing plan (`validate_m4.py`)

| Suite                                      | Test                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| **Schema** (12 check)                      | catalog 7 row, FK ok, indici partial, UNIQUE dedup, columns extended                          |
| **Service notify()** (10 check)            | crea 1 row per recipient, dedup_key impedisce duplicati, payload→narrative rendering, action_url generation per tutte le categorie |
| **Recipient resolution** (8 check)         | admin → tutti `role=admin`, advisor → owner del tenant, owner → tutti `role=owner` del tenant, opt-out preferences filtra |
| **Hook integration** (7 check)             | ognuno dei 7 eventi scatena `notify()` corretto · verificato via insert reale in tenant test  |
| **REST endpoints** (10 check)              | GET list filtro/cursore, GET unread-count, POST mark-read singolo/all, PATCH preferences upsert, RBAC isolation cross-user |
| **Frontend smoke** (testing_agent_v3)      | bell mostra badge, drawer si apre, mark all read svuota badge, item navigation funziona, polling ogni 30s |

Target: **≥ 47 check PASS** (no ignored). Report: `/app/test_reports/iteration_{N}.json`.

---

## 9 · File da creare / modificare

### 9.1 Nuovi (8 file backend + 6 frontend + 3 doc)

```
/app/backend/db/migrations/035_notification_center.sql
/app/backend/db/migrations/035_notification_center.rollback.sql
/app/backend/services/notifications.py
/app/backend/routers/notifications.py
/app/backend/jobs/__init__.py
/app/backend/jobs/followup_overdue.py
/app/backend/jobs/scheduler.py                       (APScheduler bootstrap)
/app/backend/scripts/validate_m4.py
/app/backend/scripts/seed_m4_catalogs.py

/app/frontend/src/components/notifications/NotificationBell.jsx
/app/frontend/src/components/notifications/NotificationDrawer.jsx
/app/frontend/src/components/notifications/NotificationItem.jsx
/app/frontend/src/components/notifications/NotificationFilters.jsx
/app/frontend/src/components/notifications/useNotifications.js
/app/frontend/src/components/notifications/notificationsApi.js

/app/memory/M4_IMPLEMENTATION_REPORT.md              (a fine implementazione)
/app/memory/M4_KICKOFF_REPORT.md                     (post-validazione schema)
```

### 9.2 Modificati (7 file)

```
/app/backend/server.py                               (mount router notifications + start scheduler)
/app/backend/services/studio_activation.py           (cabling hook 'tenant_activated' + 'advisor_assigned')
/app/backend/services/studio_v2_submit.py            (hook 'studio_request_received')
/app/backend/services/relationship_activities.py     (hook 'new_activity' + 'new_contact' via contact CRUD)
/app/backend/services/admin_crm.py                   (hook 'new_contact' su contact create)
/app/backend/services/auth.py                        (hook 'workspace_first_access' su magic-link first consume)
/app/frontend/src/admin/shared/WorkspaceShell.jsx    (mount <NotificationBell /> in topbar)
```

---

## 10 · Effort & sequencing

| Fase | Task                                                            | Stima       |
| ---- | --------------------------------------------------------------- | ----------- |
| 1    | Migration 035 + seed + validator schema                         | 0.5 giorno  |
| 2    | `services/notifications.py` (notify + recipient + preferences)  | 1 giorno    |
| 3    | `routers/notifications.py` (7 endpoint + RBAC + tests curl)     | 0.75 giorno |
| 4    | Hook in 5 file servizi esistenti                                | 0.75 giorno |
| 5    | Cron `followup_overdue` + APScheduler bootstrap                 | 0.5 giorno  |
| 6    | Frontend componenti + hook polling + integrazione shell         | 1.5 giorni  |
| 7    | `validate_m4.py` (47+ check) + run + fix                        | 0.5 giorno  |
| 8    | Testing agent end-to-end                                        | 0.25 giorno |
| 9    | Documentazione & finalizzazione                                 | 0.25 giorno |
| **Totale** |                                                           | **~6 giorni**|

---

## 11 · Acceptance criteria (Definition of Done)

- [ ] 035 migration applicata · rollback testato dry-run
- [ ] Catalog popolato con 7 tipi di notifica
- [ ] `services/notifications.py` esposto + 100% coverage delle 7 categorie
- [ ] 5 hook nei servizi esistenti scrivono in `relationship_notifications` (zero hardcoded label)
- [ ] Cron follow-up overdue funzionante (testato con activity scaduta artificiale)
- [ ] 7 endpoint REST documentati e testati via curl con token admin
- [ ] Frontend: bell sempre presente in topbar shell, badge unread aggiornato, drawer apre/chiude, mark-read/all-read funzionante, deep link navigano correttamente
- [ ] Polling 30s attivo · stop quando finestra inattiva
- [ ] RBAC: utente A non vede notifiche utente B (test esplicito)
- [ ] Preferences opt-out filtra (test esplicito)
- [ ] Zero impatto su API esistenti M0-M3 (regression suite verde)
- [ ] `validate_m4.py` ≥ 47/47 PASS
- [ ] Testing agent v3 fork: smoke FE + RBAC + happy path = green
- [ ] **Tutti i testi UI in italiano** · **tutte le label dei tipi dal catalogo DB**

---

## 12 · Risk register

| Rischio                                                | Mitigazione                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| Hook scatena INSERT che blocca la transazione padre    | Hook in `notify()` async fire-and-forget · errori loggati ma non rollbackano |
| Polling pesante con molti utenti                       | Endpoint `unread-count` indicizzato partial · cache lato BE 5s opzionale |
| Deep link a `/workspace/*` (M5 non ancora pronto)      | Fallback a `/command-center/tenants/{tid}` finché M5 non esiste          |
| Cron duplica notifiche su retry                        | `dedup_key` con UNIQUE constraint a livello DB                           |
| Catalog `narrative_template` con placeholder mancante  | `notify()` valida payload prima di insert (raise → 500 visibile)         |
| Preferences mancanti per nuovo type                    | Default *enabled* se assente da `relationship_notification_preferences`  |
| Tenant deletion cascading                              | `ON DELETE CASCADE` su `tenant_id` già in posto                          |

---

## 13 · Non-Goals (rispetto rigoroso direttiva utente)

- ❌ **NO** email digest (Resend resta solo per magic-link/onboarding)
- ❌ **NO** push notification / PWA
- ❌ **NO** mobile app native
- ❌ **NO** WebSocket realtime (solo polling 30s; design ready ma non implementato)
- ❌ **NO** M5 Advisor Workspace
- ❌ **NO** Relationship Center redesign M6
- ❌ **NO** voice notes M3.1
- ❌ **NO** email activities M3.2
- ❌ **NO** pagina dedicata `/notifications` (solo drawer globale)

---

## 14 · Documenti collegati

- `/app/memory/RELATIONSHIP_OS_ARCHITECTURE_DELIVERABLE.md` (architettura macro, già approvata)
- `/app/memory/PRD.md` (stato Relationship OS M0-M3 ✅)
- Migration 031 `relationship_os_foundation.sql` (tabella `relationship_notifications` già esistente)
- Mockup interattivo: `/_mood_mockup.html?notif=1`

---

**Classificazione**: `READY_FOR_M4_IMPLEMENTATION`

**Aspetto la tua approvazione esplicita su questo execution plan prima di scrivere una singola riga di codice.**
