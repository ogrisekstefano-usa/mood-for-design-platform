"""
Public Site API (ITER149)
Read-only endpoints for the public-facing MOOD website.
All content resolved from cms_sections + editorial_blocks + media_library.
"""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from services import site_resolver

router = APIRouter(prefix="/site", tags=["site"])


@router.get("/sitemap.xml")
async def get_sitemap():
    """Dynamic sitemap.xml — enumerates published pages × locales with hreflang."""
    xml = await site_resolver.generate_sitemap()
    return Response(content=xml, media_type="application/xml")


@router.get("/pages/{slug}")
async def get_site_page(slug: str, locale: str = Query(default="en-us")):
    page = await site_resolver.resolve_page(slug, locale)
    if not page:
        raise HTTPException(status_code=404, detail=f"Page '{slug}' not found")
    return page


@router.get("/navigation")
async def get_site_navigation(locale: str = Query(default="en-us")):
    return await site_resolver.resolve_navigation(locale)


@router.get("/footer")
async def get_site_footer(locale: str = Query(default="en-us")):
    return await site_resolver.resolve_footer(locale)


@router.get("/locales")
async def get_site_locales():
    return await site_resolver.resolve_locales()


@router.get("/block")
async def get_block(key: str = Query(..., description="Full block key, e.g. site.home.hero.title"),
                    locale: str = Query(default="en-us")):
    """Resolve a single editorial block — useful for ad-hoc rendering (login page etc)."""
    return await site_resolver.resolve_block(key, locale)



@router.get("/legal-strip")
async def get_legal_strip(locale: str = Query(default="it")):
    """Public read for the legal strip (3 editable lines)."""
    return await site_resolver.resolve_legal_strip(locale)
