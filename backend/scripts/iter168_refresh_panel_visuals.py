"""ITER168 follow-up · Replace Atmospheric Panel visuals with proper
macro material / texture / light-shadow editorial assets.

User explicit prohibition:
  ❌ stock interiors (sofas, beds, gallery walls)
  ❌ ambienti troppo definiti
  ❌ architecture full scenes

Replacement strategy: pure-texture / macro-material / light-shadow
Unsplash photos. Each ID has been hand-picked for editorial quietness.
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


REPLACEMENTS = {
    # Travertine / pietra texture macro
    'quiet-materials': [{
        'url':  'https://images.unsplash.com/photo-1604147495798-57beb5d6af73?w=1600&q=85&auto=format&fit=crop',
        'kind': 'image',
        'alt':  'Soft natural light pooling on travertine surface',
        'focal_point': '50% 60%',
    }],
    # Bronze / brass macro reflection
    'warm-reflection': [{
        'url':  'https://images.unsplash.com/photo-1518733057094-95b53143d2a7?w=1600&q=85&auto=format&fit=crop',
        'kind': 'image',
        'alt':  'Brushed metal surface with warm reflection',
        'focal_point': '50% 50%',
    }],
    # Water surface stillness (close, no horizon)
    'light-and-stillness': [{
        'url':  'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=1600&q=85&auto=format&fit=crop',
        'kind': 'image',
        'alt':  'Still water surface with cool ambient light',
        'focal_point': '50% 65%',
    }],
    # Wood grain macro (no furniture)
    'natural-rhythm': [{
        'url':  'https://images.unsplash.com/photo-1503602642458-232111445657?w=1600&q=85&auto=format&fit=crop',
        'kind': 'image',
        'alt':  'Wood grain detail in late afternoon light',
        'focal_point': '50% 50%',
    }],
    # Architectural shadow on plaster wall (no furniture)
    'spatial-calm': [{
        'url':  'https://images.unsplash.com/photo-1611068813580-b07c84b9b4b8?w=1600&q=85&auto=format&fit=crop',
        'kind': 'image',
        'alt':  'Soft architectural shadow on textured plaster wall',
        'focal_point': '50% 45%',
    }],
    # Onyx / translucent stone backlit (no furniture, no scene)
    'soft-contrast': [{
        'url':  'https://images.unsplash.com/photo-1582552938357-32b906df40cb?w=1600&q=85&auto=format&fit=crop',
        'kind': 'image',
        'alt':  'Backlit onyx slab — translucent stone detail',
        'focal_point': '50% 50%',
    }],
}


def main():
    conn = psycopg2.connect(os.environ['DATABASE_URL']); conn.autocommit = True
    cur = conn.cursor()
    n = 0
    for slug, assets in REPLACEMENTS.items():
        cur.execute(
            "UPDATE atmospheric_panels SET visual_assets = %s::jsonb, updated_at = NOW() "
            "WHERE slug = %s AND tenant_id IS NULL",
            (json.dumps(assets), slug)
        )
        if cur.rowcount:
            n += 1
            print(f"  ✓ {slug:20s}  →  {assets[0]['alt']}")
    print(f"\n[iter168] {n} panels re-visualised with editorial macro/texture assets.")
    cur.close(); conn.close()


if __name__ == '__main__':
    main()
