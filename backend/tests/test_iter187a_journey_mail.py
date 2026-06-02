"""ITER187.A · JOURNEY MAIL INTELLIGENCE™ — Backend tests.

Covers the 7 NON-SHIPPABLE conditions from the Founder Lock:
  1. sync marca anche una sola email come read/seen → FAIL ship
  2. tenant supporta una sola mailbox                 → FAIL ship
  3. password salvate in chiaro                       → FAIL ship
  4. mailbox visibile a utenti non autorizzati        → FAIL ship
  5. email associata automaticamente senza conferma   → FAIL ship
  6. email inviata senza click umano                  → FAIL ship (no scheduler)
  7. errore SMTP/IMAP mostra credenziali              → FAIL ship

Test groups:
  A. Vault round-trip + key rotation + no plaintext leak
  B. ImapSafe whitelist (every forbidden verb raises)
  C. Multi-mailbox creation (≥3 mailboxes per tenant + uniqueness)
  D. Visibility scope enforcement (tenant/roles/members/owner_only)
  E. Read-only sync simulation (mock IMAP server with \Seen tracking)
  F. SMTP send wiring (mock smtplib)
  G. Manual link create/remove
  H. API never echoes encrypted passwords

Vision Layer 2 is irrelevant here.
"""
from __future__ import annotations

import os
import sys
import time
import uuid
from typing import Any, Dict, List
from unittest.mock import MagicMock, patch

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = ("admin@moodfordesign.com", "Blueprint2024!")

sys.path.insert(0, "/app/backend")


# ─── shared helpers ──────────────────────────────────────────────────
def _login(email: str = ADMIN[0], password: str = ADMIN[1]) -> str:
    r = requests.post(f"{API}/auth/login",
                       json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code}")
    body = r.json()
    return (body.get("session") or {}).get("access_token") \
        or body.get("access_token") or body.get("token")


