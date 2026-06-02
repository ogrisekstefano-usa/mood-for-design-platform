# RELATIONSHIP OS™ — IMPLEMENTATION ROADMAP (M0 → M5)
> Roadmap operativa con scopo, deliverable, API surface, file impattati,
> acceptance criteria e rischi per ogni milestone.
> Schema canonico approvato in `RELATIONSHIP_OS_FOUNDATION_PLAN.md` (v2).
> Scale target: 150 tenant · 500+ contatti · advisor multipli.

**Classificazione architetturale**: 🟢 `FOUNDATION_READY`
**Effort totale aggiornato**: ~24.5 giorni-uomo (+2g vs piano v1 per
isolation founder D4 + scale-readiness)

---

## SOMMARIO MILESTONES

| M | Nome | Effort | Dipende da | Output verificabile |
|---|---|---|---|---|
| M0 | DB Consolidation | **3.5d** | — | Migration 031 + 3 cataloghi seed + decisioni canonical |
| M1 | Contact CRM ⭐ | **5d** | M0 | CRUD multi-contatto admin+founder, anti-duplicato, primary unique |
| M2 | Relationship Timeline | **3.5d** | M0, M1 (per contact links) | View `v_relationship_timeline` + UI Tab in 2 surfaces |
| M3 | Activity Log | **3d** | M0, M1 (contact_id FK) | Activity CRUD + upcoming widget + due reminders |
| M4 | Notification Center | **5d** | M0–M3 (trigger sources) | 🔔 badge in topbar, 7 trigger automatici, dedup idempotency |
| M5 | Advisor Workspace + KPI | **4.5d** | M0–M4 | Advisor KPI bar + Tenant Overview unified endpoint |

**Totale**: ~24.5 giorni-uomo

---

## M0 · DB CONSOLIDATION

### Scopo
Stabilire fondamenta DB definitive prima di toccare il codice.

### Deliverable
1. Migration `db/migrations/031_relationship_os_foundation.sql`
   - 3 tabelle catalog (`platform_relationship_event_types`,
     `platform_contact_roles`, `platform_activity_types`)
   - 2 tabelle dati (`tenant_contacts`, `relationship_activities`)
   - ALTER `studio_relationship_events` (+`tenant_id`, +`event_type_code`)
   - +2 indici partial su `relationship_notifications`
   - 1 vista `v_relationship_timeline` (con whitelist D5)
2. Seed scripts (eseguiti UNA volta, idempotenti):
   - `backend/scripts/seed_relationship_event_types.py` (20 codici)
   - `backend/scripts/seed_contact_roles.py` (12 codici approvati)
   - `backend/scripts/seed_activity_types.py` (8 codici)
3. Backfill leggero:
   - `studio_relationship_events.tenant_id` derivato dal `studio_relations.tenant_id`
   - `studio_relationship_events.event_type_code` mappato da `kind` storico
4. Marker LEGACY READ-ONLY (D2):
   - Aggiungere `COMMENT ON TABLE` su `contacts`, `accounts`, `studio_team_members`, `notifications`, `tenant_activity_events`, `advisor_lead_activities`, `advisor_notes`: `'LEGACY · READ-ONLY · Replaced by tenant_contacts/relationship_activities/relationship_notifications (Plan v2, 2026-06-02)'`
   - Optional: `REVOKE INSERT, UPDATE, DELETE ON ... FROM PUBLIC` (da valutare in M0 review)

### File impattati
| File | Tipo |
|---|---|
| `backend/db/migrations/031_relationship_os_foundation.sql` | NEW |
| `backend/scripts/seed_relationship_event_types.py` | NEW |
| `backend/scripts/seed_contact_roles.py` | NEW |
| `backend/scripts/seed_activity_types.py` | NEW |
| `backend/scripts/run_migration_031.py` | NEW (runner one-shot) |

### API surface
*Nessuna nuova rotta in M0.* Solo `GET /api/catalogs/:name?locale=it-IT`:
- `:name` ∈ {`contact-roles`, `activity-types`, `relationship-event-types`, `languages`, `markets`, `countries`}
- Cache 60s lato server in `services/catalogs.py` (NEW)
- Risposta: `[{ code, label, icon?, ... }]`

