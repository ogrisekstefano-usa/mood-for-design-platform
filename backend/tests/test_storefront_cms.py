"""Storefront CMS™ (Session B) — backend tests.

Covers:
  - /api/storefront/admin/registry — page_keys + section types
  - /api/storefront/admin/pages    — list/auto-create 6 pages
  - Section CRUD + reorder + duplicate
  - Publish workflow
  - Public read endpoint (published / not_published)
  - Asset listing
  - Cross-tenant isolation (studio2 must NOT see Studio's pages)
  - RBAC — client role gets 403 on admin/*
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")

SUPER = {"email": "demo@moodfordesign.com", "password": "Blueprint2024!"}
DESIGNER = {"email": "designer@moodfordesign.com", "password": "Designer2024!"}
CLIENT = {"email": "client@moodfordesign.com", "password": "Client2024!"}
STUDIO2 = {"email": "studio2@moodfordesign.com", "password": "Studio2024!"}

TENANT_SLUG = "mood-demo-studio-81a09e"

EXPECTED_PAGE_KEYS = {"home", "projects", "start_project", "professionals", "navigation", "ui"}
EXPECTED_SECTION_COUNT = 17


def _login(creds):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"login failed {creds['email']}: {r.status_code} {r.text}")
    j = r.json()
    tok = (j.get("session") or {}).get("access_token") or j.get("access_token") or j.get("token")
    assert tok, f"no token in response: {j}"
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(SUPER)


@pytest.fixture(scope="module")
def studio2_client():
    return _login(STUDIO2)


@pytest.fixture(scope="module")
def client_role():
    return _login(CLIENT)


# ── Registry ─────────────────────────────────────────────────────────────
def test_registry_returns_6_pages_17_sections(admin):
    r = admin.get(f"{BASE_URL}/api/storefront/admin/registry")
    assert r.status_code == 200, r.text
    j = r.json()
    assert set(j["page_keys"]) == EXPECTED_PAGE_KEYS
    assert len(j["sections"]) == EXPECTED_SECTION_COUNT
    types = {s["type"] for s in j["sections"]}
    for t in ("store_hero", "dual_cta", "value_props", "projects_preview", "newsletter"):
        assert t in types


def test_registry_requires_auth():
    r = requests.get(f"{BASE_URL}/api/storefront/admin/registry", timeout=10)
    assert r.status_code in (401, 403)


# ── Pages auto-create ───────────────────────────────────────────────────
def test_pages_list_returns_six_pages(admin):
    r = admin.get(f"{BASE_URL}/api/storefront/admin/pages")
    assert r.status_code == 200, r.text
    j = r.json()
    keys = {p["page_key"] for p in j["pages"]}
    assert keys == EXPECTED_PAGE_KEYS
    for p in j["pages"]:
        assert "id" in p
        assert "sections" in p
        assert p["tenant_id"] == j["tenant_id"]


# ── Section CRUD ─────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def home_page(admin):
    r = admin.get(f"{BASE_URL}/api/storefront/admin/pages/home")
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def created_section(admin, home_page):
    payload = {
        "section_type": "newsletter",
        "visible": True,
        "locale_content": {"_default": {"kicker": "TEST_kicker"}, "it": {"kicker": "TEST_kicker_it"}},
        "settings": {"test_marker": True},
    }
    r = admin.post(f"{BASE_URL}/api/storefront/admin/pages/home/sections", json=payload)
    assert r.status_code == 201, r.text
    s = r.json()
    assert s["section_type"] == "newsletter"
    assert s["visible"] is True
    assert s["locale_content"]["_default"]["kicker"] == "TEST_kicker"
    yield s
    # teardown
    admin.delete(f"{BASE_URL}/api/storefront/admin/sections/{s['id']}")


def test_create_section_rejects_unknown_type(admin):
    r = admin.post(
        f"{BASE_URL}/api/storefront/admin/pages/home/sections",
        json={"section_type": "no_such_section"},
    )
    assert r.status_code == 400


def test_update_section_persists_locale_content(admin, created_section):
    sid = created_section["id"]
    new_content = {"_default": {"kicker": "TEST_updated"}, "it": {"kicker": "AGGIORNATO"}}
    r = admin.put(
        f"{BASE_URL}/api/storefront/admin/sections/{sid}",
        json={"locale_content": new_content, "settings": {"updated": True}},
    )
    assert r.status_code == 200, r.text
    assert r.json()["locale_content"]["it"]["kicker"] == "AGGIORNATO"

    # Verify via GET page
    g = admin.get(f"{BASE_URL}/api/storefront/admin/pages/home")
    assert g.status_code == 200
    found = next((s for s in g.json()["sections"] if s["id"] == sid), None)
    assert found is not None
    assert found["locale_content"]["it"]["kicker"] == "AGGIORNATO"
    assert found["settings"]["updated"] is True


def test_duplicate_section_clones(admin, created_section):
    sid = created_section["id"]
    r = admin.post(f"{BASE_URL}/api/storefront/admin/sections/{sid}/duplicate")
    assert r.status_code == 201, r.text
    dup = r.json()
    assert dup["id"] != sid
    assert dup["section_type"] == created_section["section_type"]
    # cleanup
    admin.delete(f"{BASE_URL}/api/storefront/admin/sections/{dup['id']}")


def test_reorder_sections(admin, home_page):
    r = admin.get(f"{BASE_URL}/api/storefront/admin/pages/home")
    sections = r.json()["sections"]
    if len(sections) < 2:
        pytest.skip("need at least 2 sections on home")
    ids = [s["id"] for s in sections]
    reversed_ids = list(reversed(ids))
    rr = admin.patch(
        f"{BASE_URL}/api/storefront/admin/pages/home/sections/reorder",
        json={"section_ids": reversed_ids},
    )
    assert rr.status_code == 200, rr.text
    # Verify
    g = admin.get(f"{BASE_URL}/api/storefront/admin/pages/home").json()
    new_order = [s["id"] for s in g["sections"]]
    assert new_order == reversed_ids
    # Restore
    admin.patch(
        f"{BASE_URL}/api/storefront/admin/pages/home/sections/reorder",
        json={"section_ids": ids},
    )


def test_delete_section_removes_it(admin, home_page):
    # Create then delete
    r = admin.post(
        f"{BASE_URL}/api/storefront/admin/pages/home/sections",
        json={"section_type": "value_props", "locale_content": {"_default": {"section_title": "TEST_to_delete"}}},
    )
    assert r.status_code == 201
    sid = r.json()["id"]
    d = admin.delete(f"{BASE_URL}/api/storefront/admin/sections/{sid}")
    assert d.status_code == 200
    assert d.json()["deleted"] is True
    # Verify gone
    g = admin.get(f"{BASE_URL}/api/storefront/admin/pages/home").json()
    assert all(s["id"] != sid for s in g["sections"])


# ── Publish workflow ────────────────────────────────────────────────────
def test_publish_home_sets_status_and_timestamp(admin):
    r = admin.post(f"{BASE_URL}/api/storefront/admin/pages/home/publish")
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["status"] == "published"
    assert j.get("published_at"), "published_at timestamp missing"


# ── Public endpoint ──────────────────────────────────────────────────────
def test_public_home_returns_published_with_visible_sections(admin):
    # ensure published
    admin.post(f"{BASE_URL}/api/storefront/admin/pages/home/publish")
    r = requests.get(f"{BASE_URL}/api/storefront/public/{TENANT_SLUG}/pages/home", timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["status"] == "ok"
    assert j["page"] is not None
    assert j["page"]["status"] == "published"
    # all sections should be visible=true
    for s in j["page"]["sections"]:
        assert s.get("visible", True) is True


def test_public_unpublished_returns_not_published(admin):
    # Use 'ui' or 'navigation' that we won't publish — ensure it's draft
    # First force it to draft
    r = admin.put(f"{BASE_URL}/api/storefront/admin/pages/ui", json={"status": "draft"})
    assert r.status_code == 200, r.text
    pub = requests.get(f"{BASE_URL}/api/storefront/public/{TENANT_SLUG}/pages/ui", timeout=15)
    assert pub.status_code == 200
    j = pub.json()
    assert j["status"] in ("not_published", "no_content")
    assert j["page"] is None


def test_public_unknown_tenant_404():
    r = requests.get(f"{BASE_URL}/api/storefront/public/no-such-tenant/pages/home", timeout=10)
    assert r.status_code == 404


# ── Assets ──────────────────────────────────────────────────────────────
def test_list_assets(admin):
    r = admin.get(f"{BASE_URL}/api/storefront/admin/assets")
    assert r.status_code == 200, r.text
    j = r.json()
    assert "assets" in j
    assert isinstance(j["assets"], list)


# ── Cross-tenant isolation ──────────────────────────────────────────────
def test_studio2_cannot_see_studio_sections(admin, studio2_client):
    # Get studio's home sections
    a = admin.get(f"{BASE_URL}/api/storefront/admin/pages/home").json()
    studio_section_ids = {s["id"] for s in a["sections"]}

    # studio2 lists its pages — auto-creates its own
    b = studio2_client.get(f"{BASE_URL}/api/storefront/admin/pages/home")
    assert b.status_code == 200, b.text
    j = b.json()
    studio2_section_ids = {s["id"] for s in j["sections"]}
    # No overlap
    assert studio_section_ids.isdisjoint(studio2_section_ids), \
        f"cross-tenant leak: {studio_section_ids & studio2_section_ids}"
    # Also different tenant_id
    assert j["tenant_id"] != a["tenant_id"]


def test_studio2_cannot_update_studio_section(admin, studio2_client):
    a = admin.get(f"{BASE_URL}/api/storefront/admin/pages/home").json()
    if not a["sections"]:
        pytest.skip("no sections on studio home")
    target_id = a["sections"][0]["id"]
    r = studio2_client.put(
        f"{BASE_URL}/api/storefront/admin/sections/{target_id}",
        json={"locale_content": {"_default": {"hacked": True}}},
    )
    # Should be 404 (filtered by tenant) not 200
    assert r.status_code == 404


# ── RBAC ─────────────────────────────────────────────────────────────────
def test_client_role_forbidden_on_admin_pages(client_role):
    r = client_role.get(f"{BASE_URL}/api/storefront/admin/pages")
    assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"


def test_client_role_forbidden_on_admin_registry(client_role):
    r = client_role.get(f"{BASE_URL}/api/storefront/admin/registry")
    assert r.status_code == 403


def test_client_role_forbidden_on_admin_assets(client_role):
    r = client_role.get(f"{BASE_URL}/api/storefront/admin/assets")
    assert r.status_code == 403
