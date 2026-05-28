# ITER168 · Design Journey™ Operational Refactor
## Architectural Proposal · No code yet

> Status: **PROPOSAL · awaiting user approval** · 28 Feb 2026
> Author: E1 · Prepared on top of an audit of the existing codebase.
> Scope: ossatura prodotto. NON nuove feature visuali, NON Atmospheric polish,
> NON Chameleon AI, NON Relationship Signals™.

---

## §0 · Stato di fatto (audit, non opinione)

Cosa esiste già nel DB (non da costruire — da **adottare e rendere visibile**):

- **`accounts`** (migration 034) — lifecycle: `new_inquiry → lead → discovery →
  prospect → active_project → existing_client → repeat_client → archived`
- **`leads`** (migration 082) — `progression_state`: `lead | prospect | account |
  dormant | archived` ⚠️ duplicato con `accounts.lifecycle_stage`
- **`contacts`** — N persone per account
- **`design_journeys`** (migration 061+063) — root entity, già con
  `account_id` (soft FK), `lifecycle_state` (`conversation_open | in_progress |
  presenting | drifting | on_pause | approved | closed | editioned | abandoned`)
- **`journey_milestones`** — 10 step canonici (vedi §3.B)
- **`journey_timeline_events`** + **`journey_health_signals`**
- **`moodboards`**, **`proposals`**, **`curated_collections`** — TUTTE già con
  `journey_id` + `milestone_id` soft FK (063)
- **VIEW `journey_artifacts`** — già unifica i 3 sopra

Cosa NON esiste nel DB:
- moodboards · `scope`, `room_key`, `chapter_key`, `approval_state`
- nessuna tabella `rooms` o `chapters`
- nessuna tabella di unificazione `relationship_subjects` (lead+account+journey)
- nessuna VIEW `journey_overview` (KPI + artifact count + last activity)

Cosa è dispersivo nella **UX** (root cause della percezione utente):
1. `/workspace/projects/:id` è **project-keyed**, non journey-keyed
2. `/journey/:projectId/step/:milestoneType` usa projectId come chiave (legacy)
3. `/moodboards` flat, fuori da qualsiasi journey
4. `/relations/leads` + `/relations/prospects` + `/relations/accounts` →
   3 liste parallele, una persona può apparire ovunque
5. `/workspace/calendar | activity | messages | reports` → 4 hub globali,
   non journey-bound
6. `/client/welcome` ≠ `/client/journey/:journeyId` (due esperienze cliente
   parallele, una "preset" e una "operativa")

---

## §1 · UX Map — Design Journey™ come contenitore unico

Tre superfici, **una sola entità sotto**:

```
                  ┌────────────────────────────┐
                  │  DESIGN JOURNEY™ (entità)  │
                  │  account_id · lifecycle    │
                  │  10 milestones · events    │
                  └─────────┬──────────┬───────┘
                            │          │
        ┌───────────────────┘          └────────────────────┐
        ▼                                                   ▼
   /journey/:jid (CLIENT VIEW)              /studio/journey/:jid (STUDIO VIEW)
   = Client Profile™                          = Workspace™
   emozionale · narrativa                    operativo · azionabile
        │                                                   │
        ▼                                                   ▼
   ┌──────────────────────────┐              ┌──────────────────────────┐
   │ - Hero (atmosfera)       │              │ - Hero (KPI compatti)    │
   │ - Timeline editoriale    │              │ - Timeline interattiva   │
   │ - Capitoli (read mostly) │              │ - Capitoli editabili     │
   │ - Voce al referente      │              │ - Assegnazioni team      │
   │ - Recall request         │              │ - Approval queue         │
   │ - Approval CTA           │              │ - Appointments           │
   │ - Files (read)           │              │ - Files manager          │
   │ - Atmospheric Panels™    │              │ - Health signals         │
   └──────────────────────────┘              └──────────────────────────┘
                  ▲                                       ▲
                  │                                       │
                  └───────────── stessi dati ─────────────┘
                  (entrambe leggono da journey_artifacts VIEW)
```

