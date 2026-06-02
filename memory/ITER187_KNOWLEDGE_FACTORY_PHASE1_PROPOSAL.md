# MOOD BRAND KNOWLEDGE FACTORY™ · ARCHITECTURE PROPOSAL

**Sprint:** Product Composer™ + Knowledge Extraction V2 · Phase 1 Foundation
**Status:** 📋 PROPOSAL · awaiting Founder approval
**Data:** 2026-06-02
**Vincolo:** NO coding yet. Solo proposta. Phase 1 only dopo approvazione.

---

## 1 · CURRENT ARCHITECTURE CHECK

### Esistente (riusabile)
- ✅ **PDF ingestion** PyMuPDF (`cultural_engine/catalog_extractor.py`)
- ✅ **Multi-image per pagina** (≥300×300, max 6/page, area sort)
- ✅ **Asset Classifier 2-layer** (rule-based Layer 1 + Vision LLM Layer 2 gpt-5.1)
- ✅ **Visual Grouping System™** (compute_visual_group_key)
- ✅ **Brand Registry™** (`brands` table + 15 brand seed inclusa Cattelan Italia)
- ✅ **Material Registry™** (`material_registry` + `material_assets` M2M)
- ✅ **Storage buckets** `catalog-sources` (PDF, private) + `cms-assets` (img, public)
- ✅ **Supplier Catalogs flow** (upload-pdf → finalize → media_library is_inspiration=true)
- ✅ **PDF assets disponibili in pod**: `721.pdf` (49.8 MB), `729.pdf` (22 MB), `Bonaldo_26-Collection-MEDIUM.pdf` (13.9 MB)

### Gap principali per Knowledge Factory
- ❌ Nessuna tabella `products` canonical (oggi vivono come `media_library is_inspiration=true`)
- ❌ Nessun grouping multi-pagina (oggi page-by-page, no spread/section detection)
- ❌ Nessun text section parsing (description IT/EN, dimensions, finishes da PDF text)
- ❌ Nessun image dedup perceptual (solo xref dedup intra-pagina)
- ❌ Nessun admin review workflow (status `imported`, no `draft → approved`)
- ❌ Nessun product_assets table (M2M con role)

---

## 2 · PROPOSED DB CHANGES (Phase 1)

Nuova migration `116_brand_knowledge_factory_phase1.sql`:

