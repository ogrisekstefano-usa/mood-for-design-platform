"""
Studio V2 — public router (no auth).
"""
from __future__ import annotations
from fastapi import APIRouter, Body, Query, Request

from services import studio_v2

router = APIRouter(prefix="/studio/v2", tags=["studio-v2"])


@router.get("/manifest")
async def manifest(locale: str = Query(default='it-IT')):
    return await studio_v2.manifest(locale=locale)


@router.get("/check-email")
async def check_email(email: str = Query(...)):
    return await studio_v2.check_email_uniqueness(email)


@router.get("/cities")
async def search_cities(
    country: str = Query(..., description="ISO-3166-1 alpha-2 (e.g. IT)"),
    q: str = Query(..., min_length=2),
    limit: int = Query(default=5, ge=1, le=10),
):
    return {"items": await studio_v2.search_cities(q, country, limit=limit)}


@router.post("/submit")
async def submit(request: Request, body: dict = Body(...)):
    try:
        ip = request.client.host if request.client else None
        ua = request.headers.get("user-agent")
        return await studio_v2.submit_v2(
            draft_token       = body.get("draft_token") or "",
            archetype_code    = body.get("archetype_code") or "",
            country           = body.get("country") or "",
            city              = body.get("city"),
            additional_markets= body.get("additional_markets") or [],
            first_name        = body.get("first_name") or "",
            last_name         = body.get("last_name")  or "",
            contact_email     = body.get("contact_email") or "",
            phone_prefix      = body.get("phone_prefix"),
            phone_number      = body.get("phone_number"),
            help_topics       = body.get("help_topics") or [],
            help_other_text   = body.get("help_other_text"),
            locale            = body.get("locale") or "it-IT",
            ip=ip, user_agent=ua,
        )
    except Exception:
        import logging
        logging.getLogger('studio_v2').exception("submit failed")
        return {"ok": False, "reason": "internal"}
