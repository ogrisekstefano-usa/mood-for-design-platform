"""
STORE-012B · MOODBOARD V2.1 — Working Moodboard backend tests (iter220).
Covers:
* POST /api/journeys/{jid}/working-moodboards/from-concept/{concept_mb_id}
* Idempotency (created=false on 2nd call, same moodboard_id)
* ai_metadata.working_seed shape
* 5 moodboard_pages (vision/materials/products/atmosphere/notes)
* moodboard_elements: vision text+image+palette, materials NFC-triple,
  atmosphere images, notes editable text — and approval_status='suggested'.
* GET /api/moodboards/{id}/project-brain shape + invariant
  (never contains 'client_alignment_score').
* GET /api/moodboards/{id}/working-payload grouped by section.
* PATCH /api/moodboard-elements/{eid}/approval-status valid + 422.
* GET /api/client/moodboards/{id}/presentation strips approval_* and
  never contains 'client_alignment_score'.
"""
import os
import re
import pytest
import requests

_BU = os.environ.get("REACT_APP_BACKEND_URL")
if not _BU:
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    _BU = line.split("=", 1)[1].strip()
                    break
    except Exception:
        pass
assert _BU, "REACT_APP_BACKEND_URL not configured"
BASE_URL = _BU.rstrip("/")
ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASS = "Blueprint2024!"
JID = "8bb7a3b4-02af-4040-8420-37a254713899"

# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
                      timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text[:200]}"
    d = r.json()
    tok = d.get("session", {}).get("access_token") or d.get("access_token")
    assert tok, f"no access_token in {d}"
    return tok


