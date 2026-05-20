# Sprint G.1 — Semantic Architecture Lock™
**Date**: 21 Feb 2026 · iter101  
**Type**: Schema strengthening · NO UI · invisible foundation.  
**Status**: 🔒 LOCKED architecture spec.  
**Audit reference**: `/app/memory/JOURNEY_ALIGNMENT_AUDIT.md` (Sprint G.0).

> Questo NON è "database refactor".  
> È **semantic architecture lock**: bloccare definitivamente il Journey come root entity del sistema.  
> Ogni FK riflette il comportamento reale del Journey — non è additiva, è semantica.

---

## 1 · Goals

1. **Journey diventa root operational entity** — accessibile via Account (FK forte) e via Project (esistente).
2. **Ogni artifact appartiene a Journey + Step** — tramite FK soft nullable (`journey_id`, `milestone_id`).
3. **Account/Contact restano root entities relazionali** indipendenti (possono vivere senza Journey).
4. **Versioning è first-class** — `milestone_versions` esiste già (F.B); confermato non si tocca.
5. **Feedback è relazione strutturata** — `milestone_feedback` esiste già (F.B); confermato.
6. **Analytics future-ready** — canonical event taxonomy + health signals.
7. **Nessun artifact standalone resta orfano** — backfill best-effort + tracciabilità degli orfani.

---

## 2 · Entity Lifecycle Map™

| Entity | Nasce quando… | Creata da | Appartiene a | Evolve quando… | Archiviata quando… |
|---|---|---|---|---|---|
| **Account** | Public form / manual add / import | system / tenant_admin | tenant | nuove interactions, voce arriva, journey aperto | `lifecycle_stage='archived'` (esiste già) |
| **Contact** | Account creato / aggiunto manualmente | tenant_admin | account | aggiornamenti dati, attività registrata | `lifecycle_stage='archived'` |
| **Design Journey™** | Lead converted / project created (post-G.2: anche da "Inizia il Design Journey") | system + assigned_to | account + project | milestones progrediscono, voci arrivano, capitoli scritti | `lifecycle_state='closed'` / `'abandoned'` |
| **Journey Milestone** | Auto-creato con il Journey (10 pietre) | system | journey | transizioni di status (in_progress→presented→approved) | `status='closed'` (al Certified Closure) |
| **Milestone Version** (capitolo) | Studio crea capitolo proposto | studio user | milestone | feedback ricevuti, evoluzione cliente | mai (immutable) |
| **Milestone Feedback** (voce) | Cliente o studio emette voce curatoriale | client/studio user | milestone (+ optional version) | mai (immutable) |
| **Journey Timeline Event** | Auto-emesso da transizioni/voci/capitoli | system | journey | mai (append-only) | mai |
| **Step Artifact** (moodboard, proposal, curated_collection) | Studio user crea artifact dentro uno step | studio user | journey + milestone (nuovi FK) | aggiornamenti contenuto, share token | `archived_at` (esiste già su moodboards) |
| **Journey Health Signal** (NEW) | Sistema rileva drift/silence/overdue | system (background) | journey | auto-clear quando azione correttiva avviene | rotates (TTL 60gg) |

### Lifecycle states canonici (G.1)

**Journey lifecycle_state** (NEW column, superset di overall_status):
```
conversation_open  · prima della creazione del project (G.2)
in_progress        · il viaggio è iniziato (esistente)
presenting         · capitoli condivisi col cliente, attesa voce
drifting           · silence_alert (no voce in 14gg dopo presented)
on_pause           · pausa volontaria del cliente
approved           · direzione condivisa raggiunta
closed             · certified closure (esistente)
editioned          · cultural edition generata dalla closure (G.10)
abandoned          · journey terminato senza closure
```

⚠️ **Backward compat**: `overall_status` resta con i 2 valori ('in_progress', 'closed').
`lifecycle_state` lo estende. Triggers o app code possono sincronizzare i due.

---

## 3 · Journey Event Model™

### Canonical Event Taxonomy (10 events)

`journey_timeline_events.event_canon` (NEW column, CHECK constraint):

