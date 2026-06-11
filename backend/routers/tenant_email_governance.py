"""ITER173 · P1 · Tenant Email Governance™

Single router that handles BOTH P1.4 (Email Identity) and P1.5 (Email
Template Manager). Storage: `tenant_settings` table (key/value JSON).
No new tables, no migration.

Keys used:
  • email_identity                                    {sender_name, sender_email, reply_to, signature}
  • email_template:{template_key}:{locale}            {subject, body}

Endpoints (mounted at /api/admin/tenant):
  GET  /email-identity                                tenant config (with platform defaults fallback)
  PUT  /email-identity                                upsert
  GET  /email-templates                                list (registry + per-locale overrides + flags)
  GET  /email-templates/{key}                         all locales for a single template
  PUT  /email-templates/{key}/{locale}                upsert subject+body (rejects 'magic_link')
  POST /email-templates/{key}/{locale}/preview        render with dummy data (any caller)

ACL: requires tenant_admin or super_admin role.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context
from database import db
from services.email_service import resolve_email_identity, get_tenant_template_override
from services.email_templates import REGISTRY, render

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Constants ─────────────────────────────────────────────────────────
SUPPORTED_LOCALES = ["it", "en"]

# Template catalogue exposed via the manager (matches user spec)
TEMPLATE_CATALOGUE = [
    {
        "key": "space_ready",
        "label": "Journey Created · Client Space Ready",
        "description": "Inviata quando il cliente termina /begin-journey o quando viene assegnato un journey.",
        "editable": True,
        "protected": False,
        "system": False,
        "default_template_fn": "space_ready",
    },
    {
        "key": "magic_link",
        "label": "Magic Link Access",
        "description": "Email di accesso del cliente. Protetta per evitare regressioni auth.",
        "editable": False,
        "protected": True,
        "system": True,
        "default_template_fn": "magic_link",
    },
    {
        "key": "new_message",
        "label": "New Message",
        "description": "Notifica al cliente quando lo studio invia un messaggio nel thread.",
        "editable": True,
        "protected": False,
        "system": False,
        "default_template_fn": "generic",
    },
    {
        "key": "call_back_requested",
        "label": "Call Back Requested",
        "description": "Conferma cliente: la richiesta di call è arrivata allo studio.",
        "editable": True,
        "protected": False,
        "system": False,
        "default_template_fn": "generic",
    },
    {
        "key": "proposal_shared",
        "label": "Proposal Shared",
        "description": "Lo studio ha condiviso una nuova proposta visiva con il cliente.",
        "editable": True,
        "protected": False,
        "system": False,
        "default_template_fn": "proposal_ready",
    },
    {
        "key": "appointment_confirmed",
        "label": "Appointment Confirmed",
        "description": "Conferma di un appuntamento concordato tra studio e cliente.",
        "editable": True,
        "protected": False,
        "system": False,
        "default_template_fn": "generic",
    },
]

# Dummy data injected in /preview endpoint — neutral placeholders, no real names
DUMMY_VARS = {
    "client_name":       "Cliente Esempio",
    "first_name":        "Cliente",
    "journey_name":      "Progetto Residenziale",
    "designer_name":     "Referente Studio",
    "referente_name":    "Referente Studio",
    "tenant_name":       "MOOD for DESIGN",
    "studio_name":       "MOOD for DESIGN",
    "brand_name":        "MOOD for DESIGN",
    "magic_link":        "https://example.com/magic-link-demo-not-clickable",
    "magic_url":         "https://example.com/magic-link-demo-not-clickable",
    "appointment_date":  "12 giugno, ore 15:00",
    "hero_quote":        "Voglio sentire la casa quando entro.",
}


# ─── ACL ───────────────────────────────────────────────────────────────
def _require_admin(ctx: dict) -> str:
    role = (ctx.get("role") or "").lower()
    if role not in {"tenant_admin", "super_admin"}:
        raise HTTPException(403, "Admin role required")
    return ctx["tenant_id"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── tenant_settings helpers ───────────────────────────────────────────
def _get_setting(tenant_id: str, key: str) -> Optional[dict]:
    rows = (db().table("tenant_settings").select("value_json")
            .eq("tenant_id", tenant_id).eq("key", key)
            .limit(1).execute().data or [])
    return rows[0]["value_json"] if rows else None


def _upsert_setting(tenant_id: str, key: str, value: dict) -> None:
    now = _now()
    # Best-effort upsert: try update first, fall back to insert.
    existing = (db().table("tenant_settings").select("id")
                .eq("tenant_id", tenant_id).eq("key", key)
                .limit(1).execute().data or [])
    if existing:
        db().table("tenant_settings").update({
            "value_json": value, "updated_at": now,
        }).eq("id", existing[0]["id"]).execute()
    else:
        import uuid
        db().table("tenant_settings").insert({
            "id":         str(uuid.uuid4()),
            "tenant_id":  tenant_id,
            "key":        key,
            "value_json": value,
            "created_at": now,
            "updated_at": now,
        }).execute()


# ─── P1.4 · Email Identity ────────────────────────────────────────────
class EmailIdentityIn(BaseModel):
    sender_name:  Optional[str] = Field(None, max_length=120)
    sender_email: Optional[str] = Field(None, max_length=200)
    reply_to:     Optional[str] = Field(None, max_length=200)
    signature:    Optional[str] = Field(None, max_length=600)


@router.get("/email-identity")
def get_email_identity(ctx: dict = Depends(get_tenant_context)):
    """Return the tenant's email identity + the resolved runtime (with fallbacks)."""
    tid = _require_admin(ctx)
    stored = _get_setting(tid, "email_identity") or {}
    resolved = resolve_email_identity(tid)
    return {
        "stored": {
            "sender_name":  stored.get("sender_name"),
            "sender_email": stored.get("sender_email"),
            "reply_to":     stored.get("reply_to"),
            "signature":    stored.get("signature"),
        },
        "resolved": {
            "sender_name":  resolved.get("sender_name"),
            "sender_email": resolved.get("sender_email"),
            "from_address": resolved.get("from_address"),
            "reply_to":     resolved.get("reply_to"),
            "signature":    resolved.get("footer") or resolved.get("signature"),
            "source":       resolved.get("source"),
        },
    }


