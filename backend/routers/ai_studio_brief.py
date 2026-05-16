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

# Native locale derivation — Strategic Direction™ is composed NATIVELY in the
# market's language. NEVER translate. NEVER default to Italian.
_LOCALE_FROM_MARKET = {
    "IT": "it", "US": "en", "UK": "en", "FR": "fr",
    "DE": "de", "ES": "es", "UAE": "en",
}
_LANGUAGE_LABEL = {
    "it": "Italian (Italian-native, no anglicisms)",
    "en": "English (international English, refined editorial register)",
    "fr": "French (français soutenu, ton éditorial)",
    "de": "German (gehobenes Deutsch, redaktioneller Ton)",
    "es": "Spanish (español culto, registro editorial)",
}

_BRIEF_SYSTEM = """You are an editorial design strategist writing a cinematic
project briefing for an international interior design studio operating
in the luxury / hospitality / residential space.

You are NOT a chatbot. You write calm, precise, editorial design memos —
the kind a creative director would publish in a print magazine.

You write NATIVELY in the locale's language — NEVER translate from another
language. Italian for it, English for en, French for fr, German for de,
Spanish for es. Use the editorial register native to that culture.

Tone: editorial, strategic, premium.
Length: each section 2–4 sentences. NO bullet points except in `next_moves`.
NO emojis. NO generic AI phrasing.
Adapt the strategic register to the `market` provided:
  · US   → aspirational luxury, lifestyle-driven
  · DE   → precision, material honesty, restraint
  · FR   → editorial atmosphere, cultural reference
  · UAE  → statement luxury, sensorial layering
  · IT   → quiet craft, contemporary heritage
  · UK   → refined understatement
  · ES   → Mediterranean warmth, poetic gesture
Return ONLY valid JSON (no markdown, no preamble) shaped exactly as:
{
  "direction":           "...",
  "material_language":   "...",
  "emotional_positioning":"...",
  "market_adaptation":   "...",
  "design_risks":        "...",
  "next_moves":          ["...", "...", "..."],
  "headline":            "short editorial line, max 12 words, in the locale language"
}"""


def _build_user_msg(ctx: Dict[str, Any], market: str, locale: str) -> str:
    lang_label = _LANGUAGE_LABEL.get(locale, _LANGUAGE_LABEL["en"])
    return (
        f"OUTPUT LANGUAGE: {lang_label}\n"
        f"locale: {locale}\nmarket: {market}\n\n"
        f"=== PROJECT CONTEXT (verbatim — use only what's relevant) ===\n"
        f"{json.dumps(ctx, ensure_ascii=False, indent=2, default=str)[:6000]}\n\n"
        f"Write the 6-section Strategic Direction memo NATIVELY in {lang_label}. "
        f"Output JSON only."
    )


_FALLBACK_DIRECTION = {
    "it": "Direzione strategica non ancora elaborata. Apri il progetto, salva le prime ispirazioni dal Magazine o collega materiali: la direzione si comporrà sui segnali reali del cliente, del mercato e dell'advisor.",
    "en": "Strategic direction not yet composed. Open the project, save the first inspirations from the Magazine or link materials: the direction will compose itself from the real signals of client, market and advisor.",
    "fr": "Direction stratégique non encore composée. Ouvrez le projet, enregistrez les premières inspirations du Magazine ou liez des matériaux : la direction se composera à partir des signaux réels du client, du marché et du conseiller.",
    "de": "Strategische Ausrichtung noch nicht komponiert. Öffnen Sie das Projekt, speichern Sie die ersten Inspirationen aus dem Magazine oder verknüpfen Sie Materialien.",
    "es": "Dirección estratégica aún no compuesta. Abre el proyecto, guarda las primeras inspiraciones del Magazine o vincula materiales.",
}
_FALLBACK_HEADLINE = {
    "it": "Direzione in attesa di elaborazione",
    "en": "Direction awaiting composition",
    "fr": "Direction en attente de composition",
    "de": "Ausrichtung wartet auf Komposition",
    "es": "Dirección a la espera de composición",
}
_FALLBACK_MARKET_ADAPTATION = {
    "it": "Mercato di riferimento rilevato: {m}.",
    "en": "Target market detected: {m}.",
    "fr": "Marché cible détecté : {m}.",
    "de": "Erkannter Zielmarkt: {m}.",
    "es": "Mercado objetivo detectado: {m}.",
}


