"""Seed the 7 Phase-1 Locale Profiles.

Each locale is a COMPLETE editorial positioning profile — not a translation.
EN_US, EN_GB and EN_AE share the English language but are independent
cultural positionings with different vocabularies, CTA styles and forbidden
patterns.

Run: `python /app/backend/scripts/seed_locale_profiles.py`
"""
import os
import json
import psycopg2
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

PROFILES = [
    # ── IT_IT ────────────────────────────────────────────────────────
    {
        "locale_code": "IT_IT", "language": "it", "market": "IT",
        "display_name": "Italia",
        "emotional_style":    "editorial craftsmanship",
        "luxury_style":       "lusso silenzioso, materia onesta, durata",
        "hospitality_style":  "ospitalità domestica, ritmo lento, tavola condivisa",
        "editorial_tone":     "registro editoriale calmo, prosa misurata",
        "cta_style":          "invito sobrio, mai imperativo — 'Scrivimi quando il progetto è pronto'",
        "investment_language": "valore nel tempo, qualità costruttiva, continuità artigianale",
        "atmosphere_language": "atmosfera misurata, luce naturale, presenza calma, materia che dura",
        "focus": ["craftsmanship", "materials", "timelessness", "proportion", "editorial warmth"],
        "vocabulary_rules": ["equilibrio", "materia", "artigianalità", "continuità",
                             "luce naturale", "misura", "atmosfera", "presenza calma",
                             "gesto antico", "registro", "tempo lungo"],
        "forbidden_patterns": ["lusso ostentato", "stile internazionale generico",
                               "modern minimal stereotipato", "AI", "powered by",
                               "lifestyle aspirazionale"],
        "positioning_examples": [
            "Una conversazione tra materia e luce, calibrata sul ritmo della casa.",
            "Il progetto si misura sul tempo lungo, non sull'effetto immediato.",
        ],
        "system_brief": (
            "Write for an Italian audience that values quiet craftsmanship, "
            "material honesty, artisan culture and continuity with a long "
            "Italian design heritage. Speak with editorial calm. Avoid "
            "international-luxury clichés and aspirational lifestyle phrasing. "
            "Prefer concrete material references and proportion over emotional "
            "adjectives. Write natively in Italian, in a refined editorial register."
        ),
    },

    # ── EN_US ────────────────────────────────────────────────────────
    {
        "locale_code": "EN_US", "language": "en", "market": "US",
        "display_name": "United States",
        "emotional_style":    "aspirational lifestyle",
        "luxury_style":       "elevated lifestyle, curated living, statement spaces",
        "hospitality_style":  "entertaining flow, social gathering, kitchen as stage",
        "editorial_tone":     "confident warmth, lifestyle storytelling",
        "cta_style":          "warm invitation with momentum — 'Let's start the conversation'",
        "investment_language": "lifestyle return, signature presence, family legacy",
        "atmosphere_language": "elevated everyday, curated experience, signature moments",
        "focus": ["aspirational lifestyle", "elevated living", "personalization",
                  "entertaining", "luxury experience"],
        "vocabulary_rules": ["elevated lifestyle", "curated living", "statement kitchen",
                             "entertaining flow", "luxury experience", "signature space",
                             "elevated everyday", "tailored", "destination", "atelier-grade"],
        "forbidden_patterns": ["British understatement", "European restraint clichés",
                               "Mediterranean folklore", "powered by AI", "GPT",
                               "quiet luxury phrasing"],
        "positioning_examples": [
            "A residence designed around the rhythm of how you actually live.",
            "Every surface earns its place in the lifestyle this home invites.",
        ],
        "system_brief": (
            "Write for a US luxury residential audience valuing aspirational "
            "lifestyle, entertaining culture, personalization and a feeling of "
            "elevated everyday life. Speak with confident warmth and lifestyle "
            "storytelling. Avoid European-style understatement and Gulf-style "
            "statement language. Prefer experience-driven framing over material "
            "taxonomy. Write natively in American English, refined editorial "
            "register."
        ),
    },

    # ── EN_GB ────────────────────────────────────────────────────────
    {
        "locale_code": "EN_GB", "language": "en", "market": "GB",
        "display_name": "United Kingdom",
        "emotional_style":    "restrained editorial luxury",
        "luxury_style":       "understated luxury, heritage references, timeless composition",
        "hospitality_style":  "quiet hosting, layered domesticity, heritage warmth",
        "editorial_tone":     "quiet authority, British editorial register",
        "cta_style":          "polite, low-pressure invitation — 'Do let us know when you'd like to discuss'",
        "investment_language": "timeless asset, heritage continuity, layered value",
        "atmosphere_language": "considered detailing, layered materiality, quiet authority",
        "focus": ["understated luxury", "restraint", "layered sophistication",
                  "editorial elegance", "timeless atmosphere"],
        "vocabulary_rules": ["understated luxury", "refined atmosphere", "quiet statement",
                             "timeless composition", "layered materiality",
                             "considered detailing", "heritage register", "quiet authority"],
        "forbidden_patterns": ["aspirational lifestyle phrasing", "American 'elevated'",
                               "Gulf statement language", "iconic presence", "AI-generated"],
        "positioning_examples": [
            "A residence written in lower case — confident enough not to raise its voice.",
            "Heritage is treated as a quiet companion, never an instruction.",
        ],
        "system_brief": (
            "Write for a UK luxury residential audience valuing restrained "
            "editorial luxury, timeless understatement, heritage continuity and "
            "layered material sophistication. Speak with quiet authority. Avoid "
            "American 'elevated lifestyle' language and Gulf statement language. "
            "Write natively in British English, with British editorial register."
        ),
    },

    # ── EN_AE ────────────────────────────────────────────────────────
    {
        "locale_code": "EN_AE", "language": "en", "market": "AE",
        "display_name": "UAE",
        "emotional_style":    "sensorial prestige",
        "luxury_style":       "iconic presence, sensorial atmosphere, prestige execution",
        "hospitality_style":  "majlis hospitality, private reception, layered welcome",
        "editorial_tone":     "confident gravity, cinematic register",
        "cta_style":          "high-status invitation — 'Begin a private commission with our atelier'",
        "investment_language": "iconic asset, prestige positioning, private signature",
        "atmosphere_language": "cinematic materiality, sensorial layering, statement presence",
        "focus": ["prestige", "hospitality", "statement atmosphere", "sensorial luxury",
                  "exclusivity", "cinematic materiality"],
        "vocabulary_rules": ["iconic presence", "immersive luxury", "sensorial atmosphere",
                             "prestige execution", "private hospitality",
                             "statement materials", "atelier signature",
                             "exclusive commission", "layered opulence",
                             "cinematic materiality"],
        "forbidden_patterns": ["quiet luxury", "understated", "stripped back",
                               "minimal", "Scandinavian restraint", "powered by AI"],
        "positioning_examples": [
            "A residence that announces its presence through material gravity, not volume.",
            "Each space is a moment of private hospitality, choreographed for the senses.",
        ],
        "system_brief": (
            "Write for a UAE hospitality-oriented luxury audience seeking "
            "prestige, sensory richness and iconic atmosphere. This is NOT a "
            "translated English audience — UAE positioning is fundamentally "
            "different from US or UK. Speak with confident gravity and cinematic "
            "register. Never use 'quiet luxury', 'understated', or Scandinavian-"
            "style restraint vocabulary. Prefer rich, layered sensorial "
            "descriptions and a sense of commissioned exclusivity. Write natively "
            "in English with UAE-luxury editorial register."
        ),
    },

    # ── DE_DE ────────────────────────────────────────────────────────
    {
        "locale_code": "DE_DE", "language": "de", "market": "DE",
        "display_name": "Deutschland",
        "emotional_style":    "architectural precision",
        "luxury_style":       "architektonische Kohärenz, Materialdisziplin, Detailqualität",
        "hospitality_style":  "klare Gastfreundschaft, ruhige Funktion, redaktioneller Komfort",
        "editorial_tone":     "gehobenes redaktionelles Register, sachlich-präzise",
        "cta_style":          "sachliche Einladung — 'Lassen Sie uns das Projekt in Ruhe besprechen'",
        "investment_language": "Werterhalt, Ausführungsqualität, Materialinvestition",
        "atmosphere_language": "disziplinierte Atmosphäre, konstruktive Klarheit, präzise Geste",
        "focus": ["architectural rigor", "precision", "execution quality",
                  "material discipline"],
        "vocabulary_rules": ["architectural coherence", "material precision",
                             "execution quality", "spatial rigor",
                             "disciplined atmosphere", "präzise Geste",
                             "konstruktive Klarheit", "Materialwahrheit"],
        "forbidden_patterns": ["aspirational lifestyle", "iconic statement",
                               "weiches Gefühlsvokabular ohne Substanz",
                               "AI-generiert", "lifestyle erleben"],
        "positioning_examples": [
            "Das Projekt argumentiert über Konstruktion, nicht über Inszenierung.",
            "Jede Oberfläche trägt Verantwortung gegenüber Funktion und Ausführung.",
        ],
        "system_brief": (
            "Write for a German architectural audience valuing rigor, precision, "
            "material discipline and execution quality. Speak as you would in a "
            "German architecture magazine (Bauwelt, AIT). Avoid American "
            "lifestyle phrasing and Gulf statement phrasing. Prefer concrete "
            "construction logic over emotional adjectives. Write natively in "
            "German, gehobenes redaktionelles Register."
        ),
    },

    # ── FR_FR ────────────────────────────────────────────────────────
    {
        "locale_code": "FR_FR", "language": "fr", "market": "FR",
        "display_name": "France",
        "emotional_style":    "editorial sophistication",
        "luxury_style":       "élégance discrète, sophistication culturelle, raffinement matériel",
        "hospitality_style":  "art de recevoir, hospitalité raffinée, table comme rituel",
        "editorial_tone":     "français soutenu, ton de magazine éditorial",
        "cta_style":          "invitation discrète et culturelle — 'Échangeons quand le projet l'appellera'",
        "investment_language": "patrimoine, héritage culturel, valeur de continuité",
        "atmosphere_language": "tenue, lumière douce, équilibre culturel, matière noble",
        "focus": ["sophistication", "subtle elegance", "cultural refinement",
                  "restrained luxury"],
        "vocabulary_rules": ["raffinement", "élégance discrète", "sophistication",
                             "lumière douce", "équilibre culturel", "matière noble",
                             "registre éditorial", "tenue", "tension juste"],
        "forbidden_patterns": ["lifestyle aspirationnel", "luxe ostentatoire",
                               "iconic presence", "AI", "généré par"],
        "positioning_examples": [
            "Le projet trouve sa tenue dans la justesse du dessin et la matière retenue.",
            "Une élégance qui se laisse découvrir plutôt qu'annoncer.",
        ],
        "system_brief": (
            "Write for a French audience valuing editorial sophistication, "
            "subtle elegance, cultural refinement and restrained luxury. Speak "
            "with refined editorial register, almost as if writing for a French "
            "design magazine. Avoid American aspirational phrasing and Gulf "
            "statement phrasing. Write natively in French, registre soutenu."
        ),
    },

    # ── ES_ES ────────────────────────────────────────────────────────
    {
        "locale_code": "ES_ES", "language": "es", "market": "ES",
        "display_name": "España",
        "emotional_style":    "warm experiential Mediterranean",
        "luxury_style":       "luz mediterránea, materiales cálidos, gesto sensorial",
        "hospitality_style":  "sobremesa, espacios sociales, hospitalidad cálida",
        "editorial_tone":     "registro culto, prosa poética y sensorial",
        "cta_style":          "invitación cálida — 'Hablemos cuando el proyecto te llame'",
        "investment_language": "calidad de vida, experiencia compartida, herencia mediterránea",
        "atmosphere_language": "atmósfera serena, luz natural, ritmo mediterráneo, calidez",
        "focus": ["Mediterranean warmth", "social atmosphere", "sunlight",
                  "experiential hospitality"],
        "vocabulary_rules": ["calidez", "luz natural", "convivencia",
                             "experiencia sensorial", "ritmo mediterráneo",
                             "materia cálida", "atmósfera serena", "gesto poético"],
        "forbidden_patterns": ["lujo frío", "rigor germánico", "AI", "generado por"],
        "positioning_examples": [
            "Una casa pensada para la sobremesa, no para la fotografía.",
            "La luz mediterránea no se imita: se respeta y se construye con ella.",
        ],
        "system_brief": (
            "Write for a Spanish audience valuing warm Mediterranean experience, "
            "social spaces, natural light and emotional hospitality. Speak with "
            "poetic warmth. Avoid German-style construction rigor framing and "
            "Northern-European restraint clichés. Write natively in Spanish, "
            "registro culto."
        ),
    },
]