### Acceptance criteria
- ✅ Migration applicata in idempotenza (re-run safe)
- ✅ 20 + 12 + 8 = 40 righe seed inserite
- ✅ `v_relationship_timeline` interrogabile (anche se vuota su `relationship_activities`)
- ✅ Audit script `first_real_tenant_audit.py` ancora `0 P0`
- ✅ Nessuna scrittura nelle tabelle LEGACY (verificato via grep su codebase)

### Effort: **3.5 giorni** (backend 2 · DB 1 · QA 0.5)

### Rischi
- 🟡 Backfill `event_type_code`: alcuni `kind` storici potrebbero non avere mapping → fallback `code='legacy_unknown'`
- 🟢 Volumi attuali (38 eventi, 19 relations) → migration sub-secondo

---

## M1 · CONTACT CRM ⭐ (priorità assoluta)

### Scopo
Sapere sempre **chi è chi** dentro ogni tenant. Multi-contatto con
ruoli DB-driven. Founder gestisce i propri contatti.

### Deliverable
1. Service `backend/services/contacts.py`:
   - `list_contacts(tenant_id, *, status, role_code, q)`
   - `create_contact(tenant_id, payload, actor_user_id)` → dedup su `(tenant_id, lower(email))`
   - `update_contact(contact_id, payload, actor_user_id, *, scope)`
   - `archive_contact(contact_id, actor_user_id, *, scope)`
   - `set_primary(contact_id, actor_user_id, *, scope)` → unset altri + indice unique partial
   - Emette `tenant_relationship_events` con kind `contact_added`/`contact_archived`
   - Updates `last_activity_at` su `tenant_contacts` e `studio_relations`
2. Router `backend/routers/tenant_contacts.py`:
   - Admin scope: `/api/admin/tenants/:tid/contacts/*`
   - Founder scope: `/api/blueprint/contacts/*` (forces `tid = me.tenant_id`)
3. Frontend admin: pagina `frontend/src/admin/pages/TenantContacts.jsx`
   - Mounted at `/command-center/tenants/:tid/contacts`
   - Tabella, filtri (ruolo, status), form modal create/edit
4. Frontend founder: pagina `frontend/src/blueprint/pages/ContactsPage.jsx`
   - Mounted at `/blueprint/contacts`
   - Stessa UX, scope automatico
5. Catalog hook: `frontend/src/lib/useCatalog.js` (cached 60s lato client)

### API surface (admin)
| Verb | Path | Body |
|---|---|---|
| GET | `/api/admin/tenants/:tid/contacts?status=&role=&q=` | — |
| POST | `/api/admin/tenants/:tid/contacts` | `{ first_name, last_name?, role_code, email?, phone_prefix?, phone_number?, linkedin_url?, notes?, preferred_language?, is_primary?, studio_relation_id? }` |
| PATCH | `/api/admin/tenants/:tid/contacts/:cid` | partial |
| DELETE | `/api/admin/tenants/:tid/contacts/:cid` | (archive) |
| POST | `/api/admin/tenants/:tid/contacts/:cid/set-primary` | — |

### API surface (founder — D4)
| Verb | Path | Note |
|---|---|---|
| GET | `/api/blueprint/contacts?status=&role=` | scope: me.tenant_id |
| POST | `/api/blueprint/contacts` | scope-locked tenant_id |
| PATCH | `/api/blueprint/contacts/:cid` | check tenant ownership |
| DELETE | `/api/blueprint/contacts/:cid` | check tenant ownership |
| POST | `/api/blueprint/contacts/:cid/set-primary` | check tenant ownership |