| event_canon | Quando viene emesso | Already used as `event_type`? |
|---|---|---|
| `journey_created` | nuovo `design_journeys` row | ⚠️ oggi `journey_started` — alias |
| `brief_started` | milestone 'brief' status→in_progress | ⚠️ oggi `milestone_started` su brief |
| `inspirations_aligned` | milestone 'inspirations' status→approved | NEW |
| `moodboard_uploaded` | moodboard creato dentro un milestone | NEW |
| `revision_requested` | milestone status→revision_requested OR feedback tone='reorient' | ⚠️ oggi `milestone_revision_requested` |
| `version_approved` | milestone status→approved | ⚠️ oggi `milestone_approved` |
| `client_feedback_added` | nuovo `milestone_feedback` row | ⚠️ oggi `client_voice` |
| `journey_paused` | lifecycle_state→on_pause | NEW |
| `journey_abandoned` | lifecycle_state→abandoned | NEW |
| `journey_completed` | lifecycle_state→closed (Certified Closure) | ⚠️ oggi `journey_closed` |

**Compat**: i vecchi `event_type` restano (free-text). `event_canon` aggiunge la taxonomy canonica.
Trigger o app code popolano `event_canon` quando il `event_type` ricade nei pattern noti.

### Eventi NON narrativi (technical/analytics only)
- `chapter_added` (esistente da F.B) → maps to `client_feedback_added` quando feedback emesso, o solo timeline event quando capitolo aggiunto
- `milestone_partially_approved` → resta come variant di `version_approved`

---

## 4 · Artifact Classification™

| Concetto | Tipo | Tabella | Vive senza Journey? | FK Journey-side | FK Milestone-side |
|---|---|---|---|---|---|
| **Moodboard** | Step Artifact | `moodboards` | ⚠️ Sì (legacy) ma deprecato | ➕ `journey_id` (G.1) | ➕ `milestone_id` (G.1) |
| **Moodboard Page** | Sub-artifact | `moodboard_pages` | ❌ Solo via moodboard | (via moodboard.journey_id) | (via moodboard.milestone_id) |
| **Proposal** | Step Artifact | `proposals` | ⚠️ Sì (legacy) ma deprecato | ➕ `journey_id` (G.1) | ➕ `milestone_id` (G.1) |
| **Proposal Market Version** | Version of artifact | `proposal_market_versions` | ❌ via proposal | (via proposal) | (via proposal) |
| **Curated Collection** | Step Artifact + Global archive (dual) | `curated_collections` | ✅ Sì (può essere studio-private archive) | ➕ `journey_id` (G.1, nullable) | ➕ `milestone_id` (G.1, nullable) |
| **Saved Reference** | Attachment | `saved_references` | ✅ Sì (FK to curated_collection nullable) | (via curated_collection.journey_id) | (via curated_collection.milestone_id) |
| **Material Asset** | Sub-artifact (bridge) | `material_assets` | ✅ Sì (è bridge material↔media) | — | — |
| **Material Registry entry** | Curatorial archive | `material_registry` | ✅ Sì (sempre globale) | — | — |
| **Media Library item** | Global Archive | `media_library` | ✅ Sì | — | — |
| **Inspirations Item** | Global Archive | `inspirations_items` | ✅ Sì | — | — |
| **Inspirations Board** | Studio collection | `inspirations_boards` | ✅ Sì | — | — |
| **Milestone Version** | Version (chapter) | `milestone_versions` | ❌ richiede milestone | (via milestone.journey_id) | esistente |
| **Milestone Feedback** | Feedback (voice) | `milestone_feedback` | ❌ richiede milestone | (via milestone.journey_id) | esistente |
| **Cultural Edition Draft** | Editorial artifact (closure output) | `cultural_edition_drafts` | ✅ Sì (storico) | (futuro: `journey_id` opzionale in G.10) | — |
| **Preview Token** | Snapshot/Share | `preview_tokens` | ❌ richiede collection | (via curated_collection.journey_id) | — |
| **Journey Timeline Event** | Analytics narrative | `journey_timeline_events` | ❌ richiede journey | esistente | esistente (soft) |
| **Tenant Activity Event** | Studio analytics | `tenant_activity_events` | ✅ Sì (tenant-wide) | — | — |

### Definizioni nette

