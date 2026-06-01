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
    force: Optional[bool] = False  # ITER185.P1 · admin override progress gate


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


# ─────────────────────────────────────────────────────────────────────────────
# ITER185 · Phase 1 · DISCOVERY PROGRESS ENGINE™
#
# Deterministic 0-100% calculation with 4 named sections (Founder UX
# preference: named checklist over % text). Each section = 25%.
#
#   A · Contact info       (name + (email OR phone) + source)
#   B · Project type       (market_sector OR project_type signal)
#   C · Budget             (qualification_signals.budget)
#   D · Timeline           (qualification_signals.timeline)
#
# Used by:
#   - LeadDetailPage progress widget
#   - qualify() endpoint as gate (>= 75% or admin force)
# ─────────────────────────────────────────────────────────────────────────────

_PROGRESS_SECTIONS = [
    {
        "key": "contact_info",
        "weight": 25,
        "label": "Informazioni di contatto",
        "label_en": "Contact information",
    },
    {
        "key": "project_type",
        "weight": 25,
        "label": "Tipo di progetto",
        "label_en": "Project type",
    },
    {
        "key": "budget",
        "weight": 25,
        "label": "Budget",
        "label_en": "Budget",
    },
    {
        "key": "timeline",
        "weight": 25,
        "label": "Tempistiche",
        "label_en": "Timeline",
    },
]


def _calc_progress(lead: dict, discovery: dict) -> dict:
    """Pure function: compute progress from lead + discovery dicts."""
    signals = discovery.get("qualification_signals") or {}
    sections = []

    # A · Contact info — name AND (email OR phone) AND source
    name_ok = bool((lead.get("first_name") or "").strip())
    contact_ok = bool((lead.get("email") or "").strip()) or bool((lead.get("phone") or "").strip())
    source_ok = bool((lead.get("source") or "").strip())
    contact_done = name_ok and contact_ok and source_ok
    sections.append({
        "key": "contact_info",
        "weight": 25,
        "label": "Informazioni di contatto",
        "completed": contact_done,
        "missing_fields": [f for ok, f in [(name_ok, "name"), (contact_ok, "email_or_phone"), (source_ok, "source")] if not ok],
    })

    # B · Project type — market_sector OR project_type signal OR property_type signal
    has_sector = bool((lead.get("market_sector") or "").strip())
    has_signal = bool(signals.get("project_type") or signals.get("market_sector") or signals.get("property_type"))
    project_done = has_sector or has_signal
    sections.append({
        "key": "project_type",
        "weight": 25,
        "label": "Tipo di progetto",
        "completed": project_done,
        "missing_fields": [] if project_done else ["market_sector"],
    })

    # C · Budget — qualification_signals.budget != null
    has_budget = signals.get("budget") not in (None, "", {}, [])
    sections.append({
        "key": "budget",
        "weight": 25,
        "label": "Budget",
        "completed": has_budget,
        "missing_fields": [] if has_budget else ["budget"],
    })

    # D · Timeline — qualification_signals.timeline != null
    has_timeline = signals.get("timeline") not in (None, "", {}, [])
    sections.append({
        "key": "timeline",
        "weight": 25,
        "label": "Tempistiche",
        "completed": has_timeline,
        "missing_fields": [] if has_timeline else ["timeline"],
    })

    progress_pct = sum(s["weight"] for s in sections if s["completed"])
    return {
        "discovery_id": discovery.get("id"),
        "lead_id": discovery.get("lead_id") or lead.get("id"),
        "progress_pct": progress_pct,
        "sections": sections,
        "qualify_eligible": progress_pct >= 75,
        "calculated_at": _now(),
    }


@router.get("/discovery/{discovery_id}/progress")
def get_discovery_progress(
    discovery_id: str,
    current_user: dict = Depends(require_permission(P_LEADS_READ)),
):
    """ITER185.P1 · Discovery progress (0/25/50/75/100, deterministic, 4 sections)."""
    client = db()
    d = _discovery_by_id(client, discovery_id, current_user["tenant_id"])
    lead = _lead_in_tenant(client, d["lead_id"], current_user["tenant_id"])
    return _calc_progress(lead, d)


@router.get("/leads/{lead_id}/discovery/progress")
def get_lead_discovery_progress(
    lead_id: str,
    current_user: dict = Depends(require_permission(P_LEADS_READ)),
):
    """Convenience: progress for the lead's current discovery."""
    client = db()
    lead = _lead_in_tenant(client, lead_id, current_user["tenant_id"])
    d = _discovery_for_lead(client, lead_id)
    if not d:
        # No discovery yet: only contact_info section can be partially complete
        return _calc_progress(lead, {"id": None, "lead_id": lead_id, "qualification_signals": {}})
    return _calc_progress(lead, d)


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

    # ITER185.P1 · Progress gate: require >= 75% unless admin force=true
    is_admin = current_user.get("role") in ("super_admin", "tenant_admin")
    # Merge any inbound signals into discovery for accurate progress calc
    merged_signals_preview = {**(d.get("qualification_signals") or {}), **(body.qualification_signals or {})}
    progress_view = _calc_progress(lead, {**d, "qualification_signals": merged_signals_preview})
    if progress_view["progress_pct"] < 75 and not (body.force and is_admin):
        raise HTTPException(
            status_code=422,
            detail={
                "code": "DISCOVERY-PROGRESS-INSUFFICIENT",
                "message": "Discovery must reach 75% before qualification. Admin can override with force=true.",
                "progress": progress_view,
            },
        )

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

    # ITER185.P1 · Audit trail
    try:
        client.table("funnel_events").insert({
            "id": str(uuid.uuid4()),
            "tenant_id": current_user["tenant_id"],
            "lead_id": lead["id"],
            "stage": "prospect",
            "event_name": "discovery.qualified",
            "metadata_json": {
                "discovery_id": discovery_id,
                "account_id": account_id,
                "conducted_by": current_user.get("user_id") or current_user.get("id"),
                "force": bool(body.force),
            },
            "created_at": _now(),
        }).execute()
    except Exception:
        log.exception("qualify: funnel_events insert failed (non-blocking)")

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
