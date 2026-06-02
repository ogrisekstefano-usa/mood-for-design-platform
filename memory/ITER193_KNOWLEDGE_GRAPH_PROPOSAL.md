# ITER193 · DESIGN KNOWLEDGE GRAPH™ ENGINE · PROPOSAL

**Sprint:** Phase 1 · Semantic Layer Foundation
**Status:** 📋 PROPOSAL · awaiting Founder approval
**Data:** 2026-06-02

---

## 1 · ARCHITECTURE OVERVIEW

### Esistente (riusabile dopo ITER187/189/192)
- ✅ Canonical: `brands`, `products`, `materials_canonical`, `designers_canonical`,
  `collections_canonical`, `stories_canonical`
- ✅ Pipeline: Product Composer™ + Vision Cache + Entity Resolver + Package Scorer
- ✅ 19 endpoint REST `/api/inspirations/knowledge-factory/...`

### Nuovo livello: SEMANTIC LAYER
4 nuove **canonical tables** + 9 **relationship tables** + 1 **auto-tagger** + 1 **graph explore endpoint**.

```
   ┌─────────────────────────────────────────────────────────┐
   │   ITER193 · SEMANTIC LAYER (sopra il knowledge factory)   │
   │                                                            │
   │   spaces       features      styles       markets         │
   │      ▲            ▲            ▲            ▲             │
   │      └────────────┴────────────┴────────────┘             │
   │             via 9 relationship tables                     │
   │                          │                                │
   │   ┌──────────────────────┴────────────────────┐           │
   │   │  products · materials · designers · brands │           │
   │   │  stories · collections                     │           │
   │   └────────────────────────────────────────────┘           │
   │                                                            │
   │   ITER187/192 canonical entities (reused)                  │
   └────────────────────────────────────────────────────────────┘
```

---

## 2 · NEW CANONICAL ENTITIES (Migration 118)

### 4 tabelle (forma identica per uniformità)

```sql
CREATE TABLE spaces_canonical (
  id UUID PK, tenant_id UUID NULL,
  space_key TEXT NOT NULL,           -- 'living_room', 'hospitality'
  display_name TEXT NOT NULL,         -- 'Living Room'
  category TEXT,                      -- 'residential' | 'commercial' | 'mixed'
  description_i18n JSONB DEFAULT '{}',
  keywords JSONB DEFAULT '[]',        -- match vocabulary for auto-tagger
  parent_space_id UUID NULL,          -- hierarchy: 'master_bedroom' → 'bedroom'
  metadata_json JSONB DEFAULT '{}',
  is_global BOOLEAN DEFAULT TRUE,     -- TRUE = seeded MOOD vocab; FALSE = tenant-extension
  created_at, updated_at,
  UNIQUE (tenant_id, space_key)
);

CREATE TABLE features_canonical (   -- identical shape, replaces 'space_*'
  id UUID PK, tenant_id UUID NULL, feature_key TEXT, display_name TEXT,
  category TEXT,                      -- 'functional' | 'technical' | 'sustainability'
  description_i18n JSONB, keywords JSONB, metadata_json JSONB, is_global BOOLEAN,
  UNIQUE (tenant_id, feature_key)
);

CREATE TABLE styles_canonical (
  id UUID PK, tenant_id UUID NULL, style_key TEXT, display_name TEXT,
  era TEXT,                           -- 'contemporary' | 'modernist' | 'classic'
  mood_tags JSONB,                    -- ['warm', 'monolithic']
  description_i18n JSONB, keywords JSONB, metadata_json JSONB, is_global BOOLEAN,
  UNIQUE (tenant_id, style_key)
);

CREATE TABLE markets_canonical (
  id UUID PK, tenant_id UUID NULL, market_key TEXT, display_name TEXT,
  region TEXT,                        -- 'NA' | 'EU' | 'APAC' | 'ME'
  segment TEXT,                       -- 'luxury_residential' | 'hospitality' | 'contract'
  market_size_tier TEXT,              -- 'tier1' | 'tier2' | 'tier3' (gold/silver/bronze)
  description_i18n JSONB, keywords JSONB, metadata_json JSONB, is_global BOOLEAN,
  UNIQUE (tenant_id, market_key)
);
```

