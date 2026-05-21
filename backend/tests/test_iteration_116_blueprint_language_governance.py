"""Iter116 · Sprint HARDENING-I18N-CORRECTION — Blueprint vs Frontend
language governance.

User directive (21 May 2026):

  Blueprint Command Center™ is LOCKED to 6 operational languages:
    it · en-US · en-GB · fr · de · es

  AR · ZH · JA must:
    - exist in the Global Language Registry
    - be available for the public site + Client Companion
    - NOT be selectable as a Blueprint workspace locale

This test suite is the hard governance gate. New PRs cannot regress these
invariants without explicitly amending the whitelist constant
`BLUEPRINT_OPERATIONAL_CODES`.
"""
import os
import re
from pathlib import Path
import pytest, requests
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO / 'backend' / '.env')
load_dotenv(REPO / 'frontend' / '.env')

API = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

LANG_REG  = REPO / 'frontend' / 'src' / 'site' / 'content' / 'languages.js'
LANG_PAGE = REPO / 'frontend' / 'src' / 'pages' / 'settings' / 'LanguagesPage.jsx'


# ── Whitelist constant present and well-formed ──────────────────
class TestWhitelistConstant:
    def test_whitelist_constant_exported(self):
        s = LANG_REG.read_text(encoding='utf-8')
        assert "export const BLUEPRINT_OPERATIONAL_CODES" in s
        assert "Object.freeze" in s, \
            "BLUEPRINT_OPERATIONAL_CODES must be frozen (immutable contract)"

    def test_whitelist_contains_exactly_six_codes(self):
        s = LANG_REG.read_text(encoding='utf-8')
        # Extract the array body between the brackets
        m = re.search(
            r"export const BLUEPRINT_OPERATIONAL_CODES\s*=\s*Object\.freeze\(\[(.*?)\]\)",
            s, re.DOTALL,
        )
        assert m, "Could not find BLUEPRINT_OPERATIONAL_CODES array"
        body = m.group(1)
        codes = re.findall(r"'([^']+)'", body)
        assert set(codes) == {'it', 'en-US', 'en-GB', 'fr', 'de', 'es'}, \
            f"Whitelist must be exactly the 6 operational codes, got {codes}"

    def test_isBlueprintOperational_helper_exported(self):
        s = LANG_REG.read_text(encoding='utf-8')
        assert "export const isBlueprintOperational" in s


# ── blueprintLanguages() defensively filters by whitelist ───────
class TestBlueprintLanguagesFunction:
    def test_blueprint_languages_filters_by_whitelist(self):
        s = LANG_REG.read_text(encoding='utf-8')
        # The filter chain must include BLUEPRINT_OPERATIONAL_CODES.includes()
        # — even if a localStorage override flips ar.blueprint_enabled to true,
        # the whitelist guard prevents it from being selectable.
        assert "BLUEPRINT_OPERATIONAL_CODES.includes(l.code)" in s, \
            "blueprintLanguages() must enforce the whitelist defensively"


# ── Registry data correctness (the actual flag values) ──────────
class TestRegistryFlags:
    def test_ar_is_NOT_blueprint_enabled(self):
        s = LANG_REG.read_text(encoding='utf-8')
        for line in s.splitlines():
            if "code: 'ar'" in line:
                assert "blueprint_enabled: false" in line, \
                    f"AR must NOT be blueprint_enabled. Line: {line.strip()}"
                assert "public_enabled: true" in line, \
                    f"AR must remain available for public site. Line: {line.strip()}"
                assert "rtl: true" in line, \
                    f"AR must remain RTL. Line: {line.strip()}"
                return
        pytest.fail("'ar' entry not found in registry")

    def test_zh_is_NOT_blueprint_enabled(self):
        s = LANG_REG.read_text(encoding='utf-8')
        for line in s.splitlines():
            if "code: 'zh'" in line:
                assert "blueprint_enabled: false" in line, \
                    f"ZH must NOT be blueprint_enabled. Line: {line.strip()}"
                return
        pytest.fail("'zh' entry not found")

    def test_ja_is_NOT_blueprint_enabled(self):
        s = LANG_REG.read_text(encoding='utf-8')
        for line in s.splitlines():
            if "code: 'ja'" in line:
                assert "blueprint_enabled: false" in line, \
                    f"JA must NOT be blueprint_enabled. Line: {line.strip()}"
                return
        pytest.fail("'ja' entry not found")

    def test_six_operational_languages_are_blueprint_enabled(self):
        s = LANG_REG.read_text(encoding='utf-8')
        for code in ('it', 'en-US', 'en-GB', 'fr', 'de', 'es'):
            found = False
            for line in s.splitlines():
                if f"code: '{code}'" in line:
                    assert "blueprint_enabled: true" in line, \
                        f"Operational language {code} must be Blueprint-enabled. Line: {line.strip()}"
                    assert "enabled: true" in line, \
                        f"Operational language {code} must be enabled. Line: {line.strip()}"
                    found = True
                    break
            assert found, f"Operational language {code} not found in registry"