### Acceptance criteria
- ✅ 12 ruoli del catalog selezionabili nel form (sorted DB-driven)
- ✅ Anti-duplicato su `(tenant_id, lower(email))` → 409 con suggerimento merge
- ✅ Solo 1 `is_primary=TRUE` per tenant attivo (test via unique index)
- ✅ Founder non può accedere a `/api/blueprint/contacts` di altri tenant → 403/404
- ✅ Founder non può cambiare `studio_relation_id.owner_advisor_id` indirettamente
- ✅ E2E test: founder crea 5 contatti (founder, marketing, purchasing, architect, supplier) → tutti visibili in `/blueprint/contacts`
- ✅ Lo stesso tenant da admin vede gli stessi 5 contatti
- ✅ Studio Requests UI mostra link "Vedi contatti tenant" → naviga a `/command-center/tenants/:tid/contacts`

### Effort: **5 giorni** (backend 2 · frontend 2.5 · QA 0.5)

### Rischi
- 🟡 Founder isolation: ogni endpoint deve usare `require_admin_tenant` (che già scope-locka su tenant). Aggiungere test specifico cross-tenant.
- 🟡 Performance lista: con 500+ contatti/tenant in futuro → paginare default `limit=50`
- 🟢 Catalog roles: sort_order DB-driven evita hardcode

---

## M2 · RELATIONSHIP TIMELINE

### Scopo
Vista unificata cronologica di eventi lifecycle + email ad alto valore +
attività manuali. Filtrata via whitelist D5.

### Deliverable
1. Service `backend/services/timeline.py`:
   - `list_timeline(tenant_id, *, since=None, limit=50, cursor=None)`
   - Pagina via cursor (`occurred_at DESC`)
   - Risolve `type_code` → label localizzata via catalog
2. Router (read-only):
   - `GET /api/admin/tenants/:tid/timeline?since=&limit=&cursor=`
   - `GET /api/blueprint/timeline?since=&limit=&cursor=`
3. Frontend: `<TimelineFeed tenantId>` component
   - Mount in `RelationDetail.jsx` (tab Timeline) — sostituisce eventi vecchi
   - Mount in nuova `TenantOverview` (M5)
   - Mount in `/blueprint/overview` (M5, founder)
4. Writer hooks (eventi nuovi):
   - `magic_link_issued` in `services/studio_activation.activate_studio_ecosystem`
   - `magic_link_consumed` in `routers/auth.magic_link_consume`
   - `blueprint_first_access` in middleware mount BlueprintApp
   - `contact_added` / `contact_archived` (già da M1)
   - `activated` (rinominare evento attuale per allinearsi al catalog)

### Acceptance criteria
- ✅ Founder vede solo la propria timeline (tenant_id scope)
- ✅ Timeline non mostra `password_set`, `password_reset_requested`, `temperature_changed` (show_in_timeline=FALSE)
- ✅ Email tecniche (open/click/retry) NON appaiono — verificato che `v_relationship_timeline` whitelist 7 template
- ✅ Performance: paginazione cursor-based, 50/page → <100ms con 10k eventi
- ✅ E2E Martinel: dopo full pipeline (submit→review→qualify→activate→consume), timeline mostra 7 voci attese (request_submitted, review, qualification, activated, magic_link_issued, magic_link_consumed, request_received_email)

### Effort: **3.5 giorni** (backend 1.5 · frontend 1.5 · QA 0.5)

### Rischi
- 🟡 La vista `v_relationship_timeline` con 3 UNION ALL su 17k+ righe può degradare → index `idx_relationship_events_tenant_when` + `idx_relationship_activities_tenant_when` essenziali (creati in M0)
- 🟡 Locale-aware: il `type_code` → label deve risolvere `it-IT`/`en-US`. Done via catalog.
- 🟢 La whitelist email è in vista, modificabile senza redeploy

---

## M3 · ACTIVITY LOG

### Scopo
Registrazione attività commerciali. Reminders e next-step.

### Deliverable
1. Service `backend/services/activities.py`:
   - CRUD `relationship_activities`
   - `list_upcoming(owner_user_id, days=7)` per "Le mie attività"
   - `list_overdue(owner_user_id)` per badge urgency
   - Emette `studio_relationship_events.note_added` quando `activity_type_code='internal_note'`
2. Router:
   - Admin: `/api/admin/tenants/:tid/activities/*`
   - Founder: `/api/blueprint/activities/*` (D4 — scope-locked)
   - Personal: `/api/me/activities/upcoming?days=7`
