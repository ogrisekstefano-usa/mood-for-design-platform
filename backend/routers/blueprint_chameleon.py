"""ITER177.B · Blueprint Chameleon™ — canonical alias router.

Rebrand: Studio Identity™ → Blueprint Chameleon™.

This router exposes the SAME handlers as `atelier_identity` under the new
canonical path `/api/blueprint/chameleon/*`. No logic duplication. The old
`/api/atelier/identity/*` remains live for 90 days (deprecation period).

Surface:
  GET  /api/blueprint/chameleon/presets   → list 6 canonical presets
  GET  /api/blueprint/chameleon/active    → current tenant identity
  PUT  /api/blueprint/chameleon/active    → update preset/overrides
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, Response
from core.tenant_context import get_tenant_context
from routers.atelier_identity import (
    list_presets as _list_presets,
    get_tenant_identity as _get_my_identity,
    update_tenant_identity as _update_my_identity,
    TenantIdentityUpdate as IdentityUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/blueprint/chameleon", tags=["blueprint-chameleon"])

# Deprecation deadline for the legacy alias.
LEGACY_DEPRECATION_DATE = "2026-08-31"


@router.get("/presets")
def chameleon_list_presets(response: Response, _ctx: dict = Depends(get_tenant_context)):
    response.headers["X-Canonical-Path"] = "/api/blueprint/chameleon/presets"
    return _list_presets(_ctx)


@router.get("/active")
def chameleon_get_active(response: Response, ctx: dict = Depends(get_tenant_context)):
    response.headers["X-Canonical-Path"] = "/api/blueprint/chameleon/active"
    return _get_my_identity(ctx)


@router.put("/active")
def chameleon_update_active(
    body: IdentityUpdate,
    response: Response,
    ctx: dict = Depends(get_tenant_context),
):
    response.headers["X-Canonical-Path"] = "/api/blueprint/chameleon/active"
    return _update_my_identity(body, ctx)
