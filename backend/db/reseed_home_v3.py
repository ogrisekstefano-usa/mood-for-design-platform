"""
Reseed mood-corporate home — V3 (matches official Artboard mockup + brand palette).
Idempotent. UUIDv5 deterministic. Run: python /app/backend/db/reseed_home_v3.py
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

# Editorial luxury interior — warm ambient lit room (matches mockup vibe)
HERO_IMG  = "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&q=85&auto=format&fit=crop"
DASH_IMG  = "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1800&q=85&auto=format&fit=crop"
CTA_BG    = "https://images.unsplash.com/photo-1618219944342-824e40a13285?w=1800&q=80&auto=format&fit=crop"

PROJECTS = [
    {"title": "Milano Penthouse",       "studio": "Studio Lumen",      "status": "In Progress", "style": "Residential",
     "image": "https://images.unsplash.com/photo-1600121848594-d8644e57abab?w=900&q=85&auto=format&fit=crop"},
    {"title": "Hotel Esplanade Trivat", "studio": "OPLA Studio",       "status": "Concept",     "style": "Hospitality",
     "image": "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=900&q=85&auto=format&fit=crop"},
    {"title": "London Townhouse",       "studio": "House of Vasari",   "status": "Completed",   "style": "Residential",
     "image": "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900&q=85&auto=format&fit=crop"},
    {"title": "Miami Beach Villa",      "studio": "Coastal & Co.",     "status": "In Progress", "style": "Residential",
     "image": "https://images.unsplash.com/photo-1615529182904-14819c35db37?w=900&q=85&auto=format&fit=crop"},
]


def page_uuid(key): return str(uuid.uuid5(NS, f'page:{CORP_SLUG}:{key}'))
def section_uuid(page, sid): return str(uuid.uuid5(NS, f'section:{CORP_SLUG}:{page}:{sid}'))


# ── Sections ─────────────────────────────────────────────────────────────────

SECTIONS = [
    # 1. HERO ────────────────────────────────────────────────────────────────
    {
        "id": "home-hero",
        "type": "editorial_hero",
        "sort": 0,
        "settings": {
            "layout": "split-right",
            "image_url": HERO_IMG,
            "image_alt": "Luxury interior",
            "floating_card": {
                "project": "Villa Riviera",
                "status": "In Progress",
                "client": "Bianchi Family",
                "budget": "€ 450K",
                "progress": 62,
                "phases": [
                    {"label": "Concept & Moodboard",  "value": 100, "icon": "check"},
                    {"label": "Design Development",   "value": 75,  "icon": "eye"},
                    {"label": "Materials & Selection","value": 60,  "icon": "palette"},
                    {"label": "Procurement",          "value": 30,  "icon": "cart"},
                    {"label": "Installation",         "value": 0,   "icon": "tools"},
                ],
            },
        },
        "content": {
            "en-us": {
                "eyebrow": "MOOD for DESIGN",
                "headline_1": "From Lead",
                "headline_2": "to Project.",
                "headline_3": "To Delivery.",
                "subheading": "The editorial operating system for architecture & interior design studios. From the first moodboard to the final handover — under your studio's brand.",
                "cta_primary":   {"text": "Book a Demo",      "href": "/start-studio"},
                "cta_secondary": {"text": "See how it works", "href": "#flow"},
                "chips": [
                    {"key": "lead",       "label": "Lead Intake"},
                    {"key": "moodboards", "label": "Moodboards"},
                    {"key": "projects",   "label": "Projects"},
                    {"key": "client",     "label": "Client Portal"},
                    {"key": "progress",   "label": "Progress Tracking"},
                ],
            },
            "it": {
                "eyebrow": "MOOD for DESIGN",
                "headline_1": "Dal Contatto",
                "headline_2": "al Progetto.",
                "headline_3": "Alla Consegna.",
                "subheading": "Il sistema operativo editoriale per studi di architettura e interior design. Dal primo moodboard alla consegna finale — sotto il brand del tuo studio.",
                "cta_primary":   {"text": "Prenota una Demo",      "href": "/start-studio"},
                "cta_secondary": {"text": "Scopri come funziona", "href": "#flow"},
                "chips": [
                    {"key": "lead",       "label": "Acquisizione Lead"},
                    {"key": "moodboards", "label": "Moodboard"},
                    {"key": "projects",   "label": "Progetti"},
                    {"key": "client",     "label": "Portale Cliente"},
                    {"key": "progress",   "label": "Avanzamento"},
                ],
            },
        },
    },

    # 2. METRICS ─────────────────────────────────────────────────────────────
    {
        "id": "home-metrics",
        "type": "metrics_strip",
        "sort": 1,
        "settings": {},
        "content": {
            "en-us": {
                "metrics": [
                    {"eyebrow": "Win more projects", "value": "+38%", "label": "Conversion rate",     "tone": "positive"},
                    {"eyebrow": "Save time",         "value": "-45%", "label": "Admin overhead",      "tone": "negative"},
                    {"eyebrow": "Deliver on time",   "value": "+92%", "label": "On-time delivery",    "tone": "highlight"},
                    {"eyebrow": "Happy clients",     "value": "4.9/5","label": "Avg. client rating",  "tone": "rating"},
                ],
            },
            "it": {
                "metrics": [
                    {"eyebrow": "Più progetti",       "value": "+38%", "label": "Tasso di conversione", "tone": "positive"},
                    {"eyebrow": "Meno tempo perso",   "value": "-45%", "label": "Carico amministrativo","tone": "negative"},
                    {"eyebrow": "Consegne puntuali",  "value": "+92%", "label": "Consegne in tempo",    "tone": "highlight"},
                    {"eyebrow": "Clienti felici",     "value": "4.9/5","label": "Valutazione media",    "tone": "rating"},
                ],
            },
        },
    },

    # 3. SPLIT — Dashboard mockup ───────────────────────────────────────────
    {
        "id": "home-flow",
        "type": "split_story",
        "sort": 2,
        "settings": {
            "image_position": "right",
            "image_url": DASH_IMG,
            "image_alt": "MOOD dashboard preview",
            "dark": True,
        },
        "content": {
            "en-us": {
                "overline": "Everything in one flow",
                "headline": "Where studios run the\nentire client journey.",
                "body": "Replace seven tools with one editorial workspace. Mood boards, contracts, deliveries, payments and client portals — all under your studio's brand.",
                "bullets": [
                    "Visual project timelines with milestones",
                    "Materials & supplier ledger built-in",
                    "Client portal with shareable mood boards",
                    "Quotes, contracts and payments in one place",
                ],
                "cta": {"text": "Explore the Platform", "href": "/platform"},
            },
            "it": {
                "overline": "Tutto in un unico flusso",
                "headline": "Dove gli studi gestiscono\nl'intero ciclo cliente.",
                "body": "Sostituisci sette strumenti con uno spazio editoriale unico. Moodboard, contratti, consegne, pagamenti e portale cliente — tutto sotto il brand del tuo studio.",
                "bullets": [
                    "Timeline visuali con milestone",
                    "Registro materiali e fornitori integrato",
                    "Portale cliente con moodboard condivisibili",
                    "Preventivi, contratti e pagamenti in un solo posto",
                ],
                "cta": {"text": "Esplora la Piattaforma", "href": "/platform"},
            },
        },
    },

    # 4. PROCESS STEPS — 6 step (from artboard) ─────────────────────────────
    {
        "id": "home-journey",
        "type": "process_steps",
        "sort": 3,
        "settings": {"dark": True},
        "content": {
            "en-us": {
                "overline": "The Client Journey",
                "headline": "Six moves. One refined process.",
                "body": "From the first inquiry to the moment your client steps into the finished space — every phase orchestrated, every decision documented.",
                "steps": [
                    {"title": "Lead Generation", "description": "Capture inquiries from your site, social and referrals — auto-qualified."},
                    {"title": "Onboarding",      "description": "Brief, budget and timeline in a single editorial intake."},
                    {"title": "Moodboard",       "description": "Collaborative boards your client approves with one click."},
                    {"title": "Project",         "description": "Plans, renders and material palettes shipped from one place."},
                    {"title": "Approvals",       "description": "Quotes, contracts and milestones signed digitally."},
                    {"title": "Delivery",        "description": "Suppliers, logistics and on-site handover — all tracked."},
                ],
            },
            "it": {
                "overline": "Il Percorso del Cliente",
                "headline": "Sei passaggi. Un processo raffinato.",
                "body": "Dal primo contatto fino al momento in cui il tuo cliente entra nello spazio finito — ogni fase orchestrata, ogni decisione documentata.",
                "steps": [
                    {"title": "Acquisizione",   "description": "Acquisisci richieste da sito, social e referral — pre-qualificate."},
                    {"title": "Onboarding",     "description": "Brief, budget e timeline in un unico intake editoriale."},
                    {"title": "Moodboard",      "description": "Board collaborative che il cliente approva in un click."},
                    {"title": "Progetto",       "description": "Piante, render e palette materiali da un unico spazio."},
                    {"title": "Approvazioni",   "description": "Preventivi, contratti e milestone firmati digitalmente."},
                    {"title": "Consegna",       "description": "Fornitori, logistica e handover di cantiere tracciati."},
                ],
            },
        },
    },

    # 5. PROJECT SHOWCASE ───────────────────────────────────────────────────
    {
        "id": "home-projects",
        "type": "project_showcase",
        "sort": 4,
        "settings": {"columns": 4, "background": "#F5F2EC"},
        "content": {
            "en-us": {
                "overline": "Real Projects",
                "headline": "Studios who deliver beautifully.",
                "body": "From private villas to luxury showrooms — a glimpse of the work shipped on MOOD.",
                "projects": PROJECTS,
            },
            "it": {
                "overline": "Progetti Reali",
                "headline": "Studi che consegnano bellezza.",
                "body": "Dalle ville private agli showroom di lusso — uno sguardo al lavoro spedito su MOOD.",
                "projects": PROJECTS,
            },
        },
    },

    # 6. PRESS LOGOS ────────────────────────────────────────────────────────
    {
        "id": "home-press",
        "type": "press_logos",
        "sort": 5,
        "settings": {"dark": False},
        "content": {
            "en-us": {
                "overline": "Used and loved by studios featured in",
                "logos": [
                    {"name": "ELLE Decoration",        "font": "serif", "italic": False, "weight": 500},
                    {"name": "ARCHITECTURAL DIGEST",   "font": "serif", "weight": 500, "uppercase": True, "spacing": "0.18em"},
                    {"name": "dezeen",                 "font": "sans", "weight": 700},
                    {"name": "design/milk",            "font": "sans", "weight": 600},
                    {"name": "INTERIOR DESIGN",        "font": "sans", "weight": 700, "uppercase": True, "spacing": "0.16em"},
                    {"name": "Frame",                  "font": "serif", "italic": True, "weight": 500},
                    {"name": "Wallpaper",              "font": "serif", "weight": 600, "starred": True},
                ],
            },
            "it": {
                "overline": "Utilizzato e amato da studi citati in",
                "logos": [
                    {"name": "ELLE Decoration",        "font": "serif", "weight": 500},
                    {"name": "ARCHITECTURAL DIGEST",   "font": "serif", "weight": 500, "uppercase": True, "spacing": "0.18em"},
                    {"name": "dezeen",                 "font": "sans", "weight": 700},
                    {"name": "design/milk",            "font": "sans", "weight": 600},
                    {"name": "INTERIOR DESIGN",        "font": "sans", "weight": 700, "uppercase": True, "spacing": "0.16em"},
                    {"name": "Frame",                  "font": "serif", "italic": True, "weight": 500},
                    {"name": "Wallpaper",              "font": "serif", "weight": 600, "starred": True},
                ],
            },
        },
    },

    # 7. CTA ────────────────────────────────────────────────────────────────
    {
        "id": "home-cta",
        "type": "cta_section",
        "sort": 6,
        "settings": {"background_image": CTA_BG, "dim": 0.65, "centered": True},
        "content": {
            "en-us": {
                "overline": "Begin your editorial workspace",
                "headline": "More projects. Happier clients.\nSmoother workflow.",
                "body": "Join the studios already shaping the future of interior design — one editorial workspace at a time. No credit card required.",
                "cta_primary":   {"text": "Book a Demo",      "href": "/start-studio"},
                "cta_secondary": {"text": "Talk to Sales",    "href": "/contact"},
            },
            "it": {
                "overline": "Inizia il tuo spazio editoriale",
                "headline": "Più progetti. Clienti più felici.\nWorkflow più fluido.",
                "body": "Unisciti agli studi che stanno già definendo il futuro dell'interior design. Nessuna carta di credito richiesta.",
                "cta_primary":   {"text": "Prenota una Demo", "href": "/start-studio"},
                "cta_secondary": {"text": "Parla con Sales",  "href": "/contact"},
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

        # Hide all existing sections (we'll upsert the right ones)
        await conn.execute(
            "UPDATE cms_sections SET visible = false, updated_at = NOW() WHERE page_id = $1 AND deleted_at IS NULL",
            page_id,
        )

        for sec in SECTIONS:
            sid = section_uuid('home', sec['id'])
            base_en = sec['content'].get('en-us', {})
            locale_content = {}
            for loc in LOCALES:
                v = sec['content'].get(loc)
                locale_content[loc] = v if v else base_en

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
        print("─── Done. Home reseeded V3 ───")
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
