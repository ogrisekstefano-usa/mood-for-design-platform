#!/usr/bin/env python3
"""
SPRINT ITER134 · Self-Healing Localization Loop™

Wraps the existing crawler + remediator into an autonomous loop that:
  1. Writes live progress to a JSON status file `/app/governance/jobs/{job_id}.json`
  2. Can be invoked over HTTP via /api/language/runtime/run-loop
  3. Iterates over multiple locales (default: en-US — pass --locales for more)
  4. Auto-closes resolved leaks (delegated to the remediator)

Stages:
  starting → crawling[locale] → remediating → restarting_frontend → re-crawling
  → completed | failed

USAGE:
  python3 /app/scripts/self_healing_loop.py --job-id <uuid> [--locales en-US,fr-FR]
                                            [--max-iters 3] [--no-restart]
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path


GOV       = Path("/app/governance")
JOBS_DIR  = GOV / "jobs"
JOBS_DIR.mkdir(parents=True, exist_ok=True)
CRAWLER   = "/app/scripts/full_runtime_localization_crawler.py"
REMEDIATOR = "/app/scripts/runtime_auto_remediation.py"
HEATMAP   = "/app/scripts/generate_localization_heatmap.py"
REPORT    = GOV / "runtime-localization-report.json"

PY = "/opt/plugins-venv/bin/python"  # has playwright

CRITICAL = {"RUNTIME_CRASH", "INVALID_USE_TRANSLATION",
            "MISSING_REGISTRY_KEY", "HARD_CODED_UI"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _status_path(job_id: str) -> Path:
    return JOBS_DIR / f"{job_id}.json"


def write_status(jid: str, **patch) -> None:
    p = _status_path(jid)
    cur: dict = {}
    if p.exists():
        try:
            cur = json.loads(p.read_text("utf-8"))
        except Exception:
            cur = {}
    cur.setdefault("job_id", jid)
    cur.update(patch)
    cur["updated_at"] = _now()
    p.write_text(json.dumps(cur, indent=2, ensure_ascii=False), "utf-8")


def append_log(jid: str, line: str) -> None:
    p = _status_path(jid)
    cur = json.loads(p.read_text("utf-8")) if p.exists() else {}
    cur.setdefault("job_id", jid)
    log = cur.get("log") or []
    log.append({"ts": _now(), "line": line})
    cur["log"] = log[-200:]
    cur["updated_at"] = _now()
    p.write_text(json.dumps(cur, indent=2, ensure_ascii=False), "utf-8")


def read_summary_from_report() -> dict:
    if not REPORT.exists():
        return {}
    return json.loads(REPORT.read_text("utf-8")).get("summary", {})


def critical_total(summary: dict) -> int:
    return sum(v for k, v in summary.items() if k in CRITICAL)


# ─────────── stages ─────────────────────────────────────────────────────
def stage_crawl(job_id: str, locale: str) -> dict:
    append_log(job_id, f"crawling · {locale}")
    write_status(job_id, stage=f"crawling[{locale}]", current_locale=locale)
    env = os.environ.copy()
    env["LOCALE"] = locale
    # Inherit playwright browsers path if the parent set it; otherwise
    # default to the image-wide install at /pw-browsers.
    env.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/pw-browsers")
    env.setdefault("PLAYWRIGHT_CHROME_EXECUTABLE_PATH", "/usr/bin/chromium")
    env.setdefault("HOME", "/root")
    r = subprocess.run(
        [PY, CRAWLER],
        capture_output=True, text=True, env=env, timeout=420,
    )
    if r.returncode != 0:
        append_log(job_id, f"crawler exit={r.returncode} stderr_tail={(r.stderr or '')[-300:]}")
        # CRITICAL: do not silently call this 'converged' — return a sentinel
        # the loop can read so it bails instead of using a stale report file.
        return {"_crawler_failed": True}
    summary = read_summary_from_report()
    append_log(job_id, f"summary {locale} · {json.dumps(summary)}")
    return summary


def stage_remediate(job_id: str) -> int:
    append_log(job_id, "remediating · invoking auto-remediation engine")
    write_status(job_id, stage="remediating")
    r = subprocess.run(
        [PY, REMEDIATOR],
        capture_output=True, text=True, timeout=300,
    )
    if r.returncode != 0:
        append_log(job_id, f"remediator exit={r.returncode} stderr_tail={(r.stderr or '')[-300:]}")
    # Tally how many actions were logged by parsing remediator stdout
    actions = 0
    for line in (r.stdout or "").splitlines():
        if "↳" in line:
            append_log(job_id, line.strip())
            actions += 1
    return actions


def stage_restart_frontend(job_id: str) -> None:
    write_status(job_id, stage="restarting_frontend")
    append_log(job_id, "restarting frontend (supervisorctl)")
    try:
        subprocess.run(["sudo", "supervisorctl", "restart", "frontend"],
                       capture_output=True, text=True, timeout=30)
    except Exception as e:
        append_log(job_id, f"supervisorctl error · {e}")
    # Give the dev server enough time to compile.
    for s in range(18, 0, -3):
        write_status(job_id, stage=f"restarting_frontend (~{s}s)")
        time.sleep(3)


def stage_heatmap(job_id: str) -> None:
    write_status(job_id, stage="rendering_heatmap")
    append_log(job_id, "regenerating heatmap")
    subprocess.run([PY, HEATMAP], capture_output=True, text=True, timeout=60)


# ─────────── loop ───────────────────────────────────────────────────────
def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-id", required=True)
    parser.add_argument("--locales", default="en-US")
    parser.add_argument("--max-iters", type=int, default=3)
    parser.add_argument("--no-restart", action="store_true")
    args = parser.parse_args()

    job_id  = args.job_id
    locales = [loc.strip() for loc in args.locales.split(",") if loc.strip()]

    write_status(
        job_id,
        started_at=_now(),
        stage="starting",
        locales=locales,
        max_iters=args.max_iters,
        completed=False,
        progress_pct=0,
        per_locale={loc: {"summary": {}, "iterations": 0, "converged": False} for loc in locales},
        log=[],
    )
    append_log(job_id, f"job started · locales={locales} · max_iters={args.max_iters}")

    try:
        total_steps = max(1, args.max_iters * len(locales))
        step = 0
        final_summary_by_locale: dict = {}
        for locale in locales:
            converged_for_locale = False
            for it in range(1, args.max_iters + 1):
                step += 1
                write_status(
                    job_id,
                    progress_pct=int(min(95, (step * 100) // (total_steps + 1))),
                    current_iteration=it,
                )
                summary = stage_crawl(job_id, locale)
                if summary.get("_crawler_failed"):
                    append_log(job_id, f"× {locale} · crawler failed, aborting locale loop")
                    pl = json.loads(_status_path(job_id).read_text("utf-8")).get("per_locale", {})
                    pl[locale] = {
                        "summary": {"_crawler_failed": True},
                        "iterations": it,
                        "converged": False,
                    }
                    write_status(job_id, per_locale=pl)
                    final_summary_by_locale[locale] = {"_crawler_failed": True}
                    break
                final_summary_by_locale[locale] = summary
                pl = json.loads(_status_path(job_id).read_text("utf-8")).get("per_locale", {})
                pl[locale] = {
                    "summary": summary,
                    "iterations": it,
                    "converged": critical_total(summary) == 0,
                }
                write_status(job_id, per_locale=pl)

                if critical_total(summary) == 0:
                    append_log(job_id, f"✓ {locale} converged at iteration {it}")
                    converged_for_locale = True
                    break

                actions = stage_remediate(job_id)
                append_log(job_id, f"remediation actions · {actions}")
                if not args.no_restart:
                    stage_restart_frontend(job_id)

            if not converged_for_locale:
                append_log(job_id, f"! {locale} did NOT converge in {args.max_iters} iterations")

        stage_heatmap(job_id)

        # Aggregate final summary (exclude failed-crawler sentinels).
        agg: dict = {}
        any_failed = False
        for s in final_summary_by_locale.values():
            if s.get("_crawler_failed"):
                any_failed = True
                continue
            for k, v in s.items():
                agg[k] = agg.get(k, 0) + v

        write_status(
            job_id,
            stage="completed" if not any_failed else "completed_with_errors",
            progress_pct=100,
            completed=True,
            finished_at=_now(),
            final_summary=agg,
            final_summary_by_locale=final_summary_by_locale,
            converged=(not any_failed) and critical_total(agg) == 0,
        )
        append_log(job_id, f"job completed · agg={json.dumps(agg)}")
        return 0
    except Exception as exc:
        write_status(
            job_id,
            stage="failed",
            progress_pct=100,
            completed=True,
            finished_at=_now(),
            error=str(exc),
            traceback=traceback.format_exc()[-2000:],
        )
        append_log(job_id, f"FAILED · {exc}")
        return 9


if __name__ == "__main__":
    sys.exit(main())
