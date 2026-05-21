"""ITER130 · Localization Completion™ — Zero Leak / Zero Mixed Language test.

Verifies the post-sprint contract:
  1. governance/source-leaks.json has 0 hardcoded Italian leaks.
  2. en-US.json contains 0 Italian-leaking values (looks_italian heuristic).
  3. en-US.json contains 0 LLM meta-contamination (markdown headers, "I'm
     ready" preambles, etc.).
  4. Backend exposes POST /api/language/batch-translate and accepts payloads.
  5. STRICT_LOCALIZATION_MODE export is present in the engine.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

import pytest

ROOT = Path('/app')
SCRIPTS = ROOT / 'backend' / 'scripts'
sys.path.insert(0, str(ROOT / 'backend'))


def _flatten(o, prefix=''):
    out = {}
    if isinstance(o, dict):
        for k, v in o.items():
            p = f'{prefix}.{k}' if prefix else k
            out.update(_flatten(v, p))
    elif isinstance(o, str):
        out[prefix] = o
    return out


def test_source_leaks_zero():
    """The AST source audit must report zero hardcoded leaks."""
    report = ROOT / 'governance' / 'source-leaks.json'
    assert report.exists(), "source-leaks.json missing — run localization_source_audit.js"
    data = json.loads(report.read_text())
    assert data['total_leaks'] == 0, (
        f"Expected 0 leaks, found {data['total_leaks']} in {list(data['by_file'].keys())}"
    )


def test_en_us_has_no_italian_leaks():
    """No en-US.json value may match the Italian fingerprint."""
    sys.path.insert(0, str(SCRIPTS))
    from scripts.iter130_bulk_translate_en_us import looks_italian  # type: ignore

    en = json.loads((ROOT / 'frontend' / 'src' / 'i18n' / 'strings' / 'en-US.json').read_text())
    flat = _flatten(en)
    leaks = [k for k, v in flat.items() if looks_italian(v)]
    assert not leaks, f"Italian leaks in en-US.json: {leaks[:5]}"


def test_en_us_has_no_meta_contamination():
    """No en-US.json value may carry LLM meta-preambles (markdown headers,
    "I'm ready" lines, divider rules, Source/Target labels)."""
    sys.path.insert(0, str(SCRIPTS))
    from scripts.iter130_sanitize_translations import needs_clean  # type: ignore

    en = json.loads((ROOT / 'frontend' / 'src' / 'i18n' / 'strings' / 'en-US.json').read_text())
    flat = _flatten(en)
    dirty = [(k, v[:120]) for k, v in flat.items() if needs_clean(v)]
    assert not dirty, f"Meta contamination in en-US.json: {dirty[:5]}"


def test_batch_translate_endpoint_registered():
    """The new ITER130 endpoint must be wired into the language router."""
    from routers import language_api  # type: ignore
    paths = {r.path for r in language_api.router.routes}
    assert '/batch-translate' in paths, f"missing /batch-translate · have {paths}"


def test_strict_localization_mode_flag_exists():
    """The frontend engine must export STRICT_LOCALIZATION_MODE so QA can
    rely on it (and so the build can flip it via REACT_APP_STRICT_LOCALIZATION)."""
    engine = (ROOT / 'frontend' / 'src' / 'i18n' / 'engine.js').read_text()
    assert 'export const STRICT_LOCALIZATION_MODE' in engine, (
        "STRICT_LOCALIZATION_MODE export missing from engine.js"
    )
    assert 'REACT_APP_STRICT_LOCALIZATION' in engine, (
        "engine.js must read REACT_APP_STRICT_LOCALIZATION"
    )


def test_iter130_protected_terms_still_intact():
    """The IT→EN translation must NOT have stripped the protected
    editorial trademarks (™ terms) from en-US.json values."""
    en = (ROOT / 'frontend' / 'src' / 'i18n' / 'strings' / 'en-US.json').read_text()
    # A sampling of trademarks that must survive verbatim in editorial copy.
    for term in ('Design Journey', 'Studio Pulse', 'Inspirations'):
        assert term in en, f"protected term '{term}' lost from en-US.json"


def test_strict_mode_pickstring_returns_visible_missing_token(tmp_path):
    """When STRICT_LOCALIZATION_MODE is on, a missing key produces the
    visible ⟦key⟧ token instead of falling back silently. We test this via
    static inspection (since the engine is JS) — the regex must be present."""
    engine = (ROOT / 'frontend' / 'src' / 'i18n' / 'engine.js').read_text()
    assert '`⟦${key}⟧`' in engine, "STRICT mode must emit ⟦key⟧ token"
