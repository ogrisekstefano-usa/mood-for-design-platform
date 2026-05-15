"""Phase N — Media Library + Material Registry backend tests.

Covers:
 • /api/media list / stats / detail / patch / archive / restore / replace (soft versioning)
 • /api/media/collections CRUD + attach/detach
 • /api/media/{id}/links create/delete
 • /api/media/materials CRUD + by-slug + attach-asset + detach (mirror link)
 • Tenant isolation (studio2 cannot see Studio entities)
 • RBAC: client role cannot write
"""
import os
import uuid
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

CREDS = {
    "super":    ("demo@moodfordesign.com",     "Blueprint2024!"),
    "designer": ("designer@moodfordesign.com", "Designer2024!"),
    "client":   ("client@moodfordesign.com",   "Client2024!"),
    "studio2":  ("studio2@moodfordesign.com",  "Studio2024!"),
}


def _login(email, pwd):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd}, timeout=20)
    assert r.status_code == 200, f"Login {email} failed: {r.status_code} {r.text}"
    return r.json()["session"]["access_token"]


@pytest.fixture(scope="session")
def tokens():
    return {k: _login(*v) for k, v in CREDS.items()}


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ─────────────────────────────────────────────────────────────────────
# 1. /api/media — list / stats
# ─────────────────────────────────────────────────────────────────────
class TestMediaListStats:
    def test_list_default(self, tokens):
        r = requests.get(f"{API}/media", headers=H(tokens["super"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert "data" in body and "count" in body
        assert isinstance(body["data"], list)

    def test_list_type_filter(self, tokens):
        r = requests.get(f"{API}/media?type=image&limit=20", headers=H(tokens["super"]))
        assert r.status_code == 200
        for it in r.json()["data"]:
            ft = (it.get("file_type") or "").lower()
            assert ft.startswith("image/"), f"Non-image leaked: {ft}"

    def test_list_used_false(self, tokens):
        r = requests.get(f"{API}/media?used=false", headers=H(tokens["super"]))
        assert r.status_code == 200
        for it in r.json()["data"]:
            assert (it.get("usage_count") or 0) == 0

    def test_stats(self, tokens):
        r = requests.get(f"{API}/media/stats", headers=H(tokens["super"]))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total", "by_kind", "total_bytes", "unused", "collections", "materials"):
            assert k in d, f"Missing {k}"
        assert {"image", "video", "pdf", "other"} <= set(d["by_kind"].keys())
        assert isinstance(d["total"], int)


# ─────────────────────────────────────────────────────────────────────
# 2. Collections CRUD + attach
# ─────────────────────────────────────────────────────────────────────
class TestCollections:
    coll_id = None

    def test_create(self, tokens):
        name = f"TEST_Coll_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/media/collections", headers=H(tokens["super"]),
                          json={"name": name, "description": "phase-n test"})
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["name"] == name
        assert d["slug"].startswith("test-coll-")
        TestCollections.coll_id = d["id"]

    def test_list_after_create(self, tokens):
        assert TestCollections.coll_id
        r = requests.get(f"{API}/media/collections/list", headers=H(tokens["super"]))
        assert r.status_code == 200
        ids = [c["id"] for c in r.json()["data"]]
        assert TestCollections.coll_id in ids
        # Each collection has item_count
        for c in r.json()["data"]:
            assert "item_count" in c

    def test_get(self, tokens):
        r = requests.get(f"{API}/media/collections/{TestCollections.coll_id}",
                         headers=H(tokens["super"]))
        assert r.status_code == 200
        body = r.json()
        assert body["collection"]["id"] == TestCollections.coll_id
        assert "items" in body

    def test_attach_and_detach(self, tokens):
        # Need at least 1 asset; pull from list
        ml = requests.get(f"{API}/media?limit=1", headers=H(tokens["super"])).json()["data"]
        if not ml:
            pytest.skip("No media assets available to attach")
        aid = ml[0]["id"]
        r = requests.post(f"{API}/media/collections/{TestCollections.coll_id}/attach",
                          headers=H(tokens["super"]), json={"asset_ids": [aid]})
        assert r.status_code == 200, r.text
        assert aid in r.json()["added"] or r.json()["skipped"] >= 1
        # Verify item count via GET
        g = requests.get(f"{API}/media/collections/{TestCollections.coll_id}",
                        headers=H(tokens["super"])).json()
        item_ids = [it["asset_id"] for it in g["items"]]
        assert aid in item_ids
        # collection_id filter on list
        lf = requests.get(f"{API}/media?collection_id={TestCollections.coll_id}",
                          headers=H(tokens["super"])).json()["data"]
        assert any(it["id"] == aid for it in lf)
        # Detach
        d = requests.delete(
            f"{API}/media/collections/{TestCollections.coll_id}/items/{aid}",
            headers=H(tokens["super"]))
        assert d.status_code == 200

    def test_patch(self, tokens):
        r = requests.patch(f"{API}/media/collections/{TestCollections.coll_id}",
                          headers=H(tokens["super"]),
                          json={"description": "updated"})
        assert r.status_code == 200, r.text
        # Verify persistence
        g = requests.get(f"{API}/media/collections/{TestCollections.coll_id}",
                        headers=H(tokens["super"])).json()
        assert g["collection"]["description"] == "updated"

    def test_archive(self, tokens):
        r = requests.delete(f"{API}/media/collections/{TestCollections.coll_id}",
                           headers=H(tokens["super"]))
        assert r.status_code == 200
        # No longer in default list
        lst = requests.get(f"{API}/media/collections/list", headers=H(tokens["super"])).json()["data"]
        assert TestCollections.coll_id not in [c["id"] for c in lst]


# ─────────────────────────────────────────────────────────────────────
# 3. Materials CRUD + attach-asset (mirror link)
# ─────────────────────────────────────────────────────────────────────
class TestMaterials:
    mat_id = None
    mat_slug = None
    att_id = None
    asset_id = None

    def test_list_default(self, tokens):
        r = requests.get(f"{API}/media/materials/list", headers=H(tokens["super"]))
        assert r.status_code == 200
        assert "data" in r.json()

    def test_list_q_filter(self, tokens):
        r = requests.get(f"{API}/media/materials/list?q=taj", headers=H(tokens["super"]))
        assert r.status_code == 200
        # Taj Mahal Quartzite seeded — should match or zero
        names = [m["name"].lower() for m in r.json()["data"]]
        if names:
            assert any("taj" in n for n in names)

    def test_create(self, tokens):
        name = f"TEST_Marmo_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/media/materials", headers=H(tokens["super"]),
                          json={"name": name, "category": "Stone",
                                "supplier": "TestQuarry", "finish": "Polished",
                                "thickness": "20mm", "origin": "Carrara"})
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["name"] == name
        assert d["category"] == "Stone"
        assert d["slug"]
        assert d["status"] == "active"
        TestMaterials.mat_id = d["id"]
        TestMaterials.mat_slug = d["slug"]

    def test_get_by_slug(self, tokens):
        r = requests.get(f"{API}/media/materials/by-slug/{TestMaterials.mat_slug}",
                        headers=H(tokens["super"]))
        assert r.status_code == 200
        body = r.json()
        assert body["material"]["id"] == TestMaterials.mat_id
        assert "attachments" in body and "linked_entities" in body

    def test_get_by_id(self, tokens):
        r = requests.get(f"{API}/media/materials/{TestMaterials.mat_id}",
                        headers=H(tokens["super"]))
        assert r.status_code == 200
        assert r.json()["material"]["id"] == TestMaterials.mat_id

    def test_patch(self, tokens):
        r = requests.patch(f"{API}/media/materials/{TestMaterials.mat_id}",
                          headers=H(tokens["super"]),
                          json={"description": "Patched description",
                                "technical_notes": "Phase N test"})
        assert r.status_code == 200
        # Verify persistence
        g = requests.get(f"{API}/media/materials/{TestMaterials.mat_id}",
                        headers=H(tokens["super"])).json()
        assert g["material"]["description"] == "Patched description"

    def test_attach_asset_mirrors_to_media_links(self, tokens):
        ml = requests.get(f"{API}/media?limit=1", headers=H(tokens["super"])).json()["data"]
        if not ml:
            pytest.skip("No assets to attach")
        aid = ml[0]["id"]
        TestMaterials.asset_id = aid
        r = requests.post(
            f"{API}/media/materials/{TestMaterials.mat_id}/attach-asset",
            headers=H(tokens["super"]),
            json={"asset_id": aid, "role": "slab", "caption": "test slab"})
        assert r.status_code in (200, 201), r.text
        att = r.json()
        assert "id" in att
        TestMaterials.att_id = att["id"]
        # Verify mirror link on the asset detail endpoint
        det = requests.get(f"{API}/media/{aid}", headers=H(tokens["super"])).json()
        link_entities = [(l["entity_type"], l.get("entity_id")) for l in det["links"]]
        assert ("material", TestMaterials.mat_id) in link_entities, \
            f"Mirror media_links missing. Got links: {link_entities}"
        # And material_attachments shows it
        assert any(a["material_id"] == TestMaterials.mat_id
                   for a in det["material_attachments"])

    def test_detach_removes_mirror(self, tokens):
        assert TestMaterials.att_id
        r = requests.delete(
            f"{API}/media/materials/{TestMaterials.mat_id}/attachments/{TestMaterials.att_id}",
            headers=H(tokens["super"]))
        assert r.status_code == 200, r.text
        # Verify mirror gone
        det = requests.get(f"{API}/media/{TestMaterials.asset_id}",
                          headers=H(tokens["super"])).json()
        link_entities = [(l["entity_type"], l.get("entity_id")) for l in det["links"]]
        assert ("material", TestMaterials.mat_id) not in link_entities, \
            "Mirror media_links row should have been deleted on detach"

    def test_archive_material(self, tokens):
        r = requests.delete(f"{API}/media/materials/{TestMaterials.mat_id}",
                           headers=H(tokens["super"]))
        assert r.status_code == 200
        # No longer in active list
        lst = requests.get(f"{API}/media/materials/list", headers=H(tokens["super"])).json()["data"]
        assert TestMaterials.mat_id not in [m["id"] for m in lst]


# ─────────────────────────────────────────────────────────────────────
# 4. Media PATCH + ARCHIVE + RESTORE
# ─────────────────────────────────────────────────────────────────────
class TestMediaMutations:
    def _get_asset(self, tok):
        ml = requests.get(f"{API}/media?limit=1", headers=H(tok)).json()["data"]
        return ml[0]["id"] if ml else None

    def test_patch_metadata(self, tokens):
        aid = self._get_asset(tokens["super"])
        if not aid:
            pytest.skip("no asset")
        new_alt = f"TEST_alt_{uuid.uuid4().hex[:5]}"
        r = requests.patch(f"{API}/media/{aid}", headers=H(tokens["super"]),
                          json={"alt_text": new_alt, "tags": ["test", "phase-n"]})
        assert r.status_code == 200, r.text
        g = requests.get(f"{API}/media/{aid}", headers=H(tokens["super"])).json()
        assert g["asset"]["alt_text"] == new_alt
        assert "test" in (g["asset"].get("tags") or [])

    def test_archive_restore_cycle(self, tokens):
        # Use a non-head/different asset — pick the LAST one
        ml = requests.get(f"{API}/media?limit=50", headers=H(tokens["super"])).json()["data"]
        if len(ml) < 2:
            pytest.skip("not enough assets")
        aid = ml[-1]["id"]
        a = requests.delete(f"{API}/media/{aid}", headers=H(tokens["super"]))
        assert a.status_code == 200
        # Now it should NOT appear in default list
        lst = requests.get(f"{API}/media?limit=200", headers=H(tokens["super"])).json()["data"]
        assert aid not in [x["id"] for x in lst]
        # But include_archived=true must include it
        lst2 = requests.get(f"{API}/media?include_archived=true&limit=200",
                           headers=H(tokens["super"])).json()["data"]
        assert aid in [x["id"] for x in lst2]
        # Restore
        r = requests.post(f"{API}/media/{aid}/restore", headers=H(tokens["super"]))
        assert r.status_code == 200


# ─────────────────────────────────────────────────────────────────────
# 5. RBAC: client role cannot WRITE
# ─────────────────────────────────────────────────────────────────────
class TestRBAC:
    def test_client_cannot_create_material(self, tokens):
        r = requests.post(f"{API}/media/materials", headers=H(tokens["client"]),
                         json={"name": "TEST_blocked"})
        assert r.status_code == 403, f"Expected 403, got {r.status_code} {r.text}"

    def test_client_cannot_create_collection(self, tokens):
        r = requests.post(f"{API}/media/collections", headers=H(tokens["client"]),
                         json={"name": "TEST_blocked_coll"})
        assert r.status_code == 403

    def test_client_cannot_attach_asset(self, tokens):
        # Use any random IDs — permission check fires before lookup
        r = requests.post(
            f"{API}/media/materials/{uuid.uuid4()}/attach-asset",
            headers=H(tokens["client"]),
            json={"asset_id": str(uuid.uuid4()), "role": "slab"})
        assert r.status_code == 403

    def test_client_cannot_replace(self, tokens):
        r = requests.post(
            f"{API}/media/{uuid.uuid4()}/replace",
            headers=H(tokens["client"]),
            json={"new_asset_id": str(uuid.uuid4())})
        assert r.status_code == 403


# ─────────────────────────────────────────────────────────────────────
# 6. Tenant isolation: studio2 cannot see Studio's entities
# ─────────────────────────────────────────────────────────────────────
class TestTenantIsolation:
    def test_studio2_cannot_see_studio_materials(self, tokens):
        # First create a material on Studio
        name = f"TEST_iso_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/media/materials", headers=H(tokens["super"]),
                          json={"name": name, "category": "Stone"})
        assert r.status_code == 201
        mat = r.json()
        # studio2 list — must not include it
        lst = requests.get(f"{API}/media/materials/list",
                          headers=H(tokens["studio2"])).json()["data"]
        assert mat["id"] not in [m["id"] for m in lst]
        # studio2 GET by id → 404
        r2 = requests.get(f"{API}/media/materials/{mat['id']}",
                         headers=H(tokens["studio2"]))
        assert r2.status_code == 404
        # studio2 GET by slug → 404
        r3 = requests.get(f"{API}/media/materials/by-slug/{mat['slug']}",
                         headers=H(tokens["studio2"]))
        assert r3.status_code == 404
        # cleanup
        requests.delete(f"{API}/media/materials/{mat['id']}",
                       headers=H(tokens["super"]))

    def test_studio2_cannot_see_studio_collection(self, tokens):
        name = f"TEST_iso_coll_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/media/collections", headers=H(tokens["super"]),
                         json={"name": name})
        assert r.status_code == 201
        cid = r.json()["id"]
        lst = requests.get(f"{API}/media/collections/list",
                          headers=H(tokens["studio2"])).json()["data"]
        assert cid not in [c["id"] for c in lst]
        r2 = requests.get(f"{API}/media/collections/{cid}",
                         headers=H(tokens["studio2"]))
        assert r2.status_code == 404
        requests.delete(f"{API}/media/collections/{cid}",
                       headers=H(tokens["super"]))


# ─────────────────────────────────────────────────────────────────────
# 7. Links (asset usage map)
# ─────────────────────────────────────────────────────────────────────
class TestLinks:
    def test_create_and_delete_link(self, tokens):
        ml = requests.get(f"{API}/media?limit=1", headers=H(tokens["super"])).json()["data"]
        if not ml:
            pytest.skip("no asset")
        aid = ml[0]["id"]
        entity = str(uuid.uuid4())
        r = requests.post(f"{API}/media/{aid}/links", headers=H(tokens["super"]),
                         json={"entity_type": "project", "entity_id": entity,
                               "role": "hero"})
        assert r.status_code == 201, r.text
        link_id = r.json()["id"]
        # Duplicate must 409
        d = requests.post(f"{API}/media/{aid}/links", headers=H(tokens["super"]),
                         json={"entity_type": "project", "entity_id": entity,
                               "role": "hero"})
        assert d.status_code == 409
        # Delete
        x = requests.delete(f"{API}/media/links/{link_id}",
                           headers=H(tokens["super"]))
        assert x.status_code == 200
