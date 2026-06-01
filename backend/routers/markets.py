"""
Markets API router — public read-only endpoints.

All data sourced from `markets` + `platform_languages`. Zero hardcoded.
"""
from fastapi import APIRouter, Query

from services import markets_resolver

router = APIRouter(prefix="/api/markets", tags=["markets"])


@router.get("")
async def list_markets(locale: str = Query(default='it-IT')):
    """Public catalog of active markets, with display_name localized."""
    return await markets_resolver.resolve_markets(locale=locale)


@router.get("/{code}")
async def get_market(code: str, locale: str = Query(default='it-IT')):
    """Single market record. Returns 404 if not found."""
    m = await markets_resolver.resolve_market_by_code(code, locale=locale)
    if not m:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Market '{code}' not found")
    return m
