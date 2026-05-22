"""
SPRINT ITER134 · Runtime Loop Job Manager.

Spawns and tracks Self-Healing Localization Loop™ jobs.

Persistence:
  - Status file per job: /app/governance/jobs/{job_id}.json
  - Process PID stored inside the status file (the spawned script also writes
    to it). We just kick off the subprocess and return the job_id.

Concurrency guard:
  - At most one in-flight job at a time. List all status files, find any with
    `completed == false` AND PID still alive; reject new launches.
"""

from __future__ import annotations

import json
import os
import signal
import subprocess
import time
import uuid
from pathlib import Path
from typing import List, Optional

GOV       = Path("/app/governance")
JOBS_DIR  = GOV / "jobs"
JOBS_DIR.mkdir(parents=True, exist_ok=True)
SCRIPT    = "/app/scripts/self_healing_loop.py"
PY        = "/opt/plugins-venv/bin/python"
LOG_DIR   = Path("/tmp/iter134_jobs")
LOG_DIR.mkdir(parents=True, exist_ok=True)

VALID_LOCALES = {"it-IT", "en-US", "en-GB", "fr-FR", "de-DE", "es-ES", "ar"}


def _pid_alive(pid: Optional[int]) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
        return True
    except (OSError, ProcessLookupError, PermissionError):
        return False


def _read_status(job_id: str) -> dict:
    p = JOBS_DIR / f"{job_id}.json"
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text("utf-8"))
    except Exception:
        return {}


def _list_status_files() -> List[Path]:
    return sorted(JOBS_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)


def find_active_job() -> Optional[dict]:
    """Return the most recent job that is NOT completed AND has a live PID
    AND has actually progressed past 'queued' within a reasonable window
    (zombie protection: a job stuck in 'queued' with no `started_at` for
    more than 90 seconds is considered dead and gets auto-marked completed).
    """
    import time as _time
    for p in _list_status_files():
        try:
            s = json.loads(p.read_text("utf-8"))
        except Exception:
            continue
        if s.get("completed"):
            continue
        if not _pid_alive(s.get("pid")):
            # Process gone but completed flag never set → mark completed.
            s["completed"] = True
            s["stage"] = (s.get("stage") or "unknown") + " · process_exited"
            p.write_text(json.dumps(s, indent=2, ensure_ascii=False), "utf-8")
            continue
        # Zombie: PID alive but never updated past 'queued' state.
        if s.get("stage") == "queued" and not s.get("started_at"):
            mtime = p.stat().st_mtime
            if _time.time() - mtime > 90:
                s["completed"] = True
                s["stage"] = "abandoned · stuck_in_queued"
                p.write_text(json.dumps(s, indent=2, ensure_ascii=False), "utf-8")
                continue
        return s
    return None


