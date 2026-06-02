# ITER192 · FOUNDING BRANDS PROGRAM™ · ARCHITECTURE PROPOSAL

**Sprint:** Multi-Brand Knowledge Graph Foundation · Phase 1
**Status:** 📋 PROPOSAL · awaiting Founder approval
**Data:** 2026-06-02

---

## 1 · ARCHITECTURE CHANGES

### Esistente (riusabile)
- ✅ `Product Composer™` pipeline (88.1/100 readiness su Cattelan)
- ✅ Tabelle Phase 1 (ITER187): `source_documents`, `products`, `product_assets`, `product_sections`
- ✅ Vision Layer 2 always-on (ITER189) con `enrich_asset_bytes`
- ✅ Section detector + text parser + image dedup
- ✅ 11 endpoint REST `/api/inspirations/knowledge-factory/...`

### Nuove entità da introdurre
- 🆕 **`brand_import_sessions`** — 1 brand + N PDFs + 1 processing job + 1 knowledge package
- 🆕 **4 tabelle canonical** (entity resolution targets): `materials_canonical`, `designers_canonical`, `collections_canonical`, `stories_canonical`
- 🆕 **`vision_cache`** — pHash → vision result (perf: 418s → ~33s su retry)
- 🆕 **Cross-link** su `products` → riferimenti canonical IDs

### Cosa NON tocchiamo
- ❌ `media_library` (resta storage layer)
- ❌ `brands` registry (sorgente di brand_id)
- ❌ Esistenti tabelle ITER187 (solo aggiunte colonne)
- ❌ Frontend UI (deferred Phase 2)

---

## 2 · DB CHANGES (Migration 117)

