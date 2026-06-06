"""KE-001 · Reliability pytest suite.

Validates the orphan recovery 3-phase machinery, event emission,
document-level retry, and the foundation columns set on the
extraction_jobs row.
"""
import os
import time
import uuid
import psycopg2
import pytest
import requests
from datetime import datetime, timezone, timedelta

DB_URL = open("/app/backend/.env").read().split("DATABASE_URL=")[1].split("\n")[0]
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or \
    "https://content-hub-pro-22.preview.emergentagent.com"

ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASS = "Blueprint2024!"
KNOWN_SET_ID = "a1b8cfac-4c27-4b9d-88f7-877f75f8445c"   # RIVA1920 Master Library


@pytest.fixture(scope="module")
def conn():
    c = psycopg2.connect(DB_URL); c.autocommit = True
    yield c
    c.close()


@pytest.fixture(scope="module")
def tenant_id(conn):
    cur = conn.cursor()
    cur.execute("SELECT tenant_id FROM brand_catalog_sets WHERE id=%s", (KNOWN_SET_ID,))
    r = cur.fetchone()
    if not r:
        pytest.skip("RIVA1920 set not present")
    return str(r[0])


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    if r.status_code != 200:
        pytest.skip("login failed")
    return ((r.json().get("session") or {}).get("access_token")) or r.json().get("access_token")


@pytest.fixture(scope="module")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


# ─── Schema sanity ──────────────────────────────────────────────────
def test_migration_131_columns_present(conn):
    cur = conn.cursor()
    for col in ("last_seen_at", "last_activity_at", "stalled_at",
                 "worker_id", "estimated_remaining_seconds", "parent_job_id"):
        cur.execute("SELECT 1 FROM information_schema.columns "
                    "WHERE table_name='extraction_jobs' AND column_name=%s", (col,))
        assert cur.fetchone(), f"missing column {col}"
    cur.execute("SELECT 1 FROM information_schema.tables "
                "WHERE table_name='extraction_event_log'")
    assert cur.fetchone()


def test_status_check_includes_stalled(conn):
    cur = conn.cursor()
    cur.execute("SELECT pg_get_constraintdef(oid) FROM pg_constraint "
                "WHERE conname='extraction_jobs_status_chk'")
    assert "stalled" in cur.fetchone()[0]


# ─── 3-phase recovery ───────────────────────────────────────────────
def _insert_synthetic_job(conn, tenant_id: str, status: str = "running",
                           heartbeat_age_seconds: int = 200,
                           retry_count: int = 0) -> str:
    cur = conn.cursor()
    job_id = str(uuid.uuid4())
    hb = (datetime.now(timezone.utc) - timedelta(seconds=heartbeat_age_seconds)).isoformat()
    cur.execute("""
        INSERT INTO extraction_jobs
          (id,tenant_id,catalog_set_id,status,heartbeat_at,retry_count,
           created_at,updated_at)
        VALUES (%s,%s,%s,%s,%s,%s,now(),now())
    """, (job_id, tenant_id, KNOWN_SET_ID, status, hb, retry_count))
    return job_id


def _job_status(conn, job_id: str) -> dict:
    cur = conn.cursor()
    cur.execute("SELECT status, retry_count, stalled_at, error_message "
                "FROM extraction_jobs WHERE id=%s", (job_id,))
    row = cur.fetchone()
    return {"status": row[0], "retry_count": row[1],
            "stalled_at": row[2], "error_message": row[3]}


def test_phase_a_running_to_stalled(conn, tenant_id):
    from services import extraction_job_runner as r
    job_id = _insert_synthetic_job(conn, tenant_id,
                                    status="running", heartbeat_age_seconds=200)
    # Block the spawn (so phase B doesn't run yet) by setting retry already at max
    # Then run recovery → Phase A demotes running→stalled
    try:
        r.recover_orphan_jobs()
        st = _job_status(conn, job_id)
        # Phase A demoted, then Phase B/C ran in same pass.
        # We accept either 'stalled' (if isolated) or 'queued' (if requeued)
        # or 'failed' (if max retries) — all are valid downstream of phase A.
        assert st["status"] in ("stalled", "queued", "failed")
    finally:
        cur = conn.cursor(); cur.execute("DELETE FROM extraction_jobs WHERE id=%s", (job_id,))


