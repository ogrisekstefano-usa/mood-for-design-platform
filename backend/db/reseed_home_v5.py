"""
Reseed home V5 — premium editorial homepage matching the latest user mockup.
Removes ALL fake brand logos, fake testimonials and fake metrics per user direction.
Adds the workflow ecosystem, experience pillars and fragmented-tools sections.

Run: python /app/backend/db/reseed_home_v5.py
"""
import asyncio, json, os, sys, uuid
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

import asyncpg
from dotenv import load_dotenv
load_dotenv(ROOT / '.env')

NS = uuid.UUID('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d')
CORP_SLUG = 'studio'
LOCALES = ['it', 'en-us', 'en-uk', 'fr', 'de', 'es']

# ── Imagery — editorial interior architecture ───────────────────────────────
HERO_LAPTOP_IMG = "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1800&q=85&auto=format&fit=crop"
LAPTOP_IMG      = "https://images.unsplash.com/photo-1567016526105-22da7c13161a?w=1800&q=85&auto=format&fit=crop"
PHONE_IMG       = "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=700&q=85&auto=format&fit=crop"
TABLET_IMG      = "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=1200&q=85&auto=format&fit=crop"
CTA_BG          = "https://images.unsplash.com/photo-1618219944342-824e40a13285?w=1800&q=80&auto=format&fit=crop"


def section_uuid(page, sid): return str(uuid.uuid5(NS, f'section:{CORP_SLUG}:{page}:{sid}'))


