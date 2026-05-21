"""Adaptive Language Experience™ — Relational Translation Layer™
Sprint ITER123.

Translates user-authored content (notes, comments, feedback, milestone
narratives, companion messages) into the client's reading locale while
preserving the studio's natural writing locale.

Key design decisions
────────────────────
1. **Original is sacred** — we never overwrite source text. Localized
   variants are derivative artifacts that live alongside it.
2. **Editorial tone, not literal translation** — the prompt explicitly
   targets luxury hospitality / interior design editorial register.
3. **Do-Not-Translate guard** — proper nouns, brand names, material
   names, designer names, SKUs are wrapped in <dnt> tags before the
   model sees them and unwrapped on the way out.
4. **Process-local LRU cache** — a single (text, src, tgt) tuple is
   translated once per process lifetime. DB persistence + tenant-scoped
   cache is a future iteration (registered as P1 backlog).
5. **Graceful degradation** — if the LLM call fails or the key is
   missing, the original text is returned with `translated=False` so
   the UI can fall back cleanly.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from functools import lru_cache
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

DEFAULT_MODEL = ("anthropic", "claude-sonnet-4-5-20250929")
TRANSLATION_TIMEOUT_S = 30

# ── Supported pairs ────────────────────────────────────────────
SUPPORTED_LOCALES = frozenset({
    "it", "en-US", "en-GB", "fr", "de", "es", "ar",
})

# ── Do-Not-Translate (DNT) lexicon ────────────────────────────
# Proper nouns and brand-protected terms that must pass through unchanged.
# This list is intentionally short; tenant-scoped extension lives in
# `tenant_settings.dnt_terms` (future iteration).
DEFAULT_DNT_TERMS = (
    # MOOD brand vocabulary
    "MOOD for DESIGN", "MOOD", "Design Journey", "Studio Pulse",
    "Cultural Edition", "Cultural Editions", "Brand Atlas",
    "Material View", "Studio Identity", "Brand Identity",
    "Editorial Calendar", "Curatorial Atlas", "Client Companion",
    "Inspirations", "Studio Collections", "Certified Closure",
    "Moodboard Direction", "Material Direction",
    # Italian furniture / hospitality brands (sample — registry-driven later)
    "Cattelan", "Cattelan Italia", "B&B Italia", "Cassina", "Poltrona Frau",
    "Flos", "Artemide", "Foscarini", "Kartell", "Maxalto", "Molteni",
    "Boffi", "Edra", "Minotti", "Driade", "Vitra", "Knoll",
)

# Locale → BCP-47 + display name (used in the prompt)
_LOCALE_LABEL = {
    "it":    "Italian (Italy)",
    "en-US": "American English",
    "en-GB": "British English",
    "fr":    "French (France)",
    "de":    "German (Germany)",
    "es":    "Spanish (Spain)",
    "ar":    "Arabic (Modern Standard)",
}


def _emergent_key() -> str:
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise RuntimeError("EMERGENT_LLM_KEY is not configured")
    return key


def _label(locale: str) -> str:
    return _LOCALE_LABEL.get(locale, locale)


def _wrap_dnt(text: str, dnt_terms=DEFAULT_DNT_TERMS) -> Tuple[str, List[str]]:
    """Wrap each DNT term occurrence with <dnt index="N"/> tokens.
    Returns the masked text + the list of recovered terms in order.

    Tokenized so the LLM cannot accidentally translate or capitalise them.
    """
    recovered: List[str] = []
    masked = text
    # Sort by length descending so "B&B Italia" matches before "B&B".
    for term in sorted(dnt_terms, key=len, reverse=True):
        # Case-sensitive on purpose: brand casing is editorial.
        if term in masked:
            placeholder = f"§DNT{len(recovered)}§"
            recovered.append(term)
            masked = masked.replace(term, placeholder)
    return masked, recovered


def _unwrap_dnt(text: str, recovered: List[str]) -> str:
    out = text
    for i, term in enumerate(recovered):
        out = out.replace(f"§DNT{i}§", term)
    return out


# ── Editorial prompt (Claude Sonnet 4.5) ───────────────────────
def _build_prompt(text_masked: str, src_locale: str, tgt_locale: str) -> str:
    return (
        f"You are MOOD for DESIGN™'s in-house cultural translator — an editor at "
        f"a high-end interior architecture studio (Cassina · Molteni · Minotti "
        f"register). You are NOT a translation engine. You are a senior writer "
        f"who re-authors a designer's message from {_label(src_locale)} into "
        f"natural, editorial {_label(tgt_locale)} as if it had been written "
        f"there originally.\n\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"INPUT (source: {src_locale}):\n"
        f"{text_masked}\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"VOICE\n"
        f"  • Sober, refined, warm — never effusive, never marketing-speak.\n"
        f"  • Interior / architecture editorial register: \"refined\", \"composed\", \n"
        f"    \"softened\", \"layered\", \"quieter palette\", \"material direction\".\n"
        f"  • An American/British client should read it and not suspect it was "
        f"    translated.\n\n"
        f"NON-NEGOTIABLE RULES\n"
        f"  1. Preserve every §DNT#§ placeholder EXACTLY (brand/proper-noun anchors).\n"
        f"  2. NEVER translate word-for-word. Re-author meaning, not vocabulary.\n"
        f"  3. Length within ±20% of source. Do not add or drop information.\n"
        f"  4. Match register: a fragment stays a fragment; a closing salutation "
        f"     becomes a culturally-equivalent salutation (\"Un caro saluto\" → "
        f"     \"Warmly\", not \"A dear greeting\").\n"
        f"  5. Convert idioms culturally; never calque them.\n"
        f"  6. Return ONLY the rewritten text. No quotation marks, no headers, "
        f"     no commentary, no JSON. Plain text only.\n\n"
        f"EDITORIAL CRAFT — concrete IT→EN examples (calibrate from these)\n"
        f"  ❌ \"alleggerito\" → \"lightened\"          ✅ \"refined\" / \"pared back\"\n"
        f"  ❌ \"superfici più luminose\" → \"more luminous surfaces\"\n"
        f"  ✅ \"lighter surfaces\" / \"a brighter surface palette\"\n"
        f"  ❌ \"composizione meno materica\" → \"less material composition\"\n"
        f"  ✅ \"a softer material composition\" / \"a calmer material direction\"\n"
        f"  ❌ \"palette materica\" → \"material palette\"\n"
        f"  ✅ \"material direction\" / \"material vocabulary\"\n"
        f"  ❌ \"valorizzando\" → \"valorising\"        ✅ \"foregrounding\" / \"letting … breathe\"\n\n"
        f"  Full IT source example:\n"
        f"    \"Abbiamo alleggerito la proposta della cucina introducendo "
        f"superfici più luminose e una composizione meno materica.\"\n"
        f"  ✅ EN rewrite (target voice):\n"
        f"    \"We refined the kitchen proposal with lighter surfaces and a "
        f"softer material composition.\"\n"
    )


# ── Sync API used by routers ───────────────────────────────────
class TranslationResult:
    __slots__ = ("original", "localized", "source_locale", "target_locale",
                 "translated", "model", "translated_at", "duration_ms",
                 "confidence", "error")

    def __init__(self, **kw):
        for k in self.__slots__:
            setattr(self, k, kw.get(k))

    def to_dict(self) -> dict:
        return {k: getattr(self, k) for k in self.__slots__}


# Process-local cache; key = sha1(src+tgt+text). Stays valid for the
# lifetime of the worker. Distributed cache deferred to follow-up.
_CACHE: dict[str, TranslationResult] = {}


def _cache_key(text: str, src: str, tgt: str) -> str:
    return hashlib.sha1(f"{src}|{tgt}|{text}".encode("utf-8")).hexdigest()


def translate(text: str, source_locale: str, target_locale: str,
              dnt_terms: Optional[tuple] = None) -> TranslationResult:
    """Localize an editorial message from source_locale to target_locale.

    Idempotent: same (text, src, tgt) → same result for the process lifetime.
    Returns a TranslationResult with translated=False on any failure path.
    """
    text = (text or "").strip()
    if not text:
        return TranslationResult(
            original=text, localized=text,
            source_locale=source_locale, target_locale=target_locale,
            translated=False, model=None,
            translated_at=datetime.now(timezone.utc).isoformat(),
            duration_ms=0, confidence=None, error="empty_text",
        )

    # No-op: same locale, or target is the source.
    if source_locale == target_locale:
        return TranslationResult(
            original=text, localized=text,
            source_locale=source_locale, target_locale=target_locale,
            translated=False, model=None,
            translated_at=datetime.now(timezone.utc).isoformat(),
            duration_ms=0, confidence=1.0, error=None,
        )

    if source_locale not in SUPPORTED_LOCALES or target_locale not in SUPPORTED_LOCALES:
        return TranslationResult(
            original=text, localized=text,
            source_locale=source_locale, target_locale=target_locale,
            translated=False, model=None,
            translated_at=datetime.now(timezone.utc).isoformat(),
            duration_ms=0, confidence=None, error="unsupported_locale",
        )

    ck = _cache_key(text, source_locale, target_locale)
    cached = _CACHE.get(ck)
    if cached is not None:
        return cached

    masked, recovered = _wrap_dnt(text, dnt_terms or DEFAULT_DNT_TERMS)
    prompt = _build_prompt(masked, source_locale, target_locale)

    start = time.time()
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
        chat = LlmChat(
            api_key=_emergent_key(),
            session_id=f"ale-{ck[:12]}",
            system_message="You are MOOD for DESIGN™'s editorial cultural translator.",
        ).with_model(*DEFAULT_MODEL)

        # The library is async-first; run it via a fresh loop in sync context.
        async def _call():
            return await chat.send_message(UserMessage(text=prompt))

        try:
            translated_masked = asyncio.run(_call())
        except RuntimeError:
            # In environments where an event loop is already running
            # (FastAPI route handlers), create a dedicated loop.
            loop = asyncio.new_event_loop()
            try:
                translated_masked = loop.run_until_complete(_call())
            finally:
                loop.close()

        if isinstance(translated_masked, dict):
            translated_masked = translated_masked.get("content", "") or ""
        translated_masked = (translated_masked or "").strip()
        if translated_masked.startswith('"') and translated_masked.endswith('"'):
            translated_masked = translated_masked[1:-1].strip()

        localized = _unwrap_dnt(translated_masked, recovered)
        result = TranslationResult(
            original=text, localized=localized,
            source_locale=source_locale, target_locale=target_locale,
            translated=bool(localized) and localized != text,
            model=f"{DEFAULT_MODEL[0]}/{DEFAULT_MODEL[1]}",
            translated_at=datetime.now(timezone.utc).isoformat(),
            duration_ms=int((time.time() - start) * 1000),
            confidence=0.85,  # heuristic; future: ask model for self-score
            error=None,
        )
    except Exception as e:
        logger.exception("translation failed")
        result = TranslationResult(
            original=text, localized=text,
            source_locale=source_locale, target_locale=target_locale,
            translated=False, model=None,
            translated_at=datetime.now(timezone.utc).isoformat(),
            duration_ms=int((time.time() - start) * 1000),
            confidence=None, error=str(e)[:200],
        )

    _CACHE[ck] = result
    return result


def cache_stats() -> dict:
    return {"entries": len(_CACHE)}
