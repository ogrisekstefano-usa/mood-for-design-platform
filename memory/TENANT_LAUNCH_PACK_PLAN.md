# TENANT LAUNCH PACK™ — ARCHITECTURAL PLAN

> **Status**: ❗ ATTESA APPROVAZIONE — nessun codice fino al via libera utente.
> **Data**: 2026-06-01
> **Sprint scope**: post-activation experience (Founder Welcome → First Value Delivered).
> **Vincolo P0**: zero hardcoded. Checklist, regole advisor, copy, lingue, mercati: tutti DB/CMS driven.

---

## 0. AUDIT: cosa esiste già nel DB (riusabile)

Verifica eseguita su Supabase il 2026-06-01:

| Tabella esistente | Cosa contiene | Riuso nel Launch Pack |
|---|---|---|
| `tenants` | id, slug, status, plan, max_users, max_projects, branding, default_locale_code, ... | Sorgente del tenant; aggiungiamo soltanto FK in tabelle nuove. **Nessuna ALTER**. |
| `tenant_memberships` | profile_id, role, status, invited_at, accepted_at | Sorgente "team invited" — `COUNT(*)` per tenant. |
| `tenant_activity_events` | tenant_id, user_id, event_type, created_at | **Spine dorsale del First Value Tracking**. Estendiamo solo il vocabolario degli `event_type`. |
| `tenant_onboarding` | booleani hardcoded (profile_completed, team_invited, project_created, materials_uploaded, storefront_published, ...) | ⚠ Da **deprecare gradualmente** — sostituito da modello configurabile (vedi §2). Lasciato in piedi per back-compat finché il Blueprint UI non migra. |
| `user_onboarding_state` | tour per-utente | Riuso per "Founder Welcome Tour" + "Advisor Tour" senza creare nuovo schema. |
| `studio_relations` | tenant relazione advisor (CRM-side) | Sorgente per "owner_advisor_id" → notifiche advisor. |
| `projects`, `material_assets` | counters per Health Score | `COUNT(*)` per tenant. |
| `editorial_blocks` (+ translations) | namespace `email`, `studio_v2.ui`, ... | Aggiungiamo namespace `tenant.launch.*` (nessuna nuova tabella per copy). |
| `platform_languages` (enabled, blueprint_enabled, fallback_locale) | locale runtime BCP-47 | Source of truth per le lingue del pack. |

**Implicazione**: il Launch Pack richiede solo **1 nuova migration**
con 4 tabelle additive (no ALTER su tabelle esistenti).

---

## 1. ARCHITETTURA COMPLETA

```
┌──────────────────────────────────────────────────────────────────────────┐
│  TENANT LAUNCH PACK™ — SYSTEM TOPOLOGY                                   │
│  ──────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  ┌─────────────────────────┐                                             │
│  │  ACTIVATION TRIGGER     │  studio_requests.status='activated'         │
│  │  (existing pipeline)    │  ↓ existing studio_request_approved email   │
│  └────────────┬────────────┘                                             │
│               │                                                          │
│               ▼                                                          │
│  ┌─────────────────────────┐                                             │
│  │  LAUNCH PACK BOOTSTRAP  │  (new) idempotent service                   │
│  │  • create tenant_launch_state row                                     │
│  │  • snapshot active task catalog                                       │
│  │  • emit event: tenant_activated                                       │
│  │  • dispatch CMS email: tenant.launch.welcome                          │
│  └────────────┬────────────┘                                             │
│               │                                                          │
│               ▼                                                          │
│  ┌──────────────────────────────────────────────────────────────┐        │
│  │ FOUNDER SURFACE                  ADVISOR SURFACE             │        │
│  │ /blueprint/launch (gate)         /command-center/launch      │        │
│  │  ┌────────────────────────┐       ┌─────────────────────┐    │        │
│  │  │ Welcome Hero           │       │ Tenant Launch       │    │        │
│  │  │ Checklist Card         │       │ Advisor™ Panel      │    │        │
│  │  │ • 5 tasks DB-driven    │       │ • Tenant list with  │    │        │
│  │  │ • progress % live      │       │   health score      │    │        │
│  │  │ • status per task      │       │ • Suggested actions │    │        │
│  │  │ Activity Timeline      │       │ • First Value funnel│    │        │
│  │  └────────────────────────┘       └─────────────────────┘    │        │
│  └──────────────────────────────────────────────────────────────┘        │
│               │                                  │                       │
│               ▼                                  ▼                       │
│  ┌──────────────────────────────────────────────────────────────┐        │
│  │  EVENT BUS                                                   │        │
│  │  ──────────                                                  │        │
│  │  All write-paths emit into tenant_activity_events:           │        │
│  │   • tenant_activated, profile_completed                      │        │
│  │   • team_invited, member_accepted                            │        │
│  │   • first_material_uploaded, first_project_created           │        │
│  │   • first_journey_completed, first_value_delivered           │        │
│  │                                                              │        │
│  │  Derivation engine (read-side):                              │        │
│  │   • tenant_launch_task_state recomputed from events          │        │
│  │   • tenant_health_score recomputed nightly + on event        │        │
│  │   • advisor_suggested_actions recomputed on rule eval        │        │
│  └──────────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────┘
```

