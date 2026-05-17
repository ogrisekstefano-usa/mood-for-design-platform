"""Phase R-CRM-2A — Regression tests for existing CRM endpoints.

Validates that after the locale-aware lookups refactor the existing
relationship/account endpoints still respond correctly:
  • GET /api/relationships/accounts  → list (paginated envelope)
  • GET /api/relationships/accounts/{id}
  • POST /api/relationships/accounts/{id}/stage (stage transition)
  • Stage values used must exist in the lookup catalog

Run:
  cd /app/backend && REACT_APP_BACKEND_URL=https://... \
      pytest tests/test_phase_r_crm_2a_regression.py -v
"""
import os
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL must be set"

DEMO_EMAIL = "demo@moodfordesign.com"
DEMO_PASSWORD = "Blueprint2024!"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(
        f"{BASE}/api/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()["session"]["access_token"]


@pytest.fixture(scope="module")
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture(scope="module")
def lookups(headers):
    r = requests.get(f"{BASE}/api/relationships/lookups", headers=headers, timeout=10)
    r.raise_for_status()
    return r.json()["lookups"]


# ---------- accounts list ----------
def test_accounts_list_returns_envelope(headers):
    r = requests.get(f"{BASE}/api/relationships/accounts", headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    payload = r.json()
    # The endpoint should return either {data:[...], total:N} or {accounts:[...]}
    items = payload.get("data") or payload.get("accounts") or payload.get("items")
    assert isinstance(items, list), f"Expected list of accounts, got {type(items)}: {payload}"
    # Demo tenant should have 59 migrated accounts (per session context)
    assert len(items) > 0, "Expected demo tenant to expose accounts"


def test_accounts_list_uses_known_stages(headers, lookups):
    """Every account stage must be one of the seeded lifecycle_stage value_keys."""
    valid_stages = {e["value_key"] for e in lookups["lifecycle_stage"]}
    r = requests.get(f"{BASE}/api/relationships/accounts", headers=headers, timeout=15)
    items = r.json().get("data") or r.json().get("accounts") or []
    for acct in items[:25]:
        stage = (
            acct.get("lifecycle_stage")
            or acct.get("stage")
            or acct.get("status")
        )
        if stage:  # some accounts may legitimately be null
            assert stage in valid_stages, (
                f"account {acct.get('id')} has unknown stage '{stage}' "
                f"not in lookup catalog {valid_stages}"
            )


# ---------- account detail ----------
def test_account_detail_returns_full_record(headers):
    r = requests.get(f"{BASE}/api/relationships/accounts", headers=headers, timeout=15)
    items = r.json().get("data") or r.json().get("accounts") or []
    if not items:
        pytest.skip("No accounts in tenant — cannot test detail")
    aid = items[0].get("id")
    assert aid, "first account has no id"

    rd = requests.get(
        f"{BASE}/api/relationships/accounts/{aid}", headers=headers, timeout=15
    )
    assert rd.status_code == 200, rd.text
    body = rd.json()
    # account body or wrapper
    acct = body.get("account") or body
    assert acct.get("id") == aid
    # MongoDB ObjectId leak check
    assert "_id" not in acct, "_id (MongoDB ObjectId) leaked into account response"


def test_account_detail_404_for_unknown(headers):
    r = requests.get(
        f"{BASE}/api/relationships/accounts/00000000-0000-0000-0000-000000000000",
        headers=headers,
        timeout=10,
    )
    assert r.status_code in (404, 400), r.text


# ---------- stage transition ----------
def test_account_stage_transition_round_trip(headers, lookups):
    """POST stage with a known value_key from lookup — must persist."""
    r = requests.get(f"{BASE}/api/relationships/accounts", headers=headers, timeout=15)
    items = r.json().get("data") or r.json().get("accounts") or []
    if not items:
        pytest.skip("No accounts to test stage transition on")
    aid = items[0]["id"]
    current = items[0].get("lifecycle_stage") or items[0].get("stage")

    # pick a target stage that differs from current
    stages = [e["value_key"] for e in lookups["lifecycle_stage"]]
    target = next((s for s in stages if s != current), stages[0])

    r = requests.post(
        f"{BASE}/api/relationships/accounts/{aid}/stage",
        headers=headers,
        json={"stage": target, "lifecycle_stage": target},
        timeout=15,
    )
    # Endpoint may accept 200 or 204
    assert r.status_code in (200, 204), f"stage POST failed: {r.status_code} {r.text}"

    # Verify persisted
    rd = requests.get(
        f"{BASE}/api/relationships/accounts/{aid}", headers=headers, timeout=10
    )
    body = rd.json()
    acct = body.get("account") or body
    persisted = acct.get("lifecycle_stage") or acct.get("stage")
    assert persisted == target, f"stage not persisted: {persisted} != {target}"

    # Restore original (best-effort)
    if current and current != target:
        requests.post(
            f"{BASE}/api/relationships/accounts/{aid}/stage",
            headers=headers,
            json={"stage": current, "lifecycle_stage": current},
            timeout=10,
        )


def test_account_stage_rejects_unknown_value(headers):
    r = requests.get(f"{BASE}/api/relationships/accounts", headers=headers, timeout=15)
    items = r.json().get("data") or r.json().get("accounts") or []
    if not items:
        pytest.skip("No accounts available")
    aid = items[0]["id"]
    r = requests.post(
        f"{BASE}/api/relationships/accounts/{aid}/stage",
        headers=headers,
        json={"stage": "definitely_not_a_real_stage_xyz"},
        timeout=10,
    )
    assert r.status_code in (400, 422), (
        f"invalid stage should be rejected, got {r.status_code}: {r.text}"
    )


# ---------- anonymous access denial ----------
def test_accounts_requires_auth():
    r = requests.get(f"{BASE}/api/relationships/accounts", timeout=10)
    assert r.status_code in (401, 403)
