# M5 · Advisor Workspace v1 — Execution Plan

**Versione**: 1.0 · **Data**: 03 Giugno 2026 · **Stato**: ⏸ In attesa di autorizzazione esplicita
**Classificazione proposta**: `READY_FOR_M5_IMPLEMENTATION`
**Predecessori**: M0 · M1 · M2 · M3 · M4 ✅
**Validazione di journey**: `/app/memory/M5_ADVISOR_JOURNEY_VALIDATION.md`

---

## 0 · Scope blocked-in (no creep durante sviluppo)

**Decisioni utente recepite (A·B·C·D + 5 direttive aggiuntive)**:

| Dec | Item                                                          | Stato |
| --- | ------------------------------------------------------------- | :---: |
| A   | M5 v1 = 5 sezioni · NO My Activities, NO Pipeline, NO Comm.   |   ✅   |
| B   | `/workspace/studios/{tid}` → redirect `/command-center/tenants/{tid}?view=advisor` |   ✅   |
| C   | Suggerimenti SQL-based · sources: last_touch_at, relationship_score, open_followups, notification_count, contact_count · NO AI/LLM |   ✅   |
| D   | NO Streak/gamification                                        |   ✅   |
| E   | **My Day ordine fisso**: ① Attenzione oggi · ② In ritardo · ③ Nuovo · ④ Opportunità |   ✅   |
| F   | **Introductions = Inbox** (non lista) · stato · priorità · origine · advisor · azione succ. |   ✅   |
| G   | **Studios filtrato**: aperte / follow-up / silenziosi / con notif. — gli altri secondari |   ✅   |
| H   | **Follow-Ups** è la sezione più importante · 3 bucket + 3 azioni rapide |   ✅   |
| I   | **Notifications** = riuso totale di M4 · zero duplicati       |   ✅   |

---

## 1 · Audit stato di fatto (cosa esiste già)

Verifica fatta sul codice corrente per evitare ricostruzioni:

| Necessario per M5                                | Già esiste?                                  | Note                                           |
| ------------------------------------------------ | -------------------------------------------- | ---------------------------------------------- |
| Modello `advisor_profiles`                       | ✅                                            | Tabella M1 con `user_id` link to `users`       |
| Assegnazione advisor↔tenant                      | ✅                                            | `tenants.tenant_relationship_owner_user_id`    |
| Multi-advisor per tenant                         | ❌                                            | Solo 1 owner. **Out of scope M5 v1.**          |
| `users.role = 'advisor'`                         | 🟡                                           | Constraint accetta `'advisor'` ma 0 user oggi (solo admin+owner). Servirà seed. |
| RBAC scoping per advisor                         | 🟡                                           | Esistono helper in `services/notifications.py` (`_advisors_for_tenant`). Da generalizzare in `services/advisor_scope.py`. |
| `studio_requests` table + drawer                 | ✅                                            | Riusabile per Introductions                    |
| `studio_requests.advisor_assigned_user_id`       | 🟡                                            | Da verificare presenza. Se manca → ALTER ADD. |
| Endpoint M0-M3 filtrabili per advisor            | 🟡                                            | Endpoint `/api/admin/*` esistono. Da decidere: nuovi `/api/workspace/*` oppure flag `?scope=advisor` su admin. Andiamo per **nuovo namespace** per chiarezza. |
| M4 notification deep links to `/workspace/*`     | ✅                                            | `_build_action_url` già genera URL workspace   |
| Notification drawer + bell                       | ✅                                            | Globale, basta che lo shell `WorkspaceShell` resti montato |
| Page Visibility polling                          | ✅                                            | `useNotifications` ok                          |
| Relationship Center 3-col                        | ❌                                            | M6 deferred. M5 redirige al Command Center. |

**Conclusione**: oltre il 60% del lavoro M5 è composizione di API esistenti. Le poche nuove cose: aggregatore `My Day`, scoping advisor, shell `/workspace/*`, page Introductions kanban.

---

## 2 · Database — Migration 036

### 2.1 Cambiamenti minimi necessari

