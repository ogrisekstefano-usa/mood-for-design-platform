"""Seed Designer Personas™ — round-robin assignment pool.

Idempotent: re-running this script restores the 3 editorial personas
(Elizabeth, Diego, Sofia) plus refreshes the avatar_url for the 3 real
profiles already in MOOD Demo Studio.

The 3 personas have NO auth credentials — they exist purely in
users_profile to populate `pickDesigner()` round-robin on Relations
cards. Avatars are public Unsplash portraits.

Run:
  python3 /app/backend/scripts/seed_designer_personas.py
"""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database import db

TENANT_SLUG = "studio"   # MOOD Demo Showroom (the actual demo tenant)

# Editorial Unsplash avatars — luxury portraits, neutral background.
PERSONAS = [
    {
        "id": "a0000001-c001-4001-8001-000000000001",
        "first_name": "Elizabeth",
        "last_name":  "Whitcomb",
        "email":      "elizabeth.whitcomb@personas.mood-demo.local",
        "role":       "designer",
        "role_label": "Lead Designer",
        "avatar_url": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80&auto=format&fit=crop",
        "short_bio":  "Curo l'arco emotivo del progetto, dalla prima conversazione alla consegna.",
        "metadata":   {"online_status": "available", "roundrobin_slot": 0, "languages": ["it","en-GB","fr"]},
    },
    {
        "id": "a0000001-c001-4001-8001-000000000002",
        "first_name": "Diego",
        "last_name":  "Marín",
        "email":      "diego.marin@personas.mood-demo.local",
        "role":       "designer",
        "role_label": "Senior Architect",
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80&auto=format&fit=crop",
        "short_bio":  "Architettura e materiali. Disegno volumi che reggono nel tempo.",
        "metadata":   {"online_status": "available", "roundrobin_slot": 1, "languages": ["it","es","en-US"]},
    },
    {
        "id": "a0000001-c001-4001-8001-000000000003",
        "first_name": "Sofia",
        "last_name":  "Rinaldi",
        "email":      "sofia.rinaldi@personas.mood-demo.local",
        "role":       "designer",
        "role_label": "Materials Curator",
        "avatar_url": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80&auto=format&fit=crop",
        "short_bio":  "Sceglio i materiali come si sceglie una poesia.",
        "metadata":   {"online_status": "away", "roundrobin_slot": 2, "languages": ["it","en-US","fr"]},
    },
]

# Real profiles already in MOOD Demo Studio — refresh avatar_url with
# stable Unsplash portraits (the previous Supabase URL returned 400).
REAL_PROFILES_AVATAR = {
    # Designer Studio
    "6cab5a1e-a0e9-4dc7-a561-c75179f2c778":
        "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80&auto=format&fit=crop",
    # Demo Studio (tenant_admin)
    "c3b5c672-1255-48de-b0e0-1bb57e4b1386":
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80&auto=format&fit=crop",
    # Stefano Ogrisek (super_admin · founder) — replace broken URL
    "caee7b92-34b4-4ecf-bdaa-8a3eda93a70e":
        "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&q=80&auto=format&fit=crop",
}


def main():
    client = db()
    # Resolve tenant id from slug.
    res = client.table('tenants').select('id').eq('slug', TENANT_SLUG).execute()
    if not res.data:
        print(f"❌ Tenant '{TENANT_SLUG}' not found"); sys.exit(1)
    tenant_id = res.data[0]['id']
    print(f"→ Tenant: {tenant_id}")

    # 1. Refresh avatars on existing real profiles.
    for pid, url in REAL_PROFILES_AVATAR.items():
        try:
            client.table('users_profile').update({'avatar_url': url}).eq('id', pid).execute()
            print(f"  ✓ refreshed avatar for {pid[:8]}")
        except Exception as e:
            print(f"  ⚠ skip {pid[:8]}: {e}")

    # 2. Upsert 3 personas.
    for p in PERSONAS:
        row = {
            "id":          p["id"],
            "tenant_id":   tenant_id,
            "first_name":  p["first_name"],
            "last_name":   p["last_name"],
            "email":       p["email"],
            "role":        p["role"],
            "role_label":  p["role_label"],
            "avatar_url":  p["avatar_url"],
            "short_bio":   p["short_bio"],
            "metadata_json": p["metadata"],
        }
        # Check existence first to choose insert vs update (avoid auth_user_id NOT NULL).
        existing = client.table('users_profile').select('id').eq('id', p['id']).execute()
        try:
            if existing.data:
                client.table('users_profile').update(row).eq('id', p['id']).execute()
                print(f"  ↻ updated persona {p['first_name']} {p['last_name']}")
            else:
                client.table('users_profile').insert(row).execute()
                print(f"  + inserted persona {p['first_name']} {p['last_name']}")
        except Exception as e:
            print(f"  ⚠ persona {p['first_name']}: {e}")

    print("\n✅ seed complete · roster ready for Designer Presence™")


if __name__ == "__main__":
    main()
