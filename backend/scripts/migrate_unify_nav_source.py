"""
HEADER UNIFICATION — Fase 0.5 (Zero Hardcoded Policy enforcement)

Migrates ALL nav sources into a SINGLE canonical CMS section: `nav_top`.

Operations:
  1. For every tenant, merge `branding_settings.public_nav.main_links` and
     legacy `cms_sections.main_links` into `cms_sections.nav_top.settings.links`.
     The merger preserves order and dedupes by `id`/`href` pair. Existing
     `nav_top.links` are kept as authoritative (admin already edited them).
  2. Drop legacy `cms_sections.main_links` rows (deprecated).
  3. Strip `branding_settings.public_nav.main_links` from the tenant record
     while keeping the rest of `public_nav` (`show_login`, `login_label`, etc).
     Those still belong to Brand Studio's "login pill" identity surface for
     now — separate concern.
  4. Bumps `cms_pages.navigation.updated_at` so the published_revision_id
     becomes stale; the next view triggers legacy_live mode (always live).

Idempotent. Safe to re-run.

Usage:
    python /app/backend/scripts/migrate_unify_nav_source.py
"""
import os, json
import psycopg2, psycopg2.extras
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')


def normalize_link(lk: dict) -> dict:
    """Normalize a link record across legacy shapes."""
    out = {}
    out['id']    = lk.get('id') or (lk.get('href') or '').strip('/').replace('/', '-') or 'link'
    out['href']  = lk.get('href') or '/'
    label = lk.get('label') or lk.get('label_i18n') or {}
    if isinstance(label, str):
        label = {'en-US': label}
    # Promote legacy 2-letter keys to BCP-47 where unambiguous so the frontend
    # picker works without a fallback chain mismatch.
    promo = {'it': 'it-IT', 'en': 'en-US', 'fr': 'fr-FR', 'de': 'de-DE', 'es': 'es-ES', 'ae': 'ar-AE'}
    norm_label = {}
    for k, v in (label or {}).items():
        if not v:
            continue
        norm_label[promo.get(k, k)] = v
    out['label_i18n'] = norm_label
    out['visible']    = bool(lk.get('visible', True))
    out['target']     = lk.get('target') or '_self'
    return out


def merge_links(primary: list, secondary: list) -> list:
    """Primary wins on id/href clashes; otherwise append secondary."""
    seen = set()
    out = []
    for lk in primary or []:
        n = normalize_link(lk)
        key = (n['id'], n['href'])
        if key in seen:
            continue
        seen.add(key)
        out.append(n)
    for lk in secondary or []:
        n = normalize_link(lk)
        key = (n['id'], n['href'])
        if key in seen:
            continue
        seen.add(key)
        out.append(n)
    return out


def main():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute("SELECT id, slug, branding_settings FROM tenants")
    tenants = cur.fetchall()
    print(f"Found {len(tenants)} tenants to audit.")

    for tenant_id, slug, branding in tenants:
        print(f"\n--- Tenant: {slug} ({tenant_id}) ---")
        branding = branding or {}

        # 1. Locate navigation page
        cur.execute("SELECT id FROM cms_pages WHERE tenant_id=%s AND page_key='navigation'", (tenant_id,))
        np = cur.fetchone()
        if not np:
            print("  no navigation page — skipping")
            continue
        nav_page_id = np[0]

        # 2. Fetch all nav source candidates
        cur.execute("""SELECT id, section_type, settings FROM cms_sections
                       WHERE page_id=%s AND section_type IN ('nav_top','main_links','navigation_main')
                       ORDER BY CASE section_type WHEN 'nav_top' THEN 0 WHEN 'navigation_main' THEN 1 ELSE 2 END,
                                sort_order""",
                    (nav_page_id,))
        rows = cur.fetchall()

        nav_top_row = next((r for r in rows if r[1] == 'nav_top'), None)
        legacy_rows = [r for r in rows if r[1] != 'nav_top']
        legacy_links = []
        for _, _, settings in legacy_rows:
            legacy_links += (settings or {}).get('links') or []
        public_nav_links = ((branding.get('public_nav') or {}).get('main_links')) or []

        # 3. Merge — canonical: nav_top wins, then legacy main_links, then public_nav
        canonical_existing = ((nav_top_row[2] if nav_top_row else {}) or {}).get('links') or []
        merged = merge_links(canonical_existing, legacy_links + public_nav_links)
        print(f"  links — canonical={len(canonical_existing)}, legacy={len(legacy_links)}, branding={len(public_nav_links)} → merged={len(merged)}")

        # 4. Persist canonical
        if nav_top_row:
            sid, _, settings = nav_top_row
            new_settings = dict(settings or {})
            new_settings['links'] = merged
            cur.execute("UPDATE cms_sections SET settings=%s::jsonb, updated_at=NOW() WHERE id=%s",
                        (psycopg2.extras.Json(new_settings), sid))
            print(f"  [update] nav_top.settings.links = {len(merged)}")
        else:
            import uuid as _uuid
            cur.execute("""INSERT INTO cms_sections
                (id, tenant_id, page_id, section_type, sort_order, visible, locale_content, settings, created_at, updated_at)
                VALUES (%s,%s,%s,'nav_top',0,TRUE,'{}'::jsonb,%s::jsonb,NOW(),NOW())""",
                (str(_uuid.uuid4()), tenant_id, nav_page_id, psycopg2.extras.Json({'links': merged})))
            print(f"  [insert] nav_top with {len(merged)} links")

        # 5. Drop legacy sections (main_links, navigation_main)
        for sid, st, _ in legacy_rows:
            cur.execute("DELETE FROM cms_sections WHERE id=%s", (sid,))
            print(f"  [delete] legacy section {st}/{sid}")

        # 6. Strip main_links from branding_settings.public_nav (keep the rest)
        if branding.get('public_nav') and isinstance(branding['public_nav'], dict) and 'main_links' in branding['public_nav']:
            new_branding = {**branding}
            new_pn = {k: v for k, v in (branding['public_nav'] or {}).items() if k != 'main_links'}
            new_branding['public_nav'] = new_pn
            cur.execute("UPDATE tenants SET branding_settings=%s::jsonb, updated_at=NOW() WHERE id=%s",
                        (psycopg2.extras.Json(new_branding), tenant_id))
            print("  [strip] branding_settings.public_nav.main_links")

        # 7. Invalidate the navigation page revision so live reads canonical
        cur.execute("""UPDATE cms_pages SET published_revision_id=NULL, updated_at=NOW()
                       WHERE id=%s""", (nav_page_id,))
        print("  [refresh] navigation page revision cleared")

    cur.close()
    conn.close()
    print("\nDONE — single source of truth for nav: cms_sections.nav_top")


if __name__ == '__main__':
    main()
