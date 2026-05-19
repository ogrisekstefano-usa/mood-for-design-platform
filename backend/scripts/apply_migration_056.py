"""Apply migration 056_market_narrative_profiles + seed the 7 curated profiles."""
import os
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')

DB_URL = os.environ.get('DATABASE_URL')
if not DB_URL:
    print("DATABASE_URL not set"); sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent.parent
MIGRATION = ROOT / 'supabase' / 'migrations' / '056_market_narrative_profiles.sql'

# ── Curated profiles (Italian editorial copy — soft influence, NOT override) ──
PROFILES = [
    {
        "market_code": "usa_miami",
        "label": "USA · Miami",
        "narrative_direction": ["Hospitality", "Cinematic", "Warm Luxury", "Lifestyle-driven"],
        "narrative_intensity_bias": "verso cinematic",
        "vocabulary_bias": ["calore", "convivialità", "luce", "indoor/outdoor", "tropical contemporary"],
        "emotional_bias": ["immersione", "ospitalità calorosa", "fluidità"],
        "hospitality_bias": ["entertainment living", "flow hospitality", "open social spaces"],
        "luxury_expression": "warm luxury · lifestyle-centric",
        "storytelling_density": "cinematic — immersiva, narrativa estesa",
        "editorial_style": "magazine hospitality lifestyle (es. AD US, Robb Report)",
        "anti_patterns": [
            "rigid technical narration",
            "cold metropolitan density",
            "minimalismo glaciale",
        ],
        "curator_note": "Mercato orientato a narrazioni luminose, hospitality-driven e lifestyle-centric.",
        "suggested_narrative_mode": "hospitality",
        "suggested_intensity": "cinematic",
    },
    {
        "market_code": "usa_socal",
        "label": "USA · Southern California",
        "narrative_direction": ["Organic Contemporary", "Soft Minimalism", "Wellness Luxury"],
        "narrative_intensity_bias": "verso bilanciata",
        "vocabulary_bias": ["natura", "respiro", "leggerezza", "calma", "organico"],
        "emotional_bias": ["serenità", "wellness", "introspezione morbida"],
        "hospitality_bias": ["residential intimate", "indoor/outdoor seamless", "ritualità del benessere"],
        "luxury_expression": "natural luxury · wellness-driven",
        "storytelling_density": "bilanciata — densa ma misurata",
        "editorial_style": "magazine architettura organica (es. Dwell, Wallpaper West Coast)",
        "anti_patterns": [
            "dramatic luxury",
            "ceremonial tone",
            "scenografia opulenta",
        ],
        "curator_note": "Mercato orientato a una narrazione contemporanea morbida, naturale e wellness-driven.",
        "suggested_narrative_mode": "editorial",
        "suggested_intensity": "balanced",
    },
    {
        "market_code": "usa_nyc",
        "label": "USA · New York",
        "narrative_direction": ["Strategic", "Layered", "Sophisticated Urban"],
        "narrative_intensity_bias": "verso bilanciata",
        "vocabulary_bias": ["densità", "tailoring", "stratificazione", "metropolitano", "gallery"],
        "emotional_bias": ["introspezione", "sofisticazione misurata"],
        "hospitality_bias": ["pied-à-terre verticali", "ospitalità discreta", "rituali serali"],
        "luxury_expression": "urban luxury · sartoriale · introspettivo",
        "storytelling_density": "bilanciata — densa, mai prolissa",
        "editorial_style": "magazine metropolitano sartoriale (es. The New York Times T, Sight Unseen)",
        "anti_patterns": [
            "tropical openness",
            "hospitality excess",
            "warmth caraibica",
        ],
        "curator_note": "Mercato orientato a sofisticazione urbana, layering progettuale e lusso introspettivo.",
        "suggested_narrative_mode": "strategic",
        "suggested_intensity": "balanced",
    },
    {
        "market_code": "italy_milano",
        "label": "Italia · Milano",
        "narrative_direction": ["Editorial", "Restrained Elegance", "Strategic Minimalism"],
        "narrative_intensity_bias": "verso bilanciata",
        "vocabulary_bias": ["rigore", "composizione", "materia", "dettaglio", "misura"],
        "emotional_bias": ["sobrietà", "intellettuale", "rispetto del progetto"],
        "hospitality_bias": ["residential strict", "ospitalità misurata", "rituali quotidiani sobri"],
        "luxury_expression": "understated · culturale · artigianale",
        "storytelling_density": "bilanciata — frasi dense ma non lunghe",
        "editorial_style": "magazine editoriale italiano alto (es. Domus, Living, Abitare)",
        "anti_patterns": [
            "excessive emotionality",
            "overdramatic storytelling",
            "hospitality teatrale",
        ],
        "curator_note": "Mercato orientato a equilibrio compositivo, dettaglio materico e sobrietà editoriale.",
        "suggested_narrative_mode": "editorial",
        "suggested_intensity": "balanced",
    },
    {
        "market_code": "uae_dubai",
        "label": "UAE · Dubai",
        "narrative_direction": ["Monumental", "Ceremonial", "Dramatic Luxury"],
        "narrative_intensity_bias": "verso cinematic",
        "vocabulary_bias": ["scenografia", "monumentalità", "cerimoniale", "ospitalità di gala"],
        "emotional_bias": ["meraviglia", "prestigio", "soglia rituale"],
        "hospitality_bias": ["arrivo cerimoniale", "hospitality di rappresentanza", "ritualità del ricevere"],
        "luxury_expression": "dramatic luxury · monumental · ceremonial",
        "storytelling_density": "cinematic — narrazione immersiva e scenografica",
        "editorial_style": "magazine luxury hospitality (es. Robb Report Middle East, AD Middle East)",
        "anti_patterns": [
            "restrained minimalism",
            "domestico vissuto",
            "sussurro materico",
        ],
        "curator_note": "Mercato orientato a narrazioni immersive, monumentali e ad alto impatto scenografico.",
        "suggested_narrative_mode": "cinematic",
        "suggested_intensity": "cinematic",
    },
    {
        "market_code": "uk_london",
        "label": "UK · Londra",
        "narrative_direction": ["Layered Warmth", "Heritage Contemporary", "Curated Elegance"],
        "narrative_intensity_bias": "verso bilanciata",
        "vocabulary_bias": ["heritage", "layering", "tessitura", "patina", "townhouse"],
        "emotional_bias": ["calore tattile", "memoria contemporanea", "riservatezza"],
        "hospitality_bias": ["domestic-curated", "ricevere intimo", "ritualità della sera"],
        "luxury_expression": "curated warmth · heritage contemporary",
        "storytelling_density": "bilanciata — narrativa colta, mai didascalica",
        "editorial_style": "magazine eclettico colto (es. The World of Interiors, House & Garden UK)",
        "anti_patterns": [
            "minimalismo glaciale",
            "luxury ostentato",
        ],
        "curator_note": "Mercato orientato a eleganza stratificata, calore tattile e heritage contemporaneo.",
        "suggested_narrative_mode": "cultural_analyst",
        "suggested_intensity": "balanced",
    },
    {
        "market_code": "france_paris",
        "label": "Francia · Parigi",
        "narrative_direction": ["Artistic Layering", "Romantic Architecture", "Curated Intimacy"],
        "narrative_intensity_bias": "verso editoriale",
        "vocabulary_bias": ["poesia", "raffinatezza", "intimità", "architettura emotiva", "modanatura"],
        "emotional_bias": ["romantico misurato", "intimità curatoriale", "poesia colta"],
        "hospitality_bias": ["appartamento haussmaniano", "salotto colto", "ritualità del lunch"],
        "luxury_expression": "artistic luxury · curated intimacy",
        "storytelling_density": "editoriale — narrativa poetica e densa",
        "editorial_style": "magazine letterario di interni (es. AD France, Milk Décoration)",
        "anti_patterns": [
            "hospitality scenografica eccessiva",
            "linguaggio tecnico arido",
        ],
        "curator_note": "Mercato orientato a una narrazione artistica, sofisticata e intimamente curatoriale.",
        "suggested_narrative_mode": "emotional",
        "suggested_intensity": "editorial",
    },
]

