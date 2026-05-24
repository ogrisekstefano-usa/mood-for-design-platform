"""ITER148 · Sprint A · Relationship Engine v2 backend tests.

Cover:
  - GET /api/relationships/intake/groups returns 5 hierarchical groups
  - All 5 expected groups present (atmosphere/materials/lifestyle/timing/budget)
  - Total 32 options across the catalog
  - POST /api/relationships/intake/answer-event creates a tracked event
  - GET /leads/:id/answer-events returns ingested events for the lead
  - leads schema has relationship_temperature/designer_assigned/first_journey_id
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


def _admin_token() -> str | None:
    email = os.environ.get("TEST_ADMIN_EMAIL", "admin@moodfordesign.com")
    pw = os.environ.get("TEST_ADMIN_PASSWORD", "Blueprint2024!")
    r = requests.post(f"{API}/api/auth/login", json={"email": email, "password": pw}, timeout=15)
    if r.status_code != 200:
        return None
    d = r.json()
    return d.get("access_token") or (d.get("session") or {}).get("access_token")


def test_groups_catalog_structure():
    r = requests.get(f"{API}/api/relationships/intake/groups", timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    groups = body["groups"]
    keys = {g["group_key"] for g in groups}
    expected = {"atmosphere", "materials", "lifestyle", "project_timing", "budget_range"}
    assert expected.issubset(keys), f"Missing groups: {expected - keys}"
    # Total options
    total_opts = sum(len(q["options"]) for g in groups for q in g["questions"])
    assert total_opts >= 32, f"Expected ≥32 options, got {total_opts}"


def test_groups_ordering():
    r = requests.get(f"{API}/api/relationships/intake/groups", timeout=10)
    groups = r.json()["groups"]
    orders = [g["display_order"] for g in groups]
    assert orders == sorted(orders), f"Groups not in display_order: {orders}"


def test_question_types_are_valid():
    r = requests.get(f"{API}/api/relationships/intake/groups", timeout=10)
    valid = {"single_choice", "multi_choice", "slider", "chips", "visual_choice", "ranking"}
    for g in r.json()["groups"]:
        for q in g["questions"]:
            assert q["question_type"] in valid, f"Invalid type: {q['question_type']}"
            assert q["prompt"], f"Empty prompt for {q['question_key']}"


def test_atmosphere_options_match_spec():
    r = requests.get(f"{API}/api/relationships/intake/groups", timeout=10)
    atm = next(g for g in r.json()["groups"] if g["group_key"] == "atmosphere")
    opts = [o["value"] for o in atm["questions"][0]["options"]]
    expected = {"warm_enveloping", "minimal_silent", "editorial_luxury",
                "natural_calm", "hospitality_insp", "artistic_eclectic",
                "soft_contemporary", "timeless_elegance"}
    assert expected.issubset(set(opts)), f"Missing atmosphere options: {expected - set(opts)}"


def test_materials_chips_max_4():
    r = requests.get(f"{API}/api/relationships/intake/groups", timeout=10)
    mat = next(g for g in r.json()["groups"] if g["group_key"] == "materials")
    q = mat["questions"][0]
    assert q["question_type"] == "chips"
    assert q["max_selections"] == 4


def test_answer_event_ingest_and_list():
    """Public ingest + authenticated retrieval."""
    session_id = str(uuid.uuid4())
    # First create a lead via the v1 endpoint to anchor events
    payload = {
        "lead_type": "private_client",
        "email": f"sprint-a+{uuid.uuid4().hex[:6]}@test.local",
        "first_name": "Sprint",
        "last_name": "A",
        "locale_code": "it-IT",
        "closed_answers": {"space_typology": "villa"},
    }
    r = requests.post(
        f"{API}/api/relationships/intake/closed-answers?tenant_slug={TENANT_SLUG}",
        json=payload, timeout=15)
    assert r.status_code == 201, r.text
    lead_id = r.json()["id"]

    # Ingest 3 answer events
    events = [
        ("atmosphere_dominant_v2", "warm_enveloping"),
        ("material_affinities_v2", "walnut"),
        ("budget_range_v2",        "bespoke"),
    ]
    for q_key, opt in events:
        ev = requests.post(
            f"{API}/api/relationships/intake/answer-event?tenant_slug={TENANT_SLUG}",
            json={
                "question_key": q_key,
                "option_value": opt,
                "lead_id":      lead_id,
                "session_id":   session_id,
                "source_surface": "intake_wizard",
            }, timeout=10)
        assert ev.status_code == 201, ev.text

    # Authenticated list
    tok = _admin_token()
    if not tok:
        pytest.skip("Admin auth unavailable")
    r = requests.get(
        f"{API}/api/relationships/leads/{lead_id}/answer-events",
        headers={"Authorization": f"Bearer {tok}"}, timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert len(data) >= 3
    q_keys = {e["question_key"] for e in data}
    assert {"atmosphere_dominant_v2", "material_affinities_v2", "budget_range_v2"}.issubset(q_keys)


def test_leads_relationship_columns_present():
    """Verify migration 084 columns are queryable on leads."""
    from database import db
    res = db().table('leads').select(
        'id, relationship_temperature, designer_assigned, first_journey_id'
    ).limit(1).execute()
    assert res is not None  # query must not raise


def test_unknown_question_key_rejected():
    r = requests.post(
        f"{API}/api/relationships/intake/answer-event?tenant_slug={TENANT_SLUG}",
        json={"question_key": "no_such_question_xyz", "option_value": "x"},
        timeout=10)
    assert r.status_code == 400
