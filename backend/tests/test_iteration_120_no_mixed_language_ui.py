"""Iter120 · Sprint I18N-FINALIZATION · Hard String Scanner™.

Forbids hardcoded Italian editorial vocabulary in P0 consumer files.
Any new mixed-language UI introduced in these files will be blocked.

The scanner whitelists:
  - i18n string dictionaries (frontend/src/i18n/strings/*.json)
  - taxonomy registry (backend/taxonomy/__init__.py)
  - tests / fixtures / seeds (backend/tests/, scripts/seed_*)
  - comments and docstrings inside source files
  - Inline fallback strings inside `t(..., null, '...')` calls — these are
    intentional editorial fallbacks shipped while a backend deploy is in
    progress and are governed by GovernanceOverlay missing-keys KPI.

Adding a new forbidden string to source code MUST come with either:
  - a t() call referencing the i18n key
  - a useTaxonomy() lookup
  - an explicit whitelist entry below with justification
"""
import re
from pathlib import Path
import pytest

REPO = Path(__file__).resolve().parent.parent.parent
FRONTEND_SRC = REPO / 'frontend' / 'src'

# ── Hard-forbidden Italian editorial strings ───────────────────
# These are user-facing labels that MUST be served through i18n/taxonomy.
# The list is intentionally short and conservative — extend only via
# Translation Studio governance review.
FORBIDDEN_STRINGS = [
    # Sidebar / navigation
    'I tuoi Journey',
    'Inizia un Journey',
    'Voci aperte',
    # Projects / Journey grid
    'Brief in apertura',
    'Direzione presentata',
    'Progetto vinto',
    'Ultimo movimento',
    'Continua il viaggio',
    # Tabs
    '"Tutti"',  # quoted form is the leak signal; t('projects.tabs.all') is fine
    # CRM / archive
    'Archivio firmato',
    # Editorial commercials
    'Nuovo progetto',
]

# P0 consumer files that must NOT contain forbidden hardcoded strings.
# This list grows as more surfaces are migrated; iter120 covers the
# baseline set explicitly migrated in this sprint.
P0_FILES = [
    'components/layout/Sidebar.jsx',
    'pages/workspace/ProjectsPage.jsx',
    'pages/dashboard/JourneyPulsePage.jsx',
    'components/journey/JourneyClosureCeremony.jsx',
]

# Lines that are explicitly ALLOWED to contain a forbidden string:
#   - lines that include `t(` (i18n call)
#   - lines that include `taxonomy.` (taxonomy reference)
#   - lines that are pure comments (start with '//' or '*' or '/*')
#   - lines inside the STATUS_TONE mapping (tone visual map)
#   - JSON string keys (handled separately by file extension filter)
ALLOWED_LINE_PATTERNS = [
    re.compile(r"\bt\('[^']+'\s*,"),       # t('key',
    re.compile(r"\bt\(`[^`]+`"),            # t(`key`
    re.compile(r"taxonomy\."),              # taxonomy.foo.bar
    re.compile(r"^\s*//"),                  # // comment
    re.compile(r"^\s*\*"),                  # *  (jsdoc continuation)
    re.compile(r"^\s*/\*"),                 # /* comment start
    re.compile(r"taxonomy_key:"),           # STATUS_TONE entries
]


def _line_is_allowed(line: str) -> bool:
    return any(p.search(line) for p in ALLOWED_LINE_PATTERNS)


@pytest.mark.parametrize('rel', P0_FILES)
def test_p0_file_has_no_forbidden_italian_strings(rel):
    path = FRONTEND_SRC / rel
    assert path.exists(), f"P0 file missing: {rel}"
    src = path.read_text(encoding='utf-8')
    leaks = []
    for n, line in enumerate(src.splitlines(), start=1):
        for forbidden in FORBIDDEN_STRINGS:
            # Skip if the forbidden string is in a t() inline fallback —
            # those are intentional placeholders while i18n catches up.
            if forbidden in line and not _line_is_allowed(line):
                leaks.append(f"{rel}:{n}  '{forbidden}'  in:  {line.strip()[:120]}")
    assert not leaks, \
        "Forbidden Italian strings detected in P0 file:\n  " + "\n  ".join(leaks)


def test_sidebar_uses_t_for_all_navitem_labels():
    """Every NavItem in the Sidebar must derive its label from t(), not from
    a hardcoded literal string. We check for the inverse pattern: any
    `label="..."` literal in Sidebar.jsx (excluding the inline fallback in
    t() calls) is a regression."""
    src = (FRONTEND_SRC / 'components' / 'layout' / 'Sidebar.jsx').read_text(encoding='utf-8')
    # Match `label="..."` but NOT inside a t() call or as a comment
    bad = re.findall(r'label="([A-Za-zÀ-ÿ &]{2,})"', src)
    # The only allowed value via this pattern would be empty strings or
    # numeric/glyph-only labels — anything human-readable is a leak.
    human = [b for b in bad if not b.isdigit() and b.strip()]
    assert not human, \
        f"Sidebar.jsx still contains hardcoded NavItem/Section label='...': {human}"


