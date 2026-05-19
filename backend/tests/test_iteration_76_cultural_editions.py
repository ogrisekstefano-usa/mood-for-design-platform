"""Iteration 76 — Cultural Edition™ Flow Activation backend tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback for backend tests
    import re
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

EMAIL = "demo@moodfordesign.com"
PASSWORD = "Blueprint2024!"


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
    assert token, f"no token in login response: keys={list(body.keys())}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ── markets taxonomy ───────────────────────────────────────────────────
def test_markets_returns_curated_taxonomy(auth_session):
    r = auth_session.get(f"{BASE_URL}/api/cultural-editions/markets", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "markets" in data and "adaptation_scopes" in data and "source_types" in data
    codes = [m["code"] for m in data["markets"]]
    assert set(codes) == {"usa_miami", "usa_nyc", "uae_dubai", "uk_london",
                          "italy_milano", "france_paris"}
    assert len(data["adaptation_scopes"]) == 7
    assert len(data["source_types"]) == 4


# ── sources ────────────────────────────────────────────────────────────
def test_sources_project_returns_items(auth_session):
    r = auth_session.get(f"{BASE_URL}/api/cultural-editions/sources?type=project", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["type"] == "project"
    assert isinstance(data["items"], list)
    assert len(data["items"]) > 0, "demo tenant should have projects"
    item = data["items"][0]
    assert "id" in item and "title" in item


def test_sources_moodboard_returns_array(auth_session):
    r = auth_session.get(f"{BASE_URL}/api/cultural-editions/sources?type=moodboard", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data["items"], list)


# ── draft create (real Claude) ─────────────────────────────────────────
@pytest.fixture(scope="module")
def created_draft(auth_session):
    # Get a project
    src = auth_session.get(f"{BASE_URL}/api/cultural-editions/sources?type=project", timeout=30).json()
    project = src["items"][0]
    body = {
        "source_type": "project",
        "source_id": project["id"],
        "source_title": project["title"],
        "target_market": "usa_miami",
        "target_locale": "en-US",
        "adaptation_scope": ["tone", "cta", "material_palette", "imagery"],
        "note": "Adattamento per clientela hospitality Miami",
    }
    r = auth_session.post(f"{BASE_URL}/api/cultural-editions/drafts", json=body, timeout=90)
    assert r.status_code == 201, r.text
    return r.json()


def test_create_draft_uses_claude_not_fallback(created_draft):
    meta = created_draft.get("generation_meta") or {}
    assert meta.get("fallback") is False, f"Expected real Claude generation, got: {meta}"
    assert meta.get("model") == "claude-sonnet-4-5-20250929", f"meta={meta}"


def test_create_draft_market_version_populated(created_draft):
    v = created_draft.get("market_version") or {}
    required = ["headline", "lede", "body", "cta_label", "cta_subtext",
                "atmosphere_notes", "material_notes", "imagery_notes", "cultural_notes"]
    for k in required:
        assert k in v, f"missing key {k}"
        if k != "cta_subtext":
            assert isinstance(v[k], str) and len(v[k]) > 0, f"empty {k}"


def test_create_draft_miami_context_present(created_draft):
    v = created_draft.get("market_version") or {}
    blob = " ".join([str(x) for x in v.values()]).lower()
    # check at least one Miami-flavoured cue is present
    cues = ["miami", "mediterran", "tactile", "outdoor", "light", "luce",
            "resort", "atmospher", "warm", "ocean", "water"]
    assert any(c in blob for c in cues), f"no Miami-context cue in: {blob[:300]}"


def test_create_draft_status_and_market_metadata(created_draft):
    assert created_draft["status"] == "draft"
    assert created_draft["target_market"] == "usa_miami"
    assert created_draft.get("target_market_label") == "USA · Miami"
    assert created_draft.get("source_payload", {}).get("title")


# ── list / detail / patch ──────────────────────────────────────────────
def test_list_drafts_includes_created(auth_session, created_draft):
    r = auth_session.get(f"{BASE_URL}/api/cultural-editions/drafts", timeout=30)
    assert r.status_code == 200
    drafts = r.json()["drafts"]
    assert any(d["id"] == created_draft["id"] for d in drafts)


def test_get_draft_detail_includes_market(auth_session, created_draft):
    r = auth_session.get(f"{BASE_URL}/api/cultural-editions/drafts/{created_draft['id']}", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["id"] == created_draft["id"]
    assert d.get("market") is not None
    assert d["market"]["code"] == "usa_miami"
    assert d["market"]["city"] == "Miami"


def test_patch_draft_status_in_review(auth_session, created_draft):
    r = auth_session.patch(
        f"{BASE_URL}/api/cultural-editions/drafts/{created_draft['id']}",
        json={"status": "in_review"}, timeout=30,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "in_review"


def test_patch_draft_invalid_status(auth_session, created_draft):
    r = auth_session.patch(
        f"{BASE_URL}/api/cultural-editions/drafts/{created_draft['id']}",
        json={"status": "bogus"}, timeout=30,
    )
    assert r.status_code == 400


def test_create_draft_invalid_market_400(auth_session):
    r = auth_session.post(f"{BASE_URL}/api/cultural-editions/drafts",
                          json={"source_type": "project", "source_id": "x",
                                "target_market": "mars"}, timeout=30)
    assert r.status_code == 400
