"""Session C — Workspace Genesis™ backend tests.

Tests the onboarding endpoints that turn a wizard payload into a fully populated
workspace (account + lead + assignment + project + moodboard + pages + blocks).
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://i18n-recovery-1.preview.emergentagent.com").rstrip("/")
TENANT_SLUG = "mood-demo-studio-81a09e"


def _uniq_email(tag: str = "priv") -> str:
    return f"TEST_{tag}_{uuid.uuid4().hex[:10]}@example.com"


def _private_payload(email: str, locale="it", **extra):
    return {
        "first_name": "Camilla",
        "last_name": "Rossi",
        "email": email,
        "password": "Blueprint2024!",
        "locale": locale,
        "payload": {
            "space_type": "villa",
            "style": "editorial luxury",
            "mood": "editorial luxury",
            "city": "Roma",
            "moods": ["serene", "warm"],
            "palette": ["#1A1A1A", "#C9A36E", "#EFEBE4"],
            "budget": "50k_100k",
            "timeline": "3-6 months",
            **extra,
        },
    }


@pytest.fixture(scope="session")
def session_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- Team endpoint ---------------------------------------------------------

def test_public_team_returns_three_personas(session_client):
    r = session_client.get(f"{BASE_URL}/api/onboarding/team/{TENANT_SLUG}", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    team = data.get("team") or []
    assert len(team) >= 3, f"expected >=3 personas, got {len(team)}: {team}"
    names = {(m.get("first_name") or "").lower() for m in team}
    for needed in ("elizabeth", "diego", "sofia"):
        assert needed in names, f"missing persona {needed} in {names}"
    sample = next(m for m in team if (m.get("first_name") or "").lower() == "elizabeth")
    assert sample.get("role_label"), "role_label missing"
    assert isinstance(sample.get("languages"), list)
    assert sample.get("online_status")


def test_public_team_unknown_tenant(session_client):
    r = session_client.get(f"{BASE_URL}/api/onboarding/team/does-not-exist-zzz", timeout=15)
    assert r.status_code == 404


# ---- Private submit happy path -------------------------------------------

@pytest.fixture(scope="session")
def submitted_private(session_client):
    """Submit one private client and return the full response for downstream tests."""
    email = _uniq_email("hp")
    body = _private_payload(email, locale="it")
    r = session_client.post(f"{BASE_URL}/api/onboarding/private/submit", json=body, timeout=45)
    assert r.status_code == 201, f"private/submit failed: {r.status_code} {r.text}"
    return {"email": email, "password": body["password"], "response": r.json()}


def test_private_submit_returns_session_user_genesis(submitted_private):
    data = submitted_private["response"]
    assert "session" in data and data["session"].get("access_token")
    assert "user" in data and data["user"].get("id")
    g = data.get("genesis") or {}
    for k in ("project_id", "moodboard_id", "pages", "assigned_to", "narrative"):
        assert k in g, f"missing genesis.{k}"
    assert len(g["pages"]) == 6, f"expected 6 pages, got {len(g['pages'])}"
    assert g["assigned_to"] and g["assigned_to"].get("first_name")
    assert isinstance(g["narrative"], list) and len(g["narrative"]) >= 3


def test_private_submit_pages_locale_it(submitted_private):
    pages = submitted_private["response"]["genesis"]["pages"]
    titles = [p["title"] for p in pages]
    # IT locale
    assert "Visione del progetto" in titles, titles
    assert "Direzione mood" in titles, titles
    assert "Materiali" in titles, titles


def test_private_submit_project_title_humane(submitted_private):
    """Verify title is the humane derived form, not 'Project #xx'."""
    pid = submitted_private["response"]["genesis"]["project_id"]
    token = submitted_private["response"]["session"]["access_token"]
    r = requests.get(f"{BASE_URL}/api/projects/{pid}",
                     headers={"Authorization": f"Bearer {token}"}, timeout=20)
    assert r.status_code == 200, r.text
    proj = r.json()
    title = proj.get("title") or ""
    assert "Camilla" in title, f"client name missing in title: {title}"
    assert "Project #" not in title
    # space + style + city expected
    assert "Villa" in title or "villa" in title.lower()


def test_project_returns_assigned_designer_bag(submitted_private):
    pid = submitted_private["response"]["genesis"]["project_id"]
    token = submitted_private["response"]["session"]["access_token"]
    r = requests.get(f"{BASE_URL}/api/projects/{pid}",
                     headers={"Authorization": f"Bearer {token}"}, timeout=20)
    assert r.status_code == 200, r.text
    proj = r.json()
    ad = proj.get("assigned_designer")
    assert ad, f"assigned_designer missing in {list(proj.keys())}"
    assert ad.get("name") or ad.get("first_name")
    assert "role_label" in ad
    assert "online_status" in ad
    assert "languages" in ad


def test_new_user_token_authenticates(submitted_private):
    """The token from onboarding can call /api/projects/:id and get 200."""
    pid = submitted_private["response"]["genesis"]["project_id"]
    token = submitted_private["response"]["session"]["access_token"]
    r = requests.get(f"{BASE_URL}/api/projects/{pid}",
                     headers={"Authorization": f"Bearer {token}"}, timeout=20)
    assert r.status_code == 200


def test_moodboard_pages_and_seed_blocks(submitted_private):
    mb_id = submitted_private["response"]["genesis"]["moodboard_id"]
    token = submitted_private["response"]["session"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Pages
    rp = requests.get(f"{BASE_URL}/api/moodboards/{mb_id}/pages", headers=headers, timeout=20)
    assert rp.status_code == 200, rp.text
    pages = rp.json() if isinstance(rp.json(), list) else (rp.json().get("pages") or rp.json().get("data") or [])
    assert len(pages) == 6, f"expected 6 pages got {len(pages)}: {pages}"

    # Find Mood page
    mood_titles_it = {"Direzione mood", "Mood Direction"}
    mood_page = next((p for p in pages if (p.get("title") in mood_titles_it)), None)
    assert mood_page, f"mood page not found in {[p.get('title') for p in pages]}"

    # Elements
    re_ = requests.get(f"{BASE_URL}/api/moodboards/{mb_id}/elements",
                       headers=headers, timeout=20)
    if re_.status_code != 200:
        # alt route
        re_ = requests.get(f"{BASE_URL}/api/moodboards/{mb_id}", headers=headers, timeout=20)
    assert re_.status_code == 200, re_.text
    body = re_.json()
    elements = body if isinstance(body, list) else (body.get("elements") or body.get("blocks") or [])
    # normalized response uses 'metadata' rather than 'metadata_json'
    seeded = [e for e in elements if (e.get("metadata") or e.get("metadata_json") or {}).get("seeded")]
    assert len(seeded) >= 2, f"expected seeded blocks, found {len(seeded)} of {len(elements)}"
    kinds = {(e.get("metadata") or e.get("metadata_json") or {}).get("kind") for e in seeded}
    assert "welcome_note" in kinds


# ---- Validation / error paths --------------------------------------------

def test_duplicate_email_returns_409(session_client, submitted_private):
    # Re-submit with same email
    body = _private_payload(submitted_private["email"])
    r = session_client.post(f"{BASE_URL}/api/onboarding/private/submit", json=body, timeout=30)
    assert r.status_code == 409, f"expected 409, got {r.status_code}: {r.text}"


def test_short_password_returns_422(session_client):
    body = _private_payload(_uniq_email("short"))
    body["password"] = "abc"
    r = session_client.post(f"{BASE_URL}/api/onboarding/private/submit", json=body, timeout=20)
    assert r.status_code == 422, r.text


# ---- Locale localization --------------------------------------------------

def test_locale_en_us_pages_and_narrative(session_client):
    body = _private_payload(_uniq_email("en"), locale="en-US")
    r = session_client.post(f"{BASE_URL}/api/onboarding/private/submit", json=body, timeout=45)
    assert r.status_code == 201, r.text
    g = r.json()["genesis"]
    titles = [p["title"] for p in g["pages"]]
    assert "Project Vision" in titles
    assert "Mood Direction" in titles
    # Narrative in English
    assert any("Preparing" in n or "Blueprint is ready" in n for n in g["narrative"])


def test_locale_fr_narrative(session_client):
    body = _private_payload(_uniq_email("fr"), locale="fr")
    r = session_client.post(f"{BASE_URL}/api/onboarding/private/submit", json=body, timeout=45)
    assert r.status_code == 201, r.text
    g = r.json()["genesis"]
    titles = [p["title"] for p in g["pages"]]
    assert "Vision du projet" in titles
    assert any("prépare" in n or "Blueprint" in n for n in g["narrative"])


# ---- Professional submit -------------------------------------------------

def test_professional_submit_creates_ad_partner(session_client):
    email = _uniq_email("pro")
    body = _private_payload(email, locale="it")
    body["payload"]["typology"] = "office"
    r = session_client.post(f"{BASE_URL}/api/onboarding/professional/submit", json=body, timeout=45)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["user"]["role"] == "ad_partner"
    assert len(data["genesis"]["pages"]) == 6


# ---- Round-robin ---------------------------------------------------------

def test_round_robin_cycles_three_personas(session_client):
    """4 consecutive submits should produce a 3-name cycle (with first repeating)."""
    designers = []
    for i in range(4):
        body = _private_payload(_uniq_email(f"rr{i}"))
        r = session_client.post(f"{BASE_URL}/api/onboarding/private/submit", json=body, timeout=45)
        assert r.status_code == 201, r.text
        designers.append(r.json()["genesis"]["assigned_to"]["first_name"])
    # First three must be distinct
    first_three = designers[:3]
    assert len(set(first_three)) == 3, f"expected 3 distinct, got {first_three}"
    # Fourth equals first (cycle)
    assert designers[3] == designers[0], f"round-robin did not cycle: {designers}"



# ---- Iteration 37 re-tests -----------------------------------------------
# Verifies action items from iteration_36: (1) project_type fallback in
# derive_project_title; (2) workspace.followed_by i18n keys in IT + EN.

def test_project_type_synonym_produces_humane_title(session_client):
    """When wizard sends payload.project_type='villa' (no space_type), title
    should still resolve to 'Villa · ... — First' (action item #1)."""
    email = _uniq_email("ptype")
    body = {
        "first_name": "Camilla",
        "last_name": "Rossi",
        "email": email,
        "password": "Blueprint2024!",
        "locale": "it",
        "payload": {
            # Only project_type, NOT space_type/typology
            "project_type": "villa",
            "mood": "editorial luxury",
            "city": "Roma",
        },
    }
    r = session_client.post(f"{BASE_URL}/api/onboarding/private/submit", json=body, timeout=45)
    assert r.status_code == 201, r.text
    title = (r.json().get("genesis") or {}).get("project_title") or ""
    assert "Villa" in title, f"expected 'Villa' segment in title, got: {title!r}"
    assert "Camilla" in title, f"expected client first name in title, got: {title!r}"
    # Sanity: not the fallback
    assert title != "Nuovo progetto \u2014 Camilla", f"still fallback title: {title!r}"


def test_i18n_workspace_followed_by_it(session_client):
    """IT bundle exposes workspace.followed_by = 'Seguito da' (action item #2)."""
    r = session_client.get(f"{BASE_URL}/api/blueprint/i18n/it", timeout=15)
    assert r.status_code == 200, r.text
    msgs = r.json().get("messages") or {}
    assert msgs.get("workspace.followed_by") == "Seguito da", \
        f"got: {msgs.get('workspace.followed_by')!r}"


def test_i18n_workspace_followed_by_en(session_client):
    """EN default bundle exposes workspace.followed_by = 'Followed by' (action item #2)."""
    r = session_client.get(f"{BASE_URL}/api/blueprint/i18n/en", timeout=15)
    assert r.status_code == 200, r.text
    msgs = r.json().get("messages") or {}
    assert msgs.get("workspace.followed_by") == "Followed by", \
        f"got: {msgs.get('workspace.followed_by')!r}"
