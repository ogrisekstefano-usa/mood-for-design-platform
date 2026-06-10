"""Review Workspace™ V3 — backend pytest suite (V3.1).

Covers the 4 new endpoints:
  GET  /api/knowledge/catalog-sets/{set_id}/entities/{eid}/future-uses
  GET  /api/knowledge/catalog-sets/{set_id}/entities/{eid}/connected-assets
  GET  /api/knowledge/catalog-sets/{set_id}/entities/{eid}/project-impact
  POST /api/knowledge/catalog-sets/{set_id}/entities/{eid}/apply-correction

Uses the existing RIVA-style catalog set (00e33d7f) seeded in dev.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or \
    "https://i18n-recovery-1.preview.emergentagent.com"

ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASS = "Blueprint2024!"
KNOWN_SET_ID = "00e33d7f-bcc4-47ae-914f-617d049906a7"


@pytest.fixture(scope="session")
def token() -> str:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
        timeout=30,
    )
    if r.status_code != 200:
        pytest.skip(f"login failed: {r.status_code}")
    return ((r.json().get("session") or {}).get("access_token")) or r.json().get("access_token")


@pytest.fixture(scope="session")
def client(token):
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    })
    return s


@pytest.fixture(scope="session")
def entity_id(client):
    r = client.get(f"{BASE_URL}/api/knowledge/catalog-sets/{KNOWN_SET_ID}/entities?limit=1", timeout=30)
    assert r.status_code == 200, r.text[:200]
    ents = r.json().get("entities") or []
    if not ents:
        pytest.skip("no entities in catalog set")
    return ents[0]["id"]


# ── future-uses ─────────────────────────────────────────────────────
def test_future_uses_shape(client, entity_id):
    r = client.get(f"{BASE_URL}/api/knowledge/catalog-sets/{KNOWN_SET_ID}/entities/{entity_id}/future-uses")
    assert r.status_code == 200, r.text[:200]
    body = r.json()
    assert "used_in" in body and "available_for" in body
    assert "total_uses" in body and isinstance(body["total_uses"], int)
    assert body["state"] in ("in_use", "available")
    # all expected asset_types must be in used_in (even at 0)
    for k in ["moodboard", "design_journey", "material_board",
              "client_presentation", "magazine", "social_story",
              "product_selection", "home_staging_pack"]:
        assert k in body["used_in"]
        assert isinstance(body["used_in"][k], int)


def test_future_uses_404_on_bad_entity(client):
    r = client.get(
        f"{BASE_URL}/api/knowledge/catalog-sets/{KNOWN_SET_ID}/entities/"
        f"00000000-0000-0000-0000-000000000000/future-uses"
    )
    assert r.status_code == 404


# ── connected-assets ────────────────────────────────────────────────
def test_connected_assets_shape(client, entity_id):
    r = client.get(f"{BASE_URL}/api/knowledge/catalog-sets/{KNOWN_SET_ID}/entities/{entity_id}/connected-assets")
    assert r.status_code == 200, r.text[:200]
    body = r.json()
    assert "center" in body and "groups" in body and "edges" in body
    assert "counts" in body
    # future-proof groups must all exist (even empty)
    for t in ["PRODUCT", "MATERIAL", "DESIGNER", "IMAGE", "BRAND",
              "COLLECTION", "DOCUMENT", "PROJECT", "MOODBOARD", "JOURNEY"]:
        assert t in body["groups"]
        assert t in body["counts"]
        assert isinstance(body["counts"][t], int)


# ── project-impact (M7 placeholder) ─────────────────────────────────
def test_project_impact_placeholder(client, entity_id):
    r = client.get(f"{BASE_URL}/api/knowledge/catalog-sets/{KNOWN_SET_ID}/entities/{entity_id}/project-impact")
    assert r.status_code == 200, r.text[:200]
    body = r.json()
    assert body.get("is_placeholder") is True
    rows = body.get("rows") or []
    types = {r["project_type"] for r in rows}
    assert types == {"residential", "hospitality", "retail", "office", "home_staging"}
    for row in rows:
        # NO economic KPI in V3.1
        assert row.get("value_aggregate") is None
        assert row["project_count"] == 0


# ── apply-correction (Knowledge Impact) ─────────────────────────────
def test_apply_correction_persists_ledger(client, entity_id):
    payload = {
        "scope": "catalog",
        "source_input": "Walnut",
        "canonical_target": "Noce Canaletto",
        "occurrences_corrected": 12,
        "products_improved": 3,
        "images_linked": 7,
        "future_moodboards_unlocked": 2,
        "materials_consolidated": 1,
    }
    r = client.post(
        f"{BASE_URL}/api/knowledge/catalog-sets/{KNOWN_SET_ID}/entities/{entity_id}/apply-correction",
        json=payload,
    )
    assert r.status_code == 200, r.text[:300]
    body = r.json()
    assert body["ok"] is True
    assert body["scope"] == "catalog"
    imp = body["impact"]
    for k, v in payload.items():
        if k in imp:
            assert imp[k] == v


def test_apply_correction_rejects_bad_scope(client, entity_id):
    r = client.post(
        f"{BASE_URL}/api/knowledge/catalog-sets/{KNOWN_SET_ID}/entities/{entity_id}/apply-correction",
        json={"scope": "everywhere"},
    )
    assert r.status_code == 400
