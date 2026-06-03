# M3 — ACTIVITY LOG ADVANCED™ — EXECUTION PLAN

> ⚠️ **SUPERATO da `M3_FINAL_EXECUTION_PLAN.md` (2026-06-02)**
>
> Questo documento è la **v0** del piano M3. Il piano definitivo
> recepisce le decisioni utente D1-D7 e si trova in
> `/app/memory/M3_FINAL_EXECUTION_PLAN.md`. Consultare quello.
>
> *Generato 2026-06-02 da E1 (Emergent) su autorizzazione utente.*
> **STOP — Solo piano. Nessuna implementazione, migration o deploy.**

**Classificazione finale**: 🟢 **`READY_FOR_M3_IMPLEMENTATION`**

> Il piano è eseguibile end-to-end senza precondizioni mancanti. La
> base dati M0/M1, gli hook health M2 e la timeline M2 forniscono
> tutto il sostrato richiesto. M3 estende `relationship_activities`
> e rimuove il vincolo `_M1_QUICK_TYPES`, senza toccare aree fuori
> scope (M4/M5/Analytics/AI).

---

## 0 · PRINCIPIO GUIDA — Relationship Memory Layer™

M3 non è "registro attività". M3 è **memoria operativa della relazione**: per ogni interazione, MOOD ricorda non solo *cosa è successo* ma *perché*, *con chi*, *con quale esito*, *cosa fare dopo* e *con quale impegno futuro*.

Promessa al founder e all'advisor:
- Una sola fonte di verità per ogni contatto con uno studio
- Continuità tra attività manuali e segnali automatici (M2)
- Promemoria operativi su `next_step` e `due_date`
- Reversibilità completa: ogni attività è patchable, archiviabile, ripristinabile

---

## 1 · SCHEMA (Migration 034)

### 1.1 Stato attuale `relationship_activities` (post-M2)

Già presenti — **non ricreare**:
- `id uuid PK · tenant_id · studio_relation_id · contact_id · owner_user_id`
- `activity_type_code FK → platform_activity_types(code)`
- `occurred_at · duration_min · subject · outcome · next_step · next_step_due_at`
- `payload jsonb NOT NULL DEFAULT '{}'`
- `archived_at · created_at · updated_at · reminder_sent_at`

### 1.2 Delta richiesti da M3

```sql
-- backend/db/migrations/034_activity_log_advanced.sql
BEGIN;

ALTER TABLE relationship_activities
    -- Memory layer fields (used)
    ADD COLUMN IF NOT EXISTS notes         TEXT,            -- testo libero esteso (>500 char ammessi)
    ADD COLUMN IF NOT EXISTS completed_at  TIMESTAMPTZ,     -- per attività con stato 'task' o follow-up
    ADD COLUMN IF NOT EXISTS created_by    UUID,            -- esplicito, ≠ owner_user_id (può divergere se admin scrive per advisor)
    -- Future-ready (foundation only, nessuna logica M3)
    ADD COLUMN IF NOT EXISTS importance    SMALLINT,        -- 1..5 free range, no constraint M3
    ADD COLUMN IF NOT EXISTS sentiment     SMALLINT,        -- -2..+2 free range, no constraint M3
    ADD COLUMN IF NOT EXISTS source        TEXT;            -- canale: 'crm', 'mobile', 'sync', 'import', ...

-- FK soft (no enforcement on legacy data): created_by → users.id quando popolato
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name='relationship_activities_created_by_fkey'
    ) THEN
        ALTER TABLE relationship_activities
          ADD CONSTRAINT relationship_activities_created_by_fkey
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Indici per query operative (next_step pending, completed lookup)
CREATE INDEX IF NOT EXISTS idx_activities_next_step_due
    ON relationship_activities (tenant_id, next_step_due_at)
    WHERE next_step_due_at IS NOT NULL AND completed_at IS NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_activities_owner_open
    ON relationship_activities (owner_user_id, next_step_due_at)
    WHERE next_step_due_at IS NOT NULL AND completed_at IS NULL AND archived_at IS NULL;

-- Search-ready GIN (FTS italiano + inglese) — sezione 9
CREATE INDEX IF NOT EXISTS idx_activities_search_fts
    ON relationship_activities
       USING gin (to_tsvector('simple',
                              coalesce(subject,'') || ' ' ||
                              coalesce(outcome,'') || ' ' ||
                              coalesce(next_step,'') || ' ' ||
                              coalesce(notes,'')));

COMMIT;
```

