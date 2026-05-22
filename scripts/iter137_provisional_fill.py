#!/usr/bin/env python3
"""ITER137 · Provisional EN→other-locale fill for the 5 non-canonical locales.

After canonical authoring (it-IT, en-US), this script populates en-GB / fr-FR /
de-DE / es-ES / ar with the **EN-US text as a provisional value** for any key
that is currently empty. These entries are flagged for semantic rewrite once
the Universal Key budget is refilled. Idempotent — non-empty values are
preserved.
"""
from __future__ import annotations
import json
from pathlib import Path

I18N = Path("/app/frontend/src/i18n/strings")
ALL_LOCALES = ("it-IT", "en-US", "en-GB", "fr-FR", "de-DE", "es-ES", "ar")
TARGETS = ("en-GB", "fr-FR", "de-DE", "es-ES", "ar")


def flat(d, p=""):
    out = {}
    for k, v in d.items():
        path = f"{p}.{k}" if p else k
        if isinstance(v, dict): out.update(flat(v, path))
        elif isinstance(v, str): out[path] = v
    return out


def set_nested(d, parts, value):
    cur = d
    for p in parts[:-1]:
        if p not in cur or not isinstance(cur[p], dict):
            cur[p] = {}
        cur = cur[p]
    cur[parts[-1]] = value


data = {l: json.loads((I18N / f"{l}.json").read_text("utf-8"))
        for l in ALL_LOCALES if (I18N / f"{l}.json").exists()}
flats = {l: flat(d) for l, d in data.items()}
en_us = flats["en-US"]

for tgt in TARGETS:
    n = 0
    for key, en_text in en_us.items():
        existing = flats.get(tgt, {}).get(key, "").strip()
        if existing:
            continue
        if not en_text.strip():
            continue
        # Skip very short technical strings (<3 chars).
        if len(en_text) < 3:
            continue
        try:
            set_nested(data[tgt], key.split("."), en_text)
            n += 1
        except Exception as exc:
            # skip conflict
            print(f"  ! conflict {key} on {tgt}: {exc}")
    (I18N / f"{tgt}.json").write_text(
        json.dumps(data[tgt], ensure_ascii=False, indent=2), "utf-8")
    print(f"  ✓ {tgt}: {n} keys filled from EN-US (provisional)")

print("\n✓ provisional fill complete — flag for semantic rewrite on next budget refill")