```sql
-- 036_advisor_workspace.sql

-- (A) Ensure 'advisor' role accepted (already in role enum from M0)
-- No-op se la check è ok.

-- (B) Track introduction lifecycle (Inbox concept · direttiva F)
ALTER TABLE studio_requests
    ADD COLUMN IF NOT EXISTS advisor_assigned_user_id UUID
        REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS inbox_status TEXT
        CHECK (inbox_status IN
              ('awaiting_accept','in_review','ready_to_activate',
               'activated','declined','deferred','snoozed'))
        DEFAULT 'awaiting_accept',
    ADD COLUMN IF NOT EXISTS inbox_priority TEXT
        CHECK (inbox_priority IN ('low','normal','high','urgent'))
        DEFAULT 'normal',
    ADD COLUMN IF NOT EXISTS inbox_source TEXT,  -- 'v2_funnel','referral','manual','cold_outreach',...
    ADD COLUMN IF NOT EXISTS inbox_next_action TEXT,
    ADD COLUMN IF NOT EXISTS inbox_next_action_due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_studio_req_advisor_inbox
    ON studio_requests(advisor_assigned_user_id, inbox_status, inbox_priority, created_at DESC)
    WHERE inbox_status IN ('awaiting_accept','in_review','ready_to_activate');

-- (C) Materialized helper for "My Day" suggested actions (no AI, pure SQL)
-- View — recomputed at read time on small datasets.
-- For scale > 20K activities we'll convert to MATERIALIZED VIEW + cron refresh in M1.1.
CREATE OR REPLACE VIEW v_advisor_suggested_actions AS
WITH base AS (
    SELECT
        t.id                                   AS tenant_id,
        t.name                                 AS tenant_name,
        t.tenant_relationship_owner_user_id    AS advisor_user_id,
        COALESCE(t.relationship_score, 50)     AS health_score,
        t.last_touch_at,
        EXTRACT(EPOCH FROM (NOW() - t.last_touch_at))/86400 AS days_silent,
        (SELECT COUNT(*) FROM relationship_activities ra
          WHERE ra.tenant_id = t.id
            AND ra.completed_at IS NULL
            AND ra.archived_at IS NULL
            AND ra.next_step_due_at < NOW())   AS overdue_count,
        (SELECT COUNT(*) FROM tenant_contacts tc
          WHERE tc.tenant_id = t.id AND tc.archived_at IS NULL) AS contact_count,
        (SELECT COUNT(*) FROM relationship_notifications n
          WHERE n.tenant_id = t.id
            AND n.read_at IS NULL
            AND n.archived_at IS NULL)         AS unread_notif_count
      FROM tenants t
     WHERE t.tenant_relationship_owner_user_id IS NOT NULL
)
SELECT
    advisor_user_id,
    tenant_id,
    tenant_name,
    health_score,
    last_touch_at,
    days_silent::int,
    overdue_count,
    unread_notif_count,
    contact_count,
    -- Rule-based priority (no LLM)
    CASE
      WHEN days_silent >= 30 AND overdue_count = 0 THEN 'reengage_silent'
      WHEN health_score < 50 AND days_silent >= 14 THEN 'health_drop'
      WHEN overdue_count >= 3 THEN 'overdue_burst'
      WHEN unread_notif_count >= 5 THEN 'notif_pile_up'
      WHEN contact_count = 1 THEN 'single_contact_risk'
      ELSE NULL
    END AS suggestion_code,
    -- Score for sorting (higher = more urgent suggestion)
    (COALESCE(GREATEST(days_silent - 14, 0), 0) * 1.0
     + GREATEST(50 - health_score, 0) * 0.8
     + overdue_count * 2.0
     + unread_notif_count * 0.3)::numeric(10,2) AS suggestion_score
  FROM base
 WHERE
    -- only surface non-trivial suggestions
    (days_silent >= 14 OR health_score < 50 OR overdue_count >= 3 OR contact_count = 1);
```

### 2.2 Rollback `036_advisor_workspace.rollback.sql`
- DROP VIEW `v_advisor_suggested_actions`
- DROP INDEX `idx_studio_req_advisor_inbox`
- ALTER `studio_requests` DROP COLUMN su tutte le 7 colonne aggiunte

### 2.3 Cosa NON tocchiamo

- ❌ NO modifiche a `relationship_activities`, `tenant_contacts`, `relationship_events`, `users`, `tenants` core
- ❌ NO nuove tabelle commissioni
- ❌ NO `pipeline_stages`
- ❌ NO `advisor_studio_assignments` (M5.1 quando arriverà multi-advisor)

---

## 3 · Backend — Service `services/advisor_scope.py` + 5 routers

### 3.1 Service: scoping centralizzato

