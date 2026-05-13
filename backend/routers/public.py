"""Public Rendering Layer — unauthenticated tenant routes.

Serves the compiled Blueprint pages, navigation, and footer for a tenant slug
or custom domain WITHOUT requiring auth. Used by:
    /{tenant-slug}              → homepage
    /{tenant-slug}/{page-slug}  → any published page

The Public Rendering Layer is the public mirror of the Section Engine — it
reads the same `page.{slug}` settings the builder writes, but only exposes
pages with `published: true`.
"""
import logging
from fastapi import APIRouter, HTTPException
from database import db, db_available

from core.section_registry import default_page

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Tenant resolution by slug or custom domain ───────────────────────────────
@router.get("/tenants/{slug}")
def public_tenant_config(slug: str):
    """Returns the public-safe tenant config:
        - branding (logo, name, primary/secondary colors)
        - locales (default + available)
        - theme (effective tokens, no admin overrides)
        - navigation (public_navigation setting or default)
        - footer (public_footer setting or default)
    """
    if not db_available():
        raise HTTPException(503, "Database not configured")
    client = db()

    # Try slug first
    r = client.table("tenants").select(
        "id, name, slug, status, logo_url, primary_color, secondary_color, "
        "font_heading, font_body, default_language, active_languages"
    ).eq("slug", slug).limit(1).execute()

    # Fallback: try as custom domain
    if not r.data:
        d = client.table("tenant_domains").select("tenant_id").eq("domain", slug).limit(1).execute()
        if d.data:
            r = client.table("tenants").select(
                "id, name, slug, status, logo_url, primary_color, secondary_color, "
                "font_heading, font_body, default_language, active_languages"
            ).eq("id", d.data[0]["tenant_id"]).limit(1).execute()

    if not r.data:
        raise HTTPException(404, "Tenant not found")
    t = r.data[0]
    if t.get("status") != "active":
        raise HTTPException(403, "Tenant inactive")

    tid = t["id"]

    # Pull tenant_settings keys we need
    keys = ("theme", "public_navigation", "public_footer", "branding")
    s = client.table("tenant_settings").select("key, value_json") \
        .eq("tenant_id", tid).in_("key", list(keys)).execute()
    settings_map = {row["key"]: (row.get("value_json") or {}) for row in (s.data or [])}

    # Effective theme = defaults deep-merged with overrides
    from core.theme_engine import resolve_theme
    effective_theme = resolve_theme(settings_map.get("theme") or {})

    return {
        "id": tid,
        "name": t.get("name"),
        "slug": t.get("slug"),
        "logo_url": t.get("logo_url"),
        "locales": {
            "default":   t.get("default_language") or "en-US",
            "available": t.get("active_languages") or ["en-US"],
        },
        "theme": effective_theme,
        "navigation": settings_map.get("public_navigation") or _default_navigation(t),
        "footer":     settings_map.get("public_footer")     or _default_footer(t),
    }


# ── Public page document (only if published) ────────────────────────────────
@router.get("/tenants/{slug}/pages/{page_slug}")
def public_page(slug: str, page_slug: str):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    client = db()
    t = client.table("tenants").select("id, status").eq("slug", slug).limit(1).execute()
    if not t.data:
        # Try domain
        d = client.table("tenant_domains").select("tenant_id").eq("domain", slug).limit(1).execute()
        if not d.data:
            raise HTTPException(404, "Tenant not found")
        t = client.table("tenants").select("id, status").eq("id", d.data[0]["tenant_id"]).limit(1).execute()
        if not t.data:
            raise HTTPException(404, "Tenant not found")
    if t.data[0].get("status") != "active":
        raise HTTPException(403, "Tenant inactive")
    tid = t.data[0]["id"]

    r = client.table("tenant_settings").select("value_json") \
        .eq("tenant_id", tid).eq("key", f"page.{page_slug}").limit(1).execute()

    if r.data:
        page = r.data[0].get("value_json") or {}
        if not page.get("published"):
            # If page exists but is not published, fall through to seed only for homepage
            if page_slug != "homepage":
                raise HTTPException(404, "Page not published")
            # Homepage gets a graceful default render until first publish
            return default_page(page_slug)
        page["sections"] = sorted(page.get("sections") or [], key=lambda s: s.get("order", 0))
        return page

    # No saved page → return default template for homepage only
    if page_slug == "homepage":
        return default_page(page_slug)
    raise HTTPException(404, "Page not found")


# ── Sensible default navigation / footer schemas ────────────────────────────
def _default_navigation(tenant: dict) -> dict:
    """Returns a generic 4-link top nav. Used when no public_navigation is set."""
    return {
        "items": [
            {"id": "home",     "type": "link", "label": {"_default": "Home"},     "href": "/"},
            {"id": "showcase", "type": "link", "label": {"_default": "Showcase"}, "href": "/showcase"},
            {"id": "about",    "type": "link", "label": {"_default": "About"},    "href": "/about"},
            {"id": "contact",  "type": "link", "label": {"_default": "Contact"},  "href": "#contact"},
        ],
        "cta": {"label": {"_default": "Start a project"}, "href": "#contact"},
        "logo": {"use_brand_asset": True, "text": tenant.get("name") or "Studio"},
        "sticky": True,
        "transparent_on_hero": True,
        "show_locale_switcher": True,
    }


def _default_footer(tenant: dict) -> dict:
    """Generic 3-column footer."""
    return {
        "columns": [
            {"id": "studio",  "heading": {"_default": "Studio"},
             "links": [
                 {"label": {"_default": "About"},    "href": "/about"},
                 {"label": {"_default": "Showcase"}, "href": "/showcase"},
                 {"label": {"_default": "Contact"},  "href": "#contact"},
             ]},
            {"id": "services", "heading": {"_default": "Services"},
             "links": [
                 {"label": {"_default": "Interior Design"}, "href": "#"},
                 {"label": {"_default": "Architecture"},    "href": "#"},
                 {"label": {"_default": "Consulting"},      "href": "#"},
             ]},
            {"id": "social",   "heading": {"_default": "Connect"},
             "links": [
                 {"label": {"_default": "Instagram"}, "href": "#"},
                 {"label": {"_default": "LinkedIn"},  "href": "#"},
                 {"label": {"_default": "Pinterest"}, "href": "#"},
             ]},
        ],
        "bottom": {
            "copyright": {"_default": "© {year} {brand}. All rights reserved."},
            "show_locale_switcher": True,
            "show_blueprint_credit": False,
            "links": [
                {"label": {"_default": "Privacy"}, "href": "#"},
                {"label": {"_default": "Terms"},   "href": "#"},
            ],
        },
    }


@router.get("/navigation/defaults")
def navigation_defaults():
    """Used by the navigation editor as the canonical seed."""
    return {
        "navigation": _default_navigation({"name": "Studio"}),
        "footer":     _default_footer({"name": "Studio"}),
    }
