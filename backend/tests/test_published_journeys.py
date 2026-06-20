"""
Backend tests for Published Design Journeys admin API.
Tests: list, create, detail, translations CRUD, PATCH, publish flow.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASSWORD = "Blueprint2024!"

@pytest.fixture(scope="module")
def auth_token():
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if resp.status_code != 200:
        pytest.skip(f"Login failed: {resp.status_code} {resp.text}")
    data = resp.json()
    token = data.get("session", {}).get("access_token") or data.get("access_token")
    if not token:
        pytest.skip("No token in response")
    return token

@pytest.fixture(scope="module")
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestAdminPublishedJourneysList:
    """GET /api/admin/published-journeys/ — should return 6 existing journeys"""

    def test_list_returns_200(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/published-journeys/", headers=headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"

    def test_list_has_items_key(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/published-journeys/", headers=headers)
        data = r.json()
        assert "items" in data, f"Expected 'items' key in response: {data}"

    def test_list_has_6_journeys(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/published-journeys/", headers=headers)
        items = r.json().get("items", [])
        assert len(items) >= 6, f"Expected at least 6 journeys, got {len(items)}"

    def test_list_item_has_required_fields(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/published-journeys/", headers=headers)
        items = r.json().get("items", [])
        assert len(items) > 0
        first = items[0]
        for field in ["id", "title", "visibility_status"]:
            assert field in first, f"Missing field '{field}' in item: {first}"


class TestAdminPublishedJourneyDetail:
    """GET /api/admin/published-journeys/{id} — should return item + translations"""

    @pytest.fixture(scope="class")
    def journey_id(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/published-journeys/", headers=headers)
        items = r.json().get("items", [])
        if not items:
            pytest.skip("No journeys available")
        return items[0]["id"]

    def test_detail_returns_200(self, headers, journey_id):
        r = requests.get(f"{BASE_URL}/api/admin/published-journeys/{journey_id}", headers=headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"

    def test_detail_has_item_and_translations(self, headers, journey_id):
        r = requests.get(f"{BASE_URL}/api/admin/published-journeys/{journey_id}", headers=headers)
        data = r.json()
        assert "item" in data, f"Missing 'item' key: {data}"
        assert "translations" in data, f"Missing 'translations' key: {data}"

    def test_detail_item_has_story_content(self, headers, journey_id):
        r = requests.get(f"{BASE_URL}/api/admin/published-journeys/{journey_id}", headers=headers)
        item = r.json().get("item", {})
        assert "id" in item
        assert "title" in item

    def test_translations_is_list(self, headers, journey_id):
        r = requests.get(f"{BASE_URL}/api/admin/published-journeys/{journey_id}", headers=headers)
        translations = r.json().get("translations", [])
        assert isinstance(translations, list)


class TestAdminTranslationsEndpoint:
    """GET /api/admin/published-journeys/{id}/translations"""

    @pytest.fixture(scope="class")
    def journey_id(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/published-journeys/", headers=headers)
        items = r.json().get("items", [])
        if not items:
            pytest.skip("No journeys available")
        return items[0]["id"]

    def test_translations_endpoint_200(self, headers, journey_id):
        r = requests.get(f"{BASE_URL}/api/admin/published-journeys/{journey_id}/translations", headers=headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"

    def test_translations_response_structure(self, headers, journey_id):
        r = requests.get(f"{BASE_URL}/api/admin/published-journeys/{journey_id}/translations", headers=headers)
        data = r.json()
        assert "translations" in data
        assert "count" in data
        assert isinstance(data["translations"], list)


class TestAdminTranslationUpsert:
    """PUT /api/admin/published-journeys/{id}/translations/{locale}"""

    @pytest.fixture(scope="class")
    def journey_id(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/published-journeys/", headers=headers)
        items = r.json().get("items", [])
        if not items:
            pytest.skip("No journeys available")
        return items[0]["id"]

    def test_upsert_translation_en_us(self, headers, journey_id):
        payload = {
            "title": "TEST_ EN title for journey",
            "editorial_excerpt": "TEST_ short excerpt in English",
            "atmosphere": "TEST_ editorial atmosphere",
            "location": "TEST_ Milan, Italy",
            "seo_title": "TEST_ SEO title",
            "seo_description": "TEST_ SEO description"
        }
        r = requests.put(
            f"{BASE_URL}/api/admin/published-journeys/{journey_id}/translations/en-US",
            json=payload,
            headers=headers
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "created" in data or "updated" in data

    def test_translation_persisted(self, headers, journey_id):
        r = requests.get(
            f"{BASE_URL}/api/admin/published-journeys/{journey_id}/translations",
            headers=headers
        )
        translations = r.json().get("translations", [])
        en_trans = next((t for t in translations if t.get("locale") == "en-US"), None)
        assert en_trans is not None, "en-US translation not found after upsert"


class TestAdminJourneyCreate:
    """POST /api/admin/published-journeys/ — create new journey"""

    created_id = None

    def test_create_journey(self, headers):
        payload = {
            "title": "TEST_ Playwright Test Journey",
            "project_type": "Residenziale",
            "location": "Milano, Italia",
            "year": 2025,
            "canonical_locale": "it-IT",
            "visibility_status": "draft"
        }
        r = requests.post(f"{BASE_URL}/api/admin/published-journeys/", json=payload, headers=headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "item" in data
        item = data["item"]
        assert item["title"] == "TEST_ Playwright Test Journey"
        TestAdminJourneyCreate.created_id = item["id"]

    def test_created_journey_retrievable(self, headers):
        if not TestAdminJourneyCreate.created_id:
            pytest.skip("No created journey to test")
        r = requests.get(
            f"{BASE_URL}/api/admin/published-journeys/{TestAdminJourneyCreate.created_id}",
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        assert data["item"]["title"] == "TEST_ Playwright Test Journey"

    def test_publish_created_journey(self, headers):
        if not TestAdminJourneyCreate.created_id:
            pytest.skip("No created journey to test")
        r = requests.patch(
            f"{BASE_URL}/api/admin/published-journeys/{TestAdminJourneyCreate.created_id}",
            json={"visibility_status": "published"},
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        assert data["item"]["visibility_status"] == "published"

    def test_cleanup_archive_test_journey(self, headers):
        if not TestAdminJourneyCreate.created_id:
            pytest.skip("No created journey to cleanup")
        r = requests.patch(
            f"{BASE_URL}/api/admin/published-journeys/{TestAdminJourneyCreate.created_id}",
            json={"visibility_status": "archived"},
            headers=headers
        )
        assert r.status_code == 200
