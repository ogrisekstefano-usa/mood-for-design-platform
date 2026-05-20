"""Iter111 · Sprint G.9 — Certified Closure™ / Journey Archive.

Direction Lock G.9:
  · Il Journey NON "finisce". Viene cristallizzato nella memoria progettuale.
  · NO success screen, NO gamification, NO luxury celebration, NO "project closed".
  · Tono: AD monograph, archivio editoriale, documentazione architettonica.
  · Lingua italiana editoriale.
  · Forbidden labels: "ARCHIVIO FIRMATO" (notarile), "CERTIFIED ARCHIVE" hero.
  · Preferred: "Journey Archive", "Memoria della casa", "Dossier".
  · Shared thoughts nel Dossier sono READ-ONLY (no textarea, no CTA).

Tests:
  · Backend endpoints (certify, dossier, archive index, reopen, RBAC)
  · Brera archived journey is seeded (Appartamento Brera)
  · Italian editorial vocabulary present in router
  · Frontend static guards: DossierSection has correct copy, NO success/celebration
    vocabulary, NO interactive composer in archive mode.
"""
import os
import uuid
from pathlib import Path
import pytest, requests
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO / 'backend' / '.env')
load_dotenv(REPO / 'frontend' / '.env')

API = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

ROUTER       = REPO / 'backend' / 'routers' / 'journey_closure.py'
SEED         = REPO / 'backend' / 'scripts' / 'seed_demo_journey.py'
DOSSIER      = REPO / 'frontend' / 'src' / 'components' / 'client' / 'DossierSection.jsx'
DOSSIER_CSS  = REPO / 'frontend' / 'src' / 'components' / 'client' / 'dossier.css'
CEREMONY     = REPO / 'frontend' / 'src' / 'components' / 'journey' / 'JourneyClosureCeremony.jsx'
COMPANION    = REPO / 'frontend' / 'src' / 'pages' / 'client' / 'ClientCompanionPage.jsx'
INDEX_PAGE   = REPO / 'frontend' / 'src' / 'pages' / 'client' / 'ClientJourneysIndexPage.jsx'
JOURNEY_TAB  = REPO / 'frontend' / 'src' / 'pages' / 'workspace' / 'DesignJourneyTab.jsx'


# ── Fixtures ────────────────────────────────────────────────────
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
def archived_journey_id(client_token):
    """The seeded Appartamento Brera Journey."""
    d = requests.get(f"{API}/api/client/journeys",
                     headers=H(client_token), timeout=20).json()
    assert d["zero_data"] is False
    archived = [j for j in d["journeys"] if j.get("is_archived")]
    assert archived, f"No archived journey for client (got {d['journeys']})"
    # Pick "Brera"
    brera = next((j for j in archived if "Brera" in (j.get("project_title") or "")),
                 archived[0])
    return brera["journey_id"]


# ── BACKEND: archive listing ─────────────────────────────────────
class TestClientJourneyListing:
    def test_journey_listing_marks_archived(self, client_token):
        r = requests.get(f"{API}/api/client/journeys",
                         headers=H(client_token), timeout=20)
        assert r.status_code == 200
        d = r.json()
        # At least one archived
        assert any(j.get("is_archived") for j in d.get("journeys", [])), d
        # Archived journey has the editorial italian label, not a SaaS label
        arc = [j for j in d["journeys"] if j["is_archived"]][0]
        assert arc["lifecycle_label"] in ("Memoria della casa",
                                           "Edizione culturale"), arc
        # NOT "Journey completato" (forbidden by Direction Lock G.9)
        assert "completato" not in (arc["lifecycle_label"] or "").lower()
        assert "completed" not in (arc["lifecycle_label"] or "").lower()