### Seed vocabulary (Phase 1 baseline, populated by migration)
| Table | Seeded rows | Examples |
|---|---|---|
| `spaces_canonical` | ~20 | living_room, dining_room, kitchen, bathroom, bedroom, master_bedroom, outdoor, hospitality, retail, workplace, wellness, lobby, lounge, restaurant, spa, contract, residential, luxury_residential |
| `features_canonical` | ~30 | relax, modular, storage, wireless_charging, acoustic, dimmable, integrated_lighting, outdoor_rated, sustainable, reclaimed_material, fire_resistant, water_resistant, customizable, foldable, motorized, easy_clean, hypoallergenic |
| `styles_canonical` | ~15 | contemporary, minimal, organic, scandinavian, industrial, luxury, mediterranean, architectural, timeless, mid_century, brutalist, italian_modern, japandi, art_deco |
| `markets_canonical` | ~25 | usa, italy, germany, uk, france, uae, spain, hospitality_usa, luxury_residential_usa, contract_europe, hospitality_apac, luxury_residential_apac, retail_europe, retail_usa |

---

## 3 · RELATIONSHIP MODEL

### Strategy: HYBRID
**Hot paths:** specific M:N tables for direct queries (most queries hit products).
**Cold paths:** generic `knowledge_graph_edges` table for everything else (extensibility).

### 9 specific relationship tables (Phase 1)

```sql
-- 1. Product ↔ Material  (esiste già come products.canonical_material_ids JSONB)
--    NESSUNA tabella nuova, riusiamo il campo JSONB esistente

-- 2. Product ↔ Space
CREATE TABLE product_spaces (
  id UUID PK,
  product_id UUID FK products,
  space_id   UUID FK spaces_canonical,
  source TEXT,                    -- 'auto' | 'admin' | 'vision'
  confidence_score NUMERIC(4,3),
  evidence JSONB DEFAULT '[]',    -- which keywords/phrases triggered the match
  created_at,
  UNIQUE (product_id, space_id)
);

-- 3. Product ↔ Feature
CREATE TABLE product_features (... same shape ...);

-- 4. Product ↔ Style
CREATE TABLE product_styles (... same shape ...);

-- 5. Product ↔ Market (with relevance score per market)
CREATE TABLE product_markets (
  id UUID PK,
  product_id UUID FK products,
  market_id  UUID FK markets_canonical,
  relevance_score NUMERIC(4,3),   -- 0-1: how relevant is this product for the market
  source TEXT,                    -- 'auto' | 'admin'
  evidence JSONB DEFAULT '[]',
  created_at,
  UNIQUE (product_id, market_id)
);

-- 6. Material ↔ Style
CREATE TABLE material_styles (... same shape ...);

-- 7. Material ↔ Space
CREATE TABLE material_spaces (... same shape ...);

-- 8. Story ↔ Market
CREATE TABLE story_markets (
  id UUID PK,
  story_id UUID FK stories_canonical,
  market_id UUID FK markets_canonical,
  relevance_score NUMERIC(4,3),
  created_at,
  UNIQUE (story_id, market_id)
);

-- 9. Brand ↔ Style + Brand ↔ Market (aggregato via products)
CREATE TABLE brand_styles (
  id UUID PK,
  brand_id UUID FK brands,
  style_id UUID FK styles_canonical,
  product_count INTEGER DEFAULT 0,
  affinity_score NUMERIC(4,3),    -- 0-1: how strongly brand identifies with this style
  created_at, updated_at,
  UNIQUE (brand_id, style_id)
);
CREATE TABLE brand_markets (... same shape, replace style→market ...);
```

### Generic edges table (Phase 2 extensibility)
```sql
CREATE TABLE knowledge_graph_edges (
  id UUID PK,
  tenant_id UUID NULL,
  source_type TEXT NOT NULL,      -- 'product' | 'material' | 'brand' | 'story'
  source_id UUID NOT NULL,
  target_type TEXT NOT NULL,      -- 'space' | 'style' | 'market' | 'feature' | …
  target_id UUID NOT NULL,
  edge_type TEXT NOT NULL,        -- 'suggested' | 'curated' | 'inverse' | …
  weight NUMERIC(4,3),
  evidence JSONB DEFAULT '[]',
  created_at,
  UNIQUE (source_type, source_id, target_type, target_id, edge_type)
);
```

### Market Intelligence Layer (per-product denormalized cache)
```sql
ALTER TABLE products
  ADD COLUMN market_relevance JSONB NOT NULL DEFAULT '{}'::jsonb;
  -- {
  --   "us": 0.85,
  --   "eu": 0.65,
  --   "hospitality": 0.92,
  --   "residential": 0.78,
  --   "retail": 0.40
  -- }
```

---

## 4 · AUTO-TAGGER STRATEGY

### When trigger
1. Product `review_status` transitions to `'approved'` → run auto-tagger (sync, fast)
2. Optional: batch run at end of each Brand Import Session pipeline (after entity resolution)

