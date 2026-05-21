"""Iter117 · Sprint HARDENING-I18N-GUARD™ — Server-side locale enforcement
+ P0 i18n migration verification.

This sprint completes the language governance contract by:
  1. Adding 403 enforcement on /api/blueprint/i18n/{locale} for non-operational locales
  2. Introducing /api/public/i18n/{locale} as a separate public-facing endpoint
  3. Migrating 3 P0 surfaces (JourneyPulsePage, 404 NotFound, JourneyClosureCeremony) to t()
  4. Upgrading the GovernanceOverlay with a live `Missing translations` counter
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

STRINGS_DIR = REPO / 'frontend' / 'src' / 'i18n' / 'strings'
JOURNEY_PULSE = REPO / 'frontend' / 'src' / 'pages' / 'dashboard' / 'JourneyPulsePage.jsx'
CLOSURE_CEREMONY = REPO / 'frontend' / 'src' / 'components' / 'journey' / 'JourneyClosureCeremony.jsx'
PUBLIC_TENANT = REPO / 'frontend' / 'src' / 'pages' / 'public' / 'PublicTenantPage.jsx'
OVERLAY = REPO / 'frontend' / 'src' / 'design-system' / 'GovernanceOverlay.jsx'
ENGINE = REPO / 'frontend' / 'src' / 'i18n' / 'engine.js'
BP_CTX = REPO / 'frontend' / 'src' / 'contexts' / 'BlueprintContext.jsx'
MISS_REG = REPO / 'frontend' / 'src' / 'design-system' / 'missingI18nRegistry.js'
BLUEPRINT_ROUTER = REPO / 'backend' / 'routers' / 'blueprint.py'
PUBLIC_ROUTER = REPO / 'backend' / 'routers' / 'public_i18n.py'


# ── Phase A · Server-side enforcement ──────────────────────────
class TestBackendLocaleGuard:
    @pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not configured")
    def test_blueprint_i18n_ar_returns_403(self):
        r = requests.get(f"{API}/api/blueprint/i18n/ar", timeout=15)
        assert r.status_code == 403, r.text
        body = r.json()
        assert body["detail"]["error"] == "forbidden_locale"
        assert "ar" in body["detail"]["message"]
        assert "operational_locales" in body["detail"]
        assert set(body["detail"]["operational_locales"]) == {
            "it", "en-US", "en-GB", "fr", "de", "es",
        }

    @pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not configured")
    def test_blueprint_i18n_zh_returns_403(self):
        r = requests.get(f"{API}/api/blueprint/i18n/zh", timeout=15)
        assert r.status_code == 403, r.text

    @pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not configured")
    def test_blueprint_i18n_ja_returns_403(self):
        r = requests.get(f"{API}/api/blueprint/i18n/ja", timeout=15)
        assert r.status_code == 403

    @pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not configured")
    def test_blueprint_i18n_it_returns_200(self):
        r = requests.get(f"{API}/api/blueprint/i18n/it", timeout=15)
        assert r.status_code == 200
        assert r.json()["locale"] == "it"

    @pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not configured")
    def test_blueprint_i18n_en_us_returns_200(self):
        r = requests.get(f"{API}/api/blueprint/i18n/en-US", timeout=15)
        assert r.status_code == 200
        assert r.json()["locale"] == "en-US"

    @pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not configured")
    def test_public_i18n_ar_returns_200(self):
        r = requests.get(f"{API}/api/public/i18n/ar", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["locale"] == "ar"
        assert body["scope"] == "public"

    @pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not configured")
    def test_public_i18n_zh_returns_404(self):
        # ZH is in the registry but not yet public_enabled in this iteration.
        r = requests.get(f"{API}/api/public/i18n/zh", timeout=15)
        assert r.status_code == 404
        body = r.json()
        assert body["detail"]["error"] == "unknown_public_locale"

    @pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not configured")
    def test_public_i18n_list_includes_arabic(self):
        r = requests.get(f"{API}/api/public/i18n", timeout=15)
        assert r.status_code == 200
        codes = {l["code"] for l in r.json()["locales"]}
        assert "ar" in codes
        assert codes == {"it", "en-US", "en-GB", "fr", "de", "es", "ar"}


# ── Phase B · GovernanceOverlay missing-translations counter ──
class TestGovernanceOverlayMissingCounter:
    def test_missing_registry_module_exists(self):
        assert MISS_REG.exists()
        s = MISS_REG.read_text(encoding='utf-8')
        for export in ("recordMissing", "getMissing", "getMissingCount", "clearMissing", "subscribeMissing"):
            assert f"export function {export}" in s, f"Missing export {export}"

    def test_overlay_imports_registry(self):
        s = OVERLAY.read_text(encoding='utf-8')
        assert "missingI18nRegistry" in s
        assert "subscribeMissing" in s

    def test_overlay_renders_missing_row(self):
        s = OVERLAY.read_text(encoding='utf-8')
        assert 'data-testid="governance-overlay-missing-row"' in s
        assert 'data-testid="governance-overlay-missing-list"' in s
        assert 'data-testid="governance-overlay-missing-reset"' in s

    def test_engine_records_missing(self):
        s = ENGINE.read_text(encoding='utf-8')
        assert "recordMissing" in s, "pickString must call recordMissing on fallback"

    def test_blueprint_context_records_missing_when_no_fallback(self):
        s = BP_CTX.read_text(encoding='utf-8')
        assert "recordMissing" in s


# ── Phase C · P0 surface i18n migration ───────────────────────
class TestJourneyPulsePageMigrated:
    def test_imports_useT(self):
        s = JOURNEY_PULSE.read_text(encoding='utf-8')
        assert "import { useT }" in s or "useT } from" in s
        assert "const t = useT()" in s

    def test_eyebrow_uses_t(self):
        s = JOURNEY_PULSE.read_text(encoding='utf-8')
        assert "t('dashboard.pulse.eyebrow')" in s

    def test_greet_uses_t(self):
        s = JOURNEY_PULSE.read_text(encoding='utf-8')
        for k in ("greet.morning", "greet.afternoon", "greet.evening"):
            assert f"t('dashboard.pulse.{k}')" in s

    def test_no_hardcoded_italian_in_hero(self):
        s = JOURNEY_PULSE.read_text(encoding='utf-8')
        # These literal Italian strings must be GONE from the JSX
        forbidden = [
            "'Buongiorno'",
            "'Buon pomeriggio'",
            "'Buonasera'",
            "Studio Pulse™ · ritmo progettuale",  # was hardcoded eyebrow
            "Lettura del ritmo progettuale…",     # was hardcoded loading title
            "I Journey vivi</h2>",                # was hardcoded section title
            "Sezione dominante</span>",           # was hardcoded section eyebrow
            "Apri il Journey <ArrowRight",        # was hardcoded CTA
            "Nessun Journey è ancora vivo",       # was hardcoded empty hero
            "Lo studio è in attesa del primo viaggio.",
        ]
        for f in forbidden:
            assert f not in s, f"Hardcoded Italian still present: {f!r}"

    def test_section_titles_use_t(self):
        s = JOURNEY_PULSE.read_text(encoding='utf-8')
        for section in ("active", "voices", "waiting", "revisions", "evolutions", "silent", "actions"):
            assert f"t('dashboard.pulse.sections.{section}.title')" in s, \
                f"Section {section} title not wired to t()"


class TestNotFoundPageMigrated:
    def test_404_uses_pickString(self):
        s = PUBLIC_TENANT.read_text(encoding='utf-8')
        assert "import { pickString }" in s
        assert "errors.notFound.code" in s
        assert "errors.notFound.title" in s

    def test_no_hardcoded_404_english(self):
        s = PUBLIC_TENANT.read_text(encoding='utf-8')
        assert "This page does not exist." not in s, \
            "404 must be served via i18n, not hardcoded English"


class TestJourneyClosureCeremonyMigrated:
    def test_imports_useT(self):
        s = CLOSURE_CEREMONY.read_text(encoding='utf-8')
        assert "useT" in s
        assert "const t = useT()" in s

    def test_inline_eyebrow_uses_t(self):
        s = CLOSURE_CEREMONY.read_text(encoding='utf-8')
        assert "t('closure.inline.eyebrow')" in s
        assert "t('closure.inline.title')" in s
        assert "t('closure.inline.sub')" in s
        assert "t('closure.inline.cta')" in s

    def test_ceremony_eyebrow_uses_t(self):
        s = CLOSURE_CEREMONY.read_text(encoding='utf-8')
        assert "t('closure.ceremony.eyebrow')" in s
        assert "t('closure.ceremony.title')" in s
        assert "t('closure.ceremony.sub')" in s

    def test_no_hardcoded_italian(self):
        s = CLOSURE_CEREMONY.read_text(encoding='utf-8')
        forbidden = [
            "Il percorso entra nella memoria della casa</em>",
            "Apri il rituale di chiusura\n",
            "Rituale di chiusura · Certified Closure™</p>",
            "Deposita il dossier del percorso</em>",
        ]
        for f in forbidden:
            assert f not in s, f"Hardcoded Italian still present: {f!r}"


# ── Phase D · String dictionaries coverage ────────────────────
class TestStringDictionariesCoverage:
    """All 7 string files must own the new namespaces with the same key set."""
    REQUIRED_KEYS = [
        "dashboard.pulse.eyebrow",
        "dashboard.pulse.loading_title",
        "dashboard.pulse.greet.morning",
        "dashboard.pulse.greet.afternoon",
        "dashboard.pulse.greet.evening",
        "dashboard.pulse.summary.empty",
        "dashboard.pulse.summary.one",
        "dashboard.pulse.summary.many",
        "dashboard.pulse.sections.active.title",
        "dashboard.pulse.sections.voices.title",
        "dashboard.pulse.sections.waiting.title",
        "dashboard.pulse.sections.revisions.title",
        "dashboard.pulse.sections.evolutions.title",
        "dashboard.pulse.sections.silent.title",
        "dashboard.pulse.sections.actions.title",
        "dashboard.pulse.action.open_journey",
        "errors.notFound.code",
        "errors.notFound.title",
        "closure.inline.eyebrow",
        "closure.inline.title",
        "closure.inline.sub",
        "closure.inline.cta",
        "closure.ceremony.eyebrow",
        "closure.ceremony.title",
        "closure.toast.success",
        "closure.toast.error",
    ]

    LOCALES = ["it-IT", "en-US", "en-GB", "fr-FR", "de-DE", "es-ES", "ar"]

    def _get(self, data, dotted):
        cur = data
        for seg in dotted.split('.'):
            if not isinstance(cur, dict) or seg not in cur:
                return None
            cur = cur[seg]
        return cur if isinstance(cur, str) else None

    @pytest.mark.parametrize("locale", LOCALES)
    def test_locale_has_all_new_keys(self, locale):
        path = STRINGS_DIR / f"{locale}.json"
        assert path.exists(), f"Missing string file: {locale}"
        data = json.loads(path.read_text(encoding='utf-8'))
        missing = [k for k in self.REQUIRED_KEYS if not self._get(data, k)]
        assert not missing, f"{locale}.json missing keys: {missing}"


# ── Phase E · Module-level frontend governance ────────────────
class TestBlueprintRouterGuard:
    def test_blueprint_router_defines_operational_locales(self):
        s = BLUEPRINT_ROUTER.read_text(encoding='utf-8')
        assert "BLUEPRINT_OPERATIONAL_LOCALES" in s
        # All 6 must be present
        for code in ("it", "en-US", "en-GB", "fr", "de", "es"):
            assert f'"{code}"' in s, f"Missing operational locale {code}"

    def test_blueprint_router_returns_forbidden_locale_error(self):
        s = BLUEPRINT_ROUTER.read_text(encoding='utf-8')
        assert "forbidden_locale" in s
        assert "status_code=403" in s

    def test_public_router_exists_and_mirrors_registry(self):
        s = PUBLIC_ROUTER.read_text(encoding='utf-8')
        assert "PUBLIC_LOCALES" in s
        for code in ("it", "en-US", "en-GB", "fr", "de", "es", "ar"):
            assert f'"{code}"' in s
