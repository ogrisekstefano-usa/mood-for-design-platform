# ITER188 · Knowledge Factory™ Real Catalog Validation
## cattelan_729.pdf — Cattelan Italia 2026

**Data:** 2026-06-02 02:23 UTC
**PDF:** `/tmp/cattelan_729.pdf` · **22.02 MB** · **93 pages**
**Pipeline timings:** total **417.82s** (section=0.85s, images=20.86s, classify=10.99s, vision=384.71s, dedup=0.02s, compose=0.37s)
**Vision Layer 2:** enabled=True · enriched=150 · failed=0

---
## SECTION 1 · Product Detection

| Metric | Value |
|---|---|
| Pages | 93 |
| Product sections detected | 52 |
| Products created | 52 |
| Expected (from TOC analysis) | 47 |
| **Detection accuracy** | **110.6%** |
| TOC heuristic entries found | 0 |

---
## SECTION 2 · Image Extraction

| Metric | Value |
|---|---|
| Total images extracted | 150 |
| Images assigned to products | 147 |
| Unassigned images | 0 |
| Duplicates removed (post-dedup) | 4 |
| Distinct similarity groups | 146 |

### Classification breakdown (asset role)

| Role | Count | % |
|---|---|---|
| hero | 58 | 39.5% |
| ambient | 15 | 10.2% |
| still_life | 8 | 5.4% |
| detail | 12 | 8.2% |
| texture | 0 | 0.0% |
| technical | 0 | 0.0% |
| finish | 2 | 1.4% |
| drawing | 3 | 2.0% |
| packshot | 49 | 33.3% |
| decorative | 0 | 0.0% |

### Asset type breakdown (rule classifier output)

| asset_type | Count |
|---|---|
| lifestyle | 73 |
| cutout | 49 |
| detail | 12 |
| still_life | 8 |
| rendering | 3 |
| material_sample | 2 |

---
## SECTION 3 · Asset Diversity Score™

**Average Diversity Score** across 47 products: **0.795**

Formula = `visual_uniqueness*0.40 + perspective_variety*0.30 + detail_coverage*0.20 + technical_coverage*0.10`

### Top 20 — Highest Diversity

| # | Product | Images | Unique groups | Score |
|---|---|---|---|---|
| 1 | Baldwin | 9 | 9 | 1.0 |
| 2 | Gibson | 8 | 8 | 1.0 |
| 3 | Murphy | 5 | 5 | 0.94 |
| 4 | Wanted | 4 | 4 | 0.94 |
| 5 | Bilbao Glass | 4 | 4 | 0.865 |
| 6 | Gotham Keramik Drive | 4 | 4 | 0.865 |
| 7 | Senator Keramik Magnum | 9 | 9 | 0.865 |
| 8 | Giselle | 4 | 4 | 0.865 |
| 9 | Britney | 4 | 4 | 0.865 |
| 10 | Margaret | 4 | 4 | 0.865 |
| 11 | Peggy | 4 | 4 | 0.865 |
| 12 | Standard | 3 | 3 | 0.865 |
| 13 | Lagoon | 3 | 3 | 0.865 |
| 14 | Amalfi | 4 | 4 | 0.865 |
| 15 | Address | 4 | 4 | 0.865 |
| 16 | Kiran | 4 | 4 | 0.865 |
| 17 | Tyron Marble | 3 | 3 | 0.85 |
| 18 | Skorpio Marble | 3 | 3 | 0.79 |
| 19 | Napoleon Keramik Outdoor | 3 | 3 | 0.79 |
| 20 | Boston | 3 | 3 | 0.79 |

### Bottom 20 — Lowest Diversity

| # | Product | Images | Unique groups | Score |
|---|---|---|---|---|
| 1 | Sierra Pouf | 1 | 1 | 0.615 |
| 2 | Magda Barrè | 2 | 2 | 0.69 |
| 3 | Bishop | 4 | 4 | 0.69 |
| 4 | Peninsula | 2 | 2 | 0.69 |
| 5 | Brio Keramik | 2 | 2 | 0.69 |
| 6 | Chelsea | 2 | 2 | 0.69 |
| 7 | San Marco | 3 | 3 | 0.69 |
| 8 | Potter | 2 | 2 | 0.69 |
| 9 | Richard | 3 | 3 | 0.69 |
| 10 | Untitled 1 | 1 | 1 | 0.715 |
| 11 | Giano Marble | 2 | 2 | 0.715 |
| 12 | Yoda Marble | 2 | 2 | 0.715 |
| 13 | Rado Keramik Round Outdoor | 2 | 2 | 0.715 |
| 14 | Magda Barrè Sgabello | 2 | 2 | 0.715 |
| 15 | Baldwin | 2 | 2 | 0.715 |
| 16 | Skorpio Marble | 3 | 3 | 0.79 |
| 17 | Napoleon Keramik Outdoor | 3 | 3 | 0.79 |
| 18 | Boston | 3 | 3 | 0.79 |
| 19 | Charlotte | 2 | 2 | 0.79 |
| 20 | Magda ML Barrè | 2 | 2 | 0.79 |

