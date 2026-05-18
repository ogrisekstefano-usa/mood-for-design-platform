"""Phase S-CONNECT Step 3 — Project Market Composer.

Dedicated AI pipeline for portfolio project cultural reinterpretation
(NOT translation). The verbs the surface uses:

  compose_market_edition(master_id, market, locale)  → "Compose Market Edition"
  adapt_for_market(variant_id, editor_notes, …)     → "Adapt for Market"

Reuses the Emergent LLM Key + Claude Sonnet runtime that powers Editorial
Studio, but with a project-specific prompt registry that emphasises:

  • emotional framing       (how the project's story OPENS in this market)
  • material vocabulary     (which materials carry weight here)
  • hospitality tone        (how warm / how restrained)
  • aspirational narrative  (what the visitor projects themselves into)
  • luxury perception       (what "luxury" means culturally to this market)
  • project pacing          (slow reveal vs. immediate immersion)

We DELIBERATELY don't go through `editorial_prompt_composer` — that
composer is tuned for editorial articles (pacing, magazine voice). A
project portfolio reads differently: it's portfolio narrative, material
rationale, client-facing credibility. Future versions can share modules.
"""
from __future__ import annotations

import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage

from database import db

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


def _market_context(market: Dict[str, Any]) -> Dict[str, str]:
    """Project-specific market context. Pulls the editorial_tone /
    luxury_positioning / hospitality_profile / storefront_behavior fields
    seeded by migration 038 (International Presence™)."""
    return {
        "market_code":          market.get("code", ""),
        "market_name":          (market.get("display_name") or {}).get(market.get("primary_locale"), market.get("code", "")),
        "primary_locale":       market.get("primary_locale", ""),
        "editorial_tone":       market.get("editorial_tone") or "",
        "luxury_positioning":   market.get("luxury_positioning") or "",
        "hospitality_profile":  market.get("hospitality_profile") or "",
        "storefront_behavior":  market.get("storefront_behavior") or "",
    }


def _build_compose_prompt(master: Dict[str, Any], market: Dict[str, Any]) -> str:
    """Build the project market composition brief. Strictly JSON output."""
    ctx = _market_context(market)
    palette = master.get("material_palette") or []
    palette_line = ", ".join([str(p) for p in palette]) if palette else ""
    gallery = master.get("gallery") or []
    gallery_summary = [
        {"id": g.get("id"), "caption": (g.get("caption") or "")[:140]}
        for g in gallery[:8]
    ]
    story = master.get("story_body") or []
    story_text = "\n\n".join([(b.get("text") or "") for b in story if isinstance(b, dict)])[:3000]

    return f"""You are the Portfolio Cultural Adaptation Director for an
international interior design studio. Your job is NOT to translate. Your
job is to REINTERPRET the project below for the target market so that the
emotional framing, material vocabulary, hospitality tone, aspirational
narrative, luxury perception and pacing all read as NATIVE to that market.

The project must remain factually identical — same client, same materials,
same location, same year. Only the editorial register changes.

=== PROJECT MASTER (canonical) ===
Title:    {master.get("title", "")}
Subtitle: {master.get("subtitle", "")}
Category: {master.get("category", "")}
Client:   {master.get("client", "")}
Location: {master.get("location", "")}
Year:     {master.get("year", "")}
Material palette: {palette_line}

Master story:
{story_text}

Gallery (master order):
{json.dumps(gallery_summary, ensure_ascii=False)}

=== TARGET MARKET ===
Code:                {ctx["market_code"]}
Name:                {ctx["market_name"]}
Locale (BCP-47):     {ctx["primary_locale"]}
Editorial tone:      {ctx["editorial_tone"]}
Luxury positioning:  {ctx["luxury_positioning"]}
Hospitality profile: {ctx["hospitality_profile"]}
Storefront behavior: {ctx["storefront_behavior"]}

=== REQUIREMENTS ===
Compose the variant in {ctx["primary_locale"]}. Use the editorial
register that an experienced design editor of that market would use —
NOT a translator. Material names stay technical and recognisable. Avoid
generic luxury clichés. The CTA set must be MARKET-NATIVE (e.g. "Book a
Design Consultation" for USA, "Prenota un appuntamento" for Italy,
"Request a Private Material Consultation" for GCC).

=== OUTPUT — STRICT JSON, NO PREAMBLE ===
{{
  "variant_title":          "string · cinematic, in target locale",
  "cultural_angle":         "≤180 chars — the emotional entry point",
  "material_language":      {{"primary": "string", "secondary": "string", "tactile": "string"}},
  "hospitality_tone":       "≤120 chars",
  "aspirational_narrative": "≤220 chars",
  "luxury_perception":      "≤120 chars",
  "story_body": [
    {{ "type": "paragraph", "text": "..." }},
    {{ "type": "paragraph", "text": "..." }},
    {{ "type": "pull_quote", "text": "≤140 chars" }}
  ],
  "gallery_overrides": {{
    "hero_image_id": "id_from_master_gallery_or_null",
    "captions_by_id": {{ "image_id": "market-native caption" }}
  }},
  "cta_set": [
    {{ "tier": "soft" | "medium" | "strong",
       "label": "market-native CTA copy",
       "action": "book_consultation" | "request_visit" | "explore_material" | "save_reference" }}
  ],
  "seo": {{
    "seo_title": "≤60 chars",
    "meta_description": "≤155 chars",
    "focus_intent": "≤60 chars editorial keyword"
  }}
}}

Reply ONLY with the JSON object."""


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    # Strip markdown fences if any.
    t = text.strip()
    m = re.search(r"\{[\s\S]*\}", t)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


