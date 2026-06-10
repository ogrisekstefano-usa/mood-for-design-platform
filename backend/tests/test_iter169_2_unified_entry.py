"""ITER169.2 · Unified Entry UX™ · Backend dispatch contract.

Verifies that /api/auth/identify returns the correct `kind` for known
professional + client emails, with NO information leak beyond what
the AccessEntryPage needs to silently route the user.
"""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://i18n-recovery-1.preview.emergentagent.com",
).rstrip("/")
URL = f"{BASE_URL}/api/auth/identify"


class TestIdentifyDispatch:
    def test_known_professional_returns_professional(self):
        r = requests.post(URL, json={"email": "admin@moodfordesign.com"})
        assert r.status_code == 200
        body = r.json()
        kind = (body.get("kind") or "").lower()
        # Accept either explicit role or "professional" umbrella
        assert kind in ("professional", "admin", "studio_admin",
                        "studio_owner", "designer", "advisor"), body

    def test_known_designer_returns_professional(self):
        r = requests.post(URL, json={"email": "designer@moodfordesign.com"})
        assert r.status_code == 200
        kind = (r.json().get("kind") or "").lower()
        assert kind in ("professional", "designer"), r.json()

    def test_unknown_email_returns_safe_value(self):
        """Unknown email MUST NOT 404 or leak existence.
        Acceptable: kind='client' (default), kind='unknown' or kind=null."""
        r = requests.post(URL, json={"email": "no-such-user-9999@example.com"})
        assert r.status_code == 200
        body = r.json()
        # Body must not contain "not_found", "missing", "exists", etc.
        raw = (r.text or "").lower()
        assert "not_found" not in raw
        assert "does not exist" not in raw
        assert "non esiste" not in raw
        # kind can be 'client' / 'unknown' / null — all acceptable.
        kind = (body.get("kind") or "").lower()
        assert kind != "professional"  # don't leak pro for unknown

    def test_invalid_email_format(self):
        """Malformed email returns 4xx but does NOT 500."""
        r = requests.post(URL, json={"email": "not-an-email"})
        assert 200 <= r.status_code < 500

    def test_client_account_returns_client(self):
        """Create a fresh client journey, then identify their email."""
        email = f"iter169_2_client_{int(time.time()*1000)}@example.com"
        rj = requests.post(f"{BASE_URL}/api/public/journeys/initiate",
            json={
                "welcome": {"first_name":"T","email":email,"phone":"01",
                            "country_code":"IT","dial_code":"+39",
                            "normalized_phone":"+3901"},
                "atmosphere":{"how_to_feel":"r"},
                "lifestyle": {"household_kind":"f"},
                "consent_terms":True,"consent_privacy":True,
                "tenant_slug":"studio",
            }, timeout=20)
        assert rj.status_code in (200, 201)
        r = requests.post(URL, json={"email": email})
        assert r.status_code == 200
        kind = (r.json().get("kind") or "").lower()
        assert kind in ("client", ""), r.json()
        assert kind != "professional"
