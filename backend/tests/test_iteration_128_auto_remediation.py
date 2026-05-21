"""Iter128 · Automated Localization Remediation Infrastructure.

Locks down the two source-code scripts + protected terms registry that
together drive the auto-remediation pipeline:

  scripts/localization_source_audit.js     · scans JSX for IT leaks
  scripts/localization_auto_remediate.js   · auto-fixes JSX text nodes

Also enforces the empirical post-run state: the registry must have grown
past 400 keys (we landed 256 new keys in this pass), and the audit report
must exist on disk.

Re-running `node scripts/localization_source_audit.js` followed by
`node scripts/localization_auto_remediate.js --apply` must remain idempotent
and not crash the build (verified manually after each pass).
"""
import json
import os
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO / 'backend' / '.env')
load_dotenv(REPO / 'frontend' / '.env')
API = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

AUDIT     = REPO / 'frontend' / 'scripts' / 'localization_source_audit.js'
REMEDIATE = REPO / 'frontend' / 'scripts' / 'localization_auto_remediate.js'
PKG       = REPO / 'frontend' / 'package.json'
REPORT_JS = REPO / 'governance' / 'source-leaks.json'


class TestScripts:
    def test_source_audit_exists(self):
        assert AUDIT.exists()

    def test_auto_remediate_exists(self):
        assert REMEDIATE.exists()

    def test_protected_terms_in_audit(self):
        s = AUDIT.read_text(encoding='utf-8')
        for term in ('Atelier™', 'Design Journey™', 'Moodboard Direction™',
                     'Material Direction™', 'Cultural Editions™',
                     'Studio Pulse™', 'MOOD™', 'Blueprint™'):
            assert term in s, f"protected term {term!r} missing from auditor"

    def test_auto_remediate_skips_local_t(self):
        s = REMEDIATE.read_text(encoding='utf-8')
        assert 'hasLocalT' in s, "remediator must skip files with a local `t` variable"
        assert 'hasNonDestructuredT' in s, "remediator must skip files with `const t = useT()`"

    def test_yarn_scripts_registered(self):
        pkg = json.loads(PKG.read_text(encoding='utf-8'))
        scripts = pkg.get('scripts', {})
        for s in ('localization:source-audit',
                  'localization:auto-remediate',
                  'localization:auto-remediate:apply'):
            assert s in scripts, f"missing yarn script {s}"


class TestReport:
    def test_report_was_generated(self):
        assert REPORT_JS.exists(), "Run `node scripts/localization_source_audit.js` first"
        rep = json.loads(REPORT_JS.read_text(encoding='utf-8'))
        for k in ('total_files_scanned', 'total_leaks', 'by_file', 'protected_terms'):
            assert k in rep

    def test_leak_count_significantly_reduced(self):
        """After iter128 auto-remediation, leak count must be < 250
        (started at 402, expected to land near 150-180 after one full pass)."""
        rep = json.loads(REPORT_JS.read_text(encoding='utf-8'))
        assert rep['total_leaks'] < 250, (
            f"leak count {rep['total_leaks']} did not drop below the iter128 ceiling")


@pytest.mark.skipif(not API, reason="API not configured")
class TestRegistryGrew:
    def test_registry_has_more_keys_than_iter127(self):
        r = requests.post(f"{API}/api/auth/login",
                          json={"email": 'demo@moodfordesign.com',
                                "password": 'Blueprint2024!'}, timeout=15)
        if r.status_code != 200: pytest.skip()
        tok = r.json()['session']['access_token']
        reg = requests.get(f"{API}/api/language/registry?limit=2000",
                           headers={"Authorization": f"Bearer {tok}"}, timeout=20).json()
        # iter127 baseline was 273 keys. iter128 must have added new namespaces.
        assert reg['total'] >= 400, (
            f"registry grew to only {reg['total']} keys; expected ≥ 400 after iter128")

    def test_previously_empty_surfaces_now_have_keys(self):
        r = requests.post(f"{API}/api/auth/login",
                          json={"email": 'demo@moodfordesign.com',
                                "password": 'Blueprint2024!'}, timeout=15)
        if r.status_code != 200: pytest.skip()
        tok = r.json()['session']['access_token']
        reg = requests.get(f"{API}/api/language/registry?limit=2000",
                           headers={"Authorization": f"Bearer {tok}"}, timeout=20).json()
        from collections import Counter
        c = Counter(i['surface'] for i in reg['items'])
        # At least 3 of the previously-zero surfaces must now be populated.
        zero_surfaces_now_populated = sum(
            1 for s in ['Inspirations', 'Editorial Calendar', 'CRM',
                        'Cultural Editions', 'Insights']
            if c.get(s, 0) > 0)
        assert zero_surfaces_now_populated >= 3, (
            f"only {zero_surfaces_now_populated} previously-empty surfaces "
            f"were populated; expected ≥ 3")