- **Artifact** = entità progettuale che vive per un Journey e Step (Moodboard, Proposal, Curated Collection con journey).
- **Version** = capitolo / variante / istanza temporale dell'artifact (Milestone Version, Proposal Market Version).
- **Snapshot** = stato immutabile di un artifact in un momento (Preview Token, Moodboard Version).
- **Attachment** = file/dato secondario legato a un artifact (Saved Reference, Moodboard Page).
- **Global Archive** = entità sempre disponibili indipendentemente dal Journey (Media Library, Inspirations, Material Registry, Brands).

---

## 5 · Legacy Mapping Strategy™

### Cosa succede ai dati esistenti?

| Entità esistente | Strategia | Backfill |
|---|---|---|
| **Existing `projects` rows** | Restano. Sono il "container" del Journey. | Niente da fare (Journey auto-created per project quando si accede al tab). |
| **Existing `design_journeys` rows** | Aggiungono `account_id` (best-effort via `relationship_projects.account_id WHERE project_id=design_journeys.project_id`). | UPDATE in migration. Se non trovato → resta NULL. |
| **Existing `moodboards` rows** | Aggiungono `journey_id` (via design_journeys lookup per project_id) e `milestone_id` (heuristic → milestone moodboard_direction). | UPDATE in migration. Se journey non esiste → resta NULL (orfano legacy). |
| **Existing `proposals` rows** | Aggiungono `journey_id` (via project_id) e `milestone_id` (heuristic → milestone final_presentation). | Stessa logica moodboards. |
| **Existing `curated_collections` rows** | NULL su `journey_id`/`milestone_id` (sono nate come collezioni studio-private senza progetto). | Nessun backfill. Restano come Global Archive. Possono essere "promosse" a Step Artifact via PATCH futuro. |
| **Existing `journey_timeline_events` rows** | `event_canon` resta NULL inizialmente. | Backfill via UPDATE che mappa pattern noti (journey_started → journey_created, ...). |
| **Orphan moodboards** (project_id punta a project cancellato) | Restano accessibili come archive. | Nessuna pulizia automatica. |

### Fallback strategy

- Quando un endpoint chiede "moodboard del journey X", e un moodboard ha `journey_id IS NULL` ma `project_id = (journey.project_id)` → lo includiamo comunque via JOIN su `project_id` (compat layer).
- Quando un endpoint chiede "artifacts del journey X", la VIEW `journey_artifacts` (creata in G.1) unifica i due path.
- Nessun DELETE, nessun RENAME. Solo ADD COLUMN + UPDATE backfill.

### Rollback strategy

- Tutti i nuovi colonne sono **nullable** + **no default richiesto** → `ALTER TABLE ... DROP COLUMN` è sicuro.
- Le 2 nuove tabelle (`journey_health_signals`) e la VIEW (`journey_artifacts`) sono additive.
- Il CHECK su `event_canon` è opzionale (nullable) → non rompe nessun INSERT esistente.
- Script di rollback fornito a fine spec.

---

## 6 · Future Analytics Readiness™

Lo schema deve **già supportare** queste query senza ulteriori migrations:

| Analytics question | SQL pattern supportato dopo G.1 |
|---|---|
| **Drop-off rate** per step | `SELECT milestone_type, COUNT(*) FILTER (WHERE status='not_started')*1.0/COUNT(*) FROM journey_milestones GROUP BY milestone_type` |
| **Completion rate** | `SELECT COUNT(*) FILTER (WHERE lifecycle_state IN ('closed','editioned'))*1.0/COUNT(*) FROM design_journeys` |
| **Approval cycle time** | `SELECT AVG(approved_at - started_at) FROM journey_milestones WHERE status='approved'` |
| **Revision cycles per journey** | `SELECT journey_id, COUNT(*) FROM milestone_feedback WHERE kind IN ('request_variant','wants_lighter','wants_more_material') GROUP BY journey_id` |
| **Journey health** | `SELECT * FROM journey_health_signals WHERE journey_id=X AND resolved_at IS NULL` |
| **Relationship health** (already exists) | `SELECT relationship_health FROM accounts WHERE id=Y` |
| **Artifact engagement** | `SELECT journey_id, COUNT(*) FROM moodboards WHERE journey_id IS NOT NULL GROUP BY journey_id` |
| **Voices per journey** | `SELECT journey_id, COUNT(*) FROM milestone_feedback f JOIN journey_milestones m ON m.id=f.milestone_id GROUP BY journey_id` |
| **Time to first voice** | `SELECT MIN(f.created_at) - j.started_at FROM milestone_feedback f JOIN journey_milestones m ... JOIN design_journeys j ...` |
| **Studio-wide silence alerts** | via `journey_health_signals` table |