3. Frontend components:
   - `<ActivityForm>` — modal: tipo (catalog), contact (M1), subject, outcome, next_step, due_at, duration_min
   - `<ActivityList tenantId>` — tabella filtrata per tipo/owner/data
   - `<UpcomingTasksWidget>` — riusabile in AdvisorConsole + TenantOverview
4. Frontend mounts:
   - Tab "Attività" in `TenantOverview` (M5 placeholder)
   - Tab "Le mie attività" in `AdvisorConsole`

### Acceptance criteria
- ✅ 8 tipi catalog selezionabili
- ✅ `next_step_due_at` opzionale → se set, appare in `/api/me/activities/upcoming`
- ✅ Founder può CRUD le proprie attività (D4)
- ✅ Attività con `activity_type_code='internal_note'` create da Founder hanno `visibility='founder'`; advisor vede tutte
- ✅ Cron job idempotente `services/activities_reminder.py` (M3 deliverable: solo lo skeleton, no email send qui — quello arriva in M4)

### Effort: **3 giorni** (backend 1 · frontend 1.5 · QA 0.5)

### Rischi
- 🟡 Visibility `internal_note`: serve un campo `visibility TEXT DEFAULT 'all'` su `relationship_activities`? Da decidere in M3 kickoff (potenziale +0.5d schema patch)
- 🟢 Volume previsto (~9k/anno) → indici sufficienti

---

## M4 · NOTIFICATION CENTER

### Scopo
Notifiche interne (no email). Badge 🔔 in topbar. Trigger automatici.

### Deliverable
1. Service `backend/services/notifications.py`:
   - `emit(recipient_user_id, recipient_type, notification_type, payload, *, tenant_id, lead_id, action_url)` con dedup idempotente (hash payload + type + recipient + window 1h)
   - `list_for_user(user_id, *, unread_only=False, limit=20, cursor=None)`
   - `mark_read(notification_id, user_id)`
   - `mark_all_read(user_id)`
   - `archive(notification_id, user_id)`
   - `unread_count(user_id)` — risposta cheap (<10ms con index)
2. Router `/api/notifications/*`:
   - GET `/api/notifications?unread=&limit=&cursor=`
   - GET `/api/notifications/unread-count` (cheap, polled ~30s)
   - POST `/api/notifications/:id/read`
   - POST `/api/notifications/read-all`
   - POST `/api/notifications/:id/archive`
3. Trigger emitters (7 trigger):
   | Trigger | Recipient | Tipo |
   |---|---|---|
   | Nuova candidatura V2 | super-admin + advisor pool | `studio_request_received` |
   | Lead senza review >48h | super-admin | `lead_stale` (cron giornaliero) |
   | Tenant attivato | owner + advisor + super-admin | `tenant_activated` |
   | Founder primo login | advisor + super-admin | `founder_first_login` |
   | Activity `next_step_due_at` <24h | owner attività | `task_due_soon` (cron orario) |
   | Activity `next_step_due_at` < NOW | owner attività | `task_overdue` (cron orario) |
   | Contact archiviato | advisor del tenant | `contact_archived` |
4. Frontend:
   - `<NotificationBell />` in `WorkspaceShell` topbar
   - Polling 30s di `unread-count`
   - Slide-out `<NotificationPanel />` raggruppato per giorno
   - Pulsanti "Mark all read" / "Archive"
   - `action_url` → react-router navigate

### Acceptance criteria
- ✅ Quando un test E2E crea una candidatura V2 → super-admin riceve notifica entro 5s
- ✅ Dedup: 2 candidature dello stesso tenant in 1h → 1 sola notifica (collapsed count)
- ✅ Polling 30s: badge si aggiorna entro 30s (max)
- ✅ Founder vede solo le proprie notifiche (recipient_user_id = me)
- ✅ Mobile: badge visibile anche su viewport <768px

### Effort: **5 giorni** (backend 2.5 · frontend 1.5 · cron 0.5 · QA 0.5)

