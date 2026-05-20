"""Usage Memory™ + Material Atlas™ router — Phase F2.2.

NON è una dashboard analytics. È una "memoria curatoriale accumulata":
  • cosa lo studio usa di più (atmospheres / materials / brands)
  • quali asset sono ricorrenti nei moodboard
  • quali palette emergono nel linguaggio progettuale

Endpoint:
  GET /api/inspirations/usage-memory/studio-language
    Aggregato editoriale degli ultimi 90 giorni.
    Output ITALIAN-friendly: niente percentuali / KPI / score visibili
    all'utente — solo top-N liste curate.

  GET /api/inspirations/materials/atlas
    Atlante materico curatoriale. Restituisce texture + material_sample
    + detail-of-material assets raggruppati per family cromatica e
    materialità ricorrente.

Linguaggio (verificato strict): "linguaggio progettuale", "atmosfere
ricorrenti", "materialità prevalenti", "atelier", "ritmo visuale".
ZERO termini: "analytics", "KPI", "engagement", "score", "dashboard".
"""
from __future__ import annotations

import logging
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query

from core.tenant_context import get_tenant_context
from database import db

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Studio Language — Usage Memory™ aggregator ───────────────────────
@router.get("/usage-memory/studio-language")
def studio_language(
    days: int = Query(90, ge=7, le=365),
    ctx=Depends(get_tenant_context),
):
    """Riassume il linguaggio progettuale dello studio (ultimi N giorni).

    Output (italiano editoriale, niente percentuali esposte):
      {
        "window_days":          90,
        "moodboards_built":     N,
        "atmospheres":          [{"label":"sobrio", "presence":"forte|ricorrente|presente"}, …],
        "materialities":        [{"label":"legno", "presence":"…"}, …],
        "brands":               [{"name":"Bonaldo", "appearances":N}, …],
        "color_families":       [{"family":"grigio_chiaro", "presence":"…"}, …],
        "composition_modes":    [{"mode":"composition", "presence":"…"}, …],
        "narrative_threads":    [italian sentences],
      }
    """
    c = db()
    tid = ctx["tenant_id"]
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    # 1. Usage events of last N days
    events = (c.table("product_usage_events").select(
        "id,product_id,brand_id,usage_type,moodboard_id,created_at"
    ).eq("tenant_id", tid).gte("created_at", since)
     .order("created_at", desc=True).limit(2000).execute().data or [])

    # Count moodboards distinct touched
    mbs = set(e.get("moodboard_id") for e in events if e.get("moodboard_id"))
    moodboards_built = len(mbs)

    # 2. Hydrate product metas (single bulk query)
    pids = list({e["product_id"] for e in events if e.get("product_id")})
    metas: Dict[str, Dict[str, Any]] = {}
    if pids:
        rows = (c.table("media_library").select("id,inspiration_meta")
                .in_("id", pids[:500]).eq("tenant_id", tid)
                .limit(500).execute().data or [])
        for r in rows:
            metas[r["id"]] = r.get("inspiration_meta") or {}

    # 3. Counters
    atmos = Counter(); mats = Counter(); brands = Counter()
    fams = Counter(); modes = Counter()
    for e in events:
        m = metas.get(e.get("product_id") or "") or {}
        for t in (m.get("mood_tags") or []):           atmos[t] += 1
        for t in (m.get("material_tags") or []):       mats[t]  += 1
        if m.get("brand"):                              brands[m["brand"]] += 1
        if m.get("color_family"):                       fams[m["color_family"]] += 1
        at = m.get("asset_type")
        if at in ("lifestyle", "campaign"):             modes["editorial"] += 1
        elif at in ("still_life", "cutout", "detail"):  modes["composition"] += 1
        elif at in ("texture", "material_sample"):      modes["material"] += 1
        elif at in ("rendering",):                       modes["storytelling"] += 1

    # 4. Italian "presence" label (curatorial, no numbers)
    def _presence(rank: int, total: int) -> str:
        if total == 0:
            return "presente"
        if rank == 0:
            return "forte"
        if rank < max(2, int(total * 0.25)):
            return "ricorrente"
        return "presente"

    def _top(counter: Counter, key_field: str, limit: int = 6, value_field: str = "label"):
        items = counter.most_common(limit)
        return [
            {key_field: lbl, value_field: lbl, "presence": _presence(i, len(items)),
             "appearances": n}
            for i, (lbl, n) in enumerate(items)
        ]

    # Customize keys per output schema
    atmospheres_out = [
        {"label": l, "presence": _presence(i, len(atmos)), "appearances": n}
        for i, (l, n) in enumerate(atmos.most_common(8))
    ]
    materialities_out = [
        {"label": l, "presence": _presence(i, len(mats)), "appearances": n}
        for i, (l, n) in enumerate(mats.most_common(8))
    ]
    color_fams_out = [
        {"family": f, "presence": _presence(i, len(fams)), "appearances": n}
        for i, (f, n) in enumerate(fams.most_common(6))
    ]
    brands_out = [
        {"name": b, "appearances": n}
        for b, n in brands.most_common(6)
    ]
    modes_out = [
        {"mode": m, "presence": _presence(i, len(modes)), "appearances": n}
        for i, (m, n) in enumerate(modes.most_common(4))
    ]

    # 5. Italian narrative threads — curatorial sentences, NOT a dashboard.
    narratives: List[str] = []
    if atmospheres_out:
        top_atm = atmospheres_out[0]["label"]
        narratives.append(
            f"L'atmosfera *{top_atm}* attraversa il linguaggio progettuale dello studio "
            f"con una continuità ricorrente."
        )
    if materialities_out and len(materialities_out) >= 2:
        a, b = materialities_out[0]["label"], materialities_out[1]["label"]
        narratives.append(
            f"Le materialità prevalenti dialogano tra {a} e {b} — un asse compositivo "
            f"che si ripete nelle composizioni recenti."
        )
    if brands_out:
        top_brand = brands_out[0]["name"]
        narratives.append(
            f"Il produttore *{top_brand}* compare frequentemente nelle composizioni "
            f"degli ultimi {days} giorni."
        )
    if modes_out:
        top_mode = modes_out[0]["mode"]
        mode_label = {
            "editorial":    "narrazione editoriale e atmosfera",
            "composition":  "composizione professionale con asset isolati",
            "material":     "lettura materica e tattile",
            "storytelling": "racconto cinematico e architettura della scena",
        }.get(top_mode, "lettura compositiva")
        narratives.append(
            f"Lo studio tende verso una direzione curatoriale orientata alla {mode_label}."
        )
    if moodboards_built >= 3:
        narratives.append(
            f"{moodboards_built} composizioni recenti raccontano una densità editoriale costante."
        )
    if not narratives:
        narratives.append(
            "Il linguaggio progettuale dello studio è in fase di formazione — "
            "le prime composizioni stanno tracciando i tratti ricorrenti."
        )

    return {
        "window_days":        days,
        "moodboards_built":   moodboards_built,
        "events_observed":    len(events),
        "atmospheres":        atmospheres_out,
        "materialities":      materialities_out,
        "brands":             brands_out,
        "color_families":     color_fams_out,
        "composition_modes":  modes_out,
        "narrative_threads":  narratives,
    }


