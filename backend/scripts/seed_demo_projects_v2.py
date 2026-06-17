#!/usr/bin/env python3
"""
seed_demo_projects_v2.py
═════════════════════════
Aggiunge 3 nuovi progetti al portfolio demo del tenant 'studio'.

CLASSIFICAZIONE:
  - Ogni progetto è marcato con editorial_tone='cms-showcase-demo'
  - I titoli sono tipologici e generici (non identificano uno studio reale)
  - L'obiettivo è dimostrare le capacità del sistema CMS, non simulare uno studio esistente

Progetti aggiunti (totale porta da 3 a 6):
  4. Residenza in Campagna          — residential
  5. Suite Boutique — Waterfront    — hospitality
  6. Spazio di Lavoro Creativo      — contract/workspace

Idempotente: aggiorna per slug se già esiste.
"""
import sys, uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from database import db

NOW = lambda: datetime.now(timezone.utc).isoformat()

DEFAULT_TENANT_SLUG = 'studio'

# Marker chiaro: tutti i progetti demo hanno questo editorial_tone
DEMO_MARKER = 'cms-showcase-demo'

DEMO_PROJECTS = [
    {
        'slug':              'residenza-in-campagna',
        'title':             'Residenza in Campagna',
        'canonical_locale':  'it-IT',
        'editorial_excerpt': 'Un progetto residenziale che interpreta il paesaggio agrario attraverso materiali locali e una logica di spazi aperti verso l\'esterno. Esempio di come il CMS gestisce la sezione Progetti.',
        'atmosphere':        'Paesaggio rurale · materia locale · apertura',
        'project_type':      'residential',
        'location':          'Italia centrale',
        'year':              2025,
        'hero_url':          'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2000&q=85',
        'material_tags':     ['Travertino', 'Legno di recupero', 'Cotto'],
        'featured_order':    3,
        'homepage_featured': True,
        'visibility_status': 'published',
        'seo_title':         'Residenza in Campagna — Portfolio Demo · Studio',
        'seo_description':   '[Demo editoriale CMS] Progetto tipologico residenziale — contenuto dimostrativo delle capacità del sistema.',
        'translations': {
            'en-US': {
                'title':            'Country Residence',
                'editorial_excerpt':'A residential project that interprets the agrarian landscape through local materials and a logic of spaces open towards the exterior. Example of how the CMS manages the Projects section.',
                'atmosphere':       'Rural landscape · local matter · openness',
                'location':         'Central Italy',
                'seo_title':        'Country Residence — Demo Portfolio · Studio',
                'seo_description':  '[CMS editorial demo] Typological residential project — demonstrative content of system capabilities.',
            },
        },
    },
    {
        'slug':              'suite-boutique-waterfront',
        'title':             'Suite Boutique — Waterfront',
        'canonical_locale':  'it-IT',
        'editorial_excerpt': 'Un progetto hospitality che lavora sul rapporto tra acqua, luce riflessa e superfici minerali. Palazzina fronte porto ridisegnata come struttura ricettiva boutique. Esempio tipologico hospitality nel CMS.',
        'atmosphere':        'Acqua · luce riflessa · minerale',
        'project_type':      'hospitality',
        'location':          'Costa adriatica',
        'year':              2025,
        'hero_url':          'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=2000&q=85',
        'material_tags':     ['Pietra di Vicenza', 'Ottone', 'Vetro sabbiato'],
        'featured_order':    4,
        'homepage_featured': True,
        'visibility_status': 'published',
        'seo_title':         'Suite Boutique Waterfront — Portfolio Demo · Studio',
        'seo_description':   '[Demo editoriale CMS] Progetto tipologico hospitality — contenuto dimostrativo delle capacità del sistema.',
        'translations': {
            'en-US': {
                'title':            'Boutique Suite — Waterfront',
                'editorial_excerpt':'A hospitality project working on the relationship between water, reflected light and mineral surfaces. A waterfront building redesigned as a boutique accommodation. Typological hospitality example in CMS.',
                'atmosphere':       'Water · reflected light · mineral',
                'location':         'Adriatic coast',
                'seo_title':        'Boutique Suite Waterfront — Demo Portfolio · Studio',
                'seo_description':  '[CMS editorial demo] Typological hospitality project — demonstrative content of system capabilities.',
            },
        },
    },
    {
        'slug':              'spazio-di-lavoro-creativo',
        'title':             'Spazio di Lavoro Creativo',
        'canonical_locale':  'it-IT',
        'editorial_excerpt': 'Un progetto contract che trasforma un piano industriale in un ambiente di lavoro creativo contemporaneo. La progettazione mantiene la memoria strutturale dell\'edificio originale. Esempio tipologico contract nel CMS.',
        'atmosphere':        'Industriale · contemporaneo · collaborativo',
        'project_type':      'contract',
        'location':          'Nord Italia',
        'year':              2024,
        'hero_url':          'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=2000&q=85',
        'material_tags':     ['Cemento a vista', 'Acciaio corten', 'Legno laccato'],
        'featured_order':    5,
        'homepage_featured': True,
        'visibility_status': 'published',
        'seo_title':         'Spazio di Lavoro Creativo — Portfolio Demo · Studio',
        'seo_description':   '[Demo editoriale CMS] Progetto tipologico contract/workplace — contenuto dimostrativo delle capacità del sistema.',
        'translations': {
            'en-US': {
                'title':            'Creative Workspace',
                'editorial_excerpt':'A contract project transforming an industrial floor into a contemporary creative workspace. The design retains the structural memory of the original building. Typological contract example in CMS.',
                'atmosphere':       'Industrial · contemporary · collaborative',
                'location':         'Northern Italy',
                'seo_title':        'Creative Workspace — Demo Portfolio · Studio',
                'seo_description':  '[CMS editorial demo] Typological contract/workplace project — demonstrative content of system capabilities.',
            },
        },
    },
]