# ── BACKEND: dossier endpoint ───────────────────────────────────
class TestClientDossier:
    def test_client_can_open_dossier(self, client_token, archived_journey_id):
        r = requests.get(
            f"{API}/api/client/journeys/{archived_journey_id}/dossier",
            headers=H(client_token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["available"] is True
        h = d["header"]
        assert h["final_title"]
        assert h["studio_name"]
        # Brera-specific seed value
        assert "Brera" in h["final_title"], h
        # Sober statement, not marketing copy
        assert d["statement"] is not None
        assert len(d["statement"]) > 20

    def test_dossier_includes_chapters_and_visuals(
            self, client_token, archived_journey_id):
        r = requests.get(
            f"{API}/api/client/journeys/{archived_journey_id}/dossier",
            headers=H(client_token), timeout=20)
        d = r.json()
        # Brera seed has 10 milestones, several approved
        assert isinstance(d["key_chapters"], list)
        assert len(d["key_chapters"]) >= 1
        # Editorial shape only
        for ch in d["key_chapters"]:
            assert "title" in ch and "status" in ch
        # progress block
        assert d["progress"]["total_chapters"] >= 1


class TestStudioDossierAndArchive:
    def test_studio_can_open_dossier(self, admin_token, archived_journey_id):
        r = requests.get(f"{API}/api/journeys/{archived_journey_id}/dossier",
                         headers=H(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["available"] is True

    def test_studio_archive_index(self, admin_token):
        r = requests.get(f"{API}/api/journeys/archive",
                         headers=H(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["available"] is True
        # Brera must be in the studio archive
        titles = [j["final_title"] for j in d["journeys"]]
        assert any("Brera" in t for t in titles), titles

    def test_client_archive_index(self, client_token):
        r = requests.get(f"{API}/api/client/journeys/archive",
                         headers=H(client_token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["available"] is True
        # The client owns Brera
        assert any("Brera" in j["final_title"] for j in d["journeys"]), d


# ── BACKEND: certify ceremony round-trip ─────────────────────────
class TestCertifyCeremony:
    """End-to-end: studio certifies a Journey → archive immediately reflects
    it → reopen returns it to in_progress.

    Uses a TEST journey, then reopens it to leave state untouched.
    """
    def _pick_active_journey(self, admin_token):
        # Pick any in_progress journey for the demo tenant
        r = requests.get(f"{API}/api/super/journeys?limit=200",
                         headers=H(admin_token), timeout=20)
        if r.status_code != 200:
            pytest.skip("no super journeys endpoint available")
        rows = r.json().get("journeys") or r.json().get("items") or []
        for j in rows:
            if j.get("overall_status") == "in_progress":
                return j["id"]
        pytest.skip("no in_progress journey available to test round-trip")

    def test_certify_then_reopen_roundtrip(self, admin_token):
        # We bypass discovery and just exercise via the journey_closure router
        # against the LATEST in-progress journey of demo tenant by fetching one.
        import requests as rq
        # Find an active journey directly via the projects list
        r = rq.get(f"{API}/api/projects?limit=100",
                   headers=H(admin_token), timeout=20)
        if r.status_code != 200:
            pytest.skip("projects endpoint unavailable")
        projects = r.json().get("items") or r.json().get("data") or r.json().get("projects") or []
        target_jid = None
        target_pid = None
        for p in projects:
            pid = p.get("id")
            jr = rq.get(f"{API}/api/projects/{pid}/journey",
                        headers=H(admin_token), timeout=20)
            if jr.status_code == 200:
                j = jr.json().get("journey") or {}
                # Make sure NOT the seeded Villa Riviera (avoid disturbing demo)
                # We will pick a journey we are willing to certify+reopen.
                if (j.get("overall_status") == "in_progress" and
                        "Villa Riviera" not in (p.get("title") or "") and
                        "Brera" not in (p.get("title") or "")):
                    target_jid = j["id"]
                    break
        if not target_jid:
            pytest.skip("no candidate journey for round-trip test")

        marker = uuid.uuid4().hex[:8]
        # Certify
        r = rq.post(f"{API}/api/journeys/{target_jid}/certify-closure",
                    headers=H(admin_token), timeout=20,
                    json={"final_title": f"Test Closure {marker}",
                          "statement":   "Dossier di test — questo Journey viene cristallizzato per validare il rituale di chiusura. Verrà subito riaperto.",
                          "cover_url":   None})
        assert r.status_code == 201, r.text
        out = r.json()
        assert out["lifecycle_state"] == "closed"
        assert "Test Closure" in out["final_title"]

        # Dossier reflects ceremony
        rd = rq.get(f"{API}/api/journeys/{target_jid}/dossier",
                    headers=H(admin_token), timeout=20)
        assert rd.status_code == 200, rd.text
        body = rd.json()
        assert body["available"] is True
        assert body["header"]["final_title"] == f"Test Closure {marker}"

        # Reopen to restore state
        rr = rq.post(f"{API}/api/journeys/{target_jid}/reopen",
                     headers=H(admin_token), timeout=20,
                     json={"reason": "Test round-trip teardown"})
        assert rr.status_code == 200, rr.text
        assert rr.json()["lifecycle_state"] == "in_progress"


# ── BACKEND: RBAC ───────────────────────────────────────────────
class TestArchiveRBAC:
    def test_client_cannot_certify(self, client_token, archived_journey_id):
        r = requests.post(
            f"{API}/api/journeys/{archived_journey_id}/certify-closure",
            headers=H(client_token), timeout=20,
            json={"final_title": "Tentativo client",
                  "statement": "Questo tentativo deve fallire con 403."})
        assert r.status_code == 403, r.text

    def test_client_cannot_open_studio_dossier(
            self, client_token, archived_journey_id):
        r = requests.get(f"{API}/api/journeys/{archived_journey_id}/dossier",
                         headers=H(client_token), timeout=20)
        assert r.status_code == 403, r.text


# ── ROUTER STATIC: editorial italian vocabulary ─────────────────
class TestRouterEditorialItalian:
    def test_router_uses_italian_editorial(self):
        s = ROUTER.read_text(encoding='utf-8')
        # Required italian markers
        for marker in [
            "memoria editoriale",
            "Certified Closure™",
            "lifecycle_state",
            "archived",
        ]:
            assert marker in s, f"router missing {marker!r}"

    def test_router_zero_celebratory_vocabulary(self):
        s = ROUTER.read_text(encoding='utf-8').lower()
        for forbidden in [
            "project completed", "completion modal", "success screen",
            "congratulations", "celebration", "gamification",
            "trophy", "award", "champagne",
        ]:
            assert forbidden not in s, f"router contains forbidden {forbidden!r}"


# ── FRONTEND STATIC: DossierSection ─────────────────────────────
class TestDossierFrontend:
    def test_dossier_section_exists(self):
        assert DOSSIER.exists(), DOSSIER

    def test_dossier_uses_editorial_italian(self):
        s = DOSSIER.read_text(encoding='utf-8')
        required = [
            "Journey Archive",
            "Statement di progetto",
            "Memoria depositata",
            "I capitoli attraversati",
            "Trasformazioni dello spazio",
            "Documentazione architettonica",
            "Direzioni condivise",
            "Palette materica",
            "Tracce del cantiere",
            "Pensieri lungo il percorso",
        ]
        for marker in required:
            assert marker in s, f"DossierSection missing {marker!r}"

    def test_dossier_has_no_celebration_or_marketing(self):
        s = DOSSIER.read_text(encoding='utf-8').lower()
        forbidden = [
            "congratulazioni", "successo", "completato", "completed",
            "celebriamo", "trofeo", "premio", "award", "trophy",
            "100%", "well done", "amazing", "incredibile", "wow",
            "share on", "behance", "instagram",
            "archivio firmato", "certified archive", "official closure",
        ]
        for bad in forbidden:
            assert bad not in s, f"DossierSection contains forbidden {bad!r}"

    def test_dossier_preserves_voices_without_composer(self):
        """Pensieri sono read-only nel dossier — no textarea, no CTA."""
        s = DOSSIER.read_text(encoding='utf-8')
        # The block exists
        assert "PreservedVoicesBlock" in s
        # And does NOT mount SharedVoiceComposer
        assert "SharedVoiceComposer" not in s
        # And has no <textarea> in the file
        assert "<textarea" not in s.lower()

    def test_dossier_before_after_uses_documentary_labels(self):
        s = DOSSIER.read_text(encoding='utf-8')
        assert "Prima" in s
        assert "Stato finale" in s
        # NO marketing reveal copy
        assert "wow" not in s.lower()
        assert "incredible" not in s.lower()

    def test_dossier_css_has_attenuated_glow(self):
        s = DOSSIER_CSS.read_text(encoding='utf-8')
        # AD monograph palette: attenuated gold (not #d9b285 bright)
        assert "#b89870" in s, "dossier.css should use attenuated gold #b89870"
        # Archive mode wrapper for slow/calm UI
        assert ".cj-shell.is-archived" in s


# ── FRONTEND STATIC: Companion archive switch ──────────────────
class TestCompanionArchiveMode:
    def test_companion_imports_dossier(self):
        s = COMPANION.read_text(encoding='utf-8')
        assert "DossierSection" in s
        # Archive switch on header.is_archived
        assert "is_archived" in s
        assert "is-archived" in s

    def test_companion_passes_journey_id_to_dossier(self):
        s = COMPANION.read_text(encoding='utf-8')
        assert "DossierSection journeyId={journeyId}" in s

    def test_companion_keeps_existing_active_flow(self):
        """Archived branch is gated; active branch still has SharedVoiceComposer."""
        s = COMPANION.read_text(encoding='utf-8')
        assert "SharedVoiceComposer" in s
        assert "ActiveChapterSection" in s


# ── FRONTEND STATIC: Index page archive section ─────────────────
class TestIndexArchiveSection:
    def test_index_separates_active_from_archived(self):
        s = INDEX_PAGE.read_text(encoding='utf-8')
        assert "is_archived" in s
        # Has a Journey Archive section testid
        assert "client-journeys-archive-section" in s
        assert "Journey Archive" in s
        assert "La memoria della casa" in s

    def test_index_auto_redirect_only_for_single_active(self):
        s = INDEX_PAGE.read_text(encoding='utf-8')
        assert "activeOnly" in s


# ── FRONTEND STATIC: Studio Closure Ceremony ────────────────────
class TestStudioClosureCeremony:
    def test_ceremony_exists_and_wired(self):
        assert CEREMONY.exists()
        s = CEREMONY.read_text(encoding='utf-8')
        assert "certify-closure" in s
        # Sober italian copy, no celebration
        assert "memoria della casa" in s.lower()
        # Strip JSDoc comments to scan only the rendered/code surface
        import re
        code = re.sub(r"/\*[\s\S]*?\*/", "", s)
        code = re.sub(r"//.*", "", code)
        code_l = code.lower()
        # No celebratory vocabulary in code/JSX (comments are fine when they
        # explicitly state what the ceremony is NOT).
        for forbidden in ["congratulazioni", "successo", "🎉",
                          "trophy", "champagne", "wow",
                          "celebriamo", "well done"]:
            assert forbidden not in code_l, f"ceremony has {forbidden}"

    def test_journey_tab_renders_ceremony_for_certified_closure(self):
        s = JOURNEY_TAB.read_text(encoding='utf-8')
        assert "JourneyClosureCeremony" in s
        # Old stub copy "arriveranno nei capitoli successivi" must be gone
        assert "arriveranno nei capitoli successivi" not in s


# ── SEED INTEGRITY: Brera ───────────────────────────────────────
class TestBreraSeed:
    def test_seed_creates_brera_archived_journey(self):
        s = SEED.read_text(encoding='utf-8')
        assert "ensure_archived_journey_brera" in s
        assert 'overall_status":  "archived"' in s
        assert "Appartamento Brera" in s

    def test_seed_includes_dossier_metadata_and_marker(self):
        s = SEED.read_text(encoding='utf-8')
        assert "dossier_metadata" in s
        assert "journey_certified_closure" in s
        # Editorial italian
        assert "luce milanese" in s.lower() or "luce nordica" in s.lower()
