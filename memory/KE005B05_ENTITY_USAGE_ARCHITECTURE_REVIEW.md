# KE-005B.0.5 · Entity Usage Architecture Review™

> **Sprint**: KE-005B.0.5 · micro-step preliminare a KE-005B (READ-ONLY)
> **Mission**: mappare il ciclo di vita COMPLETO delle entità canoniche
> attraverso tutte le superfici operative (esistenti + future) e validare
> che la foundation che stiamo per costruire in KE-005B.1 sia genuinamente
> riutilizzabile da TUTTE le surface, non solo dalle prime due.
> **Data**: 06 Giugno 2026 · iteration 216
> **Constraint rispettato**: zero implementazione, zero migration, zero refactor.
> **Documenti correlati**: KE-005A (Moodboard Audit) · KE-005B.0 (Design Journey Audit)

---

## 0 · TL;DR

# 🟢 **FOUNDATION VALIDATA — PRONTI PER KE-005B.1**

L'audit conferma che:

1. **Lo schema canonico esiste già al 90%**: `entity_operational_usage`,
   `brand_entity_relations`, `knowledge_impact_events`, `entity_future_uses_v`
   sono già live (migration 129) e l'enum `asset_type` copre **8 surface**:
   moodboard, design_journey, material_board, client_presentation, magazine,
   social_story, product_selection, home_staging_pack.

2. **Lo `services/knowledge_usage_hooks.py` è già implementato** (3 funzioni
   `attach_entity` · `detach_entity` · `list_surface_entities` · idempotenti)
   e supporta nominalmente 4 surface (moodboard · design_journey ·
   material_board · client_presentation). È **dormiente**: nessun router
   business lo chiama, ma è strutturalmente pronto.

3. **L'API pubblica condivisa esiste già** (`routers/knowledge_surfaces.py`,
   montato in `server.py:166`): `/api/knowledge/entities/search` +
   `/api/surfaces/{type}/{id}/attach|detach|entities`. È il **bus di accesso
   universale** che useranno tutte le surface.

**Gap aperti** (residui che KE-005B.1 deve chiudere):

* ❌ Nessuna colonna `entity_id` su `moodboard_elements`
* ❌ Nessuna colonna `entity_refs JSONB` su `journey_milestones`
* ❌ Hook non invocati da `moodboards_v1.py` / `design_journey.py` (rimangono
  isolati come API stand-alone, **non come side-effect**)
* ❌ Nessun frontend componente `<EntityPicker>` né `<EntityContextPanel>`
* ❌ Hook non copre 4 surface future (magazine · social_story ·
  product_selection · home_staging_pack) — basta aggiungerle alla mappa
  `SURFACE_RELATION`, zero refactor

**Conclusione strategica**: la foundation che ci accingiamo a finalizzare
in KE-005B.1 può sostenere **tutte le 8 surface operative** previste dal
Brand Atlas senza necessità di un secondo refactor architetturale. Il
debito è puramente di **wiring** e di **UX surface-specific**.

---

## 1 · MAPPATURA DEL CICLO DI VITA DI UN'ENTITÀ

> "Cosa succede a un'entità canonica dal momento in cui viene riconosciuta
> dal Knowledge Engine al momento in cui viene presentata a un cliente?"

