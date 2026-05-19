"""crm_intelligence.py — Relationship Summary + Mood prevalente + Cultural Editions.

Adds three Phase-1 endpoints used by the new AccountDetailPage™:

  GET  /api/relationships/accounts/{aid}/summary
       Composes the right-hand panel data: stage + health + owner +
       advisor (if any) + last_contact + next_followup + market context +
       computed mood_dominant + materials affinity + budget/timing +
       editorial micro insights derived from existing data.

  GET  /api/relationships/accounts/{aid}/mood-signals
       Returns ONLY the mood computation (cached on accounts.signal_snapshot
       when fresh, recomputed when stale).

  POST /api/relationships/accounts/{aid}/cultural-editions
       Foundation endpoint to express the user's intent of creating a
       cultural edition for an account from a source (project | article |
       moodboard) towards a submarket. For Phase-1 we record the intent
       on `interactions` (so it shows up in the timeline) and return the
       suggested editorial_variant context — the actual variant creation
       hand-off lives in editorial_studio routers.
"""
from __future__ import annotations

import logging
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import db
from core.tenant_context import get_tenant_context

logger = logging.getLogger(__name__)
router = APIRouter(tags=["relationships"], prefix="/relationships")


# ─── Helpers ──────────────────────────────────────────────────────────
def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_or_404(c, table: str, row_id: str, tid: str) -> Dict[str, Any]:
    r = (c.table(table).select("*").eq("id", row_id).eq("tenant_id", tid)
         .limit(1).execute().data or [])
    if not r:
        raise HTTPException(404, f"{table} not found")
    return r[0]


def _compute_mood(c, account_id: str, tid: str) -> Dict[str, Any]:
    """Editorial mood inference.

    Mood prevalente NOT entered by hand. We derive a small palette of
    'atmosphere' tags by tallying signals from:
      • account_style.atmosphere_tags         (highest weight: explicit)
      • account_style.preferred_styles        (medium)
      • account_style.preferred_materials     (low — material affinity)
      • interactions where moodboard_id IS NOT NULL    (engagement proxy)

    Returns:
      {
        "tags": [{"tag": "warm", "weight": 5, "source": "style"}, ...],
        "dominant": "warm",
        "secondary": "tactile",
        "computed_at": "2026-..."
      }
    """
    counter: Counter = Counter()
    sources: Dict[str, str] = {}

    style = (c.table("account_style_profile").select("*")
             .eq("account_id", account_id).eq("tenant_id", tid)
             .limit(1).execute().data or [])
    if style:
        s = style[0]
        for t in (s.get("atmosphere_tags") or []):
            counter[t] += 4; sources.setdefault(t, "atmosphere")
        for t in (s.get("preferred_styles") or []):
            counter[t] += 3; sources.setdefault(t, "style")
        for t in (s.get("designer_validated_tags") or []):
            counter[t] += 3; sources.setdefault(t, "designer-validated")
        for t in (s.get("preferred_materials") or []):
            counter[t] += 1; sources.setdefault(t, "material")

    # Light boost: moodboards engaged via interactions count as engagement
    mb_ints = (c.table("interactions").select("moodboard_id, interaction_type")
               .eq("account_id", account_id).eq("tenant_id", tid)
               .not_.is_("moodboard_id", "null").limit(50).execute().data or [])
    for it in mb_ints:
        if it.get("moodboard_id"):
            counter["moodboard-engaged"] += 1
            sources.setdefault("moodboard-engaged", "engagement")

    ordered = counter.most_common(6)
    tags = [
        {"tag": t, "weight": w, "source": sources.get(t, "computed")}
        for t, w in ordered if t and t != "moodboard-engaged"
    ]
    return {
        "tags":       tags,
        "dominant":   tags[0]["tag"] if tags else None,
        "secondary":  tags[1]["tag"] if len(tags) > 1 else None,
        "computed_at": _iso(),
    }


def _sub_label(sub: Optional[Dict[str, Any]]) -> str:
    if not sub:
        return ""
    dn = sub.get("display_name") or sub.get("name") or {}
    if isinstance(dn, str):
        return dn
    return dn.get("it-IT") or dn.get("en-US") or sub.get("code", "")


