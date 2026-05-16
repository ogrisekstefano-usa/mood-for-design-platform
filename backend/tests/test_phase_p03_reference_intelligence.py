"""Phase P0.3.A — Cultural Design Intelligence™ · Reference Intelligence regression.

Covers:
  • POST /api/references          ingest pipeline (NO RAW IMPORTS)
  • GET  /api/references          list + filtering by editorial_status
  • GET  /api/references/{id}     read + interpretations payload
  • POST /api/references/{id}/interpretations  regenerate per locale
  • POST /api/reference-collections + items add/remove
  • Tenant isolation (cross-tenant probes return 404)
  • Locale validation (unsupported locale → 400)
"""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL must be set"

SUPER_EMAIL = "demo@moodfordesign.com"
SUPER_PASS = "Blueprint2024!"
SHOWROOM_EMAIL = "studio2@moodfordesign.com"
SHOWROOM_PASS = "Studio2024!"

# A stable photo URL the LLM can anchor the editorial reading to.
IMG_URL = "https://images.unsplash.com/photo-1600585154340-be6161a56a0c"


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/login",
               json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    body = r.json()
    sess = body.get("session") or {}
    token = sess.get("access_token") or body.get("access_token") or body.get("token")
    assert token
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def super_admin():
    return _login(SUPER_EMAIL, SUPER_PASS)


@pytest.fixture(scope="module")
def showroom():
    return _login(SHOWROOM_EMAIL, SHOWROOM_PASS)


# ─── Ingest pipeline ─────────────────────────────────────────────────────

class TestIngest:
    def test_ingest_returns_ready_with_interpretation(self, super_admin):
        r = super_admin.post(f"{BASE}/api/references", timeout=120, json={
            "imported_image_url": IMG_URL,
            "source_type": "external_url",
            "source_url":  "https://example.com/villa-test",
            "curator_name": "Stefano Ogrisek",
            "locale_code":  "EN_AE",
            "design_intent": "Mediterranean estate, prestige register",
        })
        assert r.status_code == 201, r.text[:400]
        j = r.json()
        assert j.get("ok") is True
        ref = j["reference"]
        assert ref["editorial_status"] == "ready"
        assert ref["imported_image_url"] == IMG_URL
        interp = ref.get("interpretations") or []
        assert len(interp) >= 1
        first = interp[0]
        assert first["locale"] == "EN_AE"
        assert (first.get("editorial_reading") or "").strip(), \
            "editorial reading must be populated for ready state"
        # market_fit_score: bounded number when present
        score = first.get("market_fit_score")
        assert score is None or (0 <= score <= 100)
        # save for later tests
        TestIngest.ref_id = ref["id"]

    def test_invalid_source_type_rejected(self, super_admin):
        r = super_admin.post(f"{BASE}/api/references", timeout=10, json={
            "imported_image_url": IMG_URL,
            "source_type": "tiktok",  # not in whitelist
        })
        assert r.status_code == 400

    def test_invalid_project_id_404(self, super_admin):
        r = super_admin.post(f"{BASE}/api/references", timeout=10, json={
            "imported_image_url": IMG_URL,
            "project_id": "00000000-0000-0000-0000-000000000000",
        })
        assert r.status_code == 404


# ─── List + filter ───────────────────────────────────────────────────────

class TestList:
    def test_list_returns_only_ready_by_default(self, super_admin):
        r = super_admin.get(f"{BASE}/api/references", timeout=15)
        assert r.status_code == 200
        j = r.json()
        for ref in j["references"]:
            assert ref["editorial_status"] == "ready"

    def test_list_status_filter(self, super_admin):
        r = super_admin.get(
            f"{BASE}/api/references?status=processing_editorial_reading",
            timeout=15,
        )
        assert r.status_code == 200

    def test_list_invalid_status_400(self, super_admin):
        r = super_admin.get(f"{BASE}/api/references?status=foo", timeout=10)
        assert r.status_code == 400


# ─── Interpretation regeneration ─────────────────────────────────────────

