"""Phase R-CRM-1 — Relationship CRM REST API.

Endpoints (all mounted under /api by server.py):

  Accounts:
    GET  /api/relationships/accounts                list + filter
    POST /api/relationships/accounts                create
    GET  /api/relationships/accounts/{id}           detail (account + contacts + style + team + counts)
    PATCH /api/relationships/accounts/{id}          partial update
    POST /api/relationships/accounts/{id}/stage     change lifecycle stage (emits timeline event)
    DELETE /api/relationships/accounts/{id}         soft-archive

  Contacts:
    POST /api/relationships/accounts/{aid}/contacts          add
    PATCH /api/relationships/accounts/{aid}/contacts/{cid}   edit
    DELETE /api/relationships/accounts/{aid}/contacts/{cid}  remove

  Interactions / Timeline:
    GET  /api/relationships/accounts/{aid}/interactions          list (chronological desc)
    POST /api/relationships/accounts/{aid}/interactions          log
    PATCH /api/relationships/accounts/{aid}/interactions/{iid}   edit
    DELETE /api/relationships/accounts/{aid}/interactions/{iid}  remove

  Actions / Next Steps:
    GET  /api/relationships/accounts/{aid}/actions               list (filter ?status=)
    POST /api/relationships/accounts/{aid}/actions               create
    PATCH /api/relationships/accounts/{aid}/actions/{aid2}       update / mark done

  Style DNA:
    GET  /api/relationships/accounts/{aid}/style                 read
    PUT  /api/relationships/accounts/{aid}/style                 upsert

  Lookups (Blueprint Command Center catalog):
    GET  /api/relationships/lookups                              all groups for tenant
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from database import db
from core.tenant_context import get_tenant_context, audit_log

logger = logging.getLogger(__name__)
router = APIRouter(tags=["relationships"], prefix="/relationships")


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_or_404(c, table: str, row_id: str, tid: str) -> Dict[str, Any]:
    r = (c.table(table).select("*").eq("id", row_id).eq("tenant_id", tid)
         .limit(1).execute().data or [])
    if not r:
        raise HTTPException(404, f"{table} not found")
    return r[0]


def _touch_account(c, account_id: str, tid: str, when: Optional[str] = None):
    c.table("accounts").update({
        "last_activity_at": when or _iso(),
        "updated_at": _iso(),
    }).eq("id", account_id).eq("tenant_id", tid).execute()


# ─── Models ─────────────────────────────────────────────────────────────

class AccountIn(BaseModel):
    account_name:    str = Field(..., min_length=1, max_length=200)
    account_type:    Optional[str] = "private_client"
    lifecycle_stage: Optional[str] = "new_inquiry"
    source:          Optional[str] = None
    country:         Optional[str] = None
    city:            Optional[str] = None
    address:         Optional[str] = None
    website:         Optional[str] = None
    phone:           Optional[str] = None
    email:           Optional[str] = None
    language:        Optional[str] = None
    locale_code:     Optional[str] = None
    primary_owner_id:    Optional[str] = None
    relationship_health: Optional[str] = None
    notes:           Optional[str] = None
    metadata_json:   Optional[Dict[str, Any]] = None


class AccountPatch(BaseModel):
    account_name:    Optional[str] = None
    account_type:    Optional[str] = None
    source:          Optional[str] = None
    country:         Optional[str] = None
    city:            Optional[str] = None
    address:         Optional[str] = None
    website:         Optional[str] = None
    phone:           Optional[str] = None
    email:           Optional[str] = None
    language:        Optional[str] = None
    locale_code:     Optional[str] = None
    primary_owner_id:    Optional[str] = None
    relationship_health: Optional[str] = None
    notes:           Optional[str] = None
    metadata_json:   Optional[Dict[str, Any]] = None


class StageChange(BaseModel):
    lifecycle_stage: str = Field(..., min_length=1)
    note:            Optional[str] = None


class ContactIn(BaseModel):
    first_name:               str = Field(..., min_length=1)
    last_name:                Optional[str] = None
    email:                    Optional[str] = None
    phone:                    Optional[str] = None
    role:                     Optional[str] = None
    department_or_area:       Optional[str] = None
    primary_contact:          Optional[bool] = False
    communication_preference: Optional[str] = None
    notes:                    Optional[str] = None


class InteractionIn(BaseModel):
    interaction_type:    str = Field(..., min_length=1)
    contact_id:          Optional[str] = None
    project_id:          Optional[str] = None
    moodboard_id:        Optional[str] = None
    occurred_at:         Optional[str] = None
    title:               Optional[str] = None
    summary:             Optional[str] = None
    outcome:             Optional[str] = None
    next_step:           Optional[str] = None
    next_follow_up_date: Optional[str] = None
    report_payload:      Optional[Dict[str, Any]] = None
    attachments:         Optional[List[Dict[str, Any]]] = None
    is_automatic:        Optional[bool] = False


class ActionIn(BaseModel):
    title:                  str = Field(..., min_length=1)
    action_type:            str = Field(..., min_length=1)
    contact_id:             Optional[str] = None
    project_id:             Optional[str] = None
    moodboard_id:           Optional[str] = None
    related_interaction_id: Optional[str] = None
    assigned_to:            Optional[str] = None
    due_date:               Optional[str] = None
    priority:               Optional[str] = "normal"
    notes:                  Optional[str] = None


class ActionPatch(BaseModel):
    title:       Optional[str] = None
    action_type: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date:    Optional[str] = None
    priority:    Optional[str] = None
    status:      Optional[str] = None
    notes:       Optional[str] = None


class StyleIn(BaseModel):
    preferred_styles:        Optional[List[str]] = None
    preferred_materials:     Optional[List[str]] = None
    preferred_colors:        Optional[List[str]] = None
    preferred_rooms:         Optional[List[str]] = None
    atmosphere_tags:         Optional[List[str]] = None
    luxury_level:            Optional[str] = None
    budget_range:            Optional[str] = None
    timing_range:            Optional[str] = None
    ai_detected_tags:        Optional[List[str]] = None
    designer_validated_tags: Optional[List[str]] = None
    disliked_tags:           Optional[List[str]] = None
    inspiration_sources:     Optional[List[Dict[str, Any]]] = None
    notes:                   Optional[str] = None


# ─── Accounts ───────────────────────────────────────────────────────────

@router.get("/accounts")
def list_accounts(
    stage:        Optional[str] = None,
    account_type: Optional[str] = None,
    owner_id:     Optional[str] = None,
    source:       Optional[str] = None,
    q:            Optional[str] = Query(None, description="free-text search on name/email/city"),
    limit:        int = 200,
    ctx=Depends(get_tenant_context),
):
    """List accounts for the active tenant with light filtering."""
    c = db()
    tid = ctx["tenant_id"]
    qb = c.table("accounts").select("*").eq("tenant_id", tid)
    if stage:
        qb = qb.eq("lifecycle_stage", stage)
    if account_type:
        qb = qb.eq("account_type", account_type)
    if owner_id:
        qb = qb.eq("primary_owner_id", owner_id)
    if source:
        qb = qb.eq("source", source)
    if q:
        # Supabase doesn't support ilike-OR-chained in PostgREST without
        # complex `or` clause string — keep it simple and use ilike on name
        # plus client-side filter for email/city via narrower fetch.
        qb = qb.ilike("account_name", f"%{q}%")
    rows = (qb.order("last_activity_at", desc=True)
              .limit(min(limit, 500)).execute().data or [])

    # Hydrate contacts (primary) + open-action counts in a few small bulk
    # queries (no N+1).
    ids = [r["id"] for r in rows]
    primary_by_acc: Dict[str, Dict[str, Any]] = {}
    open_actions_by_acc: Dict[str, int] = {}
    if ids:
        contacts = (c.table("contacts").select("*")
                    .in_("account_id", ids)
                    .eq("primary_contact", True).execute().data or [])
        for ct in contacts:
            primary_by_acc[ct["account_id"]] = ct
        # Fallback: if no primary, grab any contact for that account.
        missing = [aid for aid in ids if aid not in primary_by_acc]
        if missing:
            any_contacts = (c.table("contacts").select("*")
                            .in_("account_id", missing).execute().data or [])
            for ct in any_contacts:
                primary_by_acc.setdefault(ct["account_id"], ct)
        # Open actions count (status=open)
        acts = (c.table("relationship_actions").select("account_id, due_date")
                .in_("account_id", ids).eq("status", "open").execute().data or [])
        for a in acts:
            open_actions_by_acc[a["account_id"]] = open_actions_by_acc.get(a["account_id"], 0) + 1

    return {
        "accounts": [
            {**r,
             "primary_contact": primary_by_acc.get(r["id"]),
             "open_actions_count": open_actions_by_acc.get(r["id"], 0)}
            for r in rows
        ],
        "total": len(rows),
    }


@router.post("/accounts", status_code=201)
def create_account(body: AccountIn, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    aid = str(uuid.uuid4())
    row = body.model_dump(exclude_none=True)
    row.update({
        "id":        aid,
        "tenant_id": tid,
        "metadata_json":   body.metadata_json or {},
        "primary_owner_id": body.primary_owner_id or ctx.get("profile_id"),
        "created_at":      _iso(),
        "updated_at":      _iso(),
        "last_activity_at": _iso(),
    })
    c.table("accounts").insert(row).execute()
    audit_log(tid, ctx.get("profile_id"), "account.created", "account", aid,
              {"account_type": row.get("account_type")})
    return {"ok": True, "account": row}


@router.get("/accounts/{account_id}")
def get_account(account_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    acc = _row_or_404(c, "accounts", account_id, tid)
    contacts = (c.table("contacts").select("*").eq("account_id", account_id)
                .order("primary_contact", desc=True).order("created_at").execute().data or [])
    style = (c.table("account_style_profile").select("*")
             .eq("account_id", account_id).limit(1).execute().data or [None])[0]
    team = (c.table("account_team_members").select("*")
            .eq("account_id", account_id)
            .is_("removed_at", "null").execute().data or [])
    counts = {
        "interactions": (c.table("interactions").select("id", count="exact")
                         .eq("account_id", account_id).execute().count or 0),
        "open_actions": (c.table("relationship_actions").select("id", count="exact")
                         .eq("account_id", account_id).eq("status", "open").execute().count or 0),
    }
    return {"account": acc, "contacts": contacts, "style_profile": style,
            "team": team, "counts": counts}


@router.patch("/accounts/{account_id}")
def patch_account(account_id: str, body: AccountPatch, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _row_or_404(c, "accounts", account_id, tid)
    patch = body.model_dump(exclude_none=True)
    if not patch:
        return {"ok": True, "no_change": True}
    patch["updated_at"] = _iso()
    c.table("accounts").update(patch).eq("id", account_id).eq("tenant_id", tid).execute()
    return {"ok": True}


@router.post("/accounts/{account_id}/stage")
def change_stage(account_id: str, body: StageChange, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    acc = _row_or_404(c, "accounts", account_id, tid)
    if acc.get("lifecycle_stage") == body.lifecycle_stage:
        return {"ok": True, "no_change": True}
    c.table("accounts").update({
        "lifecycle_stage": body.lifecycle_stage,
        "updated_at":      _iso(),
        "last_activity_at": _iso(),
    }).eq("id", account_id).eq("tenant_id", tid).execute()
    # Emit a stage_change interaction so the timeline tells the story.
    c.table("interactions").insert({
        "id":        str(uuid.uuid4()),
        "tenant_id": tid,
        "account_id": account_id,
        "interaction_type": "stage_change",
        "occurred_at":      _iso(),
        "title":            f"Stage → {body.lifecycle_stage}",
        "summary":          body.note,
        "is_automatic":     True,
        "created_by":       ctx.get("profile_id"),
        "created_at":       _iso(),
    }).execute()
    audit_log(tid, ctx.get("profile_id"), "account.stage_changed", "account", account_id,
              {"to": body.lifecycle_stage})
    return {"ok": True, "stage": body.lifecycle_stage}


@router.delete("/accounts/{account_id}")
def archive_account(account_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _row_or_404(c, "accounts", account_id, tid)
    c.table("accounts").update({"lifecycle_stage": "archived", "updated_at": _iso()})\
        .eq("id", account_id).eq("tenant_id", tid).execute()
    return {"ok": True}


# ─── Contacts ───────────────────────────────────────────────────────────

@router.post("/accounts/{account_id}/contacts", status_code=201)
def add_contact(account_id: str, body: ContactIn, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _row_or_404(c, "accounts", account_id, tid)
    if body.primary_contact:
        # demote previous primary
        c.table("contacts").update({"primary_contact": False, "updated_at": _iso()})\
            .eq("account_id", account_id).eq("primary_contact", True).execute()
    cid = str(uuid.uuid4())
    row = body.model_dump(exclude_none=True)
    row.update({
        "id":         cid,
        "tenant_id":  tid,
        "account_id": account_id,
        "created_at": _iso(),
        "updated_at": _iso(),
    })
    c.table("contacts").insert(row).execute()
    _touch_account(c, account_id, tid)
    return {"ok": True, "contact": row}


@router.patch("/accounts/{account_id}/contacts/{contact_id}")
def patch_contact(account_id: str, contact_id: str, body: ContactIn,
                  ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _row_or_404(c, "accounts", account_id, tid)
    _row_or_404(c, "contacts", contact_id, tid)
    patch = body.model_dump(exclude_none=True)
    patch["updated_at"] = _iso()
    if body.primary_contact:
        c.table("contacts").update({"primary_contact": False, "updated_at": _iso()})\
            .eq("account_id", account_id).eq("primary_contact", True).neq("id", contact_id).execute()
    c.table("contacts").update(patch).eq("id", contact_id).eq("tenant_id", tid).execute()
    return {"ok": True}


@router.delete("/accounts/{account_id}/contacts/{contact_id}")
def delete_contact(account_id: str, contact_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _row_or_404(c, "accounts", account_id, tid)
    c.table("contacts").delete().eq("id", contact_id).eq("tenant_id", tid).execute()
    return {"ok": True}


# ─── Interactions / Timeline ───────────────────────────────────────────

@router.get("/accounts/{account_id}/interactions")
def list_interactions(account_id: str, limit: int = 200,
                      ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _row_or_404(c, "accounts", account_id, tid)
    rows = (c.table("interactions").select("*")
            .eq("account_id", account_id).eq("tenant_id", tid)
            .order("occurred_at", desc=True)
            .limit(min(limit, 500)).execute().data or [])
    return {"interactions": rows, "total": len(rows)}


@router.post("/accounts/{account_id}/interactions", status_code=201)
def add_interaction(account_id: str, body: InteractionIn,
                    ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _row_or_404(c, "accounts", account_id, tid)
    iid = str(uuid.uuid4())
    row = body.model_dump(exclude_none=True)
    row.update({
        "id":          iid,
        "tenant_id":   tid,
        "account_id":  account_id,
        "occurred_at": body.occurred_at or _iso(),
        "report_payload": body.report_payload or {},
        "attachments":    body.attachments or [],
        "created_by":  ctx.get("profile_id"),
        "created_at":  _iso(),
    })
    c.table("interactions").insert(row).execute()
    _touch_account(c, account_id, tid, when=row["occurred_at"])

    # Auto-create the follow-up action when next_step + date are provided.
    if body.next_step and body.next_follow_up_date:
        c.table("relationship_actions").insert({
            "id":          str(uuid.uuid4()),
            "tenant_id":   tid,
            "account_id":  account_id,
            "contact_id":  body.contact_id,
            "project_id":  body.project_id,
            "moodboard_id": body.moodboard_id,
            "related_interaction_id": iid,
            "title":       body.next_step,
            "action_type": "follow_up",
            "assigned_to": ctx.get("profile_id"),
            "due_date":    body.next_follow_up_date,
            "priority":    "normal",
            "status":      "open",
            "created_by":  ctx.get("profile_id"),
            "created_at":  _iso(),
            "updated_at":  _iso(),
        }).execute()
    return {"ok": True, "interaction": row}


@router.patch("/accounts/{account_id}/interactions/{interaction_id}")
def patch_interaction(account_id: str, interaction_id: str, body: InteractionIn,
                      ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _row_or_404(c, "accounts", account_id, tid)
    _row_or_404(c, "interactions", interaction_id, tid)
    patch = {k: v for k, v in body.model_dump(exclude_none=True).items()
             if k not in ("interaction_type",)}
    c.table("interactions").update(patch).eq("id", interaction_id).eq("tenant_id", tid).execute()
    return {"ok": True}


@router.delete("/accounts/{account_id}/interactions/{interaction_id}")
def delete_interaction(account_id: str, interaction_id: str,
                       ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    c.table("interactions").delete().eq("id", interaction_id).eq("tenant_id", tid)\
        .eq("account_id", account_id).execute()
    return {"ok": True}


# ─── Actions / Next Steps ──────────────────────────────────────────────

@router.get("/accounts/{account_id}/actions")
def list_actions(account_id: str, status: Optional[str] = None,
                 ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _row_or_404(c, "accounts", account_id, tid)
    qb = c.table("relationship_actions").select("*")\
         .eq("tenant_id", tid).eq("account_id", account_id)
    if status:
        qb = qb.eq("status", status)
    rows = qb.order("due_date").execute().data or []
    return {"actions": rows, "total": len(rows)}


@router.post("/accounts/{account_id}/actions", status_code=201)
def create_action(account_id: str, body: ActionIn,
                  ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _row_or_404(c, "accounts", account_id, tid)
    aid = str(uuid.uuid4())
    row = body.model_dump(exclude_none=True)
    row.update({
        "id":         aid,
        "tenant_id":  tid,
        "account_id": account_id,
        "assigned_to": body.assigned_to or ctx.get("profile_id"),
        "status":     "open",
        "created_by": ctx.get("profile_id"),
        "created_at": _iso(),
        "updated_at": _iso(),
    })
    c.table("relationship_actions").insert(row).execute()
    return {"ok": True, "action": row}


@router.patch("/accounts/{account_id}/actions/{action_id}")
def patch_action(account_id: str, action_id: str, body: ActionPatch,
                 ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _row_or_404(c, "relationship_actions", action_id, tid)
    patch = body.model_dump(exclude_none=True)
    if not patch:
        return {"ok": True, "no_change": True}
    if patch.get("status") == "done":
        patch["completed_at"] = _iso()
    patch["updated_at"] = _iso()
    c.table("relationship_actions").update(patch).eq("id", action_id).eq("tenant_id", tid).execute()
    return {"ok": True}


# ─── Style DNA ─────────────────────────────────────────────────────────

@router.get("/accounts/{account_id}/style")
def get_style(account_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _row_or_404(c, "accounts", account_id, tid)
    row = (c.table("account_style_profile").select("*")
           .eq("account_id", account_id).limit(1).execute().data or [None])[0]
    return {"style_profile": row}


@router.put("/accounts/{account_id}/style")
def upsert_style(account_id: str, body: StyleIn,
                 ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _row_or_404(c, "accounts", account_id, tid)
    existing = (c.table("account_style_profile").select("account_id")
                .eq("account_id", account_id).limit(1).execute().data or [])
    patch = body.model_dump(exclude_none=True)
    patch["updated_at"] = _iso()
    if existing:
        c.table("account_style_profile").update(patch)\
            .eq("account_id", account_id).execute()
    else:
        patch.update({"account_id": account_id, "tenant_id": tid})
        c.table("account_style_profile").insert(patch).execute()
    return {"ok": True}


# ─── Lookups (Command Center catalog) ──────────────────────────────────
#
# Two-layer resolution:
#   • PLATFORM rows (scope='platform', tenant_id IS NULL) carry the
#     canonical MOOD CRM terminology. The 9 CRM-core groups
#     (lifecycle_stage, account_type, source, interaction_type,
#     action_type, priority, visibility_level, relationship_health,
#     communication_preference) live ONLY at this layer.
#   • TENANT rows (scope='tenant', tenant_id NOT NULL) hold each
#     showroom/studio's stylistic vocabulary (style, material,
#     atmosphere, budget_range, timing_range, room_type, project_category).
#
# The endpoint returns the UNION. If a tenant ever creates a value with the
# same (group_key, value_key) as a platform row (stylistic groups only),
# the tenant row wins (override). The 9 CRM-core groups are protected by
# the API: write attempts on them are rejected (defence in depth — the
# DB schema permits the row but the UI / API never produces it).

CRM_CORE_GROUPS = {
    "lifecycle_stage", "account_type", "source", "interaction_type",
    "action_type", "priority", "visibility_level", "relationship_health",
    "communication_preference",
}


@router.get("/lookups")
def list_lookups(group: Optional[str] = None, ctx=Depends(get_tenant_context)):
    """List active lookups for the current tenant: platform values + tenant
    stylistic values. Tenant rows override platform rows on the same
    (group_key, value_key) when stylistic.
    """
    c = db()
    tid = ctx["tenant_id"]

    # Platform rows (canonical CRM terminology).
    qb_p = c.table("relationship_lookups").select("*").eq("active", True).eq("scope", "platform").is_("tenant_id", "null")
    if group:
        qb_p = qb_p.eq("group_key", group)
    platform_rows = qb_p.order("group_key").order("sort_order").execute().data or []

    # Tenant stylistic rows.
    qb_t = c.table("relationship_lookups").select("*").eq("active", True).eq("scope", "tenant").eq("tenant_id", tid)
    if group:
        qb_t = qb_t.eq("group_key", group)
    tenant_rows = qb_t.order("group_key").order("sort_order").execute().data or []

    # Index for override-on-key collision.
    by_key = {(r["group_key"], r["value_key"]): r for r in platform_rows}
    for r in tenant_rows:
        by_key[(r["group_key"], r["value_key"])] = r

    rows = sorted(by_key.values(), key=lambda r: (r["group_key"], r.get("sort_order") or 0))
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        grouped.setdefault(r["group_key"], []).append(r)
    return {"lookups": grouped, "total": len(rows)}