### 1.A · Le 3 superfici canoniche

| Superficie | URL canonico | Audience | Tono | Scope |
|---|---|---|---|---|
| **Storefront pubblico** | `/`, `/projects/:slug`, `/begin-journey` | visitatori | editoriale narrativo | marketing + intake |
| **Client Profile™** | `/journey/:jid` (NEW canonical) | client autenticato | concierge emozionale | UNA journey alla volta |
| **Workspace™** | `/studio/journey/:jid` (NEW canonical) | studio (designer/admin) | operativo cinematic | UNA journey alla volta |

### 1.B · Cambi di URL canonici (deprecation map)

| Vecchio | Nuovo | Strategia |
|---|---|---|
| `/client/welcome` | `/journey/:jid` (auto-resolve a primary journey) | 302 redirect post-resolve |
| `/client/journey/:journeyId` | `/journey/:jid` | rename |
| `/workspace/projects/:id` | `/studio/journey/:jid` | redirect via lookup `projects.id → design_journeys.id` |
| `/journey/:projectId/step/:milestoneType` | `/studio/journey/:jid/step/:milestoneType` | rename, projectId → jid |
| `/moodboards` (flat global) | `/studio/journey/:jid#moodboards` (tab) + `/studio/library/moodboards` (global archive solo super_admin) | 2 layer |
| `/relations/leads` + `/relations/prospects` + `/relations/accounts` | `/relations/:subjectId` (unified subject) con tab filtrate per `lifecycle_stage` | unification |
| `/workspace/calendar | activity | messages | reports` | spostati DENTRO `/studio/journey/:jid` come tab + `/studio/pulse` come global overview | nesting |

> Il cambio NON elimina il concetto di "Workspace" come hub globale —
> diventa `/studio/pulse` (vista globale di **tutte** le journey attive,
> oggi è già `dashboard/pulse`). Il workspace **operativo** vive sempre
> dentro la singola journey.

---

## §2 · Entity Relationship Map

```
   ┌─────────┐    1:N    ┌──────────┐   N:1    ┌────────────────┐
   │ tenant  │──────────▶│ account  │◀─────────│ contact (N)    │
   └─────────┘           │ lifecycle│          └────────────────┘
                         └────┬─────┘
                              │  1:N (un account, N journeys nel tempo)
                              ▼
                    ┌──────────────────┐
                    │ design_journey™  │  (ROOT)
                    │ - account_id     │
                    │ - lifecycle_state│
                    │ - referente_id   │
                    │ - tier (atelier) │
                    │ - register       │
                    └────────┬─────────┘
                             │ 1:1
                             ▼
                  ┌──────────────────────┐
                  │ journey_brief        │  (NEW · sostituisce closed_answers
                  │ - intake_answers     │   pulled out of leads)
                  │ - cultural_register  │
                  │ - tier               │
                  └──────────────────────┘
                             │ 1:N
                             ▼
                  ┌──────────────────────┐
                  │ journey_milestones   │  (10 step canonici · esiste già)
                  │ - milestone_type     │
                  │ - status             │
                  │ - linked_entity_*    │  ← punta a moodboard/proposal/etc
                  └──────────────────────┘
                             │ 1:N
            ┌────────────────┼─────────────────┬─────────────┐
            ▼                ▼                 ▼             ▼
       ┌─────────┐    ┌──────────────┐    ┌──────────┐  ┌─────────┐
       │moodboard│    │  proposal    │    │ curated_ │  │ file    │
       │+ scope  │    │              │    │ collection│  │ (S3)    │
       │+ room   │    │              │    │           │  │+ kind   │
       │+ chapter│    │              │    │           │  │+ scope  │
       └─────────┘    └──────────────┘    └──────────┘  └─────────┘

   ┌──────────────────────────┐
   │ journey_timeline_events  │  ← narrativa
   │ + journey_health_signals │  ← drift, silence, reorient
   └──────────────────────────┘
```

