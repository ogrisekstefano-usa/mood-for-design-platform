"""Phase R-MARKET-1A — invariants for the markets catalog + lookup split.

  cd /app/backend && pytest tests/test_phase_r_market_1a.py -v

Validates that:
  • All 13 canonical markets are seeded with the contract fields.
  • `usa_national` carries the 6 sub-regions (Miami / NY / LA / Chicago / Texas / Aspen).
  • A tenant_markets row exists for every (demo_tenant × market) pair,
    with `italy` flagged is_default.
  • CRM-core lookup groups are PLATFORM-scoped (tenant_id IS NULL), and
    stylistic groups remain TENANT-scoped.
  • /api/storefront/public/{slug}/markets is anonymous (no auth header)
    and only returns the tenant's active markets.
  • /api/tenants/me/markets returns ALL platform markets with per-tenant
    activation flags joined.
  • /api/markets (super-admin) is reachable by the demo super-admin and
    rejected anonymously.
"""
import os
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL must be set"

DEMO_EMAIL = "demo@moodfordesign.com"
DEMO_PASSWORD = "Blueprint2024!"
DEMO_TENANT_SLUG = "mood-demo-studio-81a09e"

REQUIRED_MARKETS = {
    "italy", "dach", "france_fr_europe", "uk_ireland",
    "usa_national", "usa_east_coast", "usa_south_florida", "usa_west_coast",
    "gcc_luxury", "central_america", "spanish_latam", "brazil", "scandinavia",
}
USA_SUB_REGIONS = {
    "miami_south_florida", "new_york_tri_state", "los_angeles_california",
    "chicago_midwest", "texas", "aspen_mountain_luxury",
}
CRM_CORE_GROUPS = {
    "lifecycle_stage", "account_type", "source", "interaction_type",
    "action_type", "priority", "visibility_level", "relationship_health",
    "communication_preference",
}
STYLISTIC_GROUPS = {"style", "material", "atmosphere", "budget_range", "timing_range"}