SECTIONS = [
    # ── 1) HERO — split-right, editorial italic subhead, phone floating mock ─
    {
        "id": "home-hero", "type": "editorial_hero", "sort": 0,
        "settings": {
            "layout": "split-right",
            "image_url": HERO_LAPTOP_IMG,
            "image_alt": "Studio di design contemporaneo",
            "floating_card": {
                "style": "phone",
                "progress": 62,
                "phases": [
                    {"label": "Concept",       "value": 100},
                    {"label": "Selezioni",     "value": 75},
                    {"label": "Sviluppo",      "value": 60},
                    {"label": "Acquisti",      "value": 30},
                    {"label": "Installazione", "value": 0},
                ],
            },
        },
        "content": {
            "it": {
                "headline_1": "Il sistema operativo",
                "headline_2": "per studi e showroom",
                "headline_3": "di design contemporaneo.",
                "subheading_accent": "Un unico ambiente. Tutto integrato.",
                "subheading_white":  "Ogni relazione, ogni progetto, ogni contenuto.",
                "subheading":  "MOOD for DESIGN è la piattaforma che unisce relazione e progettazione, contenuti editoriali e comunicazione internazionale in un unico ecosistema su misura per il mondo del design.",
                "cta_primary":   {"text": "Richiedi una demo",      "href": "/start-studio"},
                "cta_secondary": {"text": "Scopri la piattaforma",  "href": "/platform"},
                "chips": [],
            },
            "en-us": {
                "headline_1": "The operating system",
                "headline_2": "for design studios",
                "headline_3": "and contemporary showrooms.",
                "subheading_accent": "One environment. Everything integrated.",
                "subheading_white":  "Every relationship, every project, every story.",
                "subheading":  "MOOD for DESIGN is the platform that unifies relationships and design, editorial content and international communication into one ecosystem built for the design world.",
                "cta_primary":   {"text": "Request a demo",         "href": "/start-studio"},
                "cta_secondary": {"text": "Explore the platform",   "href": "/platform"},
                "chips": [],
            },
        },
    },

    # ── 2) WORKFLOW ECOSYSTEM ──────────────────────────────────────────────
    {
        "id": "home-workflow", "type": "workflow_ecosystem", "sort": 1,
        "settings": {
            "steps": [
                {"id": "lead",        "icon": "lead"},
                {"id": "crm",         "icon": "crm"},
                {"id": "moodboard",   "icon": "moodboard"},
                {"id": "projects",    "icon": "projects"},
                {"id": "hotspot",     "icon": "hotspot"},
                {"id": "editorial",   "icon": "editorial"},
                {"id": "publishing",  "icon": "publishing"},
                {"id": "retention",   "icon": "retention"},
            ],
        },
        "content": {
            "it": {
                "overline": "Tutto il flow del design. Un unico ecosistema.",
                "body": "Ogni strumento è progettato per dialogare con gli altri, accompagnando il tuo cliente in ogni fase del progetto.",
                "cta": {"text": "Scopri come funziona", "href": "/platform"},
                "steps": [
                    {"id": "lead",       "title": "Lead\ne contatti"},
                    {"id": "crm",        "title": "CRM\nrelazionale"},
                    {"id": "moodboard",  "title": "Moodboard\ne selezioni"},
                    {"id": "projects",   "title": "Projects\nStudio"},
                    {"id": "hotspot",    "title": "Hotspot\nstorytelling"},
                    {"id": "editorial",  "title": "Editorial\nStudio"},
                    {"id": "publishing", "title": "Publishing\ninternazionale"},
                    {"id": "retention",  "title": "Client experience\ne retention"},
                ],
            },
            "en-us": {
                "overline": "The full design flow. One ecosystem.",
                "body": "Every tool is designed to dialogue with the others, guiding your client through every project stage.",
                "cta": {"text": "Discover how it works", "href": "/platform"},
                "steps": [
                    {"id": "lead",       "title": "Leads\n& contacts"},
                    {"id": "crm",        "title": "Relational\nCRM"},
                    {"id": "moodboard",  "title": "Moodboard\n& selections"},
                    {"id": "projects",   "title": "Projects\nStudio"},
                    {"id": "hotspot",    "title": "Hotspot\nstorytelling"},
                    {"id": "editorial",  "title": "Editorial\nStudio"},
                    {"id": "publishing", "title": "International\npublishing"},
                    {"id": "retention",  "title": "Client experience\n& retention"},
                ],
            },
        },
    },

    # ── 3) DEVICE SHOWCASE — Tutti gli strumenti / unico *ambiente* ────────
    {
        "id": "home-devices", "type": "device_showcase", "sort": 2,
        "settings": {"laptop_image": LAPTOP_IMG, "phone_image": PHONE_IMG, "tablet_image": TABLET_IMG},
        "content": {
            "it": {
                "overline": "La piattaforma",
                "headline": "Tutti gli strumenti\ndi cui hai bisogno.\nIn un *unico ambiente*.",
                "body": "MOOD for DESIGN integra in un unico ambiente tutti gli strumenti per gestire il tuo business, comunicare con i clienti e far crescere la tua visibilità nel mondo del design.",
                "cta": {"text": "Scopri tutte le funzionalità", "href": "/platform"},
            },
            "en-us": {
                "overline": "The platform",
                "headline": "Every tool you need.\nIn *one environment*.",
                "body": "MOOD for DESIGN brings together every tool to run your business, communicate with clients and grow your visibility in the design world — in one place.",
                "cta": {"text": "Explore all features", "href": "/platform"},
            },
        },
    },

    # ── 4) EXPERIENCE PILLARS — Un sistema nato dall'esperienza ────────────
    {
        "id": "home-pillars", "type": "experience_pillars", "sort": 3,
        "settings": {
            "pillars": [
                {"id": "pro",     "icon": "pro"},
                {"id": "design",  "icon": "design"},
                {"id": "custom",  "icon": "custom"},
                {"id": "global",  "icon": "global"},
            ],
        },
        "content": {
            "it": {
                "overline": "Progettato nel mondo reale del design.",
                "headline": "Un sistema nato dall'esperienza.",
                "cta": {"text": "Scopri la nostra visione", "href": "/about"},
                "pillars": [
                    {"id": "pro",    "title": "Creato da professionisti",
                     "body": "MOOD nasce dall'esperienza diretta di interior designer, showroom manager e consulenti del settore design."},
                    {"id": "design", "title": "Pensato per il design",
                     "body": "Ogni funzione è progettata per rispondere alle reali esigenze di studi e showroom contemporanei."},
                    {"id": "custom", "title": "Su misura, non generico",
                     "body": "Non un software tradizionale, ma un sistema operativo costruito esclusivamente per il mondo del design."},
                    {"id": "global", "title": "Internazionale",
                     "body": "Progettato tra Italia e USA per accompagnare i professionisti del design in ogni mercato."},
                ],
            },
            "en-us": {
                "overline": "Designed in the real world of design.",
                "headline": "A system born from experience.",
                "cta": {"text": "Discover our vision", "href": "/about"},
                "pillars": [
                    {"id": "pro",    "title": "Built by professionals",
                     "body": "MOOD is born from the hands-on experience of interior designers, showroom managers and design-industry consultants."},
                    {"id": "design", "title": "Built for design",
                     "body": "Every feature is engineered around the real needs of contemporary studios and showrooms."},
                    {"id": "custom", "title": "Tailored, never generic",
                     "body": "Not a traditional software — an operating system built exclusively for the design world."},
                    {"id": "global", "title": "International by nature",
                     "body": "Designed between Italy and the U.S. to support design professionals in every market."},
                ],
            },
        },
    },

    # ── 5) FRAGMENTED TOOLS — Oggi il tuo lavoro è frammentato ─────────────
    {
        "id": "home-fragmented", "type": "fragmented_tools", "sort": 4,
        "settings": {},
        "content": {
            "it": {
                "overline": "Una realtà che conosciamo bene.",
                "headline": "Oggi il tuo lavoro è frammentato.",
                "body": "MOOD unifica tutto in un unico ambiente progettato per il tuo modo di lavorare.",
                "cta": {"text": "Scopri il vantaggio di avere tutto connesso", "href": "/platform"},
                "tools": [
                    {"id": "whatsapp",  "label": "WhatsApp"},
                    {"id": "email",     "label": "Email"},
                    {"id": "pdf",       "label": "PDF"},
                    {"id": "drive",     "label": "Drive"},
                    {"id": "pinterest", "label": "Pinterest"},
                    {"id": "excel",     "label": "Excel"},
                    {"id": "scattered", "label": "File dispersi"},
                    {"id": "unlinked",  "label": "Strumenti scollegati"},
                ],
            },
            "en-us": {
                "overline": "A reality we know well.",
                "headline": "Today your work is fragmented.",
                "body": "MOOD unifies everything in a single environment built for the way you work.",
                "cta": {"text": "Discover the advantage of having it all connected", "href": "/platform"},
                "tools": [
                    {"id": "whatsapp",  "label": "WhatsApp"},
                    {"id": "email",     "label": "Email"},
                    {"id": "pdf",       "label": "PDF"},
                    {"id": "drive",     "label": "Drive"},
                    {"id": "pinterest", "label": "Pinterest"},
                    {"id": "excel",     "label": "Excel"},
                    {"id": "scattered", "label": "Scattered files"},
                    {"id": "unlinked",  "label": "Disconnected tools"},
                ],
            },
        },
    },

    # ── 6) CTA FINALE — architectural immersive ────────────────────────────
    {
        "id": "home-cta", "type": "cta_section", "sort": 5,
        "settings": {"background_image": CTA_BG, "dim": 0.68, "centered": True},
        "content": {
            "it": {
                "headline": "Pronto a trasformare il tuo modo\ndi progettare, comunicare e crescere?",
                "body": "Richiedi una demo personalizzata e scopri come MOOD può diventare il tuo alleato strategico.",
                "cta_primary":   {"text": "Richiedi una demo", "href": "/start-studio"},
            },
            "en-us": {
                "headline": "Ready to transform the way you\ndesign, communicate and grow?",
                "body": "Request a personalized demo and discover how MOOD can become your strategic ally.",
                "cta_primary":   {"text": "Request a demo", "href": "/start-studio"},
            },
        },
    },
]


