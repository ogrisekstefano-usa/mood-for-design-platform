"""Phase P0.2.A — LocalizationRuntime™

The single source of truth for cultural positioning across MOOD for DESIGN™.

Resolves the ACTIVE locale_profile for a given request, applying the
runtime priority chain:

    user preference  →  project  →  lead  →  tenant default  →
    browser (weak)   →  system fallback (IT_IT)

Then exposes:
  • the full locale_profile (vocabulary, forbidden patterns, tone, …)
  • a `source` discriminator (user / project / lead / tenant / browser / system)
  • a market-intent-preserving fallback when the requested locale is missing

AND — critically — a single helper `with_runtime_prompt(profile)` that
returns the verbatim system-prompt fragment every AI engine should inject
in front of its own task instructions. AI engines must NEVER reconstruct
locale context manually anymore.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from fastapi import Request

logger = logging.getLogger(__name__)


# ─── Supported locale set ────────────────────────────────────────────────

SUPPORTED_LOCALES: List[str] = [
    "IT_IT", "EN_US", "EN_GB", "EN_AE", "DE_DE", "FR_FR", "ES_ES",
]

# Legacy 2-letter market shortcut → composite locale_code.
MARKET_TO_LOCALE_CODE: Dict[str, str] = {
    "IT": "IT_IT",
    "US": "EN_US",
    "UK": "EN_GB", "GB": "EN_GB",
    "AE": "EN_AE", "UAE": "EN_AE",
    "DE": "DE_DE",
    "FR": "FR_FR",
    "ES": "ES_ES",
}

# Browser language tag (en, en-US, fr-FR, …) → locale_code. Browser is a
# WEAK signal — never wins over user/project/lead/tenant. Used only as the
# step-5 hint before the system fallback.
BROWSER_LANG_TO_LOCALE: Dict[str, str] = {
    "it":    "IT_IT",
    "en":    "EN_US",     # generic English defaults to US (largest market)
    "en-us": "EN_US",
    "en-gb": "EN_GB",
    "en-ae": "EN_AE",
    "de":    "DE_DE",
    "fr":    "FR_FR",
    "es":    "ES_ES",
    "ar-ae": "EN_AE",     # Gulf Arabic browsers → UAE editorial register
}

# Market-intent-preserving fallback chain — never collapse EN_AE prestige
# into IT_IT craftsmanship etc.
FALLBACK_CHAIN: Dict[str, List[str]] = {
    "EN_AE": ["EN_GB", "EN_US"],
    "EN_GB": ["EN_US"],
    "EN_US": ["EN_GB"],
    "FR_FR": ["IT_IT", "EN_GB"],
    "DE_DE": ["EN_GB"],
    "ES_ES": ["IT_IT", "EN_GB"],
    "IT_IT": ["EN_GB"],
}

SYSTEM_FALLBACK = "IT_IT"


# ─── Profile loading ─────────────────────────────────────────────────────

def _load_profile(c, locale_code: str) -> Optional[Dict[str, Any]]:
    r = (c.table("locale_profiles").select("*")
         .eq("locale_code", locale_code.upper()).limit(1).execute())
    return r.data[0] if r.data else None


def resolve_profile(c, locale_code: str) -> Optional[Dict[str, Any]]:
    """Load profile with market-intent-preserving fallback chain."""
    if not locale_code:
        return None
    p = _load_profile(c, locale_code)
    if p:
        return p
    for alt in FALLBACK_CHAIN.get(locale_code.upper(), []):
        alt_p = _load_profile(c, alt)
        if alt_p:
            logger.info(
                f"locale fallback {locale_code} → {alt} "
                f"(closest cultural register)"
            )
            return alt_p
    # final fallback to the system default (e.g. when profile was deleted)
    if locale_code.upper() != SYSTEM_FALLBACK:
        return _load_profile(c, SYSTEM_FALLBACK)
    return None


# ─── Browser locale parsing ──────────────────────────────────────────────

def _parse_accept_language(header_value: Optional[str]) -> Optional[str]:
    """Parse the Accept-Language header and return the highest-quality
    browser tag that maps into our supported set. Returns None if no tag
    matches."""
    if not header_value:
        return None
    # Header shape: 'en-US,en;q=0.9,it;q=0.8'
    candidates: List[Tuple[float, str]] = []
    for raw in header_value.split(","):
        raw = raw.strip().lower()
        if not raw:
            continue
        qual = 1.0
        if ";" in raw:
            tag, *params = [s.strip() for s in raw.split(";")]
            for p in params:
                m = re.match(r"q=([0-9.]+)", p)
                if m:
                    try:
                        qual = float(m.group(1))
                    except ValueError:
                        pass
        else:
            tag = raw
        if tag:
            candidates.append((qual, tag))
    candidates.sort(reverse=True)
    for _q, tag in candidates:
        if tag in BROWSER_LANG_TO_LOCALE:
            return BROWSER_LANG_TO_LOCALE[tag]
        # also match the base language (e.g. 'en-CA' → 'en')
        base = tag.split("-")[0]
        if base in BROWSER_LANG_TO_LOCALE:
            return BROWSER_LANG_TO_LOCALE[base]
    return None


# ─── Main resolver ───────────────────────────────────────────────────────

def resolve(
    c,
    *,
    tenant_id: str,
    profile_id: Optional[str] = None,
    project_id: Optional[str] = None,
    lead_id: Optional[str] = None,
    requested_locale: Optional[str] = None,
    accept_language: Optional[str] = None,
) -> Dict[str, Any]:
    """Resolve the active locale_profile for the current request.

    Returns:
        {
            "locale_code": "EN_AE",
            "source":      "project",        # user|project|lead|tenant|browser|system|explicit
            "profile":     <full row>,
            "candidates":  {                 # debug trace — every signal seen
                "explicit": ..., "user": ..., "project": ...,
                "lead": ..., "tenant": ..., "browser": ..., "system": "IT_IT",
            },
        }
    """
    candidates: Dict[str, Optional[str]] = {
        "explicit": (requested_locale or "").upper() or None,
        "user":     None,
        "project":  None,
        "lead":     None,
        "tenant":   None,
        "browser":  _parse_accept_language(accept_language),
        "system":   SYSTEM_FALLBACK,
    }

    # User preference --------------------------------------------------
    if profile_id:
        try:
            up = (c.table("users_profile").select("preferred_locale_code")
                  .eq("id", profile_id).eq("tenant_id", tenant_id)
                  .limit(1).execute().data or [])
            if up and up[0].get("preferred_locale_code"):
                candidates["user"] = up[0]["preferred_locale_code"].upper()
        except Exception as e:
            logger.warning(f"locale resolve: user preference lookup failed: {e}")

    # Project locale ---------------------------------------------------
    if project_id:
        try:
            pr = (c.table("projects").select("locale_code, metadata_json")
                  .eq("id", project_id).eq("tenant_id", tenant_id)
                  .limit(1).execute().data or [])
            if pr:
                row = pr[0]
                pc = row.get("locale_code")
                if not pc:
                    # legacy projects: derive from metadata.country
                    cc = ((row.get("metadata_json") or {}).get("country") or "").upper()
                    pc = MARKET_TO_LOCALE_CODE.get(cc)
                if pc:
                    candidates["project"] = pc.upper()
        except Exception as e:
            logger.warning(f"locale resolve: project lookup failed: {e}")

    # Lead locale ------------------------------------------------------
    if lead_id:
        try:
            ld = (c.table("leads").select("locale_code, country")
                  .eq("id", lead_id).eq("tenant_id", tenant_id)
                  .limit(1).execute().data or [])
            if ld:
                row = ld[0]
                lc = row.get("locale_code") or MARKET_TO_LOCALE_CODE.get(
                    (row.get("country") or "").upper()
                )
                if lc:
                    candidates["lead"] = lc.upper()
        except Exception as e:
            logger.warning(f"locale resolve: lead lookup failed: {e}")

    # Tenant default ---------------------------------------------------
    try:
        tt = (c.table("tenants").select("default_locale_code")
              .eq("id", tenant_id).limit(1).execute().data or [])
        if tt and tt[0].get("default_locale_code"):
            candidates["tenant"] = tt[0]["default_locale_code"].upper()
    except Exception as e:
        logger.warning(f"locale resolve: tenant lookup failed: {e}")

    # ── Priority chain ───────────────────────────────────────────────
    # explicit > user > project > lead > tenant > browser > system
    source: str = "system"
    locale_code: str = SYSTEM_FALLBACK
    for key in ("explicit", "user", "project", "lead", "tenant", "browser", "system"):
        v = candidates.get(key)
        if v:
            locale_code = v
            source = key
            break

    profile = resolve_profile(c, locale_code)
    if profile is None:
        # absolute fail-safe — should never happen, but never let callers crash
        profile = {
            "locale_code": SYSTEM_FALLBACK, "language": "it", "market": "IT",
            "display_name": "Italia", "emotional_style": "editorial craftsmanship",
            "luxury_style": "", "hospitality_style": "", "editorial_tone": "",
            "cta_style": "", "investment_language": "", "atmosphere_language": "",
            "focus": [], "vocabulary_rules": [], "forbidden_patterns": [],
            "positioning_examples": [], "system_brief": "",
        }

    # If the resolver returned a different locale than the one requested
    # (fallback chain kicked in), surface it in the source as "<source>:fallback".
    if profile["locale_code"] != locale_code:
        source = f"{source}:fallback"

    return {
        "locale_code": profile["locale_code"],
        "requested":   locale_code,
        "source":      source,
        "profile":     profile,
        "candidates":  candidates,
    }


# ─── Convenience FastAPI request helper ──────────────────────────────────

def resolve_from_request(
    c,
    *,
    request: Optional[Request],
    tenant_id: str,
    profile_id: Optional[str] = None,
    project_id: Optional[str] = None,
    lead_id: Optional[str] = None,
    requested_locale: Optional[str] = None,
) -> Dict[str, Any]:
    """Same as `resolve()` but extracts the Accept-Language header
    automatically from a FastAPI Request."""
    accept = None
    if request is not None:
        try:
            accept = request.headers.get("accept-language")
        except Exception:
            accept = None
    return resolve(
        c,
        tenant_id=tenant_id,
        profile_id=profile_id,
        project_id=project_id,
        lead_id=lead_id,
        requested_locale=requested_locale,
        accept_language=accept,
    )


# ─── AI runtime injection ────────────────────────────────────────────────

_RUNTIME_PROMPT_TEMPLATE = """═══ LOCALE PROFILE ({locale_code}) — Cultural Runtime Intelligence™ ═══
{system_brief}