```
┌──────────────────────────────────────────────────────────────────────────┐
│  FASE 1 · GENESI                                                          │
│  ─────────────────────                                                    │
│  · extraction_jobs (PDF, immagini, brochure)                              │
│  · cultural_engine/entity_resolver → brand_detected_entities              │
│  · status: 'pending_review'                                               │
│  · canonical_ref_id = NULL (non ancora certificata)                       │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  FASE 2 · CERTIFICAZIONE  (KE-002 / KE-003)                               │
│  ─────────────────────                                                    │
│  · Review Workspace V3.1 (4-col)                                          │
│  · 4 CTA · APPROVA / RIFIUTA / UNISCI / MODIFICA                          │
│  · scope · only_here / similar_in_brand / all_occurrences                 │
│  · POST /apply-correction → INSERT knowledge_impact_events                │
│  · status: 'approved' · canonical_ref_id ← products.id / brands.id / …    │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  FASE 3 · OPERATIONAL READINESS  (KE-004)                                 │
│  ─────────────────────                                                    │
│  · OperationalReadinessPanel calcola badge READY_FOR_<surface>            │
│  · regole server-side · dipende da campi minimi (display_name +           │
│    confidence ≥ 0.8 + entity_type ∈ {…})                                  │
│  · 5 surface valutate · moodboard · design_journey · material_board ·     │
│    client_presentation · brand_atlas                                      │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  FASE 4 · CONSUMO OPERATIVO  (KE-005B · da realizzare)                    │
│  ─────────────────────                                                    │
│  Designer apre Moodboard / Journey / Material Board / Client              │
│  Presentation / Magazine / Social Story / Home Staging.                   │
│  Clicca "+ Materiale" → EntityPicker (typeahead su entities/search)       │
│  Seleziona "Noce Canaletto" → attach_entity() hook                        │
│   ├─ brand_entity_relations  (used_in_<surface>)                          │
│   ├─ entity_operational_usage (counter ++)                                │
│   └─ knowledge_impact_events  (audit 'only_here', noise-light)            │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  FASE 5 · KNOWLEDGE PROPAGATION  (KE-005C · futuro · scope-on-rename)     │
│  ─────────────────────                                                    │
│  · Quando si rinomina "Walnut → Noce Canaletto" in apply-correction       │
│    con scope='all_occurrences', un job leggero aggiorna i `snapshot`      │
│    delle relations · le surface mostrano il nuovo display_name.           │
│  · Out of scope per KE-005B (sync on-rename sarà aggiunto se serve).      │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  FASE 6 · OBSERVABILITY                                                   │
│  ─────────────────────                                                    │
│  · Future Uses™ (KE-004) · "Utilizzato in N moodboard, M journey, …"     │
│  · Connected Assets™ (KE-004) · hub-and-spoke grafo                       │
│  · Knowledge Impact History (KE-004) · timeline eventi                    │
│  · Operational Readiness (KE-004) · badge cross-surface                   │
└──────────────────────────────────────────────────────────────────────────┘
```

**Punto chiave**: i tre ledger di Fase 6 sono **già pronti per tutte le 8
surface**. Il valore di KE-005B sta nel **chiudere il loop** tra Fase 3 e
Fase 4: rendere le surface effettivamente capaci di **scrivere** nei ledger
che KE-004 sa già **leggere**.

---

## 2 · MATRICE DI READINESS SURFACE-PER-SURFACE

| Surface | Schema-ready | Hook-wired | UI-ready | Schedulable in | Backlog gap |
|---------|-------------|-----------|----------|----------------|-------------|
| **Brand Atlas** (Review Workspace V3.1) | ✅ | ✅ (origine) | ✅ | done in KE-002…KE-004 | — |
| **Moodboard** | 🟡 manca `entity_id` su `moodboard_elements` | ❌ hook non chiamato da `moodboards_v1.py` | ❌ no EntityPicker, no EntityContextPanel | KE-005B.1 + KE-005B.2 | ⭐ P0 |
| **Design Journey** | 🟡 manca `entity_refs JSONB` su `journey_milestones` | ❌ hook non chiamato da `design_journey.py` | ❌ no EntityPicker su milestone | KE-005B.1 + KE-005B.2 | ⭐ P0 |
| **Material Board** | ✅ enum già copre · UI non esiste | 🟡 hook supportato in mappa, nessuna tabella surface | ❌ surface non esiste in UI | KE-006 (futuro, post-005B) | 🟢 P1 |
| **Client Presentation** | ✅ enum già copre · può riusare moodboard_pages | 🟡 idem | ❌ surface non esiste in UI (esiste `client_preview` parziale) | KE-006/007 | 🟢 P1 |
| **Magazine** | ✅ enum già copre · tabelle `magazine_*` esistono | ❌ non in mappa hook | ⚠️ UI esiste già (`pages/magazine`) ma non integra entità | KE-007 | 🟢 P2 |
| **Social Story** | ✅ enum copre | ❌ non in mappa hook | ❌ surface non esiste | backlog | 🟢 P2 |
| **Product Selection** | ✅ enum copre | ❌ non in mappa hook | ❌ surface non esiste | backlog | 🟢 P2 |
| **Home Staging Pack** | ✅ enum copre | ❌ non in mappa hook | ❌ surface non esiste | KE-006 | 🟢 P2 |

