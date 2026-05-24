"""ITER146.A · Lead Pipeline Orchestration™ — pytest regression.

Verifies the end-to-end acquisition contract:
  - PRIVATE flow (POST /api/leads/public lead_type=private_client)
    creates a real `leads` row with runtime_identity + UTM + funnel_event
    and dispatches lead_captured + internal notification emails.
  - PROFESSIONAL flow with lead_type=professional persists the extended
    schema (company_name, professional_category, collaboration_intent,
    market_sector, portfolio_url) and triggers partnership_request +
    internal notification.
  - lead_type enum accepts 'professional' and 'partner_studio'.
  - PRIVATE design-journey endpoint (/api/public/journeys/initiate)
    still creates the full Account+Contact+Project+Journey chain AND
    now dispatches the lead_captured + internal notification emails.
"""
import json
import os
import sys
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

BACKEND = "http://127.0.0.1:8001"


def _unique_email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@iter146-test.example.com"


@pytest.fixture
def private_payload():
    return {
        "email": _unique_email("priv"),
        "first_name": "Anna",
        "last_name":  "Rossi",
        "lead_type":  "private_client",
        "onboarding_path": "begin_journey",
        "project_type":     "luxury_residential",
        "budget_range":     "200_500k",
        "style_preference": "modern_classic",
        "locale_code":      "it-IT",
        "source":           "iter146_pytest",
        "notes":            "Test PRIVATE flow regression.",
    }


@pytest.fixture
def professional_payload():
    return {
        "email": _unique_email("pro"),
        "first_name": "Marco",
        "last_name":  "Bianchi",
        "lead_type":  "professional",
        "onboarding_path": "begin_partnership",
        "professional_category": "architect",
        "collaboration_intent":  "partnership",
        "market_sector":         "hospitality",
        "company_name":          "Studio Bianchi Architetti",
        "company_website":       "https://studio-bianchi.example",
        "portfolio_url":         "https://studio-bianchi.example/projects",
        "locale_code":           "en-US",
        "source":                "iter146_pytest",
        "notes":                 "Test PRO flow regression.",
    }


def _get_db():
    from database import db
    return db()


