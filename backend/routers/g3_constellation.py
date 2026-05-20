"""g3_constellation_extension.py — appended to crm_intelligence at import.

Sprint G.3 · Account = Constellation of Journeys™.

Provides:
  GET /api/relationships/accounts/{aid}/constellation
      Aggregates everything the AccountDetailPage™ needs to render as a
      Design Relationship Workspace (NOT a CRM card):
        • active_journeys[]  with current milestone + lifecycle_state
        • people[] (contacts with roles)
        • memory: aggregated approved palette/materials/inspirations from
          journey artifacts & curated_collections
        • shared_artifacts[]: latest moodboards/proposals via journey_artifacts VIEW
        • insights[]: open journey_health_signals (G.1)
        • relationship_state: derived relational tone (growing|active|trusted|
          dormant|strategic|returning) — NOT a sales pipeline stage.
"""
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List

from fastapi import Depends

from database import db
from core.tenant_context import get_tenant_context
from routers.crm_intelligence import router


MILESTONE_LABEL = {
    "brief":              "Brief Cliente™",
    "inspirations":       "Inspirations Alignment™",
    "moodboard_direction":"Moodboard Direction™",
    "material_direction": "Material Direction™",
    "concept_design":     "Concept Design™",
    "technical_package":  "Technical Package™",
    "curated_selections": "Curated Selections™",
    "site_evolution":     "Site Evolution™",
    "final_presentation": "Final Presentation™",
    "certified_closure":  "Certified Closure™",
}

LIFECYCLE_TONE = {
    "conversation_open": "growing",
    "in_progress":       "active",
    "presenting":        "active",
    "drifting":          "dormant",
    "on_pause":          "dormant",
    "approved":          "trusted",
    "closed":            "trusted",
    "editioned":         "strategic",
    "abandoned":         "dormant",
}


def _derive_relationship_state(journeys: List[Dict[str, Any]],
                               last_activity_iso: str | None,
                               total_journeys: int) -> str:
    """Editorial relational tone — NOT a sales stage.

    growing   · sta nascendo (conversation_open or very young)
    active    · in pieno dialogo
    trusted   · viaggi conclusi positivamente
    dormant   · silenzio prolungato o pausa
    strategic · più di un Journey concluso, edition generata
    returning · ha ricominciato dopo dormienza
    """
    if not journeys:
        return "growing"

    tones = [LIFECYCLE_TONE.get(j.get("lifecycle_state") or "in_progress",
                                 "active") for j in journeys]

    if "strategic" in tones:
        return "strategic"

    closed_count = sum(1 for t in tones if t == "trusted")
    open_count   = sum(1 for t in tones if t in ("active","growing"))

    if closed_count >= 2 and open_count >= 1:
        return "returning"
    if closed_count >= 2:
        return "trusted"

    if last_activity_iso:
        try:
            d = datetime.fromisoformat(last_activity_iso.replace("Z","+00:00"))
            silence_days = (datetime.now(timezone.utc) - d).days
            if silence_days > 45 and open_count == 0:
                return "dormant"
        except Exception:
            pass

    if "active" in tones:
        return "active"
    return "growing"


