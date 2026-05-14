"""Blueprint Client Collaboration Layer™ — generic foundation.

The shared review / feedback / approval engine used by Moodboard Builder PRO™
and (future) Proposal Builder PRO™. Every endpoint is entity-agnostic
(entity_type + entity_id), so onboarding a new collaborative canvas in the
future is a single client.py call.

Two surface areas:

  /api/collab/*                       → authenticated designer/PM endpoints
  /api/collab/public/{share_token}/*  → unauthenticated client endpoints
                                        (read-only review + comment + approve)

Frictionless luxury: when an unauthenticated client comments for the first
time the frontend asks for name/email ONCE and persists locally. We capture
them on every record (author_name/email) but never require a profile_id.
"""
import json
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr, Field

from core.permissions import P_COLLAB_READ, P_COLLAB_WRITE
from core.tenant_context import require_permission, audit_log
from database import db, db_available

router = APIRouter()


# ── Vocabularies (open-ended; no DB enums) ──────────────────────────────────
SUPPORTED_ENTITIES = {"moodboard", "proposal"}
VALID_COMMENT_KINDS = {"suggestion", "issue", "inspiration", "approval_note"}
VALID_PAGE_STATUSES = {"pending_review", "approved", "revision_requested", "rejected"}
VALID_ACTIVITY_EVENTS = {
    "comment_added", "comment_resolved", "comment_replied",
    "page_approved", "page_revision_requested", "page_rejected", "page_status_reset",
    "inspiration_added",
    "version_snapshot", "version_restored",
    "client_emotional_milestone",
    "handoff_to_proposal",
    "review_opened", "review_closed",
}
VALID_INSPIRATION_TYPES = {"image", "pdf", "link", "note"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_jsonish(v):
    """JSONB columns can come back as dict OR string via PostgREST."""
    if v is None:
        return None
    if isinstance(v, (dict, list)):
        return v
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return None
    return None


def _assert_entity_supported(entity_type: str) -> None:
    if entity_type not in SUPPORTED_ENTITIES:
        raise HTTPException(400, f"Unsupported entity_type: {entity_type}")


def _resolve_share(token: str) -> Dict[str, Any]:
    """Resolve a public share token → (entity_type, entity_id, tenant_id).

    For MVP the only share-token source is `moodboard_shares`. When the
    Proposal Builder ships we'll add proposal_shares and union here.
    """
    if not token:
        raise HTTPException(404, "Not found")
    client = db()
    r = client.table("moodboard_shares").select("*") \
        .eq("token", token).is_("revoked_at", "null").limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Invalid or revoked share link")
    s = r.data[0]
    # The host entity must be in a shareable state (status != draft)
    mb = client.table("moodboards").select("status, tenant_id, project_id") \
        .eq("id", s["moodboard_id"]).limit(1).execute()
    if not mb.data:
        raise HTTPException(404, "Not found")
    if mb.data[0].get("status") in (None, "draft"):
        raise HTTPException(403, "Not ready for review")
    return {
        "entity_type": "moodboard",
        "entity_id": s["moodboard_id"],
        "tenant_id": s["tenant_id"],
        "project_id": mb.data[0].get("project_id"),
    }


def _push_activity(client, *, tenant_id: str, entity_type: str, entity_id: str,
                   event_type: str, summary: str,
                   page_id: Optional[str] = None,
                   payload: Optional[dict] = None,
                   actor_id: Optional[str] = None,
                   actor_role: Optional[str] = None,
                   actor_name: Optional[str] = None) -> None:
    """Fire-and-forget activity logger. Activity failures must NEVER bubble up."""
    if event_type not in VALID_ACTIVITY_EVENTS:
        return
    try:
        client.table("collab_activity").insert({
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "page_id": page_id,
            "event_type": event_type,
            "summary": summary[:500],
            "payload_json": payload or {},
            "actor_id": actor_id,
            "actor_role": actor_role,
            "actor_name": actor_name,
        }).execute()
    except Exception:  # noqa: BLE001
        pass


def _hydrate_comment(row: dict) -> dict:
    if not row:
        return row
    out = dict(row)
    out.pop("tenant_id", None)
    # Numerics come back as Decimal — JSON-serialize as float.
    for k in ("pin_x", "pin_y"):
        if out.get(k) is not None:
            try:
                out[k] = float(out[k])
            except Exception:
                pass
    return out


def _hydrate_activity(row: dict) -> dict:
    if not row:
        return row
    out = dict(row)
    out["payload"] = _parse_jsonish(out.pop("payload_json", None)) or {}
    out.pop("tenant_id", None)
    return out


def _hydrate_inspiration(row: dict) -> dict:
    if not row:
        return row
    out = dict(row)
    out["metadata"] = _parse_jsonish(out.pop("metadata_json", None)) or {}
    out.pop("tenant_id", None)
    return out


def _hydrate_version(row: dict) -> dict:
    if not row:
        return row
    out = dict(row)
    out["snapshot"] = _parse_jsonish(out.pop("snapshot_json", None)) or {}
    out.pop("tenant_id", None)
    return out


# =============================================================================
#  Schemas
# =============================================================================
class CommentCreate(BaseModel):
    entity_type: str
    entity_id: str
    page_id: Optional[str] = None
    parent_id: Optional[str] = None
    pin_x: Optional[float] = Field(None, ge=0, le=100)
    pin_y: Optional[float] = Field(None, ge=0, le=100)
    kind: str = "suggestion"
    body: str = Field(min_length=1, max_length=4000)
    # Public-route only — ignored for authenticated requests (we take the
    # author from the auth context).
    author_name: Optional[str] = None
    author_email: Optional[EmailStr] = None


class CommentUpdate(BaseModel):
    body: Optional[str] = None
    resolved: Optional[bool] = None
    kind: Optional[str] = None


class PageStatusUpsert(BaseModel):
    entity_type: str
    entity_id: str
    page_id: str
    status: str
    decision_note: Optional[str] = None
    decided_by_name: Optional[str] = None


class InspirationCreate(BaseModel):
    entity_type: str
    entity_id: str
    type: str = "image"
    title: Optional[str] = None
    description: Optional[str] = None
    asset_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    source_url: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    uploaded_by_name: Optional[str] = None
    uploaded_by_email: Optional[EmailStr] = None


class VersionCreate(BaseModel):
    entity_type: str
    entity_id: str
    label: Optional[str] = None
    note: Optional[str] = None
    snapshot: Dict[str, Any] = Field(default_factory=dict)


class HandoffPayload(BaseModel):
    entity_type: str = "moodboard"
    entity_id: str
    note: Optional[str] = None


# =============================================================================
#  Designer / authenticated endpoints
# =============================================================================
@router.get("/comments")
def list_comments(entity_type: str = Query(...), entity_id: str = Query(...),
                  page_id: Optional[str] = Query(None),
                  resolved: Optional[bool] = Query(None),
                  ctx: dict = Depends(require_permission(P_COLLAB_READ))):
    _assert_entity_supported(entity_type)
    client = db()
    q = client.table("collab_comments").select("*") \
        .eq("tenant_id", ctx["tenant_id"]) \
        .eq("entity_type", entity_type).eq("entity_id", entity_id)
    if page_id:
        q = q.eq("page_id", page_id)
    if resolved is not None:
        q = q.eq("resolved", resolved)
    r = q.order("created_at").execute()
    return {"data": [_hydrate_comment(c) for c in (r.data or [])]}


@router.post("/comments", status_code=201)
def create_comment(body: CommentCreate,
                   ctx: dict = Depends(require_permission(P_COLLAB_WRITE))):
    return _create_comment_internal(body, tenant_id=ctx["tenant_id"],
                                    author_id=ctx["profile_id"],
                                    author_role=ctx.get("role") or "designer",
                                    author_name=ctx.get("user_name"))


@router.patch("/comments/{comment_id}")
def update_comment(comment_id: str, body: CommentUpdate,
                   ctx: dict = Depends(require_permission(P_COLLAB_WRITE))):
    client = db()
    existing_q = client.table("collab_comments").select("*") \
        .eq("id", comment_id).eq("tenant_id", ctx["tenant_id"]).limit(1).execute()
    if not existing_q.data:
        raise HTTPException(404, "Comment not found")
    existing = existing_q.data[0]
    patch = {"updated_at": _now()}
    if body.body is not None:
        patch["body"] = body.body
    if body.kind is not None:
        if body.kind not in VALID_COMMENT_KINDS:
            raise HTTPException(400, "Invalid kind")
        patch["kind"] = body.kind
    if body.resolved is not None:
        patch["resolved"] = body.resolved
        patch["resolved_at"] = _now() if body.resolved else None
        patch["resolved_by"] = ctx["profile_id"] if body.resolved else None
    upd = client.table("collab_comments").update(patch).eq("id", comment_id).execute()
    if body.resolved is True and not existing.get("resolved"):
        _push_activity(client, tenant_id=ctx["tenant_id"],
                       entity_type=existing["entity_type"],
                       entity_id=existing["entity_id"],
                       page_id=existing.get("page_id"),
                       event_type="comment_resolved",
                       summary=f"{ctx.get('user_name') or 'Designer'} resolved a comment",
                       actor_id=ctx["profile_id"],
                       actor_role=ctx.get("role"),
                       actor_name=ctx.get("user_name"))
    return _hydrate_comment(upd.data[0]) if upd.data else {}


@router.delete("/comments/{comment_id}")
def delete_comment(comment_id: str,
                   ctx: dict = Depends(require_permission(P_COLLAB_WRITE))):
    client = db()
    client.table("collab_comments").delete() \
        .eq("id", comment_id).eq("tenant_id", ctx["tenant_id"]).execute()
    return {"message": "deleted"}


@router.get("/page-status")
def list_page_status(entity_type: str = Query(...), entity_id: str = Query(...),
                     ctx: dict = Depends(require_permission(P_COLLAB_READ))):
    _assert_entity_supported(entity_type)
    client = db()
    r = client.table("collab_page_status").select("*") \
        .eq("tenant_id", ctx["tenant_id"]) \
        .eq("entity_type", entity_type).eq("entity_id", entity_id).execute()
    out = [{k: v for k, v in row.items() if k != "tenant_id"} for row in (r.data or [])]
    return {"data": out}


@router.post("/page-status")
def upsert_page_status(body: PageStatusUpsert,
                       ctx: dict = Depends(require_permission(P_COLLAB_WRITE))):
    return _upsert_page_status_internal(body, tenant_id=ctx["tenant_id"],
                                        actor_id=ctx["profile_id"],
                                        actor_role=ctx.get("role") or "designer",
                                        actor_name=ctx.get("user_name"))


@router.get("/activity")
def list_activity(entity_type: str = Query(...), entity_id: str = Query(...),
                  limit: int = Query(50, ge=1, le=200),
                  ctx: dict = Depends(require_permission(P_COLLAB_READ))):
    _assert_entity_supported(entity_type)
    client = db()
    r = client.table("collab_activity").select("*") \
        .eq("tenant_id", ctx["tenant_id"]) \
        .eq("entity_type", entity_type).eq("entity_id", entity_id) \
        .order("created_at", desc=True).limit(limit).execute()
    return {"data": [_hydrate_activity(a) for a in (r.data or [])]}


@router.get("/inspirations")
def list_inspirations(entity_type: str = Query(...), entity_id: str = Query(...),
                      ctx: dict = Depends(require_permission(P_COLLAB_READ))):
    _assert_entity_supported(entity_type)
    client = db()
    r = client.table("collab_inspirations").select("*") \
        .eq("tenant_id", ctx["tenant_id"]) \
        .eq("entity_type", entity_type).eq("entity_id", entity_id) \
        .order("created_at", desc=True).execute()
    return {"data": [_hydrate_inspiration(i) for i in (r.data or [])]}


@router.get("/versions")
def list_versions(entity_type: str = Query(...), entity_id: str = Query(...),
                  ctx: dict = Depends(require_permission(P_COLLAB_READ))):
    _assert_entity_supported(entity_type)
    client = db()
    r = client.table("collab_versions").select("*") \
        .eq("tenant_id", ctx["tenant_id"]) \
        .eq("entity_type", entity_type).eq("entity_id", entity_id) \
        .order("version_number", desc=True).execute()
    # Drop snapshot_json from the listing — large payload, fetch per-row when needed.
    out = []
    for row in (r.data or []):
        slim = dict(row)
        slim.pop("snapshot_json", None)
        slim.pop("tenant_id", None)
        out.append(slim)
    return {"data": out}


@router.post("/versions", status_code=201)
def create_version(body: VersionCreate,
                   ctx: dict = Depends(require_permission(P_COLLAB_WRITE))):
    _assert_entity_supported(body.entity_type)
    client = db()
    # Compute the next version_number atomically-ish (race-free enough for MVP).
    last = client.table("collab_versions").select("version_number") \
        .eq("entity_type", body.entity_type).eq("entity_id", body.entity_id) \
        .order("version_number", desc=True).limit(1).execute()
    next_n = ((last.data or [{}])[0].get("version_number") or 0) + 1
    row = {
        "id": str(uuid.uuid4()),
        "tenant_id": ctx["tenant_id"],
        "entity_type": body.entity_type,
        "entity_id": body.entity_id,
        "version_number": next_n,
        "label": body.label or f"Version {next_n}",
        "note": body.note,
        "snapshot_json": body.snapshot or {},
        "created_by": ctx["profile_id"],
    }
    ins = client.table("collab_versions").insert(row).execute()
    _push_activity(client, tenant_id=ctx["tenant_id"],
                   entity_type=body.entity_type, entity_id=body.entity_id,
                   event_type="version_snapshot",
                   summary=f"Version {next_n} captured" + (f" — {body.note}" if body.note else ""),
                   payload={"version_number": next_n, "label": row["label"]},
                   actor_id=ctx["profile_id"], actor_role=ctx.get("role"),
                   actor_name=ctx.get("user_name"))
    return _hydrate_version(ins.data[0]) if ins.data else row


@router.get("/versions/{version_id}")
def get_version(version_id: str,
                ctx: dict = Depends(require_permission(P_COLLAB_READ))):
    client = db()
    r = client.table("collab_versions").select("*") \
        .eq("id", version_id).eq("tenant_id", ctx["tenant_id"]).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Version not found")
    return _hydrate_version(r.data[0])


# Designer-only handoff: marks the moodboard ready for proposal conversion.
# Proposal Builder is NOT implemented yet — this just records the intent and
# emits a timeline event so the dashboard can surface the next step.
@router.post("/handoff/prepare-proposal", status_code=201)
def prepare_proposal_handoff(body: HandoffPayload,
                             ctx: dict = Depends(require_permission(P_COLLAB_WRITE))):
    _assert_entity_supported(body.entity_type)
    client = db()
    # Sanity-check entity ownership
    if body.entity_type == "moodboard":
        mb = client.table("moodboards").select("id, project_id, title") \
            .eq("id", body.entity_id).eq("tenant_id", ctx["tenant_id"]).limit(1).execute()
        if not mb.data:
            raise HTTPException(404, "Moodboard not found")
        host = mb.data[0]
    else:
        host = {"id": body.entity_id}

    summary = f"{ctx.get('user_name') or 'Designer'} prepared this for proposal"
    _push_activity(client, tenant_id=ctx["tenant_id"],
                   entity_type=body.entity_type, entity_id=body.entity_id,
                   event_type="handoff_to_proposal", summary=summary,
                   payload={"note": body.note, "project_id": host.get("project_id")},
                   actor_id=ctx["profile_id"], actor_role=ctx.get("role"),
                   actor_name=ctx.get("user_name"))
    audit_log(ctx["tenant_id"], ctx["profile_id"], "collab.prepare_proposal",
              resource_type=body.entity_type, resource_id=body.entity_id)
    return {
        "message": "handoff_recorded",
        "entity_type": body.entity_type,
        "entity_id": body.entity_id,
        "project_id": host.get("project_id"),
    }


# =============================================================================
#  Internal helpers (called from both authenticated and public surfaces)
# =============================================================================
def _create_comment_internal(body: CommentCreate, *, tenant_id: str,
                             author_id: Optional[str] = None,
                             author_role: str = "client",
                             author_name: Optional[str] = None,
                             author_email: Optional[str] = None) -> dict:
    _assert_entity_supported(body.entity_type)
    if body.kind not in VALID_COMMENT_KINDS:
        raise HTTPException(400, f"Invalid kind: {body.kind}")
    if body.parent_id:
        # Validate parent within same entity (single-level threading for MVP).
        client = db()
        p = client.table("collab_comments").select("entity_type, entity_id, parent_id") \
            .eq("id", body.parent_id).eq("tenant_id", tenant_id).limit(1).execute()
        if not p.data:
            raise HTTPException(400, "parent_id does not exist")
        if p.data[0].get("parent_id"):
            raise HTTPException(400, "Replies cannot have replies (single-level threading)")

    client = db()
    row = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "entity_type": body.entity_type,
        "entity_id": body.entity_id,
        "page_id": body.page_id,
        "parent_id": body.parent_id,
        "pin_x": body.pin_x,
        "pin_y": body.pin_y,
        "kind": body.kind,
        "body": body.body,
        "author_id": author_id,
        "author_role": author_role,
        "author_name": author_name,
        "author_email": author_email,
    }
    ins = client.table("collab_comments").insert(row).execute()
    saved = ins.data[0] if ins.data else row

    # Activity — replies use a distinct event so the timeline can group them.
    event = "comment_replied" if body.parent_id else "comment_added"
    actor_label = author_name or ("Designer" if author_role == "designer" else "Client")
    summary = f"{actor_label} {'replied to a comment' if body.parent_id else 'left a comment'}"
    _push_activity(client, tenant_id=tenant_id,
                   entity_type=body.entity_type, entity_id=body.entity_id,
                   page_id=body.page_id,
                   event_type=event, summary=summary,
                   payload={"comment_id": saved["id"], "kind": body.kind},
                   actor_id=author_id, actor_role=author_role, actor_name=author_name)
    return _hydrate_comment(saved)


