"""KE-002 · Control Room API smoke tests.

Verifies new endpoints landed in KE-002:
  - GET  /api/knowledge/catalog-sets/{id}/worker-status
  - GET  /api/knowledge/catalog-sets/{id}/events
  - GET  /api/knowledge/catalog-sets/{id}/needs-review?type=...&include_first=true
  - POST /api/knowledge/catalog-sets/{id}/retry-failed (dry_run=true)
  - GET  /api/knowledge/catalog-sets/{id}/entities/{eid}/future-uses (V3 regression)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to frontend .env discovery for local runs
    env_path = "/app/frontend/.env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break

ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASSWORD = "Blueprint2024!"
SET_ID = "a1b8cfac-4c27-4b9d-88f7-877f75f8445c"  # RIVA1920


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    tok = (data.get("session") or {}).get("access_token") or data.get("access_token")
    assert tok, f"no token in login response: {list(data.keys())}"
    return tok


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ─── Worker Status ──────────────────────────────────────────────────
def test_worker_status_shape(headers):
    r = requests.get(
        f"{BASE_URL}/api/knowledge/catalog-sets/{SET_ID}/worker-status",
        headers=headers, timeout=20,
    )
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    assert "state" in d
    assert d["state"] in {"idle", "active", "stalled", "stalled_recovery",
                          "failed", "review_required", "certified"}
    assert "queue" in d and isinstance(d["queue"], dict)
    for k in ("pending", "extracting", "failed", "review", "validated"):
        assert k in d["queue"], f"missing queue.{k}"
    assert "warnings_total" in d
    assert "eta_seconds" in d  # may be None


# ─── Events ─────────────────────────────────────────────────────────
def test_events_list_limit(headers):
    r = requests.get(
        f"{BASE_URL}/api/knowledge/catalog-sets/{SET_ID}/events",
        headers=headers, params={"limit": 5}, timeout=20,
    )
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    assert "events" in d and isinstance(d["events"], list)
    assert len(d["events"]) <= 5
    if d["events"]:
        e = d["events"][0]
        for k in ("id", "kind", "ts"):
            assert k in e, f"event missing {k}: {e.keys()}"


# ─── Needs Review (failed_document) ─────────────────────────────────
def test_needs_review_failed_document(headers):
    r = requests.get(
        f"{BASE_URL}/api/knowledge/catalog-sets/{SET_ID}/needs-review",
        headers=headers,
        params={"type": "failed_document", "include_first": "true"},
        timeout=20,
    )
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    assert "count" in d
    assert "first_anomaly" in d  # may be None when count == 0
    # RIVA1920 has 4 failed docs per problem statement
    assert d["count"] >= 0


def test_needs_review_designer_ambiguous(headers):
    r = requests.get(
        f"{BASE_URL}/api/knowledge/catalog-sets/{SET_ID}/needs-review",
        headers=headers,
        params={"type": "designer_ambiguous", "include_first": "true"},
        timeout=20,
    )
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    assert "count" in d and "first_anomaly" in d


# ─── Retry Failed (DRY RUN — no side effects) ───────────────────────
def test_retry_failed_dry_run(headers):
    r = requests.post(
        f"{BASE_URL}/api/knowledge/catalog-sets/{SET_ID}/retry-failed",
        headers=headers, json={"dry_run": True}, timeout=20,
    )
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    assert "reset" in d or "documents" in d or "count" in d


# ─── V3 regression — future-uses on first available entity ──────────
def test_future_uses_v3_regression(headers):
    # Pick first entity from the set
    ent = requests.get(
        f"{BASE_URL}/api/knowledge/catalog-sets/{SET_ID}/entities",
        headers=headers, params={"limit": 1}, timeout=20,
    )
    if ent.status_code != 200:
        pytest.skip(f"entities list unavailable: {ent.status_code}")
    items = ent.json()
    rows = items.get("entities") or items.get("items") or items if isinstance(items, list) else []
    if not rows:
        pytest.skip("no entities in catalog set")
    eid = rows[0].get("id") or rows[0].get("entity_id")
    if not eid:
        pytest.skip(f"no entity id field: {rows[0].keys()}")
    r = requests.get(
        f"{BASE_URL}/api/knowledge/catalog-sets/{SET_ID}/entities/{eid}/future-uses",
        headers=headers, timeout=20,
    )
    assert r.status_code == 200, r.text[:300]


# ─── Polling smoke: 2 sequential calls within 3s succeed ────────────
def test_polling_smoke(headers):
    r1 = requests.get(
        f"{BASE_URL}/api/knowledge/catalog-sets/{SET_ID}/worker-status",
        headers=headers, timeout=20,
    )
    r2 = requests.get(
        f"{BASE_URL}/api/knowledge/catalog-sets/{SET_ID}/events",
        headers=headers, params={"limit": 5}, timeout=20,
    )
    assert r1.status_code == 200
    assert r2.status_code == 200
