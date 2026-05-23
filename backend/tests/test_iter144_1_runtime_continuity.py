"""ITER144.1 · Runtime Identity Continuity™ — pytest suite.

Verifies:
  - PATCH /api/tenant/email-branding now mirrors identity fields into
    tenant_configuration.custom_email_identity (single source of truth)
  - resolve_email_identity picks up the mirrored value (source → tenant_runtime)
  - /api/tenant/configuration email_identity reflects the mirror
  - module_guard editorial blocks are seeded (system scope)
  - preview endpoint accepts `locale` parameter
"""
import json
import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
BACKEND = "http://127.0.0.1:8001"
SUPABASE_URL = os.environ["SUPABASE_URL"]
ANON_KEY = os.environ["SUPABASE_ANON_KEY"]


def _login(email, pw):
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        json={"email": email, "password": pw},
        headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def tok_tadmin():
    return _login("demo@moodfordesign.com", "Blueprint2024!")


@pytest.fixture(scope="session")
def tok_root():
    return _login("admin@moodfordesign.com", "Blueprint2024!")


def _call(method, path, token, body=None):
    headers = {"Authorization": f"Bearer {token}"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    return requests.request(
        method, f"{BACKEND}{path}",
        data=json.dumps(body) if body else None,
        headers=headers, timeout=15,
    )


def test_email_branding_patch_mirrors_into_tenant_configuration(tok_tadmin):
    # Patch a tenant-facing branding field.
    r = _call("PATCH", "/api/tenant/email-branding", tok_tadmin, {
        "sender_name": "Atelier Demo",
        "reply_to": "atelier-demo@example.test",
        "footer_signature": "Atelier Demo · Refined atmospheres for refined clients.",
        "legal_footer": "© Atelier Demo · All rights reserved.",
    })
    assert r.status_code == 200

    # Read /api/tenant/configuration and check email_identity surfaced
    # with source `tenant_runtime` after the mirror.
    r2 = _call("GET", "/api/tenant/configuration", tok_tadmin)
    assert r2.status_code == 200
    ident = r2.json()["email_identity"]
    assert ident["source"] == "tenant_runtime", \
        f"expected mirror to promote source, got {ident['source']}"
    assert "Atelier Demo" in (ident["from_address"] or "")
    # cleanup
    _call("PATCH", "/api/tenant/configuration", tok_tadmin,
          {"custom_email_identity": {}})


def test_preview_endpoint_accepts_locale(tok_tadmin):
    r = _call("POST", "/api/tenant/email-branding/preview", tok_tadmin, {
        "template_key": "password_reset",
        "draft": {"sender_name": "Atelier", "logo_url": "x"},
        "locale": "en-US",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["locale"] == "en-US"
    assert body["html"]


def test_module_guard_editorial_blocks_seeded():
    """The system.module_guard namespace must be populated (16 blocks)."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from database import db
    rows = (db().table("editorial_blocks")
            .select("namespace, block_key")
            .like("namespace", "system.module_guard%")
            .execute().data or [])
    assert len(rows) >= 16
    keys = {r["block_key"] for r in rows}
    for must in ("locked.title", "disabled.title", "coming_soon.title",
                 "hidden.title", "beta_restricted.title", "cta.home"):
        assert must in keys, f"missing seed key {must}"
