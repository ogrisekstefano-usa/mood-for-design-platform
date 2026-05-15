"""Corporate API tests for MOOD for Design corporate website"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestCorporatePages:
    """Test corporate page endpoints"""

    def test_home_page_returns_6_sections(self):
        res = requests.get(f"{BASE_URL}/api/corporate/pages/home")
        assert res.status_code == 200
        data = res.json()
        sections = data.get('sections', [])
        assert len(sections) >= 6, f"Expected 6+ sections, got {len(sections)}"

    def test_home_page_locale_en(self):
        res = requests.get(f"{BASE_URL}/api/corporate/pages/home?locale=en-us")
        assert res.status_code == 200

    def test_home_page_locale_it(self):
        res = requests.get(f"{BASE_URL}/api/corporate/pages/home?locale=it")
        assert res.status_code == 200
        data = res.json()
        # Check Italian content
        sections = data.get('sections', [])
        assert len(sections) > 0

    def test_pricing_page(self):
        res = requests.get(f"{BASE_URL}/api/corporate/pages/pricing")
        assert res.status_code == 200

    def test_about_page(self):
        res = requests.get(f"{BASE_URL}/api/corporate/pages/about")
        assert res.status_code == 200

    def test_journal_page(self):
        res = requests.get(f"{BASE_URL}/api/corporate/pages/journal")
        assert res.status_code == 200

    def test_contact_page(self):
        res = requests.get(f"{BASE_URL}/api/corporate/pages/contact")
        assert res.status_code == 200

    def test_platform_page(self):
        res = requests.get(f"{BASE_URL}/api/corporate/pages/platform")
        assert res.status_code == 200

    def test_nonexistent_page_404(self):
        res = requests.get(f"{BASE_URL}/api/corporate/pages/nonexistent-xyz")
        assert res.status_code == 404


class TestCorporateNavigation:
    """Test navigation endpoint"""

    def test_navigation_returns_items(self):
        res = requests.get(f"{BASE_URL}/api/corporate/navigation")
        assert res.status_code == 200
        data = res.json()
        assert 'main' in data
        assert len(data['main']) >= 7, f"Expected 7+ nav items, got {len(data['main'])}"

    def test_navigation_has_cta(self):
        res = requests.get(f"{BASE_URL}/api/corporate/navigation")
        assert res.status_code == 200
        data = res.json()
        assert 'cta' in data

    def test_navigation_locale_it(self):
        res = requests.get(f"{BASE_URL}/api/corporate/navigation?locale=it")
        assert res.status_code == 200


class TestCorporateLocales:
    """Test locale endpoint"""

    def test_locales_returns_6(self):
        res = requests.get(f"{BASE_URL}/api/corporate/locales")
        assert res.status_code == 200
        data = res.json()
        locales = data.get('locales', [])
        assert len(locales) >= 6, f"Expected 6 locales, got {len(locales)}"

    def test_locales_include_it_en_fr(self):
        res = requests.get(f"{BASE_URL}/api/corporate/locales")
        data = res.json()
        codes = [l['code'] for l in data.get('locales', [])]
        for code in ['it', 'en-us', 'fr']:
            assert code in codes, f"Locale '{code}' missing"


class TestSectionRegistry:
    """Test section registry endpoint"""

    def test_registry_returns_13_plus(self):
        res = requests.get(f"{BASE_URL}/api/corporate/sections/registry")
        assert res.status_code == 200
        data = res.json()
        assert data.get('total', 0) >= 13, f"Expected 13+ section types, got {data.get('total')}"


class TestContactForm:
    """Test contact form submission"""

    def test_contact_submit(self):
        payload = {"name": "Test User", "email": "test@test.com", "message": "Hello"}
        res = requests.post(f"{BASE_URL}/api/corporate/contact", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data.get('success') is True

    def test_contact_returns_reference(self):
        payload = {"name": "Test", "email": "t@t.com", "message": "msg"}
        res = requests.post(f"{BASE_URL}/api/corporate/contact", json=payload)
        data = res.json()
        assert 'reference' in data


class TestNewsletterSubscription:
    """Test newsletter subscription"""

    def test_newsletter_subscribe(self):
        res = requests.post(f"{BASE_URL}/api/corporate/newsletter", json={"email": "test@test.com"})
        assert res.status_code == 200
        data = res.json()
        assert data.get('success') is True


class TestStudioRegistration:
    """Test studio registration endpoint"""

    def test_studio_register(self):
        payload = {
            "studio_name": "Test Studio MFD",
            "email": "owner@test.com",
            "first_name": "John",
            "last_name": "Doe",
            "plan": "starter"
        }
        res = requests.post(f"{BASE_URL}/api/corporate/studio/register", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data.get('success') is True
        assert 'studio' in data
        assert 'subdomain' in data['studio']

    def test_studio_register_generates_subdomain(self):
        payload = {
            "studio_name": "My Design Studio",
            "email": "x@y.com",
            "first_name": "A",
            "last_name": "B"
        }
        res = requests.post(f"{BASE_URL}/api/corporate/studio/register", json=payload)
        data = res.json()
        subdomain = data['studio']['subdomain']
        assert 'blueprint.moodfordesign.com' in subdomain
        assert 'my-design-studio' in subdomain