# ── LanguagesPage UI locks toggle for non-operational codes ─────
class TestLanguagesPageUiGuard:
    def test_languages_page_imports_whitelist(self):
        s = LANG_PAGE.read_text(encoding='utf-8')
        assert "BLUEPRINT_OPERATIONAL_CODES" in s, \
            "LanguagesPage must import the whitelist constant"
        assert "isBlueprintOperational" in s, \
            "LanguagesPage must import the operational helper"

    def test_languages_page_disables_blueprint_toggle_for_non_operational(self):
        s = LANG_PAGE.read_text(encoding='utf-8')
        # The disabled prop on the Blueprint toggle must include the
        # !isBlueprintOperational() guard.
        assert "!isBlueprintOperational(l.code)" in s, \
            "Blueprint toggle must be disabled for non-operational codes"

    def test_update_guard_blocks_promoting_non_operational_to_blueprint(self):
        s = LANG_PAGE.read_text(encoding='utf-8')
        # Even if the UI is bypassed, the update() function must strip
        # blueprint_enabled patches for non-operational codes.
        assert "!isBlueprintOperational(code)" in s, \
            "update() must block promoting non-operational languages"
        assert "delete safePatch.blueprint_enabled" in s, \
            "update() must strip blueprint_enabled when target code is not operational"


# ── Editorial copy: dual governance sections ────────────────────
class TestEditorialCopy:
    def test_blueprint_languages_copy(self):
        s = LANG_PAGE.read_text(encoding='utf-8')
        assert "Lingue operative disponibili per il workspace Blueprint." in s, \
            "Blueprint languages section must use the canonical Italian copy"

    def test_public_languages_copy(self):
        s = LANG_PAGE.read_text(encoding='utf-8')
        assert "Lingue disponibili per sito pubblico, form, onboarding e Client Companion." in s, \
            "Public languages section must use the canonical Italian copy"

    def test_ai_translate_copy(self):
        s = LANG_PAGE.read_text(encoding='utf-8')
        assert "AI Translate" in s and "precompila traduzioni per le lingue pubbliche abilitate" in s, \
            "AI Translate explanatory copy must be present"

    def test_governance_sections_have_testids(self):
        s = LANG_PAGE.read_text(encoding='utf-8')
        assert 'data-testid="languages-blueprint-note"' in s
        assert 'data-testid="languages-public-note"' in s


# ── Backend still serves Arabic translations (no regression on client) ──
# The point of the correction is NOT to remove AR from the platform —
# only to prevent it from being a Blueprint workspace locale. The /api
# endpoints must still return Arabic strings for Client Companion surfaces —
# via the public endpoint (HARDENING-I18N-GUARD iter117).
class TestBackendArabicStillServed:
    @pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not configured")
    def test_backend_serves_arabic_locale_via_public_endpoint(self):
        # AR now lives on the public endpoint; blueprint endpoint returns 403.
        r = requests.get(f"{API}/api/public/i18n/ar", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["locale"] == "ar"
        # AR translations are still served (used by Client Companion)
        msgs = d.get("messages") or {}
        # Must contain at least some Arabic translation
        assert any("common." in k for k in msgs.keys()), \
            "Backend must still serve Arabic translations for client surfaces"

    @pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not configured")
    def test_blueprint_endpoint_blocks_arabic(self):
        r = requests.get(f"{API}/api/blueprint/i18n/ar", timeout=15)
        assert r.status_code == 403