@router.get("/accounts/{account_id}/constellation")
def constellation(account_id: str, ctx=Depends(get_tenant_context)):
    c   = db()
    tid = ctx["tenant_id"]

    acc = (c.table("accounts").select("*").eq("id", account_id)
           .eq("tenant_id", tid).limit(1).execute().data or [])
    if not acc:
        from fastapi import HTTPException
        raise HTTPException(404, "Account non trovato")
    account = acc[0]

    # ── ACTIVE JOURNEYS ────────────────────────────────────────────
    jrows = (c.table("design_journeys").select("*")
             .eq("account_id", account_id).eq("tenant_id", tid)
             .order("started_at", desc=True).execute().data or [])

    journey_ids = [j["id"] for j in jrows]
    milestones_by_journey: Dict[str, List[Dict[str, Any]]] = {}
    last_events_by_journey: Dict[str, Dict[str, Any]] = {}
    if journey_ids:
        ms = (c.table("journey_milestones")
              .select("id,journey_id,milestone_type,title,status,order_index,started_at,updated_at")
              .in_("journey_id", journey_ids).execute().data or [])
        for m in ms:
            milestones_by_journey.setdefault(m["journey_id"], []).append(m)
        # sort by order_index
        for jid, lst in milestones_by_journey.items():
            lst.sort(key=lambda x: x.get("order_index") or 0)

        evs = (c.table("journey_timeline_events")
               .select("journey_id,event_canon,event_type,narrative_text,created_at")
               .in_("journey_id", journey_ids)
               .order("created_at", desc=True).execute().data or [])
        for e in evs:
            last_events_by_journey.setdefault(e["journey_id"], e)

    journeys_out: List[Dict[str, Any]] = []
    for j in jrows:
        ms_list = milestones_by_journey.get(j["id"], [])
        current = next((m for m in ms_list if m["status"] == "in_progress"), None) \
                  or next((m for m in ms_list if m["status"] == "not_started"), None) \
                  or (ms_list[-1] if ms_list else None)
        completed = sum(1 for m in ms_list if m["status"] in ("approved","closed"))
        progress  = round(completed / len(ms_list) * 100) if ms_list else 0
        last_evt  = last_events_by_journey.get(j["id"])
        journeys_out.append({
            "id":              j["id"],
            "project_id":      j["project_id"],
            "lifecycle_state": j.get("lifecycle_state") or j.get("overall_status"),
            "started_at":      j.get("started_at"),
            "current_milestone": current and {
                "id":    current["id"],
                "type":  current["milestone_type"],
                "label": MILESTONE_LABEL.get(current["milestone_type"], current["milestone_type"]),
                "status":current["status"],
            },
            "progress":        progress,
            "milestones_total": len(ms_list),
            "milestones_done":  completed,
            "last_event":      last_evt and {
                "canon":  last_evt.get("event_canon"),
                "text":   last_evt.get("narrative_text"),
                "when":   last_evt.get("created_at"),
            },
        })

    # ── PEOPLE & STAKEHOLDERS ──────────────────────────────────────
    contacts = (c.table("contacts").select("*")
                .eq("account_id", account_id).eq("tenant_id", tid)
                .execute().data or [])
    people = [{
        "id":            ct["id"],
        "first_name":    ct.get("first_name"),
        "last_name":     ct.get("last_name"),
        "role":          ct.get("role"),
        "email":         ct.get("email"),
        "phone":         ct.get("phone"),
        "primary":       bool(ct.get("primary_contact")),
        "involvement":   ct.get("involvement_level") or ("decisore" if ct.get("primary_contact") else "collaboratore"),
        "lifecycle":     ct.get("lifecycle_stage"),
    } for ct in contacts]

    # ── SHARED ARTIFACTS (via journey_artifacts VIEW from G.1) ─────
    artifacts: List[Dict[str, Any]] = []
    if journey_ids:
        try:
            arows = (c.table("journey_artifacts").select(
                        "journey_id,milestone_id,artifact_type,artifact_id,title,status,created_at"
                     ).in_("journey_id", journey_ids)
                     .order("created_at", desc=True).limit(30).execute().data or [])
            artifacts = arows
        except Exception:
            artifacts = []

    # ── PROJECT MEMORY (aggregated palettes/materials/inspirations) ─
    # Derived from project metadata + curated_collections + recent
    # approved milestones. Best-effort: never throw.
    memory = {
        "approved_palettes": [],
        "preferred_materials": [],
        "saved_inspirations_count": 0,
        "favorite_brands": [],
        "rationales": [],
    }
    try:
        if journey_ids:
            # Aggregate atmosphere/lifestyle from project metadata
            project_ids = [j["project_id"] for j in jrows]
            pjs = (c.table("projects").select("metadata_json")
                   .in_("id", project_ids).execute().data or [])
            seen_materials = set()
            for pj in pjs:
                meta = (pj.get("metadata_json") or {}) or {}
                ls = meta.get("lifestyle") or {}
                for m in (ls.get("materials") or []):
                    if m and m.lower() not in seen_materials:
                        seen_materials.add(m.lower())
                        memory["preferred_materials"].append(m)

            # Rationales from approved milestone versions
            ms_ids = [m["id"] for m in milestones_by_journey.get(jrows[0]["id"], [])] if jrows else []
            if ms_ids:
                vers = (c.table("milestone_versions")
                        .select("chapter_kind,title,rationale,created_at")
                        .in_("milestone_id", ms_ids)
                        .order("created_at", desc=True).limit(6)
                        .execute().data or [])
                memory["rationales"] = [{
                    "kind":      v["chapter_kind"],
                    "title":     v.get("title"),
                    "rationale": v.get("rationale"),
                    "when":      v.get("created_at"),
                } for v in vers]

            # Curated collections linked to these journeys
            cc = (c.table("curated_collections").select("id,title,visibility")
                  .in_("journey_id", journey_ids).limit(10).execute().data or [])
            memory["saved_inspirations_count"] = len(cc)
    except Exception:
        pass

    # ── RELATIONSHIP INSIGHTS (journey_health_signals from G.1) ────
    insights: List[Dict[str, Any]] = []
    if journey_ids:
        try:
            sigs = (c.table("journey_health_signals").select("*")
                    .in_("journey_id", journey_ids)
                    .is_("resolved_at", "null")
                    .order("observed_at", desc=True).limit(10)
                    .execute().data or [])
            for s in sigs:
                insights.append({
                    "journey_id":  s["journey_id"],
                    "kind":        s["signal_kind"],
                    "severity":    s["severity"],
                    "observed_at": s["observed_at"],
                    "note":        _signal_phrase(s["signal_kind"]),
                })
        except Exception:
            pass

    # ── RELATIONSHIP STATE (editorial tone) ────────────────────────
    last_activity = None
    for ev in last_events_by_journey.values():
        ts = ev.get("created_at")
        if not last_activity or (ts and ts > last_activity):
            last_activity = ts
    rel_state = _derive_relationship_state(jrows, last_activity, len(jrows))

    # ── HERO bundle ────────────────────────────────────────────────
    primary = next((p for p in people if p["primary"]), people[0] if people else None)
    hero = {
        "account_name":    account.get("account_name"),
        "account_type":    account.get("account_type"),
        "relationship_state": rel_state,
        "active_journeys": sum(1 for j in journeys_out
                                if (j["lifecycle_state"] or "") not in ("closed","abandoned","editioned")),
        "total_journeys":  len(journeys_out),
        "locations":       account.get("country") or account.get("city"),
        "language":        account.get("language") or "it",
        "since":           account.get("created_at"),
        "primary_contact": primary,
        "last_activity":   last_activity,
    }

    return {
        "hero":              hero,
        "active_journeys":   journeys_out,
        "people":            people,
        "memory":            memory,
        "shared_artifacts":  artifacts,
        "insights":          insights,
        "lexicon": {
            "relationship_state_label": {
                "growing":   "In crescita",
                "active":    "Attiva",
                "trusted":   "Di fiducia",
                "dormant":   "In silenzio",
                "strategic": "Strategica",
                "returning": "Tornata",
            },
            "lifecycle_label": {
                "conversation_open": "Conversazione aperta",
                "in_progress":       "Viaggio in corso",
                "presenting":        "Direzione presentata",
                "drifting":          "In ascolto",
                "on_pause":          "In pausa",
                "approved":          "Direzione approvata",
                "closed":            "Capitolo chiuso",
                "editioned":         "Edizione culturale",
                "abandoned":         "Viaggio sospeso",
            },
        },
    }


def _signal_phrase(kind: str) -> str:
    return {
        "drift_warning":    "Una conversazione attende una nuova voce.",
        "silence_alert":    "La direzione presentata è in attesa di riscontro.",
        "reorient_overdue": "Una nuova evoluzione è da proporre.",
        "bridge_pause":     "Tra un capitolo e l'altro, una pausa.",
    }.get(kind, "Un segnale dal viaggio.")
