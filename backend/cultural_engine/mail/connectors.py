"""MailboxConnector — ITER187.A · provider-agnostic IMAP+SMTP facade.

Phase 1 uses generic ImapSmtpConnector with provider hints (Gmail, Outlook,
SiteGround, Exchange). OAuth is Phase 2.

The connector composes two narrow surfaces:
  • ImapSafeClient  → read-only IMAP (vetted whitelist)
  • SmtpSender      → SMTP send + best-effort APPEND-to-Sent

Never logs/exposes credentials. Uses VaultSecret context manager.
"""
from __future__ import annotations

import email
import email.policy
import logging
import smtplib
import ssl
from dataclasses import dataclass, field
from email.message import EmailMessage
from typing import Any, Dict, List, Optional, Tuple

from .imap_safe import ImapSafeClient, ImapSafetyError
from .vault import VaultSecret, decrypt_secret

logger = logging.getLogger(__name__)


PROVIDER_DEFAULTS = {
    "gmail":      {"imap_host": "imap.gmail.com",      "imap_port": 993, "imap_security": "ssl",
                    "smtp_host": "smtp.gmail.com",      "smtp_port": 587, "smtp_security": "starttls",
                    "sent_folder": "[Gmail]/Sent Mail"},
    "outlook":    {"imap_host": "outlook.office365.com","imap_port": 993, "imap_security": "ssl",
                    "smtp_host": "smtp.office365.com",  "smtp_port": 587, "smtp_security": "starttls",
                    "sent_folder": "Sent Items"},
    "siteground": {"imap_host": "imap.siteground.com", "imap_port": 993, "imap_security": "ssl",
                    "smtp_host": "smtp.siteground.com", "smtp_port": 465, "smtp_security": "ssl",
                    "sent_folder": "INBOX.Sent"},
    "exchange":   {"imap_host": "outlook.office365.com","imap_port": 993, "imap_security": "ssl",
                    "smtp_host": "smtp.office365.com",  "smtp_port": 587, "smtp_security": "starttls",
                    "sent_folder": "Sent Items"},
}


@dataclass
class MailboxConfig:
    id: str
    tenant_id: str
    from_name: str
    from_email: str
    imap_host: str
    imap_port: int
    imap_security: str
    imap_username: str
    smtp_host: str
    smtp_port: int
    smtp_security: str
    smtp_username: str
    sync_mode: str = "READ_ONLY"
    provider_hint: Optional[str] = None
    sent_folder_hint: Optional[str] = None
    extra: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_row(cls, row: Dict[str, Any]) -> "MailboxConfig":
        meta = row.get("metadata_json") or {}
        return cls(
            id=row["id"], tenant_id=row["tenant_id"],
            from_name=row.get("from_name") or "",
            from_email=row.get("from_email") or "",
            imap_host=row.get("imap_host"), imap_port=int(row.get("imap_port") or 993),
            imap_security=row.get("imap_security") or "ssl",
            imap_username=row.get("imap_username"),
            smtp_host=row.get("smtp_host"), smtp_port=int(row.get("smtp_port") or 587),
            smtp_security=row.get("smtp_security") or "starttls",
            smtp_username=row.get("smtp_username"),
            sync_mode=row.get("sync_mode") or "READ_ONLY",
            provider_hint=(meta.get("provider_hint")),
            sent_folder_hint=meta.get("sent_folder"),
            extra=meta,
        )

    def sent_folder(self) -> str:
        if self.sent_folder_hint:
            return self.sent_folder_hint
        if self.provider_hint and self.provider_hint in PROVIDER_DEFAULTS:
            return PROVIDER_DEFAULTS[self.provider_hint]["sent_folder"]
        return "Sent"


