"""ITER168 · Atmospheric Panels™ — Seed 6 platform-wide editorial panels.

These are NOT moodboard photos. Each panel is an EDITORIAL INTERPRETATION
of emotional tension (calm/warm/reflective/etc.) composed by a single
cinematic asset + abstract overlay. The Chameleon™ Emotional
Interpretation Layer will compose them per market/locale/brief.

VIETATO (re-confirming user spec):
  ❌ persone riconoscibili, famiglie, coppie
  ❌ stock interiors, render completi, collage Pinterest
  ❌ ambienti troppo definiti

CONSENTITO:
  ✅ macro materiali, luce, ombre
  ✅ dettagli architettonici, blur cinematici
  ✅ texture (travertino, onice, legno, tessuti, bronzo)
  ✅ soft gradients, riflessi, acqua

Editorial reference: Aman Resorts · Aesop · Apple keynote textures ·
COS · Kelly Wearstler material studies · architectural crops.
"""
from __future__ import annotations

import os
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / '.env')

import psycopg2  # noqa: E402
import psycopg2.extras  # noqa: E402


# ── 6 initial Atmospheric Panels ─────────────────────────────────────
PANELS = [
    {
        'slug': 'quiet-materials',
        'title': 'Quiet Materials',
        'emotional_tone':    'calm',
        'light_temperature': 'neutral',
        'spatial_density':   'minimal',
        'motion_level':      'still',
        'materiality':       ['travertino', 'lino', 'pietra grezza'],
        'cultural_influence':['italian', 'mediterranean-quiet'],
        'hospitality_index': 55,
        'visual_assets': [
            {
                'url':  'https://images.unsplash.com/photo-1615873968403-89e068629265?w=1600&q=85',
                'kind': 'image',
                'alt':  'Travertine surface in soft natural light',
                'focal_point': '50% 60%',
            }
        ],
        'overlay_tone': 'cream-veil',
        'interpretation': (
            'La luce posa sul travertino senza forzare. '
            'Iniziamo a leggere una preferenza per ció che resta.'
        ),
        'locale_affinity': ['it-IT', 'en-US', 'en-GB'],
        'market_affinity': ['IT', 'CH', 'FR'],
        'display_order': 10,
    },
    {
        'slug': 'warm-reflection',
        'title': 'Warm Reflection',
        'emotional_tone':    'warm',
        'light_temperature': 'warm',
        'spatial_density':   'balanced',
        'motion_level':      'soft',
        'materiality':       ['bronzo satinato', 'noce', 'velluto'],
        'cultural_influence':['italian', 'editorial-hospitality'],
        'hospitality_index': 78,
        'visual_assets': [
            {
                'url':  'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1600&q=85',
                'kind': 'image',
                'alt':  'Brushed bronze detail with warm reflection',
                'focal_point': '60% 50%',
            }
        ],
        'overlay_tone': 'bronze-veil',
        'interpretation': (
            'Un riflesso caldo sul bronzo satinato suggerisce '
            'un\u2019accoglienza che non grida.'
        ),
        'locale_affinity': ['it-IT', 'en-US', 'fr-FR'],
        'market_affinity': ['IT', 'US', 'AE'],
        'display_order': 20,
    },
    {
        'slug': 'light-and-stillness',
        'title': 'Light & Stillness',
        'emotional_tone':    'reflective',
        'light_temperature': 'cool',
        'spatial_density':   'minimal',
        'motion_level':      'still',
        'materiality':       ['vetro', 'acqua', 'cemento smeralda'],
        'cultural_influence':['japandi-adjacent', 'editorial'],
        'hospitality_index': 40,
        'visual_assets': [
            {
                'url':  'https://images.unsplash.com/photo-1604147495798-57beb5d6af73?w=1600&q=85',
                'kind': 'image',
                'alt':  'Water surface at rest with cool ambient light',
                'focal_point': '50% 50%',
            }
        ],
        'overlay_tone': 'cool-glass',
        'interpretation': (
            'L\u2019acqua sta ferma. La luce si lascia attraversare. '
            'Una preferenza per il silenzio.'
        ),
        'locale_affinity': ['it-IT', 'en-US', 'en-GB'],
        'market_affinity': ['IT', 'CH', 'JP', 'US'],
        'display_order': 30,
    },
    {
        'slug': 'natural-rhythm',
        'title': 'Natural Rhythm',
        'emotional_tone':    'contemplative',
        'light_temperature': 'warm',
        'spatial_density':   'balanced',
        'motion_level':      'soft',
        'materiality':       ['legno massello', 'paglia', 'rame'],
        'cultural_influence':['mediterranean', 'craft-led'],
        'hospitality_index': 60,
        'visual_assets': [
            {
                'url':  'https://images.unsplash.com/photo-1604769684871-b3f9b56f9fc3?w=1600&q=85',
                'kind': 'image',
                'alt':  'Wood grain texture in late afternoon light',
                'focal_point': '50% 55%',
            }
        ],
        'overlay_tone': 'sunset-haze',
        'interpretation': (
            'Le venature del legno tengono un ritmo lento. '
            'Iniziamo a leggere un legame con il vivo.'
        ),
        'locale_affinity': ['it-IT', 'fr-FR', 'es-ES'],
        'market_affinity': ['IT', 'FR', 'ES'],
        'display_order': 40,
    },
    {
        'slug': 'spatial-calm',
        'title': 'Spatial Calm',
        'emotional_tone':    'calm',
        'light_temperature': 'neutral',
        'spatial_density':   'minimal',
        'motion_level':      'still',
        'materiality':       ['intonaco materico', 'cemento bianco', 'lino'],
        'cultural_influence':['minimal-italian', 'monastic-adjacent'],
        'hospitality_index': 45,
        'visual_assets': [
            {
                'url':  'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=1600&q=85',
                'kind': 'image',
                'alt':  'Architectural shadow on textured plaster wall',
                'focal_point': '40% 50%',
            }
        ],
        'overlay_tone': 'cream-veil',
        'interpretation': (
            'L\u2019ombra dell\u2019architettura riposa sul muro. '
            'Una preferenza per il respiro tra le cose.'
        ),
        'locale_affinity': ['it-IT', 'en-US', 'en-GB'],
        'market_affinity': ['IT', 'CH', 'AE', 'US'],
        'display_order': 50,
    },
    {
        'slug': 'soft-contrast',
        'title': 'Soft Contrast',
        'emotional_tone':    'editorial',
        'light_temperature': 'sunset',
        'spatial_density':   'layered',
        'motion_level':      'soft',
        'materiality':       ['onice', 'tessuto rigato', 'metallo brunito'],
        'cultural_influence':['editorial-luxury', 'contemporary-italian'],
        'hospitality_index': 70,
        'visual_assets': [
            {
                'url':  'https://images.unsplash.com/photo-1605283176568-9b41fde3672e?w=1600&q=85',
                'kind': 'image',
                'alt':  'Onyx slab with translucent backlight',
                'focal_point': '50% 50%',
            }
        ],
        'overlay_tone': 'sunset-haze',
        'interpretation': (
            'Il contrasto resta morbido. L\u2019onice trattiene la luce '
            'e la restituisce piano.'
        ),
        'locale_affinity': ['it-IT', 'en-US', 'ar-AE'],
        'market_affinity': ['IT', 'US', 'AE'],
        'display_order': 60,
    },
]