```sql
-- ── 1. source_documents (audit-grade tracking) ──
CREATE TABLE source_documents (
  id                  UUID PK,
  tenant_id           UUID FK tenants ON DELETE CASCADE,
  brand_id            UUID FK brands ON DELETE SET NULL,
  supplier_catalog_id UUID FK supplier_catalogs ON DELETE SET NULL,
  file_id             UUID FK media_library,   -- the PDF row
  original_filename   TEXT,
  document_type       TEXT,   -- 'catalog' | 'spec_sheet' | 'brand_brochure' | 'lookbook'
  page_count          INTEGER,
  extraction_status   TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'extracting' | 'sections_detected' | 'review' | 'approved' | 'failed'
  extraction_started_at TIMESTAMPTZ,
  extraction_completed_at TIMESTAMPTZ,
  processing_logs     JSONB DEFAULT '[]',   -- ordered step log
  error_logs          JSONB DEFAULT '[]',
  metadata_json       JSONB DEFAULT '{}',
  created_by          UUID,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. products canonical (PIM minimo) ──
CREATE TABLE products (
  id                   UUID PK,
  tenant_id            UUID FK tenants ON DELETE CASCADE,  -- NULL = curated_public
  brand_id             UUID FK brands ON DELETE SET NULL,
  source_document_id   UUID FK source_documents ON DELETE SET NULL,
  product_name         TEXT NOT NULL,
  slug                 TEXT NOT NULL,
  category_id          UUID,   -- FK tag_registry where type='category' (Phase 2)
  category_label       TEXT,   -- denormalized fallback for Phase 1
  designer_name        TEXT,
  description          TEXT,
  description_i18n     JSONB DEFAULT '{}',   -- {"it":"...","en":"...","fr":"..."}
  materials            JSONB DEFAULT '[]',   -- ["ceramic","steel","wood"] (string array Phase 1)
  finishes             JSONB DEFAULT '[]',   -- ["Taj Mahal","Darwin"]
  dimensions_raw       JSONB DEFAULT '[]',   -- ["400 cm","600 cm"] (free text Phase 1)
  dimensions_structured JSONB DEFAULT '{}',  -- {"length_cm":400,"width_cm":120} Phase 2
  applications         JSONB DEFAULT '[]',   -- ["residential","hospitality"]
  source_pages         JSONB DEFAULT '[]',   -- [13,14,15,16]
  confidence_score     NUMERIC(4,3),         -- 0.000-1.000
  review_status        TEXT NOT NULL DEFAULT 'draft',
    -- 'draft' | 'review' | 'approved' | 'rejected' | 'merged'
  merged_into_id       UUID FK products,
  reviewed_by          UUID,
  reviewed_at          TIMESTAMPTZ,
  metadata_json        JSONB DEFAULT '{}',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, brand_id, slug)
);

-- ── 3. product_assets (M2M Product ↔ media_library, role) ──
CREATE TABLE product_assets (
  id                  UUID PK,
  product_id          UUID FK products ON DELETE CASCADE,
  asset_id            UUID FK media_library ON DELETE CASCADE,
  role                TEXT NOT NULL,
    -- 'hero' | 'ambient' | 'still_life' | 'detail' | 'texture' | 'technical' | 'finish' | 'drawing' | 'packshot' | 'logo' | 'decorative'
  page_number         INTEGER,
  source_document_id  UUID FK source_documents,
  confidence_score    NUMERIC(4,3),
  is_primary          BOOLEAN DEFAULT FALSE,
  sort_order          INTEGER DEFAULT 0,
  similarity_group    TEXT,    -- perceptual hash group key
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (product_id, asset_id, role)
);

-- ── 4. product_sections (detected sections before product finalization) ──
CREATE TABLE product_sections (
  id                  UUID PK,
  source_document_id  UUID FK source_documents ON DELETE CASCADE,
  tenant_id           UUID FK tenants ON DELETE CASCADE,
  section_index       INTEGER,
  start_page          INTEGER,
  end_page            INTEGER,
  detected_title      TEXT,
  detected_designer   TEXT,
  detected_category   TEXT,
  raw_text            TEXT,         -- aggregated page text in section
  product_id          UUID FK products ON DELETE SET NULL,   -- linked when product created
  confidence_score    NUMERIC(4,3),
  metadata_json       JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ... su tutti i FK e tenant_id.
```

**NO** modifiche a `media_library` (resta storage). **NO** drop di tabelle esistenti. Backfill `media_library is_inspiration=true product` → `products` rinviato a Phase 2.

---

## 3 · PROPOSED BACKEND PIPELINE

### Pipeline 6-step (orchestrator: `cultural_engine/product_composer.py` NEW)