```sql
-- ── 1. brand_import_sessions ──
CREATE TABLE brand_import_sessions (
  id                   UUID PK,
  tenant_id            UUID FK tenants ON DELETE CASCADE,
  brand_id             UUID FK brands ON DELETE SET NULL,
  session_name         TEXT,
  status               TEXT,  -- 'open' | 'processing' | 'completed' | 'failed' | 'archived'
  document_count       INTEGER DEFAULT 0,
  documents_processed  INTEGER DEFAULT 0,
  documents_failed     INTEGER DEFAULT 0,
  metrics              JSONB,  -- { products, materials, designers, collections, stories, assets }
  package_score        JSONB,  -- { product_completeness, material_completeness, story_completeness,
                                --   academy_readiness, magazine_readiness, marketboard_readiness,
                                --   moodboard_readiness, specification_readiness, overall }
  knowledge_package    JSONB,  -- denormalized assembled package for fast dashboard
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  processing_logs      JSONB DEFAULT '[]',
  error_logs           JSONB DEFAULT '[]',
  created_by, created_at, updated_at
);

-- ── 2. source_documents linkage ──
ALTER TABLE source_documents
  ADD COLUMN brand_import_session_id UUID FK brand_import_sessions ON DELETE SET NULL;

-- ── 3. materials_canonical ──
CREATE TABLE materials_canonical (
  id                    UUID PK,
  tenant_id             UUID,                -- NULL = global library
  brand_id              UUID FK brands,      -- NULL = generic material (oak, walnut)
  material_key          TEXT NOT NULL,       -- normalized: 'kauri', 'cedro', 'oak'
  display_name          TEXT,
  origin                TEXT,                -- "New Zealand swamps"
  geography             JSONB,               -- structured geographic data
  sustainability_story  TEXT,
  processing_story      TEXT,
  applications          JSONB,               -- ["luxury_residential", "hospitality"]
  emotional_keywords    JSONB,               -- ["timeless", "ancestral"]
  academy_topics        JSONB,               -- ["The wood of time", "Reclaimed material design"]
  market_positioning    TEXT,
  description_i18n      JSONB,
  mention_count         INTEGER DEFAULT 0,
  source_document_ids   JSONB DEFAULT '[]',  -- which docs mentioned it
  evidence              JSONB DEFAULT '[]',  -- [{doc_id, page, snippet}]
  confidence_score      NUMERIC(4,3),
  metadata_json         JSONB,
  UNIQUE (tenant_id, brand_id, material_key)
);

-- ── 4. designers_canonical ──
CREATE TABLE designers_canonical (
  id                    UUID PK,
  tenant_id             UUID,                -- NULL = global designer library
  brand_id              UUID FK brands,      -- NULL = cross-brand designer
  designer_key          TEXT NOT NULL,       -- normalized: 'patricia-urquiola'
  display_name          TEXT,
  bio                   TEXT,
  bio_i18n              JSONB,
  studio                TEXT,
  nationality           TEXT,
  mention_count         INTEGER DEFAULT 0,
  product_count         INTEGER DEFAULT 0,
  collection_count      INTEGER DEFAULT 0,
  source_document_ids   JSONB DEFAULT '[]',
  metadata_json         JSONB,
  UNIQUE (tenant_id, designer_key)
);

-- ── 5. collections_canonical ──
CREATE TABLE collections_canonical (
  id                    UUID PK,
  tenant_id             UUID,
  brand_id              UUID FK brands ON DELETE CASCADE,
  collection_key        TEXT NOT NULL,
  display_name          TEXT,
  year                  INTEGER,
  description           TEXT,
  product_count         INTEGER DEFAULT 0,
  source_document_ids   JSONB DEFAULT '[]',
  metadata_json         JSONB,
  UNIQUE (tenant_id, brand_id, collection_key)
);

-- ── 6. stories_canonical ──
CREATE TABLE stories_canonical (
  id                    UUID PK,
  tenant_id             UUID,
  brand_id              UUID FK brands ON DELETE CASCADE,
  theme                 TEXT NOT NULL,
    -- 'sustainability' | 'heritage' | 'craftsmanship' | 'innovation'
    -- | 'material_culture' | 'family_business' | 'design_collaboration'
  title                 TEXT,
  body_i18n             JSONB,
  evidence              JSONB DEFAULT '[]',  -- [{doc_id, page, snippet, keyword_density}]
  source_document_ids   JSONB DEFAULT '[]',
  confidence_score      NUMERIC(4,3),
  metadata_json         JSONB,
  UNIQUE (tenant_id, brand_id, theme, title)
);

-- ── 7. vision_cache ──
CREATE TABLE vision_cache (
  phash                 TEXT PRIMARY KEY,    -- 16-char hex pHash
  model                 TEXT NOT NULL,       -- 'gpt-5.1', etc.
  result_json           JSONB NOT NULL,
  hit_count             INTEGER DEFAULT 0,
  created_at, last_hit_at
);

-- ── 8. products cross-references ──
ALTER TABLE products
  ADD COLUMN brand_import_session_id UUID,
  ADD COLUMN canonical_material_ids JSONB DEFAULT '[]',
  ADD COLUMN canonical_designer_id UUID,
  ADD COLUMN canonical_collection_id UUID;

CREATE INDEX … (tenant_id, brand_id) su tutte le canonical tables
```

**NO** distruzioni. Tutto idempotent.

---

## 3 · BRAND IMPORT SESSION DESIGN

### Lifecycle
```
[1] Founder crea sessione (POST /sessions)
    brand_id + session_name → status='open'
    ↓
[2] Founder carica N PDF (POST /sessions/{id}/documents · multipart batch)
    document_count incrementa per ogni PDF
    ↓
[3] Founder lancia processing (POST /sessions/{id}/process)
    status='processing' · pipeline parallela per ogni source_document
    ↓
[4] Per ogni PDF: Product Composer™ produce products draft
    documents_processed incrementa progressivamente
    ↓
[5] Quando documents_processed == document_count:
    Entity Resolution Pass (canonical merge)
    Story Extraction Pass (theme aggregation)
    Knowledge Package Assembly
    Package Score Calculation
    ↓
[6] status='completed' · GET /sessions/{id} mostra package_score + knowledge_package
```

### API endpoints (8 nuovi)
```
POST   /api/inspirations/knowledge-factory/sessions
GET    /api/inspirations/knowledge-factory/sessions
GET    /api/inspirations/knowledge-factory/sessions/{id}
POST   /api/inspirations/knowledge-factory/sessions/{id}/documents   (multipart, multi-file)
POST   /api/inspirations/knowledge-factory/sessions/{id}/process     (background queue all docs)
GET    /api/inspirations/knowledge-factory/sessions/{id}/dashboard   (founding brands view)
GET    /api/inspirations/knowledge-factory/sessions/{id}/knowledge-graph
DELETE /api/inspirations/knowledge-factory/sessions/{id}             (archive)
```

