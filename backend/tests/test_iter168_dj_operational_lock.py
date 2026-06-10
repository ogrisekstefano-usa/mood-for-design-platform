"""ITER168 Phase 1 — Design Journey™ Operational Refactor (DB + API).

Coverage:
  • Migration 107 applicata correttamente (schema lock)
  • GET  /api/journeys/catalog/rooms      (public)
  • GET  /api/journeys/catalog/chapters   (public)
  • E2E: /api/public/journeys/initiate crea journey + journey_brief
  • GET  /api/journeys/{jid}/overview      (auth as admin)
  • PATCH /api/journeys/{jid}/lifecycle    (layer 1)
  • PATCH /api/journeys/{jid}/milestones/{mid}/status (layer 2)
  • POST  /api/journeys/{jid}/milestones/{mid}/skip
  • POST  /api/journeys/{jid}/milestones/{mid}/reopen
  • POST  /api/journeys/{jid}/milestones/parallel
  • Trigger sync_leads_progression_from_account (smoke)
"""
import os
import sys
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://i18n-recovery-1.preview.emergentagent.com",
).rstrip("/")

ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASSWORD = "Blueprint2024!"

sys.path.insert(0, "/app/backend")


# ── Auth helper ─────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.text}"
    body = r.json()
    token = (body.get("access_token")
             or body.get("token")
             or (body.get("session") or {}).get("access_token"))
    assert token, f"no token: {body}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ════════════════════════════════════════════════════════════════════════
# §1 · CATALOG (public, no auth)
# ════════════════════════════════════════════════════════════════════════
class TestCatalogRooms:
    URL = f"{BASE_URL}/api/journeys/catalog/rooms"

    def test_returns_active_rooms_default_locale_it(self):
        r = requests.get(self.URL)
        assert r.status_code == 200, r.text
        body = r.json()
        rooms = body.get("rooms", [])
        assert len(rooms) >= 16, f"expected ≥16 rooms, got {len(rooms)}"
        keys = {r["key"] for r in rooms}
        # Spot check key rooms exist
        for k in ("kitchen", "living", "bathroom_master", "facade",
                  "hospitality_lobby"):
            assert k in keys, f"missing room {k}"
        # IT labels resolved
        kitchen = next(r for r in rooms if r["key"] == "kitchen")
        assert kitchen["label"] == "Cucina"
        assert "atmosphere" in kitchen["default_chapters"]

    def test_locale_en_fallback(self):
        r = requests.get(f"{self.URL}?locale=en")
        assert r.status_code == 200
        kitchen = next(r for r in r.json()["rooms"] if r["key"] == "kitchen")
        assert kitchen["label"] == "Kitchen"

    def test_category_filter(self):
        r = requests.get(f"{self.URL}?category=hospitality")
        rooms = r.json()["rooms"]
        assert all(rm["category"] == "hospitality" for rm in rooms)
        assert len(rooms) >= 2


class TestCatalogChapters:
    URL = f"{BASE_URL}/api/journeys/catalog/chapters"

    def test_returns_active_chapters(self):
        r = requests.get(self.URL)
        assert r.status_code == 200
        chapters = r.json().get("chapters", [])
        assert len(chapters) >= 9
        keys = {c["key"] for c in chapters}
        for k in ("atmosphere", "palette", "textures", "lighting",
                  "furniture", "art", "finishes"):
            assert k in keys
        atm = next(c for c in chapters if c["key"] == "atmosphere")
        assert atm["label"] == "Atmosfera"
        assert atm["description"] == "Il sentire dello spazio"


# ════════════════════════════════════════════════════════════════════════
# §2 · E2E intake → journey + journey_brief materialized
# ════════════════════════════════════════════════════════════════════════
@pytest.fixture(scope="module")
def fresh_journey():
    """Crea una journey end-to-end via /api/public/journeys/initiate.
    Restituisce (journey_id, project_id, account_id, email)."""
    unique_email = f"iter168_test_{int(time.time()*1000)}@example.com"
    payload = {
        "welcome": {
            "first_name":       "TestCliente",
            "email":            unique_email,
            "phone":            "0123456789",
            "country_code":     "IT",
            "dial_code":        "+39",
            "normalized_phone": "+390123456789",
        },
        "atmosphere": {
            "how_to_feel":      "rilassante",
            "primary_palette":  ["nordic_silence"],
            "light_preference": "soft_diffused",
        },
        "lifestyle": {
            "household_kind":   "family",
            "daily_rhythm":     "slow",
            "shared_moments":   ["meals", "reading"],
        },
        "consent_terms":   True,
        "consent_privacy": True,
        "tenant_slug":     "mood-demo",
    }
    r = requests.post(f"{BASE_URL}/api/public/journeys/initiate",
                      json=payload, timeout=20)
    assert r.status_code in (200, 201), f"initiate failed: {r.status_code} {r.text}"
    body = r.json()
    jid = body.get("journey_id") or body.get("design_journey_id")
    assert jid, f"no journey_id in response: {body}"
    return {
        "journey_id": jid,
        "project_id": body.get("project_id"),
        "account_id": body.get("account_id"),
        "email":      unique_email,
    }