```
PDF upload
  ↓ [Step 1] Document registration
    → INSERT source_documents (status='pending')
  ↓ [Step 2] Section Detection (NEW · cultural_engine/section_detector.py)
    Heuristics:
      - typography size (page text font analysis via PyMuPDF dict)
      - product title pattern (UPPERCASE 2-5 words isolated)
      - designer line ("design X" within 3 lines below title)
      - index reference cross-check (page 1-5 TOC extraction)
      - layout continuity (dimensions diagram OR description block continues)
    Output: product_sections rows (start_page, end_page, detected_title)
  ↓ [Step 3] Image Extraction + Classification (REUSE catalog_extractor + asset_classifier)
    Aggiunge: image_phash (perceptual hash via imagehash lib) per dedup
  ↓ [Step 4] Image-to-Section Assignment
    Per ogni candidato image, assegna alla section che contiene la sua page_number.
    Dedup: se phash distance < 8 e stessa section → merge in similarity_group.
  ↓ [Step 5] Text Field Extraction (NEW · cultural_engine/section_text_parser.py)
    Per ogni section.raw_text:
      - regex dimensions: \b(\d{2,4})\s*[x×]\s*(\d{2,4})\b cm/mm
      - regex finishes: linee dopo "FINITURE" o "FINISHES" header
      - regex materials: vocabolario IT/EN (ceramica/ceramic, acciaio/steel, legno/wood, vetro/glass, marmo/marble…)
      - description IT/EN: paragraph extraction by language detection (heuristic charset/stop-words)
  ↓ [Step 6] Product Composition (NEW · cultural_engine/product_composer.py)
    Per ogni section:
      INSERT products (status='draft', confidence calculated as weighted avg of:
        title detection conf, image count, dimensions count, materials count)
      INSERT product_assets per ogni image assegnata (role da asset_classifier)
    UPDATE source_documents.extraction_status='review'
```

### Nuovi endpoint API

```
POST  /api/inspirations/documents/{doc_id}/process
        → start full pipeline (background task)
GET   /api/inspirations/documents/{doc_id}
        → status + logs + product_sections + products draft
GET   /api/inspirations/products?status=draft&brand_id=...&source_document_id=...
        → list products for review grid
GET   /api/inspirations/products/{product_id}
        → product detail + assets grouped by role
PATCH /api/inspirations/products/{product_id}
        → edit name/category/materials/finishes/dimensions/description
POST  /api/inspirations/products/{product_id}/approve
        → review_status='approved' (becomes Knowledge Object)
POST  /api/inspirations/products/{product_id}/reject
        → review_status='rejected' + reason
POST  /api/inspirations/products/{product_id}/merge
        → merge into another product (review_status='merged', merged_into_id set)
PATCH /api/inspirations/products/{product_id}/assets/{asset_id}
        → reassign role / mark primary / change sort_order
DELETE /api/inspirations/products/{product_id}/assets/{asset_id}
        → unlink asset from product
```

### Dipendenze nuove (richiedono `pip install`)
- `imagehash==4.3.1` (perceptual hashing per image dedup)
- Eventualmente `langdetect==1.0.9` per language detection IT/EN

NO LLM nuovi in Phase 1 — usiamo solo regex + Vision Layer 2 esistente.

---

## 4 · PROPOSED FRONTEND / ADMIN REVIEW FLOW

### Nuova route: `/inspirations/knowledge-factory`

**Pages:**

1. **DocumentsPipelinePage** (`/inspirations/knowledge-factory`)
   - Lista source_documents con status pill (pending/extracting/review/approved/failed)
   - CTA "Carica nuovo catalogo" → upload PDF (riusa existing upload flow)
   - Filtro per brand_id, status, date

2. **DocumentReviewPage** (`/inspirations/knowledge-factory/:docId`)
   - Header: PDF name + brand + page count + status + extraction logs accordion
   - Tab "Sections" — lista product_sections detected con preview thumbnail
   - Tab "Products Draft" — grid di products (status=draft) con:
     - thumbnail hero
     - name (inline editable)
     - confidence score badge (color: green ≥0.85, yellow 0.6-0.85, red <0.6)
     - source pages chip
     - actions: [Review] [Approve] [Reject] [Merge]

3. **ProductReviewDrawer** (modal slide-in)
   - 3 columns:
     - LEFT: form (name, category, designer, description IT/EN, materials chips, finishes chips, dimensions chips)
     - CENTER: grouped asset gallery (Hero · Ambient · Still life · Detail · Technical · Finish) con drag-drop role reassignment
     - RIGHT: section raw_text preview + source pages PDF thumbnails
   - Bottom CTAs: [Save Draft] [Approve] [Reject] [Merge into…]

