"""Phase Y.3.A — Editorial Asset Picker backend tests.

Validates the backend surface used by AssetPickerModal:
  * GET  /api/media               (list, tenant-scoped, filters)
  * GET  /api/media/stats         (chip universe)
  * POST /api/storage/signed-upload   (signed url + bucket whitelist)
  * POST /api/storage/media           (register row + tenant prefix enforcement)
  * POST /api/media/{asset_id}/links  (idempotent, UNIQUE asset+entity+role)
  * Tenant isolation between Demo Studio and Demo Showroom
  * Magazine article PATCH hero_url persistence
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
DEMO_TENANT_ID = "81a09ead-0306-4d71-a5c4-ca2b3956add2"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    body = r.json()
    tok = (body.get("session") or {}).get("access_token") or body.get("access_token")
    assert tok, f"No access_token in login response: {body}"
    return tok


@pytest.fixture(scope="session")
def demo_token():
    return _login("demo@moodfordesign.com", "Blueprint2024!")


@pytest.fixture(scope="session")
def showroom_token():
    try:
        return _login("studio2@moodfordesign.com", "Studio2024!")
    except AssertionError:
        pytest.skip("Showroom admin login failed — skipping isolation test")


@pytest.fixture(scope="session")
def demo_headers(demo_token):
    return {"Authorization": f"Bearer {demo_token}"}


@pytest.fixture(scope="session")
def showroom_headers(showroom_token):
    return {"Authorization": f"Bearer {showroom_token}"}


# ── Media list / filters (Library tab) ───────────────────────────────
class TestMediaList:
    def test_media_list_returns_demo_assets(self, demo_headers):
        r = requests.get(f"{BASE_URL}/api/media",
                         params={"type": "image", "limit": 60},
                         headers=demo_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json().get("data", r.json() if isinstance(r.json(), list) else [])
        assert isinstance(data, list)
        assert len(data) > 0, "Expected Demo Studio to have image assets"
        a = data[0]
        # essential fields used by AssetCard
        for k in ("id", "file_name"):
            assert k in a, f"Asset missing field {k}: {a}"

    def test_media_list_filter_by_category_hospitality(self, demo_headers):
        r = requests.get(f"{BASE_URL}/api/media",
                         params={"type": "image", "category": "hospitality"},
                         headers=demo_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json().get("data", [])
        for a in data:
            # When category filter is honored, returned rows must match
            if a.get("category"):
                assert a["category"] == "hospitality", f"category mismatch: {a.get('category')}"

    def test_media_stats(self, demo_headers):
        r = requests.get(f"{BASE_URL}/api/media/stats", headers=demo_headers, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        # Note: current /api/media/stats returns {total, by_kind, total_bytes, ...}
        # but AssetPickerModal.jsx expects body.categories / body.tags to drive
        # dynamic chips. This assertion documents the integration mismatch.
        assert "categories" in body and "tags" in body, (
            f"INTEGRATION GAP: /api/media/stats lacks 'categories' & 'tags' that "
            f"AssetPickerModal expects. Got: {body}"
        )


# ── Tenant isolation ─────────────────────────────────────────────────
class TestTenantIsolation:
    def test_showroom_cannot_see_demo_assets(self, demo_headers, showroom_headers):
        d = requests.get(f"{BASE_URL}/api/media", params={"type": "image", "limit": 60},
                         headers=demo_headers, timeout=20).json().get("data", [])
        demo_ids = {x["id"] for x in d}
        s = requests.get(f"{BASE_URL}/api/media", params={"type": "image", "limit": 60},
                         headers=showroom_headers, timeout=20)
        assert s.status_code == 200, s.text
        showroom_ids = {x["id"] for x in s.json().get("data", [])}
        leaked = demo_ids & showroom_ids
        assert not leaked, f"Tenant isolation breach: {leaked}"


# ── Storage signed-upload + bucket whitelist + tenant prefix ─────────
class TestStorageSignedUpload:
    def test_signed_upload_magazine_media(self, demo_headers):
        path = f"magazine/test-{uuid.uuid4().hex[:8]}/probe.jpg"
        r = requests.post(f"{BASE_URL}/api/storage/signed-upload",
                          json={"bucket": "magazine-media", "path": path,
                                "file_size": 1024, "content_type": "image/jpeg"},
                          headers=demo_headers, timeout=45)
        assert r.status_code in (200, 201), r.text
        body = r.json().get("data", r.json())
        assert "signed_url" in body or "url" in body or "path" in body, body

    def test_signed_upload_rejects_unknown_bucket(self, demo_headers):
        r = requests.post(f"{BASE_URL}/api/storage/signed-upload",
                          json={"bucket": "evil-bucket", "path": "x.jpg",
                                "file_size": 1024, "content_type": "image/jpeg"},
                          headers=demo_headers, timeout=20)
        assert r.status_code in (400, 403, 422), \
            f"Expected unknown bucket to be rejected, got {r.status_code}: {r.text}"

    def test_register_media_nests_suspicious_prefix_under_tenant(self, demo_headers):
        """A storage_path with foreign tenant prefix must be nested under caller's
        tenant_id (not allowed to write outside own tenant). Behavior is safe as
        long as storage_path begins with caller's tenant_id."""
        evil_path = "tenants/00000000-0000-0000-0000-000000000000/foreign.jpg"
        r = requests.post(f"{BASE_URL}/api/storage/media",
                          json={"bucket": "magazine-media",
                                "storage_path": evil_path,
                                "file_name": "foreign.jpg",
                                "file_type": "image/jpeg",
                                "file_size": 1024},
                          headers=demo_headers, timeout=30)
        if r.status_code in (400, 403, 422):
            return  # rejected outright — also fine
        assert r.status_code in (200, 201), r.text
        body = r.json()
        sp = body.get("storage_path", "")
        assert sp.startswith(DEMO_TENANT_ID + "/"), (
            f"SECURITY: storage_path escaped tenant prefix: {sp}"
        )


