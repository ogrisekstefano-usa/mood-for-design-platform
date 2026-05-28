"""ITER167 Round 4 — Real Mobile QA del Client Magic-Link.

Backend coverage:
  • POST /api/journey/initiate with country_code/dial_code/normalized_phone
  • POST /api/auth/silent-magic-link  (no raw Supabase leak)
  • POST /api/auth/identify  (enumeration-safe)
  • email_templates.render('magic_link', ...) cinematic + dark-mode meta
"""

import os
import time
import sys
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://content-hub-pro-22.preview.emergentagent.com",
).rstrip("/")

ADMIN_EMAIL = "admin@moodfordesign.com"

# Ensure backend package on sys.path for direct template rendering
sys.path.insert(0, "/app/backend")


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ── /api/auth/identify enumeration-safe ──────────────────────────────────────
class TestIdentify:
    URL = f"{BASE_URL}/api/auth/identify"

    def test_admin_returns_professional_password_exists(self, s):
        r = s.post(self.URL, json={"email": ADMIN_EMAIL})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("kind") == "professional"
        assert body.get("password_exists") is True

    def test_unknown_returns_client_no_password(self, s):
        unique = f"newclient_{int(time.time()*1000)}@example.com"
        r = s.post(self.URL, json={"email": unique})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("kind") == "client"
        assert body.get("password_exists") is False

    def test_enumeration_safe_shape(self, s):
        r1 = s.post(self.URL, json={"email": ADMIN_EMAIL}).json()
        r2 = s.post(self.URL, json={"email": f"ghost_{int(time.time())}@example.com"}).json()
        assert set(r1.keys()) == set(r2.keys())


# ── /api/auth/silent-magic-link ──────────────────────────────────────────────
class TestSilentMagicLink:
    URL = f"{BASE_URL}/api/auth/silent-magic-link"

    def test_admin_200(self, s):
        r = s.post(self.URL, json={"email": ADMIN_EMAIL})
        assert r.status_code == 200, r.text

    def test_no_raw_supabase_leak(self, s):
        # Force-trigger with various inputs; never expose internals.
        for payload in (
            {"email": ADMIN_EMAIL},
            {"email": f"ghost_{int(time.time())}@example.com"},
        ):
            r = s.post(self.URL, json=payload)
            assert r.status_code == 200
            text = r.text.lower()
            for forbidden in ("supabase", "sqlalchemy", "traceback", "psycopg",
                              "postgres", "internal server error"):
                assert forbidden not in text, f"raw leak '{forbidden}' in {text!r}"


# ── /api/journey/initiate with country prefix ────────────────────────────────
class TestJourneyInitiate:
    # Actual mounted path is /api/public/journeys/initiate (status 201).
    URL = f"{BASE_URL}/api/public/journeys/initiate"

    def _payload(self, email: str):
        return {
            "welcome": {
                "first_name": "Maria",
                "email": email,
                "phone": "0123 456 7890",
                "country_code": "IT",
                "dial_code": "+39",
                "normalized_phone": "+391234567890",
            },
            "spaces": ["casa"],
            "guests": ["da_soli"],
            "ambiance": ["caldi_avvolgenti"],
        }

    def test_initiate_returns_200_with_continuity_link(self, s):
        email = f"maria{int(time.time()*1000)}@example.com"
        r = s.post(self.URL, json=self._payload(email))
        assert r.status_code in (200, 201), r.text
        body = r.json()
        # Must contain at least one of the continuity surfaces
        assert any(k in body for k in ("magic_link_url", "welcome_url", "welcome_token")), body
        assert "journey_id" in body or "lead_id" in body

    def test_initiate_accepts_phone_metadata(self, s):
        """No 422; metadata fields accepted."""
        email = f"maria_meta_{int(time.time()*1000)}@example.com"
        r = s.post(self.URL, json=self._payload(email))
        assert r.status_code in (200, 201), r.text


# ── email_templates.render('magic_link', ...) ────────────────────────────────
class TestMagicLinkEmailRender:
    def _ctx(self):
        return {
            "magic_url": "https://example.com/auth/magic?token=xyz",
            "first_name": "Maria",
            "studio_name": "Studio Ogrisek",
            "referente_name": "Stefano Ogrisek",
            "hero_quote": "Vorrei una casa che mi faccia rallentare.",
            "tenant_id": "848354b9-a43e-4147-bdad-116fb93bd585",
            "locale": "it-IT",
        }

    def test_subject_contains_spazio_progettuale_attesa(self):
        from services.email_templates import render
        subject, html, text = render("magic_link", self._ctx())
        assert "spazio progettuale" in subject.lower()
        assert "ti aspetta" in subject.lower()

    def test_html_contains_editorial_strings(self):
        from services.email_templates import render
        _subject, html, _text = render("magic_link", self._ctx())
        assert "Bentornato, Maria." in html
        assert "Vorrei una casa" in html
        assert "Apri il tuo spazio progettuale" in html
        assert "Stefano Ogrisek" in html
        assert "Con cura" in html

    def test_html_no_banned_terms(self):
        from services.email_templates import render
        _subject, html, _text = render("magic_link", self._ctx())
        low = html.lower()
        for banned in ("accedi", "sign in", "entra nel tuo spazio"):
            assert banned not in low, f"banned term in html: {banned}"
        # 'login' may appear only inside attribute names? we want zero in copy.
        # Strip tag attributes by quick check on text-visible regions.
        # Just disallow >login< style hits in visible text spans.
        assert ">login<" not in low and ">Login<" not in html

    def test_dark_mode_meta_present(self):
        from services.email_templates import render
        _subject, html, _text = render("magic_link", self._ctx())
        assert 'name="color-scheme"' in html
        assert 'content="dark light"' in html
        assert 'name="supported-color-schemes"' in html
        assert "prefers-color-scheme: dark" in html or "prefers-color-scheme:dark" in html
