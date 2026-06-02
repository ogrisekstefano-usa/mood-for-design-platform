"""
ITER160 — Admin endpoints for Studio Requests.

Mounted under /api/admin/studio. Auth-protected via the advisor scope
guard (Bearer JWT). Visibility rules:
  • super admin (role=admin/editor) → all studio_requests
  • advisor (role=advisor)          → own + unassigned only
"""
from fastapi import APIRouter, Body, Depends, HTTPException, Query

from services import studio_activation
from routers._advisor_scope import require_advisor_scope


router = APIRouter(prefix="/admin/studio", tags=["admin-studio"])


@router.get("/requests")
async def list_requests(
    status: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    scope: dict = Depends(require_advisor_scope),
):
    """List qualified studio requests (most-recent first)."""
    advisor_visibility_id = None if scope["is_super_admin"] else scope["advisor_id"]
    return await studio_activation.list_requests(
        status=status,
        limit=limit,
        advisor_visibility_id=advisor_visibility_id,
    )


@router.patch("/requests/{request_id}")
async def update_request(
    request_id: str,
    body: dict = Body(...),
    scope: dict = Depends(require_advisor_scope),
):
    """Update advisor workflow fields (status / advisor_notes).

    Advisor scope: must own (assigned_advisor_id == me) OR the request
    must be unassigned (advisor self-claims by editing it). Cannot edit
    a request assigned to a different advisor.

    The 'activated' status is INTENTIONALLY rejected here: activation is
    a curatorial moment that requires the advisor to confirm the tenant
    slug + send the founder invitation in a single, irreversible step.
    Use POST /api/admin/studio/requests/{id}/activate instead.
    """
    if body.get("status") == "activated":
        raise HTTPException(
            status_code=409,
            detail="use_activate_endpoint",
        )
    if not scope["is_super_admin"]:
        # Fetch the request and check assignment.
        current = await studio_activation.get_request(request_id)
        if not current:
            raise HTTPException(status_code=404, detail="Studio request not found")
        assigned = current.get("assigned_advisor_id")
        if assigned and assigned != scope["advisor_id"]:
            raise HTTPException(status_code=404, detail="Studio request not found")
    ok = await studio_activation.update_request_status(
        request_id=request_id,
        status=body.get("status"),
        advisor_notes=body.get("advisor_notes"),
        # Advisor self-claim: if they touch an unassigned request, they
        # become its assigned advisor (COALESCE keeps existing owners).
        assigned_advisor_id=(None if scope["is_super_admin"] else scope["advisor_id"]),
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Studio request not found")
    return {"ok": True}


# ── Activation modal: preview + execute ──────────────────────────────
@router.get("/requests/{request_id}/activation-preview")
async def activation_preview(
    request_id: str,
    scope: dict = Depends(require_advisor_scope),
):
    """
    Pre-fills the advisor activation modal with:
      • tenant_name      (defaults to studio_name, editable in UI)
      • suggested_slug   (auto-derived + uniqueness-checked, editable)
      • founder_email    (read-only)
      • magic_link_validity_days (read-only, currently 30)
      • already_activated (true → modal renders the "already done" state)
    """
    if not scope["is_super_admin"]:
        current = await studio_activation.get_request(request_id)
        if not current:
            raise HTTPException(status_code=404, detail="Studio request not found")
        assigned = current.get("assigned_advisor_id")
        if assigned and assigned != scope["advisor_id"]:
            raise HTTPException(status_code=404, detail="Studio request not found")
    preview = await studio_activation.get_activation_preview(request_id)
    if not preview:
        raise HTTPException(status_code=404, detail="Studio request not found")
    return preview


@router.post("/requests/{request_id}/activate")
async def activate_request(
    request_id: str,
    body: dict = Body(default={}),
    scope: dict = Depends(require_advisor_scope),
):
    """
    Full-auto activation: from studio_request to Founder magic-link in
    a single advisor confirmation.

    Body:
      { tenant_slug?: str, tenant_name?: str }

    Effect (all atomic from the advisor's standpoint):
      • Opens a studio_relation from the request if none exists.
      • Creates the tenant (with the confirmed slug + name).
      • Creates the founder users row (role='owner').
      • Issues a 30-day magic link.
      • Fires the studio_request_approved email with the magic link as CTA.
      • Updates studio_requests.status → 'activated'.

    Advisor scope: must own (or self-claim) the request.
    """
    if not scope["is_super_admin"]:
        current = await studio_activation.get_request(request_id)
        if not current:
            raise HTTPException(status_code=404, detail="Studio request not found")
        assigned = current.get("assigned_advisor_id")
        if assigned and assigned != scope["advisor_id"]:
            raise HTTPException(status_code=404, detail="Studio request not found")
        # Self-claim if currently unassigned.
        if not assigned:
            await studio_activation.update_request_status(
                request_id=request_id,
                assigned_advisor_id=scope["advisor_id"],
            )

    result = await studio_activation.activate_request_full_auto(
        request_id=request_id,
        actor_user_id=scope.get("user_id"),
        actor_advisor_id=None if scope["is_super_admin"] else scope["advisor_id"],
        tenant_slug_override=(body.get("tenant_slug") or "").strip() or None,
        tenant_name_override=(body.get("tenant_name") or "").strip() or None,
    )
    if not result.get("ok"):
        # Map domain errors to HTTP semantics
        reason = result.get("reason")
        if reason == "not_found":
            raise HTTPException(status_code=404, detail=reason)
        if reason == "already_activated":
            raise HTTPException(status_code=409, detail=result)
        raise HTTPException(status_code=400, detail=result)
    return result
