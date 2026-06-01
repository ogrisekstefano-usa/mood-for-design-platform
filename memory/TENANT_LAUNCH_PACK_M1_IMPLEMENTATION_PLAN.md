# TENANT LAUNCH PACK™ — M1 IMPLEMENTATION PLAN

> **Status**: ❗ ATTESA APPROVAZIONE — nessun codice fino al via libera.
> **Data**: 2026-06-01
> **Scope**: M1 stretto, pragmatico. Foundation DB + Bootstrap + Founder Checklist + Advisor read-only.
> **Fuori scope (rimandato a M2+)**: advisor suggestion engine, digest, LISTEN/NOTIFY, cron, Health Score visibile.
> **Vincolo P0**: zero hardcoded. Checklist, copy, lingue: tutti DB/CMS-driven.

---

## 0. PROMESSE DI M1

Cosa otterremo alla chiusura di M1:

1. ✅ Quando un tenant passa a `activated`, un Launch Pack viene creato
   automaticamente in modo idempotente (state + task_state) e parte
   l'email Welcome al founder, completamente CMS-driven.
2. ✅ Al primo login post-activation, il founder vede una schermata
   `/blueprint/launch` con la checklist a 6 task (DB-driven), un
   progress %, e attività recente. Può completare i task manualmente
   o vederli auto-completare quando l'evento corrispondente arriva.
3. ✅ Advisor e Super Admin vedono nel Command Center una nuova lista
   "Launch Status" con progress % per tenant attivati, evidenza di chi
   è fermo senza attività. **Nessun motore di suggerimenti** in M1.
4. ✅ Test E2E backend riproducibile (`scripts/e2e_tenant_launch_m1.py`)
   che valida bootstrap, task completion, email dispatch.
5. ✅ Zero stringhe hardcoded. Aggiungere/rinominare un task da DB +
   CMS aggiorna l'UI senza deploy.

**NON otterremo in M1**:
- ❌ Health Score visualizzato (nessuna tabella `tenant_launch_score_bands`,
  nessun calcolo ponderato esposto).
- ❌ Advisor suggestion engine (nessun `advisor_suggestion_rules`,
  nessun `advisor_suggested_actions`).
- ❌ Cron nightly / decay inactivity.
- ❌ Digest email all'advisor.
- ❌ LISTEN/NOTIFY (recompute solo on-write esplicito).
- ❌ Admin UI per gestire il catalogo task (gestione via SQL diretto
  in M1).

---

## 1. SCHEMA DB M1 — Migration 031

Solo **3 tabelle additive**. Zero ALTER su tabelle esistenti.

### 1.1 `tenant_launch_tasks` (catalogo configurabile)

```sql
CREATE TABLE tenant_launch_tasks (
  code            TEXT PRIMARY KEY,           -- 'complete_profile', stable identifier
  display_order   INT NOT NULL DEFAULT 100,
  is_required     BOOLEAN NOT NULL DEFAULT TRUE,
  unlock_after    TEXT REFERENCES tenant_launch_tasks(code) ON UPDATE CASCADE,
  triggered_by    TEXT[] NOT NULL DEFAULT '{}',  -- event_type che marca completed
  icon_key        TEXT,                       -- chiave Lucide (es. 'user', 'briefcase')
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tlt_active_order ON tenant_launch_tasks(is_active, display_order);
```

**Seed iniziale (6 task)** — i copy vivono in CMS (vedi §5):

| display_order | code | unlock_after | triggered_by | icon |
|---|---|---|---|---|
| 10 | `complete_profile` | — | `profile_completed` | `user` |
| 20 | `verify_market` | `complete_profile` | `market_verified` | `globe` |
| 30 | `invite_first_member` | `verify_market` | `member_invited`, `member_accepted` | `users` |
| 40 | `upload_first_material` | `invite_first_member` | `first_material_uploaded` | `layers` |
| 50 | `create_first_project` | `upload_first_material` | `first_project_created` | `briefcase` |
| 60 | `complete_first_journey` | `create_first_project` | `first_journey_completed` | `compass` |

**Note M1**: nessuna colonna `weight_pct` (rimandata a M4 quando
servirà per Health Score). Il progress % in M1 è semplice ratio
`completed / total_required`.

