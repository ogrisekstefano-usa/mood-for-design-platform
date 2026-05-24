"""ITER147 · International Profile Identity™ — Router.

Public endpoints (all require an authenticated tenant member).

  GET    /api/profile/me/identity
  PATCH  /api/profile/me/identity/source
  PATCH  /api/profile/me/identity/{field}/{locale}
  POST   /api/profile/me/identity/{field}/{locale}/regenerate
  POST   /api/profile/me/identity/{field}/{locale}/lock
  POST   /api/profile/me/identity/{field}/{locale}/restore-ale

  GET    /api/profile/{profile_id}/identity/resolve?locale=en-US
         (read-only, used by public-facing surfaces — no auth required
          beyond tenant context).

The first PATCH /source ALSO writes the canonical column on
`users_profile` so legacy reads of `/api/profile/me` keep working
without a schema migration. Reads of localized values go through the
editorial_blocks namespace.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context
from database import db, db_available
from services import profile_identity_resolver as pir

router = APIRouter()


# ── DTOs ──────────────────────────────────────────────────────────────
class SourceFieldPatch(BaseModel):
    role_label:           Optional[str] = None
    short_bio:            Optional[str] = None
    response_time_label:  Optional[str] = None
    contact_cta_label:    Optional[str] = None
    source_locale:        Optional[str] = Field(
        default=None,
        description="If omitted, the tenant's default_locale is used.",
    )


class ManualOverridePatch(BaseModel):
    value: str = Field(..., min_length=1, max_length=2000)


# ── Helpers ───────────────────────────────────────────────────────────
def _profile_id_or_403(ctx: dict) -> str:
    pid = ctx.get("profile_id")
    if not pid:
        raise HTTPException(status_code=401, detail="profile required")
    return pid


def _tenant_id_or_400(ctx: dict) -> str:
    tid = ctx.get("tenant_id")
    if not tid:
        raise HTTPException(status_code=400, detail="tenant context missing")
    return tid


def _validate_field(field: str) -> None:
    if field not in pir.SUPPORTED_FIELDS:
        raise HTTPException(
            status_code=400,
            detail=f"unsupported field; allowed: {list(pir.SUPPORTED_FIELDS)}",
        )


# ── READ ──────────────────────────────────────────────────────────────
@router.get("/me/identity")
def get_my_identity(ctx: dict = Depends(get_tenant_context)):
    if not db_available():
        raise HTTPException(503, "database unavailable")
    pid = _profile_id_or_403(ctx)
    tid = _tenant_id_or_400(ctx)
    return pir.get_identity(profile_id=pid, tenant_id=tid)


# ── WRITE · source ────────────────────────────────────────────────────
@router.patch("/me/identity/source")
def patch_identity_source(
    payload: SourceFieldPatch = Body(...),
    ctx: dict = Depends(get_tenant_context),
):
    if not db_available():
        raise HTTPException(503, "database unavailable")
    pid = _profile_id_or_403(ctx)
    tid = _tenant_id_or_400(ctx)

    written = []
    column_update = {}
    for field in pir.SUPPORTED_FIELDS:
        value = getattr(payload, field, None)
        if value is None:
            continue
        if not value.strip():
            # Empty string clears the legacy column but does NOT create
            # an editorial block. We don't translate emptiness.
            column_update[field] = None
            continue
        block = pir.upsert_source(
            profile_id=pid,
            tenant_id=tid,
            field=field,
            source_value=value.strip(),
            source_locale=payload.source_locale,
        )
        written.append({"field": field, "block_id": block["id"]})
        column_update[field] = value.strip()

    # Mirror onto users_profile so legacy /api/profile/me consumers keep
    # rendering the source-locale value without an extra hop.
    if column_update:
        from datetime import datetime, timezone
        column_update["updated_at"] = datetime.now(timezone.utc).isoformat()
        db().table("users_profile").update(column_update).eq("id", pid).execute()

    return {
        "written": written,
        "identity": pir.get_identity(profile_id=pid, tenant_id=tid),
    }


# ── WRITE · per-locale ────────────────────────────────────────────────
@router.patch("/me/identity/{field}/{locale}")
def patch_identity_locale(
    field: str, locale: str,
    payload: ManualOverridePatch = Body(...),
    ctx: dict = Depends(get_tenant_context),
):
    if not db_available():
        raise HTTPException(503, "database unavailable")
    _validate_field(field)
    pid = _profile_id_or_403(ctx)
    tid = _tenant_id_or_400(ctx)
    try:
        result = pir.set_manual(
            profile_id=pid, tenant_id=tid, field=field,
            target_locale=locale, value=payload.value.strip(),
        )
    except LookupError as e:
        raise HTTPException(409, str(e))
    return {"ok": True, "result": result,
            "identity": pir.get_identity(profile_id=pid, tenant_id=tid)}


@router.post("/me/identity/{field}/{locale}/regenerate")
def regenerate_identity_locale(
    field: str, locale: str,
    ctx: dict = Depends(get_tenant_context),
):
    if not db_available():
        raise HTTPException(503, "database unavailable")
    _validate_field(field)
    pid = _profile_id_or_403(ctx)
    tid = _tenant_id_or_400(ctx)
    try:
        result = pir.regenerate_locale(
            profile_id=pid, tenant_id=tid, field=field, target_locale=locale,
        )
    except LookupError as e:
        raise HTTPException(409, str(e))
    except PermissionError as e:
        raise HTTPException(409, str(e))
    return {"ok": True, "result": result,
            "identity": pir.get_identity(profile_id=pid, tenant_id=tid)}


@router.post("/me/identity/{field}/{locale}/lock")
def lock_identity_locale(
    field: str, locale: str,
    locked: bool = True,
    ctx: dict = Depends(get_tenant_context),
):
    if not db_available():
        raise HTTPException(503, "database unavailable")
    _validate_field(field)
    pid = _profile_id_or_403(ctx)
    tid = _tenant_id_or_400(ctx)
    try:
        result = pir.lock_locale(
            profile_id=pid, tenant_id=tid, field=field,
            target_locale=locale, locked=locked,
        )
    except LookupError as e:
        raise HTTPException(409, str(e))
    return {"ok": True, "result": result,
            "identity": pir.get_identity(profile_id=pid, tenant_id=tid)}


@router.post("/me/identity/{field}/{locale}/restore-ale")
def restore_identity_locale(
    field: str, locale: str,
    ctx: dict = Depends(get_tenant_context),
):
    if not db_available():
        raise HTTPException(503, "database unavailable")
    _validate_field(field)
    pid = _profile_id_or_403(ctx)
    tid = _tenant_id_or_400(ctx)
    try:
        result = pir.restore_ale(
            profile_id=pid, tenant_id=tid, field=field, target_locale=locale,
        )
    except LookupError as e:
        raise HTTPException(409, str(e))
    return {"ok": True, "result": result,
            "identity": pir.get_identity(profile_id=pid, tenant_id=tid)}


# ── Public client-facing resolve (cross-tenant exposure) ──────────────
@router.get("/{profile_id}/identity/resolve")
def resolve_identity(
    profile_id: str,
    locale: str,
    ctx: dict = Depends(get_tenant_context),
):
    """Return the four identity fields resolved to a single locale.

    Used by client-facing surfaces (project portals, messaging
    headers, public profile cards). The strict in-family fallback
    chain guarantees no cross-language leak (e.g. an en-US client
    will never see Italian text unless en-US, en-GB and en are all
    missing AND the source is Italian — in which case the source is
    returned as the last-resort fallback).
    """
    if not db_available():
        raise HTTPException(503, "database unavailable")
    tid = _tenant_id_or_400(ctx)
    fields = pir.resolve_for_locale(
        profile_id=profile_id, tenant_id=tid, locale=locale,
    )
    return {
        "profile_id": profile_id,
        "tenant_id":  tid,
        "locale":     locale,
        "fields":     fields,
    }
