# Editorial Relationship CRM™ — Architecture

> **Status**: Phase R-CRM-2 architecture-only sprint (Feb 18, 2026).
> Backend foundation shipped. UI follows in the next sprint per directive
> "Architecture first. Generic CRM patterns must be rejected immediately."

---

## 1. Design principle

The CRM inside MOOD for DESIGN™ is **not** a sales pipeline tool.
It is an **international relationship orchestration layer** for luxury
interiors, hospitality, architecture, specification and editorial
positioning of Made-in-Italy expansion.

Generic CRM vocabulary is **rejected**. Editorial vocabulary is canonical.

| Generic CRM       | Editorial Relationship CRM™  |
|-------------------|------------------------------|
| Lead              | Discovery contact            |
| Opportunity       | Active Direction             |
| Deal              | Collaboration                |
| Funnel / Pipeline | Relationship Journey™        |
| Lead Source       | Discovery Origin             |
| Deal Stage        | Collaboration Stage          |
| Follow-up         | Editorial Follow-up          |
| Contact           | Relationship                 |

---

## 2. Relationship entity model

```
accounts                            ← top-level relationship entity
  ├── contacts                      ← N people per account
  ├── account_markets               ← N markets per account (multi-market)
  ├── account_style_profile         ← 1 Style DNA (existing R-CRM-1)
  ├── account_team_members          ← internal collaborators
  ├── interactions                  ← every meaningful event
  ├── relationship_actions          ← next-step reminders
  │
  ├── relationship_engagement_signals    ← editorial signals (NEW)
  ├── relationship_affinities            ← intelligence snapshot (NEW)
  ├── relationship_projects              ← project linkages (NEW)
  ├── relationship_inspirations          ← design_reference links (NEW)
  └── relationship_material_affinities   ← material attraction (NEW)
```

Accounts extended with editorial fields (migration 041):

| Field                          | Purpose                                                      |
|--------------------------------|--------------------------------------------------------------|
| `market_id`                    | Primary market FK (multi-market via `account_markets`)       |
| `cultural_profile` (JSONB)     | Cultural overlay specific to this relationship               |
| `hospitality_positioning`      | `ceremonial` / `discrete` / `wellness` / `experiential` …    |
| `editorial_register_affinity`  | Matches `markets.cultural_profile.editorial_register`        |
| `design_intent_summary`        | 1-paragraph "what this relationship is about"                |
| `luxury_perception_axis`       | `heritage_first` / `innovation_first` / `material_first` / … |
| `relationship_journey_stage`   | Canonical Editorial Journey stage (new vocabulary)           |

---

## 3. Relationship Journey™ stages (canonical)

Replaces the generic sales pipeline stages with editorial-native progression.
Seeded into `relationship_lookups.lifecycle_stage` with `metadata.canonical=true` so
the UI can show only canonical stages by default, while legacy stages
remain queryable for migration.

| Stage                       | Tone           | Editorial meaning                          |
|-----------------------------|----------------|--------------------------------------------|
| `discovery`                 | first-contact  | Anonymous → identified, no narrative yet   |
| `inspiration`               | exploration    | Browsing references, no project yet        |
| `editorial_engagement`      | narrative      | Reading market editions, registering CTAs  |
| `project_conversation`      | qualification  | Active dialogue, scope being shaped        |
| `material_exploration`      | specification  | Samples requested, materials evaluated     |
| `strategic_direction`       | design-direction | Moodboards / atmosphere alignment        |
| `specification`             | technical      | Technical specs being drafted              |
| `proposal`                  | commercial     | Proposal sent, awaiting confirmation       |
| `active_collaboration`      | delivery       | Project executing                          |
| `long_term_relationship`    | maintenance    | Referrals, repeat, brand ambassador        |

Each row in `relationship_lookups.metadata` carries `{tone, editorial_journey:true, canonical:true}` for UI filtering.

---

## 4. Editorial engagement tracking — `relationship_engagement_signals`

Every meaningful editorial interaction is a **signal**.
Polymorphic on (`entity_type`, `entity_id`) so the same table covers:

- `viewed_article` / `viewed_market_edition` (magazine_article + variant)
- `viewed_project` / `viewed_moodboard` / `viewed_material`
- `clicked_cta` / `submitted_form` / `downloaded_proposal`
- `requested_sample` / `requested_showroom_visit` / `requested_consultation`
- `shared_article` / `saved_inspiration` / `opened_email`
- `scrolled_long_form` / `watched_video` / `quoted_material` / `specified_product`

Cultural overlay denormalised on each row:

- `market_id`, `locale_code`, `surface` (where it happened)
- `editorial_register`, `atmosphere_tags`, `material_tags`
- `cta_label`, `cta_intent` (private_consultation / showroom_visit / …)
- `signal_weight` (multiplier for affinity scoring)
- `dwell_seconds`, `scroll_depth_pct` (depth signal)
- `session_id` (correlate multi-signal sessions)

---

## 5. Relationship Intelligence™ — `relationship_affinities`

1:1 snapshot per account, recomputed by the affinity engine (heuristic
today; AI overlay later via `intelligence_payload` JSONB).

Computed signals exposed to the UI:

| Field                              | Meaning                                                 |
|------------------------------------|---------------------------------------------------------|
| `preferred_atmosphere`             | Most-weighted atmosphere tag                            |
| `preferred_atmosphere_tags`        | Top-8 atmosphere affinities                             |
| `preferred_materials`              | Top-8 material affinities                               |
| `preferred_cta_intent`             | The CTA flavour that converts                           |
| `preferred_editorial_register`     | The cultural register that resonates                    |
| `most_engaged_market_edition_id`   | The single Market Edition driving most engagement       |
| `hospitality_orientation_score`    | 0-100 — biases hospitality offerings vs furniture       |
| `specification_orientation_score`  | 0-100 — biases technical specs vs narrative content     |
| `long_form_engagement_score`       | 0-100 — biases long-read editorial vs quick CTAs        |
| `editorial_cadence_score`          | 0-100 — how regularly engagement occurs                 |
| `luxury_perception_alignment`      | 0-100 — heritage vs innovation axis match               |

---

## 6. Project linkage system

```
relationship_projects (account_id, project_id, role, collaboration_stage, …)
```

A single relationship can link to **multiple** projects with **different roles**:

- `client` — the relationship IS the project commissioner
- `architect` — referred / specified
- `specifier` — chose materials
- `observer` — interested but uncommitted
- `referral_source` — referred someone else

`collaboration_stage` snapshots the Editorial Journey™ stage **at the moment
of linkage** so historical context is preserved even if the relationship
moves forward.

---

## 7. Market intelligence integration

```
account_markets (account_id, market_id, is_primary, engagement_strength, notes)
```

- `accounts.market_id` is a fast pointer to the primary market.
- `account_markets` supports many-to-many for multi-market relationships
  (e.g. a developer building in EN-AE and EN-GB simultaneously).
- `engagement_strength` (0-100) is the per-market signal weight, derived
  from engagement signals tagged with `market_id`.

The `relationship_intelligence_v` view aggregates these counts.

---

## 8. Moodboard / inspiration linkage

Moodboards already linked via `interactions.moodboard_id`.
Pinterest Research™ references (design_reference) get their own table:

```
relationship_inspirations (account_id, reference_id, source, resonance_note)
  source ∈ {saved_by_account, shared_by_advisor, inferred_from_engagement}
```

This separates **what the relationship saved themselves** vs **what the
advisor curated for them** vs **what the system inferred** (e.g. they
viewed it 4 times).

---

## 9. Material affinity tracking

```
relationship_material_affinities (account_id, material_id, attraction_score,
                                  signal_count, last_engaged_at,
                                  sample_requested, specified)
```

`attraction_score` (0-100) is upserted by the affinity engine based on
engagement_signals tagged with `entity_type='material'`.
The `sample_requested` and `specified` booleans are explicit milestones
in the material specification journey.

---

## 10. Endpoints (Phase R-CRM-2)

All under `/api/relationships`:

```
POST   /accounts/{aid}/engagement                      log signal
GET    /accounts/{aid}/engagement                      list signals
GET    /accounts/{aid}/affinities                      read snapshot
POST   /accounts/{aid}/affinities/recompute            recompute snapshot

GET    /accounts/{aid}/projects                        list project links
POST   /accounts/{aid}/projects                        link a project
DELETE /accounts/{aid}/projects/{pid}                  unlink a project

GET    /accounts/{aid}/inspirations                    list inspiration links
POST   /accounts/{aid}/inspirations                    link a design_reference
DELETE /accounts/{aid}/inspirations/{ref_id}           unlink

GET    /accounts/{aid}/material-affinities             list affinities
POST   /accounts/{aid}/material-affinities             upsert affinity

GET    /accounts/{aid}/markets                         list linked markets
POST   /accounts/{aid}/markets                         link/upsert market

GET    /intelligence                                   dashboard view
                                                       (joins signals + affinities + counts)
```

---

## 11. UX principles for the future UI (next sprint)

- **Editorial cards**, not pipeline boards.
- **Calm orchestration**: no aggressive Kanban, no red KPI dashboards.
- **Project narrative** > funnel column.
- **Market overlays**: filter by market, language, register.
- **Atmosphere indicators** as primary visual language.
- **Material affinities** surfaced as ranked chips.
- **Relationship graph** view, not linear timeline (the timeline still
  exists for chronology but is one tab among many).

The future Relationship Profile™ panel should display:

```
[Identity]                  [Market overlay]    [Editorial register affinity]
[Hospitality orientation]   [Preferred atmosphere chips]
[Preferred materials chips] [Linked projects (cards)]
[Linked moodboards]         [Linked inspirations (Pinterest grid)]
[Relationship Journey timeline + stage transition]
[Editorial engagement signals (curated, not feed)]
```

---

## 12. What this sprint did NOT build

- **No UI**. Per directive.
- **No AI affinity worker**. The heuristic recompute endpoint is
  deterministic and sufficient for v1; the AI overlay will write into
  `relationship_affinities.intelligence_payload` JSONB.
- **No web pixel SDK**. Engagement signals are currently logged via
  internal API calls (e.g. from the magazine renderer when an article
  view ends). A public pixel SDK is a separate workstream.
- **No `Editorial Adaptation Coverage Map`**. Reserved for the
  governance dashboard sprint.

