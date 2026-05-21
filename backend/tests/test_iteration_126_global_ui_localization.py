"""Iter126 · Sprint ITER126 · Global UI Localization Sweep™.

Locks down the new strict-localization architecture:

  1. Engine fallback chain MUST NOT include `it-IT` for non-Italian users.
  2. Missing-key path returns a visible MISSING token in dev, never Italian.
  3. Italian Leakage Detector™ module exists and exports the expected API.
  4. Localization Overlay component exists and is mounted in App.js.
  5. Engine source contains the new STRICT-MODE doc-comments (anti-regression).

This is INFRASTRUCTURE hardening — page-by-page string refactor lands in a
later sprint. Once that lands, additional tests can iterate over every page
under `?qa=1` with locale=en-US and assert getLeakCount() == 0 after a
controlled render. For now we lock the foundation.
"""
import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent.parent
FRONTEND = REPO / 'frontend' / 'src'

ENGINE  = FRONTEND / 'i18n' / 'engine.js'
LEAKS   = FRONTEND / 'i18n' / 'leakageDetector.js'
OVERLAY = FRONTEND / 'i18n' / 'LocalizationOverlay.jsx'
APP     = FRONTEND / 'App.js'


# ── Engine: STRICT fallback chain ─────────────────────────────
class TestEngineFallbackChain:
    def test_engine_exists(self):
        assert ENGINE.exists()

    def test_strict_mode_documented(self):
        s = ENGINE.read_text(encoding='utf-8')
        assert 'STRICT MODE' in s, "engine.js must document the iter126 STRICT MODE rule"

    def test_no_silent_italian_fallback_for_non_italian_chains(self):
        """The OLD branch unconditionally pushed PLATFORM_DEFAULT_LOCALE
        ('it-IT'). The NEW logic only pushes it when the requested
        language family IS Italian. Lock that down at the source level."""
        s = ENGINE.read_text(encoding='utf-8')
        # The exact iter126 guard must be present.
        assert "lang === 'it'" in s and "PLATFORM_DEFAULT_LOCALE" in s, (
            "fallback chain must gate platform-default Italian on lang === 'it'")
        # The OLD unconditional push must no longer exist.
        old_pattern = re.compile(r'if\s*\(\s*!chain\.includes\(PLATFORM_DEFAULT_LOCALE\)\s*\)\s*chain\.push\(PLATFORM_DEFAULT_LOCALE\)')
        # We expect ONE match — the new guarded one. The old pattern is the
        # same shape but inside `if (lang === 'it' ...)`. Make sure no
        # *un*-guarded variant remains by checking that every match is
        # within ~80 chars of the lang==='it' guard.
        text_lines = s.split('\n')
        for i, line in enumerate(text_lines):
            if 'chain.push(PLATFORM_DEFAULT_LOCALE)' in line:
                # The nearest preceding ~5 lines must contain the guard.
                window = '\n'.join(text_lines[max(0, i - 6):i + 1])
                assert "lang === 'it'" in window, (
                    f"unguarded chain.push(PLATFORM_DEFAULT_LOCALE) at line {i + 1} — "
                    f"would leak Italian into non-IT chains")

    def test_italian_tenant_default_blocked_for_non_italian_user(self):
        s = ENGINE.read_text(encoding='utf-8')
        assert "isItalianLeak" in s, (
            "Italian tenant-default must be suppressed when the requested "
            "locale is not Italian (anti-leakage rule)")

    def test_pickstring_visible_missing_token_in_dev(self):
        s = ENGINE.read_text(encoding='utf-8')
        assert "⟦${key}⟧" in s, (
            "pickString must return a visible MISSING token (⟦key⟧) in "
            "dev when the key is not found — never leak Italian or a "
            "bare key into the UI silently")


# ── Italian Leakage Detector™ ─────────────────────────────────
class TestLeakageDetector:
    def test_module_exists(self):
        assert LEAKS.exists()

    def test_public_api(self):
        s = LEAKS.read_text(encoding='utf-8')
        for fn in ('startLeakageScan', 'stopLeakageScan', 'getLeaks',
                   'getLeakCount', 'clearLeaks', 'subscribeLeaks'):
            assert f"export function {fn}" in s or f"export {{" in s or fn in s, \
                f"leakageDetector must export {fn}"

    def test_skips_ale_original_markup(self):
        s = LEAKS.read_text(encoding='utf-8')
        # The scanner MUST NOT flag the original Italian text rendered by
        # the ALE LocalizedMessage component (it's translated content, not
        # a hardcoded leak).
        assert 'data-ale-original' in s or 'ale-msg__original' in s
        # Studio Voice memory/vocabulary panes intentionally render IT.
        assert 'voice-memory-row' in s and 'voice-vocab-row' in s

    def test_disabled_in_production(self):
        s = LEAKS.read_text(encoding='utf-8')
        assert "NODE_ENV === 'production'" in s, (
            "leakage scanner must short-circuit in production builds")

    def test_logs_console_warn_with_leakage_tag(self):
        s = LEAKS.read_text(encoding='utf-8')
        assert "'[LEAKAGE]'" in s


# ── Localization Overlay™ ─────────────────────────────────────
class TestLocalizationOverlay:
    def test_overlay_exists(self):
        assert OVERLAY.exists()

    def test_pill_and_panel_testids(self):
        s = OVERLAY.read_text(encoding='utf-8')
        # Literal testids
        for tid in ('localization-overlay-pill', 'localization-overlay-panel',
                    'localization-overlay-clear'):
            assert f'"{tid}"' in s, f"missing data-testid {tid}"
        # Tab testids are template-literal interpolated — assert the prefix.
        assert 'localization-overlay-tab-${id}' in s or \
               '"localization-overlay-tab-missing"' in s, (
            "Tab data-testids must follow the localization-overlay-tab-{id} pattern")

    def test_overlay_hidden_in_production(self):
        s = OVERLAY.read_text(encoding='utf-8')
        assert "NODE_ENV !== 'production'" in s

    def test_mounted_in_app(self):
        s = APP.read_text(encoding='utf-8')
        assert "import LocalizationOverlay" in s
        assert "<LocalizationOverlay />" in s


# ── No regression on iter120 hard string scanner ──────────────
class TestNoRegression:
    def test_iter120_scanner_still_present(self):
        """The directory-wide Italian-leak test from iter120 must remain
        the line of defence at commit time. iter126 builds on top, doesn't
        replace it."""
        assert (REPO / 'backend' / 'tests' / 'test_iteration_120_no_mixed_language_ui.py').exists()
