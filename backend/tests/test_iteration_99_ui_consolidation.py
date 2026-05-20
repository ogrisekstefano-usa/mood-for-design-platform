"""Iter99 · UI Consolidation Sprint.

Coverage:
  • Sidebar cleanup: Product Gallery / Visual Archive removed; Media
    Library added (points to /library).
  • Palette consistency: pages opt into the shared mood-atmospheric base
    (var(--mood-bg) + var(--mood-atmosphere)) instead of pure #0a0b0c.
  • Inspirations grid: denser (column-count 6 → 5 → 4 → 3 → 2 → 1).
  • Material View: smaller tiles (minmax 150px instead of 180px),
    tighter gap.
  • Moodboards atelier: smart fallback composition card with gradient
    hero, palette dots, material chips, atmosphere line, "Continua la
    direzione" CTA.
"""
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
FRONTEND = REPO / "frontend" / "src"


def _read(*parts):
    return FRONTEND.joinpath(*parts).read_text(encoding="utf-8")


# ─── Sidebar cleanup ──────────────────────────────────────────────
def test_sidebar_no_longer_has_product_gallery_or_visual_archive():
    src = _read("components", "layout", "Sidebar.jsx")
    assert 'label="Product Gallery"' not in src, (
        "Product Gallery removed (redundant with Inspirations)"
    )
    assert 'label="Visual Archive"' not in src, (
        "Visual Archive replaced by Media Library"
    )


def test_sidebar_has_media_library_pointing_to_library():
    src = _read("components", "layout", "Sidebar.jsx")
    assert 'label="Media Library"' in src
    assert 'to="/library"' in src


# ─── Shared atmospheric base ──────────────────────────────────────
def test_mood_atmosphere_layer_exists():
    p = FRONTEND / "styles" / "mood-atmosphere.css"
    assert p.exists()
    src = p.read_text()
    for token in (
        "--mood-bg", "--mood-bg-2", "--mood-bg-3",
        "--mood-warm", "--mood-cyan", "--mood-pearl",
        "--mood-atmosphere",
        ".mood-atmospheric",
    ):
        assert token in src, f"Missing token '{token}' in atmosphere layer"
    # Never pure black flat (background declarations only — comments OK)
    for bad in ("background: #000;", "background:#000;",
                "background: #000000;", "background: #0a0b0c;",
                "background:#0a0b0c;"):
        assert bad not in src, f"Pure black background in atmosphere layer ({bad})"


def test_index_css_imports_mood_atmosphere():
    src = _read("index.css")
    assert "mood-atmosphere.css" in src


# ─── Palette opt-in across affected pages ─────────────────────────
def test_projects_page_uses_mood_atmosphere():
    src = _read("pages", "workspace", "projects-page.css")
    assert "var(--mood-bg)" in src
    assert "var(--mood-atmosphere)" in src


def test_design_journey_uses_mood_atmosphere():
    src = _read("pages", "workspace", "design-journey.css")
    assert "var(--mood-bg)" in src
    assert "var(--mood-atmosphere)" in src


def test_insights_page_uses_mood_atmosphere():
    src = _read("pages", "insights", "insights.css")
    assert "var(--mood-bg)" in src
    assert "var(--mood-atmosphere)" in src


def test_inspirations_page_uses_mood_atmosphere():
    src = _read("pages", "inspirations", "inspirations.css")
    assert "var(--mood-bg)" in src
    assert "var(--mood-atmosphere)" in src


def test_material_view_uses_mood_atmosphere():
    src = _read("pages", "inspirations", "material-view.css")
    assert "var(--mood-bg)" in src
    assert "var(--mood-atmosphere)" in src


# ─── Inspirations grid density ─────────────────────────────────────
def test_inspirations_grid_denser():
    src = _read("pages", "inspirations", "inspirations.css")
    # Wide desktop: 6 columns (was 5)
    assert "column-count: 6" in src
    # Tighter gap
    assert "column-gap: 10px" in src


# ─── Material View tile size reduced ───────────────────────────────
def test_material_view_tiles_more_compact():
    src = _read("pages", "inspirations", "material-view.css")
    # Smaller min tile (was 180px, now 150px)
    assert "minmax(150px, 1fr)" in src


# ─── Moodboards Atelier smart fallback ─────────────────────────────
def test_moodboards_page_uses_atelier_grid():
    src = _read("pages", "moodboards", "MoodboardsPage.jsx")
    assert "MoodboardCard" in src
    assert "mb-atelier" in src
    assert "Tavolo Creativo" in src
    # Editorial Italian status meta
    for label in (
        "Composizione aperta",
        "Direzione condivisa",
        "Cliente in lettura",
        "Direzione approvata",
        "Revisione richiesta",
    ):
        assert label in src, f"Missing editorial atelier label '{label}'"
    # CTA editorial
    assert "Continua la direzione" in src


def test_moodboard_card_has_smart_fallback_composition():
    src = _read("pages", "moodboards", "MoodboardsPage.jsx")
    # Hero must support BOTH cover image AND generated composition
    assert "coverUrl ? (" in src
    assert "mbcard__hero-grad" in src
    assert "mbcard__hero-text" in src
    assert "mbcard__hero-strips" in src
    # Palette dots + material chips + atmosphere
    assert "mbcard__palette" in src
    assert "mbcard__chips" in src
    assert "mbcard__atmo" in src


def test_moodboards_atelier_css_exists_and_uses_mood_palette():
    p = FRONTEND / "pages" / "moodboards" / "moodboards-atelier.css"
    assert p.exists()
    src = p.read_text()
    assert "var(--mood-bg)" in src
    assert "var(--mood-atmosphere)" in src
    assert "var(--mood-warm)" in src
    # No SaaS blue
    assert "#3b82f6" not in src
    assert "blue-500" not in src


# ─── Forbidden lexicon scan ───────────────────────────────────────
def test_no_pure_black_in_atmospheric_pages():
    """The pages that opted into the atmosphere layer must NOT keep
    hardcoded pure-black backgrounds."""
    for path in [
        ("pages", "workspace", "projects-page.css"),
        ("pages", "workspace", "design-journey.css"),
        ("pages", "insights", "insights.css"),
        ("pages", "inspirations", "material-view.css"),
        ("pages", "moodboards", "moodboards-atelier.css"),
    ]:
        src = _read(*path)
        # The page MUST NOT use plain #000 / #000000 as base. Permitted:
        # near-black greys like #1a1a1c (already in palette swatches).
        for bad in ("background: #000;", "background:#000;", "background: #000000;"):
            assert bad not in src, f"Pure black background in {'/'.join(path)}"


def test_moodboards_page_has_no_admin_lexicon():
    src = _read("pages", "moodboards", "MoodboardsPage.jsx").lower()
    for bad in ("file manager", "asset manager", "grid manager",
                "card widget", "file browser"):
        assert bad not in src, f"Forbidden term '{bad}' in MoodboardsPage"
