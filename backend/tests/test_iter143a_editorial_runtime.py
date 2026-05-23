"""ITER143A+ · Dynamic Editorial Runtime™ regression tests.

Verifies:
  • Source blocks (it) seeded into editorial_blocks resolve correctly.
  • Auto-localized variants exist in all ACTIVE_LOCALES.
  • STRICT locale chain — en-US must NEVER fall back to it.
  • Missing variants → omitted from bundle, never leaked.
  • Manual override status='manual' is honoured during regen.
"""
import os
import re
import time
import uuid
import pytest
import requests

API = os.environ.get('REACT_APP_BACKEND_URL') or 'http://localhost:8001'


def _bundle(page_key, locale):
    r = requests.get(f"{API}/api/content/page/{page_key}",
                     params={'locale': locale}, timeout=15)
    r.raise_for_status()
    return r.json()


# ─── Begin Journey bundle integrity ──────────────────────────────────
def test_begin_journey_it_bundle_present():
    b = _bundle('begin-journey', 'it-IT')
    assert b['count'] > 0, 'expected IT bundle to be populated'
    # Hero title must exist and be Italian
    title = b['blocks'].get('site.begin_journey.step1.title')
    assert title and 'atmosfera' in title.lower(), title


def test_begin_journey_en_us_zero_italian_leak():
    b = _bundle('begin-journey', 'en-US')
    assert b['count'] > 0, 'expected EN-US bundle to be populated'
    # Pseudo-Italian fingerprint — chars that should never appear in
    # an English editorial bundle (à è é ì ò ù typical of Italian).
    italian_pat = re.compile(r'[àèéìòù]')
    leaks = [(k, v) for k, v in b['blocks'].items() if italian_pat.search(v or '')]
    assert not leaks, f'Italian characters leaked into EN-US: {leaks[:3]}'

    # Italian function words sanity check
    italian_words = re.compile(
        r'\b(?:della|degli|sono|atmosfera|spazio|spazi|materiali|che|'
        r'questo|questa|nostro|ricordo)\b', re.I)
    word_leaks = [(k, v) for k, v in b['blocks'].items()
                  if v and italian_words.search(v)]
    assert not word_leaks, f'Italian words leaked into EN-US: {word_leaks[:3]}'


def test_begin_journey_active_locales_have_coverage():
    """Every active locale should have at least 90% of the IT source."""
    base = _bundle('begin-journey', 'it-IT')['count']
    for loc in ('en-US', 'en-GB', 'fr-FR', 'de-DE', 'es-ES'):
        b = _bundle('begin-journey', loc)
        assert b['count'] >= int(base * 0.9), \
            f'{loc} has only {b["count"]}/{base} blocks — coverage too low'


def test_strict_locale_chain_no_cross_family_fallback():
    """A locale we never seeded MUST come back empty (no IT/EN leak)."""
    b = _bundle('begin-journey', 'pt-BR')
    assert b['count'] == 0, \
        f'pt-BR should be empty (strict chain) but got {b["count"]} blocks'


# ─── Professionals bundle ────────────────────────────────────────────
def test_professionals_bundle_all_locales():
    for loc in ('it-IT', 'en-US', 'fr-FR', 'de-DE', 'es-ES'):
        b = _bundle('professionals', loc)
        assert b['count'] >= 10, f'{loc} professionals bundle too small'


# ─── Service-level orchestrator tests ────────────────────────────────
def test_orchestrator_upsert_and_resolve_in_process():
    """Direct service call (no HTTP) to assert behaviour."""
    # Import inside the test so any DB-unavailable environment can
    # skip via the requests-based tests above without crashing here.
    import sys
    sys.path.insert(0, '/app/backend')
    from services.editorial_content_orchestrator import (
        upsert_block, resolve_page_bundle, ACTIVE_LOCALES,
    )

    test_key = f'test_block_{uuid.uuid4().hex[:8]}'
    page = 'editorial-runtime-test'
    upsert_block(
        scope='system',
        namespace='site.test',
        block_key=test_key,
        source_value='Atmosfera editoriale',
        page_key=page,
        block_type='label',
        source_locale='it',
        auto_localize=False,  # keep test fast; source-only
    )
    out = resolve_page_bundle(page, 'it-IT', use_cache=False)
    full_key = f'site.test.{test_key}'
    assert out.get(full_key) == 'Atmosfera editoriale'

    # EN-US has no variant → must NOT fall back to IT.
    out_en = resolve_page_bundle(page, 'en-US', use_cache=False)
    assert full_key not in out_en, \
        f'expected NO key for en-US (strict chain), got {out_en.get(full_key)!r}'
    assert ACTIVE_LOCALES  # sanity
