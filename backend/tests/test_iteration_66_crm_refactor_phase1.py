"""
Iteration 66 — CRM Refactor Phase 1 (Relationship OS)
Backend tests for:
  • GET /api/relationships/accounts/{aid}/summary
  • GET /api/relationships/accounts/{aid}/mood-signals
  • POST /api/relationships/accounts/{aid}/cultural-editions
  • POST /api/relationships/accounts/{aid}/voice-notes
  • POST /api/relationships/accounts/{aid}/stage
  • Migration 051 — canonical lifecycle_stage + account_type lookups
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
EMAIL = "demo@moodfordesign.com"
PASSWORD = "Blueprint2024!"
ACCOUNT_ID = "8e40f60c-1e91-4b4e-9d13-a52fc71c146a"  # Maya Aldhabi


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": EMAIL, "password": PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    sess = data.get("session") or {}
    tok = sess.get("access_token") or data.get("access_token") or data.get("token")
    assert tok, f"No token in login response: {data}"
    return tok


@pytest.fixture(scope="module")
def session(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}",
                      "Content-Type": "application/json"})
    return s


# ─── Migration 051 canonical lookups ─────────────────────────────────
class TestLookupsMigration051:
    @staticmethod
    def _extract_keys(body, group):
        lk = body.get("lookups") if isinstance(body, dict) else None
        items = []
        if isinstance(lk, dict):
            items = lk.get(group) or []
        elif isinstance(body, list):
            items = body
        elif isinstance(body, dict):
            items = body.get("items") or body.get("data") or []
        return {(i.get("value_key") or i.get("key") or i.get("value") or i.get("code") or "").lower()
                for i in items}

    def test_lifecycle_stage_canonical_entries(self, session):
        r = session.get(f"{BASE_URL}/api/relationships/lookups?group=lifecycle_stage",
                        timeout=20)
        assert r.status_code == 200, r.text
        keys = self._extract_keys(r.json(), "lifecycle_stage")
        required = {"lead", "prospect", "qualified", "active_project",
                    "client", "returning_client", "archived"}
        missing = required - keys
        assert not missing, f"Missing lifecycle_stage keys: {missing}. Got={keys}"

    def test_account_type_canonical_entries(self, session):
        r = session.get(f"{BASE_URL}/api/relationships/lookups?group=account_type",
                        timeout=20)
        assert r.status_code == 200, r.text
        keys = self._extract_keys(r.json(), "account_type")
        required = {"hotel_group", "yacht_client", "luxury_retail", "partner_brand"}
        missing = required - keys
        assert not missing, f"Missing account_type keys: {missing}. Got={keys}"


# ─── Summary endpoint ────────────────────────────────────────────────
class TestRelationshipSummary:
    def test_summary_returns_required_shape(self, session):
        r = session.get(f"{BASE_URL}/api/relationships/accounts/{ACCOUNT_ID}/summary",
                        timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["account", "mood", "owner", "advisor", "style", "submarket",
                  "last_interaction", "next_action", "insights"]:
            assert k in data, f"Missing key '{k}' in summary"
        assert isinstance(data["mood"], dict)
        assert "tags" in data["mood"] and isinstance(data["mood"]["tags"], list)
        assert "dominant" in data["mood"]
        assert isinstance(data["insights"], list)


# ─── Mood signals endpoint ───────────────────────────────────────────
class TestMoodSignals:
    def test_mood_signals_shape(self, session):
        r = session.get(f"{BASE_URL}/api/relationships/accounts/{ACCOUNT_ID}/mood-signals",
                        timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "mood" in data
        m = data["mood"]
        assert "tags" in m and isinstance(m["tags"], list)
        assert "dominant" in m
        assert "secondary" in m
        assert "computed_at" in m


# ─── Cultural editions endpoint ──────────────────────────────────────
class TestCulturalEdition:
    def test_cultural_edition_creates_interaction(self, session):
        # Pick a real submarket. Miami code per the spec.
        payload = {
            "source_type": "project",
            "source_id": "TEST_src_iter66",
            "target_market_code": "usa_south_florida",
            "target_submarket_code": "usa_miami",
            "target_locale": "en-US",
            "note": "TEST_iter66 cultural edition intent",
        }
        r = session.post(
            f"{BASE_URL}/api/relationships/accounts/{ACCOUNT_ID}/cultural-editions",
            json=payload, timeout=30,
        )
        # If usa_miami isn't the canonical submarket code on demo, try 'miami'
        if r.status_code == 404:
            payload["target_submarket_code"] = "miami"
            r = session.post(
                f"{BASE_URL}/api/relationships/accounts/{ACCOUNT_ID}/cultural-editions",
                json=payload, timeout=30,
            )
        assert r.status_code == 201, f"Cultural edition POST failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("ok") is True
        assert "intent_id" in body
        assert "submarket" in body and body["submarket"].get("code")

        # Verify a new interaction appears on the timeline with the right title.
        ints = session.get(
            f"{BASE_URL}/api/relationships/accounts/{ACCOUNT_ID}/interactions?limit=10",
            timeout=20,
        )
        if ints.status_code == 200:
            data = ints.json()
            rows = data.get("interactions") if isinstance(data, dict) else data
            rows = rows or []
            titles = [(it.get("title") or "") for it in rows]
            assert any("Cultural Edition" in t for t in titles), \
                f"No 'Cultural Edition' interaction on timeline. Titles={titles}"


# ─── Voice notes endpoint ────────────────────────────────────────────
class TestVoiceNotes:
    def test_voice_note_upload_creates_interaction(self, token):
        # Minimal WAV header (44 bytes) + a few silence frames so OpenAI does not reject.
        wav_header = (
            b"RIFF$\x08\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00"
            b"\x44\xAC\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x08\x00\x00"
        )
        payload = wav_header + (b"\x00\x00" * 1024)  # ~2 KB of silence

        files = {"file": ("test_voice.wav", payload, "audio/wav")}
        data = {"title": "TEST_iter66 voice", "locale": "it-IT"}
        r = requests.post(
            f"{BASE_URL}/api/relationships/accounts/{ACCOUNT_ID}/voice-notes",
            files=files, data=data,
            headers={"Authorization": f"Bearer {token}"},
            timeout=60,
        )
        assert r.status_code == 201, f"Voice note POST failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("ok") is True
        assert "interaction" in body, body
        interaction = body["interaction"]
        assert interaction.get("interaction_type") == "voice_note"

        # Attachment with signed URL MUST exist even if transcript fails.
        atts = interaction.get("attachments") or []
        assert atts, "Voice note interaction missing attachments[]"
        att = atts[0]
        assert att.get("kind") == "audio"
        assert att.get("url"), f"Attachment URL missing — signed URL required. att={att}"
        # signed URL on supabase typically has 'token=' query
        assert "http" in att["url"], f"Attachment URL not a URL: {att['url']}"

        # transcript_ok may be True or False (Whisper unreliable) — both pass.


# ─── Stage change endpoint ───────────────────────────────────────────
class TestStageChange:
    def test_stage_change_to_lead(self, session):
        # Capture current stage to restore in teardown via test order.
        before = session.get(f"{BASE_URL}/api/relationships/accounts/{ACCOUNT_ID}",
                             timeout=20)
        assert before.status_code == 200, before.text
        before_body = before.json()
        before_acc = before_body.get("account") if isinstance(before_body.get("account"), dict) else before_body
        original_stage = before_acc.get("lifecycle_stage")

        try:
            r = session.post(
                f"{BASE_URL}/api/relationships/accounts/{ACCOUNT_ID}/stage",
                json={"lifecycle_stage": "lead", "note": "TEST_iter66 stage change"},
                timeout=30,
            )
            assert r.status_code in (200, 201), f"Stage change failed: {r.status_code} {r.text}"

            # Verify stage updated
            after = session.get(f"{BASE_URL}/api/relationships/accounts/{ACCOUNT_ID}",
                                timeout=20)
            assert after.status_code == 200
            after_body = after.json()
            after_acc = after_body.get("account") if isinstance(after_body.get("account"), dict) else after_body
            assert after_acc.get("lifecycle_stage") == "lead", \
                f"Expected stage='lead', got {after_acc.get('lifecycle_stage')}"

            # Verify a stage_change interaction landed on the timeline
            ints = session.get(
                f"{BASE_URL}/api/relationships/accounts/{ACCOUNT_ID}/interactions?limit=10",
                timeout=20,
            )
            if ints.status_code == 200:
                data = ints.json()
                rows = data.get("interactions") if isinstance(data, dict) else data
                rows = rows or []
                types = [(it.get("interaction_type") or "") for it in rows]
                assert "stage_change" in types, \
                    f"Expected 'stage_change' interaction. Got types={types}"
        finally:
            # Restore prior stage if it was different
            if original_stage and original_stage != "lead":
                session.post(
                    f"{BASE_URL}/api/relationships/accounts/{ACCOUNT_ID}/stage",
                    json={"lifecycle_stage": original_stage, "note": "TEST_iter66 restore"},
                    timeout=20,
                )
