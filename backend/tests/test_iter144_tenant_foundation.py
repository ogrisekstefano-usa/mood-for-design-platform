"""ITER144 · Tenant Configuration Foundation™ — regression suite.

Verifies:
  - feature_modules_registry seeded (≥27 rows, all groups present)
  - GET /api/tenant/configuration returns full bundle for tenant_admin
  - PATCH /api/tenant/configuration · branding & navigation_overrides
  - root sees /platform group, tenant_admin doesn't
  - PATCH /api/blueprint-admin/feature-modules/{code} mutates platform default
  - core modules cannot be disabled
  - tenant_admin cannot reach blueprint-admin endpoints (403)
  - configuration_change_events audit trail records every PATCH
"""
import os
import json
import time
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

BACKEND = "http://127.0.0.1:8001"
SUPABASE_URL = os.environ["SUPABASE_URL"]
ANON_KEY = os.environ["SUPABASE_ANON_KEY"]


def _login(email: str, pw: str) -> str:
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        json={"email": email, "password": pw},
        headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def tok_root():
    return _login("admin@moodfordesign.com", "Blueprint2024!")


@pytest.fixture(scope="session")
def tok_tadmin():
    return _login("demo@moodfordesign.com", "Blueprint2024!")


def _call(method, path, token, body=None):
    headers = {"Authorization": f"Bearer {token}"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    r = requests.request(method, f"{BACKEND}{path}",
                         data=json.dumps(body) if body else None,
                         headers=headers, timeout=15)
    return r


# ── Tests ────────────────────────────────────────────────────────────
def test_get_tenant_configuration_for_root(tok_root):
    r = _call("GET", "/api/tenant/configuration", tok_root)
    assert r.status_code == 200
    b = r.json()
    assert b["tenant_id"]
    assert b["theme"]["color_primary"]
    assert len(b["modules"]) >= 27
    groups = [g["code"] for g in b["navigation"]]
    # root sees every group including platform
    assert "platform" in groups
    assert "studio-pulse" in groups
    assert "design-journey" in groups


def test_get_tenant_configuration_for_tenant_admin(tok_tadmin):
    r = _call("GET", "/api/tenant/configuration", tok_tadmin)
    assert r.status_code == 200
    b = r.json()
    groups = [g["code"] for g in b["navigation"]]
    assert "platform" not in groups, "tenant_admin must NOT see /platform group"
    assert "content-studio" in groups
    assert "studio-pulse" in groups


def test_patch_branding_persists_and_resolves(tok_tadmin):
    payload = {
        "branding": {
            "color_primary": "#ff00aa",
            "monogram": "Ω",
            "font_heading": "DM Serif Display",
        },
    }
    r = _call("PATCH", "/api/tenant/configuration", tok_tadmin, payload)
    assert r.status_code == 200
    b = r.json()
    assert b["theme"]["color_primary"] == "#ff00aa"
    assert b["theme"]["monogram"] == "Ω"
    assert b["theme"]["font_heading"] == "DM Serif Display"
    # cleanup
    _call("PATCH", "/api/tenant/configuration", tok_tadmin, {"branding": {}})


def test_patch_navigation_overrides_hide_and_rename(tok_tadmin):
    payload = {"navigation_overrides": {
        "hide_modules": ["crm_accounts"],
        "rename_sections": {"studio-os": "Operations"},
    }}
    r = _call("PATCH", "/api/tenant/configuration", tok_tadmin, payload)
    assert r.status_code == 200
    b = r.json()
    cr = next((g for g in b["navigation"] if g["code"] == "client-relations"), None)
    assert cr is not None
    codes = [i["code"] for i in cr["items"]]
    assert "crm_accounts" not in codes
    sos = next((g for g in b["navigation"] if g["code"] == "studio-os"), None)
    assert sos["label"] == "Operations"
    # cleanup
    _call("PATCH", "/api/tenant/configuration", tok_tadmin, {"navigation_overrides": {}})


def test_blueprint_admin_feature_modules_listing(tok_root):
    r = _call("GET", "/api/blueprint-admin/feature-modules", tok_root)
    assert r.status_code == 200
    b = r.json()
    assert len(b["modules"]) >= 27
    codes = {m["code"] for m in b["modules"]}
    for must in ("dashboard", "blueprint_admin", "crm_accounts",
                 "editorial_calendar", "settings_workspace"):
        assert must in codes, f"module {must} missing from registry"


def test_blueprint_admin_patch_platform_default(tok_root, tok_tadmin):
    # Flip insights → beta
    r = _call("PATCH",
              "/api/blueprint-admin/feature-modules/insights",
              tok_root, {"state": "beta"})
    assert r.status_code == 200
    # Cache TTL is 60s. Force-refresh by sleeping is unacceptable; call
    # the resolver via API and rely on the invalidation hook.
    r2 = _call("GET", "/api/tenant/configuration", tok_tadmin)
    insights = next(m for m in r2.json()["modules"] if m["code"] == "insights")
    assert insights["state"] == "beta"
    assert insights["source"] == "platform_default"
    # restore
    _call("PATCH",
          "/api/blueprint-admin/feature-modules/insights",
          tok_root, {"state": "enabled"})


def test_core_module_cannot_be_disabled(tok_root):
    r = _call("PATCH",
              "/api/blueprint-admin/feature-modules/dashboard",
              tok_root, {"state": "disabled"})
    assert r.status_code == 400
    assert "core" in r.json()["detail"].lower()


def test_tenant_admin_cannot_reach_blueprint_admin(tok_tadmin):
    r = _call("GET", "/api/blueprint-admin/feature-modules", tok_tadmin)
    assert r.status_code == 403
    r = _call("PATCH",
              "/api/blueprint-admin/feature-modules/insights",
              tok_tadmin, {"state": "beta"})
    assert r.status_code == 403


def test_configuration_change_events_audit_trail(tok_root, tok_tadmin):
    # Generate a fresh patch to ensure it lands in the trail
    _call("PATCH", "/api/tenant/configuration", tok_tadmin,
          {"branding": {"monogram": "Δ"}})
    r = _call("GET",
              "/api/blueprint-admin/configuration-events?limit=20",
              tok_root)
    assert r.status_code == 200
    b = r.json()
    assert b["count"] >= 1
    # most recent event should be tenant.configuration.patch
    types = {e["event_type"] for e in b["events"][:10]}
    assert "tenant.configuration.patch" in types
    # Each event has the actor email
    assert any(e["actor_email"] for e in b["events"][:10])
    # cleanup
    _call("PATCH", "/api/tenant/configuration", tok_tadmin, {"branding": {}})


def test_admin_patch_tenant_configuration_via_blueprint_admin(tok_root, tok_tadmin):
    # Root can read demo tenant's config and patch it
    me = _call("GET", "/api/tenant/configuration", tok_tadmin).json()
    tid = me["tenant_id"]
    r = _call("GET",
              f"/api/blueprint-admin/tenants/{tid}/configuration", tok_root)
    assert r.status_code == 200
    r2 = _call("PATCH",
               f"/api/blueprint-admin/tenants/{tid}/configuration",
               tok_root, {"editorial_tone": "luxury_minimal"})
    assert r2.status_code == 200
    assert r2.json()["configuration"]["editorial_tone"] == "luxury_minimal"


def test_modules_endpoint_returns_effective_state(tok_tadmin):
    r = _call("GET", "/api/tenant/configuration/modules", tok_tadmin)
    assert r.status_code == 200
    mods = r.json()["modules"]
    by_code = {m["code"]: m for m in mods}
    assert by_code["dashboard"]["effective_state"] == "enabled"
    assert by_code["dashboard"]["is_core"] is True
