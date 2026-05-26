"""
Guided Tour — ITER154 · First Experience Activation
====================================================

Editorial onboarding for the studio atelier.
NOT a SaaS tooltip. An invitation to inhabit the studio.

Endpoints (all prefixed with /api/onboarding):

  GET  /tour?key=studio_first_login   · steps + my state
  POST /tour/state                     · upsert {status, current_step}
  POST /tour/reset                     · clear my state (debug / re-run)

Lightweight by design. The persistence pattern is one row per
(user_id, tour_key). The configuration table is DB-driven so future
sprints can override copy per tenant without code change.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context
from database import db

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─────────────────────────────────────────────────────────────────
# GET /api/onboarding/tour
# ─────────────────────────────────────────────────────────────────
@router.get("/tour")
def get_tour(
    key: str = Query("studio_first_login"),
    ctx: dict = Depends(get_tenant_context),
):
    """Return the tour configuration + the current user's state.

    Resolution: tenant-specific overrides first, fall back to the
    platform default (tenant_id IS NULL).
    """
    sb = db()
    tid = ctx["tenant_id"]
    uid = ctx["profile_id"]

    # Tenant-specific rows
    tenant_rows = (
        sb.table("guided_tour_config")
        .select("step_order, target_selector, route, eyebrow, title, body, "
                "role_visibility, module_dependency, placement, enabled")
        .eq("tour_key", key)
        .eq("tenant_id", tid)
        .order("step_order")
        .execute()
    ).data or []

    rows = tenant_rows
    if not rows:
        # Platform default (tenant_id IS NULL)
        rows = (
            sb.table("guided_tour_config")
            .select("step_order, target_selector, route, eyebrow, title, body, "
                    "role_visibility, module_dependency, placement, enabled")
            .is_("tenant_id", "null")
            .eq("tour_key", key)
            .order("step_order")
            .execute()
        ).data or []

    role = (ctx.get("role") or "").lower()

    steps = []
    for r in rows:
        if not r.get("enabled", True):
            continue
        rv = r.get("role_visibility")
        if rv and role not in [x.lower() for x in rv]:
            continue
        steps.append({
            "order": r["step_order"],
            "target_selector": r.get("target_selector"),
            "route": r.get("route"),
            "eyebrow": r.get("eyebrow") or {},
            "title": r.get("title") or {},
            "body": r.get("body") or {},
            "placement": r.get("placement") or "auto",
            "module_dependency": r.get("module_dependency"),
        })

    # State row
    state_rows = (
        sb.table("user_onboarding_state")
        .select("status, current_step, completed_at, skipped_at, updated_at")
        .eq("user_id", uid)
        .eq("tour_key", key)
        .limit(1)
        .execute()
    ).data or []
    state = state_rows[0] if state_rows else {
        "status": "not_started",
        "current_step": 0,
        "completed_at": None,
        "skipped_at": None,
    }

    return {
        "tour_key": key,
        "steps": steps,
        "state": state,
        "total_steps": len(steps),
    }


# ─────────────────────────────────────────────────────────────────
# POST /api/onboarding/tour/state
# ─────────────────────────────────────────────────────────────────
class TourStateIn(BaseModel):
    tour_key: str = "studio_first_login"
    status: str = Field(..., pattern="^(not_started|in_progress|completed|skipped)$")
    current_step: int = 0


@router.post("/tour/state")
def upsert_state(
    payload: TourStateIn,
    ctx: dict = Depends(get_tenant_context),
):
    """Upsert the user's tour state."""
    sb = db()
    uid = ctx["profile_id"]
    tid = ctx["tenant_id"]
    now = _now_iso()

    update = {
        "status": payload.status,
        "current_step": max(0, payload.current_step),
        "updated_at": now,
    }
    if payload.status == "completed":
        update["completed_at"] = now
    if payload.status == "skipped":
        update["skipped_at"] = now

    existing = (
        sb.table("user_onboarding_state")
        .select("id")
        .eq("user_id", uid)
        .eq("tour_key", payload.tour_key)
        .limit(1)
        .execute()
    ).data

    if existing:
        sb.table("user_onboarding_state").update(update).eq("id", existing[0]["id"]).execute()
    else:
        sb.table("user_onboarding_state").insert({
            "tenant_id": tid,
            "user_id": uid,
            "tour_key": payload.tour_key,
            "created_at": now,
            **update,
        }).execute()

    return {"ok": True, **update}


# ─────────────────────────────────────────────────────────────────
# POST /api/onboarding/tour/reset
# ─────────────────────────────────────────────────────────────────
@router.post("/tour/reset")
def reset_state(
    key: str = Query("studio_first_login"),
    ctx: dict = Depends(get_tenant_context),
):
    """Reset the user's tour state (debug / re-run)."""
    sb = db()
    sb.table("user_onboarding_state").delete().eq("user_id", ctx["profile_id"]).eq("tour_key", key).execute()
    return {"ok": True}
