"""ITER136 · Atelier Voice Architecture™.

Semantic-token layer for atelier identities. NO visual UI — this file is
the *narrative* layer. The visual Blueprint Atelier™ is intentionally
deferred to a dedicated sprint with reference graphics; this module only
exposes the voice hooks the future visual system will read.

The rewrite engine produces:

    final_voice = market_voice ⊕ atelier_voice ⊕ market_context

Where ⊕ is a layered prompt composition that lets the atelier ADD a
narrative gravity over the market voice without overriding the in-market
register entirely (Milan rigour stays Milan rigour, but read through the
Rose Gallery atelier lens).

Tokens (every atelier exposes the same 10-axis schema, normalised 0..1
unless noted):
  · narrative_intensity      — how dramatic the prose can run
  · emotional_amplitude      — how warm / cool the affect is
  · luxury_tier              — approachable | contemporary | ultra | heritage
  · vocabulary_density       — terse vs. layered
  · editorial_cadence        — cadence breakdown (compact / breathing / longform)
  · cinematic_level          — adjective-rich vs. plain
  · restraint_level          — how often the prose holds back
  · hospitality_tone         — warmth toward the reader
  · architectural_precision  — material/structural specificity
  · sensory_level            — appeals to touch / light / weight / sound

These are the same axes for every atelier so the engine stays generic.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Optional


@dataclass
class AtelierTokens:
    """10-axis semantic profile for an atelier."""
    narrative_intensity:     float
    emotional_amplitude:     float
    vocabulary_density:      float
    editorial_cadence:       str            # 'compact' | 'breathing' | 'longform'
    cinematic_level:         float
    restraint_level:         float
    hospitality_tone:        float
    architectural_precision: float
    sensory_level:           float
    luxury_tier:             str            # 'approachable' | 'contemporary' | 'ultra' | 'heritage'


@dataclass
class AtelierVoice:
    id:           str
    label:        str
    tagline:      str
    tokens:       AtelierTokens
    voice_directive: str
    vocabulary_seed: str          # comma-list of preferred lexemes


# ────────── First-class Atelier presets ──────────────────────────────
# Hand-tuned from the user's brief. These are the SEMANTIC layer; the
# visual layer will arrive separately.
ATELIER_VOICES: dict[str, AtelierVoice] = {

    "default": AtelierVoice(
        id="default",
        label="MOOD for DESIGN™ · default",
        tagline="The atelier's own editorial voice.",
        tokens=AtelierTokens(
            narrative_intensity=0.55, emotional_amplitude=0.5,
            vocabulary_density=0.6, editorial_cadence='breathing',
            cinematic_level=0.55, restraint_level=0.6, hospitality_tone=0.5,
            architectural_precision=0.7, sensory_level=0.6,
            luxury_tier='ultra',
        ),
        voice_directive=(
            "Hold the studio's own voice — measured, atelier-grade, "
            "neither cinematic nor restrained beyond what a serious "
            "editorial studio would write for its own monograph."),
        vocabulary_seed="atelier, atmosphere, journey, chapter, presence, "
                        "matter, narrative, language, gathered, drawn",
    ),

    "milano_editoriale": AtelierVoice(
        id="milano_editoriale",
        label="Milano Editoriale™",
        tagline="Design Week cadence · architectural sophistication.",
        tokens=AtelierTokens(
            narrative_intensity=0.65, emotional_amplitude=0.4,
            vocabulary_density=0.75, editorial_cadence='breathing',
            cinematic_level=0.6, restraint_level=0.55, hospitality_tone=0.4,
            architectural_precision=0.85, sensory_level=0.6,
            luxury_tier='ultra',
        ),
        voice_directive=(
            "Layer Milan Design Week's editorial cadence: long sentences "
            "anchored to materials and structures, never theatrical, "
            "always architectural. Preferred lexemes: progetto, materia, "
            "geometria, equilibrio, mestiere. Avoid lifestyle adjectives."),
        vocabulary_seed="progetto, materia, geometria, equilibrio, mestiere, "
                        "tessitura, atelier, voce, maestranza, eredità",
    ),

    "desert_atelier": AtelierVoice(
        id="desert_atelier",
        label="Desert Atelier™",
        tagline="Californian cinematic warmth · emotional hospitality.",
        tokens=AtelierTokens(
            narrative_intensity=0.7, emotional_amplitude=0.85,
            vocabulary_density=0.55, editorial_cadence='longform',
            cinematic_level=0.85, restraint_level=0.3, hospitality_tone=0.9,
            architectural_precision=0.55, sensory_level=0.85,
            luxury_tier='ultra',
        ),
        voice_directive=(
            "Lean into Californian cinematic hospitality: light, warmth, "
            "earth, breeze. Sentences may breathe with em dashes. The "
            "reader should feel held by the language. Preferred verbs: "
            "drawn, gathered, anchored, lit, told."),
        vocabulary_seed="light, warmth, earth, breeze, sun-lit, gathered, "
                        "told, drawn, anchored, grain, palette, hour",
    ),

    "japanese_gallery": AtelierVoice(
        id="japanese_gallery",
        label="Japanese Gallery™",
        tagline="Restrained curatorial silence · minimal amplitude.",
        tokens=AtelierTokens(
            narrative_intensity=0.3, emotional_amplitude=0.2,
            vocabulary_density=0.4, editorial_cadence='compact',
            cinematic_level=0.25, restraint_level=0.95, hospitality_tone=0.4,
            architectural_precision=0.85, sensory_level=0.7,
            luxury_tier='heritage',
        ),
        voice_directive=(
            "Curatorial restraint: short sentences, room for silence, "
            "no decorative adjectives. Each line should feel placed, not "
            "written. Prefer nouns and verbs over qualifiers. Allow "
            "negative space."),
        vocabulary_seed="line, placement, silence, edge, surface, weight, "
                        "shadow, intention, restraint, breath",
    ),

    "rose_gallery": AtelierVoice(
        id="rose_gallery",
        label="Rose Gallery™",
        tagline="Sensory softness · emotional gallery narration.",
        tokens=AtelierTokens(
            narrative_intensity=0.5, emotional_amplitude=0.8,
            vocabulary_density=0.55, editorial_cadence='breathing',
            cinematic_level=0.6, restraint_level=0.45, hospitality_tone=0.85,
            architectural_precision=0.5, sensory_level=0.9,
            luxury_tier='contemporary',
        ),
        voice_directive=(
            "Sensory softness and emotional gallery cadence: textures, "
            "fabrics, the way a hand reads a surface. Adjectives can "
            "linger, but never tip into purple. Prefer touch over sight."),
        vocabulary_seed="touch, softness, fold, drape, pause, breath, "
                        "pulse, fabric, warmth, light",
    ),

    "monumental_dubai": AtelierVoice(
        id="monumental_dubai",
        label="Monumental Dubai™",
        tagline="Monumental editorial luxury · immersive prestige.",
        tokens=AtelierTokens(
            narrative_intensity=0.8, emotional_amplitude=0.55,
            vocabulary_density=0.7, editorial_cadence='longform',
            cinematic_level=0.75, restraint_level=0.4, hospitality_tone=0.55,
            architectural_precision=0.8, sensory_level=0.7,
            luxury_tier='ultra',
        ),
        voice_directive=(
            "Monumental, aspirational language with measured prestige. "
            "Scale matters: heights, presences, thresholds. Never "
            "shouty — the gravity of luxury, not its volume."),
        vocabulary_seed="presence, threshold, gesture, scale, monumentality, "
                        "stone, weight, dignity, register",
    ),
}


# ────────── Voice composition ────────────────────────────────────────
def compose_voice_addendum(
    market_locale: str,
    atelier_id: Optional[str] = None,
    market_context: Optional[dict] = None,
) -> str:
    """Build the atelier ⊕ market addendum the prompt builder appends to
    the base market voice directive. Returns an empty string when no
    atelier override is requested (engine keeps stock market voice).
    """
    if not atelier_id or atelier_id == "default":
        return ""
    voice = ATELIER_VOICES.get(atelier_id)
    if not voice:
        return ""
    t = voice.tokens
    cadence_phrase = {
        'compact':   'compact rhythm, room for silence',
        'breathing': 'breathing cadence, sentences that arc',
        'longform':  'longform editorial cadence with extended clauses',
    }.get(t.editorial_cadence, 'breathing cadence')
    return (
        f"\n\nATELIER OVERRIDE — {voice.label}:\n"
        f"  · {voice.tagline}\n"
        f"  · {voice.voice_directive}\n"
        f"  · Cadence: {cadence_phrase}\n"
        f"  · Vocabulary lean: {voice.vocabulary_seed}\n"
        f"  · Token signature: narrative={t.narrative_intensity:.2f} · "
        f"emotion={t.emotional_amplitude:.2f} · cinematic={t.cinematic_level:.2f} "
        f"· restraint={t.restraint_level:.2f} · hospitality={t.hospitality_tone:.2f} "
        f"· precision={t.architectural_precision:.2f} · sensory={t.sensory_level:.2f}\n"
        f"\n"
        f"COMPOSITION RULE: layer this atelier voice OVER the market voice "
        f"({market_locale}). The market voice provides the editorial "
        f"register; the atelier provides the narrative gravity. The "
        f"final line must read like a {voice.label} editor writing for "
        f"the {market_locale} market — neither generic nor a parody.\n"
    )


def list_atelier_voices() -> list[dict]:
    return [
        {
            "id":          v.id,
            "label":       v.label,
            "tagline":     v.tagline,
            "tokens":      asdict(v.tokens),
            "vocabulary_seed": v.vocabulary_seed,
        }
        for v in ATELIER_VOICES.values()
    ]


def get_atelier_voice(atelier_id: str) -> Optional[AtelierVoice]:
    return ATELIER_VOICES.get(atelier_id)
