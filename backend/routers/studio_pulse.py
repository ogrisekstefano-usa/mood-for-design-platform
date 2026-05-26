"""
Studio Pulse™ — ITER156 Sprint A
================================

The living climate of the studio. NOT analytics. NOT a dashboard.
A contemplative editorial observatory of rhythms, silences, atmospheres,
intensities, and relationship movement.

Endpoints (all prefixed with /api/studio-pulse):

  GET /climate              · breathing state of the studio
  GET /silent-relationships · relationships that stopped breathing
  GET /designer-intensity   · narrative reading of designer presence
  GET /atmosphere-convergence · emerging materials, palettes, atmospheres
  GET /recent-movements     · soft narrative thread of recent gestures

Access is restricted to leadership roles via _LEADERSHIP_ROLES.

All copy is editorial, contemplative, NEVER operational. Counts surface
as adjectives ("alcune relazioni", "molte aperture"), never as KPIs.
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from core.tenant_context import get_tenant_context
from database import db

router = APIRouter()

_LEADERSHIP_ROLES = {"super_admin", "tenant_admin", "founder",
                     "creative_director", "account_director"}

# ─────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────
def _now() -> datetime:
    return datetime.now(timezone.utc)


def _require_leadership(ctx: dict) -> str:
    """Returns the profile id of the requester. 403 if not leadership."""
    pid = ctx.get("user_id") or ctx.get("profile_id")
    role = (ctx.get("role") or "").lower()
    if role not in _LEADERSHIP_ROLES:
        raise HTTPException(403, "Studio Pulse is a leadership surface.")
    if not pid:
        raise HTTPException(401, "Authentication required.")
    return pid


def _it_count_word(n: int, singular: str, plural: str, many: str = None) -> str:
    """Editorial count adjective. Never reveals raw numbers in copy."""
    if n <= 0: return "Nessun"
    if n == 1: return singular
    if n <= 3: return "Alcune" if plural.lower().startswith(("c", "s")) else "Alcuni"
    if n <= 7: return "Più" if not many else many
    return many or "Molte"


# ─────────────────────────────────────────────────────────────────────
# CLIMATE · the breathing state of the studio
# ─────────────────────────────────────────────────────────────────────
@router.get("/climate")
def studio_climate(ctx: dict = Depends(get_tenant_context)):
    """
    Distills the overall studio climate from recent activity density.
    Returns a narrative state — never a metric.
    """
    _require_leadership(ctx)
    c = db()
    tenant_id = ctx["tenant_id"]
    now = _now()
    h6  = (now - timedelta(hours=6)).isoformat()
    h24 = (now - timedelta(hours=24)).isoformat()
    d3  = (now - timedelta(days=3)).isoformat()

    events_6h = (c.table("relationship_events").select("id", count="exact")
                 .eq("tenant_id", tenant_id).gte("occurred_at", h6).execute()).count or 0
    events_24h = (c.table("relationship_events").select("id", count="exact")
                  .eq("tenant_id", tenant_id).gte("occurred_at", h24).execute()).count or 0
    msgs_24h = (c.table("relationship_messages").select("id", count="exact")
                .eq("tenant_id", tenant_id).gte("created_at", h24).execute()).count or 0
    direction_3d = (c.table("relationship_direction_snapshots").select("id", count="exact")
                    .eq("tenant_id", tenant_id).gte("created_at", d3).execute()).count or 0

    # Interpret — pure narrative, no numbers leaked
    if events_24h == 0 and msgs_24h == 0:
        state_key = "reflective_rhythm"
        headline = "Ritmo riflessivo"
        narrative = ("Lo studio è in una fase contemplativa. "
                     "Le relazioni respirano lentamente, senza fretta.")
    elif events_6h >= 6:
        state_key = "intense_curatorial"
        headline = "Attività curatoriale intensa"
        narrative = ("Lo studio sta vivendo ore dense di gesti. "
                     "Le relazioni si muovono in profondità.")
    elif direction_3d >= 2:
        state_key = "active_convergence"
        headline = "Convergenza attiva"
        narrative = ("Le direzioni progettuali stanno trovando forma. "
                     "Lo studio osserva atmosfere che si stabilizzano.")
    elif msgs_24h >= 5:
        state_key = "deep_focus"
        headline = "Concentrazione materica"
        narrative = ("Conversazioni profonde attraversano lo studio. "
                     "Il dialogo curatoriale ha un peso particolare oggi.")
    elif events_24h >= 1:
        state_key = "quiet_momentum"
        headline = "Momentum tranquillo"
        narrative = ("Lo studio si muove con misura. "
                     "Piccoli gesti, ascoltati con cura.")
    else:
        state_key = "hospitality_rising"
        headline = "Atmosfera in apertura"
        narrative = ("Lo studio si prepara ad accogliere. "
                     "L'aria è quella di una porta che resta aperta.")

    return {
        "state_key": state_key,
        "headline": headline,
        "narrative": narrative,
        "observed_at": now.isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────
# SILENT RELATIONSHIPS · those that stopped breathing
# ─────────────────────────────────────────────────────────────────────
@router.get("/silent-relationships")
def silent_relationships(
    days_silent: int = Query(3, ge=1, le=30),
    limit: int = Query(8, ge=1, le=20),
    ctx: dict = Depends(get_tenant_context),
):
    """
    Relationships that have not generated any event/message in the last
    `days_silent` days. NOT inactive leads — relationships that paused.
    """
    _require_leadership(ctx)
    c = db()
    tenant_id = ctx["tenant_id"]
    cutoff = (_now() - timedelta(days=days_silent)).isoformat()

    # Single batched event/message lookups — avoid N+1 queries
    leads = (c.table("leads").select("id, first_name, last_name, company_name")
             .eq("tenant_id", tenant_id).limit(40).execute()).data or []
    if not leads:
        return {"data": [], "aggregate": "Tutte le relazioni stanno respirando."}

    lead_ids = [l["id"] for l in leads]
    # one query: most recent event per lead
    evt_rows = (c.table("relationship_events").select("lead_id, occurred_at")
                .eq("tenant_id", tenant_id).in_("lead_id", lead_ids)
                .order("occurred_at", desc=True).limit(500).execute()).data or []
    last_evt: Dict[str, str] = {}
    for r in evt_rows:
        if r["lead_id"] not in last_evt:
            last_evt[r["lead_id"]] = r["occurred_at"]
    # message lookups via threads → batched
    thr_rows = (c.table("relationship_threads").select("id, lead_id")
                .eq("tenant_id", tenant_id).in_("lead_id", lead_ids).execute()).data or []
    thread_to_lead = {t["id"]: t["lead_id"] for t in thr_rows if t.get("lead_id")}
    last_msg: Dict[str, str] = {}
    if thread_to_lead:
        msg_rows = (c.table("relationship_messages").select("thread_id, created_at")
                    .in_("thread_id", list(thread_to_lead.keys()))
                    .order("created_at", desc=True).limit(500).execute()).data or []
        for r in msg_rows:
            lid = thread_to_lead.get(r["thread_id"])
            if lid and lid not in last_msg:
                last_msg[lid] = r["created_at"]

    silent: List[Dict[str, Any]] = []
    for lead in leads:
        lid = lead["id"]
        full_name = " ".join(filter(None, [lead.get("first_name"), lead.get("last_name")])).strip() \
            or lead.get("company_name") or ""
        last_movement = max(filter(None, [last_evt.get(lid), last_msg.get(lid)]), default=None)
        if last_movement is None or last_movement < cutoff:
            first = full_name.split()[0] if full_name else None
            silent.append({
                "lead_id": lid,
                "name": full_name or "Una relazione",
                "last_movement": last_movement,
                "narrative": (
                    f"La relazione con {first} non si muove da alcuni giorni."
                    if first else
                    "Una relazione sembra in pausa contemplativa."
                ),
            })
        if len(silent) >= limit:
            break

    # Aggregate headline
    if not silent:
        aggregate = "Tutte le relazioni stanno respirando."
    elif len(silent) == 1:
        aggregate = "Una relazione sembra in pausa contemplativa."
    elif len(silent) <= 3:
        aggregate = "Alcune relazioni sembrano sospese in attesa."
    else:
        aggregate = "Diverse conversazioni si sono fermate, in silenzio."

    return {"data": silent, "aggregate": aggregate}


# ─────────────────────────────────────────────────────────────────────
# DESIGNER INTENSITY · narrative reading, NOT overload alert
# ─────────────────────────────────────────────────────────────────────
@router.get("/designer-intensity")
def designer_intensity(ctx: dict = Depends(get_tenant_context)):
    """
    Reads each designer's relational intensity over the last 7 days.
    Surfaces it as curatorial narrative, never as task count.
    """
    _require_leadership(ctx)
    c = db()
    tenant_id = ctx["tenant_id"]
    cutoff = (_now() - timedelta(days=7)).isoformat()

    # All studio designers in this tenant
    designers = (c.table("users_profile")
                 .select("id, first_name, last_name, role")
                 .eq("tenant_id", tenant_id)
                 .in_("role", ["designer", "tenant_admin", "super_admin"])
                 .limit(40).execute()).data or []

    out: List[Dict[str, Any]] = []
    for d in designers:
        did = d["id"]
        name = " ".join(filter(None, [d.get("first_name"), d.get("last_name")])).strip() \
            or "Un designer"
        active_threads = (c.table("relationship_threads").select("id", count="exact")
                          .eq("tenant_id", tenant_id).eq("primary_designer_id", did)
                          .execute()).count or 0
        recent_events = (c.table("relationship_events").select("id", count="exact")
                         .eq("tenant_id", tenant_id).eq("designer_id", did)
                         .gte("occurred_at", cutoff).execute()).count or 0
        # presence
        pres = (c.table("designer_presence").select("state_key,state_label_it")
                .eq("tenant_id", tenant_id).eq("designer_id", did)
                .limit(1).execute()).data
        presence_label = pres[0]["state_label_it"] if pres else "In studio"

        first_name = name.split()[0]
        if recent_events >= 8 and active_threads >= 2:
            narrative = f"{first_name} sta sostenendo molte relazioni attive."
        elif active_threads >= 2:
            narrative = f"{first_name} è immersa in conversazioni materiali simultanee." if first_name.endswith("a") else f"{first_name} è immerso in conversazioni materiali simultanee."
        elif recent_events >= 3:
            narrative = f"{first_name} sta accompagnando con cura alcune relazioni in evoluzione."
        elif recent_events >= 1:
            narrative = f"{first_name} accompagna una relazione con misurata attenzione."
        else:
            narrative = f"{first_name} si muove con ritmo silenzioso questa settimana."

        out.append({
            "designer_id": did,
            "name": name,
            "presence_label": presence_label,
            "narrative": narrative,
        })

    return {"data": out}


# ─────────────────────────────────────────────────────────────────────
# ATMOSPHERE CONVERGENCE · curatorial intelligence aggregation
# ─────────────────────────────────────────────────────────────────────
@router.get("/atmosphere-convergence")
def atmosphere_convergence(ctx: dict = Depends(get_tenant_context)):
    """
    Aggregates Design Direction™ snapshots into emerging studio-wide
    atmospheres, materials, palettes. Pure curatorial intelligence.
    """
    _require_leadership(ctx)
    c = db()
    tenant_id = ctx["tenant_id"]

    snaps = (c.table("relationship_direction_snapshots")
             .select("atmosphere_summary, material_summary, palette_summary, "
                     "lifestyle_summary, cultural_summary, narrative_summary, created_at")
             .eq("tenant_id", tenant_id)
             .order("created_at", desc=True).limit(20).execute()).data or []

    atmospheres: Counter = Counter()
    materials: Counter = Counter()
    swatches: Dict[str, Dict[str, str]] = {}     # hex → {hex, name}

    for s in snaps:
        atm = s.get("atmosphere_summary") or {}
        for chip in atm.get("chips") or []:
            if chip and isinstance(chip, str):
                atmospheres[chip.strip()] += 1
        mat = s.get("material_summary") or {}
        for m in mat.get("materials") or []:
            n = (m or {}).get("name")
            if n: materials[n.strip()] += 1
        pal = s.get("palette_summary") or {}
        for sw in pal.get("swatches") or []:
            h = (sw or {}).get("hex")
            if h and h not in swatches:
                swatches[h] = {"hex": h, "name": sw.get("name") or ""}

    top_atmos = [{"label": k, "weight": v} for k, v in atmospheres.most_common(5)]
    top_materials = [{"label": k, "weight": v} for k, v in materials.most_common(6)]
    palette = list(swatches.values())[:8]

    if not snaps:
        narrative = ("Le atmosfere dello studio non si sono ancora pronunciate. "
                     "Le prime convergenze emergeranno con i dialoghi.")
    elif top_atmos:
        first = top_atmos[0]["label"]
        narrative = (f"Lo studio sta convergendo verso atmosfere di {first.lower()}. "
                     "Linguaggi e materiali recenti raccontano una direzione comune.")
    else:
        narrative = ("Le relazioni stanno disegnando una direzione progettuale "
                     "ancora silenziosa, ma riconoscibile.")

    return {
        "atmospheres": top_atmos,
        "materials": top_materials,
        "palette": palette,
        "narrative": narrative,
        "snapshot_count": len(snaps),
    }


# ─────────────────────────────────────────────────────────────────────
# RECENT MOVEMENTS · soft narrative fragments
# ─────────────────────────────────────────────────────────────────────
@router.get("/recent-movements")
def recent_movements(
    limit: int = Query(8, ge=1, le=20),
    ctx: dict = Depends(get_tenant_context),
):
    """Tenant-wide editorial timeline fragments. NOT an activity feed."""
    _require_leadership(ctx)
    c = db()
    tenant_id = ctx["tenant_id"]
    r = (c.table("relationship_events")
         .select("id, event_type, narrative, actor_label, occurred_at")
         .eq("tenant_id", tenant_id)
         .order("occurred_at", desc=True).limit(limit).execute()).data or []
    return {"data": r}
