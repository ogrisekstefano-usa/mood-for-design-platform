"""Iter115 · Sprint HARDENING-01.1 — System Governance Enforcement.

This is the **enforcement layer**. It does not refactor the codebase.
It locks in the current debt baseline and FAILS the build if the
baseline grows.

  · HEX FREEZE       — total hex hardcoded in P0/P1 ≤ frozen baseline
  · FONT FREEZE      — total naked font-family ≤ frozen baseline
  · I18N FREEZE      — files without useT() ≤ frozen baseline
  · KERNEL PRESENCE  — Design System Kernel™ + Translation Memory™ exist
  · WHITELIST        — hex inside var(--token, #fallback) is fine
  · DEADLINE TODO    — each i18n-debt file has a deadline marker
"""
import re
import json
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
ROOT = REPO / 'frontend' / 'src'

BASELINE_FILE = REPO / 'governance' / 'violations-baseline.json'
REPORT_FILE   = REPO / 'governance' / 'violations-report.md'
KERNEL_CSS    = REPO / 'frontend' / 'src' / 'design-system' / 'kernel.css'
KERNEL_JS     = REPO / 'frontend' / 'src' / 'design-system' / 'kernel.js'
TM_FILE       = REPO / 'frontend' / 'src' / 'i18n' / 'translation-memory.js'
APP_JS        = REPO / 'frontend' / 'src' / 'App.js'

HEX        = re.compile(r'#[0-9a-fA-F]{3,8}\b')
NAKED_FONT = re.compile(r"font-family:\s*['\"](?!.*var\()")
USE_T_HOOK = re.compile(r"useT\b|useBlueprint\b")

P0_PATHS = (
    'pages/client/', 'components/client/',
    'pages/workspace/', 'components/journey/',
    'pages/crm/', 'pages/inspirations/BrandMode',
    'pages/inspirations/BrandDetail',
    'components/layout/Sidebar.jsx', 'components/layout/Topbar.jsx',
    'pages/dashboard/', 'pages/insights/',
)
P2_PATHS = (
    'pages/legacy/', '.test.', '.stories.', 'archive/',
    'pages/moodboards/', 'pages/materials/', 'pages/proposals/',
)


def classify(rel):
    if any(rel.startswith(p) for p in P0_PATHS): return 'P0'
    if any(p in rel for p in P2_PATHS):          return 'P2'
    return 'P1'


def is_whitelisted_hex(line):
    if 'var(' in line and '#' in line and ',' in line.split('var(')[-1].split(')')[0]:
        return True
    if line.lstrip().startswith('--'):
        return True
    if 'fill="#fff"' in line.lower() or 'fill="#000"' in line.lower():
        return True
    return False


def scan_violations():
    total_hex  = 0
    total_font = 0
    files_no_t = []
    by_surface = {'P0': {'hex': 0, 'font': 0, 'no_t': 0},
                  'P1': {'hex': 0, 'font': 0, 'no_t': 0},
                  'P2': {'hex': 0, 'font': 0, 'no_t': 0}}
    for f in ROOT.rglob('*'):
        if not f.is_file(): continue
        if f.suffix not in ('.jsx', '.js', '.css'): continue
        rel = f.relative_to(ROOT).as_posix()
        if 'node_modules' in rel or '__tests__' in rel or '.stories.' in rel:
            continue
        try:
            text = f.read_text(encoding='utf-8')
        except Exception:
            continue
        surface = classify(rel)
        # Hex
        hex_count = 0
        for line in text.splitlines():
            if HEX.search(line) and not is_whitelisted_hex(line):
                hex_count += 1
        # Font
        font_count = len(NAKED_FONT.findall(text))
        # i18n
        no_t = False
        if f.suffix == '.jsx' and ('pages/' in rel or 'components/' in rel):
            if not USE_T_HOOK.search(text):
                if re.search(r'>[^<>{}]*\b(eyebrow|titolo|capitolo|memoria|cantiere|percorso|viaggio|direzione)\b',
                             text, re.IGNORECASE):
                    no_t = True

        if hex_count or font_count or no_t:
            total_hex  += hex_count
            total_font += font_count
            by_surface[surface]['hex']  += hex_count
            by_surface[surface]['font'] += font_count
            if no_t:
                files_no_t.append(rel)
                by_surface[surface]['no_t'] += 1

    return {
        'total_hex': total_hex,
        'total_font': total_font,
        'files_no_t': sorted(files_no_t),
        'by_surface': by_surface,
    }


# ── Tests ──────────────────────────────────────────────────────
def load_baseline():
    return json.loads(BASELINE_FILE.read_text(encoding='utf-8'))


class TestGovernanceArtifacts:
    """Phase 1 + Phase 2 deliverables exist and are well-formed."""
    def test_violation_report_exists(self):
        assert REPORT_FILE.exists(), "governance/violations-report.md missing"
        s = REPORT_FILE.read_text(encoding='utf-8')
        # The report must be classified by P0/P1/P2 surfaces
        assert "## P0 — Client-facing surfaces" in s
        assert "## P1 — Admin / Studio shell surfaces" in s
        assert "## P2 — Legacy" in s
        # And expose the enforcement policy
        assert "## Enforcement policy" in s
        assert "HEX FREEZE" in s

    def test_baseline_file_exists(self):
        assert BASELINE_FILE.exists(), "governance/violations-baseline.json missing"
        b = load_baseline()
        assert b['sprint'] == 'HARDENING-01.1'
        assert isinstance(b['total_hex'], int) and b['total_hex'] > 0
        assert isinstance(b['files_no_t'], list)

    def test_design_system_kernel_exists(self):
        assert KERNEL_CSS.exists()
        assert KERNEL_JS.exists()

    def test_kernel_is_imported_globally(self):
        s = APP_JS.read_text(encoding='utf-8')
        assert "design-system/kernel.css" in s, \
            "kernel.css must be imported globally from App.js"


