"""
STORE-005 · Lead → Prospect → Design Journey™
Conversion Engine · zero new tables · uses leads.metadata_json + designs_journeys + projects.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from core.tenant_context import get_tenant_context
from database import db

router = APIRouter()


class QualificationBody(BaseModel):
    project_type: Optional[List[str]] = None
    space_status: Optional[str] = None      # "yes" | "looking" | "not_yet"
    timeline: Optional[str] = None           # "30d" | "1-3m" | "3-6m" | "6m+" | "exploring"
    interest: Optional[str] = None           # "yes" | "maybe" | "not_now"
    notes: Optional[str] = None


class DiscoverBody(BaseModel):
    feel: Optional[List[str]] = None             # warm/elegant/minimal/...
    visual_style: Optional[List[str]] = None     # references picked from grid
    scope: Optional[List[str]] = None            # spaces involved
    priorities: Optional[List[str]] = None       # aesthetics/functionality/materials/...
    constraints: Optional[str] = None
    investment_range: Optional[str] = None       # to_be_defined | essential | mid | premium | luxury


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_qualified(meta: Dict[str, Any]) -> bool:
    q = (meta or {}).get("qualification") or {}
    has_project = bool(q.get("project_type"))
    has_timeline = bool(q.get("timeline"))
    has_interest = q.get("interest") in ("yes", "maybe")
    return has_project and has_timeline and has_interest


@router.post("/leads/{lead_id}/qualify")
def qualify_lead(lead_id: str, body: QualificationBody, ctx=Depends(get_tenant_context)):
    tid = ctx["tenant_id"]
    c = db()
    rows = (c.table("leads").select("*")
            .eq("tenant_id", tid).eq("id", lead_id).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Lead not found")
    lead = rows[0]
    meta = lead.get("metadata_json") or {}
    if not isinstance(meta, dict):
        meta = {}
    q = meta.get("qualification") or {}
    for k, v in body.model_dump(exclude_none=True).items():
        q[k] = v
    q["qualified_at"] = _now()
    meta["qualification"] = q

    patch = {"metadata_json": meta, "updated_at": _now()}
    # Snapshot to top-level columns (keeps existing CRM compatible)
    if body.project_type:
        patch["project_type"] = ",".join(body.project_type)
    if body.timeline:
        patch["timeline"] = body.timeline
    if body.notes:
        patch["notes"] = body.notes

    # Auto-promote to prospect via pipeline_stage (lead_type enum is for client classification, not pipeline)
    auto_promoted = False
    if _is_qualified(meta) and (lead.get("pipeline_stage") or "new") in ("new", "contacted"):
        patch["pipeline_stage"] = "prospect"
        auto_promoted = True

    r = (c.table("leads").update(patch).eq("tenant_id", tid).eq("id", lead_id).execute())
    if not r.data:
        raise HTTPException(500, "Update failed")
    return {
        "ok": True,
        "lead_id": lead_id,
        "qualified": _is_qualified(meta),
        "auto_promoted_to_prospect": auto_promoted,
        "qualification": q,
    }


@router.post("/leads/{lead_id}/start-journey")
def start_journey(lead_id: str, body: Optional[DiscoverBody] = Body(default=None), ctx=Depends(get_tenant_context)):
    """Create design_journey + project + brief milestone in one shot.
    Pre-fills with qualification answers + optional Discover seed."""
    tid = ctx["tenant_id"]
    profile_id = ctx.get("profile_id")
    c = db()

    rows = (c.table("leads").select("*")
            .eq("tenant_id", tid).eq("id", lead_id).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Lead not found")
    lead = rows[0]
    meta = lead.get("metadata_json") or {}
    if not isinstance(meta, dict):
        meta = {}
    qual = meta.get("qualification") or {}

    # Reuse existing journey if already started
    if lead.get("first_journey_id"):
        return {"ok": True, "journey_id": lead["first_journey_id"], "reused": True}

    name = " ".join(filter(None, [lead.get("first_name"), lead.get("last_name")])) or lead.get("email") or "Untitled"
    project_type_raw = lead.get("project_type") or (",".join(qual.get("project_type") or []) or None)

    # 0) Ensure an account exists (design_journeys.account_id is NOT NULL)
    # Try to find existing account already promoted from this lead
    existing_acc = (c.table("accounts").select("id")
                    .eq("tenant_id", tid).eq("legacy_lead_id", lead_id)
                    .limit(1).execute().data or [])
    if existing_acc:
        account_id = existing_acc[0]["id"]
    else:
        account_id = str(uuid.uuid4())
        c.table("accounts").insert({
            "id": account_id,
            "tenant_id": tid,
            "account_name": name,
            "account_type": "private_client",
            "lifecycle_stage": "active",
            "source": lead.get("source"),
            "email": lead.get("email"),
            "phone": lead.get("phone"),
            "notes": lead.get("notes"),
            "metadata_json": {"qualification": qual, "source_lead_id": lead_id},
            "cultural_profile": {},
            "legacy_lead_id": lead_id,
            "created_at": _now(),
            "updated_at": _now(),
        }).execute()

    # 1) project
    project_id = str(uuid.uuid4())
    project_payload = {
        "id": project_id,
        "tenant_id": tid,
        "lead_id": lead_id,
        "title": f"{name} · Design Journey",
        "description": lead.get("notes") or None,
        "project_type": project_type_raw,
        "status": "new",
        "priority": "normal",
        "timeline": lead.get("timeline") or qual.get("timeline"),
        "metadata_json": {
            "source": "lead_conversion",
            "qualification": qual,
            "discover_seed": (body.model_dump(exclude_none=True) if body else {}),
        },
        "created_at": _now(),
        "updated_at": _now(),
    }
    c.table("projects").insert(project_payload).execute()

    # 2) design_journey
    journey_id = str(uuid.uuid4())
    journey_payload = {
        "id": journey_id,
        "tenant_id": tid,
        "account_id": account_id,
        "project_id": project_id,
        "overall_status": "in_progress",
        "started_at": _now(),
        "lifecycle_state": "conversation_open",
        "created_by": profile_id,
        "created_at": _now(),
        "updated_at": _now(),
    }
    c.table("design_journeys").insert(journey_payload).execute()

    # 3) Brief milestone (DISCOVER phase entry point)
    brief_milestone_id = str(uuid.uuid4())
    c.table("journey_milestones").insert({
        "id": brief_milestone_id,
        "tenant_id": tid,
        "journey_id": journey_id,
        "milestone_type": "brief",
        "title": "Brief & Discover",
        "status": "in_progress",
        "order_index": 1,
        "started_at": _now(),
        "metadata": {
            "qualification": qual,
            "discover": (body.model_dump(exclude_none=True) if body else {}),
        },
        "created_at": _now(),
        "updated_at": _now(),
    }).execute()

    # 4) link back to lead
    c.table("leads").update({
        "first_journey_id": journey_id,
        "pipeline_stage": "active",
        "updated_at": _now(),
    }).eq("tenant_id", tid).eq("id", lead_id).execute()

    return {
        "ok": True,
        "journey_id": journey_id,
        "project_id": project_id,
        "brief_milestone_id": brief_milestone_id,
        "reused": False,
    }


@router.post("/journeys/{journey_id}/discover")
def save_discover(journey_id: str, body: DiscoverBody, ctx=Depends(get_tenant_context)):
    """Persist Discover answers into the brief milestone payload."""
    tid = ctx["tenant_id"]
    c = db()
    j = (c.table("design_journeys").select("id,project_id")
         .eq("tenant_id", tid).eq("id", journey_id).limit(1).execute().data or [])
    if not j:
        raise HTTPException(404, "Journey not found")
    project_id = j[0]["project_id"]

    # find brief milestone
    ms = (c.table("journey_milestones").select("id,metadata")
          .eq("tenant_id", tid).eq("journey_id", journey_id)
          .eq("milestone_type", "brief").limit(1).execute().data or [])
    if not ms:
        raise HTTPException(404, "Brief milestone not found")
    payload = ms[0].get("metadata") or {}
    if not isinstance(payload, dict):
        payload = {}
    discover = payload.get("discover") or {}
    discover.update(body.model_dump(exclude_none=True))
    payload["discover"] = discover

    c.table("journey_milestones").update({
        "metadata": payload,
        "updated_at": _now(),
    }).eq("id", ms[0]["id"]).execute()

    # mirror into project.metadata_json for quick reads
    proj = (c.table("projects").select("metadata_json")
            .eq("id", project_id).limit(1).execute().data or [])
    if proj:
        pm = proj[0].get("metadata_json") or {}
        if not isinstance(pm, dict):
            pm = {}
        pm["discover"] = discover
        c.table("projects").update({"metadata_json": pm, "updated_at": _now()}).eq("id", project_id).execute()

    return {"ok": True, "discover": discover}


@router.get("/journeys/{journey_id}/discover")
def get_discover(journey_id: str, ctx=Depends(get_tenant_context)):
    tid = ctx["tenant_id"]
    c = db()
    ms = (c.table("journey_milestones").select("metadata")
          .eq("tenant_id", tid).eq("journey_id", journey_id)
          .eq("milestone_type", "brief").limit(1).execute().data or [])
    if not ms:
        return {"discover": {}, "qualification": {}}
    payload = ms[0].get("metadata") or {}
    return {
        "discover": payload.get("discover") or {},
        "qualification": payload.get("qualification") or {},
    }
