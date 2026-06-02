# MOOD AI KNOWLEDGE ENGINE™ · AUDIT REPORT

**Sprint:** ITER · MOOD AI Knowledge Engine Audit
**Tipo:** Audit · Inventario tecnico · No coding · No migration · No refactor
**Status:** ✅ DELIVERED
**Data:** 2026-06-02
**Owner:** Engineering · Cultural Engine
**Vincolo Founder:** Solo audit. Determinare cosa esiste già vs cosa manca prima di sviluppare il MOOD AI Knowledge Engine™.

---

## 0 · Sommario esecutivo

MOOD **possiede già le fondamenta del 60-65%** del Knowledge Engine futuro. Il sistema esistente è una **PDF-to-Visual-Inspirations pipeline** sofisticata, **ma NON è ancora un Knowledge Engine semantico**.

### Risposta sintetica alla domanda Founder

> **"MOOD contiene già le fondamenta del MOOD AI Knowledge Engine™?"**

# 🟡 PARTIAL · 60-65%

**Esiste:**
- PDF ingestion robusta (PyMuPDF) con estrazione multi-immagine per pagina
- Brand Registry™ canonico (15 brand reali curated_public + Cattelan Italia incluso)
- Material Registry™ con asset M2M tipizzati (slab/finish/render/catalog/spec/detail)
- Asset Classifier deterministico Layer 1 (rule-based) + Vision LLM Layer 2 fallback (gpt-5.1)
- Visual Grouping System™ per raggruppare asset dello stesso prodotto
- Brand Atlas™ endpoint funzionante (`GET /api/inspirations/registry/brands-atlas`)
- Magazine Engine™ con article hotspots tipizzati
- Product Usage Events™ per Product Intelligence

**Manca completamente:**
- OCR (zero supporto · zero dipendenze tesseract/easyocr)
- Text chunking + vectorization (zero embeddings · zero pgvector)
- Brand Story / Heritage / Sustainability extraction (solo image-driven, no text comprehension)
- Materials Library NON popolata automaticamente dai PDF (è entity-level ma non ingest-fed)
- Country/City profiles strutturati con budget ranges (markets ha solo `market_intelligence` JSONB editoriale)
- Academy Builder (zero) e Podcast Drafts (zero)
- Knowledge Graph relazionale (Brand↔Product↔Material↔Concept↔Market) — relazioni parziali via media_library JSONB ma no edge table

**Effort stimato per arrivare a MOOD AI Knowledge Engine™ completo:** **8-12 settimane** ingegneristiche full-time (vedi §16).

---

## 1 · DOCUMENT INGESTION AUDIT

### 1.1 · Stack esistente

| Capability | Status | Implementazione |
|---|---|---|
| PDF upload | ✅ WORKING | `POST /api/inspirations/catalogs/{cid}/upload-pdf` |
| Image extraction | ✅ WORKING | `cultural_engine/catalog_extractor.py` · PyMuPDF (`fitz`) |
| Multi-image per page | ✅ WORKING | Max 6 images/pagina · sort by area (hero-first) |
| Image dedup intra-pagina | ✅ WORKING | xref-based |
| Page text extraction | ✅ WORKING | `page.get_text("text")` |
| Section header detection | ✅ WORKING | Regex heuristics (`Tavoli / Sedie / ...`) |
| Product name guess | ✅ WORKING | Heuristic da page text (15-line window, NAME_BLACKLIST, NAME_HINT_KEYWORDS) |
| Designer guess | ✅ WORKING | Regex `^(designer\|design\|by)\s+...` |
| Category guess | ✅ WORKING | Vocabolario IT/EN: tavoli/sedie/divani/lampade/cucine/outdoor… |
| Storage modello | ✅ WORKING | `media_library` come parent + uno `media_library` per ogni candidato selezionato |
| OCR | ❌ MISSING | Zero. Nessun tesseract, easyocr, pdfplumber OCR. Solo `page.get_text()` (testo nativo PDF) |
| Chunking system | ❌ MISSING | Zero text chunking · Zero `text_splitter` |
| Vectorization | ❌ MISSING | Zero embeddings · Zero pgvector · Zero qdrant/chroma |
| Metadata strutturato | 🟡 PARTIAL | Solo dimensioni/posizione/category_hint, NO product specs (dimensioni, peso, finiture estratte) |

### 1.2 · Limiti operativi attuali

- `MAX_PAGES = 220` · `MAX_CANDIDATES_DEFAULT = 240` · `MIN_IMG_WIDTH/HEIGHT = 300 px`
- Skip automatico: pagine "indice/contents/introduction"
- Skip pagina 0 (cover marketing)
- **PDF text-only PDF** (es. brochure puramente testuali, paper accademici): l'engine restituisce 0 candidati perché filtra per immagini >= 300×300 px
- **PDF scansionati immagine-only** (raster): senza OCR la pagina è "muta" → name/designer/category restano NULL → grouping fallisce