def _micro_insights(account: Dict[str, Any], submarket: Optional[Dict[str, Any]],
                    mood: Dict[str, Any]) -> List[Dict[str, str]]:
    """Generate 2–4 editorial micro-insights, NOT analytics.

    Each insight is a small narrative sentence tied to one signal. We
    intentionally avoid KPIs / percentages — the tone is concierge.
    """
    out: List[Dict[str, str]] = []
    sub = submarket or {}
    ep = sub.get("editorial_profile") or {}
    profile_raw = ep.get("it-IT") or ep.get("en-US")
    profile = " · ".join(profile_raw) if isinstance(profile_raw, list) else (profile_raw or "")
    if profile:
        out.append({
            "kind":    "market",
            "icon":    "globe",
            "text":    f"Il mercato {_sub_label(sub)} ha un profilo {profile}.",
        })

    cpsy = sub.get("cta_psychology") or {}
    cta_raw = cpsy.get("it-IT") or cpsy.get("en-US")
    cta_psy = " · ".join(cta_raw) if isinstance(cta_raw, list) else (cta_raw or "")
    if cta_psy:
        out.append({
            "kind":    "narrative",
            "icon":    "compass",
            "text":    f"Risponde meglio a una CTA orientata a: {cta_psy}.",
        })

    if mood.get("dominant"):
        out.append({
            "kind":    "mood",
            "icon":    "sparkles",
            "text":    f"Mood prevalente percepito: {mood['dominant']}.",
        })

    a_type = account.get("account_type")
    cultural = {
        "hotel_group":   "Le gallery immersive performano meglio con questo profilo.",
        "yacht_client":  "Predilige narrative bespoke con materiali tattili e palette marine.",
        "luxury_retail": "L'esperienza flagship pesa più della specifica tecnica.",
        "partner_brand": "Cerca co-creazione editoriale, non solo fornitura.",
        "hospitality_group": "Le gallery immersive performano meglio con questo profilo.",
    }.get(a_type)
    if cultural:
        out.append({"kind": "type", "icon": "feather", "text": cultural})

    return out[:4]


def _next_open_action(c, account_id: str, tid: str) -> Optional[Dict[str, Any]]:
    r = (c.table("relationship_actions").select("*")
         .eq("account_id", account_id).eq("tenant_id", tid)
         .eq("status", "open").order("due_date").limit(1).execute().data or [])
    return r[0] if r else None