### Rischi
- 🔴 Trigger su volume: a 150 tenant × ~20 trigger/giorno = 3k notifiche/giorno. Indice `idx_relationship_notifications_recipient_unread` essenziale (creato in M0)
- 🟡 Cron jobs: usare APScheduler in-process (già usato per email retry) → no nuovo servizio
- 🟡 Idempotency window 1h: se troppo aggressivo, perde notifiche legittime. Default conservativo → window 10 min per `task_*`, 1h per `lead_*`/`founder_*`
- 🟢 La tabella `relationship_notifications` è già pronta (17 cols, 0 righe)

---

## M5 · ADVISOR WORKSPACE + KPI + TENANT OVERVIEW

### Scopo
Dashboard advisor (KPI + upcoming). Tenant Overview aggregato.

### Deliverable
1. Backend: `GET /api/admin/me/advisor-kpi`
   - Risposta: `{ leads_open, reviews_pending, tenants_active, recent_activities_7d, reminders_today }`
   - Singola query con CTE
2. Backend: `GET /api/admin/tenants/:tid/overview`
   - Risposta aggregata: `{ tenant, relation, primary_contact, contacts_count, advisor, kpis, recent_timeline_5, upcoming_activities_5 }`
3. Backend: `GET /api/blueprint/overview` (founder)
   - Stesso shape ma scope-locked
4. Frontend:
   - `<AdvisorKPIBar />` mounted in cima ad `AdvisorConsole`
   - Pagina nuova `frontend/src/admin/pages/TenantOverview.jsx` → tabs:
     - Studio (header)
     - Contatti (Modulo 1)
     - Timeline (Modulo 2)
     - Attività (Modulo 3)
     - Advisor (owner + commission rules + visits)
     - Mercati (operating + targets, editable da founder se D4)
     - Blueprint Status (pages count, last publish, last access)
     - Ultimo accesso (users.last_login_at)
   - Mount route `/command-center/tenants/:tid` (admin) e `/blueprint/overview` (founder)
   - Sidebar Command Center: nuova voce "Tenants" → lista con search/filter, click → TenantOverview

### Acceptance criteria
- ✅ KPI bar carica <300ms con 150 tenant
- ✅ Tenant Overview unico endpoint anti-N+1 (~1 query CTE complessa)
- ✅ Founder accede solo a proprio `/blueprint/overview`
- ✅ Click "Vedi tutta la timeline" → naviga a tab Timeline pieno
- ✅ Test E2E Martinel: dashboard advisor mostra "1 tenant attivo · 1 lead aperto · 7 attività recenti"

### Effort: **4.5 giorni** (backend 2 · frontend 2 · QA 0.5)

### Rischi
- 🟡 Query aggregata CTE con 8 sotto-query → planning su EXPLAIN ANALYZE in M5 kickoff
- 🟢 Già esiste `CommandOverview` come modello UX di riferimento

---

## EFFORT AGGIORNATO — RIEPILOGO

| M | Effort (giorni-uomo) | Cumulato |
|---|---|---|
| M0 DB Consolidation | 3.5 | 3.5 |
| M1 Contact CRM ⭐ | 5.0 | 8.5 |
| M2 Timeline | 3.5 | 12.0 |
| M3 Activity Log | 3.0 | 15.0 |
| M4 Notification Center | 5.0 | 20.0 |
| M5 Advisor + Overview | 4.5 | 24.5 |
| **Totale** | **24.5d** | — |

> +2 giorni vs piano v1 dovuti a: (a) doppia API admin/founder per D4
> tenant isolation, (b) trigger emitter su 7 eventi anziché 6, (c) scale
> indexing su 150 tenant.

---

## DIPENDENZE INTER-MILESTONE

```
M0 ─┬─► M1 ─┬─► M2 ─┬─► M5
    │       │       │
    │       └─► M3 ─┴─► M4
    │               │
    └──────────────►┘  (M4 emitters dipendono da M0 catalog + M3 activities)
```

