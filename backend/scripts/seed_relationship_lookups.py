"""Phase R-CRM-1 — Seed Blueprint Command Center lookups + demo accounts.

Idempotent: re-running upserts by (tenant_id, group_key, value_key).

  cd /app/backend && python3 scripts/seed_relationship_lookups.py
"""
import sys, uuid
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from datetime import datetime, timezone
from database import db


def _iso(): return datetime.now(timezone.utc).isoformat()


TENANT_SLUG = 'mood-demo-studio-81a09e'


LOOKUPS = {
  'lifecycle_stage': [
    ('new_inquiry',     {'it': 'Nuova richiesta',     'en': 'New Inquiry'}),
    ('lead',            {'it': 'Lead',                'en': 'Lead'}),
    ('discovery',       {'it': 'Discovery',           'en': 'Discovery / Interview'}),
    ('prospect',        {'it': 'Prospect',            'en': 'Prospect'}),
    ('active_project',  {'it': 'Progetto attivo',     'en': 'Active Project'}),
    ('existing_client', {'it': 'Cliente esistente',   'en': 'Existing Client'}),
    ('repeat_client',   {'it': 'Cliente ricorrente',  'en': 'Repeat Client'}),
    ('partner_ad',      {'it': 'Partner / A&D',       'en': 'Partner / A&D'}),
    ('archived',        {'it': 'Archiviato',          'en': 'Archived'}),
  ],
  'account_type': [
    ('private_client',          {'it': 'Cliente privato',         'en': 'Private client / family'}),
    ('architecture_studio',     {'it': 'Studio di architettura',  'en': 'Architecture studio'}),
    ('interior_design_studio',  {'it': 'Studio interior',         'en': 'Interior design studio'}),
    ('furniture_client',        {'it': 'Cliente arredo',          'en': 'Furniture store client'}),
    ('developer',               {'it': 'Sviluppatore',            'en': 'Developer'}),
    ('contractor',              {'it': 'General contractor',      'en': 'Contractor'}),
    ('hospitality_group',       {'it': 'Gruppo hospitality',      'en': 'Hospitality group'}),
    ('company',                 {'it': 'Azienda',                 'en': 'Company'}),
    ('partner_ad',              {'it': 'Partner / A&D',           'en': 'Partner / A&D'}),
  ],
  'source': [
    ('web_form',          {'it': 'Form sito',              'en': 'Web form'}),
    ('showroom_visit',    {'it': 'Visita showroom',        'en': 'Showroom visit'}),
    ('incoming_call',     {'it': 'Telefonata in arrivo',   'en': 'Incoming call'}),
    ('whatsapp',          {'it': 'WhatsApp',               'en': 'WhatsApp'}),
    ('business_meeting',  {'it': 'Business meeting',       'en': 'Business meeting'}),
    ('event',             {'it': 'Evento',                 'en': 'Event'}),
    ('referral',          {'it': 'Referral',               'en': 'Referral'}),
    ('architect_referral',{'it': 'Referral architetto',    'en': 'Architect referral'}),
    ('social_lead',       {'it': 'Lead social',            'en': 'Social lead'}),
    ('manual_entry',      {'it': 'Inserimento manuale',    'en': 'Manual entry'}),
    ('existing_client_new', {'it': 'Cliente esistente — nuova richiesta', 'en': 'Existing client — new request'}),
  ],
  'interaction_type': [
    ('call',                  {'it': 'Telefonata',                'en': 'Call'}),
    ('email',                 {'it': 'Email',                     'en': 'Email'}),
    ('whatsapp',              {'it': 'WhatsApp',                  'en': 'WhatsApp'}),
    ('showroom_visit',        {'it': 'Visita in showroom',        'en': 'Showroom visit'}),
    ('external_visit',        {'it': 'Visita esterna',            'en': 'External visit'}),
    ('business_meeting',      {'it': 'Business meeting',          'en': 'Business meeting'}),
    ('event',                 {'it': 'Evento',                    'en': 'Event'}),
    ('casual_meeting',        {'it': 'Incontro informale',        'en': 'Casual meeting'}),
    ('discovery_interview',   {'it': 'Discovery interview',       'en': 'Discovery interview'}),
    ('follow_up',             {'it': 'Follow-up',                 'en': 'Follow-up'}),
    ('moodboard_sent',        {'it': 'Moodboard inviata',         'en': 'Moodboard sent'}),
    ('moodboard_viewed',      {'it': 'Moodboard visualizzata',    'en': 'Moodboard viewed'}),
    ('proposal_sent',         {'it': 'Proposta inviata',          'en': 'Proposal sent'}),
    ('proposal_opened',       {'it': 'Proposta aperta',           'en': 'Proposal opened'}),
    ('proposal_review',       {'it': 'Revisione proposta',        'en': 'Proposal review'}),
    ('material_selection',    {'it': 'Selezione materiali',       'en': 'Material selection'}),
    ('project_update',        {'it': 'Aggiornamento progetto',    'en': 'Project update'}),
    ('post_visit_report',     {'it': 'Report post-visita',        'en': 'Post-visit report'}),
    ('internal_note',         {'it': 'Nota interna',              'en': 'Internal note'}),
    ('voice_note',            {'it': 'Nota vocale',               'en': 'Voice note'}),
    ('ai_summary',            {'it': 'Sintesi AI',                'en': 'AI summary'}),
    ('web_lead_generation',   {'it': 'Lead da form',              'en': 'Web lead generation'}),
  ],
  'action_type': [
    ('call_back',           {'it': 'Richiama',                'en': 'Call back'}),
    ('send_email',          {'it': 'Invia email',             'en': 'Send email'}),
    ('send_moodboard',      {'it': 'Invia moodboard',         'en': 'Send moodboard'}),
    ('follow_up',           {'it': 'Follow-up',               'en': 'Follow-up'}),
    ('schedule_meeting',    {'it': 'Pianifica meeting',       'en': 'Schedule meeting'}),
    ('deliver_project',     {'it': 'Consegna progetto',       'en': 'Deliver project'}),
    ('deliver_moodboard',   {'it': 'Consegna moodboard',      'en': 'Deliver moodboard'}),
    ('material_deadline',   {'it': 'Scadenza materiali',      'en': 'Material deadline'}),
    ('proposal_feedback',   {'it': 'Feedback proposta',       'en': 'Proposal feedback'}),
    ('send_quote',          {'it': 'Invia preventivo',        'en': 'Send quote'}),
    ('review_needed',       {'it': 'Revisione necessaria',    'en': 'Review needed'}),
    ('no_activity_alert',   {'it': 'Allarme nessuna attività','en': 'No activity alert'}),
    ('engagement_alert',    {'it': 'Allarme engagement',      'en': 'Engagement alert'}),
  ],
  'priority': [
    ('low',     {'it': 'Bassa',    'en': 'Low'}),
    ('normal',  {'it': 'Normale',  'en': 'Normal'}),
    ('high',    {'it': 'Alta',     'en': 'High'}),
    ('urgent',  {'it': 'Urgente',  'en': 'Urgent'}),
  ],
  'budget_range': [
    ('under_50k',      {'it': '< 50k €',         'en': 'Under 50k'}),
    ('50_120k',        {'it': '50–120k €',       'en': '50–120k'}),
    ('120_250k',       {'it': '120–250k €',      'en': '120–250k'}),
    ('250_500k',       {'it': '250–500k €',      'en': '250–500k'}),
    ('500k_1m',        {'it': '500k – 1M €',     'en': '500k – 1M'}),
    ('over_1m',        {'it': '> 1M €',          'en': 'Over 1M'}),
  ],
  'timing_range': [
    ('immediate',      {'it': 'Immediato',           'en': 'Immediate'}),
    ('within_3m',      {'it': 'Entro 3 mesi',        'en': 'Within 3 months'}),
    ('within_6m',      {'it': 'Entro 6 mesi',        'en': 'Within 6 months'}),
    ('within_12m',     {'it': 'Entro 12 mesi',       'en': 'Within 12 months'}),
    ('exploratory',    {'it': 'Esplorativo',         'en': 'Exploratory'}),
  ],
  'style': [
    ('warm_minimalism',     {'it': 'Warm Minimalism',     'en': 'Warm Minimalism'}),
    ('contemporary_italian',{'it': 'Contemporary Italian','en': 'Contemporary Italian'}),
    ('mediterranean',       {'it': 'Mediterraneo',        'en': 'Mediterranean'}),
    ('japandi',             {'it': 'Japandi',             'en': 'Japandi'}),
    ('quiet_luxury',        {'it': 'Quiet Luxury',        'en': 'Quiet Luxury'}),
    ('soft_brutalism',      {'it': 'Soft Brutalism',      'en': 'Soft Brutalism'}),
    ('classic_contemporary',{'it': 'Classico contemporaneo','en': 'Classic Contemporary'}),
    ('organic_modern',      {'it': 'Organic Modern',      'en': 'Organic Modern'}),
  ],
  'material': [
    ('travertine', {'it': 'Travertino',  'en': 'Travertine'}),
    ('marble',     {'it': 'Marmo',       'en': 'Marble'}),
    ('walnut',     {'it': 'Noce',        'en': 'Walnut'}),
    ('oak',        {'it': 'Rovere',      'en': 'Oak'}),
    ('bronze',     {'it': 'Bronzo',      'en': 'Bronze'}),
    ('glass',      {'it': 'Vetro',       'en': 'Glass'}),
    ('stone',      {'it': 'Pietra',      'en': 'Stone'}),
    ('linen',      {'it': 'Lino',        'en': 'Linen'}),
    ('leather',    {'it': 'Pelle',       'en': 'Leather'}),
    ('terracotta', {'it': 'Terracotta',  'en': 'Terracotta'}),
    ('brass',      {'it': 'Ottone',      'en': 'Brass'}),
  ],
  'atmosphere': [
    ('warm',       {'it': 'Calda',       'en': 'Warm'}),
    ('calm',       {'it': 'Calma',       'en': 'Calm'}),
    ('sculptural', {'it': 'Scultorea',   'en': 'Sculptural'}),
    ('bright',     {'it': 'Luminosa',    'en': 'Bright'}),
    ('dramatic',   {'it': 'Drammatica',  'en': 'Dramatic'}),
    ('natural',    {'it': 'Naturale',    'en': 'Natural'}),
    ('refined',    {'it': 'Raffinata',   'en': 'Refined'}),
    ('hotel_like', {'it': 'Hotel',       'en': 'Hotel-like'}),
  ],
  'visibility_level': [
    ('full',             {'it': 'Accesso completo',    'en': 'Full access'}),
    ('crm_only',         {'it': 'Solo CRM',            'en': 'CRM only'}),
    ('moodboards_only',  {'it': 'Solo moodboard',      'en': 'Moodboards only'}),
    ('projects_only',    {'it': 'Solo progetti',       'en': 'Projects only'}),
    ('commercial_only',  {'it': 'Solo commerciale',    'en': 'Commercial only'}),
    ('read_only',        {'it': 'Sola lettura',        'en': 'Read only'}),
  ],
  'relationship_health': [
    ('excellent',        {'it': 'Eccellente',          'en': 'Excellent'}),
    ('healthy',          {'it': 'Salutare',            'en': 'Healthy'}),
    ('needs_attention',  {'it': 'Da seguire',          'en': 'Needs attention'}),
    ('at_risk',          {'it': 'A rischio',           'en': 'At risk'}),
    ('dormant',          {'it': 'Dormiente',           'en': 'Dormant'}),
  ],
}


