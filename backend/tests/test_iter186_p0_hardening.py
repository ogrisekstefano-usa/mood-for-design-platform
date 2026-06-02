"""ITER186.A · P0 Hardening Backend Tests.

Covers:
  - P0.5 · GET /api/relations/stats — canon-aligned counts
  - P0.7 · GET /api/tenant-onboarding/activation-foundation — 6 steps including first_lead
  - P0.1 · POST /api/email/admin/email-smoke-test — validation + env audit
  - P0.3 · GET /api/leads/{lead_id} — lead detail endpoint reachable
"""
import os
import pytest
import requests
from pathlib import Path

def _load_backend_url() -> str:
    val = os.environ.get("REACT_APP_BACKEND_URL")
    if not val:
        envp = Path("/app/frontend/.env")
        if envp.exists():
            for ln in envp.read_text().splitlines():
                if ln.startswith("REACT_APP_BACKEND_URL="):
                    val = ln.split("=", 1)[1].strip()
                    break
    return (val or "").rstrip("/")

BASE_URL = _load_backend_url()
ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASS = "Blueprint2024!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
               timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Login failed {r.status_code}: {r.text[:200]}")
    data = r.json()
    token = (
        (data.get("session") or {}).get("access_token")
        or data.get("access_token")
        or data.get("token")
    )
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ── P0.5 · /api/relations/stats ─────────────────────────────────────
class TestRelationsStats:
    def test_stats_returns_canon_keys(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/relations/stats", timeout=15)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        # Required canon keys
        for k in ("lead", "prospect", "customer", "account", "dormant"):
            assert k in data, f"missing key: {k}"
            assert isinstance(data[k], int)

    def test_account_equals_prospect_plus_customer(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/relations/stats", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["account"] == d["prospect"] + d["customer"], (
            f"account ({d['account']}) != prospect+customer ({d['prospect']}+{d['customer']})"
        )

    def test_dormant_is_zero_deprecated(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/relations/stats", timeout=15)
        assert r.json()["dormant"] == 0


# ── P0.7 · /api/tenant-onboarding/activation-foundation ─────────────
class TestActivationFoundation:
    EXPECTED_ORDER = ["identity", "blueprint", "team", "market", "workspace", "first_lead"]

    def test_returns_exactly_6_steps_in_order(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/tenant-onboarding/activation-foundation",
                              timeout=15)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        items = data.get("items") or []
        assert len(items) == 6, f"expected 6 steps got {len(items)}"
        keys = [i["key"] for i in items]
        assert keys == self.EXPECTED_ORDER, f"order mismatch: {keys}"

    def test_first_lead_step_canon(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/tenant-onboarding/activation-foundation",
                              timeout=15)
        items = r.json()["items"]
        fl = next(i for i in items if i["key"] == "first_lead")
        assert fl["critical"] is True
        assert fl["cta_route"] == "/relations/leads?new=1"
        assert fl["cta_label"] == "Crea il primo Lead"
        # metadata.count exposed
        meta = fl.get("metadata") or {}
        assert "count" in meta
        assert isinstance(meta["count"], int)

    def test_business_counts_present(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/tenant-onboarding/activation-foundation",
                              timeout=15)
        bc = r.json().get("business_counts") or {}
        for k in ("leads", "prospects", "customers", "active_journeys"):
            assert k in bc, f"missing business_counts.{k}"


# ── P0.1 · /api/email/admin/email-smoke-test ────────────────────────
class TestEmailSmokeTest:
    URL = "/api/email/admin/email-smoke-test"

    def test_missing_to_returns_400(self, admin_session):
        r = admin_session.post(f"{BASE_URL}{self.URL}", json={}, timeout=15)
        assert r.status_code == 400

    def test_invalid_to_no_at_returns_400(self, admin_session):
        r = admin_session.post(f"{BASE_URL}{self.URL}",
                               json={"to": "no-at-symbol"}, timeout=15)
        assert r.status_code == 400

    def test_valid_to_returns_env_audit(self, admin_session):
        # We use a clearly-test address; if RESEND_API_KEY is missing we get
        # ok=False with env audit. If present, the call should succeed or
        # return provider response. Either way 200 + env audit shape.
        r = admin_session.post(f"{BASE_URL}{self.URL}",
                               json={"to": "smoke-test@example.com"},
                               timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        d = r.json()
        env = d.get("env") or {}
        assert "api_key_present" in env
        assert "from_address" in env
        assert "reply_to" in env
        assert "next_steps" in d
        assert isinstance(d["next_steps"], list) and len(d["next_steps"]) > 0


# ── P0.3 · /api/leads/{lead_id} reachable ───────────────────────────
class TestLeadDetailEndpoint:
    def test_get_unknown_lead_returns_404(self, admin_session):
        # Use a syntactically valid uuid that doesn't exist
        fake_id = "00000000-0000-0000-0000-000000000000"
        r = admin_session.get(f"{BASE_URL}/api/leads/{fake_id}", timeout=15)
        # Must NOT 500 — must return 404 (or 422 for bad uuid)
        assert r.status_code in (404, 400), f"unexpected {r.status_code}: {r.text[:200]}"

    def test_create_fast_capture_and_fetch_detail(self, admin_session):
        # Create a lead via Fast Capture
        payload = {
            "name": "TESTITER186 P0Detail",
            "email": "TEST_iter186_p0detail@example.com",
            "source": "showroom",
        }
        r = admin_session.post(f"{BASE_URL}/api/leads/fast-capture",
                               json=payload, timeout=15)
        if r.status_code not in (200, 201):
            pytest.skip(f"fast-capture unavailable: {r.status_code} {r.text[:200]}")
        lead = r.json()
        lead_id = lead.get("id") or lead.get("lead_id") or (lead.get("lead") or {}).get("id")
        assert lead_id, f"no id in fast-capture response: {lead}"

        # Fetch detail
        r2 = admin_session.get(f"{BASE_URL}/api/leads/{lead_id}", timeout=15)
        assert r2.status_code == 200, f"{r2.status_code} {r2.text[:300]}"
        detail = r2.json()
        # Must contain the lead identifier
        assert (detail.get("id") == lead_id) or (
            (detail.get("lead") or {}).get("id") == lead_id
        )