**Componenti chiave:**
- `ProductDraftCard.jsx`
- `ProductReviewDrawer.jsx`
- `AssetRoleSelector.jsx` (chip with dropdown)
- `DocumentLogsAccordion.jsx`

NO modifiche a InspirationsPage/MaterialsPage/BrandModePage in Phase 1.

---

## 5 · RISKS AND LIMITS

| # | Risk | Mitigation |
|---|---|---|
| R1 | **PDF scansionati senza testo nativo** (raster only) | Phase 1: section detection fallirà gracefully → singolo section per page. Phase 2: OCR tesseract |
| R2 | **Section detection fragile su layout non-standard** (es. spread con 2 prodotti per pagina) | Confidence scoring + admin manual reassignment via drawer |
| R3 | **Image perceptual hash falsi positivi** (cutout vs lifestyle stesso prodotto raggruppati per errore) | Dedup solo entro stessa section + soglia conservativa (hamming<8 su pHash 64-bit) |
| R4 | **Dimensions/Materials regex fragile** su naming creativo | Confidence basso → review manuale obbligatoria |
| R5 | **Pipeline lenta su PDF 50MB+** (es. 721.pdf 49.8MB) | Background task con timeout 15min · processing_logs streaming |
| R6 | **No language detection multilingua** (catalogo IT+EN+DE in stessa pagina) | Phase 1: salva tutto in `description_i18n.it` come fallback. Phase 2: LLM language detection. |
| R7 | **Duplicati cross-document** (stesso prodotto in 2 cataloghi diversi) | Phase 1: no cross-doc dedup. Phase 2: visual_group_key cross-catalog + admin merge UI. |
| R8 | **Storage cost** (asset duplicati intra-section dopo merge) | Asset rows restano in media_library + product_assets registra solo collegamento. Soft delete su merge. |
| R9 | **Tenant scope su curated_public brands** (Cattelan è curated_public con tenant_id=NULL) | Products possono essere tenant-scoped o curated_public. Default Phase 1: tenant-scoped sempre (private catalog del tenant). Curated_public solo via admin promotion. |

---

## 6 · IMPLEMENTATION PLAN · PHASE 1 (ordered steps)

**Effort stimato Phase 1: ~10-12 giornate engineering**

### Step 1 · DB Migration (0.5g)
- [ ] Crea `/app/supabase/migrations/116_brand_knowledge_factory_phase1.sql`
- [ ] Tabelle: `source_documents`, `products`, `product_assets`, `product_sections`
- [ ] Indici + GRANT su service_role
- [ ] Idempotent (CREATE IF NOT EXISTS)
- [ ] Script `apply_migration_116.py` con rollback safeguards

### Step 2 · Pipeline orchestrator (2g)
- [ ] `cultural_engine/product_composer.py` (orchestrator 6-step)
- [ ] `cultural_engine/section_detector.py` (typography + title pattern + designer line + TOC)
- [ ] `cultural_engine/section_text_parser.py` (dimensions/finishes/materials regex)
- [ ] `cultural_engine/image_dedup.py` (perceptual hashing via imagehash)
- [ ] Background task wrapping (FastAPI BackgroundTasks)
- [ ] Processing logs streaming (append a `source_documents.processing_logs`)

### Step 3 · API endpoints (1.5g)
- [ ] Nuovo router `/app/backend/routers/knowledge_factory.py`
- [ ] 8 endpoint: process, get_doc, list_products, get_product, patch_product, approve, reject, merge + asset endpoints
- [ ] RBAC: tenant_admin or designer role
- [ ] Mount in `server.py` sotto `/api/inspirations`

### Step 4 · Backend tests (1.5g)
- [ ] `/app/backend/tests/test_iter187_knowledge_factory.py`
- [ ] 1) Process Bonaldo PDF (esistente in pod come fallback) — assert ≥5 products + ≥30 assets
- [ ] 2) Section detection accuracy — % sections con title detected
- [ ] 3) Image dedup — assert similarity_group popolato
- [ ] 4) Approve workflow — assert review_status transition
- [ ] 5) Merge workflow — assert merged_into_id

