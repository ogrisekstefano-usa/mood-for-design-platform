"""ITER168 · Hotfix B — Platform router (phone codes + DB-driven languages).

Endpoints under test:
  GET   /api/platform/phone-dial-codes
  GET   /api/platform/phone-dial-codes/{iso2}
  GET   /api/platform/languages?scope=public|blueprint|all
  GET   /api/platform/admin/languages
  PATCH /api/platform/admin/languages/{code}
  POST  /api/platform/admin/languages/{code}/default
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://content-hub-pro-22.preview.emergentagent.com",
).rstrip("/")

ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASSWORD = "Blueprint2024!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200
    body = r.json()
    token = ((body.get("session") or {}).get("access_token")
             or body.get("access_token"))
    assert token
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ═══════════════════════════════════════════════════════════════════════
# § PHONE DIAL CODES (public)
# ═══════════════════════════════════════════════════════════════════════
class TestPhoneDialCodes:
    URL = f"{BASE_URL}/api/platform/phone-dial-codes"

    def test_full_list_returns_at_least_150_countries(self):
        r = requests.get(f"{self.URL}?locale=it")
        assert r.status_code == 200
        body = r.json()
        assert body["total"] >= 150
        assert len(body["codes"]) >= 150

    def test_top_priorities_ordered(self):
        r = requests.get(f"{self.URL}?locale=it")
        codes = r.json()["codes"]
        assert codes[0]["iso2"] == "IT"
        assert codes[0]["dial_code"] == "+39"
        assert codes[0]["label"] == "Italia"
        assert codes[1]["iso2"] == "US"
        assert codes[2]["iso2"] == "GB"

    def test_locale_en_resolves_to_english(self):
        r = requests.get(f"{self.URL}?locale=en")
        codes = r.json()["codes"]
        it = next(c for c in codes if c["iso2"] == "IT")
        # English label falls back to country_name (no 'en' key in name_i18n)
        assert it["label"] == "Italy"

    def test_search_finds_japan_by_italian_name(self):
        r = requests.get(f"{self.URL}?locale=it&q=giapp")
        codes = r.json()["codes"]
        assert any(c["iso2"] == "JP" for c in codes)
        # Verify the Japanese entry surfaces
        jp = next(c for c in codes if c["iso2"] == "JP")
        assert jp["dial_code"] == "+81"
        assert jp["label"] == "Giappone"

    def test_search_by_iso(self):
        r = requests.get(f"{self.URL}?q=CH")
        codes = r.json()["codes"]
        assert any(c["iso2"] == "CH" for c in codes)

    def test_search_by_dial_code(self):
        r = requests.get(f"{self.URL}?q=%2B971")  # +971 url-encoded
        codes = r.json()["codes"]
        assert any(c["iso2"] == "AE" for c in codes)

    def test_region_filter(self):
        r = requests.get(f"{self.URL}?region=mena")
        codes = r.json()["codes"]
        assert len(codes) >= 5
        assert all(c["region"] == "mena" for c in codes)
        assert any(c["iso2"] == "AE" for c in codes)
        assert any(c["iso2"] == "SA" for c in codes)

    def test_single_lookup_by_iso(self):
        r = requests.get(f"{self.URL}/IT?locale=it")
        assert r.status_code == 200
        body = r.json()
        assert body["iso2"] == "IT"
        assert body["dial_code"] == "+39"
        assert body["label"] == "Italia"

    def test_single_lookup_unknown_returns_404(self):
        r = requests.get(f"{self.URL}/ZZ")
        assert r.status_code == 404


# ═══════════════════════════════════════════════════════════════════════
# § PLATFORM LANGUAGES (public read)
# ═══════════════════════════════════════════════════════════════════════
class TestPlatformLanguages:
    URL = f"{BASE_URL}/api/platform/languages"

    def test_scope_public(self):
        r = requests.get(f"{self.URL}?scope=public")
        assert r.status_code == 200
        body = r.json()
        codes = {l["code"] for l in body["languages"]}
        # Currently public: it, en-US, en-GB, fr, de, es, ar
        assert "it" in codes
        assert "en-US" in codes
        assert "fr" in codes
        assert "ar" in codes
        # zh and ja currently disabled
        assert "zh" not in codes
        assert "ja" not in codes

    def test_scope_blueprint_excludes_arabic(self):
        r = requests.get(f"{self.URL}?scope=blueprint")
        codes = {l["code"] for l in r.json()["languages"]}
        assert "it" in codes
        assert "fr" in codes
        # ar is public but NOT blueprint operational
        assert "ar" not in codes

    def test_scope_all_excludes_disabled(self):
        r = requests.get(f"{self.URL}?scope=all")
        codes = {l["code"] for l in r.json()["languages"]}
        # zh and ja have enabled=false → still excluded
        assert "it" in codes
        assert "zh" not in codes


# ═══════════════════════════════════════════════════════════════════════
# § PLATFORM LANGUAGES (admin)
# ═══════════════════════════════════════════════════════════════════════
class TestPlatformLanguagesAdmin:
    def test_admin_list_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/platform/admin/languages")
        assert r.status_code in (401, 403)

    def test_admin_list_returns_all_9(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/platform/admin/languages")
        assert r.status_code == 200
        body = r.json()
        assert body["total"] == 9
        codes = {l["code"] for l in body["languages"]}
        assert codes == {"it", "en-US", "en-GB", "fr", "de", "es", "ar", "zh", "ja"}
        # Whitelist exposed
        assert "blueprint_operational_codes" in body

    def test_patch_toggle_ai_translation(self, admin_session):
        r = admin_session.patch(
            f"{BASE_URL}/api/platform/admin/languages/fr",
            json={"ai_translation_enabled": False})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["language"]["ai_translation_enabled"] is False
        # Restore
        admin_session.patch(f"{BASE_URL}/api/platform/admin/languages/fr",
                            json={"ai_translation_enabled": True})

    def test_patch_blueprint_enabled_rejects_non_operational(self, admin_session):
        """Cannot enable Blueprint for 'ar' (non-operational language)."""
        r = admin_session.patch(
            f"{BASE_URL}/api/platform/admin/languages/ar",
            json={"blueprint_enabled": True})
        assert r.status_code == 400
        assert "whitelist" in r.text.lower() or "blueprint" in r.text.lower()

    def test_patch_cannot_disable_default_locale(self, admin_session):
        """Cannot disable the current default locale (it)."""
        r = admin_session.patch(
            f"{BASE_URL}/api/platform/admin/languages/it",
            json={"enabled": False})
        assert r.status_code == 400

    def test_patch_unknown_code_returns_404(self, admin_session):
        r = admin_session.patch(
            f"{BASE_URL}/api/platform/admin/languages/xx",
            json={"enabled": True})
        assert r.status_code == 404

    def test_set_default_flips_atomically(self, admin_session):
        """Set en-US as default, then restore it."""
        # Set en-US as default
        r = admin_session.post(
            f"{BASE_URL}/api/platform/admin/languages/en-US/default")
        assert r.status_code == 200
        body = r.json()
        assert body["default_locale"] == "en-US"

        # Verify only one default
        lst = admin_session.get(
            f"{BASE_URL}/api/platform/admin/languages").json()["languages"]
        defaults = [l for l in lst if l["default_locale"]]
        assert len(defaults) == 1
        assert defaults[0]["code"] == "en-US"

        # Restore IT
        r = admin_session.post(
            f"{BASE_URL}/api/platform/admin/languages/it/default")
        assert r.status_code == 200

    def test_set_default_disabled_language_rejected(self, admin_session):
        """Cannot set 'zh' as default (it's disabled)."""
        r = admin_session.post(
            f"{BASE_URL}/api/platform/admin/languages/zh/default")
        assert r.status_code == 400
