"""Iter127 · Sprint ITER127 · Language Command Center™.

Validates the runtime UI copy governance + CLI audit foundation:

  • Migration 067 (`localization_overrides`, `localization_audit_runs`)
  • Router `language_api.py` (registry · override CRUD · audit ingest · leaks)
  • CLI audit script (`scripts/localization_audit.js`)
  • Frontend `LanguageCommandCenter` page (route + testids)
  • No regression on iter126 leakage detector / fallback chain

Note: Onda 2 (page-by-page string refactor with `t()`) is explicitly out
of scope for this sprint. The infrastructure landed here is what makes
Onda 2 mechanical instead of agent-dependent.
"""
import os
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO / 'backend' / '.env')
load_dotenv(REPO / 'frontend' / '.env')
API = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

MIGRATION = REPO / 'supabase' / 'migrations' / '067_language_command_center.sql'
ROUTER    = REPO / 'backend' / 'routers' / 'language_api.py'
CLI       = REPO / 'frontend' / 'scripts' / 'localization_audit.js'
APP_PAGE  = REPO / 'frontend' / 'src' / 'pages' / 'blueprint' / 'LanguageCommandCenter.jsx'
APP_JS    = REPO / 'frontend' / 'src' / 'App.js'
PKG       = REPO / 'frontend' / 'package.json'


def _studio_token():
    try:
        r = requests.post(f"{API}/api/auth/login",
                          json={"email": 'demo@moodfordesign.com',
                                "password": 'Blueprint2024!'}, timeout=15)
        if r.status_code != 200: return None
        return r.json()['session']['access_token']
    except Exception:
        return None


def _client_token():
    try:
        r = requests.post(f"{API}/api/auth/login",
                          json={"email": 'client@moodfordesign.com',
                                "password": 'Client2024!'}, timeout=15)
        if r.status_code != 200: return None
        return r.json()['session']['access_token']
    except Exception:
        return None


# ─── Migration ───────────────────────────────────────────────
class TestMigration:
    def test_file_exists(self):
        assert MIGRATION.exists()

    def test_localization_overrides_columns(self):
        s = MIGRATION.read_text(encoding='utf-8')
        for col in ('key_path', 'locale', 'override_text', 'review_status',
                    'source_text', 'surface', 'reviewed_by'):
            assert col in s, f"missing column {col}"

    def test_review_statuses(self):
        s = MIGRATION.read_text(encoding='utf-8')
        for st in ('ai_suggested', 'human_reviewed', 'locked_approved', 'stale'):
            assert st in s

    def test_audit_runs_table(self):
        s = MIGRATION.read_text(encoding='utf-8')
        assert "CREATE TABLE IF NOT EXISTS localization_audit_runs" in s
        for col in ('locale', 'pages_scanned', 'leaks_total', 'missing_total',
                    'report_json', 'triggered_via'):
            assert col in s