```python
# services/advisor_scope.py
async def studios_for_advisor(s, *, user_id: UUID, filters: dict) -> dict:
    """Default sort: smart bucketing per direttiva G.
    Buckets returned in order:
      1) needs_attention  (overdue >0 OR unread_notif >=3)
      2) active_followups (open follow-up between today and 7g)
      3) silent           (days_silent >= 14)
      4) others           (rest)
    Each tenant tagged with its bucket. FE renders bucket headers.
    """

async def my_day(s, *, user_id: UUID) -> dict:
    """Aggregator for the My Day landing page.
    Returns:
      {
        date, advisor_display,
        counters: {actions_today, critical, overdue, today, suggestions},
        critical: [...],     # priority high & overdue, max 5
        today: [...],        # next_step_due_at between today
        new: [...],          # ultime notif unread non-critiche (max 5)
        suggestions: [...],  # da v_advisor_suggested_actions, sorted by score, top 3
        studios_snapshot: [...], # top 3 by health
      }
    """

async def followups_for_advisor(s, *, user_id, bucket: str) -> dict:
    """bucket ∈ {overdue, today, week, snoozed, done30}."""

async def introductions_for_advisor(s, *, user_id, status_filter=None) -> dict:
    """Inbox-style with grouping per inbox_status."""
```

### 3.2 Routers (`/api/workspace/*`)

| Method | Path                                          | Note                                                |
| ------ | --------------------------------------------- | --------------------------------------------------- |
| GET    | `/api/workspace/my-day`                       | Aggregator. Cache 30s lato server.                  |
| GET    | `/api/workspace/studios`                      | Returns bucketed list (4 buckets, direttiva G)      |
| GET    | `/api/workspace/follow-ups?bucket=overdue`    | bucket: overdue · today · week · snoozed · done30  |
| POST   | `/api/workspace/follow-ups/{id}/complete`     | Quick action 1                                      |
| POST   | `/api/workspace/follow-ups/{id}/reschedule`   | Body: `{new_due_at}`. Quick action 2                |
| POST   | `/api/workspace/follow-ups/{id}/reassign`     | Body: `{new_owner_user_id}`. (Admin-side mainly)    |
| GET    | `/api/workspace/introductions`                | Inbox (kanban groups by inbox_status)               |
| POST   | `/api/workspace/introductions/{id}/accept`    | sets `accepted_at`, `inbox_status='in_review'`      |
| POST   | `/api/workspace/introductions/{id}/decline`   | sets `declined_at`, `inbox_status='declined'`       |
| POST   | `/api/workspace/introductions/{id}/defer`     | sets `inbox_status='deferred'`, `next_action_due_at`|
| POST   | `/api/workspace/introductions/{id}/promote`   | sets `inbox_status='ready_to_activate'`             |
| POST   | `/api/workspace/introductions/{id}/activate`  | delegates to existing `studio_activation.activate_request_full_auto` |

**RBAC strict ovunque**: ogni endpoint controlla `advisor_assigned_user_id = auth.user.id` o `tenant_relationship_owner_user_id = auth.user.id` lato DB. Niente "admin override" — l'admin continua a usare `/api/admin/*`.

### 3.3 Riuso totale di M4

- Bell, drawer, badge, polling, preferences → **zero modifiche** lato M5
- Pagina `/workspace/notifications` = riusa `<NotificationDrawer>` come `<div>` inline a tutto schermo, NON re-implementa fetch/state

---

## 4 · Frontend — `/workspace/*`

### 4.1 Routing

```
/workspace                       → redirect /workspace/my-day
/workspace/my-day                → <MyDayPage />        (NUOVO)
/workspace/notifications         → <WorkspaceNotificationsPage /> (NUOVO, riusa M4 components)
/workspace/follow-ups            → <FollowUpsPage />    (NUOVO)
/workspace/studios               → <MyStudiosPage />    (NUOVO)
/workspace/studios/:tid          → redirect /command-center/tenants/:tid?view=advisor (B confermato)
/workspace/introductions         → <IntroductionsInbox /> (NUOVO)
```

### 4.2 Shell

`WorkspaceShell.jsx` esistente già accoglie sia Command Center sia Workspace. Aggiungiamo solo un **prop `mode`** (`'admin'|'advisor'`) per cambiare voci sidebar + breadcrumb.

### 4.3 Sidebar `mode='advisor'`

```
MOOD · Workspace
Raffaella · advisor
─────────────────────
◆ My Day              ●
◇ Notifications      12
◇ Follow-Ups          5
◇ Studios            12
◇ Introductions       3
─────────────────────
RECENT (max 3 last visited)
─────────────────────
⊕ Annota attività  (FAB on mobile)
```

5 voci. Niente di più. Niente di meno.

