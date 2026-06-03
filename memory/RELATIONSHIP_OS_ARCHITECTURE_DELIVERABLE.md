# MOOD · Relationship OS — Architecture Deliverable

**Versione**: 1.0 · **Data**: 03 Giugno 2026 · **Stato**: ⏸ In attesa di approvazione · **NON IMPLEMENTATO**

---

## 0 · Cambio di paradigma

| Prima (rifiutato)                                  | Ora                                                              |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| Editorial product · "Diario" · "Relazioni"         | **Relationship Operating System** per il design industry         |
| Magazine layout, prose interface                   | Salesforce / Hubspot / Linear / Notion / Attio                   |
| Tipografia che domina il dato                      | Dato denso + tipografia premium come *brand layer*               |
| Una pagina = una storia                            | Una pagina = uno strumento operativo                             |
| Scala male oltre 50 attività                       | Progettato per scalare 20K attività · 500 studi · 50 advisor     |

**Brand identity MOOD preservata**: shell `#0A0A0B`, Playfair Display *solo* per headline pagine/account/KPI numerici "luxury", Montserrat per UI chrome, accento `#00C9B3`. Niente più Playfair che mangia i dati.

---

## 1 · Information Architecture

Tre ambienti distinti, una sola estetica:

```
MOOD platform
│
├── /command-center/*           ← admin / staff MOOD (super-admin, content team)
│   ├── overview                  KPI globali piattaforma
│   ├── studios                   tutti i tenant (lista + filtri)
│   │   └── studios/{tid}        RELATIONSHIP CENTER  ← cuore CRM
│   ├── advisors                  gestione team advisor
│   ├── studio-requests           lead inbox V2 funnel
│   ├── activations               pipeline kanban attivazioni
│   ├── activity-log              log globale tutte le attività
│   └── follow-ups                queue globale follow-up
│
├── /workspace/*                 ← ADVISOR WORKSPACE (NEW · M5)
│   ├── dashboard                 KPI personali + studios + follow-ups + commissions
│   ├── studios                   "my studios" assegnati
│   │   └── studios/{tid}        Relationship Center filtrato sul perimetro advisor
│   ├── activities                "my activities"
│   ├── follow-ups                "my follow-ups"
│   ├── notifications             "my notifications" (mirror filter del bell drawer)
│   ├── commissions               foundation revenue tracking
│   └── introductions             pending lead da accettare
│
└── /blueprint/*                 ← FOUNDER (workspace tenant)
    ├── overview                  Relationship Center founder-scope
    ├── activities                solo proprie attività
    ├── pages / blocks / …        CMS editoriale (esistente)
    └── settings
```

**Globale (cross-shell)**: Notification Drawer (M4) accessibile via 🔔 in topbar — sempre presente in `/command-center/*` e `/workspace/*`.

---

## 2 · Sitemap dettagliata Relationship OS

### 2.1 Studio Detail (Command Center) → **Relationship Center**

