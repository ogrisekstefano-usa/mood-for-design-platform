"""ITER155 verification · NEW authenticated answer-event endpoint at
/api/relations/intake/answer-event (no tenant_slug needed; tenant resolved
from session). Also confirms welcome.next_moments and designers roster
still work end-to-end.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
DEMO_EMAIL = "demo@moodfordesign.com"
DEMO_PASSWORD = "Blueprint2024!"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_headers(session):
    for _ in range(3):
        r = session.post(f"{BASE_URL}/api/auth/login",
                         json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
        if r.status_code == 200:
            tok = r.json()["session"]["access_token"]
            return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
        time.sleep(1)
    pytest.skip("login failed")


@pytest.fixture(scope="module")
def first_lead(session, auth_headers):
    r = session.get(f"{BASE_URL}/api/relations/leads?limit=10", headers=auth_headers, timeout=30)
    assert r.status_code == 200, r.text
    leads = r.json()["data"]
    assert leads, "no leads in fixture"
    return leads[0]


# ── Designers roster: roles relaxed to known set
def test_designers_roster_returns_data(session, auth_headers):
    r = session.get(f"{BASE_URL}/api/relations/designers", headers=auth_headers, timeout=30)
    assert r.status_code == 200, r.text
    payload = r.json()
    designers = payload.get("designers") or []
    assert isinstance(designers, list)
    assert len(designers) >= 1, "expected at least 1 designer in roster"
    # Every designer should have id and a name
    for d in designers:
        assert d.get("id")
        assert d.get("name") or d.get("display_name")


# ── Welcome payload contains continuation_interview when score < 0.95
def test_welcome_has_continuation_interview(session, auth_headers, first_lead):
    score = first_lead.get("progression_score") or 0
    wr = session.get(f"{BASE_URL}/api/relations/leads/{first_lead['id']}/welcome",
                     headers=auth_headers, timeout=30)
    assert wr.status_code == 200, wr.text
    payload = wr.json()
    kinds = [m.get("kind") for m in payload.get("next_moments", [])]
    if score < 0.95:
        assert "continuation_interview" in kinds, f"missing continuation_interview for score={score}"


# ── NEW authenticated answer-event endpoint
def test_answer_event_auth_required(session):
    r = session.post(f"{BASE_URL}/api/relations/intake/answer-event",
                     json={"question_key": "atmosphere_primary", "option_value": "calm"})
    assert r.status_code in (401, 403), f"expected auth required, got {r.status_code}"


def test_answer_event_returns_201_with_event_id(session, auth_headers, first_lead):
    body = {
        "question_key": "atmosphere_dominant_v2",
        "option_value": "calm",
        "lead_id": first_lead["id"],
        "session_id": str(uuid.uuid4()),
        "source_surface": "continuation_interview",
    }
    r = session.post(f"{BASE_URL}/api/relations/intake/answer-event",
                     json=body, headers=auth_headers, timeout=30)
    assert r.status_code == 201, f"{r.status_code} {r.text[:300]}"
    data = r.json()
    assert "event_id" in data and data["event_id"]
    assert "occurred_at" in data and data["occurred_at"]


def test_answer_event_missing_question_key_400(session, auth_headers):
    r = session.post(f"{BASE_URL}/api/relations/intake/answer-event",
                     json={"option_value": "calm"},
                     headers=auth_headers, timeout=30)
    assert r.status_code == 400


def test_answer_event_unknown_question_key_400(session, auth_headers):
    r = session.post(f"{BASE_URL}/api/relations/intake/answer-event",
                     json={"question_key": "this_does_not_exist_xyz", "option_value": "x"},
                     headers=auth_headers, timeout=30)
    assert r.status_code == 400


def test_answer_event_missing_value_400(session, auth_headers):
    r = session.post(f"{BASE_URL}/api/relations/intake/answer-event",
                     json={"question_key": "atmosphere_dominant_v2"},
                     headers=auth_headers, timeout=30)
    assert r.status_code == 400


def test_answer_event_does_not_require_tenant_slug(session, auth_headers, first_lead):
    """Critical fix: tenant is resolved from session, no slug param needed."""
    body = {
        "question_key": "atmosphere_dominant_v2",
        "option_value": "serene",
        "lead_id": first_lead["id"],
        "session_id": str(uuid.uuid4()),
    }
    # Explicitly NO tenant_slug query param
    r = session.post(f"{BASE_URL}/api/relations/intake/answer-event",
                     json=body, headers=auth_headers, timeout=30)
    assert r.status_code == 201, r.text
