"""Vision Asset Classifier — Layer 2 LLM enrichment fallback.

Phase F1 (Product Visual Ecosystem™).

Triggered ONLY when the Layer 1 rule-based classifier reports
classification_confidence < 0.55. Even then, it is:
  • non-blocking (caller awaits in background or fire-and-forget)
  • best-effort (any failure preserves the Layer 1 verdict)
  • single retry (max_retries=1)
  • cached forever in inspiration_meta.vision_classification

Provider:
  OpenAI gpt-5.1 vision via the Emergent LLM Key (same stack already
  used by cultural_engine.vision_provider_adapter). Reusing it avoids
  duplicating the image-fetch / b64-encoding code.

Output enrichment (NOT authoritative — Layer 1 stays canonical):
  • vision_asset_type         (lifestyle | still_life | cutout | …)
  • vision_compositional_role (hero | focal | supporting | …)
  • vision_view_angle         (front | side | macro | …)
  • vision_room_type          (living | kitchen | outdoor | …)
  • vision_mood_tags          [3-5 italian tags]
  • vision_recommended_usage  [2-4 italian phrases]
  • vision_summary            short italian description

The caller merges these into inspiration_meta — typically the rule-based
asset_type wins UNLESS Layer 1 confidence < 0.45 AND Layer 2 returned a
strong verdict.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Sei un curatore visuale di un atelier di interior design.
Analizza l'immagine e classifica il suo ruolo progettuale.
Rispondi SEMPRE e SOLO con un oggetto JSON valido senza markdown.

Schema JSON richiesto:
{
  "asset_type": "lifestyle|still_life|cutout|texture|detail|technical|rendering|campaign|material_sample|variant",
  "compositional_role": "hero|focal|supporting|accent|background|structural",
  "view_angle": "front|side|back|top|three_quarter|macro|context|flat|unknown",
  "room_type": "living|dining|kitchen|bedroom|bathroom|outdoor|hospitality|workspace|null",
  "mood_tags": ["3-5 tag editoriali italiani in lowercase"],
  "recommended_usage": ["2-4 utilizzi suggeriti italiani brevi"],
  "summary": "frase breve italiana che descrive il valore compositivo dell'asset"
}

Linguaggio: italiano editoriale concreto. Niente AI/dashboard/algorithm.
Lowercase per tutti i tag. Massimo 8 parole per ogni recommended_usage.
"""

MODEL = os.environ.get("CULTURAL_VISION_MODEL", "gpt-5.1")
PROVIDER = os.environ.get("CULTURAL_VISION_PROVIDER", "openai")
TIMEOUT_S = 30
MAX_BYTES = 8 * 1024 * 1024

ALLOWED_ASSET_TYPES = {
    "lifestyle", "still_life", "cutout", "texture", "detail",
    "technical", "rendering", "campaign", "material_sample", "variant",
}
ALLOWED_ROLES = {"hero", "focal", "supporting", "accent", "background", "structural"}
ALLOWED_ANGLES = {"front", "side", "back", "top", "three_quarter", "macro", "context", "flat", "unknown"}


async def _fetch_image_b64(url: str) -> Optional[Dict[str, str]]:
    import base64
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            r = await client.get(url)
            if r.status_code != 200:
                return None
            content_type = r.headers.get("content-type", "image/jpeg").split(";")[0].strip()
            if content_type not in ("image/jpeg", "image/jpg", "image/png", "image/webp"):
                ext = url.lower().split("?")[0].rsplit(".", 1)[-1]
                content_type = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
                                "png": "image/png", "webp": "image/webp"}.get(ext, "image/jpeg")
            content = r.content[:MAX_BYTES]
            return {"b64": base64.b64encode(content).decode("ascii"), "mime": content_type}
    except Exception as e:
        logger.warning(f"vision_asset: fetch error {url}: {e}")
        return None


async def _call_llm(image: Dict[str, str], session_id: str) -> Optional[str]:
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        logger.warning("vision_asset: EMERGENT_LLM_KEY missing")
        return None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent  # type: ignore
    except Exception as e:
        logger.warning(f"vision_asset: emergentintegrations missing: {e}")
        return None
    try:
        chat = (
            LlmChat(api_key=key, session_id=session_id, system_message=SYSTEM_PROMPT)
            .with_model(PROVIDER, MODEL)
        )
        msg = UserMessage(
            text="Classifica questo asset visuale di design e restituisci SOLO l'oggetto JSON.",
            file_contents=[ImageContent(image_base64=image["b64"])],
        )
        resp = await chat.send_message(msg)
        return resp if isinstance(resp, str) else getattr(resp, "text", str(resp))
    except Exception as e:
        logger.warning(f"vision_asset: LLM call failed: {e}")
        return None