class TestJourneyOverview:
    def test_intake_creates_journey_brief(self, fresh_journey, admin_session):
        """Dopo intake, /api/journeys/{jid}/brief deve restituire un brief
        materializzato (NON solo da auto-derive da leads)."""
        jid = fresh_journey["journey_id"]
        r = admin_session.get(f"{BASE_URL}/api/journeys/{jid}/brief")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["materialized"] is True
        brief = body["brief"]
        assert brief["journey_id"] == jid
        # closed_answers should contain the atmosphere+lifestyle we sent
        assert "atmosphere" in brief["closed_answers"]
        assert "lifestyle"  in brief["closed_answers"]

    def test_overview_full_snapshot(self, fresh_journey, admin_session):
        jid = fresh_journey["journey_id"]
        r = admin_session.get(f"{BASE_URL}/api/journeys/{jid}/overview")
        assert r.status_code == 200, r.text
        body = r.json()
        # Core sections
        assert body["journey"]["id"] == jid
        assert body["journey"]["lifecycle_state"] == "conversation_open"
        assert body["account"] is not None
        assert body["account"]["account_name"] == "TestCliente"
        # Brief
        assert body["brief"] is not None
        # Milestones
        assert "milestones_by_track" in body
        assert "main" in body["milestones_by_track"]
        assert len(body["milestones_by_track"]["main"]) == 10
        # Brief milestone is in_progress
        brief_m = next((m for m in body["milestones_by_track"]["main"]
                       if m["milestone_type"] == "brief"), None)
        assert brief_m is not None
        assert brief_m["status"] == "in_progress"
        # Artifact counts
        assert body["artifact_counts"]["moodboards"] == 0
        assert body["artifact_counts"]["proposals"] == 0

    def test_artifacts_empty_grouping(self, fresh_journey, admin_session):
        jid = fresh_journey["journey_id"]
        r = admin_session.get(f"{BASE_URL}/api/journeys/{jid}/artifacts")
        assert r.status_code == 200
        body = r.json()
        assert body["total"] == 0
        assert body["grouped_by_room_chapter"] == {}