def main():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()

    inserted = 0
    for p in PANELS:
        cur.execute(
            """
            INSERT INTO atmospheric_panels
              (tenant_id, slug, title, emotional_tone, light_temperature,
               spatial_density, motion_level, materiality, cultural_influence,
               hospitality_index, visual_assets, overlay_tone, interpretation,
               locale_affinity, market_affinity, display_order, active)
            VALUES
              (NULL, %s, %s, %s, %s, %s, %s, %s::text[], %s::text[], %s,
               %s::jsonb, %s, %s, %s::text[], %s::text[], %s, TRUE)
            ON CONFLICT ((COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)), slug)
            DO UPDATE SET
              title              = EXCLUDED.title,
              emotional_tone     = EXCLUDED.emotional_tone,
              light_temperature  = EXCLUDED.light_temperature,
              spatial_density    = EXCLUDED.spatial_density,
              motion_level       = EXCLUDED.motion_level,
              materiality        = EXCLUDED.materiality,
              cultural_influence = EXCLUDED.cultural_influence,
              hospitality_index  = EXCLUDED.hospitality_index,
              visual_assets      = EXCLUDED.visual_assets,
              overlay_tone       = EXCLUDED.overlay_tone,
              interpretation     = EXCLUDED.interpretation,
              locale_affinity    = EXCLUDED.locale_affinity,
              market_affinity    = EXCLUDED.market_affinity,
              display_order      = EXCLUDED.display_order,
              updated_at         = NOW()
            """,
            (
                p['slug'], p['title'], p['emotional_tone'], p['light_temperature'],
                p['spatial_density'], p['motion_level'],
                p['materiality'], p['cultural_influence'], p['hospitality_index'],
                json.dumps(p['visual_assets']), p['overlay_tone'], p['interpretation'],
                p['locale_affinity'], p['market_affinity'], p['display_order'],
            ),
        )
        inserted += 1
        print(f"  ✓ {p['slug']:20s}  · {p['emotional_tone']:14s}  · {p['title']}")

    print(f"\n[iter168] seeded {inserted} Atmospheric Panels.")
    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
