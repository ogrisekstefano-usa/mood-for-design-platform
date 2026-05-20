"""Iter96 · Journey Continuity™ Phase 2.

Satellite Context Expansion + Milestone Immersion + Editorial Vocabulary
Refinement.

What this iteration locks down:
  • JourneyContextHeader™ supports URL-based resolution via ?project=<id>
    (so satellite pages without an explicit prop still get the ambient
    strip when the Design Journey™ CTA navigates them).
  • Design Journey™ navigate-mode "Apri" CTA appends ?project=<id>
    &from=journey to all linked routes — preserves environmental
    continuity into Moodboards / Materials / Inspirations / etc.
  • Context Header™ is mounted in the P0/P1 satellite pages:
      - Moodboard Editor (already from iter95)
      - MaterialViewPage
      - ProductGalleryPage
      - InspirationsPage
  • Phase 2 editorial vocabulary in the satellite header:
      "Evoluzione in corso" / "Direzione presentata" / "Direzione approvata"
      (instead of bare "In lavorazione" / "Presentata" / "Approvata").
  • Milestone Immersion™: rail spine architectural connector + cinematic
    fade animation on milestone switch (CSS-only, GPU-safe).
  • NO inline action controls in the strip (no quick-status buttons,
    no toolbar operations — atmospheric layer only).
"""
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
FRONTEND = REPO / "frontend" / "src"

FORBIDDEN_TERMS = [
    "task", "tasks", "sprint", "sprints", "kanban", "dashboard",
    "workflow", "ticket", "tickets", "todo", "doing", "done",
    "quick action", "quick actions", "admin controls",
]


def _read(*parts):
    return (FRONTEND.joinpath(*parts)).read_text(encoding="utf-8")


# ─── JourneyContextHeader: URL-based resolution + new vocabulary ──────
def test_jch_resolves_project_from_url_param():
    src = _read("components", "journey", "JourneyContextHeader.jsx")
    # Must read ?project=<id> when no explicit prop is passed
    assert "useSearchParams" in src
    assert "searchParams.get('project')" in src
    # Effective entity computed from the fallback
    assert "effType" in src and "effId" in src


def test_jch_uses_phase_2_editorial_vocabulary():
    src = _read("components", "journey", "JourneyContextHeader.jsx")
    for label in (
        "Evoluzione in corso",
        "Direzione presentata",
        "Direzione approvata",
        "Revisione richiesta",
        "Chiusa",
    ):
        assert label in src, f"Missing Phase 2 vocabulary '{label}'"
    # Older bare labels MUST be gone from JCH (still valid inside the
    # Journey tab — they are the canonical state labels for transitions).
    # The JCH itself uses the cinematic versions instead.
    assert "label: 'In lavorazione'" not in src
    assert "label: 'Presentata'" not in src


def test_jch_has_no_inline_action_controls():
    """The atmospheric strip MUST NOT contain quick-status buttons or
    workflow toolbars. It is ambient, not operational."""
    src = _read("components", "journey", "JourneyContextHeader.jsx")
    # Action-button text patterns that would betray an operational
    # toolbar. We match substrings that are unlikely to collide with
    # passive status labels like "Approvata" / "Direzione approvata".
    forbidden_action_text = [
        "Marca come",
        "Aggiorna stato",
        "Chiudi milestone",
        "Update status",
        "onClick={",  # any inline JS action handler would mean a button
    ]
    for t in forbidden_action_text:
        assert t not in src, f"Forbidden action '{t}' in JourneyContextHeader.jsx"
    # No <button> elements should exist in the JCH — only <Link>s
    # (project link + back-to-journey shortcut).
    assert "<button" not in src


def test_jch_mounted_in_p0_p1_satellite_pages():
    """Material View, Product Gallery, Inspirations and Moodboard Editor
    must all import + render the JourneyContextHeader."""
    pages = {
        "Moodboard Editor":  ("pages", "moodboards",   "MoodboardEditor.jsx"),
        "Material View":     ("pages", "inspirations", "MaterialViewPage.jsx"),
        "Product Gallery":   ("pages", "inspirations", "ProductGalleryPage.jsx"),
        "Inspirations Page": ("pages", "inspirations", "InspirationsPage.jsx"),
    }
    for name, path in pages.items():
        src = _read(*path)
        assert "JourneyContextHeader" in src, (
            f"{name} does not import the JourneyContextHeader"
        )
        assert "<JourneyContextHeader" in src, (
            f"{name} does not render the JourneyContextHeader"
        )


# ─── Design Journey™ navigation continuity ────────────────────────────
def test_journey_open_cta_appends_project_query_param():
    """The 'Apri <milestone>' CTA must append ?project=<id>&from=journey
    so the satellite module can render the ambient context strip."""
    src = _read("pages", "workspace", "DesignJourneyTab.jsx")
    assert "project=${projectId}" in src
    assert "from=journey" in src


def test_focus_panel_uses_key_for_immersion_animation():
    """Milestone Immersion™: FocusPanel re-mounts on milestone change so
    the cinematic CSS fade replays. Without a key, switching milestones
    would just swap text in place (no chapter feeling)."""
    src = _read("pages", "workspace", "DesignJourneyTab.jsx")
    assert "key={active?.id" in src


# ─── Milestone Immersion™ CSS ─────────────────────────────────────────
def test_rail_has_architectural_spine():
    src = _read("pages", "workspace", "design-journey.css")
    assert ".dj-rail__list::before" in src, (
        "Architectural vertical spine missing from the milestone rail"
    )
    assert "dj-cinematic-fade" in src, "Cinematic fade keyframe missing"
    assert "prefers-reduced-motion" in src, (
        "Reduced-motion guard missing — required for accessibility/GPU safety"
    )


def test_active_rail_item_has_gold_halo():
    src = _read("pages", "workspace", "design-journey.css")
    # The .dj-rail__btn::before pseudo-element provides the architectural
    # gold accent strip on the active milestone.
    assert ".dj-rail__item.is-current .dj-rail__btn::before" in src


def test_focus_title_is_more_immersive():
    src = _read("pages", "workspace", "design-journey.css")
    # Phase 2: focus title scaled up from 32px → 42px
    assert "font-size: 42px" in src
    # Description rephrased as italic editorial prose
    assert "font-style: italic" in src


# ─── No regression on previous editorial guards ───────────────────────
def test_satellite_pages_have_no_forbidden_enterprise_terms_around_jch():
    """Around the JCH mount, no enterprise jargon should be present."""
    for path in [
        ("pages", "moodboards", "MoodboardEditor.jsx"),
        ("pages", "inspirations", "MaterialViewPage.jsx"),
        ("pages", "inspirations", "ProductGalleryPage.jsx"),
        ("pages", "inspirations", "InspirationsPage.jsx"),
    ]:
        src = _read(*path).lower()
        for bad in ("kanban", "workflow toolbar", "admin toolbar",
                    "quick action", "module state", "tool switch"):
            assert bad not in src, (
                f"Forbidden term '{bad}' present near JCH mount in "
                f"{'/'.join(path)}"
            )
