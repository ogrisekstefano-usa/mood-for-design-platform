"""Seed 10 Editorial Inspirations™ for the demo studio.

Phase D · Sprint D1 · Editorial Inspirations Seed™.

Idempotent: each seed is identified by a stable `slug` (stored in
alt_text + inspiration_meta.seed_slug). Re-running the script:
  • updates inspiration_meta of existing seeds
  • leaves user-added inspirations untouched

Curatorial direction (from product brief):
  • narrative concreta · spatial-aware · cultural-aware
  • EVITARE metafore continue / romanticismo / luxury poetry
  • USARE: continuità indoor/outdoor, layering materico, densità urbana,
    atmosfera hospitality, luce naturale, linguaggio architettonico
  • distribuzione: Miami · NYC · Milano · Londra · Dubai · Southern California
"""
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    print("DATABASE_URL missing"); sys.exit(1)

DEMO_TENANT_SLUG = "mood-demo-studio-81a09e"


# ── 10 Editorial Inspirations™ ──────────────────────────────────────
# Image sources: handpicked Unsplash photos with stable hash URLs.
# Each Unsplash URL serves a luxury / editorial interior — no staging-style
# stock photo. Format: photo-{hash}?w=1600&q=85&auto=format&fit=crop.
SEEDS = [
    {
        "slug": "hospitality-luxury-miami",
        "title": "Lobby ricettiva con doppia altezza",
        "url": "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1600&q=85&auto=format&fit=crop",
        "dominant_color": "#C7A47A",
        "narrative":
            "Hall hospitality con doppia altezza. Pietra calcarea calda a pavimento, "
            "boiserie sabbia su parete continua, illuminazione zenitale che restituisce "
            "all'ottone una morbidezza diurna. Composizione che lavora sulla profondità "
            "asse longitudinale — il banco reception arretrato lascia respiro alla quinta architettonica.",
        "atmosphere_tags": ["mediterraneo", "hospitality", "luxury", "luminoso"],
        "material_tags":   ["pietra calcarea", "ottone", "rovere", "lino"],
        "market_codes":    ["us-miami", "ae-dubai"],
        "luxury_level":    "luxury",
        "hospitality_profile": "hospitality_focused",
        "style_tags":      ["editorial", "ceremonial_arrival"],
        "palette":         ["#C7A47A", "#E8DCC8", "#3D2E20", "#8A6B47"],
        "visual_language": "indoor_outdoor_continuity",
        "spatial_behavior": "ceremonial_arrival",
    },
    {
        "slug": "warm-contemporary-residential",
        "title": "Soggiorno residenziale caldo contemporaneo",
        "url": "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1600&q=85&auto=format&fit=crop",
        "dominant_color": "#B89175",
        "narrative":
            "Living residenziale con palette terrosa stratificata: noce canaletto sui mobili "
            "principali, bouclé chiaro sul divano modulare, tappeto in lana cardata. "
            "Luce diffusa dall'esterno, nessuna sorgente puntuale visibile in scena. "
            "Composizione bassa — orizzontalità marcata sotto la quota 110cm.",
        "atmosphere_tags": ["caldo", "residenziale", "intimo", "stratificato"],
        "material_tags":   ["noce canaletto", "bouclé", "lana", "ottone spazzolato"],
        "market_codes":    ["it-milano", "us-nyc", "uk-london"],
        "luxury_level":    "premium",
        "hospitality_profile": "residential_focused",
        "style_tags":      ["warm_residential", "layered_materiality"],
        "palette":         ["#B89175", "#E8DCCB", "#5C4030", "#A6896F"],
        "visual_language": "horizontal_low_composition",
        "spatial_behavior": "intimate_living",
    },
    {
        "slug": "milan-minimal-architecture",
        "title": "Studio milanese minimal — rigore compositivo",
        "url": "https://images.unsplash.com/photo-1618220179428-22790b461013?w=1600&q=85&auto=format&fit=crop",
        "dominant_color": "#E5E0D8",
        "narrative":
            "Spazio milanese costruito sul gesto sottrattivo. Pavimento in resina chiara continua, "
            "boiserie a tutta altezza in rovere spazzolato, dettaglio sottile in ottone "
            "satinato sull'attacco a soffitto. Nessun decoro — la materia è il decoro. "
            "Riferimento utile per progetti residenziali di alta gamma a Milano e Torino.",
        "atmosphere_tags": ["minimal", "rigoroso", "milanese", "monocromatico"],
        "material_tags":   ["rovere spazzolato", "resina", "ottone satinato", "vetro"],
        "market_codes":    ["it-milano"],
        "luxury_level":    "luxury",
        "hospitality_profile": "residential_focused",
        "style_tags":      ["sartorial_minimalism", "editorial"],
        "palette":         ["#E5E0D8", "#9A8E7E", "#3E342A", "#C8B89E"],
        "visual_language": "sartorial_minimalism",
        "spatial_behavior": "restraint",
    },
    {
        "slug": "nyc-gallery-penthouse",
        "title": "Penthouse newyorchese — atmosfera gallery",
        "url": "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1600&q=85&auto=format&fit=crop",
        "dominant_color": "#2A2823",
        "narrative":
            "Penthouse Upper East Side. Pareti in stucco veneziano scuro, parquet a spina ungherese in noce, "
            "opere d'arte trattate come elementi architettonici. Verticalità marcata, pochi pezzi di seduta "
            "molto presenti — Saarinen, Knoll, custom upholstery in velluto profondo. "
            "Composizione che funziona per collezionisti d'arte residenti a Manhattan.",
        "atmosphere_tags": ["urbano", "gallery", "scuro", "sofisticato"],
        "material_tags":   ["stucco veneziano", "noce", "velluto", "ottone brunito"],
        "market_codes":    ["us-nyc"],
        "luxury_level":    "ultra_luxury",
        "hospitality_profile": "residential_focused",
        "style_tags":      ["gallery_atmosphere", "urban_sophistication"],
        "palette":         ["#2A2823", "#8B6F47", "#5A4634", "#D8C9A8"],
        "visual_language": "gallery_atmosphere",
        "spatial_behavior": "vertical_presence",
    },
    {
        "slug": "tropical-hospitality-miami",
        "title": "Hospitality tropicale — Miami penthouse",
        "url": "https://images.unsplash.com/photo-1571508601891-ca5e7a713859?w=1600&q=85&auto=format&fit=crop",
        "dominant_color": "#E8DAB6",
        "narrative":
            "Penthouse Miami con continuità totale indoor-outdoor. Vetrate scorrevoli a tutta altezza, "
            "pavimento in travertino chiaro continuo dentro/fuori, piscina a sfioro come quinta visiva. "
            "Vegetazione tropicale (palma areca, fico) trattata architettonicamente. "
            "Composizione costruita sulla luce — il sole è il quinto materiale.",
        "atmosphere_tags": ["tropicale", "hospitality", "luminoso", "indoor_outdoor"],
        "material_tags":   ["travertino", "teak", "lino", "ottone"],
        "market_codes":    ["us-miami"],
        "luxury_level":    "luxury",
        "hospitality_profile": "hospitality_focused",
        "style_tags":      ["tropical_modernism", "resort_living"],
        "palette":         ["#E8DAB6", "#7DA088", "#3D5944", "#C9A075"],
        "visual_language": "indoor_outdoor_continuity",
        "spatial_behavior": "resort_living",
    },
    {
        "slug": "layered-london-heritage",
        "title": "Heritage londinese — stratificazione contemporanea",
        "url": "https://images.unsplash.com/photo-1615529182904-14819c35db37?w=1600&q=85&auto=format&fit=crop",
        "dominant_color": "#7C5E45",
        "narrative":
            "Townhouse Kensington — boiserie originale in noce restaurata, integrata con tessuti contemporanei "
            "(lino Loro Piana, mohair Pierre Frey), tappeti vintage Esfahan. Il dialogo storico-contemporaneo "
            "è esplicito: i pezzi nuovi non mimano l'antico, lo bilanciano. "
            "Riferimento utile per progetti UK heritage e brownstone Brooklyn.",
        "atmosphere_tags": ["heritage", "stratificato", "intimo", "library"],
        "material_tags":   ["noce", "mohair", "lino", "tappeti persiani"],
        "market_codes":    ["uk-london", "us-nyc"],
        "luxury_level":    "ultra_luxury",
        "hospitality_profile": "residential_focused",
        "style_tags":      ["heritage_contemporary", "layered_warmth"],
        "palette":         ["#7C5E45", "#5A3E2A", "#D8C5A8", "#3C2A1C"],
        "visual_language": "layered_history",
        "spatial_behavior": "intimate_living",
    },
    {
        "slug": "organic-california-wellness",
        "title": "Wellness organico — Southern California",
        "url": "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&q=85&auto=format&fit=crop",
        "dominant_color": "#D4C5AC",
        "narrative":
            "Residenza Malibu con linguaggio organico contemporaneo. Pareti in calce naturale color burro, "
            "trave in legno recuperato a vista, lino lavato sui tessili principali, ceramica artigianale locale. "
            "L'illuminazione è quasi tutta naturale o calda 2700K — nessuna sorgente fredda in casa. "
            "Composizione bassa e orizzontale, in dialogo con il paesaggio dell'oceano.",
        "atmosphere_tags": ["organico", "wellness", "californiano", "naturale"],
        "material_tags":   ["calce naturale", "legno recuperato", "lino lavato", "ceramica artigianale"],
        "market_codes":    ["us-socal"],
        "luxury_level":    "premium",
        "hospitality_profile": "residential_focused",
        "style_tags":      ["organic_contemporary", "soft_minimalism"],
        "palette":         ["#D4C5AC", "#A89880", "#6E5C44", "#EFE8D8"],
        "visual_language": "organic_contemporary",
        "spatial_behavior": "horizontal_low_composition",
    },
    {
        "slug": "stone-luxury-dubai",
        "title": "Stone luxury — atmosfera ceremoniale Dubai",
        "url": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=85&auto=format&fit=crop",
        "dominant_color": "#D8CBB6",
        "narrative":
            "Ingresso residenziale Dubai con vocazione monumentale. Onice retroilluminato sulla quinta principale, "
            "pavimento in marmo Calacatta Oro a fascione, scalinata a sbalzo in acciaio brunito e onice. "
            "Composizione assiale e ceremoniale — il visitatore percorre 8 metri prima di vedere il centro casa. "
            "Riferimento per progetti GCC e collezionisti di pietre naturali.",
        "atmosphere_tags": ["ceremoniale", "monumentale", "luxury", "drammatico"],
        "material_tags":   ["onice retroilluminato", "calacatta oro", "acciaio brunito", "ottone"],
        "market_codes":    ["ae-dubai"],
        "luxury_level":    "ultra_luxury",
        "hospitality_profile": "residential_focused",
        "style_tags":      ["ceremonial_arrival", "stone_dramatic"],
        "palette":         ["#D8CBB6", "#8F7A5C", "#4A3D2C", "#C7B89A"],
        "visual_language": "ceremonial_arrival",
        "spatial_behavior": "axial_monumentality",
    },
    {
        "slug": "boutique-hospitality-european",
        "title": "Boutique hotel europeo — densità curatoriale",
        "url": "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1600&q=85&auto=format&fit=crop",
        "dominant_color": "#3F4842",
        "narrative":
            "Suite boutique hotel — pareti in laccato verde inglese profondo, testata letto in velluto canneté, "
            "comodini in marmo verde alpi, lampade da tavolo in ottone pieno. "
            "Densità decorativa controllata: pochi pezzi, ognuno con peso visivo proprio. "
            "Riferimento per boutique hotels indipendenti (40-60 chiavi) Milano, Parigi, Londra.",
        "atmosphere_tags": ["boutique", "hospitality", "scuro", "curatoriale"],
        "material_tags":   ["laccato", "velluto canneté", "marmo verde alpi", "ottone pieno"],
        "market_codes":    ["it-milano", "uk-london", "fr-paris"],
        "luxury_level":    "luxury",
        "hospitality_profile": "boutique_intimate",
        "style_tags":      ["boutique_atmosphere", "curated_density"],
        "palette":         ["#3F4842", "#8B6F4D", "#1A2620", "#D8C8AA"],
        "visual_language": "curated_density",
        "spatial_behavior": "intimate_living",
    },
    {
        "slug": "editorial-residential-magazine",
        "title": "Residenziale editoriale — composizione magazine",
        "url": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=1600&q=85&auto=format&fit=crop",
        "dominant_color": "#EAE2D2",
        "narrative":
            "Salotto residenziale costruito come copertina editoriale. Composizione frontale, simmetria controllata, "
            "tre punti di interesse equidistanti: divano + tavolino + opera d'arte. "
            "Palette cromatica neutra con un unico accento (cuscino color senape). "
            "Riferimento utile per progetti destinati a pubblicazione su AD, Elle Decor, Cabana.",
        "atmosphere_tags": ["editoriale", "residenziale", "neutro", "magazine"],
        "material_tags":   ["bouclé", "noce", "ottone satinato", "tappeto kilim"],
        "market_codes":    ["it-milano", "us-nyc", "fr-paris"],
        "luxury_level":    "premium",
        "hospitality_profile": "residential_focused",
        "style_tags":      ["editorial", "magazine_composition"],
        "palette":         ["#EAE2D2", "#A89070", "#3F3528", "#C99B5A"],
        "visual_language": "editorial_composition",
        "spatial_behavior": "frontal_symmetry",
    },
]