Layout fisso 3 colonne dentro lo shell scuro:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ TOPBAR  Studios › Martinel Interior Design · ● Active                ⌕ ⌘K  🔔12  │
├──────────────────────────────────────────────────────────────────────────────────┤
│ ACCOUNT HEADER                                                                   │
│ Martinel Interior Design                                  [Edit] [Add contact]  │
│ Tenant · Pordenone, IT · EU · 12 contatti                 [+ Nuova attività]    │
│                                                                                  │
│ KPI STRIP  Status · Owner · Health · Last Activity · Open FU · Contacts · ...   │
├──────────────────────────────────────────────────────────────────────────────────┤
│ TABS  Relationship Center | Contacts (12) | Activities (347) | Timeline | ...    │
├─────────────┬───────────────────────────────────────────────────┬────────────────┤
│ CONTACTS    │ ACTIVITY TIMELINE                                 │ FOLLOW-UP      │
│ (280px)     │ (fluid)                                           │ QUEUE (340px)  │
│             │                                                   │                │
│ ─ Founders  │ [All|Calls|Emails|Meetings|Notes|Tasks] [+filtri] │ OVERDUE   2    │
│   • Mario   │ ────────────────────────────────────────────────  │ ▌ Giulia B.    │
│     PRIMARY │ Oggi · Mer 3 Giu                                  │ ▌ Luca Conti   │
│   • Elena   │ 14:30  ☎ Call · Mario Rossi · Discussione...      │                │
│ ─ Architects│        Esito · Note · Prossimo passo (expand)     │ TODAY     1    │
│   • Luca C. │ 11:05  ✉ Email · Giulia Bianchi · Proposta...     │ ▎ Brief Sara   │
│   • Sara P. │ 10:22  ⌬ WA · Sara Pellegrini · "Perfetto..."     │                │
│ ─ Purchasing│ ────────────────────────────────────────────────  │ THIS WEEK 3    │
│   • Giulia  │ Ieri · Mar 2 Giu                                  │ │ Demo 10/6   │
│     overdue │ 16:40  ⊞ Meeting · Sara P.+Francesca · Showroom   │ │ Quote 9/6   │
│ ─ Project   │ 12:18  ▢ Task · Quotation metalli                 │ │ Check-in    │
│ ─ Admin     │ 10:30  ▤ Voice Note 3:14 · debrief showroom       │                │
│ ─ Suppliers │ ...                                               │ SNOOZED   2    │
└─────────────┴───────────────────────────────────────────────────┴────────────────┘
```

**Reference**: `_mood_mockup.html?view=rc`

### 2.2 Advisor Workspace · Dashboard

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ TOPBAR  Raffaella · Advisor Workspace · Q2 2026                  ⌕ ⌘K  🔔12      │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Buongiorno, Raffaella.                                  [This week] [+ Log activ]│
│ My Workspace · Q2 2026                                                           │
│                                                                                  │
│ KPI  My Studios · Active Rel · Open FU · Activities · Health · Intro · Comm     │
├─────────────────────────────────────────────────┬────────────────────────────────┤
│ MY STUDIOS · this quarter (sortable table)      │ MY FOLLOW-UPS                  │
│ Studio | Health bar | Temperature | Last | Next │   Overdue · Today · Week       │
│                                                 │                                │
│ RECENT ACTIVITIES (compact rows)                │ MY COMMISSIONS Q2              │
│                                                 │   Active · Activated · % · €   │
│                                                 │                                │
│                                                 │ PENDING INTRODUCTIONS          │
│                                                 │   [Accept] [Decline] rows      │
└─────────────────────────────────────────────────┴────────────────────────────────┘
```

**Reference**: `_mood_mockup.html?view=aw`

### 2.3 Notification Drawer (globale)

```
                                                  ┌──────────────────────────────┐
                                                  │ Notifications  12 nuove   ✕  │
                                                  │ [Mark all read]              │
                                                  ├──────────────────────────────┤
                                                  │ Tutte · Non lette · Mentions │
                                                  ├──────────────────────────────┤
                                                  │ ▌ FOLLOW-UP OVERDUE          │
                                                  │   "Sintesi call con Luca…"   │
                                                  │   Studio Bianchi · 5 min     │
                                                  │ ▌ NEW STUDIO REQUEST         │
                                                  │   Studio Verri Milano · V2   │
                                                  │ ▌ TENANT ACTIVATED           │
                                                  │   Atelier Verde · magic link │
                                                  │ ▌ NEW ACTIVITY ADDED         │
                                                  │ ▌ NEW CONTACT                │
                                                  │   ADVISOR ASSIGNMENT         │
                                                  │   NEW ACTIVITY               │
                                                  │   WORKSPACE ACCESS           │
                                                  └──────────────────────────────┘
```

**Reference**: `_mood_mockup.html?notif=1`

### 2.4 Mobile (390px)

- Sidebar nascosta · topbar compatta · search collassato
- KPI strip wrap 2 colonne
- Tabs scrollabile orizzontalmente
- Tre colonne diventano accordion verticale (Contacts → Timeline → Follow-Ups)
- Riga attività mantiene tempo·icona·contenuto · nasconde owner (visibile su expand)

**Reference**: `_mood_mockup.html?mobile=1`

---

## 3 · Wireframe Activity Timeline · interazione

Ogni riga ha **4 colonne fisse** (`60px time · 22px icon · fluid content · auto owner`).

