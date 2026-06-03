# M3 — ACTIVITY LOG ADVANCED™ — FINAL EXECUTION PLAN

> Versione finale che recepisce le decisioni utente D1-D7 del 2 Giu 2026.
> Sostituisce `M3_ACTIVITY_LOG_ADVANCED_EXECUTION_PLAN.md`.
> **STOP — Solo piano. Nessuna implementazione, migration o deploy.**

**Classificazione finale**: 🟢 **`READY_FOR_M3_IMPLEMENTATION`**

> Tutte le 7 decisioni utente sono integrate. Il piano è eseguibile
> end-to-end senza precondizioni mancanti. Effort ricalibrato: **4.7g**
> (+0.3g vs piano iniziale per i 2 nuovi catalog D2/D3).

---

## 0 · PRINCIPIO GUIDA — Relationship Memory Layer™

M3 è la **memoria operativa della relazione**. Ogni attività deve poter rispondere a 5 domande, per sempre:

| Domanda | Campo schema (post-M3) |
|---|---|
| **Cosa è successo?** | `activity_type_code` (catalog) · `subject` · `notes` |
| **Con chi?** | `contact_id` → `tenant_contacts` |
| **Con quale esito?** | `activity_outcome_code` (catalog, D3) · `outcome` (testo) |
| **Chi era responsabile?** | `owner_user_id` (relationship owner) · `created_by` (chi ha registrato) |
| **Cosa dobbiamo fare dopo?** | `next_step` (testo libero, D4) · `next_step_due_at` (scadenza) · `completed_at` |

**Vincoli irrevocabili** (D5/D6):
- Le attività **non spariscono mai** (D1): archiviazione sì, eliminazione fisica solo da admin
- Una sola timeline (D6): le attività M3 alimentano automaticamente la view M2
- Performance hardening (D7) → task M1.1 separato

---

## 1 · SCHEMA (Migration 034)

### 1.1 Stato attuale `relationship_activities` (post-M2)

Già presenti (17 colonne) — non ricreare:
`id, tenant_id, studio_relation_id, contact_id, owner_user_id, activity_type_code, occurred_at, duration_min, subject, outcome, next_step, next_step_due_at, reminder_sent_at, payload, archived_at, created_at, updated_at`

### 1.2 Delta M3 — Migration `034_activity_log_advanced.sql`

```sql
BEGIN;

-- ─── 1. Memory layer (used) ──────────────────────────────────────
ALTER TABLE relationship_activities
    ADD COLUMN IF NOT EXISTS notes                 TEXT,
    ADD COLUMN IF NOT EXISTS completed_at          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_by            UUID,
    -- ─── 2. Future-ready foundation (no logic in M3) ─────────────
    ADD COLUMN IF NOT EXISTS importance            SMALLINT,
    ADD COLUMN IF NOT EXISTS sentiment             SMALLINT,
    -- ─── 3. D2 (catalog-driven source) ────────────────────────────
    ADD COLUMN IF NOT EXISTS source_code           TEXT,
    -- ─── 4. D3 (catalog-driven outcome) ───────────────────────────
    ADD COLUMN IF NOT EXISTS activity_outcome_code TEXT;

-- ─── 5. Catalog tables (NEW) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_activity_sources (
    code        TEXT PRIMARY KEY,
    label_it    TEXT NOT NULL,
    label_en    TEXT NOT NULL,
    icon        TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 100,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_activity_outcomes (
    code        TEXT PRIMARY KEY,
    label_it    TEXT NOT NULL,
    label_en    TEXT NOT NULL,
    icon        TEXT,
    color       TEXT,
    is_terminal BOOLEAN NOT NULL DEFAULT FALSE,   -- foundation only (no logic M3)
    sort_order  INTEGER NOT NULL DEFAULT 100,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 6. Soft FKs (data-only, ON DELETE SET NULL) ─────────────────
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name='relationship_activities_created_by_fkey') THEN
        ALTER TABLE relationship_activities
          ADD CONSTRAINT relationship_activities_created_by_fkey
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name='relationship_activities_source_code_fkey') THEN
        ALTER TABLE relationship_activities
          ADD CONSTRAINT relationship_activities_source_code_fkey
          FOREIGN KEY (source_code) REFERENCES platform_activity_sources(code) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name='relationship_activities_outcome_code_fkey') THEN
        ALTER TABLE relationship_activities
          ADD CONSTRAINT relationship_activities_outcome_code_fkey
          FOREIGN KEY (activity_outcome_code) REFERENCES platform_activity_outcomes(code) ON DELETE SET NULL;
    END IF;
END $$;

-- ─── 7. Operational indexes ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activities_next_step_due
    ON relationship_activities (tenant_id, next_step_due_at)
    WHERE next_step_due_at IS NOT NULL AND completed_at IS NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_activities_owner_open
    ON relationship_activities (owner_user_id, next_step_due_at)
    WHERE next_step_due_at IS NOT NULL AND completed_at IS NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_activities_outcome
    ON relationship_activities (tenant_id, activity_outcome_code)
    WHERE activity_outcome_code IS NOT NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_activities_source
    ON relationship_activities (tenant_id, source_code)
    WHERE source_code IS NOT NULL AND archived_at IS NULL;

-- ─── 8. Search-ready FTS (D5: search on outcome/next_step/subject/notes) ─
CREATE INDEX IF NOT EXISTS idx_activities_search_fts
    ON relationship_activities
       USING gin (to_tsvector('simple',
                              coalesce(subject,'')   || ' ' ||
                              coalesce(outcome,'')   || ' ' ||
                              coalesce(next_step,'') || ' ' ||
                              coalesce(notes,'')));

COMMIT;
```

