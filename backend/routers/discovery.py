"""ITER177.B · Discovery Interview endpoints.

Implements canonical CRM Phase 1 lifecycle:

    pending → in_progress → qualified | unqualified | recycled

Side effects on `qualify()`:
  - leads.status                  → 'qualified'
  - accounts(lifecycle_stage='prospect') created (if not present)
  - emits discovery_interview.qualified event

Reference: CRM_LIFECYCLE_IMPLEMENTATION_PLAN.md §2.
"""
from __future__ import annotations

import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from database import db
from core.tenant_context import require_permission
from core.permissions import P_LEADS_READ, P_LEADS_WRITE

router = APIRouter()
log = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Pydantic models ──────────────────────────────────────────────────
class StartDiscoveryBody(BaseModel):
    notes: Optional[str] = None


class UpdateDiscoveryBody(BaseModel):
    notes: Optional[str] = None
    qualification_signals: Optional[dict] = None


class QualifyBody(BaseModel):
    qualification_signals: Optional[dict] = Field(default_factory=dict)
    notes: Optional[str] = None
    account_name: Optional[str] = None  # override account display name


class DisqualifyBody(BaseModel):
    reason: str
    notes: Optional[str] = None


# ── Helpers ──────────────────────────────────────────────────────────
def _lead_in_tenant(client, lead_id: str, tenant_id: str) -> dict:
    r = client.table("leads").select("*").eq("id", lead_id).eq("tenant_id", tenant_id).limit(1).execute()
    if not r.data:
        raise HTTPException(status_code=404, detail={"code": "LEAD-NOT-FOUND", "message": "Lead not found"})
    return r.data[0]