import json

def main() -> None:
    sql = MIGRATION.read_text()
    print(f"Applying {MIGRATION.name} …")
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(sql)
    print("  ✓ schema ready")

    print(f"Seeding {len(PROFILES)} market narrative profiles (idempotent upsert)…")
    for p in PROFILES:
        cur.execute(
            """
            INSERT INTO market_narrative_profiles (
              market_code, label, narrative_direction, narrative_intensity_bias,
              vocabulary_bias, emotional_bias, hospitality_bias, luxury_expression,
              storytelling_density, editorial_style, anti_patterns, curator_note,
              suggested_narrative_mode, suggested_intensity, updated_at
            ) VALUES (
              %s,%s, %s::jsonb,%s, %s::jsonb,%s::jsonb,%s::jsonb,%s, %s,%s, %s::jsonb,%s, %s,%s, NOW()
            )
            ON CONFLICT (market_code) DO UPDATE SET
              label                    = EXCLUDED.label,
              narrative_direction      = EXCLUDED.narrative_direction,
              narrative_intensity_bias = EXCLUDED.narrative_intensity_bias,
              vocabulary_bias          = EXCLUDED.vocabulary_bias,
              emotional_bias           = EXCLUDED.emotional_bias,
              hospitality_bias         = EXCLUDED.hospitality_bias,
              luxury_expression        = EXCLUDED.luxury_expression,
              storytelling_density     = EXCLUDED.storytelling_density,
              editorial_style          = EXCLUDED.editorial_style,
              anti_patterns            = EXCLUDED.anti_patterns,
              curator_note             = EXCLUDED.curator_note,
              suggested_narrative_mode = EXCLUDED.suggested_narrative_mode,
              suggested_intensity      = EXCLUDED.suggested_intensity,
              updated_at               = NOW()
            """,
            (
                p["market_code"], p["label"],
                json.dumps(p["narrative_direction"]), p["narrative_intensity_bias"],
                json.dumps(p["vocabulary_bias"]),
                json.dumps(p["emotional_bias"]),
                json.dumps(p["hospitality_bias"]),
                p["luxury_expression"],
                p["storytelling_density"], p["editorial_style"],
                json.dumps(p["anti_patterns"]),
                p["curator_note"],
                p["suggested_narrative_mode"], p["suggested_intensity"],
            ),
        )
        print(f"  ✓ {p['market_code']:14s} → {p['suggested_narrative_mode']} · {p['suggested_intensity']}")

    cur.close(); conn.close()
    print("✅ Market Narrative Profiles™ ready.")


if __name__ == "__main__":
    main()