def _upsert_page_status_internal(body: PageStatusUpsert, *, tenant_id: str,
                                 actor_id: Optional[str] = None,
                                 actor_role: str = "client",
                                 actor_name: Optional[str] = None) -> dict:
    _assert_entity_supported(body.entity_type)
    if body.status not in VALID_PAGE_STATUSES:
        raise HTTPException(400, f"Invalid status: {body.status}")
    client = db()

    # Upsert by (entity_type, entity_id, page_id). The unique constraint in
    # the migration guarantees one row per page.
    existing_q = client.table("collab_page_status").select("*") \
        .eq("entity_type", body.entity_type).eq("entity_id", body.entity_id) \
        .eq("page_id", body.page_id).limit(1).execute()
    payload = {
        "status": body.status,
        "decision_note": body.decision_note,
        "decided_by_role": actor_role,
        "decided_by_id": actor_id,
        "decided_by_name": actor_name or body.decided_by_name,
        "decided_at": _now(),
        "updated_at": _now(),
    }
    if existing_q.data:
        eid = existing_q.data[0]["id"]
        upd = client.table("collab_page_status").update(payload).eq("id", eid).execute()
        saved = upd.data[0] if upd.data else {**existing_q.data[0], **payload}
    else:
        row = {
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "entity_type": body.entity_type,
            "entity_id": body.entity_id,
            "page_id": body.page_id,
            **payload,
        }
        ins = client.table("collab_page_status").insert(row).execute()
        saved = ins.data[0] if ins.data else row

    event_map = {
        "approved": "page_approved",
        "revision_requested": "page_revision_requested",
        "rejected": "page_rejected",
        "pending_review": "page_status_reset",
    }
    actor_label = actor_name or ("Designer" if actor_role == "designer" else "Client")
    summary_map = {
        "approved":            f"{actor_label} approved a page",
        "revision_requested":  f"{actor_label} requested a revision",
        "rejected":            f"{actor_label} rejected a page",
        "pending_review":      f"{actor_label} reopened a page for review",
    }
    _push_activity(client, tenant_id=tenant_id,
                   entity_type=body.entity_type, entity_id=body.entity_id,
                   page_id=body.page_id,
                   event_type=event_map[body.status],
                   summary=summary_map[body.status],
                   payload={"status": body.status, "note": body.decision_note},
                   actor_id=actor_id, actor_role=actor_role, actor_name=actor_name)

    out = {k: v for k, v in saved.items() if k != "tenant_id"}
    return out


