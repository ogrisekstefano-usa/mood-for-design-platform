# RELATIONSHIP OS™ — ARCHITECTURE DELIVERABLE

> **Status:** Architecture-only · NO code · NO migration · NO deploy
> **Date:** 03 Jun 2026 · post ITER204-B
> **Author:** Main Agent (E1) — basato su prompt utente + ispezione codice
> **Wireframes:** `/wireframes/relationship-os/index.html` (4 screenshot)

---

## 0 · Direzione obbligatoria (recap)

MOOD non è un CMS · non è un gestionale · non è un database editoriale.

**È un Relationship Operating System** per Advisor, Founder e MOOD Team.

Riferimenti d'UX: Salesforce Private Banking · Linear · Notion · Attio · Pitch · Superhuman.
NON: Airtable · Document Management · WordPress · Magazine layouts.

**Function before aesthetic.** Estetica MOOD premium ma SaaS-first.

---

## 1 · WIREFRAME · Relationship Center

📷 `/tmp/01_relationship_center.png`

### Layout · 3 colonne fisse

```
┌────────────────────────────────────────────────────────────────────┐
│  NAV: MOOD™ · Dashboard · Relationships · Journeys · Library · ⌘K │
│       Advisor                                            🔔 7  L   │
├──────────────┬──────────────────────────────────┬──────────────────┤
│ COL 1 · 340  │  COL 2 · flex                    │ COL 3 · 360      │
│ Relationship │  Relationship Timeline           │ Follow-up Queue  │
│ Summary List │                                  │                  │
│              │  ┌─Hero (Studio Greco · Milano)─┐│ ⚠ Overdue 2d     │
│ [Search ⌘K]  │  │ founder · owner · last touch ││ Send samples →   │
│ [All Hot ...]│  │ open · opportunities · temp  ││ [Complete][..]   │
│              │  └──────────────────────────────┘│                  │
│ ● SG · Hot   │                                  │ Today 14:00      │
│ ● AB · 1d    │  Composer: Note·Email·Call·      │ Call Cattelan →  │
│ ● CG · 3d    │  Visit·Follow-up·🎤 Voice        │                  │
│ ● VR · 14d   │                                  │ Tomorrow 10:00   │
│ ● BS · 2mo   │  ─────────  Unified Timeline ──  │ Onboarding ARBI  │
│ ● YP · 5h    │  🎤 Voice 2h · Raffaella         │                  │
│ ● IM · today │  ✉ Email 1d · receved            │ Friday 09:30     │
│              │  ⏱ Task tomorrow · scheduled     │ Re-engage Verde  │
│              │  ★ Visit 2d · logged             │                  │
│              │  ● Auto · journey advanced       │ Next week        │
│              │  ✎ Note 5d                       │ Quarterly Yacht  │
│              │                                  │                  │
└──────────────┴──────────────────────────────────┴──────────────────┘
```

### Column 1 · Relationship Summary List (340 px)

| Element | Description |
|---|---|
| Header | "My Relationships · 24 · filtered" |
| Search | `⌘K` global · cerca studio/founder/owner |
| Filter pills | All · Hot · Follow-up · Cold |
| Card row | Avatar (initials) + name + status dot + sub (last touch / owner / open count) + temperature pills (Hot/Account/Customer/Lead/Prospect) + relative time |
| Selected state | Left border 2px accent + bg `#15171B` |

### Column 2 · Relationship Timeline (flex)

| Block | Spec |
|---|---|
| **Hero** | tag · name · founder · owner · last touch · open · open opportunities · temperature (●dot). 6 stat cells, big numeric Montserrat for counts. |
| **Action bar** | + Log activity (primary) · 🎤 Voice note · + Follow-up · + Note · ⋯ More |
| **Composer chips** | Note · Email · Call · Visit · Follow-up · 🎤 Voice (highlighted, foundation M3.1 ready) |
| **Unified timeline** | One stream. Vertical guide line. Each event = icon + type label + author + relative time + title + description + optional waveform/quick-actions. |
| Event types | 🎤 Voice · ✉ Email · 📞 Call · ✎ Note · ★ Visit · ⏱ Follow-up · ● Auto |
| Quick actions per event | Play/Transcribe (voice), Reply (email), Complete/Reschedule (task), +Note, Pin, Link to journey |

