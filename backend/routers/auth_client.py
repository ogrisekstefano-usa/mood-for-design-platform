"""ITER169 · Client Access Continuity™ — dedicated resend endpoint.

POST /api/auth/client/resend  { "email": "..." }
  • Looks up email in `accounts`
  • Generates a fresh Supabase magic link
  • Sends the cinematic Email Continuity™ "magic_link" template
  • Always returns 200 (anti-enumeration)
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Request, Body
from pydantic import BaseModel, EmailStr

from database import db
from services.auth_redirect import build_client_callback_url
from services.client_provisioning import _generate_magic_link
from services.email_service import send_template_email

logger = logging.getLogger(__name__)
router = APIRouter()


class ClientResendIn(BaseModel):
    email: EmailStr


@router.post("/auth/client/resend")
def client_resend(request: Request, body: ClientResendIn = Body(...)):
    email = (body.email or "").strip().lower()
    if not email:
        return {"ok": True, "sent": False}

    try:
        c = db()
        rows = (c.table("accounts")
                .select("id, tenant_id, account_name, email")
                .ilike("email", email)
                .limit(1).execute().data or [])
        if not rows:
            logger.info("[client_resend] unknown email (silent)")
            return {"ok": True, "sent": False}

        tenant_id  = rows[0].get("tenant_id")
        first_name = (rows[0].get("account_name") or "").split(" ")[0] or "Ospite"
        studio_name = "Lo Studio"
        if tenant_id:
            trow = (c.table("tenants").select("name").eq("id", tenant_id)
                    .limit(1).execute().data or [])
            if trow:
                studio_name = trow[0].get("name") or studio_name

        host = request.headers.get("host", "")
        redirect_to = build_client_callback_url(host, next_path="/journey/auto")
        magic_url = _generate_magic_link(email, redirect_to)
        if not magic_url:
            logger.warning("[client_resend] generate_link failed")
            return {"ok": True, "sent": False}

        result = send_template_email(
            to=email,
            template_key="magic_link",
            context={
                "first_name":     first_name,
                "studio_name":    studio_name,
                "magic_url":      magic_url,    # <-- key expected by template
                "magic_link_url": magic_url,    # alias for compat
                "kind":           "resend",
            },
            event_type="client_access_resend",
            tenant_id=tenant_id,
            source_host=host,
        )
        return {"ok": True, "sent": bool(result.get("ok"))}
    except Exception:
        logger.exception("[client_resend] unhandled error")
        return {"ok": True, "sent": False}
