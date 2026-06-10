"""Backend regression for Iteration 71 — Advisor rich profile fields.

Verifies that PATCH /api/advisor/admin/advisors/{aid} accepts and persists
market_specialization, relationship_tags, and notes.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://i18n-recovery-1.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "demo@moodfordesign.com"
ADMIN_PWD = "Blueprint2024!"
ADVISOR_ID = "e508a1b6-34ca-4c8a-b1ca-3327faf73fbe"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD}, timeout=30)
    assert r.status_code == 200, f"Login failed {r.status_code}: {r.text}"
    data = r.json()
    sess = data.get("session") or {}
    tok = sess.get("access_token") or data.get("access_token") or data.get("token")
    if not tok:
        pytest.skip(f"No token in response: {data}")
    return tok


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def test_admin_list_advisors(headers):
    r = requests.get(f"{BASE_URL}/api/advisor/admin/advisors", headers=headers, timeout=30)
    assert r.status_code == 200, f"{r.status_code} {r.text}"


def test_patch_rich_profile_fields(headers):
    payload = {
        "market_specialization": ["Hospitality", "Retail"],
        "relationship_tags": ["consigliere", "warm"],
        "notes": "TEST_Iteration71 rich profile patch",
    }
    r = requests.patch(
        f"{BASE_URL}/api/advisor/admin/advisors/{ADVISOR_ID}",
        headers=headers, json=payload, timeout=30,
    )
    assert r.status_code == 200, f"PATCH failed {r.status_code}: {r.text}"
    body = r.json()
    # GET back and verify
    g = requests.get(f"{BASE_URL}/api/advisor/admin/advisors/{ADVISOR_ID}", headers=headers, timeout=30)
    assert g.status_code == 200, f"GET failed {g.status_code}: {g.text}"
    adv = g.json()
    # may be nested under 'advisor'
    if "advisor" in adv:
        adv = adv["advisor"]
    assert adv.get("market_specialization") == ["Hospitality", "Retail"], f"market_specialization mismatch: {adv.get('market_specialization')}"
    assert adv.get("relationship_tags") == ["consigliere", "warm"], f"relationship_tags mismatch: {adv.get('relationship_tags')}"
    assert adv.get("notes") == "TEST_Iteration71 rich profile patch", f"notes mismatch: {adv.get('notes')}"
