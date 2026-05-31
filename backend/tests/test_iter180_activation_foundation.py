"""ITER180 — ACTIVATION FOUNDATION™ backend tests.

Covers:
- GET /api/tenant-onboarding/activation-foundation (6-step state, RBAC)
- POST /api/tenant-onboarding/identity (admin only, payload patches)
- Copy Governance C3: catalogue must NOT contain banned words.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASSWORD = "Blueprint2024!"

BANNED_C3 = ["atmosfera", "cinematic", "ecosistema", "curatoriale"]


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


# ─────────────── GET /activation-foundation ───────────────
class TestActivationFoundationGet:
    def test_get_returns_6_steps(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/tenant-onboarding/activation-foundation",
            headers=admin_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # Structure assertions
        assert "items" in data and isinstance(data["items"], list)
        assert data["total"] == 6
        assert len(data["items"]) == 6
        assert "completed" in data and isinstance(data["completed"], int)
        assert "progress" in data
        assert "activated" in data and isinstance(data["activated"], bool)
        assert "next_action" in data
        # Expected keys + order
        expected = ["identity", "blueprint", "team", "first_lead", "first_prospect", "first_journey"]
        actual = [it["key"] for it in data["items"]]
        assert actual == expected, f"Step order mismatch: {actual}"

    def test_each_step_has_required_fields(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/tenant-onboarding/activation-foundation",
            headers=admin_headers, timeout=20,
        )
        data = r.json()
        for it in data["items"]:
            for f in ("key", "ordinal", "title", "description", "cta_label",
                      "cta_route", "critical", "done"):
                assert f in it, f"Missing field {f} in {it.get('key')}"
            assert isinstance(it["done"], bool)
            assert isinstance(it["critical"], bool)

    def test_identity_step_already_done_for_seed_tenant(self, admin_headers):
        # Per main agent: seed tenant has name+market=IT+lang=it-IT+tz=Europe/Rome
        r = requests.get(
            f"{BASE_URL}/api/tenant-onboarding/activation-foundation",
            headers=admin_headers, timeout=20,
        )
        data = r.json()
        identity = next(it for it in data["items"] if it["key"] == "identity")
        assert identity["done"] is True, f"identity should be done for seed tenant. meta={identity.get('metadata')}"

    def test_next_action_is_first_missing_critical(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/tenant-onboarding/activation-foundation",
            headers=admin_headers, timeout=20,
        )
        data = r.json()
        # If not activated, next_action should be a critical step not done
        if not data["activated"]:
            na = data["next_action"]
            assert na is not None
            assert na["critical"] is True
            assert na["done"] is False
            # And it should be the FIRST such item
            for it in data["items"]:
                if it["critical"] and not it["done"]:
                    assert it["key"] == na["key"]
                    break

    def test_modal_route_for_new_relationship_ctas(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/tenant-onboarding/activation-foundation",
            headers=admin_headers, timeout=20,
        )
        items = {it["key"]: it for it in r.json()["items"]}
        # first_lead + first_journey must route to modal:new-relationship
        assert items["first_lead"]["cta_route"] == "modal:new-relationship"
        assert items["first_journey"]["cta_route"] == "modal:new-relationship"
        # identity goes to /settings/identity
        assert items["identity"]["cta_route"] == "/settings/identity"

    def test_unauthenticated_returns_401(self):
        r = requests.get(
            f"{BASE_URL}/api/tenant-onboarding/activation-foundation",
            timeout=20,
        )
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"


# ─────────────── POST /identity ───────────────
class TestIdentityPost:
    def test_admin_can_save_identity(self, admin_headers):
        payload = {
            "name": "MOOD for DESIGN",
            "primary_market": "IT",
            "language": "it-IT",
            "timezone": "Europe/Rome",
        }
        r = requests.post(
            f"{BASE_URL}/api/tenant-onboarding/identity",
            headers=admin_headers, json=payload, timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        # patch should include the language and possibly branding_settings
        patch = data.get("patch", {})
        assert patch.get("default_language") == "it-IT"
        assert patch.get("default_locale_code") == "it-IT"
        bs = patch.get("branding_settings") or {}
        assert bs.get("primary_market") == "IT"
        assert bs.get("timezone") == "Europe/Rome"

    def test_partial_update_preserves_branding(self, admin_headers):
        # Only patch language
        r = requests.post(
            f"{BASE_URL}/api/tenant-onboarding/identity",
            headers=admin_headers,
            json={"language": "it-IT"}, timeout=20,
        )
        assert r.status_code == 200, r.text
        # Verify via GET that identity is still done
        g = requests.get(
            f"{BASE_URL}/api/tenant-onboarding/activation-foundation",
            headers=admin_headers, timeout=20,
        )
        identity = next(it for it in g.json()["items"] if it["key"] == "identity")
        assert identity["done"] is True

    def test_unauthenticated_returns_401(self):
        r = requests.post(
            f"{BASE_URL}/api/tenant-onboarding/identity",
            json={"name": "X"}, timeout=20,
        )
        assert r.status_code in (401, 403)


# ─────────────── Copy Governance C3 ───────────────
class TestCopyGovernanceC3:
    def test_catalogue_no_banned_words(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/tenant-onboarding/activation-foundation",
            headers=admin_headers, timeout=20,
        )
        data = r.json()
        blob = ""
        for it in data["items"]:
            blob += f" {it.get('title','')} {it.get('description','')} {it.get('cta_label','')}"
        low = blob.lower()
        for w in BANNED_C3:
            assert w not in low, f"Banned C3 term '{w}' present in catalogue: {blob}"