# ── Navigation override (matches mockup: PIATTAFORMA / PER GLI STUDI / PER I RETAILER / TEMPLATE / JOURNAL / CHI SIAMO) ─
NAV_MAIN = [
    {"key": "platform",      "href": "/platform",      "labels": {"it": "Piattaforma",   "en-us": "Platform"}},
    {"key": "for-studios",   "href": "/for-studios",   "labels": {"it": "Per gli Studi", "en-us": "For Studios"}},
    {"key": "for-retailers", "href": "/for-retailers", "labels": {"it": "Per i Retailer","en-us": "For Retailers"}},
    {"key": "templates",     "href": "/templates",     "labels": {"it": "Template",      "en-us": "Templates"}},
    {"key": "journal",       "href": "/journal",       "labels": {"it": "Journal",       "en-us": "Journal"}},
    {"key": "about",         "href": "/about",         "labels": {"it": "Chi siamo",     "en-us": "About"}},
]
NAV_CTA = {
    "key": "demo", "href": "/start-studio",
    "labels": {"it": "Richiedi una demo", "en-us": "Request a Demo"},
}


def _build_nav_locale_content():
    out = {}
    for loc in LOCALES:
        out[loc] = {
            "main": [
                {"id": f"nav-{n['key']}", "key": n["key"], "href": n["href"],
                 "label": n["labels"].get(loc) or n["labels"]["en-us"]}
                for n in NAV_MAIN
            ],
            "cta": {
                "id": "nav-cta", "key": NAV_CTA["key"], "href": NAV_CTA["href"],
                "label": NAV_CTA["labels"].get(loc) or NAV_CTA["labels"]["en-us"],
            },
            "footer": {},
        }
    return out


