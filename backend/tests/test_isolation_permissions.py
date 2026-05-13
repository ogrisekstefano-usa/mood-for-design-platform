"""Multi-tenant isolation + role-based permission gating regression tests.

Validates that the permission matrix in /app/memory/test_credentials.md holds.
Re-run after any change to require_permission / tenant_context / role decorators.
"""
import os
import pytest
import requests

API = os.environ.get("API_URL", "http://localhost:8001") + "/api"


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    r.raise_for_status()
    return r.json()["session"]["access_token"]


@pytest.fixture(scope="module")
def tokens():
    return {
        "super":     _login("demo@moodfordesign.com",     "Blueprint2024!"),
        "designer":  _login("designer@moodfordesign.com", "Designer2024!"),
        "client":    _login("client@moodfordesign.com",   "Client2024!"),
        "studio2":   _login("studio2@moodfordesign.com",  "Studio2024!"),
    }


def _get(path, token):
    return requests.get(f"{API}{path}", headers={"Authorization": f"Bearer {token}"}, timeout=10).status_code


def _post(path, token, json_body=None):
    return requests.post(f"{API}{path}", headers={"Authorization": f"Bearer {token}"},
                         json=json_body or {}, timeout=10).status_code


# ── /api/leads — only super + tenant_admin ─────────────────────────────────
def test_leads_read_gating(tokens):
    assert _get("/leads", tokens["super"])    == 200
    assert _get("/leads", tokens["designer"]) == 403
    assert _get("/leads", tokens["client"])   == 403
    assert _get("/leads", tokens["studio2"])  == 200  # tenant_admin


def test_leads_write_gating(tokens):
    body = {"email": "x@y.com", "first_name": "X", "last_name": "Y"}
    assert _post("/leads", tokens["designer"], body) == 403
    assert _post("/leads", tokens["client"], body)   == 403


# ── /api/moodboards — write requires P_MOODBOARDS_WRITE ─────────────────────
def test_moodboards_write_gating(tokens):
    assert _post("/moodboards", tokens["designer"], {"title": "x"}) in (201, 200)
    assert _post("/moodboards", tokens["client"], {"title": "x"}) == 403


# ── /api/super — only super_admin ──────────────────────────────────────────
def test_super_admin_gating(tokens):
    assert _get("/super/tenants", tokens["super"])    == 200
    assert _get("/super/tenants", tokens["designer"]) == 403
    assert _get("/super/tenants", tokens["client"])   == 403
    assert _get("/super/tenants", tokens["studio2"])  == 403  # tenant_admin lacks super:tenants:read


# ── /api/insights — requires P_INSIGHTS_READ ───────────────────────────────
def test_insights_gating(tokens):
    assert _get("/insights/dashboard", tokens["super"])    == 200
    assert _get("/insights/dashboard", tokens["designer"]) == 403
    assert _get("/insights/dashboard", tokens["client"])   == 403
    assert _get("/insights/dashboard", tokens["studio2"])  == 200  # tenant_admin has insights:read


# ── Cross-tenant data isolation ────────────────────────────────────────────
def test_cross_tenant_isolation(tokens):
    # Studio designer fetches a moodboard
    listing = requests.get(f"{API}/moodboards",
                           headers={"Authorization": f"Bearer {tokens['designer']}"},
                           timeout=10).json()
    studio_ids = [m["id"] for m in listing.get("data", [])]
    assert len(studio_ids) > 0, "Designer should see Studio moodboards"

    # studio2 (Showroom tenant_admin) should NOT be able to read those
    for mb_id in studio_ids[:2]:
        sc = _get(f"/moodboards/{mb_id}", tokens["studio2"])
        assert sc == 404, f"Cross-tenant leak: studio2 read Studio's moodboard {mb_id}"

    # studio2's own list
    showroom_list = requests.get(f"{API}/moodboards",
                                 headers={"Authorization": f"Bearer {tokens['studio2']}"},
                                 timeout=10).json()
    showroom_ids = {m["id"] for m in showroom_list.get("data", [])}
    assert showroom_ids.isdisjoint(set(studio_ids)), "Cross-tenant moodboard leak"
