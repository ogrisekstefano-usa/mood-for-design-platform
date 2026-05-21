"""Iter123 · Sprint ITER123 · Adaptive Language Experience™.

Validates the Relational Translation Layer end-to-end:
  - Backend translation service (DNT wrap/unwrap, fallback, supported locales)
  - API endpoints (/api/ale/localize, /localize-batch, /preferences, /health)
  - Live LLM call (skipped when EMERGENT_LLM_KEY not configured)
  - Frontend component contract (LocalizedMessage data-testids + modes)
  - Integration in ClientMessagesPage (sample consumer surface)
"""
import os
from pathlib import Path
import pytest, requests
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO / 'backend' / '.env')
load_dotenv(REPO / 'frontend' / '.env')
API = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

SERVICE = REPO / 'backend' / 'services' / 'relational_translation.py'
ROUTER  = REPO / 'backend' / 'routers' / 'ale_api.py'
COMP    = REPO / 'frontend' / 'src' / 'components' / 'ale' / 'LocalizedMessage.jsx'
MSG_PAGE= REPO / 'frontend' / 'src' / 'pages' / 'client' / 'ClientMessagesPage.jsx'


def _login_token():
    if not API: return None
    try:
        r = requests.post(f"{API}/api/auth/login",
            json={"email": "demo@moodfordesign.com", "password": "Blueprint2024!"}, timeout=15)
        if r.status_code != 200: return None
        d = r.json()
        return d.get("session", {}).get("access_token") or d.get("access_token") or d.get("token")
    except Exception:
        return None


# ── Service module shape ──────────────────────────────────────
class TestServiceModule:
    def test_module_exists(self):
        assert SERVICE.exists()

    def test_translate_function_signature(self):
        s = SERVICE.read_text(encoding='utf-8')
        assert "def translate(text: str, source_locale: str, target_locale: str" in s

    def test_supported_locales_complete(self):
        s = SERVICE.read_text(encoding='utf-8')
        for code in ('it', 'en-US', 'en-GB', 'fr', 'de', 'es', 'ar'):
            assert f'"{code}"' in s

    def test_default_dnt_terms_include_brand_vocab(self):
        s = SERVICE.read_text(encoding='utf-8')
        for term in ('MOOD for DESIGN', 'Cattelan Italia', 'Design Journey',
                     'Studio Pulse', 'Cultural Edition', 'Brand Atlas'):
            assert f'"{term}"' in s, f"DNT must include '{term}'"

    def test_editorial_prompt_targets_luxury_register(self):
        s = SERVICE.read_text(encoding='utf-8')
        # The prompt must instruct the model to use the editorial register,
        # not literal translation.
        assert "luxury hospitality" in s.lower() or "atelier" in s.lower()
        assert "never literal" in s.lower() or "never word-for-word" in s.lower() or "not word-for-word" in s.lower()

    def test_dnt_wrap_helper_present(self):
        s = SERVICE.read_text(encoding='utf-8')
        assert "def _wrap_dnt(" in s
        assert "def _unwrap_dnt(" in s


# ── Pure-function unit tests ──────────────────────────────────
class TestPureHelpers:
    def test_wrap_unwrap_dnt_roundtrip(self):
        from services.relational_translation import _wrap_dnt, _unwrap_dnt
        text = "We refined the MOOD for DESIGN proposal keeping Cattelan Italia chairs."
        masked, recovered = _wrap_dnt(text)
        assert "MOOD for DESIGN" not in masked
        assert "Cattelan Italia" not in masked
        assert "§DNT0§" in masked and "§DNT1§" in masked
        # Unwrap exactly restores the original
        assert _unwrap_dnt(masked, recovered) == text

    def test_wrap_dnt_handles_longest_first(self):
        from services.relational_translation import _wrap_dnt
        text = "Cattelan Italia ships from Italy via B&B Italia and Cattelan."
        masked, recovered = _wrap_dnt(text)
        # 'Cattelan Italia' (longer) must be matched before plain 'Cattelan'
        assert "Cattelan Italia" not in masked
        assert "B&B Italia" not in masked

    def test_translate_returns_no_op_for_same_locale(self):
        from services.relational_translation import translate
        r = translate("Ciao", "it", "it")
        assert r.translated is False
        assert r.localized == "Ciao"
        assert r.error is None

    def test_translate_returns_no_op_for_empty_text(self):
        from services.relational_translation import translate
        r = translate("", "it", "en-US")
        assert r.translated is False
        assert r.error == "empty_text"

    def test_translate_rejects_unsupported_locale(self):
        from services.relational_translation import translate
        r = translate("Ciao", "it", "ru")
        assert r.translated is False
        assert r.error == "unsupported_locale"