# ── Phase 1.5 (ITER189) · bytes-based enrichment for offline / batch use ──
async def enrich_asset_bytes(
    image_bytes: bytes,
    *,
    media_id: Optional[str] = None,
    max_retries: int = 1,
    mime: str = "image/jpeg",
) -> Dict[str, Any]:
    """Run Vision LLM classification directly on image bytes (no HTTP fetch).

    Used by the Knowledge Factory product_composer when classifying every
    asset extracted from a PDF. Same contract as `enrich_asset` (never
    raises, returns dict with ok/enrichment/error).
    """
    import base64
    out: Dict[str, Any] = {
        "ok": False, "enrichment": None, "error": None,
        "latency_ms": 0, "model": MODEL, "provider": PROVIDER,
    }
    started = time.time()
    try:
        if not image_bytes or len(image_bytes) < 1024:
            out["error"] = "image_too_small"
            return out
        b = image_bytes[:MAX_BYTES]
        image = {"b64": base64.b64encode(b).decode("ascii"), "mime": mime}
        last_err: Optional[str] = None
        for attempt in range(max_retries + 1):
            raw = await _call_llm(image, session_id=media_id or f"asset-{int(started*1000)}")
            parsed = _parse(raw or "")
            if parsed:
                out["ok"] = True
                out["enrichment"] = parsed
                break
            last_err = "parse_failed" if raw else "no_response"
            if attempt < max_retries:
                await asyncio.sleep(0.5)
        if not out["ok"] and not out["error"]:
            out["error"] = last_err or "unknown"
    except Exception as e:
        logger.warning(f"vision_asset: enrich_bytes exception: {e}")
        out["error"] = "exception"
    finally:
        out["latency_ms"] = int((time.time() - started) * 1000)
    return out



def _parse(raw: str) -> Optional[Dict[str, Any]]:
    if not raw:
        return None
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.M)
    m = re.search(r"\{[\s\S]*\}", cleaned)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
    except Exception:
        return None
    # Validate / coerce
    at = (data.get("asset_type") or "").lower()
    if at not in ALLOWED_ASSET_TYPES: at = "still_life"
    role = (data.get("compositional_role") or "").lower()
    if role not in ALLOWED_ROLES: role = "supporting"
    angle = (data.get("view_angle") or "").lower()
    if angle not in ALLOWED_ANGLES: angle = "unknown"

    rt = data.get("room_type")
    if isinstance(rt, str) and rt.strip().lower() in ("null", "none", ""):
        rt = None
    if rt and not isinstance(rt, str):
        rt = None

    mood = data.get("mood_tags") or []
    if not isinstance(mood, list): mood = []
    mood = [str(t).strip().lower() for t in mood if t][:6]

    usage = data.get("recommended_usage") or []
    if not isinstance(usage, list): usage = []
    usage = [str(u).strip() for u in usage if u][:5]

    summary = (data.get("summary") or "").strip()[:280]

    return {
        "vision_asset_type":         at,
        "vision_compositional_role": role,
        "vision_view_angle":         angle,
        "vision_room_type":          rt,
        "vision_mood_tags":          mood,
        "vision_recommended_usage":  usage,
        "vision_summary":            summary,
    }


async def enrich_asset(
    image_url: str,
    *,
    media_id: Optional[str] = None,
    max_retries: int = 1,
) -> Dict[str, Any]:
    """Run Vision LLM classification. NEVER raises.

    Returns:
      {
        "ok": bool,
        "enrichment": {...} | None,
        "error": str | None,
        "latency_ms": int,
        "model": str,
        "provider": str,
      }
    """
    out: Dict[str, Any] = {
        "ok": False, "enrichment": None, "error": None,
        "latency_ms": 0, "model": MODEL, "provider": PROVIDER,
    }
    started = time.time()
    try:
        image = await _fetch_image_b64(image_url)
        if not image:
            out["error"] = "image_fetch_failed"
            return out

        last_err: Optional[str] = None
        for attempt in range(max_retries + 1):
            raw = await _call_llm(image, session_id=media_id or f"asset-{int(started*1000)}")
            parsed = _parse(raw or "")
            if parsed:
                out["ok"] = True
                out["enrichment"] = parsed
                break
            last_err = "parse_failed" if raw else "no_response"
            if attempt < max_retries:
                await asyncio.sleep(0.5)
        if not out["ok"] and not out["error"]:
            out["error"] = last_err or "unknown"
    except Exception as e:
        logger.warning(f"vision_asset: enrich exception: {e}")
        out["error"] = "exception"
    finally:
        out["latency_ms"] = int((time.time() - started) * 1000)
    return out


def merge_enrichment_into_meta(
    base_meta: Dict[str, Any],
    enrichment: Dict[str, Any],
    *,
    rule_confidence: float,
) -> Dict[str, Any]:
    """Merge Layer 2 output into the inspiration_meta dict.

    Rules:
      • Layer 1 stays authoritative when its confidence >= 0.55.
      • If Layer 1 < 0.45 and Layer 2 returned a verdict, swap the
        canonical fields (asset_type, compositional_role, view_angle).
      • Always store the raw vision_* keys for transparency / future
        rebuild without re-calling the LLM.
      • Always store room_type, mood_tags, recommended_usage from Vision
        as enrichment (they have no Layer 1 equivalent).
    """
    out = {**(base_meta or {}), **(enrichment or {})}
    if rule_confidence < 0.45 and enrichment.get("vision_asset_type"):
        out["asset_type"] = enrichment["vision_asset_type"]
        out["compositional_role"] = enrichment.get("vision_compositional_role") or out.get("compositional_role")
        out["view_angle"] = enrichment.get("vision_view_angle") or out.get("view_angle")
        out["classified_by"] = "vision"
        out["classification_confidence"] = round(max(rule_confidence, 0.62), 3)
    # Enrichment fields that have no Layer 1 equivalent
    if enrichment.get("vision_room_type") and not out.get("room_type"):
        out["room_type"] = enrichment["vision_room_type"]
    if enrichment.get("vision_mood_tags") and not out.get("mood_tags"):
        out["mood_tags"] = enrichment["vision_mood_tags"]
    if enrichment.get("vision_recommended_usage") and not out.get("recommended_usage"):
        out["recommended_usage"] = enrichment["vision_recommended_usage"]
    return out
