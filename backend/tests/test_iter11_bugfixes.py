"""
Backend tests for iteration_11 bug fixes:
1. loading.message = '·' for both IT and EN locales (not 'Un attimo…')
2. /api/site/footer returns 200 (not 500) for both locales
3. Nav API returns correct hrefs (IT: /dedicato-a, etc.)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestLoadingMessageFix:
    """Bug Fix #2: loading.message must be '·' for both IT and EN"""

    def test_manifest_it_loading_message_is_dot(self):
        """IT locale: loading.message must be '·' not 'Un attimo…'"""
        r = requests.get(f"{BASE_URL}/api/studio/v2/manifest?locale=it-IT")
        assert r.status_code == 200, f"IT manifest returned {r.status_code}"
        ui = r.json().get('ui', {})
        msg = ui.get('loading.message', '')
        assert msg == '·', (
            f"IT loading.message expected '·', got '{msg}'. "
            "Root cause: DB seed or fallback still has 'Un attimo…'"
        )

    def test_manifest_en_loading_message_is_dot(self):
        """EN locale: loading.message must be '·' not 'One moment…'"""
        r = requests.get(f"{BASE_URL}/api/studio/v2/manifest?locale=en-US")
        assert r.status_code == 200, f"EN manifest returned {r.status_code}"
        ui = r.json().get('ui', {})
        msg = ui.get('loading.message', '')
        assert msg == '·', (
            f"EN loading.message expected '·', got '{msg}'. "
            "Root cause: DB seed or fallback still has 'One moment…' / 'Un attimo…'"
        )

    def test_manifest_it_loading_message_not_italian(self):
        """IT locale: loading.message must NOT contain 'attimo' (case-insensitive)"""
        r = requests.get(f"{BASE_URL}/api/studio/v2/manifest?locale=it-IT")
        assert r.status_code == 200
        ui = r.json().get('ui', {})
        msg = ui.get('loading.message', '').lower()
        assert 'attimo' not in msg, (
            f"IT loading.message must not contain 'attimo', got: '{msg}'"
        )

    def test_manifest_en_loading_message_not_italian(self):
        """EN locale: loading.message must NOT contain 'attimo' (case-insensitive)"""
        r = requests.get(f"{BASE_URL}/api/studio/v2/manifest?locale=en-US")
        assert r.status_code == 200
        ui = r.json().get('ui', {})
        msg = ui.get('loading.message', '').lower()
        assert 'attimo' not in msg, (
            f"EN loading.message must not contain 'attimo', got: '{msg}'"
        )


class TestFooter500Fix:
    """Bug Fix #3: /api/site/footer must return 200 (not 500)"""

    def test_footer_it_returns_200(self):
        """IT locale: /api/site/footer returns 200"""
        r = requests.get(f"{BASE_URL}/api/site/footer?locale=it-IT")
        assert r.status_code == 200, (
            f"IT footer returned {r.status_code}: {r.text[:300]}"
        )

    def test_footer_en_returns_200(self):
        """EN locale: /api/site/footer returns 200"""
        r = requests.get(f"{BASE_URL}/api/site/footer?locale=en-US")
        assert r.status_code == 200, (
            f"EN footer returned {r.status_code}: {r.text[:300]}"
        )

    def test_footer_it_has_expected_structure(self):
        """IT footer has manifesto, copyright, links, legal, social keys"""
        r = requests.get(f"{BASE_URL}/api/site/footer?locale=it-IT")
        assert r.status_code == 200
        data = r.json()
        for key in ('manifesto', 'copyright', 'links', 'legal', 'social'):
            assert key in data, f"IT footer missing key '{key}'"
        assert isinstance(data['links'], list), "IT footer 'links' must be a list"
        assert isinstance(data['social'], list), "IT footer 'social' must be a list"

    def test_footer_en_has_expected_structure(self):
        """EN footer has manifesto, copyright, links, legal, social keys"""
        r = requests.get(f"{BASE_URL}/api/site/footer?locale=en-US")
        assert r.status_code == 200
        data = r.json()
        for key in ('manifesto', 'copyright', 'links', 'legal', 'social'):
            assert key in data, f"EN footer missing key '{key}'"
        assert isinstance(data['links'], list), "EN footer 'links' must be a list"
        assert isinstance(data['social'], list), "EN footer 'social' must be a list"

    def test_footer_social_items_are_dicts(self):
        """Social items are dicts (not strings — that was the original 500 cause)"""
        for locale in ('it-IT', 'en-US'):
            r = requests.get(f"{BASE_URL}/api/site/footer?locale={locale}")
            assert r.status_code == 200
            social = r.json().get('social', [])
            for item in social:
                assert isinstance(item, dict), (
                    f"Social item for {locale} is not a dict: {item!r}"
                )


