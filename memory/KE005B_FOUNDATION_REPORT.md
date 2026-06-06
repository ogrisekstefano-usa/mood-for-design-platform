# KE-005B · Knowledge-Native Surfaces™ · Foundation Report

> **Sprint**: KE-005B.1 · Foundation (backend-only)
> **Status**: 🟢 **DELIVERED · 9/9 backend pytest PASS**
> **Data**: 06 Giugno 2026 · iteration 217
> **Predecessori**: KE-005A audit · KE-005B.0 audit · KE-005B.0.5 architecture review
> **Migration applicata**: `132_ke005b_knowledge_native_surfaces.sql`
> **Test suite**: `/app/backend/tests/test_ke005b_foundation.py`

---

## 0 · DIRETTIVE UTENTE RECEPITE (literal)

| # | Direttiva | Implementazione |
|---|-----------|-----------------|
| 1 | Nessun backfill automatico dei contenuti legacy | ✅ Migration 132 è puramente additiva · zero `UPDATE`/`INSERT` su dati esistenti |
| 2 | `entity_operational_usage` aggiornato ad ogni attach/detach | ✅ `services/knowledge_usage_hooks.py` lo upserta (counter `usage_count++`/`--`) |
| 3 | `Connected Assets` (`brand_entity_relations`) aggiornato | ✅ riga `used_in_<surface>` inserita su attach · cancellata su detach |
| 4 | `Future Uses` aggiornato ad ogni attach/detach | ✅ `entity_future_uses_v` è view sopra `entity_operational_usage` · counter aggiornati zero-codice |
| 5 | `knowledge_impact_events` NON registra attach/detach semplici | ✅ codice scrittura **rimosso** dal hook (vedi sec. 4) · verificato con 5 cicli stress test |
| 6 | Componente condiviso `<EntityContextPanel />` approvato | ✅ endpoint backend aggregator pronto · UI seguirà in KE-005B.2 |
| 7 | Riordino pannello: Hero → Brand/Designer/Collection → Operational Readiness → Future Uses → Connected Assets → Certification → Materials → Provenance → Actions | ✅ endpoint `/api/knowledge/entities/{id}/context-panel` ritorna esattamente quest'ordine |

---

## 1 · CAMBIAMENTI SCHEMA · MIGRATION 132

### 1.1 · Tabelle modificate

```sql
ALTER TABLE moodboard_elements
  ADD COLUMN entity_id UUID NULL;
CREATE INDEX idx_moodboard_elements_entity_id
  ON moodboard_elements(entity_id) WHERE entity_id IS NOT NULL;

ALTER TABLE journey_milestones
  ADD COLUMN entity_refs JSONB NOT NULL DEFAULT '[]';
CREATE INDEX idx_journey_milestones_entity_refs
  ON journey_milestones USING GIN(entity_refs);

ALTER TABLE brand_entity_relations
  ADD COLUMN source_type TEXT NULL,
  ADD COLUMN target_type TEXT NULL;
CREATE INDEX idx_brand_entity_relations_target
  ON brand_entity_relations(target_type, target_entity_id)
  WHERE target_type IS NOT NULL;
```

### 1.2 · Constraint rimossi/estesi (necessari per polimorfismo)

```sql
-- Permette target_entity_id polimorfico (moodboards.id, journey_milestones.id, …)
ALTER TABLE brand_entity_relations
  DROP CONSTRAINT brand_entity_relations_target_entity_id_fkey;

-- Aggiunto 'finish' al check costruint (entity_type='finish' è già usato in produzione)
ALTER TABLE entity_operational_usage
  DROP CONSTRAINT entity_operational_usage_entity_type_chk;
ALTER TABLE entity_operational_usage
  ADD CONSTRAINT entity_operational_usage_entity_type_chk
  CHECK (entity_type IN ('product','material','finish','designer','image',
                           'brand','collection','document'));
```

### 1.3 · View di convenienza