# ── Media links (auto-link to magazine article) ──────────────────────
class TestMediaLinks:
    @pytest.fixture(scope="class")
    def article_and_asset(self, demo_headers):
        # Pick an existing image asset
        r = requests.get(f"{BASE_URL}/api/media",
                         params={"type": "image", "limit": 5},
                         headers=demo_headers, timeout=20)
        data = r.json().get("data", [])
        if not data:
            pytest.skip("No assets available for link test")
        asset_id = data[0]["id"]

        # Find a magazine article id (admin list)
        r = requests.get(f"{BASE_URL}/api/magazine/admin/articles",
                         headers=demo_headers, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        articles = body.get("articles") or body.get("data") or (body if isinstance(body, list) else [])
        assert len(articles) > 0, f"No articles returned: {body}"
        article_id = articles[0]["id"]
        return article_id, asset_id

    def test_link_create_and_idempotent(self, demo_headers, article_and_asset):
        article_id, asset_id = article_and_asset
        body = {"entity_type": "magazine_article",
                "entity_id": article_id, "role": "body"}
        r1 = requests.post(f"{BASE_URL}/api/media/{asset_id}/links",
                           json=body, headers=demo_headers, timeout=20)
        assert r1.status_code in (200, 201, 409), r1.text
        # Second identical create — must NOT 500. Either 200/201/409.
        r2 = requests.post(f"{BASE_URL}/api/media/{asset_id}/links",
                           json=body, headers=demo_headers, timeout=20)
        assert r2.status_code in (200, 201, 409), \
            f"Second link create should be idempotent: {r2.status_code} {r2.text}"


# ── Magazine article hero_url persistence ─────────────────────────────
class TestArticleHeroPersistence:
    def test_patch_and_get_hero_url(self, demo_headers):
        # Find a TEST article — create new to avoid clobbering demo seed
        slug = f"test-y3a-{uuid.uuid4().hex[:8]}"
        create = requests.post(f"{BASE_URL}/api/magazine/admin/articles",
                               json={"slug": slug,
                                     "category_slug": "hospitality",
                                     "locale_content": {"it": {"title": "TEST Y3A"}}},
                               headers=demo_headers, timeout=20)
        if create.status_code not in (200, 201):
            pytest.skip(f"Cannot create test article: {create.status_code} {create.text}")
        art = create.json().get("data", create.json())
        art_id = art["id"]

        new_hero = "https://example.com/hero-test.jpg"
        p = requests.patch(f"{BASE_URL}/api/magazine/admin/articles/{art_id}",
                           json={"hero_url": new_hero},
                           headers=demo_headers, timeout=20)
        assert p.status_code in (200, 204), p.text

        g = requests.get(f"{BASE_URL}/api/magazine/admin/articles/{art_id}",
                         headers=demo_headers, timeout=20)
        assert g.status_code == 200, g.text
        got = g.json().get("data", g.json())
        assert got.get("hero_url") == new_hero, f"hero_url not persisted: {got.get('hero_url')}"

        # Cleanup
        requests.delete(f"{BASE_URL}/api/magazine/admin/articles/{art_id}",
                        headers=demo_headers, timeout=20)
