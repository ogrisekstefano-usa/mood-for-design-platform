"""Phase P0.6.D — Compose Proposal™.

Editorial proposal composition engine. Transforms Strategic Direction™ +
project context (moodboards, materials, advisor, lead signals) into a
9-section cinematic editorial proposal draft.

NOT a quotation document. A luxury private design consultancy memo.

Endpoints:
  POST /api/projects/{pid}/compose-proposal
  GET  /api/proposals/{pid}/composer
  PATCH /api/proposals/{pid}/sections
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
router = APIRouter(tags=["proposal-composer"])


# ─── Constants ───────────────────────────────────────────────────────────

ALL_SECTIONS = [
    "opening", "strategic_direction", "visual_inspirations", "material_language",
    "project_vision", "suggested_scope", "investment", "timeline", "signature",
]

SECTION_LABELS = {
    "opening":             ("01 — APERTURA",          "Narrativa di apertura"),
    "strategic_direction": ("02 — DIREZIONE",         "Direzione strategica"),
    "visual_inspirations": ("03 — ISPIRAZIONI",       "Riferimenti visivi"),
    "material_language":   ("04 — LINGUAGGIO MATERICO","Materia e finitura"),
    "project_vision":      ("05 — VISIONE",           "Visione del progetto"),
    "suggested_scope":     ("06 — AMBITO",            "Ambito d'intervento"),
    "investment":          ("07 — INVESTIMENTO",      "Posizionamento d'investimento"),
    "timeline":            ("08 — TEMPISTICA",        "Direzione temporale"),
    "signature":           ("09 — FIRMA",             "Firma dello studio"),
}

INVESTMENT_TIERS = {
    "essential_direction":   "Essential Direction",
    "elevated_residential":  "Elevated Residential",
    "signature_hospitality": "Signature Hospitality",
    "collector_level":       "Collector-Level Execution",
}

TONE_HINTS = {
    "minimal_editorial":   "calmo, editoriale, asciutto, ritmo sospeso",
    "warm_mediterranean":  "caldo, mediterraneo, sensoriale, gesto antico",
    "quiet_luxury":        "lusso silenzioso, materiali nobili senza ostentazione",
    "architectural":       "rigore architettonico, geometrie pulite, materia onesta",
    "bold_hospitality":    "ospitalità d'autore, scenografia sensoriale, presenza forte",
    "collector_level":     "collezionismo, opere d'arte, dialogo con l'autore",
}

# Native locale derivation — proposal is composed NATIVELY in the locale's
# culture. The default locale_code maps from the user's market selection.
MARKET_TO_LOCALE_CODE = {
    "IT": "IT_IT", "US": "EN_US", "UK": "EN_GB", "GB": "EN_GB",
    "AE": "EN_AE", "UAE": "EN_AE",
    "DE": "DE_DE", "FR": "FR_FR", "ES": "ES_ES",
}

# Market-intent-preserving fallback chain — NEVER fall back to a culturally
# unrelated locale (EN_AE prestige must NOT collapse into IT_IT craftsmanship).
LOCALE_FALLBACK_CHAIN: Dict[str, List[str]] = {
    "EN_AE": ["EN_GB", "EN_US"],
    "EN_GB": ["EN_US"],
    "EN_US": ["EN_GB"],
    "FR_FR": ["IT_IT", "EN_GB"],
    "DE_DE": ["EN_GB"],
    "ES_ES": ["IT_IT", "EN_GB"],
    "IT_IT": ["EN_GB"],
}


def _load_locale_profile(c, locale_code: str) -> Optional[Dict[str, Any]]:
    r = (c.table("locale_profiles").select("*")
         .eq("locale_code", locale_code.upper()).limit(1).execute())
    return r.data[0] if r.data else None


def _resolve_profile(c, locale_code: str) -> Optional[Dict[str, Any]]:
    """Load profile, falling back along the market-intent-preserving chain."""
    p = _load_locale_profile(c, locale_code)
    if p:
        return p
    for alt in LOCALE_FALLBACK_CHAIN.get(locale_code, []):
        alt_p = _load_locale_profile(c, alt)
        if alt_p:
            logger.warning(
                f"compose locale fallback {locale_code} → {alt} "
                f"(closest cultural register)"
            )
            return alt_p
    return None


# ─── Helpers ─────────────────────────────────────────────────────────────

def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_project(c, pid: str, tid: str) -> Dict[str, Any]:
    r = (c.table("projects").select("*").eq("id", pid).eq("tenant_id", tid)
         .limit(1).execute())
    if not r.data:
        raise HTTPException(404, "project not found")
    return r.data[0]


def _gather_context(c, project: Dict[str, Any], tid: str) -> Dict[str, Any]:
    """Build the real-context payload that fuels the LLM composition."""
    pid = project["id"]
    ctx: Dict[str, Any] = {
        "project": {
            "title":        project.get("title"),
            "type":         project.get("project_type"),
            "budget":       project.get("budget_range"),
            "timeline":     project.get("timeline"),
            "description":  project.get("description"),
            "metadata":     project.get("metadata_json") or {},
        },
    }

    # Latest Strategic Direction snapshot
    try:
        d = (c.table("project_ai_briefs").select("id, sections, market, created_at")
             .eq("project_id", pid).eq("tenant_id", tid)
             .order("created_at", desc=True).limit(1).execute().data or [])
        if d:
            ctx["strategic_direction"] = d[0]
    except Exception:
        pass

    # Moodboards (top 6)
    try:
        mbs = (c.table("moodboards").select("id, title, status, created_at")
               .eq("project_id", pid).eq("tenant_id", tid)
               .order("created_at", desc=True).limit(6).execute().data or [])
        ctx["moodboards"] = mbs
    except Exception:
        ctx["moodboards"] = []

    # Inspirations (saved hotspots)
    try:
        ins = (c.table("moodboard_candidates").select(
            "title, description, image_url, reference_type, advisor_note, source_article_id"
        ).eq("project_id", pid).eq("tenant_id", tid)
           .order("created_at", desc=True).limit(15).execute().data or [])
        ctx["inspirations"] = ins
    except Exception:
        ctx["inspirations"] = []

    # Materials linked via metadata_json.linked_project_ids
    try:
        rows = (c.table("material_registry")
                .select("name, category, finish, dominant_color, tags, metadata_json")
                .eq("tenant_id", tid).eq("status", "active").limit(500)
                .execute().data or [])
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

    # Advisor identity
    if project.get("assigned_to"):
        try:
            a = (c.table("users_profile").select(
                "first_name,last_name,avatar_url,metadata_json"
            ).eq("id", project["assigned_to"]).eq("tenant_id", tid).limit(1).execute().data or [])
            if a:
                p = a[0]
                meta = p.get("metadata_json") or {}
                ctx["advisor"] = {
                    "name":        f"{p.get('first_name') or ''} {p.get('last_name') or ''}".strip(),
                    "role_label":  meta.get("role_label"),
                    "bio_short":   meta.get("bio_short"),
                    "languages":   meta.get("languages") or [],
                    "markets":     meta.get("markets") or [],
                    "avatar_url":  p.get("avatar_url"),
                }
        except Exception:
            pass

    # Client / lead signals
    lead_id = (project.get("metadata_json") or {}).get("lead_id") or project.get("lead_id")
    if lead_id:
        try:
            le = (c.table("leads").select(
                "country, language, project_type, budget_range, score, metadata_json"
            ).eq("id", lead_id).eq("tenant_id", tid).limit(1).execute().data or [])
            if le:
                ctx["client"] = le[0]
        except Exception:
            pass

    # Tenant identity (studio name + tagline)
    try:
        tt = (c.table("tenants").select("name, slug, branding")
              .eq("id", tid).limit(1).execute().data or [])
        if tt:
            ctx["studio"] = {
                "name":     tt[0].get("name"),
                "slug":     tt[0].get("slug"),
                "branding": tt[0].get("branding") or {},
            }
    except Exception:
        pass

    return ctx


# ─── LLM prompt ──────────────────────────────────────────────────────────

_COMPOSER_SYSTEM_TEMPLATE = """You are the editorial creative director of an
international luxury interior design studio. You compose project proposals
that read like editorial design memos — never as construction estimates or
CRM exports.