def _create_inspiration_internal(body: InspirationCreate, *, tenant_id: str,
                                 uploaded_by_role: str = "client",
                                 uploaded_by_id: Optional[str] = None,
                                 uploaded_by_name: Optional[str] = None,
                                 uploaded_by_email: Optional[str] = None) -> dict:
    _assert_entity_supported(body.entity_type)
    if body.type not in VALID_INSPIRATION_TYPES:
        raise HTTPException(400, f"Invalid type: {body.type}")
    client = db()
    row = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "entity_type": body.entity_type,
        "entity_id": body.entity_id,
        "type": body.type,
        "title": body.title,
        "description": body.description,
        "asset_url": body.asset_url,
        "thumbnail_url": body.thumbnail_url,
        "source_url": body.source_url,
        "metadata_json": body.metadata or {},
        "uploaded_by_role": uploaded_by_role,
        "uploaded_by_id": uploaded_by_id,
        "uploaded_by_name": uploaded_by_name or body.uploaded_by_name,
        "uploaded_by_email": uploaded_by_email or body.uploaded_by_email,
    }
    ins = client.table("collab_inspirations").insert(row).execute()
    saved = ins.data[0] if ins.data else row

    actor_label = uploaded_by_name or body.uploaded_by_name or (
        "Designer" if uploaded_by_role == "designer" else "Client")
    _push_activity(client, tenant_id=tenant_id,
                   entity_type=body.entity_type, entity_id=body.entity_id,
                   event_type="inspiration_added",
                   summary=f"{actor_label} shared a reference",
                   payload={"inspiration_id": saved["id"], "type": body.type,
                            "title": body.title},
                   actor_id=uploaded_by_id, actor_role=uploaded_by_role,
                   actor_name=actor_label)
    return _hydrate_inspiration(saved)


