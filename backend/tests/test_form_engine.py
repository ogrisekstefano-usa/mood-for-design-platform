"""Backend tests for Blueprint Form Engine (Phase D).

Covers:
- /api/forms/registry (field_types=18, purposes=10, layouts=5, atmospheres=5)
- /api/forms/design-request seed (4 steps, 10 fields, _seed:true)
- /api/forms list
- PUT/duplicate/reset/delete on a custom form
- Unknown field type validation -> 400
- /api/forms/{slug}/submissions
- Public GET /api/forms/public/{tenant}/{form} — published gate, internal stripped
- Public POST submit — validation, lead row insertion for design_request,
  no lead row for concierge purpose
- evaluate_conditional + validate_submission unit-level via API
"""
import os
import re
import uuid
import pytest
import requests
from pathlib import Path


def _load_frontend_env():
    env = Path("/app/frontend/.env")
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL"):
                return line.split("=", 1)[1].strip()
    return ""


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _load_frontend_env()).rstrip("/")
EMAIL = "demo@moodfordesign.com"
PASSWORD = "Blueprint2024!"
TENANT_SLUG = "mood-demo-studio-81a09e"
CUSTOM_SLUG = "content-hub-pro-22"
CONCIERGE_SLUG = "test-concierge-form"


# ── Fixtures ────────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": EMAIL, "password": PASSWORD}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text[:200]}")
    return r.json()["session"]["access_token"]


