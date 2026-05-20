"""Iter98 · Sidebar Refinements + Insights Cinematic + Projects Atelier.

Coverage:
  • Sidebar: removed Project Studio from Design Journey™, Design Stories
    now points to /blueprint/projects-studio, Materials removed from DJ
    (still in Curatorial Atlas), Product Gallery → /inspirations?type=product,
    Proposals removed from Client Relations.
  • Insights backend: new GET /api/insights/studio-overview endpoint
    returning real DB aggregates (NO hardcoded numbers).
  • Insights frontend: cinematic page with headline cards, evolution
    sparklines, milestone pulse, activity heatmap, signature.
  • Projects list: editorial atelier cards (status glow, italic title,
    client/palette/mood chips, continue-journey CTA).
"""
import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parent.parent.parent
FRONTEND = REPO / "frontend" / "src"
load_dotenv(REPO / "frontend" / ".env")

API = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
LOGIN = "demo@moodfordesign.com"
PWD = "Blueprint2024!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/api/auth/login",
                      json={"email": LOGIN, "password": PWD}, timeout=20)
    r.raise_for_status()
    return r.json()["session"]["access_token"]


def H(t):
    return {"Authorization": f"Bearer {t}"}


def _read(*parts):
    return FRONTEND.joinpath(*parts).read_text(encoding="utf-8")


# ─── Sidebar refinements ──────────────────────────────────────────
def test_design_journey_no_longer_has_project_studio():
    src = _read("components", "layout", "Sidebar.jsx")
    journey_block = re.search(
        r'<Section id="design-journey".*?</Section>', src, re.S
    ).group(0)
    assert 'label="Project Studio"' not in journey_block, (
        "Design Journey™ must no longer carry Project Studio"
    )


def test_design_journey_no_longer_has_materials():
    src = _read("components", "layout", "Sidebar.jsx")
    journey_block = re.search(
        r'<Section id="design-journey".*?</Section>', src, re.S
    ).group(0)
    assert 'label="Materials"' not in journey_block, (
        "Materials moved out of Design Journey™"
    )


def test_curatorial_atlas_still_has_material_view():
    src = _read("components", "layout", "Sidebar.jsx")
    atlas = re.search(
        r'<Section id="curatorial-atlas".*?</Section>', src, re.S
    ).group(0)
    assert 'label="Material View"' in atlas


def test_design_stories_points_to_projects_studio():
    """Design Stories in Content Studio takes over the Project Studio
    route since the user explicitly merged the two concepts."""
    src = _read("components", "layout", "Sidebar.jsx")
    studio = re.search(
        r'<Section id="content-studio".*?</Section>', src, re.S
    ).group(0)
    assert 'to="/blueprint/projects-studio"' in studio
    assert 'label="Design Stories"' in studio
    # And the "soon" badge has been removed since the route exists
    assert re.search(
        r'label="Design Stories"[^/>]*soon', studio
    ) is None


def test_client_relations_no_proposals():
    src = _read("components", "layout", "Sidebar.jsx")
    cr = re.search(
        r'<Section id="client-relations".*?</Section>', src, re.S
    ).group(0)
    assert 'label="Proposals"' not in cr


def test_product_gallery_route_redirect_still_exists():
    """Iter99: Product Gallery removed from the sidebar (Inspirations
    already covers product inspirations). The /inspirations/products
    redirect route remains registered for any legacy deep-links."""
    app_js = _read("App.js")
    assert '"/inspirations/products"' in app_js
    assert "type=product" in app_js


