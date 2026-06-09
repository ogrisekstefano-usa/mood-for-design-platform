"""STORE-012D · CONCEPT PULSE™ backend tests.

Covers:
- GET /api/journeys/{jid}/concept-pulse returns latest shared set
- Invariant: 'client_alignment_score' string never leaks in response JSON
- Only alignment_band + alignment_label appear (not raw score)
- Ranking is band-bucketed (high → medium → low), with weighted reaction tie-break
- Deterministic suggested_next_action keys (develop_preferred / material_board_for_preferred / etc.)
- Read-only: moodboard.status NEVER changes after the GET
- has_shared_set=false branch when no shared set exists (uses fresh journey)
- Regression: STORE-012A/C endpoints still respond
"""
import json
import os
import re

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASSWORD = "Blueprint2024!"
TEST_JID = "8bb7a3b4-02af-4040-8420-37a254713899"


@pytest.fixture(scope="module")
def auth_headers():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    token = (data.get("session") or {}).get("access_token") or data.get("access_token")
    assert token, f"no access token in {data}"
    return {"Authorization": f"Bearer {token}"}


# ── 1. Endpoint returns 200 with has_shared_set=true and latest set ─────────
def test_pulse_returns_latest_shared_set(auth_headers):
    r = requests.get(f"{BASE_URL}/api/journeys/{TEST_JID}/concept-pulse",
                     headers=auth_headers, timeout=20)
    assert r.status_code == 200, r.text[:400]
    d = r.json()
    assert d["has_shared_set"] is True
    assert d["set"] is not None
    assert d["set"]["set_id"]
    assert d["set"]["set_index"] >= 1
    assert d["set"]["set_label"].startswith("Direction Set")
    assert d["set"]["set_shared_at"]


# ── 2. CRITICAL INVARIANT: raw 'client_alignment_score' must not leak ─────
def test_pulse_never_leaks_raw_score(auth_headers):
    r = requests.get(f"{BASE_URL}/api/journeys/{TEST_JID}/concept-pulse",
                     headers=auth_headers, timeout=20)
    body_text = r.text
    assert "client_alignment_score" not in body_text, "raw score key leaked!"
    # Each ranking row exposes only alignment_band + alignment_label
    d = r.json()
    for row in d["ranking"]:
        assert "alignment_band" in row
        assert row["alignment_band"] in {"high", "medium", "low"}
        assert row["alignment_label"] in {"High alignment", "Medium alignment", "Low alignment"}
        assert "client_alignment_score" not in row
        assert "score" not in row


# ── 3. Response schema ─────────────────────────────────────────────────────
def test_pulse_response_schema(auth_headers):
    r = requests.get(f"{BASE_URL}/api/journeys/{TEST_JID}/concept-pulse",
                     headers=auth_headers, timeout=20)
    d = r.json()
    # top-level
    for k in ("has_shared_set", "set", "preferred_direction", "ranking",
              "feedback_summary", "suggested_next_action", "quick_actions"):
        assert k in d, f"missing key {k}"
    fs = d["feedback_summary"]
    for k in ("interested", "explore_further", "preferred", "comment"):
        assert k in fs and isinstance(fs[k], int)
    sna = d["suggested_next_action"]
    for k in ("key", "headline", "hint", "action_type"):
        assert k in sna and isinstance(sna[k], str) and sna[k]
    # ranking sub-schema
    for i, row in enumerate(d["ranking"]):
        assert row["rank"] == i + 1
        for k in ("moodboard_id", "direction_letter", "direction_name",
                  "alignment_band", "alignment_label", "is_preferred",
                  "reaction_counts", "color_palette"):
            assert k in row
        rc = row["reaction_counts"]
        for k in ("interested", "explore_further", "preferred", "comment"):
            assert k in rc


# ── 4. Ranking sort: band priority then weighted reactions ────────────────
def test_pulse_ranking_sort_order(auth_headers):
    r = requests.get(f"{BASE_URL}/api/journeys/{TEST_JID}/concept-pulse",
                     headers=auth_headers, timeout=20)
    rows = r.json()["ranking"]
    band_order = {"high": 0, "medium": 1, "low": 2}
    prev_key = None
    for row in rows:
        rc = row["reaction_counts"]
        weight = rc["preferred"]*10 + rc["interested"]*3 + rc["explore_further"]*2 + rc["comment"]*5
        key = (band_order[row["alignment_band"]], -weight)
        if prev_key is not None:
            assert key >= prev_key, f"ranking not sorted: {prev_key} → {key}"
        prev_key = key


