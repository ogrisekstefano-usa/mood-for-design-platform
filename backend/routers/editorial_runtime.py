"""ITER143A+ · Dynamic Editorial Runtime™ — Public API.

Routes
──────
  GET  /api/content/page/{page_key}    → bundle of {key: value} for a page
  GET  /api/content/blocks             → mirror, for targeted lookups
  POST /api/content/blocks/{id}/regenerate  (SuperAdmin) → force ALE re-gen

The bundle endpoint is intentionally PUBLIC (no auth) — it serves the
storefront / begin-journey / professionals / footer / header copy that
the prospect sees before they sign in. Tenant-scoped lookups still
require the resolved tenant context (via subdomain or header).
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from core.permissions import is_super_admin
from middleware.auth import get_current_user
from services.editorial_content_orchestrator import (
    resolve_page_bundle,
    list_blocks,
    upsert_block,
    regenerate_block,
    ACTIVE_LOCALES,
)

log = logging.getLogger(__name__)
router = APIRouter()


@router.get("/page/{page_key}")
def get_page_bundle(
    page_key: str,
    request: Request,
    locale: str = Query("it-IT"),
    scope: str = Query("system"),
):
    """Resolve a page bundle for the requested locale.

    Tenant scope is auto-derived from the request (subdomain → resolved
    tenant). For scope=system, tenant_id is ignored.
    """
    if scope not in ("system", "tenant"):
        raise HTTPException(400, "invalid scope")
    tenant_id: Optional[str] = None
    if scope == "tenant":
        rt = getattr(request.state, "resolved_tenant", None)
        if not rt or not rt.get("tenant_id"):
            raise HTTPException(400, "tenant scope requires a resolved tenant context")
        tenant_id = rt["tenant_id"]
    blocks = resolve_page_bundle(page_key, locale, scope=scope, tenant_id=tenant_id)
    return {
        "page_key":   page_key,
        "locale":     locale,
        "scope":      scope,
        "tenant_id":  tenant_id,
        "blocks":     blocks,
        "count":      len(blocks),
    }


@router.get("/blocks")
def list_content_blocks(
    request: Request,
    scope: str = Query("system"),
    page_key: Optional[str] = Query(None),
    namespace: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Governance helper — list all blocks for inspection / future CMS UI.

    SuperAdmin → can list any scope.
    tenant_admin → only their own tenant scope.
    """
    role = (current_user or {}).get("role") or ""
    super_admin = is_super_admin(role)
    if scope == "system" and not super_admin:
        raise HTTPException(403, "SuperAdmin required for system scope")
    tenant_id = None
    if scope == "tenant":
        tenant_id = current_user.get("tenant_id")
        if not tenant_id:
            raise HTTPException(400, "tenant context required")
    return {
        "scope":    scope,
        "tenant_id": tenant_id,
        "blocks":   list_blocks(scope=scope, tenant_id=tenant_id,
                                page_key=page_key, namespace=namespace),
        "active_locales": list(ACTIVE_LOCALES),
    }


@router.post("/blocks/{block_id}/regenerate")
def regenerate(block_id: str,
               current_user: dict = Depends(get_current_user)):
    """Force ALE regeneration for a block (SuperAdmin only)."""
    role = (current_user or {}).get("role") or ""
    if not is_super_admin(role):
        raise HTTPException(403, "SuperAdmin required")
    return regenerate_block(block_id, force=True)
