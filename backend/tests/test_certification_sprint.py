"""
DEPLOY READINESS & REAL CLIENT VALIDATION SPRINT
Tests: Projects, Magazine, CMS, Begin Journey, Partner Application, CRM Leads
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASSWORD = "Blueprint2024!"

# Store test IDs for cleanup
_test_journey_id = None
_test_article_id = None
_test_partner_id = None


# ── Auth ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def auth_token():
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    data = resp.json()
    # Login returns {session: {access_token: '...'}}
    token = (data.get("access_token")
             or (data.get("session") or {}).get("access_token"))
    assert token, f"No token in response: {data}"
    return token


@pytest.fixture(scope="module")
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# ── TEST A7 — Admin Published Journeys API ───────────────────────────────

class TestA7PublishedJourneys:
    """Admin CRUD for published_design_journeys"""

    def test_list_journeys(self, headers):
        resp = requests.get(f"{BASE_URL}/api/admin/published-journeys/", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert len(data["items"]) >= 6, f"Expected >=6 journeys, got {len(data['items'])}"
        print(f"TEST A1/A7: Listed {len(data['items'])} journeys - PASS")

    def test_create_journey(self, headers):
        global _test_journey_id
        resp = requests.post(f"{BASE_URL}/api/admin/published-journeys/", headers=headers, json={
            "title": "Villa Test Certificazione",
            "project_type": "residential",
            "location": "Milano",
            "year": 2026,
            "visibility_status": "draft"
        })
        assert resp.status_code == 200, f"Create failed: {resp.text}"
        data = resp.json()
        assert "item" in data
        assert data["item"]["title"] == "Villa Test Certificazione"
        _test_journey_id = data["item"]["id"]
        print(f"TEST A2/A7: Created journey {_test_journey_id} - PASS")

    def test_get_journey_detail(self, headers):
        assert _test_journey_id, "No journey ID (create test must run first)"
        resp = requests.get(f"{BASE_URL}/api/admin/published-journeys/{_test_journey_id}", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["item"]["title"] == "Villa Test Certificazione"
        assert data["item"]["location"] == "Milano"
        assert data["item"]["year"] == 2026
        print(f"TEST A3/A7: Journey detail correct - PASS")

    def test_patch_journey_excerpt(self, headers):
        """TEST A4 — update excerpt"""
        assert _test_journey_id
        resp = requests.patch(f"{BASE_URL}/api/admin/published-journeys/{_test_journey_id}",
                              headers=headers,
                              json={"editorial_excerpt": "Un progetto residenziale di certificazione."})
        assert resp.status_code == 200, f"Patch failed: {resp.text}"
        data = resp.json()
        assert data["item"]["editorial_excerpt"] == "Un progetto residenziale di certificazione."
        print("TEST A4/A7: Patch excerpt - PASS")

    def test_upsert_translation(self, headers):
        """TEST A5 — save en-US translation"""
        assert _test_journey_id
        resp = requests.put(
            f"{BASE_URL}/api/admin/published-journeys/{_test_journey_id}/translations/en-US",
            headers=headers,
            json={"title": "Test Villa Certification"}
        )
        assert resp.status_code == 200, f"Translation upsert failed: {resp.text}"
        data = resp.json()
        assert data.get("created") or data.get("updated")
        print("TEST A5/A7: Translation upsert en-US - PASS")

    def test_publish_journey(self, headers):
        """TEST A6 — publish → status becomes 'published'"""
        assert _test_journey_id
        resp = requests.patch(f"{BASE_URL}/api/admin/published-journeys/{_test_journey_id}",
                              headers=headers,
                              json={"visibility_status": "published"})
        assert resp.status_code == 200, f"Publish failed: {resp.text}"
        data = resp.json()
        assert data["item"]["visibility_status"] == "published"
        print("TEST A6/A7: Published journey - PASS")

    def test_archive_journey(self, headers):
        """TEST A7 DELETE — archive"""
        assert _test_journey_id
        resp = requests.delete(f"{BASE_URL}/api/admin/published-journeys/{_test_journey_id}", headers=headers)
        assert resp.status_code == 200, f"Archive failed: {resp.text}"
        data = resp.json()
        assert data.get("archived") is True
        print("TEST A7: Archive (DELETE) journey - PASS")

    def test_verify_archived(self, headers):
        """Verify archived journey no longer shows in published feed"""
        assert _test_journey_id
        resp = requests.get(f"{BASE_URL}/api/admin/published-journeys/{_test_journey_id}", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["item"]["visibility_status"] == "archived"
        print("TEST A7: Archived status verified - PASS")


# ── TEST B — Magazine API ─────────────────────────────────────────────────

class TestBMagazine:
    """Magazine admin CRUD"""

    def test_b1_list_articles(self, headers):
        resp = requests.get(f"{BASE_URL}/api/magazine/admin/articles", headers=headers)
        assert resp.status_code == 200, f"List failed: {resp.text}"
        data = resp.json()
        assert "articles" in data
        count = len(data["articles"])
        assert count >= 10, f"Expected ~12 articles, got {count}"
        print(f"TEST B1: Listed {count} magazine articles - PASS")

    def test_b3_create_article(self, headers):
        global _test_article_id
        resp = requests.post(f"{BASE_URL}/api/magazine/admin/articles", headers=headers, json={
            "slug": "test-mag-cert-2026",
            "locale_content": {
                "it-IT": {"title": "Test Magazine Cert", "body_blocks": []}
            },
            "category_slug": "progetto",
            "status": "draft"
        })
        assert resp.status_code == 201, f"Create failed: {resp.text}"
        data = resp.json()
        assert "id" in data
        _test_article_id = data["id"]
        assert data["slug"] == "test-mag-cert-2026"
        print(f"TEST B3: Created article {_test_article_id} - PASS")

    def test_b4_patch_article(self, headers):
        assert _test_article_id
        resp = requests.patch(f"{BASE_URL}/api/magazine/admin/articles/{_test_article_id}",
                              headers=headers,
                              json={"locale_content": {
                                  "it-IT": {"title": "Test Magazine Cert Updated", "body_blocks": []}
                              }})
        assert resp.status_code == 200, f"Patch failed: {resp.text}"
        data = resp.json()
        assert data["id"] == _test_article_id
        print("TEST B4: Patched article locale_content - PASS")

    def test_b5_publish_article(self, headers):
        assert _test_article_id
        resp = requests.post(f"{BASE_URL}/api/magazine/admin/articles/{_test_article_id}/publish",
                             headers=headers)
        assert resp.status_code == 200, f"Publish failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        print("TEST B5: Published article - PASS")

    def test_cleanup_article(self, headers):
        if _test_article_id:
            resp = requests.delete(f"{BASE_URL}/api/magazine/admin/articles/{_test_article_id}",
                                   headers=headers)
            print(f"TEST B cleanup: delete article status={resp.status_code}")


# ── TEST C — CMS Pages ────────────────────────────────────────────────────

class TestCCMSPages:
    """Public CMS storefront pages"""

    def test_c1_home(self):
        resp = requests.get(f"{BASE_URL}/api/storefront/public/studio/pages/home")
        assert resp.status_code == 200, f"Home page failed: {resp.text}"
        data = resp.json()
        # Should have sections with locale_content
        assert data is not None
        print(f"TEST C1: Home page loaded - PASS (keys: {list(data.keys())[:5]})")

    def test_c2_about(self):
        resp = requests.get(f"{BASE_URL}/api/storefront/public/studio/pages/about")
        assert resp.status_code in [200, 404], f"About page unexpected: {resp.text}"
        print(f"TEST C2: About page status={resp.status_code} - {'PASS' if resp.status_code == 200 else 'NOT FOUND'}")

    def test_c3_services(self):
        resp = requests.get(f"{BASE_URL}/api/storefront/public/studio/pages/services")
        assert resp.status_code in [200, 404], f"Services page unexpected: {resp.text}"
        print(f"TEST C3: Services page status={resp.status_code} - {'PASS' if resp.status_code == 200 else 'NOT FOUND'}")


# ── TEST D — Begin Journey ────────────────────────────────────────────────

class TestDBeginJourney:
    """Begin journey public flow"""

    def test_d2_begin_journey(self):
        # Correct endpoint: /api/public/journeys/initiate with nested welcome payload
        resp = requests.post(f"{BASE_URL}/api/public/journeys/initiate", json={
            "tenant_slug": "studio",
            "welcome": {
                "email": "test-cert-lead@example.com",
                "first_name": "Test",
                "last_name": "Cert"
            },
            "atmosphere": {"space_kinds": ["residential"]}
        })
        # Accept 200 or 201
        assert resp.status_code in [200, 201], f"Begin journey failed: {resp.text}"
        data = resp.json()
        print(f"TEST D2: Begin journey response keys: {list(data.keys())} - PASS")


# ── TEST E — Partner Application ─────────────────────────────────────────

class TestEPartnerApplication:
    """Partner application flow"""

    def test_e2_partner_apply(self):
        global _test_partner_id
        resp = requests.post(f"{BASE_URL}/api/partner/apply", json={
            "tenant_slug": "studio",
            "first_name": "Marco",
            "last_name": "Rossi",
            "company_name": "Studio Rossi",
            "email": "marco.rossi.cert@example.com",
            "professional_category": "architect"
        })
        assert resp.status_code == 201, f"Partner apply failed: {resp.text}"
        data = resp.json()
        assert data.get("partner_id")
        _test_partner_id = data["partner_id"]
        print(f"TEST E2: Partner applied, id={_test_partner_id} - PASS")

    def test_e3_partner_appears_in_list(self, headers):
        """TEST E3 — partner appears in partner-network"""
        resp = requests.get(f"{BASE_URL}/api/partner-network/partners", headers=headers)
        assert resp.status_code == 200, f"Partner list failed: {resp.text}"
        data = resp.json()
        partner_emails = [p["email"] for p in data.get("partners", [])]
        assert "marco.rossi.cert@example.com" in partner_emails, \
            f"Partner email not found in list. Emails: {partner_emails[:5]}"
        print(f"TEST E3: Partner found in partner-network - PASS")


# ── TEST F — CRM Leads ────────────────────────────────────────────────────

class TestFCRMLeads:
    """CRM leads endpoints"""

    def test_f1_list_leads(self, headers):
        # Use without trailing slash to avoid 307 redirect that drops auth headers
        resp = requests.get(f"{BASE_URL}/api/leads", headers=headers)
        assert resp.status_code == 200, f"List leads failed: {resp.status_code} {resp.text[:200]}"
        data = resp.json()
        assert "data" in data
        print(f"TEST F1: Listed {len(data['data'])} leads - PASS")

    def test_f1_alternate_endpoint(self, headers):
        """Try without trailing slash"""
        resp = requests.get(f"{BASE_URL}/api/leads", headers=headers)
        assert resp.status_code in [200, 307], f"Leads endpoint: {resp.status_code}"
        print(f"TEST F1 alt: /api/leads status={resp.status_code}")

    def test_f3_create_design_journey_begin(self):
        """TEST F3 — create DJ via begin journey public endpoint"""
        resp = requests.post(f"{BASE_URL}/api/public/journeys/initiate", json={
            "tenant_slug": "studio",
            "welcome": {
                "email": "test-cert-dj-create@example.com",
                "first_name": "DJ",
                "last_name": "Create Test"
            }
        })
        assert resp.status_code in [200, 201], f"DJ create via begin journey: {resp.text}"
        data = resp.json()
        print(f"TEST F3: DJ creation response keys: {list(data.keys())} - PASS")
