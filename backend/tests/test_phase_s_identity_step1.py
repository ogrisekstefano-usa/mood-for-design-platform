"""Phase S-IDENTITY Step 1 — International Presence™ backend regression.

Validates:
  • Migration 038 columns populated on 7 canonical markets
  • GET /api/tenants/me/markets returns positioning attrs
  • PATCH /api/tenants/me/markets/{id} accepts is_active/is_default/sort_order
  • is_default mutex enforcement (only 1 default per tenant)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

CANONICAL_CODES = [
    'italy', 'dach', 'france_fr_europe', 'uk_ireland',
    'usa_national', 'spanish_latam', 'gcc_luxury',
]


@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "demo@moodfordesign.com",
        "password": "Blueprint2024!",
    }, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Login failed {r.status_code}: {r.text}")
    body = r.json()
    return (body.get("session", {}) or {}).get("access_token") or body.get("token") or body.get("access_token")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# ─── GET /api/tenants/me/markets ──────────────────────────────────────

def test_get_my_tenant_markets_returns_list(auth_headers):
    r = requests.get(f"{BASE_URL}/api/tenants/me/markets", headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "markets" in data
    assert isinstance(data["markets"], list)
    assert data["total"] >= 7


def test_canonical_markets_have_positioning_fields(auth_headers):
    r = requests.get(f"{BASE_URL}/api/tenants/me/markets", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    markets = r.json()["markets"]
    by_code = {m["code"]: m for m in markets}

    missing = [c for c in CANONICAL_CODES if c not in by_code]
    assert not missing, f"Missing canonical markets: {missing}"

    for code in CANONICAL_CODES:
        m = by_code[code]
        for field in ("editorial_tone", "luxury_positioning", "hospitality_profile", "storefront_behavior"):
            assert m.get(field), f"Market {code} missing {field}: got {m.get(field)!r}"


def test_market_card_has_required_display_fields(auth_headers):
    r = requests.get(f"{BASE_URL}/api/tenants/me/markets", headers=auth_headers, timeout=15)
    markets = r.json()["markets"]
    italy = next(m for m in markets if m["code"] == "italy")
    # display_name is a dict (i18n)
    assert isinstance(italy["display_name"], dict)
    assert italy["primary_locale"]
    assert italy["currency"]
    assert "is_active" in italy
    assert "is_default" in italy


def test_italy_is_default_for_demo_tenant(auth_headers):
    r = requests.get(f"{BASE_URL}/api/tenants/me/markets", headers=auth_headers, timeout=15)
    markets = r.json()["markets"]
    italy = next(m for m in markets if m["code"] == "italy")
    assert italy["is_default"] is True
    assert italy["is_active"] is True


# ─── PATCH /api/tenants/me/markets/{id} ───────────────────────────────

def test_patch_toggle_is_active(auth_headers):
    r = requests.get(f"{BASE_URL}/api/tenants/me/markets", headers=auth_headers, timeout=15)
    markets = r.json()["markets"]
    # find any non-default market we can toggle
    target = next(m for m in markets if m["code"] == "dach")
    original_state = target["is_active"]

    # toggle
    pr = requests.patch(
        f"{BASE_URL}/api/tenants/me/markets/{target['id']}",
        json={"is_active": not original_state},
        headers=auth_headers, timeout=15,
    )
    assert pr.status_code == 200, pr.text

    # verify via GET
    r2 = requests.get(f"{BASE_URL}/api/tenants/me/markets", headers=auth_headers, timeout=15)
    new_state = next(m for m in r2.json()["markets"] if m["code"] == "dach")["is_active"]
    assert new_state == (not original_state)

    # restore
    requests.patch(
        f"{BASE_URL}/api/tenants/me/markets/{target['id']}",
        json={"is_active": original_state},
        headers=auth_headers, timeout=15,
    )


def test_patch_sort_order(auth_headers):
    r = requests.get(f"{BASE_URL}/api/tenants/me/markets", headers=auth_headers, timeout=15)
    target = next(m for m in r.json()["markets"] if m["code"] == "uk_ireland")
    pr = requests.patch(
        f"{BASE_URL}/api/tenants/me/markets/{target['id']}",
        json={"sort_order": 42},
        headers=auth_headers, timeout=15,
    )
    assert pr.status_code == 200, pr.text


def test_patch_is_default_mutex(auth_headers):
    """Set a non-italy market default → italy must lose default."""
    r = requests.get(f"{BASE_URL}/api/tenants/me/markets", headers=auth_headers, timeout=15)
    markets = r.json()["markets"]
    italy = next(m for m in markets if m["code"] == "italy")
    usa = next(m for m in markets if m["code"] == "usa_national")

    # set usa as default
    pr = requests.patch(
        f"{BASE_URL}/api/tenants/me/markets/{usa['id']}",
        json={"is_default": True, "is_active": True},
        headers=auth_headers, timeout=15,
    )
    assert pr.status_code == 200, pr.text

    # verify
    r2 = requests.get(f"{BASE_URL}/api/tenants/me/markets", headers=auth_headers, timeout=15)
    m2 = {m["code"]: m for m in r2.json()["markets"]}
    assert m2["usa_national"]["is_default"] is True
    assert m2["italy"]["is_default"] is False, "is_default mutex violation: italy still default"

    # restore italy
    requests.patch(
        f"{BASE_URL}/api/tenants/me/markets/{italy['id']}",
        json={"is_default": True, "is_active": True},
        headers=auth_headers, timeout=15,
    )
    r3 = requests.get(f"{BASE_URL}/api/tenants/me/markets", headers=auth_headers, timeout=15)
    m3 = {m["code"]: m for m in r3.json()["markets"]}
    assert m3["italy"]["is_default"] is True
    assert m3["usa_national"]["is_default"] is False


def test_patch_empty_body_returns_400(auth_headers):
    r = requests.get(f"{BASE_URL}/api/tenants/me/markets", headers=auth_headers, timeout=15)
    target = r.json()["markets"][0]
    pr = requests.patch(
        f"{BASE_URL}/api/tenants/me/markets/{target['id']}",
        json={},
        headers=auth_headers, timeout=15,
    )
    assert pr.status_code == 400


def test_patch_unknown_market_returns_404(auth_headers):
    pr = requests.patch(
        f"{BASE_URL}/api/tenants/me/markets/00000000-0000-0000-0000-000000000000",
        json={"is_active": True},
        headers=auth_headers, timeout=15,
    )
    assert pr.status_code == 404