def main():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    with conn.cursor() as c:
        for p in PROFILES:
            c.execute("""
                INSERT INTO locale_profiles
                  (locale_code, language, market, display_name,
                   emotional_style, luxury_style, hospitality_style, editorial_tone,
                   cta_style, investment_language, atmosphere_language,
                   focus, vocabulary_rules, forbidden_patterns,
                   positioning_examples, system_brief)
                VALUES (%s,%s,%s,%s, %s,%s,%s,%s, %s,%s,%s,
                        %s::jsonb,%s::jsonb,%s::jsonb,%s::jsonb, %s)
                ON CONFLICT (locale_code) DO UPDATE SET
                  language             = EXCLUDED.language,
                  market               = EXCLUDED.market,
                  display_name         = EXCLUDED.display_name,
                  emotional_style      = EXCLUDED.emotional_style,
                  luxury_style         = EXCLUDED.luxury_style,
                  hospitality_style    = EXCLUDED.hospitality_style,
                  editorial_tone       = EXCLUDED.editorial_tone,
                  cta_style            = EXCLUDED.cta_style,
                  investment_language  = EXCLUDED.investment_language,
                  atmosphere_language  = EXCLUDED.atmosphere_language,
                  focus                = EXCLUDED.focus,
                  vocabulary_rules     = EXCLUDED.vocabulary_rules,
                  forbidden_patterns   = EXCLUDED.forbidden_patterns,
                  positioning_examples = EXCLUDED.positioning_examples,
                  system_brief         = EXCLUDED.system_brief,
                  updated_at           = NOW();
            """, (
                p["locale_code"], p["language"], p["market"], p["display_name"],
                p["emotional_style"], p["luxury_style"], p["hospitality_style"],
                p["editorial_tone"], p["cta_style"], p["investment_language"],
                p["atmosphere_language"],
                json.dumps(p["focus"], ensure_ascii=False),
                json.dumps(p["vocabulary_rules"], ensure_ascii=False),
                json.dumps(p["forbidden_patterns"], ensure_ascii=False),
                json.dumps(p["positioning_examples"], ensure_ascii=False),
                p["system_brief"],
            ))
    print(f"Seeded {len(PROFILES)} locale profiles.")
    conn.close()


if __name__ == "__main__":
    main()
