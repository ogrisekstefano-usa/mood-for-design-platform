"""Iter103 · Sprint G.3 — Account = Constellation of Journeys™ validation.

Backend (6 tests) + Frontend static (5 tests).
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
CONSTELLATION_JSX = REPO / 'frontend' / 'src' / 'pages' / 'crm' / 'AccountConstellation.jsx'
CONSTELLATION_CSS = REPO / 'frontend' / 'src' / 'pages' / 'crm' / 'constellation.css'
ACCOUNT_PAGE_JSX  = REPO / 'frontend' / 'src' / 'pages' / 'crm' / 'AccountDetailPage.jsx'

LOGIN = "demo@moodfordesign.com"
PWD   = "Blueprint2024!"


@pytest.fixture(scope='module')
def token():
    r = requests.post(f"{API}/api/auth/login",
                      json={"email": LOGIN, "password": PWD}, timeout=20)
    return r.json()["session"]["access_token"]


def H(t): return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope='module')
def test_account_id():
    """Create a fresh account+journey in the demo tenant via the G.2 endpoint."""
    name = "G3_" + "".join(random.choices(string.ascii_uppercase, k=6))
    payload = {
        "tenant_slug": "mood-demo-studio-81a09e",
        "welcome":    {"first_name": name, "email": f"g3.{name.lower()}@example.com"},
        "atmosphere": {"how_to_feel": "atmosfera contemplativa",
                       "references":  "Tadao Ando · Yoshio Taniguchi"},
        "lifestyle":  {"ambiance": "tactile_sensory",
                       "materials": ["pietra", "legno", "lino"],
                       "guests":   "sometimes"},
    }
    r = requests.post(f"{API}/api/public/journeys/initiate", json=payload, timeout=20)
    jid = r.json()["journey_id"]
    with psycopg2.connect(DB_URL) as conn, conn.cursor() as cur:
        cur.execute("SELECT account_id FROM design_journeys WHERE id=%s", (jid,))
        return cur.fetchone()[0]


# ── BACKEND ───────────────────────────────────────────────────────
class TestConstellationEndpoint:
    def test_constellation_returns_six_sections(self, token, test_account_id):
        r = requests.get(f"{API}/api/relationships/accounts/{test_account_id}/constellation",
                         headers=H(token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("hero","active_journeys","people","memory","shared_artifacts","insights","lexicon"):
            assert k in d, f"missing section: {k}"

    def test_hero_has_relationship_state_not_pipeline_stage(self, token, test_account_id):
        r = requests.get(f"{API}/api/relationships/accounts/{test_account_id}/constellation",
                         headers=H(token), timeout=20).json()
        hero = r["hero"]
        assert hero["relationship_state"] in (
            "growing","active","trusted","dormant","strategic","returning")
        # NO sales pipeline taxonomy
        assert hero["relationship_state"] not in (
            "lead","prospect","qualified","negotiation","closed_won","closed_lost")

    def test_active_journeys_shape(self, token, test_account_id):
        r = requests.get(f"{API}/api/relationships/accounts/{test_account_id}/constellation",
                         headers=H(token), timeout=20).json()
        js = r["active_journeys"]
        assert len(js) >= 1
        j = js[0]
        for k in ("id","project_id","lifecycle_state","current_milestone","progress",
                  "milestones_total","milestones_done","last_event"):
            assert k in j
        assert j["current_milestone"]["label"] == "Brief Cliente™"
        assert j["lifecycle_state"] == "conversation_open"

    def test_lexicon_uses_italian_editorial_labels(self, token, test_account_id):
        r = requests.get(f"{API}/api/relationships/accounts/{test_account_id}/constellation",
                         headers=H(token), timeout=20).json()
        lx = r["lexicon"]
        assert lx["relationship_state_label"]["growing"]   == "In crescita"
        assert lx["relationship_state_label"]["trusted"]   == "Di fiducia"
        assert lx["lifecycle_label"]["conversation_open"]  == "Conversazione aperta"
        assert lx["lifecycle_label"]["in_progress"]        == "Viaggio in corso"

    def test_people_includes_primary_contact(self, token, test_account_id):
        r = requests.get(f"{API}/api/relationships/accounts/{test_account_id}/constellation",
                         headers=H(token), timeout=20).json()
        people = r["people"]
        assert any(p["primary"] for p in people)

    def test_memory_aggregates_materials_from_journey(self, token, test_account_id):
        r = requests.get(f"{API}/api/relationships/accounts/{test_account_id}/constellation",
                         headers=H(token), timeout=20).json()
        mat = r["memory"]["preferred_materials"]
        assert any("pietra" in m.lower() for m in mat)
        # rationales surface the initial_direction chapter
        rats = r["memory"]["rationales"]
        assert any("Direzione iniziale" in (rt.get("title") or "") for rt in rats)


# ── FRONTEND STATIC ───────────────────────────────────────────────
class TestFrontendStatic:
    def test_constellation_component_has_six_editorial_sections(self):
        src = CONSTELLATION_JSX.read_text()
        for snippet in [
            "I Journey condivisi",
            "Le persone della relazione",
            "Memoria progettuale",
            "Ciò che è già stato detto",
            "Artefatti condivisi",
            "Ciò che è stato presentato",
            "Segnali del viaggio",
            "Momenti in attesa",
            "Sezione dominante",
            "Compagni di viaggio",
        ]:
            assert snippet in src, f"missing italian section copy: {snippet}"

    def test_constellation_uses_relationship_state_not_pipeline(self):
        src = (CONSTELLATION_JSX.read_text() + CONSTELLATION_CSS.read_text()).lower()
        for forbidden in [
            "pipeline", "conversion", "lead score", "close rate", "win rate",
            "sales probability", "deal stage", "prospect",
        ]:
            assert forbidden not in src, f"forbidden CRM term '{forbidden}'"

    def test_constellation_has_testids_for_all_sections(self):
        src = CONSTELLATION_JSX.read_text()
        for tid in [
            'data-testid="account-constellation"',
            'data-testid="ac-hero"',
            'data-testid="ac-hero-name"',
            'data-testid="ac-journeys-section"',
            'data-testid="ac-people-section"',
            'data-testid="ac-memory-section"',
            'data-testid="ac-artifacts-section"',
            'data-testid="ac-insights-section"',
        ]:
            assert tid in src, f"missing testid: {tid}"

    def test_account_detail_page_mounts_constellation(self):
        src = ACCOUNT_PAGE_JSX.read_text()
        assert "AccountConstellation" in src
        assert "<AccountConstellation" in src
        # legacy stage strip suppressed
        assert "rl-stages--legacy" in src

    def test_no_funnel_lexicon_in_constellation(self):
        """Direction Lock guard for G.3 surfaces."""
        text = CONSTELLATION_JSX.read_text().lower()
        for bad in [
            "salesforce", "hubspot", "pipedrive",
            "convert", "qualify", "nurture campaign",
            "close the deal", "marketing funnel",
            "lead score", "sales probability",
        ]:
            assert bad not in text, f"forbidden term '{bad}' in constellation"