- M1 dipende da M0 (catalog `contact_roles` + tabella `tenant_contacts`)
- M2 dipende da M0 (vista) e M1 (FK contact_id opzionale)
- M3 dipende da M0 (catalog) e M1 (contact_id FK)
- M4 dipende da M0 (relationship_notifications indici), M1 (trigger contact_archived), M3 (trigger task_due/overdue)
- M5 dipende da tutti (assembla i pezzi)

> M2 e M3 possono essere implementati in **parallelo** dopo M1. Riduce a
> ~21 giorni-uomo se 2 sviluppatori in parallelo M2+M3.

---

## RISCHI TRASVERSALI

| Rischio | Sev | Mitigazione |
|---|---|---|
| 🔴 Regressione tenant isolation founder (D4) | Alto | Test E2E per ogni endpoint `/api/blueprint/*` con JWT cross-tenant → 403 |
| 🔴 Performance vista timeline a 17k+ righe | Medio | Indici partial creati in M0, paginazione cursor-based, monitor EXPLAIN |
| 🟡 Notification storm su tenant attivato | Medio | Idempotency window + payload hash deduplication |
| 🟡 Catalog cache invalidation | Basso | Cache 60s lato client + endpoint admin `POST /api/catalogs/:name/invalidate` |
| 🟡 Founder UI design da scratch (`/blueprint/contacts`) | Medio | Riusare componenti Command Center; design language identico |
| 🟢 Migration backfill `event_type_code` | Basso | Fallback `legacy_unknown` per kind non mappati |
| 🟢 Cron in-process | Basso | APScheduler già in uso per email retry |

---

## ROLLOUT STRATEGY

### Per ciascun M:
1. **Branch**: `feature/relationship-os-m<n>-<name>`
2. **Migration first**: applicata su preview, test idempotency
3. **Backend service + router**: unit test pytest
4. **Frontend**: componenti + screenshots
5. **E2E**: testing_agent_v3_fork con scenario "Martinel 2.0"
6. **Acceptance review**: utente conferma su preview
7. **Merge to main** → user deploys to production via Save to Github

### NO BIG BANG
Ogni M è **deployabile da solo**. M0 dà fondamenta senza UI; M1
sblocca CRM senza richiedere M2+; etc. Questo permette go-live
incrementali con feedback reale tra milestones.

---

## ACCEPTANCE GLOBALE (post-M5)

Test E2E `relationship_os_e2e.py` (NEW, parte di M5):
1. Studio V2 submit "Atelier Verde Architecture" (Roma → DE+FR)
2. Admin review → activate
3. Founder consume magic link
4. Founder crea 4 contatti: Founder, Owner, Marketing, Purchasing
5. Founder crea attività "Call introduttiva con MOOD advisor" con `next_step_due_at=+3d`
6. Advisor riceve notifica `tenant_activated` + `founder_first_login` + `task_due_soon`
7. Advisor apre Tenant Overview → vede 4 contatti, 1 attività upcoming, timeline con 7 voci
8. Advisor crea Call con outcome positivo
9. Founder vede la Call nella sua timeline
10. Test isolation: Founder NON vede contatti/attività/notifiche del tenant "studio" (corporate)

Tutti i 10 step devono passare per dichiarare il Relationship OS™ MVP completo.

---

## VERDETTO FINALE

🟢 **`FOUNDATION_READY`**

Le 5 decisioni architetturali sono ratificate, la roadmap è
operativa, ogni milestone è scopo-limitato e testabile, le
dipendenze sono mappate, i rischi sono mitigati. **L'implementazione
può partire da M0 con un singolo "Vai"** dell'utente.

> Consiglio operativo: aprire prima M0 da solo (3.5g), poi rivedere
> insieme prima di confermare M1. Le decisioni di M0 (es. `visibility`
> su `relationship_activities`, indici LEGACY revoke) potrebbero
> spostare leggermente l'effort di M3-M4.

---

*Generato il 2 Giu 2026 da E1 (Emergent), su istruzione utente
"APPROVAZIONE ARCHITETTURALE — RELATIONSHIP OS™ FOUNDATION".*
*Nessuna migration eseguita. Nessuna feature implementata. Solo roadmap operativa.*
