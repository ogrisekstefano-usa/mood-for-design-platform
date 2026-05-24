"""ITER148 · Phase 1 · Lead Data Model 2.0 backend tests.

Cover:
  - GET /api/relationships/intake/questions returns 16 seeded items
    (15 closed + 1 narrative) with expected sections
  - compute_signals() pure logic: simple lead → 'lead', strong → 'prospect'
  - POST /api/relationships/intake/closed-answers creates a lead with
    computed behavioral_tags / atmosphere / material / cultural_register
  - PATCH /closed-answers re-computes and bumps progression
  - GET /leads/:id/profile returns the full computed surface
"""
import os
import uuid
import pytest
import requests
from pathlib import Path

import sys
BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from dotenv import load_dotenv
load_dotenv(BACKEND / ".env")

API = os.environ.get("REACT_APP_BACKEND_URL_INTERNAL") or "http://localhost:8001"
TENANT_SLUG = os.environ.get("TEST_TENANT_SLUG", "studio")


@pytest.fixture(scope="module")
def headers_anon():
    return {"Content-Type": "application/json"}


def _auth_token() -> str | None:
    """Login as admin@moodfordesign.com to get a JWT for protected reads."""
    email = os.environ.get("TEST_ADMIN_EMAIL", "admin@moodfordesign.com")
    pw = os.environ.get("TEST_ADMIN_PASSWORD", "Blueprint2024!")
    r = requests.post(f"{API}/api/auth/login",
                      json={"email": email, "password": pw}, timeout=15)
    if r.status_code != 200:
        return None
    data = r.json()
    return data.get("access_token") or (data.get("session") or {}).get("access_token")


def test_question_catalog_is_seeded(headers_anon):
    r = requests.get(f"{API}/api/relationships/intake/questions", timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 15, f"Expected ≥15 questions, got {body['total']}"
    sections = {q["section_key"] for q in body["data"]}
    assert {"space", "atmosphere", "material", "cultural", "engagement"} \
        .issubset(sections), f"Missing sections: {sections}"
    # Required closed questions count
    required_closed = [q for q in body["data"]
                       if q["is_required"] and q["question_type"] in ("single","multi")]
    assert len(required_closed) >= 7, f"Expected ≥7 required closed, got {len(required_closed)}"


def test_compute_signals_pure_lead():
    """A minimal answer set should produce a 'lead' progression state."""
    from services.lead_intake_engine import compute_signals
    answers = {
        "space_typology": "apartment",
        "space_size": "80_150",
        "space_phase": "ideation",
    }
    out = compute_signals(answers, lead_type="private_client")
    assert out["progression_state"] == "lead"
    assert 0.0 <= out["progression_score"] <= 1.0
    assert "residential" in out["behavioral_tags"]


def test_compute_signals_strong_prospect():
    """Full answer set with high-intent signals should yield 'prospect'."""
    from services.lead_intake_engine import compute_signals
    answers = {
        "space_typology": "villa",
        "space_size": "over_600",
        "space_phase": "post_acquisition",
        "space_ownership": "owner",
        "space_location_type": "seaside",
        "atmosphere_dominant": ["nordic_silence", "japandi"],
        "mood_register": "restrained",
        "light_preference": "natural_north",
        "material_affinities": ["marble", "natural_wood", "brushed_metal"],
        "material_avoid": ["chrome"],
        "cultural_register_preference": "editorial",
        "decision_horizon": "within_3m",
        "budget_register": "atelier",
        "preferred_cadence": "weekly",
        "preferred_channel": "studio_visit",
    }
    out = compute_signals(answers, lead_type="private_client")
    assert out["progression_state"] == "prospect", out
    assert out["progression_score"] >= 0.75
    assert out["cultural_register"] == "editorial"
    assert out["luxury_perception_tier"] == "atelier"
    assert "nordic_silence" in out["atmosphere_signals"]
    assert "marble" in out["material_signals"]
    assert "atelier_tier" in out["behavioral_tags"]


def test_public_ingest_creates_lead(headers_anon):
    """POST /intake/closed-answers should create a lead with computed signals."""
    payload = {
        "lead_type": "private_client",
        "first_name": "Test",
        "last_name": "ITER148",
        "email": f"iter148+{uuid.uuid4().hex[:6]}@test.local",
        "locale_code": "it-IT",
        "closed_answers": {
            "space_typology": "villa",
            "space_size": "300_600",
            "space_phase": "renovation",
            "atmosphere_dominant": ["warm_editorial"],
            "mood_register": "layered",
            "material_affinities": ["marble", "natural_wood"],
            "cultural_register_preference": "concierge",
            "decision_horizon": "within_6m",
            "budget_register": "couture",
        },
        "narrative_seed": "Una casa che parli di silenzio.",
    }
    r = requests.post(
        f"{API}/api/relationships/intake/closed-answers"
        f"?tenant_slug={TENANT_SLUG}",
        json=payload, headers=headers_anon, timeout=15)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["created"] is True
    assert body["progression_state"] in ("lead", "prospect")
    assert body["cultural_register"] == "concierge"
    assert body["luxury_perception_tier"] == "couture"
    assert "warm_editorial" in body["atmosphere_signals"]
    assert "marble" in body["material_signals"]
    assert "marble" in body["material_signals"]
    # store for next test
    pytest.lead_id = body["id"]


def test_authenticated_profile_read():
    """GET /leads/:id/profile should return the full computed surface."""
    token = _auth_token()
    if not token:
        pytest.skip("Admin auth unavailable in env")
    lead_id = getattr(pytest, "lead_id", None)
    if not lead_id:
        pytest.skip("Depends on test_public_ingest_creates_lead")
    r = requests.get(
        f"{API}/api/relationships/leads/{lead_id}/profile",
        headers={"Authorization": f"Bearer {token}"}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"] == lead_id
    assert body["lead_type"] == "private_client"
    assert body["luxury_perception_tier"] == "couture"
    assert body["cultural_register"] == "concierge"
    assert "marble" in body["material_signals"]
    assert "warm_editorial" in body["atmosphere_signals"]
    assert isinstance(body["behavioral_tags"], list)
    assert body["narrative_seed"] == "Una casa che parli di silenzio."


def test_patch_closed_answers_re_computes():
    """PATCH /closed-answers should re-compute progression on the same lead."""
    token = _auth_token()
    if not token:
        pytest.skip("Admin auth unavailable in env")
    lead_id = getattr(pytest, "lead_id", None)
    if not lead_id:
        pytest.skip("Depends on test_public_ingest_creates_lead")
    strong = {
        "closed_answers": {
            "space_typology": "villa",
            "space_size": "over_600",
            "space_phase": "post_acquisition",
            "space_ownership": "owner",
            "space_location_type": "seaside",
            "atmosphere_dominant": ["nordic_silence", "japandi"],
            "mood_register": "restrained",
            "light_preference": "natural_north",
            "material_affinities": ["marble", "natural_wood", "brushed_metal"],
            "cultural_register_preference": "editorial",
            "decision_horizon": "immediate",
            "budget_register": "atelier",
            "preferred_cadence": "weekly",
            "preferred_channel": "studio_visit",
        }
    }
    r = requests.patch(
        f"{API}/api/relationships/leads/{lead_id}/closed-answers",
        json=strong,
        headers={"Authorization": f"Bearer {token}"}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["progression_state"] == "prospect"
    assert body["progression_score"] >= 0.75
    assert body["luxury_perception_tier"] == "atelier"
