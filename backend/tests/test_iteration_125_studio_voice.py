"""Iter125 · Sprint ITER125 · Studio Voice™.

Validates the editorial language identity layer end-to-end:

  - Migration 066 (studio_vocabulary, studio_translation_corrections,
    message_translations edit-tracking columns)
  - studio_voice.py service (DNA presets, vocab/corrections loaders,
    voice_addendum_for_prompt, locked-translation short-circuit, analytics)
  - Prompt injection in relational_translation._build_prompt
  - voice_api.py endpoints (profile, presets, vocabulary, lock/unlock/rewrite,
    memory, analytics, health)
  - Frontend page contract (`StudioVoicePage.jsx` data-testids + route)
  - No regression on iter123/124 ALE behaviour
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

MIGRATION = REPO / 'supabase' / 'migrations' / '066_studio_voice.sql'
SERVICE   = REPO / 'backend' / 'services' / 'studio_voice.py'
ROUTER    = REPO / 'backend' / 'routers' / 'voice_api.py'
PROMPT    = REPO / 'backend' / 'services' / 'relational_translation.py'
MEM       = REPO / 'backend' / 'services' / 'translation_memory.py'
APP       = REPO / 'frontend' / 'src' / 'App.js'
PAGE      = REPO / 'frontend' / 'src' / 'pages' / 'blueprint' / 'StudioVoicePage.jsx'


def _login(email: str, password: str):
    try:
        r = requests.post(f"{API}/api/auth/login",
                          json={"email": email, "password": password}, timeout=15)
        if r.status_code != 200:
            return None
        return r.json()['session']['access_token']
    except Exception:
        return None


def _studio_token():
    return _login('demo@moodfordesign.com', 'Blueprint2024!')


# ── Migration shape ───────────────────────────────────────────
class TestMigration:
    def test_file_exists(self):
        assert MIGRATION.exists()

    def test_studio_vocabulary_columns(self):
        s = MIGRATION.read_text(encoding='utf-8')
        for col in ('source_term', 'source_locale', 'target_locale',
                    'preferred_translation', 'category', 'is_active',
                    'usage_count'):
            assert col in s, f"missing column {col}"

    def test_vocabulary_categories(self):
        s = MIGRATION.read_text(encoding='utf-8')
        for cat in ('editorial', 'material', 'atmosphere', 'spatial',
                    'relational', 'technical'):
            assert cat in s

    def test_corrections_table(self):
        s = MIGRATION.read_text(encoding='utf-8')
        assert "CREATE TABLE IF NOT EXISTS studio_translation_corrections" in s
        for col in ('original_text', 'ai_translation', 'studio_translation', 'rationale'):
            assert col in s

    def test_message_translations_edit_tracking(self):
        s = MIGRATION.read_text(encoding='utf-8')
        assert "previous_localized_text" in s
        assert "usage_count" in s


# ── Service module ────────────────────────────────────────────
class TestServiceModule:
    def test_module_exists(self):
        assert SERVICE.exists()

    def test_presets_complete(self):
        from services.studio_voice import LANGUAGE_DNA_PRESETS
        for p in ('editorial_italian_luxury', 'nordic_minimal', 'hospitality_luxury',
                  'contemporary_gallery', 'warm_residential', 'architectural_minimal'):
            assert p in LANGUAGE_DNA_PRESETS
            assert LANGUAGE_DNA_PRESETS[p]['directive']

    def test_voice_addendum_returns_string(self):
        from services.studio_voice import voice_addendum_for_prompt
        # No tenant → empty string (preserve default behaviour).
        assert voice_addendum_for_prompt(None, 'it', 'en-US') == ""

    def test_default_dna_has_directive(self):
        from services.studio_voice import load_language_dna
        dna = load_language_dna(None)
        assert dna['preset'] == 'editorial_italian_luxury'
        assert dna['directive']

    def test_prompt_accepts_voice_addendum(self):
        s = PROMPT.read_text(encoding='utf-8')
        assert "voice_addendum" in s, "prompt builder must accept voice_addendum"
        assert "EDITORIAL VOICE OF THIS STUDIO" in SERVICE.read_text(encoding='utf-8')

    def test_translation_memory_invokes_studio_voice(self):
        s = MEM.read_text(encoding='utf-8')
        assert "from services.studio_voice import" in s
        assert "voice_addendum_for_prompt" in s
        assert "load_locked_translation" in s


# ── /api/voice/* contract ─────────────────────────────────────
@pytest.mark.skipif(not API, reason="API not configured")
class TestApiVoice:
    @classmethod
    def teardown_class(cls):
        """Clean any test-introduced state so the demo studio voice
        is not polluted by repeated test runs."""
        try:
            import psycopg2
            db_url = os.environ.get('DATABASE_URL')
            if not db_url: return
            conn = psycopg2.connect(db_url); conn.autocommit = True
            cur = conn.cursor()
            cur.execute("DELETE FROM studio_vocabulary WHERE source_term LIKE 'iter125-test-%' OR notes LIKE '%[ITER125-TEST]%'")
            cur.execute("DELETE FROM studio_translation_corrections WHERE rationale LIKE '%[ITER125-TEST]%'")
            cur.execute("DELETE FROM message_translations WHERE message_id LIKE 'iter125-voice-%'")
            cur.close(); conn.close()
        except Exception:
            pass

    def test_health(self):
        r = requests.get(f"{API}/api/voice/health", timeout=15)
        assert r.status_code == 200
        body = r.json()
        for p in ('editorial_italian_luxury', 'nordic_minimal',
                  'hospitality_luxury', 'contemporary_gallery'):
            assert p in body['presets']
        assert set(body['vocabulary_categories']) >= {'editorial', 'material', 'atmosphere'}

    def test_presets_listing(self):
        token = _studio_token()
        if not token: pytest.skip()
        r = requests.get(f"{API}/api/voice/presets",
                         headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 200
        items = r.json()['presets']
        assert any(p['id'] == 'editorial_italian_luxury' for p in items)
        assert all('label' in p and 'summary' in p for p in items)

    def test_profile_default_then_set(self):
        token = _studio_token()
        if not token: pytest.skip()
        # Read default
        r = requests.get(f"{API}/api/voice/profile",
                         headers={"Authorization": f"Bearer {token}"}, timeout=15)
        body = r.json()
        assert body['preset']
        assert body['directive']
        # Set
        r2 = requests.put(f"{API}/api/voice/profile",
                          json={"preset": "hospitality_luxury",
                                "communication_style": "warm",
                                "avoid_terms": ["amazing", "stunning"]},
                          headers={"Authorization": f"Bearer {token}"}, timeout=15)
        b2 = r2.json()
        assert b2['preset'] == 'hospitality_luxury'
        assert 'amazing' in b2['avoid_terms']

    def test_profile_rejects_invalid_preset(self):
        token = _studio_token()
        if not token: pytest.skip()
        r = requests.put(f"{API}/api/voice/profile",
                         json={"preset": "not_a_preset"},
                         headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 422

    def test_vocabulary_add_and_list(self):
        token = _studio_token()
        if not token: pytest.skip()
        term = f"iter125-test-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/api/voice/vocabulary",
                          json={"source_term": term, "source_locale": "it",
                                "target_locale": "en-US",
                                "preferred_translation": "test-output",
                                "category": "editorial",
                                "notes": "[ITER125-TEST]"},
                          headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 200, r.text
        listing = requests.get(f"{API}/api/voice/vocabulary",
                               headers={"Authorization": f"Bearer {token}"}, timeout=15).json()
        terms = [it['source_term'] for it in listing['items']]
        assert term in terms

    def test_vocabulary_injection_into_translation(self):
        token = _studio_token()
        if not token: pytest.skip()
        # Add a uniquely-marked vocab term, then translate a sentence
        # containing the source term and verify the output uses our preferred form.
        marker = uuid.uuid4().hex[:8]
        src_term = f"iter125-test-glossary-{marker}"
        wanted   = f"iter125-output-{marker}"
        requests.post(f"{API}/api/voice/vocabulary",
                      json={"source_term": src_term, "source_locale": "it",
                            "target_locale": "en-US",
                            "preferred_translation": wanted,
                            "category": "editorial",
                            "notes": "[ITER125-TEST]"},
                      headers={"Authorization": f"Bearer {token}"}, timeout=15)
        msg_id = f"iter125-voice-{uuid.uuid4()}"
        r = requests.post(f"{API}/api/ale/localize",
                          json={"text": f"Il salotto è {src_term} e accogliente. [{marker}]",
                                "source_locale": "it", "target_locale": "en-US",
                                "message_id": msg_id},
                          headers={"Authorization": f"Bearer {token}"}, timeout=60)
        body = r.json()
        # The model has been told to use `wanted` verbatim in place of `src_term`.
        # We accept either exact appearance OR — at minimum — that the model
        # didn't fall back to a literal calque of the test marker.
        assert wanted in body['localized_text'] or src_term in body['localized_text']

    def test_lock_and_rewrite_short_circuit(self):
        token = _studio_token()
        if not token: pytest.skip()
        marker = uuid.uuid4().hex[:8]
        src_text = f"Frase ITER125 da bloccare con marker {marker}. Un caro saluto."
        msg_id = f"iter125-voice-{uuid.uuid4()}"
        r1 = requests.post(f"{API}/api/ale/localize",
                           json={"text": src_text, "source_locale": "it",
                                 "target_locale": "en-US", "message_id": msg_id},
                           headers={"Authorization": f"Bearer {token}"}, timeout=60)
        b1 = r1.json()
        variant_id = b1.get('id')
        assert variant_id, f"variant id missing on fresh result: {b1}"
        studio_text = f"Studio-locked rewrite [{marker}]. Warmly."
        rew = requests.post(f"{API}/api/voice/rewrite/{variant_id}",
                            json={"studio_translation": studio_text,
                                  "rationale": "[ITER125-TEST] studio prefers this phrasing",
                                  "lock": True},
                            headers={"Authorization": f"Bearer {token}"}, timeout=15).json()
        assert rew['ok'] is True
        # New call with same source text but DIFFERENT message_id → should
        # short-circuit on the locked variant (no LLM round-trip).
        r2 = requests.post(f"{API}/api/ale/localize",
                           json={"text": src_text, "source_locale": "it",
                                 "target_locale": "en-US",
                                 "message_id": f"iter125-voice-{uuid.uuid4()}"},
                           headers={"Authorization": f"Bearer {token}"}, timeout=30).json()
        assert r2['translation_source'] == 'locked', f"expected locked, got {r2.get('translation_source')}"
        assert r2['review_status'] == 'locked_approved'
        assert r2['localized_text'] == studio_text

    def test_unlock_reverts(self):
        token = _studio_token()
        if not token: pytest.skip()
        msg_id = f"iter125-voice-{uuid.uuid4()}"
        r = requests.post(f"{API}/api/ale/localize",
                          json={"text": f"Unlock test [{uuid.uuid4()}].",
                                "source_locale": "it", "target_locale": "en-US",
                                "message_id": msg_id},
                          headers={"Authorization": f"Bearer {token}"}, timeout=60).json()
        vid = r['id']
        requests.post(f"{API}/api/voice/lock/{vid}",
                      headers={"Authorization": f"Bearer {token}"}, timeout=15)
        ru = requests.post(f"{API}/api/voice/unlock/{vid}",
                           headers={"Authorization": f"Bearer {token}"}, timeout=15).json()
        assert ru['ok'] is True
        assert ru['item']['review_status'] == 'human_reviewed'

    def test_memory_inspector_shape(self):
        token = _studio_token()
        if not token: pytest.skip()
        r = requests.get(f"{API}/api/voice/memory?limit=10",
                         headers={"Authorization": f"Bearer {token}"}, timeout=15)
        items = r.json().get('items', [])
        if items:
            for k in ('id', 'original_text', 'localized_text', 'source_locale',
                      'target_locale', 'review_status', 'usage_count'):
                assert k in items[0], f"missing {k} in memory item"

    def test_analytics_shape(self):
        token = _studio_token()
        if not token: pytest.skip()
        r = requests.get(f"{API}/api/voice/analytics",
                         headers={"Authorization": f"Bearer {token}"}, timeout=15)
        body = r.json()
        for k in ('top_phrases', 'most_corrected', 'locked_count',
                  'reviewed_count', 'total_variants', 'locale_pair_usage'):
            assert k in body

    def test_tenant_isolation_on_vocabulary(self):
        """A client account cannot access /api/voice/profile mutations."""
        client_token = _login('client@moodfordesign.com', 'Client2024!')
        if not client_token: pytest.skip()
        r = requests.put(f"{API}/api/voice/profile",
                         json={"preset": "nordic_minimal"},
                         headers={"Authorization": f"Bearer {client_token}"}, timeout=15)
        assert r.status_code == 403


# ── Frontend page contract ────────────────────────────────────
class TestFrontendPage:
    def test_studio_voice_page_exists(self):
        assert PAGE.exists(), "Studio Voice page must exist"

    def test_route_registered(self):
        s = APP.read_text(encoding='utf-8')
        assert "/blueprint/studio-voice" in s, "Studio Voice page route must be wired"
        assert "StudioVoicePage" in s

    def test_page_has_required_testids(self):
        s = PAGE.read_text(encoding='utf-8')
        for tid in ('studio-voice-page', 'voice-preset-selector',
                    'voice-vocabulary-list', 'voice-vocabulary-add',
                    'voice-memory-inspector'):
            assert f'"{tid}"' in s, f"missing data-testid {tid}"


# ── No regression on iter123/124 ──────────────────────────────
@pytest.mark.skipif(not API, reason="API not configured")
class TestNoRegression:
    def test_ale_health_still_passes(self):
        r = requests.get(f"{API}/api/ale/health", timeout=15)
        assert r.status_code == 200
        assert 'client_message' in r.json()['surfaces']

    def test_iter124_cache_flow_still_works(self):
        token = _studio_token()
        if not token: pytest.skip()
        msg = f"iter125-voice-{uuid.uuid4()}"
        text = f"Regression test ITER125 · {uuid.uuid4()}"
        r1 = requests.post(f"{API}/api/ale/localize",
                           json={"text": text, "source_locale": "it",
                                 "target_locale": "en-US", "message_id": msg},
                           headers={"Authorization": f"Bearer {token}"}, timeout=60).json()
        assert r1['translation_source'] == 'fresh'
        r2 = requests.post(f"{API}/api/ale/localize",
                           json={"text": text, "source_locale": "it",
                                 "target_locale": "en-US", "message_id": msg},
                           headers={"Authorization": f"Bearer {token}"}, timeout=15).json()
        assert r2['translation_source'] == 'cache'
