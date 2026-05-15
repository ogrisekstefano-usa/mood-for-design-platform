"""
Phase W — Platform Regression + Surface Hardening
Backend smoke test: every endpoint at /api/storefront/admin/*,
/api/client-messages/*, /api/human-assignment/*, /api/profile/me,
/api/tenant-onboarding/* and /api/onboarding/* must return 401 for
unauthenticated requests and reject fake tokens.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://content-hub-pro-22.preview.emergentagent.com").rstrip("/")
FAKE_BEARER = {"Authorization": "Bearer not.a.real.jwt.token"}


# ---- Anonymous / 401 expected ----
ANON_PROTECTED = [
    ("GET",  "/api/storefront/admin/registry"),
    ("GET",  "/api/storefront/admin/pages"),
    ("GET",  "/api/storefront/admin/pages/home"),
    ("POST", "/api/storefront/admin/pages/home/sections"),
    ("GET",  "/api/client-messages/thread"),
    ("GET",  "/api/client-messages/assignee/queue"),
    ("POST", "/api/client-messages/00000000-0000-0000-0000-000000000000/suggest-opening"),
    ("GET",  "/api/human-assignment/me"),
    ("GET",  "/api/profile/me"),
    ("GET",  "/api/tenant-onboarding/status"),
]


class TestAnonymousReturns401:
    """Unauthenticated requests should return 401 (or 403)."""

    @pytest.mark.parametrize("method,path", ANON_PROTECTED)
    def test_anon_blocked(self, method, path):
        url = f"{BASE_URL}{path}"
        r = requests.request(method, url, json={} if method == "POST" else None, timeout=10)
        # 401 preferred; 403 acceptable for some guards; 404 only acceptable
        # if the route legitimately requires a resource id we don't have.
        assert r.status_code in (401, 403), (
            f"{method} {path} expected 401/403, got {r.status_code} body={r.text[:200]}"
        )


class TestFakeTokenRejected:
    """Bogus bearer tokens should also be rejected."""

    @pytest.mark.parametrize("method,path", ANON_PROTECTED)
    def test_fake_token_blocked(self, method, path):
        url = f"{BASE_URL}{path}"
        r = requests.request(method, url, headers=FAKE_BEARER,
                             json={} if method == "POST" else None, timeout=10)
        assert r.status_code in (401, 403), (
            f"{method} {path} (fake token) expected 401/403, got {r.status_code} body={r.text[:200]}"
        )


# ---- Public endpoints that MUST stay anonymous-accessible ----
class TestPublicEndpointsStayOpen:
    def test_briefing_summary_public(self):
        """POST /api/onboarding/briefing-summary must be anonymous (Phase V)."""
        url = f"{BASE_URL}/api/onboarding/briefing-summary"
        r = requests.post(url, json={
            "project_type": "apartment",
            "spaces": ["living"],
            "moods": ["minimal"],
        }, timeout=30)
        assert r.status_code == 200, f"expected 200, got {r.status_code} body={r.text[:300]}"
        body = r.json()
        assert "briefing" in body, f"missing briefing key: {body}"

    def test_storefront_public_pages(self):
        """Public storefront resolver must remain anonymous."""
        url = f"{BASE_URL}/api/storefront/public/mood-demo-studio-81a09e/home"
        r = requests.get(url, timeout=10)
        # 200 if seeded, 404 if not — must NOT be 401.
        assert r.status_code in (200, 404), f"unexpected {r.status_code}"


# ---- Auth: login & cookie shape (Phase R/S regression) ----
class TestLoginShape:
    def test_demo_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@moodfordesign.com",
            "password": "Blueprint2024!",
        }, timeout=15)
        assert r.status_code == 200, f"demo login failed: {r.status_code} {r.text[:300]}"
        body = r.json()
        # Expect at least a user or token in shape
        assert ("user" in body) or ("access_token" in body) or ("token" in body), (
            f"login response missing identifiers: {body}"
        )

    def test_designer_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "designer@moodfordesign.com",
            "password": "Designer2024!",
        }, timeout=15)
        assert r.status_code == 200, r.text[:300]

    def test_client_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "client@moodfordesign.com",
            "password": "Client2024!",
        }, timeout=15)
        assert r.status_code == 200, r.text[:300]

    def test_studio2_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "studio2@moodfordesign.com",
            "password": "Studio2024!",
        }, timeout=15)
        assert r.status_code == 200, r.text[:300]


# ---- Cross-tenant: studio2 (Showroom) must not see Studio data ----
def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": email, "password": password,
    }, timeout=15)
    if r.status_code != 200:
        return None, None
    body = r.json()
    token = body.get("access_token") or body.get("token") or (body.get("user", {}) or {}).get("token")
    cookies = r.cookies
    return token, cookies


class TestCrossTenantIsolation:
    def test_studio2_storefront_pages_isolated(self):
        token, cookies = _login("studio2@moodfordesign.com", "Studio2024!")
        if not token and not cookies:
            pytest.skip("studio2 login did not return token or cookies")
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        r = requests.get(f"{BASE_URL}/api/storefront/admin/pages",
                         headers=headers, cookies=cookies, timeout=15)
        assert r.status_code in (200, 401, 403), f"unexpected {r.status_code}: {r.text[:200]}"
        if r.status_code == 200:
            pages = r.json()
            # Should belong to studio2's tenant (mood-demo), not Demo Studio.
            txt = str(pages).lower()
            assert "mood-demo-studio-81a09e" not in txt, "Studio2 leaked Demo Studio tenant slug"