Rollback simmetrico: `034_activity_log_advanced.rollback.sql` (DROP CONSTRAINT + DROP COLUMN + DROP INDEX). 0 rischio dati: tutte le colonne nuove sono nullable.

### 1.3 Schema finale logico (rappresentazione)

```
relationship_activities
├── id                       uuid PK
├── tenant_id                uuid NOT NULL FK
├── contact_id               uuid NULL FK
├── owner_user_id            uuid NOT NULL FK         ← "responsible / relationship owner"
├── created_by               uuid NULL FK             ← chi ha registrato (M3 NEW)
├── activity_type_code       text NOT NULL FK         ← catalogo
├── subject                  text                     ← titolo breve
├── notes                    text                     ← M3 NEW · testo libero esteso
├── outcome                  text                     ← esito
├── next_step                text                     ← prossimo passo descritto
├── next_step_due_at         timestamptz              ← scadenza
├── completed_at             timestamptz              ← M3 NEW · quando completato
├── duration_min             int
├── occurred_at              timestamptz NOT NULL
├── importance               smallint NULL            ← M3 NEW · 1..5 (NO LOGIC)
├── sentiment                smallint NULL            ← M3 NEW · -2..+2 (NO LOGIC)
├── source                   text NULL                ← M3 NEW · canale provenienza
├── payload                  jsonb DEFAULT '{}'
├── archived_at              timestamptz
├── created_at / updated_at  timestamptz
```

---

## 2 · CATALOGHI

### 2.1 `platform_activity_types` (esistente, già driver health/timeline)

Tutti i tipi indicati dall'utente sono **già presenti** nel catalog M2:

| code | label_it | icon | quick_action_m1 | score_delta | touch | visibility |
|---|---|---|:--:|---:|:--:|:--:|
| `call` | Chiamata | phone | T | +5 | T | all |
| `meeting` | Meeting | users | F | +8 | T | all |
| `email` | Email | mail | T | +2 | T | all |
| `whatsapp` | WhatsApp | message-circle | T | +2 | T | all |
| `linkedin` | LinkedIn | linkedin | T | +1 | T | all |
| `visit` | Visita | map-pin | F | +10 | T | all |
| `internal_note` | Nota interna | file-text | T | 0 | F | all |
| `task` | Task | check-square | F | 0 | F | all |

### 2.2 M3 — Decisione esplicita su `quick_action_m1`

In **M1** il backend usa `_M1_QUICK_TYPES = {call, email, whatsapp, linkedin, internal_note}` come whitelist hardcoded → `meeting`, `visit`, `task` falliscono con 422 quando arrivano dall'API.

**M3 rimuove il hardcode**: l'unica fonte di verità diventa il catalogo (`enabled=TRUE`). I tipi `meeting`/`visit`/`task` saranno accettati end-to-end. La colonna `quick_action_m1` resta come **hint UI** (quale tipo mostrare nel mini-modale rapido vs. nel form esteso).

### 2.3 Nuovo catalog `platform_activity_sources` (opzionale, schema-only)

Solo se l'utente conferma. Default proposto: lasciare `source TEXT` libero (no FK) in M3, introdurre il catalog solo quando emergerà un consumer (es. mobile app future).

**Decisione di default**: NO nuovo catalog in M3. `source` resta `TEXT` libero.

---

## 3 · API SURFACE

### 3.1 Endpoint nuovi / estesi

| Verb | Path | Scope | Nota |
|---|---|---|---|
| `GET`    | `/api/admin/tenants/{tid}/activities` | advisor/admin | **esteso**: filtri completi, paginazione cursor |
| `POST`   | `/api/admin/tenants/{tid}/activities` | advisor/admin | **NEW** · full form (sostituisce semantica di `/activities/quick`) |
| `GET`    | `/api/admin/tenants/{tid}/activities/{aid}` | advisor/admin | **NEW** · single fetch |
| `PATCH`  | `/api/admin/tenants/{tid}/activities/{aid}` | advisor/admin | **NEW** · update parziale |
| `DELETE` | `/api/admin/tenants/{tid}/activities/{aid}` | advisor/admin | **NEW** · archive (soft) |
| `POST`   | `/api/admin/tenants/{tid}/activities/{aid}/complete` | advisor/admin | **NEW** · imposta `completed_at = NOW()` |
| `POST`   | `/api/admin/tenants/{tid}/activities/{aid}/reopen`   | advisor/admin | **NEW** · annulla completion |
| `GET`    | `/api/admin/tenants/{tid}/activities/open-followups` | advisor/admin | **NEW** · `next_step_due_at IS NOT NULL AND completed_at IS NULL` (admin operativo) |
| `GET`    | `/api/admin/tenants/{tid}/activities/search?q=`      | advisor/admin | **NEW** · FTS (idx_activities_search_fts) |
| `POST`   | `/api/admin/tenants/{tid}/activities/quick` | advisor/admin | **DEPRECATED** (mantenuto come alias di POST `/activities`, removerà la whitelist) |

