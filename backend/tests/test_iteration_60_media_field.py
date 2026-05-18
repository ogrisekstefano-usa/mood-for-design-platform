"""
Iteration 60 — Backend test suite for P0 Global Media Input Refactor +
Pinterest Research Add Flow. Verifies endpoint contracts used by the new
EditorialMediaField + AddReferenceModal frontend components.

Covered endpoints:
  - POST /api/auth/login              (auth bootstrap)
  - POST /api/storage/signed-upload   (Supabase signed upload contract)
  - GET  /api/media/stats             (library aggregates)
  - GET  /api/media                   (library list)
  - GET  /api/references              (curated references list)
  - GET  /api/reference-collections   (curated collections)
  - POST /api/references              (Pinterest Research ingestion contract)
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://content-hub-pro-22.preview.emergentagent.com").rstrip("/")
EMAIL = "demo@moodfordesign.com"
PASSWORD = "Blueprint2024!"


# ---- Fixtures ------------------------------------------------------------
@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": EMAIL, "password": PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    token = data.get("session", {}).get("access_token") or data.get("access_token")
    assert token, f"No access_token in login response: {data}"
    return token


@pytest.fixture(scope="module")
def client(auth_token):
    s = requests.Session()
    s.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json",
    })
    return s


# ---- Storage signed-upload ----------------------------------------------
class TestStorageSignedUpload:
    def test_signed_upload_returns_signed_url_token_path(self, client):
        r = client.post(
            f"{BASE_URL}/api/storage/signed-upload",
            json={
                "bucket": "tenant-assets",
                "path": "brand/logo/test.png",
                "file_size": 1024,
                "content_type": "image/png",
            },
            timeout=15,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        data = r.json()
        # Contract: must return signed_url + token + path
        assert "signed_url" in data and data["signed_url"].startswith("https://")
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
        assert "path" in data and "brand/logo/test.png" in data["path"]
        # Tenant scoping: path should be prefixed by tenant uuid
        assert data["path"] != "brand/logo/test.png", "Path should be tenant-prefixed"
        assert data.get("bucket") == "tenant-assets"


# ---- Media Library -------------------------------------------------------
class TestMediaLibrary:
    def test_stats_shape(self, client):
        r = client.get(f"{BASE_URL}/api/media/stats", timeout=15)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        for k in ("total", "by_kind", "total_bytes", "unused", "categories", "tags"):
            assert k in d, f"missing key {k} in stats"
        assert isinstance(d["total"], int)
        assert isinstance(d["by_kind"], dict)
        for sub in ("image", "video", "pdf", "other"):
            assert sub in d["by_kind"]

    def test_media_list_returns_data_array(self, client):
        r = client.get(f"{BASE_URL}/api/media", timeout=15)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert "data" in d and isinstance(d["data"], list)
        if d["data"]:
            item = d["data"][0]
            for k in ("id", "tenant_id", "file_url"):
                assert k in item


# ---- References ----------------------------------------------------------
class TestReferences:
    def test_get_references_list(self, client):
        r = client.get(f"{BASE_URL}/api/references", timeout=15)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert "references" in d and isinstance(d["references"], list)
        # Demo tenant is pre-seeded with curated references
        assert len(d["references"]) > 0, "Demo tenant should have seeded references"
        ref0 = d["references"][0]
        for k in ("id", "source_type", "imported_image_url", "editorial_status"):
            assert k in ref0

    def test_get_reference_collections(self, client):
        r = client.get(f"{BASE_URL}/api/reference-collections", timeout=15)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert "collections" in d and isinstance(d["collections"], list)

    def test_post_reference_pinterest_url_creates(self, client):
        body = {
            "source_type": "pinterest",
            "source_url": "https://pinterest.com/pin/TEST_iter60",
            "imported_image_url": "https://pinterest.com/pin/TEST_iter60",
            "curator_name": "TEST_Curator_iter60",
            "design_intent": "Test design intent",
            "advisor_notes": "TEST_NOTE_iter60\n\nTags: mood",
            "project_id": None,
        }
        r = client.post(f"{BASE_URL}/api/references", json=body, timeout=20)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text[:300]}"
        d = r.json()
        ref = d.get("reference") or d
        assert ref.get("source_type") == "pinterest"
        assert ref.get("curator_name") == "TEST_Curator_iter60"
        new_id = ref.get("id")
        assert new_id, "must return an id"

        # Verify it shows up in the list (persistence)
        r2 = client.get(f"{BASE_URL}/api/references", timeout=15)
        assert r2.status_code == 200
        ids = {x["id"] for x in r2.json().get("references", [])}
        assert new_id in ids, "newly-created reference must be returned by GET /api/references"

    def test_post_reference_missing_image_url_returns_422(self, client):
        body = {
            "source_type": "pinterest",
            "source_url": "https://pinterest.com/pin/TEST_iter60_bad",
            # imported_image_url intentionally missing
        }
        r = client.post(f"{BASE_URL}/api/references", json=body, timeout=15)
        assert r.status_code == 422, f"Expected validation error, got {r.status_code}"
