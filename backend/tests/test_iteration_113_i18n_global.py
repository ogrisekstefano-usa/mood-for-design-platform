"""Iter113 · Sprint I18N-01 — Global multilingual system repair.

Root cause: BlueprintContext and LocaleRuntimeContext are two i18n
systems that don't sync. UserMenu writes to Blueprint, but components
using useT from /i18n/useT.jsx read from LocaleRuntime → mixed locales.

This sprint:
  · Bridges BlueprintContext ↔ LocaleRuntimeContext via mfd:locale:change
  · Enables AR (Arabic UAE) in Blueprint Command Center™
  · Adds <html dir="rtl">/lang propagation + minimal RTL CSS guards
  · Adds ar.json + Blueprint API support for ar locale
  · 6 admin languages: IT, EN-US, EN-GB, FR, DE, ES, AR
"""
import os
import json
from pathlib import Path
import pytest, requests
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO / 'backend' / '.env')
load_dotenv(REPO / 'frontend' / '.env')

API = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

LANG_REG    = REPO / 'frontend' / 'src' / 'site' / 'content' / 'languages.js'
AR_STRINGS  = REPO / 'frontend' / 'src' / 'i18n' / 'strings' / 'ar.json'
LR_CONTEXT  = REPO / 'frontend' / 'src' / 'contexts' / 'LocaleRuntimeContext.jsx'
BP_CONTEXT  = REPO / 'frontend' / 'src' / 'contexts' / 'BlueprintContext.jsx'
RTL_CSS     = REPO / 'frontend' / 'src' / 'styles' / 'rtl-guards.css'
APP_JS      = REPO / 'frontend' / 'src' / 'App.js'
USER_MENU   = REPO / 'frontend' / 'src' / 'components' / 'common' / 'UserMenu.jsx'
BACKEND_BP  = REPO / 'backend' / 'routers' / 'blueprint.py'


# ── FASE B · Blueprint Command Center™ governance ──────────────
# 21 May 2026 · CORRECTED by Sprint HARDENING-I18N-CORRECTION:
# Blueprint admin UI is now LOCKED to 6 OPERATIONAL languages
# (it, en-US, en-GB, fr, de, es). Arabic, Chinese, Japanese live in the
# Global Language Registry but cannot be selected as Blueprint workspace
# locales. They remain available for the public site + Client Companion.
class TestBlueprintCommandCenterLanguages:
    """Blueprint admin must support exactly 6 OPERATIONAL languages.
    AR/ZH/JA are NOT allowed in Blueprint workspace."""
    def test_arabic_is_NOT_blueprint_enabled(self):
        s = LANG_REG.read_text(encoding='utf-8')
        for line in s.splitlines():
            if "code: 'ar'" in line:
                assert "blueprint_enabled: false" in line, \
                    f"AR must NOT be blueprint_enabled. Line: {line}"
                assert "rtl: true" in line, "AR must remain RTL"
                assert "public_enabled: true" in line, \
                    "AR must remain available for public site / Client Companion"
                return
        pytest.fail("'ar' entry not found in language registry")

    def test_six_operational_blueprint_languages_present(self):
        s = LANG_REG.read_text(encoding='utf-8')
        for code in ("'it'", "'en-US'", "'en-GB'", "'fr'", "'de'", "'es'"):
            for line in s.splitlines():
                if f"code: {code}" in line and "blueprint_enabled" in line:
                    assert "blueprint_enabled: true" in line, \
                        f"Operational language {code} must be Blueprint-enabled. Line: {line}"
                    break
            else:
                pytest.fail(f"Operational language {code} not found")

    def test_blueprint_operational_whitelist_constant_exists(self):
        s = LANG_REG.read_text(encoding='utf-8')
        assert "BLUEPRINT_OPERATIONAL_CODES" in s, \
            "Whitelist constant BLUEPRINT_OPERATIONAL_CODES must be exported"
        # Whitelist must contain exactly the 6 operational codes
        for code in ("'it'", "'en-US'", "'en-GB'", "'fr'", "'de'", "'es'"):
            assert code in s, f"Whitelist must include {code}"


# ── ar.json minimum coverage ───────────────────────────────────
class TestArabicStringsFile:
    def test_ar_json_exists(self):
        assert AR_STRINGS.exists(), AR_STRINGS

    def test_ar_json_is_valid_json(self):
        data = json.loads(AR_STRINGS.read_text(encoding='utf-8'))
        assert isinstance(data, dict)

    def test_ar_json_minimum_coverage(self):
        data = json.loads(AR_STRINGS.read_text(encoding='utf-8'))
        # Required top-level groups for the admin shell
        for group in ("common", "relationships", "user", "nav"):
            assert group in data, f"ar.json missing group {group!r}"
        # Core keys
        assert data["common"]["save"] == "حفظ"
        assert data["common"]["cancel"] == "إلغاء"
        assert data["user"]["language"] == "اللغة"


