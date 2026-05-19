"""Apply migration 058 + seed Brand Registry™ with 15 curated brands.

Idempotent — può essere rilanciato senza duplicare.
"""
import os, sys, json
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')
DB_URL = os.environ.get('DATABASE_URL')
if not DB_URL: print("DATABASE_URL not set"); sys.exit(1)

MIG = Path(__file__).resolve().parent.parent.parent / 'supabase' / 'migrations' / '058_brand_registry.sql'

# ── 15 brand reali curati (curated_public, tenant_id=NULL) ──────────
BRANDS = [
    # name                  slug                    category        country  positioning                luxury_tier      h   r   c   r2  markets
    ("Minotti",             "minotti",              "arredi",       "IT", "editorial luxury",          "icon",          85, 95, 65, 30, ["italy_milano","usa_nyc","uae_dubai"]),
    ("Poliform",            "poliform",             "arredi",       "IT", "design contemporaneo",      "premium",       70, 95, 60, 35, ["italy_milano","usa_miami","usa_socal"]),
    ("Cassina",             "cassina",              "arredi",       "IT", "patrimonio del design",     "icon",          75, 90, 70, 40, ["italy_milano","france_paris","usa_nyc"]),
    ("B&B Italia",          "b-and-b-italia",       "arredi",       "IT", "design icon",               "icon",          75, 90, 70, 40, ["italy_milano","usa_nyc","uk_london"]),
    ("Flexform",            "flexform",             "arredi",       "IT", "contemporary residential",  "premium",       55, 95, 50, 25, ["italy_milano","usa_socal","usa_nyc"]),
    ("Bonaldo",             "bonaldo",              "arredi",       "IT", "design accessibile",        "contemporary",  50, 80, 60, 70, ["italy_milano","france_paris"]),
    ("Cattelan Italia",     "cattelan-italia",      "arredi",       "IT", "luxury contemporaneo",      "premium",       65, 85, 65, 45, ["italy_milano","uae_dubai","usa_miami"]),
    ("Molteni&C",           "molteni-c",            "arredi",       "IT", "casa contemporanea",        "premium",       70, 90, 65, 40, ["italy_milano","france_paris","uk_london"]),
    ("Maxalto",             "maxalto",              "arredi",       "IT", "sartorialità domestica",    "icon",          70, 95, 60, 30, ["italy_milano","usa_nyc","uk_london"]),
    ("Flos",                "flos",                 "illuminazione","IT", "illuminazione editoriale",  "icon",          85, 90, 80, 50, ["italy_milano","usa_nyc","france_paris","uae_dubai"]),
    ("Artemide",            "artemide",             "illuminazione","IT", "design della luce",         "premium",       80, 85, 85, 55, ["italy_milano","usa_nyc","france_paris"]),
    ("Boffi",               "boffi",                "cucine",       "IT", "cucine d'autore",           "icon",          80, 95, 75, 50, ["italy_milano","usa_nyc","uae_dubai"]),
    ("Margraf",             "margraf",              "pietra_naturale","IT","pietra naturale italiana", "premium",       90, 80, 95, 40, ["italy_milano","uae_dubai","usa_miami"]),
    ("Rimadesio",           "rimadesio",            "arredi",       "IT", "sistemi architettonici",    "premium",       70, 90, 75, 45, ["italy_milano","usa_nyc","uk_london"]),
    ("Edra",                "edra",                 "arredi",       "IT", "scultura abitabile",        "icon",          60, 85, 50, 35, ["italy_milano","usa_nyc","france_paris"]),
]