def _discovery_for_lead(client, lead_id: str) -> Optional[dict]:
    r = (
        client.table("discovery_interviews")
        .select("*")
        .eq("lead_id", lead_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return r.data[0] if r.data else None


def _discovery_by_id(client, discovery_id: str, tenant_id: str) -> dict:
    r = (
        client.table("discovery_interviews")
        .select("*")
        .eq("id", discovery_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    )
    if not r.data:
        raise HTTPException(status_code=404, detail={"code": "DISCOVERY-NOT-FOUND", "message": "Discovery not found"})
    return r.data[0]


def _ensure_account_prospect(client, lead: dict, account_name_override: Optional[str] = None) -> str:
    """Return existing account_id linked to the lead, or create a prospect account."""
    existing = (
        client.table("accounts")
        .select("id, lifecycle_stage")
        .eq("tenant_id", lead["tenant_id"])
        .eq("email", lead.get("email") or "")
        .limit(1)
        .execute()
    )
    if existing.data:
        acc = existing.data[0]
        if acc["lifecycle_stage"] in ("conversation_open", "new", None):
            client.table("accounts").update({
                "lifecycle_stage": "prospect",
                "updated_at": _now(),
            }).eq("id", acc["id"]).execute()
        return acc["id"]
    # Create new prospect account
    account_id = str(uuid.uuid4())
    display = account_name_override or (
        f"{(lead.get('first_name') or '').strip()} {(lead.get('last_name') or '').strip()}".strip()
        or lead.get("email")
        or "Prospect"
    )
    client.table("accounts").insert({
        "id": account_id,
        "tenant_id": lead["tenant_id"],
        "account_name": display,
        "account_type": "private_client",
        "lifecycle_stage": "prospect",
        "source": lead.get("source") or "manual_discovery",
        "email": lead.get("email"),
        "phone": lead.get("phone"),
        "language": lead.get("language") or "it",
        "locale_code": lead.get("locale_code") or "it",
        "metadata_json": {"created_from_lead": lead["id"]},
        "created_at": _now(),
        "updated_at": _now(),
    }).execute()
    return account_id


# ── Endpoints on a lead ──────────────────────────────────────────────
@router.post("/leads/{lead_id}/discovery", status_code=201)
def open_discovery(
    lead_id: str,
    body: StartDiscoveryBody = StartDiscoveryBody(),
    current_user: dict = Depends(require_permission(P_LEADS_WRITE)),
):
    """Create a pending Discovery row if none exists, else return current."""
    client = db()
    lead = _lead_in_tenant(client, lead_id, current_user["tenant_id"])
    existing = _discovery_for_lead(client, lead_id)
    if existing and existing["status"] in ("pending", "in_progress"):
        return existing
    did = str(uuid.uuid4())
    row = {
        "id": did,
        "tenant_id": current_user["tenant_id"],
        "lead_id": lead_id,
        "status": "pending",
        "source": "manual",
        "notes": body.notes,
        "conducted_by": current_user.get("user_id") or current_user.get("id"),
        "created_at": _now(),
        "updated_at": _now(),
    }
    client.table("discovery_interviews").insert(row).execute()
    # bump lead status if still 'new'
    if lead.get("status") == "new":
        client.table("leads").update({"status": "new", "updated_at": _now()}).eq("id", lead_id).execute()
    return row


@router.get("/leads/{lead_id}/discovery")
def get_discovery_for_lead(
    lead_id: str,
    current_user: dict = Depends(require_permission(P_LEADS_READ)),
):
    client = db()
    _lead_in_tenant(client, lead_id, current_user["tenant_id"])
    d = _discovery_for_lead(client, lead_id)
    return d or {"status": "absent", "lead_id": lead_id}


# ── Endpoints on a discovery row ─────────────────────────────────────
@router.post("/discovery/{discovery_id}/start")
def start_discovery(
    discovery_id: str,
    current_user: dict = Depends(require_permission(P_LEADS_WRITE)),
):
    client = db()
    d = _discovery_by_id(client, discovery_id, current_user["tenant_id"])
    if d["status"] not in ("pending",):
        raise HTTPException(status_code=409, detail={"code": "DISCOVERY-INVALID-STATE", "message": f"Cannot start from status {d['status']}"})
    client.table("discovery_interviews").update({
        "status": "in_progress",
        "started_at": _now(),
        "conducted_by": current_user.get("user_id") or current_user.get("id"),
        "updated_at": _now(),
    }).eq("id", discovery_id).execute()
    # bump lead status
    client.table("leads").update({"status": "new", "updated_at": _now()}).eq("id", d["lead_id"]).execute()
    return _discovery_by_id(client, discovery_id, current_user["tenant_id"])


@router.put("/discovery/{discovery_id}")
def update_discovery(
    discovery_id: str,
    body: UpdateDiscoveryBody,
    current_user: dict = Depends(require_permission(P_LEADS_WRITE)),
):
    client = db()
    d = _discovery_by_id(client, discovery_id, current_user["tenant_id"])
    patch = {"updated_at": _now()}
    if body.notes is not None:
        patch["notes"] = body.notes
    if body.qualification_signals is not None:
        merged = {**(d.get("qualification_signals") or {}), **body.qualification_signals}
        patch["qualification_signals"] = merged
    client.table("discovery_interviews").update(patch).eq("id", discovery_id).execute()
    return _discovery_by_id(client, discovery_id, current_user["tenant_id"])


@router.post("/discovery/{discovery_id}/qualify")
def qualify_discovery(
    discovery_id: str,
    body: QualifyBody = QualifyBody(),
    current_user: dict = Depends(require_permission(P_LEADS_WRITE)),
):
    """Promote Discovery → qualified. Side effects:
       - lead.status = 'qualified'
       - account(lifecycle_stage='prospect') ensured
    """
    client = db()
    d = _discovery_by_id(client, discovery_id, current_user["tenant_id"])
    if d["status"] in ("qualified",):
        # Idempotent: return existing
        return d
    if d["status"] not in ("pending", "in_progress"):
        raise HTTPException(status_code=409, detail={"code": "DISCOVERY-INVALID-STATE", "message": f"Cannot qualify from {d['status']}"})

    lead = _lead_in_tenant(client, d["lead_id"], current_user["tenant_id"])
    account_id = _ensure_account_prospect(client, lead, body.account_name)

    merged_signals = {**(d.get("qualification_signals") or {}), **(body.qualification_signals or {})}
    client.table("discovery_interviews").update({
        "status": "qualified",
        "completed_at": _now(),
        "qualification_signals": merged_signals,
        "notes": body.notes or d.get("notes"),
        "metadata_json": {**(d.get("metadata_json") or {}), "qualified_account_id": account_id},
        "updated_at": _now(),
    }).eq("id", discovery_id).execute()

    client.table("leads").update({
        "status": "qualified",
        "updated_at": _now(),
    }).eq("id", lead["id"]).execute()

    log.info(f"discovery.qualified discovery={discovery_id} lead={lead['id']} account={account_id}")
    return {
        **_discovery_by_id(client, discovery_id, current_user["tenant_id"]),
        "account_id": account_id,
    }


@router.post("/discovery/{discovery_id}/disqualify")
def disqualify_discovery(
    discovery_id: str,
    body: DisqualifyBody,
    current_user: dict = Depends(require_permission(P_LEADS_WRITE)),
):
    client = db()
    d = _discovery_by_id(client, discovery_id, current_user["tenant_id"])
    if d["status"] in ("unqualified", "qualified"):
        raise HTTPException(status_code=409, detail={"code": "DISCOVERY-INVALID-STATE", "message": f"Cannot disqualify from {d['status']}"})
    client.table("discovery_interviews").update({
        "status": "unqualified",
        "completed_at": _now(),
        "disqualification_reason": body.reason,
        "notes": body.notes or d.get("notes"),
        "updated_at": _now(),
    }).eq("id", discovery_id).execute()
    client.table("leads").update({
        "status": "unqualified",
        "updated_at": _now(),
    }).eq("id", d["lead_id"]).execute()
    return _discovery_by_id(client, discovery_id, current_user["tenant_id"])


@router.post("/discovery/{discovery_id}/recycle")
def recycle_discovery(
    discovery_id: str,
    current_user: dict = Depends(require_permission(P_LEADS_WRITE)),
):
    client = db()
    d = _discovery_by_id(client, discovery_id, current_user["tenant_id"])
    if d["status"] not in ("unqualified",):
        raise HTTPException(status_code=409, detail={"code": "DISCOVERY-INVALID-STATE", "message": f"Cannot recycle from {d['status']}"})
    client.table("discovery_interviews").update({
        "status": "recycled",
        "updated_at": _now(),
    }).eq("id", discovery_id).execute()
    client.table("leads").update({
        "status": "recycled",
        "updated_at": _now(),
    }).eq("id", d["lead_id"]).execute()
    return _discovery_by_id(client, discovery_id, current_user["tenant_id"])


@router.get("/discovery/{discovery_id}")
def get_discovery(
    discovery_id: str,
    current_user: dict = Depends(require_permission(P_LEADS_READ)),
):
    client = db()
    return _discovery_by_id(client, discovery_id, current_user["tenant_id"])