def _now():
    return datetime.now(timezone.utc).isoformat()


def main():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()

    # Resolve tenant
    cur.execute("SELECT id FROM tenants WHERE slug=%s LIMIT 1", (DEMO_TENANT_SLUG,))
    row = cur.fetchone()
    if not row:
        print(f"Tenant {DEMO_TENANT_SLUG} not found"); sys.exit(1)
    tenant_id = row[0]

    inserted = 0
    updated = 0
    for seed in SEEDS:
        meta = {
            "atmosphere_tags":     seed["atmosphere_tags"],
            "material_tags":       seed["material_tags"],
            "market_codes":        seed["market_codes"],
            "style_tags":          seed["style_tags"],
            "palette":             seed["palette"],
            "luxury_level":        seed["luxury_level"],
            "hospitality_profile": seed["hospitality_profile"],
            "visual_language":     seed["visual_language"],
            "spatial_behavior":    seed["spatial_behavior"],
            "editorial_narrative": seed["narrative"],
            "inspiration_type":    "editorial",
            "seed_slug":           seed["slug"],
            "curated_by":          "MOOD Editorial Team",
        }
        # Existing?
        cur.execute("""SELECT id FROM media_library
                       WHERE tenant_id=%s
                         AND is_inspiration=true
                         AND inspiration_meta->>'seed_slug'=%s
                       LIMIT 1""", (tenant_id, seed["slug"]))
        existing = cur.fetchone()
        if existing:
            cur.execute("""UPDATE media_library
                           SET file_url=%s,
                               source_url=%s,
                               alt_text=%s,
                               description=%s,
                               dominant_color=%s,
                               inspiration_meta=%s,
                               updated_at=%s
                           WHERE id=%s""",
                        (seed["url"], seed["url"], seed["title"],
                         seed["narrative"], seed["dominant_color"],
                         json.dumps(meta), _now(), existing[0]))
            updated += 1
        else:
            new_id = str(uuid.uuid4())
            cur.execute("""INSERT INTO media_library
                           (id, tenant_id, bucket, storage_path, file_url,
                            file_type, file_name, alt_text, description,
                            dominant_color, source_url, source_kind,
                            is_inspiration, inspiration_meta,
                            metadata_json, created_at, updated_at)
                           VALUES (%s, %s, %s, %s, %s,
                                   %s, %s, %s, %s,
                                   %s, %s, %s,
                                   %s, %s,
                                   %s, %s, %s)""",
                        (new_id, tenant_id, "external", "", seed["url"],
                         "image", f"{seed['slug']}.jpg", seed["title"], seed["narrative"],
                         seed["dominant_color"], seed["url"], "url",
                         True, json.dumps(meta),
                         json.dumps({}), _now(), _now()))
            inserted += 1

    conn.commit()
    print(f"Editorial Inspirations Seed™ · inserted={inserted} · updated={updated} · total={len(SEEDS)}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
