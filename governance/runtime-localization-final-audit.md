# Runtime Localization — Final Audit (ITER131)

**Date:** 2026-02-21
**Locale tested:** `en-US`
**Routes crawled:** 20 (live, authenticated, drawer/tab-interacted)
**Verification mode:** **RUNTIME** Playwright crawl of the rendered DOM. No
grep, no AST, no static manifest counts.

---

## Final score

| Category                   | Count |
|----------------------------|------:|
| HARD_CODED_UI              | **0** |
| RUNTIME_CRASH              | **0** |
| MISSING_REGISTRY_KEY       | **0** |
| INVALID_USE_TRANSLATION    | **0** |
| MIXED_LANGUAGE (chrome)    | **0** |
| DB_SEEDED_CONTENT          | 37    |
| EDITORIAL_SEED_BY_DESIGN   | 5     |

EN-US chrome surfaces: **clean**. Every interactive surface, header, side
panel, error toast and empty state was inspected at runtime in an EN-US
session and zero Italian fragments survived.

The 37 DB_SEEDED_CONTENT items are user content stored in the database
(inspirations, cultural editions, presence stream entries, brand cards,
moodboard tiles). They were authored in Italian as seed data and are
**not chrome bugs** — they need ALE-on-read translation, scheduled for
the next sprint.

The 5 EDITORIAL_SEED_BY_DESIGN items are Translation Memory rows and
Vocabulary entries that **must** display the source Italian — that is
the entire point of the inspector. They are excluded from leak counts.

---

## What was fixed during this sprint

1. **4 runtime crashes resolved** (`t is not a function`):
   * `CrmAccountsPage` — `AccountCard`, `NewAccountModal`, `FollowUpsList`
     and the page root were calling `t(...)` without destructuring
     `useT()`. All four functions now own their own `t` reference.
   * `BrandModePage` — same pattern, fixed.
   * `MoodboardsPage / MoodboardCard` — fixed by destructuring `t` from
     `useBlueprint()` inside the card.
2. **CRM empty state** — `crm-empty-state` four-line Italian block
   (eyebrow, lead, hint, CTA) refactored to `t('crm.crm_accounts.*')`.
3. **Studio Voice page chrome** — eyebrow, lede, three Section
   titles/ledes, the "active" badge, the "Add a term" header, and the
   "Add" button were all hardcoded Italian → now English with the IT
   variant available in `summary_it` for the backend payload.
4. **Backend payload localization** —
   `services/studio_voice.LANGUAGE_DNA_PRESETS` now carries both
   `summary` (English, default) and `summary_it` (Italian); the
   `/api/voice/presets` endpoint reads `Accept-Language` and serves the
   right variant.
5. **Cultural Editions list** — page lede & "New edition" button moved
   to the registry with English defaults.
6. **Moodboards archive banner** — eyebrow, lede, CTA and the page
   eyebrow moved to the registry.
7. **Language Command Center** — admin chrome rewritten in English
   (governance lede, stats labels, leakage section title/lede/empty
   state copy).
8. **Material View** — "Materialità" filter label routed through `t()`.
9. **Inspirations Archive errors** — backend HTTPException details
   (`Riferimento non trovato`, `Impossibile salvare`, `target_type non
   riconosciuto`, `Impossibile creare la relazione`) converted to
   neutral English so EN-US toasts never carry Italian.
10. **175 short-label IT leaks** in `en-US.json` (single-marker labels
    like "Chiudi", "Aggiungi", "Riprova" that the previous bulk
    translator skipped) re-authored through ALE + Studio Voice™ via
    `iter131_short_label_rescue.py`.

---

## Tooling delivered

* `/app/scripts/iter131_runtime_crawler.py` — sync-Playwright crawler.
  Authenticates, visits every operational route in the chosen locale,
  drives tab interactions, harvests DOM with a leak classifier
  (HARD_CODED_UI / DB_SEEDED_CONTENT / EDITORIAL_SEED_BY_DESIGN /
  MISSING_REGISTRY_KEY / INVALID_USE_TRANSLATION / RUNTIME_CRASH),
  writes JSON + Markdown reports and per-route JPEG screenshots.
* `/app/backend/scripts/iter131_short_label_rescue.py` — short-label
  rescue pass that re-translates single-marker IT leaks.

---

## Generated artefacts

* `/app/governance/runtime-localization-report.json`
* `/app/governance/runtime-localization-remediation.md`
* `/app/governance/runtime-localization-screenshots/` (20 JPEGs)
* `/app/governance/runtime-localization-final-audit.md` (this file)

---

## Next sprint — DB-seeded content

The remaining 37 DB_SEEDED_CONTENT items live in three buckets:

| Bucket                | Count | Recommended treatment |
|-----------------------|------:|-----------------------|
| `inspiration-card-*`  | 14    | ALE-on-read with TM cache; backend wraps title/description through `relational_translation.translate(...)` when `Accept-Language` ≠ `it`. |
| `ce-row-*`            | 2     | Same ALE-on-read pattern at `/api/cultural-editions/drafts`. |
| `jp-journey/voice/action-*` | 6 | Presence-stream entries are AI-generated — feed them into ALE at write time and store both locales. |
| `bm-card-*` / `bm-materials-*` | 7 | Brand-atlas seeds — same ALE-on-read treatment, or accept that maker-authored Italian copy stays Italian (it is the maker's own voice). |
| `moodboard-card-*`    | 8     | Moodboard titles are user-authored; the simplest fix is to **not** translate them (user content), but show a localized `(translate)` toggle. |

These are intentionally left for the next sprint so that this audit can
be closed honestly: chrome = clean, user content = catalogued.

---

## How to re-run

```bash
/opt/plugins-venv/bin/python3 /app/scripts/iter131_runtime_crawler.py
# or override locale / credentials:
LOCALE=fr-FR /opt/plugins-venv/bin/python3 /app/scripts/iter131_runtime_crawler.py
```

The crawler will emit the four artefacts above and exit 0 when the
chrome leak count is zero.