### 1.3 · Risposte secche alle domande Founder

| Domanda | Risposta |
|---|---|
| Can MOOD currently read PDF contents? | ✅ SÌ (testo nativo + immagini · NO scansioni OCR) |
| Can MOOD extract images from PDFs? | ✅ SÌ (con Layer 1 classifier `lifestyle/cutout/texture/detail/technical/rendering`) |
| Are PDFs stored only as files or transformed into structured content? | 🟡 PARZIALMENTE — file originale in `media_library` (bucket `catalog-sources`) + candidati estratti diventano rows `media_library is_inspiration=true inspiration_meta.inspiration_type='product'`. NO structured product schema. |
| Is chunking already implemented? | ❌ NO |
| Is vectorization already implemented? | ❌ NO |

---

## 2 · AI EXTRACTION AUDIT

### 2.1 · Cosa estrae oggi

| Asset/Concept | Status | Implementazione |
|---|---|---|
| **Brands** (Cattelan, Margraf, Riva 1920) | 🟡 PARTIAL | Brand è scelto dall'utente in fase upload (UI selector) o seedato. NON estratto dal PDF. Il `brand` viene SOLO propagato ai candidati. |
| **Product Names** | 🟡 PARTIAL | Heuristic da page text · success rate ~40-60% in catalogo Bonaldo (test). Fallisce su naming creativo. |
| **Collections** | 🟡 PARTIAL | Catalogo ha campo `collection` ma è utente-input, NON auto-detected. |
| **Designers** | 🟡 PARTIAL | Regex "design(ed by)? X" → buona per catalogi italiani standard. |
| **Materials** (Travertino, Walnut, Kauri) | 🟡 PARTIAL | Tag-level: `inspiration_meta.material_tags[]` può essere applicato (manuale o batch default), NON auto-estratto dal testo PDF. |
| **Categories** (Furniture/Lighting/Stone) | ✅ WORKING | Vocabolario 18 keywords IT/EN mappa a 10 macro-categorie. |
| **Applications** (Residential/Hospitality/Retail) | 🟡 PARTIAL | Brand-level (`hospitality_score/residential_score/contract_score`), NON product-level. NON estratto dai PDF. |
| **Brand Story / Heritage / Sustainability** | ❌ MISSING | Zero estrazione. Brand ha campi `positioning` e `story` (ALE-translatable) ma popolati a mano. |
| **Asset compositional role** | ✅ WORKING | Layer 1 rule-based: `lifestyle/still_life/cutout/texture/detail/technical/rendering/campaign/material_sample/variant` + `hero/focal/supporting/accent` |
| **View angle** | ✅ WORKING | `front/side/back/top/three_quarter/macro/context/flat` (deterministico + LLM fallback) |
| **Room type / mood tags / recommended_usage** | ✅ WORKING | Solo via Vision LLM Layer 2 fallback (gpt-5.1) quando Layer 1 confidence < 0.55 |

### 2.2 · AI providers stack

| Layer | Provider | Quando si attiva |
|---|---|---|
| Layer 1 — Rule-based classifier | Custom PIL+numpy (`cultural_engine/asset_classifier.py`) | SEMPRE (deterministic, CPU-fast) |
| Layer 2 — Vision LLM | OpenAI gpt-5.1 vision via Emergent LLM Key | Solo quando Layer 1 confidence < 0.55 (background_task fire-and-forget) |
| Cultural Engine — Layer 2 | Descriptor mapper PROPRIETARIO (NO LLM, NO embeddings) | Vision signals → cultural_descriptors → market_cultural_profiles |

### 2.3 · Verdetto AI Extraction

🟡 **PARTIAL — image-first, NO text comprehension**

Il sistema è raffinato sulla classificazione visiva delle immagini, ma **non comprende il TESTO del PDF a livello semantico**. Tutto ciò che richiede "leggere il brand story" è impossibile oggi.

---

## 3 · DATA MODEL AUDIT · ER Diagram (summary)

### 3.1 · Tabelle core esistenti

