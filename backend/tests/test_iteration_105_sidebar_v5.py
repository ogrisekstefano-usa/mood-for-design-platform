"""Iter105 · Sprint G.5 — Sidebar v5 (Journey-first IA) validation.

Static tests. The sidebar is a purely visual/contextual layer; behaviour is
tested via the underlying `useActiveJourneys` hook hitting `/api/dashboard/pulse`
(already covered by iter104). Here we lock the Information Architecture and
the editorial Italian vocabulary.
"""
import os
from pathlib import Path
import pytest, requests
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO / 'backend' / '.env')
load_dotenv(REPO / 'frontend' / '.env')

API = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SIDEBAR  = REPO / 'frontend' / 'src' / 'components' / 'layout' / 'Sidebar.jsx'
RAIL     = REPO / 'frontend' / 'src' / 'components' / 'layout' / 'ActiveJourneyRail.jsx'
HOOK     = REPO / 'frontend' / 'src' / 'hooks' / 'useActiveJourneys.js'


# ── BACKEND CONNECTIVITY ─────────────────────────────────────────
class TestActiveJourneysSource:
    """The rail consumes /api/dashboard/pulse. Make sure the contract is intact."""

    @pytest.fixture(scope='class')
    def token(self):
        r = requests.post(f"{API}/api/auth/login",
                          json={"email": "demo@moodfordesign.com",
                                "password": "Blueprint2024!"}, timeout=20)
        assert r.status_code == 200, r.text
        return r.json()["session"]["access_token"]

    def test_pulse_exposes_active_journeys(self, token):
        r = requests.get(f"{API}/api/dashboard/pulse",
                         headers={"Authorization": f"Bearer {token}"}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "active_journeys" in data
        assert isinstance(data["active_journeys"], list)

    def test_active_journey_has_required_rail_fields(self, token):
        r = requests.get(f"{API}/api/dashboard/pulse",
                         headers={"Authorization": f"Bearer {token}"}, timeout=20)
        items = r.json().get("active_journeys", [])
        if not items:
            pytest.skip("no active journeys to inspect")
        j = items[0]
        for k in ("journey_id", "project_id", "account_name", "lifecycle_state",
                  "lifecycle_label"):
            assert k in j, f"missing rail field {k}"


# ── FRONTEND STATIC — INFORMATION ARCHITECTURE ───────────────────
class TestSidebarIA:
    def test_sidebar_has_five_journey_first_sections(self):
        src = SIDEBAR.read_text()
        # required section ids
        for sid in ("home", "design-journey", "curatorial-atlas",
                    "client-relations", "studio-os"):
            assert f'id="{sid}"' in src, f"missing section id: {sid}"

    def test_design_journey_section_is_present_with_tm(self):
        src = SIDEBAR.read_text()
        # the dominant section must be labelled "Design Journey" with hasMark (™)
        assert 'label="Design Journey" hasMark' in src

    def test_studio_pulse_is_the_home(self):
        src = SIDEBAR.read_text()
        assert 'label="Studio Pulse"' in src
        assert 'to="/dashboard"' in src

    def test_active_journey_rail_is_mounted_under_design_journey(self):
        src = SIDEBAR.read_text()
        assert "ActiveJourneyRail" in src
        assert 'to="/begin-journey"' in src
        assert "Inizia un Journey" in src
        assert "I tuoi Journey" in src


# ── FRONTEND STATIC — FORBIDDEN ROOTS (G.5 IA LOCK) ──────────────
class TestSidebarRootCleanup:
    """Legacy artifact pages must NOT appear as sidebar roots anymore. They
    live only inside a Journey Step. Cross-checks Sprint G.5 IA promise.
    """
    FORBIDDEN_ROOT_LABELS = [
        'label="Moodboards"',
        'label="Moodboard"',
        'label="Materials"',
        'label="Documents"',
        'label="Documenti"',
        'label="Render"',
        'label="Hotspots"',
        'label="Site Evolution"',
        'label="Proposals"',
        'label="Presentations"',
        'label="Tasks"',
        'label="Pipeline"',
        'label="Leads"',
        'label="Deals"',
    ]

    def test_no_legacy_artifact_root(self):
        src = SIDEBAR.read_text()
        for bad in self.FORBIDDEN_ROOT_LABELS:
            assert bad not in src, f"forbidden legacy root in sidebar: {bad}"

    def test_no_saas_jargon_in_sidebar(self):
        text = SIDEBAR.read_text().lower()
        for bad in ("kanban", "ticket", "sprint board", "crm overview",
                    "sales pipeline", "deals", "opportunit", "lead score"):
            assert bad not in text, f"forbidden SaaS jargon: {bad}"


# ── FRONTEND STATIC — ACTIVE JOURNEY RAIL ────────────────────────
class TestActiveJourneyRail:
    def test_rail_uses_journey_os_tokens(self):
        src = RAIL.read_text()
        # tenant-aware tokens, not hard-coded SaaS blue
        assert "--jo-cool" in src
        assert "--jo-accent" in src
        assert "--jo-attn" in src

    def test_rail_empty_state_is_relational(self):
        src = RAIL.read_text()
        # NO "create your first project" jargon. Soft invitation only.
        assert "Nessun Journey vivo" in src
        assert "Inizia una conversazione" in src
        for bad in ("Create your first project", "Get started",
                    "Add new project", "New deal"):
            assert bad not in src

    def test_rail_lifecycle_glow_palette_covers_canonical_states(self):
        src = RAIL.read_text()
        for state in ("conversation_open", "in_progress", "presenting",
                      "drifting", "on_pause", "approved", "closed",
                      "editioned", "abandoned"):
            assert state in src, f"missing lifecycle state in rail: {state}"

    def test_rail_silence_marker_is_editorial(self):
        src = RAIL.read_text()
        assert "silenzio" in src  # not "stale", not "inactive"

    def test_rail_has_required_testids(self):
        src = RAIL.read_text()
        for tid in ('data-testid="sidebar-active-journeys"',
                    'data-testid="sidebar-journeys-empty"',
                    'data-testid="sidebar-begin-journey-cta"'):
            assert tid in src

    def test_hook_polls_pulse(self):
        src = HOOK.read_text()
        assert "/api/dashboard/pulse" in src
        assert "active_journeys" in src
