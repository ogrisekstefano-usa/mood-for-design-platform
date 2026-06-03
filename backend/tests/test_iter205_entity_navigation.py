"""ITER205 / ITER204-B · Entity Navigation Layer™ backend tests.

Tests the 4 composite detail endpoints under /api/knowledge/
plus the brand embassy real-count fix.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://content-hub-pro-22.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASSWORD = "Blueprint2024!"

BRAND_ID = "ab1399d7-ab6a-498e-8c4f-bc36af69e182"          # ARBI Test Bathroom
COLLECTION_ID = "03c481c4-5f64-44e7-9537-513a4c714c04"     # Essentials (123 products)
PRODUCT_ID = "5fd0c7ac-439d-457f-a973-459f9802494d"        # Untitled 2
MATERIAL_UUID = "2996b7ce-3fd8-499d-baf8-011ad9ac8f81"     # wood (UUID)
MATERIAL_NAME = "wood"                                     # lowercase name
DESIGNER_ID = "fa5ede59-e1a0-4ce9-a6b8-6f99971bbcdc"       # Marco Acerbis


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:300]}"
    body = r.json()
    tok = body.get("session", {}).get("access_token") or body.get("access_token")
    assert tok, f"no token in {body}"
    return tok


@pytest.fixture(scope="module")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}",
                      "Content-Type": "application/json"})
    return s


# ── 1 · Collection Detail ───────────────────────────────────────────
class TestCollectionDetail:
    def test_essentials_returns_real_payload(self, client):
        url = f"{BASE_URL}/api/knowledge/brands/{BRAND_ID}/collections/{COLLECTION_ID}"
        r = client.get(url, timeout=60)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        # structural
        for k in ("collection", "brand", "counts", "products",
                  "materials", "designers", "related_collections",
                  "saved", "states"):
            assert k in d, f"missing key {k}"
        # collection identity
        assert d["collection"]["id"] == COLLECTION_ID
        assert d["collection"]["name"]  # name not empty
        # counts must be real (essentials should have many products)
        assert d["counts"]["products"] >= 100, f"expected >=100, got {d['counts']['products']}"
        # products have image_url and id
        assert isinstance(d["products"], list)
        assert len(d["products"]) > 0
        sample = d["products"][0]
        for k in ("id", "name", "image_url"):
            assert k in sample
        # brand
        assert d["brand"]["id"] == BRAND_ID

    def test_404_unknown_collection(self, client):
        url = f"{BASE_URL}/api/knowledge/brands/{BRAND_ID}/collections/00000000-0000-0000-0000-000000000000"
        r = client.get(url, timeout=30)
        assert r.status_code == 404

    def test_unauthenticated_rejected(self):
        url = f"{BASE_URL}/api/knowledge/brands/{BRAND_ID}/collections/{COLLECTION_ID}"
        r = requests.get(url, timeout=30)
        assert r.status_code in (401, 403)


# ── 2 · Product Detail ──────────────────────────────────────────────
class TestProductDetail:
    def test_product_payload(self, client):
        url = f"{BASE_URL}/api/knowledge/brands/{BRAND_ID}/products/{PRODUCT_ID}"
        r = client.get(url, timeout=30)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        for k in ("product", "brand", "collection", "images",
                  "designers", "related_products", "saved", "states"):
            assert k in d
        assert d["product"]["id"] == PRODUCT_ID
        assert d["brand"]["id"] == BRAND_ID
        assert isinstance(d["images"], list)
        assert isinstance(d["related_products"], list)

    def test_404_unknown_product(self, client):
        url = f"{BASE_URL}/api/knowledge/brands/{BRAND_ID}/products/00000000-0000-0000-0000-000000000000"
        r = client.get(url, timeout=30)
        assert r.status_code == 404


# ── 3 · Material Detail ─────────────────────────────────────────────
class TestMaterialDetail:
    def test_material_by_uuid(self, client):
        url = f"{BASE_URL}/api/knowledge/materials/{MATERIAL_UUID}"
        r = client.get(url, timeout=60)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert "material" in d
        assert d["material"]["name"]
        assert "brands" in d and "collections" in d and "products" in d
        assert isinstance(d["counts"]["products"], int)

    def test_material_by_name_wood(self, client):
        url = f"{BASE_URL}/api/knowledge/materials/{MATERIAL_NAME}"
        r = client.get(url, timeout=60)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d["material"]["name"].lower().startswith("wood")
        # should have products if catalog seeded
        assert isinstance(d["products"], list)

    def test_material_unknown_returns_payload_or_404(self, client):
        # Endpoint accepts arbitrary names; unknown names currently return 200
        # with empty products list (see backend material fallback logic).
        url = f"{BASE_URL}/api/knowledge/materials/__definitely_unknown_material_xyz__"
        r = client.get(url, timeout=30)
        assert r.status_code in (200, 404)
        if r.status_code == 200:
            d = r.json()
            assert d["counts"]["products"] == 0


# ── 4 · Designer Detail ─────────────────────────────────────────────
class TestDesignerDetail:
    def test_designer_payload(self, client):
        url = f"{BASE_URL}/api/knowledge/designers/{DESIGNER_ID}"
        r = client.get(url, timeout=30)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        for k in ("designer", "brands", "collections", "products",
                  "counts", "saved", "states"):
            assert k in d
        assert d["designer"]["name"]

    def test_designer_404(self, client):
        url = f"{BASE_URL}/api/knowledge/designers/00000000-0000-0000-0000-000000000000"
        r = client.get(url, timeout=30)
        assert r.status_code == 404


# ── 5 · Brand Embassy — real product_count ──────────────────────────
class TestBrandEmbassyRealCounts:
    def test_embassy_essentials_has_real_count(self, client):
        url = f"{BASE_URL}/api/knowledge/brands/{BRAND_ID}/embassy"
        r = client.get(url, timeout=60)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        colls = d.get("collections") or d.get("collection_universe") or []
        # find Essentials
        essentials = None
        for c in colls:
            if c.get("id") == COLLECTION_ID or (c.get("name") or "").lower() == "essentials":
                essentials = c
                break
        assert essentials is not None, f"Essentials not found in embassy. keys={list(d.keys())}"
        pc = essentials.get("product_count") or essentials.get("products_count") or essentials.get("counts", {}).get("products")
        assert isinstance(pc, int), f"product_count missing or not int: {essentials}"
        assert pc >= 100, f"expected real product_count >=100, got {pc} (likely still capped at 20)"


# ── 6 · Studio Library integration ──────────────────────────────────
class TestStudioLibrarySavedFlag:
    def test_saved_flag_reflects_library(self, client):
        # save a designer
        save = client.post(f"{BASE_URL}/api/studio-library",
                            json={"entity_type": "designer",
                                  "entity_id": DESIGNER_ID,
                                  "source_type": "brand_atlas"},
                            timeout=30)
        assert save.status_code in (200, 201), save.text[:300]
        # designer detail must show saved=True
        r = client.get(f"{BASE_URL}/api/knowledge/designers/{DESIGNER_ID}", timeout=30)
        assert r.status_code == 200
        assert r.json()["saved"] is True
        # cleanup
        client.delete(f"{BASE_URL}/api/studio-library/by-entity",
                       params={"entity_type": "designer",
                               "entity_id": DESIGNER_ID},
                       timeout=30)