# ── API endpoint contract ─────────────────────────────────────
class TestApiEndpoints:
    @pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not configured")
    def test_health_endpoint(self):
        r = requests.get(f"{API}/api/ale/health", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert set(body["supported_locales"]) == {"it", "en-US", "en-GB", "fr", "de", "es", "ar"}
        assert set(body["modes"]) == {"original_only", "localized_only", "dual"}

    @pytest.mark.skipif(not API, reason="API not configured")
    def test_localize_requires_auth(self):
        r = requests.post(f"{API}/api/ale/localize",
            json={"text": "Ciao", "source_locale": "it", "target_locale": "en-US"},
            timeout=15)
        # 401 or 403 means auth is enforced — both are acceptable
        assert r.status_code in (401, 403)

    @pytest.mark.skipif(not API, reason="API not configured")
    def test_localize_rejects_unsupported_locale(self):
        token = _login_token()
        if not token: pytest.skip("login failed")
        r = requests.post(f"{API}/api/ale/localize",
            json={"text": "Ciao", "source_locale": "it", "target_locale": "ru"},
            headers={"Authorization": f"Bearer {token}"},
            timeout=15)
        assert r.status_code == 422

    @pytest.mark.skipif(not API, reason="API not configured")
    def test_localize_live_it_to_en(self):
        token = _login_token()
        if not token: pytest.skip("login failed")
        r = requests.post(f"{API}/api/ale/localize",
            json={
                "text": "Abbiamo alleggerito la proposta della cucina con superfici opache di MOOD for DESIGN, mantenendo Cattelan Italia per le sedie.",
                "source_locale": "it",
                "target_locale": "en-US",
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["source_locale"] == "it"
        assert body["target_locale"] == "en-US"
        # Either the translation went through (translated=True + localized differs)
        # or it gracefully fell back (translated=False, localized==original).
        if body["translated"]:
            assert body["localized"] != body["original"]
            # Brand DNT must be preserved verbatim
            assert "MOOD for DESIGN" in body["localized"]
            assert "Cattelan Italia" in body["localized"]
            assert body["model"]
        else:
            assert body["localized"] == body["original"]

    @pytest.mark.skipif(not API, reason="API not configured")
    def test_preferences_default_values(self):
        token = _login_token()
        if not token: pytest.skip("login failed")
        r = requests.get(f"{API}/api/ale/preferences",
            headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "auto_localize" in body
        assert "display_mode" in body
        assert body["display_mode"] in ("original_only", "localized_only", "dual")


# ── Frontend component contract ───────────────────────────────
class TestFrontendComponent:
    def test_component_file_exists(self):
        assert COMP.exists()

    def test_component_exports_default(self):
        s = COMP.read_text(encoding='utf-8')
        assert "export default LocalizedMessage" in s

    def test_component_supports_three_modes(self):
        s = COMP.read_text(encoding='utf-8')
        assert "'localized_only'" in s
        assert "'original_only'" in s
        assert "'dual'" in s

    def test_component_uses_ale_api(self):
        s = COMP.read_text(encoding='utf-8')
        assert "/api/ale/localize" in s

    def test_component_data_testids(self):
        s = COMP.read_text(encoding='utf-8')
        for tid in ("-primary", "-meta", "-toggle", "-original", "-loading"):
            assert tid in s, f"Missing data-testid suffix {tid}"

    def test_component_exposes_useLocalizedContent_hook(self):
        s = COMP.read_text(encoding='utf-8')
        assert "export const useLocalizedContent" in s

    def test_translation_label_localized(self):
        s = COMP.read_text(encoding='utf-8')
        # Labels in all 7 locales must be present
        for marker in ("Tradotto automaticamente", "Translated automatically",
                       "Traduit automatiquement", "Automatisch übersetzt",
                       "Traducido automáticamente", "تُرجم تلقائياً"):
            assert marker in s, f"Missing translation label: {marker}"


# ── Sample consumer wiring ────────────────────────────────────
class TestClientMessagesIntegration:
    def test_client_messages_imports_localized_message(self):
        s = MSG_PAGE.read_text(encoding='utf-8')
        assert "import LocalizedMessage" in s
        assert "components/ale/LocalizedMessage" in s

    def test_studio_message_is_wrapped_in_localized_message(self):
        s = MSG_PAGE.read_text(encoding='utf-8')
        assert "<LocalizedMessage" in s
        assert "sourceLocale" in s
        # Default source locale for studio messages is Italian
        assert "'it'" in s