@router.put("/email-identity")
def put_email_identity(body: EmailIdentityIn, ctx: dict = Depends(get_tenant_context)):
    tid = _require_admin(ctx)
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    _upsert_setting(tid, "email_identity", payload)
    return get_email_identity(ctx)


# ─── P1.5 · Email Templates ───────────────────────────────────────────
class EmailTemplateIn(BaseModel):
    subject: str = Field(..., min_length=1, max_length=300)
    body:    str = Field(..., min_length=1)


def _resolve_template(tenant_id: str, key: str, locale: str,
                       light: bool = False, batch_overrides: Optional[dict] = None) -> dict:
    """Resolved view of a template for a given (tenant, key, locale).

    Returns: { subject, body, source: 'tenant'|'system', editable, protected }

    `light=True` skips the expensive render() fallback (used for the list
    endpoint where 12 entries would saturate the DB pool).
    `batch_overrides` is a dict pre-populated by `list_email_templates`
    to avoid N+1 lookups.
    """
    catalogue = next((t for t in TEMPLATE_CATALOGUE if t["key"] == key), None)
    if not catalogue:
        raise HTTPException(404, f"Template '{key}' not in catalogue")
    locale = locale.lower()
    if locale not in SUPPORTED_LOCALES:
        raise HTTPException(400, f"Locale '{locale}' not supported")

    if batch_overrides is not None:
        override = batch_overrides.get(f"email_template:{key}:{locale}")
    else:
        override = get_tenant_template_override(tenant_id, key, locale)

    if override and (override.get("subject") or override.get("body")):
        return {
            "subject": override.get("subject", ""),
            "body":    override.get("body", ""),
            "source":  "tenant",
            "editable": catalogue["editable"],
            "protected": catalogue["protected"],
            "system":  catalogue["system"],
            "label":   catalogue["label"],
            "key":     key,
            "locale":  locale,
        }

    # System default
    if light:
        # Skip render() — just label as system, no body computation.
        return {
            "subject": catalogue["label"],
            "body":    "",
            "source":  "system",
            "editable": catalogue["editable"],
            "protected": catalogue["protected"],
            "system":  catalogue["system"],
            "label":   catalogue["label"],
            "key":     key,
            "locale":  locale,
        }

    # Full path: render() to extract subject for preview
    dummy_ctx = {
        **DUMMY_VARS,
        "tenant_id": tenant_id,
        "locale": f"{locale}-{locale.upper()}",
        "reset_url":  DUMMY_VARS["magic_link"],
        "accept_url": DUMMY_VARS["magic_link"],
        "cta_url":    DUMMY_VARS["magic_link"],
        "login_url":  DUMMY_VARS["magic_link"],
        "title":      catalogue["label"],
        "body":       "Anteprima del template di sistema.",
    }
    try:
        subject, _html, _text = render(catalogue["default_template_fn"], dummy_ctx)
    except Exception as e:
        logger.warning("Template default render failed for %s/%s: %s", key, locale, e)
        subject = catalogue["label"]
    return {
        "subject": subject,
        "body":    "(Template di sistema · usa l'editor per sovrascrivere subject e body)",
        "source":  "system",
        "editable": catalogue["editable"],
        "protected": catalogue["protected"],
        "system":  catalogue["system"],
        "label":   catalogue["label"],
        "key":     key,
        "locale":  locale,
    }