**Principi architetturali**:

1. **Event-sourced** read model. `tenant_activity_events` è la verità,
   tutto il resto è proiezione.
2. **Configurabilità via CMS + DB registry**. Nessuna stringa, nessun
   passo del checklist, nessuna soglia di Health Score, nessuna regola
   Advisor è hardcoded.
3. **Idempotenza** del bootstrap. Riattivazioni o re-trigger non
   creano duplicati.
4. **BCP-47 strict** via `platform_languages.fallback_locale` chain.
5. **Separazione delle superfici**: Founder vede solo il proprio
   progresso. Advisor/Admin vedono Health Score e Suggestions
   (mai esposti al Founder).
6. **Pluggabile**: una nuova event_type registrata nel catalogo
   diventa subito disponibile per Health Score e per Advisor Rules
   senza deploy lato frontend.

---

## 2. SCHEMA DB — Migration 031 (additiva, 4 tabelle)

### 2.1 `tenant_launch_tasks` (catalogo configurabile)

Sorgente di verità per i task del Founder Checklist. Modificabile via
Command Center (futuro) senza redeploy.

```sql
CREATE TABLE tenant_launch_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,        -- 'complete_profile'
  display_order   INT NOT NULL DEFAULT 100,
  is_required     BOOLEAN NOT NULL DEFAULT TRUE,
  unlock_after    TEXT,                        -- code di un task precedente; null = subito disponibile
  triggered_by    TEXT[] NOT NULL DEFAULT '{}',-- event_types che marcano questo task come completed
  weight_pct      INT NOT NULL DEFAULT 0,      -- contributo % al Health Score (somma di tutti = 100)
  icon_key        TEXT,                        -- chiave Lucide icon
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Seed iniziale (6 task)** — non-hardcoded perché vivono in DB:

| code | weight | triggered_by | unlock_after |
|---|---|---|---|
| `complete_profile` | 10 | `profile_completed` | — |
| `verify_market` | 10 | `market_verified` | `complete_profile` |
| `invite_first_member` | 20 | `member_invited`, `member_accepted` | `verify_market` |
| `upload_first_material` | 20 | `first_material_uploaded` | `invite_first_member` |
| `create_first_project` | 20 | `first_project_created` | `upload_first_material` |
| `complete_first_journey` | 20 | `first_journey_completed` | `create_first_project` |

Le label, descrizioni e helper text vivono in `editorial_blocks`
namespace `tenant.launch.task.<code>.*` (vedi §7).

### 2.2 `tenant_launch_state` (snapshot per tenant, derivato)

```sql
CREATE TABLE tenant_launch_state (
  tenant_id            UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  activated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pack_completed_at    TIMESTAMPTZ,             -- quando tutti i task required sono done
  pack_dismissed_at    TIMESTAMPTZ,             -- founder ha nascosto la card
  current_progress_pct INT NOT NULL DEFAULT 0,
  health_score         INT NOT NULL DEFAULT 0,
  health_band          TEXT NOT NULL DEFAULT 'cold',  -- 'cold'|'warm'|'ready'|'thriving'
  last_event_at        TIMESTAMPTZ,
  last_recomputed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tls_health_band ON tenant_launch_state(health_band, last_event_at);
```

### 2.3 `tenant_launch_task_state` (per tenant × task)

```sql
CREATE TABLE tenant_launch_task_state (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  task_code       TEXT NOT NULL REFERENCES tenant_launch_tasks(code) ON UPDATE CASCADE,
  status          TEXT NOT NULL DEFAULT 'locked',  -- 'locked'|'available'|'in_progress'|'completed'|'skipped'
  completed_at    TIMESTAMPTZ,
  completed_by    UUID,                            -- user_id che ha triggerato il completamento
  triggering_event_id UUID,                        -- FK a tenant_activity_events.id
  UNIQUE (tenant_id, task_code)
);
CREATE INDEX idx_tlts_tenant_status ON tenant_launch_task_state(tenant_id, status);
```

### 2.4 `advisor_suggested_actions` (rules + outputs)

Una tabella **regole** (catalogo configurabile) + una tabella **outputs**
(suggerimenti vivi per tenant).

```sql
CREATE TABLE advisor_suggestion_rules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT UNIQUE NOT NULL,
  priority       INT NOT NULL DEFAULT 100,   -- lower = more prominent
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  -- Predicate, valutata server-side. Insieme di filtri AND-composti.
  predicate      JSONB NOT NULL,
  -- Esempio:
  -- { "min_days_since_activation": 1,
  --   "team_size_lt": 1,
  --   "tasks_done_lt": 1,
  --   "health_band_in": ["cold"] }
  suggestion_key TEXT NOT NULL,    -- punta a editorial_blocks: tenant.launch.advisor.<key>.*
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE advisor_suggested_actions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_code      TEXT NOT NULL REFERENCES advisor_suggestion_rules(code),
  suggestion_key TEXT NOT NULL,    -- copia denormalizzata per query veloci
  active_since   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at    TIMESTAMPTZ,      -- automatico quando la condizione cessa di valere
  resolved_reason TEXT,            -- 'condition_changed' | 'manually_dismissed' | 'rule_disabled'
  UNIQUE (tenant_id, rule_code)
);
CREATE INDEX idx_asa_tenant_open ON advisor_suggested_actions(tenant_id) WHERE resolved_at IS NULL;
```

**Seed iniziale (4 regole)** — gli esempi del brief utente:

| code | predicate | suggestion_key |
|---|---|---|
| `cold_after_24h` | `{days_since_activated_ge:1, team_size_lt:1}` | `cold_after_24h` |
| `team_no_project` | `{team_size_ge:3, project_count_lt:1}` | `team_no_project` |
| `projects_no_material` | `{project_count_ge:5, material_count_lt:1}` | `projects_no_material` |
| `no_journey_completed_14d` | `{days_since_activated_ge:14, journey_completed_lt:1}` | `no_journey_completed_14d` |

I copy delle suggestion (titolo, body, next-action label, CTA url path)
vivono in `editorial_blocks` namespace `tenant.launch.advisor.<key>.*`.

### 2.5 Trigger PostgreSQL (idempotenza event stream)

```sql
-- Quando un evento entra in tenant_activity_events, il trigger:
--  1) ricalcola lo stato dei task collegati;
--  2) aggiorna last_event_at su tenant_launch_state;
--  3) NON chiama servizi esterni (il backend Python intercetta
--     l'evento via LISTEN/NOTIFY o on-demand recompute).
CREATE OR REPLACE FUNCTION tlts_recompute_on_event() RETURNS TRIGGER AS $$
BEGIN
  -- Pseudocode: completa task se NEW.event_type IN task.triggered_by
  -- (implementato come SQL select-join + insert-on-conflict)
  PERFORM tenant_launch_recompute(NEW.tenant_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

La funzione `tenant_launch_recompute(uuid)` è idempotente, può essere
chiamata dal backend anche standalone (es. cron nightly).

---

## 3. EVENTI DA TRACCIARE

Tutti gli eventi entrano in `tenant_activity_events(event_type)` — la
colonna esiste già. Estendiamo solo il vocabolario.

### Catalogo completo (12 eventi)

| event_type | quando viene emesso | sorgente |
|---|---|---|
| `tenant_activated` | bootstrap del Launch Pack | `services/tenant_launch.py::bootstrap()` |
| `profile_completed` | founder salva il primo `studio_name`+logo+tagline | `routers/tenant_profile` (hook) |
| `market_verified` | founder conferma operating_market sul Blueprint settings | hook su patch settings |
| `member_invited` | INSERT su `tenant_memberships` (status='invited') | trigger DB |
| `member_accepted` | UPDATE su `tenant_memberships` (status='active', accepted_at IS NOT NULL) | trigger DB |
| `first_material_uploaded` | prima INSERT su `material_assets` per tenant | trigger DB con guard "first ever" |
| `first_project_created` | prima INSERT su `projects` per tenant | trigger DB |
| `first_journey_completed` | qualunque `projects.status='delivered'` per tenant | trigger DB |
| `first_value_delivered` | derivato: tutti i 5 task required = completed | servizio post-recompute |
| `pack_dismissed_by_founder` | founder click "Ho già esperienza, nascondi" | router PATCH |
| `health_band_changed` | derivato: cambia health_band | servizio post-recompute |
| `advisor_suggestion_resolved` | un suggested_action si risolve | servizio post-recompute |

### Idempotenza degli "first_*"
I trigger DB controllano con un `WHERE NOT EXISTS` che l'evento "first_*"
non sia già stato emesso per quel tenant, prevenendo doppie scritture.

---

## 4. HEALTH SCORE — Logic

### 4.1 Formula

```
health_score = Σ (task.weight_pct × task_state.is_completed)
             + bonus_recency
             - decay_inactivity

dove:
  task.weight_pct      → da tenant_launch_tasks
  is_completed         → 1.0 se status='completed', 0 altrimenti
  bonus_recency        → +5 se last_event_at < 7gg, 0 altrimenti
  decay_inactivity     → -10 se last_event_at > 30gg
```

Range 0–100, clamped.

### 4.2 Bande (`health_band`)

| Banda | Range | Colore UI | Significato |
|---|---|---|---|
| `cold` | 0–29 | `#FFB4A2` (warm coral) | Tenant a rischio abbandono |
| `warm` | 30–59 | `#FFD680` (amber) | Procede ma lento |
| `ready` | 60–84 | `#00C9B3` (mood teal) | Pronto al go-live |
| `thriving` | 85–100 | `#A5D689` (sage) | Riferimento per case-study |

Le soglie vivono in `tenant_launch_score_bands` (oppure JSONB su un
record `system_settings`). **Non sono hardcoded**.

### 4.3 Quando viene ricalcolato

- **On-event** (push): trigger DB su `tenant_activity_events` invoca
  `tenant_launch_recompute(tenant_id)`.
- **Nightly cron** (pull): per applicare il decay_inactivity senza
  attendere un evento.
- **On-read fallback**: il router admin/advisor, se
  `last_recomputed_at` è più vecchio di 60 min, forza ricomputo.

### 4.4 Visibilità

- **Founder**: 🚫 mai esposto.
- **Advisor (owner)**: ✅ sui propri studi via `studio_relations`.
- **Super Admin**: ✅ globale via `/command-center/launch`.

---

## 5. ADVISOR WORKFLOW

### 5.1 Pannello `Tenant Launch Advisor™`

Mount: `/command-center/launch` (route nuova, scope advisor+admin).

Layout (left-aligned, dark theme con accenti teal):

```
┌─────────────────────────────────────────────────────────────┐
│  TENANT LAUNCH ADVISOR™                                     │
│  ────────────────────────────────────────────────────────── │
│                                                             │
│  ┌──────── FUNNEL ─────────┐  ┌──── HEALTH DISTRIBUTION ──┐ │
│  │ Activated         12    │  │ ████ thriving     2       │ │
│  │ First member       8    │  │ █████ ready       5       │ │
│  │ First material     5    │  │ ███ warm          3       │ │
│  │ First project      3    │  │ ██ cold           2       │ │
│  │ First value        2    │  └────────────────────────────┘ │
│  └─────────────────────────┘                                │
│                                                             │
│  ┌────────────────────── TENANT QUEUE ──────────────────┐   │
│  │ Studio Rossi Interior · cold · 18 ────────────       │   │
│  │   ▸ Suggested: contact founder (cold_after_24h)      │   │
│  │   ▸ 0/6 tasks · 0 members · 0 projects               │   │
│  │   ▸ activated 2d ago · last event 2d ago             │   │
│  │   [open relation] [mark contacted] [dismiss]         │   │
│  │ ─────────────────────────────────────────────────    │   │
│  │ Studio Bianchi · warm · 45 ──────────                │   │
│  │   ▸ Suggested: showcase demo project                 │   │
│  │   ...                                                │   │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Filtri e ordinamento
- Filtri: `health_band`, `days_since_activated`, `has_open_suggestion`.
- Ordine default: open suggestions DESC, health_band ASC (cold first).
- Scope: advisor vede solo i tenant via `studio_relations.owner_advisor_id`;
  super-admin vede tutto.

### 5.3 Azioni
- **Open relation** → naviga alla scheda relation esistente.
- **Mark contacted** → emette evento `advisor_intervention` (audit).
- **Dismiss suggestion** → setta `resolved_at` + `resolved_reason='manually_dismissed'`.
- **Snooze 7d** → sposta `active_since` di +7gg.

### 5.4 Notifiche email all'advisor
Quando una nuova suggestion entra in stato `open` per un tenant di sua
proprietà, parte una email **CMS-driven** `tenant.launch.advisor.notify`
con summary delle suggestion attive. Rate-limited a 1/giorno per
advisor (digest), non immediata per evento, per evitare spam.

---

## 6. FOUNDER ONBOARDING UX

### 6.1 Trigger

Quando `studio_requests.status → activated`, il founder riceve la
email di Welcome (componente 1) e, al primo login, viene atterrato su
`/blueprint/launch` invece che sulla home Blueprint.

Una volta che `tenant_launch_state.pack_completed_at IS NOT NULL` OR
`pack_dismissed_at IS NOT NULL`, il route landing torna alla home
Blueprint normale.

### 6.2 Layout `/blueprint/launch`

```
┌────────────────────────────────────────────────────────────┐
│  ╮ NAVBAR BLUEPRINT (tenant chrome esistente)              │
│  │                                                         │
│  │  TENANT LAUNCH PACK                                     │
│  │  ────────────────────────                               │
│  │                                                         │
│  │  Benvenuto, {{founder_first_name}}.                     │
│  │  Il tuo Blueprint è attivo.                             │
│  │                                                         │
│  │  ┌─── COMPLETA IL TUO BLUEPRINT ─────────── 40% ─┐      │
│  │  │  ●  Completa profilo studio       fatto  ✓    │      │
│  │  │  ●  Verifica mercato principale   fatto  ✓    │      │
│  │  │  ○  Invita il primo collaboratore in corso    │      │
│  │  │  ○  Carica il primo materiale     disponibile │      │
│  │  │  ○  Crea il primo progetto        bloccato    │      │
│  │  │  ○  Completa il primo Design...   bloccato    │      │
│  │  │                                                │      │
│  │  │  [Continua da: Invita il primo collaboratore] │      │
│  │  └──────────────────────────────────────────────┘      │
│  │                                                         │
│  │  ┌─── COSA SUCCEDE ADESSO ────────────────────────┐     │
│  │  │ • Il tuo Advisor MOOD ti contatterà entro 24h. │     │
│  │  │ • Puoi invitare il tuo team subito.            │     │
│  │  │ • Le risorse della Material Library sono...    │     │
│  │  └────────────────────────────────────────────────┘     │
│  │                                                         │
│  │  ┌─── ATTIVITÀ RECENTE ──────────────────────────┐      │
│  │  │ 2h fa · Profilo studio aggiornato (Marco)     │      │
│  │  │ ieri · Blueprint attivato                     │      │
│  │  └───────────────────────────────────────────────┘      │
│  └──────────────────────────────────────────────────────────┘
```

Tutti i testi sono CMS-driven (vedi §7).
Tutti i pulsanti hanno `data-testid`.
Locale: `tenant.default_locale_code` con fallback su
`platform_languages.fallback_locale`.

### 6.3 Stati visuali per task

| status | UI |
|---|---|
| `locked` | grigio chiaro, lucchetto, hint "Completa prima X" |
| `available` | bianco/dot, cliccabile, copy "Inizia" |
| `in_progress` | accent teal, badge "In corso" |
| `completed` | dot teal solido, checkmark, data |
| `skipped` | grigio strikethrough, opzionale |

### 6.4 Comportamento "dismiss"

Founder può fare "Sono già esperto, nascondi" → setta `pack_dismissed_at`.
Da quel momento la card non riappare ma resta accessibile via
`/blueprint/launch` da link diretto, e l'advisor continua a vederla.

---

## 7. CMS NAMESPACES (no hardcoded copy)

Tutte le stringhe del Launch Pack vivono in `editorial_blocks` sotto i
seguenti namespace. Nessun fallback inglese nel codice — solo nel CMS
con `platform_languages.fallback_locale`.

### 7.1 Welcome email
| Namespace | Block keys |
|---|---|
| `email` | `tenant_launch_welcome.subject`, `.eyebrow`, `.headline`, `.body`, `.cta_label`, `.cta_url_path`, `.note`, `.signature` |
| `email` | `tenant_launch_welcome_team.*` (variante quando il founder ha già un team configurato) |

### 7.2 Checklist Founder UI
| Namespace | Block keys |
|---|---|
| `tenant.launch.ui` | `welcome.title`, `welcome.subtitle`, `checklist.title`, `checklist.progress_label`, `checklist.cta_continue`, `checklist.cta_dismiss` |
| `tenant.launch.ui` | `next_steps.title`, `recent_activity.title`, `recent_activity.empty` |
| `tenant.launch.ui` | `status.locked`, `status.available`, `status.in_progress`, `status.completed`, `status.skipped` |
| `tenant.launch.ui` | `lock_hint.<task_code>` per ogni task (es. `lock_hint.create_first_project = "Carica almeno un materiale prima."`) |

### 7.3 Task labels
| Namespace | Block keys |
|---|---|
| `tenant.launch.task` | `<task_code>.label`, `<task_code>.description`, `<task_code>.cta_label`, `<task_code>.cta_url_path` |
| Es. | `complete_profile.label = "Completa profilo studio"` |

### 7.4 Advisor suggestions
| Namespace | Block keys |
|---|---|
| `tenant.launch.advisor` | `<suggestion_key>.title`, `.body`, `.next_action_label`, `.next_action_url_path`, `.priority_label` |
| Es. | `cold_after_24h.title = "Contatta il founder"`, `.body = "{{studio_name}} è stato attivato 2 giorni fa ma non ha ancora invitato nessuno."` |

### 7.5 Health Score
| Namespace | Block keys |
|---|---|
| `tenant.launch.health` | `band.cold.label`, `band.warm.label`, `band.ready.label`, `band.thriving.label`, `band.cold.advisor_hint`, ... |
| `tenant.launch.health` | `score.title`, `score.description` (usate solo lato Advisor) |

### 7.6 Interpolazione variabili
Le variabili supportate sono allineate al sistema email esistente:
`{{studio_name}}`, `{{founder_first_name}}`, `{{founder_email}}`,
`{{reference}}`, `{{team_size}}`, `{{project_count}}`,
`{{material_count}}`, `{{days_since_activated}}`,
`{{operating_market_label}}`, `{{magic_link_url}}`.

### 7.7 Locale resolution
Per ogni stringa: `platform_languages.fallback_locale` chain →
prima traduzione disponibile per `tenant.default_locale_code` (es.
`it-IT` → `en-US` → source value).

---

## 8. API SURFACE (read-only specs, no implementation yet)

### 8.1 Pubblici al founder (require_tenant_member)
| Metodo | Path | Note |
|---|---|---|
| GET  | `/api/blueprint/launch/state` | dict con progress, task_state[], recent_events[] |
| POST | `/api/blueprint/launch/task/{code}/start` | sets status='in_progress' (manual flag) |
| POST | `/api/blueprint/launch/task/{code}/skip` | sets status='skipped' (audit) |
| POST | `/api/blueprint/launch/dismiss` | sets `pack_dismissed_at` |

### 8.2 Advisor/Admin (require_advisor_scope)
| Metodo | Path | Note |
|---|---|---|
| GET   | `/api/admin/launch/pipeline` | aggregato tenant con health + suggestions (scoped) |
| GET   | `/api/admin/launch/tenant/{id}` | dettaglio completo (task_state + events + suggestions) |
| POST  | `/api/admin/launch/suggestion/{id}/dismiss` | risolve manualmente |
| POST  | `/api/admin/launch/suggestion/{id}/snooze` | +7gg |
| POST  | `/api/admin/launch/tenant/{id}/recompute` | force recompute health_score |

### 8.3 Catalog management (admin only)
| Metodo | Path | Note |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/admin/launch/tasks` | CRUD su `tenant_launch_tasks` |
| GET/POST/PATCH/DELETE | `/api/admin/launch/rules` | CRUD su `advisor_suggestion_rules` |

---

## 9. PIANO IMPLEMENTAZIONE

Spezzato in 5 milestone testabili, ciascuna autoportante.

### M1 — Foundation (1 sprint) — *Backend + DB*
- Migration 031: 4 tabelle additive.
- Seed iniziale: 6 task, 4 advisor rules.
- CMS seed: namespace `tenant.launch.*` (it-IT + en-US).
- Service `services/tenant_launch.py`:
  - `bootstrap(tenant_id)`
  - `recompute(tenant_id)`
  - `get_state(tenant_id)`
- Router `/api/blueprint/launch/*` (read-only).
- Trigger DB su `tenant_activity_events` per recompute.
- Unit tests: idempotenza bootstrap, recompute deterministico, weight sum = 100.

**Done quando**: chiamata API `GET /api/blueprint/launch/state` per un
tenant attivato torna progress=0 e i 6 task = 1×available + 5×locked.

### M2 — Welcome Email + Bootstrap hook (0.5 sprint)
- Hook su `update_request_status(status='activated')` → chiama
  `tenant_launch.bootstrap()`.
- CMS seed `email.tenant_launch_welcome.*` (subject, body, CTA).
- Variant `tenant_launch_welcome_team` (con team_size>0).
- E2E test: submit → qualify → activate → verifica `tenant_launch_state`
  esiste + email welcome inviata.

**Done quando**: il test `test_tenant_launch_bootstrap.py` passa.

### M3 — Founder UI (1 sprint) — *Frontend Blueprint*
- Route `/blueprint/launch` con guard.
- Component `LaunchPackCard.jsx`, `ChecklistTask.jsx`,
  `RecentActivity.jsx`.
- Hook `useLaunchState()` con polling 30s + WebSocket optional.
- CMS hook `useTenantLaunchCopy()` con caching.
- Dismiss flow.
- Smoke test screenshot + Playwright happy path.

**Done quando**: founder vede la dashboard con 6 task DB-driven,
completa "complete_profile" via UI esistente, vede progress che sale.

### M4 — Health Score + Advisor Suggestions (1 sprint)
- Funzione `compute_health_score(tenant_id)` in service.
- Cron nightly (supervisor scheduler o backend-startup task).
- Predicate evaluator per `advisor_suggestion_rules.predicate`.
- API `/api/admin/launch/pipeline` aggregato.
- Frontend `/command-center/launch`: pannello "Tenant Launch Advisor™".
- Test: per ogni rule seedata, costruisci un tenant fixture che la
  attiva, verifica che la suggestion entri in `advisor_suggested_actions`.

**Done quando**: `cold_after_24h` per Studio Rossi appare nel pannello
advisor (con relation di test) entro 24h simulati.

### M5 — Catalog Admin UI + Polish (0.5 sprint)
- Command Center: pagina admin per gestire `tenant_launch_tasks` e
  `advisor_suggestion_rules` (CRUD form).
- Validatore: somma `weight_pct` deve essere 100, altrimenti warning.
- Audit log per ogni edit.
- Localizzazione di tutto il pack: `it-IT` + `en-US` complete; placeholder
  per `fr-FR`/`de-DE`/`es-ES` per quando saranno enabled.
- Performance: ricomputo health_score < 50ms per tenant; pipeline
  endpoint < 500ms per 100 tenant.

**Done quando**: aggiungere un nuovo task ("Connect calendar") da UI
admin lo rende visibile su tutti i Founder al login successivo, senza
deploy.

---

## 10. RISK & MITIGATION

| Rischio | Mitigazione |
|---|---|
| Doppia bootstrap su retry email | `UNIQUE(tenant_id)` su `tenant_launch_state` |
| Eventi "first_*" duplicati | Trigger DB con `WHERE NOT EXISTS` |
| Suggestion noise (troppi advisor email) | Digest 1×/giorno + dedup `UNIQUE(tenant_id, rule_code)` |
| Founder vede health_score | Endpoint `/api/blueprint/launch/state` NON espone score; rate-limited; controllo scope a livello router |
| Cambio peso task in produzione | Recompute massivo via job batch, non manuale |
| Predicate JSONB complesso/non-validato | Schema JSON in `advisor_suggestion_rules.predicate` con validazione Pydantic lato API |
| Tenant con `tenant_onboarding` esistente (legacy) | Migration di adattamento: mappa booleani esistenti → `tenant_launch_task_state` al primo recompute |

---

## 11. NON-GOAL (FUORI SCOPE)

Esplicitamente **NON** in questo sprint, per evitare scope creep:

- ❌ Notifiche push lato founder (in-app only, no real-time).
- ❌ Slack/Discord integrations per advisor.
- ❌ Gamification (badge, achievements).
- ❌ A/B test framework per task copy.
- ❌ "Pause Pack" per tenant in vacanza/freeze.
- ❌ Multi-tenant launch comparison ("benchmarking").

Tutti questi sono potenziali iterazioni successive — il piano resta
focalizzato su "first value delivered" come singolo KPI Nord.

---

## 12. DECISIONI APERTE (richiesta input utente)

### D1 — Magic link nel Welcome email
La email Welcome contiene un CTA "Apri Blueprint". Deve includere:
- a) Magic link riusabile (zero attrito, expire 30 giorni).
- b) Magic link one-shot (sicurezza alta, expire 1 ora).
- c) Solo URL `/accedi` (founder deve loggarsi).

