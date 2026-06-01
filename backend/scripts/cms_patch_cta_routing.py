"""
CMS CTA Re-routing Patch
═══════════════════════════════════════════════════════════════════════
Aggiorna i `links` settings nelle `cms_sections` per allineare i CTA
pubblici al nuovo lifecycle:

  Funnel di attivazione  → /studio    (Candida il tuo studio, Attiva Blueprint™)
  Dialogo Advisor        → /supporto  (Parlane con un Advisor)

Tutti i CTA che puntavano a `/dedicato-a` (legacy) e ai percorsi
legacy `/begin-journey`, `/professional-access` vengono riallineati.

Idempotente — re-runnable. Single transaction.
"""
import os
import json
import psycopg2
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')
DATABASE_URL = os.environ.get('SESSION_POOLER_URL') or os.environ.get('DATABASE_URL')

# Each entry: (section_id, links_override)
PATCHES = [
    # Pricing — explicit user directive
    ('a03d6736-10e2-460c-93ec-07b5630f17de', {  # pricing/page_intro
        'cta_href': '/studio'
    }),
    ('94e3aebd-3b84-4190-a95a-94ec67595529', {  # pricing/pricing_tiers_editorial
        'tier_01_href': '/supporto',
        'tier_02_href': '/supporto',
        'tier_03_href': '/supporto',
        'tier_04_href': '/supporto',  # legacy tier 4 (per TIER_NAMING tier_04 not previewed)
        'tier_05_href': '/supporto',  # legacy tier 5
    }),

    # Features — CTA "Candida il tuo studio" (hero + intro)
    ('d49ece95-c4f7-4bc8-80e8-8cd49bd2d02d', {  # features/feature_hero_split
        'cta_href': '/studio'
    }),
    ('88e3f6e9-16a0-41ca-b513-c9ba1eaa5152', {  # features/page_intro
        'cta_href': '/studio'
    }),

    # Support / Training / Login — cleanup legacy /dedicato-a
    ('729d11b3-204d-4e35-8b77-ce51e2242b49', {  # support/page_intro
        'cta_href': '/studio'
    }),
    ('dca880a8-022a-44e5-ba09-aaa7ab0aedda', {  # training/page_intro
        'cta_href': '/studio'
    }),
    ('b9e8b80c-4b83-425f-ad92-cb2af7f484fe', {  # login/page_intro
        'cta_href': '/studio'
    }),

    # Home final CTA — replace legacy /begin-journey and /professional-access
    ('20b8e610-65da-507e-9681-8e2acfc13f0b', {  # home/final_cta_immersive
        'cta_primary_href':   '/studio',
        'cta_secondary_href': '/accedi',
    }),
]


def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    changes = []
    try:
        for sid, override in PATCHES:
            cur.execute("SELECT settings FROM cms_sections WHERE id=%s", (sid,))
            row = cur.fetchone()
            if not row:
                print(f"  ⚠ section {sid} not found, skipping")
                continue
            settings = row[0] or {}
            old_links = dict(settings.get('links') or {})
            new_links = dict(old_links)
            new_links.update(override)
            if new_links == old_links:
                print(f"  - {sid}: no change (idempotent skip)")
                continue
            settings['links'] = new_links
            cur.execute("UPDATE cms_sections SET settings=%s, updated_at=now() WHERE id=%s",
                        (json.dumps(settings), sid))
            changes.append({'section': sid, 'old': old_links, 'new': new_links})
            print(f"  ✓ {sid}: {old_links} → {new_links}")
        conn.commit()
    finally:
        cur.close()
        conn.close()
    print(f"\nSections patched: {len(changes)}")


if __name__ == '__main__':
    main()
