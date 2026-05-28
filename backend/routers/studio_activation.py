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
async def get_manifest(locale: str = "it"):
    """
    Static archetypes + experiences + copy-keys map.
    When `locale` is provided, includes a `copy` dict with all blocks
    pre-resolved (eliminates 100+ round-trips on page mount).
    """
    return await studio_activation.manifest_with_copy(locale)


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


@router.post("/submit")
async def submit_request(request: Request, body: dict = Body(...)):
    """
    Submit the Guided Introduction Request.

    This is *NOT* an account creation. The studio profile is stored as a
    `studio_requests` row with status='received' and a MOOD Advisor
    follows up manually.

    Body shape:
      {
        "draft_token":    "...",
        "contact_email":  "founder@studio.com",
        "contact_name":   "...",
        "contact_role":   "...",
        "phone_prefix":   "+39",
        "phone_number":   "...",
        "website":        "...",
        "notes":          "...",
        "locale":         "it"
      }

    Response:
      { ok:true,  request_id: "...", reference: "MOOD-XXXX-XXXX" }
      { ok:false, reason: "empty_email"|"no_draft"|"internal" }
    """
    try:
        ip = request.client.host if request.client else None
        ua = request.headers.get("user-agent")
        return await studio_activation.submit_request(
            draft_token=body.get("draft_token") or "",
            contact_email=body.get("contact_email") or "",
            contact_name=body.get("contact_name"),
            contact_role=body.get("contact_role"),
            phone_prefix=body.get("phone_prefix"),
            phone_number=body.get("phone_number"),
            website=body.get("website"),
            notes=body.get("notes"),
            locale=body.get("locale") or "it",
            ip=ip, user_agent=ua,
        )
    except Exception:
        return {"ok": False, "reason": "internal"}