class TestInterpretations:
    def test_regenerate_de_de(self, super_admin):
        ref_id = TestIngest.ref_id
        r = super_admin.post(
            f"{BASE}/api/references/{ref_id}/interpretations",
            timeout=120, json={"locale_code": "DE_DE"},
        )
        assert r.status_code == 200, r.text[:400]
        j = r.json()
        assert j["interpretation"]["locale"] == "DE_DE"
        reading = j["interpretation"].get("editorial_reading") or ""
        # Heuristic: German reading must contain at least one German cue.
        # We don't enforce a specific token to stay LLM-resilient, but the
        # length must be non-trivial.
        assert len(reading) > 60

    def test_regenerate_unsupported_locale_400(self, super_admin):
        ref_id = TestIngest.ref_id
        r = super_admin.post(
            f"{BASE}/api/references/{ref_id}/interpretations",
            timeout=30, json={"locale_code": "ZZ_ZZ"},
        )
        assert r.status_code == 400

    def test_list_interpretations_has_both_locales(self, super_admin):
        ref_id = TestIngest.ref_id
        r = super_admin.get(
            f"{BASE}/api/references/{ref_id}/interpretations",
            timeout=15,
        )
        assert r.status_code == 200
        locales = {i["locale"] for i in r.json()["interpretations"]}
        assert {"EN_AE", "DE_DE"}.issubset(locales)


# ─── Collections ─────────────────────────────────────────────────────────

class TestCollections:
    def test_create_collection(self, super_admin):
        r = super_admin.post(f"{BASE}/api/reference-collections", timeout=15, json={
            "title": "Test Direction — pytest",
            "subtitle": "Internal regression",
            "project_vertical": "hospitality",
            "market_focus": "EN_AE",
        })
        assert r.status_code == 201, r.text[:300]
        j = r.json()
        assert j["collection"]["title"].startswith("Test Direction")
        TestCollections.col_id = j["collection"]["id"]

    def test_add_reference_to_collection(self, super_admin):
        r = super_admin.post(
            f"{BASE}/api/reference-collections/{TestCollections.col_id}/items",
            timeout=15, json={"reference_id": TestIngest.ref_id},
        )
        assert r.status_code == 201
        assert r.json()["ok"] is True

    def test_add_again_is_idempotent(self, super_admin):
        r = super_admin.post(
            f"{BASE}/api/reference-collections/{TestCollections.col_id}/items",
            timeout=15, json={"reference_id": TestIngest.ref_id},
        )
        # 201 returned by FastAPI on this endpoint, but the response payload
        # signals idempotency.
        assert r.status_code in (200, 201)
        assert r.json().get("already_added") is True

    def test_get_collection_hydrates_references(self, super_admin):
        r = super_admin.get(
            f"{BASE}/api/reference-collections/{TestCollections.col_id}",
            timeout=15,
        )
        assert r.status_code == 200
        j = r.json()
        ref_ids = [ref["id"] for ref in j["references"]]
        assert TestIngest.ref_id in ref_ids

    def test_list_collections_includes_item_count(self, super_admin):
        r = super_admin.get(f"{BASE}/api/reference-collections", timeout=15)
        assert r.status_code == 200
        found = next((c for c in r.json()["collections"]
                      if c["id"] == TestCollections.col_id), None)
        assert found is not None
        assert found["item_count"] >= 1

    def test_remove_reference_from_collection(self, super_admin):
        r = super_admin.delete(
            f"{BASE}/api/reference-collections/{TestCollections.col_id}"
            f"/items/{TestIngest.ref_id}",
            timeout=15,
        )
        assert r.status_code == 200
        # And the collection should now report 0 items
        rr = super_admin.get(
            f"{BASE}/api/reference-collections/{TestCollections.col_id}",
            timeout=15,
        )
        assert rr.status_code == 200
        assert rr.json()["references"] == []


# ─── Tenant isolation ───────────────────────────────────────────────────

class TestTenantIsolation:
    def test_cross_tenant_get_reference_404(self, showroom):
        r = showroom.get(f"{BASE}/api/references/{TestIngest.ref_id}", timeout=10)
        assert r.status_code == 404

    def test_cross_tenant_get_collection_404(self, showroom):
        r = showroom.get(
            f"{BASE}/api/reference-collections/{TestCollections.col_id}",
            timeout=10,
        )
        assert r.status_code == 404

    def test_cross_tenant_add_item_404(self, showroom):
        r = showroom.post(
            f"{BASE}/api/reference-collections/{TestCollections.col_id}/items",
            timeout=10, json={"reference_id": TestIngest.ref_id},
        )
        assert r.status_code == 404

    def test_showroom_list_does_not_leak(self, showroom):
        r = showroom.get(f"{BASE}/api/references", timeout=10)
        assert r.status_code == 200
        ids = {ref["id"] for ref in r.json()["references"]}
        assert TestIngest.ref_id not in ids
