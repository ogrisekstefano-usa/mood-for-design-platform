"""Iter102 · Sprint G.2 — "Inizia il tuo Design Journey™" validation.

Backend (6 tests) + Frontend static (4 tests).
"""
import os, random, string
from pathlib import Path
import pytest, requests, psycopg2
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO / 'backend' / '.env')
load_dotenv(REPO / 'frontend' / '.env')

API    = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
DB_URL = os.environ['DATABASE_URL']

BEGIN_JSX   = REPO / 'frontend' / 'src' / 'pages' / 'site' / 'BeginJourneyPage.jsx'
WELCOME_JSX = REPO / 'frontend' / 'src' / 'pages' / 'site' / 'JourneyWelcomePage.jsx'
APP_JS      = REPO / 'frontend' / 'src' / 'App.js'


def _email():
    return "g2." + "".join(random.choices(string.ascii_lowercase, k=10)) + "@example.com"


def _initiate(payload=None):
    body = payload or {
        "welcome": {"first_name": "Maria", "email": _email()},
        "atmosphere": {
            "space_kinds": ["home"],
            "how_to_feel": "silenziosa, accolta, materica",
            "references":  "Tadao Ando, una sera d'autunno",
        },
        "lifestyle": {
            "guests":     "sometimes",
            "materials":  ["legno", "pietra", "lino"],
            "ambiance":   "warm_enveloping",
        },
    }
    return requests.post(f"{API}/api/public/journeys/initiate", json=body, timeout=20)