# ─── Open IMAP / SMTP ────────────────────────────────────────────────
def open_imap(cfg: MailboxConfig, *, imap_password_blob: bytes,
              imap_password_kid: Optional[str]) -> ImapSafeClient:
    """Open a read-only IMAP client. Credentials live only during connect."""
    with VaultSecret.from_blob(imap_password_blob,
                                 tenant_id=cfg.tenant_id, mailbox_id=cfg.id,
                                 kid=imap_password_kid) as secret:
        return ImapSafeClient.connect(
            host=cfg.imap_host, port=cfg.imap_port, security=cfg.imap_security,
            username=cfg.imap_username, password=secret.reveal(),
        )


def send_smtp(cfg: MailboxConfig, *,
               smtp_password_blob: bytes,
               smtp_password_kid: Optional[str],
               rfc822_bytes: bytes,
               envelope_from: str,
               envelope_to: List[str]) -> Tuple[bool, str]:
    """Send a prepared RFC822 message via SMTP.

    Returns (ok, response_string). Never logs the password.
    """
    if not envelope_to:
        return False, "no recipients"
    try:
        with VaultSecret.from_blob(smtp_password_blob,
                                     tenant_id=cfg.tenant_id, mailbox_id=cfg.id,
                                     kid=smtp_password_kid) as secret:
            ctx = ssl.create_default_context()
            if cfg.smtp_security == "ssl":
                smtp = smtplib.SMTP_SSL(host=cfg.smtp_host, port=cfg.smtp_port,
                                          context=ctx, timeout=60)
            else:
                smtp = smtplib.SMTP(host=cfg.smtp_host, port=cfg.smtp_port, timeout=60)
                smtp.ehlo()
                if cfg.smtp_security == "starttls":
                    smtp.starttls(context=ctx)
                    smtp.ehlo()
            try:
                smtp.login(cfg.smtp_username, secret.reveal())
                refused = smtp.sendmail(envelope_from, envelope_to, rfc822_bytes)
                if refused:
                    return False, f"refused recipients: {len(refused)}"
                return True, "ok"
            finally:
                try:
                    smtp.quit()
                except Exception:
                    pass
    except smtplib.SMTPAuthenticationError:
        return False, "smtp_auth_failed"
    except smtplib.SMTPException as e:
        return False, f"smtp_error:{type(e).__name__}"
    except (ssl.SSLError, OSError) as e:
        return False, f"network_error:{type(e).__name__}"


# ─── Health probe ────────────────────────────────────────────────────
def health_probe(cfg: MailboxConfig, *,
                  imap_password_blob: Optional[bytes],
                  imap_password_kid: Optional[str],
                  smtp_password_blob: Optional[bytes],
                  smtp_password_kid: Optional[str]) -> Dict[str, Any]:
    """Return a redacted health payload — never echoes credentials."""
    out: Dict[str, Any] = {
        "imap": {"ok": False, "host": cfg.imap_host, "port": cfg.imap_port,
                  "security": cfg.imap_security, "capabilities": [],
                  "peek_supported": True, "last_error": None},
        "smtp": {"ok": False, "host": cfg.smtp_host, "port": cfg.smtp_port,
                  "security": cfg.smtp_security, "last_error": None},
    }
    # IMAP
    if imap_password_blob:
        try:
            with open_imap(cfg, imap_password_blob=imap_password_blob,
                            imap_password_kid=imap_password_kid) as c:
                out["imap"]["ok"] = True
                out["imap"]["capabilities"] = list(c.capabilities)[:32]
        except ImapSafetyError as e:
            out["imap"]["last_error"] = f"safety:{str(e)[:120]}"
        except Exception as e:
            out["imap"]["last_error"] = f"{type(e).__name__}"
    else:
        out["imap"]["last_error"] = "no_credentials"
    # SMTP
    if smtp_password_blob:
        try:
            with VaultSecret.from_blob(smtp_password_blob,
                                         tenant_id=cfg.tenant_id, mailbox_id=cfg.id,
                                         kid=smtp_password_kid) as secret:
                ctx = ssl.create_default_context()
                if cfg.smtp_security == "ssl":
                    smtp = smtplib.SMTP_SSL(host=cfg.smtp_host, port=cfg.smtp_port,
                                              context=ctx, timeout=20)
                else:
                    smtp = smtplib.SMTP(host=cfg.smtp_host, port=cfg.smtp_port, timeout=20)
                    smtp.ehlo()
                    if cfg.smtp_security == "starttls":
                        smtp.starttls(context=ctx)
                        smtp.ehlo()
                try:
                    smtp.login(cfg.smtp_username, secret.reveal())
                    out["smtp"]["ok"] = True
                finally:
                    try:
                        smtp.quit()
                    except Exception:
                        pass
        except smtplib.SMTPAuthenticationError:
            out["smtp"]["last_error"] = "smtp_auth_failed"
        except (smtplib.SMTPException, ssl.SSLError, OSError) as e:
            out["smtp"]["last_error"] = type(e).__name__
    else:
        out["smtp"]["last_error"] = "no_credentials"
    return out


