"""Geo public API — countries + operating markets, DB-driven."""
from fastapi import APIRouter, Query
from services import geo

router = APIRouter(prefix="/geo", tags=["geo"])


@router.get("/countries")
async def countries(locale: str = Query('it-IT'), q: str | None = Query(None)):
    return {"items": await geo.list_countries(locale=locale, q=q)}


@router.get("/operating-markets")
async def operating_markets(locale: str = Query('it-IT')):
    return {"items": await geo.list_operating_markets(locale=locale)}
