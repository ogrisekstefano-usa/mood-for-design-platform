"""Iter97 · Sidebar Architecture v4.

Verifies the new mental map of MOOD for DESIGN™:
  HOME · DESIGN JOURNEY™ · CURATORIAL ATLAS · CLIENT RELATIONS ·
  CONTENT STUDIO · STUDIO OS · PLATFORM

Critical rules:
  • ™ used ONLY on Blueprint OS™, Design Journey™, Cultural Editions™,
    Composition Modes™. Banned on Magazine, Materials, Inspirations,
    Accounts, Documents, Web Presence, Settings, Team, ecc.
  • Experience Studio™ → renamed to "Web Presence" (route preserved).
  • Inspirations lives in Curatorial Atlas, NOT Design Journey™.
  • Collapsible sections with localStorage persistence.
  • Active state: gold left accent, NO SaaS blue background.
  • No new sidebar route breaks existing URLs.
"""
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
SIDEBAR = REPO / "frontend" / "src" / "components" / "layout" / "Sidebar.jsx"
APP_JS = REPO / "frontend" / "src" / "App.js"
COMING_SOON = REPO / "frontend" / "src" / "pages" / "placeholder" / "ComingSoonPage.jsx"


def _read(p):
    return p.read_text(encoding="utf-8")


# ─── Section architecture ─────────────────────────────────────────
def test_six_sections_present():
    src = _read(SIDEBAR)
    for sid in ("home", "design-journey", "curatorial-atlas",
                "client-relations", "content-studio", "studio-os"):
        assert f'id="{sid}"' in src, f"Sidebar missing section id={sid}"


def test_sections_have_collapsible_toggles():
    src = _read(SIDEBAR)
    assert "sidebar-section-toggle-" in src
    assert "useSectionCollapse" in src
    assert "localStorage" in src
    assert "SECTION_STORAGE_KEY" in src


def test_section_order():
    """Sections must appear in the canonical v4 order:
    Home → Design Journey → Curatorial Atlas → Client Relations →
    Content Studio → Studio OS."""
    src = _read(SIDEBAR)
    order = []
    for m in re.finditer(r'<Section\s+id="([^"]+)"', src):
        order.append(m.group(1))
    expected_prefix = [
        "home", "design-journey", "curatorial-atlas",
        "client-relations", "content-studio", "studio-os",
    ]
    assert order[:6] == expected_prefix, f"Got order: {order}"


# ─── Design Journey™ section content ──────────────────────────────
def test_design_journey_items_are_correct():
    src = _read(SIDEBAR)
    # Per iter98 user mandate: Project Studio + Materials removed from
    # Design Journey™ (DJ now contains only the project-evolution
    # phases). Design Stories absorbs the Project Studio link in
    # Content Studio. Materials lives only in Curatorial Atlas.
    journey_block = re.search(
        r'<Section id="design-journey".*?</Section>',
        src, re.S,
    )
    assert journey_block, "Design Journey section block not found"
    blk = journey_block.group(0)
    for label in (
        'label="Projects"',
        'label="Moodboards"',
        'label="Render"',
        'label="Hotspots"',
        'label="Site Evolution"',
        'label="Documents"',
    ):
        assert label in blk, f"Design Journey missing {label}"
    # Explicitly assert the removed items are gone
    assert 'label="Project Studio"' not in blk
    assert 'label="Materials"' not in blk


def test_inspirations_lives_in_curatorial_atlas_not_journey():
    src = _read(SIDEBAR)
    journey_block = re.search(
        r'<Section id="design-journey".*?</Section>', src, re.S,
    ).group(0)
    atlas_block = re.search(
        r'<Section id="curatorial-atlas".*?</Section>', src, re.S,
    ).group(0)
    assert 'label="Inspirations"' not in journey_block, (
        "Inspirations must NOT live in Design Journey™ (curatorial archive, "
        "not operational milestone)"
    )
    assert 'label="Inspirations"' in atlas_block


# ─── Curatorial Atlas ─────────────────────────────────────────────
def test_curatorial_atlas_items():
    src = _read(SIDEBAR)
    blk = re.search(r'<Section id="curatorial-atlas".*?</Section>', src, re.S).group(0)
    for label in (
        'label="Inspirations"',
        'label="Brand Mode"',
        'label="Product Gallery"',
        'label="Material View"',
        'label="Visual Archive"',
        'label="Cultural Editions"',
    ):
        assert label in blk


# ─── Client Relations ─────────────────────────────────────────────
def test_client_relations_items():
    src = _read(SIDEBAR)
    blk = re.search(r'<Section id="client-relations".*?</Section>', src, re.S).group(0)
    # Iter98: Proposals removed per user request — surface relations only.
    for label in (
        'label="Accounts"',
        'label="Follow-ups"',
        'label="Archived"',
    ):
        assert label in blk
    assert 'label="Proposals"' not in blk


# ─── Content Studio ───────────────────────────────────────────────
def test_content_studio_items_and_web_presence_rename():
    src = _read(SIDEBAR)
    blk = re.search(r'<Section id="content-studio".*?</Section>', src, re.S).group(0)
    for label in (
        'label="Editorial Calendar"',
        'label="Magazine"',
        'label="Design Stories"',
        'label="Publishing Queue"',
        'label="Market Matrix"',
        'label="Web Presence"',
    ):
        assert label in blk, f"Content Studio missing {label}"
    # Experience Studio™ must be banished from the visible label set.
    assert 'label="Experience Studio"' not in src
    assert 'label="Experience Studio\u2122"' not in src