| Stato         | Comportamento                                                         |
| ------------- | --------------------------------------------------------------------- |
| Collapsed     | 1 linea: time · icon · `TYPE · Person · Subject` · meta (chip-less)   |
| Hover         | bg-stone-200/dark, cursore pointer                                    |
| Click         | espande inline · grid `90px label / 1fr value` con: Esito · Note · Prossimo passo · Actions |
| Expanded ops  | `Edit · Reschedule next · Add task · Mark next step done` (CTA teal)  |
| Multi-select  | shift-click checkbox per bulk: complete, archive, reassign            |

**Status indicatori (testuali, no chip)**:
- `● Completed` (green)
- `▸ Next: …` (amber)
- `● Sent / Reply received` (green/teal)
- `● Open` (amber)

**Day grouping**: sticky header `Oggi · Mercoledì 3 Giugno` + counter `6 attività`. Su >100 attività attive una virtual list rende solo i visibili. Su >1000 si introduce **infinite scroll** con cursor pagination (già in API).

---

## 4 · Database impact analysis

### 4.1 Tabelle nuove

| Tabella                            | Scopo                                                              | Status   |
| ---------------------------------- | ------------------------------------------------------------------ | -------- |
| `notifications`                    | M4 · 1 record = 1 notifica per utente                              | NEW      |
| `notification_categories`          | catalog: `studio_request`, `followup_overdue`, ecc.                | NEW      |
| `notification_subscriptions`       | per utente: opt-in/out per categoria + canale (in_app/email)       | NEW      |
| `voice_notes`                      | M3.1 · audio + transcript (foundation, no provider)                | NEW      |
| `voice_notes_jobs`                 | future-ready coda per STT (Whisper / altro)                        | NEW      |
| `email_messages`                   | M3.2 · email tracciate (in/out · thread_id · message_id)           | NEW      |
| `email_threads`                    | header thread per raggruppare                                      | NEW      |
| `email_sync_state`                 | future-ready per Gmail/IMAP sync (token, cursore, last_sync_at)    | NEW      |
| `commissions`                      | M5 foundation: snapshot mensile per advisor                        | NEW      |
| `advisor_introductions`            | M5: lead in attesa di accept da advisor                            | NEW      |
| `relationship_temperature`         | enum + storia: `cold/warm/hot` per tenant                          | NEW      |
| `account_health_snapshots`         | snapshot daily del relationship_score (history per grafici)        | NEW      |

### 4.2 Tabelle esistenti — modifiche

| Tabella                       | Modifica                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `relationship_activities`     | ADD `voice_note_id` FK · `email_message_id` FK · `is_pinned` bool · `visibility_scope` enum                  |
| `tenants`                     | ADD `relationship_temperature` enum default 'cold' · `last_health_snapshot_at` timestamptz                   |
| `tenant_contacts`             | ADD `last_interaction_at` (computed/materialized) · `next_followup_at` (computed) · `is_decision_maker` bool |
| `platform_activity_types`     | ADD entries: `voice_note`, `email_inbound`, `email_outbound`, `email_thread`                                 |

### 4.3 Tabelle che restano invariate

- `tenant_contacts` core schema
- `platform_activity_outcomes`, `platform_activity_sources`
- `v_relationship_timeline` (view già aggregante)
- Auth/JWT/Magic Link
- CMS (pages/blocks/sections/media)

### 4.4 Indici nuovi

```sql
CREATE INDEX idx_notifications_user_unread
  ON notifications (user_id, read_at NULLS FIRST, created_at DESC);

CREATE INDEX idx_notifications_user_category
  ON notifications (user_id, category_code, created_at DESC);

CREATE INDEX idx_email_messages_thread
  ON email_messages (thread_id, sent_at DESC);

CREATE INDEX idx_email_messages_tenant
  ON email_messages (tenant_id, sent_at DESC);

CREATE INDEX idx_voice_notes_tenant
  ON voice_notes (tenant_id, created_at DESC);

CREATE INDEX idx_commissions_advisor_period
  ON commissions (advisor_user_id, period_year, period_month);

CREATE INDEX idx_account_health_tenant_time
  ON account_health_snapshots (tenant_id, captured_at DESC);

-- esistenti: già in posto
-- relationship_activities (tenant_id, occurred_at DESC) · GIN FTS · ecc.
```

