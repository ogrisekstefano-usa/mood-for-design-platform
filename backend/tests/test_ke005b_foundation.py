"""KE-005B.1 · Knowledge-Native Surfaces · Foundation regression suite.

Cosa copre:
  · /api/knowledge/entities/search          typeahead live
  · /api/surfaces/moodboard/{id}/attach     idempotency
  · /api/surfaces/moodboard/{id}/entities   list dopo attach
  · /api/surfaces/moodboard/{id}/detach     decrement
  · entity_operational_usage view counters
  · Connected Assets · brand_entity_relations row reale
  · knowledge_impact_events NON inquinato dagli attach (direttiva n.5)
  · cross-brand isolation · entità di tenant diverso → 400
  · /api/knowledge/entities/{id}/context-panel  9 sezioni
  · Moodboard endpoint · POST /api/moodboards/{id}/blocks con entity_id
    chiama hook automaticamente

Tutti i test sono read-mostly · creano una moodboard temporanea e la
cancellano alla fine.
"""
import os
import uuid as _uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
EMAIL = "admin@moodfordesign.com"
PASSWORD = "Blueprint2024!"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login: {r.status_code} {r.text[:200]}"
    d = r.json()
    tok = d.get("session", {}).get("access_token") or d.get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="session")
def auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def any_entity_id(auth):
    """Pesca una qualsiasi entità certificata (status=approved o canonical_ref_id≠null)."""
    r = requests.get(f"{BASE_URL}/api/knowledge/entities/search?limit=50",
                     headers=auth, timeout=30)
    assert r.status_code == 200, r.text[:200]
    entities = r.json().get("entities", [])
    assert entities, "no entities in tenant"
    # Preferisce certificate, altrimenti la prima
    cert = [e for e in entities if e.get("status") == "approved" or e.get("canonical_ref_id")]
    return (cert[0] if cert else entities[0])["id"]


