"""ITER167 — Adaptive Access™ Layer backend tests.

Covers:
  • POST /api/auth/identify  (enumeration-safe role-aware probe)
  • POST /api/auth/silent-magic-link  (opaque 200 always)
"""

import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://content-hub-pro-22.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASSWORD = "Blueprint2024!"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ── /api/auth/identify ────────────────────────────────────────────────────────
class TestIdentify:
    URL = f"{BASE_URL}/api/auth/identify"

    def test_professional_returns_password_exists_true(self, s):
        r = s.post(self.URL, json={"email": ADMIN_EMAIL})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("kind") == "professional"
        assert body.get("password_exists") is True

    def test_unknown_email_returns_client_no_password(self, s):
        unique = f"newclient_{int(time.time()*1000)}@example.com"
        r = s.post(self.URL, json={"email": unique})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("kind") == "client"
        assert body.get("password_exists") is False

    def test_invalid_email_rejected(self, s):
        r = s.post(self.URL, json={"email": "not-an-email"})
        # Pydantic email validation → 422
        assert r.status_code in (400, 422)

    def test_no_enumeration_leak_shape(self, s):
        """Both known + unknown must return the SAME response shape."""
        r1 = s.post(self.URL, json={"email": ADMIN_EMAIL}).json()
        r2 = s.post(self.URL, json={"email": f"ghost_{int(time.time())}@example.com"}).json()
        assert set(r1.keys()) == set(r2.keys()), f"keys differ: {r1.keys()} vs {r2.keys()}"


# ── /api/auth/silent-magic-link  (opaque) ────────────────────────────────────
class TestSilentMagicLink:
    URL = f"{BASE_URL}/api/auth/silent-magic-link"

    def test_known_email_returns_200(self, s):
        r = s.post(self.URL, json={"email": ADMIN_EMAIL})
        assert r.status_code == 200, r.text

    def test_unknown_email_also_200_opaque(self, s):
        r = s.post(self.URL, json={"email": f"ghost_{int(time.time())}@example.com"})
        assert r.status_code == 200, r.text


# ── regression: /journey/preparing reachable (frontend route — backend should not 401 block) ──
class TestJourneyPreparingNotBlocked:
    def test_storefront_root_200(self, s):
        # storefront content endpoint should be public
        r = s.get(f"{BASE_URL}/api/storefront/public/home")
        # We only care it doesn't 401/500 (404 acceptable if route absent)
        assert r.status_code in (200, 404), r.text