**Score**: 1/9 surface completamente live · 2/9 schedulabili in KE-005B ·
4/9 schedulabili in sprint successivi senza nuovo refactor di foundation ·
2/9 dipendono solo da decisioni di prodotto future.

**Conclusione**: la foundation che stiamo per costruire ha un **moltiplicatore
8x** rispetto allo sforzo. Una volta wirata Moodboard e Journey, le altre 6
surface si attaccano con un'aggiunta di **una riga** alla mappa
`SURFACE_RELATION` + **una migration leggera** per la colonna `entity_id`
(o `entity_refs JSONB`).

---

## 3 · FOUNDATION SUITABILITY · DEEP CHECK

### 3.1 · `entity_operational_usage` come SSoT cross-surface

Verifiche fatte:

| Check | Risultato |
|-------|-----------|
| Enum `asset_type` copre tutte le 8 surface previste? | ✅ SÌ (migration 129) |
| Unique constraint previene doppi attach? | ✅ SÌ · `UNIQUE(tenant_id, entity_type, entity_id, asset_type, asset_id)` |
| Indici per query "Future Uses per entità"? | ✅ SÌ · `idx_eou_entity`, `idx_eou_tenant_entity` |
| View `entity_future_uses_v` materializza i counter? | ✅ SÌ (VIEW, no materialized — costo O(1) per entità grazie agli indici) |
| Schema supporta metadata extensible? | ✅ SÌ · campo `metadata` JSONB |

🟢 **Verdetto**: la tabella è **già il foundational truth** che ci serve.
KE-005B.1 non deve toccarla.

### 3.2 · `brand_entity_relations` come grafo cross-surface

| Check | Risultato |
|-------|-----------|
| Supporta `relation_type='used_in_<surface>'`? | ✅ SÌ (campo TEXT libero, validato lato app) |
| Indici per query "tutti gli usi di entity X"? | ✅ SÌ (verificato in audit KE-005A) |
| Distingue source/target type? | ✅ SÌ · `source_type` / `target_type` |
| Metadata supporta snapshot per fast-render? | ✅ SÌ · `metadata.snapshot` (già usato in `attach_entity` riga 79) |

🟢 **Verdetto**: il grafo Connected Assets è **già scritto per accogliere**
tutte le 8 surface. Zero schema-change.

### 3.3 · `knowledge_impact_events` come ledger audit

| Check | Risultato |
|-------|-----------|
| Scope semantici sufficienti? | ✅ `only_here / similar_in_brand / all_occurrences` |
| Hook attach genera scope='only_here' a basso rumore? | ✅ Verificato in `knowledge_usage_hooks.py` riga 120 |
| Pulse query supporta filter per surface? | ✅ via `preview_payload.surface_type` |

🟡 **Verdetto soft**: il ledger funziona ma rischia di **inflazionarsi**
con un evento per ogni inserzione moodboard (8 surface × N attach/giorno).
Raccomandazione: in KE-005B.1 introdurre un flag config
`HOOKS_EMIT_IMPACT_EVENT=False` di default per le surface tranne
'all_occurrences correction'. Lasciare `entity_operational_usage`
come **counter primario** e usare `knowledge_impact_events` solo per
correzioni semantiche (sua mission originale KE-003).