### 4.4 My Day page · ordine fisso direttiva E

```
1. ATTENZIONE OGGI       (= overdue + due today crítical)
2. IN RITARDO            (= overdue ≥ 1g, non-critici, max 5 + "vedi tutti")
3. NUOVO                 (= notif unread non-critiche, max 5)
4. OPPORTUNITÀ           (= suggested_actions ordinato per score, max 3)
   + I miei studi (snapshot 3 top by health) — fixed footer-section
```

Empty state se zero in tutte le 4 sezioni: editoriale **«Tutto sotto controllo per oggi. È un buon momento per scrivere a uno studio fermo da settimane.»** + lista suggerimenti SQL.

### 4.5 Follow-Ups page (sezione più importante · direttiva H)

```
TABS
[Overdue · 8]  [Today · 1]  [This week · 4]  [Snoozed · 2]  [Done last 30g · 47]
─────────────────────────────────────────────────────────────────────
Bulk: ☐ select all          [✓ Completa]  [⟳ Riprogramma]  [→ Riassegna]
─────────────────────────────────────────────────────────────────────
Item rows:

▌ Da 2 giorni · Sintesi call con Luca Conti
  Studio Bianchi & Co. · founder primario
  Owner: Raffaella M.
  [Completa] [Riprogramma] [Apri relazione]
```

3 azioni rapide. Niente schermate aggiuntive aperte per chiudere un follow-up.

### 4.6 Studios page · direttiva G

```
4 BUCKETS (header + count)
─────────────────────────────────────────────────────────────
RICHIEDONO ATTENZIONE (3)     [bordo rosso a sinistra]
  · Studio Bianchi & Co.  health 41 · 5 unread · 2 overdue
  · Studio Conti          health 64 · 3 unread · 1 overdue
  · Atelier Vetro Venezia health 38 · 1 unread · 0 overdue

FOLLOW-UP APERTI (4)
  · Martinel ID          next: demo 10 Giu
  · Sara Pellegrini Studio next: brief 9 Giu
  · ...

SILENZIOSI (≥14g) (3)
  · Atelier Verde Milano  ultimo: 18g fa
  · Studio Verri           ultimo: 21g fa
  · ...

ALTRI (2)
  · Conti Architetti  health 95 · ok
  · Mood Lab Roma     attivato la settimana scorsa
```

Bucket headers usano gli stessi token Command Center (eyebrow caps text-[10px] tracking-wider).

### 4.7 Introductions Inbox · direttiva F

```
[TUTTE]  [Awaiting accept · 4]  [In review · 2]  [Ready to activate · 1]  [Deferred · 1]  [Declined · 0]

Inbox row format (NOT a kanban — Inbox è una colonna ordinata):

▌ Studio Verri Milano                                      PRIORITY: HIGH
  Origin: V2 funnel · 1g fa
  Status: Awaiting accept
  Advisor: Raffaella M.
  Next action: Qualification call entro 9 Giu

  [Apri detail]  [Accept]  [Decline]  [Defer 7g]
```

Sort default: `inbox_priority DESC, created_at DESC`. Filtri laterali per status. Inbox header conta totali e unread per status.

### 4.8 Notifications page

Pagina full-screen che monta `<NotificationDrawer inline={true} />`. Niente fetch separato, niente nuovo hook, **stesso codice del bell drawer**.

---

## 5 · Empty states

| Schermo                                         | Stato vuoto editoriale                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| My Day (zero in tutte le sezioni)               | «Tutto sotto controllo per oggi. È un buon momento per scrivere a uno studio fermo da settimane.» + Suggerimenti |
| My Day (advisor senza studi)                    | «Non hai ancora studi assegnati. L'admin te li attribuirà al primo brief.»               |
| Follow-Ups Overdue (0)                          | «Nessun ritardo. Torna domani per i prossimi impegni.»                                  |
| Follow-Ups Today (0)                            | «Niente in scadenza oggi.»                                                              |
| Studios (0)                                     | Identico a My Day zero-studi                                                            |
| Introductions Inbox (0)                         | «Inbox vuota. MOOD ti scriverà appena arriva un lead.»                                  |
| Notifications page (0)                          | «Sei tutto aggiornato. Le notifiche compaiono qui.»                                     |

---

## 6 · Mobile

390px viewport:
- Sidebar → hamburger drawer da sinistra
- KPI strip → wrap 2 colonne
- Tabs follow-ups → scroll orizzontale
- Studios buckets → accordion (chiusi di default tranne "Richiedono attenzione")
- Introductions Inbox → lista flat con priority pill in alto
- **FAB `⊕ Annota attività`** in basso a destra (fixed)

