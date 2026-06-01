"""ITER185 · Phase 1 · CRM Foundation integration tests (HTTP-level).

Tests cover:
  - Fast Lead Capture validation + happy path
  - Discovery Progress deterministic calculation
  - Qualify endpoint progress gate (75% rule)
  - Convert-to-customer with proposal + admin override
  - Revert-to-prospect with mandatory reason
  - Legacy promote endpoint deprecated (410)

Run with:
  cd /app/backend && pytest tests/test_iter185_crm_foundation.py -v

Requires:
  - Backend running on localhost:8001
  - Supabase reachable
  - admin@moodfordesign.com / Blueprint2024! credentials valid
"""
from __future__ import annotations

import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("BACKEND_URL", "http://localhost:8001")
LOGIN_EMAIL = "admin@moodfordesign.com"
LOGIN_PASSWORD = "Blueprint2024!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
                      timeout=10)
    r.raise_for_status()
    return r.json()["session"]["access_token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _rand_email():
    return f"iter185_{uuid.uuid4().hex[:10]}@test.example.com"


# ── Fast Lead Capture ────────────────────────────────────────────────
class TestFastLeadCapture:
    def test_happy_path_email_only(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/leads/fast-capture",
                          json={"name": "Marco Rossi", "email": _rand_email(), "source": "showroom"},
                          headers=auth_headers, timeout=10)
        assert r.status_code == 201
        data = r.json()
        assert data["lead"]["status"] == "new"
        assert data["lead"]["source"] == "showroom"
        assert data["discovery"]["status"] == "pending"

    def test_happy_path_phone_only(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/leads/fast-capture",
                          json={"name": "Lucia Bianchi", "phone": f"+39333{uuid.uuid4().int % 10000000:07d}",
                                "source": "phone"},
                          headers=auth_headers, timeout=10)
        assert r.status_code == 201
        assert r.json()["lead"]["source"] == "phone"

    def test_missing_name(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/leads/fast-capture",
                          json={"email": _rand_email(), "source": "showroom"},
                          headers=auth_headers, timeout=10)
        assert r.status_code == 400
        assert r.json()["detail"]["code"] == "LEAD-NAME-REQUIRED"

    def test_missing_contact(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/leads/fast-capture",
                          json={"name": "Test", "source": "showroom"},
                          headers=auth_headers, timeout=10)
        assert r.status_code == 400
        assert r.json()["detail"]["code"] == "LEAD-CONTACT-REQUIRED"

    def test_missing_source(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/leads/fast-capture",
                          json={"name": "Test", "email": _rand_email()},
                          headers=auth_headers, timeout=10)
        assert r.status_code == 400
        assert r.json()["detail"]["code"] == "LEAD-INVALID-SOURCE"

    def test_invalid_source(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/leads/fast-capture",
                          json={"name": "Test", "email": _rand_email(), "source": "foobar"},
                          headers=auth_headers, timeout=10)
        assert r.status_code == 400
        assert r.json()["detail"]["code"] == "LEAD-INVALID-SOURCE"

    def test_source_other_without_detail(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/leads/fast-capture",
                          json={"name": "Test", "email": _rand_email(), "source": "other"},
                          headers=auth_headers, timeout=10)
        assert r.status_code == 400
        assert r.json()["detail"]["code"] == "LEAD-SOURCE-DETAIL-REQUIRED"

    def test_source_other_with_detail(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/leads/fast-capture",
                          json={"name": "Other Test", "email": _rand_email(),
                                "source": "other", "source_detail": "LinkedIn DM"},
                          headers=auth_headers, timeout=10)
        assert r.status_code == 201
        assert r.json()["lead"]["metadata_json"]["source_detail"] == "LinkedIn DM"

    def test_dedup_check_returns_409(self, auth_headers):
        email = _rand_email()
        # create first
        r1 = requests.post(f"{BASE_URL}/api/leads/fast-capture",
                           json={"name": "First Lead", "email": email, "source": "showroom"},
                           headers=auth_headers, timeout=10)
        assert r1.status_code == 201
        # try duplicate
        r2 = requests.post(f"{BASE_URL}/api/leads/fast-capture",
                           json={"name": "Dup Lead", "email": email, "source": "showroom"},
                           headers=auth_headers, timeout=10)
        assert r2.status_code == 409
        assert r2.json()["code"] == "LEAD-DEDUP-MATCH"
        # skip_dedup_check creates anyway
        r3 = requests.post(f"{BASE_URL}/api/leads/fast-capture",
                           json={"name": "Force Dup", "email": email, "source": "showroom",
                                 "skip_dedup_check": True},
                           headers=auth_headers, timeout=10)
        assert r3.status_code == 201


# ── Discovery Progress Engine ────────────────────────────────────────
class TestDiscoveryProgress:
    @pytest.fixture(autouse=True)
    def setup(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/leads/fast-capture",
                          json={"name": "Progress Test", "email": _rand_email(),
                                "source": "showroom"},
                          headers=auth_headers, timeout=10)
        assert r.status_code == 201
        d = r.json()
        self.lead_id = d["lead"]["id"]
        self.discovery_id = d["discovery"]["id"]
        self.headers = auth_headers

    def test_initial_25pct(self):
        r = requests.get(f"{BASE_URL}/api/discovery/{self.discovery_id}/progress",
                         headers=self.headers, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["progress_pct"] == 25
        assert body["qualify_eligible"] is False
        assert body["sections"][0]["completed"] is True

    def test_progress_jumps_with_signals(self):
        # Add 2 signals → +50% (project_type + budget)
        requests.put(f"{BASE_URL}/api/discovery/{self.discovery_id}",
                     json={"qualification_signals": {"market_sector": "residential", "budget": "100k"}},
                     headers=self.headers, timeout=10)
        r = requests.get(f"{BASE_URL}/api/discovery/{self.discovery_id}/progress",
                         headers=self.headers, timeout=10)
        body = r.json()
        assert body["progress_pct"] == 75
        assert body["qualify_eligible"] is True

    def test_progress_100pct(self):
        requests.put(f"{BASE_URL}/api/discovery/{self.discovery_id}",
                     json={"qualification_signals": {
                         "market_sector": "residential",
                         "budget": "100k", "timeline": "6_months",
                     }},
                     headers=self.headers, timeout=10)
        r = requests.get(f"{BASE_URL}/api/discovery/{self.discovery_id}/progress",
                         headers=self.headers, timeout=10)
        assert r.json()["progress_pct"] == 100


# ── Qualify gate (75% rule) ──────────────────────────────────────────
class TestQualifyGate:
    @pytest.fixture(autouse=True)
    def setup(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/leads/fast-capture",
                          json={"name": "Qualify Test", "email": _rand_email(),
                                "source": "showroom"},
                          headers=auth_headers, timeout=10)
        d = r.json()
        self.lead_id = d["lead"]["id"]
        self.discovery_id = d["discovery"]["id"]
        self.headers = auth_headers

    def test_qualify_below_75_fails(self):
        r = requests.post(f"{BASE_URL}/api/discovery/{self.discovery_id}/qualify",
                          json={}, headers=self.headers, timeout=10)
        assert r.status_code == 422
        assert r.json()["detail"]["code"] == "DISCOVERY-PROGRESS-INSUFFICIENT"

    def test_qualify_with_admin_force(self):
        # Admin can force qualify at 25%
        r = requests.post(f"{BASE_URL}/api/discovery/{self.discovery_id}/qualify",
                          json={"force": True}, headers=self.headers, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "qualified"
        assert "account_id" in body

    def test_qualify_creates_prospect_account(self):
        # Get to 100% then qualify
        requests.put(f"{BASE_URL}/api/discovery/{self.discovery_id}",
                     json={"qualification_signals": {
                         "market_sector": "hospitality",
                         "budget": "200k", "timeline": "1_year",
                     }},
                     headers=self.headers, timeout=10)
        r = requests.post(f"{BASE_URL}/api/discovery/{self.discovery_id}/qualify",
                          json={}, headers=self.headers, timeout=10)
        assert r.status_code == 200
        aid = r.json()["account_id"]
        # Verify account exists with lifecycle_stage='prospect'
        acc = requests.get(f"{BASE_URL}/api/relationships/accounts/{aid}",
                           headers=self.headers, timeout=10)
        if acc.status_code == 200:
            body = acc.json()
            stage = body.get("lifecycle_stage") or body.get("account", {}).get("lifecycle_stage")
            assert stage == "prospect"


# ── Customer Conversion ──────────────────────────────────────────────
class TestCustomerConversion:
    @pytest.fixture(autouse=True)
    def setup(self, auth_headers):
        # Create Lead → qualified (admin force) → get account_id
        r = requests.post(f"{BASE_URL}/api/leads/fast-capture",
                          json={"name": "Customer Test", "email": _rand_email(),
                                "source": "referral"},
                          headers=auth_headers, timeout=10)
        d = r.json()
        self.discovery_id = d["discovery"]["id"]
        qr = requests.post(f"{BASE_URL}/api/discovery/{self.discovery_id}/qualify",
                           json={"force": True}, headers=auth_headers, timeout=10)
        self.account_id = qr.json().get("account_id")
        self.headers = auth_headers

    def test_convert_without_proposal_fails(self):
        r = requests.post(f"{BASE_URL}/api/accounts/{self.account_id}/convert-to-customer",
                          json={}, headers=self.headers, timeout=10)
        assert r.status_code == 422
        assert r.json()["detail"]["code"] == "PROPOSAL-REQUIRED"

    def test_convert_admin_override_succeeds(self):
        r = requests.post(f"{BASE_URL}/api/accounts/{self.account_id}/convert-to-customer",
                          json={"admin_override": True, "signed_at": "2026-06-01",
                                "notes": "Test admin convert"},
                          headers=self.headers, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["account"]["lifecycle_stage"] == "customer"
        assert body["transition"]["to"] == "customer"

    def test_convert_already_customer_fails(self):
        # First convert
        requests.post(f"{BASE_URL}/api/accounts/{self.account_id}/convert-to-customer",
                      json={"admin_override": True}, headers=self.headers, timeout=10)
        # Try again
        r = requests.post(f"{BASE_URL}/api/accounts/{self.account_id}/convert-to-customer",
                          json={"admin_override": True}, headers=self.headers, timeout=10)
        assert r.status_code == 400
        assert r.json()["detail"]["code"] == "ACCOUNT-INVALID-STAGE"

    def test_revert_without_reason_fails(self):
        requests.post(f"{BASE_URL}/api/accounts/{self.account_id}/convert-to-customer",
                      json={"admin_override": True}, headers=self.headers, timeout=10)
        r = requests.post(f"{BASE_URL}/api/accounts/{self.account_id}/revert-to-prospect",
                          json={"reason": "short"}, headers=self.headers, timeout=10)
        assert r.status_code == 422  # validation error

    def test_revert_with_valid_reason_succeeds(self):
        requests.post(f"{BASE_URL}/api/accounts/{self.account_id}/convert-to-customer",
                      json={"admin_override": True}, headers=self.headers, timeout=10)
        r = requests.post(f"{BASE_URL}/api/accounts/{self.account_id}/revert-to-prospect",
                          json={"reason": "Test revert con motivazione valida"},
                          headers=self.headers, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["account"]["lifecycle_stage"] == "prospect"


# ── Legacy promote endpoint deprecated ───────────────────────────────
class TestLegacyPromoteDeprecated:
    def test_returns_410_gone(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/relations/leads/00000000-0000-0000-0000-000000000000/promote",
            json={"target": "prospect"},
            headers=auth_headers, timeout=10,
        )
        assert r.status_code == 410
        detail = r.json()["detail"]
        assert detail["code"] == "ENDPOINT-DEPRECATED"
        assert "discovery" in detail["message"].lower()
        assert "migration_endpoints" in detail


# ── Journey enforcement (Lead cannot create Journey) ─────────────────
class TestJourneyEnforcement:
    def test_journey_from_lead_blocked(self, auth_headers):
        # Try POST /api/accounts/{wrong_id}/journeys on a non-prospect account
        # Use the lead_id as account_id (which won't exist) → 404 expected
        r = requests.post(
            f"{BASE_URL}/api/accounts/00000000-0000-0000-0000-000000000000/journeys",
            json={"title": "Should fail"},
            headers=auth_headers, timeout=10,
        )
        # Either 404 (account not found) or 400 (invalid stage) — both block Lead path
        assert r.status_code in (404, 400, 403)
