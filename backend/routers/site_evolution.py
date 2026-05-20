"""Site Evolution™ router — Sprint G.8.

NON è un media manager. NON è un upload center. NON è un cantiere tracker.
È la **memoria viva** della trasformazione fisica dello spazio nel tempo.

Persistenza: gli entry vivono in `journey_timeline_events` con
`event_type='site_evolution'` e il payload editoriale dentro `metadata`.
Niente schema migration — riusiamo la timeline canonica del Journey.

Endpoints (montati sotto /api):
  · GET  /journeys/{journey_id}/site-evolution           — studio read
  · POST /journeys/{journey_id}/site-evolution           — studio create
  · GET  /client/journeys/{journey_id}/site-evolution    — client read
"""
from __future__ import annotations

import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context
from database import db

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Editorial vocabulary ─────────────────────────────────────────
SPACE_LABEL = {
    "living":         "Living",
    "kitchen":        "Cucina",
    "master_bedroom": "Camera padronale",
    "bedroom":        "Camera",
    "bathroom":       "Bagno",
    "master_bath":    "Bagno padronale",
    "terrace":        "Terrazza",
    "entrance":       "Ingresso",
    "studio":         "Studio",
    "garden":         "Giardino",
    "suite_03":       "Suite 03",
    "lobby":          "Lobby",
    "common":         "Spazi comuni",
}

VISIT_LABEL = {
    "site_visit":   "Sopralluogo",
    "showroom":     "Visita showroom",
    "mockup":       "Mockup materiali",
    "installation": "Installazione",
    "demolition":   "Demolizione",
    "delivery":     "Arrivo materiali",
    "test":         "Verifica tecnica",
    "styling":      "Styling",
    "milestone":    "Momento chiave",
}


# ── Pydantic ─────────────────────────────────────────────────────
class SiteEvolutionPhotoIn(BaseModel):
    url: str = Field(..., max_length=800)
    caption: Optional[str] = Field(None, max_length=160)


class SiteEvolutionEntryIn(BaseModel):
    space_key:       str  = Field(..., description="Ambiente (living, kitchen, ...).")
    title:           str  = Field(..., min_length=2, max_length=140)
    narrative:       str  = Field(..., min_length=2, max_length=600,
                                   description="Testo editoriale sobrio.")
    visit_kind:      str  = Field("milestone", description="Tipo di momento.")
    occurred_at:     Optional[str] = Field(None, description="ISO date — quando è successo.")
    photos:          List[SiteEvolutionPhotoIn] = Field(default_factory=list)
    before_url:      Optional[str] = None
    after_url:       Optional[str] = None
    materials_linked: List[str]    = Field(default_factory=list,
                                            description="Material IDs collegati.")


