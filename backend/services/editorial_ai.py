"""Editorial Studio™ — composition runtime.

This is the engine room. Callers don't say "AI" or "GPT" or "Claude" —
they invoke editorial verbs:

  compose_variant(master_id, market_id, …)        → "Compose Direction"
  refine_editorial_angle(variant_id, options, …)  → "Refine Editorial Angle"
  rebalance_hospitality_tone(variant_id, adj, …)  → "Rebalance Hospitality Tone"
  compose_internal_translation(variant_id, locale)→ Blueprint understanding

Every call:
  • Builds a modular composition context (no generic prompts).
  • Calls Claude Sonnet via emergentintegrations (Emergent LLM Key).
  • Parses STRICT JSON; falls back to {ok: false, error} on parse failure.
  • Writes an entry to `editorial_composition_log` with composition_trace,
    duration_ms, token estimates, outcome — for engineering observability.
"""
from __future__ import annotations

import json
import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage

from database import db
from services.editorial_prompt_composer import build_composition_context, compose_brief

logger = logging.getLogger(__name__)

DEFAULT_MODEL = ("anthropic", "claude-sonnet-4-5-20250929")
COMPOSITION_TIMEOUT_S = 60


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _emergent_key() -> str:
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise RuntimeError("EMERGENT_LLM_KEY is not configured")
    return key


def _strip_to_json(text: str) -> Optional[Dict[str, Any]]:
    """Best-effort: parse the model output as JSON. Strips code fences and
    leading commentary. Returns None on failure."""
    if not text:
        return None
    s = text.strip()
    # Strip ```json fences.
    if s.startswith("```"):
        s = re.sub(r"^```(json)?\s*", "", s, flags=re.IGNORECASE)
        s = re.sub(r"\s*```$", "", s)
    # Slice from first { to last }.
    start = s.find("{")
    end = s.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    blob = s[start:end + 1]
    try:
        return json.loads(blob)
    except Exception:
        try:
            # Last-resort: try after removing trailing commas.
            blob2 = re.sub(r",\s*([\]}])", r"\1", blob)
            return json.loads(blob2)
        except Exception as e:
            logger.warning("editorial_ai: JSON parse failed: %s", e)
            return None


async def _invoke_studio(system: str, user: str, session_id: str) -> Dict[str, Any]:
    """Low-level call to the studio's underlying engine. Never expose
    provider names to the user. Returns:

      { ok: bool, content: dict|None, raw: str, tokens_in?, tokens_out?, duration_ms }
    """
    t0 = time.time()
    chat = (LlmChat(api_key=_emergent_key(), session_id=session_id, system_message=system)
            .with_model(*DEFAULT_MODEL))
    msg = UserMessage(text=user)
    try:
        raw = await chat.send_message(msg)
    except Exception as e:
        logger.exception("editorial_ai: studio call failed")
        return {
            "ok":          False,
            "content":     None,
            "raw":         "",
            "error":       str(e)[:300],
            "duration_ms": int((time.time() - t0) * 1000),
        }
    parsed = _strip_to_json(raw)
    return {
        "ok":          parsed is not None,
        "content":     parsed,
        "raw":         raw,
        "duration_ms": int((time.time() - t0) * 1000),
    }


def _log_composition(
    *,
    tenant_id: str,
    variant_id: Optional[str],
    operation: str,
    context: Dict[str, Any],
    result: Dict[str, Any],
    user_facing_label: str,
    requested_by_user_id: Optional[str] = None,
) -> None:
    """Persist the composition audit row.

    The user_facing_label is the editorial phrase shown in the UI
    ("Composing editorial direction…"). Provider names are NEVER stored
    in user-facing fields.
    """
    trace = [
        {"module": f.get("module"), "label": f.get("label"), "weight": f.get("weight")}
        for f in (context.get("fragments") or [])
    ]
    try:
        db().table("editorial_composition_log").insert({
            "id":                 str(uuid.uuid4()),
            "tenant_id":          tenant_id,
            "variant_id":         variant_id,
            "operation":          operation,
            "composition_trace":  trace,
            "model_used":         "/".join(DEFAULT_MODEL),
            "duration_ms":        result.get("duration_ms"),
            "outcome":            "ok" if result.get("ok") else ("parse_error" if result.get("content") is None and result.get("raw") else "error"),
            "error_brief":        (result.get("error") or "")[:300] if not result.get("ok") else None,
            "result_preview":     (result.get("raw") or "")[:200],
            "user_facing_label":  user_facing_label,
            "requested_by_user_id":requested_by_user_id,
            "created_at":         _iso(),
        }).execute()
    except Exception:
        logger.exception("editorial_ai: failed to persist composition log")


