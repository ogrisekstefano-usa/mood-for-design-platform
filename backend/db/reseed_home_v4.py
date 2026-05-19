"""
Reseed home V4 — matches the new Italian mockup (CRM/Moodboard/Projects, devices, testimonials, large metrics).
Run: python /app/backend/db/reseed_home_v4.py
"""
import asyncio, json, os, sys, uuid
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

import asyncpg
from dotenv import load_dotenv
load_dotenv(ROOT / '.env')

NS = uuid.UUID('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d')
CORP_SLUG = 'mood-corporate'
LOCALES = ['it', 'en-us', 'en-uk', 'fr', 'de', 'es']

HERO_IMG    = "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&q=85&auto=format&fit=crop"
LAPTOP_IMG  = "https://images.unsplash.com/photo-1567016526105-22da7c13161a?w=1600&q=85&auto=format&fit=crop"
PHONE_IMG   = "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=600&q=85&auto=format&fit=crop"
TABLET_IMG  = "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=1000&q=85&auto=format&fit=crop"
CTA_BG      = "https://images.unsplash.com/photo-1618219944342-824e40a13285?w=1800&q=80&auto=format&fit=crop"

AVATARS = [
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80&auto=format&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80&auto=format&fit=crop&crop=faces",
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&q=80&auto=format&fit=crop&crop=faces",
]


def page_uuid(key): return str(uuid.uuid5(NS, f'page:{CORP_SLUG}:{key}'))
def section_uuid(page, sid): return str(uuid.uuid5(NS, f'section:{CORP_SLUG}:{page}:{sid}'))


