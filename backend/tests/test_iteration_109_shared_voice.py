"""Iter109 · Sprint G.7-ter — Shared Voice™.

Backend POST endpoint + Direction Lock + Frontend static scan.

Direction Lock G.7-ter:
  · Una VOCE, non un commento.
  · NO chat / thread / mentions / replies / emoji picker / typing
  · NO "Add comment" CTA. Solo gesti editoriali in italiano.
  · Vive in milestone_feedback (kind=free_voice) e in journey_timeline_events.
"""
import os
from pathlib import Path
import pytest, requests
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO / 'backend' / '.env')
load_dotenv(REPO / 'frontend' / '.env')

API = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

COMPOSER  = REPO / 'frontend' / 'src' / 'components' / 'client' / 'SharedVoiceComposer.jsx'
COMPANION = REPO / 'frontend' / 'src' / 'pages' / 'client' / 'ClientCompanionPage.jsx'
ROUTER    = REPO / 'backend' / 'routers' / 'client_portal.py'


@pytest.fixture(scope='module')
def client_token():
    r = requests.post(f"{API}/api/auth/login",
                      json={"email": "client@moodfordesign.com",
                            "password": "Client2024!"}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["session"]["access_token"]


@pytest.fixture(scope='module')
def designer_token():
    r = requests.post(f"{API}/api/auth/login",
                      json={"email": "designer@moodfordesign.com",
                            "password": "Designer2024!"}, timeout=20)
    if r.status_code != 200:
        pytest.skip("designer demo user unavailable")
    return r.json()["session"]["access_token"]


def H(t): return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope='module')
def journey_and_chapter(client_token):
    idx = requests.get(f"{API}/api/client/journeys",
                       headers=H(client_token), timeout=20).json()
    assert idx["zero_data"] is False
    jid = idx["journeys"][0]["journey_id"]
    comp = requests.get(f"{API}/api/client/journeys/{jid}/companion",
                        headers=H(client_token), timeout=20).json()
    return jid, comp["active_chapter"]["id"], comp["active_chapter"]["title"]


# ── BACKEND ──────────────────────────────────────────────────────
class TestSharedVoiceEndpoint:
    def test_post_voice_creates_feedback_and_timeline(self, client_token, journey_and_chapter):
        jid, mid, _ = journey_and_chapter
        body = {
            "milestone_id":  mid,
            "text":          "Questa seconda proposta mi sembra molto più vicina alla luce che immaginiamo per il living.",
            "reference_url": "https://www.pinterest.com/pin/villa-light-test/",
        }
        r = requests.post(f"{API}/api/client/journeys/{jid}/voice",
                          headers=H(client_token), json=body, timeout=20)
        assert r.status_code == 201, r.text
        d = r.json()
        # voice
        assert d["voice"]["text"] == body["text"]
        assert d["voice"]["reference_url"] == body["reference_url"]
        assert d["voice"]["author_role"] == "client"
        # timeline narrated
        assert "Hai lasciato una voce" in d["timeline_event"]["narrative"]
        # chapter context
        assert d["chapter"]["id"] == mid

    def test_voice_appears_in_companion_conversations(self, client_token, journey_and_chapter):
        jid, mid, _ = journey_and_chapter
        # Post a unique-marker voice
        marker = "g7ter_marker_companion_check"
        requests.post(f"{API}/api/client/journeys/{jid}/voice",
                      headers=H(client_token),
                      json={"milestone_id": mid,
                            "text": f"Una nota di test · {marker}"}, timeout=20)
        # Re-fetch companion
        d = requests.get(f"{API}/api/client/journeys/{jid}/companion",
                         headers=H(client_token), timeout=20).json()
        msgs = " | ".join((v.get("message") or "") for v in d["conversations"])
        assert marker in msgs, "la voce nuova non emerge nel companion"
        # Timeline event also surfaces
        ev = " | ".join(e.get("narrative", "") for e in d["evolution_timeline"])
        assert "Hai lasciato una voce" in ev

    def test_post_voice_validates_text_length(self, client_token, journey_and_chapter):
        jid, mid, _ = journey_and_chapter
        # too short
        r = requests.post(f"{API}/api/client/journeys/{jid}/voice",
                          headers=H(client_token),
                          json={"milestone_id": mid, "text": "x"}, timeout=20)
        assert r.status_code == 422
        # too long
        r = requests.post(f"{API}/api/client/journeys/{jid}/voice",
                          headers=H(client_token),
                          json={"milestone_id": mid, "text": "x" * 601}, timeout=20)
        assert r.status_code == 422

    def test_post_voice_404_on_unknown_milestone(self, client_token, journey_and_chapter):
        jid, _, _ = journey_and_chapter
        r = requests.post(f"{API}/api/client/journeys/{jid}/voice",
                          headers=H(client_token),
                          json={"milestone_id": "00000000-0000-0000-0000-000000000000",
                                "text": "milestone fantasma test"}, timeout=20)
        assert r.status_code == 404

    def test_post_voice_404_on_unknown_journey(self, client_token, journey_and_chapter):
        _, mid, _ = journey_and_chapter
        r = requests.post(
            f"{API}/api/client/journeys/00000000-0000-0000-0000-000000000000/voice",
            headers=H(client_token),
            json={"milestone_id": mid, "text": "journey fantasma test"}, timeout=20)
        assert r.status_code == 404

    def test_designer_role_blocked(self, designer_token, journey_and_chapter):
        jid, mid, _ = journey_and_chapter
        r = requests.post(f"{API}/api/client/journeys/{jid}/voice",
                          headers=H(designer_token),
                          json={"milestone_id": mid, "text": "designer test"},
                          timeout=20)
        assert r.status_code == 403


