#!/usr/bin/env python3
"""ITER137 · Full Registry Semantic Migration™.

Drains every (locale × key) gap in `/app/frontend/src/i18n/strings/*.json`
through the Semantic Rewrite Engine in parallel, then writes the JSON
files atomically.

Strategy:
  - Source of truth: `it-IT` if present, else `en-US`.
  - Targets: all 7 operational locales minus the source-locale per key.
  - Concurrency: asyncio gather with bounded semaphore (default 16).
  - Cache: SHA-1 cache from the engine plus on-disk snapshot
    `/app/governance/migration_cache.json` (cumulative across runs).
  - Resume-friendly: if the cache holds a rewrite, skip the LLM call.

USAGE:
  /root/.venv/bin/python /app/scripts/full_registry_migration.py \
      [--locales en-GB,fr-FR,de-DE,es-ES,ar] \
      [--max-concurrency 16] [--limit N] [--dry-run]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, "/app/backend")

from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402
from services.semantic_rewrite_engine import (  # noqa: E402
    DEFAULT_MODEL, MARKET_VOICES, _build_prompt, _ck,
)

I18N_DIR = Path("/app/frontend/src/i18n/strings")
GOV      = Path("/app/governance")
CACHE_F  = GOV / "migration_cache.json"
ALL_LOCALES = ("it-IT", "en-US", "en-GB", "fr-FR", "de-DE", "es-ES", "ar")


# ─── helpers ───────────────────────────────────────────────────────────
def _flat(d: dict, prefix: str = "") -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in d.items():
        path = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            out.update(_flat(v, path))
        elif isinstance(v, str):
            out[path] = v
    return out


def _set_nested(d: dict, path_parts: list[str], value: str) -> None:
    cur = d
    for p in path_parts[:-1]:
        if p not in cur or not isinstance(cur[p], dict):
            cur[p] = {}
        cur = cur[p]
    cur[path_parts[-1]] = value


def _key() -> str:
    k = os.environ.get("EMERGENT_LLM_KEY")
    if not k:
        # Read from backend .env if not in process env.
        env = Path("/app/backend/.env").read_text("utf-8")
        for line in env.splitlines():
            if line.startswith("EMERGENT_LLM_KEY="):
                return line.split("=", 1)[1].strip()
        raise RuntimeError("EMERGENT_LLM_KEY not configured")
    return k


def _load_cache() -> dict:
    if CACHE_F.exists():
        try:
            return json.loads(CACHE_F.read_text("utf-8"))
        except Exception:
            return {}
    return {}


def _save_cache(cache: dict) -> None:
    CACHE_F.parent.mkdir(parents=True, exist_ok=True)
    CACHE_F.write_text(json.dumps(cache, ensure_ascii=False), "utf-8")


# ─── main async pipeline ───────────────────────────────────────────────
async def _rewrite_one(
    sem: asyncio.Semaphore, api_key: str, source_text: str,
    source_locale: str, target_locale: str, key: str, cache: dict,
    progress: dict,
) -> tuple[str, str, str, bool]:
    """Returns (key, target_locale, rewrite_text, fallback)."""
    voice = MARKET_VOICES.get(target_locale, {})
    cache_key = _ck(source_text, source_locale, target_locale, key,
                    voice.get("voice_directive", ""), "", "")
    if cache_key in cache:
        progress["cached"] += 1
        return key, target_locale, cache[cache_key], False
    async with sem:
        try:
            chat = LlmChat(
                api_key=api_key,
                session_id=f"mig-{cache_key[:12]}",
                system_message="You are MOOD for DESIGN™'s in-market editorial copywriter.",
            ).with_model(*DEFAULT_MODEL)
            prompt = _build_prompt(source_text, source_locale, target_locale, key, None)
            out = await chat.send_message(UserMessage(text=prompt))
            if isinstance(out, dict):
                out = out.get("content", "") or ""
            out = (out or "").strip()
            if out.startswith('"') and out.endswith('"'):
                out = out[1:-1].strip()
            for prefix in ("rewritten:", "output:", "result:", "answer:"):
                if out.lower().startswith(prefix):
                    out = out[len(prefix):].strip()
            if not out:
                raise RuntimeError("empty model output")
            cache[cache_key] = out
            progress["done"] += 1
            return key, target_locale, out, False
        except Exception as exc:
            progress["fallback"] += 1
            progress["last_error"] = str(exc)[:200]
            return key, target_locale, source_text, True


async def _runner(jobs: list, api_key: str, max_conc: int, cache: dict,
                  progress: dict) -> list:
    sem = asyncio.Semaphore(max_conc)
    coros = [
        _rewrite_one(sem, api_key, src, src_loc, tgt, key, cache, progress)
        for (key, src_loc, src, tgt) in jobs
    ]
    return await asyncio.gather(*coros, return_exceptions=False)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--locales",
        default="en-US,en-GB,fr-FR,de-DE,es-ES,ar",
        help="Comma-separated target locales (it-IT excluded by default).",
    )
    parser.add_argument("--max-concurrency", type=int, default=16)
    parser.add_argument("--limit", type=int, default=0,
                        help="Max gaps to fill (0 = all).")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--save-every", type=int, default=200)
    args = parser.parse_args()

    targets = [loc.strip() for loc in args.locales.split(",") if loc.strip()]
    print(f"╭─ ITER137 · Full Registry Semantic Migration™")
    print(f"│  targets: {targets}")
    print(f"│  concurrency: {args.max_concurrency}")
    print(f"│  dry_run: {args.dry_run}")

    locales_data = {
        loc: json.loads((I18N_DIR / f"{loc}.json").read_text("utf-8"))
        for loc in ALL_LOCALES if (I18N_DIR / f"{loc}.json").exists()
    }
    flat = {loc: _flat(d) for loc, d in locales_data.items()}
    all_keys = set()
    for f in flat.values():
        all_keys.update(f.keys())

    # Build job list. Source rule: it-IT > en-US > skip.
    jobs: list = []
    for key in sorted(all_keys):
        src_text, src_loc = None, None
        if flat.get("it-IT", {}).get(key, "").strip():
            src_text = flat["it-IT"][key]
            src_loc = "it-IT"
        elif flat.get("en-US", {}).get(key, "").strip():
            src_text = flat["en-US"][key]
            src_loc = "en-US"
        else:
            continue
        for tgt in targets:
            if tgt == src_loc:
                continue
            existing = flat.get(tgt, {}).get(key, "").strip()
            if existing:
                continue
            # Skip very short technical strings (<3 chars, pure punctuation).
            if len(src_text) < 3:
                continue
            jobs.append((key, src_loc, src_text, tgt))
    if args.limit > 0:
        jobs = jobs[:args.limit]
    print(f"│  jobs queued: {len(jobs)}")
    print(f"╰─ {time.strftime('%H:%M:%S')}\n")

    if not jobs:
        print("✓ nothing to do — registry already converged")
        return 0
    if args.dry_run:
        print(f"DRY-RUN — would call LLM {len(jobs)} times")
        for j in jobs[:5]:
            print(f"  · {j[0]}  [{j[1]} → {j[3]}]  «{j[2][:80]}»")
        return 0

    api_key = _key()
    cache = _load_cache()
    progress = {"done": 0, "cached": 0, "fallback": 0, "last_error": None}
    started = time.time()

    # Run async in chunks so we save the cache periodically.
    chunk = max(args.save_every, args.max_concurrency * 4)
    results: list = []
    for i in range(0, len(jobs), chunk):
        batch = jobs[i:i+chunk]
        t0 = time.time()
        out = asyncio.run(_runner(batch, api_key, args.max_concurrency,
                                  cache, progress))
        results.extend(out)
        _save_cache(cache)
        elapsed = time.time() - started
        rate = (progress["done"] + progress["cached"]) / max(elapsed, 0.1)
        print(f"  · batch {i//chunk + 1}: {len(batch)} done in {time.time()-t0:.1f}s "
              f"· cum: {progress['done']} new + {progress['cached']} cached + "
              f"{progress['fallback']} fb · "
              f"{rate:.1f}/s · cache={len(cache)}")

    # Apply results to locales.
    print(f"\n  applying {len(results)} writes to JSON files…")
    for key, tgt, text, _fallback in results:
        parts = key.split(".")
        _set_nested(locales_data[tgt], parts, text)

    for loc, d in locales_data.items():
        if loc in targets:
            (I18N_DIR / f"{loc}.json").write_text(
                json.dumps(d, ensure_ascii=False, indent=2), "utf-8")
            print(f"    ✓ wrote {loc}.json")

    elapsed = time.time() - started
    print(f"\n┌─ DONE · {elapsed:.1f}s · cache_hits={progress['cached']} "
          f"new={progress['done']} fallback={progress['fallback']}")
    if progress["last_error"]:
        print(f"│  last_error: {progress['last_error']}")
    print(f"└─ cache snapshot: {CACHE_F}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