# ════════════════════════════════════════════════════════════════════════
# §3 · LIFECYCLE patch (layer 1, relazionale)
# ════════════════════════════════════════════════════════════════════════
class TestLifecycleLayer:
    def test_patch_lifecycle_to_in_progress(self, fresh_journey, admin_session):
        jid = fresh_journey["journey_id"]
        r = admin_session.patch(
            f"{BASE_URL}/api/journeys/{jid}/lifecycle",
            json={"lifecycle_state": "in_progress",
                  "reason": "Promosso da first contact"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["changed"] is True
        assert body["journey"]["lifecycle_state"] == "in_progress"

    def test_patch_lifecycle_invalid(self, fresh_journey, admin_session):
        jid = fresh_journey["journey_id"]
        r = admin_session.patch(
            f"{BASE_URL}/api/journeys/{jid}/lifecycle",
            json={"lifecycle_state": "not_a_real_state"})
        assert r.status_code == 400

    def test_patch_lifecycle_no_change_returns_changed_false(self, fresh_journey, admin_session):
        jid = fresh_journey["journey_id"]
        # already in_progress now
        r = admin_session.patch(
            f"{BASE_URL}/api/journeys/{jid}/lifecycle",
            json={"lifecycle_state": "in_progress"})
        assert r.status_code == 200
        assert r.json()["changed"] is False


# ════════════════════════════════════════════════════════════════════════
# §4 · MILESTONE state (layer 2, operativo)
# ════════════════════════════════════════════════════════════════════════
class TestMilestoneLayer:
    def _get_milestone(self, jid, session, mtype):
        r = session.get(f"{BASE_URL}/api/journeys/{jid}/overview")
        for m in r.json()["milestones_by_track"]["main"]:
            if m["milestone_type"] == mtype:
                return m
        raise AssertionError(f"milestone {mtype} not found")

    def test_status_presented(self, fresh_journey, admin_session):
        jid = fresh_journey["journey_id"]
        m = self._get_milestone(jid, admin_session, "moodboard_direction")
        mid = m["id"]
        r = admin_session.patch(
            f"{BASE_URL}/api/journeys/{jid}/milestones/{mid}/status",
            json={"status": "presented", "note": "Prima direzione condivisa"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["changed"] is True
        assert body["milestone"]["status"] == "presented"
        assert body["milestone"]["presented_at"] is not None

    def test_skip_milestone(self, fresh_journey, admin_session):
        jid = fresh_journey["journey_id"]
        m = self._get_milestone(jid, admin_session, "concept_design")
        mid = m["id"]
        r = admin_session.post(
            f"{BASE_URL}/api/journeys/{jid}/milestones/{mid}/skip",
            json={"reason": "Cliente vuole solo materiali, no concept full"})
        assert r.status_code == 200
        # Verify
        m2 = self._get_milestone(jid, admin_session, "concept_design")
        assert m2["status"] == "skipped"
        assert m2["skipped_at"] is not None
        assert m2["skipped_reason"].startswith("Cliente vuole")

    def test_reopen_milestone(self, fresh_journey, admin_session):
        """approved → reopened (richiesta nuova revisione)."""
        jid = fresh_journey["journey_id"]
        m = self._get_milestone(jid, admin_session, "material_direction")
        mid = m["id"]
        # First: presented → approved
        admin_session.patch(
            f"{BASE_URL}/api/journeys/{jid}/milestones/{mid}/status",
            json={"status": "approved"})
        # Now reopen
        r = admin_session.post(
            f"{BASE_URL}/api/journeys/{jid}/milestones/{mid}/reopen")
        assert r.status_code == 200
        m2 = self._get_milestone(jid, admin_session, "material_direction")
        assert m2["status"] == "reopened"
        assert m2["reopened_at"] is not None

    def test_parallel_milestone(self, fresh_journey, admin_session):
        """Apre un filone parallelo 'kitchen' su moodboard_direction."""
        jid = fresh_journey["journey_id"]
        r = admin_session.post(
            f"{BASE_URL}/api/journeys/{jid}/milestones/parallel",
            json={"milestone_type": "moodboard_direction",
                  "parallel_track": "kitchen",
                  "title": "Direzione cucina"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["created"] is True
        assert body["milestone"]["parallel_track"] == "kitchen"
        assert body["milestone"]["status"] == "parallel_active"

    def test_parallel_milestone_duplicate_rejected(self, fresh_journey, admin_session):
        jid = fresh_journey["journey_id"]
        r = admin_session.post(
            f"{BASE_URL}/api/journeys/{jid}/milestones/parallel",
            json={"milestone_type": "moodboard_direction",
                  "parallel_track": "kitchen"})
        assert r.status_code == 409

    def test_parallel_milestone_in_overview(self, fresh_journey, admin_session):
        """Il parallel track 'kitchen' deve comparire in milestones_by_track."""
        jid = fresh_journey["journey_id"]
        r = admin_session.get(f"{BASE_URL}/api/journeys/{jid}/overview")
        body = r.json()
        assert "kitchen" in body["milestones_by_track"]
        assert len(body["milestones_by_track"]["kitchen"]) >= 1


# ════════════════════════════════════════════════════════════════════════
# §5 · DB schema lock verification
# ════════════════════════════════════════════════════════════════════════
class TestSchemaLock:
    """Verifica diretta su DB che la migration 107 sia applicata."""

    def test_moodboards_has_scope_columns(self):
        import psycopg2
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        cur = conn.cursor()
        cur.execute("""
            SELECT column_name, is_nullable FROM information_schema.columns
            WHERE table_name = 'moodboards'
              AND column_name IN ('scope','room_key','chapter_key',
                                   'visibility','approval_state','journey_id')
        """)
        cols = {r[0]: r[1] for r in cur.fetchall()}
        cur.close(); conn.close()
        for c in ('scope', 'room_key', 'chapter_key', 'visibility',
                  'approval_state', 'journey_id'):
            assert c in cols, f"moodboards missing {c}"
        # journey_id MUST be NOT NULL
        assert cols['journey_id'] == 'NO'
        assert cols['visibility'] == 'NO'
        assert cols['approval_state'] == 'NO'

    def test_design_journeys_account_id_not_null(self):
        import psycopg2
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        cur = conn.cursor()
        cur.execute("""
            SELECT is_nullable FROM information_schema.columns
            WHERE table_name = 'design_journeys' AND column_name = 'account_id'
        """)
        r = cur.fetchone()
        cur.close(); conn.close()
        assert r[0] == 'NO'

    def test_milestone_elastic_columns(self):
        import psycopg2
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        cur = conn.cursor()
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'journey_milestones'
              AND column_name IN ('is_applicable','skipped_at','skipped_reason',
                                   'reopened_at','parallel_track')
        """)
        cols = {r[0] for r in cur.fetchall()}
        cur.close(); conn.close()
        assert cols == {'is_applicable', 'skipped_at', 'skipped_reason',
                        'reopened_at', 'parallel_track'}

    def test_journey_overview_view_exists(self):
        import psycopg2
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        cur = conn.cursor()
        cur.execute("SELECT viewname FROM pg_views WHERE viewname = 'journey_overview'")
        row = cur.fetchone()
        cur.close(); conn.close()
        assert row is not None

    def test_catalog_tables_seeded(self):
        import psycopg2
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM moodboard_rooms WHERE is_active = TRUE")
        rooms = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM moodboard_chapters WHERE is_active = TRUE")
        chs = cur.fetchone()[0]
        cur.close(); conn.close()
        assert rooms >= 16
        assert chs >= 9

    def test_trigger_function_exists(self):
        import psycopg2
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        cur = conn.cursor()
        cur.execute("""
            SELECT proname FROM pg_proc
            WHERE proname = 'sync_leads_progression_from_account'
        """)
        row = cur.fetchone()
        cur.execute("""
            SELECT tgname FROM pg_trigger
            WHERE tgname = 'trg_sync_leads_progression'
        """)
        tg = cur.fetchone()
        cur.close(); conn.close()
        assert row is not None
        assert tg is not None


# ════════════════════════════════════════════════════════════════════════
# §6 · Phase 2 · Resolver endpoints (canonical URL plumbing)
# ════════════════════════════════════════════════════════════════════════
class TestResolverEndpoints:
    def test_mine_unauthenticated_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/journeys/mine")
        assert r.status_code in (401, 403)

    def test_resolve_unauthenticated_returns_401(self):
        r = requests.get(
            f"{BASE_URL}/api/journeys/resolve"
            "?project_id=i18n-recovery-1")
        assert r.status_code in (401, 403)

    def test_mine_for_admin_returns_404_no_journey(self, admin_session):
        """Admin user is not a client → 'Nessuna journey associata'."""
        r = admin_session.get(f"{BASE_URL}/api/journeys/mine")
        assert r.status_code == 404

    def test_resolve_by_project_id_links(self, fresh_journey, admin_session):
        """Lookup project_id from a freshly-created journey resolves to its jid."""
        jid = fresh_journey["journey_id"]
        # Fetch project_id via overview (intake response doesn't expose it)
        ov = admin_session.get(f"{BASE_URL}/api/journeys/{jid}/overview").json()
        pid = ov["journey"]["project_id"]
        assert pid, "no project_id in overview"
        r = admin_session.get(
            f"{BASE_URL}/api/journeys/resolve?project_id={pid}")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["linked"] is True
        assert body["journey_id"] == jid

    def test_resolve_excludes_abandoned(self, admin_session):
        """Sentinel project_id (used by backfill archivio) must NOT be returned
        in /resolve, since archivio journeys are lifecycle_state=abandoned."""
        r = admin_session.get(
            f"{BASE_URL}/api/journeys/resolve"
            "?project_id=i18n-recovery-1")
        assert r.status_code == 200
        body = r.json()
        assert body["linked"] is False
        assert body["journey_id"] is None

    def test_resolve_unknown_project_returns_linked_false(self, admin_session):
        random_pid = str(uuid.uuid4())
        r = admin_session.get(
            f"{BASE_URL}/api/journeys/resolve?project_id={random_pid}")
        assert r.status_code == 200
        assert r.json()["linked"] is False

    def test_resolve_missing_params_returns_400(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/journeys/resolve")
        assert r.status_code == 400
