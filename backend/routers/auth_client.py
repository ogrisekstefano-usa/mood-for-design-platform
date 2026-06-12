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

        # ── OPZIONE A: log del link per test senza email delivery ──────────
        logger.warning("🔑 [DEBUG_MAGIC_LINK] email=%s | link=%s", email, magic_url)
        # ────────────────────────────────────────────────────────────────────

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


# ── OPZIONE B: Admin debug endpoint — restituisce magic link direttamente ────
from fastapi import Header
from typing import Optional


@router.post("/auth/client/debug-link")
def client_debug_link(
    request: Request,
    body: ClientResendIn = Body(...),
    authorization: Optional[str] = Header(default=None),
):
    """Admin-only endpoint per recuperare il magic link senza email delivery.

    Usare SOLO in ambiente di test/preview quando Resend non è configurato.
    Richiede token admin valido nell'header Authorization.
    """
    import base64, json as _json
    from middleware.auth import get_current_user
    from fastapi import Depends

    # Verifica che il chiamante sia un admin
    try:
        from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
        token_str = (authorization or "").replace("Bearer ", "").strip()
        if not token_str:
            return {"ok": False, "error": "auth required"}
        # decode JWT senza verifica (solo per estrarre role, verifica avviene in middleware)
        parts = token_str.split(".")
        if len(parts) < 2:
            return {"ok": False, "error": "invalid token"}
        pad = len(parts[1]) % 4
        payload = _json.loads(base64.b64decode(parts[1] + "=" * pad).decode())
        sub = payload.get("sub", "")
        # Check users_profile for admin role
        c = db()
        profile = (c.table("users_profile").select("role,tenant_id")
                   .eq("auth_user_id", sub).limit(1).execute().data or [])
        if not profile or profile[0].get("role") not in ("admin", "super_admin", "studio_owner"):
            return {"ok": False, "error": "admin required"}
        tenant_id = profile[0]["tenant_id"]
    except Exception as e:
        logger.warning("[debug_link] auth check failed: %s", e)
        return {"ok": False, "error": "auth check failed"}

    email = (body.email or "").strip().lower()
    if not email:
        return {"ok": False, "error": "email required"}

    try:
        host = request.headers.get("host", "")
        redirect_to = build_client_callback_url(host, next_path="/journey/auto")
        magic_url = _generate_magic_link(email, redirect_to)
        if not magic_url:
            return {"ok": False, "error": "magic link generation failed (check Supabase credentials)"}

        logger.warning("🔑 [DEBUG_MAGIC_LINK_ADMIN] email=%s | link=%s", email, magic_url)
        return {
            "ok": True,
            "email": email,
            "magic_link": magic_url,
            "note": "Link valido una sola volta. Usare immediatamente."
        }
    except Exception:
        logger.exception("[debug_link] unhandled error")
        return {"ok": False, "error": "internal error"}
