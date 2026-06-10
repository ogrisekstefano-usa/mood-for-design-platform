"""
ITER134 · Self-Healing Localization Loop™ — backend integration tests.

Validates POST /api/language/runtime/run-loop, GET /run-loop/status/{job_id},
GET /run-loop/jobs, POST /run-loop/{job_id}/cancel, POST /clear-fixed-leaks.

Strategy:
- Auth gating (401 unauth, 403 client) for all endpoints.
- Validation (max_iters bounds, invalid locales, invalid job_id regex, 404).
- Lifecycle via direct-seeded status files (avoids 130s subprocess wait).
- Real launch (no_restart=true, max_iters=1, single locale) verifies subprocess
  spawn, status polling, list_jobs, and concurrent guard (409).
- Cancel by seeding fake in-flight status with current PID (always alive) then
  POSTing cancel.
- clear-fixed-leaks: seed runtime_leaks.db rows with resolution_method, hit
  endpoint, verify count returned.
"""
import json
import os
import sqlite3
import time
import uuid
from pathlib import Path

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://i18n-recovery-1.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "demo@moodfordesign.com"
ADMIN_PASSWORD = "Blueprint2024!"
CLIENT_EMAIL = "client@moodfordesign.com"
CLIENT_PASSWORD = "Client2024!"

GOV = Path("/app/governance")
JOBS_DIR = GOV / "jobs"
LEAKS_DB = GOV / "runtime_leaks.db"


# ─── auth helpers ────────────────────────────────────────────────────────

