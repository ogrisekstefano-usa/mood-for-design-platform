"""Iter95 · Journey Continuity™ + Journey Absorption™ Sprint.

Backend coverage for the new context-by-entity endpoint that powers the
JourneyContextHeader™ in satellite modules (Moodboards / Materials /
Documents / Render).

Endpoint:
  GET /api/journeys/context/by-entity?entity_type=<…>&entity_id=<…>

Behaviour locked here:
  • entity_type='moodboard' → resolves project → 'moodboard_direction'
    milestone (the rule approved by the user: all moodboards of a
    project map to the SAME phase milestone, never to a single canvas).
  • entity_type='project'   → returns the journey's current milestone.
  • entity_type='material' / 'document' / 'render' → maps to the
    corresponding phase milestone (material_direction / technical_package
    / final_presentation).
  • Unknown entity_type → 200 with linked=False (NEVER 404; satellite
    modules must render nothing without breaking).
  • Missing/orphan entity → 200 with linked=False + reason.
  • Italian editorial titles must be preserved in the response.
"""
import os
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent.parent / "frontend" / ".env")

API = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
LOGIN = "demo@moodfordesign.com"
PWD = "Blueprint2024!"

FORBIDDEN_TERMS = [
    "task", "tasks", "sprint", "sprints", "kanban", "dashboard",
    "workflow", "ticket", "tickets", "todo", "doing", "done",
]


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/api/auth/login",
                      json={"email": LOGIN, "password": PWD}, timeout=20)
    r.raise_for_status()
    return r.json()["session"]["access_token"]