### Column 3 · Follow-up Queue (360 px)

| Element | Description |
|---|---|
| Tabs | Mine · Team · Today · Open · Done |
| Card | Badge (Overdue/Today/Tomorrow/Friday/Next week/No date) + title + studio + 3 quick actions |
| Quick actions | **Complete** (1-click), **Reschedule** (popover date picker), **+Note** (inline) — never opens drawer |
| Overdue style | Background tinted danger 4% + red dot |

---

## 2 · WIREFRAME · Notification Center

📷 `/tmp/02_notification_center.png`

### Componenti

| Spec | Value |
|---|---|
| Trigger | Bell icon in top-right of global nav · sempre visibile · unread badge accent |
| Container | Drawer 380 px width, anchored top-right · overlays current page · ESC + outside-click close |
| **NON è** | Una pagina dedicata · Un email digest · Una dashboard separata |
| Header | "Notifications · 7 unread" · Mark all read · Settings ⚙ |
| Tabs | All · Mentions · Follow-ups · System |
| Item | 24px icon + title (bold entity) + sub (preview) + relative time. Unread = left border 2px accent. |
| Click → | Deep-link a Relationship Timeline scrollato all'evento |

### Notification types (M4)

| Type | Icon | Trigger event |
|---|---|---|
| `voice_note_added` | 🎤 | Advisor crea un voice note su un account |
| `followup_overdue` | ⚠ | Task scaduto (cron T+0 dopo due_date) |
| `email_received` | ✉ | Inbound email sync (M3.2 foundation) |
| `mention` | @ | User @-menzionato in nota/timeline |
| `journey_advanced` | ★ | Stage auto-advance |
| `entity_created` | ● | New relationship/lead da advisor |

### NO

- ❌ Email digest (out of scope per M4)
- ❌ Mobile push (P2)
- ❌ Pagina dedicata
- ❌ Settings inline (link to Settings/Notifications)

---

## 3 · WIREFRAME · Advisor Workspace

📷 `/tmp/03_advisor_workspace.png`

### Layout · sidebar + main

```
┌─────────────────────────────────────────────────────────────┐
│ NAV (global) — same as Relationship Center                  │
├──────────────┬──────────────────────────────────────────────┤
│ ADVISOR™    │ Eyebrow "Advisor Workspace · Overview"        │
│ ─────────    │ H1 "Buongiorno, Raffaella."                  │
│ Overview ●   │                                              │
│ My Studios   │ ┌──KPI──┐┌──KPI──┐┌──KPI──┐┌──KPI──┐         │
│ Activities   │ │ 18    ││  7    ││  3    ││ €4.2k │         │
│ Follow-ups   │ │studios││overdue││request││ MTD   │         │
│ Notifications│ └───────┘└───────┘└───────┘└───────┘         │
│ REVENUE      │                                              │
│ Commissions  │ ┌─ My Studios ──────────┐┌─ Follow-ups due ─┐│
│ Reports      │ │ SG · Hot · 2h         ││ Send samples ⚠   ││
│ ACCOUNT      │ │ CG · Healthy · 3d     ││ Call Cattelan    ││
│ Settings     │ │ VR · At risk · 14d    ││ Onboarding ARBI  ││
│              │ │ IM · Discovery · today││                  ││
│              │ └───────────────────────┘│ Recent activity  ││
│              │                          │ 🎤 Voice · Greco ││
│              │                          │ ✉ Email · Catt.  ││
│              │                          └──────────────────┘│
└──────────────┴──────────────────────────────────────────────┘
```

### Sidebar (220 px)

7 voci + 1 logo:
- Overview · My Studios · Activities · Follow-ups · Notifications · Commissions · Settings
- Active item: bg `#111214` + text `#E7E9EE` + count chip accent
- Count chips per voce: number aligned right, dimmed when not active

