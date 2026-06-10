"""F.2 Presentation Sequencing V2™ — backend tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://i18n-recovery-1.preview.emergentagent.com").rstrip("/")
DESIGNER = {"email": "designer@moodfordesign.com", "password": "Designer2024!"}
STUDIO2 = {"email": "studio2@moodfordesign.com", "password": "Studio2024!"}
MID = "85b93c6b-8de2-4b14-a977-a768ecc02309"

TRANSITION_IDS = {"fade", "dissolve", "slow_slide_left", "slow_slide_up", "cinematic_zoom", "soft_blur_crossfade"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code} {r.text}")
    j = r.json()
    tok = (j.get("session") or {}).get("access_token") or j.get("access_token") or j.get("token")
    assert tok, f"no token in login response: {j}"
    s.headers.update({"Authorization": f"Bearer {tok}"})
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def designer():
    return _login(DESIGNER)


@pytest.fixture(scope="module")
def studio2():
    return _login(STUDIO2)


# ── Transition registry ─────────────────────────────────────────────────────
def test_get_presentation_transitions(designer):
    r = designer.get(f"{BASE_URL}/api/moodboards/_meta/presentation_transitions")
    assert r.status_code == 200, r.text
    data = r.json().get("data") or []
    assert len(data) == 6
    ids = {t["id"] for t in data}
    assert ids == TRANSITION_IDS
    for t in data:
        assert {"id", "label_key", "duration_ms", "easing", "css"} <= set(t.keys())
        assert "from" in t["css"] and "to" in t["css"]
        assert 700 <= t["duration_ms"] <= 1000
        assert "cubic-bezier" in t["easing"]


# ── PUT /pages merges F.2 fields under settings ─────────────────────────────
def _first_page(client, mid):
    r = client.get(f"{BASE_URL}/api/moodboards/{mid}/pages")
    assert r.status_code == 200, r.text
    pages = r.json().get("data") or []
    assert pages
    return pages[0]


def test_update_page_merges_into_settings(designer):
    page = _first_page(designer, MID)
    pid = page["id"]
    orig_settings = page.get("settings") or {}
    # Patch with F.2 fields
    payload = {
        "chapter_label": "Concept",
        "transition_in": "cinematic_zoom",
        "transition_out": "fade",
        "transition_duration": 850,
        "hidden_from_client": False,
    }
    r = designer.put(f"{BASE_URL}/api/moodboards/{MID}/pages/{pid}", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    s = body.get("settings") or {}
    assert s.get("chapter_label") == "Concept"
    assert s.get("transition_in") == "cinematic_zoom"
    assert s.get("transition_out") == "fade"
    assert s.get("transition_duration") == 850
    assert s.get("hidden_from_client") is False
    # Unrelated keys (e.g. skeleton_id) survive merge
    for k, v in orig_settings.items():
        if k not in ("chapter_label", "transition_in", "transition_out",
                     "transition_duration", "hidden_from_client"):
            assert s.get(k) == v, f"key {k} dropped from settings"
    # Verify persistence via GET
    page2 = next(p for p in designer.get(f"{BASE_URL}/api/moodboards/{MID}/pages").json()["data"] if p["id"] == pid)
    s2 = page2.get("settings") or {}
    assert s2.get("transition_in") == "cinematic_zoom"

    # Clear chapter_label with empty string
    r = designer.put(f"{BASE_URL}/api/moodboards/{MID}/pages/{pid}", json={"chapter_label": ""})
    assert r.status_code == 200
    s3 = r.json().get("settings") or {}
    assert "chapter_label" not in s3


def test_update_page_invalid_transition_400(designer):
    page = _first_page(designer, MID)
    r = designer.put(f"{BASE_URL}/api/moodboards/{MID}/pages/{page['id']}",
                     json={"transition_in": "warp_speed"})
    assert r.status_code == 400
    assert "transition_in" in r.text.lower()
    r2 = designer.put(f"{BASE_URL}/api/moodboards/{MID}/pages/{page['id']}",
                      json={"transition_out": "nope"})
    assert r2.status_code == 400


def test_update_page_legacy_fields_still_work(designer):
    page = _first_page(designer, MID)
    pid = page["id"]
    r = designer.put(f"{BASE_URL}/api/moodboards/{MID}/pages/{pid}",
                     json={"title": "TEST_F2_legacy", "hidden_in_presentation": False})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("title") == "TEST_F2_legacy"
    assert body.get("hidden_in_presentation") is False


# ── Public share includes pages + filters hidden ────────────────────────────
@pytest.fixture(scope="module")
def share_token_and_hidden(designer):
    # Ensure status != draft
    designer.post(f"{BASE_URL}/api/moodboards/{MID}/approval", json={"status": "sent"})
    # Create share token
    r = designer.post(f"{BASE_URL}/api/moodboards/{MID}/share")
    assert r.status_code == 200, r.text
    token = r.json()["share_token"]
    # Pick a page and mark hidden_from_client
    pages = designer.get(f"{BASE_URL}/api/moodboards/{MID}/pages").json()["data"]
    assert len(pages) >= 2, "need >=2 pages for hidden_from_client test"
    hidden_page = pages[-1]
    designer.put(f"{BASE_URL}/api/moodboards/{MID}/pages/{hidden_page['id']}",
                 json={"hidden_from_client": True})
    yield {"token": token, "hidden_id": hidden_page["id"], "all_pages": pages}
    # Cleanup
    designer.put(f"{BASE_URL}/api/moodboards/{MID}/pages/{hidden_page['id']}",
                 json={"hidden_from_client": False})


def test_public_share_includes_pages_filtered(share_token_and_hidden):
    info = share_token_and_hidden
    r = requests.get(f"{BASE_URL}/api/moodboards/public/share/{info['token']}", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "pages" in data and isinstance(data["pages"], list)
    visible_ids = {p["id"] for p in data["pages"]}
    assert info["hidden_id"] not in visible_ids
    # Blocks for hidden page must be dropped
    for b in data.get("elements", []):
        assert b.get("page_id") != info["hidden_id"]


def test_public_share_draft_blocked(designer):
    # Snapshot status, set draft, attempt public fetch, restore
    cur = designer.get(f"{BASE_URL}/api/moodboards/{MID}").json()
    prior_status = cur.get("status", "sent")
    r = designer.post(f"{BASE_URL}/api/moodboards/{MID}/share")
    token = r.json()["share_token"]
    designer.post(f"{BASE_URL}/api/moodboards/{MID}/approval", json={"status": "draft"})
    pub = requests.get(f"{BASE_URL}/api/moodboards/public/share/{token}")
    assert pub.status_code == 403
    # Restore to sent
    designer.post(f"{BASE_URL}/api/moodboards/{MID}/approval",
                  json={"status": "sent" if prior_status == "draft" else prior_status})


# ── Inject template into existing moodboard ─────────────────────────────────
@pytest.fixture(scope="module")
def multipage_template(designer):
    # Save current moodboard as a multipage template, then use it as injection source
    slug = f"test-f2-inject-{os.urandom(3).hex()}"
    r = designer.post(f"{BASE_URL}/api/templates/from-moodboard/{MID}",
                      json={"slug": slug, "name": "TEST_F2_INJECT", "visibility": "tenant"})
    assert r.status_code == 201, r.text
    tid = r.json()["id"]
    yield tid
    designer.delete(f"{BASE_URL}/api/templates/{tid}")


def test_inject_template_appends_pages(designer, multipage_template):
    before = designer.get(f"{BASE_URL}/api/moodboards/{MID}/pages").json()["data"]
    before_ids = {p["id"] for p in before}
    max_sort_before = max(p.get("sort_order", 0) for p in before)

    r = designer.post(f"{BASE_URL}/api/templates/inject-into/{MID}",
                      json={"template_id": multipage_template})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["moodboard_id"] == MID
    assert body["pages_added"] >= 1
    assert "first_new_page_id" in body

    after = designer.get(f"{BASE_URL}/api/moodboards/{MID}/pages").json()["data"]
    assert len(after) == len(before) + body["pages_added"]
    # Existing pages intact
    after_ids = {p["id"] for p in after}
    assert before_ids.issubset(after_ids)
    # New pages appended (sort_order > previous max)
    new_pages = [p for p in after if p["id"] not in before_ids]
    for p in new_pages:
        assert p["sort_order"] > max_sort_before

    # Cleanup: delete the newly appended pages
    for p in new_pages:
        designer.delete(f"{BASE_URL}/api/moodboards/{MID}/pages/{p['id']}")


def test_inject_unknown_template_404(designer):
    r = designer.post(f"{BASE_URL}/api/templates/inject-into/{MID}",
                      json={"template_id": "00000000-0000-0000-0000-000000000000"})
    assert r.status_code == 404


def test_inject_unknown_moodboard_404(designer, multipage_template):
    r = designer.post(f"{BASE_URL}/api/templates/inject-into/00000000-0000-0000-0000-000000000000",
                      json={"template_id": multipage_template})
    assert r.status_code == 404


def test_inject_cross_tenant_404(studio2, multipage_template):
    r = studio2.post(f"{BASE_URL}/api/templates/inject-into/{MID}",
                     json={"template_id": multipage_template})
    assert r.status_code == 404


# ── P0 regression smoke ─────────────────────────────────────────────────────
def test_regression_pages_list(designer):
    r = designer.get(f"{BASE_URL}/api/moodboards/{MID}/pages")
    assert r.status_code == 200
    assert isinstance(r.json().get("data"), list)


def test_regression_page_skeletons(designer):
    r = designer.get(f"{BASE_URL}/api/moodboards/_meta/page_skeletons")
    assert r.status_code == 200
    assert len(r.json().get("data") or []) == 12
