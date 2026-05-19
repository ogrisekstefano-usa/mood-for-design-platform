"""Seed cultural_descriptors + market_cultural_profiles.

Idempotent: upsert by code / market_code. Run repeatedly to refresh.
"""
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    print("DATABASE_URL missing"); sys.exit(1)


# ────────── Cultural Descriptors (~30) ──────────────────────────────
# Each descriptor activates when ALL its signal_keys reach their threshold.
# Categories: spatial_behavior · architectural_language · material_psychology
#             · environmental_context · hospitality_behavior · luxury_expression
#             · climate_behavior

DESCRIPTORS = [
    # spatial_behavior
    {"code": "resort_living",         "category": "spatial_behavior",         "label": "Resort Living",
     "description": "Vita all'aperto e continuità indoor-outdoor come gesto quotidiano.",
     "weight": 2.2, "signal_keys": ["indoor_outdoor_continuity", "natural_landscape_presence"],
     "signal_thresholds": {"indoor_outdoor_continuity": 0.6, "natural_landscape_presence": 0.55}},
    {"code": "gallery_atmosphere",    "category": "spatial_behavior",         "label": "Gallery Atmosphere",
     "description": "Sale come gallerie d'arte, oggetti come pezzi unici.",
     "weight": 1.8, "signal_keys": ["intimate_layering", "rational_rigor"],
     "signal_thresholds": {"intimate_layering": 0.55, "rational_rigor": 0.55}},
    {"code": "open_continuity",       "category": "spatial_behavior",         "label": "Open Continuity",
     "description": "Pianta aperta e fluida, niente diaframmi.",
     "weight": 1.6, "signal_keys": ["open_plan_continuity"],
     "signal_thresholds": {"open_plan_continuity": 0.65}},
    {"code": "intimate_layering",     "category": "spatial_behavior",         "label": "Intimate Layering",
     "description": "Spazi piccoli, stratificati, abitati.",
     "weight": 1.6, "signal_keys": ["intimate_layering"],
     "signal_thresholds": {"intimate_layering": 0.65}},
    {"code": "vertical_urbanity",     "category": "spatial_behavior",         "label": "Vertical Urbanity",
     "description": "Linguaggio verticale, urbano, sartoriale.",
     "weight": 2.0, "signal_keys": ["vertical_luxury_language", "urban_density"],
     "signal_thresholds": {"vertical_luxury_language": 0.55, "urban_density": 0.5}},

    # architectural_language
    {"code": "tropical_modernism",    "category": "architectural_language",   "label": "Tropical Modernism",
     "description": "Architettura moderna calata in clima tropicale.",
     "weight": 2.4, "signal_keys": ["indoor_outdoor_continuity", "vegetation_presence", "warm_materiality"],
     "signal_thresholds": {"indoor_outdoor_continuity": 0.55, "vegetation_presence": 0.55, "warm_materiality": 0.5}},
    {"code": "sartorial_minimalism",  "category": "architectural_language",   "label": "Sartorial Minimalism",
     "description": "Minimalismo sartoriale, dettaglio misurato.",
     "weight": 2.0, "signal_keys": ["rational_rigor", "intimate_layering"],
     "signal_thresholds": {"rational_rigor": 0.6, "intimate_layering": 0.4}},
    {"code": "monumental_luxury",     "category": "architectural_language",   "label": "Monumental Luxury",
     "description": "Scala monumentale, gesto cerimoniale.",
     "weight": 2.2, "signal_keys": ["ceremonial_scale", "polished_drama"],
     "signal_thresholds": {"ceremonial_scale": 0.6, "polished_drama": 0.55}},
    {"code": "rational_rigor",        "category": "architectural_language",   "label": "Rational Rigor",
     "description": "Rigore razionalista, grammatica architettonica precisa.",
     "weight": 1.8, "signal_keys": ["rational_rigor"],
     "signal_thresholds": {"rational_rigor": 0.7}},
    {"code": "heritage_contemporary", "category": "architectural_language",   "label": "Heritage Contemporary",
     "description": "Dialogo fra heritage e contemporaneo.",
     "weight": 1.9, "signal_keys": ["heritage_layering", "intimate_layering"],
     "signal_thresholds": {"heritage_layering": 0.55, "intimate_layering": 0.4}},
    {"code": "editorial_minimalism",  "category": "architectural_language",   "label": "Editorial Minimalism",
     "description": "Minimalismo editoriale, ritmo visuale lento.",
     "weight": 1.6, "signal_keys": ["rational_rigor", "luminous_warmth"],
     "signal_thresholds": {"rational_rigor": 0.55, "luminous_warmth": 0.5}},
    {"code": "organic_contemporary",  "category": "architectural_language",   "label": "Organic Contemporary",
     "description": "Lessico contemporaneo morbido, organico, californiano.",
     "weight": 2.0, "signal_keys": ["indoor_outdoor_continuity", "warm_materiality", "tactile_softness"],
     "signal_thresholds": {"indoor_outdoor_continuity": 0.5, "warm_materiality": 0.55, "tactile_softness": 0.5}},

    # material_psychology
    {"code": "warm_naturality",       "category": "material_psychology",      "label": "Warm Naturality",
     "description": "Materia naturale calda: legno, lino, terracotta.",
     "weight": 1.8, "signal_keys": ["warm_materiality"],
     "signal_thresholds": {"warm_materiality": 0.65}},
    {"code": "polished_drama",        "category": "material_psychology",      "label": "Polished Drama",
     "description": "Marmi, ottoni, lucentezze: dramma misurato.",
     "weight": 2.0, "signal_keys": ["polished_drama"],
     "signal_thresholds": {"polished_drama": 0.65}},
    {"code": "tactile_softness",      "category": "material_psychology",      "label": "Tactile Softness",
     "description": "Bouclé, velluti, materia tattile.",
     "weight": 1.6, "signal_keys": ["tactile_softness"],
     "signal_thresholds": {"tactile_softness": 0.6}},
    {"code": "atmospheric_darkness",  "category": "material_psychology",      "label": "Atmospheric Darkness",
     "description": "Atmosfera scura, cinematografica.",
     "weight": 1.5, "signal_keys": ["atmospheric_darkness"],
     "signal_thresholds": {"atmospheric_darkness": 0.6}},
    {"code": "luminous_warmth",       "category": "material_psychology",      "label": "Luminous Warmth",
     "description": "Luce calda, atmosfere mediterranee.",
     "weight": 1.8, "signal_keys": ["luminous_warmth"],
     "signal_thresholds": {"luminous_warmth": 0.6}},
    {"code": "architectural_contrast","category": "material_psychology",      "label": "Architectural Contrast",
     "description": "Forte contrasto luce/ombra, materia/vuoto.",
     "weight": 1.6, "signal_keys": ["atmospheric_darkness", "rational_rigor"],
     "signal_thresholds": {"atmospheric_darkness": 0.5, "rational_rigor": 0.55}},

    # environmental_context
    {"code": "landscape_integration", "category": "environmental_context",    "label": "Landscape Integration",
     "description": "Il paesaggio entra nel progetto.",
     "weight": 2.2, "signal_keys": ["natural_landscape_presence", "vegetation_presence"],
     "signal_thresholds": {"natural_landscape_presence": 0.6, "vegetation_presence": 0.55}},
    {"code": "tropical_continuity",   "category": "environmental_context",    "label": "Tropical Continuity",
     "description": "Verde tropicale, palme, acqua.",
     "weight": 2.0, "signal_keys": ["vegetation_presence", "indoor_outdoor_continuity"],
     "signal_thresholds": {"vegetation_presence": 0.6, "indoor_outdoor_continuity": 0.55}},
    {"code": "urban_layering",        "category": "environmental_context",    "label": "Urban Layering",
     "description": "Densità urbana, layering di prospettive.",
     "weight": 1.6, "signal_keys": ["urban_density"],
     "signal_thresholds": {"urban_density": 0.6}},

    # hospitality_behavior
    {"code": "editorial_hospitality", "category": "hospitality_behavior",     "label": "Editorial Hospitality",
     "description": "Accoglienza che sembra una pagina di rivista.",
     "weight": 2.0, "signal_keys": ["hospitality_orientation", "luminous_warmth"],
     "signal_thresholds": {"hospitality_orientation": 0.55, "luminous_warmth": 0.5}},
    {"code": "ceremonial_arrival",    "category": "hospitality_behavior",     "label": "Ceremonial Arrival",
     "description": "Arrivo cerimoniale, hospitality scenografica.",
     "weight": 2.0, "signal_keys": ["ceremonial_scale", "hospitality_orientation"],
     "signal_thresholds": {"ceremonial_scale": 0.6, "hospitality_orientation": 0.55}},
    {"code": "entertainment_living",  "category": "hospitality_behavior",     "label": "Entertainment Living",
     "description": "Casa come palcoscenico sociale.",
     "weight": 1.8, "signal_keys": ["hospitality_orientation", "indoor_outdoor_continuity"],
     "signal_thresholds": {"hospitality_orientation": 0.6, "indoor_outdoor_continuity": 0.5}},
    {"code": "introspective_luxury",  "category": "hospitality_behavior",     "label": "Introspective Luxury",
     "description": "Lusso silenzioso, vita privata.",
     "weight": 1.7, "signal_keys": ["intimate_layering", "atmospheric_darkness"],
     "signal_thresholds": {"intimate_layering": 0.5, "atmospheric_darkness": 0.45}},

    # luxury_expression
    {"code": "discreet_luxury",       "category": "luxury_expression",        "label": "Discreet Luxury",
     "description": "Luxury sussurrato, mai dichiarato.",
     "weight": 1.8, "signal_keys": ["rational_rigor", "intimate_layering"],
     "signal_thresholds": {"rational_rigor": 0.5, "intimate_layering": 0.4}},
    {"code": "scenic_luxury",         "category": "luxury_expression",        "label": "Scenic Luxury",
     "description": "Luxury scenografico, fotogenico.",
     "weight": 1.8, "signal_keys": ["polished_drama", "natural_landscape_presence"],
     "signal_thresholds": {"polished_drama": 0.5, "natural_landscape_presence": 0.5}},
    {"code": "restrained_elegance",   "category": "luxury_expression",        "label": "Restrained Elegance",
     "description": "Eleganza contenuta, dettagli di valore.",
     "weight": 1.6, "signal_keys": ["rational_rigor", "warm_materiality"],
     "signal_thresholds": {"rational_rigor": 0.5, "warm_materiality": 0.45}},

    # climate_behavior (synthetic — read from signals.climate_cues at runtime,
    # but useful as labels for editorial output)
    {"code": "mediterranean_warmth",  "category": "climate_behavior",         "label": "Mediterranean Warmth",
     "description": "Luce e materia mediterranea.",
     "weight": 1.8, "signal_keys": ["luminous_warmth", "warm_materiality"],
     "signal_thresholds": {"luminous_warmth": 0.55, "warm_materiality": 0.5}},
]


