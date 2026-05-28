"""
ITER160 — Studio Activation router.

Public endpoints (no auth) that drive the in-page composition. Errors
are intentionally fail-soft — the contract is "the composition never
breaks" (see PRD §10.6 — concierge intercepts).
"""
from __future__ import annotations

from fastapi import APIRouter, Body, Request

from services import studio_activation


router = APIRouter(prefix="/studio/activation", tags=["studio-activation"])


@router.get("/manifest")
async def get_manifest():
    """Static archetypes + experiences + copy-keys map."""
    return studio_activation.manifest()


@router.post("/draft")
async def create_or_resume_draft(
    request: Request,
    body: dict | None = Body(default=None),
):
    """
    Returns the in-progress draft. If body contains `draft_token` and it
    matches an unfinished draft, that draft is returned. Otherwise a new
    draft is created and the new `draft_token` is returned in the JSON.
    The client is expected to persist `draft_token` in localStorage.
    """
    body = body or {}
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    try:
        return await studio_activation.get_or_create_draft(
            draft_token=body.get("draft_token"),
            ip=ip,
            user_agent=ua,
        )
    except Exception:
        # Last-resort fail-soft: at minimum, hand back a fresh token so
        # the UI can keep going.
        return {
            "draft_token": studio_activation.new_draft_token(),
            "current_movement": "entrance",
            "archetype": None, "experiences": [], "payload": {},
        }


@router.patch("/draft")
async def patch_draft(body: dict = Body(...)):
    """
    Silent autosave. Body shape:
      {
        "draft_token": "...",
        "archetype":   "interior_studio" | null,
        "experiences": ["design_journey_os", ...],
        "payload":     { "studio_name": "...", "monogram": "...", ... },
        "movement":    "practice" | ...,
        "founder_email": "..."  (optional)
      }
    Unknown values are silently ignored — never raises.
    """
    try:
        return await studio_activation.patch_draft(
            draft_token=body.get("draft_token") or "",
            archetype=body.get("archetype"),
            experiences=body.get("experiences"),
            payload_patch=body.get("payload"),
            movement=body.get("movement"),
            founder_email=body.get("founder_email"),
        )
    except Exception:
        # Silent failure — the UI continues without a confirmation.
        return {"ok": False}
