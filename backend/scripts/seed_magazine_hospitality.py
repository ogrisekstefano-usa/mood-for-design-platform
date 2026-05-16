"""Phase Y.1 EXT seed — Hospitality boutique editorial article.
A second cinematic article seeded for MOOD Demo Studio, this time about
contract / hospitality design. Proves the magazine spans verticals.
Idempotent: re-running upserts by slug.
"""
import os, sys, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from database import db  # noqa: E402

SLUG = "mediterranean-boutique-hospitality-puglia"
TENANT_SLUG = "mood-demo-studio-81a09e"


def main():
    c = db()
    tenant = c.table("tenants").select("id").eq("slug", TENANT_SLUG).limit(1).execute()
    if not tenant.data:
        raise SystemExit(f"tenant {TENANT_SLUG} missing")
    tid = tenant.data[0]["id"]

    # Editorial imagery — boutique hospitality, slow luxury
    HERO    = "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=2400&q=85"
    LOBBY   = "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=2000&q=85"
    SUITE   = "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=2000&q=85"
    DINING  = "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=2000&q=85"
    SPA     = "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=2000&q=85"
    COVER   = "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=85"

    body_blocks = [
        {
            "id": "blk_hero", "type": "hero", "image_url": HERO,
            "alt": "Boutique hospitality villa in Puglia, contemporary mediterranean",
            "settings": {"height": "cinematic"},
            "locale_content": {
                "it": {"caption": "Una villa boutique che respira il ritmo del Mediterraneo"},
                "en": {"caption": "A boutique villa that breathes the Mediterranean rhythm"},
            },
        },
        {
            "id": "blk_intro", "type": "paragraph",
            "locale_content": {
                "it": {"text": "In una masseria di pietra recuperata sulla costa adriatica, abbiamo curato un'esperienza di ospitalità che non vende stanze ma momenti. Ogni soglia, ogni texture, ogni luce è stata pensata come parte di un racconto sensoriale che inizia all'arrivo e prosegue molto dopo la partenza."},
                "en": {"text": "Inside a restored stone masseria on the Adriatic coast, we curated a hospitality experience that doesn't sell rooms — it sells moments. Every threshold, every texture, every light is designed as part of a sensory narrative that begins at arrival and lingers long after the guest leaves."},
            },
        },
        {
            "id": "blk_lobby", "type": "image", "image_url": LOBBY,
            "alt": "Lobby with travertine composition and warm linen seating",
            "locale_content": {
                "it": {"caption": "Lobby · composizione in travertino, sedute in lino crudo e ottone spazzolato"},
                "en": {"caption": "Lobby · travertine composition, raw linen seating and brushed brass"},
            },
        },
        {
            "id": "blk_quote", "type": "quote",
            "locale_content": {
                "it": {"text": "Il vero lusso non è la stanza.\nÈ la pausa che la stanza ti concede.", "author": "Stefano Ogrisek"},
                "en": {"text": "True luxury isn't the room.\nIt's the pause the room grants you.", "author": "Stefano Ogrisek"},
            },
        },
        {
            "id": "blk_suite", "type": "image", "image_url": SUITE,
            "alt": "Suite with linen drapes and natural oak bed frame",
            "locale_content": {
                "it": {"caption": "Suite · tendaggi in lino pesante, struttura letto in rovere naturale"},
                "en": {"caption": "Suite · heavy linen drapes, natural oak bed frame"},
            },
        },
        {
            "id": "blk_textures", "type": "paragraph",
            "locale_content": {
                "it": {"text": "I tessuti raccontano la storia del luogo. Lino grezzo, lana cardata, cotone tinto in pasta. Niente sintetico, niente liscio. Ogni superficie chiede di essere toccata e, soprattutto, di essere ricordata."},
                "en": {"text": "Textiles tell the story of the place. Raw linen, carded wool, piece-dyed cotton. No synthetic, no slick. Every surface asks to be touched — and, more importantly, to be remembered."},
            },
        },
        {
            "id": "blk_dining", "type": "image", "image_url": DINING,
            "alt": "Restaurant with sculptural pendant lighting over walnut tables",
            "locale_content": {
                "it": {"caption": "Ristorante · luce ambientale calda, lampade scultoree in alabastro su tavoli in noce"},
                "en": {"caption": "Restaurant · warm ambient light, sculptural alabaster pendants over walnut tables"},
            },
        },
        {
            "id": "blk_spa", "type": "image", "image_url": SPA,
            "alt": "Spa with stone basins and candlelit niches",
            "locale_content": {
                "it": {"caption": "Spa · vasche in pietra, nicchie a luce di candela, palette terracotta e bianco osso"},
                "en": {"caption": "Spa · stone basins, candlelit niches, terracotta and bone-white palette"},
            },
        },
        {
            "id": "blk_outro", "type": "paragraph",
            "locale_content": {
                "it": {"text": "Questo non è un hotel. È un progetto di ospitalità lenta, dove l'architettura serve l'esperienza dell'ospite e non viceversa. Quattro Design References™ ti aiutano a esplorare le scelte materiche che hanno reso possibile questa atmosfera."},
                "en": {"text": "This is not a hotel. It's a slow-hospitality project, where architecture serves the guest experience and never the other way around. Four Design References™ help you explore the material choices that made this atmosphere possible."},
            },
        },
    ]

    locale_content = {
        "it": {
            "kicker":   "Hospitality · Puglia",
            "title":    "Ospitalità boutique mediterranea in Puglia",
            "summary":  "Una masseria restaurata sulla costa adriatica, ridisegnata come esperienza sensoriale lenta. Materiali naturali, luce di candela, ritmo del paesaggio.",
            "meta_title": "Ospitalità boutique mediterranea · MOOD Demo Studio",
            "meta_description": "Editoriale: una masseria boutique in Puglia ridisegnata come esperienza di ospitalità lenta. Travertino, lino grezzo, atmosfere mediterranee.",
            "category_label": "Hospitality",
        },
        "en": {
            "kicker":   "Hospitality · Puglia",
            "title":    "Mediterranean boutique hospitality in Puglia",
            "summary":  "A restored masseria on the Adriatic coast, redesigned as a slow sensory experience. Natural materials, candlelight, the rhythm of the landscape.",
            "meta_title": "Mediterranean boutique hospitality · MOOD Demo Studio",
            "meta_description": "Editorial: a boutique masseria in Puglia redesigned as slow hospitality. Travertine, raw linen, mediterranean atmospheres.",
            "category_label": "Hospitality",
        },
    }

    article_record = {
        "locale_content": locale_content, "body_blocks": body_blocks,
        "cover_url": COVER, "hero_url": HERO, "status": "published",
        "category_slug": "hospitality", "subcategory": "boutique-hotel",
        "project_vertical": "hospitality",
        "editorial_tone": "slow-luxury",
        "locale_market": "IT",
        "tags": ["puglia", "mediterranean", "contemporary-luxury", "hospitality-inspired",
                 "travertine", "natural-oak", "warm-minimalism"],
        "featured_materials": ["travertine", "natural-oak", "raw-linen", "brushed-brass", "alabaster"],
        "atmosphere_keywords": ["slow-luxury", "candlelight", "mediterranean", "guest-experience",
                                "terracotta", "bone-white"],
        "default_locale": "it", "reading_minutes": 6, "scope": "tenant",
    }

    existing = (c.table("magazine_articles").select("id")
                .eq("tenant_id", tid).eq("slug", SLUG).limit(1).execute())
    if existing.data:
        aid = existing.data[0]["id"]
        c.table("article_hotspots").delete().eq("article_id", aid).execute()
        c.table("magazine_articles").update({**article_record, "published_at": "now()"}).eq("id", aid).execute()
    else:
        aid = str(uuid.uuid4())
        c.table("magazine_articles").insert({
            "id": aid, "tenant_id": tid, "slug": SLUG, **article_record,
        }).execute()
    print(f"article: {aid} ({SLUG})")

    # Four hospitality-oriented Design References™
    hotspots = [
        {
            "block_id": "blk_lobby", "x_pct": 42, "y_pct": 58,
            "reference_type": "material", "cta_action": "save_to_project", "sort_order": 1,
            "locale_content": {
                "it": {"label": "Composizione in travertino lobby",
                       "description": "Travertino romano levigato in lastre 80×80 cm, posa a fasce alternate. Crea continuità tra esterno e interno e accoglie ogni passaggio.",
                       "cta_label": "Salva questa composizione materica"},
                "en": {"label": "Lobby travertine composition",
                       "description": "Polished Roman travertine in 80×80 cm slabs, alternating bands. Creates continuity between outdoor and indoor, welcoming every passage.",
                       "cta_label": "Save this material composition"},
            },
        },
        {
            "block_id": "blk_suite", "x_pct": 30, "y_pct": 48,
            "reference_type": "fabric", "cta_action": "explore_material", "sort_order": 2,
            "locale_content": {
                "it": {"label": "Tessuti suite · lino pesante",
                       "description": "Tendaggi in lino lavato 100% naturale, peso 380 g/m². Filtrano la luce mediterranea senza spegnerla. Ideali per suite con grandi aperture.",
                       "cta_label": "Esplora questa atmosfera ospitale"},
                "en": {"label": "Suite textiles · heavy linen",
                       "description": "100% natural washed linen drapes, 380 g/m² weight. They filter Mediterranean light without dulling it. Ideal for suites with large openings.",
                       "cta_label": "Explore this hospitality atmosphere"},
            },
        },
        {
            "block_id": "blk_dining", "x_pct": 50, "y_pct": 35,
            "reference_type": "lighting", "cta_action": "discuss_with_advisor", "sort_order": 3,
            "locale_content": {
                "it": {"label": "Illuminazione ambient ristorante",
                       "description": "Sospensioni scultoree in alabastro naturale, temperatura 2400K. Una luce che ricorda la candela ma non la imita.",
                       "cta_label": "Usa questa atmosfera nel mio concept"},
                "en": {"label": "Restaurant ambient lighting",
                       "description": "Sculptural alabaster pendants, 2400K colour temperature. A light that echoes candlelight without imitating it.",
                       "cta_label": "Use this atmosphere in my concept"},
            },
        },
        {
            "block_id": "blk_spa", "x_pct": 65, "y_pct": 55,
            "reference_type": "atmosphere", "cta_action": "discuss_with_advisor", "sort_order": 4,
            "locale_content": {
                "it": {"label": "Palette sensoriale spa",
                       "description": "Terracotta toscana, bianco osso, nicchie a luce di candela. Una palette che rallenta il respiro dell'ospite e ridefinisce il concetto di lusso.",
                       "cta_label": "Discuti questa guest experience"},
                "en": {"label": "Spa sensory palette",
                       "description": "Tuscan terracotta, bone white, candlelit niches. A palette that slows the guest's breath and redefines the very idea of luxury.",
                       "cta_label": "Discuss this guest experience"},
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
    print(f"seeded {len(hotspots)} hospitality hotspots")


if __name__ == "__main__":
    main()
