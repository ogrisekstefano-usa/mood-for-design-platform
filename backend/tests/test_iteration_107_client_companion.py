"""Iter107 · Sprint G.7 — Client Portal · Journey Companion Experience™.

Backend (5) + Frontend static (12) + Direction Lock guards.

Direction Lock G.7:
  · Il cliente vive il proprio Journey, non gestisce task.
  · NO task/ticket/file/approval queue/upload/CRM/PM language.
  · 7 sezioni canoniche: My Design Journeys™, Active Chapter™,
    Shared Directions™, Conversations™, Evolution Timeline™,
    Materials & Atmospheres™, Memory & Archive™.
"""
import os
from pathlib import Path
import pytest, requests
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO / 'backend' / '.env')
load_dotenv(REPO / 'frontend' / '.env')

API = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

CLIENT_PORTAL = REPO / 'backend' / 'routers' / 'client_portal.py'
SIDEBAR       = REPO / 'frontend' / 'src' / 'components' / 'client' / 'ClientSidebar.jsx'
INDEX_PAGE    = REPO / 'frontend' / 'src' / 'pages' / 'client' / 'ClientJourneysIndexPage.jsx'
COMPANION     = REPO / 'frontend' / 'src' / 'pages' / 'client' / 'ClientCompanionPage.jsx'
APP_JS        = REPO / 'frontend' / 'src' / 'App.js'


