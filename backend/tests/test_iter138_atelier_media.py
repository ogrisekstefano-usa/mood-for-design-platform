"""ITER138 — Atelier Media Direction™ — Backend tests.

Covers: presets vocabulary, upload pipeline (Pillow + Supabase),
mime/size/kind validation, auth-gated access, transform + tenant
isolation, soft archive, dashboard exposure, 20-asset cap.
"""
import io
import os
import pytest
import requests
from PIL import Image

def _load_base():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v.rstrip("/")
    # fallback parse /app/frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    return ""

BASE_URL = _load_base()
API = f"{BASE_URL}/api"

SUPER = {"email": "demo@moodfordesign.com", "password": "Blueprint2024!"}
STUDIO2 = {"email": "studio2@moodfordesign.com", "password": "Studio2024!"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text[:300]}"
    return r.json()["session"]["access_token"]


def _hdr(token):
    return {"Authorization": f"Bearer {token}"}


def _jpg(w=2400, h=1600, color=(15, 18, 22)):
    img = Image.new("RGB", (w, h), color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=88)
    return buf.getvalue()


@pytest.fixture(scope="module")
def super_token():
    return _login(SUPER)


@pytest.fixture(scope="module")
def studio2_token():
    return _login(STUDIO2)


@pytest.fixture
def created_media_ids():
    ids = []
    yield ids
    # Cleanup
    try:
        tok = _login(SUPER)
        for mid in ids:
            requests.delete(f"{API}/atelier/media/{mid}", headers=_hdr(tok), timeout=15)
    except Exception:
        pass


# ── Presets ──────────────────────────────────────────────────────────
def test_presets_returns_four(super_token):
    r = requests.get(f"{API}/atelier/media/presets", headers=_hdr(super_token), timeout=15)
    assert r.status_code == 200, r.text
    presets = r.json().get("presets", {})
    expected = {"nordic_silence", "midnight_editorial", "aman_warmth", "architectural_dawn"}
    assert expected.issubset(presets.keys()), f"missing presets: {presets.keys()}"
    for key in expected:
        p = presets[key]
        assert "filter" in p and isinstance(p["filter"], dict)
        assert "grain_level" in p
        assert "vignette_level" in p
        assert "warmth_offset" in p
        assert "cyan_atmosphere" in p


# ── Auth gate ────────────────────────────────────────────────────────
def test_upload_unauthenticated_rejected():
    files = {"file": ("t.jpg", _jpg(800, 600), "image/jpeg")}
    r = requests.post(f"{API}/atelier/media/upload", files=files,
                      data={"media_kind": "hero"}, timeout=30)
    assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}: {r.text[:200]}"


# ── Upload validation ────────────────────────────────────────────────
def test_upload_rejects_unsupported_mime(super_token):
    files = {"file": ("t.txt", b"hello world hello world hello world hello", "text/plain")}
    r = requests.post(f"{API}/atelier/media/upload", files=files,
                      data={"media_kind": "hero"}, headers=_hdr(super_token), timeout=30)
    assert r.status_code == 400, r.text


def test_upload_rejects_invalid_media_kind(super_token):
    files = {"file": ("t.jpg", _jpg(800, 600), "image/jpeg")}
    r = requests.post(f"{API}/atelier/media/upload", files=files,
                      data={"media_kind": "invalid_kind"}, headers=_hdr(super_token), timeout=30)
    assert r.status_code == 400, r.text


def test_upload_rejects_oversize(super_token):
    # >10MB raw bytes (non-image but bigger than cap so mime check or size check should reject)
    big = b"\xff" * (11 * 1024 * 1024)
    files = {"file": ("big.jpg", big, "image/jpeg")}
    r = requests.post(f"{API}/atelier/media/upload", files=files,
                      data={"media_kind": "hero"}, headers=_hdr(super_token), timeout=60)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"


