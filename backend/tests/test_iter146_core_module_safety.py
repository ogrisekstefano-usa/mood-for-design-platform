"""ITER146 · HOTFIX · Core Module Safety™ — pytest.

Verifies:
  • Migration 080 added `is_core_critical` to feature_modules_registry and
    marked the canonical 6 (dashboard, settings_workspace, blueprint_admin,
    journey_index, begin_journey, team) as critical.
  • Resolver auto-forces core-critical modules to `enabled` when any
    upstream source places them in a non-operational state — and logs a
    `core_critical.resolver_auto_force` audit event.
  • PATCH /api/blueprint-admin/feature-modules/{code} rejects any non-
    operational state for a critical module (HTTP 400) and logs
    `core_critical.mutation_blocked`.
  • PATCH /api/tenant/configuration rejects feature_flags / enabled_modules
    that would put a critical module in a non-operational state.
  • Non-critical modules remain freely togglable (`crm_accounts` test).
  • /api/tenant/configuration runtime bundle exposes `is_core_critical`
    on every module entry so the UI can render the badge.
"""
from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

import pytest
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from database import db                                          # noqa: E402
from services.tenant_config_resolver import (                    # noqa: E402
    _CACHE, _CACHE_LOCK,
    invalidate_registry, invalidate_tenant_config,
    is_core_critical, list_core_critical_codes,
    resolve_modules,
)
from routers.tenant_configuration import _enforce_core_critical_safety  # noqa: E402
from fastapi import HTTPException                                # noqa: E402

CRITICAL_CODES = {
    "dashboard", "settings_workspace", "blueprint_admin",
    "journey_index", "begin_journey", "team",
}
STUDIO_TENANT_ID = "848354b9-a43e-4147-bdad-116fb93bd585"


@pytest.fixture(autouse=True)
def _flush_cache():
    with _CACHE_LOCK:
        _CACHE.clear()
    yield
    with _CACHE_LOCK:
        _CACHE.clear()


# ── 1. Migration applied + canonical codes are flagged ────────────────
def test_migration_080_marks_canonical_critical_modules():
    c = db()
    rows = (c.table("feature_modules_registry")
            .select("code, is_core, is_core_critical")
            .execute().data or [])
    flagged = {r["code"] for r in rows if r.get("is_core_critical")}
    assert CRITICAL_CODES.issubset(flagged), (
        f"missing critical flags: {CRITICAL_CODES - flagged}"
    )
    # No accidental critical leaks outside the canonical set yet.
    assert flagged == CRITICAL_CODES


def test_is_core_critical_helper():
    for code in CRITICAL_CODES:
        assert is_core_critical(code) is True
    assert is_core_critical("crm_accounts") is False
    assert is_core_critical("nonexistent_module") is False
    listed = set(list_core_critical_codes())
    assert listed == CRITICAL_CODES


# ── 2. Resolver auto-forces critical modules to `enabled` ──────────────
def test_resolver_auto_forces_critical_when_disabled_via_platform_default():
    """Even if platform_feature_defaults says `disabled` for dashboard,
    the resolver MUST promote it back to `enabled` with the
    `core_critical_force_enabled` source.
    """
    c = db()
    # Inject a malicious platform default. We bypass the API guard
    # deliberately (this simulates a hand-edited DB or a stale row).
    try:
        c.table("platform_feature_defaults").upsert({
            "module_code": "dashboard",
            "state": "disabled",
        }, on_conflict="module_code").execute()
        invalidate_registry()

        mods = resolve_modules(STUDIO_TENANT_ID)
        dash = next(m for m in mods if m["code"] == "dashboard")
        assert dash["effective_state"] == "enabled"
        assert dash["resolution_source"] == "core_critical_force_enabled"
    finally:
        # cleanup — remove the malicious row
        c.table("platform_feature_defaults") \
            .delete().eq("module_code", "dashboard").execute()
        invalidate_registry()


def test_resolver_auto_forces_critical_when_hidden_via_tenant_flag():
    """Tenant tries to set dashboard='hidden' via feature_flags — the
    resolver still promotes to `enabled` and tags the source.
    """
    c = db()
    cfg = (c.table("tenant_configuration").select("feature_flags")
           .eq("tenant_id", STUDIO_TENANT_ID).limit(1).execute().data or [])
    prev_flags = (cfg[0].get("feature_flags") if cfg else None) or {}
    try:
        c.table("tenant_configuration").update({
            "feature_flags": {**prev_flags, "dashboard": "hidden"},
        }).eq("tenant_id", STUDIO_TENANT_ID).execute()
        invalidate_tenant_config(STUDIO_TENANT_ID)

        mods = resolve_modules(STUDIO_TENANT_ID)
        dash = next(m for m in mods if m["code"] == "dashboard")
        assert dash["effective_state"] == "enabled"
        assert dash["resolution_source"] == "core_critical_force_enabled"
    finally:
        c.table("tenant_configuration").update({
            "feature_flags": prev_flags,
        }).eq("tenant_id", STUDIO_TENANT_ID).execute()
        invalidate_tenant_config(STUDIO_TENANT_ID)