def upsert(c, tenant_id, group_key, value_key, label, sort_order):
    existing = (c.table('relationship_lookups').select('id')
                .eq('tenant_id', tenant_id)
                .eq('group_key', group_key)
                .eq('value_key', value_key).limit(1).execute().data or [])
    row = {
        'tenant_id': tenant_id, 'group_key': group_key, 'value_key': value_key,
        'label': label, 'sort_order': sort_order, 'active': True,
        'updated_at': _iso(),
    }
    if existing:
        c.table('relationship_lookups').update(row).eq('id', existing[0]['id']).execute()
    else:
        row['id'] = str(uuid.uuid4())
        row['created_at'] = _iso()
        c.table('relationship_lookups').insert(row).execute()


def main():
    c = db()
    t = c.table('tenants').select('id').eq('slug', TENANT_SLUG).limit(1).execute().data
    if not t:
        raise SystemExit(f'tenant {TENANT_SLUG} missing')
    tid = t[0]['id']
    total = 0
    for group_key, items in LOOKUPS.items():
        for i, (value_key, label) in enumerate(items):
            upsert(c, tid, group_key, value_key, label, i)
            total += 1
    print(f'✓ seeded {total} lookup values across {len(LOOKUPS)} groups for tenant {TENANT_SLUG}')


if __name__ == '__main__':
    main()