---

## 4 · ENTITY RESOLUTION STRATEGY

### Algoritmo Phase 1 (text-based, deterministic, NO LLM)

**Materials**
1. Normalize: lowercase, strip diacritics, replace `_`/`-` with space
2. Lookup `materials_canonical` per `(tenant_id, brand_id, material_key)`
3. Se exists → incrementa `mention_count`, append `source_document_id`, append `evidence`
4. Se NOT exists → INSERT con seed da product/section dati
5. Seeded fields: `display_name`, `origin` (da description), `applications`

**Designers**
1. Normalize: title-case slug → `patricia-urquiola`, `paolo-cattelan`
2. Lookup `designers_canonical` per `(tenant_id, designer_key)` (cross-brand!)
3. Fuzzy match (Levenshtein ≤ 2) per gestire varianti ("Manzoni Tapinassi" / "Manzoni & Tapinassi")
4. INSERT/UPDATE come materials

**Collections**
1. Detect collection name da `source_documents.metadata_json` (carry-over da supplier_catalogs) o titolo del documento
2. Default: usa `source_documents.original_filename` come collection seed (es. "Bonaldo_26 Collection")
3. INSERT in `collections_canonical`

**Products**
1. Lookup `(tenant_id, brand_id, slug)` — già UNIQUE in ITER187
2. Se prodotto già esistente → merge invece di duplicare (review_status='merged')

**Vision Cache hit during processing**
1. Compute pHash su image bytes
2. Lookup `vision_cache.phash`
3. Se hit → riusa `result_json`, incrementa `hit_count`, last_hit_at = now
4. Se miss → call Vision LLM → INSERT row

---

## 5 · KNOWLEDGE GRAPH STRUCTURE

### Logical model (NO graph DB richiesto, JSONB su PG basta in Phase 1)

```
brand_import_sessions (root)
  ├── source_documents (1:N)         FK brand_import_session_id
  │     └── products (1:N)            FK source_document_id, brand_import_session_id
  │           ├── product_assets (1:N)
  │           ├── canonical_material_ids (jsonb refs)
  │           ├── canonical_designer_id (FK)
  │           └── canonical_collection_id (FK)
  │
  ├── materials_canonical (M:N via products.canonical_material_ids)
  ├── designers_canonical (M:N via products.canonical_designer_id)
  ├── collections_canonical (M:N via products.canonical_collection_id)
  └── stories_canonical (1:N FK brand_id)
```

### Knowledge Graph endpoint
`GET /sessions/{id}/knowledge-graph` ritorna:
```json
{
  "brand": {...},
  "sessions": {"id": ..., "metrics": {...}},
  "tree": {
    "materials": [{...mention_count, evidence}],
    "designers": [{...products: [...]}],
    "collections": [{...products: [...]}],
    "products": [{...}],
    "stories": [{...theme, evidence}]
  },
  "counts": {"materials": 12, "designers": 18, "products": 47, "stories": 7}
}
```

---

## 6 · PERFORMANCE STRATEGY

### Vision Cache™ (PRIORITÀ #1 — abilita scalabilità)
- pHash 64-bit → cache key (16 char hex)
- Hit rate atteso: 20-40% intra-brand (variant shots), 5-15% cross-brand
- Costo Vision: ~$0.0025/asset GPT-4o-vision
- ROI: 150 asset Cattelan × $0.0025 = $0.38 · 50 brand × 200 asset avg = $25 senza cache. Con cache + cross-brand sharing: ~$15

### Parallel PDF processing
- FastAPI BackgroundTasks (esistente) per ora
- Phase 2: Celery/RQ se serve >1 PDF/sec
- Per-session concurrency limit: 3 PDF in parallelo (evita rate limit OpenAI)

### Dashboard read-path
- `brand_import_sessions.knowledge_package` JSONB pre-assembled = single-query dashboard
- Aggiornato on session completion (denormalizzato per performance)

---

## 7 · SCALING STRATEGY (50+ brands, 500+ PDF, 100k+ products)