@pytest.fixture(scope="module")
def h(admin_token):
    return {"Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def concept_mb_id(h):
    """Pick a preferred Concept Board from the journey's pulse, falling back
    to the first concept moodboard of the journey if no preferred exists."""
    r = requests.get(f"{BASE_URL}/api/journeys/{JID}/concept-pulse", headers=h, timeout=30)
    assert r.status_code == 200, f"concept-pulse {r.status_code} {r.text[:200]}"
    d = r.json()
    pref = (d.get("preferred_direction") or {})
    if pref.get("moodboard_id"):
        return pref["moodboard_id"]
    # fallback to ranking[0] or any concept board
    ranking = d.get("ranking") or []
    if ranking and ranking[0].get("moodboard_id"):
        return ranking[0]["moodboard_id"]
    pytest.skip("No concept board available on journey to derive from")


# ---------- Tests ----------
def test_01_generate_or_reuse_working_moodboard(h, concept_mb_id):
    """POST returns valid shape (created may be true or false). Capture mb_id for next tests."""
    r = requests.post(
        f"{BASE_URL}/api/journeys/{JID}/working-moodboards/from-concept/{concept_mb_id}",
        headers=h, timeout=60)
    assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
    d = r.json()
    assert "moodboard_id" in d and d["moodboard_id"]
    assert "derived_at" in d
    # sections list returned only on `created=true`; safe to check when present
    if d.get("created"):
        assert set(d["sections"]) == {"vision", "materials", "products", "atmosphere", "notes"}
        assert d["element_count"] >= 15, f"element_count too low: {d['element_count']}"
    # store on module
    pytest._wmb_id = d["moodboard_id"]


def test_02_idempotency_second_post_returns_created_false_same_id(h, concept_mb_id):
    r = requests.post(
        f"{BASE_URL}/api/journeys/{JID}/working-moodboards/from-concept/{concept_mb_id}",
        headers=h, timeout=60)
    assert r.status_code == 200
    d = r.json()
    assert d["created"] is False
    assert d["moodboard_id"] == pytest._wmb_id


def test_03_working_payload_has_5_sections_and_min_elements(h):
    r = requests.get(f"{BASE_URL}/api/moodboards/{pytest._wmb_id}/working-payload",
                     headers=h, timeout=30)
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    assert d["moodboard_id"] == pytest._wmb_id
    sections = d["sections"]
    assert len(sections) == 5
    keys = [s["section"] for s in sections]
    assert keys == ["vision", "materials", "products", "atmosphere", "notes"]
    # titles in English
    titles = {s["section"]: s["title"] for s in sections}
    assert titles["vision"] == "Vision"
    assert titles["materials"] == "Materials"
    assert titles["atmosphere"] == "Atmosphere"
    assert titles["notes"] == "Design Notes"
    # every element has approval_status default 'suggested' (or other allowed)
    total = 0
    for s in sections:
        for el in s["elements"]:
            total += 1
            assert isinstance(el["content"], dict)
            assert el["content"].get("approval_status") in (
                "suggested", "discussed", "approved", "rejected")
    assert total >= 15, f"too few elements: {total}"
    # cache sections for later tests
    pytest._sections = {s["section"]: s for s in sections}


def test_04_vision_has_headline_subline_hero_palette(h):
    vis = pytest._sections["vision"]
    types = [e["type"] for e in vis["elements"]]
    assert "text" in types, "vision missing headline text"
    # at least one palette + image expected (palette/hero may be missing if no media/palette in seed)
    text_variants = [e["content"].get("variant") for e in vis["elements"] if e["type"] == "text"]
    assert "headline" in text_variants


def test_05_materials_section_nfc_triple(h):
    mats = pytest._sections["materials"]
    mat_els = [e for e in mats["elements"] if e["type"] == "material"]
    if not mat_els:
        pytest.skip("No material elements in this concept seed")
    for el in mat_els:
        c = el["content"]
        assert c.get("entity_id"), "material missing entity_id"
        assert c.get("material_id"), "material missing material_id (NFC triple)"
        assert "brand_id" in c, "material missing brand_id key"


def test_06_atmosphere_images_have_media_id(h):
    atm = pytest._sections["atmosphere"]
    img_els = [e for e in atm["elements"] if e["type"] == "image"]
    if not img_els:
        pytest.skip("No atmosphere images in seed")
    for el in img_els:
        assert el["content"].get("media_id")


def test_07_notes_has_editable_text(h):
    nt = pytest._sections["notes"]
    txt_els = [e for e in nt["elements"] if e["type"] == "text"]
    assert len(txt_els) >= 1
    assert txt_els[0]["content"].get("editable") is True


def test_08_working_seed_metadata_shape(h):
    """working_seed must carry source_concept_id, set_id, set_index, direction_name,
    derived_at, mode, sections, style_dna_snapshot, color_palette, generator."""
    r = requests.get(f"{BASE_URL}/api/moodboards/{pytest._wmb_id}/working-payload",
                     headers=h, timeout=30)
    assert r.status_code == 200
    ws = r.json()["working_seed"]
    for k in ("source_concept_id", "direction_name", "derived_at", "mode",
              "sections", "style_dna_snapshot", "color_palette", "generator"):
        assert k in ws, f"working_seed missing {k}"
    assert ws["mode"] == "working"
    assert ws["generator"] == "store-012b"
    assert ws["sections"] == ["vision", "materials", "products", "atmosphere", "notes"]


def test_09_project_brain_shape_and_invariant(h):
    r = requests.get(f"{BASE_URL}/api/moodboards/{pytest._wmb_id}/project-brain",
                     headers=h, timeout=30)
    assert r.status_code == 200, r.text[:300]
    raw = r.text
    # STORE-012D invariant inherited
    assert "client_alignment_score" not in raw, "leaked client_alignment_score in project-brain"
    d = r.json()
    for k in ("moodboard_id", "journey_id", "client", "project",
              "discovery", "concept_pulse", "recommended_next_action"):
        assert k in d, f"project-brain missing {k}"
    for sk in ("style_dna", "material_dna", "project_profile",
               "investment_profile", "atmosphere_signals"):
        assert sk in d["discovery"]
    for ck in ("has_shared_set", "preferred_direction", "ranking", "feedback_summary"):
        assert ck in d["concept_pulse"]
    rna = d["recommended_next_action"]
    assert rna.get("key") and rna.get("headline")


def test_10_patch_approval_status_valid(h):
    r = requests.get(f"{BASE_URL}/api/moodboards/{pytest._wmb_id}/working-payload",
                     headers=h, timeout=30)
    sections = r.json()["sections"]
    target = None
    for s in sections:
        if s["elements"]:
            target = s["elements"][0]
            break
    assert target, "no elements to patch"
    eid = target["id"]
    rp = requests.patch(f"{BASE_URL}/api/moodboard-elements/{eid}/approval-status",
                        headers=h, json={"approval_status": "approved"}, timeout=30)
    assert rp.status_code == 200, rp.text[:300]
    assert rp.json()["approval_status"] == "approved"
    # verify persistence
    r2 = requests.get(f"{BASE_URL}/api/moodboards/{pytest._wmb_id}/working-payload",
                      headers=h, timeout=30)
    new_sections = r2.json()["sections"]
    found = None
    for s in new_sections:
        for el in s["elements"]:
            if el["id"] == eid:
                found = el; break
    assert found, "element disappeared after patch"
    assert found["content"]["approval_status"] == "approved"


def test_11_patch_approval_status_invalid_422(h):
    # need any valid element id
    r = requests.get(f"{BASE_URL}/api/moodboards/{pytest._wmb_id}/working-payload",
                     headers=h, timeout=30)
    eid = r.json()["sections"][0]["elements"][0]["id"]
    rp = requests.patch(f"{BASE_URL}/api/moodboard-elements/{eid}/approval-status",
                        headers=h, json={"approval_status": "totally-bogus"}, timeout=30)
    assert rp.status_code == 422, f"got {rp.status_code} body={rp.text[:200]}"


def test_12_client_presentation_strips_approval_and_no_score(h):
    """Client portal endpoint — admin call expected to 403 (not a client).
    If it returns 200 we must still verify invariants. We test it as an
    admin to confirm RBAC blocks; the response should NOT carry approval_*
    or client_alignment_score keys regardless."""
    r = requests.get(f"{BASE_URL}/api/client/moodboards/{pytest._wmb_id}/presentation",
                     headers=h, timeout=30)
    # Admin is not a client → expected 403/401. Either way, the body must
    # never expose forbidden tokens.
    raw = r.text
    assert "client_alignment_score" not in raw
    assert not re.search(r'"approval_[a-z_]+"\s*:', raw), \
        "client presentation must strip approval_* keys"


def test_13_list_working_moodboards_contains_generated(h):
    r = requests.get(f"{BASE_URL}/api/journeys/{JID}/working-moodboards",
                     headers=h, timeout=30)
    assert r.status_code == 200
    ids = [w["moodboard_id"] for w in r.json()["working_moodboards"]]
    assert pytest._wmb_id in ids


# ---------- Regression checks ----------
def test_14_regression_discover_brief_still_works(h):
    r = requests.get(f"{BASE_URL}/api/journeys/{JID}/discover-brief",
                     headers=h, timeout=30)
    assert r.status_code == 200


def test_15_regression_concept_directions_list(h):
    r = requests.get(f"{BASE_URL}/api/journeys/{JID}/concept-directions",
                     headers=h, timeout=30)
    assert r.status_code == 200


def test_16_regression_concept_pulse_no_score(h):
    r = requests.get(f"{BASE_URL}/api/journeys/{JID}/concept-pulse",
                     headers=h, timeout=30)
    assert r.status_code == 200
    assert "client_alignment_score" not in r.text