```
┌──────────────┐
│   tenants    │
└──────┬───────┘
       │
       ├─→ users_profile
       │
       ├─→ media_library ──────┬─→ media_collections ──┬─→ media_collection_items
       │   • bucket             │                       └──→ asset_id
       │   • storage_path       │
       │   • file_url           ├─→ media_links (entity_type, entity_id, role)
       │   • is_inspiration     │
       │   • inspiration_meta◀──┘   (JSONB con brand/collection/product_name/
       │     (JSONB)                 atmosphere_tags/material_tags/market_codes…)
       │   • source_kind = 'supplier_catalog'
       │   • mime_type / width / height / dominant_color
       │   • replaces_id / replaced_by_id (soft versioning)
       │
       ├─→ supplier_catalogs
       │   • brand / collection / category / catalog_year
       │   • source_file_id   FK soft → media_library.id
       │   • status: draft/extracting/review/imported/archived
       │   • extraction_payload (JSONB: candidates[])
       │   • default_atmosphere / default_material / default_markets
       │   • brand_id          FK → brands.id  (058)
       │   • collection_id     FK → brand_collections.id  (058)
       │
       ├─→ brands  (curated_public OR studio_private)
       │   • slug · positioning · luxury_tier
       │   • hospitality_score / residential_score / contract_score / retail_score
       │   • primary_markets[]
       │   • agreement_status / visibility_level
       │   └─→ brand_collections (year/season/category/description)
       │
       ├─→ tag_registry
       │   • type: brand|atmosphere|material|style|room_type|cultural
       │   • synonyms[]  (per dedup)
       │
       ├─→ material_registry
       │   • category/subcategory/supplier/supplier_sku/finish/thickness/origin
       │   • technical_notes / dominant_color
       │   └─→ material_assets (M2M media_library, role: slab/finish/render/catalog/spec/detail/application/swatch)
       │
       ├─→ product_usage_events (analytics)
       │   • usage_type: added_to_moodboard/added_to_project/used_in_cultural_edition/...
       │
       ├─→ magazine_articles  (locale_content + body_blocks JSONB)
       │   └─→ article_hotspots (reference_type, x_pct/y_pct, linked_material_id, linked_asset_id)
       │
       ├─→ markets (market_intelligence JSONB · keywords + insights multilocale)
       │
       └─→ cultural_descriptors + market_cultural_profiles  (proprietary, NO LLM)
```

### 3.2 · Tabelle MANCANTI per Knowledge Engine completo

| Tabella mancante | Scopo |
|---|---|
| `knowledge_chunks` (con `pgvector`) | Chunking + embeddings di documenti per RAG semantic search |
| `products` (canonical PIM) | Oggi esiste solo come row `media_library is_inspiration=true` — manca product specs strutturati (dimensions, materials_used[], finishes[], collection_id structured) |
| `product_materials` | M2M Product ↔ Material (oggi solo tag-level su `inspiration_meta.material_tags`) |
| `country_profiles` / `city_profiles` con `budget_ranges` | Markets ha solo JSONB editoriale, no struttura |
| `project_types` (residential/hospitality/retail/contract) tabella canonica | Oggi inferiti da `brand.hospitality_score` etc. |
| `concepts` (cultural descriptors → semantic concepts) | `cultural_descriptors` esiste ma è linked solo a markets, non a products |
| `academy_lessons` / `lesson_blocks` / `lesson_scripts` / `podcast_drafts` | Zero |
| `brand_stories` / `brand_heritage_chunks` | Zero |
| `document_text_chunks` | Zero |
| Edge table `knowledge_edges (from_id, from_type, to_id, to_type, relation)` | Zero — knowledge graph relazionale assente |

### 3.3 · Storage buckets

| Bucket | Contenuto | Pubblico |
|---|---|---|
| `catalog-sources` | PDF originali · private | NO |
| `cms-assets` | immagini estratte · public | SÌ |

---

## 4 · KNOWLEDGE GRAPH READINESS

**Assessment:** 🟡 **PARTIAL · 35%**

| Relazione canonica | Status | Implementazione |
|---|---|---|
| Brand ↔ Product | 🟡 PARTIAL | `media_library.inspiration_meta.brand_id` + `brand` (NAME). No FK formale a `products` perché products non esistono come entità. |
| Product ↔ Material | ❌ NOT READY | Solo tag-level `inspiration_meta.material_tags[]` · no FK formale. |
| Material ↔ Concept | 🟡 PARTIAL | `tag_registry.type='material'` + cultural_descriptors esistono ma non sono linked direttamente. |
| Concept ↔ Market | ✅ READY | `cultural_descriptors` × `market_cultural_profiles.descriptors{}` mapping deterministico funzionante. |
| Market ↔ Project Type | 🟡 PARTIAL | `markets.market_intelligence.insights` editoriale, no structured project_type ranking. |
| Project Type ↔ Brand | 🟡 PARTIAL | `brands.hospitality_score/residential_score/contract_score/retail_score` (0-100) — ottimo come ranking ma no esplicito M2M. |

**Verdetto:** Per supportare il knowledge graph **senza major refactoring** servono:
1. Una tabella canonica `products` (oggi solo `media_library is_inspiration=true product`)
2. Una `knowledge_edges` table per relazioni esplicite tipizzate
3. Embeddings + vector search per query semantica

---

## 5 · BRAND ATLAS READINESS

**Assessment:** 🟢 **READY (data) · 🟡 PARTIAL (story comprehension)**

### Esistente
- ✅ `GET /api/inspirations/registry/brands-atlas` — endpoint funzionante che aggrega:
  - `collections_count` per brand
  - `inspirations_count` + `products_count`
  - `dominant_atmospheres[]` (top-3 aggregato da `inspiration_meta.atmosphere_tags`)
  - `dominant_materials[]` (top-3 aggregato da `inspiration_meta.material_tags`)
  - `dominant_markets[]` (top-3 aggregato da `inspiration_meta.market_codes` o `brands.primary_markets`)