# ── Helpers ──────────────────────────────────────────────────────
def _verify_journey(c, tenant_id: str, journey_id: str) -> dict:
    rows = (c.table("design_journeys").select("id,project_id")
            .eq("id", journey_id).eq("tenant_id", tenant_id)
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Journey non trovato")
    return rows[0]


def _verify_client_owns(c, tenant_id: str, project_id: str, profile_id: str,
                       role: str):
    role_l = (role or "").lower()
    if role_l in {"tenant_admin", "super_admin"}:
        return
    pr = (c.table("projects").select("client_user_id")
          .eq("id", project_id).eq("tenant_id", tenant_id)
          .limit(1).execute().data or [])
    if not pr or pr[0].get("client_user_id") != profile_id:
        raise HTTPException(403, "Journey non accessibile")


def _to_entry(row: dict) -> dict:
    """Hydrate a journey_timeline_events row into the Site Evolution entry shape."""
    meta = row.get("metadata") or {}
    sk   = meta.get("space_key") or "common"
    return {
        "id":           row["id"],
        "journey_id":   row.get("journey_id"),
        "milestone_id": row.get("milestone_id"),
        "space_key":    sk,
        "space_label":  SPACE_LABEL.get(sk, sk.replace("_", " ").title()),
        "title":        meta.get("title") or row.get("narrative_text") or "Momento",
        "narrative":    meta.get("narrative") or row.get("narrative_text"),
        "visit_kind":   meta.get("visit_kind") or "milestone",
        "visit_label":  VISIT_LABEL.get(meta.get("visit_kind") or "milestone",
                                         "Momento chiave"),
        "photos":       meta.get("photos") or [],
        "before_url":   meta.get("before_url"),
        "after_url":    meta.get("after_url"),
        "materials_linked": meta.get("materials_linked") or [],
        "author_role":  meta.get("author_role") or "studio",
        "occurred_at":  meta.get("occurred_at") or row.get("created_at"),
        "created_at":   row.get("created_at"),
    }


def _group_by_space(entries: List[dict]) -> List[dict]:
    by_space: dict = {}
    for e in entries:
        sk = e["space_key"]
        by_space.setdefault(sk, {"space_key": sk, "space_label": e["space_label"],
                                  "entries": []})
        by_space[sk]["entries"].append(e)
    # Sort entries inside each space by occurred_at desc
    for g in by_space.values():
        g["entries"].sort(key=lambda x: x.get("occurred_at") or "", reverse=True)
    # Sort spaces by the most recent entry
    out = list(by_space.values())
    out.sort(key=lambda g: (g["entries"][0]["occurred_at"] or "") if g["entries"] else "",
             reverse=True)
    return out


def _site_evolution_milestone(c, tenant_id: str, journey_id: str) -> Optional[dict]:
    ms = (c.table("journey_milestones")
          .select("id,title,status,milestone_type")
          .eq("journey_id", journey_id).eq("tenant_id", tenant_id)
          .eq("milestone_type", "site_evolution")
          .limit(1).execute().data or [])
    return ms[0] if ms else None


def _list_entries(c, tenant_id: str, journey_id: str) -> List[dict]:
    rows = (c.table("journey_timeline_events").select("*")
            .eq("journey_id", journey_id).eq("tenant_id", tenant_id)
            .eq("event_type", "site_evolution")
            .order("created_at", desc=False)
            .execute().data or [])
    return [_to_entry(r) for r in rows]


# ── Studio endpoints ─────────────────────────────────────────────
@router.get("/journeys/{journey_id}/site-evolution")
def list_site_evolution(journey_id: str, ctx: dict = Depends(get_tenant_context)):
    """Read the Site Evolution™ memory of a Journey (studio view)."""
    role = (ctx.get("role") or "").lower()
    if role not in {"super_admin", "tenant_admin", "designer",
                    "pm", "editor", "advisor"}:
        raise HTTPException(403, "Solo lo studio può leggere questa vista.")
    c = db()
    _verify_journey(c, ctx["tenant_id"], journey_id)

    entries  = _list_entries(c, ctx["tenant_id"], journey_id)
    milestone = _site_evolution_milestone(c, ctx["tenant_id"], journey_id)
    return {
        "milestone": ({"id": milestone["id"], "title": milestone["title"],
                       "status": milestone["status"]} if milestone else None),
        "entries":   entries,
        "groups":    _group_by_space(entries),
        "space_labels": SPACE_LABEL,
        "visit_labels": VISIT_LABEL,
    }


@router.post("/journeys/{journey_id}/site-evolution", status_code=201)
def create_site_evolution_entry(journey_id: str, body: SiteEvolutionEntryIn,
                                ctx: dict = Depends(get_tenant_context)):
    """Add a new Site Evolution™ entry — studio side only."""
    role = (ctx.get("role") or "").lower()
    if role not in {"super_admin", "tenant_admin", "designer", "pm", "editor"}:
        raise HTTPException(403, "Solo lo studio può aggiungere momenti.")
    c = db()
    tenant_id = ctx["tenant_id"]
    _verify_journey(c, tenant_id, journey_id)

    milestone = _site_evolution_milestone(c, tenant_id, journey_id)
    if not milestone:
        raise HTTPException(409, "Il capitolo Site Evolution™ non è ancora attivo")

    now = datetime.now(timezone.utc).isoformat()
    occurred = body.occurred_at or now

    metadata = {
        "kind":        "site_evolution",
        "space_key":   body.space_key,
        "title":       body.title.strip(),
        "narrative":   body.narrative.strip(),
        "visit_kind":  body.visit_kind,
        "occurred_at": occurred,
        "photos":      [p.model_dump() for p in body.photos],
        "before_url":  body.before_url,
        "after_url":   body.after_url,
        "materials_linked": body.materials_linked,
        "author_role": "studio",
    }
    row = {
        "id":             str(uuid.uuid4()),
        "tenant_id":      tenant_id,
        "journey_id":     journey_id,
        "milestone_id":   milestone["id"],
        "event_type":     "site_evolution",
        "narrative_text": body.title.strip(),
        "created_by":     ctx.get("profile_id"),
        "metadata":       metadata,
        "created_at":     occurred,
    }
    c.table("journey_timeline_events").insert(row).execute()

    # Auto-activate the milestone if it's still 'not_started'
    if milestone.get("status") == "not_started":
        c.table("journey_milestones").update({
            "status":       "in_progress",
            "started_at":   now,
            "updated_at":   now,
        }).eq("id", milestone["id"]).execute()

    c.table("design_journeys").update({"updated_at": now}) \
                              .eq("id", journey_id).execute()
    return _to_entry(row)


# ── Client endpoint ──────────────────────────────────────────────
@router.get("/client/journeys/{journey_id}/site-evolution")
def client_site_evolution(journey_id: str, ctx: dict = Depends(get_tenant_context)):
    """Read-only client view of the Site Evolution™ memory."""
    role = (ctx.get("role") or "").lower()
    if role not in {"client", "tenant_admin", "super_admin"}:
        raise HTTPException(403, "Vista riservata al cliente.")
    profile_id = ctx.get("profile_id")
    if not profile_id:
        raise HTTPException(401, "Missing profile context.")
    c = db()
    tenant_id = ctx["tenant_id"]
    j = _verify_journey(c, tenant_id, journey_id)
    _verify_client_owns(c, tenant_id, j["project_id"], profile_id, ctx.get("role"))

    entries = _list_entries(c, tenant_id, journey_id)
    return {
        "available":  len(entries) > 0,
        "entries":    entries,
        "groups":     _group_by_space(entries),
        "space_labels": SPACE_LABEL,
        "visit_labels": VISIT_LABEL,
    }
