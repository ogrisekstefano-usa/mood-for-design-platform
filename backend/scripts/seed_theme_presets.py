#!/usr/bin/env python3
"""
seed_theme_presets.py — Curated brand theme presets for Brand Studio.

Seeds the `theme_presets` table with editorial design system presets:
  1. editorial         — Magazine-grade contrast
  2. luxury            — Brass on charcoal
  3. warm              — Warm Italian Luxury (terracotta on cream)
  4. monochrome        — Monochrome Atelier
  5. minimal           — Architectural Minimal
  6. scandinavian      — Nordic Editorial (pale linen)
  7. gallery           — Modern Gallery (dark)
  8. stone             — Dark Stone (warm graphite)
  9. hospitality       — Soft Hospitality (warm light cream)

Usage:
    cd /app/backend && python3 scripts/seed_theme_presets.py

Idempotent — UPSERT on `key`. Safe to re-run.
"""
import os
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv
load_dotenv(pathlib.Path(__file__).resolve().parent.parent / ".env")
from supabase import create_client

client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

PRESETS = [
    {
        "key": "editorial",
        "label": "Editorial",
        "description": "Magazine-grade contrast · Playfair × Montserrat",
        "vibe_tags": ["serif", "contrast", "minimal", "dark"],
        "sort_order": 10,
        "is_default": True,
        "theme": {
            "mode": "dark",
            "palette": {
                "primary": "#00C9B3", "secondary": "#33DCC6", "accent": "#7EE6DA",
                "background": "#0F0F10", "surface": "#16171A",
                "text_primary": "#F4F5F7", "text_secondary": "#C8CACE",
                "border": "rgba(244,245,247,0.10)",
                "success": "#22C55E", "warning": "#F59E0B", "danger": "#EF4444",
            },
            "typography": {"display": "Playfair Display", "body": "Montserrat"},
            "radius": "2px", "density": "comfortable", "shadow": "soft",
        },
    },
    {
        "key": "luxury",
        "label": "Warm Italian Luxury",
        "description": "Brass on charcoal · Cormorant × Manrope",
        "vibe_tags": ["serif", "warm", "dark", "luxury"],
        "sort_order": 20,
        "is_default": False,
        "theme": {
            "mode": "dark",
            "palette": {
                "primary": "#C9A36E", "secondary": "#D9BE91", "accent": "#E7CFB0",
                "background": "#111111", "surface": "#1A1714",
                "text_primary": "#F1ECE3", "text_secondary": "#C9C3B8",
                "border": "rgba(241,236,227,0.10)",
                "success": "#86C68E", "warning": "#E4B95F", "danger": "#E07A5F",
            },
            "typography": {"display": "Cormorant Garamond", "body": "Manrope"},
            "radius": "0px", "density": "spacious", "shadow": "soft",
        },
    },
    {
        "key": "warm",
        "label": "Warm Cream",
        "description": "Terracotta on cream · Fraunces × Inter",
        "vibe_tags": ["serif", "warm", "light"],
        "sort_order": 30,
        "is_default": False,
        "theme": {
            "mode": "light",
            "palette": {
                "primary": "#C57B57", "secondary": "#D8A47F", "accent": "#F1B392",
                "background": "#F6EFE6", "surface": "#FFFFFF",
                "text_primary": "#2A2522", "text_secondary": "#615853",
                "border": "rgba(42,37,34,0.10)",
                "success": "#5C8C5A", "warning": "#D4A24C", "danger": "#B5523B",
            },
            "typography": {"display": "Fraunces", "body": "Inter"},
            "radius": "4px", "density": "comfortable", "shadow": "medium",
        },
    },
    {
        "key": "monochrome",
        "label": "Monochrome Atelier",
        "description": "Editorial black & white · DM Serif × Plus Jakarta",
        "vibe_tags": ["serif", "high-contrast", "minimal", "light"],
        "sort_order": 40,
        "is_default": False,
        "theme": {
            "mode": "light",
            "palette": {
                "primary": "#0A0A0A", "secondary": "#262626", "accent": "#7C7C7C",
                "background": "#FFFFFF", "surface": "#F7F7F7",
                "text_primary": "#0A0A0A", "text_secondary": "#525252",
                "border": "rgba(10,10,10,0.10)",
                "success": "#16A34A", "warning": "#CA8A04", "danger": "#DC2626",
            },
            "typography": {"display": "DM Serif Display", "body": "Plus Jakarta Sans"},
            "radius": "0px", "density": "compact", "shadow": "none",
        },
    },
    {
        "key": "minimal",
        "label": "Architectural Minimal",
        "description": "Quiet luxury · Inter Tight everywhere",
        "vibe_tags": ["sans", "clean", "calm", "light"],
        "sort_order": 50,
        "is_default": False,
        "theme": {
            "mode": "light",
            "palette": {
                "primary": "#0F172A", "secondary": "#334155", "accent": "#64748B",
                "background": "#FAFAFA", "surface": "#FFFFFF",
                "text_primary": "#0F172A", "text_secondary": "#475569",
                "border": "rgba(15,23,42,0.08)",
                "success": "#10B981", "warning": "#F59E0B", "danger": "#EF4444",
            },
            "typography": {"display": "Inter Tight", "body": "Inter Tight"},
            "radius": "8px", "density": "comfortable", "shadow": "soft",
        },
    },
    {
        "key": "scandinavian",
        "label": "Nordic Editorial",
        "description": "Pale linen · DM Serif × Plus Jakarta",
        "vibe_tags": ["serif", "light", "airy", "nordic"],
        "sort_order": 60,
        "is_default": False,
        "theme": {
            "mode": "light",
            "palette": {
                "primary": "#3D5A57", "secondary": "#82A09C", "accent": "#C8C5BC",
                "background": "#FBF9F4", "surface": "#FFFFFF",
                "text_primary": "#1F3936", "text_secondary": "#566866",
                "border": "rgba(31,57,54,0.08)",
                "success": "#7CA084", "warning": "#D2A359", "danger": "#B5523B",
            },
            "typography": {"display": "DM Serif Display", "body": "Plus Jakarta Sans"},
            "radius": "4px", "density": "spacious", "shadow": "soft",
        },
    },
    {
        "key": "gallery",
        "label": "Modern Gallery",
        "description": "Art-gallery dark · Playfair × Space Grotesk",
        "vibe_tags": ["serif", "dark", "gallery"],
        "sort_order": 70,
        "is_default": False,
        "theme": {
            "mode": "dark",
            "palette": {
                "primary": "#E4DFD1", "secondary": "#9C8E73", "accent": "#D4A24C",
                "background": "#1A1816", "surface": "#252220",
                "text_primary": "#E4DFD1", "text_secondary": "#A8A299",
                "border": "rgba(228,223,209,0.08)",
                "success": "#A6C68A", "warning": "#E4B95F", "danger": "#D4796E",
            },
            "typography": {"display": "Playfair Display", "body": "Space Grotesk"},
            "radius": "0px", "density": "spacious", "shadow": "medium",
        },
    },
    {
        "key": "stone",
        "label": "Dark Stone",
        "description": "Warm graphite · Cormorant × Manrope",
        "vibe_tags": ["serif", "stone", "warm", "dark"],
        "sort_order": 80,
        "is_default": False,
        "theme": {
            "mode": "dark",
            "palette": {
                "primary": "#A8A29E", "secondary": "#8B8480", "accent": "#C9BFA7",
                "background": "#1A1816", "surface": "#231F1C",
                "text_primary": "#E8E3DC", "text_secondary": "#B8B0A5",
                "border": "rgba(232,227,220,0.08)",
                "success": "#8FAB73", "warning": "#D4A24C", "danger": "#C97870",
            },
            "typography": {"display": "Cormorant Garamond", "body": "Manrope"},
            "radius": "2px", "density": "comfortable", "shadow": "soft",
        },
    },
    {
        "key": "hospitality",
        "label": "Soft Hospitality",
        "description": "Warm cream & sage · Fraunces × Manrope",
        "vibe_tags": ["serif", "warm", "light", "hospitality"],
        "sort_order": 90,
        "is_default": False,
        "theme": {
            "mode": "light",
            "palette": {
                "primary": "#7A8568", "secondary": "#A8AE94", "accent": "#D4C5A9",
                "background": "#FBF7F0", "surface": "#FFFFFF",
                "text_primary": "#2F2D28", "text_secondary": "#5C5851",
                "border": "rgba(47,45,40,0.10)",
                "success": "#6F8C5A", "warning": "#D2A359", "danger": "#B5523B",
            },
            "typography": {"display": "Fraunces", "body": "Manrope"},
            "radius": "6px", "density": "spacious", "shadow": "soft",
        },
    },
    # ═══════════════════════════════════════════════════════════════════
    # COLORFUL CURATED THEMES (Feb 2026) — designer-balanced vibrant
    # palettes. Always one bold hue + one tactile neutral + restrained
    # contrast pair. Never circus colors.
    # ═══════════════════════════════════════════════════════════════════
    {
        "key": "bordeaux",
        "label": "Atelier Bordeaux",
        "description": "Burgundy & rose · DM Serif × Plus Jakarta",
        "vibe_tags": ["serif", "warm", "dark", "luxury", "bordeaux"],
        "sort_order": 100,
        "is_default": False,
        "theme": {
            "mode": "dark",
            "palette": {
                "primary": "#A8324A", "secondary": "#C46778", "accent": "#E8B4A8",
                "background": "#1A0F12", "surface": "#241419",
                "text_primary": "#F3E6E0", "text_secondary": "#C5A99E",
                "border": "rgba(232,180,168,0.12)",
                "success": "#86C68E", "warning": "#E4B95F", "danger": "#E07A5F",
            },
            "typography": {"display": "DM Serif Display", "body": "Plus Jakarta Sans"},
            "radius": "2px", "density": "comfortable", "shadow": "medium",
        },
    },
    {
        "key": "aegean",
        "label": "Aegean Atelier",
        "description": "Deep blue & whitewash · Cormorant × Manrope",
        "vibe_tags": ["serif", "blue", "light", "mediterranean"],
        "sort_order": 110,
        "is_default": False,
        "theme": {
            "mode": "light",
            "palette": {
                "primary": "#1F4E79", "secondary": "#3D7AAA", "accent": "#88B7D8",
                "background": "#F7F4ED", "surface": "#FFFFFF",
                "text_primary": "#16243A", "text_secondary": "#4F6177",
                "border": "rgba(31,78,121,0.14)",
                "success": "#3F8B6E", "warning": "#D2A359", "danger": "#C24E3A",
            },
            "typography": {"display": "Cormorant Garamond", "body": "Manrope"},
            "radius": "4px", "density": "spacious", "shadow": "soft",
        },
    },
    {
        "key": "linen_sage",
        "label": "Linen Sage",
        "description": "Sage & linen · Fraunces × DM Sans",
        "vibe_tags": ["serif", "green", "light", "calm", "natural"],
        "sort_order": 120,
        "is_default": False,
        "theme": {
            "mode": "light",
            "palette": {
                "primary": "#5C7A5C", "secondary": "#8AA38A", "accent": "#C7D2B5",
                "background": "#F5F2EA", "surface": "#FFFFFF",
                "text_primary": "#2A3328", "text_secondary": "#5E6359",
                "border": "rgba(42,51,40,0.10)",
                "success": "#6F8C5A", "warning": "#D2A359", "danger": "#B5523B",
            },
            "typography": {"display": "Fraunces", "body": "DM Sans"},
            "radius": "8px", "density": "spacious", "shadow": "soft",
        },
    },
    {
        "key": "florence_sienna",
        "label": "Florence Sienna",
        "description": "Terracotta & ochre · Bodoni × Outfit",
        "vibe_tags": ["serif", "warm", "italian", "earth", "vibrant"],
        "sort_order": 130,
        "is_default": False,
        "theme": {
            "mode": "light",
            "palette": {
                "primary": "#C44536", "secondary": "#E07A5F", "accent": "#F2C075",
                "background": "#FAF3E7", "surface": "#FFFFFF",
                "text_primary": "#2B1A14", "text_secondary": "#6B5547",
                "border": "rgba(43,26,20,0.10)",
                "success": "#6F8C5A", "warning": "#E4B95F", "danger": "#A82C24",
            },
            "typography": {"display": "Bodoni Moda", "body": "Outfit"},
            "radius": "2px", "density": "comfortable", "shadow": "medium",
        },
    },
    {
        "key": "tokyo_ink",
        "label": "Tokyo Ink",
        "description": "Indigo & rice paper · Inter Tight × Inter",
        "vibe_tags": ["sans", "dark", "minimal", "japanese", "modern"],
        "sort_order": 140,
        "is_default": False,
        "theme": {
            "mode": "dark",
            "palette": {
                "primary": "#4A6FE3", "secondary": "#7B95EE", "accent": "#A8B8F2",
                "background": "#0F1116", "surface": "#171A22",
                "text_primary": "#EEF0F6", "text_secondary": "#A8AEC2",
                "border": "rgba(168,184,242,0.12)",
                "success": "#5DD39E", "warning": "#F2B441", "danger": "#EF4444",
            },
            "typography": {"display": "Inter Tight", "body": "Inter"},
            "radius": "4px", "density": "compact", "shadow": "strong",
        },
    },
    {
        "key": "soho_rose",
        "label": "Soho Rose",
        "description": "Dusty rose & graphite · Playfair × Karla",
        "vibe_tags": ["serif", "rose", "soft", "feminine", "editorial"],
        "sort_order": 150,
        "is_default": False,
        "theme": {
            "mode": "light",
            "palette": {
                "primary": "#9D5A6C", "secondary": "#C28394", "accent": "#E8C5C8",
                "background": "#F8F3F2", "surface": "#FFFFFF",
                "text_primary": "#2A1F23", "text_secondary": "#665058",
                "border": "rgba(157,90,108,0.12)",
                "success": "#6F8C5A", "warning": "#D2A359", "danger": "#B53A4F",
            },
            "typography": {"display": "Playfair Display", "body": "Karla"},
            "radius": "6px", "density": "comfortable", "shadow": "soft",
        },
    },
    {
        "key": "verde_tuscan",
        "label": "Verde Tuscan",
        "description": "Olive & cream · EB Garamond × Work Sans",
        "vibe_tags": ["serif", "olive", "warm", "rustic", "earthy"],
        "sort_order": 160,
        "is_default": False,
        "theme": {
            "mode": "light",
            "palette": {
                "primary": "#6B7A39", "secondary": "#94A35A", "accent": "#C4CC9A",
                "background": "#F7F2E5", "surface": "#FFFFFF",
                "text_primary": "#2A2E1A", "text_secondary": "#5A5E48",
                "border": "rgba(107,122,57,0.14)",
                "success": "#6F8C5A", "warning": "#D2A359", "danger": "#B5523B",
            },
            "typography": {"display": "EB Garamond", "body": "Work Sans"},
            "radius": "4px", "density": "spacious", "shadow": "soft",
        },
    },
]


def main():
    for p in PRESETS:
        client.table("theme_presets").upsert(p, on_conflict="key").execute()
        print(f"  ✓ {p['key']:14s} · {p['label']}")
    print(f"\nSeeded {len(PRESETS)} curated theme presets")


if __name__ == "__main__":
    main()