### 4.5 Estimated row counts a regime (scale test)

| Tabella                    | 50 advisor × 500 studi × 20K activity | Note                          |
| -------------------------- | ------------------------------------- | ----------------------------- |
| `tenants`                  | 500                                   | trascurabile                  |
| `tenant_contacts`          | ~6.000 (12 avg per studio)            | indici già OK                 |
| `relationship_activities`  | ~20.000                               | cursor pagination essenziale  |
| `notifications`            | ~150.000 (12 mesi × 25 utenti)        | TTL + archive partition       |
| `email_messages`           | ~80.000 (1 anno)                      | indici thread+tenant          |
| `voice_notes`              | ~5.000                                | binary su S3-like, metadati DB|
| `account_health_snapshots` | ~180.000 (500 studi × 365 giorni)     | partition mensile             |

---

## 5 · API impact analysis

### 5.1 Endpoint nuovi (REST · `/api/...`)

**Notifications (M4)**
```
GET    /api/notifications                    list (cursor, filter category/read)
GET    /api/notifications/unread-count       badge counter
POST   /api/notifications/mark-read          {ids?: [], all?: bool}
GET    /api/notifications/preferences        user opt-in matrix
PATCH  /api/notifications/preferences        {category_code, channel_in_app, channel_email}
GET    /api/notifications/categories         catalog
```

**Advisor Workspace (M5)**
```
GET    /api/workspace/dashboard              KPI personali advisor
GET    /api/workspace/studios                my studios + health/temp
GET    /api/workspace/activities             my activities filtered
GET    /api/workspace/followups              my follow-up queue
GET    /api/workspace/commissions/current    commissions estimate Q
GET    /api/workspace/commissions/history    statement archive
GET    /api/workspace/introductions          pending lead inbox
POST   /api/workspace/introductions/{id}/accept
POST   /api/workspace/introductions/{id}/decline
```

**Voice Notes (M3.1 foundation)**
```
POST   /api/admin/tenants/{tid}/voice-notes     {audio_url, duration_s} → returns id, transcript=null
GET    /api/admin/tenants/{tid}/voice-notes/{id}
PATCH  /api/admin/tenants/{tid}/voice-notes/{id} {transcript, transcript_lang}  (admin/job)
DELETE /api/admin/tenants/{tid}/voice-notes/{id}
```
*Per ora upload puro · job di STT non implementato · architettura `voice_notes_jobs` pronta per worker futuro.*

**Email Activities (M3.2 foundation)**
```
POST   /api/admin/tenants/{tid}/emails          log manuale email outbound già inviata
POST   /api/admin/tenants/{tid}/emails/inbound  webhook receiver (foundation, no Gmail per ora)
GET    /api/admin/tenants/{tid}/emails          list per tenant
GET    /api/admin/tenants/{tid}/emails/{id}     thread completo
```
*Gmail OAuth, Outlook, IMAP sync NON in scope ora · solo schema + endpoint shell.*

**Health & Temperature**
```
GET    /api/admin/tenants/{tid}/health/history   line chart data
PATCH  /api/admin/tenants/{tid}/temperature      {value: cold|warm|hot, reason}
```

### 5.2 Endpoint esistenti — estensioni

| Endpoint                                | Estensione                                                              |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `GET /api/admin/tenants/{tid}`          | + `relationship_temperature`, `last_health_snapshot`, `notif_count`     |
| `GET /api/admin/tenants/{tid}/contacts` | + `last_interaction_at`, `next_followup_at`, `is_decision_maker`        |
| `POST /api/admin/.../activities`        | + `voice_note_id`, `email_message_id`, `is_pinned`, `visibility_scope`  |
| `GET /api/.../timeline`                 | source types estesi: `voice_note`, `email`, `commission_event`          |
| `GET /api/auth/me`                      | + `notification_unread_count`, `workspace_url`                          |

### 5.3 Eventi (background jobs)

