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


# ═════════════════════════════════════════════════════════════════════
# Phase R-CRM-2 — Editorial Relationship CRM™ extensions
# ═════════════════════════════════════════════════════════════════════
#
# Editorial-native endpoints (architecture first — UI follows in the next
# sprint). All endpoints assume the migration 041 tables exist.
#
#   POST /api/relationships/accounts/{aid}/engagement         log signal
#   GET  /api/relationships/accounts/{aid}/engagement         list signals
#   GET  /api/relationships/accounts/{aid}/affinities         intelligence snapshot
#   POST /api/relationships/accounts/{aid}/affinities/recompute  recompute snapshot
#
#   GET    /api/relationships/accounts/{aid}/projects         list project links
#   POST   /api/relationships/accounts/{aid}/projects         link a project
#   DELETE /api/relationships/accounts/{aid}/projects/{pid}   unlink a project
#
#   GET    /api/relationships/accounts/{aid}/inspirations     list inspiration links
#   POST   /api/relationships/accounts/{aid}/inspirations     link a design_reference
#   DELETE /api/relationships/accounts/{aid}/inspirations/{ref_id}
#
#   GET    /api/relationships/accounts/{aid}/material-affinities
#   POST   /api/relationships/accounts/{aid}/material-affinities
#
#   GET    /api/relationships/accounts/{aid}/markets          list linked markets
#   POST   /api/relationships/accounts/{aid}/markets          link/upsert
#
#   GET    /api/relationships/intelligence                    dashboard view
#                                                              (relationship_intelligence_v)
# ═════════════════════════════════════════════════════════════════════


# ─── Pydantic models ─────────────────────────────────────────────────

class EngagementSignalIn(BaseModel):
    signal_type:        str
    entity_type:        Optional[str] = None
    entity_id:          Optional[str] = None
    market_id:          Optional[str] = None
    locale_code:        Optional[str] = None
    surface:            Optional[str] = None
    editorial_register: Optional[str] = None
    atmosphere_tags:    List[str] = Field(default_factory=list)
    material_tags:      List[str] = Field(default_factory=list)
    cta_label:          Optional[str] = None
    cta_intent:         Optional[str] = None
    signal_weight:      float = 1.0
    dwell_seconds:      Optional[int] = None
    scroll_depth_pct:   Optional[int] = None
    session_id:         Optional[str] = None
    metadata:           Dict[str, Any] = Field(default_factory=dict)


class ProjectLinkIn(BaseModel):
    project_id:           str
    role:                 str = 'client'
    collaboration_stage:  Optional[str] = None
    notes:                Optional[str] = None


class InspirationLinkIn(BaseModel):
    reference_id:    str
    source:          str = 'saved_by_account'
    resonance_note:  Optional[str] = None


class MaterialAffinityIn(BaseModel):
    material_id:       str
    attraction_score:  Optional[float] = None
    sample_requested:  Optional[bool] = None
    specified:         Optional[bool] = None
    notes:             Optional[str] = None


class AccountMarketIn(BaseModel):
    market_id:           str
    is_primary:          bool = False
    engagement_strength: Optional[float] = None
    notes:               Optional[str] = None


# ─── Helper: assert account belongs to tenant ────────────────────────

def _assert_account_owned(c, account_id: str, tenant_id: str) -> None:
    r = c.table("accounts").select("id").eq("id", account_id).eq("tenant_id", tenant_id).maybe_single().execute()
    if not (r and r.data):
        raise HTTPException(404, "Account not found")


# ─── Engagement signals ──────────────────────────────────────────────

@router.post("/accounts/{aid}/engagement", status_code=201)
def log_engagement_signal(aid: str, payload: EngagementSignalIn, ctx=Depends(get_tenant_context)):
    """Log a Relationship Intelligence™ signal.

    NOT a generic event log — every signal feeds the affinity engine
    (preferred_atmosphere, hospitality_orientation_score, etc.).
    """
    c = db()
    _assert_account_owned(c, aid, ctx["tenant_id"])
    row = payload.model_dump()
    row.update({
        "id": str(uuid.uuid4()),
        "tenant_id": ctx["tenant_id"],
        "account_id": aid,
        "occurred_at": datetime.now(timezone.utc).isoformat(),
    })
    # Best-effort: also bump account.last_activity_at.
    c.table("relationship_engagement_signals").insert(row).execute()
    c.table("accounts").update({"last_activity_at": row["occurred_at"]}).eq("id", aid).eq("tenant_id", ctx["tenant_id"]).execute()
    return {"signal": row}