class TestNavHrefsForLocalizeHref:
    """Bug Fix #1: Verify nav API returns raw hrefs that localizeHref can translate"""

    def test_nav_it_audience_href_is_italian_slug(self):
        """IT: audience href is /dedicato-a"""
        r = requests.get(f"{BASE_URL}/api/site/navigation?locale=it-IT")
        assert r.status_code == 200
        main = r.json().get('main', [])
        audience = next((i for i in main if i['key'] == 'audience'), None)
        assert audience is not None, "audience item missing from IT nav"
        assert audience['href'] == '/dedicato-a', (
            f"IT audience href expected '/dedicato-a', got '{audience['href']}'"
        )

    def test_nav_it_features_href_is_italian_slug(self):
        """IT: features href is /caratteristiche"""
        r = requests.get(f"{BASE_URL}/api/site/navigation?locale=it-IT")
        main = r.json().get('main', [])
        features = next((i for i in main if i['key'] == 'features'), None)
        assert features is not None
        assert features['href'] == '/caratteristiche', (
            f"IT features href expected '/caratteristiche', got '{features['href']}'"
        )

    def test_nav_it_pricing_href_is_italian_slug(self):
        """IT: pricing href is /versioni-prezzi"""
        r = requests.get(f"{BASE_URL}/api/site/navigation?locale=it-IT")
        main = r.json().get('main', [])
        pricing = next((i for i in main if i['key'] == 'pricing'), None)
        assert pricing is not None
        assert pricing['href'] == '/versioni-prezzi', (
            f"IT pricing href expected '/versioni-prezzi', got '{pricing['href']}'"
        )

    def test_nav_it_training_href_is_italian_slug(self):
        """IT: training href is /formazione"""
        r = requests.get(f"{BASE_URL}/api/site/navigation?locale=it-IT")
        main = r.json().get('main', [])
        training = next((i for i in main if i['key'] == 'training'), None)
        assert training is not None
        assert training['href'] == '/formazione', (
            f"IT training href expected '/formazione', got '{training['href']}'"
        )

    def test_nav_en_right_login_label_sign_in(self):
        """EN: login label is 'Sign in'"""
        r = requests.get(f"{BASE_URL}/api/site/navigation?locale=en-US")
        assert r.status_code == 200
        right = r.json().get('right', [])
        login = next((i for i in right if i['key'] == 'login'), None)
        assert login is not None, "login item missing from EN right nav"
        assert login.get('label') == 'Sign in', (
            f"EN login label expected 'Sign in', got '{login.get('label')}'"
        )

    def test_nav_en_cta_label_activate_blueprint(self):
        """EN: CTA label contains 'Activate Blueprint'"""
        r = requests.get(f"{BASE_URL}/api/site/navigation?locale=en-US")
        assert r.status_code == 200
        data = r.json()
        # CTA may be in right or cta field
        right = data.get('right', [])
        cta = data.get('cta')
        cta_item = next((i for i in right if i['key'] == 'activate_blueprint'), None)
        if cta_item:
            assert 'Activate Blueprint' in cta_item.get('label', ''), (
                f"EN CTA label expected 'Activate Blueprint', got '{cta_item.get('label')}'"
            )
        elif cta:
            assert 'Activate Blueprint' in cta.get('label', ''), (
                f"EN CTA label expected 'Activate Blueprint', got '{cta.get('label')}'"
            )
        else:
            pytest.fail("No CTA item found in EN navigation right or cta field")

    def test_nav_it_login_label_accedi(self):
        """IT: login label is 'Accedi'"""
        r = requests.get(f"{BASE_URL}/api/site/navigation?locale=it-IT")
        assert r.status_code == 200
        right = r.json().get('right', [])
        login = next((i for i in right if i['key'] == 'login'), None)
        assert login is not None, "login item missing from IT right nav"
        assert login.get('label') == 'Accedi', (
            f"IT login label expected 'Accedi', got '{login.get('label')}'"
        )

    def test_nav_it_cta_label_attiva_blueprint(self):
        """IT: CTA label contains 'Attiva Blueprint'"""
        r = requests.get(f"{BASE_URL}/api/site/navigation?locale=it-IT")
        assert r.status_code == 200
        data = r.json()
        right = data.get('right', [])
        cta = data.get('cta')
        cta_item = next((i for i in right if i['key'] == 'activate_blueprint'), None)
        if cta_item:
            assert 'Attiva Blueprint' in cta_item.get('label', ''), (
                f"IT CTA label expected 'Attiva Blueprint', got '{cta_item.get('label')}'"
            )
        elif cta:
            assert 'Attiva Blueprint' in cta.get('label', ''), (
                f"IT CTA label expected 'Attiva Blueprint', got '{cta.get('label')}'"
            )
        else:
            pytest.fail("No CTA item found in IT navigation right or cta field")
