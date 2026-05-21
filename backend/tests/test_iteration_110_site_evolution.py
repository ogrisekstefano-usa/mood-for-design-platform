"""Iter110 · Sprint G.8 — Site Evolution™.

Backend (6) + Frontend static (8) + Seed integrity (2).

Direction Lock G.8:
  · NON gallery, NON media manager, NON upload center.
  · Memoria viva della trasformazione fisica dello spazio.
  · Vocabolario documentaristico italiano (sopralluogo, demolizione,
    installazione, momento). NO 'attachment', 'asset', 'upload', 'media item'.
"""
import os
from pathlib import Path
import pytest, requests
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO / 'backend' / '.env')
load_dotenv(REPO / 'frontend' / '.env')

API = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

ROUTER    = REPO / 'backend' / 'routers' / 'site_evolution.py'
SEED      = REPO / 'backend' / 'scripts' / 'seed_demo_journey.py'
SECTION   = REPO / 'frontend' / 'src' / 'components' / 'client' / 'SiteEvolutionSection.jsx'
SIDEBAR   = REPO / 'frontend' / 'src' / 'components' / 'client' / 'ClientSidebar.jsx'
COMPANION = REPO / 'frontend' / 'src' / 'pages' / 'client' / 'ClientCompanionPage.jsx'