# =============================================================================
#  PUBLIC client surface (unauthenticated, share-token gated)
# =============================================================================
@router.get("/public/{share_token}/overview")
def public_overview(share_token: str):
    """One-shot read for the Review Mode bootstrap. Returns the entity context
    (tenant_id is intentionally NOT exposed), all comments, page statuses,
    activity timeline and client inspirations — so the client UI can render
    in a single round-trip."""
    if not db_available():
        raise HTTPException(503, "Database not configured")
    ctx = _resolve_share(share_token)
    client = db()
    e_type, e_id = ctx["entity_type"], ctx["entity_id"]

    comments = client.table("collab_comments").select("*") \
        .eq("entity_type", e_type).eq("entity_id", e_id) \
        .order("created_at").execute().data or []
    statuses = client.table("collab_page_status").select("*") \
        .eq("entity_type", e_type).eq("entity_id", e_id).execute().data or []
    activity = client.table("collab_activity").select("*") \
        .eq("entity_type", e_type).eq("entity_id", e_id) \
        .order("created_at", desc=True).limit(80).execute().data or []
    inspirations = client.table("collab_inspirations").select("*") \
        .eq("entity_type", e_type).eq("entity_id", e_id) \
        .order("created_at", desc=True).execute().data or []

    return {
        "entity": {"type": e_type, "id": e_id, "project_id": ctx.get("project_id")},
        "comments": [_hydrate_comment(c) for c in comments],
        "page_statuses": [{k: v for k, v in r.items() if k != "tenant_id"} for r in statuses],
        "activity": [_hydrate_activity(a) for a in activity],
        "inspirations": [_hydrate_inspiration(i) for i in inspirations],
    }