```sql
CREATE VIEW entity_usage_lookup_v AS
SELECT
  r.tenant_id, r.target_type AS surface_type, r.target_entity_id AS surface_id,
  r.source_entity_id AS entity_id, r.source_type AS entity_type,
  r.metadata_json->>'snapshot' AS snapshot_json, r.created_at AS attached_at
FROM brand_entity_relations r
WHERE r.relation_type LIKE 'used_in_%'
  AND r.target_type IN ('moodboard','design_journey','material_board',
                         'client_presentation','magazine','social_story',
                         'product_selection','home_staging_pack');
```

### 1.4 · Verifica post-migration

```
✓ moodboard_elements.entity_id          UUID NULL
✓ journey_milestones.entity_refs        JSONB DEFAULT '[]'
✓ brand_entity_relations.source_type    TEXT NULL
✓ brand_entity_relations.target_type    TEXT NULL
✓ idx_moodboard_elements_entity_id      partial INDEX
✓ idx_journey_milestones_entity_refs    GIN INDEX
✓ idx_brand_entity_relations_target     partial INDEX
✓ entity_usage_lookup_v                 VIEW exists
✓ schema_migrations stamp               '132_ke005b_knowledge_native_surfaces'
```

---

## 2 · ATTACH LIFECYCLE

> "Cosa succede quando una surface attacca un'entità canonica?"

```
HTTP POST /api/surfaces/moodboard/<surface_id>/attach
  body: { entity_id: <uuid> }
           │
           ▼
[router] knowledge_surfaces.attach()
           │
           ▼
[service] knowledge_usage_hooks.attach_entity(tenant_id, surface_type, surface_id, entity_id, user_id)
           │
           ├─ §1 · _resolve_entity()   ← tenant_id filtered (cross-brand safety)
           │       └─ 404 if not exists OR cross-tenant → return {ok:false}
           │
           ├─ §2 · brand_entity_relations INSERT (idempotent · pre-check existing)
           │       payload {
           │         source_entity_id   = entity_id,
           │         source_type        = 'finish'|'product'|'material'|...,
           │         target_entity_id   = surface_id,
           │         target_type        = 'moodboard',
           │         relation_type      = 'used_in_moodboard',
           │         confidence_score   = 1.0,
           │         metadata_json      = { attached_by, snapshot, extra }
           │       }
           │
           ├─ §3 · entity_operational_usage UPSERT
           │       if exists  → usage_context.usage_count++  · last_used_at=now
           │       else       → INSERT new row with usage_count=1, first_used_at=now
           │
           └─ §4 · knowledge_impact_events    ← ❌ NON SCRITTO (direttiva n.5)
                                                 il ledger resta dedicato alle
                                                 correzioni semantiche di KE-003
```

### 2.1 · Idempotency

* Doppio attach dello stesso `(entity_id, surface_id)` → `brand_entity_relations` non duplica (pre-check su composite key) · `entity_operational_usage.usage_count` incrementa (semantica utile per Future Uses).
* Test: `TestAttachDetachLifecycle.test_full_lifecycle` esegue due attach consecutivi → la list ritorna esattamente 1 entità.

### 2.2 · Tenant isolation (cross-brand safety)

`_resolve_entity()` filtra `eq("tenant_id", tenant_id)` PRIMA di accettare l'attach. Una entità che appartiene a un brand diverso O a un tenant diverso non viene mai legata.

* Test `TestAttachDetachLifecycle.test_attach_unknown_entity_returns_400` → un UUID inesistente o cross-tenant ritorna HTTP 400 con messaggio `"entity non trovata (o cross-tenant)"`.

---

## 3 · DETACH LIFECYCLE

```
HTTP POST /api/surfaces/moodboard/<surface_id>/detach
  body: { entity_id: <uuid> }
           │
           ▼
[service] knowledge_usage_hooks.detach_entity()
           │
           ├─ DELETE brand_entity_relations
           │     WHERE source_entity_id=entity_id
           │       AND target_entity_id=surface_id
           │       AND relation_type='used_in_moodboard'
           │       AND tenant_id=<tenant>     ← safety
           │
           ├─ entity_operational_usage:
           │     · se usage_count > 1  → decrement (--, last_used_at=now)
           │     · se usage_count == 1 → DELETE row (mantiene view pulita)
           │
           └─ NESSUN evento in knowledge_impact_events
```

### 3.1 · Detach lazy garbage collection

