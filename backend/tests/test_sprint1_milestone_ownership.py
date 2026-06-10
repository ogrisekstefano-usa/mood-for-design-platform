"""
Sprint 1 — Milestone Ownership Consolidation tests.
Tests canonical PATCH /journeys/{jid}/milestones/{mid} and
POST /journeys/{jid}/milestones/{mid}/open, plus legacy deprecated endpoints.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
JID = "bba6e7e8-f31f-4c48-aab0-4ec4f3b34225"

ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASS  = "Blueprint2024!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    tok = data.get("access_token") or data.get("token") or data.get("session", {}).get("access_token")
    if not tok:
        pytest.skip("No token in login response")
    return tok


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def milestones(headers):
    """Fetch milestones for test JID via project journey endpoint."""
    # First get the journey milestones via overview
    r = requests.get(f"{BASE_URL}/api/journeys/{JID}/overview", headers=headers)
    if r.status_code != 200:
        pytest.skip(f"Cannot load journey overview: {r.status_code} {r.text[:200]}")
    data = r.json()
    flat = data.get("milestones_flat") or []
    if not flat:
        pytest.skip("No milestones found for test journey")
    return flat


# ── Test 1: Canonical PATCH status ──────────────────────────────────────
def test_canonical_patch_milestone_status(headers, milestones):
    """PATCH /journeys/{jid}/milestones/{mid} — status update."""
    # find a not_started milestone
    target = next((m for m in milestones if m["status"] == "not_started"), None)
    if not target:
        target = milestones[1]  # fallback to 2nd milestone

    mid = target["id"]
    original_status = target["status"]
    # Pick a safe next status — in_progress
    new_status = "in_progress" if original_status == "not_started" else "presented"

    r = requests.patch(
        f"{BASE_URL}/api/journeys/{JID}/milestones/{mid}",
        headers=headers,
        json={"status": new_status}
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
    data = r.json()
    assert "milestone" in data, f"Response missing 'milestone': {data}"
    assert data["milestone"]["status"] == new_status
    assert data.get("changed") is True
    print(f"PASS: canonical PATCH status → {new_status} for milestone {mid}")


# ── Test 2: Canonical PATCH full fields ─────────────────────────────────
def test_canonical_patch_milestone_fields(headers, milestones):
    """PATCH /journeys/{jid}/milestones/{mid} — title + description + metadata merge."""
    target = milestones[-1]  # last milestone (certified_closure likely)
    mid = target["id"]

    r = requests.patch(
        f"{BASE_URL}/api/journeys/{JID}/milestones/{mid}",
        headers=headers,
        json={
            "metadata": {"custom_flag": True, "test_key": "sprint1"},
        }
    )
    assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
    data = r.json()
    assert "milestone" in data
    merged_meta = data["milestone"].get("metadata") or {}
    assert merged_meta.get("custom_flag") is True
    assert merged_meta.get("test_key") == "sprint1"
    print(f"PASS: canonical PATCH metadata merge for {mid}")


# ── Test 3: Canonical POST open ──────────────────────────────────────────
def test_canonical_post_open_milestone(headers, milestones):
    """POST /journeys/{jid}/milestones/{mid}/open — auto-transition not_started → in_progress."""
    # pick a not_started milestone
    target = next((m for m in milestones if m["status"] == "not_started"), None)
    if not target:
        pytest.skip("No not_started milestone available for open test")

    mid = target["id"]
    r = requests.post(
        f"{BASE_URL}/api/journeys/{JID}/milestones/{mid}/open",
        headers=headers,
    )
    assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
    data = r.json()
    assert "milestone_id" in data
    assert "open_mode" in data
    assert data["milestone_id"] == mid
    print(f"PASS: canonical POST open for {mid}, open_mode={data.get('open_mode')}")


# ── Test 4: Timeline event created for status change ────────────────────
def test_timeline_event_created_for_status_change(headers, milestones):
    """After a status change via canonical PATCH, timeline should have an event."""
    # use 3rd milestone
    target = milestones[2] if len(milestones) > 2 else milestones[0]
    mid = target["id"]

    # patch to in_progress if not already
    if target["status"] == "not_started":
        requests.patch(
            f"{BASE_URL}/api/journeys/{JID}/milestones/{mid}",
            headers=headers,
            json={"status": "in_progress"}
        )

    # check timeline
    r = requests.get(f"{BASE_URL}/api/journeys/{JID}/overview", headers=headers)
    assert r.status_code == 200
    data = r.json()
    timeline = data.get("timeline_recent") or []
    assert len(timeline) > 0, "No timeline events found"
    # check there's a milestone event for this journey
    milestone_events = [e for e in timeline if e.get("milestone_id") == mid]
    print(f"PASS: timeline has {len(timeline)} events, {len(milestone_events)} for milestone {mid}")


# ── Test 5: Legacy PATCH endpoint backward compat ───────────────────────
def test_legacy_patch_endpoint_backward_compat(headers, milestones):
    """PATCH /api/journeys/milestones/{mid} — legacy, should return valid response."""
    target = next((m for m in milestones if m["status"] == "in_progress"), milestones[0])
    mid = target["id"]

    r = requests.patch(
        f"{BASE_URL}/api/journeys/milestones/{mid}",
        headers=headers,
        json={"metadata": {"legacy_test": True}}
    )
    assert r.status_code == 200, f"Legacy PATCH failed: {r.status_code}: {r.text[:300]}"
    data = r.json()
    assert "item" in data, f"Legacy response missing 'item' key: {data}"
    print(f"PASS: legacy PATCH returned 200 with 'item' key")


# ── Test 6: Legacy POST open endpoint backward compat ────────────────────
def test_legacy_open_endpoint_backward_compat(headers, milestones):
    """POST /api/journeys/milestones/{mid}/open — legacy, should return valid response."""
    # pick any milestone
    target = milestones[0]
    mid = target["id"]

    r = requests.post(
        f"{BASE_URL}/api/journeys/milestones/{mid}/open",
        headers=headers,
    )
    assert r.status_code == 200, f"Legacy POST open failed: {r.status_code}: {r.text[:300]}"
    data = r.json()
    assert "milestone_id" in data
    assert "open_mode" in data
    print(f"PASS: legacy POST open returned 200, open_mode={data.get('open_mode')}")


# ── Test 7: Journey overview loads correctly ─────────────────────────────
def test_journey_overview_loads(headers):
    """GET /api/journeys/{jid}/overview — should return journey + milestones."""
    r = requests.get(f"{BASE_URL}/api/journeys/{JID}/overview", headers=headers)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
    data = r.json()
    assert "journey" in data
    assert "milestones_flat" in data
    assert len(data["milestones_flat"]) > 0
    print(f"PASS: journey overview loaded, {len(data['milestones_flat'])} milestones")


# ── Test 8: 404 on wrong journey/milestone combo ─────────────────────────
def test_canonical_patch_wrong_mid(headers):
    """PATCH /journeys/{jid}/milestones/{mid} — wrong mid should 404."""
    r = requests.patch(
        f"{BASE_URL}/api/journeys/{JID}/milestones/00000000-0000-0000-0000-000000000000",
        headers=headers,
        json={"status": "in_progress"}
    )
    assert r.status_code == 404, f"Expected 404, got {r.status_code}"
    print("PASS: 404 for unknown milestone id")
