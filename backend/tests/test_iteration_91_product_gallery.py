"""Iter91 · Phase F2.1 — Product Gallery™ + Curated References™.

Backend coverage:
  • curated_collections CRUD (create / list / get / patch / delete)
  • saved_references CRUD (save / list-by-collection / remove / by-asset)
  • visibility scoping (private / team / client_visible)
  • idempotency (same asset → same collection = no duplicate)
  • /related endpoint (rule-based "Works well with…")
  • Italian-only naming compliance
"""
import os
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent.parent / "frontend" / ".env")

API = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
LOGIN = "demo@moodfordesign.com"
PWD = "Blueprint2024!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/api/auth/login",
                      json={"email": LOGIN, "password": PWD}, timeout=20)
    r.raise_for_status()
    return r.json()["session"]["access_token"]


def auth(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def some_product_id(token):
    """Pick any product inspiration."""
    r = requests.get(f"{API}/api/inspirations/archive?inspiration_type=product&limit=1",
                     headers=auth(token), timeout=20)
    items = r.json().get("items") or []
    if not items:
        pytest.skip("No product inspirations available")
    return items[0]["id"]


# ── 1. Collections CRUD ───────────────────────────────────────────────
class TestCollectionsCRUD:
    def test_create_collection(self, token):
        title = f"Test Atelier {uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/api/inspirations/references/collections",
                          headers=auth(token), timeout=20,
                          json={"title": title,
                                "description": "test desc",
                                "tags": ["miami", "test"],
                                "visibility": "team"})
        assert r.status_code == 201, r.text
        item = r.json()["item"]
        assert item["title"] == title
        assert item["visibility"] == "team"
        assert item["items_count"] == 0
        assert "test" in item["tags"]
        # cleanup
        requests.delete(f"{API}/api/inspirations/references/collections/{item['id']}",
                        headers=auth(token), timeout=20)

    def test_visibility_validation(self, token):
        r = requests.post(f"{API}/api/inspirations/references/collections",
                          headers=auth(token), timeout=20,
                          json={"title": "x", "visibility": "WRONG"})
        assert r.status_code == 400

    def test_list_returns_team_visible(self, token):
        # Create one
        r1 = requests.post(f"{API}/api/inspirations/references/collections",
                           headers=auth(token), timeout=20,
                           json={"title": f"List Test {uuid.uuid4().hex[:6]}",
                                 "visibility": "team"})
        cid = r1.json()["item"]["id"]
        try:
            r = requests.get(f"{API}/api/inspirations/references/collections",
                             headers=auth(token), timeout=20)
            assert r.status_code == 200
            items = r.json()["items"]
            assert any(it["id"] == cid for it in items)
        finally:
            requests.delete(f"{API}/api/inspirations/references/collections/{cid}",
                            headers=auth(token), timeout=20)

    def test_patch_collection(self, token):
        r1 = requests.post(f"{API}/api/inspirations/references/collections",
                           headers=auth(token), timeout=20,
                           json={"title": f"Patch {uuid.uuid4().hex[:6]}"})
        cid = r1.json()["item"]["id"]
        try:
            r = requests.patch(f"{API}/api/inspirations/references/collections/{cid}",
                               headers=auth(token), timeout=20,
                               json={"title": "Renamed", "description": "new desc"})
            assert r.status_code == 200
            assert r.json()["item"]["title"] == "Renamed"
            assert r.json()["item"]["description"] == "new desc"
        finally:
            requests.delete(f"{API}/api/inspirations/references/collections/{cid}",
                            headers=auth(token), timeout=20)

    def test_delete_collection(self, token):
        r1 = requests.post(f"{API}/api/inspirations/references/collections",
                           headers=auth(token), timeout=20,
                           json={"title": f"Del {uuid.uuid4().hex[:6]}"})
        cid = r1.json()["item"]["id"]
        r = requests.delete(f"{API}/api/inspirations/references/collections/{cid}",
                            headers=auth(token), timeout=20)
        assert r.status_code == 204
        # 404 on subsequent fetch
        r = requests.get(f"{API}/api/inspirations/references/collections/{cid}",
                         headers=auth(token), timeout=20)
        assert r.status_code == 404