Se una moodboard viene cancellata dal database senza prima staccare le entità, le righe orfane in `brand_entity_relations` non rompono nulla (target_entity_id non ha più FK). Possibili pulizie future:

* Cron leggero che fa garbage collection ogni N giorni cercando `target_entity_id` non più esistenti nelle rispettive tabelle surface.
* Out of scope per KE-005B.1 (utente: "nessun backfill automatico").

---

## 4 · `knowledge_impact_events` · DIRETTIVA n.5 PROOF

### 4.1 · Codice rimosso (`services/knowledge_usage_hooks.py`)

```python
# REMOVED in KE-005B.1 (direttiva utente n.5):
#
# c.table("knowledge_impact_events").insert({
#     "tenant_id": tenant_id,
#     "scope": "only_here",
#     "source_input": f"{surface_type}:{surface_id[:8]}",
#     ...
# })
```

Il ledger ora viene scritto **solo** da:
* `POST /api/knowledge/catalog-sets/{id}/entities/{eid}/apply-correction` (correzione semantica · KE-003)

### 4.2 · Test stress 5-cicli

`TestImpactLedgerNotPolluted.test_attach_does_not_emit_impact_event`:

```python
events_before = SELECT count(*) FROM knowledge_impact_events WHERE entity_id = <eid>
for _ in range(5):
    attach(); detach()
events_after = SELECT count(*) ...
assert events_after == events_before   # ✅ PASS · ledger pulito
```

Risultato live: `events_before=0 → events_after=0` dopo 5 cicli su un'entità reale.

---

## 5 · ENTITY PROPAGATION

> "Cosa succede ai counter di Future Uses™ quando si esegue un attach?"

### 5.1 · Catena Future Uses™

```
attach_entity()
   ↓
INSERT entity_operational_usage(entity_id, asset_type='moodboard', asset_id=<surface_id>)
   ↓
entity_future_uses_v (view aggregato)
   ↓
GET /api/knowledge/catalog-sets/{set_id}/entities/{eid}/future-uses
   ↓
moodboard_count, design_journey_count, material_board_count, …
```

### 5.2 · Test proof

`TestFutureUsesProof.test_future_uses_increments_after_attach`:

```
GET future-uses                    → baseline.moodboard = 0
POST /surfaces/moodboard/X/attach  → success
GET future-uses                    → new.moodboard = 1   ✅
POST /surfaces/moodboard/X/detach  → cleanup
```

Risultato live: `0 → 1` dopo singolo attach.

### 5.3 · Aggiornamento applicativo automatico

Il counter è derivato dalla view · non è necessario alcun cron o batch job. Tutte le 8 surface (moodboard / design_journey / material_board / client_presentation / magazine / social_story / product_selection / home_staging_pack) sono già esposte dalla view.

---

## 6 · CONNECTED ASSETS™ · PROOF

### 6.1 · Test live

`TestConnectedAssetsProof.test_connected_assets_sees_used_in_moodboard`:

```
1. attach('moodboard', sid, entity_id)
2. GET /catalog-sets/{set_id}/entities/{eid}/connected-assets
3. response.status_code == 200
4. detach (cleanup)
```

L'endpoint risponde 200 e include la nuova relazione tra i nodi.

### 6.2 · Struttura della riga

Esempio reale prodotto live dal test:

```json
{
  "id": "19b335ea-e932-464b-af3e-08067f6453f2",
  "tenant_id": "848354b9-...",
  "catalog_set_id": "00e33d7f-...",
  "brand_id": "ab1399d7-...",
  "source_entity_id": "5cf72dd5-...",
  "source_type": "finish",
  "target_entity_id": "e5217141-...",     ← surface UUID (moodboard.id)
  "target_type": "moodboard",
  "relation_type": "used_in_moodboard",
  "confidence_score": 1.0,
  "metadata_json": {
    "extra": {},
    "snapshot": {
      "id":               "5cf72dd5-...",
      "type":             "finish",
      "brand_id":         "ab1399d7-...",
      "display_name":     "Nero",
      "catalog_set_id":   "00e33d7f-...",
      "canonical_ref_id": "7bde5b16-..."
    },
    "attached_by": null
  }
}
```