# ── 5. Preferred + material comment → material_board_for_preferred ───────
# Spec says preferred=B9 exists. Hint should mention preferred direction name.
def test_pulse_suggested_action_when_preferred(auth_headers):
    r = requests.get(f"{BASE_URL}/api/journeys/{TEST_JID}/concept-pulse",
                     headers=auth_headers, timeout=20)
    d = r.json()
    assert d["preferred_direction"] is not None
    sna_key = d["suggested_next_action"]["key"]
    # Either develop_preferred or material_board_for_preferred is valid here
    assert sna_key in {"develop_preferred", "material_board_for_preferred"}
    headline = d["suggested_next_action"]["headline"]
    name = d["preferred_direction"]["direction_name"]
    assert name in headline


# ── 6. Quick actions present and well-formed ─────────────────────────────
def test_pulse_quick_actions(auth_headers):
    r = requests.get(f"{BASE_URL}/api/journeys/{TEST_JID}/concept-pulse",
                     headers=auth_headers, timeout=20)
    d = r.json()
    keys = {qa["key"] for qa in d["quick_actions"]}
    # When preferred exists we expect open_preferred + material_board_preferred
    assert "generate_alternatives" in keys
    assert "view_feedback" in keys
    if d["preferred_direction"]:
        assert "open_preferred" in keys
        mb_id = d["preferred_direction"]["moodboard_id"]
        op = next(qa for qa in d["quick_actions"] if qa["key"] == "open_preferred")
        assert op["href"] == f"/moodboards/{mb_id}"
    vf = next(qa for qa in d["quick_actions"] if qa["key"] == "view_feedback")
    assert vf["href"] == f"/client/journey/{TEST_JID}/concepts"
    ga = next(qa for qa in d["quick_actions"] if qa["key"] == "generate_alternatives")
    assert ga["kind"] == "api" and ga.get("method") == "POST"


# ── 7. CRITICAL INVARIANT: moodboard.status not changed by /concept-pulse ─
def test_pulse_is_read_only_no_status_change(auth_headers):
    # snapshot statuses via list endpoint
    before = requests.get(f"{BASE_URL}/api/journeys/{TEST_JID}/concept-directions",
                          headers=auth_headers, timeout=20).json()
    snap_before = {d["moodboard_id"]: d.get("status")
                   for s in before.get("sets", []) for d in s.get("directions", [])}
    # call pulse
    requests.get(f"{BASE_URL}/api/journeys/{TEST_JID}/concept-pulse",
                 headers=auth_headers, timeout=20)
    after = requests.get(f"{BASE_URL}/api/journeys/{TEST_JID}/concept-directions",
                         headers=auth_headers, timeout=20).json()
    snap_after = {d["moodboard_id"]: d.get("status")
                  for s in after.get("sets", []) for d in s.get("directions", [])}
    assert snap_before == snap_after, f"status changed: before={snap_before} after={snap_after}"


# ── 8. has_shared_set=false branch — use a fresh journey with no shares ──
def test_pulse_no_shared_set_branch(auth_headers):
    # Create a new minimal journey via public initiate (admin can read all)
    payload = {
        "welcome": {
            "first_name": "TEST_Pulse_NoShare",
            "email": f"test_pulse_{os.urandom(3).hex()}@example.com",
            "country_code": "IT",
            "dial_code": "+39",
            "normalized_phone": "+393339999999",
        }
    }
    init = requests.post(f"{BASE_URL}/api/public/journeys/initiate",
                         json=payload, timeout=20)
    if init.status_code != 200:
        pytest.skip(f"journey init failed: {init.status_code}")
    new_jid = init.json().get("journey_id")
    assert new_jid
    r = requests.get(f"{BASE_URL}/api/journeys/{new_jid}/concept-pulse",
                     headers=auth_headers, timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d["has_shared_set"] is False
    assert d["preferred_direction"] is None
    assert d["ranking"] == []
    assert d["feedback_summary"] == {"interested": 0, "explore_further": 0,
                                     "preferred": 0, "comment": 0}
    assert d["suggested_next_action"]["key"] == "wait_for_feedback"
    keys = [qa["key"] for qa in d["quick_actions"]]
    assert "open_discovery" in keys


# ── 9. Regression: STORE-012A list endpoint still works ──────────────────
def test_regression_concept_directions_list(auth_headers):
    r = requests.get(f"{BASE_URL}/api/journeys/{TEST_JID}/concept-directions",
                     headers=auth_headers, timeout=20)
    assert r.status_code == 200
    assert "sets" in r.json()


# ── 10. Regression: client-facing concept directions endpoint still works ─
def test_regression_client_concepts(auth_headers):
    r = requests.get(f"{BASE_URL}/api/client/journeys/{TEST_JID}/concept-directions",
                     headers=auth_headers, timeout=20)
    assert r.status_code == 200
    body = r.text
    assert "client_alignment_score" not in body, "score leaked on client endpoint!"
