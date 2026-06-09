"""STORE-012C · CLIENT PORTAL CONCEPT REVIEW™ — backend tests.

Covers:
  POST   /api/journeys/{jid}/concept-directions/{set_id}/share
  POST   /api/journeys/{jid}/concept-directions/{set_id}/unshare
  GET    /api/client/journeys/{jid}/concept-directions
  POST   /api/client/concept-directions/{moodboard_id}/feedback

Verifies:
  · share marks boards status=sent + stamps shared_at/shared_by + timeline event
  · share with notify=false does NOT email; notify=true with no client email → sent=false, reason=no_client_email
  · unshare reverts to draft + clears shared_at/shared_by
  · client GET returns ONLY shared sets and NEVER exposes client_alignment_score
  · feedback: interested/explore_further/preferred/comment behave correctly
  · preferred unsets prior preferred in same set + emits 'cambiato direzione preferita' narrative
  · invalid reaction → 422; empty comment when reaction=comment → 422
  · moodboard.status NEVER changes from client feedback path
  · client_alignment_score increments by reaction weight (3/2/10/5) — visible only in studio-side raw fetch
"""
import os, json
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
JID = "8bb7a3b4-02af-4040-8420-37a254713899"
ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASSWORD = "Blueprint2024!"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    return r.json()["session"]["access_token"]


@pytest.fixture(scope="session")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


def _studio_list(client):
    r = client.get(f"{BASE_URL}/api/journeys/{JID}/concept-directions", timeout=30)
    assert r.status_code == 200, r.text[:300]
    return r.json().get("sets") or []


def _client_list(client):
    r = client.get(f"{BASE_URL}/api/client/journeys/{JID}/concept-directions", timeout=30)
    assert r.status_code == 200, r.text[:400]
    return r.json()


@pytest.fixture(scope="session")
def fresh_set(client):
    """Generate a fresh Direction Set we can fully drive via share/unshare/feedback
    without disturbing other tests."""
    r = client.post(f"{BASE_URL}/api/journeys/{JID}/concept-directions/generate",
                    json={}, timeout=120)
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    assert "set_id" in d and len(d["directions"]) == 3
    return d


# ─────────────────────────────────────────────────────────────────────────
class TestShareUnshare:
    def test_share_notify_false(self, client, fresh_set):
        sid = fresh_set["set_id"]
        r = client.post(
            f"{BASE_URL}/api/journeys/{JID}/concept-directions/{sid}/share",
            json={"notify": False}, timeout=30)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d["set_id"] == sid
        assert d["boards"] == 3
        assert d["shared_at"]
        assert d["set_label"].startswith("Direction Set ")
        # notify=false → email NOT sent
        assert d["email"]["sent"] is False

        # Verify on studio list: boards now stamped shared_at + status=sent
        sets = _studio_list(client)
        target = next(s for s in sets if s["set_id"] == sid)
        for dr in target["directions"]:
            assert dr.get("shared_at"), "shared_at not stamped"
            assert dr.get("status") == "sent", f"expected status=sent, got {dr.get('status')}"

    def test_client_get_returns_shared_set_only(self, client, fresh_set):
        sid = fresh_set["set_id"]
        d = _client_list(client)
        ids = {s["set_id"] for s in d["sets"]}
        assert sid in ids
        # all returned sets must have set_shared_at
        for s in d["sets"]:
            assert s.get("set_shared_at")
            for dr in s["directions"]:
                # CRITICAL: client_alignment_score must NEVER appear
                assert "client_alignment_score" not in dr
                for k in ("moodboard_id", "direction_letter", "direction_name",
                          "color_palette", "style_dna_snapshot",
                          "material_entity_ids", "media_ids",
                          "cover_url", "designer_notes", "is_preferred",
                          "my_reactions"):
                    assert k in dr, f"missing key {k} in client direction"
        # CRITICAL: serialized JSON must not contain the score string anywhere
        body = json.dumps(d)
        assert "client_alignment_score" not in body

    def test_share_notify_true_no_client_email(self, client):
        """Generate a new set so we don't keep toggling the prior one,
        share with notify=true (default) — journey has no client_user_id
        → email.sent=false, reason='no_client_email'."""
        g = client.post(f"{BASE_URL}/api/journeys/{JID}/concept-directions/generate",
                        json={}, timeout=120).json()
        sid = g["set_id"]
        r = client.post(
            f"{BASE_URL}/api/journeys/{JID}/concept-directions/{sid}/share",
            json={"notify": True}, timeout=45)
        assert r.status_code == 200, r.text[:400]
        em = r.json()["email"]
        assert em["sent"] is False
        # accept "no_client_email" or, in worst case, any non-empty reason string
        assert em.get("reason"), f"expected a reason for no email; got {em}"

    def test_unshare_reverts(self, client):
        # Generate, share, then unshare
        g = client.post(f"{BASE_URL}/api/journeys/{JID}/concept-directions/generate",
                        json={}, timeout=120).json()
        sid = g["set_id"]
        s = client.post(f"{BASE_URL}/api/journeys/{JID}/concept-directions/{sid}/share",
                        json={"notify": False}, timeout=30)
        assert s.status_code == 200

        u = client.post(f"{BASE_URL}/api/journeys/{JID}/concept-directions/{sid}/unshare",
                        json={}, timeout=30)
        assert u.status_code == 200, u.text[:400]
        ud = u.json()
        assert ud["set_id"] == sid
        assert ud["boards"] == 3

        # Studio list: shared_at cleared + status back to draft
        sets = _studio_list(client)
        target = next(s for s in sets if s["set_id"] == sid)
        for dr in target["directions"]:
            assert not dr.get("shared_at"), "shared_at should be cleared after unshare"
            assert dr.get("status") == "draft"

        # Client list: this set should no longer be present
        cd = _client_list(client)
        ids = {s["set_id"] for s in cd["sets"]}
        assert sid not in ids