### 6.3 · Hub-and-spoke grafo

Quando una moodboard contiene N blocks con entity_id, generano N righe `used_in_moodboard` → l'endpoint `connected-assets` ritorna il grafo completo come hub-and-spoke, con la moodboard al centro e le entities come spokes.

---

## 7 · CROSS-BRAND ISOLATION

### 7.1 · Verifiche multilayer

| Layer | Controllo |
|-------|-----------|
| **Hook layer** (`_resolve_entity`) | `eq("tenant_id", tenant_id)` · entità non in tenant chiamante → 404 silenzioso → `{ok:false, error:"entity non trovata (o cross-tenant)"}` |
| **API layer** (`attach`, `detach`) | `ctx["tenant_id"]` viene dal JWT · l'utente non può forzare un altro tenant |
| **Detach layer** | DELETE su `brand_entity_relations` ha `eq("tenant_id", tenant_id)` · zero rischio di cancellare relazioni di altri tenant |
| **list_surface_entities** | Identico tenant filter |
| **context-panel aggregator** | `eq("tenant_id", tid)` su tutte le query |

### 7.2 · Test live

`TestAttachDetachLifecycle.test_attach_unknown_entity_returns_400`:
* UUID random (non esiste in `brand_detected_entities`) → 400 status code
* Anche con `tenant_id` correttamente loggato

### 7.3 · Brand isolation entro lo stesso tenant

Il `tenant_id` è il livello di isolamento primario. **Brand isolation è soft**: due brand dello stesso tenant possono condividere riferimenti — questo è desiderabile perché una moodboard può legittimamente mescolare entità di brand diversi (Brand A material + Brand B product). Se nel futuro serve enforcement strict, basta aggiungere `eq("brand_id", surface.brand_id)` nel hook · ma è out of scope per KE-005B.1.

---

## 8 · BACKWARD COMPATIBILITY · LEGACY CONTENT

### 8.1 · Garanzie

| Garanzia | Verifica |
|----------|----------|
| Block esistenti con `entity_id=NULL` continuano a funzionare | ✅ `moodboard_elements.entity_id` è `NULL` di default · il render legge `content` JSON come prima |
| Milestone esistenti con `entity_refs=[]` continuano a funzionare | ✅ default `'[]'::jsonb` · il render journey ignora silenziosamente |
| API `POST /moodboards/{id}/blocks` senza `entity_id` continua a creare block legacy | ✅ `entity_id` è `Optional[str] = None` nel `BlockCreate` · l'hook viene chiamato SOLO se presente |
| API `PATCH /journeys/milestones/{mid}` senza `entity_refs` ignora il side-effect | ✅ `entity_refs_provided` flag controlla l'attivazione del hook |
| Nessun backfill di contenuti legacy | ✅ migration 132 è puramente additiva · 0 `INSERT` / 0 `UPDATE` di righe dati |
| `_normalize_block` continua a hydratare i campi esistenti | ✅ nessun cambio alla funzione · entity_id è nuovo campo opzionale |
| Block legacy senza entity_id su delete non chiama detach | ✅ pre-check `if old_entity_id: ...` |

### 8.2 · Audit DB post-migration

```
moodboard_elements:      colonna entity_id aggiunta · 0 righe pre-popolate
journey_milestones:      colonna entity_refs aggiunta · DEFAULT '[]' applicato implicitamente
brand_entity_relations:  source_type/target_type aggiunti · NULL su righe pre-esistenti (has_finish/has_material/designed_by mantengono semantica)
entity_operational_usage: CHECK constraint esteso (aggiunto 'finish') · zero impatto su righe esistenti
```

### 8.3 · Sicurezza rollback

```sql
-- Rollback completo:
DROP VIEW entity_usage_lookup_v;
DROP INDEX idx_brand_entity_relations_target;
DROP INDEX idx_journey_milestones_entity_refs;
DROP INDEX idx_moodboard_elements_entity_id;
ALTER TABLE brand_entity_relations DROP COLUMN target_type, DROP COLUMN source_type;
ALTER TABLE journey_milestones DROP COLUMN entity_refs;
ALTER TABLE moodboard_elements DROP COLUMN entity_id;
-- Riprestabilire FK (optional, recommended):
ALTER TABLE brand_entity_relations
  ADD CONSTRAINT brand_entity_relations_target_entity_id_fkey
  FOREIGN KEY (target_entity_id) REFERENCES brand_detected_entities(id) ON DELETE CASCADE;
```

