"""
ITER160 — Admin endpoints for Studio Requests.

Mounted under /api/admin/studio. Auth-protected via the standard
admin guard (Bearer JWT with role ∈ {admin, owner}).
"""
from fastapi import APIRouter, Body, Depends, HTTPException, Query

from services import studio_activation
from routers._auth import require_admin_tenant


router = APIRouter(prefix="/admin/studio", tags=["admin-studio"])


@router.get("/requests")
async def list_requests(
    status: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    _tenant: dict = Depends(require_admin_tenant),
):
    """List qualified studio requests (most-recent first)."""
    return await studio_activation.list_requests(status=status, limit=limit)


@router.patch("/requests/{request_id}")
async def update_request(
    request_id: str,
    body: dict = Body(...),
    _tenant: dict = Depends(require_admin_tenant),
):
    """Update advisor workflow fields (status / advisor_notes)."""
    ok = await studio_activation.update_request_status(
        request_id=request_id,
        status=body.get("status"),
        advisor_notes=body.get("advisor_notes"),
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Studio request not found")
    return {"ok": True}
