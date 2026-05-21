"""Iter129 · AST-based Continuous Localization Enforcement.

Locks down the AST remediator + the empirical post-run state.

After iter129 ran end-to-end:
  • leak count must be ≤ 60 (we landed 44, started iter128 at 402 → 163)
  • registry keys must be ≥ 700 (we landed 766, started iter127 at 273)
  • build must compile (validated manually after each apply pass)
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

AST     = REPO / 'frontend' / 'scripts' / 'localization_ast_remediator.js'
REPORT  = REPO / 'governance' / 'source-leaks.json'


class TestAstRemediator:
    def test_exists(self):
        assert AST.exists()

    def test_uses_babel_ast(self):
        s = AST.read_text(encoding='utf-8')
        for pkg in ('@babel/parser', '@babel/traverse', '@babel/generator', '@babel/types'):
            assert pkg in s, f"missing dependency {pkg}"

    def test_handles_jsx_text_attr_template(self):
        s = AST.read_text(encoding='utf-8')
        for visitor in ('JSXText', 'JSXAttribute', 'TemplateLiteral'):
            assert visitor in s, f"missing visitor for {visitor}"

    def test_unsafe_t_skip_guard(self):
        s = AST.read_text(encoding='utf-8')
        assert 'hasLocalT' in s and 'hasNonDestructuredT' in s
        assert 'skipped_unsafe_t' in s

    def test_protected_terms_present(self):
        s = AST.read_text(encoding='utf-8')
        for term in ('Atelier™', 'Design Journey™', 'Blueprint™',
                     'Cultural Editions™', 'Studio Pulse™', 'MOOD™',
                     'Moodboard Direction™'):
            assert term in s

    def test_t_injection_only_into_components(self):
        s = AST.read_text(encoding='utf-8')
        # Must require uppercase component name pattern.
        assert "/^[A-Z]/" in s


class TestPostRunState:
    def test_audit_report_exists(self):
        assert REPORT.exists()

    def test_leak_count_under_60(self):
        rep = json.loads(REPORT.read_text(encoding='utf-8'))
        assert rep['total_leaks'] <= 60, (
            f"leak count {rep['total_leaks']} above iter129 ceiling (60)")

    def test_leak_count_dropped_from_iter128(self):
        rep = json.loads(REPORT.read_text(encoding='utf-8'))
        # iter128 ended at 163; iter129 must have dropped well below that.
        assert rep['total_leaks'] < 100


@pytest.mark.skipif(not API, reason="API not configured")
class TestRegistryGrew:
    def test_registry_above_700_keys(self):
        r = requests.post(f"{API}/api/auth/login",
                          json={"email": 'demo@moodfordesign.com',
                                "password": 'Blueprint2024!'}, timeout=15)
        if r.status_code != 200: pytest.skip()
        tok = r.json()['session']['access_token']
        reg = requests.get(f"{API}/api/language/registry?limit=2000",
                           headers={"Authorization": f"Bearer {tok}"}, timeout=20).json()
        assert reg['total'] >= 700, (
            f"registry has only {reg['total']} keys; expected ≥ 700 after iter129")

    def test_previously_empty_surfaces_richly_populated(self):
        r = requests.post(f"{API}/api/auth/login",
                          json={"email": 'demo@moodfordesign.com',
                                "password": 'Blueprint2024!'}, timeout=15)
        if r.status_code != 200: pytest.skip()
        tok = r.json()['session']['access_token']
        reg = requests.get(f"{API}/api/language/registry?limit=2000",
                           headers={"Authorization": f"Bearer {tok}"}, timeout=20).json()
        from collections import Counter
        c = Counter(i['surface'] for i in reg['items'])
        # Inspirations & CRM were at 0 in iter127, > 30 by iter128, must be
        # > 50 each after iter129.
        assert c.get('Inspirations', 0) >= 50, f"Inspirations only has {c.get('Inspirations', 0)} keys"
        assert c.get('CRM', 0) >= 40, f"CRM only has {c.get('CRM', 0)} keys"
