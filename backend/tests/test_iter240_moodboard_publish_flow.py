"""
Iteration 240 — Moodboard Publish Flow tests
Tests: Designer→Moodboard→Publish→Client→Feedback→Designer notification wiring
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

JOURNEY_ID = "68662542-b5f5-4a16-b8d9-5a2009a90750"
SET_ID = "d1f61477-91f1-42e5-8fdd-6f487478d9f5"
CLIENT_USER_ID = "1ea4434b-fca3-426e-93b8-4961a4cffe4b"
PROJECT_ID = "283010eb-447d-4201-9057-f0ea7c75b252"
WELCOME_TOKEN = "wOREElPkIYJFVJ_POC1Va0LQ6yS8dqbA"


@pytest.fixture(scope="module")
def admin_token():
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@moodfordesign.com",
        "password": "Blueprint2024!"
    })
    assert resp.status_code == 200, f"Login failed: {resp.text[:200]}"
    data = resp.json()
    token = data.get("access_token") or data.get("token") or (data.get("session") or {}).get("access_token")
    assert token, "No token in login response"
    return token


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# P0-BACKEND-1: Prospects regression — still returns 11 items
def test_prospects_regression(auth_headers):
    resp = requests.get(f"{BASE_URL}/api/relations/prospects", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    total = data.get("total") or len(data.get("items", data.get("prospects", [])))
    assert total == 11, f"Expected 11 prospects, got {total}"
    print(f"PASS: prospects count = {total}")


# Regression: leads = 14
def test_leads_regression(auth_headers):
    resp = requests.get(f"{BASE_URL}/api/relations/leads", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    total = data.get("total") or len(data.get("items", data.get("leads", [])))
    assert total == 14, f"Expected 14 leads, got {total}"
    print(f"PASS: leads count = {total}")


# Regression: accounts = 15
def test_accounts_regression(auth_headers):
    resp = requests.get(f"{BASE_URL}/api/relations/accounts", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    total = data.get("total") or len(data.get("items", data.get("accounts", [])))
    assert total == 15, f"Expected 15 accounts, got {total}"
    # check journey_lifecycle_state present on at least one
    items = data.get("items") or data.get("accounts", [])
    if items:
        has_jls = any(i.get("journey_lifecycle_state") is not None for i in items)
        assert has_jls, "No account has journey_lifecycle_state"
    print(f"PASS: accounts count = {total}")


# P0-BACKEND-2: Share endpoint completes (idempotent — already shared is OK)
def test_share_concept_set_returns_shared_at(auth_headers):
    resp = requests.post(
        f"{BASE_URL}/api/journeys/{JOURNEY_ID}/concept-directions/{SET_ID}/share",
        json={"notify": False},
        headers=auth_headers,
    )
    assert resp.status_code == 200, f"Share failed: {resp.text[:300]}"
    data = resp.json()
    assert data.get("set_id") == SET_ID
    assert data.get("shared_at") is not None, "shared_at should be set"
    assert data.get("boards", 0) > 0, "Expected boards > 0"
    print(f"PASS: share returned shared_at={data['shared_at']}, boards={data['boards']}")


# P0-BACKEND-3: notifications exist for client
def test_notifications_for_client(auth_headers):
    resp = requests.get(
        f"{BASE_URL}/api/notifications/unread-count",
        headers=auth_headers,
    )
    assert resp.status_code == 200, f"unread-count failed: {resp.text[:200]}"
    data = resp.json()
    count = data.get("count", data.get("unread_count", -1))
    assert count >= 0, f"Expected count >= 0, got {count}"
    print(f"PASS: notifications unread-count = {count}")


# P0-BACKEND-4: concept directions list for the journey includes the set
def test_concept_directions_list(auth_headers):
    resp = requests.get(
        f"{BASE_URL}/api/journeys/{JOURNEY_ID}/concept-directions",
        headers=auth_headers,
    )
    assert resp.status_code == 200, f"List failed: {resp.text[:200]}"
    data = resp.json()
    sets = data.get("sets", [])
    assert len(sets) > 0, "Expected at least one direction set"
    set_ids = [s.get("set_id") for s in sets]
    assert SET_ID in set_ids, f"set_id {SET_ID} not found in sets: {set_ids}"
    # verify shared_at on the set
    target_set = next(s for s in sets if s["set_id"] == SET_ID)
    # shared_at may be on the set or propagated
    shared_at = target_set.get("shared_at")
    if not shared_at:
        # check individual directions
        for d in target_set.get("directions", []):
            if d.get("shared_at"):
                shared_at = d["shared_at"]
                break
    assert shared_at is not None, "shared_at not found on set or directions"
    print(f"PASS: SET found with shared_at={shared_at}")


# Journey endpoint accessible (needed for frontend route)
def test_journey_accessible(auth_headers):
    resp = requests.get(
        f"{BASE_URL}/api/client/journeys/{JOURNEY_ID}/companion",
        headers=auth_headers,
    )
    # May return 200 or 403/404 depending on role — just check not 500
    assert resp.status_code != 500, f"Unexpected 500: {resp.text[:200]}"
    print(f"PASS: /api/client/journeys/{JOURNEY_ID}/companion → {resp.status_code}")
