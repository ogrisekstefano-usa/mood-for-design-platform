"""ITER147 · International Profile Identity™ — Cultural Directives.

These directives are appended as the `voice_addendum` block in the
ALE prompt when translating editorial blocks that belong to the
`profile.identity` namespace.

The intent is *cultural adaptation*, not literal translation: a
"Founder" written by an Italian studio should arrive in the United
States reading "Founder & Creative Director", in the United Kingdom
reading "Principal Designer". Roles, response phrases and CTA labels
all carry market-specific connotations that a word-for-word render
would erase.

The directive is INTERNAL — never surfaced to clients. The user-
facing wording for the result is governed in the frontend ("Adapted
for international clients", never "AI generated").
"""
from __future__ import annotations

# Generic directive applied to every profile.identity translation —
# regardless of target locale. Localized examples are appended below.
PROFILE_IDENTITY_DIRECTIVE_HEAD = (
    "EDITORIAL VOICE · International Studio Narrative™\n"
    "You are adapting the personal presentation of a designer / founder /\n"
    "principal of a luxury interior-architecture studio for an international\n"
    "client of comparable sophistication. This is NOT translation: it is\n"
    "*cultural adaptation*. The result must read as if it had been written\n"
    "in the target market by a senior editor at AD, Wallpaper, Dezeen.\n"
    "  · Adapt role titles to the conventions of the target market\n"
    "    (e.g. \"Founder\" → \"Founder & Creative Director\" for US,\n"
    "    \"Principal Designer\" for UK, \"Directeur de Création\" for FR).\n"
    "  · Adapt response promises to the cultural register of the locale\n"
    "    (\"Risponde in giornata\" → \"Replies the same day\" / \"Antwortet "
    "innerhalb eines Tages\" — never literal).\n"
    "  · Keep editorial warmth — the human voice of an atelier, not a SaaS.\n"
    "  · Length within ±25% of source.\n"
    "  · Never expose translation lineage. Output plain text only."
)


# Per-locale calibration examples that ride alongside the head directive.
# These are not exhaustive — the head directive already governs intent —
# but they ground Claude's tone in market-specific signals.
PROFILE_IDENTITY_LOCALE_CALIBRATIONS = {
    "en-US": (
        "  US market signals: confident, warm, business-poetic. Prefer\n"
        "  'Creative Director', 'Principal', 'Founding Partner'. Replace\n"
        "  'studio' with 'studio' (unchanged), 'atelier' may remain as a\n"
        "  loanword. Replies framed as 'within the day' / 'same day'."
    ),
    "en-GB": (
        "  UK market signals: restrained, considered, architectural.\n"
        "  Prefer 'Principal Designer', 'Director', 'Practice Founder'.\n"
        "  'Studio' rather than 'firm'. Reply language understated:\n"
        "  'usually replies the same day', not 'we always reply fast!'."
    ),
    "de-DE": (
        "  DE market signals: precise, sober, technically dignified.\n"
        "  Prefer 'Inhaber & Kreativdirektor', 'Gestaltungsleitung',\n"
        "  'Studioleitung'. Avoid English loanwords where a clean German\n"
        "  equivalent exists. Reply phrasing direct, no marketing flourish."
    ),
    "fr-FR": (
        "  FR market signals: éditorial, soigné, sophistiqué — registre\n"
        "  AD France / IDEAT. Prefer 'Directeur de Création', 'Fondateur\n"
        "  & Directeur Artistique', 'Architecte d'intérieur principal'.\n"
        "  Réponse: 'répond dans la journée'."
    ),
    "es-ES": (
        "  ES market signals: cálido, editorial, refinado — registro\n"
        "  Architectural Digest España. Prefer 'Fundador y Director\n"
        "  Creativo', 'Director de Diseño', 'Socio fundador'. Respuesta:\n"
        "  'suele responder el mismo día'."
    ),
    "it-IT": (
        "  IT market signals: this is typically the SOURCE locale; only\n"
        "  used when source was written in another language. Mantenere\n"
        "  registro editoriale (AD Italia · Domus). Preferire 'Fondatore\n"
        "  & Direttore Creativo', 'Designer Principale'."
    ),
}


def build_profile_identity_addendum(target_locale: str) -> str:
    """Return the `voice_addendum` block for an ALE translate() call
    targeting a `profile.identity` editorial block in the given locale.
    """
    if not target_locale:
        return PROFILE_IDENTITY_DIRECTIVE_HEAD
    # Match by primary tag if a perfect match is missing (e.g. `en` → `en-US`).
    key = target_locale
    if key not in PROFILE_IDENTITY_LOCALE_CALIBRATIONS:
        primary = (key.split("-")[0] or "").lower()
        for cand in PROFILE_IDENTITY_LOCALE_CALIBRATIONS:
            if cand.lower().startswith(primary):
                key = cand
                break
    calibration = PROFILE_IDENTITY_LOCALE_CALIBRATIONS.get(key, "")
    if calibration:
        return f"{PROFILE_IDENTITY_DIRECTIVE_HEAD}\n\nLOCALE CALIBRATION ({key}):\n{calibration}"
    return PROFILE_IDENTITY_DIRECTIVE_HEAD


# Public API — keep narrow so callers don't take undocumented shortcuts.
__all__ = ["build_profile_identity_addendum"]
