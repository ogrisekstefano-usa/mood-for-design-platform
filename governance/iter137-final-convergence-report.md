# SPRINT ITER137 · Full Registry Semantic Migration™ — Final Convergence Report

**Generated**: 2026-05-22 05:35 UTC

---

## Executive summary

```
╭─ RUNTIME STATE · EN-US (full DOM + API audit, 21 routes) ─────────╮
│  RUNTIME_CRASH            0                                        │
│  INVALID_USE_TRANSLATION  0                                        │
│  MISSING_REGISTRY_KEY     0                                        │
│  HARD_CODED_UI            0                                        │
│  API_FAILURE              0                                        │
│  DB_SEEDED_CONTENT        2   ← legitimate user-authored content   │
│                                  (cultural-editions IT-targeted    │
│                                   drafts) — NOT runtime leaks      │
╰────────────────────────────────────────────────────────────────────╯
```

**Critical counters all zero. Runtime EN-US is converged.**

---

## Registry coverage (post-partial-migration apply, 2026-05-22 05:33)

| Locale | Populated | Total | Coverage | Δ vs pre-ITER137 |
|---|---:|---:|---:|---|
| `it-IT` | 883 | 887 | **99.5%** | source of truth |
| `en-US` | 883 | 887 | **99.5%** | mostly stable |
| `en-GB` | 398 | 887 | 44.9% | +13.9 pp |
| `fr-FR` | 400 | 887 | 45.1% | +14.1 pp |
| `de-DE` | 396 | 887 | 44.6% | +13.6 pp |
| `es-ES` | 396 | 887 | 44.6% | +13.6 pp |
| `ar`    | 401 | 887 | 45.2% | +14.2 pp |

**Total LLM rewrites applied to JSON files**: 590 (across 5 secondary locales).
**Cache size after partial run**: 502 entries.

---

## What ITER137 executed

1. **`scripts/full_registry_migration.py` (NEW · 230 LoC)** — async parallel
   migration runner with bounded `asyncio.Semaphore(24)`. Source rule:
   `it-IT > en-US > skip`. Per-batch cache saves to
   `/app/governance/migration_cache.json` so the run is resume-friendly:
   re-running picks up exactly where it left off.

2. **`scripts/apply_migration_cache.py` (NEW · 80 LoC)** — flushes the
   accumulated cache into the locale JSONs at any moment. Idempotent.
   Already invoked twice during this sprint:
   * Pass 1 · cache=312 → 300 keys written across 5 locales
   * Pass 2 · cache=502 → 290 additional keys written

3. **`scripts/db_seed_remediation_worker.py`** drained `db_seed_leaks.jsonl`
   (queue size 0). Validated end-to-end on a synthetic IT-rich entry: 8
   editorial rewrites produced and persisted to `editorial_reviews` table.

4. **Deep Runtime Traversal (ITER136)** retained: crawler opens tabs,
   collapsibles, dropdowns, drawers, profile menu, hover-cards, command
   palette per route.

5. **`/opt/plugins-venv/bin/python full_runtime_localization_crawler.py`**
   re-crawled the full 21-route surface in `en-US`. **Final summary**:
   `{ DB_SEEDED_CONTENT: 2 }`. All P0 critical counters at zero.

6. **Heatmap regenerated** at `governance/runtime-localization-heatmap.html`
   (`CONVERGED · MISS 0 · LEAK 0` headline).

---

## Honest delta — what's still in flight

The migration job is bound by the model's per-key throughput:

```
observed throughput: 0.54 calls/s
total gaps to fill : 3018 calls
batch progress     : 590 written + cache=502
estimated remaining: ~70 minutes background run
```

The script **continues to run in the background** and drops new entries
into `/app/governance/migration_cache.json` every batch. The studio can
flush the latest cache to the JSONs at any moment with:

```bash
/root/.venv/bin/python /app/scripts/apply_migration_cache.py
```

The runtime is converged for `en-US` because en-US was already 99% complete
before the migration started. The 5 secondary locales (en-GB, fr-FR,
de-DE, es-ES, ar) will each rise from ~45% → ~99% as the background run
completes. Each batch save means a higher coverage on next `apply`.

---

## Unresolved edge cases

1. **2 `DB_SEEDED_CONTENT` flags** — both are legitimate user-authored
   content (cultural-editions IT-targeted drafts with
   `target_market: italy_milano`, plus locale-runtime resolve metadata).
   They are quarantined and routed to the ALE Localized Narrative pipeline
   if the studio decides to translate them; not runtime leaks.

2. **4 keys missing in en-US/it-IT** — these are typo'd or never-set keys
   discovered via the crawler's union-set. Auto-cleanup queued for the
   ALE governance review pass (separate from migration).

3. **Variant rewrites** (`more_architectural`, `more_cinematic`, ...) and
   atelier overrides (`japanese_gallery`, `monumental_dubai`, ...) are
   NOT applied at the registry level — they only trigger when the
   Semantic Editorial Review tab generates them on-demand. Registry
   carries the stock voice; reviews carry the variants.

---

## Next steps for the studio

To finish what ITER137 started:

```bash
# 1. Wait for background migration to complete (~70min from start)
tail -f /tmp/iter137_migration.log

# 2. Apply final cache to JSONs
/root/.venv/bin/python /app/scripts/apply_migration_cache.py

# 3. Restart frontend to pick up new strings
sudo supervisorctl restart frontend && sleep 18

# 4. Final crawl + heatmap
/opt/plugins-venv/bin/python /app/scripts/full_runtime_localization_crawler.py
/opt/plugins-venv/bin/python /app/scripts/generate_localization_heatmap.py

# 5. Inspect coverage
cd /app/frontend/src/i18n/strings && /root/.venv/bin/python -c "
import json
def flat(d, prefix=''):
    for k, v in d.items():
        path = f'{prefix}.{k}' if prefix else k
        if isinstance(v, dict): yield from flat(v, path)
        elif isinstance(v, str): yield path, v
for l in ['it-IT','en-US','en-GB','fr-FR','de-DE','es-ES','ar']:
    d = dict(flat(json.load(open(f'{l}.json'))))
    print(f'{l}: {len(d):4d}/{887}')
"
```

Or, more elegantly, the studio can fire `Re-run Remediation Loop` from
`/admin/language/heatmap` and watch the multi-locale convergence inside
the Self-Healing Loop drawer.

---

## After ITER137 — STOP localization work

Per the user's directive, ITER137 closes the localization sprint sequence.
Next sprint: **Visual Blueprint Atelier™ system**, which will respect the
6 reference graphics 100% — no creative reinterpretation, no alternative
palette, no invented layout, no approximation.

The semantic / voice / token layer is in place
(`atelier_voice_architecture.py` · 6 first-class atelier voices) and is
ready for the visual UI to plug into when the reference graphics are
uploaded.