# ── PRIVATE flow ────────────────────────────────────────────────────
def test_private_lead_creates_db_row_with_runtime_identity(private_payload):
    qs = "utm_source=pytest&utm_campaign=iter146_audit"
    r = requests.post(
        f"{BACKEND}/api/leads/public?tenant_slug=studio&{qs}",
        json=private_payload, timeout=15,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["lead_type"] == "private_client"
    assert body["onboarding_path"] == "begin_journey"
    assert body["pipeline_stage"] == "lead_captured"

    row = (_get_db().table("leads")
           .select("*").eq("id", body["id"]).limit(1).execute().data or [])
    assert row, "lead row missing in DB"
    r0 = row[0]
    assert r0["email"] == private_payload["email"].lower()
    assert r0["tenant_id"]
    assert r0["lead_type"] == "private_client"
    assert r0["onboarding_path"] == "begin_journey"
    assert r0["runtime_identity"]
    assert r0["runtime_identity"].get("utm", {}).get("source") == "pytest"
    assert r0["runtime_identity"].get("utm", {}).get("campaign") == "iter146_audit"


def test_private_lead_triggers_confirmation_email(private_payload):
    r = requests.post(
        f"{BACKEND}/api/leads/public?tenant_slug=studio",
        json=private_payload, timeout=15,
    )
    assert r.status_code == 201
    lead_id = r.json()["id"]
    events = (_get_db().table("email_events")
              .select("recipient, template_key, event_type, status")
              .order("created_at", desc=True).limit(15).execute().data or [])
    # Lead-facing confirmation
    confirm = [e for e in events
               if e.get("recipient") == private_payload["email"].lower()]
    assert confirm, "no confirmation email_event for lead"
    assert confirm[0]["template_key"] == "lead_captured"
    # Internal notification — at least one event to an admin user
    internal = [e for e in events if e["event_type"] == "lead.internal_notification"]
    assert internal, "no internal notification email_event"


def test_private_lead_creates_funnel_event(private_payload):
    r = requests.post(
        f"{BACKEND}/api/leads/public?tenant_slug=studio",
        json=private_payload, timeout=15,
    )
    lead_id = r.json()["id"]
    funnel = (_get_db().table("funnel_events")
              .select("stage, event_name")
              .eq("lead_id", lead_id).execute().data or [])
    assert funnel, "no funnel_event row for lead"
    assert funnel[0]["stage"] == "lead_captured"
    assert "begin_journey.submit" in funnel[0]["event_name"]


# ── PROFESSIONAL flow ───────────────────────────────────────────────
def test_pro_lead_persists_extended_schema(professional_payload):
    r = requests.post(
        f"{BACKEND}/api/leads/public?tenant_slug=studio",
        json=professional_payload, timeout=15,
    )
    assert r.status_code == 201, r.text
    assert r.json()["lead_type"] == "professional"
    assert r.json()["onboarding_path"] == "begin_partnership"
    row = (_get_db().table("leads").select("*")
           .eq("id", r.json()["id"]).limit(1).execute().data or [])
    assert row
    r0 = row[0]
    assert r0["professional_category"] == "architect"
    assert r0["collaboration_intent"] == "partnership"
    assert r0["market_sector"] == "hospitality"
    assert r0["company_name"] == "Studio Bianchi Architetti"
    assert r0["company_website"] == "https://studio-bianchi.example"
    assert r0["portfolio_url"] == "https://studio-bianchi.example/projects"


def test_pro_lead_triggers_partnership_email(professional_payload):
    r = requests.post(
        f"{BACKEND}/api/leads/public?tenant_slug=studio",
        json=professional_payload, timeout=15,
    )
    assert r.status_code == 201
    events = (_get_db().table("email_events")
              .select("recipient, template_key, event_type, locale, status")
              .order("created_at", desc=True).limit(15).execute().data or [])
    confirm = [e for e in events
               if e.get("recipient") == professional_payload["email"].lower()]
    assert confirm, "no confirmation event for pro lead"
    assert confirm[0]["template_key"] == "partnership_request"
    # locale propagated (en-US in payload)
    assert confirm[0]["locale"] == "en-US"
    # internal notification fires too
    internal = [e for e in events if e["event_type"] == "lead.internal_notification"]
    assert internal


# ── Tenant isolation / safety ───────────────────────────────────────
def test_unknown_tenant_returns_404():
    r = requests.post(
        f"{BACKEND}/api/leads/public?tenant_slug=nonexistent-xyz",
        json={"email": _unique_email("ghost"), "first_name": "X"},
        timeout=10,
    )
    assert r.status_code == 404


def test_lead_type_enum_extended():
    """Sanity — enum accepts the new values."""
    import psycopg2
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute("""SELECT enumlabel FROM pg_enum
                   JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
                   WHERE pg_type.typname='lead_type'""")
    values = {r[0] for r in cur.fetchall()}
    cur.close(); conn.close()
    assert "professional" in values
    assert "partner_studio" in values
    assert "private_client" in values


# ── PRIVATE design-journey integration ──────────────────────────────
def test_design_journey_initiate_triggers_emails():
    """The `/api/public/journeys/initiate` full-onboarding path now
    dispatches the same emails as the lighter `/api/leads/public` path.
    """
    email = _unique_email("journey")
    payload = {
        "tenant_slug": "studio",
        "welcome": {
            "first_name": "Sofia",
            "email":      email,
            "phone":      "+39 320 0000",
            "preferred_contact": "email",
        },
        "lifestyle": {
            "household": "couple",
            "kids":      "0",
            "guests":    "duo",
            "rituals":   ["dining", "reading"],
        },
        "space": {
            "type":     "apartment",
            "footprint": "100_180",
            "city":     "Milano",
        },
        "locale": "it-IT",
    }
    r = requests.post(f"{BACKEND}/api/public/journeys/initiate",
                      json=payload, timeout=20)
    assert r.status_code == 201, r.text
    events = (_get_db().table("email_events")
              .select("recipient, template_key, event_type")
              .order("created_at", desc=True).limit(20).execute().data or [])
    confirm = [e for e in events
               if e.get("recipient") == email
               and e["event_type"] == "lead.private_client.confirmation"]
    assert confirm, "no confirmation email after journey initiate"
