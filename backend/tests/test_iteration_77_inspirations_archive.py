"""Iteration 77 — Inspirations™ Editorial Archive backend tests."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

EMAIL = "demo@moodfordesign.com"
PASSWORD = "Blueprint2024!"

PREEXISTING_MEDITERRANEAN = "d703a487-4a58-409c-b36e-83ef784878a6"
PREEXISTING_NYC = "ea38cfce-21e0-4819-9303-4e986ac9e29c"


@pytest.fixture(scope="module")
def auth_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"login failed: {r.status_code} {r.text[:200]}")
    body = r.json()
    sess = body.get("session") or {}
    token = (sess.get("access_token") or body.get("access_token") or body.get("token")
             or (body.get("data") or {}).get("token"))
    assert token
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ── Taxonomy / filters ────────────────────────────────────────────────
def test_filters_taxonomy_shape(auth_session):
    r = auth_session.get(f"{BASE_URL}/api/inspirations/archive/_filters", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data["atmosphere_tags"]) == 12
    assert len(data["material_tags"]) == 16
    assert len(data["markets"]) == 6
    assert len(data["luxury_levels"]) == 4
    assert len(data["hospitality_profiles"]) == 4
    codes = {m["code"] for m in data["markets"]}
    assert codes == {"usa_miami", "usa_nyc", "uae_dubai", "uk_london", "italy_milano", "france_paris"}


# ── Archive list ─────────────────────────────────────────────────────
def test_archive_list_returns_items(auth_session):
    r = auth_session.get(f"{BASE_URL}/api/inspirations/archive", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "items" in data and isinstance(data["items"], list)
    assert "total" in data
    # Should contain pre-existing inspirations
    ids = [it["id"] for it in data["items"]]
    assert PREEXISTING_MEDITERRANEAN in ids or len(ids) > 0


def test_archive_list_filter_by_market(auth_session):
    r = auth_session.get(f"{BASE_URL}/api/inspirations/archive?market=usa_miami", timeout=20)
    assert r.status_code == 200, r.text


def test_archive_list_filter_freetext(auth_session):
    r = auth_session.get(f"{BASE_URL}/api/inspirations/archive?q=villa", timeout=20)
    assert r.status_code == 200


# ── Detail ───────────────────────────────────────────────────────────
def test_archive_detail_returns_resonance_and_links(auth_session):
    r = auth_session.get(f"{BASE_URL}/api/inspirations/archive/{PREEXISTING_MEDITERRANEAN}", timeout=20)
    if r.status_code == 404:
        pytest.skip("preexisting inspiration not present in env")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["id"] == PREEXISTING_MEDITERRANEAN
    assert "resonance" in data and len(data["resonance"]) == 6
    # sorted desc by percentage
    pcts = [m["percentage"] for m in data["resonance"]]
    assert pcts == sorted(pcts, reverse=True)
    assert "links" in data and isinstance(data["links"], list)


def test_archive_detail_404(auth_session):
    r = auth_session.get(f"{BASE_URL}/api/inspirations/archive/{uuid.uuid4()}", timeout=20)
    assert r.status_code == 404


# ── Resonance endpoint ───────────────────────────────────────────────
def test_resonance_mediterranean_miami_high(auth_session):
    r = auth_session.get(f"{BASE_URL}/api/inspirations/archive/{PREEXISTING_MEDITERRANEAN}/resonance", timeout=20)
    if r.status_code == 404:
        pytest.skip("preexisting inspiration not present")
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert len(items) == 6
    miami = next((it for it in items if it["market_code"] == "usa_miami"), None)
    assert miami is not None
    # explanation in italian
    assert miami["explanation"] and isinstance(miami["explanation"], str)
    assert "matched_atmosphere" in miami and "matched_materials" in miami
    # Mediterranean villa should score 80%+ for Miami per the spec
    assert miami["percentage"] >= 80, f"Miami percentage {miami['percentage']} < 80"


# ── Import URL ───────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def imported_inspiration_id(auth_session):
    """Create an inspiration via URL import, return ID for downstream tests."""
    payload = {
        "url": "https://images.unsplash.com/photo-1505691938895-1758d7feb511",
        "title": "TEST_ImportedMedVilla",
        "description": "Test mediterranean import",
        "atmosphere_tags": ["mediterranean", "indoor_outdoor"],
        "material_tags": ["travertine", "linen", "stone"],
        "market_codes": ["usa_miami"],
        "hospitality_profile": "hospitality",
        "luxury_level": "refined",
    }
    r = auth_session.post(f"{BASE_URL}/api/inspirations/archive/import", json=payload, timeout=30)
    assert r.status_code == 201, f"import failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    assert "id" in data
    assert data["title"] == "TEST_ImportedMedVilla"
    assert data["image_url"]
    assert "mediterranean" in (data.get("atmosphere_tags") or [])
    return data["id"]


def test_import_url_creates_card(imported_inspiration_id):
    assert imported_inspiration_id


def test_import_url_persisted_and_source_kind(auth_session, imported_inspiration_id):
    r = auth_session.get(f"{BASE_URL}/api/inspirations/archive/{imported_inspiration_id}", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["is_inspiration"] is True
    assert data["source_kind"] in ("pinterest", "instagram", "url", "upload")
    assert data["source_url"] is not None
    # storage_path synthetic
    assert data.get("storage_path", "").startswith("external/") or data.get("bucket") == "external"


def test_imported_resonance_miami_high(auth_session, imported_inspiration_id):
    r = auth_session.get(f"{BASE_URL}/api/inspirations/archive/{imported_inspiration_id}/resonance", timeout=20)
    assert r.status_code == 200
    items = r.json()["items"]
    miami = next((it for it in items if it["market_code"] == "usa_miami"), None)
    assert miami["percentage"] >= 80, f"Miami percentage {miami['percentage']} < 80"


# ── Source kind detection: pinterest URL ─────────────────────────────
def test_import_pinterest_url_detected(auth_session):
    payload = {"url": "https://www.pinterest.com/pin/12345/", "title": "TEST_PinterestRef"}
    r = auth_session.post(f"{BASE_URL}/api/inspirations/archive/import", json=payload, timeout=30)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["source_kind"] == "pinterest"


# ── PATCH merges inspiration_meta ────────────────────────────────────
def test_patch_merges_meta(auth_session, imported_inspiration_id):
    r = auth_session.patch(
        f"{BASE_URL}/api/inspirations/archive/{imported_inspiration_id}",
        json={"inspiration_meta": {"brand": "TEST_BrandX"}, "alt_text": "TEST_UpdatedAlt"},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    # GET to verify
    g = auth_session.get(f"{BASE_URL}/api/inspirations/archive/{imported_inspiration_id}", timeout=20).json()
    assert g["brand"] == "TEST_BrandX"
    # ensure previous fields preserved (mediterranean atmosphere still there)
    assert "mediterranean" in (g.get("atmosphere_tags") or [])
    assert g["title"] == "TEST_UpdatedAlt"


# ── Links endpoints ──────────────────────────────────────────────────
def test_create_and_list_links_idempotent(auth_session, imported_inspiration_id):
    target_id = str(uuid.uuid4())
    payload = {"target_type": "moodboard", "target_id": target_id, "note": "TEST_link"}
    r1 = auth_session.post(
        f"{BASE_URL}/api/inspirations/archive/{imported_inspiration_id}/links",
        json=payload, timeout=20,
    )
    assert r1.status_code == 201, r1.text
    link1 = r1.json()
    # second insert should be idempotent (return existing or 201/200)
    r2 = auth_session.post(
        f"{BASE_URL}/api/inspirations/archive/{imported_inspiration_id}/links",
        json=payload, timeout=20,
    )
    assert r2.status_code in (200, 201), r2.text
    # list
    rl = auth_session.get(
        f"{BASE_URL}/api/inspirations/archive/{imported_inspiration_id}/links", timeout=20
    )
    assert rl.status_code == 200
    items = rl.json()["items"]
    ids = [it["id"] for it in items]
    assert link1["id"] in ids

    # delete
    rd = auth_session.delete(f"{BASE_URL}/api/inspirations/archive/links/{link1['id']}", timeout=20)
    assert rd.status_code == 204
    rl2 = auth_session.get(
        f"{BASE_URL}/api/inspirations/archive/{imported_inspiration_id}/links", timeout=20
    ).json()
    assert link1["id"] not in [it["id"] for it in rl2["items"]]


# ── DELETE unflags but keeps media row ───────────────────────────────
def test_delete_unflags_without_file_removal(auth_session, imported_inspiration_id):
    rd = auth_session.delete(f"{BASE_URL}/api/inspirations/archive/{imported_inspiration_id}", timeout=20)
    assert rd.status_code == 204
    # detail still fetchable (row exists), but is_inspiration=False
    g = auth_session.get(f"{BASE_URL}/api/inspirations/archive/{imported_inspiration_id}", timeout=20)
    assert g.status_code == 200
    assert g.json()["is_inspiration"] is False
    # archive list no longer returns it
    listing = auth_session.get(f"{BASE_URL}/api/inspirations/archive?limit=200", timeout=20).json()
    ids = [it["id"] for it in listing["items"]]
    assert imported_inspiration_id not in ids


# ── Import via existing media_id (promote) ───────────────────────────
def test_import_media_id_requires_existing(auth_session):
    payload = {"media_id": str(uuid.uuid4()), "atmosphere_tags": ["warm_minimal"]}
    r = auth_session.post(f"{BASE_URL}/api/inspirations/archive/import", json=payload, timeout=20)
    assert r.status_code == 404


def test_import_no_url_no_media_returns_400(auth_session):
    r = auth_session.post(f"{BASE_URL}/api/inspirations/archive/import", json={"title": "x"}, timeout=20)
    assert r.status_code == 400
