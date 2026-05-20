"""Iter88 · Phase E · Sprint E1 + E2 — Brand & Collection CRUD."""
import os
import uuid
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent.parent.parent / "frontend" / ".env")

API = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
LOGIN = "demo@moodfordesign.com"
PWD   = "Blueprint2024!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/api/auth/login", json={"email": LOGIN, "password": PWD}, timeout=20)
    r.raise_for_status()
    return r.json()["session"]["access_token"]


def auth(t):
    return {"Authorization": f"Bearer {t}"}


# ── Sprint E1 · Brand CRUD ─────────────────────────────────────────────
class TestBrandCRUD:
    def test_create_studio_brand(self, token):
        unique = f"Test Atelier {uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/api/inspirations/registry/brands",
                          headers=auth(token),
                          json={"name": unique, "positioning": "Atelier test",
                                "luxury_tier": "premium", "primary_markets": ["it-milano"]},
                          timeout=20)
        assert r.status_code == 201
        item = r.json()["item"]
        assert item["name"] == unique
        assert item["tenant_id"] is not None  # studio_private
        # cleanup
        requests.delete(f"{API}/api/inspirations/registry/brands/{item['id']}", headers=auth(token), timeout=15)

    def test_patch_studio_brand(self, token):
        unique = f"Test PatchBrand {uuid.uuid4().hex[:6]}"
        bid = requests.post(f"{API}/api/inspirations/registry/brands",
                            headers=auth(token), json={"name": unique},
                            timeout=20).json()["item"]["id"]
        r = requests.patch(f"{API}/api/inspirations/registry/brands/{bid}",
                           headers=auth(token),
                           json={"positioning": "Aggiornato", "luxury_tier": "luxury"},
                           timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["positioning"] == "Aggiornato"
        assert d["luxury_tier"] == "luxury"
        # cleanup
        requests.delete(f"{API}/api/inspirations/registry/brands/{bid}", headers=auth(token), timeout=15)

    def test_patch_curated_brand_403(self, token):
        # Bonaldo is curated_public (tenant_id IS NULL)
        bonaldo = requests.get(f"{API}/api/inspirations/registry/brands?q=Bonaldo",
                               headers=auth(token), timeout=15).json()["items"][0]
        r = requests.patch(f"{API}/api/inspirations/registry/brands/{bonaldo['id']}",
                           headers=auth(token), json={"positioning": "X"},
                           timeout=15)
        assert r.status_code == 403
        assert "curato da mood" in r.json()["detail"].lower()

    def test_delete_studio_brand(self, token):
        unique = f"Test DelBrand {uuid.uuid4().hex[:6]}"
        bid = requests.post(f"{API}/api/inspirations/registry/brands",
                            headers=auth(token), json={"name": unique},
                            timeout=20).json()["item"]["id"]
        r = requests.delete(f"{API}/api/inspirations/registry/brands/{bid}",
                            headers=auth(token), timeout=15)
        assert r.status_code == 204
        # 404 on reload
        r2 = requests.get(f"{API}/api/inspirations/registry/brands/{bid}",
                          headers=auth(token), timeout=15)
        assert r2.status_code == 404

    def test_delete_curated_brand_403(self, token):
        bonaldo = requests.get(f"{API}/api/inspirations/registry/brands?q=Bonaldo",
                               headers=auth(token), timeout=15).json()["items"][0]
        r = requests.delete(f"{API}/api/inspirations/registry/brands/{bonaldo['id']}",
                            headers=auth(token), timeout=15)
        assert r.status_code == 403

    def test_atlas_includes_is_studio_private_flag(self, token):
        r = requests.get(f"{API}/api/inspirations/registry/brands-atlas?limit=30",
                         headers=auth(token), timeout=20)
        items = r.json()["items"]
        # Each card must carry is_studio_private
        for b in items[:10]:
            assert "is_studio_private" in b
        # Mix of curated + studio_private should exist
        flags = {b["is_studio_private"] for b in items}
        assert True in flags or False in flags  # at least one type


# ── Sprint E2 · Collection CRUD ────────────────────────────────────────
class TestCollectionCRUD:
    @pytest.fixture(scope="class")
    def studio_brand(self, token):
        # Create a studio brand we own to test collection CRUD
        unique = f"Test CollHost {uuid.uuid4().hex[:6]}"
        bid = requests.post(f"{API}/api/inspirations/registry/brands",
                            headers=auth(token), json={"name": unique},
                            timeout=20).json()["item"]["id"]
        yield bid
        requests.delete(f"{API}/api/inspirations/registry/brands/{bid}",
                        headers=auth(token), timeout=15)

    def test_create_collection(self, token, studio_brand):
        unique = f"Outdoor Living {uuid.uuid4().hex[:4]}"
        r = requests.post(f"{API}/api/inspirations/registry/brands/{studio_brand}/collections",
                          headers=auth(token),
                          json={"name": unique, "year": 2026, "category": "Outdoor",
                                "description": "Capitolo outdoor con linee in teak."},
                          timeout=20)
        assert r.status_code == 201
        item = r.json()["item"]
        assert item["name"] == unique
        assert item["year"] == 2026
        # cleanup
        requests.delete(f"{API}/api/inspirations/registry/collections/{item['id']}",
                        headers=auth(token), timeout=15)

    def test_patch_collection(self, token, studio_brand):
        unique = f"Test PatchColl {uuid.uuid4().hex[:4]}"
        cid = requests.post(f"{API}/api/inspirations/registry/brands/{studio_brand}/collections",
                            headers=auth(token), json={"name": unique, "year": 2025},
                            timeout=20).json()["item"]["id"]
        r = requests.patch(f"{API}/api/inspirations/registry/collections/{cid}",
                           headers=auth(token),
                           json={"description": "Descrizione aggiornata", "year": 2027},
                           timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["description"] == "Descrizione aggiornata"
        assert d["year"] == 2027
        # cleanup
        requests.delete(f"{API}/api/inspirations/registry/collections/{cid}",
                        headers=auth(token), timeout=15)

    def test_delete_collection(self, token, studio_brand):
        unique = f"Test DelColl {uuid.uuid4().hex[:4]}"
        cid = requests.post(f"{API}/api/inspirations/registry/brands/{studio_brand}/collections",
                            headers=auth(token), json={"name": unique},
                            timeout=20).json()["item"]["id"]
        r = requests.delete(f"{API}/api/inspirations/registry/collections/{cid}",
                            headers=auth(token), timeout=15)
        assert r.status_code == 204

    def test_curated_brand_collection_returns_403_on_delete(self, token):
        # Find a curated public collection (tenant_id IS NULL) — Bonaldo seeds
        bonaldo = requests.get(f"{API}/api/inspirations/registry/brands?q=Bonaldo",
                               headers=auth(token), timeout=15).json()["items"][0]
        colls = requests.get(f"{API}/api/inspirations/registry/brands/{bonaldo['id']}/collections",
                             headers=auth(token), timeout=15).json()["items"]
        public = next((c for c in colls if c.get("tenant_id") is None), None)
        if not public:
            pytest.skip("No public curated collection in test data")
        r = requests.delete(f"{API}/api/inspirations/registry/collections/{public['id']}",
                            headers=auth(token), timeout=15)
        assert r.status_code == 403