# ────────── Market Cultural Profiles (7) ────────────────────────────
PROFILES = [
    {"market_code": "usa_miami", "market_label": "USA · Miami",
     "city": "Miami", "country": "Stati Uniti",
     "descriptors": {
         "resort_living": 3, "tropical_modernism": 3, "tropical_continuity": 3,
         "landscape_integration": 3, "entertainment_living": 3,
         "editorial_hospitality": 2, "luminous_warmth": 2, "warm_naturality": 2,
         "scenic_luxury": 2, "open_continuity": 2,
     },
     "anti_patterns": ["urban_density", "atmospheric_darkness", "ceremonial_scale"],
     "narrative": "Hospitality luminosa, indoor-outdoor come quotidiano, vita sociale aperta.",
     "climate_behavior": "tropical", "luxury_profile": "scenic",
     "hospitality_behavior": "entertainment", "spatial_psychology": "open_continuity",
     "material_tendencies": ["travertine", "linen", "rattan", "stone", "ceramic"]},

    {"market_code": "usa_socal", "market_label": "USA · Southern California",
     "city": "Los Angeles", "country": "Stati Uniti",
     "descriptors": {
         "organic_contemporary": 3, "open_continuity": 3, "warm_naturality": 3,
         "tactile_softness": 2, "landscape_integration": 2, "editorial_minimalism": 2,
         "restrained_elegance": 2, "luminous_warmth": 2,
     },
     "anti_patterns": ["urban_density", "vertical_luxury_language", "ceremonial_scale", "atmospheric_darkness"],
     "narrative": "Contemporaneo organico, lusso morbido, openness californiana senza enfasi cerimoniale.",
     "climate_behavior": "mediterranean", "luxury_profile": "refined",
     "hospitality_behavior": "introspective", "spatial_psychology": "open_continuity",
     "material_tendencies": ["wood_natural", "linen", "stone", "ceramic", "concrete"]},

    {"market_code": "usa_nyc", "market_label": "USA · New York",
     "city": "New York", "country": "Stati Uniti",
     "descriptors": {
         "vertical_urbanity": 3, "sartorial_minimalism": 3, "gallery_atmosphere": 3,
         "intimate_layering": 3, "discreet_luxury": 3, "rational_rigor": 2,
         "introspective_luxury": 2, "polished_drama": 1,
     },
     "anti_patterns": ["indoor_outdoor_continuity", "natural_landscape_presence", "vegetation_presence", "tropical_continuity"],
     "narrative": "Verticalità sartoriale, gallery living, luxury discreto metropolitan.",
     "climate_behavior": "temperate", "luxury_profile": "discreet",
     "hospitality_behavior": "urban_social", "spatial_psychology": "vertical_layering",
     "material_tendencies": ["wood_dark", "brass", "leather", "velvet", "stone"]},

    {"market_code": "uae_dubai", "market_label": "UAE · Dubai",
     "city": "Dubai", "country": "Emirati Arabi",
     "descriptors": {
         "monumental_luxury": 3, "ceremonial_arrival": 3, "polished_drama": 3,
         "editorial_hospitality": 2, "scenic_luxury": 2, "warm_naturality": 1,
     },
     "anti_patterns": ["intimate_layering", "tactile_softness", "atmospheric_darkness"],
     "narrative": "Opulenza materica, scala monumentale, hospitality cerimoniale.",
     "climate_behavior": "desert", "luxury_profile": "monumental",
     "hospitality_behavior": "ceremonial", "spatial_psychology": "monumental_scale",
     "material_tendencies": ["marble", "brass", "bronze", "velvet"]},

    {"market_code": "uk_london", "market_label": "UK · Londra",
     "city": "Londra", "country": "Regno Unito",
     "descriptors": {
         "heritage_contemporary": 3, "intimate_layering": 3, "discreet_luxury": 3,
         "introspective_luxury": 2, "tactile_softness": 2, "restrained_elegance": 2,
         "atmospheric_darkness": 1,
     },
     "anti_patterns": ["indoor_outdoor_continuity", "tropical_continuity", "open_plan_continuity"],
     "narrative": "Heritage contemporaneo, layering tessile, understatement.",
     "climate_behavior": "temperate", "luxury_profile": "refined",
     "hospitality_behavior": "introspective", "spatial_psychology": "intimate_layering",
     "material_tendencies": ["velvet", "wood_dark", "leather", "linen"]},

    {"market_code": "italy_milano", "market_label": "Italia · Milano",
     "city": "Milano", "country": "Italia",
     "descriptors": {
         "rational_rigor": 3, "sartorial_minimalism": 3, "editorial_minimalism": 3,
         "restrained_elegance": 3, "discreet_luxury": 2, "warm_naturality": 2,
         "gallery_atmosphere": 2,
     },
     "anti_patterns": ["tropical_continuity", "ceremonial_scale", "polished_drama"],
     "narrative": "Rigore razionalista, cultura del progetto, dettaglio artigiano.",
     "climate_behavior": "temperate", "luxury_profile": "refined",
     "hospitality_behavior": "introspective", "spatial_psychology": "rational",
     "material_tendencies": ["travertine", "wood_natural", "brass", "stone"]},

    {"market_code": "france_paris", "market_label": "Francia · Parigi",
     "city": "Parigi", "country": "Francia",
     "descriptors": {
         "heritage_contemporary": 3, "editorial_minimalism": 2, "intimate_layering": 3,
         "restrained_elegance": 3, "tactile_softness": 2, "discreet_luxury": 2,
     },
     "anti_patterns": ["tropical_continuity", "monumental_luxury"],
     "narrative": "Eleganza haussmaniana, mix antiquariale, raffinatezza.",
     "climate_behavior": "temperate", "luxury_profile": "refined",
     "hospitality_behavior": "introspective", "spatial_psychology": "intimate_layering",
     "material_tendencies": ["velvet", "wood_natural", "brass", "marble", "linen", "boucle"]},
]