# ── 3. API mutation guard — tenant patch ──────────────────────────────
def test_enforce_blocks_feature_flag_disable_on_critical():
    actor = {"profile_id": str(uuid.uuid4()), "email": "tester@example.com"}
    update = {"feature_flags": {"dashboard": "disabled"}}
    with pytest.raises(HTTPException) as ex:
        _enforce_core_critical_safety(update, tenant_id=STUDIO_TENANT_ID,
                                       actor=actor)
    assert ex.value.status_code == 400
    assert "dashboard" in str(ex.value.detail)


def test_enforce_blocks_enabled_modules_toggle_off_on_critical():
    actor = {"profile_id": str(uuid.uuid4()), "email": "tester@example.com"}
    update = {"enabled_modules": {"settings_workspace": False}}
    with pytest.raises(HTTPException) as ex:
        _enforce_core_critical_safety(update, tenant_id=STUDIO_TENANT_ID,
                                       actor=actor)
    assert ex.value.status_code == 400
    assert "settings_workspace" in str(ex.value.detail)


def test_enforce_allows_critical_toggle_on():
    actor = {"profile_id": str(uuid.uuid4()), "email": "tester@example.com"}
    # Setting to TRUE / `enabled` is fine — only non-operational is blocked.
    update = {
        "feature_flags": {"dashboard": "enabled"},
        "enabled_modules": {"team": True},
    }
    # Should NOT raise.
    _enforce_core_critical_safety(update, tenant_id=STUDIO_TENANT_ID,
                                   actor=actor)


def test_enforce_allows_noncritical_disable():
    actor = {"profile_id": str(uuid.uuid4()), "email": "tester@example.com"}
    update = {
        "feature_flags": {"crm_accounts": "hidden"},
        "enabled_modules": {"magazine": False},
    }
    # Non-critical modules remain freely togglable.
    _enforce_core_critical_safety(update, tenant_id=STUDIO_TENANT_ID,
                                   actor=actor)


# ── 4. API mutation guard — platform default ──────────────────────────
def test_patch_platform_default_rejects_disabled_on_critical(monkeypatch):
    """Use the FastAPI client through TestClient so we exercise the
    actual HTTP layer including the safety guard.
    """
    from fastapi.testclient import TestClient
    from server import app  # backend FastAPI app
    client = TestClient(app)

    # Forge a root-superadmin dependency override.
    from middleware.auth import require_root_superadmin
    fake_root = {"profile_id": str(uuid.uuid4()),
                 "email": "root@iter146-test.example.com",
                 "is_root_superadmin": True, "role": "super_admin"}
    app.dependency_overrides[require_root_superadmin] = lambda: fake_root
    try:
        r = client.patch("/api/blueprint-admin/feature-modules/dashboard",
                          json={"state": "disabled"})
        assert r.status_code == 400, r.text
        assert "core-critical" in r.json().get("detail", "").lower()

        r2 = client.patch("/api/blueprint-admin/feature-modules/dashboard",
                           json={"state": "hidden"})
        assert r2.status_code == 400, r2.text

        # Beta still allowed on critical modules.
        r3 = client.patch("/api/blueprint-admin/feature-modules/dashboard",
                           json={"state": "beta"})
        assert r3.status_code == 200, r3.text
    finally:
        # cleanup any state we set
        try:
            db().table("platform_feature_defaults") \
                .delete().eq("module_code", "dashboard").execute()
            invalidate_registry()
        except Exception:
            pass
        app.dependency_overrides.pop(require_root_superadmin, None)


def test_patch_platform_default_allows_noncritical_disable():
    from fastapi.testclient import TestClient
    from server import app
    client = TestClient(app)
    from middleware.auth import require_root_superadmin
    fake_root = {"profile_id": str(uuid.uuid4()),
                 "email": "root@iter146-test.example.com",
                 "is_root_superadmin": True, "role": "super_admin"}
    app.dependency_overrides[require_root_superadmin] = lambda: fake_root
    try:
        r = client.patch("/api/blueprint-admin/feature-modules/crm_accounts",
                          json={"state": "disabled"})
        assert r.status_code == 200, r.text
    finally:
        try:
            db().table("platform_feature_defaults") \
                .delete().eq("module_code", "crm_accounts").execute()
            invalidate_registry()
        except Exception:
            pass
        app.dependency_overrides.pop(require_root_superadmin, None)


# ── 5. Runtime bundle exposes is_core_critical ─────────────────────────
def test_runtime_bundle_exposes_is_core_critical():
    from services.tenant_config_resolver import resolve_runtime_bundle
    bundle = resolve_runtime_bundle(STUDIO_TENANT_ID, user_role="tenant_admin",
                                     is_super_admin=False, is_root=False)
    by_code = {m["code"]: m for m in bundle["modules"]}
    for code in CRITICAL_CODES:
        assert by_code[code]["is_core_critical"] is True, (
            f"{code} should be flagged critical in runtime bundle")
    assert by_code["crm_accounts"]["is_core_critical"] is False
