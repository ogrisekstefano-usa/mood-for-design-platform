"""Layer 1 — Vision Analysis adapter.

Vision AI is used ONLY for spatial/architectural signal extraction.
The provider NEVER classifies a market — that's Layer 2's job.

Swap providers via env:
  CULTURAL_VISION_PROVIDER  = openai | anthropic | gemini   (default openai)
  CULTURAL_VISION_MODEL     = gpt-5.1 (default)
"""
from __future__ import annotations

import base64
import io
import json
import logging
import os
import re
import time
import uuid
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)


# Signals schema — only what Layer 2 knows how to consume.
SIGNAL_SCHEMA_DOC = """
Restituisci SOLO un oggetto JSON valido con la seguente forma. Ogni valore
0-1 è un'intensità (0 = assente, 1 = molto pronunciato). Mai inventare
valori non richiesti.

{
  "indoor_outdoor_continuity":   0..1,
  "urban_density":               0..1,
  "hospitality_orientation":     0..1,
  "warm_materiality":            0..1,
  "ceremonial_scale":            0..1,
  "natural_landscape_presence":  0..1,
  "vertical_luxury_language":    0..1,
  "vegetation_presence":         0..1,
  "polished_drama":              0..1,
  "tactile_softness":            0..1,
  "atmospheric_darkness":        0..1,
  "luminous_warmth":             0..1,
  "rational_rigor":              0..1,
  "heritage_layering":           0..1,
  "open_plan_continuity":        0..1,
  "intimate_layering":           0..1,
  "climate_cues":                ["tropical"|"mediterranean"|"desert"|"alpine"|"temperate"|"nordic"],
  "room_typology":               "residential_open_plan"|"residential_compact"|"hospitality_lobby"|"hospitality_suite"|"retail"|"office"|"outdoor"|"undefined",
  "dominant_palette":            ["sand","cream","graphite","walnut","brass","green","blue","white","black","terracotta"],
  "summary":                     "one-sentence neutral architectural description, no market guesses"
}
"""

NUMERIC_FIELDS = [
    "indoor_outdoor_continuity", "urban_density", "hospitality_orientation",
    "warm_materiality", "ceremonial_scale", "natural_landscape_presence",
    "vertical_luxury_language", "vegetation_presence", "polished_drama",
    "tactile_softness", "atmospheric_darkness", "luminous_warmth",
    "rational_rigor", "heritage_layering", "open_plan_continuity",
    "intimate_layering",
]


SYSTEM_PROMPT = (
    "Sei un osservatore architettonico per la redazione internazionale di MOOD. "
    "Il tuo compito è leggere un'immagine di interior design e restituire SOLO "
    "segnali architettonici e spaziali oggettivi. Non devi classificare il mercato "
    "geografico, non devi indovinare lo stile, non devi inventare descrizioni "
    "narrative. Restituisci esclusivamente un oggetto JSON conforme allo schema "
    "fornito, niente testo aggiuntivo, niente markdown, niente commenti.\n\n"
    + SIGNAL_SCHEMA_DOC
)


# ── Image fetch & encode ─────────────────────────────────────────────
async def _fetch_image_b64(url: str, max_bytes: int = 4_000_000) -> Optional[Dict[str, str]]:
    """Download an image URL and return base64 + mime, or None on failure.

    SSRF guard: refuse private/localhost addresses BEFORE following redirects.
    """
    import ipaddress
    import socket
    from urllib.parse import urlparse

    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            logger.warning(f"vision: blocked non-http(s) scheme {url}")
            return None
        host = parsed.hostname or ""
        # Reject obvious internal hostnames
        if host in {"localhost", "0.0.0.0"} or host.endswith(".internal") or host.endswith(".local"):
            logger.warning(f"vision: blocked internal hostname {host}")
            return None
        # Reject private IPs explicitly
        try:
            ip = ipaddress.ip_address(host)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                logger.warning(f"vision: blocked private ip {host}")
                return None
        except ValueError:
            # Not an IP literal — resolve to verify it's not private
            try:
                resolved = socket.gethostbyname(host)
                ip = ipaddress.ip_address(resolved)
                if ip.is_private or ip.is_loopback or ip.is_link_local:
                    logger.warning(f"vision: blocked resolved private ip {host}->{resolved}")
                    return None
            except (socket.gaierror, ValueError):
                # DNS resolution failed — let httpx attempt with timeout
                pass

        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0,
                                     headers={"User-Agent": "MOOD/CulturalEngine"}) as c:
            r = await c.get(url)
            if r.status_code >= 400:
                logger.warning(f"vision: image fetch {url} → {r.status_code}")
                return None
            content_type = r.headers.get("content-type", "image/jpeg").split(";")[0].strip()
            if content_type not in ("image/jpeg", "image/jpg", "image/png", "image/webp"):
                ext = url.lower().split("?")[0].rsplit(".", 1)[-1]
                content_type = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
                                "png": "image/png", "webp": "image/webp"}.get(ext, "image/jpeg")
            if len(r.content) > max_bytes:
                logger.warning(f"vision: image {url} too large ({len(r.content)} bytes)")
            return {"b64": base64.b64encode(r.content).decode("ascii"), "mime": content_type}
    except Exception as e:
        logger.warning(f"vision: image fetch error {url}: {e}")
        return None