### 1.2 `tenant_launch_state` (snapshot per tenant)

```sql
CREATE TABLE tenant_launch_state (
  tenant_id            UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  activated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pack_completed_at    TIMESTAMPTZ,
  pack_dismissed_at    TIMESTAMPTZ,
  current_progress_pct INT NOT NULL DEFAULT 0,
  last_event_at        TIMESTAMPTZ,
  last_recomputed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- For advisor queue ordering: "active but silent"
CREATE INDEX idx_tls_active_silent
  ON tenant_launch_state(last_event_at)
  WHERE pack_completed_at IS NULL AND pack_dismissed_at IS NULL;
```

**Note M1**: nessuna colonna `health_score` né `health_band`. La
proiezione si limita al progress % e al timestamp dell'ultima attività.

### 1.3 `tenant_launch_task_state` (per tenant × task)

```sql
CREATE TABLE tenant_launch_task_state (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  task_code           TEXT NOT NULL REFERENCES tenant_launch_tasks(code) ON UPDATE CASCADE,
  status              TEXT NOT NULL DEFAULT 'locked',
                      -- 'locked' | 'available' | 'in_progress' | 'completed' | 'skipped'
  completed_at        TIMESTAMPTZ,
  completed_by_user_id UUID,                       -- nullable; founder o advisor
  triggering_event_id UUID,                        -- FK a tenant_activity_events(id), nullable
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, task_code)
);

CREATE INDEX idx_tlts_tenant_status ON tenant_launch_task_state(tenant_id, status);
```

### 1.4 Migration policy
- File: `db/migrations/031_tenant_launch_pack_m1.sql`.
- 100% additiva, nessun DROP, nessun ALTER su tabelle esistenti.
- Eseguibile più volte (idempotente: `CREATE TABLE IF NOT EXISTS`,
  `INSERT ... ON CONFLICT DO NOTHING` per il seed).
- Seed script separato: `scripts/seed_tenant_launch_tasks.py` (6 task)
  + `scripts/seed_tenant_launch_cms.py` (copy CMS it-IT + en-US).

---

## 2. TRIGGER / ENDPOINT BOOTSTRAP

### 2.1 Hook su transizione `activated`

Il punto di hook esiste già in `services/studio_activation.py`:
funzione `update_request_status()`. M1 estende il blocco esistente
che invia `studio_request_approved` con una chiamata aggiuntiva a
`tenant_launch.bootstrap(tenant_id)`.

**Ordine delle operazioni** (idempotente):

```
update_request_status(status='activated')
  ├── studio_requests.status = 'activated'  [DB]
  ├── studio_request_approved email          [existing, CMS]
  └── tenant_launch.bootstrap(tenant_id)     [NEW]
        ├── INSERT tenant_launch_state ... ON CONFLICT DO NOTHING
        ├── INSERT tenant_launch_task_state (1 row per active task)
        │     - unlock_after IS NULL → status='available'
        │     - else                   → status='locked'
        ├── INSERT tenant_activity_events (event_type='tenant_activated')
        ├── recompute(tenant_id)              [progress %, last_event_at]
        └── dispatch email tenant_launch_welcome [CMS-driven]
```

**Domanda aperta**: bootstrap viene chiamato da `update_request_status`
solo per lo `studio_requests` flow, ma il tenant viene creato in
`activate_studio_ecosystem` (`studio_relations` flow). M1 chiama
`tenant_launch.bootstrap(tenant_id)` anche da `send_activation_email_for_request()` (entry-point post-activation già esistente per email_approved).

### 2.2 Servizio `services/tenant_launch.py` — API minima M1