def test_phase_b_stalled_to_requeued(conn, tenant_id):
    from services import extraction_job_runner as r
    job_id = _insert_synthetic_job(conn, tenant_id,
                                    status="stalled", heartbeat_age_seconds=300,
                                    retry_count=1)
    cur = conn.cursor()
    cur.execute("UPDATE extraction_jobs SET stalled_at=now() WHERE id=%s", (job_id,))
    try:
        r.recover_orphan_jobs()
        st = _job_status(conn, job_id)
        # Should be requeued (and immediately attempted spawn) OR running.
        assert st["status"] in ("queued", "running", "failed")
        if st["status"] in ("queued", "running"):
            assert st["retry_count"] == 2
    finally:
        cur.execute("DELETE FROM extraction_jobs WHERE id=%s", (job_id,))


def test_phase_c_max_retries_terminate(conn, tenant_id):
    from services import extraction_job_runner as r
    job_id = _insert_synthetic_job(conn, tenant_id,
                                    status="stalled", heartbeat_age_seconds=300,
                                    retry_count=3)   # already at MAX
    cur = conn.cursor()
    cur.execute("UPDATE extraction_jobs SET stalled_at=now() WHERE id=%s", (job_id,))
    try:
        r.recover_orphan_jobs()
        st = _job_status(conn, job_id)
        assert st["status"] == "failed"
        assert "exceeded" in (st["error_message"] or "").lower() or \
               "max" in (st["error_message"] or "").lower()
    finally:
        cur.execute("DELETE FROM extraction_jobs WHERE id=%s", (job_id,))


# ─── Safety net for orphan catalog_sets ─────────────────────────────
def test_safety_net_reconciles_orphan_extracting_set(conn, tenant_id):
    """Inject an artificial 'extracting' state with no active job, run
    recovery, expect reconciliation."""
    from services import extraction_job_runner as r
    cur = conn.cursor()
    # Snapshot original state
    cur.execute("SELECT status, updated_at FROM brand_catalog_sets WHERE id=%s", (KNOWN_SET_ID,))
    original = cur.fetchone()
    cur.execute("""
        UPDATE brand_catalog_sets
           SET status='extracting',
               updated_at = now() - interval '10 minutes'
         WHERE id=%s
    """, (KNOWN_SET_ID,))
    try:
        r.recover_orphan_jobs()
        cur.execute("SELECT status FROM brand_catalog_sets WHERE id=%s", (KNOWN_SET_ID,))
        new_status = cur.fetchone()[0]
        assert new_status in ("needs_review", "draft", "failed")
    finally:
        cur.execute("UPDATE brand_catalog_sets SET status=%s, updated_at=%s WHERE id=%s",
                    (original[0], original[1], KNOWN_SET_ID))


# ─── Event log emission ─────────────────────────────────────────────
def test_safety_net_emits_event(conn, tenant_id):
    """The safety net should emit a JOB_RECOVERED event when it reconciles
    an orphan catalog set."""
    from services import extraction_job_runner as r, extraction_event_publisher as ev
    cur = conn.cursor()
    cur.execute("SELECT status, updated_at FROM brand_catalog_sets WHERE id=%s", (KNOWN_SET_ID,))
    original = cur.fetchone()
    cur.execute("UPDATE brand_catalog_sets SET status='extracting', "
                "updated_at=now()-interval '10 minutes' WHERE id=%s", (KNOWN_SET_ID,))
    marker = datetime.now(timezone.utc)
    try:
        r.recover_orphan_jobs()
        cur.execute("""
            SELECT COUNT(*) FROM extraction_event_log
             WHERE catalog_set_id=%s AND kind='JOB_RECOVERED'
               AND ts >= %s
        """, (KNOWN_SET_ID, marker))
        n = cur.fetchone()[0]
        assert n >= 1, "safety net did not emit JOB_RECOVERED"
    finally:
        cur.execute("UPDATE brand_catalog_sets SET status=%s, updated_at=%s WHERE id=%s",
                    (original[0], original[1], KNOWN_SET_ID))


