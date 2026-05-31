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


def _tenant_owner_id(tenant_id: str) -> Optional[str]:
    """Return the profile_id of the tenant owner (first super_admin or
    tenant_admin of the tenant, ordered by created_at). Used to know
    whose introduction matters for the onboarding step."""
    c = db()
    for role in ("super_admin", "tenant_admin"):
        r = (
            c.table("users_profile").select("id,created_at")
            .eq("tenant_id", tenant_id).eq("role", role)
            .order("created_at").limit(1).execute()
        )
        if r.data:
            return r.data[0]["id"]
    return None


def _auto_detect(tenant_id: str) -> dict:
    c = db()
    out = {
        "profile_completed": False,
        "owner_introduced": False,
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
    # Owner introduction — avatar + bio + role_label must ALL be present
    owner_id = _tenant_owner_id(tenant_id)
    if owner_id:
        op = c.table("users_profile").select("avatar_url,short_bio,role_label").eq("id", owner_id).limit(1).execute()
        if op.data:
            od = op.data[0]
            out["owner_introduced"] = bool(
                (od.get("avatar_url") or "").strip()
                and (od.get("short_bio") or "").strip()
                and (od.get("role_label") or "").strip()
            )
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
    """Frozen step catalogue rendered by the frontend. Order matters:
    the human introduction comes immediately after the studio profile —
    BEFORE branding, services and the rest. Clients should feel
    accompanied as soon as the studio finishes its self-introduction."""
    items = [
        ("profile_completed",    "Completa il profilo studio", "Nome studio, descrizione e contatti.", "/settings"),
        ("owner_introduced",     "Presentati ai tuoi clienti", "Foto, ruolo e bio breve — visibili a ogni cliente.", "/settings/profile"),
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
             "storefront_published", "owner_introduced"}
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



# ─────────────────────────────────────────────────────────────────────
# ITER180 · ACTIVATION FOUNDATION™ — 6-step canonical sequence
# ─────────────────────────────────────────────────────────────────────
# Steps:
#   0 · Identità Operativa  (org name + market + language + timezone)
#   1 · Blueprint Chameleon™ selected
#   2 · Primo collaboratore invitato (or Founder-Only acknowledged)
#   3 · Primo Lead creato
#   4 · Primo Prospect qualificato (account.lifecycle_stage='prospect')
#   5 · Prima Design Journey™ aperta
#
# Distinct from the legacy 8-step `_checklist` which targets full Studio Activation.

def _activation_state(tenant_id: str) -> dict:
    """Compute the 6-step Activation Foundation™ state from live data."""
    c = db()
    out = {
        "identity":   {"done": False, "missing": []},
        "blueprint":  {"done": False},
        "team":       {"done": False},
        "first_lead": {"done": False},
        "first_prospect": {"done": False},
        "first_journey":  {"done": False},
    }

    # Step 0 · Identity
    t = c.table("tenants").select(
        "id, name, default_language, default_locale_code, branding_settings"
    ).eq("id", tenant_id).limit(1).execute()
    if t.data:
        td = t.data[0]
        bs = td.get("branding_settings") or {}
        name_ok     = bool((td.get("name") or "").strip())
        market_ok   = bool((bs.get("primary_market") or "").strip())
        language_ok = bool((td.get("default_language") or td.get("default_locale_code") or "").strip())
        timezone_ok = bool((bs.get("timezone") or "").strip())
        missing = []
        if not name_ok:     missing.append("name")
        if not market_ok:   missing.append("primary_market")
        if not language_ok: missing.append("language")
        if not timezone_ok: missing.append("timezone")
        out["identity"] = {
            "done": not missing,
            "missing": missing,
            "values": {
                "name":           td.get("name") or "",
                "primary_market": bs.get("primary_market") or "",
                "language":       td.get("default_language") or td.get("default_locale_code") or "",
                "timezone":       bs.get("timezone") or "",
            },
        }

    # Step 1 · Blueprint Chameleon
    try:
        bp = c.table("tenant_atelier_identity").select("preset_code, updated_at") \
              .eq("tenant_id", tenant_id).limit(1).execute()
        out["blueprint"]["done"] = bool(bp.data and bp.data[0].get("preset_code"))
    except Exception:
        out["blueprint"]["done"] = False

    # Step 2 · Team
    m = c.table("users_profile").select("id", count="exact") \
         .eq("tenant_id", tenant_id).eq("status", "active").limit(1).execute()
    out["team"]["done"] = (m.count or 0) >= 2
    out["team"]["count"] = m.count or 0

    # Step 3 · First Lead
    ld = c.table("leads").select("id", count="exact") \
          .eq("tenant_id", tenant_id).limit(1).execute()
    out["first_lead"]["done"] = (ld.count or 0) >= 1
    out["first_lead"]["count"] = ld.count or 0

    # Step 4 · First Prospect
    try:
        pr = c.table("accounts").select("id", count="exact") \
              .eq("tenant_id", tenant_id).eq("lifecycle_stage", "prospect").limit(1).execute()
        out["first_prospect"]["done"] = (pr.count or 0) >= 1
        out["first_prospect"]["count"] = pr.count or 0
    except Exception:
        out["first_prospect"]["done"] = False

    # Step 5 · First Journey
    try:
        dj = c.table("design_journeys").select("id", count="exact") \
              .eq("tenant_id", tenant_id).limit(1).execute()
        out["first_journey"]["done"] = (dj.count or 0) >= 1
        out["first_journey"]["count"] = dj.count or 0
    except Exception:
        out["first_journey"]["done"] = False

    return out


_AF_CATALOGUE = [
    {
        "key": "identity",
        "ordinal": 0,
        "title": "Identità operativa",
        "description": "Nome, mercato principale, lingua e timezone dello studio.",
        "cta_label": "Configura identità",
        "cta_route": "/settings/identity",
        "critical": True,
    },
    {
        "key": "blueprint",
        "ordinal": 1,
        "title": "Blueprint Chameleon™",
        "description": "Scegli lo stile visivo che definisce lo studio.",
        "cta_label": "Apri impostazioni",
        "cta_route": "/settings",
        "critical": True,
    },
    {
        "key": "team",
        "ordinal": 2,
        "title": "Invita il primo collaboratore",
        "description": "Designer, project manager, sales o advisor.",
        "cta_label": "Invita un membro",
        "cta_route": "/settings/members",
        "critical": False,
    },
    {
        "key": "first_lead",
        "ordinal": 3,
        "title": "Primo Lead",
        "description": "Crea il primo contatto e apri la Discovery.",
        "cta_label": "Apri Nuova Relazione",
        "cta_route": "modal:new-relationship",
        "critical": True,
    },
    {
        "key": "first_prospect",
        "ordinal": 4,
        "title": "Primo Prospect qualificato",
        "description": "Promuovi un Lead a Prospect via Discovery.",
        "cta_label": "Vai ai Lead",
        "cta_route": "/relations/leads",
        "critical": True,
    },
    {
        "key": "first_journey",
        "ordinal": 5,
        "title": "Prima Design Journey™",
        "description": "Apri la prima Journey sul Prospect qualificato.",
        "cta_label": "Apri Nuova Relazione",
        "cta_route": "modal:new-relationship",
        "critical": True,
    },
]


@router.get("/activation-foundation")
def get_activation_foundation(ctx: dict = Depends(get_tenant_context)):
    """Return the 6-step Activation Foundation™ state for the tenant.

    Order: 0=identity → 5=first_journey. Includes CTA routing hints for
    the Smart CTA Routing™ frontend layer.
    """
    role = (ctx.get("role") or "").lower()
    if role == "client":
        raise HTTPException(403, "Activation Foundation is for studio members.")
    tenant_id = ctx["tenant_id"]
    state = _activation_state(tenant_id)
    items = []
    for catalog in _AF_CATALOGUE:
        k = catalog["key"]
        s = state.get(k, {})
        items.append({
            **catalog,
            "done": bool(s.get("done")),
            "metadata": {kk: vv for kk, vv in s.items() if kk != "done"},
        })
    completed = sum(1 for i in items if i["done"])
    total = len(items)
    # First missing critical step (the "next action")
    next_critical = next((i for i in items if i["critical"] and not i["done"]), None)
    return {
        "tenant_id": tenant_id,
        "items": items,
        "completed": completed,
        "total": total,
        "progress": round((completed / total) * 100) if total else 0,
        "activated": completed == total,
        "next_action": next_critical,
    }


class IdentityBody(BaseModel):
    name: Optional[str] = None
    primary_market: Optional[str] = None
    language: Optional[str] = None
    timezone: Optional[str] = None


@router.post("/identity")
def save_identity(body: IdentityBody, ctx: dict = Depends(get_tenant_context)):
    """Save Step 0 · Identità Operativa.

    Persists:
      - tenants.name (org name)
      - tenants.default_language / default_locale_code
      - tenants.branding_settings.primary_market
      - tenants.branding_settings.timezone
    """
    role = (ctx.get("role") or "").lower()
    if role not in {"tenant_admin", "super_admin"}:
        raise HTTPException(403, "Admin only.")
    tenant_id = ctx["tenant_id"]
    c = db()
    cur = c.table("tenants").select("branding_settings").eq("id", tenant_id).limit(1).execute()
    bs = (cur.data[0].get("branding_settings") if cur.data else {}) or {}
    patch = {"updated_at": _now()}
    if body.name is not None:
        nm = body.name.strip()
        if nm:
            patch["name"] = nm
    if body.language is not None:
        lang = (body.language or "").strip()
        if lang:
            patch["default_language"] = lang
            patch["default_locale_code"] = lang
    if body.primary_market is not None:
        bs["primary_market"] = (body.primary_market or "").strip()
    if body.timezone is not None:
        bs["timezone"] = (body.timezone or "").strip()
    if body.primary_market is not None or body.timezone is not None:
        patch["branding_settings"] = bs
    c.table("tenants").update(patch).eq("id", tenant_id).execute()
    return {"ok": True, "patch": {k: v for k, v in patch.items() if k != "updated_at"}}