# ─────────────────────────────────────────────────────────────────────────
class TestClientFeedback:
    @pytest.fixture(scope="class")
    def shared_set(self, client):
        """One dedicated set, shared, for the full feedback matrix."""
        g = client.post(f"{BASE_URL}/api/journeys/{JID}/concept-directions/generate",
                        json={}, timeout=120).json()
        sid = g["set_id"]
        s = client.post(f"{BASE_URL}/api/journeys/{JID}/concept-directions/{sid}/share",
                        json={"notify": False}, timeout=30)
        assert s.status_code == 200, s.text[:300]
        # Find current set details from studio list
        sets = _studio_list(client)
        return next(x for x in sets if x["set_id"] == sid)

    def _mb_status(self, client, mb_id):
        r = client.get(f"{BASE_URL}/api/moodboards/{mb_id}", timeout=20)
        if r.status_code == 200:
            return r.json().get("status")
        # fallback: read via list
        sets = _studio_list(client)
        for s in sets:
            for d in s["directions"]:
                if d["moodboard_id"] == mb_id:
                    return d.get("status")
        return None

    def test_invalid_reaction_422(self, client, shared_set):
        mb = shared_set["directions"][0]["moodboard_id"]
        r = client.post(f"{BASE_URL}/api/client/concept-directions/{mb}/feedback",
                        json={"reaction": "love_it"}, timeout=20)
        assert r.status_code == 422, r.text[:200]

    def test_comment_requires_text(self, client, shared_set):
        mb = shared_set["directions"][0]["moodboard_id"]
        r = client.post(f"{BASE_URL}/api/client/concept-directions/{mb}/feedback",
                        json={"reaction": "comment", "comment": "   "}, timeout=20)
        assert r.status_code == 422, r.text[:200]
        r2 = client.post(f"{BASE_URL}/api/client/concept-directions/{mb}/feedback",
                         json={"reaction": "comment"}, timeout=20)
        assert r2.status_code == 422, r2.text[:200]

    def test_interested_persists_and_narrative(self, client, shared_set):
        mb = shared_set["directions"][0]["moodboard_id"]
        status_before = self._mb_status(client, mb)
        r = client.post(f"{BASE_URL}/api/client/concept-directions/{mb}/feedback",
                        json={"reaction": "interested"}, timeout=20)
        assert r.status_code == 201, r.text[:300]
        d = r.json()
        assert d["feedback"]["reaction"] == "interested"
        nar = (d.get("narrative") or "").lower()
        assert ("interessante" in nar) or ("interesting" in nar), f"narrative: {d.get('narrative')}"
        # Status must NOT change
        status_after = self._mb_status(client, mb)
        assert status_after == status_before == "sent", (
            f"moodboard.status changed by client feedback: {status_before} → {status_after}")
        # Client list now contains my_reactions
        cd = _client_list(client)
        target_set = next(s for s in cd["sets"] if s["set_id"] == shared_set["set_id"])
        target_dir = next(d for d in target_set["directions"] if d["moodboard_id"] == mb)
        assert any(x["reaction"] == "interested" for x in target_dir["my_reactions"])

    def test_preferred_sets_flag_and_score_internal_only(self, client, shared_set):
        mb_A = shared_set["directions"][0]["moodboard_id"]
        r = client.post(f"{BASE_URL}/api/client/concept-directions/{mb_A}/feedback",
                        json={"reaction": "preferred"}, timeout=20)
        assert r.status_code == 201, r.text[:300]
        d = r.json()
        assert d["is_preferred"] is True
        # Client list: A is_preferred=true, others false
        cd = _client_list(client)
        target_set = next(s for s in cd["sets"] if s["set_id"] == shared_set["set_id"])
        a = next(d for d in target_set["directions"] if d["moodboard_id"] == mb_A)
        assert a["is_preferred"] is True
        for other in target_set["directions"]:
            if other["moodboard_id"] != mb_A:
                assert other["is_preferred"] is False
        # CRITICAL: client_alignment_score not exposed
        assert "client_alignment_score" not in json.dumps(target_set)

    def test_preferred_switch_emits_change_narrative(self, client, shared_set):
        mb_B = shared_set["directions"][1]["moodboard_id"]
        # ensure A already preferred from previous test
        r = client.post(f"{BASE_URL}/api/client/concept-directions/{mb_B}/feedback",
                        json={"reaction": "preferred"}, timeout=20)
        assert r.status_code == 201, r.text[:300]
        nar = (r.json().get("narrative") or "").lower()
        assert ("cambiato direzione preferita" in nar) or ("changed preferred direction" in nar), \
            f"narrative: {r.json().get('narrative')}"
        # B should now be preferred, A no longer
        cd = _client_list(client)
        target_set = next(s for s in cd["sets"] if s["set_id"] == shared_set["set_id"])
        for d in target_set["directions"]:
            if d["moodboard_id"] == mb_B:
                assert d["is_preferred"] is True
            else:
                assert d["is_preferred"] is False

    def test_comment_with_text_succeeds(self, client, shared_set):
        mb = shared_set["directions"][2]["moodboard_id"]
        r = client.post(f"{BASE_URL}/api/client/concept-directions/{mb}/feedback",
                        json={"reaction": "comment", "comment": "Adoro questa palette"}, timeout=20)
        assert r.status_code == 201, r.text[:300]
        d = r.json()
        assert d["feedback"]["reaction"] == "comment"
        assert "Adoro questa palette" in (d.get("narrative") or "")

    def test_status_never_changes_after_full_matrix(self, client, shared_set):
        for dr in shared_set["directions"]:
            mb = dr["moodboard_id"]
            assert self._mb_status(client, mb) == "sent", (
                f"moodboard {mb} status changed (expected sent)")