### 3.2 Founder mirror (vincoli D4)

| Verb | Path | Scope | Nota |
|---|---|---|---|
| `GET`    | `/api/blueprint/activities` | owner | esistente, **esteso** con filtri + paginazione |
| `POST`   | `/api/blueprint/activities` | owner | **NEW** · founder può loggare attività proprie |
| `GET`    | `/api/blueprint/activities/{aid}` | owner | **NEW** |
| `PATCH`  | `/api/blueprint/activities/{aid}` | owner | **NEW** — server-side `payload.pop("owner_user_id")` (founder NON può cambiare l'owner) |
| `POST`   | `/api/blueprint/activities/{aid}/complete` | owner | **NEW** |
| `POST`   | `/api/blueprint/activities/{aid}/reopen`   | owner | **NEW** |
| `GET`    | `/api/blueprint/activities/open-followups` | owner | **NEW** |
| `GET`    | `/api/blueprint/activities/search?q=`      | owner | **NEW** |

### 3.3 Schema request — `POST /activities` (admin)

```jsonc
{
  "contact_id":        "uuid?",
  "activity_type_code":"meeting",           // required, from catalog (enabled=TRUE)
  "subject":           "Demo Master Deck",
  "notes":             "Architetto interessato a sezione lighting…",
  "outcome":           "Studio richiede follow-up con quote",
  "next_step":         "Inviare PDF tariffario v2",
  "next_step_due_at":  "2026-06-09T14:00:00Z",
  "duration_min":      45,
  "occurred_at":       "2026-06-02T10:30:00Z",  // optional, default NOW()
  "owner_user_id":     "uuid?",              // admin può assegnare; founder non può
  "importance":        4,                    // optional, 1..5
  "sentiment":         1,                    // optional, -2..+2
  "source":            "crm"                 // optional, default 'crm'
}
```

### 3.4 Schema response (estesa)

Aggiunti rispetto a M1: `notes`, `completed_at`, `created_by`, `importance`, `sentiment`, `source`, `created_by_display`. Resta retro-compatibile: il client M1 ignora i campi sconosciuti.

### 3.5 Filtri lista (admin & founder)

| Query param | Effetto |
|---|---|
| `contact_id` | scope contatto |
| `activity_type_code` (CSV) | per tipo |
| `owner_user_id` | per owner (admin-only) |
| `created_by` | chi ha registrato (admin-only) |
| `status` | `open` (next_step pending) · `completed` · `archived` · `all` |
| `since` / `until` | range su `occurred_at` |
| `due_since` / `due_until` | range su `next_step_due_at` |
| `q` | FTS su subject/outcome/next_step/notes (idx GIN) |
| `cursor` / `limit` | come timeline M2 (base64 `(occurred_at, id)`) |

### 3.6 Backward compat

- `POST /activities/quick` continua a funzionare; rimuovo la whitelist `_M1_QUICK_TYPES` e ridireziono internamente al nuovo `create_activity`.
- I client esistenti che mandano `subject + outcome + contact_id + activity_type_code` continuano a funzionare senza modifiche.

---

## 4 · UX

### 4.1 Admin · `TenantDetail.jsx` tab "Attività"

L'attuale tab `Attività` mostra solo lista preview. M3 lo rende **operativo**:

```
┌────────────────────────────────────────────────────────────────────┐
│  Filtri: [Tipo ▾] [Stato ▾] [Owner ▾] [Periodo ▾] [Cerca…]  + Nuova │
├────────────────────────────────────────────────────────────────────┤
│  ▣ Pending follow-up (3)                                             │
│  ├─ 09/06 14:00 · Demo Master Deck · Giulia · ✓ Completa             │
│  └─ 11/06 09:30 · Sopralluogo showroom · Mario · ✓ Completa          │
│                                                                      │
│  ◯ Storico recente                                                   │
│  ├─ 02/06 22:48 · Internal note · onboarding · MOOD Admin            │
│  └─ 02/06 22:48 · LinkedIn · Connect · MOOD Admin                    │
│                                                                      │
│  [ Carica altre ]                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 4.2 Componente `<ActivityDrawer>` (nuovo)

Riprende lo stile `ContactDrawer`. Stessi pattern, stessi `data-testid` naming convention.

Layout:
- Header: tipo + owner picker
- Body:
  - Contatto associato (autocomplete da `tenant_contacts`)
  - Subject (input)
  - Notes (textarea, 5 righe)
  - Outcome (textarea, 3 righe)
  - Next step (input)
  - Due date (datepicker)
  - Duration (number, suggerisce default dal catalog `default_duration_min`)
  - Occurred at (datetime, default NOW())
  - Advanced (collapsible): importance (1..5 stars), sentiment (-2..+2 emoji), source (free text)
- Footer: [Annulla] [Completa al salvataggio] [Salva]

Tutti gli input hanno `data-testid="activity-drawer-{field}"`.

### 4.3 `<ActivityRow>` riusabile

Riga compatta sia per Timeline (M2) sia per Attività tab (M3). Differenze:
- Timeline: icona + label + ora · subject inline
- Attività tab: icona + label · subject · owner · stato follow-up (✓/⏰/—) · button azione

### 4.4 Founder mirror · `BlueprintOverview.jsx` tab "Attività"

Stesso componente, con:
- Owner picker disabilitato (forzato a founder stesso)
- `created_by` nascosto
- Filtri ridotti (no owner filter, no created_by filter)

### 4.5 Empty states / Loading

- Empty: "Nessuna attività ancora registrata. Inizia con una chiamata o un meeting." + bottone primario "Nuova attività"
- Loading: skeleton rows (4)
- Error: messaggio con retry

---

## 5 · PERMISSIONS

### 5.1 Matrice ruoli × azioni

| Azione | Admin | Advisor (advisor_id su relazione) | Founder (owner role) |
|---|:--:|:--:|:--:|
| `GET /admin/.../activities` | ✅ | ✅ (proprio tenant scope) | ❌ |
| `POST /admin/.../activities` | ✅ | ✅ | ❌ |
| `PATCH /admin/.../activities/{aid}` | ✅ | ✅ | ❌ |
| `DELETE /admin/.../activities/{aid}` | ✅ | ✅ | ❌ |
| Cambio `owner_user_id` | ✅ | ✅ (a se stesso o ad altro advisor del team) | ❌ |
| Cambio `created_by` | ❌ (audit-immutable) | ❌ | ❌ |
| `GET /blueprint/activities` | (via X-Tenant-Slug override) | n/a | ✅ (proprio tenant) |
| `POST /blueprint/activities` | (via override) | n/a | ✅ (owner_user_id = self) |
| `PATCH /blueprint/activities/{aid}` | (via override) | n/a | ✅ (no owner change) |
| `DELETE /blueprint/activities/{aid}` | (via override) | n/a | ✅ (solo proprie) |

### 5.2 Tenant isolation (invariata M1/M2)

- Admin: `_advisor_scope` valida che `tenant_id` sia nello scope advisor (o super-admin)
- Founder: `require_admin_tenant` forza il tenant dal JWT, header `X-Tenant-Slug` ignorato per ruolo `owner`
- Cross-tenant query → 403/404 garantiti dai router (test in §9)

### 5.3 Defense-in-depth nei writer

Pattern già adottato in M1 per `tenant_contacts` (D4 strip):

```python
# blueprint_activities.py router
async def update_my_activity(aid, body, tenant=Depends(require_admin_tenant)):
    body.pop("owner_user_id", None)       # founder cannot escalate
    body.pop("created_by", None)          # immutable
    body.pop("tenant_id", None)           # forced from JWT
    return await svc.update_activity(...)
```

---

## 6 · TIMELINE INTEGRATION (M2)

**Vincolo utente**: "ogni attività M3 deve apparire automaticamente nella Timeline M2. Nessuna duplicazione. Nessun secondo feed."

### 6.1 Soluzione tecnica

La view `v_relationship_timeline` (M0) include già `source='activity'` join su `relationship_activities`. M3 **non modifica la view** — qualunque nuova riga in `relationship_activities` appare in Timeline senza modifiche.

### 6.2 Verifica regression Timeline

- ✅ Filtri Timeline M2 (`sources=activity`, `manual_only`, `contact_id`, `since/until`) continuano a funzionare
- ✅ Cursor stability invariata (tuple `(occurred_at, id)` non cambia)
- ✅ Founder visibility (admin_only) invariata: `platform_activity_types.visibility` controlla
- ⚠️ Se utente in futuro decide di **escludere** alcune attività dalla timeline (es. note brevissime), aggiungeremo il flag `show_in_timeline` (già esistente nel catalog) — fuori scope M3 attuale

### 6.3 Test esplicito

In `validate_m3.py` (§9.4): creare un'attività `meeting` (oggi rifiutata dalla whitelist M1) e verificare che:
1. POST → 200 (catalog-driven, non più 422)
2. `GET /admin/.../timeline` la mostra
3. `GET /blueprint/timeline` la mostra (visibility='all')

---

## 7 · RELATIONSHIP HEALTH HOOKS

### 7.1 Modello

Il pattern è già in produzione da M2: `services/relationship_activities.create_quick_activity` chiama `relationship_health.apply_signal(source='activity', type_code=...)` dentro la stessa transazione.

### 7.2 Cosa cambia in M3

Tutti i nuovi entry-point del servizio (`create_activity`, `update_activity`, `archive_activity`, `complete_activity`, `reopen_activity`) **propagano il signal** secondo le regole:

| Azione | Hook signal |
|---|---|
| `create_activity(code)` | `apply_signal(source='activity', type_code=code)` con delta del catalog |
| `update_activity(code_old → code_new)` | se `code_new != code_old`: revert old, apply new (no-op se delta uguale) |
| `archive_activity` | nessun signal (rimane storico) |
| `complete_activity` | nessun signal aggiuntivo (è solo cambio stato di un follow-up) |
| `reopen_activity` | nessun signal |

**Vincoli confermati**:
- ❌ Nessuna formula AI
- ❌ Nessun dashboard
- ❌ Nessun KPI
- ❌ Nessuna esposizione di `relationship_score` / `last_touch_at` lato client
- ✅ Solo `score_delta` + `touch` dal catalog → UPDATE incrementale (come M2)

### 7.3 Test esplicito (§9)

- Creare `meeting` → `tenant.relationship_score += 8`
- Cambiare a `visit` → `+= (10-8) = +2`
- Archiviare → no change
- Completare un follow-up → no change

---

## 8 · FOUNDER MIRROR

### 8.1 Capabilities founder

- ✅ Vedere TUTTE le proprie attività (sue + create da advisor/admin sul suo tenant)
- ✅ Loggare nuove attività (`POST /blueprint/activities`) con `owner_user_id` forzato a sé
- ✅ Modificare proprie attività (PATCH) — owner_user_id e created_by stripped
- ✅ Completare/riaprire follow-up
- ✅ Archiviare proprie attività
- ❌ Non vedere attività di altri tenant
- ❌ Non cambiare `owner_user_id` (anche se tenta via PATCH)
- ❌ Non vedere `notes` di attività con `visibility='admin_only'` *(scope future — M3 default: tutte visible)*

### 8.2 Considerazioni "visibility a livello attività" (out of scope M3)

Il catalog ha già `platform_activity_types.visibility` per filtrare interi tipi. M3 **non introduce** un flag `visibility` per-attività (per esempio per nascondere una nota specifica). Se servirà, M4 lo aggiungerà.

### 8.3 Test esplicito (§9)

- Founder JWT genera attività → `created_by` = founder · `owner_user_id` = founder
- Founder PATCH tenta `owner_user_id` = admin → 200 ma owner immutato
- Founder GET cross-tenant → 403

---

## 9 · ACCEPTANCE CRITERIA

### 9.1 Funzionali (obbligatori, blocking)

| # | Criterio | Verifica |
|---|---|---|
| F1 | `POST /activities` con type `meeting` (M1 rifiuta) ritorna 200 | curl |
| F2 | Schema response include `notes`, `completed_at`, `created_by`, `importance`, `sentiment`, `source` | curl |
| F3 | Activity con `next_step_due_at` appare in `/open-followups` | curl |
| F4 | `POST /{aid}/complete` setta `completed_at = NOW()` e rimuove dalla lista open-followups | curl |
| F5 | `POST /{aid}/reopen` annulla `completed_at` | curl |
| F6 | Filtri (`status`, `since`, `until`, `due_since`, `due_until`, `q`) ritornano subset corretto | curl |
| F7 | FTS `?q=onboarding` matcha attività con "onboarding" in notes/subject/outcome | curl |
| F8 | Activity appare in `v_relationship_timeline` (M2) senza duplicazione | sql + timeline API |
| F9 | Health hook applica `score_delta` corretto (meeting=+8) | sql verify |
| F10 | Cambio type da `meeting` → `visit` aggiusta delta a +2 netti | sql verify |
| F11 | Archiviazione non duplica history e mantiene timeline visibility | sql + timeline API |
| F12 | Pagination cursor su lista attività: no overlap tra pagine | curl |

### 9.2 Sicurezza (16 check, parallel a M2)

| # | Criterio | Verifica |
|---|---|---|
| S1 | Anon → `/admin/.../activities` = 401 | curl |
| S2 | Founder JWT → `/admin/.../activities` (altro tenant) = 403/404 | curl |
| S3 | Founder POST → `owner_user_id` impostato a sé, ignorato body | curl + db |
| S4 | Founder PATCH → `owner_user_id` change ignorato | curl + db |
| S5 | Founder PATCH → `created_by` ignorato | curl + db |
| S6 | Founder PATCH → `tenant_id` ignorato | curl + db |
| S7 | Advisor X scope → tenant fuori scope = 404 | curl |
| S8 | Activity con `visibility='admin_only'` non appare nel founder feed | curl |
| S9 | `complete_at` future date rifiutata (422) | curl |
| S10 | `importance` out-of-range silenziosamente accettata (no constraint M3) | curl |
| S11 | `activity_type_code` non in catalog → 422 (non più 500 come pre-M3) | curl |
| S12 | Activity di tenant A non leakable via cursor manipolato | curl |
| S13 | Cross-tenant GET single = 404 | curl |
| S14 | `_M1_QUICK_TYPES` rimosso: `meeting`/`visit`/`task` accettati | curl |
| S15 | Backwards compat: `/activities/quick` mantiene 200 sui 5 tipi storici | curl |
| S16 | Founder DELETE su attività di altro owner ammesso (own tenant)? **Decisione: SÌ** (founder è "owner del tenant") · verifica audit log | curl |

### 9.3 Regression (zero impatto)

- M0: 56/56 PASS
- M1 real-usage: 33/33 PASS
- M1 security: 16/16 PASS
- M2 security: 16/16 PASS
- Frontend lint: ESLint clean
- Backend lint: Ruff clean

### 9.4 Script di validation

Nuovo: `backend/scripts/validate_m3.py` (16 functional + 16 security = 32 check)

### 9.5 Screenshot obbligatori

1. Admin tab "Attività" con lista paginata + filter chips
2. ActivityDrawer aperto con tutti i campi
3. Pending follow-up section con ✓ completa
4. Founder Blueprint tab "Attività"
5. Timeline M2 che mostra una nuova `meeting` (regression test)

### 9.6 Performance budget

- `GET /activities` (limit 30) ≤ baseline M2 (~1.8s p95 fino a M1.1 hardening)
- `GET /activities/search` ≤ 2.5s p95 (FTS index)
- `POST /activities` (con hook signal) ≤ 2.2s p95

---

## 10 · EFFORT REALE

| Componente | Effort | Note |
|---|---:|---|
| Migration 034 + rollback | 0.2g | 6 colonne + 1 FK + 3 indici (incl. GIN) |
| Service `relationship_activities.py` espansione | 0.6g | 6 nuovi entry-point + retire `_M1_QUICK_TYPES` |
| Router `admin_activities.py` (separato da admin_crm) | 0.4g | 8 endpoint nuovi |
| Router `blueprint_activities.py` espansione | 0.3g | 7 endpoint con strip pattern D4 |
| Servizio search (FTS query helper) | 0.3g | wrapper su to_tsvector + plainto_tsquery |
| Frontend `<ActivityDrawer>` | 0.7g | nuovo, full-form, datetime, autocomplete contatti |
| Frontend `<ActivityRow>` riusabile | 0.3g | refactor lista esistente |
| Frontend tab Attività (admin) revamp | 0.4g | filtri + pending follow-up section + drawer wiring |
| Frontend tab Attività (founder mirror) | 0.2g | stesse componenti, props ridotte |
| Validation script `validate_m3.py` | 0.5g | 32 check (16 func + 16 sec) |
| Smoke + regression run + screenshot | 0.3g | 4 suite + 5 screenshot |
| Report `M3_IMPLEMENTATION_REPORT.md` | 0.2g | con diff sommario + perf |
| **Totale** | **4.4g** | (parallelo BE+FE ≈ 2.6g calendario) |

### Rischi & mitigazioni

| Rischio | Sev | Mitigazione |
|---|:--:|---|
| Rimuovere `_M1_QUICK_TYPES` rompe chiamate esistenti | 🟡 | Mantengo endpoint `/quick` come alias, deprecato ma funzionante. Test compat: S15 |
| FTS Italiano richiede `unaccent` ext | 🟢 | Uso `'simple'` dictionary (case-insensitive, no accenti) — sufficiente per M3 |
| Cambio `activity_type_code` in PATCH duplica health signal | 🔴 P0 | Logica esplicita: revert delta vecchio + apply nuovo (atomico). Test F10 |
| Founder PATCH che inserisce campi nuovi nel payload | 🟡 | Defense pop su 4 campi (owner, created_by, tenant, archived_at) |
| Indice GIN su `relationship_activities` aumenta cost INSERT | 🟢 | Volume atteso 100/giorno · INSERT degradation <10ms · accettabile |

---

## 11 · DIPENDENZE & CONFINI

### Già disponibili (no precondizioni)
- ✅ M0 schema + view
- ✅ M1 contact CRM (per autocomplete contatti)
- ✅ M1.0.1 language normalization (riutilizzabile come pattern)
- ✅ M2 health hooks (`apply_signal`)
- ✅ M2 timeline view + endpoints
- ✅ Catalog activity types con flags

### Fuori scope M3 (esplicito)
- ❌ M2.1 Cosmetic Fix (header "Untitled studio")
- ❌ M1.1 Performance Hardening (connection pool)
- ❌ M4 Notification Center (delivery sui `notifiable`)
- ❌ M5 Advisor Workspace + KPI
- ❌ Sentiment AI / NLP su `notes`
- ❌ Importance auto-derivation
- ❌ Sync con calendar esterni (Google/Outlook)
- ❌ Voice-to-text per `notes` (mobile future)
- ❌ Attachment upload sulle attività (file/photo)
- ❌ Reminder delivery automatico via email/notification

---

## 12 · COSA SERVE DALL'UTENTE PER PARTIRE

a) Conferma di procedere con M3 secondo il dimensionamento (4.4g)
b) Decisione su `S16` (founder può cancellare attività di altro owner sullo stesso tenant?) — default proposto **SÌ**
c) Decisione sul nuovo catalog `platform_activity_sources` — default proposto **NO** (source resta TEXT libero in M3)
d) Eventuali variazioni di scope sui 5 future-ready fields (`notes`, `completed_at`, `created_by`, `importance`, `sentiment`, `source`) — default **tutti inclusi nello schema**
e) Conferma del nuovo data-testid namespace `activity-*` per testing agent

---

## 13 · CLASSIFICAZIONE FINALE

🟢 **`READY_FOR_M3_IMPLEMENTATION`**

Zero blocker. Schema progettato, API mappate, hook health già operativi, timeline non richiede modifiche, founder mirror invariato, security copertura 16/16, performance budget allineato al baseline M2, effort honest 4.4g.

L'unico gate residuo è il **"VAI"** dell'utente.

---

*Generato 2026-06-02 da E1 (Emergent).*
*Stato: ATTESA DI APPROVAZIONE PER L'ESECUZIONE M3.*
*Nessuna migration eseguita. Nessuna feature implementata.*
*Reference: `M2_IMPLEMENTATION_REPORT.md`, `M1_REAL_USAGE_VALIDATION_REPORT.md`, `M1_CONTACT_CRM_IMPLEMENTATION_REPORT.md`, `RELATIONSHIP_OS_FOUNDATION_PLAN.md`.*