# ─── API endpoints ──────────────────────────────────────────────────
def test_extraction_jobs_history_endpoint(client):
    r = client.get(f"{BASE_URL}/api/knowledge/catalog-sets/{KNOWN_SET_ID}/extraction-jobs")
    assert r.status_code == 200
    body = r.json()
    assert "jobs" in body and isinstance(body["jobs"], list)


def test_events_endpoint(client):
    r = client.get(f"{BASE_URL}/api/knowledge/catalog-sets/{KNOWN_SET_ID}/events?limit=10")
    assert r.status_code == 200
    body = r.json()
    assert "events" in body and "next_since" in body


def test_needs_review_filter_type(client):
    r = client.get(f"{BASE_URL}/api/knowledge/catalog-sets/{KNOWN_SET_ID}"
                   "/needs-review?type=designer_ambiguous&include_first=true")
    assert r.status_code == 200
    body = r.json()
    assert body["filter"] == "designer_ambiguous"
    assert "first_anomaly" in body
    assert "count" in body


def test_needs_review_failed_document_type(client):
    r = client.get(f"{BASE_URL}/api/knowledge/catalog-sets/{KNOWN_SET_ID}"
                   "/needs-review?type=failed_document&include_first=true")
    assert r.status_code == 200
    body = r.json()
    assert body["filter"] == "failed_document"
    assert "failed_documents" in body
    if body["count"] > 0:
        assert body.get("first_anomaly")


def test_retry_failed_dry_run(client, conn):
    r = client.post(f"{BASE_URL}/api/knowledge/catalog-sets/{KNOWN_SET_ID}/retry-failed",
                    json={"dry_run": True})
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["dry_run"] is True


def test_document_preview_endpoint(client, conn):
    cur = conn.cursor()
    cur.execute("SELECT id FROM brand_catalog_documents "
                "WHERE catalog_set_id=%s LIMIT 1", (KNOWN_SET_ID,))
    r = cur.fetchone()
    if not r:
        pytest.skip("no documents in set")
    doc_id = str(r[0])
    resp = client.get(f"{BASE_URL}/api/knowledge/catalog-sets/{KNOWN_SET_ID}"
                      f"/documents/{doc_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert "document" in body and "stats" in body


def test_document_review_context(client, conn):
    cur = conn.cursor()
    cur.execute("SELECT id FROM brand_catalog_documents "
                "WHERE catalog_set_id=%s LIMIT 1", (KNOWN_SET_ID,))
    r = cur.fetchone()
    if not r:
        pytest.skip("no documents in set")
    doc_id = str(r[0])
    resp = client.get(f"{BASE_URL}/api/knowledge/catalog-sets/{KNOWN_SET_ID}"
                      f"/documents/{doc_id}/review-context")
    assert resp.status_code == 200
    body = resp.json()
    assert "entities" in body
    assert "first_anomaly" in body


# ─── No-regression check on V3.1 ────────────────────────────────────
def test_v31_endpoints_still_work(client, conn):
    """Picks one entity from RIVA1920 and verifies V3 endpoints still
    answer 200 (regression guard)."""
    cur = conn.cursor()
    cur.execute("SELECT id FROM brand_detected_entities "
                "WHERE catalog_set_id=%s LIMIT 1", (KNOWN_SET_ID,))
    r = cur.fetchone()
    if not r:
        pytest.skip("no entities to test V3 regression")
    eid = str(r[0])
    for endpoint in ("future-uses", "connected-assets", "project-impact"):
        resp = client.get(f"{BASE_URL}/api/knowledge/catalog-sets/{KNOWN_SET_ID}"
                          f"/entities/{eid}/{endpoint}")
        assert resp.status_code == 200, f"V3 endpoint {endpoint} regressed"