# ─── Material View™ — Materioteca curatoriale ─────────────────────────
def _material_card(row: Dict[str, Any]) -> Dict[str, Any]:
    meta = row.get("inspiration_meta") or {}
    return {
        "id":                  row.get("id"),
        "file_url":            row.get("file_url"),
        "width":               row.get("width"),
        "height":              row.get("height"),
        "alt_text":            row.get("alt_text"),
        "product_name":        meta.get("product_name"),
        "brand":               meta.get("brand"),
        "asset_type":          meta.get("asset_type"),
        "view_angle":          meta.get("view_angle"),
        "color_family":        meta.get("color_family"),
        "dominant_color_palette": meta.get("dominant_color_palette") or [],
        "material_tags":       meta.get("material_tags") or [],
        "mood_tags":           meta.get("mood_tags") or [],
        "texture_repetition_score": meta.get("texture_repetition_score"),
        "visual_weight":       meta.get("visual_weight"),
        "moodboard_priority":  meta.get("moodboard_priority"),
        "editorial_score":     meta.get("editorial_score"),
    }


@router.get("/materials/atlas")
def materials_atlas(
    color_family: Optional[str] = Query(None),
    material: Optional[str] = Query(None),
    limit: int = Query(160, le=400),
    ctx=Depends(get_tenant_context),
):
    """Atlante materico curatoriale — texture · material_sample · detail.

    NON è un catalogo tecnico materiali. È una **materioteca** organizzata
    per family cromatica + ritmo visuale + materialità.

    Filters (optional, all combinable):
      • color_family= grigio_chiaro | ocra | terra | …
      • material=     legno | marmo | ottone | …  (matches material_tags)
    """
    c = db()
    tid = ctx["tenant_id"]

    rows = (c.table("media_library").select(
        "id,file_url,width,height,alt_text,inspiration_meta,created_at"
    ).eq("tenant_id", tid).eq("is_inspiration", True)
     .eq("inspiration_meta->>inspiration_type", "product")
     .in_("inspiration_meta->>asset_type", ["texture", "material_sample", "detail"])
     .order("created_at", desc=True).limit(min(limit * 3, 800))
     .execute().data or [])

    cards = [_material_card(r) for r in rows]

    if color_family:
        cards = [c for c in cards if c.get("color_family") == color_family]
    if material:
        ml = material.lower()
        cards = [c for c in cards
                 if any(ml in (t or "").lower() for t in (c.get("material_tags") or []))
                 or ml in (c.get("product_name") or "").lower()]

    # Sort by texture_repetition + visual_weight + editorial_score
    cards.sort(key=lambda c: (
        -(float(c.get("texture_repetition_score") or 0.0)),
        -(float(c.get("visual_weight") or 0.0)),
        -(float(c.get("editorial_score") or 0.0)),
    ))
    cards = cards[:limit]

    # Aggregates for the left filter rail
    fam_counter: Counter = Counter()
    mat_counter: Counter = Counter()
    for c2 in cards:
        if c2.get("color_family"): fam_counter[c2["color_family"]] += 1
        for t in (c2.get("material_tags") or []): mat_counter[t] += 1

    return {
        "items":            cards,
        "count":            len(cards),
        "color_families":   [{"family": f, "count": n} for f, n in fam_counter.most_common(12)],
        "materials":        [{"label": l, "count": n} for l, n in mat_counter.most_common(20)],
        "filters_applied":  {"color_family": color_family, "material": material},
    }