# ── Backend Blueprint i18n returns Arabic messages ─────────────
class TestBackendBlueprintI18nArabic:
    def test_backend_serves_arabic_locale(self):
        r = requests.get(f"{API}/api/blueprint/i18n/ar", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["locale"] == "ar"
        # When ar is in DEFAULT_I18N, fallback should be None
        assert d["fallback"] is None
        msgs = d["messages"]
        assert isinstance(msgs, dict)
        # Flattened keys (dotted)
        assert msgs.get("common.save") == "حفظ"
        assert msgs.get("nav.dashboard") == "لوحة التحكم"
        assert msgs.get("user.language") == "اللغة"

    def test_arabic_is_not_falling_back(self):
        """Sanity: requesting a missing locale falls back to en-US."""
        r = requests.get(f"{API}/api/blueprint/i18n/xx", timeout=15)
        assert r.status_code == 200
        d = r.json()
        # Falling back means 'fallback' is set
        assert d["fallback"] == "en-US"
        # And messages come from the en-US default
        assert d["messages"].get("common.save") == "Save"


# ── FASE A · Locale propagation bridge ─────────────────────────
class TestLocaleRuntimeBridge:
    def test_runtime_listens_to_blueprint_event(self):
        s = LR_CONTEXT.read_text(encoding='utf-8')
        # Must wire the event listener
        assert "mfd:locale:change" in s, \
            "LocaleRuntimeContext must subscribe to mfd:locale:change"
        # Must also listen for cross-tab storage events on mfd_locale
        assert "mfd_locale" in s
        assert "addEventListener('mfd:locale:change'" in s

    def test_runtime_exposes_composite_mapping(self):
        s = LR_CONTEXT.read_text(encoding='utf-8')
        # The BCP-47 ↔ composite mapping is the bridge invariant
        assert "BCP47_TO_COMPOSITE" in s
        assert "COMPOSITE_TO_BCP47" in s
        # AR_AE must be present in mapping
        assert "AR_AE" in s
        # All Blueprint locales mapped both ways
        for bcp in ("'it'", "'en-US'", "'fr'", "'de'", "'es'", "'ar'"):
            assert bcp in s, f"bcp47 {bcp} missing in composite mapping"

    def test_runtime_supported_includes_arabic(self):
        s = LR_CONTEXT.read_text(encoding='utf-8')
        # The default supported array now includes AR_AE
        assert "'AR_AE'" in s

    def test_setlocale_dispatches_event_outbound(self):
        """When LocaleRuntime.setLocale runs, it should dispatch
        mfd:locale:change so Blueprint can sync the other way."""
        s = LR_CONTEXT.read_text(encoding='utf-8')
        # The outbound dispatch is the bi-directional bridge
        assert "dispatchEvent(new CustomEvent('mfd:locale:change'" in s


# ── FASE B · BlueprintContext exposes isRtl + dir ──────────────
class TestBlueprintRtlExposure:
    def test_blueprint_exposes_isrtl_and_dir(self):
        s = BP_CONTEXT.read_text(encoding='utf-8')
        # isRtl and dir computed from resolveLanguage(locale).rtl
        assert "isRtl" in s
        assert "dir" in s
        assert "rtl" in s.lower()
        # Applied to <html> via documentElement.setAttribute('dir', dir)
        assert "documentElement.setAttribute('dir'" in s
        assert "documentElement.setAttribute('lang'" in s

    def test_blueprint_value_includes_isrtl_dir(self):
        s = BP_CONTEXT.read_text(encoding='utf-8')
        # The exported context value must include isRtl and dir
        # so any component can read them.
        assert "isRtl, dir," in s


# ── FASE C · RTL CSS guards present and imported ───────────────
class TestRtlCssGuards:
    def test_rtl_guards_file_exists(self):
        assert RTL_CSS.exists()

    def test_rtl_guards_imported_globally(self):
        s = APP_JS.read_text(encoding='utf-8')
        assert "rtl-guards.css" in s

    def test_rtl_guards_cover_critical_surfaces(self):
        s = RTL_CSS.read_text(encoding='utf-8')
        # Minimal sidebar/topbar rules
        assert 'html[dir="rtl"]' in s
        for sel in ("sidebar", "topbar", "dossier-chapters__num", "keep-ltr"):
            assert sel in s, f"rtl-guards missing rule for {sel}"


# ── UserMenu wired to switch the locale through the canonical path ──
class TestUserMenuLanguageSwitch:
    def test_user_menu_calls_setlocale(self):
        s = USER_MENU.read_text(encoding='utf-8')
        # The selector wires onChange → setLocale(e.target.value)
        assert "setLocale" in s
        assert "user-menu-locale-select" in s


# ── Backend default Italian still present (no regression) ──────
class TestBackendNoRegression:
    def test_backend_italian_still_default(self):
        r = requests.get(f"{API}/api/blueprint/i18n/it", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["locale"] == "it"
        assert d["fallback"] is None
        assert d["messages"].get("common.save") == "Salva"

    def test_backend_english_still_default(self):
        r = requests.get(f"{API}/api/blueprint/i18n/en-US", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["messages"].get("common.save") == "Save"


# ── Direction Lock: no celebratory / forbidden vocab in Arabic ──
class TestArabicDirectionLock:
    def test_arabic_strings_no_marketing_emojis(self):
        s = AR_STRINGS.read_text(encoding='utf-8')
        # No celebration emojis in admin shell strings
        for bad in ["🎉", "🏆", "🥂", "🎊"]:
            assert bad not in s, f"ar.json contains forbidden {bad}"