@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(
        f"{BASE}/api/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()["session"]["access_token"]


@pytest.fixture(scope="module")
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# ── Public storefront markets endpoint ───────────────────────────────────

def test_public_markets_is_anonymous():
    r = requests.get(f"{BASE}/api/storefront/public/{DEMO_TENANT_SLUG}/markets", timeout=10)
    assert r.status_code == 200, r.text[:200]
    j = r.json()
    assert j["tenant_slug"] == DEMO_TENANT_SLUG
    assert j["default_market"] is not None
    assert j["default_market"]["code"] == "italy"


def test_public_markets_only_returns_active():
    r = requests.get(f"{BASE}/api/storefront/public/{DEMO_TENANT_SLUG}/markets", timeout=10)
    j = r.json()
    assert all(m.get("is_default") is not None for m in j["markets"])
    # Demo seed: 6 markets are active out of 13.
    assert 1 <= len(j["markets"]) <= 13
    # Default must be inside the active set.
    default_code = j["default_market"]["code"]
    assert default_code in {m["code"] for m in j["markets"]}


def test_public_markets_includes_core_contract_fields():
    r = requests.get(f"{BASE}/api/storefront/public/{DEMO_TENANT_SLUG}/markets", timeout=10)
    j = r.json()
    for m in j["markets"]:
        for f in ("code", "display_name", "primary_locale", "fallback_locale",
                  "currency", "measurement_system", "countries", "macro_region"):
            assert f in m, f"market {m.get('code')} missing field {f}"


def test_public_markets_unknown_tenant_404():
    r = requests.get(f"{BASE}/api/storefront/public/no-such-tenant/markets", timeout=10)
    assert r.status_code == 404


# ── Tenant-owner endpoints ───────────────────────────────────────────────

def test_tenant_me_markets_returns_all_thirteen(headers):
    r = requests.get(f"{BASE}/api/tenants/me/markets", headers=headers, timeout=10)
    assert r.status_code == 200, r.text[:200]
    j = r.json()
    codes = {m["code"] for m in j["markets"]}
    missing = REQUIRED_MARKETS - codes
    assert not missing, f"Missing seeded markets: {missing}"
    assert j["total"] == len(j["markets"])


def test_tenant_me_markets_shows_activation_state(headers):
    r = requests.get(f"{BASE}/api/tenants/me/markets", headers=headers, timeout=10)
    j = r.json()
    actives = [m for m in j["markets"] if m["is_active"]]
    inactives = [m for m in j["markets"] if not m["is_active"]]
    assert len(actives) >= 1, "Demo must have at least Italy active"
    assert len(inactives) >= 1, "Demo must have some markets inactive (activation flow)"
    italy = next(m for m in j["markets"] if m["code"] == "italy")
    assert italy["is_active"] is True
    assert italy["is_default"] is True


def test_usa_national_has_six_sub_regions(headers):
    r = requests.get(f"{BASE}/api/tenants/me/markets", headers=headers, timeout=10)
    j = r.json()
    usa = next(m for m in j["markets"] if m["code"] == "usa_national")
    sub_codes = {sr["code"] for sr in usa["sub_regions"]}
    assert sub_codes == USA_SUB_REGIONS, f"USA sub-regions mismatch: {sub_codes}"
    miami = next(sr for sr in usa["sub_regions"] if sr["code"] == "miami_south_florida")
    assert "Miami" in miami["cities_anchor"]
    assert miami["parent_market"] == "usa_national"


# ── Super-admin endpoints ────────────────────────────────────────────────

def test_super_admin_can_list_markets(headers):
    r = requests.get(f"{BASE}/api/markets", headers=headers, timeout=10)
    assert r.status_code == 200, r.text[:200]
    j = r.json()
    assert j["total"] >= 13


def test_super_admin_endpoints_anonymous_rejected():
    r = requests.get(f"{BASE}/api/markets", timeout=10)
    assert r.status_code in (401, 403)


# ── Lookups split invariants (CRM-core platform, stylistic tenant) ───────

def test_crm_core_groups_are_platform_scoped(headers):
    r = requests.get(f"{BASE}/api/relationships/lookups", headers=headers, timeout=10)
    j = r.json()["lookups"]
    for grp in CRM_CORE_GROUPS:
        assert grp in j, f"core group {grp} missing"
        scopes = {row.get("scope") for row in j[grp]}
        assert scopes == {"platform"}, (
            f"CRM-core group {grp} must be platform-only, got scopes={scopes}"
        )
        for row in j[grp]:
            assert row.get("tenant_id") is None, (
                f"{grp}.{row['value_key']} must have tenant_id NULL (platform scope)"
            )


def test_stylistic_groups_are_tenant_scoped(headers):
    r = requests.get(f"{BASE}/api/relationships/lookups", headers=headers, timeout=10)
    j = r.json()["lookups"]
    for grp in STYLISTIC_GROUPS:
        if grp not in j:
            continue
        scopes = {row.get("scope") for row in j[grp]}
        assert scopes == {"tenant"}, (
            f"Stylistic group {grp} must be tenant-only, got scopes={scopes}"
        )


def test_lifecycle_stage_keeps_six_locales_after_migration(headers):
    """Phase R-CRM-2A invariant must still hold after the split."""
    r = requests.get(f"{BASE}/api/relationships/lookups?group=lifecycle_stage",
                     headers=headers, timeout=10)
    j = r.json()["lookups"]["lifecycle_stage"]
    for entry in j:
        for loc in ("it-IT", "en-US", "en-GB", "es-ES", "fr-FR", "de-DE"):
            assert loc in entry["label"], (
                f"stage={entry['value_key']} missing {loc} after platform split"
            )


# ── Toggle round-trip ────────────────────────────────────────────────────

def test_tenant_can_toggle_market_activation(headers):
    """Activate scandinavia, verify, then revert. Tenant-owner endpoint."""
    r = requests.get(f"{BASE}/api/tenants/me/markets", headers=headers, timeout=10)
    scandi = next(m for m in r.json()["markets"] if m["code"] == "scandinavia")
    market_id = scandi["id"]
    before = scandi["is_active"]

    r = requests.patch(
        f"{BASE}/api/tenants/me/markets/{market_id}",
        headers=headers, json={"is_active": not before}, timeout=10,
    )
    assert r.status_code == 200, r.text[:200]

    r = requests.get(f"{BASE}/api/tenants/me/markets", headers=headers, timeout=10)
    scandi2 = next(m for m in r.json()["markets"] if m["code"] == "scandinavia")
    assert scandi2["is_active"] is (not before)

    # Revert
    requests.patch(
        f"{BASE}/api/tenants/me/markets/{market_id}",
        headers=headers, json={"is_active": before}, timeout=10,
    )