### 3.4 · `services/knowledge_usage_hooks.py` come orchestratore

| Check | Risultato |
|-------|-----------|
| Idempotenza · doppia attach non duplica relation? | ✅ SÌ (riga 62-68) |
| Detach scala il counter senza andare in negativo? | ✅ SÌ (`max(0, count-1)`) |
| Resolve entity safety (404)? | ✅ SÌ (riga 47) |
| Logging non-fatale per failure parziale? | ✅ SÌ (try/except con warning) |
| Surface_type validato? | ✅ SÌ (riga 43) |

🟢 **Verdetto**: il service è **production-ready** ma **dormiente**. Non
serve riscriverlo. Serve solo **invocarlo** dai router business.

### 3.5 · `routers/knowledge_surfaces.py` come API publica condivisa

| Endpoint | Stato | Note |
|----------|-------|------|
| `GET /knowledge/entities/search` | ✅ live | filtra type, brand_id, catalog_set_id, q (ILIKE), ordinato per mention_count desc |
| `POST /surfaces/{type}/{id}/attach` | ✅ live | accetta `entity_id` + optional block_id/milestone_id |
| `POST /surfaces/{type}/{id}/detach` | ✅ live | idempotente |
| `GET /surfaces/{type}/{id}/entities` | ✅ live | ritorna lista con snapshot |

🟢 **Verdetto**: il bus pubblico **è già lì**. Frontend può iniziare a
chiamarlo da subito. Backend deve solo wirare i side-effect dai router
existing (vedi §5).

---

## 4 · ENTITY CONTEXT PANEL™ · DESIGN SPECIFICATION

> Requisito utente: ogni volta che un'entità viene selezionata da
> Moodboard o Design Journey, deve apparire un pannello laterale alimentato
> dal Knowledge Engine.

### 4.1 · Scope funzionale

Il pannello è un **componente React riutilizzabile**
(`<EntityContextPanel entityId={...} surfaceContext={...} />`) che vive in:

* Moodboard editor — slide-in destro quando l'utente clicca su un block
  con `entity_id≠null`
* Design Journey workspace — slide-in destro quando una milestone ha
  `entity_refs` non vuoto e l'utente clicca su una chip-entità
* (futuro) Material Board / Client Presentation — stesso componente,
  zero modifiche

### 4.2 · Sezioni del pannello (10 sezioni · ordine prioritario)

