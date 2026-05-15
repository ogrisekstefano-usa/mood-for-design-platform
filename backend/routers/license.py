"""Licensing API — tenant license summary + super-admin plan assignment.

Routes:
  GET  /api/license                       — current tenant license + usage
  GET  /api/license/plans                 — public catalog (Starter/Studio/Enterprise)
  POST /api/license/{tenant_id}/assign    — super_admin only: change plan or
                                            override individual limits
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.tenant_context import get_tenant_context
from core.permissions import is_super_admin
from core.licensing import (
    get_tenant_license, get_tenant_usage,
    list_plans, assign_plan, PLANS,
)

router = APIRouter()


class AssignPlanBody(BaseModel):
    plan_key: str
    override_limits: Optional[dict] = None     # {"max_users": 5}
    override_modules: Optional[List[str]] = None


@router.get("")
def get_license(ctx: dict = Depends(get_tenant_context)):
    """Effective license + live usage for the current tenant."""
    lic = get_tenant_license(ctx["tenant_id"])
    usage = get_tenant_usage(ctx["tenant_id"])
    return {**lic, "usage": usage}


@router.get("/plans")
def get_plans(include_custom: bool = False, _ctx: dict = Depends(get_tenant_context)):
    return {"plans": list_plans(public_only=not include_custom)}


@router.post("/{tenant_id}/assign")
def assign_plan_endpoint(
    tenant_id: str,
    body: AssignPlanBody,
    ctx: dict = Depends(get_tenant_context),
):
    if not is_super_admin(ctx.get("role")):
        raise HTTPException(403, "Only super_admin can assign plans")
    if body.plan_key not in PLANS:
        raise HTTPException(400, f"Unknown plan: {body.plan_key}")
    lic = assign_plan(
        tenant_id, body.plan_key,
        assigned_by=ctx.get("profile_id"),
        override_limits=body.override_limits,
        override_modules=body.override_modules,
    )
    return lic