def launch_loop(
    locales: Optional[List[str]] = None,
    max_iters: int = 3,
    no_restart: bool = False,
) -> dict:
    """Spawn the self-healing loop. Returns the initial status dict."""
    active = find_active_job()
    if active:
        return {
            "ok": False,
            "reason": "concurrent_job",
            "job_id": active.get("job_id"),
            "stage": active.get("stage"),
            "started_at": active.get("started_at"),
        }

    locales = locales or ["en-US"]
    invalid = [loc for loc in locales if loc not in VALID_LOCALES]
    if invalid:
        return {"ok": False, "reason": "invalid_locales", "invalid": invalid}

    job_id = uuid.uuid4().hex[:16]
    log_path = LOG_DIR / f"{job_id}.log"
    cmd = [
        PY, SCRIPT,
        "--job-id", job_id,
        "--locales", ",".join(locales),
        "--max-iters", str(max_iters),
    ]
    if no_restart:
        cmd.append("--no-restart")

    # Seed status BEFORE spawning so polling never races.
    init = {
        "job_id": job_id,
        "stage": "queued",
        "locales": locales,
        "max_iters": max_iters,
        "completed": False,
        "progress_pct": 0,
        "started_at": None,
        "log": [{"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                 "line": f"queued · locales={locales}"}],
    }
    (JOBS_DIR / f"{job_id}.json").write_text(
        json.dumps(init, indent=2, ensure_ascii=False), "utf-8"
    )

    # Spawn detached subprocess writing to a log file. Critical: pass
    # PLAYWRIGHT_BROWSERS_PATH so the crawler can find the chromium binary
    # that's pre-installed on this image at /pw-browsers (the backend
    # uvicorn process doesn't inherit shell-level env vars).
    env = os.environ.copy()
    env.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/pw-browsers")
    env.setdefault("PLAYWRIGHT_CHROME_EXECUTABLE_PATH", "/usr/bin/chromium")
    env.setdefault("HOME", "/root")
    f = open(log_path, "ab", buffering=0)
    proc = subprocess.Popen(
        cmd,
        stdout=f, stderr=subprocess.STDOUT,
        start_new_session=True, close_fds=True,
        cwd="/app", env=env,
    )
    # Stamp the PID in the status file so future polls can detect liveness.
    s = _read_status(job_id)
    s["pid"] = proc.pid
    s["log_path"] = str(log_path)
    (JOBS_DIR / f"{job_id}.json").write_text(
        json.dumps(s, indent=2, ensure_ascii=False), "utf-8"
    )
    return {"ok": True, "job_id": job_id, "status": s}


def get_status(job_id: str) -> dict:
    s = _read_status(job_id)
    if not s:
        return {"ok": False, "reason": "not_found"}
    s["pid_alive"] = _pid_alive(s.get("pid"))
    if not s.get("completed") and not s["pid_alive"]:
        # Process died without writing 'completed' — mark zombie.
        s["stage"] = s.get("stage", "unknown") + " · process_exited"
        s["completed"] = True
        (JOBS_DIR / f"{job_id}.json").write_text(
            json.dumps(s, indent=2, ensure_ascii=False), "utf-8"
        )
    return {"ok": True, "status": s}


def list_jobs(limit: int = 20) -> List[dict]:
    out = []
    for p in _list_status_files()[:limit]:
        try:
            s = json.loads(p.read_text("utf-8"))
        except Exception:
            continue
        out.append({
            "job_id": s.get("job_id") or p.stem,
            "stage": s.get("stage"),
            "completed": bool(s.get("completed")),
            "started_at": s.get("started_at"),
            "finished_at": s.get("finished_at"),
            "progress_pct": s.get("progress_pct", 0),
            "locales": s.get("locales") or [],
            "converged": s.get("converged"),
        })
    return out


def kill_job(job_id: str) -> dict:
    s = _read_status(job_id)
    if not s:
        return {"ok": False, "reason": "not_found"}
    pid = s.get("pid")
    if pid and _pid_alive(pid):
        try:
            os.killpg(os.getpgid(pid), signal.SIGTERM)
        except Exception:
            try:
                os.kill(pid, signal.SIGTERM)
            except Exception:
                pass
    s["stage"] = "cancelled"
    s["completed"] = True
    s["finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    (JOBS_DIR / f"{job_id}.json").write_text(
        json.dumps(s, indent=2, ensure_ascii=False), "utf-8"
    )
    return {"ok": True, "status": s}


def clear_fixed_leaks() -> dict:
    """Delete all rows from runtime_leaks.db where resolution_method IS NOT NULL.
    Returns the number of leaks cleared.
    """
    import sqlite3
    db = GOV / "runtime_leaks.db"
    if not db.exists():
        return {"ok": True, "cleared": 0}
    conn = sqlite3.connect(str(db))
    cur = conn.execute("SELECT COUNT(*) FROM leaks WHERE resolution_method IS NOT NULL")
    n = int(cur.fetchone()[0])
    conn.execute("DELETE FROM leaks WHERE resolution_method IS NOT NULL")
    conn.commit()
    conn.close()
    return {"ok": True, "cleared": n}