async def compose_market_edition(master_id: str, market_id: str, tenant_id: str) -> Dict[str, Any]:
    """Phase S-CONNECT — Compose Market Edition.

    Idempotent: if a variant for (master, target_locale) already exists,
    it's UPDATED with the freshly composed body (status reset to
    'composing'). Otherwise a new row is inserted.
    """
    c = db()
    master = (c.table("portfolio_projects").select("*")
              .eq("id", master_id).eq("tenant_id", tenant_id).limit(1).execute().data or [])
    if not master:
        return {"ok": False, "error": "master not found"}
    master = master[0]

    market = (c.table("markets").select("*")
              .eq("id", market_id).limit(1).execute().data or [])
    if not market:
        return {"ok": False, "error": "market not found"}
    market = market[0]
    target_locale = market.get("primary_locale")

    # Build prompt + call Claude.
    started = time.time()
    chat = LlmChat(api_key=_emergent_key(), session_id=f"portfolio-{master_id}-{market_id}",
                   system_message="You compose market-native portfolio editions for an international interior design studio.")
    chat = chat.with_model(*DEFAULT_MODEL).with_params(max_tokens=2400)
    try:
        reply = await chat.send_message(UserMessage(text=_build_compose_prompt(master, market)))
    except Exception as e:
        logger.exception("portfolio composer failed")
        return {"ok": False, "error": f"composer call failed: {e}"}
    duration_ms = int((time.time() - started) * 1000)

    payload = _extract_json(getattr(reply, "text", None) or str(reply))
    if not payload:
        return {"ok": False, "error": "composer returned non-JSON output"}

    row = {
        "master_id":             master_id,
        "tenant_id":             tenant_id,
        "market_id":             market_id,
        "market_code":           market.get("code"),
        "target_locale":         target_locale,
        "variant_title":         payload.get("variant_title"),
        "cultural_angle":        payload.get("cultural_angle"),
        "material_language":     payload.get("material_language") or {},
        "hospitality_tone":      payload.get("hospitality_tone"),
        "aspirational_narrative":payload.get("aspirational_narrative"),
        "luxury_perception":     payload.get("luxury_perception"),
        "story_body":            payload.get("story_body") or [],
        "gallery_overrides":     payload.get("gallery_overrides") or {},
        "cta_set":               payload.get("cta_set") or [],
        "seo":                   payload.get("seo") or {},
        "status":                "ready",
        "composed_by_ai":        True,
        "composed_at":           _iso(),
        "composer_version":      "project_market_composer_v1",
        "updated_at":            _iso(),
    }

    existing = (c.table("portfolio_project_variants").select("id")
                .eq("master_id", master_id).eq("target_locale", target_locale)
                .limit(1).execute().data or [])
    if existing:
        c.table("portfolio_project_variants").update(row).eq("id", existing[0]["id"]).execute()
        variant_id = existing[0]["id"]
    else:
        ins = c.table("portfolio_project_variants").insert(row).execute()
        variant_id = (ins.data or [{}])[0].get("id")

    return {"ok": True, "variant_id": variant_id, "duration_ms": duration_ms}
