#!/usr/bin/env python3
"""ITER136 · DB Seed Remediation Worker.

Drains `/app/governance/db_seed_leaks.jsonl` (the queue the runtime
crawler appends to whenever a backend payload contains Italian markers),
runs every URL through the Semantic Rewrite Engine for all 7 locales,
and persists results into the editorial_translations equivalent — the
`editorial_reviews` table we already use for governance memory.

This worker is conservative: it does NOT mutate the DB seeds in place.
It records semantic rewrites tagged `db_seed_quarantine` so the editorial
team can approve/lock them via the Semantic Editorial Review tab; the
ALE editorial layer at API render-time can then promote approved
rewrites to user-facing copy on subsequent reads.

USAGE:

    /opt/plugins-venv/bin/python /app/scripts/db_seed_remediation_worker.py \
        --limit 10 [--dry-run]

OUTPUT:

    /app/governance/db_seed_remediation_report.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, "/app/backend")
from services.semantic_rewrite_engine import (  # noqa: E402
    semantic_rewrite, ALL_LOCALES,
)
from services.editorial_review_memory import upsert_review  # noqa: E402

GOV       = Path("/app/governance")
QUEUE     = GOV / "db_seed_leaks.jsonl"
PROCESSED = GOV / "db_seed_leaks.processed.jsonl"
REPORT    = GOV / "db_seed_remediation_report.json"


# A short editorial markdown extractor — pulls the most "promising"
# Italian-heavy phrase from an opaque JSON payload by ranking on Italian
# marker density. We only take the top-scoring 1–2 phrases per leak so
# we don't burn LLM budget on JSON keys or UUIDs.
IT_MARKERS = re.compile(
    r"\b(il|lo|la|gli|le|della|dello|delle|degli|alla|alle|nella|nelle|nel|del|sul|"
    r"dal|tuoi|tue|tuo|tua|nostro|nostra|atelier|moodboard|atmosfera|materico|"
    r"materialit[aà]|cliente|progetto|ispirazione|narrazione|geometria)\b",
    re.IGNORECASE,
)


def _extract_phrases(body_excerpt: str, max_phrases: int = 2) -> list[str]:
    """Pull the highest-ranked Italian phrases from a payload excerpt."""
    if not body_excerpt:
        return []
    # Heuristic: split on common JSON delimiters, keep substrings of
    # reasonable length, score by marker density.
    candidates: list[tuple[int, str]] = []
    for chunk in re.split(r'[",{}\[\]]+', body_excerpt):
        s = chunk.strip()
        if 8 < len(s) < 240:
            score = len(IT_MARKERS.findall(s))
            if score >= 2:
                candidates.append((score, s))
    candidates.sort(key=lambda x: (-x[0], len(x[1])))
    seen, out = set(), []
    for _, phrase in candidates:
        sig = phrase.lower()[:80]
        if sig in seen:
            continue
        seen.add(sig)
        out.append(phrase)
        if len(out) >= max_phrases:
            break
    return out


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=10,
                        help="Max queue rows to process (default 10).")
    parser.add_argument("--dry-run", action="store_true",
                        help="Run engine but don't persist to editorial_reviews.")
    parser.add_argument(
        "--locales", default=",".join(ALL_LOCALES),
        help="Comma-separated target locales (default: all 7).",
    )
    args = parser.parse_args()

    if not QUEUE.exists():
        print(f"× queue empty: {QUEUE}")
        return 0

    targets = [loc.strip() for loc in args.locales.split(",") if loc.strip()]
    rows = QUEUE.read_text("utf-8").strip().split("\n")
    rows = [r for r in rows if r.strip()]
    print(f"╭─ DB seed worker · {len(rows)} queued · processing up to {args.limit}")
    print(f"│  targets: {targets}")
    print(f"│  dry_run: {args.dry_run}")
    print(f"╰─ {_now_iso()}")

    processed: list[dict] = []
    rewrites_count = 0

    for raw in rows[:args.limit]:
        try:
            entry = json.loads(raw)
        except Exception:
            continue
        page = entry.get("page", "?")
        url  = entry.get("url",  "?") or "—"
        # The crawler quarantine queue stores two shapes:
        #  · API-payload leaks: {url, body_excerpt, ...}
        #  · DOM IT-leak (UUID testid): {text, testid, ...}
        body = entry.get("body_excerpt") or ""
        dom_text = entry.get("text") or ""
        candidates = list(_extract_phrases(body))
        if dom_text and 8 < len(dom_text) < 240 and len(IT_MARKERS.findall(dom_text)) >= 1:
            candidates.append(dom_text)
        # De-dupe.
        seen = set()
        phrases: list[str] = []
        for ph in candidates:
            sig = ph.lower()[:80]
            if sig in seen:
                continue
            seen.add(sig)
            phrases.append(ph)
        if not phrases:
            print(f"  · {page} {url}  → no editorial phrases extracted")
            processed.append({**entry, "status": "skipped_no_phrases"})
            continue

        for ph in phrases:
            registry_key = f"db_seed::{page}::{abs(hash(ph)) & 0xffff:x}"
            print(f"  · {page} :: extracting «{ph[:80]}»")
            for tgt in targets:
                r = semantic_rewrite(
                    source_text=ph, source_locale="it-IT",
                    target_locale=tgt, key=registry_key,
                    market_context={"audience": "studio_owners",
                                    "luxury_tier": "ultra_luxury"},
                    use_cache=True,
                )
                rewrites_count += 1
                if not args.dry_run:
                    upsert_review(
                        registry_key=registry_key,
                        target_locale=tgt,
                        source_text=ph, source_locale="it-IT",
                        rewrite_text=r.text,
                        rationale=(r.rationale or "") + " · db_seed_quarantine",
                        model=r.model,
                        status="pending",
                        actor="db_seed_worker",
                    )
                tag = "↻" if r.cached else ("⚠" if r.fallback else "✓")
                print(f"      {tag} {tgt:6s} {r.duration_ms:5d}ms  «{r.text[:80]}»")
        processed.append({**entry, "status": "remediated",
                          "phrases": len(phrases)})

    REPORT.write_text(json.dumps({
        "ran_at": _now_iso(),
        "queue_size": len(rows),
        "processed": len(processed),
        "rewrites": rewrites_count,
        "dry_run": args.dry_run,
        "items": processed,
    }, indent=2, ensure_ascii=False), "utf-8")

    if not args.dry_run:
        # Move processed rows to .processed.jsonl so we don't re-handle them.
        remaining = "\n".join(rows[args.limit:])
        if remaining:
            QUEUE.write_text(remaining + "\n", "utf-8")
        else:
            QUEUE.write_text("", "utf-8")
        with PROCESSED.open("a", encoding="utf-8") as fh:
            for p in processed:
                fh.write(json.dumps(p, ensure_ascii=False) + "\n")

    print(f"\n✓ done · {rewrites_count} editorial rewrites generated · "
          f"report at {REPORT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