@pytest.fixture(scope='module')
def token():
    r = requests.post(f"{API}/api/auth/login",
                      json={"email": "demo@moodfordesign.com",
                            "password": "Blueprint2024!"}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["session"]["access_token"]


def H(t): return {"Authorization": f"Bearer {t}"}


# ── BACKEND ──────────────────────────────────────────────────────
class TestClientJourneysEndpoint:
    def test_client_journeys_returns_list_shape(self, token):
        r = requests.get(f"{API}/api/client/journeys", headers=H(token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "zero_data" in d
        assert isinstance(d.get("journeys"), list)

    def test_client_journey_companion_shape(self, token):
        # Pick a journey from the pulse (super_admin can see all journeys)
        r0 = requests.get(f"{API}/api/dashboard/pulse",
                          headers=H(token), timeout=20).json()
        if not r0.get("active_journeys"):
            pytest.skip("no active journeys on demo tenant")
        jid = r0["active_journeys"][0]["journey_id"]
        r = requests.get(f"{API}/api/client/journeys/{jid}/companion",
                         headers=H(token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("header", "active_chapter", "shared_directions",
                  "evolution_timeline", "materials_atmospheres",
                  "memory_archive", "conversations"):
            assert k in d, f"missing companion section: {k}"
        # Italian editorial lifecycle label
        assert d["header"]["lifecycle_label"] in {
            "La conversazione è iniziata",
            "Il viaggio è in corso",
            "Nuove direzioni condivise",
            "In ascolto del tuo riscontro",
            "In pausa",
            "Direzione approvata",
            "Journey completato",
            "Edizione culturale",
            "Viaggio sospeso",
        }

    def test_client_companion_404_on_unknown_journey(self, token):
        r = requests.get(
            f"{API}/api/client/journeys/00000000-0000-0000-0000-000000000000/companion",
            headers=H(token), timeout=20)
        assert r.status_code == 404

    def test_client_companion_active_chapter_uses_italian_status(self, token):
        r0 = requests.get(f"{API}/api/dashboard/pulse",
                          headers=H(token), timeout=20).json()
        if not r0.get("active_journeys"):
            pytest.skip("no active journeys")
        jid = r0["active_journeys"][0]["journey_id"]
        d = requests.get(f"{API}/api/client/journeys/{jid}/companion",
                         headers=H(token), timeout=20).json()
        ac = d.get("active_chapter")
        if ac:
            assert ac["status_label"] in {
                "Capitolo in attesa", "Capitolo in lavorazione",
                "Capitolo condiviso con te", "In ascolto del tuo riscontro",
                "Approvato in parte", "Capitolo approvato", "Capitolo chiuso",
            }

    def test_router_endpoints_registered(self):
        src = CLIENT_PORTAL.read_text()
        assert '@router.get("/journeys")' in src
        assert '@router.get("/journeys/{journey_id}/companion")' in src


# ── FRONTEND STATIC ──────────────────────────────────────────────
class TestSidebarJourneyFirst:
    def test_sidebar_has_seven_companion_sections(self):
        src = SIDEBAR.read_text()
        for label in (
            "I miei Journey",
            "Capitolo attivo",
            "Direzioni condivise",
            "Conversazioni",
            "Evolution Timeline",
            "Materia & Atmosfere",
            "Memoria & Archivio",
        ):
            assert label in src, f"missing section in sidebar: {label}"

    def test_sidebar_no_saas_pm_jargon(self):
        src = SIDEBAR.read_text().lower()
        for bad in ("approvazioni", "file condivisi", "ticket",
                    "task", "pipeline", "approval queue", "upload",
                    "kanban", "deals"):
            assert bad not in src, f"forbidden term in sidebar: {bad}"

    def test_sidebar_invites_conversation_not_support(self):
        src = SIDEBAR.read_text()
        # No "Hai bisogno di aiuto?" support framing — replaced with relational
        assert "Hai bisogno di aiuto" not in src
        assert "Vuoi raccontarci qualcosa" in src


class TestJourneysIndexPage:
    def test_index_uses_journey_first_copy(self):
        src = INDEX_PAGE.read_text()
        for phrase in (
            "My Design Journeys",
            "I tuoi percorsi progettuali",
            "Il tuo Journey sta per iniziare",  # zero-data
            "Tutti i tuoi Journey",
        ):
            assert phrase in src, f"missing index copy: {phrase}"

    def test_index_renders_lifecycle_pill_and_studio(self):
        src = INDEX_PAGE.read_text()
        # The card surfaces studio_name + lifecycle_label
        assert "studio_name" in src
        assert "lifecycle_label" in src
        assert "latest_evolution" in src


class TestCompanionPageSections:
    def test_companion_has_all_seven_anchored_sections(self):
        src = COMPANION.read_text()
        for anchor in ('id="capitolo"', 'id="direzioni"',
                       'id="conversazioni"', 'id="evoluzione"',
                       'id="materia"', 'id="memoria"'):
            assert anchor in src, f"missing anchor: {anchor}"

    def test_companion_has_required_testids(self):
        src = COMPANION.read_text()
        # cj-hero / cj-hero-title / page wrapper come from explicit data-testid
        for tid in ('data-testid="client-companion-page"',
                    'data-testid="cj-hero"',
                    'data-testid="cj-hero-title"'):
            assert tid in src, f"missing literal testid: {tid}"
        # Section testid values come through the Section helper (data-testid={testid})
        for val in ('"cj-section-capitolo"', '"cj-section-direzioni"',
                    '"cj-section-conversazioni"', '"cj-section-evoluzione"',
                    '"cj-section-materia"', '"cj-section-memoria"'):
            assert val in src, f"missing section testid value: {val}"

    def test_companion_uses_editorial_active_chapter_copy(self):
        src = COMPANION.read_text()
        # Active chapter eyebrow uses both italian + branded ™
        assert "Capitolo attivo · Active Chapter" in src
        assert "Direzioni condivise · Shared Directions" in src
        assert "Memory & Archive" in src

    def test_companion_empty_states_are_editorial(self):
        src = COMPANION.read_text()
        for phrase in (
            "Il prossimo capitolo verrà condiviso dal tuo studio",
            "Il tuo Journey è appena iniziato",
            "La conversazione attende",
            "La palette tattile sta per prendere forma",
            "L'archivio del Journey è ancora vuoto",
        ):
            assert phrase in src, f"missing editorial empty state: {phrase}"


class TestRouteWiring:
    def test_app_js_mounts_journey_first_routes(self):
        src = APP_JS.read_text()
        assert 'path="/client" element={<ClientJourneysIndexPage />}' in src
        assert 'path="/client/journey/:journeyId" element={<ClientCompanionPage />}' in src

    def test_legacy_routes_redirect_to_companion(self):
        src = APP_JS.read_text()
        assert 'path="/client/project" element={<Navigate to="/client" replace />}' in src
        assert 'path="/client/moodboards" element={<Navigate to="/client" replace />}' in src
        assert 'path="/client/timeline" element={<Navigate to="/client#evoluzione" replace />}' in src
        assert 'path="/client/approvals" element={<Navigate to="/client" replace />}' in src
        assert 'path="/client/files" element={<Navigate to="/client#direzioni" replace />}' in src


# ── DIRECTION LOCK GUARDS (cross-file) ───────────────────────────
class TestDirectionLockClientPortal:
    """Strict scan on the G.7 client surface.

    The legacy stub pages still mention SaaS terms; those routes are
    redirected. The guard scans only the NEW surface plus the sidebar.
    """

    FORBIDDEN = [
        "Get started", "Create your first", "Request a demo",
        "approval queue", "approval queues", "Upload File",
        "Tasks pending", "ticket status", "Add to cart",
        " kanban ", "kanban>", "sprint board", "task manager",
        "Pending approval", "File upload",
    ]

    def test_no_saas_jargon(self):
        for path in (SIDEBAR, INDEX_PAGE, COMPANION):
            text = path.read_text()
            for bad in self.FORBIDDEN:
                assert bad not in text, f"forbidden '{bad}' in {path.name}"

    def test_companion_uses_italian_editorial_vocab(self):
        src = COMPANION.read_text()
        for required in ("capitolo", "direzione", "evoluzione",
                         "atmosfera", "percorso", "voce", "Journey"):
            assert required.lower() in src.lower(), f"missing core word: {required}"