# ─── Parser helpers (RFC822 → dict for DB) ───────────────────────────
def parse_rfc822_for_index(raw: bytes) -> Dict[str, Any]:
    """Parse the message bytes into safe metadata + body + attachments."""
    msg = email.message_from_bytes(raw, policy=email.policy.default)
    headers = {k: str(v) for k, v in msg.items()}
    text_parts: List[str] = []
    html_parts: List[str] = []
    attachments: List[Dict[str, Any]] = []
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            disp = (part.get("Content-Disposition") or "").lower()
            if ctype.startswith("multipart/"):
                continue
            if "attachment" in disp or part.get_filename():
                payload = part.get_payload(decode=True) or b""
                attachments.append({
                    "filename": part.get_filename(),
                    "mime_type": ctype,
                    "size_bytes": len(payload),
                    "payload": payload,
                })
                continue
            try:
                payload = part.get_content() if hasattr(part, "get_content") else part.get_payload(decode=True)
            except Exception:
                payload = part.get_payload(decode=True) or b""
            if isinstance(payload, bytes):
                payload = payload.decode(part.get_content_charset() or "utf-8", "replace")
            if ctype == "text/plain":
                text_parts.append(payload or "")
            elif ctype == "text/html":
                html_parts.append(payload or "")
    else:
        try:
            payload = msg.get_content()
        except Exception:
            payload = (msg.get_payload(decode=True) or b"").decode("utf-8", "replace")
        if (msg.get_content_type() or "").lower() == "text/html":
            html_parts.append(payload or "")
        else:
            text_parts.append(payload or "")

    full_text = "\n".join(t for t in text_parts if t).strip()
    full_html = "\n".join(h for h in html_parts if h).strip()
    snippet = (full_text or _strip_html(full_html))[:280]

    return {
        "headers": headers,
        "subject": str(msg.get("Subject") or ""),
        "from_addr": str(msg.get("From") or ""),
        "to_addrs": _addr_list(msg.get("To")),
        "cc_addrs": _addr_list(msg.get("Cc")),
        "bcc_addrs": _addr_list(msg.get("Bcc")),
        "reply_to_addrs": _addr_list(msg.get("Reply-To")),
        "message_id_header": str(msg.get("Message-Id") or "") or None,
        "in_reply_to": str(msg.get("In-Reply-To") or "") or None,
        "references": str(msg.get("References") or "") or None,
        "date": str(msg.get("Date") or ""),
        "snippet": snippet,
        "body_text": full_text,
        "body_html": full_html,
        "attachments": attachments,
    }


def _strip_html(html: str) -> str:
    if not html:
        return ""
    import re as _re
    out = _re.sub(r"<style.*?</style>", " ", html, flags=_re.S | _re.I)
    out = _re.sub(r"<script.*?</script>", " ", out, flags=_re.S | _re.I)
    out = _re.sub(r"<[^>]+>", " ", out)
    return _re.sub(r"\s+", " ", out).strip()


def _addr_list(raw) -> List[str]:
    if not raw:
        return []
    s = str(raw)
    parts = [p.strip() for p in s.split(",") if p.strip()]
    return parts[:32]
