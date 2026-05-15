"""Tenant Onboarding — Phase S.1.

Drives the StudioOnboardingPanel on the Blueprint OS dashboard.
Computes onboarding progress by inspecting real data the tenant
has (or hasn't) produced yet — never from hardcoded flags alone.

The DB row in `tenant_onboarding` is treated as a CACHE: read-mostly,
written when a step is explicitly marked done or dismissed.

Auto-detection rules:
    profile_completed     → tenants.name, branding.primary_color set
    branding_completed    → tenants.logo_url present
    service_completed     → at least one project_type configured (any project)
    team_invited          → at least 2 users_profile in tenant
    project_created       → at least one row in projects
    materials_uploaded    → at least one row in media_library or materials
    storefront_published  → at least one row in storefront_pages with status='published'
"""
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from core.tenant_context import get_tenant_context
from database import db

router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_row(tenant_id: str) -> dict:
    c = db()
    r = c.table("tenant_onboarding").select("*").eq("tenant_id", tenant_id).limit(1).execute()
    if r.data:
        return r.data[0]
    row = {"tenant_id": tenant_id, "created_at": _now(), "updated_at": _now()}
    c.table("tenant_onboarding").insert(row).execute()
    r = c.table("tenant_onboarding").select("*").eq("tenant_id", tenant_id).limit(1).execute()
    return r.data[0] if r.data else row


def _auto_detect(tenant_id: str) -> dict:
    c = db()
    out = {
        "profile_completed": False,
        "branding_completed": False,
        "service_completed": False,
        "team_invited": False,
        "project_created": False,
        "materials_uploaded": False,
        "storefront_published": False,
    }
    # Tenant for profile + branding signals
    t = c.table("tenants").select("name,primary_color,logo_url").eq("id", tenant_id).limit(1).execute()
    if t.data:
        td = t.data[0]
        out["profile_completed"] = bool(td.get("name") and td.get("primary_color"))
        out["branding_completed"] = bool(td.get("logo_url"))
    # Team members
    m = c.table("users_profile").select("id", count="exact").eq("tenant_id", tenant_id).eq("status", "active").limit(1).execute()
    out["team_invited"] = (m.count or 0) >= 2
    # Projects
    p = c.table("projects").select("id,project_type", count="exact").eq("tenant_id", tenant_id).limit(1).execute()
    n_projects = p.count or 0
    out["project_created"] = n_projects > 0
    out["service_completed"] = bool(p.data and p.data[0].get("project_type"))
    # Materials / media
    try:
        ml = c.table("media_library").select("id", count="exact").eq("tenant_id", tenant_id).limit(1).execute()
        out["materials_uploaded"] = (ml.count or 0) > 0
    except Exception:
        out["materials_uploaded"] = False
    # Storefront pages
    try:
        sp = c.table("storefront_pages").select("id", count="exact").eq("tenant_id", tenant_id).eq("status", "published").limit(1).execute()
        out["storefront_published"] = (sp.count or 0) > 0
    except Exception:
        out["storefront_published"] = False
    return out


def _checklist(state: dict) -> list:
    """Frozen step catalogue rendered by the frontend. Order matters."""
    items = [
        ("profile_completed",    "Completa il profilo studio", "Nome studio, descrizione e contatti.", "/settings"),
        ("branding_completed",   "Carica logo e palette",      "Identità visiva coerente per ogni surface.", "/settings/brand"),
        ("service_completed",    "Configura il primo servizio","Tipologie di progetto, durate, tariffe.", "/workspace/projects"),
        ("team_invited",         "Invita il primo membro del team","Designer, project manager o editor.", "/settings/members"),
        ("project_created",      "Crea il primo progetto",     "Apri un progetto e collega un lead.", "/workspace/projects"),
        ("materials_uploaded",   "Carica i primi materiali",   "Materiali, immagini e collezioni.", "/library"),
        ("storefront_published", "Pubblica la prima pagina",   "Storefront tenant online.", "/settings/storefront"),
    ]
    out = []
    for key, title, body, link in items:
        out.append({
            "key": key, "title": title, "body": body, "link": link,
            "done": bool(state.get(key)),
        })
    return out


@router.get("/status")
def get_status(ctx: dict = Depends(get_tenant_context)):
    """Returns the merged onboarding state for the current tenant.

    The DB row is a cache: if a step was manually marked done, that
    overrides the auto-detection. Otherwise live signals decide.
    Clients are 403'd — this endpoint is for studio members only.
    """
    role = (ctx.get("role") or "").lower()
    if role == "client":
        raise HTTPException(403, "Onboarding is for studio members.")
    tenant_id = ctx["tenant_id"]
    cached = _ensure_row(tenant_id)
    auto = _auto_detect(tenant_id)
    # Merge — cached True wins over auto False (manual confirmations
    # never unfollow themselves). Auto True always wins over cached False.
    merged = {k: bool(cached.get(k) or auto.get(k)) for k in auto.keys()}
    items = _checklist(merged)
    completed = sum(1 for it in items if it["done"])
    total = len(items)
    return {
        "tenant_id": tenant_id,
        "items": items,
        "completed": completed,
        "total": total,
        "progress": round((completed / total) * 100) if total else 0,
        "all_done": completed == total,
        "dismissed": bool(cached.get("dismissed_at")),
    }


class StepReq(BaseModel):
    key: str


@router.post("/mark-done")
def mark_done(body: StepReq, ctx: dict = Depends(get_tenant_context)):
    """Manually mark a step as completed (e.g. once the user has
    visited the relevant section and waved it off)."""
    role = (ctx.get("role") or "").lower()
    if role == "client":
        raise HTTPException(403, "Onboarding is for studio members.")
    valid = {"profile_completed", "branding_completed", "service_completed",
             "team_invited", "project_created", "materials_uploaded",
             "storefront_published"}
    if body.key not in valid:
        raise HTTPException(400, "Invalid step key.")
    tenant_id = ctx["tenant_id"]
    _ensure_row(tenant_id)
    db().table("tenant_onboarding").update({body.key: True, "updated_at": _now()}).eq("tenant_id", tenant_id).execute()
    return {"ok": True}


@router.post("/dismiss")
def dismiss(ctx: dict = Depends(get_tenant_context)):
    """Dismiss the panel for good (super_admin can re-enable manually)."""
    role = (ctx.get("role") or "").lower()
    if role not in {"tenant_admin", "super_admin"}:
        raise HTTPException(403, "Admin only.")
    tenant_id = ctx["tenant_id"]
    _ensure_row(tenant_id)
    db().table("tenant_onboarding").update({
        "dismissed_at": _now(),
        "dismissed_by": ctx.get("profile_id"),
        "updated_at": _now(),
    }).eq("tenant_id", tenant_id).execute()
    return {"ok": True}
