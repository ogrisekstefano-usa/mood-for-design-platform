"""ITER185 · Phase 1 · Account Lifecycle endpoints.

Implements canonical Prospect ↔ Customer transitions per CRM Foundation
Locked Model §B.5:

    POST /api/accounts/{aid}/convert-to-customer
    POST /api/accounts/{aid}/revert-to-prospect

Both transitions are manual, audit-logged in funnel_events, and require
explicit reason (revert) or proposal_id (convert).

Reference: CRM_FOUNDATION_LOCKED_MODEL.md §B.5 + ITER185_PHASE1_IMPLEMENTATION_PLAN.md §6.
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
from core.permissions import P_LEADS_WRITE

router = APIRouter()
log = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# LOCKED enum values that semantically mean "Prospect" (interpret-on-read)
PROSPECT_SEMANTIC_STAGES = (
    "prospect", "in_proposal",
    # legacy values that map to prospect in display
    "new_inquiry", "lead", "discovery", "conversation_open",
)

# LOCKED enum values that semantically mean "Customer"
CUSTOMER_SEMANTIC_STAGES = (
    "customer",
    "active_project", "existing_client", "repeat_client",  # legacy
)


# ── Pydantic models ──────────────────────────────────────────────────
class ConvertToCustomerBody(BaseModel):
    proposal_id: Optional[str] = None  # canonical: required (admin can override)
    signed_at: Optional[str] = None     # ISO date
    signed_by_contact_id: Optional[str] = None
    notes: Optional[str] = None
    admin_override: Optional[bool] = False


class RevertToProspectBody(BaseModel):
    reason: str = Field(min_length=10, max_length=500)
    admin_override: Optional[bool] = False


# ── Helpers ──────────────────────────────────────────────────────────
def _account_in_tenant(client, account_id: str, tenant_id: str) -> dict:
    r = (
        client.table("accounts")
        .select("*")
        .eq("id", account_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    )
    if not r.data:
        raise HTTPException(
            status_code=404,
            detail={"code": "ACCOUNT-NOT-FOUND", "message": "Account not found"},
        )
    return r.data[0]


# ── Endpoints ────────────────────────────────────────────────────────
@router.post("/accounts/{account_id}/convert-to-customer")
def convert_to_customer(
    account_id: str,
    body: ConvertToCustomerBody,
    current_user: dict = Depends(require_permission(P_LEADS_WRITE)),
):
    """ITER185.P1 · Prospect → Customer transition.

    Side effects:
      - accounts.lifecycle_stage = 'customer'
      - accounts.signed_proposal_id = proposal_id (if provided)
      - funnel_events(stage='customer', event='customer.confirmed')
    """
    client = db()
    tid = current_user["tenant_id"]
    account = _account_in_tenant(client, account_id, tid)

    current_stage = (account.get("lifecycle_stage") or "").lower()
    if current_stage not in PROSPECT_SEMANTIC_STAGES:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "ACCOUNT-INVALID-STAGE",
                "message": f"Cannot convert to customer from lifecycle_stage='{current_stage}'.",
                "allowed_from": list(PROSPECT_SEMANTIC_STAGES),
            },
        )

    is_admin = current_user.get("role") in ("super_admin", "tenant_admin")

    # If proposal_id provided, validate it
    proposal_id = body.proposal_id
    proposal_status = None
    if proposal_id:
        pr = (
            client.table("proposals")
            .select("id, account_id, status, tenant_id")
            .eq("id", proposal_id)
            .eq("tenant_id", tid)
            .limit(1)
            .execute()
        )
        if not pr.data:
            raise HTTPException(
                status_code=404,
                detail={"code": "PROPOSAL-NOT-FOUND", "message": "Proposal not found"},
            )
        prop = pr.data[0]
        if prop.get("account_id") and prop["account_id"] != account_id:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "PROPOSAL-ACCOUNT-MISMATCH",
                    "message": "Proposal belongs to a different account.",
                },
            )
        proposal_status = (prop.get("status") or "").lower()
        if proposal_status not in ("signed", "approved", "won") and not (body.admin_override and is_admin):
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "PROPOSAL-NOT-SIGNED",
                    "message": f"Proposal status is '{proposal_status}', expected signed/approved/won. Admin can override.",
                    "proposal_status": proposal_status,
                },
            )
    elif not (body.admin_override and is_admin):
        # No proposal_id and not admin override → block
        raise HTTPException(
            status_code=422,
            detail={
                "code": "PROPOSAL-REQUIRED",
                "message": "proposal_id is required to convert to customer. Admin can set admin_override=true.",
            },
        )

    # ── Update account ─────────────────────────────────────────────
    update_payload = {
        "lifecycle_stage": "customer",
        "updated_at": _now(),
    }
    # Set signed_proposal_id if column exists (Phase 1 will add it via migration)
    if proposal_id:
        update_payload["signed_proposal_id"] = proposal_id
        update_payload["metadata_json"] = {
            **(account.get("metadata_json") or {}),
            "signed_at": body.signed_at,
            "signed_by_contact_id": body.signed_by_contact_id,
            "convert_notes": body.notes,
            "converted_by": current_user.get("user_id") or current_user.get("id"),
            "converted_at": _now(),
        }
    try:
        client.table("accounts").update(update_payload).eq("id", account_id).execute()
    except Exception as e:
        # If signed_proposal_id column missing, retry without it (migration pending)
        log.warning(f"convert_to_customer: signed_proposal_id update failed, retrying minimal: {e}")
        update_payload.pop("signed_proposal_id", None)
        client.table("accounts").update(update_payload).eq("id", account_id).execute()

    # ── Audit funnel_event ─────────────────────────────────────────
    try:
        client.table("funnel_events").insert({
            "id": str(uuid.uuid4()),
            "tenant_id": tid,
            "lead_id": account.get("lead_id"),
            "stage": "customer",
            "event_name": "customer.confirmed",
            "metadata_json": {
                "account_id": account_id,
                "proposal_id": proposal_id,
                "proposal_status": proposal_status,
                "signed_at": body.signed_at,
                "conducted_by": current_user.get("user_id") or current_user.get("id"),
                "admin_override": bool(body.admin_override),
            },
            "created_at": _now(),
        }).execute()
    except Exception:
        log.exception("convert_to_customer: funnel_events insert failed (non-blocking)")

    # Fresh fetch
    updated = _account_in_tenant(client, account_id, tid)
    log.info(f"account.convert_to_customer aid={account_id} from={current_stage} proposal={proposal_id}")
    return {
        "account": updated,
        "transition": {"from": current_stage, "to": "customer"},
    }


@router.post("/accounts/{account_id}/revert-to-prospect")
def revert_to_prospect(
    account_id: str,
    body: RevertToProspectBody,
    current_user: dict = Depends(require_permission(P_LEADS_WRITE)),
):
    """ITER185.P1 · Customer → Prospect rollback (admin audit).

    Side effects:
      - accounts.lifecycle_stage = 'prospect'
      - accounts.signed_proposal_id = NULL
      - funnel_events(stage='prospect', event='customer.reverted')
    """
    client = db()
    tid = current_user["tenant_id"]
    account = _account_in_tenant(client, account_id, tid)

    current_stage = (account.get("lifecycle_stage") or "").lower()
    if current_stage not in CUSTOMER_SEMANTIC_STAGES:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "ACCOUNT-INVALID-STAGE",
                "message": f"Cannot revert from lifecycle_stage='{current_stage}'. Must be customer.",
                "allowed_from": list(CUSTOMER_SEMANTIC_STAGES),
            },
        )

    is_admin = current_user.get("role") in ("super_admin", "tenant_admin")
    if not is_admin and not body.admin_override:
        # Non-admin can still revert their own conversion (no strict admin gate),
        # but log explicitly. Founder requested "audit", not "admin-only block".
        pass

    update_payload = {
        "lifecycle_stage": "prospect",
        "updated_at": _now(),
        "metadata_json": {
            **(account.get("metadata_json") or {}),
            "reverted_from": current_stage,
            "revert_reason": body.reason,
            "reverted_by": current_user.get("user_id") or current_user.get("id"),
            "reverted_at": _now(),
        },
    }
    try:
        # Try clear signed_proposal_id if column exists
        update_payload["signed_proposal_id"] = None
        client.table("accounts").update(update_payload).eq("id", account_id).execute()
    except Exception as e:
        log.warning(f"revert_to_prospect: signed_proposal_id update failed, retrying: {e}")
        update_payload.pop("signed_proposal_id", None)
        client.table("accounts").update(update_payload).eq("id", account_id).execute()

    # ── Audit funnel_event ─────────────────────────────────────────
    try:
        client.table("funnel_events").insert({
            "id": str(uuid.uuid4()),
            "tenant_id": tid,
            "lead_id": account.get("lead_id"),
            "stage": "prospect",
            "event_name": "customer.reverted",
            "metadata_json": {
                "account_id": account_id,
                "reason": body.reason,
                "reverted_from": current_stage,
                "conducted_by": current_user.get("user_id") or current_user.get("id"),
            },
            "created_at": _now(),
        }).execute()
    except Exception:
        log.exception("revert_to_prospect: funnel_events insert failed (non-blocking)")

    updated = _account_in_tenant(client, account_id, tid)
    log.info(f"account.revert_to_prospect aid={account_id} from={current_stage} reason={body.reason[:50]}")
    return {
        "account": updated,
        "transition": {"from": current_stage, "to": "prospect"},
    }