Rollback simmetrico in `034_activity_log_advanced.rollback.sql`. Tutto idempotente, tutto reversibile, 0 dati persi (colonne NULL).

### 1.3 Schema finale logico (25 colonne)

```
relationship_activities
├── 🔑 id                       uuid PK
├── 📦 tenant_id                uuid NOT NULL FK
├── 📦 studio_relation_id       uuid NULL FK
│
├── ─── CHI ─────────────────────────────────────────────
├── 👤 contact_id               uuid NULL FK             ← con chi
├── 👤 owner_user_id            uuid NOT NULL FK         ← responsabile
├── 👤 created_by               uuid NULL FK             ← chi ha registrato (M3 NEW)
│
├── ─── COSA ────────────────────────────────────────────
├── 🏷  activity_type_code       text NOT NULL FK         ← catalog (call/meeting/...)
├── 🏷  source_code              text NULL FK             ← D2 NEW · catalog
├── 📝 subject                  text                     ← titolo
├── 📝 notes                    text                     ← M3 NEW · esteso
│
├── ─── ESITO ───────────────────────────────────────────
├── 🏷  activity_outcome_code    text NULL FK             ← D3 NEW · catalog
├── 📝 outcome                  text                     ← testo libero
│
├── ─── DOPO ────────────────────────────────────────────
├── 📝 next_step                text                     ← D4 LIBERO (no catalog)
├── 📅 next_step_due_at         timestamptz
├── 📅 completed_at             timestamptz              ← M3 NEW
│
├── ─── METRICHE ────────────────────────────────────────
├── ⏱  duration_min             int
├── 📅 occurred_at              timestamptz NOT NULL
├── ⭐ importance               smallint NULL            ← M3 NEW (foundation)
├── 💭 sentiment                smallint NULL            ← M3 NEW (foundation)
│
├── ─── META ────────────────────────────────────────────
├── 🗃 payload                  jsonb DEFAULT '{}'
├── 🗑 archived_at              timestamptz
├── 📅 reminder_sent_at         timestamptz
├── 📅 created_at               timestamptz
└── 📅 updated_at               timestamptz
```

**D5 cross-check** (le 5 domande):

| Domanda | Coperta da | Catalog? |
|---|---|:--:|
| Cosa è successo? | `activity_type_code` + `subject` + `notes` | ✅ |
| Con chi? | `contact_id` | ✅ |
| Con quale esito? | `activity_outcome_code` + `outcome` | ✅ (D3) |
| Chi responsabile? | `owner_user_id` + `created_by` | n/a |
| Cosa dopo? | `next_step` + `next_step_due_at` + `completed_at` | ❌ (D4: libero) |

🟢 Tutte le 5 dimensioni del Memory Layer sono indirizzate.

---

## 2 · CATALOGHI

### 2.1 `platform_activity_types` (esistente · invariato)

Tutti gli 8 tipi richiesti già presenti con `score_delta`/`touch`/`visibility`/`notifiable`. M3 **rimuove `_M1_QUICK_TYPES` hardcode** dal servizio.

### 2.2 `platform_activity_sources` (NEW · D2)

Seed iniziale (10 valori, idempotente UPSERT):

