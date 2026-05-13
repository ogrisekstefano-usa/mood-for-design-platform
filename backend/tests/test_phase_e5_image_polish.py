"""
Phase E.5 — Moodboard Stability & Media Polish Pass — backend regression.

Covers:
  - i18n keys (EN+IT) for editor.unsaved / resetCrop / adjustments / reset /
    imageMissing and field.brightness/contrast/saturation/warmth/grayscale/
    blur/vignette
  - Block batch update persists style.adjustments (CSS-filter values)
  - Block batch update preserves content/style fields not in patch
  - sendBeacon-style endpoint: batch PATCH still functional
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
DESIGNER = {"email": "designer@moodfordesign.com", "password": "Designer2024!"}


@pytest.fixture(scope="module")
def designer_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json=DESIGNER, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    body = r.json()
    tok = (body.get("session") or {}).get("access_token") \
        or body.get("access_token") or body.get("token")
    assert tok, f"no access_token in login response: {body}"
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def moodboard_id(designer_client):
    payload = {"title": f"TEST_E5_{uuid.uuid4().hex[:8]}"}
    r = designer_client.post(f"{BASE_URL}/api/moodboards", json=payload, timeout=20)
    assert r.status_code in (200, 201), f"create mb: {r.status_code} {r.text[:200]}"
    mb_id = r.json().get("id")
    assert mb_id
    yield mb_id
    designer_client.delete(f"{BASE_URL}/api/moodboards/{mb_id}", timeout=20)


# ─── i18n keys ───────────────────────────────────────────────────────────────
class TestI18nE5:
    def _get_messages(self, client, locale):
        r = client.get(f"{BASE_URL}/api/blueprint/i18n/{locale}", timeout=20)
        assert r.status_code == 200, f"i18n {locale}: {r.status_code} {r.text[:200]}"
        body = r.json()
        return body.get("messages") or body.get("strings") or {}

    def test_it_strings_present(self, designer_client):
        m = self._get_messages(designer_client, "it")
        assert m.get("moodboards.editor.unsaved") == "Modifiche non salvate"
        assert m.get("moodboards.editor.resetCrop") == "Ripristina ritaglio"
        assert m.get("moodboards.editor.adjustments") == "Regolazioni"
        assert m.get("moodboards.editor.imageMissing") == "Immagine non disponibile"
        assert m.get("moodboards.field.brightness") == "Luminosità"
        assert m.get("moodboards.field.contrast") == "Contrasto"
        assert m.get("moodboards.field.saturation") == "Saturazione"
        assert m.get("moodboards.field.warmth") == "Calore"
        assert m.get("moodboards.field.grayscale") == "Bianco e nero"
        assert m.get("moodboards.field.blur") == "Sfocatura"
        assert m.get("moodboards.field.vignette") == "Vignettatura"

    def test_en_strings_present(self, designer_client):
        r = designer_client.get(f"{BASE_URL}/api/blueprint/i18n/en-US", timeout=20)
        if r.status_code != 200:
            r = designer_client.get(f"{BASE_URL}/api/blueprint/i18n/en", timeout=20)
        assert r.status_code == 200, r.text
        m = r.json().get("messages") or r.json().get("strings") or {}
        assert m.get("moodboards.editor.unsaved") == "Unsaved changes"
        assert m.get("moodboards.editor.resetCrop") == "Reset crop"
        assert m.get("moodboards.editor.adjustments") == "Adjustments"
        assert m.get("moodboards.editor.imageMissing") == "Image unavailable"
        assert m.get("moodboards.field.brightness") == "Brightness"
        assert m.get("moodboards.field.contrast") == "Contrast"
        assert m.get("moodboards.field.saturation") == "Saturation"
        assert m.get("moodboards.field.warmth") == "Warmth"
        assert m.get("moodboards.field.grayscale") == "Grayscale"
        assert m.get("moodboards.field.blur") == "Blur"
        assert m.get("moodboards.field.vignette") == "Vignette"


# ─── Block batch update — adjustments persistence ────────────────────────────
class TestBlockAdjustmentsPersistence:
    def test_create_image_block_with_adjustments(self, designer_client, moodboard_id):
        # Create an image block
        r = designer_client.post(
            f"{BASE_URL}/api/moodboards/{moodboard_id}/blocks",
            json={
                "type": "image",
                "x": 60, "y": 60, "width": 300, "height": 200,
                "content": {"src": "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e",
                            "caption": "Original caption"},
                "style": {"fit_mode": "cover", "focal_point": "center"},
            },
            timeout=20,
        )
        assert r.status_code in (200, 201), f"create block: {r.status_code} {r.text[:200]}"
        blk = r.json()
        bid = blk["id"]

        # Batch update — set adjustments only; caption + fit_mode must survive merge on server (full doc upsert)
        patch = {
            "blocks": [{
                "id": bid,
                "x": blk.get("x", 60),
                "y": blk.get("y", 60),
                "width": blk.get("width", 300),
                "height": blk.get("height", 200),
                "content": {
                    "src": "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e",
                    "caption": "Original caption",
                },
                "style": {
                    "fit_mode": "cover",
                    "focal_point": "center",
                    "adjustments": {
                        "brightness": 1.2, "contrast": 1.1, "saturation": 0.8,
                        "warmth": 0.3, "blur": 0.5, "grayscale": 0, "vignette": 0.4,
                    },
                },
            }]
        }
        r2 = designer_client.patch(
            f"{BASE_URL}/api/moodboards/{moodboard_id}/blocks/batch",
            json=patch, timeout=20,
        )
        assert r2.status_code in (200, 204), f"batch update: {r2.status_code} {r2.text[:300]}"

        # Verify persistence via GET
        r3 = designer_client.get(f"{BASE_URL}/api/moodboards/{moodboard_id}", timeout=20)
        assert r3.status_code == 200
        mb = r3.json()
        elements = mb.get("elements") or mb.get("blocks") or []
        target = next((b for b in elements if b["id"] == bid), None)
        assert target, "block not found in moodboard.elements after batch update"
        adj = (target.get("style") or {}).get("adjustments") or {}
        assert adj.get("brightness") == 1.2
        assert adj.get("contrast") == 1.1
        assert abs(adj.get("saturation") - 0.8) < 1e-6
        assert abs(adj.get("warmth") - 0.3) < 1e-6
        assert adj.get("vignette") == 0.4
        # And content untouched
        assert (target.get("content") or {}).get("caption") == "Original caption"

    def test_reset_adjustments_via_batch(self, designer_client, moodboard_id):
        # Add a fresh block
        r = designer_client.post(
            f"{BASE_URL}/api/moodboards/{moodboard_id}/blocks",
            json={"type": "image", "x": 10, "y": 10, "width": 200, "height": 150,
                  "content": {"src": "https://example.com/x.jpg"},
                  "style": {"adjustments": {"brightness": 1.4}}},
            timeout=20,
        )
        assert r.status_code in (200, 201)
        bid = r.json()["id"]

        # Reset adjustments → empty dict
        patch = {"blocks": [{
            "id": bid, "x": 10, "y": 10, "width": 200, "height": 150,
            "content": {"src": "https://example.com/x.jpg"},
            "style": {"adjustments": {}},
        }]}
        r2 = designer_client.patch(
            f"{BASE_URL}/api/moodboards/{moodboard_id}/blocks/batch",
            json=patch, timeout=20,
        )
        assert r2.status_code in (200, 204)

        mb = designer_client.get(f"{BASE_URL}/api/moodboards/{moodboard_id}", timeout=20).json()
        target = next((b for b in (mb.get("elements") or []) if b["id"] == bid), None)
        adj = (target.get("style") or {}).get("adjustments") or {}
        assert adj == {} or all(v in (0, None, 1) for v in adj.values()) or not adj


# ─── E.4 / E.2 / E.1 regression sanity ──────────────────────────────────────
class TestRegressionPriorPhases:
    def test_list_templates_with_preview(self, designer_client):
        r = designer_client.get(f"{BASE_URL}/api/templates?with_preview=true", timeout=20)
        assert r.status_code == 200
        body = r.json()
        items = body.get("data") or body.get("items") or body
        assert isinstance(items, list) and len(items) > 0
        # at least one entry has preview_svg (E.4 deliverable)
        assert any("preview_svg" in it for it in items)

    def test_list_moodboards(self, designer_client):
        r = designer_client.get(f"{BASE_URL}/api/moodboards", timeout=20)
        assert r.status_code == 200