@router.get("/accounts/{aid}/engagement")
def list_engagement_signals(
    aid: str,
    signal_type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    ctx=Depends(get_tenant_context),
):
    c = db()
    _assert_account_owned(c, aid, ctx["tenant_id"])
    qb = (
        c.table("relationship_engagement_signals")
         .select("*")
         .eq("tenant_id", ctx["tenant_id"])
         .eq("account_id", aid)
         .order("occurred_at", desc=True)
         .limit(limit)
    )
    if signal_type:
        qb = qb.eq("signal_type", signal_type)
    return {"signals": qb.execute().data or []}


# ─── Affinities — Relationship Intelligence™ snapshot ────────────────

@router.get("/accounts/{aid}/affinities")
def get_affinities(aid: str, ctx=Depends(get_tenant_context)):
    """Read the computed Relationship Intelligence™ snapshot."""
    c = db()
    _assert_account_owned(c, aid, ctx["tenant_id"])
    r = (
        c.table("relationship_affinities").select("*")
         .eq("tenant_id", ctx["tenant_id"]).eq("account_id", aid)
         .maybe_single().execute()
    )
    return {"affinities": (r.data if r else None)}


@router.post("/accounts/{aid}/affinities/recompute")
def recompute_affinities(aid: str, ctx=Depends(get_tenant_context)):
    """Recompute affinity scores from engagement signal history.

    Heuristic-first (deterministic) — the AI overlay can attach richer
    `intelligence_payload` JSON via a separate worker.
    """
    c = db()
    _assert_account_owned(c, aid, ctx["tenant_id"])
    sigs = (
        c.table("relationship_engagement_signals").select("*")
         .eq("tenant_id", ctx["tenant_id"]).eq("account_id", aid)
         .order("occurred_at", desc=True)
         .limit(2000)
         .execute().data or []
    )

    # Tally counters
    from collections import Counter
    register_w  = Counter()
    atmo_w      = Counter()
    mat_w       = Counter()
    cta_w       = Counter()
    market_w    = Counter()
    hosp_score  = 0.0
    spec_score  = 0.0
    long_form_w = 0.0
    cadence_buckets = set()

    for s in sigs:
        w = float(s.get("signal_weight") or 1.0)
        st = s.get("signal_type") or ''
        if s.get("editorial_register"):
            register_w[s["editorial_register"]] += w
        for tag in s.get("atmosphere_tags") or []:
            atmo_w[tag] += w
        for tag in s.get("material_tags") or []:
            mat_w[tag] += w
        if s.get("cta_intent"):
            cta_w[s["cta_intent"]] += w
        if s.get("market_id"):
            market_w[s["market_id"]] += w
        # Behavioural orientation heuristics
        if st in ("viewed_project", "viewed_material", "requested_sample",
                  "specified_product", "quoted_material"):
            spec_score += w * 1.0
        if st in ("requested_consultation", "requested_showroom_visit",
                  "downloaded_proposal", "viewed_moodboard"):
            hosp_score += w * 1.0
        if st in ("scrolled_long_form", "watched_video"):
            long_form_w += w
        ts = s.get("occurred_at")
        if ts:
            cadence_buckets.add(ts[:7])  # YYYY-MM bucket

    # Normalise to 0-100
    total = float(len(sigs)) or 1.0
    def _scale(x):
        return float(min(100.0, max(0.0, (x / total) * 100.0)))

    payload = {
        "tenant_id":                       ctx["tenant_id"],
        "account_id":                      aid,
        "most_engaged_market_edition_id":  None,  # to be enriched by AI worker
        "preferred_atmosphere":            (atmo_w.most_common(1)[0][0] if atmo_w else None),
        "preferred_atmosphere_tags":       [t for t, _ in atmo_w.most_common(8)],
        "preferred_materials":             [t for t, _ in mat_w.most_common(8)],
        "preferred_cta_intent":            (cta_w.most_common(1)[0][0] if cta_w else None),
        "preferred_editorial_register":    (register_w.most_common(1)[0][0] if register_w else None),
        "hospitality_orientation_score":   round(_scale(hosp_score), 2),
        "specification_orientation_score": round(_scale(spec_score), 2),
        "long_form_engagement_score":      round(_scale(long_form_w), 2),
        "editorial_cadence_score":         round(min(100.0, len(cadence_buckets) * 8.0), 2),
        "luxury_perception_alignment":     None,  # to be enriched by AI worker
        "signal_count_total":              int(total) if sigs else 0,
        "last_signal_at":                  sigs[0]["occurred_at"] if sigs else None,
        "computed_at":                     datetime.now(timezone.utc).isoformat(),
        "intelligence_payload":            {},
    }
    c.table("relationship_affinities").upsert(payload, on_conflict="account_id").execute()
    return {"affinities": payload}


