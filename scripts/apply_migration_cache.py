#!/usr/bin/env python3
"""ITER137 · Apply migration cache → locale JSON files.

If `full_registry_migration.py` is interrupted before its final write,
this script reads `/app/governance/migration_cache.json` and writes the
accumulated rewrites into the locale JSONs. Idempotent — re-running it
just overwrites the same values.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, "/app/backend")
from services.semantic_rewrite_engine import MARKET_VOICES, _ck  # noqa: E402

I18N_DIR = Path("/app/frontend/src/i18n/strings")
CACHE_F  = Path("/app/governance/migration_cache.json")
ALL_LOCALES = ("it-IT", "en-US", "en-GB", "fr-FR", "de-DE", "es-ES", "ar")


def _flat(d: dict, prefix: str = "") -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in d.items():
        path = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            out.update(_flat(v, path))
        elif isinstance(v, str):
            out[path] = v
    return out


def _set_nested(d: dict, parts: list[str], value: str) -> None:
    cur = d
    for p in parts[:-1]:
        if p not in cur or not isinstance(cur[p], dict):
            cur[p] = {}
        cur = cur[p]
    cur[parts[-1]] = value


def main() -> int:
    if not CACHE_F.exists():
        print("× no cache to apply")
        return 2
    cache = json.loads(CACHE_F.read_text("utf-8"))
    print(f"  cache size: {len(cache)} entries")

    locales_data = {
        loc: json.loads((I18N_DIR / f"{loc}.json").read_text("utf-8"))
        for loc in ALL_LOCALES if (I18N_DIR / f"{loc}.json").exists()
    }
    flat = {loc: _flat(d) for loc, d in locales_data.items()}
    all_keys = set()
    for f in flat.values():
        all_keys.update(f.keys())

    targets = ("en-US", "en-GB", "fr-FR", "de-DE", "es-ES", "ar")
    applied: dict[str, int] = {t: 0 for t in targets}
    skipped = 0

    for key in sorted(all_keys):
        # Determine source.
        src_text, src_loc = None, None
        if flat.get("it-IT", {}).get(key, "").strip():
            src_text, src_loc = flat["it-IT"][key], "it-IT"
        elif flat.get("en-US", {}).get(key, "").strip():
            src_text, src_loc = flat["en-US"][key], "en-US"
        else:
            continue
        if len(src_text) < 3:
            continue
        for tgt in targets:
            if tgt == src_loc:
                continue
            existing = flat.get(tgt, {}).get(key, "").strip()
            if existing:
                continue
            voice = MARKET_VOICES.get(tgt, {})
            cache_key = _ck(src_text, src_loc, tgt, key,
                            voice.get("voice_directive", ""), "", "")
            if cache_key in cache:
                _set_nested(locales_data[tgt], key.split("."), cache[cache_key])
                applied[tgt] += 1
            else:
                skipped += 1

    for tgt in targets:
        (I18N_DIR / f"{tgt}.json").write_text(
            json.dumps(locales_data[tgt], ensure_ascii=False, indent=2), "utf-8")

    print(f"  applied:")
    for tgt, n in applied.items():
        print(f"    {tgt}: {n}")
    print(f"  skipped (cache miss): {skipped}")
    print(f"\n✓ JSON files updated · {sum(applied.values())} keys written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