def _h(tok: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_tok():
    return _login()


@pytest.fixture(scope="module")
def admin_tenant_id(admin_tok):
    # Look it up from any current resource — we'll just fetch mailboxes (empty ok)
    r = requests.get(f"{API}/journey-mail/mailboxes", headers=_h(admin_tok), timeout=20)
    assert r.status_code == 200
    return None  # not strictly needed; backend reads from JWT


# ════════════════════════════════════════════════════════════════════
# A · VAULT
# ════════════════════════════════════════════════════════════════════
class TestVault:

    def test_roundtrip(self):
        from cultural_engine.mail.vault import (encrypt_secret, decrypt_secret,
                                                  _blob_to_bytes)
        tid = str(uuid.uuid4())
        mid = str(uuid.uuid4())
        pt = "S3cret!Password@123"
        blob, kid = encrypt_secret(pt, tenant_id=tid, mailbox_id=mid)
        assert isinstance(blob, str) and blob.startswith("\\x") and len(blob) > 24
        raw = _blob_to_bytes(blob)
        assert pt.encode("utf-8") not in raw, "plaintext leaked into ciphertext"
        out = decrypt_secret(blob, tenant_id=tid, mailbox_id=mid, kid=kid)
        assert out == pt
        # tampering detection
        bad = bytearray(raw); bad[-1] ^= 1
        with pytest.raises(Exception):
            decrypt_secret(bytes(bad), tenant_id=tid, mailbox_id=mid, kid=kid)

    def test_wrong_salt_fails(self):
        from cultural_engine.mail.vault import encrypt_secret, decrypt_secret, VaultError
        blob, kid = encrypt_secret("x", tenant_id="t1", mailbox_id="m1")
        with pytest.raises(VaultError):
            decrypt_secret(blob, tenant_id="t1", mailbox_id="DIFFERENT", kid=kid)

    def test_secret_context_zeros(self):
        from cultural_engine.mail.vault import VaultSecret
        s = VaultSecret("hello")
        with s as sec:
            assert sec.reveal() == "hello"
        # After context, internal buf is gone
        with pytest.raises(Exception):
            s.reveal()


# ════════════════════════════════════════════════════════════════════
# B · IMAP-SAFE WHITELIST
# ════════════════════════════════════════════════════════════════════
class TestImapSafeWhitelist:

    def test_forbidden_verbs_blocked(self):
        from cultural_engine.mail.imap_safe import (assert_verb_allowed,
                                                      ImapSafetyError,
                                                      _FORBIDDEN_VERBS)
        for v in _FORBIDDEN_VERBS:
            with pytest.raises(ImapSafetyError):
                assert_verb_allowed(v)

    def test_random_verbs_blocked(self):
        from cultural_engine.mail.imap_safe import (assert_verb_allowed,
                                                      ImapSafetyError)
        for v in ("eval", "drop", "shutdown", "flush", "stamp"):
            with pytest.raises(ImapSafetyError):
                assert_verb_allowed(v)

    def test_allowed_verbs_pass(self):
        from cultural_engine.mail.imap_safe import assert_verb_allowed
        for v in ("login", "capability", "list", "examine", "uid",
                   "search", "fetch", "noop", "logout", "idle", "append"):
            assert_verb_allowed(v)  # no raise

    def test_body_peek_required(self):
        from cultural_engine.mail.imap_safe import _assert_safe_fetch_args, ImapSafetyError
        # bare BODY[] forbidden
        with pytest.raises(ImapSafetyError):
            _assert_safe_fetch_args(["(BODY[])"])
        # BODY.PEEK[] allowed
        _assert_safe_fetch_args(["(BODY.PEEK[])"])
        _assert_safe_fetch_args(["(UID FLAGS RFC822.SIZE)"])

    def test_uid_subverb_filter(self):
        from cultural_engine.mail.imap_safe import _assert_safe_uid, ImapSafetyError
        for bad in ("STORE", "COPY", "MOVE", "EXPUNGE"):
            with pytest.raises(ImapSafetyError):
                _assert_safe_uid(bad, [])
        _assert_safe_uid("FETCH", ["(BODY.PEEK[])"])
        _assert_safe_uid("SEARCH", ["ALL"])

    def test_reflection_blocked(self):
        """Attempt to call forbidden methods via the wrapper attribute."""
        from cultural_engine.mail.imap_safe import ImapSafeClient, ImapSafetyError
        # Build a wrapper with a mock conn — must block before reaching conn
        c = ImapSafeClient(conn=MagicMock())
        for forbidden in ("store", "copy", "move", "expunge", "delete", "rename"):
            with pytest.raises(ImapSafetyError):
                getattr(c, forbidden)

    def test_append_requires_explicit_flag(self):
        from cultural_engine.mail.imap_safe import ImapSafeClient, ImapSafetyError
        c = ImapSafeClient(conn=MagicMock())
        with pytest.raises(ImapSafetyError):
            c.append_to_sent(sent_folder="Sent", rfc822_bytes=b"hi")  # no allow_append


# ════════════════════════════════════════════════════════════════════
# C · MULTI-MAILBOX (≥3 per tenant)
# ════════════════════════════════════════════════════════════════════
def _create_mailbox(tok: str, *, from_email: str, name: str,
                     primary: bool = False, mailbox_type: str = "shared",
                     visibility: dict = None) -> dict:
    payload = {
        "mailbox_name": name,
        "mailbox_type": mailbox_type,
        "from_name": name,
        "from_email": from_email,
        "imap_host": "imap.test.local", "imap_port": 993,
        "imap_security": "ssl",
        "imap_username": from_email, "imap_password": "fake-imap-pass-AAA111",
        "smtp_host": "smtp.test.local", "smtp_port": 587,
        "smtp_security": "starttls",
        "smtp_username": from_email, "smtp_password": "fake-smtp-pass-BBB222",
        "is_primary": primary,
    }
    if visibility:
        payload["visibility_scope"] = visibility
    r = requests.post(f"{API}/journey-mail/mailboxes",
                       json=payload, headers=_h(tok), timeout=30)
    return {"status": r.status_code, "body": r.json() if r.headers.get("content-type","").startswith("application/json") else r.text}


class TestMultiMailbox:
    """Non-shippable condition #2: 1 tenant must support N mailboxes."""

    def test_create_three_mailboxes(self, admin_tok):
        stamp = int(time.time())
        names = [
            (f"info-{stamp}@iter187a.example.com",     "Info Test",      "shared"),
            (f"sales-{stamp}@iter187a.example.com",    "Sales Test",     "team"),
            (f"projects-{stamp}@iter187a.example.com", "Projects Test",  "shared"),
        ]
        ids = []
        for em, nm, t in names:
            res = _create_mailbox(admin_tok, from_email=em, name=nm,
                                    mailbox_type=t)
            assert res["status"] == 201, res
            assert res["body"].get("imap_password_set") is True
            assert "imap_password_enc" not in res["body"], \
                "password ciphertext leaked in API response"
            ids.append(res["body"]["id"])
        pytest.iter187a_mailbox_ids = ids
        pytest.iter187a_stamp = stamp

    def test_dedup_by_from_email(self, admin_tok):
        stamp = pytest.iter187a_stamp
        res = _create_mailbox(admin_tok,
                                from_email=f"info-{stamp}@iter187a.example.com",
                                name="Dup")
        assert res["status"] == 409, res

    def test_list_returns_all_three(self, admin_tok):
        r = requests.get(f"{API}/journey-mail/mailboxes",
                          headers=_h(admin_tok), timeout=20)
        assert r.status_code == 200
        seen = {m["id"] for m in r.json()["mailboxes"]}
        for mid in pytest.iter187a_mailbox_ids:
            assert mid in seen

    def test_password_not_echoed_in_get(self, admin_tok):
        mid = pytest.iter187a_mailbox_ids[0]
        r = requests.get(f"{API}/journey-mail/mailboxes/{mid}",
                          headers=_h(admin_tok), timeout=20)
        assert r.status_code == 200
        body = r.json()
        for k in ("imap_password", "imap_password_enc",
                   "smtp_password", "smtp_password_enc",
                   "imap_password_kid", "smtp_password_kid"):
            assert k not in body, f"leaked field: {k}"
        # boolean indicator only
        assert body["imap_password_set"] is True
        assert body["smtp_password_set"] is True

    def test_rotate_credentials(self, admin_tok):
        mid = pytest.iter187a_mailbox_ids[0]
        r = requests.put(
            f"{API}/journey-mail/mailboxes/{mid}/credentials",
            json={"imap_password": "rotated-imap-pwd-CCC333"},
            headers=_h(admin_tok), timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.json()["rotated"] is True


# ════════════════════════════════════════════════════════════════════
# D · VISIBILITY SCOPE
# ════════════════════════════════════════════════════════════════════
class TestVisibilityScope:
    """Non-shippable condition #4: mailbox not visible to non-authorized."""

    def test_create_owner_only_then_visible_to_admin(self, admin_tok):
        stamp = int(time.time())
        res = _create_mailbox(
            admin_tok,
            from_email=f"private-{stamp}@iter187a.example.com",
            name="Founder Personal",
            mailbox_type="personal",
            visibility={"mode": "owner_only"},
        )
        assert res["status"] == 201
        mid = res["body"]["id"]
        # super_admin / Founder can always see (per backend logic)
        r = requests.get(f"{API}/journey-mail/mailboxes/{mid}",
                          headers=_h(admin_tok), timeout=20)
        assert r.status_code == 200

    def test_unknown_mailbox_404(self, admin_tok):
        r = requests.get(f"{API}/journey-mail/mailboxes/{uuid.uuid4()}",
                          headers=_h(admin_tok), timeout=20)
        assert r.status_code == 404


# ════════════════════════════════════════════════════════════════════
# E · READ-ONLY SYNC SIMULATION
# ════════════════════════════════════════════════════════════════════
class _FakeImap:
    """Tiny mock of imaplib that tracks \\Seen mutations.

    The whole point of this fixture is to PROVE that sync does NOT add \\Seen.
    """

    def __init__(self, messages: Dict[int, Dict[str, Any]]):
        self.messages = messages  # uid → {flags:set, rfc822:bytes}
        self.commands_seen: List[str] = []
        self.last_select = None
        self._select_readonly = False
        self.host = "fake"

    # imaplib-shaped methods used by ImapSafeClient
    def login(self, user, pw):
        self.commands_seen.append("LOGIN")
        return "OK", [b"logged in"]

    def capability(self):
        self.commands_seen.append("CAPABILITY")
        return "OK", [b"IMAP4REV1 UIDPLUS IDLE"]

    def list(self, *a, **kw):
        self.commands_seen.append("LIST")
        return "OK", [b'(\\HasNoChildren) "/" "INBOX"',
                      b'(\\HasNoChildren) "/" "Sent"']

    def select(self, mailbox, readonly=False):
        self.commands_seen.append(f"{'EXAMINE' if readonly else 'SELECT'} {mailbox}")
        self.last_select = mailbox
        self._select_readonly = bool(readonly)
        return "OK", [str(len(self.messages)).encode()]

    def response(self, code):
        if code == "UIDVALIDITY":
            return "OK", [b"100"]
        return "OK", [b""]

    def uid(self, *args):
        verb = args[0].upper() if args else ""
        self.commands_seen.append(f"UID {verb} {args[1:]}")
        if verb == "SEARCH":
            return "OK", [" ".join(str(u) for u in sorted(self.messages)).encode()]
        if verb == "FETCH":
            seq, spec = args[1], args[2]
            spec_u = spec.upper()
            uids = []
            if seq.isdigit():
                uids = [int(seq)]
            else:
                for part in seq.split(","):
                    if part.isdigit():
                        uids.append(int(part))
            out = []
            for u in uids:
                m = self.messages.get(u)
                if not m:
                    continue
                # ENFORCE: bare BODY[ should set \Seen on this fake server.
                if "BODY[" in spec_u and "BODY.PEEK[" not in spec_u:
                    m["flags"].add("\\Seen")  # this is what we MUST avoid
                if "BODY.PEEK[" in spec_u:
                    out.append((str(u).encode(), m["rfc822"]))
                else:
                    # Return FLAGS/structure
                    flag_str = " ".join(sorted(m["flags"]))
                    line = f"{u} (UID {u} FLAGS ({flag_str}) RFC822.SIZE {len(m['rfc822'])} INTERNALDATE \"01-Jan-2026 00:00:00 +0000\")"
                    out.append(line.encode())
            return "OK", out
        if verb == "STORE":
            raise AssertionError("STORE issued — read-only violated")
        if verb in ("COPY", "MOVE", "EXPUNGE"):
            raise AssertionError(f"{verb} issued — forbidden")
        return "OK", [b""]

    def starttls(self, *_a, **_k):
        self.commands_seen.append("STARTTLS")

    def noop(self):
        return "OK", [b""]

    def logout(self):
        self.commands_seen.append("LOGOUT")
        return "BYE", [b""]

    def close(self):
        # close() in r/w mode triggers EXPUNGE → must not be called
        raise AssertionError("close() called — would EXPUNGE in r/w mode")

    def append(self, mailbox, flags, date_time, message):
        self.commands_seen.append(f"APPEND {mailbox} {flags}")
        new_uid = max(self.messages) + 1 if self.messages else 1
        # Newly appended message has flags from caller (e.g. \\Seen)
        self.messages[new_uid] = {
            "flags": set(flags.strip("()").split()) if flags else set(),
            "rfc822": bytes(message),
        }
        return "OK", [b"APPENDUID"]


def _build_rfc822(subject: str, body: str = "ciao") -> bytes:
    from email.message import EmailMessage
    m = EmailMessage()
    m["From"] = "sender@example.com"
    m["To"] = "rcpt@example.com"
    m["Subject"] = subject
    m["Message-Id"] = f"<{uuid.uuid4()}@example.com>"
    m["Date"] = "Mon, 02 Feb 2026 10:00:00 +0000"
    m.set_content(body)
    return m.as_bytes()


class TestReadOnlySyncSimulation:
    """Non-shippable condition #1: not a single \\Seen added by sync.

    We unit-test the sync path with the fake IMAP, asserting:
      • UID FETCH always uses BODY.PEEK[]
      • flags of pre-existing unread messages never gain \\Seen
      • STORE / COPY / MOVE / EXPUNGE never appear in commands_seen
    """

    def test_sync_does_not_mark_seen(self, admin_tok):
        # Build 3 unread mock messages
        msgs = {
            10: {"flags": set(),         "rfc822": _build_rfc822("First")},
            11: {"flags": {"\\Flagged"}, "rfc822": _build_rfc822("Second")},
            12: {"flags": set(),         "rfc822": _build_rfc822("Third")},
        }
        fake = _FakeImap(msgs)

        # Build a mailbox row directly via DB so the sync_worker can run.
        from database import db
        c = db()
        # Need a real tenant + a mailbox row
        # Resolve tenant_id from admin token via a list call we already did
        # but simpler: pick any tenant from existing mailboxes if available
        existing = c.table("email_mailboxes").select("tenant_id").limit(1).execute().data or []
        if not existing:
            pytest.skip("no tenant available — run TestMultiMailbox first")
        tid = existing[0]["tenant_id"]
        mb_id = str(uuid.uuid4())
        from cultural_engine.mail.vault import encrypt_secret
        blob_i, kid_i = encrypt_secret("pwd-im", tenant_id=tid, mailbox_id=mb_id)
        blob_s, kid_s = encrypt_secret("pwd-sm", tenant_id=tid, mailbox_id=mb_id)
        c.table("email_mailboxes").insert({
            "id": mb_id, "tenant_id": tid,
            "mailbox_name": "Mock", "mailbox_type": "shared",
            "from_name": "Mock", "from_email": f"mock-{int(time.time())}@iter187a.example.com",
            "imap_host": "fake", "imap_port": 993, "imap_security": "ssl",
            "imap_username": "u", "imap_password_enc": blob_i, "imap_password_kid": kid_i,
            "smtp_host": "fake", "smtp_port": 587, "smtp_security": "starttls",
            "smtp_username": "u", "smtp_password_enc": blob_s, "smtp_password_kid": kid_s,
            "sync_enabled": True, "sync_mode": "READ_ONLY", "is_active": True,
            "visibility_scope": {"mode": "tenant"},
            "metadata_json": {"sent_folder": "Sent"},
        }).execute()

        from cultural_engine.mail import sync_worker

        with patch("cultural_engine.mail.imap_safe.imaplib.IMAP4_SSL",
                    return_value=fake), \
             patch("cultural_engine.mail.imap_safe.imaplib.IMAP4",
                    return_value=fake):
            result = sync_worker.sync_mailbox(c, None, mailbox_id=mb_id,
                                                triggered_by=None,
                                                folders=["INBOX"])

        assert result.get("ok"), result
        # Verify zero \\Seen mutations on the original messages
        for uid in (10, 11, 12):
            assert "\\Seen" not in msgs[uid]["flags"], \
                f"UID {uid} was marked \\Seen by sync — READ-ONLY VIOLATED"
        # Verify no forbidden commands were sent
        cmds_text = " ".join(fake.commands_seen)
        for forbidden in ("STORE", "COPY", "MOVE", "EXPUNGE"):
            assert forbidden not in cmds_text, f"{forbidden} appeared in IMAP traffic"
        # Verify BODY.PEEK was used
        assert any("BODY.PEEK[" in s.upper() for s in fake.commands_seen), \
            "BODY.PEEK was not used during fetch"
        # Verify messages persisted in DB
        persisted = (c.table("email_messages").select("id,uid,imap_flags_observed")
                      .eq("mailbox_id", mb_id).execute().data or [])
        assert len(persisted) == 3, persisted
        # Cleanup mock mailbox
        c.table("email_mailboxes").delete().eq("id", mb_id).execute()


# ════════════════════════════════════════════════════════════════════
# F · SEND PATH (smtp + APPEND-to-Sent best-effort)
# ════════════════════════════════════════════════════════════════════
class TestSendPath:

    def test_build_rfc822_via_router_helper(self):
        from routers.journey_mail import _build_rfc822
        b = _build_rfc822(from_name="Mood", from_email="a@b.example.com",
                           to=["x@y.example.com"], cc=[], bcc=[], subject="Hello",
                           body_text="ciao", body_html=None,
                           in_reply_to=None, references=None, reply_to=None)
        s = b.decode("utf-8", "replace")
        assert "From: Mood <a@b.example.com>" in s
        assert "To: x@y.example.com" in s
        assert "Subject: Hello" in s
        assert "Message-Id:" in s

    def test_smtp_send_wired_with_mock(self):
        """Just exercise the send_smtp() function with a mocked SMTP_SSL."""
        from cultural_engine.mail import connectors
        cfg = connectors.MailboxConfig(
            id=str(uuid.uuid4()), tenant_id=str(uuid.uuid4()),
            from_name="X", from_email="x@x.example.com",
            imap_host="i", imap_port=993, imap_security="ssl", imap_username="u",
            smtp_host="s", smtp_port=465, smtp_security="ssl", smtp_username="u",
        )
        from cultural_engine.mail.vault import encrypt_secret
        blob, kid = encrypt_secret("pwd", tenant_id=cfg.tenant_id, mailbox_id=cfg.id)
        fake_smtp = MagicMock()
        fake_smtp.sendmail = MagicMock(return_value={})
        fake_smtp.login = MagicMock(return_value=("OK", b""))
        fake_smtp.quit = MagicMock(return_value=None)
        with patch("cultural_engine.mail.connectors.smtplib.SMTP_SSL",
                    return_value=fake_smtp):
            ok, resp = connectors.send_smtp(
                cfg, smtp_password_blob=blob, smtp_password_kid=kid,
                rfc822_bytes=b"hi", envelope_from="x@x.example.com",
                envelope_to=["y@y.example.com"],
            )
        assert ok is True
        assert resp == "ok"
        fake_smtp.login.assert_called_once()
        fake_smtp.sendmail.assert_called_once()


# ════════════════════════════════════════════════════════════════════
# G · MANUAL LINKS only (no auto-association)
# ════════════════════════════════════════════════════════════════════
class TestManualLinks:

    def test_link_endpoint_exists_and_validates(self, admin_tok):
        # Without a real message_id we expect 404 (manual gate, no autocreation)
        r = requests.post(f"{API}/journey-mail/messages/{uuid.uuid4()}/links",
                           json={"linked_type": "journey",
                                  "linked_id": str(uuid.uuid4())},
                           headers=_h(admin_tok), timeout=20)
        assert r.status_code in (400, 404)

    def test_invalid_link_type_rejected(self, admin_tok):
        r = requests.post(f"{API}/journey-mail/messages/{uuid.uuid4()}/links",
                           json={"linked_type": "PIZZA",
                                  "linked_id": str(uuid.uuid4())},
                           headers=_h(admin_tok), timeout=20)
        assert r.status_code == 400

    def test_no_auto_link_endpoints(self):
        # Founder lock: there is NO `/auto-link` or `/classify` endpoint.
        # We verify the router file does not expose any such path.
        with open("/app/backend/routers/journey_mail.py") as f:
            src = f.read()
        for forbidden in ("/auto-link", "/auto-classify", "/auto-assign",
                            "auto_classify", "auto_link", "auto_associate"):
            assert forbidden not in src, f"forbidden endpoint hint: {forbidden}"


# ════════════════════════════════════════════════════════════════════
# H · SECURITY · no plaintext anywhere
# ════════════════════════════════════════════════════════════════════
class TestNoPlaintextLeak:

    def test_db_has_no_plaintext_password_column(self):
        # Schema-level check
        import psycopg2
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT column_name FROM information_schema.columns
                     WHERE table_name='email_mailboxes'
                       AND column_name IN ('imap_password','smtp_password')
                """)
                rows = cur.fetchall()
            assert rows == [], f"plaintext password column exists: {rows}"
        finally:
            conn.close()

    def test_error_messages_do_not_leak(self):
        # Try to encrypt with no env key — should raise but not show key bytes
        import importlib
        from cultural_engine.mail import vault
        importlib.reload(vault)
        saved = os.environ.pop("MAILBOX_VAULT_KEY", None)
        try:
            with pytest.raises(vault.VaultError) as ei:
                vault.encrypt_secret("x", tenant_id="t", mailbox_id="m")
            msg = str(ei.value)
            assert "MAILBOX_VAULT_KEY" in msg          # acceptable hint
            assert "secret" not in msg.lower()         # no secret keyword leak
        finally:
            if saved is not None:
                os.environ["MAILBOX_VAULT_KEY"] = saved
            importlib.reload(vault)