@pytest.fixture(scope='module')
def client_token():
    r = requests.post(f"{API}/api/auth/login",
                      json={"email": "client@moodfordesign.com",
                            "password": "Client2024!"}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["session"]["access_token"]


@pytest.fixture(scope='module')
def admin_token():
    r = requests.post(f"{API}/api/auth/login",
                      json={"email": "demo@moodfordesign.com",
                            "password": "Blueprint2024!"}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["session"]["access_token"]


def H(t): return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope='module')
def journey_id(client_token):
    d = requests.get(f"{API}/api/client/journeys",
                     headers=H(client_token), timeout=20).json()
    assert d["zero_data"] is False
    return d["journeys"][0]["journey_id"]


# ── BACKEND ──────────────────────────────────────────────────────
class TestSiteEvolutionEndpoint:
    def test_studio_can_list(self, admin_token, journey_id):
        r = requests.get(f"{API}/api/journeys/{journey_id}/site-evolution",
                         headers=H(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["milestone"] is not None
        assert isinstance(d["entries"], list)
        assert isinstance(d["groups"], list)
        assert "space_labels" in d
        assert "visit_labels" in d

    def test_client_read_returns_grouped_entries(self, client_token, journey_id):
        r = requests.get(f"{API}/api/client/journeys/{journey_id}/site-evolution",
                         headers=H(client_token), timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["available"] is True
        assert len(d["entries"]) >= 8  # seeded
        # Groups must be space-aggregated
        labels = {g["space_label"] for g in d["groups"]}
        for required in ("Living", "Cucina", "Bagno padronale", "Terrazza"):
            assert required in labels

    def test_client_entry_has_required_fields(self, client_token, journey_id):
        d = requests.get(f"{API}/api/client/journeys/{journey_id}/site-evolution",
                         headers=H(client_token), timeout=20).json()
        e = d["entries"][0]
        for k in ("id", "space_key", "space_label", "title", "narrative",
                  "visit_kind", "visit_label", "photos", "occurred_at",
                  "author_role"):
            assert k in e, f"missing field: {k}"

    def test_client_cannot_post(self, client_token, journey_id):
        r = requests.post(f"{API}/api/journeys/{journey_id}/site-evolution",
                          headers=H(client_token),
                          json={"space_key": "living", "title": "test",
                                "narrative": "test narrative"}, timeout=20)
        assert r.status_code == 403

    def test_admin_can_post(self, admin_token, journey_id):
        body = {
            "space_key": "living",
            "title":     "Test installazione · marker per regressione",
            "narrative": "Verifica della creazione di un momento Site Evolution™ via API.",
            "visit_kind": "installation",
            "photos": [{"url": "https://example.com/test.jpg",
                        "caption": "test"}],
        }
        r = requests.post(f"{API}/api/journeys/{journey_id}/site-evolution",
                          headers=H(admin_token), json=body, timeout=20)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["space_label"] == "Living"
        assert d["visit_label"] == "Installazione"
        # Cleanup
        # (No DELETE endpoint — manual cleanup via DB below)
        from supabase import create_client
        import os as _os
        sb = create_client(_os.environ["SUPABASE_URL"],
                           _os.environ["SUPABASE_SERVICE_ROLE_KEY"])
        sb.table("journey_timeline_events").delete().eq("id", d["id"]).execute()

    def test_404_on_unknown_journey(self, admin_token):
        r = requests.get(
            f"{API}/api/journeys/00000000-0000-0000-0000-000000000000/site-evolution",
            headers=H(admin_token), timeout=20)
        assert r.status_code == 404


# ── FRONTEND STATIC ──────────────────────────────────────────────
class TestSiteEvolutionSection:
    def test_component_has_editorial_empty_state(self):
        src = SECTION.read_text()
        assert "Il cantiere non è ancora iniziato" in src
        assert "Quando il tuo studio inizierà a documentare" in src

    def test_component_supports_before_after_slider(self):
        src = SECTION.read_text()
        assert "BeforeAfter" in src
        assert 'before_url && entry.after_url' in src
        assert 'data-testid="se-baf"' in src
        # Slider labels in italian
        assert "Prima" in src
        assert "Stato attuale" in src

    def test_component_groups_by_space(self):
        src = SECTION.read_text()
        assert "Tutti gli spazi" in src
        assert "space_chip" in src or "se-space-chip" in src
        assert "activeSpace" in src

    def test_no_media_manager_vocabulary(self):
        text = SECTION.read_text()
        for bad in ("Asset Manager", "Media Library", "Upload", "Attachment",
                    "File Manager", "Add file", "Drop here",
                    "Image gallery", "Photo album"):
            assert bad not in text, f"forbidden term in SiteEvolutionSection: {bad}"

    def test_companion_mounts_site_evolution_section(self):
        src = COMPANION.read_text()
        assert "SiteEvolutionSection" in src
        assert 'id="cantiere"' in src
        # I18N-02: eyebrow now sourced from tm('siteEvolution') (TM canonical).
        assert ("tm('siteEvolution')" in src or 'eyebrow="Site Evolution™"' in src)
        # Fetched via api.get
        assert "/site-evolution" in src

    def test_sidebar_exposes_site_evolution_section(self):
        src = SIDEBAR.read_text()
        assert "Site Evolution" in src
        assert "anchor: 'cantiere'" in src


class TestSeedHasSiteEvolution:
    def test_seed_script_has_ensure_site_evolution(self):
        src = SEED.read_text()
        assert "ensure_site_evolution" in src
        # Several space keys present
        for sp in ('"living"', '"kitchen"', '"master_bath"', '"terrace"'):
            assert sp in src

    def test_seed_visit_kinds_are_documentary(self):
        src = SEED.read_text()
        for vk in ('"site_visit"', '"demolition"', '"showroom"',
                   '"mockup"', '"delivery"', '"installation"', '"test"'):
            assert vk in src


class TestRouterRegistered:
    def test_router_listed_in_server(self):
        s = (REPO / 'backend' / 'server.py').read_text()
        assert "site_evolution" in s
        assert "site_evolution.router" in s

    def test_router_uses_editorial_italian(self):
        src = ROUTER.read_text()
        for label in ('"Sopralluogo"', '"Demolizione"', '"Arrivo materiali"',
                      '"Installazione"', '"Mockup materiali"', '"Visita showroom"',
                      '"Verifica tecnica"', '"Styling"', '"Momento chiave"'):
            assert label in src, f"missing italian visit label: {label}"
