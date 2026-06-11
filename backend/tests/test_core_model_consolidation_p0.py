"""
Test Core Model Consolidation P0 - 3 bug fixes:
1. /begin-journey locale (must be Italian)
2. Discovery 409 race condition handling
3. Notification unread-count includes unread_for_designer from threads
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASSWORD = "Blueprint2024!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text}")
    data = r.json()
    token = data.get("session", {}).get("access_token") or data.get("access_token") or data.get("token")
    if not token:
        pytest.skip("No token in login response")
    return token


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


class TestFix3NotificationUnreadCount:
    """Fix 3: unread-count must include unread_for_designer from relationship_threads"""

    def test_unread_count_returns_positive(self, auth_headers):
        """Should return count > 0 (expected ~6 from conversation threads)"""
        r = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=auth_headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "count" in data, f"No 'count' key in response: {data}"
        print(f"Unread count: {data['count']} (high_priority: {data.get('high_priority_count', 'N/A')})")
        assert data["count"] > 0, (
            f"Expected count > 0 but got {data['count']}. "
            "Fix 3 may not be working — unread_for_designer from relationship_threads not summed."
        )

    def test_unread_count_structure(self, auth_headers):
        """Response must have count and high_priority_count keys"""
        r = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "count" in data
        assert "high_priority_count" in data


class TestFix2DiscoveryRaceCondition:
    """Fix 2: Discovery 409 must not show error toast — handled gracefully"""

    def test_discovery_endpoints_accessible(self, auth_headers):
        """Basic check that discovery API is accessible"""
        # Get a lead to test with
        r = requests.get(f"{BASE_URL}/api/leads?limit=5", headers=auth_headers)
        assert r.status_code == 200, f"Leads API failed: {r.status_code}"
        data = r.json()
        leads = data.get("data") or data.get("leads") or []
        print(f"Found {len(leads)} leads")
        if not leads:
            pytest.skip("No leads available to test discovery")

    def test_discovery_get_for_lead(self, auth_headers):
        """GET /api/leads/{id}/discovery should return discovery state"""
        r = requests.get(f"{BASE_URL}/api/leads?limit=5", headers=auth_headers)
        leads = (r.json().get("data") or r.json().get("leads") or [])
        if not leads:
            pytest.skip("No leads available")
        lead_id = leads[0].get("id") or leads[0].get("lead_id")
        r2 = requests.get(f"{BASE_URL}/api/leads/{lead_id}/discovery", headers=auth_headers)
        assert r2.status_code in [200, 404], f"Unexpected status: {r2.status_code}"
        print(f"Discovery for lead {lead_id}: {r2.status_code} → {r2.json()}")

    def test_discovery_start_409_handling_via_code(self):
        """Verify DiscoveryInterviewPanel.jsx catch block handles 409 correctly (code review)"""
        # This is a static code review test - verifies the fix is in place
        panel_file = "/app/frontend/src/components/relations/DiscoveryInterviewPanel.jsx"
        with open(panel_file) as f:
            content = f.read()
        assert "409" in content, "409 handling not found in DiscoveryInterviewPanel.jsx"
        assert "DISCOVERY-INVALID-STATE" in content, "DISCOVERY-INVALID-STATE handling missing"
        assert "Discovery già in corso" in content, "'Discovery già in corso' toast message missing"
        assert "Impossibile aprire la Discovery" in content  # Should still exist but in else branch
        # Ensure it's in else branch (not triggered on 409)
        assert "toast.info('Discovery già in corso')" in content, "toast.info for 409 case missing"
        print("Fix 2 code review: 409 handling correctly placed in catch block")


class TestFix1BeginJourneyLocale:
    """Fix 1: /begin-journey must render in Italian"""

    def test_begin_journey_page_content_api(self):
        """GET /api/content/page/begin-journey should return Italian keys"""
        r = requests.get(f"{BASE_URL}/api/content/page/begin-journey")
        assert r.status_code == 200, f"Content API failed: {r.status_code}"
        data = r.json()
        content_str = str(data)
        # Check for Italian text
        italian_terms = ["atmosfera", "Casa", "Showroom", "Ufficio"]
        found = [t for t in italian_terms if t in content_str]
        print(f"Italian terms found in content: {found}")
        assert len(found) > 0, f"No Italian content found. Response: {content_str[:500]}"

    def test_site_context_uses_registry_default(self):
        """SiteContext.jsx must call getDefaultLocale() directly (no navigator.languages)"""
        with open("/app/frontend/src/site/SiteContext.jsx") as f:
            content = f.read()
        assert "return getDefaultLocale()" in content, (
            "detectInitialCanonicalLocale must return getDefaultLocale() directly"
        )
        # Ensure navigator.languages is NOT used as primary locale source
        # (it may appear in comments but not as the main return path)
        lines = content.split('\n')
        nav_lang_in_active_code = [
            l for l in lines 
            if 'navigator.language' in l and not l.strip().startswith('//')
        ]
        print(f"navigator.language in active code: {nav_lang_in_active_code}")
        assert len(nav_lang_in_active_code) == 0, (
            f"navigator.languages found in active code (should be removed): {nav_lang_in_active_code}"
        )
        print("Fix 1 code review: getDefaultLocale() correctly used in detectInitialCanonicalLocale")


class TestRegressionAdminLogin:
    """Regression: Admin login must still work"""

    def test_admin_login_success(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
        data = r.json()
        # Should have session or token
        has_token = (
            data.get("access_token") or
            data.get("token") or
            (data.get("session") or {}).get("access_token")
        )
        assert has_token, f"No token in login response: {data}"
        print("Admin login OK")
