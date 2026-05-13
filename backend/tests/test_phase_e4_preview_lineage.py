"""Phase E.4 — Template Preview Gallery + micro Template Versioning tests.

Covers:
  - GET /api/templates?with_preview=true (default) — preview_svg, palette, block_count present
  - GET /api/templates?with_preview=false — preview fields absent (perf escape)
  - GET /api/templates/{id} — preview_svg + palette + block_count + parent (if parent_id)
  - POST /api/templates/{id}/apply — resulting moodboard has template_id = applied template
  - POST /api/templates/from-moodboard/{mid} — resulting template has parent_id = src_mb.template_id
  - GET /api/templates/{child_id} — `parent` field populated with {id, name, slug}
  - i18n keys: moodboards.templates.startBlank / tenantPreset / derivedFrom in IT bundle

Token nested under response["session"]["access_token"].
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://content-hub-pro-22.preview.emergentagent.com",
).rstrip("/")

DESIGNER = ("designer@moodfordesign.com", "Designer2024!")
STUDIO2 = ("studio2@moodfordesign.com", "Studio2024!")


def _login(email: str, password: str) -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} failed {r.status_code}: {r.text}"
    body = r.json()
    tok = body.get("session", {}).get("access_token") or body.get("access_token")
    assert tok, f"no access_token in login response: {body}"
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="session")
def designer():
    return _login(*DESIGNER)


@pytest.fixture(scope="session")
def studio2():
    return _login(*STUDIO2)


# ─── Preview Gallery on LIST ─────────────────────────────────────────────────
class TestListPreview:
    def test_list_default_includes_preview(self, designer):
        r = designer.get(f"{BASE_URL}/api/templates?starter_only=true", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json().get("data", [])
        assert data, "expected at least one platform starter"
        for t in data[:5]:
            assert "preview_svg" in t, f"preview_svg missing in {t.get('slug')}"
            assert isinstance(t["preview_svg"], str)
            assert t["preview_svg"].startswith("<svg"), t["preview_svg"][:80]
            assert "palette" in t and isinstance(t["palette"], list)
            assert len(t["palette"]) <= 5
            assert "block_count" in t and isinstance(t["block_count"], int)
            assert t["block_count"] >= 0

    def test_list_with_preview_false_omits_preview(self, designer):
        r = designer.get(
            f"{BASE_URL}/api/templates?starter_only=true&with_preview=false",
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json().get("data", [])
        assert data, "expected at least one platform starter"
        for t in data:
            assert "preview_svg" not in t, f"preview_svg leaked when with_preview=false: {t.get('slug')}"
            assert "palette" not in t, f"palette leaked when with_preview=false: {t.get('slug')}"
            assert "block_count" not in t, f"block_count leaked when with_preview=false: {t.get('slug')}"

    def test_list_explicit_with_preview_true(self, designer):
        r = designer.get(
            f"{BASE_URL}/api/templates?starter_only=true&with_preview=true",
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json().get("data", [])
        assert data
        assert all("preview_svg" in t for t in data)


# ─── Preview on DETAIL ───────────────────────────────────────────────────────
class TestDetailPreview:
    def test_detail_includes_preview_palette_block_count(self, designer):
        lst = designer.get(f"{BASE_URL}/api/templates?starter_only=true", timeout=30).json()
        tpl = next(t for t in lst["data"] if t.get("tenant_id") is None)
        det = designer.get(f"{BASE_URL}/api/templates/{tpl['id']}", timeout=30)
        assert det.status_code == 200, det.text
        body = det.json()
        assert "preview_svg" in body and body["preview_svg"].startswith("<svg")
        assert "palette" in body and isinstance(body["palette"], list)
        assert "block_count" in body and isinstance(body["block_count"], int)
        # `parent` only present if parent_id; on platform templates it's absent
        if body.get("parent_id"):
            assert "parent" in body
            assert {"id", "name", "slug"} <= set(body["parent"].keys())
        else:
            # platform starters have no parent
            assert "parent" not in body or body.get("parent") is None


# ─── Lineage: apply → save-as → child.parent populated ───────────────────────
class TestLineage:
    def test_apply_sets_moodboard_template_id(self, designer):
        # pick a platform starter (luxury-editorial is the spec example)
        lst = designer.get(f"{BASE_URL}/api/templates?starter_only=true", timeout=30).json()
        platform = [t for t in lst["data"] if t.get("tenant_id") is None]
        luxury = next((t for t in platform if t.get("slug") == "luxury-editorial"), platform[0])
        title = f"TEST_E4_LINEAGE_MB_{uuid.uuid4().hex[:6]}"
        r = designer.post(
            f"{BASE_URL}/api/templates/{luxury['id']}/apply",
            json={"title": title}, timeout=30,
        )
        assert r.status_code == 201, r.text
        mb_id = r.json()["id"]
        # fetch moodboard and confirm template_id lineage
        det = designer.get(f"{BASE_URL}/api/moodboards/{mb_id}", timeout=30)
        assert det.status_code == 200, det.text
        mb = det.json()
        assert mb.get("template_id") == luxury["id"], (
            f"moodboard.template_id should equal applied template id {luxury['id']}, "
            f"got {mb.get('template_id')}"
        )
        # cleanup
        designer.delete(f"{BASE_URL}/api/moodboards/{mb_id}", timeout=30)

    def test_full_apply_then_save_as_template_parent_populated(self, designer):
        # 1) Apply luxury-editorial → new moodboard with template_id set
        lst = designer.get(f"{BASE_URL}/api/templates?starter_only=true", timeout=30).json()
        platform = [t for t in lst["data"] if t.get("tenant_id") is None]
        parent_tpl = next(
            (t for t in platform if t.get("slug") == "luxury-editorial"),
            platform[0],
        )
        mb_title = f"TEST_E4_FORK_SRC_{uuid.uuid4().hex[:6]}"
        ap = designer.post(
            f"{BASE_URL}/api/templates/{parent_tpl['id']}/apply",
            json={"title": mb_title}, timeout=30,
        )
        assert ap.status_code == 201, ap.text
        mb_id = ap.json()["id"]

        # 2) Save-as-template from that moodboard
        slug = f"test_e4_child_{uuid.uuid4().hex[:6]}"
        sa = designer.post(
            f"{BASE_URL}/api/templates/from-moodboard/{mb_id}",
            json={"slug": slug, "name": f"TEST E4 CHILD {slug}",
                  "category": "editorial"},
            timeout=30,
        )
        assert sa.status_code == 201, sa.text
        child_id = sa.json()["id"]

        # 3) GET child template, verify parent_id + parent {id,name,slug}
        det = designer.get(f"{BASE_URL}/api/templates/{child_id}", timeout=30)
        assert det.status_code == 200, det.text
        child = det.json()
        assert child.get("parent_id") == parent_tpl["id"], (
            f"child.parent_id should equal {parent_tpl['id']}, got {child.get('parent_id')}"
        )
        assert "parent" in child and isinstance(child["parent"], dict), child
        parent_obj = child["parent"]
        assert parent_obj.get("id") == parent_tpl["id"]
        # parent_tpl name comes from default locale; just ensure non-empty + matches slug expectation
        assert parent_obj.get("slug") == parent_tpl["slug"]
        assert isinstance(parent_obj.get("name"), str) and parent_obj["name"]

        # also assert preview attached
        assert "preview_svg" in child and child["preview_svg"].startswith("<svg")
        assert "block_count" in child

        # cleanup
        designer.delete(f"{BASE_URL}/api/templates/{child_id}", timeout=30)
        designer.delete(f"{BASE_URL}/api/moodboards/{mb_id}", timeout=30)

    def test_save_as_without_parent_template_id_has_no_parent(self, designer):
        # Brand new moodboard (no template applied) → save-as → parent_id null, parent absent
        mb = designer.post(
            f"{BASE_URL}/api/moodboards",
            json={"title": f"TEST_E4_NOPARENT_{uuid.uuid4().hex[:6]}"},
            timeout=30,
        )
        assert mb.status_code in (200, 201), mb.text
        mb_id = mb.json()["id"]
        designer.post(
            f"{BASE_URL}/api/moodboards/{mb_id}/blocks",
            json={"type": "text", "x": 10, "y": 10, "width": 100, "height": 40,
                  "content": {"text": "noparent"}},
            timeout=30,
        )
        slug = f"test_e4_orphan_{uuid.uuid4().hex[:6]}"
        sa = designer.post(
            f"{BASE_URL}/api/templates/from-moodboard/{mb_id}",
            json={"slug": slug, "name": f"TEST E4 ORPHAN {slug}"},
            timeout=30,
        )
        assert sa.status_code == 201, sa.text
        new_id = sa.json()["id"]
        det = designer.get(f"{BASE_URL}/api/templates/{new_id}", timeout=30)
        assert det.status_code == 200
        body = det.json()
        assert not body.get("parent_id"), f"unexpected parent_id: {body.get('parent_id')}"
        assert not body.get("parent"), f"unexpected parent obj: {body.get('parent')}"
        # cleanup
        designer.delete(f"{BASE_URL}/api/templates/{new_id}", timeout=30)
        designer.delete(f"{BASE_URL}/api/moodboards/{mb_id}", timeout=30)


# ─── i18n IT keys for E.4 ────────────────────────────────────────────────────
class TestI18nE4:
    def test_it_bundle_has_e4_keys(self, designer):
        r = designer.get(f"{BASE_URL}/api/blueprint/i18n/it", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        messages = body.get("messages") or body.get("strings") or {}
        assert isinstance(messages, dict) and messages
        for k in ("moodboards.templates.startBlank",
                  "moodboards.templates.tenantPreset",
                  "moodboards.templates.derivedFrom"):
            assert k in messages, f"missing IT i18n key: {k}"
            assert isinstance(messages[k], str) and messages[k]

    def test_en_bundle_has_e4_keys(self, designer):
        r = designer.get(f"{BASE_URL}/api/blueprint/i18n/en-US", timeout=30)
        # accept either en-US or en path
        if r.status_code != 200:
            r = designer.get(f"{BASE_URL}/api/blueprint/i18n/en", timeout=30)
        assert r.status_code == 200, r.text
        messages = (r.json().get("messages") or r.json().get("strings") or {})
        for k in ("moodboards.templates.startBlank",
                  "moodboards.templates.tenantPreset",
                  "moodboards.templates.derivedFrom"):
            assert k in messages, f"missing EN i18n key: {k}"