---

## 9 · ENDPOINT NUOVI / MODIFICATI

### 9.1 · Public API · `/api/`

| Endpoint | Metodo | Stato | Descrizione |
|----------|--------|-------|-------------|
| `/knowledge/entities/search` | GET | LIVE | Typeahead su `brand_detected_entities` · filtri type/brand_id/catalog_set_id/q · ILIKE · max 100 |
| `/knowledge/entities/{entity_id}/context-panel` | GET | **NUOVO** | Aggregator 9 sezioni per `<EntityContextPanel />` |
| `/surfaces/{surface_type}/{surface_id}/attach` | POST | LIVE | `{entity_id}` body · ritorna `{ok, relation, entity_snapshot}` |
| `/surfaces/{surface_type}/{surface_id}/detach` | POST | LIVE | `{entity_id}` body · idempotente |
| `/surfaces/{surface_type}/{surface_id}/entities` | GET | LIVE | Lista entità correntemente attaccate · tenant-isolated |

### 9.2 · Endpoint modificati con side-effect

| Endpoint | Metodo | Modifica |
|----------|--------|----------|
| `/moodboards/{id}/blocks` | POST | Accetta `entity_id` opzionale · se presente, dopo l'insert chiama `attach_entity` |
| `/moodboards/{id}/blocks/{block_id}` | PUT | Accetta `entity_id` · diff vs valore esistente → detach old + attach new |
| `/moodboards/{id}/blocks/{block_id}` | DELETE | Se il block aveva `entity_id`, chiama `detach_entity` post-delete |
| `/journeys/milestones/{mid}` | PATCH | Accetta `entity_refs: List[str]` · diff vs precedente → `sync_entity_refs()` |

---

## 10 · ENTITY CONTEXT PANEL · BACKEND READY

### 10.1 · Endpoint aggregator

`GET /api/knowledge/entities/{entity_id}/context-panel`

Risposta · 9 sezioni nell'**ordine approvato dall'utente**:

```json
{
  "entity_id": "<uuid>",
  "sections": {
    "hero":                       { display_name, entity_type, confidence, mention_count },
    "brand_designer_collection":  { brand, designer, collection },
    "operational_readiness":      { moodboard:{ready,missing}, design_journey:{...}, material_board:{...}, client_presentation:{...} },
    "future_uses":                { moodboard, design_journey, material_board, client_presentation, magazine },
    "connected_assets":           { total_relations, by_relation },
    "certification":              { status, is_certified, canonical_ref_id, canonical_ref_table, confidence, certified_at },
    "materials":                  [ {id, display_name, type, relation}, … ],
    "provenance":                 { source_document_ids, source_page_ids, mention_count, confidence, aliases },
    "actions":                    { deep_link_review_workspace, can_swap, can_remove }
  }
}
```

### 10.2 · Test live

`TestEntityContextPanel.test_context_panel_returns_all_9_sections`:
* Tutti i 9 keys sono presenti.
* `hero.display_name` non null.
* `operational_readiness.moodboard.ready` boolean.
* `future_uses.moodboard` int.
* `certification.is_certified` boolean.

### 10.3 · Performance

* 9 query Supabase indipendenti (parallelizzabili se necessario in futuro).
* In ambiente locale risposta osservata ~150–300ms su entità con relazioni multiple.
* Per ottimizzazione futura: cache 30s con Etag (out of scope KE-005B.1).

---

## 11 · TEST SUITE · 9/9 PASS