| code | label_it | label_en | icon | sort |
|---|---|---|---|---:|
| `manual`    | Manuale | Manual | edit            | 10 |
| `founder`   | Founder | Founder | user-circle    | 20 |
| `advisor`   | Advisor | Advisor | briefcase      | 30 |
| `admin`     | Admin   | Admin   | shield         | 40 |
| `email`     | Email   | Email   | mail           | 50 |
| `whatsapp`  | WhatsApp | WhatsApp | message-circle | 60 |
| `linkedin`  | LinkedIn | LinkedIn | linkedin     | 70 |
| `import`    | Import  | Import  | upload         | 80 |
| `api`       | API     | API     | code           | 90 |
| `system`    | Sistema | System  | cog            | 100 |

Endpoint `GET /api/catalogs/activity-sources` (admin-protected come gli altri).

### 2.3 `platform_activity_outcomes` (NEW · D3)

Seed iniziale (6 valori, idempotente UPSERT):

| code | label_it | label_en | color | is_terminal |
|---|---|---|---|:--:|
| `completed`            | Completato       | Completed       | `#10b981` | ✅ |
| `pending`              | In sospeso       | Pending         | `#eab308` | ❌ |
| `no_response`          | Nessuna risposta | No response     | `#94a3b8` | ❌ |
| `interested`           | Interessato      | Interested      | `#3b82f6` | ❌ |
| `not_interested`       | Non interessato  | Not interested  | `#ef4444` | ✅ |
| `follow_up_required`   | Richiede follow-up | Follow-up required | `#f97316` | ❌ |

`is_terminal` è **foundation only** (D3): non viene letto da nessun consumer M3. Servirà a M4 (notification routing) e M5 (advisor intelligence). Documentato qui per memoria architetturale.

Endpoint `GET /api/catalogs/activity-outcomes`.

### 2.4 Decisione esplicita su `quick_action_m1` (recupero da §2 originale)

Il flag `platform_activity_types.quick_action_m1` viene retrocesso da **filtro hard-coded backend** → **hint UI client-side**. La rimozione di `_M1_QUICK_TYPES` rende il catalog la **sola fonte di verità**.

---

## 3 · API SURFACE

### 3.1 Admin endpoints (8 nuovi/estesi)

| Verb | Path | Note M3 |
|---|---|---|
| `GET`    | `/api/admin/tenants/{tid}/activities` | esteso: filtri completi + cursor + outcome/source |
| `POST`   | `/api/admin/tenants/{tid}/activities` | **NEW** · full form (riceve outcome_code, source_code) |
| `GET`    | `/api/admin/tenants/{tid}/activities/{aid}` | **NEW** |
| `PATCH`  | `/api/admin/tenants/{tid}/activities/{aid}` | **NEW** · update parziale |
| `DELETE` | `/api/admin/tenants/{tid}/activities/{aid}` | **NEW** · archive (soft, mai hard-delete) |
| `POST`   | `/api/admin/tenants/{tid}/activities/{aid}/complete` | **NEW** · `completed_at = NOW()` + opzionale `activity_outcome_code` |
| `POST`   | `/api/admin/tenants/{tid}/activities/{aid}/reopen` | **NEW** |
| `GET`    | `/api/admin/tenants/{tid}/activities/open-followups` | **NEW** · `due_at NOT NULL AND completed_at IS NULL` |
| `GET`    | `/api/admin/tenants/{tid}/activities/search?q=` | **NEW** · FTS |
| `POST`   | `/api/admin/tenants/{tid}/activities/quick` | **DEPRECATED ALIAS** (backward compat) |

### 3.2 Founder mirror endpoints (D1 recepita)

| Verb | Path | Permesso? | Note D1 |
|---|---|:--:|---|
| `GET`    | `/api/blueprint/activities` | ✅ | full read del proprio tenant |
| `POST`   | `/api/blueprint/activities` | ✅ | `owner_user_id` + `created_by` forzati a self |
| `GET`    | `/api/blueprint/activities/{aid}` | ✅ | own tenant |
| `PATCH`  | `/api/blueprint/activities/{aid}` | ✅ con strip | strip 5 campi (vedi §5.3) |
| `POST`   | `/api/blueprint/activities/{aid}/complete` | ✅ | qualunque attività del proprio tenant |
| `POST`   | `/api/blueprint/activities/{aid}/reopen` | ✅ | idem |
| `DELETE` | `/api/blueprint/activities/{aid}` | ⚠️ **CONDIZIONATO** (D1) | vedi §5.4 |
| `GET`    | `/api/blueprint/activities/open-followups` | ✅ | own tenant |
| `GET`    | `/api/blueprint/activities/search?q=` | ✅ | FTS own tenant |

### 3.3 Catalog endpoints (D2 + D3)

| Verb | Path | Scope |
|---|---|---|
| `GET` | `/api/catalogs/activity-sources` | admin/founder |
| `GET` | `/api/catalogs/activity-outcomes` | admin/founder |

