# ITER198 · ARBI Knowledge Audit™ Report

**Date:** 2026-06-02
**Sprint scope:** AUDIT-ONLY · no data modification, no new code.
**Subject:** First real-world Brand Knowledge Package™ validation on the MOOD AI Knowledge Engine™.
**Catalog Set:** `ARBI test 2026` (id `00e33d7f-bcc4-47ae-914f-617d049906a7`) · Brand `ARBI` (`ab1399d7…`)
**Source corpus:** 16 PDFs · 1564 pages · 99.74% extraction coverage

---

## §1 · Collection Audit

### 1.a · Detected (26 collection-type entities)

| # | Display name | Mentions | Confidence | Notes |
|---|---|---|---|---|
| 1 | **Sky** | 31 | 0.61 | ✅ Real collection |
| 2 | **Over** | 28 | 0.80 | ✅ Real collection |
| 3 | **Almond** | 28 | 0.67 | ✅ Real collection |
| 4 | **Code** | 23 | 0.82 | ✅ Real collection (also dup'd in finishes) |
| 5 | **Absolute** | 22 | 0.61 | ✅ Real collection |
| 6 | **Fusion** | 18 | 0.61 | ✅ Real collection |
| 7 | **Decor** | 17 | 0.61 | ✅ Real collection |
| 8 | **Fold** | 6 | 0.61 | ✅ Real collection |
| 9 | **Master** | 5 | 0.61 | ✅ Real collection |
| 10 | **Luxor** | 5 | 0.61 | ✅ Real collection |
| 11 | **Street** | 4 | 0.61 | ✅ Real collection |
| — | FLAT Nº | 33 | 0.73 | 🟡 Likely page header tag, not a collection |
| — | IL | 29 | 0.61 | 🔴 Italian article fragment |
| — | LE | 22 | 0.73 | 🔴 Italian article fragment |
| — | PERCEZIONI | 8 | 0.73 | 🟡 Internal editorial label, not a collection |
| — | Laccato | 6 | 0.80 | 🔴 Italian for "lacquer" — finish, not collection |
| — | CREDITS | 4 | 0.73 | 🔴 Page label |
| — | Plus | 3 | 0.67 | 🟡 Likely "Home Plus" fragment |
| — | ho.me | 2 | 0.55 | 🟡 Domain-like — actually a collection name |
| — | KALI / TAPE / TOKH | 2 each | 0.55 | 🔴 Series labels, not collections |
| — | ACCESSORI CON DIVISIORI IN VET | 2 | 0.55 | 🔴 Category descriptor |
| — | PORTASALVIETTE | 2 | 0.55 | 🔴 Product type ("towel holder") |
| — | bright white / relax grey | 2 each | 0.55 | 🔴 Finish names |

**Expected from corpus (per filenames):** Absolute · Almond · Code · Collections · Decor · Essentials · Fold · Fusion · Home45 · Luxor · Master · Over · Sky · Street · Bolle (catBOLLE) · Arbi-Catalogue-Code

### 1.b · Cross-doc evidence (products by source document)
| Document | Products extracted |
|---|---|
| 2026_cat_Essentials | 136 |
| 2026_cat_SKY | 35 |
| MASTER24_lowres_completo | 24 |
| cat_ALMOND_2025-1 | 21 |
| cat_CODE_2023 | 21 |
| cat_LUXOR_2023 | 21 |
| 2025_ABSOLUTE_catalogo | 20 |
| cat_OVER_2025 | 19 |
| cat_DECOR_2025 | 18 |
| Arbi-Catalogue-Code | 18 |
| 2026_cat_FUSION | 18 |
| 2026_cat_Collections | 16 |
| cat_FOLD_2023 | 15 |
| 2026_cat_STREET | 12 |
| 2025_cat_HOME45 | 2 ⚠️ |
| CatBOLLE24_lowres | 2 ⚠️ |

### 1.c · Findings

- **11 of 26 collection entities are real** (~42% precision). The other 15 are typographic/finish/category fragments.
- **No canonical merging applied** (`canonical_ref_id` is null on 100% of collection entities).
- **No collection–product graph link** (`canonical_collection_id` is null on **0/398 products**).
- **Per-document skew is severe**: HOME45 and BOLLE produced only 2 products each. These two PDFs are layout-heavy editorial covers (low text density) — the composer's `text_pages=82` and `text_pages=53` are healthy, but the section detector struggled to bound products.

### 1.d · Merge recommendations
| Collapse | Into | Why |
|---|---|---|
| `IL`, `LE`, `Laccato`, `bright white`, `relax grey`, `CREDITS` | `__discard__` | Not collections |
| `Plus` | `Home Plus` / `Home Plus 45` | Fragment |
| `PORTASALVIETTE`, `KALI`, `TAPE`, `TOKH` | category=accessory | Product types |
| `ACCESSORI CON DIVISIORI IN VET` | category=accessory | Descriptor |
| `Code` (finish) | merge w/ `Code` collection (intra-type only) | Cross-type leakage |
| `FLAT Nº` | review | Likely page numbering label |

---

## §2 · Product Audit

### 2.a · Quantitative
- **Total products extracted: 398**
- **Review status:** 398/398 `draft` (none yet validated)
- **No merged duplicates:** `merged_into_id` null on 398/398 (entity resolution not yet applied)

### 2.b · Confidence distribution
| Bucket | Count | Pct |
|---|---|---|
| ≥ 0.80 | 1 | 0.3% |
| 0.60 – 0.79 | 105 | 26.4% |
| 0.40 – 0.59 | 253 | 63.6% |
| 0.01 – 0.39 | 39 | 9.8% |

> Median confidence ~0.50. **Low**: only 26.6% of products clear the 0.60 bar.

### 2.c · Category distribution (ARBI 398)
| Category | Count | Pct | Notes |
|---|---|---|---|
| Specchi (Mirrors) | 220 | 55.3% | Dominant — ARBI is a mirror specialist |
| Complementi | 84 | 21.1% | Accessories |
| Consolle | 54 | 13.6% | Vanity units / consoles |
| Lampade | 13 | 3.3% | Lighting |
| uncategorised | 27 | 6.8% | Need classification |
| Vasche (bathtubs) | 0 | 0% | 🔴 Missing |
| Lavabi (washbasins) | 0 | 0% | 🔴 Missing |
| Storage | 0 | 0% | 🔴 Missing |
| Laundry | 0 | 0% | 🔴 Missing |
| Technical | 0 | 0% | 🔴 Missing |

### 2.d · Content/spec/academy readiness flags
- `content_ready=True`: **192/398 (48.2%)**
- `spec_ready=True`: **2/398 (0.5%)** 🔴
- `academy_ready=True`: **6/398 (1.5%)** 🔴
- With material list populated: **214/398 (53.8%)**
- With finishes list populated: **212/398 (53.3%)**
- With designer attribution: **11/398 (2.8%)** 🔴

### 2.e · Low-confidence samples (need manual review)
- `warm sand` · conf=0.50 · cat=none — finish name mistaken for product
- `Collections` · conf=0.50 · cat=none — catalog title
- `Untitled 1` · conf=0.31 — extraction artefact
- `MELAMINICO` · conf=0.47 — material name

### 2.f · Findings
- The category taxonomy (Specchi / Complementi / Consolle / Lampade) reflects **only the corpus available**: ARBI is heavily mirror-centric in this PDF batch. ARBI also produces vanities, washbasins, bathtubs, storage, and laundry units (Pivot, Tape, K-One series), which **are not visible** in this corpus' detected categories. Either (a) those product families are not represented in the 16 PDFs, or (b) the category classifier defaulted them all to Specchi/Complementi.
- The `category_label` is a **flat string** — there's no canonical category taxonomy table, so cross-brand normalization will require a future migration.

---

## §3 · Materials & Finishes Audit

### 3.a · Materials (12, all high-confidence)

| Material | Mentions | Confidence |
|---|---|---|
| wood | 79 | 0.97 |
| steel | 57 | 0.97 |
| aluminum | 43 | 0.97 |
| lacquer | 39 | 0.97 |
| ceramic | 36 | 0.97 |
| glass | 33 | 0.97 |
| fabric | 23 | 0.97 |
| stone | 22 | 0.97 |
| marble | 16 | 0.97 |
| resin | 11 | 0.96 |
| leather | 3 | 0.84 |
| concrete | 1 | 0.72 |

✅ **Excellent clean canonical set.** The classifier converged on a stable English taxonomy. Confidence is uniformly ≥ 0.97 except `leather` (sparse) and `concrete` (1 mention).

### 3.b · Missing materials in this corpus
- **Laminam** (ARBI signature porcelain-stone slab) → currently appearing only as a finish, not material
- **Tekno** (ARBI proprietary lacquer system) → finish-only
- **Gres / Iris Ceramica** (countertop material) → captured as finish "Gres Iris" with 13 mentions
- **Solid surface / Korakril** → absent

### 3.c · Finishes (419 total, severe noise)

**Top 20 finishes by mentions (likely real):**

| Finish | Mentions | Conf |
|---|---|---|
| Nero | 170 | 0.93 |
| Bianco | 82 | 0.93 |
| Rovere (oak) | 60 | 0.93 |
| Laminam | 53 | 0.93 |
| opaco (matte) | 49 | 0.93 |
| Oak | 35 | 0.93 |
| Black | 18 | 0.93 |
| Ceramica | 18 | 0.68 |
| Oro (gold) | 16 | 0.93 |
| Calacatta | 15 | 0.93 |
| Oliva | 15 | 0.93 |
| Plaza | 13 | 0.92 |
| Gres Iris | 13 | 0.93 |
| Noce (walnut) | 13 | 0.92 |
| Rodio (rhodium) | 12 | 0.74 |
| lucido (glossy) | 11 | 0.74 |
| Grigio Bromo | 10 | 0.80 |
| Bronzo | 10 | 0.86 |
| Lepanto | 10 | 0.86 |
| Brill | 10 | 0.92 |

### 3.d · Finish noise findings (severe)

The remaining 399 finish entries include:
- **Multi-line tokens** (newlines preserved): `"Tekno\nLavabo Roman"`, `"Tekno Colore\nCachi"`, `"Ocritech\nSpecchiera Light"` — these should be split or treated as product names.
- **URL fragments:** `arbiarredobagno.it` (18 mentions) — should be discarded.
- **Cyrillic / multilingual snippets:** `"дерево Eucalipto. Столешница"` (10 mentions) — Russian translation block ingested as a finish.
- **English-Italian duplicates:** `Black` ↔ `Nero`, `Oak` ↔ `Rovere` should be canonicalised.
- **Compound names:** `"a Boheme mirror with aluminium"` — caption fragment.
- **Collection bleed-through:** `Absolute`, `Code`, `Almond Ovale`, `Plaza`, `Brill` appear in finishes (likely model/series names).

### 3.e · Normalisation candidates
| Canonical | Aliases to merge |
|---|---|
| `nero` | Nero · Black |
| `bianco` | Bianco · White |
| `rovere` | Rovere · Oak |
| `lucido` | lucido · glossy · Brill (?) |
| `opaco` | opaco · matte |
| `oro` | Oro · Gold |
| `bronzo` | Bronzo · Bronze |
| `noce` | Noce · walnut |

Estimated **real distinct finish count post-normalisation: ~60-80** (vs. raw 419).

---

## §4 · Knowledge Graph Audit

### 4.a · Current state
- Nodes (per-type entities): **638** in `brand_detected_entities` (collections 26 + products 173 + materials 12 + finishes 419 + designers 8)
- **Edges (`knowledge_graph_edges`): 0** 🔴
- Canonical references: **0** entities linked via `canonical_ref_id` 🔴
- Product → Collection links: **0/398** 🔴
- Product → Material/Finish: products carry flat string arrays in their own row, NOT linked to the `brand_detected_entities` table.
- Brand → Collection link: implicit only (all collections share `brand_id`).

### 4.b · Orphan nodes
- All **398 products** are orphans (no collection edge).
- All **173 product-entities** in `brand_detected_entities` are orphans (no canonical product mapping).
- **8 designer entities** are noise fragments (sentence pieces) — no real designer node exists.

### 4.c · Graph readiness verdict
🔴 **NOT YET A KNOWLEDGE GRAPH.** It is a flat entity catalog. The graph layer (`knowledge_graph_edges`) was provisioned but **never populated** for ARBI. A `build_unified_index` step ran (per the job log), but it does not currently emit relational edges.

---

## §5 · Duplicate Analysis

### 5.a · Auto-resolved
**Zero.** No `merged_into_id` populated on any entity or product.

### 5.b · Needs-review duplicate clusters (manual scan)

| Cluster | Members | Recommendation |
|---|---|---|
| `Code` (collection) ↔ `Code` (finish, 35 mentions) | 2 | Keep collection, demote finish — collection wins |
| `Almond` (collection) ↔ `Almond Ovale` (finish, 12 mentions) | 2 | `Almond Ovale` is a model — promote to product |
| `Absolute` (collection) ↔ `Absolute` (finish, 9 mentions) | 2 | Keep collection, drop finish |
| `Nero` ↔ `Black` | 2 | Merge → `nero` (Italian-canonical brand language) |
| `Bianco` ↔ `White` | implicit | Merge → `bianco` |
| `Rovere` ↔ `Oak` | 2 | Merge → `rovere` |
| `Home Plus` / `Home Plus 45` | not detected as such | Promote `Plus` + `HOME45` → reconcile into `Home Plus` series with sub-variant 45 |
| Designer fragments (8) | 8 | Discard all 8 — replace with manual extraction from the `CREDITS` page |
| `sky` collection ↔ `sky` product (35 mentions) | 2 | Same name — keep collection, the product mentions are page-title bleed |

### 5.c · Cross-doc collision detection
- `Code` collection appears in `cat_CODE_2023` AND `Arbi-Catalogue-Code` → expected, not a duplicate.
- `Home` family: `2025_cat_HOME45` produced 2 products, `Plus` (3 mentions) and `ho.me` (2 mentions) — likely all collapse to a single `Home Plus 45` collection.

---

## §6 · Content Readiness (per Builder)

| Builder | Score | Strengths | Blockers |
|---|---|---|---|
| **Brand Atlas™** | **62 / 100** | 11 real collections detected, 12 canonical materials, full page corpus (1564 snapshots), assets library populated, 192 products content-ready. | Collection entities not canonicalised; no product↔collection edges; designers absent; finish taxonomy noisy. |
| **Academy Builder™** | **22 / 100** | Sections detected (552), raw text on 98% of pages. | Only 6/398 products `academy_ready`. No designer/story metadata. No editorial narrative threading. Page-level OCR/language analysis missing on LUXOR. |
| **Magazine Builder™** | **38 / 100** | High-quality page snapshots, 552 sections with titles, multi-language hint (it/en/other). | Editorial structure not extracted (chapters, hero stories, designer quotes). 14 sections with detected_title vs 538 untitled. |
| **Marketboard Builder™** | **48 / 100** | Categories present on 92% of pages, materials clean, finishes top-20 usable. | No product-market_relevance scoring; market_tags empty on most products; finish noise. |
| **Moodboard Builder™** | **72 / 100** | 1564 page snapshots, asset library populated via `media_library` inserts, similarity-group dedup applied. | No mood_tags on products (column populated for only ~5%). Snippet pages without OCR (LUXOR 0% text/ocr). |
| **Specification Engine™** | **18 / 100** | Dimensions captured as raw strings on some products; materials/finishes per-product arrays present. | Only 2/398 `spec_ready`. `dimensions_structured` empty on most. No SKU-grade attribute model. No spec-sheet template attached. |

---

## §7 · Knowledge Score™ — Composite

| Component | Score | Method |
|---|---|---|
| **Extraction Coverage** | **99.7** | 1560 / 1564 pages (99.74%) |
| **Collection Coverage** | **42** | 11 real collections detected of ~13-15 expected (= 73%) but with 15 false-positive entities polluting the set (precision = 42%); F1 ≈ 0.53 |
| **Product Coverage** | **62** | 398 products extracted, healthy quantitatively, but per-document skew (HOME45 = 2, BOLLE = 2) and 9.8% < 0.4 conf |
| **Material Coverage** | **88** | 12 canonical materials, all confidence ≥ 0.84, English taxonomy stable. Penalty: Laminam/Tekno mis-classed |
| **Finish Coverage** | **35** | 419 raw → estimated ~70 real after normalisation. Top 20 usable, tail 399 mostly noise |
| **Entity Confidence** | **61** | Weighted average confidence across 638 entities: 0.78 — but **canonical_ref_id = null** on 100% drags this down |
| **Graph Completeness** | **5** | 0 edges in `knowledge_graph_edges`; 0 product↔collection links; 0 designer nodes valid |

### Overall Knowledge Score™ — weighted

| Component | Weight | Score | Weighted |
|---|---|---|---|
| Extraction Coverage | 15% | 99.7 | 14.96 |
| Collection Coverage | 15% | 42 | 6.30 |
| Product Coverage | 15% | 62 | 9.30 |
| Material Coverage | 10% | 88 | 8.80 |
| Finish Coverage | 10% | 35 | 3.50 |
| Entity Confidence | 15% | 61 | 9.15 |
| Graph Completeness | 20% | 5 | 1.00 |

### **MOOD Knowledge Score™ = 53.0 / 100**

---

## §8 · Founder Verdict

### 🟡 **C · Additional Entity Resolution Required**

The ARBI extraction pipeline executed at 99.74% page coverage and recovered a quantitatively substantial dataset (398 products, 638 entities, 1564 page snapshots, 12 canonical materials). However, the **post-extraction normalization layer is not yet operational**:

1. **Canonical entity resolution is not running** — no `canonical_ref_id` set on any of the 638 entities; no `merged_into_id` set on any product.
2. **Knowledge graph edges are empty** — `knowledge_graph_edges` has 0 rows for ARBI. Products are orphans, collections are flat.
3. **Designer extraction is broken** — the 8 detected "designers" are all sentence fragments; the ARBI internal design team and external collaborators are unmapped.
4. **Finish noise rate is ~80%** — 419 raw → ~70 likely real.
5. **Collection precision is 42%** — typography fragments (`IL`, `LE`, `Laccato`, `CREDITS`) misclassed as collections.
6. **Per-document yield skew** — HOME45 and BOLLE PDFs returned only 2 products each, suggesting either a layout edge-case in the composer's section detector or that those PDFs are editorial covers rather than catalogues. Worth inspecting.
7. **LUXOR retry caveat** — LUXOR was successfully retried via the new `extraction_job_runner`, but the runner does not yet port the page-level OCR/language analysis step. LUXOR shows `ocr_pages=0, text_pages=0, language=unknown` (data not lost — products/sections/pages all extracted; only the aggregate-metrics row is incomplete).

**ARBI is NOT yet ready to be the official MOOD Knowledge Engine benchmark dataset, but it is the closest any brand has come.**

### Required to promote ARBI to **A · Ready for Brand Atlas™**

| Priority | Action | Effort |
|---|---|---|
| P0 | Run entity resolution pass: collapse finishes (Nero↔Black, Bianco↔White, Rovere↔Oak), demote false-collection entities, promote `Almond Ovale` etc. to products. Populate `canonical_ref_id` and `merged_into_id`. | ~2h |
| P0 | Build the `knowledge_graph_edges` for ARBI: product→collection (by section + page), product→material (from product.materials), product→finish (from product.finishes), brand→collection. | ~2h |
| P1 | Fix the designer detector. Either OCR the `CREDITS` page on each catalogue with a dedicated prompt, or maintain a manual designer registry per brand. | ~1h |
| P1 | Re-process HOME45 + BOLLE with `max_candidates_per_doc` bumped (e.g. 1200) or a different `section_detector` configuration. | ~30 min |
| P1 | Backfill LUXOR's `ocr_pages/text_pages/language` by running the page-level analysis standalone. | ~20 min |
| P2 | Category taxonomy: introduce a canonical `product_category` table and map the 5 detected categories (Specchi/Complementi/Consolle/Lampade/uncategorised) + the missing 5 (vasche/lavabi/storage/laundry/technical). | ~1h |

**Estimated total to GO state:** ~7 hours.

After those, ARBI's Knowledge Score™ is projected to rise from **53 → 78-82** and warrant the Brand Atlas™ publication.

---

## §9 · Data Modification Confirmation

🟢 **No data was modified during this audit.** All queries were read-only SELECT operations against:
- `brand_catalog_sets`
- `brand_catalog_documents`
- `brand_catalog_pages`
- `brand_detected_entities`
- `products`
- `product_sections`
- `knowledge_graph_edges`

No tables were updated, inserted into, or deleted from. The audit can be re-executed reproducibly.

---

**Report deliverable:** `/app/memory/ITER198_ARBI_KNOWLEDGE_AUDIT.md`
