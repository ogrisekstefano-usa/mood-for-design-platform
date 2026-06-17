#!/usr/bin/env python3
"""
seed_magazine_credibility.py
═════════════════════════════
Aggiunge 6 nuovi articoli magazine al tenant 'studio' (da 6 a 12 totali).

CLASSIFICAZIONE:
  - editorial_tone = 'cms-showcase-demo' su tutti
  - tags include 'demo-content'
  - Contenuto editoriale illustrativo — dimostra le capacità del CMS

Articoli aggiunti:
  7. marmo-luce-architettura-italiana    [materiali]
  8. arredare-il-silenzio                [interior]
  9. hospitality-design-2025             [architettura]
  10. neutro-come-scelta-radicale        [tendenze]
  11. designing-for-privacy              [interior/lifestyle]  — EN+IT
  12. la-cucina-come-manifesto-living    [lifestyle]

Idempotente: upsert per slug.
"""
import sys, uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from database import db

NOW = lambda: datetime.now(timezone.utc).isoformat()
TENANT_SLUG = 'studio'
DEMO_TONE = 'cms-showcase-demo'
DEMO_TAG = 'demo-content'


ARTICLES = [
    # ── 7. Marmo e luce ────────────────────────────────────────────────────
    {
        'slug':              'marmo-luce-architettura-italiana',
        'status':            'published',
        'cover_url':         'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1600&q=85',
        'hero_url':          'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=2400&q=85',
        'scope':             'tenant',
        'category_slug':     'materiali',
        'editorial_tone':    DEMO_TONE,
        'default_locale':    'it',
        'reading_minutes':   4,
        'tags':              ['marmo', 'luce', 'architettura', 'materiali', DEMO_TAG],
        'featured_materials':['calacatta', 'statuario', 'marquina'],
        'atmosphere_keywords':['luce naturale', 'mineralità', 'senza tempo'],
        'locale_content': {
            'it': {
                'kicker':   'Materiali · Editoriale',
                'title':    'Marmo e luce: il dialogo eterno',
                'summary':  'Come la pietra calcarea reagisce alla luce nelle diverse ore del giorno — e perché questo cambia tutto in un progetto residenziale.',
                'meta_title': 'Marmo e luce — Editoriale materiali · Studio',
                'meta_description': 'Editoriale dimostrativo: il dialogo tra marmo e luce naturale nel progetto di interni.',
                'category_label': 'Materiali',
            },
            'en': {
                'kicker':   'Materials · Editorial',
                'title':    'Marble and light: the eternal dialogue',
                'summary':  'How limestone reacts to light at different hours of the day — and why this changes everything in a residential project.',
                'meta_title': 'Marble and light — Materials editorial · Studio',
                'meta_description': 'Demo editorial: the dialogue between marble and natural light in interior design.',
                'category_label': 'Materials',
            },
        },
        'body_blocks': [
            {
                'type': 'paragraph',
                'locale_content': {
                    'it': {'text': 'Il marmo non è un materiale statico. È una superficie che cambia colore, profondità e presenza con il variare della luce. La mattina il Calacatta si illumina di un bianco freddo. Al tramonto, i venati sembrano prendere fuoco. Progettare con il marmo significa progettare con il tempo.'},
                    'en': {'text': 'Marble is not a static material. It is a surface that changes colour, depth and presence with the changing light. In the morning, Calacatta brightens to a cold white. At sunset, the veins seem to catch fire. Designing with marble means designing with time.'},
                },
            },
            {
                'type': 'image',
                'image_url': 'https://images.unsplash.com/photo-1600210491892-03d54bc0fbab?auto=format&fit=crop&w=2000&q=85',
                'locale_content': {
                    'it': {'caption': 'Bagno padronale in marmo Statuario — luce zenitale pomeridiana'},
                    'en': {'caption': 'Master bathroom in Statuario marble — afternoon zenithal light'},
                },
            },
            {
                'type': 'paragraph',
                'locale_content': {
                    'it': {'text': 'La scelta tra finitura lucida e levigata non è estetica — è una scelta di luce. Il lucido moltiplica e riflette; il levigato assorbe e ammorbidisce. In un ambiente a nord, il lucido compensa. In un bagno con finestra a est, il levigato protegge dagli abbagliamenti.'},
                    'en': {'text': "The choice between polished and honed finish is not aesthetic — it is a choice of light. Polished multiplies and reflects; honed absorbs and softens. In a north-facing room, polished compensates. In a bathroom with an east window, honed protects from glare."},
                },
            },
        ],
    },

    # ── 8. Arredare il silenzio ────────────────────────────────────────────
    {
        'slug':              'arredare-il-silenzio',
        'status':            'published',
        'cover_url':         'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1600&q=85',
        'hero_url':          'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=2400&q=85',
        'scope':             'tenant',
        'category_slug':     'interior',
        'editorial_tone':    DEMO_TONE,
        'default_locale':    'it',
        'reading_minutes':   3,
        'tags':              ['silenzio', 'minimalismo', 'acustica', 'interior', DEMO_TAG],
        'featured_materials':['lana', 'legno', 'feltro'],
        'atmosphere_keywords':['silenzio', 'comfort acustico', 'presenza'],
        'locale_content': {
            'it': {
                'kicker':   'Interior · Editoriale',
                'title':    'Arredare il silenzio',
                'summary':  "Il rumore è il lusso che non si vede. Come si progetta l'acustica di una residenza senza trasformarla in uno studio di registrazione.",
                'meta_title': "Arredare il silenzio — Interior design · Studio",
                'meta_description': "Editoriale dimostrativo: progettare il comfort acustico negli interni residenziali.",
                'category_label': 'Interior',
            },
            'en': {
                'kicker':   'Interior · Editorial',
                'title':    'Furnishing silence',
                'summary':  'Noise is the luxury you cannot see. How to design the acoustics of a residence without turning it into a recording studio.',
                'meta_title': 'Furnishing silence — Interior design · Studio',
                'meta_description': 'Demo editorial: designing acoustic comfort in residential interiors.',
                'category_label': 'Interior',
            },
        },
        'body_blocks': [
            {
                'type': 'paragraph',
                'locale_content': {
                    'it': {'text': 'In un appartamento di pregio, il rumore è spesso il problema non dichiarato. I clienti chiedono spazi belli, ma quello che cercano davvero è una casa in cui si sentano al sicuro. Il silenzio è parte integrante del comfort — è il lusso che non si vede, ma si sente immediatamente.'},
                    'en': {'text': "In a high-end apartment, noise is often the undeclared problem. Clients ask for beautiful spaces, but what they truly seek is a home where they feel safe. Silence is an integral part of comfort — it is the luxury you cannot see, but feel immediately."},
                },
            },
            {
                'type': 'quote',
                'locale_content': {
                    'it': {'text': 'Il progetto acustico inizia prima della posa del pavimento.', 'author': 'Studio — Note di progetto'},
                    'en': {'text': 'Acoustic design begins before the floor is laid.', 'author': 'Studio — Project notes'},
                },
            },
        ],
    },

    # ── 9. Hospitality Design 2025 ────────────────────────────────────────
    {
        'slug':              'hospitality-design-2025',
        'status':            'published',
        'cover_url':         'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1600&q=85',
        'hero_url':          'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=2400&q=85',
        'scope':             'tenant',
        'category_slug':     'architettura',
        'editorial_tone':    DEMO_TONE,
        'default_locale':    'it',
        'reading_minutes':   5,
        'tags':              ['hospitality', 'hotel', 'architettura', 'tendenze-2025', DEMO_TAG],
        'featured_materials':['pietra naturale', 'tessuti tecnici', 'legno massello'],
        'atmosphere_keywords':['esperienza', 'benessere', 'immersivo'],
        'locale_content': {
            'it': {
                'kicker':   'Architettura · Editoriale',
                'title':    'Hospitality Design 2025: il ritorno all\'essenziale',
                'summary':  "Le nuove strutture ricettive abbandonano il décor decorativo per tornare a materiali veri, ritmi lenti e un'ospitalità più autentica.",
                'meta_title': 'Hospitality Design 2025 — Editoriale architettura · Studio',
                'meta_description': 'Editoriale dimostrativo: le tendenze del design hospitality nel 2025.',
                'category_label': 'Architettura',
            },
            'en': {
                'kicker':   'Architecture · Editorial',
                'title':    'Hospitality Design 2025: the return to the essential',
                'summary':  'New hospitality structures are abandoning decorative décor to return to real materials, slow rhythms and more authentic hospitality.',
                'meta_title': 'Hospitality Design 2025 — Architecture editorial · Studio',
                'meta_description': 'Demo editorial: hospitality design trends in 2025.',
                'category_label': 'Architecture',
            },
        },
        'body_blocks': [
            {
                'type': 'paragraph',
                'locale_content': {
                    'it': {'text': "Per anni il design degli hotel di lusso ha inseguito il wow. Arredi scenografici, pattern elaborati, colori sovrascritti. Ma il mercato si è stancato. Il nuovo ospite di alta gamma non cerca l'impressione — cerca la presenza. Cerca un luogo in cui sentire il materiale sotto le mani, la luce che cambia nel corso del giorno, il silenzio come servizio."},
                    'en': {'text': 'For years, luxury hotel design has chased the wow factor. Scenographic furnishings, elaborate patterns, overwrought colours. But the market has tired of it. The new high-end guest does not seek impression — they seek presence. A place where they can feel the material under their hands, the light changing throughout the day, silence as a service.'},
                },
            },
            {
                'type': 'image',
                'image_url': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2000&q=85',
                'locale_content': {
                    'it': {'caption': 'Camera tipo in pietra naturale e lino — architettura hospitality contemporanea'},
                    'en': {'caption': 'Guest room in natural stone and linen — contemporary hospitality architecture'},
                },
            },
        ],
    },

    # ── 10. Il neutro come scelta radicale ────────────────────────────────
    {
        'slug':              'neutro-come-scelta-radicale',
        'status':            'published',
        'cover_url':         'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1600&q=85',
        'hero_url':          'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=2400&q=85',
        'scope':             'tenant',
        'category_slug':     'tendenze',
        'editorial_tone':    DEMO_TONE,
        'default_locale':    'it',
        'reading_minutes':   3,
        'tags':              ['colore', 'neutri', 'palette', 'tendenze', DEMO_TAG],
        'featured_materials':['intonaco minerale', 'lino grezzo', 'noce naturale'],
        'atmosphere_keywords':['neutro', 'sottrazione', 'profondità'],
        'locale_content': {
            'it': {
                'kicker':   'Tendenze · Editoriale',
                'title':    'Il colore neutro come scelta radicale',
                'summary':  'Scegliere il neutro non è una resa. È una presa di posizione sul rumore visivo contemporaneo — e richiede più coraggio del colore.',
                'meta_title': 'Il colore neutro — Tendenze cromatiche · Studio',
                'meta_description': 'Editoriale dimostrativo: il ritorno ai neutri come estetica radicale nel progetto di interni.',
                'category_label': 'Tendenze',
            },
            'en': {
                'kicker':   'Trends · Editorial',
                'title':    'Neutral colour as a radical choice',
                'summary':  'Choosing neutrals is not surrender. It is a statement on contemporary visual noise — and requires more courage than colour.',
                'meta_title': 'The neutral colour — Chromatic trends · Studio',
                'meta_description': 'Demo editorial: the return of neutrals as radical aesthetic in interior design.',
                'category_label': 'Trends',
            },
        },
        'body_blocks': [
            {
                'type': 'paragraph',
                'locale_content': {
                    'it': {'text': "Il neutro è spesso confuso con l'assenza di scelta. Ma scegliere un greige perfetto — quel punto esatto tra grigio caldo e beige dorato — richiede un'attenzione al contesto che nessun pantone preconfezionato può risolvere. Il neutro sbagliato è il peggiore degli errori cromatici perché non è mai sbagliato abbastanza da essere ovvio."},
                    'en': {"text": "Neutral is often confused with absence of choice. But choosing a perfect greige — that exact point between warm grey and golden beige — requires an attention to context that no pre-packaged Pantone can resolve. The wrong neutral is the worst chromatic error because it is never wrong enough to be obvious."},
                },
            },
        ],
    },

    # ── 11. Designing for privacy (EN first, also IT) ─────────────────────
    {
        'slug':              'designing-for-privacy',
        'status':            'published',
        'cover_url':         'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&q=85',
        'hero_url':          'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=2400&q=85',
        'scope':             'tenant',
        'category_slug':     'interior',
        'editorial_tone':    DEMO_TONE,
        'default_locale':    'en',
        'reading_minutes':   4,
        'tags':              ['privacy', 'intimità', 'interior', 'progetto', DEMO_TAG],
        'featured_materials':['pannelli fonoassorbenti', 'vetro acidato', 'tende tecniche'],
        'atmosphere_keywords':['privacy', 'riservatezza', 'intimità'],
        'locale_content': {
            'en': {
                'kicker':   'Interior · Editorial',
                'title':    'Designing for privacy',
                'summary':  'Privacy is the new luxury. How spatial planning, material choices and lighting design come together to create truly private residences.',
                'meta_title': 'Designing for privacy — Interior editorial · Studio',
                'meta_description': 'Demo editorial: how to design privacy into high-end residential projects.',
                'category_label': 'Interior',
            },
            'it': {
                'kicker':   'Interior · Editoriale',
                'title':    'Progettare la privacy',
                'summary':  'La privacy è il nuovo lusso. Come la distribuzione degli spazi, i materiali e la luce artificiale si combinano per creare residenze davvero riservate.',
                'meta_title': 'Progettare la privacy — Editoriale interior · Studio',
                'meta_description': 'Editoriale dimostrativo: come progettare la privacy in residenze di alta gamma.',
                'category_label': 'Interior',
            },
        },
        'body_blocks': [
            {
                'type': 'paragraph',
                'locale_content': {
                    'en': {'text': "Privacy in residential design is rarely addressed directly. Architects talk about light, flow, materiality — but rarely about the feeling of being unseen. Yet for clients who spend their professional lives in the public eye, privacy is not a feature. It is the foundation everything else is built upon."},
                    'it': {'text': "La privacy nel progetto residenziale viene raramente affrontata direttamente. Gli architetti parlano di luce, flussi, materialità — ma raramente della sensazione di non essere osservati. Eppure per i clienti che trascorrono la loro vita professionale sotto i riflettori, la privacy non è una caratteristica. È la fondamenta su cui costruire tutto il resto."},
                },
            },
        ],
    },

    # ── 12. La cucina come manifesto ──────────────────────────────────────
    {
        'slug':              'cucina-manifesto-del-living-contemporaneo',
        'status':            'published',
        'cover_url':         'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=85',
        'hero_url':          'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2400&q=85',
        'scope':             'tenant',
        'category_slug':     'lifestyle',
        'editorial_tone':    DEMO_TONE,
        'default_locale':    'it',
        'reading_minutes':   3,
        'tags':              ['cucina', 'living', 'lifestyle', 'contemporaneo', DEMO_TAG],
        'featured_materials':['marmo', 'noce', 'ottone'],
        'atmosphere_keywords':['convivialità', 'domesticità', 'rituale'],
        'locale_content': {
            'it': {
                'kicker':   'Lifestyle · Editoriale',
                'title':    'La cucina come manifesto del living contemporaneo',
                'summary':  "La cucina non è più un locale di servizio. È la stanza dove si dichiara come si vuole vivere — e come si vuole essere ricevuti.",
                'meta_title': 'La cucina come manifesto — Lifestyle · Studio',
                'meta_description': "Editoriale dimostrativo: la cucina come spazio identitario nel living contemporaneo.",
                'category_label': 'Lifestyle',
            },
            'en': {
                'kicker':   'Lifestyle · Editorial',
                'title':    'The kitchen as manifesto of contemporary living',
                'summary':  'The kitchen is no longer a service room. It is the room where you declare how you want to live — and how you want to receive.',
                'meta_title': 'The kitchen as manifesto — Lifestyle · Studio',
                'meta_description': 'Demo editorial: the kitchen as identity space in contemporary living.',
                'category_label': 'Lifestyle',
            },
        },
        'body_blocks': [
            {
                'type': 'paragraph',
                'locale_content': {
                    'it': {'text': "Per decenni la cucina è stata nascosta. Separata, chiusa, funzionale. Poi, con l'apertura verso il soggiorno, ha iniziato a pretendere di essere bella. Oggi non basta più: la cucina vuole essere un punto di vista sul mondo. Vuole essere il centro gravitazionale della casa — il luogo in cui le famiglie si ritrovano, in cui gli ospiti si sentono accolti prima ancora di sedersi."},
                    'en': {'text': "For decades the kitchen was hidden. Separated, closed, functional. Then, with the opening towards the living room, it began to demand beauty. Today that is no longer enough: the kitchen wants to be a point of view on the world. It wants to be the gravitational centre of the home — the place where families reconnect, where guests feel welcomed before they even sit down."},
                },
            },
        ],
    },
]


