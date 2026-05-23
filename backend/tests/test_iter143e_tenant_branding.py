"""ITER143E · Tenant Email Branding™ + Email Orchestration Expansion regression."""
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


def test_get_branding(root_token):
    r = requests.get(f"{API}/api/tenant/email-branding",
                     headers={'Authorization': f'Bearer {root_token}'}, timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert 'settings' in j
    assert 'editable_fields' in j
    assert 'sender_name' in j['editable_fields']
    assert 'logo_url' in j['editable_fields']
    assert 'privacy_url' in j['editable_fields']


def test_patch_branding_persists(root_token):
    payload = {
        'footer_company_name': 'MOOD Studios S.r.l.',
        'footer_address':      'Via Tortona 27, Milano',
        'privacy_url':         'https://studio.moodfordesign.com/privacy',
        'terms_url':           'https://studio.moodfordesign.com/terms',
        'accent_color':        '#e8c896',
    }
    r = requests.patch(f"{API}/api/tenant/email-branding", json=payload,
                       headers={'Authorization': f'Bearer {root_token}'}, timeout=15)
    assert r.status_code == 200
    s = r.json()['settings']
    assert s.get('footer_company_name') == payload['footer_company_name']
    assert s.get('privacy_url') == payload['privacy_url']
    assert s.get('accent_color') == '#e8c896'


def test_preview_renders(root_token):
    r = requests.post(f"{API}/api/tenant/email-branding/preview",
                      json={'template_key': 'password_reset',
                            'draft': {'sender_name': 'MOOD for DESIGN™',
                                      'primary_color': '#e8c896',
                                      'footer_signature': 'pytest preview'}},
                      headers={'Authorization': f'Bearer {root_token}'}, timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j['subject']
    assert '<html' in j['html']
    assert '#e8c896' in j['html']
    assert 'pytest preview' in j['html']


def test_branding_blocks_non_admin():
    """A regular designer cannot edit the tenant branding."""
    try:
        token = _login('designer@moodfordesign.com', 'Blueprint2024!')
    except Exception:
        pytest.skip('designer account not available')
    r = requests.patch(f"{API}/api/tenant/email-branding",
                       json={'sender_name': 'PWN'},
                       headers={'Authorization': f'Bearer {token}'}, timeout=15)
    assert r.status_code == 403, r.text


# ─── Email orchestration expansion ───────────────────────────────────
def test_search_finds_subject(root_token):
    r = requests.get(f"{API}/api/email/admin/email-events/search?q=Reset&limit=3",
                     headers={'Authorization': f'Bearer {root_token}'}, timeout=15)
    assert r.status_code == 200
    j = r.json()
    if j['count'] > 0:
        assert all('Reset' in (e.get('subject') or '') or 'reset' in (e.get('subject') or '').lower()
                   for e in j['events']), j['events']


def test_provider_health(root_token):
    r = requests.get(f"{API}/api/email/admin/email-provider-health",
                     headers={'Authorization': f'Bearer {root_token}'}, timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert 'providers' in j
    assert 'tenants' in j


def test_webhook_signature_optional_in_dev():
    """When RESEND_WEBHOOK_SECRET is unset the endpoint accepts the
    payload (dev-friendly). When set, unsigned requests return 401.
    Here we just check it accepts a valid JSON payload without crashing."""
    payload = {
        "type": "email.delivered",
        "data": {"email_id": "test-message-id-no-match"}
    }
    r = requests.post(f"{API}/api/email/webhook/resend", json=payload, timeout=15)
    assert r.status_code in (200, 401)
    if r.status_code == 200:
        assert r.json()['ok'] is True


def test_no_supabase_default_email():
    """Sanity: the platform never references the Supabase hosted UI as
    the post-recovery destination."""
    r = requests.post(f"{API}/api/auth/forgot-password",
                      headers={'Host': 'studio.moodfordesign.com',
                               'Content-Type': 'application/json'},
                      json={'email': 'admin@moodfordesign.com'}, timeout=15)
    rd = r.json().get('redirect_to_will_be', '')
    assert '.supabase.co' not in rd
    assert 'blueprint.moodfordesign.com/auth/callback' in rd
