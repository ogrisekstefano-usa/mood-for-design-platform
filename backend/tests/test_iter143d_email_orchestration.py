"""ITER143D · Tenant-Aware Email Orchestration™ regression tests."""
import os
import requests
import pytest

API = os.environ.get('REACT_APP_BACKEND_URL') or 'http://localhost:8001'

ROOT = ('admin@moodfordesign.com', 'Blueprint2024!')


def _login(email, password):
    r = requests.post(f"{API}/api/auth/login",
                      json={'email': email, 'password': password}, timeout=20)
    r.raise_for_status()
    return r.json()['session']['access_token']


@pytest.fixture(scope='module')
def root_token():
    return _login(*ROOT)


# ─── Auth redirect resolver ──────────────────────────────────────────
def test_auth_redirect_resolver_unit():
    import sys
    sys.path.insert(0, '/app/backend')
    from services.auth_redirect import (
        classify_origin, build_callback_url, build_tenant_url,
        resolve_email_context, parse_subdomain,
    )

    assert classify_origin("studio.moodfordesign.com") == 'demo'
    assert classify_origin("blueprint.moodfordesign.com") == 'platform'
    assert classify_origin("www.moodfordesign.com") == 'corporate'
    assert classify_origin("format.moodfordesign.com") == 'tenant'
    assert classify_origin("api.moodfordesign.com") == 'platform'  # reserved
    assert classify_origin("") == 'unknown'

    cb = build_callback_url("studio.moodfordesign.com", "recovery",
                            next_path="/auth/reset-password")
    assert "blueprint.moodfordesign.com/auth/callback" in cb
    assert "origin=studio.moodfordesign.com" in cb
    assert "flow=recovery" in cb

    tu = build_tenant_url("format.moodfordesign.com", "/dashboard")
    assert tu == "https://format.moodfordesign.com/dashboard"

    ctx = resolve_email_context("studio.moodfordesign.com")
    assert ctx['host'] == "studio.moodfordesign.com"
    assert ctx['kind'] == 'demo'
    assert ctx['login_url'].endswith("/auth/login")
    assert ctx['origin_url'].startswith("https://")

    sub, reserved = parse_subdomain("studio.moodfordesign.com")
    assert sub == "studio" and reserved is False
    sub, reserved = parse_subdomain("blueprint.moodfordesign.com")
    assert sub == "blueprint" and reserved is True


# ─── Forgot-password tenant-aware ────────────────────────────────────
def test_forgot_password_tenant_aware_redirect():
    r = requests.post(f"{API}/api/auth/forgot-password",
                      headers={'Host': 'studio.moodfordesign.com',
                               'Content-Type': 'application/json'},
                      json={'email': 'admin@moodfordesign.com'}, timeout=20)
    assert r.status_code == 200
    rd = r.json().get('redirect_to_will_be', '')
    assert 'blueprint.moodfordesign.com/auth/callback' in rd
    assert 'origin=studio.moodfordesign.com' in rd
    assert 'flow=recovery' in rd


def test_forgot_password_different_tenant():
    r = requests.post(f"{API}/api/auth/forgot-password",
                      headers={'Host': 'format.moodfordesign.com',
                               'Content-Type': 'application/json'},
                      json={'email': 'admin@moodfordesign.com'}, timeout=20)
    assert r.status_code == 200
    rd = r.json().get('redirect_to_will_be', '')
    assert 'origin=format.moodfordesign.com' in rd


# ─── Email event audit ───────────────────────────────────────────────
def test_email_events_logged(root_token):
    r = requests.get(f"{API}/api/blueprint-admin/email-events?limit=5",
                     headers={'Authorization': f'Bearer {root_token}'}, timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert isinstance(j['events'], list)
    if j['events']:
        e = j['events'][0]
        # New ITER143D fields present
        assert 'source_domain' in e
        assert 'template_key' in e
        assert 'provider' in e


def test_resend_test_email_endpoint(root_token):
    r = requests.post(f"{API}/api/blueprint-admin/email-events/resend-test",
                      headers={'Authorization': f'Bearer {root_token}',
                               'Content-Type': 'application/json'},
                      json={'to': 'slabreality@gmail.com',
                            'template_key': 'generic',
                            'source_host': 'studio.moodfordesign.com',
                            'context': {'title': 'pytest',
                                        'body': 'ITER143D pytest run'}},
                      timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j['requested'] is True
    # In testing mode Resend accepts only the owner's address; still must be ok
    assert j['ok'] is True, j
    assert j['provider'] in ('resend', 'console')


def test_email_event_detail(root_token):
    r = requests.get(f"{API}/api/blueprint-admin/email-events?limit=1",
                     headers={'Authorization': f'Bearer {root_token}'}, timeout=15)
    events = r.json().get('events') or []
    if not events:
        pytest.skip('no events to fetch')
    eid = events[0]['id']
    r2 = requests.get(f"{API}/api/blueprint-admin/email-events/{eid}",
                      headers={'Authorization': f'Bearer {root_token}'}, timeout=15)
    assert r2.status_code == 200
    assert r2.json()['id'] == eid


# ─── Tenant email settings ───────────────────────────────────────────
def test_studio_tenant_email_settings_exists():
    import sys
    sys.path.insert(0, '/app/backend')
    from database import db
    r = (db().table('tenant_email_settings').select('sender_name, sender_email, '
         'primary_color, footer_signature, provider_type, tenants(slug)')
         .execute().data or [])
    assert r, 'expected at least one tenant_email_settings row'
    slugs = [x.get('tenants', {}).get('slug') for x in r]
    assert 'studio' in slugs


def test_golden_demo_tenant_slug_is_studio():
    import sys
    sys.path.insert(0, '/app/backend')
    from database import db
    r = (db().table('tenants').select('slug, is_demo').eq('is_demo', True)
         .execute().data or [])
    assert r, 'no demo tenant'
    assert any(t['slug'] == 'studio' for t in r), \
        f'demo tenant slug should be "studio" — got {[t["slug"] for t in r]}'


# ─── No-atelier audit ────────────────────────────────────────────────
def test_no_atelier_subdomain_references():
    """No references to atelier.moodfordesign.com anywhere in active source."""
    import subprocess
    res = subprocess.run(
        ['grep', '-r', '-l', '--exclude-dir=__pycache__',
         '--exclude=test_iter143d_email_orchestration.py',
         'atelier.moodfordesign',
         '/app/backend', '/app/frontend/src',
         '/app/supabase/migrations'],
        capture_output=True, text=True,
    )
    leaks = (res.stdout or '').strip()
    assert not leaks, f'atelier.moodfordesign found in:\n{leaks}'
