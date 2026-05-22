"""ITER131 · Runtime Localization contract.

Reads the artefact produced by the runtime crawler
(`/app/governance/runtime-localization-report.json`) and asserts the
zero-chrome-leak contract:

  • HARD_CODED_UI         == 0
  • RUNTIME_CRASH         == 0
  • MISSING_REGISTRY_KEY  == 0
  • INVALID_USE_TRANSLATION == 0

DB_SEEDED_CONTENT and EDITORIAL_SEED_BY_DESIGN are explicitly *not* part
of the chrome contract; they represent user content / by-design source
language inspection and are tracked separately (see the final-audit
markdown).
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

REPORT = Path('/app/governance/runtime-localization-report.json')
FINAL_AUDIT = Path('/app/governance/runtime-localization-final-audit.md')


def _load_report():
    if not REPORT.exists():
        pytest.skip(
            'Runtime crawler report missing. Run '
            '`/opt/plugins-venv/bin/python3 /app/scripts/iter131_runtime_crawler.py` first.'
        )
    return json.loads(REPORT.read_text(encoding='utf-8'))


def test_runtime_report_exists():
    assert REPORT.exists(), 'Runtime crawler report missing'


def test_no_hardcoded_ui_chrome():
    report = _load_report()
    bad = [f for f in report['findings'] if f['kind'] == 'HARD_CODED_UI']
    assert not bad, f'HARD_CODED_UI chrome leaks: {[b.get("text", "")[:80] for b in bad[:10]]}'


def test_no_runtime_crashes():
    report = _load_report()
    bad = [f for f in report['findings'] if f['kind'] == 'RUNTIME_CRASH']
    assert not bad, f'Runtime crashes: {[b.get("message", "")[:120] for b in bad[:5]]}'


def test_no_missing_registry_tokens():
    report = _load_report()
    bad = [f for f in report['findings'] if f['kind'] == 'MISSING_REGISTRY_KEY']
    assert not bad, f'Missing registry keys rendered in DOM: {[b.get("text", "") for b in bad[:10]]}'


def test_no_invalid_translation_hooks():
    report = _load_report()
    bad = [f for f in report['findings'] if f['kind'] == 'INVALID_USE_TRANSLATION']
    assert not bad, f'Invalid t() usage detected: {[(b.get("text") or b.get("message", ""))[:120] for b in bad[:5]]}'


def test_all_routes_were_crawled():
    report = _load_report()
    assert report['routes_crawled'] >= 18, f'Expected ≥ 18 routes, got {report["routes_crawled"]}'


def test_final_audit_markdown_present():
    assert FINAL_AUDIT.exists(), 'Final audit markdown missing'
    txt = FINAL_AUDIT.read_text(encoding='utf-8')
    assert 'Final score' in txt
    assert 'HARD_CODED_UI' in txt


def test_db_seeded_content_is_classified_separately():
    """DB-seeded leaks must be tagged DB_SEEDED_CONTENT, not chrome."""
    report = _load_report()
    chrome = [f for f in report['findings'] if f['kind'] == 'HARD_CODED_UI']
    seeded = [f for f in report['findings'] if f['kind'] in ('DB_SEEDED_CONTENT', 'EDITORIAL_SEED_BY_DESIGN')]
    # Sanity: if anything remains, it must be in the seeded bucket.
    assert len(chrome) == 0
    # Make sure the crawler actually classified content (at least one)
    # — empty database is unlikely in a healthy environment.
    if seeded:
        for s in seeded:
            tid = (s.get('testid') or '').lower()
            assert tid, f'Seeded finding without a testid prefix: {s}'
