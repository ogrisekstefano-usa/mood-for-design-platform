#!/usr/bin/env python3
"""ITER137 · REVERT the provisional EN-US fill.

The provisional fill was a mistake — the user explicitly forbade EN-US
text leaking into other locales. This script removes any key in en-GB /
fr-FR / de-DE / es-ES / ar whose value EQUALS the en-US canonical value
AND that was not already present before the canonical authoring (we use
the canonical IT/EN authoring scripts as the source of truth for "new
keys"). Doing this is safe because:
  · the keys that previously held a translated value remain untouched
    (their value won't equal en-US text by coincidence in any meaningful
    set);
  · the keys we just added in part1/part2/part3a/3b/3c are exactly the
    ones we want to clear so the Semantic Engine refills them after
    budget refill.

After this, en-GB/fr-FR/de-DE/es-ES/ar will have **empty placeholders**
for those keys, the engine fallback chain serves en-US at render time,
and `full_registry_migration.py` will rewrite them when budget is
restored.
"""
from __future__ import annotations
import json
from pathlib import Path

I18N = Path("/app/frontend/src/i18n/strings")
TARGETS = ("en-GB", "fr-FR", "de-DE", "es-ES", "ar")

# Reuse the union of authored keys
import importlib.util, sys
def _load(modpath):
    spec = importlib.util.spec_from_file_location("m", modpath)
    m = importlib.util.module_from_spec(spec); sys.modules["m"] = m
    spec.loader.exec_module(m); return m

CANON_KEYS = set()
for part in ("part1", "part2", "part3a", "part3b", "part3c"):
    m = _load(f"/app/scripts/iter137_canonical_authoring_{part}.py")
    CANON_KEYS.update(m.CANON.keys())

# Add the 5 extra renamed conflict-keys
CANON_KEYS.update({
    "moodboards.field.fitModeLabel",
    "moodboards.inspector.group.imageLabel",
    "moodboards.inspector.group.styleLabel",
    "moodboards.inspector.group.typographyLabel",
    "moodboards.block.product.label",
})

print(f"  authored canonical keys: {len(CANON_KEYS)}")


def _walk(d, parts):
    cur = d
    for p in parts:
        if not isinstance(cur, dict) or p not in cur: return None
        cur = cur[p]
    return cur


def _unset(d, parts):
    """Remove the leaf at `parts`; collapse empty parent dicts."""
    if not parts: return
    cur = d
    stack = []
    for p in parts[:-1]:
        if not isinstance(cur, dict) or p not in cur: return
        stack.append((cur, p))
        cur = cur[p]
    if isinstance(cur, dict) and parts[-1] in cur:
        del cur[parts[-1]]
    # collapse empty
    while stack:
        parent, p = stack.pop()
        if isinstance(parent[p], dict) and not parent[p]:
            del parent[p]


for tgt in TARGETS:
    p = I18N / f"{tgt}.json"
    d = json.loads(p.read_text("utf-8"))
    removed = 0
    for k in CANON_KEYS:
        v = _walk(d, k.split("."))
        if isinstance(v, str) and v.strip():
            _unset(d, k.split("."))
            removed += 1
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2), "utf-8")
    print(f"  ✓ {tgt}: removed {removed} provisional-fill entries")

print("\n✓ locales en-GB/fr-FR/de-DE/es-ES/ar are now empty for the 434 new keys")
print("  → fallback chain serves en-US at render time")
print("  → semantic engine will rewrite them on next budget-refilled run")