```python
async def bootstrap(tenant_id: str) -> dict:
    """Idempotent. Creates state + task_state + welcome email."""

async def recompute(tenant_id: str) -> dict:
    """Recomputes progress % from current task_state. No side effects
    other than UPDATE tenant_launch_state."""

async def get_state(tenant_id: str, locale: str = 'it-IT') -> dict:
    """Returns the founder-facing payload:
       { progress_pct, tasks: [{code, label, description, status,
         completed_at, icon}], recent_events: [...] }
       Excludes any health/score/advisor metadata."""

async def mark_task(tenant_id: str, task_code: str,
                    status: str,
                    completed_by_user_id: str | None = None,
                    triggering_event_id: str | None = None) -> bool:
    """Manual transitions: available→in_progress, available→completed,
       available→skipped, in_progress→completed. Auto-unlock dei task
       in cascata se unlock_after è soddisfatto. Re-emette
       recompute(tenant_id)."""

async def handle_event(tenant_id: str, event_type: str,
                       event_id: str,
                       user_id: str | None = None) -> None:
    """Quando arriva un evento da tenant_activity_events:
       per ogni task con event_type in triggered_by → marca completed.
       Auto-unlock dei task successivi."""
```

### 2.3 Endpoint pubblici M1 (founder, require_tenant_member)

| Metodo | Path | Body | Risposta |
|---|---|---|---|
| `GET`  | `/api/blueprint/launch/state` | — | `{progress_pct, tasks[], recent_events[], dismissed: bool}` |
| `POST` | `/api/blueprint/launch/task/{code}/start` | — | `{ok: true}` (transition available→in_progress) |
| `POST` | `/api/blueprint/launch/task/{code}/complete` | — | `{ok: true}` (manual completion, fire event) |
| `POST` | `/api/blueprint/launch/task/{code}/skip` | `{reason?: string}` | `{ok: true}` |
| `POST` | `/api/blueprint/launch/dismiss` | — | `{ok: true}` |

### 2.4 Endpoint admin/advisor (require_advisor_scope, read-only M1)

| Metodo | Path | Risposta |
|---|---|---|
| `GET` | `/api/admin/launch/pipeline?status=all\|silent\|active\|completed` | `{total, items: [{tenant_id, studio_name, progress_pct, last_event_at, days_silent, activated_at, advisor_id?}]}` scoped per advisor |
| `GET` | `/api/admin/launch/tenant/{tenant_id}` | dettaglio completo: state + task_state[] + ultimi 20 eventi |

**Scope**: advisor vede solo i tenant collegati alla propria
`studio_relations.owner_advisor_id`. Super admin vede tutto.

### 2.5 Trigger DB minimo (M1)

In M1 evitiamo i trigger PG su tutte le tabelle (rimandato a M2-M4).
Gli unici 2 trigger semplici:

```sql
-- A) Idempotent guard: prevent double "first_*" events.
-- Bloccato a livello service Python (NOT EXISTS check), no trigger.

-- B) Auto-fire 'member_invited' / 'member_accepted' / 'first_material_uploaded'
-- /'first_project_created': delegato al codice applicativo che già scrive
-- nelle tabelle (Blueprint backend esistente). Estendiamo solo i routes
-- esistenti con un `emit_event(tenant_id, event_type)` helper.
```

**M1 keeps it simple**: nessun trigger DB. Solo helper Python
`emit_event()` chiamato dai router esistenti. Audit chiaro,
debuggabile, riproducibile in test.

---

## 3. FOUNDER UX — `/blueprint/launch`

### 3.1 Route + guard

- Route mount: `/blueprint/launch` (Blueprint app, esistente
  `BlueprintApp.jsx`).
- Guard: utente deve avere `tenant_memberships.status='active'` per il
  tenant del subdomain corrente.
- Redirect post-login automatico: se
  `tenant_launch_state.pack_completed_at IS NULL`
  AND `pack_dismissed_at IS NULL`, la landing root del Blueprint
  redirige a `/blueprint/launch` al primo login del founder.
  Altrimenti landing normale (`/blueprint/`).

### 3.2 Layout