def H(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def project_id(token):
    r = requests.get(f"{API}/api/projects?limit=5", headers=H(token), timeout=20)
    r.raise_for_status()
    items = r.json().get("data") or r.json().get("items") or []
    assert items, "Demo project list is empty"
    return items[0]["id"]


@pytest.fixture(scope="module")
def journey_ensured(token, project_id):
    """Make sure the journey + 10 milestones exist for the demo project."""
    r = requests.get(f"{API}/api/projects/{project_id}/journey",
                     headers=H(token), timeout=20)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def moodboard_id(token, project_id, journey_ensured):
    """Use an existing moodboard of the demo project, or create one."""
    r = requests.get(f"{API}/api/moodboards",
                     params={"project_id": project_id},
                     headers=H(token), timeout=20)
    items = r.json().get("items") or r.json().get("data") or r.json()
    if isinstance(items, list) and items:
        return items[0]["id"]
    # Create one
    r = requests.post(f"{API}/api/moodboards", headers=H(token),
                      json={"title": f"Iter95 Context MB {uuid.uuid4().hex[:6]}",
                            "project_id": project_id}, timeout=20)
    r.raise_for_status()
    return r.json()["id"]


# ── Tests ──────────────────────────────────────────────────────────────
def test_context_by_project_returns_current_milestone(token, project_id, journey_ensured):
    r = requests.get(f"{API}/api/journeys/context/by-entity",
                     params={"entity_type": "project", "entity_id": project_id},
                     headers=H(token), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["linked"] is True
    assert body["project"]["id"] == project_id
    assert body["milestone"]["id"]
    assert body["milestone"]["title"]
    # Status must be one of the editorial Italian set
    assert body["milestone"]["status"] in {
        "not_started", "in_progress", "presented", "revision_requested",
        "partially_approved", "approved", "closed",
    }


def test_context_by_moodboard_maps_to_moodboard_direction(token, moodboard_id):
    """User-approved linkage rule: every moodboard of a project maps to
    the SAME 'moodboard_direction' milestone (the phase milestone), not
    to a single canvas."""
    r = requests.get(f"{API}/api/journeys/context/by-entity",
                     params={"entity_type": "moodboard", "entity_id": moodboard_id},
                     headers=H(token), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["linked"] is True
    assert body["milestone"]["milestone_type"] == "moodboard_direction"
    assert "Moodboard Direction" in body["milestone"]["title"]


def test_context_by_material_maps_to_material_direction(token, project_id, journey_ensured):
    r = requests.get(f"{API}/api/journeys/context/by-entity",
                     params={"entity_type": "material", "entity_id": project_id},
                     headers=H(token), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["linked"] is True
    assert body["milestone"]["milestone_type"] == "material_direction"


def test_context_by_document_maps_to_technical_package(token, project_id, journey_ensured):
    r = requests.get(f"{API}/api/journeys/context/by-entity",
                     params={"entity_type": "document", "entity_id": project_id},
                     headers=H(token), timeout=20)
    body = r.json()
    assert body["linked"] is True
    assert body["milestone"]["milestone_type"] == "technical_package"


def test_context_by_render_maps_to_final_presentation(token, project_id, journey_ensured):
    r = requests.get(f"{API}/api/journeys/context/by-entity",
                     params={"entity_type": "render", "entity_id": project_id},
                     headers=H(token), timeout=20)
    body = r.json()
    assert body["linked"] is True
    assert body["milestone"]["milestone_type"] == "final_presentation"


def test_unknown_entity_type_returns_unlinked_not_404(token):
    r = requests.get(f"{API}/api/journeys/context/by-entity",
                     params={"entity_type": "spaceship", "entity_id": str(uuid.uuid4())},
                     headers=H(token), timeout=20)
    assert r.status_code == 200, r.text
    assert r.json()["linked"] is False


def test_missing_moodboard_returns_unlinked(token):
    r = requests.get(f"{API}/api/journeys/context/by-entity",
                     params={"entity_type": "moodboard", "entity_id": str(uuid.uuid4())},
                     headers=H(token), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["linked"] is False
    assert body["reason"] == "moodboard_not_found"


def test_context_response_uses_editorial_lexicon(token, project_id, journey_ensured):
    """No enterprise jargon should leak into milestone titles/descriptions."""
    r = requests.get(f"{API}/api/journeys/context/by-entity",
                     params={"entity_type": "project", "entity_id": project_id},
                     headers=H(token), timeout=20).json()
    m = r["milestone"]
    blob = " ".join([
        m.get("title") or "", m.get("description") or "",
        m.get("status") or "",
    ]).lower()
    for bad in FORBIDDEN_TERMS:
        assert bad not in blob, f"Forbidden term '{bad}' leaked into context response"


def test_overview_no_longer_renders_duplicated_stats_grid():
    """Static check: the Overview tab in ProjectDetailPage.jsx must NOT
    render the 6-stat grid anymore (absorbed into Journey™).
    """
    p = Path(__file__).resolve().parent.parent.parent / \
        "frontend" / "src" / "pages" / "workspace" / "ProjectDetailPage.jsx"
    src = p.read_text(encoding="utf-8")
    # The Overview tab section must no longer reference 'Sintesi operativa'
    # because the Journey™ now carries that narrative.
    assert "Sintesi operativa" not in src, (
        "Overview still renders the operational stats grid — Journey "
        "absorption is incomplete."
    )


def test_journey_full_width_layout_present():
    """ProjectDetailPage must render the Journey as a full-bleed environment
    when tab === 'journey' (no max-w-6xl wrapper)."""
    p = Path(__file__).resolve().parent.parent.parent / \
        "frontend" / "src" / "pages" / "workspace" / "ProjectDetailPage.jsx"
    src = p.read_text(encoding="utf-8")
    # Hallmarks of the full-bleed branch
    assert "if (isJourney)" in src
    assert "min-h-screen bg-[var(--bp-bg)]" in src
    # The DesignJourneyTab must receive the project prop for absorption
    assert "<DesignJourneyTab projectId={id} project={project}" in src


def test_dj_shell_css_is_full_bleed():
    """design-journey.css must NOT keep the boxed-card shell anymore."""
    p = Path(__file__).resolve().parent.parent.parent / \
        "frontend" / "src" / "pages" / "workspace" / "design-journey.css"
    src = p.read_text(encoding="utf-8")
    # The .dj-shell rule must declare border: none and border-radius: 0
    # (full-bleed environment, not a card).
    assert "border: none" in src
    assert "border-radius: 0" in src


def test_journey_context_header_component_exists():
    """The Journey Continuity™ context header must exist and be importable
    by satellite modules."""
    p = Path(__file__).resolve().parent.parent.parent / \
        "frontend" / "src" / "components" / "journey" / "JourneyContextHeader.jsx"
    assert p.exists(), "JourneyContextHeader.jsx missing"
    src = p.read_text(encoding="utf-8")
    # Must use the editorial lead phrase and the Italian status labels
    assert "Stai attraversando" in src
    for label in (
        "In lavorazione", "Presentata", "Revisione richiesta",
        "Approvata", "Chiusa",
    ):
        assert label in src
    # And must NOT contain forbidden enterprise terms
    lower = src.lower()
    for bad in ("kanban", "sprint", "ticket", "workflow", "dashboard"):
        assert bad not in lower, f"Forbidden term '{bad}' in JourneyContextHeader.jsx"


def test_journey_context_header_mounted_in_moodboard_editor():
    """The header must be imported and rendered inside MoodboardEditor."""
    p = Path(__file__).resolve().parent.parent.parent / \
        "frontend" / "src" / "pages" / "moodboards" / "MoodboardEditor.jsx"
    src = p.read_text(encoding="utf-8")
    assert "JourneyContextHeader" in src
    assert 'entityType="moodboard"' in src
