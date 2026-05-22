"""Sprint G.4 · Journey Pulse™ — il ritmo progettuale dello studio.

NON è analytics. NON è KPI. NON è BI.
È la dashboard editoriale che riflette dove si trova lo studio
in questo momento dentro i propri Design Journey.

Sprint JOURNEY-TAXONOMY-I18N (iter118): labels now resolved via the
editorial taxonomy registry — accepts `?locale=` to render in the active
language. Backward compatible: default locale = 'it' keeps legacy behavior.
"""
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from collections import defaultdict

from fastapi import APIRouter, Depends, Query

from database import db
from core.tenant_context import get_tenant_context
from routers.milestone_dialogue import FEEDBACK_LABEL, FEEDBACK_TONE
from taxonomy import resolve as resolve_taxonomy

router = APIRouter(prefix="/dashboard", tags=["dashboard-pulse"])

# Maps backend `milestone_type` (technical enum) to a taxonomy.journey_milestone
# key. Centralised here so the editorial layer is the single source of labels.
MILESTONE_TYPE_TO_TAXONOMY_KEY = {
    "brief":              "client_brief",
    "inspirations":       "inspirations_alignment",
    "moodboard_direction":"moodboard_direction",
    "material_direction": "material_direction",
}

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
LIFECYCLE_LABEL = {
    "conversation_open": "Conversazione aperta",
    "in_progress":       "Viaggio in corso",
    "presenting":        "Direzione presentata",
    "drifting":          "In ascolto",
    "on_pause":          "In pausa",
    "approved":          "Direzione approvata",
    "closed":            "Capitolo chiuso",
    "editioned":         "Edizione culturale",
    "abandoned":         "Viaggio sospeso",
}


def _label_for(m_type: str, locale: str = "it") -> str:
    """Editorial label for a milestone_type. Prefers the taxonomy registry
    when the milestone_type maps to a taxonomy key; falls back to the
    legacy IT-only dictionary for milestones not yet in the registry."""
    tax_key = MILESTONE_TYPE_TO_TAXONOMY_KEY.get(m_type)
    if tax_key:
        return resolve_taxonomy("journey_milestone", tax_key, locale,
                                fallback=MILESTONE_LABEL.get(m_type, m_type))
    return MILESTONE_LABEL.get(m_type, m_type or "Pietra miliare")


def _lifecycle_label_for(lifecycle: str, locale: str = "it") -> str:
    """Editorial label for a journey lifecycle. Always goes through the
    taxonomy registry (studio narration variant)."""
    return resolve_taxonomy(
        "journey_lifecycle_studio", lifecycle, locale,
        fallback=LIFECYCLE_LABEL.get(lifecycle, "Viaggio in corso"),
    )


def _days_since(iso: str | None) -> int | None:
    if not iso: return None
    try:
        dt = datetime.fromisoformat(iso.replace("Z","+00:00"))
        return (datetime.now(timezone.utc) - dt).days
    except Exception:
        return None


def _voice_phrase(kind: str | None) -> str:
    return FEEDBACK_LABEL.get(kind or "", "Una voce è arrivata")


def _suggested_action(milestone_type: str, lifecycle: str, locale: str = "it") -> str:
    base = _label_for(milestone_type, locale)
    if lifecycle == "conversation_open":
        return f"Apri il dialogo · {base}"
    if lifecycle == "presenting":
        return f"Ascolta una voce su · {base}"
    if lifecycle == "drifting":
        return f"Riprendi la conversazione · {base}"
    if lifecycle == "on_pause":
        return f"Quando vorrai · {base}"
    return f"Continua da · {base}"