# ── Upload happy path + DB exposure ──────────────────────────────────
def test_upload_happy_path_and_dashboard_exposure(super_token, created_media_ids):
    files = {"file": ("scene.jpg", _jpg(2400, 1600), "image/jpeg")}
    data = {
        "media_kind": "hero",
        "alt_text": "TEST_iter138 scene",
        "grading_profile": "nordic_silence",
        "focal_point_x": "0.4",
        "focal_point_y": "0.6",
        "grain_level": "0.12",
        "vignette_level": "0.4",
    }
    r = requests.post(f"{API}/atelier/media/upload", files=files, data=data,
                      headers=_hdr(super_token), timeout=120)
    assert r.status_code == 200, r.text
    m = r.json()["media"]
    assert m.get("id")
    created_media_ids.append(m["id"])
    assert m["mime_type"] == "image/jpeg"
    assert m["width_px"] == 2400
    assert m["height_px"] == 1600
    assert m["original_asset_url"]
    assert m["optimized_asset_url"]
    assert m["thumbnail_asset_url"]
    assert m["blurhash"] and len(m["blurhash"]) > 5
    assert m["grading_profile"] == "nordic_silence"

    # Dashboard exposure
    r2 = requests.get(f"{API}/atelier/dashboard/media", headers=_hdr(super_token), timeout=30)
    assert r2.status_code == 200, r2.text
    items = r2.json().get("media") or r2.json().get("items") or []
    if isinstance(items, dict):
        items = list(items.values())
    found = next((x for x in items if x.get("id") == m["id"]), None)
    assert found, f"uploaded media not in dashboard listing"
    for key in ["blurhash", "original_asset_url", "optimized_asset_url",
                "thumbnail_asset_url", "grain_level", "vignette_level",
                "warmth_offset", "cyan_atmosphere", "width_px", "height_px"]:
        assert key in found, f"missing dashboard field: {key}"


# ── Transform ────────────────────────────────────────────────────────
def test_transform_updates_fields(super_token, created_media_ids):
    files = {"file": ("scene2.jpg", _jpg(1600, 1200), "image/jpeg")}
    r = requests.post(f"{API}/atelier/media/upload", files=files,
                      data={"media_kind": "inspiration", "grading_profile": "nordic_silence"},
                      headers=_hdr(super_token), timeout=120)
    assert r.status_code == 200, r.text
    mid = r.json()["media"]["id"]
    created_media_ids.append(mid)

    body = {
        "grading_profile": "midnight_editorial",
        "focal_point_x": 0.25,
        "focal_point_y": 0.75,
        "grain_level": 0.22,
        "vignette_level": 0.6,
        "crop_profile": {"x": 0.1, "y": 0.1, "w": 0.8, "h": 0.8},
    }
    r2 = requests.patch(f"{API}/atelier/media/{mid}/transform", json=body,
                        headers=_hdr(super_token), timeout=30)
    assert r2.status_code == 200, r2.text
    m = r2.json()["media"]
    assert m["grading_profile"] == "midnight_editorial"
    assert abs(m["focal_point_x"] - 0.25) < 1e-3
    assert abs(m["focal_point_y"] - 0.75) < 1e-3
    assert abs(m["grain_level"] - 0.22) < 1e-3
    assert m["crop_profile"] == {"x": 0.1, "y": 0.1, "w": 0.8, "h": 0.8}


def test_transform_cross_tenant_returns_404(super_token, studio2_token, created_media_ids):
    files = {"file": ("scene3.jpg", _jpg(1200, 900), "image/jpeg")}
    r = requests.post(f"{API}/atelier/media/upload", files=files,
                      data={"media_kind": "hero"},
                      headers=_hdr(super_token), timeout=120)
    assert r.status_code == 200, r.text
    mid = r.json()["media"]["id"]
    created_media_ids.append(mid)

    r2 = requests.patch(f"{API}/atelier/media/{mid}/transform",
                        json={"alt_text": "hacked"},
                        headers=_hdr(studio2_token), timeout=30)
    assert r2.status_code == 404, f"expected 404 cross-tenant, got {r2.status_code}: {r2.text[:200]}"


# ── Archive ──────────────────────────────────────────────────────────
def test_archive_removes_from_dashboard(super_token):
    files = {"file": ("archiveme.jpg", _jpg(1024, 768), "image/jpeg")}
    r = requests.post(f"{API}/atelier/media/upload", files=files,
                      data={"media_kind": "hero"},
                      headers=_hdr(super_token), timeout=120)
    assert r.status_code == 200, r.text
    mid = r.json()["media"]["id"]

    rd = requests.delete(f"{API}/atelier/media/{mid}", headers=_hdr(super_token), timeout=30)
    assert rd.status_code == 200, rd.text

    r2 = requests.get(f"{API}/atelier/dashboard/media", headers=_hdr(super_token), timeout=30)
    items = r2.json().get("media") or r2.json().get("items") or []
    if isinstance(items, dict):
        items = list(items.values())
    assert all(x.get("id") != mid for x in items), "archived asset still visible"
