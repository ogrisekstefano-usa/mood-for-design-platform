"""
STORE-010 · Journey-First Asset Architecture™
Zero new tables · uses moodboards.journey_id + design_journeys.metadata for
system markers (Template Studio™, Sandbox Studio™).
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core.tenant_context import get_tenant_context
from database import db

router = APIRouter()

SYSTEM_KIND_TEMPLATE = "template_studio"
SYSTEM_KIND_SANDBOX = "sandbox_studio"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _find_or_create_system_journey(c, tid: str, kind: str, name: str) -> str:
    """Find a system journey by metadata.system_kind, create if missing."""
    rows = (c.table("design_journeys").select("id,metadata")
            .eq("tenant_id", tid).execute().data or [])
    for r in rows:
        m = r.get("metadata") or {}
        if isinstance(m, dict) and m.get("system_kind") == kind:
            return r["id"]
    # Create a system project + journey
    pid = str(uuid.uuid4())
    c.table("projects").insert({
        "id": pid,
        "tenant_id": tid,
        "title": name,
        "status": "new",
        "priority": "normal",
        "metadata_json": {"system_kind": kind, "system_journey": True},
        "created_at": _now(),
        "updated_at": _now(),
    }).execute()
    jid = str(uuid.uuid4())
    c.table("design_journeys").insert({
        "id": jid,
        "tenant_id": tid,
        "project_id": pid,
        "overall_status": "in_progress",
        "lifecycle_state": "conversation_open",
        "metadata": {"system_kind": kind, "system_journey": True, "label": name},
        "created_at": _now(),
        "updated_at": _now(),
    }).execute()
    return jid


@router.post("/journey-assets/system-journeys/ensure")
def ensure_system_journeys(ctx=Depends(get_tenant_context)):
    """Create Template Studio + Sandbox Studio system journeys if missing."""
    tid = ctx["tenant_id"]
    c = db()
    tpl = _find_or_create_system_journey(c, tid, SYSTEM_KIND_TEMPLATE, "Template Studio")
    sbx = _find_or_create_system_journey(c, tid, SYSTEM_KIND_SANDBOX, "Sandbox Studio")
    # Sweep orphan moodboards (journey_id IS NULL) into Sandbox Studio
    orphans = (c.table("moodboards").select("id")
               .eq("tenant_id", tid).is_("journey_id", "null")
               .is_("deleted_at", "null").execute().data or [])
    if orphans:
        for o in orphans:
            c.table("moodboards").update({"journey_id": sbx, "updated_at": _now()}).eq("id", o["id"]).execute()
    return {
        "ok": True,
        "template_studio_id": tpl,
        "sandbox_studio_id": sbx,
        "orphans_reassigned": len(orphans),
    }


@router.get("/journey-assets/moodboards-by-journey")
def moodboards_by_journey(ctx=Depends(get_tenant_context)):
    """Group all moodboards by their journey. Returns ready-to-render structure."""
    tid = ctx["tenant_id"]
    c = db()

    # Load journeys + project + account in one shot
    journeys = (c.table("design_journeys")
                .select("id,project_id,account_id,metadata,updated_at,overall_status")
                .eq("tenant_id", tid).execute().data or [])
    project_ids = list({j["project_id"] for j in journeys if j.get("project_id")})
    account_ids = list({j["account_id"] for j in journeys if j.get("account_id")})

    projects = {}
    if project_ids:
        rows = (c.table("projects").select("id,title").in_("id", project_ids).execute().data or [])
        projects = {r["id"]: r for r in rows}
    accounts = {}
    if account_ids:
        rows = (c.table("accounts").select("id,account_name").in_("id", account_ids).execute().data or [])
        accounts = {r["id"]: r for r in rows}

    # Load all moodboards
    mbs = (c.table("moodboards").select("id,title,journey_id,status,updated_at,cover_metadata,scope")
           .eq("tenant_id", tid).is_("deleted_at", "null")
           .order("updated_at", desc=True).execute().data or [])

    # Bucket by journey
    by_jid: Dict[Optional[str], List[Dict[str, Any]]] = {}
    for m in mbs:
        by_jid.setdefault(m.get("journey_id"), []).append(m)

    groups = []
    for j in journeys:
        items = by_jid.get(j["id"], [])
        if not items:
            continue
        meta = j.get("metadata") or {}
        sys_kind = meta.get("system_kind") if isinstance(meta, dict) else None
        label = (meta.get("label") if isinstance(meta, dict) else None) \
                or (projects.get(j.get("project_id"), {}).get("title")) \
                or "Untitled Journey"
        client = accounts.get(j.get("account_id"), {}).get("account_name")
        groups.append({
            "journey_id": j["id"],
            "label": label,
            "client": client,
            "system_kind": sys_kind,
            "status": j.get("overall_status"),
            "moodboards_count": len(items),
            "last_activity": max((m["updated_at"] for m in items if m.get("updated_at")), default=j.get("updated_at")),
            "moodboards": items,
        })
    # Orphans (journey_id is null) — should be empty after /ensure but keep for safety
    if None in by_jid:
        orph = by_jid[None]
        groups.append({
            "journey_id": None,
            "label": "Orphan Moodboards",
            "client": None,
            "system_kind": "orphan",
            "status": "—",
            "moodboards_count": len(orph),
            "last_activity": max((m["updated_at"] for m in orph if m.get("updated_at")), default=None),
            "moodboards": orph,
        })

    # Sort: Template Studio first, Sandbox last, others by last_activity DESC
    def _sort_key(g):
        sk = g.get("system_kind")
        if sk == SYSTEM_KIND_TEMPLATE: return (0, "")
        if sk == "orphan":             return (2, "")
        if sk == SYSTEM_KIND_SANDBOX:  return (3, "")
        return (1, -(g.get("last_activity") or "").__hash__() & 0xFFFF)
    groups.sort(key=_sort_key)
    return {"groups": groups, "total_moodboards": sum(g["moodboards_count"] for g in groups)}


class _SaveTemplateBody(BaseModel):
    title: Optional[str] = None
    project_type: Optional[str] = None
    market: Optional[str] = None
    investment_range: Optional[str] = None
    style: Optional[str] = None


@router.post("/moodboards/{moodboard_id}/save-as-template")
def save_as_template(moodboard_id: str, body: _SaveTemplateBody, ctx=Depends(get_tenant_context)):
    """Clone moodboard to Template Studio · strip client data / prices / notes."""
    tid = ctx["tenant_id"]
    c = db()

    src = (c.table("moodboards").select("*")
           .eq("tenant_id", tid).eq("id", moodboard_id).limit(1).execute().data or [])
    if not src:
        raise HTTPException(404, "Moodboard not found")
    src = src[0]

    tpl_jid = _find_or_create_system_journey(c, tid, SYSTEM_KIND_TEMPLATE, "Template Studio")
    new_id = str(uuid.uuid4())

    # Strip client-bound fields · preserve layout/composition/hotspots
    new_ai_meta = dict(src.get("ai_metadata") or {})
    new_ai_meta.update({
        "is_template": True,
        "promoted_from": moodboard_id,
        "promoted_at": _now(),
        # Future Blueprint AI hooks
        "project_type": body.project_type,
        "market": body.market,
        "investment_range": body.investment_range,
        "style": body.style,
    })

    payload = {
        "id": new_id,
        "tenant_id": tid,
        "journey_id": tpl_jid,
        "project_id": None,           # detach from any client project
        "milestone_id": None,
        "template_id": moodboard_id,  # reference back to source
        "title": (body.title or src.get("title") or "Template").strip() + " · Template",
        "description": None,           # private notes removed
        "status": "draft",
        "current_version": src.get("current_version") or 1,
        "cover_strategy": src.get("cover_strategy"),
        "cover_metadata": src.get("cover_metadata"),
        "presentation_metadata": src.get("presentation_metadata"),
        "ai_metadata": new_ai_meta,
        "scope": src.get("scope"),
        "room_key": src.get("room_key"),
        "chapter_key": src.get("chapter_key"),
        "visibility": "studio",
        "approval_state": "draft",
        "created_by": ctx.get("profile_id"),
        "created_at": _now(),
        "updated_at": _now(),
    }
    c.table("moodboards").insert(payload).execute()
    return {"ok": True, "template_id": new_id, "template_studio_id": tpl_jid}


@router.patch("/moodboards/{moodboard_id}/journey")
def reassign_journey(moodboard_id: str, body: Dict[str, str], ctx=Depends(get_tenant_context)):
    """Re-bind a moodboard to a specific Design Journey."""
    tid = ctx["tenant_id"]
    new_jid = body.get("journey_id")
    if not new_jid:
        raise HTTPException(400, "journey_id required")
    c = db()
    # Validate journey belongs to tenant
    jr = (c.table("design_journeys").select("id")
          .eq("tenant_id", tid).eq("id", new_jid).limit(1).execute().data or [])
    if not jr:
        raise HTTPException(404, "Journey not found")
    r = (c.table("moodboards").update({"journey_id": new_jid, "updated_at": _now()})
         .eq("tenant_id", tid).eq("id", moodboard_id).execute())
    if not r.data:
        raise HTTPException(404, "Moodboard not found")
    return {"ok": True, "moodboard_id": moodboard_id, "journey_id": new_jid}