Tutti questi sono **possibili da G.1 in poi** senza ulteriore schema work.

---

## 7 · NO UI Refactor (vincolo immutabile per G.1)

- ❌ NO Sidebar v5
- ❌ NO Dashboard redesign
- ❌ NO CRM redesign
- ❌ NO Moodboard redesign
- ❌ NO Lead form refactor
- ❌ NO new endpoints expostosti (eccetto eventuali test endpoints, non in produzione)

✅ **SI A**:
- Migration 063
- Apply script
- Pytest validation
- Spec doc (questo)
- Optional: VIEW `journey_artifacts` per future queries (internal only)

---

## 8 · Testing Strategy

### Test coverage obbligatorio

1. **Migration idempotency** — eseguibile 2 volte senza errori.
2. **No data loss** — `SELECT COUNT(*)` su ogni tabella prima/dopo è identico per: projects, moodboards, proposals, curated_collections, design_journeys, journey_milestones, accounts, contacts, milestone_versions, milestone_feedback.
3. **Backfill correctness** — `design_journeys.account_id` popolato per ≥80% dei journey legacy che hanno un `relationship_projects` match. (Le journey orfane restano NULL — OK.)
4. **FK constraints** — INSERT con `journey_id` invalido nelle nuove colonne è OK (sono soft FK senza REFERENCES per sicurezza legacy).
5. **CHECK constraint** — INSERT su `journey_timeline_events.event_canon` con valore fuori taxonomy → fail. NULL è OK.
6. **VIEW journey_artifacts** — ritorna shape `{journey_id, milestone_id, artifact_type, artifact_id, title, created_at, archived_at}`.
7. **journey_health_signals** — CRUD base funziona.
8. **Regression** — pytest del Sprint F.B (iter100) e F.A (iter94) restano verdi 100%.

### Rollback test
Script di rollback testabile su DB clone (NON eseguito su prod):
```sql
ALTER TABLE design_journeys DROP COLUMN IF EXISTS account_id;
ALTER TABLE design_journeys DROP COLUMN IF EXISTS lifecycle_state;
ALTER TABLE moodboards      DROP COLUMN IF EXISTS journey_id;
ALTER TABLE moodboards      DROP COLUMN IF EXISTS milestone_id;
ALTER TABLE proposals       DROP COLUMN IF EXISTS journey_id;
ALTER TABLE proposals       DROP COLUMN IF EXISTS milestone_id;
ALTER TABLE curated_collections DROP COLUMN IF EXISTS journey_id;
ALTER TABLE curated_collections DROP COLUMN IF EXISTS milestone_id;
ALTER TABLE journey_timeline_events DROP COLUMN IF EXISTS event_canon;
DROP VIEW  IF EXISTS journey_artifacts;
DROP TABLE IF EXISTS journey_health_signals;
```

---

## 9 · Migration plan — 063_journey_root_entity.sql

(Vedi `/app/supabase/migrations/063_journey_root_entity.sql` per l'SQL completo.)

**Sezioni**:
1. **§1 Journey root link** — `design_journeys.account_id` + `lifecycle_state` + indexes
2. **§2 Artifact root links** — `moodboards/proposals/curated_collections.journey_id + milestone_id` + indexes
3. **§3 Event canonical taxonomy** — `journey_timeline_events.event_canon` + CHECK
4. **§4 Journey health signals** — new table
5. **§5 VIEW journey_artifacts** — unified read
6. **§6 Backfills** — best-effort updates con LEFT JOIN
7. **§7 Comments** — `COMMENT ON COLUMN` per documentare semantica

---

## 10 · Root Principle (re-stated)

> Il sistema NON sta più gestendo progetti o file.  
> Sta gestendo **evoluzione relazionale progettuale**.

Lo schema deve riflettere questa verità:
- Account vive come relazione.
- Journey vive come viaggio progettuale.
- Step è la pietra miliare narrativa.
- Artifact è la materializzazione editoriale di uno step.
- Version è il capitolo di un artifact.
- Feedback è la voce curatoriale che fa evolvere il capitolo.
- Timeline Event è la memoria viva.

🔒 **End of spec.** Architettura semantica bloccata. Procedere con migration 063.