| Concern | Phase 1 solution | Phase 2 evolution |
|---|---|---|
| Storage | Supabase storage `{tenant}/knowledge-factory/sessions/{session_id}/{doc_id}/` | S3 multi-region + CloudFront |
| Vision cost | Vision Cache™ + concurrency limit | Self-hosted CLIP for cheap re-classification |
| Processing throughput | BackgroundTasks (~3 docs/min/session) | Celery + Redis queue (~30 docs/min) |
| Entity resolution | Deterministic text + Levenshtein | Embedding similarity (pgvector) for semantic merge |
| Cross-brand designer dedup | tenant-scoped + cross-brand canonical | Embedding-based dedup |
| Dashboard query speed | denormalized JSONB knowledge_package | Materialized views + read replicas |
| Storage costs (assets) | full quality | tiered: WebP thumbs + signed-URL originals |

---

## 8 · IMPLEMENTATION PLAN · PHASE 1 (this iteration)

**Effort stimato: 1 sessione (4-6h)**

### Step A · Migration 117 (30 min)
- [ ] `/app/supabase/migrations/117_iter192_brand_import_sessions.sql`
- [ ] `/app/scripts/apply_migration_117.py` (idempotent applier)

### Step B · Vision Cache integration (45 min)
- [ ] Modulo `cultural_engine/vision_cache.py` (lookup/store helpers)
- [ ] Patch `product_composer._run_vision_batch` per check cache prima di chiamare LLM

### Step C · Entity resolution module (1h)
- [ ] `cultural_engine/entity_resolver.py`
- [ ] Funzioni: `resolve_materials`, `resolve_designers`, `resolve_collections`, `extract_stories`
- [ ] Story theme detection: keyword density su raw_text con vocabolari multilingua

### Step D · Brand Import Session router (1.5h)
- [ ] `/app/backend/routers/brand_import_sessions.py`
- [ ] 8 endpoint sopra elencati
- [ ] Multi-PDF upload (up to 50 files/request)
- [ ] Background processing: per ogni doc lancia il pipeline; al completamento lancia resolution

### Step E · Knowledge Package Score (45 min)
- [ ] Modulo `cultural_engine/package_scorer.py`
- [ ] 8 capability score (product/material/story completeness + 5 readiness scores)
- [ ] Overall score weighted avg

### Step F · Backend tests + ITER187 regression (45 min)
- [ ] `/app/backend/tests/test_iter192_brand_import_sessions.py`
- [ ] 1 test session lifecycle E2E con 2 PDF sintetici
- [ ] 1 test entity resolution (stessa materia in 2 PDF → 1 canonical row)
- [ ] 1 test vision cache hit
- [ ] Verifica regressione ITER187 (16/16)

### Step G · Documentation + PRD (30 min)
- [ ] `/app/memory/ITER192_FOUNDING_BRANDS_REPORT.md`
- [ ] Update PRD con architettura + endpoint + scaling roadmap

---

## 9 · DELIVERABILI Phase 1 (NO frontend)

- ✅ Migration 117 applicata
- ✅ Vision Cache funzionante (mostrato in test con 2 PDF identici)
- ✅ Brand Import Session endpoint set (8 endpoint)
- ✅ Entity Resolution lavora cross-document (test su 2 PDF sintetici con stessa materia)
- ✅ Knowledge Package Score calcolato su session completion
- ✅ Knowledge Graph endpoint ritorna struttura ad albero
- ✅ Regression: ITER187 tests 16/16 pass

---

## 10 · GO/NO-GO Decision Points

1. **Approvi le 7 nuove tabelle** (`brand_import_sessions`, 4 canonical, `vision_cache`, alter `products` + `source_documents`)?
2. **Approvi entity resolution deterministico Phase 1** (text + Levenshtein) — embedding similarity rinviato a Phase 2?
3. **Approvi Vision Cache come prima priorità performance** prima di processing parallel queue?
4. **Approvi gli 8 endpoint REST** sotto `/api/inspirations/knowledge-factory/sessions/...`?
5. **Approvi NO frontend in Phase 1** — solo backend foundation + API + test?
6. **PDF baseline test:** posso testare con Cattelan 729 + un secondo PDF sintetico (es. "Cattelan_Quotes_2026.pdf" che ripete 5 prodotti Cattelan per validare entity resolution intra-brand)?

---

**Vincolo Founder rispettato:**
✅ Zero Academy Builder · zero Magazine Builder · zero Marketboard Generator
✅ Zero frontend (deferred Phase 2)
✅ Solo foundation + scaling readiness
