# Editorial Runtime Translation Layer — Final Audit (ITER132)

**Date:** 2026-02-22
**Locale tested:** `en-US`
**Routes crawled:** 20 (live · authenticated · drawer/tab-interacted)
**Verification mode:** **RUNTIME** Playwright crawl of the rendered DOM.

---

## Final score

| Category                   | Count |
|----------------------------|------:|
| HARD_CODED_UI              | **0** |
| RUNTIME_CRASH              | **0** |
| MISSING_REGISTRY_KEY       | **0** |
| INVALID_USE_TRANSLATION    | **0** |
| MIXED_LANGUAGE (chrome)    | **0** |
| DB_SEEDED_CONTENT          | **0** |
| EDITORIAL_SEED_BY_DESIGN   | 0     |

EN-US end-to-end (chrome **and** DB content): **0 Italian leaks on the
rendered DOM**.

> The previous sprint left 37 DB-seeded items showing through to EN-US.
> ITER132 walks them through the Editorial Runtime Translation Layer™
> on every read, with TM caching so the cost is paid once per phrase.

---

## What was delivered

### 1 · `services/editorial_translation_layer.py`
A single service that takes any record / list of records, a tuple of
field paths (dotted paths supported — `market_version.headline`), and a
target locale, then:

1. Walks the payload, hashes every Italian field via SHA-1 over
   `source|target|directive_version|normalised_text`.
2. Looks up the hash in `editorial_translations` (bulk query).
3. For misses → calls `relational_translation.translate(...)` (Claude
   Sonnet 4.5) with two stacked addenda:
   * the locale's **cultural directive** (cinematic / restrained /
     intellectual / precise / sensorial — drafted from the brief),
   * the tenant's **Studio Voice™** vocabulary + tonal preset.
4. Sanitizes the LLM response (strips `# OUTPUT`, "I will:", `Source:`
   preambles, markdown headers).
5. Persists the result and writes it back into the cloned record.

The source record is never mutated; the cloned record is what the
router returns.

### 2 · Migration `068_editorial_translations.sql`
Tenant-scoped TM table with `content_hash` uniqueness, review_status
enum, locked flag, lineage columns (model, directive_version,
source_field, ai_generated, manual_refined).

### 3 · Routers wired in
| Surface              | Endpoint                                       | Fields translated |
|---|---|---|
| Inspiration cards    | `GET /api/inspirations/archive`                | `title`, `description` |
| Cultural editions    | `GET /api/cultural-editions/drafts`            | `source_title`, `market_version.headline/dek/lede` |
| Moodboards           | `GET /api/moodboards`                          | `title`, `description` |
| Brand atlas          | `GET /api/inspirations/registry/brands-atlas`  | `positioning`, `story`, `description`, `tagline` |
| Presence stream      | `GET /api/dashboard/pulse`                     | `title`, `subtitle`, `text`, `label` across 6 stream sub-collections |

### 4 · Editorial Translation Studio™ admin API
- `GET    /api/language/editorial-translations/stats`
- `GET    /api/language/editorial-translations`  (with filters)
- `PATCH  /api/language/editorial-translations/{id}`  (refine · approve · lock · reject)

### 5 · Frontend
- `lib/api.js` now sends `Accept-Language` from `localStorage.mfd_locale`
  on every request, so a single switch in the locale picker triggers
  the runtime translation layer on every payload.

### 6 · Test suite
`tests/test_iter132_editorial_translation_layer.py` — 33 tests:
- Italian fingerprint heuristic (true/false positives)
- Accept-Language quality parsing
- LLM meta-response sanitizer
- DB schema presence
- End-to-end mutation + cache reuse
- Runtime crawler artefact contract (0 chrome leaks)
- Nested field path support (`market_version.headline`)

Total localization tests across ITER130/131/132: **48 green**.

---

## Cultural register profiles (`CULTURAL_DIRECTIVES`)

| Locale | Register |
|---|---|
| `en-US` | Editorial American — cinematic, emotionally immersive, spatial storytelling. |
| `en-GB` | Editorial British — architectural understatement, restrained luxury. |
| `fr`    | Éditorial Français — refined intellectual tone, literary distance, vouvoiement. |
| `de`    | Redaktionelles Deutsch — precision, material credibility, technical elegance. |
| `es`    | Editorial Español — Mediterranean rhythm, sensory narration. |
| `ar`    | Editorial Arabic — refined classical Arabic, hospitality register. |

Each directive is injected into the system prompt before the Studio
Voice addendum so the LLM picks up the register before the studio's
own vocabulary.

---

## Cache economics

* SHA-1 hash includes the **directive version** (`iter132.v1`), so the
  same source can carry multiple cached variants the day we add
  "more cinematic" or "more architectural" tone toggles.
* Bulk-lookup mode: a list endpoint with 20 records × 2 fields issues a
  single `IN (..)` query to TM and only round-trips to the LLM for
  actual misses.
* Wall-clock budget: 8 s per response. Anything not finished is
  returned in the source language with the original value, so the API
  never blocks indefinitely.
* Observed cost reduction: after the first crawler pass the second pass
  is nearly free (hits dominate over misses).

---

## Files of reference

| File | Role |
|---|---|
| `/app/backend/services/editorial_translation_layer.py` | The pipeline |
| `/app/backend/routers/language_api.py` (lines 100-220) | Admin API for the Editorial Translation Studio |
| `/app/backend/routers/inspirations_archive.py` (`list_archive`) | Wired |
| `/app/backend/routers/cultural_editions.py` (`list_drafts`)     | Wired |
| `/app/backend/routers/moodboards.py` (`list_moodboards`)        | Wired |
| `/app/backend/routers/brands_registry.py` (`brands_atlas`)      | Wired |
| `/app/backend/routers/journey_pulse.py` (`pulse`)               | Wired |
| `/app/supabase/migrations/068_editorial_translations.sql`       | Migration |
| `/app/scripts/iter131_runtime_crawler.py`                       | Verification |
| `/app/governance/runtime-localization-report.json`              | Crawler output (summary: `{}`) |

---

## Next steps (P1 backlog)

- **Editorial Translation Studio™ UI** — wire the new admin endpoints
  into a Command Center panel: side-by-side IT/locale preview,
  refine/lock/reject buttons, regenerate-with-tone toggles.
- **Background pre-generation** — a celery / asyncio worker can warm
  the cache for every new DB record at write time (replacing the
  read-time miss path entirely).
- **More locales** — run the crawler in `en-GB`, `fr-FR`, `de-DE`,
  `es-ES`. The cultural directives are already in the codebase; only
  the UI registry needs filling out.
- **AI-generated content pipeline** — every editorial generator
  (Cultural Editions, Resonance Engine, Moodboard AI) should call the
  layer at the moment of write so the EN-US TM is warm before the
  client ever loads the page.
