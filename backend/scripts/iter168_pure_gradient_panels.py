"""ITER168 follow-up #2 · Pure gradient compositions for Atmospheric
Panels™. NO photographs. NO people. NO interiors. NO objects.

User-explicit prohibition: nothing depicting a specific scene. Pure
light/shadow gradients EVOKE the emotional tone without asserting any
stylistic content.

Each gradient is a multi-stop linear/radial composition tuned to:
  · emotional_tone
  · light_temperature
  · spatial_density

These are stored as `kind: 'gradient'` assets in `visual_assets`.
The frontend renderer paints them via CSS rather than `<img>`.
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


# Cinematic editorial gradients (CSS `background` value strings).
GRADIENTS = {
    'quiet-materials':
        # Travertine: cream → bone → soft taupe (calm, neutral light)
        'radial-gradient(140% 110% at 30% 18%, rgba(255,253,247,0.96) 0%, '
        'rgba(238,229,213,0.92) 32%, rgba(210,194,167,0.88) 72%, '
        'rgba(167,148,118,0.85) 100%)',

    'warm-reflection':
        # Bronze brushed: bronze-veil with soft warm glow lower left
        'radial-gradient(120% 100% at 22% 78%, rgba(220,170,108,0.88) 0%, '
        'rgba(174,124,72,0.85) 32%, rgba(99,71,42,0.95) 75%, '
        'rgba(42,28,16,0.98) 100%)',

    'light-and-stillness':
        # Cool water stillness: silver-blue → slate
        'radial-gradient(130% 100% at 65% 30%, rgba(232,238,242,0.95) 0%, '
        'rgba(184,200,213,0.92) 36%, rgba(108,128,143,0.94) 72%, '
        'rgba(48,62,76,0.96) 100%)',

    'natural-rhythm':
        # Wood grain warmth: amber → terracotta → deep umber
        'linear-gradient(165deg, rgba(208,165,108,0.95) 0%, '
        'rgba(168,116,68,0.94) 35%, rgba(118,72,38,0.96) 72%, '
        'rgba(58,32,16,0.98) 100%)',

    'spatial-calm':
        # Architectural shadow on plaster: bone → ivory with deep soft edge
        'radial-gradient(160% 130% at 20% 25%, rgba(248,243,234,0.98) 0%, '
        'rgba(228,220,206,0.94) 30%, rgba(186,177,162,0.92) 65%, '
        'rgba(112,104,90,0.94) 100%)',

    'soft-contrast':
        # Onyx backlit: deep wine → ember → cream halo
        'radial-gradient(110% 110% at 78% 22%, rgba(250,236,212,0.92) 0%, '
        'rgba(206,142,88,0.9) 28%, rgba(140,62,40,0.95) 62%, '
        'rgba(48,18,18,0.98) 100%)',
}


def main():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()
    n = 0
    for slug, gradient in GRADIENTS.items():
        assets = [{
            'kind':     'gradient',
            'gradient': gradient,
            'alt':      '',  # pure abstract — no semantic content
        }]
        cur.execute(
            "UPDATE atmospheric_panels SET visual_assets = %s::jsonb, "
            "updated_at = NOW() WHERE slug = %s AND tenant_id IS NULL",
            (json.dumps(assets), slug),
        )
        if cur.rowcount:
            n += 1
            print(f"  ✓ {slug:20s}  →  gradient composition applied")

    print(f"\n[iter168] {n} panels migrated to pure-gradient editorial compositions.")
    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