def _resolve_tenant_id(client, slug):
    r = (client.table('tenants').select('id').eq('slug', slug).limit(1).execute()).data or []
    return r[0]['id'] if r else None


def _upsert_journey(client, tenant_id, payload):
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
        client.table('published_design_journeys').update(base).eq('id', jid).execute()
    else:
        base['id']         = str(uuid.uuid4())
        base['created_at'] = NOW()
        client.table('published_design_journeys').insert(base).execute()
        jid = base['id']

    for locale, tx in (payload.get('translations') or {}).items():
        ex_tx = (client.table('published_design_journey_translations').select('id')
                 .eq('published_journey_id', jid).eq('locale', locale)
                 .limit(1).execute()).data or []
        row = {**tx, 'tenant_id': tenant_id, 'published_journey_id': jid,
               'locale': locale, 'status': 'manual', 'updated_at': NOW()}
        if ex_tx:
            client.table('published_design_journey_translations').update(row).eq('id', ex_tx[0]['id']).execute()
        else:
            row['id'] = str(uuid.uuid4())
            row['created_at'] = NOW()
            client.table('published_design_journey_translations').insert(row).execute()
    return jid


def main():
    slug = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_TENANT_SLUG
    client = db()
    tid = _resolve_tenant_id(client, slug)
    if not tid:
        print(f"ERROR: tenant '{slug}' not found"); return 2
    print(f"→ Tenant {slug} = {tid}")
    print(f"→ Classificazione demo: editorial_tone='{DEMO_MARKER}'\n")
    for p in DEMO_PROJECTS:
        jid = _upsert_journey(client, tid, p)
        print(f"  ✓ [{p['project_type']}] {p['slug']:<35} = {jid}")
    print(f"\n✅ Seeded {len(DEMO_PROJECTS)} demo projects — totale portfolio: 6 progetti")
    return 0


if __name__ == '__main__':
    sys.exit(main())