async def main():
    url = os.environ['SESSION_POOLER_URL']
    conn = await asyncpg.connect(url, command_timeout=60)
    try:
        tenant = await conn.fetchrow("SELECT id FROM tenants WHERE slug = $1", CORP_SLUG)
        page = await conn.fetchrow("SELECT id FROM cms_pages WHERE tenant_id = $1 AND page_key = 'home'", tenant['id'])
        tenant_id, page_id = tenant['id'], page['id']
        print(f"tenant={tenant_id}  home_page={page_id}")

        # Hide ALL prior sections on this home page (workflow, devices, etc. will be re-upserted; legacy ones stay hidden)
        await conn.execute(
            "UPDATE cms_sections SET visible = false, updated_at = NOW() "
            "WHERE page_id = $1 AND deleted_at IS NULL AND section_type <> 'navigation'",
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
            print(f"  ✓ {sec['type']:22s}  sort={sec['sort']}  id={sid[:8]}…")

        # ── Navigation ─────────────────────────────────────────────────────
        nav_id = section_uuid('home', 'navigation-global')
        nav_locale_content = _build_nav_locale_content()
        await conn.execute(
            """
            INSERT INTO cms_sections
              (id, tenant_id, page_id, section_type, sort_order, visible,
               locale_content, settings, asset_refs, created_at, updated_at)
            VALUES
              ($1, $2, $3, 'navigation', -1, true,
               $4::jsonb, '{}'::jsonb, ARRAY[]::uuid[], NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
              locale_content = EXCLUDED.locale_content,
              visible = true,
              updated_at = NOW()
            """,
            nav_id, tenant_id, page_id, json.dumps(nav_locale_content),
        )
        print(f"  ✓ {'navigation':22s}  upserted ({len(NAV_MAIN)} items)")

        await conn.execute(
            "UPDATE cms_pages SET status='published', published_at = NOW(), updated_at = NOW() WHERE id = $1",
            page_id,
        )
        print("─── Done. Home reseeded V5 (premium editorial — no fake brands/testimonials) ───")
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
