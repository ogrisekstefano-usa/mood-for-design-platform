"""Iteration 75 — Daily Design Operations Cockpit™ backend tests.

Validates new fields suggested_actions[] and relationship_engine[] on
/api/dashboard/summary, the in-memory TTL cache (30s), and regression of
existing keys.
"""
import os
import time
import pytest
import requests
from pathlib import Path


def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if url:
        return url.rstrip("/")
    env_path = Path("/app/frontend/.env")
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().strip('"').rstrip("/")
    return ""


BASE_URL = _load_backend_url()
assert BASE_URL, "REACT_APP_BACKEND_URL is not set"
EMAIL = "demo@moodfordesign.com"
PASSWORD = "Blueprint2024!"


@pytest.fixture(scope="module")
def auth_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    body = r.json()
    sess = body.get("session") or {}
    token = sess.get("access_token") or body.get("access_token") or body.get("token") or (body.get("data") or {}).get("token")
    assert token, f"no token in login response: {list(body.keys())}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# -------- 1. Health / shape --------
class TestDashboardSummary:
    def test_summary_200(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/dashboard/summary", timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        # New keys
        assert "suggested_actions" in data
        assert "relationship_engine" in data
        # Regression: legacy keys still present
        for k in ["kpis", "featured_projects", "tasks", "recent_activity",
                  "media_preview", "top_materials", "team_activity", "timeline",
                  "recent_leads", "stale_project_ids", "design_references",
                  "operational_summary", "generated_at"]:
            assert k in data, f"missing key: {k}"

    def test_suggested_actions_shape(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/dashboard/summary", timeout=30)
        data = r.json()
        sa = data.get("suggested_actions") or []
        assert isinstance(sa, list)
        allowed = {"stale_project", "lead_followup", "proposal_silent", "moodboard_warm"}
        for s in sa:
            for f in ["id", "kind", "headline", "reason", "cta_label", "cta_to"]:
                assert f in s, f"suggested_action missing {f}: {s}"
            assert s["kind"] in allowed, f"unexpected kind: {s['kind']}"
            assert isinstance(s["headline"], str) and len(s["headline"]) > 0
            assert s["cta_to"].startswith("/"), f"cta_to should be relative: {s['cta_to']}"

    def test_relationship_engine_shape(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/dashboard/summary", timeout=30)
        data = r.json()
        re_list = data.get("relationship_engine") or []
        assert isinstance(re_list, list)
        for row in re_list:
            for f in ["account_id", "name", "market_code", "last_touch",
                      "days_since", "last_kind", "last_title"]:
                assert f in row, f"relationship_engine row missing {f}"
            if row.get("last_touch"):
                assert isinstance(row["days_since"], int)
                assert row["days_since"] >= 0


# -------- 2. Cache TTL --------
class TestDashboardCache:
    def test_cache_hit_under_500ms(self, auth_session):
        # cold or warm — just need 2nd to be fast
        auth_session.get(f"{BASE_URL}/api/dashboard/summary", timeout=30)
        t0 = time.perf_counter()
        r = auth_session.get(f"{BASE_URL}/api/dashboard/summary", timeout=30)
        elapsed_ms = (time.perf_counter() - t0) * 1000
        assert r.status_code == 200
        assert elapsed_ms < 500, f"cache hit too slow: {elapsed_ms:.0f}ms"

    def test_first_call_under_5s(self, auth_session):
        # Either cache still warm (instant) or cold (<5s). Either way <5s.
        t0 = time.perf_counter()
        r = auth_session.get(f"{BASE_URL}/api/dashboard/summary", timeout=30)
        elapsed = time.perf_counter() - t0
        assert r.status_code == 200
        assert elapsed < 5.0, f"summary too slow: {elapsed:.2f}s"


# -------- 3. No KPI/CRM English jargon --------
class TestEditorialLanguage:
    def test_no_kpi_jargon_in_operational_summary(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/dashboard/summary", timeout=30)
        data = r.json()
        forbidden = ["KPI", "CTR", "analytics"]
        for s in data.get("operational_summary") or []:
            for w in forbidden:
                assert w.lower() not in (s.get("text") or "").lower(), \
                    f"forbidden word {w} in operational_summary text: {s}"