# ── BACKEND ───────────────────────────────────────────────────────
class TestInitiate:
    def test_full_payload_returns_welcome(self):
        r = _initiate()
        assert r.status_code == 201, r.text
        b = r.json()
        assert b["journey_id"]
        assert b["welcome_token"] and len(b["welcome_token"]) >= 16
        assert b["welcome_url"].startswith("/journey/welcome/")
        assert "Design Journey" in b["message"]

    def test_minimal_payload_no_atmosphere(self):
        r = _initiate({"welcome": {"first_name": "Anna", "email": _email()}})
        assert r.status_code == 201, r.text

    def test_rejects_missing_email(self):
        r = _initiate({"welcome": {"first_name": "Anna"}})
        assert r.status_code == 422

    def test_rejects_missing_first_name(self):
        r = _initiate({"welcome": {"email": _email()}})
        assert r.status_code == 422

    def test_creates_canonical_entities_in_db(self):
        r = _initiate()
        b = r.json()
        with psycopg2.connect(DB_URL) as conn, conn.cursor() as cur:
            cur.execute("SELECT account_id, lifecycle_state, welcome_token, project_id "
                        "FROM design_journeys WHERE id=%s", (b["journey_id"],))
            account_id, lifecycle, token, project_id = cur.fetchone()
            assert account_id is not None
            assert lifecycle == "conversation_open"
            assert token == b["welcome_token"]

            # Account / Contact
            cur.execute("SELECT lifecycle_stage, source FROM accounts WHERE id=%s", (account_id,))
            stage, src = cur.fetchone()
            assert stage == "conversation_open"
            assert src   == "begin_journey_ritual"

            cur.execute("SELECT COUNT(*) FROM contacts WHERE account_id=%s", (account_id,))
            assert cur.fetchone()[0] >= 1

            # Project
            cur.execute("SELECT status, title FROM projects WHERE id=%s", (project_id,))
            status, title = cur.fetchone()
            assert status == "new"
            assert "Conversazione di" in title

            # 10 milestones
            cur.execute("SELECT COUNT(*) FROM journey_milestones WHERE journey_id=%s",
                        (b["journey_id"],))
            assert cur.fetchone()[0] == 10

            # Brief in_progress
            cur.execute("SELECT status FROM journey_milestones "
                        "WHERE journey_id=%s AND milestone_type='brief'", (b["journey_id"],))
            assert cur.fetchone()[0] == "in_progress"

            # Initial chapter
            cur.execute("""SELECT COUNT(*) FROM milestone_versions v
                           JOIN journey_milestones m ON m.id = v.milestone_id
                           WHERE m.journey_id=%s AND v.chapter_kind='initial_direction'""",
                        (b["journey_id"],))
            assert cur.fetchone()[0] == 1

            # Timeline canonical events
            cur.execute("""SELECT event_canon FROM journey_timeline_events
                           WHERE journey_id=%s ORDER BY created_at""",
                        (b["journey_id"],))
            canons = [r[0] for r in cur.fetchall()]
            assert "journey_created" in canons
            assert "brief_started"   in canons

    def test_welcome_endpoint_returns_public_safe_payload(self):
        b = _initiate().json()
        r = requests.get(f"{API}/api/public/journeys/welcome/{b['welcome_token']}", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["first_name"]
        assert d["journey"]["lifecycle_state"] == "conversation_open"
        assert d["journey"]["milestones_count"] == 10
        assert d["journey"]["current_step"] == "Brief Cliente"
        chap = d["journey"]["first_chapter"]
        assert chap and chap["kind_label"] == "Direzione iniziale"
        assert "Design Journey" in (chap["rationale"] or "")
        # No PII leak: no tenant_id, no project_id at top level
        assert "tenant_id" not in d
        assert "account_id" not in d

    def test_welcome_invalid_token_returns_404(self):
        r = requests.get(f"{API}/api/public/journeys/welcome/not_a_valid_token_xyz", timeout=20)
        assert r.status_code == 404


# ── FRONTEND STATIC ───────────────────────────────────────────────
class TestFrontendStatic:
    def test_begin_journey_has_three_steps_and_italian_eyebrows(self):
        src = BEGIN_JSX.read_text()
        for snippet in [
            "Passo Primo · Atmosfera",
            "Passo Secondo · Come Vivi",
            "Passo Ultimo · Entriamo in Contatto",
            "Quale atmosfera stai cercando?",
            "Come vivi gli spazi?",
            "Da dove cominciamo?",
            "Inizia il tuo Design Journey™",
            "Nessun preventivo, nessuna pressione",
        ]:
            assert snippet in src, f"Missing italian snippet: {snippet}"

    def test_begin_journey_has_all_required_testids(self):
        src = BEGIN_JSX.read_text()
        for testid in [
            'data-testid="begin-journey-page"',
            'data-testid="bj-step1-title"',
            'data-testid="bj-step2-title"',
            'data-testid="bj-step3-title"',
            'data-testid="bj-first-name"',
            'data-testid="bj-email"',
            'data-testid="bj-submit"',
        ]:
            assert testid in src, f"Missing testid: {testid}"

    def test_welcome_page_has_italian_hero_copy(self):
        src = WELCOME_JSX.read_text()
        for snippet in [
            "Il tuo Design Journey™ · è iniziato",
            "Benvenut",  # gender-aware suffix
            "Direzione iniziale",
            "Brief Cliente",
            "Salva questo link",
        ]:
            assert snippet in src, f"Missing italian welcome copy: {snippet}"

    def test_no_forbidden_lexicon_in_welcome_surfaces(self):
        """Direction Lock guard — neither page may use commercial funnel
        language. Two exceptions are explicitly allowed because they
        DECONSTRUCT the commercial frame: "non il tuo budget" (Step 2 sub)
        and "Nessun preventivo, nessuna pressione" (Step 3 microcopy)."""
        forbidden = [
            "quote", "estimate", "pricing",
            "lead", "funnel", "pipeline", "deal",
            "consulenza gratuita", "demo gratuita",
            "get a quote", "get started for free",
            "sign up", "request a demo",
            "step 1 of 3", "step 2 of 3", "step 3 of 3",
        ]
        deconstructing_allowed = [
            "non il tuo budget",
            "nessun preventivo, nessuna pressione",
        ]
        for path in (BEGIN_JSX, WELCOME_JSX):
            lower = path.read_text().lower()
            scrubbed = lower
            for a in deconstructing_allowed:
                scrubbed = scrubbed.replace(a, "")
            # naked 'budget' and 'preventivo' must NOT remain after scrubbing
            assert "budget"    not in scrubbed, f"naked 'budget' in {path.name}"
            assert "preventivo" not in scrubbed, f"naked 'preventivo' in {path.name}"
            for bad in forbidden:
                assert bad not in scrubbed, f"forbidden '{bad}' in {path.name}"

    def test_app_js_mounts_new_public_routes(self):
        app = APP_JS.read_text()
        assert "/begin-journey" in app
        assert "/journey/welcome/:token" in app
        assert "BeginJourneyPage"   in app
        assert "JourneyWelcomePage" in app
