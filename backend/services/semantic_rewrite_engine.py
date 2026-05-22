"""SPRINT ITER135 · ALE Semantic Localization™ · Cultural Narrative Engine™.

Difference from `relational_translation.translate()`:
  - `translate()` produces a faithful translation. Cinematic adjectives are
    preserved but the structure stays close to the source.
  - `semantic_rewrite()` is asked to **REINTERPRET** the source for the
    target market: tone, rhythm, vocabulary, CTA intensity and cultural
    register are reset per market, not transposed.

Same LLM stack as the rest of ALE (Emergent LLM key · Claude Sonnet 4.5)
but with a different system prompt — the editorial voice of an in-market
copywriter. Fallback to literal translation if the model fails.

Usage:

    from services.semantic_rewrite_engine import semantic_rewrite, batch_rewrite_key

    # Single-locale rewrite
    result = semantic_rewrite(
        source_text="Materia che parla.",
        source_locale='it',
        target_locale='en-US',
        key='material_view.header.title',
        market_context={"audience": "studio_owners",
                        "luxury_tier": "ultra_luxury"},
    )
    # → "Materials with narrative presence."

    # Generate ALL locales for a missing key in one shot
    rewrites = batch_rewrite_key(
        source_text="Materia che parla.",
        source_locale='it',
        key='material_view.header.title',
    )
    # → {'en-US': '...', 'en-GB': '...', 'fr-FR': '...', ...}
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import time
from dataclasses import dataclass, asdict
from typing import Optional

logger = logging.getLogger(__name__)

DEFAULT_MODEL = ("anthropic", "claude-sonnet-4-5-20250929")

# All 7 operational locales of the platform.
ALL_LOCALES = ("it-IT", "en-US", "en-GB", "fr-FR", "de-DE", "es-ES", "ar")


# ─── Market-aware editorial voices ─────────────────────────────────────
# Each profile is appended to the system prompt at rewrite time.
MARKET_VOICES = {
    "it-IT": {
        "label": "Italia · Milano",
        "tone": "design culture, project rigor, atelier discipline",
        "rhythm": "measured, structural, contemplative",
        "vocabulary": "atmosfera, materia, progetto, atelier, voce, "
                      "narrazione, eredità, mestiere, tessitura, geometria",
        "cta": "low-key invitations, no urgency markers, no exclamation",
        "luxury_positioning": "rigour as luxury · quiet authority · "
                              "the weight of well-made things",
        "voice_directive": (
            "Italian copy must read like the work of a Milanese editorial "
            "studio: confident, precise, with a hand for materia and "
            "progetto. Never call it a 'platform' or a 'tool'. It is an "
            "atelier, a journey, a chapter. Avoid English borrowings."),
    },
    "en-US": {
        "label": "United States · cinematic",
        "tone": "cinematic, hospitality-grade, emotionally textured",
        "rhythm": "musical, rising — 'opening, build, resolve' arcs",
        "vocabulary": "presence, narrative, atmosphere, discipline, "
                      "earned, drawn, gathered, anchored, layered, told",
        "cta": "warm imperatives, never pushy, never SaaS-y",
        "luxury_positioning": "American luxury · earned, lived-in, "
                              "narrative-rich · NOT aspirational shouting",
        "voice_directive": (
            "EN-US copy must feel cinematic and editorial — the voice of "
            "an Architectural Digest senior editor, not a SaaS marketer. "
            "No 'Get started.' No 'Sign up.' No 'Boost.' No 'Empower.' "
            "Use sensorial verbs (drawn, gathered, anchored, told). "
            "Sentences may breathe with em dashes. Never use 'guys', "
            "'awesome', 'amazing', 'rockstar', 'ninja'."),
    },
    "en-GB": {
        "label": "United Kingdom · curatorial",
        "tone": "understated, curatorial, restrained",
        "rhythm": "compact, cadenced, almost editorial-prose",
        "vocabulary": "considered, curated, archival, registered, "
                      "language, library, tradition, intent",
        "cta": "polite invitations, never imperatives in caps",
        "luxury_positioning": "British understatement · the discipline "
                              "of restraint · scholarly atelier",
        "voice_directive": (
            "EN-GB copy must feel like the editorial voice of The World "
            "of Interiors or House & Garden UK — restrained, with "
            "scholarly references, never enthusiastic. Use British "
            "spelling (favour, colour, recognise). Never 'Awesome', "
            "never 'amazing', avoid 'incredibly'. Prefer 'considered', "
            "'measured', 'observed'."),
    },
    "fr-FR": {
        "label": "France · narration sensorielle",
        "tone": "sensorial narration, intellectual, almost philosophical",
        "rhythm": "long sentences punctuated by sharp, declarative coda",
        "vocabulary": "matière, présence, atelier, geste, écriture, "
                      "récit, sensorialité, regard, mémoire, lumière",
        "cta": "evocative invitations, never commercial",
        "luxury_positioning": "French luxury · intellectual sensuality · "
                              "the dignity of the gesture",
        "voice_directive": (
            "Le français doit ressembler à un texte de Connaissance des "
            "Arts ou AD France : phrases longues, sensorielles, avec un "
            "point fort à la fin. Vocabulaire : matière, présence, "
            "regard, geste, atelier, écriture. Pas d'anglicismes "
            "(éviter 'tool', 'platform', 'workflow'). Tutoiement "
            "jamais — vouvoiement éditorial."),
    },
    "de-DE": {
        "label": "Deutschland · architektonische Sprache",
        "tone": "precise, architectural, almost engineering-grade",
        "rhythm": "structural, declarative, weighted",
        "vocabulary": "Materialität, Präsenz, Atelier, Gestaltung, "
                      "Sprache, Werkstatt, Disziplin, Haltung",
        "cta": "factual invitations, never theatrical",
        "luxury_positioning": "German luxury · the dignity of precision · "
                              "design as discipline, not decoration",
        "voice_directive": (
            "Deutsch soll wie ein Editorial aus der AIT oder dem Form "
            "Magazin klingen — präzise, mit architektonischer Klarheit. "
            "Keine Marketingsprache. Substantive großschreiben. "
            "Vermeiden: 'powern', 'boosten', 'launchen'. Bevorzugen: "
            "Materialität, Haltung, Gestaltung, Disziplin."),
    },
    "es-ES": {
        "label": "España · identidad narrativa",
        "tone": "narrative identity, sensorial, with quiet warmth",
        "rhythm": "rounded, melodic, with image-led openings",
        "vocabulary": "materia, presencia, atelier, gesto, identidad, "
                      "atmósfera, relato, mirada, oficio",
        "cta": "warm invitations, never imperative-shouty",
        "luxury_positioning": "Spanish luxury · the warmth of craft · "
                              "the elegance of the lived-in",
        "voice_directive": (
            "El español debe sonar a editorial de AD España o "
            "ELLE Decor — sensorial, cálido, con vocabulario de oficio "
            "(materia, oficio, atelier, gesto, mirada). Evitar "
            "anglicismos. Trato siempre cortés (usted en CTAs)."),
    },
    "ar": {
        "label": "العربية · المواد كلغة حسية",
        "tone": "monumental, aspirational, sensorial",
        "rhythm": "balanced classical Arabic, dignified",
        "vocabulary": "المادة، الحضور، الورشة، السرد، الذاكرة، الأثر",
        "cta": "dignified invitations, never imperatives in dialect",
        "luxury_positioning": "Gulf luxury · monumentality · the weight "
                              "of presence in the room",
        "voice_directive": (
            "Modern Standard Arabic, classical register, no dialect. "
            "Vocabulary leans on craft and presence (المادة، الحضور، "
            "الورشة، السرد). Right-to-left punctuation (، ؛ ؟). Never "
            "transliterate brand names — keep MOOD, Atelier, Studio in "
            "Latin script."),
    },
}


# ─── Per-key contextual hints ──────────────────────────────────────────
# When the loop hits a key it cannot otherwise contextualise, these hints
# steer the rewrite toward the right register.
SECTION_HINTS = {
    "blueprint.language": "editorial governance cockpit · admin surface",
    "inspirations":       "studio's curatorial atlas of brands and materials",
    "material_view":      "material library · sensorial classification",
    "cultural_editions":  "long-form editorial features per market",
    "journey":            "client journey · long-form narrative",
    "moodboards":         "moodboard composer · visual storytelling",
    "crm":                "relationships, never transactions",
    "studio_voice":       "language identity governance · the studio's atelier voice",
    "editorial":          "publishing surface · magazine cadence",
    "team":               "studio members and discipline",
    "settings":           "studio configuration · understated, never SaaS",
    "nav":                "navigation labels · 1–2 words, atelier vocabulary",
    "common":             "shared UI atoms · short, precise, atelier register",
}


def _section_hint(key: str) -> str:
    if not key:
        return "studio interior · atelier register · NOT SaaS"
    parts = key.split(".")
    for n in range(min(len(parts), 3), 0, -1):
        prefix = ".".join(parts[:n])
        if prefix in SECTION_HINTS:
            return SECTION_HINTS[prefix]
    return SECTION_HINTS.get(parts[0], "studio interior · atelier register")


@dataclass
class RewriteResult:
    target_locale: str
    text: str
    rationale: Optional[str]
    model: Optional[str]
    duration_ms: int
    cached: bool
    fallback: bool


# ─── In-process cache ──────────────────────────────────────────────────
# SHA-1(source|target|key|directive) → RewriteResult. The Translation
# Memory layer (`editorial_translations` table) handles persistence; this
# cache only avoids re-paying the LLM cost during a single loop run.
_CACHE: dict[str, RewriteResult] = {}


def _ck(*parts: str) -> str:
    return hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()


def _build_prompt(
    source_text: str,
    source_locale: str,
    target_locale: str,
    key: Optional[str],
    market_context: Optional[dict],
) -> str:
    voice = MARKET_VOICES.get(target_locale) or MARKET_VOICES.get("en-US")
    section = _section_hint(key or "")
    ctx = market_context or {}
    audience  = ctx.get("audience", "studio_owners")
    luxury    = ctx.get("luxury_tier", "ultra_luxury")
    page_type = ctx.get("page_type", "")

    return (
        "You are MOOD for DESIGN™'s in-market editorial copywriter for "
        f"{voice['label']}.\n\n"
        "TASK: Rewrite — DO NOT translate — the following source string for "
        f"the target locale `{target_locale}`. Produce one sentence (or one "
        "phrase, depending on the source) that an editor based in this market "
        "would actually write from scratch.\n\n"
        f"SOURCE LOCALE: {source_locale}\n"
        f"SOURCE STRING: {source_text}\n\n"
        f"REGISTRY KEY: {key or '—'}\n"
        f"UI SECTION: {section}\n"
        f"AUDIENCE: {audience}\n"
        f"LUXURY TIER: {luxury}\n"
        f"PAGE TYPE: {page_type or 'editorial cockpit'}\n\n"
        f"VOICE DIRECTIVE — {voice['label']}:\n"
        f"  · TONE: {voice['tone']}\n"
        f"  · RHYTHM: {voice['rhythm']}\n"
        f"  · VOCABULARY: {voice['vocabulary']}\n"
        f"  · CTA REGISTER: {voice['cta']}\n"
        f"  · LUXURY POSITIONING: {voice['luxury_positioning']}\n\n"
        f"EDITORIAL DIRECTIVE: {voice['voice_directive']}\n\n"
        "HARD CONSTRAINTS:\n"
        " · DO NOT include the source string verbatim.\n"
        " · DO NOT include English boilerplate ('platform', 'tool', "
        "'workflow', 'launch') unless naming a real product.\n"
        " · DO NOT use exclamation marks or emoji.\n"
        " · DO preserve any {{placeholder}} tokens unchanged.\n"
        " · DO match approximate length of source (±30%).\n"
        " · OUTPUT FORMAT: one line, no quotes, no preamble. Just the "
        "rewritten copy.\n"
    )


def _emergent_key() -> str:
    k = os.environ.get("EMERGENT_LLM_KEY")
    if not k:
        raise RuntimeError("EMERGENT_LLM_KEY is not configured")
    return k


def _run_chat(prompt: str, session_id: str) -> str:
    from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
    chat = LlmChat(
        api_key=_emergent_key(),
        session_id=session_id,
        system_message="You are MOOD for DESIGN™'s in-market editorial copywriter.",
    ).with_model(*DEFAULT_MODEL)

    async def _call():
        return await chat.send_message(UserMessage(text=prompt))
    try:
        out = asyncio.run(_call())
    except RuntimeError:
        loop = asyncio.new_event_loop()
        try:
            out = loop.run_until_complete(_call())
        finally:
            loop.close()
    if isinstance(out, dict):
        out = out.get("content", "") or ""
    out = (out or "").strip()
    if out.startswith('"') and out.endswith('"'):
        out = out[1:-1].strip()
    # Strip leading "Rewritten:" or similar preambles the model occasionally adds.
    for prefix in ("rewritten:", "output:", "result:", "answer:"):
        if out.lower().startswith(prefix):
            out = out[len(prefix):].strip()
    return out


def semantic_rewrite(
    source_text: str,
    source_locale: str,
    target_locale: str,
    key: Optional[str] = None,
    market_context: Optional[dict] = None,
    use_cache: bool = True,
) -> RewriteResult:
    """Reinterpret one source string for one target locale."""
    if not source_text or not source_text.strip():
        return RewriteResult(target_locale, "", None, None, 0, False, True)
    if target_locale == source_locale:
        return RewriteResult(target_locale, source_text, None, None, 0, False, True)

    voice = MARKET_VOICES.get(target_locale, {})
    cache_key = _ck(source_text, source_locale, target_locale,
                    key or "", voice.get("voice_directive", ""))
    if use_cache and cache_key in _CACHE:
        cached = _CACHE[cache_key]
        return RewriteResult(**{**asdict(cached), "cached": True})

    start = time.time()
    try:
        prompt = _build_prompt(source_text, source_locale, target_locale,
                               key=key, market_context=market_context)
        out = _run_chat(prompt, session_id=f"sem-{cache_key[:12]}")
        dur = int((time.time() - start) * 1000)
        if not out:
            raise RuntimeError("empty model output")
        result = RewriteResult(
            target_locale=target_locale,
            text=out,
            rationale=f"{voice.get('label', target_locale)} · {voice.get('tone', '')}",
            model=f"{DEFAULT_MODEL[0]}/{DEFAULT_MODEL[1]}",
            duration_ms=dur,
            cached=False,
            fallback=False,
        )
    except Exception as exc:
        logger.warning("semantic_rewrite failed for %s → %s · %s",
                       source_locale, target_locale, exc)
        # Conservative fallback: relational_translation.translate(). The
        # caller still gets *some* localized string and the loop progresses.
        try:
            from services.relational_translation import translate
            t = translate(source_text, source_locale, target_locale)
            text = getattr(t, "localized", source_text) or source_text
        except Exception:
            text = source_text
        result = RewriteResult(
            target_locale=target_locale,
            text=text,
            rationale=f"fallback · {exc}",
            model=None,
            duration_ms=int((time.time() - start) * 1000),
            cached=False,
            fallback=True,
        )

    if use_cache:
        _CACHE[cache_key] = result
    return result


def batch_rewrite_key(
    source_text: str,
    source_locale: str = "it-IT",
    key: Optional[str] = None,
    target_locales: Optional[list[str]] = None,
    market_context: Optional[dict] = None,
) -> dict[str, RewriteResult]:
    """Rewrite one source string into every requested target locale."""
    targets = target_locales or [loc for loc in ALL_LOCALES if loc != source_locale]
    out: dict[str, RewriteResult] = {}
    for tgt in targets:
        out[tgt] = semantic_rewrite(
            source_text=source_text, source_locale=source_locale,
            target_locale=tgt, key=key, market_context=market_context,
        )
    return out


def cache_size() -> int:
    return len(_CACHE)


def clear_cache() -> int:
    n = len(_CACHE)
    _CACHE.clear()
    return n
