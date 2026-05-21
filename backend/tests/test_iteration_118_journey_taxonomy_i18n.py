"""Iter118 · Sprint JOURNEY-TAXONOMY-I18N™ — Editorial Taxonomy Localization Layer™.

Validates the separation between technical backend keys and editorial vocabulary:
  - Editorial labels live in /app/backend/taxonomy/__init__.py (the registry)
  - Backend resolves labels per requested locale via the resolver
  - /api/taxonomy/{locale} exposes the full registry to the frontend
  - The taxonomy is embedded in /api/blueprint/i18n + /api/public/i18n payloads
  - GovernanceOverlay shows a separate Missing-taxonomy KPI
  - The Pulse endpoint accepts ?locale= and returns localized labels
"""
import os
from pathlib import Path
import pytest, requests
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO / 'backend' / '.env')
load_dotenv(REPO / 'frontend' / '.env')
API = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

TAX_MODULE = REPO / 'backend' / 'taxonomy' / '__init__.py'
TAX_ROUTER = REPO / 'backend' / 'routers' / 'taxonomy_api.py'
PULSE_ROUTER = REPO / 'backend' / 'routers' / 'journey_pulse.py'
JOURNEY_PULSE_PAGE = REPO / 'frontend' / 'src' / 'pages' / 'dashboard' / 'JourneyPulsePage.jsx'
BP_CTX = REPO / 'frontend' / 'src' / 'contexts' / 'BlueprintContext.jsx'
OVERLAY = REPO / 'frontend' / 'src' / 'design-system' / 'GovernanceOverlay.jsx'
MISS_REG = REPO / 'frontend' / 'src' / 'design-system' / 'missingI18nRegistry.js'


# ── Module-level registry shape ────────────────────────────────
class TestTaxonomyRegistryModule:
    def test_module_exists(self):
        assert TAX_MODULE.exists()

    def test_registry_contains_all_required_taxonomy_types(self):
        s = TAX_MODULE.read_text(encoding='utf-8')
        for t in ("journey_lifecycle_client", "journey_lifecycle_studio",
                  "step_status", "journey_milestone", "crm_stage", "companion_state"):
            assert f'"{t}"' in s, f"Missing taxonomy type {t}"

    def test_resolver_exists(self):
        s = TAX_MODULE.read_text(encoding='utf-8')
        assert "def resolve(" in s
        assert "def flatten_for_locale(" in s

    def test_fallback_chain_is_en_then_it(self):
        s = TAX_MODULE.read_text(encoding='utf-8')
        assert "TAXONOMY_FALLBACK_CHAIN" in s
        assert '"en-US"' in s and '"it"' in s

    def test_editorial_translations_not_literal(self):
        """Sprint principle: 'Progetto vinto' MUST NOT translate as 'Won Project'.
        Verify the editorial localization rule is respected."""
        s = TAX_MODULE.read_text(encoding='utf-8')
        # 'approved' in journey_lifecycle_studio IT = "Progetto vinto"
        # but EN should be the editorial choice "Journey confirmed", NOT "Won Project"
        assert "Won Project" not in s, \
            "Editorial rule violation: 'Progetto vinto' translated literally as 'Won Project'"
        assert "Journey confirmed" in s, \
            "Editorial translation 'Journey confirmed' (for 'Progetto vinto') must be present"


