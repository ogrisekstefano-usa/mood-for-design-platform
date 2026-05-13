"""
Phase P0 — Moodboard Core Stabilization — backend regression.

Covers (per review_request):
  1) BlockUpdate accepts `metadata` field
  2) batch_update_blocks merges metadata_json
  3) GET /api/moodboards/{id} response includes `metadata` field per element
     (hydrated from metadata_json)
  4) Persistence of style.border_radius + style.shadow_preset across batch update
  5) Adjustments persistence regression (E.5)
  6) i18n EN+IT new keys:
     - moodboards.field.borderRadius / shadow
     - moodboards.shadow.none / soft / medium / dramatic
     - moodboards.editor.visualProps / saveFailedHint / retry
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
DESIGNER = {"email": "designer@moodfordesign.com", "password": "Designer2024!"}
STUDIO2  = {"email": "studio2@moodfordesign.com", "password": "Studio2024!"}


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
def designer_client():
    return _login(DESIGNER)


@pytest.fixture(scope="module")
def studio2_client():
    return _login(STUDIO2)


@pytest.fixture(scope="module")
def moodboard_id(designer_client):
    payload = {"title": f"TEST_P0_{uuid.uuid4().hex[:8]}"}
    r = designer_client.post(f"{BASE_URL}/api/moodboards", json=payload, timeout=20)
    assert r.status_code in (200, 201), f"create mb: {r.status_code} {r.text[:200]}"
    mb_id = r.json().get("id")
    assert mb_id
    yield mb_id
    designer_client.delete(f"{BASE_URL}/api/moodboards/{mb_id}", timeout=20)


# ─── i18n keys (P0 additions) ─────────────────────────────────────────────────
class TestI18nP0:
    def _get_messages(self, client, locale):
        r = client.get(f"{BASE_URL}/api/blueprint/i18n/{locale}", timeout=20)
        if r.status_code != 200 and locale == "en-US":
            r = client.get(f"{BASE_URL}/api/blueprint/i18n/en", timeout=20)
        assert r.status_code == 200, f"i18n {locale}: {r.status_code} {r.text[:200]}"
        body = r.json()
        return body.get("messages") or body.get("strings") or {}

    def test_it_keys_present(self, designer_client):
        m = self._get_messages(designer_client, "it")
        # New P0 keys
        assert m.get("moodboards.field.borderRadius") == "Arrotondamento"
        assert m.get("moodboards.field.shadow") == "Ombra"
        assert m.get("moodboards.shadow.none") == "Nessuna"
        assert m.get("moodboards.shadow.soft") == "Soffice"
        assert m.get("moodboards.shadow.medium") == "Media"
        assert m.get("moodboards.shadow.dramatic") == "Drammatica"
        assert m.get("moodboards.editor.visualProps") == "Blocco"
        assert m.get("moodboards.editor.saveFailedHint")
        assert m.get("moodboards.editor.retry")

    def test_en_keys_present(self, designer_client):
        m = self._get_messages(designer_client, "en-US")
        assert m.get("moodboards.field.borderRadius") == "Corner radius"
        assert m.get("moodboards.field.shadow") == "Shadow"
        assert m.get("moodboards.shadow.none") == "None"
        assert m.get("moodboards.shadow.soft") == "Soft"
        assert m.get("moodboards.shadow.medium") == "Medium"
        assert m.get("moodboards.shadow.dramatic") == "Dramatic"
        assert m.get("moodboards.editor.visualProps") == "Block"
        assert m.get("moodboards.editor.saveFailedHint")
        assert m.get("moodboards.editor.retry")


# ─── Metadata persistence via batch update ────────────────────────────────────
class TestBlockMetadataPersistence:
    def test_batch_update_persists_metadata_json(self, designer_client, moodboard_id):
        # Create image block
        r = designer_client.post(
            f"{BASE_URL}/api/moodboards/{moodboard_id}/blocks",
            json={
                "type": "image",
                "x": 50, "y": 50, "width": 320, "height": 240,
                "content": {"src": "https://example.com/initial.jpg"},
                "style": {"fit_mode": "cover"},
            },
            timeout=20,
        )
        assert r.status_code in (200, 201), f"create: {r.status_code} {r.text[:200]}"
        bid = r.json()["id"]

        meta = {
            "upload_source": "user_upload",
            "original_dimensions": {"width": 1920, "height": 1080},
            "media_id": "media-abc-123",
            "storage_path": "moodboards/test-1234.jpg",
            "file_name": "test.jpg",
            "uploaded_at": "2026-01-15T10:00:00Z",
        }

        # Batch PATCH with metadata field
        patch = {"blocks": [{
            "id": bid, "x": 50, "y": 50, "width": 320, "height": 240,
            "content": {"src": "https://example.com/uploaded.jpg"},
            "style": {"fit_mode": "cover", "border_radius": 12, "shadow_preset": "medium"},
            "metadata": meta,
        }]}
        r2 = designer_client.patch(
            f"{BASE_URL}/api/moodboards/{moodboard_id}/blocks/batch",
            json=patch, timeout=20,
        )
        assert r2.status_code in (200, 204), f"batch: {r2.status_code} {r2.text[:300]}"

        # GET → metadata hydrated
        r3 = designer_client.get(f"{BASE_URL}/api/moodboards/{moodboard_id}", timeout=20)
        assert r3.status_code == 200
        elements = r3.json().get("elements") or []
        target = next((b for b in elements if b["id"] == bid), None)
        assert target, "block not found"

        # ASSERTION 1: metadata field exposed on element
        assert "metadata" in target, f"GET response missing metadata field. Keys: {list(target.keys())}"
        m = target["metadata"] or {}
        # ASSERTION 2: provenance values persisted
        assert m.get("upload_source") == "user_upload"
        assert m.get("original_dimensions") == {"width": 1920, "height": 1080}
        assert m.get("media_id") == "media-abc-123"
        assert m.get("storage_path") == "moodboards/test-1234.jpg"
        assert m.get("file_name") == "test.jpg"
        # ASSERTION 3: borderRadius + shadow persisted in style
        s = target.get("style") or {}
        assert s.get("border_radius") == 12, f"border_radius not persisted: {s}"
        assert s.get("shadow_preset") == "medium", f"shadow_preset not persisted: {s}"
        # ASSERTION 4: src updated in content
        assert (target.get("content") or {}).get("src") == "https://example.com/uploaded.jpg"

    def test_metadata_merges_not_replaces(self, designer_client, moodboard_id):
        """Second PATCH with partial metadata should merge with existing keys."""
        r = designer_client.post(
            f"{BASE_URL}/api/moodboards/{moodboard_id}/blocks",
            json={
                "type": "image", "x": 10, "y": 10, "width": 200, "height": 150,
                "content": {"src": "https://example.com/a.jpg"},
            },
            timeout=20,
        )
        assert r.status_code in (200, 201)
        bid = r.json()["id"]

        # First patch — full metadata
        designer_client.patch(
            f"{BASE_URL}/api/moodboards/{moodboard_id}/blocks/batch",
            json={"blocks": [{
                "id": bid, "x": 10, "y": 10, "width": 200, "height": 150,
                "content": {"src": "https://example.com/a.jpg"},
                "metadata": {"upload_source": "user_upload", "media_id": "m-1", "file_name": "a.jpg"},
            }]}, timeout=20,
        )

        # Second patch — only update file_name; upload_source + media_id must survive
        designer_client.patch(
            f"{BASE_URL}/api/moodboards/{moodboard_id}/blocks/batch",
            json={"blocks": [{
                "id": bid, "x": 10, "y": 10, "width": 200, "height": 150,
                "content": {"src": "https://example.com/a.jpg"},
                "metadata": {"file_name": "renamed.jpg"},
            }]}, timeout=20,
        )

        mb = designer_client.get(f"{BASE_URL}/api/moodboards/{moodboard_id}", timeout=20).json()
        target = next((b for b in (mb.get("elements") or []) if b["id"] == bid), None)
        m = (target.get("metadata") or {})
        # Merge behavior expected
        assert m.get("file_name") == "renamed.jpg", f"file_name not updated: {m}"
        assert m.get("upload_source") == "user_upload", f"upload_source wiped on partial patch: {m}"
        assert m.get("media_id") == "m-1", f"media_id wiped on partial patch: {m}"


# ─── Visual props persistence (border_radius + shadow_preset + adjustments) ───
class TestVisualPropsPersistence:
    def test_border_radius_and_shadow_persist(self, designer_client, moodboard_id):
        r = designer_client.post(
            f"{BASE_URL}/api/moodboards/{moodboard_id}/blocks",
            json={"type": "image", "x": 20, "y": 20, "width": 200, "height": 150,
                  "content": {"src": "https://example.com/v.jpg"}},
            timeout=20,
        )
        bid = r.json()["id"]

        patch = {"blocks": [{
            "id": bid, "x": 20, "y": 20, "width": 200, "height": 150,
            "content": {"src": "https://example.com/v.jpg"},
            "style": {
                "fit_mode": "cover",
                "border_radius": 24,
                "shadow_preset": "dramatic",
                "adjustments": {"brightness": 1.2},
            },
        }]}
        r2 = designer_client.patch(
            f"{BASE_URL}/api/moodboards/{moodboard_id}/blocks/batch",
            json=patch, timeout=20,
        )
        assert r2.status_code in (200, 204)

        mb = designer_client.get(f"{BASE_URL}/api/moodboards/{moodboard_id}", timeout=20).json()
        target = next((b for b in (mb.get("elements") or []) if b["id"] == bid), None)
        s = target.get("style") or {}
        assert s.get("border_radius") == 24
        assert s.get("shadow_preset") == "dramatic"
        assert (s.get("adjustments") or {}).get("brightness") == 1.2

    def test_opacity_rotation_top_level_persist(self, designer_client, moodboard_id):
        """Per P0 fix — opacity and rotation are top-level columns, not style."""
        r = designer_client.post(
            f"{BASE_URL}/api/moodboards/{moodboard_id}/blocks",
            json={"type": "image", "x": 30, "y": 30, "width": 200, "height": 150,
                  "content": {"src": "https://example.com/o.jpg"}},
            timeout=20,
        )
        bid = r.json()["id"]

        # Batch PATCH with top-level opacity/rotation (autosave path)
        r2 = designer_client.patch(
            f"{BASE_URL}/api/moodboards/{moodboard_id}/blocks/batch",
            json={"blocks": [{
                "id": bid, "x": 30, "y": 30, "width": 200, "height": 150,
                "content": {"src": "https://example.com/o.jpg"},
                "opacity": 0.6, "rotation": 15.5,
            }]},
            timeout=20,
        )
        assert r2.status_code in (200, 204), f"batch update: {r2.status_code} {r2.text[:200]}"

        mb = designer_client.get(f"{BASE_URL}/api/moodboards/{moodboard_id}", timeout=20).json()
        target = next((b for b in (mb.get("elements") or []) if b["id"] == bid), None)
        assert target is not None
        # Opacity / rotation surfaced top-level
        assert abs((target.get("opacity") or 0) - 0.6) < 1e-6, f"opacity not persisted: {target.get('opacity')}"
        assert abs((target.get("rotation") or 0) - 15.5) < 1e-6, f"rotation not persisted: {target.get('rotation')}"


# ─── Cross-tenant isolation regression ────────────────────────────────────────
class TestCrossTenantIsolation:
    def test_studio2_cannot_read_designer_moodboard(self, studio2_client, moodboard_id):
        r = studio2_client.get(f"{BASE_URL}/api/moodboards/{moodboard_id}", timeout=20)
        assert r.status_code in (403, 404), \
            f"cross-tenant leak: studio2 got {r.status_code} for designer's mb"


# ─── Regression: prior phase persistence ──────────────────────────────────────
class TestRegression:
    def test_list_moodboards(self, designer_client):
        r = designer_client.get(f"{BASE_URL}/api/moodboards", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, (list, dict))

    def test_templates_preview(self, designer_client):
        r = designer_client.get(f"{BASE_URL}/api/templates?with_preview=true", timeout=20)
        assert r.status_code == 200
        items = r.json().get("data") or r.json().get("items") or r.json()
        assert isinstance(items, list) and len(items) > 0
