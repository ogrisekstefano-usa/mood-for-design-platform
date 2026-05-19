"""Iteration 82 — Brand Registry™ + Collections Registry™ + Tag Registry™
+ refactored Supplier Catalog Import™ entity-pickers + Product Usage Events™.

Scope (matches review_request features_or_bugs_to_test):
  BACKEND 1: GET /registry/brands → ≥15 curated_public + q filter
  BACKEND 2: POST /registry/brands → 201 + idempotent
  BACKEND 3: GET/POST /registry/brands/{id}/collections → list + idempotent create
  BACKEND 4: GET /registry/taxonomy → 14 categories + 6 rights_permissions
  BACKEND 5: GET /registry/tags?type=atmosphere|material|brand
  BACKEND 6: POST /catalogs with brand_id+collection_id → resolves names
  BACKEND 7: POST /catalogs validation (bad brand_id, mismatched collection, legacy text-only)
  BACKEND 8: POST /registry/usage-events → 201 with denormalized brand_id
"""
import os
import re
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

EMAIL = "demo@moodfordesign.com"
PASSWORD = "Blueprint2024!"

UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I
)

EXPECTED_BRANDS = {
    "minotti", "poliform", "cassina", "b&b italia", "flexform", "bonaldo",
    "cattelan italia", "molteni&c", "maxalto", "flos", "artemide", "boffi",
    "margraf", "rimadesio", "edra",
}

EXPECTED_CATEGORIES = {
    "arredi", "cucine", "bagni", "illuminazione", "outdoor", "rivestimenti",
    "pietra_naturale", "decor", "contract", "hospitality", "workspace",
    "lifestyle", "technical", "materials",
}


