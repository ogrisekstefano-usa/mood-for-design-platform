"""Journey Mail Intelligence™ Router — ITER187.A · `/api/journey-mail`.

Phase 1 endpoints (locked scope):
  Mailboxes
    GET    /mailboxes
    POST   /mailboxes
    GET    /mailboxes/{id}
    PATCH  /mailboxes/{id}
    PUT    /mailboxes/{id}/credentials       · rotate IMAP/SMTP password
    DELETE /mailboxes/{id}                   · soft delete
    GET    /mailboxes/{id}/health
    POST   /mailboxes/{id}/sync
  Messages
    GET    /mailboxes/{id}/messages
    GET    /messages/{mid}
    GET    /messages                         · ?linked_type=…&linked_id=…
  Links (manual only)
    POST   /messages/{mid}/links
    DELETE /messages/{mid}/links/{lid}
  Send
    POST   /mailboxes/{id}/send

All endpoints enforce visibility_scope. No endpoint ever echoes a password.
"""
from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from core.tenant_context import get_tenant_context
from cultural_engine.mail.connectors import (MailboxConfig, health_probe,
                                                send_smtp, PROVIDER_DEFAULTS)
from cultural_engine.mail.imap_safe import ImapSafeClient, ImapSafetyError
from cultural_engine.mail.sync_worker import sync_mailbox
from cultural_engine.mail.vault import VaultSecret, encrypt_secret
from database import db, get_admin_client

logger = logging.getLogger(__name__)
router = APIRouter()

