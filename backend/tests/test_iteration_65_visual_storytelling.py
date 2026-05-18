"""
Iteration 65 — MOOD for DESIGN Visual Storytelling Sprint
Backend regression tests:
  • portfolio master PATCH accepts new gallery items (with id + hotspots[])
    and story_body blocks (paragraph, pull_quote, image, gallery,
    hotspot_image, cta) — verifies persistence via GET roundtrip.
  • editorial variant PATCH accepts body_blocks (new flat block schema with
    embedded hotspots[]) — verifies persistence via GET roundtrip.
  • magazine REMOTE hotspot endpoint regression
    (POST /api/magazine/admin/articles/{aid}/hotspots).
"""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
EMAIL = "demo@moodfordesign.com"
PASSWORD = "Blueprint2024!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": EMAIL, "password": PASSWORD},
                      timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    sess = data.get("session") or {}
    tok = sess.get("access_token") or data.get("access_token") or data.get("token")
    assert tok, f"No token in login response: {data}"
    return tok


@pytest.fixture(scope="module")
def session(token):
    s = requests.Session()
    s.headers.update({
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    })
    return s


@pytest.fixture(scope="module")
def villa_project_id(session):
    """Locate Villa Travertino (or any existing project) for testing."""
    r = session.get(f"{BASE_URL}/api/portfolio/admin/projects", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    items = data if isinstance(data, list) else (data.get("projects") or data.get("items") or [])
    assert items, "No projects available on demo tenant"
    # Prefer Villa Travertino
    for p in items:
        title = (p.get("title") or "").lower()
        if "villa" in title and "travertino" in title:
            return p.get("id") or p.get("_id")
    return items[0].get("id") or items[0].get("_id")


# ─── Portfolio: master GET shape ────────────────────────────────────
class TestPortfolioMasterShape:
    def test_get_master_returns_gallery_and_story_body(self, session, villa_project_id):
        r = session.get(f"{BASE_URL}/api/portfolio/admin/projects/{villa_project_id}", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        master = data.get("master") or data
        assert "gallery" in master, f"Expected 'gallery' field. Keys: {list(master.keys())}"
        assert "story_body" in master, f"Expected 'story_body' field. Keys: {list(master.keys())}"
        assert isinstance(master.get("gallery") or [], list)
        assert isinstance(master.get("story_body") or [], list)


# ─── Portfolio: master PATCH new shapes ─────────────────────────────
class TestPortfolioMasterPatchNewShapes:
    def test_patch_master_with_new_gallery_items(self, session, villa_project_id):
        # GET current state to preserve other fields
        r0 = session.get(f"{BASE_URL}/api/portfolio/admin/projects/{villa_project_id}", timeout=20)
        assert r0.status_code == 200
        master0 = (r0.json().get("master") or r0.json())
        original_gallery = master0.get("gallery") or []
        original_story = master0.get("story_body") or []

        new_gallery_item = {
            "id": f"TEST_gal_{uuid.uuid4().hex[:8]}",
            "url": "https://example.com/test.jpg",
            "asset_id": None,
            "caption": "TEST_caption",
            "alt_text": "TEST_alt",
            "hotspots": [{
                "id": f"TEST_hs_{uuid.uuid4().hex[:6]}",
                "x_pct": 35.0, "y_pct": 50.0,
                "kind": "detail_point",
                "title": "TEST detail",
                "description": "TEST description",
            }],
        }
        patched_gallery = original_gallery + [new_gallery_item]

        patch = {"gallery": patched_gallery}
        r = session.patch(f"{BASE_URL}/api/portfolio/admin/projects/{villa_project_id}",
                          json=patch, timeout=20)
        assert r.status_code == 200, f"PATCH failed: {r.status_code} {r.text}"

        # Verify persistence via GET
        r2 = session.get(f"{BASE_URL}/api/portfolio/admin/projects/{villa_project_id}", timeout=20)
        assert r2.status_code == 200
        master2 = (r2.json().get("master") or r2.json())
        gallery2 = master2.get("gallery") or []
        test_items = [g for g in gallery2 if g.get("id", "").startswith("TEST_gal_")]
        assert test_items, f"New gallery item not persisted. Gallery: {gallery2}"
        # Verify hotspots embedded
        assert test_items[-1].get("hotspots"), "Embedded hotspots not persisted"
        assert test_items[-1]["hotspots"][0]["title"] == "TEST detail"

        # Cleanup: restore original gallery
        session.patch(f"{BASE_URL}/api/portfolio/admin/projects/{villa_project_id}",
                      json={"gallery": original_gallery}, timeout=20)

    def test_patch_master_with_block_based_story_body(self, session, villa_project_id):
        r0 = session.get(f"{BASE_URL}/api/portfolio/admin/projects/{villa_project_id}", timeout=20)
        master0 = (r0.json().get("master") or r0.json())
        original_story = master0.get("story_body") or []

        story_blocks = [
            {"id": "blk_test_p1", "type": "paragraph", "text": "TEST paragraph body"},
            {"id": "blk_test_q1", "type": "pull_quote", "text": "TEST quote", "attribution": "TEST author"},
            {"id": "blk_test_i1", "type": "image", "url": "https://example.com/i.jpg",
             "asset_id": None, "caption": "TEST img cap", "alt_text": "TEST alt"},
            {"id": "blk_test_g1", "type": "gallery", "items": [
                {"id": "mg_1", "url": "https://example.com/g1.jpg", "caption": "TEST g1"}]},
            {"id": "blk_test_h1", "type": "hotspot_image",
             "url": "https://example.com/h.jpg", "caption": "TEST hot",
             "hotspots": [{"id": "h_1", "x_pct": 10, "y_pct": 20,
                           "kind": "material_note", "title": "TEST mat"}]},
            {"id": "blk_test_c1", "type": "cta", "label": "TEST cta",
             "action": "save_reference", "tier": "soft"},
        ]
        r = session.patch(f"{BASE_URL}/api/portfolio/admin/projects/{villa_project_id}",
                          json={"story_body": story_blocks}, timeout=20)
        assert r.status_code == 200, f"PATCH story_body failed: {r.text}"

        # Verify persistence
        r2 = session.get(f"{BASE_URL}/api/portfolio/admin/projects/{villa_project_id}", timeout=20)
        master2 = (r2.json().get("master") or r2.json())
        body2 = master2.get("story_body") or []
        types = [b.get("type") for b in body2]
        for t in ["paragraph", "pull_quote", "image", "gallery", "hotspot_image", "cta"]:
            assert t in types, f"Block type {t} not persisted. Got: {types}"
        # Verify hotspot embedded
        hi = next((b for b in body2 if b.get("type") == "hotspot_image"), None)
        assert hi and hi.get("hotspots"), "Embedded hotspots in story_body not persisted"

        # Cleanup
        session.patch(f"{BASE_URL}/api/portfolio/admin/projects/{villa_project_id}",
                      json={"story_body": original_story}, timeout=20)


# ─── Editorial variant body_blocks ──────────────────────────────────
class TestEditorialVariantBodyBlocks:
    def test_patch_variant_with_block_based_body(self, session):
        # Find an article master + variant
        r = session.get(f"{BASE_URL}/api/editorial/admin/masters", timeout=20)
        if r.status_code != 200:
            pytest.skip(f"Editorial masters not accessible: {r.status_code}")
        data = r.json()
        masters = data if isinstance(data, list) else (data.get("masters") or data.get("items") or [])
        if not masters:
            pytest.skip("No editorial masters on demo tenant")
        master_id = masters[0].get("id") or masters[0].get("_id")

        r2 = session.get(f"{BASE_URL}/api/editorial/admin/masters/{master_id}", timeout=20)
        assert r2.status_code == 200, r2.text
        det = r2.json()
        variants = det.get("variants") or []
        if not variants:
            pytest.skip("No variants on first master")
        vid = variants[0].get("id") or variants[0].get("_id")

        body_blocks = [
            {"id": "blk_ed_p1", "type": "paragraph", "text": "TEST editorial paragraph"},
            {"id": "blk_ed_h1", "type": "hotspot_image",
             "url": "https://example.com/ed.jpg", "caption": "TEST ed hot",
             "hotspots": [{"id": "h_ed_1", "x_pct": 40, "y_pct": 30,
                           "kind": "detail_point", "title": "TEST ed dp"}]},
        ]
        r3 = session.patch(f"{BASE_URL}/api/editorial/variants/{vid}",
                           json={"body_blocks": body_blocks}, timeout=20)
        assert r3.status_code == 200, f"PATCH variant failed: {r3.status_code} {r3.text}"

        # Verify persistence
        r4 = session.get(f"{BASE_URL}/api/editorial/variants/{vid}", timeout=20)
        assert r4.status_code == 200, r4.text
        v = r4.json()
        bb = v.get("body_blocks") or []
        types = [b.get("type") for b in bb]
        assert "paragraph" in types and "hotspot_image" in types, f"Types: {types}"
        hi = next((b for b in bb if b.get("type") == "hotspot_image"), None)
        assert hi.get("hotspots"), "Editorial body_blocks hotspots embedding lost"


# ─── Magazine REMOTE hotspot endpoint regression ────────────────────
class TestMagazineRemoteHotspotEndpoint:
    def test_magazine_hotspot_endpoint_exists(self, session):
        r = session.get(f"{BASE_URL}/api/magazine/admin/articles", timeout=20)
        if r.status_code != 200:
            pytest.skip(f"Magazine articles not accessible: {r.status_code}")
        data = r.json()
        items = data if isinstance(data, list) else (data.get("articles") or data.get("items") or [])
        if not items:
            pytest.skip("No magazine articles on demo tenant")
        aid = items[0].get("id") or items[0].get("_id")

        # Without block_id should 422 (validation) — confirms endpoint exists
        r2 = session.post(f"{BASE_URL}/api/magazine/admin/articles/{aid}/hotspots",
                          json={"x_pct": 10, "y_pct": 20, "title": "TEST"}, timeout=20)
        # Accept 422 (validation) or 200/201 (success) — but NOT 404/405
        assert r2.status_code not in (404, 405), \
            f"Magazine hotspot endpoint missing: {r2.status_code} {r2.text}"
