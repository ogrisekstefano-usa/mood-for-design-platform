"""Phase S-CONNECT Step 2 — Storefront Studio™ regression tests."""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
SUPER = {"email": "demo@moodfordesign.com", "password": "Blueprint2024!"}
TENANT_SLUG = "mood-demo-studio-81a09e"


def _login(c):
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/login", json=c, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"login failed: {r.status_code} {r.text}")
    j = r.json()
    tok = (j.get("session") or {}).get("access_token") or j.get("access_token") or j.get("token")
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(SUPER)


def test_get_home_returns_page_and_sections(admin):
    r = admin.get(f"{BASE}/api/storefront/admin/pages/home")
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["page_key"] == "home"
    assert isinstance(j["sections"], list)
    assert len(j["sections"]) >= 6
    types = {s["section_type"] for s in j["sections"]}
    expected = {"store_hero", "value_props", "stats_band", "projects_preview", "magazine_grid", "brand_logos"}
    missing = expected - types
    assert not missing, f"missing seeded section types: {missing}; got {types}"


def test_put_section_persists_locale_and_settings(admin):
    p = admin.get(f"{BASE}/api/storefront/admin/pages/home").json()
    sid = p["sections"][0]["id"]
    payload = {
        "locale_content": {"it-IT": {"title": "TEST_phase_s_connect_step2", "eyebrow": "TEST_eyebrow"}},
        "settings": {"positioning_mode": "international_editorial",
                     "market_visibility": ["italy", "usa_national"],
                     "hero_variant": "cinematic"},
    }
    r = admin.put(f"{BASE}/api/storefront/admin/sections/{sid}", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["locale_content"]["it-IT"]["title"] == "TEST_phase_s_connect_step2"
    assert body["settings"]["positioning_mode"] == "international_editorial"
    # Verify persistence via GET
    g = admin.get(f"{BASE}/api/storefront/admin/pages/home").json()
    found = next(s for s in g["sections"] if s["id"] == sid)
    assert found["locale_content"]["it-IT"]["eyebrow"] == "TEST_eyebrow"
    assert "usa_national" in found["settings"]["market_visibility"]


def test_reorder_sections_persists(admin):
    p = admin.get(f"{BASE}/api/storefront/admin/pages/home").json()
    ids = [s["id"] for s in p["sections"]]
    reversed_ids = list(reversed(ids))
    r = admin.patch(f"{BASE}/api/storefront/admin/pages/home/sections/reorder",
                    json={"section_ids": reversed_ids})
    assert r.status_code == 200, r.text
    g = admin.get(f"{BASE}/api/storefront/admin/pages/home").json()
    new_order = [s["id"] for s in g["sections"]]
    assert new_order == reversed_ids
    # restore
    admin.patch(f"{BASE}/api/storefront/admin/pages/home/sections/reorder",
                json={"section_ids": ids})


def test_publish_home_creates_revision_and_publishes(admin):
    r = admin.post(f"{BASE}/api/storefront/admin/pages/home/publish", json={})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("revision_id"), "publish should return revision_id"
    assert j.get("published_at"), "publish should return published_at timestamp"
    g = admin.get(f"{BASE}/api/storefront/admin/pages/home").json()
    assert g["status"] == "published"
    assert g.get("published_revision_id")


def test_public_storefront_home_returns_published_snapshot():
    r = requests.get(f"{BASE}/api/storefront/public/{TENANT_SLUG}/pages/home", timeout=20)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["status"] == "ok"
    assert j["page"] is not None
    assert j.get("served_from") in ("revision", "legacy_live")
    assert isinstance(j["page"]["sections"], list)
    assert len(j["page"]["sections"]) >= 1


def test_tenant_markets_endpoint_used_by_editor(admin):
    r = admin.get(f"{BASE}/api/tenants/me/markets")
    assert r.status_code == 200, r.text
    j = r.json()
    assert "markets" in j
    actives = [m for m in j["markets"] if m.get("is_active")]
    assert len(actives) >= 1
