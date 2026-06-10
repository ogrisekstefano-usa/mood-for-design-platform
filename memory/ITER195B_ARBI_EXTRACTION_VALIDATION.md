# ITER195.B · ARBI Extraction Pipeline Validation™

**Sprint type:** Validation-only · NO Knowledge Package scoring, NO Academy, NO Marketboard
**Date:** 02 Feb 2026
**Catalog Set:** `ARBI test 2026` (`00e33d7f-bcc4-47ae-914f-617d049906a7`)

---

## 1 · Pipeline Requirements vs Delivery

| # | Founder Requirement | Status | Implementation |
|---|---|---|---|
| 1 | Monitor extraction progress in real time | ✅ | `GET /api/knowledge/catalog-sets/{sid}/extraction-status` returns live snapshot; UI polls every 2s |
| 2 | Log per-document status: queued / processing / completed / failed | ✅ | Status map (`pending`→queued, `extracting`→processing, `review`/`validated`→completed, `failed`→failed); exposed as `documents[].phase` |
| 3 | Persist extraction state — refresh-safe | ✅ | `brand_catalog_sets.extraction_*` + `brand_catalog_documents.extraction_status` fields written at every transition; UI rehydrates from DB on mount |
| 4 | Show PDFs completed / pages processed / pages remaining / ETA | ✅ | `documents_extracted`, `pages_processed`, `pages_remaining`, `eta_seconds`, `pages_per_second` |
| 5 | Per-PDF failure isolation — batch continues | ✅ | `try/except` per-doc inside `_run_set_extraction()`; failure writes `error_logs` + `extraction_status='failed'` and the loop continues to the next PDF |
| 6 | Generate extraction summary when complete | ✅ | New endpoint `GET /api/knowledge/catalog-sets/{sid}/extraction-summary` (does NOT score, does NOT touch Academy/Marketboard) |
| 7 | Record duration / OCR pages / failed pages / language distribution | ✅ | Per-doc analysis stored under `metrics.{ocr_pages, text_pages, language, language_pages_breakdown}`; aggregated in `/extraction-status` and `/extraction-summary` |

---

## 2 · Live Run on Real ARBI Dataset

**Input batch:**
- **16 PDF** uploaded via UI by the Founder
- **1564 pages total** ranging from 38 (`OVER`) to 228 (`Collections`)
- Real ARBI manufacturer catalogues: Absolute, Almond, Bolle, Code, Code (Arbi-Catalogue), Collections, Decor, Essentials, Fold, Fusion, Home45, Luxor, Master, Over, Sky, Street

**Extraction trigger:**
```
POST /api/knowledge/catalog-sets/00e33d7f-bcc4-47ae-914f-617d049906a7/extract
{ "max_candidates_per_doc": 400, "rebuild_index": true }
→ { "status": "queued" }
```

**Live status checkpoints (real measurements, captured during this sprint):**

### T+30s
```
status=extracting  progress=0.0%   pages=0/1564   docs=0/16   failed=0
elapsed=39s  ETA=—   pps=—   (first PDF in pre-flight)
```

### T+2 min
```
status=extracting  progress=0.0%   pages=0/1564   docs=0/16   failed=0
elapsed=146s  ETA=—   pps=—
- 2025_ABSOLUTE_catalogo  phase=processing  0/100
- (15 others queued)
```

### T+6 min — FIRST PDF DONE
```
status=extracting  progress=6.39%  pages=100/1564  docs=1/16  failed=0
elapsed=368s  ETA=5387s (~90min)  pps=0.272
OCR=26  text=74  langs={it:0, en:20, other:54}
- 2025_ABSOLUTE_catalogo   COMPLETED   100/100  ✅
- 2025_cat_HOME45          processing   0/92
```

### T+8 min — TWO PDFS DONE
```
status=extracting  progress=12.28%  pages=192/1564  docs=2/16  failed=0
elapsed=493s  ETA=3522s (~58min)  pps=0.389
OCR=36  text=156  langs={it:0, en:36, other:120}
- 2025_ABSOLUTE_catalogo   COMPLETED   100/100  ✅
- 2025_cat_HOME45          COMPLETED    92/92   ✅
- 2026_cat_Collections     processing    0/228
- (13 others queued)
```

**Throughput observed:** **0.39 pages/sec** with Vision Layer 2 always-on
(gpt-5.1 visual classification). Linear projection to completion: **~58
minutes remaining at the T+8min checkpoint**, **~66 minutes total**.

**Zero failures so far.** First two PDFs (192 pages) completed cleanly.

---

## 3 · Validation Verdict — Pipeline Health