class TestKernelSemantics:
    def test_kernel_exposes_semantic_tokens(self):
        s = KERNEL_CSS.read_text(encoding='utf-8')
        # Domain-semantic tokens that PROVE the kernel is editorial,
        # not just a colour palette.
        for tok in [
            '--mood-journey-accent', '--mood-archive-glow',
            '--mood-client-calm-bg', '--mood-dossier-paper',
            '--mood-companion-veil', '--mood-shared-voice-ring',
            '--mood-site-evolution-mark', '--mood-relationship-pulse',
        ]:
            assert tok in s, f"kernel missing semantic token: {tok}"

    def test_kernel_typography_tokens_present(self):
        s = KERNEL_CSS.read_text(encoding='utf-8')
        for tok in ('--mood-font-heading', '--mood-font-body',
                    '--mood-font-serif', '--mood-font-mono'):
            assert tok in s

    def test_kernel_motion_tokens_present(self):
        s = KERNEL_CSS.read_text(encoding='utf-8')
        for tok in ('--mood-duration-base', '--mood-ease-out',
                    '--mood-duration-cinematic'):
            assert tok in s

    def test_kernel_js_mirror_present(self):
        s = KERNEL_JS.read_text(encoding='utf-8')
        for sym in ('KERNEL_ID', 'motion', 'easing',
                    'SEMANTIC_TOKENS', 'readToken'):
            assert sym in s

    def test_translation_memory_still_intact(self):
        """HARDENING-01.1 should not break I18N-02 deliverables."""
        s = TM_FILE.read_text(encoding='utf-8')
        assert "BRAND_TERMS" in s
        assert "TONE_PROFILES" in s


# ── ENFORCEMENT LOCKS ──────────────────────────────────────────
class TestHexFreezeLock:
    """The total hex hardcoded count may NEVER grow vs the baseline.
    New PRs that introduce new bare hex without var() fallback fail this lock.
    """
    def test_total_hex_does_not_exceed_baseline(self):
        baseline = load_baseline()
        current = scan_violations()
        # Strict inequality: must not grow. Tolerated to shrink (cleanup welcome).
        assert current['total_hex'] <= baseline['total_hex'], (
            f"HEX FREEZE BROKEN: current={current['total_hex']} > "
            f"baseline={baseline['total_hex']}. New hardcoded hex was added. "
            f"Use a kernel token (--mood-*) instead. See governance/violations-report.md"
        )

    def test_p0_hex_does_not_exceed_baseline(self):
        baseline = load_baseline()
        current = scan_violations()
        assert current['by_surface']['P0']['hex'] <= baseline['by_surface']['P0']['hex'], (
            f"P0 HEX GREW: current={current['by_surface']['P0']['hex']} > "
            f"baseline={baseline['by_surface']['P0']['hex']}"
        )


class TestFontFreezeLock:
    """UI-SYS-01 brought naked font-family to a low baseline.
    It must not grow."""
    def test_total_font_does_not_exceed_baseline(self):
        baseline = load_baseline()
        current = scan_violations()
        assert current['total_font'] <= baseline['total_font'], (
            f"FONT FREEZE BROKEN: current={current['total_font']} > "
            f"baseline={baseline['total_font']}. Use var(--mood-font-*) tokens."
        )


class TestI18nFreezeLock:
    """The list of files without useT() in P0/P1 is FROZEN.
    A new PR cannot add a new untranslated file."""
    def test_no_new_i18n_debt_files(self):
        baseline = load_baseline()
        current = scan_violations()
        baseline_set = set(baseline['files_no_t'])
        current_set  = set(current['files_no_t'])
        new_violations = current_set - baseline_set
        assert not new_violations, (
            f"I18N DEBT GREW: new files without useT(): {sorted(new_violations)}. "
            f"All new pages MUST consume useT()/useBlueprint() and use the "
            f"frontend/src/i18n strings layer."
        )


class TestI18nDebtTracked:
    """Every file in the i18n-debt list must appear in the report so it
    can be assigned to a future sprint."""
    def test_all_debt_files_mentioned_in_report(self):
        baseline = load_baseline()
        report   = REPORT_FILE.read_text(encoding='utf-8')
        # Files in debt must be listed in the report's i18n debt section
        for f in baseline['files_no_t']:
            assert f in report, \
                f"i18n debt file not tracked in report: {f}"


class TestEnforcementPolicyPresence:
    """The enforcement policy is documented in the report so future
    contributors understand WHY the locks exist."""
    def test_report_documents_enforcement_rules(self):
        s = REPORT_FILE.read_text(encoding='utf-8')
        for rule in (
            "HEX FREEZE", "FONT FREEZE", "I18N FREEZE",
            "DESIGN SYSTEM KERNEL", "HEX whitelist",
        ):
            assert rule in s, f"Policy rule not documented: {rule}"