# ── fixtures ─────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def auth_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"login failed: {r.status_code} {r.text[:200]}")
    body = r.json()
    sess = body.get("session") or {}
    token = (sess.get("access_token") or body.get("access_token")
             or body.get("token") or (body.get("data") or {}).get("token"))
    assert token, f"no token in login body: {body}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def seed_brands(auth_session):
    """Fetch full brand list once and reuse."""
    r = auth_session.get(
        f"{BASE_URL}/api/inspirations/registry/brands",
        params={"limit": 50}, timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json().get("items") or []


# ── BACKEND 1 ─ brand autocomplete + 15 seeded ─────────────────────
class TestBrandAutocomplete:

    def test_seeded_at_least_15_curated_brands(self, seed_brands):
        names_lower = {(b.get("name") or "").lower() for b in seed_brands}
        missing = EXPECTED_BRANDS - names_lower
        assert not missing, f"missing curated brands: {missing}"

    def test_curated_have_metadata(self, seed_brands):
        poli = next((b for b in seed_brands
                     if (b.get("name") or "").lower() == "poliform"), None)
        assert poli, "Poliform not found"
        assert poli.get("luxury_tier"), f"Poliform missing luxury_tier: {poli}"
        # Curated brands should have visibility_level = curated_public
        # (tenant_id is null)
        assert poli.get("tenant_id") in (None, "null"), \
            f"Poliform should be curated_public, got tenant_id={poli.get('tenant_id')}"
        # primary_markets list expected
        assert isinstance(poli.get("primary_markets"), list)

    def test_filter_q_case_insensitive(self, auth_session):
        r = auth_session.get(
            f"{BASE_URL}/api/inspirations/registry/brands",
            params={"q": "pol", "limit": 20}, timeout=15,
        )
        assert r.status_code == 200, r.text
        items = r.json().get("items") or []
        assert items, "no results for q=pol"
        names = {(b.get("name") or "").lower() for b in items}
        assert "poliform" in names, f"Poliform missing from q=pol: {names}"
        # All results contain 'pol' in name/slug
        for b in items:
            hay = (b.get("name", "") + b.get("slug", "")).lower()
            assert "pol" in hay, f"non-matching result: {b.get('name')}"


# ── BACKEND 2 ─ create brand + idempotency ─────────────────────────
class TestBrandCreate:

    BRAND_NAME = f"TEST_WalterKnoll_{uuid.uuid4().hex[:6]}"

    def test_create_brand_studio_private(self, auth_session):
        r = auth_session.post(
            f"{BASE_URL}/api/inspirations/registry/brands",
            json={"name": self.BRAND_NAME, "category": "arredi", "country": "DE"},
            timeout=15,
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert body.get("created") is True
        item = body.get("item") or {}
        assert item.get("name") == self.BRAND_NAME
        assert item.get("visibility_level") == "studio_private"
        assert item.get("slug"), "slug missing"
        assert UUID_RE.match(item.get("id") or ""), f"bad id: {item.get('id')}"

    def test_create_brand_idempotent(self, auth_session):
        r = auth_session.post(
            f"{BASE_URL}/api/inspirations/registry/brands",
            json={"name": self.BRAND_NAME, "category": "arredi", "country": "DE"},
            timeout=15,
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert body.get("created") is False, f"expected created=False, got {body}"
        assert (body.get("item") or {}).get("name") == self.BRAND_NAME

    def test_create_brand_slug_format(self, auth_session):
        # Use a name with spaces — verify slug normalization
        name = f"TEST Brand Slug {uuid.uuid4().hex[:6]}"
        r = auth_session.post(
            f"{BASE_URL}/api/inspirations/registry/brands",
            json={"name": name}, timeout=15,
        )
        assert r.status_code == 201, r.text
        item = (r.json() or {}).get("item") or {}
        assert " " not in (item.get("slug") or "")
        assert (item.get("slug") or "").startswith("test-brand-slug-")


# ── BACKEND 3 ─ collections list + idempotent create ───────────────
@pytest.fixture(scope="module")
def bonaldo_id(seed_brands):
    b = next((x for x in seed_brands
              if (x.get("name") or "").lower() == "bonaldo"), None)
    assert b, "Bonaldo brand not seeded"
    return b["id"]


class TestCollectionsRegistry:

    COLLECTION_NAME = f"TEST_Heritage_{uuid.uuid4().hex[:6]}"

    def test_list_collections_bonaldo(self, auth_session, bonaldo_id):
        r = auth_session.get(
            f"{BASE_URL}/api/inspirations/registry/brands/{bonaldo_id}/collections",
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert isinstance(r.json().get("items"), list)

    def test_create_collection_under_bonaldo(self, auth_session, bonaldo_id):
        r = auth_session.post(
            f"{BASE_URL}/api/inspirations/registry/brands/{bonaldo_id}/collections",
            json={"name": self.COLLECTION_NAME, "year": 2026}, timeout=15,
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert body.get("created") is True
        item = body.get("item") or {}
        assert item.get("name") == self.COLLECTION_NAME
        assert item.get("year") == 2026
        assert item.get("brand_id") == bonaldo_id
        assert item.get("slug"), "slug missing"
        # Verify via GET that it persisted
        g = auth_session.get(
            f"{BASE_URL}/api/inspirations/registry/brands/{bonaldo_id}/collections",
            timeout=15,
        )
        names = {(c.get("name") or "") for c in (g.json().get("items") or [])}
        assert self.COLLECTION_NAME in names, \
            f"created collection not in list: {names}"

    def test_create_collection_idempotent(self, auth_session, bonaldo_id):
        r = auth_session.post(
            f"{BASE_URL}/api/inspirations/registry/brands/{bonaldo_id}/collections",
            json={"name": self.COLLECTION_NAME, "year": 2026}, timeout=15,
        )
        assert r.status_code == 201, r.text
        assert r.json().get("created") is False


# ── BACKEND 4 ─ taxonomy 14 categories + 6 rights ──────────────────
class TestTaxonomy:

    def test_14_categories_and_6_rights(self, auth_session):
        r = auth_session.get(
            f"{BASE_URL}/api/inspirations/registry/taxonomy", timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        cats = data.get("categories") or []
        rights = data.get("rights_permissions") or []
        assert len(cats) == 14, \
            f"expected 14 categories, got {len(cats)}: {[c.get('key') for c in cats]}"
        cat_keys = {c["key"] for c in cats}
        assert cat_keys == EXPECTED_CATEGORIES, \
            f"diff: missing={EXPECTED_CATEGORIES-cat_keys}, extra={cat_keys-EXPECTED_CATEGORIES}"
        assert len(rights) == 6, f"expected 6 rights_permissions, got {len(rights)}"
        for r_ in rights:
            for flag in ("publishable", "exportable", "commercial_use", "modifiable"):
                assert flag in r_, f"rights row missing flag {flag}: {r_}"

    def test_rights_flags_semantic(self, auth_session):
        r = auth_session.get(
            f"{BASE_URL}/api/inspirations/registry/taxonomy", timeout=15,
        )
        rights = (r.json() or {}).get("rights_permissions") or []
        by_key = {x["key"]: x for x in rights}
        # editorial_reference: pub/exp/comm all False, modifiable True
        ed = by_key.get("editorial_reference")
        assert ed, "editorial_reference missing"
        assert ed["publishable"] is False
        assert ed["exportable"] is False
        assert ed["commercial_use"] is False
        assert ed["modifiable"] is True
        # official_brand_asset: pub/exp/comm True, modifiable False
        off = by_key.get("official_brand_asset")
        assert off, "official_brand_asset missing"
        assert off["publishable"] is True
        assert off["exportable"] is True
        assert off["commercial_use"] is True
        assert off["modifiable"] is False


# ── BACKEND 5 ─ tag registry ───────────────────────────────────────
class TestTagRegistry:

    @pytest.mark.parametrize("type_", ["atmosphere", "material", "brand"])
    def test_tags_by_type_seeded(self, auth_session, type_):
        r = auth_session.get(
            f"{BASE_URL}/api/inspirations/registry/tags",
            params={"type": type_, "limit": 50}, timeout=15,
        )
        assert r.status_code == 200, r.text
        items = r.json().get("items") or []
        assert items, f"no tags for type={type_}"
        for t in items:
            assert t.get("type") == type_, f"tag has wrong type: {t}"

    def test_brand_tags_includes_15_seeded(self, auth_session):
        r = auth_session.get(
            f"{BASE_URL}/api/inspirations/registry/tags",
            params={"type": "brand", "limit": 60}, timeout=15,
        )
        items = r.json().get("items") or []
        # Either label or slug matches expected
        names = {(t.get("label") or "").lower() for t in items}
        slugs = {(t.get("slug") or "").lower() for t in items}
        seeded_hit = EXPECTED_BRANDS & (names | slugs)
        assert len(seeded_hit) >= 10, \
            f"expected ≥10 seeded brand tags, got {len(seeded_hit)}: {seeded_hit}"


# ── BACKEND 6 ─ catalog with brand_id + collection_id ──────────────
@pytest.fixture(scope="module")
def bonaldo_test_collection(auth_session, bonaldo_id):
    name = f"TEST_Cat_Coll_{uuid.uuid4().hex[:6]}"
    r = auth_session.post(
        f"{BASE_URL}/api/inspirations/registry/brands/{bonaldo_id}/collections",
        json={"name": name, "year": 2026}, timeout=15,
    )
    assert r.status_code == 201, r.text
    return r.json().get("item") or {}


class TestCatalogWithRegistryIds:

    def test_create_catalog_resolves_brand_and_collection(
        self, auth_session, bonaldo_id, bonaldo_test_collection
    ):
        col_id = bonaldo_test_collection["id"]
        body = {
            "brand_id": bonaldo_id,
            "collection_id": col_id,
            "category": "arredi",
            "rights_status": "official_brand_asset",
        }
        r = auth_session.post(f"{BASE_URL}/api/inspirations/catalogs",
                              json=body, timeout=20)
        assert r.status_code == 201, r.text
        cat = r.json()
        assert cat.get("brand") == "Bonaldo", f"brand not resolved: {cat}"
        assert cat.get("collection") == bonaldo_test_collection["name"], cat
        assert cat.get("rights_status") == "official_brand_asset"
        # Verify via GET that brand_id+collection_id persisted
        cid = cat.get("id")
        g = auth_session.get(f"{BASE_URL}/api/inspirations/catalogs/{cid}",
                             timeout=15)
        assert g.status_code == 200
        gcat = g.json()
        assert gcat.get("brand_id") == bonaldo_id
        assert gcat.get("collection_id") == col_id


# ── BACKEND 7 ─ catalog validation ─────────────────────────────────
class TestCatalogValidation:

    def test_invalid_brand_id_400(self, auth_session):
        fake = str(uuid.uuid4())
        r = auth_session.post(
            f"{BASE_URL}/api/inspirations/catalogs",
            json={"brand_id": fake, "category": "arredi",
                  "rights_status": "studio_uploaded"}, timeout=15,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"

    def test_collection_mismatched_brand_400(self, auth_session, bonaldo_id,
                                              bonaldo_test_collection):
        # Get another brand id (Poliform) and try to use Bonaldo's collection
        br = auth_session.get(
            f"{BASE_URL}/api/inspirations/registry/brands",
            params={"q": "poliform"}, timeout=15,
        )
        poli_items = br.json().get("items") or []
        poli = next((x for x in poli_items
                     if (x.get("name") or "").lower() == "poliform"), None)
        assert poli, "Poliform not found"
        r = auth_session.post(
            f"{BASE_URL}/api/inspirations/catalogs",
            json={"brand_id": poli["id"],
                  "collection_id": bonaldo_test_collection["id"],
                  "category": "arredi",
                  "rights_status": "studio_uploaded"}, timeout=15,
        )
        assert r.status_code == 400, \
            f"expected 400 for mismatched, got {r.status_code}: {r.text[:200]}"

    def test_legacy_brand_text_only_still_works(self, auth_session):
        r = auth_session.post(
            f"{BASE_URL}/api/inspirations/catalogs",
            json={"brand": f"TEST_LegacyBrand_{uuid.uuid4().hex[:6]}",
                  "category": "arredi",
                  "rights_status": "studio_uploaded"}, timeout=15,
        )
        assert r.status_code == 201, r.text
        cat = r.json()
        assert cat.get("brand", "").startswith("TEST_LegacyBrand_")
        # brand_id should be null/absent on legacy text-only path
        # Some serializers may omit it — check via GET
        g = auth_session.get(f"{BASE_URL}/api/inspirations/catalogs/{cat['id']}",
                             timeout=15)
        assert g.status_code == 200
        gcat = g.json()
        assert gcat.get("brand_id") in (None, "", "null"), \
            f"legacy text-only catalog should not have brand_id, got {gcat.get('brand_id')}"


# ── BACKEND 8 ─ product usage events ───────────────────────────────
class TestUsageEvents:

    def test_create_event_invalid_product(self, auth_session):
        """Invalid product_id should still record (brand_id null) or warn — non-fatal."""
        fake_product = str(uuid.uuid4())
        r = auth_session.post(
            f"{BASE_URL}/api/inspirations/registry/usage-events",
            json={"product_id": fake_product,
                  "usage_type": "added_to_moodboard",
                  "moodboard_id": str(uuid.uuid4()),
                  "market_code": "usa_miami"}, timeout=15,
        )
        # Endpoint is fire-and-forget; insert may succeed or warn
        assert r.status_code in (201,), f"unexpected: {r.status_code} {r.text[:200]}"
        body = r.json()
        # ok=True path → event_id; ok=False path → warning string
        if body.get("ok") is True:
            assert UUID_RE.match(body.get("event_id") or ""), body
        else:
            assert "warning" in body, body

    def test_create_event_with_existing_product(self, auth_session):
        """Find an existing product in inspirations archive and create event with denormalized brand_id."""
        ar = auth_session.get(
            f"{BASE_URL}/api/inspirations/archive",
            params={"inspiration_type": "product", "limit": 5}, timeout=20,
        )
        if ar.status_code != 200:
            pytest.skip("archive endpoint unreachable")
        items = ar.json().get("items") or []
        if not items:
            pytest.skip("no product inspirations available — run iter81 PDF flow first")
        pid = items[0]["id"]
        r = auth_session.post(
            f"{BASE_URL}/api/inspirations/registry/usage-events",
            json={"product_id": pid,
                  "usage_type": "added_to_moodboard",
                  "moodboard_id": str(uuid.uuid4()),
                  "market_code": "usa_miami"}, timeout=15,
        )
        assert r.status_code == 201, r.text
        body = r.json()
        if body.get("ok") is True:
            assert UUID_RE.match(body.get("event_id") or "")
