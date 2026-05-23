"""ITER143E · Tenant Email Branding™ API.

Routes under /api/tenant/email-branding — accessible by tenant_admin
(for their own tenant) and root_superadmin (for any tenant via ?tenant_id=).

Editable fields:
  sender_name, reply_to, support_email, footer_company_name,
  footer_address, footer_phone, socials, logo_url, primary_color,
  secondary_color (accent_color), email_signature, legal_footer,
  privacy_url, terms_url.

Reserved (centralized in Blueprint™, NOT editable by tenant):
  provider_type, sender_email (domain-bound), email_domain,
  active, locale_default.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from database import db, db_available
from middleware.auth import get_current_user

log = logging.getLogger(__name__)
router = APIRouter()


EDITABLE_FIELDS = {
    "sender_name", "reply_to", "support_email",
    "logo_url", "primary_color", "accent_color",
    "footer_signature", "footer_company_name",
    "footer_address", "footer_phone", "socials",
    "email_signature", "legal_footer", "privacy_url", "terms_url",
}


def _resolve_tenant_id(user: dict, requested: Optional[str]) -> str:
    is_root = bool(user.get("is_root_superadmin"))
    role = (user.get("role") or "").lower()
    if requested:
        if not is_root and requested != user.get("tenant_id"):
            raise HTTPException(403, "cross-tenant access denied")
        return requested
    tid = user.get("tenant_id")
    if not tid:
        raise HTTPException(400, "tenant context missing")
    if role not in ("tenant_admin", "super_admin") and not is_root:
        raise HTTPException(403, "tenant_admin required")
    return tid


@router.get("")
def get_branding(user: dict = Depends(get_current_user),
                 tenant_id: Optional[str] = Query(None)):
    tid = _resolve_tenant_id(user, tenant_id)
    c = db()
    rows = (c.table("tenant_email_settings").select("*")
            .eq("tenant_id", tid).limit(1).execute().data or [])
    return {"tenant_id": tid, "settings": rows[0] if rows else None,
            "editable_fields": sorted(EDITABLE_FIELDS)}


@router.patch("")
def patch_branding(body: dict,
                   user: dict = Depends(get_current_user),
                   tenant_id: Optional[str] = Query(None)):
    tid = _resolve_tenant_id(user, tenant_id)
    if not db_available():
        raise HTTPException(503, "database unavailable")
    c = db()
    updates = {k: v for k, v in (body or {}).items() if k in EDITABLE_FIELDS}
    if not updates:
        raise HTTPException(400, "no editable fields in payload")
    existing = (c.table("tenant_email_settings").select("*")
                .eq("tenant_id", tid).limit(1).execute().data or [])

    now = datetime.now(timezone.utc).isoformat()
    if existing:
        c.table("tenant_email_settings").update({**updates, "updated_at": now})\
            .eq("id", existing[0]["id"]).execute()
    else:
        payload = {
            "tenant_id":      tid,
            "sender_name":    updates.get("sender_name") or "MOOD for DESIGN™",
            "sender_email":   "onboarding@resend.dev",
            "provider_type":  "resend",
            "active":         True,
            "locale_default": "it-IT",
            "created_at":     now, "updated_at": now,
            **updates,
        }
        c.table("tenant_email_settings").insert(payload).execute()

    return get_branding(user=user, tenant_id=tid)


@router.post("/preview")
def preview_branding(body: dict, user: dict = Depends(get_current_user),
                     tenant_id: Optional[str] = Query(None)):
    """Render the chosen template with the current draft settings and
    return the HTML — no sending. Useful for the editor preview pane."""
    from services.email_templates import render as render_template
    tid = _resolve_tenant_id(user, tenant_id)
    template_key = (body or {}).get("template_key", "password_reset")
    draft = (body or {}).get("draft") or {}
    # Merge into a virtual tenant_settings so the template sees the draft.
    fake_settings = {**draft}
    ctx = {
        "tenant_settings": fake_settings,
        "first_name":  "Anna",
        "reset_url":   "https://studio.moodfordesign.com/auth/reset-password",
        "accept_url":  "https://studio.moodfordesign.com/auth/login",
        "magic_url":   "https://studio.moodfordesign.com/auth/login",
        "title":       (body or {}).get("title", "Anteprima editoriale"),
        "body":        (body or {}).get("body",
            "Questa è un'anteprima del template con il brand del tuo studio."),
        "studio_name": draft.get("sender_name") or "MOOD for DESIGN™",
    }
    subject, html, text = render_template(template_key, ctx)
    return {"subject": subject, "html": html, "text": text,
            "tenant_id": tid, "template_key": template_key}
