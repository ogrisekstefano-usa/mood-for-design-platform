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
    # ─── 5 NUOVI CHIARI EDITORIALI (per raggiungere 15 atmosfere chiare) ────
    {
        "key": "champagne_atelier",
        "label": "Champagne Atelier",
        "description": "Champagne & oro pallido · Cormorant × Manrope",
        "vibe_tags": ["light", "champagne", "warm", "luxury", "soft"],
        "sort_order": 165,
        "is_default": False,
        "theme": {
            "mode": "light",
            "palette": {
                "primary": "#B8956B", "secondary": "#CFB28A", "accent": "#E8D6BA",
                "background": "#FAF4E8", "surface": "#FFFFFF",
                "text_primary": "#3A2F1F", "text_secondary": "#7A6A52",
                "border": "rgba(184,149,107,0.16)",
                "success": "#7C9670", "warning": "#D2A359", "danger": "#B5523B",
            },
            "typography": {"display": "Cormorant Garamond", "body": "Manrope"},
            "radius": "3px", "density": "spacious", "shadow": "soft",
        },
    },
    {
        "key": "pearl_couture",
        "label": "Pearl Couture",
        "description": "Perla luminosa · Bodoni × Inter",
        "vibe_tags": ["light", "pearl", "neutral", "minimal", "luxury"],
        "sort_order": 167,
        "is_default": False,
        "theme": {
            "mode": "light",
            "palette": {
                "primary": "#9A8E84", "secondary": "#B5A99E", "accent": "#D4CAC0",
                "background": "#F5F0EA", "surface": "#FFFFFF",
                "text_primary": "#2E2925", "text_secondary": "#6B635B",
                "border": "rgba(154,142,132,0.16)",
                "success": "#7C9670", "warning": "#D2A359", "danger": "#B5523B",
            },
            "typography": {"display": "Bodoni Moda", "body": "Inter"},
            "radius": "2px", "density": "comfortable", "shadow": "soft",
        },
    },
    {
        "key": "sand_studio",
        "label": "Sand Studio",
        "description": "Sabbia mediterranea · Playfair × Outfit",
        "vibe_tags": ["light", "sand", "warm", "mediterranean", "earthy"],
        "sort_order": 170,
        "is_default": False,
        "theme": {
            "mode": "light",
            "palette": {
                "primary": "#A88260", "secondary": "#C2A084", "accent": "#DFC8AE",
                "background": "#F6EDDF", "surface": "#FFFFFF",
                "text_primary": "#3A2A1C", "text_secondary": "#7A6650",
                "border": "rgba(168,130,96,0.16)",
                "success": "#7C9670", "warning": "#D2A359", "danger": "#B5523B",
            },
            "typography": {"display": "Playfair Display", "body": "Outfit"},
            "radius": "4px", "density": "spacious", "shadow": "soft",
        },
    },
    {
        "key": "lavender_editorial",
        "label": "Lavender Editorial",
        "description": "Lavanda chiara · DM Serif × Plus Jakarta Sans",
        "vibe_tags": ["light", "purple", "soft", "editorial", "fresh"],
        "sort_order": 175,
        "is_default": False,
        "theme": {
            "mode": "light",
            "palette": {
                "primary": "#8B6FA8", "secondary": "#A990BF", "accent": "#D4C2E0",
                "background": "#F7F2F9", "surface": "#FFFFFF",
                "text_primary": "#2D2236", "text_secondary": "#6B5A78",
                "border": "rgba(139,111,168,0.16)",
                "success": "#7C9670", "warning": "#D2A359", "danger": "#B5523B",
            },
            "typography": {"display": "DM Serif Display", "body": "Plus Jakarta Sans"},
            "radius": "3px", "density": "comfortable", "shadow": "soft",
        },
    },
    {
        "key": "marble_atelier",
        "label": "Marble Atelier",
        "description": "Marmo di Carrara · Fraunces × Inter Tight",
        "vibe_tags": ["light", "marble", "neutral", "luxury", "architectural"],
        "sort_order": 180,
        "is_default": False,
        "theme": {
            "mode": "light",
            "palette": {
                "primary": "#5A6068", "secondary": "#7A828C", "accent": "#B8BFC7",
                "background": "#F4F4F2", "surface": "#FFFFFF",
                "text_primary": "#1F2226", "text_secondary": "#5A6168",
                "border": "rgba(90,96,104,0.14)",
                "success": "#7C9670", "warning": "#D2A359", "danger": "#B5523B",
            },
            "typography": {"display": "Fraunces", "body": "Inter Tight"},
            "radius": "2px", "density": "comfortable", "shadow": "soft",
        },
    },
    # ─── 12 SCURI EDITORIALI ──────────────────────────────────────────
    {
        "key": "graphite_atelier",
        "label": "Graphite Atelier",
        "description": "Grafite istituzionale · Playfair × Inter",
        "vibe_tags": ["dark", "neutral", "editorial", "luxury"],
        "sort_order": 200,
        "is_default": False,
        "theme": {
            "mode": "dark",
            "palette": {
                "primary": "#C9A36E", "secondary": "#D9BE91", "accent": "#E7CFB0",
                "background": "#0F0F10", "surface": "#16171A",
                "text_primary": "#EFEBE4", "text_secondary": "#A19D98",
                "border": "rgba(255,255,255,0.06)",
                "success": "#79C7A0", "warning": "#D2A359", "danger": "#CA6A7C",
            },
            "typography": {"display": "Playfair Display", "body": "Inter"},
            "radius": "2px", "density": "comfortable", "shadow": "soft",
        },
    },
    {
        "key": "obsidian_cyan",
        "label": "Obsidian Cyan",
        "description": "Vetro vulcanico · Bodoni × Manrope",
        "vibe_tags": ["dark", "cyan", "editorial", "tech"],
        "sort_order": 210,
        "is_default": False,
        "theme": {
            "mode": "dark",
            "palette": {
                "primary": "#00C9B3", "secondary": "#33DCC6", "accent": "#7EE6DA",
                "background": "#0A0A0C", "surface": "#121215",
                "text_primary": "#F3F2EF", "text_secondary": "#A8A6A1",
                "border": "rgba(255,255,255,0.07)",
                "success": "#22C55E", "warning": "#F59E0B", "danger": "#EF4444",
            },
            "typography": {"display": "Bodoni Moda", "body": "Manrope"},
            "radius": "2px", "density": "comfortable", "shadow": "soft",
        },
    },
    {
        "key": "midnight_blue",
        "label": "Midnight Blue",
        "description": "Notte profonda · Cormorant × Outfit",
        "vibe_tags": ["dark", "blue", "cinema", "luxury"],
        "sort_order": 220,
        "is_default": False,
        "theme": {
            "mode": "dark",
            "palette": {
                "primary": "#7AA8E0", "secondary": "#A0C0E8", "accent": "#C9A36E",
                "background": "#0A0F1A", "surface": "#10182A",
                "text_primary": "#E8ECF5", "text_secondary": "#9AA2B5",
                "border": "rgba(180,200,255,0.08)",
                "success": "#79C7A0", "warning": "#E0C088", "danger": "#CA6A7C",
            },
            "typography": {"display": "Cormorant Garamond", "body": "Outfit"},
            "radius": "3px", "density": "comfortable", "shadow": "soft",
        },
    },
    {
        "key": "deep_forest",
        "label": "Deep Forest",
        "description": "Foresta profonda · EB Garamond × Inter",
        "vibe_tags": ["dark", "green", "organic", "earthy"],
        "sort_order": 230,
        "is_default": False,
        "theme": {
            "mode": "dark",
            "palette": {
                "primary": "#79C7A0", "secondary": "#9DD8B7", "accent": "#C9A36E",
                "background": "#0C1411", "surface": "#142020",
                "text_primary": "#E6F0EA", "text_secondary": "#9AB0A6",
                "border": "rgba(180,220,200,0.08)",
                "success": "#79C7A0", "warning": "#E0C088", "danger": "#CA6A7C",
            },
            "typography": {"display": "EB Garamond", "body": "Inter"},
            "radius": "3px", "density": "comfortable", "shadow": "soft",
        },
    },
    {
        "key": "aubergine_couture",
        "label": "Aubergine Couture",
        "description": "Melanzana raffinata · Playfair × Montserrat",
        "vibe_tags": ["dark", "purple", "couture", "elegant"],
        "sort_order": 240,
        "is_default": False,
        "theme": {
            "mode": "dark",
            "palette": {
                "primary": "#9C7AC9", "secondary": "#B999D8", "accent": "#C9A36E",
                "background": "#120D18", "surface": "#1C1525",
                "text_primary": "#EEE7F3", "text_secondary": "#A799B0",
                "border": "rgba(220,200,255,0.08)",
                "success": "#79C7A0", "warning": "#E0C088", "danger": "#CA6A7C",
            },
            "typography": {"display": "Playfair Display", "body": "Montserrat"},
            "radius": "2px", "density": "comfortable", "shadow": "soft",
        },
    },
    {
        "key": "burgundy_serale",
        "label": "Burgundy Serale",
        "description": "Bordeaux couture · Cormorant × Outfit",
        "vibe_tags": ["dark", "red", "couture", "warm"],
        "sort_order": 250,
        "is_default": False,
        "theme": {
            "mode": "dark",
            "palette": {
                "primary": "#CA6A7C", "secondary": "#DA8C9A", "accent": "#E0C088",
                "background": "#170B0E", "surface": "#23131A",
                "text_primary": "#F1E4E6", "text_secondary": "#B59298",
                "border": "rgba(255,180,200,0.08)",
                "success": "#79C7A0", "warning": "#E0C088", "danger": "#CA6A7C",
            },
            "typography": {"display": "Cormorant Garamond", "body": "Outfit"},
            "radius": "3px", "density": "comfortable", "shadow": "soft",
        },
    },
    {
        "key": "cobalt_editoriale",
        "label": "Cobalt Editoriale",
        "description": "Cobalto profondo · Bodoni × Inter",
        "vibe_tags": ["dark", "blue", "editorial", "strong"],
        "sort_order": 260,
        "is_default": False,
        "theme": {
            "mode": "dark",
            "palette": {
                "primary": "#5A8FE5", "secondary": "#7CA7EC", "accent": "#E0C088",
                "background": "#080D1F", "surface": "#0E1530",
                "text_primary": "#E6EAF7", "text_secondary": "#909CC4",
                "border": "rgba(150,180,255,0.10)",
                "success": "#79C7A0", "warning": "#E0C088", "danger": "#CA6A7C",
            },
            "typography": {"display": "Bodoni Moda", "body": "Inter"},
            "radius": "2px", "density": "comfortable", "shadow": "sharp",
        },
    },
    {
        "key": "espresso_oro",
        "label": "Espresso Oro",
        "description": "Caffè torrefatto · Playfair × Manrope",
        "vibe_tags": ["dark", "brown", "warm", "luxury"],
        "sort_order": 270,
        "is_default": False,
        "theme": {
            "mode": "dark",
            "palette": {
                "primary": "#D9A86A", "secondary": "#E6BD88", "accent": "#A0C0B0",
                "background": "#100C09", "surface": "#1A1411",
                "text_primary": "#F2EAD9", "text_secondary": "#B2A284",
                "border": "rgba(230,200,160,0.10)",
                "success": "#79C7A0", "warning": "#D9A86A", "danger": "#CA6A7C",
            },
            "typography": {"display": "Playfair Display", "body": "Manrope"},
            "radius": "3px", "density": "comfortable", "shadow": "soft",
        },
    },
    {
        "key": "pine_ink",
        "label": "Pine Ink",
        "description": "Inchiostro pino · EB Garamond × Outfit",
        "vibe_tags": ["dark", "green", "ink", "editorial"],
        "sort_order": 280,
        "is_default": False,
        "theme": {
            "mode": "dark",
            "palette": {
                "primary": "#4FB58A", "secondary": "#72C5A1", "accent": "#D9A86A",
                "background": "#0A1310", "surface": "#101E18",
                "text_primary": "#E4ECE5", "text_secondary": "#90A29A",
                "border": "rgba(180,220,200,0.08)",
                "success": "#79C7A0", "warning": "#E0C088", "danger": "#CA6A7C",
            },
            "typography": {"display": "EB Garamond", "body": "Outfit"},
            "radius": "2px", "density": "comfortable", "shadow": "soft",
        },
    },
    {
        "key": "noir_assoluto",
        "label": "Noir Assoluto",
        "description": "Nero monocromia · Bodoni × Inter",
        "vibe_tags": ["dark", "monochrome", "minimal", "luxury"],
        "sort_order": 290,
        "is_default": False,
        "theme": {
            "mode": "dark",
            "palette": {
                "primary": "#E8DCC4", "secondary": "#F0E6D2", "accent": "#A88B5A",
                "background": "#050507", "surface": "#0C0C0E",
                "text_primary": "#F0EFEC", "text_secondary": "#9A9893",
                "border": "rgba(255,255,255,0.05)",
                "success": "#79C7A0", "warning": "#E0C088", "danger": "#CA6A7C",
            },
            "typography": {"display": "Bodoni Moda", "body": "Inter"},
            "radius": "0px", "density": "spacious", "shadow": "sharp",
        },
    },
    {
        "key": "slate_quiet",
        "label": "Slate Quiet",
        "description": "Ardesia silenziosa · Cormorant × Manrope",
        "vibe_tags": ["dark", "neutral", "calm", "minimal"],
        "sort_order": 300,
        "is_default": False,
        "theme": {
            "mode": "dark",
            "palette": {
                "primary": "#88c0d0", "secondary": "#A8D2DC", "accent": "#C9A36E",
                "background": "#0F1418", "surface": "#171E24",
                "text_primary": "#E6EBF0", "text_secondary": "#94A0AC",
                "border": "rgba(200,220,240,0.07)",
                "success": "#79C7A0", "warning": "#E0C088", "danger": "#CA6A7C",
            },
            "typography": {"display": "Cormorant Garamond", "body": "Manrope"},
            "radius": "3px", "density": "comfortable", "shadow": "soft",
        },
    },
    {
        "key": "carbon_neutral",
        "label": "Carbon Neutral",
        "description": "Carbonio sobrio · Playfair × Inter",
        "vibe_tags": ["dark", "neutral", "tech", "editorial"],
        "sort_order": 310,
        "is_default": False,
        "theme": {
            "mode": "dark",
            "palette": {
                "primary": "#CDD3DC", "secondary": "#DDE2E9", "accent": "#88c0d0",
                "background": "#101113", "surface": "#181A1D",
                "text_primary": "#E6E8EC", "text_secondary": "#969AA2",
                "border": "rgba(255,255,255,0.06)",
                "success": "#79C7A0", "warning": "#E0C088", "danger": "#CA6A7C",
            },
            "typography": {"display": "Playfair Display", "body": "Inter"},
            "radius": "2px", "density": "comfortable", "shadow": "sharp",
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