# ── /api/taxonomy/{locale} endpoint contract ──────────────────
class TestTaxonomyApiEndpoint:
    @pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not configured")
    def test_taxonomy_it_returns_full_registry(self):
        r = requests.get(f"{API}/api/taxonomy/it", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["locale"] == "it"
        assert body["source_locale"] == "it"
        tx = body["taxonomies"]
        assert tx["journey_lifecycle_studio"]["in_progress"] == "Viaggio in corso"
        assert tx["journey_lifecycle_client"]["closed"] == "Memoria della casa"
        assert tx["crm_stage"]["active_client"] == "Cliente attivo"
        # Flat dictionary is also returned
        assert body["flat"]["taxonomy.journey_lifecycle_studio.approved"] == "Progetto vinto"

    @pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not configured")
    def test_taxonomy_en_us_editorial_translation(self):
        r = requests.get(f"{API}/api/taxonomy/en-US", timeout=15)
        assert r.status_code == 200
        tx = r.json()["taxonomies"]
        # The editorial principle: 'Progetto vinto' → 'Journey confirmed' (not literal)
        assert tx["journey_lifecycle_studio"]["approved"] == "Journey confirmed"
        # 'Brief in apertura' → 'Opening Brief'
        assert tx["journey_milestone"]["brief_opening"] == "Opening Brief"

    @pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not configured")
    def test_taxonomy_arabic(self):
        r = requests.get(f"{API}/api/taxonomy/ar", timeout=15)
        assert r.status_code == 200
        tx = r.json()["taxonomies"]
        assert tx["journey_lifecycle_studio"]["in_progress"] == "رحلة جارية"

    @pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not configured")
    def test_taxonomy_zh_returns_404(self):
        # ZH is not in the public registry — fail soft with 404
        r = requests.get(f"{API}/api/taxonomy/zh", timeout=15)
        assert r.status_code == 404
        assert r.json()["detail"]["error"] == "unknown_taxonomy_locale"

    @pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not configured")
    def test_list_taxonomies_endpoint(self):
        r = requests.get(f"{API}/api/taxonomy", timeout=15)
        assert r.status_code == 200
        body = r.json()
        types = {t["type"] for t in body["types"]}
        for required in ("journey_lifecycle_client", "journey_lifecycle_studio",
                         "step_status", "journey_milestone", "crm_stage", "companion_state"):
            assert required in types

    @pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not configured")
    def test_taxonomy_locale_completeness(self):
        """Every taxonomy key must have a value in every public locale."""
        for locale in ("it", "en-US", "en-GB", "fr", "de", "es", "ar"):
            r = requests.get(f"{API}/api/taxonomy/{locale}", timeout=15)
            assert r.status_code == 200, f"Locale {locale} returned {r.status_code}"
            tx = r.json()["taxonomies"]
            # Sample assertion across types
            assert tx["journey_lifecycle_studio"].get("in_progress"), \
                f"{locale}: missing journey_lifecycle_studio.in_progress"
            assert tx["step_status"].get("approved"), \
                f"{locale}: missing step_status.approved"
            assert tx["crm_stage"].get("active_client"), \
                f"{locale}: missing crm_stage.active_client"


# ── Taxonomy embedded in i18n payloads ────────────────────────
class TestTaxonomyEmbeddedInI18nPayload:
    @pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not configured")
    def test_blueprint_i18n_embeds_taxonomy(self):
        r = requests.get(f"{API}/api/blueprint/i18n/it", timeout=15)
        assert r.status_code == 200
        msgs = r.json()["messages"]
        assert msgs.get("taxonomy.journey_lifecycle_studio.in_progress") == "Viaggio in corso"
        assert msgs.get("taxonomy.crm_stage.active_client") == "Cliente attivo"

    @pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not configured")
    def test_public_i18n_embeds_taxonomy(self):
        r = requests.get(f"{API}/api/public/i18n/ar", timeout=15)
        assert r.status_code == 200
        msgs = r.json()["messages"]
        assert msgs.get("taxonomy.journey_lifecycle_studio.in_progress") == "رحلة جارية"


# ── Pulse endpoint accepts locale + returns localized labels ──
class TestPulseLocaleAware:
    def test_pulse_accepts_locale_query_param(self):
        s = PULSE_ROUTER.read_text(encoding='utf-8')
        assert "locale: str = Query" in s, \
            "Pulse endpoint must accept ?locale= query"

    def test_pulse_uses_taxonomy_resolver(self):
        s = PULSE_ROUTER.read_text(encoding='utf-8')
        assert "from taxonomy import resolve as resolve_taxonomy" in s
        assert "resolve_taxonomy(" in s

    def test_pulse_response_includes_taxonomy_keys(self):
        s = PULSE_ROUTER.read_text(encoding='utf-8')
        assert '"lifecycle_key":' in s, \
            "Response must include lifecycle_key (taxonomy reference)"
        assert '"taxonomy_key":' in s, \
            "Response must include current_milestone.taxonomy_key"

    def test_milestone_type_to_taxonomy_key_mapping_present(self):
        s = PULSE_ROUTER.read_text(encoding='utf-8')
        assert "MILESTONE_TYPE_TO_TAXONOMY_KEY" in s


# ── Frontend integration ──────────────────────────────────────
class TestFrontendIntegration:
    def test_journey_pulse_page_passes_locale(self):
        s = JOURNEY_PULSE_PAGE.read_text(encoding='utf-8')
        assert "useBlueprint" in s, \
            "JourneyPulsePage must use useBlueprint to read locale"
        assert "params: { locale }" in s, \
            "JourneyPulsePage must pass locale to /api/dashboard/pulse"

    def test_journey_pulse_page_re_runs_on_locale_change(self):
        s = JOURNEY_PULSE_PAGE.read_text(encoding='utf-8')
        # The useEffect that fetches pulse must depend on locale
        assert "}, [locale])" in s, \
            "useEffect fetching /api/dashboard/pulse must depend on locale"

    def test_useTaxonomy_hook_exists(self):
        s = BP_CTX.read_text(encoding='utf-8')
        assert "export const useTaxonomy" in s
        assert "taxonomy-missing" in s, \
            "useTaxonomy must tag missing entries as taxonomy-missing"


# ── Governance overlay · taxonomy KPI separation ──────────────
class TestGovernanceOverlayTaxonomyKpi:
    def test_missing_registry_exports_taxonomy_count(self):
        s = MISS_REG.read_text(encoding='utf-8')
        assert "export function getMissingTaxonomyCount" in s
        assert "is_taxonomy" in s, \
            "Missing entries must carry an is_taxonomy flag"

    def test_overlay_renders_separate_taxonomy_row(self):
        s = OVERLAY.read_text(encoding='utf-8')
        assert 'data-testid="governance-overlay-missing-taxonomy-row"' in s
        assert "Missing taxonomy" in s


# ── No editorial leakage in seeds / enums ────────────────────
class TestNoEditorialLeakage:
    """Sprint principle: backend enums stay technical. The user-facing
    Italian labels must NEVER appear as the canonical value of an enum
    column. They live ONLY in the taxonomy registry."""
    def test_lifecycle_state_enum_is_technical_in_pulse(self):
        s = PULSE_ROUTER.read_text(encoding='utf-8')
        # The technical states are snake_case english
        for state in ("conversation_open", "in_progress", "presenting",
                      "drifting", "on_pause", "approved", "closed"):
            assert state in s, f"Technical state {state} must remain in the source"