---
## SECTION 4 · Metadata Extraction (success %)

| Field | Success % |
|---|---|
| Product Name | 98.1% |
| Designer | 84.6% |
| Description | 92.3% |
| Materials | 92.3% |
| Finishes | 90.4% |
| Dimensions | 84.6% |
| Categories | 98.1% |

---
## SECTION 5 · Confidence Analysis

Average composite confidence: **0.683**

| Bucket | Count | % |
|---|---|---|
| 0.90+ | 0 | 0.0% |
| 0.80+ | 11 | 21.2% |
| 0.70+ | 22 | 42.3% |
| 0.60+ | 12 | 23.1% |
| 0.50+ | 0 | 0.0% |
| <0.50 | 7 | 13.5% |

---
## SECTION 6 · Knowledge Factory Readiness™ Scorecard

| Capability | Score (0-100) |
|---|---|
| Product Detection | 110.6 |
| Image Grouping | 97.3 |
| Image Classification | 98.0 |
| Material Extraction | 92.3 |
| Finishes Extraction | 90.4 |
| Dimensions Extraction | 84.6 |
| Designer Extraction | 84.6 |
| Category Extraction | 98.1 |
| **Brand Atlas™ Readiness** | **93.6** |
| **Academy™ Readiness** | **83.3** |
| **Marketboard™ Readiness** | **91.3** |
| **Moodboard™ Readiness** | **93.6** |
| **Specification™ Readiness** | **87.2** |

---
## SECTION 7 · Failure Analysis

### Top extraction failures (up to 20 examples)

- NO TITLE · section 1 pages 2-2
- NO DESIGNER · Book 2026 Collection (pp.92-93)
- NO DIMENSIONS · Untitled 1
- NO DIMENSIONS · Collection
- NO DIMENSIONS · Collection
- NO DIMENSIONS · Collection
- NO DIMENSIONS · Richard
- NO MATERIALS · Untitled 1
- NO MATERIALS · Collection
- NO MATERIALS · cattelanitalia.com
- NO MATERIALS · Book 2026 Collection
- LOW CONFIDENCE 0.14 · Untitled 1
- LOW CONFIDENCE 0.19 · Collection
- LOW CONFIDENCE 0.28 · Collection
- LOW CONFIDENCE 0.29 · cattelanitalia.com
- LOW CONFIDENCE 0.31 · Book 2026 Collection

---
## SECTION 8 · Product Knowledge Object™ Validation (sample 20)

| # | Product | Brand Atlas | Academy | Marketboard | Moodboard | Specification |
|---|---|---|---|---|---|---|
| 1 | Untitled 1 | NO | NO | NO | PARTIAL | NO |
| 2 | Collection | PARTIAL | NO | PARTIAL | NO | PARTIAL |
| 3 | Collection | PARTIAL | NO | NO | NO | NO |
| 4 | Collection | PARTIAL | NO | PARTIAL | NO | PARTIAL |
| 5 | Bilbao Glass | YES | YES | YES | YES | YES |
| 6 | Gotham Keramik Drive | YES | YES | YES | YES | YES |
| 7 | Senator Keramik Magnum | YES | YES | YES | YES | YES |
| 8 | Skorpio Marble | YES | YES | YES | YES | YES |
| 9 | Tyron Marble | YES | PARTIAL | YES | PARTIAL | YES |
| 10 | Giano Marble | YES | PARTIAL | YES | PARTIAL | YES |
| 11 | Yoda Marble | YES | PARTIAL | YES | PARTIAL | YES |
| 12 | Rado Keramik Round Outdoor | YES | PARTIAL | YES | PARTIAL | YES |
| 13 | Napoleon Keramik Outdoor | YES | YES | YES | YES | YES |
| 14 | Boston | YES | YES | YES | YES | YES |
| 15 | Giselle | YES | YES | YES | YES | YES |
| 16 | Charlotte | YES | YES | YES | YES | YES |
| 17 | Magda Barrè | YES | YES | YES | YES | YES |
| 18 | Magda ML Barrè | YES | YES | YES | YES | YES |
| 19 | Britney | YES | YES | YES | YES | YES |
| 20 | Greta Wood | YES | YES | YES | YES | YES |

