"""Public storefront brand endpoint — anonymous header consumption."""
import os
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE


def test_public_brand_returns_brand_and_nav():
    """Demo tenant must return: brand block with name + logo + tagline,
    and nav block with default 4 links + login/register flags."""
    r = requests.get(
        f"{BASE}/api/storefront/public/mood-demo-studio-81a09e/brand", timeout=10,
    )
    assert r.status_code == 200, r.text[:200]
    j = r.json()
    assert j["tenant_slug"] == "mood-demo-studio-81a09e"
    assert j["brand"]["name"] == "EXE INTERIOR"
    assert j["brand"]["tagline"] == "Italian Design Excellence"
    assert j["brand"]["primary_logo_url"]  # any URL
    assert j["nav"]["show_login"] is True
    assert j["nav"]["show_register"] is True
    assert j["nav"]["login_href"] == "/auth/login"
    assert j["nav"]["register_href"] == "/auth/register"
    ids = [l["id"] for l in j["nav"]["main_links"]]
    # Default editorial nav — NO Magazine / PMS / Members Area.
    assert ids == ["home", "servizi", "progetti", "contatti"]


def test_public_brand_404_unknown_tenant():
    r = requests.get(
        f"{BASE}/api/storefront/public/no-such-tenant/brand", timeout=10,
    )
    assert r.status_code == 404


def test_public_brand_is_anonymous():
    """No Authorization header — must still respond 200 (storefront chrome
    cannot require a session)."""
    r = requests.get(
        f"{BASE}/api/storefront/public/mood-demo-studio-81a09e/brand", timeout=10,
        # explicitly no auth
    )
    assert r.status_code == 200
    assert "brand" in r.json()
