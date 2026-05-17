"""Phase R-CRM-1 — Migrate existing leads → Relationship CRM.

Idempotent. For each lead in the legacy `leads` table:
  1. Create an Account (account_type inferred from lead_type)
  2. Create the primary Contact
  3. Create an initial 'web_lead_generation' interaction stamped with the
     lead's created_at — so the timeline carries the full history.
  4. Stamp `accounts.legacy_lead_id` so re-runs skip duplicates.

Run: cd /app/backend && python3 scripts/migrate_leads_to_relationships.py
"""
import sys, uuid
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from datetime import datetime, timezone
from database import db


def _iso(): return datetime.now(timezone.utc).isoformat()


_STAGE_MAP = {
    'new':         'new_inquiry',
    'contacted':   'lead',
    'qualified':   'prospect',
    'discovery':   'discovery',
    'in_project':  'active_project',
    'completed':   'existing_client',
    'won':         'existing_client',
    'lost':        'archived',
    'archived':    'archived',
}
_TYPE_MAP = {
    'private':       'private_client',
    'private_client':'private_client',
    'professional':  'architecture_studio',
    'architect':     'architecture_studio',
    'designer':      'interior_design_studio',
    'studio':        'architecture_studio',
    'developer':     'developer',
    'hospitality':   'hospitality_group',
    'partner':       'partner_ad',
    'b2b':           'company',
}


def main():
    c = db()
    total = c.table('leads').select('id', count='exact').execute().count or 0
    print(f'→ scanning {total} legacy leads')

    page, BATCH = 0, 200
    created, skipped = 0, 0
    while True:
        rows = (c.table('leads').select('*')
                .order('created_at')
                .range(page * BATCH, (page + 1) * BATCH - 1)
                .execute().data or [])
        if not rows: break

        for lead in rows:
            # Skip if already migrated
            existing = (c.table('accounts').select('id')
                        .eq('tenant_id', lead['tenant_id'])
                        .eq('legacy_lead_id', lead['id']).limit(1).execute().data or [])
            if existing:
                skipped += 1
                continue

            first = (lead.get('first_name') or '').strip()
            last  = (lead.get('last_name')  or '').strip()
            full_name = (f"{first} {last}".strip()
                         or lead.get('email')
                         or 'Senza nome')
            account_type = _TYPE_MAP.get(
                (lead.get('lead_type') or '').lower(), 'private_client')
            # Private clients get the family name; professionals get the
            # studio meta first if present.
            if account_type == 'private_client':
                account_name = (f"Famiglia {last}".strip()
                                if last else full_name)
            else:
                meta = lead.get('metadata_json') or {}
                account_name = (meta.get('studio_name')
                                or meta.get('company_name')
                                or f"{last} {first}".strip()
                                or full_name)

            aid = str(uuid.uuid4())
            c.table('accounts').insert({
                'id':               aid,
                'tenant_id':        lead['tenant_id'],
                'account_name':     account_name[:200],
                'account_type':     account_type,
                'lifecycle_stage':  _STAGE_MAP.get(
                    (lead.get('status') or '').lower(), 'new_inquiry'),
                'source':           (lead.get('source') or 'web_form').lower().replace(' ', '_'),
                'country':          lead.get('country'),
                'city':             lead.get('city'),
                'phone':            lead.get('phone'),
                'email':            lead.get('email'),
                'language':         lead.get('language'),
                'locale_code':      lead.get('locale_code'),
                'primary_owner_id': lead.get('assigned_to'),
                'relationship_score': lead.get('score'),
                'notes':            lead.get('notes'),
                'metadata_json':    lead.get('metadata_json') or {},
                'legacy_lead_id':   lead['id'],
                'created_at':       lead.get('created_at') or _iso(),
                'updated_at':       _iso(),
                'last_activity_at': lead.get('updated_at') or lead.get('created_at') or _iso(),
            }).execute()

            # Primary contact
            cid = str(uuid.uuid4())
            c.table('contacts').insert({
                'id':              cid,
                'tenant_id':       lead['tenant_id'],
                'account_id':      aid,
                'first_name':      first or full_name.split(' ')[0],
                'last_name':       last or None,
                'email':           lead.get('email'),
                'phone':           lead.get('phone'),
                'primary_contact': True,
                'communication_preference': 'email' if lead.get('email') else None,
                'created_at':      lead.get('created_at') or _iso(),
                'updated_at':      _iso(),
            }).execute()

            # Inception interaction — preserves the lead origin.
            c.table('interactions').insert({
                'id':               str(uuid.uuid4()),
                'tenant_id':        lead['tenant_id'],
                'account_id':       aid,
                'contact_id':       cid,
                'interaction_type': 'web_lead_generation',
                'occurred_at':      lead.get('created_at') or _iso(),
                'title':            'Project inquiry submitted',
                'summary':          lead.get('notes') or 'Lead imported from legacy lead pipeline.',
                'report_payload': {
                    'legacy_lead_id': lead['id'],
                    'project_type':   lead.get('project_type'),
                    'budget_range':   lead.get('budget_range'),
                    'timeline':       lead.get('timeline'),
                    'style_preference': lead.get('style_preference'),
                    'source':         lead.get('source'),
                },
                'is_automatic':     True,
                'created_at':       lead.get('created_at') or _iso(),
            }).execute()

            # Style profile seed if any preference exists
            if lead.get('style_preference') or lead.get('budget_range'):
                styles = []
                sp = lead.get('style_preference')
                if isinstance(sp, list):  styles = sp
                elif isinstance(sp, str): styles = [sp]
                c.table('account_style_profile').insert({
                    'account_id':       aid,
                    'tenant_id':        lead['tenant_id'],
                    'preferred_styles': styles,
                    'budget_range':     lead.get('budget_range'),
                    'timing_range':     lead.get('timeline'),
                    'updated_at':       _iso(),
                }).execute()

            created += 1
            if created % 25 == 0:
                print(f'   migrated {created}…')

        page += 1
        if len(rows) < BATCH:
            break

    print(f'\n✓ migration complete — created {created}, skipped {skipped} (already migrated)')


if __name__ == '__main__':
    main()