SECTIONS = [
    # ── 1) HERO ──────────────────────────────────────────────────────────
    {
        "id": "home-hero", "type": "editorial_hero", "sort": 0,
        "settings": {
            "layout": "split-right", "image_url": HERO_IMG, "image_alt": "Luxury interior",
            "floating_card": {
                "project": "Villa Riviera", "status": "In Progress",
                "client": "Bianchi Family", "budget": "€ 450K",
                "progress": 62,
                "phases": [
                    {"label": "Concept & Moodboard",   "value": 100, "icon": "check"},
                    {"label": "Design Development",    "value": 75,  "icon": "eye"},
                    {"label": "Materials & Selection", "value": 60,  "icon": "palette"},
                    {"label": "Procurement",           "value": 30,  "icon": "cart"},
                    {"label": "Installation",          "value": 0,   "icon": "tools"},
                ],
            },
        },
        "content": {
            "it": {
                "eyebrow": "MOOD for DESIGN",
                "headline_1": "Il sistema operativo",
                "headline_2": "per studi di design",
                "headline_3": "che valorizza il progetto e la relazione.",
                "subheading": "Una piattaforma unica per gestire lead, moodboard, progetti, materiali e storytelling editoriale — sotto il brand del tuo studio.",
                "cta_primary":   {"text": "Prenota una demo",       "href": "/start-studio"},
                "cta_secondary": {"text": "Scopri la piattaforma",  "href": "/platform"},
                "chips": [],
            },
            "en-us": {
                "eyebrow": "MOOD for DESIGN",
                "headline_1": "The operating system",
                "headline_2": "for design studios",
                "headline_3": "that elevates project and relationship.",
                "subheading": "One platform to handle leads, moodboards, projects, materials and editorial storytelling — under your studio's brand.",
                "cta_primary":   {"text": "Book a Demo",        "href": "/start-studio"},
                "cta_secondary": {"text": "Explore the Platform","href": "/platform"},
                "chips": [],
            },
        },
    },

    # ── 2) BRAND LOGOS — luxury furniture & design houses ──────────────
    {
        "id": "home-brands", "type": "logos_wall", "sort": 1,
        "settings": {
            "dark": True,
            "brands": ["Molteni & C", "B&B Italia", "Poliform", "FENDI casa", "Minotti", "LEMA"],
        },
        "content": {
            "it":    {"eyebrow": "Studi e showroom che ci hanno scelto"},
            "en-us": {"eyebrow": "Design houses that chose us"},
        },
    },

    # ── 3) FEATURES — 6-up grid (CRM / MOODBOARD / PROJECTS / HOTSPOT / EDITORIAL / LEAD GEN) ─
    {
        "id": "home-features", "type": "feature_narrative", "sort": 2,
        "settings": {
            "dark": True, "layout": "3-columns",
            "features": [
                {"id": "crm",        "icon": "Users",        "href": "/platform#crm"},
                {"id": "moodboard",  "icon": "Layers",       "href": "/platform#moodboard"},
                {"id": "projects",   "icon": "Briefcase",    "href": "/platform#projects"},
                {"id": "hotspot",    "icon": "Sparkles",     "href": "/platform#hotspot"},
                {"id": "editorial",  "icon": "LayoutTemplate","href": "/platform#editorial"},
                {"id": "leadgen",    "icon": "Zap",          "href": "/platform#leadgen"},
            ],
        },
        "content": {
            "it": {
                "eyebrow": "La piattaforma",
                "headline": "Tutti gli strumenti di cui hai bisogno. In un unico ambiente.",
                "body": "Sei moduli pensati per studi di design, showroom e brand del lusso — perfettamente integrati.",
                "features": [
                    {"id": "crm",       "content": {"it": {"title": "CRM Relazionale",      "description": "Gestisci contatti, lead e clienti con un workflow editoriale.",          "cta": "Scopri di più"}}},
                    {"id": "moodboard", "content": {"it": {"title": "Moodboard",            "description": "Board collaborativi approvati dal cliente in un click.",                 "cta": "Scopri di più"}}},
                    {"id": "projects",  "content": {"it": {"title": "Projects Studio",      "description": "Timeline visuali, fornitori e cantieri tracciati in un unico spazio.",   "cta": "Scopri di più"}}},
                    {"id": "hotspot",   "content": {"it": {"title": "Hotspot Storytelling", "description": "Immagini shoppabili con hotspot, ideali per editoriali e showroom.",   "cta": "Scopri di più"}}},
                    {"id": "editorial", "content": {"it": {"title": "Editorial Studio",     "description": "Pubblica articoli editoriali multilingue con AI integrata.",            "cta": "Scopri di più"}}},
                    {"id": "leadgen",   "content": {"it": {"title": "Lead Generation",      "description": "Form, landing e funnel pronti per il tuo brand. SEO incluso.",          "cta": "Scopri di più"}}},
                ],
            },
            "en-us": {
                "eyebrow": "The Platform",
                "headline": "Every tool you need. In one editorial workspace.",
                "body": "Six modules built for design studios, showrooms and luxury brands — fully integrated.",
                "features": [
                    {"id": "crm",       "content": {"en-us": {"title": "Relational CRM",      "description": "Leads, contacts and clients in an editorial workflow.",       "cta": "Learn more"}}},
                    {"id": "moodboard", "content": {"en-us": {"title": "Moodboard",            "description": "Collaborative boards approved by clients in one click.",      "cta": "Learn more"}}},
                    {"id": "projects",  "content": {"en-us": {"title": "Projects Studio",      "description": "Visual timelines, suppliers and on-site tracking.",            "cta": "Learn more"}}},
                    {"id": "hotspot",   "content": {"en-us": {"title": "Hotspot Storytelling", "description": "Shoppable images for editorials and showroom narratives.",     "cta": "Learn more"}}},
                    {"id": "editorial", "content": {"en-us": {"title": "Editorial Studio",     "description": "Publish multilingual editorial articles with built-in AI.",   "cta": "Learn more"}}},
                    {"id": "leadgen",   "content": {"en-us": {"title": "Lead Generation",      "description": "Forms, landings and funnels under your brand. SEO included.", "cta": "Learn more"}}},
                ],
            },
        },
    },

    # ── 4) DEVICE SHOWCASE ──────────────────────────────────────────────
    {
        "id": "home-devices", "type": "device_showcase", "sort": 3,
        "settings": {"laptop_image": LAPTOP_IMG, "phone_image": PHONE_IMG, "tablet_image": TABLET_IMG},
        "content": {
            "it": {
                "overline": "La piattaforma",
                "headline": "Una piattaforma.\nTutti gli strumenti di cui hai bisogno.",
                "body": "Desktop, tablet, mobile. Il tuo studio sempre in tasca — con la qualità editoriale che il design merita.",
                "cta": {"text": "Scopri tutte le funzionalità", "href": "/platform"},
            },
            "en-us": {
                "overline": "The Platform",
                "headline": "One platform.\nEvery tool you need.",
                "body": "Desktop, tablet, mobile. Your studio in your pocket — with the editorial polish design deserves.",
                "cta": {"text": "Explore all features", "href": "/platform"},
            },
        },
    },

    # ── 5) TESTIMONIALS ─────────────────────────────────────────────────
    {
        "id": "home-testimonials", "type": "testimonial_grid", "sort": 4,
        "settings": {},
        "content": {
            "it": {
                "overline": "Voci dai nostri studi",
                "headline": "Studi e brand di design che già",
                "headline_accent": "usano",
                "headline_after": "MOOD",
                "cta": {"text": "Tutte le case history", "href": "/case-studies"},
                "testimonials": [
                    {"quote": "MOOD ha trasformato il modo in cui presentiamo i progetti ai clienti. Le moodboard sono diventate il nostro linguaggio.",
                     "name": "Chiara Bianchi", "location": "Studio Lumen — Milano", "avatar": AVATARS[0]},
                    {"quote": "Finalmente uno strumento pensato per chi fa design. Editoriale, ordinato, internazionale.",
                     "name": "Marco Ferraro",  "location": "OPLA Studio — Roma",    "avatar": AVATARS[1]},
                    {"quote": "Abbiamo dimezzato il tempo di gestione amministrativa. Più tempo per progettare, meno per coordinare.",
                     "name": "Sofia Rossi",    "location": "House of Vasari — Firenze", "avatar": AVATARS[2]},
                ],
            },
            "en-us": {
                "overline": "Voices from our studios",
                "headline": "Design studios and brands already",
                "headline_accent": "using",
                "headline_after": "MOOD",
                "cta": {"text": "All case studies", "href": "/case-studies"},
                "testimonials": [
                    {"quote": "MOOD transformed how we present projects to clients. Moodboards became our language.",
                     "name": "Chiara Bianchi", "location": "Studio Lumen — Milan", "avatar": AVATARS[0]},
                    {"quote": "Finally a tool built for designers. Editorial, ordered, international.",
                     "name": "Marco Ferraro",  "location": "OPLA Studio — Rome",   "avatar": AVATARS[1]},
                    {"quote": "We halved admin time. More time designing, less coordinating.",
                     "name": "Sofia Rossi",    "location": "House of Vasari — Florence", "avatar": AVATARS[2]},
                ],
            },
        },
    },

    # ── 6) METRICS — big numbers strip ─────────────────────────────────
    {
        "id": "home-metrics", "type": "metrics_strip", "sort": 5,
        "settings": {},
        "content": {
            "it": {
                "metrics": [
                    {"value": "+2.500", "label": "Studi di design e showroom"},
                    {"value": "+18.000","label": "Progetti creati"},
                    {"value": "+230K",  "label": "Utenti attivi ogni mese"},
                    {"value": "90+",    "label": "Paesi raggiunti"},
                ],
            },
            "en-us": {
                "metrics": [
                    {"value": "+2,500", "label": "Design studios & showrooms"},
                    {"value": "+18,000","label": "Projects created"},
                    {"value": "+230K",  "label": "Monthly active users"},
                    {"value": "90+",    "label": "Countries reached"},
                ],
            },
        },
    },

    # ── 7) CTA ─────────────────────────────────────────────────────────
    {
        "id": "home-cta", "type": "cta_section", "sort": 6,
        "settings": {"background_image": CTA_BG, "dim": 0.62, "centered": True},
        "content": {
            "it": {
                "overline": "Inizia adesso",
                "headline": "Pronto a trasformare\nil tuo modo di progettare,\ncomunicare e crescere?",
                "body": "Unisciti agli studi che hanno già scelto MOOD per portare il loro lavoro al livello editoriale che merita.",
                "cta_primary":   {"text": "Prenota una demo",     "href": "/start-studio"},
                "cta_secondary": {"text": "Parla con un esperto", "href": "/contact"},
            },
            "en-us": {
                "overline": "Start now",
                "headline": "Ready to transform\nhow you design, communicate\nand grow?",
                "body": "Join the studios who already chose MOOD to lift their work to the editorial level it deserves.",
                "cta_primary":   {"text": "Book a Demo",    "href": "/start-studio"},
                "cta_secondary": {"text": "Talk to an expert","href": "/contact"},
            },
        },
    },
]