# ── Provider call ────────────────────────────────────────────────────
async def _call_openai(image: Dict[str, str], session_id: str, model: str) -> str:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent  # type: ignore
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise RuntimeError("EMERGENT_LLM_KEY missing")
    chat = (
        LlmChat(api_key=key, session_id=session_id, system_message=SYSTEM_PROMPT)
        .with_model("openai", model)
    )
    msg = UserMessage(
        text="Leggi questa immagine e restituisci SOLO l'oggetto JSON dei segnali architettonici e spaziali.",
        file_contents=[ImageContent(image_base64=image["b64"])],
    )
    resp = await chat.send_message(msg)
    return resp if isinstance(resp, str) else getattr(resp, "text", str(resp))


# ── Parsing & validation ─────────────────────────────────────────────
def _parse_signals(raw_text: str) -> Optional[Dict[str, Any]]:
    """Extract & validate the JSON object from the model response."""
    if not raw_text:
        return None
    # Strip markdown fences if present
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_text.strip(), flags=re.M)
    m = re.search(r"\{[\s\S]*\}", cleaned)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
    except Exception:
        return None
    # Coerce numerics into [0,1]
    for k in NUMERIC_FIELDS:
        v = data.get(k)
        if isinstance(v, (int, float)):
            data[k] = max(0.0, min(1.0, float(v)))
        else:
            data[k] = 0.0
    if not isinstance(data.get("climate_cues"), list):
        data["climate_cues"] = []
    if not isinstance(data.get("dominant_palette"), list):
        data["dominant_palette"] = []
    data["room_typology"] = data.get("room_typology") or "undefined"
    data["summary"] = (data.get("summary") or "").strip()[:300]
    return data


# ── Public API ───────────────────────────────────────────────────────
async def analyze_image(image_url: str) -> Dict[str, Any]:
    """Run Layer 1 vision analysis on an image URL.

    Returns:
        {
          "signals":   {...} | None,
          "provider":  "openai" | ...,
          "model":     "gpt-5.1",
          "latency_ms": int,
          "raw":       str,           # raw model output (kept for debugging)
          "error":     str | None,
        }
    """
    provider = os.environ.get("CULTURAL_VISION_PROVIDER", "openai")
    model = os.environ.get("CULTURAL_VISION_MODEL", "gpt-5.1")
    started = time.time()
    out: Dict[str, Any] = {
        "provider": provider, "model": model, "signals": None, "raw": "",
        "latency_ms": 0, "error": None,
    }
    img = await _fetch_image_b64(image_url)
    if not img:
        out["error"] = "image_fetch_failed"
        out["latency_ms"] = int((time.time() - started) * 1000)
        return out
    try:
        if provider == "openai":
            raw = await _call_openai(img, session_id=f"vision-{uuid.uuid4().hex[:10]}", model=model)
        else:
            # Other providers can be added here following the same shape.
            raise RuntimeError(f"Unsupported vision provider: {provider}")
        out["raw"] = raw[:4000] if raw else ""
        parsed = _parse_signals(raw or "")
        if not parsed:
            out["error"] = "parse_failed"
        else:
            out["signals"] = parsed
    except Exception as e:
        out["error"] = str(e)[:200]
        logger.warning(f"vision provider call failed: {e}")
    out["latency_ms"] = int((time.time() - started) * 1000)
    return out