@router.post("/public/{share_token}/comments", status_code=201)
def public_create_comment(share_token: str, body: CommentCreate):
    ctx = _resolve_share(share_token)
    # Force entity scope from the token so a malicious client can't post
    # comments into a different moodboard by tweaking the payload.
    body.entity_type = ctx["entity_type"]
    body.entity_id = ctx["entity_id"]
    return _create_comment_internal(body, tenant_id=ctx["tenant_id"],
                                    author_role="client",
                                    author_name=body.author_name,
                                    author_email=body.author_email)


@router.post("/public/{share_token}/page-status")
def public_upsert_page_status(share_token: str, body: PageStatusUpsert):
    ctx = _resolve_share(share_token)
    body.entity_type = ctx["entity_type"]
    body.entity_id = ctx["entity_id"]
    return _upsert_page_status_internal(body, tenant_id=ctx["tenant_id"],
                                        actor_role="client",
                                        actor_name=body.decided_by_name)


@router.post("/public/{share_token}/inspirations", status_code=201)
def public_create_inspiration(share_token: str, body: InspirationCreate):
    ctx = _resolve_share(share_token)
    body.entity_type = ctx["entity_type"]
    body.entity_id = ctx["entity_id"]
    return _create_inspiration_internal(body, tenant_id=ctx["tenant_id"],
                                        uploaded_by_role="client",
                                        uploaded_by_name=body.uploaded_by_name,
                                        uploaded_by_email=body.uploaded_by_email)