---
## SECTION 9 · Moodboard Readiness Audit

- Hero assets: **58**
- Ambient assets: **15**
- Detail / packshot assets: **61**
- Finish / texture assets: **2**
- Products with hero+detail+materials (strong moodboard): **28** / 52 (53.8%)

**Weaknesses:**
- Hero coverage: 39.5% of assets (target ≥15% per catalog)
- ⚠️ Ambient < hero count — lifestyle storytelling has thin material

---
## SECTION 10 · Marketboard Readiness Audit

- Products with designer + materials + finishes + description (strong marketboard): **44** / 52 (84.6%)

**Gaps:**

---
# FINAL DELIVERABLE

## 1 · Executive Summary

**Can Product Composer™ scale to 50+ brands?**  →  **YES — Product Composer™ può scalare a 50+ brand**

## 2 · Brand Knowledge Factory Readiness

## 🏛️ **88.1 / 100**

Weighted formula:
- Brand Atlas (20%) · Academy (15%) · Marketboard (20%) · Moodboard (20%) · Specification (15%) · Avg confidence (10%)

## 3 · Immediate Fixes Required (highest priority before frontend)


## 4 · Recommended Phase 1.5 (highest-ROI improvements)

- Enhance `section_detector._page_title` to use BOTH text size AND vertical position (top-15%) for higher precision
- Add `dimensions_structured` parsing for technical schema styles (SAG., Ø, h variations) — large precision gain for Cattelan-style PDFs
- Bring Vision LLM Layer 2 online for assets with `classification_confidence < 0.55` — biggest improvement on hero/ambient detection
- Add finish swatch detection by aspect ratio (very small square crops on dedicated finish pages)
- Cross-reference TOC heuristic titles ↔ detected sections to flag missing products automatically

## 5 · Recommendation

**A. Proceed to Frontend Review** (estrazione sufficiente)

**Justification:**

Readiness 88.1/100 supera la soglia di shipping frontend. La copertura metadati (name 98.1%, designer 84.6%, dims 84.6%) e l'image classification (98.0%) sono sufficienti per un admin review workflow utile. La pipeline gestisce 52/47 prodotti in 417.82s su 93 pagine: scalabile a 50+ brand con processing parallelo.

---

## Appendix · Full Product List