# ── Tag registry seeds — atmosphere e material curate ───────────────
ATMOS_TAGS = [
    ("sobrio","Sobrio"),("editoriale","Editoriale"),("cinematografico","Cinematografico"),
    ("ospitale","Ospitale"),("residenziale","Residenziale"),("luminoso","Luminoso"),
    ("architettonico","Architettonico"),("monumentale","Monumentale"),("intimo","Intimo"),
    ("conviviale","Conviviale"),("contemplativo","Contemplativo"),("sartoriale","Sartoriale"),
]
MATERIAL_TAGS = [
    ("legno","Legno"),("noce_canaletto","Noce Canaletto"),("rovere","Rovere"),
    ("marmo","Marmo"),("travertino","Travertino"),("pietra_serena","Pietra Serena"),
    ("ottone","Ottone"),("ottone_spazzolato","Ottone spazzolato"),("acciaio","Acciaio"),
    ("vetro","Vetro"),("lino","Lino"),("velluto","Velluto"),
    ("tessuto_naturale","Tessuto naturale"),("cuoio","Cuoio"),("metallo","Metallo"),
]


def main():
    print(f"Applying {MIG.name} …")
    conn = psycopg2.connect(DB_URL); conn.autocommit = True
    cur = conn.cursor()
    cur.execute(MIG.read_text())
    print("  ✓ schema ready")

    print(f"Seeding {len(BRANDS)} curated brands…")
    for b in BRANDS:
        (name, slug, cat, country, pos, tier, hs, rs, cs, r2, markets) = b
        cur.execute("""
            INSERT INTO brands (
              tenant_id, name, slug, category, country, positioning, luxury_tier,
              hospitality_score, residential_score, contract_score, retail_score,
              primary_markets, agreement_status, visibility_level, asset_pack_available,
              created_at, updated_at
            ) VALUES (
              NULL, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb,
              'unverified', 'curated_public', FALSE, NOW(), NOW()
            )
            ON CONFLICT (tenant_id, slug) DO UPDATE SET
              name              = EXCLUDED.name,
              category          = EXCLUDED.category,
              country           = EXCLUDED.country,
              positioning       = EXCLUDED.positioning,
              luxury_tier       = EXCLUDED.luxury_tier,
              hospitality_score = EXCLUDED.hospitality_score,
              residential_score = EXCLUDED.residential_score,
              contract_score    = EXCLUDED.contract_score,
              retail_score      = EXCLUDED.retail_score,
              primary_markets   = EXCLUDED.primary_markets,
              updated_at        = NOW()
        """, (name, slug, cat, country, pos, tier, hs, rs, cs, r2, json.dumps(markets)))
    print(f"  ✓ {len(BRANDS)} brands seeded.")

    print(f"Seeding tag_registry (atmosphere + material) …")
    for slug, label in ATMOS_TAGS:
        cur.execute("""
            INSERT INTO tag_registry (tenant_id, slug, label, type, approved, created_at, updated_at)
            VALUES (NULL, %s, %s, 'atmosphere', TRUE, NOW(), NOW())
            ON CONFLICT (tenant_id, type, slug) DO UPDATE SET label = EXCLUDED.label, approved = TRUE
        """, (slug, label))
    for slug, label in MATERIAL_TAGS:
        cur.execute("""
            INSERT INTO tag_registry (tenant_id, slug, label, type, approved, created_at, updated_at)
            VALUES (NULL, %s, %s, 'material', TRUE, NOW(), NOW())
            ON CONFLICT (tenant_id, type, slug) DO UPDATE SET label = EXCLUDED.label, approved = TRUE
        """, (slug, label))
    # Brand tags (slug = brand slug, label = brand name)
    for b in BRANDS:
        cur.execute("""
            INSERT INTO tag_registry (tenant_id, slug, label, type, approved, created_at, updated_at)
            VALUES (NULL, %s, %s, 'brand', TRUE, NOW(), NOW())
            ON CONFLICT (tenant_id, type, slug) DO UPDATE SET label = EXCLUDED.label, approved = TRUE
        """, (b[1], b[0]))
    print(f"  ✓ tag_registry seeded ({len(ATMOS_TAGS)} atmosphere + {len(MATERIAL_TAGS)} material + {len(BRANDS)} brand).")

    cur.close(); conn.close()
    print("✅ Brand Registry™ ready.")


if __name__ == "__main__":
    main()