def upsert_descriptors(cur):
    import json
    n = 0
    for d in DESCRIPTORS:
        cur.execute("""
            INSERT INTO cultural_descriptors (code, category, label, description, weight, signal_keys, signal_thresholds)
            VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s::jsonb)
            ON CONFLICT (code) DO UPDATE SET
              category=EXCLUDED.category, label=EXCLUDED.label,
              description=EXCLUDED.description, weight=EXCLUDED.weight,
              signal_keys=EXCLUDED.signal_keys, signal_thresholds=EXCLUDED.signal_thresholds
        """, (d["code"], d["category"], d["label"], d["description"], d["weight"],
              json.dumps(d["signal_keys"]), json.dumps(d["signal_thresholds"])))
        n += 1
    return n


def upsert_profiles(cur):
    import json
    n = 0
    for p in PROFILES:
        cur.execute("""
            INSERT INTO market_cultural_profiles (
              market_code, market_label, city, country, descriptors, anti_patterns,
              narrative, climate_behavior, luxury_profile, hospitality_behavior,
              spatial_psychology, material_tendencies, updated_at
            )
            VALUES (%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s,%s,%s,%s,%s,%s::jsonb,%s)
            ON CONFLICT (market_code) DO UPDATE SET
              market_label=EXCLUDED.market_label, city=EXCLUDED.city, country=EXCLUDED.country,
              descriptors=EXCLUDED.descriptors, anti_patterns=EXCLUDED.anti_patterns,
              narrative=EXCLUDED.narrative, climate_behavior=EXCLUDED.climate_behavior,
              luxury_profile=EXCLUDED.luxury_profile, hospitality_behavior=EXCLUDED.hospitality_behavior,
              spatial_psychology=EXCLUDED.spatial_psychology,
              material_tendencies=EXCLUDED.material_tendencies,
              updated_at=EXCLUDED.updated_at
        """, (p["market_code"], p["market_label"], p["city"], p["country"],
              json.dumps(p["descriptors"]), json.dumps(p["anti_patterns"]),
              p["narrative"], p["climate_behavior"], p["luxury_profile"],
              p["hospitality_behavior"], p["spatial_psychology"],
              json.dumps(p["material_tendencies"]),
              datetime.now(timezone.utc).isoformat()))
        n += 1
    return n


if __name__ == "__main__":
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    cur = conn.cursor()
    a = upsert_descriptors(cur)
    b = upsert_profiles(cur)
    print(f"Seeded {a} descriptors, {b} market profiles")
    cur.close(); conn.close()