def _resolve_tenant_id(client, slug):
    r = (client.table('tenants').select('id').eq('slug', slug).limit(1).execute()).data or []
    return r[0]['id'] if r else None


def _upsert_article(client, tenant_id, art):
    existing = (client.table('magazine_articles').select('id')
                .eq('tenant_id', tenant_id).eq('slug', art['slug'])
                .limit(1).execute()).data or []
    record = {k: v for k, v in art.items()}
    record['tenant_id'] = tenant_id
    record['updated_at'] = NOW()

    if existing:
        aid = existing[0]['id']
        client.table('magazine_articles').update(record).eq('id', aid).execute()
    else:
        aid = str(uuid.uuid4())
        record['id'] = aid
        record['created_at'] = NOW()
        record['published_at'] = NOW()
        client.table('magazine_articles').insert(record).execute()
    return aid


def main():
    client = db()
    tid = _resolve_tenant_id(client, TENANT_SLUG)
    if not tid:
        print(f"ERROR: tenant '{TENANT_SLUG}' not found"); return 2
    print(f"→ Tenant {TENANT_SLUG} = {tid}")
    print(f"→ Demo marker: editorial_tone='{DEMO_TONE}', tags include '{DEMO_TAG}'\n")
    for art in ARTICLES:
        aid = _upsert_article(client, tid, art)
        print(f"  ✓ [{art['category_slug']}] {art['slug']:<50} = {aid}")
    print(f"\n✅ Seeded {len(ARTICLES)} demo magazine articles — totale: 12 articoli")
    return 0


if __name__ == '__main__':
    sys.exit(main())
