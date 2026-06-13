# MOOD for DESIGN™ — Product Requirements Document

> **Last update:** 08 Feb 2026 — v4
> **Status:** REAL FLOW CERTIFIED (Iteration 242: 14/14 PASS) · JourneyWelcomePage P1-2 CHIUSO · CTA "Accedi al tuo Atelier™" + "Visualizza le Direzioni™" · Flusso Designer↔Cliente COMPLETAMENTE CERTIFICATO

## Original problem statement

MOOD for DESIGN™ is a Relationship Operating System for advisors,
founders and the MOOD team, designed to manage the design relationships
between studios, brands and clients. The product is evolving away from
its early CMS-style surfaces toward a SaaS-first operational OS aligned
with Salesforce Private Banking, Linear, Notion, Attio, Pitch,
Superhuman. Function before aesthetic.

## Core domains

* Knowledge Engine (brands, collections, products, materials, designers)
  · **Review Workspace™ V3.1 ✅**
* Brand Atlas, Brand Embassy, Studio Library Bridge
* CRM / Relationship layer (accounts, contacts, interactions, follow-ups)
* Notification Center (M4 · ready)
* Relationship Center (M5/M6 · planned)
* Advisor Workspace (M6 · planned)
* Project Impact™ (M7 · placeholder only — schema ready)

## Implemented (high level)

* ITER204 · Studio Library Bridge (saved entities across types)
* ITER204-B/205 · Entity Navigation Layer
* Relationship OS™ architecture deliverable + HTML wireframes
* **M4 · Internal Notification Center (04 Jun 2026)**
* **Brand Registry Enhancement™ (04 Jun 2026)** — multi-categories + Tag system
* **Review Workspace™ V3.1 (04 Jun 2026)** — 4-col workspace (PDF → Knowledge Package → Brand Atlas → Ecosistema MOOD). See `REVIEW_WORKSPACE_V3_IMPLEMENTATION_REPORT.md`.
  * Migration 129 · `entity_operational_usage` (SSoT Future Uses) + `entity_future_uses_v` (view) + `knowledge_impact_events` (ROI ledger) + `entity_project_impact` (M7 placeholder)
  * 4 endpoints: future-uses · connected-assets · project-impact · apply-correction
  * React components: KnowledgeStrip · DocumentNavigator · DocumentViewer · EntityInspector (tabs Overview/Connected/Future/Project) · AIValidation (tri-scope) · KnowledgeImpactCard · PostCertificationLaunchpad
  * 6/6 backend pytest PASS · 100% testing agent PASS · SSoT audit clean