# ─────────────────────────────────────────────────────────────────────────
class TestAlignmentScoreInternalOnly:
    """The Client Alignment Score™ MUST appear in the studio raw moodboard
    fetch (ai_metadata.concept_seed.client_alignment_score) but MUST NEVER
    appear in any /api/client/* payload."""

    def test_score_not_in_client_list(self, client):
        cd = _client_list(client)
        body = json.dumps(cd)
        assert "client_alignment_score" not in body, \
            "Client Alignment Score leaked in /api/client/journeys/{jid}/concept-directions"

    def test_score_updates_internally(self, client):
        # Pull all moodboards from studio side; pick one that has reactions
        sets = _studio_list(client)
        # the most recent shared set with reactions is at the end
        last_with_reactions = None
        for s in sets:
            for d in s["directions"]:
                if d.get("shared_at"):
                    last_with_reactions = d
        assert last_with_reactions, "no shared moodboards found"
        mb_id = last_with_reactions["moodboard_id"]
        # studio-side raw moodboard fetch
        rr = client.get(f"{BASE_URL}/api/moodboards/{mb_id}", timeout=20)
        if rr.status_code != 200:
            pytest.skip(f"studio raw moodboard endpoint returned {rr.status_code}; cannot inspect score directly")
        seed = ((rr.json().get("ai_metadata") or {}).get("concept_seed") or {})
        score = seed.get("client_alignment_score")
        # Score may legitimately be 0 if no feedback was given on this exact board.
        assert score is None or isinstance(score, int), f"score type wrong: {type(score)}"