def _login(email: str, password: str):
    r = requests.post(
        f"{API}/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    if r.status_code != 200:
        return None
    body = r.json() or {}
    sess = body.get("session") or {}
    return sess.get("access_token") or body.get("access_token") or body.get("token")


@pytest.fixture(scope="module")
def admin_token():
    tok = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not tok:
        pytest.skip("Admin login failed; cannot run iter134 tests")
    return tok


@pytest.fixture(scope="module")
def client_token():
    return _login(CLIENT_EMAIL, CLIENT_PASSWORD)


@pytest.fixture
def H(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ─── helpers to seed / cleanup status files ─────────────────────────────

def _seed_status(stage="completed", completed=True, pid=None, **extra):
    job_id = uuid.uuid4().hex[:16]
    s = {
        "job_id": job_id,
        "stage": stage,
        "locales": ["en-US"],
        "max_iters": 1,
        "completed": completed,
        "progress_pct": 100 if completed else 50,
        "started_at": "2026-01-01T00:00:00Z",
        "finished_at": "2026-01-01T00:00:30Z" if completed else None,
        "log": [{"ts": "2026-01-01T00:00:00Z", "line": "seeded"}],
        "per_locale": {"en-US": {"summary": {"DB_SEEDED_CONTENT": 0}, "iterations": 1, "converged": True}},
        "converged": True,
        "pid": pid or os.getpid(),  # current python pid is alive
    }
    s.update(extra)
    JOBS_DIR.mkdir(parents=True, exist_ok=True)
    (JOBS_DIR / f"{job_id}.json").write_text(json.dumps(s, indent=2), "utf-8")
    return job_id


def _cleanup_status(job_id):
    p = JOBS_DIR / f"{job_id}.json"
    if p.exists():
        p.unlink()


# ─── Auth gating ─────────────────────────────────────────────────────────

class TestAuthGating:
    def test_run_loop_unauth_401(self):
        r = requests.post(f"{API}/language/runtime/run-loop", json={}, timeout=15)
        assert r.status_code in (401, 403)

    def test_status_unauth_401(self):
        r = requests.get(f"{API}/language/runtime/run-loop/status/abc12345", timeout=15)
        assert r.status_code in (401, 403)

    def test_list_jobs_unauth_401(self):
        r = requests.get(f"{API}/language/runtime/run-loop/jobs", timeout=15)
        assert r.status_code in (401, 403)

    def test_cancel_unauth_401(self):
        r = requests.post(f"{API}/language/runtime/run-loop/abc12345/cancel", timeout=15)
        assert r.status_code in (401, 403)

    def test_clear_fixed_unauth_401(self):
        r = requests.post(f"{API}/language/runtime/clear-fixed-leaks", timeout=15)
        assert r.status_code in (401, 403)

    def test_run_loop_client_role_403(self, client_token):
        if not client_token:
            pytest.skip("client token unavailable")
        h = {"Authorization": f"Bearer {client_token}"}
        r = requests.post(f"{API}/language/runtime/run-loop", json={}, headers=h, timeout=15)
        assert r.status_code == 403

    def test_clear_fixed_client_role_403(self, client_token):
        if not client_token:
            pytest.skip("client token unavailable")
        h = {"Authorization": f"Bearer {client_token}"}
        r = requests.post(f"{API}/language/runtime/clear-fixed-leaks", headers=h, timeout=15)
        assert r.status_code == 403


# ─── Validation ──────────────────────────────────────────────────────────

class TestValidation:
    def test_invalid_locale_400(self, H):
        r = requests.post(
            f"{API}/language/runtime/run-loop",
            json={"locales": ["zz-ZZ"], "max_iters": 1, "no_restart": True},
            headers=H, timeout=20,
        )
        # Endpoint may 400 directly OR 400 with detail.reason=invalid_locales OR 409 if a real job is in flight.
        # Accept 400 (validation) — primary expected behavior. Tolerate 409 (concurrent) once.
        assert r.status_code in (400, 409), f"expected 400/409 got {r.status_code} body={r.text[:200]}"
        if r.status_code == 400:
            body = r.json()
            detail = body.get("detail", {})
            if isinstance(detail, dict):
                assert detail.get("reason") == "invalid_locales"

    def test_max_iters_zero_400(self, H):
        r = requests.post(
            f"{API}/language/runtime/run-loop",
            json={"locales": ["en-US"], "max_iters": 0, "no_restart": True},
            headers=H, timeout=15,
        )
        assert r.status_code == 400

    def test_max_iters_too_high_400(self, H):
        r = requests.post(
            f"{API}/language/runtime/run-loop",
            json={"locales": ["en-US"], "max_iters": 7, "no_restart": True},
            headers=H, timeout=15,
        )
        assert r.status_code == 400

    def test_status_invalid_job_id_regex_400(self, H):
        r = requests.get(
            f"{API}/language/runtime/run-loop/status/NOT-HEX-ID!",
            headers=H, timeout=15,
        )
        assert r.status_code == 400

    def test_status_nonexistent_job_404(self, H):
        # valid hex, never existed
        r = requests.get(
            f"{API}/language/runtime/run-loop/status/deadbeefcafe0000",
            headers=H, timeout=15,
        )
        assert r.status_code == 404

    def test_cancel_invalid_job_id_regex_400(self, H):
        r = requests.post(
            f"{API}/language/runtime/run-loop/NOT-HEX!/cancel",
            headers=H, timeout=15,
        )
        assert r.status_code == 400


# ─── Status / list (using seeded status file) ───────────────────────────

class TestStatusAndList:
    def test_status_returns_full_shape_for_seeded_completed_job(self, H):
        job_id = _seed_status(stage="completed", completed=True)
        try:
            r = requests.get(
                f"{API}/language/runtime/run-loop/status/{job_id}",
                headers=H, timeout=15,
            )
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["job_id"] == job_id
            for k in ("stage", "progress_pct", "completed", "per_locale",
                      "log", "started_at", "finished_at"):
                assert k in body, f"status missing key {k}"
            assert body["completed"] is True
            assert body["converged"] is True
            assert "en-US" in body["per_locale"]
        finally:
            _cleanup_status(job_id)

    def test_list_jobs_returns_items_array(self, H):
        seeded = _seed_status(stage="completed", completed=True)
        try:
            r = requests.get(f"{API}/language/runtime/run-loop/jobs",
                             headers=H, timeout=15)
            assert r.status_code == 200
            body = r.json()
            assert "items" in body
            assert isinstance(body["items"], list)
            ids = [i.get("job_id") for i in body["items"]]
            assert seeded in ids
            # sanity: each item carries summary fields
            it = next(i for i in body["items"] if i["job_id"] == seeded)
            for k in ("stage", "completed", "started_at", "progress_pct",
                      "locales", "converged"):
                assert k in it
        finally:
            _cleanup_status(seeded)


# ─── Cancel using seeded in-flight status ───────────────────────────────

class TestCancel:
    def test_cancel_marks_job_completed_cancelled(self, H):
        # Use a non-existent high PID so kill_job's SIGTERM is a no-op (its
        # try/except swallows ProcessLookupError). The endpoint must still
        # write stage='cancelled', completed=true to the status file.
        # NOTE: never use PID=1 — killpg(1, SIGTERM) would kill the entire
        # init process group and tear down the backend.
        job_id = _seed_status(stage="crawling", completed=False, pid=999999,
                              progress_pct=42, finished_at=None)
        try:
            r = requests.post(
                f"{API}/language/runtime/run-loop/{job_id}/cancel",
                headers=H, timeout=15,
            )
            assert r.status_code == 200, r.text
            body = r.json()
            assert body.get("ok") is True
            s = body.get("status") or {}
            assert s.get("stage") == "cancelled"
            assert s.get("completed") is True
            # Status file persisted
            disk = json.loads((JOBS_DIR / f"{job_id}.json").read_text("utf-8"))
            assert disk["stage"] == "cancelled"
            assert disk["completed"] is True
        finally:
            _cleanup_status(job_id)


# ─── clear-fixed-leaks ──────────────────────────────────────────────────

class TestClearFixedLeaks:
    def test_clear_fixed_leaks_returns_count(self, H):
        if not LEAKS_DB.exists():
            # Endpoint must still respond ok with cleared=0
            r = requests.post(f"{API}/language/runtime/clear-fixed-leaks",
                              headers=H, timeout=15)
            assert r.status_code == 200
            assert r.json() == {"ok": True, "cleared": 0}
            return

        # Insert TEST_ rows with resolution_method != null, ensure they get cleared.
        conn = sqlite3.connect(str(LEAKS_DB))
        try:
            cur = conn.execute("PRAGMA table_info(leaks)")
            cols = [c[1] for c in cur.fetchall()]
            assert "resolution_method" in cols, f"unexpected schema: {cols}"

            # Clear any existing resolved rows first to make count deterministic.
            conn.execute("DELETE FROM leaks WHERE resolution_method IS NOT NULL")
            conn.commit()

            # Build minimal insert statement based on present cols (NULL the rest).
            placeholders = ", ".join(["?"] * len(cols))
            base = {c: None for c in cols}
            for i in range(3):
                row = dict(base)
                if "id" in row:
                    row["id"] = f"TEST_iter134_{uuid.uuid4().hex[:8]}_{i}"
                if "route" in row:
                    row["route"] = f"/test/iter134/{i}"
                if "locale" in row:
                    row["locale"] = "en-US"
                if "kind" in row:
                    row["kind"] = "TEST_LEAK"
                if "resolution_method" in row:
                    row["resolution_method"] = "test_seeded"
                if "created_at" in row:
                    row["created_at"] = "2026-01-01T00:00:00Z"
                if "open" in row:
                    row["open"] = 0
                if "first_seen" in row:
                    row["first_seen"] = "2026-01-01T00:00:00Z"
                if "last_seen" in row:
                    row["last_seen"] = "2026-01-01T00:00:00Z"
                vals = [row[c] for c in cols]
                conn.execute(f"INSERT INTO leaks ({', '.join(cols)}) VALUES ({placeholders})", vals)
            conn.commit()
        finally:
            conn.close()

        # Hit the endpoint
        r = requests.post(f"{API}/language/runtime/clear-fixed-leaks",
                          headers=H, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert isinstance(body.get("cleared"), int)
        assert body["cleared"] >= 3, f"expected >=3 cleared, got {body}"

        # Verify db: no rows remaining with resolution_method != NULL
        conn = sqlite3.connect(str(LEAKS_DB))
        try:
            n = conn.execute("SELECT COUNT(*) FROM leaks WHERE resolution_method IS NOT NULL").fetchone()[0]
            assert n == 0
        finally:
            conn.close()


# ─── Real launch + concurrent guard (subprocess actually spawned) ───────

class TestRealLaunchAndConcurrentGuard:
    """Real subprocess launch — uses no_restart=True, max_iters=1, single locale.
    Even if crawler fails (e.g., playwright misconfig), the orchestrator writes
    a status file and the API contract holds.
    """

    def test_real_launch_then_concurrent_409(self, H):
        # Best-effort: clear any in-flight zombies first by sweeping
        # find_active_job (the manager auto-marks them completed when stale).
        # We can't import the service across processes; rely on its zombie
        # protection (90s window or PID dead).

        # 1) Launch
        r1 = requests.post(
            f"{API}/language/runtime/run-loop",
            json={"locales": ["en-US"], "max_iters": 1, "no_restart": True},
            headers=H, timeout=30,
        )
        # If a previous run is still alive, accept 409 and skip rest
        if r1.status_code == 409:
            pytest.skip(f"another job already in flight: {r1.json()}")
        assert r1.status_code == 200, r1.text
        body1 = r1.json()
        assert body1.get("ok") is True
        job_id = body1.get("job_id")
        assert job_id and len(job_id) >= 8

        try:
            # 2) Status reachable and shape valid (poll once)
            time.sleep(1.5)
            rs = requests.get(
                f"{API}/language/runtime/run-loop/status/{job_id}",
                headers=H, timeout=15,
            )
            assert rs.status_code == 200, rs.text
            sbody = rs.json()
            assert sbody["job_id"] == job_id
            assert "stage" in sbody and "progress_pct" in sbody

            # 3) Concurrent launch must be refused with 409
            r2 = requests.post(
                f"{API}/language/runtime/run-loop",
                json={"locales": ["en-US"], "max_iters": 1, "no_restart": True},
                headers=H, timeout=15,
            )
            # If the first job already completed in <2s (common when subprocess
            # crashes early), the second launch could 200. Treat that as soft pass.
            if r2.status_code == 200:
                # confirm 1st completed already
                rs2 = requests.get(
                    f"{API}/language/runtime/run-loop/status/{job_id}",
                    headers=H, timeout=15,
                )
                assert rs2.json().get("completed") is True, \
                    "concurrent launch returned 200 but 1st job not completed"
                # cleanup the second job
                jid2 = r2.json().get("job_id")
                if jid2:
                    # cancel it to be tidy
                    requests.post(
                        f"{API}/language/runtime/run-loop/{jid2}/cancel",
                        headers=H, timeout=10,
                    )
            else:
                assert r2.status_code == 409, r2.text
                detail = r2.json().get("detail") or {}
                assert detail.get("reason") == "concurrent_job"
                assert detail.get("job_id") == job_id

            # 4) jobs list contains our job_id
            rj = requests.get(f"{API}/language/runtime/run-loop/jobs",
                              headers=H, timeout=15)
            assert rj.status_code == 200
            ids = [i.get("job_id") for i in rj.json().get("items", [])]
            assert job_id in ids
        finally:
            # Cancel to free the slot for next tests (best-effort)
            try:
                requests.post(
                    f"{API}/language/runtime/run-loop/{job_id}/cancel",
                    headers=H, timeout=15,
                )
            except Exception:
                pass