@router.get("/pulse")
def pulse(
    ctx: dict = Depends(get_tenant_context),
    locale: str = Query("it", description="Editorial taxonomy locale (it/en-US/...)"),
):
    c   = db()
    tid = ctx["tenant_id"]
    now = datetime.now(timezone.utc)
    today_start = (now - timedelta(hours=24)).isoformat()
    week_start  = (now - timedelta(days=7)).isoformat()

    # ── 1 · ACTIVE JOURNEYS (single query) ────────────────────────
    jrows = (c.table("design_journeys").select("*")
             .eq("tenant_id", tid)
             .not_.in_("lifecycle_state", ["closed", "abandoned"])
             .order("started_at", desc=True).limit(50)
             .execute().data or [])
    journey_ids   = [j["id"] for j in jrows]
    journey_pids  = {j["id"]: j["project_id"] for j in jrows}
    journey_state = {j["id"]: (j.get("lifecycle_state") or "in_progress") for j in jrows}

    # ── Bulk fetch milestones for all journeys ────────────────────
    milestones_by: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    all_milestone_ids: List[str] = []
    milestone_meta: Dict[str, Dict[str, Any]] = {}
    if journey_ids:
        ms = (c.table("journey_milestones")
              .select("id,journey_id,milestone_type,title,status,order_index")
              .in_("journey_id", journey_ids).execute().data or [])
        for m in ms:
            milestones_by[m["journey_id"]].append(m)
            all_milestone_ids.append(m["id"])
            milestone_meta[m["id"]] = m
        for jid in milestones_by:
            milestones_by[jid].sort(key=lambda x: x.get("order_index") or 0)

    # ── Bulk fetch all timeline events for these journeys ─────────
    last_event_by_journey: Dict[str, Dict[str, Any]] = {}
    if journey_ids:
        evs = (c.table("journey_timeline_events")
               .select("journey_id,event_canon,event_type,narrative_text,created_at")
               .in_("journey_id", journey_ids)
               .order("created_at", desc=True).limit(500).execute().data or [])
        for e in evs:
            last_event_by_journey.setdefault(e["journey_id"], e)

    # ── Bulk accounts lookup ──────────────────────────────────────
    account_ids = [j.get("account_id") for j in jrows if j.get("account_id")]
    accounts_by_id: Dict[str, str] = {}
    if account_ids:
        accs = (c.table("accounts").select("id,account_name")
                .in_("id", account_ids).execute().data or [])
        accounts_by_id = {a["id"]: a.get("account_name") for a in accs}

    def account_name_for_journey(jid: str) -> str:
        j = next((x for x in jrows if x["id"] == jid), None)
        if not j: return "—"
        return accounts_by_id.get(j.get("account_id") or "") or "—"

    # ── Bulk fetch all versions for these milestones ──────────────
    versions_by_milestone: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    all_versions: List[Dict[str, Any]] = []
    if all_milestone_ids:
        vs = (c.table("milestone_versions").select("*")
              .in_("milestone_id", all_milestone_ids)
              .order("created_at", desc=True).limit(500)
              .execute().data or [])
        for v in vs:
            versions_by_milestone[v["milestone_id"]].append(v)
            all_versions.append(v)

    # ── Bulk fetch all feedback for these milestones ──────────────
    feedback_by_milestone: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    all_feedback: List[Dict[str, Any]] = []
    if all_milestone_ids:
        fbs = (c.table("milestone_feedback").select("*")
               .in_("milestone_id", all_milestone_ids)
               .order("created_at", desc=True).limit(500)
               .execute().data or [])
        for f in fbs:
            feedback_by_milestone[f["milestone_id"]].append(f)
            all_feedback.append(f)

    # ── Build active_journeys + silent_journeys + next_actions ────
    active_journeys: List[Dict[str, Any]] = []
    silent_journeys: List[Dict[str, Any]] = []
    next_actions: List[Dict[str, Any]] = []
    for j in jrows:
        ms_list = milestones_by.get(j["id"], [])
        current = (next((m for m in ms_list if m["status"] == "in_progress"), None)
                   or next((m for m in ms_list if m["status"] == "not_started"), None)
                   or (ms_list[-1] if ms_list else None))
        completed = sum(1 for m in ms_list if m["status"] in ("approved","closed"))
        progress  = round(completed / len(ms_list) * 100) if ms_list else 0
        last_evt  = last_event_by_journey.get(j["id"])
        last_iso  = (last_evt or {}).get("created_at") or j.get("started_at")
        days_silent = _days_since(last_iso)
        lifecycle = j.get("lifecycle_state") or j.get("overall_status") or "in_progress"

        entry = {
            "journey_id":      j["id"],
            "project_id":      j["project_id"],
            "account_name":    accounts_by_id.get(j.get("account_id") or "") or "—",
            "lifecycle_state": lifecycle,
            "lifecycle_key":   lifecycle,  # taxonomy.journey_lifecycle_studio.{key}
            "lifecycle_label": _lifecycle_label_for(lifecycle, locale),
            "current_milestone": current and {
                "id":     current["id"],
                "type":   current["milestone_type"],
                "taxonomy_key": MILESTONE_TYPE_TO_TAXONOMY_KEY.get(current["milestone_type"]),
                "label":  _label_for(current["milestone_type"], locale),
                "status": current["status"],
                "status_key": current["status"],  # taxonomy.step_status.{key}
            },
            "progress":         progress,
            "milestones_done":  completed,
            "milestones_total": len(ms_list),
            "last_event":       last_evt and {
                "canon": last_evt.get("event_canon"),
                "text":  last_evt.get("narrative_text"),
                "when":  last_evt.get("created_at"),
            },
            "days_silent": days_silent,
        }
        active_journeys.append(entry)

        if days_silent is not None and days_silent >= 14:
            silent_journeys.append({
                **entry,
                "silence_phrase": f"Nessuna nuova voce da {days_silent} giorni",
            })

        if current:
            next_actions.append({
                "journey_id":  j["id"],
                "project_id":  j["project_id"],
                "account":     entry["account_name"],
                "milestone":   _label_for(current["milestone_type"], locale),
                "suggestion":  _suggested_action(current["milestone_type"], lifecycle, locale),
            })

    # ── 2 · VOICES TODAY ─────────────────────────────────────────
    voices_today: List[Dict[str, Any]] = []
    for f in all_feedback:
        if f.get("created_at", "") < today_start:
            continue
        m = milestone_meta.get(f["milestone_id"])
        if not m:
            continue
        jid = m["journey_id"]
        kind = f.get("kind") or ""
        voices_today.append({
            "feedback_id":  f["id"],
            "journey_id":   jid,
            "project_id":   journey_pids.get(jid),
            "account":      account_name_for_journey(jid),
            "milestone":    _label_for(m["milestone_type"], locale),
            "voice_phrase": _voice_phrase(kind),
            "tone":         FEEDBACK_TONE.get(kind, "voice"),
            "quote":        (f.get("quote") or "")[:200],
            "when":         f.get("created_at"),
        })
    voices_today.sort(key=lambda v: v.get("when") or "", reverse=True)
    voices_today = voices_today[:30]

    # ── 3 · CHAPTERS WAITING (version exists, no later feedback) ──
    chapters_waiting: List[Dict[str, Any]] = []
    for mid, vlist in versions_by_milestone.items():
        m = milestone_meta.get(mid)
        if not m or m["status"] in ("closed","approved"):
            continue
        last_chap = vlist[0]   # already sorted desc
        chap_when = last_chap["created_at"]
        last_fb = feedback_by_milestone.get(mid, [])
        if last_fb and last_fb[0]["created_at"] > chap_when:
            continue
        wait_days = _days_since(chap_when)
        if wait_days is None or wait_days < 1:
            continue
        jid = m["journey_id"]
        chapters_waiting.append({
            "journey_id":    jid,
            "project_id":    journey_pids.get(jid),
            "account":       account_name_for_journey(jid),
            "milestone":     _label_for(m["milestone_type"], locale),
            "chapter_title": last_chap.get("title") or "Capitolo",
            "since_days":    wait_days,
            "presented_at":  chap_when,
        })
    chapters_waiting.sort(key=lambda c: c.get("since_days") or 0, reverse=True)

    # ── 4 · REVISIONS OPEN (reorient feedback, no later version) ──
    revisions_open: List[Dict[str, Any]] = []
    reorient_kinds = {k for k, t in FEEDBACK_TONE.items() if t == "reorient"}
    for f in all_feedback:
        if (f.get("kind") or "") not in reorient_kinds:
            continue
        mid = f["milestone_id"]
        # is there a newer version?
        vlist = versions_by_milestone.get(mid, [])
        if vlist and vlist[0]["created_at"] > f["created_at"]:
            continue
        m = milestone_meta.get(mid)
        if not m:
            continue
        jid = m["journey_id"]
        kind = f.get("kind") or ""
        revisions_open.append({
            "feedback_id":  f["id"],
            "journey_id":   jid,
            "project_id":   journey_pids.get(jid),
            "account":      account_name_for_journey(jid),
            "milestone":    _label_for(m["milestone_type"], locale),
            "voice_phrase": _voice_phrase(kind),
            "quote":        (f.get("quote") or "")[:200],
            "when":         f.get("created_at"),
        })
    revisions_open.sort(key=lambda r: r.get("when") or "", reverse=True)
    revisions_open = revisions_open[:20]

    # ── 5 · RECENT EVOLUTIONS (chapters in last 7d) ───────────────
    recent_evolutions: List[Dict[str, Any]] = []
    for v in all_versions:
        if (v.get("created_at") or "") < week_start:
            continue
        m = milestone_meta.get(v["milestone_id"])
        if not m:
            continue
        jid = m["journey_id"]
        recent_evolutions.append({
            "version_id":  v["id"],
            "journey_id":  jid,
            "project_id":  journey_pids.get(jid),
            "account":     account_name_for_journey(jid),
            "milestone":   _label_for(m["milestone_type"], locale),
            "chapter":     v.get("title") or "Capitolo",
            "chapter_kind": v.get("chapter_kind"),
            "when":        v.get("created_at"),
        })
    recent_evolutions.sort(key=lambda r: r.get("when") or "", reverse=True)
    recent_evolutions = recent_evolutions[:20]

    # ── 7 · NEXT ACTIONS — prioritise journeys that need attention ─
    priority_jids = (
        [c["journey_id"] for c in chapters_waiting] +
        [r["journey_id"] for r in revisions_open] +
        [s["journey_id"] for s in silent_journeys]
    )
    seen = set()
    deduped_actions = []
    for jid in priority_jids:
        if jid in seen:
            continue
        seen.add(jid)
        match = next((a for a in next_actions if a["journey_id"] == jid), None)
        if match:
            deduped_actions.append(match)
    for a in next_actions:
        if a["journey_id"] in seen:
            continue
        seen.add(a["journey_id"])
        deduped_actions.append(a)
    deduped_actions = deduped_actions[:8]

    # ITER132 · ALE-on-read · translate the narrative fields of every
    # presence-stream entry when the dashboard is rendered in a non-IT
    # locale. Translations are cached via TM so subsequent loads are fast.
    try:
        from services.editorial_translation_layer import (
            localize_records as _ale_localize_records,
            normalize_locale as _ale_norm,
        )
        ale_target = _ale_norm(locale)
        if ale_target and ale_target != 'it':
            active_journeys   = _ale_localize_records(active_journeys,
                                  fields=('title', 'subtitle'),
                                  target_locale=ale_target, tenant_id=tid,
                                  surface='journey_pulse_journey')
            voices_today      = _ale_localize_records(voices_today,
                                  fields=('text', 'subtitle'),
                                  target_locale=ale_target, tenant_id=tid,
                                  surface='journey_pulse_voice')
            chapters_waiting  = _ale_localize_records(chapters_waiting,
                                  fields=('title', 'subtitle'),
                                  target_locale=ale_target, tenant_id=tid,
                                  surface='journey_pulse_chapter')
            revisions_open    = _ale_localize_records(revisions_open,
                                  fields=('text', 'subtitle'),
                                  target_locale=ale_target, tenant_id=tid,
                                  surface='journey_pulse_revision')
            recent_evolutions = _ale_localize_records(recent_evolutions,
                                  fields=('text', 'subtitle'),
                                  target_locale=ale_target, tenant_id=tid,
                                  surface='journey_pulse_evolution')
            deduped_actions   = _ale_localize_records(deduped_actions,
                                  fields=('label', 'subtitle'),
                                  target_locale=ale_target, tenant_id=tid,
                                  surface='journey_pulse_action')
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("ALE pulse skipped: %s", e)

    return {
        "active_journeys":   active_journeys,
        "voices_today":      voices_today,
        "chapters_waiting":  chapters_waiting,
        "revisions_open":    revisions_open,
        "recent_evolutions": recent_evolutions,
        "silent_journeys":   silent_journeys[:10],
        "next_actions":      deduped_actions,
        "counts": {
            "active":            len(active_journeys),
            "voices_today":      len(voices_today),
            "chapters_waiting":  len(chapters_waiting),
            "revisions_open":    len(revisions_open),
            "recent_evolutions": len(recent_evolutions),
            "silent":            len(silent_journeys),
        },
        "studio_label":  ctx.get("tenant_name") or "Lo Studio",
        "current_time":  now.isoformat(),
    }