### 3.4 Schema request — `POST /activities`

```jsonc
{
  "contact_id":              "uuid?",
  "activity_type_code":      "meeting",
  "subject":                 "Demo Master Deck",
  "notes":                   "Architetto interessato a sezione lighting…",
  "outcome":                 "Studio richiede follow-up",
  "activity_outcome_code":   "follow_up_required",       // D3
  "next_step":               "Inviare PDF tariffario v2",
  "next_step_due_at":        "2026-06-09T14:00:00Z",
  "duration_min":            45,
  "occurred_at":             "2026-06-02T10:30:00Z",
  "owner_user_id":           "uuid?",                    // admin can set; founder cannot
  "source_code":             "advisor",                   // D2
  "importance":              4,                          // foundation
  "sentiment":               1                           // foundation
}
```

### 3.5 Schema response

Aggiunge sopra il M1: `notes`, `completed_at`, `created_by`, `created_by_display`, `importance`, `sentiment`, `source_code`, `source_display`, `activity_outcome_code`, `outcome_display`, `outcome_color`.

### 3.6 Filtri lista (admin & founder)

| Param | Effetto | Scope |
|---|---|:--:|
| `contact_id` | per contatto | all |
| `activity_type_code` (CSV) | per tipo | all |
| `activity_outcome_code` (CSV) | per esito (D3) | all |
| `source_code` (CSV) | per provenienza (D2) | all |
| `owner_user_id` | per owner | admin |
| `created_by` | chi ha registrato | admin |
| `status` | `open` / `completed` / `archived` / `all` | all |
| `since` / `until` | range `occurred_at` | all |
| `due_since` / `due_until` | range `next_step_due_at` | all |
| `q` | FTS | all |
| `cursor` / `limit` | base64 `(occurred_at, id)` · default 30 max 100 | all |

---

## 4 · UX

### 4.1 Admin · `TenantDetail.jsx` tab "Attività"

Layout operativo (sostituisce la lista preview M1):

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [Tipo▾] [Esito▾] [Fonte▾] [Stato▾] [Owner▾] [Periodo▾] [Cerca…]  + Nuova │
├──────────────────────────────────────────────────────────────────────────┤
│  ▣  Pending follow-up · 3                                                 │
│  ├─ 09/06 14:00 · Demo Master Deck    ·●follow_up_required · Giulia · [✓] │
│  └─ 11/06 09:30 · Sopralluogo showroom·●pending             · Mario  · [✓] │
│                                                                            │
│  ◯  Storico recente · 24                                                  │
│  ├─ 02/06 22:48 · Internal note · onboarding · ●completed · MOOD Admin     │
│  └─ 02/06 22:48 · LinkedIn · Connect         · ●completed · MOOD Admin     │
│                                                                            │
│  [ Carica altre ]                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

Outcome chips colorate dal catalog `color` (D3).

### 4.2 Componente `<ActivityDrawer>` (NEW)

Stesso pattern di `ContactDrawer`. Sezioni:

```
HEADER       · Tipo (catalog) ▾    Owner picker ▾
BODY
  Contatto      · autocomplete da tenant_contacts
  Subject       · input
  Notes         · textarea 5 righe (memory layer)
  Outcome       · textarea 3 righe + outcome_code chip picker (D3)
  Next step     · input libero (D4 confermata)
  Due date      · datetime picker
  Duration      · number (default da catalog default_duration_min)
  Occurred at   · datetime, default NOW()
  ─── Advanced ▾ (collapsible)
    Source     · select da platform_activity_sources (D2)
    Importance · 1..5 stars
    Sentiment  · -2..+2 emoji
FOOTER       · [Annulla]  [Salva e completa]  [Salva]
```

Tutti `data-testid="activity-drawer-{field}"`.

### 4.3 `<ActivityRow>` riusabile

Una sola riga per Timeline (M2) + Activity tab (M3) + Open Follow-up section.

### 4.4 Founder mirror (BlueprintOverview)

Stessa UI con props ridotte:
- Owner picker disabilitato (locked a founder)
- Created_by hidden
- Bottone DELETE visibile **solo** se `activity.created_by == self_user_id` (D1)
- Filtri `owner_user_id`/`created_by` rimossi

### 4.5 i18n & empty states

- Locale `it-IT` primary, `en-US` fallback
- Empty: "Nessuna attività ancora registrata. Inizia con una chiamata, un meeting o una nota."
- Loading skeleton 4 righe
- Error con retry button

---

## 5 · PERMISSIONS

### 5.1 Matrice ruoli × azioni (D1 recepita)