- ✅ ALE translation layer per `positioning/story/description/tagline` (multilingua)
- ✅ Frontend `BrandDetailPage.jsx` già consuma `/registry/brands/{id}/curatorial-profile` con `curatorial_insights[]` testuali
- ✅ Brand seed include `palette[]` + 15 brand reali con `luxury_tier/positioning/markets[]`

### Mancante
- ❌ `Brand Story / Heritage / Sustainability` — i campi esistono (`brands.positioning`, ALE story) ma sono **popolati a mano**, NON estratti dai PDF
- ❌ `Brand Values` — zero campo dedicato (potrebbe vivere in `brands.metadata_json` ma non c'è)
- ❌ `Products` list strutturata per brand (oggi è inferita filtrando `media_library` per `inspiration_meta.brand_id` — funziona ma è loose)

**Verdetto Brand Atlas:** se accetti story+values input manualmente, **è già READY**. Per estrazione automatica dai PDF serve OCR + LLM text comprehension.

---

## 6 · PRODUCT LIBRARY READINESS

**Assessment:** 🟡 **PARTIAL · 55%**

| Campo richiesto | Esiste oggi | Dove |
|---|---|---|
| `product_name` | ✅ | `inspiration_meta.product_name` |
| `brand` | ✅ | `inspiration_meta.brand` + `brand_id` |
| `category` | ✅ | `inspiration_meta.product_category` |
| `description` | 🟡 | `media_library.description` (manuale) · no auto-extracted |
| `dimensions` | ❌ | Non estratte. Solo image `width`/`height` (pixel, NON product dimensions) |
| `materials` | 🟡 | `inspiration_meta.material_tags[]` (tag-level, no FK to `material_registry`) |
| `finishes` | ❌ | No campo dedicato. Potrebbe vivere in tags. |
| `images` | ✅ | Multi-asset via `visual_group_key` + `inspiration_meta.asset_index_in_page` |
| `source_document` | ✅ | `inspiration_meta.supplier_catalog_id` + `inspiration_meta.original_catalog_file_id` + `page_number` |
| `collection` | 🟡 | `inspiration_meta.collection_id` (se utente lo seleziona in upload) |
| `designer` | ✅ | `inspiration_meta.designer` |
| `visual_group_key` (multi-asset clustering) | ✅ | `cultural_engine.visual_grouping` |

**Verdetto Product Library:** struttura **flat** funziona per Inspirations + Moodboard usage, **ma NON è un Product Library**. Per spec sheet completi serve:
1. Tabella `products` canonica
2. Estrazione `dimensions` da page text (regex `(\d+)\s*[x×]\s*(\d+)\s*(?:cm|mm)`)
3. Estrazione `finishes`/`materials_used` da page text vicino al product name
4. M2M `product_materials` → `material_registry`

---

## 7 · ACADEMY BUILDER READINESS

**Assessment:** 🔴 **NOT READY · 0%**

Nessun modulo esiste:
- ❌ Lesson outlines / scripts / slide drafts / podcast drafts: zero codebase
- ❌ Zero tabelle `academy_*`
- ❌ Zero router `academy`

L'unico ai-content esistente è:
- `routers/ai_editorial.py` → `POST /editorial-suggest` (genera moodboard/section suggestions)
- `routers/ai_studio_brief.py` → `POST /{project_id}/ai-brief/generate` (project brief)

Entrambi sono **suggestion-driven, NON lesson-driven**.

**Per Academy Builder serve:**
- LLM text generation pipeline su `brand_story / material_origin / cultural_descriptors` (chunked + retrieved)
- Schema lesson canonico (objective, takeaways, slides[], script_md, audio_url, duration)
- Esportazione slide (HTML/PDF) e podcast (TTS service: OpenAI TTS o ElevenLabs)

---

## 8 · MAGAZINE BUILDER READINESS

**Assessment:** 🟢 **READY (struttura) · 🟡 PARTIAL (AI generation pipeline)**

### Esistente
- ✅ `magazine_articles` table con `locale_content` multilingua + `body_blocks[]` (hero, paragraph, gallery, material_focus, ...)
- ✅ `article_hotspots` tipizzati: material/product/fabric/lighting/furniture/finish/atmosphere/color_palette
- ✅ `magazine_taxonomy` (migration 025)
- ✅ `magazine.router` con endpoint admin + public + save-reference
- ✅ `ai_editorial.editorial-suggest` può suggerire articoli
- ✅ ALE multilingua già integrato

### Mancante
- ❌ "SEO articles auto-generation from catalog brand story" — esiste lo schema, manca il generator
- ❌ "Brand Intelligence article" generator (potrebbe usare i dati `brand_curatorial_profile`)
- ❌ "Materials Intelligence article" (richiede semantic chunks dai materials)
- ❌ "Market Intelligence article" (potrebbe usare `markets.market_intelligence.insights` ma manca composer)

**Verdetto:** se aggiungi un LLM-driven "article composer" che consuma curatorial_profile + market_intelligence + materials → **MVP rapido**. Lo storage è già pronto.

---

## 9 · MARKET INTELLIGENCE GAP

**Assessment:** 🟡 **PARTIAL · 50%**

| Capability | Status |
|---|---|
| Country profiles | 🟡 PARTIAL — `markets` table con `country_code` + `market_intelligence` JSONB editoriale (tone/visual_style/cta_behavior/client_expectations/pitfalls per locale) |
| City profiles | 🟡 PARTIAL — esistono `submarkets` (migration 028) ma non strutturati come city_profiles |
| Project types | 🟡 PARTIAL — inferiti da `brands.hospitality_score/residential_score/contract_score/retail_score`. No tabella canonical `project_types`. |
| Budget ranges | ❌ MISSING — zero campo `budget_range` per market/project. Esiste `luxury_tier` su brands ma è enum, non range. |
| Market-specific recommendations | ✅ WORKING — `descriptor_mapper.map_signals_to_culture()` calcola `market_resonance[]` deterministico (score + narrative + contributors) |

**Architettura nuova richiesta:**
- `country_profiles` canonical (climate_behavior, luxury_profile, hospitality_behavior, spatial_psychology — già in `market_cultural_profiles`)
- `city_profiles` con `parent_country_id`
- `project_types` canonical (residential/hospitality/retail/contract/healthcare/workspace…)
- `budget_ranges` per (city × project_type) JSONB o tabella
- M2M `market_brand_affinity (brand_id, market_id, score, reasons[])`

---

## 10 · EVENT TRACKING AUDIT

### 10.1 · Tabelle esistenti

| Tabella | Granularità | Use case |
|---|---|---|
| `product_events` (013) | Generic UI events · payload JSONB | "moodboard.template_applied", "moodboard.exported", etc. Anonymous session_id. |
| `product_usage_events` (058) | Product-specific | `added_to_moodboard / added_to_project / used_in_cultural_edition / used_in_presentation / used_in_magazine` |
| `magazine_articles.view_count` / `.save_count` | Counter denormalized | Best-effort |
| `funnel_events` (used in CRM) | Lifecycle events | `customer.confirmed`, `customer.reverted`, etc. |
| `realtime_publication_events` (096) | Realtime broadcast | Publication-level |
| `email_events` (143E+) | Email lifecycle | sent/delivered/opened/clicked/bounced |

### 10.2 · Cosa tracciamo OGGI

✅ `moodboard usage` (product_usage_events + product_events)
✅ `cultural_edition usage` (product_usage_events)
✅ `magazine view/save` (magazine_articles counters)
✅ `email lifecycle`
✅ `crm funnel`

### 10.3 · Cosa MANCA

❌ **document_views** (PDF/catalog/article view tracking semantic-level — esiste solo view_count counter su articles)
❌ **product_views** (singolo Product Inspiration views — non tracciato)
❌ **brand_interactions** (brand page views, dwell time, scroll depth)
❌ **search_queries** (zero search-event tracking)
❌ **saves** strutturate (zero "user saved X" event log; esiste solo save_reference via curated_references)

Per il Knowledge Engine: serve **unified events table** (`knowledge_events`) o estensione di `product_events` con vocabolario controlled (`view/save/like/share/dwell/scroll`).

---

## 11 · CATTELAN TEST REVIEW

### 11.1 · Cosa risulta dalla ricerca

| Riferimento | Locazione | Note |
|---|---|---|
| `Cattelan Italia` brand seed | `scripts/apply_migration_058.py` riga 25 | Brand pre-seedato con: `luxury_tier='premium'` · `positioning='luxury contemporaneo'` · scores `h=65 r=85 c=65 r2=45` · `markets=['italy_milano','uae_dubai','usa_miami']` |
| Test `test_iteration_82_brand_registry.py` | riga 38 | `EXPECTED_BRANDS` include `cattelan italia` |
| Test `test_iteration_123_adaptive_language_experience.py` | (file pyc cached) | Reference adaptive language |

### 11.2 · Cosa risulta MANCANTE

- ❌ Nessun **PDF Cattelan** versionato nel repo (es. `/app/tmp/cattelan-*.pdf` non esiste)
- ❌ Nessun **test E2E** specifico per estrazione catalogo Cattelan (esistono solo test `test_iteration_81_supplier_catalog.py` che usa `/tmp/bonaldo.pdf`)
- ❌ Nessun **memory document** in `/app/memory/` che documenti il test Cattelan precedente
- ❌ Nessun **fixture asset** Cattelan in `media_library` (seed) — il brand esiste come row in `brands`, ma nessun Inspiration product associata

### 11.3 · Cosa è REUSABILE

✅ Brand row Cattelan Italia → può essere riutilizzato come `brand_id` per nuovi upload
✅ Pipeline upload-pdf → finalize → media_library è già testata su catalogo Bonaldo (test 81)
✅ Test framework `test_iteration_81_supplier_catalog.py` è clone-able per altri brand

### 11.4 · Risposte secche

| Domanda | Risposta |
|---|---|
| What was extracted? | Solo il brand row (seed). NESSUN catalogo Cattelan PDF è stato ingestionato e testato in questo repo. |
| What worked? | Brand seed deterministico. Brand visibile in `/registry/brands` e `/registry/brands-atlas`. |
| What failed? | N/A — non c'è memoria di un test fallito. Probabilmente il test "Cattelan" mentioned dal Founder è avvenuto in una sessione/preview diversa e non è stato versionato. |
| What data is reusable? | Brand row + slug `cattelan-italia` per accodare upload futuri. |

---

## 12 · GAP ANALYSIS MATRIX

| Capability | Status | Gap critico |
|---|---|---|
| **PDF Parsing** | 🟢 READY | Solo PDF text-native. NO OCR per scansioni. |
| **Image Extraction** | 🟢 READY | Solo immagini ≥300×300px. NO icons/logos. |
| **Product Extraction** | 🟡 PARTIAL (60%) | Manca dimensions, finishes, weight, certifications. Solo name/designer/category. |
| **Material Extraction** | 🔴 NOT READY (15%) | Tag-level solo (manuale o batch default). NO auto-extraction da PDF text. NO FK Product↔Material. |
| **Brand Atlas Generation** | 🟢 READY (data) · 🟡 PARTIAL (auto-story) | Endpoint OK. Story/values manuali. |
| **Academy Builder** | 🔴 NOT READY (0%) | Tutto da costruire. |
| **Magazine Builder** | 🟢 READY (struttura) · 🟡 PARTIAL (AI composer) | Schema completo. Manca generator AI-driven. |
| **Knowledge Graph** | 🟡 PARTIAL (35%) | Manca tabella `products` canonical + `knowledge_edges`. |
| **Market Intelligence** | 🟡 PARTIAL (50%) | Manca `country_profiles`/`city_profiles`/`budget_ranges` strutturati. |
| **Analytics Layer** | 🟡 PARTIAL (45%) | Tracking moodboard/magazine OK. Manca doc/product/brand interaction events. |
| **OCR / Text Comprehension** | 🔴 NOT READY (0%) | Zero. |
| **Vectorization / RAG** | 🔴 NOT READY (0%) | Zero pgvector/embeddings/chunks. |
| **Country/City profiles structured** | 🔴 NOT READY (10%) | Solo JSONB editoriale dentro `markets.market_intelligence`. |
| **Podcast Drafts** | 🔴 NOT READY (0%) | Zero. |

---

## 13 · CURRENT STATE SUMMARY

MOOD oggi è un **PDF-to-Visual-Inspirations engine sofisticato** orientato al curatoriale, non al knowledge semantic:

1. **Ingestione PDF** robusta basata su PyMuPDF — estrae immagini ≥300×300 e testo nativo pagina-per-pagina.
2. **Multi-asset per prodotto**: ogni pagina può produrre fino a 6 candidati che vengono raggruppati con `visual_group_key` deterministico (brand + supplier_catalog + product_name_normalized + page_window fallback).
3. **Classificazione visuale a 2 layer**: rule-based (PIL+numpy) sempre, Vision LLM (gpt-5.1) come fallback su low confidence.
4. **Brand Registry™** canonico con 15 brand reali curated_public (Cattelan Italia incluso). Studio_private + curated_public coexist.
5. **Material Registry™** entity-level con asset M2M tipizzati (8 ruoli).
6. **Cultural Engine™ proprietario** mappa vision signals → cultural descriptors → market resonance (deterministico, NO LLM, NO embeddings).
7. **Brand Atlas™ endpoint** aggrega top-3 atmosphere/material/markets per ogni brand su base inspirations.
8. **Magazine Engine™** con article hotspots tipizzati e i18n locale_content.
9. **Analytics**: 5 event tables (product_events, product_usage_events, funnel_events, email_events, realtime_publication_events) — granularità moodboard/project/cultural_edition.

---

## 14 · EXISTING CAPABILITIES

### Endpoints attivi per il Knowledge layer

```
POST /api/inspirations/catalogs                       create catalog draft
POST /api/inspirations/catalogs/{cid}/upload-pdf      upload PDF + extract
GET  /api/inspirations/catalogs/{cid}                 read with candidates
PATCH /api/inspirations/catalogs/{cid}/candidates     edit before finalize
POST /api/inspirations/catalogs/{cid}/finalize        persist as Product Inspirations
GET  /api/inspirations/catalogs                       list catalogs
DELETE /api/inspirations/catalogs/{cid}               archive

GET  /api/inspirations/registry/brands                Brand Registry list
POST /api/inspirations/registry/brands                create brand
GET  /api/inspirations/registry/brands-atlas          ✦ BRAND ATLAS endpoint ✦
GET  /api/inspirations/registry/brands/{id}/curatorial-profile  ✦ insights ✦
GET  /api/inspirations/registry/brands/{id}/collections
POST /api/inspirations/registry/usage-events
GET  /api/inspirations/registry/products/{id}/visual-assets
GET  /api/inspirations/registry/products/{id}/related

GET  /api/markets                                     Markets list
GET  /api/markets/{id}/intelligence                   Market Matrix™

GET  /api/magazine/admin/articles                     Magazine articles CRUD
GET  /api/magazine/public/{tenant_slug}/articles      Public reading
```

### Frontend pages

- `InspirationsPage.jsx` (atlas/material/product views)
- `BrandModePage.jsx` + `BrandDetailPage.jsx` (Brand Atlas™ UI)
- `MaterialsPage.jsx` + `MaterialDetailPage.jsx` + `MaterialViewPage.jsx`
- `ProductGalleryPage.jsx`
- `StudioCollectionsPage.jsx`
- `SupplierCatalogImportModal.jsx` (upload + review flow)

---

## 15 · MISSING CAPABILITIES

### 15.1 · Critical (blocker per Knowledge Engine MVP)

1. **OCR** — per PDF scansionati e brochure raster-heavy
2. **Text chunking** — splitter (LangChain o custom) per chunk brand_story/heritage/sustainability
3. **Embeddings + pgvector** — per RAG semantic search
4. **`products` canonical table** — separare Product entity da `media_library is_inspiration=true`
5. **`product_materials` M2M** — relazione strutturata con `material_registry`
6. **Brand story/heritage/sustainability extraction pipeline** — LLM-driven da PDF text

### 15.2 · High value (Knowledge Engine v1.0)

7. **`knowledge_edges` graph table** — relazioni esplicite tipizzate (Brand↔Product↔Material↔Concept↔Market)
8. **`country_profiles` / `city_profiles` / `project_types` / `budget_ranges`** canonical
9. **AI Article Composer** per Magazine (Brand Intelligence/Materials/Market Intelligence)
10. **Document view tracking** strutturato

### 15.3 · Future (Knowledge Engine v2.0)

11. **Academy Builder** completo (lesson_outlines + scripts + slides + podcast)
12. **Podcast TTS pipeline** (OpenAI TTS o ElevenLabs)
13. **Search semantica end-user** (cross-product/brand/material)
14. **Knowledge Graph visualization UI**

---

## 16 · TECHNICAL DEBT

### 16.1 · Architettura attuale che pagherà tasse

- `media_library.inspiration_meta` JSONB sta facendo il lavoro di una tabella `products` canonical. Funziona oggi ma:
  - Indexing limitato (solo partial index per `brand`)
  - No type safety (product_name è string ovunque, no FK)
  - Join cross-product per analytics è una full table scan
- `brands.story/positioning` come campi singoli — manca un `brand_documents (brand_id, kind, text_md, source_id)` per gestire più sezioni narrative
- `materials_tags[]` come lista di stringhe in JSONB — manca FK ufficiale a `material_registry`
- `catalog_extractor.py` heuristics su page text — funziona su catalogi tipo Bonaldo/Cattelan ma fragile su naming creativo
- Vision LLM fallback fire-and-forget → no retry, no monitoring

### 16.2 · Migration debt

- Migrazioni 11, 13, 18, 21, 24, 25, 47-48, 49, 56, 57, 58 — già consolidate ma il dataset attuale ha `brands` ben popolato solo via seed manuale (15 brand). Per scale serve un seed pipeline.

---

## 17 · RECOMMENDED ARCHITECTURE (NUOVA, per Knowledge Engine completo)

```
┌────────────────────────────────────────────────────────────────┐
│  INGESTION LAYER                                                │
│                                                                 │
│  PDF Upload ─→ PyMuPDF (existing) ─→ raw_pages[]                │
│                                       ├─→ images (existing flow)│
│                                       └─→ text_chunks (NEW)     │
│                                                                 │
│  Image-only PDF? ─→ Tesseract/easyocr OCR (NEW) ─→ text_chunks  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│  EXTRACTION LAYER                                                │
│                                                                  │
│  text_chunks ──→ LLM Extractor (gpt-4o or Claude Sonnet 4.5)    │
│                  outputs: structured JSON {                     │
│                    products: [{name, dimensions, materials,     │
│                                finishes, designer, collection}] │
│                    brand_story_md                               │
│                    sustainability_md                            │
│                    heritage_md                                  │
│                  }                                              │
│                                                                  │
│  images ──→ Layer 1 + Layer 2 (existing) ─→ asset_classification│
└─────────────────────┬────────────────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────────────────┐
│  STRUCTURED STORAGE (NEW tables)                                  │
│                                                                   │
│  • products (canonical PIM)                                       │
│  • product_materials (M2M → material_registry)                    │
│  • product_assets (M2M → media_library, role)                     │
│  • brand_documents (brand_story / heritage / sustainability)      │
│  • knowledge_chunks (text + pgvector embedding)                   │
│  • knowledge_edges (typed graph relations)                        │
│  • country_profiles / city_profiles / project_types / budget_ranges│
└─────────────────────┬─────────────────────────────────────────────┘
                      │
┌─────────────────────▼─────────────────────────────────────────────┐
│  COMPOSER LAYER (NEW)                                              │
│                                                                    │
│  • Brand Atlas Composer    (existing endpoint + add story chunks)  │
│  • Magazine Article Composer (Brand/Material/Market Intelligence)  │
│  • Academy Lesson Composer (lesson_blocks + script + slides)       │
│  • Podcast Draft Composer  (TTS via OpenAI TTS or ElevenLabs)      │
└────────────────────────────────────────────────────────────────────┘
```

---

## 18 · ESTIMATED EFFORT PER MOOD AI KNOWLEDGE ENGINE™ COMPLETO

### Phase 1 — Foundation (3-4 settimane)
- ✅ Migration: `products`, `product_materials`, `product_assets`, `brand_documents`
- ✅ Migration: `knowledge_chunks` con `pgvector`
- ✅ Backfill: convertire `media_library is_inspiration=true product` → rows in `products`
- ✅ OCR fallback (tesseract via Python `pytesseract`) per PDF immagine-only
- ✅ Text chunking (LangChain `RecursiveCharacterTextSplitter` o custom)

### Phase 2 — Extraction AI (2-3 settimane)
- ✅ LLM Extractor service (gpt-4o o Claude Sonnet 4.5 via Emergent LLM Key)
- ✅ Schema validation con Pydantic models per outputs strutturati
- ✅ Persistenza products + brand_documents + knowledge_chunks
- ✅ Vector indexing per RAG retrieval

### Phase 3 — Knowledge Graph + Country/City profiles (1-2 settimane)
- ✅ `knowledge_edges` table + edge generator
- ✅ `country_profiles` / `city_profiles` / `project_types` / `budget_ranges` schema + seed iniziale (top 20 città)

### Phase 4 — Composers (2-3 settimane)
- ✅ Magazine AI Composer (Brand Intelligence / Materials / Market Intelligence)
- ✅ Brand Atlas Story Composer (LLM blends extracted brand_story + curatorial_insights)
- ✅ Specification Layer (export product spec sheet PDF)

### Phase 5 — Academy + Podcast (2-3 settimane)
- ✅ `academy_lessons` schema + lesson builder
- ✅ Slide deck generator (HTML/PDF)
- ✅ Podcast script + TTS integration (OpenAI TTS o ElevenLabs)

### Totale: **10-15 settimane** full-time (1 senior + 1 mid engineer)

**Quick-win MVP (4-5 settimane):** Phase 1 + Phase 2 (RAG-based Brand Atlas con story estratta da PDF) — già produrrebbe valore commerciale visibile.

---

## 19 · DOMANDE FOUNDER · RISPOSTE FINALI

| Domanda Founder | Risposta |
|---|---|
| MOOD può già leggere PDF? | ✅ SÌ (testo nativo + immagini · NO OCR) |
| MOOD può già estrarre immagini? | ✅ SÌ con classificazione visuale 2-layer |
| PDF sono solo file o contenuto strutturato? | 🟡 PARZIALE — file salvato + immagini diventano Product Inspirations. Testo NON strutturato. |
| Chunking implementato? | ❌ NO |
| Vectorization implementata? | ❌ NO |
| Cattelan testato? | ⚠️ Brand seedato in `brands` (Cattelan Italia, slug `cattelan-italia`). NESSUN PDF Cattelan presente nel repo. NESSUN test specifico per Cattelan. La pipeline è stata testata su Bonaldo (test_iteration_81). |
| MOOD Knowledge Engine senza major refactoring? | 🟡 PARTIAL — Brand Atlas e Magazine Builder sono pronti come storage. Academy / Podcast / Knowledge Graph / RAG richiedono nuove tabelle + LLM extractor + vector store. |

---

## 20 · VERDETTO FINALE

# 🟡 PARTIAL · ~60% delle fondamenta esistono

**Raccomandazione:** prima di costruire qualsiasi nuova feature, definire un **roadmap a fasi** (Phase 1-5 §18) e implementare almeno Phase 1 + Phase 2 come MVP (RAG-based Brand Atlas + Product Library strutturata) → 4-5 settimane. Questo sblocca tutti i composer downstream (Magazine/Academy/Podcast).

**Vincolo Founder rispettato:**
✅ Zero coding
✅ Zero migration
✅ Zero refactor
✅ Solo audit + report

---

**Revision log**

| Versione | Data | Autore | Note |
|---|---|---|---|
| 1.0 | 2026-06-02 | Engineering · Cultural Engine Audit | Audit iniziale MOOD AI Knowledge Engine |
