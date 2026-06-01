"""ITER181.A — Dashboard Refocus™ backend tests.

Covers:
- GET /api/tenant-onboarding/activation-foundation must now return EXACTLY 5
  setup-only steps (identity, blueprint, team, market, workspace).
- Old keys (first_lead, first_prospect, first_journey) MUST be absent.
- Response must include new business_counts payload (leads/prospects/customers/active_journeys).
- POST /api/tenant-onboarding/identity remains admin-only and idempotent.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASSWORD = "Blueprint2024!"

EXPECTED_KEYS = ["identity", "blueprint", "team", "market", "workspace"]
LEGACY_KEYS = {"first_lead", "first_prospect", "first_journey"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = (data.get("session") or {}).get("access_token") or data.get("access_token")
    assert tok, f"No access_token in login payload: {data}"
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ─────────── GET /activation-foundation (ITER181.A · 5 steps) ───────────
class TestActivationFoundation5Steps:
    def test_returns_exactly_5_steps_in_order(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/tenant-onboarding/activation-foundation",
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["total"] == 5, f"Expected total=5, got {data['total']}"
        assert isinstance(data["items"], list)
        assert len(data["items"]) == 5
        actual_keys = [it["key"] for it in data["items"]]
        assert actual_keys == EXPECTED_KEYS, f"Step order mismatch: {actual_keys}"

    def test_no_legacy_keys_present(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/tenant-onboarding/activation-foundation",
            headers=admin_headers, timeout=20,
        )
        assert r.status_code == 200
        keys = {it["key"] for it in r.json()["items"]}
        leaked = keys & LEGACY_KEYS
        assert not leaked, f"Legacy keys leaked: {leaked}"

    def test_each_item_has_required_fields(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/tenant-onboarding/activation-foundation",
            headers=admin_headers, timeout=20,
        )
        for it in r.json()["items"]:
            for f in ("key", "ordinal", "title", "description", "cta_label", "cta_route", "critical", "done"):
                assert f in it, f"Missing field {f} on {it.get('key')}"
            assert isinstance(it["done"], bool)
            assert isinstance(it["critical"], bool)

    def test_business_counts_present_and_typed(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/tenant-onboarding/activation-foundation",
            headers=admin_headers, timeout=20,
        )
        data = r.json()
        assert "business_counts" in data, "business_counts missing"
        bc = data["business_counts"]
        for f in ("leads", "prospects", "customers", "active_journeys"):
            assert f in bc, f"business_counts missing {f}"
            assert isinstance(bc[f], int), f"{f} not int (got {type(bc[f])})"
            assert bc[f] >= 0

    def test_progress_consistent_with_completed(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/tenant-onboarding/activation-foundation",
            headers=admin_headers, timeout=20,
        )
        d = r.json()
        expected_pct = round((d["completed"] / d["total"]) * 100) if d["total"] else 0
        assert d["progress"] == expected_pct
        assert d["activated"] == (d["completed"] == d["total"])

    def test_unauthenticated_request_blocked(self):
        r = requests.get(
            f"{BASE_URL}/api/tenant-onboarding/activation-foundation",
            timeout=20,
        )
        assert r.status_code in (401, 403), f"Expected auth challenge, got {r.status_code}"


# ─────────── POST /identity (admin only, idempotent partial update) ───────────
class TestIdentityEndpoint:
    def test_partial_update_returns_ok_idempotent(self, admin_headers):
        # Read current state first
        before = requests.get(
            f"{BASE_URL}/api/tenant-onboarding/activation-foundation",
            headers=admin_headers, timeout=20,
        ).json()
        identity_item = next(it for it in before["items"] if it["key"] == "identity")
        before_meta = identity_item.get("metadata", {}).get("values", {})
        current_name = before_meta.get("name") or "MOOD for DESIGN"

        # Idempotent re-save of the same name
        r = requests.post(
            f"{BASE_URL}/api/tenant-onboarding/identity",
            headers=admin_headers,
            json={"name": current_name},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert "patch" in body

        # Re-fetch — identity step must still be done if it was, and name unchanged
        after = requests.get(
            f"{BASE_URL}/api/tenant-onboarding/activation-foundation",
            headers=admin_headers, timeout=20,
        ).json()
        after_identity = next(it for it in after["items"] if it["key"] == "identity")
        assert after_identity["metadata"]["values"]["name"] == current_name

    def test_identity_endpoint_unauthenticated(self):
        r = requests.post(
            f"{BASE_URL}/api/tenant-onboarding/identity",
            json={"name": "anon"},
            timeout=20,
        )
        assert r.status_code in (401, 403)
