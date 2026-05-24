"""ITER148 · Phase 1 · Lead Intake Engine.

Trasforma `closed_answers` (raw runtime-keyed dict) in:
  - behavioral_tags       (cluster tags computati)
  - atmosphere_signals    (top atmosphere fingerprints)
  - material_signals      (top material fingerprints)
  - cultural_register     (editorial|concierge|consultative|discovery)
  - luxury_perception_tier (atelier|couture|pret_a_porter|exploratory)
  - progression_state     (lead|prospect|account)
  - progression_score     (0.0 - 1.0)

Nessun hardcoded behavioral logic frontend — tutta la mappatura
question→tag vive nei `lead_intake_questions.options[].tag_cluster`.
Questo modulo è il solver runtime.
"""
from __future__ import annotations

import logging
from typing import Iterable

from database import db

logger = logging.getLogger(__name__)


# Cache process-level del catalogo questions (TTL 60s) per evitare round-trip
# DB su ogni ingest. Invalidata via `invalidate_question_cache()`.
_CACHE: dict[str, object] = {"questions": None, "loaded_at": 0.0}
_CACHE_TTL = 60.0  # seconds


def invalidate_question_cache() -> None:
    _CACHE["questions"] = None
    _CACHE["loaded_at"] = 0.0


def _load_questions() -> list[dict]:
    import time
    now = time.time()
    if _CACHE["questions"] is not None and (now - float(_CACHE["loaded_at"])) < _CACHE_TTL:
        return _CACHE["questions"]  # type: ignore[return-value]
    try:
        rows = (db().table('lead_intake_questions')
                .select('*').eq('is_active', True)
                .order('display_order').execute().data) or []
    except Exception:
        logger.exception("lead_intake_engine: failed to load questions")
        rows = []
    _CACHE["questions"] = rows
    _CACHE["loaded_at"] = now
    return rows


def list_questions(*, lead_type: str | None = None) -> list[dict]:
    """Public catalog — filtered by lead_type when provided."""
    qs = _load_questions()
    if lead_type:
        return [q for q in qs if not q.get('applies_to_lead_type')
                or q['applies_to_lead_type'] == lead_type]
    return qs


def _option_lookup(question: dict, value: str) -> dict | None:
    for opt in question.get('options') or []:
        if opt.get('value') == value:
            return opt
    return None


def _flatten_answer_values(answer) -> list[str]:
    if answer is None:
        return []
    if isinstance(answer, list):
        return [str(v) for v in answer if v is not None]
    return [str(answer)]


def _uniq(seq: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for s in seq:
        if s not in seen:
            seen.add(s)
            out.append(s)
    return out


def compute_signals(closed_answers: dict, *, lead_type: str | None = None) -> dict:
    """Solve closed-answers → behavioral signals + progression.

    Pure-ish (read from DB catalog cached). Returns a dict ready to be
    spread onto the `leads` row update.
    """
    questions = list_questions(lead_type=lead_type)
    q_by_key = {q['question_key']: q for q in questions}

    behavioral: list[str] = []
    atmosphere: list[str] = []
    material: list[str] = []
    cultural_register: str | None = None
    luxury_tier: str | None = None
    answered_required = 0
    answered_total = 0
    total_required = sum(1 for q in questions if q.get('is_required'))
    total_closed = sum(1 for q in questions if q.get('question_type') in ('single','multi'))

    intent_strength = 0.0

    for q_key, raw in (closed_answers or {}).items():
        q = q_by_key.get(q_key)
        if not q:
            continue
        values = _flatten_answer_values(raw)
        if not values:
            continue
        answered_total += 1
        if q.get('is_required'):
            answered_required += 1
        for v in values:
            opt = _option_lookup(q, v)
            if not opt:
                continue
            behavioral.extend(opt.get('tag_cluster') or [])
            atmosphere.extend(opt.get('atmosphere') or [])
            material.extend(opt.get('material') or [])
            # Last-write-wins for register/tier (questions order them deterministically)
            cr = opt.get('cultural_register')
            if cr:
                cultural_register = cr
            lt = opt.get('luxury_tier')
            if lt:
                luxury_tier = lt
            # Intent contribution
            intent_strength += float(opt.get('intent_weight') or 0.0)

    behavioral = _uniq(behavioral)
    atmosphere = _uniq(atmosphere)[:3]
    material = _uniq(material)[:3]

    # Progression score
    completeness = 0.0
    if total_closed:
        completeness = min(answered_total / total_closed, 1.0) * 0.5
    signal_density = min(len(behavioral) / 12.0, 1.0) * 0.3
    intent_norm = min(intent_strength, 0.2)  # cap intent contribution to 0.2
    score = round(min(completeness + signal_density + intent_norm, 1.0), 2)

    # Progression state
    if score >= 0.75:
        state = 'prospect'
    else:
        state = 'lead'

    return {
        "behavioral_tags": behavioral,
        "atmosphere_signals": atmosphere,
        "material_signals": material,
        "cultural_register": cultural_register,
        "luxury_perception_tier": luxury_tier,
        "progression_state": state,
        "progression_score": score,
        "_meta": {
            "answered_total": answered_total,
            "answered_required": answered_required,
            "total_required": total_required,
            "total_closed": total_closed,
            "completeness_component": round(completeness, 3),
            "signal_density_component": round(signal_density, 3),
            "intent_component": round(intent_norm, 3),
        },
    }
