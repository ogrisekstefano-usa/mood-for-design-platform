#!/usr/bin/env python3
"""
SPRINT ITER132 · Autonomous Remediation Loop™

Orchestrates the full pipeline:

  for iteration in 1..N:
    1. python3 full_runtime_localization_crawler.py
    2. python3 runtime_auto_remediation.py
    3. restart frontend (so new i18n strings + AST fixes propagate)
    4. compare summary → if all critical counters == 0, stop

Outputs:
  /app/governance/runtime-localization-history.json
  /app/governance/runtime-localization-heatmap.html

USAGE:
  python3 /app/scripts/runtime_remediation_loop.py [--max-iters 4]
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


GOV = Path("/app/governance")
CRAWLER = "/app/scripts/full_runtime_localization_crawler.py"
REMEDIATOR = "/app/scripts/runtime_auto_remediation.py"
HEATMAP_GEN = "/app/scripts/generate_localization_heatmap.py"
REPORT = GOV / "runtime-localization-report.json"
HISTORY = GOV / "runtime-localization-history.json"

CRITICAL_COUNTERS = {
    "RUNTIME_CRASH",
    "INVALID_USE_TRANSLATION",
    "MISSING_REGISTRY_KEY",
    "HARD_CODED_UI",
}


def run(cmd: list[str]) -> int:
    print(f"\n$ {' '.join(cmd)}")
    return subprocess.call(cmd)


def supervisor_restart_frontend() -> None:
    subprocess.call(["sudo", "supervisorctl", "restart", "frontend"])
    print("   ↻ frontend restart issued · sleeping 18s")
    time.sleep(18)


def read_summary() -> dict:
    if not REPORT.exists():
        return {}
    return json.loads(REPORT.read_text("utf-8")).get("summary", {})


def critical_total(summary: dict) -> int:
    return sum(v for k, v in summary.items() if k in CRITICAL_COUNTERS)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-iters", type=int, default=4)
    parser.add_argument("--skip-initial-crawl", action="store_true")
    args = parser.parse_args()

    history: list = []
    if HISTORY.exists():
        try:
            history = json.loads(HISTORY.read_text("utf-8"))
        except Exception:
            history = []

    for i in range(1, args.max_iters + 1):
        print(f"\n━━━━━━━━━━━━━━━━━━━━ LOOP ITERATION {i}/{args.max_iters} ━━━━━━━━━━━━━━━━━━━━")

        if i > 1 or not args.skip_initial_crawl:
            if run(["python3", CRAWLER]) != 0:
                print("× crawler failed, aborting loop")
                return 4

        summary_before = read_summary()
        print(f"   summary: {summary_before}")

        # Snapshot for history.
        history.append({
            "iteration": i,
            "phase": "post_crawl",
            "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "summary": summary_before,
        })

        if critical_total(summary_before) == 0:
            print(f"\n✓ critical counters all zero. Loop converged at iteration {i}.")
            break

        if run(["python3", REMEDIATOR]) != 0:
            print("× remediator failed, aborting loop")
            return 5

        # Restart frontend so AST/JSON changes propagate before re-crawl.
        supervisor_restart_frontend()

    HISTORY.write_text(json.dumps(history, indent=2, ensure_ascii=False), "utf-8")

    # Generate visual heatmap.
    if Path(HEATMAP_GEN).exists():
        run(["python3", HEATMAP_GEN])

    final = read_summary()
    print(f"\n┌─ FINAL SUMMARY ({len(history)} snapshots)")
    for k, v in sorted(final.items(), key=lambda x: -x[1]):
        print(f"│  {k.ljust(28)} {v}")
    print(f"└─ Heatmap: /app/governance/runtime-localization-heatmap.html\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