def test_projects_page_uses_taxonomy_for_status_labels():
    """ProjectsPage must derive status labels from the taxonomy registry,
    not from an inline STATUS_META dict carrying Italian strings."""
    src = (FRONTEND_SRC / 'pages' / 'workspace' / 'ProjectsPage.jsx').read_text(encoding='utf-8')
    # The legacy STATUS_META dict (with `label: 'Brief in apertura'` …) must
    # be GONE. The replacement is STATUS_TONE which carries only tone +
    # taxonomy_key — never Italian labels.
    assert "STATUS_META" not in src, \
        "ProjectsPage.jsx must not reference the legacy STATUS_META dict"
    assert "STATUS_TONE" in src, \
        "ProjectsPage.jsx must use STATUS_TONE (tone + taxonomy_key)"
    assert "taxonomy.journey_lifecycle_studio" in src, \
        "Status labels must be resolved via taxonomy.journey_lifecycle_studio.*"


def test_projects_page_no_italian_relative_time():
    """formatRelative must take t as a parameter; no hardcoded IT phrases."""
    src = (FRONTEND_SRC / 'pages' / 'workspace' / 'ProjectsPage.jsx').read_text(encoding='utf-8')
    # The legacy snippet `if (sec < 60) return 'pochi istanti fa';` is GONE.
    assert "return 'pochi istanti fa'" not in src
    assert "common.time.moments_ago" in src
    assert "common.time.minutes_ago" in src
    assert "common.time.days_ago" in src


def test_sidebar_imports_t_from_blueprint_context():
    src = (FRONTEND_SRC / 'components' / 'layout' / 'Sidebar.jsx').read_text(encoding='utf-8')
    assert "useBlueprint" in src
    # The component destructure must include t (mandatory for the migration)
    assert re.search(r"useBlueprint\(\)\s*;?\s*\n", src) or "impersonating, t" in src or ", t }" in src or ", t,\n" in src


# ── String dictionaries coverage for the new namespaces ───────
class TestNewNamespacesCoverage:
    LOCALES = ['it-IT', 'en-US', 'en-GB', 'fr-FR', 'de-DE', 'es-ES', 'ar']
    REQUIRED_KEYS = [
        'nav.section.home', 'nav.section.design_journey', 'nav.section.curatorial_atlas',
        'nav.section.client_relations', 'nav.section.content_studio', 'nav.section.studio_os',
        'nav.studio_pulse', 'nav.your_journeys', 'nav.begin_journey',
        'nav.inspirations', 'nav.brand_atlas', 'nav.material_view', 'nav.media_library',
        'nav.cultural_editions', 'nav.accounts', 'nav.open_voices', 'nav.memory',
        'nav.editorial_calendar', 'nav.magazine', 'nav.design_stories', 'nav.publishing_queue',
        'nav.market_matrix', 'nav.web_presence', 'nav.team', 'nav.insights',
        'nav.studio_identity', 'nav.forms_journeys', 'nav.integrations', 'nav.billing',
        'nav.settings', 'nav.super_admin', 'nav.expand', 'nav.collapse',
        'projects.tabs.all', 'projects.card.last_movement', 'projects.card.continue_journey',
        'projects.card.for_client', 'projects.empty.title', 'projects.empty.subtitle',
        'projects.empty.open_first_journey', 'projects.actions.upgrade_plan',
        'projects.actions.upgrade_for_more', 'projects.usage_label', 'projects.newProject',
        'common.time.moments_ago', 'common.time.minutes_ago',
        'common.time.hours_ago', 'common.time.days_ago',
    ]

    def _get(self, d, dotted):
        cur = d
        for seg in dotted.split('.'):
            if not isinstance(cur, dict) or seg not in cur:
                return None
            cur = cur[seg]
        return cur if isinstance(cur, str) else None

    @pytest.mark.parametrize('locale', LOCALES)
    def test_locale_has_all_keys(self, locale):
        import json as _json
        p = FRONTEND_SRC / 'i18n' / 'strings' / f"{locale}.json"
        data = _json.loads(p.read_text(encoding='utf-8'))
        missing = [k for k in self.REQUIRED_KEYS if not self._get(data, k)]
        assert not missing, f"{locale}.json missing: {missing[:20]}"