# ── 2. Saved References CRUD ──────────────────────────────────────────
class TestSavedReferencesCRUD:
    def test_save_into_collection(self, token, some_product_id):
        r1 = requests.post(f"{API}/api/inspirations/references/collections",
                           headers=auth(token), timeout=20,
                           json={"title": f"Save {uuid.uuid4().hex[:6]}"})
        cid = r1.json()["item"]["id"]
        try:
            r = requests.post(f"{API}/api/inspirations/references/save",
                              headers=auth(token), timeout=20,
                              json={"visual_asset_id": some_product_id,
                                    "curated_collection_id": cid,
                                    "note": "primo riferimento",
                                    "tags": ["hero"]})
            assert r.status_code == 201, r.text
            assert r.json()["created"] is True
            sid = r.json()["item"]["id"]
            # Collection detail should include this item
            r2 = requests.get(f"{API}/api/inspirations/references/collections/{cid}",
                              headers=auth(token), timeout=20)
            assert r2.status_code == 200
            assert r2.json()["items_count"] == 1
            assert len(r2.json()["items"]) == 1
            assert r2.json()["items"][0]["saved_reference_id"] == sid
        finally:
            requests.delete(f"{API}/api/inspirations/references/collections/{cid}",
                            headers=auth(token), timeout=20)

    def test_save_idempotent(self, token, some_product_id):
        r1 = requests.post(f"{API}/api/inspirations/references/collections",
                           headers=auth(token), timeout=20,
                           json={"title": f"Idem {uuid.uuid4().hex[:6]}"})
        cid = r1.json()["item"]["id"]
        try:
            requests.post(f"{API}/api/inspirations/references/save",
                          headers=auth(token), timeout=20,
                          json={"visual_asset_id": some_product_id,
                                "curated_collection_id": cid})
            r = requests.post(f"{API}/api/inspirations/references/save",
                              headers=auth(token), timeout=20,
                              json={"visual_asset_id": some_product_id,
                                    "curated_collection_id": cid})
            assert r.status_code == 201
            assert r.json()["created"] is False
        finally:
            requests.delete(f"{API}/api/inspirations/references/collections/{cid}",
                            headers=auth(token), timeout=20)

    def test_save_into_scratchpad(self, token, some_product_id):
        """Save without collection (curated_collection_id=null)."""
        r = requests.post(f"{API}/api/inspirations/references/save",
                          headers=auth(token), timeout=20,
                          json={"visual_asset_id": some_product_id})
        assert r.status_code == 201
        sid = r.json()["item"]["id"]
        # cleanup
        requests.delete(f"{API}/api/inspirations/references/{sid}",
                        headers=auth(token), timeout=20)

    def test_by_asset_returns_instances(self, token, some_product_id):
        r1 = requests.post(f"{API}/api/inspirations/references/collections",
                           headers=auth(token), timeout=20,
                           json={"title": f"ByA {uuid.uuid4().hex[:6]}"})
        cid = r1.json()["item"]["id"]
        try:
            requests.post(f"{API}/api/inspirations/references/save",
                          headers=auth(token), timeout=20,
                          json={"visual_asset_id": some_product_id,
                                "curated_collection_id": cid})
            r = requests.get(f"{API}/api/inspirations/references/by-asset/{some_product_id}",
                             headers=auth(token), timeout=20)
            assert r.status_code == 200
            data = r.json()
            assert data["saved"] is True
            assert len(data["instances"]) >= 1
        finally:
            requests.delete(f"{API}/api/inspirations/references/collections/{cid}",
                            headers=auth(token), timeout=20)

    def test_save_invalid_asset_404(self, token):
        r = requests.post(f"{API}/api/inspirations/references/save",
                          headers=auth(token), timeout=20,
                          json={"visual_asset_id": str(uuid.uuid4())})
        assert r.status_code == 404


# ── 3. Related Assets endpoint ────────────────────────────────────────
class TestRelatedEndpoint:
    def test_related_shape(self, token, some_product_id):
        r = requests.get(f"{API}/api/inspirations/registry/products/{some_product_id}/related?limit=8",
                         headers=auth(token), timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "seed" in d
        assert "items" in d
        assert isinstance(d["items"], list)
        for it in d["items"]:
            assert "match_score" in it
            assert "match_reasons" in it
            assert it["id"] != some_product_id  # excluded self

    def test_related_404_missing_product(self, token):
        r = requests.get(f"{API}/api/inspirations/registry/products/{uuid.uuid4()}/related",
                         headers=auth(token), timeout=20)
        assert r.status_code == 404


# ── 4. Naming compliance (Curated References™ — not Favorites/Saved) ─
class TestNamingCompliance:
    def test_router_uses_curated_terminology(self):
        from pathlib import Path
        src = (Path(__file__).resolve().parent.parent / "routers" / "curated_references.py").read_text()
        low = src.lower()
        # Required Italian markers in error messages
        assert "collezione" in low, "Italian 'collezione' must appear"
        assert "asset visuale" in low, "Italian 'asset visuale' must appear"
        # Verify NO routes are named /favorites or /bookmarks
        assert '/favorites' not in low
        assert '/bookmarks' not in low