def _batch_load_overrides(tenant_id: str) -> dict:
    """Single query to load all email_template:* overrides for a tenant."""
    try:
        rows = (db().table("tenant_settings").select("key,value_json")
                .eq("tenant_id", tenant_id)
                .like("key", "email_template:%")
                .execute().data or [])
        return {r["key"]: (r.get("value_json") or {}) for r in rows}
    except Exception as e:
        logger.warning("batch overrides load failed: %s", e)
        return {}


@router.get("/email-templates")
def list_email_templates(ctx: dict = Depends(get_tenant_context)):
    tid = _require_admin(ctx)
    batch = _batch_load_overrides(tid)
    items = []
    for cat in TEMPLATE_CATALOGUE:
        per_locale = {}
        for loc in SUPPORTED_LOCALES:
            per_locale[loc] = _resolve_template(tid, cat["key"], loc,
                                                 light=True, batch_overrides=batch)
        items.append({
            "key":         cat["key"],
            "label":       cat["label"],
            "description": cat["description"],
            "editable":    cat["editable"],
            "protected":   cat["protected"],
            "system":      cat["system"],
            "locales":     per_locale,
        })
    return {"templates": items, "supported_locales": SUPPORTED_LOCALES}


@router.get("/email-templates/{key}/{locale}")
def get_email_template(key: str, locale: str, ctx: dict = Depends(get_tenant_context)):
    tid = _require_admin(ctx)
    return _resolve_template(tid, key, locale)


@router.put("/email-templates/{key}/{locale}")
def put_email_template(key: str, locale: str, body: EmailTemplateIn,
                       ctx: dict = Depends(get_tenant_context)):
    tid = _require_admin(ctx)
    catalogue = next((t for t in TEMPLATE_CATALOGUE if t["key"] == key), None)
    if not catalogue:
        raise HTTPException(404, f"Template '{key}' not in catalogue")
    if catalogue.get("protected"):
        raise HTTPException(403, f"Template '{key}' is protected (read-only)")
    locale = locale.lower()
    if locale not in SUPPORTED_LOCALES:
        raise HTTPException(400, f"Locale '{locale}' not supported")

    # Sanity: do not allow the magic_link CTA to be removed in any
    # editable variant that legitimately uses it (proposal_shared can,
    # appointment_confirmed can, etc.) — only enforce on protected. So
    # here we just upsert.
    setting_key = f"email_template:{key}:{locale}"
    _upsert_setting(tid, setting_key, {"subject": body.subject, "body": body.body})
    return _resolve_template(tid, key, locale)


class EmailTemplatePreviewIn(BaseModel):
    subject: Optional[str] = None
    body:    Optional[str] = None


@router.post("/email-templates/{key}/{locale}/preview")
def preview_email_template(key: str, locale: str, body: Optional[EmailTemplatePreviewIn] = None,
                           ctx: dict = Depends(get_tenant_context)):
    """Render an editable template with DUMMY_VARS. If `body` carries a
    draft subject+body (live editor), preview the draft instead of the
    persisted version."""
    tid = _require_admin(ctx)
    locale = locale.lower()
    catalogue = next((t for t in TEMPLATE_CATALOGUE if t["key"] == key), None)
    if not catalogue:
        raise HTTPException(404, f"Template '{key}' not in catalogue")
    if locale not in SUPPORTED_LOCALES:
        raise HTTPException(400, f"Locale '{locale}' not supported")

    # If a draft is passed with real content, interpolate dummy vars directly.
    if body and body.subject and body.body:
        from services.email_templates import _interpolate
        return {
            "subject":  _interpolate(body.subject, DUMMY_VARS),
            "body":     _interpolate(body.body, DUMMY_VARS),
            "vars":     DUMMY_VARS,
            "source":   "draft",
        }

    # Otherwise, return the currently persisted/resolved template with vars interpolated.
    resolved = _resolve_template(tid, key, locale)
    from services.email_templates import _interpolate
    return {
        "subject":  _interpolate(resolved.get("subject", ""), DUMMY_VARS),
        "body":     _interpolate(resolved.get("body", ""), DUMMY_VARS),
        "vars":     DUMMY_VARS,
        "source":   resolved.get("source"),
        "protected": resolved.get("protected"),
    }