### Main

| Block | Content |
|---|---|
| KPIs (4 cards) | My Studios (18, 14 active / 3 onboarding / 1 dormant) · Follow-ups due (7, 3 overdue / 4 this week) · New requests (3) · Commission MTD (€4.2k +12%) |
| My Studios panel | Top 4 with avatar + name + sub + temperature pill + relative time + "View all →" link |
| Follow-ups due panel | Top 3 with priority icon + title + due + Complete button |
| Recent activity panel | 2-3 latest events (voice notes, emails) — inline preview |

### NON è (anti-pattern espliciti)

- ❌ NON è un clone del Command Center
- ❌ NESSUN editorial copy
- ❌ NESSUN narrative block / quote / magazine card
- ❌ NESSUN diary / journal feel
- ❌ NESSUN big hero with description prose

---

## 4 · WIREFRAME · Mobile

📷 `/tmp/04_mobile.png`

### Adattamento

3 colonne desktop → **3 tab** mobile:
- `Summary` · `Timeline` (default) · `Follow-ups (badge count)`

| Element | Spec |
|---|---|
| Phone width | 330 px frame |
| Header | account name + bell (badge unread) · NO menu hamburger |
| Tabs | 3 equal · active = accent underline |
| Card | Compact: badge (type + time) + title + sub. Voice card includes waveform inline. |
| FAB | 🎤 Voice (primary, bottom-right, accent bg) — registra audio one-tap |
| Notification Center | Stessa lista, tab All/Mentions/Follow-ups, ogni card link → Timeline ancorata |

### Trade-off mobile

- Composer ridotto a FAB voice + +action (sheet bottom)
- Hero ridotto a 1 riga (name + temperature dot + open count)
- Follow-up quick-actions = swipe-left = Complete / swipe-right = Reschedule

---

## 5 · Navigation Map

```
ROOT
├─ /dashboard                                  KEEP (Cockpit, refactor in P1)
├─ /relationships                              ★ NEW · Relationship Center (3-col)
│   └─ /relationships/:accountId               anchor to timeline event ?event=
├─ /journeys                                   KEEP (Design Journey OS)
├─ /studio-library                             KEEP (ITER204)
├─ /advisor                                    ★ REWORK · new sidebar + KPIs
│   ├─ /advisor/studios
│   ├─ /advisor/activities
│   ├─ /advisor/followups
│   ├─ /advisor/commissions
│   └─ /advisor/settings
├─ /inspirations/...                           KEEP (ITER204-B)
└─ /settings/...                               KEEP
```

### Global UI elements

- **Top nav** (5 voices): Dashboard · Relationships · Journeys · Studio Library · Advisor
- **⌘K** Command palette (global search)
- **🔔 Bell** + drawer (no separate page)
- **User menu** (right)

### Cosa SPARISCE

| Sparisce | Sostituito da |
|---|---|
| `/relations/leads` `/relations/prospects` (separate) | `/relationships` con filter pills |
| `/relations/memory/:id` (editorial timeline) | `/relationships/:id` (single timeline) |
| `/workspace/relationships` (current table/kanban) | `/relationships` 3-col surface |
| `/advisor` (current diary feel) | `/advisor` workspace SaaS |
| ActivityFeed standalone | Merged in Relationship Timeline col 2 |
| TimelineFeed standalone | Merged in Relationship Timeline col 2 |

---

## 6 · Data Flow Map

### Entità coinvolte

```
accounts (existing)
  ├─ contacts (existing)
  ├─ relationship_interactions  ──┐
  ├─ relationship_actions       ──│
  ├─ relationship_threads       ──│  → unified into
  ├─ voice_notes  (M3.1 NEW)    ──│     relationship_events_view
  ├─ email_activities (M3.2 NEW)──│     (materialized read model)
  ├─ follow_ups                 ──│
  ├─ notes                      ──│
  ├─ system_events              ──┘
  └─ relationship_linkages (existing)

advisor_referrals (existing)
  ├─ advisor_reports (existing)
  └─ commission_ledger (existing)

notifications (M4 NEW)
  ├─ user_id
  ├─ kind (voice_note_added | followup_overdue | mention | ...)
  ├─ subject_type / subject_id (account/journey/event)
  ├─ payload jsonb
  ├─ unread bool
  └─ created_at
```

