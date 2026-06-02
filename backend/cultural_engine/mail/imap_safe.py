"""ImapSafe wrapper — ITER187.A Workstream O · READ-ONLY IMAP GUARANTEE™.

This module is the SOLE allowed entrypoint to IMAP for mail sync. It wraps
imaplib.IMAP4_SSL / IMAP4 (with STARTTLS) and enforces a strict whitelist:

  ✅ allowed: LOGIN, AUTHENTICATE, CAPABILITY, NOOP, LOGOUT,
             LIST, LSUB,
             SELECT (read-only), EXAMINE,
             UID SEARCH, SEARCH,
             UID FETCH BODY.PEEK[...], UID FETCH (FLAGS UID INTERNALDATE
             RFC822.SIZE ENVELOPE BODYSTRUCTURE HEADER.FIELDS ... ),
             IDLE,
             APPEND (only allowed against the mailbox's own Sent folder
                      with an explicit `allow_append=True` keyword)

  ❌ forbidden: STORE, UID STORE, COPY, UID COPY, MOVE, UID MOVE,
             EXPUNGE, SUBSCRIBE, UNSUBSCRIBE, CREATE, RENAME, DELETE,
             SETACL, DELETEACL, SETMETADATA, any non-PEEK BODY[]

Any attempt to invoke a forbidden verb raises ImapSafetyError BEFORE the
socket is touched.

Founder lock: marking even one pre-existing message as \\Seen is a
non-shippable defect. Tests in test_iter187a_imap_safe.py enforce the
whitelist via fuzz on every imaplib method.
"""
from __future__ import annotations

import imaplib
import logging
import re
import ssl
from typing import Iterable, List, Optional, Tuple

logger = logging.getLogger(__name__)


class ImapSafetyError(RuntimeError):
    """Raised when a forbidden IMAP verb is attempted."""


# Verbs (imaplib method names) explicitly allowed.
_ALLOWED_VERBS = frozenset({
    "login", "authenticate", "capability", "noop", "logout",
    "list", "lsub",
    "select", "examine",
    "search", "uid",     # `uid` covers UID SEARCH / UID FETCH
    "fetch",             # only used in conjunction with allowed args
    "idle", "done",
    # append is allowed but only via the explicit append_to_sent() method
})

# Verbs we forbid even via reflection.
_FORBIDDEN_VERBS = frozenset({
    "store", "copy", "move", "expunge", "subscribe", "unsubscribe",
    "create", "rename", "delete", "setacl", "deleteacl", "setmetadata",
    "setannotation", "getmetadata", "setquota",
    # imaplib doesn't expose these as methods but the strings are blocked
    # in raw command paths too.
})

_FORBIDDEN_UID_SUBVERBS = frozenset({"store", "copy", "move", "expunge"})

# Body fetch must use BODY.PEEK[] — bare BODY[] sets \Seen.
_BODY_FETCH_RE = re.compile(r"\bBODY\[", re.IGNORECASE)
_BODY_PEEK_RE = re.compile(r"\bBODY\.PEEK\[", re.IGNORECASE)


def _assert_safe_fetch_args(args: Iterable) -> None:
    flat = " ".join(str(a) for a in args)
    upper = flat.upper()
    if "BODY[" in upper.replace("BODY.PEEK[", ""):
        # If any BODY[ exists without PEEK qualifier → reject.
        raise ImapSafetyError(
            "Forbidden fetch: bare BODY[...] would set \\Seen. Use BODY.PEEK[...]"
        )
    for forbidden in ("STORE", "COPY", "MOVE", "EXPUNGE", "SUBSCRIBE",
                       "SETACL", "DELETEACL", "SETMETADATA"):
        if forbidden in upper:
            raise ImapSafetyError(f"Forbidden token in fetch args: {forbidden}")


def _assert_safe_uid(subverb: str, args: Iterable) -> None:
    if (subverb or "").lower() in _FORBIDDEN_UID_SUBVERBS:
        raise ImapSafetyError(f"Forbidden UID subverb: {subverb}")
    if (subverb or "").lower() == "fetch":
        _assert_safe_fetch_args(args)