Niente mobile-specific layout per Studio detail (riutilizza Command Center tenant page esistente).

---

## 7 · data-testid obbligatori

```
workspace-shell  ·  workspace-sidebar  ·  workspace-mode-{admin|advisor}

myday-page  ·  myday-counter  ·
myday-section-attention  ·  myday-section-overdue  ·  myday-section-new  ·  myday-section-opportunities  ·
myday-studios-snapshot  ·  myday-item-{id}  ·  myday-item-{id}-cta-complete  ·  myday-item-{id}-cta-reschedule  ·  myday-item-{id}-cta-open

followups-page  ·  followups-tab-{overdue|today|week|snoozed|done30}  ·
followups-bulk-select  ·  followups-bulk-complete  ·  followups-bulk-reschedule  ·  followups-bulk-reassign  ·
followups-item-{id}  ·  followups-item-{id}-complete  ·  followups-item-{id}-reschedule  ·  followups-item-{id}-open

studios-page  ·  studios-bucket-{needs_attention|active_followups|silent|others}  ·
studios-item-{tid}  ·  studios-empty

introductions-page  ·  introductions-filter-{all|awaiting|in_review|ready|deferred|declined}  ·
introductions-item-{id}  ·
introductions-item-{id}-accept  ·  introductions-item-{id}-decline  ·  introductions-item-{id}-defer  ·  introductions-item-{id}-promote  ·  introductions-item-{id}-activate

workspace-notifications-page  ·  (riusa testid M4)
```

---

## 8 · Fasi di lavoro (~9 giorni)

| Fase | Scope                                                       | Stima       | Output                                |
| ---- | ----------------------------------------------------------- | ----------- | ------------------------------------- |
| 1    | Migration 036 + view + validator                            | 0.5g        | DB pronto                             |
| 2    | `services/advisor_scope.py` + helpers + unit-test isolati   | 1g          | Logica scoping testata                |
| 3    | `services/my_day.py` aggregator + unit-test                 | 1g          | API My Day pronta                     |
| 4    | `routers/workspace.py` (12 endpoint) + curl tests           | 1g          | API completa                          |
| 5    | Shell mode='advisor' + sidebar + routing                    | 0.5g        | Navigazione OK                        |
| 6    | `MyDayPage` (4 sezioni ordine fisso) + suggestions          | 1.5g        | Hero pronto                           |
| 7    | `FollowUpsPage` con tabs + bulk + quick actions             | 1g          | Sezione critica direttiva H pronta    |
| 8    | `MyStudiosPage` con 4 buckets                               | 0.75g       | Direttiva G                           |
| 9    | `IntroductionsInbox` con filtri + 5 azioni                  | 1g          | Direttiva F                           |
| 10   | `WorkspaceNotificationsPage` (riuso M4)                     | 0.25g       | Direttiva I                           |
| 11   | Mobile responsive + FAB                                     | 0.5g        | Mobile production-ready               |
| 12   | Empty states                                                | 0.25g       | UX cura                               |
| 13   | Seed advisor reale (almeno 1 utente role='advisor')         | 0.25g       | Test dati                             |
| 14   | `validate_m5.py` + testing agent                            | 0.75g       | 40+ check PASS                        |
| 15   | Docs + `M5_IMPLEMENTATION_REPORT.md`                        | 0.25g       | Finalizzazione                        |
| **Totale**                                                          | **~9.5g**   |                                       |

---

## 9 · Acceptance criteria

- [ ] Migration 036 applicata · rollback verificato
- [ ] View `v_advisor_suggested_actions` ritorna suggerimenti corretti su tenant test
- [ ] Almeno 1 utente con `role='advisor'` seedato (es. `advisor1@moodfordesign.com`)
- [ ] `/api/workspace/my-day` ritorna le 4 sezioni nell'ordine ATTENZIONE → IN RITARDO → NUOVO → OPPORTUNITÀ
- [ ] `/api/workspace/follow-ups?bucket=overdue` ritorna solo gli overdue dell'advisor (RBAC strict)
- [ ] `/api/workspace/studios` ritorna 4 buckets (needs_attention, active_followups, silent, others)
- [ ] `/api/workspace/introductions` ritorna inbox con sort priority+date
- [ ] Quick actions (`complete`, `reschedule`, `reassign`) funzionanti via endpoint
- [ ] Frontend `/workspace/my-day` renderizza tutte le sezioni
- [ ] Click su item My Day naviga in 1 step (no popup intermedi)
- [ ] Mobile: sidebar collassata, FAB visibile, accordion bucket Studios funzionante
- [ ] Notification page riusa drawer M4 (zero duplicato di codice fetch/state)
- [ ] Empty states editoriali su tutti i 5 schermi
- [ ] RBAC: advisor A non vede dati di advisor B (test esplicito)
- [ ] Zero regressioni su M0-M4 (testing agent v3 fork verde)
- [ ] **NO** Streak/badge/gamification (verifica esplicita)
- [ ] **NO** My Activities, My Pipeline, Commissions (verifica esplicita)