### API contract (proposed)

| Endpoint | Owner | Purpose |
|---|---|---|
| `GET /api/relationships` | exists, refactor | List accounts + temperature + last_touch + counts |
| `GET /api/relationships/:id/timeline` | NEW | Unified stream (events from 6+ tables) |
| `GET /api/relationships/:id/followups` | NEW (composite) | Open + scheduled + overdue per account |
| `POST /api/relationships/:id/events` | NEW | Generic event creation (type-discriminated payload) |
| `POST /api/relationships/:id/voice-notes` | M3.1 | Audio upload (multipart) → row in voice_notes, no STT |
| `POST /api/relationships/:id/followups/:fid/complete` | NEW | 1-click |
| `POST /api/relationships/:id/followups/:fid/reschedule` | NEW | new due_date |
| `GET /api/notifications` | M4 | List per user, paginated, unread first |
| `POST /api/notifications/:id/read` | M4 | mark read |
| `POST /api/notifications/mark-all-read` | M4 | bulk |
| `GET /api/advisor/dashboard` | exists, refactor | KPIs aggregati + top studios + recent activity |

### Realtime / sync

- WebSocket channel `tenant:{id}:notifications` → push new notifications
- WebSocket channel `account:{id}:timeline` → live-update timeline col 2 when team adds events
- Polling fallback: 30s on timeline, 60s on notifications

---

## 7 · Component Inventory

### React components da CREARE (NEW)

| Component | File | Used in |
|---|---|---|
| `<RelationshipCenter />` | `pages/relationships/RelationshipCenter.jsx` | `/relationships` |
| `<RelationshipList />` | `pages/relationships/RelationshipList.jsx` | col 1 |
| `<RelationshipCard />` | `pages/relationships/RelationshipCard.jsx` | list item |
| `<TimelineHero />` | `pages/relationships/TimelineHero.jsx` | col 2 |
| `<TimelineComposer />` | `pages/relationships/TimelineComposer.jsx` | col 2 |
| `<TimelineEvent />` | `pages/relationships/TimelineEvent.jsx` | event row |
| `<TimelineEventVoice />` | `pages/relationships/TimelineEventVoice.jsx` | voice variant |
| `<FollowUpQueue />` | `pages/relationships/FollowUpQueue.jsx` | col 3 |
| `<FollowUpCard />` | `pages/relationships/FollowUpCard.jsx` | queue item |
| `<NotificationBell />` | `components/notifications/NotificationBell.jsx` | global nav |
| `<NotificationDrawer />` | `components/notifications/NotificationDrawer.jsx` | overlay |
| `<NotificationItem />` | `components/notifications/NotificationItem.jsx` | drawer item |
| `<AdvisorOverview />` | `pages/advisor/AdvisorOverview.jsx` | `/advisor` |
| `<AdvisorSidebar />` | `pages/advisor/AdvisorSidebar.jsx` | sidebar |
| `<AdvisorKPI />` | `pages/advisor/AdvisorKPI.jsx` | KPI card |
| `<AdvisorPanel />` | `pages/advisor/AdvisorPanel.jsx` | studios/follow-ups panel |
| `<VoiceRecorder />` | `components/voice/VoiceRecorder.jsx` | composer + FAB mobile |
| `<VoiceWaveform />` | `components/voice/VoiceWaveform.jsx` | timeline voice event |
| `<CommandPalette />` | `components/cmdk/CommandPalette.jsx` | global ⌘K |

### React components da RIUSARE (existing, no change)

- `<Avatar />` (initials helper esistente)
- `<StageChip />` (lookup color/label)
- Sidebar layout components (DashboardLayout, Topbar wrappers)
- `<Toaster />` sonner

