"""Phase P0.2.C — Editorial Cultural Variants endpoints.

Article + Hotspot locale repositioning. Each variant is a NATIVE editorial
repositioning of the same source content — never a translation. The same
travertine villa article reads as:
  • EN_US: "Mediterranean lifestyle escape, elevated entertaining"
  • EN_GB: "Architectural restraint, layered sophistication"
  • EN_AE: "Private hospitality prestige, signature presence"
  • DE_DE: "Materialdisziplin und konstruktive Klarheit"

Endpoints:
  GET  /api/magazine/articles/{aid}/locale-variants
  POST /api/magazine/articles/{aid}/locale-variants/{locale_code}/generate
  PATCH /api/magazine/articles/{aid}/locale-variants/{locale_code}/approve
  GET  /api/magazine/hotspots/{hid}/locale-variants
  POST /api/magazine/hotspots/{hid}/locale-variants/{locale_code}/generate

All AI calls go through `core.locale_runtime.with_runtime_prompt()` so
cultural register stays consistent with the rest of the platform.
"""
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import db
from core.tenant_context import get_tenant_context
from core.locale_runtime import (
    SUPPORTED_LOCALES,
    resolve_profile,
    with_runtime_prompt,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/magazine", tags=["editorial-variants"])


# ─── Helpers ─────────────────────────────────────────────────────────────

def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_article(c, aid: str, tid: str) -> Dict[str, Any]:
    r = (c.table("magazine_articles").select("*")
         .eq("id", aid).eq("tenant_id", tid).limit(1).execute())
    if not r.data:
        raise HTTPException(404, "article not found")
    return r.data[0]


def _get_hotspot(c, hid: str, tid: str) -> Dict[str, Any]:
    r = (c.table("article_hotspots").select("*")
         .eq("id", hid).eq("tenant_id", tid).limit(1).execute())
    if not r.data:
        raise HTTPException(404, "hotspot not found")
    return r.data[0]


def _validate_locale(code: str) -> str:
    code = (code or "").upper().strip()
    if code not in SUPPORTED_LOCALES:
        raise HTTPException(400, f"unsupported locale: {code}")
    return code


# ─── Article variants ────────────────────────────────────────────────────

class ApproveIn(BaseModel):
    approved: bool = True


_ARTICLE_TASK_INTRO = """You are the editorial creative director of an
international luxury interior design magazine. You are repositioning a
SINGLE article for a different locale-native audience. You DO NOT translate.
You compose a NATIVE editorial reading — the way the same story would be
written in print for THAT specific market's cultural register."""

_ARTICLE_TASK_RULES = """═══ TASK RULES ═══
• Reposition, do NOT translate. Even when the source article is excellent,
  REWRITE natively for this locale.
• Each text field: editorial prose, 1–3 sentences. No lists, no bullet points.
• `seo_title`: max 60 chars. `seo_description`: max 155 chars.
• `cta_copy`: max 8 words, locale-native voice.

Output JSON only — no markdown, no preamble:
{
  "title":                "...",
  "subtitle":             "...",
  "intro":                "...",
  "storytelling_summary": "...",
  "emotional_direction":  "...",
  "cta_copy":             "...",
  "seo_title":            "...",
  "seo_description":      "..."
}"""


def _article_source_text(article: Dict[str, Any]) -> str:
    """Build a compact source representation of the article for the LLM."""
    lc = article.get("locale_content") or {}
    # Pick the first locale block as canonical source — typically IT.
    default_locale = article.get("default_locale") or "it"
    block = lc.get(default_locale) or (next(iter(lc.values()), {}) if lc else {})
    pieces = [
        f"source_locale: {default_locale}",
        f"title:        {block.get('title') or article.get('slug')}",
        f"subtitle:     {block.get('subtitle') or ''}",
        f"excerpt:      {block.get('excerpt') or ''}",
        f"category:     {article.get('category_slug') or ''}",
        f"tags:         {', '.join(article.get('tags') or [])}",
        f"materials:    {', '.join(article.get('featured_materials') or [])}",
        f"atmosphere:   {', '.join(article.get('atmosphere_keywords') or [])}",
        f"editorial_tone: {article.get('editorial_tone') or ''}",
    ]
    body = article.get("body_blocks") or []
    if body:
        # Use only the first 2 text blocks to keep prompt size bounded.
        text_blocks = [b for b in body if isinstance(b, dict) and b.get("type") in ("paragraph", "text", "heading")][:2]
        for tb in text_blocks:
            pieces.append(f"block: {(tb.get('text') or tb.get('content') or '')[:400]}")
    return "\n".join(pieces)


async def _ai_compose_article_variant(article: Dict[str, Any],
                                      profile: Dict[str, Any]) -> Dict[str, Any]:
    """Call the LLM to compose a culturally-native variant. Returns dict
    with the 8 fields (title, subtitle, intro, storytelling_summary,
    emotional_direction, cta_copy, seo_title, seo_description)."""
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(503, "AI service unavailable — EMERGENT_LLM_KEY missing")
    from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
    chat = (
        LlmChat(
            api_key=key,
            session_id=f"article-variant-{article['id']}-{uuid.uuid4().hex[:8]}",
            system_message=f"{_ARTICLE_TASK_INTRO}\n\n{with_runtime_prompt(profile)}\n\n{_ARTICLE_TASK_RULES}",
        )
        .with_model("anthropic", "claude-sonnet-4-5-20250929")
        .with_params(max_tokens=900)
    )
    src = _article_source_text(article)
    raw = await chat.send_message(UserMessage(
        text=(f"locale_code: {profile['locale_code']}\n"
              f"market:      {profile['market']}\n"
              f"language:    {profile['language']}\n\n"
              f"=== SOURCE ARTICLE ===\n{src}\n\n"
              f"Compose the locale-native variant. Output JSON only."),
    ))
    text = raw if isinstance(raw, str) else getattr(raw, "text", str(raw))
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        raise HTTPException(502, "AI returned no parsable variant")
    try:
        parsed = json.loads(m.group(0))
    except Exception as e:
        raise HTTPException(502, f"AI returned invalid JSON: {e}")
    return {
        "title":                (parsed.get("title") or "")[:240],
        "subtitle":             (parsed.get("subtitle") or "")[:280],
        "intro":                (parsed.get("intro") or ""),
        "storytelling_summary": (parsed.get("storytelling_summary") or ""),
        "emotional_direction":  (parsed.get("emotional_direction") or ""),
        "cta_copy":             (parsed.get("cta_copy") or "")[:80],
        "seo_title":            (parsed.get("seo_title") or "")[:60],
        "seo_description":      (parsed.get("seo_description") or "")[:155],
    }


@router.get("/articles/{article_id}/locale-variants")
def list_article_variants(article_id: str, ctx=Depends(get_tenant_context)):
    """List all locale variants for an article (admin/editorial view).

    Variants are stored under `magazine_articles.locale_content` keyed by
    locale_code. Each value is a dict with the 8 editorial fields plus
    `ai_generated`, `generated_at`, `approved_at`, `generated_by`.
    """
    c = db()
    article = _get_article(c, article_id, ctx["tenant_id"])
    lc = article.get("locale_content") or {}
    rows = []
    for code in sorted(lc.keys()):
        v = lc[code] if isinstance(lc[code], dict) else {}
        rows.append({
            "locale_code":          code,
            "title":                v.get("title"),
            "subtitle":             v.get("subtitle"),
            "intro":                v.get("intro"),
            "storytelling_summary": v.get("storytelling_summary"),
            "emotional_direction":  v.get("emotional_direction"),
            "cta_copy":             v.get("cta_copy"),
            "seo_title":            v.get("seo_title"),
            "seo_description":      v.get("seo_description"),
            "ai_generated":         v.get("ai_generated", False),
            "generated_at":         v.get("generated_at"),
            "generated_by":         v.get("generated_by"),
            "approved_at":          v.get("approved_at"),
            "approved_by":          v.get("approved_by"),
        })
    return {"variants": rows, "total": len(rows)}


@router.post("/articles/{article_id}/locale-variants/{locale_code}/generate")
async def generate_article_variant(article_id: str, locale_code: str,
                                   ctx=Depends(get_tenant_context)):
    """Compose a culturally-native variant for a target locale. Stores it
    under `magazine_articles.locale_content[locale_code]`. Status starts as
    `ai_generated=true, approved_at=null` — requires editorial approval."""
    code = _validate_locale(locale_code)
    c = db()
    article = _get_article(c, article_id, ctx["tenant_id"])
    profile = resolve_profile(c, code)
    if not profile:
        raise HTTPException(404, f"locale profile {code} not found")
    effective_locale = profile["locale_code"]

    composed = await _ai_compose_article_variant(article, profile)
    variant_entry = {
        **composed,
        "ai_generated":     True,
        "generated_at":     _iso(),
        "generated_by":     ctx["profile_id"],
        "approved_at":      None,
        "approved_by":      None,
        "model":            "claude-sonnet-4-5-20250929",
        "locale_profile":   profile["locale_code"],
        "requested_locale": code,
    }

    # Merge into the existing locale_content JSONB.
    lc = dict(article.get("locale_content") or {})
    lc[effective_locale] = variant_entry
    c.table("magazine_articles").update({
        "locale_content": lc,
        "updated_at":     _iso(),
    }).eq("id", article_id).eq("tenant_id", ctx["tenant_id"]).execute()

    return {"ok": True, "locale_code": effective_locale, "variant": composed}


@router.patch("/articles/{article_id}/locale-variants/{locale_code}/approve")
def approve_article_variant(article_id: str, locale_code: str,
                            body: ApproveIn,
                            ctx=Depends(get_tenant_context)):
    code = _validate_locale(locale_code)
    c = db()
    article = _get_article(c, article_id, ctx["tenant_id"])
    lc = dict(article.get("locale_content") or {})
    if code not in lc or not isinstance(lc[code], dict):
        raise HTTPException(404, "variant not found")
    lc[code]["approved_at"] = _iso() if body.approved else None
    lc[code]["approved_by"] = ctx["profile_id"] if body.approved else None
    c.table("magazine_articles").update({
        "locale_content": lc,
        "updated_at":     _iso(),
    }).eq("id", article_id).eq("tenant_id", ctx["tenant_id"]).execute()
    return {"ok": True, "approved": body.approved}


# ─── Hotspot variants ────────────────────────────────────────────────────

_HOTSPOT_TASK_INTRO = """You are the editorial micro-copy director for an
international luxury design magazine. You are repositioning a single
material/product hotspot for a different locale-native audience. You DO
NOT translate. You compose a NATIVE micro-narrative — the way the same
material would be described in print for THAT cultural register."""

_HOTSPOT_TASK_RULES = """═══ TASK RULES ═══
• Reposition, do NOT translate.
• `title`: max 6 words. `narrative`: max 35 words, single editorial sentence.
• `cta_copy`: max 4 words.
• `emotional_framing` + `atmosphere`: 3–6 words each.

Output JSON only — no markdown, no preamble:
{
  "title":             "...",
  "narrative":         "...",
  "cta_copy":          "...",
  "emotional_framing": "...",
  "atmosphere":        "..."
}"""


def _hotspot_source_text(hotspot: Dict[str, Any], material: Optional[Dict[str, Any]]) -> str:
    pieces = [
        f"reference_type: {hotspot.get('reference_type') or ''}",
        f"cta_action:     {hotspot.get('cta_action') or ''}",
    ]
    lc = hotspot.get("locale_content") or {}
    if lc:
        # Use the first available content block as source.
        block = next(iter(lc.values()), {})
        if isinstance(block, dict):
            pieces.append(f"source_title:     {block.get('title') or ''}")
            pieces.append(f"source_narrative: {block.get('narrative') or block.get('description') or ''}")
            pieces.append(f"source_cta:       {block.get('cta') or ''}")
    if material:
        pieces.append(f"material_name:     {material.get('name') or ''}")
        pieces.append(f"material_category: {material.get('category') or ''}")
        pieces.append(f"material_finish:   {material.get('finish') or ''}")
        pieces.append(f"material_color:    {material.get('dominant_color') or ''}")
        pieces.append(f"material_tags:     {', '.join(material.get('tags') or [])}")
    return "\n".join(pieces)


async def _ai_compose_hotspot_variant(hotspot: Dict[str, Any],
                                      material: Optional[Dict[str, Any]],
                                      profile: Dict[str, Any]) -> Dict[str, Any]:
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(503, "AI service unavailable — EMERGENT_LLM_KEY missing")
    from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
    chat = (
        LlmChat(
            api_key=key,
            session_id=f"hotspot-{hotspot['id']}-{uuid.uuid4().hex[:8]}",
            system_message=f"{_HOTSPOT_TASK_INTRO}\n\n{with_runtime_prompt(profile)}\n\n{_HOTSPOT_TASK_RULES}",
        )
        .with_model("anthropic", "claude-sonnet-4-5-20250929")
        .with_params(max_tokens=400)
    )
    src = _hotspot_source_text(hotspot, material)
    raw = await chat.send_message(UserMessage(
        text=(f"locale_code: {profile['locale_code']}\n"
              f"market:      {profile['market']}\n"
              f"language:    {profile['language']}\n\n"
              f"=== SOURCE HOTSPOT ===\n{src}\n\n"
              f"Compose the locale-native micro-narrative. Output JSON only."),
    ))
    text = raw if isinstance(raw, str) else getattr(raw, "text", str(raw))
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        raise HTTPException(502, "AI returned no parsable hotspot variant")
    try:
        parsed = json.loads(m.group(0))
    except Exception as e:
        raise HTTPException(502, f"AI returned invalid JSON: {e}")
    return {
        "title":             (parsed.get("title") or "")[:120],
        "narrative":         (parsed.get("narrative") or "")[:400],
        "cta_copy":          (parsed.get("cta_copy") or "")[:60],
        "emotional_framing": (parsed.get("emotional_framing") or "")[:80],
        "atmosphere":        (parsed.get("atmosphere") or "")[:80],
    }


@router.get("/hotspots/{hotspot_id}/locale-variants")
def list_hotspot_variants(hotspot_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    _get_hotspot(c, hotspot_id, ctx["tenant_id"])
    rows = (c.table("hotspot_locale_variants").select(
        "id, locale_code, title, narrative, cta_copy, emotional_framing, "
        "atmosphere, ai_generated, approved_by, approved_at, "
        "generated_at, created_at, updated_at"
    ).eq("hotspot_id", hotspot_id).eq("tenant_id", ctx["tenant_id"])
       .order("locale_code").execute().data or [])
    return {"variants": rows, "total": len(rows)}


@router.post("/hotspots/{hotspot_id}/locale-variants/{locale_code}/generate")
async def generate_hotspot_variant(hotspot_id: str, locale_code: str,
                                   ctx=Depends(get_tenant_context)):
    code = _validate_locale(locale_code)
    c = db()
    hotspot = _get_hotspot(c, hotspot_id, ctx["tenant_id"])
    profile = resolve_profile(c, code)
    if not profile:
        raise HTTPException(404, f"locale profile {code} not found")
    effective_locale = profile["locale_code"]

    # Load linked material (if any) to give the LLM grounding context.
    material = None
    if hotspot.get("linked_material_id"):
        m = (c.table("material_registry").select(
            "name, category, finish, dominant_color, tags"
        ).eq("id", hotspot["linked_material_id"])
           .eq("tenant_id", ctx["tenant_id"]).limit(1).execute().data or [])
        if m:
            material = m[0]

    composed = await _ai_compose_hotspot_variant(hotspot, material, profile)
    payload = {
        **composed,
        "tenant_id":     ctx["tenant_id"],
        "hotspot_id":    hotspot_id,
        "locale_code":   effective_locale,
        "ai_generated":  True,
        "ai_metadata":   {
            "model":           "claude-sonnet-4-5-20250929",
            "locale_profile":  profile["locale_code"],
            "generated_at":    _iso(),
            "requested_locale": code,
        },
        "generated_by":  ctx["profile_id"],
        "generated_at":  _iso(),
        "approved_by":   None,
        "approved_at":   None,
        "updated_at":    _iso(),
    }

    existing = (c.table("hotspot_locale_variants").select("id")
                .eq("hotspot_id", hotspot_id)
                .eq("locale_code", effective_locale).limit(1).execute().data or [])
    if existing:
        c.table("hotspot_locale_variants").update(payload).eq("id", existing[0]["id"]).execute()
        vid = existing[0]["id"]
    else:
        vid = str(uuid.uuid4())
        c.table("hotspot_locale_variants").insert({
            "id":         vid,
            **payload,
            "created_at": _iso(),
        }).execute()

    return {"ok": True, "id": vid, "locale_code": effective_locale, "variant": composed}


@router.patch("/hotspots/{hotspot_id}/locale-variants/{locale_code}/approve")
def approve_hotspot_variant(hotspot_id: str, locale_code: str,
                            body: ApproveIn,
                            ctx=Depends(get_tenant_context)):
    code = _validate_locale(locale_code)
    c = db()
    _get_hotspot(c, hotspot_id, ctx["tenant_id"])
    payload = {
        "approved_by": ctx["profile_id"] if body.approved else None,
        "approved_at": _iso() if body.approved else None,
        "updated_at":  _iso(),
    }
    r = (c.table("hotspot_locale_variants").update(payload)
         .eq("hotspot_id", hotspot_id).eq("locale_code", code).execute())
    if not r.data:
        raise HTTPException(404, "variant not found")
    return {"ok": True, "approved": body.approved}