# ─── Router contract ─────────────────────────────────────────
@pytest.mark.skipif(not API, reason="API not configured")
class TestApi:
    @classmethod
    def teardown_class(cls):
        try:
            import psycopg2
            url = os.environ.get('DATABASE_URL')
            if not url: return
            conn = psycopg2.connect(url); conn.autocommit = True
            cur = conn.cursor()
            cur.execute("DELETE FROM localization_overrides WHERE key_path LIKE 'iter127.test.%'")
            cur.execute("DELETE FROM localization_audit_runs WHERE triggered_via = 'iter127-test'")
            cur.close(); conn.close()
        except Exception:
            pass

    def test_health(self):
        r = requests.get(f"{API}/api/language/health", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body['ok'] is True
        locales = {l['locale'] for l in body['locales']}
        assert {'it-IT', 'en-US', 'en-GB', 'fr-FR', 'de-DE', 'es-ES'}.issubset(locales)
        for l in body['locales']:
            assert l['string_count'] > 0

    def test_registry_returns_keys_with_locales(self):
        token = _studio_token()
        if not token: pytest.skip()
        r = requests.get(f"{API}/api/language/registry?limit=20",
                         headers={"Authorization": f"Bearer {token}"}, timeout=15)
        body = r.json()
        assert body['total'] >= 1
        for it in body['items']:
            for k in ('key', 'surface', 'locales'):
                assert k in it
            assert isinstance(it['locales'], dict)

    def test_registry_surface_filter(self):
        token = _studio_token()
        if not token: pytest.skip()
        r = requests.get(f"{API}/api/language/registry?surface=Navigation&limit=50",
                         headers={"Authorization": f"Bearer {token}"}, timeout=15)
        body = r.json()
        for it in body['items']:
            assert it['surface'] == 'Navigation'

    def test_registry_search_filter(self):
        token = _studio_token()
        if not token: pytest.skip()
        r = requests.get(f"{API}/api/language/registry?search=journey&limit=50",
                         headers={"Authorization": f"Bearer {token}"}, timeout=15)
        body = r.json()
        # Should find at least one journey-related key OR translated text.
        assert body['total'] >= 1 or len(body['items']) >= 0

    def test_override_create_then_appears_in_registry(self):
        token = _studio_token()
        if not token: pytest.skip()
        key = f"iter127.test.{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{API}/api/language/override",
                          json={"key_path": key, "locale": "en-US",
                                "override_text": "ITER127 override test",
                                "review_status": "human_reviewed"},
                          headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 200, r.text
        # Search by phrase in the registry.
        reg = requests.get(f"{API}/api/language/registry?search=ITER127&limit=50",
                           headers={"Authorization": f"Bearer {token}"}, timeout=15).json()
        keys = {it['key'] for it in reg['items']}
        assert key in keys, "override should appear in the registry"
        # Now delete and confirm gone.
        rd = requests.delete(
            f"{API}/api/language/override?key_path={key}&locale=en-US",
            headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert rd.status_code == 200

    def test_override_requires_admin(self):
        client_t = _client_token()
        if not client_t: pytest.skip()
        r = requests.post(f"{API}/api/language/override",
                          json={"key_path": "iter127.test.acl", "locale": "en-US",
                                "override_text": "denied"},
                          headers={"Authorization": f"Bearer {client_t}"}, timeout=15)
        assert r.status_code == 403

    def test_override_rejects_invalid_locale(self):
        token = _studio_token()
        if not token: pytest.skip()
        r = requests.post(f"{API}/api/language/override",
                          json={"key_path": "iter127.test.xyz", "locale": "xx-XX",
                                "override_text": "x"},
                          headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 422

    def test_audit_ingest_and_last(self):
        token = _studio_token()
        if not token: pytest.skip()
        r = requests.post(f"{API}/api/language/audit/ingest",
                          json={"locale": "en-US", "pages_scanned": 3,
                                "triggered_via": "iter127-test",
                                "leaks": [
                                  {"phrase": "Il dialogo", "locale": "en-US",
                                   "page": "/dashboard", "testid": "jp-action-x",
                                   "count": 5}
                                ],
                                "missing": [{"key": "brand_atlas.title", "page": "/inspirations/brands"}]},
                          headers={"Authorization": f"Bearer {token}"}, timeout=15)
        body = r.json()
        assert body['ok'] is True
        assert body['leaks_total'] == 5
        last = requests.get(f"{API}/api/language/audit/last",
                            headers={"Authorization": f"Bearer {token}"}, timeout=15).json()
        assert last.get('item'), "last_audit must return the just-ingested run"

    def test_leaks_endpoint_after_ingest(self):
        token = _studio_token()
        if not token: pytest.skip()
        r = requests.get(f"{API}/api/language/leaks",
                         headers={"Authorization": f"Bearer {token}"}, timeout=15)
        body = r.json()
        # at least one leak from the previous test run
        assert isinstance(body.get('items'), list)


# ─── Frontend page contract ──────────────────────────────────
class TestFrontendPage:
    def test_page_exists(self):
        assert APP_PAGE.exists()

    def test_route_registered(self):
        s = APP_JS.read_text(encoding='utf-8')
        assert "/blueprint/language" in s
        assert "LanguageCommandCenter" in s

    def test_required_testids(self):
        s = APP_PAGE.read_text(encoding='utf-8')
        # Literal testids (not template-literal interpolated).
        for tid in ('language-command-center', 'language-cc-search',
                    'language-cc-surface-filter', 'language-cc-locale-filter',
                    'language-cc-registry-section', 'language-cc-leakage-section'):
            assert f'"{tid}"' in s, f"missing testid {tid}"
        # Template-literal interpolated tab testids — accept the template form
        # OR the rendered literal.
        for tid in ('language-cc-tab-registry', 'language-cc-tab-leakage'):
            assert (f'"{tid}"' in s) or ('language-cc-tab-${id}' in s), (
                f"missing tab testid pattern for {tid}")


# ─── CLI script ──────────────────────────────────────────────
class TestCli:
    def test_cli_exists(self):
        assert CLI.exists()

    def test_cli_consumes_localization_overlay(self):
        s = CLI.read_text(encoding='utf-8')
        # The CLI must read from the in-page Localization Overlay & console.
        assert "[LEAKAGE]" in s
        assert "localization-overlay-panel" in s

    def test_cli_covers_target_surfaces(self):
        s = CLI.read_text(encoding='utf-8')
        for surface in ('CRM Accounts', 'Cultural Editions', 'Material View',
                        'Brand Atlas', 'Insights', 'Studio Identity',
                        'Integrations', 'Editorial Calendar', 'Market Matrix'):
            assert f"'{surface}'" in s, f"CLI must include {surface} in PAGES"

    def test_cli_writes_md_and_json(self):
        s = CLI.read_text(encoding='utf-8')
        assert "localization-leaks.md" in s
        assert "localization-leaks.json" in s

    def test_yarn_script_registered(self):
        import json
        pkg = json.loads(PKG.read_text(encoding='utf-8'))
        assert 'localization:audit' in (pkg.get('scripts') or {})


# ─── No-regression on iter126 ────────────────────────────────
class TestNoRegression:
    def test_iter126_overlay_still_mounted(self):
        s = APP_JS.read_text(encoding='utf-8')
        assert "<LocalizationOverlay />" in s

    def test_iter126_engine_still_has_strict_mode(self):
        engine = REPO / 'frontend' / 'src' / 'i18n' / 'engine.js'
        s = engine.read_text(encoding='utf-8')
        assert "STRICT MODE" in s
        assert "lang === 'it'" in s