### Hooks da CREARE

| Hook | Purpose |
|---|---|
| `useRelationshipTimeline(accountId)` | SWR-style fetch + websocket subscribe |
| `useFollowUps(scope)` | scope = 'mine' | 'team' | 'today' |
| `useNotifications()` | unread count + list + mark methods |
| `useVoiceRecorder()` | navigator.mediaDevices + upload |
| `useCmdK()` | global keyboard listener + palette state |

### CSS tokens da AGGIUNGERE (no edit existing)

```css
:root {
  --ros-bg: #0A0A0B;
  --ros-card: #111214;
  --ros-card-2: #15171B;
  --ros-border: #23252A;
  --ros-border-soft: #1B1D22;
  --ros-text: #E7E9EE;
  --ros-muted: #8B8F98;
  --ros-faint: #5A5E66;
  --ros-accent: #00C9B3;
  --ros-warn: #F59E0B;
  --ros-danger: #EF4444;
  --ros-good: #10B981;
  --ros-font-head: 'Playfair Display', Georgia, serif;
  --ros-font-num: 'Montserrat', system-ui, sans-serif;
  --ros-font-ui: 'Inter', system-ui, sans-serif;
}
```

---

## 8 · Gap Analysis · KEEP / REWORK / REPLACE

### Schermate esistenti

| Screen | File | Verdict | Reason |
|---|---|---|---|
| `RelationshipsPage` (current) | `pages/workspace/RelationshipsPage.jsx` | **REPLACE** | Table/Kanban view = generic CRM. Single-account drawer = anti-pattern. Manca timeline come surface principale, manca follow-up queue, manca composer. → Diventa `RelationshipCenter` 3-col. |
| `RelationshipMemoryTimeline` | `pages/relations/RelationshipMemoryTimeline.jsx` | **REPLACE** | "Memory chapters" + "Intelligence Panel" prose = magazine feel. Editorial chapter grouping ≠ CRM. Niente quick actions, niente real-time, niente composer. → Sostituito da `<TimelineEvent />` flat list in Relationship Center col 2. |
| `RelationshipMemoryPage` | `pages/relations/RelationshipMemoryPage.jsx` | **REPLACE** | Stesso problema. Editorial. |
| `RelationshipMemoryChapter` | `pages/relations/RelationshipMemoryChapter.jsx` | **REPLACE** | Chapter wrapper non utile in flat timeline. |
| `RelationshipLiveTimeline` | `components/dashboard/RelationshipLiveTimeline.jsx` | **REWORK** | Buona idea (live feed in dashboard) ma stile editorial. Riportarla in dashboard come "Recent activity" panel SaaS, sostituire icons emoji-heavy con icone Lucide pulite. |
| `AdvisorDashboardPage` | `pages/advisor/AdvisorDashboardPage.jsx` | **REWORK** | Tiene struttura (referrals, reports, magic link, KPIs) ma layout è "diario advisor": hero italic + cards editoriali. Pulire in: sidebar permanente + KPI cards Montserrat + panels uniformi. La logica `/api/advisor/me`, `/api/advisor/referrals`, `/api/advisor/reports` resta. |
| `ReportDrawer` (advisor) | inline in AdvisorDashboardPage | **REWORK** | Drawer giusto, ma campi "blockers/support_needed/outcome" sembrano diary. Diventa "Activity log entry" tipizzato (Visit/Call/Training/Issue) coerente col timeline globale. |
| `RelationshipsPage` filter sidebar | inline | **KEEP (logic)** + **REWORK (visual)** | Predicates (all/new/follow_up/active/clients/archived) sono utili → diventano filter pills above col 1. Visual cambia. |
| `AccountDrawer` | inline RelationshipsPage | **REPLACE** | Drawer pesante 760px con 4 tab = anti-pattern. → Timeline diventa la **vista principale** (col 2), drawer sparisce. |
| `NewRelationshipModal` | inline | **KEEP** | Form modal a 3-way (Nuovo Lead / Prospect / Customer) come da CRM_LIFECYCLE_CANON. Restyle visivo minimal, logica invariata. |
| `RelationshipGraph` (pages/crm) | `pages/crm/RelationshipGraph.jsx` | **KEEP (future)** | Specifico per Phase 2B (graph view). Non in scope di Relationship OS sprint M4-M6. |
| Dashboard cockpit | `pages/dashboard/*` | **KEEP** | Dashboard resta. Aggiungere RecentActivity panel (refactor di RelationshipLiveTimeline). |
| Studio Library | `pages/inspirations/StudioLibraryPage.jsx` | **KEEP** | ITER204, fuori scope. |
| BrandEmbassyPage | `pages/inspirations/BrandEmbassyPage.jsx` | **KEEP** | ITER204-B, fuori scope. |
| GlobalCreateModal | `components/layout/CreateModal.jsx` | **KEEP** + **EXTEND** | Aggiungere card "Voice Note" e "Note" che aprono inline composer su un account selezionato. |
| `Topbar.jsx` | `components/layout/Topbar.jsx` | **REWORK** | Aggiungere `<NotificationBell />` + `<CommandPalette trigger />` + user menu. Mantenere logica esistente. |
| `Sidebar.jsx` | `components/layout/Sidebar.jsx` | **KEEP** | Solo aggiungere voce "Relationships" se non presente in nav. |
| `ActivityFeed*` (qualunque file con questo nome) | various | **REPLACE** | Tutto migrato in Relationship Timeline col 2. |
| `TimelineFeed*` (qualunque file con questo nome) | various | **REPLACE** | Idem. |
| Various lookups (lifecycle_stage, account_type, source, ...) | `i18n + DB` | **KEEP** | Mantieni il system esistente · è già config-driven. |