### Convenzioni di FK (post-refactor)

- **`design_journeys.account_id`** diventa **NOT NULL** (oggi è soft).
  Migration backfill: ogni journey orfana riceve un account "Cliente
  archiviato" del proprio tenant.
- **`moodboards.journey_id`**, `proposals.journey_id`,
  `curated_collections.journey_id` diventano **NOT NULL** (oggi soft).
  Stesso backfill: artifact orfano → journey "Archivio storico".
- `projects` resta come tabella legacy (NON eliminata in P0), ma diventa
  **subordinata**: ogni journey ha un `project_id` opzionale per riferimento
  catastale/portfolio. Il primario di lavoro è `design_journeys.id`.

---

## §3 · Lifecycle Diagram

### 3.A · Lead → Prospect → Client lifecycle (relationale)

```
   ┌─────────────────────┐
   │ web visitor         │
   │ (no account row)    │
   └──────────┬──────────┘
              │ /begin-journey 3-step
              ▼
   ┌─────────────────────┐
   │ LEAD                │  account_lifecycle = "lead"
   │ - account row       │  journey: NONE
   │ - 1 interaction     │  → visibile in /relations/inbox (oggi /relations/leads)
   │ - closed_answers JSON
   └──────────┬──────────┘
              │ studio: "qualifica" CTA (discovery call, brief)
              ▼
   ┌─────────────────────┐
   │ PROSPECT            │  account_lifecycle = "prospect"
   │ - journey CREATED   │  journey_lifecycle = "conversation_open"
   │ - referente assigned│  → visibile in /relations/inbox tab "prospect"
   │ - brief milestone   │
   │   started           │
   └──────────┬──────────┘
              │ studio: prima moodboard direction approvata
              │  OR: contract signed
              ▼
   ┌─────────────────────┐
   │ ACTIVE CLIENT       │  account_lifecycle = "active_project"
   │ - journey active    │  journey_lifecycle = "in_progress" | "presenting"
   │ - milestones        │  → visibile in /studio/pulse "Journey attive"
   │   working           │
   └──────────┬──────────┘
              │
              ├── certified_closure milestone reached
              ▼
   ┌─────────────────────┐
   │ EXISTING CLIENT     │  account_lifecycle = "existing_client"
   │ journey closed      │  journey_lifecycle = "closed" | "editioned"
   │ memory preserved    │
   └──────────┬──────────┘
              │ N anni dopo: nuovo progetto
              ▼
   ┌─────────────────────┐
   │ REPEAT CLIENT       │  account_lifecycle = "repeat_client"
   │ NEW journey opened  │  N journeys per stesso account
   └─────────────────────┘

   PARALLEL STATES (drift/abandoned)
   - DORMANT  · account no activity 6+ months · lifecycle = "archived"
   - PAUSED   · journey on_pause (volontario)
   - DRIFTING · journey lifecycle = "drifting" (signal-driven, no client action 30d+)
   - ABANDONED · journey lifecycle = "abandoned" (closure non certificata)
```

### 3.B · 10 Journey Milestones (canonici — già esistono)

| # | milestone_type | Owner | Linked artifact | Client visibility |
|---|---|---|---|---|
| 1 | `brief` | studio | journey_brief | read-only |
| 2 | `inspirations` | studio + client | curated_collection (`scope=inspirations`) | read + react |
| 3 | `moodboard_direction` | studio | moodboard (`scope=direction`) | approve |
| 4 | `material_direction` | studio | moodboard (`scope=materials`) | approve |
| 5 | `concept_design` | studio | proposal (`type=concept`) | read |
| 6 | `technical_package` | studio | proposal (`type=technical`) | read |
| 7 | `curated_selections` | studio | curated_collection (`scope=selections`) | approve |
| 8 | `site_evolution` | studio + site | files + photo updates | read |
| 9 | `final_presentation` | studio | proposal (`type=final`) | sign-off |
| 10 | `certified_closure` | studio | culmination record | read + edition CTA |

