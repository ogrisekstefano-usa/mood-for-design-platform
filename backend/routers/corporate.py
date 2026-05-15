"""
Corporate website API routes — DB-driven via Blueprint CMS engine.
Tenant: mood-corporate (resolved via tenant_resolver).
Source of truth: Supabase PostgreSQL — NOT seed_data.py.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Depends, Request
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, AsyncSessionLocal
from db.repository import repository
from tenant_resolver import get_corporate_tenant
from cache import content_cache
import uuid

router = APIRouter(prefix="/corporate", tags=["corporate"])


# ── Page Renderer ─────────────────────────────────────────────────────────────

@router.get("/pages/{slug}")
async def get_corporate_page(
    slug: str,
    locale: str = Query(default="en-us"),
):
    """Returns a fully rendered page with locale-resolved section content."""
    data = await repository.get_page(slug, locale)
    if not data and slug in ("", "/"):
        data = await repository.get_page("home", locale)
    if not data:
        raise HTTPException(status_code=404, detail=f"Page '{slug}' not found")
    return data


@router.get("/pages")
async def list_corporate_pages():
    return {"pages": await repository.list_pages()}


# ── Navigation ────────────────────────────────────────────────────────────────

@router.get("/navigation")
async def get_corporate_navigation(locale: str = Query(default="en-us")):
    return await repository.get_navigation(locale)


# ── Locales (global) ──────────────────────────────────────────────────────────

LOCALES_REGISTRY = [
    {"code": "it", "name": "Italiano", "flag": "IT", "is_active": True, "is_default": False},
    {"code": "en-us", "name": "English (US)", "flag": "EN", "is_active": True, "is_default": True},
    {"code": "en-uk", "name": "English (UK)", "flag": "EN", "is_active": True, "is_default": False},
    {"code": "fr", "name": "Français", "flag": "FR", "is_active": True, "is_default": False},
    {"code": "de", "name": "Deutsch", "flag": "DE", "is_active": True, "is_default": False},
    {"code": "es", "name": "Español", "flag": "ES", "is_active": True, "is_default": False},
]


@router.get("/locales")
async def get_locales():
    return {"locales": LOCALES_REGISTRY}


# ── Tenant Config ─────────────────────────────────────────────────────────────

@router.get("/tenant")
async def get_corporate_tenant_route():
    tenant = await get_corporate_tenant()
    return tenant


# ── Section Registry ──────────────────────────────────────────────────────────

SECTION_REGISTRY_META = [
    {"type": "editorial_hero",    "label": "Editorial Hero",    "description": "Cinematic split or centered hero with serif headline"},
    {"type": "split_story",       "label": "Split Story",       "description": "50/50 image and text layout"},
    {"type": "cinematic_quote",   "label": "Cinematic Quote",   "description": "Dark or light large quote section"},
    {"type": "logos_wall",        "label": "Logos Wall",        "description": "Brand trust strip with logo names"},
    {"type": "feature_narrative", "label": "Feature Narrative", "description": "Grid of feature cards with icons"},
    {"type": "metrics_strip",     "label": "Metrics Strip",     "description": "Key metrics/stats display"},
    {"type": "pricing_cards",     "label": "Pricing Cards",     "description": "Pricing plans with features"},
    {"type": "cta_section",       "label": "CTA Section",       "description": "Call to action banner"},
    {"type": "journal_grid",      "label": "Journal Grid",      "description": "Editorial article grid"},
    {"type": "faq_accordion",     "label": "FAQ Accordion",     "description": "Collapsible FAQ list"},
    {"type": "comparison_table",  "label": "Comparison Table",  "description": "Feature comparison across plans"},
    {"type": "timeline",          "label": "Timeline",          "description": "Sequential milestones or steps"},
    {"type": "template_showcase", "label": "Template Showcase", "description": "Gallery of design templates"},
    {"type": "case_study_preview","label": "Case Study Preview","description": "Client case study cards"},
    {"type": "navigation",        "label": "Navigation",        "description": "Site navigation (header + footer)"},
]


@router.get("/sections/registry")
async def get_section_registry():
    return {"registry": SECTION_REGISTRY_META, "total": len(SECTION_REGISTRY_META)}


# ── Cache Admin (operator) ────────────────────────────────────────────────────

@router.post("/cache/invalidate")
async def invalidate_cache(prefix: Optional[str] = None):
    """Invalidates content cache. Useful after a CMS publish."""
    cleared = content_cache.clear_prefix(prefix) if prefix else content_cache.clear() or 0
    return {"ok": True, "cleared": cleared}


# ── Contact / Newsletter / Studio (persist to Supabase) ───────────────────────

class ContactForm(BaseModel):
    name: str
    email: str
    company: Optional[str] = None
    message: str
    inquiry_type: Optional[str] = "general"
    locale: Optional[str] = "en-us"


@router.post("/contact")
async def submit_contact(form: ContactForm, db: AsyncSession = Depends(get_db)):
    tenant = await get_corporate_tenant()
    ref = f"MFD-{uuid.uuid4().hex[:8].upper()}"
    await db.execute(
        text("""
            INSERT INTO contact_submissions
              (id, tenant_id, name, email, company, inquiry_type, message, locale_code, status, reference, created_at)
            VALUES
              (gen_random_uuid()::text, :tid, :name, :email, :company, :it, :msg, :loc, 'new', :ref, NOW())
        """),
        {
            "tid": tenant['id'], "name": form.name, "email": form.email,
            "company": form.company, "it": form.inquiry_type,
            "msg": form.message, "loc": form.locale, "ref": ref,
        },
    )
    await db.commit()
    return {"success": True, "reference": ref, "message": "Thank you. We'll be in touch within 24 hours."}


class NewsletterSubscribe(BaseModel):
    email: str
    locale: Optional[str] = "en-us"


@router.post("/newsletter")
async def subscribe_newsletter(data: NewsletterSubscribe, db: AsyncSession = Depends(get_db)):
    tenant = await get_corporate_tenant()
    await db.execute(
        text("""
            INSERT INTO newsletter_subscribers (id, tenant_id, email, locale_code, status, created_at)
            VALUES (gen_random_uuid()::text, :tid, :email, :loc, 'active', NOW())
            ON CONFLICT (tenant_id, email) DO UPDATE SET status = 'active'
        """),
        {"tid": tenant['id'], "email": data.email, "loc": data.locale},
    )
    await db.commit()
    return {"success": True, "message": "You're on the list."}


class StudioSignup(BaseModel):
    studio_name: str
    email: str
    first_name: str
    last_name: str
    role: Optional[str] = "studio_owner"
    locale: Optional[str] = "en-us"
    plan: Optional[str] = "starter"


@router.post("/studio/register")
async def register_studio(data: StudioSignup, db: AsyncSession = Depends(get_db)):
    import re
    slug = re.sub(r'-+', '-', re.sub(r'[^a-z0-9]', '-', data.studio_name.lower())).strip('-')
    await db.execute(
        text("""
            INSERT INTO studio_registrations
              (id, studio_name, slug, email, first_name, last_name, role, plan, locale_code, status, created_at)
            VALUES
              (gen_random_uuid()::text, :sn, :sl, :em, :fn, :ln, :ro, :pl, :loc, 'provisioning', NOW())
        """),
        {
            "sn": data.studio_name, "sl": slug, "em": data.email,
            "fn": data.first_name, "ln": data.last_name,
            "ro": data.role, "pl": data.plan, "loc": data.locale,
        },
    )
    await db.commit()
    return {
        "success": True,
        "studio": {
            "name": data.studio_name, "slug": slug,
            "subdomain": f"{slug}.blueprint.moodfordesign.com",
            "plan": data.plan, "status": "provisioning",
        },
        "message": "Studio registered. Your Blueprint workspace will be ready shortly.",
        "next_step": "Check your email to verify your account.",
    }
