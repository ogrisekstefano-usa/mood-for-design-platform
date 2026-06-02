"""Sync worker — ITER187.A Workstream P · READ_ONLY mode only.

Strategy (Phase 1):
  • For each mailbox with sync_enabled=true and is_active=true:
      - EXAMINE INBOX (and Sent if reachable) — read-only.
      - Resume from email_mailbox_cursors(uid_validity, last_uid).
      - UID SEARCH UID last_uid+1:* → list of new UIDs.
      - For each new UID:
           UID FETCH (UID FLAGS INTERNALDATE RFC822.SIZE ENVELOPE BODYSTRUCTURE)
           UID FETCH (BODY.PEEK[]) → full RFC822.
      - Parse, persist to email_messages + email_attachments + (optional)
        store body text/html in private bucket.
      - Cap each run at MAX_MESSAGES_PER_RUN to be friendly.
      - Snapshot FLAGS into imap_flags_observed but NEVER write back.
"""
from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from .connectors import MailboxConfig, open_imap, parse_rfc822_for_index
from .imap_safe import ImapSafetyError

logger = logging.getLogger(__name__)

MAX_MESSAGES_PER_RUN = 500
BODY_BUCKET = "mailbox-bodies"
ATTACHMENT_BUCKET = "mailbox-attachments"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slim_row(row: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in row.items() if k != "_id"}


def _audit(db, *, tenant_id: str, user_id: Optional[str], action: str,
            mailbox_id: str, metadata: Optional[Dict[str, Any]] = None) -> None:
    try:
        db.table("audit_logs").insert({
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "user_id": user_id,
            "action": action,
            "resource_type": "email_mailbox",
            "resource_id": mailbox_id,
            "metadata_json": metadata or {},
            "created_at": _now(),
        }).execute()
    except Exception as e:
        logger.warning("audit_log insert failed: %s", type(e).__name__)


def _verify_flags_unchanged(client, uid: int, before: List[str]) -> bool:
    """After body fetch via PEEK, re-read flags and ensure \\Seen was not
    added by us. This is the core read-only assertion (R-1)."""
    after = client.uid_fetch_flags(uid)
    before_seen = "\\Seen" in before
    after_seen = "\\Seen" in after
    # If \Seen was absent before and is present now → server set it on a
    # non-PEEK path. Abort that mailbox immediately.
    if (not before_seen) and after_seen:
        logger.error("READ-ONLY VIOLATION: uid=%s went unread→read", uid)
        return False
    return True