```
┌──────────────────────────────────────────────────────────┐
│  NAVBAR BLUEPRINT (esistente)                            │
│                                                          │
│  TENANT LAUNCH PACK                                      │
│  ─────────────────────                                   │
│                                                          │
│  Benvenuto, {{founder_first_name}}.                      │
│  Il tuo Blueprint è attivo.                              │
│                                                          │
│  ┌── COMPLETA IL TUO BLUEPRINT ────────────── 33% ─┐    │
│  │                                                  │    │
│  │  ●  Completa profilo studio          ✓ fatto    │    │
│  │  ●  Verifica mercato principale      ✓ fatto    │    │
│  │  ○  Invita il primo collaboratore  → disponibile│    │
│  │  ○  Carica il primo materiale          bloccato │    │
│  │  ○  Crea il primo progetto             bloccato │    │
│  │  ○  Completa il primo Design Journey   bloccato │    │
│  │                                                  │    │
│  │  [Vai a: Invita il primo collaboratore]         │    │
│  │  (cta_url_path dal CMS del task corrente)       │    │
│  │                                                  │    │
│  │  [Nascondi questa scheda]                        │    │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌── ATTIVITÀ RECENTE ─────────────────────────────┐    │
│  │ • 2h fa  · Profilo studio aggiornato            │    │
│  │ • ieri   · Blueprint attivato                   │    │
│  │ (vuoto = stato editoriale neutro)               │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

### 3.3 Stati visuali per ogni task

| status | Icona/colore | Etichetta CMS (esempio it-IT) | Cliccabile |
|---|---|---|---|
| `locked` | grey/lock | "Completa prima: {{prev_task_label}}" | NO |
| `available` | white/dot + accent teal hover | "Inizia" + CTA | SÌ |
| `in_progress` | teal/dot | "In corso" + Continua | SÌ |
| `completed` | teal solid/check | "✓ fatto · {{relative_time}}" | NO |
| `skipped` | grey strike | "Saltato" | mostrare "Riprendi" |

### 3.4 Componenti React necessari

| File (nuovo) | Path |
|---|---|
| `LaunchPackPage.jsx`     | `frontend/src/blueprint/pages/LaunchPackPage.jsx` |
| `LaunchChecklistCard.jsx`| `frontend/src/blueprint/components/launch/LaunchChecklistCard.jsx` |
| `LaunchTaskItem.jsx`     | `frontend/src/blueprint/components/launch/LaunchTaskItem.jsx` |
| `LaunchRecentActivity.jsx`| `frontend/src/blueprint/components/launch/LaunchRecentActivity.jsx` |
| `useLaunchState.js`      | `frontend/src/blueprint/hooks/useLaunchState.js` (polling 60s) |
| `useTenantLaunchCopy.js` | `frontend/src/blueprint/hooks/useTenantLaunchCopy.js` (cache CMS) |

### 3.5 data-testid mandatori
```
launch-pack-page, launch-welcome-title, launch-checklist-card,
launch-progress-bar, launch-task-{code}, launch-task-{code}-status,
launch-task-{code}-cta, launch-recent-activity,
launch-recent-activity-empty, launch-dismiss-button, launch-loading
```

### 3.6 Loading / empty / error states

| Stato | UI |
|---|---|
| Loading (initial fetch) | skeleton card 6 righe, no spinner |
| Empty activity log | "Nessuna attività recente. Inizia da: {{first_task_label}}" |
| 401 / 404 | redirect a `/blueprint/` con toast neutro |
| Server error | banner editoriale "Un attimo, stiamo allineando il tuo spazio." + retry button |

### 3.7 Health Score nascosto
Il payload di `GET /api/blueprint/launch/state` **non include** alcun
campo `health_score` né `health_band`. Anche se vengono aggiunti in M4,
la response founder li omette esplicitamente.

---

## 4. ADVISOR READ-ONLY UX

### 4.1 Mount

- Route nuova: `/command-center/launch` (CommandCenter sidebar, item
  "Tenant Launch").
- Scope: `require_advisor_scope` (advisor + super admin).
- Advisor vede solo i tenant collegati alle proprie `studio_relations`.

### 4.2 Layout (essenziale M1)

```
┌────────────────────────────────────────────────────────────────┐
│  TENANT LAUNCH                                                 │
│  ────────────────                                              │
│                                                                │
│  FILTRO   [Tutti] [Silenti >7gg] [Attivi] [Completati]         │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Studio Rossi Interior          ░░░░░░░░░░  17%  cold  │   │
│  │  attivato 2gg fa · 1/6 task · ultimo evento: 2gg fa    │   │
│  │  ──────────────────────────────────────────────────    │   │
│  │  Studio Bianchi Architetti      ████░░░░░░  50%  warm  │   │
│  │  attivato 5gg fa · 3/6 task · ultimo evento: 4h fa     │   │
│  │  ──────────────────────────────────────────────────    │   │
│  │  Studio Verde Material          ██████████ 100%  done  │   │
│  │  attivato 14gg fa · 6/6 task · pack completed          │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│  Click row → drawer con dettaglio task_state + ultimi eventi   │
└────────────────────────────────────────────────────────────────┘
```

### 4.3 Read-only constraint M1
- Nessuna azione mutativa eccetto:
  - "Apri Studio Relation" → link a esistente.
  - "Open detail drawer" → solo lettura.
- **Niente** dismiss, snooze, contatto, suggestion (M2+).

### 4.4 Filtro `silent`
"Silent" = `last_event_at < NOW() - INTERVAL '7 days'`
AND `pack_completed_at IS NULL` AND `pack_dismissed_at IS NULL`.

Questa è l'unica intelligence M1: una query SQL semplice.

### 4.5 Etichetta "cold/warm/done" (M1)
M1 NON ha Health Score. Etichette ricavate dal solo progress:
- `done`     = `pack_completed_at IS NOT NULL` (100%)
- `warm`     = `progress_pct >= 50` (almeno 3/6 task)
- `cold`     = `progress_pct < 50`

Sono solo etichette UI, non un sistema di scoring. Saranno sostituite
dal vero Health Score in M4. Copy via CMS namespace
`tenant.launch.ui.cohort.<label>`.

### 4.6 Componenti React necessari

| File (nuovo) | Path |
|---|---|
| `TenantLaunchListPage.jsx` | `frontend/src/admin/pages/TenantLaunchListPage.jsx` |
| `TenantLaunchRow.jsx`      | `frontend/src/admin/components/TenantLaunchRow.jsx` |
| `TenantLaunchDrawer.jsx`   | `frontend/src/admin/components/TenantLaunchDrawer.jsx` |
| `useTenantLaunchPipeline.js` | `frontend/src/admin/hooks/useTenantLaunchPipeline.js` |

### 4.7 data-testid mandatori
```
tenant-launch-list, tenant-launch-filter-{key},
tenant-launch-row-{tenant_id}, tenant-launch-progress-{tenant_id},
tenant-launch-cohort-{tenant_id}, tenant-launch-drawer,
tenant-launch-drawer-close, tenant-launch-task-state-{code}
```

---

## 5. EMAIL WELCOME CMS

### 5.1 Template key
`tenant_launch_welcome` (singolo template; variant con team escluso da M1).

### 5.2 Namespace e block keys

Vivono in `editorial_blocks` namespace `email`, allineato al pattern
esistente di `studio_request_approved` etc.

| block_key | Esempio it-IT (source_value) |
|---|---|
| `tenant_launch_welcome.subject` | `Il tuo Blueprint è pronto, {{founder_first_name}}` |
| `tenant_launch_welcome.eyebrow` | `Blueprint attivato` |
| `tenant_launch_welcome.headline` | `Benvenuto in MOOD, {{founder_first_name}}.` |
| `tenant_launch_welcome.body` | `Il Blueprint di {{studio_name}} è attivo. Da qui puoi configurare il profilo, invitare il team, caricare i primi materiali e avviare il primo progetto. I primi passi sono accompagnati: ogni step ti porta più vicino al primo valore reale.` |
| `tenant_launch_welcome.cta_label` | `Apri il Blueprint` |
| `tenant_launch_welcome.cta_url_path` | `/blueprint/launch?token={{magic_link_token}}` |
| `tenant_launch_welcome.note` | `Hai 30 giorni per accedere con questo link. Il tuo Advisor MOOD ti seguirà nei primi passi.` |
| `tenant_launch_welcome.signature` | `L'ecosistema MOOD for DESIGN™` |