```
┌─ ENTITY CONTEXT PANEL™ ─────────────────────────────────┐
│                                                         │
│  [ENTITY NAME · Big]                                    │  ← display_name + type pill
│  Brand · Designer                                       │  ← row 1
│                                                         │
│  ╔═════════════════════════════════════════════════╗    │
│  ║  CERTIFICATION STATUS                           ║    │  Sec. 1
│  ║  ✓ Certified · 06/06/2026                       ║    │  status + canonical_ref_id
│  ║  Source: ARBI test 2026 · pag. 12               ║    │
│  ╚═════════════════════════════════════════════════╝    │
│                                                         │
│  ╔═════════════════════════════════════════════════╗    │
│  ║  BRAND · DESIGNER · COLLECTION                  ║    │  Sec. 2 (compact)
│  ║  RIVA1920 · Terry Dwan · Brera Collection       ║    │  derivati da canonical
│  ╚═════════════════════════════════════════════════╝    │
│                                                         │
│  ╔═════════════════════════════════════════════════╗    │
│  ║  MATERIALS                                      ║    │  Sec. 3
│  ║  · Noce Canaletto (primary)                     ║    │  brand_entity_relations
│  ║  · Brass insert                                 ║    │  (relation_type='made_of')
│  ╚═════════════════════════════════════════════════╝    │
│                                                         │
│  ╔═════════════════════════════════════════════════╗    │
│  ║  OPERATIONAL READINESS                          ║    │  Sec. 4
│  ║  ✓ Ready for Moodboard                          ║    │  endpoint
│  ║  ✓ Ready for Design Journey                     ║    │  /operational-readiness
│  ║  ⚠ Missing image for Client Presentation        ║    │
│  ╚═════════════════════════════════════════════════╝    │
│                                                         │
│  ╔═════════════════════════════════════════════════╗    │
│  ║  FUTURE USES™                                   ║    │  Sec. 5
│  ║  Moodboard       · 3 utilizzi                   ║    │  entity_future_uses_v
│  ║  Design Journey  · 1 utilizzo                   ║    │
│  ║  Client Present. · 0 utilizzi                   ║    │
│  ╚═════════════════════════════════════════════════╝    │
│                                                         │
│  ╔═════════════════════════════════════════════════╗    │
│  ║  CONNECTED ASSETS™                              ║    │  Sec. 6
│  ║  ◆ 2 prodotti · ◆ 4 immagini · ◆ 1 progetto     ║    │  /connected-assets (chip-only)
│  ║  [Vedi grafo completo →]                        ║    │  → apre Entity Inspector
│  ╚═════════════════════════════════════════════════╝    │
│                                                         │
│  ╔═════════════════════════════════════════════════╗    │
│  ║  ASSET COUNTS                                   ║    │  Sec. 7
│  ║  📷 4 immagini  ·  📄 2 documenti               ║    │  source_document_ids,
│  ║                                                 ║    │  brand_catalog_pages.asset_refs
│  ╚═════════════════════════════════════════════════╝    │
│                                                         │
│  ╔═════════════════════════════════════════════════╗    │
│  ║  PROVENANCE                                     ║    │  Sec. 8 (collapsed)
│  ║  Source: ARBI test 2026 · pag. 12 · cell 3      ║    │  source_document_ids,
│  ║  Mention count: 7                               ║    │  source_page_ids,
│  ║  Confidence: 96%                                ║    │  confidence_score
│  ╚═════════════════════════════════════════════════╝    │
│                                                         │
│  ╔═════════════════════════════════════════════════╗    │
│  ║  ACTIONS                                        ║    │  Sec. 9
│  ║  [Apri in Brand Atlas →]                        ║    │  deep-link a Review Workspace
│  ║  [Sostituisci entità]                           ║    │  swap → triggers detach+attach
│  ║  [Rimuovi dal block/milestone]                  ║    │  detach
│  ╚═════════════════════════════════════════════════╝    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4.3 · Dati richiesti vs endpoint già esistenti

| Sezione | Endpoint che la alimenta | Stato |
|---------|---------------------------|-------|
| 1 · Certification Status | `GET /catalog-sets/{set_id}/entities/{entity_id}` (esiste · review_workspace_v3) | ✅ live |
| 2 · Brand · Designer · Collection | `brand_detected_entities` JOIN `brands`, `designers`, `collections` (deriv. dal canonical) | ✅ live |
| 3 · Materials | `brand_entity_relations` con `relation_type='made_of'` (filtro applicativo) | ✅ live |
| 4 · Operational Readiness | `GET /entities/{id}/operational-readiness` | ✅ live (KE-004) |
| 5 · Future Uses | `GET /entities/{id}/future-uses` | ✅ live (KE-004) |
| 6 · Connected Assets | `GET /entities/{id}/connected-assets` | ✅ live (KE-004) |
| 7 · Asset Counts | derivato da `source_document_ids` + `brand_catalog_pages.asset_refs` | ✅ live |
| 8 · Provenance | `brand_detected_entities` (confidence, mention_count, source_*) | ✅ live |
| 9 · Actions | usa `/surfaces/{type}/{id}/detach` + deep-link | ✅ live (knowledge_surfaces) |

🟢 **Verdetto critico**: **ZERO nuovi endpoint backend** per costruire il
pannello. Tutti i dati sono già disponibili. KE-005B.1 deve solo introdurre
**un singolo endpoint aggregato di convenienza** per ridurre il fan-out:

```
GET /api/knowledge/entities/{entity_id}/context-panel
  → ritorna in 1 chiamata tutte le 9 sezioni
  → backend fa fan-out lato server (latency O(1) tower)