### 3.C · Unificazione `leads.progression_state` ⇄ `accounts.lifecycle_stage`

Oggi sono due colonne parallele in due tabelle. Proposta:
- **Single source of truth: `accounts.lifecycle_stage`** (più ricco)
- `leads.progression_state` diventa **derived/deprecato** (NON eliminato in P0;
  mantenuto in scrittura via trigger BEFORE INSERT/UPDATE che lo allinea ad
  `accounts.lifecycle_stage` se l'account esiste)
- Migration: `leads` resta come tabella di **intake snapshot** (closed_answers
  + behavioral_tags), ma la lifecycle vive su `accounts`.

---

## §4 · Moodboard Contextual Architecture™

### 4.A · Nuove colonne su `moodboards`

```sql
ALTER TABLE moodboards
  ADD COLUMN scope          TEXT,  -- direction | materials | inspirations
                                   -- | room_focus | lighting_study
                                   -- | hospitality | global_archive
  ADD COLUMN room_key       TEXT,  -- kitchen | living | dining | master_bedroom
                                   -- | guest_bedroom | bathroom_master
                                   -- | bathroom_guest | entry | study
                                   -- | terrace | facade | hospitality_lobby
                                   -- | hospitality_room | retail_front
                                   -- | retail_back | NULL (global)
  ADD COLUMN chapter_key    TEXT,  -- atmosphere | palette | textures
                                   -- | lighting | furniture | art
                                   -- | finishes | accessories
                                   -- | references | NULL (mixed)
  ADD COLUMN visibility     TEXT NOT NULL DEFAULT 'studio_only',
                                   -- studio_only | shared_with_client
                                   -- | client_approval_pending | approved
  ADD COLUMN approval_state TEXT NOT NULL DEFAULT 'draft';
                                   -- draft | presented | revision_requested
                                   -- | partially_approved | approved | locked
```

Indici: `(tenant_id, journey_id, room_key)`, `(tenant_id, journey_id, scope)`.

### 4.B · Catalog tables (DB-driven enum)

```
moodboard_rooms           — Blueprint-managed: il registry delle rooms
  · key (kitchen, living, …)
  · label_i18n (jsonb)
  · category (residential | hospitality | retail | office)
  · default_chapters[] (jsonb)

moodboard_chapters        — Blueprint-managed: registry capitoli
  · key (atmosphere, palette, …)
  · label_i18n (jsonb)
  · description_i18n
```

### 4.C · Esempi di moodboard contestualizzate

| Titolo | scope | room_key | chapter_key | journey_id |
|---|---|---|---|---|
| "Direzione globale · Casa Verdi" | direction | NULL | NULL | jid_001 |
| "Cucina · Atmosfera" | room_focus | kitchen | atmosphere | jid_001 |
| "Cucina · Palette materica" | room_focus | kitchen | palette | jid_001 |
| "Bagno padronale · Pietre" | room_focus | bathroom_master | textures | jid_001 |
| "Studio illuminotecnico · Living" | lighting_study | living | lighting | jid_001 |
| "Archivio Hospitality 2024" | global_archive | NULL | NULL | NULL (no journey) |

### 4.D · Workspace UX (visualizzazione)

`/studio/journey/:jid#moodboards` mostra le moodboard di quella journey
raggruppate **per room**, poi **per chapter**. Vista alternativa: per
milestone (es. "Tutte le moodboard collegate a `material_direction`").

`/studio/library/moodboards` (solo admin/owner) → archivio globale del
tenant, leggibile in sola lettura come "ispirazione interna" senza journey.

---

## §5 · Struttura proposta delle 3 viste

### 5.A · Client Profile™ (`/journey/:jid`)

> "La vista emozionale del Design Journey™"

Layout: **single-column cinematic** (Atelier preset), NO sidebar SaaS.

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER · brand mark + nome cliente + lifecycle hint        │
│  "Bentornata, Maria. Il tuo Design Journey™."               │
├─────────────────────────────────────────────────────────────┤
│  HERO ATMOSPHERIC                                            │
│  · Atmospheric Panel della journey corrente                  │
│  · Quote estratta dal brief                                  │
├─────────────────────────────────────────────────────────────┤
│  TIMELINE EDITORIALE                                         │
│  · 10 milestone in 2 file orizzontali (mobile: 1 col)        │
│  · Hover: titolo cinematic + status                          │
│  · Click su milestone → scrolla al capitolo                  │
├─────────────────────────────────────────────────────────────┤
│  CAPITOLI (=milestones espansi inline)                       │
│  Capitolo I · Il tuo brief                                   │
│  Capitolo II · Ispirazioni curate (CTA: "Reagisci")          │
│  Capitolo III · Direzione moodboard (CTA: "Approva")         │
│  ...                                                         │
├─────────────────────────────────────────────────────────────┤
│  IL TUO REFERENTE                                            │
│  · Foto + nome + bio + "Scrivi" + "Possiamo sentirci"        │
├─────────────────────────────────────────────────────────────┤
│  PROSSIMO PASSO                                              │
│  · CTA narrativa (es. "Vorremmo sapere cosa pensi della      │
│    direzione · Approva o richiedi revisione")                │
└─────────────────────────────────────────────────────────────┘
```

NO: dashboard, tabelle, badge "1/3 unread", filter UI, search, settings.

### 5.B · Workspace™ (`/studio/journey/:jid`)

> "La vista operativa del Design Journey™"

Layout: **3-zone** — Top KPI bar / left Timeline rail / right Tabbed canvas.

```
┌─────────────────────────────────────────────────────────────────┐
│ JOURNEY HEAD · Cliente · Lifecycle · Tier · Referente · Health │
│ [Approva] [Presenta] [Pausa] [Chiudi]                           │
├──────────────┬──────────────────────────────────────────────────┤
│ TIMELINE     │ TABBED CANVAS                                    │
│ ── brief ✓   │ [Brief] [Moodboards] [Materials] [Proposals]     │
│ ── inspir. ◐ │ [Files] [Conversations] [Appointments] [Pulse]   │
│ ── moodboard │                                                  │
│ ▶ material   │ ┌────────────────────────────────────────────┐  │
│ ── concept   │ │ Tab attivo: Moodboards                     │  │
│ ── tech pkg  │ │ Filtri: Room ▾  Chapter ▾  Scope ▾         │  │
│ ── select    │ │ ├ Kitchen                                  │  │
│ ── site      │ │ │ ├ Atmosphere [presented]                 │  │
│ ── present   │ │ │ ├ Palette [approved]                     │  │
│ ── closure   │ │ ├ Bathroom master                          │  │
│              │ │ │ ├ Textures [draft]                       │  │
│              │ │ [+ Aggiungi moodboard contestuale]         │  │
│              │ └────────────────────────────────────────────┘  │
└──────────────┴──────────────────────────────────────────────────┘
```

I tab attualmente sparsi (calendar, messages, activity, reports)
diventano **tab DENTRO** la singola journey. Il globale "Pulse" resta a
`/studio/pulse` come overview cross-journey.

### 5.C · DJ Timeline (componente condiviso)

Componente React **unico** `<JourneyTimeline />` con varianti:
- `variant="editorial"` (Client Profile) — capitoli narrativi
- `variant="operational"` (Workspace) — clickable, drag-to-reorder owner
- `variant="compact"` (lista journeys studio) — 10 dots

Stessa data source (`/api/journeys/:jid/timeline`), 3 rendering.

---

## §6 · Flow operativo studio (proposta)

### 6.A · Studio Dashboard Home (`/studio/pulse`)

Una sola schermata "Sala regia":

```
GRID 3 colonne (mobile: 1):

┌─────────────────┬─────────────────┬─────────────────┐
│ INBOX           │ JOURNEY ATTIVE  │ ATTENZIONI      │
│ (lead → quali-  │ (cards per stato:│ (health signals: │
│  fy CTA)        │  in_progress,   │  drift_warning, │
│  3 nuovi leads  │  presenting,    │  silence_alert) │
│                 │  drifting)      │                 │
└─────────────────┴─────────────────┴─────────────────┘

ROW 2:
┌───────────────────────────────────────────────────────┐
│ AGENDA · Prossimi 7 giorni (appointments + deadlines) │
└───────────────────────────────────────────────────────┘

ROW 3:
┌───────────────────────────────────────────────────────┐
│ MEMORIA STUDIO · Ultime cose successe (timeline events)│
└───────────────────────────────────────────────────────┘
```

### 6.B · Lavorare a una journey (single-task focus)

```
1. Click su una card "Journey attiva" in /studio/pulse
   → entra in /studio/journey/:jid
2. Vede la timeline con il milestone corrente highlighted
3. Click su un milestone → si apre il tab corrispondente:
   - brief → tab "Brief" (read closed_answers + note studio)
   - moodboard_direction → tab "Moodboards" filtrato per scope=direction
   - material_direction → tab "Moodboards" filtrato per scope=materials
   - ...
4. Quando ha qualcosa da mostrare al cliente:
   - cambia `approval_state` da `draft` → `presented`
   - automatic: timeline_event "Direzione presentata · Maria sarà notificata"
   - automatic: email "Una nuova tappa del tuo Journey ti aspetta"
5. Cliente apre /journey/:jid, vede la CTA "Reagisci" sul capitolo
6. Cliente approva → `approval_state=approved` → milestone status=approved
7. Studio vede signal "Direzione approvata" nel pulse
```

### 6.C · Onboarding (lead → prospect)

```
1. Public visitor → /begin-journey (3 step)
2. Submit → 
   - account row creata (lifecycle_stage='lead')
   - lead row creata (snapshot intake)
   - silent magic link → /journey/:newJourneyId
   - human_assignment → primary_designer assigned
3. Studio vede in /studio/pulse → INBOX 1 nuovo lead
4. Studio click "Qualifica" → review brief, schedule discovery call
   → CTA "Promuovi a Prospect" 
   → account.lifecycle_stage='prospect'
   → design_journey CREATED (lifecycle_state='conversation_open')
   → primo milestone 'brief' istanziato + status='in_progress'
5. Da qui in poi tutto è journey-bound.
```

### 6.D · Single-screen rule

**Regola di oro UX**: lo studio non deve mai aprire più di 2 schermate
contemporaneamente per fare un'azione. Tutto ciò che riguarda **una**
journey deve essere accessibile da `/studio/journey/:jid` tramite tab.
Niente più `/workspace/proposals/:id/compose` standalone — diventa modal
o pane dentro la journey.

---

## §7 · Roadmap di implementazione (3 fasi)

### **FASE 1 · Schema lock & semantic enforcement** (DB + API, no UI)
> Obiettivo: rendere il DB allineato all'ossatura. Nessun nuovo componente UI.

- `M1` — Migration `107_dj_operational_lock.sql`:
  - `moodboards`: ADD `scope`, `room_key`, `chapter_key`, `visibility`, `approval_state`
  - `moodboard_rooms`, `moodboard_chapters` (catalog tables) + seed iniziale
  - `journey_briefs` (1:1 con design_journeys) — pull `closed_answers` da leads
  - `design_journeys.account_id` → backfill + NOT NULL
  - `moodboards/proposals/curated_collections.journey_id` → backfill + NOT NULL
  - VIEW `journey_overview` (KPI + counts + last activity)
- `M2` — Trigger `accounts_lifecycle_sync()`: mantiene `leads.progression_state`
  allineato a `accounts.lifecycle_stage` quando esiste l'account
- `M3` — API `GET /api/journeys/:jid` (full snapshot: account + brief +
  milestones + artifacts grouped by room/chapter + timeline + health)
- `M4` — Pytest: regressioni FK NOT NULL su artifact creation

### **FASE 2 · URL canonicalization + 3 viste vacant** (rename + redirects)
> Obiettivo: stabilire i nuovi URL canonici con redirect dalle vecchie rotte.

- `R1` — `/journey/:jid` (Client Profile) — alias di `/client/journey/:jid`
- `R2` — `/studio/journey/:jid` (Workspace) — redirect da `/workspace/projects/:id` via lookup
- `R3` — `/studio/journey/:jid/step/:milestoneType` — rename da `/journey/:projectId/step/...`
- `R4` — `/studio/pulse` — diventa primary home (sposta `/dashboard/pulse`)
- `R5` — `/studio/library/moodboards` — archivio globale, separato
- `R6` — `<JourneyTimeline variant=...>` componente condiviso

### **FASE 3 · Moodboard contextual UI + Lifecycle unification**
> Obiettivo: rendere visibile e operativo il modello contestuale.

- `U1` — Moodboard create flow: chiede `scope/room/chapter`
- `U2` — Workspace tab "Moodboards" raggruppato per room+chapter
- `U3` — Client Profile mostra solo moodboard `visibility=shared_with_client+`
- `U4` — `/relations/inbox` (unified) sostituisce `/relations/leads|prospects|accounts`
  con tab interni filtrati per `lifecycle_stage`
- `U5` — Lifecycle CTAs ("Qualifica → Prospect", "Apri Journey", "Promuovi a Client")

### **FUORI SCOPE ITER168** (esplicitamente non-goals)
- Atmospheric Panels polish
- Relationship Signals™ insights translation
- Chameleon AI / Intelligence
- Notifications redesign
- Media Library v3
- Email Market Awareness
- Preview harness cleanup
- Performance optimization

---

## §8 · Non-functional requirements

- **Zero data loss**: tutte le migrations sono additive + backfill.
- **Idempotency**: ogni script DB re-runnable.
- **Backwards-compat URLs**: le vecchie URL emettono 301/302 ai nuovi
  canonici per 1 sprint, poi possono essere rimosse.
- **i18n governance**: ogni nuova label passa da `editorial_blocks`. NO hardcoded.
- **Test gate**: pytest backend per ogni endpoint nuovo prima della UI.

---

## §9 · Decision points (richiedono OK utente prima di partire)

1. **`design_journeys.account_id NOT NULL`**: ok forzare? (richiede backfill
   "Cliente archiviato" per journey orfane — se esistono)
2. **`projects` legacy**: la mantengo come tabella subordinata o procediamo
   a deprecation completa? (raccomando: mantenere in P0, deprecation futura)
3. **`/relations/leads|prospects|accounts` → `/relations/inbox` unico**:
   ok unificare con tab? (riduce 3 schermate a 1)
4. **`/workspace/calendar | activity | messages | reports`**: ok spostare
   dentro la singola journey come tab, e tenere solo `/studio/pulse` come
   global? Oppure tenere `/studio/calendar` cross-journey?
5. **Moodboard rooms/chapters**: parto con il catalog IT seed di §4.B,
   o ti faccio prima un Blueprint admin per gestirli?
6. **Naming**: "Workspace™" vs "Studio Operativo" vs "Sala Regia"?
   Oggi la URL è `/workspace`, propongo `/studio` come prefisso.

---

## §9.5 · PRINCIPI LOAD-BEARING (aggiunti post-review utente)

### 9.5.A · Milestone ELASTICHE, non waterfall

Le 10 milestone canoniche sono **template narrativo**, non gate waterfall.
Nel mondo reale:
- alcuni clienti **saltano** step (es. no concept, vanno diretti a tech)
- alcuni **tornano indietro** (riapertura material_direction dopo concept)
- alcuni fanno **solo** un sotto-insieme (es. solo "Bathroom Materials" come consulenza spot)
- alcuni **partono da metà** (es. cliente arriva con brief esterno, parte da inspirations)
- alcuni aprono **filoni paralleli** (kitchen track + bathroom track + lighting track contemporanei)

Implicazioni schema (incluse in migration 107):

```sql
ALTER TABLE journey_milestones
  ADD COLUMN is_applicable  BOOLEAN NOT NULL DEFAULT TRUE,
    -- false → milestone NON pertinente per questo cliente (es. no proposals)
  ADD COLUMN skipped_at     TIMESTAMPTZ,
  ADD COLUMN skipped_reason TEXT,
  ADD COLUMN reopened_at    TIMESTAMPTZ,
    -- una milestone approved può essere riaperta → status=in_progress
  ADD COLUMN parallel_track TEXT;
    -- 'main' | 'kitchen' | 'bathroom_master' | 'lighting' | 'hospitality'
    -- NULL = main track (default)
```

E i nuovi `status` ammessi (CHECK relaxato):
- `not_started` · `in_progress` · `presented` · `revision_requested`
- `partially_approved` · `approved` · `closed`
- **NEW**: `skipped` · `not_applicable` · `reopened` · `parallel_active`

Lo Studio può quindi:
- attivare/disattivare milestone per cliente
- aprire MULTIPLE istanze della stessa milestone su `parallel_track` diversi
  (es. 3 istanze di `moodboard_direction`: main, kitchen, bathroom)
- riaprire una milestone già approved (`reopened_at` registra la riapertura)

> Il Client Profile™ rende solo le milestone `is_applicable=true` e con
> status diverso da `not_applicable/skipped`. Lo Workspace™ le mostra
> tutte (con dimming visivo per quelle dismesse).

### 9.5.B · 2 layer separati (NON confondere)

```
LAYER 1 · JOURNEY LIFECYCLE (relazione)
  conversation_open → in_progress → presenting → drifting/on_pause
                                  → approved → closed → editioned
                                  → abandoned

LAYER 2 · MILESTONE STATE (operativo, per ogni milestone)
  not_started → in_progress → presented → revision_requested
              → partially_approved → approved → closed
              → skipped / not_applicable / reopened / parallel_active
```

Regole di interlock:
- la **journey lifecycle** può evolvere indipendentemente dalle milestone
  (es. journey può essere `on_pause` mentre alcune milestone restano
  `presented` in attesa di feedback)
- la **milestone state** è azionabile dallo Studio e/o dal Cliente
  (approve/revision)
- NESSUNA milestone "blocca" l'altra automaticamente. Lo Studio decide
  l'ordine narrativo. Le dipendenze sono **soft** (visualizzate come
  hint, non come constraint).

Tradotto in API:
- `PATCH /api/journeys/:jid/lifecycle` → cambia lifecycle (livello relazionale)
- `PATCH /api/journeys/:jid/milestones/:mid/status` → cambia milestone state
  (livello operativo)

I due endpoint NON si triggerano a vicenda. Mai. Lo studio decide.

### 9.5.C · Multi-track parallelo (filoni)

Una journey può avere N "track" attivi simultaneamente:

```
Journey "Casa Verdi"
├── Track MAIN (default · narrativa progettuale completa)
│   ├── milestone: brief [approved]
│   ├── milestone: inspirations [approved]
│   └── milestone: moodboard_direction [in_progress]
├── Track KITCHEN (filone parallelo · approfondimento cucina)
│   ├── milestone: moodboard_direction [parallel_active]
│   └── milestone: material_direction [in_progress]
└── Track BATHROOM_MASTER (filone parallelo)
    └── milestone: material_direction [presented]
```

Implementato via `journey_milestones.parallel_track`. UI Studio raggruppa
visualmente per track. UI Cliente li **fonde** in una timeline editoriale
unica (mostra solo i milestone più rilevanti per cliente, con badge "Cucina"
o "Bagno padronale" come hint).

---

## §10 · Cosa NON sto facendo ora

- Non sto scrivendo codice.
- Non sto modificando schema.
- Non sto toccando UI.
- Non sto creando migrations.
- Non sto cambiando route.

Aspetto la tua revisione del documento e la risposta ai 6 decision point.

— Fine documento.
