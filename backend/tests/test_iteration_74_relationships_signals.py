"""
Iteration 74 — MOOD for DESIGN™ Public Render Continuity™ + Market Signals™ 1.5 + Relationship Intelligence Foundation
Tests:
  1) GET /api/relationships/accounts/{aid}/graph  — schema + counts
  2) POST /api/market-intelligence/events  — cta_click/material_zoom accepted (204), bogus → 400
  3) Regression: /summary and /mood-signals still 200
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
SUPER_EMAIL = "demo@moodfordesign.com"
SUPER_PASS  = "Blueprint2024!"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": SUPER_EMAIL, "password": SUPER_PASS}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    sess  = data.get("session") or {}
    token = sess.get("access_token") or data.get("access_token") or data.get("token")
    assert token, f"No access_token in login response: {list(data.keys())}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    tenant_id = (data.get("user") or {}).get("tenant_id")
    s.tenant_id = tenant_id or "81a09ead-0306-4d71-a5c4-ca2b3956add2"
    s.auth_token = token
    return s


@pytest.fixture(scope="module")
def account_id(session):
    """Pick the first existing account in tenant; skip if none."""
    r = session.get(f"{BASE_URL}/api/relationships/accounts?limit=20", timeout=15)
    if r.status_code != 200:
        # try alternate listing
        r = session.get(f"{BASE_URL}/api/relationships/accounts", timeout=15)
    assert r.status_code == 200, f"List accounts failed: {r.status_code} {r.text[:200]}"
    payload = r.json()
    items = payload if isinstance(payload, list) else (payload.get("items") or payload.get("accounts") or [])
    if not items:
        pytest.skip("No accounts seeded in tenant")
    aid = items[0].get("id")
    assert aid, "Account id missing"
    return aid


# ─── Relationship Graph ────────────────────────────────────────────────
class TestRelationshipGraph:
    def test_graph_returns_200_and_schema(self, session, account_id):
        r = session.get(f"{BASE_URL}/api/relationships/accounts/{account_id}/graph", timeout=20)
        assert r.status_code == 200, f"Graph failed: {r.status_code} {r.text[:300]}"
        body = r.json()

        required_keys = {
            "account_id", "counts", "projects", "moodboards",
            "cultural_editions", "inspirations", "materials",
            "markets", "recent_signals", "editorial_summary",
        }
        missing = required_keys - set(body.keys())
        assert not missing, f"Missing keys in graph response: {missing}"

        # counts is dict[str, int]
        assert isinstance(body["counts"], dict), "counts must be a dict"
        for k, v in body["counts"].items():
            assert isinstance(v, int), f"counts[{k}] must be int, got {type(v).__name__}"

        # list fields
        for k in ("projects", "moodboards", "cultural_editions", "inspirations",
                  "materials", "markets", "recent_signals", "editorial_summary"):
            assert isinstance(body[k], list), f"{k} must be list"

        # editorial_summary non-empty list of strings
        assert len(body["editorial_summary"]) > 0, "editorial_summary must be non-empty"
        for line in body["editorial_summary"]:
            assert isinstance(line, str) and line.strip(), "editorial_summary entries must be non-empty strings"

        # account_id echo
        assert body["account_id"] == account_id

    def test_graph_404_for_bogus_account(self, session):
        r = session.get(f"{BASE_URL}/api/relationships/accounts/00000000-0000-0000-0000-000000000000/graph", timeout=10)
        assert r.status_code == 404, f"Expected 404, got {r.status_code}"


# ─── Regression: summary + mood-signals ────────────────────────────────
class TestRelationshipRegression:
    def test_summary_still_200(self, session, account_id):
        r = session.get(f"{BASE_URL}/api/relationships/accounts/{account_id}/summary", timeout=15)
        assert r.status_code == 200, f"Summary failed: {r.status_code} {r.text[:200]}"

    def test_mood_signals_still_200(self, session, account_id):
        r = session.get(f"{BASE_URL}/api/relationships/accounts/{account_id}/mood-signals", timeout=15)
        assert r.status_code == 200, f"Mood-signals failed: {r.status_code} {r.text[:200]}"


# ─── Market Intelligence events whitelist ──────────────────────────────
class TestMarketEvents:
    def _post(self, session, etype):
        return requests.post(
            f"{BASE_URL}/api/market-intelligence/events",
            json={"tenant_id": session.tenant_id, "event_type": etype},
            timeout=10,
        )

    def test_event_cta_click_accepted(self, session):
        r = self._post(session, "cta_click")
        assert r.status_code == 204, f"cta_click expected 204, got {r.status_code} {r.text[:200]}"

    def test_event_material_zoom_accepted(self, session):
        r = self._post(session, "material_zoom")
        assert r.status_code == 204, f"material_zoom expected 204, got {r.status_code} {r.text[:200]}"

    def test_event_gallery_open_accepted(self, session):
        r = self._post(session, "gallery_open")
        assert r.status_code == 204, f"gallery_open expected 204, got {r.status_code}"

    def test_event_hotspot_open_accepted(self, session):
        r = self._post(session, "hotspot_open")
        assert r.status_code == 204, f"hotspot_open expected 204, got {r.status_code}"

    def test_event_article_read_accepted(self, session):
        r = self._post(session, "article_read")
        assert r.status_code == 204, f"article_read expected 204, got {r.status_code}"

    def test_event_bogus_rejected_400(self, session):
        r = self._post(session, "totally_bogus_event")
        assert r.status_code == 400, f"Bogus event expected 400, got {r.status_code}"