async def main():
    url = os.environ['SESSION_POOLER_URL']
    conn = await asyncpg.connect(url, command_timeout=60)
    try:
        tenant = await conn.fetchrow("SELECT id FROM tenants WHERE slug = $1", CORP_SLUG)
        page = await conn.fetchrow("SELECT id FROM cms_pages WHERE tenant_id = $1 AND page_key = 'home'", tenant['id'])
        tenant_id, page_id = tenant['id'], page['id']
        print(f"tenant={tenant_id}  home_page={page_id}")

        await conn.execute(
            "UPDATE cms_sections SET visible = false, updated_at = NOW() WHERE page_id = $1 AND deleted_at IS NULL",
            page_id,
        )

        for sec in SECTIONS:
            sid = section_uuid('home', sec['id'])
            base_it = sec['content'].get('it') or sec['content'].get('en-us', {})
            locale_content = {}
            for loc in LOCALES:
                v = sec['content'].get(loc)
                locale_content[loc] = v if v else base_it

            await conn.execute(
                """
                INSERT INTO cms_sections
                  (id, tenant_id, page_id, section_type, sort_order, visible,
                   locale_content, settings, asset_refs, created_at, updated_at)
                VALUES
                  ($1, $2, $3, $4, $5, true,
                   $6::jsonb, $7::jsonb, ARRAY[]::uuid[], NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET
                  section_type   = EXCLUDED.section_type,
                  sort_order     = EXCLUDED.sort_order,
                  visible        = true,
                  locale_content = EXCLUDED.locale_content,
                  settings       = EXCLUDED.settings,
                  updated_at     = NOW()
                """,
                sid, tenant_id, page_id, sec['type'], sec['sort'],
                json.dumps(locale_content), json.dumps(sec['settings']),
            )
            print(f"  ✓ {sec['type']:20s}  sort={sec['sort']}  id={sid[:8]}…")

        await conn.execute(
            "UPDATE cms_pages SET status='published', published_at = NOW(), updated_at = NOW() WHERE id = $1",
            page_id,
        )
        print("─── Done. Home reseeded V4 (Italian mockup-faithful) ───")
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
