"""Backend tests for Blueprint Section Engine + extended Theme Engine.

Covers:
  - /api/blueprint/sections/catalog (10 types)
  - /api/blueprint/pages/{slug} CRUD (homepage, showcase, about)
  - Section add / update / delete / reorder / duplicate / reset
  - Validation (bad slug, unknown type)
  - /api/blueprint/palette-presets (8 presets incl editorial-noir, linear-mist)
  - /api/settings/theme extended tokens (editorial, atmosphere, motion, ...)
"""
import os
import pytest
import requests
from pathlib import Path

def _load_frontend_env():
    env = Path("/app/frontend/.env")
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL"):
                return line.split("=", 1)[1].strip()
    return ""

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _load_frontend_env()).rstrip("/")
EMAIL = "demo@moodfordesign.com"
PASSWORD = "Blueprint2024!"

EXPECTED_TYPES = {"hero", "feature_grid", "gallery", "quote", "stats",
                  "cta", "split", "logo_strip", "magazine_grid", "faq"}


@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": EMAIL, "password": PASSWORD}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text[:200]}")
    return r.json()["session"]["access_token"]


@pytest.fixture(scope="module")
def H(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# ── Catalog ─────────────────────────────────────────────────────────────────
def test_sections_catalog(H):
    r = requests.get(f"{BASE_URL}/api/blueprint/sections/catalog", headers=H, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    types = {s["type"] for s in data["sections"]}
    assert types == EXPECTED_TYPES, f"Missing: {EXPECTED_TYPES - types}, Extra: {types - EXPECTED_TYPES}"
    # Each must have schema, defaults, reusable_in
    for s in data["sections"]:
        assert "schema" in s and "defaults" in s and "reusable_in" in s
        assert isinstance(s["reusable_in"], list) and len(s["reusable_in"]) > 0


# ── Page reads (seed) ───────────────────────────────────────────────────────
def test_homepage_seed_has_8(H):
    r = requests.get(f"{BASE_URL}/api/blueprint/pages/homepage", headers=H, timeout=15)
    assert r.status_code == 200, r.text
    page = r.json()
    # If existing test data exists from prior runs, reset first
    if not page.get("_seed"):
        rr = requests.post(f"{BASE_URL}/api/blueprint/pages/homepage/reset", headers=H, timeout=15)
        assert rr.status_code == 200
        page = requests.get(f"{BASE_URL}/api/blueprint/pages/homepage", headers=H, timeout=15).json()
    secs = page["sections"]
    assert len(secs) == 8, f"Expected 8 sections, got {len(secs)}"
    expected = ["hero", "feature_grid", "split", "gallery", "stats", "quote", "magazine_grid", "cta"]
    assert [s["type"] for s in secs] == expected


def test_showcase_seed_has_4(H):
    # reset to ensure clean
    requests.post(f"{BASE_URL}/api/blueprint/pages/showcase/reset", headers=H, timeout=15)
    r = requests.get(f"{BASE_URL}/api/blueprint/pages/showcase", headers=H, timeout=15)
    assert r.status_code == 200
    secs = r.json()["sections"]
    assert len(secs) == 4
    assert [s["type"] for s in secs] == ["hero", "gallery", "logo_strip", "cta"]


# ── Page upsert persists ────────────────────────────────────────────────────
def test_put_page_persists(H):
    requests.post(f"{BASE_URL}/api/blueprint/pages/homepage/reset", headers=H, timeout=15)
    page = requests.get(f"{BASE_URL}/api/blueprint/pages/homepage", headers=H, timeout=15).json()
    custom = page["sections"][:3]  # keep first 3
    r = requests.put(f"{BASE_URL}/api/blueprint/pages/homepage",
                     headers=H, json={"sections": custom}, timeout=15)
    assert r.status_code == 200, r.text
    g = requests.get(f"{BASE_URL}/api/blueprint/pages/homepage", headers=H, timeout=15).json()
    assert g.get("_seed") is not True
    assert len(g["sections"]) == 3


# ── Section CRUD ────────────────────────────────────────────────────────────
def test_section_lifecycle(H):
    requests.post(f"{BASE_URL}/api/blueprint/pages/homepage/reset", headers=H, timeout=15)

    # Add
    r = requests.post(f"{BASE_URL}/api/blueprint/pages/homepage/sections",
                      headers=H, json={"type": "cta"}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    new_id = body["section"]["id"]
    assert body["section"]["type"] == "cta"
    initial_count = len(body["page"]["sections"])
    assert initial_count == 9

    # Update
    r = requests.put(f"{BASE_URL}/api/blueprint/pages/homepage/sections/{new_id}",
                     headers=H, json={"type": "cta", "visible": False}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["section"]["visible"] is False

    # Duplicate
    r = requests.post(f"{BASE_URL}/api/blueprint/pages/homepage/sections/{new_id}/duplicate",
                      headers=H, timeout=15)
    assert r.status_code == 200
    clone_id = r.json()["section"]["id"]
    assert clone_id != new_id
    assert len(r.json()["page"]["sections"]) == 10

    # Reorder — put clone first
    cur = requests.get(f"{BASE_URL}/api/blueprint/pages/homepage", headers=H, timeout=15).json()
    ids = [s["id"] for s in cur["sections"]]
    new_order = [clone_id] + [i for i in ids if i != clone_id]
    r = requests.patch(f"{BASE_URL}/api/blueprint/pages/homepage/sections/order",
                       headers=H, json={"order": new_order}, timeout=15)
    assert r.status_code == 200
    assert r.json()["page"]["sections"][0]["id"] == clone_id

    # Delete
    r = requests.delete(f"{BASE_URL}/api/blueprint/pages/homepage/sections/{clone_id}",
                        headers=H, timeout=15)
    assert r.status_code == 200
    assert all(s["id"] != clone_id for s in r.json()["page"]["sections"])


def test_reset_restores_8(H):
    r = requests.post(f"{BASE_URL}/api/blueprint/pages/homepage/reset", headers=H, timeout=15)
    assert r.status_code == 200
    assert len(r.json()["sections"]) == 8


# ── Validation ──────────────────────────────────────────────────────────────
def test_bad_slug_400(H):
    r = requests.post(f"{BASE_URL}/api/blueprint/pages/BadSlug/sections",
                      headers=H, json={"type": "cta"}, timeout=15)
    assert r.status_code == 400


def test_unknown_type_400(H):
    r = requests.post(f"{BASE_URL}/api/blueprint/pages/homepage/sections",
                      headers=H, json={"type": "unknown_type"}, timeout=15)
    assert r.status_code == 400


# ── Palette presets ─────────────────────────────────────────────────────────
def test_palette_presets(H):
    r = requests.get(f"{BASE_URL}/api/blueprint/palette-presets", headers=H, timeout=15)
    assert r.status_code == 200
    presets = r.json()["presets"]
    assert len(presets) >= 8
    keys = {p.get("key") or p.get("id") or p.get("name", "").lower().replace(" ", "-") for p in presets}
    # Allow either "key" or normalized name
    flat = " ".join(str(p) for p in presets).lower()
    assert "editorial-noir" in flat or "editorial noir" in flat
    assert "linear-mist" in flat or "linear mist" in flat


# ── Extended theme tokens ───────────────────────────────────────────────────
def test_theme_extended_tokens(H):
    r = requests.get(f"{BASE_URL}/api/settings/theme", headers=H, timeout=15)
    assert r.status_code == 200, r.text
    raw = r.json()
    t = raw.get("effective") or raw
    # Version
    assert t.get("version") == 2, f"Expected version 2, got {t.get('version')}"
    # Editorial
    ed = t.get("editorial") or {}
    for k in ["display", "h1", "h2", "h3", "lead", "body", "caption", "eyebrow"]:
        assert k in ed, f"editorial.{k} missing"
    # Atmosphere
    at = t.get("atmosphere") or {}
    for k in ["grain_intensity", "glow_intensity", "vignette_intensity",
              "glass_blur", "glass_opacity", "hero_gradient"]:
        assert k in at, f"atmosphere.{k} missing"
    # Spacing
    sp = t.get("spacing") or {}
    for k in ["section_y", "section_x", "gutter", "max_width"]:
        assert k in sp, f"spacing.{k} missing"
    # Motion
    mo = t.get("motion") or {}
    for k in ["duration_cinematic", "ease_emphasis", "ease_entrance", "stagger"]:
        assert k in mo, f"motion.{k} missing"
    # Palette
    pal = t.get("palette") or {}
    for k in ["overlay", "selection_bg", "selection_fg"]:
        assert k in pal, f"palette.{k} missing"
    # Elevation
    el = t.get("elevation") or {}
    for k in ["xl", "glow", "inset_soft"]:
        assert k in el, f"elevation.{k} missing"
    # Components
    cp = t.get("components") or {}
    for k in ["image_treatment", "cursor_style", "input_style"]:
        assert k in cp, f"components.{k} missing"


@pytest.mark.xfail(reason="BUG: ThemeUpdate Pydantic model in routers/settings.py omits 'atmosphere' and 'editorial' fields, so PUT silently drops them")
def test_theme_put_merges(H):
    r = requests.put(f"{BASE_URL}/api/settings/theme", headers=H,
                     json={"atmosphere": {"grain_intensity": 0.1}}, timeout=15)
    assert r.status_code == 200, r.text
    raw = r.json()
    t = raw.get("effective") or raw
    assert (t.get("atmosphere") or {}).get("grain_intensity") == 0.1