| Azione | Admin | Advisor (scope) | Founder |
|---|:--:|:--:|:--:|
| `GET` lista/single | ✅ | ✅ | ✅ (own tenant) |
| `POST` create | ✅ | ✅ | ✅ (owner=self) |
| `PATCH` update | ✅ | ✅ | ✅ con strip |
| `complete` / `reopen` | ✅ | ✅ | ✅ |
| `DELETE` (archive) | ✅ | ✅ | ⚠️ **solo se `created_by == self_user_id` (D1)** |
| Cambio `owner_user_id` | ✅ | ✅ | ❌ (PATCH strip) |
| Cambio `created_by` | ❌ (audit-immutable) | ❌ | ❌ (PATCH strip) |
| Cambio `tenant_id` | ❌ | ❌ | ❌ (PATCH strip) |
| Cambio `archived_at` esplicito | ❌ | ❌ | ❌ (PATCH strip) |
| Cambio `created_at` esplicito | ❌ | ❌ | ❌ (PATCH strip) |

### 5.2 Tenant isolation (invariata M1/M2)

- Admin/Advisor: `_advisor_scope` valida `tenant_id` nello scope
- Founder: `require_admin_tenant` forza il tenant dal JWT
- Cross-tenant → 403/404 dai router

### 5.3 PATCH founder strip (5 campi)

```python
# routers/blueprint_activities.py
async def update_my_activity(aid, body, tenant=Depends(require_admin_tenant)):
    body.pop("owner_user_id", None)   # cannot escalate (D1)
    body.pop("created_by", None)      # immutable audit (D1)
    body.pop("tenant_id", None)       # forced from JWT
    body.pop("archived_at", None)     # only via DELETE endpoint
    body.pop("created_at", None)      # immutable
    return await svc.update_activity(aid, body, actor=tenant['user_id'])
```

### 5.4 DELETE founder gating (D1 — NEW LOGIC)

Server-side enforcement:

```python
# routers/blueprint_activities.py
async def delete_my_activity(aid, tenant=Depends(require_admin_tenant)):
    activity = await svc.get_activity(aid, tenant_id=tenant['id'])
    if activity['created_by'] != tenant['user_id']:
        raise HTTPException(status_code=403, detail={
            "code": "delete_not_allowed",
            "message": "Solo l'autore dell'attività può archiviarla. "
                       "Le attività di altri membri del team restano per audit trail.",
            "created_by_display": activity.get('created_by_display'),
        })
    return await svc.archive_activity(aid, actor=tenant['user_id'])
```

UI: bottone DELETE in `<ActivityDrawer>` mostrato condizionato a `activity.created_by === self.user_id`. Per le altre, mostra un tooltip "Solo l'autore può archiviare".

### 5.5 Hard-delete = MAI

Anche per admin, l'endpoint `DELETE` esegue solo `archived_at = NOW()` (soft delete). Una `DELETE` fisica richiederà uno script di housekeeping ad-hoc fuori scope CRM. Audit trail preservato indefinitamente.

---

## 6 · TIMELINE INTEGRATION (D6)

**Confermato**: nessuna seconda timeline. M3 **non modifica** `v_relationship_timeline` (M0).

### 6.1 Comportamento automatico

`v_relationship_timeline` legge `relationship_activities` con `source='activity'`. Qualunque nuova riga (via M3 `create_activity`) emerge nella timeline M2 senza modifiche.

### 6.2 Estensione metadata (zero impact su Timeline)

I 6 campi nuovi (`notes`, `completed_at`, `created_by`, `importance`, `sentiment`, `source_code`, `activity_outcome_code`) **non** vengono esposti in `v_relationship_timeline` per evitare bloat. Restano accessibili via `GET /activities/{aid}` quando l'utente clicca su una riga della timeline.

### 6.3 Regression test obbligatori

