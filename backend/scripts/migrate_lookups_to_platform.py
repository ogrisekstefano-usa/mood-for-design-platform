"""Phase R-MARKET-1A — Migrate CRM-core lookups to platform level + seed markets.

  cd /app/backend && python3 scripts/migrate_lookups_to_platform.py

Idempotent: re-running is safe. Splits relationship_lookups into:
  • PLATFORM scope (tenant_id IS NULL) — CRM-core groups (canonical MOOD workflow).
  • TENANT scope — stylistic groups only (style, material, atmosphere,
    budget_range, timing_range, room_type, project_category).

The CRM-core groups become read-only canonical terminology. Existing
tenant duplicates are removed AFTER the platform rows are populated, so
the API keeps responding without downtime.
"""
import sys, uuid
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv(ROOT / '.env')
from database import db


def _iso(): return datetime.now(timezone.utc).isoformat()


# Canonical platform-level CRM terminology — 9 groups.
PLATFORM_GROUPS = {
    'lifecycle_stage', 'account_type', 'source', 'interaction_type',
    'action_type', 'priority', 'visibility_level', 'relationship_health',
    'communication_preference',
}

# Stylistic groups stay tenant-customisable.
TENANT_GROUPS = {
    'style', 'material', 'atmosphere', 'budget_range', 'timing_range',
    # 'room_type', 'project_category' (will be added in future phases)
}


def migrate_lookups(c):
    """Move CRM-core groups from tenant-scope to platform-scope.

    Strategy:
      1. Pick the demo tenant's rows as the canonical source (already seeded
         with 6 BCP-47 locales + color metadata by seed_relationship_lookups.py).
      2. Insert them as scope='platform', tenant_id=NULL.
      3. Delete the per-tenant duplicates for these CRM-core groups.
      4. Leave stylistic groups untouched (they remain scope='tenant').
    """
    # Step 1 — find demo tenant.
    demo = (c.table('tenants').select('id')
            .eq('slug', 'mood-demo-studio-81a09e').limit(1).execute().data or [])
    if not demo:
        raise SystemExit('demo tenant missing — run seed_relationship_lookups.py first')
    demo_id = demo[0]['id']

    # Step 2 — for each CRM-core group, copy demo rows to platform scope.
    inserted = 0
    for group in sorted(PLATFORM_GROUPS):
        src_rows = (c.table('relationship_lookups').select('*')
                    .eq('tenant_id', demo_id).eq('group_key', group)
                    .order('sort_order').execute().data or [])
        if not src_rows:
            print(f'  ⚠ group={group} has no rows in demo tenant — skipping')
            continue

        for row in src_rows:
            existing = (c.table('relationship_lookups').select('id')
                        .is_('tenant_id', 'null').eq('scope', 'platform')
                        .eq('group_key', group).eq('value_key', row['value_key'])
                        .limit(1).execute().data or [])
            payload = {
                'tenant_id':   None,
                'scope':       'platform',
                'group_key':   group,
                'value_key':   row['value_key'],
                'label':       row['label'],
                'sort_order':  row['sort_order'],
                'active':      row['active'],
                'metadata':    row.get('metadata') or {},
                'updated_at':  _iso(),
            }
            if existing:
                c.table('relationship_lookups').update(payload).eq('id', existing[0]['id']).execute()
            else:
                payload['id'] = str(uuid.uuid4())
                payload['created_at'] = _iso()
                c.table('relationship_lookups').insert(payload).execute()
                inserted += 1
        print(f'  ✓ platform group={group} → {len(src_rows)} canonical values')

    print(f'  → {inserted} new platform rows inserted')

    # Step 3 — delete tenant-scoped duplicates of CRM-core groups for ALL tenants.
    deleted_total = 0
    for group in sorted(PLATFORM_GROUPS):
        rows = (c.table('relationship_lookups')
                .delete()
                .eq('scope', 'tenant')
                .eq('group_key', group)
                .execute().data or [])
        deleted_total += len(rows)
    print(f'  → {deleted_total} tenant-scope duplicates removed')

    # Step 4 — ensure stylistic groups stay tenant-scope with scope='tenant'.
    for group in sorted(TENANT_GROUPS):
        rows = (c.table('relationship_lookups').select('id,tenant_id,scope')
                .eq('group_key', group).execute().data or [])
        to_fix = [r for r in rows if r.get('scope') != 'tenant' or not r.get('tenant_id')]
        for r in to_fix:
            c.table('relationship_lookups').update({'scope': 'tenant'}).eq('id', r['id']).execute()
        print(f'  ✓ tenant group={group}: {len(rows)} rows ({len(to_fix)} corrected)')


def main():
    c = db()
    print('Phase R-MARKET-1A — lookups split')
    migrate_lookups(c)
    print('✓ migration complete')


if __name__ == '__main__':
    main()