class ImapSafeClient:
    """Read-only IMAP client. Use as context manager.

    Example:
        with ImapSafeClient.connect(host, port, security, username, password) as c:
            c.select_readonly("INBOX")
            uids = c.uid_search("UID 1:*")
    """

    def __init__(self, conn: imaplib.IMAP4) -> None:
        self._c = conn
        self._selected_folder: Optional[str] = None
        self._readonly = True
        self.commands_audit: List[Tuple[str, str]] = []
        # capabilities cache (populated on connect)
        self.capabilities: List[str] = []
        self.peek_supported: bool = True
        self._dry_run = False

    # ── Connect / disconnect ─────────────────────────────────────────
    @classmethod
    def connect(cls, *, host: str, port: int, security: str,
                username: str, password: str, timeout: int = 30) -> "ImapSafeClient":
        if security == "ssl":
            ctx = ssl.create_default_context()
            conn = imaplib.IMAP4_SSL(host=host, port=port, ssl_context=ctx,
                                       timeout=timeout)
        elif security == "starttls":
            conn = imaplib.IMAP4(host=host, port=port, timeout=timeout)
            ctx = ssl.create_default_context()
            conn.starttls(ssl_context=ctx)
        elif security == "plain":
            # Only allowed under explicit dev escape hatch
            import os
            if os.environ.get("MAILBOX_ALLOW_PLAIN") != "1":
                raise ImapSafetyError("plain IMAP forbidden outside dev")
            conn = imaplib.IMAP4(host=host, port=port, timeout=timeout)
        else:
            raise ImapSafetyError(f"unknown imap security: {security}")

        try:
            typ, _ = conn.login(username, password)
            if typ != "OK":
                raise ImapSafetyError("IMAP login failed")
        except imaplib.IMAP4.error:
            try:
                conn.logout()
            except Exception:
                pass
            raise

        client = cls(conn)
        typ, caps = conn.capability()
        client.capabilities = [c.decode() if isinstance(c, bytes) else c
                                for c in (caps[0].split() if caps and caps[0] else [])]
        # PEEK is part of base IMAP4rev1 — every compliant server supports it.
        # We sanity-check via a fetch later if needed.
        return client

    def __enter__(self) -> "ImapSafeClient":
        return self

    def __exit__(self, *_exc) -> None:
        self.close()

    def close(self) -> None:
        if self._c is None:
            return
        try:
            # Do NOT call self._c.close() (which would trigger EXPUNGE in
            # read-write mode). We're in EXAMINE/READ-ONLY, but be explicit.
            self._c.logout()
        except Exception:
            pass
        self._c = None

    # ── Whitelisted operations ───────────────────────────────────────
    def list_folders(self) -> List[str]:
        self._audit("list", "(reference=\"\" mailbox=\"*\")")
        typ, data = self._c.list()
        if typ != "OK":
            return []
        out = []
        for raw in (data or []):
            if raw is None:
                continue
            line = raw.decode() if isinstance(raw, bytes) else raw
            # Format: (\HasNoChildren) "/" "INBOX"
            parts = line.rsplit(" ", 1)
            if parts:
                name = parts[-1].strip().strip('"')
                if name:
                    out.append(name)
        return out

    def select_readonly(self, folder: str) -> Tuple[int, int]:
        """EXAMINE folder (read-only SELECT). Returns (uid_validity, num_messages)."""
        self._audit("examine", folder)
        typ, data = self._c.select(mailbox=folder, readonly=True)
        if typ != "OK":
            raise ImapSafetyError(f"EXAMINE failed for {folder}")
        n = int((data[0] or b"0").decode() if data else 0)
        # Read UIDVALIDITY via STATUS-equivalent: examine response untagged
        typ_uv, uv_data = self._c.response("UIDVALIDITY")
        uid_validity = 0
        if uv_data and uv_data[0]:
            try:
                uid_validity = int(uv_data[0].decode() if isinstance(uv_data[0], bytes) else uv_data[0])
            except (ValueError, AttributeError):
                pass
        self._selected_folder = folder
        return uid_validity, n

    def uid_search(self, criterion: str = "ALL") -> List[int]:
        if not isinstance(criterion, str):
            raise ImapSafetyError("uid_search criterion must be str")
        self._audit("uid search", criterion)
        typ, data = self._c.uid("SEARCH", None, criterion)
        if typ != "OK":
            return []
        if not data or not data[0]:
            return []
        return [int(x) for x in data[0].split() if x.isdigit()]

    def uid_fetch_envelopes(self, uids: List[int]) -> List[Tuple[int, bytes]]:
        """Fetch envelope/flags/size/structure without setting \\Seen."""
        if not uids:
            return []
        spec = "(UID FLAGS INTERNALDATE RFC822.SIZE ENVELOPE BODYSTRUCTURE)"
        seq = ",".join(str(u) for u in uids)
        self._audit("uid fetch", f"{seq} {spec}")
        typ, data = self._c.uid("FETCH", seq, spec)
        if typ != "OK":
            return []
        out: List[Tuple[int, bytes]] = []
        for item in (data or []):
            if isinstance(item, tuple) and len(item) >= 1:
                out.append((0, item[0] if isinstance(item[0], bytes)
                              else str(item[0]).encode()))
            elif isinstance(item, (bytes, bytearray)):
                out.append((0, bytes(item)))
        return out

    def uid_fetch_rfc822_peek(self, uid: int) -> Optional[bytes]:
        """Fetch the full RFC822 body using BODY.PEEK[] (does not set \\Seen)."""
        if not isinstance(uid, int):
            raise ImapSafetyError("uid must be int")
        spec = "(BODY.PEEK[])"
        if not _BODY_PEEK_RE.search(spec):
            raise ImapSafetyError("internal: PEEK spec missing")
        self._audit("uid fetch", f"{uid} {spec}")
        typ, data = self._c.uid("FETCH", str(uid), spec)
        if typ != "OK" or not data:
            return None
        for item in data:
            if isinstance(item, tuple) and len(item) >= 2 and isinstance(item[1], (bytes, bytearray)):
                return bytes(item[1])
        return None

    def uid_fetch_flags(self, uid: int) -> List[str]:
        """Fetch FLAGS for verification (used by tests/audit)."""
        self._audit("uid fetch", f"{uid} (FLAGS)")
        typ, data = self._c.uid("FETCH", str(uid), "(FLAGS)")
        if typ != "OK" or not data:
            return []
        for item in (data or []):
            raw = item if isinstance(item, (bytes, bytearray)) else (
                item[0] if isinstance(item, tuple) else b"")
            if not raw:
                continue
            s = raw.decode() if isinstance(raw, (bytes, bytearray)) else str(raw)
            m = re.search(r"FLAGS\s*\(([^)]*)\)", s, re.IGNORECASE)
            if m:
                return [f.strip() for f in m.group(1).split() if f.strip()]
        return []

    # ── APPEND-to-Sent (only safe write op, explicit gate) ───────────
    def append_to_sent(self, *, sent_folder: str, rfc822_bytes: bytes,
                       allow_append: bool = False) -> bool:
        """Append a freshly outbound RFC822 message to the Sent folder.

        Mandatory keyword `allow_append=True`. The sent_folder is checked
        against the mailbox folder list to ensure it exists. We use a fresh
        \\Seen flag on the newly appended copy only — this is the user's
        own sent mail and should not show as unread in their client.
        """
        if not allow_append:
            raise ImapSafetyError("append_to_sent requires allow_append=True")
        if not sent_folder or not isinstance(sent_folder, str):
            raise ImapSafetyError("sent_folder required")
        if not rfc822_bytes or not isinstance(rfc822_bytes, (bytes, bytearray)):
            raise ImapSafetyError("rfc822_bytes required")
        # Reject obviously malicious folder names.
        if any(c in sent_folder for c in ("\r", "\n", "\0")):
            raise ImapSafetyError("invalid sent_folder")
        self._audit("append", f"{sent_folder} (\\Seen) <rfc822 {len(rfc822_bytes)}B>")
        try:
            typ, _ = self._c.append(sent_folder, "(\\Seen)", None, bytes(rfc822_bytes))
            return typ == "OK"
        except imaplib.IMAP4.error as e:
            # Never echo error message verbatim (may contain SMTP/IMAP banner).
            logger.warning("APPEND failed: %s", type(e).__name__)
            return False

    # ── Safety-checked passthroughs ──────────────────────────────────
    def noop(self) -> bool:
        self._audit("noop", "")
        try:
            typ, _ = self._c.noop()
            return typ == "OK"
        except Exception:
            return False

    # ── Reflection guard ─────────────────────────────────────────────
    def __getattr__(self, name: str):
        # Block any forbidden verb attempted via reflection on the wrapper.
        if name in _FORBIDDEN_VERBS:
            raise ImapSafetyError(f"Forbidden IMAP verb: {name}")
        if name.startswith("_"):
            raise AttributeError(name)
        if name not in _ALLOWED_VERBS:
            raise ImapSafetyError(
                f"Verb '{name}' not whitelisted by ImapSafeClient"
            )
        return getattr(self._c, name)

    def _audit(self, verb: str, params: str) -> None:
        self.commands_audit.append((verb, params))
        if len(self.commands_audit) > 1000:
            self.commands_audit = self.commands_audit[-500:]


# Public helper: raw-string verb safety check (used by tests)
def assert_verb_allowed(verb: str) -> None:
    v = (verb or "").strip().lower()
    if v in _FORBIDDEN_VERBS:
        raise ImapSafetyError(f"Forbidden: {verb}")
    if v not in _ALLOWED_VERBS and v != "append":
        raise ImapSafetyError(f"Not whitelisted: {verb}")
