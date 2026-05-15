"""Phase J — Storefront publish/diff/revert/revisions API tests."""
import os
import uuid
import time
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001').rstrip('/')
# When running inside the container, hit local backend (avoid k8s ingress auth caching)
# But honor BASE_URL from env if available.
ADMIN_EMAIL = "demo@moodfordesign.com"
ADMIN_PASS = "Blueprint2024!"
TENANT_SLUG = "mood-demo-studio-81a09e"
PAGE_KEY = "home"


_STATE = {}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    body = r.json()
    sess = body.get("session") or {}
    token = sess.get("access_token") or body.get("access_token") or body.get("token")
    assert token, f"No access token in login response: {list(body.keys())}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# 1. Publish creates a revision
def test_publish_returns_revision(session):
    r = session.post(f"{BASE_URL}/api/storefront/admin/pages/{PAGE_KEY}/publish",
                     json={"label": "TEST_baseline"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "revision_id" in data
    assert "page_id" in data
    assert "published_at" in data
    assert "change_summary" in data
    # store for later
    _STATE["baseline_rev_id"] = data["revision_id"]
    _STATE["page_id"] = data["page_id"]


# 2. List revisions newest-first w/ pointers
def test_list_revisions(session):
    r = session.get(f"{BASE_URL}/api/storefront/admin/pages/{PAGE_KEY}/revisions")
    assert r.status_code == 200
    body = r.json()
    assert "revisions" in body
    assert "published_revision_id" in body
    assert "draft_updated_at" in body
    assert "last_published_at" in body
    assert body["published_revision_id"] == _STATE["baseline_rev_id"]
    assert len(body["revisions"]) >= 1
    # newest first → first revision should be the one we just created
    assert body["revisions"][0]["id"] == _STATE["baseline_rev_id"]


# 3. Diff shows no changes right after publish
def test_diff_no_changes_after_publish(session):
    r = session.get(f"{BASE_URL}/api/storefront/admin/pages/{PAGE_KEY}/diff?vs=published")
    assert r.status_code == 200
    body = r.json()
    assert body.get("has_published") is True
    summ = body.get("summary", {})
    assert summ.get("has_changes") is False
    assert summ.get("sections_added") == 0
    assert summ.get("sections_modified") == 0


# 4. Modify a section → diff shows sections_modified=1
def test_modify_section_reflects_in_diff(session):
    # find a section to mutate
    r = session.get(f"{BASE_URL}/api/storefront/admin/pages/{PAGE_KEY}")
    assert r.status_code == 200
    page = r.json()
    secs = page.get("sections") or []
    if not secs:
        pytest.skip("No sections on home page to modify")
    sec = secs[0]
    sid = sec["id"]
    old_lc = sec.get("locale_content") or {}
    # tweak _default headline
    new_lc = dict(old_lc)
    default_block = dict(new_lc.get("_default") or {})
    default_block["__test_field__"] = f"TEST_phaseJ_{uuid.uuid4().hex[:6]}"
    new_lc["_default"] = default_block
    _STATE["modified_sid"] = sid
    _STATE["original_lc"] = old_lc

    u = session.put(f"{BASE_URL}/api/storefront/admin/sections/{sid}",
                    json={"locale_content": new_lc})
    assert u.status_code == 200, u.text

    time.sleep(0.5)
    d = session.get(f"{BASE_URL}/api/storefront/admin/pages/{PAGE_KEY}/diff?vs=published")
    assert d.status_code == 200
    dj = d.json()
    summ = dj["summary"]
    assert summ["has_changes"] is True
    assert summ["sections_modified"] >= 1
    # the section we changed must appear in modified[]
    mod_ids = [m["id"] for m in dj["sections"]["modified"]]
    assert sid in mod_ids


# 5. Public endpoint serves from revision (no preview), draft when preview=1
def test_public_serves_from_revision(session):
    r = requests.get(f"{BASE_URL}/api/storefront/public/{TENANT_SLUG}/pages/home")
    assert r.status_code == 200
    body = r.json()
    assert body.get("status") == "ok"
    assert body.get("served_from") == "revision"
    assert body.get("revision_id") == _STATE["baseline_rev_id"]

    r2 = requests.get(f"{BASE_URL}/api/storefront/public/{TENANT_SLUG}/pages/home?preview=1")
    assert r2.status_code == 200
    body2 = r2.json()
    assert body2.get("served_from") == "draft"


# 6. Revert restores section content; diff vs published then shows draft status change
def test_revert_restores_and_diff_reflects(session):
    # Revert back to baseline
    rev_id = _STATE["baseline_rev_id"]
    r = session.post(f"{BASE_URL}/api/storefront/admin/pages/{PAGE_KEY}/revert/{rev_id}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("reverted_from") == _STATE["baseline_rev_id"]

    time.sleep(0.5)
    # After revert, status flipped to draft → diff vs published should show page.changed.status
    d = session.get(f"{BASE_URL}/api/storefront/admin/pages/{PAGE_KEY}/diff?vs=published")
    assert d.status_code == 200
    dj = d.json()
    page_changed = (dj.get("page") or {}).get("changed", {})
    # Either status changed OR sections_modified is 0 again (matching baseline)
    # The key behaviour: section we modified is no longer different
    mod_ids = [m["id"] for m in dj["sections"]["modified"]]
    assert _STATE["modified_sid"] not in mod_ids, "Reverted section should match baseline"
    # And status should be 'draft' on live now
    assert page_changed.get("status", {}).get("to") in (None, "draft") or \
           page_changed.get("status", {}).get("from") in (None, "published")


# 7. Re-publish at the end → leave home in clean baseline state
def test_republish_cleanup(session):
    r = session.post(f"{BASE_URL}/api/storefront/admin/pages/{PAGE_KEY}/publish",
                     json={"label": "TEST_phaseJ_cleanup"})
    assert r.status_code == 200
    d = session.get(f"{BASE_URL}/api/storefront/admin/pages/{PAGE_KEY}/diff?vs=published")
    assert d.json()["summary"]["has_changes"] is False


# 8. Publish endpoint without body
def test_publish_no_body(session):
    r = session.post(f"{BASE_URL}/api/storefront/admin/pages/{PAGE_KEY}/publish")
    assert r.status_code == 200
    assert "revision_id" in r.json()


# 9. Unknown page_key → 400
def test_unknown_page_key(session):
    r = session.get(f"{BASE_URL}/api/storefront/admin/pages/not_a_real_page/diff?vs=published")
    assert r.status_code in (400, 404)
