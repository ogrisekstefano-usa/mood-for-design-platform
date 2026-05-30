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
    """
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