| Job                                  | Trigger                                            | Output                       |
| ------------------------------------ | -------------------------------------------------- | ---------------------------- |
| `notify_followup_overdue`            | cron daily 08:00                                   | inserts in `notifications`   |
| `notify_studio_request_received`     | on `studio_requests.insert`                        | notifica advisor assegnato   |
| `notify_tenant_activated`            | on lifecycle status='activated'                    | notifica tutto il team       |
| `health_snapshot_daily`              | cron daily 23:00                                   | inserts `account_health_…`   |
| `commissions_estimate_monthly`       | cron monthly                                       | snapshot in `commissions`    |
| `voice_note_transcribe`              | on `voice_notes_jobs.insert` (futuro, disabled)    | aggiorna transcript          |

---

## 6 · Migration plan

Ordine di esecuzione (idempotente, ognuno con dry-run + validator):

| # | Migration                                | Note                                                                |
| - | ---------------------------------------- | ------------------------------------------------------------------- |
| 035 | `notifications_core`                    | tabelle + indici + seed categorie                                   |
| 036 | `notifications_subscriptions`           | preferences matrix utente×categoria×canale                          |
| 037 | `voice_notes`                           | tabelle + indici · NO provider                                      |
| 038 | `email_activities`                      | `email_messages` + `email_threads` + `email_sync_state` shell       |
| 039 | `relationship_activities_extend`        | colonne `voice_note_id`, `email_message_id`, `is_pinned`            |
| 040 | `tenants_health_temperature`            | `relationship_temperature` + `account_health_snapshots`             |
| 041 | `tenant_contacts_aux`                   | `last_interaction_at`, `next_followup_at`, `is_decision_maker`      |
| 042 | `commissions_foundation`                | `commissions` + cron stub                                           |
| 043 | `advisor_introductions`                 | lead inbox advisor                                                  |
| 044 | `v_relationship_timeline_v2`            | view aggrega + voice_notes + email_messages + commission_events     |

Tutte rollback-safe. Ogni migration ha:
- `up.sql` · `down.sql` · `validate.py` (assertions) · entry in `/app/backend/scripts/validate_m4.py` & `validate_m5.py`.

---

## 7 · Vocabolario operativo (ITA + EN dual)

Le UI MOOD sono in italiano. Le label tecniche dei cataloghi e degli enum DB restano inglesi (machine-readable). Mai più "record", "item", "entity" nel testo utente.

| DB / API code             | UI italiana (utente)      | UI EN (futuro) |
| ------------------------- | ------------------------- | -------------- |
| `studio_request`          | Nuova richiesta studio    | New studio request |
| `followup_overdue`        | Follow-up in ritardo      | Follow-up overdue  |
| `tenant_activated`        | Tenant attivato           | Tenant activated   |
| `new_contact`             | Nuovo contatto            | New contact        |
| `new_activity`            | Nuova attività            | New activity       |
| `advisor_assignment`      | Assegnazione advisor      | Advisor assignment |
| `workspace_access`        | Primo accesso founder     | Workspace access   |
| relationship_temperature  | Temperatura               | Temperature        |
| relationship_health       | Salute relazione          | Relationship health|
| follow_up                 | Follow-up                 | Follow-up          |

---

## 8 · Risposta all'audit di scalabilità

> "Se domani arrivano 5 advisor / 20 studi / 50 contatti / 200 attività, MOOD regge?"

**Oggi (M0-M3 chiusi)**: ✅ regge. La piattaforma ha già:
- Auth multi-tenant con isolamento + RBAC
- CRUD studi, contatti, attività
- Timeline aggregato (view materializable)
- Cursor pagination su tutte le liste calde

**Bottleneck noti**:
1. 🔴 Notification Center M4 inesistente · gli advisor non sanno cosa è successo se non riguardano ogni studio
2. 🔴 Advisor Workspace M5 inesistente · ogni advisor lavora nel Command Center come fosse admin
3. 🟡 Follow-up Queue presente in API ma senza widget hero in studio detail
4. 🟡 Relationship Health esiste come campo ma senza snapshot history → niente grafici
5. 🟡 Temperatura (cold/warm/hot) inesistente → nessun bucket commerciale
6. 🟡 Performance Supabase ~1.7s/query → M1.1 hardening
7. 🟢 Email/Voice future-ready ma non architetturati → schema da creare

