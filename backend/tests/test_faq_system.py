"""
FAQ System — backend tests for 100% CMS-driven FAQ.

Covers:
- Public GET /api/site/faq?locale=… (it-IT, en-US fallback, search filter, jsonld)
- Admin auth required (401 without token)
- Admin CRUD on /api/admin/site/faq/categories and /items
- Admin GET/PUT /api/admin/site/faq/page persists hero_title and reflects in public
- Reorder endpoints
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASSWORD = "MoodAdmin2026!"
TENANT_SLUG = "studio"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "tenant_slug": None},
        timeout=20,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    data = r.json()
    token = data.get("token") or data.get("access_token")
    if not token:
        pytest.skip(f"No token in login response: {data}")
    return token


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {
        "Authorization": f"Bearer {admin_token}",
        "X-Tenant-Slug": TENANT_SLUG,
        "Content-Type": "application/json",
    }


# ── PUBLIC ─────────────────────────────────────────────────────────────

class TestPublicFaq:
    def test_get_faq_it_locale(self):
        r = requests.get(f"{BASE_URL}/api/site/faq", params={"locale": "it-IT"}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "page" in data
        assert "categories" in data
        assert "jsonld" in data
        assert data["jsonld"]["@type"] == "FAQPage"
        assert isinstance(data["jsonld"]["mainEntity"], list)
        assert "hero" in data["page"]
        assert "finalCta" in data["page"]
        assert "seo" in data["page"]

    def test_get_faq_en_fallback(self):
        r = requests.get(f"{BASE_URL}/api/site/faq", params={"locale": "en-US"}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "categories" in data
        # graceful fallback: must return same structure
        assert data["page"]["hero"] is not None

    def test_get_faq_search_filter(self):
        # Use 'mood' which the problem statement says exists
        r = requests.get(
            f"{BASE_URL}/api/site/faq",
            params={"locale": "it-IT", "q": "zzzz_nonexistent_xyz"},
            timeout=20,
        )
        assert r.status_code == 200
        data = r.json()
        # No matches → empty categories list
        assert data["categories"] == []


# ── ADMIN AUTH ────────────────────────────────────────────────────────

class TestAdminAuth:
    def test_categories_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/site/faq/categories", timeout=20)
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}: {r.text}"

    def test_page_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/site/faq/page", timeout=20)
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}: {r.text}"

    def test_items_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/site/faq/items", timeout=20)
        assert r.status_code in (401, 403)


# ── ADMIN PAGE SETTINGS ───────────────────────────────────────────────

class TestPageSettings:
    def test_get_page_settings(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/site/faq/page", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "locale_content" in data
        assert isinstance(data["locale_content"], dict)

    def test_put_page_persists_and_reflects_public(self, admin_headers):
        # Save unique hero_title
        unique_title = f"TEST_Domande_{uuid.uuid4().hex[:8]}"
        # Read existing to merge
        cur = requests.get(
            f"{BASE_URL}/api/admin/site/faq/page", headers=admin_headers, timeout=20
        ).json()
        lc = cur.get("locale_content") or {}
        it = lc.get("it-IT") or {}
        it["hero_title"] = unique_title
        lc["it-IT"] = it

        r = requests.put(
            f"{BASE_URL}/api/admin/site/faq/page",
            headers=admin_headers,
            json={"locale_content": lc},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # Public must reflect it
        pub = requests.get(
            f"{BASE_URL}/api/site/faq", params={"locale": "it-IT"}, timeout=20
        ).json()
        assert pub["page"]["hero"]["title"] == unique_title

        # Restore to 'Domande Frequenti' as expected by the spec
        it["hero_title"] = "Domande Frequenti"
        lc["it-IT"] = it
        requests.put(
            f"{BASE_URL}/api/admin/site/faq/page",
            headers=admin_headers,
            json={"locale_content": lc},
            timeout=20,
        )


# ── ADMIN CRUD ─────────────────────────────────────────────────────────

@pytest.fixture(scope="class")
def created_category(admin_headers):
    slug = f"test-cat-{uuid.uuid4().hex[:6]}"
    r = requests.post(
        f"{BASE_URL}/api/admin/site/faq/categories",
        headers=admin_headers,
        json={
            "slug": slug,
            "sort_order": 999,
            "visible": True,
            "locale_content": {"it-IT": {"title": "TEST Categoria", "description": "test desc"}},
        },
        timeout=20,
    )
    assert r.status_code == 200, r.text
    cid = r.json()["id"]
    yield {"id": cid, "slug": slug}
    # cleanup
    requests.delete(
        f"{BASE_URL}/api/admin/site/faq/categories/{cid}", headers=admin_headers, timeout=20
    )


class TestCategoryCrud:
    def test_create_and_list_category(self, admin_headers, created_category):
        r = requests.get(
            f"{BASE_URL}/api/admin/site/faq/categories", headers=admin_headers, timeout=20
        )
        assert r.status_code == 200
        cats = r.json()["categories"]
        assert any(c["id"] == created_category["id"] for c in cats)

    def test_update_category(self, admin_headers, created_category):
        cid = created_category["id"]
        r = requests.patch(
            f"{BASE_URL}/api/admin/site/faq/categories/{cid}",
            headers=admin_headers,
            json={
                "slug": created_category["slug"],
                "sort_order": 999,
                "visible": True,
                "locale_content": {"it-IT": {"title": "TEST Updated"}},
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text

        # verify
        lst = requests.get(
            f"{BASE_URL}/api/admin/site/faq/categories", headers=admin_headers, timeout=20
        ).json()
        found = next((c for c in lst["categories"] if c["id"] == cid), None)
        assert found is not None
        assert found["locale_content"]["it-IT"]["title"] == "TEST Updated"

    def test_reorder_categories(self, admin_headers, created_category):
        r = requests.post(
            f"{BASE_URL}/api/admin/site/faq/categories/reorder",
            headers=admin_headers,
            json={"entries": [{"id": created_category["id"], "sort_order": 1234}]},
            timeout=20,
        )
        assert r.status_code == 200
        lst = requests.get(
            f"{BASE_URL}/api/admin/site/faq/categories", headers=admin_headers, timeout=20
        ).json()
        found = next((c for c in lst["categories"] if c["id"] == created_category["id"]), None)
        assert found["sort_order"] == 1234


class TestItemCrud:
    def test_create_update_delete_item(self, admin_headers, created_category):
        # CREATE
        r = requests.post(
            f"{BASE_URL}/api/admin/site/faq/items",
            headers=admin_headers,
            json={
                "category_id": created_category["id"],
                "sort_order": 10,
                "visible": True,
                "locale_content": {
                    "it-IT": {"question": "TEST Q?", "answer": "TEST A."}
                },
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        iid = r.json()["id"]

        # LIST
        lst = requests.get(
            f"{BASE_URL}/api/admin/site/faq/items",
            headers=admin_headers,
            params={"category_id": created_category["id"]},
            timeout=20,
        ).json()
        assert any(it["id"] == iid for it in lst["items"])

        # UPDATE
        r = requests.patch(
            f"{BASE_URL}/api/admin/site/faq/items/{iid}",
            headers=admin_headers,
            json={
                "category_id": created_category["id"],
                "sort_order": 20,
                "visible": True,
                "locale_content": {"it-IT": {"question": "TEST Q2?", "answer": "TEST A2."}},
            },
            timeout=20,
        )
        assert r.status_code == 200

        # REORDER
        r = requests.post(
            f"{BASE_URL}/api/admin/site/faq/items/reorder",
            headers=admin_headers,
            json={"entries": [{"id": iid, "sort_order": 77}]},
            timeout=20,
        )
        assert r.status_code == 200

        # PUBLIC should show item (search by 'TEST Q2')
        pub = requests.get(
            f"{BASE_URL}/api/site/faq",
            params={"locale": "it-IT", "q": "TEST Q2"},
            timeout=20,
        ).json()
        # category should appear with the item
        matched = False
        for c in pub["categories"]:
            for it in c["items"]:
                if "TEST Q2" in it["question"]:
                    matched = True
                    break
        assert matched, f"Created item not in public response: {pub}"

        # DELETE
        r = requests.delete(
            f"{BASE_URL}/api/admin/site/faq/items/{iid}", headers=admin_headers, timeout=20
        )
        assert r.status_code == 200

        # Should be gone
        lst = requests.get(
            f"{BASE_URL}/api/admin/site/faq/items",
            headers=admin_headers,
            params={"category_id": created_category["id"]},
            timeout=20,
        ).json()
        assert not any(it["id"] == iid for it in lst["items"])