VALID_LINK_TYPES = {"lead", "prospect", "customer", "account", "journey", "contact"}
VALID_MAILBOX_TYPES = {"shared", "team", "personal", "system"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slim_public(row: Dict[str, Any]) -> Dict[str, Any]:
    """Return a mailbox row safe to echo via API. Passwords -> booleans."""
    if not row:
        return {}
    cleaned: Dict[str, Any] = {}
    for k, v in row.items():
        if k in ("_id", "imap_password_enc", "smtp_password_enc",
                  "imap_password_kid", "smtp_password_kid"):
            continue
        cleaned[k] = v
    cleaned["imap_password_set"] = bool(row.get("imap_password_enc"))
    cleaned["smtp_password_set"] = bool(row.get("smtp_password_enc"))
    return cleaned


def _user_is_super(ctx) -> bool:
    return bool(ctx.get("is_super_admin") or ctx.get("is_root")
                or ctx.get("is_root_superadmin")
                or str(ctx.get("role") or "") in ("super_admin", "root_superadmin"))


def _user_roles(ctx) -> List[str]:
    """Return the caller's role list — supports both legacy single-role
    `ctx['role']` (string) and any future multi-role list."""
    multi = ctx.get("roles") or []
    if isinstance(multi, str):
        multi = [multi]
    single = ctx.get("role")
    out = [str(r) for r in multi]
    if single:
        out.append(str(single))
    return out


def _can_access(ctx, mailbox: Dict[str, Any], *,
                  required: str = "mailbox_view") -> bool:
    """Evaluate visibility_scope against the caller. See PRD §2.2.

    `required` is one of: mailbox_view | mailbox_send | mailbox_link | mailbox_admin.
    Phase 1 keeps semantics simple: if visibility_scope grants visibility, all
    four implicit permissions are granted to the same set. mailbox_admin
    additionally requires a tenant_admin role unless owner_only/personal owner.
    """
    if _user_is_super(ctx):
        return True
    if str(ctx.get("tenant_id")) != str(mailbox.get("tenant_id")):
        return False
    scope = mailbox.get("visibility_scope") or {"mode": "tenant"}
    mode = scope.get("mode") or "tenant"
    user_id = str(ctx.get("profile_id") or ctx.get("user_id") or "")
    roles = set(_user_roles(ctx))
    visible = False
    if mode == "tenant":
        visible = True
    elif mode == "owner_only":
        visible = (user_id and user_id == str(mailbox.get("created_by") or ""))
    elif mode == "roles":
        allowed = set(scope.get("roles") or [])
        visible = bool(roles & allowed)
    elif mode == "members":
        member_ids = set(str(x) for x in (scope.get("member_ids") or []))
        role_allow = set(scope.get("roles") or [])
        visible = (user_id in member_ids) or bool(roles & role_allow)
    if not visible:
        return False
    if required == "mailbox_admin":
        # admin requires explicit elevation
        return "tenant_admin" in roles or "super_admin" in roles \
            or user_id == str(mailbox.get("created_by") or "")
    return True


def _require_mailbox(c, ctx, mailbox_id: str, *,
                      required: str = "mailbox_view") -> Dict[str, Any]:
    rows = (c.table("email_mailboxes").select("*")
            .eq("id", mailbox_id).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Mailbox non trovata")
    mb = rows[0]
    if not _can_access(ctx, mb, required=required):
        raise HTTPException(403, "Permesso insufficiente per questa mailbox")
    return mb


def _audit(tenant_id: str, user_id: Optional[str], action: str,
            resource_id: str, metadata: Optional[Dict[str, Any]] = None) -> None:
    try:
        db().table("audit_logs").insert({
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id, "user_id": user_id,
            "action": action,
            "resource_type": "email_mailbox",
            "resource_id": resource_id,
            "metadata_json": metadata or {},
            "created_at": _now(),
        }).execute()
    except Exception as e:
        logger.warning("audit insert failed: %s", type(e).__name__)


# ─── Pydantic models ─────────────────────────────────────────────────
class VisibilityScope(BaseModel):
    mode: str = Field("tenant", pattern="^(tenant|roles|members|owner_only)$")
    roles: Optional[List[str]] = None
    member_ids: Optional[List[str]] = None


class MailboxCreate(BaseModel):
    mailbox_name: str
    mailbox_description: Optional[str] = None
    mailbox_type: str = "shared"
    from_name: str
    from_email: EmailStr
    reply_to_email: Optional[EmailStr] = None
    imap_host: str
    imap_port: int = 993
    imap_security: str = "ssl"
    imap_username: str
    imap_password: str = Field(..., min_length=1)
    smtp_host: str
    smtp_port: int = 587
    smtp_security: str = "starttls"
    smtp_username: str
    smtp_password: str = Field(..., min_length=1)
    is_primary: bool = False
    provider_hint: Optional[str] = None
    visibility_scope: Optional[VisibilityScope] = None


class MailboxPatch(BaseModel):
    mailbox_name: Optional[str] = None
    mailbox_description: Optional[str] = None
    mailbox_type: Optional[str] = None
    from_name: Optional[str] = None
    reply_to_email: Optional[EmailStr] = None
    is_primary: Optional[bool] = None
    sync_enabled: Optional[bool] = None
    is_active: Optional[bool] = None
    visibility_scope: Optional[VisibilityScope] = None


class CredentialsRotate(BaseModel):
    imap_password: Optional[str] = None
    smtp_password: Optional[str] = None


class SendBody(BaseModel):
    to_addrs: List[EmailStr]
    cc_addrs: List[EmailStr] = []
    bcc_addrs: List[EmailStr] = []
    subject: str = ""
    body_text: Optional[str] = None
    body_html: Optional[str] = None
    in_reply_to: Optional[str] = None
    references: Optional[str] = None


class LinkCreate(BaseModel):
    linked_type: str
    linked_id: str
    note: Optional[str] = None


# ─── Mailboxes CRUD ──────────────────────────────────────────────────
@router.get("/mailboxes")
def list_mailboxes(ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    rows = (c.table("email_mailboxes").select("*")
            .eq("tenant_id", tid).eq("is_active", True)
            .order("is_primary", desc=True).order("created_at", desc=True)
            .execute().data or [])
    visible = [r for r in rows if _can_access(ctx, r)]
    return {"mailboxes": [_slim_public(r) for r in visible],
             "total": len(visible)}


@router.post("/mailboxes", status_code=201)
def create_mailbox(body: MailboxCreate, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    # Phase 1: only tenant_admin / super_admin may create mailboxes
    roles = set(_user_roles(ctx))
    if not (_user_is_super(ctx) or "tenant_admin" in roles or "super_admin" in roles):
        raise HTTPException(403, "Solo gli amministratori del tenant possono aggiungere mailbox")

    if body.mailbox_type not in VALID_MAILBOX_TYPES:
        raise HTTPException(400, "mailbox_type non valido")
    if body.imap_security not in ("ssl", "starttls", "plain"):
        raise HTTPException(400, "imap_security non valido")
    if body.smtp_security not in ("ssl", "starttls", "plain"):
        raise HTTPException(400, "smtp_security non valido")

    # Dedup by tenant + from_email
    dup = (c.table("email_mailboxes").select("id")
            .eq("tenant_id", tid)
            .eq("from_email", body.from_email)
            .limit(1).execute().data or [])
    if dup:
        raise HTTPException(409, "Una mailbox con questa email esiste già in questo tenant")

    mailbox_id = str(uuid.uuid4())
    imap_blob, imap_kid = encrypt_secret(body.imap_password,
                                           tenant_id=tid, mailbox_id=mailbox_id)
    smtp_blob, smtp_kid = encrypt_secret(body.smtp_password,
                                           tenant_id=tid, mailbox_id=mailbox_id)
    meta = {"provider_hint": body.provider_hint} if body.provider_hint else {}
    if body.provider_hint and body.provider_hint in PROVIDER_DEFAULTS:
        meta["sent_folder"] = PROVIDER_DEFAULTS[body.provider_hint]["sent_folder"]

    visibility = body.visibility_scope.model_dump() if body.visibility_scope \
        else {"mode": "tenant"}

    row = {
        "id": mailbox_id, "tenant_id": tid,
        "mailbox_name": body.mailbox_name.strip()[:200],
        "mailbox_description": (body.mailbox_description or "").strip()[:500] or None,
        "mailbox_type": body.mailbox_type,
        "from_name": body.from_name.strip()[:120],
        "from_email": str(body.from_email),
        "reply_to_email": str(body.reply_to_email) if body.reply_to_email else None,
        "imap_host": body.imap_host.strip()[:200], "imap_port": body.imap_port,
        "imap_security": body.imap_security, "imap_username": body.imap_username.strip()[:200],
        "imap_password_enc": imap_blob, "imap_password_kid": imap_kid,
        "smtp_host": body.smtp_host.strip()[:200], "smtp_port": body.smtp_port,
        "smtp_security": body.smtp_security, "smtp_username": body.smtp_username.strip()[:200],
        "smtp_password_enc": smtp_blob, "smtp_password_kid": smtp_kid,
        "sync_enabled": True, "sync_mode": "READ_ONLY",
        "is_primary": bool(body.is_primary),
        "is_active": True,
        "visibility_scope": visibility,
        "connection_status": "unknown",
        "metadata_json": meta,
        "created_by": ctx.get("profile_id") or ctx.get("user_id"),
        "created_at": _now(), "updated_at": _now(),
    }
    try:
        c.table("email_mailboxes").insert(row).execute()
    except Exception as e:
        if "primary" in str(e).lower():
            raise HTTPException(409, "Esiste già una mailbox primaria in questo tenant")
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(409, "Mailbox duplicata")
        raise HTTPException(500, "Creazione fallita")
    _audit(tid, ctx.get("profile_id"), "mailbox.added", mailbox_id,
            {"from_email": body.from_email, "type": body.mailbox_type})
    saved = (c.table("email_mailboxes").select("*").eq("id", mailbox_id)
              .limit(1).execute().data or [{}])[0]
    return _slim_public(saved)


@router.get("/mailboxes/{mailbox_id}")
def get_mailbox(mailbox_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    mb = _require_mailbox(c, ctx, mailbox_id)
    return _slim_public(mb)


@router.patch("/mailboxes/{mailbox_id}")
def patch_mailbox(mailbox_id: str, body: MailboxPatch,
                    ctx=Depends(get_tenant_context)):
    c = db()
    mb = _require_mailbox(c, ctx, mailbox_id, required="mailbox_admin")
    update = {}
    raw = body.model_dump(exclude_unset=True)
    for k, v in raw.items():
        if v is None:
            continue
        if k == "visibility_scope":
            update[k] = v if isinstance(v, dict) else v
        else:
            update[k] = v
    if not update:
        raise HTTPException(400, "Nessun campo da aggiornare")
    if "mailbox_type" in update and update["mailbox_type"] not in VALID_MAILBOX_TYPES:
        raise HTTPException(400, "mailbox_type non valido")
    update["updated_at"] = _now()
    c.table("email_mailboxes").update(update).eq("id", mailbox_id).execute()
    _audit(mb["tenant_id"], ctx.get("profile_id"), "mailbox.edited",
            mailbox_id, {"fields": sorted(update.keys())})
    saved = (c.table("email_mailboxes").select("*").eq("id", mailbox_id)
              .limit(1).execute().data or [{}])[0]
    return _slim_public(saved)


@router.put("/mailboxes/{mailbox_id}/credentials")
def rotate_credentials(mailbox_id: str, body: CredentialsRotate,
                         ctx=Depends(get_tenant_context)):
    c = db()
    mb = _require_mailbox(c, ctx, mailbox_id, required="mailbox_admin")
    update: Dict[str, Any] = {}
    if body.imap_password:
        blob, kid = encrypt_secret(body.imap_password,
                                     tenant_id=mb["tenant_id"], mailbox_id=mailbox_id)
        update["imap_password_enc"] = blob
        update["imap_password_kid"] = kid
    if body.smtp_password:
        blob, kid = encrypt_secret(body.smtp_password,
                                     tenant_id=mb["tenant_id"], mailbox_id=mailbox_id)
        update["smtp_password_enc"] = blob
        update["smtp_password_kid"] = kid
    if not update:
        raise HTTPException(400, "Nessuna password da aggiornare")
    update["updated_at"] = _now()
    c.table("email_mailboxes").update(update).eq("id", mailbox_id).execute()
    _audit(mb["tenant_id"], ctx.get("profile_id"),
            "mailbox.credentials_rotated", mailbox_id,
            {"rotated": [k.replace("_password_enc", "") for k in update if k.endswith("_enc")]})
    return {"rotated": True}


@router.delete("/mailboxes/{mailbox_id}")
def soft_delete_mailbox(mailbox_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    mb = _require_mailbox(c, ctx, mailbox_id, required="mailbox_admin")
    c.table("email_mailboxes").update({
        "is_active": False, "sync_enabled": False,
        "updated_at": _now(),
    }).eq("id", mailbox_id).execute()
    _audit(mb["tenant_id"], ctx.get("profile_id"),
            "mailbox.deleted", mailbox_id, {"soft": True})
    return {"deleted": mailbox_id}


# ─── Health & Sync ───────────────────────────────────────────────────
@router.get("/system/health")
def system_health(ctx=Depends(get_tenant_context)):
    """ITER189-pre Phase 7 · Journey Mail Health (monitoring, not a feature).

    Returns four operational checks for the calling tenant:
      - bucket_ok            : mailbox-bodies bucket exists
      - mailboxes_fresh_ok   : every active mailbox has last_sync_completed_at < 24h
      - audit_trail_clean_ok : no read-only violations in last 30 days
      - no_failed_health_ok  : no mailbox with connection_status = "error"
    """
    from database import get_admin_client as _adm
    c = db()
    tid = ctx["tenant_id"]
    checks = {}

    # 1. mailbox-bodies bucket exists
    bucket_ok = False
    bucket_detail: Dict[str, Any] = {}
    try:
        admin = _adm()
        if admin is not None:
            names = [b.name for b in admin.storage.list_buckets()]
            bucket_ok = "mailbox-bodies" in names
            bucket_detail = {"buckets_seen": len(names), "mailbox_bodies_present": bucket_ok}
        else:
            bucket_detail = {"error": "admin_client_unavailable"}
    except Exception as e:
        bucket_detail = {"error": type(e).__name__}
    checks["bucket_ok"] = {"ok": bucket_ok, **bucket_detail}

    # 2. mailboxes fresh (last_sync_completed_at < 24h for each active mailbox)
    mboxes = (c.table("email_mailboxes").select(
        "id, mailbox_name, is_active, sync_enabled, "
        "last_sync_completed_at, connection_status").eq("tenant_id", tid)
        .eq("is_active", True).execute().data or [])
    from datetime import datetime, timedelta, timezone
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    stale = []
    for mb in mboxes:
        ts = mb.get("last_sync_completed_at")
        if not ts:
            stale.append({"id": mb["id"], "name": mb["mailbox_name"], "reason": "never_synced"})
            continue
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            if dt < cutoff:
                stale.append({"id": mb["id"], "name": mb["mailbox_name"],
                              "last_sync": ts, "reason": "stale"})
        except Exception:
            stale.append({"id": mb["id"], "name": mb["mailbox_name"], "reason": "parse_error"})
    checks["mailboxes_fresh_ok"] = {
        "ok": len(stale) == 0,
        "total_active": len(mboxes),
        "stale_count": len(stale),
        "stale": stale[:10],
    }

    # 3. audit trail clean — no read-only violations in last 30 days
    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    try:
        v_rows = (c.table("email_audit_events")
                  .select("id, created_at, mailbox_id, action")
                  .eq("tenant_id", tid)
                  .in_("action", ["mailbox.read_only_violation"])
                  .gte("created_at", since).execute().data or [])
    except Exception:
        v_rows = []
    checks["audit_trail_clean_ok"] = {
        "ok": len(v_rows) == 0,
        "violations_30d": len(v_rows),
        "samples": v_rows[:5],
    }

    # 4. no failed health: no mailbox with status=error
    failed = [mb for mb in mboxes if mb.get("connection_status") == "error"]
    checks["no_failed_health_ok"] = {
        "ok": len(failed) == 0,
        "failed_mailbox_count": len(failed),
        "failed": [{"id": m["id"], "name": m["mailbox_name"]} for m in failed[:10]],
    }

    overall_ok = all(c["ok"] for c in checks.values())
    return {
        "ok": overall_ok,
        "tenant_id": tid,
        "checked_at": _now(),
        "checks": checks,
    }


@router.get("/mailboxes/{mailbox_id}/health")
def mailbox_health(mailbox_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    mb = _require_mailbox(c, ctx, mailbox_id)
    cfg = MailboxConfig.from_row(mb)
    payload = health_probe(
        cfg,
        imap_password_blob=mb.get("imap_password_enc") or None,
        imap_password_kid=mb.get("imap_password_kid"),
        smtp_password_blob=mb.get("smtp_password_enc") or None,
        smtp_password_kid=mb.get("smtp_password_kid"),
    )
    overall = "connected" if payload["imap"]["ok"] and payload["smtp"]["ok"] else \
        ("error" if not payload["imap"]["ok"] else "warning")
    c.table("email_mailboxes").update({
        "connection_status": overall,
        "last_health_check_at": _now(),
        "updated_at": _now(),
    }).eq("id", mailbox_id).execute()
    _audit(mb["tenant_id"], ctx.get("profile_id"),
            "mailbox.health_probe", mailbox_id,
            {"imap_ok": payload["imap"]["ok"], "smtp_ok": payload["smtp"]["ok"]})
    return {
        "mailbox_id": mailbox_id,
        "connection_status": overall,
        "imap": payload["imap"],
        "smtp": payload["smtp"],
        "sync": {
            "last_started_at": mb.get("last_sync_started_at"),
            "last_completed_at": mb.get("last_sync_completed_at"),
            "last_error": mb.get("last_sync_error"),
            "messages_synced_total": mb.get("messages_synced_total"),
            "messages_inbox": mb.get("messages_inbox"),
            "messages_sent": mb.get("messages_sent"),
        },
        "checked_at": _now(),
    }


def _bg_sync(mailbox_id: str, user_id: Optional[str]) -> None:
    try:
        sync_mailbox(db(), get_admin_client(),
                       mailbox_id=mailbox_id, triggered_by=user_id)
    except Exception as e:
        logger.exception("sync background failed: %s", type(e).__name__)


@router.post("/mailboxes/{mailbox_id}/sync")
def trigger_sync(mailbox_id: str, background_tasks: BackgroundTasks,
                  ctx=Depends(get_tenant_context)):
    c = db()
    mb = _require_mailbox(c, ctx, mailbox_id)
    if not mb.get("is_active") or not mb.get("sync_enabled"):
        raise HTTPException(409, "Mailbox disattivata")
    background_tasks.add_task(_bg_sync, mailbox_id, ctx.get("profile_id"))
    return {"status": "queued", "mailbox_id": mailbox_id}


# ─── Messages ────────────────────────────────────────────────────────
@router.get("/mailboxes/{mailbox_id}/messages")
def list_mailbox_messages(mailbox_id: str,
                            folder: Optional[str] = None,
                            q: Optional[str] = None,
                            limit: int = 50, offset: int = 0,
                            ctx=Depends(get_tenant_context)):
    c = db()
    mb = _require_mailbox(c, ctx, mailbox_id)
    query = (c.table("email_messages")
             .select("id,mailbox_id,folder,direction,from_addr,to_addrs,"
                      "subject,snippet,received_at,attachments_count,"
                      "imap_flags_observed,thread_id")
             .eq("tenant_id", mb["tenant_id"])
             .eq("mailbox_id", mailbox_id)
             .order("received_at", desc=True))
    if folder:
        query = query.eq("folder", folder)
    if q:
        query = query.ilike("subject", f"%{q}%")
    rows = query.range(offset, offset + min(200, max(1, limit)) - 1).execute().data or []
    return {"messages": rows, "count": len(rows),
             "offset": offset, "limit": limit}


@router.get("/messages/{mid}")
def get_message(mid: str, ctx=Depends(get_tenant_context)):
    c = db()
    rows = (c.table("email_messages").select("*").eq("id", mid)
             .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Messaggio non trovato")
    msg = rows[0]
    mb = _require_mailbox(c, ctx, msg["mailbox_id"])
    # Resolve attachments + links
    atts = (c.table("email_attachments").select("*")
             .eq("email_message_id", mid).execute().data or [])
    links = (c.table("email_links").select("*")
              .eq("email_message_id", mid).execute().data or [])
    # Signed body URLs (60s, private bucket)
    admin = get_admin_client()
    body_text_url = None
    body_html_url = None
    try:
        if admin and msg.get("body_text_path"):
            signed = admin.storage.from_("mailbox-bodies") \
                .create_signed_url(msg["body_text_path"], 60)
            body_text_url = signed.get("signedURL") or signed.get("signedUrl")
        if admin and msg.get("body_html_path"):
            signed = admin.storage.from_("mailbox-bodies") \
                .create_signed_url(msg["body_html_path"], 60)
            body_html_url = signed.get("signedURL") or signed.get("signedUrl")
    except Exception:
        pass
    return {
        "message": {**msg, "_id": None},
        "attachments": atts,
        "links": links,
        "body_text_url": body_text_url,
        "body_html_url": body_html_url,
        "url_ttl_seconds": 60,
    }


@router.get("/messages")
def list_messages_by_link(linked_type: str, linked_id: str,
                            limit: int = 50, offset: int = 0,
                            ctx=Depends(get_tenant_context)):
    if linked_type not in VALID_LINK_TYPES:
        raise HTTPException(400, "linked_type non valido")
    c = db()
    tid = ctx["tenant_id"]
    # Find linked msg ids
    link_rows = (c.table("email_links").select("email_message_id")
                  .eq("tenant_id", tid)
                  .eq("linked_type", linked_type)
                  .eq("linked_id", linked_id).execute().data or [])
    ids = [r["email_message_id"] for r in link_rows]
    if not ids:
        return {"messages": [], "count": 0}
    rows = (c.table("email_messages")
            .select("id,mailbox_id,folder,direction,from_addr,to_addrs,"
                     "subject,snippet,received_at,attachments_count")
            .eq("tenant_id", tid)
            .in_("id", ids)
            .order("received_at", desc=True)
            .range(offset, offset + min(200, max(1, limit)) - 1)
            .execute().data or [])
    # Filter by mailbox visibility
    mb_ids = sorted({r["mailbox_id"] for r in rows})
    mboxes = (c.table("email_mailboxes").select("*")
               .in_("id", mb_ids).execute().data or []) if mb_ids else []
    mb_by_id = {m["id"]: m for m in mboxes}
    visible = [r for r in rows
                if (mb_by_id.get(r["mailbox_id"]) is not None
                     and _can_access(ctx, mb_by_id[r["mailbox_id"]]))]
    return {"messages": visible, "count": len(visible)}


# ─── Links (manual only) ─────────────────────────────────────────────
@router.post("/messages/{mid}/links", status_code=201)
def create_link(mid: str, body: LinkCreate, ctx=Depends(get_tenant_context)):
    if body.linked_type not in VALID_LINK_TYPES:
        raise HTTPException(400, "linked_type non valido")
    c = db()
    msg_rows = (c.table("email_messages").select("*").eq("id", mid)
                 .limit(1).execute().data or [])
    if not msg_rows:
        raise HTTPException(404, "Messaggio non trovato")
    msg = msg_rows[0]
    mb = _require_mailbox(c, ctx, msg["mailbox_id"])
    link_id = str(uuid.uuid4())
    try:
        c.table("email_links").insert({
            "id": link_id, "tenant_id": mb["tenant_id"],
            "email_message_id": mid,
            "linked_type": body.linked_type, "linked_id": body.linked_id,
            "linked_by": ctx.get("profile_id"),
            "linked_at": _now(),
            "note": body.note,
        }).execute()
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(409, "Associazione già esistente")
        raise HTTPException(500, "Creazione associazione fallita")
    _audit(mb["tenant_id"], ctx.get("profile_id"),
            "mailbox.link_created", mb["id"],
            {"email_message_id": mid, "linked_type": body.linked_type,
              "linked_id": body.linked_id})
    return {"id": link_id, "email_message_id": mid,
             "linked_type": body.linked_type, "linked_id": body.linked_id}


@router.delete("/messages/{mid}/links/{lid}")
def delete_link(mid: str, lid: str, ctx=Depends(get_tenant_context)):
    c = db()
    rows = (c.table("email_links").select("*").eq("id", lid)
             .limit(1).execute().data or [])
    if not rows or rows[0]["email_message_id"] != mid:
        raise HTTPException(404, "Associazione non trovata")
    msg = (c.table("email_messages").select("*").eq("id", mid)
            .limit(1).execute().data or [{}])[0]
    if not msg:
        raise HTTPException(404, "Messaggio non trovato")
    _require_mailbox(c, ctx, msg["mailbox_id"])
    c.table("email_links").delete().eq("id", lid).execute()
    _audit(rows[0]["tenant_id"], ctx.get("profile_id"),
            "mailbox.link_removed", msg["mailbox_id"],
            {"email_message_id": mid, "link_id": lid})
    return {"deleted": lid}


# ─── Send (SMTP + best-effort APPEND-to-Sent) ────────────────────────
def _build_rfc822(*, from_name: str, from_email: str, to: List[str],
                   cc: List[str], bcc: List[str], subject: str,
                   body_text: Optional[str], body_html: Optional[str],
                   in_reply_to: Optional[str], references: Optional[str],
                   reply_to: Optional[str]) -> bytes:
    msg = EmailMessage()
    msg["From"] = f"{from_name} <{from_email}>" if from_name else from_email
    msg["To"] = ", ".join(to) if to else ""
    if cc:
        msg["Cc"] = ", ".join(cc)
    msg["Subject"] = subject or ""
    if reply_to:
        msg["Reply-To"] = reply_to
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
    if references:
        msg["References"] = references
    msg["Message-Id"] = f"<{uuid.uuid4()}@{from_email.split('@',1)[-1]}>"
    if body_text:
        msg.set_content(body_text)
    if body_html:
        if body_text:
            msg.add_alternative(body_html, subtype="html")
        else:
            msg.set_content(body_html, subtype="html")
    return msg.as_bytes()


@router.post("/mailboxes/{mailbox_id}/send")
def send_email(mailbox_id: str, body: SendBody,
                ctx=Depends(get_tenant_context)):
    c = db()
    mb = _require_mailbox(c, ctx, mailbox_id, required="mailbox_send")
    if not (body.body_text or body.body_html):
        raise HTTPException(400, "Corpo del messaggio mancante")
    cfg = MailboxConfig.from_row(mb)
    rfc822 = _build_rfc822(
        from_name=mb.get("from_name") or "", from_email=mb["from_email"],
        to=[str(x) for x in body.to_addrs],
        cc=[str(x) for x in body.cc_addrs],
        bcc=[str(x) for x in body.bcc_addrs],
        subject=body.subject, body_text=body.body_text, body_html=body.body_html,
        in_reply_to=body.in_reply_to, references=body.references,
        reply_to=mb.get("reply_to_email"),
    )
    smtp_pw = mb.get("smtp_password_enc")
    if not smtp_pw:
        raise HTTPException(409, "SMTP non configurato")
    envelope_to = (list(body.to_addrs) + list(body.cc_addrs) + list(body.bcc_addrs))
    ok, resp = send_smtp(cfg,
                          smtp_password_blob=smtp_pw,
                          smtp_password_kid=mb.get("smtp_password_kid"),
                          rfc822_bytes=rfc822,
                          envelope_from=mb["from_email"],
                          envelope_to=[str(x) for x in envelope_to])
    # Best-effort APPEND-to-Sent
    append_ok = False
    append_err = None
    if ok:
        imap_pw = mb.get("imap_password_enc")
        if imap_pw:
            try:
                with VaultSecret.from_blob(imap_pw,
                                             tenant_id=mb["tenant_id"],
                                             mailbox_id=mailbox_id,
                                             kid=mb.get("imap_password_kid")) as s:
                    client = ImapSafeClient.connect(
                        host=mb["imap_host"], port=mb["imap_port"],
                        security=mb["imap_security"],
                        username=mb["imap_username"], password=s.reveal(),
                    )
                try:
                    append_ok = client.append_to_sent(
                        sent_folder=cfg.sent_folder(),
                        rfc822_bytes=rfc822, allow_append=True)
                    if not append_ok:
                        append_err = "append_failed"
                finally:
                    client.close()
            except Exception as e:
                append_err = f"{type(e).__name__}"
    outbound_id = str(uuid.uuid4())
    try:
        c.table("email_outbound_sent").insert({
            "id": outbound_id,
            "tenant_id": mb["tenant_id"], "mailbox_id": mailbox_id,
            "from_email": mb["from_email"],
            "to_addrs": [str(x) for x in body.to_addrs],
            "cc_addrs": [str(x) for x in body.cc_addrs],
            "bcc_addrs": [str(x) for x in body.bcc_addrs],
            "subject": body.subject,
            "smtp_response": resp[:200] if isinstance(resp, str) else None,
            "smtp_ok": ok,
            "smtp_sent_at": _now() if ok else None,
            "append_to_sent_ok": append_ok,
            "append_to_sent_error": append_err,
            "sent_by": ctx.get("profile_id"),
            "created_at": _now(),
        }).execute()
    except Exception as e:
        logger.warning("outbound log insert failed: %s", type(e).__name__)
    _audit(mb["tenant_id"], ctx.get("profile_id"),
            "mailbox.send_email" if ok else "mailbox.send_failure",
            mailbox_id,
            {"to_count": len(body.to_addrs),
              "smtp_ok": ok, "append_to_sent_ok": append_ok,
              "outbound_append_to_sent": append_ok,
              "append_error": append_err})
    if not ok:
        raise HTTPException(502, f"Invio SMTP fallito ({resp})")
    return {
        "ok": True,
        "outbound_id": outbound_id,
        "smtp_response": "ok",
        "outbound_append_to_sent": append_ok,
        "append_warning": append_err,
    }
