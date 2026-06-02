"""AES-GCM Vault for IMAP/SMTP credentials — ITER187.A.

Phase 1 lock:
  • Plaintext NEVER stored, NEVER logged, NEVER returned via API.
  • Key derivation: HKDF-SHA256(MAILBOX_VAULT_KEY, salt = tenant_id || mailbox_id).
  • Two env keys supported simultaneously for zero-downtime rotation:
      MAILBOX_VAULT_KEY      (current, kid from MAILBOX_VAULT_KEY_KID)
      MAILBOX_VAULT_KEY_PREVIOUS (optional, kid from MAILBOX_VAULT_KEY_PREVIOUS_KID)
  • Ciphertext layout: 12-byte nonce || GCM ciphertext+tag.
  • Plaintext is held only for the duration of a single connector call;
    callers must use VaultSecret as a context manager which zeroes the
    bytearray on exit.
"""
from __future__ import annotations

import logging
import os
import secrets
from typing import Optional, Tuple

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

logger = logging.getLogger(__name__)

_NONCE_LEN = 12
_INFO = b"mood-journey-mail-vault/v1"


class VaultError(RuntimeError):
    """Raised when encryption/decryption fails. Never includes secrets."""


def _key_bytes_from_env(env_name: str) -> Optional[bytes]:
    raw = os.environ.get(env_name)
    if not raw:
        return None
    raw = raw.strip()
    # Accept hex (64 chars) or base64 (44 chars padded). Reject anything else.
    try:
        if len(raw) == 64:
            return bytes.fromhex(raw)
        import base64
        decoded = base64.b64decode(raw, validate=True)
        if len(decoded) not in (16, 24, 32):
            raise VaultError("Invalid vault key length")
        return decoded
    except Exception as e:
        raise VaultError(f"Invalid {env_name}: must be 64-char hex or base64. {type(e).__name__}")


def _resolve_key(kid: Optional[str]) -> Tuple[bytes, str]:
    """Return (raw_key_bytes, effective_kid)."""
    cur_kid = (os.environ.get("MAILBOX_VAULT_KEY_KID") or "v1").strip()
    prev_kid = (os.environ.get("MAILBOX_VAULT_KEY_PREVIOUS_KID") or "").strip()
    if not kid or kid == cur_kid:
        k = _key_bytes_from_env("MAILBOX_VAULT_KEY")
        if not k:
            raise VaultError("MAILBOX_VAULT_KEY missing")
        return k, cur_kid
    if prev_kid and kid == prev_kid:
        k = _key_bytes_from_env("MAILBOX_VAULT_KEY_PREVIOUS")
        if not k:
            raise VaultError(f"key id {kid} requested but MAILBOX_VAULT_KEY_PREVIOUS missing")
        return k, prev_kid
    raise VaultError("Unknown key id")


def _derive(master: bytes, *, tenant_id: str, mailbox_id: str) -> bytes:
    salt = f"{tenant_id}|{mailbox_id}".encode("utf-8")
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=salt, info=_INFO).derive(master)


def encrypt_secret(plaintext: str, *, tenant_id: str, mailbox_id: str) -> Tuple[str, str]:
    """Encrypt and return (postgres-bytea-hex-string, kid). NEVER log inputs.

    The returned string is in PostgreSQL bytea hex format ('\\xDEADBEEF...')
    so it can be sent over the Supabase REST API as a JSON string and stored
    natively in a BYTEA column.
    """
    if not isinstance(plaintext, str) or not plaintext:
        raise VaultError("plaintext required")
    master, kid = _resolve_key(None)
    try:
        sub = _derive(master, tenant_id=str(tenant_id), mailbox_id=str(mailbox_id))
        aes = AESGCM(sub)
        nonce = secrets.token_bytes(_NONCE_LEN)
        ct = aes.encrypt(nonce, plaintext.encode("utf-8"), None)
        blob = nonce + ct
        return "\\x" + blob.hex(), kid
    finally:
        try:
            del plaintext
        except Exception:
            pass


def _blob_to_bytes(raw) -> bytes:
    """Accept Supabase bytea encodings: bytes, memoryview, '\\xHEX' string."""
    if raw is None:
        return b""
    if isinstance(raw, (bytes, bytearray, memoryview)):
        return bytes(raw)
    s = str(raw)
    if s.startswith("\\x") or s.startswith("\\X"):
        try:
            return bytes.fromhex(s[2:])
        except ValueError:
            return b""
    # Some drivers prefix 0x or send pure hex
    if s.startswith("0x") or s.startswith("0X"):
        return bytes.fromhex(s[2:])
    try:
        # try hex
        return bytes.fromhex(s)
    except ValueError:
        # last resort: base64
        import base64
        try:
            return base64.b64decode(s, validate=True)
        except Exception:
            return b""


def decrypt_secret(blob, *, tenant_id: str, mailbox_id: str, kid: Optional[str]) -> str:
    """Decrypt and return plaintext. Caller must use it briefly and discard."""
    raw = _blob_to_bytes(blob)
    if not raw or len(raw) <= _NONCE_LEN:
        raise VaultError("ciphertext malformed")
    master, _kid = _resolve_key(kid)
    sub = _derive(master, tenant_id=str(tenant_id), mailbox_id=str(mailbox_id))
    aes = AESGCM(sub)
    nonce, ct = raw[:_NONCE_LEN], raw[_NONCE_LEN:]
    try:
        return aes.decrypt(nonce, ct, None).decode("utf-8")
    except Exception:
        raise VaultError("decrypt failed")


class VaultSecret:
    """Context manager that exposes the plaintext briefly and forgets it."""

    __slots__ = ("_buf",)

    def __init__(self, plaintext: str) -> None:
        self._buf: Optional[bytearray] = bytearray(plaintext.encode("utf-8"))

    @classmethod
    def from_blob(cls, blob, *, tenant_id: str, mailbox_id: str,
                   kid: Optional[str]) -> "VaultSecret":
        pt = decrypt_secret(blob, tenant_id=tenant_id,
                             mailbox_id=mailbox_id, kid=kid)
        return cls(pt)

    def reveal(self) -> str:
        if self._buf is None:
            raise VaultError("secret already consumed")
        return bytes(self._buf).decode("utf-8")

    def __enter__(self) -> "VaultSecret":
        return self

    def __exit__(self, *_exc) -> None:
        if self._buf is not None:
            for i in range(len(self._buf)):
                self._buf[i] = 0
            self._buf = None


def redact(text: str) -> str:
    """Use for safe logging. Replaces anything looking like a secret token."""
    if not text:
        return text
    out = text
    # Mask common credential markers (heuristic, never trust)
    for marker in ("password", "pass=", "PASS=", "AUTH="):
        idx = out.lower().find(marker.lower())
        if idx >= 0:
            out = out[: idx + len(marker)] + "***"
    return out