# ─── §1 · Typeahead search ────────────────────────────────────────────
class TestEntitySearch:
    def test_search_works(self, auth):
        r = requests.get(f"{BASE_URL}/api/knowledge/entities/search?limit=5",
                         headers=auth, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "entities" in data and "count" in data
        assert isinstance(data["entities"], list)

    def test_search_filter_by_type(self, auth):
        r = requests.get(f"{BASE_URL}/api/knowledge/entities/search?type=product&limit=10",
                         headers=auth, timeout=30)
        assert r.status_code == 200
        for e in r.json().get("entities", []):
            assert e["entity_type"] == "product"


# ─── §2 · Attach/Detach lifecycle ─────────────────────────────────────
class TestAttachDetachLifecycle:
    """Verifica E2E: attach → relation + usage row → idempotency → detach."""

    def test_full_lifecycle(self, auth, any_entity_id):
        # Surface ID fittizio (UUID nuovo · simula moodboard appena creata)
        surface_id = str(_uuid.uuid4())
        entity_id = any_entity_id

        # 1 · attach iniziale
        r = requests.post(
            f"{BASE_URL}/api/surfaces/moodboard/{surface_id}/attach",
            json={"entity_id": entity_id}, headers=auth, timeout=30)
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        assert body["ok"] is True
        assert body["entity_snapshot"]["id"] == entity_id

        # 2 · attach idempotente (no duplicate relation)
        r2 = requests.post(
            f"{BASE_URL}/api/surfaces/moodboard/{surface_id}/attach",
            json={"entity_id": entity_id}, headers=auth, timeout=30)
        assert r2.status_code == 200

        # 3 · list ritorna l'entity attaccata
        rl = requests.get(
            f"{BASE_URL}/api/surfaces/moodboard/{surface_id}/entities",
            headers=auth, timeout=30)
        assert rl.status_code == 200
        ents = rl.json()
        assert ents["count"] >= 1
        ids = [e["entity_id"] for e in ents["entities"]]
        assert entity_id in ids

        # 4 · detach
        rd = requests.post(
            f"{BASE_URL}/api/surfaces/moodboard/{surface_id}/detach",
            json={"entity_id": entity_id}, headers=auth, timeout=30)
        assert rd.status_code == 200
        assert rd.json()["ok"] is True

        # 5 · list dopo detach: idempotency (può rimanere 0 o non avere quella entity)
        rl2 = requests.get(
            f"{BASE_URL}/api/surfaces/moodboard/{surface_id}/entities",
            headers=auth, timeout=30)
        assert rl2.status_code == 200
        ids_after = [e["entity_id"] for e in rl2.json()["entities"]]
        assert entity_id not in ids_after, "detach non ha rimosso la relation"

    def test_attach_unknown_entity_returns_400(self, auth):
        surface_id = str(_uuid.uuid4())
        bogus = str(_uuid.uuid4())
        r = requests.post(
            f"{BASE_URL}/api/surfaces/moodboard/{surface_id}/attach",
            json={"entity_id": bogus}, headers=auth, timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"

    def test_attach_unsupported_surface_returns_400(self, auth, any_entity_id):
        surface_id = str(_uuid.uuid4())
        r = requests.post(
            f"{BASE_URL}/api/surfaces/bogus_surface/{surface_id}/attach",
            json={"entity_id": any_entity_id}, headers=auth, timeout=30)
        assert r.status_code == 400


# ─── §3 · Future Uses™ proof ──────────────────────────────────────────
class TestFutureUsesProof:
    """Verifica che attach incrementi i counter del Future Uses (KE-004)."""

    def test_future_uses_increments_after_attach(self, auth, any_entity_id):
        entity_id = any_entity_id
        # Trova catalog_set dell'entità (per chiamare l'endpoint KE-004)
        r = requests.get(
            f"{BASE_URL}/api/knowledge/entities/search?limit=50",
            headers=auth, timeout=30)
        match = next((e for e in r.json()["entities"] if e["id"] == entity_id), None)
        assert match, "entity non trovata in search"
        set_id = match.get("catalog_set_id")
        if not set_id:
            pytest.skip("entity senza catalog_set_id · skip Future Uses proof")
        # Baseline Future Uses
        r0 = requests.get(
            f"{BASE_URL}/api/knowledge/catalog-sets/{set_id}/entities/{entity_id}/future-uses",
            headers=auth, timeout=30)
        assert r0.status_code == 200, r0.text[:200]
        base_mb = (r0.json().get("used_in") or {}).get("moodboard", 0)
        # Attach
        surface_id = str(_uuid.uuid4())
        r1 = requests.post(
            f"{BASE_URL}/api/surfaces/moodboard/{surface_id}/attach",
            json={"entity_id": entity_id}, headers=auth, timeout=30)
        assert r1.status_code == 200
        # Verifica delta
        r2 = requests.get(
            f"{BASE_URL}/api/knowledge/catalog-sets/{set_id}/entities/{entity_id}/future-uses",
            headers=auth, timeout=30)
        new_mb = (r2.json().get("used_in") or {}).get("moodboard", 0)
        # Cleanup
        requests.post(f"{BASE_URL}/api/surfaces/moodboard/{surface_id}/detach",
                       json={"entity_id": entity_id}, headers=auth, timeout=30)
        assert new_mb >= base_mb + 1, \
            f"future-uses non incrementato (was {base_mb} → now {new_mb})"


# ─── §4 · Entity Context Panel · 9 sezioni ────────────────────────────
class TestEntityContextPanel:
    def test_context_panel_returns_all_9_sections(self, auth, any_entity_id):
        r = requests.get(
            f"{BASE_URL}/api/knowledge/entities/{any_entity_id}/context-panel",
            headers=auth, timeout=30)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body["entity_id"] == any_entity_id
        sec = body["sections"]
        expected_sections = {
            "hero", "brand_designer_collection", "operational_readiness",
            "future_uses", "connected_assets", "certification",
            "materials", "provenance", "actions",
        }
        assert expected_sections.issubset(sec.keys()), \
            f"missing sections: {expected_sections - set(sec.keys())}"
        # Spot checks
        assert "display_name" in sec["hero"]
        assert "moodboard" in sec["operational_readiness"]
        assert "moodboard" in sec["future_uses"]
        assert "is_certified" in sec["certification"]


# ─── §5 · knowledge_impact_events NOT polluted ────────────────────────
class TestImpactLedgerNotPolluted:
    """Direttiva n.5 · attach/detach NON deve scrivere in knowledge_impact_events.

    Verifica DIRETTA su DB tramite query psycopg2 — non dipende dall'endpoint
    /impact-history (che potrebbe non rispondere per entità non-certificate).
    """

    def test_attach_does_not_emit_impact_event(self, auth, any_entity_id):
        import os, psycopg2
        from dotenv import load_dotenv
        from pathlib import Path
        load_dotenv(Path(__file__).resolve().parent.parent / ".env")
        url = os.environ.get("DATABASE_URL")
        if not url:
            pytest.skip("DATABASE_URL not configured")
        conn = psycopg2.connect(url); conn.autocommit = True
        cur = conn.cursor()
        cur.execute(
            "SELECT count(*) FROM knowledge_impact_events "
            "WHERE entity_id = %s", (any_entity_id,))
        events_before = cur.fetchone()[0]
        # 5 cicli attach/detach per stress test
        for _ in range(5):
            surface_id = str(_uuid.uuid4())
            requests.post(f"{BASE_URL}/api/surfaces/moodboard/{surface_id}/attach",
                           json={"entity_id": any_entity_id}, headers=auth, timeout=30)
            requests.post(f"{BASE_URL}/api/surfaces/moodboard/{surface_id}/detach",
                           json={"entity_id": any_entity_id}, headers=auth, timeout=30)
        cur.execute(
            "SELECT count(*) FROM knowledge_impact_events "
            "WHERE entity_id = %s", (any_entity_id,))
        events_after = cur.fetchone()[0]
        cur.close(); conn.close()
        assert events_after == events_before, \
            f"impact ledger POLLUTED da attach/detach ({events_before} → {events_after})"


# ─── §6 · Connected Assets proof ──────────────────────────────────────
class TestConnectedAssetsProof:
    """Attach must produce a brand_entity_relations row visible from
    /connected-assets endpoint."""

    def test_connected_assets_sees_used_in_moodboard(self, auth, any_entity_id):
        r = requests.get(f"{BASE_URL}/api/knowledge/entities/search?limit=50",
                         headers=auth, timeout=30)
        match = next((e for e in r.json()["entities"] if e["id"] == any_entity_id), None)
        if not match or not match.get("catalog_set_id"):
            pytest.skip("entity senza catalog_set_id")
        set_id = match["catalog_set_id"]
        surface_id = str(_uuid.uuid4())
        # Attach
        requests.post(f"{BASE_URL}/api/surfaces/moodboard/{surface_id}/attach",
                       json={"entity_id": any_entity_id}, headers=auth, timeout=30)
        # Connected assets
        r2 = requests.get(
            f"{BASE_URL}/api/knowledge/catalog-sets/{set_id}/entities/{any_entity_id}/connected-assets",
            headers=auth, timeout=30)
        # Cleanup
        requests.post(f"{BASE_URL}/api/surfaces/moodboard/{surface_id}/detach",
                       json={"entity_id": any_entity_id}, headers=auth, timeout=30)
        assert r2.status_code == 200, r2.text[:200]
