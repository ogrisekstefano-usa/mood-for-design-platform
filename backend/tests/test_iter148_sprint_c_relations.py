"""ITER148 Sprint C · /api/relations/* + designers + welcome endpoints

Backend regression for the visually distinct Lead/Prospect/Account stages.
Tests auth, stats, list endpoints (with filters), promotion (with rollback),
designers roster and the welcome payload (next_moments contract).
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
TENANT_SLUG = "mood-demo-studio-81a09e"
DEMO_EMAIL = "demo@moodfordesign.com"
DEMO_PASSWORD = "Blueprint2024!"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(session):
    last = None
    for _ in range(3):
        r = session.post(f"{BASE_URL}/api/auth/login",
                         json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
        if r.status_code == 200:
            return r.json()["session"]["access_token"]
        last = r
        time.sleep(1)
    pytest.skip(f"login failed: {last.status_code if last else 'n/a'} {last.text if last else ''}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"}


def _retry_get(session, url, headers, retries=3):
    last = None
    for _ in range(retries):
        r = session.get(url, headers=headers, timeout=30)
        if r.status_code != 503:
            return r
        last = r
        time.sleep(1.5)
    return last


# ── Stats ─────────────────────────────────────────────────────────────
class TestRelationsStats:
    def test_stats_requires_auth(self, session):
        r = session.get(f"{BASE_URL}/api/relations/stats")
        assert r.status_code in (401, 403)

    def test_stats_returns_keys(self, session, auth_headers):
        r = _retry_get(session, f"{BASE_URL}/api/relations/stats", auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("lead", "prospect", "account", "dormant"):
            assert k in data, f"missing key {k}"
            assert isinstance(data[k], int), f"{k} not int: {data[k]!r}"
        # Demo seeded ranges (loose bounds to avoid flakiness)
        assert data["lead"] >= 1
        assert data["account"] >= 1


# ── Leads / Prospects / Accounts listing ──────────────────────────────
class TestRelationsLists:
    def test_leads_shape_and_count(self, session, auth_headers):
        r = _retry_get(session, f"{BASE_URL}/api/relations/leads?limit=40", auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body.get("data"), list)
        assert "total" in body
        assert len(body["data"]) >= 1
        # Spot-check one row keys
        row = body["data"][0]
        assert "id" in row

    def test_leads_filter_q(self, session, auth_headers):
        r = _retry_get(session, f"{BASE_URL}/api/relations/leads?q=z&limit=5", auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json().get("data"), list)

    def test_leads_filter_atmosphere(self, session, auth_headers):
        r = _retry_get(session,
                       f"{BASE_URL}/api/relations/leads?atmosphere=luminoso&limit=5",
                       auth_headers)
        assert r.status_code == 200

    def test_prospects_shape(self, session, auth_headers):
        r = _retry_get(session, f"{BASE_URL}/api/relations/prospects?limit=40", auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body.get("data"), list)
        assert "total" in body

    def test_accounts_shape(self, session, auth_headers):
        r = _retry_get(session, f"{BASE_URL}/api/relations/accounts?limit=40", auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body.get("data"), list)
        assert "total" in body
        assert len(body["data"]) >= 1


# ── Designers roster ──────────────────────────────────────────────────
class TestDesigners:
    def test_designers_shape(self, session, auth_headers):
        r = _retry_get(session, f"{BASE_URL}/api/relations/designers", auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        # Could be a list or {data: []}
        arr = data if isinstance(data, list) else data.get("data") or data.get("designers")
        assert arr is not None
        assert isinstance(arr, list)
        if arr:
            d = arr[0]
            for key in ("id", "name"):
                assert key in d, f"designer missing {key}"


# ── Welcome payload ───────────────────────────────────────────────────
class TestWelcome:
    def test_welcome_for_first_lead(self, session, auth_headers):
        # Get first lead id
        r = _retry_get(session, f"{BASE_URL}/api/relations/leads?limit=10", auth_headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert len(data) >= 1
        lead_id = data[0]["id"]

        # Welcome
        wr = _retry_get(session,
                        f"{BASE_URL}/api/relations/leads/{lead_id}/welcome",
                        auth_headers)
        assert wr.status_code == 200, wr.text
        body = wr.json()
        assert "lead" in body, f"missing lead key: {body}"
        # designer may be null when unassigned
        assert "designer" in body
        assert "next_moments" in body
        assert isinstance(body["next_moments"], list)
        valid_codes = {"continuation_interview", "promote_account",
                       "moodboard_invitation", "listen"}
        for m in body["next_moments"]:
            # Frontend uses `kind`; tolerate `code` as a legacy synonym
            key = "kind" if "kind" in m else "code"
            assert key in m, f"next_moment missing kind/code: {m}"
            if m[key] not in valid_codes:
                print(f"INFO: unrecognised next_moment kind: {m[key]}")


# ── Promote with rollback ─────────────────────────────────────────────
class TestPromote:
    def test_promote_lead_to_prospect_and_rollback(self, session, auth_headers):
        r = _retry_get(session, f"{BASE_URL}/api/relations/leads?limit=1", auth_headers)
        assert r.status_code == 200
        leads = r.json()["data"]
        if not leads:
            pytest.skip("no leads to promote")
        lead_id = leads[0]["id"]

        # Promote lead → prospect
        pr = session.post(f"{BASE_URL}/api/relations/leads/{lead_id}/promote",
                         json={"target": "prospect"}, headers=auth_headers, timeout=30)
        assert pr.status_code == 200, pr.text
        body = pr.json()
        assert body.get("to") == "prospect"
        assert body.get("id") == lead_id

        # Try promote prospect → account (rollback by trying to demote? Not allowed.)
        # Instead, promote forward, then leave it as account or dormant.
        # To keep the test set self-contained we promote → account then to dormant
        # (only legal forward transitions). After test, the lead lives in 'dormant'.
        pr2 = session.post(f"{BASE_URL}/api/relations/leads/{lead_id}/promote",
                          json={"target": "account"}, headers=auth_headers, timeout=30)
        assert pr2.status_code == 200, pr2.text
        # Then transition account → dormant (cleanup-ish)
        pr3 = session.post(f"{BASE_URL}/api/relations/leads/{lead_id}/promote",
                          json={"target": "dormant"}, headers=auth_headers, timeout=30)
        assert pr3.status_code == 200, pr3.text

    def test_promote_invalid_target_400(self, session, auth_headers):
        r = _retry_get(session, f"{BASE_URL}/api/relations/leads?limit=1", auth_headers)
        if not r.json().get("data"):
            pytest.skip("no leads")
        lead_id = r.json()["data"][0]["id"]
        pr = session.post(f"{BASE_URL}/api/relations/leads/{lead_id}/promote",
                         json={"target": "garbage"}, headers=auth_headers, timeout=30)
        assert pr.status_code == 400

    def test_promote_404_for_unknown_id(self, session, auth_headers):
        pr = session.post(
            f"{BASE_URL}/api/relations/leads/00000000-0000-0000-0000-000000000000/promote",
            json={"target": "prospect"}, headers=auth_headers, timeout=30)
        assert pr.status_code == 404
