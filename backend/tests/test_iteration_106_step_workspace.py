"""Iter106 · Sprint G.6 — Step-Anchored Artifact Pages™ validation.

Backend (4) + Frontend static (8).

Direction Lock G.6:
  · Gli artifact NON sono moduli standalone.
  · Ogni artifact è una manifestazione di uno step del Design Journey™.
  · Il contesto precede l'artifact.
  · NO grid CRUD. NO file manager.
"""
import os
from pathlib import Path
import pytest, requests
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO / 'backend' / '.env')
load_dotenv(REPO / 'frontend' / '.env')

API = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

PAGE       = REPO / 'frontend' / 'src' / 'pages' / 'journey' / 'StepWorkspacePage.jsx'
HEADER     = REPO / 'frontend' / 'src' / 'components' / 'journey' / 'StepContextHeader.jsx'
VSTACK     = REPO / 'frontend' / 'src' / 'components' / 'journey' / 'VersionStack.jsx'
CIL        = REPO / 'frontend' / 'src' / 'components' / 'journey' / 'ClientInteractionLayer.jsx'
MOOD_WS    = REPO / 'frontend' / 'src' / 'components' / 'journey' / 'MoodboardDirectionWorkspace.jsx'
MAT_WS     = REPO / 'frontend' / 'src' / 'components' / 'journey' / 'MaterialDirectionWorkspace.jsx'
BANNER     = REPO / 'frontend' / 'src' / 'components' / 'journey' / 'ArchiveBanner.jsx'
APP_JS     = REPO / 'frontend' / 'src' / 'App.js'
DJ_TAB     = REPO / 'frontend' / 'src' / 'pages' / 'workspace' / 'DesignJourneyTab.jsx'
MB_PAGE    = REPO / 'frontend' / 'src' / 'pages' / 'moodboards' / 'MoodboardsPage.jsx'
MAT_PAGE   = REPO / 'frontend' / 'src' / 'pages' / 'library' / 'MaterialsPage.jsx'
PROP_PAGE  = REPO / 'frontend' / 'src' / 'pages' / 'workspace' / 'ProposalsPage.jsx'