@pytest.fixture(scope="module")
def H(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module", autouse=True)
def cleanup(H):
    yield
    # Best-effort cleanup of test forms
    for slug in (CUSTOM_SLUG, f"{CUSTOM_SLUG}-copy", CONCIERGE_SLUG):
        try:
            requests.delete(f"{BASE_URL}/api/forms/{slug}", headers=H, timeout=10)
        except Exception:
            pass


# ── Registry ────────────────────────────────────────────────────────────────
def test_form_registry(H):
    r = requests.get(f"{BASE_URL}/api/forms/registry", headers=H, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert len(d["field_types"]) == 18
    assert len(d["purposes"]) == 10
    assert len(d["layouts"]) == 5
    assert len(d["atmospheres"]) == 5
    ftypes = {f["type"] for f in d["field_types"]}
    assert {"short_text", "budget_slider", "style_cards", "consent", "statement"}.issubset(ftypes)


# ── Default seed form ───────────────────────────────────────────────────────
def test_design_request_seed(H):
    r = requests.get(f"{BASE_URL}/api/forms/design-request", headers=H, timeout=15)
    assert r.status_code == 200, r.text
    form = r.json()
    # seed is only emitted when there's no existing record. If a previous
    # session already persisted design-request, fall back to a fresh reset.
    if not form.get("_seed"):
        rr = requests.post(f"{BASE_URL}/api/forms/design-request/reset", headers=H, timeout=15)
        assert rr.status_code == 200
        form = rr.json()
    assert len(form["steps"]) == 4
    total_fields = sum(len(s["fields"]) for s in form["steps"])
    assert total_fields == 10, f"Expected 10 fields, got {total_fields}"
    assert form["purpose"] == "design_request"


# ── List ────────────────────────────────────────────────────────────────────
def test_list_forms(H):
    r = requests.get(f"{BASE_URL}/api/forms", headers=H, timeout=15)
    assert r.status_code == 200
    data = r.json()["data"]
    assert isinstance(data, list)
    # Must include design-request after seed
    requests.post(f"{BASE_URL}/api/forms/design-request/reset", headers=H, timeout=15)
    r = requests.get(f"{BASE_URL}/api/forms", headers=H, timeout=15)
    slugs = {f["slug"] for f in r.json()["data"]}
    assert "design-request" in slugs


# ── PUT custom form ─────────────────────────────────────────────────────────
def test_put_custom_form(H):
    body = {
        "title": {"_default": "Brief", "it": "Richiesta"},
        "purpose": "lead",
        "status": "draft",
        "steps": [
            {"title": {"_default": "Step 1"}, "fields": [
                {"type": "short_text", "key": "first_name", "label": {"_default": "First name"}, "required": True},
                {"type": "email", "key": "email", "label": {"_default": "Email"}, "required": True},
            ]},
        ],
    }
    r = requests.put(f"{BASE_URL}/api/forms/{CUSTOM_SLUG}", headers=H, json=body, timeout=15)
    assert r.status_code == 200, r.text
    saved = r.json()
    assert saved["slug"] == CUSTOM_SLUG
    assert saved["purpose"] == "lead"
    assert saved["title"]["it"] == "Richiesta"
    # GET should return same
    g = requests.get(f"{BASE_URL}/api/forms/{CUSTOM_SLUG}", headers=H, timeout=15).json()
    assert g["slug"] == CUSTOM_SLUG
    assert g["title"]["it"] == "Richiesta"


def test_put_unknown_field_type_rejected(H):
    body = {"steps": [{"title": {"_default": "x"}, "fields": [
        {"type": "alien_field", "key": "x", "label": {"_default": "X"}}
    ]}]}
    r = requests.put(f"{BASE_URL}/api/forms/{CUSTOM_SLUG}", headers=H, json=body, timeout=15)
    assert r.status_code == 400


# ── Duplicate ───────────────────────────────────────────────────────────────
def test_duplicate_form(H):
    r = requests.post(f"{BASE_URL}/api/forms/{CUSTOM_SLUG}/duplicate", headers=H, json={}, timeout=15)
    assert r.status_code == 200, r.text
    clone = r.json()
    assert clone["slug"] == f"{CUSTOM_SLUG}-copy"
    assert clone["status"] == "draft"
    # And visible in list
    listed = {f["slug"] for f in requests.get(f"{BASE_URL}/api/forms", headers=H, timeout=15).json()["data"]}
    assert f"{CUSTOM_SLUG}-copy" in listed


# ── Reset ───────────────────────────────────────────────────────────────────
def test_reset_form(H):
    r = requests.post(f"{BASE_URL}/api/forms/{CUSTOM_SLUG}/reset", headers=H, timeout=15)
    assert r.status_code == 200
    fresh = r.json()
    assert fresh["purpose"] == "design_request"
    assert len(fresh["steps"]) == 4


# ── Submissions list ────────────────────────────────────────────────────────
def test_list_submissions(H):
    r = requests.get(f"{BASE_URL}/api/forms/design-request/submissions", headers=H, timeout=15)
    assert r.status_code == 200
    assert "data" in r.json()


# ── Public form gate ────────────────────────────────────────────────────────
def test_public_form_draft_403(H):
    # Ensure custom is draft
    requests.put(f"{BASE_URL}/api/forms/{CUSTOM_SLUG}", headers=H,
                 json={"status": "draft", "purpose": "lead", "steps": [
                     {"title": {"_default": "S"}, "fields": [
                         {"type": "short_text", "key": "first_name",
                          "label": {"_default": "First name"}, "required": True}
                     ]}
                 ]}, timeout=15)
    r = requests.get(f"{BASE_URL}/api/forms/public/{TENANT_SLUG}/{CUSTOM_SLUG}", timeout=15)
    assert r.status_code == 403


def test_public_form_published_strips_internal(H):
    body = {
        "title": {"_default": "Brief", "it": "Richiesta"},
        "purpose": "lead",
        "status": "published",
        "ai": {"scoring": True, "field_suggestions": True},
        "scoring": {"rules": [{"x": 1}]},
        "integrations": {"crm": "salesforce"},
        "steps": [
            {"title": {"_default": "About you"}, "fields": [
                {"type": "short_text", "key": "first_name", "label": {"_default": "First name"}, "required": True},
                {"type": "short_text", "key": "last_name", "label": {"_default": "Last name"}, "required": False},
                {"type": "email", "key": "email", "label": {"_default": "Email"}, "required": True},
            ]}
        ],
    }
    r = requests.put(f"{BASE_URL}/api/forms/{CUSTOM_SLUG}", headers=H, json=body, timeout=15)
    assert r.status_code == 200, r.text
    # Public NO AUTH
    p = requests.get(f"{BASE_URL}/api/forms/public/{TENANT_SLUG}/{CUSTOM_SLUG}", timeout=15)
    assert p.status_code == 200, p.text
    pub = p.json()
    assert pub["status"] == "published"
    assert pub["title"]["it"] == "Richiesta"
    assert "ai" not in pub
    assert "scoring" not in pub
    assert "integrations" not in pub


def test_public_form_404_unknown_form():
    r = requests.get(f"{BASE_URL}/api/forms/public/{TENANT_SLUG}/__nonexistent__", timeout=15)
    assert r.status_code in (403, 404)


def test_public_form_unknown_tenant():
    r = requests.get(f"{BASE_URL}/api/forms/public/__bad__/design-request", timeout=15)
    assert r.status_code == 404


# ── Public submit — validation ─────────────────────────────────────────────
def test_public_submit_missing_required(H):
    # Custom form is now published with required first_name + email
    r = requests.post(f"{BASE_URL}/api/forms/public/{TENANT_SLUG}/{CUSTOM_SLUG}/submit",
                      json={"answers": {}}, timeout=15)
    assert r.status_code == 422, r.text
    body = r.json()
    detail = body.get("detail", body)
    errs = detail.get("errors") if isinstance(detail, dict) else None
    assert errs and any("required" in e.lower() for e in errs)


def test_public_submit_bad_email(H):
    r = requests.post(f"{BASE_URL}/api/forms/public/{TENANT_SLUG}/{CUSTOM_SLUG}/submit",
                      json={"answers": {"first_name": "Ada", "email": "not-an-email"}}, timeout=15)
    assert r.status_code == 422
    detail = r.json().get("detail", {})
    errs = detail.get("errors") if isinstance(detail, dict) else []
    assert any("email" in e.lower() for e in (errs or []))


# ── Public submit success + lead row ───────────────────────────────────────
def test_public_submit_lead_success(H):
    answers = {
        "first_name": "Ada",
        "last_name":  "Lovelace",
        "email":      f"test+{uuid.uuid4().hex[:8]}@example.com",
        "budget":     250000,
        "project_type": "residential",
    }
    r = requests.post(f"{BASE_URL}/api/forms/public/{TENANT_SLUG}/{CUSTOM_SLUG}/submit",
                      json={"answers": answers}, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "submission_id" in body
    sid = body["submission_id"]

    # Submission visible to authed user
    s = requests.get(f"{BASE_URL}/api/forms/{CUSTOM_SLUG}/submissions", headers=H, timeout=15)
    assert s.status_code == 200
    ids = [row["id"] for row in s.json()["data"]]
    assert sid in ids

    # Lead row should exist (best effort — search by source)
    leads = requests.get(f"{BASE_URL}/api/leads", headers=H, timeout=15)
    if leads.status_code == 200:
        data = leads.json() if isinstance(leads.json(), list) else leads.json().get("data", [])
        sources = [
            (row.get("source") or "") for row in data
            if isinstance(row, dict)
        ]
        assert any(f"form:{CUSTOM_SLUG}" == s for s in sources), \
            f"No lead row with source=form:{CUSTOM_SLUG} found in {sources[:5]}"


# ── Reusability: concierge purpose → no lead row ────────────────────────────
def test_concierge_purpose_no_lead_row(H):
    # Create a concierge form
    body = {
        "title": {"_default": "Concierge"},
        "purpose": "concierge",
        "status": "published",
        "steps": [
            {"title": {"_default": "Hi"}, "fields": [
                {"type": "short_text", "key": "first_name",
                 "label": {"_default": "First name"}, "required": True},
                {"type": "email", "key": "email",
                 "label": {"_default": "Email"}, "required": True},
            ]}
        ],
    }
    r = requests.put(f"{BASE_URL}/api/forms/{CONCIERGE_SLUG}", headers=H, json=body, timeout=15)
    assert r.status_code == 200, r.text

    marker_email = f"concierge+{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{BASE_URL}/api/forms/public/{TENANT_SLUG}/{CONCIERGE_SLUG}/submit",
                      json={"answers": {"first_name": "Bob", "email": marker_email}},
                      timeout=20)
    assert r.status_code == 200, r.text

    # No lead row should have this email
    leads = requests.get(f"{BASE_URL}/api/leads", headers=H, timeout=15)
    if leads.status_code == 200:
        data = leads.json() if isinstance(leads.json(), list) else leads.json().get("data", [])
        emails = [(row.get("email") or "") for row in data if isinstance(row, dict)]
        assert marker_email not in emails, "Concierge purpose must NOT write to leads table"


# ── Delete ─────────────────────────────────────────────────────────────────
def test_delete_form(H):
    r = requests.delete(f"{BASE_URL}/api/forms/{CUSTOM_SLUG}", headers=H, timeout=15)
    assert r.status_code == 200
    listed = {f["slug"] for f in requests.get(f"{BASE_URL}/api/forms", headers=H, timeout=15).json()["data"]}
    assert CUSTOM_SLUG not in listed


# ── Conditional + validation primitives ─────────────────────────────────────
def test_conditional_evaluation():
    # Import directly for unit test
    import sys
    sys.path.insert(0, "/app/backend")
    from core.form_registry import evaluate_conditional, validate_submission

    assert evaluate_conditional({"field": "x", "op": "equals", "value": "a"}, {"x": "a"}) is True
    assert evaluate_conditional({"field": "x", "op": "not_equals", "value": "a"}, {"x": "b"}) is True
    assert evaluate_conditional({"field": "x", "op": "in", "value": ["a", "b"]}, {"x": "a"}) is True
    assert evaluate_conditional({"field": "x", "op": "not_in", "value": ["a", "b"]}, {"x": "c"}) is True
    assert evaluate_conditional({"field": "x", "op": "gt", "value": 5}, {"x": 10}) is True
    assert evaluate_conditional({"field": "x", "op": "lt", "value": 5}, {"x": 3}) is True
    assert evaluate_conditional({"field": "x", "op": "truthy"}, {"x": "yes"}) is True
    assert evaluate_conditional({"field": "x", "op": "truthy"}, {"x": ""}) is False

    form = {"steps": [{"fields": [
        {"type": "short_text", "key": "name", "label": {"_default": "Name"}, "required": True},
        {"type": "email", "key": "email", "label": {"_default": "Email"}, "required": True},
    ]}]}
    errs = validate_submission(form, {})
    assert len(errs) == 2
    errs = validate_submission(form, {"name": "A", "email": "bad"})
    assert any("email" in e.lower() for e in errs)
    errs = validate_submission(form, {"name": "A", "email": "a@b.co"})
    assert errs == []


# ── Section catalog includes form_embed ─────────────────────────────────────
def test_section_catalog_has_form_embed(H):
    r = requests.get(f"{BASE_URL}/api/blueprint/sections/catalog", headers=H, timeout=15)
    assert r.status_code == 200
    secs = r.json()["sections"]
    types = {s["type"] for s in secs}
    assert "form_embed" in types, f"form_embed missing. types={types}"
    fe = next(s for s in secs if s["type"] == "form_embed")
    assert fe.get("category") == "conversion"
    reusable = set(fe.get("reusable_in", []))
    assert {"homepage", "landing", "showcase", "client_portal"}.issubset(reusable)
    # Catalog should now be 11 sections
    assert len(secs) == 11