In `validate_m3.py`:
- T1: POST `meeting` → riga in `GET /admin/.../timeline` (entro 1s)
- T2: PATCH `activity_type_code` → la stessa riga aggiorna `type_code` in timeline
- T3: `complete_activity` → no nuova riga in timeline (è solo update di stato)
- T4: `archive_activity` → la riga **resta** in timeline (storia) ma marcata? *(default M3: resta com'è, non viene filtrata)*
- T5: Filter Timeline `manual_only=1` continua a mostrare solo `source='activity'`

---

## 7 · RELATIONSHIP HEALTH HOOKS

### 7.1 Modello (invariato da M2)

`relationship_health.apply_signal(source='activity', type_code=…)` chiamato dentro la stessa transazione del writer.

### 7.2 Regole hook M3

| Operazione | Health signal |
|---|---|
| `create_activity(code)` | `apply_signal(type_code=code)` (delta dal catalog) |
| `update_activity(code_old → code_new)` se diversi | revert `code_old`, apply `code_new` (atomico) |
| `update_activity` su altri campi | nessun signal |
| `archive_activity` | **nessun signal** (la riga resta, è solo soft-delete) |
| `complete_activity` | **nessun signal** (solo cambio stato di un follow-up) |
| `reopen_activity` | **nessun signal** |

### 7.3 Vincoli confermati

- ❌ Nessuna formula AI / ML
- ❌ Nessun dashboard / KPI / band / decay
- ❌ Nessuna esposizione client di `relationship_score` / `last_touch_at`
- ✅ Solo `score_delta` + `touch` dal catalog (M2)
- ✅ `source_code` (D2) e `activity_outcome_code` (D3) **non** modificano lo score in M3

### 7.4 Test (in `validate_m3.py`)

- H1: Create `meeting` → tenant_score +8
- H2: PATCH type da `meeting` → `visit` → delta +2 netto (8→10)
- H3: PATCH type da `visit` → `internal_note` → delta -10 (10→0)
- H4: Archive → no change
- H5: Complete → no change
- H6: tenant_score mai negativo (floor 0)

---

## 8 · FOUNDER MIRROR (D1)

### 8.1 Capabilities founder (recepito D1)

✅ **Permesso**:
- Vedere tutte le proprie attività (proprie + di advisor/admin sul proprio tenant)
- Creare nuove attività (`owner_user_id` e `created_by` forzati a sé)
- Modificare proprie attività (con strip)
- Completare / riaprire qualunque attività del proprio tenant
- Archiviare **solo** attività `created_by == self`

❌ **Vietato**:
- Eliminare/archiviare attività create da Admin/Advisor/altri team member
- Vedere attività di altri tenant
- Cambiare owner_user_id (PATCH strip)
- Cambiare created_by (immutable audit)
- Vedere attività con `visibility='admin_only'` *(scope future — M3 default: tutte visible)*

### 8.2 Test sicurezza founder (in `validate_m3.py`)

- F1: Founder POST → `owner_user_id` = founder, `created_by` = founder
- F2: Founder PATCH `owner_user_id` → 200 ma campo immutato (strip)
- F3: Founder PATCH `created_by` → 200 ma campo immutato (strip)
- F4: Founder DELETE su attività con `created_by == self` → 200
- F5: Founder DELETE su attività con `created_by ≠ self` → **403** con messaggio chiaro (D1)
- F6: Founder GET cross-tenant → 404
- F7: Founder POST sostituendo `tenant_id` nel body → ignorato (strip)
- F8: Founder può completare attività create da admin → 200 (D1)

---

## 9 · ACCEPTANCE CRITERIA

### 9.1 Funzionali — 14 check (F1-F14)

| # | Criterio |
|---|---|
| F1 | `POST /activities` con type `meeting` ritorna 200 (M1 rifiutava) |
| F2 | Response include 7 nuovi campi: `notes`, `completed_at`, `created_by`, `importance`, `sentiment`, `source_code`, `activity_outcome_code` |
| F3 | Activity con `next_step_due_at` appare in `/open-followups` |
| F4 | `/complete` setta `completed_at = NOW()` e rimuove da open-followups |
| F5 | `/reopen` annulla `completed_at` |
| F6 | Filtri (`status`, `since`, `until`, `due_since`, `due_until`, `q`, `outcome_code`, `source_code`) ritornano subset corretto |
| F7 | FTS `?q=onboarding` matcha attività con keyword in notes/subject/outcome/next_step |
| F8 | Activity appare in `v_relationship_timeline` (M2) — no duplicazione |
| F9 | Cambio type `meeting → visit` aggiusta delta health a +2 netti |
| F10 | Pagination cursor: no overlap tra pagine consecutive |
| F11 | Archiviazione non rimuove dalla timeline (storia preservata) |
| F12 | `activity_outcome_code = 'no_response'` viene persistito + ritornato |
| F13 | `source_code = 'advisor'` viene persistito + ritornato |
| F14 | DELETE è soft (archive) — la riga resta in DB con `archived_at IS NOT NULL` |

### 9.2 Sicurezza — 18 check (S1-S18, espansa per D1+D2+D3)

| # | Criterio |
|---|---|
| S1 | Anon → `/admin/.../activities` = 401 |
| S2 | Founder → `/admin/.../activities` altro tenant = 403/404 |
| S3 | Founder POST: `owner_user_id` ignorato (forzato a self) |
| S4 | Founder POST: `created_by` ignorato (forzato a self) |
| S5 | Founder PATCH: `owner_user_id` change stripped |
| S6 | Founder PATCH: `created_by` change stripped |
| S7 | Founder PATCH: `tenant_id` change stripped |
| S8 | Founder PATCH: `archived_at` change stripped |
| S9 | Founder PATCH: `created_at` change stripped |
| S10 | **D1**: Founder DELETE su attività `created_by != self` → 403 con messaggio |
| S11 | **D1**: Founder DELETE su attività `created_by == self` → 200 |
| S12 | **D1**: Founder può `complete` attività create da admin → 200 |
| S13 | Activity_type_code non in catalog → 422 |
| S14 | activity_outcome_code non in catalog → 422 (D3) |
| S15 | source_code non in catalog → 422 (D2) |
| S16 | Cursor manipolato cross-tenant → 0 risultati (FK safe) |
| S17 | `_M1_QUICK_TYPES` rimosso: `meeting`/`visit`/`task` accettati ovunque |
| S18 | `/quick` endpoint backward compat: 5 tipi storici ancora 200 |

**Totale**: 14 funzionali + 18 sicurezza = **32 check obbligatori**.

### 9.3 Regression (zero impatto)

| Suite | Atteso |
|---|---|
| `validate_m0.py` | 56/56 PASS |
| `m1_real_usage_validation.py` | 33/33 PASS |
| `validate_m1_security.py` | 16/16 PASS |
| `validate_m2_security.py` | 16/16 PASS |
| `validate_m3.py` (NEW) | **32/32 PASS** |
| **TOTAL** | **153/153 PASS · 0 FAIL** |

### 9.4 Screenshot obbligatori

1. Admin tab "Attività" con sezione "Pending follow-up" + storico
2. `<ActivityDrawer>` aperto con tutti i campi incluso "Advanced" expanded
3. Outcome chips colorate (almeno 3 outcomes diversi visibili in lista)
4. Founder tab "Attività" con bottone DELETE disabilitato su attività di admin (tooltip D1)
5. Timeline M2 che mostra una nuova `meeting` registrata via M3 (regression D6)

### 9.5 Performance budget (D7: NO hardening)

- Resta baseline M2 (~1.8s p95)
- M3 non introduce regressioni performance
- M1.1 Performance Hardening resta task separato

---

## 10 · EFFORT REALE

Ricalibrato post-D1/D2/D3:

| Componente | Effort | Note |
|---|---:|---|
| Migration 034 + rollback | 0.3g | +2 catalog tables (D2, D3) |
| Seed `seed_m3_catalogs.py` | 0.2g | activity_sources (10) + activity_outcomes (6) idempotenti |
| Service `relationship_activities.py` espansione | 0.7g | 7 entry-point + retire `_M1_QUICK_TYPES` + D1 gating + outcome/source handling |
| Router `admin_activities.py` (nuovo, separato) | 0.4g | 8 endpoint |
| Router `blueprint_activities.py` espansione + D1 | 0.4g | 9 endpoint + DELETE gating + 5-field strip |
| Catalog endpoints (D2+D3) in `catalogs.py` | 0.1g | +2 route |
| FTS service helper | 0.2g | wrapper su to_tsvector + plainto_tsquery |
| Frontend `<ActivityDrawer>` | 0.7g | full form + advanced collapsible + autocomplete contatti |
| Frontend `<ActivityRow>` riusabile | 0.3g | refactor + outcome chip + DELETE conditional |
| Frontend tab Attività admin revamp | 0.4g | filter chips esteso + pending section |
| Frontend tab Attività founder mirror | 0.2g | D1 conditional DELETE |
| Frontend useCatalog hook per nuovi catalog | 0.1g | reuse pattern esistente |
| Validation script `validate_m3.py` | 0.6g | 32 check (14 func + 18 sec) |
| Smoke + regression + screenshot | 0.3g | 5 suite + 5 screenshot |
| Report `M3_IMPLEMENTATION_REPORT.md` | 0.2g | con diff + perf + screenshot |
| **TOTALE** | **5.1g** | (parallelo BE+FE ≈ 3.0g calendario) |

*(+0.7g rispetto al piano iniziale: +0.3g per catalog D2/D3, +0.2g per D1 gating + 5-field strip, +0.2g per check estesi.)*

### Rischi & mitigazioni

| Rischio | Sev | Mitigazione |
|---|:--:|---|
| Rimozione `_M1_QUICK_TYPES` rompe chiamate esistenti | 🟡 | Alias `/quick` mantenuto + S18 test compat |
| FTS Italiano richiede `unaccent` ext | 🟢 | `'simple'` dictionary sufficiente · accenti gestiti client-side se necessario |
| Cambio `activity_type_code` in PATCH duplica health signal | 🔴 P0 | Atomico: revert vecchio + apply nuovo · test F9 |
| Founder strip incompleto → privilege escalation | 🔴 P0 | 5 campi strip esplicitati + test S3-S9 |
| Founder DELETE su altrui (D1) | 🔴 P0 | Server-side check `created_by == self` · test S10/S11 |
| Outcome/source non in catalog → 500 invece di 422 | 🟡 | FK validation precoce + test S14/S15 |
| Index GIN aumenta cost INSERT | 🟢 | Volume <100/giorno · degradation <10ms · accettabile |
| `is_terminal` su outcome usato per logica nascosta | 🟢 | Foundation only · audit codice esplicito · nessun consumer M3 |

---

## 11 · DIPENDENZE & CONFINI

### Disponibili (no precondizioni)
- ✅ M0 schema + view `v_relationship_timeline`
- ✅ M1 contact CRM
- ✅ M1.0.1 language normalization (pattern riutilizzabile per outcome/source validation)
- ✅ M2 health hooks (`apply_signal`)
- ✅ M2 timeline endpoints + UI
- ✅ Catalog `platform_activity_types` con flag M2

### FUORI SCOPE M3 (esplicito)
- ❌ M2.1 Cosmetic Fix (header "Untitled studio")
- ❌ M1.1 Performance Hardening (D7)
- ❌ M4 Notification Center (delivery sui `notifiable`)
- ❌ M5 Advisor Workspace + KPI
- ❌ Sentiment AI / NLP su `notes`
- ❌ Importance auto-derivation
- ❌ Outcome auto-derivation
- ❌ Sync con calendar esterni
- ❌ Voice-to-text per `notes`
- ❌ Attachment upload (file/photo)
- ❌ Reminder delivery automatico via email/notification
- ❌ Hard-delete fisico (solo soft-archive)
- ❌ `is_terminal` su outcome consumato da qualunque logica

---

## 12 · DECISIONI UTENTE RECEPITE (D1-D7)

| Decisione | Recepimento nel piano |
|---|---|
| **D1** Founder DELETE solo su `created_by == self` | §5.4 + §8 + S10/S11/S12 + UI conditional |
| **D2** `source` → catalog `platform_activity_sources` | §2.2 + Migration FK + endpoint catalog + Drawer advanced + S15 |
| **D3** Outcome → catalog `platform_activity_outcomes` | §2.3 + Migration FK + endpoint catalog + outcome chips + S14 + F12 |
| **D4** `next_step` campo libero | §1.3 + §4.2 (no chip picker) + nessuna FK |
| **D5** Schema risponde alle 5 domande | §1.3 cross-check matrix |
| **D6** Una sola timeline | §6 (zero modifiche a view M2) + T1-T5 |
| **D7** Performance fuori scope | §9.5 + §11 confine esplicito |

---

## 13 · COSA SERVE DALL'UTENTE PER PARTIRE

a) Conferma di procedere con M3 secondo il dimensionamento aggiornato (5.1g)
b) Conferma del namespace data-testid `activity-*` (per testing agent compat)
c) Eventuali ultime variazioni di scope sui 6 future-ready foundation fields
   (`importance`, `sentiment`, `is_terminal` su outcomes, `payload jsonb`,
   `default_duration_min` come hint UI, `quick_action_m1` come hint UI)

---

## 14 · CLASSIFICAZIONE FINALE

🟢 **`READY_FOR_M3_IMPLEMENTATION`**

Tutte le 7 decisioni utente (D1-D7) sono integrate e cross-validate. Schema progettato, API mappate, hook health già operativi (M2), timeline non richiede modifiche, founder mirror irrobustito con D1 gating, security copertura 18/18 + funzionali 14/14, performance budget invariato. Effort honest 5.1g.

L'unico gate residuo è il **"VAI"** dell'utente.

---

*Generato 2026-06-02 da E1 (Emergent).*
*Stato: ATTESA DI APPROVAZIONE PER L'ESECUZIONE M3.*
*Nessuna migration eseguita. Nessuna feature implementata.*
*Sostituisce: `M3_ACTIVITY_LOG_ADVANCED_EXECUTION_PLAN.md` (v0).*
*Reference: `M2_IMPLEMENTATION_REPORT.md`, `M1_REAL_USAGE_VALIDATION_REPORT.md`,
`RELATIONSHIP_OS_FOUNDATION_PLAN.md`, `PRD.md`.*