### Algorithm Phase 1 (deterministic, NO LLM)
```
Inputs (per product):
  - product_name, description, description_i18n
  - materials (canonical_material_ids)
  - finishes, dimensions_structured, applications, usage_contexts
  - category_label, designer_name
  - section raw_text

Process:
  1. For each canonical entity type (space, feature, style, market):
       For each row's `keywords` JSONB:
         Compute keyword density score on (name + description + raw_text)
         If score > threshold (0.2):
           INSERT product_<entity>(product_id, <entity>_id, confidence_score=score, source='auto')
  2. Material-derived tags:
       Materials like 'wood' + 'marble' → style='timeless'
       Materials like 'rattan' + 'teak' → space='outdoor'
       (vocabulary table inside auto_tagger.py)
  3. Market relevance:
       us_relevance = f(style_luxury + designer_origin + category_premium)
       eu_relevance = f(designer_italian + materials_natural + heritage_story)
       hospitality = f(features_acoustic + materials_durable + category_seating)
       residential = baseline 0.6, boosted by space_living/bedroom matches
       retail = boosted by feature_modular + style_contemporary
```

### Confidence calibration
- 0.95+ : keyword density very high + multi-evidence
- 0.70+ : reliable single-evidence
- 0.40+ : weak heuristic
- < 0.40 : NOT stored (filter out noise)

### Evidence trail
Every auto-generated link stores:
```json
"evidence": [
  {"keyword": "modular", "snippet": "...completely modular sofa...", "score_contribution": 0.45},
  {"derived_from": "materials.outdoor_rated"}
]
```
This enables future LLM re-validation + admin debugging.

---

## 5 · API DESIGN

### Single discovery endpoint
```
GET /api/knowledge-graph/explore
    ?type=products|materials|brands|spaces|styles|features|markets
    &brand_id=<uuid>
    &space=<key>
    &style=<key>
    &market=<key>
    &feature=<key>
    &limit=50
    &include_edges=true
```

### Response shape
```json
{
  "filters_applied": {...},
  "nodes": {
    "products":   [{id, name, brand_id, market_relevance, ...}, ...],
    "materials":  [...],
    "brands":     [...],
    "spaces":     [...],
    "styles":     [...],
    "features":   [...],
    "markets":    [...]
  },
  "edges": [
    {"from": "product:uuid", "to": "style:contemporary", "weight": 0.82, "evidence": [...]},
    ...
  ],
  "counts": {
    "products": 47, "materials": 12, "designers": 18,
    "spaces_matched": 5, "styles_matched": 3
  }
}
```

### 4 ulteriori endpoint utili
```
GET    /api/knowledge-graph/canonical/{type}                · list seeded vocab (spaces/styles/...)
POST   /api/knowledge-graph/canonical/{type}                · admin: add custom entity
POST   /api/knowledge-graph/products/{id}/retag             · admin: manual retrigger of auto-tagger
GET    /api/knowledge-graph/products/{id}/edges             · all edges for a specific product
```

---

## 6 · SCALING STRATEGY (100+ brands)

| Concern | Phase 1 solution | Phase 2 evolution |
|---|---|---|
| Vocabulary cardinality | seeded 90 canonical rows; admin-extensible | dynamic vocab learning via LLM |
| Auto-tagger throughput | sync per-product on approve (≤200ms) | async queue after batch session |
| Query speed | direct M:N table joins + B-tree indexes | materialized views per market |
| Graph traversal | single-hop product → space/style/market | recursive CTE for multi-hop |
| Edge explosion | 5 specific tables (hot) + 1 generic (cold) | TimescaleDB hypertable per edge type |
| Market intel updates | denormalized JSONB on products | event-driven recompute |
| Multi-tenant | tenant-scoped + global is_global flag | cross-tenant marketplace via global rows |

### Numeri stimati a regime
- 100 brand × 200 product/brand = 20.000 products
- 20.000 products × 5 spaces avg = 100k product_spaces rows
- 20.000 products × 8 features avg = 160k product_features rows
- 100 brands × 10 styles avg = 1.000 brand_styles rows
- Totale edge rows ~500k → indexabili linearmente, query <50ms

---

## 7 · EXAMPLE GRAPH (5 brand ipotetici)

Quando i PDF reali Riva/Margraf/Arrital/Nemo/Samoa saranno caricati, il graph apparirebbe così:

```
spaces                                                styles
─────────                                            ─────────
living_room ◄────────────────┐                        contemporary
dining_room ◄────────────────┤                        ◄────────┐
kitchen     ◄────────────────┤                        minimal  ◄────────────┐
hospitality ◄────────────────┤                        organic  ◄─┐          │
outdoor     ◄────────────────┘                        luxury   ◄─┤          │
                              │                                  │          │
features                      │                                  │          │
─────────                     │                                  │          │
modular ◄────────────────┐    │                                  │          │
storage ◄────────────────┤    │                                  │          │
                              │                                  │          │
        ┌─────────────────────┼──────────────────────────────────┘          │
        │                     │                                              │
        ▼                     ▼                                              │
products (~200 in this graph)                                                │
        │                                                                    │
        ├─Cattelan ARIA ────► Living + Dining + Contemporary + Luxury+USA   │
        ├─Riva Kauri Table ── Living + Outdoor + Organic + Sustainable + EU │
        ├─Margraf Marble ──── Hospitality + Luxury + Italian Modern         │
        ├─Arrital Kitchen ─── Kitchen + Contemporary + Modular + Residential│
        ├─Nemo Lighting ───── All Spaces + Architectural + Dimmable         │
        └─Samoa Sofa ──────── Hospitality + Modular + Acoustic              │
                                                                             │
materials                                                                    │
─────────                                                                    │
Kauri ◄──── Riva (origin: New Zealand) ──── Story: Heritage ────────────────┘
Marble Calacatta ◄──── Margraf (origin: Carrara) ──── Story: Italian Heritage
Brass ◄──── Cattelan, Riva ──── Style: Luxury
Reclaimed Wood ◄──── Riva ──── Story: Sustainability + Material Culture
```

### Esempio query risolta
```
GET /api/knowledge-graph/explore?style=contemporary&space=hospitality&market=usa
→
{
  "nodes": {
    "products": [
      {"id": ..., "name": "Cattelan ARIA", "brand": "Cattelan",
       "market_relevance": {"us": 0.85, "hospitality": 0.92, ...}},
      {"id": ..., "name": "Samoa Modular Sofa", "brand": "Samoa",
       "market_relevance": {"us": 0.78, "hospitality": 0.91}}
    ],
    "materials": [{"id":"...", "name":"Brass", "mentioned_in_products": 12}],
    "styles": [{"id":"...", "name":"Contemporary"}],
    "spaces": [{"id":"...", "name":"Hospitality"}],
    "markets": [{"id":"...", "name":"USA"}]
  },
  "edges": [
    {"from":"product:aria", "to":"style:contemporary", "weight":0.88},
    {"from":"product:aria", "to":"space:hospitality", "weight":0.85},
    {"from":"product:aria", "to":"market:usa", "weight":0.85}
  ],
  "counts": {"products": 2, "edges": 6}
}
```

---

## 8 · IMPLEMENTATION PLAN · Phase 1

**Effort stima: 1 sessione (4-5h)**

| Step | What | Mins |
|---|---|---|
| A | Migration 118 + applier + seed vocab (90 rows in spaces/features/styles/markets) | 60 |
| B | `cultural_engine/auto_tagger.py` (keyword density + material-derived + market intel) | 80 |
| C | `routers/knowledge_graph.py` (5 endpoint) montato su `/api/knowledge-graph` | 60 |
| D | Hook auto-tagger nei flussi: `/products/{id}/approve` + entity resolver post-session | 30 |
| E | Tests `/app/backend/tests/test_iter193_knowledge_graph.py` (8-12 test) | 60 |
| F | Regression: ITER187 + ITER192 (16+10 test) | 15 |
| G | PRD + report `/app/memory/ITER193_KNOWLEDGE_GRAPH_REPORT.md` | 20 |

### Deliverabili
- ✅ 4 nuove canonical tables seeded con vocab baseline (~90 entry)
- ✅ 9 nuove relationship tables + 1 generic edges table
- ✅ Auto-tagger deterministico funzionante
- ✅ 5 endpoint REST sotto `/api/knowledge-graph`
- ✅ Market Intelligence Layer su `products.market_relevance` JSONB
- ✅ Test ITER193: ≥10 test PASS
- ✅ Regression: 26/26 PASS

---

## 9 · GO/NO-GO Decision Points

a) **Approvi le 4 canonical tables + 9 relationship tables + 1 generic edges + ALTER products** (totale 14 tabelle nuove + 1 colonna)?

b) **Vocab seed Phase 1**: spazi 20, features 30, styles 15, markets 25 (totale ~90 entry). Aggiungi/togli categorie?

c) **Auto-tagger trigger**: sync su `approve` (≤200ms latency) — preferisci async per evitare slowdown UI?

d) **Confidence threshold**: drop edges sotto 0.40 (filtro rumore). Più conservativo (0.50) o più aggressivo (0.30)?

e) **API style**: 1 endpoint mega-flessibile `GET /explore` + 4 utility, oppure più endpoint specializzati?

f) **Market Intelligence**: 5 score per product (us/eu/hospitality/residential/retail). Aggiungi APAC, ME esplicitamente?

g) **Frontend Phase 1**: confermo ZERO UI in questa iterazione (solo JSON)?