@router.post("/public/{share_token}/upload", status_code=201)
async def public_upload_inspiration(share_token: str, request: Request):
    """Direct multipart upload for client inspirations. The Storage router
    requires authentication; for the Review Mode we want frictionless drag-
    and-drop, so we proxy the bytes to Supabase Storage server-side."""
    import base64
    import os
    import httpx
    ctx = _resolve_share(share_token)
    form = await request.form()
    f = form.get("file")
    if f is None or not hasattr(f, "read"):
        raise HTTPException(400, "Missing file")
    content = await f.read()
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(413, "File too large (max 25MB)")
    file_name = getattr(f, "filename", "upload.bin")
    mime = getattr(f, "content_type", "application/octet-stream") or "application/octet-stream"

    # Use the service role to push into the moodboard-assets bucket under a
    # dedicated /collab/ path so client uploads can be moderated later.
    bucket = "moodboard-assets"
    safe_name = file_name.replace("/", "_").replace("\\", "_")
    key = f"{ctx['tenant_id']}/collab/{ctx['entity_id']}/{int(datetime.now(timezone.utc).timestamp()*1000)}-{secrets.token_hex(4)}-{safe_name}"

    supa_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not supa_url or not service_key:
        raise HTTPException(500, "Storage not configured")

    upload_url = f"{supa_url}/storage/v1/object/{bucket}/{key}"
    async with httpx.AsyncClient(timeout=30.0) as http:
        r = await http.post(upload_url, content=content,
                            headers={
                                "Authorization": f"Bearer {service_key}",
                                "Content-Type": mime,
                                "x-upsert": "false",
                            })
        if r.status_code >= 400:
            raise HTTPException(502, f"Storage upload failed: {r.text[:200]}")

        # Mint a 7-day signed URL for the client review UI to render.
        sign_url = f"{supa_url}/storage/v1/object/sign/{bucket}/{key}"
        sr = await http.post(sign_url, json={"expiresIn": 60 * 60 * 24 * 7},
                             headers={"Authorization": f"Bearer {service_key}",
                                      "Content-Type": "application/json"})
        signed = ""
        if sr.status_code < 400:
            d = sr.json()
            signed = f"{supa_url}/storage/v1{d.get('signedURL') or d.get('signedUrl') or ''}"

    # Persist the inspiration row
    payload = InspirationCreate(
        entity_type=ctx["entity_type"],
        entity_id=ctx["entity_id"],
        type="image" if mime.startswith("image/") else ("pdf" if mime == "application/pdf" else "link"),
        title=form.get("title") or safe_name,
        description=form.get("description") or None,
        asset_url=signed or None,
        thumbnail_url=signed or None,
        metadata={"storage_path": key, "mime": mime, "size_bytes": len(content)},
        uploaded_by_name=form.get("uploaded_by_name") or None,
        uploaded_by_email=form.get("uploaded_by_email") or None,
    )
    return _create_inspiration_internal(payload, tenant_id=ctx["tenant_id"],
                                        uploaded_by_role="client",
                                        uploaded_by_name=payload.uploaded_by_name,
                                        uploaded_by_email=payload.uploaded_by_email)


# =============================================================================
#  Meta endpoints (vocabularies — never hardcode in the frontend)
# =============================================================================
@router.get("/_meta/registry")
def collab_registry():
    return {
        "entities": sorted(SUPPORTED_ENTITIES),
        "comment_kinds": sorted(VALID_COMMENT_KINDS),
        "page_statuses": sorted(VALID_PAGE_STATUSES),
        "activity_events": sorted(VALID_ACTIVITY_EVENTS),
        "inspiration_types": sorted(VALID_INSPIRATION_TYPES),
    }