# ─── Insights backend ─────────────────────────────────────────────
def test_studio_overview_endpoint_returns_real_data(token):
    r = requests.get(f"{API}/api/insights/studio-overview",
                     headers=H(token), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    # Required top-level keys
    for k in ("headline", "timeline", "milestone_pulse",
              "activity_surface", "signature", "active_members",
              "generated_at"):
        assert k in body, f"Missing key '{k}' in studio-overview response"
    # Headline counters
    h = body["headline"]
    for k in ("projects", "moodboards", "inspirations", "design_journeys",
              "milestones_approved", "milestones_in_progress"):
        assert k in h
        assert isinstance(h[k], int) and h[k] >= 0
    # Timeline series — exactly 12 weeks
    t = body["timeline"]
    assert len(t["weeks"]) == 12
    assert len(t["projects"]) == 12
    assert len(t["moodboards"]) == 12
    assert len(t["milestones"]) == 12
    # Activity surface — exactly 30 days
    a = body["activity_surface"]
    assert len(a["days"]) == 30
    assert len(a["events"]) == 30


def test_studio_overview_has_real_numbers_not_zero():
    """For the demo tenant we expect at least one project + moodboard."""
    r = requests.post(f"{API}/api/auth/login",
                      json={"email": LOGIN, "password": PWD}, timeout=20)
    tok = r.json()["session"]["access_token"]
    body = requests.get(f"{API}/api/insights/studio-overview",
                       headers=H(tok), timeout=20).json()
    h = body["headline"]
    assert h["projects"] > 0, "Demo tenant must have projects in real DB"
    assert h["moodboards"] > 0, "Demo tenant must have moodboards in real DB"


# ─── Insights frontend ────────────────────────────────────────────
def test_insights_page_uses_real_endpoint():
    src = _read("pages", "insights", "InsightsPage.jsx")
    assert "/api/insights/studio-overview" in src
    # No fake hardcoded numbers in stat cards (data comes from r.data)
    assert "headline" in src
    assert "Sparkline" in src
    assert "ActivityHeatmap" in src


def test_insights_page_has_editorial_lexicon():
    src = _read("pages", "insights", "InsightsPage.jsx")
    for phrase in (
        "Le pulsazioni dello studio",
        "L'evoluzione dello studio",
        "Dove si trova il pensiero progettuale",
        "La superficie viva del Journey",
        "La grammatica dello studio",
        "Pietre miliari",
    ):
        assert phrase in src, f"InsightsPage missing editorial phrase: '{phrase}'"
    # Forbidden enterprise vocabulary in user-facing copy
    low = src.lower()
    for bad in ("kanban", "workflow", "ticket"):
        assert bad not in low


# ─── Projects list editorial cards ────────────────────────────────
def test_projects_page_uses_editorial_status_labels():
    src = _read("pages", "workspace", "ProjectsPage.jsx")
    # Italian editorial status meta
    for label in (
        "Brief in apertura",
        "Direzione in lavorazione",
        "Direzione presentata",
        "Direzione approvata",
        "In revisione",
    ):
        assert label in src, f"ProjectsPage missing label '{label}'"


def test_projects_page_card_renders_palette_and_chips():
    src = _read("pages", "workspace", "ProjectsPage.jsx")
    assert "pcard__palette" in src
    assert "pcard__swatch" in src
    assert "pcard__chips" in src
    assert "Continua il viaggio" in src
    assert "pcard__cta" in src


def test_projects_page_has_no_saas_blue_or_admin_lexicon():
    src = _read("pages", "workspace", "ProjectsPage.jsx").lower()
    for bad in ("kanban", "workflow", "dashboard widget",
                "asset manager", "admin"):
        if bad == "admin":
            # 'admin' may legitimately appear in commented Markdown of
            # the file (e.g. permissions); we only ban it as label text.
            assert 'label="admin"' not in src
        else:
            assert bad not in src, f"Forbidden term '{bad}' in ProjectsPage"


def test_projects_page_css_uses_gold_and_cyan_no_blue():
    src = _read("pages", "workspace", "projects-page.css")
    assert "--pp-cyan" in src
    assert "--pp-warm" in src
    # No SaaS blue tokens
    assert "#3b82f6" not in src
    assert "rgb(59,130,246)" not in src
    assert "blue-500" not in src