### Entità DB

| Table | Verdict | Reason |
|---|---|---|
| `accounts` | KEEP | Già canonical. Aggiungere col `temperature` (hot/warm/cold/dormant) computato. |
| `contacts` | KEEP | Già canonical. |
| `relationship_interactions` | KEEP + EXTEND | Aggiungere `voice_note_id` FK nullable + `email_thread_id` FK nullable (M3.2). |
| `relationship_actions` | KEEP | È la base dei follow-ups. Rinominare in UI in "follow_ups" ma DB invariato. |
| `voice_notes` | **NEW (M3.1)** | id, account_id, interaction_id, audio_url, duration_seconds, transcribed bool default false, created_by, created_at |
| `email_activities` | **NEW (M3.2)** | foundation only — email_count + last_email_at per interaction (no Gmail OAuth yet) |
| `notifications` | **NEW (M4)** | user_id, kind, subject_type, subject_id, payload, unread, created_at |
| `relationship_threads` | KEEP | Conversazione esistente. |
| `studio_relations` | KEEP | Esistente. |
| `editorial_engagement` | KEEP | (Phase 2) — fuori scope M4-M6. |
| `relationship_linkages` | KEEP | (Phase 2) — fuori scope. |

---

## 9 · Implementation Roadmap

### Priority order

**Function before aesthetic.** L'ordine seguente è non-negoziabile: ogni step sblocca il successivo.

```
M4 · Notification Center  ────► foundation read-model + bell
            ▼
M5 · Relationship Center   ────► 3-col vera surface (timeline + queue)
            ▼
M3.1 · Voice Notes        ────► audio capture + waveform (no STT yet)
            ▼
M3.2 · Email Foundation   ────► counters only (no Gmail yet)
            ▼
M6 · Advisor Workspace    ────► sidebar + KPI + panels
            ▼
(Phase 2 later) Voice STT · Gmail OAuth · Editorial graph
```

### Step-by-step