def _fallback_sections(market: str, locale: str = "it") -> Dict[str, Any]:
    L = locale if locale in _FALLBACK_DIRECTION else "en"
    return {
        "direction":             _FALLBACK_DIRECTION[L],
        "material_language":     "—",
        "emotional_positioning": "—",
        "market_adaptation":     _FALLBACK_MARKET_ADAPTATION[L].format(m=market or "—"),
        "design_risks":          "—",
        "next_moves":            [],
        "headline":              _FALLBACK_HEADLINE[L],
        "source":                "fallback",
    }


# ─── Models ──────────────────────────────────────────────────────────────

class GenerateBriefIn(BaseModel):
    market: Optional[str] = Field(None, description="Target market (US, DE, FR, UAE, IT, UK…)")
    locale: Optional[str] = Field(None, description="None → derived from market (native lang)")


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

    gathered = _gather_context(c, project, ctx["tenant_id"])
    if not market:
        # Infer from client country or advisor primary market
        country = (gathered.get("client") or {}).get("country")
        if country:
            market = country.upper()
        elif (gathered.get("advisor") or {}).get("markets"):
            market = gathered["advisor"]["markets"][0].upper()

    # Locale derivation — Strategic Direction is composed NATIVELY in the
    # market's language. If the caller explicitly passes a locale, that wins.
    locale = (body.locale or "").lower().strip() or _LOCALE_FROM_MARKET.get(
        (market or "IT"), "en")

    sections = _fallback_sections(market or "IT", locale=locale)
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



# ═══════════════════════════════════════════════════════════════════════
# Strategic Direction™ extensions (history · memo · promote-to-proposal)
# ═══════════════════════════════════════════════════════════════════════

@router.get("/{project_id}/strategic-direction/history")
def list_direction_history(project_id: str, ctx=Depends(get_tenant_context)):
    """Timestamped snapshots of strategic direction (one row per regeneration).
    Each row carries headline + market + locale + creator so the timeline can
    render an evolution rail ('Mediterranean warmth → Quiet luxury shift')."""
    c = db()
    _get_project(c, project_id, ctx["tenant_id"])
    rows = (c.table("project_ai_briefs").select(
        "id, market, locale, model, created_at, created_by, sections"
    ).eq("project_id", project_id).eq("tenant_id", ctx["tenant_id"])
       .order("created_at", desc=True).limit(40).execute().data or [])

    creator_ids = list({r.get("created_by") for r in rows if r.get("created_by")})
    creators: Dict[str, Dict[str, Any]] = {}
    if creator_ids:
        try:
            pr = (c.table("users_profile").select("id, first_name, last_name, avatar_url")
                  .in_("id", creator_ids).execute().data or [])
            creators = {p["id"]: p for p in pr}
        except Exception:
            pass

    out = []
    for r in rows:
        s = r.get("sections") or {}
        cr = creators.get(r.get("created_by")) or {}
        out.append({
            "id":         r["id"],
            "market":     r.get("market"),
            "locale":     r.get("locale"),
            "headline":   s.get("headline") or "Direzione",
            "created_at": r.get("created_at"),
            "created_by": {
                "id":         cr.get("id"),
                "name":       f"{cr.get('first_name') or ''} {cr.get('last_name') or ''}".strip() or "Studio",
                "avatar_url": cr.get("avatar_url"),
            } if cr else None,
        })
    return {"snapshots": out, "total": len(out)}


@router.get("/{project_id}/strategic-direction/snapshot/{snapshot_id}")
def get_direction_snapshot(project_id: str, snapshot_id: str,
                           ctx=Depends(get_tenant_context)):
    c = db()
    _get_project(c, project_id, ctx["tenant_id"])
    r = (c.table("project_ai_briefs").select(
        "id, market, locale, model, created_at, sections"
    ).eq("id", snapshot_id).eq("project_id", project_id)
       .eq("tenant_id", ctx["tenant_id"]).limit(1).execute())
    if not r.data:
        raise HTTPException(404, "snapshot not found")
    return {"brief": r.data[0]}


class MemoIn(BaseModel):
    snapshot_id: Optional[str] = None


def _compose_memo_body(sections: Dict[str, Any], market: Optional[str]) -> str:
    s = sections or {}
    headline = (s.get("headline") or "Direzione strategica").strip()
    blocks = [
        f"DIREZIONE — {headline}",
        f"Mercato di riferimento: {market or 'IT'}",
        "",
        f"POSIZIONAMENTO\n{s.get('direction') or '—'}",
        f"DIREZIONE EMOTIVA\n{s.get('emotional_positioning') or '—'}",
        f"LINGUAGGIO MATERICO\n{s.get('material_language') or '—'}",
        f"ADATTAMENTO MERCATO\n{s.get('market_adaptation') or '—'}",
        f"RISCHI\n{s.get('design_risks') or '—'}",
    ]
    nm = s.get("next_moves") or []
    if nm:
        blocks.append("MOSSE STRATEGICHE\n" + "\n".join(f"• {m}" for m in nm))
    return "\n\n".join(blocks)


