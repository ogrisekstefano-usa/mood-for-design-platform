"""Phase Y.1 seed — one cinematic editorial article + 4 Design References™
for the MOOD Demo Studio tenant. Idempotent: re-running upserts by slug.
"""
import os, sys, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from database import db  # noqa: E402

SLUG = "casa-vista-mare-ligure"
TENANT_SLUG = "mood-demo-studio-81a09e"


def t(it, en=None, fr=None, de=None, es=None):
    return {"it": it, "en": en or it, "fr": fr or it, "de": de or it, "es": es or it}


def main():
    c = db()
    tenant = c.table("tenants").select("id").eq("slug", TENANT_SLUG).limit(1).execute()
    if not tenant.data:
        raise SystemExit(f"tenant {TENANT_SLUG} missing")
    tid = tenant.data[0]["id"]

    # Image library (Unsplash editorial)
    HERO = "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2400&q=85"
    LIVING = "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=2000&q=85"
    KITCHEN = "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=2000&q=85"
    BEDROOM = "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=2000&q=85"
    COVER = "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1600&q=85"

    body_blocks = [
        {
            "id": "blk_hero",
            "type": "hero",
            "image_url": HERO,
            "alt": "Soggiorno con vista mare, palette warm minimal",
            "settings": {"height": "cinematic"},
            "locale_content": {
                "it": {"caption": "Un soggiorno che si apre al mare ligure"},
                "en": {"caption": "A living room that opens onto the Ligurian sea"},
            },
        },
        {
            "id": "blk_intro",
            "type": "paragraph",
            "locale_content": {
                "it": {"text": "Una villa privata in Liguria, ridisegnata per accogliere la luce del Mediterraneo. Il progetto nasce dalla volontà di portare la vista del mare dentro ogni stanza, attraverso una palette di materiali caldi e tessuti naturali."},
                "en": {"text": "A private villa in Liguria, redesigned to welcome the Mediterranean light. The project was born from the desire to bring the sea view into every room, through a palette of warm materials and natural fabrics."},
            },
        },
        {
            "id": "blk_living",
            "type": "image",
            "image_url": LIVING,
            "alt": "Soggiorno con divano in lino e tavolino in travertino",
            "locale_content": {
                "it": {"caption": "Soggiorno · divani in lino sabbia e tavolino in travertino"},
                "en": {"caption": "Living room · sand linen sofas and travertine coffee table"},
            },
        },
        {
            "id": "blk_quote",
            "type": "quote",
            "locale_content": {
                "it": {"text": "Ogni stanza è una pausa.\nIl progetto respira con il paesaggio.", "author": "Stefano Ogrisek"},
                "en": {"text": "Every room is a pause.\nThe project breathes with the landscape.", "author": "Stefano Ogrisek"},
            },
        },
        {
            "id": "blk_kitchen",
            "type": "image",
            "image_url": KITCHEN,
            "alt": "Cucina con isola in noce e top in marmo Calacatta",
            "locale_content": {
                "it": {"caption": "Cucina · isola in noce e top in marmo Calacatta"},
                "en": {"caption": "Kitchen · walnut island with Calacatta marble top"},
            },
        },
        {
            "id": "blk_materials",
            "type": "paragraph",
            "locale_content": {
                "it": {"text": "La cucina è il cuore convivale della casa. Abbiamo scelto noce massello per ricordare il calore di un'imbarcazione classica e marmo Calacatta per la luminosità del paesaggio marino. Tre Design References™ ti aiutano a esplorare la palette."},
                "en": {"text": "The kitchen is the convivial heart of the home. We chose solid walnut to evoke the warmth of a classic vessel and Calacatta marble to capture the luminosity of the coastal landscape. Three Design References™ help you explore the palette."},
            },
        },
        {
            "id": "blk_bedroom",
            "type": "image",
            "image_url": BEDROOM,
            "alt": "Camera padronale con boiserie chiara e tendaggi in lino",
            "locale_content": {
                "it": {"caption": "Camera padronale · boiserie chiara, tessuti in lino e ottone spazzolato"},
                "en": {"caption": "Master bedroom · soft boiserie, linen textiles and brushed brass"},
            },
        },
    ]

    locale_content = {
        "it": {
            "kicker":   "Residenza · Liguria",
            "title":    "Casa vista mare ligure",
            "summary":  "Una villa privata sulla costa ligure, ridisegnata per portare la luce del Mediterraneo dentro ogni stanza.",
            "meta_title": "Casa vista mare ligure · MOOD Demo Studio",
            "meta_description": "Editoriale: una villa privata in Liguria con palette warm minimal, materiali caldi e una vista che entra in ogni stanza.",
            "category_label": "Residenza",
        },
        "en": {
            "kicker":   "Residential · Liguria",
            "title":    "A Ligurian sea-view residence",
            "summary":  "A private villa on the Ligurian coast, redesigned to bring the Mediterranean light into every room.",
            "meta_title": "A Ligurian sea-view residence · MOOD Demo Studio",
            "meta_description": "Editorial: a private villa in Liguria with a warm minimal palette, natural materials and a sea view that enters every room.",
            "category_label": "Residential",
        },
    }

    # Upsert article
    existing = (c.table("magazine_articles").select("id")
                .eq("tenant_id", tid).eq("slug", SLUG).limit(1).execute())
    article_record = {
        "locale_content": locale_content, "body_blocks": body_blocks,
        "cover_url": COVER, "hero_url": HERO, "status": "published",
        "category_slug": "residential", "subcategory": "private-villa",
        "project_vertical": "residential",
        "editorial_tone": "warm-minimalism",
        "locale_market": "IT",
        "tags": ["liguria", "warm-minimal", "sea-view", "mediterranean",
                 "travertine", "natural-oak"],
        "featured_materials": ["travertine", "walnut", "calacatta-marble",
                               "linen", "brushed-brass"],
        "atmosphere_keywords": ["mediterranean", "sea-light", "warm-minimal",
                                "convivial", "evening"],
        "default_locale": "it", "reading_minutes": 4,
        "scope": "tenant",
    }
    if existing.data:
        aid = existing.data[0]["id"]
        # Clear old hotspots before re-seeding
        c.table("article_hotspots").delete().eq("article_id", aid).execute()
        c.table("magazine_articles").update({**article_record, "published_at": "now()"}).eq("id", aid).execute()
    else:
        aid = str(uuid.uuid4())
        c.table("magazine_articles").insert({
            "id": aid, "tenant_id": tid, "slug": SLUG, **article_record,
        }).execute()
    print(f"article: {aid} ({SLUG})")

    # Hotspots — 4 Design References™ placed on different body blocks
    hotspots = [
        {
            "block_id": "blk_living", "x_pct": 38, "y_pct": 62,
            "reference_type": "fabric", "cta_action": "explore_material",
            "sort_order": 1,
            "locale_content": {
                "it": {"label": "Lino sabbia · texture morbida",
                       "description": "Tessuto in lino lavato 100% naturale, palette warm sand. Ideale per divani imbottiti in ambienti aperti sulla luce esterna.",
                       "cta_label": "Esplora la palette materica"},
                "en": {"label": "Sand washed linen",
                       "description": "Washed 100% natural linen, warm sand palette. Ideal for upholstered sofas in spaces open to natural light.",
                       "cta_label": "Explore this material palette"},
            },
        },
        {
            "block_id": "blk_living", "x_pct": 65, "y_pct": 78,
            "reference_type": "material", "cta_action": "save_to_project",
            "sort_order": 2,
            "locale_content": {
                "it": {"label": "Travertino classico",
                       "description": "Travertino romano levigato, finitura aperta. Disponibile in lastre 60×60 e 80×80 cm.",
                       "cta_label": "Salva nel mio progetto"},
                "en": {"label": "Classic travertine",
                       "description": "Polished Roman travertine, open finish. Available in 60×60 and 80×80 cm slabs.",
                       "cta_label": "Save to my project"},
            },
        },
        {
            "block_id": "blk_kitchen", "x_pct": 50, "y_pct": 55,
            "reference_type": "finish", "cta_action": "discuss_with_advisor",
            "sort_order": 3,
            "locale_content": {
                "it": {"label": "Noce massello + Calacatta",
                       "description": "Combinazione di noce europeo a venatura corta e marmo Calacatta levigato — pensata per cucine conviviali con vista paesaggio.",
                       "cta_label": "Parla con il mio referente"},
                "en": {"label": "Walnut + Calacatta",
                       "description": "European short-grain walnut paired with polished Calacatta marble — designed for convivial kitchens with a landscape view.",
                       "cta_label": "Discuss with my advisor"},
            },
        },
        {
            "block_id": "blk_bedroom", "x_pct": 28, "y_pct": 45,
            "reference_type": "atmosphere", "cta_action": "add_to_moodboard",
            "sort_order": 4,
            "locale_content": {
                "it": {"label": "Atmosfera notturna serale",
                       "description": "Boiserie chiara, ottone spazzolato e tessuti in lino crema. Una camera che respira come un porto al tramonto.",
                       "cta_label": "Usa nella mia moodboard"},
                "en": {"label": "Evening atmosphere",
                       "description": "Soft boiserie, brushed brass and cream linen textiles. A bedroom that breathes like a harbour at sunset.",
                       "cta_label": "Use in my moodboard"},
            },
        },
    ]
    for h in hotspots:
        c.table("article_hotspots").insert({
            "id": str(uuid.uuid4()), "tenant_id": tid, "article_id": aid,
            "block_id": h["block_id"], "x_pct": h["x_pct"], "y_pct": h["y_pct"],
            "reference_type": h["reference_type"], "cta_action": h["cta_action"],
            "sort_order": h["sort_order"], "locale_content": h["locale_content"],
            "visible": True,
        }).execute()
    print(f"seeded {len(hotspots)} hotspots")


if __name__ == "__main__":
    main()