**Proposta**: **a)** allineato al pattern già usato per
`access_magic_links` post-activation.

### D2 — Default `health_band` per tenant appena attivati
- a) `cold` (default conservativo, l'advisor vede subito di doversi
  attivare).
- b) `warm` (neutral, evita panico).

**Proposta**: **a)**.

### D3 — `pack_dismissed_at` reversibile?
- a) Sì, founder può riattivarlo da Settings.
- b) No, una volta dismissed resta dismissed.

**Proposta**: **a)** — opzione "Rivedi il Launch Pack" nel menu del
profilo.

### D4 — Eventi "first_journey_completed"
Il concetto di "Design Journey" è multi-step (brief → moodboard →
material picks → render → delivery). Quando consideriamo "completed"?
- a) `projects.status = 'delivered'` (semplice, oggi disponibile).
- b) Tutti gli step del journey checkpointati (richiede definizione
  separata di "journey" come entità).

**Proposta**: **a)** per M1-M5; **b)** in fase post-M5 quando il modello
Design Journey sarà esplicito.

### D5 — Advisor digest cadence
- a) 1×/giorno (08:00 nel timezone advisor).
- b) 2×/giorno (08:00 + 16:00).
- c) Solo immediato (no digest).

**Proposta**: **a)**.

### D6 — Locale per founder appena attivato
- a) Eredita da `studio_requests.locale` (es. `it-IT`).
- b) Forza `tenant.default_locale_code` impostato in fase di
  qualification.

**Proposta**: **a)** in M1-M2; aggiungiamo override admin nel M5.

### D7 — Migration scope
- a) Migration 031 con tutte le 4 tabelle (proposto).
- b) 4 migration separate per granularità rollback.

**Proposta**: **a)** — la migration è additiva e idempotente, una
singola transazione è più sicura del rollback parziale.

---

## 13. CHECKLIST APPROVAZIONE

Servono OK su:

- [ ] **Architettura** §1 (event-sourced, read-model derivato)
- [ ] **Schema DB** §2 (4 tabelle additive, nessuna ALTER su esistenti)
- [ ] **Catalogo eventi** §3 (12 eventi, vocabolario condiviso)
- [ ] **Health Score** §4 (formula, bande, visibilità)
- [ ] **Advisor workflow** §5 (pannello, filtri, azioni, digest)
- [ ] **Founder UX** §6 (`/blueprint/launch`, stati task, dismiss)
- [ ] **CMS namespaces** §7 (`tenant.launch.*`)
- [ ] **API surface** §8
- [ ] **Roadmap 5 milestone** §9 (~3.5 sprint totali)
- [ ] **Decisioni D1-D7** §12

STOP. Attendo approvazione punto-per-punto o OK globale.
Zero codice fino al tuo via libera.
