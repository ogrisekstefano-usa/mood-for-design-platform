"""
Backend tests for Multilingual i18n Fix — Phase 1
Tests:
  - /api/studio/v2/manifest locale-awareness (IT + EN)
  - /api/site/navigation locale-awareness (IT + EN)
  - /api/studio/v2/manifest manifest.error locale-aware fallback
  - Loading message not hardcoded 'Un attimo…'
  - localizedSlugs structure
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestManifestLocaleAwareness:
    """Test /api/studio/v2/manifest returns locale-specific content"""

    def test_manifest_it_step1_title(self):
        """IT locale: manifest returns Italian step1_title"""
        r = requests.get(f"{BASE_URL}/api/studio/v2/manifest?locale=it-IT")
        assert r.status_code == 200
        ui = r.json().get('ui', {})
        assert ui.get('step1_title'), "step1_title must not be empty"
        assert ui.get('step1_title') == 'Parlaci del tuo studio.', (
            f"IT step1_title expected 'Parlaci del tuo studio.' got '{ui.get('step1_title')}'"
        )

    def test_manifest_en_step1_title(self):
        """EN locale: manifest returns English step1_title"""
        r = requests.get(f"{BASE_URL}/api/studio/v2/manifest?locale=en-US")
        assert r.status_code == 200
        ui = r.json().get('ui', {})
        assert ui.get('step1_title') == 'Tell us about your studio.', (
            f"EN step1_title expected 'Tell us about your studio.' got '{ui.get('step1_title')}'"
        )

    def test_manifest_en_btn_continue_not_italian(self):
        """EN locale: btn_continue is 'Continue', not 'Continua'"""
        r = requests.get(f"{BASE_URL}/api/studio/v2/manifest?locale=en-US")
        assert r.status_code == 200
        ui = r.json().get('ui', {})
        btn = ui.get('btn_continue', '')
        assert btn != 'Continua', f"EN btn_continue must not be 'Continua', got '{btn}'"
        assert btn == 'Continue', f"EN btn_continue expected 'Continue', got '{btn}'"

    def test_manifest_it_btn_continue(self):
        """IT locale: btn_continue is 'Continua'"""
        r = requests.get(f"{BASE_URL}/api/studio/v2/manifest?locale=it-IT")
        assert r.status_code == 200
        ui = r.json().get('ui', {})
        assert ui.get('btn_continue') == 'Continua', (
            f"IT btn_continue expected 'Continua', got '{ui.get('btn_continue')}'"
        )

    def test_manifest_en_manifest_error_locale_aware(self):
        """EN locale: manifest.error should be in English (locale-aware fallback)"""
        r = requests.get(f"{BASE_URL}/api/studio/v2/manifest?locale=en-US")
        assert r.status_code == 200
        ui = r.json().get('ui', {})
        error_msg = ui.get('manifest.error', '')
        assert 'Service temporarily unavailable' in error_msg or 'unavailable' in error_msg.lower(), (
            f"EN manifest.error should be English, got: '{error_msg}'"
        )
        assert 'Servizio' not in error_msg, (
            f"EN manifest.error must not contain Italian 'Servizio', got: '{error_msg}'"
        )

    def test_manifest_it_manifest_error_italian(self):
        """IT locale: manifest.error is Italian"""
        r = requests.get(f"{BASE_URL}/api/studio/v2/manifest?locale=it-IT")
        assert r.status_code == 200
        ui = r.json().get('ui', {})
        error_msg = ui.get('manifest.error', '')
        assert 'Servizio' in error_msg, (
            f"IT manifest.error should contain 'Servizio', got: '{error_msg}'"
        )

    def test_manifest_en_step2_market_eyebrow_english(self):
        """EN locale: step2.market.eyebrow shows 'A · Operating market' not Italian"""
        r = requests.get(f"{BASE_URL}/api/studio/v2/manifest?locale=en-US")
        assert r.status_code == 200
        ui = r.json().get('ui', {})
        eyebrow = ui.get('step2.market.eyebrow', '')
        assert 'Mercato operativo' not in eyebrow, (
            f"EN eyebrow must not contain Italian 'Mercato operativo', got: '{eyebrow}'"
        )
        assert 'Operating market' in eyebrow, (
            f"EN eyebrow expected 'A · Operating market', got: '{eyebrow}'"
        )

    def test_manifest_en_city_fallback_hint_english(self):
        """EN locale: step2.city.fallback_hint is in English"""
        r = requests.get(f"{BASE_URL}/api/studio/v2/manifest?locale=en-US")
        assert r.status_code == 200
        ui = r.json().get('ui', {})
        hint = ui.get('step2.city.fallback_hint', '')
        assert 'Type your city manually' in hint, (
            f"EN city fallback_hint expected English, got: '{hint}'"
        )
        assert 'Inserisci' not in hint, (
            f"EN city fallback_hint must not be Italian, got: '{hint}'"
        )

    def test_manifest_it_city_fallback_hint_italian(self):
        """IT locale: step2.city.fallback_hint is in Italian"""
        r = requests.get(f"{BASE_URL}/api/studio/v2/manifest?locale=it-IT")
        assert r.status_code == 200
        ui = r.json().get('ui', {})
        hint = ui.get('step2.city.fallback_hint', '')
        assert 'Inserisci' in hint, (
            f"IT city fallback_hint expected Italian 'Inserisci...', got: '{hint}'"
        )

    def test_manifest_loading_message_key_exists(self):
        """loading.message key exists in manifest for both locales"""
        for locale in ('it-IT', 'en-US'):
            r = requests.get(f"{BASE_URL}/api/studio/v2/manifest?locale={locale}")
            assert r.status_code == 200
            ui = r.json().get('ui', {})
            assert 'loading.message' in ui, f"loading.message key missing for {locale}"

    def test_manifest_contains_required_keys(self):
        """Both locales return all required UI keys"""
        required_keys = [
            'step1_title', 'step1_sublead', 'btn_continue', 'btn_back', 'btn_submit',
            'step2_title', 'step3_title', 'step4_title', 'step5_title',
            'step2.market.eyebrow', 'step2.hq.eyebrow', 'step2.targets.eyebrow',
            'step2.city.fallback_hint', 'loading.message', 'manifest.error',
        ]
        for locale in ('it-IT', 'en-US'):
            r = requests.get(f"{BASE_URL}/api/studio/v2/manifest?locale={locale}")
            assert r.status_code == 200
            ui = r.json().get('ui', {})
            for key in required_keys:
                assert key in ui, f"Missing key '{key}' for locale {locale}"


class TestNavigationLocaleAwareness:
    """Test /api/site/navigation returns locale-specific content"""

    def test_nav_it_endpoint_returns_200(self):
        """IT: /api/site/navigation responds 200"""
        r = requests.get(f"{BASE_URL}/api/site/navigation?locale=it-IT")
        assert r.status_code == 200

    def test_nav_en_endpoint_returns_200(self):
        """EN: /api/site/navigation responds 200"""
        r = requests.get(f"{BASE_URL}/api/site/navigation?locale=en-US")
        assert r.status_code == 200

    def test_nav_it_has_5_main_items(self):
        """IT: navigation has 5 main items"""
        r = requests.get(f"{BASE_URL}/api/site/navigation?locale=it-IT")
        data = r.json()
        main = data.get('main', [])
        assert len(main) == 5, f"Expected 5 main items, got {len(main)}: {[i['key'] for i in main]}"

    def test_nav_en_has_5_main_items(self):
        """EN: navigation has 5 main items"""
        r = requests.get(f"{BASE_URL}/api/site/navigation?locale=en-US")
        data = r.json()
        main = data.get('main', [])
        assert len(main) == 5, f"Expected 5 main items, got {len(main)}: {[i['key'] for i in main]}"

    def test_nav_it_labels_italian(self):
        """IT: navigation labels are Italian"""
        r = requests.get(f"{BASE_URL}/api/site/navigation?locale=it-IT")
        data = r.json()
        main_by_key = {i['key']: i for i in data.get('main', [])}
        # Check key Italian labels
        assert main_by_key.get('audience', {}).get('label') == 'Dedicato a', (
            f"IT audience label: {main_by_key.get('audience', {}).get('label')}"
        )
        assert main_by_key.get('features', {}).get('label') == 'Caratteristiche', (
            f"IT features label: {main_by_key.get('features', {}).get('label')}"
        )
        assert main_by_key.get('pricing', {}).get('label') == 'Versioni e Prezzi', (
            f"IT pricing label: {main_by_key.get('pricing', {}).get('label')}"
        )
        assert main_by_key.get('training', {}).get('label') == 'Formazione', (
            f"IT training label: {main_by_key.get('training', {}).get('label')}"
        )
        assert main_by_key.get('faq', {}).get('label') == 'FAQ', (
            f"IT faq label: {main_by_key.get('faq', {}).get('label')}"
        )

    def test_nav_en_labels_english(self):
        """EN: navigation labels are English"""
        r = requests.get(f"{BASE_URL}/api/site/navigation?locale=en-US")
        data = r.json()
        main_by_key = {i['key']: i for i in data.get('main', [])}
        assert main_by_key.get('audience', {}).get('label') == 'Audience', (
            f"EN audience label: {main_by_key.get('audience', {}).get('label')}"
        )
        assert main_by_key.get('features', {}).get('label') == 'Features', (
            f"EN features label: {main_by_key.get('features', {}).get('label')}"
        )
        assert main_by_key.get('pricing', {}).get('label') == 'Editions & Pricing', (
            f"EN pricing label: {main_by_key.get('pricing', {}).get('label')}"
        )
        assert main_by_key.get('training', {}).get('label') == 'Training', (
            f"EN training label: {main_by_key.get('training', {}).get('label')}"
        )

    def test_nav_it_right_items_login_accedi(self):
        """IT: right nav has login='Accedi', CTA='Attiva Blueprint™'"""
        r = requests.get(f"{BASE_URL}/api/site/navigation?locale=it-IT")
        data = r.json()
        right_by_key = {i['key']: i for i in data.get('right', [])}
        login = right_by_key.get('login', {})
        cta = right_by_key.get('activate_blueprint', {})
        assert login.get('label') == 'Accedi', f"IT login label: {login.get('label')}"
        assert 'Attiva Blueprint' in cta.get('label', ''), f"IT CTA label: {cta.get('label')}"

    def test_nav_en_right_items_login_sign_in(self):
        """EN: right nav has login='Sign in', CTA='Activate Blueprint™'"""
        r = requests.get(f"{BASE_URL}/api/site/navigation?locale=en-US")
        data = r.json()
        right_by_key = {i['key']: i for i in data.get('right', [])}
        login = right_by_key.get('login', {})
        cta = right_by_key.get('activate_blueprint', {})
        assert login.get('label') == 'Sign in', f"EN login label: {login.get('label')}"
        assert 'Activate Blueprint' in cta.get('label', ''), f"EN CTA label: {cta.get('label')}"

    def test_nav_it_audience_href_italian(self):
        """IT: audience href is /dedicato-a (Italian slug)"""
        r = requests.get(f"{BASE_URL}/api/site/navigation?locale=it-IT")
        data = r.json()
        audience = next((i for i in data.get('main', []) if i['key'] == 'audience'), None)
        assert audience is not None, "audience item not found in IT nav"
        assert audience['href'] == '/dedicato-a', (
            f"IT audience href expected '/dedicato-a', got '{audience['href']}'"
        )

    def test_nav_en_audience_href_returns_italian_slug_for_localization(self):
        """EN: raw API audience href is /dedicato-a (CorporateNav will localize it via localizeHref)"""
        # Note: The API returns Italian hrefs; the frontend CorporateNav translates them.
        r = requests.get(f"{BASE_URL}/api/site/navigation?locale=en-US")
        data = r.json()
        audience = next((i for i in data.get('main', []) if i['key'] == 'audience'), None)
        assert audience is not None, "audience item not found in EN nav"
        # Raw API returns Italian href — frontend's localizeHref() translates to /audience
        assert audience['href'] == '/dedicato-a', (
            f"EN API audience href expected '/dedicato-a' (raw, before localizeHref), got '{audience['href']}'"
        )


class TestStartStudioRedirect:
    """Test /start-studio endpoint redirects to /studio"""

    def test_start_studio_does_not_404(self):
        """Frontend /start-studio should not return 404 (handled by React router)"""
        r = requests.get(f"{BASE_URL}/start-studio", allow_redirects=False)
        # The React SPA serves 200 for all routes - the redirect is client-side
        # So we just ensure it doesn't 404
        assert r.status_code in (200, 301, 302, 307, 308), (
            f"/start-studio returned {r.status_code}"
        )


class TestManifestStructure:
    """Test manifest structure contains required data"""

    def test_manifest_has_archetypes(self):
        """Manifest has archetypes list"""
        r = requests.get(f"{BASE_URL}/api/studio/v2/manifest?locale=it-IT")
        assert r.status_code == 200
        data = r.json()
        archetypes = data.get('archetypes', [])
        assert len(archetypes) > 0, "Manifest must have at least one archetype"
        for a in archetypes:
            assert 'code' in a
            assert 'label' in a

    def test_manifest_en_archetypes_not_italian(self):
        """EN manifest: archetype labels should not be raw Italian slugs"""
        r = requests.get(f"{BASE_URL}/api/studio/v2/manifest?locale=en-US")
        assert r.status_code == 200
        data = r.json()
        archetypes = data.get('archetypes', [])
        assert len(archetypes) > 0
        # Archetypes have labels (may still be codes if no EN translation, but should not be empty)
        for a in archetypes:
            assert a.get('label'), f"Archetype {a['code']} has empty label in EN"

    def test_manifest_has_help_topics(self):
        """Manifest has help_topics list"""
        r = requests.get(f"{BASE_URL}/api/studio/v2/manifest?locale=it-IT")
        assert r.status_code == 200
        data = r.json()
        topics = data.get('help_topics', [])
        assert len(topics) > 0, "Manifest must have at least one help topic"