### Step 5 · Frontend pages (3g)
- [ ] `pages/inspirations/KnowledgeFactoryPage.jsx` (lista documents)
- [ ] `pages/inspirations/DocumentReviewPage.jsx` (tabs sections/products)
- [ ] `components/knowledge/ProductDraftCard.jsx`
- [ ] `components/knowledge/ProductReviewDrawer.jsx` (3-col layout)
- [ ] `components/knowledge/AssetRoleSelector.jsx`
- [ ] Route: `/inspirations/knowledge-factory[/:docId]`
- [ ] Sidebar link sotto "Inspirations"

### Step 6 · E2E test su PDF reale (1g)
- [ ] Procurarsi PDF Cattelan reale (verifica se `721.pdf` / `729.pdf` sono Cattelan)
- [ ] Run pipeline + report metrics:
  - products detected · assets assigned · dedup grouped · descriptions extracted · dimensions extracted · avg confidence · sections requiring review · failed sections
- [ ] Aggiornare `/app/memory/ITER187_KNOWLEDGE_FACTORY_PHASE1_REPORT.md`

### Step 7 · testing_agent_v3_fork validation (0.5g)
- [ ] Backend + Frontend test suite
- [ ] Fix issues reported
- [ ] Final regression (test_iter185 + test_iter181a + test_iter187)

### Step 8 · Documentation + finish (0.5g)
- [ ] `/app/memory/ITER187_KNOWLEDGE_FACTORY_PHASE1_REPORT.md`
- [ ] Update PRD with Phase 1 delivery + Phase 2-5 backlog (vector RAG, Academy, Magazine composer, etc.)

---

## 7 · SUCCESS METRICS (Phase 1 baseline su Cattelan PDF)

Da misurare dopo run pipeline:

| Metric | Target Phase 1 | Note |
|---|---|---|
| Products detected | ≥ 80% del numero atteso dal TOC | TOC parsing fallback |
| Products created (rows) | = products detected | 1:1 |
| Images extracted (total) | ≥ 200 (catalogo medio 100-150 pagine) | esistente |
| Images assigned to products | ≥ 90% | section assignment via page_number |
| Duplicates grouped (similarity_group) | ≥ 10% riduzione vs total | conservative dedup |
| Descriptions extracted | ≥ 50% products | con confidence ≥ 0.5 |
| Dimensions extracted | ≥ 60% products | regex match |
| Materials extracted | ≥ 50% products | vocabolario match |
| Finishes extracted | ≥ 40% products | "FINITURE" header detection |
| Avg confidence score | ≥ 0.55 | aim 0.65 |
| Products requiring human review | 100% (Phase 1 vincolo) | tutti `draft` |
| Failed product sections | < 5% | logged in processing_logs |

---

## 8 · FOUNDER GO/NO-GO DECISION POINTS

Prima di procedere con coding, conferma:

1. **Approvi questa architettura** Phase 1 (tabelle nuove `products`/`product_assets`/`product_sections`/`source_documents` SENZA touchare `media_library`)?
2. **Approvi la timeline ~10-12 giorni** per Phase 1 completa?
3. **Approvi le nuove dipendenze** `imagehash` + `langdetect`?
4. **Approvi il PDF Cattelan baseline**: usiamo `721.pdf` / `729.pdf` dagli asset disponibili come test (verifico che siano Cattelan), oppure devi caricare un nuovo PDF Cattelan?
5. **Tenant scope products**: tutti tenant-scoped Phase 1 (private), curated_public via admin promotion Phase 2 — confermi?

---

**Vincolo Founder rispettato (in questa proposal):**
✅ Zero coding
✅ Zero migration
✅ Zero refactor
✅ Solo proposta + risk assessment + plan