* **KE-001 · Knowledge Engine Production Reliability (05 Jun 2026)** — persistent `extraction_jobs`, `extraction_event_log`, 60s orphan recovery scheduler, document-level retry. Migration 131 applied. AC17 passed on RIVA1920.
* **KE-002 · Knowledge Engine Control Room™ (06 Jun 2026)** — 5-component Mission Control panel (Worker Status pill 7 stati · KPI strip · Live Activity Stream · Warning Center 7 categorie · Document Queue OPEN/REVIEW/RETRY). See `KE002_CONTROL_ROOM_IMPLEMENTATION_REPORT.md` + `KE002_VISUAL_REVIEW_REPORT.md`.
* **KE-002.1 · Value Wiring (06 Jun 2026)** — chiusura 3 P0 percettivi: KPI strip su counts reali (333 prodotti/26 designer/12 materiali per RIVA1920) · semantic event stream (PRODUCT_FOUND / DESIGNER_FOUND / MATERIAL_FOUND / IMAGE_FOUND) · 6 condition-based warning filters. New file `services/knowledge_kpi.py`. Backfill endpoint `/catalog-sets/{id}/backfill-semantic-events`. See `KE002_1_VALUE_WIRING_REPORT.md`. Classification: 🟢 READY_FOR_KE003.
* **KE-003 · Knowledge Certification Workspace™ (06 Jun 2026)** — 7 P0 chiusi: Warning Deep-Link (`?type=&focus=`), Entity Inspector V3.1 (4 CTAs APPROVA/RIFIUTA/UNISCI/MODIFICA × 3 scope), Scope Correction propagazione, Real Knowledge Impact da entity.mention_count + scope, Failed Document Modal (glass-dark con error/retry/related), Certification Flow gated, Post-Certification toast 5s con KPI reali. New files: `FailedDocumentModal.jsx`+`.css`. Backend endpoint `/documents/{id}/failure-context` + `/documents/{id}/pages` (Doc Viewer P0-5b · contenuto reale per pagina). Contract fix: `needs-review` ora ritorna sempre `first_anomaly`. See `KE003_KNOWLEDGE_CERTIFICATION_WORKSPACE_REPORT.md`. Classification: 🟢 KNOWLEDGE_CERTIFICATION_READY.
* **KE-004 · Future Uses™ + Connected Assets™ (06 Jun 2026)** — 5 P0 chiusi: Future Uses con sezione duale UTILIZZATO IN / DISPONIBILE PER (8 surfaces mappate) · Connected Assets™ hub-and-spoke (10 tipologie nodo da 682 brand_entity_relations) · Knowledge Impact History timeline da `knowledge_impact_events` (8 eventi reali · scope color-coded) · Certification Metrics nel Knowledge Strip (DECISIONI · PROPAGATE · TEMPO CERT) · Operational Readiness 5 surfaces (Moodboard / Design Journey / Material Board / Client Presentation / Brand Atlas) con regole server-side. 3 nuovi endpoint backend: `impact-history`, `certification-metrics`, `operational-readiness`. New files: `OperationalReadinessPanel.jsx`, `ImpactHistoryTimeline.jsx`. See `KE004_FUTURE_USES_CONNECTED_ASSETS_REPORT.md`. Classification: 🟢 ECOSYSTEM_READY.
* **KE-005A · Moodboard Knowledge Audit (06 Jun 2026)** — READ-ONLY · Moodboard classificata LEGACY_ISLAND (0/4 hook al KE · 5/8 drift SSoT). See `KE005A_MOODBOARD_KNOWLEDGE_INTEGRATION_AUDIT.md`.
* **KE-005B.0 · Design Journey Knowledge Audit (06 Jun 2026)** — READ-ONLY · Design Journey LEGACY_ISLAND transitivo (linked_entity_id → moodboards.id, non a Brand Atlas). Proposta sprint unificato KE-005B. See `KE005B0_DESIGN_JOURNEY_KNOWLEDGE_AUDIT.md`.
* **KE-005B.0.5 · Entity Usage Architecture Review (06 Jun 2026)** — READ-ONLY · validata foundation cross-surface · 8/8 surface coperte dallo schema esistente · Entity Context Panel™ design. See `KE005B05_ENTITY_USAGE_ARCHITECTURE_REVIEW.md`.
* **KE-005B.1 · Knowledge-Native Surfaces™ Foundation (06 Jun 2026)** — backend-only · migration 132 (entity_id su moodboard_elements, entity_refs JSONB su journey_milestones, source_type/target_type su brand_entity_relations, view entity_usage_lookup_v) · service `knowledge_usage_hooks.py` riscritto (5 direttive utente · idempotente · tenant-isolated · zero scrittura in knowledge_impact_events) · side-effect attach/detach wired in `moodboards_v1.py` + `design_journey.py` · endpoint aggregator `GET /api/knowledge/entities/{id}/context-panel` (9 sezioni nell'ordine approvato) · pytest suite 9/9 PASS. See `KE005B_FOUNDATION_REPORT.md`. Classification: 🟢 FOUNDATION_READY.
* **Dashboard Editorial Redesign (07 Jun 2026)** — `AtelierDashboardPage.jsx` riscritta come "Editorial Studio". 7 sezioni: Hero immersivo (NO KPI), Spotlight "In evidenza oggi", 4 Destination cards Netflix-style (Nuovo Journey · Crea Moodboard · Material Board · Presentazione Cliente), Progetti attivi visuali (immagine + stato + ultimo movimento + cliente), MOOD Intelligence™ live (suggerimenti calcolati da DB · no LLM), Attività narrative, Ecosistema MOOD™ 8 KPI patrimonio. KPI CRM eliminati. Backend nuovo `GET /api/dashboard/ecosystem-snapshot` + `POST /api/workspace/prepare-intent`. `PersistentAlertBanner` nascosta su /dashboard. 2 nuove pagine: `WorkspacePreparePage` (wizard premium per Material Board + Presentazione Cliente). CSS editoriale `atelier-dashboard-editorial.css` (refs Apple/AD/Mohd/Artemest).
* **KE-005B.2 · Knowledge-Native Surfaces UI (07 Jun 2026)** — Moodboard e Design Journey diventano i primi consumatori reali del Brand Atlas. Nuovi componenti condivisi in `/components/knowledge/`: `EntityPicker.jsx` (Spotlight-style universal search · refs macOS Spotlight/Linear/Raycast · typeahead live ILIKE · filter chip per tipologia · keyboard nav arrows + enter + esc); `EntityContextPanel.jsx` (cuore dell'ecosistema · 9 sezioni nell'ordine approvato · Hero · Brand/Designer/Collection · Operational Readiness · Future Uses™ + Connected Assets™ visivamente evidenti · Certification · Materials · Provenance · Actions); `KnowledgeAnchorsRail.jsx` (riusabile · usa `/api/surfaces/{type}/{id}/attach|detach|entities`). Wire in `MoodboardEditor.jsx`: intercetta `addBlock('product'|'material'|'designer')` → apre EntityPicker → POST `/blocks` con `entity_id` · click su block con entity_id mostra chip "Knowledge" → apre EntityContextPanel · swap entity supportato. Wire in `MoodboardDirectionWorkspace.jsx` e `MaterialDirectionWorkspace.jsx`: KnowledgeAnchorsRail su milestone con SSoT via `entity_id`. Smoke test E2E verificato live (40 prodotti reali da Brand Atlas mostrati nel picker).
* **Store Success Path Audit™ (07 Jun 2026)** — READ-ONLY · audit completo delle 10 fasi Cliente→Approvazione · 3 P0 blocker identificati per go-live 4 luglio (Material Board UI · Specification Package · Client Presentation cinematic) · 17 surface da nascondere in modalità STORE · Priority matrix P0/P1/P2 · roadmap 4 settimane. See `STORE_SUCCESS_PATH_AUDIT.md`.
* **STORE-002 · Material Board Studio™ (07 Jun 2026)** — surface autonoma knowledge-native chiusura primo P0 dell'audit. Migration 133 (`material_boards` + `material_board_elements` con `entity_id` soft-FK). Backend router completo (`/api/material-boards` CRUD + add/remove element + `convert-from-moodboard/{moodboard_id}` con preselezione automatica entità material/finish + `/palette` auto-extract). Pages: `MaterialBoardsListPage.jsx` (editorial list con 6 template pills · Residenziale/Cucina/Hospitality/Retail/Outdoor/Luxury) + `MaterialBoardWorkspace.jsx` (canvas drag&drop + library con EntityPicker + element click → EntityContextPanel · riusa al 100% i componenti KE-005B.2). Route `/material-boards` + `/material-boards/:id`. CTA "Converti in Material Board" nel MoodboardEditor (visibile quando approved · clona materiali certificati). Smoke test E2E live: 21 finiture reali del Brand Atlas selezionabili via Spotlight picker (Nero · Bianco · Rovere · Laminam · Oak · Ceramica...). Single Source of Truth garantita: nessuno snapshot · solo `entity_id`.
* **STORE-003 · Specification Package™ (07 Jun 2026)** — chiusura 2° P0 dell'audit · documento operativo per chiudere la trattativa. Migration 134 (`specification_packages` + `specification_items` con entity_id soft-FK + status proposed/confirmed/replaced/removed). Backend `routers/specifications.py` completo (CRUD pkg/item + `convert-from-moodboard` + `convert-from-material-board` con autopopolazione · brand hydration in detail). Pages unificate in `SpecificationPages.jsx` (List + Workspace) + CSS editoriale. Workspace: header (titolo editabile + status dropdown draft/review/approved/ready + CTA Aggiungi), 3 summary tiles (Elementi · Confermati · Stima € live computed), tabella editoriale 10 colonne (Brand · Nome · Tipo · Quantità · Unità · Finitura · Codice · Prezzo · Stato · Trash) tutti editabili inline. CTA "Converti in Specification" su MaterialBoardWorkspace. Smoke test E2E live: row "ARBI Test Bathroom · Nero ✓ FINISH · 1 pz · Proposto" knowledge-native con cert badge da Brand Atlas.
* **STORE-004 · Project Story™ (07 Jun 2026 · PROJECT_STORY_READY)** — 3° P0 dell'audit chiuso. Surface narrativa cinematic auto-generata in <5s da una Specification approvata. Knowledge-native (entity_id puri · zero snapshot). Migration 135 (`project_stories` con sections JSONB · share_token · source_specification_id / source_material_board_id / source_moodboard_id). Backend `routers/project_stories.py` (5 endpoint autenticati + `POST /generate-from-specification/{spec_id}` autopopola 6 sezioni leggendo Specification → Material Board → Moodboard · public `/api/story/{share_token}` no-auth con tenant_id/created_by stripped). Frontend `ProjectStoryPages.jsx`: `ProjectStoriesListPage` (lista editoriale) + `ProjectStoryViewer` (full-screen scroll · 6 sezioni · share button + Showroom mode link) + `PublicProjectStoryViewer` (route `/story/:token` no chrome studio). CSS `project-story.css` cinematic dark + cover veil. **CTA gating**: "Genera Project Story" visibile SOLO su Specification con `status ∈ {approved, ready}` (rispetta Store Success Path lineare). Dashboard editorial card "Presentazione Cliente" ora punta a `/project-stories` (era `/workspace/presentations/new`). Testing agent: backend 9/9 PASS · frontend 12/13 verified (dashboard href confermato manualmente). See `STORE004_PROJECT_STORY_COMPLETION_REPORT.md`. Classification: 🟢 PROJECT_STORY_READY.
* **STORE-001 · STORE MODE™ (07 Jun 2026 · STORE_MODE_READY)** — chiusura ultimo P0 dell'audit STORE. Trasformato MOOD in software focalizzato showroom mantenendo zero distruzione. Migration 136 (`tenant_configuration.is_store_mode BOOLEAN NOT NULL DEFAULT TRUE`). `services/tenant_config_resolver.py`: nuova `STORE_NAVIGATION_TREE` costante (3 sezioni Showroom/Knowledge/Studio · 11 voci esatte: Dashboard · Client Relations · Projects · Design Journey · Moodboards · Material Boards · Specifications · Project Stories · Brand Atlas · Knowledge Engine · Settings) · early-return in `resolve_navigation()` se `is_store_mode=TRUE`. `resolve_runtime_bundle` espone `is_store_mode` a root del payload. App.js: nuova route `/journeys` → `JourneyPulsePage`. AtelierDashboardPage: 5° card destination "Specification" → `/specifications`. **NESSUN router/route/migration distruttiva** · le 26 surface non-store restano accessibili via URL diretto. Reversibilità verificata (FALSE → 8 gruppi × 29 voci · TRUE → 3 × 11). Testing agent: backend 5/5 PASS · frontend visual + console verificato. See `STORE001_STORE_MODE_REPORT.md`. Classification: 🟢 STORE_MODE_READY.
  - **STORE-001 v2 IA REFACTOR (07 Jun 2026)** — sidebar riorganizzata in 4 sezioni narrative: **SHOWROOM** (7: Dashboard, Client Relations, Design Journeys, Moodboards, Material Boards, Specifications, Project Stories) · **KNOWLEDGE** (2: Brand Atlas, Knowledge Engine) · **GROWTH** (2: Content Studio `/blueprint/editorial`, Editorial Calendar) · **STUDIO** (3: Media Library, Calendar, Workspace Settings). 14 voci totali · zero nuovo codice/DB/API · solo IA.
  - **Dashboard card redesign (07 Jun 2026)** — 6 destination cards landscape 4/3 in una riga su 1920px (Nuovo Cliente · Nuovo Design Journey · Crea Moodboard · Material Board · Specification · Presentazione Cliente). Projects rail snellito da 16/11 a 16/8 · max 5 colonne.

* **STORE-009 · DESIGN JOURNEY REBUILD™ Phase 1 (08 Jun 2026 · OPERATING_WORKSPACE_READY)** — `/studio/journey/:jid` trasformato da editorial "project page" in **The Daily Operating Workspace™**. NUOVA `JourneyOperatingPage.jsx` (438 righe · ZERO new DB/API/modules) sostituisce `ProjectDetailPage` come canonical (`?_legacy=1` fallback preservato). Layout: Hero serif + meta row (Client/Phase/Status/Completion/Next Action) → Phase rail sticky con 7 step (DISCOVER → INSPIRE → CURATE → SPECIFY → APPROVE → DELIVER → CELEBRATE, amber current / cyan done) → 3-column body (Roadmap left 260px · Current phase workspace center · Client Snapshot right 320px sticky). Mapping operazionale dei milestone esistenti: `brief→DISCOVER`, `inspirations→INSPIRE`, `moodboard_direction|material_direction|concept_design|curated_selections→CURATE`, `technical_package→SPECIFY`, `final_presentation→APPROVE`, `site_evolution→DELIVER`, `certified_closure→CELEBRATE`. Asset orchestration (Control Tower™): Moodboards/Material Boards/Specifications/Project Stories restano indipendenti · Journey mostra thumbnail + status + Open button. Language cleanup totale (no Chapter/Milestone/Conversation/Dialogue/Philosophy/Story Chapter visibili). Timeline event_type humanization (`milestone_started → Step started`). Testing agent: backend 100% · frontend 100% (11/11 acceptance criteria PASS · solo cosmetic feedback applicato). See `STORE009_DESIGN_JOURNEY_REBUILD_REPORT.md`.
  - **Refinement v2 (08 Jun 2026)** — header semplificato a 3 sole voci (Client · Status · Next Action). Status ora in formato combinato `Discover · In progress` (no Phase/Status separati). **Percentages removed completamente** (no Completion field). Rail dots puliti (no numeri, solo check icon su done). Right column Client Context riallineato al brief: Client · Project · Project Type · Budget Range · Timeline · Next Action · Recent Activity · **Internal Notes** nuovo (da `accounts.notes`). Verifica live a 1920×1080: page rispetta i criteri Linear/Notion/Apple Business — zero ERP/CRM/NASA feel.

* **STORE-008A · EDITORIAL AUTOPILOT™ MVP (08 Jun 2026 · AUTOPILOT_MVP_READY)** — Showroom-first validation sprint. Schema audit confermato: **ZERO new tables** (i 3 originariamente proposti — `tenant_editorial_settings`, `editorial_autopilot_runs`, `editorial_variant_media` — sono deferiti al post-MVP scheduler sprint). Tutto riusato da `editorial_variants` (status, market_id, internal_translation, hotspot_data, ai_meta) + `tenant_markets.custom_settings.weekly_frequency`. Backend `routers/editorial_autopilot.py` (6 endpoint · ~290 righe): `GET /api/editorial/autopilot/dashboard` (counts per mercato/status + opportunities + markets covered/uncovered), `GET /api/editorial/inbox` (filtrabile per status), `GET /api/editorial/inbox/{vid}` (detail con explanation_local + ai_motivation + ai_notes + ai_keywords + ai_audience + hotspots), 4 action endpoints (`/approve`, `/request-revision`, `/regenerate`, `/publish`). Frontend (2 nuove pagine ~700 righe totali · zero modifiche alle esistenti): **`EditorialAutopilotPage`** at `/blueprint/editorial` — 5 sezioni business dashboard (Questa settimana per mercato · Pipeline 4-stat · Opportunità · Genera Visibilità 6 source · Mercati copertura). **`ProofreadingInboxPage`** at `/blueprint/editorial/inbox` — Gmail-style: list left + detail center (target version · hero · meta · body) + explanation column right (Spiegazione in italiano · Motivazione strategica · Audience · Keywords · Note AI · Fonti · Hotspot proposti) + 4 sticky action buttons. **Media Required state** rispettato (banner "Media Required · seleziona da Media Library" su variant blocked, action `Approva`/`Pubblica` disabilitati). Demo data seeded: USA 3/sett · FR 5/sett · UK 2/sett · IT 2/sett · 2 variants in proofreading (Calacatta US + Art de Vivre FR) · 1 blocked (UK media required) · 1 published (IT). Smoke test live: 7 market cards · 2/0/1/1 pipeline · 6 opportunities · 4 actions confermate via curl. Legacy `EditorialStudioPage` preservata a `/blueprint/editorial/legacy`. See `STORE008A_SCHEMA_AUDIT.md` + `AUTONOMOUS_EDITORIAL_ENGINE_PLAN.md`. Classification: 🟢 AUTOPILOT_MVP_READY · pronta per demo July 4th.

## 🎯 STORE PATH 4 LUGLIO · 4/4 P0 CHIUSI
- ✅ STORE-001 Store Mode flag
- ✅ STORE-002 Material Board UI
- ✅ STORE-003 Specification Package
- ✅ STORE-004 Project Story cinematic

* **STORE-011 · DESIGN DISCOVERY™ ENGINE (08 Feb 2026 · DISCOVERY_ENGINE_READY)** — Trasformata la fase DISCOVER del Design Journey da placeholder a wizard intelligence-first. 7-step visual-first (Snapshot · Style · Atmosphere · Material · Priorities · Inspirations · Notes) targettato 5-8 min. **ZERO new tables** — tutto dentro `journey_briefs.closed_answers` + `atmosphere_signals` / `material_signals` JSONB. Nuovo router `routers/discover_brief.py` (~530 righe, 5 endpoint): `GET /api/discover/catalog` (catalogo statico · 30 immagini Unsplash tag-mapped a 10 style keys · 12 atmospheres · 9 materials · 10 priorities · 9 project types · 5 timelines · 5 investment ranges), `GET /api/journeys/{jid}/discover-brief` (state strutturato + completion 7 sezioni con weighted scoring), `PUT /api/journeys/{jid}/discover-brief` (autosave merge, dedupe, validation filtering), `POST /api/journeys/{jid}/discover-brief/complete` (force-able, avanza milestone brief→approved + inspirations→in_progress, emette timeline event `discovery_completed`), `GET /api/journeys/{jid}/discover-brief/intelligence` (Style DNA da tag-counting weights primary=2 secondary=1, Material DNA con cross-match brand_detected_entities tramite MATERIAL_ATLAS_KEYWORDS dict — reale: Rovere/Oak/Noce/Calacatta matching, Project Profile headline composto, Recommendations.moodboard_templates filtered by category+style tags, Recommendations.brand_atlas top picks). Path namespaced `/discover-brief` per evitare collisione con esistente `/discover` di lead_conversion.py (regression verificata). Frontend: nuova `DiscoverBriefPage.jsx` (~470 righe) at `/studio/journey/:jid/discover` — wizard fluido con autosave debounced (350ms), sticky Blueprint AI Panel 4-box live (Project Profile · Style DNA con barre %· Material DNA con atlas refs · Investment Profile), Summary view post-completion (Recommended Moodboard Templates cards + Brand Atlas picks pills + CTA "Begin Inspire"). CSS `discover-brief.css` (~380 righe) cinematic dark Blueprint Chameleon · serif headline Cormorant · amber accent #d9b16c · responsive grid 5/4/3 cols su 1920/1280/900. CTA "Open Discovery Engine" iniettato in JourneyOperatingPage quando phase=DISCOVER (data-testid=jop-open-discover). Smoke test live: progress 90% renderato, tutti 7 rail visibili, Blueprint AI panel populated, Style DNA al 15% × 5 styles, Material DNA con Rovere/Oak/Noce. Testing agent: backend 11/11 pytest PASS (catalog · GET/PUT autosave merge · complete · intelligence cross-match · regression legacy /discover). Classification: 🟢 DISCOVERY_ENGINE_READY · pronto a essere consumato da STORE-012 (Phygital Moodboard), STORE-013 (Editorial Autopilot full), STORE-014 (AI Concept Generator), STORE-015 (Market Adaptation Engine).

* **STORE-012A · GENERATE CONCEPT BOARD™ (08 Feb 2026 · CONCEPT_ENGINE_READY)** — Trasformato il finale della Discovery in un motore di generazione **Concept Directions™**: nuovo router `routers/concept_directions.py` (~590 righe) con `POST /api/journeys/{jid}/concept-directions/generate` (crea 1 Direction Set di 3 Concept Boards in <30s · letter scheme A/B/C → A2/B2/C2 → An/Bn/Cn) e `GET /api/journeys/{jid}/concept-directions` (lista raggruppata per set sorted by set_index). **Zero new tables** — ogni board è una `moodboards` row knowledge-native con `journey_id` settato (no orfani) + `ai_metadata.concept_seed` JSONB che racchiude tutto (set_id, set_index, set_label `Direction Set NN`, direction_letter, direction_name, color_palette[5], material_entity_ids[], product_entity_ids[], media_ids[], needs_flags[], generator='store-012a', style_dna_snapshot). Per ogni board generata: 1 `moodboard_pages` (16:9 cover) + ~20 `moodboard_elements` (1 headline text + 1 palette swatch + 8 image + 5 material + 5 product) tutti riferenti `entity_id` reali da Brand Atlas / Media Library / Product Library — **mai stock esterni**. Naming dinamico evocativo composto da template registry (`DIRECTION_NAMES` 25 combo curated + fallback `<Atmosphere> <Style>`): Natural Luxury · Soft Minimal · Warm Contemporary · Timeless Elegance · Refined Hospitality · Milanese Modern · Japandi Calm · etc. Color palette deterministica via `PALETTE_BY_ATMOSPHERE` (12 atmosphere × 5 HEX). Re-generation **appends** un nuovo set (rotation: style assignments shift `(set_index-1)%3`, atmosphere cycle `(i+rot)%len(atm)` → set_02 propone direction names diversi da set_01, vere alternative non duplicati). Idempotency check tramite count di `concept_seed.set_id` distinct sulle moodboards del journey. Asset shortage non blocca: board creata comunque con `NEEDS_MATERIAL_SELECTION` / `NEEDS_PRODUCT_SELECTION` / `NEEDS_MEDIA` flag visibile in UI. Timeline event `concept_directions_generated` emitted non-blocking. Frontend: refactor di `DiscoverBriefPage.SummaryView` — sostituito CTA "Begin Inspire" con **"Generate Concept Directions™"** primary CTA dorato premium + sublabel "Three ready-to-edit Concept Boards in seconds". Loading state "Composing 3 Concept Boards…" con spinner. Render multi-set: ogni Direction Set è una section con header (`CONCEPT · Direction Set NN · timestamp`) + grid 3 cards. Concept card: letter badge dorato, direction name serif, 5-color palette swatches, mini Style DNA bars con %, counts inline (X materials · Y products · Z images), needs_flags pills arancioni, "Open Direction →" CTA che naviga a `/moodboards/{moodboard_id}` (editor esistente). Secondary CTA "Propose 3 alternative directions" sotto. Auto-render Summary view quando `discovery_status==='completed'` su mount (deep-link friendly). CSS `discover-brief.css` esteso con .dbe-gencta (hero CTA glassmorphism con radial glow dorato) + .dbe-set / .dbe-concept / .dbe-concept__palette / __counts / __needs / __open (gradient hover, dorato premium). Smoke E2E live: 5 Direction Sets renderizzati, 15 Concept Cards, 15 Open buttons. Testing agent: **backend 10/10 pytest PASS** (envelope, letters scheme, rotation, persistence, needs_flags, list grouped, regression discover-brief). Visibility constraint `studio_only` discoverato durante dev e applicato correttamente. Classification: 🟢 CONCEPT_ENGINE_READY · STORE-012A unlocks STORE-012B (Phygital Moodboard™) come consumer naturale dei concept seeds, STORE-013/014/015 leggono `ai_metadata.concept_seed` senza schema changes.

* **STORE-012C · CLIENT PORTAL CONCEPT REVIEW™ (08 Feb 2026 · REVIEW_LOOP_LIVE)** — Chiuso il cerchio Discovery → Concept Generation → **Client Review** mantenendo MOOD come unica fonte di verità (no approvazioni via email, no mini-flow esterni). Backend esteso: in `concept_directions.py` 2 nuovi endpoint `POST /api/journeys/{jid}/concept-directions/{set_id}/share` (marca i 3 board del set come `status='sent'` + stamp `concept_seed.shared_at`/`shared_by` + timeline event `concept_set_shared` + email di notifica localizzata) e `POST .../unshare`. Locale resolver: `client.preferred_locale → tenant.primary_locale → it-IT` (mai assumere italiano). Email template informativa (4 locali: it-IT, en-US, en-GB, fr-FR) con CTA singolo "Apri la mia area riservata" → `/client/journey/{jid}/concepts` (NIENTE voting in email). In `client_portal.py` 2 nuovi endpoint client-side: `GET /api/client/journeys/{jid}/concept-directions` (ritorna solo set con `shared_at`, raggruppati per set_id, sorted by set_index) + `POST /api/client/concept-directions/{moodboard_id}/feedback` (reactions: **interested · explore_further · preferred · comment**, vocabulary professionale enforced). **Invariant chiave**: `moodboard.status` NON viene MAI alterato dal feedback cliente (preferred ≠ approved — confermato pytest). One-preferred-per-set semantica: selezionare "preferred" su B mentre A era già preferred fa switch atomico (unset is_preferred su A, set su B) ed emette narrative `"Il cliente ha cambiato direzione preferita da \"X\" a \"Y\""`. Persistenza tripla: `milestone_feedback` (kind=`concept_reaction_<reaction>`, author_role=client) + `journey_timeline_events.event_type=client_concept_feedback` (narrative human-readable in locale del cliente) + append in `ai_metadata.concept_seed.client_reactions[]`. **Client Alignment Score™** computed internally (interested=3, explore_further=2, preferred=10, comment=5) stored in `ai_metadata.concept_seed.client_alignment_score` — **invariant verificato**: MAI esposto in /api/client/* (string-scan testing). Score futuro consumato da STORE-013/014/015 senza schema changes. Frontend studio: refactor `DiscoverBriefPage.SummaryView` con CTA per-set "Send to client for review" (data-testid=dbe-share-{i}) → diventa pill verde "Shared with client" dopo invio. Concept cards mostrano star dorato + amber border quando is_preferred + strip reazioni (◉ interested · ↻ explore_further · ✎ comment). Frontend client: nuova `ClientConceptReviewPage` at `/client/journey/:jid/concepts` (~310 righe + 310 CSS) — wraps in ClientDashboardLayout, hero "Design Directions for you · Your studio shared N concepts...", render multi-set chronological, ogni Concept card con cover preview/palette swatches/Style DNA list/designer notes/4 azioni pill professionali. Modal Commento full-screen blurred backdrop. Toast cinematico bottom (verde success / rosso error) con narrative italiana. Optimistic UI: history pill appare istantanea on click. Star ribbon + amber border atomically switching tra board del set. ClientRoute esteso con `tenant_admin/super_admin` QA bypass (matches backend `_require_client`). Email infrastructure riusa `send_email` esistente con tenant branding. Welcome_token / magic_link reused per CTA email. Testing agent: **backend 13/13 pytest PASS** (share envelope, status='sent' marker, shared_at stamp, unshare reverts, GET filters non-shared boards, feedback matrix 4 reactions, switch preferred narrative, comment 422 senza body, invalid reaction 422, **moodboard.status invariant**, **score never leaks invariant**, locale resolver chain, score increments). **Frontend 100%** critical flows verificati. Classification: 🟢 REVIEW_LOOP_LIVE · STORE-012C completa la trinità Discover → Generate → Review. Il Design Journey resta operating center, MOOD professionale e tracciabile.

* **STORE-012D · CONCEPT PULSE™ (08 Feb 2026 · OPERATIONAL_SIGNAL_LIVE)** — Chiuso il loop traducendo il feedback cliente in un segnale operativo per il designer dentro JourneyOperatingPage (INSPIRE/CURATE phases). Zero new tables, zero new modules — riusa `concept_seed.client_alignment_score` + `client_reactions[]` (read-only). Nuovo endpoint `GET /api/journeys/{jid}/concept-pulse` (~243 LOC in `concept_directions.py`): trova latest shared Direction Set (max set_index), computa ranking band-bucketed (high≥15 / medium≥5 / low<5) con tie-break weighted reactions (preferred=10·comment=5·interested=3·explore_further=2), aggregate `feedback_summary` per reaction across set, computa deterministic `suggested_next_action` con 7 chiavi (develop_preferred · material_board_for_preferred · second_direction_set · open_material_board · wait_or_remind · review_feedback · wait_for_feedback), e `quick_actions[]` deep-link (open_preferred → `/moodboards/{id}` · material_board_preferred · generate_alternatives kind=api → POST · view_feedback → `/client/journey/{jid}/concepts`). **Material-keyword heuristic** su comments (24 keywords IT/EN) attiva "Open Material Board" suggestion quando rilevante. **Critical invariants enforced via test**: (a) response JSON **non contiene mai** la stringa `client_alignment_score` (string-scan in pytest), (b) ranking emette solo `alignment_band` + `alignment_label`, (c) endpoint puro read-only verificato snapshot moodboard.status pre/post. Frontend: nuovo `ConceptPulseCard.jsx` (~200 LOC) + `concept-pulse.css` (~180 LOC) inserito in JourneyOperatingPage dietro guard `currentPhase ∈ {INSPIRE, CURATE}` (data-testid=jop-concept-pulse-block). Card compatta cinematic dark: header `Concept Pulse™ · DIRECTION SET NN`, hero "Suggested next move" box dorato gradient con headline + hint, Client Preferred Direction strip con star icon + letter badge + Open CTA, ranking #1/#2/#3 con band pills (green=high, gold=medium, gray=low — **mai numero**), feedback summary 4 chips icon (Heart/Compass/Star/MessageSquare) on-state dorato, 4 quick action buttons (Open Preferred · Create Material Board · Generate Alternatives · View Feedback). Smoke E2E: card renderizzato in INSPIRE phase con Direction Set 09, preferred=B9 Elegant Warm Contemporary, ranking MEDIUM ALIGNMENT pulito, feedback chips on, deterministic suggestion "Develop Elegant Warm Contemporary with material variants" (corretto perché preferred esiste senza material keywords). Testing agent: **backend 9/9 pytest PASS** (schema + invariant string-scan + ranking sort + suggested action mapping per ogni branch + quick-actions href shape + read-only status check + has_shared_set=false branch + regression 012A/012C). Classification: 🟢 OPERATIONAL_SIGNAL_LIVE · trasforma MOOD da reporting tool a *design assistant*: il designer apre il Journey e in <3 sec capisce quale concept sta vincendo, cosa è stato apprezzato, cosa fare dopo.

* **STORE-012B · MOODBOARD V2.1 · DESIGN INTELLIGENCE WORKSPACE™ FOUNDATION (08 Feb 2026 · WORKSPACE_LIVE)** — Salto strategico: dalla suite di tools alla **Design Intelligence Workspace™** che fa da ponte operativo Concept → Materials → Specifications. Vision V2 (12 pillars / 4 release) salvata in `/app/memory/MOODBOARD_V2_VISION.md`. Implementati i 5 pillar foundation V2.1: **Project Brain™** (sticky panel sempre visibile in Edit, hidden in Presentation, con `Recommended Next Action™` sempre presente — riusa Concept Pulse + Discovery intelligence), **Smart Hotspots™ foundation** (4 tipi MVP: material/product/image/text + palette element · schema-ready per 7 tipi futuri), **Showroom Presentation Mode™** (rendering state via `?mode=presentation` su stessa route · narrative: Vision → Atmosphere → Materials → Products → Highlights → Next Steps), **Client Proposal View™ backend** (`GET /api/client/moodboards/{id}/presentation` read-only · strip `approval_*` keys), **Approval Layer™** per-element (`suggested/discussed/approved/rejected` in `content.approval_status`). Nuovo router `routers/working_moodboards.py` (~600 LOC, 5 endpoint): `POST /api/journeys/{jid}/working-moodboards/from-concept/{cb_id}` (idempotente · crea nuova `moodboards` row derivata · 5 `moodboard_pages` Vision/Materials/Products/Atmosphere/Notes · ~20 `moodboard_elements` knowledge-native · `ai_metadata.working_seed`={source_concept_id, source_set_id, set_index, direction_name, derived_at, mode='working', sections, style_dna_snapshot, color_palette, generator}), `GET /api/journeys/{jid}/working-moodboards`, `GET /api/moodboards/{mbid}/project-brain`, `GET /api/moodboards/{mbid}/working-payload` (single-fetch payload + sections+elements pre-grouped), `PATCH /api/moodboard-elements/{eid}/approval-status`, `GET /api/client/moodboards/{mbid}/presentation`. **NFC-ready triple** enforced: ogni element material espone `entity_id` + `material_id` + `brand_id` da day-one (zero migration futura). Frontend: nuova `WorkingMoodboardPage.jsx` (~450 LOC) at `/studio/moodboards/working/:id` con grid Edit (5 sezioni + Project Brain sticky right) e Presentation Mode (`?mode=presentation` · cinematic full-bleed Cormorant headline 86px · narrative storytelling 4-6 atti · no toolbar). CSS `working-moodboard.css` (~350 LOC) cinematic dark + approved=green border / rejected=opacity 0.55. CTA "Open Direction" sostituito ovunque: in DiscoverBriefPage Summary ogni Concept card ora ha `WorkingMoodboardLauncher` (data-testid=`dbe-generate-working-{cb_id}` o `dbe-open-working-{cb_id}` se già derivato) · in ConceptPulseCard `cp-open-preferred` ora naviga al Working Moodboard preferito (generate-or-open). Invarianti critici: (1) Approval Layer mai espone score numerico, (2) client/presentation strips `approval_*` keys, (3) ranking/score mai leakkati. Testing agent: **backend 16/16 pytest PASS** (lifecycle generate · idempotency · NFC triple · working-payload structure · approval PATCH valid+422 · project-brain shape + score-leak invariant · client presentation strip · regression 011/012A/012D). Frontend 100% testid (root + 5 sections + Project Brain + brain-next-action + brain-preferred + 80 approval chips + toggle + optimistic UI + Presentation Mode sub-acts + 26 Concept-card launcher CTAs + 1 open-working CTA per Concept già derivato). Classification: 🟢 WORKSPACE_LIVE · V2.1 foundation pronta per V2.2 (Variant Engine + Live Design Intelligence + Material Board Sync).

* **STORE-012F · CLIENT APPROVAL THREAD™ (MOODBOARD V2.2 · 08 Feb 2026 · APPROVAL_LOOP_LIVE)** — Trasformato il Working Moodboard da presentation tool a **Design Decision System™**. Estensione di `working_moodboards.py` (~1010 LOC) con 3 capability foundation V2.2: (a) **Element-level Client Signals™** via nuovo endpoint dedicato `POST /api/client/moodboard-elements/{eid}/feedback` (gate: solo Working Moodboards · invalida Concept Boards con 403 → separazione semantica STORE-012C vs 012F mantenuta). Vocabulary professionale `interesting · explore_further · comment` enforced (422 on `like`/altri). Persistenza tripla: `element.content.metadata.client_reactions[]` + `milestone_feedback` (kind=`element_reaction_<type>`) + `journey_timeline_events` (event_type=`client_signal` con narrative italiana firmata "Client Signal™ — Il cliente ha mostrato interesse per …"). (b) **Designer Approval Lifecycle**: refactor `PATCH /api/moodboard-elements/{eid}/approval-status` con enum studio-only `proposed/discussed/approved/rejected` (rimosso il vecchio `suggested` — invalidato 422). Approvazione su element material/product → auto-set `metadata.specification_candidate=true` + `metadata.decision_stage='approved'` (vocabolario futuro: inspiration/evaluation/selection/approved/specified). Emette `element_status_changed` timeline event con narrative IT ("Il designer ha approvato/scartato/discusso ..."). (c) **Material Board Sync™ designer-triggered** via `POST /api/working-moodboards/{mbid}/sync-materials-board` — MAI automatico. Pesca solo material elements con `status='approved'`, crea o riusa `material_boards` row del journey, inserisce in `material_board_elements` con `position_json` grid 4-col + `sort_order`, **idempotent** (skip su `entity_id` già presente), preserva `entity_id`/`material_id`/`brand_id` (Knowledge Native). Promote synced elements a `metadata.decision_stage='specified'` SOLO dopo insert riuscito (no orphan state). Frontend: estensione `WorkingMoodboardPage.jsx` — banner Sync hero dorato in cima Edit Mode quando `approvedMaterialsCount > 0` (data-testid=`wmb-sync-cta`+`wmb-sync-go`) con toast result + error fallback; ogni element card mostra ora `data-testid=wmb-feedback-{id}` con counts (◉ Interesting / ↻ Explore Further / ✎ Comments) + ultimo commento citato in italics (clamp 2 lines), e `data-testid=wmb-badges-{id}` con 3 stati: "Ready for Material Board" (green) / "Ready for Specification™" (gold) / "On Material Board" (blue post-sync). Client presentation endpoint hardened: strips `approval_*` + designer metadata, preserva solo `metadata.client_reactions[]` (string-scan invariant verified). Bug fix critico in iterazione: tabella `material_board_items` non esiste — corretto a `material_board_elements` con shape payload allineato (`position_json` + `sort_order`) e rimosso silent except fallback (ora `raise HTTPException(500)`) per impedire stati semi-syncati silenziosi in futuro. Testing agent: **backend 16/16 pytest PASS** (lifecycle client signal valid + 4 errors gate · approve material → spec_candidate=true · invalid status 422 · sync creates board + idempotent skip · decision_stage='specified' set only after insert · concept feedback regression isolated · client presentation no leak invariant string-scan) + 1 SKIP (env-dependent test). **Frontend 100%** sync CTA → toast → badge promotion verified live. Classification: 🟢 APPROVAL_LOOP_LIVE · V2.2 sprint #1 complete · moodboard è ora *decision workspace*: ogni element esiste in un thread strutturato Client Signal → Designer Decision → Material Board / Specification readiness. Pronto per V2.2 sprint #2 (Variant Engine + Client Proposal View page + Live Design Intelligence suggestions).

## Backlog (priority)

### P0
* **KE-005 · TBD** — eventuale sprint successivo: Designer Journey UI o Moodboard Engine o Page Visual (PDF rendering) o cross-catalog Brand Atlas — in attesa di direttiva utente
* **KE-003.1 (follow-up, non-blocking)** — replace `window.confirm()` per RIFIUTA con modale glass-dark · typeahead lookup per UNISCI · estendere `_compute_real_impact` scope=brand con query cross-catalog-sets · auto-select su `product_id` quando `brand_detected_entities` è vuoto
* **CRM / Client Relations Refactor** — **ON HOLD by user**
* **Project Detail Page** — premium SaaS design coherent with new Projects index

### P1
* **KE-004 · Future Uses™ + Knowledge Impact™ wiring** — autowrite di `entity_operational_usage` da moodboard/journey/material_board insertion paths
* **KE-005 · Designer Journey Integration™** — entity → moodboard/journey single click
* **M6 · Advisor Workspace** — sidebar + KPI + panels (SaaS-style)
* M3.1 · Voice Notes foundation (audio capture + waveform, no STT)
* M3.2 · Email Activity foundation (counters only, no Gmail OAuth)
* PDF viewer real (react-pdf) inside Document Viewer column
* Theme Engine fix & i18n audit (remove residual hardcoded backgrounds)

### P2
* **M7 · Project Impact™** — wire real economic KPIs into the placeholder schema
* Phase 2 Mail (Gmail/Outlook OAuth)
* Voice STT (Whisper)
* Academy Builder, Magazine Builder, Marketboard Generator
* Persistent Entity Resolution Jobs
* AI-suggested next-best-action per follow-up
* Mobile push notifications
* TTL cron purge on `extraction_event_log` (view `extraction_event_log_to_purge` ready)

## Key files (current)

* `/app/memory/RELATIONSHIP_OS_ARCHITECTURE_DELIVERABLE.md` — canonical architecture
* `/app/memory/M4_IMPLEMENTATION_REPORT.md` — M4 implementation
* `/app/memory/BRAND_REGISTRY_ENHANCEMENT_REPORT.md` — Brand Registry
* `/app/memory/REVIEW_WORKSPACE_V3_IMPLEMENTATION_REPORT.md` — Review Workspace V3.1
* `/app/frontend/public/wireframes/relationship-os/index.html` — wireframes
* `/app/frontend/public/wireframes/review-workspace[-v2|-v3]/` — Review Workspace mockups
* `/app/backend/routers/review_workspace_v3.py` — V3.1 API
* `/app/backend/routers/notifications.py` — M4 API
* `/app/backend/services/notification_publisher.py` — emission entrypoint
* `/app/backend/services/notification_cron.py` — APScheduler
* `/app/frontend/src/components/review-workspace/` — V3.1 React components
* `/app/frontend/src/components/notifications/NotificationBell.jsx` — UI

## Test credentials

See `/app/memory/test_credentials.md`. Default super_admin:
`admin@moodfordesign.com / Blueprint2024!`


---

## I18N-STABILIZATION-P0 · COMPLETED (10 Jun 2026)

### What was fixed

**Root cause removed:** `localStorage.mfd_language_registry_override` aveva priorità 1 in `getLanguageRegistry()`, sopravviveva ai refresh e conteneva tutte le 10+ lingue statiche → causava il salto da 2/2 a 7/9 al refresh.

**Fix applicato (4 file):**
- `languages.js` — override rimosso dalla catena di priorità; `getLanguageRegistry()` segue ora: `_dbMirror → DB cache → LANGUAGE_REGISTRY fallback`. `setLanguageRegistry()` → DEPRECATED no-op. Cleanup one-shot `localStorage.removeItem('mfd_language_registry_override')` al module load. `LANGUAGE_REGISTRY` aggiornato a codici BCP-47 completi (`it-IT`, `fr-FR`, `de-DE`, `es-ES`). `BLUEPRINT_OPERATIONAL_CODES` → `['it-IT','en-US','en-GB','fr-FR','de-DE','es-ES']`. `blueprintLanguages()` usa `isBlueprintOperational()` con match diretto + backward compat base-code.
- `LanguagesPage.jsx` — rimossa chiamata a `setLanguageRegistry(fresh)` in `onSave()` e `onReset()`. Import rimosso.
- `BlueprintContext.jsx` — `FALLBACK_LOCALES` module-level const sostituito con `getBlueprintLocales()` lazy init nello stato React.
- `platform.py` — `BLUEPRINT_OPERATIONAL_CODES` aggiornato con forme BCP-47 complete + backward compat corti.

**Test result (iter 224): 8/8 PASS**
- Refresh → LocaleSwitcher stabile 2/2 (era 7/9)
- IT sempre visibile dopo refresh
- localStorage.mfd_language_registry_override assente dopo boot e dopo save
- Cambio lingua persiste su refresh
- LanguagesPage save non riscrive l'override

### Rischi residui P1

- `LocaleRuntimeContext.supported[]` è ancora hardcodato (lista di 9 composite codes). **Non è root cause del bug attuale** ma può divergere dal DB se vengono aggiunte lingue. → Aperto come P1 tecnico: alimentare `supported` dalla risposta `/api/locale-runtime/resolve`.
- 111+ file con stringhe hardcodate (admin/storefront UI) — deferred P2 per decisione utente.

### Next: DJ-MACRO-001 · Design Journey Macro Steps (sbloccato)


---
## Sessione corrente — Fix eseguiti

### RESET-FIX (completato)
- `onReset()` in `LanguagesPage.jsx` ora chiama `bootstrapLanguagesFromDB()` invece di `setRegistry(LANGUAGE_REGISTRY)` statico
- `LANGUAGE_REGISTRY` rimosso dall'import di `LanguagesPage.jsx`
- Aggiunto stato `resetting` + button `disabled` durante il fetch
- Comportamento post-fix: RESET → DB fetch → contatore esatto DB (7/7), niente ar/zh/ja

### LANGUAGES-ROUTE-MIGRATION (completato)
- `/admin/languages` → `/settings/languages` spostato dentro `DashboardLayout` con `SuperAdminRoute`
- Vecchio URL `/admin/languages` mantiene un `<Navigate replace>` verso `/settings/languages`
- Aggiornati: `SettingsPage.jsx` (tile link), `BlueprintGovernancePages.jsx` (AdminIndexEntry link)
- Test: 7/7 PASS — sidebar presente, redirect funzionante, contatore 7/7 da DB


### DJ-STABILIZATION-P0 SPRINT 0 (completato — 2026-06-10)
**Metriche pre-fix**: 9 design_journeys — account_id NULL: 0 — lifecycle_state NULL: 0 (DB già pulito)
- `design_journey.py/_ensure_journey()`: recupera account_id da `projects.metadata_json`, imposta `lifecycle_state='conversation_open'`
- `lead_conversion.py/start_journey`: crea tutti 10 DEFAULT_MILESTONES (era solo 1 brief)
- `journeys.py/mine` ×2: `.or_('lifecycle_state.neq.abandoned,lifecycle_state.is.null')` — NULL guard
- Rischi residui: nessuno attivo

### FASE 1 Quick Lead Alignment (completato — 2026-06-10)
- `NewRelationshipModal.jsx`: `name` → `firstName`+`lastName` separati, `PhoneCountryPrefix` integrato
- `leads.py/fast-capture`: accetta `{first_name, last_name}` direttamente O `{name}` legacy — nessun nuovo endpoint
- Payload prima: `{name:"Marco Rossi"}` → dopo: `{first_name:"Marco", last_name:"Rossi"}`
- Test: 8/8 PASS (backend + frontend)

### FASE 2 Design Journey Alignment (completato — 2026-06-10)
- `BeginJourneyPage.jsx`: aggiunto campo `Cognome` (bj-last-name) in grid 2 colonne accanto a `Nome`; fallback `'Cognome'` se chiave editoriale assente dal DB
- `journey_initiate.py / WelcomePayload`: `last_name` opzionale aggiunto
- `journey_initiate.py`: `accounts.account_name = full_name`, `contacts.last_name`, `leads.last_name`, `projects.title = 'Conversazione di {full_name}'`
- Backward compat: `last_name=null` → `account_name = first_name` (invariato)
- Portal welcome non impattato (`users_profile.first_name`, non `contacts.first_name`)
- Test: 13/13 PASS (backend + frontend)

### MILESTONE OWNERSHIP CONSOLIDATION AUDIT FINAL (prodotto — 2026-06-10)
- Router owner definitivo: `journeys.py`
- Endpoint canonico: `PATCH /api/journeys/{jid}/milestones/{mid}` (da espandere con campi da Router A)
- Unico chiamante frontend: `DesignJourneyTab.jsx:364` (PATCH) e `:375` (POST /open) — entrambi su Router A
- Migrazione: sostituire `${m.id}` con `${m.journey_id}/milestones/${m.id}` nei 2 URL — `m.journey_id` già disponibile
- SPRINT 1 approvazione richiesta prima dell'implementazione

### DJ-STABILIZATION SPRINT 1 — Milestone Ownership Consolidation (completato — 2026-06-10)
**FASE A** — Router B (`journeys.py`) espanso:
- `PATCH /{jid}/milestones/{mid}` — full field update: status + title + description + owner_user_id + linked_entity + metadata merge + entity_refs (KE-005B) + auto-advance current_milestone_id + certified_closure auto-close
- `POST /{jid}/milestones/{mid}/open` — CTA resolver migrato da Router A
- `STATUS_NARRATIVE` dict aggiunto; `_ke_hooks` importato
**FASE B** — Frontend migrato:
- `DesignJourneyTab.jsx:364+375`: URL aggiornati a `/${m.journey_id}/milestones/${m.id}`
**FASE C** — Soft-deprecation Router A:
- `PATCH /journeys/milestones/{mid}` → ancora funzionante + `logger.warning("DEPRECATED …")`
- `POST /journeys/milestones/{mid}/open` → ancora funzionante + `logger.warning("DEPRECATED …")`
**Rischio residuo documentato**: `event_canon` è NULL per nuovi eventi milestone (DB constraint `journey_timeline_events_canon_chk` permette solo NULL/brief_started/journey_created — estendere in futuro migration script)
**Test**: 8/8 PASS (8 backend curl + code review frontend)

**Piano di rimozione definitivo Router A:**
1. Monitorare log `DEPRECATED endpoint called` per 1 sprint (zero chiamate = safe)
2. Verificare che nessun altro client chiami i vecchi URL (via log search)
3. Rimuovere `PATCH /journeys/milestones/{mid}` e `POST /journeys/milestones/{mid}/open` da `design_journey.py`

---

## I18N ADOPTION P0 — FASE 1 (completata — 2026-06-10)

### Stringhe UI convertite (non-editoriali)

**File modificati:**
- `AccountsPage.jsx` · `LeadsPage.jsx` · `ProspectsPage.jsx` · `LeadDetailPage.jsx`
- `it-IT.json` · `en-US.json` (aggiunte chiavi `clientRelations.*`, `common.time.ago`, `common.backToList`)

**Chiavi riutilizzate (esistenti):**
- `common.reset` (×3) · `common.creating` (×1)
- `nav.client_relations_accounts/leads/prospects` (×3) · `nav.memory` (×2) · `nav.new_journey` (×1)
- `relationships.ctaNew` (×1) · `moodboards.untitled` (rimpiazzato da chiave specifica)

**Nuove chiavi create:** 61 totali
- `common.time.ago` + `common.backToList` (2)
- `clientRelations.common.openMemoryAria` (1 condivisa)
- `clientRelations.health.*` (3: thriving/stable/at_risk)
- `clientRelations.register.*` (4: editorial/concierge/consultative/discovery)
- `clientRelations.tier.*` (3: atelier/couture/pret_a_porter)
- `clientRelations.accounts.*` (23) · `clientRelations.leads.*` (18) · `clientRelations.prospects.*` (22) · `clientRelations.leadDetail.*` (10) — per namespace

**Stringhe hardcoded eliminate:** 69
**Stringhe editoriali escluse (restano hardcoded):** 27 — candidate al Translation Management Layer

### Stringhe EDITORIALI escluse da FASE 1 (invariate nel JSX)

**AccountsPage:** tone lines (full conversation/settling/listening/opening) · "Where we are" · "studio palette" · eyebrow "CLIENT RELATIONS™ · ACTIVE STUDIO" · lede · emptyBody

**LeadsPage:** temp labels (Warm·ready/Engaged/Curious) · "awaiting first interview" · eyebrow "CRM · DISCOVERY" · lede · emptyBody

**ProspectsPage:** momentum labels (arriving at the threshold/gathering momentum/finding its voice/early dialogue/first whispers) · "Relationship momentum" · "cultivated by" · "continuation pending" · eyebrow "CLIENT RELATIONS™ · CULTIVATION" · lede · emptyBody

**LeadDetailPage:** "Pronto a trasformarlo in progetto?" · "Rispondi a 4 domande in <90 secondi…"

**Test:** 4/4 pagine PASS · 0 token mancanti (⟦key⟧) · debug overlay +0 su tutte le pagine

---

## I18N FASE 2 — AccountDetailDrawer · CrmAccountsPage · MembersPage · DesignJourneyTab (10 Jun 2026)

**PRE-CHECK useBlueprint().t:** Sistema B — distinto. Superset che consulta dizionario backend prima di pickString. MembersPage **migrato da useBlueprint().t → useT() (i18n/useT.jsx)** come gli altri 3 file.

**File modificati:** 4 componenti React + 2 JSON (it-IT.json + en-US.json)

**Stringhe hardcoded eliminate:** ~130
- AccountDetailDrawer: ~35 (10 field label, 4 tab label, 4 toast, 5 placeholder, 4 fact row, 5 empty state/chip, 3 pane messages)
- CrmAccountsPage: ~20 (3 toast, 3 form label, 1 button, 6 table header, 3 chip/card, 4 pulse label, 6 health option)
- MembersPage: ~60 (eyebrow, title, subtitle, seats, 2 CTA, 4 filter, placeholder, 4 th, loading, empty, you, 6 menu item, invite drawer ×6, edit drawer ×10, confirm ×6, toast ×14)
- DesignJourneyTab: ~15 (3 eyebrow, focus label, workspace head, open btn, details eyebrow, 4 date label, loading, error, advisor, opened_suffix)

**Nuove chiavi create:** 119 (27 crm_accounts + 74 members + 18 journey.tab) — aggiunte in entrambi i JSON

**Chiavi riutilizzate:** `crm.account_detail.*` (50+, da precedente agent), `common.back`, `crm.crm_accounts.annulla`, `journey.tab.update_direction`/`.evolution`/`.story`/`.brief_editor_coming` ecc.

**Coverage aggiornato:** debug overlay MembersPage = 0 missing. CRM pages = 13 pre-esistenti (stesso baseline FASE 1). FASE 2 aggiunge +0 chiavi mancanti a runtime.

**Bug trovato/fixato in test:** AccountRow in CrmAccountsPage usava t() senza useT() → TypeError crash in table view. Fixato dal testing agent.

### EDITORIAL_CONTENT_INVENTORY (FASE 2 — non convertire)

| # | File | Stringa | Motivo esclusione |
|---|------|---------|-------------------|
| 1 | DesignJourneyTab | `progressNarrative` — 6 varianti ("Chiusura certificata · capitolo concluso", "Il viaggio è appena iniziato", "Direzione in avvio · {title}", "Tutte le pietre miliari sono state approvate", "{n} pietra/pietre miliare/miliari completate", "{n} pietre miliari completate · ora {title}") | Journey Absorption™ narrativa computata — copy editoriale |
| 2 | DesignJourneyTab | InlinePanel `brief` sub-text: "Raccogli obiettivi, atmosfera desiderata, ambienti e timing. Il Brief è il seme da cui tutto il Design Journey™ prende forma." | Brand narrative del prodotto |
| 3 | DesignJourneyTab | InlinePanel `site_evolution` sub-text: "Fotografie di avanzamento, prima/dopo, dettagli materiali, sopralluoghi — il progetto raccontato per immagini, in ordine cronologico." | Brand narrative del prodotto |
| 4 | DesignJourneyTab | FocusPanel hero-text: "{milestone.title} si svolge in uno spazio dedicato. Aprilo per continuare la direzione progettuale." | Editorial product copy |
| 5 | DesignJourneyTab | DetailsPanel hint: "Riscontri cliente e varianti compariranno qui nei prossimi capitoli." | "Capitoli" — linguaggio narrativo editoriale |

---

## I18N Consolidation Audit (10 Jun 2026) — Risultati

### T1: Engine Map
- **6 meccanismi** trovati: E1=useT(i18n/useT), E2=useT(BlueprintContext), E3=useBlueprint().t, E4=EditorialBundleProvider, E5=EditorialOverridesProvider, E6=LocaleRuntimeContext
- **RISCHIO**: E1≠E2 — stessa firma visiva `useT`, semantica diversa (E1 ignora 3° arg, E2 ha fallback)
- **E2=E3** (E2 è re-export di E3)

### T2: Key Duplication Report
- **it-IT: 1908 chiavi** | **en-US: 1883 chiavi** | De-sync: 25 solo in IT, 0 solo in EN
- **De-sync fixato**: `members.toast_required_fields` aggiunto in en-US
- Duplicato principale: "Annulla" ×11 chiavi — candidato a `common.cancel` canonico
- 3 namespace CRM paralleli: `crm.*` (223) + `clientRelations.*` (59) + `leads.*` (18)

### T3: DesignJourneyTab
- Route: `/studio/journey/:jid?_legacy=1` (path LEGACY)
- Journey `88c072b7` ha `milestones_flat: 0` (dangling milestone_id) → progressNarrative non testabile
- **i18n**: missing 0 confermato su tutte le navigazioni, loading/error states tradotti ✅

### T4: CRM Missing Keys  
- Static analysis: **0 missing** (224 chiavi CRM+Workspace tutte presenti in JSON)
- Runtime: **13 pre-esistenti** (origine dinamica, pre-datano FASE 1)
- **1 de-sync rilevato e fixato**: members.toast_required_fields mancava in en-US

## I18N-CLOSURE-SPRINT ✅ COMPLETATO (10 Jun 2026)

**Deliverable prodotti:**
- Engine Map → `/app/memory/I18N_CLOSURE_SPRINT_ENGINE_MAP.md`
- Missing Keys Report → `/app/memory/I18N_CLOSURE_SPRINT_MISSING_KEYS_REPORT.md`
- DesignJourneyTab Validation Report → `/app/memory/I18N_CLOSURE_SPRINT_DESIGNJOURNEYTAB_VALIDATION.md`
- Final Coverage Report → `/app/memory/I18N_CLOSURE_SPRINT_FINAL_COVERAGE.md`

**Fix applicato:** `JourneyOperatingPage.jsx` — redirect 404/403 → `/dashboard` (TASK 2E)

**Metriche chiuse:**
- JSON sync: 1939/1939 (0 de-sync)
- CRM pages missing keys: 0
- DesignJourneyTab missing keys: 0
- Engine coesistenza: E1 (84 file) + E3 (72 file) documentata

## Backlog I18N

- **P0 FASE 2** ✅ COMPLETATA (10 Jun 2026): AccountDetailDrawer, CrmAccountsPage, MembersPage, DesignJourneyTab
- **I18N RCA** ✅ COMPLETATO (10 Jun 2026): Report D0/D1/D2/D3/D4 → `/app/memory/I18N_RCA_REPORT.md`
- **I18N Decision Gate Memo** ✅ COMPLETATO (10 Jun 2026): R1/R2/R3/R4 → `/app/memory/I18N_DECISION_GATE_MEMO.md`
  - R2 CONFERMATO: 3 CMS override italiani attivi → utenti EN vedono "Inizia il tuo viaggio" su `nav.new_journey`
  - R3: F1-F8 provati; H1-H2 supportati; H3-H4 non verificati; refresh permanente NON provato
  - R4: P0-C priorità più alta (impatto produzione attivo); ordine corretto: P0-C > P1-D > P1-C > P1-B > P1-E
  - Architettura A/B/C: matrice comparativa prodotta senza raccomandazione (gate DG-3)
  - D0: Source of Truth Map — 7 layer mappati, 5 split-brain risk identificati
  - D1: Engine map — E1 (`i18n/useT.jsx`) vs E3 (`BlueprintContext.t`) — firme incompatibili, locale source divergenti
  - D2: Missing key capture plan — nessuna modifica codice, GovernanceOverlay + DevTools Console
  - D3: Refresh investigation — 4 fatti confermati (F1-F4), 2 ipotesi supportate (H1-H2), 2 non verificate (H3-H4)
  - D4: Roadmap P0/P1/P2/P3
- **P0-A** ⬜ Decisione motore canonico (documento di policy)
- **P0-B** ⬜ Identificazione 13 missing key via GovernanceOverlay
- **P0-C** ✅ Fix `EditorialOverridesProvider` locale-aware (10 Jun 2026)
- **CORE PRODUCT STABILIZATION P0 EXECUTION (11 Jun 2026)**:
  - ✅ P0-1: Prospects page era vuota (leggeva leads.progression_state='prospect', 0 risultati). Fix: endpoint ora legge accounts.lifecycle_stage='prospect'. 11 prospects mostrati.
  - ✅ P0-1: Accounts e Prospects enrichiti con design_journeys.lifecycle_state e project_id (Journey = Source of Truth).
  - ✅ P0-1: AccountsPage mostra "Journey" link teal su ogni card (apre /workspace/projects/{project_id} → redirige al Journey Workspace).
  - ✅ P0-2: client_portal.py concept feedback ora pubblica notifica al designer via notification_publisher (categoria message_received + unread_for_designer++).
  - ✅ P0-4: ProspectsPage.jsx: Link import mancante fixato. CTA card cambiata da "Promuovi ad Account" (deprecated) a "Apri Journey". ProspectLane mostra journey_lifecycle_state badge.
  - ✅ **MOODBOARD PUBLISH FLOW CERTIFICATION (11 Jun 2026)**: All 7/7 PASS. See `MOODBOARD_E2E_CERTIFICATION.md`.
  - ✅ **POST-CERTIFICATION CONSOLIDATION (08 Feb 2026)**: 4 documenti di audit prodotti (LIFECYCLE_CONSOLIDATION_AUDIT, DISCOVERY_CONSOLIDATION_REPORT, DESIGNER_CLIENT_COLLABORATION_CERTIFICATION 8/8, CLIENT_MODEL_CLEANUP_REPORT). Verdetto: NO — MOOD non è ancora governato da un unico Journey canonico. P0 bloccante: design_journeys.lifecycle_state non avanza mai (stuck a conversation_open × 18).




  - ✅ Journey Ownership P0: Path A, B, D fixati. Tutti i path verificati via SQL.
  - ✅ I18N Real Closure: 57 chiavi aggiunte. Pannello debug = missing 0 in tutte le 8 sezioni.
  - ✅ Team System Audit: Report in `/app/memory/TEAM_SYSTEM_AUDIT.md`.
  - ✅ F1 Session Leakage Fix: `_ensure_profile()` con filtro tenant_id + role conflict guard + bypass link rimosso + AuthClientCallback role guard. Verificato su 4 scenari.
  - ✅ F2 Email Delivery Audit: Report in `/app/memory/EMAIL_DELIVERY_AUDIT.md`. Resend API key non valida + dominio non verificato. Richiede azione utente.
  - ✅ F3 Hardcoded Purge: Rimossi Marco Rossi, Maria Bianchi, Stefano Rossi da tutti i file attivi (tenant_email_governance.py, EmailTemplatesPage.jsx, leads.py docstring, form placeholders, commenti).
  - ✅ F4 Messaging Chain: Catena message→notification→badge→email implementata in `relationship_conversation.py`. Categorie `message_received` e `designer_replied` aggiunte a `notification_categories`. Verificato via SQL.
  - ✅ F5 Email Validation: Endpoint `GET /api/public/check-email` + frontend debounce + indicatori available/existing/invalid.
  - ✅ CLIENT_MODEL_CONSOLIDATION.md prodotto: analisi tre sistemi paralleli + proposta Single Source of Truth.

## Prioritized Backlog

### P1 — Prossimo Sprint
- **F2 Resend Sblocco** (azione utente): verificare dominio `mail.moodfordesign.com` su resend.com/domains + rigenerare API key (quella attuale è non valida). Vedi `/app/memory/EMAIL_DELIVERY_AUDIT.md`
- **G2 Ownership unification**: deprecare `projects.assigned_to`, allineare con `design_journey_assignments.owner`
- **G5 Brief Guidato**: modulo post-auth client portal (da `/app/memory/CLIENT_MODEL_CONSOLIDATION.md`)
- Auth i18n Sprint: verifica chiavi auth in lingue non-IT (en-US, en-GB, es-ES, fr-FR)
- Milestone owner assignment: migrazione `milestone_assignments`
- `proposals.account_id` migrazione colonna DB (disabilita security check)
- Routing per `preferred_locale_code` in `_candidates_for()`

### P2 — Sprint futuri
- `users_profile.metadata_json["specializations"]` + routing per project_type
- `assignment_role` secondari in DJA (`lead_designer`, `reviewer`, `collaborator`)
- Translation Management Layer Blueprint (DB schema + Context Menu UI)
- 47 tenant demo da ripulire
- Sync `accounts.email` ↔ `users_profile.email` automatica

### P3 — Backlog
- Timezone field in Identity Model
- Auto-reassignment su revoca owner
- Capacity score per membro (max concurrent journeys)
- Engine i18n unification E3 → E1








## P0 Implementation Sprint — 2026-06-12

### P0-A: Email Deduplication (journey_initiate.py)
- Lookup accounts per email+tenant prima di qualsiasi insert
- Case B (email + open journey): action=resumed, zero duplicati
- Case A (email + no open journey): nuovo journey su account esistente
- Log: [LIFECYCLE_DEDUP]

### P0-B: Account → Lead Resolution (client_relations.py + AccountsPage.jsx)
- legacy_lead_id aggiunto al SELECT
- resolved_lead_id per ogni account (metadata_json → legacy_lead_id → email fallback)
- AccountsPage.handleOpen usa resolved_lead_id → no 404

### P0-C: SSoT
- design_journeys.lifecycle_state = SSoT fase progettuale
- accounts.lifecycle_stage = SSoT fase CRM pre-journey

### P0-D: Lifecycle (journey_initiate.py)
- lifecycle_state='in_progress' invece di 'conversation_open' alla creazione
- Log: [LIFECYCLE_TRANSITION]
