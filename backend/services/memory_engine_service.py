"""ITER148 · Sprint B · Relationship Memory™ Engine.

Aggregates raw signals (leads, accounts, relationship_answer_events) and
TRANSFORMS them into editorial memory chapters — NOT a CRM activity feed.

Each chapter contains:
  · title (Early Signals · Atmosphere Alignment · Material Direction
    Emerging · Concept Consolidation · Project Momentum)
  · short editorial intro (curator voice)
  · narrative cards (each card is one transformed moment in the
    relationship — never a raw event description)

The transformer NEVER emits literal sentences like "Lead answered
question 4". It writes in curator voice:

    "The client continues to gravitate toward tactile natural
     materials and slower hospitality-inspired atmospheres."

Memory is intentionally synthesized from data — there is no
`relationship_memory_events` table. This service is the source of truth
for the editorial timeline.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any

from database import db, db_available

# ─── narrative dictionaries ─────────────────────────────────────────────
# Editorial copy library for atmospheres / materials / cultural registers.
# Keep poetic, lowercase, no exclamation marks. ALL strings reviewed for
# brand tone — never reads like CRM telemetry.

_ATMOSPHERE_NARRATIVES = {
    "warm_enveloping":    "warm enveloping atmospheres — slow, tactile, hospitable",
    "minimal_silent":     "minimal silent rooms — light as the dominant material",
    "editorial_luxury":   "editorial luxury — composed, architectural, restrained",
    "natural_calm":       "natural calm — stone, wood, breath of countryside",
    "hospitality_inspired": "hospitality-inspired hush — refined, ceremonial",
    "artistic_eclectic":  "artistic eclectic — curated rather than coordinated",
    "soft_contemporary":  "soft contemporary — modern without coldness",
    "serene":             "serene continuity — quiet rhythm over statement",
    "calm":               "calm interiors — a long exhale held in matter",
    "warm_editorial":     "warm editorial — printed-page composure, soft light",
    "nordic_silence":     "Nordic silence — pale, unhurried, considered",
    "midnight_mood":      "midnight mood — depth, velvet, low key",
    "mediterranean_light":"Mediterranean light — washed white, terracotta, sun",
    "architectural_dawn": "architectural dawn — early light on raw geometry",
}

_MATERIAL_NARRATIVES = {
    "natural_stone":     "natural stone",
    "warm_wood":         "warm wood",
    "linen_textiles":    "linen textiles",
    "venetian_plaster":  "venetian plaster",
    "brushed_brass":     "brushed brass",
    "honed_marble":      "honed marble",
    "rough_concrete":    "rough concrete",
    "smoked_oak":        "smoked oak",
    "alabaster":         "alabaster",
    "raw_cotton":        "raw cotton",
}

_REGISTER_NARRATIVES = {
    "editorial":    "an editorial register — printed-page composure",
    "concierge":    "a concierge register — quiet attention, refined service",
    "consultative": "a consultative register — slow, deliberate questions first",
    "discovery":    "a discovery register — open, listening, gathering",
}

_TIER_NARRATIVES = {
    "atelier":       "atelier-level intent — bespoke, considered, no hurry",
    "couture":       "couture-level intent — refined, custom, restrained",
    "pret_a_porter": "prêt-à-porter intent — curated but resolved",
    "exploratory":   "exploratory intent — still finding its center",
}


def _human_atmosphere(v: str) -> str:
    return _ATMOSPHERE_NARRATIVES.get(v, str(v).replace('_', ' '))


def _human_material(v: str) -> str:
    return _MATERIAL_NARRATIVES.get(v, str(v).replace('_', ' '))


# ─── chapter ordering & assignment ──────────────────────────────────────
CHAPTER_ORDER = [
    ("early_signals",          "Early Signals"),
    ("atmosphere_alignment",   "Atmosphere Alignment"),
    ("material_direction",     "Material Direction Emerging"),
    ("concept_consolidation",  "Concept Consolidation"),
    ("project_momentum",       "Project Momentum"),
]

CHAPTER_INTROS = {
    "early_signals":         "The first whispers — what the relationship is asking for, before it has the words.",
    "atmosphere_alignment":  "The relationship begins to recognise its own register — atmospheres settle into a recurring voice.",
    "material_direction":    "Materials start to take shape — a palette emerges from the conversation.",
    "concept_consolidation": "Direction firms. Decisions cluster. The project finds its centre of gravity.",
    "project_momentum":      "The studio and the client move together — invitations, proposals, alignment moments.",
}


def _chapter_for_event(ev: dict[str, Any], lead: dict[str, Any], chapter_hint: str | None = None) -> str:
    """Decide which chapter an event belongs to."""
    if chapter_hint:
        return chapter_hint
    group_key = (ev.get("group_key") or "").lower()
    surface = (ev.get("source_surface") or "").lower()
    if group_key == "atmosphere":
        return "atmosphere_alignment"
    if group_key in ("materials", "material"):
        return "material_direction"
    if group_key in ("lifestyle", "project_timing"):
        return "concept_consolidation"
    if group_key in ("budget_range", "luxury_tier"):
        return "concept_consolidation"
    if surface in ("moodboard", "proposal_share", "designer_message"):
        return "project_momentum"
    return "early_signals"


def _format_when(iso: str | None) -> str:
    if not iso:
        return "in the studio's memory"
    try:
        when = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except Exception:
        return "in the studio's memory"
    delta = datetime.now(timezone.utc) - when
    days = delta.days
    if days <= 0:
        return "earlier today"
    if days == 1:
        return "yesterday"
    if days < 7:
        return f"{days} days ago"
    if days < 30:
        weeks = days // 7
        return f"{weeks} week{'s' if weeks != 1 else ''} ago"
    if days < 365:
        months = days // 30
        return f"{months} month{'s' if months != 1 else ''} ago"
    return "earlier in the relationship"


# ─── narrative card builders ────────────────────────────────────────────
def _card_atmosphere_event(ev: dict, lead: dict) -> dict:
    val = ev.get("option_value") or "—"
    narrative = _human_atmosphere(val)
    return {
        "kind":          "atmosphere_shift",
        "narrative":     f"The client moved toward {narrative}.",
        "atmosphere":    val,
        "materials":     [],
        "when_label":    _format_when(ev.get("occurred_at")),
        "occurred_at":   ev.get("occurred_at"),
        "source_surface": ev.get("source_surface"),
    }


def _card_material_event(ev: dict, lead: dict) -> dict:
    val = ev.get("option_value") or "—"
    narrative = _human_material(val)
    return {
        "kind":          "material_signal",
        "narrative":     f"A material instinct surfaced — {narrative} entered the palette.",
        "atmosphere":    None,
        "materials":     [val],
        "when_label":    _format_when(ev.get("occurred_at")),
        "occurred_at":   ev.get("occurred_at"),
        "source_surface": ev.get("source_surface"),
    }


def _card_lifestyle_event(ev: dict, lead: dict) -> dict:
    val = (ev.get("option_value") or "").replace("_", " ")
    return {
        "kind":          "lifestyle_signal",
        "narrative":     f"The way of living comes into focus — {val} as a recurring rhythm.",
        "atmosphere":    None,
        "materials":     [],
        "when_label":    _format_when(ev.get("occurred_at")),
        "occurred_at":   ev.get("occurred_at"),
        "source_surface": ev.get("source_surface"),
    }


def _card_generic_event(ev: dict, lead: dict) -> dict:
    grp = (ev.get("group_key") or "signal").replace("_", " ")
    val = (ev.get("option_value") or "").replace("_", " ") or "another nuance"
    return {
        "kind":          "interview_signal",
        "narrative":     f"On {grp}, the relationship answered {val}.",
        "atmosphere":    None,
        "materials":     [],
        "when_label":    _format_when(ev.get("occurred_at")),
        "occurred_at":   ev.get("occurred_at"),
        "source_surface": ev.get("source_surface"),
    }


def _card_intake_completed(lead: dict) -> dict:
    return {
        "kind":          "milestone",
        "narrative":     "The first interview closed — the studio now has a register and a direction to listen against.",
        "atmosphere":    (lead.get("atmosphere_signals") or [None])[0],
        "materials":     (lead.get("material_signals") or [])[:3],
        "when_label":    _format_when(lead.get("intake_completed_at")),
        "occurred_at":   lead.get("intake_completed_at"),
        "source_surface": "intake_wizard",
    }


def _card_relationship_opened(lead: dict) -> dict:
    name = (lead.get("first_name") or "") + " " + (lead.get("last_name") or "")
    name = name.strip() or lead.get("email") or "A new friend"
    locale = (lead.get("locale_code") or "—").upper()
    return {
        "kind":          "milestone",
        "narrative":     f"A relationship opened with {name} — first contact from {locale}, registered into the studio's memory.",
        "atmosphere":    None,
        "materials":     [],
        "when_label":    _format_when(lead.get("created_at")),
        "occurred_at":   lead.get("created_at"),
        "source_surface": "begin_journey",
    }


def _build_event_card(ev: dict, lead: dict) -> dict:
    group = (ev.get("group_key") or "").lower()
    if group == "atmosphere":
        return _card_atmosphere_event(ev, lead)
    if group in ("materials", "material"):
        return _card_material_event(ev, lead)
    if group == "lifestyle":
        return _card_lifestyle_event(ev, lead)
    return _card_generic_event(ev, lead)


# ─── intelligence panel (right column) ──────────────────────────────────
def _intelligence_panel(lead: dict, events: list[dict]) -> dict:
    atmos = (lead.get("atmosphere_signals") or [])[:]
    materials = (lead.get("material_signals") or [])[:]
    # Augment with answer events
    for ev in events:
        if (ev.get("group_key") or "").lower() == "atmosphere" and ev.get("option_value"):
            atmos.append(ev["option_value"])
        if (ev.get("group_key") or "").lower() in ("materials", "material") and ev.get("option_value"):
            materials.append(ev["option_value"])

    atmos_counts = Counter(atmos)
    mat_counts = Counter(materials)

    recurring_atmospheres = [
        {"value": v, "label": _human_atmosphere(v), "weight": n}
        for v, n in atmos_counts.most_common(4)
    ]
    dominant_materials = [
        {"value": v, "label": _human_material(v), "weight": n}
        for v, n in mat_counts.most_common(5)
    ]

    temp = float(lead.get("relationship_temperature") or 0.0)
    score = float(lead.get("progression_score") or 0.0)
    if score >= 0.85 or temp >= 0.85:
        warmth = {"label": "Arrived", "lede": "the relationship is in full conversation — moments arrive at the threshold."}
    elif score >= 0.6 or temp >= 0.65:
        warmth = {"label": "Engaged", "lede": "the dialogue is settling into rhythm — recognisable atmospheres are emerging."}
    elif score >= 0.3 or temp >= 0.35:
        warmth = {"label": "Listening", "lede": "the studio is listening closely — first signals are clustering."}
    else:
        warmth = {"label": "Just Opened", "lede": "the relationship is just opening — early whispers, no firm direction yet."}

    register = lead.get("cultural_register")
    tier = lead.get("luxury_perception_tier")
    alignment_lines = []
    if register:
        alignment_lines.append(_REGISTER_NARRATIVES.get(register, f"a {register} register"))
    if tier:
        alignment_lines.append(_TIER_NARRATIVES.get(tier, f"{tier.replace('_', ' ')} intent"))
    if not alignment_lines:
        alignment_lines.append("register and tier still forming — the relationship has not yet declared its voice.")

    return {
        "warmth":                warmth,
        "recurring_atmospheres": recurring_atmospheres,
        "dominant_materials":    dominant_materials,
        "alignment":             alignment_lines,
    }


# ─── chapter assembler ──────────────────────────────────────────────────
def _empty_chapter(key: str, title: str) -> dict:
    return {
        "key":   key,
        "title": title,
        "intro": CHAPTER_INTROS.get(key, ""),
        "cards": [],
        "atmospheres": [],
        "materials":   [],
    }


def build_memory_for_lead(tenant_id: str, lead_id: str) -> dict:
    """Build the full editorial memory payload for a lead-or-prospect subject."""
    client = db()
    res = (client.table('leads').select(
        'id, first_name, last_name, email, locale_code, lead_type, '
        'progression_state, progression_score, relationship_temperature, '
        'cultural_register, luxury_perception_tier, atmosphere_signals, '
        'material_signals, behavioral_tags, designer_assigned, '
        'intake_completed_at, created_at, updated_at'
    ).eq('tenant_id', tenant_id).eq('id', lead_id).limit(1).execute())
    if not res.data:
        return {"error": "not_found"}
    lead = res.data[0]

    ev_res = (client.table('relationship_answer_events').select(
        'id, lead_id, account_id, question_key, option_value, group_key, '
        'occurred_at, source_surface, session_id, metadata'
    ).eq('tenant_id', tenant_id).eq('lead_id', lead_id)
     .order('occurred_at', desc=False)
     .execute())
    events = ev_res.data or []

    # Initialise all 5 chapters in order; empty ones get filtered later.
    chapters: dict[str, dict] = {k: _empty_chapter(k, t) for k, t in CHAPTER_ORDER}

    # Card 1 — relationship opened
    chapters["early_signals"]["cards"].append(_card_relationship_opened(lead))

    # Card 2 — intake completed (if so)
    if lead.get("intake_completed_at"):
        chapters["concept_consolidation"]["cards"].append(_card_intake_completed(lead))

    # Per-event narrative cards
    for ev in events:
        ckey = _chapter_for_event(ev, lead)
        card = _build_event_card(ev, lead)
        chapters[ckey]["cards"].append(card)
        # Roll up chapter-level chips
        if card.get("atmosphere"):
            chapters[ckey]["atmospheres"].append(card["atmosphere"])
        chapters[ckey]["materials"].extend(card.get("materials") or [])

    # Drop empty chapters in final list (keep order)
    final_chapters = []
    for key, title in CHAPTER_ORDER:
        ch = chapters[key]
        if not ch["cards"]:
            continue
        # Dedupe chips while preserving order
        ch["atmospheres"] = list(dict.fromkeys(ch["atmospheres"]))[:4]
        ch["materials"]   = list(dict.fromkeys(ch["materials"]))[:5]
        # Sort cards within chapter chronologically (oldest first)
        ch["cards"].sort(key=lambda c: c.get("occurred_at") or "")
        final_chapters.append(ch)

    return {
        "subject": {
            "id":                 lead["id"],
            "name":               f"{lead.get('first_name') or ''} {lead.get('last_name') or ''}".strip() or lead.get("email"),
            "email":              lead.get("email"),
            "kind":               (lead.get("progression_state") or "lead").lower(),
            "locale_code":        lead.get("locale_code"),
            "designer_assigned":  lead.get("designer_assigned"),
            "created_at":         lead.get("created_at"),
        },
        "intelligence": _intelligence_panel(lead, events),
        "chapters":     final_chapters,
        "event_count":  len(events),
    }