| # | Product | Pages | Designer | Cat | Assets | Hero | Ambient | Det | Mat | Fin | Dim | Desc | Conf | Spec | Acad | Cont |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Untitled 1 | 2-2 | — | — | 1 | 0 | 0 | 1 | · | · | · | · | 0.14 | · | · | · |
| 2 | Collection | 4-4 | — | Tavoli | 0 | 0 | 0 | 0 | ✓ | · | · | · | 0.31 | · | · | · |
| 3 | Collection | 5-5 | — | Tavoli | 0 | 0 | 0 | 0 | · | · | · | · | 0.19 | · | · | · |
| 4 | Collection | 6-6 | — | Letti | 0 | 0 | 0 | 0 | ✓ | · | · | · | 0.28 | · | · | · |
| 5 | Bilbao Glass | 7-9 | Tosca Design | Tavoli | 4 | 2 | 0 | 2 | ✓ | ✓ | ✓ | ✓ | 0.81 | ✓ | ✓ | ✓ |
| 6 | Gotham Keramik Drive | 10-12 | Paolo Cattelan | Tavoli | 4 | 2 | 0 | 2 | ✓ | ✓ | ✓ | ✓ | 0.81 | ✓ | ✓ | ✓ |
| 7 | Senator Keramik Magnum | 13-18 | Paolo Cattelan | Tavoli | 9 | 5 | 1 | 3 | ✓ | ✓ | ✓ | ✓ | 0.80 | ✓ | ✓ | ✓ |
| 8 | Skorpio Marble | 19-20 | A. Lucatello & P.  | Tavoli | 3 | 2 | 0 | 1 | ✓ | ✓ | ✓ | ✓ | 0.77 | ✓ | ✓ | ✓ |
| 9 | Tyron Marble | 21-21 | Paolo Cattelan | Tavoli | 3 | 0 | 0 | 2 | ✓ | ✓ | ✓ | ✓ | 0.73 | ✓ | · | · |
| 10 | Giano Marble | 22-22 | Manzoni & Tapinass | Tavoli | 2 | 0 | 0 | 2 | ✓ | ✓ | ✓ | ✓ | 0.72 | ✓ | · | · |
| 11 | Yoda Marble | 23-23 | Paolo Cattelan | Tavoli | 2 | 0 | 0 | 2 | ✓ | ✓ | ✓ | ✓ | 0.72 | ✓ | · | · |
| 12 | Rado Keramik Round Outdoor | 24-24 | Paolo Cattelan | Tavoli | 2 | 0 | 0 | 2 | ✓ | ✓ | ✓ | ✓ | 0.75 | ✓ | · | · |
| 13 | Napoleon Keramik Outdoor | 25-26 | Paolo Cattelan | Tavoli | 3 | 2 | 0 | 1 | ✓ | ✓ | ✓ | ✓ | 0.73 | ✓ | ✓ | ✓ |
| 14 | Boston | 27-28 | Paolo Cattelan | Poltrone | 3 | 2 | 0 | 1 | ✓ | ✓ | ✓ | ✓ | 0.78 | ✓ | ✓ | ✓ |
| 15 | Giselle | 29-30 | Maurizio Manzoni | Tavoli | 4 | 2 | 0 | 1 | ✓ | ✓ | ✓ | ✓ | 0.80 | ✓ | ✓ | ✓ |
| 16 | Charlotte | 31-31 | Luca Signoretti | Tavoli | 2 | 1 | 0 | 1 | ✓ | ✓ | ✓ | ✓ | 0.70 | ✓ | ✓ | ✓ |
| 17 | Magda Barrè | 32-32 | Studio Kronos | Tavoli | 2 | 1 | 0 | 0 | ✓ | ✓ | ✓ | ✓ | 0.70 | ✓ | ✓ | ✓ |
| 18 | Magda ML Barrè | 33-33 | Studio Kronos | Tavoli | 2 | 1 | 0 | 1 | ✓ | ✓ | ✓ | ✓ | 0.71 | ✓ | ✓ | ✓ |
| 19 | Britney | 34-35 | Castello Lagravine | Poltrone | 4 | 1 | 1 | 2 | ✓ | ✓ | ✓ | ✓ | 0.76 | ✓ | ✓ | ✓ |
| 20 | Greta Wood | 36-36 | Paolo Cattelan | Sedie | 2 | 1 | 0 | 1 | ✓ | ✓ | ✓ | ✓ | 0.68 | ✓ | ✓ | ✓ |
| 21 | Greta Outdoor | 37-37 | Paolo Cattelan | Tavoli | 2 | 1 | 0 | 1 | ✓ | ✓ | ✓ | ✓ | 0.68 | ✓ | ✓ | ✓ |
| 22 | Magda Barrè Sgabello | 38-38 | Studio Kronos | Tavoli | 2 | 0 | 0 | 2 | ✓ | ✓ | ✓ | ✓ | 0.70 | ✓ | · | · |
| 23 | Baldwin | 39-44 | Maurizio Manzoni | Tavoli | 9 | 4 | 1 | 3 | ✓ | ✓ | ✓ | ✓ | 0.85 | ✓ | ✓ | ✓ |
| 24 | Gibson | 45-50 | Sergio Bicego | Tavoli | 8 | 5 | 0 | 2 | ✓ | ✓ | ✓ | ✓ | 0.85 | ✓ | ✓ | ✓ |
| 25 | Murphy | 51-53 | Maurizio Manzoni | Tavoli | 5 | 2 | 1 | 2 | ✓ | ✓ | ✓ | ✓ | 0.80 | ✓ | ✓ | ✓ |
| 26 | Margaret | 54-55 | Sergio Bicego | Tavoli | 4 | 2 | 1 | 1 | ✓ | ✓ | ✓ | ✓ | 0.79 | ✓ | ✓ | ✓ |
| 27 | Peggy | 56-57 | Castello Lagravine | Tavoli | 4 | 1 | 0 | 3 | ✓ | ✓ | ✓ | ✓ | 0.76 | ✓ | ✓ | ✓ |
| 28 | Baldwin | 58-58 | Maurizio Manzoni | Poltrone | 2 | 0 | 0 | 2 | ✓ | ✓ | ✓ | ✓ | 0.67 | ✓ | · | · |
| 29 | Giselle Lounge | 59-59 | Maurizio Manzoni | Tavoli | 2 | 1 | 0 | 1 | ✓ | ✓ | ✓ | ✓ | 0.72 | ✓ | ✓ | ✓ |
| 30 | Sierra Pouf | 60-60 | Studio Kronos | Tavoli | 1 | 0 | 1 | 0 | ✓ | ✓ | ✓ | ✓ | 0.69 | ✓ | ✓ | · |
| 31 | Matera | 61-62 | Studio 28 | Tavoli | 3 | 2 | 0 | 1 | ✓ | ✓ | ✓ | ✓ | 0.78 | ✓ | ✓ | ✓ |
| 32 | Standard | 63-64 | Paolo Cattelan | Tavoli | 3 | 1 | 0 | 2 | ✓ | ✓ | ✓ | ✓ | 0.81 | ✓ | ✓ | ✓ |
| 33 | Lagoon | 65-66 | Studio Kronos | Tavoli | 3 | 1 | 1 | 1 | ✓ | ✓ | ✓ | ✓ | 0.78 | ✓ | ✓ | ✓ |
| 34 | Bishop | 67-68 | Lorenzo Remedi | Tavoli | 4 | 2 | 0 | 0 | ✓ | ✓ | ✓ | ✓ | 0.83 | ✓ | ✓ | ✓ |
| 35 | Amalfi | 69-70 | Paolo Cattelan | Tavoli | 4 | 2 | 0 | 2 | ✓ | ✓ | ✓ | ✓ | 0.80 | ✓ | ✓ | ✓ |
| 36 | Felix | 71-71 | Studio Kronos | Divani | 2 | 1 | 0 | 1 | ✓ | ✓ | ✓ | ✓ | 0.71 | ✓ | ✓ | ✓ |
| 37 | Peninsula | 72-72 | Studio Kronos | Consolle | 2 | 1 | 0 | 0 | ✓ | ✓ | ✓ | ✓ | 0.67 | ✓ | ✓ | ✓ |
| 38 | Brio Keramik | 73-73 | Giorgio Cattelan | Consolle | 2 | 1 | 1 | 0 | ✓ | ✓ | ✓ | ✓ | 0.71 | ✓ | ✓ | ✓ |
| 39 | Chelsea | 74-74 | Alessio Bassan | Sedie | 2 | 1 | 1 | 0 | ✓ | ✓ | ✓ | ✓ | 0.72 | ✓ | ✓ | ✓ |
| 40 | Chelsea Drawers | 75-75 | Alessio Bassan | Sedie | 2 | 1 | 0 | 1 | ✓ | ✓ | ✓ | ✓ | 0.70 | ✓ | ✓ | ✓ |
| 41 | Address | 76-77 | Paolo Cattelan | Poltrone | 4 | 1 | 0 | 2 | ✓ | ✓ | ✓ | ✓ | 0.80 | ✓ | ✓ | ✓ |
| 42 | San Marco | 78-79 | Studio Kronos | Tavoli | 3 | 2 | 0 | 0 | ✓ | ✓ | ✓ | ✓ | 0.81 | ✓ | ✓ | ✓ |
| 43 | Wanted | 80-81 | STC Studio | Tavoli | 4 | 1 | 1 | 2 | ✓ | ✓ | ✓ | ✓ | 0.83 | ✓ | ✓ | ✓ |
| 44 | Potter | 82-82 | Andrea Marangoni | Tavoli | 2 | 0 | 1 | 0 | ✓ | ✓ | ✓ | ✓ | 0.68 | ✓ | ✓ | · |
| 45 | Pierre | 83-83 | Tosca Design | Tavoli | 2 | 1 | 0 | 1 | ✓ | ✓ | ✓ | ✓ | 0.70 | ✓ | ✓ | ✓ |
| 46 | Richard | 84-85 | Studio 28 | Tavoli | 3 | 1 | 2 | 0 | ✓ | ✓ | · | ✓ | 0.63 | · | ✓ | ✓ |
| 47 | Elias | 86-86 | Studio 28 | Letti | 2 | 0 | 1 | 1 | ✓ | ✓ | ✓ | ✓ | 0.72 | ✓ | ✓ | · |
| 48 | Kiran | 87-88 | Studio Kronos | Tavoli | 4 | 1 | 1 | 2 | ✓ | ✓ | ✓ | ✓ | 0.81 | ✓ | ✓ | ✓ |
| 49 | Nuove Finiture | 89-89 | — | Tavoli | 2 | 0 | 0 | 1 | ✓ | ✓ | · | ✓ | 0.46 | · | · | · |
| 50 | / Finishes | 90-90 | — | Divani | 3 | 0 | 0 | 2 | ✓ | ✓ | ✓ | ✓ | 0.60 | · | · | · |
| 51 | cattelanitalia.com | 91-91 | — | Divani | 0 | 0 | 0 | 0 | · | · | · | ✓ | 0.29 | · | · | · |
| 52 | Book 2026 Collection | 92-93 | — | Tavoli | 0 | 0 | 0 | 0 | · | ✓ | · | ✓ | 0.31 | · | · | · |