EMOTIONAL STYLE:      {emotional_style}
LUXURY STYLE:         {luxury_style}
HOSPITALITY STYLE:    {hospitality_style}
EDITORIAL TONE:       {editorial_tone}
CTA STYLE:            {cta_style}
INVESTMENT LANGUAGE:  {investment_language}
ATMOSPHERE LANGUAGE:  {atmosphere_language}

FOCUS AREAS (use as the conceptual backbone):
  {focus}

VOCABULARY (prefer these terms; never use generic alternatives):
  {vocabulary}

FORBIDDEN PATTERNS (do not use, ever):
  {forbidden}

POSITIONING EXAMPLES (tonal register we want):
  {examples}

═══ RUNTIME RULES ═══
• Reposition, do NOT translate. Even if a previous draft exists in a
  different locale, REWRITE natively for this one.
• Write in this locale's language ({language}).
• EN_US, EN_GB and EN_AE share English but are fundamentally different
  cultural positionings — never share vocabulary across them.
• NEVER mention AI, GPT, "generated by", or system meta-language."""


def with_runtime_prompt(profile: Dict[str, Any]) -> str:
    """Return the verbatim system-prompt fragment that every AI engine
    must inject in front of its own task instructions.

    Callers should compose the final system message as:

        f"{caller_task_intro}\\n\\n{with_runtime_prompt(profile)}\\n\\n{caller_task_rules}"
    """
    return _RUNTIME_PROMPT_TEMPLATE.format(
        locale_code=profile.get("locale_code", ""),
        system_brief=profile.get("system_brief", ""),
        emotional_style=profile.get("emotional_style", ""),
        luxury_style=profile.get("luxury_style", ""),
        hospitality_style=profile.get("hospitality_style", ""),
        editorial_tone=profile.get("editorial_tone", ""),
        cta_style=profile.get("cta_style", ""),
        investment_language=profile.get("investment_language", ""),
        atmosphere_language=profile.get("atmosphere_language", ""),
        focus=", ".join(profile.get("focus") or []) or "—",
        vocabulary=", ".join(profile.get("vocabulary_rules") or []) or "—",
        forbidden=", ".join(profile.get("forbidden_patterns") or []) or "—",
        examples="\n  ".join(profile.get("positioning_examples") or []) or "—",
        language=profile.get("language", "en"),
    )