# ─── Project linkage ─────────────────────────────────────────────────

@router.get("/accounts/{aid}/projects")
def list_project_links(aid: str, ctx=Depends(get_tenant_context)):
    c = db()
    _assert_account_owned(c, aid, ctx["tenant_id"])
    rows = (
        c.table("relationship_projects").select("*")
         .eq("account_id", aid).order("linked_at", desc=True)
         .execute().data or []
    )
    return {"links": rows}


@router.post("/accounts/{aid}/projects", status_code=201)
def link_project(aid: str, payload: ProjectLinkIn, ctx=Depends(get_tenant_context)):
    c = db()
    _assert_account_owned(c, aid, ctx["tenant_id"])
    row = payload.model_dump()
    row.update({
        "id": str(uuid.uuid4()),
        "tenant_id": ctx["tenant_id"],
        "account_id": aid,
        "linked_by": ctx.get("user_id"),
        "linked_at": datetime.now(timezone.utc).isoformat(),
    })
    try:
        c.table("relationship_projects").insert(row).execute()
    except Exception:
        # Idempotent for (account_id, project_id, role)
        raise HTTPException(409, "Project already linked with this role")
    return {"link": row}


@router.delete("/accounts/{aid}/projects/{pid}", status_code=204)
def unlink_project(aid: str, pid: str, role: Optional[str] = Query(None), ctx=Depends(get_tenant_context)):
    c = db()
    _assert_account_owned(c, aid, ctx["tenant_id"])
    qb = c.table("relationship_projects").delete().eq("account_id", aid).eq("project_id", pid)
    if role:
        qb = qb.eq("role", role)
    qb.execute()
    return None


# ─── Inspiration linkage (design_references) ────────────────────────

@router.get("/accounts/{aid}/inspirations")
def list_inspirations(aid: str, ctx=Depends(get_tenant_context)):
    c = db()
    _assert_account_owned(c, aid, ctx["tenant_id"])
    rows = (
        c.table("relationship_inspirations").select("*")
         .eq("account_id", aid).order("saved_at", desc=True)
         .execute().data or []
    )
    return {"inspirations": rows}


@router.post("/accounts/{aid}/inspirations", status_code=201)
def link_inspiration(aid: str, payload: InspirationLinkIn, ctx=Depends(get_tenant_context)):
    c = db()
    _assert_account_owned(c, aid, ctx["tenant_id"])
    row = payload.model_dump()
    row.update({
        "id": str(uuid.uuid4()),
        "tenant_id": ctx["tenant_id"],
        "account_id": aid,
        "saved_at": datetime.now(timezone.utc).isoformat(),
    })
    try:
        c.table("relationship_inspirations").insert(row).execute()
    except Exception:
        raise HTTPException(409, "Already linked")
    return {"link": row}