def sync_mailbox(db, admin_client, *, mailbox_id: str,
                  triggered_by: Optional[str] = None,
                  initial_window_days: int = 90,
                  folders: Optional[List[str]] = None) -> Dict[str, Any]:
    """Run a single READ-ONLY sync pass for the given mailbox.

    Returns a summary dict. Never raises; persistent issues are reflected
    in mailbox.connection_status / last_sync_error.
    """
    rows = (db.table("email_mailboxes").select("*")
            .eq("id", mailbox_id).limit(1).execute().data or [])
    if not rows:
        return {"ok": False, "error": "mailbox_not_found"}
    mb = rows[0]
    if not mb.get("is_active") or not mb.get("sync_enabled"):
        return {"ok": False, "error": "mailbox_disabled"}
    if mb.get("sync_mode") != "READ_ONLY":
        return {"ok": False, "error": "sync_mode_locked_phase1"}

    cfg = MailboxConfig.from_row(mb)
    tenant_id = mb["tenant_id"]

    # Mark sync start (idempotent)
    db.table("email_mailboxes").update({
        "last_sync_started_at": _now(),
        "last_sync_error": None,
        "updated_at": _now(),
    }).eq("id", mailbox_id).execute()
    _audit(db, tenant_id=tenant_id, user_id=triggered_by,
            action="mailbox.sync_started", mailbox_id=mailbox_id,
            metadata={"triggered_by": triggered_by})

    imap_pw = mb.get("imap_password_enc")
    imap_kid = mb.get("imap_password_kid")
    if not imap_pw:
        db.table("email_mailboxes").update({
            "connection_status": "error",
            "last_sync_error": "no_credentials",
            "last_sync_completed_at": _now(),
            "updated_at": _now(),
        }).eq("id", mailbox_id).execute()
        return {"ok": False, "error": "no_credentials"}

    summary = {"ok": True, "mailbox_id": mailbox_id,
                "folders": {}, "new_messages": 0, "errors": []}

    target_folders = folders or ["INBOX", cfg.sent_folder()]

    try:
        with open_imap(cfg, imap_password_blob=imap_pw,
                        imap_password_kid=imap_kid) as client:
            try:
                _ = client.list_folders()
            except Exception as e:
                summary["errors"].append(f"list:{type(e).__name__}")

            for folder in target_folders:
                if not folder:
                    continue
                try:
                    uid_validity, n_msgs = client.select_readonly(folder)
                except ImapSafetyError as e:
                    summary["errors"].append(f"select:{folder}:{e}")
                    continue
                except Exception as e:
                    summary["errors"].append(f"select:{folder}:{type(e).__name__}")
                    continue

                # cursor
                cur_rows = (db.table("email_mailbox_cursors").select("*")
                            .eq("mailbox_id", mailbox_id).eq("folder", folder)
                            .limit(1).execute().data or [])
                cur = cur_rows[0] if cur_rows else None
                last_uid = int(cur["last_uid"]) if cur else 0
                if cur and int(cur.get("uid_validity") or 0) != uid_validity:
                    # UIDVALIDITY changed — full resync
                    last_uid = 0

                # Find new UIDs
                criterion = f"UID {last_uid + 1}:*" if last_uid > 0 else "ALL"
                try:
                    uids = client.uid_search(criterion)
                except Exception as e:
                    summary["errors"].append(f"search:{folder}:{type(e).__name__}")
                    continue

                # Cap per-run to be polite
                uids = sorted(uids)[:MAX_MESSAGES_PER_RUN]
                folder_new = 0
                for uid in uids:
                    flags_before = client.uid_fetch_flags(uid)
                    raw = None
                    try:
                        raw = client.uid_fetch_rfc822_peek(uid)
                    except ImapSafetyError as e:
                        summary["errors"].append(f"peek:{e}")
                        continue
                    if not raw:
                        continue
                    if not _verify_flags_unchanged(client, uid, flags_before):
                        # Critical safety violation — abort mailbox.
                        db.table("email_mailboxes").update({
                            "connection_status": "error",
                            "last_sync_error": "READ_ONLY_VIOLATION_ABORT",
                            "sync_enabled": False,
                            "last_sync_completed_at": _now(),
                            "updated_at": _now(),
                        }).eq("id", mailbox_id).execute()
                        _audit(db, tenant_id=tenant_id, user_id=triggered_by,
                                action="mailbox.read_only_violation",
                                mailbox_id=mailbox_id,
                                metadata={"folder": folder, "uid": uid})
                        return {"ok": False, "error": "read_only_violation"}

                    try:
                        parsed = parse_rfc822_for_index(raw)
                    except Exception as e:
                        summary["errors"].append(f"parse:{type(e).__name__}")
                        continue

                    # Persist body text/html in private bucket (optional)
                    body_text_path = None
                    body_html_path = None
                    msg_id = str(uuid.uuid4())
                    try:
                        if admin_client is not None and parsed.get("body_text"):
                            p = f"{tenant_id}/{mailbox_id}/{msg_id}/body.txt"
                            try:
                                admin_client.storage.from_(BODY_BUCKET).upload(
                                    p, parsed["body_text"].encode("utf-8"),
                                    {"content-type": "text/plain", "x-upsert": "true"})
                                body_text_path = p
                            except Exception as e:
                                logger.debug("body text upload skipped: %s", type(e).__name__)
                        if admin_client is not None and parsed.get("body_html"):
                            p = f"{tenant_id}/{mailbox_id}/{msg_id}/body.html"
                            try:
                                admin_client.storage.from_(BODY_BUCKET).upload(
                                    p, parsed["body_html"].encode("utf-8"),
                                    {"content-type": "text/html", "x-upsert": "true"})
                                body_html_path = p
                            except Exception as e:
                                logger.debug("body html upload skipped: %s", type(e).__name__)
                    except Exception as e:
                        logger.debug("body upload outer: %s", type(e).__name__)

                    direction = "outbound" if folder.lower().endswith("sent") \
                        or "sent" in (folder.lower()) else "inbound"

                    try:
                        db.table("email_messages").insert({
                            "id": msg_id,
                            "tenant_id": tenant_id,
                            "mailbox_id": mailbox_id,
                            "uid_validity": uid_validity,
                            "uid": uid,
                            "message_id_header": parsed["message_id_header"],
                            "thread_id": _thread_id_from(parsed),
                            "folder": folder,
                            "direction": direction,
                            "from_addr": parsed["from_addr"],
                            "to_addrs": parsed["to_addrs"],
                            "cc_addrs": parsed["cc_addrs"],
                            "bcc_addrs": parsed["bcc_addrs"],
                            "reply_to_addrs": parsed["reply_to_addrs"],
                            "subject": parsed["subject"][:1000] if parsed["subject"] else None,
                            "snippet": parsed["snippet"],
                            "body_text_path": body_text_path,
                            "body_html_path": body_html_path,
                            "headers_json": parsed["headers"],
                            "internal_date": _now(),
                            "received_at": _parse_date(parsed.get("date")) or _now(),
                            "size_bytes": len(raw),
                            "attachments_count": len(parsed.get("attachments") or []),
                            "imap_flags_observed": flags_before,
                            "created_at": _now(),
                        }).execute()
                    except Exception as e:
                        # Likely duplicate (unique constraint). Skip silently.
                        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
                            continue
                        summary["errors"].append(f"insert:{type(e).__name__}")
                        continue

                    # Attachments
                    for att in (parsed.get("attachments") or []):
                        att_id = str(uuid.uuid4())
                        path = None
                        if admin_client is not None and att.get("payload"):
                            try:
                                fname = (att.get("filename") or "attachment.bin")[:120]
                                p = f"{tenant_id}/{mailbox_id}/{msg_id}/{att_id}_{fname}"
                                admin_client.storage.from_(ATTACHMENT_BUCKET).upload(
                                    p, att["payload"],
                                    {"content-type": att.get("mime_type") or "application/octet-stream",
                                      "x-upsert": "true"})
                                path = p
                            except Exception as e:
                                logger.debug("attachment upload skipped: %s", type(e).__name__)
                        try:
                            db.table("email_attachments").insert({
                                "id": att_id,
                                "email_message_id": msg_id,
                                "tenant_id": tenant_id,
                                "filename": att.get("filename"),
                                "mime_type": att.get("mime_type"),
                                "size_bytes": att.get("size_bytes"),
                                "storage_path": path,
                                "created_at": _now(),
                            }).execute()
                        except Exception as e:
                            logger.debug("attachment insert skipped: %s", type(e).__name__)

                    folder_new += 1
                    if uid > last_uid:
                        last_uid = uid

                # Persist cursor
                if cur is None:
                    db.table("email_mailbox_cursors").insert({
                        "id": str(uuid.uuid4()),
                        "mailbox_id": mailbox_id, "folder": folder,
                        "uid_validity": uid_validity, "last_uid": last_uid,
                        "last_sync_at": _now(),
                    }).execute()
                else:
                    db.table("email_mailbox_cursors").update({
                        "uid_validity": uid_validity, "last_uid": last_uid,
                        "last_sync_at": _now(),
                    }).eq("id", cur["id"]).execute()

                summary["folders"][folder] = {
                    "uid_validity": uid_validity, "last_uid": last_uid,
                    "new_messages": folder_new,
                }
                summary["new_messages"] += folder_new

        # Counts refresh
        inbox_count = (db.table("email_messages").select("id", count="exact")
                        .eq("mailbox_id", mailbox_id)
                        .eq("direction", "inbound").execute().count or 0)
        sent_count = (db.table("email_messages").select("id", count="exact")
                       .eq("mailbox_id", mailbox_id)
                       .eq("direction", "outbound").execute().count or 0)
        total = inbox_count + sent_count
        db.table("email_mailboxes").update({
            "connection_status": "connected",
            "last_sync_completed_at": _now(),
            "messages_inbox": inbox_count,
            "messages_sent": sent_count,
            "messages_synced_total": total,
            "updated_at": _now(),
        }).eq("id", mailbox_id).execute()
        _audit(db, tenant_id=tenant_id, user_id=triggered_by,
                action="mailbox.sync_completed", mailbox_id=mailbox_id,
                metadata={"new_messages": summary["new_messages"],
                          "errors": summary["errors"][:6]})
        return summary

    except ImapSafetyError as e:
        db.table("email_mailboxes").update({
            "connection_status": "error",
            "last_sync_error": f"safety:{str(e)[:120]}",
            "last_sync_completed_at": _now(),
            "updated_at": _now(),
        }).eq("id", mailbox_id).execute()
        return {"ok": False, "error": "safety", "detail": str(e)[:120]}
    except Exception as e:
        db.table("email_mailboxes").update({
            "connection_status": "error",
            "last_sync_error": f"{type(e).__name__}",
            "last_sync_completed_at": _now(),
            "updated_at": _now(),
        }).eq("id", mailbox_id).execute()
        return {"ok": False, "error": type(e).__name__}


def _thread_id_from(parsed: Dict[str, Any]) -> Optional[str]:
    """Cheap thread id: References tail or In-Reply-To, else None."""
    refs = parsed.get("references") or ""
    if refs:
        ids = re.findall(r"<([^>]+)>", refs)
        if ids:
            return ids[-1][:200]
    irt = parsed.get("in_reply_to") or ""
    m = re.search(r"<([^>]+)>", irt)
    if m:
        return m.group(1)[:200]
    return None


def _parse_date(s: Optional[str]) -> Optional[str]:
    if not s:
        return None
    try:
        from email.utils import parsedate_to_datetime
        dt = parsedate_to_datetime(s)
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return None