@pytest.fixture(scope='module')
def token():
    r = requests.post(f"{API}/api/auth/login",
                      json={"email": "demo@moodfordesign.com",
                            "password": "Blueprint2024!"}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["session"]["access_token"]


def H(t): return {"Authorization": f"Bearer {t}"}


def _pick_project(t):
    r = requests.get(f"{API}/api/dashboard/pulse",
                     headers=H(t), timeout=20).json()
    if not r.get("active_journeys"):
        pytest.skip("no active journeys on demo tenant")
    return r["active_journeys"][0]["project_id"]


# ── BACKEND ──────────────────────────────────────────────────────
class TestStepWorkspaceEndpoint:
    def test_step_workspace_returns_full_context(self, token):
        pid = _pick_project(token)
        r = requests.get(
            f"{API}/api/journey/projects/{pid}/steps/moodboard_direction",
            headers=H(token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        ctx = d["context"]
        for k in ("project", "journey", "step", "prev_step", "next_step",
                  "progress", "participants"):
            assert k in ctx, f"missing context key {k}"
        # Journey lifecycle label must be italian editorial
        assert ctx["journey"]["lifecycle_label"] in {
            "Conversazione aperta", "Viaggio in corso", "Direzione presentata",
            "In ascolto", "In pausa", "Direzione approvata",
            "Capitolo chiuso", "Edizione culturale", "Viaggio sospeso",
        }

    def test_step_workspace_supports_each_canonical_type(self, token):
        pid = _pick_project(token)
        for mt in ("brief", "moodboard_direction", "material_direction",
                   "concept_design", "technical_package",
                   "final_presentation", "certified_closure"):
            r = requests.get(
                f"{API}/api/journey/projects/{pid}/steps/{mt}",
                headers=H(token), timeout=20)
            assert r.status_code == 200, f"{mt}: {r.text}"
            assert r.json()["context"]["step"]["milestone_type"] == mt

    def test_step_workspace_progress_uses_chapter_counting(self, token):
        pid = _pick_project(token)
        r = requests.get(
            f"{API}/api/journey/projects/{pid}/steps/moodboard_direction",
            headers=H(token), timeout=20)
        p = r.json()["context"]["progress"]
        # NO percentages — only counted milestones
        for k in ("current_step_index", "total_steps", "completed_steps"):
            assert k in p
        assert p["total_steps"] >= 10  # ten canonical chapters

    def test_step_workspace_404_on_unknown_type(self, token):
        pid = _pick_project(token)
        r = requests.get(
            f"{API}/api/journey/projects/{pid}/steps/i_do_not_exist",
            headers=H(token), timeout=20)
        assert r.status_code == 404


# ── FRONTEND STATIC ──────────────────────────────────────────────
class TestStepWorkspacePage:
    def test_page_uses_three_canonical_layers(self):
        src = PAGE.read_text()
        for token_ in ("StepContextHeader", "ClientInteractionLayer",
                       "VersionStack", "MoodboardDirectionWorkspace",
                       "MaterialDirectionWorkspace"):
            assert token_ in src, f"missing layer import: {token_}"

    def test_page_route_in_app_js(self):
        src = APP_JS.read_text()
        assert 'path="/journey/:projectId/step/:milestoneType"' in src
        assert "StepWorkspacePage" in src

    def test_journey_tab_routes_step_workspace_types(self):
        src = DJ_TAB.read_text()
        # G.6: moodboard_direction & material_direction MUST route to the
        # step workspace, NOT the legacy global pages.
        assert "STEP_WORKSPACE_TYPES" in src
        assert "moodboard_direction" in src
        assert "material_direction" in src
        assert "/journey/${projectId}/step/" in src


class TestEditorialVocabulary:
    """Direction Lock: no SaaS/PM/CMS terminology in the workspace layers."""

    FORBIDDEN = [
        # SaaS / PM / CMS — explicit names only, no generic substrings
        "kanban", "sprint board", "todo list", "task manager",
        " ticket ", "tickets:", "create ticket",
        "asset manager", "dam library", "upload wall",
        # explicit literal version tokens (never in copy)
        ">V1<", ">V2<", ">V3<", "version 1.", "version 2.",
        "approve version", "reject version", "submit version",
        # commercial CTAs (verbatim)
        "get started", "create your first", "request a demo",
        "buy now", "checkout", "add to cart",
    ]

    def _scan(self, path):
        return path.read_text().lower()

    def test_step_workspace_page_clean(self):
        for path in (PAGE, HEADER, VSTACK, CIL, MOOD_WS, MAT_WS, BANNER):
            text = self._scan(path)
            for bad in self.FORBIDDEN:
                assert bad not in text, f"forbidden '{bad}' in {path.name}"


class TestContextHeader:
    def test_header_has_breadcrumb_and_prev_next(self):
        src = HEADER.read_text()
        assert 'data-testid="sw-context-header"' in src
        assert 'data-testid="sw-context-title"' in src
        assert 'data-testid="sw-context-progress"' in src
        # Editorial nav chips
        assert "Capitolo precedente" in src
        assert "Capitolo seguente" in src


class TestVersionStack:
    def test_uses_chapter_labels_not_v1_v2(self):
        src = VSTACK.read_text()
        # Must surface chapter_label from the artifact, not hardcode V1/V2
        assert "chapter_label" in src
        # Italian-only state labels
        for label in ("Bozza interna", "Condivisa con il cliente",
                      "Approvata", "Cliente ha chiesto una revisione"):
            assert label in src, f"missing italian state label: {label}"
        # Forbidden literal version tokens
        for bad in (' V1 ', ' V2 ', '"V1"', '"V2"', ">V1<", ">V2<"):
            assert bad not in src


class TestClientInteractionLayer:
    def test_four_canonical_gestures(self):
        src = CIL.read_text()
        for gesture in ("sw-cil-leave-voice", "sw-cil-approve",
                        "sw-cil-revise", "sw-cil-alternative"):
            assert f'data-testid="{gesture}"' in src
        # Italian editorial copy
        for phrase in ("Lascia una voce", "Approva la direzione",
                       "Chiedi una revisione", "Carica una alternativa"):
            assert phrase in src


class TestArchiveBanner:
    def test_global_pages_carry_archive_banner(self):
        for path in (MB_PAGE, MAT_PAGE, PROP_PAGE):
            src = path.read_text()
            assert "ArchiveBanner" in src, f"{path.name} missing ArchiveBanner"
            assert "Archivio trasversale" in src, f"{path.name} missing editorial copy"

    def test_banner_uses_journey_first_copy(self):
        src = BANNER.read_text()
        # No commercial / SaaS framing in the banner copy.
        for bad in ("Export PDF", "Export CSV", "Upload File",
                    "Download report", "file manager", "asset manager"):
            assert bad.lower() not in src.lower()


class TestWorkspaceBodies:
    def test_moodboard_workspace_uses_editorial_phrasing(self):
        src = MOOD_WS.read_text()
        for phrase in ("Direzione editoriale",
                       "L'orizzonte di questo capitolo",
                       "Capitoli moodboard"):
            assert phrase in src

    def test_material_workspace_groups_into_decisions(self):
        src = MAT_WS.read_text()
        assert "La materia scelta" in src
        assert "Materie ancora in ascolto" in src
        assert "Materie scartate" in src


class TestBackendRouterRegistered:
    def test_router_listed_in_server(self):
        src = (REPO / 'backend' / 'server.py').read_text()
        assert "journey_step_workspace" in src
        assert "journey_step_workspace.router" in src
