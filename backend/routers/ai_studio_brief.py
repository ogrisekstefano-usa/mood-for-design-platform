"""AI Studio Brief™ — strategic, market-aware design intelligence brief.

NOT a chatbot. NOT a GPT summary. A cinematic 6-section design memo
generated from real project context (client, advisor, saved
inspirations, materials, market) and stored as immutable snapshots.

Endpoints:
  GET  /api/projects/{pid}/ai-brief           latest snapshot
  POST /api/projects/{pid}/ai-brief/generate  create a new snapshot
"""
import os
import re
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import db
from core.tenant_context import get_tenant_context

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["ai-studio-brief"])


# ─── Helpers ─────────────────────────────────────────────────────────────

def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _strip_id(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [{k: v for k, v in r.items() if k != "_id"} for r in (rows or [])]


def _get_project(c, pid: str, tid: str) -> Dict[str, Any]:
    r = (c.table("projects").select("*").eq("id", pid).eq("tenant_id", tid)
         .limit(1).execute())
    if not r.data:
        raise HTTPException(404, "project not found")
    return r.data[0]


def _gather_context(c, project: Dict[str, Any], tid: str) -> Dict[str, Any]:
    """Aggregate all real signals available about the project."""
    pid = project["id"]
    ctx: Dict[str, Any] = {
        "project": {
            "title":          project.get("title"),
            "type":           project.get("project_type"),
            "status":         project.get("status"),
            "budget_range":   project.get("budget_range"),
            "timeline":       project.get("timeline"),
            "atmosphere":     project.get("atmosphere"),
            "description":    project.get("description"),
            "metadata":       project.get("metadata_json") or {},
        },
    }

    # Advisor
    if project.get("assigned_designer_id"):
        a = (c.table("users_profile")
             .select("first_name,last_name,role,markets,languages,expertise_tags,signature_quote,editorial_tone,design_philosophy")
             .eq("id", project["assigned_designer_id"]).eq("tenant_id", tid).limit(1).execute())
        if a.data:
            ad = a.data[0]
            ctx["advisor"] = {
                "name": f"{ad.get('first_name') or ''} {ad.get('last_name') or ''}".strip() or "Advisor",
                "role": ad.get("role"),
                "markets":    ad.get("markets") or [],
                "languages":  ad.get("languages") or [],
                "expertise":  ad.get("expertise_tags") or [],
                "philosophy": ad.get("design_philosophy"),
                "tone":       ad.get("editorial_tone"),
                "signature":  ad.get("signature_quote"),
            }

    # Client (lead) signals
    lead_id = (project.get("metadata_json") or {}).get("lead_id")
    if lead_id:
        l = (c.table("leads").select("country,language,project_type,budget_range,score,source,metadata_json")
             .eq("id", lead_id).eq("tenant_id", tid).limit(1).execute())
        if l.data:
            ld = l.data[0]
            ctx["client"] = {
                "country":  ld.get("country"),
                "language": ld.get("language"),
                "project_type": ld.get("project_type"),
                "budget_range": ld.get("budget_range"),
                "score":    ld.get("score"),
                "source":   ld.get("source"),
                "answers":  (ld.get("metadata_json") or {}).get("answers"),
            }

    # Saved inspirations (moodboard_candidates) — connect to articles + hotspots
    try:
        cands = (c.table("moodboard_candidates")
                 .select("source_type, source_article_id, source_hotspot_id, "
                         "title, description, image_url, reference_type, "
                         "created_at, status, advisor_note")
                 .eq("tenant_id", tid).eq("project_id", pid)
                 .order("created_at", desc=True).limit(20).execute().data or [])
        ctx["inspirations"] = []
        for cc in cands:
            ctx["inspirations"].append({
                "type":      cc.get("source_type"),
                "reference": cc.get("reference_type"),
                "title":     cc.get("title"),
                "summary":   cc.get("description"),
                "saved_at":  cc.get("created_at"),
                "status":    cc.get("status"),
                "advisor_note": cc.get("advisor_note"),
            })
    except Exception:
        ctx["inspirations"] = []

    # Materials linked to project (soft link in metadata_json.linked_project_ids)
    try:
        rows = (c.table("material_registry")
                .select("id, name, category, finish, dominant_color, tags, metadata_json")
                .eq("tenant_id", tid).eq("status", "active").limit(500).execute().data or [])
        linked = []
        for r in rows:
            meta = r.get("metadata_json") or {}
            if pid in (meta.get("linked_project_ids") or []):
                linked.append({
                    "name":     r.get("name"),
                    "category": r.get("category"),
                    "finish":   r.get("finish"),
                    "color":    r.get("dominant_color"),
                    "tags":     r.get("tags") or [],
                })
        ctx["materials"] = linked
    except Exception:
        ctx["materials"] = []

    # Studio palette memory (top 6)
    try:
        tt = (c.table("tenants").select("theme_settings").eq("id", tid).limit(1).execute().data or [])
        sp = (tt[0].get("theme_settings") if tt else {} or {}).get("studio_palette") or []
        ctx["studio_palette"] = [p.get("hex") for p in sp[:6] if p.get("hex")]
    except Exception:
        ctx["studio_palette"] = []

    return ctx


# ─── LLM prompt ──────────────────────────────────────────────────────────

_BRIEF_SYSTEM = """You are an editorial design strategist writing a cinematic
project briefing for an international interior design studio operating
in the luxury / hospitality / residential space.

You are NOT a chatbot. You write calm, precise, editorial design memos —
the kind a creative director would publish in a print magazine.

Tone: editorial, strategic, premium. Italian as default unless `locale` says otherwise.
Length: each section 2–4 sentences. NO bullet points except in `next_moves`.
NO emojis. NO generic AI phrasing ("I think", "as an AI", etc.).
Adapt the strategic register to the `market` provided:
  · US   → aspirational luxury, lifestyle-driven
  · DE   → precision, material honesty, restraint
  · FR   → editorial atmosphere, cultural reference
  · UAE  → statement luxury, sensorial layering
  · IT   → quiet craft, contemporary heritage
  · UK   → refined understatement
Return ONLY valid JSON (no markdown, no preamble) shaped exactly as:
{
  "direction":           "...",
  "material_language":   "...",
  "emotional_positioning":"...",
  "market_adaptation":   "...",
  "design_risks":        "...",
  "next_moves":          ["...", "...", "..."],
  "headline":            "short editorial line, max 12 words"
}"""


def _build_user_msg(ctx: Dict[str, Any], market: str, locale: str) -> str:
    return (
        f"locale: {locale}\nmarket: {market}\n\n"
        f"=== PROJECT CONTEXT (verbatim — use only what's relevant) ===\n"
        f"{json.dumps(ctx, ensure_ascii=False, indent=2, default=str)[:6000]}\n\n"
        f"Write the 6-section AI Studio Brief now. Output JSON only."
    )


def _fallback_sections(market: str) -> Dict[str, Any]:
    return {
        "direction": "Briefing strategico non ancora disponibile. Genera il primo brief quando l'inserto editoriale, i materiali o le ispirazioni del cliente saranno pronti — l'AI userà quei segnali reali per costruire la direzione progettuale.",
        "material_language": "—",
        "emotional_positioning": "—",
        "market_adaptation": f"Mercato di riferimento rilevato: {market or 'non specificato'}.",
        "design_risks": "—",
        "next_moves": [],
        "headline": "Brief in attesa di generazione",
        "source": "fallback",
    }


# ─── Models ──────────────────────────────────────────────────────────────

class GenerateBriefIn(BaseModel):
    market: Optional[str] = Field(None, description="Target market (US, DE, FR, UAE, IT, UK…)")
    locale: str = Field("it")


# ─── Endpoints ───────────────────────────────────────────────────────────

@router.get("/{project_id}/ai-brief")
def get_latest_brief(project_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    _get_project(c, project_id, ctx["tenant_id"])  # tenant scope check
    r = (c.table("project_ai_briefs").select(
        "id, sections, market, locale, model, created_at"
    ).eq("project_id", project_id).eq("tenant_id", ctx["tenant_id"])
       .order("created_at", desc=True).limit(1).execute())
    if not r.data:
        return {"brief": None}
    return {"brief": r.data[0]}


@router.post("/{project_id}/ai-brief/generate")
async def generate_brief(project_id: str, body: GenerateBriefIn,
                         ctx=Depends(get_tenant_context)):
    c = db()
    project = _get_project(c, project_id, ctx["tenant_id"])
    market = (body.market or "").strip().upper() or None
    locale = (body.locale or "it").lower()

    gathered = _gather_context(c, project, ctx["tenant_id"])
    if not market:
        # Infer from client country or advisor primary market
        country = (gathered.get("client") or {}).get("country")
        if country:
            market = country.upper()
        elif (gathered.get("advisor") or {}).get("markets"):
            market = gathered["advisor"]["markets"][0].upper()

    sections = _fallback_sections(market or "IT")
    model_used = "fallback"
    key = os.environ.get("EMERGENT_LLM_KEY")
    if key:
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
            chat = (
                LlmChat(
                    api_key=key,
                    session_id=f"brief-{project_id}-{uuid.uuid4().hex[:8]}",
                    system_message=_BRIEF_SYSTEM,
                )
                .with_model("anthropic", "claude-sonnet-4-5-20250929")
                .with_params(max_tokens=900)
            )
            raw = await chat.send_message(UserMessage(text=_build_user_msg(gathered, market or "IT", locale)))
            text = raw if isinstance(raw, str) else getattr(raw, "text", str(raw))
            m = re.search(r"\{[\s\S]*\}", text)
            if m:
                parsed = json.loads(m.group(0))
                # Whitelist keys to avoid hallucinated fields
                sections = {
                    "direction":              parsed.get("direction") or "—",
                    "material_language":      parsed.get("material_language") or "—",
                    "emotional_positioning":  parsed.get("emotional_positioning") or "—",
                    "market_adaptation":      parsed.get("market_adaptation") or "—",
                    "design_risks":           parsed.get("design_risks") or "—",
                    "next_moves":             [s for s in (parsed.get("next_moves") or []) if isinstance(s, str)][:6],
                    "headline":               (parsed.get("headline") or "").strip()[:140] or "Direzione progettuale",
                    "source":                 "ai",
                }
                model_used = "claude-sonnet-4-5-20250929"
        except Exception as e:
            logger.warning(f"ai-brief LLM fallback: {e}")

    bid = str(uuid.uuid4())
    c.table("project_ai_briefs").insert({
        "id":              bid,
        "tenant_id":       ctx["tenant_id"],
        "project_id":      project_id,
        "sections":        sections,
        "context_payload": gathered,
        "market":          market,
        "locale":          locale,
        "model":           model_used,
        "created_by":      ctx["profile_id"],
    }).execute()

    return {
        "brief": {
            "id":         bid,
            "sections":   sections,
            "market":     market,
            "locale":     locale,
            "model":      model_used,
            "created_at": _iso(),
        },
    }