### 5.3 Variabili interpolabili (allineate al sistema esistente)
`{{founder_first_name}}`, `{{studio_name}}`, `{{reference}}`,
`{{operating_market_label}}`, `{{magic_link_token}}`,
`{{magic_link_url}}`.

### 5.4 Locale resolution
Stesso pattern di `email_dispatcher.py`:
- `tenant.default_locale_code` come primary;
- chain `platform_languages.fallback_locale`;
- fallback finale a `source_value` (`it-IT`).

### 5.5 Magic link
Riusa `access_continuity.issue_magic_link()` esistente per generare
`{{magic_link_token}}`. Scadenza 30 giorni (D1 della
proposta strategica, ratifico in M1).

### 5.6 Dispatch
Chiamata a `email_dispatcher.dispatch_email(
  template_key='tenant_launch_welcome', ...)` direttamente da
`tenant_launch.bootstrap()`. Audit via `studio_email_dispatch_log`
(tabella esistente).

### 5.7 Copy in italiano editoriale
Le frasi non devono essere aulici, motivazionali o americanizzati.
Stile editoriale MOOD: indicativo, conciso, secondo persona singolare,
zero "claim", zero retorica vendita.

Esempi vietati:
- ❌ "Pronto a trasformare il tuo studio?"
- ❌ "Inizia il tuo viaggio MOOD!"