**Per arrivare a 50 advisor / 500 studi / 20K attività**:
- M4 + M5 sono **bloccanti**: senza notifiche e workspace dedicato, gli advisor non lavorano
- M3.1 (voice) + M3.2 (email shell) servono per memoria relazionale completa
- Performance hardening (M1.1) connection pool dopo M5

---

## 9 · Roadmap proposta

| Milestone | Scope                                            | Effort   | Sblocca           |
| --------- | ------------------------------------------------ | -------- | ----------------- |
| **M4**    | Notification Center (cat·preferences·drawer·bell)| ~5 giorni| Operatività team  |
| **M5**    | Advisor Workspace (dashboard·studios·intros·comm)| ~7 giorni| Onboarding advisor|
| **M3.1**  | Voice Notes foundation (no STT)                  | ~2 giorni| Mobile captura    |
| **M3.2**  | Email Activities foundation (no Gmail)           | ~3 giorni| Email tracking    |
| **M6**    | Relationship Center redesign (3-col, KPI strip)  | ~6 giorni| UX target del prompt|
| **M1.1**  | Performance hardening (pool, cache, materialize) | ~3 giorni| Scala 20K activity|

**Sequenza consigliata** (sblocca valore prima):
`M6 (Relationship Center redesign) → M4 (Notifications) → M5 (Advisor Workspace) → M3.1 (Voice) → M3.2 (Email) → M1.1`

Motivo: M6 toglie il "CRM dark mode" attuale e dà fondamenta UI a tutto il resto. Notifiche e workspace si innestano sopra una UI corretta, non sopra una sbagliata.

---

## 10 · Mockup (interattivi)

URL preview live:

| Vista                                | URL                                                |
| ------------------------------------ | -------------------------------------------------- |
| Relationship Center · desktop         | `/_mood_mockup.html`                              |
| + Notification Drawer aperto          | `/_mood_mockup.html?notif=1`                      |
| Advisor Workspace · Dashboard         | `/_mood_mockup.html?view=aw`                      |
| Mobile (390px)                        | `/_mood_mockup.html?mobile=1`                     |
| Mobile · Advisor Workspace            | `/_mood_mockup.html?view=aw&mobile=1`             |

Toggle in basso a destra per cambiare vista durante la review.

---

## 11 · Domande aperte all'utente (prima di implementare)

1. **Sequenza**: confermi `M6 → M4 → M5 → M3.1 → M3.2 → M1.1`? Oppure preferisci spingere M4 (notifiche) per primo perché "operativo"?
2. **Health score (0-100)**: confermi formula combinata (last_touch_at · open_followups · primary_contact · recency emails) o vuoi un set di pesi diverso? Posso proporre i pesi nel prossimo deliverable.
3. **Temperature (cold/warm/hot)**: assegnata da advisor manualmente o computata da regole (es. `hot = ≥1 meeting + 1 quotation negli ultimi 30g`)?
4. **Commissions**: confermi solo *foundation* (visualizzazione mock + struttura DB)? O vuoi un calcolo reale già su attivazioni?
5. **Voice notes provider**: vuoi che la coda STT sia pronta per Whisper (Emergent LLM key) o resta puramente schema-only?
6. **Email sync**: per ora solo log manuale ("ho mandato questa email"). Confermi che Gmail OAuth resta fuori scope?
7. **Advisor Workspace URL**: `/workspace/*` (nuovo namespace pulito) o resta dentro `/command-center/*` con role-based routing? Suggerisco *nuovo namespace* per separazione mentale.
8. **Notification email digest**: M4 invia email reali (Resend già configurato) o solo in-app per ora?

---

## 12 · NON FATTO in questo deliverable

- ❌ Nessun codice React modificato
- ❌ Nessuna API modificata
- ❌ Nessuna migration eseguita
- ❌ Nessun componente reale toccato
- ✅ Solo: mockup HTML statico in `/app/frontend/public/_mood_mockup.html` + questo documento
- ✅ I componenti `ActivityFeed.jsx` / `TimelineFeed.jsx` restano nello stato del previous task (alignment editoriale leggero) — pronti per essere **sostituiti** in M6 se approvi

---

**Aspetto la tua decisione su §11 prima di scrivere una sola riga di codice della piattaforma.**