You write NATIVELY for this locale's audience. You DO NOT translate from
another locale. EN_US, EN_GB and EN_AE share English but are fundamentally
different cultural positionings — never share vocabulary across them.

═══ LOCALE PROFILE ({locale_code}) ═══
{system_brief}

EMOTIONAL STYLE:      {emotional_style}
LUXURY STYLE:         {luxury_style}
HOSPITALITY STYLE:    {hospitality_style}
EDITORIAL TONE:       {editorial_tone}
CTA STYLE:            {cta_style}
INVESTMENT LANGUAGE:  {investment_language}
ATMOSPHERE LANGUAGE:  {atmosphere_language}

FOCUS AREAS (conceptual backbone):
  {focus}

VOCABULARY (prefer these terms; never use generic alternatives):
  {vocabulary}

FORBIDDEN PATTERNS (never use):
  {forbidden}

POSITIONING EXAMPLES (tonal register we want):
  {examples}

═══ RULES ═══
• Reposition, do NOT translate.
• Write in this locale's language ({language}).
• NEVER mention AI, GPT, "generated by", or system meta-language.
• Each section: 2–4 sentences of warm editorial prose. NO bullet lists.

Output: SINGLE valid JSON object — no markdown, no preamble.
{{
  "headline":           "evocative project line, max 14 words, in this locale's language",
  "opening":            "...",
  "strategic_direction":"...",
  "visual_inspirations":"...",
  "material_language":  "...",
  "project_vision":     "...",
  "suggested_scope":    "...",
  "investment":         "...",
  "timeline":           "...",
  "signature":          "..."
}}