def test_design_stories_is_distinct_from_project_studio():
    """Iter98 mandate: Design Stories now takes over the
    /blueprint/projects-studio route (the editorial portfolio editor) —
    they are conceptually the same surface in the user's mental model.
    The visible label in the sidebar is 'Design Stories', not 'Project
    Studio'."""
    src = _read(SIDEBAR)
    assert 'label="Design Stories"' in src
    # Project Studio is no longer a separate sidebar label
    assert 'label="Project Studio"' not in src


# ─── Studio OS ────────────────────────────────────────────────────
def test_studio_os_items():
    src = _read(SIDEBAR)
    blk = re.search(r'<Section id="studio-os".*?</Section>', src, re.S).group(0)
    for label in (
        'label="Team"',
        'label="Insights"',
        'label="Brand Studio"',
        'label="Forms & Journeys"',
        'label="Integrations"',
        'label="Billing"',
        'label="Settings"',
    ):
        assert label in blk


# ─── ™ usage rules ────────────────────────────────────────────────
def test_trademark_usage_is_restrained():
    """™ is allowed ONLY on:
      - Design Journey (section label)
      - Cultural Editions (nav item with hasMark)
    Everything else must NOT carry the symbol in the sidebar source.
    """
    src = _read(SIDEBAR)
    # Inline ™ must NOT appear next to forbidden labels
    forbidden = [
        "Inspirations\u2122", "Materials\u2122", "Magazine\u2122",
        "Accounts\u2122", "Settings\u2122", "Team\u2122",
        "Documents\u2122", "Publishing Queue\u2122", "Web Presence\u2122",
        "Brand Mode\u2122", "Product Gallery\u2122", "Material View\u2122",
        "Visual Archive\u2122", "Experience Studio\u2122",
    ]
    for bad in forbidden:
        assert bad not in src, f"Forbidden ™ usage: '{bad}'"
    # Allowed ™ MUST be present (Design Journey section + Cultural Editions item)
    assert 'label="Design Journey" hasMark' in src
    # Cultural Editions hasMark
    assert re.search(r'label="Cultural Editions"\s+hasMark', src), (
        "Cultural Editions must carry hasMark for ™"
    )


# ─── Routing safety ───────────────────────────────────────────────
def test_existing_canonical_routes_still_referenced():
    src = _read(SIDEBAR)
    for to in (
        "/dashboard",
        "/workspace/projects",
        "/moodboards",
        "/inspirations",
        "/inspirations/brands",
        "/inspirations/materials",
        "/workspace/cultural-editions",
        "/crm/accounts",
        "/crm/follow-ups",
        "/crm/archived",
        "/blueprint/editorial-calendar",
        "/blueprint/editorial",
        "/blueprint/markets",
        "/blueprint/experience",        # Web Presence keeps the legacy route
        "/blueprint/forms-journeys",
        "/blueprint/projects-studio",
        "/editorial/inbox",
        "/settings",
        "/settings/members",
        "/settings/brand",
        "/settings/plan",
        "/settings/integrations",
        "/insights",
    ):
        assert f'to="{to}"' in src, f"Sidebar lost canonical route {to}"


def test_new_placeholder_routes_registered_in_app_js():
    src = _read(APP_JS)
    for path in (
        "/journey/render",
        "/journey/hotspots",
        "/journey/site-evolution",
        "/journey/documents",
        "/content/design-stories",
        "/inspirations/visual-archive",
        "/inspirations/products",
    ):
        assert path in src, f"Route {path} not registered in App.js"
    assert "ComingSoonPage" in src


def test_coming_soon_page_uses_editorial_italian():
    src = _read(COMING_SOON)
    # Required editorial vocabulary
    for label in ("Capitolo", "prossimo capitolo", "Design Journey", "Torna ai progetti"):
        assert label in src, f"ComingSoonPage missing editorial phrase '{label}'"
    # JCH must be mounted
    assert "JourneyContextHeader" in src
    # NO admin/enterprise vocabulary
    low = src.lower()
    for bad in ("under construction", "coming soon", "kanban",
                "workflow toolbar", "task list"):
        assert bad not in low, f"Forbidden term '{bad}' in ComingSoonPage"


# ─── Editorial language guard on the sidebar itself ───────────────
def test_sidebar_has_no_enterprise_jargon():
    src = _read(SIDEBAR).lower()
    for bad in (
        "operations", "asset manager", "workflow header",
        "dashboard manager", "admin content",
        "kanban", "ticket", "todo",
    ):
        # Note: "Workflow" itself is impossible to fully ban because the
        # "Forms & Journeys" label uses an icon called "Workflow" — we'll
        # check it specifically appears only as an icon identifier, NOT
        # as a label.
        if bad == "workflow header":
            assert bad not in src
        else:
            assert bad not in src, f"Forbidden term '{bad}' in Sidebar.jsx"


# ─── Section-level collapsibility ─────────────────────────────────
def test_active_state_uses_gold_accent_not_blue():
    src = _read(SIDEBAR)
    # Active background must use the gold/warm palette
    assert "rgba(217,178,133,0.05)" in src or "var(--bp-primary" in src
    # No blue SaaS active backgrounds
    assert "bg-blue-" not in src
    assert "bg-indigo-" not in src
    assert "bg-sky-" not in src