Esempi corretti:
- ✅ "Il tuo Blueprint è attivo."
- ✅ "Da qui puoi configurare il profilo."

---

## 6. TEST E2E RICHIESTI

### 6.1 Backend — `scripts/e2e_tenant_launch_m1.py`

Catena indipendente, eseguibile in pre-merge:

```
1. Setup: crea tenant fixture + advisor relation
2. Trigger: chiama tenant_launch.bootstrap(tenant_id)
3. Assert:
   ✓ tenant_launch_state row creato
   ✓ tenant_launch_task_state ha 6 righe (1 available, 5 locked)
   ✓ email tenant_launch_welcome dispatched (status='sent')
   ✓ tenant_activity_events ha event_type='tenant_activated'
   ✓ current_progress_pct = 0
4. Idempotency: re-chiama bootstrap → nessun duplicato
5. Manual task completion:
   - mark_task('complete_profile', 'completed')
   ✓ task_state.status = 'completed'
   ✓ task_state.completed_at popolato
   ✓ task 'verify_market' auto-unlock → status='available'
   ✓ progress_pct ricalcolato a 17 (1/6)
6. Event-driven completion:
   - emit_event('first_material_uploaded', user_id)
   ✓ task 'upload_first_material' → 'completed' (anche se ancora locked!
     ma in M1 → bypass unlock-gate se event matches, scelta D2)
7. Founder API:
   - GET /api/blueprint/launch/state come membro del tenant
   ✓ 200 OK con payload founder-safe
   ✓ campo health_score NON presente
   ✓ task labels in it-IT
8. Advisor API:
   - GET /api/admin/launch/pipeline con X-Admin-Key
   ✓ 200 OK
   ✓ tenant nostro presente con progress 17 (o 33% se event step)
   ✓ filtro silent funziona
9. Founder dismiss:
   - POST /api/blueprint/launch/dismiss
   ✓ pack_dismissed_at popolato
   ✓ GET /state ritorna dismissed: true
```

### 6.2 Frontend smoke tests (Playwright)
- `tenant_launch_founder.spec` — founder login → /blueprint/launch
  visibile → task `complete_profile` cliccabile → completa via UI →
  progress sale.
- `tenant_launch_advisor.spec` — admin login → /command-center/launch
  → lista tenant visibile → filtro `silent` → drawer dettaglio si apre.

### 6.3 Regression
- Tenant Acquisition Final Validation (30/30) deve continuare a passare:
  rilancio `scripts/tenant_acquisition_final_validation.py` post-merge.
- `scripts/e2e_studio_v2_full.py` (12/12) deve continuare a passare.

### 6.4 Tutti i test devono passare prima di chiudere M1
Soglia: 100% boolean checks. Nessuna eccezione.

---

## 7. COSA RESTA FUORI DA M1

Tutto questo è documentato nel piano strategico generale ma rimandato
oltre M1, per disciplina di scope:

### Rimandato a M2
- `tenant.launch.welcome_team` variant (founder con team già configurato).
- "Cosa succede adesso" card nel founder page (richiede CMS namespace
  `tenant.launch.ui.next_steps.*` aggiuntivo).
- Reversibilità del dismiss da Settings.