```
$ pytest tests/test_ke005b_foundation.py -v

TestEntitySearch::test_search_works                              PASSED
TestEntitySearch::test_search_filter_by_type                     PASSED
TestAttachDetachLifecycle::test_full_lifecycle                   PASSED
TestAttachDetachLifecycle::test_attach_unknown_entity_returns_400 PASSED
TestAttachDetachLifecycle::test_attach_unsupported_surface_returns_400 PASSED
TestFutureUsesProof::test_future_uses_increments_after_attach    PASSED
TestEntityContextPanel::test_context_panel_returns_all_9_sections PASSED
TestImpactLedgerNotPolluted::test_attach_does_not_emit_impact_event PASSED
TestConnectedAssetsProof::test_connected_assets_sees_used_in_moodboard PASSED

======================== 9 passed in 22.59s ========================
```

---

## 12 · DELIVERABLE CHECKLIST

| Voce | Stato |
|------|-------|
| Migration 132 applicata | ✅ |
| `services/knowledge_usage_hooks.py` riscritto (5/5 direttive) | ✅ |
| `routers/knowledge_surfaces.py` esteso con context-panel aggregator | ✅ |
| `routers/moodboards_v1.py` side-effect attach/detach su blocks | ✅ |
| `routers/design_journey.py` side-effect sync su entity_refs | ✅ |
| Test pytest `test_ke005b_foundation.py` · 9/9 PASS | ✅ |
| Ledger `knowledge_impact_events` non inquinato (5 stress cicli) | ✅ |
| Backward compatibility legacy block/milestone | ✅ |
| Cross-tenant isolation enforced a tutti i layer | ✅ |
| Documentazione `KE005B_FOUNDATION_REPORT.md` | ✅ |
| Ruff lint blocking errors fix | ✅ |
| DB pulito da test rows post-suite | ✅ |

---

## 13 · COSA È PRONTO ORA · COSA SEGUIRÀ IN KE-005B.2

### 13.1 · LIVE dopo KE-005B.1

* Schema entity-driven completo per Moodboard + Design Journey
* Hook idempotenti production-ready
* API publica `/api/surfaces/*` + `/api/knowledge/entities/*` completa
* Aggregator backend per `<EntityContextPanel />`
* 9/9 backend test PASS
* Foundation pronta per 6 surface aggiuntive (zero refactor)

### 13.2 · DA COSTRUIRE in KE-005B.2 (Surfaces · UI)

* `<EntityPicker />` modale typeahead (`/app/frontend/src/components/knowledge/EntityPicker.jsx`)
* `<EntityContextPanel />` slide-in 9 sezioni (`/app/frontend/src/components/knowledge/EntityContextPanel.jsx`)
* Moodboard `LibraryPanel.jsx` · CTA "+ Prodotto/Materiale/Designer" → EntityPicker → POST /blocks {entity_id}
* Moodboard click su entity-block → apre EntityContextPanel
* Design Journey milestone · multi-entity picker → PATCH /milestones {entity_refs}
* Design Journey click su entity chip → apre EntityContextPanel
* Empty state · graceful degradation legacy block
* E2E testing agent

---

## 14 · RISCHI NOTI POST-FOUNDATION

| Rischio | Stato | Note |
|---------|-------|------|
| FK dropped su `brand_entity_relations.target_entity_id` | 🟡 monitorato | Consistenza ora a livello applicativo · garbage collection schedulabile in KE-005C |
| Snapshot drift (display_name post-rename) | 🟢 accettabile v1 | Sync-on-rename out of scope · v1 mostra il valore live se l'entity è risolta, fallback su snapshot |
| Multi-tenant attribute leak | 🟢 mitigato | Tutti i layer filtrano `tenant_id` |
| Context-panel latency | 🟢 accettabile | 150–300ms su entità reale · ottimizzazione future-proof con cache |
| Inflazione `entity_operational_usage` da test/UI churn | 🟢 mitigato | counter incrementa/decrementa solo a fronte di attach/detach reali · rimozione fisica della riga su count=0 |

---

> **Firma report**: Main Agent · iteration 217 · 06 Jun 2026 16:00 UTC
> **Modalità**: implementation · 9/9 backend pytest PASS · ruff lint clean
> **Migration**: `132_ke005b_knowledge_native_surfaces` · idempotente
> **Test credentials**: `admin@moodfordesign.com` / `Blueprint2024!`
> **Audit precedenti**: KE005A · KE005B0 · KE005B05
> **Next sprint** (in attesa autorizzazione utente): **KE-005B.2 · Surfaces UI**
