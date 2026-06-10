"""M-Brand-Registry Enhancement — backend pytest suite (iteration 208).

Covers:
  - GET /api/inspirations/registry/brand-categories (18 cats, ?suggested_only)
  - GET /api/inspirations/registry/tags?type=brand&suggested_only
  - GET /api/inspirations/registry/tags?type=brand&q=<autocomplete>
  - POST /api/inspirations/registry/tags (idempotent create-or-return)
  - POST /api/inspirations/registry/brands with categories/tags resolution,
    legacy back-compat, empty arrays, dedup.
  - PATCH /api/inspirations/registry/brands/{id} overwrite categories/tags
  - PUT/DELETE /api/inspirations/registry/brand-categories/{key}
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or \
    "https://i18n-recovery-1.preview.emergentagent.com"

ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASS = "Blueprint2024!"

CREATED_BRAND_IDS: list[str] = []


# ── Fixtures ────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def admin_token() -> str:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
        timeout=30,
    )
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    return (data.get("session") or {}).get("access_token") or data.get("access_token")


@pytest.fixture(scope="session")
def client(admin_token):
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_token}",
    })
    yield s
    # Teardown: delete every brand created during the suite
    for bid in CREATED_BRAND_IDS:
        try:
            s.delete(f"{BASE_URL}/api/inspirations/registry/brands/{bid}", timeout=15)
        except Exception:
            pass


def _make_name(label: str) -> str:
    return f"TEST_{label}_{uuid.uuid4().hex[:8]}"


# ── 1. brand-categories catalog ─────────────────────────────────────────
class TestBrandCategoriesCatalog:
    def test_list_returns_18_categories_with_fields(self, client):
        r = client.get(f"{BASE_URL}/api/inspirations/registry/brand-categories", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json().get("data") or []
        assert len(data) >= 18, f"expected >=18 categories, got {len(data)}"
        sample = data[0]
        for k in ("key", "label_it", "label_en", "is_suggested", "sort_order"):
            assert k in sample, f"missing field {k} in category row: {sample}"

    def test_suggested_only_returns_9(self, client):
        r = client.get(
            f"{BASE_URL}/api/inspirations/registry/brand-categories?suggested_only=true",
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json().get("data") or []
        # Spec: 9 suggested. Accept >=9 (admin may have added) but each row must be is_suggested
        assert all(row.get("is_suggested") is True for row in data)
        assert len(data) >= 9, f"expected >=9 suggested, got {len(data)}"


# ── 2. tag-registry ─────────────────────────────────────────────────────
class TestTagRegistry:
    def test_brand_tags_suggested_only(self, client):
        r = client.get(
            f"{BASE_URL}/api/inspirations/registry/tags?type=brand&suggested_only=true",
            timeout=15,
        )
        assert r.status_code == 200, r.text
        items = r.json().get("items") or []
        assert len(items) >= 13, f"expected >=13 suggested brand tags, got {len(items)}"
        assert all(t.get("is_suggested") is True for t in items)
        assert all(t.get("type") == "brand" for t in items)

    def test_brand_tags_autocomplete_q(self, client):
        r = client.get(
            f"{BASE_URL}/api/inspirations/registry/tags?type=brand&q=lux",
            timeout=15,
        )
        assert r.status_code == 200, r.text
        items = r.json().get("items") or []
        # All returned items must contain 'lux' in label or slug or a synonym
        for t in items:
            blob = " ".join([
                (t.get("label") or "").lower(),
                (t.get("slug") or "").lower(),
                " ".join((t.get("synonyms") or [])).lower(),
            ])
            assert "lux" in blob, f"tag does not match q=lux: {t}"

    def test_create_tag_idempotent(self, client):
        label = f"TEST_Lusso_{uuid.uuid4().hex[:6]}"
        r1 = client.post(
            f"{BASE_URL}/api/inspirations/registry/tags",
            json={"label": label, "type": "brand"},
            timeout=15,
        )
        assert r1.status_code in (200, 201), r1.text
        body1 = r1.json()
        assert body1.get("created") is True
        slug1 = body1["item"]["slug"]

        r2 = client.post(
            f"{BASE_URL}/api/inspirations/registry/tags",
            json={"label": label, "type": "brand"},
            timeout=15,
        )
        assert r2.status_code in (200, 201)
        body2 = r2.json()
        assert body2.get("created") is False
        assert body2["item"]["slug"] == slug1


# ── 3. brand creation: categories + tags resolution ─────────────────────
class TestBrandCreate:
    def test_categories_drop_unknown_preserve_order_dedup(self, client):
        name = _make_name("BrandCat")
        r = client.post(
            f"{BASE_URL}/api/inspirations/registry/brands",
            json={
                "name": name,
                "categories": ["cucine", "walk_in_closets", "unknown_xyz", "cucine"],
            },
            timeout=20,
        )
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert body.get("created") is True
        item = body["item"]
        CREATED_BRAND_IDS.append(item["id"])
        cats = item.get("categories") or []
        assert "unknown_xyz" not in cats, "unknown key must be dropped"
        # Order preserved, dedup applied
        assert cats == ["cucine", "walk_in_closets"] or cats == ["cucine"], (
            f"unexpected categories shape: {cats}"
        )

    def test_tags_slugify_dedup_persist(self, client):
        name = _make_name("BrandTag")
        r = client.post(
            f"{BASE_URL}/api/inspirations/registry/brands",
            json={
                "name": name,
                "tags": ["Made In Italy", "Lusso", "Custom Made", "Lusso"],
            },
            timeout=20,
        )
        assert r.status_code in (200, 201), r.text
        item = r.json()["item"]
        CREATED_BRAND_IDS.append(item["id"])
        slugs = item.get("tag_slugs") or []
        assert slugs == ["made-in-italy", "lusso", "custom-made"], slugs

        # Verify autocomplete now finds e.g. 'custom-made'
        rt = client.get(
            f"{BASE_URL}/api/inspirations/registry/tags?type=brand&q=custom",
            timeout=15,
        )
        assert rt.status_code == 200
        labels = {(t.get("slug") or "") for t in rt.json().get("items") or []}
        assert "custom-made" in labels, f"new tag not persisted: {labels}"

    def test_legacy_category_backcompat(self, client):
        """No `categories` but legacy `category` → categories=[category]."""
        name = _make_name("BrandLegacy")
        r = client.post(
            f"{BASE_URL}/api/inspirations/registry/brands",
            json={"name": name, "category": "cucine"},
            timeout=20,
        )
        assert r.status_code in (200, 201), r.text
        item = r.json()["item"]
        CREATED_BRAND_IDS.append(item["id"])
        assert item.get("categories") == ["cucine"], item.get("categories")
        assert item.get("category") == "cucine"

    def test_empty_categories_no_fallback(self, client):
        name = _make_name("BrandEmpty")
        r = client.post(
            f"{BASE_URL}/api/inspirations/registry/brands",
            json={"name": name, "categories": []},
            timeout=20,
        )
        assert r.status_code in (200, 201), r.text
        item = r.json()["item"]
        CREATED_BRAND_IDS.append(item["id"])
        assert (item.get("categories") or []) == []
        assert item.get("category") in (None, ""), f"expected null category, got {item.get('category')}"


# ── 4. PATCH overwrite categories + tags ────────────────────────────────
class TestBrandPatch:
    def test_patch_overwrites_categories_and_tags(self, client):
        name = _make_name("BrandPatch")
        r = client.post(
            f"{BASE_URL}/api/inspirations/registry/brands",
            json={"name": name, "categories": ["cucine"], "tags": ["First"]},
            timeout=20,
        )
        assert r.status_code in (200, 201), r.text
        bid = r.json()["item"]["id"]
        CREATED_BRAND_IDS.append(bid)

        pr = client.patch(
            f"{BASE_URL}/api/inspirations/registry/brands/{bid}",
            json={"categories": ["bagno", "outdoor", "junk_key"], "tags": ["Second", "Made In Italy"]},
            timeout=20,
        )
        assert pr.status_code == 200, pr.text
        merged = pr.json()
        assert "junk_key" not in (merged.get("categories") or [])
        assert "bagno" in (merged.get("categories") or [])
        assert "outdoor" in (merged.get("categories") or [])
        slugs = merged.get("tag_slugs") or []
        assert "second" in slugs and "made-in-italy" in slugs


# ── 5. RBAC: PUT/DELETE brand-categories (super_admin) ──────────────────
class TestBrandCategoriesRBAC:
    def test_super_admin_upsert_and_soft_deactivate(self, client):
        key = f"test_cat_{uuid.uuid4().hex[:6]}"
        # PUT — super_admin should succeed
        r = client.put(
            f"{BASE_URL}/api/inspirations/registry/brand-categories/{key}",
            json={
                "label_it": "Test Cat IT",
                "label_en": "Test Cat EN",
                "active": True,
                "is_suggested": False,
                "sort_order": 999,
            },
            timeout=15,
        )
        assert r.status_code in (200, 201), r.text
        item = r.json()["item"]
        assert item["key"].startswith("test-cat-") or item["key"] == key.replace("_", "-")

        # DELETE — soft deactivate
        dr = client.delete(
            f"{BASE_URL}/api/inspirations/registry/brand-categories/{item['key']}",
            timeout=15,
        )
        assert dr.status_code in (200, 204), dr.text

        # Verify active=false: listing with active_only=true must not include it
        lr = client.get(
            f"{BASE_URL}/api/inspirations/registry/brand-categories?active_only=true",
            timeout=15,
        )
        keys = {row["key"] for row in (lr.json().get("data") or [])}
        assert item["key"] not in keys, "deactivated key still listed as active"

    def test_unauthenticated_upsert_blocked(self):
        """Without token must NOT be able to upsert (401/403)."""
        bare = requests.Session()
        bare.headers.update({"Content-Type": "application/json"})
        r = bare.put(
            f"{BASE_URL}/api/inspirations/registry/brand-categories/anything",
            json={"label_it": "x", "label_en": "x"},
            timeout=15,
        )
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"
