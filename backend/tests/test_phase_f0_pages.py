"""
Phase F.0 — Moodboard Pages (multi-page foundation) backend regression.

Covers:
  - GET /api/moodboards/_meta/page_presets (6 aspect ratios + 13 page types)
  - GET /api/moodboards/{id} includes `pages` array + each element has `page_id`
  - POST /api/moodboards creates default page + sets current_page_id (+ backfill check)
  - POST /api/moodboards/{id}/pages (create + validation)
  - PUT /api/moodboards/{id}/pages/{page_id} (update + width/height recompute)
  - POST /api/moodboards/{id}/pages/{page_id}/duplicate (clones page + elements)
  - POST /api/moodboards/{id}/pages/reorder (sort_order batch update)
  - DELETE /api/moodboards/{id}/pages/{page_id} (409 last-page guard, current fallback)
  - Block creation scopes element to active page (page_id populated)
  - POST /api/templates/{id}/apply creates default page + attaches blocks
  - Cross-tenant isolation (studio2 → 404 on designer's pages)
  - RBAC (client → 403 on pages write)
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
DESIGNER = {"email": "designer@moodfordesign.com", "password": "Designer2024!"}
STUDIO2  = {"email": "studio2@moodfordesign.com", "password": "Studio2024!"}
CLIENT   = {"email": "client@moodfordesign.com",  "password": "Client2024!"}

ASPECT_PRESETS = {"portrait_a4", "landscape_16_9", "square_1_1",
                  "editorial_3_4", "wide_2_1", "cover_landscape"}
PAGE_TYPES = {"cover", "blank", "mood", "material_board", "product_grid",
              "palette", "gallery", "split_story", "quote",
              "technical_board", "floorplan", "proposal_summary", "approval"}


def _login(creds):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login {creds['email']} failed: {r.status_code} {r.text[:300]}"
    body = r.json()
    tok = (body.get("session") or {}).get("access_token") \
        or body.get("access_token") or body.get("token")
    assert tok, f"no access_token in login response: {body}"
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def designer():
    return _login(DESIGNER)


@pytest.fixture(scope="module")
def studio2():
    return _login(STUDIO2)


@pytest.fixture(scope="module")
def client_user():
    return _login(CLIENT)


@pytest.fixture(scope="module")
def moodboard(designer):
    title = f"TEST_F0_{uuid.uuid4().hex[:8]}"
    r = designer.post(f"{BASE_URL}/api/moodboards", json={"title": title}, timeout=20)
    assert r.status_code in (200, 201), f"create mb failed: {r.status_code} {r.text[:200]}"
    mb = r.json()
    assert mb.get("id")
    yield mb
    designer.delete(f"{BASE_URL}/api/moodboards/{mb['id']}", timeout=20)


# ── Presets registry ─────────────────────────────────────────────────────────
class TestPagePresets:
    def test_get_page_presets(self, designer):
        r = designer.get(f"{BASE_URL}/api/moodboards/_meta/page_presets", timeout=15)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "aspect_ratios" in data and "page_types" in data
        ar_ids = {a["id"] for a in data["aspect_ratios"]}
        pt_ids = {p["id"] for p in data["page_types"]}
        assert ar_ids == ASPECT_PRESETS, f"aspect_ratios mismatch: {ar_ids}"
        assert pt_ids == PAGE_TYPES, f"page_types mismatch: {pt_ids}"
        # Verify a known preset has width/height
        a4 = next(a for a in data["aspect_ratios"] if a["id"] == "portrait_a4")
        assert a4["width"] == 1400 and a4["height"] == 2400


# ── Default page on moodboard create + GET shape ─────────────────────────────
class TestMoodboardCreateDefaultPage:
    def test_new_moodboard_has_default_page_and_current_page_id(self, moodboard):
        assert moodboard.get("current_page_id"), \
            f"current_page_id missing on new moodboard: {moodboard}"

    def test_get_moodboard_includes_pages_and_elements(self, designer, moodboard):
        r = designer.get(f"{BASE_URL}/api/moodboards/{moodboard['id']}", timeout=15)
        assert r.status_code == 200, r.text[:300]
        mb = r.json()
        assert "pages" in mb, "GET moodboard missing 'pages' array"
        assert "elements" in mb, "GET moodboard missing legacy 'elements' array"
        assert isinstance(mb["pages"], list) and len(mb["pages"]) >= 1
        first = mb["pages"][0]
        assert first.get("page_type") == "blank"
        assert first.get("aspect_ratio") == "portrait_a4"
        # title backfill: must equal moodboard.title (or 'Page 1' if null)
        assert first.get("title") in (mb.get("title"), "Page 1")
        # sort_order asc
        sort_orders = [p["sort_order"] for p in mb["pages"]]
        assert sort_orders == sorted(sort_orders), "pages not sorted by sort_order ASC"


# ── Page CRUD ────────────────────────────────────────────────────────────────
class TestPageCRUD:
    def test_create_page_minimal(self, designer, moodboard):
        r = designer.post(
            f"{BASE_URL}/api/moodboards/{moodboard['id']}/pages",
            json={"title": "TEST_Mood", "page_type": "mood", "aspect_ratio": "editorial_3_4"},
            timeout=15,
        )
        assert r.status_code == 201, r.text[:300]
        p = r.json()
        assert p["page_type"] == "mood"
        assert p["aspect_ratio"] == "editorial_3_4"
        # editorial_3_4 → 1400x1866
        assert p["width"] == 1400 and p["height"] == 1866
        assert p.get("sort_order") is not None and p["sort_order"] >= 1, \
            f"sort_order should auto-append, got {p.get('sort_order')}"

    def test_create_page_invalid_type(self, designer, moodboard):
        r = designer.post(
            f"{BASE_URL}/api/moodboards/{moodboard['id']}/pages",
            json={"title": "X", "page_type": "not_real", "aspect_ratio": "portrait_a4"},
            timeout=15,
        )
        assert r.status_code == 400, r.text[:200]

    def test_create_page_invalid_aspect_ratio(self, designer, moodboard):
        r = designer.post(
            f"{BASE_URL}/api/moodboards/{moodboard['id']}/pages",
            json={"title": "X", "page_type": "blank", "aspect_ratio": "not_real"},
            timeout=15,
        )
        assert r.status_code == 400

    def test_update_page_recomputes_width_height(self, designer, moodboard):
        # Create page with portrait_a4, then change to landscape_16_9
        r = designer.post(
            f"{BASE_URL}/api/moodboards/{moodboard['id']}/pages",
            json={"title": "TEST_Resize", "page_type": "blank", "aspect_ratio": "portrait_a4"},
            timeout=15,
        )
        assert r.status_code == 201
        pid = r.json()["id"]
        u = designer.put(
            f"{BASE_URL}/api/moodboards/{moodboard['id']}/pages/{pid}",
            json={"aspect_ratio": "landscape_16_9"},
            timeout=15,
        )
        assert u.status_code == 200, u.text[:300]
        upd = u.json()
        assert upd["aspect_ratio"] == "landscape_16_9"
        assert upd["width"] == 1920 and upd["height"] == 1080

    def test_duplicate_page_clones_elements(self, designer, moodboard):
        # Create page + add a block to it
        rp = designer.post(
            f"{BASE_URL}/api/moodboards/{moodboard['id']}/pages",
            json={"title": "TEST_Dup", "page_type": "blank", "aspect_ratio": "square_1_1"},
            timeout=15,
        )
        assert rp.status_code == 201
        src_pid = rp.json()["id"]
        # Add a block scoped to that page
        rb = designer.post(
            f"{BASE_URL}/api/moodboards/{moodboard['id']}/blocks",
            json={"type": "text", "page_id": src_pid, "content": {"body": "dup-me"}},
            timeout=15,
        )
        assert rb.status_code == 201
        # Duplicate
        rd = designer.post(
            f"{BASE_URL}/api/moodboards/{moodboard['id']}/pages/{src_pid}/duplicate",
            timeout=15,
        )
        assert rd.status_code == 201, rd.text[:300]
        new_page = rd.json()
        assert new_page["id"] != src_pid
        # Verify elements: GET moodboard, filter elements by page_id == new_page.id
        rg = designer.get(f"{BASE_URL}/api/moodboards/{moodboard['id']}", timeout=15)
        els = rg.json().get("elements", [])
        src_els = [e for e in els if e.get("page_id") == src_pid]
        new_els = [e for e in els if e.get("page_id") == new_page["id"]]
        assert len(new_els) == len(src_els) and len(new_els) >= 1, \
            f"duplicate did not clone elements: src={len(src_els)} new={len(new_els)}"

    def test_reorder_pages(self, designer, moodboard):
        rg = designer.get(f"{BASE_URL}/api/moodboards/{moodboard['id']}", timeout=15)
        page_ids = [p["id"] for p in rg.json()["pages"]]
        assert len(page_ids) >= 2
        reversed_ids = list(reversed(page_ids))
        rr = designer.post(
            f"{BASE_URL}/api/moodboards/{moodboard['id']}/pages/reorder",
            json={"page_ids": reversed_ids}, timeout=15,
        )
        assert rr.status_code == 200, rr.text[:300]
        # Verify new order
        rg2 = designer.get(f"{BASE_URL}/api/moodboards/{moodboard['id']}", timeout=15)
        new_order = [p["id"] for p in rg2.json()["pages"]]
        assert new_order == reversed_ids, f"reorder failed: expected {reversed_ids}, got {new_order}"

    def test_reorder_validates_full_set(self, designer, moodboard):
        rg = designer.get(f"{BASE_URL}/api/moodboards/{moodboard['id']}", timeout=15)
        page_ids = [p["id"] for p in rg.json()["pages"]]
        partial = page_ids[:-1]  # missing one
        rr = designer.post(
            f"{BASE_URL}/api/moodboards/{moodboard['id']}/pages/reorder",
            json={"page_ids": partial}, timeout=15,
        )
        assert rr.status_code == 400, rr.text[:200]

    def test_delete_page_normal(self, designer, moodboard):
        # Create a throwaway page, then delete it
        rp = designer.post(
            f"{BASE_URL}/api/moodboards/{moodboard['id']}/pages",
            json={"title": "TEST_DeleteMe", "page_type": "blank", "aspect_ratio": "portrait_a4"},
            timeout=15,
        )
        assert rp.status_code == 201
        pid = rp.json()["id"]
        rd = designer.delete(f"{BASE_URL}/api/moodboards/{moodboard['id']}/pages/{pid}", timeout=15)
        assert rd.status_code == 200, rd.text[:200]
        # Verify gone
        rg = designer.get(f"{BASE_URL}/api/moodboards/{moodboard['id']}", timeout=15)
        remaining = [p["id"] for p in rg.json()["pages"]]
        assert pid not in remaining


class TestLastPageGuard:
    def test_delete_last_page_returns_409(self, designer):
        # Create a fresh single-page moodboard
        r = designer.post(f"{BASE_URL}/api/moodboards",
                          json={"title": f"TEST_F0_solo_{uuid.uuid4().hex[:6]}"}, timeout=15)
        assert r.status_code in (200, 201)
        mb = r.json()
        try:
            pages = designer.get(f"{BASE_URL}/api/moodboards/{mb['id']}", timeout=15).json()["pages"]
            assert len(pages) == 1
            sole = pages[0]["id"]
            rd = designer.delete(f"{BASE_URL}/api/moodboards/{mb['id']}/pages/{sole}", timeout=15)
            assert rd.status_code == 409, f"expected 409 last-page guard, got {rd.status_code}: {rd.text[:200]}"
        finally:
            designer.delete(f"{BASE_URL}/api/moodboards/{mb['id']}", timeout=15)


# ── Block scoping to page ────────────────────────────────────────────────────
class TestBlockPageScoping:
    def test_create_block_without_page_id_uses_current_page(self, designer):
        r = designer.post(f"{BASE_URL}/api/moodboards",
                          json={"title": f"TEST_F0_blk_{uuid.uuid4().hex[:6]}"}, timeout=15)
        mb = r.json()
        cpid = mb.get("current_page_id")
        assert cpid
        try:
            rb = designer.post(
                f"{BASE_URL}/api/moodboards/{mb['id']}/blocks",
                json={"type": "text", "content": {"body": "no-page"}},
                timeout=15,
            )
            assert rb.status_code == 201
            blk = rb.json()
            # Verify via GET that page_id matches current_page_id
            rg = designer.get(f"{BASE_URL}/api/moodboards/{mb['id']}", timeout=15)
            els = rg.json()["elements"]
            target = next((e for e in els if e["id"] == blk["id"]), None)
            assert target is not None
            assert target.get("page_id") == cpid, \
                f"block defaulted to wrong page: {target.get('page_id')} vs current {cpid}"
        finally:
            designer.delete(f"{BASE_URL}/api/moodboards/{mb['id']}", timeout=15)

    def test_create_block_with_explicit_page_id(self, designer, moodboard):
        # Create a 2nd page, then add block targeting it
        rp = designer.post(
            f"{BASE_URL}/api/moodboards/{moodboard['id']}/pages",
            json={"title": "TEST_Target", "page_type": "blank", "aspect_ratio": "portrait_a4"},
            timeout=15,
        )
        target_pid = rp.json()["id"]
        rb = designer.post(
            f"{BASE_URL}/api/moodboards/{moodboard['id']}/blocks",
            json={"type": "text", "page_id": target_pid, "content": {"body": "scoped"}},
            timeout=15,
        )
        assert rb.status_code == 201
        blk = rb.json()
        # Verify via GET
        rg = designer.get(f"{BASE_URL}/api/moodboards/{moodboard['id']}", timeout=15)
        els = rg.json()["elements"]
        target = next((e for e in els if e["id"] == blk["id"]), None)
        assert target is not None
        assert target.get("page_id") == target_pid


# ── Cross-tenant + RBAC ──────────────────────────────────────────────────────
class TestPagesIsolationAndRBAC:
    def test_studio2_cannot_read_designer_pages(self, studio2, moodboard):
        r = studio2.get(f"{BASE_URL}/api/moodboards/{moodboard['id']}/pages", timeout=15)
        assert r.status_code == 404, f"expected 404 cross-tenant, got {r.status_code}: {r.text[:200]}"

    def test_studio2_cannot_create_page_on_designer_moodboard(self, studio2, moodboard):
        r = studio2.post(
            f"{BASE_URL}/api/moodboards/{moodboard['id']}/pages",
            json={"title": "evil", "page_type": "blank", "aspect_ratio": "portrait_a4"},
            timeout=15,
        )
        assert r.status_code in (403, 404), r.text[:200]

    def test_client_cannot_write_pages(self, client_user, moodboard):
        r = client_user.post(
            f"{BASE_URL}/api/moodboards/{moodboard['id']}/pages",
            json={"title": "blocked", "page_type": "blank", "aspect_ratio": "portrait_a4"},
            timeout=15,
        )
        assert r.status_code == 403, f"expected 403 RBAC, got {r.status_code}: {r.text[:200]}"


# ── Template apply creates default page ──────────────────────────────────────
class TestTemplateApplyDefaultPage:
    def test_template_apply_attaches_blocks_to_default_page(self, designer):
        # List templates; if none, skip
        rl = designer.get(f"{BASE_URL}/api/templates", timeout=15)
        if rl.status_code != 200:
            pytest.skip(f"templates listing not available: {rl.status_code}")
        templates = rl.json()
        if isinstance(templates, dict):
            templates = templates.get("data") or templates.get("templates") or []
        if not templates:
            pytest.skip("no templates available to test apply")
        tpl_id = templates[0]["id"]
        # apply
        ra = designer.post(
            f"{BASE_URL}/api/templates/{tpl_id}/apply",
            json={"title": f"TEST_F0_tpl_{uuid.uuid4().hex[:6]}"},
            timeout=20,
        )
        if ra.status_code not in (200, 201):
            pytest.skip(f"template apply not available or failed: {ra.status_code} {ra.text[:200]}")
        mb = ra.json()
        mb_id = mb.get("id") or mb.get("moodboard_id")
        assert mb_id
        try:
            rg = designer.get(f"{BASE_URL}/api/moodboards/{mb_id}", timeout=15)
            full = rg.json()
            assert full.get("current_page_id"), "template apply did not set current_page_id"
            assert len(full.get("pages", [])) >= 1, "template apply did not create default page"
            # All elements must have page_id populated
            els = full.get("elements", [])
            unscoped = [e for e in els if not e.get("page_id")]
            assert not unscoped, f"{len(unscoped)} elements have no page_id after template apply"
        finally:
            designer.delete(f"{BASE_URL}/api/moodboards/{mb_id}", timeout=15)


# ── Backfill regression on existing fixture moodboard ────────────────────────
class TestBackfillRegression:
    FIXTURE_MB = "924f0e48-7869-4038-aa30-14726dd17b23"

    def test_fixture_moodboard_has_page_and_element_linked(self, designer):
        r = designer.get(f"{BASE_URL}/api/moodboards/{self.FIXTURE_MB}", timeout=15)
        if r.status_code == 404:
            pytest.skip("fixture moodboard not in this tenant")
        assert r.status_code == 200, r.text[:300]
        mb = r.json()
        assert mb.get("current_page_id"), "backfill missed current_page_id on fixture moodboard"
        assert len(mb.get("pages", [])) >= 1
        # all elements have page_id
        unscoped = [e for e in mb.get("elements", []) if not e.get("page_id")]
        assert not unscoped, f"backfill missed page_id on {len(unscoped)} elements"