# ─── Summary endpoint ─────────────────────────────────────────────────
@router.get("/accounts/{account_id}/summary")
def relationship_summary(account_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    acc = _row_or_404(c, "accounts", account_id, tid)

    # Style + mood
    style_rows = (c.table("account_style_profile").select("*")
                  .eq("account_id", account_id).eq("tenant_id", tid)
                  .limit(1).execute().data or [])
    style = style_rows[0] if style_rows else {}
    mood = _compute_mood(c, account_id, tid)

    # Owner profile (resolved from users_profile if linked)
    owner = None
    if acc.get("primary_owner_id"):
        owner_rows = (c.table("users_profile").select("id, full_name, email, role")
                      .eq("id", acc["primary_owner_id"])
                      .eq("tenant_id", tid)
                      .limit(1).execute().data or [])
        owner = owner_rows[0] if owner_rows else None

    # Submarket context (if account.market_submarket is set OR fallback to country)
    sub_row = None
    if acc.get("market_submarket"):
        sub_rows = (c.table("market_submarkets").select("*")
                    .eq("code", acc["market_submarket"]).limit(1).execute().data or [])
        sub_row = sub_rows[0] if sub_rows else None

    # Advisor (if referrals point to this tenant) — limited public view
    advisor = None
    try:
        ref_rows = (c.table("advisor_referrals").select("advisor_id, signup_date")
                    .eq("tenant_id", tid).limit(1).execute().data or [])
        if ref_rows:
            adv_id = ref_rows[0]["advisor_id"]
            adv = (c.table("advisor_profiles").select("name, advisor_code, territory")
                   .eq("id", adv_id).limit(1).execute().data or [])
            if adv:
                advisor = {**adv[0], "since": ref_rows[0].get("signup_date")}
    except Exception:
        advisor = None  # advisor module may not be enabled

    # Open actions / next follow-up
    next_action = _next_open_action(c, account_id, tid)

    # Last interaction (any kind)
    last_int = (c.table("interactions").select("*")
                .eq("account_id", account_id).eq("tenant_id", tid)
                .order("occurred_at", desc=True).limit(1).execute().data or [])

    # Micro-insights
    insights = _micro_insights(acc, sub_row, mood)

    # Persist mood snapshot (best-effort cache)
    try:
        c.table("accounts").update({
            "mood_dominant":   mood.get("dominant"),
            "signal_snapshot": {"mood": mood, "computed_at": _iso()},
            "next_followup_at": next_action.get("due_date") if next_action else None,
            "updated_at":      _iso(),
        }).eq("id", account_id).eq("tenant_id", tid).execute()
    except Exception:
        pass

    return {
        "account":    acc,
        "owner":      owner,
        "advisor":    advisor,
        "style":      style,
        "mood":       mood,
        "submarket":  sub_row,
        "last_interaction": last_int[0] if last_int else None,
        "next_action": next_action,
        "insights":   insights,
    }


# ─── Mood signal endpoint ─────────────────────────────────────────────
@router.get("/accounts/{account_id}/mood-signals")
def mood_signals(account_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    _row_or_404(c, "accounts", account_id, tid)
    return {"mood": _compute_mood(c, account_id, tid)}


# ─── Relationship Graph™ — editorial connection map ───────────────────
@router.get("/accounts/{account_id}/graph")
def relationship_graph(account_id: str, ctx=Depends(get_tenant_context)):
    """Editorial map of an account — NOT a debug graph viz.

    Aggregates every connection the relationship has woven across MOOD:
      • Progetti collegati (relationship_projects)
      • Moodboard condivise (via interactions with moodboard_id)
      • Cultural Editions™ avviate (interactions report_payload kind=cultural_edition_intent)
      • Ispirazioni salvate (relationship_inspirations)
      • Materiali in risonanza (relationship_material_affinities, ordered by attraction_score)
      • Mercati attivi (account_markets)
      • Segnali editoriali recenti (relationship_engagement_signals)

    Tono: concierge · editorial · MAI tecnico ("nodes/edges/weight" non
    vengono mai esposti al frontend).
    """
    c = db()
    tid = ctx["tenant_id"]
    _row_or_404(c, "accounts", account_id, tid)

    # ─ Projects linked ─
    proj_links = (c.table("relationship_projects").select("*")
                  .eq("account_id", account_id).eq("tenant_id", tid)
                  .order("linked_at", desc=True).limit(20).execute().data or [])
    project_ids = [pl["project_id"] for pl in proj_links if pl.get("project_id")]
    proj_titles: Dict[str, Dict[str, Any]] = {}
    if project_ids:
        try:
            pr = (c.table("portfolio_projects").select("id, master_title, slug, status")
                  .in_("id", project_ids).eq("tenant_id", tid).execute().data or [])
            proj_titles = {p["id"]: p for p in pr}
        except Exception:
            proj_titles = {}
    projects = [{
        "id":            pl["project_id"],
        "name":          (proj_titles.get(pl["project_id"]) or {}).get("master_title") or "Progetto",
        "slug":          (proj_titles.get(pl["project_id"]) or {}).get("slug"),
        "status":        (proj_titles.get(pl["project_id"]) or {}).get("status"),
        "role":          pl.get("role"),
        "linked_at":     pl.get("linked_at"),
    } for pl in proj_links]

    # ─ Moodboards (inferred from interactions where moodboard_id is set) ─
    mb_ints = (c.table("interactions")
               .select("moodboard_id, occurred_at, interaction_type")
               .eq("account_id", account_id).eq("tenant_id", tid)
               .not_.is_("moodboard_id", "null")
               .order("occurred_at", desc=True).limit(40).execute().data or [])
    mb_seen: Dict[str, Dict[str, Any]] = {}
    for it in mb_ints:
        mid = it.get("moodboard_id")
        if not mid or mid in mb_seen:
            continue
        mb_seen[mid] = {
            "id":          mid,
            "last_touch":  it.get("occurred_at"),
            "via":         it.get("interaction_type"),
        }
    moodboard_ids = list(mb_seen.keys())
    if moodboard_ids:
        try:
            mb_rows = (c.table("moodboards").select("id, title, status")
                       .in_("id", moodboard_ids).eq("tenant_id", tid).execute().data or [])
            mb_titles = {m["id"]: m for m in mb_rows}
        except Exception:
            mb_titles = {}
        for mid, m in mb_seen.items():
            t = mb_titles.get(mid, {})
            m["name"] = t.get("title") or "Moodboard"
            m["status"] = t.get("status")
    moodboards = list(mb_seen.values())

    # ─ Cultural Editions™ requested ─
    ce_rows = (c.table("interactions").select("id, occurred_at, title, report_payload")
               .eq("account_id", account_id).eq("tenant_id", tid)
               .eq("interaction_type", "ai_summary")
               .order("occurred_at", desc=True).limit(20).execute().data or [])
    cultural_editions = []
    for it in ce_rows:
        rp = it.get("report_payload") or {}
        if rp.get("kind") != "cultural_edition_intent":
            continue
        snap = rp.get("submarket_snapshot") or {}
        cultural_editions.append({
            "intent_id":          it["id"],
            "started_at":         it.get("occurred_at"),
            "submarket_name":     snap.get("name") or rp.get("target_submarket"),
            "submarket_code":     rp.get("target_submarket"),
            "market_code":        rp.get("target_market"),
            "locale":             rp.get("target_locale"),
        })

    # ─ Inspirations saved ─
    insp_rows = (c.table("relationship_inspirations").select("*")
                 .eq("account_id", account_id).eq("tenant_id", tid)
                 .order("saved_at", desc=True).limit(20).execute().data or [])
    inspirations = [{
        "id":            r["reference_id"],
        "saved_at":      r.get("saved_at"),
        "source":        r.get("source"),
        "resonance":     r.get("resonance_note"),
    } for r in insp_rows]

    # ─ Material affinities (ordered) ─
    mat_rows = (c.table("relationship_material_affinities").select("*")
                .eq("account_id", account_id).eq("tenant_id", tid)
                .order("attraction_score", desc=True).limit(12).execute().data or [])
    mat_ids = [m["material_id"] for m in mat_rows if m.get("material_id")]
    mat_titles: Dict[str, Dict[str, Any]] = {}
    if mat_ids:
        try:
            mr = (c.table("material_registry").select("id, name, category, finish")
                  .in_("id", mat_ids).eq("tenant_id", tid).execute().data or [])
            mat_titles = {m["id"]: m for m in mr}
        except Exception:
            mat_titles = {}
    materials = [{
        "id":            m["material_id"],
        "name":          (mat_titles.get(m["material_id"]) or {}).get("name") or "Materiale",
        "family":        (mat_titles.get(m["material_id"]) or {}).get("category"),
        "finish":        (mat_titles.get(m["material_id"]) or {}).get("finish"),
        "affinity":      float(m.get("attraction_score") or 0),
        "sample_requested": bool(m.get("sample_requested")),
        "specified":     bool(m.get("specified")),
        "last_touch":    m.get("last_engaged_at"),
    } for m in mat_rows]

    # ─ Active markets ─
    am_rows = (c.table("account_markets").select("*")
               .eq("account_id", account_id).eq("tenant_id", tid)
               .order("is_primary", desc=True).execute().data or [])
    market_ids = [a["market_id"] for a in am_rows if a.get("market_id")]
    market_titles: Dict[str, Dict[str, Any]] = {}
    if market_ids:
        try:
            mks = (c.table("markets").select("id, code, name")
                   .in_("id", market_ids).execute().data or [])
            market_titles = {m["id"]: m for m in mks}
        except Exception:
            market_titles = {}
    markets = [{
        "id":            a["market_id"],
        "name":          (market_titles.get(a["market_id"]) or {}).get("name")
                          or (market_titles.get(a["market_id"]) or {}).get("code")
                          or "Mercato",
        "code":          (market_titles.get(a["market_id"]) or {}).get("code"),
        "is_primary":    bool(a.get("is_primary")),
        "engagement":    float(a.get("engagement_strength") or 0),
    } for a in am_rows]

    # ─ Recent editorial signals ─
    recent_sigs = (c.table("relationship_engagement_signals")
                   .select("signal_type, entity_type, occurred_at, cta_intent, atmosphere_tags, material_tags, market_id")
                   .eq("account_id", account_id).eq("tenant_id", tid)
                   .order("occurred_at", desc=True).limit(8).execute().data or [])

    # ─ Editorial counts (concierge-tone, not analytics) ─
    counts = {
        "projects":          len(projects),
        "moodboards":        len(moodboards),
        "cultural_editions": len(cultural_editions),
        "inspirations":      len(inspirations),
        "materials":         len(materials),
        "markets":           len(markets),
    }

    # ─ Editorial summary line — concierge tone, not KPI ─
    summary_lines: List[str] = []
    if counts["projects"]:
        summary_lines.append(f"{counts['projects']} progetti tessuti insieme.")
    if counts["moodboards"]:
        summary_lines.append(f"{counts['moodboards']} moodboard condivise nel tempo.")
    if counts["cultural_editions"]:
        summary_lines.append(f"{counts['cultural_editions']} Cultural Editions™ avviate.")
    if counts["markets"] >= 2:
        summary_lines.append("Relazione internazionale — vive in più mercati.")
    if counts["materials"] >= 3:
        summary_lines.append("Mostra una grammatica materica chiara.")
    if not summary_lines:
        summary_lines.append("La relazione è ancora un foglio bianco — il primo gesto la inizierà.")

    return {
        "account_id":        account_id,
        "counts":            counts,
        "projects":          projects,
        "moodboards":        moodboards,
        "cultural_editions": cultural_editions,
        "inspirations":      inspirations,
        "materials":         materials,
        "markets":           markets,
        "recent_signals":    recent_sigs,
        "editorial_summary": summary_lines,
    }


# ─── Cultural Editions foundation endpoint ────────────────────────────
class CulturalEditionIntent(BaseModel):
    source_type:  str = Field(..., description="project | article | moodboard")
    source_id:    str = Field(..., min_length=1)
    target_market_code:    str = Field(..., min_length=2, description="e.g. usa_south_florida")
    target_submarket_code: str = Field(..., min_length=2, description="e.g. miami")
    target_locale:         Optional[str] = "en-US"
    note: Optional[str] = None


@router.post("/accounts/{account_id}/cultural-editions", status_code=201)
def request_cultural_edition(account_id: str, body: CulturalEditionIntent,
                             ctx=Depends(get_tenant_context)):
    """Foundation: records the intent on the timeline + returns the
    submarket cultural profile the editorial studio should use.

    Phase 2 will hand-off to editorial_variants creation."""
    c = db()
    tid = ctx["tenant_id"]
    acc = _row_or_404(c, "accounts", account_id, tid)

    # Fetch the submarket profile so the UI can show what MOOD will adapt.
    sub_rows = (c.table("market_submarkets").select("*")
                .eq("code", body.target_submarket_code).limit(1).execute().data or [])
    if not sub_rows:
        raise HTTPException(404, f"submarket '{body.target_submarket_code}' not found")
    sub = sub_rows[0]

    # Log on the timeline so the relationship history captures the intent.
    iid = str(uuid.uuid4())
    title = f"Create a Cultural Edition™ · {_sub_label(sub) or sub.get('code')}"
    summary_lbl = body.note or (
        "MOOD adatterà tono, ritmo, CTA e narrativa al mercato selezionato."
    )
    c.table("interactions").insert({
        "id":           iid,
        "tenant_id":    tid,
        "account_id":   account_id,
        "interaction_type": "ai_summary",  # nearest existing canonical type
        "occurred_at":  _iso(),
        "title":        title,
        "summary":      summary_lbl,
        "report_payload": {
            "kind":           "cultural_edition_intent",
            "source_type":    body.source_type,
            "source_id":      body.source_id,
            "target_market":  body.target_market_code,
            "target_submarket": body.target_submarket_code,
            "target_locale":  body.target_locale,
            "submarket_snapshot": {
                "name":              _sub_label(sub),
                "code":              sub.get("code"),
                "editorial_profile": sub.get("editorial_profile"),
                "cta_psychology":    sub.get("cta_psychology"),
                "visual_rhythm":     sub.get("visual_rhythm"),
                "luxury_profile":    sub.get("luxury_profile"),
            },
        },
        "is_automatic": False,
        "created_by":   ctx.get("profile_id"),
        "created_at":   _iso(),
    }).execute()

    # Touch account
    c.table("accounts").update({
        "last_activity_at": _iso(), "updated_at": _iso(),
    }).eq("id", account_id).eq("tenant_id", tid).execute()

    return {
        "ok":       True,
        "intent_id": iid,
        "account":   {"id": acc["id"], "name": acc["account_name"]},
        "submarket": sub,
        "next_step": {
            "where": "editorial_studio",
            "url_hint": "/blueprint/editorial",
            "params": {
                "submarket": body.target_submarket_code,
                "locale":    body.target_locale,
                "source_type": body.source_type,
                "source_id":   body.source_id,
            },
        },
    }