```

Effort stimato: ~80 righe Python (aggregator query).

### 4.4 · Componente frontend riusabile

**Naming**:
`/app/frontend/src/components/knowledge/EntityContextPanel.jsx`
(cartella nuova, ma il pattern segue `/review-workspace/`).

**Props**:
```js
<EntityContextPanel
  entityId={uuid}
  surfaceContext={{ type: 'moodboard', id: '<moodboard_id>',
                     blockId: '<block_id>' }}
  onClose={() => {}}
  onSwap={(newEntityId) => {}}   // optional
  onRemove={() => {}}            // optional · invoca detach
/>
```

**Stato visivo**:
* Glass-dark · backdrop-blur 16px · z-index 90
* Slide-in da destra (motion `x: 0 → -360px`)
* Min width 360px, max 480px
* Sticky header con nome entità
* Sezioni collassabili (Provenance default collapsed)

**Riuso architetturale**: lo stesso componente serve moodboard / journey
/ material_board / client_presentation **senza modifiche**, semplicemente
variando `surfaceContext.type`.

---

## 5 · GAP DI WIRING · COSA RIMANE DA FARE IN KE-005B.1

### 5.1 · Backend (50% del lavoro)

| Task | Effort | File | Note |
|------|--------|------|------|
| Migration: `ALTER moodboard_elements ADD COLUMN entity_id UUID NULL` + index | 🟢 LOW | `migrations/132_ke005b_entity_native_surfaces.sql` (nuovo) | FK soft (no constraint, evita lock) |
| Migration: `ALTER journey_milestones ADD COLUMN entity_refs JSONB DEFAULT '[]'` | 🟢 LOW | idem | array per multi-entity per milestone |
| Side-effect: `POST /moodboards/{id}/blocks` → se `body.entity_id`, chiama `hooks.attach_entity()` | 🟢 LOW | `routers/moodboards_v1.py` riga 581 (insert) | <10 righe |
| Side-effect: `DELETE /moodboards/{id}/blocks/{block_id}` → se `block.entity_id`, chiama `hooks.detach_entity()` | 🟢 LOW | idem (delete handler) | <10 righe |
| Side-effect: `PATCH /journeys/milestones/{mid}` → se `entity_refs` cambia, diff e chiama attach/detach | 🟢 LOW | `routers/design_journey.py` riga 320 | <20 righe |
| Endpoint nuovo: `GET /api/knowledge/entities/{id}/context-panel` (aggregator) | 🟡 MEDIUM | `routers/knowledge_surfaces.py` (estensione) | ~80 righe |
| Aggiornare mappa `SURFACE_RELATION` quando si arriverà a magazine/social_story/product_selection/home_staging | 🟢 LOW (futuro) | `services/knowledge_usage_hooks.py` | 4 righe |

**Effort totale backend KE-005B.1**: ~½ giornata.

### 5.2 · Frontend (50% del lavoro = KE-005B.2)

| Componente | Effort | File | Note |
|-----------|--------|------|------|
| `<EntityPicker entityType={...} brandId={...} catalogSetId={...} onSelect={...} />` modale typeahead | 🟡 MEDIUM | `/app/frontend/src/components/knowledge/EntityPicker.jsx` (nuovo) | ~150 righe · debounce 200ms · lista virtualizzata sotto 30 |
| `<EntityContextPanel ...props />` slide-in pannello | 🟡 MEDIUM | `/app/frontend/src/components/knowledge/EntityContextPanel.jsx` (nuovo) | ~250 righe · 9 sezioni · sub-components per ognuna |
| Moodboard: `LibraryPanel.jsx` → bottone "+ Prodotto" / "+ Materiale" / "+ Designer" apre `<EntityPicker>` invece di creare block vuoto | 🟢 LOW | `/app/frontend/src/blueprint/moodboard/LibraryPanel.jsx` | ~30 righe |
| Moodboard: `BlockRegistry.js` → render block con `entity_id` legge da `entity_context_panel` cache invece di `block.content` | 🟡 MEDIUM | idem | aggiunge `EntityBlockRenderer` |
| Moodboard: click su entity-block → apre `<EntityContextPanel>` | 🟢 LOW | `MoodboardEditor.jsx` (handler) | ~10 righe |
| Design Journey: `MoodboardDirectionWorkspace.jsx` → aggiungi chip-entity (multi-select via `<EntityPicker>`) | 🟢 LOW | `components/journey/MoodboardDirectionWorkspace.jsx` | ~40 righe |
| Design Journey: click su chip → apre `<EntityContextPanel>` con `surfaceContext.type='design_journey'` | 🟢 LOW | idem | ~10 righe |
| Empty state (su Picker · "Nessuna entità certificata · vai a Knowledge Engine") | 🟢 LOW | `EntityPicker.jsx` | ~20 righe |

**Effort totale frontend KE-005B.2**: 1 sprint UX.

---

## 6 · ROI POST-KE-005B (PROIEZIONE)

Una volta wirate Moodboard + Design Journey (fine KE-005B.2):

| Metrica | Prima (oggi) | Dopo KE-005B |
|---------|--------------|--------------|
| Future Uses™ counters reali per moodboard | 0 | live ★ |
| Future Uses™ counters reali per journey | 0 | live ★ |
| Connected Assets grafo: nodi Moodboard | 0/682 relations | live ★ |
| Connected Assets grafo: nodi Journey | 0/682 relations | live ★ |
| Drift Source of Truth (Moodboard) | 5/8 categorie | 1/8 categorie (palette only) |
| Drift Source of Truth (Journey) | 2/6 categorie | 0/6 categorie |
| Surfaces Knowledge-Native | 1/8 (Review WS) | 3/8 (+ Moodboard + Journey) |
| Foundation riutilizzabile per surface 4-8 | parziale | totale (zero refactor) |

**Indicatore strategico**: il numero di **clic necessari a un designer**
per "vedere dove sta usando un materiale certificato" passa da
**indefinito** (oggi non è possibile) a **1 clic** (Entity Inspector
Future Uses + Operational Readiness mostrano l'intero ecosistema).

---

## 7 · RISCHI E MITIGAZIONI

| Rischio | Probabilità | Severità | Mitigazione |
|---------|-------------|----------|-------------|
| Ledger `knowledge_impact_events` rumoroso da inserzioni surface | 🟡 MEDIO | 🟡 MEDIO | Flag `HOOKS_EMIT_IMPACT_EVENT_FROM_ATTACH=False` di default. Solo correzioni semantiche scrivono nel ledger. Side-effect attach scrive solo in `entity_operational_usage`. |
| Drift di `metadata.snapshot` quando entità rinominate | 🟢 BASSO (v1) | 🟢 BASSO | Snapshot mostrato come "fast-render", il render canonico fa lookup live. Sync-on-rename schedulabile in KE-005C. |
| Migration su `moodboard_elements` (count=0 in DB) | 🟢 BASSO | 🟢 BASSO | Tabella vuota in produzione · zero rischio backfill. |
| Migration su `journey_milestones` (count=0) | 🟢 BASSO | 🟢 BASSO | Idem. |
| Multi-entity per milestone (entity_refs JSONB array) può creare query lente | 🟢 BASSO | 🟢 BASSO | Indice GIN su `entity_refs`. Volume previsto ≤ 20 entità per milestone. |
| Picker su brand con 0 entità certificate confonde l'utente | 🟡 MEDIO | 🟢 BASSO | Empty state con CTA "Vai al Knowledge Engine" + counter "0 certificate · N pending review". |
| Refactor moodboard editor (2245 righe) tocca aree fragili | 🟡 MEDIO | 🟡 MEDIO | Cambi limitati a `LibraryPanel` + click-handler + render block. Non si tocca `position_json`, `style_json`, presentation mode, share. |

---

## 8 · CONFERMA DEL PIANO SPRINT

### KE-005B.1 · Foundation (½ sprint)

**Backend only · zero UI**:
1. Migration 132 — colonne `entity_id` (moodboard_elements) e `entity_refs` (journey_milestones) + indici
2. Wire side-effect attach in `routers/moodboards_v1.py` (create_block · delete_block)
3. Wire side-effect attach/detach in `routers/design_journey.py` (PATCH milestone)
4. Nuovo endpoint aggregato `GET /api/knowledge/entities/{id}/context-panel`
5. Test backend pytest (`tests/test_ke005b_foundation.py`)

**Output**: la API è completamente capace. Frontend ancora non chiama.

### KE-005B.2 · Surfaces (1 sprint)

**Frontend principalmente · pochi micro-tweak backend**:
1. `<EntityPicker>` modale
2. `<EntityContextPanel>` slide-in
3. Wire Moodboard `LibraryPanel` → Picker → attach
4. Wire Moodboard block click → Context Panel
5. Wire Design Journey milestone → Picker (multi-select) → attach
6. Wire Journey chip click → Context Panel
7. Empty state + read-only graceful per legacy block
8. Smoke test e testing agent E2E

**Output**: Moodboard e Design Journey sono **Knowledge-Native** —
primi consumatori reali del Knowledge Engine.

### KE-005C · (futuro · solo se servirà)

* Sync-on-rename (cron leggero per propagare display_name aggiornati ai snapshot)
* Material Board UI (riusa `<EntityPicker>` + `<EntityContextPanel>` zero-cost)
* Client Presentation UI

---

## 9 · CONCLUSIONE

# 🟢 **FOUNDATION VALIDATA · READY TO BUILD KE-005B.1**

L'architettura attuale, costruita progressivamente in KE-001 → KE-004,
è **già pensata** come piattaforma cross-surface:

* lo schema canonico (`entity_operational_usage`, `brand_entity_relations`,
  `knowledge_impact_events`) **già supporta** 8 surface
* il service-layer (`knowledge_usage_hooks.py`) **già esiste** ed è
  idempotente · production-ready
* l'API publica (`/api/knowledge/entities/*` + `/api/surfaces/*`)
  **già è montata** in `server.py`

KE-005B non è un refactor architetturale. È un **wiring sprint** che
chiude il loop tra Knowledge Engine (lettura) e Surfaces (scrittura),
producendo il **primo flusso bidirezionale** di knowledge dell'ecosistema
MOOD.

Il rischio architetturale è **molto basso** perché la foundation è già
provata da KE-004. Il rischio UX è gestibile concentrandosi su due
componenti riutilizzabili (`<EntityPicker>` + `<EntityContextPanel>`)
che, una volta costruiti, **servono tutte le 8 surface future** senza
nuovo codice.

---

> **Firma report**: Main Agent · iteration 216 · 06 Jun 2026 15:30 UTC
> **Modalità**: READ-ONLY · zero modifiche al codice
> **Foundation files già esistenti**:
> · `/app/backend/services/knowledge_usage_hooks.py`
> · `/app/backend/routers/knowledge_surfaces.py`
> · `/app/supabase/migrations/129_review_workspace_v3.sql`
> **Audit precedenti**: KE005A · KE005B0
> **Test credentials**: `admin@moodfordesign.com` / `Blueprint2024!`