Adapt every section to:
  · narrative tone
  · investment tier
  · project type (residential / hospitality / retail / developer / investor / private)
  · advisor identity"""


def _build_composer_system(profile: Dict[str, Any]) -> str:
    return _COMPOSER_SYSTEM_TEMPLATE.format(
        locale_code=profile.get("locale_code", ""),
        system_brief=profile.get("system_brief", ""),
        emotional_style=profile.get("emotional_style", ""),
        luxury_style=profile.get("luxury_style", ""),
        hospitality_style=profile.get("hospitality_style", ""),
        editorial_tone=profile.get("editorial_tone", ""),
        cta_style=profile.get("cta_style", ""),
        investment_language=profile.get("investment_language", ""),
        atmosphere_language=profile.get("atmosphere_language", ""),
        focus=", ".join(profile.get("focus") or []),
        vocabulary=", ".join(profile.get("vocabulary_rules") or []),
        forbidden=", ".join(profile.get("forbidden_patterns") or []),
        examples="\n  ".join(profile.get("positioning_examples") or []),
        language=profile.get("language", "en"),
    )


def _build_user_msg(ctx: Dict[str, Any], *, style: str, tone: str,
                    locale_code: str, investment_tier: str,
                    sections_included: List[str]) -> str:
    tier_label = INVESTMENT_TIERS.get(investment_tier, "Essential Direction")
    tone_hint = TONE_HINTS.get(tone, "")
    return (
        f"locale_code: {locale_code}\n"
        f"project_style: {style}\n"
        f"narrative_tone: {tone}  ({tone_hint})\n"
        f"investment_tier: {tier_label}\n"
        f"sections_required: {json.dumps(sections_included)}\n\n"
        f"=== PROJECT CONTEXT (verbatim) ===\n"
        f"{json.dumps(ctx, ensure_ascii=False, indent=2, default=str)[:7500]}\n\n"
        f"Compose the editorial proposal natively for the locale profile above. "
        f"Output JSON ONLY."
    )


# Locale-aware fallback (used only when LLM is unreachable)
_FALLBACK_OPENING = {
    "it": "Bozza di proposta in attesa di composizione. Genera la direzione strategica e collega moodboard, materiali e ispirazioni per ottenere una proposta editoriale coerente.",
    "en": "Proposal draft awaiting composition. Generate the strategic direction and link moodboards, materials and inspirations to obtain a coherent editorial proposal.",
    "fr": "Brouillon de proposition en attente de composition. Générez la direction stratégique et reliez moodboards, matériaux et inspirations pour obtenir une proposition éditoriale cohérente.",
    "de": "Vorschlagsentwurf wartet auf die Komposition. Erzeugen Sie die strategische Ausrichtung und verknüpfen Sie Moodboards, Materialien und Inspirationen.",
    "es": "Borrador de propuesta a la espera de composición. Genera la dirección estratégica y vincula moodboards, materiales e inspiraciones.",
}
_FALLBACK_HEADLINE = {
    "it": "Proposta editoriale per {p}",
    "en": "Editorial proposal for {p}",
    "fr": "Proposition éditoriale pour {p}",
    "de": "Editoriale Proposal für {p}",
    "es": "Propuesta editorial para {p}",
}
_FALLBACK_INVESTMENT = {
    "it": "Posizionamento d'investimento: {t}. Mercato di riferimento {m}.",
    "en": "Investment positioning: {t}. Target market {m}.",
    "fr": "Positionnement d'investissement : {t}. Marché cible {m}.",
    "de": "Investitionspositionierung: {t}. Zielmarkt {m}.",
    "es": "Posicionamiento de inversión: {t}. Mercado objetivo {m}.",
}


def _fallback_sections(*, market: str, tier: str, project_title: str,
                       locale: str = "it") -> Dict[str, Any]:
    tier_label = INVESTMENT_TIERS.get(tier, "Essential Direction")
    L = locale if locale in _FALLBACK_OPENING else "en"
    return {
        "headline":            _FALLBACK_HEADLINE[L].format(p=project_title or "—"),
        "opening":             _FALLBACK_OPENING[L],
        "strategic_direction": "—",
        "visual_inspirations": "—",
        "material_language":   "—",
        "project_vision":      "—",
        "suggested_scope":     "—",
        "investment":          _FALLBACK_INVESTMENT[L].format(t=tier_label, m=market or "IT"),
        "timeline":            "—",
        "signature":           "—",
    }


# ─── Pydantic models ─────────────────────────────────────────────────────

class ComposeIn(BaseModel):
    style:                Optional[str] = Field(None)
    narrative_tone:       Optional[str] = Field(None)
    market:               Optional[str] = Field(None, description="2-letter market shortcut (IT, US, UAE, …)")
    locale_code:          Optional[str] = Field(None, description="Composite locale (IT_IT, EN_US, EN_AE, …) — wins over market")
    locale:               Optional[str] = Field(None, description="Deprecated — use locale_code")
    investment_tier:      Optional[str] = Field(None)
    show_numeric_pricing: bool          = Field(False)
    sections_included:    Optional[List[str]] = Field(None)


class SectionsPatch(BaseModel):
    sections:          Optional[Dict[str, Any]] = None
    sections_included: Optional[List[str]]      = None
    style:             Optional[str]            = None
    narrative_tone:    Optional[str]            = None
    investment_tier:   Optional[str]            = None
    market:            Optional[str]            = None
    show_numeric_pricing: Optional[bool]        = None
    cover_image_url:   Optional[str]            = None
    title:             Optional[str]            = None


# ─── Endpoints ───────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/compose-proposal", status_code=201)
async def compose_proposal(project_id: str, body: ComposeIn,
                           ctx=Depends(get_tenant_context)):
    c = db()
    project = _get_project(c, project_id, ctx["tenant_id"])
    style = (body.style or "residential").lower()
    tone  = (body.narrative_tone or "minimal_editorial").lower()
    tier  = (body.investment_tier or "essential_direction").lower()

    gathered = _gather_context(c, project, ctx["tenant_id"])

    # Locale resolution priority:
    #   1. body.locale_code (explicit composite code)
    #   2. market → locale_code mapping
    #   3. inferred from strategic_direction snapshot, client country, advisor
    #   4. default IT_IT
    locale_code = (body.locale_code or "").upper().strip() or None
    if not locale_code:
        market = (body.market or "").strip().upper() or None
        if not market:
            sd = gathered.get("strategic_direction") or {}
            market = (sd.get("market")
                      or (gathered.get("client") or {}).get("country")
                      or ((gathered.get("advisor") or {}).get("markets") or [None])[0]
                      or "IT").upper()
        locale_code = MARKET_TO_LOCALE_CODE.get(market, "IT_IT")

    profile = _resolve_profile(c, locale_code)
    if not profile:
        # exhausted fallback chain — every seeded profile is broken / missing
        raise HTTPException(500, "no locale profile available — seed required")
    # If a fallback kicked in, the effective locale is the profile we got.
    locale_code = profile["locale_code"]

    language = profile["language"]
    market_label = profile["market"]

    sections_included = body.sections_included or ALL_SECTIONS
    sections_included = [s for s in sections_included if s in ALL_SECTIONS] or ALL_SECTIONS

    headline = None
    composed = _fallback_sections(market=market_label, tier=tier,
                                  project_title=project.get("title"),
                                  locale=language)
    key = os.environ.get("EMERGENT_LLM_KEY")
    if key:
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
            chat = (
                LlmChat(
                    api_key=key,
                    session_id=f"compose-{project_id}-{uuid.uuid4().hex[:8]}",
                    system_message=_build_composer_system(profile),
                )
                .with_model("anthropic", "claude-sonnet-4-5-20250929")
                .with_params(max_tokens=1800)
            )
            raw = await chat.send_message(UserMessage(
                text=_build_user_msg(
                    gathered, style=style, tone=tone,
                    locale_code=locale_code, investment_tier=tier,
                    sections_included=sections_included,
                ),
            ))
            text = raw if isinstance(raw, str) else getattr(raw, "text", str(raw))
            m = re.search(r"\{[\s\S]*\}", text)
            if m:
                parsed = json.loads(m.group(0))
                headline = (parsed.get("headline") or "").strip()[:160] or None
                # Whitelist only known section keys
                for sk in ALL_SECTIONS:
                    if isinstance(parsed.get(sk), str) and parsed[sk].strip():
                        composed[sk] = parsed[sk].strip()
        except Exception as e:
            logger.warning(f"compose proposal LLM fallback: {e}")

    title = headline or composed.get("headline") or project.get("title") or "Proposta progetto"

    # Build the persisted shape
    sd_id = (gathered.get("strategic_direction") or {}).get("id")
    cover_url = None
    insp = gathered.get("inspirations") or []
    if insp:
        cover_url = next((i.get("image_url") for i in insp if i.get("image_url")), None)

    proposal_id = str(uuid.uuid4())
    payload = {
        "id":          proposal_id,
        "tenant_id":   ctx["tenant_id"],
        "project_id":  project_id,
        "created_by":  ctx["profile_id"],
        "title":       title[:200],
        "description": composed.get("opening", "")[:600],
        "status":      "draft",
        "version":     1,
        "currency":    "EUR",
        "sections":    composed,
        "sections_included":   sections_included,
        "style":       style,
        "narrative_tone": tone,
        "investment_tier": tier,
        "market":      market_label,
        "locale_code": locale_code,
        "cover_image_url": cover_url,
        "source_direction_id": sd_id,
        "show_numeric_pricing": body.show_numeric_pricing,
        "created_at":  _iso(),
        "updated_at":  _iso(),
    }
    # Persist the active locale inside sections JSONB for frontend chrome adaptation.
    payload["sections"] = {**composed, "_locale": language, "_locale_code": locale_code}
    try:
        c.table("proposals").insert(payload).execute()
        c.table("project_activity").insert({
            "id":         str(uuid.uuid4()),
            "tenant_id":  ctx["tenant_id"],
            "project_id": project_id,
            "actor_id":   ctx["profile_id"],
            "event_type": "proposal.composed",
            "label":      title[:200],
            "ref_id":     proposal_id,
            "payload":    {"style": style, "tone": tone,
                           "locale_code": locale_code, "market": market_label,
                           "tier": tier},
        }).execute()
    except Exception as e:
        logger.warning(f"compose proposal insert failed: {e}")
        raise HTTPException(500, "creazione proposta non riuscita")

    return {"ok": True, "proposal": {**payload, "_id": None}}


@router.get("/proposals/{proposal_id}/composer")
def get_composer_proposal(proposal_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    r = (c.table("proposals").select("*").eq("id", proposal_id)
         .eq("tenant_id", ctx["tenant_id"]).limit(1).execute())
    if not r.data:
        raise HTTPException(404, "proposal not found")
    p = r.data[0]

    # Hydrate moodboards live (always fresh)
    try:
        mbs = (c.table("moodboards").select("id, title, status, cover_url")
               .eq("project_id", p["project_id"]).eq("tenant_id", ctx["tenant_id"])
               .order("created_at", desc=True).limit(8).execute().data or [])
    except Exception:
        mbs = []

    # Hydrate materials linked to project
    materials: List[Dict[str, Any]] = []
    try:
        rows = (c.table("material_registry")
                .select("id, name, category, finish, dominant_color, tags, "
                        "primary_asset_id, metadata_json")
                .eq("tenant_id", ctx["tenant_id"]).eq("status", "active")
                .limit(500).execute().data or [])
        asset_ids = []
        for r0 in rows:
            meta = r0.get("metadata_json") or {}
            if p["project_id"] in (meta.get("linked_project_ids") or []):
                materials.append(r0)
                if r0.get("primary_asset_id"):
                    asset_ids.append(r0["primary_asset_id"])
        asset_url_by_id: Dict[str, Optional[str]] = {}
        if asset_ids:
            assets = (c.table("media_library").select("id, public_url, thumbnail_url")
                     .in_("id", asset_ids).execute().data or [])
            for a in assets:
                asset_url_by_id[a["id"]] = a.get("public_url") or a.get("thumbnail_url")
        materials = [{
            "id":             m["id"],
            "name":           m.get("name"),
            "category":       m.get("category"),
            "finish":         m.get("finish"),
            "dominant_color": m.get("dominant_color"),
            "tags":           m.get("tags") or [],
            "cover_url":      asset_url_by_id.get(m.get("primary_asset_id")),
        } for m in materials]
    except Exception as e:
        logger.warning(f"composer material hydration: {e}")

    # Advisor + project
    advisor = None
    project = None
    try:
        pr = (c.table("projects").select("*").eq("id", p["project_id"])
              .eq("tenant_id", ctx["tenant_id"]).limit(1).execute().data or [])
        if pr:
            project = pr[0]
            if project.get("assigned_to"):
                a = (c.table("users_profile").select(
                    "id, first_name, last_name, avatar_url, metadata_json"
                ).eq("id", project["assigned_to"]).eq("tenant_id", ctx["tenant_id"])
                   .limit(1).execute().data or [])
                if a:
                    ap = a[0]
                    meta = ap.get("metadata_json") or {}
                    advisor = {
                        "id":           ap["id"],
                        "name":         f"{ap.get('first_name') or ''} {ap.get('last_name') or ''}".strip(),
                        "avatar_url":   ap.get("avatar_url"),
                        "role_label":   meta.get("role_label"),
                        "bio_short":    meta.get("bio_short"),
                    }
    except Exception:
        pass

    return {
        "proposal":   {k: v for k, v in p.items() if k != "_id"},
        "moodboards": mbs,
        "materials":  materials,
        "advisor":    advisor,
        "project":    {"id": project.get("id"), "title": project.get("title"),
                       "project_type": project.get("project_type")} if project else None,
    }


@router.patch("/proposals/{proposal_id}/sections")
def patch_proposal_sections(proposal_id: str, body: SectionsPatch,
                            ctx=Depends(get_tenant_context)):
    c = db()
    r = (c.table("proposals").select("id, sections")
         .eq("id", proposal_id).eq("tenant_id", ctx["tenant_id"])
         .limit(1).execute())
    if not r.data:
        raise HTTPException(404, "proposal not found")
    current = r.data[0]
    patch: Dict[str, Any] = {"updated_at": _iso()}

    if body.sections is not None:
        merged = current.get("sections") or {}
        merged.update({k: v for k, v in body.sections.items() if isinstance(v, str)})
        patch["sections"] = merged
    for k in ("sections_included", "style", "narrative_tone", "investment_tier",
              "market", "show_numeric_pricing", "cover_image_url", "title"):
        val = getattr(body, k)
        if val is not None:
            patch[k] = val

    c.table("proposals").update(patch).eq("id", proposal_id).execute()
    return {"ok": True}