---

## 10 · Risk register

| Rischio                                                | Mitigazione                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| Single-advisor model (1 owner per tenant)              | Documentato. Multi-advisor è M5.1 quando emerge bisogno operativo.       |
| Studio detail su `/command-center/tenants/{tid}` mostra CTA admin-only | Aggiungere prop `view=advisor` che nasconde 3-4 CTA admin specifici |
| View `v_advisor_suggested_actions` lenta su scala     | Per 20K tenants resta < 200ms. Diventa MATERIALIZED VIEW in M1.1.        |
| Advisor reale non esiste oggi in DB                    | Seed obbligatorio · documentato come task di Fase 13                     |
| `studio_requests.advisor_assigned_user_id` legacy null | Default `NULL` accettato. Solo lead "assigned" appaiono nell'inbox advisor. Un altro tab "Tutti i lead" può restare admin-only. |
| Polling notification rate aumenta con N pagine workspace aperte | Hook M4 ha già dedup + visibility · invariato                            |
| URL `/workspace/*` non protetto                        | Middleware: redirect non-advisor a `/command-center` o `/blueprint`      |

---

## 11 · File da creare / modificare

### Nuovi (10 backend + 7 frontend + 2 doc)

```
backend/db/migrations/036_advisor_workspace.sql
backend/db/migrations/036_advisor_workspace.rollback.sql
backend/services/advisor_scope.py
backend/services/my_day.py
backend/routers/workspace.py
backend/scripts/validate_m5.py
backend/scripts/seed_m5_advisor.py

frontend/src/workspace/WorkspaceApp.jsx
frontend/src/workspace/pages/MyDayPage.jsx
frontend/src/workspace/pages/FollowUpsPage.jsx
frontend/src/workspace/pages/MyStudiosPage.jsx
frontend/src/workspace/pages/IntroductionsInbox.jsx
frontend/src/workspace/pages/WorkspaceNotificationsPage.jsx
frontend/src/workspace/components/QuickActionButton.jsx

memory/M5_KICKOFF_REPORT.md       (post-migration)
memory/M5_IMPLEMENTATION_REPORT.md (post-completion)
```

### Modificati (4)

```
backend/server.py                            (mount workspace router)
backend/services/studio_activation.py        (set inbox_status='activated' on activate)
frontend/src/admin/shared/WorkspaceShell.jsx (prop mode='advisor' → sidebar diversa)
frontend/src/App.js                          (route /workspace/* → WorkspaceApp)
```

---

## 12 · Non-Goals (rispetto rigoroso direttive)

- ❌ My Activities page (deferred per ridondanza)
- ❌ My Pipeline (manca modello)
- ❌ Commissions (no calcolo reale)
- ❌ Streak / badge / gamification (direttiva D)
- ❌ AI suggestions / LLM (direttiva C)
- ❌ Welcome video / quote of the day
- ❌ M6 Relationship Center 3-col (dopo M5)
- ❌ M3.1 Voice Notes
- ❌ M3.2 Email Activities
- ❌ M1.1 Performance hardening
- ❌ Push notifications
- ❌ Email digest M4.1
- ❌ Multi-advisor per tenant (M5.1)
- ❌ Calendar sync esterno

---

## 13 · Sequenza post-M5

L'utente ha esplicitato la roadmap successiva. Resa qui per consolidamento:

```
M5  (questo)
  ↓
M6  Relationship Center 3-col redesign
  ↓
M3.1 Voice Notes foundation
  ↓
M3.2 Email Activities foundation
  ↓
M1.1 Performance Hardening
```

Nessuno scope di M6+ può rientrare in M5 v1.

---

**Classificazione finale**: `READY_FOR_M5_IMPLEMENTATION`

**Aspetto la tua autorizzazione esplicita per iniziare Fase 1 (Migration 036).** Nessuna scrittura di codice prima del tuo `GO`.
