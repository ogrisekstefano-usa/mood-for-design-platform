"""Lightweight product-event telemetry endpoint.

Append-only. NO retrieval API in MVP — events are queried directly via SQL by
the product team. Body shape is intentionally generic:

    { event_type, entity_type?, entity_id?, payload?, session_id? }

Auth: prefers the authenticated user (writes both tenant_id and user_id), but
also accepts unauthenticated calls from the public /review/ surface (omits
tenant_id and user_id then). This keeps the call site dumb — the frontend
always fires the same `trackEvent()` regardless of route.
"""
import os
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

from database import db, db_available

router = APIRouter()


class TrackPayload(BaseModel):
    event_type: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    session_id: Optional[str] = None


def _user_from_bearer(authorization: Optional[str]) -> Dict[str, Optional[str]]:
    """Best-effort extraction of (tenant_id, user_id) from a Supabase JWT.

    Failures are SILENT — events from anonymous review sessions must still
    succeed. We never raise from inside this helper.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return {"tenant_id": None, "user_id": None}
    token = authorization.split(" ", 1)[1]
    try:
        client = db()
        ar = client.auth.get_user(token)
        sb_user_id = ar.user.id if ar and getattr(ar, "user", None) else None
        if not sb_user_id:
            return {"tenant_id": None, "user_id": None}
        prof = client.table("users_profile").select("id, tenant_id") \
            .eq("auth_user_id", sb_user_id).limit(1).execute()
        if not prof.data:
            return {"tenant_id": None, "user_id": None}
        return {"tenant_id": prof.data[0]["tenant_id"], "user_id": prof.data[0]["id"]}
    except Exception:  # noqa: BLE001
        return {"tenant_id": None, "user_id": None}


@router.post("/track", status_code=202)
async def track(body: TrackPayload, request: Request,
                authorization: Optional[str] = Header(None)):
    if not db_available():
        # Telemetry is non-critical — never fail the UX if the DB is offline.
        return {"accepted": False, "reason": "db_unavailable"}
    if not body.event_type or len(body.event_type) > 120:
        raise HTTPException(400, "event_type required (<=120 chars)")
    info = _user_from_bearer(authorization)
    row = {
        "id": str(uuid.uuid4()),
        "tenant_id": info["tenant_id"],
        "user_id": info["user_id"],
        "event_type": body.event_type,
        "entity_type": body.entity_type,
        "entity_id": body.entity_id,
        "payload_json": body.payload or {},
        "session_id": body.session_id,
        "ua": (request.headers.get("user-agent") or "")[:300],
    }
    try:
        db().table("product_events").insert(row).execute()
    except Exception:  # noqa: BLE001
        # Logging failures must NEVER bubble into the client. Just drop.
        return {"accepted": False}
    return {"accepted": True}