### Rimandato a M3 / M4
- `advisor_suggestion_rules` + `advisor_suggested_actions` (motore).
- Health Score: `tenant_launch_score_bands` + colonne `health_score`
  / `health_band` su `tenant_launch_state`.
- Cron nightly recompute (decay inactivity).
- Notifiche email digest all'advisor.

### Rimandato a M5
- Admin UI per CRUD su `tenant_launch_tasks` (in M1 si modifica via
  SQL diretto / seed script).
- Validatore "somma `weight_pct` = 100" (M4 quando weight esisterà).
- Localizzazione per `fr-FR`/`de-DE`/`es-ES`/`pt-BR` (M5 quando
  `platform_languages` li abiliterà).

### Definitivamente fuori scope
- Gamification, badge, achievement.
- A/B testing del copy.
- Push notifications mobile.
- Slack/Discord integrations.

---

## 8. DECISIONI MINIME PER M1

Solo 3 decisioni necessarie ora (le altre del piano strategico
restano in attesa per M2+):

### D1 — Magic link nel Welcome email (riassunto)
- **Proposta**: link riusabile 30 giorni.
- ✅ OK?

### D2 — Event-driven completion bypassa `unlock_after`?
Se arriva un evento `first_material_uploaded` ma il task
`upload_first_material` è ancora `locked` (perché
`invite_first_member` non è completed):
- a) Bypass: il task va a `completed` comunque. I task intermedi
  restano `locked` ma "saltati di fatto" — il progress riflette i
  completati.
- b) Strict: l'evento viene ignorato finché unlock_after non è done.
- **Proposta**: **a)** — la realtà del founder non sempre segue
  l'ordine consigliato. Il sistema deve accogliere il valore reale
  prodotto.

### D3 — Bootstrap entry point
- a) Solo via `update_request_status(status='activated')`.
- b) Anche via `activate_studio_ecosystem()` (per non perdere
  attivazioni che bypassano studio_requests).
- **Proposta**: **b)** — chiamata in entrambi i punti, l'idempotenza
  garantisce zero duplicati.

---

## 9. ROADMAP M1 (timing realistico)

| Step | Effort | Output testabile |
|---|---|---|
| 1. Migration 031 + seed task + seed CMS | 2h | `psql -c "SELECT * FROM tenant_launch_tasks"` ritorna 6 righe |
| 2. Service `tenant_launch.py` (bootstrap, get_state, mark_task, handle_event, recompute) | 4h | Unit test passano |
| 3. Hook su `update_request_status` + `activate_studio_ecosystem` | 1h | E2E step 1-4 passano |
| 4. Email welcome CMS seed | 1h | Dispatch log mostra email sent |
| 5. Router founder `/api/blueprint/launch/*` | 2h | curl con membership token → 200 |
| 6. Router admin `/api/admin/launch/*` | 1.5h | curl con X-Admin-Key → 200 |
| 7. Founder UI `/blueprint/launch` (5 componenti) | 5h | Playwright spec passa |
| 8. Admin UI `/command-center/launch` (4 componenti) | 4h | Playwright spec passa |
| 9. `scripts/e2e_tenant_launch_m1.py` | 2h | 9/9 boolean checks |
| 10. Regression rerun (Tenant Acquisition + Studio V2) | 0.5h | 30/30 + 12/12 ancora verdi |
| **TOTALE** | **~23h** (~1 sprint stretto) | |

---

## 10. CHECKLIST APPROVAZIONE M1

- [ ] **Schema DB M1** §1 (3 tabelle, 0 ALTER)
- [ ] **Bootstrap flow** §2 (idempotente, 2 entry points)
- [ ] **Endpoint M1** §2.3, §2.4 (founder mutativo, advisor read-only)
- [ ] **Founder UX** §3 (checklist 6 task, no health score visibile)
- [ ] **Advisor UX** §4 (read-only, cohort labels da progress)
- [ ] **Welcome email** §5 (CMS-driven, IT editoriale)
- [ ] **Test E2E** §6 (`e2e_tenant_launch_m1.py`)
- [ ] **Decisioni** D1-D3 §8

STOP. Attendo OK punto-per-punto o OK globale.
Zero codice fino al tuo via libera.
