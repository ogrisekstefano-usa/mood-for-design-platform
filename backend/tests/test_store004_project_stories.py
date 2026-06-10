"""STORE-004 · Project Story™ · backend API regression"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://i18n-recovery-1.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASS  = "Blueprint2024!"
SPEC_ID     = "e9648cbb-4042-4f2a-91b2-ac2a66150a38"
EXISTING_STORY_ID = "3127f798-8ea7-4b7c-ab67-4549f0115832"
EXISTING_SHARE_TOKEN = "TWzZ7O9nMBn26Sch9aviZA"


@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    tok = r.json().get("session", {}).get("access_token")
    assert tok, "No access_token in response"
    return tok


@pytest.fixture(scope="module")
def cli(auth_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {auth_token}",
                      "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def public_cli():
    return requests.Session()


# --- LIST ----------------------------------------------------------------
class TestList:
    def test_list_stories_ok(self, cli):
        r = cli.get(f"{BASE_URL}/api/project-stories", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and "count" in data
        assert isinstance(data["items"], list)
        # Tenant isolation: tenant_id must NOT leak (it's allowed in list but should only be admin's)
        if data["items"]:
            for it in data["items"]:
                assert "id" in it
                assert "title" in it


# --- GENERATE -------------------------------------------------------------
class TestGenerate:
    def test_generate_from_specification(self, cli):
        r = cli.post(f"{BASE_URL}/api/project-stories/generate-from-specification/{SPEC_ID}", timeout=30)
        assert r.status_code in (200, 201), f"got {r.status_code}: {r.text[:300]}"
        story = r.json()
        assert story.get("id"), "Story has no id"
        assert story.get("share_token"), "Story has no share_token"
        secs = story.get("sections") or {}
        for key in ("cover", "vision", "moodboard", "material_board", "selected_products", "summary"):
            assert key in secs, f"Missing section {key}"
        # selected_products must contain entity metadata
        sp = secs.get("selected_products") or []
        assert isinstance(sp, list)
        if sp:
            p0 = sp[0]
            # contract: each entry exposes display_name + brand_name + entity_type
            assert "display_name" in p0
            assert "brand_name" in p0
            assert "entity_type" in p0
        # stash for later tests
        pytest.story_id_new = story["id"]
        pytest.share_token_new = story["share_token"]

    def test_generate_invalid_spec_returns_404(self, cli):
        r = cli.post(f"{BASE_URL}/api/project-stories/generate-from-specification/00000000-0000-0000-0000-000000000000", timeout=15)
        assert r.status_code == 404


# --- DETAIL ---------------------------------------------------------------
class TestDetail:
    def test_get_detail(self, cli):
        r = cli.get(f"{BASE_URL}/api/project-stories/{EXISTING_STORY_ID}", timeout=15)
        assert r.status_code == 200
        s = r.json()
        assert s["id"] == EXISTING_STORY_ID
        assert isinstance(s.get("sections"), dict)
        for key in ("cover", "vision", "moodboard", "material_board", "selected_products", "summary"):
            assert key in s["sections"], f"section {key} missing"

    def test_get_detail_404(self, cli):
        r = cli.get(f"{BASE_URL}/api/project-stories/00000000-0000-0000-0000-000000000000", timeout=15)
        assert r.status_code == 404


# --- PATCH ----------------------------------------------------------------
class TestPatch:
    def test_patch_vision_section(self, cli):
        # fetch current
        cur = cli.get(f"{BASE_URL}/api/project-stories/{EXISTING_STORY_ID}", timeout=15).json()
        new_sections = dict(cur.get("sections") or {})
        new_sections["vision"] = {"headline": "TEST_headline_iter", "body": "TEST_body_iter"}
        r = cli.patch(f"{BASE_URL}/api/project-stories/{EXISTING_STORY_ID}",
                      json={"sections": new_sections, "title": "TEST_PATCHED_TITLE"}, timeout=15)
        assert r.status_code == 200
        # verify persisted
        v = cli.get(f"{BASE_URL}/api/project-stories/{EXISTING_STORY_ID}", timeout=15).json()
        assert v.get("title") == "TEST_PATCHED_TITLE"
        assert v["sections"]["vision"]["headline"] == "TEST_headline_iter"
        assert v["sections"]["vision"]["body"] == "TEST_body_iter"


# --- PUBLIC SHARE ---------------------------------------------------------
class TestPublic:
    def test_public_no_auth(self, public_cli):
        r = public_cli.get(f"{BASE_URL}/api/story/{EXISTING_SHARE_TOKEN}", timeout=15)
        assert r.status_code == 200
        s = r.json()
        assert "tenant_id" not in s, "tenant_id MUST be hidden from public payload"
        assert "created_by" not in s, "created_by MUST be hidden from public payload"
        assert "sections" in s
        for key in ("cover", "vision", "moodboard", "material_board", "selected_products", "summary"):
            assert key in s["sections"]

    def test_public_invalid_token_404(self, public_cli):
        r = public_cli.get(f"{BASE_URL}/api/story/__invalid_token__xx", timeout=15)
        assert r.status_code == 404


# --- DELETE (soft) --------------------------------------------------------
class TestDelete:
    def test_soft_delete_disappears_from_list(self, cli):
        sid = getattr(pytest, "story_id_new", None)
        if not sid:
            pytest.skip("Generate test produced no story id")
        # confirm present
        before = cli.get(f"{BASE_URL}/api/project-stories", timeout=15).json()
        assert any(it["id"] == sid for it in before.get("items", [])), "new story missing from list"
        # delete
        r = cli.delete(f"{BASE_URL}/api/project-stories/{sid}", timeout=15)
        assert r.status_code == 200
        # confirm gone from list
        after = cli.get(f"{BASE_URL}/api/project-stories", timeout=15).json()
        assert not any(it["id"] == sid for it in after.get("items", [])), "soft-deleted story still in list"
        # detail must 404
        r2 = cli.get(f"{BASE_URL}/api/project-stories/{sid}", timeout=15)
        assert r2.status_code == 404