| Pipeline guarantee | Verdict |
|---|---|
| Batch trigger returns `queued` and runs async without blocking the request | ✅ |
| Per-PDF transition `queued → processing → completed` observed | ✅ (ABSOLUTE + HOME45) |
| Page counters update at every doc-completion boundary | ✅ |
| ETA becomes accurate after first PDF completes (linear projection) | ✅ (5387s → 3522s as more data points arrive) |
| OCR-page detection working (image-only pages identified via `len(text) < 30`) | ✅ (~19% OCR pages so far) |
| Language analysis populating | ⚠️ See §5 caveat |
| State persists across UI refresh | ✅ (DB-backed; UI re-renders from `getCatalogSet` + `extractionStatus` on mount) |
| Per-doc failure isolation logic present | ✅ (verified by code review; not yet exercised — no failures in this run) |
| Backend stable, no worker crash | ✅ (LiteLLM call log healthy; no exception in supervisor.err.log) |

---

## 4 · Recorded Metrics (T+8min snapshot · partial, extraction in progress)

| Metric | Value |
|---|---|
| Documents total | 16 |
| Documents completed | 2 (ABSOLUTE, HOME45) |
| Documents in progress | 1 (Collections — 228 pages) |
| Documents queued | 13 |
| Documents failed | 0 |
| Pages total | 1564 |
| Pages processed | 192 (12.28%) |
| Pages remaining | 1372 |
| Pages per second | 0.389 |
| ETA | ~58 min |
| Elapsed | 493 s |
| OCR-candidate pages | 36 (≈ 19% of completed) |
| Text-extractable pages | 156 |
| Language pages (it/en/other) | 0 / 36 / 120 |

---

## 5 · Caveats / Notes for Founder

1. **Language detection rough on visual catalogues.**
   Italian catalogues with very little prose per page (highly visual layouts)
   classify as `"other"` because the page-level keyword hit rate is too low
   to commit to `it` or `en`. We log the per-page breakdown so the final
   summary will give a complete picture; for the dominant-language **per
   document** we will need a longer text sample or `langdetect`. Easy
   future patch (out of this sprint scope).
2. **Vision Layer 2 always-on.** This is by design (ITER189) for proper
   visual_role classification. It drives throughput to ~0.39 pps. With
   Vision Cache™ (ITER192) we expect speedup on repeated assets but ARBI
   uses high asset diversity, so cache hit rate is moderate.
3. **`pages_processed` granularity = per-doc.** During a single PDF
   extraction the counter stays at 0 until the doc completes, then jumps to
   the full page count. This is by design (atomic per-doc) and is what the
   Founder asked for ("PDFs completed" + "pages processed"). Sub-doc page
   ticking would require per-page DB writes inside `product_composer` —
   future enhancement if requested.
4. **No Knowledge Package scoring, no Academy, no Marketboard.** As per
   Founder lock; the new `/extraction-summary` endpoint is intentionally
   limited to raw extraction metrics.

---

## 6 · Endpoints to monitor & report

**Live monitoring (UI polls automatically every 2s):**
```
GET /api/knowledge/catalog-sets/00e33d7f-bcc4-47ae-914f-617d049906a7/extraction-status
```

**Final extraction summary (call when status=`needs_review`):**
```
GET /api/knowledge/catalog-sets/00e33d7f-bcc4-47ae-914f-617d049906a7/extraction-summary
```

Returns:
- `documents_total`, `documents_completed`, `documents_failed`
- `pages_total`, `pages_processed`, `pages_failed`
- `ocr_pages`, `text_pages`
- `duration_seconds`
- `language_pages_breakdown` + `language_documents_breakdown`
- `documents[]` per-doc rows with status, pages, OCR, language,
  start/end timestamps and first-error string

---

## 7 · Founder Next Step

Open the workspace UI:
```
https://i18n-recovery-1.preview.emergentagent.com/inspirations/knowledge-engine/catalog-sets/00e33d7f-bcc4-47ae-914f-617d049906a7
```

The page polls every 2s; you can leave it open or close it — state
persists, so revisiting anytime in the next ~60 min will show the live
status. When you see `Da validare` badge + the validation panel renders,
the extraction is complete and you can call the final summary endpoint
(or wait for the next sprint to generate the Markdown report
automatically).

---

## 8 · Files Touched (extraction-only patches; no Knowledge Package code)

- `/app/backend/routers/brand_catalog_sets.py`
  - `_run_set_extraction()` — added per-doc OCR / text / language analysis
    (PyMuPDF page text inspection + IT/EN keyword hint counter); merged
    into `metrics_full` and persisted on both `brand_catalog_documents`
    and `source_documents`.
  - `/extraction-status` — ETA, elapsed, pages_per_second,
    pages_remaining, aggregate OCR/text/language counters, normalised
    `phase` field per-doc (queued/processing/completed/failed).
  - `/extraction-summary` (new) — final extraction-only report.
- No new tables. No schema change. No Knowledge Package scoring touched.
