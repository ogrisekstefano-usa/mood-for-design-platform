"""ITER146 Wave A retest — Fix B: /begin-journey unified leads row
must capture FULL runtime_identity envelope (resolved_host,
resolved_subdomain, tenant_slug, request_host, user_agent, source_locale,
utm) AND the journey keys (onboarding_path, journey_id, project_id,
account_id, atmosphere, lifestyle).

This is the parity check vs routers/leads.py.
"""
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
    return f"{prefix}-{uuid.uuid4().hex[:10]}@iter149-test.example.com"


def _get_db():
    from database import db
    return db()


def test_begin_journey_unified_leads_row_has_full_runtime_identity():
    email = _unique_email("journey-parity")
    payload = {
        "tenant_slug": "studio",
        "welcome": {
            "first_name": "Giulia",
            "email":      email,
            "phone":      "+39 333 0000",
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
    headers = {
        "Origin": "https://i18n-recovery-1.preview.emergentagent.com",
        "Referer": "https://i18n-recovery-1.preview.emergentagent.com/begin-journey",
        "User-Agent": "ITER149-PytestParity/1.0",
        "Host": "content-hub-pro-22.preview.emergentagent.com",
        "X-Forwarded-Host": "content-hub-pro-22.preview.emergentagent.com",
    }
    r = requests.post(f"{BACKEND}/api/public/journeys/initiate",
                      json=payload, headers=headers, timeout=20)
    assert r.status_code == 201, r.text

    # Find the unified leads row
    row = (_get_db().table("leads").select("*")
           .eq("email", email.lower())
           .order("created_at", desc=True).limit(1).execute().data or [])
    assert row, f"no unified leads row for {email}"
    ri = row[0].get("runtime_identity") or {}
    print("runtime_identity:", ri)

    # Existing keys (from previous iteration)
    assert ri.get("onboarding_path") == "begin_journey", ri
    assert ri.get("journey_id"), ri
    assert ri.get("project_id"), ri
    assert ri.get("account_id"), ri
    assert "atmosphere" in ri, ri  # key must exist; may be {} if no step1
    assert ri.get("lifestyle"), ri

    # NEW parity keys (Fix B)
    assert ri.get("tenant_slug") == "studio", ri
    assert ri.get("resolved_host"), ri
    assert ri.get("resolved_subdomain"), ri
    assert ri.get("request_host"), ri
    assert ri.get("user_agent"), ri
    # source_locale must be present and reflect payload locale
    assert ri.get("source_locale") == "it-IT", ri
