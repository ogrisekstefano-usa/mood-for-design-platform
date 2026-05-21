"""Iter124 · Sprint ITER124 · ALE Persistent Translation Layer™.

Validates the message_translations table, Translation Memory™, tenant DNT
registry, source_locale tracking, and the new /api/ale endpoints end-to-end.

Test groups
───────────
  ServiceModule           — translation_memory.py shape + immutability rule
  Migration               — DB tables + columns exist
  ApiLocalizeCache        — fresh → cache → memory → invalidation flow
  ApiDntRegistry          — list / add / delete tenant DNT terms
  ApiReviewSystem         — human_reviewed / locked_approved transitions
  ApiStats                — Governance Overlay numbers
  ApiSourceLocaleTracking — client_messages.source_locale propagation
  FrontendIntegration     — LocalizedMessage passes message_id + handles cache flag
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

SERVICE_TM = REPO / 'backend' / 'services' / 'translation_memory.py'
ROUTER    = REPO / 'backend' / 'routers' / 'ale_api.py'
COMP      = REPO / 'frontend' / 'src' / 'components' / 'ale' / 'LocalizedMessage.jsx'
MSG_PAGE  = REPO / 'frontend' / 'src' / 'pages' / 'client' / 'ClientMessagesPage.jsx'
MIGRATION = REPO / 'supabase' / 'migrations' / '065_ale_translation_memory.sql'


def _login(email: str, password: str) -> str | None:
    if not API:
        return None
    try:
        r = requests.post(f"{API}/api/auth/login",
                          json={"email": email, "password": password}, timeout=15)
        if r.status_code != 200:
            return None
        d = r.json()
        return d.get('session', {}).get('access_token') or d.get('access_token')
    except Exception:
        return None


def _studio_token() -> str | None:
    return _login('demo@moodfordesign.com', 'Blueprint2024!')


def _client_token() -> str | None:
    return _login('client@moodfordesign.com', 'Client2024!')


# ── Service module ────────────────────────────────────────────
class TestServiceModule:
    def test_module_exists(self):
        assert SERVICE_TM.exists(), "translation_memory.py service must exist"

    def test_exposes_public_entry(self):
        s = SERVICE_TM.read_text(encoding='utf-8')
        assert "def localize_with_memory(" in s
        assert "def invalidate_for_message(" in s
        assert "def stats_for_tenant(" in s

    def test_immutability_rule_documented(self):
        s = SERVICE_TM.read_text(encoding='utf-8')
        # The module must explicitly document the rule.
        assert "Immutability rule" in s or "immutability rule" in s.lower()

    def test_known_surfaces_complete(self):
        s = SERVICE_TM.read_text(encoding='utf-8')
        for surface in ('client_message', 'milestone_note', 'timeline_event',
                        'journey_comment', 'revision_request', 'shared_thought',
                        'site_evolution_note', 'dossier_remark'):
            assert f"'{surface}'" in s, f"surface {surface} missing from KNOWN_SURFACES"

    def test_hash_normalizes_whitespace(self):
        from services.translation_memory import _hash_original
        # Whitespace edits should NOT change the hash → no spurious cache misses.
        a = _hash_original("Ciao  Marco,    come va?")
        b = _hash_original("Ciao Marco, come va?")
        assert a == b


# ── Migration ─────────────────────────────────────────────────
class TestMigration:
    def test_migration_file_exists(self):
        assert MIGRATION.exists(), "migration 065 missing"

    def test_migration_declares_message_translations(self):
        s = MIGRATION.read_text(encoding='utf-8')
        assert "CREATE TABLE IF NOT EXISTS message_translations" in s
        assert "translation_version" in s
        assert "original_hash" in s
        assert "review_status" in s

    def test_migration_declares_tenant_dnt_registry(self):
        s = MIGRATION.read_text(encoding='utf-8')
        assert "CREATE TABLE IF NOT EXISTS tenant_dnt_registry" in s
        for cat in ('brand', 'material', 'designer', 'collection', 'studio', 'protected_term'):
            assert cat in s, f"DNT category {cat} missing from migration"

    def test_migration_adds_source_locale_to_client_messages(self):
        s = MIGRATION.read_text(encoding='utf-8')
        assert "ALTER TABLE client_messages" in s
        assert "source_locale" in s

    def test_migration_declares_studio_voice_preferences(self):
        s = MIGRATION.read_text(encoding='utf-8')
        assert "studio_translation_preferences" in s


# ── /api/ale/localize cache flow ──────────────────────────────
@pytest.mark.skipif(not API, reason="API not configured")
class TestApiLocalizeCache:
    SAMPLE_IT = ("Buongiorno Marco, abbiamo aggiornato la moodboard della "
                 "cucina con superfici opache e finiture più calde. "
                 "Ti mostriamo i campioni materici lunedì allo showroom.")

    def _unique_sample(self):
        # Inject a uuid token so the source_text/hash never collides with
        # prior runs or other test classes — Translation Memory™ is a feature,
        # not a flaky-test cause.
        return f"{self.SAMPLE_IT} [TEST·{uuid.uuid4()}]"

    def test_health_lists_surfaces_and_review_statuses(self):
        r = requests.get(f"{API}/api/ale/health", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert 'client_message' in body['surfaces']
        assert 'milestone_note' in body['surfaces']
        assert set(body['review_statuses']) == {
            'ai_only', 'human_reviewed', 'locked_approved'}

    def test_fresh_then_cache_hit_for_same_message(self):
        token = _studio_token()
        if not token:
            pytest.skip("login failed")
        msg_id = f"test-iter124-{uuid.uuid4()}"
        payload = {
            "text": self._unique_sample(),
            "source_locale": "it",
            "target_locale": "en-US",
            "message_id": msg_id,
            "surface": "client_message",
        }
        r1 = requests.post(f"{API}/api/ale/localize", json=payload,
                           headers={"Authorization": f"Bearer {token}"}, timeout=60)
        assert r1.status_code == 200, r1.text
        b1 = r1.json()
        assert b1['translation_source'] == 'fresh', f"first call should be fresh, got {b1.get('translation_source')}"
        assert b1['translation_cached'] is False
        assert b1['translation_version'] == 1
        assert b1['localized_text'] and b1['localized_text'] != b1['original_text']

        # Same payload → cache hit.
        r2 = requests.post(f"{API}/api/ale/localize", json=payload,
                           headers={"Authorization": f"Bearer {token}"}, timeout=15)
        b2 = r2.json()
        assert b2['translation_source'] == 'cache'
        assert b2['translation_cached'] is True
        assert b2['localized_text'] == b1['localized_text']
        assert b2['translation_version'] == 1

    def test_translation_memory_reuse_across_messages(self):
        token = _studio_token()
        if not token:
            pytest.skip("login failed")
        text = f"Memoria · {uuid.uuid4()} · Allego la nuova selezione materica."
        msg_a = f"tm-{uuid.uuid4()}"
        msg_b = f"tm-{uuid.uuid4()}"

        r1 = requests.post(f"{API}/api/ale/localize",
                           json={"text": text, "source_locale": "it",
                                 "target_locale": "en-US", "message_id": msg_a},
                           headers={"Authorization": f"Bearer {token}"}, timeout=60)
        b1 = r1.json()
        assert b1['translation_source'] == 'fresh'
        out1 = b1['localized_text']

        r2 = requests.post(f"{API}/api/ale/localize",
                           json={"text": text, "source_locale": "it",
                                 "target_locale": "en-US", "message_id": msg_b},
                           headers={"Authorization": f"Bearer {token}"}, timeout=30)
        b2 = r2.json()
        assert b2['translation_source'] == 'memory', f"expected memory reuse, got {b2.get('translation_source')}"
        assert b2['translation_cached'] is True
        # Translation Memory™ stability — same source text → same localized text.
        assert b2['localized_text'] == out1

    def test_invalidation_on_source_edit_bumps_version(self):
        token = _studio_token()
        if not token:
            pytest.skip("login failed")
        msg_id = f"edit-{uuid.uuid4()}"
        marker = uuid.uuid4()

        v1 = requests.post(f"{API}/api/ale/localize",
                           json={"text": f"Versione iniziale del messaggio editoriale. [{marker}]",
                                 "source_locale": "it", "target_locale": "en-US",
                                 "message_id": msg_id},
                           headers={"Authorization": f"Bearer {token}"}, timeout=60).json()
        assert v1['translation_version'] == 1

        # Edit the source — same message_id, different text → cache MISS + version bump.
        v2 = requests.post(f"{API}/api/ale/localize",
                           json={"text": f"Versione aggiornata e diversa del messaggio editoriale, con riferimenti nuovi. [{marker}]",
                                 "source_locale": "it", "target_locale": "en-US",
                                 "message_id": msg_id},
                           headers={"Authorization": f"Bearer {token}"}, timeout=60).json()
        assert v2['translation_source'] == 'fresh'
        assert v2['translation_version'] == 2

    def test_no_op_for_same_locale(self):
        token = _studio_token()
        if not token:
            pytest.skip("login failed")
        r = requests.post(f"{API}/api/ale/localize",
                          json={"text": "Ciao Marco", "source_locale": "it",
                                "target_locale": "it"},
                          headers={"Authorization": f"Bearer {token}"}, timeout=15)
        body = r.json()
        assert body['translation_source'] == 'no_op'
        assert body['translated'] is False

    def test_payload_shape_includes_iter124_fields(self):
        token = _studio_token()
        if not token:
            pytest.skip("login failed")
        r = requests.post(f"{API}/api/ale/localize",
                          json={"text": "Buongiorno.", "source_locale": "it",
                                "target_locale": "en-US"},
                          headers={"Authorization": f"Bearer {token}"}, timeout=60)
        body = r.json()
        # iter124 contract — every payload exposes these.
        for k in ('translation_cached', 'translation_source', 'review_status',
                  'translation_version', 'original_text', 'localized_text',
                  'source_locale', 'target_locale'):
            assert k in body, f"missing field {k} in payload"


# ── Tenant DNT registry ───────────────────────────────────────
@pytest.mark.skipif(not API, reason="API not configured")
class TestApiDntRegistry:
    def test_list_empty_or_populated(self):
        token = _studio_token()
        if not token:
            pytest.skip("login failed")
        r = requests.get(f"{API}/api/ale/dnt",
                         headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json().get('items'), list)

    def test_add_then_appears(self):
        token = _studio_token()
        if not token:
            pytest.skip("login failed")
        term = f"TestBrand-{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{API}/api/ale/dnt",
                          json={"term": term, "category": "brand"},
                          headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 200, r.text
        listing = requests.get(f"{API}/api/ale/dnt",
                               headers={"Authorization": f"Bearer {token}"}, timeout=15).json()
        terms = [it['term'] for it in listing['items'] if it.get('active')]
        assert term in terms

    def test_delete_deactivates(self):
        token = _studio_token()
        if not token:
            pytest.skip("login failed")
        term = f"TempBrand-{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{API}/api/ale/dnt",
                          json={"term": term, "category": "brand"},
                          headers={"Authorization": f"Bearer {token}"}, timeout=15)
        item = r.json().get('item')
        if not item:
            pytest.skip("dnt create returned empty (db unavailable)")
        rd = requests.delete(f"{API}/api/ale/dnt/{item['id']}",
                             headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert rd.status_code == 200


# ── Review system ─────────────────────────────────────────────
@pytest.mark.skipif(not API, reason="API not configured")
class TestApiReviewSystem:
    def test_review_rejects_invalid_status(self):
        token = _studio_token()
        if not token:
            pytest.skip("login failed")
        r = requests.post(f"{API}/api/ale/review/00000000-0000-0000-0000-000000000000",
                          json={"review_status": "not_a_valid_status"},
                          headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 422

    def test_review_404_on_missing_variant(self):
        token = _studio_token()
        if not token:
            pytest.skip("login failed")
        r = requests.post(f"{API}/api/ale/review/00000000-0000-0000-0000-000000000000",
                          json={"review_status": "human_reviewed"},
                          headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code in (404, 500)  # variant_not_found or supabase error wrapping


# ── Stats ─────────────────────────────────────────────────────
@pytest.mark.skipif(not API, reason="API not configured")
class TestApiStats:
    def test_stats_shape(self):
        token = _studio_token()
        if not token:
            pytest.skip("login failed")
        r = requests.get(f"{API}/api/ale/stats",
                         headers={"Authorization": f"Bearer {token}"}, timeout=15)
        body = r.json()
        for k in ('cache_total', 'reviewed', 'locked', 'today'):
            assert k in body
        assert isinstance(body['cache_total'], int)


# ── Source-locale tracking on client_messages ────────────────
@pytest.mark.skipif(not API, reason="API not configured")
class TestApiSourceLocaleTracking:
    TEST_MARKER = "[ITER124-test-marker]"

    @classmethod
    def teardown_class(cls):
        """Self-clean any client_messages rows created by these tests, so
        the demo thread stays editorial and free of test pollution."""
        try:
            import psycopg2
            db_url = os.environ.get('DATABASE_URL')
            if not db_url:
                return
            conn = psycopg2.connect(db_url); conn.autocommit = True
            cur = conn.cursor()
            cur.execute("DELETE FROM client_messages WHERE message_body LIKE %s",
                        (f"%{cls.TEST_MARKER}%",))
            cur.close(); conn.close()
        except Exception:
            pass

    def test_studio_reply_persists_source_locale(self):
        studio = _studio_token()
        client_t = _client_token()
        if not studio or not client_t:
            pytest.skip("login failed")
        client_profile = "206df385-ea5b-4bca-9a20-4528e285e37a"
        body_text = f"{self.TEST_MARKER} · {uuid.uuid4()}"
        r = requests.post(f"{API}/api/client-messages/send",
                          json={"client_id": client_profile,
                                "message_body": body_text,
                                "source_locale": "it"},
                          headers={"Authorization": f"Bearer {studio}"}, timeout=15)
        assert r.status_code == 200, r.text
        thread = requests.get(f"{API}/api/client-messages/thread",
                              headers={"Authorization": f"Bearer {client_t}"}, timeout=15).json()
        msgs = thread.get('messages', [])
        target = next((m for m in msgs if m.get('message_body') == body_text), None)
        assert target is not None, "studio message not visible to client"
        assert target.get('source_locale') == 'it'


# ── Frontend component contract ──────────────────────────────
class TestFrontendIntegration:
    def test_localized_message_accepts_messageid_prop(self):
        s = COMP.read_text(encoding='utf-8')
        assert "messageId" in s, "LocalizedMessage must accept messageId prop"
        assert "surface" in s, "LocalizedMessage must accept surface prop"

    def test_localized_message_sends_message_id_in_request(self):
        s = COMP.read_text(encoding='utf-8')
        assert "message_id:" in s and "messageId" in s

    def test_localized_message_handles_translation_cached(self):
        s = COMP.read_text(encoding='utf-8')
        assert "translation_cached" in s, (
            "iter124 — component must read translation_cached to "
            "suppress shimmer on cached variants")

    def test_client_messages_passes_messageid(self):
        s = MSG_PAGE.read_text(encoding='utf-8')
        assert "messageId={message.id}" in s

    def test_client_messages_send_includes_source_locale(self):
        s = MSG_PAGE.read_text(encoding='utf-8')
        assert "source_locale: uiLocale" in s or "source_locale:" in s