# ── FRONTEND STATIC ──────────────────────────────────────────────
class TestComposerEditorialTone:
    def test_composer_uses_journey_first_copy(self):
        src = COMPOSER.read_text()
        for phrase in (
            "Vuoi raccontarci qualcosa su",
            "Condividi una voce",
            "Raccontaci una impressione",
            "Aggiungi un riferimento",
            "Condividi una atmosfera",
            "Aggiungi una nota",
            "Condividi la voce",
            "Shared Voice",
        ):
            assert phrase in src, f"missing editorial copy: {phrase}"

    def test_composer_has_no_chat_pm_terminology(self):
        src = COMPOSER.read_text()
        for bad in (
            "Add comment", "Add Comment", "Post comment", "Reply",
            "Mention", "@mention", "Send message", "Thread",
            "Type a message", "emoji", "reaction", "like",
        ):
            assert bad not in src, f"forbidden chat/PM term in composer: {bad}"

    def test_composer_exposes_testids(self):
        src = COMPOSER.read_text()
        for tid in (
            'data-testid="shared-voice-invite"',
            'data-testid="shared-voice-open"',
            'data-testid="shared-voice-composer"',
            'data-testid="shared-voice-text"',
            'data-testid="shared-voice-toggle-ref"',
            'data-testid="shared-voice-toggle-img"',
            'data-testid="shared-voice-toggle-note"',
            'data-testid="shared-voice-send"',
            'data-testid="shared-voice-close"',
        ):
            assert tid in src, f"missing testid: {tid}"

    def test_composer_uses_relational_icons(self):
        # icons are lucide-react: link, sparkles, notebook, image — editorial
        src = COMPOSER.read_text()
        for icon in ("Link2", "ImagePlus", "NotebookPen", "Sparkles"):
            assert icon in src
        # NO chat icon
        for chat_icon in ("MessageCircle", "MessageSquare", "Bot"):
            assert chat_icon not in src


class TestComposerWiredIntoCompanion:
    def test_companion_mounts_composer_inside_active_chapter(self):
        src = COMPANION.read_text()
        assert "SharedVoiceComposer" in src
        # only on the ActiveChapter section — verify it's NOT used elsewhere
        # by counting occurrences
        assert src.count("<SharedVoiceComposer") == 1

    def test_companion_optimistic_update(self):
        src = COMPANION.read_text()
        assert "handleVoiceShared" in src
        assert "onVoiceShared" in src
        # Optimistic insert into both conversations & timeline
        assert "conversations:      [newVoice" in src \
            or "[newVoice," in src
        assert "[newEvent," in src


class TestBackendDirectionLock:
    def test_router_uses_free_voice_kind_only(self):
        src = ROUTER.read_text()
        # The route writes kind='free_voice' (editorial) — NOT 'comment'
        assert '"kind":           "free_voice"' in src
        # NO usage of free-form "comment" kind in the new endpoint
        assert '"kind": "comment"' not in src

    def test_router_persists_to_canonical_tables(self):
        src = ROUTER.read_text()
        assert 'c.table("milestone_feedback").insert' in src
        assert 'c.table("journey_timeline_events").insert' in src
        # And refreshes the journey timestamp
        assert 'c.table("design_journeys").update' in src

    def test_router_uses_italian_timeline_narration(self):
        src = ROUTER.read_text()
        assert "Hai lasciato una voce su" in src