| # | Milestone | Effort | Sostituisce | Dipendenze |
|---|---|---|---|---|
| **M4-a** | DB migration: `notifications` table + indexes | 0.5d | — | — |
| **M4-b** | Backend: notification publisher + 6 event types + API GET/POST mark-read | 1.0d | — | M4-a |
| **M4-c** | Frontend: `<NotificationBell />` in Topbar + `<NotificationDrawer />` overlay | 1.0d | — | M4-b |
| **M4-d** | WebSocket push channel | 1.0d | polling | M4-b |
| **M5-a** | DB: composite view/endpoint `GET /api/relationships/:id/timeline` (merge interactions+actions+threads+system_events) | 1.5d | scattered queries in `RelationshipMemoryTimeline` | — |
| **M5-b** | Endpoint `GET /api/relationships/:id/followups` + quick-action endpoints (complete/reschedule) | 0.5d | — | M5-a |
| **M5-c** | Frontend: `<RelationshipCenter />` 3-col + `<RelationshipList />` + `<RelationshipCard />` | 1.5d | `RelationshipsPage` table/kanban | M5-a |
| **M5-d** | Frontend: `<TimelineHero />` + `<TimelineComposer />` + `<TimelineEvent />` | 2.0d | `RelationshipMemoryTimeline` | M5-a |
| **M5-e** | Frontend: `<FollowUpQueue />` + quick-actions inline | 1.0d | drawer "Actions" tab | M5-b |
| **M5-f** | Route swap `/relationships` → new + 301 redirect legacy `/workspace/relationships` and `/relations/memory/:id` | 0.5d | — | M5-c,d,e |
| **M3.1-a** | DB: `voice_notes` + FK in `relationship_interactions` + supabase storage bucket `voice-notes` | 0.5d | — | — |
| **M3.1-b** | Backend: upload endpoint + audio metadata extraction + ACL | 1.0d | — | M3.1-a |
| **M3.1-c** | Frontend: `<VoiceRecorder />` + `<VoiceWaveform />` + composer chip | 1.5d | — | M3.1-b, M5-d |
| **M3.2-a** | DB: add `email_count` + `last_email_at` columns to interactions (foundation only, NO Gmail OAuth) | 0.25d | — | — |
| **M3.2-b** | Endpoint `POST /api/relationships/:id/email-event` (manual log) | 0.25d | — | M3.2-a |
| **M6-a** | Refactor `AdvisorDashboardPage` → `<AdvisorOverview />` + `<AdvisorSidebar />` | 2.0d | current "diary" UI | M5-* (reuses timeline components) |
| **M6-b** | Endpoint `GET /api/advisor/dashboard` aggregato (KPIs + top studios + recent activity) | 0.5d | scattered current calls | — |
| **M6-c** | Sub-routes `/advisor/studios`, `/advisor/activities`, `/advisor/followups`, etc. | 1.0d | — | M6-a |

### Totale effort indicativo

| Sprint | Days | Deliverable |
|---|---|---|
| **Sprint 1 · M4** | 3.5d | Notification Center live (bell + drawer + 6 event types) |
| **Sprint 2 · M5** | 7.0d | Relationship Center 3-col operativo, replaces 5 legacy pages |
| **Sprint 3 · M3.1 + M3.2** | 3.5d | Voice notes foundation + email counters |
| **Sprint 4 · M6** | 3.5d | Advisor Workspace SaaS-style |
| **Totale convergenza minima** | **~17.5 d** | Relationship OS™ v1 operativo |

### COSA SOSTITUIRE SUBITO

1. ✘ `/workspace/relationships` (table+kanban+drawer) → diventerà M5
2. ✘ `/relations/memory/:id` (editorial chapters) → merged in M5
3. ✘ Activity/Timeline feeds editorial → merged in M5

### COSA CONSERVARE

1. ✅ Backend `accounts`, `contacts`, `relationship_interactions`, `relationship_actions`
2. ✅ Lookups system (lifecycle_stage, account_type, source, etc.)
3. ✅ `NewRelationshipModal` 3-way (per CRM_LIFECYCLE_CANON)
4. ✅ Advisor backend (referrals, reports, magic_link, commissions)
5. ✅ Studio Library + Brand Embassy + Knowledge Engine (fuori scope)
6. ✅ Design Journey™ centralità (questo OS lo serve, non lo sostituisce)