# ─── Public surface ──────────────────────────────────────────────────────

async def compose_variant(
    *,
    tenant_id: str,
    variant_id: str,
    requested_by_user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Compose a market-native variant from its Editorial Master."""
    c = db()
    v_rows = (c.table("editorial_variants").select("*")
              .eq("id", variant_id).eq("tenant_id", tenant_id).limit(1).execute().data or [])
    if not v_rows:
        return {"ok": False, "error": "Variant not found"}
    variant = v_rows[0]

    master = (c.table("editorial_masters").select("*").eq("id", variant["master_id"]).limit(1).execute().data or [None])[0]
    market = (c.table("markets").select("*").eq("id", variant["market_id"]).limit(1).execute().data or [None])[0]
    if not (master and market):
        return {"ok": False, "error": "Master or Market missing"}

    # Sub-region lookup (if variant carries target_sub_region).
    sub_region = None
    if variant.get("target_sub_region"):
        for sr in (market.get("sub_regions") or []):
            if sr.get("code") == variant["target_sub_region"]:
                sub_region = sr
                break

    context = build_composition_context(
        master=master, market=market,
        target_locale=variant["target_locale"],
        sub_region=sub_region, tenant_id=tenant_id,
        cta_seed=variant.get("cta_set") or [],
    )
    brief = compose_brief(context, task="compose")
    session_id = f"compose-{variant_id}-{int(time.time())}"

    # Flip status to ai_composing (UI label: "Composing editorial direction…").
    c.table("editorial_variants").update({
        "status": "ai_composing", "updated_at": _iso()
    }).eq("id", variant_id).execute()

    result = await _invoke_studio(brief["system"], brief["user"], session_id)
    _log_composition(
        tenant_id=tenant_id, variant_id=variant_id, operation="compose",
        context=context, result=result,
        user_facing_label="Composing editorial direction…",
        requested_by_user_id=requested_by_user_id,
    )

    if not result["ok"]:
        c.table("editorial_variants").update({
            "status": "direction_defined", "updated_at": _iso(),
        }).eq("id", variant_id).execute()
        return {"ok": False, "error": result.get("error") or "composition_parse_failed", "duration_ms": result["duration_ms"]}

    content = result["content"]
    # Write composition back to the variant. Move to ready_for_editorial_review.
    update = {
        "title":          content.get("title") or variant.get("title") or "",
        "excerpt":        content.get("excerpt"),
        "body_blocks":    content.get("body_blocks") or [],
        "cultural_angle": content.get("cultural_angle"),
        "tone_label":     content.get("tone_label"),
        "pacing_label":   content.get("pacing_label"),
        "seo":            content.get("seo") or {},
        "cta_set":        content.get("cta_set") or [],
        "status":         "ready_for_editorial_review",
        "ai_meta": {
            "session_id":  session_id,
            "duration_ms": result["duration_ms"],
            "composed_at": _iso(),
        },
        "updated_at":     _iso(),
    }
    c.table("editorial_variants").update(update).eq("id", variant_id).execute()
    return {"ok": True, "variant_id": variant_id, "duration_ms": result["duration_ms"]}


async def refine_editorial_angle(
    *,
    tenant_id: str,
    variant_id: str,
    revision_options: List[str],
    notes: Optional[str] = None,
    requested_by_user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Refine the editorial angle of an existing variant given structured
    revision_option keys + free-form editor notes."""
    c = db()
    v_rows = (c.table("editorial_variants").select("*")
              .eq("id", variant_id).eq("tenant_id", tenant_id).limit(1).execute().data or [])
    if not v_rows:
        return {"ok": False, "error": "Variant not found"}
    variant = v_rows[0]
    master = (c.table("editorial_masters").select("*").eq("id", variant["master_id"]).limit(1).execute().data or [None])[0]
    market = (c.table("markets").select("*").eq("id", variant["market_id"]).limit(1).execute().data or [None])[0]
    if not (master and market):
        return {"ok": False, "error": "Master or Market missing"}

    sub_region = None
    if variant.get("target_sub_region"):
        for sr in (market.get("sub_regions") or []):
            if sr.get("code") == variant["target_sub_region"]:
                sub_region = sr; break

    context = build_composition_context(
        master=master, market=market, target_locale=variant["target_locale"],
        sub_region=sub_region, tenant_id=tenant_id, cta_seed=variant.get("cta_set") or [],
    )
    # Inject the editor's revision asks as an additional fragment.
    context["fragments"].append({
        "module": "editor_revision_request",
        "label":  "Editor's Revision Brief",
        "weight": "primary",
        "current_variant": {
            "title":        variant.get("title"),
            "excerpt":      variant.get("excerpt"),
            "body_blocks":  variant.get("body_blocks"),
            "tone_label":   variant.get("tone_label"),
            "pacing_label": variant.get("pacing_label"),
            "cta_set":      variant.get("cta_set"),
            "seo":          variant.get("seo"),
        },
        "revision_options": revision_options,
        "editor_notes":     notes,
        "directive": (
            "Address EVERY revision_option specifically. Use the editor_notes as "
            "additional context. Preserve the master conceptual_direction."
        ),
    })
    brief = compose_brief(context, task="refine_angle")
    session_id = f"refine-{variant_id}-{int(time.time())}"
    result = await _invoke_studio(brief["system"], brief["user"], session_id)
    _log_composition(
        tenant_id=tenant_id, variant_id=variant_id, operation="refine_angle",
        context=context, result=result,
        user_facing_label="Refining editorial angle…",
        requested_by_user_id=requested_by_user_id,
    )
    if not result["ok"]:
        return {"ok": False, "error": result.get("error") or "composition_parse_failed"}

    content = result["content"]
    c.table("editorial_variants").update({
        "title":          content.get("title") or variant["title"],
        "excerpt":        content.get("excerpt"),
        "body_blocks":    content.get("body_blocks") or variant["body_blocks"],
        "cultural_angle": content.get("cultural_angle") or variant.get("cultural_angle"),
        "tone_label":     content.get("tone_label") or variant.get("tone_label"),
        "pacing_label":   content.get("pacing_label") or variant.get("pacing_label"),
        "seo":            content.get("seo") or variant.get("seo"),
        "cta_set":        content.get("cta_set") or variant.get("cta_set"),
        "status":         "ready_for_editorial_review",
        "updated_at":     _iso(),
    }).eq("id", variant_id).execute()
    return {"ok": True, "variant_id": variant_id}


async def rebalance_hospitality_tone(
    *,
    tenant_id: str,
    variant_id: str,
    adjustments: Dict[str, Any],
    requested_by_user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Re-balance pacing / luxury intensity / CTA framing on a variant
    WITHOUT rewriting the article. `adjustments` is a dict like:
        {"luxury_intensity": "reduce", "hospitality_resonance": "increase",
         "pacing": "more_ceremonial"}
    """
    c = db()
    v_rows = (c.table("editorial_variants").select("*")
              .eq("id", variant_id).eq("tenant_id", tenant_id).limit(1).execute().data or [])
    if not v_rows:
        return {"ok": False, "error": "Variant not found"}
    variant = v_rows[0]
    master = (c.table("editorial_masters").select("*").eq("id", variant["master_id"]).limit(1).execute().data or [None])[0]
    market = (c.table("markets").select("*").eq("id", variant["market_id"]).limit(1).execute().data or [None])[0]
    if not (master and market):
        return {"ok": False, "error": "Master or Market missing"}

    context = build_composition_context(
        master=master, market=market, target_locale=variant["target_locale"],
        sub_region=None, tenant_id=tenant_id, cta_seed=variant.get("cta_set") or [],
    )
    context["fragments"].append({
        "module": "tone_rebalance",
        "label":  "Hospitality Tone Rebalance",
        "weight": "primary",
        "current_variant": {
            "title":        variant.get("title"),
            "body_blocks":  variant.get("body_blocks"),
            "cta_set":      variant.get("cta_set"),
        },
        "adjustments": adjustments,
        "directive": (
            "Re-balance pacing, luxury framing, and CTA framing per adjustments. "
            "Do NOT change title or core argument. Body content may be lightly "
            "re-paced and re-framed only."
        ),
    })
    brief = compose_brief(context, task="rebalance_tone")
    session_id = f"rebalance-{variant_id}-{int(time.time())}"
    result = await _invoke_studio(brief["system"], brief["user"], session_id)
    _log_composition(
        tenant_id=tenant_id, variant_id=variant_id, operation="rebalance_tone",
        context=context, result=result,
        user_facing_label="Rebalancing hospitality tone…",
        requested_by_user_id=requested_by_user_id,
    )
    if not result["ok"]:
        return {"ok": False, "error": result.get("error") or "composition_parse_failed"}

    content = result["content"]
    c.table("editorial_variants").update({
        "body_blocks":    content.get("body_blocks") or variant["body_blocks"],
        "cta_set":        content.get("cta_set") or variant.get("cta_set"),
        "tone_label":     content.get("tone_label") or variant.get("tone_label"),
        "pacing_label":   content.get("pacing_label") or variant.get("pacing_label"),
        "cultural_angle": content.get("cultural_angle") or variant.get("cultural_angle"),
        "status":         "ready_for_editorial_review",
        "updated_at":     _iso(),
    }).eq("id", variant_id).execute()
    return {"ok": True, "variant_id": variant_id}


async def compose_internal_translation(
    *,
    tenant_id: str,
    variant_id: str,
    blueprint_locale: str,
    requested_by_user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Compose the INTERNAL UNDERSTANDING translation. NEVER published,
    NEVER indexed, NEVER served by storefront endpoints."""
    c = db()
    v_rows = (c.table("editorial_variants").select("*")
              .eq("id", variant_id).eq("tenant_id", tenant_id).limit(1).execute().data or [])
    if not v_rows:
        return {"ok": False, "error": "Variant not found"}
    variant = v_rows[0]
    if variant["target_locale"] == blueprint_locale:
        # No translation needed — mirror the published version.
        mirror = {
            "title":       variant.get("title"),
            "excerpt":     variant.get("excerpt"),
            "body_blocks": variant.get("body_blocks"),
            "_notice":     "Same as published locale — no translation needed.",
            "blueprint_locale": blueprint_locale,
            "generated_at":     _iso(),
        }
        c.table("editorial_variants").update({
            "internal_translation": mirror, "updated_at": _iso(),
        }).eq("id", variant_id).execute()
        return {"ok": True, "skipped_mirror": True}

    # Build a lean context: only the variant content + locale instruction.
    context = {
        "target_locale": blueprint_locale,
        "fragments": [{
            "module": "internal_translation",
            "label":  "Internal Understanding Translation",
            "weight": "primary",
            "source_variant": {
                "title":        variant.get("title"),
                "excerpt":      variant.get("excerpt"),
                "body_blocks":  variant.get("body_blocks"),
                "target_locale_of_source": variant.get("target_locale"),
            },
            "blueprint_locale": blueprint_locale,
            "directive": (
                "Translate faithfully into the Blueprint editor's locale. "
                "Goal: the editor must UNDERSTAND what will be published, "
                "nothing more. Do NOT improve, shorten, or stylise. "
                "Output JSON: {title, excerpt, body_blocks[], _notice}."
            ),
        }],
        "output_contract": {
            "title": "string", "excerpt": "string",
            "body_blocks": "array of {type, text}",
            "_notice": "string — must say 'For Blueprint review only — not published'",
        },
    }
    brief = compose_brief(context, task="internal_translation")
    session_id = f"intl-tx-{variant_id}-{int(time.time())}"
    result = await _invoke_studio(brief["system"], brief["user"], session_id)
    _log_composition(
        tenant_id=tenant_id, variant_id=variant_id, operation="internal_translation",
        context=context, result=result,
        user_facing_label="Drafting internal understanding…",
        requested_by_user_id=requested_by_user_id,
    )
    if not result["ok"]:
        return {"ok": False, "error": result.get("error") or "composition_parse_failed"}

    intl = result["content"]
    intl.setdefault("_notice", "For Blueprint review only — not published")
    intl["blueprint_locale"] = blueprint_locale
    intl["generated_at"] = _iso()
    c.table("editorial_variants").update({
        "internal_translation": intl, "updated_at": _iso(),
    }).eq("id", variant_id).execute()
    return {"ok": True, "variant_id": variant_id}
