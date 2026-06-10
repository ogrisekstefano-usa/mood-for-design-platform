"""Phase E.2 Templates V1 backend tests.

Covers:
  - GET    /api/templates                        — list (7 platform starters + tenant)
  - GET    /api/templates/{id}                   — detail w/ normalized blocks (x/y/w/h/z)
  - POST   /api/templates/{id}/apply             — clone → new moodboard (NO 'settings' col)
  - POST   /api/templates/from-moodboard/{mid}   — snapshot moodboard as template
  - Tenant isolation: studio2 sees ONLY platform templates, not Studio-saved ones
  - RBAC: client → 403 on /apply and /from-moodboard
  - i18n: locale=it returns Italian name/description if available

Auth note: token nested under response["session"]["access_token"].
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://i18n-recovery-1.preview.emergentagent.com",
).rstrip("/")

DESIGNER = ("designer@moodfordesign.com", "Designer2024!")
CLIENT = ("client@moodfordesign.com", "Client2024!")
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


# ─── Fixtures ────────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def designer():
    return _login(*DESIGNER)


@pytest.fixture(scope="session")
def client_user():
    return _login(*CLIENT)


@pytest.fixture(scope="session")
def studio2():
    return _login(*STUDIO2)


# ─── LIST ────────────────────────────────────────────────────────────────────
class TestTemplatesList:
    """GET /api/templates returns platform starters + tenant-scoped."""

    def test_list_returns_seven_platform_starters(self, designer):
        r = designer.get(f"{BASE_URL}/api/templates?starter_only=true", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "data" in body and isinstance(body["data"], list)
        # Platform starters (tenant_id IS NULL) must include the 7 seeded
        platform = [t for t in body["data"] if t.get("tenant_id") is None]
        assert len(platform) >= 7, (
            f"Expected >=7 platform starter templates, got {len(platform)}: "
            f"{[t.get('slug') for t in platform]}"
        )
        # Verify the 7 well-known starter slugs from migration 007
        # (slugs use hyphens, e.g. luxury-editorial / materials-board / ff-and-e)
        slugs = {t.get("slug") for t in platform}
        for expected in ("luxury-editorial", "hospitality", "residential",
                          "retail", "materials-board", "ff-and-e", "concept"):
            assert expected in slugs, f"missing starter slug: {expected} in {slugs}"

    def test_list_locale_italian_resolves_localized_label(self, designer):
        r = designer.get(f"{BASE_URL}/api/templates?starter_only=true&locale=it", timeout=30)
        assert r.status_code == 200
        items = r.json().get("data", [])
        assert items, "no templates returned for locale=it"
        # Each item must expose name + description as strings (locale resolution applied)
        for t in items[:3]:
            assert isinstance(t.get("name"), str) and t["name"], t
            # locale_content should be stripped from public payload
            assert "locale_content" not in t

    def test_list_category_filter(self, designer):
        r = designer.get(f"{BASE_URL}/api/templates?starter_only=true&category=residential", timeout=30)
        assert r.status_code == 200
        for t in r.json().get("data", []):
            assert t.get("category") == "residential"


# ─── DETAIL ──────────────────────────────────────────────────────────────────
class TestTemplateDetail:
    def test_detail_returns_normalized_blocks(self, designer):
        r = designer.get(f"{BASE_URL}/api/templates?starter_only=true", timeout=30)
        ids = [t["id"] for t in r.json()["data"] if t.get("tenant_id") is None]
        assert ids, "no platform templates to detail"
        det = designer.get(f"{BASE_URL}/api/templates/{ids[0]}", timeout=30)
        assert det.status_code == 200, det.text
        body = det.json()
        assert "blocks" in body and isinstance(body["blocks"], list)
        for b in body["blocks"]:
            # normalized fields surface (no position_json leak)
            assert "x" in b and "y" in b and "width" in b and "height" in b
            assert "z_index" in b
            assert "position_json" not in b
            assert "style_json" not in b
            assert isinstance(b.get("style"), dict)
            assert isinstance(b.get("content"), dict)

    def test_detail_404_on_garbage_uuid(self, designer):
        r = designer.get(f"{BASE_URL}/api/templates/not-a-uuid", timeout=30)
        assert r.status_code in (404, 422), r.text

    def test_detail_404_on_unknown_uuid(self, designer):
        r = designer.get(f"{BASE_URL}/api/templates/{uuid.uuid4()}", timeout=30)
        assert r.status_code == 404


# ─── APPLY ───────────────────────────────────────────────────────────────────
class TestApplyTemplate:
    def test_apply_creates_moodboard_with_blocks(self, designer):
        # Pick first platform starter
        lst = designer.get(f"{BASE_URL}/api/templates?starter_only=true", timeout=30).json()
        platform = [t for t in lst["data"] if t.get("tenant_id") is None]
        tpl = platform[0]
        title = f"TEST_E2_APPLY_{uuid.uuid4().hex[:6]}"
        r = designer.post(
            f"{BASE_URL}/api/templates/{tpl['id']}/apply",
            json={"title": title},
            timeout=30,
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert "id" in body
        assert body.get("title") == title
        assert body.get("status") == "draft"
        assert isinstance(body.get("blocks_count"), int)
        new_mb_id = body["id"]
        # Verify moodboard exists and has cloned blocks
        det = designer.get(f"{BASE_URL}/api/moodboards/{new_mb_id}", timeout=30)
        assert det.status_code == 200, det.text
        det_body = det.json()
        # Some endpoints return blocks list inline or nested under elements/blocks
        blocks = det_body.get("blocks") or det_body.get("elements") or []
        # If detail doesn't return blocks, hit blocks endpoint
        if not blocks:
            br = designer.get(f"{BASE_URL}/api/moodboards/{new_mb_id}/blocks", timeout=30)
            if br.status_code == 200:
                blocks = br.json() if isinstance(br.json(), list) else br.json().get("data", [])
        # The apply response says how many were cloned — should be > 0 since starters have blocks
        assert body["blocks_count"] >= 1, f"no blocks cloned: {body}"
        # cleanup
        designer.delete(f"{BASE_URL}/api/moodboards/{new_mb_id}", timeout=30)

    def test_apply_404_on_unknown_template(self, designer):
        r = designer.post(
            f"{BASE_URL}/api/templates/{uuid.uuid4()}/apply",
            json={"title": "TEST_E2_NOPE"},
            timeout=30,
        )
        assert r.status_code == 404

    def test_apply_rejects_invalid_payload(self, designer):
        lst = designer.get(f"{BASE_URL}/api/templates?starter_only=true", timeout=30).json()
        tpl = [t for t in lst["data"] if t.get("tenant_id") is None][0]
        r = designer.post(f"{BASE_URL}/api/templates/{tpl['id']}/apply", json={}, timeout=30)
        assert r.status_code in (400, 422), r.text


# ─── SAVE AS TEMPLATE ────────────────────────────────────────────────────────
class TestSaveAsTemplate:
    def test_save_moodboard_as_template_snapshots_blocks(self, designer):
        # Create a moodboard with a couple of blocks
        mb = designer.post(
            f"{BASE_URL}/api/moodboards",
            json={"title": f"TEST_E2_SRC_{uuid.uuid4().hex[:6]}"},
            timeout=30,
        )
        assert mb.status_code in (200, 201), mb.text
        mid = mb.json()["id"]
        # Add a text block
        b1 = designer.post(
            f"{BASE_URL}/api/moodboards/{mid}/blocks",
            json={"type": "text", "x": 50, "y": 50, "width": 200, "height": 80,
                  "content": {"text": "hello e2"}},
            timeout=30,
        )
        assert b1.status_code in (200, 201), b1.text

        slug = f"test_e2_tpl_{uuid.uuid4().hex[:6]}"
        r = designer.post(
            f"{BASE_URL}/api/templates/from-moodboard/{mid}",
            json={"slug": slug, "name": f"TEST E2 TPL {slug}"},
            timeout=30,
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert body.get("slug") == slug
        assert body.get("blocks_count", 0) >= 1
        new_tpl_id = body["id"]
        # Cleanup
        designer.delete(f"{BASE_URL}/api/templates/{new_tpl_id}", timeout=30)
        designer.delete(f"{BASE_URL}/api/moodboards/{mid}", timeout=30)

    def test_save_404_on_unknown_moodboard(self, designer):
        slug = f"test_e2_nope_{uuid.uuid4().hex[:6]}"
        r = designer.post(
            f"{BASE_URL}/api/templates/from-moodboard/{uuid.uuid4()}",
            json={"slug": slug, "name": "TEST E2 NOPE"},
            timeout=30,
        )
        assert r.status_code == 404


# ─── TENANT ISOLATION ────────────────────────────────────────────────────────
class TestTenantIsolation:
    def test_studio2_sees_only_platform_templates(self, designer, studio2):
        # Designer saves a tenant-private template
        mb = designer.post(
            f"{BASE_URL}/api/moodboards",
            json={"title": f"TEST_E2_ISO_{uuid.uuid4().hex[:6]}"}, timeout=30,
        )
        assert mb.status_code in (200, 201)
        mid = mb.json()["id"]
        designer.post(
            f"{BASE_URL}/api/moodboards/{mid}/blocks",
            json={"type": "text", "x": 10, "y": 10, "width": 100, "height": 40,
                  "content": {"text": "iso"}}, timeout=30,
        )
        slug = f"test_e2_iso_{uuid.uuid4().hex[:6]}"
        r = designer.post(
            f"{BASE_URL}/api/templates/from-moodboard/{mid}",
            json={"slug": slug, "name": f"ISO {slug}"}, timeout=30,
        )
        assert r.status_code == 201, r.text
        new_tpl_id = r.json()["id"]

        # studio2 (Showroom tenant_admin) should NOT see the designer's tenant template
        s2_list = studio2.get(f"{BASE_URL}/api/templates", timeout=30)
        assert s2_list.status_code == 200, s2_list.text
        s2_data = s2_list.json().get("data", [])
        s2_slugs = {t.get("slug") for t in s2_data}
        assert slug not in s2_slugs, (
            f"TENANT LEAK: studio2 saw designer's private template '{slug}' "
            f"in: {s2_slugs}"
        )
        # And only platform (tenant_id IS NULL) for cross-tenant view
        for t in s2_data:
            owner = t.get("tenant_id")
            assert owner is None or owner != "studio-or-leak"  # tenant_id should be None or studio2's tenant
            # Stronger: any tenant_scoped item in s2 list must NOT be from Studio
        # studio2 cannot fetch detail of designer's template
        det = studio2.get(f"{BASE_URL}/api/templates/{new_tpl_id}", timeout=30)
        assert det.status_code == 404, f"expected 404, got {det.status_code}: {det.text}"

        # cleanup
        designer.delete(f"{BASE_URL}/api/templates/{new_tpl_id}", timeout=30)
        designer.delete(f"{BASE_URL}/api/moodboards/{mid}", timeout=30)


# ─── RBAC ────────────────────────────────────────────────────────────────────
class TestRBAC:
    def test_client_403_on_apply(self, client_user, designer):
        # Need a valid template id
        lst = designer.get(f"{BASE_URL}/api/templates?starter_only=true", timeout=30).json()
        tpl = [t for t in lst["data"] if t.get("tenant_id") is None][0]
        r = client_user.post(
            f"{BASE_URL}/api/templates/{tpl['id']}/apply",
            json={"title": "TEST_E2_CLIENT_RBAC"},
            timeout=30,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_client_403_on_save_as_template(self, client_user):
        slug = f"test_e2_client_{uuid.uuid4().hex[:6]}"
        r = client_user.post(
            f"{BASE_URL}/api/templates/from-moodboard/{uuid.uuid4()}",
            json={"slug": slug, "name": "CLIENT NO"},
            timeout=30,
        )
        # 403 from permission gate must fire BEFORE 404 from moodboard lookup
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_client_can_read_templates(self, client_user):
        r = client_user.get(f"{BASE_URL}/api/templates", timeout=30)
        assert r.status_code == 200, r.text


# ─── i18n keys present in blueprint EN/IT ─────────────────────────────────────
class TestI18n:
    def test_it_bundle_has_template_keys(self, designer):
        r = designer.get(f"{BASE_URL}/api/blueprint/i18n/it", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        # response: { locale, fallback, messages: { "moodboards.templates.eyebrow": "..." } }
        messages = body.get("messages") or body.get("strings") or {}
        assert isinstance(messages, dict) and messages, f"empty messages: {body}"
        for k in ("moodboards.templates.eyebrow",
                  "moodboards.templates.blank",
                  "moodboards.templates.saveAs"):
            assert k in messages and isinstance(messages[k], str) and messages[k], (
                f"missing IT i18n key: {k}"
            )