@router.post("/{project_id}/strategic-direction/send-memo")
def send_direction_as_memo(project_id: str, body: MemoIn,
                           ctx=Depends(get_tenant_context)):
    """Push the current Strategic Direction into the project's timeline as
    an internal memo event. Visible to the studio team in the Timeline tab —
    NEVER exposed to the client. Aligned with the 'memory of project' model."""
    c = db()
    _get_project(c, project_id, ctx["tenant_id"])
    q = (c.table("project_ai_briefs").select(
        "id, sections, market, locale, created_at"
    ).eq("project_id", project_id).eq("tenant_id", ctx["tenant_id"]))
    if body.snapshot_id:
        q = q.eq("id", body.snapshot_id)
    else:
        q = q.order("created_at", desc=True).limit(1)
    r = q.execute()
    if not r.data:
        raise HTTPException(404, "no direction available — generate one first")
    brief = r.data[0]
    s = brief.get("sections") or {}
    headline = (s.get("headline") or "Direzione strategica").strip()
    activity_id = str(uuid.uuid4())
    try:
        c.table("project_activity").insert({
            "id":         activity_id,
            "tenant_id":  ctx["tenant_id"],
            "project_id": project_id,
            "actor_id":   ctx["profile_id"],
            "event_type": "direction.shared_with_team",
            "label":      headline,
            "ref_id":     brief["id"],
            "payload":    {
                "market":    brief.get("market"),
                "memo_body": _compose_memo_body(s, brief.get("market"))[:2000],
            },
        }).execute()
    except Exception as e:
        logger.warning(f"memo send failed: {e}")
        raise HTTPException(500, "memo non inviato")
    return {"ok": True, "activity_id": activity_id}


@router.post("/{project_id}/strategic-direction/promote-to-proposal")
def promote_direction_to_proposal(project_id: str, body: MemoIn,
                                  ctx=Depends(get_tenant_context)):
    """Create a DRAFT proposal pre-populated with the Strategic Direction
    headline as title and the positioning sections as description intro."""
    c = db()
    project = _get_project(c, project_id, ctx["tenant_id"])
    q = (c.table("project_ai_briefs").select(
        "id, sections, market, created_at"
    ).eq("project_id", project_id).eq("tenant_id", ctx["tenant_id"]))
    if body.snapshot_id:
        q = q.eq("id", body.snapshot_id)
    else:
        q = q.order("created_at", desc=True).limit(1)
    r = q.execute()
    if not r.data:
        raise HTTPException(404, "no direction available — generate one first")
    brief = r.data[0]
    s = brief.get("sections") or {}
    title = (s.get("headline") or project.get("title") or "Proposta progetto").strip()[:160]
    intro_blocks = [
        s.get("direction") or "",
        s.get("emotional_positioning") or "",
        s.get("market_adaptation") or "",
    ]
    description = "\n\n".join([b for b in intro_blocks if b and b != "—"])

    pid = str(uuid.uuid4())
    proposal = {
        "id":          pid,
        "tenant_id":   ctx["tenant_id"],
        "project_id":  project_id,
        "created_by":  ctx["profile_id"],
        "title":       title,
        "description": description,
        "status":      "draft",
        "version":     1,
        "currency":    "EUR",
        "created_at":  _iso(),
        "updated_at":  _iso(),
    }
    try:
        c.table("proposals").insert(proposal).execute()
        # Trace the originating direction in the activity log (since proposals
        # table has no metadata_json column to embed the source link).
        c.table("project_activity").insert({
            "id":         str(uuid.uuid4()),
            "tenant_id":  ctx["tenant_id"],
            "project_id": project_id,
            "actor_id":   ctx["profile_id"],
            "event_type": "proposal.created_from_direction",
            "label":      title,
            "ref_id":     pid,
            "payload":    {"direction_id": brief["id"], "market": brief.get("market")},
        }).execute()
    except Exception as e:
        logger.warning(f"promote to proposal failed: {e}")
        raise HTTPException(500, "creazione proposta non riuscita")
    return {"ok": True, "proposal_id": pid}