### COSA RIMANDARE (post-M6 · Phase 2)

- Voice STT (transcription engine, Whisper integration)
- Gmail/Outlook OAuth + bidirectional sync
- Editorial engagement signals (relationship_linkages graph)
- Material affinity computation
- International footprint per relationship
- Mobile push notifications
- AI-suggested next-best-action per follow-up

---

## 10 · Validation criteria

Una build M4-M6 è considerata **Relationship OS™-compliant** se:

- [ ] **Zero pagine separate** per ActivityFeed/TimelineFeed/MemoryTimeline. Una sola surface `/relationships`.
- [ ] Bell icon globale visibile su ogni route autenticata (eccetto client preview).
- [ ] Notification drawer apre in <100ms, non naviga via, ESC chiude.
- [ ] Relationship Center `/relationships/:id` mostra simultaneamente: lista 24+ accounts (col 1), timeline unificata col 2, follow-up queue col 3.
- [ ] Timeline mostra eventi di ≥5 tipi (voice/email/call/visit/follow-up/note/auto) con icona + autore + tempo + quick-actions.
- [ ] Voice note: composer chip 🎤 funziona → record → upload → riga timeline con waveform 02:34 — anche se transcribe non è attivo.
- [ ] Follow-up Complete è 1-click (no drawer, no modal).
- [ ] Follow-up Reschedule è 1-click + date popover (no drawer).
- [ ] Advisor Workspace ha sidebar permanente + 4 KPI Montserrat + 2-3 panels.
- [ ] Mobile: 3 tab (Summary/Timeline/Follow-ups) + FAB voice + bell in header.
- [ ] **Nessun layout magazine**, nessuna "memoria della relazione è ancora bianca", nessun "chapter", nessun "atmosphere" / "warmth" prose nelle nuove surface (Phase 2).
- [ ] Tutti i colori da `--ros-*` token, font Playfair solo H1/H2, Montserrat solo numbers/KPI, Inter ovunque.
- [ ] **Function before aesthetic**: ogni schermo deve essere usabile per task ripetitivi 100+ volte al giorno (creating events, completing follow-ups, marking read).

---

## 11 · Out of scope (esplicito)

Questo deliverable NON definisce:

- Editorial engagement signal ingestion (Phase 2)
- Material affinity per relationship (Phase 2)
- International footprint visualization (Phase 2)
- Cross-tenant relationship sharing (Future)
- AI-suggested next-best-action (Future)
- Voice STT (Future · M3.1 prepara solo audio storage)
- Email OAuth (Future · M3.2 prepara solo counters)

---

## 12 · Files referenced

### Wireframes
- `/app/frontend/public/wireframes/relationship-os/index.html` (4 wireframes in single page)
- Screenshots: `/tmp/01_relationship_center.png` · `02_notification_center.png` · `03_advisor_workspace.png` · `04_mobile.png`

### Existing baseline (consulted)
- `/app/memory/CRM_LIFECYCLE_CANON.md` (Lead → Discovery → Prospect → Account)
- `/app/memory/EDITORIAL_RELATIONSHIP_CRM_ARCHITECTURE.md` (Phase 2 entities, NON in scope qui)
- `/app/memory/CRM_FOUNDATION_LOCKED_MODEL.md`
- `/app/memory/JOURNEY_ASSIGNMENTS_ARCHITECTURE.md`
- `/app/frontend/src/pages/workspace/RelationshipsPage.jsx` (REPLACE)
- `/app/frontend/src/pages/relations/RelationshipMemoryTimeline.jsx` (REPLACE)
- `/app/frontend/src/pages/advisor/AdvisorDashboardPage.jsx` (REWORK)
- `/app/frontend/src/components/dashboard/RelationshipLiveTimeline.jsx` (REWORK)

### NON modificati (architecture-only deliverable)
Nessuno. Solo creati: wireframe HTML + questo deliverable.

---

**Maintainer:** MOOD Relationship OS™ direction · 03 Jun 2026
**Status:** Architecture-only · ready for engineering kick-off su approval Founder
