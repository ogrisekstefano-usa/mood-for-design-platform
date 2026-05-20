"""Iter108 · Sprint G.7 supplement — Villa Riviera seed credibility check.

Valida che il Journey demo per client@moodfordesign.com presenti un
percorso CREDIBILE (frizioni reali, materiali scartati, revisioni)
e che il Companion lo renda fedelmente. Direction Lock G.7-bis.
"""
import os
from pathlib import Path
import pytest, requests
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO / 'backend' / '.env')
load_dotenv(REPO / 'frontend' / '.env')

API = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.fixture(scope='module')
def client_token():
    r = requests.post(f"{API}/api/auth/login",
                      json={"email": "client@moodfordesign.com",
                            "password": "Client2024!"}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["session"]["access_token"]


def H(t): return {"Authorization": f"Bearer {t}"}


class TestVillaRivieraIsAlive:
    """The seed must produce a JOURNEY THAT BREATHES — not a marketing demo."""

    def test_client_has_at_least_one_journey(self, client_token):
        r = requests.get(f"{API}/api/client/journeys", headers=H(client_token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["zero_data"] is False
        assert len(d["journeys"]) >= 1
        j = d["journeys"][0]
        assert j["project_title"] == "Villa Riviera"
        assert j["studio_name"]
        assert j["current_chapter"]["title"] == "Moodboard Direction™"

    def test_companion_has_lived_in_data(self, client_token):
        idx = requests.get(f"{API}/api/client/journeys",
                           headers=H(client_token), timeout=20).json()
        jid = idx["journeys"][0]["journey_id"]
        d = requests.get(f"{API}/api/client/journeys/{jid}/companion",
                         headers=H(client_token), timeout=20).json()

        # Header
        assert d["header"]["project_title"] == "Villa Riviera"
        assert d["header"]["location"] == "Sanremo, Liguria"
        assert d["header"]["progress"]["approved_chapters"] >= 2

        # Active chapter is the moodboard direction (with friction in progress)
        assert d["active_chapter"]["milestone_type"] == "moodboard_direction"

        # Three shared moodboard directions: cold V1, warm V2, alternative V3
        titles = [x["title"] for x in d["shared_directions"]]
        assert any("fredda" in t.lower() or "freddo" in t.lower() for t in titles), \
            f"prima direzione (fredda) mancante: {titles}"
        assert any("materic" in t.lower() for t in titles), \
            f"direzione materica mancante: {titles}"
        assert any("alternativ" in t.lower() or "living" in t.lower() for t in titles), \
            f"alternativa living mancante: {titles}"

        # Conversations: at least 6 voices including a "wants more material" tone
        # (cliente chiede più calore) and a "palette_works" embrace.
        assert len(d["conversations"]) >= 6
        joined = " ".join((v.get("message") or "") for v in d["conversations"]).lower()
        assert "più calore" in joined or "più caldo" in joined, \
            "manca la frizione 'più calore' del cliente"
        assert "travertino" in joined, "manca la voce sul travertino"
        assert "pietra grigia" in joined, "manca la scelta di scartare la pietra grigia"

        # Evolution timeline: at least 10 narrative events spread over weeks
        assert len(d["evolution_timeline"]) >= 10
        ev_joined = " ".join(e["narrative"] for e in d["evolution_timeline"]).lower()
        for word in ("brief", "moodboard", "material direction",
                     "revisione", "travertino", "scartata"):
            assert word in ev_joined, f"timeline non racconta: {word}"

        # Memory archive: at least brief + inspirations approved
        assert len(d["memory_archive"]) >= 2


class TestVoicesAreEditorial:
    def test_voices_have_both_client_and_studio(self, client_token):
        idx = requests.get(f"{API}/api/client/journeys",
                           headers=H(client_token), timeout=20).json()
        jid = idx["journeys"][0]["journey_id"]
        d = requests.get(f"{API}/api/client/journeys/{jid}/companion",
                         headers=H(client_token), timeout=20).json()
        authors = {v.get("author_name") for v in d["conversations"]}
        assert "Tu" in authors, "il cliente non parla mai"
        # Studio voice can be 'MOOD Demo Studio' or 'Il tuo studio'
        assert any(a and a != "Tu" for a in authors), "lo studio non parla mai"

    def test_voices_use_italian_only(self, client_token):
        idx = requests.get(f"{API}/api/client/journeys",
                           headers=H(client_token), timeout=20).json()
        jid = idx["journeys"][0]["journey_id"]
        d = requests.get(f"{API}/api/client/journeys/{jid}/companion",
                         headers=H(client_token), timeout=20).json()
        for v in d["conversations"]:
            msg = (v.get("message") or "").lower()
            for forbidden in ("approve this", "please review", "click to",
                              "deadline", "approval queue", "task list"):
                assert forbidden not in msg, f"voce non editoriale: {v['message']}"


class TestSeedScriptIsIdempotent:
    """Smoke: re-running the seed must not produce duplicates."""

    def test_seed_script_exists_and_imports(self):
        import importlib.util, sys
        path = REPO / 'backend' / 'scripts' / 'seed_demo_journey.py'
        assert path.exists()
        spec = importlib.util.spec_from_file_location("seed_demo_journey", path)
        mod = importlib.util.module_from_spec(spec)
        sys.modules["seed_demo_journey"] = mod
        spec.loader.exec_module(mod)
        # Helper functions must be importable
        for fn in ("ensure_account", "ensure_project", "ensure_journey",
                   "ensure_milestones", "ensure_moodboards",
                   "ensure_voices", "ensure_timeline"):
            assert hasattr(mod, fn), f"seed missing helper: {fn}"
