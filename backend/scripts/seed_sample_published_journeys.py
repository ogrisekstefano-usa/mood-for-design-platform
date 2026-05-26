#!/usr/bin/env python3
"""
ITER157.B · Sample Published Design Journeys™ seed.

Seeds three curated editorial snapshots representing completed
operational Journeys. These are NOT fake demo cards — they are the
inaugural editorial narrative artifacts of the tenant studio, marked
as `homepage_featured=true` so the homepage `featured_design_journeys`
section comes alive immediately.

Idempotent: re-running upserts by slug.

Usage:
    python3 seed_sample_published_journeys.py [tenant_slug]
"""
from __future__ import annotations
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from database import db  # noqa: E402

NOW = lambda: datetime.now(timezone.utc).isoformat()  # noqa: E731

DEFAULT_TENANT_SLUG = 'studio'

CURATED = [
    {
        'slug':             'lugano-lake-house',
        'title':            'Lugano Lake House',
        'canonical_locale': 'it-IT',
        'editorial_excerpt':'Un rifugio sereno in armonia con la natura, dove il lago detta i ritmi e il legno restituisce calore.',
        'atmosphere':       'Quiete sul lago · materia naturale',
        'project_type':     'residential',
        'location':         'Lugano, CH',
        'year':             2024,
        'hero_url':         'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=2000&q=85',
        'material_tags':    ['Noce', 'Pietra naturale', 'Lino'],
        'featured_order':   0,
        'homepage_featured':True,
        'visibility_status':'published',
        'seo_title':        'Lugano Lake House — Design Journey · MOOD for DESIGN',
        'seo_description':  "Un rifugio sereno sul Lago di Lugano disegnato attorno al rituale della luce e dei materiali.",
        'translations': {
            'en-US': {
                'title':            'Lugano Lake House',
                'editorial_excerpt':'A serene retreat in harmony with nature, where the lake dictates the rhythms and wood returns warmth.',
                'atmosphere':       'Lakeside stillness · natural matter',
                'location':         'Lugano, Switzerland',
                'seo_title':        'Lugano Lake House — Design Journey · MOOD for DESIGN',
                'seo_description':  'A serene retreat on Lake Lugano designed around the ritual of light and materials.',
            },
        },
    },
    {
        'slug':             'brera-apartment',
        'title':            'Brera Apartment',
        'canonical_locale': 'it-IT',
        'editorial_excerpt':'Linee eleganti e artigianato italiano nel cuore di Milano. Un dialogo sottile tra storia e contemporaneità.',
        'atmosphere':       'Eleganza milanese · artigianato',
        'project_type':     'residential',
        'location':         'Milano, IT',
        'year':             2024,
        'hero_url':         'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=2000&q=85',
        'material_tags':    ['Rovere', 'Ottone', 'Marmo Calacatta'],
        'featured_order':   1,
        'homepage_featured':True,
        'visibility_status':'published',
        'seo_title':        'Brera Apartment — Design Journey · MOOD for DESIGN',
        'seo_description':  'Un appartamento nel cuore di Brera dove eleganza milanese e artigianato italiano si raccontano in silenzio.',
        'translations': {
            'en-US': {
                'title':            'Brera Apartment',
                'editorial_excerpt':'Elegant lines and Italian craftsmanship in the heart of Milan. A subtle dialogue between history and the contemporary.',
                'atmosphere':       'Milanese elegance · craft',
                'location':         'Milan, Italy',
                'seo_title':        'Brera Apartment — Design Journey · MOOD for DESIGN',
                'seo_description':  'An apartment in the heart of Brera where Milanese elegance and Italian craftsmanship speak softly.',
            },
        },
    },
    {
        'slug':             'tuscany-hills',
        'title':            'Tuscany Hills',
        'canonical_locale': 'it-IT',
        'editorial_excerpt':"Dove la tradizione incontra il design contemporaneo. Una villa che ascolta il paesaggio prima di parlarne.",
        'atmosphere':       'Paesaggio toscano · gesto contemporaneo',
        'project_type':     'villa',
        'location':         'Chianti, IT',
        'year':             2025,
        'hero_url':         'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2000&q=85',
        'material_tags':    ['Travertino', 'Cotto fatto a mano', 'Acciaio brunito'],
        'featured_order':   2,
        'homepage_featured':True,
        'visibility_status':'published',
        'seo_title':        'Tuscany Hills — Design Journey · MOOD for DESIGN',
        'seo_description':  'Una villa sulle colline del Chianti dove la tradizione incontra il design contemporaneo.',
        'translations': {
            'en-US': {
                'title':            'Tuscany Hills',
                'editorial_excerpt':'Where tradition meets contemporary design. A villa that listens to the landscape before speaking of it.',
                'atmosphere':       'Tuscan landscape · contemporary gesture',
                'location':         'Chianti, Italy',
                'seo_title':        'Tuscany Hills — Design Journey · MOOD for DESIGN',
                'seo_description':  'A villa in the Chianti hills where tradition meets contemporary design.',
            },
        },
    },
]


def _resolve_tenant_id(client, slug: str):
    r = (client.table('tenants').select('id').eq('slug', slug).limit(1).execute()).data or []
    return r[0]['id'] if r else None


def _upsert_journey(client, tenant_id: str, payload: dict):
    existing = (client.table('published_design_journeys').select('id')
                .eq('tenant_id', tenant_id).eq('slug', payload['slug'])
                .limit(1).execute()).data or []
    base = {k: v for k, v in payload.items() if k != 'translations'}
    base.update({
        'tenant_id':    tenant_id,
        'published_at': NOW() if base.get('visibility_status') == 'published' else None,
        'updated_at':   NOW(),
    })
    if existing:
        jid = existing[0]['id']
        client.table('published_design_journeys').update(base) \
              .eq('id', jid).execute()
    else:
        base['id']         = str(uuid.uuid4())
        base['created_at'] = NOW()
        client.table('published_design_journeys').insert(base).execute()
        jid = base['id']

    # Upsert translations
    for locale, tx in (payload.get('translations') or {}).items():
        ex_tx = (client.table('published_design_journey_translations').select('id')
                 .eq('published_journey_id', jid).eq('locale', locale)
                 .limit(1).execute()).data or []
        row = {**tx,
               'tenant_id':            tenant_id,
               'published_journey_id': jid,
               'locale':               locale,
               'status':               'manual',
               'updated_at':           NOW()}
        if ex_tx:
            client.table('published_design_journey_translations').update(row) \
                  .eq('id', ex_tx[0]['id']).execute()
        else:
            row['id']         = str(uuid.uuid4())
            row['created_at'] = NOW()
            client.table('published_design_journey_translations').insert(row).execute()
    return jid


def main() -> int:
    slug = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_TENANT_SLUG
    client = db()
    tid = _resolve_tenant_id(client, slug)
    if not tid:
        print(f"ERROR · tenant '{slug}' not found"); return 2
    print(f"→ Tenant {slug} = {tid}")
    for p in CURATED:
        jid = _upsert_journey(client, tid, p)
        print(f"  ✓ {p['slug']:<24} = {jid}")
    print(f"\n✅ Seeded {len(CURATED)} curated Published Design Journeys for {slug}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
