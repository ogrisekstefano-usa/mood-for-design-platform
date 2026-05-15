"""
Corporate website API routes.
Powers www.moodfordesign.com (mood-corporate tenant).
ONE platform — multiple frontends architecture.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from pydantic import BaseModel
from db.seed_data import get_page, get_navigation, get_tenant, LOCALES, PAGES

router = APIRouter(prefix="/corporate", tags=["corporate"])


# ── Page Renderer ────────────────────────────────────────────────────────────

@router.get("/pages/{slug}")
async def get_corporate_page(
    slug: str,
    locale: str = Query(default="en-us", description="Locale code")
):
    """
    Returns a fully rendered page with locale-resolved section content.
    This is the primary endpoint for the corporate website renderer.
    All content is driven by the section registry and CMS seed data.
    """
    data = get_page(slug, locale)
    if not data:
        # Try home as fallback for root
        if slug in ("", "/"):
            data = get_page("home", locale)
        if not data:
            raise HTTPException(status_code=404, detail=f"Page '{slug}' not found")
    return data


@router.get("/pages")
async def list_corporate_pages():
    """List all available corporate pages (for sitemap/routing)."""
    return {
        "pages": [
            {"slug": slug, "published": data.get("is_published", True)}
            for slug, data in PAGES.items()
        ]
    }


# ── Navigation ────────────────────────────────────────────────────────────────

@router.get("/navigation")
async def get_corporate_navigation(
    locale: str = Query(default="en-us")
):
    """Returns navigation items for mood-corporate tenant, locale-resolved."""
    return get_navigation(locale)


# ── Locale System ─────────────────────────────────────────────────────────────

@router.get("/locales")
async def get_locales():
    """Returns available locales for the mood-corporate tenant."""
    return {"locales": [l for l in LOCALES if l["is_active"]]}


# ── Tenant Config ─────────────────────────────────────────────────────────────

@router.get("/tenant")
async def get_corporate_tenant():
    """Returns mood-corporate tenant configuration."""
    tenant = get_tenant("mood-corporate")
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


# ── Section Registry ──────────────────────────────────────────────────────────

SECTION_REGISTRY_META = [
    {"type": "editorial_hero", "label": "Editorial Hero", "description": "Cinematic split or centered hero with serif headline"},
    {"type": "split_story", "label": "Split Story", "description": "50/50 image and text layout"},
    {"type": "cinematic_quote", "label": "Cinematic Quote", "description": "Dark or light large quote section"},
    {"type": "logos_wall", "label": "Logos Wall", "description": "Brand trust strip with logo names"},
    {"type": "feature_narrative", "label": "Feature Narrative", "description": "Grid of feature cards with icons"},
    {"type": "metrics_strip", "label": "Metrics Strip", "description": "Key metrics/stats display"},
    {"type": "pricing_cards", "label": "Pricing Cards", "description": "Pricing plans with features"},
    {"type": "cta_section", "label": "CTA Section", "description": "Call to action banner"},
    {"type": "journal_grid", "label": "Journal Grid", "description": "Editorial article grid"},
    {"type": "faq_accordion", "label": "FAQ Accordion", "description": "Collapsible FAQ list"},
    {"type": "comparison_table", "label": "Comparison Table", "description": "Feature comparison across plans"},
    {"type": "timeline", "label": "Timeline", "description": "Sequential milestones or steps"},
    {"type": "template_showcase", "label": "Template Showcase", "description": "Gallery of design templates"},
    {"type": "case_study_preview", "label": "Case Study Preview", "description": "Client case study cards"},
]


@router.get("/sections/registry")
async def get_section_registry():
    """Returns the complete section type registry shared across all tenants."""
    return {"registry": SECTION_REGISTRY_META, "total": len(SECTION_REGISTRY_META)}


# ── Contact Form ──────────────────────────────────────────────────────────────

class ContactForm(BaseModel):
    name: str
    email: str
    company: Optional[str] = None
    message: str
    inquiry_type: Optional[str] = "general"


@router.post("/contact")
async def submit_contact(form: ContactForm):
    """Submit a contact form inquiry."""
    # TODO: Connect to email service (SendGrid/Resend) when credentials provided
    return {
        "success": True,
        "message": "Thank you. We'll be in touch within 24 hours.",
        "reference": f"MFD-{id(form) % 100000:05d}"
    }


# ── Newsletter ────────────────────────────────────────────────────────────────

class NewsletterSubscribe(BaseModel):
    email: str
    locale: Optional[str] = "en-us"


@router.post("/newsletter")
async def subscribe_newsletter(data: NewsletterSubscribe):
    """Subscribe to MOOD newsletter."""
    # TODO: Connect to email list when credentials provided
    return {
        "success": True,
        "message": "You're on the list. Welcome to the MOOD community."
    }


# ── Studio Signup (Tenant Onboarding) ─────────────────────────────────────────

class StudioSignup(BaseModel):
    studio_name: str
    email: str
    first_name: str
    last_name: str
    role: Optional[str] = "studio_owner"
    locale: Optional[str] = "en-us"
    plan: Optional[str] = "starter"


@router.post("/studio/register")
async def register_studio(data: StudioSignup):
    """
    Phase 1: Studio registration endpoint.
    Future: auto-provisioning of tenant.blueprint.moodfordesign.com
    """
    import re
    # Generate subdomain slug from studio name
    slug = re.sub(r'[^a-z0-9]', '-', data.studio_name.lower()).strip('-')
    slug = re.sub(r'-+', '-', slug)

    return {
        "success": True,
        "studio": {
            "name": data.studio_name,
            "slug": slug,
            "subdomain": f"{slug}.blueprint.moodfordesign.com",
            "plan": data.plan,
            "status": "provisioning",  # Future: auto-provision Blueprint workspace
        },
        "message": "Studio registered. Your Blueprint workspace will be ready shortly.",
        "next_step": "Check your email to verify your account and complete setup.",
    }