@router.delete("/accounts/{aid}/inspirations/{ref_id}", status_code=204)
def unlink_inspiration(aid: str, ref_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    _assert_account_owned(c, aid, ctx["tenant_id"])
    c.table("relationship_inspirations").delete().eq("account_id", aid).eq("reference_id", ref_id).execute()
    return None


# ─── Material affinities ─────────────────────────────────────────────

@router.get("/accounts/{aid}/material-affinities")
def list_material_affinities(aid: str, ctx=Depends(get_tenant_context)):
    c = db()
    _assert_account_owned(c, aid, ctx["tenant_id"])
    rows = (
        c.table("relationship_material_affinities").select("*")
         .eq("account_id", aid).order("attraction_score", desc=True)
         .execute().data or []
    )
    return {"affinities": rows}


@router.post("/accounts/{aid}/material-affinities")
def upsert_material_affinity(aid: str, payload: MaterialAffinityIn, ctx=Depends(get_tenant_context)):
    c = db()
    _assert_account_owned(c, aid, ctx["tenant_id"])
    row = {k: v for k, v in payload.model_dump().items() if v is not None}
    row.update({
        "tenant_id": ctx["tenant_id"],
        "account_id": aid,
        "last_engaged_at": datetime.now(timezone.utc).isoformat(),
    })
    c.table("relationship_material_affinities").upsert(row, on_conflict="account_id,material_id").execute()
    return {"affinity": row}


# ─── Account ↔ market linkage ────────────────────────────────────────

@router.get("/accounts/{aid}/markets")
def list_account_markets(aid: str, ctx=Depends(get_tenant_context)):
    c = db()
    _assert_account_owned(c, aid, ctx["tenant_id"])
    rows = (
        c.table("account_markets").select("*")
         .eq("account_id", aid)
         .execute().data or []
    )
    return {"markets": rows}


@router.post("/accounts/{aid}/markets", status_code=201)
def upsert_account_market(aid: str, payload: AccountMarketIn, ctx=Depends(get_tenant_context)):
    c = db()
    _assert_account_owned(c, aid, ctx["tenant_id"])
    row = payload.model_dump()
    row.update({
        "tenant_id": ctx["tenant_id"],
        "account_id": aid,
    })
    # If marking as primary, demote others first.
    if row.get("is_primary"):
        c.table("account_markets").update({"is_primary": False}).eq("account_id", aid).eq("tenant_id", ctx["tenant_id"]).execute()
        # And also reflect on the accounts.market_id pointer for fast joins.
        c.table("accounts").update({"market_id": row["market_id"]}).eq("id", aid).eq("tenant_id", ctx["tenant_id"]).execute()
    # Upsert
    c.table("account_markets").upsert(row, on_conflict="account_id,market_id").execute()
    return {"link": row}


@router.delete("/accounts/{aid}/markets/{mid}", status_code=204)
def unlink_account_market(aid: str, mid: str, ctx=Depends(get_tenant_context)):
    """Remove a market linkage. Parity with projects/inspirations DELETE."""
    c = db()
    _assert_account_owned(c, aid, ctx["tenant_id"])
    # If this was the primary, also clear the fast-pointer on accounts.
    cur = (
        c.table("account_markets").select("is_primary")
         .eq("account_id", aid).eq("market_id", mid)
         .maybe_single().execute()
    )
    was_primary = bool(cur and cur.data and cur.data.get("is_primary"))
    c.table("account_markets").delete().eq("account_id", aid).eq("market_id", mid).eq("tenant_id", ctx["tenant_id"]).execute()
    if was_primary:
        c.table("accounts").update({"market_id": None}).eq("id", aid).eq("tenant_id", ctx["tenant_id"]).execute()
    return None


# ─── Intelligence dashboard view ─────────────────────────────────────

@router.get("/intelligence")
def list_relationship_intelligence(
    journey_stage: Optional[str] = Query(None),
    market_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    ctx=Depends(get_tenant_context),
):
    """Dashboard read — surfaces aggregated Relationship Intelligence™.

    Reads from the `relationship_intelligence_v` PostgreSQL view which
    joins accounts + signal counters + affinity snapshots + link counts.
    """
    c = db()
    qb = (
        c.table("relationship_intelligence_v")
         .select("*")
         .eq("tenant_id", ctx["tenant_id"])
         .order("last_signal_at", desc=True, nullsfirst=False)
         .limit(limit)
    )
    if journey_stage:
        qb = qb.eq("relationship_journey_stage", journey_stage)
    if market_id:
        qb = qb.eq("market_id", market_id)
    return {"relationships": qb.execute().data or []}

